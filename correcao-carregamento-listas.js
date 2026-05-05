// correcao-carregamento-listas.js
// Script para diagnosticar e corrigir problemas de carregamento das listas Firebase v3.4

console.log('🔧 === CARREGANDO CORREÇÃO DE LISTAS v3.4 ===');

// ✅ DIAGNÓSTICO COMPLETO DO SISTEMA
async function diagnosticarSistema() {
    console.log('🔍 === DIAGNÓSTICO COMPLETO DO SISTEMA ===');
    
    try {
        // 1. Verificar Firebase Service
        if (!window.firebaseService) {
            console.error('❌ window.firebaseService não encontrado');
            return { erro: 'Firebase Service não disponível' };
        }
        
        // 2. Verificar status do Firebase
        const status = window.firebaseService.getStatus();
        console.log('📊 Status Firebase:', status);
        
        // 3. Verificar se está usando mock ou real
        if (status.isMock) {
            console.warn('⚠️ PROBLEMA: Sistema está usando dados MOCK');
            console.warn('💡 SOLUÇÃO: Ativar Realtime Database no Firebase Console');
            return { 
                erro: 'Sistema usando dados MOCK', 
                solucao: 'Ativar Realtime Database no Firebase Console',
                isMock: true 
            };
        }
        
        // 4. Testar carregamento de cada coleção
        const resultados = {};
        
        // Testar species
        console.log('🧪 Testando carregamento de species...');
        const speciesResult = await window.firebaseService.loadData('species');
        resultados.species = speciesResult;
        console.log('📊 Resultado species:', speciesResult);
        
        // Testar clients
        console.log('🧪 Testando carregamento de clients...');
        const clientsResult = await window.firebaseService.loadData('clients');
        resultados.clients = clientsResult;
        console.log('📊 Resultado clients:', clientsResult);
        
        // Testar romaneiosTora
        console.log('🧪 Testando carregamento de romaneiosTora...');
        const romaneiosResult = await window.firebaseService.loadData('romaneiosTora');
        resultados.romaneiosTora = romaneiosResult;
        console.log('📊 Resultado romaneiosTora:', romaneiosResult);
        
        return {
            status: 'OK',
            firebase: status,
            testes: resultados
        };
        
    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error);
        return { erro: error.message };
    }
}

// ✅ FUNÇÃO PARA VERIFICAR SE HÁ DADOS NO FIREBASE
async function verificarDadosFirebase() {
    console.log('🔍 === VERIFICANDO DADOS NO FIREBASE ===');
    
    try {
        // Aguardar Firebase estar pronto
        await window.firebaseService.ensureReady();
        
        // Verificar cada coleção
        const colecoes = ['species', 'clients', 'romaneiosTora'];
        const resultados = {};
        
        for (const colecao of colecoes) {
            console.log(`📡 Verificando coleção: ${colecao}`);
            
            try {
                const result = await window.firebaseService.loadData(colecao);
                
                if (result.success && result.data) {
                    const count = Array.isArray(result.data) ? 
                        result.data.length : 
                        Object.keys(result.data).length;
                    
                    console.log(`✅ ${colecao}: ${count} registros encontrados`);
                    resultados[colecao] = { 
                        existe: true, 
                        count: count, 
                        data: result.data,
                        isMock: result.isMock 
                    };
                } else {
                    console.log(`⚠️ ${colecao}: Vazio ou não existe`);
                    resultados[colecao] = { 
                        existe: false, 
                        count: 0, 
                        error: result.error,
                        isMock: result.isMock 
                    };
                }
            } catch (error) {
                console.error(`❌ Erro ao verificar ${colecao}:`, error);
                resultados[colecao] = { existe: false, error: error.message };
            }
        }
        
        return resultados;
        
    } catch (error) {
        console.error('❌ Erro na verificação:', error);
        return { erro: error.message };
    }
}

