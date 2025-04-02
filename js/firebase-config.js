/**
 * Configuração do Firebase para o SisWeb
 * Este arquivo contém as configurações de conexão com o Firebase
 */

// Importar as bibliotecas do Firebase necessárias
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
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
const app = initializeApp(firebaseConfig);

// Inicializar serviços
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

// Exportar os serviços para uso em outros arquivos
export { auth, db, storage, analytics }; 