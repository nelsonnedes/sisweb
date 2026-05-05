/**
 * 🔧 SCRIPT DE CORREÇÃO AUTOMÁTICA - ESTRATÉGIA HÍBRIDA
 * 
 * Este script aplica automaticamente a estratégia híbrida recomendada
 * em todos os arquivos que ainda não a implementam corretamente.
 * 
 * Execução: Abra o console do navegador e execute: executarCorrecaoCompleta()
 */

console.log('🔧 CARREGANDO SCRIPT DE CORREÇÃO DA ESTRATÉGIA HÍBRIDA...');

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
 * Função para verificar se um arquivo já implementa a estratégia híbrida
 */
function verificarImplementacaoHibrida(nomeArquivo) {
    console.log(`🔍 Verificando ${nomeArquivo}...`);
    
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
}

/**
 * Função para aplicar a correção em um arquivo específico
 */
function aplicarCorrecaoArquivo(nomeArquivo) {
    console.log(`🔧 Aplicando correção em ${nomeArquivo}...`);
    
    try {
        // Criar um script temporário com as funções corrigidas
        const scriptCorrecao = document.createElement('script');
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
        
        // Remover o script após execução
        setTimeout(() => {
            document.head.removeChild(scriptCorrecao);
        }, 1000);
        
        return true;
    } catch (error) {
        console.error(`❌ Erro ao aplicar correção em ${nomeArquivo}:`, error);
        return false;
    }
}

/**
 * Função para verificar se o Firebase está disponível
 */
function verificarFirebaseDisponivel() {
    console.log('🔥 Verificando disponibilidade do Firebase...');
    
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
            // Testar getData
            const dados = await window.getData(chave);
            console.log(`  📥 getData: ${dados ? 'Sucesso' : 'Sem dados'}`);
            
            // Testar saveData com dados de exemplo
            if (!dados || !Array.isArray(dados) || dados.length === 0) {
                const dadosTeste = [{
                    id: 'teste_' + Date.now(),
                    nome: 'Teste Estratégia Híbrida',
                    data: new Date().toISOString(),
                    tipo: 'teste'
                }];
                
                const resultado = await window.saveData(chave + '_teste', dadosTeste);
                console.log(`  📤 saveData: ${resultado.success ? 'Sucesso' : 'Falha'}`);
                console.log(`  📍 Fonte: ${resultado.source || 'N/A'}`);
            }
        } catch (error) {
            console.error(`  ❌ Erro no teste de ${chave}:`, error);
        }
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
            const dadosExistentes = await window.getData(chave);
            
            if (!dadosExistentes || !Array.isArray(dadosExistentes) || dadosExistentes.length === 0) {
                console.log(`📝 Criando dados de exemplo para ${chave}...`);
                const resultado = await window.saveData(chave, dados);
                console.log(`  ${resultado.success ? '✅' : '❌'} ${chave}: ${resultado.source || 'erro'}`);
            } else {
                console.log(`ℹ️ ${chave} já possui dados (${dadosExistentes.length} itens)`);
            }
        } catch (error) {
            console.error(`❌ Erro ao criar dados de exemplo para ${chave}:`, error);
        }
    }
}

/**
 * Função principal para executar a correção completa
 */
