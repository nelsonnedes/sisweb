const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { onCall: onCallV2, onRequest: onRequestV2, HttpsError: HttpsErrorV2 } = require('firebase-functions/v2/https');
const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const { defineSecret } = require('firebase-functions/params');
let BigQuery = null;
try {
    ({ BigQuery } = require('@google-cloud/bigquery'));
} catch (_) {
    BigQuery = null;
}

function resolveDefaultStorageBucketName() {
    const explicit = String(
        process.env.FIREBASE_STORAGE_BUCKET
        || process.env.STORAGE_BUCKET
        || process.env.GCLOUD_STORAGE_BUCKET
        || ''
    ).trim();
    if (explicit) return explicit.replace(/^gs:\/\//i, '').replace(/\/+$/, '');
    try {
        const firebaseConfig = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};
        const configBucket = String(firebaseConfig.storageBucket || '').trim();
        if (configBucket) return configBucket.replace(/^gs:\/\//i, '').replace(/\/+$/, '');
        const projectId = String(firebaseConfig.projectId || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '').trim();
        if (projectId) return `${projectId}.firebasestorage.app`;
    } catch (_) {
        const projectId = String(process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '').trim();
        if (projectId) return `${projectId}.firebasestorage.app`;
    }
    return '';
}

function resolveDefaultDatabaseURL() {
    const explicit = String(
        process.env.FIREBASE_DATABASE_URL
        || process.env.DATABASE_URL
        || process.env.RTDB_URL
        || ''
    ).trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    try {
        const firebaseConfig = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};
        const configDatabaseURL = String(firebaseConfig.databaseURL || '').trim();
        if (configDatabaseURL) return configDatabaseURL.replace(/\/+$/, '');
        const projectId = String(firebaseConfig.projectId || process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '').trim();
        if (projectId === 'sisweb-7ce82') return 'https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app';
    } catch (_) {
        const projectId = String(process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || '').trim();
        if (projectId === 'sisweb-7ce82') return 'https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app';
    }
    return '';
}

function readStorageFileStreamToBuffer(file, maxBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        const stream = file.createReadStream();
        stream.on('data', (chunk) => {
            const safeChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            total += safeChunk.length;
            if (total > maxBytes) {
                stream.destroy(new Error('Logo da empresa excede o tamanho permitido para impressão.'));
                return;
            }
            chunks.push(safeChunk);
        });
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks, total)));
    });
}

const DEFAULT_STORAGE_BUCKET = resolveDefaultStorageBucketName();
const DEFAULT_DATABASE_URL = resolveDefaultDatabaseURL();
const adminAppOptions = {};
if (DEFAULT_STORAGE_BUCKET) adminAppOptions.storageBucket = DEFAULT_STORAGE_BUCKET;
if (DEFAULT_DATABASE_URL) adminAppOptions.databaseURL = DEFAULT_DATABASE_URL;
admin.initializeApp(Object.keys(adminAppOptions).length ? adminAppOptions : undefined);

const functionsV1 = require('firebase-functions/v1');
const { auth, https } = functionsV1;
const SUPER_ADMIN_EMAILS_RAW = process.env.SUPERADMIN_EMAILS || 'nedes1@hotmail.com';
const SUPER_ADMIN_UIDS_RAW = process.env.SUPERADMIN_UIDS || 'HfrQ6ObQq2aSEoeEE4Ng9jpAolB3';
const ADMIN_CORE_COMPANY_ID = 'sisweb_admin_core';
const SUBSCRIPTION_SETTINGS_PATH = 'system/subscriptionSettings';
const CLOUD_BILLING_BUDGET_TOPIC = 'sisweb-cloud-billing-budget-alerts';
const CLOUD_BILLING_PROJECT_ID = 'sisweb-7ce82';
const CLOUD_BILLING_DATASET_ID = 'billing_export';
const CLOUD_BILLING_CUD_DATASET_ID = 'billing_export1';
const CLOUD_BILLING_ACCOUNT_ID = '010952-939008-9EF759';
const CLOUD_BILLING_LINKED_ACCOUNT_URL = `https://console.cloud.google.com/billing/linkedaccount?project=${CLOUD_BILLING_PROJECT_ID}`;
const CLOUD_BILLING_BUDGETS_URL = `https://console.cloud.google.com/billing/budgets?project=${CLOUD_BILLING_PROJECT_ID}`;
const CLOUD_BILLING_EXPORT_URL = `https://console.cloud.google.com/billing/export?project=${CLOUD_BILLING_PROJECT_ID}`;
const CLOUD_BILLING_REPORTS_URL = `https://console.cloud.google.com/billing/${CLOUD_BILLING_ACCOUNT_ID}/reports?organizationId=0`;
const CLOUD_BILLING_COST_BREAKDOWN_URL = `https://console.cloud.google.com/billing/${CLOUD_BILLING_ACCOUNT_ID}/reports/cost-breakdown?organizationId=0`;
const CLOUD_BILLING_CUD_ANALYSIS_URL = `https://console.cloud.google.com/billing/${CLOUD_BILLING_ACCOUNT_ID}/commitments/analysis;timeRange=LAST_30_DAYS;commitment=subscriptionDefinitions%2Fae656bee-1eaf-4b54-a206-1b5be60f942c;timeGrouping=DAILY_GRANULARITY`;
const CLOUD_BILLING_DOCUMENTS_URL = 'https://console.cloud.google.com/billing/invoices';
const CLOUD_BILLING_TRANSACTIONS_URL = 'https://console.cloud.google.com/billing/history';
const SMTP_PASS_SECRET = defineSecret('SMTP_PASS');
const SMTP_SECRET_RUNTIME_OPTIONS = functionsV1.runWith({ secrets: [SMTP_PASS_SECRET] });
const CLOUD_BILLING_BIGQUERY_LOCATION = String(process.env.CLOUD_BILLING_BIGQUERY_LOCATION || '').trim();
const CLOUD_BILLING_TABLE_SUFFIX = CLOUD_BILLING_ACCOUNT_ID.replace(/-/g, '_');
const CLOUD_BILLING_STANDARD_TABLE_ID = `gcp_billing_export_v1_${CLOUD_BILLING_TABLE_SUFFIX}`;
const CLOUD_BILLING_DETAILED_TABLE_ID = `gcp_billing_export_resource_v1_${CLOUD_BILLING_TABLE_SUFFIX}`;
const CLOUD_BILLING_CUD_TABLE_ID = 'cud_subscriptions_export';
const CLOUD_BILLING_NOTIFICATION_RETENTION_LIMIT = 200;
const CLOUD_BILLING_NOTIFICATION_PRUNE_BATCH = 25;
const CLOUD_BILLING_OPERATIONAL_BUDGET_NAMES = new Set([
    'firebase project sisweb-7ce82'
]);

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
    if (!isSuperAdminEmail(email) && !isSuperAdminUidAllowed(uid)) return false;
    if (currentClaims.superadmin === true) return true;
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
        if (token.superadmin === true && isSuperAdminUidAllowed(uid)) return true;
        if (isSuperAdminUidAllowed(uid)) {
            const promoted = await promoteSuperAdminByUid(uid, { removeCompanyIdClaim: true });
            return promoted && promoted.success === true;
        }
        const byEmail = await ensureSuperAdminClaimIfAllowed(uid);
        if (byEmail) return true;
        return false;
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

function permissionAllowsCompanyProfileWrite(source) {
    const permissions = source && typeof source === 'object'
        ? (source.permissions || source.adminPermissions || {})
        : {};
    if (!permissions || typeof permissions !== 'object') return false;
    if (permissions.settings === true) return true;
    if (permissions.companyProfile === true) return true;
    if (permissions.companyProfile && permissions.companyProfile.write === true) return true;
    if (permissions.empresa === true) return true;
    if (permissions.empresa && permissions.empresa.write === true) return true;
    return false;
}

function roleAllowsCompanyProfileWrite(source) {
    const role = String(source && source.role || '').trim().toLowerCase();
    return role === 'owner' || role === 'admin' || role === 'company_admin';
}

function isPrimaryCompanyAccountForProfile(uid, tenant, userData, companyData) {
    const userCompanyId = String(
        userData && (userData.companyId || userData.companyID || userData.tenantId) || ''
    ).trim();
    if (!uid || !tenant || userCompanyId !== tenant) return false;
    const ownerUid = String(
        (companyData && (companyData.ownerUid || companyData.adminOwnerUid || companyData.primaryUserUid || companyData.createdBy || companyData.createdByUid))
        || ''
    ).trim();
    return !!ownerUid && ownerUid === uid;
}

async function assertCompanyProfileWriteAccess(context, companyId, userData, token) {
    if (await isCallerSuperAdmin(context)) return true;
    const uid = context && context.auth ? String(context.auth.uid || '') : '';
    const tenant = String(companyId || '').trim();
    if (!uid || !tenant) {
        throw new functions.https.HttpsError('permission-denied', 'Empresa inválida para alteração de perfil.');
    }
    const resolvedCompanyId = await resolveCompanyIdForUser(
        uid,
        sanitizeText((token && token.email) || (userData && userData.email) || '', ''),
        token || {},
        userData || {}
    );
    if (resolvedCompanyId !== tenant) {
        throw new functions.https.HttpsError('permission-denied', 'Usuário não pertence à empresa informada.');
    }

    const [memberSnap, roleSnap, companySnap] = await Promise.all([
        admin.database().ref(`companies/${tenant}/users/${uid}`).get().catch(() => null),
        admin.database().ref(`roles/${uid}`).get().catch(() => null),
        admin.database().ref(`companies/${tenant}`).get().catch(() => null)
    ]);
    const memberData = memberSnap && memberSnap.exists() && memberSnap.val() && typeof memberSnap.val() === 'object' ? memberSnap.val() : {};
    const roleData = roleSnap && roleSnap.exists() && roleSnap.val() && typeof roleSnap.val() === 'object' ? roleSnap.val() : {};
    const companyData = companySnap && companySnap.exists() && companySnap.val() && typeof companySnap.val() === 'object' ? companySnap.val() : {};
    if (memberData.active === false || roleData.active === false || userData.adminActive === false) {
        throw new functions.https.HttpsError('permission-denied', 'Administrador da empresa está inativo.');
    }
    const primaryCompanyAccount = isPrimaryCompanyAccountForProfile(uid, tenant, userData, companyData);
    const roleCompanyId = String(roleData.companyId || roleData.companyID || roleData.tenantId || '').trim();
    const createdBy = String(companyData.createdBy || companyData.createdByUid || '').trim();
    const allowed = roleAllowsCompanyProfileWrite(userData)
        || roleAllowsCompanyProfileWrite(memberData)
        || (roleCompanyId === tenant && roleAllowsCompanyProfileWrite(roleData))
        || permissionAllowsCompanyProfileWrite(userData)
        || permissionAllowsCompanyProfileWrite(memberData)
        || permissionAllowsCompanyProfileWrite(roleData)
        || createdBy === uid
        || primaryCompanyAccount;
    if (!allowed) {
        throw new functions.https.HttpsError('permission-denied', 'Apenas admin da empresa pode alterar o perfil.');
    }
    return true;
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
    const keys = ['subscriptionStatus', 'accountStatus', 'statusReason', 'pendingPayment', 'subscription', 'subscriptionStart', 'subscriptionEnd', 'subscriptionEndDate', 'trialStart', 'trialEnd', 'trialUsed', 'trialConsumed', 'freeTrialUsed', 'adminTrialGrant', 'payments', 'campaignLedger', 'updatedBy', 'role', 'adminPermissions', 'adminActive', 'superadmin', 'readOnlyUntil', 'readOnlyGrantedAt', 'readOnlyGrantedBy', 'readOnlyGraceConsumed', 'readOnlyReason'];
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

function toSignedMoney(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.round(parsed * 100) / 100;
}

function toRatio(value, fallback = 0) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.round(parsed * 10000) / 10000;
}

function sanitizeText(value, fallback = '') {
    if (value === undefined || value === null) return fallback;
    const out = String(value).trim();
    return out.slice(0, 300);
}

function normalizePromoCodeValue(value) {
    return sanitizeText(value || '', '')
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '')
        .slice(0, 40);
}

const PROMO_ALLOWED_PLAN_KEYS = new Set(['monthly', 'quarterly', 'annual', 'premium']);

function normalizePromoPlanKey(value) {
    const plan = sanitizeText(value || '', '').toLowerCase();
    if (plan === 'trimestral') return 'quarterly';
    if (plan === 'mensal') return 'monthly';
    if (plan === 'anual') return 'annual';
    return PROMO_ALLOWED_PLAN_KEYS.has(plan) ? plan : '';
}

function normalizePromoAllowedPlans(value) {
    const source = Array.isArray(value)
        ? value
        : String(value || '')
            .split(/[,\s;|]+/)
            .map((item) => item.trim())
            .filter(Boolean);
    const out = [];
    source.forEach((item) => {
        const key = normalizePromoPlanKey(item);
        if (key && !out.includes(key)) out.push(key);
    });
    return out;
}

function promoAppliesToPlan(promo, planId) {
    const planKey = normalizePromoPlanKey(planId);
    const allowedPlans = normalizePromoAllowedPlans(
        promo && (promo.allowedPlans || promo.plans || promo.planIds)
    );
    if (!allowedPlans.length) return true;
    if (allowedPlans.includes(planKey)) return true;
    if (planKey === 'annual' && allowedPlans.includes('quarterly')) return true;
    if (planKey === 'quarterly' && allowedPlans.includes('annual')) return true;
    return false;
}

function normalizePromoExpiresAt(value, active) {
    if (value === undefined || value === null || value === '') return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new functions.https.HttpsError('invalid-argument', 'Validade do cupom inválida.');
    }
    if (active === true && date.getTime() < Date.now()) {
        throw new functions.https.HttpsError('failed-precondition', 'Cupom ativo não pode ter validade vencida.');
    }
    return date.toISOString();
}

function normalizePromoCodeAdminPayload(payload, current, actorUid) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const existing = current && typeof current === 'object' ? current : {};
    const nowIso = new Date().toISOString();
    const code = normalizePromoCodeValue(source.code || existing.code || '');
    if (code.length < 3) {
        throw new functions.https.HttpsError('invalid-argument', 'Código do cupom deve ter pelo menos 3 caracteres.');
    }

    const type = String(source.type || existing.type || 'percent').trim().toLowerCase();
    if (!['percent', 'fixed'].includes(type)) {
        throw new functions.https.HttpsError('invalid-argument', 'Tipo de cupom inválido.');
    }

    const value = toMoney(source.value !== undefined ? source.value : existing.value, 0);
    if (value <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Valor do cupom deve ser maior que zero.');
    }
    if (type === 'percent' && value > 100) {
        throw new functions.https.HttpsError('invalid-argument', 'Desconto percentual não pode passar de 100%.');
    }
    if (type === 'fixed' && value > 100000) {
        throw new functions.https.HttpsError('invalid-argument', 'Desconto fixo acima do limite permitido.');
    }

    const maxUsesRaw = source.maxUses !== undefined ? source.maxUses : existing.maxUses;
    const maxUses = Math.max(0, Math.min(100000, parseInt(maxUsesRaw, 10) || 0));
    const currentUses = Math.max(0, parseInt(existing.currentUses, 10) || 0);
    if (maxUses > 0 && currentUses > maxUses) {
        throw new functions.https.HttpsError('failed-precondition', 'Limite de usos não pode ser menor que o total já utilizado.');
    }

    const active = source.active === undefined ? existing.active === true : source.active === true;
    const expiresAt = normalizePromoExpiresAt(
        source.expiresAt !== undefined ? source.expiresAt : existing.expiresAt,
        active
    );
    const allowedPlans = normalizePromoAllowedPlans(source.allowedPlans || source.plans || source.planIds || existing.allowedPlans || []);

    return {
        code,
        type,
        value,
        maxUses,
        currentUses,
        expiresAt,
        active,
        allowedPlans,
        archived: false,
        createdAt: existing.createdAt || nowIso,
        createdBy: existing.createdBy || sanitizeText(actorUid || ''),
        updatedAt: nowIso,
        updatedBy: sanitizeText(actorUid || '')
    };
}

function compactPromoCodeAuditShape(promo) {
    const source = promo && typeof promo === 'object' ? promo : {};
    return {
        code: normalizePromoCodeValue(source.code || ''),
        type: sanitizeText(source.type || ''),
        value: toMoney(source.value || 0, 0),
        maxUses: Math.max(0, parseInt(source.maxUses, 10) || 0),
        currentUses: Math.max(0, parseInt(source.currentUses, 10) || 0),
        active: source.active === true,
        archived: source.archived === true,
        expiresAt: source.expiresAt || null,
        allowedPlans: normalizePromoAllowedPlans(source.allowedPlans || [])
    };
}

