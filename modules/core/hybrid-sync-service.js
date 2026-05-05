/**
 * ⚡ HYBRID SYNC SERVICE - CARREGAMENTO INSTANTÂNEO
 * 
 * Sistema híbrido de sincronização que prioriza velocidade sobre tudo:
 * - CARREGAMENTO INSTANTÂNEO do localStorage (0ms)
 * - Sincronização Firebase em background (não bloqueia UI)
 * - Atualização inteligente sem recarregar página
 * - Cache agressivo com TTL configurável
 * - Sincronização bidirecional automática
 * 
 * 🎯 OBJETIVO: Dashboard carregando em < 100ms
 * 
 * @version 3.0.0 - Ultra Performance
 * @author Sistema Modular SISWEB
 */

class HybridSyncService {
    constructor() {
        // ⚡ CONFIGURAÇÕES ULTRA PERFORMANCE
        this.config = {
            // Cache agressivo - dados ficam válidos por mais tempo
            cacheTimeout: 15 * 60 * 1000, // 15 minutos (3x mais que antes)
            
            // Sync inteligente - só sincroniza quando necessário
            syncInterval: 5 * 60 * 1000, // 5 minutos (background sync)
            
            // Carregamento instantâneo
            instantLoad: true,
            
            // Retry mais agressivo
            maxRetries: 3,
            retryDelay: 1000, // 1 segundo
            
            // Batch operations para melhor performance
            batchSize: 10,
            batchDelay: 100, // 100ms entre batches
            
            // Debug mode
            debugMode: false
        };

        // 🧠 ESTADO DO SISTEMA
        this.state = {
            isOnline: navigator.onLine,
            isFirebaseReady: false,
            isSyncing: false,
            lastSync: null,
            syncQueue: new Map(),
            cache: new Map(),
            pendingOperations: new Map(),
            subscribers: new Map()
        };

        // 📊 MÉTRICAS DE PERFORMANCE
        this.metrics = {
            loadTimes: new Map(),
            syncTimes: new Map(),
            cacheHits: 0,
            cacheMisses: 0,
            syncOperations: 0,
            errors: 0
        };

        this.init();
    }

    /**
     * 🚀 INICIALIZAÇÃO ULTRA RÁPIDA
     */
    async init() {
        const startTime = performance.now();
        
        if (this.config.debugMode) console.log('⚡ Inicializando Hybrid Sync Service...');
        
        // Setup de eventos de rede
        this.setupNetworkListeners();
        
        // Inicializar Firebase em background (não bloqueia)
        this.initFirebaseBackground();
        
        // Configurar sync automático
        this.setupAutoSync();
        
        // Limpar cache expirado
        this.cleanExpiredCache();
        
        const initTime = performance.now() - startTime;
        if (this.config.debugMode) console.log(`⚡ Hybrid Sync inicializado em ${initTime.toFixed(2)}ms`);
    }

    /**
     * 🔥 INICIALIZAR FIREBASE EM BACKGROUND
     */
    async initFirebaseBackground() {
        // Não espera Firebase - roda em background
        setTimeout(async () => {
            try {
                if (window.firebaseServiceTL && window.firebaseServiceTL.isFirebaseAvailable) {
                    this.state.isFirebaseReady = true;
                    if (this.config.debugMode) console.log('🔥 Firebase pronto em background');
                    
                    // Processar fila de sync quando Firebase fica pronto
                    this.processSyncQueue();
                } else {
                    // Tentar novamente em 2 segundos
                    setTimeout(() => this.initFirebaseBackground(), 2000);
                }
            } catch (error) {
                console.warn('⚠️ Firebase não disponível:', error.message);
            }
        }, 100); // 100ms delay para não bloquear carregamento
    }

