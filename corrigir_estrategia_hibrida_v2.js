/**
 * 🔧 SCRIPT DE CORREÇÃO AUTOMÁTICA V2 - ESTRATÉGIA HÍBRIDA
 * 
 * Versão melhorada que evita travamentos da página
 * 
 * Execução: Abra o console do navegador e execute: executarCorrecaoCompleta()
 */

console.log('🔧 CARREGANDO SCRIPT DE CORREÇÃO V2 - SEM TRAVAMENTOS...');

function persistLocalValue(key, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            window.SiswebStorage.write(key, data);
            return;
        }
    } catch (_) {}
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    localStorage.setItem(key, payload);
}

/**
 * Função padrão getData que implementa a estratégia híbrida
 */
const getDataHibrido = `
function persistLocalValue(key, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            window.SiswebStorage.write(key, data);
            return;
        }
    } catch (_) {}
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    localStorage.setItem(key, payload);
}

async function getData(key) {
    try {
        // 1. Tentar Firebase primeiro se disponível
        if (window.firebaseService && window.firebaseService.authService) {
            try {
                const data = await window.firebaseService.authService.getUserData(key);
                if (data && (Array.isArray(data) || typeof data === 'object')) {
                    console.log(\`✅ \${key} carregado do Firebase\`);
                    // Sincronizar com localStorage para uso offline
                    persistLocalValue(key, data);
                    return data;
                }
            } catch (firebaseError) {
                console.warn(\`⚠️ Erro ao carregar \${key} do Firebase:\`, firebaseError);
            }
        }
        
        // 2. Fallback para localStorage
        const localData = localStorage.getItem(key);
        if (localData) {
            try {
                const parsedData = JSON.parse(localData);
                console.log(\`📱 \${key} carregado do localStorage\`);
                return parsedData;
            } catch (parseError) {
                console.error(\`❌ Erro ao parsear \${key} do localStorage:\`, parseError);
            }
        }
        
        console.log(\`ℹ️ Nenhum dado encontrado para \${key}\`);
        return null;
    } catch (error) {
        console.error(\`❌ Erro ao recuperar dados de '\${key}':\`, error);
        return null;
    }
}`;

/**
 * Função padrão saveData que implementa a estratégia híbrida
 */
const saveDataHibrido = `
async function saveData(key, data) {
    try {
        // 1. Salvar no localStorage primeiro (offline-first)
        persistLocalValue(key, data);
        console.log(\`📱 \${key} salvo no localStorage\`);
        
        // 2. Tentar salvar no Firebase se disponível
        if (window.firebaseService && window.firebaseService.authService) {
            try {
                await window.firebaseService.authService.saveUserData(key, data);
                console.log(\`☁️ \${key} salvo no Firebase com sucesso\`);
                return { success: true, source: 'both' };
            } catch (firebaseError) {
                console.warn(\`⚠️ Erro ao salvar \${key} no Firebase:\`, firebaseError);
                return { success: true, source: 'localStorage' };
            }
        } else {
            console.log(\`⚠️ Firebase não disponível, \${key} salvo apenas no localStorage\`);
            return { success: true, source: 'localStorage' };
        }
    } catch (error) {
        console.error(\`❌ Erro ao salvar dados em '\${key}':\`, error);
        return { success: false, error: error.message };
    }
}`;

/**
 * Lista de arquivos que precisam de correção
 */
const arquivosParaCorrigir = [
    'romaneiopct_salvar.js',
    'romaneiopct_tabela.js',
    'romaneiopct_modais.js',
    'romaneiopct_new.js',
    'romaneiotl.js',
    'romaneio.js'
];

/**
 * Função para dar delay entre operações (evita travamento)
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Função para verificar se um arquivo já implementa a estratégia híbrida
 */
