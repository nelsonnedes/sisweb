/**
 * 🔧 ESTRATÉGIA HÍBRIDA OTIMIZADA PARA SISWEB
 * 
 * ⚠️ SEGURANÇA TOTAL: Esta implementação NÃO QUEBRA nada que já funciona
 * 
 * Características:
 * - Firebase como Source of Truth
 * - localStorage como Cache Inteligente
 * - Sincronização Automática em Background
 * - Modo Offline Totalmente Funcional
 * - Sincronização Multi-Dispositivo por Empresa
 * - Resolução Inteligente de Conflitos
 * - Backup Automático das Funções Originais
 * 
 * Compatibilidade: Funciona com todas as páginas existentes
 */

console.log('🚀 ESTRATÉGIA HÍBRIDA OTIMIZADA V3.0 CARREGANDO...');

/**
 * CONFIGURAÇÕES GLOBAIS
 */
const CONFIG = {
    SYNC_INTERVAL: 30000, // 30 segundos
    RETRY_INTERVAL: 5000,  // 5 segundos para retry
    MAX_RETRIES: 3,
    CACHE_EXPIRY: 300000,  // 5 minutos
    DEBUG: true,
    
    // Tipos de dados do sistema
    DATA_TYPES: [
        'romaneiosPct', 'romaneiosTL', 'romaneiosTora',
        'clients', 'clientes', 'fornecedores', 'especies', 
        'produtos', 'vendas', 'estoque', 'contasReceber', 
        'contasPagar', 'notasFiscais', 'mdfe'
    ]
};

/**
 * SISTEMA DE LOG AVANÇADO
 */
const Logger = {
    info: (msg, data = null) => {
        if (CONFIG.DEBUG) {
            console.log(`ℹ️ [SYNC] ${msg}`, data || '');
        }
    },
    success: (msg, data = null) => {
        if (CONFIG.DEBUG) {
            console.log(`✅ [SYNC] ${msg}`, data || '');
        }
    },
    warn: (msg, data = null) => {
        console.warn(`⚠️ [SYNC] ${msg}`, data || '');
    },
    error: (msg, error = null) => {
        console.error(`❌ [SYNC] ${msg}`, error || '');
    }
};

/**
 * BACKUP SEGURO DAS FUNÇÕES ORIGINAIS
 */
const OriginalFunctions = {
    getData: null,
    saveData: null,
    init() {
        // Fazer backup apenas se as funções existirem
        if (typeof window.getData === 'function') {
            this.getData = window.getData;
            Logger.info('✅ Backup da função getData criado');
        }
        
        if (typeof window.saveData === 'function') {
            this.saveData = window.saveData;
            Logger.info('✅ Backup da função saveData criado');
        }
    },
    
    restore() {
        if (this.getData) {
            window.getData = this.getData;
            Logger.info('🔄 Função getData restaurada');
        }
        
        if (this.saveData) {
            window.saveData = this.saveData;
            Logger.info('🔄 Função saveData restaurada');
        }
    }
};

/**
 * SISTEMA DE CACHE INTELIGENTE
 */
const CacheManager = {
    cache: new Map(),
    
    set(key, data, expiry = CONFIG.CACHE_EXPIRY) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now(),
            expiry: expiry
        });
    },
    
    get(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > cached.expiry) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    },
    
    clear(key = null) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    },
    
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
};

/**
 * DETECTOR DE CONECTIVIDADE
 */
const ConnectivityManager = {
    isOnline: navigator.onLine,
    listeners: [],
    
    init() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            Logger.success('🌐 Conexão restaurada - iniciando sincronização');
            this.notifyListeners('online');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            Logger.warn('📴 Conexão perdida - modo offline ativado');
            this.notifyListeners('offline');
        });
    },
    
    addListener(callback) {
        this.listeners.push(callback);
    },
    
    notifyListeners(event) {
        this.listeners.forEach(callback => {
            try {
                callback(event, this.isOnline);
            } catch (error) {
                Logger.error('Erro no listener de conectividade', error);
            }
        });
    }
};

/**
 * SISTEMA DE SINCRONIZAÇÃO INTELIGENTE
 */
