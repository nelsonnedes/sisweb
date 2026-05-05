/*
 * Romaneio de Tora - Arquivo de modais e funcoes
 * Ultima atualizacao: 2023-06-12
 * Versao: 1.0.1
 * Nota: Arquivo limpo e consolidado
 */

console.log("Carregando romaneiotora_modais.js...");

/**
 * Funcoes relacionadas aos modais do sistema Romaneio Tora
 */

// Funcao para gerar IDs unicos
function generateUniqueId(prefix = '') {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}${timestamp}${random}`;
}

// CORRECAO DEFINITIVA DAS FUNCOES DE ARMAZENAMENTO
async function saveData(key, data) {
    console.log(`SALVAMENTO INICIADO`);
    console.log(`Chave: ${key}`);
    console.log(`Dados:`, data);
    console.log(`Stack trace:`, new Error().stack);
    
    try {
        // VALIDACAO INICIAL: Verificar se os dados sao validos
        if (!key || typeof key !== 'string') {
            throw new Error("Chave invalida para salvamento");
        }
        
        if (data === null || data === undefined) {
            console.warn(`Tentativa de salvar dados null/undefined para ${key}`);
            data = []; // Usar array vazio como fallback seguro
        }
        
        // VERIFICAR SE ESTAMOS EM OPERACAO DE EXCLUSAO
        if (window.deletingRomaneio && key === 'romaneiosTora') {
            console.log("BLOQUEANDO SALVAMENTO durante operacao de exclusao");
            return false;
        }
        
        // PADRONIZAR CHAVE: sempre usar 'clients' para fornecedores
        let finalKey = key;
        if (key === 'fornecedores' || key === 'clientesTora') {
            finalKey = 'clients';
            console.log(`Redirecionando salvamento de '${key}' para 'clients'`);
        }
        
        // SERIALIZAR DADOS ANTECIPADAMENTE PARA DETECTAR PROBLEMAS
        let serializedData;
        try {
            serializedData = JSON.stringify(data);
            console.log(`Dados serializados com sucesso: ${serializedData.length} caracteres`);
        } catch (serializationError) {
            console.error(`Erro na serializacao de ${finalKey}:`, serializationError);
            throw new Error(`Dados nao podem ser serializados: ${serializationError.message}`);
        }
        
        // SALVAR NO FIREBASE PRIMEIRO (PRIORIDADE)
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            try {
                console.log(`Salvando ${finalKey} no Firebase...`);
                const result = await window.firebaseService.saveToFirebase(finalKey, null, data);
                
                if (result && result.success) {
                    console.log(`${finalKey} salvo no Firebase com sucesso`);
                    
                    // BACKUP NO LOCALSTORAGE APENAS COMO CACHE (SO SE NAO FOR EXCLUSAO)
                    if (!window.deletingRomaneio) {
                        try {
                            localStorage.setItem(finalKey, serializedData);
                            console.log(`Cache local de ${finalKey} atualizado`);
                        } catch (localError) {
                            console.warn(`Cache local falhou para ${finalKey}:`, localError);
                        }
                    } else {
                        console.log(`Cache local NAO atualizado durante exclusao`);
                    }
                    
                    return true;
                } else {
                    console.warn(`Firebase retornou resultado invalido para ${finalKey}:`, result);
                    throw new Error('Firebase retornou resultado invalido');
                }
            } catch (firebaseError) {
                console.warn(`Erro ao salvar ${finalKey} no Firebase: ${firebaseError.message}`);
                console.warn("IMPORTANTE: Firebase nao esta funcionando corretamente");
                throw firebaseError; // MODO 100% FIREBASE: Se Firebase falhar, falhar completamente
            }
        } else {
            console.error(`Firebase Service nao disponivel para salvamento de ${finalKey}`);
            throw new Error('Firebase Service nao esta disponivel');
        }
        
    } catch (error) {
        console.error(`Erro geral ao salvar ${key}:`, error);
        throw error; // MODO 100% FIREBASE: Propagar erro sem fallbacks
    }
}

// CORRECAO DEFINITIVA DA FUNCAO GETDATA
async function getData(key) {
    console.log(`Carregando dados de ${key}...`);
    
    try {
        // VALIDACAO DA CHAVE
        if (!key || typeof key !== 'string') {
            console.error("Chave invalida para carregamento");
            return [];
        }
        
        // PADRONIZAR CHAVE: sempre usar 'clients' para fornecedores
        let finalKey = key;
        if (key === 'fornecedores' || key === 'clientesTora') {
            finalKey = 'clients';
            console.log(`Redirecionando carregamento de '${key}' para 'clients'`);
        }
        
        let data = null;
        
        // CARREGAR APENAS DO FIREBASE (100% FIREBASE)
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                console.log(`Carregando ${finalKey} do Firebase...`);
                const result = await window.firebaseService.loadFromFirebase(finalKey);
                
                if (result && result.success && result.data !== null && result.data !== undefined) {
                    data = result.data;
                    console.log(`${finalKey} carregado do Firebase:`, Array.isArray(data) ? `${data.length} itens` : 'dados validos');
                    
                    // ATUALIZAR CACHE LOCAL
                    try {
                        localStorage.setItem(finalKey, JSON.stringify(data));
                        console.log(`Cache local de ${finalKey} atualizado`);
                    } catch (cacheError) {
                        console.warn(`Erro ao atualizar cache local:`, cacheError);
                    }
                    
                } else if (result && result.data === null) {
                    console.log(`${finalKey} esta vazio no Firebase`);
                    data = [];
                } else {
                    console.warn(`${finalKey} nao encontrado no Firebase ou dados invalidos`);
                    data = [];
                }
            } catch (firebaseError) {
                console.error(`Erro ao carregar ${finalKey} do Firebase: ${firebaseError.message}`);
                
                // FALLBACK PARA CACHE LOCAL APENAS EM CASO DE ERRO
                try {
                    console.log(`Tentando cache local para ${finalKey}...`);
                    const localData = localStorage.getItem(finalKey);
                    
                    if (localData) {
                        try {
                            data = JSON.parse(localData);
                            console.log(`${finalKey} carregado do cache local:`, Array.isArray(data) ? `${data.length} itens` : 'dados validos');
                        } catch (parseError) {
                            console.error(`Erro ao parsear ${finalKey} do cache local:`, parseError);
                            localStorage.removeItem(finalKey);
                            data = [];
                        }
                    } else {
                        console.log(`${finalKey} nao encontrado no cache local`);
                        data = [];
                    }
                } catch (localError) {
                    console.error(`Erro ao acessar cache local para ${finalKey}:`, localError);
                    data = [];
                }
            }
        } else {
            console.error(`Firebase Service nao disponivel para ${finalKey}`);
            
            // ULTIMO RECURSO: CACHE LOCAL
            try {
                console.log(`Usando cache local como ultimo recurso para ${finalKey}...`);
                const localData = localStorage.getItem(finalKey);
                
                if (localData) {
                    try {
                        data = JSON.parse(localData);
                        console.log(`${finalKey} carregado do cache local (ultimo recurso):`, Array.isArray(data) ? `${data.length} itens` : 'dados validos');
                    } catch (parseError) {
                        console.error(`Erro ao parsear ${finalKey} do cache local:`, parseError);
                        data = [];
                    }
                } else {
                    console.log(`${finalKey} nao encontrado no cache local`);
                    data = [];
                }
            } catch (localError) {
                console.error(`Erro ao acessar cache local para ${finalKey}:`, localError);
                data = [];
            }
        }
        
        // VALIDACAO E NORMALIZACAO DOS DADOS
        if (data === null || data === undefined) {
            console.log(`${finalKey} nao encontrado, retornando array vazio`);
            return [];
        }
        
        // Garantir que sempre retorne um tipo consistente
        if (Array.isArray(data)) {
            console.log(`${finalKey} retornado como array com ${data.length} itens`);
            return data;
        } else if (typeof data === 'object') {
            console.log(`${finalKey} retornado como objeto`);
            return data;
        } else {
            console.warn(`${finalKey} tem tipo inesperado: ${typeof data}, convertendo para array`);
            return [data];
        }
        
    } catch (error) {
        console.error(`Erro geral ao carregar ${key}:`, error);
        console.log(`Retornando array vazio para ${key} devido a erro`);
        return [];
    }
}
