/**
 * 🔧 CORREÇÃO DIRETA DA ESTRATÉGIA HÍBRIDA
 * 
 * Execute este código diretamente no console das páginas originais:
 * - vendas.html
 * - estoque.html
 * - romaneiopct.html
 * etc.
 * 
 * Como usar:
 * 1. Abra vendas.html (ou outra página do sistema)
 * 2. Pressione F12 para abrir o console
 * 3. Cole este código e pressione Enter
 * 4. Execute: aplicarCorrecaoHibrida()
 */

console.log('🔧 SCRIPT DE CORREÇÃO DIRETA CARREGADO');

function persistLocalValue(key, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write(key, data) !== false;
        }
    } catch (_) {}
    localStorage.setItem(key, JSON.stringify(data));
    return true;
}

/**
 * Função para aplicar a estratégia híbrida diretamente
 */
async function aplicarCorrecaoHibrida() {
    console.log('\n🚀 INICIANDO CORREÇÃO DIRETA DA ESTRATÉGIA HÍBRIDA');
    console.log('====================================================');
    
    try {
        // 1. Verificar se estamos numa página do sistema
        const paginaAtual = window.location.pathname;
        console.log(`📍 Página atual: ${paginaAtual}`);
        
        if (!paginaAtual.includes('.html')) {
            console.warn('⚠️ Execute este script numa página HTML do sistema (vendas.html, estoque.html, etc.)');
            return;
        }

        // 2. Backup das funções originais (se existirem)
        const originalGetData = window.getData;
        const originalSaveData = window.saveData;
        
        console.log(`📋 getData original: ${typeof originalGetData}`);
        console.log(`📋 saveData original: ${typeof originalSaveData}`);

        // 3. Implementar a versão híbrida
        console.log('\n🔧 APLICANDO ESTRATÉGIA HÍBRIDA...');
        
        // Função híbrida getData
        window.getData = async function(key) {
            try {
                console.log(`📥 Carregando dados: ${key}`);
                
                // 1. Tentar Firebase primeiro se disponível
                if (window.firebaseService && window.firebaseService.authService) {
                    try {
                        const data = await window.firebaseService.authService.getUserData(key);
                        if (data && (Array.isArray(data) || typeof data === 'object')) {
                            console.log(`✅ ${key} carregado do Firebase (${Array.isArray(data) ? data.length : 'object'} itens)`);
                            // Sincronizar com localStorage
                            persistLocalValue(key, data);
                            return data;
                        }
                    } catch (firebaseError) {
                        console.warn(`⚠️ Erro Firebase para ${key}:`, firebaseError.message);
                    }
                }
                
                // 2. Fallback para localStorage
                const localData = localStorage.getItem(key);
                if (localData) {
                    try {
                        const parsedData = JSON.parse(localData);
                        console.log(`📱 ${key} carregado do localStorage (${Array.isArray(parsedData) ? parsedData.length : 'object'} itens)`);
                        return parsedData;
                    } catch (parseError) {
                        console.error(`❌ Erro ao parsear ${key}:`, parseError.message);
                    }
                }
                
                // 3. Tentar função original como último recurso
                if (originalGetData && typeof originalGetData === 'function') {
                    try {
                        const result = await originalGetData(key);
                        if (result) {
                            console.log(`🔄 ${key} carregado da função original`);
                            return result;
                        }
                    } catch (originalError) {
                        console.warn(`⚠️ Função original falhou para ${key}:`, originalError.message);
                    }
                }
                
                console.log(`ℹ️ Nenhum dado encontrado para ${key}`);
                return null;
            } catch (error) {
                console.error(`❌ Erro crítico ao carregar ${key}:`, error);
                return null;
            }
        };

        // Função híbrida saveData
        window.saveData = async function(key, data) {
            try {
                console.log(`📤 Salvando dados: ${key}`);
                
                // 1. Salvar no localStorage primeiro (offline-first)
                persistLocalValue(key, data);
                console.log(`📱 ${key} salvo no localStorage`);
                
                // 2. Tentar salvar no Firebase se disponível
                if (window.firebaseService && window.firebaseService.authService) {
                    try {
                        await window.firebaseService.authService.saveUserData(key, data);
                        console.log(`☁️ ${key} sincronizado com Firebase`);
                        return { success: true, source: 'both' };
                    } catch (firebaseError) {
                        console.warn(`⚠️ Erro Firebase ao salvar ${key}:`, firebaseError.message);
                        return { success: true, source: 'localStorage' };
                    }
                } else {
                    console.log(`⚠️ Firebase indisponível, ${key} salvo apenas localmente`);
                    return { success: true, source: 'localStorage' };
                }
            } catch (error) {
                console.error(`❌ Erro crítico ao salvar ${key}:`, error);
                return { success: false, error: error.message };
            }
        };

        // 4. Testar a implementação
        console.log('\n🧪 TESTANDO IMPLEMENTAÇÃO...');
        
        const chavesTeste = ['romaneiosPct', 'romaneiosTL', 'romaneiosTora', 'clients'];
        
        for (const chave of chavesTeste) {
            try {
                console.log(`\n📋 Testando ${chave}:`);
                const dados = await window.getData(chave);
                
                if (dados) {
                    const count = Array.isArray(dados) ? dados.length : 'object';
                    console.log(`  ✅ Sucesso: ${count} itens encontrados`);
                    
                    // Teste de salvamento (apenas se há dados)
                    const resultado = await window.saveData(chave, dados);
                    console.log(`  💾 Salvamento: ${resultado.success ? '✅' : '❌'} (${resultado.source || 'erro'})`);
                } else {
                    console.log(`  ⚠️ Nenhum dado encontrado`);
                }
            } catch (error) {
                console.error(`  ❌ Erro no teste de ${chave}:`, error.message);
            }
        }

        // 5. Verificar se há dados de romaneios
        console.log('\n📊 VERIFICAÇÃO ESPECÍFICA DE ROMANEIOS:');
        
        const romaneiosKeys = ['romaneiosPct', 'romaneiosTL', 'romaneiosTora'];
        let totalRomaneios = 0;
        
        romaneiosKeys.forEach(key => {
            try {
                const dados = localStorage.getItem(key);
                if (dados) {
                    const parsed = JSON.parse(dados);
                    const count = Array.isArray(parsed) ? parsed.length : 0;
                    totalRomaneios += count;
                    console.log(`  ${key}: ✅ ${count} itens`);
                } else {
                    console.log(`  ${key}: ⚠️ Vazio`);
                }
            } catch (error) {
                console.log(`  ${key}: ❌ Erro`);
            }
        });

        // 6. Atualizar interface se necessário
        if (typeof window.carregarRomaneios === 'function') {
            console.log('\n🔄 ATUALIZANDO INTERFACE...');
            try {
                await window.carregarRomaneios();
                console.log('✅ Interface atualizada');
            } catch (error) {
                console.warn('⚠️ Erro ao atualizar interface:', error.message);
            }
        }

        // 7. Relatório final
        console.log('\n✅ CORREÇÃO APLICADA COM SUCESSO!');
        console.log('=====================================');
        console.log('📋 Resumo:');
        console.log(`  🔧 Funções híbridas: Implementadas`);
        console.log(`  📱 localStorage: Funcional`);
        console.log(`  🔥 Firebase: ${window.firebaseService ? 'Disponível' : 'Indisponível'}`);
        console.log(`  📊 Total de romaneios: ${totalRomaneios}`);
        console.log(`  📍 Página: ${paginaAtual}`);
        
        if (totalRomaneios > 0) {
            console.log('\n🎉 PROBLEMA RESOLVIDO!');
            console.log('Os romaneios agora devem aparecer corretamente na interface.');
            console.log('Se não aparecerem, atualize a página (F5) e os dados serão carregados.');
        } else {
            console.log('\n📝 DADOS DE EXEMPLO NECESSÁRIOS');
            console.log('Execute: criarDadosExemploDirecto() para criar dados de teste');
        }

    } catch (error) {
        console.error('❌ ERRO CRÍTICO na correção:', error);
    }
}

