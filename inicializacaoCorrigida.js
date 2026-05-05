// Flag para controlar se a função já foi chamada
let inicializacaoExecutada = false;

// Nova implementação de inicializarAplicacao que evita recursão infinita
function inicializarAplicacao() {
    // Evitar chamadas recursivas
    if (inicializacaoExecutada) {
        console.log("Inicialização já em andamento, ignorando chamada recursiva");
        return false;
    }
    
    console.log("Inicializando aplicação romaneiopct (versão segura)...");
    inicializacaoExecutada = true;
    
    try {
        // Verificar se a função original do JS está disponível
        if (typeof window.inicializarAplicacaoOriginal === 'function') {
            return window.inicializarAplicacaoOriginal();
        } else {
            console.error("Função inicializarAplicacaoOriginal não está disponível, usando implementação básica");
            // Implementação básica que não cause recursão
            
            // Carregar dados iniciais
            if (typeof window.carregarClientes === 'function') window.carregarClientes();
            if (typeof window.carregarEspecies === 'function') window.carregarEspecies();
            
            // Reconstruir tabela
            if (typeof window.reconstruirTabela === 'function') window.reconstruirTabela();
            if (typeof window.atualizarTotais === 'function') window.atualizarTotais();
            
            // Inicializar eventos
            if (typeof window.inicializarTodosEventos === 'function') window.inicializarTodosEventos();
            
            return true;
        }
    } catch (error) {
        console.error("Erro durante inicialização segura:", error);
        return false;
    } finally {
        // Garantir que o flag seja resetado após alguns segundos
        // para permitir reinicialização futura se necessário
        setTimeout(function() {
            inicializacaoExecutada = false;
        }, 5000);
    }
}

// Expor a função para o escopo global
window.inicializarAplicacao = inicializarAplicacao;

// Renomear a função original do arquivo JS principal se existir
if (typeof window.inicializarAplicacao === 'function' && window.inicializarAplicacao !== inicializarAplicacao) {
    window.inicializarAplicacaoOriginal = window.inicializarAplicacao;
    window.inicializarAplicacao = inicializarAplicacao;
} 