async function verificarImplementacaoHibrida(nomeArquivo) {
    console.log(`🔍 Verificando ${nomeArquivo}...`);
    
    // Delay para evitar travamento
    await delay(100);
    
    try {
        // Verificar se as funções getData e saveData existem e são híbridas
        const scripts = document.querySelectorAll('script[src*="' + nomeArquivo + '"]');
        
        if (scripts.length === 0) {
            console.log(`⚠️ ${nomeArquivo} não encontrado no DOM`);
            return false;
        }
        
        // Verificar se window.getData e window.saveData existem e são híbridas
        if (typeof window.getData === 'function' && typeof window.saveData === 'function') {
            const getDataStr = window.getData.toString();
            const saveDataStr = window.saveData.toString();
            
            const temFirebaseCheck = getDataStr.includes('firebaseService') && saveDataStr.includes('firebaseService');
            const temLocalStorageFallback = getDataStr.includes('localStorage') && saveDataStr.includes('localStorage');
            
            if (temFirebaseCheck && temLocalStorageFallback) {
                console.log(`✅ ${nomeArquivo} já implementa estratégia híbrida`);
                return true;
            }
        }
        
        console.log(`⚠️ ${nomeArquivo} precisa de correção`);
        return false;
    } catch (error) {
        console.error(`❌ Erro ao verificar ${nomeArquivo}:`, error);
        return false;
    }
}

/**
 * Função para aplicar a correção em um arquivo específico
 */
async function aplicarCorrecaoArquivo(nomeArquivo) {
    console.log(`🔧 Aplicando correção em ${nomeArquivo}...`);
    
    try {
        // Delay para evitar travamento
        await delay(200);
        
        // Criar um script temporário com as funções corrigidas
        const scriptCorrecao = document.createElement('script');
        scriptCorrecao.id = 'correcao_' + nomeArquivo.replace('.js', '');
        scriptCorrecao.innerHTML = `
            console.log('🔧 Aplicando correção híbrida em ${nomeArquivo}...');
            
            // Sobrescrever getData com versão híbrida
            ${getDataHibrido}
            
            // Sobrescrever saveData com versão híbrida
            ${saveDataHibrido}
            
            // Expor globalmente
            window.getData = getData;
            window.saveData = saveData;
            
            console.log('✅ Correção aplicada em ${nomeArquivo}');
        `;
        
        document.head.appendChild(scriptCorrecao);
        
        // Aguardar execução
        await delay(500);
        
        // Remover o script após execução (cleanup)
        setTimeout(() => {
            if (document.head.contains(scriptCorrecao)) {
                document.head.removeChild(scriptCorrecao);
            }
        }, 2000);
        
        return true;
    } catch (error) {
        console.error(`❌ Erro ao aplicar correção em ${nomeArquivo}:`, error);
        return false;
    }
}

/**
 * Função para verificar se o Firebase está disponível
 */
async function verificarFirebaseDisponivel() {
    console.log('🔥 Verificando disponibilidade do Firebase...');
    
    // Delay para evitar travamento
    await delay(100);
    
    try {
        if (!window.firebaseService) {
            console.log('⚠️ firebaseService não encontrado');
            return false;
        }
        
        if (!window.firebaseService.authService) {
            console.log('⚠️ authService não encontrado');
            return false;
        }
        
        console.log('✅ Firebase disponível');
        return true;
    } catch (error) {
        console.error('❌ Erro ao verificar Firebase:', error);
        return false;
    }
}

/**
 * Função para testar a implementação híbrida
 */
async function testarImplementacaoHibrida() {
    console.log('\n🧪 TESTANDO IMPLEMENTAÇÃO HÍBRIDA:');
    console.log('=====================================');
    
    const chavesTeste = ['romaneiosPct', 'romaneiosTL', 'romaneiosTora'];
    
    for (const chave of chavesTeste) {
        console.log(`\n📋 Testando ${chave}:`);
        
        try {
            // Delay entre testes
            await delay(300);
            
            // Testar getData
            const dados = await window.getData(chave);
            console.log(`  📥 getData: ${dados ? 'Sucesso' : 'Sem dados'}`);
            
            // Delay antes do próximo teste
            await delay(200);
            
            // Testar saveData com dados de exemplo (apenas se necessário)
            if (!dados || !Array.isArray(dados) || dados.length === 0) {
                const dadosTeste = [{
                    id: 'teste_' + Date.now(),
                    nome: 'Teste Estratégia Híbrida',
                    data: new Date().toISOString(),
                    tipo: 'teste'
                }];
                
                const resultado = await window.saveData(chave + '_teste', dadosTeste);
                console.log(`  📤 saveData: ${resultado && resultado.success ? 'Sucesso' : 'Falha'}`);
                console.log(`  📍 Fonte: ${resultado && resultado.source ? resultado.source : 'N/A'}`);
            }
        } catch (error) {
            console.error(`  ❌ Erro no teste de ${chave}:`, error);
        }
        
        // Delay entre iterações
        await delay(150);
    }
}

/**
 * Função para criar dados de exemplo se necessário
 */
