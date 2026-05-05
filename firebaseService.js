/**
 * Firebase Service - Módulo central para interação com Firebase
 * Implementa integração EXCLUSIVA com Firebase Realtime Database
 * Versão Simplificada - SEM localStorage fallback
 */

// Importar configuração do Firebase
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, set, get, remove, child, onValue, off, push, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInAnonymously,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserSessionPersistence,
    sendPasswordResetEmail,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword as firebaseUpdatePassword
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-functions.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCF_9e067URYnB6iGnTAahPfaTMl-RQ77k",
    authDomain: "sisweb-7ce82.firebaseapp.com",
    databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sisweb-7ce82",
    storageBucket: "sisweb-7ce82.firebasestorage.app",
    messagingSenderId: "240003261222",
    appId: "1:240003261222:web:1aeaf919ddc7e5c691d7e7",
    measurementId: "G-FTC6JZ5ZGX"
};

console.log('🔧 FirebaseService usando configuração: PADRÃO');
console.log('🌐 Database URL:', firebaseConfig.databaseURL);

// Inicialização do Firebase
let app, auth, db, storage;
let firebaseInitError = null;
let _connectionMonitoringConfigured = false;

try {
    console.log("🔥 Inicializando Firebase");
    
    // Verificar apps existentes
    const existingApps = getApps();
    if (existingApps.length > 0) {
        console.log("♻️ Reutilizando app Firebase existente");
        app = existingApps[0];
    } else {
        app = initializeApp(firebaseConfig);
        console.log("✅ Firebase inicializado com sucesso");
    }

    // Inicializar serviços
    auth = getAuth(app);
    try {
        setPersistence(auth, browserSessionPersistence)
            .then(() => console.log("🔒 Persistência de autenticação definida para SESSION"))
            .catch(e => console.warn("⚠️ Falha ao definir persistência de autenticação:", e && e.message || e));
    } catch (_) {}
    db = getDatabase(app);
    storage = getStorage(app);
    
    // Configurar autenticação anônima (opcional). Desabilitada por padrão.
    try {
        if (typeof window.ENABLE_ANON_AUTH === 'undefined') {
            window.ENABLE_ANON_AUTH = false;
        }
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("🔐 Auth ativo:", user.uid);
                let isSuperAdmin = false;
                try {
                    const tokenResult = await user.getIdTokenResult(true);
                    const claims = tokenResult && tokenResult.claims ? tokenResult.claims : {};
                    isSuperAdmin = claims.superadmin === true || (window.isSuperAdminUid && typeof window.isSuperAdminUid === 'function' ? window.isSuperAdminUid(user.uid) : false);
                } catch (_) {}
                if (isSuperAdmin) {
                    setTenantId(null);
                    try {
                        localStorage.removeItem('company_info');
                        window.companyInfo = null;
                    } catch (_) {}
                    return;
                }
                let companyId = null;
                try {
                    const tokenResult = await user.getIdTokenResult();
                    const claims = tokenResult.claims;
                    companyId = claims && (claims.companyId || claims.companyID || claims.tenantId) || null;
                } catch (e) {
                    console.error("❌ Erro ao obter claims do usuário:", e);
                }
                if (!companyId) {
                    try {
                        const profileSnap = await get(child(ref(db), `users/${user.uid}`));
                        const profile = profileSnap.exists() ? profileSnap.val() : null;
                        companyId = profile && (profile.companyId || profile.companyID || profile.tenantId) || null;
                    } catch (e) {
                        console.warn("⚠️ Falha ao buscar companyId no perfil do usuário:", e);
                    }
                }
                if (companyId) {
                    const tenant = String(companyId);
                    setTenantId(tenant);
                    try {
                        const raw = localStorage.getItem('company_info');
                        const prev = raw ? JSON.parse(raw) : {};
                        const next = { ...prev, id: prev.id || tenant, companyId: tenant };
                        localStorage.setItem('company_info', JSON.stringify(next));
                        window.companyInfo = next;
                    } catch (_) {}
                } else {
                    setTenantId(null);
                    try {
                        localStorage.removeItem('company_info');
                        window.companyInfo = null;
                    } catch (_) {}
                }
            } else {
                if (window.ENABLE_ANON_AUTH === true) {
                    console.log("🔐 Nenhum usuário autenticado. Tentando login anônimo…");
                    signInAnonymously(auth)
                        .then((cred) => console.log("🔐 Login anônimo realizado:", cred?.user?.uid))
                        .catch((err) => {
                            const code = (err && err.code) || '';
                            if (String(code).includes('admin-restricted-operation')) {
                                console.warn("⚠️ Login anônimo desabilitado pelo administrador.");
                                window._AUTH_ANON_DISABLED = true;
                            } else {
                                console.error("❌ Falha no login anônimo:", err);
                            }
                        });
                } else {
                    console.log("ℹ️ Login anônimo desabilitado (config). Aguardando login do usuário.");
                    window._AUTH_ANON_DISABLED = true;
                }
                setTenantId(null);
            }
        });
    } catch (e) {
        console.warn("⚠️ Falha ao configurar autenticação anônima:", e?.message || e);
    }

    // Configurar monitoramento de conexão (integrando com manager quando disponível)
    setupConnectionMonitoring();
    
} catch (error) {
    console.error("❌ Erro ao inicializar Firebase:", error);
    firebaseInitError = error;
}

// Função para configurar monitoramento de conexão
function setupConnectionMonitoring() {
    if (_connectionMonitoringConfigured) return;
    _connectionMonitoringConfigured = true;
    console.log("🔄 Configurando monitoramento de conexão Firebase");

    try {
        // Se existir um manager global, delegar eventos a ele para evitar duplicações
        if (window.getFirebaseManager) {
            const manager = window.getFirebaseManager();
            manager.on('connected', () => {
                window.firebaseConnected = true;
                window._FIREBASE_CONNECTED = true;
                console.log('✅ Firebase conectado (via manager)');
            });
            manager.on('disconnected', () => {
                window.firebaseConnected = false;
                window._FIREBASE_CONNECTED = false;
                console.log('⚠️ Firebase offline (via manager)');
            });
            return; // Evitar listeners duplicados abaixo
        }
    } catch (e) {
        console.warn('⚠️ Falha ao integrar com FirebaseConnectionManager:', e.message);
    }

    // Fallback: monitoramento direto do RTDB
    try {
        const connectedRef = ref(db, '.info/connected');
        onValue(connectedRef, (snap) => {
            const isConnected = snap.val() === true;
            if (isConnected) {
                console.log("✅ Firebase conectado com sucesso!");
                window.firebaseConnected = true;
            } else {
                console.log("⚠️ Firebase offline");
                window.firebaseConnected = false;
            }
            window._FIREBASE_CONNECTED = isConnected;
        }, (error) => {
            console.error("❌ Erro no monitoramento de conexão:", error);
            window._FIREBASE_CONNECTED = false;
        });
    } catch (err) {
        console.error('❌ Erro configurando connectedRef:', err);
    }
}

function getTenantId() {
    try {
        const blocked = new Set([
            'users',
            'companies',
            'roles',
            'subscriptionrequests',
            'subscriptionaudit',
            'subscriptionextensionrequests',
            'subscriptionproofhashes',
            'system',
            '__no_tenant__'
        ]);
        const normalizeTenant = (value) => {
            const raw = value ? String(value).trim() : '';
            if (!raw) return null;
            if (raw.includes('/')) return null;
            if (blocked.has(raw.toLowerCase())) return null;
            return raw;
        };
        const isSessionSuperAdmin = () => {
            try {
                const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
                const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
                return !!(
                    current.superadmin === true
                    || (current.claims && current.claims.superadmin === true)
                    || persistent.superadmin === true
                    || (persistent.claims && persistent.claims.superadmin === true)
                );
            } catch (_) {
                return false;
            }
        };
        if (typeof window !== 'undefined') {
            const fromRuntime = normalizeTenant(window.appTenantId);
            if (fromRuntime) return fromRuntime;
            try {
                const currentRaw = localStorage.getItem('currentUser');
                const persistentRaw = localStorage.getItem('persistentUser');
                const current = currentRaw ? JSON.parse(currentRaw) : null;
                const persistent = persistentRaw ? JSON.parse(persistentRaw) : null;
                const fromUser = normalizeTenant((current && (current.companyId || current.companyID || current.tenantId || (current.claims && (current.claims.companyId || current.claims.companyID || current.claims.tenantId)))) || (persistent && (persistent.companyId || persistent.companyID || persistent.tenantId || (persistent.claims && (persistent.claims.companyId || persistent.claims.companyID || persistent.claims.tenantId)))));
                if (fromUser) {
                    window.appTenantId = fromUser;
                    try {
                        const cachedCompanyRaw = localStorage.getItem('company_info');
                        const nextCompanyInfo = cachedCompanyRaw ? JSON.parse(cachedCompanyRaw) : {};
                        const mergedCompanyInfo = { ...(nextCompanyInfo || {}), companyId: fromUser, id: (nextCompanyInfo && nextCompanyInfo.id) || fromUser };
                        localStorage.setItem('company_info', JSON.stringify(mergedCompanyInfo));
                    } catch (_) {}
                    return fromUser;
                }
            } catch (_) {}
            try {
                const companyRaw = localStorage.getItem('company_info');
                const companyInfo = companyRaw ? JSON.parse(companyRaw) : null;
                const fromCompany = normalizeTenant(companyInfo && (companyInfo.companyId || companyInfo.id || companyInfo.tenantId));
                if (fromCompany) {
                    if (fromCompany === 'sisweb_admin_core' && !isSessionSuperAdmin()) return null;
                    window.appTenantId = fromCompany;
                    return fromCompany;
                }
            } catch (_) {}
        }
    } catch (_) {}
    return null;
}

function setTenantId(id) {
    try {
        if (typeof window !== 'undefined') {
            const raw = id ? String(id).trim() : '';
            if (!raw || raw.includes('/')) {
                window.appTenantId = null;
                return;
            }
            const blocked = new Set([
                'users',
                'companies',
                'roles',
                'subscriptionrequests',
                'subscriptionaudit',
                'subscriptionextensionrequests',
                'subscriptionproofhashes',
                'system',
                '__no_tenant__'
            ]);
            window.appTenantId = blocked.has(raw.toLowerCase()) ? null : raw;
        }
    } catch (_) {}
}

function isTenantAuditDebugEnabled() {
    try {
        if (typeof window !== 'undefined' && window.__TENANT_AUDIT_DEBUG === true) return true;
    } catch (_) {}
    try {
        const qs = new URLSearchParams(window.location.search || '');
        const value = String(qs.get('tenantAudit') || qs.get('tenantDebug') || '').toLowerCase();
        if (value === '1' || value === 'true' || value === 'on') return true;
    } catch (_) {}
    try {
        const stored = String(localStorage.getItem('__TENANT_AUDIT_DEBUG__') || '').toLowerCase();
        if (stored === '1' || stored === 'true' || stored === 'on') return true;
    } catch (_) {}
    return false;
}