async function appendPromoCodeAudit(action, actorUid, code, beforePromo, afterPromo) {
    const payload = {
        type: 'promo_code',
        action: sanitizeText(action || 'UNKNOWN', 'UNKNOWN'),
        promoCode: normalizePromoCodeValue(code || ''),
        actorUid: sanitizeText(actorUid || ''),
        at: new Date().toISOString(),
        before: compactPromoCodeAuditShape(beforePromo || {}),
        after: compactPromoCodeAuditShape(afterPromo || {})
    };
    await admin.database().ref('subscriptionPromoCodeAudit').push(payload);
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

function stripHtmlTags(value) {
    return String(value || '')
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function sanitizeSupportText(value, fallback = '', maxLen = 2000) {
    const clean = stripHtmlTags(value);
    if (!clean) return fallback;
    return clean.slice(0, Math.max(0, maxLen));
}

function isBase64LikeLogo(value) {
    const raw = String(value || '').trim();
    return raw.startsWith('data:') || (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 1000);
}

function sanitizeLogoProfilePayload(payload = {}, current = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const existing = current && typeof current === 'object' ? current : {};
    const logoCandidate = sanitizeLongText(source.logoUrl || source.logoURL || source.logo || existing.logoUrl || existing.logo || '', '', 4096);
    const logoStoragePath = sanitizeLongText(source.logoStoragePath || source.logoPath || source.storagePath || existing.logoStoragePath || existing.logoPath || '', '', 1024);
    const logoUrl = sanitizeLongText(source.logoUrl || source.logoURL || (/^https?:\/\//i.test(logoCandidate) ? logoCandidate : '') || existing.logoUrl || '', '', 4096);
    return {
        logo: isBase64LikeLogo(logoCandidate) ? '' : (logoUrl || logoStoragePath || logoCandidate),
        logoUrl: isBase64LikeLogo(logoUrl) ? '' : logoUrl,
        logoStoragePath,
        logoPath: logoStoragePath,
        logoFileName: sanitizeText(source.logoFileName || source.logoName || existing.logoFileName || existing.logoName || '', ''),
        logoContentType: sanitizeText(source.logoContentType || source.logoMimeType || existing.logoContentType || existing.logoMimeType || '', ''),
        logoSize: Number(source.logoSize || existing.logoSize || 0) || null,
        logoUpdatedAt: sanitizeText(source.logoUpdatedAt || existing.logoUpdatedAt || '', '')
    };
}

function sanitizeCompanyProfileExtraPayload(payload = {}, current = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const existing = current && typeof current === 'object' ? current : {};
    const email = sanitizeText(source.email || source.emailContato || source.contactEmail || existing.email || existing.emailContato || existing.contactEmail || '', '').toLowerCase();
    const responsibleName = sanitizeText(
        source.responsibleName
        || source.responsavel
        || source.nomeResponsavel
        || source.owner
        || existing.responsibleName
        || existing.responsavel
        || existing.nomeResponsavel
        || existing.owner
        || '',
        ''
    );
    const zip = sanitizeText(source.zip || source.cep || source.postalCode || existing.zip || existing.cep || existing.postalCode || '', '');
    const neighborhood = sanitizeText(source.neighborhood || source.bairro || source.district || existing.neighborhood || existing.bairro || existing.district || '', '');
    const number = sanitizeText(source.number || source.numero || existing.number || existing.numero || '', '');
    const complement = sanitizeText(source.complement || source.complemento || existing.complement || existing.complemento || '', '');
    
    // Novos campos PIX/Bancários para Lâmina de Cobrança
    const pixChaveCobranca = sanitizeText(source.pixChaveCobranca || existing.pixChaveCobranca || '', '');
    const pixTipoChaveCobranca = sanitizeText(source.pixTipoChaveCobranca || existing.pixTipoChaveCobranca || '', '');
    const pixFavorecidoCobranca = sanitizeText(source.pixFavorecidoCobranca || existing.pixFavorecidoCobranca || '', '');
    const pixBancoCobranca = sanitizeText(source.pixBancoCobranca || existing.pixBancoCobranca || '', '');

    return {
        email,
        emailContato: email,
        responsibleName,
        responsavel: responsibleName,
        zip,
        cep: zip,
        neighborhood,
        bairro: neighborhood,
        number,
        numero: number,
        complement,
        complemento: complement,
        pixChaveCobranca,
        pixTipoChaveCobranca,
        pixFavorecidoCobranca,
        pixBancoCobranca
    };
}

function firstDefinedGeoValue(...values) {
    for (const value of values) {
        if (value !== undefined && value !== null) return value;
    }
    return '';
}

function sanitizeGeoCoordinateText(value, min, max) {
    const raw = sanitizeText(value, '', 40).replace(',', '.');
    if (!raw) return '';
    const number = Number(raw);
    if (!Number.isFinite(number) || number < min || number > max) return null;
    return number.toFixed(6);
}

function buildCompanyNavigationUrlServer(latitude, longitude) {
    const lat = sanitizeGeoCoordinateText(latitude, -90, 90);
    const lng = sanitizeGeoCoordinateText(longitude, -180, 180);
    if (!lat || !lng) return '';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

function sanitizeCompanyGeolocationPayload(payload = {}, current = {}) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const existing = current && typeof current === 'object' ? current : {};
    const sourceGeo = source.geolocation && typeof source.geolocation === 'object' ? source.geolocation : {};
    const sourceLocation = source.location && typeof source.location === 'object' ? source.location : {};
    const existingGeo = existing.geolocation && typeof existing.geolocation === 'object' ? existing.geolocation : {};
    const existingLocation = existing.location && typeof existing.location === 'object' ? existing.location : {};
    const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
    const hasIncomingGeo = [
        'latitude',
        'geoLatitude',
        'lat',
        'longitude',
        'geoLongitude',
        'lng',
        'lon',
        'mapUrl',
        'navigationUrl',
        'geolocation',
        'location'
    ].some((key) => hasOwn(source, key));

    const rawLatitude = hasIncomingGeo
        ? firstDefinedGeoValue(source.latitude, source.geoLatitude, source.lat, sourceGeo.latitude, sourceGeo.geoLatitude, sourceGeo.lat, sourceLocation.latitude, sourceLocation.lat)
        : firstDefinedGeoValue(existing.latitude, existing.geoLatitude, existing.lat, existingGeo.latitude, existingGeo.geoLatitude, existingGeo.lat, existingLocation.latitude, existingLocation.lat);
    const rawLongitude = hasIncomingGeo
        ? firstDefinedGeoValue(source.longitude, source.geoLongitude, source.lng, source.lon, sourceGeo.longitude, sourceGeo.geoLongitude, sourceGeo.lng, sourceGeo.lon, sourceLocation.longitude, sourceLocation.lng, sourceLocation.lon)
        : firstDefinedGeoValue(existing.longitude, existing.geoLongitude, existing.lng, existing.lon, existingGeo.longitude, existingGeo.geoLongitude, existingGeo.lng, existingGeo.lon, existingLocation.longitude, existingLocation.lng, existingLocation.lon);

    const latitudeRawText = sanitizeText(rawLatitude, '', 40);
    const longitudeRawText = sanitizeText(rawLongitude, '', 40);
    if (!hasIncomingGeo && !latitudeRawText && !longitudeRawText) return {};
    if (!latitudeRawText && !longitudeRawText) {
        return {
            latitude: '',
            longitude: '',
            geoLatitude: '',
            geoLongitude: '',
            geoAccuracy: '',
            geoUpdatedAt: '',
            geoSource: '',
            mapUrl: '',
            navigationUrl: '',
            geolocation: null
        };
    }

    const latitude = sanitizeGeoCoordinateText(rawLatitude, -90, 90);
    const longitude = sanitizeGeoCoordinateText(rawLongitude, -180, 180);
    if (!latitude || !longitude) {
        throw new functions.https.HttpsError('invalid-argument', 'Coordenadas geográficas inválidas.');
    }

    const mapUrl = buildCompanyNavigationUrlServer(latitude, longitude);
    const accuracy = sanitizeText(
        firstDefinedGeoValue(source.geoAccuracy, sourceGeo.accuracy, sourceGeo.geoAccuracy, sourceLocation.accuracy, existing.geoAccuracy, existingGeo.accuracy),
        '',
        40
    );
    const updatedAt = sanitizeText(
        firstDefinedGeoValue(source.geoUpdatedAt, sourceGeo.updatedAt, sourceGeo.geoUpdatedAt, sourceLocation.updatedAt, existing.geoUpdatedAt, existingGeo.updatedAt),
        new Date().toISOString(),
        80
    );
    const geoSource = sanitizeText(
        firstDefinedGeoValue(source.geoSource, sourceGeo.source, sourceLocation.source, existing.geoSource, existingGeo.source),
        hasIncomingGeo ? 'manual' : '',
        80
    );
    return {
        latitude,
        longitude,
        geoLatitude: latitude,
        geoLongitude: longitude,
        geoAccuracy: accuracy,
        geoUpdatedAt: updatedAt,
        geoSource,
        mapUrl,
        navigationUrl: mapUrl,
        geolocation: {
            latitude: Number(latitude),
            longitude: Number(longitude),
            accuracy,
            updatedAt,
            source: geoSource,
            mapUrl,
            navigationUrl: mapUrl
        }
    };
}

function extractFirebaseStoragePathFromUrlServer(pathOrUrl) {
    const raw = sanitizeLongText(pathOrUrl, '', 2048);
    if (!raw) return '';
    if (/^gs:\/\//i.test(raw)) {
        return raw.replace(/^gs:\/\/[^/]+\//i, '').replace(/^\/+/, '');
    }
    if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, '');
    try {
        const url = new URL(raw);
        const host = String(url.hostname || '').toLowerCase();
        const isStorageHost = host.includes('firebasestorage.googleapis.com') || host.endsWith('.firebasestorage.app');
        if (!isStorageHost) return '';
        const marker = '/o/';
        const index = url.pathname.indexOf(marker);
        if (index < 0) return '';
        return decodeURIComponent(url.pathname.slice(index + marker.length)).replace(/^\/+/, '');
    } catch (_) {
        return '';
    }
}

function normalizeCompanyLogoStoragePath(companyId, pathOrUrl) {
    const prefix = `companies/${companyId}/profile/logo/`;
    const storagePath = extractFirebaseStoragePathFromUrlServer(pathOrUrl);
    if (!storagePath) return '';
    if (storagePath.includes('..') || storagePath.includes('//') || !storagePath.startsWith(prefix)) {
        throw new functions.https.HttpsError('invalid-argument', 'Caminho da logo não pertence à empresa informada.');
    }
    return storagePath;
}

function normalizeCompanyLogoProfilePayload(companyId, logoPayload) {
    const payload = logoPayload && typeof logoPayload === 'object' ? { ...logoPayload } : {};
    const keepPath = normalizeCompanyLogoStoragePath(companyId, payload.logoStoragePath || payload.logoPath || '');
    if (!keepPath) return payload;
    payload.logoStoragePath = keepPath;
    payload.logoPath = keepPath;
    if (!payload.logo || !/^https?:\/\//i.test(String(payload.logo))) payload.logo = keepPath;
    return payload;
}

async function reconcileCompanyLogoObjects(companyId, keepPath) {
    const prefix = `companies/${companyId}/profile/logo/`;
    try {
        keepPath = normalizeCompanyLogoStoragePath(companyId, keepPath);
    } catch (error) {
        console.error('Falha ao normalizar caminho da logo para reconciliação.', {
            companyId,
            code: error && error.code ? String(error.code) : ''
        });
        return { attempted: false, deletedCount: 0, failedCount: 1 };
    }
    if (!keepPath) {
        return { attempted: false, deletedCount: 0, failedCount: 0 };
    }

    let files;
    try {
        [files] = await admin.storage().bucket().getFiles({ prefix });
    } catch (error) {
        console.error('Falha ao listar logos antigas da empresa para reconciliação.', {
            companyId,
            code: error && error.code ? String(error.code) : ''
        });
        return { attempted: true, deletedCount: 0, failedCount: 1 };
    }

    const staleFiles = files.filter((file) => file.name !== keepPath);
    const results = await Promise.allSettled(
        staleFiles.map((file) => file.delete({ ignoreNotFound: true }))
    );
    const failedCount = results.filter((result) => result.status === 'rejected').length;
    if (failedCount) {
        console.error('Falha parcial ao remover logos antigas da empresa.', {
            companyId,
            attemptedCount: staleFiles.length,
            failedCount
        });
    }
    return {
        attempted: true,
        deletedCount: results.length - failedCount,
        failedCount
    };
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

function publicSubscriptionSettingsShape(input) {
    const settings = normalizeSubscriptionSettings(input || {});
    return {
        plans: settings.plans,
        paymentMethods: settings.paymentMethods,
        paymentMeta: {
            supportEmail: settings.paymentMeta && settings.paymentMeta.supportEmail ? settings.paymentMeta.supportEmail : ''
        },
        promotion: settings.promotion,
        campaign: settings.campaign,
        freeTrialDays: settings.freeTrialDays,
        lateGraceDays: settings.lateGraceDays,
        updatedAt: settings.updatedAt,
        __public: true
    };
}

function subscriberSubscriptionSettingsShape(input) {
    const settings = normalizeSubscriptionSettings(input || {});
    return {
        plans: settings.plans,
        paymentMethods: settings.paymentMethods,
        paymentMeta: {
            pixKey: settings.paymentMeta && settings.paymentMeta.pixKey ? settings.paymentMeta.pixKey : '',
            beneficiary: settings.paymentMeta && settings.paymentMeta.beneficiary ? settings.paymentMeta.beneficiary : '',
            supportEmail: settings.paymentMeta && settings.paymentMeta.supportEmail ? settings.paymentMeta.supportEmail : ''
        },
        promotion: settings.promotion,
        campaign: settings.campaign,
        freeTrialDays: settings.freeTrialDays,
        lateGraceDays: settings.lateGraceDays,
        updatedAt: settings.updatedAt,
        __subscriber: true
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
        source: sanitizeText(payload && payload.source ? payload.source : 'subscription', 'subscription')
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
    let companyId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    let companyRef = admin.database().ref(`companies/${companyId}`);
    let companySnap = await companyRef.get();
    let attempts = 0;
    while (companySnap.exists() && attempts < 5) {
        companyId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
        companyRef = admin.database().ref(`companies/${companyId}`);
        companySnap = await companyRef.get();
        attempts += 1;
    }
    if (companySnap.exists()) {
        throw new functions.https.HttpsError('already-exists', 'Não foi possível gerar um ID único para empresa.');
    }
    const nowIso = new Date().toISOString();
    const logoPayload = sanitizeLogoProfilePayload(input, {});
    const extraProfilePayload = sanitizeCompanyProfileExtraPayload({ ...input, email }, {});
    const geoProfilePayload = sanitizeCompanyGeolocationPayload(input, {});
    const companyPayload = {
        id: companyId,
        companyId,
        name,
        cnpj: sanitizeText(input.cnpj || '', ''),
        stateRegistration: sanitizeText(input.stateRegistration || input.inscricaoEstadual || input.ie || '', ''),
        address: sanitizeText(input.address || '', ''),
        city: sanitizeText(input.city || '', ''),
        state: sanitizeText(input.state || '', ''),
        phone: sanitizeText(input.phone || '', ''),
        ...extraProfilePayload,
        ...geoProfilePayload,
        ...logoPayload,
        timestamp: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: uid,
        ownerUid: uid
    };
    await companyRef.update(companyPayload);
    const userRecord = await admin.auth().getUser(uid);
    const currentClaims = userRecord.customClaims || {};
    const nextClaims = { ...currentClaims, companyId, tenantId: companyId };
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
        tenantId: companyId,
        role: 'admin',
        adminActive: true,
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
    if (token.superadmin === true && isSuperAdminUidAllowed(uid)) {
        return { success: true, superadmin: true, changed: false, source: 'uid_allowlist_token' };
    }
    if (isSuperAdminUidAllowed(uid)) {
        const promoted = await promoteSuperAdminByUid(uid, { removeCompanyIdClaim: true });
        return { success: true, superadmin: true, changed: !!(promoted && promoted.changed), source: 'uid_allowlist' };
    }
    const byEmail = await ensureSuperAdminClaimIfAllowed(uid);
    if (byEmail) {
        return { success: true, superadmin: true, changed: true, source: 'email_allowlist' };
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
        const isGlobalAllowlisted = isSuperAdminEmail(email) || isSuperAdminUidAllowed(userRecord.uid);
        if (hasSuperadmin && !isGlobalAllowlisted) {
            issues.push('superadmin=true fora da allowlist global');
        }
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

// =========================================================================
// FULL USER CLEANUP — Remove COMPLETAMENTE todos os dados de um usuário
// incluindo Auth, Firestore/RTDB (users, companies, tenants), subscription,
// supportTickets, Storage, etc. para permitir novo registro sem impedimentos.
// =========================================================================
exports.fullUserCleanup = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem chamar esta função.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode executar limpeza total de usuário.');

    const payload = data || {};
    const targetUid = payload.targetUid ? String(payload.targetUid) : '';
    const reviewNote = sanitizeText(payload.reviewNote || 'Limpeza total administrativa', '');

    if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid é obrigatório.');
    }

    // Proteção: não permitir auto-exclusão
    if (targetUid === callerUid) {
        throw new functions.https.HttpsError('permission-denied', 'Você não pode excluir seu próprio usuário administrativo.');
    }

    const nowIso = new Date().toISOString();
    const removedPaths = [];
    const failedPaths = [];

        async function removePath(ref, label) {
        try {
            await ref.remove();
            removedPaths.push(label);
        } catch (err) {
            console.error('[fullUserCleanup] Falha ao remover ' + label + ':', err);
            failedPaths.push(label);
        }
    }

    try {
        // 1. Obter dados do usuário para descobrir companyId e email
        const userSnap = await admin.database().ref(`users/${targetUid}`).get();
        const userData = userSnap.exists() ? userSnap.val() : {};
        const companyId = String(userData && (userData.companyId || userData.tenantId || userData.companyID) || '').trim();
        const userEmail = String(userData && userData.email || '').trim();

        // 2. Buscar companyId em subscriptionRequests caso não tenha
        let resolvedCompanyId = companyId;
        if (!resolvedCompanyId) {
            try {
                const reqSnap = await admin.database().ref(`subscriptionRequests/${targetUid}`).get();
                if (reqSnap.exists()) {
                    const reqs = reqSnap.val() || {};
                    for (const reqId of Object.keys(reqs || {})) {
                        const req = reqs[reqId] || {};
                        if (req.companyId) {
                            resolvedCompanyId = String(req.companyId);
                            break;
                        }
                    }
                }
            } catch (resolveErr) {
                console.warn('[fullUserCleanup] Falha ao resolver companyId:', resolveErr && resolveErr.message ? resolveErr.message : resolveErr);
            }
        }

        // 3. Remover usuário do Firebase Auth (se não for o caller)
        try {
            await admin.auth().deleteUser(targetUid);
            removedPaths.push('auth/users/' + targetUid);
        } catch (authErr) {
            // Se o erro for 'auth/user-not-found', ignora — já foi removido
            if (authErr && authErr.code && authErr.code === 'auth/user-not-found') {
                removedPaths.push('auth/users/' + targetUid + ' (inexistente)');
            } else {
                console.error('[fullUserCleanup] Falha ao deletar Auth user:', authErr);
                failedPaths.push('auth/users/' + targetUid);
            }
        }

        // 4. Remover nó principal do usuário no RTDB
        await removePath(admin.database().ref(`users/${targetUid}`), 'users/' + targetUid);

        // 5. Remover roles do usuário
        await removePath(admin.database().ref(`roles/${targetUid}`), 'roles/' + targetUid);

        // 6. Remover dados de assinatura
        await removePath(admin.database().ref(`subscriptionRequests/${targetUid}`), 'subscriptionRequests/' + targetUid);
        await removePath(admin.database().ref(`subscriptionAudit/${targetUid}`), 'subscriptionAudit/' + targetUid);
        await removePath(admin.database().ref(`subscriptionFinancialAudit/${targetUid}`), 'subscriptionFinancialAudit/' + targetUid);
        await removePath(admin.database().ref(`subscriptionExtensionRequests/${targetUid}`), 'subscriptionExtensionRequests/' + targetUid);
        await removePath(admin.database().ref(`pixPayments/${targetUid}`), 'pixPayments/' + targetUid);

        // 7. Remover prova de hashes
        try {
            const proofHashesRef = admin.database().ref('subscriptionProofHashes');
            const proofHashesSnap = await proofHashesRef.get();
            const proofHashesMap = proofHashesSnap.exists() ? (proofHashesSnap.val() || {}) : {};
            const hashUpdates = {};
            Object.keys(proofHashesMap || {}).forEach((fingerprint) => {
                const item = proofHashesMap[fingerprint] || {};
                if (String(item.uid || '') === targetUid) {
                    hashUpdates[fingerprint] = null;
                }
            });
            if (Object.keys(hashUpdates).length) {
                await proofHashesRef.update(hashUpdates);
                removedPaths.push('subscriptionProofHashes (entries for ' + targetUid + ')');
            }
        } catch (_) {}

        // 8. Remover dados financeiros associados (financialEvents)
        try {
            const finSnap = await admin.database().ref('financialEvents').get();
            if (finSnap.exists()) {
                const finEvents = finSnap.val() || {};
                const finUpdates = {};
                Object.keys(finEvents || {}).forEach((eventId) => {
                    const evt = finEvents[eventId] || {};
                    if (String(evt.uid || evt.targetUid || '') === targetUid) {
                        finUpdates[eventId] = null;
                    }
                });
                if (Object.keys(finUpdates).length) {
                    await admin.database().ref('financialEvents').update(finUpdates);
                    removedPaths.push('financialEvents (entries for ' + targetUid + ')');
                }
            }
        } catch (_) {}

        // 9. Remover supportTickets do usuário
        try {
            const ticketsSnap = await admin.database().ref('supportTickets').get();
            if (ticketsSnap.exists()) {
                const tickets = ticketsSnap.val() || {};
                const ticketUpdates = {};
                Object.keys(tickets || {}).forEach((ticketId) => {
                    const ticket = tickets[ticketId] || {};
                    if (String(ticket.uid || ticket.createdBy || ticket.userId || '') === targetUid) {
                        ticketUpdates[ticketId] = null;
                    }
                });
                // Também verificar subcoleção company-based
                if (resolvedCompanyId) {
                    try {
                        const companyTicketsSnap = await admin.database().ref(`companies/${resolvedCompanyId}/supportTickets`).get();
                        if (companyTicketsSnap.exists()) {
                            const companyTickets = companyTicketsSnap.val() || {};
                            Object.keys(companyTickets || {}).forEach((ticketId) => {
                                const ticket = companyTickets[ticketId] || {};
                                if (String(ticket.uid || ticket.createdBy || ticket.userId || '') === targetUid) {
                                    ticketUpdates[ticketId] = null;
                                }
                            });
                        }
                    } catch (_) {}
                }
                if (Object.keys(ticketUpdates).length) {
                    await admin.database().ref('supportTickets').update(ticketUpdates);
                    removedPaths.push('supportTickets (entries for ' + targetUid + ')');
                }
            }
        } catch (_) {}

        // 10. Remover notificações do usuário
        await removePath(admin.database().ref(`users/${targetUid}/notifications`), 'users/' + targetUid + '/notifications');
        await removePath(admin.database().ref(`users/${targetUid}/securityAudit`), 'users/' + targetUid + '/securityAudit');

        // 11. Remover do companies/{companyId} se tiver
        if (resolvedCompanyId) {
            // Remover referência do usuário na empresa
            await removePath(
                admin.database().ref(`companies/${resolvedCompanyId}/users/${targetUid}`),
                'companies/' + resolvedCompanyId + '/users/' + targetUid
            );

            // Remover subscriptionRequests dentro da empresa
            await removePath(
                admin.database().ref(`companies/${resolvedCompanyId}/subscriptionRequests/${targetUid}`),
                'companies/' + resolvedCompanyId + '/subscriptionRequests/' + targetUid
            );

            // Remover tenant se existir
            await removePath(
                admin.database().ref(`tenants/${resolvedCompanyId}/users/${targetUid}`),
                'tenants/' + resolvedCompanyId + '/users/' + targetUid
            );

            // Verificar se é o owner da empresa — se sim, remover company profile
            try {
                const companySnap = await admin.database().ref(`companies/${resolvedCompanyId}`).get();
                if (companySnap.exists()) {
                    const companyData = companySnap.val() || {};
                    const ownerUid = String(
                        companyData.ownerUid
                        || companyData.adminOwnerUid
                        || companyData.primaryUserUid
                        || companyData.createdBy
                        || companyData.createdByUid
                        || ''
                    ).trim();

                    const companyUsersSnap = await admin.database().ref(`companies/${resolvedCompanyId}/users`).get();
                    const companyUsers = companyUsersSnap.exists() ? (companyUsersSnap.val() || {}) : {};
                    const remainingUsers = Object.keys(companyUsers || {}).filter((uid) => uid !== targetUid);

                    // Se o owner está sendo removido e não há mais usuários, remove o profile da empresa
                    if (ownerUid === targetUid && remainingUsers.length === 0) {
                        await removePath(
                            admin.database().ref(`companies/${resolvedCompanyId}/profile`),
                            'companies/' + resolvedCompanyId + '/profile'
                        );

                        // Remover tenant raiz se existir
                        await removePath(
                            admin.database().ref(`tenants/${resolvedCompanyId}`),
                            'tenants/' + resolvedCompanyId
                        );

                        removedPaths.push('companies/' + resolvedCompanyId + ' (profile removido por ser owner sem usuários restantes)');
                    }
                }
            } catch (_) {}
        }

        // 12. Remover de todas as outras empresas (caso o usuário esteja vinculado a mais de uma)
        try {
            const allCompaniesSnap = await admin.database().ref('companies').get();
            if (allCompaniesSnap.exists()) {
                const allCompanies = allCompaniesSnap.val() || {};
                const crossRemovals = [];
                Object.keys(allCompanies || {}).forEach((cId) => {
                    if (cId !== resolvedCompanyId) {
                        crossRemovals.push(
                            admin.database().ref(`companies/${cId}/users/${targetUid}`).remove().catch(() => {}).then(() => {
                                removedPaths.push('companies/' + cId + '/users/' + targetUid + ' (cross-company)');
                            })
                        );
                        crossRemovals.push(
                            admin.database().ref(`companies/${cId}/subscriptionRequests/${targetUid}`).remove().catch(() => {}).then(() => {
                                removedPaths.push('companies/' + cId + '/subscriptionRequests/' + targetUid + ' (cross-company)');
                            })
                        );
                    }
                });
                if (crossRemovals.length) await Promise.all(crossRemovals);
            }
        } catch (_) {}

                // 13. Remover arquivos de Storage (todos os prefixes do usuario)
        try {
            const bucket = admin.storage().bucket();
            const storagePrefixes = [
                'users/' + targetUid + '/',
                'subscriptionProofs/' + targetUid + '/',
            ];
            if (resolvedCompanyId) {
                storagePrefixes.push('companies/' + resolvedCompanyId + '/proofs/' + targetUid + '/');
                storagePrefixes.push('companies/' + resolvedCompanyId + '/logos/' + targetUid + '/');
            }
            let totalDeleted = 0;
            for (const sp of storagePrefixes) {
                try {
                    const [files] = await bucket.getFiles({ prefix: sp });
                    if (files && files.length > 0) {
                        const deleteResults = await Promise.allSettled(
                            files.map((file) => file.delete().catch(function() {}))
                        );
                        totalDeleted += deleteResults.filter(function(r) { return r.status === 'fulfilled'; }).length;
                    }
                } catch (_) {}
            }
            if (totalDeleted > 0) {
                removedPaths.push('Storage/* (' + totalDeleted + ' files)');
            }
        } catch (storageErr) {
            console.error('[fullUserCleanup] Falha ao remover arquivos Storage:', storageErr);
            failedPaths.push('Storage/*');
        }
// 14. Registrar auditoria da operação
        await admin.database().ref('subscriptionAdminPurgeAudit/' + targetUid).push({
            at: nowIso,
            by: callerUid,
            type: 'fullUserCleanup',
            reviewNote,
            removedPaths,
            failedPaths,
            companyId: resolvedCompanyId || null,
            userEmail: userEmail || null
        });

        return {
            success: true,
            targetUid,
            removedPathsCount: removedPaths.length,
            failedPathsCount: failedPaths.length,
            removedPaths,
            failedPaths,
            companyId: resolvedCompanyId || null
        };

    } catch (err) {
        console.error('[fullUserCleanup] Erro geral:', err);
        // NÃO expor detalhes internos (err.message pode conter stack traces/caminhos) ao cliente
        throw new functions.https.HttpsError('internal', 'Erro durante limpeza total de usuário. Tente novamente ou contate o suporte.');
    }
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
    } catch (proofErr) {
        console.warn('[fullUserCleanup] Falha ao limpar proof hashes:', proofErr && proofErr.message ? proofErr.message : proofErr);
    }

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
    const snapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const normalized = normalizeSubscriptionSettings(snapshot.exists() ? snapshot.val() : {});
    if (!context.auth) {
        return { success: true, settings: publicSubscriptionSettingsShape(normalized), public: true };
    }
    const isAdmin = await isCallerSuperAdmin(context);
    if (isAdmin) {
        return { success: true, settings: normalized, full: true };
    }
    // Assinantes autenticados recebem o shape comercial (preços, métodos, PIX key e
    // configuração de campanha) sem as partes internas de auditoria/admin.
    return { success: true, settings: subscriberSubscriptionSettingsShape(normalized), subscriber: true };
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
    const logoPayload = normalizeCompanyLogoProfilePayload(companyId, sanitizeLogoProfilePayload(payload, current));
    const extraProfilePayload = sanitizeCompanyProfileExtraPayload(payload, current);
    const geoProfilePayload = sanitizeCompanyGeolocationPayload(payload, current);
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
        ...extraProfilePayload,
        ...geoProfilePayload,
        ...logoPayload,
        updatedAt: new Date().toISOString(),
        updatedBy: context.auth.uid
    };
    await profileRef.set(nextProfile);
    const logoCleanup = await reconcileCompanyLogoObjects(companyId, nextProfile.logoStoragePath || nextProfile.logoPath || '');
    return { success: true, companyId, profile: nextProfile, logoCleanup };
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
    const requestedCompanyId = sanitizeText(payload.companyId || payload.id || payload.companyID || payload.tenantId || '', '');
    const companyId = await resolveCompanyIdForUser(uid, sanitizeText(token.email || userData.email || '', ''), token, userData);
    if (!companyId) {
        throw new functions.https.HttpsError('failed-precondition', 'Usuário sem companyId válido.');
    }
    if (requestedCompanyId && requestedCompanyId !== companyId) {
        throw new functions.https.HttpsError('permission-denied', 'companyId informado não pertence ao usuário autenticado.');
    }
    await assertCompanyProfileWriteAccess(context, companyId, userData, token);
    const profileRef = admin.database().ref(`companies/${companyId}/profile`);
    const currentSnap = await profileRef.get();
    const current = currentSnap.exists() && currentSnap.val() && typeof currentSnap.val() === 'object'
        ? currentSnap.val()
        : {};
    const preservedCnpj = sanitizeText(current.cnpj || current.cnpjCpf || current.cpfCnpj || current.documento || '', '');
    const logoPayload = normalizeCompanyLogoProfilePayload(companyId, sanitizeLogoProfilePayload(payload, current));
    const extraProfilePayload = sanitizeCompanyProfileExtraPayload(payload, current);
    const geoProfilePayload = sanitizeCompanyGeolocationPayload(payload, current);
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
        ...extraProfilePayload,
        ...geoProfilePayload,
        ...logoPayload,
        updatedAt: new Date().toISOString(),
        updatedBy: uid
    };
    await profileRef.set(nextProfile);
    const logoCleanup = await reconcileCompanyLogoObjects(companyId, nextProfile.logoStoragePath || nextProfile.logoPath || '');
    return { success: true, companyId, profile: nextProfile, logoCleanup };
});

function normalizeSelfProfilePayload(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(source, key);
    const trimTo = (value, max) => {
        if (value === undefined || value === null) return '';
        return String(value).trim().slice(0, max);
    };
    const patch = {};
    const authPatch = {};

    if (hasOwn('displayName') || hasOwn('name')) {
        const displayName = trimTo(source.displayName || source.name || '', 120);
        if (!displayName) {
            throw new functions.https.HttpsError('invalid-argument', 'Nome completo é obrigatório para atualizar o perfil.');
        }
        patch.displayName = displayName;
        patch.name = displayName;
        authPatch.displayName = displayName;
    }
    if (hasOwn('username')) {
        const username = trimTo(source.username || '', 80);
        if (!username) {
            throw new functions.https.HttpsError('invalid-argument', 'Nome de usuário é obrigatório para atualizar o perfil.');
        }
        patch.username = username;
    }
    if (hasOwn('phone')) {
        const phone = trimTo(source.phone || '', 40);
        patch.phone = phone;
        patch.telefone = phone;
    }
    if (hasOwn('whatsapp')) {
        patch.whatsapp = trimTo(source.whatsapp || '', 40);
    }
    if (hasOwn('photoURL')) {
        const photoURL = trimTo(source.photoURL || '', 2048);
        patch.photoURL = photoURL || null;
        authPatch.photoURL = photoURL || null;
    }

    const editableKeys = Object.keys(patch);
    if (!editableKeys.length) {
        throw new functions.https.HttpsError('invalid-argument', 'Nenhum campo cadastral seguro foi informado.');
    }

    const now = new Date().toISOString();
    patch.updatedAt = now;
    patch.lastUpdated = now;
    patch.profileUpdatedAt = now;
    return { patch, authPatch };
}

exports.updateMyUserProfile = https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem atualizar o próprio perfil.');
    }
    const uid = String(context.auth.uid || '').trim();
    const token = context.auth.token || {};
    const { patch, authPatch } = normalizeSelfProfilePayload(data);

    if (Object.keys(authPatch).length) {
        await admin.auth().updateUser(uid, authPatch);
    }

    const sync = await applyUserPatchAcrossScopes(uid, patch, {
        email: sanitizeText(token.email || '', '')
    });
    return {
        success: true,
        uid,
        companyId: sync && sync.companyId ? sync.companyId : '',
        profile: patch
    };
});

