// firebaseService.unified.js - v3.4
// Sistema Unificado de Firebase com configuração REAL + Mock como Fallback

console.log('🔄 Iniciando firebaseService.unified.js v3.4...');

// 🔥 CONFIGURAÇÃO REAL DO FIREBASE - PROJETO SISWEB-7CE82
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

// ⚠️ CONFIGURAÇÃO ALTERNATIVA PARA TESTES (se a principal não funcionar)
const firebaseConfigAlternativa = {
    apiKey: "AIzaSyB_ALTERNATIVE_CONFIG_HERE",
    authDomain: "seu-projeto-backup.firebaseapp.com", 
    databaseURL: "https://seu-projeto-backup-default-rtdb.firebaseio.com/",
    projectId: "seu-projeto-backup",
    storageBucket: "seu-projeto-backup.appspot.com",
    messagingSenderId: "987654321",
    appId: "1:987654321:web:backup-app-id"
};

// ✅ CONFIGURAÇÃO REAL DETECTADA - PROJETO SISWEB-7CE82
const isFirebaseConfigReal = (
    firebaseConfig.apiKey.startsWith('AIzaSyCF_') && 
    firebaseConfig.projectId === 'sisweb-7ce82' &&
    !firebaseConfig.apiKey.includes('YOUR_REAL_API_KEY')
);
const tryRealFirebaseFirst = true;

// Para desenvolvimento - detectar se é localhost
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
console.log('🔧 Modo desenvolvimento:', isDevelopment);
console.log('🔥 Configuração Firebase real detectada:', isFirebaseConfigReal);
console.log('🌍 Projeto SISWEB-7CE82 - Região Ásia-Sudeste');
console.log('🔧 Tentando Firebase real primeiro:', tryRealFirebaseFirst);

// Aguardar Firebase estar disponível globalmente
async function aguardarFirebaseGlobal(timeoutMs = 10000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        let tentativas = 0;
        
        const verificar = () => {
            tentativas++;
            
            // ✅ SEMPRE TENTAR FIREBASE REAL PRIMEIRO
            if (typeof firebase !== 'undefined' && firebase && firebase.initializeApp) {
                console.log('✅ Firebase global detectado, tentando configuração real...');
                
                // Tentar inicializar Firebase com configuração real
                try {
                    let app;
                    if (!firebase.apps || firebase.apps.length === 0) {
                        console.log('🚀 Inicializando Firebase App com configuração real...');
                        app = firebase.initializeApp(firebaseConfig);
                        console.log('✅ Firebase App inicializado com configuração real');
                    } else {
                        app = firebase.apps[0];
                        console.log('✅ Firebase App já estava inicializado');
                    }
                    
                    try {
                        if (typeof firebase.performance === 'function') {
                            firebase.performance();
                            console.log('✅ Firebase Performance Monitoring ativado');
                        }
                    } catch (perfErr) {
                        console.warn('⚠️ Erro ao inicializar Firebase Performance:', perfErr);
                    }
                    
                    resolve({ firebase, app, isReady: true, isMock: false });
                    return;
                } catch (error) {
                    console.warn('⚠️ Erro na configuração principal, tentando alternativa:', error.message);
                    
                    // Tentar configuração alternativa
                    try {
                        const app = firebase.initializeApp(firebaseConfigAlternativa, 'alternative');
                        console.log('✅ Firebase App inicializado com configuração alternativa');
                        resolve({ firebase, app, isReady: true, isMock: false });
                        return;
                    } catch (altError) {
                        console.warn('⚠️ Erro na configuração alternativa:', altError.message);
                        
                        // Se estiver em desenvolvimento, usar mock como último recurso
                        if (isDevelopment) {
                            console.log('🔧 Modo desenvolvimento: usando mock como último recurso...');
                        } else {
                            console.error('❌ Firebase não disponível em produção');
                            throw new Error('Firebase real não disponível');
                        }
                    }
                }
            }
            
            // Verificar timeout
            if (Date.now() - startTime > timeoutMs) {
                if (isDevelopment) {
                    console.warn('⚠️ Timeout aguardando Firebase real, criando mock para desenvolvimento...');
                    const mockFirebase = createMockFirebase();
                    window.firebase = mockFirebase;
                    resolve({ firebase: mockFirebase, app: { name: 'mock-app' }, isReady: true, isMock: true });
                    return;
                } else {
                    throw new Error('Firebase não pôde ser carregado');
                }
            }
            
            if (tentativas % 10 === 0) {
                console.log(`⏳ Aguardando Firebase real... (tentativa ${tentativas})`);
            }
            
            setTimeout(verificar, 500);
        };
        
        verificar();
    });
}

// Função para criar Firebase mock com dados mais robustos (APENAS COMO ÚLTIMO RECURSO)
function createMockFirebase() {
    console.log('🧪 Criando Firebase mock com dados de exemplo (ÚLTIMO RECURSO)...');
    
    const mockDatabase = {
        species: {
            'sp1': { nome: 'Eucalipto', descricao: 'Eucalipto grandis - Madeira de crescimento rápido' },
            'sp2': { nome: 'Pinus', descricao: 'Pinus elliottii - Conífera para construção' },
            'sp3': { nome: 'Cedro', descricao: 'Cedro rosa - Madeira nobre para móveis' },
            'sp4': { nome: 'Araucária', descricao: 'Araucaria angustifolia - Pinheiro brasileiro' },
            'sp5': { nome: 'Mogno', descricao: 'Swietenia macrophylla - Madeira de luxo' }
        },
        clients: {
            'cl1': { nome: 'Madeireira Silva', email: 'silva@madeiras.com', telefone: '(11) 9999-0001' },
            'cl2': { nome: 'Serraria Santos', email: 'santos@serraria.com', telefone: '(11) 9999-0002' },
            'cl3': { nome: 'Móveis & Cia', email: 'moveis@moveisecia.com', telefone: '(11) 9999-0003' }
        },
        romaneiosTora: {
            'rom1': { numero: '001', data: '2024-12-20', cliente: 'Madeireira Silva', total: 15000.00 },
            'rom2': { numero: '002', data: '2024-12-19', cliente: 'Serraria Santos', total: 8500.00 }
        }
    };
    
    return {
        apps: [{ name: 'mock-app' }],
        initializeApp: () => ({ name: 'mock-app' }),
        database: () => ({
            ref: (path) => ({
                once: (eventType) => Promise.resolve({
                    val: () => {
                        console.log(`🧪 Mock: Carregando dados de '${path}'`);
                        
                        if (mockDatabase[path]) {
                            console.log(`✅ Mock: ${Object.keys(mockDatabase[path]).length} registros encontrados em '${path}'`);
                            return mockDatabase[path];
                        }
                        
                        console.log(`⚠️ Mock: Nenhum dado encontrado para '${path}'`);
                        return null;
                    },
                    exists: () => !!mockDatabase[path],
                    key: path?.split('/').pop() || null
                }),
                set: (data) => {
                    console.log(`🧪 Mock database.ref(${path}).set():`, data);
                    mockDatabase[path] = data;
                    return Promise.resolve();
                },
                push: (data) => {
                    console.log(`🧪 Mock database.ref(${path}).push():`, data);
                    const key = 'mock-key-' + Date.now();
                    if (!mockDatabase[path]) mockDatabase[path] = {};
                    mockDatabase[path][key] = data;
                    return Promise.resolve({ key });
                },
                remove: () => {
                    console.log(`🧪 Mock database.ref(${path}).remove()`);
                    if (mockDatabase[path]) {
                        delete mockDatabase[path];
                    }
                    return Promise.resolve();
                },
                on: (eventType, callback) => {
                    console.log(`🧪 Mock database.ref(${path}).on(${eventType})`);
                    setTimeout(() => callback({ val: () => mockDatabase[path] || null }), 100);
                },
                off: () => {}
            })
        })
    };
}