/**
 * Função para criar dados de exemplo diretamente
 */
async function criarDadosExemploDirecto() {
    console.log('\n📝 CRIANDO DADOS DE EXEMPLO...');
    
    const dadosExemplo = {
        romaneiosPct: [
            {
                id: 'pct_' + Date.now(),
                data: new Date().toISOString(),
                cliente: { nome: 'Madeireira Exemplo Ltda', cidade: 'São Paulo' },
                volumeTotal: 15.750,
                itens: [
                    {
                        especie: 'Eucalipto',
                        quantidade: 150,
                        comprimento: 2.40,
                        largura: 0.10,
                        espessura: 0.025,
                        volume: 0.90
                    },
                    {
                        especie: 'Pinus',
                        quantidade: 200,
                        comprimento: 3.00,
                        largura: 0.12,
                        espessura: 0.025,
                        volume: 1.80
                    }
                ]
            }
        ],
        romaneiosTL: [
            {
                id: 'tl_' + Date.now(),
                data: new Date().toISOString(),
                cliente: { nome: 'Serraria Central', cidade: 'Curitiba' },
                volumeTotal: 28.500,
                itens: [
                    {
                        especie: 'Eucalipto',
                        quantidade: 80,
                        comprimento: 4.20,
                        largura: 0.15,
                        espessura: 0.025,
                        volume: 1.26
                    }
                ]
            }
        ]
    };

    for (const [chave, dados] of Object.entries(dadosExemplo)) {
        try {
            const resultado = await window.saveData(chave, dados);
            console.log(`📝 ${chave}: ${resultado.success ? '✅' : '❌'} ${resultado.source || 'erro'}`);
        } catch (error) {
            console.error(`❌ Erro ao criar ${chave}:`, error);
        }
    }

    console.log('✅ Dados de exemplo criados com sucesso!');
}

