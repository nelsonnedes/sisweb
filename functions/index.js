const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { onCall: onCallV2, onRequest: onRequestV2, HttpsError: HttpsErrorV2 } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
admin.initializeApp();

const { auth, https } = require('firebase-functions/v1');
const SUPER_ADMIN_EMAILS_RAW = process.env.SUPERADMIN_EMAILS || 'nedes1@hotmail.com';
const SUPER_ADMIN_UIDS_RAW = process.env.SUPERADMIN_UIDS || 'HfrQ6ObQq2aSEoeEE4Ng9jpAolB3';
const ADMIN_CORE_COMPANY_ID = 'sisweb_admin_core';
const SUBSCRIPTION_SETTINGS_PATH = 'system/subscriptionSettings';

function buildSuperAdminEmailSet() {
    const tokens = String(SUPER_ADMIN_EMAILS_RAW || '')
        .split(/[,\s;]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    const set = new Set();
    tokens.forEach((token) => set.add(token.toLowerCase()));
    return set;
}

function buildSuperAdminUidSet() {
    const tokens = String(SUPER_ADMIN_UIDS_RAW || '')
        .split(/[,\s;]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    const set = new Set();
    tokens.forEach((token) => set.add(token));
    return set;
}

const SUPER_ADMIN_EMAILS = buildSuperAdminEmailSet();
const SUPER_ADMIN_UIDS = buildSuperAdminUidSet();

function isSuperAdminEmail(email) {
    if (!email) return false;
    return SUPER_ADMIN_EMAILS.has(String(email).trim().toLowerCase());
}

function isSuperAdminUidAllowed(uid) {
    if (!uid) return false;
    return SUPER_ADMIN_UIDS.has(String(uid).trim());
}

async function ensureSuperAdminClaimIfAllowed(uid) {
    if (!uid) return false;
    const userRecord = await admin.auth().getUser(uid);
    const currentClaims = userRecord.customClaims || {};
    const email = String(userRecord.email || '').trim().toLowerCase();
    if (currentClaims.superadmin === true) return true;
    if (!isSuperAdminEmail(email) && !isSuperAdminUidAllowed(uid)) return false;
    await admin.auth().setCustomUserClaims(uid, { ...currentClaims, superadmin: true });
    await admin.auth().revokeRefreshTokens(uid);
    return true;
}

async function isDbMarkedSuperAdmin(uid) {
    if (!uid) return false;
    try {
        const userSnap = await admin.database().ref(`users/${uid}`).get();
        if (userSnap.exists()) {
            const user = userSnap.val() || {};
            if (user.superadmin === true) return true;
            if (String(user.role || '').toLowerCase() === 'super_admin') return true;
        }
    } catch (_) {}
    try {
        const roleSnap = await admin.database().ref(`roles/${uid}`).get();
        if (roleSnap.exists()) {
            const role = roleSnap.val() || {};
            if (role.superadmin === true) return true;
            if (String(role.role || '').toLowerCase() === 'super_admin') return true;
        }
    } catch (_) {}
    return false;
}

async function promoteSuperAdminByUid(uid, options = {}) {
    if (!uid) return { success: false, reason: 'uid_missing' };
    const removeCompanyIdClaim = options.removeCompanyIdClaim !== false;
    const userRecord = await admin.auth().getUser(uid);
    const currentClaims = userRecord.customClaims || {};
    const nextClaims = { ...currentClaims, superadmin: true };
    if (removeCompanyIdClaim) {
        delete nextClaims.companyId;
        delete nextClaims.companyID;
        delete nextClaims.tenantId;
    }
    const changed = JSON.stringify(currentClaims) !== JSON.stringify(nextClaims);
    if (changed) {
        await admin.auth().setCustomUserClaims(uid, nextClaims);
        await admin.auth().revokeRefreshTokens(uid);
    }
    try {
        await admin.database().ref(`users/${uid}`).update({
            superadmin: true,
            role: 'super_admin',
            adminActive: true,
            adminPermissions: {
                dashboard: true,
                subscriptions: true,
                settings: true
            },
            companyId: null,
            subscriptionStatus: 'active',
            accountStatus: 'active',
            statusReason: '',
            pendingPayment: null,
            subscription: {
                active: true,
                type: 'premium',
                startDate: new Date('2020-01-01T00:00:00.000Z').toISOString(),
                endDate: new Date('2099-12-31T23:59:59.999Z').toISOString()
            },
            updatedAt: new Date().toISOString()
        });
        await admin.database().ref(`roles/${uid}`).update({
            superadmin: true,
            role: 'super_admin',
            active: true,
            companyId: null,
            permissions: {
                dashboard: true,
                subscriptions: true,
                settings: true
            },
            updatedAt: new Date().toISOString()
        });
        try {
            const companiesSnap = await admin.database().ref('companies').get();
            const companies = companiesSnap.exists() ? companiesSnap.val() : {};
            const removals = [];
            Object.keys(companies || {}).forEach((companyId) => {
                removals.push(admin.database().ref(`companies/${companyId}/users/${uid}`).remove().catch(() => {}));
            });
            if (removals.length) await Promise.all(removals);
        } catch (_) {}
    } catch (_) {}
    return { success: true, changed, claims: nextClaims, userRecord };
}

async function isCallerSuperAdmin(context) {
    if (!context || !context.auth || !context.auth.uid) return false;
    const token = context.auth.token || {};
    try {
        const uid = context.auth.uid;
        if (token.superadmin === true && !isSuperAdminUidAllowed(uid)) return true;
        if (isSuperAdminUidAllowed(uid)) {
            const promoted = await promoteSuperAdminByUid(uid, { removeCompanyIdClaim: true });
            return promoted && promoted.success === true;
        }
        const byEmail = await ensureSuperAdminClaimIfAllowed(uid);
        if (byEmail) return true;
        const byDbMarker = await isDbMarkedSuperAdmin(uid);
        if (!byDbMarker) return false;
        const promoted = await promoteSuperAdminByUid(uid, { removeCompanyIdClaim: true });
        return promoted && promoted.success === true;
    } catch (_) {
        return false;
    }
}

async function assertSuperAdmin(context, message) {
    const allowed = await isCallerSuperAdmin(context);
    if (!allowed) {
        throw new functions.https.HttpsError('permission-denied', message || 'Apenas superadmin pode executar esta operação.');
    }
}

function parseStringList(value) {
    if (Array.isArray(value)) {
        return value.map((v) => String(v || '').trim()).filter(Boolean);
    }
    return String(value || '')
        .split(/[,\s;]+/)
        .map((v) => v.trim())
        .filter(Boolean);
}

async function listAllAuthUsers() {
    const out = [];
    let pageToken;
    do {
        const page = await admin.auth().listUsers(1000, pageToken);
        out.push(...(page.users || []));
        pageToken = page.pageToken;
    } while (pageToken);
    return out;
}

async function getStoredCompanyId(uid) {
    try {
        const snapshot = await admin.database().ref(`users/${uid}/companyId`).get();
        if (snapshot.exists() && snapshot.val()) return String(snapshot.val());
    } catch (_) {}
    return null;
}

async function inferCompanyIdByEmailOrMembership(uid, email) {
    try {
        const companiesSnap = await admin.database().ref('companies').get();
        if (!companiesSnap.exists()) return null;
        const companies = companiesSnap.val() || {};
        const normalizedEmail = String(email || '').trim().toLowerCase();
        for (const [companyId, payload] of Object.entries(companies)) {
            if (!payload || typeof payload !== 'object') continue;
            const usersMap = payload.users && typeof payload.users === 'object' ? payload.users : null;
            if (usersMap) {
                if (usersMap[uid]) return String(companyId);
                for (const userData of Object.values(usersMap)) {
                    const candidateEmail = String(userData && userData.email ? userData.email : '').trim().toLowerCase();
                    if (normalizedEmail && candidateEmail && normalizedEmail === candidateEmail) return String(companyId);
                }
            }
        }
    } catch (_) {}
    return null;
}

async function resolveCompanyIdForUser(uid, email, tokenClaims, existingUser) {
    const candidate = String(
        (existingUser && (existingUser.companyId || existingUser.companyID || existingUser.tenantId)) ||
        (tokenClaims && (tokenClaims.companyId || tokenClaims.companyID || tokenClaims.tenantId)) ||
        (await getStoredCompanyId(uid)) ||
        ''
    );
    if (candidate) return candidate;
    const inferred = await inferCompanyIdByEmailOrMembership(uid, email);
    if (inferred) return inferred;
    const directMap = {
        'jnmadeirasm@hotmail.com': '1749492103278',
        'madeportes27@gmail.com': '1773405515226'
    };
    const byEmail = directMap[String(email || '').trim().toLowerCase()] || '';
    return byEmail || '';
}

async function getCompanyIdFromLatestRequest(uid) {
    if (!uid) return '';
    try {
        const snap = await admin.database().ref(`subscriptionRequests/${uid}`).get();
        if (!snap.exists()) return '';
        const byUid = snap.val() || {};
        const list = Object.values(byUid || {}).filter((r) => r && typeof r === 'object');
        if (!list.length) return '';
        list.sort((a, b) => new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime());
        const latest = list[0] || {};
        return String(latest.companyId || latest.tenantId || latest.companyID || '').trim();
    } catch (_) {
        return '';
    }
}

async function resolveCompanyIdForOperationalSync(uid, preferredCompanyId, existingUser, email) {
    const preferred = String(preferredCompanyId || '').trim();
    if (preferred) return preferred;
    const fromUser = String(existingUser && (existingUser.companyId || existingUser.companyID || existingUser.tenantId) || '').trim();
    if (fromUser) return fromUser;
    const fromRequest = await getCompanyIdFromLatestRequest(uid);
    if (fromRequest) return fromRequest;
    const inferred = await inferCompanyIdByEmailOrMembership(uid, email);
    return String(inferred || '').trim();
}

function buildMirrorUserPatch(baseUser, patch, companyId) {
    const base = baseUser && typeof baseUser === 'object' ? baseUser : {};
    const incoming = patch && typeof patch === 'object' ? patch : {};
    const out = {
        uid: String(base.uid || incoming.uid || ''),
        email: String(base.email || incoming.email || ''),
        username: String(base.username || base.displayName || incoming.username || incoming.displayName || ''),
        displayName: String(base.displayName || incoming.displayName || base.username || incoming.username || ''),
        companyId: String(companyId || ''),
        updatedAt: incoming.updatedAt || new Date().toISOString()
    };
    const keys = ['subscriptionStatus', 'accountStatus', 'statusReason', 'pendingPayment', 'subscription', 'payments', 'campaignLedger', 'updatedBy', 'role', 'adminPermissions', 'adminActive', 'superadmin', 'readOnlyUntil', 'readOnlyGrantedAt', 'readOnlyGrantedBy', 'readOnlyGraceConsumed', 'readOnlyReason'];
    keys.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(incoming, k)) out[k] = incoming[k];
        else if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    });
    return out;
}

async function applyUserPatchAcrossScopes(uid, patch, options = {}) {
    const userUid = String(uid || '').trim();
    if (!userUid) return { companyId: '', before: {} };
    const userRef = admin.database().ref(`users/${userUid}`);
    const userSnap = await userRef.get();
    const before = userSnap.exists() ? (userSnap.val() || {}) : {};
    const nowIso = new Date().toISOString();
    const patchPayload = { ...(patch || {}) };
    if (!patchPayload.updatedAt) patchPayload.updatedAt = nowIso;
    const isSuperAdminUser = (
        isSuperAdminUidAllowed(userUid)
        || patchPayload.superadmin === true
        || before.superadmin === true
        || String(patchPayload.role || before.role || '').toLowerCase() === 'super_admin'
    );
    if (isSuperAdminUser) {
        patchPayload.companyId = null;
    }
    const hintedCompanyId = options.companyId || patchPayload.companyId || before.companyId || '';
    const emailHint = before.email || patchPayload.email || options.email || '';
    const companyId = isSuperAdminUser ? '' : await resolveCompanyIdForOperationalSync(userUid, hintedCompanyId, before, emailHint);
    if (companyId) patchPayload.companyId = companyId;
    await userRef.update(patchPayload);
    if (companyId && !isSuperAdminUser) {
        const mirrorPayload = buildMirrorUserPatch({ ...before, ...patchPayload }, patchPayload, companyId);
        await admin.database().ref(`companies/${companyId}/users/${userUid}`).update(mirrorPayload);
    } else if (isSuperAdminUser) {
        try {
            const companiesSnap = await admin.database().ref('companies').get();
            const companies = companiesSnap.exists() ? companiesSnap.val() : {};
            const removals = [];
            Object.keys(companies || {}).forEach((cId) => {
                removals.push(admin.database().ref(`companies/${cId}/users/${userUid}`).remove().catch(() => {}));
            });
            if (removals.length) await Promise.all(removals);
        } catch (_) {}
    }
    return { companyId, before: { ...before, ...patchPayload } };
}

async function syncRequestInScopes(uid, requestId, companyId, patch) {
    const userUid = String(uid || '').trim();
    const reqId = String(requestId || '').trim();
    if (!userUid || !reqId) return;
    const patchPayload = patch && typeof patch === 'object' ? patch : {};
    const rootRef = admin.database().ref(`subscriptionRequests/${userUid}/${reqId}`);
    const rootSnap = await rootRef.get();
    if (rootSnap.exists()) {
        await rootRef.update(patchPayload);
    }
    const tenant = String(companyId || '').trim();
    if (tenant) {
        const companyRef = admin.database().ref(`companies/${tenant}/subscriptionRequests/${userUid}/${reqId}`);
        const companySnap = await companyRef.get();
        if (companySnap.exists()) {
            await companyRef.update(patchPayload);
        }
    }
}

function normalizePermissions(input) {
    const defaults = {
        dashboard: false,
        subscriptions: false,
        settings: false
    };
    const source = input && typeof input === 'object' ? input : {};
    return {
        dashboard: source.dashboard === true,
        subscriptions: source.subscriptions === true,
        settings: source.settings === true
    };
}

function toMoney(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.round(parsed * 100) / 100;
}

function sanitizeText(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    const out = String(value).trim();
    return out.slice(0, 300);
}

function normalizeDocumentDigits(value) {
    return String(value || '').replace(/\D+/g, '').trim();
}

function normalizeRequestIp(context) {
    try {
        const req = context && context.rawRequest ? context.rawRequest : null;
        if (!req) return '';
        const headers = req.headers || {};
        const forwarded = sanitizeText(headers['x-forwarded-for'] || headers['x-real-ip'] || '');
        if (forwarded) return forwarded.split(',')[0].trim();
        const direct = sanitizeText(req.ip || req.connection && req.connection.remoteAddress || '');
        return direct;
    } catch (_) {
        return '';
    }
}

function normalizeRequestUserAgent(context) {
    try {
        const req = context && context.rawRequest ? context.rawRequest : null;
        if (!req) return '';
        return sanitizeText(req.headers && req.headers['user-agent'] ? req.headers['user-agent'] : '');
    } catch (_) {
        return '';
    }
}

function buildUserIdentitySnapshot(user, token, fallbackPlan) {
    const source = user && typeof user === 'object' ? user : {};
    const claims = token && typeof token === 'object' ? token : {};
    const subscription = source.subscription && typeof source.subscription === 'object' ? source.subscription : {};
    const plan = sanitizeText(
        fallbackPlan
        || subscription.type
        || source.currentPlan
        || source.plan
        || '',
        ''
    );
    return {
        realName: sanitizeText(source.realName || source.nome || source.fullName || source.displayName || source.username || ''),
        phone: sanitizeText(source.phone || source.telefone || source.celular || source.whatsapp || ''),
        email: sanitizeText(source.email || claims.email || ''),
        plan
    };
}

