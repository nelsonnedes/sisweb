/**
 * FIREBASE SERVICE UNIFICADO - SISWEB
 * 
 * Serviço único que consolida funcionalidades dos dois firebaseService.js existentes
 * Prioriza Realtime Database conforme configuração atual do sistema
 * Mantém compatibilidade total com localStorage para transição suave
 * 
 * @author SisWeb Migration Team
 * @version 3.0.0
 * @created 2024
 */

console.log('🔥 Carregando Firebase Service Unificado...');

// Aguardar Firebase estar disponível globalmente
function waitForFirebaseGlobal() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 100; // 50 segundos máximo
        
        const checkFirebase = () => {
            attempts++;
            
            if (window.firebase && 
                window.firebase.initializeApp && 
                window.firebase.database &&
                window.firebase.auth) {
                console.log('✅ Firebase global encontrado!');
                resolve(window.firebase);
                return;
            }
            
            if (attempts >= maxAttempts) {
                console.error('❌ Firebase global não encontrado após aguardar');
                reject(new Error('Firebase não disponível'));
                return;
            }
            
            if (attempts % 20 === 0) {
                console.log(`⏳ Aguardando Firebase global... (tentativa ${attempts}/${maxAttempts})`);
            }
            
            setTimeout(checkFirebase, 500);
        };
        
        checkFirebase();
    });
}

/**
 * CONFIGURAÇÃO FIREBASE UNIFICADA
 * Baseada em .firebaserc e configuração atual do sistema
 */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCF_9e067URYnB6iGnTAahPfaTMl-RQ77k",
    authDomain: "sisweb-7ce82.firebaseapp.com",
    databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "sisweb-7ce82",
    storageBucket: "sisweb-7ce82.firebasestorage.app",
    messagingSenderId: "240003261222",
    appId: "1:240003261222:web:1aeaf919ddc7e5c691d7e7",
    measurementId: "G-FTC6JZ5ZGX"
};

/**
 * MAPEAMENTO DE CHAVES LOCALSTORAGE → FIREBASE PATHS
 * Estrutura organizada por usuário para multi-tenancy
 */
const KEY_MAPPING = {
    // Dados principais
    'clients': 'clients',
    'fornecedores': 'fornecedores', // Coleção exclusiva de fornecedores
    'clientesTora': 'clients', // Redirecionamento
    'species': 'species',
    'especies': 'species', // Redirecionamento
    
    // Vendas e pedidos
    'pedidosVenda': 'pedidosVenda',
    'produtos': 'produtos',
    
    // Romaneios por tipo
    'romaneiosTora': 'romaneios/tora',
    'romaneiosPct': 'romaneiosPct',
    'romaneiosTL': 'romaneios/tl',
    'romaneiosPes': 'romaneios/pes',
    'romaneios_pes': 'romaneios/pes',
    'romaneioPes': 'romaneios/pes',
    'romaneiopes': 'romaneios/pes',
    'orcamentos': 'orcamentos',
    
    // ✅ CONTAS A RECEBER/PAGAR - UNIFICAÇÃO
    'contasReceber': 'contasReceber',        // Padrão principal
    'contas_receber': 'contasReceber',       // Redirecionamento (compatibilidade)
    'contasreceber': 'contasReceber',        // Redirecionamento (compatibilidade)
    'contasPagar': 'contasPagar',            // Padrão principal
    'contas_pagar': 'contasPagar',          // Redirecionamento (compatibilidade)
    'contaspagar': 'contasPagar',            // Redirecionamento (compatibilidade)
    
    // Configurações do usuário
    'app-theme': 'preferences/theme',
    'app-state': 'preferences/state',
    
    // Estados temporários
    'romaneioToraEmEdicao': 'cache/tora_editing',
    'romaneioEmEdicaoPct': 'cache/pct_editing',
    'romaneioEditandoId': 'cache/editing_id'
};

