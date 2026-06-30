// Your web app's Firebase configuration
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

const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.getApp();
const authService = firebase.auth();
const firestoreService = typeof firebase.firestore === 'function' ? firebase.firestore() : null;
const rtdbService = typeof firebase.database === 'function' ? firebase.database() : null;
let tenantId = null;

function sanitizeTenantId(value) {
    const raw = value ? String(value).trim() : '';
    if (!raw) return null;
    if (/[\/.#$\[\]\s]/.test(raw)) return null;
    const blocked = new Set(['users', 'companies', 'roles', 'system', '__no_tenant__', 'default']);
    if (blocked.has(raw.toLowerCase())) return null;
    return raw;
}

function resolveTenantId() {
    try {
        const fromMemory = sanitizeTenantId(tenantId);
        if (fromMemory) return fromMemory;
        if (typeof window !== 'undefined' && window.appTenantId) {
            const fromWindow = sanitizeTenantId(window.appTenantId);
            if (fromWindow) return fromWindow;
        }
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('company_info') : null;
        if (raw) {
            const obj = JSON.parse(raw);
            const t = sanitizeTenantId(obj.companyId || obj.companyID || obj.tenantId || obj.id);
            if (t) return t;
        }
    } catch (_) {}
    return null;
}

function getNamespacedPath(path) {
    const clean = String(path || '').replace(/^\/+/, '');
    const activeTenant = resolveTenantId();
    if (!activeTenant) return clean;
    const prefix = `companies/${activeTenant}/`;
    if (clean.startsWith(prefix)) return clean;
    if (clean.startsWith('companies/')) return clean;
    return `${prefix}${clean}`;
}

authService.getCurrentUser = function() {
    return new Promise((resolve) => {
        const unsubscribe = authService.onAuthStateChanged(
            (user) => {
                try { unsubscribe(); } catch (_) {}
                resolve(user || null);
            },
            () => {
                try { unsubscribe(); } catch (_) {}
                resolve(null);
            }
        );
        setTimeout(() => {
            try { unsubscribe(); } catch (_) {}
            resolve(authService.currentUser || null);
        }, 5000);
    });
};

function isOperational() {
    return !!app && !!authService && !!rtdbService;
}

function isFirebaseOperational() {
    return { operational: isOperational() };
}

async function loadFromFirebase(path) {
    if (!rtdbService) {
        return { success: false, error: 'Realtime Database indisponível' };
    }
    try {
        const snapshot = await rtdbService.ref(getNamespacedPath(path)).once('value');
        return { success: true, data: snapshot.val(), source: 'firebase' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function saveToFirebase(path, key, data) {
    if (!rtdbService) {
        return { success: false, error: 'Realtime Database indisponível' };
    }
    try {
        const ref = rtdbService.ref(getNamespacedPath(path));
        if (key) {
            await ref.child(String(key)).set(data);
            return { success: true, key: String(key), source: 'firebase' };
        }
        await ref.set(data);
        return { success: true, source: 'firebase' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function saveUserData(key, data) {
    return saveToFirebase(key, null, data);
}

function loadData(path) {
    return loadFromFirebase(path);
}

function saveData(path, data) {
    return saveToFirebase(path, null, data);
}

async function removeFromFirebase(path) {
    if (!rtdbService) {
        return { success: false, error: 'Realtime Database indisponível' };
    }
    try {
        await rtdbService.ref(getNamespacedPath(path)).remove();
        return { success: true, source: 'firebase' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getAll(key) {
    try {
        const result = await loadFromFirebase(key);
        if (result && result.success) {
            const data = result.data;
            if (Array.isArray(data)) return data;
            if (data && typeof data === 'object') return Object.values(data);
            return [];
        }
    } catch (_) {}
    try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object') return Object.values(parsed);
        return [];
    } catch (_) {
        return [];
    }
}

async function uploadFile(path, file) {
    if (typeof firebase.storage !== 'function') {
        return { success: false, error: 'Firebase Storage indisponível' };
    }
    try {
        const storage = firebase.storage();
        const ref = storage.ref().child(path);
        const snapshot = await ref.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        return { success: true, path, downloadURL, url: downloadURL };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getDownloadURLFromStorage(pathOrUrl) {
    const raw = pathOrUrl ? String(pathOrUrl).trim() : '';
    if (!raw) return '';
    if (/^(https?:|data:|blob:|file:)/i.test(raw)) return raw;
    if (typeof firebase.storage !== 'function') {
        throw new Error('Firebase Storage indisponível');
    }
    const storage = firebase.storage();
    return await storage.ref().child(raw).getDownloadURL();
}

function extractStoragePathFromUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^gs:\/\//i.test(raw)) {
        return raw.replace(/^gs:\/\/[^/]+\//i, '').replace(/^\/+/, '');
    }
    if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, '');
    try {
        const url = new URL(raw, window.location && window.location.origin ? window.location.origin : undefined);
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

async function uploadCompanyLogo(file, companyId, options = {}) {
    if (!file) throw new Error('Arquivo de logo não informado');
    const tenant = sanitizeTenantId(companyId || options.companyId || getTenantId());
    if (!tenant) throw new Error('companyId inválido para upload da logo');
    const type = String(file.type || '');
    if (!type.startsWith('image/')) throw new Error('A logo precisa ser uma imagem');
    const maxSize = Number(options.maxSize || (2 * 1024 * 1024));
    if (Number(file.size || 0) > maxSize) throw new Error('A logo deve ter no máximo 2MB para cumprir as regras do Storage');

    const safeName = String(file.name || 'logo.png').replace(/[^\w.\-]+/g, '_').slice(0, 90) || 'logo.png';
    const path = `companies/${tenant}/profile/logo/current`;
    const logoPrefix = `companies/${tenant}/profile/logo/`;
    const previousPath = String(
        options.previousStoragePath
        || options.logoStoragePath
        || options.logoPath
        || options.previousPath
        || extractStoragePathFromUrl(options.previousLogoUrl || options.logoUrl || '')
        || ''
    ).trim().replace(/^\/+/, '');
    const result = await uploadFile(path, file);
    if (!result || result.success === false) {
        throw new Error((result && result.error) || 'Falha no upload da logo');
    }
    if (previousPath && previousPath !== path && previousPath.startsWith(logoPrefix)) {
        try { await deleteStorageFile(previousPath); } catch (_) {}
    }
    return {
        success: true,
        data: {
            path,
            storagePath: path,
            downloadURL: result.downloadURL,
            url: result.downloadURL,
            name: safeName,
            contentType: type,
            size: Number(file.size || 0),
            updatedAt: new Date().toISOString()
        }
    };
}

async function deleteStorageFile(pathOrUrl) {
    const raw = pathOrUrl ? String(pathOrUrl).trim() : '';
    if (!raw) return { success: false, error: 'Caminho de Storage não informado' };
    if (/^https?:\/\//i.test(raw)) {
        return { success: false, error: 'Remoção exige caminho do Storage, não URL pública' };
    }
    if (typeof firebase.storage !== 'function') {
        return { success: false, error: 'Firebase Storage indisponível' };
    }
    try {
        await firebase.storage().ref().child(raw.replace(/^\/+/, '')).delete();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function setTenantId(id) {
    tenantId = sanitizeTenantId(id);
    try {
        if (typeof window !== 'undefined') window.appTenantId = tenantId || null;
    } catch (_) {}
}

function getTenantId() {
    return resolveTenantId();
}

async function callFunction(functionName, payload = {}) {
    const safeName = String(functionName || '').trim();
    if (!safeName) throw new Error('Nome da Cloud Function não informado.');
    if (typeof firebase.functions !== 'function') {
        throw new Error('Firebase Functions indisponível');
    }
    const callable = firebase.functions().httpsCallable(safeName);
    const result = await callable(payload && typeof payload === 'object' ? payload : {});
    return result && Object.prototype.hasOwnProperty.call(result, 'data') ? result.data : null;
}

function normalizeCallableError(functionName, error, fallback) {
    const rawMessage = String(error && error.message ? error.message : error || '');
    const lower = rawMessage.toLowerCase();
    if (lower.includes('not found') || lower.includes('404')) {
        return `Cloud Function '${functionName}' não encontrada. Publique as Functions antes de salvar.`;
    }
    if (lower.includes('cors') || lower.includes('failed to fetch') || lower.includes('network')) {
        return `Falha de rede/CORS ao chamar '${functionName}'. Verifique deploy e conexão.`;
    }
    if (lower.includes('permission') || lower.includes('permission_denied')) {
        return 'Sem permissão para salvar estes dados. Entre novamente e confirme se o usuário pertence à empresa correta.';
    }
    return rawMessage || fallback || `Falha ao chamar '${functionName}'.`;
}

async function updateMyCompanyProfile(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const result = await callFunction('updateMyCompanyProfile', data);
        return { success: true, data: result || null };
    } catch (error) {
        return {
            success: false,
            error: normalizeCallableError('updateMyCompanyProfile', error, 'Falha ao atualizar perfil da empresa.')
        };
    }
}

async function updateMyUserProfile(payload) {
    try {
        const data = payload && typeof payload === 'object' ? payload : {};
        const result = await callFunction('updateMyUserProfile', data);
        const currentUser = authService.currentUser || await authService.getCurrentUser();
        try {
            const authPatch = {};
            if (Object.prototype.hasOwnProperty.call(data, 'displayName')) authPatch.displayName = data.displayName;
            if (Object.prototype.hasOwnProperty.call(data, 'photoURL')) authPatch.photoURL = data.photoURL || null;
            if (currentUser && Object.keys(authPatch).length && typeof currentUser.updateProfile === 'function') {
                await currentUser.updateProfile(authPatch);
            }
        } catch (_) {}
        return { success: true, data: result && result.profile ? result.profile : data };
    } catch (error) {
        return {
            success: false,
            error: normalizeCallableError('updateMyUserProfile', error, 'Falha ao atualizar perfil do usuário.')
        };
    }
}

async function createCompanyOnboarding(companyPayload) {
    try {
        const payload = companyPayload && typeof companyPayload === 'object' ? companyPayload : {};
        const result = await callFunction('createCompanyOnboarding', { company: payload });
        return { success: true, data: result || null };
    } catch (error) {
        return {
            success: false,
            error: normalizeCallableError('createCompanyOnboarding', error, 'Falha ao criar empresa no onboarding.')
        };
    }
}

function normalizeCompanyProfileForReport(raw = {}, companyId = '') {
    const src = raw && typeof raw === 'object' ? raw : {};
    const id = sanitizeTenantId(src.companyId || src.companyID || src.tenantId || src.id || companyId) || '';
    const name = src.nome || src.name || src.razaoSocial || src.fantasia || src.nomeFantasia || src.companyName || '';
    const enderecoObj = src.endereco && typeof src.endereco === 'object' ? src.endereco : {};
    const address = src.endereco && typeof src.endereco !== 'object'
        ? src.endereco
        : (src.address || [enderecoObj.logradouro, enderecoObj.numero, enderecoObj.bairro].filter(Boolean).join(', '));
    const city = src.cidade || src.city || src.municipio || enderecoObj.municipio || '';
    const state = src.estado || src.state || src.uf || enderecoObj.uf || '';
    const phone = src.telefone || src.phone || src.celular || '';
    const geoObj = src.geolocation && typeof src.geolocation === 'object' ? src.geolocation : {};
    const locationObj = src.location && typeof src.location === 'object' ? src.location : {};
    const latitude = String(src.latitude || src.geoLatitude || src.lat || geoObj.latitude || geoObj.lat || locationObj.latitude || locationObj.lat || '').trim();
    const longitude = String(src.longitude || src.geoLongitude || src.lng || src.lon || geoObj.longitude || geoObj.lng || geoObj.lon || locationObj.longitude || locationObj.lng || locationObj.lon || '').trim();
    const defaultNavigationUrl = latitude && longitude
        ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${latitude},${longitude}`)}`
        : '';
    const navigationUrl = latitude && longitude
        ? String(src.navigationUrl || src.mapUrl || geoObj.navigationUrl || geoObj.mapUrl || defaultNavigationUrl)
        : '';
    const logoStoragePath = src.logoStoragePath || src.logoPath || src.storagePath || '';
    const logoRaw = src.logoUrl || src.logoURL || src.logoDownloadURL || src.logo || logoStoragePath || src.logoBase64 || src.logoData || '';
    const logo = logoRaw && /^[A-Za-z0-9+/=]+$/.test(String(logoRaw)) && String(logoRaw).length > 80
        ? `data:image/png;base64,${logoRaw}`
        : String(logoRaw || '');
    return {
        id,
        companyId: id,
        tenantId: id,
        nome: name || 'Empresa não informada',
        name: name || 'Empresa não informada',
        cnpj: src.cnpj || src.taxId || '-',
        endereco: address || '-',
        address: address || '-',
        cidade: city || '-',
        city: city || '-',
        estado: state || '-',
        state: state || '-',
        telefone: phone || '-',
        phone: phone || '-',
        email: src.email || '-',
        logo,
        logoUrl: logo,
        logoStoragePath: String(logoStoragePath || ''),
        logoPath: String(logoStoragePath || ''),
        logoFileName: src.logoFileName || src.logoName || '',
        logoContentType: src.logoContentType || src.logoMimeType || '',
        logoSize: src.logoSize || '',
        logoUpdatedAt: src.logoUpdatedAt || '',
        latitude,
        longitude,
        geoLatitude: latitude,
        geoLongitude: longitude,
        mapUrl: navigationUrl,
        navigationUrl,
        geolocation: latitude && longitude ? {
            latitude: Number(latitude),
            longitude: Number(longitude),
            mapUrl: navigationUrl,
            navigationUrl,
            accuracy: src.geoAccuracy || geoObj.accuracy || '',
            updatedAt: src.geoUpdatedAt || geoObj.updatedAt || '',
            source: src.geoSource || geoObj.source || ''
        } : null,
        logoSvg: !logo
    };
}

async function resolveReportCompanyId(options = {}) {
    const explicit = sanitizeTenantId(options.companyId || options.companyID || options.tenantId);
    if (explicit) {
        setTenantId(explicit);
        return explicit;
    }
    const tenant = resolveTenantId();
    if (tenant) return tenant;
    try {
        const user = authService.currentUser || await authService.getCurrentUser();
        if (user && typeof user.getIdTokenResult === 'function') {
            const token = await user.getIdTokenResult();
            const fromClaims = sanitizeTenantId(token && token.claims && (token.claims.companyId || token.claims.companyID || token.claims.tenantId));
            if (fromClaims) {
                setTenantId(fromClaims);
                return fromClaims;
            }
        }
        if (user && user.uid) {
            const res = await loadFromFirebase(`users/${user.uid}`);
            const profile = res && res.success ? res.data : null;
            const fromProfile = sanitizeTenantId(profile && (profile.companyId || profile.companyID || profile.tenantId));
            if (fromProfile) {
                setTenantId(fromProfile);
                return fromProfile;
            }
        }
    } catch (_) {}
    return '';
}

async function getCompanyProfileForReport(options = {}) {
    const companyId = await resolveReportCompanyId(options);
    let data = {};
    if (companyId) {
        try {
            const profile = await loadFromFirebase(`companies/${companyId}/profile`);
            if (profile && profile.success && profile.data && typeof profile.data === 'object') data = { ...data, ...profile.data };
        } catch (_) {}
        try {
            const root = await loadFromFirebase(`companies/${companyId}`);
            if (root && root.success && root.data && typeof root.data === 'object') data = { ...root.data, ...data };
        } catch (_) {}
    }
    try {
        const raw = localStorage.getItem('company_info');
        const localInfo = raw ? JSON.parse(raw) : {};
        const localId = sanitizeTenantId(localInfo.companyId || localInfo.companyID || localInfo.tenantId || localInfo.id);
        if ((!companyId || !localId || localId === companyId) && localInfo && typeof localInfo === 'object') data = { ...localInfo, ...data };
    } catch (_) {}
    const normalized = normalizeCompanyProfileForReport(data, companyId);
    try {
        const logoPath = normalized.logoStoragePath || normalized.logoPath || '';
        if (logoPath && (!normalized.logo || !/^https?:\/\//i.test(String(normalized.logo)))) {
            const logoUrl = await getDownloadURLFromStorage(logoPath);
            if (logoUrl) {
                normalized.logo = logoUrl;
                normalized.logoUrl = logoUrl;
                normalized.logoSvg = false;
            }
        }
    } catch (_) {}
    return { success: true, companyId: normalized.companyId || companyId || '', source: companyId ? 'src/services/firebaseService' : 'defaults', data: normalized };
}

async function createCompanyAndSetClaim(companyData, userUid) {
    try {
        if (!companyData || typeof companyData !== 'object') {
            throw new Error('Dados da empresa inválidos');
        }
        let currentUser = authService.currentUser || null;
        if (!currentUser || !currentUser.uid) {
            currentUser = await authService.getCurrentUser();
        }
        const resolvedUid = userUid || (currentUser && currentUser.uid);
        if (!resolvedUid) {
            throw new Error('Usuário não autenticado');
        }
        const companyId = String(
            companyData.id ||
            companyData.companyId ||
            Date.now()
        );
        const payload = {
            ...companyData,
            id: companyId
        };
        if (typeof firebase.functions !== 'function') {
            throw new Error('Firebase Functions indisponível');
        }
        const callable = firebase.functions().httpsCallable('setCompanyClaim');
        await callable({ targetUid: resolvedUid, companyId });
        if (currentUser && typeof currentUser.getIdTokenResult === 'function') {
            await currentUser.getIdTokenResult(true);
        }
        setTenantId(companyId);
        let companies = [];
        try {
            const raw = localStorage.getItem('companies');
            const parsed = raw ? JSON.parse(raw) : null;
            if (Array.isArray(parsed)) companies = parsed;
            else if (parsed && typeof parsed === 'object') companies = Object.values(parsed);
        } catch (_) {}
        const existingIndex = companies.findIndex(c => String(c && c.id) === companyId);
        if (existingIndex >= 0) companies[existingIndex] = payload;
        else companies.push(payload);
        const saveResult = await saveToFirebase(`companies/${companyId}/profile`, null, payload);
        if (!saveResult || !saveResult.success) {
            throw new Error(saveResult && saveResult.error ? saveResult.error : 'Falha ao salvar empresa');
        }
        try {
            localStorage.setItem('companies', JSON.stringify(companies));
            localStorage.setItem('company_info', JSON.stringify(payload));
        } catch (_) {}
        try {
            if (typeof window !== 'undefined') {
                window.companyInfo = payload;
                window.appTenantId = companyId;
            }
        } catch (_) {}
        return { success: true, companyId };
    } catch (error) {
        return { success: false, error: error && error.message ? error.message : String(error) };
    }
}

window.firebaseService = {
    app,
    authService,
    dbService: firestoreService,
    rtdbService,
    isOperational,
    isFirebaseOperational,
    loadFromFirebase,
    saveToFirebase,
    saveUserData,
    loadData,
    saveData,
    removeFromFirebase,
    getAll,
    uploadFile,
    getDownloadURL: getDownloadURLFromStorage,
    getStorageDownloadURL: getDownloadURLFromStorage,
    extractStoragePathFromUrl,
    uploadCompanyLogo,
    storage: {
        upload: async (path, file, options = {}) => {
            const result = await uploadFile(path, file, options);
            if (!result || result.success === false) throw new Error((result && result.error) || 'Falha no upload');
            return result.downloadURL || result.url;
        },
        getDownloadURL: getDownloadURLFromStorage,
        delete: deleteStorageFile
    },
    setTenantId,
    getTenantId,
    getCurrentTenantId: getTenantId,
    callFunction,
    resolveReportCompanyId,
    normalizeCompanyProfileForReport,
    getCompanyProfileForReport,
    createCompanyAndSetClaim,
    createCompanyOnboarding,
    updateMyCompanyProfile,
    updateMyUserProfile
};