// Classe principal do FirebaseService v3.4
class FirebaseService {
    constructor() {
        this.firebase = null;
        this.app = null;
        this.database = null;
        this.isReady = false;
        this.isMock = false;
        this.initPromise = null;
        this.currentUid = null;
        this.currentTenantId = null;
        
        // 🔧 Fallback e suporte local
        this._localOpsQueue = this._loadLocalOpsQueue ? this._loadLocalOpsQueue() : [];

        // 🔧 Mapeamento de aliases de caminho para compatibilidade
        // Canonizar para 'romaneios/tora' (caminho hierárquico no Firebase)
        this._PATH_ALIASES = {
            // TORA
            'romaneiosTora': 'romaneios/tora',
            'romaneios_tora': 'romaneios/tora',
            'romaneioTora': 'romaneios/tora',
            'romaneiosToras': 'romaneios/tora',
            'romaneios/Toras': 'romaneios/tora',
            'romaneios/tora': 'romaneios/tora',
            
            // PCT
            'romaneiosPct': 'romaneios/pct',
            'romaneios_pct': 'romaneios/pct',
            'romaneioPct': 'romaneios/pct',
            'romaneios/pct': 'romaneios/pct',
            
            // TL
            'romaneiosTl': 'romaneios/tl',
            'romaneios_tl': 'romaneios/tl',
            'romaneioTl': 'romaneios/tl',
            'romaneios/tl': 'romaneios/tl',
            
            // PES
            'romaneiosPes': 'romaneios/pes',
            'romaneios_pes': 'romaneios/pes',
            'romaneioPes': 'romaneios/pes',
            'romaneios/pes': 'romaneios/pes',
            
            // FORNECEDORES — coleção dedicada, NÃO misturar com clientes
            // 'fornecedores' → sem alias, usa o próprio caminho com namespace de empresa
            
            // CLIENTES (legado) — aliases para compatibilidade retroativa
            'clientesTora': 'clients',
            'clientes': 'clients',
            
            // ESPÉCIES
            'species': 'data/species',
            'especies': 'data/species',
            
            // EMPRESA (específico, não deve interceptar caminhos hierárquicos com 'companies')
            'empresaInfo': 'empresaInfo'
        };
        
        console.log('🔧 FirebaseService v3.4 instanciado');
    }
    
    async initialize() {
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = (async () => {
            await this._doInitialize();
            try {
                if (!this._syncLoopStarted) {
                    this._syncLoopStarted = true;
                    setInterval(() => { try { if (typeof this.flushLocalOps === 'function') this.flushLocalOps(); } catch(_) {} }, 5000);
                }
            } catch(_) {}
        })();
        return this.initPromise;
    }
    
    async _doInitialize() {
        try {
            console.log('🚀 Inicializando FirebaseService v3.4...');
            
            // Aguardar Firebase estar disponível
            const result = await aguardarFirebaseGlobal();
            this.firebase = result.firebase;
            this.app = result.app;
            this.isMock = result.isMock || false;
            
            if (this.isMock) {
                console.log('⚠️ Usando Firebase mock para desenvolvimento');
            } else {
                console.log('✅ Firebase real detectado e inicializado');
            }
            
            // Configurar serviços
            try {
                this.database = this.firebase.database();
                console.log('✅ Firebase Database configurado');
            } catch (error) {
                console.warn('⚠️ Erro ao configurar Database:', error.message);
                // Criar database mock
                this.database = {
                    ref: (path) => ({
                        once: () => Promise.resolve({ val: () => null, exists: () => false }),
                        set: () => Promise.resolve(),
                        push: () => Promise.resolve({ key: 'mock-key' }),
                        remove: () => Promise.resolve()
                    })
                };
            }

            // 🔐 Tentar autenticação anônima (se módulo Auth estiver disponível)
            try {
                if (this.firebase && typeof this.firebase.auth === 'function') {
                    await new Promise((resolve, reject) => {
                        const auth = this.firebase.auth();
                        let settled = false;
                        const done = (res) => { if (!settled) { settled = true; resolve(res); } };
                        const fail = (err) => { if (!settled) { settled = true; reject(err); } };
                        try {
                            auth.onAuthStateChanged((user) => {
                                if (user) {
                                    console.log('✅ Auth pronto (uid):', user.uid);
                                    this.currentUid = user.uid;
                                    done(user);
                                } else {
                                    auth.signInAnonymously().then(done).catch(fail);
                                }
                            }, fail);
                        } catch (e) {
                            console.warn('⚠️ onAuthStateChanged não disponível, tentando signInAnonymously direto...', e.message);
                            auth.signInAnonymously().then(done).catch(fail);
                        }
                    });
                } else {
                    console.warn('⚠️ Firebase Auth não disponível — prosseguindo sem autenticação');
                }
            } catch (authError) {
                console.warn('⚠️ Falha ao autenticar anonimamente:', authError.message);
            }
            
            this.isReady = true;
            window._FIREBASE_READY = true;
            
            console.log('✅ FirebaseService v3.4 inicializado com sucesso');
            
            // Disparar evento de Firebase pronto
            window.dispatchEvent(new CustomEvent('firebaseReady', {
                detail: { 
                    firebaseService: this, 
                    isMock: this.isMock,
                    isReady: true
                }
            }));
            
            return { success: true, isMock: this.isMock };
            
        } catch (error) {
            console.error('❌ Erro ao inicializar FirebaseService:', error);
            this.isReady = false;
            window._FIREBASE_READY = false;
            throw error;
        }
    }
    
