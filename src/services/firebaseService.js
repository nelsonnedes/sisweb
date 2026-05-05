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

function resolveTenantId() {
    try {
        if (tenantId) return tenantId;
        if (typeof window !== 'undefined' && window.appTenantId) {
            return String(window.appTenantId);
        }
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('company_info') : null;
        if (raw) {
            const obj = JSON.parse(raw);
            const t = String(obj.id || obj.companyId || obj.slug || obj.nome || obj.name || '');
            if (t) return t.replace(/\s+/g, '_').toLowerCase();
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
        return { success: true, downloadURL };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function setTenantId(id) {
    tenantId = id;
}

function getTenantId() {
    return resolveTenantId();
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
        const saveResult = await saveToFirebase('companies', null, companies);
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
    setTenantId,
    getTenantId,
    createCompanyAndSetClaim
};
