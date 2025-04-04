/**
 * Arquivo principal de inicialização do SisWeb
 * Gerencia inicialização do Firebase, verificação de autenticação e carregamento de componentes
 */

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeDatabase } from './db-init.js';

// Estado global da aplicação
const AppState = {
    initialized: false,
    isOnline: navigator.onLine,
    basePath: '',
    currentUser: null
};

/**
 * Inicializa a aplicação
 */
async function initApp() {
    console.log('Inicializando o SisWeb...');
    
    // Determinar caminho base (para GitHub Pages)
    AppState.basePath = window.location.hostname.includes('github.io') ? '/sisweb/' : '/';
    
    // Configurar listeners para status de conexão
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    try {
        // Inicializar banco de dados
        const result = await initializeDatabase();
        if (result.success) {
            console.log("Banco de dados inicializado com sucesso!");
        } else {
            console.warn("Aviso na inicialização do banco:", result.message);
        }
        
        // Verificar autenticação
        setupAuthObserver();
        
        // Inicializar componentes da interface
        initializeUI();
        
        AppState.initialized = true;
    } catch (error) {
        console.error("Erro ao inicializar aplicação:", error);
        
        // Exibir mensagem de erro para o usuário
        const errorContainer = document.getElementById('error-container');
        if (errorContainer) {
            errorContainer.style.display = 'block';
            errorContainer.innerHTML = `
                <div class="error-message">
                    <h3>Erro ao inicializar o sistema</h3>
                    <p>Ocorreu um erro ao carregar o SisWeb. Por favor, tente novamente ou entre em contato com o suporte.</p>
                    <button onclick="window.location.reload()">Tentar novamente</button>
                </div>
            `;
        }
    }
}

/**
 * Configura o observador de estado de autenticação
 */
function setupAuthObserver() {
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
                    const userInfo = {
                        uid: user.uid,
                        displayName: user.displayName || userData.name || userData.username,
                        email: user.email,
                        role: userData.role,
                        isLoggedIn: true,
                        emailVerified: user.emailVerified,
                        lastLogin: new Date().toISOString()
                    };
                    
                    sessionStorage.setItem('userData', JSON.stringify(userInfo));
                    AppState.currentUser = userInfo;
                    
                    // Verificar se o usuário tem assinatura/período de teste
                    const hasAccess = await checkUserAccess(user.uid);
                    
                    // Redirecionar conforme status de acesso
                    if (!hasAccess && !isLoginPage && !window.location.pathname.includes('/subscription.html')) {
                        // Redirecionar para página de assinatura
                        redirectTo('/pages/subscription.html');
                    } else if (isLoginPage) {
                        // Redirecionar para dashboard se estiver na página de login
                        redirectTo('/pages/dashboard.html');
                    } else {
                        // Atualizar a interface com o usuário logado
                        updateUserInterface();
                    }
                } else {
                    console.warn('Documento do usuário não encontrado');
                    if (!isLoginPage) {
                        auth.signOut();
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
            AppState.currentUser = null;
    
            // Redirecionar para login se não estiver na página de login
            if (!isLoginPage) {
                redirectToLogin();
            }
        }
    });
}

/**
 * Trata mudanças no status de conexão
 */
function handleOnlineStatus() {
    AppState.isOnline = navigator.onLine;
    
    // Atualizar indicador de status na interface
    const statusIndicator = document.getElementById('connection-status');
    if (statusIndicator) {
        if (AppState.isOnline) {
            statusIndicator.className = 'status-online';
            statusIndicator.title = 'Conectado';
        } else {
            statusIndicator.className = 'status-offline';
            statusIndicator.title = 'Modo offline - Algumas funcionalidades podem estar indisponíveis';
        }
    }
    
    // Exibir notificação para o usuário
    showStatusNotification(AppState.isOnline);
}

/**
 * Exibe notificação sobre o status de conexão
 * @param {boolean} isOnline - Se está online
 */
