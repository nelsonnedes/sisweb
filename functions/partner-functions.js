'use strict';

/**
 * partner-functions.js — Programa de Parceiros Sisweb (campanhas por indicação).
 *
 * Princípio: comissão nasce SOMENTE no ramo approve de pagamento real.
 * O motor legado por e-mail (confirmSubscriptionApproval) permanece intacto;
 * este módulo adiciona o caminho por Código de Parceiro (PAR-XXXX) de forma
 * aditiva. Nenhum write direto do client: tudo via callables + Admin SDK.
 *
 * Nós RTDB (regras: superadmin; partnerReminders com leitura de membro):
 * - campaignPartners/{partnerId}
 * - campaignPartnerCodes/{code} -> {partnerId}
 * - campaignReferrals/{referredUid}
 * - campaignCommissions/{partnerId}/{entryId}
 * - companies/{companyId}/partnerReminders/{reminderId}
 * - partnerSignupAttempts/{hash} (rate-limit, backend only)
 * - campaignReminderLog/{partnerId}/{companyId} (rate-limit 24h)
 */

// IMPORTANTE: usar o namespace v1 — no firebase-functions v7 o
// `require('firebase-functions').https.onCall` é o onCall v2 (handler recebe
// o envelope {data,...} e `payload.name` chegaria sempre vazio). O padrão v1
// (data, context) é o mesmo das demais callables do index.js.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const crypto = require('crypto');

let isCallerSuperAdminFn = null;
function configure(deps) {
    if (deps && typeof deps.isCallerSuperAdmin === 'function') {
        isCallerSuperAdminFn = deps.isCallerSuperAdmin;
    }
}

async function assertSuperAdminCall(request) {
    if (typeof isCallerSuperAdminFn !== 'function') {
        throw new functions.https.HttpsError('failed-precondition', 'Parceiros: módulo não configurado no bootstrap.');
    }
    if (!(await isCallerSuperAdminFn(request))) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas SuperAdmin pode acessar o programa de parceiros.');
    }
}

// ─── Helpers puros (exportados para testes) ────────────────────────────────

function normalizePartnerCode(value) {
    return String(value == null ? '' : value).trim().toUpperCase().replace(/\s+/g, '');
}

function isValidPartnerCode(value) {
    return /^PAR-[A-Z0-9]{4,8}$/.test(normalizePartnerCode(value));
}

function generatePartnerCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 4; i += 1) {
        suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `PAR-${suffix}`;
}

function clampCommissionPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (n < 0 || n > 40) return null;
    return Math.round(n * 100) / 100;
}

function computeCommission(paidAmount, percent) {
    const amount = Number(paidAmount) || 0;
    const pct = Number(percent) || 0;
    if (amount <= 0 || pct <= 0) return 0;
    return Math.round(amount * (pct / 100) * 100) / 100;
}

function sanitizeStr(value, maxLength) {
    return String(value == null ? '' : value).trim().slice(0, maxLength);
}

function sanitizeEmail(value) {
    return sanitizeStr(value, 180).toLowerCase();
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function sanitizeEntryId(value) {
    return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) || 'entry';
}

// ─── Leituras internas ─────────────────────────────────────────────────────

async function readPartnerById(partnerId) {
    const id = sanitizeStr(partnerId, 128);
    if (!id) return null;
    const snap = await admin.database().ref(`campaignPartners/${id}`).get();
    if (!snap.exists()) return null;
    const val = snap.val() || {};
    return { id, ...val };
}

async function resolvePartnerByCode(code) {
    const normalized = normalizePartnerCode(code);
    if (!isValidPartnerCode(normalized)) return null;
    const idxSnap = await admin.database().ref(`campaignPartnerCodes/${normalized}`).get();
    if (!idxSnap.exists()) return null;
    const partnerId = idxSnap.val() && idxSnap.val().partnerId ? String(idxSnap.val().partnerId) : '';
    if (!partnerId) return null;
    return readPartnerById(partnerId);
}

async function readReferral(referredUid) {
    const uid = sanitizeStr(referredUid, 128);
    if (!uid) return null;
    const snap = await admin.database().ref(`campaignReferrals/${uid}`).get();
    return snap.exists() ? snap.val() : null;
}

async function resolvePartnerLink({ requestPartnerId, referredUid }) {
    if (requestPartnerId) {
        const p = await readPartnerById(requestPartnerId);
        if (p && p.status === 'active') return { partnerId: p.id, code: p.code || '' };
    }
    if (referredUid) {
        const ref = await readReferral(referredUid);
        if (ref && ref.partnerId) {
            const p = await readPartnerById(ref.partnerId);
            if (p && p.status === 'active') return { partnerId: p.id, code: ref.code || p.code || '' };
        }
    }
    return null;
}

// ─── 1) Registro público de parceiro ───────────────────────────────────────