function mergeIdentitySnapshot(existingSnapshot, freshSnapshot) {
    const current = existingSnapshot && typeof existingSnapshot === 'object' ? existingSnapshot : {};
    const fresh = freshSnapshot && typeof freshSnapshot === 'object' ? freshSnapshot : {};
    return {
        realName: sanitizeText(current.realName || fresh.realName || ''),
        phone: sanitizeText(current.phone || fresh.phone || ''),
        email: sanitizeText(current.email || fresh.email || ''),
        plan: sanitizeText(current.plan || fresh.plan || '')
    };
}

function sanitizeLongText(value, fallback = '', maxLen = 2_500_000) {
    if (value === undefined || value === null) return fallback;
    const out = String(value).trim();
    if (!out) return fallback;
    return out.slice(0, Math.max(0, maxLen));
}

function sanitizeTransactionMeta(rawMeta) {
    const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    const card = meta.card && typeof meta.card === 'object' ? meta.card : {};
    const boleto = meta.boleto && typeof meta.boleto === 'object' ? meta.boleto : {};
    const pix = meta.pix && typeof meta.pix === 'object' ? meta.pix : {};
    const transfer = meta.transfer && typeof meta.transfer === 'object' ? meta.transfer : {};
    return {
        card: {
            holderName: sanitizeText(card.holderName || ''),
            last4: sanitizeText(card.last4 || ''),
            brand: sanitizeText(card.brand || ''),
            installments: Math.max(1, Math.min(24, parseInt(card.installments, 10) || 1))
        },
        boleto: {
            dueDate: sanitizeText(boleto.dueDate || ''),
            line: sanitizeText(boleto.line || ''),
            ourNumber: sanitizeText(boleto.ourNumber || ''),
            bank: sanitizeText(boleto.bank || '')
        },
        pix: {
            txid: sanitizeText(pix.txid || ''),
            payerDocument: sanitizeText(pix.payerDocument || '')
        },
        transfer: {
            bank: sanitizeText(transfer.bank || ''),
            reference: sanitizeText(transfer.reference || '')
        }
    };
}

function normalizeSubscriptionSettings(input) {
    const source = input && typeof input === 'object' ? input : {};
    const plans = source.plans && typeof source.plans === 'object' ? source.plans : {};
    const methods = source.paymentMethods && typeof source.paymentMethods === 'object' ? source.paymentMethods : {};
    const freeTrialDays = Math.max(0, Math.min(90, parseInt(source.freeTrialDays, 10) || 0));
    const lateGraceDays = Math.max(0, Math.min(90, parseInt(source.lateGraceDays, 10) || 0));
    const promoEnabled = !!(source.promotion && source.promotion.enabled);
    const promoPercentRaw = parseInt(source.promotion && source.promotion.discountPercent, 10);
    const promoPercent = Math.max(0, Math.min(80, Number.isFinite(promoPercentRaw) ? promoPercentRaw : 0));
    const campaign = source.campaign && typeof source.campaign === 'object' ? source.campaign : {};
    const discountLadderRaw = Array.isArray(campaign.discountLadder) ? campaign.discountLadder : [];
    const discountLadder = discountLadderRaw
        .map((item) => ({
            minNewClients: Math.max(1, Math.min(5000, parseInt(item && item.minNewClients, 10) || 0)),
            discountPercent: Math.max(0, Math.min(80, parseInt(item && item.discountPercent, 10) || 0))
        }))
        .filter((item) => item.minNewClients > 0 && item.discountPercent > 0)
        .sort((a, b) => a.minNewClients - b.minNewClients);
    const quarterlyAmount = toMoney(
        plans.quarterly && plans.quarterly.amount !== undefined
            ? plans.quarterly.amount
            : (plans.annual && plans.annual.amount !== undefined ? plans.annual.amount : 59.9),
        59.9
    );
    return {
        plans: {
            monthly: {
                label: 'Plano Mensal',
                periodLabel: '/mês',
                amount: toMoney(plans.monthly && plans.monthly.amount, 19.9),
                enabled: plans.monthly ? plans.monthly.enabled !== false : true
            },
            quarterly: {
                label: 'Plano Trimestral',
                periodLabel: '/trimestre',
                amount: quarterlyAmount,
                enabled: plans.quarterly ? plans.quarterly.enabled !== false : (plans.annual ? plans.annual.enabled !== false : true)
            },
            premium: {
                label: 'Plano Premium',
                periodLabel: '/ano',
                amount: toMoney(plans.premium && plans.premium.amount, 228.0),
                enabled: !!(plans.premium && plans.premium.enabled)
            },
            annual: {
                label: 'Plano Trimestral',
                periodLabel: '/trimestre',
                amount: quarterlyAmount,
                enabled: plans.quarterly ? plans.quarterly.enabled !== false : (plans.annual ? plans.annual.enabled !== false : true)
            }
        },
        paymentMethods: {
            pix: methods.pix !== false,
            boleto: !!methods.boleto,
            card: !!methods.card,
            transfer: !!methods.transfer
        },
        paymentMeta: {
            pixKey: sanitizeText(source.paymentMeta && source.paymentMeta.pixKey, ''),
            beneficiary: sanitizeText(source.paymentMeta && source.paymentMeta.beneficiary, ''),
            supportEmail: sanitizeText(source.paymentMeta && source.paymentMeta.supportEmail, '')
        },
        promotion: {
            enabled: promoEnabled,
            title: sanitizeText(source.promotion && source.promotion.title, ''),
            discountPercent: promoPercent
        },
        campaign: {
            enabled: !!campaign.enabled,
            title: sanitizeText(campaign.title, 'Campanha Comercial'),
            discountLadder,
            newClientGoal: {
                monthlyTarget: Math.max(0, Math.min(10000, parseInt(campaign.newClientGoal && campaign.newClientGoal.monthlyTarget, 10) || 0)),
                bonusPercent: Math.max(0, Math.min(30, parseInt(campaign.newClientGoal && campaign.newClientGoal.bonusPercent, 10) || 0))
            },
            specieBalance: {
                enabled: !!(campaign.specieBalance && campaign.specieBalance.enabled),
                conversionPercent: Math.max(1, Math.min(100, parseInt(campaign.specieBalance && campaign.specieBalance.conversionPercent, 10) || 10)),
                cashoutThreshold: toMoney(campaign.specieBalance && campaign.specieBalance.cashoutThreshold, 300),
                minCashout: toMoney(campaign.specieBalance && campaign.specieBalance.minCashout, 50)
            },
            referral: {
                enabled: !!(campaign.referral && campaign.referral.enabled),
                discountPercentForNewClient: Math.max(0, Math.min(40, parseInt(campaign.referral && campaign.referral.discountPercentForNewClient, 10) || 0)),
                commissionPercentForReferrer: Math.max(0, Math.min(40, parseInt(campaign.referral && campaign.referral.commissionPercentForReferrer, 10) || 0))
            }
        },
        freeTrialDays,
        lateGraceDays,
        updatedAt: new Date().toISOString()
    };
}

function mergeSubscriptionSettingsInput(currentInput, nextInput) {
    const current = currentInput && typeof currentInput === 'object' ? currentInput : {};
    const next = nextInput && typeof nextInput === 'object' ? nextInput : {};
    return {
        ...current,
        ...next,
        plans: {
            ...(current.plans || {}),
            ...(next.plans || {}),
            monthly: { ...((current.plans || {}).monthly || {}), ...((next.plans || {}).monthly || {}) },
            annual: { ...((current.plans || {}).annual || {}), ...((next.plans || {}).annual || {}) },
            premium: { ...((current.plans || {}).premium || {}), ...((next.plans || {}).premium || {}) }
        },
        paymentMethods: { ...(current.paymentMethods || {}), ...(next.paymentMethods || {}) },
        paymentMeta: { ...(current.paymentMeta || {}), ...(next.paymentMeta || {}) },
        promotion: { ...(current.promotion || {}), ...(next.promotion || {}) },
        campaign: {
            ...(current.campaign || {}),
            ...(next.campaign || {}),
            newClientGoal: { ...((current.campaign || {}).newClientGoal || {}), ...((next.campaign || {}).newClientGoal || {}) },
            specieBalance: { ...((current.campaign || {}).specieBalance || {}), ...((next.campaign || {}).specieBalance || {}) },
            referral: { ...((current.campaign || {}).referral || {}), ...((next.campaign || {}).referral || {}) },
            discountLadder: Array.isArray(next.campaign && next.campaign.discountLadder)
                ? next.campaign.discountLadder
                : (Array.isArray(current.campaign && current.campaign.discountLadder) ? current.campaign.discountLadder : [])
        }
    };
}

function compactSettingsAuditShape(settingsInput) {
    const settings = normalizeSubscriptionSettings(settingsInput || {});
    return {
        plans: {
            monthly: settings.plans.monthly,
            quarterly: settings.plans.quarterly,
            premium: settings.plans.premium
        },
        promotion: settings.promotion,
        campaign: settings.campaign
    };
}

async function appendCampaignConfigAudit(actorUid, beforeSettings, afterSettings) {
    const payload = {
        actorUid: sanitizeText(actorUid || ''),
        at: new Date().toISOString(),
        before: compactSettingsAuditShape(beforeSettings || {}),
        after: compactSettingsAuditShape(afterSettings || {})
    };
    await admin.database().ref('subscriptionCampaignAudit').push(payload);
}

function getAllowedPaymentMethods(settings) {
    const methods = settings && settings.paymentMethods ? settings.paymentMethods : {};
    return Object.keys(methods).filter((k) => methods[k] === true);
}

function resolvePricingFromSettings(plan, settings) {
    const planKey = String(plan || '').toLowerCase();
    const plans = settings && settings.plans ? settings.plans : {};
    const targetPlan = plans[planKey];
    if (!targetPlan || targetPlan.enabled === false) {
        throw new functions.https.HttpsError('failed-precondition', 'Plano indisponível no momento.');
    }
    let amount = toMoney(targetPlan.amount, 0);
    const promotion = settings && settings.promotion ? settings.promotion : {};
    if (promotion.enabled && promotion.discountPercent > 0) {
        amount = toMoney(amount * (1 - (promotion.discountPercent / 100)), 0);
    }
    const campaign = settings && settings.campaign ? settings.campaign : {};
    const ladder = Array.isArray(campaign.discountLadder) ? campaign.discountLadder : [];
    const referralCount = Math.max(0, parseInt(settings && settings.__runtimeReferralCount, 10) || 0);
    let ladderDiscount = 0;
    ladder.forEach((step) => {
        if (referralCount >= step.minNewClients) ladderDiscount = Math.max(ladderDiscount, step.discountPercent);
    });
    if (campaign.enabled && ladderDiscount > 0) {
        amount = toMoney(amount * (1 - (ladderDiscount / 100)), 0);
    }
    if (campaign.enabled && settings && settings.__runtimeIsNewClient === true) {
        const bonus = campaign.newClientGoal && campaign.newClientGoal.bonusPercent ? campaign.newClientGoal.bonusPercent : 0;
        if (bonus > 0) amount = toMoney(amount * (1 - (bonus / 100)), 0);
    }
    if (campaign.enabled && settings && settings.__runtimeHasReferral === true) {
        const refDiscount = campaign.referral && campaign.referral.discountPercentForNewClient ? campaign.referral.discountPercentForNewClient : 0;
        if (refDiscount > 0) amount = toMoney(amount * (1 - (refDiscount / 100)), 0);
    }
    if (planKey === 'premium') {
        amount = toMoney(amount * 0.95, 0);
    }
    return {
        planKey,
        amount,
        displayLabel: targetPlan.label || planKey
    };
}

function sha256(input) {
    return crypto.createHash('sha256').update(String(input || '')).digest('hex');
}

function randomToken() {
    return crypto.randomBytes(24).toString('hex');
}

function parseDateSafe(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function calculatePendingGraceDays(user, settings) {
    const sourceDate = (user && user.pendingPayment && user.pendingPayment.date) || (user && user.updatedAt) || null;
    const base = parseDateSafe(sourceDate);
    if (!base) return 0;
    const diffMs = Date.now() - base.getTime();
    const pendingAgeDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    const configured = parseInt(settings && settings.lateGraceDays, 10);
    const graceDays = Math.max(0, Math.min(30, Number.isFinite(configured) ? configured : 0));
    return Math.max(0, graceDays - pendingAgeDays);
}

async function appendSubscriptionAuditLog(uid, requestId, eventType, actorUid, details) {
    const payload = {
        eventType: sanitizeText(eventType || 'UNKNOWN', 'UNKNOWN'),
        actorUid: sanitizeText(actorUid || ''),
        at: new Date().toISOString(),
        details: details && typeof details === 'object' ? details : {}
    };
    await admin.database().ref(`subscriptionAudit/${uid}/${requestId}`).push(payload);
}

async function pushUserNotification(uid, payload) {
    if (!uid) return;
    const item = {
        title: sanitizeText(payload && payload.title ? payload.title : 'Atualização de assinatura', 'Atualização de assinatura'),
        message: sanitizeText(payload && payload.message ? payload.message : '', ''),
        type: sanitizeText(payload && payload.type ? payload.type : 'info', 'info'),
        read: false,
        createdAt: new Date().toISOString(),
        source: 'subscription'
    };
    await admin.database().ref(`users/${uid}/notifications`).push(item);
}

async function resolveRequestByUidOrKey(uid, requestId) {
    if (uid && requestId) {
        const directRef = admin.database().ref(`subscriptionRequests/${uid}/${requestId}`);
        const snap = await directRef.get();
        if (snap.exists()) {
            const data = snap.val() || {};
            const companyId = String(data.companyId || '').trim();
            return { uid, requestId, ref: directRef, data, companyId };
        }
        const companiesSnap = await admin.database().ref('companies').get();
        const companies = companiesSnap.exists() ? companiesSnap.val() : {};
        for (const companyKey of Object.keys(companies || {})) {
            const companyRef = admin.database().ref(`companies/${companyKey}/subscriptionRequests/${uid}/${requestId}`);
            const companyReqSnap = await companyRef.get();
            if (!companyReqSnap.exists()) continue;
            const data = companyReqSnap.val() || {};
            return { uid, requestId, ref: companyRef, data, companyId: String(companyKey) };
        }
    }
    if (!requestId) {
        throw new functions.https.HttpsError('invalid-argument', 'requestId é obrigatório.');
    }
    const rootSnap = await admin.database().ref('subscriptionRequests').get();
    const all = rootSnap.exists() ? rootSnap.val() : {};
    for (const candidateUid of Object.keys(all || {})) {
        const byUid = all[candidateUid] || {};
        if (byUid && byUid[requestId]) {
            const data = byUid[requestId] || {};
            return {
                uid: candidateUid,
                requestId,
                ref: admin.database().ref(`subscriptionRequests/${candidateUid}/${requestId}`),
                data,
                companyId: String(data.companyId || '').trim()
            };
        }
    }
    const companiesSnap = await admin.database().ref('companies').get();
    const companies = companiesSnap.exists() ? companiesSnap.val() : {};
    for (const [companyKey, payload] of Object.entries(companies || {})) {
        const reqRoot = payload && payload.subscriptionRequests && typeof payload.subscriptionRequests === 'object'
            ? payload.subscriptionRequests
            : {};
        for (const candidateUid of Object.keys(reqRoot || {})) {
            const byUid = reqRoot[candidateUid] || {};
            if (!byUid || !byUid[requestId]) continue;
            return {
                uid: candidateUid,
                requestId,
                ref: admin.database().ref(`companies/${companyKey}/subscriptionRequests/${candidateUid}/${requestId}`),
                data: byUid[requestId] || {},
                companyId: String(companyKey)
            };
        }
    }
    throw new functions.https.HttpsError('not-found', 'Solicitação de assinatura não encontrada.');
}

// 1. Gatilho para novos usuários
exports.addCompanyClaimOnSignUp = auth.user().onCreate(async (user) => {
    const { uid, email } = user;

    // Lógica para determinar o companyId para o novo usuário
    // Por exemplo, você pode ter uma coleção 'pending_companies' ou 'user_registrations'
    // onde o companyId é definido após o registro inicial.
    // Por simplicidade, vamos assumir um companyId padrão ou buscar de algum lugar.
    console.log(`Novo usuário ${email} criado. O companyId será definido pelo cliente.`);
});

// 2. Função HTTP Callable para definir/atualizar claims e recarregar assinatura (Agilidade & Segurança Mapeadas)
exports.setCompanyClaim = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    const callerUid = context.auth.uid;
    const callerIsSuperAdmin = await isCallerSuperAdmin(context);
    const payload = data || {};
    const targetUid = payload.targetUid ? String(payload.targetUid) : '';
    const requestedCompanyId = payload.companyId ? String(payload.companyId) : '';
    
    if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid é obrigatório.');
    }

    let resolvedCompanyId = requestedCompanyId;
    let subscriptionStatus = 'active'; // Default inicial de tolerância em onboarding
    const normalizeSubscriptionStatusForClaim = (value) => {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return 'active';
        if (raw === 'trial' || raw === 'trialing' || raw === 'em_teste' || raw === 'teste') return 'trial_active';
        if (raw === 'pending_grace') return 'pending';
        const allowed = new Set(['active', 'trial_active', 'pending', 'expired', 'blocked']);
        return allowed.has(raw) ? raw : 'active';
    };

    if (!callerIsSuperAdmin) {
        if (callerUid !== targetUid) {
            throw new functions.https.HttpsError('permission-denied', 'Sem permissão para alterar claims de outro usuário.');
        }
        
        // A Fonte da Verdade agora é APENAS o Banco de Dados. O usuário NÃO pode forjar o próprio nó users/$uid devido as novas regras .write
        const storedCompanyId = await getStoredCompanyId(targetUid);
        if (!storedCompanyId) {
            throw new functions.https.HttpsError('permission-denied', 'Usuário não possui uma empresa válida no sistema (companyId ausente).');
        }
        
        // Sobrepõe qualquer tentativa do Frontend de ditar sua empresa se for diferente do Backend (Security Patched)
        resolvedCompanyId = storedCompanyId;

        // Recupera o status da assinatura real do Banco
        try {
            const userSnap = await admin.database().ref(`users/${targetUid}`).get();
            if (userSnap.exists()) {
                const userData = userSnap.val();
                if (userData.subscriptionStatus) subscriptionStatus = userData.subscriptionStatus;
                else if (userData.status) subscriptionStatus = userData.status;
            }
        } catch(e) { console.warn('Falha ao ler status de assinatura no RTDB:', e); }
    }
    subscriptionStatus = normalizeSubscriptionStatusForClaim(subscriptionStatus);

    try {
        const targetUserRecord = await admin.auth().getUser(targetUid);
        const targetClaims = targetUserRecord.customClaims || {};
        
        // Superadmins nunca assinam como uma empresa padrão no seu claim root (a não ser explicitamente injetado como test)
        const targetLooksSuperAdmin = (
            targetClaims.superadmin === true
            || isSuperAdminUidAllowed(targetUid)
            || isSuperAdminEmail(targetUserRecord.email)
        );
        
        if (targetLooksSuperAdmin) {
            throw new functions.https.HttpsError('failed-precondition', 'Superadmin não deve receber companyId associado a tenant comum.');
        }

        // Injeção de Segurança Tripla: companyId + tenantId + subscriptionStatus
        const nextClaims = { 
            ...targetClaims, 
            companyId: resolvedCompanyId,
            tenantId: resolvedCompanyId,
            subscriptionStatus: subscriptionStatus
        };

        await admin.auth().setCustomUserClaims(targetUid, nextClaims);
        
        // Sincronizando metadados apenas, pois não permitimos que o usuário manipule o tenant no DB via front
        await applyUserPatchAcrossScopes(targetUid, {
            companyId: resolvedCompanyId,
            subscriptionStatus: subscriptionStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: callerUid
        }, { email: targetUserRecord.email || '' });
        
        // Desloga sessoes ociosas/invalidas para forçar atualização do token no client 
        await admin.auth().revokeRefreshTokens(targetUid);
        
        return { success: true, message: `Custom claim e Assinatura renovadas para o usuário ${targetUid}.`, companyId: resolvedCompanyId, subscriptionStatus };
    } catch (error) {
        console.error(`Erro ao definir custom claim para ${targetUid}:`, error);
        throw new functions.https.HttpsError('internal', 'Erro interno ao definir custom claim de empresa e assinatura.', error);
    }
});