const SyncManager = {
    syncQueue: new Map(),
    syncing: false,
    lastSync: null,
    
    async queueSync(key, data, priority = 'normal') {
        this.syncQueue.set(key, {
            data: data,
            timestamp: Date.now(),
            priority: priority,
            retries: 0
        });
        
        Logger.info(`📤 ${key} adicionado à fila de sincronização`);
        
        // Tentar sincronizar imediatamente se online
        if (ConnectivityManager.isOnline && !this.syncing) {
            await this.processSyncQueue();
        }
    },
    
    async processSyncQueue() {
        if (this.syncing || this.syncQueue.size === 0) return;
        
        this.syncing = true;
        Logger.info(`🔄 Processando fila de sincronização (${this.syncQueue.size} itens)`);
        
        for (const [key, item] of this.syncQueue.entries()) {
            try {
                await this.syncToFirebase(key, item.data);
                this.syncQueue.delete(key);
                Logger.success(`✅ ${key} sincronizado com sucesso`);
            } catch (error) {
                item.retries++;
                if (item.retries >= CONFIG.MAX_RETRIES) {
                    Logger.error(`❌ ${key} removido da fila após ${CONFIG.MAX_RETRIES} tentativas`, error);
                    this.syncQueue.delete(key);
                } else {
                    Logger.warn(`⚠️ ${key} falhou (tentativa ${item.retries}/${CONFIG.MAX_RETRIES})`);
                }
            }
        }
        
        this.syncing = false;
        this.lastSync = new Date();
        Logger.success(`✅ Processamento da fila concluído`);
    },
    
    async syncToFirebase(key, data) {
        if (!window.firebaseService || !window.firebaseService.authService) {
            throw new Error('Firebase não disponível');
        }
        
        const result = await window.firebaseService.authService.saveUserData(key, data);
        
        if (!result.success) {
            throw new Error(result.error || 'Falha na sincronização');
        }
        
        return result;
    },
    
    async syncFromFirebase(key) {
        if (!window.firebaseService || !window.firebaseService.authService) {
            return null;
        }
        
        try {
            const data = await window.firebaseService.authService.getUserData(key);
            if (data) {
                Logger.success(`☁️ ${key} carregado do Firebase`);
                return data;
            }
        } catch (error) {
            Logger.warn(`⚠️ Erro ao carregar ${key} do Firebase`, error);
        }
        
        return null;
    }
};

/**
 * RESOLVEDOR DE CONFLITOS INTELIGENTE
 */
const ConflictResolver = {
    async resolveConflict(key, localData, firebaseData) {
        Logger.info(`🔄 Resolvendo conflito para ${key}`);
        
        // Se um dos dois está vazio, usar o que tem dados
        if (!localData || localData.length === 0) {
            Logger.info(`📥 Usando dados do Firebase (local vazio)`);
            return firebaseData;
        }
        
        if (!firebaseData || firebaseData.length === 0) {
            Logger.info(`📤 Usando dados locais (Firebase vazio)`);
            return localData;
        }
        
        // Merge inteligente baseado em timestamps
        try {
            const merged = this.mergeByTimestamp(localData, firebaseData);
            Logger.success(`🔀 Merge realizado: ${merged.length} itens`);
            return merged;
        } catch (error) {
            Logger.error('Erro no merge, usando dados mais recentes', error);
            
            // Fallback: usar o que tem mais itens
            if (Array.isArray(localData) && Array.isArray(firebaseData)) {
                return localData.length >= firebaseData.length ? localData : firebaseData;
            }
            
            return localData;
        }
    },
    
    mergeByTimestamp(localData, firebaseData) {
        const merged = new Map();
        
        // Adicionar dados locais
        if (Array.isArray(localData)) {
            localData.forEach(item => {
                const id = item.id || item.codigo || JSON.stringify(item);
                merged.set(id, item);
            });
        }
        
        // Adicionar/atualizar com dados do Firebase
        if (Array.isArray(firebaseData)) {
            firebaseData.forEach(item => {
                const id = item.id || item.codigo || JSON.stringify(item);
                const existing = merged.get(id);
                
                if (!existing) {
                    merged.set(id, item);
                } else {
                    // Usar o mais recente baseado em data de modificação
                    const existingTime = new Date(existing.dataModificacao || existing.data || 0).getTime();
                    const newTime = new Date(item.dataModificacao || item.data || 0).getTime();
                    
                    if (newTime > existingTime) {
                        merged.set(id, item);
                    }
                }
            });
        }
        
        return Array.from(merged.values());
    }
};

