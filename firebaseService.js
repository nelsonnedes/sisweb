/**
 * Firebase Service - Módulo central para interação com Firebase
 * Implementa integração EXCLUSIVA com Firebase Realtime Database
 * Versão Simplificada - SEM localStorage fallback
 */

// ─── Módulo compartilhado de inicialização Firebase (singleton) ───────────────
import {
    app, auth, db, storage, functions,
    ref, set, get, remove, child, onValue, off, push, update,
    serverTimestamp, query, orderByChild, limitToLast,
    signOut, onAuthStateChanged, setPersistence,
    browserSessionPersistence, browserLocalPersistence,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInAnonymously,
    sendPasswordResetEmail, EmailAuthProvider,
    reauthenticateWithCredential,
    firebaseUpdatePassword, firebaseUpdateProfile, updateCurrentUser,
    httpsCallable, getFunctions,
    storageRef, uploadBytes, getDownloadURL, getBytes, deleteObject
} from './firebase-init.js';

function getAuthPerformanceDiagnostics() {
    try {
        return typeof window !== 'undefined' ? window.__SISWEB_AUTH_PERF__ || null : null;
    } catch (_) {
        return null;
    }
}

function authPerfPhase(name, outcome = 'observed', durationMs = 0) {
    try { getAuthPerformanceDiagnostics()?.phase(name, 'root_service', outcome, durationMs); } catch (_) {}
}

function authPerfAuth(state, durationMs = 0) {
    try { getAuthPerformanceDiagnostics()?.auth(state, 'root_service', durationMs); } catch (_) {}
}

function authPerfTenant(value) {
    try { getAuthPerformanceDiagnostics()?.tenant(value, 'root_service'); } catch (_) {}
}

function authPerfRead(path, kind = 'logical', outcome = 'started', durationMs = 0) {
    try { getAuthPerformanceDiagnostics()?.read(path, 'root_service', kind, outcome, durationMs); } catch (_) {}
}

function authPerfListener(kind, action, durationMs = 0) {
    try { getAuthPerformanceDiagnostics()?.listener(kind, action, 'root_service', durationMs); } catch (_) {}
}

function authPerfTokenRefresh(reason, outcome = 'started', durationMs = 0) {
    try { getAuthPerformanceDiagnostics()?.tokenRefresh(reason, 'root_service', outcome, durationMs); } catch (_) {}
}

console.log('🔧 FirebaseService usando configuração: PADRÃO');

// ─── Estado interno (não relacionado à inicialização do Firebase) ────────────
let firebaseInitError = null;
let _connectionMonitoringConfigured = false;
let _internetMonitoringConfigured = false;
let authPersistenceReady = Promise.resolve();
let internetAvailable = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
let rtdbConnected = null;

const AUTH_SESSION_PHASES = Object.freeze({
    BOOTING: 'BOOTING',
    AUTHENTICATED: 'AUTHENTICATED',
    TENANT_READY: 'TENANT_READY',
    READY: 'READY',
    UNAUTHENTICATED: 'UNAUTHENTICATED',
    ERROR: 'ERROR'
});
let authObserverUnsubscribe = null;
let authObserverStarted = false;
let authReadySettled = false;
let resolveAuthReadyPromise = null;
const authReadyPromise = new Promise((resolve) => {
    resolveAuthReadyPromise = resolve;
});
let authStateSnapshot = Object.freeze({
    ready: false,
    phase: AUTH_SESSION_PHASES.BOOTING,
    user: null,
    error: null
});
const authStateSubscribers = new Set();
let sessionContextPromise = null;
let sessionContextUid = '';
let sessionContextSnapshot = null;
let userProfilePromise = null;
let userProfileUid = '';
let userProfileSnapshot = null;
let effectiveUserProfilePromise = null;
let effectiveUserProfileKey = '';
let effectiveUserProfileSnapshot = null;
let tokenResultPromise = null;
let tokenResultUid = '';
let tokenResultSnapshot = null;
let forcedTokenResultPromise = null;
let forcedTokenResultUid = '';
let authGeneration = 0;
let anonymousSignInPromise = null;
const SUPERADMIN_UID_LOCAL_ALLOWLIST = new Set([
    'HfrQ6ObQq2aSEoeEE4Ng9jpAolB3'
]);

// Firebase já foi inicializado pelo firebase-init.js, que é importado acima.
// Aqui apenas configuramos listeners e monitoramentos adicionais.
try {
    const isPwaStandalone = typeof window !== 'undefined' && (
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true
    );
    const persistence = isPwaStandalone ? browserLocalPersistence : browserSessionPersistence;
    authPersistenceReady = setPersistence(auth, persistence)
        .then(() => console.log(`🔒 Persistência de autenticação definida para ${isPwaStandalone ? 'LOCAL_PWA' : 'SESSION'}`))
        .catch(e => console.warn("⚠️ Falha ao definir persistência de autenticação:", e && e.message || e));
} catch (_) {}
try {
    if (typeof window.ENABLE_ANON_AUTH === 'undefined') {
        window.ENABLE_ANON_AUTH = false;
    }
    ensureCanonicalAuthObserver();
} catch (e) {
    console.warn("⚠️ Falha ao configurar observador central de autenticação:", e?.message || e);
}
try { setupInternetMonitoring(); } catch (_) {}
try { setupConnectionMonitoring(); } catch (_) {}
console.log('✅ FirebaseService: serviços Firebase prontos (via firebase-init.js)');

function publishInternetState(available, source = 'navigator') {
    internetAvailable = available !== false;
    try { getAuthPerformanceDiagnostics()?.internet(internetAvailable, 'root_service'); } catch (_) {}
    try {
        window.internetAvailable = internetAvailable;
        window.dispatchEvent(new CustomEvent('sisweb:internet-connection', {
            detail: { available: internetAvailable, source }
        }));
    } catch (_) {}
}

function setupInternetMonitoring() {
    if (_internetMonitoringConfigured || typeof window === 'undefined') return;
    _internetMonitoringConfigured = true;
    publishInternetState(typeof navigator === 'undefined' ? true : navigator.onLine !== false, 'navigator-initial');
    window.addEventListener('online', () => publishInternetState(true, 'navigator-online'));
    window.addEventListener('offline', () => publishInternetState(false, 'navigator-offline'));
}

function getConnectionState() {
    return Object.freeze({
        internetAvailable,
        rtdbConnected,
        authReady: authStateSnapshot.ready,
        authPhase: authStateSnapshot.phase
    });
}

// Função para configurar monitoramento de conexão RTDB
function setupConnectionMonitoring() {
    if (_connectionMonitoringConfigured) return;
    _connectionMonitoringConfigured = true;
    console.log("🔄 Configurando monitoramento de conexão Firebase");

    const notifyConnectionChange = (isConnected, source = 'firebaseService') => {
        rtdbConnected = isConnected === true;
        try { getAuthPerformanceDiagnostics()?.rtdb(rtdbConnected, 'root_service'); } catch (_) {}
        try {
            window.firebaseConnected = rtdbConnected;
            window._FIREBASE_CONNECTED = rtdbConnected;
            window.dispatchEvent(new CustomEvent('sisweb:firebase-connection', {
                detail: { connected: rtdbConnected, source }
            }));
        } catch (_) {}
    };

    try {
        // Se existir um manager global, delegar eventos a ele para evitar duplicações
        if (window.getFirebaseManager) {
            const manager = window.getFirebaseManager();
            manager.on('connected', () => {
                console.log('✅ Firebase conectado (via manager)');
                notifyConnectionChange(true, 'firebaseManager');
            });
            manager.on('disconnected', () => {
                console.log('⚠️ Firebase offline (via manager)');
                notifyConnectionChange(false, 'firebaseManager');
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
            } else {
                console.log("⚠️ Firebase offline");
            }
            notifyConnectionChange(isConnected, 'rtdb-info-connected');
        }, (error) => {
            console.error("❌ Erro no monitoramento de conexão:", error && error.code ? error.code : 'unknown');
            notifyConnectionChange(false, 'rtdb-info-connected-error');
        });
    } catch (err) {
        console.error('❌ Erro configurando connectedRef:', err && err.code ? err.code : 'unknown');
    }
}