exports.getCompanyLogoDataUrl = https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem carregar a logo da empresa.');
    }

    const uid = context.auth.uid;
    const token = context.auth.token || {};
    const payload = data && typeof data === 'object' ? data : {};
    const userSnap = await admin.database().ref(`users/${uid}`).get();
    const userData = userSnap.exists() && userSnap.val() && typeof userSnap.val() === 'object'
        ? userSnap.val()
        : {};
    const isSuperAdmin = await isCallerSuperAdmin(context);
    const requestedCompanyId = sanitizeText(payload.companyId || payload.companyID || payload.tenantId || '', '');
    const companyId = isSuperAdmin && requestedCompanyId
        ? requestedCompanyId
        : await resolveCompanyIdForUser(uid, sanitizeText(token.email || userData.email || '', ''), token, userData);

    if (!companyId) {
        throw new functions.https.HttpsError('failed-precondition', 'Usuário sem companyId/tenantId válido para carregar logo.');
    }

    const storagePath = extractFirebaseStoragePathFromUrlServer(
        payload.storagePath || payload.path || payload.logoStoragePath || payload.logoPath || payload.logoUrl || payload.url || ''
    );
    if (!storagePath || storagePath.includes('..') || storagePath.includes('//')) {
        throw new functions.https.HttpsError('invalid-argument', 'Caminho da logo é inválido.');
    }

    const expectedPrefix = `companies/${companyId}/profile/logo/`;
    if (!storagePath.startsWith(expectedPrefix)) {
        throw new functions.https.HttpsError('permission-denied', 'Logo solicitada não pertence ao tenant autenticado.');
    }

    const maxBytes = Math.max(1, Math.min(parseInt(payload.maxBytes, 10) || (2 * 1024 * 1024), 2 * 1024 * 1024));
    let file;
    try {
        file = admin.storage().bucket().file(storagePath);
    } catch (error) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Bucket de Storage não configurado para carregar logo da empresa.',
            { storageBucket: DEFAULT_STORAGE_BUCKET || null }
        );
    }
    let metadata;
    try {
        const result = await file.getMetadata();
        metadata = result && result[0] ? result[0] : {};
    } catch (error) {
        throw new functions.https.HttpsError('not-found', 'Logo da empresa não encontrada no Storage.');
    }

    const contentType = sanitizeText(metadata.contentType || '', '');
    if (!/^image\/(png|jpe?g|webp)$/i.test(contentType)) {
        throw new functions.https.HttpsError('failed-precondition', 'Logo da empresa precisa ser PNG, JPG ou WEBP.');
    }
    const size = Number(metadata.size || 0);
    if (size > maxBytes) {
        throw new functions.https.HttpsError('failed-precondition', 'Logo da empresa excede o tamanho permitido para impressão.');
    }

    let buffer;
    try {
        const result = await file.download();
        buffer = result && result[0] ? result[0] : Buffer.alloc(0);
    } catch (downloadError) {
        try {
            buffer = await readStorageFileStreamToBuffer(file, maxBytes);
        } catch (streamError) {
            console.error('Falha ao baixar logo da empresa do Storage', {
                companyId,
                storagePath,
                storageBucket: DEFAULT_STORAGE_BUCKET || null,
                downloadMessage: downloadError && downloadError.message ? downloadError.message : String(downloadError),
                downloadCode: downloadError && downloadError.code ? downloadError.code : null,
                streamMessage: streamError && streamError.message ? streamError.message : String(streamError),
                streamCode: streamError && streamError.code ? streamError.code : null
            });
            throw new functions.https.HttpsError(
                'failed-precondition',
                'Falha ao baixar logo da empresa do Storage para impressão. Verifique as permissões do bucket e tente novamente.',
                {
                    storageBucket: DEFAULT_STORAGE_BUCKET || null,
                    code: streamError && streamError.code ? String(streamError.code) : (downloadError && downloadError.code ? String(downloadError.code) : '')
                }
            );
        }
    }
    if (!buffer.length || buffer.length > maxBytes) {
        console.error('Falha ao baixar logo da empresa do Storage', {
            companyId,
            storagePath,
            storageBucket: DEFAULT_STORAGE_BUCKET || null,
            message: 'Buffer vazio ou acima do limite depois do download.',
            size: buffer.length,
            maxBytes
        });
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Logo da empresa inválida para impressão.',
            {
                storageBucket: DEFAULT_STORAGE_BUCKET || null
            }
        );
    }

    return {
        success: true,
        companyId,
        storagePath,
        contentType,
        size: buffer.length,
        dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`
    };
});

const SUPPORT_STATUS_VALUES = new Set(['open', 'waiting_support', 'waiting_customer', 'resolved', 'closed']);
const SUPPORT_PRIORITY_VALUES = new Set(['low', 'normal', 'high', 'critical']);
const SUPPORT_CREATE_LIMIT_PER_DAY = 20;
const SUPPORT_MESSAGE_LIMIT_PER_DAY = 120;
const SUPPORT_ATTACHMENT_MAX_COUNT = 3;
const SUPPORT_ATTACHMENT_MAX_BYTES = 6 * 1024 * 1024;
const SUPPORT_ATTACHMENT_ALLOWED_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'application/pdf'
]);
const PUBLIC_SUPPORT_EMAIL_LIMIT_PER_DAY = 8;
const PUBLIC_SUPPORT_EMAIL_GLOBAL_LIMIT_PER_DAY = 80;
const SUPPORT_ADMIN_URL = process.env.SUPPORT_ADMIN_URL || 'https://sisweb-7ce82.web.app/admin.html?tab=support';

function parseSupportEmailList(value) {
    return String(value || '')
        .split(/[,\s;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item));
}

function normalizeCloudBillingBudgetMessage(message) {
    let payload = {};
    try {
        if (message && message.json && typeof message.json === 'object') payload = message.json;
    } catch (_) {}
    if (!payload || !Object.keys(payload).length) {
        try {
            const raw = message && message.data ? Buffer.from(message.data, 'base64').toString('utf8') : '';
            payload = raw ? JSON.parse(raw) : {};
        } catch (_) {
            payload = {};
        }
    }
    const costAmount = Number(payload.costAmount || payload.cost_amount || 0);
    const budgetAmount = Number(payload.budgetAmount || payload.budget_amount || 0);
    const alertThresholdExceeded = Number(payload.alertThresholdExceeded || payload.alert_threshold_exceeded || 0);
    const forecastThresholdExceeded = Number(payload.forecastThresholdExceeded || payload.forecast_threshold_exceeded || 0);
    const usagePercent = budgetAmount > 0 ? costAmount / budgetAmount : Math.max(alertThresholdExceeded, forecastThresholdExceeded, 0);
    let severity = 'info';
    if (Math.max(usagePercent, alertThresholdExceeded, forecastThresholdExceeded) >= 1) severity = 'error';
    else if (Math.max(usagePercent, alertThresholdExceeded, forecastThresholdExceeded) >= 0.8) severity = 'warning';
    return {
        raw: payload,
        budgetDisplayName: sanitizeText(payload.budgetDisplayName || payload.budget_display_name || 'Google Cloud Billing', 'Google Cloud Billing'),
        costAmount: Number.isFinite(costAmount) ? costAmount : 0,
        budgetAmount: Number.isFinite(budgetAmount) ? budgetAmount : 0,
        budgetAmountType: sanitizeText(payload.budgetAmountType || payload.budget_amount_type || '', ''),
        currencyCode: sanitizeText(payload.currencyCode || payload.currency_code || 'BRL', 'BRL'),
        costIntervalStart: sanitizeText(payload.costIntervalStart || payload.cost_interval_start || '', ''),
        alertThresholdExceeded: Number.isFinite(alertThresholdExceeded) ? alertThresholdExceeded : 0,
        forecastThresholdExceeded: Number.isFinite(forecastThresholdExceeded) ? forecastThresholdExceeded : 0,
        usagePercent: Number.isFinite(usagePercent) ? usagePercent : 0,
        severity,
        receivedAt: new Date().toISOString()
    };
}

function normalizeBudgetNameKey(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function isOperationalCloudBillingBudgetName(value) {
    return CLOUD_BILLING_OPERATIONAL_BUDGET_NAMES.has(normalizeBudgetNameKey(value));
}

function shouldPreferIncomingBillingBudget(previousSummary, normalized) {
    const incomingName = normalizeBudgetNameKey(normalized && normalized.budgetDisplayName);
    if (!isOperationalCloudBillingBudgetName(incomingName)) return false;
    if (!previousSummary || typeof previousSummary !== 'object') return true;
    if (!previousSummary.budgetDisplayName) return true;
    const previousName = normalizeBudgetNameKey(previousSummary.budgetDisplayName);
    if (!isOperationalCloudBillingBudgetName(previousName)) return true;
    if (incomingName === 'firebase project sisweb-7ce82') return true;
    if (previousName === 'firebase project sisweb-7ce82' && incomingName !== previousName) return false;
    const incomingCost = toMoney(normalized && normalized.costAmount, 0);
    const previousBudgetCost = toMoney(previousSummary.budgetReportedCostAmount || previousSummary.costAmount || 0, 0);
    if (incomingCost > 0 && previousBudgetCost <= 0) return true;
    if (incomingCost <= 0 && previousBudgetCost > 0) return false;
    return true;
}

async function enforceCloudBillingNotificationRetention() {
    const retentionRef = admin.database().ref('system/googleCloudBilling/notificationRetention');
    const countRef = retentionRef.child('count');
    const countResult = await countRef.transaction((current) => {
        const parsed = Number.parseInt(current, 10);
        return (Number.isFinite(parsed) && parsed >= 0 ? parsed : 0) + 1;
    });
    const currentCount = Number.parseInt(countResult.snapshot.val(), 10) || 0;
    if (currentCount <= CLOUD_BILLING_NOTIFICATION_RETENTION_LIMIT) {
        await retentionRef.update({
            limit: CLOUD_BILLING_NOTIFICATION_RETENTION_LIMIT,
            updatedAt: new Date().toISOString()
        });
        return;
    }

    const overflow = Math.min(
        Math.max(currentCount - CLOUD_BILLING_NOTIFICATION_RETENTION_LIMIT, 1),
        CLOUD_BILLING_NOTIFICATION_PRUNE_BATCH
    );
    const notificationsRef = admin.database().ref('system/googleCloudBilling/budgetNotifications');
    const oldestSnap = await notificationsRef
        .orderByChild('receivedAt')
        .limitToFirst(overflow)
        .get();
    const removals = {};
    oldestSnap.forEach((childSnap) => {
        removals[childSnap.key] = null;
    });
    const removedCount = Object.keys(removals).length;
    if (removedCount > 0) {
        await notificationsRef.update(removals);
        await countRef.transaction((current) => {
            const parsed = Number.parseInt(current, 10);
            return Math.max(0, (Number.isFinite(parsed) ? parsed : 0) - removedCount);
        });
    }
    await retentionRef.update({
        limit: CLOUD_BILLING_NOTIFICATION_RETENTION_LIMIT,
        lastPrunedCount: removedCount,
        lastPrunedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}

function normalizeBigQueryNumber(value, fallback = 0) {
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
        return normalizeBigQueryNumber(value.value, fallback);
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCloudBillingCostRow(row, index) {
    const service = sanitizeText(row && row.service, 'Google Cloud');
    const sku = sanitizeText(row && row.sku, 'SKU');
    const region = sanitizeText(row && row.region, '');
    return {
        id: `svc_${String(index + 1).padStart(3, '0')}`,
        service,
        sku,
        region,
        grossCost: toMoney(normalizeBigQueryNumber(row && row.grossCost), 0),
        credits: toSignedMoney(normalizeBigQueryNumber(row && row.credits), 0),
        netCost: toSignedMoney(normalizeBigQueryNumber(row && row.netCost), 0),
        currencyCode: sanitizeText(row && row.currency, 'BRL')
    };
}

function normalizeCloudBillingSeriesRow(row) {
    return {
        label: sanitizeText(row && row.label, ''),
        amount: toSignedMoney(normalizeBigQueryNumber(row && row.amount), 0),
        currencyCode: sanitizeText(row && row.currency, 'BRL')
    };
}

function objectByKey(rows, keyBuilder) {
    const out = {};
    (Array.isArray(rows) ? rows : []).forEach((row, index) => {
        const key = sanitizeFirebaseKey(typeof keyBuilder === 'function' ? keyBuilder(row, index) : `item_${index + 1}`);
        if (key) out[key] = row;
    });
    return out;
}

function sanitizeFirebaseKey(value) {
    return String(value || '')
        .trim()
        .replace(/[.#$/[\]]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 120);
}

async function bigQueryTableExists(bigquery, datasetId, tableId) {
    try {
        const [exists] = await bigquery.dataset(datasetId).table(tableId).exists();
        return !!exists;
    } catch (error) {
        const message = String((error && error.message) || error || '');
        if (/access denied|permission/i.test(message)) {
            throw new HttpsErrorV2('permission-denied', `Sem permissão para ler BigQuery: ${message}`);
        }
        return false;
    }
}

function buildCloudBillingServiceCostQuery(days) {
    const safeDays = Math.max(7, Math.min(370, parseInt(days, 10) || 30));
    return `
SELECT
  service.description AS service,
  sku.description AS sku,
  IFNULL(location.region, '') AS region,
  ROUND(SUM(cost), 2) AS grossCost,
  ROUND(SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0)), 2) AS credits,
  ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0)), 2) AS netCost,
  ANY_VALUE(currency) AS currency
