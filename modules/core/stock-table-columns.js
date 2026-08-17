/**
 * Módulo de Redimensionamento, Persistência e Padronização Visual de Tabelas de Estoque
 * Sisweb - Padrão Canônico de Interface
 */
(function(window, document) {
    'use strict';

    var STORAGE_PREFIX = 'sisweb_stock_cols_';

    function injectStyles() {
        if (document.getElementById('stock-table-columns-styles')) return;
        var style = document.createElement('style');
        style.id = 'stock-table-columns-styles';
        style.textContent = `
            /* === ESTILOS CANÔNICOS DE TABELAS DE ESTOQUE === */
            .table-responsive {
                scrollbar-gutter: stable !important;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #ffffff;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
            }

            .table thead th {
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%) !important;
                color: #ffffff !important;
                font-size: 13px !important;
                font-weight: 600 !important;
                padding: 10px 12px !important;
                border-bottom: 2px solid #1a252f !important;
                position: sticky !important;
                top: 0 !important;
                z-index: 10 !important;
                user-select: none;
                white-space: nowrap;
            }

            .table thead th .sort-icon {
                margin-left: 6px;
                opacity: 0.7;
                font-size: 11px;
            }

            .table tbody tr:hover td {
                background-color: #f1f7fd !important;
            }

            .table tbody td {
                vertical-align: middle !important;
                padding: 6px 10px !important;
                border-bottom: 1px solid #edf2f7 !important;
                font-size: 13px !important;
                color: #2d3748 !important;
            }

            /* === BOTÕES DE AÇÃO PADRONIZADOS === */
            .stock-actions-cell {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 4px !important;
                padding: 4px !important;
            }

            .stock-btn-action {
                width: 28px !important;
                height: 28px !important;
                min-width: 28px !important;
                min-height: 28px !important;
                padding: 0 !important;
                border-radius: 4px !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                border: 1px solid transparent !important;
                cursor: pointer !important;
                transition: all 0.15s ease-in-out !important;
                font-size: 12px !important;
            }

            .stock-btn-action:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.15);
            }

            .stock-btn-edit {
                background-color: #3498db !important;
                color: #ffffff !important;
            }
            .stock-btn-edit:hover {
                background-color: #2980b9 !important;
            }

            .stock-btn-delete {
                background-color: #e74c3c !important;
                color: #ffffff !important;
            }
            .stock-btn-delete:hover {
                background-color: #c0392b !important;
            }

            .stock-btn-history {
                background-color: #6f42c1 !important;
                color: #ffffff !important;
            }
            .stock-btn-history:hover {
                background-color: #59359a !important;
            }

            .stock-btn-down {
                background-color: #e67e22 !important;
                color: #ffffff !important;
            }
            .stock-btn-down:hover {
                background-color: #d35400 !important;
            }

            /* === MANIPULADOR DE REDIMENSIONAMENTO DE COLUNA === */
            .stock-resizer {
                position: absolute;
                top: 0;
                right: 0;
                width: 6px;
                cursor: col-resize;
                user-select: none;
                height: 100%;
                z-index: 15;
            }

            .stock-resizer:hover,
            .stock-resizer.resizing {
                background-color: #3498db;
            }

            /* === CARDS MODERNOS DE RESUMO (SUMMARY) === */
            .stock-summary-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-top: 20px;
                margin-bottom: 20px;
            }

            .stock-summary-card {
                background: #ffffff;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 14px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.03);
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .stock-summary-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.06);
            }

            .stock-summary-icon {
                width: 44px;
                height: 44px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }

            .stock-summary-icon.blue { background-color: #ebf8ff; color: #3182ce; }
            .stock-summary-icon.green { background-color: #f0fff4; color: #38a169; }
            .stock-summary-icon.purple { background-color: #faf5ff; color: #805ad5; }
            .stock-summary-icon.amber { background-color: #fffaf0; color: #dd6b20; }

            .stock-summary-content {
                display: flex;
                flex-direction: column;
            }

            .stock-summary-title {
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                color: #718096;
                letter-spacing: 0.5px;
            }

            .stock-summary-value {
                font-size: 18px;
                font-weight: bold;
                color: #1a202c;
                margin-top: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    function initTableResize(table, tableKey) {
        if (!table) return;
        injectStyles();

        var cols = table.querySelectorAll('colgroup col');
        var ths = table.querySelectorAll('thead th');
        if (!ths.length) return;

        // Recuperar larguras salvas
        var savedWidths = null;
        try {
            var raw = localStorage.getItem(STORAGE_PREFIX + tableKey);
            if (raw) savedWidths = JSON.parse(raw);
        } catch (_) {}

        if (savedWidths && Array.isArray(savedWidths) && savedWidths.length === ths.length) {
            ths.forEach(function(th, index) {
                if (savedWidths[index]) {
                    th.style.width = savedWidths[index] + 'px';
                    th.style.minWidth = savedWidths[index] + 'px';
                    if (cols[index]) cols[index].style.width = savedWidths[index] + 'px';
                }
            });
        }

        // Instalar manipuladores de resize
        ths.forEach(function(th, index) {
            if (th.querySelector('.stock-resizer')) return;
            th.style.position = 'relative';

            var resizer = document.createElement('div');
            resizer.className = 'stock-resizer';
            th.appendChild(resizer);

            var startX, startWidth;

            function onMouseMove(e) {
                var width = Math.max(40, startWidth + (e.pageX - startX));
                th.style.width = width + 'px';
                th.style.minWidth = width + 'px';
                if (cols[index]) cols[index].style.width = width + 'px';
            }

            function onMouseUp() {
                resizer.classList.remove('resizing');
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                // Salvar todas as larguras atuais
                var currentWidths = [];
                ths.forEach(function(h) {
                    currentWidths.push(Math.round(h.getBoundingClientRect().width));
                });
                try {
                    localStorage.setItem(STORAGE_PREFIX + tableKey, JSON.stringify(currentWidths));
                } catch (_) {}
            }

            resizer.addEventListener('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();
                startX = e.pageX;
                startWidth = th.offsetWidth;
                resizer.classList.add('resizing');
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        });
    }

    function initAllStockTables() {
        var tables = [
            { id: 'tabelaEntrada', key: 'entrada' },
            { id: 'tabelaSaidaToras', key: 'saida' },
            { id: 'tabelaEstoque', key: 'consulta' },
            { id: 'tabelaMovimentacoes', key: 'movimentacoes' },
            { id: 'tabelaProdutos', key: 'produtos' },
            { id: 'tabelaTorasDisponiveis', key: 'modal_selecao' }
        ];

        tables.forEach(function(item) {
            var el = document.getElementById(item.id);
            if (el) {
                initTableResize(el, item.key);
            }
        });
    }

    // Exportar API global
    window.StockTableColumns = {
        init: initAllStockTables,
        initTable: initTableResize,
        resetWidths: function(tableKey) {
            try {
                localStorage.removeItem(STORAGE_PREFIX + tableKey);
                location.reload();
            } catch (_) {}
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAllStockTables);
    } else {
        initAllStockTables();
    }

})(window, document);
