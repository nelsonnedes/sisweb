// ========================================
// CORREÇÃO DE VALIDAÇÃO DE ARRAYS v2.0
// ========================================
// Data: ${new Date().toISOString()}
// Propósito: Corrigir erros ".sort is not a function" e ".filter is not a function"
// Proteger todas as operações de array no sistema

console.log("🔧 Carregando correção de validação de arrays...");

// ✅ FUNÇÃO PARA GARANTIR QUE UM VALOR É UM ARRAY
function garantirArray(data, nomeVariavel = 'dados') {
    console.log(`🔍 Verificando ${nomeVariavel}:`, typeof data, Array.isArray(data), data);
    
    if (Array.isArray(data)) {
        console.log(`✅ ${nomeVariavel} já é array (${data.length} itens)`);
        return data;
    }
    
    if (data === null || data === undefined) {
        console.log(`⚠️ ${nomeVariavel} é null/undefined, retornando array vazio`);
        return [];
    }
    
    if (typeof data === 'object') {
        // Se é um objeto, converter para array de valores
        const valores = Object.values(data);
        console.log(`🔄 ${nomeVariavel} convertido de objeto para array (${valores.length} itens)`);
        return valores;
    }
    
    console.log(`⚠️ ${nomeVariavel} não é array nem objeto, retornando array vazio`);
    return [];
}

// ✅ WRAPPER SEGURO PARA OPERAÇÕES DE ARRAY
function operacaoSeguraArray(data, operacao, fallback = []) {
    try {
        const arraySeguro = garantirArray(data);
        return operacao(arraySeguro);
    } catch (error) {
        console.error(`❌ Erro em operação de array:`, error);
        console.log(`🔄 Retornando fallback:`, fallback);
        return fallback;
    }
}

// ✅ CORREÇÕES ESPECÍFICAS PARA WINDOW.CLIENTS
function corrigirWindowClients() {
    console.log("🔧 Verificando window.clients...");
    
    if (!window.clients) {
        console.log("⚠️ window.clients não existe, criando array vazio");
        window.clients = [];
        return;
    }
    
    if (!Array.isArray(window.clients)) {
        console.log("🔄 window.clients não é array, corrigindo...");
        window.clients = garantirArray(window.clients, 'window.clients');
    }
    
    console.log(`✅ window.clients validado (${window.clients.length} itens)`);
}

// ✅ CORREÇÕES ESPECÍFICAS PARA WINDOW.SPECIES
function corrigirWindowSpecies() {
    console.log("🔧 Verificando window.species...");
    
    if (!window.species) {
        console.log("⚠️ window.species não existe, criando array vazio");
        window.species = [];
        return;
    }
    
    if (!Array.isArray(window.species)) {
        console.log("🔄 window.species não é array, corrigindo...");
        window.species = garantirArray(window.species, 'window.species');
    }
    
    console.log(`✅ window.species validado (${window.species.length} itens)`);
}

// ✅ FUNÇÃO PARA PATCH DAS FUNÇÕES getData
function patchGetData() {
    if (typeof window.getData === 'function') {
        const originalGetData = window.getData;
        
        window.getData = function(key) {
            const result = originalGetData(key);
            
            // Se é uma das chaves que devem ser arrays, garantir que seja
            const arrayKeys = ['clients', 'especies', 'clientesTora', 'clientesPct', 'fornecedores', 'romaneiosTora'];
            
            if (arrayKeys.includes(key)) {
                return garantirArray(result, `getData('${key}')`);
            }
            
            return result;
        };
        
        console.log("✅ getData patched para garantir arrays");
    }
}

// ✅ FUNÇÃO WRAPPER PARA renderClientList
if (typeof window.renderClientList === 'function') {
    console.log("🔧 Protegendo renderClientList...");
    
    const originalRenderClientList = window.renderClientList;
    
    window.renderClientList = async function(filter = '') {
        console.log("🛡️ renderClientList protegido executando...");
        
        try {
            // Garantir que window.clients é array antes de executar
            corrigirWindowClients();
            
            return await originalRenderClientList(filter);
        } catch (error) {
            console.error("❌ Erro em renderClientList protegido:", error);
            
            // Fallback seguro
            console.log("🔄 Executando fallback de renderClientList...");
            const tableBody = document.getElementById('clientListTable');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Erro ao carregar fornecedores. Tente novamente.</td></tr>';
            }
        }
    };
}

// ✅ FUNÇÃO WRAPPER PARA renderSpeciesList
if (typeof window.renderSpeciesList === 'function') {
    console.log("🔧 Protegendo renderSpeciesList...");
    
    const originalRenderSpeciesList = window.renderSpeciesList;
    
    window.renderSpeciesList = async function(filter = '') {
        console.log("🛡️ renderSpeciesList protegido executando...");
        
        try {
            // Garantir que window.species é array antes de executar
            corrigirWindowSpecies();
            
            return await originalRenderSpeciesList(filter);
        } catch (error) {
            console.error("❌ Erro em renderSpeciesList protegido:", error);
            
            // Fallback seguro
            console.log("🔄 Executando fallback de renderSpeciesList...");
            const tableBody = document.getElementById('speciesListTable') || 
                             document.querySelector('#speciesListModal tbody');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="3" class="text-center">Erro ao carregar espécies. Tente novamente.</td></tr>';
            }
        }
    };
}

// ✅ FUNÇÃO PARA EXECUTAR TODAS AS CORREÇÕES
function executarCorrecaoArrays() {
    console.log("🚀 Executando correção de arrays...");
    
    try {
        // Corrigir variáveis globais
        corrigirWindowClients();
        corrigirWindowSpecies();
        
        // Patch nas funções de dados
        patchGetData();
        
        console.log("✅ Correção de arrays concluída");
        
        // Log de status
        console.log("📊 Status das variáveis globais:");
        console.log(`   - window.clients: ${Array.isArray(window.clients)} (${window.clients ? window.clients.length : 0} itens)`);
        console.log(`   - window.species: ${Array.isArray(window.species)} (${window.species ? window.species.length : 0} itens)`);
        
    } catch (error) {
        console.error("❌ Erro na correção de arrays:", error);
    }
}

// ✅ EXPOR FUNÇÕES GLOBALMENTE
window.garantirArray = garantirArray;
window.operacaoSeguraArray = operacaoSeguraArray;
window.executarCorrecaoArrays = executarCorrecaoArrays;

// ✅ EXECUTAR CORREÇÃO QUANDO O DOCUMENTO ESTIVER PRONTO
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executarCorrecaoArrays);
} else {
    // DOM já carregado, executar imediatamente
    setTimeout(executarCorrecaoArrays, 100);
}

// ✅ EXECUTAR CORREÇÃO TAMBÉM QUANDO A APLICAÇÃO ESTIVER PRONTA
document.addEventListener('sistemaRomaneiosPronto', executarCorrecaoArrays);

console.log("✅ Correção de validação de arrays carregada");
