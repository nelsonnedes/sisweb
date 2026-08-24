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
import { getDatabase, ref, set, get, remove, child, onValue, off, push, update, serverTimestamp, query, orderByChild, limitToLast, goOnline, goOffline } from "./firebase/sdk/firebase-database.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInAnonymously,
    signOut,
    onAuthStateChanged,
    setPersistence,
    browserSessionPersistence,
    browserLocalPersistence,
    sendPasswordResetEmail,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword as firebaseUpdatePassword,
    updateProfile as firebaseUpdateProfile,
    updateCurrentUser
} from "./firebase/sdk/firebase-auth.js";
import { getFunctions, httpsCallable } from "./firebase/sdk/firebase-functions.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, getBytes, deleteObject, getBlob } from "./firebase/sdk/firebase-storage.js";

// ─── Config ───────────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCF_9e067URYnB6iGnTAahPfaTMl-RQ77k",
    authDomain: "sisweb-7ce82.firebaseapp.com",
    databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sisweb-7ce82",
    storageBucket: "sisweb-7ce82.firebasestorage.app",
    messagingSenderId: "240003261222",
    appId: "1:240003261222:web:1aeaf919ddc7e5c691d7e7",
    measurementId: "G-FTC6JZ5ZGX"
};

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
ensureInitialized();
console.log('✅ firebase-init: Firebase v10.7.1 inicializado (singleton)');

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
    sendPasswordResetEmail, EmailAuthProvider,
    reauthenticateWithCredential,
    firebaseUpdatePassword, firebaseUpdateProfile, updateCurrentUser,
    httpsCallable,
    storageRef, uploadBytes, getDownloadURL, getBytes, deleteObject, getBlob,
    FIREBASE_CONFIG,
    // Getters do SDK (para páginas que precisam inicializar serviços adicionais)
    getAuth, getDatabase, getStorage, getFunctions,
    initializeApp, getApps
};