    // Método para verificar se está pronto
    checkReady() {
        if (!this.isReady) {
            throw new Error('Firebase não está pronto. Aguarde a inicialização.');
        }
        return true;
    }
    
    // Método para carregar dados
    async loadData(path, options = {}) {
        try {
            await this.ensureReady();
            
            if (!this.database) {
                throw new Error('Database não está disponível');
            }
            
            // Normalizar caminho para acesso remoto ao Firebase
            let remotePath = this._normalizePath(path);
            if (remotePath !== path) {
                console.log(`🔁 Alias detectado: '${path}' → '${remotePath}'`);
            }
            try {
                const tenant = this.getCurrentTenantId ? this.getCurrentTenantId() : null;
                const uidPref = this.getCurrentUid ? this.getCurrentUid() : null;
                const shouldNamespace = true;
                if (shouldNamespace && tenant && remotePath && !/^companies\//.test(remotePath)) {
                    remotePath = `companies/${tenant}/${remotePath}`;
                    console.log(`📡 Namespace (empresa) aplicado para leitura: ${remotePath}`);
                } else if (shouldNamespace && uidPref && remotePath && !/^users\//.test(remotePath)) {
                    remotePath = `users/${uidPref}/${remotePath}`;
                    console.log(`📡 Namespace (usuário) aplicado para leitura: ${remotePath}`);
                }
            } catch (_) {}
            console.log(`📡 Carregando dados de: ${remotePath}`);
            
            // ✅ APLICAR PAGINAÇÃO E FILTROS (PLANO OTIMIZAÇÃO BLAZE)
            let query = this.database.ref(remotePath);
            if (options && typeof options === 'object') {
                if (options.orderByChild) {
                    query = query.orderByChild(options.orderByChild);
                    if (options.equalTo !== undefined) {
                        query = query.equalTo(options.equalTo);
                    } else if (options.startAt !== undefined) {
                        query = query.startAt(options.startAt);
                        if (options.endAt !== undefined) {
                            query = query.endAt(options.endAt);
                        }
                    }
                } else if (options.orderByKey) {
                    query = query.orderByKey();
                    if (options.startAt !== undefined) {
                        query = query.startAt(options.startAt);
                        if (options.endAt !== undefined) {
                            query = query.endAt(options.endAt);
                        }
                    }
                }

                if (options.limitToLast) {
                    query = query.limitToLast(options.limitToLast);
                } else if (options.limitToFirst) {
                    query = query.limitToFirst(options.limitToFirst);
                }
            }
            
            const snapshot = await query.once('value');
            const data = snapshot.val();
            
            if (data) {
                console.log(`✅ Dados carregados de ${remotePath}:`, Object.keys(data).length, 'itens');
                return { success: true, data, isMock: this.isMock };
            } else {
                console.log(`⚠️ Nenhum dado encontrado em ${remotePath}`);
                return { success: false, data: null, message: 'Nenhum dado encontrado', isMock: this.isMock };
            }
        } catch (error) {
            console.error(`❌ Erro ao carregar dados de ${path}:`, error);
            // 🔐 Fallback inteligente em permission_denied
            if (this._isPermissionDenied(error)) {
                try {
                    const tenant = this.getCurrentTenantId ? this.getCurrentTenantId() : null;
                    const uid = this.getCurrentUid ? this.getCurrentUid() : null;
                    const remotePath = this._normalizePath(path);
                    const shouldNamespace = true;
                    if (shouldNamespace && tenant && remotePath && !/^companies\//.test(remotePath)) {
                        const nsPath = `companies/${tenant}/${remotePath}`;
                        console.log(`📡 Tentando leitura em namespace empresa: ${nsPath}`);
                        const snapshotNs = await this.database.ref(nsPath).once('value');
                        const dataNs = snapshotNs.val();
                        if (dataNs) return { success: true, data: dataNs, isMock: this.isMock, namespaced: true };
                    } else if (shouldNamespace && uid && remotePath && !/^users\//.test(remotePath)) {
                        const nsPath = `users/${uid}/${remotePath}`;
                        console.log(`📡 Tentando leitura em namespace usuário: ${nsPath}`);
                        const snapshotNs = await this.database.ref(nsPath).once('value');
                        const dataNs = snapshotNs.val();
                        if (dataNs) return { success: true, data: dataNs, isMock: this.isMock, namespaced: true };
                    }
                } catch (_) {}
                // Tentar primeiro a chave original e depois a normalizada
                let local = this._getLocal(path);
                if ((local === null || local === undefined)) {
                    const altKey = this._normalizePath(path);
                    if (altKey && altKey !== path) {
                        local = this._getLocal(altKey);
                    }
                }
                if (local !== null && local !== undefined) {
                    console.warn(`🛡️ permission_denied em '${path}' — usando localStorage como fallback`);
                    return { success: true, data: local, isLocalFallback: true, isMock: this.isMock };
                }
                console.warn(`⚠️ permission_denied e nenhum dado local para '${path}'`);
                return { success: false, error: 'permission_denied', isLocalFallback: true, isMock: this.isMock };
            }
            // 🔄 Outros erros: ainda tentar localStorage para não bloquear UI
            let local = this._getLocal(path);
            if ((local === null || local === undefined)) {
                const altKey = this._normalizePath(path);
                if (altKey && altKey !== path) {
                    local = this._getLocal(altKey);
                }
            }
            if (local !== null && local !== undefined) {
                console.warn(`🔄 Usando localStorage para '${path}' devido a erro de leitura`);
                return { success: true, data: local, isLocalFallback: true, isMock: this.isMock };
            }
            return { success: false, error: error.message, isMock: this.isMock };
        }
    }
    
    // COMPATIBILIDADE: Método legado loadFromFirebase
    async loadFromFirebase(path) {
        console.log(`🔄 Usando método legado loadFromFirebase para: ${path}`);
        return this.loadData(path);
    }
    // COMPATIBILIDADE: Alias getFromFirebase para módulos legados
    async getFromFirebase(path) {
        return this.loadFromFirebase(path);
    }
    
