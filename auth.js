(function() {
/**
 * Script de autenticação - Integração com firebaseService.js
 * Responsável por gerenciar o login, registro e armazenamento de usuários.
 */

// Proteger contra carregamento duplo
if (window.AUTH_JS_LOADED) {
    console.log("🔄 auth.js já foi carregado, ignorando carregamento duplo");
    // Para permitir que o script funcione mesmo sendo carregado múltiplas vezes
} else {
    window.AUTH_JS_LOADED = true;
    window.AUTH_JS_LOADED_AT = Date.now();
    console.log("🔐 auth.js: Carregando pela primeira vez");
}

// Função para obter o authService de forma segura
function getAuthService() {
    if (window.firebaseService && window.firebaseService.authService) {
        return window.firebaseService.authService;
    }

    const loadedAt = Number(window.AUTH_JS_LOADED_AT || Date.now());
    const waitingForModule = Date.now() - loadedAt < 10000;
    const log = waitingForModule ? console.debug : console.warn;
    log.call(console, "⚠️ firebaseService não disponível, usando fallback");
    return {
        getCurrentUser: () => Promise.resolve(null),
        login: () => Promise.resolve({ success: false, error: "Serviço não disponível" }),
        logout: () => Promise.resolve(),
        register: () => Promise.resolve({ success: false, error: "Serviço não disponível" }),
        onAuthStateChanged: (callback) => { if (callback) callback(null); return null; }
    };
}

async function waitForAuthInfrastructureReady() {
    try {
        await waitForFirebaseService(80);
    } catch (_) {}
    try {
        if (window.firebaseService && window.firebaseService.authPersistenceReady) {
            await window.firebaseService.authPersistenceReady;
        }
    } catch (_) {}
    try {
        if (window.firebaseService && typeof window.firebaseService.waitForAuthReady === 'function') {
            await window.firebaseService.waitForAuthReady(5000);
        }
    } catch (_) {}
}

async function getCanonicalSessionContext(options = {}) {
    try {
        const service = window.firebaseService || null;
        if (service && typeof service.getSessionContext === 'function') {
            return await service.getSessionContext(options);
        }
        const serviceAuth = getAuthService();
        if (serviceAuth && typeof serviceAuth.getSessionContext === 'function') {
            return await serviceAuth.getSessionContext(options);
        }
    } catch (_) {}
    return null;
}

async function getCanonicalTokenResult(user, options = {}) {
    if (!user || typeof user.getIdTokenResult !== 'function') return null;
    try {
        const service = window.firebaseService || null;
        if (service && typeof service.getIdTokenResult === 'function') {
            return await service.getIdTokenResult(user, options);
        }
        const serviceAuth = getAuthService();
        if (serviceAuth && typeof serviceAuth.getIdTokenResult === 'function') {
            return await serviceAuth.getIdTokenResult(user, options);
        }
    } catch (_) {}
    return user.getIdTokenResult(options.forceRefresh === true);
}

function isActiveAuthUid(uid) {
    const expectedUid = String(uid || '').trim();
    if (!expectedUid) return false;
    try {
        const service = window.firebaseService || null;
        const serviceAuth = service && service.authService ? service.authService : null;
        const authInstance = serviceAuth && typeof serviceAuth.getAuth === 'function'
            ? serviceAuth.getAuth()
            : (service && service.auth ? service.auth : null);
        const activeUser = (authInstance && authInstance.currentUser) || window.firebaseAuthUser || null;
        return String(activeUser && activeUser.uid || '') === expectedUid;
    } catch (_) {
        return false;
    }
}

function isSameActiveAuthUser(user) {
    return isActiveAuthUid(user && user.uid);
}

// Função para obter o dbService de forma segura  
function getDbService() {
    if (window.firebaseService) {
        return window.firebaseService;
    }
    
    console.warn("⚠️ firebaseService não disponível");
    return {};
}

// Aguardar que o firebaseService esteja disponível
function waitForFirebaseService(maxAttempts = 50) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        
        const checkService = () => {
            if (window.firebaseService && window.firebaseService.authService) {
                console.log("✅ firebaseService disponível");
                resolve(true);
                return;
            }
            
            attempts++;
            if (attempts >= maxAttempts) {
                console.warn("⚠️ Timeout aguardando firebaseService, continuando com fallback");
                resolve(false);
                return;
            }
            
            setTimeout(checkService, 100);
        };
        
        checkService();
    });
}

async function setCompanyContext(companyId, options = {}) {
    try {
        const tenant = companyId ? String(companyId) : null;
        const ownerUid = String(options.ownerUid || '').trim();
        const authoritative = options.authoritative === true;
        if (ownerUid && !isActiveAuthUid(ownerUid)) return null;
        if (tenant) {
            if (!authoritative || !ownerUid) return null;
        } else {
            window.appTenantId = null;
            if (window.firebaseService && typeof window.firebaseService.setTenantId === 'function') {
                window.firebaseService.setTenantId(null);
            }
        }

        let storedCompany = null;
        try {
            const raw = localStorage.getItem('company_info');
            storedCompany = raw ? JSON.parse(raw) : null;
        } catch (_) {
            storedCompany = null;
        }

        if (storedCompany && tenant) {
            const storedId = storedCompany.companyId || storedCompany.companyID || storedCompany.tenantId || storedCompany.id;
            const storedOwnerUid = String(storedCompany._authUid || '').trim();
            if (storedId && String(storedId) === tenant && ownerUid && storedOwnerUid === ownerUid) {
                window.companyInfo = storedCompany;
                window.appTenantId = tenant;
                if (window.firebaseService && typeof window.firebaseService.setTenantId === 'function') {
                    window.firebaseService.setTenantId(tenant);
                }
                return storedCompany;
            }
        }

        if (!tenant) {
            try {
                localStorage.removeItem('company_info');
            } catch (_) {}
            window.companyInfo = null;
            return null;
        }

        // Cache legado sem proprietário nunca autoriza nem restaura um tenant.
        if (!authoritative || !ownerUid) return null;

        let found = null;
        if (tenant) {
            try {
                if (window.firebaseService && typeof window.firebaseService.getCompanyProfileForReport === 'function') {
                    const central = await window.firebaseService.getCompanyProfileForReport({ companyId: tenant });
                    if (!isActiveAuthUid(ownerUid)) return null;
                    found = central && central.success !== false ? (central.data || central) : null;
                }
            } catch (_) {}

            if (!found && window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                try {
                    const profileResult = await window.firebaseService.loadFromFirebase('companies/' + tenant + '/profile');
                    if (!isActiveAuthUid(ownerUid)) return null;
                    const profileData = profileResult && profileResult.success ? profileResult.data : profileResult;
                    if (profileData && typeof profileData === 'object') found = { ...profileData, companyId: tenant, tenantId: tenant, id: tenant };
                } catch (_) {}

                if (!found) {
                    try {
                        const rootResult = await window.firebaseService.loadFromFirebase('companies/' + tenant);
                        if (!isActiveAuthUid(ownerUid)) return null;
                        const rootData = rootResult && rootResult.success ? rootResult.data : rootResult;
                        if (rootData && typeof rootData === 'object') found = { ...rootData, companyId: tenant, tenantId: tenant, id: tenant };
                    } catch (_) {}
                }
            }

            if (!found) {
                let companies = null;
                try {
                    const raw = localStorage.getItem('companies');
                    companies = raw ? JSON.parse(raw) : null;
                } catch (_) {
                    companies = null;
                }

                const list = Array.isArray(companies)
                    ? companies
                    : (companies && typeof companies === 'object' ? Object.values(companies) : []);
                found = list.find((c) => {
                    const cid = c && (c.companyId || c.companyID || c.tenantId || c.id);
                    return cid && String(cid) === tenant;
                }) || null;
            }
        }

        if (found) {
            if (!isActiveAuthUid(ownerUid)) return null;
            const ownedCompany = { ...found, _authUid: ownerUid };
            localStorage.setItem('company_info', JSON.stringify(ownedCompany));
            window.companyInfo = ownedCompany;
            const newTenant = String(ownedCompany.companyId || ownedCompany.companyID || ownedCompany.tenantId || ownedCompany.id || tenant || '').trim();
            if (newTenant) {
                window.appTenantId = newTenant;
                if (window.firebaseService && typeof window.firebaseService.setTenantId === 'function') {
                    window.firebaseService.setTenantId(newTenant);
                }
            }
            return ownedCompany;
        }

        if (!isActiveAuthUid(ownerUid)) return null;
        const fallback = { id: tenant, companyId: tenant, tenantId: tenant, _authUid: ownerUid };
        localStorage.setItem('company_info', JSON.stringify(fallback));
        window.companyInfo = fallback;
        window.appTenantId = tenant;
        if (window.firebaseService && typeof window.firebaseService.setTenantId === 'function') {
            window.firebaseService.setTenantId(tenant);
        }
        return fallback;
    } catch (_) {}
    return null;
}

async function tryRestoreCompanyClaim(user, companyId) {
    if (companyId) return companyId;

    // O vínculo só pode ser restaurado por uma fonte autenticada, nunca pelo cache local.
    let resolvedCompanyId = null;
    if (user && user.uid) {
        try {
            console.log("🔍 Buscando perfil do usuário no Firebase para restaurar sessão...");
            if (window.firebaseService) {
                const centralProfile = typeof window.firebaseService.getUserProfile === 'function'
                    ? await window.firebaseService.getUserProfile(user.uid)
                    : null;
                if (!isSameActiveAuthUser(user)) return null;
                const profile = centralProfile;

                const profileCompanyId = profile && (profile.companyId || profile.companyID || profile.tenantId);
                if (profileCompanyId) {
                    resolvedCompanyId = String(profileCompanyId);
                    console.log('✅ Empresa encontrada no perfil do usuário. Restaurando acesso.');

                    try {
                        await setCompanyContext(resolvedCompanyId, {
                            ownerUid: user.uid,
                            authoritative: true
                        });
                    } catch (e) {
                        console.warn("⚠️ Falha ao carregar detalhes da empresa para cache:", e);
                    }
                } else {
                    console.log("ℹ️ Nenhuma empresa vinculada ao perfil do usuário.");
                }
            }
        } catch (e) {
            console.warn("⚠️ Erro ao buscar perfil do usuário:", e);
        }
    }

    if (!resolvedCompanyId || !user || !user.uid) return null;
    if (!isSameActiveAuthUser(user)) return null;

    // Atualizar a claim somente a partir do perfil autenticado.
    if (window.firebaseService && typeof window.firebaseService.setCompanyClaim === 'function') {
        try {
            const claimResult = await window.firebaseService.setCompanyClaim(user.uid, resolvedCompanyId);
            if (!isSameActiveAuthUser(user)) return null;
            
            // O perfil autenticado continua sendo fonte válida mesmo quando a Function não altera a claim.
            if (!claimResult || claimResult.success === false) {
                 console.warn("⚠️ Falha ao definir claim, mas seguindo com empresa resolvida localmente.");
                 return resolvedCompanyId;
            }
            
            const idTokenResult = await getCanonicalTokenResult(user, {
                forceRefresh: true,
                reason: 'claims_changed'
            });
            if (!isSameActiveAuthUser(user)) return null;
            const refreshed = idTokenResult && idTokenResult.claims ? idTokenResult.claims.companyId : null;
            return refreshed || resolvedCompanyId;
        } catch (err) {
            console.warn("⚠️ Erro ao tentar atualizar claim:", err);
            return isSameActiveAuthUser(user) ? resolvedCompanyId : null;
        }
    }
    
    return isSameActiveAuthUser(user) ? resolvedCompanyId : null;
}

