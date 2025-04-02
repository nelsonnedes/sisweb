/**
 * Configuração do Firebase para o SisWeb
 * Este arquivo contém as configurações de conexão com o Firebase
 */

// Importar as bibliotecas do Firebase necessárias
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, connectFirestoreEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, connectStorageEmulator } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// Configuração do Firebase para o SisWeb
const firebaseConfig = {
  apiKey: "AIzaSyCJoql30uCoRhc3UHCnyl57M1vFCT2-N1o",
  authDomain: "dbsisweb.firebaseapp.com",
  projectId: "dbsisweb",
  storageBucket: "dbsisweb.appspot.com",
  messagingSenderId: "711476232625",
  appId: "1:711476232625:web:a00e3508487856b3613d90",
  measurementId: "G-M0M8LFVGDC"
};

// Inicializar Firebase
console.log('Inicializando Firebase com a configuração:', JSON.stringify(firebaseConfig));
const app = initializeApp(firebaseConfig);

// Inicializar serviços
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
let analytics = null;

// Tentar inicializar analytics (pode falhar em ambiente de desenvolvimento)
try {
  analytics = getAnalytics(app);
  console.log('Firebase Analytics inicializado com sucesso');
} catch (error) {
  console.warn('Não foi possível inicializar Firebase Analytics:', error.message);
}

// Verificar se a autenticação foi inicializada corretamente
if (auth) {
  console.log('Firebase Authentication inicializado com sucesso');
} else {
  console.error('ERRO: Firebase Authentication não foi inicializado');
}

// Verificar se o Firestore foi inicializado corretamente
if (db) {
  console.log('Firestore inicializado com sucesso');
} else {
  console.error('ERRO: Firestore não foi inicializado');
}

// Exportar os serviços para uso em outros arquivos
export { app, auth, db, storage, analytics }; 