    // Método para salvar dados
    async saveData(path, data) {
        try {
            await this.ensureReady();
            
            if (!this.database) {
                throw new Error('Database não está disponível');
            }
            
            // ✅ SANITIZAÇÃO DE EMERGÊNCIA PARA ROMANEIOS
            // Garante que a regra .validate "newData.hasChild('numero')" seja satisfeita
            if (path && (path.includes('romaneios') || path.includes('romaneioTora'))) {
                try {
                    if (Array.isArray(data)) {
                        console.log(`🛡️ Sanitizando array de romaneios antes do envio (${data.length} itens)`);
                        data = data.map(item => {
                            if (item && typeof item === 'object') {
                                // Garantir campo numero
                                if ((item.numero === undefined || item.numero === null || item.numero === '') && item.id) {
                                    item.numero = String(item.id);
                                } else if (!item.numero && !item.id) {
                                    item.numero = 'AUTO-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
                                }
                                // Garantir tipos primitivos para evitar erros de validação
                                if (item.numero) item.numero = String(item.numero);
                            }
                            return item;
                        });
                    } else if (data && typeof data === 'object') {
                        console.log(`🛡️ Sanitizando objeto de romaneios antes do envio`);
                        // Se for um único item sendo salvo
                        if ((data.numero === undefined || data.numero === null) && data.id) {
                            data.numero = String(data.id);
                        }
                        // Se for um mapa de itens
                        Object.keys(data).forEach(k => {
                            const item = data[k];
                            if (item && typeof item === 'object') {
                                if ((item.numero === undefined || item.numero === null) && (item.id || k)) {
                                    item.numero = String(item.id || k);
                                }
                            }
                        });
                    }
                } catch (sanitError) {
                    console.warn('⚠️ Erro na sanitização de romaneios:', sanitError);
                }
            }

            // Normalizar caminho para salvar remotamente
            let remotePath = this._normalizePath(path);
            if (remotePath !== path) {
                console.log(`🔁 Alias detectado para salvar: '${path}' → '${remotePath}'`);
            }
            try {
                const tenant = this.getCurrentTenantId ? this.getCurrentTenantId() : null;
                const uidPref = this.getCurrentUid ? this.getCurrentUid() : null;
                const shouldNamespace = true;
                if (shouldNamespace && tenant && remotePath && !/^companies\//.test(remotePath)) {
                    remotePath = `companies/${tenant}/${remotePath}`;
                    console.log(`💾 Namespace (empresa) aplicado para escrita: ${remotePath}`);
                } else if (shouldNamespace && uidPref && remotePath && !/^users\//.test(remotePath)) {
                    remotePath = `users/${uidPref}/${remotePath}`;
                    console.log(`💾 Namespace (usuário) aplicado para escrita: ${remotePath}`);
                }
            } catch (_) {}
            console.log(`💾 Salvando dados em: ${remotePath}`);
            try {
                const uidLog = this.getCurrentUid ? this.getCurrentUid() : null;
                if (uidLog) {
                    console.log(`🔐 UID atual: ${uidLog}`);
                }
            } catch (_) {}
            await this.database.ref(remotePath).set(data);
            console.log(`✅ Dados salvos em ${remotePath}`);
            return { success: true, isMock: this.isMock };
        } catch (error) {
            // 🔐 Fallback inteligente para permission_denied (sem erro vermelho)
            if (this._isPermissionDenied(error)) {
                try {
                    const remotePath = this._normalizePath(path);
                    const tenant = this.getCurrentTenantId ? this.getCurrentTenantId() : null;
                    const uid = this.getCurrentUid ? this.getCurrentUid() : null;
                    const shouldNamespace = true;
                    if (shouldNamespace && tenant && remotePath && !/^companies\//.test(remotePath)) {
                        const nsPath = `companies/${tenant}/${remotePath}`;
                        await this.database.ref(nsPath).set(data);
                        return { success: true, isMock: this.isMock, namespaced: true };
                    } else if (shouldNamespace && uid && remotePath && !/^users\//.test(remotePath)) {
                        const nsPath = `users/${uid}/${remotePath}`;
                        await this.database.ref(nsPath).set(data);
                        return { success: true, isMock: this.isMock, namespaced: true };
                    }
                } catch (nsErr) {
                    try { console.warn('⚠️ Falha ao salvar em namespace:', typeof nsErr === 'object' ? (nsErr.message || JSON.stringify(nsErr)) : String(nsErr)); } catch (_) {}
                }
                const { baseKey, itemKey } = this._splitPath(path);
                try {
                    if (itemKey) {
                        const updated = this._upsertLocalItem(baseKey, itemKey, data);
                        console.warn(`🛡️ permission_denied — upsert local de '${baseKey}/${itemKey}' (${updated.length} itens)`);
                        // Manter cache também na chave normalizada se diferente
                        const normalizedBase = this._splitPath(this._normalizePath(path)).baseKey;
                        if (normalizedBase && normalizedBase !== baseKey) {
                            this._upsertLocalItem(normalizedBase, itemKey, data);
                            console.warn(`🛡️ cache duplicado — '${normalizedBase}/${itemKey}' sincronizado`);
                        }
                    } else {
                        this._setLocal(baseKey, data);
                        console.warn(`🛡️ permission_denied — coleção '${baseKey}' salva no localStorage`);
                        const normalizedBase = this._splitPath(this._normalizePath(path)).baseKey;
                        if (normalizedBase && normalizedBase !== baseKey) {
                            this._setLocal(normalizedBase, data);
                            console.warn(`🛡️ cache duplicado — coleção '${normalizedBase}' sincronizada`);
                        }
                    }
                    // Registrar operação para futura sincronização
                    this.enqueueLocalOp({ type: 'set', path, data, ts: Date.now() });
                    return { success: true, savedLocally: true, isLocalFallback: true, isMock: this.isMock };
                } catch (localError) {
                    console.error(`❌ Fallback local falhou para ${path}:`, localError);
                    return { success: false, error: localError.message, isMock: this.isMock };
                }
            }
            // Outros erros: logar erro e tentar salvar no localStorage como cache
            console.error(`❌ Erro ao salvar dados em ${path}:`, error);
            try {
                const { baseKey, itemKey } = this._splitPath(path);
                if (itemKey) {
                    this._upsertLocalItem(baseKey, itemKey, data);
                    const normalizedBase = this._splitPath(this._normalizePath(path)).baseKey;
                    if (normalizedBase && normalizedBase !== baseKey) {
                        this._upsertLocalItem(normalizedBase, itemKey, data);
                    }
                } else {
                    this._setLocal(baseKey, data);
                    const normalizedBase = this._splitPath(this._normalizePath(path)).baseKey;
                    if (normalizedBase && normalizedBase !== baseKey) {
                        this._setLocal(normalizedBase, data);
                    }
                }
                console.warn(`🔄 Erro no Firebase — '${path}' cacheado no localStorage`);
                this.enqueueLocalOp({ type: 'set', path, data, ts: Date.now() });
                return { success: true, savedLocally: true, isLocalFallback: true, isMock: this.isMock };
            } catch (localError) {
                console.error('❌ Falha ao cachear no localStorage:', localError);
                return { success: false, error: error.message, isMock: this.isMock };
            }
        }
    }
    