// Variável para rastrear inicialização - proteger contra redeclaração
if (typeof window.AUTH_INITIALIZED_KEY === 'undefined') {
    window.AUTH_INITIALIZED_KEY = 'authJsInitialized';
}
const AUTH_INITIALIZED_KEY = window.AUTH_INITIALIZED_KEY;
let isInitialized = false;
const ADMIN_CORE_COMPANY_ID = 'sisweb_admin_core';
const SUPER_ADMIN_UIDS = new Set(['HfrQ6ObQq2aSEoeEE4Ng9jpAolB3']);
const SISWEB_AUTH_SESSION_KEY = 'siswebAuthSession';
const SISWEB_AUTH_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function parseStoredObject(key, fallbackValue = null) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallbackValue;
        const parsed = JSON.parse(raw);
        if (parsed == null) return fallbackValue;
        return parsed;
    } catch (_) {
        return fallbackValue;
    }
}

function parseCurrentUserSafe() {
    const parsed = parseStoredObject('currentUser', null);
    return parsed && typeof parsed === 'object' ? parsed : null;
}

function parsePersistentUserSafe() {
    const parsed = parseStoredObject('persistentUser', null);
    return parsed && typeof parsed === 'object' ? parsed : null;
}

function normalizeAuthSessionUser(user) {
    const source = user && typeof user === 'object' ? user : {};
    const uid = String(source.uid || source.id || source.userId || '').trim();
    const email = String(source.email || '').trim();
    const displayName = String(source.displayName || source.nome || source.username || (email ? email.split('@')[0] : '') || '').trim();
    const companyId = String(source.companyId || source.companyID || source.tenantId || source.empresaId || '').trim();
    return { uid, email, displayName, companyId };
}

