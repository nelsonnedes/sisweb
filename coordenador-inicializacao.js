/**
 * Coordenador de Inicialização do Sistema
 * Versão 1.0 - 2024
 * 
 * Este arquivo coordena a inicialização completa do sistema,
 * garantindo que todos os componentes sejam carregados na ordem correta
 */

console.log('🚀 Coordenador de Inicialização do Sistema carregado');

// Estados globais de inicialização
window._SISTEMA_ESTADOS = {
    firebase: false,
    databaseAdapter: false,
    interface: false,
    aplicacao: false,
    completo: false
};

/**
 * Aguardar que todos os componentes do sistema estejam prontos
 */
async function aguardarSistemaPronto() {
    console.log('🔄 Aguardando sistema estar completamente pronto...');
    
    const maxTentativas = 240; // 2 minutos
    let tentativas = 0;
    
    while (tentativas < maxTentativas) {
        tentativas++;
        
        // Verificar Firebase
        const firebaseOk = window._FIREBASE_READY || !window.firebaseService;
        
        // Verificar DatabaseAdapter
        const adapterOk = window.databaseAdapter && typeof window.databaseAdapter === 'object';
        
        // Verificar Interface
        const interfaceOk = window._INTERFACE_CORRIGIDA === true;
        
        // Atualizar estados
        window._SISTEMA_ESTADOS.firebase = firebaseOk;
        window._SISTEMA_ESTADOS.databaseAdapter = adapterOk;
        window._SISTEMA_ESTADOS.interface = interfaceOk;
        
        // Log do progresso a cada 10 tentativas
        if (tentativas % 10 === 0) {
            console.log(`🔍 Verificação ${tentativas}/${maxTentativas}:`, {
                firebase: firebaseOk ? '✅' : '❌',
                adapter: adapterOk ? '✅' : '❌', 
                interface: interfaceOk ? '✅' : '❌'
            });
        }
        
        // Se tudo estiver pronto
        if (firebaseOk && adapterOk && interfaceOk) {
            console.log('✅ Todos os componentes do sistema estão prontos!');
            window._SISTEMA_ESTADOS.completo = true;
            return true;
        }
        
        // Aguardar 500ms antes da próxima verificação
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.warn('⚠️ Sistema não ficou completamente pronto no tempo limite');
    console.warn('📊 Estado final dos componentes:', window._SISTEMA_ESTADOS);
    return false;
}

/**
 * Inicializar aplicação de forma coordenada
 */
async function inicializarAplicacaoCompleta() {
    console.log('🚀 Iniciando aplicação completa...');
    
    try {
        // Aguardar sistema estar pronto
        const sistemaOk = await aguardarSistemaPronto();
        
        if (!sistemaOk) {
            console.warn('⚠️ Sistema não está completamente pronto, mas continuando...');
        }
        
        // Executar inicialização da aplicação
        if (typeof window.inicializarAplicacao === 'function') {
            console.log('🔧 Executando inicializarAplicacao...');
            await window.inicializarAplicacao();
            window._SISTEMA_ESTADOS.aplicacao = true;
            console.log('✅ Aplicação inicializada com sucesso!');
        } else {
            console.warn('⚠️ Função inicializarAplicacao não encontrada');
        }
        
        // Disparar evento de sistema pronto
        const evento = new CustomEvent('sistemaRomaneiosPronto', {
            detail: {
                estados: window._SISTEMA_ESTADOS,
                timestamp: new Date().toISOString()
            }
        });
        window.dispatchEvent(evento);
        console.log('📢 Evento sistemaRomaneiosPronto disparado');
        
    } catch (error) {
        console.error('❌ Erro na inicialização completa:', error);
    }
}

/**
 * Verificar periodicamente se pode inicializar
 */
function verificarEInicializar() {
    // Se o bloqueio ainda estiver ativo, aguardar
    if (window._BLOCK_INIT) {
        console.log('🚫 Inicialização ainda bloqueada, aguardando...');
        setTimeout(verificarEInicializar, 1000);
        return;
    }
    
    // Se já foi inicializado, não repetir
    if (window._SISTEMA_ESTADOS.aplicacao) {
        console.log('✅ Sistema já foi inicializado');
        return;
    }
    
    console.log('🔓 Bloqueio removido, iniciando aplicação...');
    inicializarAplicacaoCompleta();
}

// Escutar eventos de componentes prontos
window.addEventListener('firebasePronto', () => {
    console.log('🔥 Firebase reportou estar pronto');
    window._SISTEMA_ESTADOS.firebase = true;
});

window.addEventListener('interfaceDatabaseAdapterPronta', () => {
    console.log('🔧 Interface DatabaseAdapter reportou estar pronta');
    window._SISTEMA_ESTADOS.interface = true;
});

// Iniciar verificação quando DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM carregado, iniciando verificação do sistema...');
        setTimeout(verificarEInicializar, 50);
    });
} else {
    console.log('📄 DOM já carregado, iniciando verificação do sistema...');
    setTimeout(verificarEInicializar, 50);
}

console.log('✅ Coordenador de Inicialização configurado'); 