function getAuditScreenPath() {
    try {
        return window.location && window.location.pathname ? String(window.location.pathname) : 'unknown';
    } catch (_) {
        return 'unknown';
    }
}

function shouldAuditPath(path) {
    const base = String(path || '').toLowerCase();
    const screen = getAuditScreenPath().toLowerCase();
    if (screen.includes('romaneio') || screen.includes('preromaneio')) return true;
    return base.includes('romaneio') || base.includes('preromaneio');
}

function tenantAuditLog(operation, rawPath, finalPath, service = 'firebaseService') {
    try {
        if (!isTenantAuditDebugEnabled()) return;
        if (!shouldAuditPath(rawPath) && !shouldAuditPath(finalPath)) return;
        const tenant = getTenantId() || '__no_tenant__';
        const path = String(rawPath || '');
        const resolved = String(finalPath || '');
        const screen = getAuditScreenPath();
        console.log(`[AUDIT][${String(operation || '').toUpperCase()}] tenant=${tenant} path=${path} final=${resolved} screen=${screen} service=${service}`);
    } catch (_) {}
}

function getCurrentUid() {
    try {
        const user = auth && auth.currentUser ? auth.currentUser : null;
        if (user && user.uid) return String(user.uid);
        const winUser = (typeof window !== 'undefined' && window.firebaseAuthUser) ? window.firebaseAuthUser : null;
        return winUser && winUser.uid ? String(winUser.uid) : null;
    } catch (_) { return null; }
}

function resolveSubscriptionStatusForWriteGuard(userDetails) {
    const getConfiguredTrialDays = () => {
        try {
            const commercial = JSON.parse(localStorage.getItem('subscriptionSettingsCache') || 'null');
            const days = parseInt(commercial && commercial.freeTrialDays, 10);
            if (Number.isFinite(days) && days >= 0 && days <= 90) return days;
        } catch (_) {}
        return 30;
    };
    const resolveTrialStatus = (user) => {
        if (!user || !user.trialStart) return 'trial_active';
        const trialStartDate = new Date(user.trialStart);
        if (Number.isNaN(trialStartDate.getTime())) return 'trial_active';
        const diffDays = Math.ceil((new Date() - trialStartDate) / (1000 * 60 * 60 * 24));
        return diffDays <= getConfiguredTrialDays() ? 'trial_active' : 'expired';
    };
    const user = userDetails && typeof userDetails === 'object' ? userDetails : {};
    const normalized = String(user.subscriptionStatus || user.status || '').trim().toLowerCase();
    const hasStrongSignal = () => {
        if (normalized) return true;
        if (user.subscription && typeof user.subscription === 'object') return true;
        if (user.pendingPayment && typeof user.pendingPayment === 'object') return true;
        if (user.trialStart) return true;
        if (user.accountStatus) return true;
        if (user.blocked === true) return true;
        return false;
    };
    if (user.accountStatus === 'blocked' || user.blocked === true || normalized === 'blocked' || normalized === 'bloqueado') return 'blocked';
    if (normalized === 'active' || normalized === 'ativo') return 'active';
    if (normalized === 'trial_active' || normalized === 'trial' || normalized === 'teste_ativo') return resolveTrialStatus(user);
    if (user.subscription && user.subscription.active) {
        const endDate = user.subscription.endDate ? new Date(user.subscription.endDate) : null;
        if (!endDate || Number.isNaN(endDate.getTime()) || endDate > new Date()) return 'active';
        return 'expired';
    }
    if (normalized === 'pending' || normalized === 'pendente' || normalized === 'pending_payment') return 'pending';
    if (user.pendingPayment && String(user.pendingPayment.status || '').toLowerCase() === 'pending') return 'pending';
    if (normalized === 'expired' || normalized === 'expirado') return 'expired';
    if (user.trialStart) return resolveTrialStatus(user);
    if (!hasStrongSignal()) return 'unknown';
    return 'expired';
}

function isWritePathProtectedBySubscription(finalPath) {
    const path = String(finalPath || '').toLowerCase();
    return path.startsWith('companies/');
}

function validateWritePermissionBySubscription(finalPath) {
    try {
        const authUser = auth && auth.currentUser ? auth.currentUser : null;
        if (authUser && authUser.uid && authUser.uid === 'HfrQ6ObQq2aSEoeEE4Ng9jpAolB3') return { allowed: true };
        if (!isWritePathProtectedBySubscription(finalPath)) return { allowed: true };
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
        const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
        const usersRaw = JSON.parse(localStorage.getItem('users') || '[]');
        const usersList = Array.isArray(usersRaw) ? usersRaw : (usersRaw && typeof usersRaw === 'object' ? Object.values(usersRaw) : []);
        const candidates = [];
        if (Object.keys(current).length) candidates.push(current);
        if (Object.keys(persistent).length) candidates.push(persistent);
        const authUid = authUser && authUser.uid ? String(authUser.uid) : '';
        const authEmail = authUser && authUser.email ? String(authUser.email).toLowerCase() : '';
        if (usersList.length) {
            const matched = usersList.find((u) => {
                const uid = String((u && (u.uid || u.id || u.userId)) || '');
                const email = String((u && u.email) || '').toLowerCase();
                return (authUid && uid && uid === authUid) || (authEmail && email && email === authEmail);
            });
            if (matched && typeof matched === 'object') candidates.push(matched);
        }
        if (typeof window !== 'undefined' && window.currentUser && typeof window.currentUser === 'object') candidates.push(window.currentUser);
        if (authUser && typeof authUser === 'object') candidates.push(authUser);
        let finalStatus = 'unknown';
        let hasKnownStatus = false;
        for (const user of candidates) {
            const status = (typeof window !== 'undefined' && typeof window.resolveSubscriptionStatus === 'function')
                ? window.resolveSubscriptionStatus(user || {})
                : resolveSubscriptionStatusForWriteGuard(user || {});
            if (status === 'active' || status === 'trial_active') return { allowed: true };
            if (status === 'unknown') continue;
            hasKnownStatus = true;
            if (status === 'pending' || status === 'pending_grace') finalStatus = 'pending';
            else if (status === 'blocked') finalStatus = 'blocked';
            else if (status === 'expired' && (finalStatus === 'unknown' || finalStatus === 'expired')) finalStatus = 'expired';
        }
        if (!hasKnownStatus) return { allowed: true, status: 'unknown' };
        if (finalStatus === 'expired') {
            return { allowed: true, status: 'expired_soft' };
        }
        return { allowed: false, status: finalStatus };
    } catch (_) {
        return { allowed: true, status: 'unknown' };
    }
}

function denyReadOnlyWrite(path, status) {
    const reason = status || 'expired';
    const message = reason === 'pending' || reason === 'pending_grace'
        ? 'Pagamento pendente: edição indisponível até aprovação administrativa.'
        : reason === 'blocked'
            ? 'Conta bloqueada: edição indisponível.'
            : 'Assinatura expirada: edição indisponível no modo leitura.';
    try {
        if (typeof window !== 'undefined' && window.__toast) window.__toast(message, 'warning', { duration: 4500 });
    } catch (_) {}
    return { success: false, error: `${message} [${path}]` };
}