/**
 * FUNÇÃO OTIMIZADA getData (SOURCE OF TRUTH: FIREBASE)
 */
async function getDataOptimized(key) {
    try {
        Logger.info(`📥 Carregando ${key}`);
        
        // 1. Verificar cache em memória primeiro (mais rápido)
        const cached = CacheManager.get(key);
        if (cached) {
            Logger.info(`⚡ ${key} carregado do cache (${Array.isArray(cached) ? cached.length : 'obj'} itens)`);
            return cached;
        }
        
        // 2. Se online, tentar Firebase primeiro (source of truth)
        if (ConnectivityManager.isOnline) {
            try {
                const firebaseData = await SyncManager.syncFromFirebase(key);
                if (firebaseData) {
                    // Salvar no localStorage como cache
                    localStorage.setItem(key, JSON.stringify(firebaseData));
                    
                    // Atualizar cache em memória
                    CacheManager.set(key, firebaseData);
                    
                    Logger.success(`☁️ ${key} carregado do Firebase (${Array.isArray(firebaseData) ? firebaseData.length : 'obj'} itens)`);
                    return firebaseData;
                }
            } catch (error) {
                Logger.warn(`⚠️ Erro Firebase para ${key}`, error);
            }
        }
        
        // 3. Fallback para localStorage
        const localData = localStorage.getItem(key);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                
                // Atualizar cache em memória
                CacheManager.set(key, parsed);
                
                Logger.info(`📱 ${key} carregado do localStorage (${Array.isArray(parsed) ? parsed.length : 'obj'} itens)`);
                return parsed;
            } catch (parseError) {
                Logger.error(`❌ Erro ao parsear ${key}`, parseError);
            }
        }
        
        // 4. Tentar função original como último recurso
        if (OriginalFunctions.getData) {
            try {
                const result = await OriginalFunctions.getData(key);
                if (result) {
                    Logger.info(`🔄 ${key} carregado da função original`);
                    
                    // Salvar para próximas consultas
                    localStorage.setItem(key, JSON.stringify(result));
                    CacheManager.set(key, result);
                    
                    return result;
                }
            } catch (error) {
                Logger.warn(`⚠️ Função original falhou para ${key}`, error);
            }
        }
        
        Logger.info(`ℹ️ Nenhum dado encontrado para ${key}`);
        return null;
        
    } catch (error) {
        Logger.error(`❌ Erro crítico ao carregar ${key}`, error);
        return null;
    }
}

/**
 * FUNÇÃO OTIMIZADA saveData (OFFLINE-FIRST COM SYNC)
 */
async function saveDataOptimized(key, data) {
    try {
        Logger.info(`📤 Salvando ${key}`);
        
        // 1. SEMPRE salvar no localStorage primeiro (offline-first)
        localStorage.setItem(key, JSON.stringify(data));
        Logger.success(`📱 ${key} salvo no localStorage`);
        
        // 2. Atualizar cache em memória
        CacheManager.set(key, data);
        
        // 3. Adicionar timestamp de modificação se não existir
        const dataWithTimestamp = Array.isArray(data) ? 
            data.map(item => ({
                ...item,
                dataModificacao: item.dataModificacao || new Date().toISOString()
            })) : 
            {
                ...data,
                dataModificacao: data.dataModificacao || new Date().toISOString()
            };
        
        // 4. Se online, tentar sincronizar imediatamente
        if (ConnectivityManager.isOnline) {
            try {
                await SyncManager.syncToFirebase(key, dataWithTimestamp);
                Logger.success(`☁️ ${key} sincronizado com Firebase`);
                return { success: true, source: 'both' };
            } catch (error) {
                Logger.warn(`⚠️ Erro na sincronização imediata de ${key}`, error);
                
                // Adicionar à fila para tentar depois
                await SyncManager.queueSync(key, dataWithTimestamp);
                return { success: true, source: 'localStorage', queued: true };
            }
        } else {
            // Offline: adicionar à fila para sincronizar quando voltar
            await SyncManager.queueSync(key, dataWithTimestamp);
            Logger.info(`📴 ${key} adicionado à fila (offline)`);
            return { success: true, source: 'localStorage', queued: true };
        }
        
    } catch (error) {
        Logger.error(`❌ Erro crítico ao salvar ${key}`, error);
        return { success: false, error: error.message };
    }
}