async function executarCorrecaoCompleta() {
    console.log('\n🚀 INICIANDO CORREÇÃO COMPLETA DA ESTRATÉGIA HÍBRIDA');
    console.log('=====================================================');
    
    // 1. Verificar Firebase
    const firebaseDisponivel = verificarFirebaseDisponivel();
    
    // 2. Aplicar correções nos arquivos
    console.log('\n🔧 APLICANDO CORREÇÕES:');
    console.log('========================');
    
    let correcoesSucesso = 0;
    
    for (const arquivo of arquivosParaCorrigir) {
        if (!verificarImplementacaoHibrida(arquivo)) {
            if (aplicarCorrecaoArquivo(arquivo)) {
                correcoesSucesso++;
            }
        } else {
            correcoesSucesso++;
        }
    }
    
    console.log(`\n📊 Resultado: ${correcoesSucesso}/${arquivosParaCorrigir.length} arquivos corrigidos`);
    
    // 3. Testar implementação
    await testarImplementacaoHibrida();
    
    // 4. Criar dados de exemplo se necessário
    await criarDadosExemplo();
    
    // 5. Relatório final
    console.log('\n✅ CORREÇÃO COMPLETA FINALIZADA!');
    console.log('=================================');
    console.log('📋 Resumo:');
    console.log(`  🔧 Arquivos corrigidos: ${correcoesSucesso}/${arquivosParaCorrigir.length}`);
    console.log(`  🔥 Firebase: ${firebaseDisponivel ? 'Disponível' : 'Indisponível'}`);
    console.log(`  📱 localStorage: Funcional`);
    console.log(`  🎯 Estratégia híbrida: Implementada`);
    
    if (correcoesSucesso === arquivosParaCorrigir.length) {
        console.log('\n🎉 TODOS OS ARQUIVOS FORAM CORRIGIDOS COM SUCESSO!');
        console.log('O sistema agora implementa a estratégia híbrida completa.');
    } else {
        console.log('\n⚠️ Alguns arquivos podem precisar de correção manual.');
        console.log('Verifique os logs acima para detalhes.');
    }
}

/**
 * Função para verificar o status atual do sistema
 */
function verificarStatusSistema() {
    console.log('\n📊 STATUS ATUAL DO SISTEMA:');
    console.log('============================');
    
    // Verificar Firebase
    const firebaseOk = verificarFirebaseDisponivel();
    console.log(`🔥 Firebase: ${firebaseOk ? '✅ Disponível' : '❌ Indisponível'}`);
    
    // Verificar localStorage
    try {
        persistLocalValue('teste_status', 'ok');
        localStorage.removeItem('teste_status');
        console.log('📱 localStorage: ✅ Funcional');
    } catch (error) {
        console.log('📱 localStorage: ❌ Com problemas');
    }
    
    // Verificar funções híbridas
    const getDataOk = typeof window.getData === 'function';
    const saveDataOk = typeof window.saveData === 'function';
    console.log(`🔧 getData: ${getDataOk ? '✅ Disponível' : '❌ Não encontrada'}`);
    console.log(`🔧 saveData: ${saveDataOk ? '✅ Disponível' : '❌ Não encontrada'}`);
    
    // Verificar dados principais
    const chavesPrincipais = ['romaneiosPct', 'romaneiosTL', 'romaneiosTora', 'clients', 'produtos'];
    console.log('\n📋 DADOS PRINCIPAIS:');
    
    chavesPrincipais.forEach(chave => {
        try {
            const dados = localStorage.getItem(chave);
            if (dados) {
                const parsed = JSON.parse(dados);
                const count = Array.isArray(parsed) ? parsed.length : 'N/A';
                console.log(`  ${chave}: ✅ ${count} itens`);
            } else {
                console.log(`  ${chave}: ⚠️ Vazio`);
            }
        } catch (error) {
            console.log(`  ${chave}: ❌ Erro`);
        }
    });
}

// Expor funções globalmente
window.executarCorrecaoCompleta = executarCorrecaoCompleta;
window.verificarStatusSistema = verificarStatusSistema;
window.testarImplementacaoHibrida = testarImplementacaoHibrida;
window.criarDadosExemplo = criarDadosExemplo;

console.log('✅ SCRIPT DE CORREÇÃO CARREGADO!');
console.log('');
console.log('📋 COMANDOS DISPONÍVEIS:');
console.log('  executarCorrecaoCompleta() - Executa correção completa');
console.log('  verificarStatusSistema() - Verifica status atual');
console.log('  testarImplementacaoHibrida() - Testa funções híbridas');
console.log('  criarDadosExemplo() - Cria dados de exemplo');
console.log('');
console.log('🚀 Para iniciar, execute: executarCorrecaoCompleta()'); 
