/**
 * DASHBOARD PRINCIPAL
 * Interface de análise e relatórios com gráficos interativos
 * 
 * @author Sistema de Excelência Firebase
 * @version 2.0.0
 * @created 2024
 */

import stateManager, { EVENT_TYPES } from '../../services/stateManager.js';
import { Calculator } from '../../utils/calculations.js';
import { formatters } from '../../utils/formatters.js';
import { UI_CONFIG, RESPONSIVE_CONFIG } from '../../constants/app-constants.js';
import logger from '../../utils/logger.js';

// =============================================================================
// CLASSE PRINCIPAL DO DASHBOARD
// =============================================================================
class Dashboard {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = null;
        this.calculator = new Calculator();
        this.charts = new Map();
        this.stats = null;
        this.filters = {
            periodo: '30',
            fornecedor: '',
            especie: ''
        };
        
        this.initialize();
    }

    /**
     * Inicializa o dashboard
     */
    initialize() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            logger.error(`Container ${this.containerId} não encontrado`, '📊 DASHBOARD');
            return;
        }

        this.render();
        this.setupEventListeners();
        this.setupStateListeners();
        this.loadData();
        
        logger.success('Dashboard inicializado', '📊 DASHBOARD');
    }

    /**
     * Renderiza estrutura do dashboard
     */
    render() {
        this.container.innerHTML = `
            <div class="dashboard-container">
                <!-- Cabeçalho com filtros -->
                <div class="dashboard-header">
                    <h2 class="dashboard-title">
                        <span class="title-icon">📊</span>
                        Dashboard Analítico
                    </h2>
                    
                    <div class="dashboard-filters">
                        <div class="filter-group">
                            <label>Período:</label>
                            <select class="form-select form-select-sm" id="filter-periodo">
                                <option value="7">Últimos 7 dias</option>
                                <option value="30" selected>Últimos 30 dias</option>
                                <option value="90">Últimos 90 dias</option>
                                <option value="365">Último ano</option>
                                <option value="all">Todo período</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label>Fornecedor:</label>
                            <select class="form-select form-select-sm" id="filter-fornecedor">
                                <option value="">Todos os fornecedores</option>
                            </select>
                        </div>
                        
                        <div class="filter-group">
                            <label>Espécie:</label>
                            <select class="form-select form-select-sm" id="filter-especie">
                                <option value="">Todas as espécies</option>
                            </select>
                        </div>
                        
                        <button class="btn btn-primary btn-sm" id="btn-apply-filters">
                            🔍 Aplicar
                        </button>
                        
                        <button class="btn btn-outline-secondary btn-sm" id="btn-export-report">
                            📊 Exportar
                        </button>
                    </div>
                </div>

                <!-- Cards de Resumo -->
                <div class="stats-cards">
                    <div class="row">
                        <div class="col-xl-3 col-md-6">
                            <div class="stat-card stat-card-primary">
                                <div class="stat-icon">📋</div>
                                <div class="stat-content">
                                    <div class="stat-value" id="stat-total-romaneios">0</div>
                                    <div class="stat-label">Total de Romaneios</div>
                                </div>
                                <div class="stat-trend" id="trend-romaneios"></div>
                            </div>
                        </div>
                        
                        <div class="col-xl-3 col-md-6">
                            <div class="stat-card stat-card-success">
                                <div class="stat-icon">📦</div>
                                <div class="stat-content">
                                    <div class="stat-value" id="stat-total-volume">0 m³</div>
                                    <div class="stat-label">Volume Total</div>
                                </div>
                                <div class="stat-trend" id="trend-volume"></div>
                            </div>
                        </div>
                        
                        <div class="col-xl-3 col-md-6">
                            <div class="stat-card stat-card-info">
                                <div class="stat-icon">💰</div>
                                <div class="stat-content">
                                    <div class="stat-value" id="stat-total-valor">R$ 0,00</div>
                                    <div class="stat-label">Valor Total</div>
                                </div>
                                <div class="stat-trend" id="trend-valor"></div>
                            </div>
                        </div>
                        
                        <div class="col-xl-3 col-md-6">
                            <div class="stat-card stat-card-warning">
                                <div class="stat-icon">📈</div>
                                <div class="stat-content">
                                    <div class="stat-value" id="stat-preco-medio">R$ 0,00/m³</div>
                                    <div class="stat-label">Preço Médio</div>
                                </div>
                                <div class="stat-trend" id="trend-preco"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Gráficos principais -->
                <div class="charts-row">
                    <div class="row">
                        <!-- Gráfico de Volume por Período -->
                        <div class="col-lg-8">
                            <div class="chart-card">
                                <div class="chart-header">
                                    <h5>Volume por Período</h5>
                                    <div class="chart-controls">
                                        <button class="btn btn-sm btn-outline-secondary" data-chart-type="line">Linha</button>
                                        <button class="btn btn-sm btn-outline-secondary active" data-chart-type="bar">Barras</button>
                                    </div>
                                </div>
                                <div class="chart-container">
                                    <canvas id="chart-volume-periodo"></canvas>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Gráfico de Espécies -->
                        <div class="col-lg-4">
                            <div class="chart-card">
                                <div class="chart-header">
                                    <h5>Distribuição por Espécie</h5>
                                </div>
                                <div class="chart-container">
                                    <canvas id="chart-especies"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Segunda linha de gráficos -->
                <div class="charts-row">
                    <div class="row">
                        <!-- Ranking de Fornecedores -->
                        <div class="col-lg-6">
                            <div class="chart-card">
                                <div class="chart-header">
                                    <h5>Top 10 Fornecedores</h5>
                                    <select class="form-select form-select-sm w-auto" id="ranking-metric">
                                        <option value="volume">Por Volume</option>
                                        <option value="valor">Por Valor</option>
                                        <option value="quantidade">Por Quantidade</option>
                                    </select>
                                </div>
                                <div class="chart-container">
                                    <canvas id="chart-fornecedores"></canvas>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Evolução de Preços -->
                        <div class="col-lg-6">
                            <div class="chart-card">
                                <div class="chart-header">
                                    <h5>Evolução de Preços</h5>
                                    <div class="price-legend">
                                        <span class="legend-item">
                                            <span class="legend-color" style="background: #007bff;"></span>
                                            Preço Médio
                                        </span>
                                    </div>
                                </div>
                                <div class="chart-container">
                                    <canvas id="chart-precos"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tabela de Análise Detalhada -->
                <div class="analysis-table">
                    <div class="table-card">
                        <div class="table-header">
                            <h5>Análise Detalhada</h5>
                            <div class="table-controls">
                                <button class="btn btn-sm btn-outline-primary" id="btn-detailed-analysis">
                                    📋 Relatório Completo
                                </button>
                            </div>
                        </div>
                        
                        <div class="table-responsive">
                            <table class="table table-striped table-hover">
                                <thead>
                                    <tr>
                                        <th>Fornecedor</th>
                                        <th>Romaneios</th>
                                        <th>Volume Total</th>
                                        <th>Valor Total</th>
                                        <th>Preço Médio</th>
                                        <th>Última Compra</th>
                                    </tr>
                                </thead>
                                <tbody id="analysis-table-body">
                                    <!-- Dados serão inseridos dinamicamente -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Loading overlay -->
                <div class="dashboard-loading" id="dashboard-loading" style="display: none;">
                    <div class="loading-spinner"></div>
                    <span>Carregando dados do dashboard...</span>
                </div>
            </div>
        `;

        this.injectStyles();
    }

    /**
     * Configura event listeners
     */
    setupEventListeners() {
        // Filtros
        document.getElementById('btn-apply-filters')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('btn-export-report')?.addEventListener('click', () => this.exportReport());
        document.getElementById('btn-detailed-analysis')?.addEventListener('click', () => this.showDetailedAnalysis());
        
        // Seletores de filtro
        ['filter-periodo', 'filter-fornecedor', 'filter-especie'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.applyFilters());
        });

        // Controles de gráfico
        document.querySelectorAll('[data-chart-type]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.target.dataset.chartType;
                this.changeChartType('volume-periodo', chartType);
                
                // Atualiza estado dos botões
                e.target.parentNode.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Métrica de ranking
        document.getElementById('ranking-metric')?.addEventListener('change', (e) => {
            this.updateFornecedoresChart(e.target.value);
        });
    }

    /**
     * Configura listeners do state manager
     */
    setupStateListeners() {
        stateManager.on(EVENT_TYPES.ROMANEIOS_UPDATED, () => {
            this.loadData();
        });

        stateManager.on(EVENT_TYPES.DATA_SYNCED, (data) => {
            if (data.collection === 'romaneios') {
                this.loadData();
            }
        });
    }

    // =========================================================================
    // CARREGAMENTO E PROCESSAMENTO DE DADOS
    // =========================================================================

    /**
     * Carrega e processa dados
     */
    async loadData() {
        try {
            this.showLoading(true);
            
            const romaneios = stateManager.getRomaneios();
            const filteredRomaneios = this.applyDataFilters(romaneios);
            
            this.stats = this.calculateStats(filteredRomaneios);
            
            this.updateStatsCards();
            this.updateCharts();
            this.updateAnalysisTable();
            this.loadFilterOptions();
            
            logger.success(`Dashboard atualizado com ${filteredRomaneios.length} romaneios`, '📊 DASHBOARD');
            
        } catch (error) {
            logger.error('Erro ao carregar dados do dashboard', '📊 DASHBOARD', error);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Aplica filtros aos dados
     */
    applyDataFilters(romaneios) {
        let filtered = [...romaneios];

        // Filtro de período
        if (this.filters.periodo && this.filters.periodo !== 'all') {
            const days = parseInt(this.filters.periodo);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            filtered = filtered.filter(romaneio => {
                const romaneioDate = new Date(romaneio.createdAt);
                return romaneioDate >= startDate;
            });
        }

        // Filtro de fornecedor
        if (this.filters.fornecedor) {
            filtered = filtered.filter(romaneio => 
                romaneio.fornecedor?.nome === this.filters.fornecedor
            );
        }

        // Filtro de espécie
        if (this.filters.especie) {
            filtered = filtered.filter(romaneio => 
                romaneio.itens?.some(item => item.especie === this.filters.especie)
            );
        }

        return filtered;
    }

    /**
     * Calcula estatísticas
     */
    calculateStats(romaneios) {
        const stats = {
            totalRomaneios: romaneios.length,
            totalVolume: 0,
            totalValor: 0,
            totalPecas: 0,
            precoMedio: 0,
            fornecedores: new Map(),
            especies: new Map(),
            volumePorPeriodo: new Map(),
            precoPorPeriodo: new Map()
        };

        romaneios.forEach(romaneio => {
            // Totais gerais
            stats.totalVolume += romaneio.totalVolume || 0;
            stats.totalValor += romaneio.totalValor || 0;
            stats.totalPecas += romaneio.totalPecas || 0;

            // Dados do fornecedor
            const fornecedorNome = romaneio.fornecedor?.nome || 'Sem fornecedor';
            if (!stats.fornecedores.has(fornecedorNome)) {
                stats.fornecedores.set(fornecedorNome, {
                    nome: fornecedorNome,
                    romaneios: 0,
                    volume: 0,
                    valor: 0,
                    ultimaCompra: null
                });
            }
            
            const fornecedorData = stats.fornecedores.get(fornecedorNome);
            fornecedorData.romaneios++;
            fornecedorData.volume += romaneio.totalVolume || 0;
            fornecedorData.valor += romaneio.totalValor || 0;
            
            const romaneioDate = new Date(romaneio.createdAt);
            if (!fornecedorData.ultimaCompra || romaneioDate > fornecedorData.ultimaCompra) {
                fornecedorData.ultimaCompra = romaneioDate;
            }

            // Dados por espécie
            if (romaneio.itens) {
                romaneio.itens.forEach(item => {
                    const especieNome = item.especie || 'Sem espécie';
                    if (!stats.especies.has(especieNome)) {
                        stats.especies.set(especieNome, {
                            nome: especieNome,
                            volume: 0,
                            valor: 0,
                            pecas: 0
                        });
                    }
                    
                    const especieData = stats.especies.get(especieNome);
                    especieData.volume += item.volume || 0;
                    especieData.valor += item.valorTotal || 0;
                    especieData.pecas += parseInt(item.pecas || 0);
                });
            }

            // Volume por período (agrupado por mês)
            const monthKey = romaneioDate.toISOString().substring(0, 7); // YYYY-MM
            if (!stats.volumePorPeriodo.has(monthKey)) {
                stats.volumePorPeriodo.set(monthKey, 0);
            }
            stats.volumePorPeriodo.set(monthKey, 
                stats.volumePorPeriodo.get(monthKey) + (romaneio.totalVolume || 0)
            );

            // Preço médio por período
            const precoMedio = romaneio.totalVolume > 0 ? 
                (romaneio.totalValor || 0) / romaneio.totalVolume : 0;
            
            if (!stats.precoPorPeriodo.has(monthKey)) {
                stats.precoPorPeriodo.set(monthKey, { soma: 0, count: 0 });
            }
            
            const precoData = stats.precoPorPeriodo.get(monthKey);
            precoData.soma += precoMedio;
            precoData.count++;
        });

        // Calcula preço médio geral
        stats.precoMedio = stats.totalVolume > 0 ? stats.totalValor / stats.totalVolume : 0;

        return stats;
    }

    // =========================================================================
    // ATUALIZAÇÃO DA INTERFACE
    // =========================================================================

    /**
     * Atualiza cards de estatísticas
     */
    updateStatsCards() {
        if (!this.stats) return;

        document.getElementById('stat-total-romaneios').textContent = this.stats.totalRomaneios;
        document.getElementById('stat-total-volume').textContent = formatters.volume(this.stats.totalVolume);
        document.getElementById('stat-total-valor').textContent = formatters.currency(this.stats.totalValor);
        document.getElementById('stat-preco-medio').textContent = formatters.currency(this.stats.precoMedio) + '/m³';

        // Aqui você pode adicionar cálculo de tendências comparando com período anterior
        // Por simplicidade, vou deixar as tendências em branco
    }

    /**
     * Atualiza todos os gráficos
     */
    updateCharts() {
        this.updateVolumeChart();
        this.updateEspeciesChart();
        this.updateFornecedoresChart();
        this.updatePrecosChart();
    }

    /**
     * Atualiza gráfico de volume por período
     */
    updateVolumeChart() {
        const ctx = document.getElementById('chart-volume-periodo');
        if (!ctx || !this.stats) return;

        // Destroi gráfico existente
        if (this.charts.has('volume-periodo')) {
            this.charts.get('volume-periodo').destroy();
        }

        // Prepara dados
        const sortedPeriods = Array.from(this.stats.volumePorPeriodo.entries())
            .sort(([a], [b]) => a.localeCompare(b));

        const labels = sortedPeriods.map(([period]) => {
            const [year, month] = period.split('-');
            return new Intl.DateTimeFormat('pt-BR', { 
                year: 'numeric', 
                month: 'short' 
            }).format(new Date(year, month - 1));
        });

        const data = sortedPeriods.map(([, volume]) => volume);

        // Cria gráfico
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Volume (m³)',
                    data: data,
                    backgroundColor: 'rgba(0, 123, 255, 0.6)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatters.volume(value);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Volume: ${formatters.volume(context.parsed.y)}`;
                            }
                        }
                    }
                }
            }
        });

        this.charts.set('volume-periodo', chart);
    }

    /**
     * Atualiza gráfico de espécies
     */
    updateEspeciesChart() {
        const ctx = document.getElementById('chart-especies');
        if (!ctx || !this.stats) return;

        if (this.charts.has('especies')) {
            this.charts.get('especies').destroy();
        }

        // Prepara dados (top 10 espécies por volume)
        const especiesArray = Array.from(this.stats.especies.values())
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 10);

        const labels = especiesArray.map(e => e.nome);
        const data = especiesArray.map(e => e.volume);
        const colors = this.generateColors(labels.length);

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed * 100) / total).toFixed(1);
                                return `${context.label}: ${formatters.volume(context.parsed)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        this.charts.set('especies', chart);
    }

    /**
     * Atualiza gráfico de fornecedores
     */
    updateFornecedoresChart(metric = 'volume') {
        const ctx = document.getElementById('chart-fornecedores');
        if (!ctx || !this.stats) return;

        if (this.charts.has('fornecedores')) {
            this.charts.get('fornecedores').destroy();
        }

        // Prepara dados (top 10 fornecedores)
        const fornecedoresArray = Array.from(this.stats.fornecedores.values())
            .sort((a, b) => b[metric] - a[metric])
            .slice(0, 10);

        const labels = fornecedoresArray.map(f => f.nome.length > 20 ? f.nome.substring(0, 20) + '...' : f.nome);
        const data = fornecedoresArray.map(f => f[metric]);

        let label, formatter;
        switch (metric) {
            case 'volume':
                label = 'Volume (m³)';
                formatter = formatters.volume;
                break;
            case 'valor':
                label = 'Valor (R$)';
                formatter = formatters.currency;
                break;
            case 'romaneios':
                label = 'Quantidade';
                formatter = (v) => v.toString();
                break;
        }

        const chart = new Chart(ctx, {
            type: 'horizontalBar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: 'rgba(40, 167, 69, 0.6)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatter(value);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${label}: ${formatter(context.parsed.x)}`;
                            }
                        }
                    }
                }
            }
        });

        this.charts.set('fornecedores', chart);
    }

    /**
     * Atualiza gráfico de preços
     */
    updatePrecosChart() {
        const ctx = document.getElementById('chart-precos');
        if (!ctx || !this.stats) return;

        if (this.charts.has('precos')) {
            this.charts.get('precos').destroy();
        }

        // Prepara dados
        const sortedPeriods = Array.from(this.stats.precoPorPeriodo.entries())
            .sort(([a], [b]) => a.localeCompare(b));

        const labels = sortedPeriods.map(([period]) => {
            const [year, month] = period.split('-');
            return new Intl.DateTimeFormat('pt-BR', { 
                year: 'numeric', 
                month: 'short' 
            }).format(new Date(year, month - 1));
        });

        const data = sortedPeriods.map(([, precoData]) => 
            precoData.count > 0 ? precoData.soma / precoData.count : 0
        );

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Preço Médio (R$/m³)',
                    data: data,
                    borderColor: 'rgba(0, 123, 255, 1)',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatters.currency(value);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Preço Médio: ${formatters.currency(context.parsed.y)}/m³`;
                            }
                        }
                    }
                }
            }
        });

        this.charts.set('precos', chart);
    }

    /**
     * Atualiza tabela de análise
     */
    updateAnalysisTable() {
        const tbody = document.getElementById('analysis-table-body');
        if (!tbody || !this.stats) return;

        const fornecedoresArray = Array.from(this.stats.fornecedores.values())
            .sort((a, b) => b.volume - a.volume);

        tbody.innerHTML = fornecedoresArray.map(fornecedor => `
            <tr>
                <td>
                    <strong>${fornecedor.nome}</strong>
                </td>
                <td class="text-center">${fornecedor.romaneios}</td>
                <td class="text-end">${formatters.volume(fornecedor.volume)}</td>
                <td class="text-end">${formatters.currency(fornecedor.valor)}</td>
                <td class="text-end">
                    ${formatters.currency(fornecedor.volume > 0 ? fornecedor.valor / fornecedor.volume : 0)}/m³
                </td>
                <td class="text-center">
                    ${fornecedor.ultimaCompra ? formatters.date(fornecedor.ultimaCompra) : 'N/A'}
                </td>
            </tr>
        `).join('');
    }

    // =========================================================================
    // MÉTODOS DE UTILIDADE
    // =========================================================================

    /**
     * Aplica filtros
     */
    applyFilters() {
        this.filters.periodo = document.getElementById('filter-periodo')?.value || '30';
        this.filters.fornecedor = document.getElementById('filter-fornecedor')?.value || '';
        this.filters.especie = document.getElementById('filter-especie')?.value || '';
        
        this.loadData();
    }

    /**
     * Carrega opções dos filtros
     */
    loadFilterOptions() {
        // Fornecedores
        const fornecedorSelect = document.getElementById('filter-fornecedor');
        if (fornecedorSelect && this.stats) {
            const fornecedores = Array.from(this.stats.fornecedores.keys()).sort();
            fornecedorSelect.innerHTML = '<option value="">Todos os fornecedores</option>' +
                fornecedores.map(nome => `<option value="${nome}">${nome}</option>`).join('');
        }

        // Espécies
        const especieSelect = document.getElementById('filter-especie');
        if (especieSelect && this.stats) {
            const especies = Array.from(this.stats.especies.keys()).sort();
            especieSelect.innerHTML = '<option value="">Todas as espécies</option>' +
                especies.map(nome => `<option value="${nome}">${nome}</option>`).join('');
        }
    }

    /**
     * Gera cores para gráficos
     */
    generateColors(count) {
        const colors = [
            '#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1',
            '#fd7e14', '#20c997', '#6c757d', '#343a40', '#f8f9fa'
        ];
        
        const result = [];
        for (let i = 0; i < count; i++) {
            result.push(colors[i % colors.length]);
        }
        
        return result;
    }

    /**
     * Muda tipo do gráfico
     */
    changeChartType(chartId, type) {
        const chart = this.charts.get(chartId);
        if (chart) {
            chart.config.type = type;
            chart.update();
        }
    }

    /**
     * Mostra/esconde loading
     */
    showLoading(show) {
        const loading = document.getElementById('dashboard-loading');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Exporta relatório
     */
    exportReport() {
        // Implementar exportação para Excel/PDF
        logger.ui('export_report_requested');
    }

    /**
     * Mostra análise detalhada
     */
    showDetailedAnalysis() {
        // Implementar modal com análise detalhada
        logger.ui('detailed_analysis_requested');
    }

    /**
     * Injeta estilos CSS
     */
    injectStyles() {
        if (document.getElementById('dashboard-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'dashboard-styles';
        styles.textContent = `
            .dashboard-container {
                padding: 20px;
                background: #f8f9fa;
                min-height: 100vh;
            }

            .dashboard-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
                padding: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .dashboard-title {
                display: flex;
                align-items: center;
                margin: 0;
                color: #2c3e50;
            }

            .title-icon {
                margin-right: 10px;
                font-size: 1.5rem;
            }

            .dashboard-filters {
                display: flex;
                align-items: center;
                gap: 15px;
                flex-wrap: wrap;
            }

            .filter-group {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .filter-group label {
                font-size: 0.85rem;
                font-weight: 600;
                color: #6c757d;
            }

            .stats-cards {
                margin-bottom: 30px;
            }

            .stat-card {
                display: flex;
                align-items: center;
                padding: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin-bottom: 20px;
                border-left: 4px solid;
            }

            .stat-card-primary { border-left-color: #007bff; }
            .stat-card-success { border-left-color: #28a745; }
            .stat-card-info { border-left-color: #17a2b8; }
            .stat-card-warning { border-left-color: #ffc107; }

            .stat-icon {
                font-size: 2.5rem;
                margin-right: 15px;
                opacity: 0.8;
            }

            .stat-content {
                flex: 1;
            }

            .stat-value {
                font-size: 1.8rem;
                font-weight: 700;
                color: #2c3e50;
                line-height: 1;
            }

            .stat-label {
                font-size: 0.9rem;
                color: #6c757d;
                margin-top: 5px;
            }

            .stat-trend {
                font-size: 0.8rem;
                color: #28a745;
                margin-left: 10px;
            }

            .charts-row {
                margin-bottom: 30px;
            }

            .chart-card {
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                margin-bottom: 20px;
                overflow: hidden;
            }

            .chart-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid #e9ecef;
                background: #f8f9fa;
            }

            .chart-header h5 {
                margin: 0;
                color: #2c3e50;
            }

            .chart-controls {
                display: flex;
                gap: 5px;
            }

            .chart-controls button.active {
                background: #007bff;
                color: white;
            }

            .chart-container {
                padding: 20px;
                height: 300px;
                position: relative;
            }

            .price-legend {
                display: flex;
                gap: 15px;
                font-size: 0.85rem;
            }

            .legend-item {
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .legend-color {
                width: 12px;
                height: 12px;
                border-radius: 2px;
            }

            .table-card {
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                overflow: hidden;
            }

            .table-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px 20px;
                border-bottom: 1px solid #e9ecef;
                background: #f8f9fa;
            }

            .table-header h5 {
                margin: 0;
                color: #2c3e50;
            }

            .dashboard-loading {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(248, 249, 250, 0.9);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            }

            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 15px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @media (max-width: 768px) {
                .dashboard-header {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 15px;
                }

                .dashboard-filters {
                    justify-content: space-between;
                }

                .filter-group {
                    min-width: 120px;
                }

                .chart-container {
                    height: 250px;
                }

                .stat-card {
                    padding: 15px;
                }

                .stat-icon {
                    font-size: 2rem;
                }

                .stat-value {
                    font-size: 1.5rem;
                }
            }
        `;

        document.head.appendChild(styles);
    }
}

// =============================================================================
// FUNÇÃO DE INICIALIZAÇÃO
// =============================================================================
function initializeDashboard(containerId = 'dashboard-container') {
    // Verifica se Chart.js está disponível
    if (typeof Chart === 'undefined') {
        logger.error('Chart.js não encontrado. Inclua a biblioteca Chart.js.', '📊 DASHBOARD');
        return null;
    }

    const dashboard = new Dashboard(containerId);
    window.dashboard = dashboard;
    
    return dashboard;
}

// =============================================================================
// EXPORTAÇÕES
// =============================================================================
export default Dashboard;
export { initializeDashboard };

// Auto-inicialização se o container existir
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('dashboard-container');
    if (container) {
        initializeDashboard();
    }
}); 