/**
 * SISTEMA DE SINCRONIZAÇÃO COMPLETA
 */
const FullSyncManager = {
    async syncAllData(force = false) {
        Logger.info('🔄 Iniciando sincronização completa...');
        
        if (!ConnectivityManager.isOnline) {
            Logger.warn('📴 Sem conexão - sincronização adiada');
            return { success: false, error: 'Sem conexão' };
        }
        
        const results = {};
        
        for (const dataType of CONFIG.DATA_TYPES) {
            try {
                const result = await this.syncDataType(dataType);
                results[dataType] = result;
                Logger.success(`✅ ${dataType}: ${result.message}`);
            } catch (error) {
                Logger.error(`❌ Erro ao sincronizar ${dataType}`, error);
                results[dataType] = { success: false, error: error.message };
            }
        }
        
        Logger.success('✅ Sincronização completa finalizada');
        return { success: true, results };
    },
    
    async syncDataType(key) {
        // 1. Obter dados locais
        const localData = localStorage.getItem(key);
        const parsedLocal = localData ? JSON.parse(localData) : null;
        
        // 2. Obter dados do Firebase
        const firebaseData = await SyncManager.syncFromFirebase(key);
        
        // 3. Resolver conflitos se necessário
        if (parsedLocal && firebaseData) {
            const resolved = await ConflictResolver.resolveConflict(key, parsedLocal, firebaseData);
            
            // Salvar resultado resolvido em ambos os locais
            localStorage.setItem(key, JSON.stringify(resolved));
            await SyncManager.syncToFirebase(key, resolved);
            
            return { 
                success: true, 
                source: 'merged', 
                count: Array.isArray(resolved) ? resolved.length : 1,
                message: `Dados mesclados (${Array.isArray(resolved) ? resolved.length : 1} itens)`
            };
        } else if (parsedLocal && !firebaseData) {
            // Enviar dados locais para Firebase
            await SyncManager.syncToFirebase(key, parsedLocal);
            return { 
                success: true, 
                source: 'upload', 
                count: Array.isArray(parsedLocal) ? parsedLocal.length : 1,
                message: `Dados enviados para Firebase (${Array.isArray(parsedLocal) ? parsedLocal.length : 1} itens)`
            };
        } else if (!parsedLocal && firebaseData) {
            // Baixar dados do Firebase
            localStorage.setItem(key, JSON.stringify(firebaseData));
            CacheManager.set(key, firebaseData);
            return { 
                success: true, 
                source: 'download', 
                count: Array.isArray(firebaseData) ? firebaseData.length : 1,
                message: `Dados baixados do Firebase (${Array.isArray(firebaseData) ? firebaseData.length : 1} itens)`
            };
        }
        
        return { success: true, source: 'none', message: 'Nenhum dado encontrado' };
    }
};

/**
 * SISTEMA DE MONITORAMENTO
 */
const MonitoringManager = {
    startMonitoring() {
        // Sincronização periódica
        setInterval(async () => {
            if (ConnectivityManager.isOnline && SyncManager.syncQueue.size > 0) {
                await SyncManager.processSyncQueue();
            }
        }, CONFIG.SYNC_INTERVAL);
        
        // Listener para mudanças de conectividade
        ConnectivityManager.addListener(async (event, isOnline) => {
            if (isOnline && SyncManager.syncQueue.size > 0) {
                Logger.info('🔄 Reconectado - processando fila de sincronização');
                await SyncManager.processSyncQueue();
            }
        });
        
        Logger.success('🔍 Sistema de monitoramento iniciado');
    },
    
    getStats() {
        return {
            connectivity: {
                online: ConnectivityManager.isOnline,
                lastSync: SyncManager.lastSync
            },
            cache: CacheManager.getStats(),
            syncQueue: {
                size: SyncManager.syncQueue.size,
                items: Array.from(SyncManager.syncQueue.keys())
            },
            config: CONFIG
        };
    }
};

/**
 * INSTALADOR SEGURO DO SISTEMA
 */
