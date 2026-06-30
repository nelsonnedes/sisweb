/**
 * DATABASE ADAPTER - SISWEB
 * 
 * Adaptador que gerencia localStorage e Firebase de forma transparente
 * Permite migração gradual sem quebrar funcionalidades existentes
 * Detecta automaticamente melhor fonte de dados disponível
 * 
 * @author SisWeb Migration Team
 * @version 1.0.0
 * @created 2024
 */

console.log('🔧 Carregando Database Adapter...');

// Aguardar firebaseService estar disponível
function waitForFirebaseService() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 200; // 100 segundos máximo
        
        const checkService = () => {
            attempts++;
            
            if (window.firebaseService && typeof window.firebaseService === 'object') {
                console.log('✅ FirebaseService encontrado!');
                resolve(window.firebaseService);
                return;
            }
            
            if (attempts >= maxAttempts) {
                console.warn('⚠️ FirebaseService não encontrado, continuando sem Firebase');
                resolve(null);
                return;
            }
            
            if (attempts % 20 === 0) {
                console.log(`⏳ Aguardando FirebaseService... (tentativa ${attempts}/${maxAttempts})`);
            }
            
            setTimeout(checkService, 500);
        };
        
        checkService();
    });
}

/**
 * CONFIGURAÇÕES DO ADAPTADOR
 */
const ADAPTER_CONFIG = {
    // Estratégia principal: 'firebase-first', 'localStorage-first', 'hybrid'
    strategy: 'hybrid',
    
    // Cache em memória para performance
    enableMemoryCache: true,
    memoryCacheTimeout: 5 * 60 * 1000, // 5 minutos
    
    // Sincronização automática
    autoSync: true,
    syncInterval: 10 * 60 * 1000, // 10 minutos
    
    // Fallback automático
    enableFallback: true,
    fallbackTimeout: 5000, // 5 segundos
    
    // Debug e logging
    debug: true,
    logOperations: true
};

/**
 * CLASSE PRINCIPAL DO ADAPTADOR
 */
class DatabaseAdapter {
    constructor(config = {}) {
        this.config = { ...ADAPTER_CONFIG, ...config };
        this.memoryCache = new Map();
        this.syncQueue = [];
        this.isOnline = navigator.onLine;
        this.lastSyncTime = 0;
        this.firebaseService = null;
        
        // Status do sistema
        this.firebaseStatus = 'unknown';
        this.localStorageStatus = 'unknown';
        
        // Inicializar
        this.initialize();
    }

    /**
     * INICIALIZAÇÃO DO ADAPTADOR
     */
    async initialize() {
        this.log('🚀 Inicializando Database Adapter...');
        
        // Aguardar firebaseService
        this.firebaseService = await waitForFirebaseService();
        
        // Verificar disponibilidade dos serviços
        await this.checkServices();
        
        // Configurar listeners de rede
        this.setupNetworkListeners();
        
        // Listener para firebaseService
        window.addEventListener('firebaseServiceReady', (event) => {
            this.log('🎉 Evento firebaseServiceReady recebido!');
            this.firebaseService = event.detail.firebaseService;
            this.checkServices();
        });
        
        // Configurar sincronização automática
        if (this.config.autoSync) {
            this.setupAutoSync();
        }
        
        // Configurar listeners do Firebase
        this.setupFirebaseListeners();
        
        // Tentar re-verificar Firebase periodicamente até conseguir
        this.setupFirebaseRetry();
        
        this.log('✅ Database Adapter inicializado');
    }