exports.createCompanyOnboarding = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    const uid = String(context.auth.uid || '');
    if (!uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Sessão inválida.');
    }
    const callerIsSuperAdmin = await isCallerSuperAdmin(context);
    if (callerIsSuperAdmin) {
        throw new functions.https.HttpsError('failed-precondition', 'Superadmin global não deve criar company via onboarding.');
    }
    const payload = data && typeof data === 'object' ? data : {};
    const input = payload.company && typeof payload.company === 'object' ? payload.company : {};
    const name = sanitizeText(input.name || input.companyName || input.fantasyName || input.razaoSocial || '', '');
    if (!name) {
        throw new functions.https.HttpsError('invalid-argument', 'Nome da empresa é obrigatório.');
    }
    const email = sanitizeText(input.email || context.auth.token.email || '', '');
    const existingCompanyId = await getStoredCompanyId(uid);
    if (existingCompanyId) {
        throw new functions.https.HttpsError('failed-precondition', 'Usuário já possui empresa vinculada.');
    }
    let companyId = String(input.id || input.companyId || input.companyID || '').trim();
    if (!companyId) {
        companyId = String(Date.now());
    }
    let companyRef = admin.database().ref(`companies/${companyId}`);
    let companySnap = await companyRef.get();
    if (companySnap.exists()) {
        companyId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        companyRef = admin.database().ref(`companies/${companyId}`);
        companySnap = await companyRef.get();
        if (companySnap.exists()) {
            throw new functions.https.HttpsError('already-exists', 'Não foi possível gerar um ID único para empresa.');
        }
    }
    const nowIso = new Date().toISOString();
    const companyPayload = {
        id: companyId,
        companyId,
        name,
        cnpj: sanitizeText(input.cnpj || '', ''),
        address: sanitizeText(input.address || '', ''),
        city: sanitizeText(input.city || '', ''),
        state: sanitizeText(input.state || '', ''),
        phone: sanitizeText(input.phone || '', ''),
        logo: sanitizeText(input.logo || '', ''),
        logoBase64: sanitizeText(input.logoBase64 || '', ''),
        timestamp: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: uid
    };
    await companyRef.update(companyPayload);
    const userRecord = await admin.auth().getUser(uid);
    const currentClaims = userRecord.customClaims || {};
    const nextClaims = { ...currentClaims, companyId };
    await admin.auth().setCustomUserClaims(uid, nextClaims);
    await applyUserPatchAcrossScopes(uid, {
        companyId,
        updatedAt: nowIso,
        updatedBy: uid
    }, { email: email || userRecord.email || '' });
    await admin.database().ref(`companies/${companyId}/users/${uid}`).update({
        uid,
        email: email || userRecord.email || '',
        companyId,
        username: sanitizeText(input.username || userRecord.displayName || '', ''),
        displayName: sanitizeText(input.username || userRecord.displayName || '', ''),
        updatedAt: nowIso
    });
    await admin.database().ref(`roles/${uid}`).update({
        role: 'admin',
        active: true,
        companyId,
        updatedAt: nowIso
    });
    await admin.auth().revokeRefreshTokens(uid);
    return { success: true, companyId, company: companyPayload };
});

exports.reconcileSuperAdminClaims = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    await assertSuperAdmin(context, 'Apenas superadmin pode reconciliar claims globais.');
    const payload = data && typeof data === 'object' ? data : {};
    const payloadEmails = [
        ...parseStringList(payload.emails),
        ...parseStringList(payload.superAdminEmails)
    ].map((v) => v.toLowerCase());
    const payloadUids = parseStringList(payload.uids);
    const removeCompanyIdClaim = payload.removeCompanyIdClaim !== false;
    const dryRun = payload.dryRun === true;
    const emailSet = new Set([...SUPER_ADMIN_EMAILS, ...payloadEmails]);
    const uidSet = new Set(payloadUids);
    const resolvedUsers = new Map();
    const missing = [];

    for (const email of emailSet) {
        try {
            const userRecord = await admin.auth().getUserByEmail(String(email));
            resolvedUsers.set(String(userRecord.uid), userRecord);
        } catch (_) {
            missing.push({ type: 'email', value: email });
        }
    }
    for (const uid of uidSet) {
        try {
            const userRecord = await admin.auth().getUser(String(uid));
            resolvedUsers.set(String(userRecord.uid), userRecord);
        } catch (_) {
            missing.push({ type: 'uid', value: uid });
        }
    }

    const items = [];
    let changed = 0;
    let unchanged = 0;
    for (const userRecord of resolvedUsers.values()) {
        const currentClaims = userRecord.customClaims || {};
        const nextClaims = { ...currentClaims, superadmin: true };
        if (removeCompanyIdClaim) {
            delete nextClaims.companyId;
            delete nextClaims.companyID;
            delete nextClaims.tenantId;
        }
        const hasChanged = JSON.stringify(currentClaims) !== JSON.stringify(nextClaims);
        if (!dryRun) {
            await promoteSuperAdminByUid(userRecord.uid, { removeCompanyIdClaim });
        }
        if (hasChanged) changed += 1;
        else unchanged += 1;
        items.push({
            uid: userRecord.uid,
            email: userRecord.email || '',
            changed: hasChanged,
            claims: nextClaims
        });
    }

    return {
        success: true,
        dryRun,
        removeCompanyIdClaim,
        sourceEmails: Array.from(emailSet),
        sourceUids: Array.from(uidSet),
        processed: items.length,
        changed,
        unchanged,
        missing,
        items
    };
});

exports.syncMyAdminClaims = https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    const uid = context.auth.uid;
    const token = context.auth.token || {};
    if (token.superadmin === true && !isSuperAdminUidAllowed(uid)) {
        return { success: true, superadmin: true, changed: false, source: 'token' };
    }
    if (isSuperAdminUidAllowed(uid)) {
        const promoted = await promoteSuperAdminByUid(uid, { removeCompanyIdClaim: true });
        return { success: true, superadmin: true, changed: !!(promoted && promoted.changed), source: 'uid_allowlist' };
    }
    const byEmail = await ensureSuperAdminClaimIfAllowed(uid);
    if (byEmail) {
        return { success: true, superadmin: true, changed: true, source: 'email_allowlist' };
    }
    const byDb = await isDbMarkedSuperAdmin(uid);
    if (byDb) {
        const promoted = await promoteSuperAdminByUid(uid, { removeCompanyIdClaim: true });
        return { success: true, superadmin: true, changed: !!(promoted && promoted.changed), source: 'db_marker' };
    }
    return { success: true, superadmin: false, changed: false, source: 'none' };
});

exports.auditAdminClaimsInconsistencies = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    await assertSuperAdmin(context, 'Apenas superadmin pode auditar inconsistências de claims.');
    const payload = data && typeof data === 'object' ? data : {};
    const includeConsistent = payload.includeConsistent === true;
    const users = await listAllAuthUsers();
    const items = [];
    let inconsistentCount = 0;
    let consistentCount = 0;
    users.forEach((userRecord) => {
        const claims = userRecord.customClaims || {};
        const email = String(userRecord.email || '').trim().toLowerCase();
        const issues = [];
        const hasSuperadmin = claims.superadmin === true;
        const hasCompanyIdClaim = !!(claims.companyId || claims.companyID || claims.tenantId);
        const isAdminPanelUser = claims.adminPanelUser === true;
        const isGlobalAllowlisted = isSuperAdminEmail(email);
        if (isAdminPanelUser && !hasSuperadmin) {
            issues.push('adminPanelUser=true sem superadmin=true');
        }
        if (hasSuperadmin && hasCompanyIdClaim) {
            issues.push('superadmin=true com companyId/companyID/tenantId presente');
        }
        if (isGlobalAllowlisted && !hasSuperadmin) {
            issues.push('email global allowlisted sem claim superadmin');
        }
        const inconsistent = issues.length > 0;
        if (inconsistent) inconsistentCount += 1;
        else consistentCount += 1;
        if (inconsistent || includeConsistent) {
            items.push({
                uid: userRecord.uid,
                email: userRecord.email || '',
                disabled: userRecord.disabled === true,
                claims,
                inconsistent,
                issues
            });
        }
    });
    return {
        success: true,
        totalUsers: users.length,
        inconsistentCount,
        consistentCount,
        generatedAt: new Date().toISOString(),
        items
    };
});

exports.setUserAccessStatus = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode alterar status de acesso.');
    const payload = data || {};
    const targetUid = payload.targetUid ? String(payload.targetUid) : '';
    const status = payload.status ? String(payload.status).trim().toLowerCase() : '';
    const reason = payload.reason ? String(payload.reason).slice(0, 300) : '';
    const allowed = new Set(['trial_active', 'pending', 'expired', 'blocked', 'active']);
    if (!targetUid || !allowed.has(status)) {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid e status válidos são obrigatórios.');
    }
    const updatePayload = {
        subscriptionStatus: status,
        updatedAt: new Date().toISOString(),
        updatedBy: callerUid
    };
    if (reason) updatePayload.statusReason = reason;
    if (status === 'blocked') updatePayload.accountStatus = 'blocked';
    if (status === 'active' || status === 'trial_active') updatePayload.accountStatus = 'active';
    const syncResult = await applyUserPatchAcrossScopes(targetUid, updatePayload, {});
    return { success: true, targetUid, status, companyId: syncResult.companyId || '' };
});

exports.deleteSubscriptionManagedData = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode excluir dados de assinatura.');
    const payload = data || {};
    const targetUid = payload.targetUid ? String(payload.targetUid) : '';
    const reviewNote = sanitizeText(payload.reviewNote || '');
    if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid é obrigatório.');
    }
    const nowIso = new Date().toISOString();
    const profileRef = admin.database().ref(`users/${targetUid}`);
    const profileSnap = await profileRef.get();
    const profile = profileSnap.exists() ? profileSnap.val() : {};
    const companyHint = String((profile && profile.companyId) || '').trim();

    let proofHashesRemoved = 0;
    try {
        const proofHashesRef = admin.database().ref('subscriptionProofHashes');
        const proofHashesSnap = await proofHashesRef.get();
        const proofHashesMap = proofHashesSnap.exists() ? (proofHashesSnap.val() || {}) : {};
        const hashUpdates = {};
        Object.keys(proofHashesMap || {}).forEach((fingerprint) => {
            const item = proofHashesMap[fingerprint] || {};
            if (String(item.uid || '') === targetUid) {
                hashUpdates[fingerprint] = null;
                proofHashesRemoved += 1;
            }
        });
        if (Object.keys(hashUpdates).length) {
            await proofHashesRef.update(hashUpdates);
        }
    } catch (_) {}

    const companyRootsSnap = await admin.database().ref('companies').get();
    const companiesMap = companyRootsSnap.exists() ? companyRootsSnap.val() : {};
    const companyTasks = [];
    Object.keys(companiesMap || {}).forEach((companyId) => {
        companyTasks.push(admin.database().ref(`companies/${companyId}/subscriptionRequests/${targetUid}`).remove().catch(() => {}));
    });
    if (companyTasks.length) await Promise.all(companyTasks);

    await admin.database().ref(`subscriptionRequests/${targetUid}`).remove().catch(() => {});
    await admin.database().ref(`subscriptionAudit/${targetUid}`).remove().catch(() => {});
    await admin.database().ref(`subscriptionFinancialAudit/${targetUid}`).remove().catch(() => {});
    await admin.database().ref(`subscriptionExtensionRequests/${targetUid}`).remove().catch(() => {});

    const cleanedPatch = {
        pendingPayment: null,
        subscription: null,
        payments: null,
        campaignLedger: null,
        referralHistory: null,
        latestRequestId: null,
        latestRequestStatus: null,
        approvalState: null,
        requestState: null,
        subscriptionStatus: 'expired',
        accountStatus: 'active',
        statusReason: reviewNote || 'Dados de assinatura removidos administrativamente.',
        updatedAt: nowIso,
        updatedBy: callerUid
    };
    await applyUserPatchAcrossScopes(targetUid, cleanedPatch, { companyId: companyHint });
    await admin.database().ref(`subscriptionAdminPurgeAudit/${targetUid}`).push({
        at: nowIso,
        by: callerUid,
        reviewNote,
        removed: {
            subscriptionRequests: true,
            subscriptionAudit: true,
            subscriptionFinancialAudit: true,
            subscriptionExtensionRequests: true,
            proofHashes: proofHashesRemoved
        }
    });
    await pushUserNotification(targetUid, {
        type: 'warning',
        title: 'Dados de assinatura reiniciados',
        message: 'Os dados de assinatura anteriores foram removidos pelo administrador. Se necessário, envie novo comprovante.'
    });
    return { success: true, targetUid, proofHashesRemoved };
});