FROM \`${CLOUD_BILLING_PROJECT_ID}.${CLOUD_BILLING_DATASET_ID}.${CLOUD_BILLING_STANDARD_TABLE_ID}\`
WHERE project.id = @projectId
  AND usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${safeDays} DAY)
GROUP BY service, sku, region
HAVING ABS(grossCost) > 0 OR ABS(netCost) > 0
ORDER BY netCost DESC
LIMIT 50`;
}

function buildCloudBillingDailySeriesQuery(days) {
    const safeDays = Math.max(7, Math.min(90, parseInt(days, 10) || 45));
    return `
SELECT
  FORMAT_DATE('%Y-%m-%d', DATE(usage_start_time)) AS label,
  ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0)), 2) AS amount,
  ANY_VALUE(currency) AS currency
FROM \`${CLOUD_BILLING_PROJECT_ID}.${CLOUD_BILLING_DATASET_ID}.${CLOUD_BILLING_STANDARD_TABLE_ID}\`
WHERE project.id = @projectId
  AND usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${safeDays} DAY)
GROUP BY label
ORDER BY label ASC`;
}

function buildCloudBillingMonthlySeriesQuery() {
    return `
SELECT
  invoice.month AS label,
  ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0)), 2) AS amount,
  ANY_VALUE(currency) AS currency
FROM \`${CLOUD_BILLING_PROJECT_ID}.${CLOUD_BILLING_DATASET_ID}.${CLOUD_BILLING_STANDARD_TABLE_ID}\`
WHERE project.id = @projectId
  AND usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 370 DAY)
GROUP BY label
ORDER BY label DESC
LIMIT 12`;
}

function getNestedObjectValue(source, path) {
    return String(path || '').split('.').filter(Boolean).reduce((current, key) => {
        if (!current || typeof current !== 'object') return null;
        return current[key];
    }, source || {});
}

function countCollectionItems(value) {
    if (!value) return 0;
    if (Array.isArray(value)) return value.filter((item) => item !== undefined && item !== null).length;
    if (typeof value === 'object') return Object.keys(value).filter((key) => value[key] !== undefined && value[key] !== null).length;
    return 0;
}

function normalizeCompanyBillingName(companyId, company) {
    const profile = company && company.profile && typeof company.profile === 'object' ? company.profile : {};
    const legacy = company && company.companies && typeof company.companies === 'object' && !Array.isArray(company.companies)
        ? company.companies
        : {};
    return sanitizeText(
        (profile && (profile.name || profile.companyName || profile.fantasyName || profile.razaoSocial))
        || (legacy && (legacy.name || legacy.companyName || legacy.fantasyName || legacy.razaoSocial))
        || (company && (company.name || company.companyName || company.fantasyName || company.razaoSocial))
        || companyId,
        companyId
    );
}

function buildEmptyCompanyUsageMetrics() {
    return {
        users: 0,
        masterData: 0,
        transactions: 0,
        inventory: 0,
        payroll: 0,
        support: 0,
        totalRecords: 0,
        weightedUsageUnits: 0
    };
}

function buildCompanyUsageCostRows(companiesMap, usersMap, supportMap, baseCostAmount, currencyCode) {
    const companies = companiesMap && typeof companiesMap === 'object' ? companiesMap : {};
    const users = usersMap && typeof usersMap === 'object' ? usersMap : {};
    const supportTickets = supportMap && typeof supportMap === 'object' ? supportMap : {};
    const companyIds = new Set(Object.keys(companies));
    Object.keys(users).forEach((uid) => {
        const user = users[uid] || {};
        const companyId = sanitizeText(user.companyId || user.companyID || user.tenantId || '', '');
        if (companyId) companyIds.add(companyId);
    });
    Object.keys(supportTickets).forEach((companyId) => {
        if (companyId) companyIds.add(companyId);
    });

    const userCountByCompany = {};
    Object.keys(users).forEach((uid) => {
        const user = users[uid] || {};
        const companyId = sanitizeText(user.companyId || user.companyID || user.tenantId || '', '');
        if (!companyId) return;
        userCountByCompany[companyId] = (userCountByCompany[companyId] || 0) + 1;
    });

    const rows = Array.from(companyIds).map((companyId) => {
        const company = companies[companyId] && typeof companies[companyId] === 'object' ? companies[companyId] : {};
        const metrics = buildEmptyCompanyUsageMetrics();
        const companyUsersCount = countCollectionItems(company.users);
        metrics.users = Math.max(companyUsersCount, userCountByCompany[companyId] || 0);
        metrics.masterData = [
            'clients',
            'fornecedores',
            'produtos',
            'especies'
        ].reduce((sum, path) => sum + countCollectionItems(getNestedObjectValue(company, path)), 0);
        metrics.transactions = [
            'romaneios.tora',
            'romaneios.pct',
            'romaneios.tl',
            'romaneios.pes',
            'romaneiosTora',
            'romaneiosPct',
            'pedidosVenda',
            'pedidosCompra',
            'vendas.pedidos',
            'vendas.pagamentos_carrego',
            'financas.receber',
            'financas.pagar'
        ].reduce((sum, path) => sum + countCollectionItems(getNestedObjectValue(company, path)), 0);
        metrics.inventory = [
            'estoqueTorasAtual',
            'estoqueProdutos',
            'movimentacoesToras',
            'movimentacoesProdutos',
            'rastreabilidade'
        ].reduce((sum, path) => sum + countCollectionItems(getNestedObjectValue(company, path)), 0);
        metrics.payroll = [
            'funcionarios',
            'folhas',
            'folha.funcionarios',
            'folha.bancoHoras',
            'folha.cargos'
        ].reduce((sum, path) => sum + countCollectionItems(getNestedObjectValue(company, path)), 0);
        metrics.support = countCollectionItems(supportTickets[companyId]);
        metrics.totalRecords = metrics.users + metrics.masterData + metrics.transactions + metrics.inventory + metrics.payroll + metrics.support;
        metrics.weightedUsageUnits = toSignedMoney(
            (metrics.users * 10)
            + (metrics.masterData * 1)
            + (metrics.transactions * 4)
            + (metrics.inventory * 2)
            + (metrics.payroll * 3)
            + (metrics.support * 2),
            0
        );
        return {
            companyId,
            companyName: normalizeCompanyBillingName(companyId, company),
            currencyCode: currencyCode || 'BRL',
            ...metrics
        };
    });

    const activeRows = rows.filter((row) => row.totalRecords > 0 || row.weightedUsageUnits > 0);
    const totalWeightedUsageUnits = activeRows.reduce((sum, row) => sum + Number(row.weightedUsageUnits || 0), 0);
    activeRows.forEach((row) => {
        const share = totalWeightedUsageUnits > 0 ? Number(row.weightedUsageUnits || 0) / totalWeightedUsageUnits : 0;
        row.usageShare = toRatio(share, 0);
        row.estimatedCostAmount = toSignedMoney(Math.max(0, Number(baseCostAmount || 0)) * share, 0);
    });
    activeRows.sort((a, b) => {
        const costDiff = Number(b.estimatedCostAmount || 0) - Number(a.estimatedCostAmount || 0);
        if (costDiff) return costDiff;
        return Number(b.weightedUsageUnits || 0) - Number(a.weightedUsageUnits || 0);
    });
    return { rows: activeRows, totalWeightedUsageUnits };
}

exports.ingestCloudBillingBudgetNotification = onMessagePublished(
    { topic: CLOUD_BILLING_BUDGET_TOPIC, region: 'us-central1' },
    async (event) => {
        const message = event && event.data && event.data.message ? event.data.message : (event && event.data ? event.data : {});
        const normalized = normalizeCloudBillingBudgetMessage(message);
        const eventId = sanitizeText((event && event.id) || crypto.randomBytes(8).toString('hex'), crypto.randomBytes(8).toString('hex'));
        const notificationPath = `system/googleCloudBilling/budgetNotifications/${eventId}`;
        const [previousSummarySnap, previousNotificationSnap] = await Promise.all([
            admin.database().ref('system/googleCloudBilling/summary').get().catch(() => null),
            admin.database().ref(notificationPath).get().catch(() => null)
        ]);
        if (previousNotificationSnap && previousNotificationSnap.exists()) return null;
        const previousSummary = previousSummarySnap && previousSummarySnap.exists() ? (previousSummarySnap.val() || {}) : {};
        const preferIncomingBudget = shouldPreferIncomingBillingBudget(previousSummary, normalized);
        const isIncomingOperationalBudget = isOperationalCloudBillingBudgetName(normalized.budgetDisplayName);
        const budgetForSummary = preferIncomingBudget ? normalized : {
            ...normalized,
            budgetDisplayName: previousSummary.budgetDisplayName || normalized.budgetDisplayName,
            budgetAmount: toMoney(previousSummary.budgetAmount || normalized.budgetAmount, normalized.budgetAmount),
            budgetAmountType: previousSummary.budgetAmountType || normalized.budgetAmountType,
            currencyCode: previousSummary.currencyCode || normalized.currencyCode,
            costIntervalStart: previousSummary.costIntervalStart || normalized.costIntervalStart,
            alertThresholdExceeded: toMoney(previousSummary.alertThresholdExceeded || 0, normalized.alertThresholdExceeded),
            forecastThresholdExceeded: toMoney(previousSummary.forecastThresholdExceeded || 0, normalized.forecastThresholdExceeded),
            usagePercent: toMoney(previousSummary.usagePercent || 0, normalized.usagePercent),
            severity: previousSummary.severity || normalized.severity
        };
        const hasBigQueryCost = !!(previousSummary && previousSummary.lastBigQuerySyncAt);
        const summaryCostAmount = hasBigQueryCost ? toMoney(previousSummary.costAmount || budgetForSummary.costAmount, budgetForSummary.costAmount) : budgetForSummary.costAmount;
        const summaryUsagePercent = budgetForSummary.budgetAmount > 0 ? summaryCostAmount / budgetForSummary.budgetAmount : budgetForSummary.usagePercent;
        let summarySeverity = budgetForSummary.severity;
        if (summaryUsagePercent >= 1) summarySeverity = 'error';
        else if (summaryUsagePercent >= 0.8) summarySeverity = 'warning';
        const updates = {};
        const budgetKey = sanitizeFirebaseKey(normalized.budgetDisplayName || 'google-cloud-billing');
        updates[notificationPath] = normalized;
        updates[`system/googleCloudBilling/latestBudgetNotifications/${budgetKey}`] = normalized;
        updates['system/googleCloudBilling/summary'] = {
            ...(previousSummary && typeof previousSummary === 'object' ? previousSummary : {}),
            source: hasBigQueryCost ? 'cloud-billing-budget-pubsub+bigquery-export' : 'cloud-billing-budget-pubsub',
            topic: CLOUD_BILLING_BUDGET_TOPIC,
            projectId: CLOUD_BILLING_PROJECT_ID,
            lastNotificationAt: normalized.receivedAt,
            budgetDisplayName: budgetForSummary.budgetDisplayName,
            budgetReportedCostAmount: budgetForSummary.costAmount,
            ignoredBudgetDisplayName: preferIncomingBudget ? '' : normalized.budgetDisplayName,
            ignoredBudgetCostAmount: preferIncomingBudget ? 0 : normalized.costAmount,
            ignoredBudgetNotificationAt: preferIncomingBudget ? '' : normalized.receivedAt,
            costAmount: summaryCostAmount,
            budgetAmount: budgetForSummary.budgetAmount,
            budgetAmountType: budgetForSummary.budgetAmountType,
            currencyCode: budgetForSummary.currencyCode,
            costIntervalStart: budgetForSummary.costIntervalStart,
            alertThresholdExceeded: budgetForSummary.alertThresholdExceeded,
            forecastThresholdExceeded: budgetForSummary.forecastThresholdExceeded,
            usagePercent: summaryUsagePercent,
            severity: summarySeverity,
            billingUrl: CLOUD_BILLING_LINKED_ACCOUNT_URL,
            budgetsUrl: CLOUD_BILLING_BUDGETS_URL,
            reportsUrl: CLOUD_BILLING_REPORTS_URL,
            costBreakdownUrl: CLOUD_BILLING_COST_BREAKDOWN_URL,
            cudAnalysisUrl: CLOUD_BILLING_CUD_ANALYSIS_URL,
            documentsUrl: CLOUD_BILLING_DOCUMENTS_URL,
            transactionsUrl: CLOUD_BILLING_TRANSACTIONS_URL
        };
        if (preferIncomingBudget && isIncomingOperationalBudget && (normalized.severity === 'warning' || normalized.severity === 'error')) {
            updates['system/operationalAlerts/firebaseBilling/cloudBudget'] = {
                status: normalized.severity === 'error' ? 'blocked' : 'open',
                severity: normalized.severity,
                source: 'cloud-billing-budget-pubsub',
                message: `Orçamento ${normalized.budgetDisplayName} atingiu ${(normalized.usagePercent * 100).toFixed(1)}% do limite configurado.`,
                budgetDisplayName: normalized.budgetDisplayName,
                costAmount: normalized.costAmount,
                budgetAmount: normalized.budgetAmount,
                usagePercent: normalized.usagePercent,
                billingUrl: CLOUD_BILLING_BUDGETS_URL,
                updatedAt: normalized.receivedAt
            };
        } else if (preferIncomingBudget && isIncomingOperationalBudget) {
            updates['system/operationalAlerts/firebaseBilling/cloudBudget'] = null;
        }
        await admin.database().ref().update(updates);
        await enforceCloudBillingNotificationRetention();
        return null;
    }
);