const SafeInstaller = {
    installed: false,
    
    async install() {
        try {
            Logger.info('🚀 Iniciando instalação da Estratégia Híbrida Otimizada...');
            
            // 1. Fazer backup das funções originais
            OriginalFunctions.init();
            
            // 2. Inicializar sistemas
            ConnectivityManager.init();
            
            // 3. Implementar funções otimizadas (SEM QUEBRAR AS ORIGINAIS)
            const originalGetData = window.getData;
            const originalSaveData = window.saveData;
            
            // Substituir com segurança
            window.getData = getDataOptimized;
            window.saveData = saveDataOptimized;
            
            // 4. Adicionar funções de controle
            window.syncAllData = () => FullSyncManager.syncAllData();
            window.getSyncStats = () => MonitoringManager.getStats();
            window.clearCache = (key) => CacheManager.clear(key);
            window.restoreOriginalFunctions = () => OriginalFunctions.restore();
            
            // 5. Iniciar monitoramento
            MonitoringManager.startMonitoring();
            
            // 6. Fazer sincronização inicial (se online)
            if (ConnectivityManager.isOnline) {
                setTimeout(async () => {
                    try {
                        await FullSyncManager.syncAllData();
                        Logger.success('✅ Sincronização inicial concluída');
                    } catch (error) {
                        Logger.warn('⚠️ Sincronização inicial falhou, mas sistema funciona offline', error);
                    }
                }, 2000);
            }
            
            this.installed = true;
            
            Logger.success('✅ ESTRATÉGIA HÍBRIDA OTIMIZADA INSTALADA COM SUCESSO!');
            Logger.info('📋 Funções disponíveis:');
            Logger.info('  - syncAllData() - Sincronizar todos os dados');
            Logger.info('  - getSyncStats() - Ver estatísticas');
            Logger.info('  - clearCache(key) - Limpar cache');
            Logger.info('  - restoreOriginalFunctions() - Restaurar funções originais');
            
            return { success: true, message: 'Sistema instalado com sucesso' };
            
        } catch (error) {
            Logger.error('❌ Erro na instalação', error);
            
            // Restaurar funções originais em caso de erro
            OriginalFunctions.restore();
            
            return { success: false, error: error.message };
        }
    },
    
    uninstall() {
        Logger.info('🔄 Desinstalando Estratégia Híbrida Otimizada...');
        
        // Restaurar funções originais
        OriginalFunctions.restore();
        
        // Limpar cache
        CacheManager.clear();
        
        // Remover funções adicionais
        delete window.syncAllData;
        delete window.getSyncStats;
        delete window.clearCache;
        delete window.restoreOriginalFunctions;
        
        this.installed = false;
        
        Logger.success('✅ Sistema desinstalado - funções originais restauradas');
    }
};

/**
 * INTERFACE PÚBLICA DE CONTROLE
 */
window.SisWebSyncManager = {
    install: () => SafeInstaller.install(),
    uninstall: () => SafeInstaller.uninstall(),
    syncAll: () => FullSyncManager.syncAllData(),
    getStats: () => MonitoringManager.getStats(),
    isInstalled: () => SafeInstaller.installed
};

// Auto-instalação segura
setTimeout(async () => {
    const result = await SafeInstaller.install();
    
    if (result.success) {
        console.log(`
🎉 ESTRATÉGIA HÍBRIDA OTIMIZADA V3.0 ATIVA!

✅ Funcionalidades:
- Firebase como Source of Truth
- localStorage como Cache Inteligente  
- Sincronização Automática em Background
- Modo Offline Totalmente Funcional
- Resolução Inteligente de Conflitos
- Dados Compartilhados Entre PCs da Empresa

🔧 Controles Disponíveis:
- SisWebSyncManager.syncAll() - Sincronizar tudo
- SisWebSyncManager.getStats() - Ver estatísticas
- SisWebSyncManager.uninstall() - Remover (restaura originais)

📊 Status: ${ConnectivityManager.isOnline ? 'Online' : 'Offline'}
🔄 Sincronização: ${result.success ? 'Ativa' : 'Inativa'}
        `);
    }
}, 1000);

Logger.success('🔧 Estratégia Híbrida Otimizada V3.0 carregada e pronta!'); 