const RESERVED_TENANT_CONTEXT_KEYS = new Set([
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

function normalizeTenantContextValue(value) {
    const raw = value ? String(value).trim() : '';
    if (!raw) return null;
    if (raw.includes('/')) return null;
    if (RESERVED_TENANT_CONTEXT_KEYS.has(raw.toLowerCase())) return null;
    return raw;
}

function readJsonStorageSafe(key) {
    try {
        if (typeof localStorage === 'undefined') return null;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function getUserLikeTenant(value) {
    const source = value && typeof value === 'object' ? value : {};
    return normalizeTenantContextValue(
        source.companyId
        || source.companyID
        || source.tenantId
        || source.empresaId
        || (source.claims && (source.claims.companyId || source.claims.companyID || source.claims.tenantId))
    );
}

function getStoredUserTenant() {
    const current = readJsonStorageSafe('currentUser');
    const persistent = readJsonStorageSafe('persistentUser');
    return getUserLikeTenant(current) || getUserLikeTenant(persistent);
}

function getStoredCompanyTenant() {
    const companyInfo = readJsonStorageSafe('company_info');
    return normalizeTenantContextValue(companyInfo && (
        companyInfo.companyId
        || companyInfo.companyID
        || companyInfo.tenantId
        || companyInfo.id
    ));
}

function getStoredTenantOwnerUid() {
    const companyInfo = readJsonStorageSafe('company_info') || {};
    return String(companyInfo._authUid || '').trim();
}

function getPreservableTenant(uid) {
    const expectedUid = String(uid || '').trim();
    if (!expectedUid || getStoredTenantOwnerUid() !== expectedUid) return null;
    return getTenantId();
}

function persistTenantContext(tenantId, source = {}) {
    const tenant = normalizeTenantContextValue(tenantId);
    if (!tenant || typeof window === 'undefined') return null;
    authPerfTenant(tenant);
    window.appTenantId = tenant;
    try {
        const previous = readJsonStorageSafe('company_info') || {};
        const previousTenant = normalizeTenantContextValue(previous.companyId || previous.companyID || previous.tenantId || previous.id);
        const safePrevious = previousTenant && previousTenant !== tenant ? {} : previous;
        const ownerUid = String(
            source && source._authUid
            || (auth && auth.currentUser && auth.currentUser.uid)
            || ''
        ).trim();
        const next = {
            ...safePrevious,
            ...(source && typeof source === 'object' ? source : {}),
            id: tenant,
            companyId: tenant,
            tenantId: tenant
        };
        if (ownerUid) next._authUid = ownerUid;
        localStorage.setItem('company_info', JSON.stringify(next));
        window.companyInfo = next;
    } catch (_) {}
    return tenant;
}

function clearTenantContext() {
    if (typeof window === 'undefined') return;
    authPerfTenant(null);
    try { window.appTenantId = null; } catch (_) {}
    try { window.companyInfo = null; } catch (_) {}
    try { localStorage.removeItem('company_info'); } catch (_) {}
}

function publishSessionPhase(phase, user = null, error = null) {
    authStateSnapshot = Object.freeze({
        ready: phase !== AUTH_SESSION_PHASES.BOOTING,
        phase,
        user: user || null,
        error: error || null
    });
    authPerfAuth(user ? 'authenticated' : (phase === AUTH_SESSION_PHASES.UNAUTHENTICATED ? 'unauthenticated' : 'unknown'));
    try {
        window.__SISWEB_SESSION_STATE__ = Object.freeze({
            phase,
            authenticated: !!user,
            tenantReady: phase === AUTH_SESSION_PHASES.TENANT_READY || phase === AUTH_SESSION_PHASES.READY
        });
        window.dispatchEvent(new CustomEvent('sisweb:session-state', {
            detail: window.__SISWEB_SESSION_STATE__
        }));
    } catch (_) {}
}

function settleAuthReady() {
    if (authReadySettled) return;
    authReadySettled = true;
    if (typeof resolveAuthReadyPromise === 'function') resolveAuthReadyPromise(authStateSnapshot);
}

function notifyAuthStateSubscribers(user) {
    for (const callback of Array.from(authStateSubscribers)) {
        try { callback(user || null); } catch (_) {}
    }
}

function resetSessionSingleFlights(nextUid = '') {
    authGeneration += 1;
    sessionContextPromise = null;
    sessionContextUid = '';
    sessionContextSnapshot = null;
    userProfilePromise = null;
    userProfileUid = '';
    userProfileSnapshot = null;
    effectiveUserProfilePromise = null;
    effectiveUserProfileKey = '';
    effectiveUserProfileSnapshot = null;
    tokenResultPromise = null;
    tokenResultUid = '';
    tokenResultSnapshot = null;
    forcedTokenResultPromise = null;
    forcedTokenResultUid = '';
}

function isCanonicalAuthGenerationCurrent(generation, uid) {
    if (generation !== authGeneration) return false;
    const activeUser = (authStateSnapshot && authStateSnapshot.user)
        || (auth && auth.currentUser)
        || getWindowFirebaseAuthUser();
    return String(activeUser && activeUser.uid || '') === String(uid || '');
}

async function getIdTokenResultSingleFlight(user, options = {}) {
    if (!user || typeof user.getIdTokenResult !== 'function') return null;
    const uid = String(user.uid || '');
    const forceRefresh = options.forceRefresh === true;
    const reason = String(options.reason || (forceRefresh ? 'legacy_unspecified' : 'cached_token'));
    const generation = authGeneration;

    if (forceRefresh) {
        if (forcedTokenResultPromise && forcedTokenResultUid === uid) return forcedTokenResultPromise;
        forcedTokenResultUid = uid;
        const startedAt = Date.now();
        authPerfTokenRefresh(reason, 'started');
        const request = user.getIdTokenResult(true)
            .then((result) => {
                if (isCanonicalAuthGenerationCurrent(generation, uid)) {
                    tokenResultUid = uid;
                    tokenResultSnapshot = { result, cachedAt: Date.now() };
                    tokenResultPromise = null;
                }
                authPerfTokenRefresh(reason, 'success', Date.now() - startedAt);
                return result;
            })
            .catch((error) => {
                authPerfTokenRefresh(reason, 'error', Date.now() - startedAt);
                throw error;
            })
            .finally(() => {
                if (forcedTokenResultPromise === request) {
                    forcedTokenResultPromise = null;
                    forcedTokenResultUid = '';
                }
            });
        forcedTokenResultPromise = request;
        return request;
    }

    if (tokenResultSnapshot && tokenResultUid === uid && (Date.now() - tokenResultSnapshot.cachedAt) < 60000) {
        return tokenResultSnapshot.result;
    }
    if (tokenResultPromise && tokenResultUid === uid) return tokenResultPromise;
    tokenResultUid = uid;
    const request = user.getIdTokenResult(false)
        .then((result) => {
            if (isCanonicalAuthGenerationCurrent(generation, uid)) {
                tokenResultSnapshot = { result, cachedAt: Date.now() };
                if (tokenResultPromise === request) tokenResultPromise = null;
            }
            return result;
        })
        .catch((error) => {
            if (tokenResultPromise === request) tokenResultPromise = null;
            throw error;
        });
    tokenResultPromise = request;
    return request;
}

async function loadUserProfileSingleFlight(user) {
    if (!user || !user.uid) return { ok: false, profile: null, code: 'missing-user' };
    const uid = String(user.uid);
    if (userProfileSnapshot && userProfileUid === uid) {
        const failureIsFresh = userProfileSnapshot.ok === false
            && (Date.now() - Number(userProfileSnapshot.cachedAt || 0)) < 2000;
        if (userProfileSnapshot.ok !== false || failureIsFresh) return userProfileSnapshot;
        userProfileSnapshot = null;
    }
    if (userProfilePromise && userProfileUid === uid) return userProfilePromise;

    userProfileUid = uid;
    const generation = authGeneration;
    const startedAt = Date.now();
    authPerfRead(`users/${uid}`, 'physical');
    const request = get(child(ref(db), `users/${uid}`))
        .then((snapshot) => {
            const result = {
                ok: true,
                profile: snapshot.exists() ? snapshot.val() : null,
                code: snapshot.exists() ? 'loaded' : 'not-found',
                cachedAt: Date.now()
            };
            if (isCanonicalAuthGenerationCurrent(generation, uid)) userProfileSnapshot = result;
            authPerfRead(`users/${uid}`, 'physical', 'success', Date.now() - startedAt);
            return result;
        })
        .catch((error) => {
            const result = {
                ok: false,
                profile: null,
                code: String(error && error.code || 'profile-read-error'),
                cachedAt: Date.now()
            };
            if (isCanonicalAuthGenerationCurrent(generation, uid)) userProfileSnapshot = result;
            authPerfRead(`users/${uid}`, 'physical', 'error', Date.now() - startedAt);
            return result;
        })
        .finally(() => {
            if (userProfilePromise === request) userProfilePromise = null;
        });
    userProfilePromise = request;
    return request;
}

async function getUserProfileForSession(uid) {
    const currentUser = (auth && auth.currentUser) || getWindowFirebaseAuthUser();
    const requestedUid = uid ? String(uid) : String(currentUser && currentUser.uid || '');
    if (!currentUser || !requestedUid || String(currentUser.uid || '') !== requestedUid) return null;
    const result = await loadUserProfileSingleFlight(currentUser);
    return result && result.ok ? result.profile : null;
}

async function getEffectiveUserProfile(uid, options = {}) {
    const currentUser = (auth && auth.currentUser) || getWindowFirebaseAuthUser();
    const requestedUid = String(uid || currentUser && currentUser.uid || '').trim();
    if (!currentUser || !requestedUid || String(currentUser.uid || '') !== requestedUid) {
        return { success: false, data: null, statusKey: 'unknown', source: 'none', warnings: ['auth_uid_mismatch'] };
    }

    const session = await resolveSessionContextForUser(currentUser);
    const companyId = normalizeTenantContextValue(session && session.companyId);
    const requestedCompanyId = normalizeTenantContextValue(options.companyId);
    if (requestedCompanyId && requestedCompanyId !== companyId) {
        return { success: false, data: null, statusKey: 'unknown', source: 'none', warnings: ['tenant_mismatch'] };
    }

    const cacheKey = `${requestedUid}::${companyId || 'no-tenant'}`;
    const forceRefresh = options.forceRefresh === true;
    if (!forceRefresh
        && effectiveUserProfileSnapshot
        && effectiveUserProfileSnapshot.key === cacheKey
        && (Date.now() - effectiveUserProfileSnapshot.cachedAt) < 10000) {
        return effectiveUserProfileSnapshot.result;
    }
    if (!forceRefresh && effectiveUserProfilePromise && effectiveUserProfileKey === cacheKey) {
        return effectiveUserProfilePromise;
    }

    const generation = authGeneration;
    effectiveUserProfileKey = cacheKey;
    const request = (async () => {
        const readWarnings = [];
        let rootProfile = null;
        try {
            const rootResult = await loadUserProfileSingleFlight(currentUser);
            rootProfile = rootResult && rootResult.ok ? rootResult.profile : null;
            if (rootResult && rootResult.ok === false) readWarnings.push('root_profile_unavailable');
        } catch (_) {
            readWarnings.push('root_profile_unavailable');
        }

        let tenantProfile = null;
        if (companyId) {
            const startedAt = Date.now();
            authPerfRead('effective_subscription_tenant_profile', 'physical');
            try {
                const tenantSnapshot = await get(child(ref(db), `companies/${companyId}/users/${requestedUid}`));
                tenantProfile = tenantSnapshot.exists() ? tenantSnapshot.val() : null;
                authPerfRead('effective_subscription_tenant_profile', 'physical', 'success', Date.now() - startedAt);
            } catch (_) {
                readWarnings.push('tenant_profile_unavailable');
                authPerfRead('effective_subscription_tenant_profile', 'physical', 'error', Date.now() - startedAt);
            }
        }

        if (!isCanonicalAuthGenerationCurrent(generation, requestedUid)) {
            return { success: false, data: null, statusKey: 'unknown', source: 'none', warnings: ['stale_auth_generation'] };
        }
        const reconciled = reconcileSubscriptionReplicaProfiles(rootProfile, tenantProfile);
        const result = {
            success: !!reconciled.data,
            ...reconciled,
            warnings: Array.from(new Set([...readWarnings, ...reconciled.warnings]))
        };
        effectiveUserProfileSnapshot = { key: cacheKey, cachedAt: Date.now(), result };
        return result;
    })().finally(() => {
        if (effectiveUserProfilePromise === request) effectiveUserProfilePromise = null;
    });
    effectiveUserProfilePromise = request;
    return request;
}

async function resolveSessionContextForUser(user, options = {}) {
    if (!user || !user.uid) {
        return { success: false, authenticated: false, companyId: null, user: null, code: 'firebase-auth-required' };
    }
    const uid = String(user.uid);
    if (options.refreshContext === true || options.forceRefresh === true) {
        sessionContextPromise = null;
        sessionContextSnapshot = null;
    }
    if (sessionContextSnapshot && sessionContextUid === uid && options.forceRefresh !== true) return sessionContextSnapshot;
    if (sessionContextPromise && sessionContextUid === uid) return sessionContextPromise;

    sessionContextUid = uid;
    const generation = authGeneration;
    const previousTenant = getPreservableTenant(uid);
    const staleResult = () => ({
        success: false,
        authenticated: false,
        companyId: null,
        user: null,
        code: 'stale-auth-generation'
    });
    const request = (async () => {
        let claims = {};
        let tokenFailed = false;
        try {
            const tokenResult = await getIdTokenResultSingleFlight(user, {
                forceRefresh: options.forceRefresh === true,
                reason: options.reason || 'legacy_unspecified'
            });
            claims = tokenResult && tokenResult.claims ? tokenResult.claims : {};
        } catch (_) {
            tokenFailed = true;
        }
        if (!isCanonicalAuthGenerationCurrent(generation, uid)) return staleResult();

        const superAdmin = claims.superadmin === true
            || SUPERADMIN_UID_LOCAL_ALLOWLIST.has(uid)
            || (typeof window !== 'undefined' && typeof window.isSuperAdminUid === 'function' && window.isSuperAdminUid(uid));
        if (superAdmin) {
            if (!isCanonicalAuthGenerationCurrent(generation, uid)) return staleResult();
            clearTenantContext();
            const result = Object.freeze({
                success: true,
                authenticated: true,
                superAdmin: true,
                companyId: null,
                user,
                phase: AUTH_SESSION_PHASES.READY
            });
            sessionContextSnapshot = result;
            publishSessionPhase(AUTH_SESSION_PHASES.READY, user);
            return result;
        }

        let companyId = normalizeTenantContextValue(claims.companyId || claims.companyID || claims.tenantId);
        let profileResult = null;
        if (!companyId) {
            profileResult = await loadUserProfileSingleFlight(user);
            companyId = getUserLikeTenant(profileResult && profileResult.profile);
        }
        if (!isCanonicalAuthGenerationCurrent(generation, uid)) return staleResult();

        if (companyId) {
            persistTenantContext(companyId, { _authUid: uid });
            publishSessionPhase(AUTH_SESSION_PHASES.TENANT_READY, user);
            const result = Object.freeze({
                success: true,
                authenticated: true,
                superAdmin: false,
                companyId,
                user,
                phase: AUTH_SESSION_PHASES.READY
            });
            sessionContextSnapshot = result;
            publishSessionPhase(AUTH_SESSION_PHASES.READY, user);
            return result;
        }

        const transientFailure = tokenFailed || (profileResult && profileResult.ok === false);
        if (previousTenant && transientFailure) {
            persistTenantContext(previousTenant, { _authUid: uid });
            const result = Object.freeze({
                success: true,
                authenticated: true,
                degraded: true,
                superAdmin: false,
                companyId: previousTenant,
                user,
                code: 'tenant-preserved-after-transient-error',
                phase: AUTH_SESSION_PHASES.READY
            });
            sessionContextSnapshot = null;
            queueMicrotask(() => {
                if (sessionContextPromise === request) sessionContextPromise = null;
            });
            publishSessionPhase(AUTH_SESSION_PHASES.READY, user);
            return result;
        }

        if (!isCanonicalAuthGenerationCurrent(generation, uid)) return staleResult();
        clearTenantContext();
        const result = Object.freeze({
            success: false,
            authenticated: true,
            superAdmin: false,
            companyId: null,
            user,
            code: 'missing-companyId',
            error: 'Usuário autenticado sem companyId válido.',
            phase: AUTH_SESSION_PHASES.ERROR
        });
        sessionContextSnapshot = result;
        publishSessionPhase(AUTH_SESSION_PHASES.ERROR, user, result.error);
        return result;
    })().catch((error) => {
        if (sessionContextPromise === request) sessionContextPromise = null;
        if (!isCanonicalAuthGenerationCurrent(generation, uid)) return staleResult();
        publishSessionPhase(AUTH_SESSION_PHASES.ERROR, user, error);
        return {
            success: false,
            authenticated: true,
            companyId: previousTenant || null,
            user,
            code: 'session-context-error',
            error: error && error.message ? error.message : String(error)
        };
    });
    sessionContextPromise = request;
    return request;
}

function startAnonymousAuthIfEnabled() {
    if (typeof window === 'undefined' || window.ENABLE_ANON_AUTH !== true || anonymousSignInPromise) return;
    anonymousSignInPromise = signInAnonymously(auth)
        .catch((error) => {
            const code = String(error && error.code || '');
            if (code.includes('admin-restricted-operation')) window._AUTH_ANON_DISABLED = true;
        })
        .finally(() => { anonymousSignInPromise = null; });
}

function handleCanonicalAuthState(user) {
    const previousUid = String(authStateSnapshot.user && authStateSnapshot.user.uid || '');
    const nextUid = String(user && user.uid || '');
    const duplicateState = previousUid === nextUid && authStateSnapshot.ready && (
        (user && authStateSnapshot.phase !== AUTH_SESSION_PHASES.UNAUTHENTICATED)
        || (!user && authStateSnapshot.phase === AUTH_SESSION_PHASES.UNAUTHENTICATED)
    );
    if (duplicateState) {
        if (user) void resolveSessionContextForUser(user);
        return;
    }
    if (previousUid !== nextUid) {
        resetSessionSingleFlights(nextUid);
        if (previousUid) clearTenantContext();
    }

    try { window.firebaseAuthUser = user || null; } catch (_) {}
    if (!user) {
        clearTenantContext();
        publishSessionPhase(AUTH_SESSION_PHASES.UNAUTHENTICATED, null);
        settleAuthReady();
        notifyAuthStateSubscribers(null);
        if (typeof window !== 'undefined' && window.ENABLE_ANON_AUTH !== true) window._AUTH_ANON_DISABLED = true;
        startAnonymousAuthIfEnabled();
        return;
    }

    publishSessionPhase(AUTH_SESSION_PHASES.AUTHENTICATED, user);
    settleAuthReady();
    notifyAuthStateSubscribers(user);
    void resolveSessionContextForUser(user);
}

function ensureCanonicalAuthObserver() {
    if (authObserverStarted || !auth) return authObserverUnsubscribe;
    authObserverStarted = true;
    authPerfListener('auth', 'add');
    authObserverUnsubscribe = onAuthStateChanged(
        auth,
        (user) => handleCanonicalAuthState(user),
        (error) => {
            publishSessionPhase(AUTH_SESSION_PHASES.ERROR, auth && auth.currentUser, error);
            settleAuthReady();
        }
    );
    return authObserverUnsubscribe;
}

async function waitForAuthReady(timeoutMs = 5000) {
    ensureCanonicalAuthObserver();
    try { await authPersistenceReady; } catch (_) {}
    if (authReadySettled) return authStateSnapshot;
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        };
        const timer = setTimeout(() => finish(Object.freeze({
            ...authStateSnapshot,
            user: (auth && auth.currentUser) || getWindowFirebaseAuthUser() || null,
            timedOut: true
        })), Math.max(300, Number(timeoutMs) || 5000));
        authReadyPromise.then(() => finish(authStateSnapshot));
    });
}

function subscribeAuthState(authOrCallback, maybeCallback) {
    const callback = typeof authOrCallback === 'function' ? authOrCallback : maybeCallback;
    if (typeof callback !== 'function') return () => {};
    ensureCanonicalAuthObserver();
    authStateSubscribers.add(callback);
    if (authReadySettled) queueMicrotask(() => {
        if (authStateSubscribers.has(callback)) callback(authStateSnapshot.user || null);
    });
    return () => authStateSubscribers.delete(callback);
}

async function getSessionContext(options = {}) {
    const state = await waitForAuthReady(options.timeoutMs || 5000);
    const user = state.user || (auth && auth.currentUser) || getWindowFirebaseAuthUser();
    if (!user) {
        const observerFailed = state.phase === AUTH_SESSION_PHASES.ERROR && state.error;
        return {
            success: false,
            authenticated: false,
            companyId: null,
            user: null,
            code: state.timedOut ? 'auth-timeout' : (observerFailed ? 'auth-observer-error' : 'firebase-auth-required'),
            error: observerFailed && (state.error.message || String(state.error)),
            phase: state.phase
        };
    }
    return resolveSessionContextForUser(user, options);
}

async function waitForAuthCurrentUser(timeoutMs = 2500) {
    const state = await waitForAuthReady(timeoutMs);
    return state.user || (auth && auth.currentUser) || getWindowFirebaseAuthUser() || null;
}

async function primeCallableAuthSession(timeoutMs = 4500) {
    const user = await waitForAuthCurrentUser(timeoutMs);
    if (user && auth && !auth.currentUser && typeof updateCurrentUser === 'function') {
        try { await updateCurrentUser(auth, user); } catch (_) {}
    }
    if (user && typeof user.getIdTokenResult === 'function') {
        try {
            await getIdTokenResultSingleFlight(user, {
                forceRefresh: false,
                reason: 'callable_prime'
            });
        } catch (_) {}
    }
    return (auth && auth.currentUser) || user || null;
}

function isCallableUnauthenticatedError(error) {
    const code = String(error && error.code ? error.code : '').toLowerCase();
    const message = String(error && error.message ? error.message : error || '').toLowerCase();
    return code.includes('unauthenticated')
        || code.includes('permission-denied')
        || message.includes('unauthenticated')
        || message.includes('permission denied')
        || message.includes('status of 401')
        || message.includes('status 401')
        || message.includes('401');
}

function unwrapCallableResult(result) {
    return result && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : null;
}

function requiresAuthenticatedCallable(functionName) {
    return /^(nf_|finance(?:[A-Z_]|$))/.test(String(functionName || '').trim());
}

async function getCallableIdToken(user, forceRefresh = false) {
    if (!user) return '';
    if (typeof user.getIdTokenResult === 'function') {
        const result = await getIdTokenResultSingleFlight(user, {
            forceRefresh: forceRefresh === true,
            reason: forceRefresh === true ? 'authenticated_retry' : 'callable_cached_token'
        });
        return result && result.token ? String(result.token) : '';
    }
    if (typeof user.getIdToken === 'function') {
        const token = await user.getIdToken(forceRefresh === true);
        return token ? String(token) : '';
    }
    return '';
}

function getCallableHttpEndpoint(functionName) {
    const projectId = (app && app.options && app.options.projectId) || firebaseConfig.projectId || 'sisweb-7ce82';
    const region = 'us-central1';
    return `https://${region}-${projectId}.cloudfunctions.net/${encodeURIComponent(functionName)}`;
}

function buildCallableHttpError(functionName, response, body) {
    const error = body && body.error && typeof body.error === 'object' ? body.error : {};
    const message = String(error.message || body && body.message || response && response.statusText || '').trim();
    const status = String(error.status || error.code || response && response.status || '').trim();
    const suffix = status ? ` (${status})` : '';
    return new Error(message || `Falha ao executar a Function ${functionName}${suffix}.`);
}

async function callFunctionWithExplicitAuth(functionName, payload, user, options = {}) {
    const token = await getCallableIdToken(user, options.forceRefresh === true);
    if (!token) {
        throw new Error('Sessão autenticada não encontrada. Faça login novamente para continuar.');
    }
    const response = await fetch(getCallableHttpEndpoint(functionName), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ data: payload && typeof payload === 'object' ? payload : {} })
    });
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = { message: text }; }
    if (!response.ok || body && body.error) {
        throw buildCallableHttpError(functionName, response, body || {});
    }
    if (body && Object.prototype.hasOwnProperty.call(body, 'result')) return body.result;
    if (body && Object.prototype.hasOwnProperty.call(body, 'data')) return body.data;
    return body;
}