exports.registerPartner = functions.https.onCall(async (data, context) => {
    const payload = data && typeof data === 'object' ? data : {};
    const name = sanitizeStr(payload.name, 120);
    const email = sanitizeEmail(payload.email);
    const phone = sanitizeStr(payload.phone, 40);
    const city = sanitizeStr(payload.city, 120);
    const atuacao = sanitizeStr(payload.atuacao, 60);
    if (name.length < 3) {
        throw new functions.https.HttpsError('invalid-argument', 'Informe seu nome completo.');
    }
    if (!isValidEmail(email)) {
        throw new functions.https.HttpsError('invalid-argument', 'Informe um e-mail válido.');
    }
    if (sanitizeStr(phone.replace(/\D/g, ''), 20).length < 8) {
        throw new functions.https.HttpsError('invalid-argument', 'Informe um telefone/WhatsApp válido.');
    }

    // Rate-limit simples por IP (backend only, 8 tentativas/hora)
    try {
        const rawIp = (context && context.rawRequest && (context.rawRequest.ip ||
            (context.rawRequest.headers && (context.rawRequest.headers['x-forwarded-for'] || '')))) || 'unknown';
        const ipHash = crypto.createHash('sha256').update(String(rawIp).split(',')[0].trim()).digest('hex').slice(0, 32);
        const rlRef = admin.database().ref(`partnerSignupAttempts/${ipHash}`);
        const rlSnap = await rlRef.get();
        const now = Date.now();
        const rl = rlSnap.exists() ? (rlSnap.val() || {}) : {};
        if (rl.windowStart && (now - Number(rl.windowStart)) < 3600000 && Number(rl.count || 0) >= 8) {
            throw new functions.https.HttpsError('resource-exhausted', 'Muitas tentativas. Aguarde uma hora e tente novamente.');
        }
        const fresh = rl.windowStart && (now - Number(rl.windowStart)) < 3600000;
        await rlRef.set({ count: fresh ? Number(rl.count || 0) + 1 : 1, windowStart: fresh ? rl.windowStart : now });
    } catch (e) {
        if (e instanceof functions.https.HttpsError) throw e;
    }

    // Dedupe por e-mail: devolve o código existente (idempotente)
    const partnersSnap = await admin.database().ref('campaignPartners').get();
    const partners = partnersSnap.exists() ? partnersSnap.val() : {};
    for (const [pid, p] of Object.entries(partners || {})) {
        if (p && String(p.email || '').toLowerCase() === email) {
            return { success: true, already: true, partnerId: pid, code: p.code || '' };
        }
    }

    // Gera código único com retry
    let code = '';
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = generatePartnerCode();
        const exists = await admin.database().ref(`campaignPartnerCodes/${candidate}`).get();
        if (!exists.exists()) { code = candidate; break; }
    }
    if (!code) {
        throw new functions.https.HttpsError('internal', 'Não foi possível gerar o código agora. Tente novamente.');
    }

    const ref = admin.database().ref('campaignPartners').push();
    const nowIso = new Date().toISOString();
    const record = {
        id: ref.key,
        code,
        name,
        email,
        phone,
        city,
        atuacao,
        status: 'active',
        commissionPercent: null,
        ownerUid: null,
        createdAt: nowIso,
        createdBy: 'self',
        totalEarned: 0,
        totalPaid: 0
    };
    await ref.set(record);
    await admin.database().ref(`campaignPartnerCodes/${code}`).set({ partnerId: ref.key, createdAt: nowIso });
    return { success: true, already: false, partnerId: ref.key, code };
});

// ─── 2) Validação de código (autenticada, sem PII) ──────────────────────────

exports.validatePartnerCode = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Faça login para validar o código.');
    }
    const code = normalizePartnerCode(data && data.code);
    if (!isValidPartnerCode(code)) return { success: true, valid: false };
    const partner = await resolvePartnerByCode(code);
    if (!partner || partner.status !== 'active') return { success: true, valid: false };
    const firstName = String(partner.name || '').trim().split(/\s+/)[0] || 'Parceiro Sisweb';
    return { success: true, valid: true, partnerName: firstName };
});

// ─── 3) Vincular indicação (autenticada, idempotente, anti-autoindicação) ───