exports.syncGoogleCloudBillingCostExport = onCallV2(
    { region: 'us-central1' },
    async (request) => {
        if (!(await isCallerSuperAdmin(request))) {
            throw new HttpsErrorV2('permission-denied', 'Apenas SuperAdmin pode sincronizar custos do Google Cloud Billing.');
        }
        if (!BigQuery) {
            throw new HttpsErrorV2('failed-precondition', 'Dependência @google-cloud/bigquery indisponível nas Functions.');
        }
        const days = Math.max(7, Math.min(370, parseInt(request && request.data && request.data.days, 10) || 30));
        const nowIso = new Date().toISOString();
        const bigquery = new BigQuery({ projectId: CLOUD_BILLING_PROJECT_ID });
        try {
            const [standardExists, detailedExists, cudExists] = await Promise.all([
                bigQueryTableExists(bigquery, CLOUD_BILLING_DATASET_ID, CLOUD_BILLING_STANDARD_TABLE_ID),
                bigQueryTableExists(bigquery, CLOUD_BILLING_DATASET_ID, CLOUD_BILLING_DETAILED_TABLE_ID),
                bigQueryTableExists(bigquery, CLOUD_BILLING_CUD_DATASET_ID, CLOUD_BILLING_CUD_TABLE_ID)
            ]);
            const exportStatus = {
                status: standardExists ? 'ready' : 'waiting_for_standard_usage_table',
                projectId: CLOUD_BILLING_PROJECT_ID,
                datasetId: CLOUD_BILLING_DATASET_ID,
                cudDatasetId: CLOUD_BILLING_CUD_DATASET_ID,
                standardTableId: CLOUD_BILLING_STANDARD_TABLE_ID,
                detailedTableId: CLOUD_BILLING_DETAILED_TABLE_ID,
                cudTableId: CLOUD_BILLING_CUD_TABLE_ID,
                standardTableExists: standardExists,
                detailedTableExists: detailedExists,
                cudTableExists: cudExists,
                bigQueryLocation: CLOUD_BILLING_BIGQUERY_LOCATION || 'auto',
                lastCheckedAt: nowIso
            };
            if (!standardExists) {
                await admin.database().ref('system/googleCloudBilling/exportStatus').set(exportStatus);
                return {
                    success: false,
                    waiting: true,
                    reason: 'standard_usage_table_not_ready',
                    exportStatus
                };
            }

            const queryOptions = {
                params: { projectId: CLOUD_BILLING_PROJECT_ID }
            };
            if (CLOUD_BILLING_BIGQUERY_LOCATION) queryOptions.location = CLOUD_BILLING_BIGQUERY_LOCATION;
            const [[serviceRows], [dailyRows], [monthlyRows]] = await Promise.all([
                bigquery.query({ ...queryOptions, query: buildCloudBillingServiceCostQuery(days) }),
                bigquery.query({ ...queryOptions, query: buildCloudBillingDailySeriesQuery(Math.min(days, 90)) }),
                bigquery.query({ ...queryOptions, query: buildCloudBillingMonthlySeriesQuery() })
            ]);
            const serviceCosts = (serviceRows || []).map(normalizeCloudBillingCostRow);
            const dailySeries = (dailyRows || []).map(normalizeCloudBillingSeriesRow).filter((row) => row.label);
            const monthlySeries = (monthlyRows || []).map(normalizeCloudBillingSeriesRow).filter((row) => row.label);
            const previousSummarySnap = await admin.database().ref('system/googleCloudBilling/summary').get().catch(() => null);
            const previousSummary = previousSummarySnap && previousSummarySnap.exists() ? (previousSummarySnap.val() || {}) : {};
            const hasMeaningfulCostData = serviceCosts.length > 0
                || dailySeries.some((row) => Math.abs(toSignedMoney(row.amount, 0)) > 0.000001)
                || monthlySeries.some((row) => Math.abs(toSignedMoney(row.amount, 0)) > 0.000001);
            if (!hasMeaningfulCostData) {
                exportStatus.status = 'ready_no_cost_data';
                const fallbackSummary = {
                    ...(previousSummary && typeof previousSummary === 'object' ? previousSummary : {}),
                    source: previousSummary && previousSummary.lastNotificationAt ? 'cloud-billing-budget-pubsub' : 'bigquery-billing-export-no-cost-data',
                    projectId: CLOUD_BILLING_PROJECT_ID,
                    bigQueryNoCostDataAt: nowIso,
                    bigQueryDatasetId: CLOUD_BILLING_DATASET_ID,
                    bigQueryTableId: CLOUD_BILLING_STANDARD_TABLE_ID,
                    bigQueryDays: days,
                    billingUrl: CLOUD_BILLING_LINKED_ACCOUNT_URL,
                    budgetsUrl: CLOUD_BILLING_BUDGETS_URL,
                    bigQueryExportUrl: CLOUD_BILLING_EXPORT_URL,
                    reportsUrl: CLOUD_BILLING_REPORTS_URL,
                    costBreakdownUrl: CLOUD_BILLING_COST_BREAKDOWN_URL,
                    cudAnalysisUrl: CLOUD_BILLING_CUD_ANALYSIS_URL,
                    documentsUrl: CLOUD_BILLING_DOCUMENTS_URL,
                    transactionsUrl: CLOUD_BILLING_TRANSACTIONS_URL
                };
                if (!toMoney(fallbackSummary.costAmount, 0) && toMoney(fallbackSummary.budgetReportedCostAmount, 0)) {
                    fallbackSummary.costAmount = toMoney(fallbackSummary.budgetReportedCostAmount, 0);
                    if (toMoney(fallbackSummary.budgetAmount, 0) > 0) {
                        fallbackSummary.usagePercent = fallbackSummary.costAmount / toMoney(fallbackSummary.budgetAmount, 0);
                    }
                }
                delete fallbackSummary.lastBigQuerySyncAt;
                delete fallbackSummary.serviceCostsUpdatedAt;
                await admin.database().ref().update({
                    'system/googleCloudBilling/exportStatus': exportStatus,
                    'system/googleCloudBilling/summary': fallbackSummary
                });
                return {
                    success: false,
                    waiting: true,
                    noCostData: true,
                    reason: 'billing_export_has_no_cost_rows',
                    exportStatus,
                    summary: fallbackSummary,
                    serviceCostsCount: 0,
                    costSeriesCount: 0,
                    monthlyCostSeriesCount: 0
                };
            }
            const currentMonthKey = new Date().toISOString().slice(0, 7).replace('-', '');
            const currentMonth = monthlySeries.find((row) => row.label === currentMonthKey) || monthlySeries[0] || null;
            const totalCost = currentMonth ? currentMonth.amount : serviceCosts.reduce((sum, item) => sum + item.netCost, 0);
            const currencyCode = (currentMonth && currentMonth.currencyCode) || (serviceCosts[0] && serviceCosts[0].currencyCode) || 'BRL';
            const budgetAmount = toMoney(previousSummary.budgetAmount || 0, 0);
            const usagePercent = budgetAmount > 0 ? Math.max(0, totalCost) / budgetAmount : toMoney(previousSummary.usagePercent || 0, 0);
            const severity = usagePercent >= 1 ? 'error' : (usagePercent >= 0.8 ? 'warning' : 'info');
            const updates = {};
            updates['system/googleCloudBilling/exportStatus'] = exportStatus;
            updates['system/googleCloudBilling/serviceCosts'] = objectByKey(serviceCosts, (row) => row.id);
            updates['system/googleCloudBilling/costSeries'] = objectByKey(dailySeries, (row) => row.label);
            updates['system/googleCloudBilling/monthlyCostSeries'] = objectByKey(monthlySeries, (row) => row.label);
            updates['system/googleCloudBilling/summary'] = {
                ...(previousSummary && typeof previousSummary === 'object' ? previousSummary : {}),
                source: previousSummary && previousSummary.lastNotificationAt ? 'cloud-billing-budget-pubsub+bigquery-export' : 'bigquery-billing-export',
                projectId: CLOUD_BILLING_PROJECT_ID,
                costAmount: toSignedMoney(totalCost, 0),
                currencyCode,
                usagePercent,
                severity,
                lastBigQuerySyncAt: nowIso,
                bigQueryDatasetId: CLOUD_BILLING_DATASET_ID,
                bigQueryTableId: CLOUD_BILLING_STANDARD_TABLE_ID,
                bigQueryDays: days,
                serviceCostsUpdatedAt: nowIso,
                billingUrl: CLOUD_BILLING_LINKED_ACCOUNT_URL,
                budgetsUrl: CLOUD_BILLING_BUDGETS_URL,
                bigQueryExportUrl: CLOUD_BILLING_EXPORT_URL,
                reportsUrl: CLOUD_BILLING_REPORTS_URL,
                costBreakdownUrl: CLOUD_BILLING_COST_BREAKDOWN_URL,
                cudAnalysisUrl: CLOUD_BILLING_CUD_ANALYSIS_URL,
                documentsUrl: CLOUD_BILLING_DOCUMENTS_URL,
                transactionsUrl: CLOUD_BILLING_TRANSACTIONS_URL
            };
            await admin.database().ref().update(updates);
            return {
                success: true,
                exportStatus,
                summary: updates['system/googleCloudBilling/summary'],
                serviceCostsCount: serviceCosts.length,
                costSeriesCount: dailySeries.length,
                monthlyCostSeriesCount: monthlySeries.length
            };
        } catch (error) {
            if (error && ['permission-denied', 'failed-precondition', 'not-found'].includes(error.code)) throw error;
            const message = String((error && error.message) || error || 'Falha ao consultar BigQuery.');
            if (/access denied|permission/i.test(message)) {
                throw new HttpsErrorV2('permission-denied', `Sem permissão para consultar BigQuery Billing Export: ${message}`);
            }
            throw new HttpsErrorV2('internal', `Falha ao sincronizar Billing Export: ${message}`);
        }
    }
);

exports.estimateGoogleCloudBillingCompanyUsageCosts = onCallV2(
    { region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' },
    async (request) => {
        if (!(await isCallerSuperAdmin(request))) {
            throw new HttpsErrorV2('permission-denied', 'Apenas SuperAdmin pode calcular custos por empresa.');
        }
        const nowIso = new Date().toISOString();
        const [summarySnap, companiesSnap, usersSnap, supportSnap] = await Promise.all([
            admin.database().ref('system/googleCloudBilling/summary').get().catch(() => null),
            admin.database().ref('companies').get().catch(() => null),
            admin.database().ref('users').get().catch(() => null),
            admin.database().ref('supportTicketsByCompany').get().catch(() => null)
        ]);
        const summary = summarySnap && summarySnap.exists() ? (summarySnap.val() || {}) : {};
        const companies = companiesSnap && companiesSnap.exists() ? (companiesSnap.val() || {}) : {};
        const users = usersSnap && usersSnap.exists() ? (usersSnap.val() || {}) : {};
        const supportTickets = supportSnap && supportSnap.exists() ? (supportSnap.val() || {}) : {};
        const baseCostAmount = Math.max(0, toSignedMoney(summary.costAmount || summary.budgetReportedCostAmount || 0, 0));
        const currencyCode = sanitizeText(summary.currencyCode || 'BRL', 'BRL');
        const source = summary.lastBigQuerySyncAt
            ? 'bigquery-billing-export'
            : (summary.lastNotificationAt ? 'cloud-billing-budget-pubsub' : 'usage-volume-only');
        const { rows, totalWeightedUsageUnits } = buildCompanyUsageCostRows(
            companies,
            users,
            supportTickets,
            baseCostAmount,
            currencyCode
        );
        const topRows = rows.slice(0, 80);
        const allocationSummary = {
            source,
            sourceCostAmount: baseCostAmount,
            currencyCode,
            companiesCount: rows.length,
            totalWeightedUsageUnits: toSignedMoney(totalWeightedUsageUnits, 0),
            weights: {
                users: 10,
                masterData: 1,
                transactions: 4,
                inventory: 2,
                payroll: 3,
                support: 2
            },
            periodLabel: summary.costIntervalStart || new Date().toISOString().slice(0, 7),
            lastCalculatedAt: nowIso,
            lastBigQuerySyncAt: summary.lastBigQuerySyncAt || '',
            lastNotificationAt: summary.lastNotificationAt || ''
        };
        const updates = {};
        updates['system/googleCloudBilling/companyUsageCostAllocation/summary'] = allocationSummary;
        updates['system/googleCloudBilling/companyUsageCostAllocation/rows'] = objectByKey(topRows, (row) => row.companyId);
        updates['system/googleCloudBilling/summary/companyUsageCostAllocationAt'] = nowIso;
        await admin.database().ref().update(updates);
        return {
            success: true,
            summary: allocationSummary,
            rows: topRows
        };
    }
);

function getSmtpRuntimeConfig() {
    const smtpHost = String(process.env.SMTP_HOST || '').trim();
    const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10) || 465;
    const smtpUser = String(process.env.SMTP_USER || '').trim();
    const smtpPass = String(readSecretValue(SMTP_PASS_SECRET) || readLocalSecretEnv('SMTP_PASS') || readLocalSecretEnv('SMTP_PASS_LOCAL') || '').trim();
    return {
        host: smtpHost || 'smtp.gmail.com',
        port: smtpPort,
        secure: smtpPort === 465,
        user: smtpUser,
        pass: smtpPass,
        ready: !!(smtpUser && smtpPass)
    };
}

async function sendSystemEmail({ to, subject, text }) {
    const recipients = Array.isArray(to) ? to : parseSupportEmailList(to);
    const cleanSubject = sanitizeSupportText(subject || '', 'Sisweb', 180);
    const cleanText = sanitizeLongText(text || '', '', 12000);
    const smtp = getSmtpRuntimeConfig();
    if (!smtp.ready) {
        throw new Error('SMTP não configurado no backend.');
    }
    if (!recipients.length || !cleanSubject || !cleanText) {
        throw new Error('Destinatário, assunto e corpo são obrigatórios.');
    }
    const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
            user: smtp.user,
            pass: smtp.pass
        }
    });
    await transporter.sendMail({
        from: `"Equipe Sisweb" <${smtp.user}>`,
        to: recipients.join(','),
        subject: cleanSubject,
        text: cleanText
    });
    return { success: true, recipients };
}

async function resolveSupportAdminEmails() {
    const envRecipients = parseSupportEmailList(process.env.SUPPORT_ADMIN_EMAIL || process.env.SUPPORT_EMAIL || '');
    if (envRecipients.length) return envRecipients;
    try {
        const settingsSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
        const settings = normalizeSubscriptionSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : {});
        const supportEmail = settings && settings.paymentMeta ? settings.paymentMeta.supportEmail : '';
        const configured = parseSupportEmailList(supportEmail);
        if (configured.length) return configured;
    } catch (_) {}
    return Array.from(SUPER_ADMIN_EMAILS).filter(Boolean);
}

function buildSupportAdminEmailBody(ticket, messagePayload, actor, event) {
    const eventLabel = event === 'created' ? 'Novo ticket criado' : 'Nova mensagem do cliente';
    return [
        `${eventLabel} no Suporte Sisweb`,
        '',
        `Ticket: ${ticket.id || messagePayload.ticketId || '-'}`,
        `Assunto: ${ticket.subject || 'Suporte Sisweb'}`,
        `Status: ${ticket.status || '-'}`,
        `Prioridade: ${ticket.priority || 'normal'}`,
        `Empresa/Tenant: ${ticket.companyName || ticket.companyId || '-'}`,
        `Módulo: ${ticket.module || '-'}`,
        `Solicitante: ${ticket.createdByName || actor.name || ticket.createdByEmail || actor.email || '-'}`,
        `E-mail: ${ticket.createdByEmail || actor.email || '-'}`,
        `Data: ${messagePayload.createdAt || new Date().toISOString()}`,
        '',
        'Mensagem:',
        messagePayload.message || ticket.lastMessagePreview || '',
        ...supportAttachmentEmailLines(messagePayload.attachments || ticket.attachments || []),
        '',
        `Abrir fila no Admin: ${SUPPORT_ADMIN_URL}`
    ].join('\n');
}