async function resolveAuthenticatedTenant(options = {}) {
    const timeoutMs = Number(options.timeoutMs || 2500);
    const forceRefresh = options.forceRefresh === true;
    try {
        const context = await getSessionContext({
            timeoutMs,
            forceRefresh,
            reason: options.reason || (forceRefresh ? 'legacy_unspecified' : 'cached_token'),
            refreshContext: options.refreshContext === true
        });
        if (context && (context.authenticated || context.success)) return context;

        const firebaseOffline = typeof window !== 'undefined' && (
            internetAvailable === false
            || (typeof navigator !== 'undefined' && navigator.onLine === false)
        );
        return {
            success: false,
            authenticated: false,
            companyId: null,
            code: context && context.code ? context.code : (firebaseOffline ? 'unauthenticated' : 'firebase-auth-required'),
            error: firebaseOffline ? 'Usuário não autenticado.' : 'Firebase Auth exige sessão autenticada para definir tenant operacional.'
        };
    } catch (error) {
        return {
            success: false,
            authenticated: false,
            companyId: null,
            code: 'tenant-resolution-error',
            error: error && error.message ? error.message : String(error)
        };
    }
}

function getTenantId() {
    try {
        const isSessionSuperAdmin = () => {
            try {
                const current = readJsonStorageSafe('currentUser') || {};
                const persistent = readJsonStorageSafe('persistentUser') || {};
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
            const fromUserStorage = getStoredUserTenant();
            const fromRuntime = normalizeTenantContextValue(window.appTenantId);
            if (fromRuntime) {
                if (!fromUserStorage || fromUserStorage === fromRuntime) return fromRuntime;
                window.appTenantId = null;
            }
            try {
                const fromUser = fromUserStorage;
                if (fromUser) {
                    persistTenantContext(fromUser);
                    return fromUser;
                }
            } catch (_) {}
            try {
                const fromCompany = getStoredCompanyTenant();
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
                authPerfTenant(null);
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
            authPerfTenant(window.appTenantId);
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
        console.log(`[AUDIT][${String(operation || '').toUpperCase()}] tenant-scoped operation observed by ${service}`);
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

function getWindowFirebaseAuthUser() {
    try {
        if (typeof window === 'undefined') return null;
        const user = window.firebaseAuthUser || window.currentUser || null;
        return user && user.uid && (typeof user.getIdToken === 'function' || typeof user.getIdTokenResult === 'function') ? user : null;
    } catch (_) {
        return null;
    }
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
        const subscription = user && user.subscription && typeof user.subscription === 'object' ? user.subscription : {};
        const endDate = subscription.endDate ? new Date(subscription.endDate) : null;
        if (endDate && !Number.isNaN(endDate.getTime())) {
            return endDate.getTime() > Date.now() ? 'trial_active' : 'expired';
        }
        if (!user || !user.trialStart) return 'trial_active';
        const trialStartDate = new Date(user.trialStart);
        if (Number.isNaN(trialStartDate.getTime())) return 'trial_active';
        const diffDays = Math.ceil((new Date() - trialStartDate) / (1000 * 60 * 60 * 24));
        return diffDays <= getConfiguredTrialDays() ? 'trial_active' : 'expired';
    };
    const user = userDetails && typeof userDetails === 'object' ? userDetails : {};
    const normalized = String(user.subscriptionStatus || user.status || '').trim().toLowerCase();
    const subscription = user.subscription && typeof user.subscription === 'object' ? user.subscription : {};
    const subscriptionEndDate = subscription.endDate ? new Date(subscription.endDate) : null;
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
    if (normalized === 'trial_active' || normalized === 'trial' || normalized === 'teste_ativo') return resolveTrialStatus(user);
    const activeMarker = normalized === 'active' || normalized === 'ativo' || subscription.active === true;
    if (activeMarker) {
        if (!subscriptionEndDate || Number.isNaN(subscriptionEndDate.getTime())) return 'active';
        return subscriptionEndDate.getTime() > Date.now() ? 'active' : 'expired';
    }
    if (normalized === 'pending' || normalized === 'pendente' || normalized === 'pending_payment') return 'pending';
    if (user.pendingPayment && String(user.pendingPayment.status || '').toLowerCase() === 'pending') return 'pending';
    if (normalized === 'expired' || normalized === 'expirado') return 'expired';
    if (user.trialStart) return resolveTrialStatus(user);
    if (!hasStrongSignal()) return 'unknown';
    return 'expired';
}

function getSubscriptionEndTimestamp(profile) {
    const user = profile && typeof profile === 'object' ? profile : {};
    const subscription = user.subscription && typeof user.subscription === 'object' ? user.subscription : {};
    const candidates = [
        subscription.endDate,
        subscription.subscriptionEnd,
        user.subscriptionEnd,
        user.subscription_end,
        user.subscriptionEndDate,
        user.expiresAt,
        user.expirationDate,
        user.validUntil
    ];
    for (const value of candidates) {
        if (!value) continue;
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }
    return NaN;
}

function getSubscriptionStatusMarker(profile) {
    const user = profile && typeof profile === 'object' ? profile : {};
    return String(user.subscriptionStatus || user.status || '').trim().toLowerCase();
}

function isExplicitlyBlockedSubscriptionProfile(profile) {
    const user = profile && typeof profile === 'object' ? profile : {};
    const marker = getSubscriptionStatusMarker(user);
    return user.blocked === true
        || String(user.accountStatus || '').trim().toLowerCase() === 'blocked'
        || marker === 'blocked'
        || marker === 'bloqueado';
}

function isTrialSubscriptionProfile(profile) {
    const user = profile && typeof profile === 'object' ? profile : {};
    const subscription = user.subscription && typeof user.subscription === 'object' ? user.subscription : {};
    const marker = getSubscriptionStatusMarker(user);
    const type = String(
        subscription.type
        || subscription.planKey
        || subscription.key
        || user.planKey
        || user.plan
        || user.planType
        || ''
    ).trim().toLowerCase();
    return marker === 'trial'
        || marker === 'trial_active'
        || marker === 'teste_ativo'
        || type === 'trial'
        || type === 'free_trial'
        || type === 'teste';
}

function isPendingSubscriptionProfile(profile) {
    const user = profile && typeof profile === 'object' ? profile : {};
    const marker = getSubscriptionStatusMarker(user);
    const pendingStatus = String(user.pendingPayment && user.pendingPayment.status || '').trim().toLowerCase();
    return marker === 'pending'
        || marker === 'pendente'
        || marker === 'pending_payment'
        || pendingStatus === 'pending';
}

function hasSubscriptionReplicaDivergence(rootProfile, tenantProfile) {
    if (!rootProfile || !tenantProfile) return false;
    const rootStatus = getSubscriptionStatusMarker(rootProfile);
    const tenantStatus = getSubscriptionStatusMarker(tenantProfile);
    const rootEnd = getSubscriptionEndTimestamp(rootProfile);
    const tenantEnd = getSubscriptionEndTimestamp(tenantProfile);
    const sameEnd = (Number.isNaN(rootEnd) && Number.isNaN(tenantEnd)) || rootEnd === tenantEnd;
    return rootStatus !== tenantStatus || !sameEnd;
}

function buildEffectiveSubscriptionProfile(rootProfile, selectedProfile, statusKey, source, replicas) {
    const root = rootProfile && typeof rootProfile === 'object' ? rootProfile : null;
    const selected = selectedProfile && typeof selectedProfile === 'object' ? selectedProfile : {};
    const data = { ...(root || selected) };
    const rootSubscription = root && root.subscription && typeof root.subscription === 'object' ? root.subscription : {};
    const selectedSubscription = selected.subscription && typeof selected.subscription === 'object' ? selected.subscription : {};
    if (Object.keys(rootSubscription).length || Object.keys(selectedSubscription).length) {
        data.subscription = { ...rootSubscription, ...selectedSubscription };
    }
    for (const key of ['accountStatus', 'pendingPayment', 'trialStart', 'subscriptionStart', 'subscriptionEnd']) {
        if (Object.prototype.hasOwnProperty.call(selected, key)) data[key] = selected[key];
    }
    data.subscriptionStatus = statusKey;
    if (statusKey === 'blocked') data.accountStatus = 'blocked';

    const rootReplica = replicas.find((entry) => entry.source === 'root');
    const tenantReplica = replicas.find((entry) => entry.source === 'tenant');
    const warnings = hasSubscriptionReplicaDivergence(
        rootReplica && rootReplica.profile,
        tenantReplica && tenantReplica.profile
    ) ? ['subscription_replica_divergence'] : [];
    return { data, statusKey, source, warnings };
}

function reconcileSubscriptionReplicaProfiles(rootProfile, tenantProfile, nowMs = Date.now()) {
    const root = rootProfile && typeof rootProfile === 'object' ? rootProfile : null;
    const tenant = tenantProfile && typeof tenantProfile === 'object' ? tenantProfile : null;
    const replicas = [
        root ? { source: 'root', profile: root } : null,
        tenant ? { source: 'tenant', profile: tenant } : null
    ].filter(Boolean);
    if (!replicas.length) {
        return { data: null, statusKey: 'unknown', source: 'none', warnings: ['profile_missing'] };
    }

    const blocked = replicas.find(({ profile }) => isExplicitlyBlockedSubscriptionProfile(profile));
    if (blocked) return buildEffectiveSubscriptionProfile(root, blocked.profile, 'blocked', blocked.source, replicas);

    const future = replicas
        .map((entry) => ({ ...entry, endMs: getSubscriptionEndTimestamp(entry.profile) }))
        .filter((entry) => Number.isFinite(entry.endMs) && entry.endMs > nowMs)
        .sort((a, b) => b.endMs - a.endMs)[0];
    if (future) {
        const statusKey = isTrialSubscriptionProfile(future.profile) ? 'trial_active' : 'active';
        return buildEffectiveSubscriptionProfile(root, future.profile, statusKey, future.source, replicas);
    }

    const pending = replicas.find(({ profile }) => isPendingSubscriptionProfile(profile));
    if (pending) return buildEffectiveSubscriptionProfile(root, pending.profile, 'pending', pending.source, replicas);

    const dated = replicas
        .map((entry) => ({ ...entry, endMs: getSubscriptionEndTimestamp(entry.profile) }))
        .filter((entry) => Number.isFinite(entry.endMs))
        .sort((a, b) => b.endMs - a.endMs)[0];
    const selected = dated || replicas[0];
    const statusKey = resolveSubscriptionStatusForWriteGuard(selected.profile);
    return buildEffectiveSubscriptionProfile(root, selected.profile, statusKey, selected.source, replicas);
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
        if (!path) return path;
        const isGlobal = /^users(\/|$)|^subscriptionRequests(\/|$)|^companies(\/|$)|^roles(\/|$)|^system(\/|$)|^subscriptionAudit(\/|$)|^subscriptionExtensionRequests(\/|$)|^subscriptionProofHashes(\/|$)|^subscriptionPayments(\/|$)|^subscriptionSettings(\/|$)/.test(String(path));
        if (isGlobal) return path;
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
                .replace(/^data\/species(\/|$)/, 'especies$1')
                .replace(/^species(\/|$)/, 'especies$1')
                .replace(/^especiesPct(\/|$)/, 'especies$1')
                .replace(/^pedidosVenda(\/|$)/, 'vendas/pedidos$1')
                .replace(/^carregoPagamentos(\/|$)/, 'vendas/pagamentos_carrego$1');
            const isGlobal = /^users(\/|$)|^subscriptionRequests(\/|$)|^companies(\/|$)|^roles(\/|$)|^system(\/|$)|^subscriptionAudit(\/|$)|^subscriptionExtensionRequests(\/|$)|^subscriptionProofHashes(\/|$)|^subscriptionPayments(\/|$)|^subscriptionSettings(\/|$)/.test(ck);
            const nsKey = isGlobal ? ck : `companies/${t}/${ck}`;
            out[nsKey] = v;
        }
        return out;
    } catch (_) { return updatesObj || {}; }
}

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
    console.warn('⚠️ Permissão negada ao consultar caminho tenant-scoped');
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
                const token = await getIdTokenResultSingleFlight(auth.currentUser, {
                    forceRefresh: true,
                    reason: 'admin_claim_sync'
                });
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
        authPerfRead(path, 'logical');
        console.log('🔥 Carregando dados do Firebase');
        
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
            'contasReceber': ['financas/receber'],
            // Especies: caminho canonico de cadastro
            'species': ['especies'],
            'especies': ['especies'],
            'especiesPct': ['especies'],
            'data/species': ['especies']
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

            if (/^(species|especies|especiesPct|data\/species)(\/|$)/.test(String(input || ''))) {
                const rest = String(input || '')
                    .replace(/^data\/species\/?/, '')
                    .replace(/^species\/?/, '')
                    .replace(/^especiesPct\/?/, '')
                    .replace(/^especies\/?/, '');
                pushUnique(rest ? `especies/${rest}` : 'especies');
                return candidates;
            }
            
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
        const isGlobalPath = /^users(\/|$)|^subscriptionRequests(\/|$)|^companies(\/|$)|^roles(\/|$)|^system(\/|$)|^subscriptionAudit(\/|$)|^subscriptionExtensionRequests(\/|$)|^subscriptionProofHashes(\/|$)|^subscriptionPayments(\/|$)|^subscriptionSettings(\/|$)/.test(String(path || ''));
        
        // CORREÇÃO: se não for path global e !tenantId, não permitir ler da raiz absoluta!
        const finalCandidates = tenantId 
            ? (!isGlobalPath ? nsCandidates : [...candidates, ...nsCandidates])
            : (isGlobalPath ? candidates : []); 

        const deduplicatedCandidates = finalCandidates.filter((item, index, arr) => item && arr.indexOf(item) === index);
        console.log('🔍 Caminhos candidatos preparados para leitura');
        
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
                    authPerfRead(candidate, 'physical');
                    const snapshot = await get(child(dbRef, candidate));
                    exists = snapshot.exists();
                    data = snapshot.val();
                } catch (getError) {
                    if (getError.message && getError.message.includes('Maximum call stack size exceeded')) {
                        console.warn('⚠️ Erro de recursão no SDK Modular. Tentando REST API como fallback...');
                        
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
                            
                            authPerfRead(candidate, 'physical');
                            const response = await fetch(url);
                            if (response.ok) {
                                data = await response.json();
                                exists = data !== null;
                                console.log('✅ Dados recuperados via REST API');
                            } else {
                                throw new Error(`REST API retornou ${response.status}`);
                            }
                        } catch (restError) {
                            console.warn(`⚠️ Falha no fallback REST API:`, restError);
                            
                            // Última tentativa: SDK Compat (se disponível)
                            if (window.firebase && window.firebase.database) {
                                authPerfRead(candidate, 'physical');
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
                    console.log('✅ Dados carregados do Firebase');
                    return { success: true, data, source: 'firebase', path: candidate };
                } else {
                    console.log('ℹ️ Nenhum dado encontrado no caminho consultado');
                }
            } catch (e) {
                if (isPermissionDeniedError(e) && isPrivilegedAdminPath(candidate)) {
                    hadPermissionDenied = true;
                    const recovered = await ensurePrivilegedReadAccess();
                    if (recovered) {
                        try {
                            authPerfRead(candidate, 'physical');
                            const retried = await get(child(dbRef, candidate));
                            if (retried.exists()) {
                                return { success: true, data: retried.val(), source: 'firebase', path: candidate };
                            }
                        } catch (_) {}
                    }
                    warnPermissionDeniedThrottled(candidate, e);
                    continue;
                }
                console.warn('⚠️ Erro ao tentar caminho candidato do Firebase');
            }
        }
        
        // Caminhos opcionais: podem estar vazios sem representar erro de dados
        // Inclui aliases e variantes que podem ser passados por diferentes módulos
        const OPTIONAL_EMPTY_PATHS = new Set([
            'produtos',
            'estoqueComprasMov',
            'romaneios/tora',
            'romaneios/pct',
            'romaneios/tl',
            'romaneios/pes',
            'vendas/pagamentos_carrego',
            'carregoPagamentos',           // alias camelCase usado em alguns módulos
            'vendas_pagamentos_carrego',    // alias snake_case
            'system/operationalAlerts/firebaseBilling',
            'system/deployHealth/firebase'
        ]);
        if (OPTIONAL_EMPTY_PATHS.has(path)) {
            console.log('ℹ️ Caminho consultado está vazio no Firebase');
            return { success: true, data: null, source: 'firebase' };
        }
        if (hadPermissionDenied) {
            return { success: true, data: null, source: 'firebase', permissionDenied: true };
        }
        // ⚠️ Aviso enriquecido: inclui os caminhos candidatos tentados para facilitar diagnóstico
        console.warn('⚠️ Nenhum dos caminhos candidatos retornou dados');
        return { success: true, data: null, source: 'firebase' };

        
    } catch (error) {
        console.error('❌ Erro ao carregar dados do Firebase:', error && error.code ? error.code : 'unknown');
        return {
            success: false,
            error: error.message,
            data: null
        };
    }
}

