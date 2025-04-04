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
    sendEmailVerification,
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
 * Tradução de códigos de erro do Firebase para mensagens amigáveis em português
 * @param {string} errorCode - Código de erro do Firebase
 * @returns {string} Mensagem de erro traduzida
 */
function translateFirebaseError(errorCode) {
    const errorMessages = {
        'auth/user-not-found': 'Usuário não encontrado. Verifique seu e-mail.',
        'auth/wrong-password': 'Senha incorreta. Tente novamente.',
        'auth/invalid-email': 'E-mail inválido. Por favor, verifique o formato.',
        'auth/user-disabled': 'Este usuário foi desativado.',
        'auth/email-already-in-use': 'Este e-mail já está em uso por outra conta.',
        'auth/weak-password': 'Senha muito fraca. Use pelo menos 6 caracteres.',
        'auth/operation-not-allowed': 'Operação não permitida.',
        'auth/too-many-requests': 'Muitas tentativas de login. Tente novamente mais tarde.',
        'auth/invalid-credential': 'Credenciais inválidas. Verifique seu e-mail e senha.',
        'auth/network-request-failed': 'Falha na conexão. Verifique sua internet.'
    };
    
    return errorMessages[errorCode] || 'Ocorreu um erro na autenticação. Tente novamente.';
}

/**
 * Realiza o login do usuário
 * @param {string} email - Email do usuário
 * @param {string} password - Senha do usuário
 * @returns {Promise<Object>} Promessa com resultado do login e mensagem
 */