exports.linkPartnerReferral = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Faça login para vincular a indicação.');
    }
    const uid = String(context.auth.uid);
    const code = normalizePartnerCode(data && data.code);
    if (!isValidPartnerCode(code)) {
        throw new functions.https.HttpsError('invalid-argument', 'Código de parceiro inválido. Use o formato PAR-XXXX.');
    }
    const partner = await resolvePartnerByCode(code);
    if (!partner || partner.status !== 'active') {
        throw new functions.https.HttpsError('not-found', 'Código de parceiro não encontrado ou inativo.');
    }
    const existing = await readReferral(uid);
    if (existing && existing.partnerId) {
        return { success: true, already: true, partnerId: existing.partnerId, code: existing.code || '' };
    }
    const tokenEmail = String((context.auth.token && context.auth.token.email) || '').toLowerCase();
    if (partner.ownerUid && partner.ownerUid === uid) {
        throw new functions.https.HttpsError('failed-precondition', 'Você não pode indicar a si mesmo.');
    }
    if (tokenEmail && partner.email && tokenEmail === String(partner.email).toLowerCase()) {
        throw new functions.https.HttpsError('failed-precondition', 'Você não pode indicar a si mesmo.');
    }
    let companyId = '';
    try {
        const userSnap = await admin.database().ref(`users/${uid}`).get();
        const userData = userSnap.exists() ? userSnap.val() : {};
        companyId = String(userData.companyId || userData.companyID || '');
        const userEmail = String(userData.email || tokenEmail).toLowerCase();
        if (userEmail && partner.email && userEmail === String(partner.email).toLowerCase()) {
            throw new functions.https.HttpsError('failed-precondition', 'Você não pode indicar a si mesmo.');
        }
    } catch (e) {
        if (e instanceof functions.https.HttpsError) throw e;
    }
    const record = {
        partnerId: partner.id,
        code,
        at: new Date().toISOString(),
        source: 'register',
        companyId: companyId || null
    };
    await admin.database().ref(`campaignReferrals/${uid}`).set(record);
    return { success: true, already: false, partnerId: partner.id, code };
});

// Cria vínculo sem sobrescrever (usado pelo fluxo de assinatura)
async function ensureReferral({ uid, partnerId, code, source, companyId }) {
    if (!uid || !partnerId) return { created: false };
    const existing = await readReferral(uid);
    if (existing && existing.partnerId) return { created: false, partnerId: existing.partnerId };
    await admin.database().ref(`campaignReferrals/${uid}`).set({
        partnerId,
        code: code || '',
        at: new Date().toISOString(),
        source: source || 'subscription',
        companyId: companyId || null
    });
    return { created: true, partnerId };
}

// ─── Comissão sobre pagamento real (chamado no ramo approve) ────────────────

async function recordPartnerCommissionEarned({ partnerId, referredUid, companyId, requestId, paidAmount, approverUid, campaignSettings }) {
    const pid = sanitizeStr(partnerId, 128);
    if (!pid) return { created: false };
    const partner = await readPartnerById(pid);
    if (!partner || partner.status !== 'active') return { created: false, reason: 'partner-inactive' };
    const entryId = sanitizeEntryId(requestId);
    const entryRef = admin.database().ref(`campaignCommissions/${pid}/${entryId}`);
    const existing = await entryRef.get();
    if (existing.exists()) return { created: false, reason: 'already-recorded' };
    const campaign = (campaignSettings && campaignSettings.campaign) || {};
    const referralCfg = campaign.referral || {};
    const defaultPct = Number(referralCfg.commissionPercentForReferrer || 0);
    const pct = partner.commissionPercent !== null && partner.commissionPercent !== undefined && partner.commissionPercent !== ''
        ? Number(partner.commissionPercent)
        : defaultPct;
    if (!(pct > 0)) return { created: false, reason: 'percent-zero' };
    const commission = computeCommission(paidAmount, pct);
    const nowIso = new Date().toISOString();
    await entryRef.set({
        referredUid: String(referredUid || ''),
        companyId: String(companyId || ''),
        requestId: String(requestId || ''),
        paidAmount: Number(paidAmount) || 0,
        percent: pct,
        commission,
        status: 'earned',
        at: nowIso,
        paidAt: null,
        paidBy: null,
        note: ''
    });
    const totalsSnap = await admin.database().ref(`campaignPartners/${pid}/totalEarned`).get();
    const current = Number(totalsSnap.val() || 0);
    await admin.database().ref(`campaignPartners/${pid}`).update({
        totalEarned: Math.round((current + commission) * 100) / 100,
        updatedAt: nowIso,
        updatedBy: approverUid || ''
    });
    return { created: true, commission, percent: pct, ownerUid: partner.ownerUid || null, partnerName: partner.name || '' };
}

// ─── Projeções das 3 próximas comissões (somente leitura; nunca cria comissão)

const PARTNER_SETTINGS_PATH = 'system/subscriptionSettings';

function planPeriodMonths(planKey) {
    const k = String(planKey || '').toLowerCase();
    if (k === 'quarterly' || k === 'annual') return 3;
    if (k === 'premium') return 12;
    return 1;
}

function planAmountFromSettings(settings, planKey) {
    const plans = (settings && settings.plans) || {};
    const pick = (obj, fb) => {
        const n = Number(obj && obj.amount);
        return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : fb;
    };
    const monthly = pick(plans.monthly, 0);
    const k = String(planKey || '').toLowerCase();
    if (k === 'quarterly' || k === 'annual') {
        const v = pick(plans.quarterly, 0);
        return { amount: v || monthly, plan: 'quarterly', assumed: !v && !!monthly };
    }
    if (k === 'premium') {
        return { amount: pick(plans.premium, 0), plan: 'premium', assumed: false };
    }
    if (k === 'monthly') return { amount: monthly, plan: 'monthly', assumed: false };
    return { amount: monthly, plan: 'monthly', assumed: true };
}