async function notifySupportAdminByEmail(ticket, messagePayload, actor, event) {
    const ticketId = sanitizeSupportText(ticket && ticket.id ? ticket.id : messagePayload && messagePayload.ticketId, '', 140);
    const notificationRef = admin.database().ref(`supportTicketNotifications/${ticketId || 'unknown'}`).push();
    const basePayload = {
        id: notificationRef.key,
        ticketId,
        companyId: sanitizeSupportText(ticket && ticket.companyId, '', 140),
        event: sanitizeSupportText(event || 'message', 'message', 60),
        channel: 'email',
        createdAt: new Date().toISOString()
    };
    try {
        const recipients = await resolveSupportAdminEmails();
        if (!recipients.length) {
            await notificationRef.set({ ...basePayload, status: 'skipped', reason: 'support_admin_email_not_configured' });
            return { success: false, skipped: true };
        }
        const subjectPrefix = event === 'created' ? 'Novo ticket' : 'Nova mensagem';
        const subject = `${subjectPrefix} Suporte Sisweb - ${ticket.subject || ticket.module || ticketId || 'Sisweb'}`;
        await sendSystemEmail({
            to: recipients,
            subject,
            text: buildSupportAdminEmailBody(ticket, messagePayload, actor, event)
        });
        await notificationRef.set({
            ...basePayload,
            status: 'sent',
            recipients: recipients.map((email) => email.replace(/^(.{2}).*(@.*)$/, '$1***$2'))
        });
        return { success: true };
    } catch (error) {
        await notificationRef.set({
            ...basePayload,
            status: 'failed',
            error: sanitizeSupportText(error && error.message ? error.message : String(error), 'Falha ao enviar e-mail', 240)
        });
        console.error('[support-email-notification]', error);
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

exports.sendPublicSupportEmail = SMTP_SECRET_RUNTIME_OPTIONS.https.onCall(async (data, context) => {
    const payload = data && typeof data === 'object' ? data : {};
    if (!context || !context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Faça login para enviar mensagem de suporte.');
    }
    const honeypot = sanitizeSupportText(payload.website || payload.companyWebsite || '', '', 200);
    if (honeypot) {
        return { success: true, skipped: true };
    }
    const message = sanitizeLongText(payload.message || '', '', 4000);
    if (!message || message.length < 8) {
        throw new functions.https.HttpsError('invalid-argument', 'Mensagem pública é obrigatória.');
    }
    const publicKey = await assertPublicSupportEmailRateLimit(context, payload);
    const recipients = await resolveSupportAdminEmails();
    if (!recipients.length) {
        throw new functions.https.HttpsError('failed-precondition', 'E-mail de suporte não configurado no backend.');
    }
    const moduleName = sanitizeSupportText(payload.module || payload.moduleName || 'Assinatura pública', 'Assinatura pública', 120);
    const subject = `Contato público Sisweb - ${moduleName}`;
    const logRef = admin.database().ref('publicSupportEmailLogs').push();
    const baseLog = {
        id: logRef.key,
        source: sanitizeSupportText(payload.source || 'subscription-public', 'subscription-public', 80),
        module: moduleName,
        url: sanitizeLongText(payload.url || '', '', 2048),
        promoCode: sanitizeSupportText(payload.promoCode || payload.coupon || '', '', 80),
        contactEmail: sanitizeSupportText(payload.email || '', '', 180),
        contactName: sanitizeSupportText(payload.name || '', '', 120),
        publicKey,
        createdAt: new Date().toISOString()
    };
    try {
        await sendSystemEmail({
            to: recipients,
            subject,
            text: buildPublicSupportEmailBody({ ...payload, message }, context, publicKey)
        });
        await logRef.set({
            ...baseLog,
            status: 'sent',
            recipients: recipients.map((email) => email.replace(/^(.{2}).*(@.*)$/, '$1***$2'))
        });
        return { success: true, sent: true };
    } catch (error) {
        await logRef.set({
            ...baseLog,
            status: 'failed',
            error: sanitizeSupportText(error && error.message ? error.message : String(error), 'Falha ao enviar e-mail', 240)
        });
        console.error('[public-support-email]', error);
        throw new functions.https.HttpsError('internal', 'Falha ao enviar e-mail público. Use WhatsApp ou tente novamente em alguns minutos.');
    }
});

async function notifySupportCustomer(ticket, messagePayload) {
    const uid = sanitizeSupportText(ticket && ticket.createdByUid, '', 140);
    if (!uid || String(messagePayload && messagePayload.visibility || 'customer') === 'internal') return;
    await pushUserNotification(uid, {
        source: 'support',
        type: 'info',
        title: 'Nova resposta do Suporte Sisweb',
        message: `Ticket ${ticket.id || ''}: ${sanitizeSupportText(messagePayload.message || '', '', 180)}`
    });
}

function normalizeSupportStatus(value, fallback = 'open') {
    const raw = String(value || '').trim().toLowerCase();
    return SUPPORT_STATUS_VALUES.has(raw) ? raw : fallback;
}

function normalizeSupportPriority(value, fallback = 'normal') {
    const raw = String(value || '').trim().toLowerCase();
    return SUPPORT_PRIORITY_VALUES.has(raw) ? raw : fallback;
}

function supportDayKey(date = new Date()) {
    return date.toISOString().slice(0, 10).replace(/-/g, '');
}

async function resolveSupportCaller(context, payload = {}, options = {}) {
    if (!context || !context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem acessar suporte.');
    }
    const uid = String(context.auth.uid || '').trim();
    const token = context.auth.token || {};
    const email = sanitizeSupportText(token.email || '', '', 180);
    const isSuperAdmin = await isCallerSuperAdmin(context);
    const userSnap = await admin.database().ref(`users/${uid}`).get();
    const userData = userSnap.exists() && userSnap.val() && typeof userSnap.val() === 'object' ? userSnap.val() : {};
    let companyId = '';
    if (isSuperAdmin && options.allowRequestedCompanyId) {
        companyId = sanitizeText(payload.companyId || payload.companyID || payload.tenantId || '', '');
    }
    if (!companyId) {
        companyId = await resolveCompanyIdForUser(uid, email, token, userData);
    }
    if (!companyId && isSuperAdmin && options.fallbackAdminCompany !== false) {
        companyId = ADMIN_CORE_COMPANY_ID;
    }
    if (!companyId) {
        throw new functions.https.HttpsError('failed-precondition', 'Usuário sem companyId/tenantId válido para suporte.');
    }
    return {
        uid,
        email: sanitizeSupportText(userData.email || email || '', '', 180),
        name: sanitizeSupportText(userData.displayName || userData.username || userData.nome || token.name || '', '', 120),
        companyId: String(companyId),
        isSuperAdmin
    };
}

async function getSupportCompanyName(companyId) {
    try {
        const snap = await admin.database().ref(`companies/${companyId}/profile`).get();
        if (snap.exists()) {
            const profile = snap.val() || {};
            return sanitizeSupportText(profile.name || profile.nome || profile.razaoSocial || profile.fantasyName || '', '', 160);
        }
    } catch (_) {}
    try {
        const snap = await admin.database().ref(`companies/${companyId}`).get();
        if (snap.exists()) {
            const company = snap.val() || {};
            return sanitizeSupportText(company.name || company.nome || company.razaoSocial || company.fantasyName || '', '', 160);
        }
    } catch (_) {}
    return '';
}

async function assertSupportRateLimit(companyId, uid, kind) {
    const safeKind = kind === 'message' ? 'message' : 'create';
    const limit = safeKind === 'message' ? SUPPORT_MESSAGE_LIMIT_PER_DAY : SUPPORT_CREATE_LIMIT_PER_DAY;
    const field = safeKind === 'message' ? 'messageCount' : 'createdCount';
    const ref = admin.database().ref(`supportTicketRateLimits/${companyId}/${uid}/${supportDayKey()}`);
    const result = await ref.transaction((current) => {
        const next = current && typeof current === 'object' ? { ...current } : {};
        const currentValue = Number(next[field] || 0);
        if (currentValue >= limit) return;
        next[field] = currentValue + 1;
        next.updatedAt = new Date().toISOString();
        return next;
    });
    if (!result.committed) {
        throw new functions.https.HttpsError('resource-exhausted', 'Limite diário de solicitações de suporte atingido.');
    }
}

function sanitizeSupportAttachmentPath(value) {
    const path = sanitizeLongText(value || '', '', 1024).replace(/^\/+/, '');
    if (!path || path.includes('..') || path.includes('//')) return '';
    if (!/^companies\/[^/]+\/support\/tickets\//.test(path)) return '';
    return path;
}

function supportAttachmentCompanyId(storagePath) {
    const match = String(storagePath || '').match(/^companies\/([^/]+)\/support\/tickets\//);
    return match ? match[1] : '';
}

function sanitizeSupportAttachmentUrl(value) {
    const raw = sanitizeLongText(value || '', '', 2048);
    if (!raw || /^(data|blob|file):/i.test(raw)) return '';
    try {
        const url = new URL(raw);
        const host = String(url.hostname || '').toLowerCase();
        const isFirebaseStorage =
            host === 'firebasestorage.googleapis.com' ||
            host === 'storage.googleapis.com' ||
            host.endsWith('.firebasestorage.app');
        if (url.protocol !== 'https:' || !isFirebaseStorage) return '';
        return raw;
    } catch (_) {
        return '';
    }
}

function normalizeSupportAttachments(value, companyId, actor) {
    const source = Array.isArray(value) ? value : (value ? [value] : []);
    if (source.length > SUPPORT_ATTACHMENT_MAX_COUNT) {
        throw new functions.https.HttpsError('invalid-argument', `Envie no máximo ${SUPPORT_ATTACHMENT_MAX_COUNT} anexos por mensagem.`);
    }
    const normalized = [];
    source.forEach((item, index) => {
        const raw = item && typeof item === 'object' ? item : {};
        const storagePath = sanitizeSupportAttachmentPath(raw.storagePath || raw.path || raw.fullPath || '');
        const pathCompanyId = supportAttachmentCompanyId(storagePath);
        if (pathCompanyId && String(pathCompanyId) !== String(companyId || '')) {
            throw new functions.https.HttpsError('permission-denied', 'Anexo pertence a outro tenant.');
        }
        const url = sanitizeSupportAttachmentUrl(raw.url || raw.downloadURL || raw.link || '');
        if (!storagePath || !url) {
            throw new functions.https.HttpsError('invalid-argument', 'Anexo de suporte inválido ou sem URL segura.');
        }
        const contentType = sanitizeSupportText(raw.contentType || raw.mimeType || '', '', 120).toLowerCase();
        if (!SUPPORT_ATTACHMENT_ALLOWED_TYPES.has(contentType)) {
            throw new functions.https.HttpsError('invalid-argument', 'Tipo de anexo não permitido para suporte.');
        }
        const size = Math.max(0, Math.round(Number(raw.size || raw.bytes || 0) || 0));
        if (size > SUPPORT_ATTACHMENT_MAX_BYTES) {
            throw new functions.https.HttpsError('invalid-argument', 'Anexo de suporte acima do limite de 6MB.');
        }
        const name = sanitizeSupportText(raw.name || raw.fileName || `anexo-${index + 1}`, `anexo-${index + 1}`, 140);
        normalized.push({
            id: crypto.createHash('sha256').update(`${storagePath}|${url}|${index}`).digest('hex').slice(0, 16),
            name,
            fileName: name,
            url,
            downloadURL: url,
            storagePath,
            contentType,
            size,
            originalSize: Math.max(0, Math.round(Number(raw.originalSize || 0) || 0)),
            compressed: raw.compressed === true || String(raw.compressed || '').toLowerCase() === 'true',
            uploadedAt: sanitizeSupportText(raw.uploadedAt || '', '', 80) || new Date().toISOString(),
            uploadedByUid: actor && actor.uid ? actor.uid : '',
            uploadedByRole: actor && actor.isSuperAdmin ? 'superadmin' : 'customer'
        });
    });
    return normalized;
}

function supportAttachmentCountLabel(count) {
    const total = Math.max(0, Number(count || 0));
    if (!total) return '';
    return `${total} anexo${total === 1 ? '' : 's'}`;
}

function supportAttachmentEmailLines(attachments) {
    const list = Array.isArray(attachments) ? attachments : [];
    if (!list.length) return [];
    return [
        '',
        'Anexos:',
        ...list.map((item, index) => {
            const name = sanitizeSupportText(item && (item.name || item.fileName), `Anexo ${index + 1}`, 140);
            const url = sanitizeSupportAttachmentUrl(item && (item.url || item.downloadURL));
            return `- ${name}${url ? `: ${url}` : ''}`;
        })
    ];
}

function publicSupportRateLimitKey(context, payload) {
    // Identidade server-side: UID do token autenticado + IP. O fingerprint enviado pelo
    // cliente (clientFingerprint) é ignorado porque pode ser rotacionado para contornar o limite.
    const uid = String(context && context.auth && context.auth.uid ? context.auth.uid : '').trim();
    const ip = normalizeRequestIp(context);
    const raw = [uid || 'anon', ip || 'no-ip'].join('|');
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

async function assertPublicSupportEmailRateLimit(context, payload) {
    const day = supportDayKey();
    const key = publicSupportRateLimitKey(context, payload);
    const ref = admin.database().ref(`publicSupportEmailRateLimits/${day}/${key}`);
    const result = await ref.transaction((current) => {
        const next = current && typeof current === 'object' ? { ...current } : {};
        const currentValue = Number(next.count || 0);
        if (currentValue >= PUBLIC_SUPPORT_EMAIL_LIMIT_PER_DAY) return;
        next.count = currentValue + 1;
        next.updatedAt = new Date().toISOString();
        return next;
    });
    if (!result.committed) {
        throw new functions.https.HttpsError('resource-exhausted', 'Limite diário de contatos públicos atingido. Use WhatsApp ou tente novamente amanhã.');
    }
    // Teto global diário: impede flood mesmo com rotação de IP/contas.
    const globalRef = admin.database().ref(`publicSupportEmailGlobalLimits/${day}`);
    const globalResult = await globalRef.transaction((current) => {
        const next = current && typeof current === 'object' ? { ...current } : {};
        const currentValue = Number(next.count || 0);
        if (currentValue >= PUBLIC_SUPPORT_EMAIL_GLOBAL_LIMIT_PER_DAY) return;
        next.count = currentValue + 1;
        next.updatedAt = new Date().toISOString();
        return next;
    });
    if (!globalResult.committed) {
        throw new functions.https.HttpsError('resource-exhausted', 'Limite diário de mensagens atingido. Use WhatsApp ou tente novamente amanhã.');
    }
    return key;
}

function buildSupportClientContext(payload, context) {
    const source = payload && payload.clientContext && typeof payload.clientContext === 'object'
        ? payload.clientContext
        : {};
    return {
        displayMode: sanitizeSupportText(source.displayMode || source.pwaMode || '', '', 40),
        viewport: sanitizeSupportText(source.viewport || '', '', 80),
        userAgent: sanitizeSupportText(source.userAgent || normalizeRequestUserAgent(context), '', 240),
        platform: sanitizeSupportText(source.platform || '', '', 80),
        language: sanitizeSupportText(source.language || '', '', 40),
        ip: normalizeRequestIp(context)
    };
}

function buildPublicSupportEmailBody(payload, context, publicKey) {
    const client = buildSupportClientContext(payload, context);
    return [
        'Contato público enviado pela Central de Mensagens Sisweb',
        '',
        `Origem: ${sanitizeSupportText(payload.source || 'subscription-public', 'subscription-public', 80)}`,
        `Módulo: ${sanitizeSupportText(payload.module || payload.moduleName || 'Assinatura pública', 'Assinatura pública', 120)}`,
        `Nome informado: ${sanitizeSupportText(payload.name || '', '-', 120)}`,
        `E-mail informado: ${sanitizeSupportText(payload.email || '', '-', 180)}`,
        `Telefone informado: ${sanitizeSupportText(payload.phone || '', '-', 80)}`,
        `URL: ${sanitizeLongText(payload.url || '', '-', 2048)}`,
        `Cupom: ${sanitizeSupportText(payload.promoCode || payload.coupon || '', '-', 80)}`,
        `Gerado em: ${new Date().toISOString()}`,
        `Origem tecnica: ${publicKey || '-'}`,
        `Viewport: ${client.viewport || '-'}`,
        `Plataforma: ${client.platform || '-'}`,
        `Idioma: ${client.language || '-'}`,
        `User-Agent: ${client.userAgent || '-'}`,
        '',
        'Mensagem:',
        sanitizeLongText(payload.message || '', '', 4000)
    ].join('\n');
}

async function appendSupportAudit(ticketId, companyId, actor, event, before, after) {
    const auditRef = admin.database().ref(`supportTicketAudit/${ticketId}`).push();
    const payload = {
        id: auditRef.key,
        event: sanitizeSupportText(event, 'updated', 60),
        ticketId,
        companyId,
        actorUid: actor.uid || '',
        actorEmail: actor.email || '',
        actorRole: actor.isSuperAdmin ? 'superadmin' : 'customer',
        before: before || null,
        after: after || null,
        createdAt: new Date().toISOString()
    };
    await auditRef.set(payload);
    return payload;
}

async function loadSupportTicketOrThrow(ticketId) {
    const safeTicketId = sanitizeText(ticketId || '', '');
    if (!safeTicketId) {
        throw new functions.https.HttpsError('invalid-argument', 'ticketId é obrigatório.');
    }
    const globalSnap = await admin.database().ref(`supportTickets/${safeTicketId}`).get();
    if (!globalSnap.exists()) {
        throw new functions.https.HttpsError('not-found', 'Ticket de suporte não encontrado.');
    }
    const globalTicket = globalSnap.val() || {};
    const companyId = sanitizeText(globalTicket.companyId || '', '');
    const ticketSnap = companyId
        ? await admin.database().ref(`supportTicketsByCompany/${companyId}/${safeTicketId}`).get()
        : null;
    const ticket = ticketSnap && ticketSnap.exists() ? ticketSnap.val() || {} : globalTicket;
    return { ticketId: safeTicketId, companyId, ticket: { ...globalTicket, ...ticket } };
}

function assertCanAccessSupportTicket(caller, ticket, options = {}) {
    if (caller.isSuperAdmin) return;
    const ticketCompanyId = String(ticket.companyId || '').trim();
    if (!ticketCompanyId || ticketCompanyId !== String(caller.companyId || '').trim()) {
        throw new functions.https.HttpsError('permission-denied', 'Ticket pertence a outro tenant.');
    }
    if (options.requireOwner !== false && String(ticket.createdByUid || '') !== String(caller.uid || '')) {
        throw new functions.https.HttpsError('permission-denied', 'Ticket pertence a outro usuário.');
    }
}

async function writeSupportTicketMirrors(ticketId, companyId, ticketPayload, globalPayload) {
    const updates = {};
    updates[`supportTicketsByCompany/${companyId}/${ticketId}`] = ticketPayload;
    updates[`supportTickets/${ticketId}`] = globalPayload;
    updates[`supportTicketsByUser/${ticketPayload.createdByUid}/${ticketId}`] = globalPayload;
    await admin.database().ref().update(updates);
}

exports.createSupportTicket = SMTP_SECRET_RUNTIME_OPTIONS.https.onCall(async (data, context) => {
    const payload = data && typeof data === 'object' ? data : {};
    const caller = await resolveSupportCaller(context, payload, { allowRequestedCompanyId: true });
    if (!caller.isSuperAdmin) await assertSupportRateLimit(caller.companyId, caller.uid, 'create');
    const subject = sanitizeSupportText(payload.subject || payload.title || payload.module || 'Suporte Sisweb', 'Suporte Sisweb', 140);
    const attachments = normalizeSupportAttachments(payload.attachments, caller.companyId, caller);
    const message = sanitizeSupportText(payload.message || '', attachments.length ? 'Anexo enviado para análise.' : '', 3000);
    if ((!message || message.length < 4) && !attachments.length) {
        throw new functions.https.HttpsError('invalid-argument', 'Mensagem de suporte é obrigatória.');
    }
    const nowIso = new Date().toISOString();
    const ticketRef = admin.database().ref(`supportTicketsByCompany/${caller.companyId}`).push();
    const ticketId = ticketRef.key;
    const companyName = await getSupportCompanyName(caller.companyId);
    const moduleName = sanitizeSupportText(payload.module || payload.moduleName || '', '', 120);
    const rawUrl = sanitizeLongText(payload.url || '', '', 2048);
    let urlHost = '';
    try { urlHost = rawUrl ? new URL(rawUrl).host : ''; } catch (_) { urlHost = ''; }
    const ticketPayload = {
        id: ticketId,
        companyId: caller.companyId,
        companyName,
        createdByUid: caller.uid,
        createdByEmail: caller.email,
        createdByName: caller.name,
        status: 'waiting_support',
        priority: normalizeSupportPriority(payload.priority),
        module: moduleName,
        path: sanitizeSupportText(payload.path || '', '', 240),
        urlHost: sanitizeSupportText(urlHost, '', 180),
        subject,
        lastMessagePreview: message.slice(0, 220),
        attachmentCount: attachments.length,
        lastAttachmentLabel: supportAttachmentCountLabel(attachments.length),
        messageCount: 1,
        assignedToUid: '',
        assignedToName: '',
        clientContext: buildSupportClientContext(payload, context),
        createdAt: nowIso,
        updatedAt: nowIso,
        closedAt: ''
    };
    const globalPayload = {
        id: ticketId,
        companyId: caller.companyId,
        companyName,
        createdByUid: caller.uid,
        createdByEmail: caller.email,
        status: ticketPayload.status,
        priority: ticketPayload.priority,
        module: ticketPayload.module,
        subject: ticketPayload.subject,
        lastMessagePreview: ticketPayload.lastMessagePreview,
        attachmentCount: attachments.length,
        lastAttachmentLabel: ticketPayload.lastAttachmentLabel,
        assignedToUid: '',
        createdAt: nowIso,
        updatedAt: nowIso
    };
    const messageRef = admin.database().ref(`supportTicketMessagesByCompany/${caller.companyId}/${ticketId}`).push();
    const messagePayload = {
        id: messageRef.key,
        ticketId,
        companyId: caller.companyId,
        authorUid: caller.uid,
        authorEmail: caller.email,
        authorName: caller.name,
        authorRole: caller.isSuperAdmin ? 'superadmin' : 'customer',
        message,
        attachments,
        visibility: 'customer',
        createdAt: nowIso
    };
    const updates = {};
    updates[`supportTicketsByCompany/${caller.companyId}/${ticketId}`] = ticketPayload;
    updates[`supportTickets/${ticketId}`] = globalPayload;
    updates[`supportTicketsByUser/${caller.uid}/${ticketId}`] = globalPayload;
    updates[`supportTicketMessagesByCompany/${caller.companyId}/${ticketId}/${messageRef.key}`] = messagePayload;
    await admin.database().ref().update(updates);
    await appendSupportAudit(ticketId, caller.companyId, caller, 'created', null, globalPayload);
    await notifySupportAdminByEmail(ticketPayload, messagePayload, caller, 'created');
    return { success: true, ticketId, ticket: ticketPayload };
});

exports.addSupportTicketMessage = SMTP_SECRET_RUNTIME_OPTIONS.https.onCall(async (data, context) => {
    const payload = data && typeof data === 'object' ? data : {};
    const { ticketId, companyId, ticket } = await loadSupportTicketOrThrow(payload.ticketId);
    const caller = await resolveSupportCaller(context, { companyId }, { allowRequestedCompanyId: true });
    assertCanAccessSupportTicket(caller, ticket);
    if (!caller.isSuperAdmin) await assertSupportRateLimit(companyId, caller.uid, 'message');
    const attachments = normalizeSupportAttachments(payload.attachments, companyId, caller);
    const message = sanitizeSupportText(payload.message || '', attachments.length ? 'Anexo enviado para análise.' : '', 3000);
    if ((!message || message.length < 2) && !attachments.length) {
        throw new functions.https.HttpsError('invalid-argument', 'Mensagem é obrigatória.');
    }
    const visibility = caller.isSuperAdmin && payload.visibility === 'internal' ? 'internal' : 'customer';
    const nowIso = new Date().toISOString();
    const nextStatus = caller.isSuperAdmin ? 'waiting_customer' : 'waiting_support';
    const messageRef = admin.database().ref(`supportTicketMessagesByCompany/${companyId}/${ticketId}`).push();
    const messagePayload = {
        id: messageRef.key,
        ticketId,
        companyId,
        authorUid: caller.uid,
        authorEmail: caller.email,
        authorName: caller.name,
        authorRole: caller.isSuperAdmin ? 'superadmin' : 'customer',
        message,
        attachments,
        visibility,
        createdAt: nowIso
    };
    const patch = {
        status: nextStatus,
        lastMessagePreview: message.slice(0, 220),
        attachmentCount: Math.max(0, Number(ticket.attachmentCount || 0)) + attachments.length,
        lastAttachmentLabel: supportAttachmentCountLabel(attachments.length) || ticket.lastAttachmentLabel || '',
        messageCount: Number(ticket.messageCount || 0) + 1,
        updatedAt: nowIso,
        closedAt: ''
    };
    const updatedTicket = { ...ticket, ...patch };
    const globalPayload = {
        id: ticketId,
        companyId,
        companyName: ticket.companyName || '',
        createdByUid: ticket.createdByUid || '',
        createdByEmail: ticket.createdByEmail || '',
        status: updatedTicket.status,
        priority: updatedTicket.priority || 'normal',
        module: updatedTicket.module || '',
        subject: updatedTicket.subject || '',
        lastMessagePreview: updatedTicket.lastMessagePreview || '',
        attachmentCount: updatedTicket.attachmentCount || 0,
        lastAttachmentLabel: updatedTicket.lastAttachmentLabel || '',
        assignedToUid: updatedTicket.assignedToUid || '',
        createdAt: updatedTicket.createdAt || '',
        updatedAt: updatedTicket.updatedAt
    };
    const updates = {};
    updates[`supportTicketMessagesByCompany/${companyId}/${ticketId}/${messageRef.key}`] = messagePayload;
    updates[`supportTicketsByCompany/${companyId}/${ticketId}`] = updatedTicket;
    updates[`supportTickets/${ticketId}`] = globalPayload;
    updates[`supportTicketsByUser/${ticket.createdByUid}/${ticketId}`] = globalPayload;
    await admin.database().ref().update(updates);
    await appendSupportAudit(ticketId, companyId, caller, visibility === 'internal' ? 'internal_note_added' : 'message_added', null, { status: nextStatus });
    if (caller.isSuperAdmin && visibility !== 'internal') {
        await notifySupportCustomer(updatedTicket, messagePayload).catch((error) => {
            console.error('[support-customer-notification]', error);
        });
    }
    if (!caller.isSuperAdmin) {
        await notifySupportAdminByEmail(updatedTicket, messagePayload, caller, 'customer_message');
    }
    return { success: true, ticketId, message: messagePayload, ticket: updatedTicket };
});

exports.listMySupportTickets = https.onCall(async (data, context) => {
    const payload = data && typeof data === 'object' ? data : {};
    if (!context || !context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem listar tickets de suporte.');
    }
    const uid = String(context.auth.uid || '').trim();
    const limit = Math.max(1, Math.min(50, parseInt(payload.limit, 10) || 25));
    const snap = await admin.database().ref(`supportTicketsByUser/${uid}`).orderByChild('updatedAt').limitToLast(limit).get();
    const items = snap.exists() ? Object.values(snap.val() || {}) : [];
    items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return { success: true, items, count: items.length };
});

exports.getSupportTicket = https.onCall(async (data, context) => {
    const payload = data && typeof data === 'object' ? data : {};
    const { ticketId, companyId, ticket } = await loadSupportTicketOrThrow(payload.ticketId);
    const caller = await resolveSupportCaller(context, { companyId }, { allowRequestedCompanyId: true });
    assertCanAccessSupportTicket(caller, ticket);
    const msgSnap = await admin.database().ref(`supportTicketMessagesByCompany/${companyId}/${ticketId}`).get();
    const messages = msgSnap.exists() ? Object.values(msgSnap.val() || {}) : [];
    let visibleMessages = caller.isSuperAdmin ? messages : messages.filter((m) => String(m.visibility || 'customer') !== 'internal');
    visibleMessages.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    visibleMessages = visibleMessages.slice(-200);
    let audit = [];
    if (caller.isSuperAdmin) {
        const auditSnap = await admin.database().ref(`supportTicketAudit/${ticketId}`).get();
        audit = auditSnap.exists() ? Object.values(auditSnap.val() || {}) : [];
        audit.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
        audit = audit.slice(-100);
    }
    return { success: true, ticket, messages: visibleMessages, audit };
});

exports.updateSupportTicketStatus = https.onCall(async (data, context) => {
    const payload = data && typeof data === 'object' ? data : {};
    const { ticketId, companyId, ticket } = await loadSupportTicketOrThrow(payload.ticketId);
    const caller = await resolveSupportCaller(context, { companyId }, { allowRequestedCompanyId: true });
    assertCanAccessSupportTicket(caller, ticket);
    const before = {
        status: ticket.status || '',
        priority: ticket.priority || '',
        assignedToUid: ticket.assignedToUid || ''
    };
    const nowIso = new Date().toISOString();
    const patch = { updatedAt: nowIso };
    if (caller.isSuperAdmin) {
        if (payload.status) patch.status = normalizeSupportStatus(payload.status, ticket.status || 'waiting_support');
        if (payload.priority) patch.priority = normalizeSupportPriority(payload.priority, ticket.priority || 'normal');
        if (payload.assignedToUid !== undefined) patch.assignedToUid = sanitizeSupportText(payload.assignedToUid, '', 120);
        if (payload.assignedToName !== undefined) patch.assignedToName = sanitizeSupportText(payload.assignedToName, '', 120);
    } else {
        const requestedStatus = normalizeSupportStatus(payload.status, '');
        if (!['closed', 'waiting_support', 'open'].includes(requestedStatus)) {
            throw new functions.https.HttpsError('permission-denied', 'Status não permitido para usuário comum.');
        }
        patch.status = requestedStatus === 'open' ? 'waiting_support' : requestedStatus;
    }
    if (patch.status === 'closed' || patch.status === 'resolved') patch.closedAt = nowIso;
    if (patch.status === 'waiting_support' || patch.status === 'waiting_customer' || patch.status === 'open') patch.closedAt = '';
    const updatedTicket = { ...ticket, ...patch };
    const globalPayload = {
        id: ticketId,
        companyId,
        companyName: updatedTicket.companyName || '',
        createdByUid: updatedTicket.createdByUid || '',
        createdByEmail: updatedTicket.createdByEmail || '',
        status: updatedTicket.status,
        priority: updatedTicket.priority || 'normal',
        module: updatedTicket.module || '',
        subject: updatedTicket.subject || '',
        lastMessagePreview: updatedTicket.lastMessagePreview || '',
        assignedToUid: updatedTicket.assignedToUid || '',
        createdAt: updatedTicket.createdAt || '',
        updatedAt: updatedTicket.updatedAt
    };
    await writeSupportTicketMirrors(ticketId, companyId, updatedTicket, globalPayload);
    await appendSupportAudit(ticketId, companyId, caller, 'status_changed', before, patch);
    return { success: true, ticket: updatedTicket };
});

exports.listSupportTicketsAdmin = https.onCall(async (data, context) => {
    await assertSuperAdmin(context, 'Apenas superadmin pode listar a fila global de suporte.');
    const payload = data && typeof data === 'object' ? data : {};
    const limit = Math.max(1, Math.min(100, parseInt(payload.limit, 10) || 50));
    const snap = await admin.database().ref('supportTickets').orderByChild('updatedAt').limitToLast(limit).get();
    let items = snap.exists() ? Object.values(snap.val() || {}) : [];
    const status = sanitizeSupportText(payload.status || '', '', 40);
    const priority = sanitizeSupportText(payload.priority || '', '', 40);
    const companyId = sanitizeSupportText(payload.companyId || payload.tenantId || '', '', 120);
    const moduleName = sanitizeSupportText(payload.module || '', '', 120).toLowerCase();
    if (status) items = items.filter((item) => String(item.status || '') === status);
    if (priority) items = items.filter((item) => String(item.priority || '') === priority);
    if (companyId) items = items.filter((item) => String(item.companyId || '') === companyId);
    if (moduleName) items = items.filter((item) => String(item.module || '').toLowerCase().includes(moduleName));
    items.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return { success: true, items, count: items.length };
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
    await applyPromoCodeIfAny(payload.promoCode, pricing, uid);
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
        proofMimeType,
        promoCode: pricing.promoCode || ''
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

function formatTrialDatePtBR(value) {
    const parsed = parseDateSafe(value);
    if (!parsed) return '';
    return parsed.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function buildAdminTrialBonusMessage(customerName, trialDays, endDateIso) {
    const name = sanitizeText(customerName || 'cliente', 'cliente');
    const endLabel = formatTrialDatePtBR(endDateIso);
    const endText = endLabel ? ` até ${endLabel}` : '';
    return `Boas notícias, ${name}! O SuperAdmin concedeu um bônus de ${trialDays} dias de acesso completo ao Sisweb${endText}. Aproveite este período para testar com calma os recursos de gestão madeireira, estoque, vendas, compras, financeiro, relatórios e rotinas do dia a dia.`;
}

function buildAdminTrialBonusEmailBody(user, trialDays, endDateIso, reviewNote) {
    const customerName = sanitizeText(user && (user.displayName || user.username || user.nome || user.realName || ''), 'cliente');
    const endLabel = formatTrialDatePtBR(endDateIso) || 'o fim do período liberado';
    const note = sanitizeText(reviewNote || '', '');
    const lines = [
        `Olá ${customerName},`,
        '',
        'Temos uma boa notícia para você.',
        '',
        `Liberamos um bônus de ${trialDays} dias de acesso completo ao Sisweb para que você possa testar o sistema com tranquilidade e conhecer melhor as ferramentas criadas para o segmento madeireiro.`,
        '',
        `Seu acesso de teste fica disponível até ${endLabel}.`,
        '',
        'Durante esse período, aproveite para avaliar:',
        '- gestão de estoque e produtos;',
        '- vendas, compras e controles comerciais;',
        '- financeiro e relatórios;',
        '- recursos para rotinas do segmento madeireiro;',
        '- acesso pelo computador e PWA no celular.',
        '',
        'Acesse o Sisweb por aqui:',
        'https://sisweb-7ce82.web.app/',
        '',
        'Se surgir qualquer dúvida durante o teste, fale conosco pela Central de Mensagens do sistema ou responda este e-mail.',
        note ? '' : null,
        note ? `Observação do atendimento: ${note}` : null,
        '',
        'Atenciosamente,',
        'Equipe Sisweb'
    ].filter((line) => line !== null);
    return lines.join('\n');
}

function isRequestOpenForAdminTrial(request) {
    const req = request && typeof request === 'object' ? request : {};
    const status = String(req.status || '').toLowerCase();
    const approvalState = String(req.approvalState || '').toLowerCase();
    return status === 'pending'
        || status === 'pending_review'
        || approvalState === 'pending_review'
        || approvalState === 'awaiting_double_confirmation';
}

async function supersedeOpenSubscriptionRequestsForAdminTrial(uid, companyId, actorUid, grantId, nowIso, reviewNote) {
    const userUid = String(uid || '').trim();
    if (!userUid) return 0;
    const snap = await admin.database().ref(`subscriptionRequests/${userUid}`).get();
    const byUid = snap.exists() ? (snap.val() || {}) : {};
    const tasks = [];
    const seen = new Set();
    const queueRequest = (requestId, request, hintedCompanyId) => {
        const reqId = String(requestId || '').trim();
        if (!reqId || seen.has(reqId)) return;
        if (!isRequestOpenForAdminTrial(request)) return;
        seen.add(reqId);
        const payload = {
            approvalState: 'superseded',
            status: 'superseded',
            supersededBy: 'admin_free_trial',
            supersededByGrantId: grantId,
            supersededAt: nowIso,
            reviewedBy: actorUid,
            reviewedAt: nowIso,
            reviewNote: reviewNote || 'Solicitação substituída por bônus Trial 30 dias concedido pelo SuperAdmin.',
            approvalChallenge: null
        };
        tasks.push((async () => {
            const requestCompanyId = await resolveCompanyIdForOperationalSync(userUid, (request && request.companyId) || hintedCompanyId || companyId || '', {}, '');
            await syncRequestInScopes(userUid, reqId, requestCompanyId, payload);
            await appendSubscriptionAuditLog(userUid, reqId, 'REQUEST_SUPERSEDED_BY_ADMIN_TRIAL', actorUid, {
                grantId,
                reviewNote
            });
        })());
    };
    Object.entries(byUid || {}).forEach(([requestId, request]) => {
        queueRequest(requestId, request, companyId);
    });
    const tenant = String(companyId || '').trim();
    if (tenant) {
        const companySnap = await admin.database().ref(`companies/${tenant}/subscriptionRequests/${userUid}`).get();
        const companyRequests = companySnap.exists() ? (companySnap.val() || {}) : {};
        Object.entries(companyRequests || {}).forEach(([requestId, request]) => {
            queueRequest(requestId, request, tenant);
        });
    }
    if (tasks.length) await Promise.all(tasks);
    return tasks.length;
}

exports.grantAdminFreeTrial = SMTP_SECRET_RUNTIME_OPTIONS.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem conceder trial administrativo.');
    }
    const callerUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode conceder trial administrativo.');
    const payload = data && typeof data === 'object' ? data : {};
    const targetUid = sanitizeText(payload.targetUid || payload.uid || '');
    const trialDays = Math.max(1, Math.min(90, parseInt(payload.days || payload.trialDays || 30, 10) || 30));
    const reviewNote = sanitizeText(payload.reviewNote || payload.note || 'Bônus comercial para testar o Sisweb por 30 dias.', '');
    if (!targetUid) {
        throw new functions.https.HttpsError('invalid-argument', 'targetUid é obrigatório.');
    }

    const userRef = admin.database().ref(`users/${targetUid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists()) {
        throw new functions.https.HttpsError('not-found', 'Usuário não encontrado para concessão de trial.');
    }
    const user = userSnap.val() || {};
    let userRecord;
    try {
        userRecord = await admin.auth().getUser(targetUid);
    } catch (error) {
        console.error('[admin-free-trial-auth-user]', {
            targetUid,
            code: error && error.code ? error.code : '',
            message: error && error.message ? error.message : String(error)
        });
        throw new functions.https.HttpsError(
            'not-found',
            'Cliente existe no banco, mas não foi localizado no Firebase Auth. Revise o cadastro antes de conceder Trial 30d.'
        );
    }
    const targetClaims = userRecord.customClaims || {};
    const targetEmail = sanitizeText(user.email || userRecord.email || '');
    const targetLooksSuperAdmin = (
        targetClaims.superadmin === true
        || isSuperAdminUidAllowed(targetUid)
        || isSuperAdminEmail(targetEmail)
        || user.superadmin === true
    );
    if (targetLooksSuperAdmin) {
        throw new functions.https.HttpsError('failed-precondition', 'Superadmin não deve receber trial de cliente.');
    }

    const existingSubscription = user.subscription && typeof user.subscription === 'object' ? user.subscription : {};
    const currentStatus = String(user.subscriptionStatus || user.status || '').toLowerCase();
    const currentEnd = parseDateSafe(existingSubscription.endDate || user.subscriptionEndDate || user.subscriptionEnd || user.trialEnd || '');
    if (currentStatus === 'active' && (!currentEnd || currentEnd.getTime() > Date.now())) {
        throw new functions.https.HttpsError('failed-precondition', 'Cliente já possui assinatura ativa. Use prorrogação se precisar estender acesso pago.');
    }
    if (currentStatus === 'trial_active' && currentEnd && currentEnd.getTime() > Date.now()) {
        return {
            success: true,
            alreadyActive: true,
            targetUid,
            status: 'trial_active',
            trialDays,
            endDate: currentEnd.toISOString(),
            emailSent: false,
            message: 'Cliente já possui trial ativo.'
        };
    }

    const now = new Date();
    const endDate = new Date(now.getTime());
    endDate.setDate(endDate.getDate() + trialDays);
    const nowIso = now.toISOString();
    const endIso = endDate.toISOString();
    const companyId = await resolveCompanyIdForUser(targetUid, targetEmail, targetClaims, user);
    const grantId = `admin-trial-${now.getTime()}`;
    const notificationMessage = buildAdminTrialBonusMessage(
        user.displayName || user.username || targetEmail,
        trialDays,
        endIso
    );
    const previousPendingPayment = user.pendingPayment && typeof user.pendingPayment === 'object'
        ? user.pendingPayment
        : null;
    const patch = {
        uid: targetUid,
        email: targetEmail,
        username: user.username || user.displayName || (targetEmail ? String(targetEmail).split('@')[0] : 'cliente'),
        displayName: user.displayName || user.username || '',
        companyId: companyId || user.companyId || '',
        trialStart: nowIso,
        trialEnd: endIso,
        trialUsed: true,
        trialConsumed: true,
        freeTrialUsed: true,
        subscriptionStart: nowIso,
        subscriptionEnd: endIso,
        subscriptionEndDate: endIso,
        subscriptionStatus: 'trial_active',
        accountStatus: 'active',
        statusReason: 'Bônus Trial 30 dias concedido pelo SuperAdmin.',
        pendingPayment: null,
        readOnlyUntil: null,
        readOnlyGrantedAt: null,
        readOnlyGrantedBy: null,
        readOnlyGraceConsumed: null,
        readOnlyReason: null,
        subscription: {
            ...existingSubscription,
            active: false,
            type: 'free_trial',
            planKey: 'free_trial',
            startDate: nowIso,
            endDate: endIso,
            trialUsed: true,
            freeTrialUsed: true,
            grantedBy: callerUid,
            grantedAt: nowIso,
            source: 'admin_grant_free_trial'
        },
        adminTrialGrant: {
            grantId,
            grantedBy: callerUid,
            grantedAt: nowIso,
            days: trialDays,
            startDate: nowIso,
            endDate: endIso,
            reviewNote,
            previousStatus: currentStatus || '',
            previousSubscriptionEndDate: currentEnd ? currentEnd.toISOString() : '',
            previousPendingPayment
        },
        updatedAt: nowIso,
        updatedBy: callerUid
    };

    let syncResult;
    try {
        syncResult = await applyUserPatchAcrossScopes(targetUid, patch, { companyId, email: targetEmail });
    } catch (error) {
        console.error('[admin-free-trial-sync]', {
            targetUid,
            companyId,
            code: error && error.code ? error.code : '',
            message: error && error.message ? error.message : String(error)
        });
        throw new functions.https.HttpsError(
            'internal',
            'Não foi possível gravar o Trial 30d no banco de dados. Tente novamente e confira os logs da Function.'
        );
    }
    const nextClaims = {
        ...targetClaims,
        subscriptionStatus: 'trial_active'
    };
    if (syncResult.companyId || companyId) {
        nextClaims.companyId = syncResult.companyId || companyId;
        nextClaims.tenantId = syncResult.companyId || companyId;
    }
    try {
        await admin.auth().setCustomUserClaims(targetUid, nextClaims);
        await admin.auth().revokeRefreshTokens(targetUid);
    } catch (error) {
        console.error('[admin-free-trial-claims]', {
            targetUid,
            companyId: syncResult.companyId || companyId || '',
            code: error && error.code ? error.code : '',
            message: error && error.message ? error.message : String(error)
        });
        throw new functions.https.HttpsError(
            'internal',
            'Trial gravado, mas houve falha ao atualizar permissões do usuário. Recarregue o painel e confira o cadastro antes de tentar novamente.'
        );
    }

    const supersededRequests = await supersedeOpenSubscriptionRequestsForAdminTrial(
        targetUid,
        syncResult.companyId || companyId || '',
        callerUid,
        grantId,
        nowIso,
        reviewNote
    );

    await pushUserNotification(targetUid, {
        type: 'success',
        title: 'Bônus Trial 30 dias liberado',
        message: notificationMessage,
        source: 'admin-free-trial'
    });

    let emailSent = false;
    let emailError = '';
    if (targetEmail) {
        try {
            await sendSystemEmail({
                to: targetEmail,
                subject: 'Bônus Sisweb: 30 dias para testar o sistema',
                text: buildAdminTrialBonusEmailBody(user, trialDays, endIso, reviewNote)
            });
            emailSent = true;
        } catch (error) {
            emailError = sanitizeText(error && error.message ? error.message : String(error), 'Falha ao enviar e-mail');
            console.warn('[admin-free-trial-email]', error);
        }
    } else {
        emailError = 'Cliente sem e-mail cadastrado.';
    }

    await appendSubscriptionAuditLog(targetUid, grantId, 'ADMIN_FREE_TRIAL_GRANTED', callerUid, {
        trialDays,
        endDate: endIso,
        companyId: syncResult.companyId || companyId || '',
        previousStatus: currentStatus || '',
        supersededRequests,
        notificationSent: true,
        emailSent,
        emailError,
        reviewNote
    });
    await admin.database().ref('adminAudit').push({
        eventType: 'ADMIN_FREE_TRIAL_GRANTED',
        actorUid: callerUid,
        targetUid,
        at: nowIso,
        details: {
            trialDays,
            endDate: endIso,
            companyId: syncResult.companyId || companyId || '',
            supersededRequests,
            emailSent,
            emailError
        }
    });

    return {
        success: true,
        targetUid,
        status: 'trial_active',
        trialDays,
        startDate: nowIso,
        endDate: endIso,
        companyId: syncResult.companyId || companyId || '',
        supersededRequests,
        notificationSent: true,
        emailSent,
        emailError
    };
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
    const activeMarker = user.subscriptionStatus === 'active' || subscription.active === true;
    const isActive = activeMarker && (!endDate || endDate.getTime() > Date.now());
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

exports.sendSubscriptionEmail = SMTP_SECRET_RUNTIME_OPTIONS.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem enviar notificações.');
    }
    await assertSuperAdmin(context, 'Apenas superadmin pode enviar notificações comerciais.');

    const payload = data || {};
    const email = String(payload.email || '').trim();
    const subject = String(payload.subject || '').trim();
    const body = String(payload.body || '').trim();
    const targetUid = sanitizeText(payload.targetUid || payload.uid || '');
    const notificationMessage = sanitizeText(payload.notificationMessage || body || '');

    if (!email || !subject || !body) {
        throw new functions.https.HttpsError('invalid-argument', 'email, subject e body são obrigatórios.');
    }

    try {
        await sendSystemEmail({ to: email, subject, text: body });
        if (targetUid) {
            await pushUserNotification(targetUid, {
                type: 'info',
                title: subject,
                message: notificationMessage,
                source: 'subscription-admin-email'
            }).catch((notificationError) => {
                console.warn('Falha ao gravar notificacao interna de assinatura:', notificationError);
            });
        }

        await admin.database().ref('adminAudit').push({
            eventType: 'SUBSCRIPTION_NOTIFICATION_SENT',
            actorUid: context.auth.uid,
            at: new Date().toISOString(),
            details: { targetEmail: email, targetUid, subject: subject, internalNotification: !!targetUid }
        });

        return { success: true, internalNotification: !!targetUid };
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        throw new functions.https.HttpsError('internal', 'Falha ao enviar e-mail. Verifique as credenciais SMTP no backend.');
    }
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

        if (pendingPayment.promoCode) {
            const code = normalizePromoCodeValue(pendingPayment.promoCode);
            if (code) {
                await admin.database().ref(`system/promocode_usage/${code}/${resolved.uid}`).set(true);
                const promoRef = admin.database().ref(`system/promocodes/${code}/currentUses`);
                await promoRef.transaction((current) => (current || 0) + 1);
            }
        }
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

function isLocalFunctionsRuntime() {
    return process.env.FUNCTIONS_EMULATOR === 'true' || process.env.FIREBASE_FUNCTIONS_EMULATOR === 'true';
}

function readLocalSecretEnv(name) {
    if (!isLocalFunctionsRuntime()) return '';
    return String(process.env[name] || '').trim();
}

function getMercadoPagoAccessToken() {
    const token = String(readSecretValue(MERCADO_PAGO_ACCESS_TOKEN_SECRET) || readLocalSecretEnv('MERCADO_PAGO_ACCESS_TOKEN_LOCAL') || '').trim();
    if (!token) {
        throw new HttpsErrorV2('failed-precondition', 'MERCADO_PAGO_ACCESS_TOKEN não configurado.');
    }
    return token;
}

function getMercadoPagoWebhookToken() {
    return String(readSecretValue(MERCADO_PAGO_WEBHOOK_TOKEN_SECRET) || readLocalSecretEnv('MERCADO_PAGO_WEBHOOK_TOKEN_LOCAL') || '').trim();
}

function getMercadoPagoWebhookUrl() {
    return String(readSecretValue(MERCADO_PAGO_WEBHOOK_URL_SECRET) || readLocalSecretEnv('MERCADO_PAGO_WEBHOOK_URL_LOCAL') || '').trim();
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
        throw new HttpsErrorV2('failed-precondition', msg);
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

async function activateSubscriptionByAutoPayment(record, providerPayment) {
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

    const paymentMethod = String(providerPayment && providerPayment.payment_type_id || record.method || 'online').toLowerCase();

    payments.push({
        date: new Date().toISOString(),
        amount: paidAmount,
        method: paymentMethod,
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
        updatedBy: 'system:auto_payment'
    };
    await applyUserPatchAcrossScopes(uid, patch, { companyId: String(record.companyId || user.companyId || '').trim(), email: String(user && user.email || '').trim() });

    // Process Promo Code Usage
    if (record.promoCode) {
        const code = normalizePromoCodeValue(record.promoCode);
        if (code) {
            await admin.database().ref(`system/promocode_usage/${code}/${uid}`).set(true);
            const promoRef = admin.database().ref(`system/promocodes/${code}/currentUses`);
            await promoRef.transaction((current) => (current || 0) + 1);
        }
    }
    await pushUserNotification(uid, {
        type: 'success',
        title: 'Pagamento confirmado',
        message: 'Seu pagamento foi confirmado automaticamente e sua assinatura está ativa.'
    });
    await appendSubscriptionAuditLog(uid, paymentId || `pay-${Date.now()}`, 'PAYMENT_AUTO_CONFIRMED', 'system:auto_payment', {
        providerPaymentId: String(providerPayment && providerPayment.id || record.providerPaymentId || ''),
        amount: paidAmount,
        plan
    });
    await appendAdminAudit('PAYMENT_AUTO_CONFIRMED', 'system:auto_payment', {
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
    let found = await findSubscriptionPaymentRecordByProviderId(providerPaymentId);
    if (!found || !found.paymentId) {
        // Tentar criar a partir dos metadados caso tenha vindo do Checkout Bricks
        const meta = providerPayment.metadata || {};
        let metaUid = meta.uid || meta.uid_ || meta.user_id;
        let metaPlan = meta.planKey || meta.plan_key || meta.plan;

        if (!metaUid && providerPayment.external_reference) {
            const parts = String(providerPayment.external_reference).split(':');
            if (parts.length >= 2) {
                metaUid = parts[0];
                metaPlan = parts[1];
            }
        }

        if (metaUid && metaPlan) {
            const paymentRef = admin.database().ref('subscriptionPayments').push();
            const paymentId = String(paymentRef.key || randomToken().slice(0, 20));
            const newRecord = {
                paymentId,
                uid: String(metaUid),
                companyId: String(meta.companyId || meta.company_id || ''),
                plan: String(metaPlan),
                amount: toMoney(providerPayment.transaction_amount || 0, 0),
                method: String(providerPayment.payment_type_id || 'bricks').toLowerCase(),
                provider: 'mercado_pago',
                providerPaymentId,
                providerStatus: String(providerPayment.status || '')
            };
            await persistSubscriptionPaymentRecord(newRecord);
            found = { paymentId, record: newRecord };
        } else {
            throw new Error('Pagamento não localizado no Sisweb e sem metadados para criação automática.');
        }
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
        await activateSubscriptionByAutoPayment(nextRecord, providerPayment);
    } else if (statusMapped === 'rejected') {
        const uid = String(nextRecord.uid || '').trim();
        if (uid) {
            await pushUserNotification(uid, {
                type: 'warning',
                title: 'Pagamento não aprovado',
                message: 'Seu pagamento online não foi aprovado. Verifique os dados e tente novamente.'
            });
        }
        await appendSubscriptionAuditLog(uid || 'unknown', String(nextRecord.paymentId || `pay-${Date.now()}`), 'PAYMENT_AUTO_REJECTED', 'system:auto_payment', {
            providerPaymentId,
            providerStatus: String(providerPayment.status || '')
        });
        await appendAdminAudit('PAYMENT_AUTO_REJECTED', 'system:auto_payment', {
            uid: uid || '',
            paymentId: String(nextRecord.paymentId || ''),
            providerPaymentId,
            providerStatus: String(providerPayment.status || '')
        });
    }
    return nextRecord;
}

async function applyPromoCodeIfAny(code, pricing, uid) {
    const safeCode = normalizePromoCodeValue(code);
    if (!safeCode) return;
    const promoRef = admin.database().ref(`system/promocodes/${safeCode}`);
    const promoSnap = await promoRef.get();
    if (!promoSnap.exists()) return;
    const promo = promoSnap.val() || {};
    if (promo.active !== true) return;
    if (promo.archived === true) return;
    if (promo.expiresAt && new Date(promo.expiresAt).getTime() < Date.now()) return;
    if (!promoAppliesToPlan(promo, pricing && pricing.planKey)) return;
    const maxUses = parseInt(promo.maxUses, 10) || 0;
    const currentUses = parseInt(promo.currentUses, 10) || 0;
    if (maxUses > 0 && currentUses >= maxUses) return;
    if (uid) {
        const usageRef = admin.database().ref(`system/promocode_usage/${safeCode}/${uid}`);
        const usageSnap = await usageRef.get();
        if (usageSnap.exists()) return;
    }

    let discountAmount = 0;
    let type = promo.type || 'percent';
    let value = parseFloat(promo.value) || 0;
    if (type === 'percent') { discountAmount = pricing.amount * (value / 100); }
    else if (type === 'fixed') { discountAmount = value; }

    pricing.amount = Math.max(0, pricing.amount - discountAmount);
    pricing.promoCode = safeCode; // Register it to deduct usages later
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
    await applyPromoCodeIfAny(payload.promoCode, pricing, uid);
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
        updatedAt: nowIso,
        promoCode: pricing.promoCode || ''
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

exports.createPaymentPreference = onCallV2({
    region: 'us-central1',
    secrets: [MERCADO_PAGO_ACCESS_TOKEN_SECRET, MERCADO_PAGO_WEBHOOK_TOKEN_SECRET, MERCADO_PAGO_WEBHOOK_URL_SECRET]
}, async (request) => {
    const data = request && typeof request.data === 'object' ? request.data : {};
    const context = request;
    if (!context || !context.auth || !context.auth.uid) {
        throw new HttpsErrorV2('unauthenticated', 'Apenas usuários autenticados podem criar preferência de pagamento.');
    }
    const uid = context.auth.uid;
    const payload = data;
    const planInput = sanitizeText(payload.plan || payload.planKey || 'monthly', 'monthly');
    const settingsSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const settings = normalizeSubscriptionSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : {});

    const userRef = admin.database().ref(`users/${uid}`);
    const userSnap = await userRef.get();
    const user = userSnap.exists() ? userSnap.val() : {};
    const email = String((user && user.email) || (context.auth.token && context.auth.token.email) || '').trim().toLowerCase();
    const companyId = await resolveCompanyIdForUser(uid, email, context.auth.token || {}, user || {});

    settings.__runtimeReferralCount = 0;
    settings.__runtimeHasReferral = false;
    settings.__runtimeIsNewClient = true;
    const pricing = resolvePricingFromSettings(planInput, settings);
    await applyPromoCodeIfAny(payload.promoCode, pricing, uid);

    const externalReference = `${uid}:${pricing.planKey}:${Date.now()}`;
    const webhookUrl = getMercadoPagoWebhookUrl();
    const webhookToken = getMercadoPagoWebhookToken();

    const mpPayload = {
        items: [
            {
                id: pricing.planKey,
                title: `Assinatura Sisweb - ${pricing.planKey}`,
                quantity: 1,
                unit_price: toMoney(pricing.amount, 0),
            }
        ],
        payer: {
            email: email || `${uid}@sisweb.local`
        },
        external_reference: externalReference
    };

    if (webhookUrl) {
        if (webhookToken) {
            const separator = webhookUrl.includes('?') ? '&' : '?';
            mpPayload.notification_url = `${webhookUrl}${separator}token=${encodeURIComponent(webhookToken)}`;
        } else {
            mpPayload.notification_url = webhookUrl;
        }
    }

    const providerPreference = await mercadoPagoApiRequest('/checkout/preferences', {
        method: 'POST',
        body: mpPayload
    });

    const preferenceId = String(providerPreference && providerPreference.id || '').trim();
    if (!preferenceId) {
        throw new HttpsErrorV2('failed-precondition', 'Mercado Pago não retornou preference_id.');
    }

    return {
        success: true,
        preferenceId,
        amount: pricing.amount
    };
});

exports.processPaymentBrick = onCallV2({
    region: 'us-central1',
    secrets: [MERCADO_PAGO_ACCESS_TOKEN_SECRET, MERCADO_PAGO_WEBHOOK_URL_SECRET, MERCADO_PAGO_WEBHOOK_TOKEN_SECRET]
}, async (request) => {
    const data = request && typeof request.data === 'object' ? request.data : {};
    const context = request;
    if (!context || !context.auth || !context.auth.uid) {
        throw new HttpsErrorV2('unauthenticated', 'Apenas usuários autenticados podem processar pagamentos.');
    }
    const uid = context.auth.uid;
    const { formData, plan } = data;

    if (!formData || !plan) {
        throw new HttpsErrorV2('invalid-argument', 'formData e plan são obrigatórios.');
    }

    // Identificar a empresa e o plano
    const userSnap = await admin.database().ref(`users/${uid}`).once('value');
    let companyId = '';
    if (userSnap.exists() && userSnap.val().companyId) {
        companyId = userSnap.val().companyId;
    }

    const settingsSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const settings = normalizeSubscriptionSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : {});
    const pricing = resolvePricingFromSettings(plan, settings);

    if (!pricing || !pricing.planKey) {
        throw new HttpsErrorV2('failed-precondition', 'Plano inválido.');
    }

    const email = context.auth.token && context.auth.token.email ? context.auth.token.email : `${uid}@sisweb.local`;
    const idempotencyKey = `brick_${uid}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const externalReference = `${uid}:${pricing.planKey}:${Date.now()}`;

    const mpPayload = {
        ...formData,
        transaction_amount: toMoney(pricing.amount, 0),
        description: `Assinatura Sisweb - ${pricing.planKey}`,
        external_reference: externalReference,
        payer: {
            ...(formData.payer || {}),
            email: formData.payer && formData.payer.email ? formData.payer.email : email
        },
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
        idempotencyKey,
        body: mpPayload
    });

    const providerPaymentId = String(providerPayment && providerPayment.id || '').trim();
    if (!providerPaymentId) {
        throw new HttpsErrorV2('failed-precondition', 'Mercado Pago não retornou ID do pagamento.');
    }

    return {
        success: true,
        paymentId: providerPaymentId,
        status: providerPayment.status,
        statusDetail: providerPayment.status_detail,
        providerPayment
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
    if (!requiredWebhookToken) {
        res.status(503).json({ success: false, error: 'webhook_token_not_configured' });
        return;
    }
    const incomingToken = String(req.get('x-sisweb-webhook-token') || (req.query && req.query.token) || '').trim();
    if (!incomingToken || incomingToken !== requiredWebhookToken) {
        res.status(401).json({ success: false, error: 'invalid_webhook_token' });
        return;
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

// ═══════════════════════════════════════════════════════════════════════════
// PROMOCODES - Validação
// ═══════════════════════════════════════════════════════════════════════════
exports.listPromoCodesAdmin = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem listar cupons.');
    }
    await assertSuperAdmin(context, 'Apenas superadmin pode listar cupons promocionais.');
    const payload = data && typeof data === 'object' ? data : {};
    const includeArchived = payload.includeArchived === true;
    const snapshot = await admin.database().ref('system/promocodes').get();
    const raw = snapshot.exists() ? snapshot.val() : {};
    const items = Object.entries(raw || {})
        .map(([id, promo]) => {
            const source = promo && typeof promo === 'object' ? promo : {};
            const code = normalizePromoCodeValue(source.code || id);
            const normalized = compactPromoCodeAuditShape({ ...source, code });
            const isExpired = !!normalized.expiresAt && new Date(normalized.expiresAt).getTime() < Date.now();
            const isExhausted = normalized.maxUses > 0 && normalized.currentUses >= normalized.maxUses;
            return {
                ...source,
                ...normalized,
                id: code,
                code,
                isExpired,
                isExhausted,
                isActive: normalized.active === true && normalized.archived !== true && !isExpired && !isExhausted,
                createdAt: source.createdAt || '',
                updatedAt: source.updatedAt || ''
            };
        })
        .filter((promo) => promo.code && (includeArchived || promo.archived !== true));
    items.sort((a, b) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime());
    return { success: true, items };
});

exports.getPromoCodeAdmin = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem consultar cupom.');
    }
    await assertSuperAdmin(context, 'Apenas superadmin pode consultar cupom promocional.');
    const payload = data && typeof data === 'object' ? data : {};
    const code = normalizePromoCodeValue(payload.code);
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'Código do cupom é obrigatório.');
    }
    const snapshot = await admin.database().ref(`system/promocodes/${code}`).get();
    if (!snapshot.exists()) {
        throw new functions.https.HttpsError('not-found', 'Cupom não encontrado.');
    }
    const promoCode = { ...(snapshot.val() || {}), code };
    return { success: true, promoCode };
});

exports.upsertPromoCodeAdmin = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem salvar cupom.');
    }
    const actorUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode salvar cupom promocional.');
    const payload = data && typeof data === 'object' ? data : {};
    const code = normalizePromoCodeValue(payload.code);
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'Código do cupom é obrigatório.');
    }
    const promoRef = admin.database().ref(`system/promocodes/${code}`);
    const beforeSnap = await promoRef.get();
    const before = beforeSnap.exists() ? beforeSnap.val() : {};
    const nextPromo = normalizePromoCodeAdminPayload({ ...payload, code }, before, actorUid);
    await promoRef.set(nextPromo);
    await appendPromoCodeAudit(beforeSnap.exists() ? 'UPDATE_PROMO_CODE' : 'CREATE_PROMO_CODE', actorUid, code, before, nextPromo);
    return { success: true, promoCode: nextPromo };
});