exports.createAdminSubUser = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode criar sub-usuários.');
    const payload = data || {};
    const email = payload.email ? String(payload.email).trim().toLowerCase() : '';
    const password = payload.password ? String(payload.password) : '';
    const displayName = payload.displayName ? String(payload.displayName).trim() : '';
    const permissions = normalizePermissions(payload.permissions || {});
    if (!email || !password || password.length < 6 || !displayName) {
        throw new functions.https.HttpsError('invalid-argument', 'email, password (mínimo 6) e displayName são obrigatórios.');
    }
    const created = await admin.auth().createUser({
        email,
        password,
        displayName
    });
    const rolePayload = {
        role: 'sub_admin',
        companyId: ADMIN_CORE_COMPANY_ID,
        ownerUid: callerUid,
        permissions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    await admin.auth().setCustomUserClaims(created.uid, {
        companyId: ADMIN_CORE_COMPANY_ID,
        adminPanelUser: true,
        superadmin: false
    });
    await admin.database().ref(`roles/${created.uid}`).set(rolePayload);
    await admin.database().ref(`users/${created.uid}`).update({
        uid: created.uid,
        email,
        username: displayName,
        displayName,
        role: 'sub_admin',
        adminOwnerUid: callerUid,
        companyId: ADMIN_CORE_COMPANY_ID,
        adminPermissions: permissions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
    await admin.auth().revokeRefreshTokens(created.uid);
    return {
        success: true,
        user: {
            uid: created.uid,
            email,
            displayName,
            companyId: ADMIN_CORE_COMPANY_ID,
            role: 'sub_admin',
            permissions
        }
    };
});

exports.updateAdminSubUserPermissions = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode alterar permissões.');
    const payload = data || {};
    const targetUid = payload.targetUid ? String(payload.targetUid) : '';
    const permissions = normalizePermissions(payload.permissions || {});
    const active = payload.active !== false;
    if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid é obrigatório.');
    }
    const roleRef = admin.database().ref(`roles/${targetUid}`);
    const roleSnapshot = await roleRef.get();
    if (!roleSnapshot.exists()) {
        throw new functions.https.HttpsError('not-found', 'Sub-usuário não encontrado.');
    }
    const roleData = roleSnapshot.val() || {};
    if (roleData.ownerUid !== callerUid) {
        throw new functions.https.HttpsError('permission-denied', 'Sub-usuário não pertence ao superadmin autenticado.');
    }
    await roleRef.update({
        permissions,
        active,
        updatedAt: new Date().toISOString()
    });
    await admin.database().ref(`users/${targetUid}`).update({
        adminPermissions: permissions,
        adminActive: active,
        updatedAt: new Date().toISOString()
    });
    return { success: true, targetUid, permissions, active };
});

exports.getSubscriptionSettings = https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem consultar configurações.');
    }
    const snapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const normalized = normalizeSubscriptionSettings(snapshot.exists() ? snapshot.val() : {});
    return { success: true, settings: normalized };
});

exports.upsertSubscriptionSettings = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem alterar configurações.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode alterar configuração comercial.');
    const currentSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const currentSettings = currentSnapshot.exists() ? currentSnapshot.val() : {};
    const mergedInput = mergeSubscriptionSettingsInput(currentSettings, data || {});
    const normalized = normalizeSubscriptionSettings(mergedInput);
    normalized.updatedBy = callerUid;
    await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).set(normalized);
    await appendCampaignConfigAudit(callerUid, currentSettings, normalized);
    return { success: true, settings: normalized };
});

exports.upsertCompanyProfile = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem alterar empresas.');
    }
    await assertSuperAdmin(context, 'Apenas superadmin pode alterar perfil de empresa.');
    const payload = data && typeof data === 'object' ? data : {};
    const companyId = sanitizeText(payload.companyId || payload.id || '', '');
    if (!companyId) {
        throw new functions.https.HttpsError('invalid-argument', 'companyId é obrigatório.');
    }
    const profileRef = admin.database().ref(`companies/${companyId}/profile`);
    const currentSnap = await profileRef.get();
    const current = currentSnap.exists() && currentSnap.val() && typeof currentSnap.val() === 'object'
        ? currentSnap.val()
        : {};
    const requestedCnpjRaw = sanitizeText(payload.cnpj || payload.cnpjCpf || payload.cpfCnpj || payload.documento || current.cnpj || current.cnpjCpf || current.cpfCnpj || current.documento || '', '');
    const requestedCnpjDigits = normalizeDocumentDigits(requestedCnpjRaw);
    if (requestedCnpjDigits.length >= 11) {
        const companiesSnap = await admin.database().ref('companies').get();
        const companies = companiesSnap.exists() && companiesSnap.val() && typeof companiesSnap.val() === 'object'
            ? companiesSnap.val()
            : {};
        const duplicatedIn = Object.keys(companies).find((otherCompanyId) => {
            if (String(otherCompanyId || '').trim() === companyId) return false;
            const profile = companies[otherCompanyId] && companies[otherCompanyId].profile && typeof companies[otherCompanyId].profile === 'object'
                ? companies[otherCompanyId].profile
                : {};
            const otherDigits = normalizeDocumentDigits(profile.cnpj || profile.cnpjCpf || profile.cpfCnpj || profile.documento || '');
            return !!otherDigits && otherDigits === requestedCnpjDigits;
        });
        if (duplicatedIn) {
            throw new functions.https.HttpsError(
                'already-exists',
                `CNPJ já cadastrado na empresa ${duplicatedIn}. Não é permitido duplicar CNPJ em company IDs diferentes.`
            );
        }
    }
    const nextProfile = {
        ...current,
        id: companyId,
        companyId,
        name: sanitizeText(payload.name || payload.nome || current.name || current.nome || '', ''),
        cnpj: requestedCnpjRaw,
        stateRegistration: sanitizeText(payload.stateRegistration || payload.inscricaoEstadual || payload.ie || current.stateRegistration || current.inscricaoEstadual || current.ie || '', ''),
        address: sanitizeText(payload.address || payload.endereco || current.address || current.endereco || '', ''),
        city: sanitizeText(payload.city || payload.cidade || current.city || current.cidade || '', ''),
        state: sanitizeText(payload.state || payload.estado || payload.uf || current.state || current.estado || current.uf || '', ''),
        phone: sanitizeText(payload.phone || payload.telefone || current.phone || current.telefone || '', ''),
        logo: sanitizeLongText(payload.logo || current.logo || '', ''),
        logoBase64: sanitizeLongText(payload.logoBase64 || current.logoBase64 || '', ''),
        updatedAt: new Date().toISOString(),
        updatedBy: context.auth.uid
    };
    await profileRef.set(nextProfile);
    return { success: true, companyId, profile: nextProfile };
});

exports.updateMyCompanyProfile = https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem alterar empresa.');
    }
    const uid = context.auth.uid;
    const token = context.auth.token || {};
    const payload = data && typeof data === 'object' ? data : {};
    const userSnap = await admin.database().ref(`users/${uid}`).get();
    const userData = userSnap.exists() && userSnap.val() && typeof userSnap.val() === 'object'
        ? userSnap.val()
        : {};
    const companyId = sanitizeText(
        payload.companyId
        || payload.id
        || userData.companyId
        || userData.companyID
        || userData.tenantId
        || token.companyId
        || token.companyID
        || token.tenantId
        || '',
        ''
    );
    if (!companyId) {
        throw new functions.https.HttpsError('failed-precondition', 'Usuário sem companyId válido.');
    }
    const subscriptionStatus = String(
        userData.subscriptionStatus
        || token.subscriptionStatus
        || userData.status
        || ''
    ).trim().toLowerCase();
    const canWrite = token.superadmin === true || subscriptionStatus === 'active' || subscriptionStatus === 'trial_active';
    if (!canWrite) {
        throw new functions.https.HttpsError('permission-denied', `Assinatura sem permissão de escrita: ${subscriptionStatus || 'vazio'}`);
    }
    const profileRef = admin.database().ref(`companies/${companyId}/profile`);
    const currentSnap = await profileRef.get();
    const current = currentSnap.exists() && currentSnap.val() && typeof currentSnap.val() === 'object'
        ? currentSnap.val()
        : {};
    const preservedCnpj = sanitizeText(current.cnpj || current.cnpjCpf || current.cpfCnpj || current.documento || '', '');
    const nextProfile = {
        ...current,
        id: companyId,
        companyId,
        name: sanitizeText(payload.name || payload.nome || current.name || current.nome || '', ''),
        cnpj: preservedCnpj,
        stateRegistration: sanitizeText(payload.stateRegistration || payload.inscricaoEstadual || payload.ie || current.stateRegistration || current.inscricaoEstadual || current.ie || '', ''),
        address: sanitizeText(payload.address || payload.endereco || current.address || current.endereco || '', ''),
        city: sanitizeText(payload.city || payload.cidade || current.city || current.cidade || '', ''),
        state: sanitizeText(payload.state || payload.estado || payload.uf || current.state || current.estado || current.uf || '', ''),
        phone: sanitizeText(payload.phone || payload.telefone || current.phone || current.telefone || '', ''),
        logo: sanitizeLongText(payload.logo || current.logo || '', ''),
        logoBase64: sanitizeLongText(payload.logoBase64 || current.logoBase64 || '', ''),
        updatedAt: new Date().toISOString(),
        updatedBy: uid
    };
    await profileRef.set(nextProfile);
    return { success: true, companyId, profile: nextProfile };
});

exports.submitSubscriptionRequest = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem enviar solicitação.');
    }
    const uid = context.auth.uid;
    const payload = data || {};
    const method = String(payload.paymentMethod || '').toLowerCase();
    const proofChannel = sanitizeText(payload.proofChannel || 'email', 'email');
    const proofReference = sanitizeText(payload.proofReference || '');
    const proofHash = sanitizeText(payload.proofHash || '');
    const proofStoragePath = sanitizeText(payload.proofStoragePath || '');
    const proofUrl = sanitizeText(payload.proofUrl || '');
    const proofFileName = sanitizeText(payload.proofFileName || '');
    const proofMimeType = sanitizeText(payload.proofMimeType || '');
    const notes = sanitizeText(payload.notes || '');
    const transactionMeta = sanitizeTransactionMeta(payload.transactionMeta || {});
    if (!method) {
        throw new functions.https.HttpsError('invalid-argument', 'Método de pagamento é obrigatório.');
    }
    if (!proofHash || proofHash.length < 20) {
        throw new functions.https.HttpsError('invalid-argument', 'hash do comprovante é obrigatório.');
    }
    const settingsSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const settings = normalizeSubscriptionSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : {});
    const graceDays = Math.max(0, Math.min(30, parseInt(settings.lateGraceDays, 10) || 0));
    const referralCount = Math.max(0, parseInt(payload.referralCount, 10) || 0);
    const referralEmail = sanitizeText(payload.referralEmail || '').toLowerCase();
    settings.__runtimeReferralCount = referralCount;
    settings.__runtimeHasReferral = !!referralEmail;
    const allowedMethods = getAllowedPaymentMethods(settings);
    if (!allowedMethods.includes(method)) {
        throw new functions.https.HttpsError('failed-precondition', 'Método de pagamento não habilitado pelo administrador.');
    }
    const userRef = admin.database().ref(`users/${uid}`);
    const userSnapshot = await userRef.get();
    const existingUser = userSnapshot.exists() ? userSnapshot.val() : {};
    const userEmail = existingUser.email || context.auth.token.email || '';
    const companyId = await resolveCompanyIdForUser(uid, userEmail, context.auth.token || {}, existingUser || {});
    const createdAtBase = existingUser.createdAt ? new Date(existingUser.createdAt) : null;
    const isNewClient = createdAtBase && !Number.isNaN(createdAtBase.getTime())
        ? ((Date.now() - createdAtBase.getTime()) <= (30 * 24 * 60 * 60 * 1000))
        : true;
    settings.__runtimeIsNewClient = payload.isNewClient === true || isNewClient;
    const pricing = resolvePricingFromSettings(payload.plan, settings);
    const nowIso = new Date().toISOString();
    const requestIp = normalizeRequestIp(context);
    const requestUserAgent = normalizeRequestUserAgent(context);
    const identitySnapshot = buildUserIdentitySnapshot(existingUser, context.auth.token || {}, pricing.planKey);
    const graceUntilIso = (() => {
        if (!graceDays) return '';
        const until = new Date();
        until.setDate(until.getDate() + graceDays);
        return until.toISOString();
    })();
    const pendingPayment = {
        status: 'pending',
        plan: pricing.planKey,
        amount: pricing.amount,
        method,
        date: nowIso,
        graceDays,
        graceUntil: graceUntilIso,
        reference: proofReference || `${pricing.planKey}-${Date.now()}`,
        notes,
        proofChannel,
        proofHash,
        proofStoragePath,
        proofUrl,
        proofFileName,
        proofMimeType
    };
    if (transactionMeta && typeof transactionMeta === 'object') pendingPayment.transactionMeta = transactionMeta;
    if (referralEmail) pendingPayment.referralEmail = referralEmail;
    const proofFingerprint = sha256(`${uid}|${pendingPayment.reference}|${proofHash}|${pricing.planKey}|${pricing.amount}|${method}`);
    const replayRef = admin.database().ref(`subscriptionProofHashes/${proofFingerprint}`);
    const replaySnap = await replayRef.get();
    if (replaySnap.exists()) {
        const replayOwner = replaySnap.val() && replaySnap.val().uid ? String(replaySnap.val().uid) : '';
        if (replayOwner && replayOwner !== uid) {
            throw new functions.https.HttpsError('already-exists', 'Comprovante já utilizado em outra conta.');
        }
    }
    const userPatch = {
        uid,
        email: userEmail,
        username: existingUser.username || existingUser.displayName || (context.auth.token.email ? String(context.auth.token.email).split('@')[0] : 'usuario'),
        companyId: companyId || existingUser.companyId || '',
        subscriptionStatus: 'pending',
        accountStatus: 'pending',
        statusReason: 'Aguardando validação administrativa do comprovante.',
        pendingPayment,
        campaignLedger: existingUser.campaignLedger || { totalDiscountGranted: 0, specieBalance: 0, totalPaid: 0 },
        updatedAt: nowIso
    };
    const userSync = await applyUserPatchAcrossScopes(uid, userPatch, { companyId, email: userEmail });
    const effectiveCompanyId = userSync.companyId || String(companyId || '').trim();
    const reqRef = admin.database().ref(`subscriptionRequests/${uid}`).push();
    const requestId = reqRef.key;
    const requestPayload = {
        requestId,
        uid,
        createdAt: nowIso,
        ...pendingPayment,
        proofFingerprint,
        transactionMeta,
        approvalState: 'pending_review',
        referralEmail,
        requestIp,
        requestUserAgent,
        userSnapshot: identitySnapshot
    };
    if (effectiveCompanyId) requestPayload.companyId = effectiveCompanyId;
    await reqRef.set(requestPayload);
    if (effectiveCompanyId) {
        await admin.database().ref(`companies/${effectiveCompanyId}/subscriptionRequests/${uid}/${requestId}`).set(requestPayload);
    }
    await replayRef.set({
        uid,
        requestId,
        createdAt: nowIso
    });
    await appendSubscriptionAuditLog(uid, requestId, 'REQUEST_SUBMITTED', uid, {
        plan: pricing.planKey,
        amount: pricing.amount,
        method,
        proofChannel,
        proofReference: pendingPayment.reference,
        proofFingerprint,
        referralCount,
        isNewClient: settings.__runtimeIsNewClient === true,
        referralEmail,
        requestIp,
        requestUserAgent,
        realName: identitySnapshot.realName,
        phone: identitySnapshot.phone,
        email: identitySnapshot.email
    });
    await pushUserNotification(uid, {
        type: 'info',
        title: 'Comprovante enviado',
        message: 'Sua solicitação de pagamento foi recebida e está aguardando validação administrativa.'
    });
    return {
        success: true,
        request: {
            requestId,
            uid,
            plan: pricing.planKey,
            amount: pricing.amount,
            method,
            status: 'pending'
        }
    };
});