function resolveEffectivePercent(partner, campaignSettings) {
    if (partner && partner.commissionPercent !== null && partner.commissionPercent !== undefined && partner.commissionPercent !== '') {
        const p = Number(partner.commissionPercent);
        if (Number.isFinite(p) && p > 0) return p;
    }
    const referralCfg = (campaignSettings && campaignSettings.campaign && campaignSettings.campaign.referral) || {};
    const d = Number(referralCfg.commissionPercentForReferrer || 0);
    return Number.isFinite(d) && d > 0 ? d : 0;
}

async function readPartnerPricing() {
    try {
        const snap = await admin.database().ref(PARTNER_SETTINGS_PATH).get();
        return snap.exists() ? snap.val() : {};
    } catch (_) {
        return {};
    }
}

function buildProjections({ planKey, endDateIso, settings, percent }) {
    const pct = Number(percent) || 0;
    if (!(pct > 0)) return [];
    const priced = planAmountFromSettings(settings, planKey);
    if (!(priced.amount > 0)) return [];
    const months = planPeriodMonths(priced.plan);
    let base = endDateIso ? new Date(endDateIso) : null;
    if (!base || Number.isNaN(base.getTime())) base = new Date();
    const out = [];
    for (let i = 0; i < 3; i += 1) {
        const due = new Date(base.getTime());
        if (i > 0) due.setMonth(due.getMonth() + (i * months));
        out.push({
            n: i + 1,
            plan: priced.plan,
            assumedPlan: priced.assumed,
            dueDate: due.toISOString(),
            amount: priced.amount,
            percent: pct,
            commission: computeCommission(priced.amount, pct),
            projected: true
        });
    }
    return out;
}

async function attachProjections(companies, partner, settings) {
    const list = Array.isArray(companies) ? companies : [];
    const pct = resolveEffectivePercent(partner, settings);
    let projectedTotal = 0;
    list.forEach((c) => {
        const projs = buildProjections({
            planKey: (c && (c.planKey || c.plan)) || '',
            endDateIso: (c && (c.endDate || c.subscriptionEndDate)) || '',
            settings,
            percent: pct
        });
        c.projections = projs;
        projs.forEach((p) => {
            projectedTotal = Math.round((projectedTotal + Number(p.commission || 0)) * 100) / 100;
        });
    });
    return { companies: list, projectedTotal: Math.round(projectedTotal * 100) / 100 };
}

// ─── 4) Dashboard do parceiro (somente dados próprios) ──────────────────────

function isOverdueUser(userData) {
    const u = userData || {};
    const status = String(u.subscriptionStatus || u.status || '').toLowerCase();
    if (status === 'expired' || status === 'blocked') return true;
    const endRaw = (u.subscription && u.subscription.endDate) || u.subscriptionEndDate || u.subscriptionEnd || '';
    if (endRaw) {
        const end = new Date(endRaw);
        if (!Number.isNaN(end.getTime()) && end.getTime() < Date.now()) return true;
    }
    return false;
}

async function findPartnerForCaller(auth) {
    const uid = String(auth.uid);
    const email = String((auth.token && auth.token.email) || '').toLowerCase();
    const snap = await admin.database().ref('campaignPartners').get();
    const partners = snap.exists() ? snap.val() : {};
    for (const [pid, p] of Object.entries(partners || {})) {
        if (!p) continue;
        if (p.ownerUid && String(p.ownerUid) === uid) return { id: pid, ...p };
    }
    if (email) {
        for (const [pid, p] of Object.entries(partners || {})) {
            if (p && String(p.email || '').toLowerCase() === email) {
                // Adota ownerUid no primeiro acesso autenticado com o mesmo e-mail
                try {
                    await admin.database().ref(`campaignPartners/${pid}`).update({ ownerUid: uid, updatedAt: new Date().toISOString() });
                } catch (_) {}
                return { id: pid, ...p, ownerUid: uid };
            }
        }
    }
    return null;
}

