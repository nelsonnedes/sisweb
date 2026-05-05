/**
 * APLICAÇÃO PRINCIPAL - SISTEMA FIREBASE
 * Integração completa dos módulos e inicialização da aplicação
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

// =============================================================================
// IMPORTAÇÕES DOS MÓDULOS
// =============================================================================

// Utilitários Base
import logger from './utils/logger.js';
import { Validator } from './utils/validators.js';
import * as formatters from './utils/formatters.js';
import { Calculator } from './utils/calculations.js';

// Configurações
import { 
    FIREBASE_CONFIG, 
    UI_CONFIG, 
    DEV_CONFIG,
    VALIDATION_CONFIG 
} from './constants/app-constants.js';

// Serviços
import firebaseService from './services/firebaseService.js';
import stateManager, { EVENT_TYPES } from './services/stateManager.js';

// Componentes UI
import notificationSystem from './components/ui/notifications.js';
import { initializeRomaneioTable } from './components/ui/romaneio-table.js';

// =============================================================================
// CLASSE PRINCIPAL DA APLICAÇÃO
// =============================================================================
class App {
    constructor() {
        this.isInitialized = false;
        this.isDebugMode = DEV_CONFIG.DEBUG_MODE;
        this.version = '2.0.0';
        this.startTime = Date.now();
        
        // Instâncias dos utilitários
        this.validator = new Validator();
        this.calculator = new Calculator();
        this.formatters = formatters;
        
        // Estados da aplicação
        this.currentPage = 'dashboard';
        this.user = null;
        this.appConfig = {
            offline: false,
            lastSync: null,
            errors: []
        };

        // Inicia inicialização
        this.initialize();
    }

    // =========================================================================
    // INICIALIZAÇÃO
    // =========================================================================

    /**
     * Inicializa a aplicação
     */
    async initialize() {
        try {
            logger.info('🚀 Iniciando aplicação Firebase v' + this.version, '🔥 APP');
            
            // Verifica dependências
            await this.checkDependencies();
            
            // Inicializa Firebase
            await this.initializeFirebase();
            
            // Configura gerenciamento de estado
            await this.setupStateManager();
            
            // Inicializa interface
            await this.initializeUI();
            
            // Configura event listeners globais
            this.setupGlobalEventListeners();
            
            // Carrega dados iniciais
            await this.loadInitialData();
            
            // Finaliza inicialização
            await this.finishInitialization();
            
        } catch (error) {
            logger.error('Falha na inicialização da aplicação', error);
            await this.handleInitializationError(error);
        }
    }

    /**
     * Verifica se todas as dependências estão disponíveis
     */
    async checkDependencies() {
        const dependencies = [
            'localStorage',
            'fetch',
            'Promise'
        ];

        const missing = dependencies.filter(dep => {
            switch(dep) {
                case 'localStorage':
                    return typeof Storage === 'undefined';
                case 'fetch':
                    return typeof fetch === 'undefined';
                case 'Promise':
                    return typeof Promise === 'undefined';
                default:
                    return false;
            }
        });

        if (missing.length > 0) {
            throw new Error(`Dependências não suportadas: ${missing.join(', ')}`);
        }

        logger.success('Todas as dependências verificadas', '✅ DEPS');
    }

    /**
     * Inicializa Firebase
     */
    async initializeFirebase() {
        logger.info('Inicializando Firebase...', '🔥 FIREBASE');
        
        try {
            await firebaseService.initialize();
            logger.success('Firebase inicializado com sucesso', '🔥 FIREBASE');
        } catch (error) {
            logger.error('Erro ao inicializar Firebase', error);
            
            // Modo offline de emergência
            this.appConfig.offline = true;
            logger.warn('Aplicação funcionando em modo offline', '📴 OFFLINE');
        }
    }

    /**
     * Configura o gerenciamento de estado
     */
    async setupStateManager() {
        logger.info('Configurando gerenciamento de estado...', '📊 STATE');
        
        // Inicializa StateManager
        await stateManager.initialize();
        
        // Configura listeners principais
        this.setupStateListeners();
        
        logger.success('Gerenciamento de estado configurado', '📊 STATE');
    }

    /**
     * Inicializa componentes da interface
     */
    async initializeUI() {
        logger.info('Inicializando interface...', '🎨 UI');
        
        // Sistema de notificações já está inicializado automaticamente
        
        // Inicializa tabela de romaneios se o container existir
        const tableContainer = document.getElementById('romaneio-table-container');
        if (tableContainer) {
            initializeRomaneioTable();
            logger.success('Tabela de romaneios inicializada', '📊 TABLE');
        }
        
        // Configura elementos globais da UI
        this.setupGlobalUI();
        
        logger.success('Interface inicializada', '🎨 UI');
    }

    /**
     * Carrega dados iniciais
     */
    async loadInitialData() {
        logger.info('Carregando dados iniciais...', '📥 DATA');
        
        try {
            // Carrega dados em paralelo
            await Promise.all([
                stateManager.loadRomaneios(),
                stateManager.loadFornecedores(),
                stateManager.loadEspecies()
            ]);
            
            this.appConfig.lastSync = new Date();
            logger.success('Dados iniciais carregados', '📥 DATA');
            
        } catch (error) {
            logger.error('Erro ao carregar dados iniciais', error);
            
            // Tenta carregar dados locais em caso de erro
            await this.loadLocalData();
        }
    }

    /**
     * Finaliza a inicialização
     */
    async finishInitialization() {
        this.isInitialized = true;
        
        const initTime = Date.now() - this.startTime;
        logger.success(`Aplicação inicializada em ${initTime}ms`, '🎉 READY');
        
        // Emite evento de aplicação pronta
        window.dispatchEvent(new CustomEvent('appReady', {
            detail: {
                version: this.version,
                initTime,
                isOffline: this.appConfig.offline
            }
        }));
        
        // Exibe notificação de boas-vindas
        notificationSystem.success('Aplicação iniciada com sucesso!', {
            duration: 3000
        });

        // Debug info
        if (this.isDebugMode) {
            logger.debug('Modo de debug ativado', '🐛 DEBUG');
            logger.debug(`Estado atual: ${Object.keys(stateManager.getState()).join(', ')}`, '📊 STATE');
        }
    }

    // =========================================================================
    // CONFIGURAÇÃO DE LISTENERS
    // =========================================================================

    /**
     * Configura listeners do StateManager
     */
    setupStateListeners() {
        // Listener para mudanças de romaneios
        stateManager.on(EVENT_TYPES.ROMANEIOS_UPDATED, (data) => {
            logger.ui('romaneios_updated', `${data.count} romaneios`);
        });

        // Listener para erros
        stateManager.on(EVENT_TYPES.ERROR_OCCURRED, (data) => {
            this.appConfig.errors.push({
                timestamp: new Date(),
                error: data.error,
                context: data.context
            });
        });

        // Listener para sincronização
        stateManager.on(EVENT_TYPES.DATA_SYNCED, (data) => {
            this.appConfig.lastSync = new Date();
            logger.ui('data_synced', `${data.collection}: ${data.count} itens`);
        });
    }

    /**
     * Configura event listeners globais
     */
    setupGlobalEventListeners() {
        // Eventos de ciclo de vida da página
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });

        // Eventos de conectividade
        window.addEventListener('online', () => {
            this.handleOnline();
        });

        window.addEventListener('offline', () => {
            this.handleOffline();
        });

        // Eventos de visibilidade da página
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });

        // Eventos personalizados da aplicação
        this.setupCustomEventListeners();

        logger.debug('Event listeners globais configurados', '👂 EVENTS');
    }

    /**
     * Configura listeners de eventos personalizados
     */
    setupCustomEventListeners() {
        // Eventos da tabela de romaneios
        window.addEventListener('viewRomaneio', (event) => {
            this.handleViewRomaneio(event.detail.romaneioId);
        });

        window.addEventListener('editRomaneio', (event) => {
            this.handleEditRomaneio(event.detail.romaneioId);
        });

        window.addEventListener('createRomaneio', () => {
            this.handleCreateRomaneio();
        });

        window.addEventListener('printRomaneio', (event) => {
            this.handlePrintRomaneio(event.detail.romaneioId);
        });

        // Eventos de navegação
        window.addEventListener('navigateTo', (event) => {
            this.navigateTo(event.detail.page, event.detail.params);
        });
    }

    // =========================================================================
    // MANIPULADORES DE EVENTOS
    // =========================================================================

    /**
     * Manipula quando aplicação fica online
     */
    async handleOnline() {
        logger.info('Conectividade restaurada', '🌐 ONLINE');
        
        this.appConfig.offline = false;
        notificationSystem.success('Conexão restaurada - sincronizando dados...');
        
        try {
            // Tenta reconectar Firebase
            await firebaseService.initialize();
            
            // Sincroniza dados pendentes
            await this.syncPendingData();
            
        } catch (error) {
            logger.error('Erro ao reconectar', error);
        }
    }

    /**
     * Manipula quando aplicação fica offline
     */
    handleOffline() {
        logger.warn('Aplicação está offline', '📴 OFFLINE');
        
        this.appConfig.offline = true;
        notificationSystem.warning('Sem conexão - funcionando em modo offline');
    }

    /**
     * Manipula quando página fica oculta
     */
    handlePageHidden() {
        logger.debug('Página oculta', '👁️ VISIBILITY');
        // Implementar lógica para economizar recursos
    }

    /**
     * Manipula quando página fica visível
     */
    handlePageVisible() {
        logger.debug('Página visível', '👁️ VISIBILITY');
        // Verificar se precisa atualizar dados
        this.checkForUpdates();
    }

    // =========================================================================
    // MANIPULADORES DE AÇÕES
    // =========================================================================

    /**
     * Visualiza um romaneio
     */
    handleViewRomaneio(romaneioId) {
        logger.ui('view_romaneio', romaneioId);
        
        const romaneio = stateManager.getRomaneioById(romaneioId);
        if (!romaneio) {
            notificationSystem.error('Romaneio não encontrado');
            return;
        }

        // Implementar lógica de visualização
        // Por exemplo, abrir modal ou navegar para página de detalhes
        this.openRomaneioModal(romaneio, 'view');
    }

    /**
     * Edita um romaneio
     */
    handleEditRomaneio(romaneioId) {
        logger.ui('edit_romaneio', romaneioId);
        
        const romaneio = stateManager.getRomaneioById(romaneioId);
        if (!romaneio) {
            notificationSystem.error('Romaneio não encontrado');
            return;
        }

        // Implementar lógica de edição
        this.openRomaneioModal(romaneio, 'edit');
    }

    /**
     * Cria novo romaneio
     */
    handleCreateRomaneio() {
        logger.ui('create_romaneio');
        
        // Implementar lógica de criação
        this.openRomaneioModal(null, 'create');
    }

    /**
     * Imprime romaneio
     */
    handlePrintRomaneio(romaneioId) {
        logger.ui('print_romaneio', romaneioId);
        
        const romaneio = stateManager.getRomaneioById(romaneioId);
        if (!romaneio) {
            notificationSystem.error('Romaneio não encontrado');
            return;
        }

        // Implementar lógica de impressão
        this.printRomaneio(romaneio);
    }

    // =========================================================================
    // MÉTODOS UTILITÁRIOS
    // =========================================================================

    /**
     * Abre modal de romaneio
     */
    openRomaneioModal(romaneio, mode) {
        // Implementação do modal seria feita aqui
        // Por enquanto, apenas logamos a ação
        logger.info(`Abrindo modal: ${mode}`, '📋 MODAL');
        
        if (mode === 'create') {
            notificationSystem.info('Funcionalidade de criação em desenvolvimento');
        } else {
            notificationSystem.info(`Funcionalidade de ${mode} em desenvolvimento`);
        }
    }

    /**
     * Imprime romaneio
     */
    printRomaneio(romaneio) {
        // Implementação da impressão seria feita aqui
        logger.info('Imprimindo romaneio', '🖨️ PRINT');
        notificationSystem.info('Funcionalidade de impressão em desenvolvimento');
    }

    /**
     * Navega para uma página
     */
    navigateTo(page, params = {}) {
        logger.ui('navigate_to', `${page} - ${JSON.stringify(params)}`);
        
        this.currentPage = page;
        
        // Implementar lógica de navegação
        // Por exemplo, mostrar/ocultar seções da página
        notificationSystem.info(`Navegando para: ${page}`);
    }

    /**
     * Verifica se há atualizações
     */
    async checkForUpdates() {
        if (this.appConfig.offline) return;
        
        try {
            // Implementar verificação de atualizações
            logger.debug('Verificando atualizações...', '🔄 UPDATE');
        } catch (error) {
            logger.error('Erro ao verificar atualizações', error);
        }
    }

    /**
     * Sincroniza dados pendentes
     */
    async syncPendingData() {
        try {
            // Implementar sincronização de dados pendentes
            logger.info('Sincronizando dados pendentes...', '🔄 SYNC');
            
            // Recarrega dados do Firebase
            await this.loadInitialData();
            
            notificationSystem.success('Dados sincronizados com sucesso');
            
        } catch (error) {
            logger.error('Erro na sincronização', error);
            notificationSystem.error('Erro ao sincronizar dados');
        }
    }

    /**
     * Carrega dados locais em caso de emergência
     */
    async loadLocalData() {
        try {
            logger.warn('Tentando carregar dados locais...', '💾 LOCAL');
            
            // Implementar carregamento de dados locais
            // Por exemplo, do localStorage
            
        } catch (error) {
            logger.error('Erro ao carregar dados locais', error);
        }
    }

    /**
     * Configura elementos globais da UI
     */
    setupGlobalUI() {
        // Configura tema
        this.setupTheme();
        
        // Configura responsividade
        this.setupResponsive();
        
        // Adiciona classes de estado
        document.body.classList.add('app-initialized');
        
        if (this.appConfig.offline) {
            document.body.classList.add('app-offline');
        }
    }

    /**
     * Configura tema da aplicação
     */
    setupTheme() {
        // Implementar configuração de tema
        const theme = localStorage.getItem('app-theme') || 'light';
        document.body.setAttribute('data-theme', theme);
    }

    /**
     * Configura responsividade
     */
    setupResponsive() {
        // Adiciona classe de dispositivo
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth <= 1024 && window.innerWidth > 768;
        
        if (isMobile) {
            document.body.classList.add('is-mobile');
        } else if (isTablet) {
            document.body.classList.add('is-tablet');
        } else {
            document.body.classList.add('is-desktop');
        }
    }

    /**
     * Manipula erros de inicialização
     */
    async handleInitializationError(error) {
        logger.error('Erro crítico na inicialização', error);
        
        // Exibe erro para usuário
        const errorMessage = `
            <div style="
                position: fixed; 
                top: 50%; 
                left: 50%; 
                transform: translate(-50%, -50%);
                background: #fff; 
                padding: 20px; 
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                max-width: 400px;
                text-align: center;
                z-index: 10000;
            ">
                <h3 style="color: #e74c3c; margin-bottom: 15px;">❌ Erro de Inicialização</h3>
                <p style="margin-bottom: 15px;">Ocorreu um erro ao inicializar a aplicação.</p>
                <p style="font-size: 0.9rem; color: #666; margin-bottom: 20px;">${error.message}</p>
                <button onclick="location.reload()" style="
                    background: #007bff; 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 4px; 
                    cursor: pointer;
                ">Tentar Novamente</button>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', errorMessage);
    }

    /**
     * Limpeza antes de fechar a aplicação
     */
    cleanup() {
        logger.info('Executando limpeza da aplicação...', '🧹 CLEANUP');
        
        // Remove listeners do StateManager
        stateManager.cleanup();
        
        // Salva dados importantes no localStorage
        this.saveAppState();
        
        logger.info('Limpeza concluída', '✅ CLEANUP');
    }

    /**
     * Salva estado da aplicação
     */
    saveAppState() {
        try {
            const appState = {
                lastSync: this.appConfig.lastSync,
                currentPage: this.currentPage,
                version: this.version,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('app-state', JSON.stringify(appState));
            
        } catch (error) {
            logger.error('Erro ao salvar estado da aplicação', error);
        }
    }

    // =========================================================================
    // MÉTODOS PÚBLICOS
    // =========================================================================

    /**
     * Obtém estado atual da aplicação
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            version: this.version,
            offline: this.appConfig.offline,
            lastSync: this.appConfig.lastSync,
            currentPage: this.currentPage,
            errors: this.appConfig.errors.length
        };
    }

    /**
     * Força atualização dos dados
     */
    async refresh() {
        notificationSystem.info('Atualizando dados...');
        
        try {
            await this.loadInitialData();
            notificationSystem.success('Dados atualizados com sucesso');
        } catch (error) {
            logger.error('Erro ao atualizar dados', error);
            notificationSystem.error('Erro ao atualizar dados');
        }
    }

    /**
     * Exporta dados para backup
     */
    async exportData() {
        try {
            const data = {
                romaneios: stateManager.getRomaneios(),
                fornecedores: stateManager.getFornecedores(),
                especies: stateManager.getEspecies(),
                exportDate: new Date().toISOString(),
                version: this.version
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `romaneios-backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            notificationSystem.success('Backup exportado com sucesso');
            logger.ui('data_exported', 'Backup completo');
            
        } catch (error) {
            logger.error('Erro ao exportar dados', error);
            notificationSystem.error('Erro ao exportar dados');
        }
    }
}

// =============================================================================
// INICIALIZAÇÃO GLOBAL
// =============================================================================

// Instância global da aplicação
let app = null;

// Função para inicializar a aplicação
function initializeApp() {
    if (app) {
        logger.warn('Aplicação já inicializada', '⚠️ APP');
        return app;
    }
    
    app = new App();
    
    // Disponibiliza globalmente para debug
    if (DEV_CONFIG.DEBUG_MODE) {
        window.app = app;
        window.stateManager = stateManager;
        window.firebaseService = firebaseService;
        window.logger = logger;
    }
    
    return app;
}

// Auto-inicialização quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default App;
export { initializeApp }; 