exports.archivePromoCodeAdmin = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem arquivar cupom.');
    }
    const actorUid = context.auth.uid;
    await assertSuperAdmin(context, 'Apenas superadmin pode arquivar cupom promocional.');
    const payload = data && typeof data === 'object' ? data : {};
    const code = normalizePromoCodeValue(payload.code);
    if (!code) {
        throw new functions.https.HttpsError('invalid-argument', 'Código do cupom é obrigatório.');
    }
    const promoRef = admin.database().ref(`system/promocodes/${code}`);
    const beforeSnap = await promoRef.get();
    if (!beforeSnap.exists()) {
        throw new functions.https.HttpsError('not-found', 'Cupom não encontrado.');
    }
    const before = beforeSnap.val() || {};
    const archivedAt = new Date().toISOString();
    const patch = {
        active: false,
        archived: true,
        archivedAt,
        archivedBy: sanitizeText(actorUid || ''),
        updatedAt: archivedAt,
        updatedBy: sanitizeText(actorUid || '')
    };
    await promoRef.update(patch);
    await appendPromoCodeAudit('ARCHIVE_PROMO_CODE', actorUid, code, before, { ...before, ...patch });
    return { success: true, code, archived: true };
});

exports.validatePromoCode = https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Apenas usuários autenticados podem validar cupons.');
    }
    const payload = data || {};
    const code = normalizePromoCodeValue(payload.code);
    const planId = String(payload.planId || payload.plan || payload.planKey || '').trim().toLowerCase();

    if (!code || !planId) {
        throw new functions.https.HttpsError('invalid-argument', 'Código e Plano são obrigatórios.');
    }

    const promoRef = admin.database().ref(`system/promocodes/${code}`);
    const promoSnap = await promoRef.get();

    if (!promoSnap.exists()) {
        throw new functions.https.HttpsError('not-found', 'Cupom inválido ou inexistente.');
    }

    const promo = promoSnap.val() || {};

    if (promo.active !== true) {
        throw new functions.https.HttpsError('failed-precondition', 'Cupom inativo.');
    }

    if (promo.archived === true) {
        throw new functions.https.HttpsError('failed-precondition', 'Cupom arquivado.');
    }

    if (!promoAppliesToPlan(promo, planId)) {
        throw new functions.https.HttpsError('failed-precondition', 'Cupom não disponível para este plano.');
    }

    if (promo.expiresAt) {
        const expires = new Date(promo.expiresAt);
        if (expires.getTime() < Date.now()) {
            throw new functions.https.HttpsError('failed-precondition', 'Cupom expirado.');
        }
    }

    const maxUses = parseInt(promo.maxUses, 10) || 0;
    const currentUses = parseInt(promo.currentUses, 10) || 0;

    if (maxUses > 0 && currentUses >= maxUses) {
        throw new functions.https.HttpsError('failed-precondition', 'Cupom esgotado.');
    }

    const uid = context.auth.uid;
    const usageRef = admin.database().ref(`system/promocode_usage/${code}/${uid}`);
    const usageSnap = await usageRef.get();

    if (usageSnap.exists()) {
        throw new functions.https.HttpsError('failed-precondition', 'Você já utilizou este cupom.');
    }

    const settingsSnapshot = await admin.database().ref(SUBSCRIPTION_SETTINGS_PATH).get();
    const settings = normalizeSubscriptionSettings(settingsSnapshot.exists() ? settingsSnapshot.val() : {});

    let listPrice = 0;
    if (planId === 'annual' || planId === 'quarterly') {
        listPrice = toMoney(settings.plans && settings.plans.quarterly ? settings.plans.quarterly.amount : 59.9, 59.9);
    } else if (planId === 'premium') {
        listPrice = toMoney(settings.plans && settings.plans.premium ? settings.plans.premium.amount : 228.0, 228.0);
    } else {
        listPrice = toMoney(settings.plans && settings.plans.monthly ? settings.plans.monthly.amount : 19.9, 19.9);
    }

    let discountAmount = 0;
    let type = promo.type || 'percent';
    let value = parseFloat(promo.value) || 0;

    if (type === 'percent') {
        discountAmount = toMoney(listPrice * (value / 100), 0);
    } else if (type === 'fixed') {
        discountAmount = toMoney(value, 0);
    }

    if (discountAmount > listPrice) {
        discountAmount = listPrice;
    }

    const finalPrice = toMoney(listPrice - discountAmount, 0);

    return {
        success: true,
        code,
        listPrice,
        discountAmount,
        finalPrice,
        type,
        value
    };
});

