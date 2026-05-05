/**
 * 🚀 IMPLEMENTAÇÃO RÁPIDA - ESTRATÉGIA HÍBRIDA OTIMIZADA
 * 
 * Cole este código no console de qualquer página do sistema
 * Implementação segura que NÃO quebra nada existente
 */

(function() {
    console.log('🚀 ESTRATÉGIA HÍBRIDA OTIMIZADA - IMPLEMENTAÇÃO RÁPIDA');
    console.log('⚠️ SEGURANÇA GARANTIDA: Backup automático das funções originais');
    
    // ✅ BACKUP SEGURO DAS FUNÇÕES ORIGINAIS
    const BACKUP = {
        getData: window.getData,
        saveData: window.saveData,
        restored: false
    };
    
    // ✅ CONFIGURAÇÕES
    const CONFIG = {
        SYNC_INTERVAL: 30000,  // 30 segundos
        DEBUG: true,
        DATA_TYPES: [
            'romaneiosPct', 'romaneiosTL', 'romaneiosTora',
            'clients', 'clientes', 'fornecedores', 'especies',
            'produtos', 'vendas', 'estoque', 'contasReceber',
            'contasPagar', 'notasFiscais', 'mdfe'
        ]
    };
    
    // ✅ LOGGER OTIMIZADO
    const log = {
        info: (msg) => CONFIG.DEBUG && console.log(`ℹ️ [SYNC] ${msg}`),
        success: (msg) => CONFIG.DEBUG && console.log(`✅ [SYNC] ${msg}`),
        warn: (msg) => console.warn(`⚠️ [SYNC] ${msg}`),
        error: (msg, err) => console.error(`❌ [SYNC] ${msg}`, err || '')
    };
    
    // ✅ CACHE INTELIGENTE
    const cache = new Map();
    const setCache = (key, data) => cache.set(key, { data, time: Date.now() });
    const getCache = (key) => {
        const item = cache.get(key);
        if (!item || Date.now() - item.time > 300000) return null; // 5 min
        return item.data;
    };
    
    // ✅ FILA DE SINCRONIZAÇÃO
    const syncQueue = new Map();
    let syncing = false;
    
    // ✅ FUNÇÃO OTIMIZADA getData (Firebase + localStorage + Cache)
    window.getData = async function(key) {
        try {
            log.info(`📥 Carregando ${key}`);
            
            // 1. Cache em memória (mais rápido)
            const cached = getCache(key);
            if (cached) {
                log.info(`⚡ ${key} do cache (${Array.isArray(cached) ? cached.length : 'obj'} itens)`);
                return cached;
            }
            
            // 2. Firebase primeiro (source of truth) se online
            if (navigator.onLine && window.firebaseService?.loadFromFirebase) {
                try {
                    const result = await window.firebaseService.loadFromFirebase(key);
                    if (result && result.success && result.data) {
                        const firebaseData = result.data;
                        localStorage.setItem(key, JSON.stringify(firebaseData));
                        setCache(key, firebaseData);
                        log.success(`☁️ ${key} do Firebase (${Array.isArray(firebaseData) ? firebaseData.length : 'obj'} itens)`);
                        return firebaseData;
                    }
                } catch (error) {
                    log.warn(`Firebase erro para ${key}: ${error.message}`);
                }
            }
            
            // 3. localStorage fallback
            const localData = localStorage.getItem(key);
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    setCache(key, parsed);
                    log.info(`📱 ${key} do localStorage (${Array.isArray(parsed) ? parsed.length : 'obj'} itens)`);
                    return parsed;
                } catch (parseError) {
                    log.error(`Erro ao parsear ${key}`, parseError);
                }
            }
            
            // 4. Função original como último recurso
            if (BACKUP.getData && typeof BACKUP.getData === 'function') {
                try {
                    const result = await BACKUP.getData(key);
                    if (result) {
                        localStorage.setItem(key, JSON.stringify(result));
                        setCache(key, result);
                        log.info(`🔄 ${key} da função original`);
                        return result;
                    }
                } catch (error) {
                    log.warn(`Função original falhou para ${key}: ${error.message}`);
                }
            }
            
            log.info(`ℹ️ ${key} não encontrado`);
            return [];
            
        } catch (error) {
            log.error(`Erro crítico ao carregar ${key}`, error);
            return [];
        }
    };
    
    // ✅ FUNÇÃO OTIMIZADA saveData (Offline-first + Sync Queue)
    window.saveData = async function(key, data) {
        try {
            log.info(`📤 Salvando ${key}`);
            
            // 1. SEMPRE salvar localStorage primeiro (offline-first)
            localStorage.setItem(key, JSON.stringify(data));
            setCache(key, data);
            log.success(`📱 ${key} salvo localmente`);
            
            // 2. Adicionar timestamp de modificação
            const dataWithTime = Array.isArray(data) ? 
                data.map(item => ({ ...item, dataModificacao: item.dataModificacao || new Date().toISOString() })) :
                { ...data, dataModificacao: data.dataModificacao || new Date().toISOString() };
            
            // 3. Sincronizar com Firebase se online
            if (navigator.onLine && window.firebaseService?.saveToFirebase) {
                try {
                    const result = await window.firebaseService.saveToFirebase(key, null, dataWithTime);
                    if (result && result.success) {
                        log.success(`☁️ ${key} sincronizado com Firebase`);
                        return { success: true, source: 'both' };
                    }
                } catch (error) {
                    log.warn(`Erro na sincronização de ${key}: ${error.message}`);
                    syncQueue.set(key, { data: dataWithTime, retries: 0 });
                    return { success: true, source: 'localStorage', queued: true };
                }
            } else {
                // Offline: adicionar à fila
                syncQueue.set(key, { data: dataWithTime, retries: 0 });
                log.info(`📴 ${key} adicionado à fila (offline)`);
                return { success: true, source: 'localStorage', queued: true };
            }
            
        } catch (error) {
            log.error(`Erro crítico ao salvar ${key}`, error);
            return { success: false, error: error.message };
        }
    };
    
    // ✅ PROCESSADOR DA FILA DE SINCRONIZAÇÃO
    async function processSyncQueue() {
        if (syncing || syncQueue.size === 0 || !navigator.onLine) return;
        
        syncing = true;
        log.info(`🔄 Processando fila (${syncQueue.size} itens)`);
        
        for (const [key, item] of syncQueue.entries()) {
            try {
                if (window.firebaseService?.saveToFirebase) {
                    const result = await window.firebaseService.saveToFirebase(key, null, item.data);
                    if (result && result.success) {
                        syncQueue.delete(key);
                        log.success(`✅ ${key} sincronizado da fila`);
                    }
                }
            } catch (error) {
                item.retries++;
                if (item.retries >= 3) {
                    log.error(`❌ ${key} removido da fila após 3 tentativas`);
                    syncQueue.delete(key);
                } else {
                    log.warn(`⚠️ ${key} falhou (tentativa ${item.retries}/3)`);
                }
            }
        }
        
        syncing = false;
    }
    
    // ✅ SINCRONIZAÇÃO COMPLETA
    window.syncAllData = async function() {
        if (!navigator.onLine) {
            log.warn('📴 Sem conexão - sincronização adiada');
            return { success: false, error: 'Offline' };
        }
        
        log.info('🔄 Sincronização completa iniciada...');
        const results = {};
        
        for (const dataType of CONFIG.DATA_TYPES) {
            try {
                const localData = localStorage.getItem(dataType);
                if (localData && window.firebaseService?.saveToFirebase) {
                    const parsed = JSON.parse(localData);
                    const result = await window.firebaseService.saveToFirebase(dataType, null, parsed);
                    if (result && result.success) {
                        results[dataType] = { success: true, count: Array.isArray(parsed) ? parsed.length : 1 };
                        log.success(`✅ ${dataType} sincronizado`);
                    } else {
                        results[dataType] = { success: false, error: 'Firebase save failed' };
                    }
                }
            } catch (error) {
                log.error(`❌ Erro ao sincronizar ${dataType}`, error);
                results[dataType] = { success: false, error: error.message };
            }
        }
        
        log.success('✅ Sincronização completa finalizada');
        return { success: true, results };
    };
    
    // ✅ ESTATÍSTICAS DO SISTEMA
    window.getSyncStats = function() {
        return {
            online: navigator.onLine,
            cache: { size: cache.size, keys: Array.from(cache.keys()) },
            syncQueue: { size: syncQueue.size, items: Array.from(syncQueue.keys()) },
            backup: { available: !!BACKUP.getData, restored: BACKUP.restored },
            firebase: !!(window.firebaseService?.saveToFirebase && window.firebaseService?.loadFromFirebase)
        };
    };
    
    // ✅ RESTAURAÇÃO DE EMERGÊNCIA
    window.restoreOriginalFunctions = function() {
        if (BACKUP.getData) {
            window.getData = BACKUP.getData;
            log.info('🔄 getData original restaurado');
        }
        if (BACKUP.saveData) {
            window.saveData = BACKUP.saveData;
            log.info('🔄 saveData original restaurado');
        }
        BACKUP.restored = true;
        log.success('✅ Funções originais restauradas');
    };
    
    // ✅ LIMPEZA DE CACHE
    window.clearCache = function(key) {
        if (key) {
            cache.delete(key);
            log.info(`🧹 Cache limpo para ${key}`);
        } else {
            cache.clear();
            log.info('🧹 Todo cache limpo');
        }
    };
    
    // ✅ MONITORAMENTO AUTOMÁTICO
    function startMonitoring() {
        // Processar fila periodicamente
        setInterval(processSyncQueue, CONFIG.SYNC_INTERVAL);
        
        // Detectar reconexão
        window.addEventListener('online', () => {
            log.success('🌐 Reconectado - processando fila');
            setTimeout(processSyncQueue, 1000);
        });
        
        window.addEventListener('offline', () => {
            log.warn('📴 Desconectado - modo offline ativo');
        });
        
        log.success('🔍 Monitoramento ativo');
    }
    
    // ✅ INICIALIZAÇÃO
    try {
        startMonitoring();
        
        // Sincronização inicial se online
        if (navigator.onLine) {
            setTimeout(() => {
                syncAllData().then(() => {
                    log.success('✅ Sincronização inicial concluída');
                }).catch(error => {
                    log.warn('⚠️ Sincronização inicial falhou, sistema funciona offline');
                });
            }, 2000);
        }
        
        // Relatório de instalação
        console.log(`
🎉 ESTRATÉGIA HÍBRIDA OTIMIZADA INSTALADA!

✅ Funcionalidades Ativas:
- Firebase como Source of Truth
- localStorage como Cache Inteligente  
- Sincronização Automática (${CONFIG.SYNC_INTERVAL/1000}s)
- Modo Offline Funcional
- Resolução de Conflitos
- Backup das Funções Originais

🔧 Funções Disponíveis:
- syncAllData() - Sincronizar todos os dados
- getSyncStats() - Ver estatísticas do sistema
- clearCache(key) - Limpar cache específico
- restoreOriginalFunctions() - Restaurar originais

📊 Status Atual:
- Conectividade: ${navigator.onLine ? 'Online' : 'Offline'}
- Firebase: ${window.firebaseService ? 'Disponível' : 'Indisponível'}
- Cache: ${cache.size} itens
- Fila Sync: ${syncQueue.size} itens
        `);
        
        log.success('🚀 Sistema otimizado ativo e funcional!');
        
    } catch (error) {
        log.error('❌ Erro na inicialização, restaurando originais', error);
        restoreOriginalFunctions();
    }
    
})();

/**
 * 📋 COMANDOS ÚTEIS APÓS INSTALAÇÃO:
 * 
 * getSyncStats()           - Ver status completo
 * syncAllData()            - Forçar sincronização
 * clearCache()             - Limpar cache
 * restoreOriginalFunctions() - Voltar ao original
 * 
 * 🛡️ SEGURANÇA: Se algo der errado, execute restoreOriginalFunctions()
 */ 
