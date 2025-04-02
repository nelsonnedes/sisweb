/**
 * Script para testar a conexão com o Firebase
 */

import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
    doc, 
    setDoc, 
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Função para testar registro direto
async function testUserRegistration(email, password) {
    console.log("========== TESTE DE REGISTRO ==========");
    console.log("Tentando registrar:", email);
    
    try {
        // Criar usuário no Firebase Authentication
        console.log("Chamando createUserWithEmailAndPassword...");
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Usuário criado:", userCredential.user.uid);
        
        // Criar documento do usuário no Firestore
        const userDoc = {
            email: email,
            name: "Usuário Teste",
            username: email.split('@')[0],
            role: "user",
            created: serverTimestamp(),
            lastLogin: null
        };
        
        console.log("Criando documento no Firestore...");
        await setDoc(doc(db, "users", userCredential.user.uid), userDoc);
        console.log("Documento criado com sucesso!");
        
        return {
            success: true,
            message: "Usuário de teste criado com sucesso!"
        };
    } catch (error) {
        console.error("Erro no teste de registro:", error.code, error.message);
        return {
            success: false,
            message: error.message,
            code: error.code
        };
    }
}

// Função para testar login direto
async function testUserLogin(email, password) {
    console.log("========== TESTE DE LOGIN ==========");
    console.log("Tentando fazer login com:", email);
    
    try {
        console.log("Chamando signInWithEmailAndPassword...");
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Login bem-sucedido:", userCredential.user.uid);
        
        return {
            success: true,
            message: "Login de teste realizado com sucesso!"
        };
    } catch (error) {
        console.error("Erro no teste de login:", error.code, error.message);
        return {
            success: false,
            message: error.message,
            code: error.code
        };
    }
}

// Exportar funções de teste
export { testUserRegistration, testUserLogin }; 