exports.getMyPartnerDashboard = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Faça login para ver seu painel de parceiro.');
    }
    const partner = await findPartnerForCaller(context.auth);
    if (!partner) {
        return { success: false, error: 'not-a-partner' };
    }
    const refsSnap = await admin.database().ref('campaignReferrals').get();
    const refs = refsSnap.exists() ? refsSnap.val() : {};
    const mine = Object.entries(refs || {}).filter(([, r]) => r && r.partnerId === partner.id);
    const companies = [];
    let activeCount = 0;
    let revenue = 0;
    for (const [referredUid, r] of mine) {
        let userData = {};
        try {
            const us = await admin.database().ref(`users/${referredUid}`).get();
            userData = us.exists() ? us.val() : {};
        } catch (_) {}
        const companyId = String(r.companyId || userData.companyId || userData.companyID || '');
        let companyName = '';
        if (companyId) {
            try {
                const ps = await admin.database().ref(`companies/${companyId}/profile`).get();
                const prof = ps.exists() ? ps.val() : {};
                companyName = String(prof.name || prof.nome || prof.razaoSocial || '');
            } catch (_) {}
        }
        const payments = Array.isArray(userData.payments) ? userData.payments : [];
        const lastPayment = payments.length ? payments[payments.length - 1] : null;
        const plan = (userData.subscription && userData.subscription.type) || userData.currentPlan || userData.plan || '';
        const endDate = (userData.subscription && userData.subscription.endDate) || userData.subscriptionEndDate || '';
        const status = String(userData.subscriptionStatus || userData.status || 'unknown');
        const overdue = isOverdueUser(userData);
        if (!overdue && (status === 'active' || status === 'trial_active')) activeCount += 1;
        const totalPaid = Number((userData.campaignLedger && userData.campaignLedger.totalPaid) || 0);
        revenue = Math.round((revenue + totalPaid) * 100) / 100;
        companies.push({
            referredUid,
            companyId: companyId || null,
            companyName: companyName || null,
            userName: String(userData.username || userData.displayName || userData.name || ''),
            userEmail: String(userData.email || ''),
            status,
            plan: String(plan || ''),
            endDate: endDate || null,
            lastPayment: lastPayment ? { date: lastPayment.date || '', amount: Number(lastPayment.amount || 0), status: String(lastPayment.status || '') } : null,
            overdue,
            linkedAt: r.at || ''
        });
    }
    companies.sort((a, b) => String(b.linkedAt || '').localeCompare(String(a.linkedAt || '')));
    const commSnap = await admin.database().ref(`campaignCommissions/${partner.id}`).orderByKey().limitToLast(100).get();
    const commRaw = commSnap.exists() ? commSnap.val() : {};
    const commissions = Object.entries(commRaw || {}).map(([entryId, c]) => ({ entryId, ...(c || {}) }))
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    let earned = 0;
    let paid = 0;
    commissions.forEach((c) => {
        if (c.status === 'paid') paid += Number(c.commission || 0);
        else if (c.status === 'earned') earned += Number(c.commission || 0);
    });
    earned = Math.round(earned * 100) / 100;
    paid = Math.round(paid * 100) / 100;
    const pricingSettings = await readPartnerPricing();
    const enriched = await attachProjections(companies, partner, pricingSettings);
    return {
        success: true,
        partner: {
            id: partner.id,
            code: partner.code || '',
            name: partner.name || '',
            email: partner.email || '',
            status: partner.status || 'active',
            commissionPercent: partner.commissionPercent !== undefined ? partner.commissionPercent : null
        },
        stats: {
            linked: companies.length,
            active: activeCount,
            revenue,
            earned,
            paid,
            pending: earned,
            projected: enriched.projectedTotal
        },
        companies: enriched.companies,
        commissions: commissions.slice(0, 100),
        projectedTotal: enriched.projectedTotal
    };
});

// ─── 5) Alerta de cobrança (parceiro → empresa inadimplente, sem vazamento) ─