    // Método para excluir dados
    async deleteData(path) {
        try {
            await this.ensureReady();
            if (!this.database) {
                throw new Error('Database não está disponível');
            }
            let remotePath = this._normalizePath(path);
            try {
                const tenant = this.getCurrentTenantId ? this.getCurrentTenantId() : null;
                const uidPref = this.getCurrentUid ? this.getCurrentUid() : null;
                const shouldNamespace = true;
                if (shouldNamespace && tenant && remotePath && !/^companies\//.test(remotePath)) {
                    remotePath = `companies/${tenant}/${remotePath}`;
                } else if (shouldNamespace && uidPref && remotePath && !/^users\//.test(remotePath)) {
                    remotePath = `users/${uidPref}/${remotePath}`;
                }
            } catch (_) {}
            await this.database.ref(remotePath).remove();
            console.log(`✅ Dados excluídos em ${remotePath}`);
            return { success: true, isMock: this.isMock };
        } catch (error) {
            console.error(`❌ Erro ao excluir dados em ${path}:`, error);
            // 🔐 Fallback inteligente para permission_denied
            if (this._isPermissionDenied(error)) {
                try {
                    const remotePath = this._normalizePath(path);
                    const tenant = this.getCurrentTenantId ? this.getCurrentTenantId() : null;
                    const uid = this.getCurrentUid ? this.getCurrentUid() : null;
                    const shouldNamespace = true;
                    if (shouldNamespace && tenant && remotePath && !/^companies\//.test(remotePath)) {
                        const nsPath = `companies/${tenant}/${remotePath}`;
                        const { baseKey: nsBase, itemKey: nsItem } = this._splitPath(nsPath);
                        if (nsItem) {
                            await this.database.ref(`${nsBase}/${nsItem}`).remove();
                        } else {
                            await this.database.ref(nsPath).remove();
                        }
                        return { success: true, isMock: this.isMock, namespaced: true };
                    } else if (shouldNamespace && uid && remotePath && !/^users\//.test(remotePath)) {
                        const nsPath = `users/${uid}/${remotePath}`;
                        const { baseKey: nsBase, itemKey: nsItem } = this._splitPath(nsPath);
                        if (nsItem) {
                            await this.database.ref(`${nsBase}/${nsItem}`).remove();
                        } else {
                            await this.database.ref(nsPath).remove();
                        }
                        return { success: true, isMock: this.isMock, namespaced: true };
                    }
                } catch (nsErr) {
                    try { console.warn('⚠️ Falha ao excluir em namespace:', typeof nsErr === 'object' ? (nsErr.message || JSON.stringify(nsErr)) : String(nsErr)); } catch (_) {}
                }
                const { baseKey, itemKey } = this._splitPath(path);
                try {
                    if (itemKey) {
                        const updated = this._removeLocalItem(baseKey, itemKey);
                        console.warn(`🛡️ permission_denied — remoção local de '${baseKey}/${itemKey}' (${updated.length} itens)`);
                        // Manter cache também na chave normalizada se diferente
                        const normalizedBase = this._splitPath(this._normalizePath(path)).baseKey;
                        if (normalizedBase && normalizedBase !== baseKey) {
                            this._removeLocalItem(normalizedBase, itemKey);
                            console.warn(`🛡️ cache duplicado — '${normalizedBase}/${itemKey}' sincronizado`);
                        }
                    } else {
                        this._setLocal(baseKey, []);
                        console.warn(`🛡️ permission_denied — coleção '${baseKey}' limpa no localStorage`);
                        const normalizedBase = this._splitPath(this._normalizePath(path)).baseKey;
                        if (normalizedBase && normalizedBase !== baseKey) {
                            this._setLocal(normalizedBase, []);
                            console.warn(`🛡️ cache duplicado — coleção '${normalizedBase}' sincronizada`);
                        }
                    }
                    // Registrar operação para futura sincronização
                    this.enqueueLocalOp({ type: 'delete', path, ts: Date.now() });
                    return { success: true, savedLocally: true, isLocalFallback: true, isMock: this.isMock };
                } catch (localError) {
                    console.error(`❌ Fallback local falhou para ${path}:`, localError);
                    return { success: false, error: localError.message, isMock: this.isMock };
                }
            }

            // Outros erros: tentar refletir no cache local
            try {
                const { baseKey, itemKey } = this._splitPath(path);
                if (itemKey) {
                    this._removeLocalItem(baseKey, itemKey);
                    const normalizedBase = this._splitPath(this._normalizePath(path)).baseKey;
                    if (normalizedBase && normalizedBase !== baseKey) {
                        this._removeLocalItem(normalizedBase, itemKey);
                    }
                } else {
                    this._setLocal(baseKey, []);
                    const normalizedBase = this._splitPath(this._normalizePath(path)).baseKey;
                    if (normalizedBase && normalizedBase !== baseKey) {
                        this._setLocal(normalizedBase, []);
                    }
                }
                console.warn(`🔄 Erro no Firebase — delete '${path}' refletido no localStorage`);
                this._localOpsQueue.push({ type: 'delete', path, ts: Date.now() });
                return { success: true, deletedLocally: true, isLocalFallback: true, isMock: this.isMock };
            } catch (localError) {
                console.error('❌ Falha ao refletir delete no localStorage:', localError);
                return { success: false, error: error.message, isMock: this.isMock };
            }
        }
    }

    getCurrentUid() {
        try {
            const auth = this.firebase && typeof this.firebase.auth === 'function' ? this.firebase.auth() : null;
            const user = auth && auth.currentUser ? auth.currentUser : null;
            const winUid = (typeof window !== 'undefined' && window.currentUserId) ? String(window.currentUserId) : null;
            return (user && user.uid) || this.currentUid || winUid || null;
        } catch (e) {
            const winUid = (typeof window !== 'undefined' && window.currentUserId) ? String(window.currentUserId) : null;
            return this.currentUid || winUid || null;
        }
    }