// ✅ FUNÇÃO PARA CORRIGIR RENDERIZAÇÃO DE LISTAS
function corrigirRenderizacaoListas() {
    console.log('🔧 === CORRIGINDO RENDERIZAÇÃO DE LISTAS ===');
    
    // 1. Corrigir função de filtro de espécies
    window.filterSpeciesListFixed = function(input) {
        const filter = input.value.toLowerCase();
        const tableBody = document.getElementById('speciesListTable');
        
        if (!tableBody) {
            console.error('❌ Tabela de espécies não encontrada');
            return;
        }
        
        const rows = tableBody.getElementsByTagName('tr');
        let visibleCount = 0;
        
        for (let i = 0; i < rows.length; i++) {
            const cells = rows[i].getElementsByTagName('td');
            if (cells.length > 0) {
                const nome = (cells[0].textContent || '').toLowerCase();
                const descricao = (cells[1] ? cells[1].textContent || '' : '').toLowerCase();
                
                if (nome.includes(filter) || descricao.includes(filter)) {
                    rows[i].style.display = '';
                    visibleCount++;
                } else {
                    rows[i].style.display = 'none';
                }
            }
        }
        
        console.log(`🔍 Filtro aplicado: ${visibleCount} espécies visíveis`);
    };
    
    // 2. Corrigir função de carregamento de fornecedores
    window.carregarFornecedoresCorrigido = async function() {
        console.log('🔧 Carregando fornecedores (versão corrigida)...');
        
        try {
            if (!window.firebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            const result = await window.firebaseService.loadData('clients');
            
            if (result.success && result.data) {
                const fornecedores = Array.isArray(result.data) ? 
                    result.data : 
                    Object.keys(result.data).map(key => ({
                        id: key,
                        ...result.data[key]
                    }));
                
                console.log(`✅ ${fornecedores.length} fornecedores carregados`);
                return fornecedores;
            } else {
                console.warn('⚠️ Nenhum fornecedor encontrado');
                return [];
            }
        } catch (error) {
            console.error('❌ Erro ao carregar fornecedores:', error);
            return [];
        }
    };
    
    // 3. Corrigir função de carregamento de romaneios
    window.carregarRomaneiosCorrigido = async function() {
        console.log('🔧 Carregando romaneios (versão corrigida)...');
        
        try {
            if (!window.firebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            const result = await window.firebaseService.loadData('romaneiosTora');
            
            if (result.success && result.data) {
                const romaneios = Array.isArray(result.data) ? 
                    result.data : 
                    Object.keys(result.data).map(key => ({
                        id: key,
                        firebaseKey: key,
                        ...result.data[key]
                    }));
                
                console.log(`✅ ${romaneios.length} romaneios carregados`);
                return romaneios;
            } else {
                console.warn('⚠️ Nenhum romaneio encontrado');
                return [];
            }
        } catch (error) {
            console.error('❌ Erro ao carregar romaneios:', error);
            return [];
        }
    };
    
    console.log('✅ Funções de correção criadas');
}

// ✅ FUNÇÃO PARA TESTAR TODAS AS LISTAS
async function testarTodasAsListas() {
    console.log('🧪 === TESTANDO TODAS AS LISTAS ===');
    
    const resultados = {};
    
    // 1. Testar Espécies
    console.log('🌿 Testando carregamento de espécies...');
    try {
        const speciesResult = await window.firebaseService.loadData('species');
        resultados.especies = {
            sucesso: speciesResult.success,
            count: speciesResult.data ? (Array.isArray(speciesResult.data) ? speciesResult.data.length : Object.keys(speciesResult.data).length) : 0,
            isMock: speciesResult.isMock,
            dados: speciesResult.data
        };
        console.log('📊 Resultado espécies:', resultados.especies);
    } catch (error) {
        console.error('❌ Erro ao testar espécies:', error);
        resultados.especies = { erro: error.message };
    }
    
    // 2. Testar Fornecedores/Clientes
    console.log('👥 Testando carregamento de fornecedores...');
    try {
        const clientsResult = await window.firebaseService.loadData('clients');
        resultados.fornecedores = {
            sucesso: clientsResult.success,
            count: clientsResult.data ? (Array.isArray(clientsResult.data) ? clientsResult.data.length : Object.keys(clientsResult.data).length) : 0,
            isMock: clientsResult.isMock,
            dados: clientsResult.data
        };
        console.log('📊 Resultado fornecedores:', resultados.fornecedores);
    } catch (error) {
        console.error('❌ Erro ao testar fornecedores:', error);
        resultados.fornecedores = { erro: error.message };
    }
    
    // 3. Testar Romaneios
    console.log('📋 Testando carregamento de romaneios...');
    try {
        const romaneiosResult = await window.firebaseService.loadData('romaneiosTora');
        resultados.romaneios = {
            sucesso: romaneiosResult.success,
            count: romaneiosResult.data ? (Array.isArray(romaneiosResult.data) ? romaneiosResult.data.length : Object.keys(romaneiosResult.data).length) : 0,
            isMock: romaneiosResult.isMock,
            dados: romaneiosResult.data
        };
        console.log('📊 Resultado romaneios:', resultados.romaneios);
    } catch (error) {
        console.error('❌ Erro ao testar romaneios:', error);
        resultados.romaneios = { erro: error.message };
    }
    
    return resultados;
}

// ✅ FUNÇÃO PARA GERAR RELATÓRIO COMPLETO
async function gerarRelatorioCompleto() {
    console.log('📊 === GERANDO RELATÓRIO COMPLETO ===');
    
    const diagnostico = await diagnosticarSistema();
    const verificacao = await verificarDadosFirebase();
    const testes = await testarTodasAsListas();
    
    const relatorio = {
        timestamp: new Date().toLocaleString(),
        diagnostico: diagnostico,
        verificacao: verificacao,
        testes: testes
    };
    
    console.log('📋 RELATÓRIO COMPLETO:', relatorio);
    
    // Exibir resumo no console
    console.log('\n🔍 === RESUMO DOS PROBLEMAS ===');
    
    if (diagnostico.erro) {
        console.log('❌ Firebase Service:', diagnostico.erro);
    } else if (diagnostico.firebase?.isMock) {
        console.log('⚠️ STATUS: Sistema usando dados MOCK (não conectado ao Firebase real)');
        console.log('💡 SOLUÇÃO: Ativar Realtime Database no Firebase Console');
    } else {
        console.log('✅ STATUS: Firebase real detectado');
    }
    
    // Verificar dados em cada coleção
    ['species', 'clients', 'romaneiosTora'].forEach(colecao => {
        const dados = verificacao[colecao];
        if (dados?.existe) {
            console.log(`✅ ${colecao}: ${dados.count} registros`);
        } else {
            console.log(`❌ ${colecao}: Vazio ou não existe`);
        }
    });
    
    return relatorio;
}

// ✅ FUNÇÃO DE INICIALIZAÇÃO AUTOMÁTICA
async function inicializarCorrecao() {
    console.log('🚀 === INICIALIZANDO CORREÇÃO DE LISTAS ===');
    
    // Aguardar Firebase estar disponível
    let tentativas = 0;
    const maxTentativas = 20;
    
    while (!window.firebaseService && tentativas < maxTentativas) {
        console.log(`⏳ Aguardando Firebase... (${tentativas + 1}/${maxTentativas})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        tentativas++;
    }
    
    if (!window.firebaseService) {
        console.error('❌ Firebase Service não foi carregado após 20 segundos');
        return;
    }
    
    console.log('✅ Firebase Service detectado, iniciando correções...');
    
    // Aguardar mais um pouco para garantir inicialização
    setTimeout(async () => {
        console.log('🔧 Aplicando correções...');
        
        corrigirRenderizacaoListas();
        
        const relatorio = await gerarRelatorioCompleto();
        
        // Disponibilizar funções globalmente para debug
        window.debugListas = {
            diagnosticar: diagnosticarSistema,
            verificarDados: verificarDadosFirebase,
            testarListas: testarTodasAsListas,
            relatorio: gerarRelatorioCompleto,
            corrigirRenderizacao: corrigirRenderizacaoListas
        };
        
        console.log('✅ Correção de listas carregada!');
        console.log('💡 Use window.debugListas para funções de debug');
        
    }, 2000);
}

// ✅ AUTO-INICIALIZAR
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCorrecao);
} else {
    inicializarCorrecao();
}

console.log('✅ Script de correção de listas carregado'); 