function readDurableAuthSession() {
    try {
        const raw = localStorage.getItem(SISWEB_AUTH_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

function clearDurableAuthSession() {
    try { localStorage.removeItem(SISWEB_AUTH_SESSION_KEY); } catch (_) {}
}

function clearCompanyContextCache() {
    try { localStorage.removeItem('company_info'); } catch (_) {}
    try { window.companyInfo = null; } catch (_) {}
    try { window.appTenantId = null; } catch (_) {}
    try {
        if (window.firebaseService && typeof window.firebaseService.setTenantId === 'function') {
            window.firebaseService.setTenantId(null);
        }
    } catch (_) {}
}

async function restoreCompanyContextFromCachedUser(user) {
    const normalized = normalizeAuthSessionUser(user);
    if (!normalized.companyId) return null;
    try {
        return await setCompanyContext(normalized.companyId, {
            ownerUid: normalized.uid,
            authoritative: false
        });
    } catch (_) {
        return null;
    }
}

function persistAuthenticatedSession(user, options = {}) {
    try {
        const now = Date.now();
        const normalized = normalizeAuthSessionUser(user);
        const existingCurrent = parseCurrentUserSafe() || {};
        const existingUid = String(existingCurrent.uid || existingCurrent.id || existingCurrent.userId || '').trim();
        const existingEmail = String(existingCurrent.email || '').trim().toLowerCase();
        const normalizedEmail = String(normalized.email || '').trim().toLowerCase();
        const existingHasIdentity = !!(existingUid || existingEmail);
        const normalizedHasIdentity = !!(normalized.uid || normalizedEmail);
        const sameCachedUser = existingHasIdentity
            ? ((!normalized.uid || !existingUid || normalized.uid === existingUid)
                && (!normalizedEmail || !existingEmail || normalizedEmail === existingEmail))
            : !normalizedHasIdentity;
        const safeExistingCurrent = sameCachedUser ? existingCurrent : {};
        const currentCompany = sameCachedUser
            ? String(existingCurrent.companyId || existingCurrent.companyID || existingCurrent.tenantId || '').trim()
            : '';
        const mergedCurrent = {
            ...safeExistingCurrent,
            ...(normalized.uid ? { uid: normalized.uid } : {}),
            ...(normalized.email ? { email: normalized.email } : {}),
            ...(normalized.displayName ? { displayName: normalized.displayName } : {}),
            ...(normalized.companyId || currentCompany ? { companyId: normalized.companyId || currentCompany } : {}),
            lastAuthAt: now
        };
        if (mergedCurrent.uid || mergedCurrent.email) {
            localStorage.setItem('currentUser', JSON.stringify(mergedCurrent));
        }
        sessionStorage.setItem('userAuthenticated', 'true');
        sessionStorage.setItem('lastLogin', String(now));
        sessionStorage.setItem('redirectCount', '0');
        localStorage.setItem(SISWEB_AUTH_SESSION_KEY, JSON.stringify({
            authenticated: true,
            uid: normalized.uid || String(mergedCurrent.uid || mergedCurrent.id || mergedCurrent.userId || '').trim(),
            email: normalized.email || String(mergedCurrent.email || '').trim(),
            companyId: normalized.companyId || String(mergedCurrent.companyId || mergedCurrent.companyID || mergedCurrent.tenantId || '').trim(),
            source: String(options.source || 'auth'),
            updatedAt: now,
            expiresAt: now + SISWEB_AUTH_SESSION_MAX_AGE_MS
        }));
    } catch (_) {}
}

function getCachedAuthUserForSession() {
    const current = parseCurrentUserSafe();
    const persistent = parsePersistentUserSafe();
    if (current && persistent) {
        return {
            ...persistent,
            ...current,
            companyId: current.companyId || current.companyID || current.tenantId || persistent.companyId || persistent.companyID || persistent.tenantId || '',
            tenantId: current.tenantId || persistent.tenantId || persistent.companyId || persistent.companyID || ''
        };
    }
    return current || persistent;
}

function isDurableAuthSessionValid(session, cachedUser) {
    if (!session || session.authenticated !== true) return false;
    const now = Date.now();
    const expiresAt = Number(session.expiresAt || 0);
    const updatedAt = Number(session.updatedAt || 0);
    if (expiresAt && expiresAt < now) {
        clearDurableAuthSession();
        return false;
    }
    if (!expiresAt && updatedAt && (now - updatedAt) > SISWEB_AUTH_SESSION_MAX_AGE_MS) {
        clearDurableAuthSession();
        return false;
    }
    const user = normalizeAuthSessionUser(cachedUser || {});
    const sessionUid = String(session.uid || '').trim();
    const sessionEmail = String(session.email || '').trim().toLowerCase();
    if (!user.uid && !user.email) return false;
    if (sessionUid && user.uid && sessionUid !== user.uid) return false;
    if (sessionEmail && user.email && sessionEmail !== user.email.toLowerCase()) return false;
    return true;
}

function getUsableCachedAuthSession() {
    const cachedUser = getCachedAuthUserForSession();
    const durableSession = readDurableAuthSession();
    if (isDurableAuthSessionValid(durableSession, cachedUser)) {
        return { user: cachedUser, session: durableSession };
    }
    return null;
}

async function tryAllowCachedAuthSession(source) {
    void source;
    return { allowed: false };
}

function parseUsersCacheSafe() {
    const parsed = parseStoredObject('users', []);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') return Object.values(parsed);
    return [];
}

async function loadUserProfileFromFirebase(uid) {
    try {
        const id = uid ? String(uid).trim() : '';
        if (!id) return null;
        if (window.firebaseService && typeof window.firebaseService.getEffectiveUserProfile === 'function') {
            const result = await window.firebaseService.getEffectiveUserProfile(id);
            return result && result.success && result.data ? result.data : null;
        }
        if (window.firebaseService && typeof window.firebaseService.getUserProfile === 'function') {
            const profile = await window.firebaseService.getUserProfile(id);
            return profile && typeof profile === 'object' ? profile : null;
        }
        if (!window.firebaseService || typeof window.firebaseService.loadFromFirebase !== 'function') return null;
        const res = await window.firebaseService.loadFromFirebase(`users/${id}`);
        if (!res || res.success === false) return null;
        const profile = res.data;
        if (!profile || typeof profile !== 'object') return null;
        return profile;
    } catch (_) {
        return null;
    }
}

function readCachedSuperAdminFlag() {
    const expectedUid = arguments.length > 0 ? String(arguments[0] || '').trim() : '';
    // SEGURANÇA: a flag de superadmin só é aceita quando derivada dos custom claims do token ID
    // (persistSuperAdminFlag é chamada somente após validação do token). Dados gravados em
    // localStorage (currentUser/persistentUser) NUNCA são fonte de autorização.
    try {
        const flag = typeof window !== 'undefined' && window.__SESSION_SUPERADMIN === true;
        const flagUid = typeof window !== 'undefined' ? String(window.__SESSION_SUPERADMIN_UID || '').trim() : '';
        if (!flag) return false;
        if (expectedUid && flagUid && expectedUid !== flagUid) return false;
        return true;
    } catch (_) {}
    return false;
}

function persistSuperAdminFlag(enabled) {
    const value = enabled === true;
    let uid = '';
    try {
        const current = parseCurrentUserSafe() || {};
        const persistent = parsePersistentUserSafe() || {};
        uid = String(current.uid || current.id || current.userId || persistent.uid || persistent.id || persistent.userId || '').trim();
    } catch (_) {}
    try {
        window.__SESSION_SUPERADMIN = value;
        window.__SESSION_SUPERADMIN_UID = uid || '';
    } catch (_) {}
    // SEGURANÇA: a flag de superadmin NÃO é persistida em localStorage (currentUser/persistentUser).
    // A autorização é derivada exclusivamente dos custom claims do token ID em cada sessão.
}

function isSuperAdminUid(uid) {
    const normalizedUid = String(uid || '').trim();
    if (!normalizedUid) return false;
    if (SUPER_ADMIN_UIDS.has(normalizedUid)) return true;
    // Flag em memória é aceita somente quando derivada dos claims do token (persistSuperAdminFlag).
    if (readCachedSuperAdminFlag(normalizedUid)) return true;
    return false;
}

function getStoredUid() {
    const current = parseCurrentUserSafe();
    const currentId = current && (current.uid || current.id || current.userId);
    if (currentId) return String(currentId);
    const persistent = parsePersistentUserSafe();
    const persistentId = persistent && (persistent.uid || persistent.id || persistent.userId);
    if (persistentId) return String(persistentId);
    return null;
}

async function getCurrentUidSafe() {
    try {
        const authUser = await getAuthService().getCurrentUser();
        if (authUser && authUser.uid) return String(authUser.uid);
    } catch (_) {}
    try {
        const details = await getCurrentUserDetails();
        const id = details && (details.uid || details.id || details.userId);
        if (id) return String(id);
    } catch (_) {}
    return getStoredUid();
}

async function isSuperAdminSession() {
    try {
        const authUser = await getAuthService().getCurrentUser();
        const authUid = authUser && authUser.uid ? String(authUser.uid).trim() : '';
        if (authUid && readCachedSuperAdminFlag(authUid)) return true;
        if (authUid && SUPER_ADMIN_UIDS.has(authUid)) {
            persistSuperAdminFlag(true);
            if (window.firebaseService && typeof window.firebaseService.syncMyAdminClaims === 'function') {
                try { await window.firebaseService.syncMyAdminClaims(); } catch (_) {}
            }
            return true;
        }
        if (authUser && typeof authUser.getIdTokenResult === 'function') {
            const tokenResult = await getCanonicalTokenResult(authUser, { forceRefresh: false });
            const claims = tokenResult && tokenResult.claims ? tokenResult.claims : {};
            const isAdmin = claims.superadmin === true;
            if (!isAdmin && window.firebaseService && typeof window.firebaseService.syncMyAdminClaims === 'function') {
                await window.firebaseService.syncMyAdminClaims();
                const refreshedToken = await getCanonicalTokenResult(authUser, {
                    forceRefresh: true,
                    reason: 'admin_claim_sync'
                });
                const refreshedClaims = refreshedToken && refreshedToken.claims ? refreshedToken.claims : {};
                const refreshedAdmin = refreshedClaims.superadmin === true;
                persistSuperAdminFlag(refreshedAdmin);
                return refreshedAdmin;
            }
            persistSuperAdminFlag(isAdmin);
            return isAdmin;
        }
    } catch (_) {}
    const uid = await getCurrentUidSafe();
    if (!uid) {
        persistSuperAdminFlag(false);
        return false;
    }
    return isSuperAdminUid(uid);
}

function getAdminRolesStore() {
    try {
        const raw = localStorage.getItem('roles');
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return {};
}

function getAdminRoleForUid(uid) {
    if (!uid) return null;
    const roles = getAdminRolesStore();
    return roles[String(uid)] || null;
}

function normalizeAdminPermissions(input) {
    const source = input && typeof input === 'object' ? input : {};
    return {
        dashboard: source.dashboard === true,
        subscriptions: source.subscriptions === true,
        settings: source.settings === true
    };
}

async function hasAdminPageAccess(pageKey) {
    try {
        if (await isSuperAdminSession()) return true;
        const details = await getCurrentUserDetails();
        const uid = details && (details.uid || details.id || details.userId) ? String(details.uid || details.id || details.userId) : '';
        if (!uid) return false;
        const roleLocal = getAdminRoleForUid(uid);
        const isAdminIdentity = !!(
            (details && (details.role === 'sub_admin' || details.adminOwnerUid))
            || (roleLocal && roleLocal.role === 'sub_admin')
        );
        if (!isAdminIdentity) return false;
        const mergedPermissions = normalizeAdminPermissions({
            ...(details && details.adminPermissions ? details.adminPermissions : {}),
            ...(roleLocal && roleLocal.permissions ? roleLocal.permissions : {})
        });
        const active = (roleLocal && roleLocal.active !== false) && (details ? details.adminActive !== false : true);
        if (!active) return false;
        if (!pageKey) return mergedPermissions.dashboard || mergedPermissions.subscriptions || mergedPermissions.settings;
        return mergedPermissions[String(pageKey)] === true;
    } catch (_) {
        return false;
    }
}

async function hasAnyAdminPanelAccess() {
    return hasAdminPageAccess('');
}

function getReadOnlySession() {
    return { enabled: false };
}

function parseAnyDateSafe(raw) {
    try {
        if (!raw) return null;
        if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
        if (typeof raw === 'number') {
            const d = new Date(raw);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        if (typeof raw === 'string') {
            const d = new Date(raw);
            return Number.isNaN(d.getTime()) ? null : d;
        }
        if (typeof raw === 'object' && (raw.seconds || raw._seconds)) {
            const seconds = Number(raw.seconds || raw._seconds);
            if (!Number.isFinite(seconds)) return null;
            const d = new Date(seconds * 1000);
            return Number.isNaN(d.getTime()) ? null : d;
        }
    } catch (_) {}
    return null;
}

function getBackendReadOnlyUntil(userDetails) {
    try {
        const u = userDetails && typeof userDetails === 'object' ? userDetails : {};
        const direct = u.readOnlyUntil || (u.access && u.access.readOnlyUntil) || null;
        return parseAnyDateSafe(direct);
    } catch (_) {
        return null;
    }
}

function getSystemAlerts() {
    try {
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
        const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
        const uid = String(current.uid || current.id || current.userId || persistent.uid || persistent.id || persistent.userId || '').trim();
        const tenantId = String(current.companyId || current.companyID || current.tenantId || persistent.companyId || persistent.companyID || persistent.tenantId || window.appTenantId || '').trim();
        const key = (readCachedSuperAdminFlag() || isSuperAdminUid(uid))
            ? `sisweb_alerts_admin__${uid || 'anon'}`
            : `sisweb_alerts__${tenantId || 'default'}__${uid || 'anon'}`;
        const parsed = JSON.parse(localStorage.getItem(key) || localStorage.getItem('systemAlerts') || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed;
    } catch (_) {
        return [];
    }
}

function pushSystemAlert(alert) {
    try {
        const list = getSystemAlerts();
        const item = {
            id: alert && alert.id ? String(alert.id) : `alert_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
            type: alert && alert.type ? String(alert.type) : 'info',
            title: alert && alert.title ? String(alert.title) : 'Alerta do sistema',
            message: alert && alert.message ? String(alert.message) : '',
            createdAt: new Date().toISOString(),
            read: false
        };
        const merged = [item, ...list].slice(0, 40);
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
        const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
        const uid = String(current.uid || current.id || current.userId || persistent.uid || persistent.id || persistent.userId || '').trim();
        const tenantId = String(current.companyId || current.companyID || current.tenantId || persistent.companyId || persistent.companyID || persistent.tenantId || window.appTenantId || '').trim();
        const key = (readCachedSuperAdminFlag() || isSuperAdminUid(uid))
            ? `sisweb_alerts_admin__${uid || 'anon'}`
            : `sisweb_alerts__${tenantId || 'default'}__${uid || 'anon'}`;
        localStorage.setItem(key, JSON.stringify(merged));
        return item;
    } catch (_) {
        return null;
    }
}

function upsertSubscriptionAlerts(statusKey, userDetails) {
    try {
        const uid = userDetails && (userDetails.uid || userDetails.id || userDetails.userId) ? String(userDetails.uid || userDetails.id || userDetails.userId) : '';
        if (readCachedSuperAdminFlag() || isSuperAdminUid(uid)) return;
        const user = userDetails || {};
        const userNotifications = user && user.notifications && typeof user.notifications === 'object' ? Object.values(user.notifications) : [];
        userNotifications.slice(-5).forEach((n) => {
            if (!n || typeof n !== 'object') return;
            pushSystemAlert({
                id: n.id || `user_notice_${shaSafe(`${n.title || ''}-${n.message || ''}-${n.createdAt || ''}`)}`,
                type: n.type || 'info',
                title: n.title || 'Mensagem do sistema',
                message: n.message || ''
            });
        });
        if (statusKey === 'pending_grace') {
            const graceUntil = parseAnyDateSafe(user.pendingPayment && user.pendingPayment.graceUntil);
            const remaining = graceUntil
                ? Math.max(0, Math.ceil((graceUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : (() => {
                    const sourceDate = (user.pendingPayment && user.pendingPayment.date) || user.updatedAt || null;
                    const base = parseAnyDateSafe(sourceDate);
                    const ageDays = base ? Math.max(0, Math.ceil((Date.now() - base.getTime()) / (1000 * 60 * 60 * 24))) : 0;
                    const cfg = parseInt(user.pendingPayment && user.pendingPayment.graceDays, 10);
                    const grace = Number.isFinite(cfg) ? Math.max(0, Math.min(30, cfg)) : 7;
                    return Math.max(0, grace - ageDays);
                })();
            pushSystemAlert({
                id: `pending_grace_${remaining}`,
                type: 'warning',
                title: 'Pagamento pendente',
                message: `Faltam ${remaining} dia(s) para bloqueio automático.`
            });
        }
        if (statusKey === 'expired' || statusKey === 'blocked') {
            const endDate = user && user.subscription && user.subscription.endDate ? new Date(user.subscription.endDate) : null;
            const formattedEnd = endDate && !Number.isNaN(endDate.getTime()) ? endDate.toLocaleDateString('pt-BR') : '--/--/----';
            pushSystemAlert({
                id: `expired_${formattedEnd}`,
                type: 'warning',
                title: 'Assinatura expirada',
                message: `A assinatura expirou em ${formattedEnd}. Acesso em modo leitura disponível por período limitado.`
            });
        }
        if (user && user.statusReason && String(user.statusReason).trim()) {
            pushSystemAlert({
                id: `status_reason_${shaSafe(String(user.statusReason))}`,
                type: 'info',
                title: 'Atualização administrativa',
                message: String(user.statusReason)
            });
        }
    } catch (_) {}
}

function shaSafe(value) {
    try {
        return btoa(unescape(encodeURIComponent(String(value || '')))).replace(/=+$/g, '').slice(0, 20);
    } catch (_) {
        return String(Date.now());
    }
}

function enableReadOnlyInteractionGuard() {
    if (window.__readOnlyGuardBound) return;
    window.__readOnlyGuardBound = true;
    document.addEventListener('click', function(e) {
        if (!window.__READ_ONLY_MODE_ACTIVE) return;
        const target = e.target && e.target.closest ? e.target.closest('button, .btn, [data-action], input[type="submit"], a.action-btn') : null;
        if (!target) return;
        const href = target.getAttribute ? target.getAttribute('href') : '';
        const targetText = String(target.textContent || '').toLowerCase();
        const targetId = String(target.id || '').toLowerCase();
        const targetClass = String(target.className || '').toLowerCase();
        const allowHref = href && (href.includes('subscription') || href.includes('status') || href.includes('login') || href.includes('index'));
        const allowLogout = targetText.includes('sair') || targetId.includes('logout') || targetClass.includes('logout');
        const allow = allowHref || allowLogout;
        if (!allow) {
            e.preventDefault();
            e.stopPropagation();
            if (window.__toast) window.__toast('Modo leitura ativo: operação de edição bloqueada.', 'warning', { duration: 2500 });
        }
    }, true);
    document.addEventListener('submit', function(e) {
        if (!window.__READ_ONLY_MODE_ACTIVE) return;
        e.preventDefault();
        e.stopPropagation();
        if (window.__toast) window.__toast('Modo leitura ativo: envio bloqueado.', 'warning', { duration: 2500 });
    }, true);
}

function resolveSubscriptionStatus(userDetails) {
    const getPendingAgeDays = (user) => {
        const sourceDate = (user && user.pendingPayment && user.pendingPayment.date) || (user && user.updatedAt) || null;
        const base = parseAnyDateSafe(sourceDate);
        if (!base) return 0;
        return Math.max(0, Math.ceil((Date.now() - base.getTime()) / (1000 * 60 * 60 * 24)));
    };
    const resolveTrialStatus = (user) => {
        const subscription = user && user.subscription && typeof user.subscription === 'object' ? user.subscription : {};
        const end = parseAnyDateSafe(subscription.endDate);
        if (!end) return 'expired';
        return end.getTime() > Date.now() ? 'trial_active' : 'expired';
    };
    const user = userDetails || {};
    const normalized = String(user.subscriptionStatus || user.status || '').trim().toLowerCase();
    const subscription = user.subscription && typeof user.subscription === 'object' ? user.subscription : {};
    const subscriptionEndDate = parseAnyDateSafe(subscription.endDate);
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
    if (normalized === 'trial' || normalized === 'trial_active' || normalized === 'teste_ativo') return resolveTrialStatus(user);
    const activeMarker = normalized === 'active' || normalized === 'ativo' || subscription.active === true;
    if (activeMarker) {
        if (!subscriptionEndDate) return 'active';
        return subscriptionEndDate.getTime() > Date.now() ? 'active' : 'expired';
    }
    if (normalized === 'pending' || normalized === 'pendente' || normalized === 'pending_payment') {
        const graceUntil = parseAnyDateSafe(user && user.pendingPayment ? user.pendingPayment.graceUntil : null);
        if (graceUntil) return graceUntil.getTime() >= Date.now() ? 'pending_grace' : 'blocked';
        const age = getPendingAgeDays(user);
        const cfg = parseInt(user && user.pendingPayment ? user.pendingPayment.graceDays : 0, 10);
        const graceDays = Number.isFinite(cfg) ? Math.max(0, Math.min(30, cfg)) : 7;
        return age <= graceDays ? 'pending_grace' : 'blocked';
    }
    if (user.pendingPayment && user.pendingPayment.status === 'pending') {
        const graceUntil = parseAnyDateSafe(user.pendingPayment.graceUntil);
        if (graceUntil) return graceUntil.getTime() >= Date.now() ? 'pending_grace' : 'blocked';
        const age = getPendingAgeDays(user);
        const cfg = parseInt(user.pendingPayment.graceDays, 10);
        const graceDays = Number.isFinite(cfg) ? Math.max(0, Math.min(30, cfg)) : 7;
        return age <= graceDays ? 'pending_grace' : 'blocked';
    }
    if (normalized === 'expired' || normalized === 'expirado') return 'expired';
    if (user.trialStart) return resolveTrialStatus(user);
    if (!hasStrongSignal()) return 'unknown';
    return 'expired';
}

function resolveSubscriptionRedirect(statusKey) {
    if (statusKey === 'expired') return 'subscription.html?reason=expired';
    if (statusKey === 'blocked') return 'subscription.html?reason=blocked';
    if (statusKey === 'pending' || statusKey === 'pending_grace') return 'subscription.html?reason=pending';
    return null;
}

function getNormalizedCompanyId(userDetails) {
    const user = userDetails && typeof userDetails === 'object' ? userDetails : {};
    const direct = String(user.companyId || user.companyID || user.tenantId || '').trim();
    if (direct) return direct;
    try {
        const fromWindow = String(window.appTenantId || '').trim();
        if (fromWindow) return fromWindow;
    } catch (_) {}
    try {
        const raw = JSON.parse(localStorage.getItem('company_info') || 'null');
        const cached = String((raw && (raw.companyId || raw.companyID || raw.tenantId || raw.id)) || '').trim();
        if (cached) return cached;
    } catch (_) {}
    return '';
}

function isCurrentPathTarget(pathname, target) {
    const current = String(pathname || '').toLowerCase();
    const normalizedTarget = String(target || '').split('?')[0].toLowerCase();
    if (!normalizedTarget) return false;
    return current.includes(normalizedTarget);
}

function isAdminInternalPath(pathname) {
    const path = String(pathname || '').toLowerCase();
    if (!path) return false;
    if (path.includes('admin.html')) return true;
    if (path.includes('admin-access-governance.html')) return true;
    return false;
}

function isAuthLandingPath(pathname) {
    const path = String(pathname || '').toLowerCase();
    if (!path || path === '/' || path.endsWith('/')) return true;
    if (path.includes('index.html')) return true;
    if (path.includes('login.html')) return true;
    if (path.includes('subscription.html')) return true;
    if (path.includes('subscription-status.html')) return true;
    return false;
}

function isSubscriptionCheckoutTarget(value) {
    return String(value || '').toLowerCase().includes('subscription.html');
}

function isSubscriptionStatusTarget(value) {
    return String(value || '').toLowerCase().includes('subscription-status.html');
}

function isSubscriptionSelfServiceTarget(value) {
    return isSubscriptionCheckoutTarget(value) || isSubscriptionStatusTarget(value);
}

function isLoginTarget(value) {
    return String(value || '').toLowerCase().includes('login.html');
}

function decodeRedirectCandidate(value) {
    let candidate = String(value || '').trim();
    for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
            const decoded = decodeURIComponent(candidate).trim();
            if (decoded === candidate) break;
            candidate = decoded;
        } catch (_) {
            break;
        }
    }
    return candidate;
}

function normalizeInternalRedirectTarget(value, fallback = '') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    const decoded = decodeRedirectCandidate(raw);
    if (!decoded || /[\u0000-\u001f\u007f]/.test(decoded) || decoded.includes('\\')) return fallback;

    const compact = decoded.replace(/\s+/g, '').toLowerCase();
    if (compact.startsWith('http://')
        || compact.startsWith('https://')
        || compact.startsWith('//')
        || compact.startsWith('javascript:')
        || compact.startsWith('data:')
        || compact.startsWith('vbscript:')) {
        return fallback;
    }

    const pathCandidate = decoded.split(/[?#]/)[0].replace(/^\/+/, '');
    if (pathCandidate.split('/').includes('..')) return fallback;

    try {
        const base = typeof window !== 'undefined' && window.location && window.location.origin
            ? window.location.origin
            : 'https://sisweb.local';
        const url = new URL(decoded, `${base}/`);
        if (url.origin !== base) return fallback;

        const pathname = url.pathname.replace(/^\/+/, '') || 'index.html';
        if (pathname.split('/').includes('..')) return fallback;
        if (!/^[a-z0-9_./-]+\.html$/i.test(pathname)) return fallback;

        return `${pathname}${url.search}${url.hash}`;
    } catch (_) {
        return fallback;
    }
}

async function resolvePostLoginRoute(userDetails, options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const currentPathname = String(opts.currentPathname || (typeof window !== 'undefined' ? window.location.pathname : '') || '').toLowerCase();
    const requested = normalizeInternalRedirectTarget(opts.requestedRedirect);
    const lowerRequested = requested.toLowerCase();
    const user = userDetails && typeof userDetails === 'object' ? userDetails : {};
    const isAdmin = opts.isSuperAdmin === true ? true : await isSuperAdminSession();
    const isAdminPanelUser = opts.isAdminPanelUser === true ? true : await hasAnyAdminPanelAccess();
    if (isAdmin || isAdminPanelUser) {
        if (isAdminInternalPath(currentPathname)) {
            return null;
        }
        if (!requested && isSubscriptionSelfServiceTarget(currentPathname)) {
            return null;
        }
        if (!requested) {
            return isAuthLandingPath(currentPathname) ? 'admin.html?tab=dashboard' : null;
        }
        if (isSubscriptionSelfServiceTarget(lowerRequested)) {
            return requested;
        }
        if (lowerRequested === 'index.html' || isLoginTarget(lowerRequested)) {
            return 'admin.html?tab=dashboard';
        }
        if (lowerRequested.includes('admin')) {
            return requested;
        }
        return 'admin.html?tab=dashboard';
    }
    const statusKey = String(opts.statusKey || resolveSubscriptionStatus(user)).toLowerCase();
    if (statusKey === 'unknown') {
        if (requested && !isLoginTarget(lowerRequested)) return requested;
        return null;
    }
    if (!requested && isSubscriptionSelfServiceTarget(currentPathname)) {
        return null;
    }
    if (requested && isSubscriptionSelfServiceTarget(lowerRequested)) {
        return requested;
    }
    const companyId = getNormalizedCompanyId(user);
    const hasCompanyId = !!companyId;
    if (!hasCompanyId) {
        if (statusKey === 'active') return 'company.html?reason=link_company';
        if (statusKey === 'pending' || statusKey === 'pending_grace') return 'subscription-status.html?reason=pending';
        if (statusKey === 'blocked') return 'subscription-status.html?reason=blocked';
        return 'subscription.html?reason=subscription_required';
    }
    if (statusKey === 'expired') return 'subscription.html?reason=expired';
    if (statusKey === 'blocked') return 'subscription.html?reason=blocked';
    if (statusKey === 'pending' || statusKey === 'pending_grace') return 'subscription.html?reason=pending';
    const currentIsLoginPage = isLoginTarget(currentPathname);
    if ((statusKey === 'active' || statusKey === 'trial_active')
        && ((requested && isLoginTarget(lowerRequested))
            || (!requested && currentIsLoginPage))) {
        return 'index.html';
    }
    if (requested && !lowerRequested.includes('admin-') && !lowerRequested.includes('admin.html') && !isLoginTarget(lowerRequested)) {
        return requested;
    }
    return null;
}

function isReadOnlyStatus(statusKey) {
    return statusKey === 'expired' || statusKey === 'blocked' || statusKey === 'pending' || statusKey === 'pending_grace';
}

function shouldBypassSubscriptionGuard(pathname) {
    const path = String(pathname || '').toLowerCase();
    if (path.includes('login.html')) return true;
    if (path.includes('subscription.html')) return true;
    if (path.includes('subscription-status.html')) return true;
    if (isAdminInternalPath(path)) return true;
    return false;
}

async function enforceSubscriptionGuard(userDetails, currentPathname) {
    try {
        const forcedRoute = await resolvePostLoginRoute(userDetails || {}, { currentPathname });
        if (forcedRoute && !isCurrentPathTarget(currentPathname, forcedRoute)) {
            return { allowed: false, redirect: forcedRoute, statusKey: 'flow_route' };
        }
        if (shouldBypassSubscriptionGuard(currentPathname)) return { allowed: true };
        const isAdmin = await isSuperAdminSession();
        if (isAdmin) return { allowed: true };
        const hasAdminAccess = await hasAnyAdminPanelAccess();
        if (hasAdminAccess) return { allowed: true };
        const statusKey = resolveSubscriptionStatus(userDetails || {});
        if (statusKey === 'unknown') return { allowed: true, statusKey: 'unknown' };
        if (statusKey === 'pending' || statusKey === 'pending_grace') {
            return { allowed: true, statusKey: 'read_only', reasonStatus: statusKey };
        }
        if (statusKey === 'expired' || statusKey === 'blocked') {
            const until = getBackendReadOnlyUntil(userDetails || {});
            if (until && until.getTime() > Date.now()) {
                return { allowed: true, statusKey: 'read_only', reasonStatus: statusKey, readOnlyUntil: until.toISOString() };
            }
            return { allowed: false, redirect: resolveSubscriptionRedirect(statusKey), statusKey };
        }
        const redirect = resolveSubscriptionRedirect(statusKey);
        if (redirect) return { allowed: false, redirect, statusKey };
        return { allowed: true, statusKey };
    } catch (_) {
        return { allowed: false, redirect: 'subscription.html', statusKey: 'expired' };
    }
}

// Variável para rastrear estado de loop
window._AUTH_LOOP_DETECTED = false;

function getAuthPerformanceDiagnostics() {
    try { return window.__SISWEB_AUTH_PERF__ || null; } catch (_) { return null; }
}

function authPerfTokenRefresh(reason, outcome = 'started', durationMs = 0) {
    try { getAuthPerformanceDiagnostics()?.tokenRefresh(reason, 'auth_guard', outcome, durationMs); } catch (_) {}
}

function authAuditLog(source) {
    try {
        const diagnostics = getAuthPerformanceDiagnostics();
        if (!diagnostics) return;
        const state = source === 'firebase' ? 'authenticated' : 'cached';
        diagnostics.auth(state, 'auth_guard', 0);
        diagnostics.phase('route_guard', 'auth_guard', 'observed', 0);
    } catch (_) {}
}

function renderPendingGraceBanner(statusKey, userDetails) {
    try {
        const existing = document.getElementById('subscriptionGraceBanner');
        if (existing) existing.remove();
        const uid = userDetails && (userDetails.uid || userDetails.id || userDetails.userId) ? String(userDetails.uid || userDetails.id || userDetails.userId) : '';
        if (readCachedSuperAdminFlag() || isSuperAdminUid(uid)) return;
        if (statusKey !== 'pending_grace' && statusKey !== 'trial_active') return;
        const banner = document.createElement('div');
        banner.id = 'subscriptionGraceBanner';
        if (statusKey === 'trial_active') {
            const end = parseAnyDateSafe(userDetails && userDetails.subscription ? userDetails.subscription.endDate : null);
            const remaining = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#ecfeff;color:#0e7490;border-bottom:1px solid #67e8f9;padding:10px 14px;font-size:13px;text-align:center;font-weight:600;';
            banner.innerHTML = `Teste gratuito ativo: restam <strong>${remaining}</strong> dia(s) com acesso completo. <a href="subscription-status.html" style="color:#0e7490;text-decoration:underline;">Ver assinatura</a>`;
        } else {
            const graceUntil = parseAnyDateSafe(userDetails && userDetails.pendingPayment ? userDetails.pendingPayment.graceUntil : null);
            const remaining = graceUntil ? Math.max(0, Math.ceil((graceUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : (() => {
                const sourceDate = (userDetails && userDetails.pendingPayment && userDetails.pendingPayment.date) || (userDetails && userDetails.updatedAt) || null;
                const base = parseAnyDateSafe(sourceDate);
                const ageDays = base ? Math.max(0, Math.ceil((Date.now() - base.getTime()) / (1000 * 60 * 60 * 24))) : 0;
                const cfg = parseInt(userDetails && userDetails.pendingPayment ? userDetails.pendingPayment.graceDays : 0, 10);
                const grace = Number.isFinite(cfg) ? Math.max(0, Math.min(30, cfg)) : 7;
                return Math.max(0, grace - ageDays);
            })();
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#fff7ed;color:#9a3412;border-bottom:1px solid #fdba74;padding:10px 14px;font-size:13px;text-align:center;font-weight:600;';
            banner.innerHTML = `Pagamento pendente: você está no período de carência. Restam <strong>${remaining}</strong> dia(s) antes do bloqueio. <a href="subscription-status.html" style="color:#c2410c;text-decoration:underline;">Acompanhar status</a>`;
        }
        document.body.appendChild(banner);
    } catch (_) {}
}

function renderReadOnlyBanner(statusKey, userDetails) {
    try {
        const existing = document.getElementById('subscriptionReadOnlyBanner');
        if (existing) existing.remove();
        const uid = userDetails && (userDetails.uid || userDetails.id || userDetails.userId) ? String(userDetails.uid || userDetails.id || userDetails.userId) : '';
        if (readCachedSuperAdminFlag() || isSuperAdminUid(uid)) {
            window.__READ_ONLY_MODE_ACTIVE = false;
            return;
        }
        const reasonStatus = statusKey === 'read_only' ? resolveSubscriptionStatus(userDetails || {}) : statusKey;
        if (!isReadOnlyStatus(reasonStatus)) {
            window.__READ_ONLY_MODE_ACTIVE = false;
            return;
        }
        const until = getBackendReadOnlyUntil(userDetails || {});
        const untilText = until ? until.toLocaleDateString('pt-BR') : '--/--/----';
        const banner = document.createElement('div');
        banner.id = 'subscriptionReadOnlyBanner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#eff6ff;color:#1d4ed8;border-bottom:1px solid #93c5fd;padding:10px 14px;font-size:13px;text-align:center;font-weight:600;';
        if (reasonStatus === 'pending' || reasonStatus === 'pending_grace') {
            banner.innerHTML = `Pagamento pendente: sistema em modo leitura até aprovação do administrador. <a href="subscription-status.html" style="color:#1d4ed8;text-decoration:underline;">Acompanhar status</a>`;
        } else if (reasonStatus === 'blocked') {
            banner.innerHTML = `Conta bloqueada: acesso em modo leitura ativo. <a href="subscription-status.html" style="color:#1d4ed8;text-decoration:underline;">Ver status</a>`;
        } else {
            banner.innerHTML = `Assinatura expirada: acesso em modo leitura ativo até <strong>${untilText}</strong>. <a href="subscription.html" style="color:#1d4ed8;text-decoration:underline;">Regularizar agora</a>`;
        }
        document.body.appendChild(banner);
        window.__READ_ONLY_MODE_ACTIVE = (reasonStatus === 'pending' || reasonStatus === 'pending_grace') || !!(until && until.getTime() > Date.now());
        enableReadOnlyInteractionGuard();
        upsertSubscriptionAlerts(reasonStatus, userDetails || {});
        const lastToast = parseInt(sessionStorage.getItem('readOnlyToastAt') || '0', 10);
        if ((Date.now() - lastToast) > 180000) {
            if (window.__toast) {
                const message = (reasonStatus === 'pending' || reasonStatus === 'pending_grace')
                    ? 'Pagamento pendente: sistema em modo leitura até aprovação.'
                    : (reasonStatus === 'blocked')
                        ? 'Conta bloqueada: sistema em modo leitura.'
                        : `Assinatura expirada: sistema em modo leitura até ${untilText}.`;
                window.__toast(message, 'warning', { duration: 5000 });
            }
            sessionStorage.setItem('readOnlyToastAt', String(Date.now()));
        }
    } catch (_) {}
}

function clearRestrictedSessionCache() {
    try {
        sessionStorage.removeItem('userAuthenticated');
        sessionStorage.removeItem('lastLogin');
        sessionStorage.setItem('redirectCount', '0');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('persistentUser');
        clearDurableAuthSession();
        clearCompanyContextCache();
    } catch (_) {}
}

async function waitForFirebaseReconnect(maxWaitMs = 2500, intervalMs = 200) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
        if (window._FIREBASE_CONNECTED === true) return true;
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return window._FIREBASE_CONNECTED === true;
}

// Função para verificar o período de teste e assinatura
function checkSubscription() {
    try {
        const currentUser = parseCurrentUserSafe();
        if (!currentUser) return false;
        
        const users = parseUsersCacheSafe();
        const userDetails = users.find(u => u.email === currentUser.email);
        
        if (!userDetails) return false;
        
        // Se usuário tem flag de assinatura ativa
        if (userDetails.hasActiveSubscription) return true;
        
        // Verificar período de teste (30 dias)
        if (userDetails.trialStart) {
            const trialStartDate = new Date(userDetails.trialStart);
            const currentDate = new Date();
            
            // Calcular diferença em dias
            const diffTime = currentDate - trialStartDate;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Retornar true se estiver dentro do período de teste
            return diffDays <= 30;
        }
        
        return false;
    } catch (error) {
        console.error("Erro ao verificar assinatura:", error);
        return false;
    }
}

// Função para verificar se o usuário está autenticado e com acesso válido
function checkAuth() {
    return new Promise(async (resolve) => {
        try {
            if (window.__logoutInProgress) {
                resolve(false);
                return;
            }
            // Verificar se está na página de login - nesse caso não redirecionamos
            if (window.location.pathname.toLowerCase().includes('login.html')) {
                console.log("🔍 Estamos na página de login, não redirecionando");
                resolve(false);
                return;
            }
            
            // Verificar se há um contador de redirecionamento ativo
            const redirectCount = parseInt(sessionStorage.getItem('redirectCount') || '0');
            if (redirectCount > 5) {
                console.log("⚠️ Loop de redirecionamento detectado em checkAuth, resetando fluxo de forma segura");
                window._AUTH_LOOP_DETECTED = true;
                sessionStorage.setItem('redirectCount', '0');
            }
            
            // Verificar dados locais essenciais para recarga de página
            const lastSuccessfulPage = localStorage.getItem('lastSuccessfulPage');
            const lastSuccessfulPageTime = parseInt(localStorage.getItem('lastSuccessfulPageTime') || '0');
            const lastPageIsRecent = (Date.now() - lastSuccessfulPageTime) < 3600000; // 1 hora
            
            if (lastSuccessfulPage && lastPageIsRecent) {
                sessionStorage.setItem('lastLogin', Date.now().toString());
            }
            
            // Verificar se temos um login recente na sessão
            const userAuthenticated = sessionStorage.getItem('userAuthenticated') === 'true';
            const lastLogin = parseInt(sessionStorage.getItem('lastLogin') || '0');
            const loginIsRecent = (Date.now() - lastLogin) < 3600000; // 1 hora
            
            if (userAuthenticated && loginIsRecent) {
                console.log("✅ Usuário autenticado via sessão recente");
            }
            
            console.log("🔍 Verificando autenticação no Firebase...");
            await waitForAuthInfrastructureReady();
            const canonicalContext = await getCanonicalSessionContext({ timeoutMs: 5000 });
            let user = canonicalContext && canonicalContext.user
                ? canonicalContext.user
                : await getAuthService().getCurrentUser();
            
            if (user) {
                // Usuário está logado no Firebase
                console.log("✅ Usuário autenticado no Firebase");
                authAuditLog('firebase', { uid: user.uid, email: user.email || '' });
                // Atualizar estado na sessão
                persistAuthenticatedSession({ uid: user.uid, email: user.email, displayName: user.displayName }, { source: 'firebase' });
                // Limpar contador de redirecionamentos
                sessionStorage.setItem('redirectCount', '0');
                
                const idTokenResult = await getCanonicalTokenResult(user, { forceRefresh: false });
                if (!isSameActiveAuthUser(user)) {
                    resolve(false);
                    return;
                }
                const claims = idTokenResult && idTokenResult.claims ? idTokenResult.claims : {};
                const companyId = (canonicalContext && canonicalContext.companyId)
                    || claims.companyId
                    || claims.companyID
                    || claims.tenantId
                    || null;
                const isSuperAdmin = !!(
                    (canonicalContext && canonicalContext.superAdmin === true)
                    || claims.superadmin === true
                    || isSuperAdminUid(user.uid)
                );
                persistSuperAdminFlag(isSuperAdmin);

                let effectiveCompanyId = companyId;
                if (!effectiveCompanyId) {
                    effectiveCompanyId = await tryRestoreCompanyClaim(user, companyId);
                }
                const remoteProfile = await loadUserProfileFromFirebase(user.uid);
                if (!isSameActiveAuthUser(user)) {
                    resolve(false);
                    return;
                }
                if (!effectiveCompanyId && remoteProfile) {
                    effectiveCompanyId = String((remoteProfile.companyId || remoteProfile.companyID || remoteProfile.tenantId) || '').trim();
                }
                if (isSuperAdmin) {
                    await setCompanyContext(null, { ownerUid: user.uid, authoritative: true });
                }
                if (!isSuperAdmin && effectiveCompanyId) {
                    await setCompanyContext(effectiveCompanyId, { ownerUid: user.uid, authoritative: true });
                }
                if (!isSuperAdmin && !effectiveCompanyId) {
                    await setCompanyContext(null, { ownerUid: user.uid, authoritative: true });
                }
                let guardUserDetails = { uid: user.uid, email: user.email, displayName: user.displayName };
                try {
                    const users = parseUsersCacheSafe();
                    const userDetails = remoteProfile || users.find((u) => u.email === user.email);
                    if (userDetails) {
                        guardUserDetails = {
                            ...userDetails,
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName || userDetails.displayName,
                            companyId: userDetails.companyId || userDetails.companyID || effectiveCompanyId || ''
                        };
                    }
                } catch (_) {}
                if (!guardUserDetails.companyId && effectiveCompanyId) {
                    guardUserDetails.companyId = effectiveCompanyId;
                }
                const guard = await enforceSubscriptionGuard(guardUserDetails, window.location.pathname);
                if (!guard.allowed && guard.redirect) {
                    if (guard.statusKey === 'expired' || guard.statusKey === 'blocked') {
                        clearRestrictedSessionCache();
                    }
                    window.location.href = guard.redirect;
                    resolve(false);
                    return;
                }

                persistAuthenticatedSession(guardUserDetails, { source: 'firebase_guard' });
                resolve(true);
                return;
            }

            const cachedAuth = await tryAllowCachedAuthSession('pwa_cached_session');
            if (cachedAuth.redirected) {
                resolve(false);
                return;
            }
            if (cachedAuth.allowed) {
                console.log("👤 Sessão restaurada via cache local PWA");
                resolve(true);
                return;
            }
            
            // Verificar se estamos no fluxo de redirecionamento
            const currentPath = window.location.pathname.toLowerCase();
            const urlParams = new URLSearchParams(window.location.search);
            const isNoRedirect = urlParams.get('noRedirect') === 'true';
            
            // Só redirecionar se não estivermos já tratando um redirecionamento
            if (!isNoRedirect) {
                // Incrementar contador de redirecionamentos
                const newRedirectCount = redirectCount + 1;
                sessionStorage.setItem('redirectCount', newRedirectCount.toString());
                
                // Usuário não está logado, redirecionar para login com parâmetros noRedirect e redirect
                console.log(`👤 Usuário não autenticado, redirecionando para login (${newRedirectCount})`);
                const target = encodeURIComponent(window.location.pathname + (window.location.hash || ''));
                window.location.href = `login.html?noRedirect=true&reason=ui_guard&redirect=${target}`;
            } else {
                console.log("🔄 Já estamos em um fluxo de redirecionamento, não redirecionando novamente");
            }
            
            resolve(false);
        } catch (error) {
            console.error("❌ Erro ao verificar autenticação:", error);
            
            // O cache só oferece UX degradada offline quando pertence ao mesmo usuário.
            const cachedAuth = await tryAllowCachedAuthSession('catch_cached_session');
            if (cachedAuth.redirected) {
                resolve(false);
                return;
            }
            if (cachedAuth.allowed) {
                resolve(true);
                return;
            }
            // Se não tiver usuário no localStorage e não estiver na página de login
            if (!window.location.pathname.toLowerCase().includes('login.html')) {
                console.log("👤 Nenhuma autenticação encontrada, redirecionando");
                
                // Verificar contador de redirecionamentos para evitar loops
                const redirectCount = parseInt(sessionStorage.getItem('redirectCount') || '0');
                if (redirectCount > 5) {
                    console.log("⚠️ Detectado possível loop de redirecionamento em fallback, resetando fluxo seguro");
                    sessionStorage.setItem('redirectCount', '0');
                }
                
                // Incrementar contador
                sessionStorage.setItem('redirectCount', (redirectCount + 1).toString());
                const target = encodeURIComponent(window.location.pathname + (window.location.hash || ''));
                window.location.href = `login.html?noRedirect=true&error=true&redirect=${target}`;
            }
            
            resolve(false);
        }
    });
}

/**
 * Função para realizar login do usuário
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @returns {Promise<Object>} - Resultado da operação
 */
async function login(email, password) {
    try {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const rawPassword = typeof password === 'string' ? password : String(password || '');
        console.log("🔐 Iniciando processo de login");
        
        // Validar entrada
        if (!normalizedEmail || !rawPassword) {
            return { success: false, error: "Email e senha são obrigatórios" };
        }
        
        // Aguardar firebaseService estar disponível
        console.log("⏳ Aguardando firebaseService estar disponível...");
        await waitForFirebaseService();
        
        // Tentar login usando firebaseService
        const authService = getAuthService();
        const result = await authService.login(normalizedEmail, rawPassword);
        
        if (result.success) {
            console.log("✅ Login bem-sucedido");
            const user = result.user;

            const sessionContext = result.sessionContext
                || await getCanonicalSessionContext({ timeoutMs: 5000 });
            const idTokenResult = await getCanonicalTokenResult(user, { forceRefresh: false });
            if (!isSameActiveAuthUser(user)) {
                return { success: false, error: 'A sessão mudou durante o login. Tente novamente.' };
            }
            const claims = idTokenResult && idTokenResult.claims ? idTokenResult.claims : {};
            const companyId = (sessionContext && sessionContext.companyId)
                || claims.companyId
                || claims.companyID
                || claims.tenantId
                || null;
            const isSuperAdmin = !!(
                (sessionContext && sessionContext.superAdmin === true)
                || claims.superadmin === true
                || isSuperAdminUid(user.uid)
            );
            persistSuperAdminFlag(isSuperAdmin);

            let effectiveCompanyId = companyId;
            if (!effectiveCompanyId) {
                effectiveCompanyId = await tryRestoreCompanyClaim(user, companyId);
            }
            const remoteProfile = await loadUserProfileFromFirebase(user.uid);
            if (!isSameActiveAuthUser(user)) {
                return { success: false, error: 'A sessão mudou durante o login. Tente novamente.' };
            }
            if (!effectiveCompanyId && remoteProfile) {
                effectiveCompanyId = String((remoteProfile.companyId || remoteProfile.companyID || remoteProfile.tenantId) || '').trim();
            }
            if (isSuperAdmin) {
                await setCompanyContext(null, { ownerUid: user.uid, authoritative: true });
            }
            if (!isSuperAdmin && effectiveCompanyId) {
                await setCompanyContext(effectiveCompanyId, { ownerUid: user.uid, authoritative: true });
            }
            if (!isSuperAdmin && !effectiveCompanyId) {
                await setCompanyContext(null, { ownerUid: user.uid, authoritative: true });
            }

            let subscriptionStatus = 'unknown';
            try {
                const users = parseUsersCacheSafe();
                const userDetails = remoteProfile || users.find((u) => u.email === user.email) || {};
                const mergedDetails = {
                    ...userDetails,
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName
                };
                subscriptionStatus = resolveSubscriptionStatus(mergedDetails);
            } catch (_) {}
            const routeUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || '',
                companyId: effectiveCompanyId || String((remoteProfile && (remoteProfile.companyId || remoteProfile.companyID || remoteProfile.tenantId)) || '').trim(),
                subscriptionStatus
            };
            persistAuthenticatedSession(routeUser, { source: 'login' });
            const flowRedirect = await resolvePostLoginRoute(routeUser, {
                statusKey: subscriptionStatus,
                isSuperAdmin
            });
            return {
                success: true,
                user: user,
                subscriptionStatus,
                flowRedirect
            };
        } else {
            // Verificar se é um erro de API Key para tratamento especial
            if (result.error && (
                result.error.includes("api-key") || 
                result.error.includes("API Key") ||
                result.error.includes("API key")
            )) {
                console.error("🔑 Falha de configuração detectada durante login");
                return { 
                    success: false, 
                    error: "Erro de configuração do Firebase. Por favor, tente novamente mais tarde ou contate o suporte."
                };
            }
            
            console.log("❌ Falha no login");
            return { 
                success: false, 
                error: result.error || "Usuário ou senha inválidos" 
            };
        }
    } catch (error) {
        console.error("❌ Erro no processo de login:", error && error.code ? error.code : 'unknown');
        
        // Verificar se é um erro de API Key para tratamento especial
        if (error.code === 'auth/api-key-not-valid' || 
            error.message?.includes("api-key") || 
            error.message?.includes("API Key")) {
            
            console.error("🔑 Falha crítica de configuração do Firebase");
            return { 
                success: false, 
                error: "Erro de configuração do sistema. Por favor, contate o administrador."
            };
        }
        
        return { 
            success: false, 
            error: error.message || "Erro desconhecido ao fazer login" 
        };
    }
}

/**
 * Função para registrar um novo usuário e associá-lo a uma empresa.
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @param {string} companyId - ID da empresa a ser associada
 * @returns {Promise<Object>} - Resultado da operação
 */
async function register(email, password, companyId) {
    try {
        console.log("📝 Iniciando processo de registro");

        // Validar entrada
        if (!email || !password || !companyId) {
            return { success: false, error: "Email, senha e ID da empresa são obrigatórios" };
        }

        // Aguardar firebaseService estar disponível
        console.log("⏳ Aguardando firebaseService estar disponível para registro...");
        await waitForFirebaseService();

        // Tentar registrar usando firebaseService
        const authService = getAuthService();
        const result = await authService.registerUser(email, password, companyId);

        if (result.success) {
            console.log("✅ Registro bem-sucedido");
            return {
                success: true,
                user: result.user
            };
        } else {
            console.log("❌ Falha no registro");
            return {
                success: false,
                error: result.error || "Erro desconhecido ao registrar usuário"
            };
        }
    } catch (error) {
        console.error("❌ Erro no processo de registro:", error && error.code ? error.code : 'unknown');
        return {
            success: false,
            error: error.message || "Erro desconhecido ao registrar usuário"
        };
    }
}

// Função para fazer logout
async function logout() {
    try {
        console.log("🚪 auth.js: Realizando logout");
        const result = await getAuthService().logout();
        if (!result || result.success !== true) {
            throw new Error(result && result.error ? result.error : 'Logout remoto não confirmado.');
        }
        try {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('persistentUser');
            localStorage.removeItem('auth');
            clearDurableAuthSession();
            clearCompanyContextCache();
            sessionStorage.clear();
            try { window.__SESSION_SUPERADMIN = false; } catch (_) {}
            try { window.__SESSION_SUPERADMIN_UID = ''; } catch (_) {}
        } catch (_) {}
        
        // Redirecionar para página de login preservando alvo
        const target = encodeURIComponent('index.html');
        window.location.replace(`login.html?noRedirect=true&logout=1&redirect=${target}`);
        return { success: true };
    } catch (error) {
        console.error("❌ auth.js: Erro ao fazer logout:", error && error.code ? error.code : 'unknown');
        try {
            if (typeof window.__toast === 'function') {
                window.__toast('Não foi possível confirmar o logout. A sessão foi mantida; tente novamente.', 'error', { duration: 5000 });
            }
        } catch (_) {}
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

// Função para obter o nome do usuário logado
function getLoggedUsername() {
    try {
        const currentUser = parseCurrentUserSafe();
        if (!currentUser) return '';
        
        return currentUser.displayName || currentUser.email.split('@')[0];
    } catch (error) {
        console.error("Erro ao obter nome do usuário:", error);
        return '';
    }
}

// Função para obter informações detalhadas do usuário atual
async function getCurrentUserDetails() {
    try {
        // Firebase Auth permanece a fonte de identidade, independentemente do estado do RTDB.
        const user = await getAuthService().getCurrentUser();
        
        if (user) {
            authAuditLog('firebase', { uid: user.uid, method: 'getCurrentUserDetails' });
            const remoteProfile = await loadUserProfileFromFirebase(user.uid);
            const users = parseUsersCacheSafe();
            const userDetails = remoteProfile || users.find((u) => u.email === user.email) || {};
            return {
                ...userDetails,
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || userDetails.displayName || userDetails.username || user.email.split('@')[0]
            };
        }
        
        // Fallback para localStorage se Firebase não retornar usuário
        const currentUser = parseCurrentUserSafe();
        if (!currentUser) return null;
        authAuditLog('currentUser', { method: 'getCurrentUserDetails_fallback' });
        
        const users = parseUsersCacheSafe();
        const userDetails = users.find((u) => u.email === currentUser.email) || {};
        return {
            ...userDetails,
            ...currentUser
        };
    } catch (error) {
        console.error("Erro ao obter detalhes do usuário:", error);
        return null;
    }
}




// Função para iniciar o período de teste
async function startTrial(username) {
    try {
        // Implementação com Firebase
        const user = await getAuthService().getCurrentUser();
        if (user) {
            // Atualizar dados do usuário no Firebase
            // TODO: Implementar atualização de dados do usuário no Firebase
        }
        
        // Fallback para o método antigo
        return await legacyStartTrial(username);
    } catch (error) {
        console.error("Erro ao iniciar período de teste:", error);
        // Fallback para o método antigo
        return await legacyStartTrial(username);
    }
}

// Versão antiga de iniciar período de teste (fallback)
async function legacyStartTrial(username) {
    try {
        const users = await window.firebaseService.getAll('users');
        if (!users) {
            console.warn("⚠️ Não foi possível carregar usuários do Firebase para legacyStartTrial.");
            return false;
        }

        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex === -1) {
            console.warn(`⚠️ Usuário ${username} não encontrado para iniciar período de teste.`);
            return false;
        }

        const userToUpdate = { ...users[userIndex] }; // Criar cópia para evitar mutação direta
        userToUpdate.trialStart = new Date().toISOString();

        const result = await window.firebaseService.save('users', userToUpdate, userToUpdate.id);
        return !!result;
    } catch (error) {
        console.error("❌ Erro em legacyStartTrial:", error);
        return false;
    }
}



// Versão antiga de ativar assinatura (fallback)
async function legacyActivateSubscription(username, months) {
    try {
        const users = await window.firebaseService.getAll('users');
        if (!users) {
            console.warn("⚠️ Não foi possível carregar usuários do Firebase para legacyActivateSubscription.");
            return false;
        }

        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex === -1) {
            console.warn(`⚠️ Usuário ${username} não encontrado para ativar assinatura.`);
            return false;
        }

        const userToUpdate = { ...users[userIndex] }; // Criar cópia
        userToUpdate.hasActiveSubscription = true;
        userToUpdate.subscriptionType = 'premium';
        userToUpdate.subscriptionEndDate = new Date(
            new Date().setMonth(new Date().getMonth() + months)
        ).toISOString();

        const result = await window.firebaseService.save('users', userToUpdate, userToUpdate.id);
        return !!result;
    } catch (error) {
        console.error("❌ Erro em legacyActivateSubscription:", error);
        return false;
    }
}

// Função para ativar a assinatura
async function activateSubscription(username, months) {
    try {
        // Implementação com Firebase
        const user = await getAuthService().getCurrentUser();
        if (user) {
            // Atualizar dados do usuário no Firebase
            // TODO: Implementar atualização de dados do usuário no Firebase
        }
        
        // Fallback para o método antigo
        return await legacyActivateSubscription(username, months);
    } catch (error) {
        console.error("Erro ao ativar assinatura:", error);
        // Fallback para o método antigo
        return await legacyActivateSubscription(username, months);
    }
}

// Versão antiga de ativar assinatura (fallback)
async function legacyActivateSubscription(username, months) {
    try {
        const users = await window.firebaseService.getAll('users');
        if (!users) {
            console.warn("⚠️ Não foi possível carregar usuários do Firebase para legacyActivateSubscription.");
            return false;
        }

        const userIndex = users.findIndex(u => u.username === username);
        if (userIndex === -1) {
            console.warn(`⚠️ Usuário ${username} não encontrado para ativar assinatura.`);
            return false;
        }

        const userToUpdate = { ...users[userIndex] }; // Criar cópia
        userToUpdate.hasActiveSubscription = true;
        userToUpdate.subscriptionType = months === 12 ? 'annual' : 'monthly';
        userToUpdate.subscriptionEndDate = new Date(
            new Date().setMonth(new Date().getMonth() + months)
        ).toISOString();

        const result = await window.firebaseService.save('users', userToUpdate, userToUpdate.id);
        return !!result;
    } catch (error) {
        console.error("❌ Erro em legacyActivateSubscription:", error);
        return false;
    }
}

// Configura listener para mudanças no estado de autenticação
function setupAuthListener() {
    try {
        // Usar a função onAuthStateChanged do authService
        const diagnostics = getAuthPerformanceDiagnostics();
        try { diagnostics?.listener('auth', 'add', 'auth_guard', 0); } catch (_) {}
        const unsubscribe = getAuthService().onAuthStateChanged((user) => {
            try { diagnostics?.auth(user ? 'authenticated' : 'unauthenticated', 'auth_guard', 0); } catch (_) {}
            if (!user) {
                // Verificar se há autenticação legada
                const legacyAuth = getData('auth');
                const cachedAuth = getUsableCachedAuthSession();
                if ((!legacyAuth || !legacyAuth.isLoggedIn) && !cachedAuth) {
                    // Não está autenticado em nenhum sistema
                    if (isSubscriptionCheckoutTarget(window.location.pathname)) {
                        return;
                    }
                    if (window.location.pathname !== '/login.html') {
                        const target = encodeURIComponent(window.location.pathname + (window.location.hash || ''));
                        window.location.href = `login.html?noRedirect=true&reason=auth_listener&redirect=${target}`;
                    }
                }
            }
        });
        return () => {
            try { diagnostics?.listener('auth', 'remove', 'auth_guard', 0); } catch (_) {}
            return typeof unsubscribe === 'function' ? unsubscribe() : undefined;
        };
    } catch (error) {
        console.error("Erro ao configurar listener de autenticação:", error && error.code ? error.code : 'unknown');
        // Fallback: não faz nada
        return null;
    }
}

// Verifica autenticação ao carregar a página, mas evita redirecionar na página de login
document.addEventListener('DOMContentLoaded', async function() {
    // Evitar inicialização repetida
    if (isInitialized || window.__siswebAuthInitializedForPath === window.location.pathname) {
        console.log("🔄 auth.js já inicializado, pulando");
        return;
    }
    
    // Marcar como inicializado
    isInitialized = true;
    window.__siswebAuthInitializedForPath = window.location.pathname;
    
    try {
        // Obter o path da página atual
        const currentPath = window.location.pathname.toLowerCase();
        
        // Evitar verificar autenticação e redirecionamento se já estiver na página de login
        if (currentPath.includes('login.html')) {
            console.log("🔑 Página de login detectada, pulando verificação de autenticação");
            return;
        }
        if (isSubscriptionCheckoutTarget(currentPath)) {
            console.log("🧾 Página pública de assinatura detectada, carregando oferta sem redirecionamento automático");
            return;
        }
        
        console.log("🔍 Verificando autenticação com delay para evitar loops...");
        // Adicionar um delay maior para garantir que o Firebase tenha tempo de inicializar
        setTimeout(async () => {
            const isAuthenticated = await checkAuth();
            if (!isAuthenticated) {
                console.log("⚠️ Verificação de autenticação falhou");
                return;
            }
            try {
                const details = await getCurrentUserDetails();
                const statusKey = resolveSubscriptionStatus(details || {});
                renderReadOnlyBanner(statusKey, details || {});
                if (!isReadOnlyStatus(statusKey)) renderPendingGraceBanner(statusKey, details || {});
                upsertSubscriptionAlerts(statusKey, details || {});
            } catch (_) {}
            
            // Adiciona o nome do usuário no menu, se existir um elemento com id 'loggedUsername'
            const usernameElement = document.getElementById('loggedUsername');
            if (usernameElement) {
                const username = getLoggedUsername();
                usernameElement.textContent = username;
            }
            console.log("✅ Autenticação verificada e usuário está logado");
        }, 1500); // Aumentando o atraso para 1500ms para dar mais tempo ao Firebase
    } catch (error) {
        console.error("❌ Erro ao verificar autenticação na inicialização:", error);
    }
});

// Exportar funções globalmente para compatibilidade
window.authFunctions = {
    checkSubscription,
    resolveSubscriptionStatus,
    resolveSubscriptionRedirect,
    normalizeInternalRedirectTarget,
    resolvePostLoginRoute,
    enforceSubscriptionGuard,
    isSuperAdminUid,
    isSuperAdminSession,
    hasAdminPageAccess,
    hasAnyAdminPanelAccess,
    getCurrentUidSafe,
    checkAuth,
    login,
    register,
    logout,
    persistAuthenticatedSession,
    clearDurableAuthSession,
    clearCompanyContextCache,
    getUsableCachedAuthSession,
    getLoggedUsername,
    getCurrentUserDetails,
    startTrial,
    activateSubscription,
    setupAuthListener
};

// Também exportar diretamente no window para compatibilidade total
window.checkSubscription = checkSubscription;
window.resolveSubscriptionStatus = resolveSubscriptionStatus;
window.resolveSubscriptionRedirect = resolveSubscriptionRedirect;
window.normalizeInternalRedirectTarget = normalizeInternalRedirectTarget;
window.resolvePostLoginRoute = resolvePostLoginRoute;
window.enforceSubscriptionGuard = enforceSubscriptionGuard;
window.isSuperAdminUid = isSuperAdminUid;
window.isSuperAdminSession = isSuperAdminSession;
window.hasAdminPageAccess = hasAdminPageAccess;
window.hasAnyAdminPanelAccess = hasAnyAdminPanelAccess;
window.getCurrentUidSafe = getCurrentUidSafe;
window.checkAuth = checkAuth;
window.login = login;
window.register = register;
window.logout = logout;
window.markSiswebSessionAuthenticated = persistAuthenticatedSession;
window.clearSiswebDurableAuthSession = clearDurableAuthSession;
window.clearSiswebCompanyContextCache = clearCompanyContextCache;
window.getSiswebCachedAuthSession = getUsableCachedAuthSession;
window.getLoggedUsername = getLoggedUsername;
window.getCurrentUserDetails = getCurrentUserDetails;
window.startTrial = startTrial;
window.activateSubscription = activateSubscription;
window.setupAuthListener = setupAuthListener;
window.getSystemAlerts = getSystemAlerts;

(function() {
    if (window.__siswebFooterAuthBootstrap) return;
    window.__siswebFooterAuthBootstrap = true;
    function normalizeModuleName(value) {
        const cleaned = String(value || '').replace(/\s+/g, ' ').trim();
        if (!cleaned) return '';
        if (/^(carregando|loading|aguarde)([\s\.\-…:]*)$/i.test(cleaned)) return '';
        return cleaned;
    }
    function inferModuleName() {
        const titlePart = normalizeModuleName((document.title || '').split(' - ')[0]);
        if (titlePart) return titlePart;
        const selectors = ['h1.main-title', '.main-title', 'h1.page-title', '.page-title', 'h1'];
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            const candidate = normalizeModuleName(el && el.textContent);
            if (candidate) return candidate;
        }
        const pathName = (window.location.pathname || '').split('/').pop() || '';
        const fallbackName = pathName.replace('.html', '').replace(/[-_]/g, ' ').trim();
        return normalizeModuleName(fallbackName) || 'Módulo';
    }
    function setFooterModuleName(footer) {
        const node = footer && footer.querySelector('.global-footer-module');
        if (node) node.textContent = inferModuleName();
    }
    function bindFooterContact(footer) {
        if (!footer) return;
        const contact = footer.querySelector('.global-footer-contact');
        if (!contact || contact.dataset.bound === '1') return;
        contact.dataset.bound = '1';
        contact.addEventListener('click', function(e) {
            const aboutLink = document.querySelector('a.about-link');
            if (aboutLink) {
                e.preventDefault();
                aboutLink.click();
            }
        });
    }
    function bindFooterTitleObserver(footer) {
        if (!footer || window.__siswebFooterTitleObserverBound) return;
        window.__siswebFooterTitleObserverBound = true;
        const update = function() { setFooterModuleName(footer); };
        const titleEl = document.querySelector('head > title');
        if (titleEl && window.MutationObserver) {
            const observer = new MutationObserver(update);
            observer.observe(titleEl, { childList: true, subtree: true, characterData: true });
        }
        setTimeout(update, 300);
        setTimeout(update, 1200);
    }
    function ensureFooter() {
        if (!document || !document.body) return;
        const isLoginPage = /(^|\/)login\.html$/i.test(window.location.pathname || '');
        const loginNote = isLoginPage ? document.querySelector('.login-footer-note') : null;
        const existingFooter = document.querySelector('.global-system-footer');
        if (existingFooter) {
            if (isLoginPage && loginNote && loginNote.parentElement && existingFooter.parentElement !== loginNote.parentElement) {
                loginNote.insertAdjacentElement('afterend', existingFooter);
            }
            setFooterModuleName(existingFooter);
            bindFooterContact(existingFooter);
            bindFooterTitleObserver(existingFooter);
            return;
        }
        const legacyFooter = Array.from(document.querySelectorAll('footer, .footer')).find((el) => /direitos reservados/i.test(el.textContent || ''));
        const style = document.createElement('style');
        style.id = 'global-system-footer-style';
        style.textContent = `
            .global-system-footer {
                margin-top: 28px;
                padding: 18px 12px 10px;
                text-align: center;
                border-top: 1px solid #e5e7eb;
                color: #6b7280;
                font-size: 13px;
                line-height: 1.6;
                background: transparent;
            }
            body.login-page .global-system-footer {
                margin: 14px auto 0;
                width: min(100%, 420px);
                border: 1px solid rgba(255, 255, 255, 0.25);
                border-top: 1px solid rgba(255, 255, 255, 0.25);
                border-radius: 10px;
                padding: 10px 12px;
                background: rgba(15, 23, 42, 0.42);
                color: #e2e8f0;
                line-height: 1.5;
            }
            body.login-page .global-system-footer p { margin: 4px 0; }
            body.login-page .global-system-footer a { color: #93c5fd; }
            .global-system-footer a {
                color: #1d4ed8;
                text-decoration: none;
                font-weight: 600;
            }
            .global-system-footer a:hover { text-decoration: underline; }
            @media print {
                .global-system-footer { display: none !important; }
            }
        `;
        if (!document.getElementById(style.id)) document.head.appendChild(style);
        const footer = legacyFooter || document.createElement('footer');
        footer.className = 'global-system-footer';
        footer.removeAttribute('style');
        footer.innerHTML = `
            <p>&copy; 2024 Sistema de <span class="global-footer-module"></span>. Todos os direitos reservados.</p>
            <p>Desenvolvido por Nelson Brito <a href="#" class="global-footer-contact">Fale Conosco</a>.</p>
        `;
        setFooterModuleName(footer);
        bindFooterContact(footer);
        bindFooterTitleObserver(footer);
        if (isLoginPage) document.body.classList.add('login-page');
        if (!legacyFooter) {
            if (isLoginPage && loginNote && loginNote.parentElement) loginNote.insertAdjacentElement('afterend', footer);
            else document.body.appendChild(footer);
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureFooter);
    else ensureFooter();
})();

console.log("🔐 auth.js: Funções carregadas e exportadas globalmente");
})();
