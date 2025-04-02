/**
 * Arquivo principal de inicialização do SisWeb
 * Gerencia inicialização do Firebase e verificação de autenticação
 */

import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './firebase-config.js';

/**
 * Inicializa a aplicação
 */
function initApp() {
    console.log('Inicializando o SisWeb...');
    
    // Verificar se estamos na página de login ou registro
    const isLoginPage = window.location.pathname.includes('/login/');
    
    // Observar estado de autenticação
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('Usuário autenticado:', user.email);
            
            // Buscar dados adicionais do usuário
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    
                    // Armazenar dados do usuário na sessão
                    sessionStorage.setItem('userData', JSON.stringify({
                        uid: user.uid,
                        displayName: user.displayName || userData.name,
                        email: user.email,
                        role: userData.role,
                        isLoggedIn: true
                    }));
                    
                    // Verificar se o usuário tem assinatura/período de teste
                    const hasAccess = await checkUserAccess(user.uid);
                    
                    if (!hasAccess && !isLoginPage && !window.location.pathname.includes('/subscription.html')) {
                        // Redirecionar para página de assinatura
                        window.location.href = '../pages/subscription.html';
                    } else if (isLoginPage) {
                        // Redirecionar para dashboard se estiver na página de login
                        window.location.href = '../pages/dashboard.html';
                    } else {
                        // Atualizar a interface com o usuário logado
                        updateUserInterface();
                    }
                } else {
                    console.warn('Documento do usuário não encontrado');
                    if (!isLoginPage) {
                        signOut(auth);
                        redirectToLogin();
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar dados do usuário:', error);
                if (!isLoginPage) {
                    redirectToLogin();
                }
            }
        } else {
            console.log('Nenhum usuário autenticado');
            
            // Limpar dados de sessão
            sessionStorage.removeItem('userData');
    
            // Redirecionar para login se não estiver na página de login
            if (!isLoginPage) {
                redirectToLogin();
            }
        }
    });
    
    // Inicializar componentes da interface
    initializeUI();
}

/**
 * Verifica se o usuário tem acesso válido (assinatura ou período de teste)
 * @param {string} userId - ID do usuário
 * @returns {Promise<boolean>} true se o usuário tem acesso válido
 */
async function checkUserAccess(userId) {
    try {
        const userDoc = await getDoc(doc(db, "users", userId));
        
        if (!userDoc.exists()) return false;
        
        const userData = userDoc.data();
        
        // Verificar se tem assinatura ativa
        if (userData.subscription && userData.subscription.active) {
            const subscriptionEnd = new Date(userData.subscription.endDate.toDate());
            if (subscriptionEnd > new Date()) {
                return true;
            }
        }
        
        // Verificar período de teste (30 dias)
        if (userData.trialStart) {
            const trialStart = new Date(userData.trialStart.toDate());
            const trialEnd = new Date(trialStart);
            trialEnd.setDate(trialEnd.getDate() + 30);
            
            if (trialEnd > new Date()) {
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.error('Erro ao verificar acesso do usuário:', error);
        return false;
    }
}

/**
 * Inicializa os componentes da interface
 */
function initializeUI() {
    // Inicializar componentes do menu
    initializeMenu();
    
    // Adicionar listeners para botões comuns
    document.querySelectorAll('.btn-logout').forEach(button => {
        button.addEventListener('click', async () => {
            try {
                await auth.signOut();
                window.location.href = '../login/index.html';
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
            }
        });
    });
    
    // Inicializar tooltips e popovers (se estiver usando Bootstrap)
    if (typeof bootstrap !== 'undefined') {
        const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));
        
        const popovers = document.querySelectorAll('[data-bs-toggle="popover"]');
        popovers.forEach(popover => new bootstrap.Popover(popover));
    }
}

/**
 * Inicializa o menu lateral
 */
function initializeMenu() {
    // Verificar se o menu existe na página
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            document.body.classList.toggle('menu-collapsed');
        });
    }
}

/**
 * Atualiza a interface com os dados do usuário logado
 */
function updateUserInterface() {
    const userData = JSON.parse(sessionStorage.getItem('userData') || '{}');
    
    // Atualizar elementos da interface com dados do usuário
    const usernameElements = document.querySelectorAll('.user-name');
    usernameElements.forEach(element => {
        element.textContent = userData.displayName || userData.email || 'Usuário';
    });
    
    // Atualizar email do usuário
    const emailElements = document.querySelectorAll('.user-email');
    emailElements.forEach(element => {
        element.textContent = userData.email || '';
    });
    
    // Controlar visibilidade de elementos com base em permissões
    document.querySelectorAll('[data-permission]').forEach(element => {
        const requiredPermission = element.getAttribute('data-permission');
        
        if (userData.role === 'admin' || hasPermissionForRole(userData.role, requiredPermission)) {
            element.style.display = '';
        } else {
            element.style.display = 'none';
        }
    });
}

/**
 * Verifica se um papel de usuário tem determinada permissão
 * @param {string} role - Papel do usuário
 * @param {string} permission - Permissão a verificar
 * @returns {boolean} true se o papel tem a permissão
 */
function hasPermissionForRole(role, permission) {
    // Mapeamento de permissões por papel
    const permissions = {
        admin: ['*'], // Admin tem todas as permissões
        manager: ['criar_romaneio', 'editar_romaneio', 'excluir_romaneio', 'criar_cliente', 'editar_cliente', 'ver_relatorios'],
        user: ['criar_romaneio', 'editar_romaneio', 'ver_relatorios'],
        guest: []
    };
    
    // Admin tem acesso a tudo
    if (role === 'admin') return true;
    
    // Verificar se o papel tem a permissão específica
    return permissions[role]?.includes(permission) || false;
}

/**
 * Redireciona para a página de login, considerando se estamos no GitHub Pages
 */
function redirectToLogin() {
    // Verificar se estamos no GitHub Pages
    const isGitHubPages = window.location.hostname.includes('github.io');
    const loginPath = isGitHubPages ? '/sisweb/login/index.html' : '../login/index.html';
    
    window.location.href = loginPath;
}

// Inicializar a aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', initApp);

// Exportar funções para uso em outros arquivos
export { 
    hasPermissionForRole,
    updateUserInterface
};