    getCurrentTenantId() {
        try {
            if (this.currentTenantId) return this.currentTenantId;
            const fromWin = typeof window !== 'undefined' && (window.appTenantId || (window.companyInfo && (window.companyInfo.id || window.companyInfo.companyId || window.companyInfo.slug)));
            let tenant = null;
            if (fromWin) {
                tenant = String(window.appTenantId || window.companyInfo.id || window.companyInfo.companyId || window.companyInfo.slug);
            } else {
                const raw = localStorage.getItem('company_info');
                if (raw) {
                    const obj = JSON.parse(raw);
                    tenant = String(obj.id || obj.companyId || obj.slug || obj.nome || obj.name || 'default').replace(/\s+/g,'_').toLowerCase();
                }
            }
            this.currentTenantId = tenant || null;
            return this.currentTenantId;
        } catch (_) { return null; }
    }

    setTenantId(tenantId) {
        try {
            this.currentTenantId = tenantId ? String(tenantId) : null;
            console.log('🏷️ Tenant atualizado:', this.currentTenantId);
        } catch(_) {}
    }

    async normalizeToKeyedObject(path, keyField = 'id') {
        try {
            await this.ensureReady();
            if (!this.database) throw new Error('Database não disponível');
            
            let remotePath = this._normalizePath(path);
            
            // ✅ APLICAR NAMESPACE (TENANT/USER) - CRÍTICO PARA EVITAR PERMISSION_DENIED
            try {
                const tenant = this.getCurrentTenantId ? this.getCurrentTenantId() : null;
                const uidPref = this.getCurrentUid ? this.getCurrentUid() : null;
                const shouldNamespace = true;
                if (shouldNamespace && tenant && remotePath && !/^companies\//.test(remotePath)) {
                    remotePath = `companies/${tenant}/${remotePath}`;
                    console.log(`🛠️ Normalização: Namespace (empresa) aplicado: ${remotePath}`);
                } else if (shouldNamespace && uidPref && remotePath && !/^users\//.test(remotePath)) {
                    remotePath = `users/${uidPref}/${remotePath}`;
                    console.log(`🛠️ Normalização: Namespace (usuário) aplicado: ${remotePath}`);
                }
            } catch (nsErr) {
                console.warn('⚠️ Falha ao aplicar namespace na normalização:', nsErr);
            }

            const snap = await this.database.ref(remotePath).once('value');
            let data = snap.val();
            if (!data) return { success: true, normalized: false };
            const isArrayLike = Array.isArray(data);
            const isObject = typeof data === 'object' && data !== null;
            let needsNormalize = false;
            if (isArrayLike) {
                needsNormalize = true;
            } else if (isObject) {
                const keys = Object.keys(data);
                // Se as chaves parecem índices numéricos sequenciais, tratar como array serializado
                const numericKeys = keys.every(k => /^\d+$/.test(k));
                needsNormalize = numericKeys;
            }
            if (!needsNormalize) {
                return { success: true, normalized: false };
            }
            const obj = {};
            const srcArr = isArrayLike ? data : Object.keys(data).map(k => ({ _key: k, ...(data[k] || {}) }));
            for (let i = 0; i < srcArr.length; i++) {
                const item = srcArr[i] || {};
                let candidate = null;
                const candidates = [
                    item[keyField],
                    item.id,
                    item.firebaseKey,
                    item.numero,
                    item.key,
                    item._key
                ].filter(v => v !== undefined && v !== null);
                if (candidates.length) {
                    candidate = String(candidates[0]);
                } else {
                    candidate = `AUTO-${Date.now()}-${i}`;
                }
                obj[candidate] = { ...item, id: item.id || candidate };
            }
            await this.database.ref(remotePath).set(obj);
            console.log(`✅ Normalizado para objeto por chave em '${remotePath}' (${Object.keys(obj).length} itens)`);
            const { baseKey } = this._splitPath(remotePath);
            this._setLocal(baseKey, obj);
            return { success: true, normalized: true, count: Object.keys(obj).length };
        } catch (e) {
            console.warn('⚠️ Falha ao normalizar coleção para objeto por chave:', e.message || e);
            return { success: false, error: e.message };
        }
    }
    
    // COMPATIBILIDADE: Método saveToFirebase para garantias
    async saveToFirebase(collection, itemKey, data) {
        console.log(`🔄 Usando método compatível saveToFirebase para: ${collection}/${itemKey || 'bulk'}`);
        
        if (itemKey) {
            // Salvar item específico
            const path = `${collection}/${itemKey}`;
            return this.saveData(path, data);
        } else {
            // Salvar coleção inteira
            return this.saveData(collection, data);
        }
    }

    // COMPATIBILIDADE: Método deleteFromFirebase
    async deleteFromFirebase(collection, itemKey) {
        console.log(`🔄 Usando método compatível deleteFromFirebase para: ${collection}/${itemKey || ''}`);
        const path = itemKey ? `${collection}/${itemKey}` : collection;
        return this.deleteData(path);
    }

    // ============================================================
    // 🔄 Migração de dados: romaneiosTora → romaneios/tora
    // ============================================================
    async migrateRomaneiosToCanonical(options = {}) {
        const { deleteLegacy = false, dryRun = false } = options;
        await this.ensureReady();
        if (!this.database) throw new Error('Database não está disponível para migração');

        const read = async (path) => {
            try {
                const snap = await this.database.ref(path).once('value');
                return snap && snap.val ? snap.val() : snap.val();
            } catch (e) {
                console.warn(`⚠️ Falha ao ler '${path}':`, e.message);
                return null;
            }
        };

        const legacyPath = 'romaneiosTora';
        const canonicalPath = 'romaneios/tora';
        console.log('🔎 Iniciando migração de dados:', { legacyPath, canonicalPath, deleteLegacy, dryRun });

        const legacy = await read(legacyPath);
        const canonical = await read(canonicalPath);
        const legacyKeys = legacy && typeof legacy === 'object' ? Object.keys(legacy) : [];
        const canonicalKeys = canonical && typeof canonical === 'object' ? Object.keys(canonical) : [];

        const toCopy = [];
        for (const k of legacyKeys) {
            if (!canonicalKeys.includes(k)) {
                toCopy.push(k);
            }
        }

        console.log(`📦 Itens no legado: ${legacyKeys.length}; no canônico: ${canonicalKeys.length}; a copiar: ${toCopy.length}`);

        if (dryRun) {
            console.log('📝 Dry-run: itens que seriam copiados:', toCopy);
            return { success: true, dryRun: true, toCopy };
        }

        // Copiar itens faltantes
        if (toCopy.length) {
            const updated = { ...(canonical || {}) };
            for (const k of toCopy) {
                updated[k] = legacy[k];
            }
            console.log(`💾 Escrevendo ${toCopy.length} itens em '${canonicalPath}'...`);
            await this.database.ref(canonicalPath).set(updated);
        }

        // Opcionalmente apagar legado
        if (deleteLegacy) {
            console.log(`🗑️ Removendo caminho legado '${legacyPath}'...`);
            await this.database.ref(legacyPath).remove();
        }

        console.log('✅ Migração concluída');
        return { success: true, copied: toCopy.length, deletedLegacy: !!deleteLegacy };
    }

