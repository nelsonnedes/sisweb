/**
 * 🔧 CORREÇÃO INTERFACE DATABASE ADAPTER
 * 
 * Este arquivo corrige problemas de interface do DatabaseAdapter
 * e garante que todas as funções estejam disponíveis corretamente
 * 
 * @version 1.0.0
 * @created 2024
 */

console.log('🔧 Carregando correções para interface DatabaseAdapter...');

// Aguardar que o databaseAdapter esteja disponível
function waitForDatabaseAdapter() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 40; // 20 segundos máximo
        
        const checkAdapter = () => {
            attempts++;
            
            // Verificar múltiplas possibilidades
            if (window.databaseAdapter && typeof window.databaseAdapter === 'object') {
                console.log('✅ DatabaseAdapter encontrado!');
                resolve(window.databaseAdapter);
                return;
            }
            
            // Verificar se existe dbAdapter como fallback
            if (window.dbAdapter && typeof window.dbAdapter === 'object') {
                console.log('✅ dbAdapter encontrado como fallback!');
                resolve(window.dbAdapter);
                return;
            }
            
            if (attempts >= maxAttempts) {
                console.log('❌ DatabaseAdapter não encontrado após 20 segundos');
                reject(new Error('DatabaseAdapter não disponível'));
                return;
            }
            
            console.log(`⏳ Aguardando DatabaseAdapter... (tentativa ${attempts}/${maxAttempts})`);
            setTimeout(checkAdapter, 500);
        };
        
        checkAdapter();
    });
}

