/**
 * 🔥 FIREBASE SERVICE UNIFICADO - ROMANEIO TL
 * 
 * Sistema unificado de gerenciamento Firebase com:
 * - Prioridade Firebase sobre localStorage
 * - Sincronização automática quando online
 * - Fallback inteligente para localStorage
 * - Cache otimizado
 * - Compatibilidade com romaneiopct
 * - Proteção contra Recursão/Stack Overflow
 * 
 * @version 2.1.0
 * @author Sistema Modular
 */

class FirebaseServiceTL {
    constructor() {
        this.isOnline = navigator.onLine;
        this.isFirebaseAvailable = false;
        this.currentUid = null;
        this.syncQueue = new Map();
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
        this.tenantId = null;
        
        this.init();
    }

    /**
     * 🔧 Inicializar serviço Firebase
     */
    async init() {
        console.log('🔥 Inicializando Firebase Service TL...');
        
        try {
            // ✅ CONFIGURAÇÃO FIREBASE CORRETA - PROJETO SISWEB-7CE82
            const firebaseConfig = {
                apiKey: "AIzaSyCF_9e067URYnB6iGnTAahPfaTMl-RQ77k",
                authDomain: "sisweb-7ce82.firebaseapp.com",
                databaseURL: "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app",
                projectId: "sisweb-7ce82",
                storageBucket: "sisweb-7ce82.firebasestorage.app",
                messagingSenderId: "240003261222",
                appId: "1:240003261222:web:1aeaf919ddc7e5c691d7e7",
                measurementId: "G-FTC6JZ5ZGX"
            };
            
            // Verificar se Firebase está disponível
            if (typeof firebase !== 'undefined') {
                // Inicializar apenas se não foi inicializado
                if (firebase.apps.length === 0) {
                    firebase.initializeApp(firebaseConfig);
                    console.log('✅ Firebase inicializado com nova configuração');
                } else {
                    console.log('✅ Firebase já inicializado, reutilizando');
                }
                
                this.database = firebase.database();
                this.db = this.database; // Alias para compatibilidade com outros módulos
                this.isFirebaseAvailable = true;
                console.log('✅ Firebase conectado com sucesso');

                try {
                    // Garantir que o módulo de Auth esteja carregado
                    if (!firebase.auth) {
                        try {
                            await import("https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js");
                        } catch (e) {
                            console.warn('⚠️ Falha ao carregar Firebase Auth compat:', e && e.message || e);
                        }
                    }
                    if (firebase.auth) {
                        const auth = firebase.auth();
                        auth.onAuthStateChanged((user) => {
                            if (user) {
                                this.currentUid = user.uid;
                                console.log('🔐 Auth pronto (uid):', user.uid);
                                (async () => {
                                    let companyId = null;
                                    try {
                                        const snap = await firebase.database().ref(`users/${user.uid}`).once('value');
                                        const profile = snap && typeof snap.val === 'function' ? snap.val() : null;
                                        companyId = profile && (profile.companyId || profile.companyID || profile.tenantId) || null;
                                    } catch (_) {}
                                    if (!companyId) {
                                        try {
                                            if (typeof user.getIdTokenResult === 'function') {
                                                const token = await user.getIdTokenResult(true);
                                                companyId = token && token.claims && (token.claims.companyId || token.claims.companyID || token.claims.tenantId) || null;
                                            }
                                        } catch (_) {}
                                    }
                                    if (companyId) {
                                        this.setTenantId(companyId);
                                        try {
                                            const raw = localStorage.getItem('company_info');
                                            const prev = raw ? JSON.parse(raw) : {};
                                            const next = { ...prev, companyId: String(companyId), id: prev.id || String(companyId) };
                                            localStorage.setItem('company_info', JSON.stringify(next));
                                            window.companyInfo = next;
                                        } catch (_) {}
                                    } else {
                                        this.setTenantId(null);
                                        try {
                                            localStorage.removeItem('company_info');
                                        } catch (_) {}
                                        try {
                                            window.companyInfo = null;
                                        } catch (_) {}
                                    }
                                })();
                                try {
                                    window.dispatchEvent(new CustomEvent('firebaseReady', { detail: { firebaseService: this, isReady: true } }));
                                } catch (_) {}
                            } else {
                                this.currentUid = null;
                                this.setTenantId(null);
                            }
                        });
                        if (window.ENABLE_ANON_AUTH === true && !auth.currentUser) {
                            try { await auth.signInAnonymously(); } catch (e) { console.warn('⚠️ Falha ao autenticar anonimamente:', e && e.message || e); }
                        }
                    } else {
                        console.warn('⚠️ Firebase Auth não disponível');
                    }
                } catch (authErr) {
                    console.warn('⚠️ Erro ao configurar autenticação:', authErr && authErr.message || authErr);
                }
                
                // Configurar listeners de conexão
                this.setupConnectionListeners();
                
                // Processar fila de sincronização
                this.processSyncQueue();
            } else {
                console.warn('⚠️ Firebase não disponível, usando localStorage');
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar Firebase:', error);
            this.isFirebaseAvailable = false;
        }

        // Monitorar status de conexão (via manager compat, se existir)
        try {
            const manager = window.getFirebaseManager ? window.getFirebaseManager() : null;
            if (manager) {
                manager.on('connected', () => {
                    this.isOnline = true;
                    this.processSyncQueue();
                });
                manager.on('disconnected', () => {
                    this.isOnline = false;
                });
            } else {
                // Fallback para eventos nativos
                window.addEventListener('online', () => {
                    this.isOnline = true;
                    this.processSyncQueue();
                });
                window.addEventListener('offline', () => {
                    this.isOnline = false;
                });
            }
        } catch (e) {
            console.warn('⚠️ Falha ao integrar com compat manager:', e.message);
        }
    }

    /**
     * 🔌 Configurar listeners de conexão Firebase
     */
    setupConnectionListeners() {
        if (!this.isFirebaseAvailable) return;

        // Se existir manager compat, delegar; senão manter compat direto
        try {
            const manager = window.getFirebaseManager ? window.getFirebaseManager() : null;
            if (manager) {
                manager.on('connected', () => this.processSyncQueue());
            } else {
                const connectedRef = this.database.ref('.info/connected');
                connectedRef.on('value', (snapshot) => {
                    if (snapshot.val() === true) {
                        console.log('🟢 Firebase conectado');
                        this.processSyncQueue();
                    } else {
                        console.log('🔴 Firebase desconectado');
                    }
                });
            }
        } catch (e) {
            console.warn('⚠️ Falha ao configurar listeners com compat manager:', e.message);
        }
    }

    setTenantId(id) {
        this.tenantId = id ? String(id) : null;
        try {
            if (typeof window !== 'undefined') window.appTenantId = this.tenantId;
        } catch (_) {}
    }

    // Normalizar tenant ID para evitar uso de users/ como root
    getTenantId() {
        try {
            if (this.tenantId) return String(this.tenantId);
            if (typeof window !== 'undefined' && window.appTenantId) {
                return String(window.appTenantId);
            }
            if (typeof window !== 'undefined' && window.companyInfo) {
                const info = window.companyInfo;
                const fromWindow = info && (info.companyId || info.companyID || info.tenantId || info.id);
                if (fromWindow) return String(fromWindow);
            }
            const raw = localStorage.getItem('company_info');
            if (raw) {
                const info = JSON.parse(raw);
                const fromStorage = info && (info.companyId || info.companyID || info.tenantId || info.id);
                if (fromStorage) return String(fromStorage);
            }
        } catch (_) {}
        return null;
    }

    isTenantAuditDebugEnabled() {
        try {
            if (typeof window !== 'undefined' && window.__TENANT_AUDIT_DEBUG === true) return true;
        } catch (_) {}
        try {
            const qs = new URLSearchParams(window.location.search || '');
            const value = String(qs.get('tenantAudit') || qs.get('tenantDebug') || '').toLowerCase();
            if (value === '1' || value === 'true' || value === 'on') return true;
        } catch (_) {}
        try {
            const stored = String(localStorage.getItem('__TENANT_AUDIT_DEBUG__') || '').toLowerCase();
            if (stored === '1' || stored === 'true' || stored === 'on') return true;
        } catch (_) {}
        return false;
    }

    getAuditScreenPath() {
        try {
            return window.location && window.location.pathname ? String(window.location.pathname) : 'unknown';
        } catch (_) {
            return 'unknown';
        }
    }

    shouldAuditPath(path) {
        const base = String(path || '').toLowerCase();
        const screen = this.getAuditScreenPath().toLowerCase();
        if (screen.includes('romaneio') || screen.includes('preromaneio')) return true;
        return base.includes('romaneio') || base.includes('preromaneio');
    }

    tenantAuditLog(operation, rawPath, finalPath) {
        try {
            if (!this.isTenantAuditDebugEnabled()) return;
            if (!this.shouldAuditPath(rawPath) && !this.shouldAuditPath(finalPath)) return;
            const tenant = this.getTenantId() || '__no_tenant__';
            const path = String(rawPath || '');
            const resolved = String(finalPath || '');
            const screen = this.getAuditScreenPath();
            console.log(`[AUDIT][${String(operation || '').toUpperCase()}] tenant=${tenant} path=${path} final=${resolved} screen=${screen} service=firebaseServiceTL`);
        } catch (_) {}
    }

    // Namespace final
    getNamespacedPath(path) {
        try {
            const clean = String(path || '').replace(/^\/+/, '');
            
            // 1. Caminhos absolutos (já começam com companies/ ou users/) não devem ser alterados
            if (!clean || /^companies\//.test(clean) || /^users\//.test(clean)) return clean;
            
            // 2. Obter Tenant ID
            const tenant = this.getTenantId();
            
            // 3. Se não tiver tenant, permitir apenas dados privados do usuário
            if (!tenant) {
                if (this.currentUid && (clean === 'settings' || clean === 'profile')) {
                    return `users/${this.currentUid}/${clean}`;
                }
                return `companies/__no_tenant__/${clean}`;
            }
            
            // 4. Se o tenant for igual ao UID do usuário, forçar 'companies/{uid}' em vez de 'users/{uid}'
            // Isso previne que dados de negócio (species, clients) caiam em /users
            return `companies/${tenant}/${clean}`;
            
        } catch (_) {
            return path;
        }
    }

    resolveWritePath(path) {
        return this.getNamespacedPath(path);
    }

    // Normalizar chaves para caminhos permitidos pelas regras (prioriza caminhos plurais)
    resolveReadCandidates(key) {
        const map = {
            // TL
            'romaneiosTL': ['romaneiosTL', 'romaneios/tl', 'romaneios_tl'],
            'romaneios_tl': ['romaneios_tl', 'romaneios/tl', 'romaneiosTL'],
            'romaneioTL': ['romaneios/tl', 'romaneios_tl', 'romaneiosTL'],
            'romaneio_tl': ['romaneios/tl', 'romaneios_tl', 'romaneiosTL'],
            // PCT
            'romaneiosPct': ['romaneios/pct', 'romaneios_pct'],
            'romaneios_pct': ['romaneios/pct', 'romaneios_pct'],
            'romaneioPct': ['romaneios/pct', 'romaneios_pct'],
            'romaneio_pct': ['romaneios/pct', 'romaneios_pct'],
            // Tora
            'romaneiosTora': ['romaneios/tora', 'romaneios_tora'],
            'romaneios_tora': ['romaneios/tora', 'romaneios_tora'],
            'romaneioTora': ['romaneios/tora', 'romaneios_tora'],
            // Pes
            'romaneiosPes': ['romaneios/pes', 'romaneios_pes'],
            'romaneios_pes': ['romaneios/pes', 'romaneios_pes'],
            'romaneioPes': ['romaneios/pes', 'romaneios_pes'],
            'romaneiopes': ['romaneios/pes', 'romaneios_pes']
        };

        const candidates = [];
        const seen = new Set();
        const push = (p) => { if (p && !seen.has(p)) { seen.add(p); candidates.push(p); } };

        // Preferir mapeamentos conhecidos
        if (map[key]) {
            map[key].forEach(push);
        }

        // Para romaneiosCamelCase (ex.: romaneiosTora), gerar caminho com barra
        const camel = key.match(/^romaneios([A-Z][a-zA-Z]*)$/);
        if (camel) {
            push(`romaneios/${camel[1].toLowerCase()}`);
        }

        // Para snake romaneios_x, gerar caminho com barra
        if (key.startsWith('romaneios_')) {
            push(`romaneios/${key.replace('romaneios_', '')}`);
        }

        // Manter chave original por último para compatibilidades locais
        push(key);

        return candidates;
    }

    getLocalStorageKeys(key) {
        const keys = [];
        try {
            const base = String(key || '');
            if (!base) return keys;
            const ns = this.getNamespacedPath(base);
            if (ns && ns !== base) {
                keys.push(ns);
                return [...new Set(keys)];
            }
            if (ns && /^companies\//.test(ns)) {
                keys.push(ns);
                return [...new Set(keys)];
            }
        } catch (_) {
            if (key) return [];
        }
        return [...new Set(keys)];
    }

    readLocalStorage(key) {
        for (const k of this.getLocalStorageKeys(key)) {
            const val = localStorage.getItem(k);
            if (val) return val;
        }
        return null;
    }

    writeLocalStorage(key, data) {
        try {
            const payload = JSON.stringify(data);
            for (const k of this.getLocalStorageKeys(key)) {
                try { localStorage.setItem(k, payload); } catch (_) {}
            }
        } catch (_) {}
    }

    removeLocalStorage(key) {
        for (const k of this.getLocalStorageKeys(key)) {
            try { localStorage.removeItem(k); } catch (_) {}
        }
    }

    /**
     * 🔐 Serviço de Autenticação (Compatibilidade com auth.js)
     */
    get authService() {
        if (!this.isFirebaseAvailable || typeof firebase === 'undefined' || !firebase.auth) {
            return null;
        }
        const auth = firebase.auth();
        const self = this;
        
        return {
            getAuth: () => auth,
            
            getCurrentUser: () => {
                return new Promise((resolve) => {
                    const unsubscribe = auth.onAuthStateChanged(
                        (user) => {
                            unsubscribe();
                            resolve(user);
                        },
                        () => {
                            unsubscribe();
                            resolve(null);
                        }
                    );
                    // Timeout de segurança
                    setTimeout(() => {
                        unsubscribe();
                        resolve(auth.currentUser);
                    }, 2000);
                });
            },
            
            login: async (email, password) => {
                try {
                    const cred = await auth.signInWithEmailAndPassword(email, password);
                    return { success: true, user: cred.user };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },
            
            logout: async () => {
                try {
                    await auth.signOut();
                    return { success: true };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },
            
            registerUser: async (email, password, companyId) => {
                try {
                    const cred = await auth.createUserWithEmailAndPassword(email, password);
                    const user = cred.user;
                    // Salvar dados do usuário
                    await self.saveData(`users/${user.uid}`, {
                        email: email,
                        companyId: companyId,
                        createdAt: new Date().toISOString()
                    });
                    return { success: true, user: user };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            },
            
            onAuthStateChanged: (callback) => {
                return auth.onAuthStateChanged(callback);
            }
        };
    }

    /**
     * 💾 Salvar dados com prioridade Firebase
     */
    async saveData(key, data) {
        console.log(`💾 Salvando dados: ${key}`);
        
        // ✅ SANITIZAÇÃO DE SEGURANÇA (CRÍTICO)
        if (key && (key.includes('romaneios') || key.includes('romaneioTora'))) {
            try {
                if (Array.isArray(data)) {
                    data = data.map(item => {
                        if (item && typeof item === 'object') {
                            if ((!item.numero || item.numero === '') && item.id) {
                                item.numero = String(item.id);
                            } else if (!item.numero && !item.id) {
                                item.numero = 'AUTO-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
                            }
                            if (item.numero) item.numero = String(item.numero);
                        }
                        return item;
                    });
                } else if (data && typeof data === 'object') {
                    if ((!data.numero || data.numero === '') && data.id) {
                        data.numero = String(data.id);
                    }
                    Object.keys(data).forEach(k => {
                        const item = data[k];
                        if (item && typeof item === 'object') {
                            if ((!item.numero || item.numero === '') && (item.id || k)) {
                                item.numero = String(item.id || k);
                            }
                        }
                    });
                }
            } catch (sanitError) {
                console.warn('⚠️ Erro na sanitização de romaneios:', sanitError);
            }
        }
        
        const timestamp = Date.now();
        const dataWithMeta = {
            ...data,
            _metadata: {
                lastUpdated: timestamp,
                source: 'firebase'
            }
        };

        try {
            if (this.isFirebaseAvailable && this.isOnline) {
                const writePath = this.getNamespacedPath(key);
                this.tenantAuditLog('WRITE', key, writePath);
                const refKey = this.database.ref(writePath);
                
                const payload = { ...dataWithMeta };
                await refKey.update(payload);
                console.log(`✅ Dados atualizados no Firebase (update): ${writePath}`);
                
                this.writeLocalStorage(key, dataWithMeta);
                
                this.cache.set(key, {
                    data: dataWithMeta,
                    timestamp: timestamp
                });
                
                return { success: true, source: 'firebase' };
            } else {
                const localData = { ...dataWithMeta, _metadata: { ...dataWithMeta._metadata, source: 'localStorage' } };
                this.writeLocalStorage(key, localData);
                this.syncQueue.set(key, localData);
                console.log(`📦 Dados salvos no localStorage (fila): ${key}`);
                return { success: true, source: 'localStorage', queued: true };
            }
        } catch (error) {
            console.error(`❌ Erro ao salvar ${key}:`, error);
            const fallbackData = { ...dataWithMeta, _metadata: { ...dataWithMeta._metadata, source: 'localStorage' } };
            this.writeLocalStorage(key, fallbackData);
            this.syncQueue.set(key, fallbackData);
            return { success: false, error: error.message, fallback: true };
        }
    }

    /**
     * 📖 Carregar dados com prioridade Firebase - COMPATÍVEL COM ROMANEIOPCT
     */
    async loadFromFirebase(path) {
        console.log(`🔥 loadFromFirebase: Carregando "${path}" do Firebase`);
        
        try {
            if (!this.isFirebaseAvailable || !this.isOnline) {
                return {
                    success: false,
                    error: 'Firebase não disponível ou offline',
                    data: null
                };
            }
            const candidates = this.resolveReadCandidates(path);
            for (const candidate of candidates) {
                try {
                    const nsCandidate = this.getNamespacedPath(candidate);
                    this.tenantAuditLog('READ', path, nsCandidate);
                    
                    // ✅ PROTEÇÃO CONTRA STACK OVERFLOW / RECURSION
                    // Se o get() modular falhar, tentar o compat como fallback
                    let data = null;
                    let exists = false;

                    try {
                        const snapshot = await this.database.ref(nsCandidate).once('value');
                        data = snapshot.val();
                        exists = (data !== null && data !== undefined);
                    } catch (getError) {
                        if (getError.message && getError.message.includes('Maximum call stack size exceeded')) {
                            console.warn(`⚠️ Erro de recursão no SDK Modular para '${candidate}'. Tentando REST API como fallback...`);
                            
                            // Tentar REST API se o SDK falhar com stack overflow
                            try {
                                // Construir URL REST
                                const cleanPath = nsCandidate.startsWith('/') ? nsCandidate.slice(1) : nsCandidate;
                                const dbUrl = "https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app";
                                let url = `${dbUrl}/${cleanPath}.json`;
                                
                                // Adicionar auth token se disponível
                                if (firebase.auth && firebase.auth().currentUser) {
                                    try {
                                        const token = await firebase.auth().currentUser.getIdToken();
                                        url += `?auth=${token}`;
                                    } catch (_) {}
                                }
                                
                                const response = await fetch(url);
                                if (response.ok) {
                                    data = await response.json();
                                    exists = (data !== null);
                                    console.log(`✅ Dados recuperados via REST API para ${candidate}`);
                                } else {
                                    throw new Error(`REST API retornou ${response.status}`);
                                }
                            } catch (restError) {
                                console.warn(`⚠️ Falha no fallback REST API:`, restError);
                                throw getError; // Se falhar REST, relançar
                            }
                        } else {
                            throw getError;
                        }
                    }

                    if (exists) {
                        // Cache e localStorage
                        this.cache.set(path, { data, timestamp: Date.now() });
                        this.cache.set(candidate, { data, timestamp: Date.now() });
                        this.cache.set(nsCandidate, { data, timestamp: Date.now() });
                        this.writeLocalStorage(path, data);
                        this.writeLocalStorage(candidate, data);
                        this.writeLocalStorage(nsCandidate, data);
                        return { success: true, data };
                    }
                } catch (e) {
                    const msg = String(e && e.message || e);
                    if (msg.toLowerCase().includes('permission_denied')) {
                        console.warn(`⚠️ Permissão negada em '${candidate}', tentando próximo alias`);
                        continue;
                    }
                    console.warn(`⚠️ Erro ao consultar '${candidate}':`, msg);
                }
            }
            return { success: false, error: 'Nenhum dado encontrado', data: null };

        } catch (error) {
            console.error(`❌ Erro ao carregar ${path}:`, error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * 📖 Carregar dados com prioridade Firebase (método original)
     */
    async loadData(key) {
        // Redirecionar para o método mais robusto
        const result = await this.loadFromFirebase(key);
        if (result.success) {
            return result.data;
        }
        
        // Fallback para localStorage
        const localData = this.readLocalStorage(key);
        if (localData) {
            try {
                return JSON.parse(localData);
            } catch (_) {}
        }
        
        return null;
    }

    /**
     * 🔄 Processar fila de sincronização
     */
    async processSyncQueue() {
        if (!this.isFirebaseAvailable || !this.isOnline || this.syncQueue.size === 0) {
            return;
        }

        console.log(`🔄 Processando fila de sincronização: ${this.syncQueue.size} itens`);

        for (const [key, data] of this.syncQueue) {
            try {
                const refKey = this.database.ref(this.getNamespacedPath(key));
                const snap = await refKey.once('value');
                const remote = snap.val() || null;
                const remoteMeta = (remote && remote._metadata && remote._metadata.lastUpdated) ? Number(remote._metadata.lastUpdated) : 0;
                const localMeta = (data && data._metadata && data._metadata.lastUpdated) ? Number(data._metadata.lastUpdated) : 0;
                if (remoteMeta && remoteMeta >= localMeta) {
                    console.log(`⏭️ Ignorando sync (remoto mais recente): ${key}`);
                } else {
                    const payload = { ...data };
                    await refKey.update(payload);
                    console.log(`✅ Sincronizado (update): ${key}`);
                }
                this.syncQueue.delete(key);
            } catch (error) {
                console.error(`❌ Erro ao sincronizar ${key}:`, error);
            }
        }

        if (this.syncQueue.size === 0) {
            console.log('✅ Fila de sincronização processada completamente');
        }
    }

    /**
     * 🗑️ Excluir dados
     */
    async deleteData(key) {
        console.log(`🗑️ Excluindo dados: ${key}`);
        const writePath = this.resolveWritePath(key);
        this.tenantAuditLog('DELETE', key, writePath);

        try {
            if (this.isFirebaseAvailable && this.isOnline) {
                await this.database.ref(writePath).remove();
                console.log(`✅ Dados excluídos do Firebase: ${writePath}`);
            }

            // Remover do localStorage
            this.removeLocalStorage(key);
            if (key !== writePath) this.removeLocalStorage(writePath);
            
            // Remover do cache
            this.cache.delete(key);
            if (key !== writePath) this.cache.delete(writePath);
            
            // Remover da fila de sincronização
            this.syncQueue.delete(writePath);

            return { success: true };
        } catch (error) {
            console.error(`❌ Erro ao excluir ${key}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 📊 Status do serviço
     */
    getStatus() {
        return {
            isOnline: this.isOnline,
            isFirebaseAvailable: this.isFirebaseAvailable,
            queueSize: this.syncQueue.size,
            cacheSize: this.cache.size
        };
    }

    /**
     * 🧹 Limpar cache
     */
    clearCache() {
        this.cache.clear();
        console.log('🧹 Cache limpo');
    }
}

// 🌐 Instância global
window.firebaseServiceTL = new FirebaseServiceTL();

// 📤 Exportar funções para compatibilidade
if (!window.FirebaseService) window.FirebaseService = window.firebaseServiceTL;
if (!window.firebaseService) window.firebaseService = window.firebaseServiceTL;

// ✅ INJEÇÃO DE DEPENDÊNCIA: Garantir que authService esteja disponível no objeto global
if (window.firebaseService && !window.firebaseService.authService) {
    Object.defineProperty(window.firebaseService, 'authService', {
        get: () => window.firebaseServiceTL.authService
    });
}

window.saveDataTL = (key, data) => window.firebaseServiceTL.saveData(key, data);
window.getDataTL = (key) => window.firebaseServiceTL.loadData(key);
window.deleteDataTL = (key) => window.firebaseServiceTL.deleteData(key);
window.firebaseServiceTL.getFromFirebase = (key) => window.firebaseServiceTL.loadFromFirebase(key);

// ✅ COMPATIBILIDADE: Métodos alternativos para os módulos
window.firebaseServiceTL.getData = window.firebaseServiceTL.loadData;
window.firebaseServiceTL.saveData = window.firebaseServiceTL.saveData;
window.firebaseServiceTL.deleteData = window.firebaseServiceTL.deleteData;
window.firebaseServiceTL.loadFromFirebase = window.firebaseServiceTL.loadFromFirebase;

console.log('🔥 Firebase Service TL carregado com sucesso (v2.1.0)');