    // ============================================================
    // 🔧 Utilitários de Fallback Local
    // ============================================================
    _loadLocalOpsQueue() {
        try {
            const raw = localStorage.getItem('firebaseLocalOpsQueue');
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch(_) { return []; }
    }
    _persistLocalOpsQueue() {
        try { localStorage.setItem('firebaseLocalOpsQueue', JSON.stringify(this._localOpsQueue || [])); } catch(_) {}
    }
    enqueueLocalOp(op) {
        try {
            if (!op || !op.path) return;
            this._localOpsQueue.push({ ...op, ts: op.ts || Date.now() });
            this._persistLocalOpsQueue();
        } catch(_) {}
    }
    async flushLocalOps() {
        try {
            await this.ensureReady();
            const status = this.isFirebaseOperational();
            if (!status || !status.operational) return { success: false, reason: 'not_operational' };
            
            // ✅ LIMPEZA DE FILA CORROMPIDA
            // Se a fila for muito grande ou tiver itens muito antigos, pode estar travada
            if (this._localOpsQueue.length > 50) {
                console.warn(`🧹 Fila de operações locais muito grande (${this._localOpsQueue.length}), limpando excesso...`);
                this._localOpsQueue = this._localOpsQueue.slice(-20); // Manter apenas os 20 mais recentes
                this._persistLocalOpsQueue();
            }

            const queue = Array.isArray(this._localOpsQueue) ? this._localOpsQueue.slice() : [];
            const remaining = [];
            for (const op of queue) {
                try {
                    let remotePath = this._normalizePath(op.path);
                    
                    // ✅ SANITIZAÇÃO DE EMERGÊNCIA NA FILA
                    if (op.type !== 'delete' && op.data && (remotePath.includes('romaneios') || remotePath.includes('romaneioTora'))) {
                         if (Array.isArray(op.data)) {
                            op.data = op.data.map(item => {
                                if (item && typeof item === 'object') {
                                    if (!item.numero && item.id) item.numero = String(item.id);
                                }
                                return item;
                            });
                         } else if (op.data && typeof op.data === 'object') {
                             if (!op.data.numero && op.data.id) op.data.numero = String(op.data.id);
                         }
                    }

                    const tenant = this.getCurrentTenantId ? this.getCurrentTenantId() : null;
                    const uidPref = this.getCurrentUid ? this.getCurrentUid() : null;
                    if (tenant && remotePath && !/^companies\//.test(remotePath)) remotePath = `companies/${tenant}/${remotePath}`;
                    else if (uidPref && remotePath && !/^users\//.test(remotePath)) remotePath = `users/${uidPref}/${remotePath}`;
                    if (op.type === 'delete') {
                        const { baseKey, itemKey } = this._splitPath(remotePath);
                        if (itemKey) await this.database.ref(`${baseKey}/${itemKey}`).remove();
                        else await this.database.ref(remotePath).remove();
                    } else {
                        await this.database.ref(remotePath).set(op.data);
                    }
                    console.log(`✅ flushLocalOps: aplicado ${op.type} em ${remotePath}`);
                } catch (e) {
                    // Se falhar por PERMISSION_DENIED, não adianta tentar de novo no mesmo loop
                    // Remover da fila para não travar o loop, ou implementar backoff
                    if (this._isPermissionDenied(e)) {
                        console.warn(`🛑 flushLocalOps: permissão negada para ${op.path}. Removendo da fila para evitar loop. Erro:`, e.message || e);
                        // Não adiciona em 'remaining', efetivamente descartando a operação que falhou por permissão
                    } else {
                        // Verificar se é erro de validação (também retorna permission_denied as vezes ou validation failed)
                        const msg = e.message || '';
                        if (msg.includes('validation') || msg.includes('Permission denied')) {
                             console.warn(`🛑 flushLocalOps: erro de validação/permissão em ${op.path}. Descartando op.`);
                        } else {
                             console.warn('⚠️ flushLocalOps: falha ao aplicar op, mantendo na fila:', e.message || e);
                             remaining.push(op);
                        }
                    }
                }
            }
            this._localOpsQueue = remaining;
            this._persistLocalOpsQueue();
            return { success: true, applied: queue.length - remaining.length, remaining: remaining.length };
        } catch (e) {
            console.warn('⚠️ flushLocalOps: erro geral:', e.message || e);
            return { success: false, error: e.message };
        }
    }
    _isPermissionDenied(error) {
        if (!error) return false;
        try {
            // Checar propriedades comuns de erro do Firebase
            const code = (error && (error.code || error?.errorInfo?.code || error?.details?.code)) || '';
            if (typeof code === 'string' && /permission[_\-]?denied/i.test(code)) return true;

            const name = (error && error.name) || '';
            if (typeof name === 'string' && /permission[_\-]?denied/i.test(name)) return true;

            // Checar mensagem e string completa
            const msg = typeof error === 'string' ? error : (error.message || error.toString() || JSON.stringify(error));
            return /permission[_\-]?denied|PERMISSION_DENIED/i.test(msg);
        } catch (e) {
            // Se falhar, usar verificação simples
            const msg = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
            return /permission_denied|PERMISSION_DENIED/i.test(msg);
        }
    }

    // Normalizar caminho, mantendo compatibilidade com aliases legados
    _normalizePath(path) {
        try {
            if (!path || typeof path !== 'string') return path;
            const parts = path.split('/').filter(Boolean);
            if (parts.length === 0) return path;
            const first = parts[0];
            const mapped = this._PATH_ALIASES[first];
            if (!mapped) return path;
            // 'mapped' pode trazer múltiplos segmentos (ex.: 'romaneios/tora')
            const mappedParts = mapped.split('/').filter(Boolean);
            const rest = parts.slice(1);
            const finalParts = [...mappedParts, ...rest];
            return finalParts.join('/');
        } catch (e) {
            console.warn('⚠️ Falha ao normalizar caminho:', e.message);
            return path;
        }
    }
    
    _splitPath(path) {
        if (!path || typeof path !== 'string') return { baseKey: String(path || ''), itemKey: null };
        const normalized = this._normalizePath(path);
        const parts = normalized.split('/').filter(Boolean);
        if (parts.length === 0) return { baseKey: '', itemKey: null };
        // Tratar coleção canônica multi-segmento 'romaneios/tora'
        const isToraCollection = parts[0] === 'romaneios' && parts[1] === 'tora';
        if (isToraCollection) {
            if (parts.length === 2) return { baseKey: 'romaneios/tora', itemKey: null };
            return { baseKey: parts.slice(0, parts.length - 1).join('/'), itemKey: parts[parts.length - 1] };
        }
        // Padrão: primeira parte é a coleção, última é item se existir
        if (parts.length === 1) return { baseKey: parts[0], itemKey: null };
        return { baseKey: parts[0], itemKey: parts[parts.length - 1] };
    }
    
    _getLocal(key) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return null;
            return JSON.parse(raw);
        } catch (e) {
            console.warn(`⚠️ Erro ao ler localStorage '${key}':`, e.message);
            return null;
        }
    }
    
    _setLocal(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn(`⚠️ Erro ao salvar localStorage '${key}':`, e.message);
            return false;
        }
    }
    
