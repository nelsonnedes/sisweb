/**
 * 📄 FOLHA PAGINAÇÃO - Sistema de paginação para tabela de folhas
 * Implementa paginação com limite de 5 itens por página
 * Integra com sistema de filtros existente
 */

class FolhaPaginacao {
    constructor() {
        this.itensPorPagina = 5;
        this.paginaAtual = 1;
        this.totalItens = 0;
        this.totalPaginas = 0;
        this.dadosFiltrados = [];
        
        this.init();
    }
    
    init() {
        if (window.__folhaDebug) console.log('📄 Sistema de paginação inicializado');
        this.criarControlesPaginacao();
    }
    
    /**
     * 🎨 CRIAR CONTROLES DE PAGINAÇÃO
     */
    criarControlesPaginacao() {
        if (window.__folhaDebug) console.log('🎨 Criando controles de paginação...');
        
        const tabelaSection = document.getElementById('tabela-folhas-section');
        if (!tabelaSection) {
            console.error('❌ Seção de tabela não encontrada');
            return;
        }
        
        if (window.__folhaDebug) console.log('✅ Seção de tabela encontrada:', tabelaSection);
        
        // Verificar se já existe controles de paginação
        if (document.getElementById('paginacaoControles')) {
            if (window.__folhaDebug) console.log('⚠️ Controles de paginação já existem, removendo...');
            document.getElementById('paginacaoControles').remove();
        }
        
        // Criar container de controles
        const controlesContainer = document.createElement('div');
        controlesContainer.className = 'paginacao-controles';
        controlesContainer.id = 'paginacaoControles';
        
        controlesContainer.innerHTML = `
            <div class="paginacao-info">
                <span id="paginacaoInfo">Mostrando 0 de 0 itens</span>
            </div>
            <div class="paginacao-navegacao">
                <button id="btnPrimeiraPagina" class="btn-paginacao" title="Primeira página">
                    <i class="fas fa-angle-double-left"></i>
                </button>
                <button id="btnPaginaAnterior" class="btn-paginacao" title="Página anterior">
                    <i class="fas fa-angle-left"></i>
                </button>
                <span id="paginaAtualInfo" class="pagina-atual">Página 1</span>
                <button id="btnProximaPagina" class="btn-paginacao" title="Próxima página">
                    <i class="fas fa-angle-right"></i>
                </button>
                <button id="btnUltimaPagina" class="btn-paginacao" title="Última página">
                    <i class="fas fa-angle-double-right"></i>
                </button>
            </div>
            <div class="paginacao-config">
                <label for="itensPorPaginaSelect">Itens por página:</label>
                <select id="itensPorPaginaSelect">
                    <option value="5" selected>5</option>
                    <option value="10">10</option>
                    <option value="25">25</option>
                </select>
            </div>
        `;
        
        // Inserir após a tabela
        const tableContainer = tabelaSection.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.after(controlesContainer);
            if (window.__folhaDebug) console.log('✅ Controles de paginação inseridos após a tabela');
        } else {
            console.error('❌ Container da tabela não encontrado');
        }
        
