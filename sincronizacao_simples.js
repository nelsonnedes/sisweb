/**
 * 🚀 SINCRONIZAÇÃO SIMPLES - VERSÃO COMPACTA PARA CONSOLE
 * Resolve o problema de dados isolados entre navegadores
 */

// VERSÃO COMPACTA - COLE NO CONSOLE
(function() {
    console.log('🚀 SINCRONIZAÇÃO MULTI-NAVEGADOR ATIVANDO...');
    
    // Identificador único do navegador
    const navegadorId = navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                       navigator.userAgent.includes('Edge') ? 'Edge' : 'Browser';
    const machineId = `${navegadorId}_${Date.now() % 10000}`;
    
    console.log(`🔧 Identificador: ${machineId}`);
    
    // Backup das funções originais
    window.originalGetData = window.getData;
    window.originalSaveData = window.saveData;
    
    // Nova função getData - com Firebase primeiro
    window.getData = async function(key) {
        console.log(`📥 Carregando ${key}...`);
        
        // 1. Tentar Firebase primeiro se online
        if (navigator.onLine && window.firebaseService?.authService) {
            try {
                const firebaseData = await window.firebaseService.authService.getUserData(key);
                if (firebaseData && (Array.isArray(firebaseData) ? firebaseData.length > 0 : true)) {
                    localStorage.setItem(key, JSON.stringify(firebaseData));
                    console.log(`☁️ ${key} do Firebase: ${Array.isArray(firebaseData) ? firebaseData.length : 1} itens`);
                    return firebaseData;
                }
            } catch (error) {
                console.warn(`Firebase erro: ${error.message}`);
            }
        }
        
        // 2. Fallback para localStorage
        const localData = localStorage.getItem(key);
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                console.log(`📱 ${key} do localStorage: ${Array.isArray(parsed) ? parsed.length : 1} itens`);
                return parsed;
            } catch (error) {
                console.error(`Erro ao parsear ${key}:`, error);
            }
        }
        
        // 3. Função original
        if (window.originalGetData) {
            try {
                const result = await window.originalGetData(key);
                if (result) {
                    localStorage.setItem(key, JSON.stringify(result));
                    console.log(`🔄 ${key} da função original`);
                    return result;
                }
            } catch (error) {
                console.warn(`Função original falhou: ${error.message}`);
            }
        }
        
        console.log(`ℹ️ ${key} não encontrado`);
        return null;
    };
    
    // Nova função saveData - com prevenção de conflitos
    window.saveData = async function(key, data) {
        console.log(`📤 Salvando ${key}...`);
        
        if (!data) {
            console.warn('Dados vazios');
            return { success: false, error: 'Dados vazios' };
        }
        
        // Adicionar IDs únicos e timestamps
        let processedData = data;
        
        if (Array.isArray(data)) {
            processedData = data.map((item, index) => {
                // Gerar ID único se não existir
                if (!item.id || item.id === 'undefined') {
                    item.id = `${key}_${machineId}_${Date.now()}_${index}`;
                }
                
                return {
                    ...item,
                    dataModificacao: new Date().toISOString(),
                    source: machineId
                };
            });
        } else if (typeof data === 'object') {
            processedData = {
                ...data,
                id: data.id || `${key}_${machineId}_${Date.now()}`,
                dataModificacao: new Date().toISOString(),
                source: machineId
            };
        }
        
        // Salvar localmente sempre
        localStorage.setItem(key, JSON.stringify(processedData));
        console.log(`📱 ${key} salvo localmente`);
        
        // Sincronizar com Firebase se online
        if (navigator.onLine && window.firebaseService?.authService) {
            try {
                await window.firebaseService.authService.saveUserData(key, processedData);
                console.log(`☁️ ${key} sincronizado com Firebase`);
                return { success: true, source: 'both' };
            } catch (error) {
                console.warn(`Erro Firebase: ${error.message}`);
                return { success: true, source: 'localStorage' };
            }
        }
        
        return { success: true, source: 'localStorage' };
    };
    
    // Função para sincronizar dados existentes
    window.sincronizarTudo = async function() {
        console.log('🔄 Sincronizando todos os dados...');
        
        const keys = ['clientes', 'especies', 'romaneiosPct'];
        const results = {};
        
        for (const key of keys) {
            try {
                const data = localStorage.getItem(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const result = await window.saveData(key, parsed);
                        results[key] = { count: parsed.length, success: result.success };
                        console.log(`✅ ${key}: ${parsed.length} itens sincronizados`);
                    }
                }
            } catch (error) {
                console.error(`Erro em ${key}:`, error);
                results[key] = { error: error.message };
            }
        }
        
        console.log('📊 Resultado da sincronização:', results);
        return results;
    };
    
    // Função para restaurar originais
    window.restaurarOriginais = function() {
        if (window.originalGetData) {
            window.getData = window.originalGetData;
        }
        if (window.originalSaveData) {
            window.saveData = window.originalSaveData;
        }
        console.log('✅ Funções originais restauradas');
    };
    
    console.log(`
🎉 SINCRONIZAÇÃO MULTI-NAVEGADOR ATIVA!

✅ Funcionalidades:
- Firebase como fonte principal
- localStorage como backup
- IDs únicos por navegador
- Prevenção de conflitos

🔧 Comandos disponíveis:
- sincronizarTudo() - Sincronizar dados existentes
- restaurarOriginais() - Restaurar funções originais

🔧 Identificador: ${machineId}
    `);
    
    // Auto-sincronizar após 2 segundos
    setTimeout(() => {
        if (navigator.onLine) {
            window.sincronizarTudo().then(() => {
                console.log('🎉 Auto-sincronização concluída!');
            });
        }
    }, 2000);
    
})(); 