    /**
     * ⚡ CARREGAMENTO INSTANTÂNEO (CACHE-FIRST)
     */
    async loadInstant(key) {
        const startTime = performance.now();
        const scopedKey = this.resolveNamespacedKey(key);
        
        try {
            const cached = this.getFromMemoryCache(scopedKey);
            if (cached) {
                this.metrics.cacheHits++;
                const loadTime = performance.now() - startTime;
                this.metrics.loadTimes.set(scopedKey, loadTime);
                
                if (this.config.debugMode) console.log(`⚡ Cache hit para ${scopedKey} em ${loadTime.toFixed(2)}ms`);
                
                this.checkBackgroundSync(scopedKey, cached);
                
                return cached.data;
            }

            const localData = this.getFromLocalStorage(scopedKey);
            if (localData) {
                this.metrics.cacheHits++;
                
                this.setMemoryCache(scopedKey, localData);
                
                const loadTime = performance.now() - startTime;
                this.metrics.loadTimes.set(scopedKey, loadTime);
                
                if (this.config.debugMode) console.log(`📦 localStorage hit para ${scopedKey} em ${loadTime.toFixed(2)}ms`);
                
                this.checkBackgroundSync(scopedKey, { data: localData, timestamp: Date.now() });
                
                return localData;
            }

            this.metrics.cacheMisses++;
            
            if (this.config.debugMode) console.log(`🔍 Cache miss para ${scopedKey}, tentando Firebase...`);
            
            if (!this.state.isFirebaseReady) {
                this.scheduleFirebaseLoad(scopedKey);
                return null;
            }

            return await this.loadFromFirebase(scopedKey);

        } catch (error) {
            this.metrics.errors++;
            console.error(`❌ Erro no carregamento instantâneo de ${scopedKey}:`, error);
            return null;
        }
    }

    /**
     * 🧠 CACHE EM MEMÓRIA
     */
    getFromMemoryCache(key) {
        const cached = this.state.cache.get(key);
        if (!cached) return null;

        // Verificar se não expirou
        if (Date.now() - cached.timestamp > this.config.cacheTimeout) {
            this.state.cache.delete(key);
            return null;
        }

        return cached;
    }