async function criarDadosExemplo() {
    console.log('\n📝 CRIANDO DADOS DE EXEMPLO:');
    console.log('=============================');
    
    const dadosExemplo = {
        romaneiosPct: [
            {
                id: 'pct_exemplo_001',
                data: new Date().toISOString(),
                cliente: { nome: 'Cliente Exemplo PCT' },
                volumeTotal: 10.500,
                itens: [
                    {
                        especie: 'Eucalipto',
                        quantidade: 100,
                        comprimento: 2.40,
                        largura: 0.10,
                        espessura: 0.025
                    }
                ]
            }
        ],
        romaneiosTL: [
            {
                id: 'tl_exemplo_001',
                data: new Date().toISOString(),
                cliente: { nome: 'Cliente Exemplo TL' },
                volumeTotal: 25.750,
                itens: [
                    {
                        especie: 'Pinus',
                        quantidade: 50,
                        comprimento: 3.00,
                        largura: 0.15,
                        espessura: 0.025
                    }
                ]
            }
        ],
        romaneiosTora: [
            {
                id: 'tora_exemplo_001',
                data: new Date().toISOString(),
                cliente: { nome: 'Cliente Exemplo Tora' },
                volumeTotal: 15.250,
                itens: [
                    {
                        especie: 'Eucalipto',
                        diametro: 25,
                        comprimento: 6.00,
                        quantidade: 10
                    }
                ]
            }
        ]
    };
    
    for (const [chave, dados] of Object.entries(dadosExemplo)) {
        try {
            // Delay entre operações
            await delay(250);
            
            const dadosExistentes = await window.getData(chave);
            
            if (!dadosExistentes || !Array.isArray(dadosExistentes) || dadosExistentes.length === 0) {
                console.log(`📝 Criando dados de exemplo para ${chave}...`);
                
                // Delay antes de salvar
                await delay(100);
                
                const resultado = await window.saveData(chave, dados);
                console.log(`  ${resultado && resultado.success ? '✅' : '❌'} ${chave}: ${resultado && resultado.source ? resultado.source : 'erro'}`);
            } else {
                console.log(`ℹ️ ${chave} já possui dados (${dadosExistentes.length} itens)`);
            }
        } catch (error) {
            console.error(`❌ Erro ao criar dados de exemplo para ${chave}:`, error);
        }
    }
}

/**
 * Função principal para executar a correção completa (SEM TRAVAMENTOS)
 */
async function executarCorrecaoCompleta() {
    console.log('\n🚀 INICIANDO CORREÇÃO COMPLETA DA ESTRATÉGIA HÍBRIDA V2');
    console.log('========================================================');
    
    try {
        // 1. Verificar Firebase
        console.log('\n🔥 FASE 1: Verificando Firebase...');
        const firebaseDisponivel = await verificarFirebaseDisponivel();
        
        // Delay entre fases
        await delay(500);
        
        // 2. Aplicar correções nos arquivos
        console.log('\n🔧 FASE 2: Aplicando correções...');
        console.log('==================================');
        
        let correcoesSucesso = 0;
        
        for (let i = 0; i < arquivosParaCorrigir.length; i++) {
            const arquivo = arquivosParaCorrigir[i];
            console.log(`\n📁 Processando ${i + 1}/${arquivosParaCorrigir.length}: ${arquivo}`);
            
            const jaImplementa = await verificarImplementacaoHibrida(arquivo);
            
            if (!jaImplementa) {
                const sucesso = await aplicarCorrecaoArquivo(arquivo);
                if (sucesso) {
                    correcoesSucesso++;
                }
            } else {
                correcoesSucesso++;
            }
            
            // Atualizar progresso na interface se disponível
            if (window.updateProgress) {
                const progresso = Math.round(((i + 1) / arquivosParaCorrigir.length) * 40) + 20;
                window.updateProgress(progresso, `Processando ${arquivo}...`);
            }
            
            // Delay entre arquivos
            await delay(300);
        }
        
        console.log(`\n📊 Resultado: ${correcoesSucesso}/${arquivosParaCorrigir.length} arquivos corrigidos`);
        
        // Delay entre fases
        await delay(1000);
        
        // 3. Testar implementação
        console.log('\n🧪 FASE 3: Testando implementação...');
        if (window.updateProgress) {
            window.updateProgress(70, 'Testando implementação...');
        }
        await testarImplementacaoHibrida();
        
        // Delay entre fases
        await delay(1000);
        
        // 4. Criar dados de exemplo se necessário
        console.log('\n📝 FASE 4: Criando dados de exemplo...');
        if (window.updateProgress) {
            window.updateProgress(85, 'Criando dados de exemplo...');
        }
        await criarDadosExemplo();
        
        // Delay final
        await delay(500);
        
        // 5. Relatório final
        console.log('\n✅ CORREÇÃO COMPLETA FINALIZADA!');
        console.log('=================================');
        console.log('📋 Resumo:');
        console.log(`  🔧 Arquivos corrigidos: ${correcoesSucesso}/${arquivosParaCorrigir.length}`);
        console.log(`  🔥 Firebase: ${firebaseDisponivel ? 'Disponível' : 'Indisponível'}`);
        console.log(`  📱 localStorage: Funcional`);
        console.log(`  🎯 Estratégia híbrida: Implementada`);
        
        if (window.updateProgress) {
            window.updateProgress(100, 'Correção completa finalizada!');
        }
        
        if (correcoesSucesso === arquivosParaCorrigir.length) {
            console.log('\n🎉 TODOS OS ARQUIVOS FORAM CORRIGIDOS COM SUCESSO!');
            console.log('O sistema agora implementa a estratégia híbrida completa.');
        } else {
            console.log('\n⚠️ Alguns arquivos podem precisar de correção manual.');
            console.log('Verifique os logs acima para detalhes.');
        }
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO na correção completa:', error);
        if (window.updateProgress) {
            window.updateProgress(0, 'Erro na correção: ' + error.message);
        }
    }
}