// ═══════════════════════════════════════════════════════════════════════════
// NF-e CLOUD FUNCTIONS — Módulo Fiscal (Sisweb)
// Assinatura XML, Envio SEFAZ, Consulta, Cancelamento, Certificado
// ═══════════════════════════════════════════════════════════════════════════
const nfFunctions = require('./nf-functions');
exports.nf_assinarXML        = nfFunctions.nf_assinarXML;
exports.nf_enviarSEFAZ       = nfFunctions.nf_enviarSEFAZ;
exports.nf_consultarNFe      = nfFunctions.nf_consultarNFe;
exports.nf_cancelarNFe       = nfFunctions.nf_cancelarNFe;
exports.nf_cartaCorrecaoNFe  = nfFunctions.nf_cartaCorrecaoNFe;
exports.nf_inutilizarNumeracao = nfFunctions.nf_inutilizarNumeracao;
exports.nf_uploadCertificadoA1 = nfFunctions.nf_uploadCertificadoA1;
exports.nf_removerCertificado = nfFunctions.nf_removerCertificado;
exports.nf_salvarReferenciaCertificado = nfFunctions.nf_salvarReferenciaCertificado;
exports.nf_salvarConfiguracaoFiscal = nfFunctions.nf_salvarConfiguracaoFiscal;
exports.nf_configurarCertNuvem = nfFunctions.nf_configurarCertNuvem;
exports.nf_obterResumoCertificadoFiscal = nfFunctions.nf_obterResumoCertificadoFiscal;
exports.nf_obterConfiguracaoFiscal = nfFunctions.nf_obterConfiguracaoFiscal;

const financeFunctions = require('./finance-functions');
financeFunctions.configure({ isCallerSuperAdmin });
exports.financeNextSequence = financeFunctions.financeNextSequence;
exports.financeCreateAccounts = financeFunctions.financeCreateAccounts;
exports.financeUpdateAccount = financeFunctions.financeUpdateAccount;
exports.financeDeleteAccount = financeFunctions.financeDeleteAccount;
exports.financeUpdatePaymentReceipt = financeFunctions.financeUpdatePaymentReceipt;
exports.financeRegisterPayment = financeFunctions.financeRegisterPayment;
exports.financeDeletePayment = financeFunctions.financeDeletePayment;