async function loadRecentFromFirebase(path, orderBy = 'createdAt', maxItems = 50) {
    authPerfRead(path, 'logical');
    const cleanPath = String(path || '').replace(/^\/+|\/+$/g, '');
    const safeOrderBy = String(orderBy || 'createdAt').trim();
    const safeLimit = Math.max(1, Math.min(200, Number.parseInt(maxItems, 10) || 50));
    if (!cleanPath || !/^[-A-Za-z0-9_/]+$/.test(cleanPath)) {
        throw new Error('Caminho inválido para consulta limitada.');
    }
    if (!safeOrderBy || !/^[-A-Za-z0-9_/]+$/.test(safeOrderBy)) {
        throw new Error('Ordenação inválida para consulta limitada.');
    }
    const status = isFirebaseOperational();
    if (!status.operational) {
        throw new Error(`Firebase não operacional: ${status.message}`);
    }
    tenantAuditLog('READ_LIMITED', cleanPath, cleanPath, 'firebaseService');
    authPerfRead(cleanPath, 'physical');
    const snapshot = await get(query(
        child(ref(db), cleanPath),
        orderByChild(safeOrderBy),
        limitToLast(safeLimit)
    ));
    return {
        success: true,
        data: snapshot.exists() ? snapshot.val() : null,
        source: 'firebase',
        path: cleanPath,
        limit: safeLimit
    };
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
                const token = await getIdTokenResultSingleFlight(authUser, {
                    forceRefresh: true,
                    reason: 'admin_claim_sync'
                });
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
                    await getIdTokenResultSingleFlight(auth.currentUser, {
                        forceRefresh: true,
                        reason: 'admin_claim_sync'
                    });
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
        console.log('🔥 Salvando dados no Firebase');

        const isSpeciesPath = /^(species|especies|especiesPct|data\/species)(\/|$)/.test(String(path || ''));
        const normalizeSpeciesItem = (item) => {
            if (!item || typeof item !== 'object') return item;
            const name = String(item.especie || item.nome || item.name || item.nomeComum || item.commonName || '').trim();
            const scientificName = String(item.nomeCientifico || item.scientificName || item.scientific || item.descricao || item.description || item.decription || item.desc || '').trim();
            const excluded = new Set(['key', 'firebaseKey', 'nome', 'name', 'nomeComum', 'commonName', 'description', 'descricao', 'decription', 'desc', 'scientificName', 'scientific', 'nomeCientífico']);
            const clean = {};
            Object.keys(item).forEach((field) => {
                if (field.startsWith('__') || excluded.has(field)) return;
                if (item[field] !== undefined) clean[field] = item[field];
            });
            clean.id = item.id || item.key || item.firebaseKey || clean.id;
            clean.especie = name;
            clean.nomeCientifico = scientificName;
            clean.ativo = item.ativo !== false;
            clean.createdAt = item.createdAt || item.created || clean.createdAt || new Date().toISOString();
            clean.updatedAt = item.updatedAt || item.updated || new Date().toISOString();
            return clean;
        };
        if (isSpeciesPath && data) {
            if (Array.isArray(data)) {
                data = data.map(normalizeSpeciesItem);
            } else if (typeof data === 'object') {
                const looksLikeMap = !data.nome && !data.name && Object.values(data).some(value => value && typeof value === 'object');
                data = looksLikeMap
                    ? Object.fromEntries(Object.entries(data).map(([itemId, item]) => [itemId, normalizeSpeciesItem({ id: itemId, ...item })]))
                    : normalizeSpeciesItem(data);
            }
        }
        
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
            'species': ['especies'],
            'especies': ['especies'],
            'especiesPct': ['especies'],
            'data/species': ['especies'],
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

            if (/^(species|especies|especiesPct|data\/species)(\/|$)/.test(String(input || ''))) {
                const rest = String(input || '')
                    .replace(/^data\/species\/?/, '')
                    .replace(/^species\/?/, '')
                    .replace(/^especiesPct\/?/, '')
                    .replace(/^especies\/?/, '');
                pushUnique(rest ? `especies/${rest}` : 'especies');
                return candidates;
            }
            
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
            console.log('✅ Caminho canônico de escrita PCT definido');
        } else if (String(path || '').toLowerCase() === 'clients' || candidates.some(c => String(c || '').toLowerCase() === 'clients')) {
            writePath = 'clients';
            console.log('✅ Caminho canônico de escrita de clientes definido');
        } else if (/^(species|especies|especiesPct|data\/species)(\/|$)/.test(String(path || '')) || candidates.some(c => /^(species|especies|especiesPct|data\/species)(\/|$)/.test(String(c || '')))) {
            const rest = String(path || '')
                .replace(/^data\/species\/?/, '')
                .replace(/^species\/?/, '')
                .replace(/^especiesPct\/?/, '')
                .replace(/^especies\/?/, '');
            writePath = rest && rest !== path ? `especies/${rest}` : 'especies';
            console.log('✅ Caminho canônico de escrita de espécies definido');
        } else if (path === 'pedidosVenda' || candidates.includes('pedidosVenda')) {
            writePath = 'vendas/pedidos';
            console.log('✅ Caminho de escrita de pedidos definido');
        } else if (path === 'carregoPagamentos' || candidates.includes('carregoPagamentos')) {
            writePath = 'vendas/pagamentos_carrego';
            console.log('✅ Caminho de escrita de pagamentos definido');
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
                            console.log('✅ Caminho de escrita resolvido');
                            break;
                        }
                    } catch (e) {
                        // Ignore permission denied during check - it just means we can't read it to verify existence
                        // We will proceed with default path
                        console.warn('⚠️ Erro ao verificar caminho candidato para escrita');
                    }
                }
            } catch (_) {}
            
            // Se nenhum existente encontrado, preferir snake_case para romaneios (mas manter lógica original de path relativo)
            if (writePath === path) {
                const snakePreferred = candidates.find(c => c.includes('romaneios_'));
                if (snakePreferred) {
                    writePath = snakePreferred;
                    console.log('ℹ️ Usando alias preferido para escrita');
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
                console.warn('⚠️ Erro de recursão no set(). Tentando REST API como fallback...');
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
                console.log('✅ Dados salvos via REST fallback');
            }
        };
        
        if (key === null || key === undefined) {
            // Se key é null, avaliar substituição completa vs. salvamento por registro
            const perRecordNames = new Set(['romaneiosPct', 'contasReceber', 'contasPagar', 'especies']);
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
                console.log(`✅ ${ok} item(s) salvos por registro`);
            } else {
                // Substituir todos os dados no path
                const finalWritePath = getNamespacedPath(writePath);
                const writePermission = validateWritePermissionBySubscription(finalWritePath);
                if (!writePermission.allowed) return denyReadOnlyWrite(finalWritePath, writePermission.status);
                tenantAuditLog('WRITE', path, finalWritePath, 'firebaseService');
                reference = ref(db, finalWritePath);
                await setWithFallback(reference, data, finalWritePath);
                resultKey = writePath;
                console.log('✅ Dados salvos com substituição completa');
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
            console.log('✅ Dados salvos com chave auto-gerada');
        } else {
            // Se key é fornecida, usar set no caminho específico
            const finalWritePath = `${getNamespacedPath(writePath)}/${key}`;
            const writePermission = validateWritePermissionBySubscription(finalWritePath);
            if (!writePermission.allowed) return denyReadOnlyWrite(finalWritePath, writePermission.status);
            tenantAuditLog('WRITE', path, finalWritePath, 'firebaseService');
            reference = ref(db, finalWritePath);
            await setWithFallback(reference, data, finalWritePath);
            resultKey = key;
            console.log('✅ Dados salvos no Firebase');
        }
        
        return {
            success: true,
            key: resultKey,
            source: usedRestWriteFallback ? 'firebase_rest_fallback' : 'firebase'
        };
        
    } catch (error) {
        console.error('❌ Erro ao salvar dados no Firebase:', error && error.code ? error.code : 'unknown');
        
        // Tratamento específico para PERMISSION_DENIED
        if (error.code === 'PERMISSION_DENIED' || error.message.includes('permission_denied')) {
            console.error('🛑 ERRO DE PERMISSÃO: Verifique se o usuário tem companyId e se os dados (ex: numero) estão válidos.');
            
            // Tentar diagnosticar o problema
            const t = getTenantId();
            if (!t) console.warn('⚠️ TenantId (companyId) não identificado no cliente.');
            else console.log('ℹ️ Empresa ativa identificada na sessão');
            const retried = !!(options && options.__claimRetryDone);
            if (!retried) {
                try {
                    const currentUid = auth && auth.currentUser && auth.currentUser.uid ? String(auth.currentUser.uid) : '';
                    if (currentUid && t && typeof setCompanyClaim === 'function') {
                        const claimSync = await setCompanyClaim(currentUid, t);
                        if (claimSync && claimSync.success) {
                            try {
                                if (auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
                                    await getIdTokenResultSingleFlight(auth.currentUser, {
                                        forceRefresh: true,
                                        reason: 'authenticated_retry'
                                    });
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

function getCallableErrorMessage(functionName, error) {
    const rawCode = String((error && error.code) || '').toLowerCase();
    const rawMessage = String((error && error.message) || error || '').trim();
    const detailsMessage = error && error.details && typeof error.details === 'object'
        ? String(error.details.message || error.details.error || '').trim()
        : '';
    const sourceMessage = detailsMessage || rawMessage;
    if (rawCode.includes('unauthenticated')) {
        return 'Sessão expirada. Entre novamente no Sisweb para executar esta ação administrativa.';
    }
    if (rawCode.includes('permission-denied')) {
        return 'Permissão insuficiente para executar esta ação. Confirme se o usuário atual é SuperAdmin.';
    }
    if (rawCode.includes('not-found')) {
        return sourceMessage || 'Registro necessário não foi encontrado para concluir a ação.';
    }
    if (rawCode.includes('failed-precondition') || rawCode.includes('invalid-argument')) {
        return sourceMessage || 'A ação não pode ser concluída com os dados atuais.';
    }
    if (rawCode.includes('internal') || /\\binternal\\b/i.test(rawMessage)) {
        return `Erro interno na Function ${functionName}. A ação não foi confirmada; confira os logs da Function e tente novamente.`;
    }
    return sourceMessage || `Falha ao executar a Function ${functionName}.`;
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
            return { success: false, error: getCallableErrorMessage(functionName, firstError) };
        }
        try {
            if (auth && auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
                await getIdTokenResultSingleFlight(auth.currentUser, {
                    forceRefresh: true,
                    reason: 'admin_claim_sync'
                });
            }
        } catch (_) {}
        try {
            await syncMyAdminClaims();
        } catch (_) {}
        try {
            if (auth && auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
                await getIdTokenResultSingleFlight(auth.currentUser, {
                    forceRefresh: true,
                    reason: 'admin_claim_sync'
                });
            }
        } catch (_) {}
        try {
            return await run();
        } catch (secondError) {
            return { success: false, error: getCallableErrorMessage(functionName, secondError) };
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

async function processPaymentBrick(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'processPaymentBrick');
        const result = await callable(data);
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function createPaymentPreference(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'createPaymentPreference');
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

async function callFunction(functionName, payload = {}) {
    const safeName = String(functionName || '').trim();
    if (!safeName) throw new Error('Nome da Cloud Function não informado.');
    const functions = getFunctions(app);
    const callable = httpsCallable(functions, safeName);
    const safePayload = payload && typeof payload === 'object' ? payload : {};
    const currentUser = await primeCallableAuthSession(4500);
    const needsAuth = requiresAuthenticatedCallable(safeName);
    if (needsAuth && !currentUser) {
        throw new Error('Sessão autenticada não encontrada. Faça login novamente para continuar.');
    }
    if (needsAuth && currentUser) {
        try {
            await getCallableIdToken(currentUser, false);
            const result = await callable(safePayload);
            return unwrapCallableResult(result);
        } catch (error) {
            if (!isCallableUnauthenticatedError(error)) throw error;
            await getCallableIdToken(currentUser, true);
            const retried = await callable(safePayload);
            return unwrapCallableResult(retried);
        }
    }
    try {
        const result = await callable(safePayload);
        return unwrapCallableResult(result);
    } catch (error) {
        if (currentUser && isCallableUnauthenticatedError(error) && typeof currentUser.getIdTokenResult === 'function') {
            try {
                await getIdTokenResultSingleFlight(currentUser, {
                    forceRefresh: true,
                    reason: 'authenticated_retry'
                });
                const retried = await callable(safePayload);
                return unwrapCallableResult(retried);
            } catch (_) {}
        }
        throw error;
    }
}

async function callSupportFunction(functionName, payload = {}) {
    try {
        const data = await callFunction(functionName, payload && typeof payload === 'object' ? payload : {});
        return { success: true, data };
    } catch (error) {
        const rawMessage = String(error && error.message ? error.message : error || '');
        const lower = rawMessage.toLowerCase();
        if (lower.includes('not found') || lower.includes('404')) {
            return { success: false, error: `Cloud Function '${functionName}' não encontrada. Faça deploy das Functions para habilitar tickets de suporte.` };
        }
        if (lower.includes('cors') || lower.includes('failed to fetch') || lower.includes('network')) {
            return { success: false, error: `Falha de rede/CORS ao chamar '${functionName}'. Verifique deploy e conexão.` };
        }
        return { success: false, error: rawMessage || `Falha ao chamar '${functionName}'.` };
    }
}

async function createSupportTicket(payload) {
    return callSupportFunction('createSupportTicket', payload);
}

async function sendPublicSupportEmail(payload) {
    return callSupportFunction('sendPublicSupportEmail', payload);
}

async function addSupportTicketMessage(ticketId, message, options = {}) {
    return callSupportFunction('addSupportTicketMessage', {
        ...(options && typeof options === 'object' ? options : {}),
        ticketId,
        message
    });
}

async function listMySupportTickets(options = {}) {
    return callSupportFunction('listMySupportTickets', options);
}

async function getSupportTicket(ticketId, options = {}) {
    return callSupportFunction('getSupportTicket', {
        ...(options && typeof options === 'object' ? options : {}),
        ticketId
    });
}

async function updateSupportTicketStatus(ticketId, payload = {}) {
    return callSupportFunction('updateSupportTicketStatus', {
        ...(payload && typeof payload === 'object' ? payload : {}),
        ticketId
    });
}

async function listSupportTicketsAdmin(filters = {}) {
    return callSupportFunction('listSupportTicketsAdmin', filters);
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

async function uploadFile(path, file, options = {}) {
    try {
        if (!file) throw new Error('Arquivo não informado.');
        const safePath = String(path || '').replace(/^\/+/, '').trim();
        if (!safePath || safePath.includes('..') || safePath.includes('//')) {
            throw new Error('Caminho de Storage inválido.');
        }
        const metadata = {};
        const contentType = String(options.contentType || file.type || '').trim();
        if (contentType) metadata.contentType = contentType;
        if (options.customMetadata && typeof options.customMetadata === 'object') {
            metadata.customMetadata = options.customMetadata;
        }
        const fileRef = storageRef(storage, safePath);
        const snapshot = await uploadBytes(fileRef, file, metadata);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return {
            success: true,
            path: safePath,
            storagePath: safePath,
            downloadURL,
            url: downloadURL,
            name: String(file.name || '').trim(),
            contentType,
            size: Number(file.size || 0)
        };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function getStorageDownloadURL(pathOrUrl) {
    const raw = String(pathOrUrl || '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:|file:)/i.test(raw)) return raw;
    const safePath = raw.replace(/^\/+/, '');
    if (safePath.includes('..') || safePath.includes('//')) throw new Error('Caminho de Storage inválido.');
    const fileRef = storageRef(storage, safePath);
    return await getDownloadURL(fileRef);
}

function inferStorageImageType(pathOrUrl) {
    const raw = String(pathOrUrl || '').split('?')[0].toLowerCase();
    if (raw.endsWith('.jpg') || raw.endsWith('.jpeg')) return 'image/jpeg';
    if (raw.endsWith('.webp')) return 'image/webp';
    if (raw.endsWith('.gif')) return 'image/gif';
    if (raw.endsWith('.svg')) return 'image/svg+xml';
    return 'image/png';
}

function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function extractFirebaseStoragePathFromUrl(pathOrUrl) {
    const raw = String(pathOrUrl || '').trim();
    if (!raw) return '';
    if (/^gs:\/\//i.test(raw)) {
        return raw.replace(/^gs:\/\/[^/]+\//i, '').replace(/^\/+/, '');
    }
    if (!/^https?:\/\//i.test(raw)) return '';
    try {
        const url = new URL(raw, typeof window !== 'undefined' && window.location ? window.location.origin : undefined);
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

async function getStorageDataURL(pathOrUrl, maxBytes = 2 * 1024 * 1024) {
    const raw = String(pathOrUrl || '').trim();
    if (!raw) return '';
    if (/^data:image\//i.test(raw)) return raw;
    const storagePathFromUrl = extractFirebaseStoragePathFromUrl(raw);
    if (/^https?:\/\//i.test(raw) && !storagePathFromUrl) {
        const response = await fetch(raw, { mode: 'cors' });
        if (!response.ok) throw new Error(`Falha ao baixar imagem do Storage (${response.status}).`);
        const blob = await response.blob();
        if (!String(blob.type || '').startsWith('image/')) throw new Error('Arquivo do Storage não é uma imagem.');
        if (blob.size > maxBytes) throw new Error('Imagem do Storage excede 2MB.');
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Falha ao converter imagem para DataURL.'));
            reader.readAsDataURL(blob);
        });
    }
    const safePath = (storagePathFromUrl || raw).replace(/^\/+/, '');
    if (safePath.includes('..') || safePath.includes('//')) throw new Error('Caminho de Storage inválido.');
    const isTenantLogoPath = /^companies\/[^/]+\/profile\/logo\/[^/]+$/i.test(safePath);
    if (isTenantLogoPath) {
        try {
            const result = await callFunction('getCompanyLogoDataUrl', {
                storagePath: safePath,
                maxBytes: Math.min(Number(maxBytes || 0) || (2 * 1024 * 1024), 2 * 1024 * 1024)
            });
            const payload = result && result.success !== false ? (result.data || result) : null;
            const dataUrl = String(payload && (payload.dataUrl || payload.logoDataUrl || payload.logo || '') || '').trim();
            if (/^data:image\/(png|jpe?g|webp);base64,/i.test(dataUrl)) return dataUrl;
            throw new Error((result && result.error) || 'Logo não retornou DataURL válido.');
        } catch (error) {
            throw new Error(`Logo da empresa indisponível pelo backend: ${error && error.message ? error.message : String(error)}`);
        }
    }
    const bytes = await getBytes(storageRef(storage, safePath), maxBytes);
    return `data:${inferStorageImageType(safePath)};base64,${bytesToBase64(bytes)}`;
}

async function deleteStorageFile(pathOrUrl) {
    try {
        const raw = String(pathOrUrl || '').trim();
        if (!raw) throw new Error('Caminho de Storage não informado.');
        if (/^https?:\/\//i.test(raw)) throw new Error('Remoção exige caminho do Storage, não URL pública.');
        const safePath = raw.replace(/^\/+/, '');
        if (safePath.includes('..') || safePath.includes('//')) throw new Error('Caminho de Storage inválido.');
        await deleteObject(storageRef(storage, safePath));
        return { success: true };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function uploadCompanyLogo(file, companyId, options = {}) {
    try {
        if (!file) throw new Error('Arquivo de logo não informado.');
        const tenant = sanitizeReportCompanyId(companyId || options.companyId || getTenantId());
        if (!tenant) throw new Error('companyId inválido para upload da logo.');
        const contentType = String(file.type || options.contentType || '').trim();
        if (!contentType.startsWith('image/')) throw new Error('A logo precisa ser uma imagem.');
        const maxSize = Number(options.maxSize || (2 * 1024 * 1024));
        if (Number(file.size || 0) > maxSize) throw new Error('A logo deve ter no máximo 2MB para cumprir as regras do Storage.');
        const safeName = String(file.name || 'logo.png').replace(/[^\w.\-]+/g, '_').slice(0, 90) || 'logo.png';
        const path = `companies/${tenant}/profile/logo/current`;
        const logoPrefix = `companies/${tenant}/profile/logo/`;
        const previousRaw = String(
            options.previousStoragePath
            || options.previousPath
            || options.logoStoragePath
            || options.logoPath
            || options.previousLogoUrl
            || options.logoUrl
            || ''
        ).trim();
        const previousPath = (extractFirebaseStoragePathFromUrl(previousRaw) || previousRaw).replace(/^\/+/, '');
        const upload = await uploadFile(path, file, {
            contentType,
            customMetadata: {
                companyId: tenant,
                module: 'company-profile',
                kind: 'logo',
                uploadedAt: new Date().toISOString()
            }
        });
        if (!upload || upload.success === false) {
            throw new Error((upload && upload.error) || 'Falha no upload da logo.');
        }
        const previousStoragePath = (
            previousPath &&
            previousPath !== path &&
            previousPath.startsWith(logoPrefix) &&
            !previousPath.includes('..') &&
            !previousPath.includes('//')
        ) ? previousPath : '';
        return {
            success: true,
            data: {
                path,
                storagePath: path,
                downloadURL: upload.downloadURL,
                url: upload.downloadURL,
                name: safeName,
                contentType,
                size: Number(file.size || 0),
                updatedAt: new Date().toISOString(),
                replacedStoragePath: '',
                previousStoragePath,
                cleanup: {
                    attempted: false,
                    success: false,
                    deferred: !!previousStoragePath,
                    path: previousStoragePath
                }
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

async function grantAdminFreeTrial(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('grantAdminFreeTrial', data);
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

async function fullUserCleanup(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('fullUserCleanup', data);
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

async function listPromoCodesAdmin(payload = {}) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('listPromoCodesAdmin', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function getPromoCodeAdmin(payload = {}) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('getPromoCodeAdmin', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function upsertPromoCodeAdmin(payload = {}) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('upsertPromoCodeAdmin', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function archivePromoCodeAdmin(payload = {}) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('archivePromoCodeAdmin', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

async function validatePromoCode(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const functions = getFunctions(app);
        const callable = httpsCallable(functions, 'validatePromoCode');
        const result = await callable(data);
        return { success: true, data: result && result.data ? result.data : null };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

const REPORT_COMPANY_BLOCKED_IDS = new Set([
    'users',
    'companies',
    'roles',
    'subscriptionrequests',
    'subscriptionaudit',
    'subscriptionextensionrequests',
    'subscriptionproofhashes',
    'subscriptionpayments',
    'subscriptionsettings',
    'system',
    '__no_tenant__'
]);

const REPORT_COMPANY_DEFAULTS = {
    nome: "Empresa não informada",
    name: "Empresa não informada",
    cnpj: "-",
    taxId: "-",
    endereco: "-",
    address: "-",
    cidade: "-",
    city: "-",
    estado: "-",
    state: "-",
    telefone: "-",
    phone: "-",
    email: "-",
    logo: "",
    logoUrl: "",
    logoSvg: true
};

function firstReportValue(...values) {
    for (const value of values) {
        if (value === null || value === undefined) continue;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) return trimmed;
            continue;
        }
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
}

function sanitizeReportCompanyId(value) {
    const raw = firstReportValue(value);
    if (!raw) return '';
    if (raw.length > 128) return '';
    if (/[\/.#$\[\]\s]/.test(raw)) return '';
    if (REPORT_COMPANY_BLOCKED_IDS.has(raw.toLowerCase())) return '';
    return raw;
}

function readReportJsonStorage(key) {
    try {
        if (typeof localStorage === 'undefined') return null;
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (_) {
        return null;
    }
}

function getReportCompanyIdFromClaims(claims) {
    if (!claims || typeof claims !== 'object') return '';
    return sanitizeReportCompanyId(claims.companyId || claims.companyID || claims.tenantId);
}

function getReportCompanyIdFromUserObject(user) {
    if (!user || typeof user !== 'object') return '';
    return sanitizeReportCompanyId(
        user.companyId
        || user.companyID
        || user.tenantId
        || getReportCompanyIdFromClaims(user.claims)
    );
}

function getReportCompanyIdFromCompanyObject(company) {
    if (!company || typeof company !== 'object') return '';
    return sanitizeReportCompanyId(company.companyId || company.companyID || company.tenantId || company.id);
}

function getReportCurrentUid() {
    try {
        if (auth && auth.currentUser && auth.currentUser.uid) return String(auth.currentUser.uid);
    } catch (_) {}
    try {
        const current = readReportJsonStorage('currentUser') || {};
        const persistent = readReportJsonStorage('persistentUser') || {};
        return firstReportValue(current.uid, current.userId, current.authUid, persistent.uid, persistent.userId, persistent.authUid);
    } catch (_) {
        return '';
    }
}

function unwrapReportFirebaseResult(result) {
    if (!result) return null;
    if (typeof result !== 'object') return result;
    if (Object.prototype.hasOwnProperty.call(result, 'success') && Object.prototype.hasOwnProperty.call(result, 'data')) {
        return result.success === false ? null : result.data;
    }
    if (Object.prototype.hasOwnProperty.call(result, 'data') && Object.keys(result).length <= 2) {
        return result.data;
    }
    return result;
}

function normalizeReportLogo(value) {
    let candidate = value;
    if (candidate && typeof candidate === 'object') {
        candidate = candidate.url || candidate.downloadURL || candidate.logoUrl || candidate.logoURL || candidate.storagePath || candidate.logoStoragePath || candidate.path || candidate.base64 || candidate.data || candidate.value || '';
    }
    const s = firstReportValue(candidate);
    if (!s) return '';
    if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('file:')) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 80) return `data:image/png;base64,${s}`;
    if (/^(\.\/|\.\.\/|\/)/.test(s) || /\.(png|jpg|jpeg|webp|svg)$/i.test(s)) return s;
    return s;
}

function normalizeReportAddressValue(value) {
    if (!value || typeof value !== 'object') return firstReportValue(value);
    return [
        firstReportValue(value.logradouro, value.rua, value.street, value.endereco, value.address),
        firstReportValue(value.numero, value.number),
        firstReportValue(value.bairro, value.district),
        firstReportValue(value.complemento, value.complement)
    ].filter(Boolean).join(', ');
}

function normalizeCompanyProfileForReport(raw = {}, companyId = '', options = {}) {
    const includeDefaults = options.includeDefaults !== false;
    const source = raw && typeof raw === 'object' ? raw : {};
    const addressObject = source.endereco && typeof source.endereco === 'object'
        ? source.endereco
        : (source.address && typeof source.address === 'object' ? source.address : {});
    const resolvedId = sanitizeReportCompanyId(
        source.companyId
        || source.companyID
        || source.tenantId
        || source.id
        || companyId
    );
    const name = firstReportValue(source.nome, source.name, source.razaoSocial, source.fantasia, source.companyName);
    const cnpj = firstReportValue(source.cnpj, source.taxId, source.cpfCnpj, source.documento);
    const address = firstReportValue(
        normalizeReportAddressValue(source.endereco),
        normalizeReportAddressValue(source.address)
    );
    const city = firstReportValue(source.cidade, source.city, source.municipio, addressObject.cidade, addressObject.city, addressObject.municipio);
    const state = firstReportValue(source.estado, source.state, source.uf, addressObject.estado, addressObject.state, addressObject.uf);
    const phone = firstReportValue(source.telefone, source.phone, source.celular, source.whatsapp);
    const email = firstReportValue(source.email, source.emailContato, source.contactEmail);
    const responsibleName = firstReportValue(source.responsibleName, source.responsavel, source.nomeResponsavel, source.owner);
    const number = firstReportValue(source.numero, source.number, addressObject.numero, addressObject.number);
    const neighborhood = firstReportValue(source.bairro, source.neighborhood, source.district, addressObject.bairro, addressObject.neighborhood, addressObject.district);
    const complement = firstReportValue(source.complemento, source.complement, addressObject.complemento, addressObject.complement);
    const logoStoragePath = firstReportValue(source.logoStoragePath, source.logoPath, source.storagePath, source.logoRef);
    const logo = normalizeReportLogo(source.logoUrl || source.logoURL || source.logoDownloadURL || source.logo || logoStoragePath || source.logoBase64 || source.logoData);
    const pixChaveCobranca = firstReportValue(source.pixChaveCobranca);
    const pixTipoChaveCobranca = firstReportValue(source.pixTipoChaveCobranca);
    const pixFavorecidoCobranca = firstReportValue(source.pixFavorecidoCobranca);
    const pixBancoCobranca = firstReportValue(source.pixBancoCobranca);

    const normalized = includeDefaults ? { ...REPORT_COMPANY_DEFAULTS } : {};
    if (resolvedId) {
        normalized.id = resolvedId;
        normalized.companyId = resolvedId;
        normalized.tenantId = resolvedId;
    }
    if (name) {
        normalized.nome = name;
        normalized.name = name;
    }
    if (cnpj) {
        normalized.cnpj = cnpj;
        normalized.taxId = cnpj;
    }
    if (address) {
        normalized.endereco = address;
        normalized.address = address;
    }
    if (city) {
        normalized.cidade = city;
        normalized.city = city;
    }
    if (state) {
        normalized.estado = state;
        normalized.state = state;
        normalized.uf = state;
    }
    if (phone) {
        normalized.telefone = phone;
        normalized.phone = phone;
    }
    if (email) normalized.email = email;
    if (responsibleName) {
        normalized.responsavel = responsibleName;
        normalized.responsibleName = responsibleName;
    }
    if (number) {
        normalized.numero = number;
        normalized.number = number;
    }
    if (neighborhood) {
        normalized.bairro = neighborhood;
        normalized.neighborhood = neighborhood;
    }
    if (complement) {
        normalized.complemento = complement;
        normalized.complement = complement;
    }
    if (logo) {
        normalized.logo = logo;
        normalized.logoUrl = logo;
        normalized.logoSvg = false;
    }
    if (logoStoragePath) {
        normalized.logoStoragePath = logoStoragePath;
        normalized.logoPath = logoStoragePath;
    }
    if (pixChaveCobranca) normalized.pixChaveCobranca = pixChaveCobranca;
    if (pixTipoChaveCobranca) normalized.pixTipoChaveCobranca = pixTipoChaveCobranca;
    if (pixFavorecidoCobranca) normalized.pixFavorecidoCobranca = pixFavorecidoCobranca;
    if (pixBancoCobranca) normalized.pixBancoCobranca = pixBancoCobranca;
    const logoFileName = firstReportValue(source.logoFileName, source.logoName);
    const logoContentType = firstReportValue(source.logoContentType, source.logoMimeType);
    const logoSize = firstReportValue(source.logoSize);
    const logoUpdatedAt = firstReportValue(source.logoUpdatedAt);
    if (logoFileName) normalized.logoFileName = logoFileName;
    if (logoContentType) normalized.logoContentType = logoContentType;
    if (logoSize) normalized.logoSize = logoSize;
    if (logoUpdatedAt) normalized.logoUpdatedAt = logoUpdatedAt;

    const inscricaoEstadual = firstReportValue(source.inscricaoEstadual, source.ie, source.stateRegistration);
    const cep = firstReportValue(source.cep, source.zip, source.postalCode, addressObject.cep, addressObject.zip, addressObject.postalCode);
    if (inscricaoEstadual) {
        normalized.inscricaoEstadual = inscricaoEstadual;
        normalized.ie = inscricaoEstadual;
    }
    if (cep) {
        normalized.cep = cep;
        normalized.zip = cep;
    }

    return normalized;
}

function hasReportCompanyIdentity(data) {
    if (!data || typeof data !== 'object') return false;
    const normalized = normalizeCompanyProfileForReport(data, '', { includeDefaults: false });
    const name = normalized.nome || normalized.name || '';
    const cnpj = normalized.cnpj || normalized.taxId || '';
    const address = normalized.endereco || normalized.address || '';
    const phone = normalized.telefone || normalized.phone || '';
    return !!(
        (name && name !== REPORT_COMPANY_DEFAULTS.nome)
        || (cnpj && cnpj !== '-')
        || (address && address !== '-')
        || (phone && phone !== '-')
        || normalized.email
        || normalized.logo
    );
}

function mergeReportCompanyData(target, source, companyId, override = false) {
    if (!source || typeof source !== 'object') return target;
    const normalized = normalizeCompanyProfileForReport(source, companyId, { includeDefaults: false });
    Object.entries(normalized).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        if (override || target[key] === undefined || target[key] === null || target[key] === '' || target[key] === '-') {
            target[key] = value;
        }
    });
    return target;
}

async function resolveReportCompanyId(options = {}) {
    const explicit = sanitizeReportCompanyId(options.companyId || options.companyID || options.tenantId);
    if (explicit) {
        setTenantId(explicit);
        return explicit;
    }

    try {
        if (auth && auth.currentUser && typeof auth.currentUser.getIdTokenResult === 'function') {
            const token = await auth.currentUser.getIdTokenResult();
            const fromClaims = getReportCompanyIdFromClaims(token && token.claims);
            if (fromClaims) {
                setTenantId(fromClaims);
                return fromClaims;
            }
        }
    } catch (_) {}

    const current = readReportJsonStorage('currentUser') || {};
    const persistent = readReportJsonStorage('persistentUser') || {};
    const fromStoredUser = getReportCompanyIdFromUserObject(current) || getReportCompanyIdFromUserObject(persistent);
    if (fromStoredUser) {
        setTenantId(fromStoredUser);
        return fromStoredUser;
    }

    const uid = getReportCurrentUid();
    if (uid) {
        try {
            const userRecord = unwrapReportFirebaseResult(await loadFromFirebase(`users/${uid}`));
            const fromUserRecord = getReportCompanyIdFromUserObject(userRecord);
            if (fromUserRecord) {
                setTenantId(fromUserRecord);
                return fromUserRecord;
            }
        } catch (_) {}
    }

    try {
        const fromRuntime = sanitizeReportCompanyId(getTenantId());
        if (fromRuntime) {
            setTenantId(fromRuntime);
            return fromRuntime;
        }
    } catch (_) {}

    try {
        if (typeof window !== 'undefined') {
            const fromWindow = sanitizeReportCompanyId(window.appTenantId);
            if (fromWindow) {
                setTenantId(fromWindow);
                return fromWindow;
            }
        }
    } catch (_) {}

    const companyInfo = readReportJsonStorage('company_info') || {};
    const fromCompanyInfo = getReportCompanyIdFromCompanyObject(companyInfo);
    if (fromCompanyInfo) {
        setTenantId(fromCompanyInfo);
        return fromCompanyInfo;
    }

    return '';
}

async function loadReportCompanyNode(path, warnings) {
    try {
        const result = await loadFromFirebase(path);
        const data = unwrapReportFirebaseResult(result);
        return data && typeof data === 'object' ? data : null;
    } catch (error) {
        if (warnings) warnings.push(`${path}: ${error && error.message ? error.message : String(error)}`);
        return null;
    }
}

async function getCompanyProfileForReport(options = {}) {
    const warnings = [];
    const companyId = await resolveReportCompanyId(options);
    let companyData = {};
    let source = '';

    if (companyId) {
        const profileData = await loadReportCompanyNode(`companies/${companyId}/profile`, warnings);
        if (hasReportCompanyIdentity(profileData)) {
            mergeReportCompanyData(companyData, profileData, companyId, true);
            source = source || 'firebase:profile';
        }

    }

    const localCompany = readReportJsonStorage('company_info') || {};
    const localCompanyId = getReportCompanyIdFromCompanyObject(localCompany);
    const localMatchesTenant = !companyId || !localCompanyId || localCompanyId === companyId;
    if (localMatchesTenant && hasReportCompanyIdentity(localCompany)) {
        mergeReportCompanyData(companyData, localCompany, companyId || localCompanyId, false);
        source = source || 'localStorage:company_info';
    } else if (!localMatchesTenant) {
        warnings.push('company_info ignorado por pertencer a outro companyId');
    }

    const normalized = normalizeCompanyProfileForReport(companyData, companyId || localCompanyId, { includeDefaults: true });
    if (companyId) {
        normalized.id = companyId;
        normalized.companyId = companyId;
        normalized.tenantId = companyId;
    }

    try {
        const logoPath = normalized.logoStoragePath || normalized.logoPath || '';
        const logoValue = String(normalized.logo || '').trim();
        if (logoPath && (!logoValue || !/^https?:\/\//i.test(logoValue))) {
            const logoUrl = await getStorageDownloadURL(logoPath);
            if (logoUrl) {
                normalized.logo = logoUrl;
                normalized.logoUrl = logoUrl;
                normalized.logoSvg = false;
            }
        }
    } catch (error) {
        warnings.push(`logoStoragePath: ${error && error.message ? error.message : String(error)}`);
    }

    try {
        if (typeof localStorage !== 'undefined' && hasReportCompanyIdentity(normalized)) {
            const existing = readReportJsonStorage('company_info') || {};
            const existingId = getReportCompanyIdFromCompanyObject(existing);
            const cachePayload = { ...existing, ...normalized };
            if (cachePayload.logo && String(cachePayload.logo).startsWith('data:')) {
                delete cachePayload.logo;
                delete cachePayload.logoUrl;
            }
            delete cachePayload.logoBase64;
            delete cachePayload.logoData;
            if (!existingId || !companyId || existingId === companyId) {
                localStorage.setItem('company_info', JSON.stringify(cachePayload));
            } else if (companyId) {
                localStorage.setItem('company_info', JSON.stringify(cachePayload));
            }
        }
    } catch (_) {}

    return {
        success: true,
        companyId: normalized.companyId || companyId || '',
        source: source || 'defaults',
        warnings,
        data: normalized
    };
}

// Expor serviços e funções globalmente
window.firebaseService = {
    auth,
    // Funções de autenticação
    authService: {
        getAuth: () => auth,
        createUserWithEmailAndPassword: createUserWithEmailAndPassword,
        signInWithEmailAndPassword: signInWithEmailAndPassword,
        signInAnonymously: signInAnonymously,
        signOut: signOut,
        onAuthStateChanged: subscribeAuthState,
        setPersistence: setPersistence,
        browserSessionPersistence: browserSessionPersistence,
        browserLocalPersistence: browserLocalPersistence,
        sendPasswordResetEmail: sendPasswordResetEmail,
        waitForAuthReady: waitForAuthReady,
        getSessionContext: getSessionContext,
        resolveAuthenticatedTenant: resolveAuthenticatedTenant,
        getIdTokenResult: getIdTokenResultSingleFlight,
        getUserProfile: getUserProfileForSession,
        getEffectiveUserProfile: getEffectiveUserProfile,
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
    authPersistenceReady: authPersistenceReady,
    authReadyPromise: authReadyPromise,
    waitForAuthReady: waitForAuthReady,
    getSessionContext: getSessionContext,
    getConnectionState: getConnectionState,
    getUserProfile: getUserProfileForSession,
    getEffectiveUserProfile: getEffectiveUserProfile,
    getIdTokenResult: getIdTokenResultSingleFlight,
    loadFromFirebase: loadFromFirebase,
    loadRecentFromFirebase: loadRecentFromFirebase,
    saveToFirebase: saveToFirebase,
    updatePaths: updatePaths,
    getTenantId: getTenantId,
    setTenantId: setTenantId,
    resolveAuthenticatedTenant: resolveAuthenticatedTenant,
    getCurrentUid: getCurrentUid,
    callFunction: callFunction,
    uploadFile: uploadFile,
    extractFirebaseStoragePathFromUrl: extractFirebaseStoragePathFromUrl,
    extractStoragePathFromUrl: extractFirebaseStoragePathFromUrl,
    getDownloadURL: getStorageDownloadURL,
    getStorageDownloadURL: getStorageDownloadURL,
    getStorageDataURL: getStorageDataURL,
    uploadCompanyLogo: uploadCompanyLogo,
    storage: {
        upload: async (path, file, options = {}) => {
            const result = await uploadFile(path, file, options);
            if (!result || result.success === false) throw new Error((result && result.error) || 'Falha no upload');
            return result.downloadURL || result.url;
        },
        getDownloadURL: getStorageDownloadURL,
        getDataURL: getStorageDataURL,
        delete: deleteStorageFile
    },
    resolveReportCompanyId: resolveReportCompanyId,
    normalizeCompanyProfileForReport: normalizeCompanyProfileForReport,
    getCompanyProfileForReport: getCompanyProfileForReport,
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
    createPaymentPreference: createPaymentPreference,
    revalidatePixPayment: revalidatePixPayment,
    processPaymentBrick: processPaymentBrick,
    activateFreeTrial: activateFreeTrial,
    extendSubscriptionAccess: extendSubscriptionAccess,
    grantAdminFreeTrial: grantAdminFreeTrial,
    requestSubscriptionExtension: requestSubscriptionExtension,
    getOpenExtensionRequests: getOpenExtensionRequests,
    reviewSubscriptionExtensionRequest: reviewSubscriptionExtensionRequest,
    retroEnrichSubscriptionHistory: retroEnrichSubscriptionHistory,
    prepareSubscriptionApproval: prepareSubscriptionApproval,
    confirmSubscriptionApproval: confirmSubscriptionApproval,
    updateSubscriptionFinancialEvent: updateSubscriptionFinancialEvent,
    deleteSubscriptionManagedData: deleteSubscriptionManagedData,
    fullUserCleanup: fullUserCleanup,
    saveData: saveToFirebase,
    createSupportTicket: createSupportTicket,
    addSupportTicketMessage: addSupportTicketMessage,
    listMySupportTickets: listMySupportTickets,
    getSupportTicket: getSupportTicket,
    updateSupportTicketStatus: updateSupportTicketStatus,
    listSupportTicketsAdmin: listSupportTicketsAdmin,
    getCampaignExecutiveSummary: getCampaignExecutiveSummary,
    getCampaignConfigAudit: getCampaignConfigAudit,
    listPromoCodesAdmin: listPromoCodesAdmin,
    getPromoCodeAdmin: getPromoCodeAdmin,
    upsertPromoCodeAdmin: upsertPromoCodeAdmin,
    archivePromoCodeAdmin: archivePromoCodeAdmin,
    validatePromoCode: validatePromoCode,
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
        console.log('🔥 Removendo dados do Firebase');
        
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
        
        console.log('✅ Dados removidos do Firebase');
        
        return {
            success: true,
            source: 'firebase'
        };
        
    } catch (error) {
        console.error('❌ Erro ao remover dados do Firebase:', error && error.code ? error.code : 'unknown');
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

function normalizeProfileText(value, maxLength = 180) {
    const raw = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return raw.slice(0, maxLength);
}

function normalizeMyUserProfilePatch(payload) {
    const source = payload && typeof payload === 'object' ? payload : {};
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(source, key);
    const patch = {};

    if (hasOwn('displayName')) {
        const displayName = normalizeProfileText(source.displayName, 180);
        patch.displayName = displayName;
        patch.name = displayName;
    }
    if (hasOwn('username')) {
        patch.username = normalizeProfileText(source.username, 80);
    }
    if (hasOwn('phone')) {
        const phone = normalizeProfileText(source.phone, 40);
        patch.phone = phone;
        patch.telefone = phone;
    }
    if (hasOwn('whatsapp')) {
        patch.whatsapp = normalizeProfileText(source.whatsapp, 40);
    }
    if (hasOwn('photoURL')) {
        const photoURL = normalizeProfileText(source.photoURL, 2048);
        patch.photoURL = photoURL || null;
    }

    const now = new Date().toISOString();
    patch.updatedAt = now;
    patch.lastUpdated = now;
    patch.profileUpdatedAt = now;
    return patch;
}

async function updateMyUserProfile(payload) {
    try {
        await authPersistenceReady;
        const currentUser = auth && auth.currentUser ? auth.currentUser : await authService.getCurrentUser();
        if (!currentUser || !currentUser.uid) {
            return { success: false, error: 'Usuário autenticado não encontrado para atualizar o perfil.' };
        }

        const patch = normalizeMyUserProfilePatch(payload);
        const editableKeys = Object.keys(patch).filter((key) => !['updatedAt', 'lastUpdated', 'profileUpdatedAt'].includes(key));
        if (!editableKeys.length) {
            return { success: false, error: 'Nenhum campo de perfil informado para atualizar.' };
        }

        const authPatch = {};
        if (Object.prototype.hasOwnProperty.call(patch, 'displayName')) {
            authPatch.displayName = patch.displayName;
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'photoURL')) {
            authPatch.photoURL = patch.photoURL || null;
        }
        const result = await callFunction('updateMyUserProfile', patch);
        try {
            if (Object.keys(authPatch).length) {
                await firebaseUpdateProfile(currentUser, authPatch);
            }
        } catch (authProfileError) {
            console.warn('⚠️ Perfil salvo no servidor, mas o cache do Firebase Auth não atualizou localmente:', authProfileError);
        }
        const data = result && typeof result === 'object' && result.profile
            ? result.profile
            : patch;
        return { success: true, uid: currentUser.uid, data, source: 'function' };
    } catch (error) {
        console.error('❌ Erro ao atualizar perfil do usuário:', error && error.code ? error.code : 'unknown');
        const rawMessage = String(error && error.message ? error.message : error || '');
        const lower = rawMessage.toLowerCase();
        if (lower.includes('not found') || lower.includes('404')) {
            return { success: false, error: "Cloud Function 'updateMyUserProfile' não encontrada. Publique as Functions antes de salvar o perfil." };
        }
        if (lower.includes('permission') || lower.includes('permission_denied')) {
            return { success: false, error: 'Sem permissão para atualizar o perfil. Entre novamente e tente outra vez; se persistir, revise as claims do usuário.' };
        }
        if (lower.includes('cors') || lower.includes('failed to fetch') || lower.includes('network')) {
            return { success: false, error: "Falha de rede/CORS ao chamar 'updateMyUserProfile'. Verifique deploy e conexão." };
        }
        return { success: false, error: rawMessage || 'Falha ao atualizar perfil do usuário.' };
    }
}

// ✅ SERVIÇO DE AUTENTICAÇÃO SIMPLIFICADO
export const authService = {
    getAuth: () => auth,
    waitForAuthReady,
    getSessionContext,
    resolveAuthenticatedTenant,
    getIdTokenResult: getIdTokenResultSingleFlight,
    getUserProfile: getUserProfileForSession,
    getEffectiveUserProfile: getEffectiveUserProfile,
    onAuthStateChanged: subscribeAuthState,
    sendPasswordResetEmail: async (email) => {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!normalizedEmail) throw new Error('Email obrigatório para recuperação de senha.');
        return sendPasswordResetEmail(auth, normalizedEmail);
    },
    // Login com email/senha
    async login(email, password) {
        try {
            const normalizedEmail = String(email || '').trim().toLowerCase();
            const rawPassword = typeof password === 'string' ? password : String(password || '');
            authPerfPhase('session_resolve', 'started');
            console.log("🔑 Tentando login");
            if (!normalizedEmail || !rawPassword) {
                return { success: false, error: "Email e senha são obrigatórios." };
            }
            
            const status = isFirebaseOperational();
            if (!status.operational) {
                throw new Error("Firebase não operacional para login");
            }
            await authPersistenceReady;
            
            const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, rawPassword);
            const user = userCredential.user;
            if (String(authStateSnapshot.user && authStateSnapshot.user.uid || '') !== String(user.uid || '')) {
                handleCanonicalAuthState(user);
            }
            const sessionContext = await resolveSessionContextForUser(user);

            authPerfPhase('session_resolve', 'success');
            console.log("✅ Login bem-sucedido");
            return {
                success: true,
                user,
                companyId: sessionContext && sessionContext.companyId || null,
                superAdmin: sessionContext && sessionContext.superAdmin === true,
                sessionContext
            };
            
        } catch (error) {
            authPerfPhase('session_resolve', 'error');
            console.error("❌ Erro no login:", error && error.code ? error.code : 'unknown');
            
            // Tratamento específico para diferentes tipos de erro
            let userFriendlyMessage = error.message;
            
            if (error.code === 'auth/network-request-failed') {
                userFriendlyMessage = "Erro de conectividade. Verifique sua conexão com a internet e tente novamente.";
                console.error("🌐 Falha de rede durante o login:", error.code);
            } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
                userFriendlyMessage = "Email ou senha inválidos. Confira se não há espaços no email e tente novamente.";
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
            try {
                localStorage.removeItem('currentUser');
                localStorage.removeItem('persistentUser');
                localStorage.removeItem('auth');
                localStorage.removeItem('siswebAuthSession');
            } catch (_) {}
            try { sessionStorage.clear(); } catch (_) {}
            handleCanonicalAuthState(null);
            try { window.firebaseAuthUser = null; } catch (_) {}
            try { window.currentUser = null; } catch (_) {}
            try { window.__SESSION_SUPERADMIN = false; } catch (_) {}
            try { window.__SESSION_SUPERADMIN_UID = ''; } catch (_) {}
            console.log("✅ Logout realizado com sucesso");
            return { success: true };
        } catch (error) {
            console.error("❌ Erro no logout:", error && error.code ? error.code : 'unknown');
            return { success: false, error: error.message };
        }
    },
    
    // Obter usuário atual
    async getCurrentUser() {
        return waitForAuthCurrentUser(5000);
    },

    getCredential(email, password) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const rawPassword = typeof password === 'string' ? password : String(password || '');
        if (!normalizedEmail || !rawPassword) {
            throw new Error('Email e senha são obrigatórios para criar credencial.');
        }
        return EmailAuthProvider.credential(normalizedEmail, rawPassword);
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
            const normalizedEmail = String(email || '').trim().toLowerCase();
            const rawPassword = typeof password === 'string' ? password : String(password || '');
            console.log("🔐 Registrando novo usuário");
            
            const status = isFirebaseOperational();
            if (!status.operational) {
                throw new Error("Firebase não operacional para registro");
            }
            await authPersistenceReady;
            
            const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, rawPassword);
            const user = userCredential.user;
            const normalizedUsername = normalizeProfileText(username || normalizedEmail.split('@')[0], 80);
            const createdAt = new Date().toISOString();
            try {
                await firebaseUpdateProfile(user, { displayName: normalizedUsername });
            } catch (profileError) {
                console.warn('⚠️ Registro: falha ao preencher displayName no Auth:', profileError && profileError.message ? profileError.message : profileError);
            }
            
            // Salvar dados adicionais do usuário
            await saveToFirebase(`users/${user.uid}`, null, {
                username: normalizedUsername,
                displayName: normalizedUsername,
                name: normalizedUsername,
                email: normalizedEmail,
                phone: '',
                telefone: '',
                createdAt,
                updatedAt: createdAt,
                profileUpdatedAt: createdAt
            });
            
            console.log("✅ Usuário registrado com sucesso");
            return { success: true, user };
            
        } catch (error) {
            console.error("❌ Erro no registro:", error && error.code ? error.code : 'unknown');
            
            // Tratamento específico para diferentes tipos de erro
            let userFriendlyMessage = error.message;
            
            if (error.code === 'auth/network-request-failed') {
                userFriendlyMessage = "Erro de conectividade. Verifique sua conexão com a internet e tente novamente.";
                console.error("🌐 Falha de rede durante o registro:", error.code);
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
    callFunction,
    updateMyUserProfile,
    updatePaths,
    getServerTimestamp,
    getTenantId,
    getTenantId as getCurrentTenantId,
    setTenantId,
    resolveAuthenticatedTenant,
    waitForAuthReady,
    getSessionContext,
    getConnectionState,
    getUserProfileForSession,
    getEffectiveUserProfile,
    getIdTokenResultSingleFlight,
    getCurrentUid,
    uploadFile,
    extractFirebaseStoragePathFromUrl,
    getStorageDownloadURL,
    getStorageDataURL,
    deleteStorageFile,
    uploadCompanyLogo,
    resolveReportCompanyId,
    normalizeCompanyProfileForReport,
    getCompanyProfileForReport,
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
    grantAdminFreeTrial,
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
    fullUserCleanup,
    createSupportTicket,
    sendPublicSupportEmail,
    addSupportTicketMessage,
    listMySupportTickets,
    getSupportTicket,
    updateSupportTicketStatus,
    listSupportTicketsAdmin,
    getCampaignExecutiveSummary,
    getCampaignConfigAudit,
    listPromoCodesAdmin,
    getPromoCodeAdmin,
    upsertPromoCodeAdmin,
    archivePromoCodeAdmin,
    getAll,
    migrateFromIndexedDB,
    db,
    auth,
    authPersistenceReady,
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
            console.error('❌ Erro na assinatura realtime:', error && error.code ? error.code : 'unknown');
        });
        return {
            ref: reference,
            callback: handler,
            unsubscribe: () => {
                try { off(reference, handler); } catch (_) {}
            }
        };
    } catch (error) {
        console.error('❌ Erro ao criar assinatura realtime:', error && error.code ? error.code : 'unknown');
        return {
            unsubscribe: () => {}
        };
    }
}

async function sendSubscriptionEmail(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        return await callAdminCallableWithRetry('sendSubscriptionEmail', data);
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

// No final do arquivo, adicionar exportação global para window.firebaseService
const initializeGlobalFirebaseService = () => {
    const globalService = {
        auth,
        loadFromFirebase,
        saveToFirebase,
        removeFromFirebase: deleteFromFirebase,
        getFromFirebase,
        updateFirebase,
        updateMyUserProfile,
        updatePaths,
        serverTimestamp: getServerTimestamp,
        subscribe,
        authService,
        authPersistenceReady,
        authReadyPromise,
        waitForAuthReady,
        getSessionContext,
        getConnectionState,
        getUserProfile: getUserProfileForSession,
        getEffectiveUserProfile,
        getIdTokenResult: getIdTokenResultSingleFlight,
        getCurrentUser: (...args) => authService.getCurrentUser(...args),
        getCredential: (...args) => authService.getCredential(...args),
        reauthenticate: (...args) => authService.reauthenticate(...args),
        updatePassword: (...args) => authService.updatePassword(...args),
        isFirebaseOperational,
        getCurrentTenantId: getTenantId,
        setTenantId,
        resolveAuthenticatedTenant,
        getCurrentUid,
        callFunction,
        uploadFile,
        extractFirebaseStoragePathFromUrl,
        extractStoragePathFromUrl: extractFirebaseStoragePathFromUrl,
        getDownloadURL: getStorageDownloadURL,
        getStorageDownloadURL,
        getStorageDataURL,
        deleteStorageFile,
        uploadCompanyLogo,
        storage: {
            upload: async (path, file, options = {}) => {
                const result = await uploadFile(path, file, options);
                if (!result || result.success === false) throw new Error((result && result.error) || 'Falha no upload');
                return result.downloadURL || result.url;
            },
            getDownloadURL: getStorageDownloadURL,
            getDataURL: getStorageDataURL,
            delete: deleteStorageFile
        },
        resolveReportCompanyId,
        normalizeCompanyProfileForReport,
        getCompanyProfileForReport,
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
        grantAdminFreeTrial,
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
        fullUserCleanup,
        saveData: saveToFirebase,
        createSupportTicket,
        sendPublicSupportEmail,
        addSupportTicketMessage,
        listMySupportTickets,
        getSupportTicket,
        updateSupportTicketStatus,
        listSupportTicketsAdmin,
        sendSubscriptionEmail,
        getCampaignExecutiveSummary,
        getCampaignConfigAudit,
        listPromoCodesAdmin,
        getPromoCodeAdmin,
        upsertPromoCodeAdmin,
        archivePromoCodeAdmin,
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
