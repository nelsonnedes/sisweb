/**
 * GERENCIADOR DE NAVEGAÇÃO
 * Sistema central de navegação e integração de componentes
 * 
 * @author Sistema de Excelência Firebase
 * @version 3.0.0
 * @created 2024
 */

import stateManager, { EVENT_TYPES } from '../../services/stateManager.js';
import { initializeDashboard } from '../dashboard/dashboard.js';
import { getNotificationSystem } from '../ui/notifications.js';
import { getRomaneioTable } from '../ui/romaneio-table.js';
import { getRomaneioForm } from '../forms/romaneio-form.js';
import { getFornecedorForm } from '../forms/fornecedor-form.js';
import { getEspecieForm } from '../forms/especie-form.js';
import { getPrintService } from '../../services/printService.js';
import { UI_CONFIG } from '../../constants/app-constants.js';
import logger from '../../utils/logger.js';

// =============================================================================
// CLASSE PRINCIPAL DO GERENCIADOR DE NAVEGAÇÃO
// =============================================================================
class NavigationManager {
    constructor() {
        this.currentPage = 'dashboard';
        this.components = new Map();
        this.isInitialized = false;
        this.mobileMenuOpen = false;
        
        this.initialize();
    }

    /**
     * Inicializa o gerenciador de navegação
     */
    initialize() {
        this.createNavigationStructure();
        this.setupEventListeners();
        this.initializeComponents();
        this.setupStateListeners();
        this.loadInitialPage();
        
        this.isInitialized = true;
        logger.success('Gerenciador de navegação inicializado', '🧭 NAV MANAGER');
    }

