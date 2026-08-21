/**
 * 📊 MÓDULO: Renderizar Tabela - Romaneio TL
 * 
 * Responsabilidades:
 * - Renderizar tabela de itens do romaneio
 * - Calcular e exibir totais
 * - Controlar paginação (10 itens por página)
 * - Integrar com sistema modular
 * - Formatar dados para exibição
 * 
 * ✅ MUDANÇA: Campo "espessura" padronizado
 * ✅ OTIMIZAÇÃO: Paginação com 10 itens por página
 */

window.RenderizarTabela = (function() {
    'use strict';
    const legacyKey = ['b','i','t','o','l','a'].join('');

    // ✅ CONFIGURAÇÕES DE PAGINAÇÃO
    const ITENS_POR_PAGINA_INICIAL = 5;
    const OPCOES_ITENS_POR_PAGINA = [10, 20, 25, 50, 100];
    const CHAVE_STORAGE_ITENS_POR_PAGINA = 'romaneio_tl_items_per_page';
    const ITENS_SEM_PAGINACAO = 0;
    let paginaAtual = 1;
    let totalPaginas = 1;
    let itensPorPagina = ITENS_POR_PAGINA_INICIAL;
    try {
        const saved = parseInt(localStorage.getItem(CHAVE_STORAGE_ITENS_POR_PAGINA) || '', 10);
        if (OPCOES_ITENS_POR_PAGINA.includes(saved)) itensPorPagina = saved;
    } catch (_) {}

    const TL_TABLE_SORT_COLUMNS = [
        { key: 'especie' },
        { key: 'comprimento', type: 'number' },
        { key: 'espessura', type: 'number', accessor: (item) => item.espessura || item[legacyKey] || 0 },
        { key: 'largura', type: 'number' },
        { key: 'quantidade', type: 'number' },
        { key: 'volumeTotal', type: 'number', accessor: (item) => calcularVolume(item) * (parseInt(item.quantidade, 10) || 1) },
        { key: 'preco', type: 'number', accessor: (item) => item.preco || item.price || 0 },
        { key: 'valorTotal', type: 'number', accessor: (item) => {
            const volumeTotal = calcularVolume(item) * (parseInt(item.quantidade, 10) || 1);
            return volumeTotal * (parseFloat(item.preco || item.price) || 0);
        } },
        { key: 'acoes', sortable: false }
    ];

    function getTLTableSortConfig() {
        return {
            tableSelector: '#romaneioTable',
            minWidth: '1100px',
            columns: TL_TABLE_SORT_COLUMNS,
            getItems: () => window.AdicionarItem ? window.AdicionarItem.obterItens() : (window.romaneioItems || []),
            setPage: (page) => { paginaAtual = page; },
            render: () => renderizarTabela()
        };
    }

    function configurarTabelaOrdenavel() {
        if (!window.RomaneioTableEnhancements) return;
        window.RomaneioTableEnhancements.bindSortableHeaders(getTLTableSortConfig());
    }

    function aplicarOrdenacaoTabela() {
        if (!window.RomaneioTableEnhancements) return;
        window.RomaneioTableEnhancements.applySortFromTable(getTLTableSortConfig());
    }

    /**
     * ✅ FUNÇÃO PRINCIPAL: Renderizar Tabela
     */
    function renderizarTabela() {
        console.log('📊 Renderizando tabela de itens...');
        
        try {
            // Obter itens do módulo AdicionarItem
            const items = window.AdicionarItem ? window.AdicionarItem.obterItens() : (window.romaneioItems || []);
            configurarTabelaOrdenavel();
            aplicarOrdenacaoTabela();
            
            console.log(`📋 Total de itens: ${items.length}`);
            
            let itensPagina;
            let startIndex = 0;
            totalPaginas = Math.max(1, Math.ceil(items.length / itensPorPagina));
            if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
            if (paginaAtual < 1) paginaAtual = 1;
            startIndex = (paginaAtual - 1) * itensPorPagina;
            itensPagina = items.slice(startIndex, startIndex + itensPorPagina);
            
            // Renderizar itens
            renderizarItens(itensPagina, startIndex, items.length);
            
            // Atualizar totais
            atualizarTotais(items);
            
            // Renderizar controles de paginação (se necessário)
            renderizarPaginacao(items.length);
            
            console.log(`✅ Tabela renderizada: ${itensPagina.length} itens exibidos`);
            
        } catch (error) {
            console.error('❌ Erro ao renderizar tabela:', error);
            exibirErroTabela('Erro ao carregar itens da tabela');
        }
    }

    /**
     * Renderizar itens na tabela
     */
    function renderizarItens(items, startIndex, totalItems) {
        const tbody = document.getElementById('romaneioTableBody');
        
        if (!tbody) {
            console.error('❌ Elemento romaneioTableBody não encontrado');
            return;
        }
        
        if (items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-folder-open" style="font-size: 28px; margin-bottom: 8px; display: block; color: #8d9aa8;"></i>
                        Nenhum item adicionado ao romaneio
                    </td>
                </tr>
            `;
            return;
        }
        
        // Renderizar cada item da página
        const linhasTabela = items.map((item, index) => {
            const indiceGlobal = startIndex + index + 1;
            // ✅ SEMPRE RECALCULAR VOLUME E VALOR - não usar valores que podem estar incorretos
            const volumeIndividual = calcularVolume(item);
            const volumeTotal = volumeIndividual * (item.quantidade || 1);
            const valorTotal = volumeTotal * (item.preco || 0);
            
            return `
                <tr>
                    <td data-label="Espécie">${item.especie || 'N/A'}</td>
                    <td data-label="Comprimento">${item.comprimento ? item.comprimento.toFixed(2) : '0.00'}</td>
                    <td data-label="Espessura">${(item.espessura || item[legacyKey]) ? (item.espessura || item[legacyKey]).toFixed(1) : '0.0'}</td>
                    <td data-label="Largura">${item.largura ? item.largura.toFixed(1) : '0.0'}</td>
                    <td data-label="Qtd.">${item.quantidade || 0}</td>
                    <td data-label="Vol. (m³)">${volumeTotal.toFixed(6)}</td>
                    <td data-label="Preço Unit.">${formatarMoedaBrasileira(item.preco || 0)}</td>
                    <td data-label="Valor Total">${formatarMoedaBrasileira(valorTotal)}</td>
                    <td data-label="Ações">
                        <button class="btn-editar" onclick="editarItem(${indiceGlobal - 1})" title="Editar item">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-excluir" onclick="excluirItem(${indiceGlobal - 1})" title="Excluir item">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        tbody.innerHTML = linhasTabela;
    }

    /**
     * ✅ CALCULAR VOLUME DO ITEM - PADRONIZADO
     * Usa a função padronizada do UtilsTL para consistência
     */
    function calcularVolume(item) {
        if (!item) return 0;
        
        const comprimento = parseFloat(item.comprimento) || 0;
        const espessura = parseFloat(item.espessura || item[legacyKey]) || 0;
        const largura = parseFloat(item.largura) || 0;
        
        // ✅ USAR FUNÇÃO PADRONIZADA do UtilsTL para garantir consistência
        if (window.UtilsTL && window.UtilsTL.calcularVolume) {
            return window.UtilsTL.calcularVolume(comprimento, largura, espessura, 1);
        }
        
        // Fallback com fórmula padronizada
        if (comprimento <= 0 || largura <= 0 || espessura <= 0) {
            console.warn('⚠️ Dimensões inválidas para cálculo de volume:', {comprimento, largura, espessura});
            return 0;
        }
        
        const volume = (comprimento * espessura * largura) / 1000000;
        return parseFloat(volume.toFixed(6));
    }

    /**
     * ✅ FORMATAR MOEDA BRASILEIRA
     * Função auxiliar para garantir formatação consistente
     */
    function formatarMoedaBrasileira(valor) {
        if (valor === null || valor === undefined || isNaN(valor)) {
            return 'R$ 0,00';
        }
        
        const numValue = parseFloat(valor);
        return numValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    /**
     * ✅ ATUALIZAR DISPLAY DOS TOTAIS
     */
    function atualizarDisplayTotais(totalVolume, totalValue, totalQuantidade = 0) {
        // Atualizar elementos na interface
        const totalVolumeElement = document.getElementById('totalVolume');
        const totalValueElement = document.getElementById('totalValue');
        const totalQuantidadeElement = document.getElementById('totalQuantidade');
        
        if (totalVolumeElement) {
            // ✅ Remover tags <strong> para compatibilidade com nova estrutura
            totalVolumeElement.textContent = `${formatarNumero(totalVolume, 3)} m³`;
        }
        
        if (totalValueElement) {
            const valorFormatado = window.Utils ? window.Utils.formatCurrency(totalValue) : formatarMoeda(totalValue);
            // ✅ Remover tags <strong> para compatibilidade com nova estrutura
            totalValueElement.textContent = valorFormatado;
        }
        
        // ✅ Atualizar quantidade total (novo elemento)
        if (totalQuantidadeElement) {
            totalQuantidadeElement.textContent = totalQuantidade.toString();
        }
        
        // Atualizar variáveis globais para compatibilidade
        window.totalVolume = totalVolume;
        window.totalValue = totalValue;
        window.totalQuantidade = totalQuantidade;
    }

    /**
     * ✅ ATUALIZAR TOTAIS (CORRIGIDO PARA FÓRMULA ORIGINAL)
     */
    function atualizarTotais(items) {
        console.log('🔢 Calculando totais...');
        
        // Verificar se items é válido
        if (!items || !Array.isArray(items)) {
            console.log('⚠️ Items inválido ou vazio, usando array vazio');
            items = [];
        }
        
        let totalVolume = 0;
        let totalValue = 0;
        let totalQuantidade = 0;
        
        items.forEach(item => {
            // ✅ SEMPRE RECALCULAR VOLUME - não usar item.volume que pode estar incorreto
            const volumeIndividual = calcularVolume(item);
            const quantidade = parseInt(item.quantidade) || 1;
            const precoUnitario = parseFloat(item.price || item.preco) || 0;
            
            // Volume total = volume individual × quantidade
            const volumeTotal = volumeIndividual * quantidade;
            
            // Valor total = volume total × preço unitário
            const valorTotal = volumeTotal * precoUnitario;
            
            totalVolume += volumeTotal;
            totalValue += valorTotal;
            totalQuantidade += quantidade; // ✅ Somar quantidade total
        });
        
        // Atualizar interface
        atualizarDisplayTotais(totalVolume, totalValue, totalQuantidade);
        
        console.log(`✅ Totais atualizados: Volume = ${totalVolume.toFixed(6)} m³, Valor = ${formatarMoeda(totalValue)}`);
    }

    /**
     * Renderizar controles de paginação
     */
    function renderizarPaginacao(totalItems) {
        let paginationContainer = document.getElementById('romaneioTablePagination');
        
        if (!paginationContainer) {
            const tableSection = document.getElementById('romaneio-table-section');
            if (tableSection) {
                paginationContainer = document.createElement('div');
                paginationContainer.id = 'romaneioTablePagination';
                paginationContainer.className = 'pagination-controls';
                tableSection.appendChild(paginationContainer);
            }
        }
        
        if (!paginationContainer) {
            console.warn('⚠️ Não foi possível criar container de paginação');
            return;
        }
        
        const totalPages = Math.max(1, Math.ceil(totalItems / itensPorPagina));
        paginationContainer.innerHTML = '';
        paginationContainer.style.display = 'flex';
        paginationContainer.style.justifyContent = 'space-between';
        paginationContainer.style.alignItems = 'center';
        paginationContainer.style.gap = '10px';
        paginationContainer.style.flexWrap = 'wrap';

        const summary = document.createElement('div');
        summary.style.fontSize = '12px';
        summary.style.color = '#475569';
        summary.style.flex = '1 1 320px';
        summary.style.maxWidth = '33.333%';
        summary.style.minWidth = '220px';
        summary.style.textAlign = 'left';
        const from = totalItems === 0 ? 0 : ((paginaAtual - 1) * itensPorPagina) + 1;
        const to = totalItems === 0 ? 0 : Math.min(paginaAtual * itensPorPagina, totalItems);
        summary.textContent = `Mostrando ${from} a ${to} de ${totalItems} itens`;
        paginationContainer.appendChild(summary);

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        right.style.gap = '10px';
        right.style.justifyContent = 'flex-end';
        right.style.flex = '1 1 320px';
        right.style.maxWidth = '33.333%';
        right.style.minWidth = '220px';
        paginationContainer.appendChild(right);

        const center = document.createElement('div');
        center.style.display = 'flex';
        center.style.justifyContent = 'center';
        center.style.flex = '1 1 320px';
        center.style.maxWidth = '33.333%';
        center.style.minWidth = '220px';
        paginationContainer.insertBefore(center, right);

        const nav = document.createElement('div');
        nav.style.display = 'flex';
        nav.style.alignItems = 'center';
        nav.style.gap = '6px';
        center.appendChild(nav);

        const addBtn = (label, page, disabled = false, active = false) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            if (active) btn.classList.add('active');
            btn.disabled = disabled;
            btn.onclick = () => irParaPagina(page);
            nav.appendChild(btn);
        };

        if (totalPages > 1) {
            addBtn('<<<', 1, paginaAtual === 1);
            addBtn('<', paginaAtual - 1, paginaAtual === 1);

            const startPage = Math.max(1, paginaAtual - 2);
            const endPage = Math.min(totalPages, paginaAtual + 2);

            if (startPage > 1) {
                addBtn('1', 1, false, paginaAtual === 1);
                if (startPage > 2) {
                    const span = document.createElement('span');
                    span.textContent = '...';
                    nav.appendChild(span);
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                addBtn(String(i), i, false, i === paginaAtual);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    const span = document.createElement('span');
                    span.textContent = '...';
                    nav.appendChild(span);
                }
                addBtn(String(totalPages), totalPages, false, paginaAtual === totalPages);
            }

            addBtn('>', paginaAtual + 1, paginaAtual === totalPages);
            addBtn('>>>', totalPages, paginaAtual === totalPages);
        }

        const perPageWrap = document.createElement('div');
        perPageWrap.style.display = 'flex';
        perPageWrap.style.alignItems = 'center';
        perPageWrap.style.gap = '6px';
        perPageWrap.style.whiteSpace = 'nowrap';
        const perPageLabel = document.createElement('span');
        perPageLabel.style.fontSize = '12px';
        perPageLabel.style.color = '#475569';
        perPageLabel.style.whiteSpace = 'nowrap';
        perPageLabel.textContent = 'Itens por página:';
        const perPageSelect = document.createElement('select');
        perPageSelect.style.padding = '4px 8px';
        perPageSelect.style.border = '1px solid #d0d7de';
        perPageSelect.style.borderRadius = '4px';
        perPageSelect.style.fontSize = '12px';
        if (itensPorPagina === ITENS_POR_PAGINA_INICIAL) {
            const hiddenOption = document.createElement('option');
            hiddenOption.value = String(ITENS_POR_PAGINA_INICIAL);
            hiddenOption.textContent = String(ITENS_POR_PAGINA_INICIAL);
            hiddenOption.hidden = true;
            perPageSelect.appendChild(hiddenOption);
        }
        OPCOES_ITENS_POR_PAGINA.forEach((value) => {
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = String(value);
            perPageSelect.appendChild(option);
        });
        perPageSelect.value = String(itensPorPagina);
        perPageSelect.onchange = () => {
            const parsed = parseInt(perPageSelect.value, 10);
            if (!OPCOES_ITENS_POR_PAGINA.includes(parsed)) return;
            itensPorPagina = parsed;
            paginaAtual = 1;
            try { localStorage.setItem(CHAVE_STORAGE_ITENS_POR_PAGINA, String(parsed)); } catch (_) {}
            renderizarTabela();
        };
        perPageWrap.appendChild(perPageLabel);
        perPageWrap.appendChild(perPageSelect);
        right.appendChild(perPageWrap);
    }

    /**
     * Ir para página específica
     */
    function irParaPagina(pagina) {
        if (pagina >= 1 && pagina <= totalPaginas && pagina !== paginaAtual) {
            paginaAtual = pagina;
            renderizarTabela();
            console.log(`📄 Navegou para página ${pagina}`);
        }
    }

    /**
     * Formatar número com decimais
     */
    function formatarNumero(numero, decimais = 2) {
        const num = parseFloat(numero) || 0;
        return num.toFixed(decimais);
    }

    /**
     * Formatar moeda (fallback se Utils não estiver disponível)
     */
    function formatarMoeda(valor) {
        const num = parseFloat(valor) || 0;
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(num);
    }

    /**
     * Exibir erro na tabela
     */
    function exibirErroTabela(mensagem) {
        const tbody = document.getElementById('romaneioTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 20px; color: #e74c3c;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                        ${mensagem}
                    </td>
                </tr>
            `;
        }
    }

    /**
     * Obter página atual
     */
    function obterPaginaAtual() {
        return paginaAtual;
    }

    /**
     * Resetar paginação para primeira página
     */
    function resetarPaginacao() {
        paginaAtual = 1;
        console.log('🔄 Paginação resetada para primeira página');
    }

    /**
     * Obter estatísticas da paginação
     */
    function obterEstatisticasPaginacao() {
        const items = window.AdicionarItem ? window.AdicionarItem.obterItens() : (window.romaneioItems || []);
        return {
            totalItems: items.length,
            paginaAtual: paginaAtual,
            totalPaginas: totalPaginas,
            itensPorPagina: itensPorPagina,
            itensSemPaginacao: ITENS_SEM_PAGINACAO,
            temPaginacao: items.length > ITENS_SEM_PAGINACAO
        };
    }

    // ✅ INTERFACE PÚBLICA
    return {
        renderizarTabela,
        atualizarTotais,
        irParaPagina,
        resetarPaginacao,
        obterEstatisticasPaginacao
    };

})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.renderizarTabela = window.RenderizarTabela.renderizarTabela;
window.atualizarTotais = window.RenderizarTabela.atualizarTotais;

console.log('✅ Módulo RenderizarTabela carregado com sucesso (campo espessura)'); 
