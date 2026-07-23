/**
 * 🔥 FIREBASE CONNECTION MANAGER
 * Sistema profissional de gerenciamento de conexão Firebase
 * Resolve problemas de reconexões múltiplas e carregamento de dados
 * 
 * ✅ FUNCIONALIDADES:
 * - Padrão Singleton para conexão única
 * - Sistema inteligente de reconexão
 * - Cache de dados com invalidação
 * - Estados de loading responsivos
 * - Retry automático com backoff exponencial
 * - Debounce para evitar chamadas múltiplas
 * - Listeners únicos sem duplicação
 */

function getAuthPerformanceDiagnosticsPayrollManager() {
    try { return window.__SISWEB_AUTH_PERF__ || null; } catch (_) { return null; }
}

class FirebaseConnectionManager {
    constructor() {
        // Implementar Singleton
        if (FirebaseConnectionManager.instance) {
            return FirebaseConnectionManager.instance;
        }
        
        FirebaseConnectionManager.instance = this;
        
        // Estado da conexão
        this.isInitialized = false;
        this.isConnected = false;
        this.isOnline = navigator.onLine;
        this.database = null;
        
        // Sistema de retry
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 1000; // Início com 1 segundo
        this.maxRetryDelay = 30000; // Máximo 30 segundos
        
        // Cache de dados
        this.dataCache = new Map();
        this.cacheTimestamps = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        
        // Listeners ativos (para evitar duplicação)
        this.activeListeners = new Map(); // path -> listenerInfo
        this.connectionListeners = new Set();
        
        // Fila de operações pendentes
        this.pendingOperations = [];
        this.isProcessingQueue = false;
        this.queueStorageKey = 'folha_pending_ops_v1';
        this.localStorageSkipLog = new Set();
        this.localStorageMaxBytes = 1500 * 1024;
        
        // Debounce para operações
        this.debounceTimers = new Map();
        
        // Estado de loading
        this.loadingStates = new Map();
        
        // Inicializar
        this.init();
        
        console.log('🔥 Firebase Connection Manager inicializado (Singleton)');
    }
    
    /**
     * 🚀 Inicialização principal
     */
    async init() {
        if (this.isInitialized) {
            console.log('✅ Firebase Manager já inicializado');
            return;
        }
        
        console.log('🔥 Inicializando Firebase Connection Manager...');
        console.log('🔍 Status inicial:', {
            windowDatabase: !!window.database,
            navigatorOnline: navigator.onLine,
            documentReadyState: document.readyState
        });
        
        try {
            // 1. Aguardar Firebase estar disponível
            await this.waitForFirebase();
            
            // 2. Configurar conexão
            await this.setupConnection();
            
            // 3. Configurar listeners de rede
            this.setupNetworkListeners();
            
            // 4. Configurar listeners de conexão Firebase
            this.setupConnectionListeners();
            
            // 5. Restaurar e processar operações pendentes
            try { this.restoreQueue(); } catch {}
            this.processQueue();
            
            this.isInitialized = true;
            console.log('✅ Firebase Connection Manager inicializado com sucesso');
            
            // Emitir evento de inicialização
            this.emit('initialized');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar Firebase Manager:', error);
            this.scheduleRetry();
        }
    }
    
    /**
     * ⏳ Aguardar Firebase estar disponível
     */
    async waitForFirebase() {
        const maxAttempts = 50;
        let attempts = 0;
        
        console.log('🔍 Aguardando Firebase...', {
            windowDatabase: !!window.database,
            windowDatabaseType: typeof window.database,
            windowDatabaseKeys: window.database ? Object.keys(window.database) : 'N/A'
        });
        
        while (attempts < maxAttempts) {
            if (window.database) {
                console.log('✅ Firebase database disponível');
                console.log('🔍 Detalhes do database:', {
                    type: typeof window.database,
                    keys: Object.keys(window.database),
                    app: window.database.app
                });
                return;
            }
            
            if (attempts % 10 === 0) {
                console.log(`⏳ Aguardando Firebase (${attempts}/${maxAttempts})...`);
                console.log('🔍 Status atual:', {
                    windowDatabase: !!window.database,
                    documentReadyState: document.readyState,
                    navigatorOnline: navigator.onLine
                });
            }
            
            await this.sleep(100);
            attempts++;
        }
        
        console.error('❌ Timeout aguardando Firebase. Status final:', {
            windowDatabase: !!window.database,
            documentReadyState: document.readyState,
            navigatorOnline: navigator.onLine
        });
        
        throw new Error('Timeout aguardando Firebase');
    }
    