function showStatusNotification(isOnline) {
    // Criar elemento de notificação se não existir
    let notification = document.getElementById('connection-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'connection-notification';
        document.body.appendChild(notification);
    }
    
    // Configurar mensagem
    notification.innerHTML = isOnline 
        ? '<i class="fas fa-wifi"></i> Conexão restabelecida'
        : '<i class="fas fa-exclamation-triangle"></i> Modo offline ativado';
    
    notification.className = isOnline ? 'online-notification' : 'offline-notification';
    
    // Exibir e ocultar após alguns segundos
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
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
                redirectToLogin();
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
            }
        });
    });
    
    // Adicionar o indicador de status de conexão
    const header = document.querySelector('header');
    if (header) {
        const statusIndicator = document.createElement('div');
        statusIndicator.id = 'connection-status';
        statusIndicator.className = AppState.isOnline ? 'status-online' : 'status-offline';
        statusIndicator.title = AppState.isOnline ? 'Conectado' : 'Modo offline';
        header.appendChild(statusIndicator);
    }
    
    // Adicionar estilos CSS para indicadores de status
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        #connection-status {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            display: inline-block;
            margin-left: 10px;
        }
        .status-online { background-color: #4caf50; }
        .status-offline { background-color: #f44336; }
        
        #connection-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            z-index: 9999;
            display: none;
        }
        .online-notification { background-color: #4caf50; }
        .offline-notification { background-color: #f44336; }
    `;
    document.head.appendChild(styleElement);
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
    const userData = AppState.currentUser || JSON.parse(sessionStorage.getItem('userData') || '{}');
    
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
    
    // Exibir aviso de verificação de e-mail se necessário
    if (userData.isLoggedIn && !userData.emailVerified) {
        showEmailVerificationNotice();
    }
}

/**
 * Exibe aviso de verificação de e-mail
 */
function showEmailVerificationNotice() {
    // Verificar se já existe um aviso
    if (document.getElementById('email-verification-notice')) return;
    
    // Criar elemento de aviso
    const noticeElement = document.createElement('div');
    noticeElement.id = 'email-verification-notice';
    noticeElement.className = 'verification-notice';
    noticeElement.innerHTML = `
        <div class="notice-content">
            <i class="fas fa-exclamation-circle"></i>
            <span>Seu e-mail ainda não foi verificado. Por favor, verifique sua caixa de entrada.</span>
            <button id="dismiss-notice"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    // Adicionar estilos
    const style = document.createElement('style');
    style.textContent = `
        .verification-notice {
            background-color: #fff3cd;
            color: #856404;
            padding: 10px;
            border-radius: 5px;
            margin: 10px;
            position: fixed;
            bottom: 0;
            right: 0;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .notice-content {
            display: flex;
            align-items: center;
        }
        .notice-content i {
            margin-right: 10px;
        }
        #dismiss-notice {
            background: none;
            border: none;
            color: #856404;
            cursor: pointer;
            margin-left: 10px;
        }
    `;
    document.head.appendChild(style);
    
    // Adicionar à página
    document.body.appendChild(noticeElement);
    
    // Adicionar listener para o botão de fechar
    document.getElementById('dismiss-notice').addEventListener('click', () => {
        noticeElement.style.display = 'none';
    });
}

/**
 * Verifica se um papel de usuário tem determinada permissão
 * @param {string} role - Papel do usuário
 * @param {string} permission - Permissão a verificar
 * @returns {boolean} true se o papel tem a permissão
 */
function hasPermissionForRole(role, permission) {
    // Definir permissões para cada papel
    const permissions = {
        admin: ['*'], // Admin tem todas as permissões
        manager: ['read', 'write', 'edit', 'delete', 'approve', 'export'],
        user: ['read', 'write', 'edit'],
        viewer: ['read', 'export']
    };
    
    // Verificar se o papel existe
    if (!permissions[role]) return false;
    
    // Admin tem todas as permissões
    if (role === 'admin') return true;
    
    // Verificar permissão específica
    return permissions[role].includes(permission);
}

/**
 * Redireciona para a página de login
 */
function redirectToLogin() {
    redirectTo('/login/index.html');
}

/**
 * Redireciona para uma URL
 * @param {string} path - Caminho relativo
 */
function redirectTo(path) {
    const fullPath = AppState.basePath + path.replace(/^\//, '');
    window.location.href = fullPath;
}

// Inicializar a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', initApp);

// Exportar funções e objetos úteis
export {
    AppState,
    redirectTo,
    redirectToLogin,
    updateUserInterface,
    hasPermissionForRole,
    initApp
};