    setMemoryCache(key, data) {
        this.state.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * 📦 LOCALSTORAGE OTIMIZADO
     */
    resolveNamespacedKey(key) {
        try {
            const base = String(key || '');
            if (!base) return base;
            if (window.firebaseServiceTL && typeof window.firebaseServiceTL.getNamespacedPath === 'function') {
                const ns = window.firebaseServiceTL.getNamespacedPath(base);
                return ns || `companies/__no_tenant__/${base}`;
            }
            if (window.firebaseService && typeof window.firebaseService.getNamespacedPath === 'function') {
                const ns = window.firebaseService.getNamespacedPath(base);
                return ns || `companies/__no_tenant__/${base}`;
            }
            const rawTenant = window.appTenantId || (window.companyInfo && (window.companyInfo.id || window.companyInfo.companyId || window.companyInfo.slug || window.companyInfo.nome || window.companyInfo.name));
            const tenant = rawTenant ? String(rawTenant) : null;
            if (tenant && !/^companies\//.test(base) && !/^users\//.test(base)) {
                return `companies/${tenant}/${base}`;
            }
            if (/^companies\//.test(base) || /^users\//.test(base)) return base;
            return `companies/__no_tenant__/${base}`;
        } catch (_) {
            return key;
        }
    }

    getLocalStorageKeys(key) {
        const keys = [];
        try {
            const base = String(key || '');
            if (!base) return keys;
            const ns = this.resolveNamespacedKey(base);
            if (ns) {
                keys.push(ns);
                return [...new Set(keys)];
            }
        } catch (_) {
            if (key) return [];
        }
        return [...new Set(keys)];
    }

    getFromLocalStorage(key) {
        try {
            for (const k of this.getLocalStorageKeys(key)) {
                const stored = localStorage.getItem(k);
                if (!stored) continue;

                const parsed = JSON.parse(stored);
                
                if (parsed._metadata && parsed._metadata.lastUpdated) {
                    const age = Date.now() - parsed._metadata.lastUpdated;
                    if (age > this.config.cacheTimeout) {
                        if (this.config.debugMode) console.log(`📦 Dados de ${k} antigos (${(age/60000).toFixed(1)}min), mas usando para carregamento instantâneo`);
                    }
                }

                return parsed;
            }
            return null;
        } catch (error) {
            console.warn(`⚠️ Erro ao ler localStorage para ${key}:`, error);
            return null;
        }
    }

    setLocalStorage(key, data) {
        try {
            const dataWithMeta = {
                ...data,
                _metadata: {
                    lastUpdated: Date.now(),
                    source: 'hybrid-sync'
                }
            };
            const payload = JSON.stringify(dataWithMeta);
            for (const k of this.getLocalStorageKeys(key)) {
                localStorage.setItem(k, payload);
            }
        } catch (error) {
            console.warn(`⚠️ Erro ao salvar localStorage para ${key}:`, error);
        }
    }

    /**
     * 🔥 CARREGAMENTO FIREBASE (BACKGROUND)
     */
    async loadFromFirebase(key) {
        try {
            if (!window.firebaseServiceTL) {
                throw new Error('Firebase service não disponível');
            }

            const result = await window.firebaseServiceTL.loadData(key);
            
            if (result) {
                // Atualizar caches
                this.setMemoryCache(key, result);
                this.setLocalStorage(key, result);
                
                // Notificar subscribers
                this.notifySubscribers(key, result);
                
                if (this.config.debugMode) console.log(`🔥 Firebase carregado para ${key}`);
            }

            return result;
        } catch (error) {
            console.warn(`⚠️ Erro ao carregar ${key} do Firebase:`, error);
            return null;
        }
    }

    /**
     * 🔄 VERIFICAÇÃO DE SYNC EM BACKGROUND
     */
    checkBackgroundSync(key, cached) {
        // Se dados são muito antigos, agendar sync
        const age = Date.now() - cached.timestamp;
        if (age > this.config.cacheTimeout / 2) { // Sync quando cache está na metade da validade
            this.scheduleBackgroundSync(key);
        }
    }

    scheduleBackgroundSync(key) {
        // Evitar múltiplos syncs do mesmo key
        if (this.state.pendingOperations.has(key)) return;

        this.state.pendingOperations.set(key, true);

        // Sync em background com delay para não impactar performance
        setTimeout(async () => {
            try {
                await this.syncFromFirebase(key);
            } finally {
                this.state.pendingOperations.delete(key);
            }
        }, this.config.batchDelay);
    }

    scheduleFirebaseLoad(key) {
        // Aguardar Firebase ficar pronto e então carregar
        const checkFirebase = () => {
            if (this.state.isFirebaseReady) {
                this.loadFromFirebase(key);
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        setTimeout(checkFirebase, 100);
    }

    /**
     * 🔄 SYNC EM BACKGROUND
     */
    async syncFromFirebase(key) {
        if (!this.state.isFirebaseReady || this.state.isSyncing) return;

        try {
            const data = await this.loadFromFirebase(key);
            if (data) {
                if (this.config.debugMode) console.log(`🔄 Background sync completo para ${key}`);
            }
        } catch (error) {
            console.warn(`⚠️ Erro no background sync de ${key}:`, error);
        }
    }

    /**
     * 💾 SALVAMENTO HÍBRIDO
     */
    async save(key, data) {
        const startTime = performance.now();

        try {
            // 1️⃣ Salvar imediatamente no localStorage (resposta instantânea)
            this.setLocalStorage(key, data);
            this.setMemoryCache(key, data);

            // 2️⃣ Agendar salvamento no Firebase (background)
            this.scheduleSaveToFirebase(key, data);

            const saveTime = performance.now() - startTime;
            if (this.config.debugMode) console.log(`💾 Salvamento híbrido de ${key} em ${saveTime.toFixed(2)}ms`);

            return { success: true, source: 'hybrid', time: saveTime };

        } catch (error) {
            this.metrics.errors++;
            console.error(`❌ Erro no salvamento híbrido de ${key}:`, error);
            return { success: false, error: error.message };
        }
    }

    scheduleSaveToFirebase(key, data) {
        // Adicionar à fila de sync
        this.state.syncQueue.set(key, {
            data: data,
            timestamp: Date.now(),
            operation: 'save'
        });

        // Processar fila em background
        setTimeout(() => this.processSyncQueue(), this.config.batchDelay);
    }

    /**
     * 🔄 PROCESSAR FILA DE SYNC
     */
    async processSyncQueue() {
        if (!this.state.isFirebaseReady || this.state.isSyncing || this.state.syncQueue.size === 0) {
            return;
        }

        this.state.isSyncing = true;
        const startTime = performance.now();

        try {
            let processed = 0;
            const batch = Array.from(this.state.syncQueue.entries()).slice(0, this.config.batchSize);

            for (const [key, operation] of batch) {
                try {
                    if (operation.operation === 'save') {
                        await window.firebaseServiceTL.saveData(key, operation.data);
                    }
                    
                    this.state.syncQueue.delete(key);
                    processed++;
                    
                    // Pequeno delay entre operações para não sobrecarregar
                    if (processed < batch.length) {
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                } catch (error) {
                    console.warn(`⚠️ Erro ao sincronizar ${key}:`, error);
                    // Manter na fila para tentar novamente
                }
            }

            const syncTime = performance.now() - startTime;
            this.metrics.syncOperations += processed;
            this.state.lastSync = Date.now();

            if (this.config.debugMode && processed > 0) {
                console.log(`🔄 Sync batch processado: ${processed} operações em ${syncTime.toFixed(2)}ms`);
            }

            // Se ainda há itens na fila, agendar próximo batch
            if (this.state.syncQueue.size > 0) {
                setTimeout(() => this.processSyncQueue(), this.config.syncInterval);
            }

        } finally {
            this.state.isSyncing = false;
        }
    }

    /**
     * 🔔 SISTEMA DE NOTIFICAÇÃO
     */
    subscribe(key, callback) {
        if (!this.state.subscribers.has(key)) {
            this.state.subscribers.set(key, new Set());
        }
        this.state.subscribers.get(key).add(callback);
    }

    unsubscribe(key, callback) {
        const subscribers = this.state.subscribers.get(key);
        if (subscribers) {
            subscribers.delete(callback);
        }
    }

    notifySubscribers(key, data) {
        const subscribers = this.state.subscribers.get(key);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.warn(`⚠️ Erro ao notificar subscriber para ${key}:`, error);
                }
            });
        }
    }

    /**
     * 🌐 LISTENERS DE REDE
     */
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            if (this.config.debugMode) console.log('🟢 Conectado - processando fila de sync');
            this.processSyncQueue();
        });

        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            if (this.config.debugMode) console.log('🔴 Desconectado - modo offline');
        });
    }

    /**
     * ⏰ SYNC AUTOMÁTICO
     */
    setupAutoSync() {
        setInterval(() => {
            if (this.state.isOnline && this.state.isFirebaseReady) {
                this.processSyncQueue();
            }
        }, this.config.syncInterval);
    }

    /**
     * 🧹 LIMPEZA DE CACHE
     */
    cleanExpiredCache() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, cached] of this.state.cache) {
            if (now - cached.timestamp > this.config.cacheTimeout) {
                this.state.cache.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0 && this.config.debugMode) {
            console.log(`🧹 Cache limpo: ${cleaned} entradas expiradas`);
        }

        // Agendar próxima limpeza
        setTimeout(() => this.cleanExpiredCache(), this.config.cacheTimeout);
    }

    /**
     * 📊 MÉTRICAS E STATUS
     */
    getMetrics() {
        const avgLoadTime = Array.from(this.metrics.loadTimes.values()).reduce((a, b) => a + b, 0) / this.metrics.loadTimes.size || 0;
        
        return {
            ...this.metrics,
            avgLoadTime: avgLoadTime.toFixed(2),
            cacheHitRate: ((this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100).toFixed(1),
            queueSize: this.state.syncQueue.size,
            memoryCache: this.state.cache.size,
            isOnline: this.state.isOnline,
            isFirebaseReady: this.state.isFirebaseReady,
            lastSync: this.state.lastSync
        };
    }

    /**
     * 🔧 CONFIGURAÇÃO DINÂMICA
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.config.debugMode) console.log('🔧 Configuração atualizada:', newConfig);
    }

    /**
     * 🧪 MÉTODOS DE TESTE
     */
    async benchmarkLoad(key, iterations = 10) {
        const times = [];
        
        // Limpar cache para teste justo
        this.state.cache.delete(key);
        
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await this.loadInstant(key);
            times.push(performance.now() - start);
            
            // Pequeno delay entre testes
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        return {
            min: Math.min(...times).toFixed(2),
            max: Math.max(...times).toFixed(2),
            avg: (times.reduce((a, b) => a + b) / times.length).toFixed(2),
            times: times.map(t => t.toFixed(2))
        };
    }
}

// 🌐 INSTÂNCIA GLOBAL
window.hybridSync = new HybridSyncService();

// 🔌 INTEGRAÇÃO COM SISTEMA EXISTENTE
window.HybridSyncService = HybridSyncService;

// 📤 FUNÇÕES DE CONVENIÊNCIA
window.loadInstant = (key) => window.hybridSync.loadInstant(key);
window.saveHybrid = (key, data) => window.hybridSync.save(key, data);

console.log('⚡ Hybrid Sync Service carregado - Carregamento instantâneo ativado!');