    /**
     * Cria estrutura de navegação
     */
    createNavigationStructure() {
        const existingContainer = document.getElementById('app-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        const appHTML = `
            <div id="app-container" class="app-container">
                <!-- Sidebar de Navegação -->
                <nav class="sidebar" id="sidebar">
                    <div class="sidebar-header">
                        <div class="sidebar-logo">
                            <span class="logo-icon">🌲</span>
                            <span class="logo-text">SisWeb</span>
                        </div>
                        <button class="sidebar-toggle d-lg-none" id="sidebar-toggle">
                            <span class="toggle-icon">☰</span>
                        </button>
                    </div>

                    <div class="sidebar-content">
                        <!-- Menu Principal -->
                        <div class="nav-section">
                            <div class="nav-section-title">Principal</div>
                            <ul class="nav-menu">
                                <li class="nav-item">
                                    <a href="#" class="nav-link active" data-page="dashboard">
                                        <span class="nav-icon">📊</span>
                                        <span class="nav-text">Dashboard</span>
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a href="#" class="nav-link" data-page="romaneios">
                                        <span class="nav-icon">📋</span>
                                        <span class="nav-text">Romaneios</span>
                                        <span class="nav-badge" id="romaneios-count">0</span>
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <!-- Menu Cadastros -->
                        <div class="nav-section">
                            <div class="nav-section-title">Cadastros</div>
                            <ul class="nav-menu">
                                <li class="nav-item">
                                    <a href="#" class="nav-link" data-page="fornecedores">
                                        <span class="nav-icon">👥</span>
                                        <span class="nav-text">Fornecedores</span>
                                        <span class="nav-badge" id="fornecedores-count">0</span>
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a href="#" class="nav-link" data-page="especies">
                                        <span class="nav-icon">🌲</span>
                                        <span class="nav-text">Espécies</span>
                                        <span class="nav-badge" id="especies-count">0</span>
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <!-- Menu Relatórios -->
                        <div class="nav-section">
                            <div class="nav-section-title">Relatórios</div>
                            <ul class="nav-menu">
                                <li class="nav-item">
                                    <a href="#" class="nav-link" data-page="relatorios">
                                        <span class="nav-icon">📈</span>
                                        <span class="nav-text">Relatórios</span>
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a href="#" class="nav-link" data-page="impressao">
                                        <span class="nav-icon">🖨️</span>
                                        <span class="nav-text">Impressão</span>
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <!-- Menu Configurações -->
                        <div class="nav-section">
                            <div class="nav-section-title">Sistema</div>
                            <ul class="nav-menu">
                                <li class="nav-item">
                                    <a href="#" class="nav-link" data-page="configuracoes">
                                        <span class="nav-icon">⚙️</span>
                                        <span class="nav-text">Configurações</span>
                                    </a>
                                </li>
                                <li class="nav-item">
                                    <a href="#" class="nav-link" data-page="sobre">
                                        <span class="nav-icon">ℹ️</span>
                                        <span class="nav-text">Sobre</span>
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div class="sidebar-footer">
                        <div class="sync-status" id="sync-status">
                            <span class="sync-icon">🔄</span>
                            <span class="sync-text">Sincronizado</span>
                        </div>
                    </div>
                </nav>

                <!-- Conteúdo Principal -->
                <main class="main-content" id="main-content">
                    <!-- Header -->
                    <header class="content-header">
                        <div class="header-left">
                            <button class="sidebar-toggle d-lg-none" id="mobile-sidebar-toggle">
                                <span class="toggle-icon">☰</span>
                            </button>
                            <h1 class="page-title" id="page-title">Dashboard</h1>
                        </div>

                        <div class="header-right">
                            <div class="header-actions">
                                <!-- Ações rápidas baseadas na página atual -->
                                <div class="quick-actions" id="quick-actions">
                                    <!-- Botões serão inseridos dinamicamente -->
                                </div>

                                <!-- Status de conexão -->
                                <div class="connection-status" id="connection-status">
                                    <span class="status-indicator online"></span>
                                    <span class="status-text">Online</span>
                                </div>
                            </div>
                        </div>
                    </header>

                    <!-- Área de conteúdo -->
                    <div class="content-area" id="content-area">
                        <!-- Dashboard (página inicial) -->
                        <div class="page-content active" id="page-dashboard">
                            <div id="dashboard-container"></div>
                        </div>

                        <!-- Romaneios -->
                        <div class="page-content" id="page-romaneios">
                            <div class="page-header">
                                <div class="page-header-content">
                                    <h2>Gerenciamento de Romaneios</h2>
                                    <p class="page-description">Visualize, edite e gerencie todos os romaneios do sistema</p>
                                </div>
                                <div class="page-actions">
                                    <button class="btn btn-primary" id="btn-novo-romaneio">
                                        <span class="btn-icon">➕</span>
                                        Novo Romaneio
                                    </button>
                                </div>
                            </div>
                            <div id="romaneio-table-container"></div>
                        </div>

                        <!-- Fornecedores -->
                        <div class="page-content" id="page-fornecedores">
                            <div class="page-header">
                                <div class="page-header-content">
                                    <h2>Cadastro de Fornecedores</h2>
                                    <p class="page-description">Gerencie informações dos fornecedores de madeira</p>
                                </div>
                                <div class="page-actions">
                                    <button class="btn btn-primary" id="btn-novo-fornecedor">
                                        <span class="btn-icon">👤</span>
                                        Novo Fornecedor
                                    </button>
                                </div>
                            </div>
                            <div id="fornecedores-container">
                                <div class="data-grid" id="fornecedores-grid">
                                    <!-- Grid de fornecedores -->
                                </div>
                            </div>
                        </div>

                        <!-- Espécies -->
                        <div class="page-content" id="page-especies">
                            <div class="page-header">
                                <div class="page-header-content">
                                    <h2>Cadastro de Espécies</h2>
                                    <p class="page-description">Gerencie informações das espécies madeireiras</p>
                                </div>
                                <div class="page-actions">
                                    <button class="btn btn-primary" id="btn-nova-especie">
                                        <span class="btn-icon">🌲</span>
                                        Nova Espécie
                                    </button>
                                </div>
                            </div>
                            <div id="especies-container">
                                <div class="data-grid" id="especies-grid">
                                    <!-- Grid de espécies -->
                                </div>
                            </div>
                        </div>

                        <!-- Outras páginas... -->
                        <div class="page-content" id="page-relatorios">
                            <h2>Relatórios Avançados</h2>
                            <p>Em desenvolvimento...</p>
                        </div>

                        <div class="page-content" id="page-impressao">
                            <h2>Sistema de Impressão</h2>
                            <p>Em desenvolvimento...</p>
                        </div>

                        <div class="page-content" id="page-configuracoes">
                            <h2>Configurações do Sistema</h2>
                            <p>Em desenvolvimento...</p>
                        </div>

                        <div class="page-content" id="page-sobre">
                            <div class="about-page">
                                <h2>SisWeb - Sistema de Gestão de Madeira</h2>
                                <div class="about-info">
                                    <p><strong>Versão:</strong> 3.0.0</p>
                                    <p><strong>Desenvolvido por:</strong> Sistema de Excelência Firebase</p>
                                    <p><strong>Tecnologias:</strong> JavaScript ES6+, Firebase, Bootstrap</p>
                                    <p><strong>Última atualização:</strong> 2024</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>

                <!-- Overlay para mobile -->
                <div class="sidebar-overlay" id="sidebar-overlay"></div>
            </div>
        `;

        document.body.innerHTML = appHTML;
        this.injectStyles();
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Links de navegação
        document.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                this.navigateTo(page);
            });
        });

        // Toggle sidebar mobile
        document.querySelectorAll('.sidebar-toggle, #mobile-sidebar-toggle').forEach(btn => {
            btn.addEventListener('click', () => this.toggleSidebar());
        });

        // Overlay sidebar mobile
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            this.closeSidebar();
        });

        // Botões de ação rápida
        document.getElementById('btn-novo-romaneio')?.addEventListener('click', () => {
            const romaneioForm = getRomaneioForm();
            romaneioForm.create();
        });

        document.getElementById('btn-novo-fornecedor')?.addEventListener('click', () => {
            const fornecedorForm = getFornecedorForm();
            fornecedorForm.create();
        });

        document.getElementById('btn-nova-especie')?.addEventListener('click', () => {
            const especieForm = getEspecieForm();
            especieForm.create();
        });

        // Responsive
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 992) {
                this.closeSidebar();
            }
        });

        // Atalhos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case '1':
                        e.preventDefault();
                        this.navigateTo('dashboard');
                        break;
                    case '2':
                        e.preventDefault();
                        this.navigateTo('romaneios');
                        break;
                    case '3':
                        e.preventDefault();
                        this.navigateTo('fornecedores');
                        break;
                    case '4':
                        e.preventDefault();
                        this.navigateTo('especies');
                        break;
                    case 'n':
                        e.preventDefault();
                        if (this.currentPage === 'romaneios') {
                            const romaneioForm = getRomaneioForm();
                            romaneioForm.create();
                        }
                        break;
                }
            }
        });
    }

    /**
     * Inicializa componentes
     */
    initializeComponents() {
        // Dashboard
        this.components.set('dashboard', initializeDashboard('dashboard-container'));
        
        // Tabela de romaneios
        const romaneioTable = getRomaneioTable();
        if (romaneioTable) {
            romaneioTable.initialize('romaneio-table-container');
            this.components.set('romaneioTable', romaneioTable);
        }

        // Formulários
        this.components.set('romaneioForm', getRomaneioForm());
        this.components.set('fornecedorForm', getFornecedorForm());
        this.components.set('especieForm', getEspecieForm());

        // Serviços
        this.components.set('printService', getPrintService());
        this.components.set('notifications', getNotificationSystem());

        logger.success('Componentes inicializados', '🧭 NAV MANAGER');
    }

    /**
     * Configura listeners do state manager
     */
    setupStateListeners() {
        stateManager.on(EVENT_TYPES.ROMANEIOS_UPDATED, () => {
            this.updateNavigationCounts();
        });

        stateManager.on(EVENT_TYPES.FORNECEDORES_UPDATED, () => {
            this.updateNavigationCounts();
            this.updateFornecedoresPage();
        });

        stateManager.on(EVENT_TYPES.ESPECIES_UPDATED, () => {
            this.updateNavigationCounts();
            this.updateEspeciesPage();
        });

        stateManager.on(EVENT_TYPES.DATA_SYNCED, () => {
            this.updateSyncStatus(true);
        });

        stateManager.on(EVENT_TYPES.LOADING_CHANGED, (isLoading) => {
            this.updateSyncStatus(!isLoading);
        });

        // Eventos de conexão
        window.addEventListener('online', () => this.updateConnectionStatus(true));
        window.addEventListener('offline', () => this.updateConnectionStatus(false));
    }

    // =========================================================================
    // NAVEGAÇÃO
    // =========================================================================

    /**
     * Navega para uma página
     */
    navigateTo(page) {
        if (this.currentPage === page) return;

        // Remove classe active do link atual
        document.querySelectorAll('.nav-link.active').forEach(link => {
            link.classList.remove('active');
        });

        // Adiciona classe active ao novo link
        const newLink = document.querySelector(`[data-page="${page}"]`);
        if (newLink) {
            newLink.classList.add('active');
        }

        // Esconde página atual
        document.querySelectorAll('.page-content.active').forEach(content => {
            content.classList.remove('active');
        });

        // Mostra nova página
        const newPage = document.getElementById(`page-${page}`);
        if (newPage) {
            newPage.classList.add('active');
        }

        // Atualiza título da página
        this.updatePageTitle(page);

        // Atualiza ações rápidas
        this.updateQuickActions(page);

        // Carrega dados da página se necessário
        this.loadPageData(page);

        this.currentPage = page;
        
        // Fecha sidebar em mobile
        if (window.innerWidth < 992) {
            this.closeSidebar();
        }

        logger.ui('page_navigation', { page });
    }

    /**
     * Carrega página inicial
     */
    loadInitialPage() {
        this.navigateTo('dashboard');
        this.updateNavigationCounts();
    }

    /**
     * Carrega dados específicos da página
     */
    loadPageData(page) {
        switch (page) {
            case 'dashboard':
                // Dashboard carrega automaticamente
                break;
            case 'romaneios':
                // Tabela carrega automaticamente
                break;
            case 'fornecedores':
                this.updateFornecedoresPage();
                break;
            case 'especies':
                this.updateEspeciesPage();
                break;
        }
    }

    // =========================================================================
    // ATUALIZAÇÃO DE INTERFACE
    // =========================================================================

    /**
     * Atualiza título da página
     */
    updatePageTitle(page) {
        const titles = {
            dashboard: 'Dashboard',
            romaneios: 'Romaneios',
            fornecedores: 'Fornecedores',
            especies: 'Espécies',
            relatorios: 'Relatórios',
            impressao: 'Impressão',
            configuracoes: 'Configurações',
            sobre: 'Sobre'
        };

        const titleElement = document.getElementById('page-title');
        if (titleElement) {
            titleElement.textContent = titles[page] || 'SisWeb';
        }
    }

    /**
     * Atualiza ações rápidas
     */
    updateQuickActions(page) {
        const actionsContainer = document.getElementById('quick-actions');
        if (!actionsContainer) return;

        let actionsHTML = '';

        switch (page) {
            case 'romaneios':
                actionsHTML = `
                    <button class="btn btn-sm btn-outline-primary" onclick="window.location.reload()">
                        <span class="btn-icon">🔄</span>
                        Atualizar
                    </button>
                `;
                break;
            case 'dashboard':
                actionsHTML = `
                    <button class="btn btn-sm btn-outline-success" id="btn-export-dashboard">
                        <span class="btn-icon">📊</span>
                        Exportar
                    </button>
                `;
                break;
        }

        actionsContainer.innerHTML = actionsHTML;
    }

    /**
     * Atualiza contadores de navegação
     */
    updateNavigationCounts() {
        const romaneios = stateManager.getRomaneios();
        const fornecedores = stateManager.getFornecedores();
        const especies = stateManager.getEspecies();

        this.updateBadge('romaneios-count', romaneios.length);
        this.updateBadge('fornecedores-count', fornecedores.length);
        this.updateBadge('especies-count', especies.length);
    }

    /**
     * Atualiza badge de contador
     */
    updateBadge(elementId, count) {
        const badge = document.getElementById(elementId);
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-block' : 'none';
        }
    }

    /**
     * Atualiza status de sincronização
     */
    updateSyncStatus(synced) {
        const syncStatus = document.getElementById('sync-status');
        if (syncStatus) {
            const icon = syncStatus.querySelector('.sync-icon');
            const text = syncStatus.querySelector('.sync-text');
            
            if (synced) {
                icon.textContent = '✅';
                text.textContent = 'Sincronizado';
                syncStatus.className = 'sync-status synced';
            } else {
                icon.textContent = '🔄';
                text.textContent = 'Sincronizando...';
                syncStatus.className = 'sync-status syncing';
            }
        }
    }

    /**
     * Atualiza status de conexão
     */
    updateConnectionStatus(online) {
        const connectionStatus = document.getElementById('connection-status');
        if (connectionStatus) {
            const indicator = connectionStatus.querySelector('.status-indicator');
            const text = connectionStatus.querySelector('.status-text');
            
            if (online) {
                indicator.className = 'status-indicator online';
                text.textContent = 'Online';
            } else {
                indicator.className = 'status-indicator offline';
                text.textContent = 'Offline';
            }
        }
    }

    // =========================================================================
    // PÁGINAS ESPECÍFICAS
    // =========================================================================

    /**
     * Atualiza página de fornecedores
     */
    updateFornecedoresPage() {
        const container = document.getElementById('fornecedores-grid');
        if (!container) return;

        const fornecedores = stateManager.getFornecedores();
        
        if (fornecedores.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>Nenhum fornecedor cadastrado</h3>
                    <p>Clique em "Novo Fornecedor" para começar</p>
                </div>
            `;
            return;
        }

        container.innerHTML = fornecedores.map(fornecedor => `
            <div class="data-card" onclick="this.editFornecedor('${fornecedor.id}')">
                <div class="card-header">
                    <h4>${fornecedor.nome}</h4>
                    <div class="card-actions">
                        <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); this.editFornecedor('${fornecedor.id}')">
                            ✏️
                        </button>
                    </div>
                </div>
                <div class="card-content">
                    <p><strong>CPF/CNPJ:</strong> ${fornecedor.cpf || fornecedor.cnpj || 'N/A'}</p>
                    <p><strong>Telefone:</strong> ${fornecedor.telefone || 'N/A'}</p>
                    <p><strong>Email:</strong> ${fornecedor.email || 'N/A'}</p>
                </div>
            </div>
        `).join('');
    }

