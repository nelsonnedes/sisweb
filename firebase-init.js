/**
 * firebase-init.js — Módulo compartilhado de inicialização Firebase (v10.7.1 modular)
 *
 * Singleton: garante que Firebase seja inicializado UMA única vez em toda a aplicação.
 * Todos os módulos (firebaseService.js, páginas) importam daqui em vez de
 * inicializar o Firebase eles mesmos.
 *
 * Uso:
 *   import { app, auth, database, storage, functions } from './firebase-init.js';
 */

// ─── SDK Imports ──────────────────────────────────────────────────────────────
import { initializeApp, getApps } from "./firebase/sdk/firebase-app.js";
import { getDatabase, connectDatabaseEmulator, ref, set, get, remove, child, onValue, off, push, update, serverTimestamp, query, orderByChild, limitToLast, goOnline, goOffline } from "./firebase/sdk/firebase-database.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInAnonymously,
    signOut,
    onAuthStateChanged,
    connectAuthEmulator,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence,
    sendPasswordResetEmail,
    sendEmailVerification,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword as firebaseUpdatePassword,
    updateProfile as firebaseUpdateProfile,
    updateCurrentUser
} from "./firebase/sdk/firebase-auth.js";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "./firebase/sdk/firebase-functions.js";
import { getStorage, connectStorageEmulator, ref as storageRef, uploadBytes, getDownloadURL, getBytes, deleteObject, getBlob } from "./firebase/sdk/firebase-storage.js";

// ─── Config ───────────────────────────────────────────────────────────────────
const PRODUCTION_FIREBASE_CONFIG = {
    apiKey: "AIzaSyCe5-eh5wS49YswbHEonvKHGQicNnjKfsU",
    authDomain: "sisweb-7ce82.firebaseapp.com",
    databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sisweb-7ce82",
    storageBucket: "sisweb-7ce82.firebasestorage.app",
    messagingSenderId: "240003261222",
    appId: "1:240003261222:web:1aeaf919ddc7e5c691d7e7",
    measurementId: "G-FTC6JZ5ZGX"
};

function isProductionHost(host) {
    const h = String(host || '').toLowerCase();
    return h === 'siswebsoftware.com.br' || h.endsWith('.siswebsoftware.com.br')
        || h === 'sisweb-7ce82.web.app' || h === 'sisweb-7ce82.firebaseapp.com';
}
function readSandboxJson(key) {
    try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : '';
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) { return null; }
}
function readSandboxEnvironment() {
    if (typeof window === 'undefined') return null;
    if (isProductionHost(window.location && window.location.hostname)) return null;
    const config = (window.__SISWEB_FIREBASE_CONFIG__ && typeof window.__SISWEB_FIREBASE_CONFIG__ === 'object'
        ? window.__SISWEB_FIREBASE_CONFIG__
        : readSandboxJson('__SISWEB_FIREBASE_CONFIG__'));
    if (!config || !config.projectId || String(config.projectId) === 'sisweb-7ce82') return null;
    const emulators = (window.__SISWEB_EMULATORS__ && typeof window.__SISWEB_EMULATORS__ === 'object'
        ? window.__SISWEB_EMULATORS__
        : readSandboxJson('__SISWEB_EMULATORS__'));
    return { config, emulators: emulators || null };
}
const SANDBOX_ENV = readSandboxEnvironment();
const FIREBASE_CONFIG = SANDBOX_ENV ? SANDBOX_ENV.config : PRODUCTION_FIREBASE_CONFIG;
const EMULATORS = SANDBOX_ENV ? SANDBOX_ENV.emulators : null;
try {
    if (SANDBOX_ENV && typeof window !== 'undefined') window.SISWEB_ROMANEIO_SEQUENCE = true;
} catch (_) {}

// ─── Singleton Initialization ─────────────────────────────────────────────────
let _app = null;
let _auth = null;
let _db = null;
let _storage = null;
let _functions = null;
let _initialized = false;
let _authObserverUnsubscribe = null;

function getFirebaseApp() {
    if (_app) return _app;
    const existing = getApps();
    _app = existing.length > 0 ? existing[0] : initializeApp(FIREBASE_CONFIG);
    return _app;
}