        this.configurarEventosPaginacao();
    }
    
    /**
     * 🎯 CONFIGURAR EVENTOS DE PAGINAÇÃO
     */
    configurarEventosPaginacao() {
        if (window.__folhaDebug) console.log('🎯 Configurando eventos de paginação...');
        
        // Botões de navegação
        const btnPrimeira = document.getElementById('btnPrimeiraPagina');
        const btnAnterior = document.getElementById('btnPaginaAnterior');
        const btnProxima = document.getElementById('btnProximaPagina');
        const btnUltima = document.getElementById('btnUltimaPagina');
        const itensSelect = document.getElementById('itensPorPaginaSelect');
        
        if (window.__folhaDebug) console.log('🔍 Elementos de paginação encontrados:', {
            btnPrimeira: !!btnPrimeira,
            btnAnterior: !!btnAnterior,
            btnProxima: !!btnProxima,
            btnUltima: !!btnUltima,
            itensSelect: !!itensSelect
        });
        
        if (btnPrimeira) {
            btnPrimeira.addEventListener('click', () => {
                if (window.__folhaDebug) console.log('📄 Clicou na primeira página');
                this.irParaPagina(1);
            });
        }
        
        if (btnAnterior) {
            btnAnterior.addEventListener('click', () => {
                if (window.__folhaDebug) console.log('📄 Clicou na página anterior');
                this.irParaPagina(this.paginaAtual - 1);
            });
        }
        
        if (btnProxima) {
            btnProxima.addEventListener('click', () => {
                if (window.__folhaDebug) console.log('📄 Clicou na próxima página');
                this.irParaPagina(this.paginaAtual + 1);
            });
        }
        
        if (btnUltima) {
            btnUltima.addEventListener('click', () => {
                if (window.__folhaDebug) console.log('📄 Clicou na última página');
                this.irParaPagina(this.totalPaginas);
            });
        }
        
        // Seletor de itens por página
        if (itensSelect) {
            itensSelect.addEventListener('change', (e) => {
                if (window.__folhaDebug) console.log('📄 Mudou itens por página:', e.target.value);
                this.itensPorPagina = parseInt(e.target.value);
                
                // ✅ Recalcular total de páginas com o novo limite
                this.totalPaginas = Math.ceil(this.totalItens / this.itensPorPagina);
                if (this.totalPaginas === 0 && this.totalItens > 0) this.totalPaginas = 1;
                
                this.paginaAtual = 1;
                this.atualizarPaginacao();
            });
        }
        
        if (window.__folhaDebug) console.log('✅ Eventos de paginação configurados');
    }
    
    /**
     * 📊 CONFIGURAR PAGINAÇÃO COM DADOS
     */
    configurarPaginacao(dados) {
        const base = Array.isArray(dados) ? dados.slice() : [];
        if (window.FolhaUtils && typeof window.FolhaUtils.aplicarOrdenacaoTabelaFolhas === 'function') {
            this.dadosFiltrados = window.FolhaUtils.aplicarOrdenacaoTabelaFolhas(base);
        } else {
            this.dadosFiltrados = base;
        }
        this.totalItens = this.dadosFiltrados.length;
        this.totalPaginas = Math.ceil(this.totalItens / this.itensPorPagina);
        this.paginaAtual = Math.min(this.paginaAtual, this.totalPaginas);
        
        if (this.totalPaginas === 0) this.paginaAtual = 1;
        
        this.atualizarControlesPaginacao();
        this.atualizarInfoPaginacao();
        
        if (window.__folhaDebug) console.log(`📄 Paginação configurada: ${this.totalItens} itens, ${this.totalPaginas} páginas`);
    }
    
    /**
     * 🔄 ATUALIZAR CONTROLES DE PAGINAÇÃO
     */
    atualizarControlesPaginacao() {
        const btnPrimeira = document.getElementById('btnPrimeiraPagina');
        const btnAnterior = document.getElementById('btnPaginaAnterior');
        const btnProxima = document.getElementById('btnProximaPagina');
        const btnUltima = document.getElementById('btnUltimaPagina');
        
        if (btnPrimeira) btnPrimeira.disabled = this.paginaAtual <= 1;
        if (btnAnterior) btnAnterior.disabled = this.paginaAtual <= 1;
        if (btnProxima) btnProxima.disabled = this.paginaAtual >= this.totalPaginas;
        if (btnUltima) btnUltima.disabled = this.paginaAtual >= this.totalPaginas;
    }
    
    /**
     * 📝 ATUALIZAR INFORMAÇÕES DE PAGINAÇÃO
     */
    atualizarInfoPaginacao() {
        const infoEl = document.getElementById('paginacaoInfo');
        const paginaAtualEl = document.getElementById('paginaAtualInfo');
        
        if (infoEl) {
            const inicio = (this.paginaAtual - 1) * this.itensPorPagina + 1;
            const fim = Math.min(this.paginaAtual * this.itensPorPagina, this.totalItens);
            
            if (this.totalItens === 0) {
                infoEl.textContent = 'Nenhum item encontrado';
            } else {
                infoEl.textContent = `Mostrando ${inicio} a ${fim} de ${this.totalItens} itens`;
            }
        }
        
        if (paginaAtualEl) {
            paginaAtualEl.textContent = `Página ${this.paginaAtual} de ${this.totalPaginas}`;
        }
    }
    
    /**
     * 🚀 IR PARA PÁGINA ESPECÍFICA
     */
    irParaPagina(pagina) {
        if (pagina < 1 || pagina > this.totalPaginas) return;
        
        this.paginaAtual = pagina;
        this.atualizarPaginacao();
        
        if (window.__folhaDebug) console.log(`📄 Navegando para página ${pagina}`);
    }
    
    /**
     * 🔄 ATUALIZAR PAGINAÇÃO
     */
    atualizarPaginacao() {
        this.atualizarControlesPaginacao();
        this.atualizarInfoPaginacao();
        this.renderizarPaginaAtual();
    }
    
    /**
     * 🎨 RENDERIZAR PÁGINA ATUAL
     */
    renderizarPaginaAtual() {
        const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
        const fim = inicio + this.itensPorPagina;
        // ✅ Proteção extra: filtrar itens vazios na renderização da página
        const dadosPagina = this.dadosFiltrados.slice(inicio, fim).filter(item => 
            item && typeof item === 'object' && (item.id || item.key || item.$key || item.recordId)
        );
        
        if (window.__folhaDebug) console.log(`📄 Renderizando página ${this.paginaAtual}:`, {
            inicio,
            fim,
            totalItens: this.totalItens,
            dadosPagina: dadosPagina.length,
            dadosFiltrados: this.dadosFiltrados.length
        });
        
        // Chamar função de renderização da tabela com dados da página (com reintento curto)
        const tryRender = (retries = 5) => {
            if (window.FolhaUtils && window.FolhaUtils.renderizarTabelaLancamentos) {
                if (window.__folhaDebug) console.log('✅ Chamando renderizarTabelaLancamentos com dados da página');
                // ✅ Mostrar skeleton apenas quando a tabela está vazia
                try {
                    const tbody = document.getElementById('folhasTableBody');
                    const isEmpty = !tbody || tbody.querySelectorAll('tr').length === 0;
                    if (isEmpty) {
                        window.FolhaUtils.showTablePreload && window.FolhaUtils.showTablePreload(dadosPagina.length || this.itensPorPagina || 8);
                    }
                } catch(e){}
                window.FolhaUtils.renderizarTabelaLancamentos(dadosPagina, {
                    mensagemVazia: 'Nenhuma folha encontrada nesta página',
                    source: 'paginacao',
                    skipInternalFilter: true
                });
                try { window.FolhaUtils.hideTablePreload && window.FolhaUtils.hideTablePreload(); } catch(e){}
                return;
            }
            if (retries > 0) {
                if (window.__folhaDebug) console.warn('⚠️ FolhaUtils.renderizarTabelaLancamentos indisponível, reintentando...');
                setTimeout(() => tryRender(retries - 1), 200);
            } else {
                console.error('❌ Função renderizarTabelaLancamentos não encontrada após reintentos');
                try { window.dispatchEvent(new CustomEvent('tabelaFolhasRenderizada', { detail: { rowCount: 0, source: 'paginacao' } })); } catch(e){}
                try { window.FolhaUtils && window.FolhaUtils.hideTablePreload && window.FolhaUtils.hideTablePreload(); } catch(e){}
            }
        };
        tryRender();
    }
    
    /**
     * 🔍 APLICAR FILTROS COM PAGINAÇÃO
     */
    aplicarFiltrosComPaginacao(dadosFiltrados) {
        if (window.__folhaDebug) console.log('🔍 Aplicando filtros com paginação:', {
            dadosRecebidos: ((dadosFiltrados && dadosFiltrados.length) || 0),
            tipo: typeof dadosFiltrados,
            isArray: Array.isArray(dadosFiltrados)
        });
        
        if (!Array.isArray(dadosFiltrados)) {
            console.error('❌ Dados filtrados não são um array:', dadosFiltrados);
            return;
        }
        // Sempre iniciar na primeira página ao aplicar um novo conjunto de filtros
        this.paginaAtual = 1;
        
        this.configurarPaginacao(dadosFiltrados);
        this.renderizarPaginaAtual();
        
        if (window.__folhaDebug) console.log('✅ Filtros aplicados com paginação');
    }

    /**
     * 🔄 SINCRONIZAR INFO QUANDO RENDERIZAÇÃO DIRETA FOR USADA
     * Atualiza o texto de paginação para refletir renderização completa
     */
    sincronizarInfoComRenderDireto(totalItens) {
        const infoEl = document.getElementById('paginacaoInfo');
        const paginaAtualEl = document.getElementById('paginaAtualInfo');
        const btnPrimeira = document.getElementById('btnPrimeiraPagina');
        const btnAnterior = document.getElementById('btnPaginaAnterior');
        const btnProxima = document.getElementById('btnProximaPagina');
        const btnUltima = document.getElementById('btnUltimaPagina');
        
        if (infoEl) {
            infoEl.textContent = `Mostrando todos os ${Number(totalItens||0)} itens`;
        }
        if (paginaAtualEl) {
            paginaAtualEl.textContent = 'Página 1 de 1';
        }
        // Desabilitar navegação para evitar confusão
        [btnPrimeira, btnAnterior, btnProxima, btnUltima].forEach(btn => { if (btn) btn.disabled = true; });
    }
    
    /**
     * 📊 OBTER DADOS DA PÁGINA ATUAL
     */
    obterDadosPaginaAtual() {
        const inicio = (this.paginaAtual - 1) * this.itensPorPagina;
        const fim = inicio + this.itensPorPagina;
        return this.dadosFiltrados.slice(inicio, fim);
    }
}

// ✅ EXPORTAR CLASSE
window.FolhaPaginacao = FolhaPaginacao;

// ✅ INICIALIZAÇÃO AUTOMÁTICA
document.addEventListener('DOMContentLoaded', () => {
    if (!window.folhaPaginacao) {
        window.folhaPaginacao = new FolhaPaginacao();
        if (window.__folhaDebug) console.log('✅ Sistema de paginação inicializado');
    }
});

if (window.__folhaDebug) console.log('📄 Módulo de paginação carregado');