    /**
     * Atualiza página de espécies
     */
    updateEspeciesPage() {
        const container = document.getElementById('especies-grid');
        if (!container) return;

        const especies = stateManager.getEspecies();
        
        if (especies.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🌲</div>
                    <h3>Nenhuma espécie cadastrada</h3>
                    <p>Clique em "Nova Espécie" para começar</p>
                </div>
            `;
            return;
        }

        container.innerHTML = especies.map(especie => `
            <div class="data-card" onclick="this.editEspecie('${especie.id}')">
                <div class="card-header">
                    <h4>${especie.nome}</h4>
                    <div class="card-actions">
                        <button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); this.editEspecie('${especie.id}')">
                            ✏️
                        </button>
                    </div>
                </div>
                <div class="card-content">
                    <p><strong>Código:</strong> ${especie.codigo || 'N/A'}</p>
                    <p><strong>Nome Científico:</strong> ${especie.nomeCientifico || 'N/A'}</p>
                    <p><strong>Densidade:</strong> ${especie.densidade || 'N/A'} kg/m³</p>
                </div>
            </div>
        `).join('');
    }

    // =========================================================================
    // SIDEBAR MOBILE
    // =========================================================================

    /**
     * Toggle sidebar mobile
     */
    toggleSidebar() {
        if (this.mobileMenuOpen) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }

    /**
     * Abre sidebar mobile
     */
    openSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
        
        this.mobileMenuOpen = true;
        document.body.style.overflow = 'hidden';
    }

    /**
     * Fecha sidebar mobile
     */
    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        
        this.mobileMenuOpen = false;
        document.body.style.overflow = '';
    }

    // =========================================================================
    // MÉTODOS DE UTILIDADE
    // =========================================================================

    /**
     * Edita fornecedor
     */
    editFornecedor(id) {
        const fornecedor = stateManager.getFornecedores().find(f => f.id === id);
        if (fornecedor) {
            const fornecedorForm = getFornecedorForm();
            fornecedorForm.edit(fornecedor);
        }
    }

    /**
     * Edita espécie
     */
    editEspecie(id) {
        const especie = stateManager.getEspecies().find(e => e.id === id);
        if (especie) {
            const especieForm = getEspecieForm();
            especieForm.edit(especie);
        }
    }

    /**
     * Injeta estilos CSS
     */
    injectStyles() {
        if (document.getElementById('nav-manager-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'nav-manager-styles';
        styles.textContent = `
            /* Reset e layout base */
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #f8f9fa;
                overflow-x: hidden;
            }