exports.updateSubscriptionFinancialEvent = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem atualizar eventos financeiros.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode atualizar eventos financeiros.');
    const payload = data && typeof data === 'object' ? data : {};
    const uid = payload.uid ? String(payload.uid) : '';
    const requestId = payload.requestId ? String(payload.requestId) : '';
    const eventTypeRaw = String(payload.eventType || '').trim().toUpperCase();
    const allowedEvents = new Set(['BOLETO_ISSUED', 'BOLETO_PAID_MARKED', 'PAYMENT_RECONCILED', 'PAYMENT_NOTE', 'PAYMENT_CHARGEBACK']);
    if (!requestId || !allowedEvents.has(eventTypeRaw)) {
        throw new functions.https.HttpsError('invalid-argument', 'requestId e eventType válidos são obrigatórios.');
    }
    const resolved = await resolveRequestByUidOrKey(uid, requestId);
    const req = resolved.data || {};
    const financial = req.financial && typeof req.financial === 'object' ? req.financial : {};
    const details = payload.details && typeof payload.details === 'object' ? payload.details : {};
    const nowIso = new Date().toISOString();
    const cleanDetails = {
        note: sanitizeText(details.note || payload.note || ''),
        dueDate: sanitizeText(details.dueDate || ''),
        boletoLine: sanitizeText(details.boletoLine || ''),
        ourNumber: sanitizeText(details.ourNumber || ''),
        txid: sanitizeText(details.txid || ''),
        reconciliationRef: sanitizeText(details.reconciliationRef || ''),
        amount: toMoney(details.amount || 0, 0)
    };
    const timeline = Array.isArray(financial.timeline) ? financial.timeline.slice(-24) : [];
    const eventEntry = {
        id: randomToken().slice(0, 16),
        eventType: eventTypeRaw,
        actorUid: callerUid,
        at: nowIso,
        details: cleanDetails
    };
    timeline.push(eventEntry);
    const nextFinancial = {
        ...financial,
        timeline: timeline.slice(-30),
        lastEventType: eventTypeRaw,
        lastEventAt: nowIso,
        updatedAt: nowIso,
        updatedBy: callerUid
    };
    if (eventTypeRaw === 'BOLETO_ISSUED') {
        nextFinancial.boleto = {
            issuedAt: nowIso,
            dueDate: cleanDetails.dueDate || '',
            line: cleanDetails.boletoLine || '',
            ourNumber: cleanDetails.ourNumber || '',
            status: 'issued'
        };
    } else if (eventTypeRaw === 'BOLETO_PAID_MARKED') {
        nextFinancial.boleto = {
            ...(nextFinancial.boleto || {}),
            paidMarkedAt: nowIso,
            txid: cleanDetails.txid || '',
            status: 'paid_marked'
        };
    } else if (eventTypeRaw === 'PAYMENT_RECONCILED') {
        nextFinancial.reconciliation = {
            reconciledAt: nowIso,
            reference: cleanDetails.reconciliationRef || '',
            amount: cleanDetails.amount || 0
        };
    } else if (eventTypeRaw === 'PAYMENT_CHARGEBACK') {
        nextFinancial.chargeback = {
            at: nowIso,
            note: cleanDetails.note || ''
        };
    }
    const patch = { financial: nextFinancial };
    await resolved.ref.update(patch);
    const requestCompanyId = await resolveCompanyIdForOperationalSync(resolved.uid, resolved.companyId || req.companyId || '', {}, '');
    await syncRequestInScopes(resolved.uid, resolved.requestId, requestCompanyId, patch);
    await appendSubscriptionAuditLog(resolved.uid, resolved.requestId, eventTypeRaw, callerUid, cleanDetails);
    await admin.database().ref(`subscriptionFinancialAudit/${resolved.uid}/${resolved.requestId}`).push({
        ...eventEntry
    });
    return {
        success: true,
        uid: resolved.uid,
        requestId: resolved.requestId,
        event: eventEntry
    };
});

exports.activateFreeTrial = https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem ativar o período gratuito.');
    }
    const uid = context.auth.uid;
    const settingsSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const settings = normalizeSubscriptionSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : {});
    const trialDays = Math.max(0, Math.min(90, parseInt(settings.freeTrialDays, 10) || 0));
    if (trialDays <= 0) {
        throw new functions.https.HttpsError('failed-precondition', 'Plano gratuito está desabilitado pelo administrador.');
    }
    const userRef = admin.database().ref(`users/${uid}`);
    const userSnapshot = await userRef.get();
    const existingUser = userSnapshot.exists() ? (userSnapshot.val() || {}) : {};
    const userEmail = existingUser.email || context.auth.token.email || '';
    const companyId = await resolveCompanyIdForUser(uid, userEmail, context.auth.token || {}, existingUser || {});
    const nowMs = Date.now();
    const subscription = existingUser.subscription && typeof existingUser.subscription === 'object' ? existingUser.subscription : {};
    const subEnd = subscription.endDate ? parseDateSafe(subscription.endDate) : null;
    const isActiveByDate = !!(subEnd && subEnd.getTime() > nowMs);
    const isActiveByStatus = String(existingUser.subscriptionStatus || '').toLowerCase() === 'active' && !!(subEnd && subEnd.getTime() > nowMs);
    if (isActiveByDate || isActiveByStatus) {
        return { success: true, status: 'active', trialDays };
    }
    if (
        existingUser.trialUsed === true
        || existingUser.trialConsumed === true
        || existingUser.freeTrialUsed === true
        || (subscription && (subscription.trialUsed === true || subscription.freeTrialUsed === true))
    ) {
        throw new functions.https.HttpsError('failed-precondition', 'Período gratuito já foi utilizado. Selecione um plano para renovação.');
    }
    if (existingUser.trialStart) {
        const trialStart = new Date(existingUser.trialStart);
        if (!Number.isNaN(trialStart.getTime())) {
            const diffDays = Math.ceil((nowMs - trialStart.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > trialDays) {
                throw new functions.https.HttpsError('failed-precondition', 'Período gratuito já utilizado. Selecione um plano para aprovação.');
            }
        }
    }
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + trialDays);
    const nowIso = now.toISOString();
    const patch = {
        uid,
        email: userEmail,
        username: existingUser.username || existingUser.displayName || (userEmail ? String(userEmail).split('@')[0] : 'usuario'),
        companyId: companyId || existingUser.companyId || '',
        trialStart: existingUser.trialStart || nowIso,
        trialUsed: true,
        trialConsumed: true,
        freeTrialUsed: true,
        subscriptionStatus: 'trial_active',
        accountStatus: 'active',
        statusReason: '',
        pendingPayment: null,
        subscription: {
            ...(existingUser.subscription || {}),
            active: false,
            type: 'free_trial',
            startDate: existingUser.trialStart || nowIso,
            endDate: endDate.toISOString(),
            trialUsed: true,
            freeTrialUsed: true
        },
        updatedAt: nowIso
    };
    const userSync = await applyUserPatchAcrossScopes(uid, patch, { companyId, email: userEmail });
    await pushUserNotification(uid, {
        type: 'success',
        title: 'Período gratuito ativado',
        message: `Seu acesso completo foi liberado por ${trialDays} dia(s).`
    });
    await appendSubscriptionAuditLog(uid, 'trial-' + now.getTime(), 'TRIAL_ACTIVATED', uid, {
        trialDays,
        companyId: userSync.companyId || companyId || ''
    });
    return { success: true, status: 'trial_active', trialDays, trialStart: patch.trialStart };
});

exports.grantReadOnlyGrace = https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem ativar o modo leitura.');
    }
    const uid = context.auth.uid;
    if (await isCallerSuperAdmin(context)) {
        throw new functions.https.HttpsError('failed-precondition', 'Superadmin não utiliza modo leitura.');
    }
    const settingsSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const settings = normalizeSubscriptionSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : {});
    const graceDays = Math.max(0, Math.min(30, parseInt(settings.lateGraceDays, 10) || 0));
    if (!graceDays) {
        throw new functions.https.HttpsError('failed-precondition', 'Modo leitura está desativado pelo administrador.');
    }

    const userRef = admin.database().ref(`users/${uid}`);
    const snap = await userRef.get();
    if (!snap.exists()) {
        throw new functions.https.HttpsError('not-found', 'Usuário não encontrado.');
    }
    const user = snap.val() || {};

    const now = new Date();
    const nowIso = now.toISOString();
    const existingUntil = user.readOnlyUntil ? parseDateSafe(user.readOnlyUntil) : null;
    if (existingUntil && existingUntil.getTime() > Date.now()) {
        return { success: true, readOnlyUntil: existingUntil.toISOString(), graceDays, alreadyGranted: true };
    }
    if (user.readOnlyGraceConsumed === true) {
        throw new functions.https.HttpsError('failed-precondition', 'Modo leitura já foi utilizado e não pode ser reativado.');
    }

    const subscription = user.subscription && typeof user.subscription === 'object' ? user.subscription : {};
    const endDate = subscription.endDate ? parseDateSafe(subscription.endDate) : null;
    const isActive = (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial_active') || (subscription.active === true && endDate && endDate.getTime() > Date.now());
    if (isActive) {
        throw new functions.https.HttpsError('failed-precondition', 'Assinatura ativa não requer modo leitura.');
    }

    const trialEnd = (subscription.type === 'free_trial' || user.subscriptionStatus === 'trial_active') && subscription.endDate
        ? parseDateSafe(subscription.endDate)
        : null;
    const trialStillValid = trialEnd && trialEnd.getTime() > Date.now();
    if (trialStillValid) {
        throw new functions.https.HttpsError('failed-precondition', 'Teste gratuito ativo não requer modo leitura.');
    }

    const until = new Date(now.getTime());
    until.setDate(until.getDate() + graceDays);
    const untilIso = until.toISOString();
    const patch = {
        readOnlyUntil: untilIso,
        readOnlyGrantedAt: nowIso,
        readOnlyGrantedBy: uid,
        readOnlyReason: 'expired',
        readOnlyGraceConsumed: true,
        updatedAt: nowIso
    };
    const email = user.email || context.auth.token.email || '';
    const companyId = await resolveCompanyIdForUser(uid, email, context.auth.token || {}, user || {});
    await applyUserPatchAcrossScopes(uid, patch, { companyId: companyId || user.companyId || '', email });
    await pushUserNotification(uid, {
        type: 'info',
        title: 'Modo leitura ativado',
        message: `Acesso de consulta liberado por ${graceDays} dia(s).` 
    });
    await appendSubscriptionAuditLog(uid, 'readonly-' + now.getTime(), 'READ_ONLY_GRANTED', uid, {
        graceDays,
        readOnlyUntil: untilIso
    });
    return { success: true, readOnlyUntil: untilIso, graceDays };
});

exports.extendSubscriptionAccess = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode prorrogar assinatura.');
    const payload = data || {};
    const targetUid = payload.targetUid ? String(payload.targetUid) : '';
    const extraDays = Math.max(1, Math.min(365, parseInt(payload.extraDays, 10) || 0));
    if (!targetUid || !extraDays) {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid e extraDays são obrigatórios.');
    }
    const userRef = admin.database().ref(`users/${targetUid}`);
    const snapshot = await userRef.get();
    if (!snapshot.exists()) {
        throw new functions.https.HttpsError('not-found', 'Usuário não encontrado para prorrogação.');
    }
    const user = snapshot.val() || {};
    const now = new Date();
    const base = user.subscription && user.subscription.endDate ? new Date(user.subscription.endDate) : now;
    const effectiveBase = Number.isNaN(base.getTime()) ? now : (base > now ? base : now);
    effectiveBase.setDate(effectiveBase.getDate() + extraDays);
    const nextEndDate = effectiveBase.toISOString();
    const subscription = {
        ...(user.subscription || {}),
        active: true,
        type: (user.subscription && user.subscription.type) || 'monthly',
        startDate: (user.subscription && user.subscription.startDate) || now.toISOString(),
        endDate: nextEndDate
    };
    const updatePayload = {
        subscription,
        subscriptionStatus: 'active',
        accountStatus: 'active',
        statusReason: `Prorrogado por ${extraDays} dia(s) pelo superadmin.`,
        updatedAt: new Date().toISOString(),
        updatedBy: callerUid
    };
    await applyUserPatchAcrossScopes(targetUid, updatePayload, { companyId: user.companyId || '' });
    await pushUserNotification(targetUid, {
        type: 'success',
        title: 'Assinatura prorrogada',
        message: `Seu acesso foi prorrogado por ${extraDays} dia(s) pelo administrador.`
    });
    return { success: true, targetUid, extraDays, endDate: nextEndDate };
});

exports.requestSubscriptionExtension = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem solicitar prorrogação.');
    }
    const uid = context.auth.uid;
    const payload = data || {};
    const justification = sanitizeText(payload.justification || '');
    const requestedDays = Math.max(1, Math.min(30, parseInt(payload.requestedDays, 10) || 0));
    if (!justification || justification.length < 10) {
        throw new functions.https.HttpsError('invalid-argument', 'Justificativa deve conter pelo menos 10 caracteres.');
    }
    if (!requestedDays) {
        throw new functions.https.HttpsError('invalid-argument', 'requestedDays inválido.');
    }
    const userSnap = await admin.database().ref(`users/${uid}`).get();
    const user = userSnap.exists() ? userSnap.val() : {};
    const requestIp = normalizeRequestIp(context);
    const requestUserAgent = normalizeRequestUserAgent(context);
    const identitySnapshot = buildUserIdentitySnapshot(user, context.auth.token || {}, user && user.subscription && user.subscription.type ? user.subscription.type : '');
    const ref = admin.database().ref(`subscriptionExtensionRequests/${uid}`).push();
    const requestId = ref.key;
    const payloadToSave = {
        requestId,
        uid,
        requestedDays,
        justification,
        status: 'pending',
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: '',
        requestIp,
        requestUserAgent,
        userSnapshot: identitySnapshot
    };
    await ref.set(payloadToSave);
    await appendSubscriptionAuditLog(uid, requestId, 'EXTENSION_REQUESTED', uid, {
        requestedDays,
        justification,
        requestIp,
        requestUserAgent,
        realName: identitySnapshot.realName,
        phone: identitySnapshot.phone,
        email: identitySnapshot.email,
        plan: identitySnapshot.plan
    });
    await pushUserNotification(uid, {
        type: 'info',
        title: 'Prorrogação solicitada',
        message: `Sua solicitação de ${requestedDays} dia(s) foi enviada para análise.`
    });
    return { success: true, request: payloadToSave };
});