    /**
     * 🔗 Configurar conexão
     */
    async setupConnection() {
        if (window.database) {
            this.database = window.database;
            console.log('✅ Conexão Firebase estabelecida');
            return true;
        }
        
        throw new Error('Firebase database não disponível');
    }
    
    /**
     * 🌐 Configurar listeners de rede
     */
    setupNetworkListeners() {
        // Evitar duplicação de listeners
        if (window._firebaseNetworkListenersConfigured) {
            return;
        }
        
        window.addEventListener('online', () => {
            console.log('🌐 Rede online detectada');
            this.isOnline = true;
            try { getAuthPerformanceDiagnosticsPayrollManager()?.internet(true, 'payroll_page'); } catch (_) {}
            this.handleNetworkChange('online');
        });
        
        window.addEventListener('offline', () => {
            console.log('🌐 Rede offline detectada');
            this.isOnline = false;
            try { getAuthPerformanceDiagnosticsPayrollManager()?.internet(false, 'payroll_page'); } catch (_) {}
            this.handleNetworkChange('offline');
        });
        
        window._firebaseNetworkListenersConfigured = true;
        console.log('✅ Listeners de rede configurados');
    }
    
    /**
     * 🔥 Configurar listeners de conexão Firebase
     */
    async setupConnectionListeners() {
        if (!this.database) return;
        
        try {
            const { ref, onValue, off } = await import('../firebase-init.js');
            
            const connectedRef = ref(this.database, '.info/connected');
            
            // Remover listener anterior se existir (usar callback salvo)
            if (this._connectedRef && this._connectedCb) {
                try {
                    off(this._connectedRef, 'value', this._connectedCb);
                    getAuthPerformanceDiagnosticsPayrollManager()?.listener('rtdb', 'remove', 'payroll_page', 0);
                } catch {}
            }
            
            // Configurar novo listener
            this._connectedRef = connectedRef;
            this._connectedCb = (snapshot) => {
                const connected = snapshot.val() === true;
                try { getAuthPerformanceDiagnosticsPayrollManager()?.rtdb(connected, 'payroll_page'); } catch (_) {}
                this.handleConnectionChange(connected);
            };
            try { getAuthPerformanceDiagnosticsPayrollManager()?.listener('rtdb', 'add', 'payroll_page', 0); } catch (_) {}
            onValue(connectedRef, this._connectedCb);
            
            console.log('✅ Listeners de conexão Firebase configurados');
            
        } catch (error) {
            console.error('❌ Erro ao configurar listeners de conexão:', error && error.code ? error.code : 'unknown');
        }
    }
    
    /**
     * 🔄 Manipular mudança de conexão
     */
    handleConnectionChange(connected) {
        const wasConnected = this.isConnected;
        // Debounce de flapping: aplicar pequena janela para estabilizar status
        if (this._statusDebounceTimer) clearTimeout(this._statusDebounceTimer);
        this._statusDebounceTimer = setTimeout(() => {
            this.isConnected = connected;
            
            console.log(`🔥 Firebase ${connected ? 'conectado' : 'desconectado'}`);
            
            if (connected && !wasConnected) {
            // Reconectou
            this.retryCount = 0;
            this.processQueue();
            this.refreshStaleData();
            this.emit('connected');
            } else if (!connected && wasConnected) {
            // Desconectou
            this.emit('disconnected');
            }
            
            this.updateConnectionStatus(this.isConnected);
        }, 250); // 250ms para suavizar alternâncias muito rápidas
    }
    
    /**
     * 🌐 Manipular mudança de rede
     */
    handleNetworkChange(status) {
        if (status === 'online') {
            // Aguardar um pouco para Firebase reconectar
            setTimeout(() => {
                if (!this.isConnected) {
                    this.reconnect();
                }
            }, 2000);
        }
        
        this.emit('networkChange', status);
    }
    
