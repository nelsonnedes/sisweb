/**
 * 🛡️ RESOLUÇÃO AVANÇADA DE CONFLITOS DE IDs
 * 
 * Sistema inteligente para prevenir e resolver conflitos de IDs
 * quando múltiplos usuários trabalham simultaneamente em navegadores diferentes
 */

(function() {
    console.log('🛡️ SISTEMA AVANÇADO DE RESOLUÇÃO DE CONFLITOS - CARREGANDO...');
    
    // ✅ CONFIGURAÇÕES
    const CONFIG = {
        PREFIX_MACHINE: `${navigator.userAgent.split(' ')[0]}_${Date.now() % 100000}`, // Identificador único da máquina
        ID_SEPARATOR: '_',
        CONFLICT_RESOLUTION: 'timestamp', // 'timestamp', 'merge', 'user_choice'
        AUTO_SYNC: true,
        DEBUG: true
    };
    
    // ✅ LOGGER
    const log = {
        info: (msg) => CONFIG.DEBUG && console.log(`🔍 [CONFLICT] ${msg}`),
        success: (msg) => CONFIG.DEBUG && console.log(`✅ [CONFLICT] ${msg}`),
        warn: (msg) => console.warn(`⚠️ [CONFLICT] ${msg}`),
        error: (msg, err) => console.error(`❌ [CONFLICT] ${msg}`, err || '')
    };
    
    // ✅ GERADOR DE IDs ÚNICOS SEGURO
    function generateUniqueId(prefix = '', existingIds = []) {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 9999);
        const machineId = CONFIG.PREFIX_MACHINE;
        
        let newId = `${prefix}${machineId}${CONFIG.ID_SEPARATOR}${timestamp}${CONFIG.ID_SEPARATOR}${random}`;
        
        // Garantir que o ID é realmente único
        let counter = 1;
        while (existingIds.includes(newId)) {
            newId = `${prefix}${machineId}${CONFIG.ID_SEPARATOR}${timestamp}${CONFIG.ID_SEPARATOR}${random}${CONFIG.ID_SEPARATOR}${counter}`;
            counter++;
        }
        
        log.info(`🆔 ID único gerado: ${newId}`);
        return newId;
    }
    
    // ✅ DETECTOR DE CONFLITOS DE IDs
    function detectIdConflicts(localData, firebaseData, dataType) {
        if (!Array.isArray(localData) || !Array.isArray(firebaseData)) {
            return { hasConflicts: false, conflicts: [] };
        }
        
        const conflicts = [];
        const localIds = new Set(localData.map(item => String(item.id)).filter(id => id && id !== 'undefined'));
        const firebaseIds = new Set(firebaseData.map(item => String(item.id)).filter(id => id && id !== 'undefined'));
        
        // Detectar IDs duplicados
        const duplicateIds = [...localIds].filter(id => firebaseIds.has(id));
        
        duplicateIds.forEach(duplicateId => {
            const localItem = localData.find(item => String(item.id) === duplicateId);
            const firebaseItem = firebaseData.find(item => String(item.id) === duplicateId);
            
            if (localItem && firebaseItem) {
                // Verificar se são realmente diferentes (não apenas o mesmo item sincronizado)
                const localTimestamp = new Date(localItem.dataModificacao || localItem.timestamp || 0).getTime();
                const firebaseTimestamp = new Date(firebaseItem.dataModificacao || firebaseItem.timestamp || 0).getTime();
                
                if (Math.abs(localTimestamp - firebaseTimestamp) > 1000) { // Diferença > 1 segundo
                    conflicts.push({
                        id: duplicateId,
                        type: 'id_collision',
                        localItem,
                        firebaseItem,
                        dataType,
                        localTimestamp,
                        firebaseTimestamp
                    });
                }
            }
        });
        
        log.info(`🔍 Conflitos detectados em ${dataType}: ${conflicts.length}`);
        return { hasConflicts: conflicts.length > 0, conflicts };
    }
    
    // ✅ RESOLVEDOR INTELIGENTE DE CONFLITOS
    function resolveConflicts(conflicts, resolution = CONFIG.CONFLICT_RESOLUTION) {
        const resolutions = [];
        
        conflicts.forEach(conflict => {
            let resolvedAction;
            
            switch (resolution) {
                case 'timestamp':
                    // Usar o item mais recente baseado no timestamp
                    if (conflict.localTimestamp > conflict.firebaseTimestamp) {
                        resolvedAction = {
                            action: 'use_local',
                            reason: 'Local mais recente',
                            item: conflict.localItem,
                            originalId: conflict.id
                        };
                    } else {
                        resolvedAction = {
                            action: 'use_firebase',
                            reason: 'Firebase mais recente',
                            item: conflict.firebaseItem,
                            originalId: conflict.id
                        };
                    }
                    break;
                    
                case 'merge':
                    // Mesclar propriedades dos dois itens
                    const mergedItem = {
                        ...conflict.firebaseItem,
                        ...conflict.localItem,
                        id: conflict.id,
                        dataModificacao: new Date().toISOString(),
                        conflictResolved: true,
                        mergedFrom: ['local', 'firebase']
                    };
                    resolvedAction = {
                        action: 'merge',
                        reason: 'Dados mesclados',
                        item: mergedItem,
                        originalId: conflict.id
                    };
                    break;
                    
                case 'duplicate':
                    // Manter ambos com IDs diferentes
                    const newLocalId = generateUniqueId(`${conflict.dataType}_local_`);
                    const localWithNewId = { ...conflict.localItem, id: newLocalId };
                    
                    resolvedAction = {
                        action: 'duplicate',
                        reason: 'Mantendo ambos com IDs únicos',
                        items: [conflict.firebaseItem, localWithNewId],
                        originalId: conflict.id,
                        newLocalId: newLocalId
                    };
                    break;
                    
                default:
                    // Fallback: usar o local
                    resolvedAction = {
                        action: 'use_local',
                        reason: 'Fallback para local',
                        item: conflict.localItem,
                        originalId: conflict.id
                    };
            }
            
            resolutions.push(resolvedAction);
            log.success(`✅ Conflito resolvido para ID ${conflict.id}: ${resolvedAction.reason}`);
        });
        
        return resolutions;
    }
    
    // ✅ APLICADOR DE RESOLUÇÕES
    function applyResolutions(localData, firebaseData, resolutions) {
        let mergedData = [...firebaseData];
        const processedIds = new Set();
        
        // Primeiro, remover itens conflituosos do merge
        resolutions.forEach(resolution => {
            mergedData = mergedData.filter(item => String(item.id) !== resolution.originalId);
            processedIds.add(resolution.originalId);
        });
        
        // Aplicar as resoluções
        resolutions.forEach(resolution => {
            switch (resolution.action) {
                case 'use_local':
                case 'use_firebase':
                case 'merge':
                    mergedData.push(resolution.item);
                    break;
                    
                case 'duplicate':
                    mergedData.push(...resolution.items);
                    break;
            }
        });
        
        // Adicionar itens locais que não estavam em conflito
        localData.forEach(localItem => {
            const localId = String(localItem.id);
            if (!processedIds.has(localId) && !mergedData.find(item => String(item.id) === localId)) {
                mergedData.push(localItem);
            }
        });
        
        return mergedData;
    }
    
    // ✅ FUNÇÃO PRINCIPAL DE RESOLUÇÃO DE CONFLITOS
    window.resolveDataConflicts = async function(key, localData, firebaseData) {
        try {
            log.info(`🔄 Iniciando resolução de conflitos para ${key}`);
            
            if (!localData && !firebaseData) {
                log.info(`ℹ️ Nenhum dado para ${key}`);
                return [];
            }
            
            if (!localData || !Array.isArray(localData)) {
                log.info(`📥 Usando apenas dados do Firebase para ${key}`);
                return firebaseData || [];
            }
            
            if (!firebaseData || !Array.isArray(firebaseData)) {
                log.info(`📤 Usando apenas dados locais para ${key}`);
                return localData || [];
            }
            
            // Detectar conflitos
            const conflictAnalysis = detectIdConflicts(localData, firebaseData, key);
            
            if (!conflictAnalysis.hasConflicts) {
                // Sem conflitos: fazer merge simples
                const allIds = new Set();
                const mergedData = [];
                
                [...firebaseData, ...localData].forEach(item => {
                    const itemId = String(item.id);
                    if (!allIds.has(itemId)) {
                        allIds.add(itemId);
                        mergedData.push(item);
                    }
                });
                
                log.success(`✅ Merge simples: ${mergedData.length} itens únicos`);
                return mergedData;
            }
            
            // Resolver conflitos
            log.warn(`⚠️ ${conflictAnalysis.conflicts.length} conflitos detectados em ${key}`);
            const resolutions = resolveConflicts(conflictAnalysis.conflicts);
            const resolvedData = applyResolutions(localData, firebaseData, resolutions);
            
            log.success(`✅ Conflitos resolvidos: ${resolvedData.length} itens finais`);
            
            // Relatório de resolução
            console.log(`
🛡️ RELATÓRIO DE RESOLUÇÃO DE CONFLITOS - ${key}
📊 Itens locais: ${localData.length}
📊 Itens Firebase: ${firebaseData.length}
⚠️ Conflitos detectados: ${conflictAnalysis.conflicts.length}
✅ Itens finais: ${resolvedData.length}
🔧 Resoluções aplicadas: ${resolutions.length}
            `);
            
            return resolvedData;
            
        } catch (error) {
            log.error(`Erro na resolução de conflitos para ${key}`, error);
            // Fallback: usar dados locais
            return localData || [];
        }
    };
    
    // ✅ BACKUP DAS FUNÇÕES ORIGINAIS
    const ORIGINAL_FUNCTIONS = {
        getData: window.getData,
        saveData: window.saveData
    };
    
    // ✅ FUNÇÃO getData APRIMORADA COM RESOLUÇÃO DE CONFLITOS
    window.getDataWithConflictResolution = async function(key) {
        try {
            log.info(`📥 Carregando ${key} com resolução de conflitos`);
            
            // Obter dados locais
            const localDataRaw = localStorage.getItem(key);
            const localData = localDataRaw ? JSON.parse(localDataRaw) : null;
            
            // Obter dados do Firebase
            let firebaseData = null;
            if (navigator.onLine && window.firebaseService?.authService) {
                try {
                    firebaseData = await window.firebaseService.authService.getUserData(key);
                } catch (error) {
                    log.warn(`Firebase indisponível para ${key}: ${error.message}`);
                }
            }
            
            // Resolver conflitos e retornar dados mesclados
            const resolvedData = await window.resolveDataConflicts(key, localData, firebaseData);
            
            // Salvar dados resolvidos localmente
            if (resolvedData && resolvedData.length > 0) {
                localStorage.setItem(key, JSON.stringify(resolvedData));
            }
            
            return resolvedData;
            
        } catch (error) {
            log.error(`Erro ao carregar ${key} com resolução de conflitos`, error);
            
            // Fallback para função original
            if (ORIGINAL_FUNCTIONS.getData) {
                return await ORIGINAL_FUNCTIONS.getData(key);
            }
            
            return null;
        }
    };
    
    // ✅ FUNÇÃO saveData APRIMORADA COM PREVENÇÃO DE CONFLITOS
    window.saveDataWithConflictPrevention = async function(key, data) {
        try {
            log.info(`📤 Salvando ${key} com prevenção de conflitos`);
            
            if (!data) {
                log.warn(`Dados vazios para ${key}`);
                return { success: false, error: 'Dados vazios' };
            }
            
            // Adicionar timestamps e IDs únicos se necessário
            let processedData;
            
            if (Array.isArray(data)) {
                const existingIds = data.map(item => String(item.id)).filter(id => id && id !== 'undefined');
                
                processedData = data.map(item => {
                    // Garantir ID único se não existir
                    if (!item.id || item.id === 'undefined') {
                        item.id = generateUniqueId(`${key}_`, existingIds);
                        existingIds.push(item.id);
                    }
                    
                    // Adicionar timestamp de modificação
                    return {
                        ...item,
                        dataModificacao: new Date().toISOString(),
                        lastModifiedBy: CONFIG.PREFIX_MACHINE
                    };
                });
            } else {
                processedData = {
                    ...data,
                    id: data.id || generateUniqueId(`${key}_`),
                    dataModificacao: new Date().toISOString(),
                    lastModifiedBy: CONFIG.PREFIX_MACHINE
                };
            }
            
            // Salvar localmente primeiro
            localStorage.setItem(key, JSON.stringify(processedData));
            log.success(`📱 ${key} salvo localmente`);
            
            // Sincronizar com Firebase se online
            if (navigator.onLine && window.firebaseService?.authService) {
                try {
                    await window.firebaseService.authService.saveUserData(key, processedData);
                    log.success(`☁️ ${key} sincronizado com Firebase`);
                    return { success: true, source: 'both', data: processedData };
                } catch (error) {
                    log.warn(`Erro na sincronização de ${key}: ${error.message}`);
                    return { success: true, source: 'localStorage', data: processedData, queued: true };
                }
            }
            
            return { success: true, source: 'localStorage', data: processedData };
            
        } catch (error) {
            log.error(`Erro ao salvar ${key} com prevenção de conflitos`, error);
            return { success: false, error: error.message };
        }
    };
    
    // ✅ INSTALADOR SEGURO
    window.installConflictResolution = function() {
        // Fazer backup das funções atuais
        window.originalGetData = window.getData;
        window.originalSaveData = window.saveData;
        
        // Instalar novas funções
        window.getData = window.getDataWithConflictResolution;
        window.saveData = window.saveDataWithConflictPrevention;
        
        log.success('🛡️ Sistema de resolução de conflitos instalado');
        
        console.log(`
🛡️ SISTEMA DE RESOLUÇÃO DE CONFLITOS ATIVO!

✅ Funcionalidades:
- IDs únicos por máquina/navegador
- Resolução automática de conflitos
- Merge inteligente baseado em timestamp  
- Prevenção de colisões de IDs
- Backup automático das funções originais

🔧 Identificador desta máquina: ${CONFIG.PREFIX_MACHINE}

🎯 Para testar:
resolveDataConflicts('romaneiosPct', localData, firebaseData)
        `);
    };
    
    // ✅ DESINSTALADOR SEGURO
    window.uninstallConflictResolution = function() {
        if (window.originalGetData) {
            window.getData = window.originalGetData;
            log.info('🔄 getData original restaurado');
        }
        
        if (window.originalSaveData) {
            window.saveData = window.originalSaveData;
            log.info('🔄 saveData original restaurado');
        }
        
        log.success('✅ Sistema de resolução de conflitos desinstalado');
    };
    
    // ✅ INSTALAÇÃO AUTOMÁTICA
    if (CONFIG.AUTO_SYNC) {
        window.installConflictResolution();
    }
    
    log.success('🛡️ Sistema de resolução de conflitos carregado e pronto!');
    
})(); 