    _resolveTenantId() {
        try {
            const svc = this.firebaseService || window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.getCurrentTenantId === 'function') {
                const t = svc.getCurrentTenantId();
                if (t) return String(t);
            }
            if (svc && typeof svc.getTenantId === 'function') {
                const t = svc.getTenantId();
                if (t) return String(t);
            }
        } catch (_) {}
        try {
            if (window.appTenantId) return String(window.appTenantId);
            if (window.companyInfo) {
                const raw = window.companyInfo;
                const id = raw.companyId || raw.companyID || raw.tenantId || raw.id;
                if (id) return String(id);
            }
            const stored = localStorage.getItem('company_info');
            if (stored) {
                const obj = JSON.parse(stored);
                const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                if (id) return String(id);
            }
        } catch (_) {}
        return null;
    }

    _canonicalBusinessKey(key) {
        const raw = String(key || '').replace(/^\/+/, '');
        const withoutTenant = raw.replace(/^companies\/[^/]+\//, '').replace(/^users\/[^/]+\//, '');
        const aliases = {
            romaneiosTora: 'romaneios/tora',
            romaneiosPct: 'romaneios/pct',
            romaneiosPCT: 'romaneios/pct',
            romaneiosTL: 'romaneios/tl',
            romaneiosTl: 'romaneios/tl',
            romaneios_tl: 'romaneios/tl',
            romaneiosPes: 'romaneios/pes',
            romaneiosPES: 'romaneios/pes',
            romaneios_pes: 'romaneios/pes'
        };
        return aliases[withoutTenant] || withoutTenant;
    }

    _isBusinessDataKey(key) {
        const normalized = this._canonicalBusinessKey(key);
        return /^(romaneios\/(tora|pct|tl|pes)(\/|$)|preromaneios(\/|$)|especies(\/|$)|fornecedores(\/|$)|clients(\/|$)|clientes(\/|$)|estoqueTorasAtual(\/|$)|movimentacoesToras(\/|$)|estoqueProdutos(\/|$)|movimentacoesProdutos(\/|$))/.test(normalized);
    }

    /**
     * VERIFICAR DISPONIBILIDADE DOS SERVIÇOS
     */
    async checkServices() {
        // Verificar localStorage
        try {
            localStorage.setItem('__test__', 'test');
            localStorage.removeItem('__test__');
            this.localStorageStatus = 'available';
            this.log('✅ localStorage disponível');
        } catch (error) {
            this.localStorageStatus = 'unavailable';
            this.log('❌ localStorage indisponível:', error.message);
        }

        // Verificar Firebase - tentar múltiplas fontes
        if (!this.firebaseService) {
            // Verificar window.firebaseService
            if (window.firebaseService && typeof window.firebaseService === 'object') {
                this.firebaseService = window.firebaseService;
                this.log('🔧 firebaseService encontrado em window.firebaseService');
            }
            // Verificar se foi definido globalmente
            else if (typeof firebaseService !== 'undefined') {
                this.firebaseService = firebaseService;
                this.log('🔧 firebaseService encontrado como global');
            }
        }

        try {
            if (this.firebaseService && typeof this.firebaseService.isFirebaseOperational === 'function') {
                const status = this.firebaseService.isFirebaseOperational();
                if (status.operational) {
                    this.firebaseStatus = 'available';
                    this.log('✅ Firebase disponível');
                } else {
                    this.firebaseStatus = 'unavailable';
                    this.log('❌ Firebase indisponível:', status.message);
                }
            } else {
                this.firebaseStatus = 'unavailable';
                this.log('❌ Firebase indisponível - Service não encontrado ou método isFirebaseOperational não disponível');
                
                // Log adicional para debug
                if (window.firebaseService) {
                    this.log('🔍 window.firebaseService existe:', typeof window.firebaseService);
                    this.log('🔍 Métodos disponíveis:', Object.getOwnPropertyNames(window.firebaseService));
                }
            }
        } catch (error) {
            this.firebaseStatus = 'error';
            this.log('❌ Erro ao verificar Firebase:', error.message);
        }
    }

    /**
     * ATUALIZAR FIREBASE SERVICE EXTERNAMENTE
     */
    updateFirebaseService(firebaseService) {
        this.firebaseService = firebaseService;
        this.log('🔧 firebaseService atualizado externamente');
        // Re-verificar serviços
        this.checkServices();
    }

    /**
     * MÉTODO PRINCIPAL: CARREGAR DADOS
     * Interface unificada que escolhe automaticamente a melhor fonte
     */
    async loadData(key) {
        const startTime = Date.now();
        this.log(`📥 Carregando dados: ${key}`);

        try {
            // 1. Verificar cache em memória primeiro
            if (this.config.enableMemoryCache) {
                const cached = this.getFromMemoryCache(key);
                if (cached) {
                    this.log(`💾 Cache hit: ${key} (${Date.now() - startTime}ms)`);
                    return {
                        success: true,
                        data: cached.data,
                        source: 'memory-cache',
                        timestamp: cached.timestamp
                    };
                }
            }

            // 2. Escolher estratégia baseada na configuração e disponibilidade
            const strategy = this.determineLoadStrategy();
            let result = null;

            switch (strategy) {
                case 'firebase-only':
                    result = await this.loadFromFirebase(key);
                    break;
                
                case 'localStorage-only':
                    result = await this.loadFromLocalStorage(key);
                    break;
                
                case 'firebase-first':
                    result = await this.loadFirebaseFirst(key);
                    break;
                
                case 'localStorage-first':
                    result = await this.loadLocalStorageFirst(key);
                    break;
                
                case 'hybrid':
                default:
                    result = await this.loadHybrid(key);
                    break;
            }

            // 3. Atualizar cache em memória se bem-sucedido
            if (result.success && result.data && this.config.enableMemoryCache) {
                this.updateMemoryCache(key, result.data);
            }

            // 4. Log do resultado
            const duration = Date.now() - startTime;
            this.log(`${result.success ? '✅' : '❌'} Carregamento ${result.success ? 'concluído' : 'falhou'}: ${key} (${duration}ms) - ${result.source}`);

            return result;

        } catch (error) {
            this.log(`❌ Erro ao carregar ${key}:`, error);
            return {
                success: false,
                error: error.message,
                source: 'error',
                data: null
            };
        }
    }

    /**
     * MÉTODO PRINCIPAL: SALVAR DADOS
     * Interface unificada que salva nos locais apropriados
     */
    async saveData(key, data, itemKey = null) {
        const startTime = Date.now();
        this.log(`💾 Salvando dados: ${key}${itemKey ? `/${itemKey}` : ''}`);

        try {
            // Sanitizar dados antes de validar
            const sanitizedData = this.sanitizeData(key, data);

            // Validar dados
            if (!this.validateData(key, sanitizedData)) {
                throw new Error('Dados inválidos para salvamento');
            }

            // Preparar dados com metadados (quando aplicável)
            const dataToSave = this.prepareDataForSaving(sanitizedData);

            // Estratégia de salvamento
            const strategy = this.determineSaveStrategy();
            let results = {
                localStorage: null,
                firebase: null,
                success: false
            };

            switch (strategy) {
                case 'both':
                    results = await this.saveToBoth(key, dataToSave, itemKey);
                    break;
                
                case 'firebase-only':
                    results.firebase = await this.saveToFirebase(key, dataToSave, itemKey);
                    results.success = results.firebase.success;
                    break;
                
                case 'localStorage-only':
                    results.localStorage = await this.saveToLocalStorage(key, dataToSave, itemKey);
                    results.success = results.localStorage.success;
                    break;
                
                case 'priority':
                default:
                    results = await this.savePriority(key, dataToSave, itemKey);
                    break;
            }

            // Atualizar cache em memória
            if (results.success && this.config.enableMemoryCache) {
                this.updateMemoryCache(key, dataToSave);
            }

            // Log do resultado
            const duration = Date.now() - startTime;
            this.log(`${results.success ? '✅' : '❌'} Salvamento ${results.success ? 'concluído' : 'falhou'}: ${key} (${duration}ms)`);

            return {
                success: results.success,
                localStorage: results.localStorage,
                firebase: results.firebase,
                key: itemKey
            };

        } catch (error) {
            this.log(`❌ Erro ao salvar ${key}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * MÉTODO PRINCIPAL: REMOVER DADOS
     */
    async removeData(key, itemKey = null) {
        const startTime = Date.now();
        this.log(`🗑️ Removendo dados: ${key}${itemKey ? `/${itemKey}` : ''}`);

        try {
            let results = {
                localStorage: null,
                firebase: null,
                success: false
            };

            // Remover de ambos os locais
            const localPromise = this.removeFromLocalStorage(key, itemKey);
            const firebasePromise = this.removeFromFirebase(key, itemKey);

            [results.localStorage, results.firebase] = await Promise.allSettled([
                localPromise,
                firebasePromise
            ]);

            // Considerar sucesso se pelo menos um local foi atualizado
            results.success = 
                (results.localStorage?.status === 'fulfilled' && results.localStorage.value?.success) ||
                (results.firebase?.status === 'fulfilled' && results.firebase.value?.success);

            // Remover do cache em memória
            this.removeFromMemoryCache(key);

            const duration = Date.now() - startTime;
            this.log(`${results.success ? '✅' : '❌'} Remoção ${results.success ? 'concluída' : 'falhou'}: ${key} (${duration}ms)`);

            return results;

        } catch (error) {
            this.log(`❌ Erro ao remover ${key}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * ESTRATÉGIAS DE CARREGAMENTO
     */
    async loadFirebaseFirst(key) {
        try {
            const firebaseResult = await this.loadFromFirebase(key);
            if (firebaseResult.success && firebaseResult.data) {
                return firebaseResult;
            }
        } catch (error) {
            this.log(`⚠️ Falha no Firebase, tentando localStorage: ${error.message}`);
        }

        return await this.loadFromLocalStorage(key);
    }

    async loadLocalStorageFirst(key) {
        try {
            const localResult = await this.loadFromLocalStorage(key);
            if (localResult.success && localResult.data) {
                return localResult;
            }
        } catch (error) {
            this.log(`⚠️ Falha no localStorage, tentando Firebase: ${error.message}`);
        }

        return await this.loadFromFirebase(key);
    }

    async loadHybrid(key) {
        // Verificar qual serviço está mais rápido/disponível
        if (this.isOnline && this.firebaseStatus === 'available') {
            return await this.loadFirebaseFirst(key);
        } else {
            return await this.loadLocalStorageFirst(key);
        }
    }

    /**
     * ESTRATÉGIAS DE SALVAMENTO
     */
    async saveToBoth(key, data, itemKey) {
        const promises = [
            this.saveToLocalStorage(key, data, itemKey),
            this.saveToFirebase(key, data, itemKey)
        ];

        const [localResult, firebaseResult] = await Promise.allSettled(promises);

        return {
            localStorage: localResult.status === 'fulfilled' ? localResult.value : { success: false, error: localResult.reason },
            firebase: firebaseResult.status === 'fulfilled' ? firebaseResult.value : { success: false, error: firebaseResult.reason },
            success: 
                (localResult.status === 'fulfilled' && localResult.value.success) ||
                (firebaseResult.status === 'fulfilled' && firebaseResult.value.success)
        };
    }

    async savePriority(key, data, itemKey) {
        // Salvar primeiro no serviço prioritário
        let primaryResult, secondaryResult;

        if (this.isOnline && this.firebaseStatus === 'available') {
            // Firebase primeiro
            primaryResult = await this.saveToFirebase(key, data, itemKey);
            if (!primaryResult.success) {
                secondaryResult = await this.saveToLocalStorage(key, data, itemKey);
            }
        } else {
            // localStorage primeiro
            primaryResult = await this.saveToLocalStorage(key, data, itemKey);
            if (this.isOnline && this.firebaseStatus === 'available') {
                secondaryResult = await this.saveToFirebase(key, data, itemKey);
            }
        }

        return {
            localStorage: primaryResult.source === 'localStorage' ? primaryResult : secondaryResult,
            firebase: primaryResult.source === 'firebase' ? primaryResult : secondaryResult,
            success: primaryResult.success || (secondaryResult && secondaryResult.success)
        };
    }

    /**
     * Carregar dados do Firebase
     */
    async loadFromFirebase(key) {
        try {
            if (!this.firebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            return await this.firebaseService.loadFromFirebase(key);
        } catch (error) {
            this.log(`❌ Erro ao carregar ${key} do Firebase:`, error);
            throw error;
        }
    }

    /**
     * Salvar dados no Firebase
     */
    async saveToFirebase(key, data, itemKey) {
        try {
            if (!this.firebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            const result = await this.firebaseService.saveToFirebase(key, itemKey, data);
            return { ...result, source: 'firebase' };
        } catch (error) {
            this.log(`❌ Erro ao salvar ${key} no Firebase:`, error);
            throw error;
        }
    }

    /**
     * Remover dados do Firebase
     */
    async removeFromFirebase(key, itemKey) {
        try {
            if (!this.firebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            return await this.firebaseService.deleteFromFirebase(key, itemKey);
        } catch (error) {
            this.log(`❌ Erro ao remover ${key} do Firebase:`, error);
            throw error;
        }
    }

    /**
     * Carregar dados do localStorage com fallback para Tracking Prevention
     */
    async loadFromLocalStorage(key) {
        try {
            if (this._isBusinessDataKey(key)) {
                return {
                    success: true,
                    data: null,
                    source: 'localStorage',
                    cached: false,
                    blockedBusinessCache: true
                };
            }
            // Verificar se localStorage está disponível
            if (!this.isLocalStorageAvailable()) {
                throw new Error('localStorage bloqueado por Tracking Prevention');
            }

            const startTime = Date.now();
            const normalizedKey = this._normalizeKey(key);
            let stored = localStorage.getItem(normalizedKey);
            const allowLegacy = !this._resolveTenantId() && normalizedKey !== key;
            if (!stored && allowLegacy) {
                stored = localStorage.getItem(key);
                if (stored !== null && stored !== undefined) {
                    try {
                        localStorage.setItem(normalizedKey, stored);
                        localStorage.removeItem(key);
                    } catch {}
                }
            }
            
            if (!stored) {
                return {
                    success: true,
                    data: null,
                    source: 'localStorage',
                    cached: false
                };
            }
            
            let data;
            try {
                data = JSON.parse(stored);
            } catch (parseError) {
                this.log(`❌ Erro ao parsear dados do localStorage para ${normalizedKey}:`, parseError);
                // Tentar limpar dados corrompidos
                localStorage.removeItem(normalizedKey);
                if (normalizedKey !== key) {
                    try { localStorage.removeItem(key); } catch {}
                }
                return {
                    success: true,
                    data: null,
                    source: 'localStorage',
                    error: 'Dados corrompidos removidos'
                };
            }

            const duration = Date.now() - startTime;
            this.log(`✅ Carregamento concluído: ${normalizedKey} (${duration}ms) - localStorage`);
            
            return {
                success: true,
                data: data,
                source: 'localStorage'
            };
            
        } catch (error) {
            this.log(`❌ Erro ao carregar do localStorage ${key}:`, error);
            
            // Fallback para memória quando localStorage é bloqueado
            if (error.message.includes('localStorage bloqueado') || 
                error.message.includes('Tracking Prevention')) {
                console.warn('⚠️ localStorage bloqueado, usando cache em memória');
                const memoryData = this.getFromMemoryCache(this._normalizeKey(key));
                return {
                    success: true,
                    data: memoryData,
                    source: 'memory-fallback',
                    note: 'localStorage bloqueado por Tracking Prevention'
                };
            }
            
            return {
                success: false,
                error: error.message,
                source: 'localStorage'
            };
        }
    }

    /**
     * Salvar dados no localStorage com fallback para Tracking Prevention
     */
    async saveToLocalStorage(key, data, itemKey) {
        try {
            if (this._isBusinessDataKey(key)) {
                return {
                    success: false,
                    source: 'localStorage',
                    blockedBusinessCache: true,
                    error: 'Cache local desabilitado para dados de negócio multiempresa'
                };
            }
            // Verificar se localStorage está disponível
            if (!this.isLocalStorageAvailable()) {
                console.warn('⚠️ localStorage bloqueado, salvando apenas em memória');
                this.updateMemoryCache(this._normalizeKey(key), data);
                return {
                    success: true,
                    source: 'memory-fallback',
                    note: 'Salvo em memória devido ao Tracking Prevention'
                };
            }

            const startTime = Date.now();
            const normalizedKey = this._normalizeKey(key);
            
            let dataToStore = data;
            
            if (itemKey) {
                // Salvar item específico
                const legacyExisting = (!this._resolveTenantId() && normalizedKey !== key) ? localStorage.getItem(key) : null;
                const existingData = JSON.parse(localStorage.getItem(normalizedKey) || legacyExisting || '{}');
                existingData[itemKey] = data;
                dataToStore = existingData;
            }
            
            const serialized = JSON.stringify(dataToStore);
            localStorage.setItem(normalizedKey, serialized);
            if (normalizedKey !== key && !this._resolveTenantId()) {
                // Espelhar na chave original para compatibilidade
                try { localStorage.setItem(key, serialized); } catch {}
            }
            
            const duration = Date.now() - startTime;
            this.log(`✅ Salvamento concluído: ${normalizedKey} (${duration}ms) - localStorage`);
            
            return {
                success: true,
                source: 'localStorage'
            };
            
        } catch (error) {
            this.log(`❌ Erro ao salvar no localStorage ${key}:`, error);
            
            // Fallback para memória quando localStorage é bloqueado
            if (error.name === 'SecurityError' || 
                error.message.includes('localStorage') ||
                error.message.includes('Tracking Prevention')) {
                console.warn('⚠️ localStorage bloqueado, salvando em memória');
                this.updateMemoryCache(this._normalizeKey(key), data);
                return {
                    success: true,
                    source: 'memory-fallback',
                    note: 'Salvo em memória devido ao Tracking Prevention'
                };
            }
            
            return {
                success: false,
                error: error.message,
                source: 'localStorage'
            };
        }
    }

    /**
     * Verificar se localStorage está disponível (não bloqueado)
     */
    isLocalStorageAvailable() {
        try {
            const testKey = '__localStorage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('⚠️ localStorage não disponível:', error.message);
            return false;
        }
    }

    /**
     * Remover dados do localStorage
     */
    async removeFromLocalStorage(key, itemKey) {
        if (this.localStorageStatus !== 'available') {
            throw new Error('localStorage não disponível');
        }

        try {
            const normalizedKey = this._normalizeKey(key);
            const allowLegacy = !this._resolveTenantId() && normalizedKey !== key;
            if (itemKey === null || itemKey === undefined) {
                localStorage.removeItem(normalizedKey);
                if (allowLegacy) {
                    try { localStorage.removeItem(key); } catch {}
                }
            } else {
                const existing = localStorage.getItem(normalizedKey) || (allowLegacy ? localStorage.getItem(key) : null);
                if (existing) {
                    const data = JSON.parse(existing);
                    
                    if (Array.isArray(data)) {
                        const index = parseInt(itemKey);
                        if (!isNaN(index) && index >= 0 && index < data.length) {
                            data.splice(index, 1);
                        }
                    } else if (typeof data === 'object') {
                        delete data[itemKey];
                    }
                    
                    localStorage.setItem(normalizedKey, JSON.stringify(data));
                    if (allowLegacy) {
                        try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
                    }
                }
            }

            return { success: true, source: 'localStorage' };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                source: 'localStorage'
            };
        }
    }

    /**
     * CACHE EM MEMÓRIA
     */
    getFromMemoryCache(key) {
        const normalizedKey = this._normalizeKey(key);
        const cached = this.memoryCache.get(normalizedKey);
        if (cached && this.isCacheValid(cached.timestamp)) {
            return cached;
        }
        return null;
    }

    updateMemoryCache(key, data) {
        const normalizedKey = this._normalizeKey(key);
        this.memoryCache.set(normalizedKey, {
            data: data,
            timestamp: Date.now()
        });
    }

    removeFromMemoryCache(key) {
        const normalizedKey = this._normalizeKey(key);
        this.memoryCache.delete(normalizedKey);
    }

    isCacheValid(timestamp) {
        return (Date.now() - timestamp) < this.config.memoryCacheTimeout;
    }

    clearMemoryCache() {
        this.memoryCache.clear();
        this.log('🧹 Cache em memória limpo');
    }

    /**
     * UTILITÁRIOS E VALIDAÇÃO
     */
    validateData(key, data) {
        if (data === null || data === undefined) {
            return false;
        }

        // Para arrays, validar cada item
        if (Array.isArray(data)) {
            if (data.length === 0) {
                return true; // Array vazio é válido
            }
            return data.every(item => this.validateSingleItem(key, item));
        }

        // Para objetos únicos
        return this.validateSingleItem(key, data);
    }

    validateSingleItem(key, item) {
        if (!item || typeof item !== 'object') {
            return false;
        }

        // Validações específicas por tipo de chave
        if (key === 'clients' || key === 'fornecedores') {
            return this.validateClientData(item);
        } else if (this.isSpeciesKey(key)) {
            return this.validateSpeciesData(item);
        } else if (key.includes('romaneio')) {
            return this.validateRomaneioData(item);
        }

        return true; // Para outros tipos, aceitar por padrão
    }

    validateClientData(data) {
        // Cliente deve ter nome ou razão social
        return data && (data.nome || data.name || data.razaoSocial);
    }

    validateSpeciesData(data) {
        // Espécie deve ter nome
        return data && (data.especie || data.nome || data.name);
    }

    isSpeciesKey(key) {
        const normalized = String(key || '').toLowerCase().replace(/^company_[^_]+__/, '');
        return normalized === 'species'
            || normalized === 'especies'
            || normalized === 'especiespct'
            || normalized === 'data/species';
    }

    normalizeSpeciesItem(item) {
        const source = item && typeof item === 'object' ? item : {};
        const name = String(source.especie || source.nome || source.name || source.nomeComum || source.commonName || '').trim();
        const scientificName = String(
            source.nomeCientifico ||
            source.scientificName ||
            source.scientific ||
            source.descricao ||
            source.description ||
            source.decription ||
            source.desc ||
            ''
        ).trim();
        const excluded = new Set(['key', 'firebaseKey', 'nome', 'name', 'nomeComum', 'commonName', 'description', 'descricao', 'decription', 'desc', 'scientificName', 'scientific', 'nomeCientífico']);
        const clean = {};
        Object.keys(source).forEach((field) => {
            if (field.startsWith('__') || excluded.has(field)) return;
            if (source[field] !== undefined) clean[field] = source[field];
        });
        clean.id = source.id || source.key || source.firebaseKey || clean.id;
        clean.especie = name;
        clean.nomeCientifico = scientificName;
        clean.ativo = source.ativo !== false;
        clean.createdAt = source.createdAt || source.created || clean.createdAt || new Date().toISOString();
        clean.updatedAt = source.updatedAt || source.updated || new Date().toISOString();
        return clean;
    }

    validateRomaneioData(data) {
        // Romaneio deve ter numero, id ou data
        return data && (data.numero || data.id || data.data);
    }

    // Normalização de chave baseada no serviço unificado
    _normalizeKey(key) {
        try {
            if (this.firebaseService && typeof this.firebaseService.getFirebasePath === 'function') {
                const path = this.firebaseService.getFirebasePath(key);
                const parts = String(path).split('/');
                const base = parts[parts.length - 1] || key;
                const idxCompany = parts.indexOf('companies');
                const idxUser = parts.indexOf('users');
                const tenantFromPath = idxCompany >= 0 ? parts[idxCompany + 1] : (idxUser >= 0 ? parts[idxUser + 1] : null);
                const tenantType = idxCompany >= 0 ? 'company' : (idxUser >= 0 ? 'user' : null);
                const tenant = this._resolveTenantId() || tenantFromPath;
                if (tenant) {
                    const t = String(tenant);
                    if (String(base).startsWith(`company_${t}__`) || String(base).startsWith(`user_${t}__`)) {
                        return base;
                    }
                    if (tenantType === 'user') {
                        return `user_${t}__${base}`;
                    }
                    return `company_${t}__${base}`;
                }
                return base;
            }
        } catch (e) {
        }
        const raw = String(key);
        const parts = raw.split('/');
        const idxCompany = parts.indexOf('companies');
        const idxUser = parts.indexOf('users');
        const tenantFromPath = idxCompany >= 0 ? parts[idxCompany + 1] : (idxUser >= 0 ? parts[idxUser + 1] : null);
        const tenantType = idxCompany >= 0 ? 'company' : (idxUser >= 0 ? 'user' : null);
        const base = parts[parts.length - 1] || raw;
        const tenant = this._resolveTenantId() || tenantFromPath;
        if (tenant) {
            const t = String(tenant);
            if (String(base).startsWith(`company_${t}__`) || String(base).startsWith(`user_${t}__`)) {
                return base;
            }
            if (tenantType === 'user') {
                return `user_${t}__${base}`;
            }
            return `company_${t}__${base}`;
        }
        return base || raw;
    }

    prepareDataForSaving(data) {
        // Não modificar arrays; mantê-los íntegros
        if (Array.isArray(data)) {
            return data;
        }

        // Para objetos, anexar metadados leves
        if (data && typeof data === 'object') {
            return {
                ...data,
                _metadata: {
                    savedAt: new Date().toISOString(),
                    version: '1.0',
                    adapter: 'DatabaseAdapter'
                }
            };
        }

        // Tipos primitivos não devem ocorrer; retornar como está
        return data;
    }

    /**
     * Sanitização de dados para evitar rejeição total por itens inválidos
     */
    sanitizeData(key, data) {
        try {
            if (data === null || data === undefined) {
                return [];
            }

            // Normalizar chave para comparações (ex.: especies/species)
            const normalizedKey = (key || '').toLowerCase();
            const isSpecies = this.isSpeciesKey(key);

            // Arrays: filtrar itens inválidos
            if (Array.isArray(data)) {
                const validItems = [];
                const invalidItems = [];

                for (const item of data) {
                    if (this.validateSingleItem(normalizedKey, item)) {
                        validItems.push(isSpecies ? this.normalizeSpeciesItem(item) : item);
                    } else {
                        invalidItems.push(item);
                    }
                }

                if (invalidItems.length > 0) {
                    this.log(`⚠️ ${invalidItems.length} itens inválidos removidos ao salvar ${key}`);
                }

                return validItems; // pode ser vazio; vazio é válido
            }

            // Objetos: tentar correção mínima para species/especies
            if (data && typeof data === 'object') {
                if (isSpecies) {
                    const nome = data.especie || data.nome || data.name || null;
                    if (typeof nome === 'string' && nome.trim().length > 0) {
                        return this.normalizeSpeciesItem({ ...data, nome: nome.trim() });
                    }
                    return [];
                }

                // Para outros objetos, retornar como está
                return data;
            }

            // Tipos primitivos: encapsular em array para não quebrar estruturas
            this.log(`⚠️ Tipo primitivo recebido em ${key} (${typeof data}). Encapsulando em array.`);
            return [data];
        } catch (e) {
            this.log(`⚠️ Erro na sanitização de ${key}: ${e.message}`);
            return data;
        }
    }

    /**
     * DETERMINAÇÃO DE ESTRATÉGIAS
     */
    determineLoadStrategy() {
        if (this.config.strategy === 'firebase-first' && this.firebaseStatus === 'available') {
            return 'firebase-first';
        } else if (this.config.strategy === 'localStorage-first' && this.localStorageStatus === 'available') {
            return 'localStorage-first';
        } else if (this.firebaseStatus === 'available' && this.localStorageStatus === 'available') {
            return 'hybrid';
        } else if (this.firebaseStatus === 'available') {
            return 'firebase-only';
        } else if (this.localStorageStatus === 'available') {
            return 'localStorage-only';
        } else {
            throw new Error('Nenhum serviço de armazenamento disponível');
        }
    }

    determineSaveStrategy() {
        if (this.firebaseStatus === 'available' && this.localStorageStatus === 'available') {
            return this.isOnline ? 'both' : 'localStorage-only';
        } else if (this.firebaseStatus === 'available') {
            return 'firebase-only';
        } else if (this.localStorageStatus === 'available') {
            return 'localStorage-only';
        } else {
            throw new Error('Nenhum serviço de armazenamento disponível');
        }
    }

    /**
     * SINCRONIZAÇÃO E LISTENERS
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.log('🌐 Conectado à internet');
            this.checkServices();
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.log('📴 Desconectado da internet');
        });
    }

    setupFirebaseListeners() {
        window.addEventListener('firebaseConnectionChange', (event) => {
            const connected = event.detail.connected;
            this.firebaseStatus = connected ? 'available' : 'unavailable';
            this.log(`🔥 Firebase: ${connected ? 'conectado' : 'desconectado'}`);
        });
    }

    setupAutoSync() {
        setInterval(() => {
            if (this.isOnline && this.firebaseStatus === 'available') {
                this.syncData();
            }
        }, this.config.syncInterval);
    }

    async syncData() {
        if (Date.now() - this.lastSyncTime < this.config.syncInterval) {
            return; // Evitar sync muito frequente
        }

        this.log('🔄 Iniciando sincronização automática...');
        this.lastSyncTime = Date.now();

        // Implementar lógica de sincronização específica aqui
        // Por exemplo, comparar timestamps e sincronizar dados desatualizados
    }

    async processSyncQueue() {
        if (this.syncQueue.length === 0) return;

        this.log(`🔄 Processando ${this.syncQueue.length} operações na fila de sincronização`);

        const operations = [...this.syncQueue];
        this.syncQueue = [];

        for (const operation of operations) {
            try {
                await this.executeQueuedOperation(operation);
            } catch (error) {
                this.log(`⚠️ Erro ao processar operação da fila:`, error);
                // Re-adicionar à fila se necessário
                this.syncQueue.push(operation);
            }
        }
    }

    async executeQueuedOperation(operation) {
        const { type, key, data, itemKey } = operation;

        switch (type) {
            case 'save':
                return await this.saveData(key, data, itemKey);
            case 'remove':
                return await this.removeData(key, itemKey);
            default:
                throw new Error(`Tipo de operação desconhecido: ${type}`);
        }
    }

    /**
     * LOGGING E DEBUG
     */
    log(message, ...args) {
        if (this.config.debug) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [DatabaseAdapter] ${message}`, ...args);
        }
    }

    /**
     * INFORMAÇÕES E STATUS
     */
    getStatus() {
        return {
            adapter: {
                version: '1.0.0',
                strategy: this.config.strategy
            },
            services: {
                localStorage: this.localStorageStatus,
                firebase: this.firebaseStatus
            },
            network: {
                online: this.isOnline
            },
            cache: {
                memoryEntries: this.memoryCache.size,
                enabled: this.config.enableMemoryCache
            },
            sync: {
                lastSync: this.lastSyncTime,
                queueSize: this.syncQueue.length,
                autoSync: this.config.autoSync
            }
        };
    }

    /**
     * CLEANUP
     */
    cleanup() {
        this.clearMemoryCache();
        this.syncQueue = [];
        this.log('🧹 Database Adapter cleanup realizado');
    }

    /**
     * CONFIGURAR RETRY PERIÓDICO PARA FIREBASE
     */
    setupFirebaseRetry() {
        if (this.firebaseStatus !== 'available') {
            const retryInterval = setInterval(async () => {
                this.log('🔄 Re-verificando status do Firebase...');
                await this.checkServices();
                
                if (this.firebaseStatus === 'available') {
                    this.log('✅ Firebase agora disponível! Parando retry.');
                    clearInterval(retryInterval);
                }
            }, 3000); // Verificar a cada 3 segundos
            
            // Parar retry após 1 minuto
            setTimeout(() => {
                clearInterval(retryInterval);
                this.log('⏱️ Timeout de retry do Firebase atingido');
            }, 60000);
        }
    }
}

/**
 * INSTÂNCIA SINGLETON DO ADAPTADOR
 */
const databaseAdapter = new DatabaseAdapter();

/**
 * FUNÇÕES DE CONVENIÊNCIA PARA COMPATIBILIDADE
 */
const dbAdapter = {
    // Interface principal
    load: (key) => databaseAdapter.loadData(key),
    save: (key, data, itemKey = null) => databaseAdapter.saveData(key, data, itemKey),
    remove: (key, itemKey = null) => databaseAdapter.removeData(key, itemKey),
    
    // Informações
    status: () => databaseAdapter.getStatus(),
    
    // Cache
    clearCache: () => databaseAdapter.clearMemoryCache(),
    
    // Configuração
    setStrategy: (strategy) => {
        databaseAdapter.config.strategy = strategy;
        databaseAdapter.log(`🔧 Estratégia alterada para: ${strategy}`);
    }
};

/**
 * DISPONIBILIZAR GLOBALMENTE
 */
if (typeof window !== 'undefined') {
    window.databaseAdapter = databaseAdapter;
    window.dbAdapter = dbAdapter;
    console.log('🌐 Database Adapter disponível globalmente');
}

console.log('🚀 Database Adapter carregado');
