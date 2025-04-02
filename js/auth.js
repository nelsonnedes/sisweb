/**
 * Sistema de autenticação e gerenciamento de usuários
 * Funções para login, logout, registro e verificação de permissões
 * Utilizando Firebase Authentication e Firestore
 */

import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut,
    updateProfile,
    sendPasswordResetEmail,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
    doc, 
    collection, 
    setDoc, 
    getDoc, 
    getDocs, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Realiza o login do usuário
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @returns {Promise<Object>} Promessa com dados do usuário
 */
async function login(email, password) {
    try {
        // Autenticar usuário no Firebase
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Buscar dados adicionais do usuário no Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Se é o primeiro acesso, inicia o período de teste
            if (!userData.trialStart && !userData.subscription) {
                const trialStart = serverTimestamp();
                await updateDoc(userDocRef, { 
                    trialStart,
                    lastLogin: serverTimestamp()
                });
                userData.trialStart = trialStart;
            } else {
                // Atualiza a data do último login
                await updateDoc(userDocRef, { 
                    lastLogin: serverTimestamp() 
                });
            }
            
            // Salvar sessão do usuário
            sessionStorage.setItem('userData', JSON.stringify({
                uid: user.uid,
                displayName: user.displayName,
                email: user.email,
                role: userData.role,
                isLoggedIn: true
            }));
            
            return true;
        } else {
            console.error("Documento do usuário não encontrado!");
            await signOut(auth);
            return false;
        }
    } catch (error) {
        console.error("Erro ao fazer login:", error);
    return false;
    }
}

/**
 * Realiza o logout do usuário atual
 * @returns {Promise<boolean>} Promessa indicando sucesso/falha
 */
async function logout() {
    try {
        await signOut(auth);
        sessionStorage.removeItem('userData');
        
        // Verificar se estamos no GitHub Pages
        const isGitHubPages = window.location.hostname.includes('github.io');
        if (isGitHubPages) {
            window.location.href = '/sisweb/login/index.html';
        } else {
            window.location.href = '../login/index.html';
        }
        
        return true;
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        return false;
    }
}

/**
 * Registra um novo usuário
 * @param {Object} userData - Dados do usuário
 * @returns {Promise<Object|boolean>} Promessa com usuário criado ou false
 */
async function register(userData) {
    try {
    // Validar dados obrigatórios
        if (!userData.email || !userData.password || !userData.username) {
        return false;
    }
    
        // Criar usuário no Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(
            auth, 
            userData.email, 
            userData.password
        );
        const user = userCredential.user;
        
        // Atualizar displayName do usuário
        await updateProfile(user, {
            displayName: userData.name || userData.username
        });
        
        // Criar documento do usuário no Firestore
        const userDoc = {
        username: userData.username,
        name: userData.name || userData.username,
        email: userData.email,
        role: userData.role || 'user',
            created: serverTimestamp(),
            lastLogin: serverTimestamp()
    };
    
        await setDoc(doc(db, "users", user.uid), userDoc);
    
    // Retornar usuário criado (sem senha)
        const { password, ...userWithoutPassword } = userData;
        return {
            uid: user.uid,
            ...userWithoutPassword
        };
    } catch (error) {
        console.error("Erro ao registrar usuário:", error);
        return false;
    }
}

/**
 * Atualiza dados de um usuário
 * @param {string} userId - ID do usuário
 * @param {Object} userData - Novos dados do usuário
 * @returns {Promise<Object|boolean>} Promessa com usuário atualizado ou false
 */
async function updateUser(userId, userData) {
    try {
        // Referência ao documento do usuário
        const userDocRef = doc(db, "users", userId);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
        return false;
    }
    
        // Dados a serem atualizados no Firestore
        const updatedData = {};
        
        // Atualizar campos permitidos
        if (userData.name) updatedData.name = userData.name;
        if (userData.username) updatedData.username = userData.username;
        if (userData.role) updatedData.role = userData.role;
        
        // Atualizar documento no Firestore
        await updateDoc(userDocRef, updatedData);
        
        // Se o usuário atual for o mesmo que está sendo atualizado, atualizar a sessão
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.uid === userId) {
    const updatedUser = {
                ...currentUser,
                ...updatedData
            };
            sessionStorage.setItem('userData', JSON.stringify(updatedUser));
        }
        
        // Retornar dados atualizados
        return {
            uid: userId,
            ...userDoc.data(),
            ...updatedData
        };
    } catch (error) {
        console.error("Erro ao atualizar usuário:", error);
        return false;
    }
}

/**
 * Remove um usuário
 * @param {string} userId - ID do usuário a ser removido
 * @returns {Promise<boolean>} Promessa indicando sucesso/falha
 */
async function removeUser(userId) {
    try {
        // Excluir documento do usuário no Firestore
        await deleteDoc(doc(db, "users", userId));
        
        // Se o usuário removido for o atual, fazer logout
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.uid === userId) {
            await logout();
        }
        
        return true;
    } catch (error) {
        console.error("Erro ao remover usuário:", error);
        return false;
    }
}

/**
 * Verifica se o usuário atual tem permissão para uma ação
 * @param {string} permission - Permissão necessária
 * @returns {boolean} true se tem permissão
 */
function hasPermission(permission) {
    const currentUser = getCurrentUser();
    
    // Se não há usuário logado, retorna false
    if (!currentUser || !currentUser.role) {
        return false;
    }
    
    // Admin tem todas as permissões
    if (currentUser.role === 'admin') {
        return true;
    }
    
    // Verificar permissões específicas por papel
    const permissions = {
        manager: ['criar_romaneio', 'editar_romaneio', 'excluir_romaneio', 'criar_cliente', 'editar_cliente', 'ver_relatorios'],
        user: ['criar_romaneio', 'editar_romaneio', 'ver_relatorios'],
        guest: []
    };
    
    return permissions[currentUser.role]?.includes(permission) || false;
}

/**
 * Obtém dados do usuário atual da sessão
 * @returns {Object|null} Dados do usuário ou null se não estiver logado
 */
function getCurrentUser() {
    try {
        const userDataStr = sessionStorage.getItem('userData');
        if (userDataStr) {
            return JSON.parse(userDataStr);
        }
        return null;
    } catch (error) {
        console.error("Erro ao obter dados do usuário:", error);
        return null;
    }
}

/**
 * Envia email para redefinição de senha
 * @param {string} email - Email do usuário
 * @returns {Promise<boolean>} Promessa indicando sucesso/falha
 */
async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        return true;
    } catch (error) {
        console.error("Erro ao enviar email de redefinição de senha:", error);
        return false;
    }
}

// Exportar funções e objetos
export {
    auth,
    login,
    logout,
    register,
    updateUser,
    removeUser,
    hasPermission,
    getCurrentUser,
    resetPassword
};