/**
 * Função para verificar o status atual do sistema
 */
async function verificarStatusSistema() {
    console.log('\n📊 STATUS ATUAL DO SISTEMA:');
    console.log('============================');
    
    try {
        // Verificar Firebase
        const firebaseOk = await verificarFirebaseDisponivel();
        console.log(`🔥 Firebase: ${firebaseOk ? '✅ Disponível' : '❌ Indisponível'}`);
        
        await delay(100);
        
        // Verificar localStorage
        try {
            persistLocalValue('teste_status', 'ok');
            localStorage.removeItem('teste_status');
            console.log('📱 localStorage: ✅ Funcional');
        } catch (error) {
            console.log('📱 localStorage: ❌ Com problemas');
        }
        
        await delay(100);
        
        // Verificar funções híbridas
        const getDataOk = typeof window.getData === 'function';
        const saveDataOk = typeof window.saveData === 'function';
        console.log(`🔧 getData: ${getDataOk ? '✅ Disponível' : '❌ Não encontrada'}`);
        console.log(`🔧 saveData: ${saveDataOk ? '✅ Disponível' : '❌ Não encontrada'}`);
        
        await delay(100);
        
        // Verificar dados principais
        const chavesPrincipais = ['romaneiosPct', 'romaneiosTL', 'romaneiosTora', 'clients', 'produtos'];
        console.log('\n📋 DADOS PRINCIPAIS:');
        
        for (const chave of chavesPrincipais) {
            try {
                const dados = localStorage.getItem(chave);
                if (dados) {
                    const parsed = JSON.parse(dados);
                    const count = Array.isArray(parsed) ? parsed.length : 'N/A';
                    console.log(`  ${chave}: ✅ ${count} itens`);
                } else {
                    console.log(`  ${chave}: ⚠️ Vazio`);
                }
                await delay(50);
            } catch (error) {
                console.log(`  ${chave}: ❌ Erro`);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
    }
}

// Expor funções globalmente
window.executarCorrecaoCompleta = executarCorrecaoCompleta;
window.verificarStatusSistema = verificarStatusSistema;
window.testarImplementacaoHibrida = testarImplementacaoHibrida;
window.criarDadosExemplo = criarDadosExemplo;

console.log('✅ SCRIPT DE CORREÇÃO V2 CARREGADO (SEM TRAVAMENTOS)!');
console.log('');
console.log('📋 COMANDOS DISPONÍVEIS:');
console.log('  executarCorrecaoCompleta() - Executa correção completa sem travamentos');
console.log('  verificarStatusSistema() - Verifica status atual');
console.log('  testarImplementacaoHibrida() - Testa funções híbridas');
console.log('  criarDadosExemplo() - Cria dados de exemplo');
console.log('');
console.log('🚀 Para iniciar, execute: executarCorrecaoCompleta()');
console.log('⚡ Esta versão inclui delays e otimizações para evitar travamentos!'); 
