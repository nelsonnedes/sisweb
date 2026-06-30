/**
 * SISTEMA DE GERENCIAMENTO DE ESTADO REATIVO
 * Gerencia estado da aplicação com sincronização Firebase
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import firebaseService from './firebaseService.js';
import { FIREBASE_CONFIG, UI_CONFIG } from '../constants/app-constants.js';
import logger from '../utils/logger.js';
import { formatters } from '../utils/formatters.js';
import { processRomaneio } from '../utils/calculations.js';

// =============================================================================
// TIPOS DE EVENTO
// =============================================================================
const EVENT_TYPES = {
    ROMANEIOS_UPDATED: 'romaneios_updated',
    ROMANEIO_SELECTED: 'romaneio_selected',
    FORNECEDORES_UPDATED: 'fornecedores_updated',
    ESPECIES_UPDATED: 'especies_updated',
    LOADING_CHANGED: 'loading_changed',
    ERROR_OCCURRED: 'error_occurred',
    SUCCESS_MESSAGE: 'success_message',
    DATA_SYNCED: 'data_synced'
};

// =============================================================================
// CLASSE PRINCIPAL DO STATE MANAGER
// =============================================================================

class StateManager {
    constructor() {
        this.state = {
            // Dados principais
            romaneios: [],
            fornecedores: [],
            especies: [],
            
            // Estado da UI
            currentRomaneio: null,
            selectedRomaneioId: null,
            
            // Estados de carregamento
            loading: {
                romaneios: false,
                fornecedores: false,
                especies: false,
                saving: false
            },
            
            // Mensagens e erros
            lastError: null,
            lastSuccessMessage: null,
            
            // Configurações
            filters: {
                dataInicio: null,
                dataFim: null,
                fornecedor: null
            },
            
            // Cache e sincronização
            lastSync: null,
            isOnline: true
        };

        // Sistema de eventos
        this.listeners = new Map();
        this.firebaseListeners = new Map();
        
        // Inicialização
        this.initialize();
    }

    /**
     * Inicializa o gerenciador de estado
     */
    async initialize() {
        try {
            logger.info('Inicializando State Manager...', '🎯 STATE');
            
            // Carrega dados iniciais
            await this.loadInitialData();
            
            // Configura listeners do Firebase
            this.setupFirebaseListeners();
            
            logger.success('State Manager inicializado', '🎯 STATE');
        } catch (error) {
            logger.error('Erro ao inicializar State Manager', '🎯 STATE', error);
        }
    }

    // =========================================================================
    // SISTEMA DE EVENTOS
    // =========================================================================

    /**
     * Adiciona listener para evento
     */
    on(eventType, callback) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        
        this.listeners.get(eventType).push(callback);
        logger.debug(`Listener adicionado: ${eventType}`, '🎯 STATE');
        
        // Retorna função para remover listener
        return () => this.off(eventType, callback);
    }

    /**
     * Remove listener
     */
    off(eventType, callback) {
        const callbacks = this.listeners.get(eventType);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
                logger.debug(`Listener removido: ${eventType}`, '🎯 STATE');
            }
        }
    }

    /**
     * Emite evento para todos os listeners
     */
    emit(eventType, data = null) {
        const callbacks = this.listeners.get(eventType) || [];
        
        callbacks.forEach(callback => {
            try {
                callback(data, this.state);
            } catch (error) {
                logger.error(`Erro no listener ${eventType}`, '🎯 STATE', error);
            }
        });
        
        logger.debug(`Evento emitido: ${eventType}`, '🎯 STATE', data);
    }

    // =========================================================================
    // GETTERS DE ESTADO
    // =========================================================================

    /**
     * Obtém estado completo
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Obtém romaneios com formatação
     */
    getRomaneios() {
        return this.state.romaneios.map(romaneio => ({
            ...romaneio,
            formatted: formatters.romaneio(romaneio)
        }));
    }

    /**
     * Obtém romaneio atual
     */
    getCurrentRomaneio() {
        return this.state.currentRomaneio;
    }

    /**
     * Obtém fornecedores
     */
    getFornecedores() {
        return this.state.fornecedores;
    }

    /**
     * Obtém espécies
     */
    getEspecies() {
        return this.state.especies;
    }

    /**
     * Verifica se está carregando
     */
    isLoading(type = null) {
        if (type) {
            return this.state.loading[type] || false;
        }
        return Object.values(this.state.loading).some(loading => loading);
    }

    /**
     * Obtém último erro
     */
    getLastError() {
        return this.state.lastError;
    }

    // =========================================================================
    // OPERAÇÕES COM ROMANEIOS
    // =========================================================================

    /**
     * Carrega romaneios com filtros
     */
    async loadRomaneios(filters = {}) {
        try {
            this.setLoading('romaneios', true);
            logger.startPerformance('load_romaneios');

            // Atualiza filtros
            this.state.filters = { ...this.state.filters, ...filters };

            // Busca romaneios
            const romaneios = await firebaseService.getRomaneios(this.state.filters);
            
            // Processa romaneios (calcula volumes e valores)
            const processedRomaneios = romaneios.map(romaneio => processRomaneio(romaneio));

            // Atualiza estado
            this.state.romaneios = processedRomaneios;
            this.state.lastSync = new Date();

            // Emite evento
            this.emit(EVENT_TYPES.ROMANEIOS_UPDATED, processedRomaneios);

            logger.endPerformance('load_romaneios');
            logger.success(`${romaneios.length} romaneios carregados`, '🎯 STATE');
            
            return processedRomaneios;
        } catch (error) {
            this.handleError('Erro ao carregar romaneios', error);
            return [];
        } finally {
            this.setLoading('romaneios', false);
        }
    }

    /**
     * Salva romaneio
     */
    async saveRomaneio(romaneio) {
        try {
            this.setLoading('saving', true);
            logger.startPerformance('save_romaneio');

            // Processa romaneio antes de salvar
            const processedRomaneio = processRomaneio(romaneio);

            // Salva no Firebase
            const savedRomaneio = await firebaseService.saveRomaneio(processedRomaneio);

            // Atualiza estado local
            if (romaneio.id) {
                // Atualização
                const index = this.state.romaneios.findIndex(r => r.id === romaneio.id);
                if (index > -1) {
                    this.state.romaneios[index] = savedRomaneio;
                }
            } else {
                // Novo romaneio
                this.state.romaneios.unshift(savedRomaneio);
            }

            // Atualiza romaneio atual se necessário
            if (this.state.selectedRomaneioId === savedRomaneio.id) {
                this.state.currentRomaneio = savedRomaneio;
            }

            // Emite eventos
            this.emit(EVENT_TYPES.ROMANEIOS_UPDATED, this.state.romaneios);
            this.showSuccessMessage(`Romaneio ${romaneio.id ? 'atualizado' : 'criado'} com sucesso!`);

            logger.endPerformance('save_romaneio');
            return savedRomaneio;
        } catch (error) {
            this.handleError('Erro ao salvar romaneio', error);
            throw error;
        } finally {
            this.setLoading('saving', false);
        }
    }

    /**
     * Seleciona romaneio atual
     */
    async selectRomaneio(id) {
        try {
            if (this.state.selectedRomaneioId === id && this.state.currentRomaneio) {
                // Já está selecionado
                return this.state.currentRomaneio;
            }

            this.setLoading('saving', true);

            // Busca romaneio
            let romaneio = this.state.romaneios.find(r => r.id === id);
            
            if (!romaneio) {
                // Busca no Firebase se não estiver no estado local
                romaneio = await firebaseService.getRomaneio(id);
                if (romaneio) {
                    romaneio = processRomaneio(romaneio);
                }
            }

            if (romaneio) {
                this.state.selectedRomaneioId = id;
                this.state.currentRomaneio = romaneio;
                this.emit(EVENT_TYPES.ROMANEIO_SELECTED, romaneio);
                logger.info(`Romaneio selecionado: ${id}`, '🎯 STATE');
            } else {
                logger.warn(`Romaneio não encontrado: ${id}`, '🎯 STATE');
            }

            return romaneio;
        } catch (error) {
            this.handleError('Erro ao selecionar romaneio', error);
            return null;
        } finally {
            this.setLoading('saving', false);
        }
    }

    /**
     * Deleta romaneio
     */
    async deleteRomaneio(id) {
        try {
            this.setLoading('saving', true);

            // Deleta no Firebase
            const success = await firebaseService.deleteRomaneio(id);

            if (success) {
                // Remove do estado local
                this.state.romaneios = this.state.romaneios.filter(r => r.id !== id);

                // Limpa seleção se necessário
                if (this.state.selectedRomaneioId === id) {
                    this.state.selectedRomaneioId = null;
                    this.state.currentRomaneio = null;
                    this.emit(EVENT_TYPES.ROMANEIO_SELECTED, null);
                }

                // Emite eventos
                this.emit(EVENT_TYPES.ROMANEIOS_UPDATED, this.state.romaneios);
                this.showSuccessMessage('Romaneio excluído com sucesso!');

                logger.success(`Romaneio deletado: ${id}`, '🎯 STATE');
                return true;
            }

            return false;
        } catch (error) {
            this.handleError('Erro ao excluir romaneio', error);
            return false;
        } finally {
            this.setLoading('saving', false);
        }
    }

    // =========================================================================
    // OPERAÇÕES COM FORNECEDORES
    // =========================================================================

    /**
     * Carrega fornecedores
     */
    async loadFornecedores() {
        try {
            this.setLoading('fornecedores', true);

            const fornecedores = await firebaseService.getFornecedores();
            this.state.fornecedores = fornecedores;

            this.emit(EVENT_TYPES.FORNECEDORES_UPDATED, fornecedores);
            logger.success(`${fornecedores.length} fornecedores carregados`, '🎯 STATE');

            return fornecedores;
        } catch (error) {
            this.handleError('Erro ao carregar fornecedores', error);
            return [];
        } finally {
            this.setLoading('fornecedores', false);
        }
    }

    /**
     * Salva fornecedor
     */
    async saveFornecedor(fornecedor) {
        try {
            const savedFornecedor = await firebaseService.saveFornecedor(fornecedor);

            // Atualiza estado local
            if (fornecedor.id) {
                const index = this.state.fornecedores.findIndex(f => f.id === fornecedor.id);
                if (index > -1) {
                    this.state.fornecedores[index] = savedFornecedor;
                }
            } else {
                this.state.fornecedores.push(savedFornecedor);
                this.state.fornecedores.sort((a, b) => a.nome.localeCompare(b.nome));
            }

            this.emit(EVENT_TYPES.FORNECEDORES_UPDATED, this.state.fornecedores);
            this.showSuccessMessage(`Fornecedor ${fornecedor.id ? 'atualizado' : 'criado'} com sucesso!`);

            return savedFornecedor;
        } catch (error) {
            this.handleError('Erro ao salvar fornecedor', error);
            throw error;
        }
    }

    // =========================================================================
    // OPERAÇÕES COM ESPÉCIES
    // =========================================================================

    /**
     * Carrega espécies
     */
    async loadEspecies() {
        try {
            this.setLoading('especies', true);

            const especies = await firebaseService.getEspecies();
            this.state.especies = especies;

            this.emit(EVENT_TYPES.ESPECIES_UPDATED, especies);
            logger.success(`${especies.length} espécies carregadas`, '🎯 STATE');

            return especies;
        } catch (error) {
            this.handleError('Erro ao carregar espécies', error);
            return [];
        } finally {
            this.setLoading('especies', false);
        }
    }

    /**
     * Salva espécie
     */
    async saveEspecie(especie) {
        try {
            const savedEspecie = await firebaseService.saveEspecie(especie);

            // Atualiza estado local
            if (especie.id) {
                const index = this.state.especies.findIndex(e => e.id === especie.id);
                if (index > -1) {
                    this.state.especies[index] = savedEspecie;
                }
            } else {
                this.state.especies.push(savedEspecie);
                this.state.especies.sort((a, b) => String(a.especie || a.nome || '').localeCompare(String(b.especie || b.nome || '')));
            }

            this.emit(EVENT_TYPES.ESPECIES_UPDATED, this.state.especies);
            this.showSuccessMessage(`Espécie ${especie.id ? 'atualizada' : 'criada'} com sucesso!`);

            return savedEspecie;
        } catch (error) {
            this.handleError('Erro ao salvar espécie', error);
            throw error;
        }
    }

    // =========================================================================
    // UTILITÁRIOS DE ESTADO
    // =========================================================================

    /**
     * Define estado de carregamento
     */
    setLoading(type, isLoading) {
        this.state.loading[type] = isLoading;
        this.emit(EVENT_TYPES.LOADING_CHANGED, {
            type,
            isLoading,
            allLoading: this.state.loading
        });
    }

    /**
     * Trata erros
     */
    handleError(message, error) {
        this.state.lastError = {
            message,
            error: error.message || error,
            timestamp: new Date()
        };

        this.emit(EVENT_TYPES.ERROR_OCCURRED, this.state.lastError);
        logger.error(message, '🎯 STATE', error);
    }

    /**
     * Mostra mensagem de sucesso
     */
    showSuccessMessage(message) {
        this.state.lastSuccessMessage = {
            message,
            timestamp: new Date()
        };

        this.emit(EVENT_TYPES.SUCCESS_MESSAGE, this.state.lastSuccessMessage);
        logger.success(message, '🎯 STATE');
    }

    /**
     * Limpa mensagens
     */
    clearMessages() {
        this.state.lastError = null;
        this.state.lastSuccessMessage = null;
    }

    // =========================================================================
    // CONFIGURAÇÃO DOS LISTENERS FIREBASE
    // =========================================================================

    /**
     * Configura listeners em tempo real do Firebase
     */
    setupFirebaseListeners() {
        // Listener para romaneios
        const romaneiosListener = firebaseService.addListener(
            FIREBASE_CONFIG.COLLECTIONS.ROMANEIOS_TORA,
            (romaneios) => {
                const processedRomaneios = romaneios.map(r => processRomaneio(r));
                this.state.romaneios = processedRomaneios;
                this.state.lastSync = new Date();
                this.emit(EVENT_TYPES.ROMANEIOS_UPDATED, processedRomaneios);
                this.emit(EVENT_TYPES.DATA_SYNCED, { collection: 'romaneios', count: romaneios.length });
            }
        );

        // Listener para fornecedores
        const fornecedoresListener = firebaseService.addListener(
            FIREBASE_CONFIG.COLLECTIONS.FORNECEDORES,
            (fornecedores) => {
                this.state.fornecedores = fornecedores;
                this.emit(EVENT_TYPES.FORNECEDORES_UPDATED, fornecedores);
                this.emit(EVENT_TYPES.DATA_SYNCED, { collection: 'fornecedores', count: fornecedores.length });
            }
        );

        // Listener para espécies
        const especiesListener = firebaseService.addListener(
            FIREBASE_CONFIG.COLLECTIONS.ESPECIES,
            (especies) => {
                this.state.especies = especies;
                this.emit(EVENT_TYPES.ESPECIES_UPDATED, especies);
                this.emit(EVENT_TYPES.DATA_SYNCED, { collection: 'especies', count: especies.length });
            }
        );

        // Armazena listeners
        this.firebaseListeners.set('romaneios', romaneiosListener);
        this.firebaseListeners.set('fornecedores', fornecedoresListener);
        this.firebaseListeners.set('especies', especiesListener);

        logger.success('Listeners Firebase configurados', '🎯 STATE');
    }

    /**
     * Carrega dados iniciais
     */
    async loadInitialData() {
        try {
            logger.group('🚀 Carregando dados iniciais', true);

            // Carrega dados em paralelo
            const [romaneios, fornecedores, especies] = await Promise.all([
                this.loadRomaneios(),
                this.loadFornecedores(),
                this.loadEspecies()
            ]);

            logger.success(`Dados carregados: ${romaneios.length} romaneios, ${fornecedores.length} fornecedores, ${especies.length} espécies`);
            logger.groupEnd();

        } catch (error) {
            logger.groupEnd();
            this.handleError('Erro ao carregar dados iniciais', error);
        }
    }

    /**
     * Aplica filtros aos romaneios
     */
    applyFilters(filters) {
        this.state.filters = { ...this.state.filters, ...filters };
        return this.loadRomaneios();
    }

    /**
     * Limpa filtros
     */
    clearFilters() {
        this.state.filters = {
            dataInicio: null,
            dataFim: null,
            fornecedor: null
        };
        return this.loadRomaneios();
    }

    /**
     * Força sincronização com Firebase
     */
    async syncWithFirebase() {
        logger.info('Sincronizando com Firebase...', '🎯 STATE');
        return this.loadInitialData();
    }

    /**
     * Limpa recursos
     */
    cleanup() {
        // Remove listeners do Firebase
        this.firebaseListeners.forEach((listenerId, collection) => {
            firebaseService.removeListener(listenerId);
        });
        this.firebaseListeners.clear();

        // Remove listeners locais
        this.listeners.clear();

        logger.info('State Manager cleanup realizado', '🎯 STATE');
    }
}

// =============================================================================
// INSTÂNCIA GLOBAL
// =============================================================================
const stateManager = new StateManager();

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default stateManager;

// Exportar eventos para facilitar uso
export { EVENT_TYPES };

// Exportar métodos principais
export const {
    on,
    off,
    getState,
    getRomaneios,
    getCurrentRomaneio,
    getFornecedores,
    getEspecies,
    isLoading,
    getLastError,
    loadRomaneios,
    saveRomaneio,
    selectRomaneio,
    deleteRomaneio,
    loadFornecedores,
    saveFornecedor,
    loadEspecies,
    saveEspecie,
    applyFilters,
    clearFilters,
    syncWithFirebase,
    clearMessages
} = stateManager;