// Função para verificar e corrigir a interface
async function verificarECorrigirInterface() {
    console.log('🔍 Verificando interface do databaseAdapter...');
    
    if (!window.databaseAdapter) {
        console.warn('⚠️ databaseAdapter não encontrado');
        return;
    }
    
    // Forçar atualização do firebaseService no DatabaseAdapter
    if (window.firebaseService && window.databaseAdapter) {
        try {
            console.log('🔧 Forçando atualização do firebaseService no DatabaseAdapter...');
            
            // Se o DatabaseAdapter tem um método para atualizar o firebaseService
            if (typeof window.databaseAdapter.updateFirebaseService === 'function') {
                window.databaseAdapter.updateFirebaseService(window.firebaseService);
            } 
            // Ou se podemos acessar diretamente
            else if (window.databaseAdapter.firebaseService !== undefined) {
                window.databaseAdapter.firebaseService = window.firebaseService;
            }
            
            console.log('✅ FirebaseService atualizado no DatabaseAdapter');
        } catch (error) {
            console.warn('⚠️ Erro ao atualizar firebaseService:', error.message);
        }
    }
    
    try {
        // Aguardar um pouco para o adapter estar pronto
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        let adapter = null;
        
        // Tentar encontrar o adapter
        if (window.databaseAdapter && typeof window.databaseAdapter === 'object') {
            adapter = window.databaseAdapter;
            console.log('✅ databaseAdapter encontrado');
        } else if (window.dbAdapter && typeof window.dbAdapter === 'object') {
            adapter = window.dbAdapter;
            console.log('✅ dbAdapter encontrado (usando como fallback)');
            // Criar alias
            window.databaseAdapter = window.dbAdapter;
        } else {
            console.warn('⚠️ Nenhum adapter encontrado, aguardando...');
            
            // Aguardar um pouco mais
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Tentar novamente
            if (window.databaseAdapter && typeof window.databaseAdapter === 'object') {
                adapter = window.databaseAdapter;
                console.log('✅ databaseAdapter encontrado após aguardar');
            } else if (window.dbAdapter && typeof window.dbAdapter === 'object') {
                adapter = window.dbAdapter;
                console.log('✅ dbAdapter encontrado após aguardar');
                window.databaseAdapter = window.dbAdapter;
            } else {
                console.warn('⚠️ Adapter ainda não encontrado, criando mock...');
                
                // Criar mock básico
                adapter = {
                    isReady: () => true,
                    loadData: async (key) => {
                        console.log(`🧪 Mock loadData(${key})`);
                        return { success: true, data: [], source: 'mock' };
                    },
                    saveData: async (key, data) => {
                        console.log(`🧪 Mock saveData(${key}):`, data);
                        return { success: true };
                    },
                    removeData: async (key, id) => {
                        console.log(`🧪 Mock removeData(${key}, ${id})`);
                        return { success: true };
                    },
                    getStatus: () => ({ status: 'mock', ready: true })
                };
                
                window.databaseAdapter = adapter;
                console.log('✅ Mock adapter criado');
            }
        }
        
        if (!adapter || typeof adapter !== 'object') {
            console.error('❌ Adapter inválido:', adapter);
            return {
                success: false,
                error: 'Adapter inválido ou undefined'
            };
        }
        
        // Verificar se as funções existem
        const funcoesEsperadas = ['loadData', 'saveData', 'removeData'];
        const funcoesDisponiveis = [];
        const funcoesFaltando = [];
        
        funcoesEsperadas.forEach(funcao => {
            if (adapter && typeof adapter[funcao] === 'function') {
                funcoesDisponiveis.push(funcao);
                console.log(`✅ Função ${funcao} disponível`);
            } else {
                funcoesFaltando.push(funcao);
                console.log(`❌ Função ${funcao} não encontrada`);
            }
        });
        
        // Se funções estiverem faltando, tentar encontrar alternativas
        if (funcoesFaltando.length > 0) {
            console.log('🔧 Tentando encontrar funções alternativas...');
            
            // Listar todas as funções disponíveis
            const todasFuncoes = Object.getOwnPropertyNames(adapter)
                .filter(prop => typeof adapter[prop] === 'function')
                .filter(prop => !prop.startsWith('_')); // Excluir funções privadas
            
            console.log('📋 Funções disponíveis no adapter:', todasFuncoes);
            
            // Tentar mapear funções alternativas
            if (!adapter.loadData && adapter.load) {
                adapter.loadData = adapter.load.bind(adapter);
                console.log('🔧 Mapeado loadData -> load');
            }
            
            if (!adapter.saveData && adapter.save) {
                adapter.saveData = adapter.save.bind(adapter);
                console.log('🔧 Mapeado saveData -> save');
            }
            
            if (!adapter.removeData && adapter.remove) {
                adapter.removeData = adapter.remove.bind(adapter);
                console.log('🔧 Mapeado removeData -> remove');
            }
        }
        
        // Criar wrapper para compatibilidade completa
        if (!window.databaseAdapterWrapper) {
            window.databaseAdapterWrapper = {
                async loadData(key) {
                    try {
                        console.log(`📡 Wrapper: Carregando dados para chave: ${key}`);
                        
                        // Tentar diferentes métodos
                        if (typeof adapter.loadData === 'function') {
                            return await adapter.loadData(key);
                        } else if (typeof adapter.load === 'function') {
                            return await adapter.load(key);
                        } else if (window.dbAdapter && typeof window.dbAdapter.load === 'function') {
                            return await window.dbAdapter.load(key);
                        } else {
                            throw new Error('Nenhum método de carregamento disponível');
                        }
                    } catch (error) {
                        console.error('❌ Erro no wrapper loadData:', error);
                        return {
                            success: false,
                            error: error.message,
                            data: null
                        };
                    }
                },
                
                async saveData(key, data, itemKey = null) {
                    try {
                        console.log(`💾 Wrapper: Salvando dados para chave: ${key}`);
                        
                        // Tentar diferentes métodos
                        if (typeof adapter.saveData === 'function') {
                            return await adapter.saveData(key, data, itemKey);
                        } else if (typeof adapter.save === 'function') {
                            return await adapter.save(key, data, itemKey);
                        } else if (window.dbAdapter && typeof window.dbAdapter.save === 'function') {
                            return await window.dbAdapter.save(key, data, itemKey);
                        } else {
                            throw new Error('Nenhum método de salvamento disponível');
                        }
                    } catch (error) {
                        console.error('❌ Erro no wrapper saveData:', error);
                        return {
                            success: false,
                            error: error.message
                        };
                    }
                },
                
                async removeData(key, itemKey = null) {
                    try {
                        console.log(`🗑️ Wrapper: Removendo dados para chave: ${key}`);
                        
                        // Tentar diferentes métodos
                        if (typeof adapter.removeData === 'function') {
                            return await adapter.removeData(key, itemKey);
                        } else if (typeof adapter.remove === 'function') {
                            return await adapter.remove(key, itemKey);
                        } else if (window.dbAdapter && typeof window.dbAdapter.remove === 'function') {
                            return await window.dbAdapter.remove(key, itemKey);
                        } else {
                            throw new Error('Nenhum método de remoção disponível');
                        }
                    } catch (error) {
                        console.error('❌ Erro no wrapper removeData:', error);
                        return {
                            success: false,
                            error: error.message
                        };
                    }
                },
                
                getStatus() {
                    if (typeof adapter.getStatus === 'function') {
                        return adapter.getStatus();
                    } else if (window.dbAdapter && typeof window.dbAdapter.status === 'function') {
                        return window.dbAdapter.status();
                    } else {
                        return {
                            adapter: 'disponível',
                            firebase: window.firebaseService ? 'disponível' : 'indisponível',
                            localStorage: 'disponível'
                        };
                    }
                }
            };
            
            // Substituir o adapter original pelo wrapper
            window.databaseAdapter = window.databaseAdapterWrapper;
            console.log('✅ Wrapper do DatabaseAdapter criado e instalado');
        }
        
        return {
            success: true,
            funcoesDisponiveis,
            funcoesFaltando: funcoesFaltando.filter(f => typeof adapter[f] !== 'function')
        };
        
    } catch (error) {
        console.error('❌ Erro ao verificar interface:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Função para criar um fallback que usa getData/saveData se databaseAdapter falhar
function criarFallbackAdapter() {
    console.log('🔄 Criando adapter de fallback...');
    
    window.databaseAdapterFallback = {
        async loadData(key) {
            try {
                console.log(`📡 Fallback: Tentando carregar ${key} via getData...`);
                
                if (typeof getData === 'function') {
                    const data = await getData(key);
                    return {
                        success: true,
                        data: data,
                        source: 'fallback-getData'
                    };
                } else {
                    throw new Error('Função getData não disponível');
                }
            } catch (error) {
                console.error('❌ Erro no fallback loadData:', error);
                return {
                    success: false,
                    error: error.message,
                    data: null
                };
            }
        },
        
        async saveData(key, data, itemKey = null) {
            try {
                console.log(`💾 Fallback: Tentando salvar ${key} via saveData...`);
                
                if (typeof saveData === 'function') {
                    const result = await saveData(key, data);
                    return {
                        success: true,
                        source: 'fallback-saveData'
                    };
                } else {
                    throw new Error('Função saveData não disponível');
                }
            } catch (error) {
                console.error('❌ Erro no fallback saveData:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        },
        
        getStatus() {
            return {
                type: 'fallback',
                getData: typeof getData === 'function',
                saveData: typeof saveData === 'function'
            };
        }
    };
    
    console.log('✅ Adapter de fallback criado');
}

/**
 * Executar correção da interface do DatabaseAdapter
 * Versão 1.3 - Aguarda Firebase estar pronto
 */
async function executarCorrecao() {
    console.log('🚀 Iniciando correção da interface DatabaseAdapter...');
    
    try {
        // Aguardar Firebase estar pronto primeiro
        if (window.firebaseService && !window._FIREBASE_READY) {
            console.log('⏳ Aguardando Firebase estar pronto antes de corrigir interface...');
            
            // Aguardar até 60 segundos pelo Firebase
            let tentativasFirebase = 120; // 60 segundos
            while (!window._FIREBASE_READY && tentativasFirebase > 0) {
                await new Promise(resolve => setTimeout(resolve, 500));
                tentativasFirebase--;
            }
            
            if (!window._FIREBASE_READY) {
                console.warn('⚠️ Firebase não ficou pronto, mas continuando com correção...');
            } else {
                console.log('✅ Firebase pronto, continuando com correção da interface');
            }
        }
        
        // Aguardar DatabaseAdapter
        const adapter = await aguardarDatabaseAdapter();
        console.log('🔧 DatabaseAdapter encontrado, verificando interface...');
        
        // Verificar e corrigir interface
        await verificarECorrigirInterface();
        
        console.log('✅ Correção da interface DatabaseAdapter concluída com sucesso!');
        
        // Marcar que a interface foi corrigida
        window._INTERFACE_CORRIGIDA = true;
        
        // Disparar evento de interface pronta
        if (typeof CustomEvent !== 'undefined') {
            const evento = new CustomEvent('interfaceDatabaseAdapterPronta', {
                detail: { adapter: window.databaseAdapter, corrigida: true }
            });
            window.dispatchEvent(evento);
            console.log('📢 Evento interfaceDatabaseAdapterPronta disparado');
        }
        
    } catch (error) {
        console.error('❌ Erro na correção da interface:', error);
        
        // Mesmo com erro, marcar como tentativa feita
        window._INTERFACE_CORRIGIDA = false;
        
        // Disparar evento de erro
        if (typeof CustomEvent !== 'undefined') {
            const evento = new CustomEvent('interfaceDatabaseAdapterErro', {
                detail: { error: error.message }
            });
            window.dispatchEvent(evento);
        }
    }
}

// Executar quando o DOM estiver carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executarCorrecao);
} else {
    // DOM já carregado
    setTimeout(executarCorrecao, 100);
}

console.log('✅ Correções de interface carregadas!');

/**
 * Aguardar DatabaseAdapter ficar disponível
 * Versão 1.3 - Com aguardo do Firebase
 * @param {number} tentativas - Número máximo de tentativas
 * @param {number} intervalo - Intervalo entre tentativas em ms
 * @returns {Promise<object>} - O adapter quando estiver pronto
 */
function aguardarDatabaseAdapter(tentativas = 40, intervalo = 500) {
    return new Promise((resolve, reject) => {
        let tentativasRestantes = tentativas;
        console.log(`🔍 Aguardando DatabaseAdapter (máximo ${tentativas * intervalo / 1000}s)...`);
        
        function verificar() {
            // Verificar se Firebase está pronto primeiro
            if (!window._FIREBASE_READY && window.firebaseService) {
                console.log(`⏳ Aguardando Firebase finalizar (tentativa ${tentativas - tentativasRestantes + 1}/${tentativas})`);
                
                tentativasRestantes--;
                if (tentativasRestantes > 0) {
                    setTimeout(verificar, intervalo);
                    return;
                } else {
                    console.warn('⚠️ Firebase não ficou pronto, mas continuando com DatabaseAdapter...');
                }
            }
            
            // Verificar se DatabaseAdapter existe
            if (window.databaseAdapter) {
                // Verificar se tem as propriedades básicas
                if (typeof window.databaseAdapter === 'object') {
                    console.log('✅ DatabaseAdapter encontrado');
                    resolve(window.databaseAdapter);
                    return;
                } else {
                    console.log(`❌ DatabaseAdapter existe mas não é um objeto válido (tentativa ${tentativas - tentativasRestantes + 1}/${tentativas})`);
                }
            } else {
                console.log(`⏳ DatabaseAdapter não encontrado (tentativa ${tentativas - tentativasRestantes + 1}/${tentativas})`);
            }
            
            tentativasRestantes--;
            if (tentativasRestantes > 0) {
                setTimeout(verificar, intervalo);
            } else {
                console.error('❌ DatabaseAdapter não ficou disponível após aguardar');
                reject(new Error('DatabaseAdapter não disponível'));
            }
        }
        
        verificar();
    });
} 