exports.sendBillingReminder = functions.https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Faça login como parceiro.');
    }
    const payload = data && typeof data === 'object' ? data : {};
    const companyId = sanitizeStr(payload.companyId, 128);
    const customMessage = sanitizeStr(payload.message, 280);
    if (!companyId) {
        throw new functions.https.HttpsError('invalid-argument', 'companyId é obrigatório.');
    }
    const partner = await findPartnerForCaller(context.auth);
    if (!partner) {
        throw new functions.https.HttpsError('failed-precondition', 'Conta sem parceiro vinculado.');
    }
    // Verifica vínculo real parceiro ↔ empresa
    const refsSnap = await admin.database().ref('campaignReferrals').get();
    const refs = refsSnap.exists() ? refsSnap.val() : {};
    let linkedUid = '';
    let linkedAt = '';
    for (const [referredUid, r] of Object.entries(refs || {})) {
        if (r && r.partnerId === partner.id && String(r.companyId || '') === companyId) {
            linkedUid = referredUid;
            linkedAt = r.at || '';
            break;
        }
    }
    if (!linkedUid) {
        // Fallback: empresa atual do indicado
        for (const [referredUid, r] of Object.entries(refs || {})) {
            if (!(r && r.partnerId === partner.id)) continue;
            try {
                const us = await admin.database().ref(`users/${referredUid}`).get();
                const ud = us.exists() ? us.val() : {};
                if (String(ud.companyId || ud.companyID || '') === companyId) {
                    linkedUid = referredUid;
                    linkedAt = r.at || '';
                    break;
                }
            } catch (_) {}
        }
    }
    if (!linkedUid) {
        throw new functions.https.HttpsError('failed-precondition', 'Esta empresa não está vinculada ao seu código de parceiro.');
    }
    // Verifica inadimplência real (nada de cobrança para conta ativa em dia)
    let companyName = '';
    try {
        const ps = await admin.database().ref(`companies/${companyId}/profile`).get();
        const prof = ps.exists() ? ps.val() : {};
        companyName = String(prof.name || prof.nome || prof.razaoSocial || '');
    } catch (_) {}
    const memberUids = new Set([linkedUid]);
    try {
        const cu = await admin.database().ref(`companies/${companyId}/users`).get();
        if (cu.exists()) Object.keys(cu.val() || {}).forEach((u) => memberUids.add(String(u)));
    } catch (_) {}
    let anyOverdue = false;
    const memberList = [...memberUids];
    for (const muid of memberList) {
        try {
            const us = await admin.database().ref(`users/${muid}`).get();
            if (us.exists() && isOverdueUser(us.val() || {})) { anyOverdue = true; break; }
        } catch (_) {}
    }
    if (!anyOverdue) {
        throw new functions.https.HttpsError('failed-precondition', 'Esta empresa está com a assinatura em dia. Nenhum alerta necessário.');
    }
    // Rate-limit: 1 lembrete/24h por empresa
    const logRef = admin.database().ref(`campaignReminderLog/${partner.id}/${companyId}`);
    try {
        const logSnap = await logRef.get();
        if (logSnap.exists()) {
            const last = logSnap.val() || {};
            const lastAt = new Date(last.lastSentAt || 0).getTime();
            if (lastAt && (Date.now() - lastAt) < 24 * 3600 * 1000) {
                throw new functions.https.HttpsError('resource-exhausted', 'Alerta já enviado nas últimas 24h para esta empresa.');
            }
        }
    } catch (e) {
        if (e instanceof functions.https.HttpsError) throw e;
    }
    const nowIso = new Date().toISOString();
    const title = 'Cobrança do parceiro';
    const message = `O parceiro ${partner.name || 'Sisweb'} informa que sua mensalidade Sisweb está em atraso.${customMessage ? ' Recado: ' + customMessage : ''} Regularize em Minha Assinatura para evitar bloqueio.`;
    const reminder = {
        partnerId: partner.id,
        partnerName: String(partner.name || 'Parceiro Sisweb'),
        kind: 'billing_reminder',
        title,
        message: message.slice(0, 500),
        createdAt: nowIso,
        read: false
    };
    const remRef = admin.database().ref(`companies/${companyId}/partnerReminders`).push();
    await remRef.set(reminder);
    // Sininho de cada usuário da empresa (somente dados da própria empresa)
    for (const muid of memberList) {
        try {
            await admin.database().ref(`users/${muid}/notifications`).push({
                title,
                message: reminder.message,
                type: 'warning',
                read: false,
                createdAt: nowIso,
                source: 'partner_billing'
            });
        } catch (_) {}
    }
    try {
        const prev = (await logRef.get()).val() || {};
        await logRef.set({ lastSentAt: nowIso, count: Number(prev.count || 0) + 1, by: String(context.auth.uid) });
    } catch (_) {}
    return { success: true, reminderId: remRef.key, notifiedUsers: memberList.length };
});

// ─── 6/7/8/9) Admin (superadmin) ────────────────────────────────────────────

exports.getPartnersAdmin = functions.https.onCall(async (data, context) => {
    await assertSuperAdminCall(context);
    const partnersSnap = await admin.database().ref('campaignPartners').orderByKey().limitToLast(500).get();
    const partners = partnersSnap.exists() ? partnersSnap.val() : {};
    const refsSnap = await admin.database().ref('campaignReferrals').get();
    const refs = refsSnap.exists() ? refsSnap.val() : {};
    const byPartner = {};
    Object.entries(refs || {}).forEach(([referredUid, r]) => {
        if (!r || !r.partnerId) return;
        byPartner[r.partnerId] = byPartner[r.partnerId] || [];
        byPartner[r.partnerId].push({ referredUid, ...(r || {}) });
    });
    const out = [];
    for (const [pid, p] of Object.entries(partners || {})) {
        const list = byPartner[pid] || [];
        let active = 0;
        let revenue = 0;
        for (const r of list) {
            try {
                const us = await admin.database().ref(`users/${r.referredUid}`).get();
                const ud = us.exists() ? us.val() : {};
                const st = String(ud.subscriptionStatus || ud.status || '');
                if (!isOverdueUser(ud) && (st === 'active' || st === 'trial_active')) active += 1;
                revenue = Math.round((revenue + Number((ud.campaignLedger && ud.campaignLedger.totalPaid) || 0)) * 100) / 100;
            } catch (_) {}
        }
        let earned = 0;
        let paid = 0;
        try {
            const cs = await admin.database().ref(`campaignCommissions/${pid}`).get();
            Object.values(cs.exists() ? cs.val() : {}).forEach((c) => {
                if (!c) return;
                if (c.status === 'paid') paid += Number(c.commission || 0);
                else if (c.status === 'earned') earned += Number(c.commission || 0);
            });
            earned = Math.round(earned * 100) / 100;
            paid = Math.round(paid * 100) / 100;
        } catch (_) {}
        out.push({
            id: pid,
            code: p.code || '',
            name: p.name || '',
            email: p.email || '',
            phone: p.phone || '',
            city: p.city || '',
            atuacao: p.atuacao || '',
            status: p.status || 'active',
            commissionPercent: p.commissionPercent !== undefined ? p.commissionPercent : null,
            createdAt: p.createdAt || '',
            linked: list.length,
            active,
            revenue,
            earned,
            paid,
            pending: earned
        });
    }
    out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return { success: true, partners: out };
});