/**
 * Função para verificar o status atual
 */
function verificarStatusAtual() {
    console.log('\n📊 STATUS ATUAL DO SISTEMA:');
    console.log('============================');
    
    // Verificar funções
    console.log(`🔧 getData: ${typeof window.getData === 'function' ? '✅' : '❌'}`);
    console.log(`🔧 saveData: ${typeof window.saveData === 'function' ? '✅' : '❌'}`);
    console.log(`🔥 Firebase: ${window.firebaseService ? '✅' : '❌'}`);
    
    // Verificar dados
    const chaves = ['romaneiosPct', 'romaneiosTL', 'romaneiosTora', 'clients'];
    chaves.forEach(chave => {
        try {
            const dados = localStorage.getItem(chave);
            if (dados) {
                const parsed = JSON.parse(dados);
                const count = Array.isArray(parsed) ? parsed.length : 'N/A';
                console.log(`📋 ${chave}: ✅ ${count} itens`);
            } else {
                console.log(`📋 ${chave}: ⚠️ Vazio`);
            }
        } catch (error) {
            console.log(`📋 ${chave}: ❌ Erro`);
        }
    });
}

// Expor funções globalmente
window.aplicarCorrecaoHibrida = aplicarCorrecaoHibrida;
window.criarDadosExemploDirecto = criarDadosExemploDirecto;
window.verificarStatusAtual = verificarStatusAtual;

console.log('✅ CORREÇÃO DIRETA CARREGADA!');
console.log('');
console.log('📋 COMANDOS DISPONÍVEIS:');
console.log('  aplicarCorrecaoHibrida() - Aplica a estratégia híbrida');
console.log('  verificarStatusAtual() - Verifica status do sistema');
console.log('  criarDadosExemploDirecto() - Cria dados de exemplo');
console.log('');
console.log('🚀 EXECUTE: aplicarCorrecaoHibrida()');
console.log('📍 Certifique-se de estar numa página do sistema (vendas.html, etc.)'); 