async function login(email, password) {
    try {
        console.log(`Iniciando processo de login para: ${email}`);
        
        // Validar entrada
        if (!email || !password) {
            console.log('Login falhou: Email ou senha em branco');
            return { 
                success: false, 
                message: 'E-mail e senha são obrigatórios.' 
            };
        }
        
        // Autenticar usuário no Firebase
        console.log('Tentando autenticar com Firebase');
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('Autenticação Firebase bem-sucedida');
        const user = userCredential.user;
        
        // Buscar dados adicionais do usuário no Firestore
        console.log('Buscando dados do usuário no Firestore');
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            console.log('Documento do usuário encontrado no Firestore');
            const userData = userDoc.data();
            
            // Se é o primeiro acesso, inicia o período de teste
            if (!userData.trialStart && !userData.subscription) {
                console.log('Primeiro acesso: iniciando período de teste');
                const trialStart = serverTimestamp();
                try {
                    await updateDoc(userDocRef, { 
                        trialStart,
                        lastLogin: serverTimestamp()
                    });
                    userData.trialStart = trialStart;
                } catch (error) {
                    console.warn('Erro ao atualizar período de teste, mas continuando login:', error);
                }
            } else {
                // Atualiza a data do último login
                console.log('Atualizando data de último login');
                try {
                    await updateDoc(userDocRef, { 
                        lastLogin: serverTimestamp() 
                    });
                } catch (error) {
                    console.warn('Erro ao atualizar último login, mas continuando:', error);
                }
            }
            
            // Salvar sessão do usuário
            console.log('Salvando sessão do usuário');
            const userInfo = {
                uid: user.uid,
                displayName: user.displayName || userData.name || userData.username,
                email: user.email,
                role: userData.role,
                isLoggedIn: true,
                emailVerified: user.emailVerified
            };
            
            sessionStorage.setItem('userData', JSON.stringify(userInfo));
            console.log('Sessão do usuário salva com sucesso');
            
            // Verificar se o email foi verificado
            if (!user.emailVerified) {
                console.warn('E-mail não verificado, mas permitindo acesso.');
                // Em produção, você pode querer impedir o login até a verificação
                // return { success: false, message: 'Por favor, verifique seu e-mail antes de fazer login.' };
            }
            
            console.log('Login realizado com sucesso');
            return { 
                success: true, 
                message: 'Login realizado com sucesso!',
                user: userInfo
            };
        } else {
            console.error("Documento do usuário não encontrado!");
            // Criar documento do usuário caso não exista
            try {
                console.log('Tentando criar documento de usuário');
                const newUserData = {
                    email: user.email,
                    name: user.displayName || 'Usuário',
                    username: user.email.split('@')[0],
                    role: 'user',
                    created: serverTimestamp(),
                    lastLogin: serverTimestamp(),
                    trialStart: serverTimestamp()
                };
                
                await setDoc(userDocRef, newUserData);
                console.log('Documento de usuário criado com sucesso');
                
                // Salvar sessão
                const userInfo = {
                    uid: user.uid,
                    displayName: newUserData.name,
                    email: user.email,
                    role: 'user',
                    isLoggedIn: true,
                    emailVerified: user.emailVerified
                };
                
                sessionStorage.setItem('userData', JSON.stringify(userInfo));
                
                return { 
                    success: true, 
                    message: 'Conta criada e login realizado com sucesso!',
                    user: userInfo
                };
                
            } catch (createError) {
                console.error('Erro ao criar documento do usuário:', createError);
                await signOut(auth);
                return { 
                    success: false, 
                    message: 'Dados do usuário não encontrados e não foi possível criar. Entre em contato com o suporte.' 
                };
            }
        }
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        return { 
            success: false, 
            message: translateFirebaseError(error.code) 
        };
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
 * @returns {Promise<Object>} Promessa com resultado do registro e mensagem
 */
async function register(userData) {
    try {
        console.log("Iniciando registro com dados:", JSON.stringify(userData, null, 2));
        
        // Validar dados obrigatórios
        if (!userData.email || !userData.password || !userData.username) {
            console.error("Dados obrigatórios ausentes:", {
                email: !!userData.email,
                password: !!userData.password,
                username: !!userData.username
            });
            return { 
                success: false, 
                message: 'E-mail, senha e nome de usuário são obrigatórios.' 
            };
        }
        
        // Validar formato de e-mail
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(userData.email)) {
            console.error("Formato de e-mail inválido:", userData.email);
            return {
                success: false,
                message: 'Formato de e-mail inválido.'
            };
        }
        
        // Validar senha (mínimo 6 caracteres)
        if (userData.password.length < 6) {
            console.error("Senha muito curta, comprimento:", userData.password.length);
            return {
                success: false,
                message: 'A senha deve ter pelo menos 6 caracteres.'
            };
        }
        
        console.log("Validações passaram, criando usuário no Firebase Authentication");
        
        // Criar usuário no Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(
            auth, 
            userData.email, 
            userData.password
        );
        const user = userCredential.user;
        
        console.log("Usuário criado no Firebase Auth com ID:", user.uid);
        
        // Atualizar displayName do usuário
        console.log("Atualizando displayName do usuário");
        await updateProfile(user, {
            displayName: userData.name || userData.username
        });
        
        // Enviar e-mail de verificação
        console.log("Enviando e-mail de verificação");
        await sendEmailVerification(user);
        
        // Criar documento do usuário no Firestore
        console.log("Criando documento do usuário no Firestore");
        const userDoc = {
            username: userData.username,
            name: userData.name || userData.username,
            email: userData.email,
            role: userData.role || 'user',
            created: serverTimestamp(),
            lastLogin: serverTimestamp(),
            emailVerified: false
        };
        
        console.log("Salvando documento do usuário:", JSON.stringify(userDoc, null, 2));
        await setDoc(doc(db, "users", user.uid), userDoc);
        
        console.log("Registro concluído com sucesso");
        // Retornar sucesso
        return {
            success: true,
            message: 'Cadastro realizado com sucesso! Verifique seu e-mail para ativar sua conta.',
            user: {
                uid: user.uid,
                displayName: userData.name || userData.username,
                email: userData.email,
                role: userData.role || 'user'
            }
        };
    } catch (error) {
        console.error("Erro detalhado ao registrar usuário:", error.code, error.message);
        return {
            success: false,
            message: translateFirebaseError(error.code) || error.message
        };
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
 * Envia um e-mail de redefinição de senha
 * @param {string} email - E-mail do usuário
 * @returns {Promise<Object>} Promessa com resultado da operação e mensagem
 */
async function resetPassword(email) {
    try {
        // Validar entrada
        if (!email) {
            return { 
                success: false, 
                message: 'E-mail é obrigatório.' 
            };
        }
        
        // Enviar e-mail de redefinição
        await sendPasswordResetEmail(auth, email);
        
        return {
            success: true,
            message: 'E-mail de redefinição de senha enviado com sucesso. Verifique sua caixa de entrada.'
        };
    } catch (error) {
        console.error("Erro ao enviar e-mail de redefinição:", error);
        return {
            success: false,
            message: translateFirebaseError(error.code)
        };
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