exports.getPartnerDetailAdmin = functions.https.onCall(async (data, context) => {
    await assertSuperAdminCall(context);
    const partnerId = sanitizeStr(data && data.partnerId, 128);
    const partner = await readPartnerById(partnerId);
    if (!partner) {
        throw new functions.https.HttpsError('not-found', 'Parceiro não encontrado.');
    }
    const refsSnap = await admin.database().ref('campaignReferrals').get();
    const refs = refsSnap.exists() ? refsSnap.val() : {};
    const companies = [];
    for (const [referredUid, r] of Object.entries(refs || {})) {
        if (!r || r.partnerId !== partner.id) continue;
        let userData = {};
        try {
            const us = await admin.database().ref(`users/${referredUid}`).get();
            userData = us.exists() ? us.val() : {};
        } catch (_) {}
        const companyId = String(r.companyId || userData.companyId || userData.companyID || '');
        let companyName = '';
        if (companyId) {
            try {
                const ps = await admin.database().ref(`companies/${companyId}/profile`).get();
                const prof = ps.exists() ? ps.val() : {};
                companyName = String(prof.name || prof.nome || prof.razaoSocial || '');
            } catch (_) {}
        }
        const payments = Array.isArray(userData.payments) ? userData.payments : [];
        const lastPayment = payments.length ? payments[payments.length - 1] : null;
        companies.push({
            referredUid,
            companyId: companyId || null,
            companyName: companyName || null,
            userName: String(userData.username || userData.displayName || userData.name || ''),
            userEmail: String(userData.email || ''),
            status: String(userData.subscriptionStatus || userData.status || 'unknown'),
            plan: String((userData.subscription && userData.subscription.type) || userData.currentPlan || userData.plan || ''),
            endDate: (userData.subscription && userData.subscription.endDate) || userData.subscriptionEndDate || null,
            lastPayment: lastPayment ? { date: lastPayment.date || '', amount: Number(lastPayment.amount || 0), status: String(lastPayment.status || '') } : null,
            overdue: isOverdueUser(userData),
            linkedAt: r.at || ''
        });
    }
    companies.sort((a, b) => String(b.linkedAt || '').localeCompare(String(a.linkedAt || '')));
    const commSnap = await admin.database().ref(`campaignCommissions/${partner.id}`).get();
    const commRaw = commSnap.exists() ? commSnap.val() : {};
    const commissions = Object.entries(commRaw || {}).map(([entryId, c]) => ({ entryId, ...(c || {}) }))
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
    const detailPricing = await readPartnerPricing();
    const detailEnriched = await attachProjections(companies, partner, detailPricing);
    return { success: true, partner, companies: detailEnriched.companies, commissions, projectedTotal: detailEnriched.projectedTotal };
});

exports.setPartnerConfig = functions.https.onCall(async (data, context) => {
    await assertSuperAdminCall(context);
    const payload = data && typeof data === 'object' ? data : {};
    const partnerId = sanitizeStr(payload.partnerId, 128);
    const partner = await readPartnerById(partnerId);
    if (!partner) {
        throw new functions.https.HttpsError('not-found', 'Parceiro não encontrado.');
    }
    const updates = { updatedAt: new Date().toISOString(), updatedBy: String(context.auth.uid) };
    if (payload.commissionPercent !== undefined) {
        if (payload.commissionPercent === null || payload.commissionPercent === '') {
            updates.commissionPercent = null;
        } else {
            const pct = clampCommissionPercent(payload.commissionPercent);
            if (pct === null) {
                throw new functions.https.HttpsError('invalid-argument', 'Percentual deve estar entre 0 e 40.');
            }
            updates.commissionPercent = pct;
        }
    }
    if (payload.status !== undefined) {
        const st = String(payload.status);
        if (!['active', 'blocked', 'pending'].includes(st)) {
            throw new functions.https.HttpsError('invalid-argument', 'Status inválido.');
        }
        updates.status = st;
    }
    await admin.database().ref(`campaignPartners/${partner.id}`).update(updates);
    try {
        await admin.database().ref(`subscriptionAdminPurgeAudit/${context.auth.uid}`).push({
            at: new Date().toISOString(),
            by: String(context.auth.uid),
            type: 'setPartnerConfig',
            partnerId: partner.id,
            updates
        });
    } catch (_) {}
    return { success: true, partnerId: partner.id, updates };
});

