/**
 * Configuração do Firebase para o SisWeb
 * Este arquivo contém as configurações de conexão com o Firebase
 */

// Importar as bibliotecas do Firebase necessárias
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Configuração do Firebase para o SisWeb
const firebaseConfig = {
  apiKey: "AIzaSyCJoql30uCoRhc3UHCnyl57M1vFCT2-N1o",
  authDomain: "dbsisweb.firebaseapp.com",
  databaseURL: "https://dbsisweb-default-rtdb.firebaseio.com",
  projectId: "dbsisweb",
  storageBucket: "dbsisweb.appspot.com",
  messagingSenderId: "711476232625",
  appId: "1:711476232625:web:a00e3508487856b3613d90",
  measurementId: "G-M0M8LFVGDC"
};

// Inicializar Firebase
console.log('[Firebase Config] Inicializando Firebase...', firebaseConfig);
let app;
try {
  app = initializeApp(firebaseConfig);
  console.log('[Firebase Config] Firebase inicializado com sucesso. App name:', app.name);
} catch (error) {
  console.error('[Firebase Config] ERRO ao inicializar Firebase:', error);
  throw error; // Propagar erro para ser capturado por quem está usando este módulo
}

// Inicializar serviços
console.log('[Firebase Config] Inicializando serviços Firebase...');

// Auth
let auth;
try {
  console.log('[Firebase Config] Inicializando Firebase Authentication...');
  auth = getAuth(app);
  console.log('[Firebase Config] Auth inicializado com sucesso. Auth name:', auth.name);
} catch (error) {
  console.error('[Firebase Config] ERRO ao inicializar Auth:', error);
}

// Firestore
let db;
try {
  console.log('[Firebase Config] Inicializando Firestore...');
  db = getFirestore(app);
  console.log('[Firebase Config] Firestore inicializado com sucesso');
} catch (error) {
  console.error('[Firebase Config] ERRO ao inicializar Firestore:', error);
}

// Realtime Database
let rtdb;
try {
  console.log('[Firebase Config] Inicializando Realtime Database...');
  rtdb = getDatabase(app);
  console.log('[Firebase Config] Realtime Database inicializado com sucesso. URL:', rtdb.app.options.databaseURL);
} catch (error) {
  console.error('[Firebase Config] ERRO ao inicializar Realtime Database:', error);
}

// Storage
let storage;
try {
  console.log('[Firebase Config] Inicializando Firebase Storage...');
  storage = getStorage(app);
  console.log('[Firebase Config] Storage inicializado com sucesso. Bucket:', storage.app.options.storageBucket);
} catch (error) {
  console.error('[Firebase Config] ERRO ao inicializar Storage:', error);
}

// Analytics (opcional)
let analytics = null;
try {
  console.log('[Firebase Config] Tentando inicializar Firebase Analytics...');
  analytics = getAnalytics(app);
  console.log('[Firebase Config] Analytics inicializado com sucesso');
} catch (error) {
  console.warn('[Firebase Config] Não foi possível inicializar Analytics:', error.message);
}

// Verificar se estamos em ambiente de desenvolvimento (localhost)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  console.log('[Firebase Config] Ambiente de desenvolvimento detectado. Emuladores não configurados.');
  // Aqui você poderia conectar aos emuladores se necessário
}

// Verificar estado de autenticação atual
if (auth) {
  auth.onAuthStateChanged((user) => {
    if (user) {
      console.log('[Firebase Config] Usuário autenticado:', user.email);
    } else {
      console.log('[Firebase Config] Nenhum usuário autenticado');
    }
  });
}

// Exportar os serviços para uso em outros arquivos
export { app, auth, db, rtdb, storage, analytics }; 