    /**
     * 🔄 Reconectar
     */
    async reconnect() {
        if (this.retryCount >= this.maxRetries) {
            console.error('❌ Máximo de tentativas de reconexão atingido');
            return;
        }
        
        this.retryCount++;
        const delay = Math.min(
            this.retryDelay * Math.pow(2, this.retryCount - 1),
            this.maxRetryDelay
        );
        
        console.log(`🔄 Tentativa de reconexão ${this.retryCount}/${this.maxRetries} em ${delay}ms`);
        
        await this.sleep(delay);
        
        try {
            await this.setupConnection();
            await this.setupConnectionListeners();
            
            if (this.isConnected) {
                this.retryCount = 0;
                console.log('✅ Reconexão bem-sucedida');
            }
        } catch (error) {
            console.error('❌ Erro na reconexão:', error);
            this.scheduleRetry();
        }
    }
    
    /**
     * ⏰ Agendar nova tentativa
     */
    scheduleRetry() {
        if (this.retryCount < this.maxRetries) {
            setTimeout(() => this.reconnect(), 1000);
        }
    }

    resolvePath(path) {
        try {
            const base = String(path || '');
            if (!base) return base;
            if (/^companies(\/|$)/.test(base) || /^users(\/|$)/.test(base)) return base;
            if (window.FolhaUtils && typeof window.FolhaUtils.resolveFirebasePath === 'function') {
                return window.FolhaUtils.resolveFirebasePath(base);
            }
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                return svc.getNamespacedPath(base);
            }
            const rawTenant = window.appTenantId || (window.companyInfo && (window.companyInfo.companyId || window.companyInfo.companyID || window.companyInfo.tenantId || window.companyInfo.id));
            if (rawTenant) return `companies/${String(rawTenant)}/${base}`;
            const stored = localStorage.getItem('company_info');
            if (stored) {
                const obj = JSON.parse(stored);
                const t = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                if (t) return `companies/${String(t)}/${base}`;
            }
            return base;
        } catch (_) {
            return path;
        }
    }
    
    /**
     * 📊 Carregar dados com cache e debounce
     */
    async loadData(path, options = {}) {
        const {
            useCache = true,
            debounceMs = 300,
            forceRefresh = false,
            skipLocalStorage = false
        } = options;
        
        // Debounce para evitar múltiplas chamadas
        if (debounceMs > 0) {
            const debounceKey = `load_${path}`;
            if (this.debounceTimers.has(debounceKey)) {
                clearTimeout(this.debounceTimers.get(debounceKey));
            }
            
            return new Promise((resolve, reject) => {
                const timer = setTimeout(async () => {
                    this.debounceTimers.delete(debounceKey);
                    try {
                        const result = await this._loadDataInternal(path, useCache, forceRefresh, { skipLocalStorage });
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                }, debounceMs);
                
                this.debounceTimers.set(debounceKey, timer);
            });
        }
        
        return this._loadDataInternal(path, useCache, forceRefresh, { skipLocalStorage });
    }
    
    /**
     * 📊 Carregamento interno de dados
     */
    async _loadDataInternal(path, useCache, forceRefresh, options = {}) {
        const resolvedPath = this.resolvePath(path);
        const pathKey = resolvedPath || path;
        try { getAuthPerformanceDiagnosticsPayrollManager()?.read(pathKey, 'payroll_page', 'logical', 'started', 0); } catch (_) {}
        // Verificar cache primeiro
        if (useCache && !forceRefresh && this.isCacheValid(pathKey)) {
            try { getAuthPerformanceDiagnosticsPayrollManager()?.cache(pathKey, 'memory', 'hit', 'payroll_page'); } catch (_) {}
            console.log('📦 Dados carregados do cache');
            return this.dataCache.get(pathKey);
        }
        try { getAuthPerformanceDiagnosticsPayrollManager()?.cache(pathKey, 'memory', 'miss', 'payroll_page'); } catch (_) {}
        
        // Definir estado de loading
        this.setLoadingState(pathKey, true);
        
        try {
            // Não bloquear por this.isConnected: tentar buscar sempre que possível
            const { ref, get } = await import('../firebase-init.js');
            const dataRef = ref(this.database, pathKey);
            
            console.log('📡 Carregando dados do Firebase');
            try { getAuthPerformanceDiagnosticsPayrollManager()?.read(pathKey, 'payroll_page', 'physical', 'started', 0); } catch (_) {}
            const snapshot = await get(dataRef);
            const data = snapshot.val() || {};
            
            // Atualizar cache
            this.updateCache(pathKey, data);
            
            // Salvar no localStorage como backup
            if (!options.skipLocalStorage) {
                this.saveToLocalStorage(pathKey, data);
            }
            
            console.log('✅ Dados carregados');
            return data;
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error && error.code ? error.code : 'unknown');
            
            // Se aparentemente offline, enfileirar e tentar fallback
            const looksOffline = !this.isOnline || (error && String(error.message || error).toLowerCase().includes('offline'));
            if (looksOffline) {
                this.addToQueue('load', pathKey);
            }
            
            // Tentar fallback do cache ou localStorage
            const fallbackData = this.dataCache.get(pathKey) || this.getFromLocalStorage(pathKey);
            if (fallbackData) {
                try { getAuthPerformanceDiagnosticsPayrollManager()?.cache(pathKey, 'local', 'hit', 'payroll_page'); } catch (_) {}
                console.log('📦 Usando dados de fallback');
                return fallbackData;
            }
            
            if (looksOffline) {
                throw new Error(`Offline - dados não disponíveis: ${pathKey}`);
            }
            throw error;
        } finally {
            this.setLoadingState(pathKey, false);
        }
    }
    
    /**
     * 💾 Salvar dados
     */
    async saveData(path, data, options = {}) {
        const { showToast = true } = options;

        // 🔒 Guarda de autenticação da UI: bloqueia gravações sem login
        try {
            const provided = options && Object.prototype.hasOwnProperty.call(options, 'requireAuth');
            const p = String(path || '');
            const isFolhaPath = /^folha\//.test(p) || /^(folhas|funcionarios|cargos|bancoHoras|relatorios)(\b|\/)/.test(p);
            const requireAuth = provided ? !!options.requireAuth : (!isFolhaPath);
            const isUiAuthed = !!(window.UIAuth && typeof window.UIAuth.isAuthenticated === 'function' && window.UIAuth.isAuthenticated());
            if (requireAuth && !isUiAuthed) {
                if (window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
                    window.FolhaUtils.showToast('Para salvar, faça login.', 'warning', 3000);
                }
                if (window.UIAuth && typeof window.UIAuth.redirectToLogin === 'function') {
                    window.UIAuth.redirectToLogin('save_requires_auth');
                }
                throw new Error('Auth required: UI user not authenticated');
            }
        } catch (guardErr) {
            // Em caso de erro no guard (ex.: UIAuth ausente), apenas registrar
            console.warn('Auth guard warning:', guardErr && guardErr.message ? guardErr.message : guardErr);
        }

        const resolvedPath = this.resolvePath(path);
        const pathKey = resolvedPath || path;
        const operation = { type: 'save', path, data, options };
        
        if (!this.isConnected) {
            console.log('📝 Adicionando operação à fila offline');
            this.addToQueue('save', pathKey, data);
            
            // Salvar no localStorage temporariamente
            this.saveToLocalStorage(pathKey, data);
            
            if (showToast && window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
                window.FolhaUtils.showToast('Sem conexão. Salvo na fila para sincronização.', 'info', 4000);
            }
            return true;
        }
        
        try {
            const { ref, set } = await import('../firebase-init.js');
            const dataRef = ref(this.database, pathKey);
            
            await set(dataRef, data);
            
            // Atualizar cache
            this.updateCache(pathKey, data);
            
            console.log('✅ Dados salvos');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao salvar dados:', error && error.code ? error.code : 'unknown');
            const msg = String((error && error.message) || error || '').toLowerCase();
            const isPermissionDenied = msg.includes('permission_denied');
            const looksOffline = !this.isOnline || msg.includes('offline');
            if (isPermissionDenied) {
                try {
                    if (window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
                        window.FolhaUtils.showToast('Permissão negada ao salvar. Faça login para continuar.', 'error', 3500);
                    }
                    if (window.UIAuth && typeof window.UIAuth.redirectToLogin === 'function') {
                        window.UIAuth.redirectToLogin('permission_denied');
                    }
                } catch(e) {}
                throw error;
            }
            if (looksOffline) {
                this.addToQueue('save', pathKey, data);
                
                // Salvar no localStorage temporariamente (fallback)
                this.saveToLocalStorage(pathKey, data);
                
                if (showToast && window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
                    window.FolhaUtils.showToast('Conexão instável. Salvo na fila para sincronização.', 'warning', 4000);
                }
                return true;
            }
            throw error;
        }
    }
    
    /**
     * 👂 Configurar listener em tempo real
     */
    async setupRealtimeListener(path, callback, options = {}) {
        const resolvedPath = this.resolvePath(path);
        const pathKey = resolvedPath || path;
        const listenerKey = `${pathKey}_${Date.now()}`;
        
        // Evitar listeners duplicados
        if (this.activeListeners.has(pathKey)) {
            console.log('⚠️ Listener realtime já ativo');
            return this.activeListeners.get(pathKey);
        }
        
        try {
            const { ref, onValue, off } = await import('../firebase-init.js');
            const dataRef = ref(this.database, pathKey);
            let firstSnapshot = true;
            try { getAuthPerformanceDiagnosticsPayrollManager()?.listener('data', 'add', 'payroll_page', 0); } catch (_) {}
            const unsubscribe = onValue(dataRef, (snapshot) => {
                const data = snapshot.val() || {};
                if (firstSnapshot) {
                    firstSnapshot = false;
                    try { getAuthPerformanceDiagnosticsPayrollManager()?.read(pathKey, 'payroll_page', 'listener_first_value', 'success', 0); } catch (_) {}
                }
                
                // Atualizar cache
                this.updateCache(pathKey, data);
                
                // Chamar callback
                callback(data);
                
                console.log('🔄 Dados atualizados em tempo real');
            }, (error) => {
                console.error('❌ Erro no listener realtime:', error && error.code ? error.code : 'unknown');
                callback(null, error);
            });
            
            // Armazenar referência do listener
            const listenerInfo = {
                path: pathKey,
                unsubscribe, // função retornada por onValue
                ref: dataRef,
                callback
            };
            
            this.activeListeners.set(pathKey, listenerInfo);
            
            console.log('👂 Listener realtime configurado');
            return listenerInfo;
            
        } catch (error) {
            console.error('❌ Erro ao configurar listener realtime:', error && error.code ? error.code : 'unknown');
            throw error;
        }
    }
    
    /**
     * 🗑️ Remover listener
     */
    removeListener(path) {
        const resolvedPath = this.resolvePath(path);
        const pathKey = resolvedPath || path;
        const listener = this.activeListeners.get(pathKey);
        if (listener) {
            listener.unsubscribe();
            try { getAuthPerformanceDiagnosticsPayrollManager()?.listener('data', 'remove', 'payroll_page', 0); } catch (_) {}
            this.activeListeners.delete(pathKey);
            console.log('🗑️ Listener realtime removido');
        }
    }
    
    /**
     * 📦 Gerenciamento de cache
     */
    updateCache(path, data) {
        this.dataCache.set(path, data);
        this.cacheTimestamps.set(path, Date.now());
    }
    
    isCacheValid(path) {
        if (!this.dataCache.has(path)) return false;
        
        const timestamp = this.cacheTimestamps.get(path);
        return timestamp && (Date.now() - timestamp) < this.cacheTimeout;
    }
    
    invalidateCache(path) {
        this.dataCache.delete(path);
        this.cacheTimestamps.delete(path);
        console.log('🗑️ Cache invalidado');
    }
    
    refreshStaleData() {
        console.log('🔄 Atualizando dados obsoletos...');
        
        for (const [path, timestamp] of this.cacheTimestamps.entries()) {
            if (Date.now() - timestamp > this.cacheTimeout) {
                this.loadData(path, { forceRefresh: true });
            }
        }
    }
    
    /**
     * 💾 LocalStorage para backup
     */
    shouldSkipLocalStorage(path, serializedLength = 0) {
        const normalizedPath = String(path || '');
        const rootCompanyPathPattern = /^companies\/[^/]+$/;
        if (rootCompanyPathPattern.test(normalizedPath)) {
            return 'root-company-path';
        }
        if (serializedLength > this.localStorageMaxBytes) {
            return 'payload-too-large';
        }
        return '';
    }

    logLocalStorageSkip(path, reason) {
        const key = `${reason}:${path}`;
        if (this.localStorageSkipLog.has(key)) return;
        this.localStorageSkipLog.add(key);
        console.info('ℹ️ Cache local ignorado para evitar quota/storage pesado:', { path, reason });
    }

    saveToLocalStorage(path, data) {
        try {
            const key = `folha_cache_${path.replace(/[\/\.]/g, '_')}`;
            const payload = {
                data,
                timestamp: Date.now()
            };
            const serialized = JSON.stringify(payload);
            const estimatedBytes = serialized.length * 2;
            const skipReason = this.shouldSkipLocalStorage(path, estimatedBytes);
            if (skipReason) {
                this.logLocalStorageSkip(path, skipReason);
                return;
            }
            if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                window.SiswebStorage.write(key, payload);
            } else {
                localStorage.setItem(key, serialized);
            }
        } catch (error) {
            if (error && error.name === 'QuotaExceededError') {
                this.logLocalStorageSkip(path, 'quota-exceeded');
                return;
            }
            console.warn('⚠️ Erro ao salvar no localStorage:', error);
        }
    }

    persistQueue() {
        try {
            if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                window.SiswebStorage.write(this.queueStorageKey, this.pendingOperations);
            } else {
                localStorage.setItem(this.queueStorageKey, JSON.stringify(this.pendingOperations));
            }
        } catch {}
    }
    restoreQueue() {
        try {
            const raw = localStorage.getItem(this.queueStorageKey);
            if (!raw) return;
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length > 0) {
                this.pendingOperations = arr;
            }
        } catch {}
    }
    clearQueueStorage() {
        try { localStorage.removeItem(this.queueStorageKey); } catch {}
    }
    
    getFromLocalStorage(path) {
        try {
            const key = `folha_cache_${path.replace(/[\/\.]/g, '_')}`;
            const stored = localStorage.getItem(key);
            
            if (stored) {
                const parsed = JSON.parse(stored);
                
                // Verificar se não está muito antigo (1 hora)
                if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
                    return parsed.data;
                }
            }
        } catch (error) {
            console.warn('⚠️ Erro ao ler do localStorage:', error);
        }
        
        return null;
    }
    
    /**
     * 📋 Gerenciamento de fila
     */
    addToQueue(operation, path, data = null) {
        this.pendingOperations.push({
            operation,
            path,
            data,
            timestamp: Date.now()
        });
        
        console.log('📋 Operação adicionada à fila');
        this.persistQueue();
    }
    
    async processQueue() {
        if (this.isProcessingQueue || !this.isConnected) {
            return;
        }
        
        this.isProcessingQueue = true;
        
        console.log(`📋 Processando fila (${this.pendingOperations.length} operações)`);
        
        while (this.pendingOperations.length > 0 && this.isConnected) {
            const operation = this.pendingOperations.shift();
            
            try {
                if (operation.operation === 'load') {
                    await this.loadData(operation.path, { forceRefresh: true });
                } else if (operation.operation === 'save') {
                    await this.saveData(operation.path, operation.data);
                }
                
                console.log('✅ Operação da fila processada');
                this.persistQueue();
                
            } catch (error) {
                console.error('❌ Erro ao processar operação da fila:', error && error.code ? error.code : 'unknown');
                
                // Recolocar na fila se não for muito antiga (5 minutos)
                if (Date.now() - operation.timestamp < 5 * 60 * 1000) {
                    this.pendingOperations.push(operation);
                    this.persistQueue();
                }
            }
            
            // Pequena pausa entre operações
            await this.sleep(100);
        }
        
        this.isProcessingQueue = false;
        console.log('✅ Fila processada');
        if (this.pendingOperations.length === 0) { this.clearQueueStorage(); }
    }
    
    /**
     * ⚡ Estados de loading
     */
    setLoadingState(path, loading) {
        this.loadingStates.set(path, loading);
        this.emit('loadingChange', { path, loading });
        
        // Atualizar UI se houver elemento específico
        const loadingElement = document.querySelector(`[data-loading-path="${path}"]`);
        if (loadingElement) {
            loadingElement.classList.toggle('loading', loading);
        }
    }
    
    isLoading(path) {
        return this.loadingStates.get(path) || false;
    }
    
    /**
     * 🎭 Atualizar indicador visual de conexão
     */
    updateConnectionStatus(connected) {
        let indicator = document.getElementById('firebase-status');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'firebase-status';
            // Estilos de posição/cores agora controlados via CSS (folha-loading-styles.css)
            document.body.appendChild(indicator);
        }
        
        if (connected && this.isOnline) {
            indicator.className = 'firebase-online';
            indicator.textContent = '🟢 Online';
        } else {
            indicator.className = 'firebase-offline';
            indicator.textContent = '🔴 Offline';
        }
    }
    
    /**
     * 📡 Sistema de eventos
     */
    emit(event, data = null) {
        const customEvent = new CustomEvent(`firebaseManager:${event}`, {
            detail: data
        });
        
        window.dispatchEvent(customEvent);
    }
    
    on(event, callback) {
        window.addEventListener(`firebaseManager:${event}`, callback);
    }
    
    off(event, callback) {
        window.removeEventListener(`firebaseManager:${event}`, callback);
    }
    
    /**
     * 📊 Estatísticas e status
     */
    getStats() {
        return {
            isInitialized: this.isInitialized,
            isConnected: this.isConnected,
            isOnline: this.isOnline,
            retryCount: this.retryCount,
            cacheSize: this.dataCache.size,
            activeListeners: this.activeListeners.size,
            pendingOperations: this.pendingOperations.length,
            loadingStates: Array.from(this.loadingStates.entries())
                .filter(([_, loading]) => loading)
                .map(([path, _]) => path)
        };
    }
    
    /**
     * 🛠️ Utilitários
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 🧹 Limpeza
     */
    cleanup() {
        // Remover todos os listeners
        for (const [path, listener] of this.activeListeners.entries()) {
            listener.unsubscribe();
        }
        this.activeListeners.clear();
        
        // Limpar timers
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        
        // Limpar cache
        this.dataCache.clear();
        this.cacheTimestamps.clear();
        
        console.log('🧹 Firebase Manager limpo');
    }
}