exports.markCommissionPaid = functions.https.onCall(async (data, context) => {
    await assertSuperAdminCall(context);
    const payload = data && typeof data === 'object' ? data : {};
    const partnerId = sanitizeStr(payload.partnerId, 128);
    const entryId = sanitizeEntryId(payload.entryId);
    const note = sanitizeStr(payload.note, 280);
    const ref = admin.database().ref(`campaignCommissions/${partnerId}/${entryId}`);
    const snap = await ref.get();
    if (!snap.exists()) {
        throw new functions.https.HttpsError('not-found', 'Comissão não encontrada.');
    }
    const entry = snap.val() || {};
    if (entry.status !== 'earned') {
        throw new functions.https.HttpsError('failed-precondition', 'Somente comissões com status "earned" podem ser marcadas como pagas.');
    }
    const nowIso = new Date().toISOString();
    await ref.update({ status: 'paid', paidAt: nowIso, paidBy: String(context.auth.uid), note });
    try {
        const totalsSnap = await admin.database().ref(`campaignPartners/${partnerId}/totalPaid`).get();
        const current = Number(totalsSnap.val() || 0);
        await admin.database().ref(`campaignPartners/${partnerId}`).update({
            totalPaid: Math.round((current + Number(entry.commission || 0)) * 100) / 100,
            updatedAt: nowIso
        });
        await admin.database().ref(`subscriptionAdminPurgeAudit/${context.auth.uid}`).push({
            at: nowIso,
            by: String(context.auth.uid),
            type: 'markCommissionPaid',
            partnerId,
            entryId,
            commission: Number(entry.commission || 0),
            note
        });
    } catch (_) {}
    return { success: true, partnerId, entryId };
});

exports.adminLinkReferral = functions.https.onCall(async (data, context) => {
    await assertSuperAdminCall(context);
    const payload = data && typeof data === 'object' ? data : {};
    const partnerId = sanitizeStr(payload.partnerId, 128);
    const identity = sanitizeStr(payload.userEmail || payload.referredUid || payload.identity || '', 180).toLowerCase();
    if (!partnerId || !identity) {
        throw new functions.https.HttpsError('invalid-argument', 'partnerId e e-mail/UID do indicado são obrigatórios.');
    }
    const partner = await readPartnerById(partnerId);
    if (!partner || partner.status !== 'active') {
        throw new functions.https.HttpsError('not-found', 'Parceiro não encontrado ou inativo.');
    }
    let uid = '';
    let userData = {};
    if (/^[A-Za-z0-9]{10,128}$/.test(identity) && !identity.includes('@')) {
        const snap = await admin.database().ref(`users/${identity}`).get();
        if (!snap.exists()) {
            throw new functions.https.HttpsError('not-found', 'Usuário não encontrado.');
        }
        uid = identity;
        userData = snap.val() || {};
    } else {
        const usersSnap = await admin.database().ref('users').get();
        const users = usersSnap.exists() ? usersSnap.val() : {};
        for (const [candidateUid, u] of Object.entries(users || {})) {
            if (u && String(u.email || '').toLowerCase() === identity) {
                uid = String(candidateUid);
                userData = u || {};
                break;
            }
        }
        if (!uid) {
            throw new functions.https.HttpsError('not-found', 'Usuário não encontrado.');
        }
    }
    const userEmail = String(userData.email || '').toLowerCase();
    if (String(partner.ownerUid || '') === uid || (userEmail && partner.email && userEmail === String(partner.email).toLowerCase())) {
        throw new functions.https.HttpsError('failed-precondition', 'Parceiro não pode indicar a si mesmo.');
    }
    const link = await ensureReferral({
        uid,
        partnerId: partner.id,
        code: partner.code || '',
        source: 'manual_admin',
        companyId: String(userData.companyId || userData.companyID || '')
    });
    try {
        await admin.database().ref(`subscriptionAdminPurgeAudit/${context.auth.uid}`).push({
            at: new Date().toISOString(),
            by: String(context.auth.uid),
            type: 'adminLinkReferral',
            partnerId: partner.id,
            referredUid: uid
        });
    } catch (_) {}
    return { success: true, created: !!link.created, partnerId: partner.id, referredUid: uid, code: partner.code || '' };
});

module.exports = {
    configure,
    normalizePartnerCode,
    isValidPartnerCode,
    generatePartnerCode,
    clampCommissionPercent,
    computeCommission,
    sanitizeEntryId,
    resolvePartnerByCode,
    resolvePartnerLink,
    ensureReferral,
    isOverdueUser,
    recordPartnerCommissionEarned,
    planPeriodMonths,
    planAmountFromSettings,
    resolveEffectivePercent,
    buildProjections,
    attachProjections,
    registerPartner: exports.registerPartner,
    validatePartnerCode: exports.validatePartnerCode,
    linkPartnerReferral: exports.linkPartnerReferral,
    getMyPartnerDashboard: exports.getMyPartnerDashboard,
    sendBillingReminder: exports.sendBillingReminder,
    getPartnersAdmin: exports.getPartnersAdmin,
    getPartnerDetailAdmin: exports.getPartnerDetailAdmin,
    setPartnerConfig: exports.setPartnerConfig,
    markCommissionPaid: exports.markCommissionPaid,
    adminLinkReferral: exports.adminLinkReferral
};