    _upsertLocalItem(collectionKey, itemKey, itemData) {
        const existing = this._getLocal(collectionKey);
        let arr = [];
        if (Array.isArray(existing)) {
            arr = existing.slice();
        } else if (existing && typeof existing === 'object') {
            arr = Object.keys(existing).map(k => ({ id: k, ...existing[k] }));
        }
        const normalizedKey = String(itemKey);
        const idx = arr.findIndex(it => String(it?.id ?? it?.key ?? it?.numero) === normalizedKey);
        const withId = { ...itemData };
        if (!withId.id) withId.id = normalizedKey;
        if (idx >= 0) {
            arr[idx] = { ...arr[idx], ...withId };
        } else {
            arr.push(withId);
        }
        this._setLocal(collectionKey, arr);
        return arr;
    }
    
    _removeLocalItem(collectionKey, itemKey) {
        const existing = this._getLocal(collectionKey);
        let arr = [];
        if (Array.isArray(existing)) {
            arr = existing.slice();
        } else if (existing && typeof existing === 'object') {
            arr = Object.keys(existing).map(k => ({ id: k, ...existing[k] }));
        }
        const normalizedKey = String(itemKey);
        const filtered = arr.filter(it => String(it?.id ?? it?.key ?? it?.numero) !== normalizedKey);
        this._setLocal(collectionKey, filtered);
        return filtered;
    }
    
    // Aguardar estar pronto
    async ensureReady() {
        if (this.isReady) return;
        
        if (this.initPromise) {
            await this.initPromise;
        } else {
            await this.initialize();
        }
    }
    
    // Métodos específicos para espécies
    async loadSpecies() {
        console.log('🌿 Carregando espécies...');
        const result = await this.loadData('species');
        
        if (result.success && result.data) {
            const speciesArray = Array.isArray(result.data) 
                ? result.data 
                : Object.keys(result.data).map(key => ({
                    id: key,
                    nome: result.data[key].nome || result.data[key].name || 'Sem nome',
                    descricao: result.data[key].descricao || result.data[key].description || '',
                    ...result.data[key]
                }));
            
            console.log(`✅ ${speciesArray.length} espécies carregadas`);
            return {
                ...result,
                data: speciesArray
            };
        }
        
        return result;
    }
    
    // Métodos específicos para clientes
    async loadClients() {
        console.log('👥 Carregando clientes...');
        const result = await this.loadData('clients');
        
        if (result.success && result.data) {
            const clientsArray = Array.isArray(result.data) 
                ? result.data 
                : Object.keys(result.data).map(key => ({
                    id: key,
                    nome: result.data[key].nome || result.data[key].name || 'Sem nome',
                    email: result.data[key].email || '',
                    ...result.data[key]
                }));
            
            console.log(`✅ ${clientsArray.length} clientes carregados`);
            return {
                ...result,
                data: clientsArray
            };
        }
        
        return result;
    }
    
    // Status do serviço
    getStatus() {
        return {
            isReady: this.isReady,
            isMock: this.isMock,
            hasDatabase: !!this.database,
            firebase: !!this.firebase,
            app: !!this.app,
            isDevelopment: isDevelopment
        };
    }

    // Método para verificar se Firebase está operacional
    isFirebaseOperational() {
        try {
            const operational = this.isReady && !!this.database && !!this.firebase;
            return {
                operational: operational,
                isReady: this.isReady,
                hasDatabase: !!this.database,
                hasFirebase: !!this.firebase,
                isMock: this.isMock,
                message: operational ? 'Firebase operacional' : 'Firebase não está pronto'
            };
        } catch (error) {
            return {
                operational: false,
                isReady: false,
                error: error.message,
                message: 'Erro ao verificar Firebase'
            };
        }
    }
}

// Criar instância global (idempotente)
console.log('🔧 Criando/obtendo instância global do FirebaseService v3.4...');
const firebaseServiceInstance = window.firebaseService instanceof FirebaseService
  ? window.firebaseService
  : new FirebaseService();
window.firebaseService = firebaseServiceInstance;
// Compatibilidade: expor também como FirebaseService
window.FirebaseService = firebaseServiceInstance;

// Auto-inicializar
if (!window._FIREBASE_UNIFIED_INIT_TRIGGERED) {
  window._FIREBASE_UNIFIED_INIT_TRIGGERED = true;
  const triggerInit = async () => {
    try {
      // Se houver manager, aguardar conexão/ready indiretamente
      if (window.getFirebaseManager) {
        try { window.getFirebaseManager(); } catch {}
      }
      await window.firebaseService.initialize();
      console.log('✅ FirebaseService auto-inicializado');
    } catch (error) {
      console.error('❌ Erro na auto-inicialização do Firebase:', error);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', triggerInit);
  } else {
    setTimeout(triggerInit, 500);
  }
}

// Certificar-se de que está acessível globalmente
if (typeof global !== 'undefined') {
    global.firebaseService = firebaseServiceInstance;
    // Compatibilidade
    global.FirebaseService = firebaseServiceInstance;
}

// Compatibilidade com diferentes contextos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = firebaseServiceInstance;
}

// Enviar evento para indicar que o serviço está pronto
window.dispatchEvent(new CustomEvent('firebaseServiceReady', {
    detail: { firebaseService: firebaseServiceInstance }
}));

console.log('✅ firebaseService.unified.js v3.4 carregado com sucesso');
console.log('🔗 firebaseService exposto globalmente:', typeof window.firebaseService);

// Expor utilitário de migração global para acionar manualmente via console
try {
  window.migrateRomaneiosToCanonical = (opts) => window.firebaseService.migrateRomaneiosToCanonical(opts || {});
  console.log('🛠️ migrateRomaneiosToCanonical disponível em window');
} catch (_) { /* noop */ }