exports.getOpenExtensionRequests = https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem consultar solicitações.');
    }
    await assertSuperAdmin(context, 'Apenas superadmin pode consultar solicitações.');
    const snap = await admin.database().ref('subscriptionExtensionRequests').get();
    const root = snap.exists() ? snap.val() : {};
    const list = [];
    Object.keys(root || {}).forEach((uid) => {
        const byUid = root[uid] || {};
        Object.keys(byUid).forEach((requestId) => {
            const req = byUid[requestId] || {};
            if (req.status === 'pending') {
                list.push({ ...req, uid, requestId });
            }
        });
    });
    const enriched = await Promise.all(list.map(async (req) => {
        const userSnap = await admin.database().ref(`users/${req.uid}`).get();
        const user = userSnap.exists() ? userSnap.val() : {};
        const companyId = user && user.companyId ? String(user.companyId) : '';
        let company = {};
        if (companyId) {
            const companySnap = await admin.database().ref(`companies/${companyId}`).get();
            company = companySnap.exists() ? companySnap.val() : {};
        }
        return {
            ...req,
            userProfile: {
                email: user.email || '',
                displayName: user.displayName || user.username || '',
                realName: user.realName || user.nome || user.fullName || user.displayName || user.username || '',
                phone: user.phone || user.telefone || user.celular || user.whatsapp || '',
                plan: user.subscription && user.subscription.type ? user.subscription.type : '',
                subscriptionStatus: user.subscriptionStatus || '',
                subscriptionEndDate: user.subscription && user.subscription.endDate ? user.subscription.endDate : '',
                remainingDays: (() => {
                    try {
                        const endRaw = user.subscription && user.subscription.endDate ? user.subscription.endDate : '';
                        if (!endRaw) return 0;
                        const endDate = parseDateSafe(endRaw);
                        if (!endDate) return 0;
                        const diff = endDate.getTime() - Date.now();
                        if (diff <= 0) return 0;
                        return Math.ceil(diff / (1000 * 60 * 60 * 24));
                    } catch (_) {
                        return 0;
                    }
                })(),
                companyId: companyId || '',
                companyName: company && (company.nome || company.name || company.fantasia || '') ? (company.nome || company.name || company.fantasia || '') : ''
            }
        };
    }));
    enriched.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return { success: true, requests: enriched };
});

exports.retroEnrichSubscriptionHistory = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem executar retroenriquecimento.');
    }
    await assertSuperAdmin(context, 'Apenas superadmin pode executar retroenriquecimento.');
    const payload = data && typeof data === 'object' ? data : {};
    const dryRun = payload.dryRun !== false;
    const maxItems = Math.max(1, Math.min(10000, parseInt(payload.maxItems, 10) || 2000));
    const usersSnap = await admin.database().ref('users').get();
    const usersMap = usersSnap.exists() ? (usersSnap.val() || {}) : {};
    const getUserByUid = (uid) => {
        const key = String(uid || '').trim();
        if (!key) return {};
        const user = usersMap[key];
        return user && typeof user === 'object' ? user : {};
    };
    const nowIso = new Date().toISOString();
    const updates = {};
    let scanned = 0;
    let updated = 0;
    let updatedExtension = 0;
    let updatedRequests = 0;
    const extensionSnap = await admin.database().ref('subscriptionExtensionRequests').get();
    const extensionRoot = extensionSnap.exists() ? (extensionSnap.val() || {}) : {};
    Object.keys(extensionRoot).forEach((uid) => {
        const byUid = extensionRoot[uid] && typeof extensionRoot[uid] === 'object' ? extensionRoot[uid] : {};
        const user = getUserByUid(uid);
        Object.keys(byUid).forEach((requestId) => {
            if (scanned >= maxItems) return;
            scanned += 1;
            const req = byUid[requestId] && typeof byUid[requestId] === 'object' ? byUid[requestId] : {};
            const freshSnapshot = buildUserIdentitySnapshot(user, {}, req.plan || req.planKey || '');
            const mergedSnapshot = mergeIdentitySnapshot(req.userSnapshot, freshSnapshot);
            const hasSnapshot = req.userSnapshot && typeof req.userSnapshot === 'object';
            const before = JSON.stringify(hasSnapshot ? req.userSnapshot : {});
            const after = JSON.stringify(mergedSnapshot);
            const nextIp = sanitizeText(req.requestIp || req.ip || req.ipAddress || req.ip_address || req.remoteIp || req.remote_ip || '');
            const nextUa = sanitizeText(req.requestUserAgent || req.userAgent || req.ua || '');
            const needsIpUa = !sanitizeText(req.requestIp || '') || !sanitizeText(req.requestUserAgent || '');
            const changed = before !== after || needsIpUa;
            if (!changed) return;
            updated += 1;
            updatedExtension += 1;
            const path = `subscriptionExtensionRequests/${uid}/${requestId}`;
            updates[`${path}/userSnapshot`] = mergedSnapshot;
            if (!sanitizeText(req.requestIp || '')) updates[`${path}/requestIp`] = nextIp;
            if (!sanitizeText(req.requestUserAgent || '')) updates[`${path}/requestUserAgent`] = nextUa;
            updates[`${path}/retroEnrichedAt`] = nowIso;
            updates[`${path}/retroEnrichedBy`] = context.auth.uid;
        });
    });
    const reqSnap = await admin.database().ref('subscriptionRequests').get();
    const reqRoot = reqSnap.exists() ? (reqSnap.val() || {}) : {};
    Object.keys(reqRoot).forEach((uid) => {
        const byUid = reqRoot[uid] && typeof reqRoot[uid] === 'object' ? reqRoot[uid] : {};
        const user = getUserByUid(uid);
        Object.keys(byUid).forEach((requestId) => {
            if (scanned >= maxItems) return;
            scanned += 1;
            const req = byUid[requestId] && typeof byUid[requestId] === 'object' ? byUid[requestId] : {};
            const freshSnapshot = buildUserIdentitySnapshot(user, {}, req.plan || req.planKey || '');
            const mergedSnapshot = mergeIdentitySnapshot(req.userSnapshot, freshSnapshot);
            const before = JSON.stringify(req.userSnapshot && typeof req.userSnapshot === 'object' ? req.userSnapshot : {});
            const after = JSON.stringify(mergedSnapshot);
            const nextIp = sanitizeText(req.requestIp || req.ip || req.ipAddress || req.ip_address || req.remoteIp || req.remote_ip || '');
            const nextUa = sanitizeText(req.requestUserAgent || req.userAgent || req.ua || '');
            const needsIpUa = !sanitizeText(req.requestIp || '') || !sanitizeText(req.requestUserAgent || '');
            const changed = before !== after || needsIpUa;
            if (!changed) return;
            updated += 1;
            updatedRequests += 1;
            const path = `subscriptionRequests/${uid}/${requestId}`;
            updates[`${path}/userSnapshot`] = mergedSnapshot;
            if (!sanitizeText(req.requestIp || '')) updates[`${path}/requestIp`] = nextIp;
            if (!sanitizeText(req.requestUserAgent || '')) updates[`${path}/requestUserAgent`] = nextUa;
            updates[`${path}/retroEnrichedAt`] = nowIso;
            updates[`${path}/retroEnrichedBy`] = context.auth.uid;
            const companyId = sanitizeText(req.companyId || user.companyId || '');
            if (companyId) {
                const companyPath = `companies/${companyId}/subscriptionRequests/${uid}/${requestId}`;
                updates[`${companyPath}/userSnapshot`] = mergedSnapshot;
                if (!sanitizeText(req.requestIp || '')) updates[`${companyPath}/requestIp`] = nextIp;
                if (!sanitizeText(req.requestUserAgent || '')) updates[`${companyPath}/requestUserAgent`] = nextUa;
                updates[`${companyPath}/retroEnrichedAt`] = nowIso;
                updates[`${companyPath}/retroEnrichedBy`] = context.auth.uid;
            }
        });
    });
    if (!dryRun && Object.keys(updates).length) {
        await admin.database().ref().update(updates);
    }
    await admin.database().ref('adminAudit').push({
        eventType: 'RETRO_ENRICH_SUBSCRIPTION_HISTORY',
        actorUid: context.auth.uid,
        at: nowIso,
        details: {
            dryRun,
            scanned,
            updated,
            updatedExtension,
            updatedRequests
        }
    });
    return {
        success: true,
        dryRun,
        scanned,
        updated,
        updatedExtension,
        updatedRequests
    };
});

exports.reviewSubscriptionExtensionRequest = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem revisar solicitações.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode revisar solicitações.');
    const payload = data || {};
    const uid = payload.uid ? String(payload.uid) : '';
    const requestId = payload.requestId ? String(payload.requestId) : '';
    const approve = payload.approve === true;
    const reviewNote = sanitizeText(payload.reviewNote || '');
    const grantedDays = Math.max(1, Math.min(60, parseInt(payload.grantedDays, 10) || 0));
    if (!uid || !requestId) {
        throw new functions.https.HttpsError('invalid-argument', 'uid e requestId são obrigatórios.');
    }
    const requestRef = admin.database().ref(`subscriptionExtensionRequests/${uid}/${requestId}`);
    const snap = await requestRef.get();
    if (!snap.exists()) {
        throw new functions.https.HttpsError('not-found', 'Solicitação não encontrada.');
    }
    const req = snap.val() || {};
    if (req.status !== 'pending') {
        throw new functions.https.HttpsError('failed-precondition', 'Solicitação já revisada.');
    }
    if (approve) {
        const userRef = admin.database().ref(`users/${uid}`);
        const userSnap = await userRef.get();
        const user = userSnap.exists() ? userSnap.val() : {};
        const now = new Date();
        const base = user.subscription && user.subscription.endDate ? new Date(user.subscription.endDate) : now;
        const effectiveBase = Number.isNaN(base.getTime()) ? now : (base > now ? base : now);
        effectiveBase.setDate(effectiveBase.getDate() + grantedDays);
        const endDate = effectiveBase.toISOString();
        const subscription = {
            ...(user.subscription || {}),
            active: true,
            type: (user.subscription && user.subscription.type) || 'monthly',
            startDate: (user.subscription && user.subscription.startDate) || now.toISOString(),
            endDate
        };
        const userUpdatePayload = {
            subscription,
            subscriptionStatus: 'active',
            accountStatus: 'active',
            statusReason: `Prorrogação aprovada por ${grantedDays} dia(s).`,
            updatedAt: new Date().toISOString(),
            updatedBy: callerUid
        };
        await applyUserPatchAcrossScopes(uid, userUpdatePayload, { companyId: user.companyId || '' });
        await pushUserNotification(uid, {
            type: 'success',
            title: 'Prorrogação aprovada',
            message: `Sua solicitação foi aprovada com ${grantedDays} dia(s) adicionais.`
        });
    } else {
        await pushUserNotification(uid, {
            type: 'warning',
            title: 'Prorrogação rejeitada',
            message: reviewNote || 'Sua solicitação de prorrogação foi rejeitada pelo administrador.'
        });
    }
    await requestRef.update({
        status: approve ? 'approved' : 'rejected',
        grantedDays: approve ? grantedDays : 0,
        reviewedAt: new Date().toISOString(),
        reviewedBy: callerUid,
        reviewNote
    });
    await appendSubscriptionAuditLog(uid, requestId, approve ? 'EXTENSION_APPROVED' : 'EXTENSION_REJECTED', callerUid, {
        grantedDays: approve ? grantedDays : 0,
        reviewNote
    });
    return { success: true };
});

exports.prepareSubscriptionApproval = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem preparar aprovação.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode aprovar solicitações.');
    const payload = data || {};
    const requestId = payload.requestId ? String(payload.requestId) : '';
    const uid = payload.uid ? String(payload.uid) : '';
    const action = String(payload.action || 'approve').toLowerCase();
    if (!requestId || !new Set(['approve', 'reject']).has(action)) {
        throw new functions.https.HttpsError('invalid-argument', 'requestId e action válidos são obrigatórios.');
    }
    const resolved = await resolveRequestByUidOrKey(uid, requestId);
    const req = resolved.data || {};
    if (req.approvalState === 'approved' || req.approvalState === 'rejected') {
        throw new functions.https.HttpsError('failed-precondition', 'Solicitação já concluída.');
    }
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const challengePayload = {
        approvalState: 'awaiting_double_confirmation',
        approvalChallenge: {
            tokenHash: sha256(token),
            action,
            createdAt: new Date().toISOString(),
            createdBy: callerUid,
            expiresAt
        }
    };
    await resolved.ref.update(challengePayload);
    const requestCompanyId = await resolveCompanyIdForOperationalSync(resolved.uid, resolved.companyId || req.companyId || '', {}, '');
    await syncRequestInScopes(resolved.uid, resolved.requestId, requestCompanyId, challengePayload);
    await appendSubscriptionAuditLog(resolved.uid, resolved.requestId, 'APPROVAL_PREPARED', callerUid, {
        action,
        expiresAt
    });
    return { success: true, uid: resolved.uid, requestId: resolved.requestId, challengeToken: token, expiresAt };
});