/**
 * CLASSE PRINCIPAL FIREBASE SERVICE UNIFICADO
 */
class UnifiedFirebaseService {
    constructor() {
        this.app = null;
        this.db = null;
        this.auth = null;
        this.isInitialized = false;
        this.currentUser = null;
        this.connectionState = false;
        this.cache = new Map();
        this.listeners = new Map();
        this.initError = null;
        
        // Fila robusta de operações locais pendentes
        this.pendingOperations = [];
        this._localOpsQueue = []; // alias para compatibilidade com requisito
        this._processingQueue = false;
        this._queueTimer = null;
        this._baseBackoffMs = 1000; // 1s inicialmente
        this._maxBackoffMs = 60000; // 60s
        
        // Estado de sincronização
        this.syncState = {
            status: 'idle', // idle | offline | online | syncing | error
            lastSyncAt: null,
            pendingCount: 0,
            processedCount: 0,
            retriesCount: 0,
            lastError: null
        };
        
        // Políticas de sincronização e fallback por coleção
        this.syncPolicies = {
            high: ['romaneios/tora', 'romaneiosPct', 'romaneios/tl'],
            medium: ['fornecedores', 'clients', 'species', 'especies'],
            low: ['preferences', 'cache']
        };

        // Critérios explícitos: helper para prioridade de sincronização
        this.getPriorityForKey = (key) => {
            const path = this.getFirebasePath(key);
            if (!path) return 'medium';
            if (this.syncPolicies.high.includes(path)) return 'high';
            if (this.syncPolicies.medium.includes(path)) return 'medium';
            return 'low';
        };
        
        // Notificador visual simples
        this._syncNotifierInitialized = false;
        
        // Auto-inicializar quando Firebase estiver disponível
        this.initializeWhenReady();
    }

    /**
     * Aguardar Firebase e inicializar
     */
    async initializeWhenReady() {
        try {
            console.log('🔄 Aguardando Firebase estar disponível...');
            await waitForFirebaseGlobal();
            await this.initialize();
        } catch (error) {
            console.error('❌ Erro ao aguardar Firebase:', error);
            this.initError = error;
        }
    }

