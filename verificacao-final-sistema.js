/**
 * Verificação Final do Sistema - Romaneios
 * Arquivo para garantir que todos os componentes estão funcionando
 * Data: 20/12/2024
 */

console.log('🔍 Iniciando verificação final do sistema...');

// Aguardar componentes prontos
async function aguardarComponentes() {
    console.log('⏳ Aguardando componentes...');
    
    let tentativas = 0;
    const maxTentativas = 30; // 15 segundos
    
    while (tentativas < maxTentativas) {
        const componentes = {
            databaseAdapter: window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function',
            firebaseService: typeof window.firebaseService === 'object',
            getData: typeof getData === 'function',
            saveData: typeof saveData === 'function'
        };
        
        console.log(`🔧 Tentativa ${tentativas + 1}: ${JSON.stringify(componentes)}`);
        
        if (componentes.databaseAdapter && componentes.getData) {
            console.log('✅ Componentes principais prontos!');
            return true;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        tentativas++;
    }
    
    console.warn('⚠️ Timeout aguardando componentes');
    return false;
}

// Verificar status dos arquivos corrigidos
function verificarArquivosCorrigidos() {
    console.log('📁 Verificando arquivos corrigidos...');
    
    const verificacoes = {
        'correcao-lista-romaneios.js': typeof abrirListaRomaneiosCorrigida === 'function',
        'correcao-interface-database.js': typeof aguardarInterfaceCorrigida === 'function',
        'teste-dados-romaneio.js': typeof diagnosticoCompleto === 'function'
    };
    
    console.log('📋 Status dos arquivos:', verificacoes);
    
    return Object.values(verificacoes).every(status => status);
}

// Executar verificação completa
async function executarVerificacaoFinal() {
    console.log('🎯 Executando verificação final...');
    
    try {
        // 1. Aguardar componentes
        const componentesProntos = await aguardarComponentes();
        
        // 2. Verificar arquivos corrigidos
        const arquivosOk = verificarArquivosCorrigidos();
        
        // 3. Testar funcionalidade básica
        let testeFuncionalidade = false;
        if (window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function') {
            try {
                const resultado = await window.databaseAdapter.loadData('romaneiosTora');
                testeFuncionalidade = true;
                console.log('✅ Teste de funcionalidade passou');
            } catch (error) {
                console.warn('⚠️ Teste de funcionalidade falhou:', error.message);
            }
        } else if (window.dbAdapter && typeof window.dbAdapter.load === 'function') {
            try {
                const resultado = await window.dbAdapter.load('romaneiosTora');
                testeFuncionalidade = true;
                console.log('✅ Teste de funcionalidade passou (dbAdapter)');
            } catch (error) {
                console.warn('⚠️ Teste de funcionalidade falhou (dbAdapter):', error.message);
            }
        }
        
        // 4. Resultado final
        const resultado = {
            componentesProntos,
            arquivosOk,
            testeFuncionalidade,
            timestamp: new Date().toISOString()
        };
        
        console.log('🏁 RESULTADO FINAL:', resultado);
        
        if (componentesProntos && arquivosOk) {
            console.log('🎉 SISTEMA PRONTO PARA USO!');
            
            // Mostrar notificação visual
            if (typeof mostrarNotificacao === 'function') {
                mostrarNotificacao('✅ Sistema verificado e pronto!', 'success');
            }
        } else {
            console.warn('⚠️ Sistema com problemas - verificar logs');
        }
        
        return resultado;
        
    } catch (error) {
        console.error('❌ Erro na verificação final:', error);
        return { erro: error.message };
    }
}

// Executar verificação quando possível
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(executarVerificacaoFinal, 2000);
    });
} else {
    setTimeout(executarVerificacaoFinal, 2000);
}

console.log('✅ Verificação final carregada!'); 