exports.confirmSubscriptionApproval = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem confirmar aprovação.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode confirmar aprovação.');
    const payload = data || {};
    const requestId = payload.requestId ? String(payload.requestId) : '';
    const uid = payload.uid ? String(payload.uid) : '';
    const challengeToken = payload.challengeToken ? String(payload.challengeToken) : '';
    const decision = String(payload.decision || '').toLowerCase();
    const reviewNote = sanitizeText(payload.reviewNote || '');
    if (!requestId || !challengeToken || !new Set(['approve', 'reject']).has(decision)) {
        throw new functions.https.HttpsError('invalid-argument', 'requestId, challengeToken e decision são obrigatórios.');
    }
    const resolved = await resolveRequestByUidOrKey(uid, requestId);
    const req = resolved.data || {};
    const challenge = req.approvalChallenge || {};
    const expires = parseDateSafe(challenge.expiresAt);
    if (!challenge.tokenHash || !expires || expires.getTime() < Date.now()) {
        throw new functions.https.HttpsError('failed-precondition', 'Challenge expirado. Gere nova confirmação dupla.');
    }
    if (challenge.action !== decision) {
        throw new functions.https.HttpsError('failed-precondition', 'Action divergente da etapa de preparação.');
    }
    if (sha256(challengeToken) !== challenge.tokenHash) {
        throw new functions.https.HttpsError('permission-denied', 'Challenge token inválido.');
    }
    if (decision === 'approve') {
        const pendingPayment = req && req.status === 'pending' ? req : null;
        if (!pendingPayment) {
            throw new functions.https.HttpsError('failed-precondition', 'Solicitação não está pendente.');
        }
        const userRef = admin.database().ref(`users/${resolved.uid}`);
        const userSnap = await userRef.get();
        const user = userSnap.exists() ? userSnap.val() : {};
        const startDate = new Date();
        const endDate = new Date(startDate);
        if (pendingPayment.plan === 'premium') endDate.setFullYear(endDate.getFullYear() + 1);
        else if (pendingPayment.plan === 'quarterly' || pendingPayment.plan === 'annual') endDate.setMonth(endDate.getMonth() + 3);
        else endDate.setMonth(endDate.getMonth() + 1);
        const subscription = {
            ...(user.subscription || {}),
            type: pendingPayment.plan || 'monthly',
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            active: true
        };
        const paymentHistory = Array.isArray(user.payments) ? user.payments : [];
        const settingsSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
        const settings = normalizeSubscriptionSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : {});
        const listPrice = pendingPayment.plan === 'annual'
            ? toMoney(settings.plans && settings.plans.quarterly ? settings.plans.quarterly.amount : 59.9, 59.9)
            : pendingPayment.plan === 'quarterly'
                ? toMoney(settings.plans && settings.plans.quarterly ? settings.plans.quarterly.amount : 59.9, 59.9)
            : pendingPayment.plan === 'premium'
                ? toMoney(settings.plans && settings.plans.premium ? settings.plans.premium.amount : 228, 228)
                : toMoney(settings.plans && settings.plans.monthly ? settings.plans.monthly.amount : 19.9, 19.9);
        const paidAmount = toMoney(pendingPayment.amount || 0, 0);
        const discountAmount = Math.max(0, toMoney(listPrice - paidAmount, 0));
        const ledger = user.campaignLedger && typeof user.campaignLedger === 'object' ? user.campaignLedger : {};
        const specieCfg = settings.campaign && settings.campaign.specieBalance ? settings.campaign.specieBalance : {};
        const accruePercent = specieCfg.enabled ? (Number(specieCfg.conversionPercent || 0) / 100) : 0;
        const accruedSpecie = toMoney(discountAmount * accruePercent, 0);
        const nextLedger = {
            totalDiscountGranted: toMoney((ledger.totalDiscountGranted || 0) + discountAmount, 0),
            specieBalance: toMoney((ledger.specieBalance || 0) + accruedSpecie, 0),
            totalPaid: toMoney((ledger.totalPaid || 0) + paidAmount, 0),
            updatedAt: new Date().toISOString()
        };
        paymentHistory.push({
            date: new Date().toISOString(),
            amount: pendingPayment.amount || 0,
            method: pendingPayment.method || 'pix',
            status: 'approved',
            reference: pendingPayment.reference || resolved.requestId,
            approvedBy: callerUid
        });
        const approveUserPayload = {
            subscription,
            payments: paymentHistory,
            subscriptionStatus: 'active',
            accountStatus: 'active',
            statusReason: '',
            updatedAt: new Date().toISOString(),
            updatedBy: callerUid,
            pendingPayment: null,
            campaignLedger: nextLedger
        };
        await applyUserPatchAcrossScopes(resolved.uid, approveUserPayload, { companyId: user.companyId || req.companyId || resolved.companyId || '' });
        const referralEmail = pendingPayment && pendingPayment.referralEmail ? String(pendingPayment.referralEmail).toLowerCase() : '';
        if (referralEmail) {
            const allUsersSnap = await admin.database().ref('users').get();
            const allUsers = allUsersSnap.exists() ? allUsersSnap.val() : {};
            const referrerEntry = Object.entries(allUsers || {}).find(([, val]) => String(val && val.email ? val.email : '').toLowerCase() === referralEmail);
            if (referrerEntry) {
                const referrerUid = String(referrerEntry[0]);
                const referrer = referrerEntry[1] || {};
                const referralCfg = settings.campaign && settings.campaign.referral ? settings.campaign.referral : {};
                const commissionPct = Number(referralCfg.commissionPercentForReferrer || 0);
                const commissionAmount = commissionPct > 0 ? toMoney(paidAmount * (commissionPct / 100), 0) : 0;
                const refLedger = referrer.campaignLedger && typeof referrer.campaignLedger === 'object' ? referrer.campaignLedger : {};
                const refHistory = Array.isArray(referrer.referralHistory) ? referrer.referralHistory : [];
                refHistory.push({
                    referredUid: resolved.uid,
                    referredEmail: user.email || '',
                    paidAmount,
                    commissionAmount,
                    at: new Date().toISOString()
                });
                await admin.database().ref(`users/${referrerUid}`).update({
                    campaignLedger: {
                        totalDiscountGranted: toMoney(refLedger.totalDiscountGranted || 0, 0),
                        specieBalance: toMoney((refLedger.specieBalance || 0) + commissionAmount, 0),
                        totalPaid: toMoney(refLedger.totalPaid || 0, 0),
                        updatedAt: new Date().toISOString()
                    },
                    referralHistory: refHistory.slice(-80),
                    updatedAt: new Date().toISOString()
                });
                await pushUserNotification(referrerUid, {
                    type: 'success',
                    title: 'Indicação contabilizada',
                    message: `Você recebeu comissão de ${commissionAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por nova assinatura indicada.`
                });
            }
        }
        await pushUserNotification(resolved.uid, {
            type: 'success',
            title: 'Pagamento aprovado',
            message: 'Seu pagamento foi aprovado e sua assinatura está ativa.'
        });
    } else {
        await applyUserPatchAcrossScopes(resolved.uid, {
            subscriptionStatus: 'expired',
            accountStatus: 'blocked',
            statusReason: 'Pagamento rejeitado pelo superadmin.',
            pendingPayment: null,
            updatedAt: new Date().toISOString(),
            updatedBy: callerUid
        }, { companyId: req.companyId || resolved.companyId || '' });
        await pushUserNotification(resolved.uid, {
            type: 'warning',
            title: 'Pagamento rejeitado',
            message: reviewNote || 'Seu comprovante foi rejeitado. Revise os dados e envie novamente.'
        });
    }
    const decisionPayload = {
        approvalState: decision === 'approve' ? 'approved' : 'rejected',
        status: decision === 'approve' ? 'approved' : 'rejected',
        reviewedBy: callerUid,
        reviewedAt: new Date().toISOString(),
        reviewNote,
        approvalChallenge: null
    };
    await resolved.ref.update(decisionPayload);
    const resolvedCompanyId = await resolveCompanyIdForOperationalSync(resolved.uid, resolved.companyId || req.companyId || '', {}, '');
    await syncRequestInScopes(resolved.uid, resolved.requestId, resolvedCompanyId, decisionPayload);
    if (decision === 'approve') {
        const allRequestsRef = admin.database().ref(`subscriptionRequests/${resolved.uid}`);
        const allRequestsSnap = await allRequestsRef.get();
        const allRequestsMap = allRequestsSnap.exists() ? allRequestsSnap.val() : {};
        const supersededAt = new Date().toISOString();
        const supersededPayloadBase = {
            approvalState: 'superseded',
            status: 'superseded',
            supersededByRequestId: resolved.requestId,
            supersededAt,
            reviewedBy: callerUid,
            reviewedAt: supersededAt,
            reviewNote: 'Solicitação substituída por aprovação mais recente.'
        };
        const supersededTasks = [];
        Object.entries(allRequestsMap || {}).forEach(([otherRequestId, data]) => {
            if (String(otherRequestId) === String(resolved.requestId)) return;
            const current = data || {};
            const currentStatus = String(current.status || '').toLowerCase();
            const currentApproval = String(current.approvalState || '').toLowerCase();
            if (currentStatus !== 'pending' && currentApproval !== 'pending_review' && currentApproval !== 'awaiting_double_confirmation') return;
            const payload = {
                ...supersededPayloadBase,
                approvalChallenge: null
            };
            supersededTasks.push((async () => {
                await admin.database().ref(`subscriptionRequests/${resolved.uid}/${otherRequestId}`).update(payload);
                const otherCompanyId = await resolveCompanyIdForOperationalSync(resolved.uid, current.companyId || resolvedCompanyId || '', {}, '');
                await syncRequestInScopes(resolved.uid, otherRequestId, otherCompanyId, payload);
                await appendSubscriptionAuditLog(resolved.uid, otherRequestId, 'REQUEST_SUPERSEDED', callerUid, {
                    supersededByRequestId: resolved.requestId
                });
            })());
        });
        if (supersededTasks.length) {
            await Promise.all(supersededTasks);
        }
    }
    await appendSubscriptionAuditLog(resolved.uid, resolved.requestId, decision === 'approve' ? 'APPROVAL_CONFIRMED' : 'REJECTION_CONFIRMED', callerUid, {
        reviewNote
    });
    return { success: true, uid: resolved.uid, requestId: resolved.requestId, decision };
});

exports.getCampaignConfigAudit = https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem consultar auditoria.');
    }
    await assertSuperAdmin(context, 'Apenas superadmin pode consultar auditoria comercial.');
    const snapshot = await admin.database().ref('subscriptionCampaignAudit').limitToLast(50).get();
    const raw = snapshot.exists() ? snapshot.val() : {};
    const items = Object.entries(raw || {}).map(([id, data]) => ({ id, ...(data || {}) }));
    items.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
    return { success: true, items };
});

exports.getCampaignExecutiveSummary = https.onCall(async (_data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem consultar resumo executivo.');
    }
    await assertSuperAdmin(context, 'Apenas superadmin pode consultar resumo executivo.');
    const settingsSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const settings = normalizeSubscriptionSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : {});
    const usersSnapshot = await admin.database().ref('users').get();
    const usersMap = usersSnapshot.exists() ? usersSnapshot.val() : {};
    const users = Object.values(usersMap || {});
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    let totalPaidThisMonth = 0;
    let pendingPaymentsCount = 0;
    let dueInSevenDays = 0;
    let overdueCount = 0;
    let newClientsMonth = 0;
    let specieBalanceTotal = 0;
    let discountGrantedTotal = 0;
    users.forEach((user) => {
        const createdAt = parseDateSafe(user && user.createdAt);
        if (createdAt && createdAt >= monthStart && createdAt <= monthEnd) newClientsMonth += 1;
        if (user && user.pendingPayment && user.pendingPayment.status === 'pending') pendingPaymentsCount += 1;
        const endDate = parseDateSafe(user && user.subscription && user.subscription.endDate);
        if (endDate) {
            const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays >= 0 && diffDays <= 7) dueInSevenDays += 1;
            if (diffDays < 0) overdueCount += 1;
        } else {
            const status = String(user && user.subscriptionStatus ? user.subscriptionStatus : '').toLowerCase();
            if (status === 'expired' || status === 'blocked') overdueCount += 1;
        }
        const payments = Array.isArray(user && user.payments) ? user.payments : [];
        payments.forEach((payment) => {
            const date = parseDateSafe(payment && payment.date);
            if (payment && payment.status === 'approved' && date && date >= monthStart && date <= monthEnd) {
                totalPaidThisMonth += toMoney(payment.amount || 0, 0);
            }
        });
        const ledger = user && user.campaignLedger ? user.campaignLedger : {};
        specieBalanceTotal += toMoney(ledger.specieBalance || 0, 0);
        discountGrantedTotal += toMoney(ledger.totalDiscountGranted || 0, 0);
    });
    return {
        success: true,
        summary: {
            generatedAt: now.toISOString(),
            totalPaidThisMonth: toMoney(totalPaidThisMonth, 0),
            pendingPaymentsCount,
            dueInSevenDays,
            overdueCount,
            newClientsMonth,
            campaignGoal: settings.campaign && settings.campaign.newClientGoal ? settings.campaign.newClientGoal.monthlyTarget : 0,
            campaignBonusPercent: settings.campaign && settings.campaign.newClientGoal ? settings.campaign.newClientGoal.bonusPercent : 0,
            specieBalanceTotal: toMoney(specieBalanceTotal, 0),
            discountGrantedTotal: toMoney(discountGrantedTotal, 0),
            specieCashoutThreshold: settings.campaign && settings.campaign.specieBalance ? settings.campaign.specieBalance.cashoutThreshold : 0
        }
    };
});

const MERCADO_PAGO_API_BASE = 'https://api.mercadopago.com';
const MERCADO_PAGO_ACCESS_TOKEN_SECRET = defineSecret('MERCADO_PAGO_ACCESS_TOKEN');
const MERCADO_PAGO_WEBHOOK_TOKEN_SECRET = defineSecret('MERCADO_PAGO_WEBHOOK_TOKEN');
const MERCADO_PAGO_WEBHOOK_URL_SECRET = defineSecret('MERCADO_PAGO_WEBHOOK_URL');

function readSecretValue(secretHandle) {
    try {
        if (!secretHandle || typeof secretHandle.value !== 'function') return '';
        return String(secretHandle.value() || '').trim();
    } catch (_) {
        return '';
    }
}

function getMercadoPagoAccessToken() {
    const token = String(readSecretValue(MERCADO_PAGO_ACCESS_TOKEN_SECRET) || process.env.MERCADO_PAGO_ACCESS_TOKEN_LOCAL || '').trim();
    if (!token) {
        throw new HttpsErrorV2('failed-precondition', 'MERCADO_PAGO_ACCESS_TOKEN não configurado.');
    }
    return token;
}

function getMercadoPagoWebhookToken() {
    return String(readSecretValue(MERCADO_PAGO_WEBHOOK_TOKEN_SECRET) || process.env.MERCADO_PAGO_WEBHOOK_TOKEN_LOCAL || '').trim();
}

function getMercadoPagoWebhookUrl() {
    return String(readSecretValue(MERCADO_PAGO_WEBHOOK_URL_SECRET) || process.env.MERCADO_PAGO_WEBHOOK_URL_LOCAL || '').trim();
}

function mapMercadoPagoStatus(statusRaw) {
    const status = String(statusRaw || '').trim().toLowerCase();
    if (status === 'approved') return 'approved';
    if (status === 'rejected' || status === 'cancelled' || status === 'refunded' || status === 'charged_back') return 'rejected';
    return 'pending';
}