    /**
     * Inicializar Firebase e serviços
     */
    async initialize() {
        try {
            console.log('🔥 Inicializando Firebase Service Unificado...');
            
            // Verificar se app já existe
            if (firebase.apps.length > 0) {
                console.log('♻️ Reutilizando app Firebase existente');
                this.app = firebase.apps[0];
            } else {
                this.app = firebase.initializeApp(FIREBASE_CONFIG);
                console.log('✅ Nova instância Firebase criada');
            }

            // Inicializar serviços
            this.db = firebase.database();
            this.auth = firebase.auth();
            
            // Configurar persistência de autenticação
            await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            
            // Configurar monitoramento
            this.setupConnectionMonitoring();
            this.setupAuthStateListener();
            
            this.isInitialized = true;
            console.log('✅ Firebase Service Unificado inicializado com sucesso');
            try { window.dispatchEvent(new CustomEvent('firebaseReady', { detail: { firebaseService: this, isReady: true } })); } catch (_) {}

            // ✅ Autenticar automaticamente como anônimo se não houver usuário
            try {
                if (!this.auth.currentUser) {
                    console.log('👤 Nenhum usuário logado. Realizando login anônimo...');
                    await this.auth.signInAnonymously();
                    console.log('✅ Login anônimo realizado');
                    try { window.dispatchEvent(new CustomEvent('firebaseAuthChange', { detail: { user: this.auth.currentUser } })); } catch (_) {}
                }
            } catch (e) {
                console.warn('⚠️ Falha ao realizar login anônimo:', e.message);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Erro ao inicializar Firebase:', error);
            this.initError = error;
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * Verificar se serviço está operacional
     */
    isOperational() {
        if (this.initError) {
            return { 
                operational: false, 
                error: this.initError,
                message: `Falha na inicialização: ${this.initError.message}`
            };
        }
        
        if (!this.isInitialized || !this.app || !this.db || !this.auth) {
            return { 
                operational: false, 
                error: new Error("Serviços não inicializados"),
                message: "Firebase não está pronto"
            };
        }
        
        return { operational: true };
    }

    /**
     * Verificar se Firebase está operacional (método de compatibilidade)
     */
    isFirebaseOperational() {
        return this.isOperational();
    }

    /**
     * Configurar monitoramento de conexão
     */
    setupConnectionMonitoring() {
        const connectedRef = this.db.ref('.info/connected');
        
        connectedRef.on('value', (snapshot) => {
            const isConnected = snapshot.val() === true;
            this.connectionState = isConnected;
            
            if (isConnected) {
                console.log('🌐 Firebase conectado');
                window._FIREBASE_CONNECTED = true;
                this._updateSyncState({ status: 'online' });
                this._initSyncNotifier();
                this._notifyInfo(`Conectado. Processando pendências...`);
                this.processPendingOperations();
            } else {
                console.log('📴 Firebase offline');
                window._FIREBASE_CONNECTED = false;
                this._updateSyncState({ status: 'offline' });
                this._initSyncNotifier();
                this._notifyWarning(`Sem conexão. Operações pendentes serão enfileiradas.`);
            }
            
            // Emitir evento customizado
            window.dispatchEvent(new CustomEvent('firebaseConnectionChange', {
                detail: { connected: isConnected }
            }));
        });
    }

    /**
     * Configurar listener de estado de autenticação
     */
    setupAuthStateListener() {
        this.auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            console.log(user ? `👤 Usuário logado: ${user.email}` : '👤 Usuário deslogado');
            
            // Emitir evento de mudança de auth
            window.dispatchEvent(new CustomEvent('firebaseAuthChange', {
                detail: { user }
            }));

            // Ao autenticar, tentar processar pendências imediatamente
            if (user) {
                try {
                    // Reset leve de estado e disparo do processador
                    this._updateSyncState({ status: this.connectionState ? 'online' : 'offline' });
                    this.processPendingOperations();
                } catch (e) {
                    console.warn('⚠️ Falha ao iniciar processamento de pendências após auth:', e.message);
                }
            }
        });
    }

    /**
     * Obter caminho Firebase para uma chave
     */
    getFirebasePath(key) {
        try {
            if (typeof key === 'string' && key.includes('/')) {
                if (key.startsWith('users/')) return key;
                return key;
            }
        } catch (_) {}

        const mappedKey = KEY_MAPPING[key] || key;
        if (this.currentUser) {
            return `users/${this.currentUser.uid}/${mappedKey}`;
        }
        return mappedKey;
    }

    /**
     * CARREGAR DADOS DO FIREBASE (compatível com localStorage.getItem)
     */
    async loadFromFirebase(key) {
        try {
            const status = this.isOperational();
            if (!status.operational) {
                throw new Error(status.message);
            }

            const path = this.getFirebasePath(key);
            console.log(`📥 Carregando: ${key} → ${path}`);

            // Verificar cache primeiro
            const cached = this.getFromCache(key);
            if (cached && this.isCacheValid(cached.timestamp)) {
                console.log(`💾 Cache hit: ${key}`);
                return {
                    success: true,
                    data: cached.data,
                    source: 'cache'
                };
            }

            // Carregar do Firebase
            const dbRef = this.db.ref();
            const snapshot = await dbRef.child(path).once('value');
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                console.log(`✅ Dados carregados: ${key} (${this.getDataSize(data)})`);
                
                // Atualizar cache
                this.updateCache(key, data);
                
                return {
                    success: true,
                    data: data,
                    source: 'firebase'
                };
            } else {
                console.log(`ℹ️ Nenhum dado encontrado: ${key}`);
                return {
                    success: true,
                    data: null,
                    source: 'firebase'
                };
            }
            
        } catch (error) {
            console.error(`❌ Erro ao carregar ${key}:`, error);
            
            // Fallback para cache em caso de erro
            const cached = this.getFromCache(key);
            if (cached) {
                console.log(`🔄 Usando cache como fallback: ${key}`);
                return {
                    success: true,
                    data: cached.data,
                    source: 'cache_fallback'
                };
            }
            
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * SALVAR DADOS NO FIREBASE (compatível com localStorage.setItem)
     */
    async saveToFirebase(key, itemKey = null, data) {
        try {
            const status = this.isOperational();
            if (!status.operational) {
                throw new Error(status.message);
            }

            const path = this.getFirebasePath(key);
            console.log(`💾 Salvando: ${key} → ${path}`);

            // Adicionar timestamp somente para objetos; manter arrays íntegros
            let dataWithTimestamp;
            const tsUpdated = firebase.database.ServerValue.TIMESTAMP;
            const tsCreated = (data && data.createdAt) ? data.createdAt : firebase.database.ServerValue.TIMESTAMP;

            if (Array.isArray(data)) {
                // Não espalhar array (evita salvar como objeto com índices)
                dataWithTimestamp = data;
            } else if (data && typeof data === 'object') {
                dataWithTimestamp = {
                    ...data,
                    updatedAt: tsUpdated,
                    createdAt: tsCreated
                };
            } else {
                // Tipos primitivos não são esperados; salvar como está
                dataWithTimestamp = data;
            }

            let reference;
            let resultKey;
            
            if (itemKey === null || itemKey === undefined) {
                // ✅ Substituir todos os dados no path (para arrays completos)
                reference = this.db.ref(path);
                await reference.set(dataWithTimestamp);
                resultKey = path;
                console.log(`✅ Coleção completa salva substituindo: ${key}`);
            } else {
                // Usar chave específica (salvar item individual)
                reference = this.db.ref(`${path}/${itemKey}`);
                await reference.set(dataWithTimestamp);
                resultKey = itemKey;
                console.log(`✅ Item salvo com chave: ${key}/${itemKey}`);
            }

            // Atualizar cache
            this.updateCache(key, data);
            
            return {
                success: true,
                key: resultKey,
                source: 'firebase'
            };
            
        } catch (error) {
            console.error(`❌ Erro ao salvar ${key}:`, error);
            
            // Adicionar à fila de operações pendentes com backoff
            this.enqueuePendingOperation({ type: 'save', key, itemKey, data });
            this._initSyncNotifier();
            this._notifyWarning(`Falha ao salvar. Operação enfileirada.`);
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * REMOVER DADOS DO FIREBASE (compatível com localStorage.removeItem)
     */
    async deleteFromFirebase(key, itemKey = null) {
        try {
            const status = this.isOperational();
            if (!status.operational) {
                throw new Error(status.message);
            }

            const path = itemKey ? 
                `${this.getFirebasePath(key)}/${itemKey}` : 
                this.getFirebasePath(key);
            
            console.log(`🗑️ Removendo: ${key} → ${path}`);

            const reference = this.db.ref(path);
            await reference.remove();
            
            // Remover do cache
            this.removeFromCache(key);
            
            console.log(`✅ Removido: ${key}`);
            return {
                success: true,
                source: 'firebase'
            };
            
        } catch (error) {
            console.error(`❌ Erro ao remover ${key}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * SISTEMA DE CACHE
     */
    getFromCache(key) {
        return this.cache.get(key);
    }

    updateCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    removeFromCache(key) {
        this.cache.delete(key);
    }

    isCacheValid(timestamp, maxAge = 5 * 60 * 1000) { // 5 minutos
        return (Date.now() - timestamp) < maxAge;
    }

    /**
     * SISTEMA DE OPERAÇÕES PENDENTES
     */
    addToPendingOperations(operation, key, itemKey, data) {
        // Mantém compatibilidade com chamadas existentes
        this.enqueuePendingOperation({ type: operation, key, itemKey, data });
    }

    enqueuePendingOperation(op) {
        const now = Date.now();
        const priority = this.getPriorityForKey(op.key);
        const priorityBaseBackoff = priority === 'high' ? 500 : priority === 'medium' ? 1000 : 2000;
        const opEnriched = {
            id: `${op.type}:${op.key}:${op.itemKey || 'ALL'}:${now}`,
            type: op.type,
            key: op.key,
            itemKey: op.itemKey || null,
            data: op.data,
            attempts: 0,
            nextAttemptAt: now,
            createdAt: now,
            lastError: null,
            status: 'pending', // pending | retrying | failed | done
            priority,
            baseBackoffMs: priorityBaseBackoff
        };
        
        // FIFO
        this.pendingOperations.push(opEnriched);
        this._localOpsQueue.push(opEnriched);
        this._updateSyncState({ pendingCount: this.pendingOperations.length });
        console.log(`📝 Operação pendente adicionada [${opEnriched.id}]`);
        try { window.dispatchEvent(new CustomEvent('sync:pending', { detail: { op: opEnriched } })); } catch {}
        
        // Agenda processamento se online
        if (this.connectionState) {
            this.processPendingOperations();
        }
    }

    async processPendingOperations() {
        if (this._processingQueue) return; // evitar reentrância
        if (!this.pendingOperations || this.pendingOperations.length === 0) return;
        
        this._processingQueue = true;
        this._updateSyncState({ status: 'syncing' });
        this._initSyncNotifier();
        this._notifyInfo(`Processando ${this.pendingOperations.length} pendências...`);
        
        try {
            // FIFO: processar da frente
            let index = 0;
            while (index < this.pendingOperations.length) {
                const op = this.pendingOperations[index];
                const now = Date.now();
                
                if (op.nextAttemptAt > now) {
                    // ainda não é hora, pular
                    index++;
                    continue;
                }
                
                try {
                    // Executar operação atômica
                    if (op.type === 'save') {
                        await this._atomicSave(op.key, op.itemKey, op.data);
                    } else if (op.type === 'delete') {
                        await this._atomicDelete(op.key, op.itemKey);
                    } else {
                        console.warn(`⚠️ Tipo de operação desconhecido: ${op.type}`);
                    }
                    
                    // Sucesso: remover da fila mantendo FIFO
                    this.pendingOperations.splice(index, 1);
                    this._localOpsQueue = this._localOpsQueue.filter(x => x.id !== op.id);
                    this._updateSyncState({ processedCount: this.syncState.processedCount + 1, pendingCount: this.pendingOperations.length, lastSyncAt: Date.now(), status: this.connectionState ? 'online' : 'offline' });
                    this._notifySuccess(`Operação concluída: ${op.type} ${op.key}`);
                    try { window.dispatchEvent(new CustomEvent('sync:complete', { detail: { op } })); } catch {}
                    
                    // não incrementar index, pois removemos o elemento
                    continue;
                } catch (err) {
                    const classification = this._classifyError(err);
                    op.attempts += 1;
                    op.lastError = err.message;
                    
                    if (classification === 'permanent') {
                        console.error(`⛔ Falha permanente [${op.id}]: ${err.message}`);
                        op.status = 'failed';
                        // remover da fila para não bloquear as demais
                        this.pendingOperations.splice(index, 1);
                        this._localOpsQueue = this._localOpsQueue.filter(x => x.id !== op.id);
                        this._updateSyncState({ pendingCount: this.pendingOperations.length, lastError: err.message, status: 'error' });
                        this._notifyError(`Falha permanente: ${op.key}. Verifique permissões.`);
                        try { window.dispatchEvent(new CustomEvent('sync:error', { detail: { op, error: err, classification } })); } catch {}
                        continue;
                    } else {
                        // temporário: aplicar backoff exponencial
                        const base = op.baseBackoffMs || this._baseBackoffMs;
                        const backoff = Math.min(base * Math.pow(2, op.attempts - 1), this._maxBackoffMs);
                        op.nextAttemptAt = Date.now() + backoff;
                        op.status = 'retrying';
                        this._updateSyncState({ retriesCount: this.syncState.retriesCount + 1 });
                        this._notifyWarning(`Falha temporária. Nova tentativa em ${Math.round(backoff/1000)}s.`);
                        try { window.dispatchEvent(new CustomEvent('sync:error', { detail: { op, error: err, classification: 'temporary', nextAttemptAt: op.nextAttemptAt } })); } catch {}
                        // avançar para próximo item
                        index++;
                    }
                }
            }
        } finally {
            this._processingQueue = false;
            if (this.pendingOperations.length === 0) {
                this._updateSyncState({ status: this.connectionState ? 'online' : 'offline' });
                this._notifyInfo(`Fila vazia. Sincronização em dia.`);
            } else {
                // Agendar próximo ciclo para quando a próxima operação estiver pronta
                const next = Math.min(...this.pendingOperations.map(op => op.nextAttemptAt - Date.now()));
                const delay = Math.max(next, 1000);
                clearTimeout(this._queueTimer);
                this._queueTimer = setTimeout(() => this.processPendingOperations(), delay);
            }
        }
    }

    async _atomicSave(key, itemKey, data) {
        // Operação atômica direta no RTDB para evitar re-enfileiramento
        const pathBase = this.getFirebasePath(key);
        if (!pathBase) throw new Error(`Caminho Firebase inválido para chave: ${key}`);
        const path = itemKey ? `${pathBase}/${itemKey}` : pathBase;
        const payload = { ...data, _syncedAt: new Date().toISOString() };
        await this.db.ref(path).set(payload);
        return payload;
    }

    async _atomicDelete(key, itemKey) {
        const pathBase = this.getFirebasePath(key);
        if (!pathBase) throw new Error(`Caminho Firebase inválido para chave: ${key}`);
        const path = itemKey ? `${pathBase}/${itemKey}` : pathBase;
        await this.db.ref(path).remove();
        return true;
    }

    _classifyError(error) {
        const msg = (error && error.message || '').toLowerCase();
        if (msg.includes('permission_denied') || msg.includes('permission denied')) return 'permanent';
        if (msg.includes('auth') && msg.includes('required')) return 'permanent';
        if (msg.includes('network') || msg.includes('timeout') || msg.includes('unavailable')) return 'temporary';
        return 'temporary';
    }

    _updateSyncState(partial) {
        this.syncState = { ...this.syncState, ...partial };
        // Emitir evento global
        try {
            window.dispatchEvent(new CustomEvent('sync:status', { detail: { state: this.syncState } }));
        } catch {}
    }

    getSyncState() {
        return this.syncState;
    }

    _initSyncNotifier() {
        if (this._syncNotifierInitialized || typeof document === 'undefined') return;
        this._syncNotifierInitialized = true;
        
        const banner = document.createElement('div');
        banner.id = 'syncStatusBanner';
        banner.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:9999;background:#1f2937;color:#fff;padding:8px 12px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-size:12px;max-width:300px;display:flex;align-items:center;gap:8px;';
        banner.innerHTML = `<span id="syncStatusIcon">🔄</span><span id="syncStatusText">Sincronização</span>`;
        document.body.appendChild(banner);
    }

    _setBanner(text, icon = '🔄', bg = '#1f2937') {
        const el = document.getElementById('syncStatusBanner');
        if (!el) return;
        el.style.background = bg;
        const iconEl = document.getElementById('syncStatusIcon');
        const textEl = document.getElementById('syncStatusText');
        if (iconEl) iconEl.textContent = icon;
        if (textEl) textEl.textContent = text;
    }

    _notifyInfo(text) { this._setBanner(text, '🔄', '#1f2937'); }
    _notifySuccess(text) { this._setBanner(text, '✅', '#065f46'); }
    _notifyWarning(text) { this._setBanner(text, '⚠️', '#92400e'); }
    _notifyError(text) { this._setBanner(text, '⛔', '#7f1d1d'); }

    /**
     * AUTENTICAÇÃO
     */
    async login(email, password) {
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            console.log(`✅ Login realizado: ${email}`);
            return {
                success: true,
                user: result.user
            };
        } catch (error) {
            console.error(`❌ Erro no login:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async logout() {
        try {
            await this.auth.signOut();
            this.cache.clear(); // Limpar cache ao deslogar
            console.log(`✅ Logout realizado`);
            return { success: true };
        } catch (error) {
            console.error(`❌ Erro no logout:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * UTILITÁRIOS
     */
    getDataSize(data) {
        if (Array.isArray(data)) {
            return `${data.length} itens`;
        } else if (typeof data === 'object') {
            return `${Object.keys(data).length} propriedades`;
        } else {
            return `${typeof data}`;
        }
    }

    /**
     * CLEANUP
     */
    cleanup() {
        // Remover listeners
        this.listeners.forEach((unsubscribe, key) => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.listeners.clear();
        
        // Limpar cache
        this.cache.clear();
        
        console.log('🧹 Firebase Service cleanup realizado');
    }
}

/**
 * CRIAR INSTÂNCIA ÚNICA (SINGLETON)
 */
const unifiedFirebaseService = new UnifiedFirebaseService();

/**
 * FUNÇÕES DE COMPATIBILIDADE COM SISTEMA LEGADO
 */
const firebaseService = {
    // Configuração exposta para diagnóstico
    config: FIREBASE_CONFIG,
    
    // Métodos principais
    loadFromFirebase: (key) => unifiedFirebaseService.loadFromFirebase(key),
    getFromFirebase: (key) => unifiedFirebaseService.loadFromFirebase(key),
    saveToFirebase: (key, itemKey, data) => unifiedFirebaseService.saveToFirebase(key, itemKey, data),
    deleteFromFirebase: (key, itemKey) => unifiedFirebaseService.deleteFromFirebase(key, itemKey),
    
    // Métodos auxiliares
    isFirebaseOperational: () => unifiedFirebaseService.isFirebaseOperational(),
    getCurrentUser: () => unifiedFirebaseService.getCurrentUser(),

    // Helpers de sincronização e fila
    getFirebasePath: (key) => unifiedFirebaseService.getFirebasePath(key),
    getSyncState: () => unifiedFirebaseService.getSyncState(),
    getSyncPolicies: () => unifiedFirebaseService.getSyncPolicies(),
    isCollectionEligibleForSync: (key) => unifiedFirebaseService.isCollectionEligibleForSync(key),
    enqueuePendingOperation: (op) => unifiedFirebaseService.enqueuePendingOperation(op),
    processPendingOperations: () => unifiedFirebaseService.processPendingOperations(),
    
    // Autenticação
    authService: {
        login: (email, password) => unifiedFirebaseService.login(email, password),
        logout: () => unifiedFirebaseService.logout(),
        getCurrentUser: () => unifiedFirebaseService.getCurrentUser()
    }
};

/**
 * DISPONIBILIZAR GLOBALMENTE PARA COMPATIBILIDADE
 */
if (typeof window !== 'undefined') {
    window.firebaseService = firebaseService;
    window.unifiedFirebaseService = unifiedFirebaseService;
    
    // Expor configuração globalmente para diagnóstico
    window.FIREBASE_CONFIG = FIREBASE_CONFIG;
    
    console.log('🌐 Firebase Service Unificado disponível globalmente');
}

/**
 * AUTO-INICIALIZAÇÃO DO SISTEMA
 */
console.log('🚀 Firebase Service Unificado carregado');