function ensureInitialized() {
    if (_initialized) return;
    _initialized = true;

    const app = getFirebaseApp();
    _auth = getAuth(app);
    _db = getDatabase(app);
    _storage = getStorage(app);
    _functions = getFunctions(app);
    if (EMULATORS) {
        try {
            if (EMULATORS.auth) connectAuthEmulator(_auth, String(EMULATORS.auth));
            if (EMULATORS.database) {
                connectDatabaseEmulator(_db, EMULATORS.database.host || '127.0.0.1', Number(EMULATORS.database.port) || 9000);
            }
            if (EMULATORS.storage) {
                connectStorageEmulator(_storage, EMULATORS.storage.host || '127.0.0.1', Number(EMULATORS.storage.port) || 9199);
            }
            if (EMULATORS.functions) {
                connectFunctionsEmulator(_functions, EMULATORS.functions.host || '127.0.0.1', Number(EMULATORS.functions.port) || 5001);
            }
        } catch (e) {
            console.warn('firebase-init: falha ao conectar emuladores de sandbox:', e?.message || e);
        }
    }

    // ─── Window globals (backward compat) ─────────────────────────────
    try {
        if (typeof window !== 'undefined') {
            window._FIREBASE_APP = app;
            window.database = _db;
            window.firebaseRef = ref;
            window.firebaseSet = set;
            window.firebaseAuthUser = null;
        }
    } catch (_) { /* SSR safe */ }
}

// ─── Auth Observer (canonical, singleton) ─────────────────────────────────────
function startCanonicalAuthObserver() {
    if (_authObserverUnsubscribe) return;
    ensureInitialized();
    try {
        _authObserverUnsubscribe = onAuthStateChanged(_auth, (user) => {
            try {
                if (typeof window !== 'undefined') {
                    window.firebaseAuthUser = user;
                    window.firebaseAuthDisabled = !user;
                }
                if (typeof updateOfflineBadge === 'function') {
                    try { updateOfflineBadge(); } catch (_) {}
                }
            } catch (_) {}
        });
    } catch (e) {
        console.warn('⚠️ firebase-init: falha ao iniciar auth observer:', e?.message || e);
    }
}

// ─── Eager init (executa na primeira importação) ────────────────────────────
// Lazy para login.html (rota pública) — evita IndexedDB + WS antes do FCP
const _isLoginRouteForInit = typeof window !== 'undefined' && String(window.location.pathname || '').includes('login.html');
if (!_isLoginRouteForInit) {
    ensureInitialized();
    console.log('✅ firebase-init: Firebase v10.7.1 inicializado (singleton)');
} else if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => { try { ensureInitialized(); console.log('✅ firebase-init: Firebase v10.7.1 inicializado (lazy login)'); } catch (_) {} }, { timeout: 2000 });
} else {
    setTimeout(() => { try { ensureInitialized(); console.log('✅ firebase-init: Firebase v10.7.1 inicializado (lazy login)'); } catch (_) {} }, 0);
}

// ─── Exports (instâncias diretas, não getters) ──────────────────────────────
export {
    _app as app,
    _auth as auth,
    _db as db,
    _storage as storage,
    _functions as functions,
    // Re-exporta utilitários do Firebase
    ref, set, get, remove, child, onValue, off, push, update,
    serverTimestamp, query, orderByChild, limitToLast,
    goOnline, goOffline,
    signOut, onAuthStateChanged, setPersistence,
    browserSessionPersistence, browserLocalPersistence,
    signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInAnonymously,
    sendPasswordResetEmail, sendEmailVerification, EmailAuthProvider,
    reauthenticateWithCredential,
    firebaseUpdatePassword, firebaseUpdateProfile, updateCurrentUser,
    httpsCallable,
    storageRef, uploadBytes, getDownloadURL, getBytes, deleteObject, getBlob,
    FIREBASE_CONFIG,
    // Init helpers (para login lazy)
    ensureInitialized,
    // Getters do SDK (para páginas que precisam inicializar serviços adicionais)
    getAuth, getDatabase, getStorage, getFunctions,
    initializeApp, getApps
};