            .app-container {
                display: flex;
                min-height: 100vh;
            }

            /* Sidebar */
            .sidebar {
                width: 280px;
                background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%);
                color: white;
                position: fixed;
                left: 0;
                top: 0;
                height: 100vh;
                overflow-y: auto;
                transition: transform 0.3s ease;
                z-index: 1000;
            }

            .sidebar-header {
                padding: 20px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .sidebar-logo {
                display: flex;
                align-items: center;
                font-size: 1.5rem;
                font-weight: 700;
            }

            .logo-icon {
                margin-right: 10px;
                font-size: 2rem;
            }

            .sidebar-toggle {
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                padding: 5px;
                border-radius: 4px;
                transition: background 0.2s;
            }

            .sidebar-toggle:hover {
                background: rgba(255,255,255,0.1);
            }

            .sidebar-content {
                padding: 20px 0;
            }

            .nav-section {
                margin-bottom: 30px;
            }

            .nav-section-title {
                padding: 0 20px;
                font-size: 0.75rem;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: rgba(255,255,255,0.6);
                margin-bottom: 10px;
                font-weight: 600;
            }

            .nav-menu {
                list-style: none;
            }

            .nav-item {
                margin-bottom: 2px;
            }

            .nav-link {
                display: flex;
                align-items: center;
                padding: 12px 20px;
                color: rgba(255,255,255,0.8);
                text-decoration: none;
                transition: all 0.2s;
                border-left: 3px solid transparent;
                position: relative;
            }

            .nav-link:hover {
                background: rgba(255,255,255,0.05);
                color: white;
                text-decoration: none;
            }

            .nav-link.active {
                background: rgba(255,255,255,0.1);
                color: white;
                border-left-color: #3498db;
            }

            .nav-icon {
                margin-right: 12px;
                font-size: 1.1rem;
                width: 20px;
                text-align: center;
            }

            .nav-text {
                flex: 1;
            }

            .nav-badge {
                background: #e74c3c;
                color: white;
                font-size: 0.7rem;
                padding: 2px 6px;
                border-radius: 10px;
                min-width: 18px;
                text-align: center;
                display: none;
            }

            .sidebar-footer {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                padding: 20px;
                border-top: 1px solid rgba(255,255,255,0.1);
            }

            .sync-status {
                display: flex;
                align-items: center;
                font-size: 0.85rem;
                color: rgba(255,255,255,0.7);
            }

            .sync-status.synced .sync-icon {
                color: #2ecc71;
            }

            .sync-status.syncing .sync-icon {
                animation: spin 1s linear infinite;
                color: #f39c12;
            }

            .sync-icon {
                margin-right: 8px;
            }

            /* Conteúdo principal */
            .main-content {
                flex: 1;
                margin-left: 280px;
                min-height: 100vh;
                display: flex;
                flex-direction: column;
            }

            .content-header {
                background: white;
                padding: 20px 30px;
                border-bottom: 1px solid #e9ecef;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: sticky;
                top: 0;
                z-index: 100;
            }

            .header-left {
                display: flex;
                align-items: center;
            }

            .page-title {
                font-size: 1.5rem;
                color: #2c3e50;
                margin: 0;
                margin-left: 15px;
            }

            .header-right {
                display: flex;
                align-items: center;
            }

            .header-actions {
                display: flex;
                align-items: center;
                gap: 15px;
            }

            .quick-actions {
                display: flex;
                gap: 10px;
            }

            .connection-status {
                display: flex;
                align-items: center;
                font-size: 0.85rem;
                color: #6c757d;
            }

            .status-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                margin-right: 6px;
            }

            .status-indicator.online {
                background: #28a745;
            }

            .status-indicator.offline {
                background: #dc3545;
            }

            /* Área de conteúdo */
            .content-area {
                flex: 1;
                padding: 30px;
                position: relative;
            }

            .page-content {
                display: none;
            }

            .page-content.active {
                display: block;
            }

            .page-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 1px solid #e9ecef;
            }

            .page-header-content h2 {
                color: #2c3e50;
                margin-bottom: 5px;
            }

            .page-description {
                color: #6c757d;
                margin: 0;
            }

            .page-actions {
                display: flex;
                gap: 10px;
            }

            /* Data grid */
            .data-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                gap: 20px;
            }

            .data-card {
                background: white;
                border-radius: 8px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: all 0.2s;
                cursor: pointer;
            }

            .data-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }

            .card-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 15px;
            }

            .card-header h4 {
                color: #2c3e50;
                margin: 0;
                font-size: 1.1rem;
            }

            .card-actions {
                display: flex;
                gap: 5px;
            }

            .card-content p {
                margin-bottom: 8px;
                font-size: 0.9rem;
                color: #6c757d;
            }

            /* Empty state */
            .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: #6c757d;
            }

            .empty-icon {
                font-size: 4rem;
                margin-bottom: 20px;
                opacity: 0.5;
            }

            .empty-state h3 {
                margin-bottom: 10px;
                color: #495057;
            }

            /* About page */
            .about-page {
                max-width: 600px;
                margin: 0 auto;
                text-align: center;
            }

            .about-info {
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin-top: 20px;
                text-align: left;
            }

            .about-info p {
                margin-bottom: 10px;
            }

            /* Sidebar overlay para mobile */
            .sidebar-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 999;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
            }

            .sidebar-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            /* Animações */
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            /* Responsive */
            @media (max-width: 991.98px) {
                .sidebar {
                    transform: translateX(-100%);
                }

                .sidebar.open {
                    transform: translateX(0);
                }

                .main-content {
                    margin-left: 0;
                }

                .content-header .sidebar-toggle {
                    display: block;
                }

                .page-header {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 15px;
                }

                .data-grid {
                    grid-template-columns: 1fr;
                }
            }

            @media (max-width: 767.98px) {
                .content-area {
                    padding: 20px 15px;
                }

                .content-header {
                    padding: 15px 20px;
                }

                .page-title {
                    font-size: 1.25rem;
                }

                .header-actions {
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 8px;
                }

                .quick-actions {
                    flex-direction: column;
                    gap: 5px;
                }
            }

            /* Utilitários */
            .d-lg-none {
                display: none !important;
            }

            @media (max-width: 991.98px) {
                .d-lg-none {
                    display: block !important;
                }
            }

            .btn {
                padding: 8px 16px;
                border-radius: 6px;
                border: 1px solid transparent;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 0.875rem;
            }

            .btn-primary {
                background: #007bff;
                color: white;
                border-color: #007bff;
            }

            .btn-primary:hover {
                background: #0056b3;
                border-color: #0056b3;
            }

            .btn-outline-primary {
                color: #007bff;
                border-color: #007bff;
                background: transparent;
            }

            .btn-outline-primary:hover {
                background: #007bff;
                color: white;
            }

            .btn-sm {
                padding: 6px 12px;
                font-size: 0.8rem;
            }

            .btn-icon {
                margin-right: 6px;
            }
        `;

        document.head.appendChild(styles);
    }
}

// =============================================================================
// INICIALIZAÇÃO E EXPORTAÇÃO
// =============================================================================
let navigationManagerInstance = null;

function initializeNavigationManager() {
    if (!navigationManagerInstance) {
        navigationManagerInstance = new NavigationManager();
    }
    return navigationManagerInstance;
}

function getNavigationManager() {
    if (!navigationManagerInstance) {
        return initializeNavigationManager();
    }
    return navigationManagerInstance;
}

// Auto-inicialização
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigationManager();
});

export default NavigationManager;
export { initializeNavigationManager, getNavigationManager }; 