function getNamespacedPath(path) {
    try {
        if (!path || /^companies\//.test(path) || /^users\//.test(path)) return path;
        const t = getTenantId();
        if (t) return `companies/${t}/${path}`;
        return `companies/__no_tenant__/${path}`;
    } catch (_) { return path; }
}

function namespaceUpdates(updatesObj) {
    try {
        const entries = Object.entries(updatesObj || {});
        const t = getTenantId();
        if (!t) return updatesObj || {};
        const out = {};
        for (const [k, v] of entries) {
            const key = String(k);
            let ck = key
                .replace(/^contaspagar(\/|$)/, 'financas/pagar$1')
                .replace(/^contas_pagar(\/|$)/, 'financas/pagar$1')
                .replace(/^contasreceber(\/|$)/, 'financas/receber$1')
                .replace(/^contas_receber(\/|$)/, 'financas/receber$1')
                .replace(/^romaneiosPct(\/|$)/, 'romaneios/pct$1')
                .replace(/^romaneios_pct(\/|$)/, 'romaneios/pct$1')
                .replace(/^romaneiosTl(\/|$)/, 'romaneios/tl$1')
                .replace(/^romaneios_tl(\/|$)/, 'romaneios/tl$1')
                .replace(/^romaneiosTora(\/|$)/, 'romaneios/tora$1')
                .replace(/^romaneios_tora(\/|$)/, 'romaneios/tora$1')
                .replace(/^romaneiosPes(\/|$)/, 'romaneios/pes$1')
                .replace(/^romaneios_pes(\/|$)/, 'romaneios/pes$1')
                .replace(/^pedidosVenda(\/|$)/, 'vendas/pedidos$1')
                .replace(/^carregoPagamentos(\/|$)/, 'vendas/pagamentos_carrego$1');
            const nsKey = /^companies\//.test(ck) || /^users\//.test(ck)
                ? key
                : `companies/${t}/${ck}`;
            out[nsKey] = v;
        }
        return out;
    } catch (_) { return updatesObj || {}; }
}

const SUPERADMIN_UID_LOCAL_ALLOWLIST = new Set([
    'HfrQ6ObQq2aSEoeEE4Ng9jpAolB3'
]);
const permissionDeniedWarnAt = new Map();
let adminClaimSyncInFlight = null;
let adminClaimSyncLastAt = 0;
let adminClaimSyncLastSuccessAt = 0;

function isPermissionDeniedError(error) {
    const code = String((error && error.code) || '').toLowerCase();
    const message = String((error && error.message) || error || '').toLowerCase();
    return code.includes('permission-denied')
        || code.includes('permission_denied')
        || message.includes('permission denied')
        || message.includes('permission_denied');
}

function isPrivilegedAdminPath(candidatePath) {
    const normalized = String(candidatePath || '').replace(/^\/+/, '').toLowerCase();
    return normalized === 'users'
        || normalized === 'companies'
        || normalized === 'subscriptionrequests'
        || normalized === 'subscription_requests';
}

function warnPermissionDeniedThrottled(candidatePath, error) {
    const key = String(candidatePath || '').toLowerCase();
    const now = Date.now();
    const last = Number(permissionDeniedWarnAt.get(key) || 0);
    if ((now - last) < 12000) return;
    permissionDeniedWarnAt.set(key, now);
    console.warn(`⚠️ Erro ao tentar caminho ${candidatePath}:`, error && error.message ? error.message : error);
}

function isLikelySuperAdminUidSession() {
    try {
        const authUser = auth && auth.currentUser ? auth.currentUser : null;
        if (authUser && authUser.uid && SUPERADMIN_UID_LOCAL_ALLOWLIST.has(String(authUser.uid))) return true;
    } catch (_) {}
    try {
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
        const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
        const uid = String(current.uid || current.id || current.userId || persistent.uid || persistent.id || persistent.userId || '').trim();
        if (uid && SUPERADMIN_UID_LOCAL_ALLOWLIST.has(uid)) return true;
        if (uid && (current.superadmin === true || persistent.superadmin === true)) return SUPERADMIN_UID_LOCAL_ALLOWLIST.has(uid);
    } catch (_) {}
    return false;
}

async function ensurePrivilegedReadAccess() {
    const now = Date.now();
    if (adminClaimSyncInFlight) return adminClaimSyncInFlight;
    if ((now - adminClaimSyncLastSuccessAt) < 120000) return true;
    if ((now - adminClaimSyncLastAt) < 5000) return false;
    adminClaimSyncLastAt = now;
    if (!isLikelySuperAdminUidSession()) return false;
    adminClaimSyncInFlight = (async () => {
        try {
            const synced = await syncMyAdminClaims();
            if (!synced || synced.success === false) return false;
            if (auth && auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
                const token = await auth.currentUser.getIdTokenResult(true);
                const claims = token && token.claims ? token.claims : {};
                const uid = auth.currentUser && auth.currentUser.uid ? String(auth.currentUser.uid) : '';
                const allowedByUid = uid && SUPERADMIN_UID_LOCAL_ALLOWLIST.has(uid);
                if (claims.superadmin === true || allowedByUid) {
                    adminClaimSyncLastSuccessAt = Date.now();
                    return true;
                }
            }
            return false;
        } catch (_) {
            return false;
        } finally {
            adminClaimSyncInFlight = null;
        }
    })();
    return adminClaimSyncInFlight;
}

// Função auxiliar para verificar se o Firebase está operacional
export function isFirebaseOperational() {
    if (firebaseInitError) {
        return { 
            operational: false, 
            error: firebaseInitError,
            message: "Falha na inicialização do Firebase: " + firebaseInitError.message
        };
    }
    
    if (!app || !auth || !db) {
        return { 
            operational: false, 
            error: new Error("Serviços do Firebase não inicializados"),
            message: "Serviços do Firebase indisponíveis"
        };
    }
    
    return { operational: true };
}

// ✅ FUNÇÃO PRINCIPAL PARA CARREGAR DADOS DO FIREBASE
async function loadFromFirebase(path) {
    try {
        console.log(`🔥 Carregando dados de: ${path}`);
        
        // 🔁 Normalização e aliases de caminho
        const PATH_ALIASES = {
            // Romaneios TL
            'romaneiosTL': ['romaneios/tl', 'romaneios_tl', 'romaneioTL', 'romaneiosTl'],
            // Romaneios Pacotes (PCT) – somente caminho canônico e legado de leitura
            'romaneiosPct': ['romaneios/pct', 'romaneios_pct'],
            // Romaneios Tora
            'romaneiosTora': ['romaneios/tora', 'romaneios_tora', 'romaneioTora'],
            // Romaneios Pes
            'romaneiosPes': ['romaneios/pes', 'romaneios_pes'],
            // Financas
            'contasPagar': ['financas/pagar'],
            'contasReceber': ['financas/receber']
        };

        function toSnake(key) {
            return key
                .replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/__/g, '_')
                .toLowerCase();
        }

        function toSlash(key) {
            const m = key.match(/^romaneios([A-Z][a-zA-Z]*)$/);
            if (m) {
                return `romaneios/${m[1].toLowerCase()}`;
            }
            return key;
        }

        function resolveCandidatePaths(input) {
            const candidates = [];
            const seen = new Set();
            const pushUnique = (p) => { if (p && !seen.has(p)) { seen.add(p); candidates.push(p); } };
            
            // Original
            pushUnique(input);
            
            // Se for chave conhecida, adicionar aliases explícitos
            const aliases = PATH_ALIASES[input];
            if (aliases && Array.isArray(aliases)) {
                aliases.forEach(a => pushUnique(a));
            }
            
            // Variantes comuns: snake_case e caminho com barra
            const snake = toSnake(input);
            pushUnique(snake);
            const slash = toSlash(input);
            pushUnique(slash);
            
            // Para snake, também tentar como caminho com barra (romaneios_tl -> romaneios/tl)
            if (snake.startsWith('romaneios_')) {
                pushUnique(`romaneios/${snake.replace('romaneios_', '')}`);
            }
            
            return candidates;
        }
        
        const candidates = resolveCandidatePaths(path);
        const tenantId = getTenantId();
        const nsCandidates = tenantId ? candidates.map((c) => {
            const clean = String(c || '');
            if (!clean || /^companies\//.test(clean) || /^users\//.test(clean)) return clean;
            return `companies/${tenantId}/${clean}`;
        }) : [];
        const isGlobalPath = /^users(\/|$)|^subscriptionRequests(\/|$)|^companies(\/|$)|^roles(\/|$)|^system(\/|$)|^subscriptionAudit(\/|$)|^subscriptionExtensionRequests(\/|$)|^subscriptionProofHashes(\/|$)/.test(String(path || ''));
        
        // CORREÇÃO: se não for path global e !tenantId, não permitir ler da raiz absoluta!
        const finalCandidates = tenantId 
            ? (!isGlobalPath ? nsCandidates : [...candidates, ...nsCandidates])
            : (isGlobalPath ? candidates : []); 

        const deduplicatedCandidates = finalCandidates.filter((item, index, arr) => item && arr.indexOf(item) === index);
        console.log('🔍 Caminhos candidatos para Firebase:', deduplicatedCandidates);
        
        // Verificar se Firebase está operacional
        const status = isFirebaseOperational();
        if (!status.operational) {
            throw new Error(`Firebase não operacional: ${status.message}`);
        }
        
        // Carregar dados do Firebase tentando candidatos em ordem
        const dbRef = ref(db);
        let hadPermissionDenied = false;
        for (const candidate of deduplicatedCandidates) {
            try {
                tenantAuditLog('READ', path, candidate, 'firebaseService');
                // ✅ PROTEÇÃO CONTRA STACK OVERFLOW / RECURSION
                // Se o get() modular falhar, tentar o compat como fallback
                let data = null;
                let exists = false;

                try {
                    const snapshot = await get(child(dbRef, candidate));
                    exists = snapshot.exists();
                    data = snapshot.val();
                } catch (getError) {
                    if (getError.message && getError.message.includes('Maximum call stack size exceeded')) {
                        console.warn(`⚠️ Erro de recursão no SDK Modular para '${candidate}'. Tentando REST API como fallback...`);
                        
                        // Tentar REST API se o SDK falhar com stack overflow
                        try {
                            const user = auth.currentUser;
                            let token = null;
                            if (user) {
                                try { token = await user.getIdToken(); } catch (_) {}
                            }
                            
                            // Construir URL REST
                            // Remover barra inicial se houver
                            const cleanPath = candidate.startsWith('/') ? candidate.slice(1) : candidate;
                            let url = `${firebaseConfig.databaseURL}/${cleanPath}.json`;
                            if (token) {
                                url += `?auth=${token}`;
                            }
                            
                            const response = await fetch(url);
                            if (response.ok) {
                                data = await response.json();
                                exists = data !== null;
                                console.log(`✅ Dados recuperados via REST API para ${candidate}`);
                            } else {
                                throw new Error(`REST API retornou ${response.status}`);
                            }
                        } catch (restError) {
                            console.warn(`⚠️ Falha no fallback REST API:`, restError);
                            
                            // Última tentativa: SDK Compat (se disponível)
                            if (window.firebase && window.firebase.database) {
                                const snapCompat = await window.firebase.database().ref(candidate).once('value');
                                exists = snapCompat.exists();
                                data = snapCompat.val();
                            } else {
                                throw getError; // Sem compat nem REST, relançar erro original
                            }
                        }
                    } else {
                        throw getError;
                    }
                }

                if (exists) {
                    console.log(`✅ Dados carregados de ${candidate}:`, data);
                    return { success: true, data, source: 'firebase', path: candidate };
                } else {
                    console.log(`ℹ️ Nenhum dado encontrado em ${candidate}`);
                }
            } catch (e) {
                if (isPermissionDeniedError(e) && isPrivilegedAdminPath(candidate)) {
                    hadPermissionDenied = true;
                    const recovered = await ensurePrivilegedReadAccess();
                    if (recovered) {
                        try {
                            const retried = await get(child(dbRef, candidate));
                            if (retried.exists()) {
                                return { success: true, data: retried.val(), source: 'firebase', path: candidate };
                            }
                        } catch (_) {}
                    }
                    warnPermissionDeniedThrottled(candidate, e);
                    continue;
                }
                console.warn(`⚠️ Erro ao tentar caminho ${candidate}:`, e?.message || e);
            }
        }
        
        // Caminhos opcionais: podem estar vazios sem representar erro de dados
        // Inclui aliases e variantes que podem ser passados por diferentes módulos
        const OPTIONAL_EMPTY_PATHS = new Set([
            'produtos',
            'estoqueComprasMov',
            'vendas/pagamentos_carrego',
            'carregoPagamentos',           // alias camelCase usado em alguns módulos
            'vendas_pagamentos_carrego'    // alias snake_case
        ]);
        if (OPTIONAL_EMPTY_PATHS.has(path)) {
            console.log(`ℹ️ '${path}' está vazio no Firebase (comportamento esperado — nenhum dado cadastrado ainda).`);
            return { success: true, data: null, source: 'firebase' };
        }
        if (hadPermissionDenied) {
            return { success: true, data: null, source: 'firebase', permissionDenied: true };
        }
        // ⚠️ Aviso enriquecido: inclui os caminhos candidatos tentados para facilitar diagnóstico
        console.warn(`⚠️ Nenhum dos caminhos candidatos retornou dados para '${path}'. Candidatos tentados:`, deduplicatedCandidates);
        return { success: true, data: null, source: 'firebase' };

        
    } catch (error) {
        console.error(`❌ Erro ao carregar dados de ${path}:`, error);
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

async function getAll(path) {
    function normalizeMap(raw) {
        if (!raw) return {};
        if (Array.isArray(raw)) {
            const out = {};
            raw.forEach((item, index) => {
                if (!item || typeof item !== 'object') return;
                const key = item.uid || item.id || item.userId || String(index);
                out[String(key)] = item;
            });
            return out;
        }
        if (typeof raw === 'object') return raw;
        return {};
    }

    function mergeObjects(baseObj, extraObj) {
        const merged = { ...(baseObj || {}) };
        Object.entries(extraObj || {}).forEach(([key, value]) => {
            if (merged[key] && typeof merged[key] === 'object' && value && typeof value === 'object') {
                merged[key] = { ...merged[key], ...value };
            } else {
                merged[key] = value;
            }
        });
        return merged;
    }

    async function isCurrentSessionSuperAdmin() {
        try {
            if (typeof window !== 'undefined' && typeof window.isSuperAdminSession === 'function') {
                return !!(await window.isSuperAdminSession());
            }
        } catch (_) {}
        try {
            const authUser = auth && auth.currentUser ? auth.currentUser : null;
            if (authUser && typeof authUser.getIdTokenResult === 'function') {
                const token = await authUser.getIdTokenResult(true);
                const claims = token && token.claims ? token.claims : {};
                if (claims.superadmin === true) return true;
            }
        } catch (_) {}
        try {
            const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
            const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
            const uid = String(current.uid || current.id || current.userId || persistent.uid || persistent.id || persistent.userId || '').trim();
            if (!uid) return false;
            if (!SUPERADMIN_UID_LOCAL_ALLOWLIST.has(uid)) return false;
            if (current.superadmin === true || persistent.superadmin === true) return true;
            if (current.claims && current.claims.superadmin === true) return true;
            if (persistent.claims && persistent.claims.superadmin === true) return true;
            return false;
        } catch (_) {
            return false;
        }
    }

    if (path === 'companies') {
        const tenantId = getTenantId();
        const isSuperAdmin = await isCurrentSessionSuperAdmin();
        if (isSuperAdmin) return loadFromFirebase('companies');
        if (!tenantId) {
            return {
                success: true,
                data: {},
                source: 'firebase_guarded',
                meta: { path: 'companies', policy: 'onboarding_non_admin_empty', timestamp: new Date().toISOString() }
            };
        }
        const ownCompany = await loadFromFirebase(`companies/${tenantId}/profile`);
        let ownPayload = ownCompany && ownCompany.success ? ownCompany.data : null;
        if (ownPayload && typeof ownPayload === 'object') {
            ownPayload.id = tenantId; // Add ID para que lists identifiquem corretamente
        }
        const ownMap = ownPayload ? { [tenantId]: ownPayload } : {};
        return {
            success: true,
            data: ownMap,
            source: 'firebase_guarded',
            meta: { path: 'companies', policy: 'tenant_only', companyIdEffective: tenantId, timestamp: new Date().toISOString() }
        };
    }

    if (path === 'users' || path === 'subscriptionRequests') {
        const tenantId = getTenantId();
        const isSuperAdmin = await isCurrentSessionSuperAdmin();
        const loadMerged = async () => {
            const [globalResInner, tenantResInner, companiesResInner] = await Promise.all([
                loadFromFirebase(path),
                tenantId ? loadFromFirebase(`companies/${tenantId}/${path}`) : Promise.resolve({ success: true, data: null }),
                isSuperAdmin ? loadFromFirebase('companies') : Promise.resolve({ success: true, data: null })
            ]);
            const globalMapInner = normalizeMap(globalResInner && globalResInner.success ? globalResInner.data : null);
            const tenantMapInner = normalizeMap(tenantResInner && tenantResInner.success ? tenantResInner.data : null);
            const companiesMapInner = companiesResInner && companiesResInner.success && companiesResInner.data && typeof companiesResInner.data === 'object' ? companiesResInner.data : {};
            let allTenantsMapInner = { ...tenantMapInner };
            let tenantsScannedInner = tenantId ? 1 : 0;
            if (isSuperAdmin) {
                Object.entries(companiesMapInner).forEach(([companyKey, companyPayload]) => {
                    if (!companyPayload || typeof companyPayload !== 'object') return;
                    const tenantBranch = normalizeMap(companyPayload[path]);
                    if (!Object.keys(tenantBranch).length) return;
                    if (!tenantId || String(companyKey) !== String(tenantId)) tenantsScannedInner += 1;
                    allTenantsMapInner = mergeObjects(allTenantsMapInner, tenantBranch);
                });
            }
            let mergedMapInner = mergeObjects(globalMapInner, allTenantsMapInner);
            return {
                globalRes: globalResInner,
                tenantRes: tenantResInner,
                globalMap: globalMapInner,
                tenantMap: tenantMapInner,
                allTenantsMap: allTenantsMapInner,
                mergedMap: mergedMapInner,
                tenantsScanned: tenantsScannedInner
            };
        };
        let loaded = await loadMerged();
        if (!Object.keys(loaded.mergedMap).length) {
            try {
                await syncMyAdminClaims();
            } catch (_) {}
            try {
                if (auth && auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
                    await auth.currentUser.getIdTokenResult(true);
                }
            } catch (_) {}
            loaded = await loadMerged();
        }
        let mergedMap = loaded.mergedMap;
        const tenantMap = loaded.tenantMap;
        const globalMap = loaded.globalMap;
        const allTenantsMap = loaded.allTenantsMap;
        const tenantsScanned = loaded.tenantsScanned;

        if (!isSuperAdmin && tenantId && path === 'users') {
            const filtered = {};
            Object.entries(mergedMap).forEach(([uid, user]) => {
                const userCompanyId = String((user && (user.companyId || user.companyID || user.tenantId)) || '');
                if (userCompanyId === String(tenantId) || tenantMap[uid]) filtered[uid] = user;
            });
            mergedMap = filtered;
        }

        if (!isSuperAdmin && tenantId && path === 'subscriptionRequests') {
            const usersRes = await getAll('users');
            const usersMap = normalizeMap(usersRes && usersRes.success ? usersRes.data : null);
            const allowedUids = new Set(Object.keys(usersMap));
            const filtered = {};
            Object.entries(mergedMap).forEach(([uid, req]) => {
                if (allowedUids.has(uid) || tenantMap[uid]) filtered[uid] = req;
            });
            mergedMap = filtered;
        }

        const meta = {
            path,
            companyIdEffective: tenantId || '',
            isSuperAdmin,
            rootCount: Object.keys(globalMap).length,
            tenantCount: Object.keys(allTenantsMap).length,
            mergedCount: Object.keys(mergedMap).length,
            rootPath: loaded.globalRes && loaded.globalRes.path ? loaded.globalRes.path : path,
            tenantPath: loaded.tenantRes && loaded.tenantRes.path ? loaded.tenantRes.path : (tenantId ? `companies/${tenantId}/${path}` : ''),
            tenantsScanned,
            timestamp: new Date().toISOString()
        };
        try {
            if (typeof window !== 'undefined') {
                window.__siswebDataOrigin = window.__siswebDataOrigin || {};
                window.__siswebDataOrigin[path] = meta;
            }
        } catch (_) {}
        return { success: true, data: mergedMap, source: 'firebase_merged', meta };
    }
    return loadFromFirebase(path);
}

// ✅ FUNÇÃO PARA SALVAR DADOS NO FIREBASE
async function saveToFirebase(path, key, data, options) {
    try {
        console.log(`🔥 Salvando dados em: ${path}${key ? `/${key}` : ' (substituindo todos os dados)'}`);
        
        // ✅ SANITIZAÇÃO DE SEGURANÇA (CRÍTICO)
        // Garante que a regra .validate "newData.hasChild('numero')" seja satisfeita
        if (path && (path.includes('romaneios') || path.includes('romaneioTora') || path.includes('romaneioPct'))) {
            try {
                // Função auxiliar para corrigir item
                const fixItem = (item) => {
                    if (item && typeof item === 'object') {
                        // Garantir campo numero se tiver ID
                        if ((!item.numero || item.numero === '') && item.id) {
                            item.numero = String(item.id);
                            console.log(`🛡️ Auto-fix: Adicionado numero=${item.numero} ao item ${item.id}`);
                        } else if (!item.numero && !item.id) {
                            item.numero = 'AUTO-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
                        }
                        if (item.numero) item.numero = String(item.numero);
                    }
                    return item;
                };

                if (Array.isArray(data)) {
                    data = data.map(fixItem);
                } else if (data && typeof data === 'object') {
                    // Se for um único item sendo salvo (quando key é fornecida ou data é o objeto)
                    if (key) {
                        data = fixItem(data);
                    } else {
                        // Se for um mapa de itens ou um objeto único sem key
                        if (data.id) {
                             data = fixItem(data);
                        } else {
                             Object.keys(data).forEach(k => {
                                 data[k] = fixItem(data[k]);
                             });
                        }
                    }
                }
            } catch (sanitError) {
                console.warn('⚠️ Erro na sanitização de romaneios:', sanitError);
            }
        }

        // Verificar se Firebase está operacional
        const status = isFirebaseOperational();
        if (!status.operational) {
            throw new Error(`Firebase não operacional: ${status.message}`);
        }
        
        // 🔁 Normalização e aliases de caminho (mesma lógica do load)
        const PATH_ALIASES = {
            'romaneiosTL': ['romaneios/tl', 'romaneios_tl', 'romaneioTL', 'romaneiosTl'],
            'romaneiosPct': ['romaneios/pct'],
            'romaneiosTora': ['romaneios/tora', 'romaneios_tora', 'romaneioTora'],
        };

        function toSnake(key) {
            return key
                .replace(/([a-z])([A-Z])/g, '$1_$2')
                .replace(/__/g, '_')
                .toLowerCase();
        }

        function toSlash(key) {
            const m = key.match(/^romaneios([A-Z][a-zA-Z]*)$/);
            if (m) {
                return `romaneios/${m[1].toLowerCase()}`;
            }
            return key;
        }

        function resolveCandidatePaths(input) {
            const candidates = [];
            const seen = new Set();
            const pushUnique = (p) => { if (p && !seen.has(p)) { seen.add(p); candidates.push(p); } };
            
            pushUnique(input);
            const aliases = PATH_ALIASES[input];
            if (aliases && Array.isArray(aliases)) {
                aliases.forEach(a => pushUnique(a));
            }
            const snake = toSnake(input);
            pushUnique(snake);
            const slash = toSlash(input);
            pushUnique(slash);
            if (snake.startsWith('romaneios_')) {
                pushUnique(`romaneios/${snake.replace('romaneios_', '')}`);
            }
            return candidates;
        }

        // Escolher caminho ideal de escrita: usar existente ou alias canônico
        const candidates = resolveCandidatePaths(path);
        
        // Namespace candidates for checking existence
        const tenantId = getTenantId();
        const checkCandidates = tenantId ? candidates.map(c => `companies/${tenantId}/${c}`) : candidates;
        
        console.log('🧭 Caminhos candidatos para escrita Firebase:', checkCandidates);
        let writePath = path;

        // ✅ Unificação: sempre preferir caminho canônico para PCT
        const pctAliases = ['romaneiosPct', 'romaneios/pct'];
        if (pctAliases.includes(path) || candidates.includes('romaneiosPct')) {
            writePath = 'romaneios/pct';
            console.log(`✅ Caminho canônico de escrita (PCT) definido: ${writePath}`);
        } else if (String(path || '').toLowerCase() === 'clients' || candidates.some(c => String(c || '').toLowerCase() === 'clients')) {
            writePath = 'clients';
            console.log(`✅ Caminho canônico de escrita (clients) definido: ${writePath}`);
        } else if (path === 'pedidosVenda' || candidates.includes('pedidosVenda')) {
            writePath = 'vendas/pedidos';
            console.log(`✅ Caminho de escrita (pedidosVenda) definido: ${writePath}`);
        } else if (path === 'carregoPagamentos' || candidates.includes('carregoPagamentos')) {
            writePath = 'vendas/pagamentos_carrego';
            console.log(`✅ Caminho de escrita (carregoPagamentos) definido: ${writePath}`);
        } else {
            try {
                const dbRef = ref(db);
                // Check namespaced candidates
                for (const candidate of checkCandidates) {
                    try {
                        const snapshot = await get(child(dbRef, candidate));
                        if (snapshot.exists()) {
                            // If found, keep the full path (it's already namespaced)
                            writePath = candidate; 
                            console.log(`✅ Caminho de escrita resolvido para: ${writePath}`);
                            break;
                        }
                    } catch (e) {
                        // Ignore permission denied during check - it just means we can't read it to verify existence
                        // We will proceed with default path
                        console.warn(`⚠️ Erro ao verificar caminho ${candidate} para escrita:`, e?.message || e);
                    }
                }
            } catch (_) {}
            
            // Se nenhum existente encontrado, preferir snake_case para romaneios (mas manter lógica original de path relativo)
            if (writePath === path) {
                const snakePreferred = candidates.find(c => c.includes('romaneios_'));
                if (snakePreferred) {
                    writePath = snakePreferred;
                    console.log(`ℹ️ Usando alias preferido para escrita: ${writePath}`);
                }
            }
        }
        
        let reference;
        let resultKey;
        let usedRestWriteFallback = false;
        const setWithFallback = async (referenceToSet, payload, pathForRest) => {
            try {
                await set(referenceToSet, payload);
                return;
            } catch (setError) {
                const message = String((setError && setError.message) || setError || '');
                if (!message.includes('Maximum call stack size exceeded')) throw setError;
                console.warn(`⚠️ Erro de recursão no set() para '${pathForRest}'. Tentando REST API como fallback...`);
                const user = auth.currentUser;
                let token = null;
                if (user) {
                    try { token = await user.getIdToken(); } catch (_) {}
                }
                const cleanPath = String(pathForRest || '').replace(/^\/+/, '');
                let url = `${firebaseConfig.databaseURL}/${cleanPath}.json`;
                if (token) url += `?auth=${token}`;
                const response = await fetch(url, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!response.ok) {
                    throw new Error(`REST fallback write falhou (${response.status}) em ${cleanPath}`);
                }
                usedRestWriteFallback = true;
                console.log(`✅ Dados salvos via REST fallback em ${cleanPath}`);
            }
        };
        
        if (key === null || key === undefined) {
            // Se key é null, avaliar substituição completa vs. salvamento por registro
            const perRecordNames = new Set(['romaneiosPct', 'contasReceber', 'contasPagar']);
            const lastSegment = (writePath || '').split('/').pop();
            if (Array.isArray(data) && perRecordNames.has(lastSegment)) {
                // ✅ Evitar sobrescrever coleção inteira: salvar item a item
                const finalWritePath = getNamespacedPath(writePath);
                const writePermission = validateWritePermissionBySubscription(finalWritePath);
                if (!writePermission.allowed) return denyReadOnlyWrite(finalWritePath, writePermission.status);
                tenantAuditLog('WRITE', path, finalWritePath, 'firebaseService');
                const baseRef = ref(db, finalWritePath);
                let ok = 0;
                for (const item of data) {
                    try {
                        const payload = { ...item };
                        Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                        if (payload && payload.id) {
                            const itemId = String(payload.id);
                            await setWithFallback(child(baseRef, itemId), payload, `${finalWritePath}/${itemId}`);
                            ok++;
                        } else {
                            const pushRef = push(baseRef);
                            await setWithFallback(pushRef, payload, `${finalWritePath}/${pushRef.key}`);
                            ok++;
                        }
                    } catch (e) {
                        console.warn('⚠️ Falha ao salvar item por registro:', e?.message || e);
                    }
                }
                resultKey = writePath;
                console.log(`✅ ${ok} item(s) salvos em ${writePath} (por registro)`);
            } else {
                // Substituir todos os dados no path
                const finalWritePath = getNamespacedPath(writePath);
                const writePermission = validateWritePermissionBySubscription(finalWritePath);
                if (!writePermission.allowed) return denyReadOnlyWrite(finalWritePath, writePermission.status);
                tenantAuditLog('WRITE', path, finalWritePath, 'firebaseService');
                reference = ref(db, finalWritePath);
                await setWithFallback(reference, data, finalWritePath);
                resultKey = writePath;
                console.log(`✅ Dados salvos em ${writePath} (substituição completa)`);
            }
        } else if (key === 'auto' || key === true) {
            // Se key é 'auto' ou true, usar push para gerar chave automática
            const finalWritePath = getNamespacedPath(writePath);
            const writePermission = validateWritePermissionBySubscription(finalWritePath);
            if (!writePermission.allowed) return denyReadOnlyWrite(finalWritePath, writePermission.status);
            tenantAuditLog('WRITE', path, finalWritePath, 'firebaseService');
            reference = ref(db, finalWritePath);
            const pushRef = push(reference);
            await setWithFallback(pushRef, data, `${finalWritePath}/${pushRef.key}`);
            resultKey = pushRef.key;
            console.log(`✅ Dados salvos em ${writePath} com chave auto-gerada: ${resultKey}`);
        } else {
            // Se key é fornecida, usar set no caminho específico
            const finalWritePath = `${getNamespacedPath(writePath)}/${key}`;
            const writePermission = validateWritePermissionBySubscription(finalWritePath);
            if (!writePermission.allowed) return denyReadOnlyWrite(finalWritePath, writePermission.status);
            tenantAuditLog('WRITE', path, finalWritePath, 'firebaseService');
            reference = ref(db, finalWritePath);
            await setWithFallback(reference, data, finalWritePath);
            resultKey = key;
            console.log(`✅ Dados salvos em ${writePath}/${key}`);
        }
        
        return {
            success: true,
            key: resultKey,
            source: usedRestWriteFallback ? 'firebase_rest_fallback' : 'firebase'
        };
        
    } catch (error) {
        console.error(`❌ Erro ao salvar dados em ${path}:`, error);
        
        // Tratamento específico para PERMISSION_DENIED
        if (error.code === 'PERMISSION_DENIED' || error.message.includes('permission_denied')) {
            console.error('🛑 ERRO DE PERMISSÃO: Verifique se o usuário tem companyId e se os dados (ex: numero) estão válidos.');
            
            // Tentar diagnosticar o problema
            const t = getTenantId();
            if (!t) console.warn('⚠️ TenantId (companyId) não identificado no cliente.');
            else console.log(`ℹ️ TenantId atual: ${t}`);
            const retried = !!(options && options.__claimRetryDone);
            if (!retried) {
                try {
                    const currentUid = auth && auth.currentUser && auth.currentUser.uid ? String(auth.currentUser.uid) : '';
                    if (currentUid && t && typeof setCompanyClaim === 'function') {
                        const claimSync = await setCompanyClaim(currentUid, t);
                        if (claimSync && claimSync.success) {
                            try {
                                if (auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
                                    await auth.currentUser.getIdTokenResult(true);
                                }
                            } catch (_) {}
                            return await saveToFirebase(path, key, data, { __claimRetryDone: true });
                        }
                    }
                } catch (retryError) {
                    console.warn('⚠️ Falha ao sincronizar claim para retry de escrita:', retryError && retryError.message ? retryError.message : retryError);
                }
            }
        }

        return {
            success: false,
            error: error.message
        };
    }
}

async function updatePaths(updatesObj) {
    try {
        const tenantId = getTenantId();
        if (!tenantId) {
            console.warn('⚠️ updatePaths abortado: tenantId não identificado para namespace.');
            return { success: false, error: 'tenantId indisponível' };
        }
        
        const status = isFirebaseOperational();
        if (!status.operational) {
            throw new Error(`Firebase não operacional: ${status.message}`);
        }
        const baseRef = ref(db);
        const ns = namespaceUpdates(updatesObj);
        for (const key of Object.keys(ns || {})) {
            const writePermission = validateWritePermissionBySubscription(key);
            if (!writePermission.allowed) return denyReadOnlyWrite(key, writePermission.status);
        }
        await update(baseRef, ns);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function setCompanyClaim(targetUid, companyId) {
    try {
        if (!targetUid || !companyId) {
            throw new Error('targetUid e companyId são obrigatórios');
        }
        return await callAdminCallableWithRetry('setCompanyClaim', { targetUid, companyId });
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function createCompanyOnboarding(companyPayload) {
    try {
        const payload = companyPayload && typeof companyPayload === 'object' ? companyPayload : {};
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'createCompanyOnboarding');
        const result = await callable({ company: payload });
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function reconcileSuperAdminClaims(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('reconcileSuperAdminClaims', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function syncMyAdminClaims() {
    try {
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'syncMyAdminClaims');
        const result = await callable({});
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function callAdminCallableWithRetry(functionName, payload) {
    const functions = getFunctions(app);
    const data = payload && typeof payload === 'object' ? payload : {};
    const run = async () => {
        const callable = httpsCallable(functions, functionName);
        const result = await callable(data);
        return { success: true, data: result && result.data ? result.data : null };
    };
    try {
        return await run();
    } catch (firstError) {
        const message = String((firstError && firstError.message) || '').toLowerCase();
        const code = String((firstError && firstError.code) || '').toLowerCase();
        const maybePermDenied = message.includes('permission') || code.includes('permission-denied') || code.includes('functions/permission-denied');
        const maybeNetwork = message.includes('failed to fetch') || message.includes('cors') || code.includes('functions/unavailable');
        if (maybeNetwork) {
            return { success: false, error: `Função administrativa indisponível (${functionName}). Verifique deploy das Cloud Functions e CORS.` };
        }
        if (!maybePermDenied) {
            return { success: false, error: firstError && firstError.message ? firstError.message : String(firstError) };
        }
        try {
            if (auth && auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
                await auth.currentUser.getIdTokenResult(true);
            }
        } catch (_) {}
        try {
            await syncMyAdminClaims();
        } catch (_) {}
        try {
            if (auth && auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
                await auth.currentUser.getIdTokenResult(true);
            }
        } catch (_) {}
        try {
            return await run();
        } catch (secondError) {
            return { success: false, error: secondError && secondError.message ? secondError.message : String(secondError) };
        }
    }
}

async function auditAdminClaimsInconsistencies(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('auditAdminClaimsInconsistencies', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function setUserAccessStatus(targetUid, status, reason) {
    try {
        if (!targetUid || !status) {
            throw new Error('targetUid e status são obrigatórios');
        }
        return await callAdminCallableWithRetry('setUserAccessStatus', { targetUid, status, reason: reason || '' });
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function createAdminSubUser(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('createAdminSubUser', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function updateAdminSubUserPermissions(targetUid, permissions, active) {
    try {
        if (!targetUid) throw new Error('targetUid é obrigatório');
        return await callAdminCallableWithRetry('updateAdminSubUserPermissions', {
            targetUid,
            permissions: permissions || {},
            active: active !== false
        });
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function getSubscriptionSettings() {
    try {
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'getSubscriptionSettings');
        const result = await callable({});
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function upsertSubscriptionSettings(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('upsertSubscriptionSettings', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function upsertCompanyProfile(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'upsertCompanyProfile');
        const result = await callable(data);
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        const rawMessage = String(error && error.message ? error.message : error || '');
        const lower = rawMessage.toLowerCase();
        if (lower.includes('not found') || lower.includes('404')) {
            return { success: false, error: "Cloud Function 'upsertCompanyProfile' não encontrada. Faça deploy das Functions para habilitar o editor de empresas no Admin." };
        }
        if (lower.includes('cors') || lower.includes('failed to fetch') || lower.includes('network')) {
            return { success: false, error: "Falha de rede/CORS ao chamar 'upsertCompanyProfile'. Faça deploy da função e atualize o frontend para mesma região/projeto." };
        }
        return { success: false, error: rawMessage || 'Falha ao atualizar perfil da empresa via função administrativa.' };
    }
}

async function updateMyCompanyProfile(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'updateMyCompanyProfile');
        const result = await callable(data);
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        const rawMessage = String(error && error.message ? error.message : error || '');
        const lower = rawMessage.toLowerCase();
        if (lower.includes('not found') || lower.includes('404')) {
            return { success: false, error: "Cloud Function 'updateMyCompanyProfile' não encontrada. Faça deploy das Functions." };
        }
        if (lower.includes('cors') || lower.includes('failed to fetch') || lower.includes('network')) {
            return { success: false, error: "Falha de rede/CORS ao chamar 'updateMyCompanyProfile'. Verifique deploy e região das Functions." };
        }
        return { success: false, error: rawMessage || 'Falha ao atualizar perfil da sua empresa.' };
    }
}

async function submitSubscriptionRequest(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'submitSubscriptionRequest');
        const result = await callable(data);
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function createPixPayment(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'createPixPayment');
        const result = await callable(data);
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function revalidatePixPayment(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'revalidatePixPayment');
        const result = await callable(data);
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function activateFreeTrial() {
    try {
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'activateFreeTrial');
        const result = await callable({});
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function uploadSubscriptionProof(file, options = {}) {
    try {
        if (!file) throw new Error('Arquivo de comprovante não informado.');
        const uid = getCurrentUid();
        if (!uid) throw new Error('Usuário autenticado não encontrado para upload do comprovante.');
        const originalName = String(file.name || 'comprovante').replace(/[^\w.\-]+/g, '_').slice(0, 80);
        const safeName = originalName || `comprovante_${Date.now()}.bin`;
        const contentType = String(file.type || 'application/octet-stream');
        const folder = options && options.folder ? String(options.folder) : 'subscription-proofs';
        const customRef = options && options.reference ? String(options.reference) : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const path = `${folder}/${uid}/${customRef}_${safeName}`;
        const fileRef = storageRef(storage, path);
        const metadata = {
            contentType,
            customMetadata: {
                uid,
                module: 'subscription',
                uploadedAt: new Date().toISOString()
            }
        };
        await uploadBytes(fileRef, file, metadata);
        const downloadURL = await getDownloadURL(fileRef);
        return {
            success: true,
            data: {
                path,
                downloadURL,
                name: safeName,
                contentType,
                size: Number(file.size || 0)
            }
        };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function extendSubscriptionAccess(targetUid, extraDays) {
    try {
        if (!targetUid) throw new Error('targetUid é obrigatório');
        return await callAdminCallableWithRetry('extendSubscriptionAccess', { targetUid, extraDays });
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function requestSubscriptionExtension(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'requestSubscriptionExtension');
        const result = await callable(data);
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

function sanitizeUiCacheKey(key) {
    const raw = String(key || '').trim();
    if (!raw) throw new Error('cacheKey inválida');
    const normalized = raw.replace(/^\/+/, '');
    if (normalized.includes('..') || normalized.includes('//')) throw new Error('cacheKey inválida');
    if (normalized.startsWith('companies/') || normalized.startsWith('users/')) throw new Error('cacheKey deve ser relativa');
    return normalized;
}

async function saveUiCache(cacheKey, data) {
    try {
        const tenantId = getTenantId();
        const uid = getCurrentUid();
        if (!tenantId) throw new Error('tenantId ausente');
        if (!uid) throw new Error('uid ausente');
        const safeKey = sanitizeUiCacheKey(cacheKey);
        const path = `companies/${tenantId}/cache/ui/${uid}/${safeKey}`;
        return await saveToFirebase(path, null, {
            data: data === undefined ? null : data,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function loadUiCache(cacheKey) {
    try {
        const tenantId = getTenantId();
        const uid = getCurrentUid();
        if (!tenantId) throw new Error('tenantId ausente');
        if (!uid) throw new Error('uid ausente');
        const safeKey = sanitizeUiCacheKey(cacheKey);
        const path = `companies/${tenantId}/cache/ui/${uid}/${safeKey}`;
        const result = await loadFromFirebase(path);
        if (!result || result.success === false) return result;
        const payload = result.data;
        if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data')) {
            return { success: true, data: payload.data, meta: { updatedAt: payload.updatedAt || null } };
        }
        return { success: true, data: payload, meta: { updatedAt: null } };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function grantReadOnlyGrace() {
    try {
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'grantReadOnlyGrace');
        const result = await callable({});
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function getOpenExtensionRequests() {
    try {
        return await callAdminCallableWithRetry('getOpenExtensionRequests', {});
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function reviewSubscriptionExtensionRequest(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('reviewSubscriptionExtensionRequest', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function retroEnrichSubscriptionHistory(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('retroEnrichSubscriptionHistory', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function prepareSubscriptionApproval(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('prepareSubscriptionApproval', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function confirmSubscriptionApproval(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('confirmSubscriptionApproval', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function updateSubscriptionFinancialEvent(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('updateSubscriptionFinancialEvent', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function deleteSubscriptionManagedData(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('deleteSubscriptionManagedData', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function getCampaignExecutiveSummary() {
    try {
        return await callAdminCallableWithRetry('getCampaignExecutiveSummary', {});
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function getCampaignConfigAudit() {
    try {
        return await callAdminCallableWithRetry('getCampaignConfigAudit', {});
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

// Expor serviços e funções globalmente
window.firebaseService = {
    // Funções de autenticação
    authService: {
        getAuth: () => auth,
        createUserWithEmailAndPassword: createUserWithEmailAndPassword,
        signInWithEmailAndPassword: signInWithEmailAndPassword,
        signInAnonymously: signInAnonymously,
        signOut: signOut,
        onAuthStateChanged: onAuthStateChanged,
        setPersistence: setPersistence,
        browserSessionPersistence: browserSessionPersistence,
        sendPasswordResetEmail: sendPasswordResetEmail,
        getCurrentUser: () => authService.getCurrentUser(),
        getCredential: (email, password) => authService.getCredential(email, password),
        reauthenticate: (credential) => authService.reauthenticate(credential),
        updatePassword: (newPassword) => authService.updatePassword(newPassword)
    },
    // Funções de Realtime Database
    dbService: {
        getDatabase: () => db,
        ref: ref,
        set: set,
        get: get,
        remove: remove,
        child: child,
        onValue: onValue,
        off: off,
        push: push,
        update: update,
        serverTimestamp: serverTimestamp
    },
    // Funções utilitárias
    isFirebaseOperational: isFirebaseOperational,
    loadFromFirebase: loadFromFirebase,
    saveToFirebase: saveToFirebase,
    updatePaths: updatePaths,
    getTenantId: getTenantId,
    setTenantId: setTenantId,
    getCurrentUid: getCurrentUid,
    getNamespacedPath: getNamespacedPath,
    namespaceUpdates: namespaceUpdates,
    createCompanyOnboarding: createCompanyOnboarding,
    setCompanyClaim: setCompanyClaim,
    syncMyAdminClaims: syncMyAdminClaims,
    auditAdminClaimsInconsistencies: auditAdminClaimsInconsistencies,
    reconcileSuperAdminClaims: reconcileSuperAdminClaims,
    setUserAccessStatus: setUserAccessStatus,
    createAdminSubUser: createAdminSubUser,
    updateAdminSubUserPermissions: updateAdminSubUserPermissions,
    getSubscriptionSettings: getSubscriptionSettings,
    upsertSubscriptionSettings: upsertSubscriptionSettings,
    submitSubscriptionRequest: submitSubscriptionRequest,
    createPixPayment: createPixPayment,
    revalidatePixPayment: revalidatePixPayment,
    activateFreeTrial: activateFreeTrial,
    extendSubscriptionAccess: extendSubscriptionAccess,
    requestSubscriptionExtension: requestSubscriptionExtension,
    getOpenExtensionRequests: getOpenExtensionRequests,
    reviewSubscriptionExtensionRequest: reviewSubscriptionExtensionRequest,
    retroEnrichSubscriptionHistory: retroEnrichSubscriptionHistory,
    prepareSubscriptionApproval: prepareSubscriptionApproval,
    confirmSubscriptionApproval: confirmSubscriptionApproval,
    updateSubscriptionFinancialEvent: updateSubscriptionFinancialEvent,
    deleteSubscriptionManagedData: deleteSubscriptionManagedData,
    getCampaignExecutiveSummary: getCampaignExecutiveSummary,
    getCampaignConfigAudit: getCampaignConfigAudit,
    getAll: getAll
};

function parseAnyDateToISO(value) {
    try {
        if (!value) return null;
        if (value instanceof Date && !isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10);
        }
        if (typeof value === 'number' && isFinite(value)) {
            const ms = value > 1e12 ? value : value * 1000;
            const d = new Date(ms);
            if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        }
        const s = String(value).trim();
        if (!s) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
        const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (m) return `${m[3]}-${m[2]}-${m[1]}`;
        const d = new Date(s);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
        return null;
    } catch (_) {
        return null;
    }
}

function monthKeyFromRecord(rec) {
    const iso = parseAnyDateToISO(
        (rec && (rec.dataVencimento || rec.vencimento || rec.data || rec.dataVencimentoISO || rec.dtVencimento))
    );
    if (!iso) return null;
    return iso.slice(0, 7);
}

function flattenFinanceLikeNode(node, basePath) {
    const out = [];
    if (!node || typeof node !== 'object') return out;
    const monthRe = /^\d{4}-\d{2}$/;
    const keys = Object.keys(node);
    const looksMonthly = keys.some(k => monthRe.test(k));
    if (looksMonthly) {
        keys.forEach(mk => {
            if (!monthRe.test(mk)) return;
            const bucket = node[mk];
            if (!bucket || typeof bucket !== 'object') return;
            if (Array.isArray(bucket)) {
                bucket.forEach((it, idx) => {
                    if (!it || typeof it !== 'object') return;
                    const id = it.id || it.firebaseKey || String(idx);
                    out.push({ id: String(id), rec: it, srcPath: `${basePath}/${mk}/${id}` });
                });
            } else {
                Object.keys(bucket).forEach(id => {
                    const it = bucket[id];
                    if (!it || typeof it !== 'object') return;
                    out.push({ id: String(it.id || id), rec: it, srcPath: `${basePath}/${mk}/${id}` });
                });
            }
        });
        return out;
    }

    keys.forEach(id => {
        const it = node[id];
        if (!it || typeof it !== 'object') return;
        out.push({ id: String(it.id || id), rec: it, srcPath: `${basePath}/${id}` });
    });
    return out;
}

async function readRawDbPath(path) {
    try {
        const snap = await get(ref(db, path));
        return snap.exists() ? snap.val() : null;
    } catch (_) {
        return null;
    }
}

async function applyUpdatesInBatches(updates, batchSize) {
    const entries = Object.entries(updates || {});
    if (entries.length === 0) return { success: true, batches: 0 };
    const size = Math.max(1, parseInt(batchSize, 10) || 200);
    let batches = 0;
    for (let i = 0; i < entries.length; i += size) {
        const chunk = Object.fromEntries(entries.slice(i, i + size));
        const res = await updatePaths(chunk);
        if (res && res.success === false) {
            throw new Error(res.error || 'Falha ao aplicar updates');
        }
        batches += 1;
    }
    return { success: true, batches };
}

window.migrarFinanceiroLegado = async function migrarFinanceiroLegado(opts = {}) {
    const options = opts && typeof opts === 'object' ? opts : {};
    const dryRun = options.dryRun !== false;
    const deleteOld = options.deleteOld === true;
    const batchSize = options.batchSize || 200;
    const includeReceber = options.includeReceber !== false;
    const includePagar = options.includePagar !== false;
    const includeAliases = options.includeAliases !== false;

    const tenantId = getTenantId();
    if (!tenantId) {
        return { success: false, error: 'Tenant não detectado. Faça login e selecione a empresa.' };
    }

    const report = {
        success: true,
        dryRun,
        deleteOld,
        tenantId,
        receber: null,
        pagar: null
    };

    const migrateType = async ({ label, srcKeys, destKey }) => {
        const normalizedSrcKeys = Array.isArray(srcKeys) && srcKeys.length > 0 ? srcKeys : [];
        const effectiveSrcKeys = normalizedSrcKeys.length > 0
            ? normalizedSrcKeys
            : [];
        const destBase = `companies/${tenantId}/${destKey}`;

        const srcFlat = [];
        const srcByKeyCount = {};
        for (const srcKey of effectiveSrcKeys) {
            const srcBase = `companies/${tenantId}/${srcKey}`;
            const srcNode = await readRawDbPath(srcBase);
            if (!srcNode || typeof srcNode !== 'object') {
                srcByKeyCount[srcKey] = 0;
                continue;
            }
            const flat = flattenFinanceLikeNode(srcNode, srcBase);
            srcByKeyCount[srcKey] = flat.length;
            srcFlat.push(...flat);
        }

        const destNode = await readRawDbPath(destBase);
        const destObj = destNode && typeof destNode === 'object' ? destNode : {};
        const destFlat = flattenFinanceLikeNode(destObj, destBase);
        const destById = new Map();
        destFlat.forEach(x => { if (x && x.id) destById.set(String(x.id), x); });

        const monthRe = /^\d{4}-\d{2}$/;

        const creates = {};
        const deletes = {};
        let conflicts = 0;
        let skippedNoDate = 0;
        let repairedByDueDate = 0;
        let repairedFlatAtRoot = 0;

        // 1) Reparar destino: itens "flat" em financas/* (id direto no nó raiz) → mover para pasta mensal
        Object.keys(destObj || {}).forEach(rootKey => {
            if (monthRe.test(rootKey)) return;
            const rec = destObj[rootKey];
            if (!rec || typeof rec !== 'object') return;
            const sid = String((rec && rec.id) || rootKey || '').trim();
            if (!sid) return;
            const mk = monthKeyFromRecord(rec);
            if (!mk) return;
            const destPath = `${destBase}/${mk}/${sid}`;
            if (!destById.has(sid)) {
                creates[destPath] = { ...(rec || {}), id: sid };
                repairedFlatAtRoot += 1;
                if (deleteOld) deletes[`${destBase}/${rootKey}`] = null;
                return;
            }
            // Se já existe em algum lugar, ainda assim garantir presença no mês correto (sem sobrescrever)
            if (!creates[destPath]) {
                const existingAtCorrectMonth = (destObj[mk] && typeof destObj[mk] === 'object' && destObj[mk][sid]);
                if (!existingAtCorrectMonth) {
                    creates[destPath] = { ...(rec || {}), id: sid };
                    repairedFlatAtRoot += 1;
                    if (deleteOld) deletes[`${destBase}/${rootKey}`] = null;
                }
            }
        });

        // 2) Reparar destino: itens em mês errado (path month != dataVencimento) → duplicar no mês correto
        Object.keys(destObj || {}).forEach(mkPath => {
            if (!monthRe.test(mkPath)) return;
            const bucket = destObj[mkPath];
            if (!bucket || typeof bucket !== 'object') return;
            const items = Array.isArray(bucket) ? bucket.map((it, idx) => ({ id: (it && (it.id || it.firebaseKey)) || String(idx), rec: it }))
                : Object.keys(bucket).map(id => ({ id, rec: bucket[id] }));
            items.forEach(({ id, rec }) => {
                if (!rec || typeof rec !== 'object') return;
                const sid = String((rec && rec.id) || id || '').trim();
                if (!sid) return;
                const mkCorrect = monthKeyFromRecord(rec);
                if (!mkCorrect || mkCorrect === mkPath) return;
                const destPath = `${destBase}/${mkCorrect}/${sid}`;
                const existsAtCorrect = (destObj[mkCorrect] && typeof destObj[mkCorrect] === 'object' && destObj[mkCorrect][sid]);
                if (existsAtCorrect || creates[destPath]) return;
                creates[destPath] = { ...(rec || {}), id: sid };
                repairedByDueDate += 1;
                if (deleteOld) {
                    const oldPath = `${destBase}/${mkPath}/${sid}`;
                    deletes[oldPath] = null;
                }
            });
        });

        srcFlat.forEach(({ id, rec, srcPath }) => {
            const sid = String(id || (rec && rec.id) || '').trim();
            if (!sid) return;
            const mk = monthKeyFromRecord(rec);
            if (!mk) {
                skippedNoDate += 1;
                return;
            }
            const destIdHit = destById.get(sid);
            if (destIdHit) {
                conflicts += 1;
                return;
            }
            const payload = { ...(rec || {}), id: sid };
            const destPath = `${destBase}/${mk}/${sid}`;
            creates[destPath] = payload;
            if (deleteOld) deletes[srcPath] = null;
        });

        const summary = {
            srcFound: srcFlat.length > 0,
            srcCount: srcFlat.length,
            srcByKeyCount,
            destCount: destFlat.length,
            toCreate: Object.keys(creates).length,
            toDelete: Object.keys(deletes).length,
            conflicts,
            skippedNoDate,
            repairedFlatAtRoot,
            repairedByDueDate,
            samples: {
                create: Object.keys(creates).slice(0, 5),
                delete: Object.keys(deletes).slice(0, 5)
            }
        };

        if (!dryRun) {
            await applyUpdatesInBatches(creates, batchSize);
            if (deleteOld) {
                await applyUpdatesInBatches(deletes, batchSize);
            }
        }

        return summary;
    };

    try {
        if (includeReceber) {
            report.receber = await migrateType({
                label: 'receber',
                srcKeys: includeAliases
                    ? ['contasReceber', 'contas_receber', 'contasreceber']
                    : ['contasReceber'],
                destKey: 'financas/receber'
            });
        }
        if (includePagar) {
            report.pagar = await migrateType({
                label: 'pagar',
                srcKeys: includeAliases
                    ? ['contasPagar', 'contas_pagar', 'contaspagar']
                    : ['contasPagar'],
                destKey: 'financas/pagar'
            });
        }
        return report;
    } catch (e) {
        return { ...report, success: false, error: e && e.message ? e.message : String(e) };
    }
};

function getServerTimestamp() {
    try {
        return serverTimestamp();
    } catch (_) {
        return new Date().getTime();
    }
}

// ✅ FUNÇÃO PARA REMOVER DADOS DO FIREBASE
async function deleteFromFirebase(path) {
    try {
        console.log(`🔥 Removendo dados de: ${path}`);
        
        // Verificar se Firebase está operacional
        const status = isFirebaseOperational();
        if (!status.operational) {
            throw new Error(`Firebase não operacional: ${status.message}`);
        }
        
        // Remover do Firebase
        const finalDeletePath = getNamespacedPath(path.replace(/^contaspagar(\/|$)/, 'contasPagar$1').replace(/^contas_pagar(\/|$)/, 'contasPagar$1').replace(/^contasreceber(\/|$)/, 'contasReceber$1').replace(/^contas_receber(\/|$)/, 'contasReceber$1'));
        const writePermission = validateWritePermissionBySubscription(finalDeletePath);
        if (!writePermission.allowed) return denyReadOnlyWrite(finalDeletePath, writePermission.status);
        tenantAuditLog('DELETE', path, finalDeletePath, 'firebaseService');
        const reference = ref(db, finalDeletePath);
        await remove(reference);
        
        console.log(`✅ Dados removidos de ${path}`);
        
        return {
            success: true,
            source: 'firebase'
        };
        
    } catch (error) {
        console.error(`❌ Erro ao remover dados de ${path}:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

// ✅ ALIASES PARA COMPATIBILIDADE
function getFromFirebase(path) {
    return loadFromFirebase(path);
}

function updateFirebase(path, data) {
    // Para substituir/atualizar todos os dados em um caminho, usar key null
    return saveToFirebase(path, null, data);
}

// ✅ SERVIÇO DE AUTENTICAÇÃO SIMPLIFICADO
export const authService = {
    // Login com email/senha
    async login(email, password) {
        try {
            console.log("🔑 Tentando login com email:", email);
            console.log("🌐 Usando Database URL:", firebaseConfig.databaseURL);
            console.log("🔑 Usando API Key:", firebaseConfig.apiKey.substring(0, 10) + "...");
            
            const status = isFirebaseOperational();
            if (!status.operational) {
                throw new Error("Firebase não operacional para login");
            }
            
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // ✅ FORÇAR CARREGAMENTO DE CLAIMS ANTES DE RETORNAR
            let companyId = null;
            try {
                const tokenResult = await user.getIdTokenResult(true); // Force refresh
                const claims = tokenResult.claims;
                companyId = claims && (claims.companyId || claims.companyID || claims.tenantId) || null;
            } catch (claimError) {
                console.warn("⚠️ Login: Falha ao obter claims iniciais:", claimError);
            }
            if (!companyId) {
                try {
                    const profileSnap = await get(child(ref(db), `users/${user.uid}`));
                    const profile = profileSnap.exists() ? profileSnap.val() : null;
                    companyId = profile && (profile.companyId || profile.companyID || profile.tenantId) || null;
                } catch (_) {}
            }
            if (companyId) {
                const tenant = String(companyId);
                setTenantId(tenant);
                try {
                    const raw = localStorage.getItem('company_info');
                    const prev = raw ? JSON.parse(raw) : {};
                    const next = { ...prev, id: prev.id || tenant, companyId: tenant };
                    localStorage.setItem('company_info', JSON.stringify(next));
                    window.companyInfo = next;
                } catch (_) {}
                console.log("🏢 Login: CompanyId detectado e persistido:", tenant);
            }

            console.log("✅ Login bem-sucedido para:", email);
            return { success: true, user };
            
        } catch (error) {
            console.error("❌ Erro no login:", error);
            
            // Tratamento específico para diferentes tipos de erro
            let userFriendlyMessage = error.message;
            
            if (error.code === 'auth/network-request-failed') {
                userFriendlyMessage = "Erro de conectividade. Verifique sua conexão com a internet e tente novamente.";
                console.error("🌐 Detalhes do erro de rede:", {
                    code: error.code,
                    message: error.message,
                    databaseURL: firebaseConfig.databaseURL,
                    authDomain: firebaseConfig.authDomain
                });
            } else if (error.code === 'auth/user-not-found') {
                userFriendlyMessage = "Usuário não encontrado. Verifique o email digitado.";
            } else if (error.code === 'auth/wrong-password') {
                userFriendlyMessage = "Senha incorreta. Tente novamente.";
            } else if (error.code === 'auth/invalid-email') {
                userFriendlyMessage = "Email inválido. Verifique o formato do email.";
            } else if (error.code === 'auth/too-many-requests') {
                userFriendlyMessage = "Muitas tentativas de login. Aguarde alguns minutos antes de tentar novamente.";
            }
            
            return { success: false, error: userFriendlyMessage };
        }
    },
    
    // Logout
    async logout() {
        try {
            await signOut(auth);
            console.log("✅ Logout realizado com sucesso");
            return { success: true };
        } catch (error) {
            console.error("❌ Erro no logout:", error);
            return { success: false, error: error.message };
        }
    },
    
    // Obter usuário atual
    async getCurrentUser() {
        return new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, 
                (user) => {
                    unsubscribe();
                    resolve(user);
                },
                (error) => {
                    console.error("❌ Erro ao verificar autenticação:", error);
                    unsubscribe();
                    resolve(null);
                }
            );
            
            // Timeout para evitar espera infinita
            setTimeout(() => {
                unsubscribe();
                resolve(null);
            }, 5000);
        });
    },

    getCredential(email, password) {
        if (!email || !password) {
            throw new Error('Email e senha são obrigatórios para criar credencial.');
        }
        return EmailAuthProvider.credential(String(email), String(password));
    },

    async reauthenticate(credential) {
        const user = auth.currentUser;
        if (!user) throw new Error('Usuário não autenticado para reautenticação.');
        if (!credential) throw new Error('Credencial inválida para reautenticação.');
        await reauthenticateWithCredential(user, credential);
        return true;
    },

    async updatePassword(newPassword) {
        const user = auth.currentUser;
        if (!user) throw new Error('Usuário não autenticado para atualizar senha.');
        if (!newPassword || String(newPassword).length < 6) {
            throw new Error('Nova senha inválida.');
        }
        await firebaseUpdatePassword(user, String(newPassword));
        return true;
    },
    
    // Registrar novo usuário
    async register(email, password, username) {
        try {
            console.log("🔐 Registrando novo usuário:", email);
            console.log("🌐 Usando Database URL:", firebaseConfig.databaseURL);
            console.log("🔑 Usando API Key:", firebaseConfig.apiKey.substring(0, 10) + "...");
            
            const status = isFirebaseOperational();
            if (!status.operational) {
                throw new Error("Firebase não operacional para registro");
            }
            
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Salvar dados adicionais do usuário
            await saveToFirebase(`users/${user.uid}`, null, {
                username: username || email.split('@')[0],
                email: email,
                createdAt: new Date().toISOString()
            });
            
            console.log("✅ Usuário registrado com sucesso:", user.uid);
            return { success: true, user };
            
        } catch (error) {
            console.error("❌ Erro no registro:", error);
            
            // Tratamento específico para diferentes tipos de erro
            let userFriendlyMessage = error.message;
            
            if (error.code === 'auth/network-request-failed') {
                userFriendlyMessage = "Erro de conectividade. Verifique sua conexão com a internet e tente novamente.";
                console.error("🌐 Detalhes do erro de rede:", {
                    code: error.code,
                    message: error.message,
                    databaseURL: firebaseConfig.databaseURL,
                    authDomain: firebaseConfig.authDomain
                });
            } else if (error.code === 'auth/email-already-in-use') {
                userFriendlyMessage = "Este email já está sendo usado por outra conta.";
            } else if (error.code === 'auth/invalid-email') {
                userFriendlyMessage = "Email inválido. Verifique o formato do email.";
            } else if (error.code === 'auth/weak-password') {
                userFriendlyMessage = "Senha muito fraca. Use pelo menos 6 caracteres.";
            } else if (error.code === 'auth/operation-not-allowed') {
                userFriendlyMessage = "Registro não permitido. Entre em contato com o administrador.";
            }
            
            return { success: false, error: userFriendlyMessage };
        }
    },

    // Alias para compatibilidade com chamadas antigas
    registerUser(email, password, companyId) {
        return this.register(email, password, null, companyId);
    }
};

async function migrateDataToFirebase(localKey, firebasePath) {
    try {
        if (!localKey || !firebasePath) {
            return { success: false, migrated: 0, error: 'Parâmetros inválidos para migração' };
        }
        const raw = localStorage.getItem(localKey);
        if (!raw) return { success: true, migrated: 0, message: `Sem dados em ${localKey}` };
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (_) {
            parsed = raw;
        }
        const result = await saveToFirebase(firebasePath, null, parsed);
        if (!result || result.success === false) {
            return { success: false, migrated: 0, error: result?.error || 'Falha ao salvar no Firebase' };
        }
        const migrated = Array.isArray(parsed) ? parsed.length : (parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 1);
        return { success: true, migrated };
    } catch (error) {
        return { success: false, migrated: 0, error: error?.message || String(error) };
    }
}

async function migrateFromIndexedDB(databaseName, firebasePath) {
    try {
        return {
            success: true,
            migrated: 0,
            message: `Migração IndexedDB não habilitada neste build (${databaseName || 'default'} → ${firebasePath || 'N/A'})`
        };
    } catch (error) {
        return { success: false, migrated: 0, error: error?.message || String(error) };
    }
}

// Exportar todos os serviços para que possam ser acessados globalmente
export {
    loadFromFirebase,
    saveToFirebase,
    deleteFromFirebase as removeFromFirebase,
    getFromFirebase,
    updateFirebase,
    updatePaths,
    getServerTimestamp,
    getTenantId,
    getTenantId as getCurrentTenantId,
    setTenantId,
    getCurrentUid,
    subscribe,
    createCompanyOnboarding,
    setCompanyClaim,
    syncMyAdminClaims,
    auditAdminClaimsInconsistencies,
    reconcileSuperAdminClaims,
    migrateDataToFirebase,
    setUserAccessStatus,
    createAdminSubUser,
    updateAdminSubUserPermissions,
    getSubscriptionSettings,
    upsertSubscriptionSettings,
    upsertCompanyProfile,
    updateMyCompanyProfile,
    submitSubscriptionRequest,
    createPixPayment,
    revalidatePixPayment,
    activateFreeTrial,
    uploadSubscriptionProof,
    extendSubscriptionAccess,
    requestSubscriptionExtension,
    grantReadOnlyGrace,
    saveUiCache,
    loadUiCache,
    getOpenExtensionRequests,
    reviewSubscriptionExtensionRequest,
    retroEnrichSubscriptionHistory,
    prepareSubscriptionApproval,
    confirmSubscriptionApproval,
    updateSubscriptionFinancialEvent,
    deleteSubscriptionManagedData,
    getCampaignExecutiveSummary,
    getCampaignConfigAudit,
    getAll,
    migrateFromIndexedDB,
    db,
    auth,
    app
};

function subscribe(path, callback) {
    try {
        const status = isFirebaseOperational();
        if (!status.operational) {
            throw new Error(`Firebase não operacional: ${status.message}`);
        }
        const nsPath = getNamespacedPath(path);
        tenantAuditLog('SUBSCRIBE', path, nsPath, 'firebaseService');
        const reference = ref(db, nsPath);
        const handler = (snapshot) => {
            try {
                const data = snapshot.val();
                callback({ path: nsPath, data });
            } catch (e) {
                console.warn('⚠️ Falha ao processar atualização em subscribe:', e?.message || e);
            }
        };
        onValue(reference, handler, (error) => {
            console.error(`❌ Erro na assinatura de ${nsPath}:`, error);
        });
        return {
            ref: reference,
            callback: handler,
            unsubscribe: () => {
                try { off(reference, handler); } catch (_) {}
            }
        };
    } catch (error) {
        console.error(`❌ Erro ao criar assinatura para ${path}:`, error);
        return {
            unsubscribe: () => {}
        };
    }
}

// No final do arquivo, adicionar exportação global para window.firebaseService
const initializeGlobalFirebaseService = () => {
    const globalService = {
        loadFromFirebase,
        saveToFirebase,
        removeFromFirebase: deleteFromFirebase,
        getFromFirebase,
        updateFirebase,
        updatePaths,
        serverTimestamp: getServerTimestamp,
        subscribe,
        authService,
        getCurrentUser: (...args) => authService.getCurrentUser(...args),
        getCredential: (...args) => authService.getCredential(...args),
        reauthenticate: (...args) => authService.reauthenticate(...args),
        updatePassword: (...args) => authService.updatePassword(...args),
        isFirebaseOperational,
        getCurrentTenantId: getTenantId,
        setTenantId,
        getCurrentUid,
        setUserAccessStatus,
        syncMyAdminClaims,
        auditAdminClaimsInconsistencies,
        reconcileSuperAdminClaims,
        createAdminSubUser,
        updateAdminSubUserPermissions,
        getSubscriptionSettings,
        upsertSubscriptionSettings,
        upsertCompanyProfile,
        updateMyCompanyProfile,
        submitSubscriptionRequest,
        createPixPayment,
        revalidatePixPayment,
        uploadSubscriptionProof,
        extendSubscriptionAccess,
        requestSubscriptionExtension,
        grantReadOnlyGrace,
        saveUiCache,
        loadUiCache,
        getOpenExtensionRequests,
        reviewSubscriptionExtensionRequest,
        retroEnrichSubscriptionHistory,
        prepareSubscriptionApproval,
        confirmSubscriptionApproval,
        updateSubscriptionFinancialEvent,
        deleteSubscriptionManagedData,
        getCampaignExecutiveSummary,
        getCampaignConfigAudit,
        getAll,
        migrateDataToFirebase,
        migrateFromIndexedDB,
        db,
        auth,
        app
    };
    if (typeof window === 'undefined') return;
    if (window.__siswebFirebaseServiceBootstrapped) {
        window.firebaseService = { ...(window.firebaseService || {}), ...globalService };
        return;
    }
    window.__siswebFirebaseServiceBootstrapped = true;
    window.firebaseService = { ...(window.firebaseService || {}), ...globalService };
    console.log("✅ Serviços Firebase expostos globalmente via window.firebaseService");
};

if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGlobalFirebaseService, { once: true });
} else {
    initializeGlobalFirebaseService();
}
