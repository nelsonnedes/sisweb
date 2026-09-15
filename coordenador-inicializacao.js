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
    const checar = () => ({
        firebase: Boolean(window._FIREBASE_READY) || !window.firebaseService,
        adapter: Boolean(window.databaseAdapter && typeof window.databaseAdapter === 'object'),
        interface: window._INTERFACE_CORRIGIDA === true
    });
    const tudoPronto = (e) => e.firebase && e.adapter && e.interface;

    let estado = checar();
    if (tudoPronto(estado)) {
        console.log('? Todos os componentes do sistema est�o prontos!');
        window._SISTEMA_ESTADOS.firebase = true;
        window._SISTEMA_ESTADOS.databaseAdapter = true;
        window._SISTEMA_ESTADOS.interface = true;
        window._SISTEMA_ESTADOS.completo = true;
        return true;
    }

    console.log('?? Aguardando sistema estar completamente pronto...');

    const TIMEOUT_MS = 60000;
    const POLL_MS = 1000;
    const inicio = Date.now();
    let acordar = null;

    const onSinal = () => { if (acordar) { const f = acordar; acordar = null; f(); } };
    ['firebasePronto', 'interfaceDatabaseAdapterPronta', 'sistemaRomaneiosPronto'].forEach((ev) => {
        window.addEventListener(ev, onSinal);
    });

    try {
        while (Date.now() - inicio < TIMEOUT_MS) {
            estado = checar();
            if (tudoPronto(estado)) {
                console.log('? Todos os componentes do sistema est�o prontos!');
                window._SISTEMA_ESTADOS.firebase = estado.firebase;
                window._SISTEMA_ESTADOS.databaseAdapter = estado.adapter;
                window._SISTEMA_ESTADOS.interface = estado.interface;
                window._SISTEMA_ESTADOS.completo = true;
                return true;
            }
            await new Promise((resolve) => {
                acordar = resolve;
                setTimeout(() => { if (acordar === resolve) { acordar = null; resolve(); } }, POLL_MS);
            });
        }
    } finally {
        ['firebasePronto', 'interfaceDatabaseAdapterPronta', 'sistemaRomaneiosPronto'].forEach((ev) => {
            window.removeEventListener(ev, onSinal);
        });
    }

    estado = checar();
    window._SISTEMA_ESTADOS.firebase = estado.firebase;
    window._SISTEMA_ESTADOS.databaseAdapter = estado.adapter;
    window._SISTEMA_ESTADOS.interface = estado.interface;
    console.warn('?? Sistema n�o ficou completamente pronto no tempo limite (60s)');
    console.warn('?? Estado final dos componentes:', window._SISTEMA_ESTADOS);
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
        
        // Disparar evento de sistema pronto (1x — o init inline da página
        // também dispara; guard evita boot duplo nos listeners)
        if (!window._SISTEMA_PRONTO_DISPARADO) {
            window._SISTEMA_PRONTO_DISPARADO = true;
            const evento = new CustomEvent('sistemaRomaneiosPronto', {
                detail: {
                    estados: window._SISTEMA_ESTADOS,
                    timestamp: new Date().toISOString()
                }
            });
            window.dispatchEvent(evento);
            console.log('📢 Evento sistemaRomaneiosPronto disparado');
        }
        
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