// ✅ INSTÂNCIA GLOBAL SINGLETON
let firebaseManager = null;

function getFirebaseManager() {
    if (!firebaseManager) {
        firebaseManager = new FirebaseConnectionManager();
    }
    return firebaseManager;
}

// ✅ FUNÇÕES DE CONVENIÊNCIA
window.getData = async (path, options = {}) => {
    const manager = getFirebaseManager();
    return await manager.loadData(`${path}`, options);
};

window.saveData = async (path, data, options = {}) => {
    const manager = getFirebaseManager();
    await manager.saveData(`${path}`, data, { ...options, showToast: true });
    return true;
};

window.setupListener = async (path, callback, options = {}) => {
    const manager = getFirebaseManager();
    return await manager.setupRealtimeListener(`${path}`, callback, options);
};

// ✅ EXPORTAR PARA USO GLOBAL
window.FirebaseConnectionManager = FirebaseConnectionManager;
window.getFirebaseManager = getFirebaseManager;

// ✅ INICIALIZAÇÃO AUTOMÁTICA
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar Firebase estar disponível
    setTimeout(() => {
        const manager = getFirebaseManager();
        window.firebaseManager = manager;
        
        console.log('✅ Firebase Connection Manager disponível globalmente');
    }, 500);
});

console.log('🔥 Firebase Connection Manager carregado');