async function mercadoPagoApiRequest(path, options = {}) {
    const token = getMercadoPagoAccessToken();
    const method = String(options.method || 'GET').toUpperCase();
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
    if (options.idempotencyKey) {
        headers['X-Idempotency-Key'] = String(options.idempotencyKey);
    }
    const response = await fetch(`${MERCADO_PAGO_API_BASE}${path}`, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const responseText = await response.text();
    let payload = null;
    try {
        payload = responseText ? JSON.parse(responseText) : null;
    } catch (_) {
        payload = responseText || null;
    }
    if (!response.ok) {
        const msg = payload && payload.message ? payload.message : `Mercado Pago HTTP ${response.status}`;
        throw new Error(msg);
    }
    return payload || {};
}

function getSubscriptionPaymentPaths(record) {
    const paymentId = String(record && record.paymentId || '').trim();
    if (!paymentId) return [];
    const uid = String(record && record.uid || '').trim();
    const companyId = String(record && record.companyId || '').trim();
    const paths = [`subscriptionPayments/${paymentId}`];
    if (companyId) paths.push(`companies/${companyId}/subscriptionPayments/${paymentId}`);
    if (uid) paths.push(`users/${uid}/subscriptionPayments/${paymentId}`);
    return paths;
}

async function persistSubscriptionPaymentRecord(record) {
    const updates = {};
    getSubscriptionPaymentPaths(record).forEach((path) => {
        updates[path] = record;
    });
    if (record && record.providerPaymentId) {
        updates[`subscriptionPaymentProviderIndex/${String(record.providerPaymentId)}`] = {
            paymentId: String(record.paymentId || ''),
            uid: String(record.uid || ''),
            companyId: String(record.companyId || ''),
            updatedAt: new Date().toISOString()
        };
    }
    await admin.database().ref().update(updates);
}

async function findSubscriptionPaymentRecordByProviderId(providerPaymentId) {
    const providerId = String(providerPaymentId || '').trim();
    if (!providerId) return null;
    const indexSnap = await admin.database().ref(`subscriptionPaymentProviderIndex/${providerId}`).get();
    if (indexSnap.exists()) {
        const indexData = indexSnap.val() || {};
        const paymentId = String(indexData.paymentId || '').trim();
        if (paymentId) {
            const paymentSnap = await admin.database().ref(`subscriptionPayments/${paymentId}`).get();
            if (paymentSnap.exists()) {
                return { paymentId, record: paymentSnap.val() || {} };
            }
        }
    }
    const querySnap = await admin.database()
        .ref('subscriptionPayments')
        .orderByChild('providerPaymentId')
        .equalTo(providerId)
        .limitToFirst(1)
        .get();
    if (!querySnap.exists()) return null;
    const map = querySnap.val() || {};
    const entries = Object.entries(map || {});
    if (!entries.length) return null;
    const first = entries[0];
    return { paymentId: String(first[0]), record: first[1] || {} };
}

async function appendAdminAudit(eventType, actorUid, payload) {
    const entry = {
        eventType: sanitizeText(eventType || 'UNKNOWN', 'UNKNOWN'),
        actorUid: sanitizeText(actorUid || ''),
        at: new Date().toISOString(),
        details: payload && typeof payload === 'object' ? payload : {}
    };
    await admin.database().ref('adminAudit').push(entry);
}

function computeSubscriptionEndDateByPlan(plan) {
    const now = new Date();
    const endDate = new Date(now);
    const key = String(plan || '').toLowerCase();
    if (key === 'premium') endDate.setFullYear(endDate.getFullYear() + 1);
    else if (key === 'quarterly' || key === 'annual') endDate.setMonth(endDate.getMonth() + 3);
    else endDate.setMonth(endDate.getMonth() + 1);
    return { startDateIso: now.toISOString(), endDateIso: endDate.toISOString() };
}

async function activateSubscriptionByAutoPix(record, providerPayment) {
    const uid = String(record && record.uid || '').trim();
    if (!uid) return { success: false, reason: 'uid_missing' };
    const paymentId = String(record && record.paymentId || '').trim();
    const userRef = admin.database().ref(`users/${uid}`);
    const userSnap = await userRef.get();
    const user = userSnap.exists() ? userSnap.val() : {};
    const plan = String(record.plan || 'monthly');
    const paidAmount = toMoney(record.amount || 0, 0);
    const period = computeSubscriptionEndDateByPlan(plan);
    const payments = Array.isArray(user && user.payments) ? user.payments.slice(0) : [];
    payments.push({
        date: new Date().toISOString(),
        amount: paidAmount,
        method: 'pix',
        status: 'approved',
        reference: paymentId || String(record.reference || ''),
        provider: 'mercado_pago',
        providerPaymentId: String(providerPayment && providerPayment.id || record.providerPaymentId || '')
    });
    const patch = {
        subscription: {
            ...(user && user.subscription && typeof user.subscription === 'object' ? user.subscription : {}),
            type: plan,
            startDate: period.startDateIso,
            endDate: period.endDateIso,
            active: true
        },
        payments,
        subscriptionStatus: 'active',
        accountStatus: 'active',
        statusReason: '',
        pendingPayment: null,
        trialStart: null,
        hasActiveSubscription: true,
        subscriptionStart: period.startDateIso,
        subscriptionEnd: period.endDateIso,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system:auto_pix'
    };
    await applyUserPatchAcrossScopes(uid, patch, { companyId: String(record.companyId || user.companyId || '').trim(), email: String(user && user.email || '').trim() });
    await pushUserNotification(uid, {
        type: 'success',
        title: 'Pagamento PIX confirmado',
        message: 'Seu pagamento foi confirmado automaticamente e sua assinatura está ativa.'
    });
    await appendSubscriptionAuditLog(uid, paymentId || `pix-${Date.now()}`, 'PIX_AUTO_CONFIRMED', 'system:auto_pix', {
        providerPaymentId: String(providerPayment && providerPayment.id || record.providerPaymentId || ''),
        amount: paidAmount,
        plan
    });
    await appendAdminAudit('PIX_AUTO_CONFIRMED', 'system:auto_pix', {
        uid,
        paymentId,
        providerPaymentId: String(providerPayment && providerPayment.id || record.providerPaymentId || ''),
        amount: paidAmount,
        plan
    });
    return { success: true };
}

async function syncMercadoPagoPayment(providerPayment, contextInfo = {}) {
    const providerPaymentId = String(providerPayment && providerPayment.id || '').trim();
    if (!providerPaymentId) throw new Error('providerPaymentId ausente.');
    const found = await findSubscriptionPaymentRecordByProviderId(providerPaymentId);
    if (!found || !found.paymentId) {
        throw new Error('Pagamento PIX não localizado no Sisweb.');
    }
    const current = found.record && typeof found.record === 'object' ? found.record : {};
    const statusMapped = mapMercadoPagoStatus(providerPayment.status);
    const nowIso = new Date().toISOString();
    const nextRecord = {
        ...current,
        paymentId: String(found.paymentId),
        provider: 'mercado_pago',
        providerPaymentId,
        providerStatus: String(providerPayment.status || ''),
        status: statusMapped,
        paidAmount: toMoney(providerPayment.transaction_amount || current.amount || 0, 0),
        dateApproved: sanitizeText(providerPayment.date_approved || current.dateApproved || ''),
        dateCreatedProvider: sanitizeText(providerPayment.date_created || current.dateCreatedProvider || ''),
        lastWebhookEventId: sanitizeText(contextInfo.eventId || current.lastWebhookEventId || ''),
        lastWebhookTopic: sanitizeText(contextInfo.topic || current.lastWebhookTopic || ''),
        updatedAt: nowIso
    };
    if (statusMapped === 'approved' && !nextRecord.confirmedAt) {
        nextRecord.confirmedAt = nowIso;
    }
    await persistSubscriptionPaymentRecord(nextRecord);
    if (statusMapped === 'approved' && !current.confirmedAt) {
        await activateSubscriptionByAutoPix(nextRecord, providerPayment);
    } else if (statusMapped === 'rejected') {
        const uid = String(nextRecord.uid || '').trim();
        if (uid) {
            await pushUserNotification(uid, {
                type: 'warning',
                title: 'Pagamento PIX não aprovado',
                message: 'Seu pagamento PIX não foi aprovado. Você pode reenviar ou usar o comprovante manual.'
            });
        }
        await appendSubscriptionAuditLog(uid || 'unknown', String(nextRecord.paymentId || `pix-${Date.now()}`), 'PIX_AUTO_REJECTED', 'system:auto_pix', {
            providerPaymentId,
            providerStatus: String(providerPayment.status || '')
        });
        await appendAdminAudit('PIX_AUTO_REJECTED', 'system:auto_pix', {
            uid: uid || '',
            paymentId: String(nextRecord.paymentId || ''),
            providerPaymentId,
            providerStatus: String(providerPayment.status || '')
        });
    }
    return nextRecord;
}

exports.createPixPayment = onCallV2({
    region: 'us-central1',
    secrets: [MERCADO_PAGO_ACCESS_TOKEN_SECRET, MERCADO_PAGO_WEBHOOK_TOKEN_SECRET, MERCADO_PAGO_WEBHOOK_URL_SECRET]
}, async (request) => {
    const data = request && typeof request.data === 'object' ? request.data : {};
    const context = request;
    if (!context || !context.auth || !context.auth.uid) {
        throw new HttpsErrorV2('unauthenticated', 'Apenas usuários autenticados podem criar cobrança PIX.');
    }
    const uid = context.auth.uid;
    const payload = data;
    const planInput = sanitizeText(payload.plan || payload.planKey || 'monthly', 'monthly');
    const settingsSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const settings = normalizeSubscriptionSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : {});
    const allowedMethods = getAllowedPaymentMethods(settings);
    if (!allowedMethods.includes('pix')) {
        throw new HttpsErrorV2('failed-precondition', 'Método PIX desabilitado pelo administrador.');
    }
    const userRef = admin.database().ref(`users/${uid}`);
    const userSnap = await userRef.get();
    const user = userSnap.exists() ? userSnap.val() : {};
    const email = String((user && user.email) || (context.auth.token && context.auth.token.email) || '').trim().toLowerCase();
    const companyId = await resolveCompanyIdForUser(uid, email, context.auth.token || {}, user || {});
    settings.__runtimeReferralCount = 0;
    settings.__runtimeHasReferral = false;
    settings.__runtimeIsNewClient = true;
    const pricing = resolvePricingFromSettings(planInput, settings);
    const idempotencyKey = sha256(`${uid}|${pricing.planKey}|${pricing.amount}|${Date.now()}|${Math.random().toString(36).slice(2, 10)}`);
    const externalReference = `${uid}:${pricing.planKey}:${Date.now()}`;
    const mpPayload = {
        transaction_amount: toMoney(pricing.amount, 0),
        description: `Assinatura Sisweb - ${pricing.planKey}`,
        payment_method_id: 'pix',
        payer: {
            email: email || `${uid}@sisweb.local`
        },
        external_reference: externalReference,
        metadata: {
            uid,
            companyId: String(companyId || ''),
            planKey: pricing.planKey
        }
    };
    const webhookUrl = getMercadoPagoWebhookUrl();
    const webhookToken = getMercadoPagoWebhookToken();
    if (webhookUrl) {
        if (webhookToken) {
            const separator = webhookUrl.includes('?') ? '&' : '?';
            mpPayload.notification_url = `${webhookUrl}${separator}token=${encodeURIComponent(webhookToken)}`;
        } else {
            mpPayload.notification_url = webhookUrl;
        }
    }
    const providerPayment = await mercadoPagoApiRequest('/v1/payments', {
        method: 'POST',
        body: mpPayload,
        idempotencyKey
    });
    const providerPaymentId = String(providerPayment && providerPayment.id || '').trim();
    if (!providerPaymentId) {
        throw new HttpsErrorV2('internal', 'Mercado Pago não retornou payment_id.');
    }
    const point = providerPayment && providerPayment.point_of_interaction ? providerPayment.point_of_interaction : {};
    const txData = point && point.transaction_data ? point.transaction_data : {};
    const paymentRef = admin.database().ref('subscriptionPayments').push();
    const paymentId = String(paymentRef.key || randomToken().slice(0, 20));
    const nowIso = new Date().toISOString();
    const record = {
        paymentId,
        uid,
        companyId: String(companyId || ''),
        plan: pricing.planKey,
        amount: toMoney(pricing.amount, 0),
        method: 'pix',
        provider: 'mercado_pago',
        providerPaymentId,
        providerStatus: String(providerPayment.status || ''),
        status: mapMercadoPagoStatus(providerPayment.status),
        idempotencyKey,
        reference: externalReference,
        qrCode: sanitizeLongText(txData.qr_code || '', '', 4096),
        qrCodeBase64: sanitizeLongText(txData.qr_code_base64 || '', '', 200000),
        ticketUrl: sanitizeLongText(txData.ticket_url || '', '', 2048),
        expiration: sanitizeText(providerPayment.date_of_expiration || ''),
        createdAt: nowIso,
        updatedAt: nowIso
    };
    await persistSubscriptionPaymentRecord(record);
    await appendSubscriptionAuditLog(uid, paymentId, 'PIX_PAYMENT_CREATED', uid, {
        amount: record.amount,
        plan: record.plan,
        providerPaymentId
    });
    await appendAdminAudit('PIX_PAYMENT_CREATED', uid, {
        uid,
        companyId: String(companyId || ''),
        paymentId,
        providerPaymentId,
        amount: record.amount,
        plan: record.plan
    });
    return {
        success: true,
        payment: {
            paymentId,
            providerPaymentId,
            qr_code: record.qrCode,
            qr_code_base64: record.qrCodeBase64,
            expiration: record.expiration,
            status: record.status,
            amount: record.amount,
            plan: record.plan
        }
    };
});

exports.revalidatePixPayment = onCallV2({
    region: 'us-central1',
    secrets: [MERCADO_PAGO_ACCESS_TOKEN_SECRET]
}, async (request) => {
    const data = request && typeof request.data === 'object' ? request.data : {};
    const context = request;
    if (!context || !context.auth || !context.auth.uid) {
        throw new HttpsErrorV2('unauthenticated', 'Apenas usuários autenticados podem revalidar PIX.');
    }
    const uid = context.auth.uid;
    const payload = data;
    const paymentId = sanitizeText(payload.paymentId || '');
    const providerPaymentIdInput = sanitizeText(payload.providerPaymentId || '');
    if (!paymentId && !providerPaymentIdInput) {
        throw new HttpsErrorV2('invalid-argument', 'paymentId ou providerPaymentId é obrigatório.');
    }
    let record = null;
    if (paymentId) {
        const snap = await admin.database().ref(`subscriptionPayments/${paymentId}`).get();
        if (!snap.exists()) {
            throw new HttpsErrorV2('not-found', 'Pagamento não encontrado.');
        }
        record = snap.val() || {};
        if (String(record.uid || '') !== uid && !(await isCallerSuperAdmin(context))) {
            throw new HttpsErrorV2('permission-denied', 'Sem permissão para revalidar este pagamento.');
        }
    } else {
        const found = await findSubscriptionPaymentRecordByProviderId(providerPaymentIdInput);
        if (!found) {
            throw new HttpsErrorV2('not-found', 'Pagamento não encontrado.');
        }
        record = { ...(found.record || {}), paymentId: found.paymentId };
        if (String(record.uid || '') !== uid && !(await isCallerSuperAdmin(context))) {
            throw new HttpsErrorV2('permission-denied', 'Sem permissão para revalidar este pagamento.');
        }
    }
    const providerPaymentId = String(record.providerPaymentId || providerPaymentIdInput || '').trim();
    if (!providerPaymentId) {
        throw new HttpsErrorV2('failed-precondition', 'Pagamento sem providerPaymentId.');
    }
    const providerPayment = await mercadoPagoApiRequest(`/v1/payments/${providerPaymentId}`);
    const synced = await syncMercadoPagoPayment(providerPayment, {
        topic: 'manual_revalidate',
        eventId: `manual_${Date.now()}_${uid}`
    });
    return {
        success: true,
        payment: {
            paymentId: String(synced.paymentId || ''),
            providerPaymentId: String(synced.providerPaymentId || ''),
            status: String(synced.status || ''),
            providerStatus: String(synced.providerStatus || ''),
            confirmedAt: synced.confirmedAt || ''
        }
    };
});

exports.mercadoPagoWebhook = onRequestV2({
    region: 'us-central1',
    secrets: [MERCADO_PAGO_ACCESS_TOKEN_SECRET, MERCADO_PAGO_WEBHOOK_TOKEN_SECRET]
}, async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-signature, x-request-id');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'method_not_allowed' });
        return;
    }
    const requiredWebhookToken = getMercadoPagoWebhookToken();
    if (requiredWebhookToken) {
        const incomingToken = String((req.query && req.query.token) || '').trim();
        if (!incomingToken || incomingToken !== requiredWebhookToken) {
            res.status(401).json({ success: false, error: 'invalid_webhook_token' });
            return;
        }
    }
    try {
        const query = req.query && typeof req.query === 'object' ? req.query : {};
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const topic = String(query.topic || query.type || body.topic || body.type || '').trim().toLowerCase();
        const eventIdBase = String(req.get('x-request-id') || body.id || query.id || '').trim();
        const dataObj = body.data && typeof body.data === 'object' ? body.data : {};
        const providerPaymentId = String(dataObj.id || query['data.id'] || query.resource_id || '').trim();
        if (!providerPaymentId) {
            res.status(202).json({ success: true, ignored: true, reason: 'no_payment_id' });
            return;
        }
        const eventKey = sha256(`${eventIdBase}|${topic}|${providerPaymentId}`);
        const eventRef = admin.database().ref(`subscriptionWebhookEvents/${eventKey}`);
        const txResult = await eventRef.transaction((current) => {
            if (current && current.processedAt) return current;
            if (current && current.processing === true) return current;
            return {
                processing: true,
                createdAt: new Date().toISOString(),
                topic,
                providerPaymentId,
                rawEventId: eventIdBase || ''
            };
        }, { applyLocally: false });
        const currentVal = txResult && txResult.snapshot ? txResult.snapshot.val() : null;
        if (!txResult.committed || (currentVal && currentVal.processedAt)) {
            res.status(200).json({ success: true, duplicate: true });
            return;
        }
        const providerPayment = await mercadoPagoApiRequest(`/v1/payments/${providerPaymentId}`);
        const synced = await syncMercadoPagoPayment(providerPayment, {
            topic: topic || 'payment',
            eventId: eventKey
        });
        await eventRef.update({
            processing: false,
            processedAt: new Date().toISOString(),
            status: 'processed',
            syncedPaymentId: String(synced && synced.paymentId || '')
        });
        res.status(200).json({ success: true });
    } catch (error) {
        try {
            const query = req.query && typeof req.query === 'object' ? req.query : {};
            const body = req.body && typeof req.body === 'object' ? req.body : {};
            const topic = String(query.topic || query.type || body.topic || body.type || '').trim().toLowerCase();
            const eventIdBase = String(req.get('x-request-id') || body.id || query.id || '').trim();
            const dataObj = body.data && typeof body.data === 'object' ? body.data : {};
            const providerPaymentId = String(dataObj.id || query['data.id'] || query.resource_id || '').trim();
            if (providerPaymentId) {
                const eventKey = sha256(`${eventIdBase}|${topic}|${providerPaymentId}`);
                await admin.database().ref(`subscriptionWebhookEvents/${eventKey}`).update({
                    processing: false,
                    processedAt: new Date().toISOString(),
                    status: 'error',
                    error: String(error && error.message ? error.message : error || 'unknown')
                });
            }
        } catch (_) {}
        res.status(500).json({ success: false, error: String(error && error.message ? error.message : error || 'internal_error') });
    }
});
