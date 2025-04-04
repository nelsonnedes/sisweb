/**
 * Component de menu para o SisWeb
 * Implementado como Web Component para reuso em todas as páginas
 */

// Importar arquivo auth.js
const authModule = {};

// Função para carregar dinamicamente o módulo auth.js
async function loadAuthModule() {
    try {
        const module = await import('../js/auth.js');
        Object.assign(authModule, module);
    } catch (error) {
        console.error('Erro ao carregar módulo de autenticação:', error);
    }
}

// Carregar o módulo quando o script é executado
loadAuthModule();

class SiswebMenu extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }
    
    connectedCallback() {
        this.render();
        this.setupListeners();
    }
    
    render() {
        const currentUser = this.getCurrentUser();
        const modules = this.getVisibleModules();
        const basePath = this.getBasePath();
        
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                }
                
                .menu-container {
                    background-color: #2c3e50;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0 20px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                }
                
                .logo-section {
                    display: flex;
                    align-items: center;
                }
                
                .logo-section img {
                    height: 40px;
                    margin-right: 10px;
                }
                
                .logo-section h1 {
                    font-size: 18px;
                    margin: 0;
                }
                
                .main-menu {
                    display: flex;
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                
                .main-menu li {
                    position: relative;
                }
                
                .main-menu a {
                    color: white;
                    text-decoration: none;
                    padding: 15px 15px;
                    display: inline-block;
                    transition: background-color 0.3s;
                }
                
                .main-menu a:hover {
                    background-color: #34495e;
                }
                
                .submenu {
                    display: none;
                    position: absolute;
                    background-color: #34495e;
                    min-width: 200px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
                    z-index: 1;
                    list-style: none;
                    padding: 0;
                }
                
                .main-menu li:hover .submenu {
                    display: block;
                }
                
                .submenu a {
                    color: white;
                    padding: 12px 15px;
                    display: block;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .submenu a:hover {
                    background-color: #2c3e50;
                }
                
                .user-section {
                    display: flex;
                    align-items: center;
                }
                
                .user-menu {
                    position: relative;
                    cursor: pointer;
                    padding: 15px;
                    display: flex;
                    align-items: center;
                }
                
                .user-menu:hover {
                    background-color: #34495e;
                }
                
                .user-menu .user-info {
                    margin-right: 8px;
                }
                
                .user-dropdown {
                    display: none;
                    position: absolute;
                    right: 0;
                    top: 100%;
                    background-color: #34495e;
                    min-width: 180px;
                    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
                    z-index: 1;
                }
                
                .user-dropdown.active {
                    display: block;
                }
                
                .user-dropdown a {
                    color: white;
                    padding: 12px 15px;
                    display: block;
                    text-decoration: none;
                }
                
                .user-dropdown a:hover {
                    background-color: #2c3e50;
                }
                
                .mobile-toggle {
                    display: none;
                    font-size: 24px;
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                }
                
                @media (max-width: 768px) {
                    .menu-container {
                        flex-wrap: wrap;
                        padding: 10px 20px;
                    }
                    
                    .mobile-toggle {
                        display: block;
                    }
                    
                    .main-menu {
                        display: none;
                        width: 100%;
                        flex-direction: column;
                    }
                    
                    .main-menu.active {
                        display: flex;
                    }
                    
                    .main-menu li {
                        width: 100%;
                    }
                    
                    .main-menu a {
                        width: 100%;
                        box-sizing: border-box;
                    }
                    
                    .submenu {
                        position: static;
                        box-shadow: none;
                        width: 100%;
                        background-color: #2c3e50;
                        padding-left: 20px;
                    }
                    
                    .user-dropdown {
                        position: absolute;
                        right: 0;
                    }
                }
            </style>
            
            <div class="menu-container">
                <button class="mobile-toggle" aria-label="Menu">
                    <i class="fas fa-bars"></i>
                </button>
                
                <div class="logo-section">
                    <img src="${basePath}assets/logo.png" alt="SisWeb Logo">
                    <h1>SisWeb</h1>
                </div>
                
                <ul class="main-menu">
                    <li>
                        <a href="${basePath}index.html">Início</a>
                        </li>
                        
                    ${modules.financeiro ? `
                    <li>
                        <a href="#">Financeiro</a>
                        <ul class="submenu">
                            <li><a href="${basePath}pages/contas-receber.html">Contas a Receber</a></li>
                            <li><a href="${basePath}pages/contas-pagar.html">Contas a Pagar</a></li>
                            <li><a href="${basePath}pages/fluxo-caixa.html">Fluxo de Caixa</a></li>
                            </ul>
                        </li>
                        ` : ''}
                        
                    ${modules.clientes ? `
                    <li>
                        <a href="${basePath}pages/clientes.html">Clientes</a>
                                </li>
                    ` : ''}
                    
                    ${modules.especies ? `
                    <li>
                        <a href="${basePath}pages/especies.html">Espécies</a>
                                </li>
                    ` : ''}
                    
                    ${modules.romaneios ? `
                    <li>
                        <a href="#">Romaneios</a>
                        <ul class="submenu">
                            <li><a href="${basePath}pages/romaneio-tl.html">Romaneio TL</a></li>
                            <li><a href="${basePath}pages/romaneio-pc.html">Romaneio PC</a></li>
                            <li><a href="${basePath}pages/romaneio-pes.html">Romaneio PES</a></li>
                            <li><a href="${basePath}pages/romaneio-tora.html">Romaneio Tora</a></li>
                            </ul>
                        </li>
                        ` : ''}
                        
                    ${modules.orcamentos ? `
                    <li>
                        <a href="${basePath}pages/orcamentos.html">Orçamentos</a>
                                </li>
                    ` : ''}
                    
                    ${modules.relatorios ? `
                    <li>
                        <a href="#">Relatórios</a>
                        <ul class="submenu">
                            <li><a href="${basePath}pages/relatorio-vendas.html">Vendas</a></li>
                            <li><a href="${basePath}pages/relatorio-estoque.html">Estoque</a></li>
                            <li><a href="${basePath}pages/relatorio-financeiro.html">Financeiro</a></li>
                            </ul>
                        </li>
                        ` : ''}
                    
                    <li><a href="${basePath}pages/backup.html">Backup</a></li>
                    <li><a href="${basePath}pages/subscription.html">Assinatura</a></li>
                    <li><a href="${basePath}pages/usuarios.html">Usuários</a></li>
                    
                    <li>
                        <a href="javascript:void(0)" id="aboutLink">Sobre</a>
                    </li>
                </ul>
                
                <div class="user-section">
                    <div class="user-menu">
                        <span class="user-info">${this.getUserName()}</span>
                        <i class="fas fa-chevron-down"></i>
                        
                        <div class="user-dropdown">
                            <a href="${basePath}pages/perfil.html">
                                <i class="fas fa-user"></i> Perfil
                            </a>
                            <a href="${basePath}pages/empresa.html">
                                <i class="fas fa-building"></i> Empresa
                            </a>
                            <a href="javascript:void(0)" id="logoutLink">
                                <i class="fas fa-sign-out-alt"></i> Sair
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    getBasePath() {
        // Verifica se estamos no GitHub Pages ou ambiente local
        const isGitHubPages = window.location.hostname.includes('github.io');
        
        // Se estamos no GitHub Pages, o base path será /sisweb/
        // Se estamos em desenvolvimento local, usar path relativo
        if (isGitHubPages) {
            return '/sisweb/';
        } else {
            // Determinar o caminho relativo com base na localização da página atual
            const path = window.location.pathname;
            if (path.includes('/pages/')) {
                return '../';
            } else if (path.includes('/login/')) {
                return '../';
            } else {
                return '';
            }
        }
    }
    
    setupListeners() {
        // Toggle do menu mobile
        const mobileToggle = this.shadowRoot.querySelector('.mobile-toggle');
        const mainMenu = this.shadowRoot.querySelector('.main-menu');
        
        if (mobileToggle) {
            mobileToggle.addEventListener('click', () => {
                mainMenu.classList.toggle('active');
            });
        }
        
        // Toggle do menu de usuário
        const userMenu = this.shadowRoot.querySelector('.user-menu');
        const userDropdown = this.shadowRoot.querySelector('.user-dropdown');
        
        if (userMenu) {
            userMenu.addEventListener('click', (event) => {
                event.stopPropagation();
                userDropdown.classList.toggle('active');
            });
            
            document.addEventListener('click', () => {
                userDropdown.classList.remove('active');
            });
        }
        
        // Sobre
        const aboutLink = this.shadowRoot.querySelector('#aboutLink');
        if (aboutLink) {
            aboutLink.addEventListener('click', () => {
                // Chamar a função global showAbout no documento principal
                window.showAbout();
            });
        }
        
        // Logout
        const logoutLink = this.shadowRoot.querySelector('#logoutLink');
        if (logoutLink) {
            logoutLink.addEventListener('click', () => {
                this.handleLogout();
            });
        }
    }
    
    /**
     * Obtém os dados do usuário atual
     * @returns {Object|null} Dados do usuário ou null se não estiver logado
     */
    getCurrentUser() {
        try {
            const userDataStr = sessionStorage.getItem('userData');
            if (userDataStr) {
                return JSON.parse(userDataStr);
            } else {
                // Tenta importar o auth para verificar o usuário atual
                if (authModule.auth && authModule.auth.currentUser) {
                    return {
                        uid: authModule.auth.currentUser.uid,
                        displayName: authModule.auth.currentUser.displayName,
                        email: authModule.auth.currentUser.email,
                        role: 'user', // Assume papel padrão até buscar do Firestore
                        isLoggedIn: true
                    };
                }
                return null;
            }
        } catch (error) {
            console.error('Erro ao obter dados do usuário:', error);
            return null;
        }
    }
    
    getUserName() {
        const user = this.getCurrentUser();
        return user ? (user.name || user.username) : 'Usuário';
    }
    
    getUserRole() {
        const user = this.getCurrentUser();
        return user ? user.role : 'guest';
    }
    
    getVisibleModules() {
        const role = this.getUserRole();
        
        // Configuração de módulos visíveis por papel
        const modulesByRole = {
            admin: {
                financeiro: true,
                clientes: true,
                especies: true,
                romaneios: true,
                orcamentos: true,
                relatorios: true
            },
            manager: {
                financeiro: true,
                clientes: true,
                especies: true,
                romaneios: true,
                orcamentos: true,
                relatorios: true
            },
            user: {
                financeiro: false,
                clientes: true,
                especies: true,
                romaneios: true,
                orcamentos: true,
                relatorios: false
            },
            guest: {
                financeiro: false,
                clientes: false,
                especies: false,
                romaneios: false,
                orcamentos: false,
                relatorios: false
            }
        };
        
        return modulesByRole[role] || modulesByRole.guest;
    }
    
    async handleLogout() {
        if (confirm('Deseja realmente sair?')) {
            // Se o módulo de autenticação foi carregado, usar a função logout dele
            if (authModule.logout) {
                await authModule.logout();
            } else {
                // Fallback para a implementação antiga
                sessionStorage.removeItem('userData');
                
                // Verificar se estamos no GitHub Pages
                const isGitHubPages = window.location.hostname.includes('github.io');
                if (isGitHubPages) {
                    window.location.href = '/sisweb/login/index.html';
                } else {
                    window.location.href = '../login/index.html';
                }
            }
        }
    }
}

// Registrar o componente
customElements.define('sisweb-menu', SiswebMenu);