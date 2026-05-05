/**
 * 📊 MÓDULO: Dashboard Widgets - Componentes Visuais
 * 
 * Responsabilidades:
 * - Renderizar KPIs e cards
 * - Gráficos dinâmicos
 * - Tabelas de dados
 * - Widgets responsivos
 * 
 * ✅ ESTRUTURA MODULAR: Seguindo padrões do RomaneioTL
 * ✅ INTEGRAÇÃO: Chart.js para gráficos
 */

window.DashboardWidgets = (function() {
    'use strict';

    // ✅ CONFIGURAÇÕES
    const CHART_COLORS = {
        primary: '#3498db',
        success: '#27ae60', 
        warning: '#f39c12',
        danger: '#e74c3c',
        info: '#17a2b8',
        secondary: '#6c757d'
    };

    // ✅ ESTADO DOS WIDGETS
    let widgetState = {
        charts: new Map(),
        lastData: null
    };

    /**
     * ✅ INICIALIZAR WIDGETS
     */
    function init() {
        console.log('📊 Inicializando Dashboard Widgets...');
        
        try {
            // Configurar listeners para dados do dashboard
            document.addEventListener('dashboard:dataLoaded', handleDataUpdate);
            
            // Renderizar estrutura inicial
            renderDashboardStructure();
            
            console.log('✅ Dashboard Widgets inicializados');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao inicializar widgets:', error);
            return false;
        }
    }

    /**
     * ✅ RENDERIZAR ESTRUTURA DO DASHBOARD
     */
    function renderDashboardStructure() {
        const container = document.querySelector('.container');
        if (!container) {
            console.error('❌ Container do dashboard não encontrado');
            return;
        }

        // Inserir estrutura após o menu
        const dashboardHTML = `
            <!-- Loading Indicator -->
            <div class="dashboard-loading" style="display: none;">
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                    <span>Carregando dados...</span>
                </div>
            </div>

            <!-- Header com informações principais -->
            <div class="dashboard-header">
                <div class="header-info">
                    <h1><i class="fas fa-tachometer-alt"></i> Dashboard Sistema</h1>
                    <p class="last-update">Última atualização: <span id="lastUpdateTime">Carregando...</span></p>
                </div>
                <div class="header-actions">
                    <button class="btn-refresh" onclick="refreshDashboard()" title="Atualizar dados do dashboard">
                        <i class="fas fa-sync-alt"></i> Atualizar
                    </button>
                </div>
            </div>

            <!-- KPI Cards -->
            <div class="kpi-grid" id="kpiGrid">
                <!-- Cards serão inseridos aqui -->
            </div>

            <!-- Cotação do Dólar -->
            <div class="dollar-widget" id="dollarWidget">
                <!-- Widget do dólar será inserido aqui -->
            </div>

            <!-- Seção Financeira -->
            <div class="data-tables">
                <div class="table-container">
                    <h3><i class="fas fa-arrow-down text-danger"></i> A Receber Vencidas</h3>
                    <div id="contasReceberVencidasTable"></div>
                </div>
                <div class="table-container">
                    <h3><i class="fas fa-arrow-up text-warning"></i> A Pagar Vencidas</h3>
                    <div id="contasPagarVencidasTable"></div>
                </div>
            </div>
        `;

        // ✅ INSERÇÃO OTIMIZADA: Inserir após o menu para manter consistência
        const menu = container.querySelector('main-menu');
        if (menu) {
            menu.insertAdjacentHTML('afterend', dashboardHTML);
        } else {
            // Fallback: inserir no início do container
            container.insertAdjacentHTML('afterbegin', dashboardHTML);
        }
    }

    /**
     * ✅ MANIPULAR ATUALIZAÇÃO DE DADOS COM PERFORMANCE OTIMIZADA
     */
    function handleDataUpdate(event) {
        const data = event.detail;
        widgetState.lastData = data;
        
        // ✅ ATUALIZAÇÃO SEQUENCIAL PARA EVITAR SOBRECARGA
        try {
            updateKPICards(data);
        
            // Pequeno delay entre atualizações para melhor performance
            setTimeout(() => {
        updateDollarWidget(data.dollarRate);
                updateLastUpdateTime();
            }, 100);
            
            setTimeout(() => {
        updateCharts(data);
            }, 200);
            
            setTimeout(() => {
        updateDataTables(data);
            }, 300);
            
        } catch (error) {
            console.error('❌ Erro ao atualizar widgets:', error);
        }
    }

    /**
     * ✅ ATUALIZAR CARDS KPI PROFISSIONAIS
     */
    function updateKPICards(data) {
        const stats = calculateStatistics(data);
        
        const cardsHTML = `
            <div class="kpi-card romaneios fade-in-up">
                <div class="kpi-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="kpi-content">
                    <div class="kpi-value">${stats.romaneios.total}</div>
                    <div class="kpi-label">Total Romaneios</div>
                    <div class="kpi-detail">
                        TL: ${stats.romaneios.tl} | PCT: ${stats.romaneios.pct} | Pés: ${stats.romaneios.pes}
                    </div>
                </div>
            </div>

            <div class="kpi-card clientes fade-in-up">
                <div class="kpi-icon">
                    <i class="fas fa-users"></i>
                </div>
                <div class="kpi-content">
                    <div class="kpi-value">${stats.clients.total}</div>
                    <div class="kpi-label">Clientes Cadastrados</div>
                    <div class="kpi-detail">
                        Ativos: ${stats.clients.active}
                    </div>
                </div>
            </div>

            <div class="kpi-card funcionarios fade-in-up">
                <div class="kpi-icon">
                    <i class="fas fa-user-tie"></i>
                </div>
                <div class="kpi-content">
                    <div class="kpi-value">${stats.folha.funcionarios}</div>
                    <div class="kpi-label">Funcionários</div>
                    <div class="kpi-detail">
                        Ativos no sistema
                    </div>
                </div>
            </div>

            <div class="kpi-card preromaneios fade-in-up">
                <div class="kpi-icon">
                    <i class="fas fa-calculator"></i>
                </div>
                <div class="kpi-content">
                    <div class="kpi-value">${stats.preromaneios.total}</div>
                    <div class="kpi-label">Pré-Romaneios</div>
                    <div class="kpi-detail">
                        Gerados no sistema
                    </div>
                </div>
            </div>

            <div class="kpi-card folha-total fade-in-up">
                <div class="kpi-icon">
                    <i class="fas fa-money-check-alt"></i>
                </div>
                <div class="kpi-content">
                    <div class="kpi-value">${formatCurrency(stats.folha.totalQuinzena)}</div>
                    <div class="kpi-label">1ª Quinzena</div>
                    <div class="kpi-detail">Soma dos lançamentos (Quinzena)</div>
                </div>
            </div>

            <div class="kpi-card folha-total fade-in-up">
                <div class="kpi-icon">
                    <i class="fas fa-hand-holding-usd"></i>
                </div>
                <div class="kpi-content">
                    <div class="kpi-value">${formatCurrency(stats.folha.totalLiquido)}</div>
                    <div class="kpi-label">2ª Quinzena</div>
                    <div class="kpi-detail">Soma dos lançamentos (Líquido)</div>
                </div>
            </div>

            <div class="kpi-card contas fade-in-up">
                <div class="kpi-icon">
                    <i class="fas fa-database"></i>
                    </div>
                <div class="kpi-content">
                    <div class="kpi-value">${formatVolume(stats.volume.total)}</div>
                    <div class="kpi-label">Volume Total</div>
                    <div class="kpi-detail">Soma TL + PCT + Pés (m³)</div>
                </div>
            </div>

            <div class="kpi-card contas fade-in-up">
                <div class="kpi-icon">
                    <i class="fas fa-arrow-down"></i>
                </div>
                <div class="kpi-content">
                    <div class="kpi-value">${formatCurrency(stats.financeiro.totalPagar)}</div>
                    <div class="kpi-label">Contas a Pagar</div>
                    <div class="kpi-detail">Total em aberto</div>
                </div>
            </div>

            <div class="kpi-card contas fade-in-up">
                <div class="kpi-icon">
                    <i class="fas fa-arrow-up"></i>
                    </div>
                <div class="kpi-content">
                    <div class="kpi-value">${formatCurrency(stats.financeiro.totalReceber)}</div>
                    <div class="kpi-label">Contas a Receber</div>
                    <div class="kpi-detail">Total em aberto</div>
                </div>
            </div>
        `;
        
        const kpiGrid = document.getElementById('kpiGrid');
        if (kpiGrid) {
            kpiGrid.innerHTML = cardsHTML;
        }
    }

    /**
     * ✅ ATUALIZAR WIDGET DO DÓLAR
     */
    function updateDollarWidget(dollarRate) {
        if (!dollarRate) return;
        
        const variation = dollarRate.variation || 0;
        const variationClass = variation >= 0 ? 'positive' : 'negative';
        const variationIcon = variation >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        
        const widgetHTML = `
            <div class="dollar-card ${variationClass}">
                <div class="dollar-header">
                    <i class="fas fa-dollar-sign"></i>
                    <h3>Cotação USD/BRL</h3>
                    <span class="live-badge">
                        <i class="fas fa-circle"></i> AO VIVO
                    </span>
                </div>
                <div class="dollar-content">
                    <div class="dollar-rate">
                        R$ ${dollarRate.value.toFixed(4)}
                    </div>
                    <div class="dollar-variation ${variationClass}">
                        <i class="fas ${variationIcon}"></i>
                        ${variation.toFixed(2)}%
                    </div>
                </div>
                <div class="dollar-details">
                    <div class="rate-info">
                        <span>Alta: R$ ${dollarRate.high?.toFixed(4) || 'N/A'}</span>
                        <span>Baixa: R$ ${dollarRate.low?.toFixed(4) || 'N/A'}</span>
                    </div>
                    <div class="update-time">
                        Atualizado: ${formatTime(dollarRate.timestamp)}
                    </div>
                </div>
            </div>
        `;
        
        const dollarWidget = document.getElementById('dollarWidget');
        if (dollarWidget) {
            dollarWidget.innerHTML = widgetHTML;
        }
    }

    /**
     * ✅ ATUALIZAR GRÁFICOS
     */
    function updateCharts(data) {
        updateRomaneiosChart(data);
        updateEvolutionChart(data);
    }

    /**
     * ✅ GRÁFICO DE ROMANEIOS POR TIPO
     */
    function updateRomaneiosChart(data) {
        const ctx = document.getElementById('romaneiosChart');
        if (!ctx) return;
        
        // Destruir gráfico existente
        if (widgetState.charts.has('romaneios')) {
            widgetState.charts.get('romaneios').destroy();
        }
        
        const chartData = {
            labels: ['TL', 'PCT', 'Tora'],
            datasets: [{
                label: 'Romaneios por Tipo',
                data: [
                    data.romaneios.tl.length,
                    data.romaneios.pct.length,
                    data.romaneios.tora.length
                ],
                backgroundColor: [
                    CHART_COLORS.primary,
                    CHART_COLORS.success,
                    CHART_COLORS.warning
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
        
        widgetState.charts.set('romaneios', chart);
    }

    /**
     * ✅ GRÁFICO DE EVOLUÇÃO MENSAL
     */
    function updateEvolutionChart(data) {
        const ctx = document.getElementById('evolutionChart');
        if (!ctx) return;
        
        // Destruir gráfico existente
        if (widgetState.charts.has('evolution')) {
            widgetState.charts.get('evolution').destroy();
        }
        
        // Calcular dados mensais
        const monthlyData = calculateMonthlyEvolution(data);
        
        const chartData = {
            labels: monthlyData.months,
            datasets: [
                {
                    label: 'TL',
                    data: monthlyData.tl,
                    borderColor: CHART_COLORS.primary,
                    backgroundColor: CHART_COLORS.primary + '20',
                    tension: 0.4
                },
                {
                    label: 'PCT',
                    data: monthlyData.pct,
                    borderColor: CHART_COLORS.success,
                    backgroundColor: CHART_COLORS.success + '20',
                    tension: 0.4
                },
                {
                    label: 'Tora',
                    data: monthlyData.tora,
                    borderColor: CHART_COLORS.warning,
                    backgroundColor: CHART_COLORS.warning + '20',
                    tension: 0.4
                }
            ]
        };
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
        
        widgetState.charts.set('evolution', chart);
    }

    /**
     * ✅ ATUALIZAR TABELAS DE DADOS
     */
    function updateDataTables(data) {
        updateOverdueTables(data);
    }

    /**
     * ✅ TABELA DE ROMANEIOS RECENTES
     */
    // ✅ ESTADO DA PAGINAÇÃO
    const paginationState = {
        contasReceber: {
            currentPage: 1,
            itemsPerPage: 10,
            totalItems: 0
        },
        contasPagar: {
            currentPage: 1,
            itemsPerPage: 10,
            totalItems: 0
        }
    };

    function updateOverdueTables(data) {
        console.log('🔄 Atualizando tabelas de contas vencidas...');
        
        const receber = Array.isArray(data.contasReceber) ? data.contasReceber : [];
        const receberVencidas = receber
            .filter(c => isContaOrigemValida(c, 'receber'))
            .map(c => normalizeContaFinanceiro(c))
            .filter(c => {
                const venc = getContaVencimentoValue(c);
                return isOverdue(venc) && c.valorRestante > 0;
            });
        receberVencidas.sort((a,b) => {
            const ta = normalizeDateToTimestamp(getContaVencimentoValue(a)) || 0;
            const tb = normalizeDateToTimestamp(getContaVencimentoValue(b)) || 0;
            return ta - tb;
        });

        const pagar = Array.isArray(data.contasPagar) ? data.contasPagar : [];
        const pagarVencidas = pagar
            .filter(c => isContaOrigemValida(c, 'pagar'))
            .map(c => normalizeContaFinanceiro(c))
            .filter(c => {
                const venc = getContaVencimentoValue(c);
                return isOverdue(venc) && c.valorRestante > 0;
            });
        pagarVencidas.sort((a,b) => {
            const ta = normalizeDateToTimestamp(getContaVencimentoValue(a)) || 0;
            const tb = normalizeDateToTimestamp(getContaVencimentoValue(b)) || 0;
            return ta - tb;
        });

        // ✅ SALVAR NO CACHE PARA PAGINAÇÃO
        cachedOverdueData.contasReceber = receberVencidas;
        cachedOverdueData.contasPagar = pagarVencidas;
        
        console.log(`💾 Dados salvos no cache: ${receberVencidas.length} a receber, ${pagarVencidas.length} a pagar`);

        // Atualizar totais
        paginationState.contasReceber.totalItems = receberVencidas.length;
        paginationState.contasPagar.totalItems = pagarVencidas.length;

        // ✅ RESETAR PÁGINAS PARA 1 QUANDO DADOS MUDAM
        paginationState.contasReceber.currentPage = 1;
        paginationState.contasPagar.currentPage = 1;

        // Renderizar tabelas com paginação
        renderPaginatedTable('contasReceberVencidasTable', receberVencidas, 'contasReceber', 'Contas a Receber');
        renderPaginatedTable('contasPagarVencidasTable', pagarVencidas, 'contasPagar', 'Contas a Pagar');
        
        console.log('✅ Tabelas de contas vencidas atualizadas com paginação');
    }

    function renderPaginatedTable(containerId, allItems, tableType, tableTitle) {
        console.log(`🎨 Renderizando tabela paginada: ${tableType}, página ${paginationState[tableType].currentPage}`);
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`❌ Container não encontrado: ${containerId}`);
            return;
        }

        const state = paginationState[tableType];
        const startIndex = (state.currentPage - 1) * state.itemsPerPage;
        const endIndex = startIndex + state.itemsPerPage;
        const currentItems = allItems.slice(startIndex, endIndex);
        const totalPages = Math.ceil(allItems.length / state.itemsPerPage);
        
        console.log(`📊 Paginação: ${startIndex + 1}-${Math.min(endIndex, allItems.length)} de ${allItems.length} itens, página ${state.currentPage}/${totalPages}`);

        let html = `
            <div class="paginated-table-container">
            <table class="data-table">
                <thead>
                    <tr>
                            <th>Descrição</th>
                            <th>Valor</th>
                            <th>Vencimento</th>
                            <th>Status</th>
                    </tr>
                </thead>
                    <tbody>`;

        if (currentItems.length === 0) {
            html += `<tr><td colspan="4" class="no-data">Nenhum título vencido</td></tr>`;
        } else {
            currentItems.forEach(item => {
                const venc = getContaVencimentoValue(item);
                html += `
                <tr class="overdue-table-row">
                    <td>${item.descricao || item.titulo || '—'}</td>
                    <td>${formatCurrency(parseMoney(item.valorRestante))}</td>
                    <td>${formatDate(venc)}</td>
                    <td class="status-vencido">VENCIDO</td>
                </tr>`;
            });
        }

        html += `</tbody></table>`;

        html += `
                <div class="pagination-controls">
                    <div class="pagination-info">
                        <span>Total: ${allItems.length} itens</span>
                        <span style="margin-left:10px;">Página ${state.currentPage} de ${Math.max(1, totalPages)}</span>
                    </div>`;

        if (totalPages > 1) {
            html += `
                    <div class="pagination-buttons">
                        <button class="pagination-btn" ${state.currentPage === 1 ? 'disabled' : ''} 
                                onclick="changePage('${tableType}', ${state.currentPage - 1}); return false;">
                            <i class="fas fa-chevron-left"></i> Anterior
                        </button>
                        <button class="pagination-btn" ${state.currentPage === totalPages ? 'disabled' : ''} 
                                onclick="changePage('${tableType}', ${state.currentPage + 1}); return false;">
                            Próxima <i class="fas fa-chevron-right"></i>
                        </button>
                    </div>`;
        }

        html += `
                </div>`;

        html += `</div>`;
        container.innerHTML = html;
    }

    // ✅ CACHE DOS DADOS PARA PAGINAÇÃO
    let cachedOverdueData = {
        contasReceber: [],
        contasPagar: []
    };

    // ✅ FUNÇÃO GLOBAL PARA MUDANÇA DE PÁGINA
    window.changePage = function(tableType, newPage) {
        console.log(`📄 Mudando página: ${tableType}, página ${newPage}`);
        
        const state = paginationState[tableType];
        if (!state) {
            console.error(`❌ Estado não encontrado para tipo: ${tableType}`);
            return;
        }
        
        const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);
        
        console.log(`📊 Estado atual: página ${state.currentPage}, total ${totalPages}, itens ${state.totalItems}`);
        
        const safeTotalPages = Math.max(1, totalPages);
        if (newPage >= 1 && newPage <= safeTotalPages) {
            state.currentPage = newPage;
            console.log(`✅ Página alterada para: ${newPage}`);
            
            // Renderizar com dados em cache
            if (tableType === 'contasReceber') {
                console.log(`🔄 Renderizando contas a receber, ${cachedOverdueData.contasReceber.length} itens`);
                renderPaginatedTable('contasReceberVencidasTable', cachedOverdueData.contasReceber, 'contasReceber', 'Contas a Receber');
            } else if (tableType === 'contasPagar') {
                console.log(`🔄 Renderizando contas a pagar, ${cachedOverdueData.contasPagar.length} itens`);
                renderPaginatedTable('contasPagarVencidasTable', cachedOverdueData.contasPagar, 'contasPagar', 'Contas a Pagar');
            }
        } else {
            console.warn(`❌ Página inválida: ${newPage}. Deve estar entre 1 e ${safeTotalPages}`);
        }
    };
    
    // ✅ TESTE PARA VERIFICAR SE A FUNÇÃO FOI DEFINIDA
    console.log('✅ Função changePage definida:', typeof window.changePage === 'function');

    /**
     * ✅ TABELA DE CLIENTES ATIVOS
     */
    function updateActiveClientsTable(data) {
        const activeClients = data.clients
            .filter(client => client.status !== 'inactive')
            .slice(0, 5);
        
        let tableHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Cidade</th>
                        <th>Estado</th>
                        <th>Telefone</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        activeClients.forEach(client => {
            tableHTML += `
                <tr>
                    <td>${client.nome || client.name || 'Nome não informado'}</td>
                    <td>${client.cidade || client.city || 'N/A'}</td>
                    <td>${client.estado || client.state || 'N/A'}</td>
                    <td>${client.telefone || client.phone || 'N/A'}</td>
                </tr>
            `;
        });
        
        if (activeClients.length === 0) {
            tableHTML += `
                <tr>
                    <td colspan="4" class="no-data">Nenhum cliente ativo encontrado</td>
                </tr>
            `;
        }
        
        tableHTML += `
                </tbody>
            </table>
        `;
        
        const container = document.getElementById('activeClientsTable');
        if (container) {
            container.innerHTML = tableHTML;
        }
    }

    /**
     * ✅ FUNÇÕES AUXILIARES
     */
    function calculateStatistics(data) {
        // Calcular totais da folha de pagamento
        const folhaStats = calculatePayrollTotals(data.folha.lancamentos);

        // Totais financeiros em aberto
        const pagar = Array.isArray(data.contasPagar) ? data.contasPagar : [];
        const receber = Array.isArray(data.contasReceber) ? data.contasReceber : [];
        let totalPagar = pagar.reduce((s,c) => {
            const status = String(c.status||'').toLowerCase();
            const valorOriginal = parseMoney(c.valorOriginal ?? c.valor ?? 0);
            const valorPago = parseMoney(c.valorPago ?? 0);
            const restante = (c.valorRestante != null) ? parseMoney(c.valorRestante) : Math.max(0, valorOriginal - valorPago);
            return s + ((!isContaEmAberto(status) || restante <= 0) ? 0 : restante);
        }, 0);
        let totalReceber = receber.reduce((s,c) => {
            const status = String(c.status||'').toLowerCase();
            const valorOriginal = parseMoney(c.valorOriginal ?? c.valor ?? 0);
            const valorPago = parseMoney(c.valorPago ?? 0);
            const restante = (c.valorRestante != null) ? parseMoney(c.valorRestante) : Math.max(0, valorOriginal - valorPago);
            return s + ((!isContaEmAberto(status) || restante <= 0) ? 0 : restante);
        }, 0);
        try {
            if (data.financeSnapshot && data.financeSnapshot.totals) {
                const t = data.financeSnapshot.totals;
                if (typeof t.pagarAberto === 'number') totalPagar = t.pagarAberto;
                if (typeof t.receberAberto === 'number') totalReceber = t.receberAberto;
            }
        } catch (_) {}
        
        return {
            romaneios: {
                total: (data.romaneios.tl?.length || 0) + (data.romaneios.pct?.length || 0) + (data.romaneios.pes?.length || 0),
                tl: data.romaneios.tl?.length || 0,
                pct: data.romaneios.pct?.length || 0,
                pes: data.romaneios.pes?.length || 0
            },
            clients: {
                total: data.clients.length,
                active: data.clients.filter(c => c.status !== 'inactive').length
            },
            preromaneios: {
                total: data.preromaneios ? data.preromaneios.length : 0
            },
            folha: {
                funcionarios: data.folha.funcionarios.length,
                lancamentos: data.folha.lancamentos.length,
                totalQuinzena: folhaStats.totalQuinzena,
                totalLiquido: folhaStats.totalLiquido
            },
            volume: {
                total: calculateTotalVolumeAllRomaneios(data.romaneios)
            },
            financeiro: {
                contasPagar: data.contasPagar ? data.contasPagar.length : 0,
                contasReceber: data.contasReceber ? data.contasReceber.length : 0,
                totalPagar,
                totalReceber
            }
        };
    }

    /**
     * ✅ CALCULAR TOTAIS DA FOLHA DE PAGAMENTO - BASEADO NOS LANÇAMENTOS EM ABERTO DO MÊS ATUAL
     */
    function calculatePayrollTotals(lancamentos) {
        if (!lancamentos || !Array.isArray(lancamentos)) {
            if (window.__DEBUG_MODE__ === true) console.log('⚠️ Nenhum lançamento fornecido para cálculo');
            return { totalQuinzena: 0, totalLiquido: 0 };
        }

        const debug = window.__DEBUG_MODE__ === true;
        
        const lancamentosAtivos = lancamentos.filter(lancamento => {
            const isFuncionarioAtivo = lancamento.funcionario?.ativo !== false;
            const noResumo = folhaLancamentoContaNoResumoDashboard(lancamento);
            return isFuncionarioAtivo && noResumo;
        });

        if (debug) console.log(`📊 Lançamentos ativos para resumo: ${lancamentosAtivos.length}/${lancamentos.length}`);
        
        const normalizeText = (value) => {
            try { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { return String(value || '').toLowerCase(); }
        };
        const keyOf = (l, idx) => {
            const funcionarioId = l?.funcionario?.id || l?.funcionarioId || '';
            const funcionarioNome = normalizeText(l?.funcionario?.nome || '');
            const funcKey = funcionarioId || funcionarioNome;
            const mesAno = String(l?.mesAno || '');
            const tipo = resolveTipoPagamentoDashboard(l);
            if (funcKey && mesAno) return `${String(funcKey)}|${mesAno}|${String(tipo || '')}`;
            const rid = String(l && (l.id || l.key) || '');
            return rid ? `${rid}|${idx}` : `__idx_${idx}`;
        };
        const scoreOf = (l) => {
            const desconto = parseMoney(calcularDescontosDashboard(l) || 0);
            const liq = parseMoney(calcularSalarioLiquidoDashboard(l) || 0);
            const acres = parseMoney(calcularAcrescimosDisplayDashboard(l) || 0);
            const inss = parseMoney(l && (l.calculos && (l.calculos.inss || (l.calculos.calculos && l.calculos.calculos.inss))) || 0);
            const irrf = parseMoney(l && (l.calculos && (l.calculos.irrf || (l.calculos.calculos && l.calculos.calculos.irrf))) || 0);
            let score = 0;
            if (Number.isFinite(desconto) && desconto > 0) score += 4;
            if (Number.isFinite(liq)) score += 3;
            if (Number.isFinite(acres) && acres > 0) score += 2;
            if (Number.isFinite(inss) || Number.isFinite(irrf)) score += 1;
            const status = normalizeKey(l && l.status);
            if (status && status !== 'rascunho') score += 1;
            const ts = Number(l && (l.updated || l.updatedAt || l.dataProcessamento || l.dataAtualizacao) || 0);
            if (Number.isFinite(ts)) score += Math.min(2, Math.max(0, ts / 1e15));
            return score;
        };
        const byKey = new Map();
        lancamentosAtivos.forEach((l, idx) => {
            const k = keyOf(l, idx);
            const prev = byKey.get(k);
            if (!prev) {
                byKey.set(k, l);
                return;
            }
            if (scoreOf(l) > scoreOf(prev)) byKey.set(k, l);
        });

        const totais = Array.from(byKey.values()).reduce((acc, lancamento) => {
            const salarioBase = (window.FolhaUtils && typeof window.FolhaUtils.getSalarioBaseDisplay === 'function')
                ? parseMoney(window.FolhaUtils.getSalarioBaseDisplay(lancamento))
                : getSalarioBaseDisplayDashboard(lancamento);
            const valorQuinzena = (window.FolhaUtils && typeof window.FolhaUtils.calcularValorQuinzena === 'function')
                ? parseMoney(window.FolhaUtils.calcularValorQuinzena(lancamento))
                : calcularValorQuinzenaDashboard(lancamento);
            const acrescimos = (window.FolhaUtils && typeof window.FolhaUtils.calcularAcrescimosDisplay === 'function')
                ? parseMoney(window.FolhaUtils.calcularAcrescimosDisplay(lancamento))
                : calcularAcrescimosDisplayDashboard(lancamento);
            const descontos = (window.FolhaUtils && typeof window.FolhaUtils.calcularDescontosDisplay === 'function')
                ? parseMoney(window.FolhaUtils.calcularDescontosDisplay(lancamento))
                : calcularDescontosDashboard(lancamento);
            const salarioLiquido = (window.FolhaUtils && typeof window.FolhaUtils.calcularSalarioLiquidoDisplay === 'function')
                ? parseMoney(window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento))
                : calcularSalarioLiquidoDashboard(lancamento);
            return {
                bruto: acc.bruto + Number(salarioBase || 0),
                quinzena: acc.quinzena + Number(valorQuinzena || 0),
                acrescimos: acc.acrescimos + Number(acrescimos || 0),
                descontos: acc.descontos + Number(descontos || 0),
                liquido: acc.liquido + Number(salarioLiquido || 0)
            };
        }, { bruto: 0, quinzena: 0, acrescimos: 0, descontos: 0, liquido: 0 });

        const totalQuinzena = totais.quinzena;
        const totalLiquido = totais.liquido;
        
        if (debug) console.log(`📊 TOTAIS DASHBOARD FINAIS: 1ª Quinzena = R$ ${totalQuinzena.toFixed(2)}, 2ª Quinzena = R$ ${totalLiquido.toFixed(2)}`);

        return { totalQuinzena, totalLiquido };
    }

    function folhaLancamentoContaNoResumoDashboard(lancamento) {
        if (!lancamento || typeof lancamento !== 'object') return false;
        if (window.FolhaUtils && typeof window.FolhaUtils.lancamentoContaNoResumo === 'function') {
            try {
                return !!window.FolhaUtils.lancamentoContaNoResumo(lancamento);
            } catch (_) {}
        }
        const status = normalizeKey(lancamento.status);
        if (!status) return true;
        const baixados = new Set(['quinzena_paga', 'quinzenapaga', 'mes_fechado', 'mesfechado', 'baixado', 'baixada', 'pago', 'paga']);
        return !baixados.has(status);
    }

    function isContaOrigemValida(conta, tipo) {
        const origem = String(conta && conta.origem || '').toLowerCase();
        if (tipo === 'receber') return origem === 'pedido_venda' || origem === 'manual';
        if (tipo === 'pagar') return origem === 'pedido_compra' || origem === 'manual';
        return true;
    }

    function normalizeContaFinanceiro(conta) {
        const valorOriginal = parseMoney(conta?.valorOriginal ?? conta?.valor ?? 0);
        let valorPago = parseMoney(conta?.valorPago ?? 0);
        if (Array.isArray(conta?.historicosPagamento) && conta.historicosPagamento.length > 0) {
            const somaHistoricos = conta.historicosPagamento.reduce((sum, hist) => sum + parseMoney(hist && hist.valor), 0);
            if (somaHistoricos > valorPago) valorPago = somaHistoricos;
        }
        const originalCents = Math.round(valorOriginal * 100);
        const pagoCents = Math.round(valorPago * 100);
        const restanteCents = Math.max(0, originalCents - pagoCents);
        return {
            ...conta,
            valorOriginal: originalCents / 100,
            valorPago: pagoCents / 100,
            valorRestante: restanteCents / 100
        };
    }

    /**
     * ✅ CALCULAR VALOR QUINZENA - MESMA LÓGICA DO FOLHAUTILS
     */
    function calcularValorQuinzenaDashboard(folha) {
        const tipoPag = resolveTipoPagamentoDashboard(folha);
        const isQuinzena = String(tipoPag || '').toLowerCase() === 'quinzena';
        if (!isQuinzena) return 0;

        if (folha && folha.quinzenaValorManual && Number(folha.quinzenaValorManual) > 0) {
            return parseMoney(folha.quinzenaValorManual);
        }

        const parsePercent = (raw) => {
            if (raw == null || raw === '') return NaN;
            const s = String(raw).trim().replace(/[^0-9,.-]/g,'');
            const n = s.includes(',') ? parseFloat(s.replace(/\./g,'').replace(/,/g,'.')) : parseFloat(s);
            return isNaN(n) ? NaN : n;
        };

        const getPercentualQuinzena = (f) => {
            const candidates = [f && f.percentualQuinzena, f && f.quinzenaPercentual, f && f.percentual];
            for (const c of candidates) {
                const n = parsePercent(c);
                if (!isNaN(n) && n > 0 && n <= 100) return n;
            }
            return 50;
        };

        const percentualQuinzena = getPercentualQuinzena(folha || {});

        const usarBrutoToggle = Boolean(folha && folha.usarSalarioBrutoParaQuinzena);
        if (usarBrutoToggle) {
            const base = parseMoney((folha && folha.salarioBase) || (folha && folha.calculos && folha.calculos.salarioBase) || (folha && folha.funcionario && folha.funcionario.salarioBase) || 0);
            const bonificacoes = parseMoney(
                (folha && folha.bonificacoes) || (folha && folha.calculos && folha.calculos.bonificacoes) || (folha && folha.calculos && folha.calculos.calculos && folha.calculos.calculos.bonificacoes) || 0
            );
            return (base + bonificacoes) * (percentualQuinzena / 100);
        }

        const base = parseMoney((folha && folha.salarioBase) || (folha && folha.calculos && folha.calculos.salarioBase) || (folha && folha.funcionario && folha.funcionario.salarioBase) || 0);
        return base * (percentualQuinzena / 100);
    }

    function normalizeTipoFolha(value) {
        const v = String(value || '').toLowerCase().trim();
        if (!v) return '';
        const mesAliases = new Set(['mes','mês','mensal','mensalidade','mesfechado','mes_fechado','fechado','fechada','mes-fechado','mes_completo','mes completo','mês completo']);
        const quinzenaAliases = new Set(['quinzena','quinzenal','quinzena_paga','quinzenapaga','quizenal','1qu','1ª quinzena','primeira quinzena','1 quinzena','1° quinzena']);
        if (mesAliases.has(v)) return 'mes';
        if (quinzenaAliases.has(v)) return 'quinzena';
        return v;
    }

    function resolveTipoPagamentoDashboard(folha) {
        const norm = (s) => {
            try { return String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z_]/g,''); } catch { return String(s || '').toLowerCase(); }
        };
        const tipoCands = [folha && folha.tipoPagamento, folha && folha.tipo, folha && folha.tipoFolha].map(norm);
        if (tipoCands.some(t => ['mes_fechado','mes','mensal','fechado','fechada','mes-fechado'].includes(t))) return 'mes';
        if (tipoCands.some(t => ['quinzena','quinzenal','quinzena_paga','quinzenapaga','quizenal'].includes(t))) return 'quinzena';
        const numOf = (v) => {
            if (v == null || v === '') return NaN;
            const s = String(v).trim().replace(/[^0-9,.-]/g,'');
            const n = s.includes(',') ? parseFloat(s.replace(/\./g,'').replace(/,/g,'.')) : parseFloat(s);
            return isNaN(n) ? NaN : n;
        };
        const hasQuinzenaHints = (
            (folha && folha.percentualQuinzena != null && numOf(folha.percentualQuinzena) > 0) ||
            (folha && folha.quinzenaPercentual != null && numOf(folha.quinzenaPercentual) > 0) ||
            (folha && folha.quinzenaValorManual != null && Number(folha.quinzenaValorManual) > 0)
        );
        if (hasQuinzenaHints) return 'quinzena';
        return 'mes';
    }

    /**
     * ✅ CALCULAR SALÁRIO LÍQUIDO - MESMA LÓGICA DO FOLHAUTILS
     */
    function calcularSalarioLiquidoDashboard(folha) {
        if (!folha) return 0;

        const salarioBaseProbe = parseMoney(
            folha.salarioBase ||
            (folha.calculos && folha.calculos.salarioBase) ||
            (folha.funcionario && folha.funcionario.salarioBase) ||
            0
        );
        const c = folha.calculos || {};
        const calc = (c && c.calculos) || c;
        const liquidoCandidates = [
            folha.salarioLiquido,
            folha.salarioLiquidoFinal,
            folha.valorLiquido,
            calc.salarioLiquido,
            c.salarioLiquido,
            calc.salarioLiquidoFinal,
            c.salarioLiquidoFinal,
            calc.liquido,
            c.liquido
        ];
        for (const cand of liquidoCandidates) {
            const v = parseMoney(cand);
            if (Number.isFinite(v) && !(v === 0 && salarioBaseProbe > 0)) return v;
        }

        const tipoPag = resolveTipoPagamentoDashboard(folha);
        const isQuinzena = String(tipoPag || '').toLowerCase() === 'quinzena';

        const salarioBase = parseMoney(
            folha.salarioBase ||
            (folha.calculos && folha.calculos.salarioBase) ||
            (folha.funcionario && folha.funcionario.salarioBase) ||
            0
        );

        let acrescimosRaw;
        const totalAcrescimos = parseMoney(folha.totalAcrescimos ?? calc.totalAcrescimos ?? c.totalAcrescimos);
        if (Number.isFinite(totalAcrescimos)) {
            acrescimosRaw = totalAcrescimos;
        } else {
            const horasExtras = parseMoney((calc && calc.valorHorasExtras) || (c && c.valorHorasExtras) || 0);
            const bonificacoes = parseMoney(folha.bonificacoes || (calc && calc.bonificacoes) || (c && c.bonificacoes) || 0);
            const periculosidade = parseMoney((calc && calc.valorPericulosidade) || (c && c.valorPericulosidade) || 0);
            const adicionalNoturno = parseMoney((calc && calc.valorAdicionalNoturno) || (c && c.valorAdicionalNoturno) || 0);
            const insalubridade = parseMoney((calc && calc.valorInsalubridade) || (c && c.valorInsalubridade) || 0);
            const salarioFamilia = parseMoney((calc && calc.valorSalarioFamilia) || (c && c.valorSalarioFamilia) || 0);
            const premioAssiduidade = parseMoney(folha.premioAssiduidade || (calc && calc.premioAssiduidade) || 0);
            acrescimosRaw = horasExtras + bonificacoes + periculosidade + adicionalNoturno + insalubridade + salarioFamilia + premioAssiduidade;
        }

        const descontos = parseMoney(calcularDescontosDashboard(folha) || 0);
        const quinzena = isQuinzena ? parseMoney(calcularValorQuinzenaDashboard(folha) || 0) : 0;
        return salarioBase + acrescimosRaw - descontos - quinzena;
    }

    /**
     * ✅ CALCULAR DESCONTOS - MESMA LÓGICA DO FOLHAUTILS
     */
    function calcularDescontosDashboard(folha) {
        if (!folha) return 0;

        const c = folha.calculos || {};
        const calc = c.calculos || c;

        const tipoContratoRaw = String((folha.funcionario && folha.funcionario.tipoContrato) || '').toLowerCase();
        const tipoContrato = tipoContratoRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const vinculosSemINSSAuto = new Set(['temporario','terceirizado','estagio','estagiario']);
        const isCLT = tipoContrato === 'clt' || tipoContrato.includes('clt');

        const removerCalculosAuto = !!(folha.removerCalculosAutomaticos);
        const totalDescontos = parseMoney(folha.totalDescontos ?? calc.totalDescontos ?? c.totalDescontos);
        if (!removerCalculosAuto && Number.isFinite(totalDescontos)) return totalDescontos;

        let inss = 0;
        let irrf = 0;
        const dependentes = Number(folha.quantidadeFilhos || folha.dependentes || 0);
        const salarioParaEncargos = parseMoney(folha.salarioBase || c.salarioBase || (folha.funcionario && folha.funcionario.salarioBase) || 0);

        if (salarioParaEncargos > 0 && window.FolhaCalculos && !removerCalculosAuto) {
            try {
                if (!vinculosSemINSSAuto.has(tipoContrato) && typeof window.FolhaCalculos.calcularINSS === 'function') {
                    const calculoINSS = window.FolhaCalculos.calcularINSS(salarioParaEncargos);
                    inss = parseMoney(calculoINSS && calculoINSS.valor || 0);
                }
            } catch {}
            try {
                if (!vinculosSemINSSAuto.has(tipoContrato) && typeof window.FolhaCalculos.calcularIRRF === 'function') {
                    const calculoIRRF = window.FolhaCalculos.calcularIRRF(salarioParaEncargos, inss, dependentes);
                    irrf = parseMoney(calculoIRRF && calculoIRRF.valor || 0);
                }
            } catch {}
        } else {
            if (!removerCalculosAuto) {
                inss = parseMoney((calc.calculoINSS && calc.calculoINSS.valor) || (c.inss && c.inss.valor) || (folha.inss && folha.inss.valor) || calc.inss || 0);
                irrf = parseMoney((calc.calculoIRRF && calc.calculoIRRF.valor) || (c.irrf && c.irrf.valor) || (folha.irrf && folha.irrf.valor) || calc.irrf || 0);
            } else {
                inss = 0;
                irrf = 0;
            }
        }

        if (vinculosSemINSSAuto.has(tipoContrato)) {
            inss = 0;
            irrf = 0;
        }

        const vales = parseMoney(folha.vales || c.vales || calc.vales || 0);
        const outrosDescontos = parseMoney(folha.outrosDescontos || c.outrosDescontos || calc.outrosDescontos || 0);

        let descontoFaltas = 0;
        const salarioBaseParaFaltas = parseMoney(folha.salarioBase || c.salarioBase || (folha.funcionario && folha.funcionario.salarioBase) || 0);
        const diasDeclarados = parseMoney(folha.faltas || c.faltas || 0);
        let diasCalculados = diasDeclarados;
        if (!diasDeclarados && Number.isFinite(folha.diasTrabalhados)) {
            const diasMensaisPadrao = 30;
            diasCalculados = Math.max(0, diasMensaisPadrao - Number(folha.diasTrabalhados || 0));
        }
        if (salarioBaseParaFaltas > 0 && diasCalculados > 0 && window.FolhaCalculos && typeof window.FolhaCalculos.calcularDescontoFaltas === 'function') {
            descontoFaltas = parseMoney(window.FolhaCalculos.calcularDescontoFaltas(salarioBaseParaFaltas, diasCalculados) || 0);
        } else {
            descontoFaltas = 0;
        }

        let descontoRepouso = parseMoney(folha.descontoRepousoRemunerado || calc.descontoRepousoRemunerado || c.descontoRepousoRemunerado || 0);
        const descontoINSSManual = parseMoney(folha.descontoINSSManual || calc.descontoINSSManual || c.descontoINSSManual || 0);
        const inssFinal = descontoINSSManual > 0 ? descontoINSSManual : inss;
        let contribuicaoConfederativa = parseMoney(folha.contribuicaoConfederativa || calc.contribuicaoConfederativa || c.contribuicaoConfederativa || 0);
        let contribuicaoSindical = parseMoney(folha.contribuicaoSindical || calc.contribuicaoSindical || c.contribuicaoSindical || 0);
        let descontoIRPJ = parseMoney(folha.descontoIRPJ || calc.descontoIRPJ || c.descontoIRPJ || 0);
        let emprestimoConsignado = parseMoney(folha.emprestimoConsignado || calc.emprestimoConsignado || c.emprestimoConsignado || 0);

        if (!isCLT) {
            descontoRepouso = 0;
            contribuicaoConfederativa = 0;
            contribuicaoSindical = 0;
            descontoIRPJ = 0;
            emprestimoConsignado = 0;
        }

        const total = inssFinal + irrf + vales + outrosDescontos + descontoFaltas + descontoRepouso + contribuicaoConfederativa + contribuicaoSindical + descontoIRPJ + emprestimoConsignado;
        return Number.isFinite(total) ? total : 0;
    }

    /**
     * ✅ CALCULAR SALÁRIO BASE DISPLAY - MESMA LÓGICA DO FOLHAUTILS (COM TOGGLE)
     */
    function getSalarioBaseDisplayDashboard(folha) {
        if (!folha) return 0;
        const c = folha.calculos || {};
        const base = parseMoney(folha.salarioBase || c.salarioBase || folha.valores?.base || folha.funcionario?.salarioBase || 0);
        const tipo = resolveTipoPagamentoDashboard(folha);
        
        // ✅ REGRA CRÍTICA: Quando o toggle estiver ativo PARA QUINZENA, exibir Base + Bonificações (apenas display)
        if (Boolean(folha.usarSalarioBrutoParaQuinzena) && tipo === 'quinzena') {
            const bonificacoes = parseMoney(
                folha.bonificacoes ?? c.bonificacoes ?? c.calculos?.bonificacoes ?? 0
            );
            return base + bonificacoes;
        }
        return base;
    }

    /**
     * ✅ CALCULAR ACRÉSCIMOS DISPLAY - MESMA LÓGICA DO FOLHAUTILS (COM TOGGLE)
     */
    function calcularAcrescimosDisplayDashboard(folha) {
        if (!folha) return 0;

        const c = folha.calculos || {};
        const calc = c.calculos || c;

        const totalAcrescimos = parseMoney(folha.totalAcrescimos ?? calc.totalAcrescimos ?? c.totalAcrescimos);
        if (Number.isFinite(totalAcrescimos)) return totalAcrescimos;

        const tipo = resolveTipoPagamentoDashboard(folha);
        const usarBrutoParaQuinzena = Boolean(folha.usarSalarioBrutoParaQuinzena) && tipo === 'quinzena';

        // Acréscimos comuns
        const horasExtras = parseMoney(calc.valorHorasExtras || c.valorHorasExtras || 0);
        const periculosidade = parseMoney(calc.valorPericulosidade || c.valorPericulosidade || 0);
        const adicionalNoturno = parseMoney(calc.valorAdicionalNoturno || c.valorAdicionalNoturno || 0);
        const insalubridade = parseMoney(calc.valorInsalubridade || c.valorInsalubridade || 0);
        const salarioFamilia = parseMoney(calc.valorSalarioFamilia || c.valorSalarioFamilia || 0);

        // ✅ REGRA CRÍTICA: Bonificações no display - quando toggle ativo para quinzena,
        // a coluna "Salário Base" já exibe Base + Bonificações. Para não duplicar,
        // removemos bonificações do total de acréscimos exibido.
        const bonificacoesRaw = parseMoney(folha.bonificacoes || calc.bonificacoes || c.bonificacoes || 0);
        const bonificacoesParaDisplay = usarBrutoParaQuinzena ? 0 : bonificacoesRaw;

        const premioAssiduidade = parseMoney(folha.premioAssiduidade || calc.premioAssiduidade || 0);
        const totalDisplay = horasExtras + bonificacoesParaDisplay + periculosidade + adicionalNoturno + insalubridade + salarioFamilia + premioAssiduidade;

        return totalDisplay;
    }

    // ✅ EXPOR FUNÇÕES GLOBALMENTE PARA DEBUG
    window.calcularValorQuinzenaDashboard = calcularValorQuinzenaDashboard;
    window.calcularSalarioLiquidoDashboard = calcularSalarioLiquidoDashboard;
    window.calcularDescontosDashboard = calcularDescontosDashboard;
    window.getSalarioBaseDisplayDashboard = getSalarioBaseDisplayDashboard;
    window.calcularAcrescimosDisplayDashboard = calcularAcrescimosDisplayDashboard;

    function calculateTotalVolumeAllRomaneios(romaneios) {
        let total = 0;
        const tl = Array.isArray(romaneios.tl) ? romaneios.tl : [];
        const pct = Array.isArray(romaneios.pct) ? romaneios.pct : [];
        const pes = Array.isArray(romaneios.pes) ? romaneios.pes : [];
        
        [...tl, ...pct, ...pes].forEach(romaneio => {
            const items = romaneio.items || romaneio.itens || [];
            total += calculateTotalVolume(items);
        });
        
        return total;
    }

    function calculateTotalVolume(items) {
        return items.reduce((total, item) => {
            const volume = parseFloat(item.volume) || 0;
            const quantidade = parseInt(item.quantidade) || 1;
            return total + (volume * quantidade);
        }, 0);
    }

    function formatVolume(value) {
        const num = Number(value || 0);
        return `${num.toFixed(3)} m³`;
    }

    function calculateMonthlyEvolution(data) {
        const months = [];
        const tl = [];
        const pct = [];
        const tora = [];
        
        // Últimos 6 meses
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.push(date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }));
            
            tl.push(countRomaneiosByMonth(data.romaneios.tl, monthKey));
            pct.push(countRomaneiosByMonth(data.romaneios.pct, monthKey));
            tora.push(countRomaneiosByMonth(data.romaneios.tora, monthKey));
        }
        
        return { months, tl, pct, tora };
    }

    function countRomaneiosByMonth(romaneios, monthKey) {
        return romaneios.filter(romaneio => {
            const date = new Date(romaneio.timestamp || romaneio.data || 0);
            const romaneioMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            return romaneioMonth === monthKey;
        }).length;
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value || 0);
    }

    function formatDate(dateValue) {
        if (!dateValue) return 'N/A';
        const ts = normalizeDateToTimestamp(dateValue);
        if (ts == null) return 'N/A';
        const date = new Date(ts);
        return date.toLocaleDateString('pt-BR');
    }

    function isOverdue(dateValue) {
        const ts = normalizeDateToTimestamp(dateValue);
        if (ts == null) return false;
        const d = new Date(ts);
        const today = new Date();
        d.setHours(0,0,0,0);
        today.setHours(0,0,0,0);
        return d.getTime() < today.getTime();
    }

    function getContaVencimentoValue(conta) {
        if (!conta) return null;
        return conta.dataVencimento ?? conta.vencimento ?? null;
    }

    function isContaEmAberto(statusRaw) {
        const s = normalizeKey(statusRaw);
        if (!s) return true;
        const closed = new Set([
            'pago',
            'recebido',
            'cancelado',
            'cancelada',
            'cancelled',
            'canceled',
            'estornado',
            'estornada'
        ]);
        if (closed.has(s)) return false;
        const open = new Set(['pendente', 'parcial', 'aberto', 'emaberto', 'em_aberto']);
        if (open.has(s)) return true;
        return true;
    }

    function normalizeKey(value) {
        try {
            const normalizedStatus = normalizeStatusValue(value);
            return String(normalizedStatus || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9_]/g, '');
        } catch {
            return String(value || '').toLowerCase().trim();
        }
    }

    function normalizeStatusValue(value) {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
            if (value.value) return value.value;
            if (value.status) return value.status;
            if (value.estado) return value.estado;
            if (value.tipo) return value.tipo;
            const s = value.toString && value.toString();
            if (s && s !== '[object Object]') return s;
            return '';
        }
        return String(value);
    }

    function parseMoney(value) {
        if (value == null || value === '') return 0;
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

        const s = String(value).trim();
        if (!s) return 0;

        const cleaned = s.replace(/[^0-9,.-]/g, '');
        if (!cleaned) return 0;

        const hasComma = cleaned.includes(',');
        const hasDot = cleaned.includes('.');
        let normalized = cleaned;

        if (hasComma && hasDot) {
            if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
                normalized = cleaned.replace(/\./g, '').replace(',', '.');
            } else {
                normalized = cleaned.replace(/,/g, '');
            }
        } else if (hasComma && !hasDot) {
            normalized = cleaned.replace(/\./g, '').replace(',', '.');
        } else {
            normalized = cleaned;
        }

        const n = Number(normalized);
        return Number.isFinite(n) ? n : 0;
    }

    function normalizeDateToTimestamp(value) {
        if (value == null || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;

        const v = String(value).trim();
        if (!v) return null;

        if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
            const [y, m, d] = v.split('-').map(Number);
            const t = new Date(y, m - 1, d).getTime();
            return isNaN(t) ? null : t;
        }
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
            const [d, m, y] = v.split('/').map(Number);
            const t = new Date(y, m - 1, d).getTime();
            return isNaN(t) ? null : t;
        }

        const t = new Date(v).getTime();
        return isNaN(t) ? null : t;
    }

    function formatTime(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function updateLastUpdateTime() {
        const element = document.getElementById('lastUpdateTime');
        if (element) {
            element.textContent = new Date().toLocaleString('pt-BR');
        }

        try {
            const params = new URLSearchParams(window.location.search || '');
            const badgeText = (params.get('previewEmployees') === 'true' || params.get('purgeFinance') === 'true' || params.get('purgeFolhas') === 'true')
                ? 'Dados Reais'
                : 'Amostras desativadas';
            const badgeColor = (badgeText === 'Dados Reais') ? '#28a745' : '#6c757d';
            let badge = document.getElementById('dataSourceBadge');
            if (!badge) {
                badge = document.createElement('span');
                badge.id = 'dataSourceBadge';
                badge.style.cssText = 'margin-left:10px; padding:2px 8px; border-radius:12px; font-size:11px; color:#fff; background:'+badgeColor+';';
                if (element && element.parentElement) {
                    element.parentElement.appendChild(badge);
                }
            }
            badge.textContent = badgeText;
            badge.style.background = badgeColor;
        } catch (e) { /* noop */ }
    }

    // ✅ FUNÇÃO GLOBAL PARA REFRESH MANUAL
    window.refreshDashboard = function() {
        if (window.DashboardCore && window.DashboardCore.refresh) {
            const btn = document.querySelector('.btn-refresh');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
                
                window.DashboardCore.refresh().finally(() => {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
                });
            } else {
                window.DashboardCore.refresh();
            }
        }
    };

    // ✅ INTERFACE PÚBLICA
    return {
        init,
        updateKPICards,
        updateDollarWidget,
        updateCharts,
        updateDataTables
    };

})();

console.log('✅ Módulo Dashboard Widgets carregado com sucesso');
