/**
 * 📊 FOLHA RELATÓRIOS - Sistema de relatórios padronizados
 * Baseado nos padrões do romaneiopct com exportações PDF e Excel
 * Implementa relatórios completos, quinzena e demonstrativos detalhados
 */

// ✅ CONFIGURAÇÕES E CONSTANTES
const RELATORIOS_CONFIG = {
    TIPOS_RELATORIO: [
        { value: 'completo', label: 'Relatório Completo', icon: 'fas fa-file-alt' },
        { value: 'quinzena', label: 'Relatório de Quinzena', icon: 'fas fa-calendar-week' },
        { value: 'mensal', label: 'Relatório Mensal', icon: 'fas fa-calendar-month' },
        { value: 'anual', label: 'Relatório Anual', icon: 'fas fa-calendar-year' },
        { value: 'individual', label: 'Demonstrativo Individual', icon: 'fas fa-user-circle' },
        { value: 'recibo_horas_extras', label: 'Recibo de Horas Extras', icon: 'fas fa-business-time' },
        { value: 'provisao_ferias', label: 'Provisão de Férias', icon: 'fas fa-umbrella-beach' },
        { value: 'provisao_rescisao_detalhada', label: 'Provisão de Rescisão Detalhada', icon: 'fas fa-file-invoice-dollar' },
        { value: 'extrato_bh', label: 'Extratos de BH', icon: 'fas fa-business-time' }
    ],
    FORMATOS_EXPORTACAO: [
        { value: 'pdf', label: 'PDF', icon: 'fas fa-file-pdf', color: '#dc3545' },
        { value: 'excel', label: 'Excel', icon: 'fas fa-file-excel', color: '#28a745' },
        { value: 'print', label: 'Imprimir', icon: 'fas fa-print', color: '#007bff' }
    ],
    EMPRESA_INFO: {
        nome: 'SINDICATO DOS TRABALHADORES NA INDÚSTRIA DE MINERAÇÃO',
        cnpj: '17.184.406/0001-78',
        endereco: 'Rua das Minas, 123 - Centro',
        cidade: 'Cidade/UF',
        telefone: '(11) 1234-5678',
        email: 'contato@sitming.org.br'
    }
};

// ✅ CLASSE PRINCIPAL DE RELATÓRIOS
class FolhaRelatorios {
    constructor() {
        this.lancamentos = [];
        this.funcionarios = [];
        this.cargos = [];
        
        this.init();
    }
    
    init() {
        console.log('📊 Inicializando sistema de relatórios...');
        this.setupEventListeners();
        this.loadData();
    }

    calcularTotalValesLancamento(lancamento) {
        if (window.FolhaUtils && typeof window.FolhaUtils.calcularTotalVales === 'function') {
            return window.FolhaUtils.calcularTotalVales(lancamento);
        }
        const detalhes = this.normalizarValesDetalhados(lancamento);
        if (detalhes.length) {
            return Math.round(detalhes.reduce((sum, item) => sum + Number(item.valor || 0), 0) * 100) / 100;
        }
        return Number((lancamento && lancamento.vales) || 0);
    }

    normalizarValesDetalhados(lancamento) {
        if (window.FolhaUtils && typeof window.FolhaUtils.normalizarValesDetalhados === 'function') {
            return window.FolhaUtils.normalizarValesDetalhados(lancamento);
        }
        if (!lancamento || typeof lancamento !== 'object') return [];
        const origem = [lancamento.valesDetalhados, lancamento.historicoVales, lancamento.valesHistorico, lancamento.detalhesVales].find(Array.isArray);
        if (!Array.isArray(origem)) return [];
        return origem.map((item, index) => ({
            id: String((item && (item.id || item.key)) || `vale_${index}`),
            data: String((item && (item.data || item.date || item.dataVale)) || '').trim(),
            valor: Number((item && (item.valor || item.value || item.total)) || 0),
            observacao: String((item && (item.observacao || item.observacoes || item.descricao || item.description)) || '').trim()
        })).filter(item => item.valor > 0 || item.data || item.observacao);
    }
    
    /**
     * 🎯 CONFIGURAR EVENT LISTENERS (CORRIGIDO - COM PROTEÇÃO CONTRA DUPLICAÇÃO)
     */
    setupEventListeners() {
        // PROTEÇÃO CONTRA DUPLICAÇÃO
        if (this._eventListenersConfigured) {
            console.log('⚠️ Event listeners de relatórios já foram configurados, pulando...');
            return;
        }
        
        console.log('🎯 Configurando event listeners de relatórios...');
        
        // Botões de relatório na interface principal - COM PROTEÇÃO
        const btnRelatorios = document.querySelectorAll('[onclick*="Relatorio"], [onclick*="relatorio"]');
        btnRelatorios.forEach(btn => {
            // Verificar se já tem listener configurado
            if (!btn._relatorioListenerConfigured) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openRelatorioModal();
                });
                btn._relatorioListenerConfigured = true;
                console.log('✅ Event listener configurado para botão de relatório');
            }
        });
        
        // Botões de impressão individual - APENAS UMA VEZ NO DOCUMENT
        if (!document._printButtonListenerConfigured) {
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.print-button, .mini-print');
                if (btn) {
                    // Preferir data-folha-id; fallback para data-id, tr[data-id] e onclick legacy
                    const onclickAttr = btn.getAttribute('onclick');
                    const onclickMatch = onclickAttr && onclickAttr.match(/'([^']+)'/);
                    const tr = btn.closest('tr');
                    const folhaId = btn.getAttribute('data-folha-id') || btn.dataset.folhaId || btn.dataset.id || btn.getAttribute('data-id') || (tr && tr.getAttribute('data-id')) || (onclickMatch && onclickMatch[1]);
                    if (folhaId) {
                        // Recibo detalhado específico do lançamento clicado
                        this.gerarReciboIndividualDetalhado(folhaId);
                    } else {
                        console.warn('⚠️ Botão de impressão sem id do lançamento');
                    }
                }
            });
            document._printButtonListenerConfigured = true;
            console.log('✅ Event listener global para botões de impressão configurado');
        }
        
        this._eventListenersConfigured = true;
        console.log('✅ Event listeners de relatórios configurados (sem duplicação)');
    }
    
    /**
     * 👥 ABRIR MODAL DE FUNCIONÁRIOS PARA RELATÓRIOS
     */
    openFuncionariosListModalForRelatorio() {
        console.log('👥 Abrindo modal de funcionários para relatórios...');
        
        // ✅ CORREÇÃO CRÍTICA: Definir targetField antes de abrir modal
        if (window.folhaFuncionarios) {
            window.folhaFuncionarios.targetField = 'funcionarioRelatorio';
            console.log('🎯 targetField definido para: funcionarioRelatorio');
            window.folhaFuncionarios.openFuncionariosListModal();
        } else {
            console.warn('⚠️ Módulo folhaFuncionarios não carregado');
            if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
                window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
            }
        }
    }

    openFuncionariosListModalForResumo() {
        console.log('👥 Abrindo modal de funcionários para resumo...');
        if (window.folhaFuncionarios) {
            window.folhaFuncionarios.targetField = 'resumoFuncionario';
            window.folhaFuncionarios.openFuncionariosListModal();
        } else {
            console.warn('⚠️ Módulo folhaFuncionarios não carregado');
            if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
                window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
            }
        }
    }
    
    /**
     * 📋 CARREGAR DADOS NECESSÁRIOS
     */
    async loadData() {
        try {
            // Obter dados dos outros módulos se disponíveis (preferir canônico do sistema)
            const canonoSistema = (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) ? window.folhaSystem.folhas : [];
            const canonoLanc = (window.folhaLancamentos && Array.isArray(window.folhaLancamentos.lancamentos)) ? window.folhaLancamentos.lancamentos : [];
            this.lancamentos = canonoSistema.length ? [...canonoSistema] : (canonoLanc.length ? [...canonoLanc] : []);
            
            if (window.folhaFuncionarios) {
                this.funcionarios = window.folhaFuncionarios.funcionarios || [];
            }
            
            if (window.folhaCargos) {
                this.cargos = window.folhaCargos.cargos || [];
            }
            
            // Tentar carregar direto do Firebase somente se ainda não houver dados
            if (this.lancamentos.length === 0) {
                try {
                    const folhasData = await getData('folhas') || {};
                    const arr = Object.entries(folhasData).map(([key, rec]) => ({
                        ...(rec || {}),
                        id: (rec && rec.id) ? rec.id : key
                    }));
                    this.lancamentos = arr.filter(f => f && f.id);
                    console.log(`📊 Lançamentos carregados do Firebase (canônico): ${this.lancamentos.length}`);
                } catch (error) {
                    console.warn('⚠️ Erro ao carregar lançamentos do Firebase:', error);
                }
            }

            // Deduplicar por ID (priorizar registros canônicos que possuem tipoPagamento/percentualQuinzena top-level)
            try {
                const byId = new Map();
                const score = (rec) => {
                    let s = 0;
                    if (rec && rec.tipoPagamento) s += 2;
                    if (rec && (rec.percentualQuinzena || rec.quinzenaPercentual)) s += 1;
                    return s;
                };
                // Mesclar: se já existir, manter o de maior score
                const pushRec = (rec) => {
                    const id = rec && rec.id;
                    if (!id) return;
                    const prev = byId.get(id);
                    if (!prev || score(rec) >= score(prev)) byId.set(id, rec);
                };
                // Preferir dataset do sistema, depois possíveis duplicatas do fallback
                (canonoSistema || []).forEach(pushRec);
                (canonoLanc || []).forEach(pushRec);
                (this.lancamentos || []).forEach(pushRec);
                this.lancamentos = Array.from(byId.values());
                console.log(`🔗 Relatórios: ${this.lancamentos.length} lançamentos unificados (canônico+legado)`);
            } catch (e) {
                console.warn('⚠️ Falha ao deduplicar lançamentos no relatório:', e);
            }
            
            if (this.funcionarios.length === 0) {
                try {
                    // CORREÇÃO: Carregar funcionários de todas as coleções possíveis
                    // Limpeza: usar apenas a chave lógica; o Manager já tenta 'folha/funcionarios' e depois legado
                    const colecoes = ['funcionarios'];
                    const todosFuncionarios = [];
                    
                    for (const colecao of colecoes) {
                        try {
                            const dados = await getData(colecao) || {};
                            const funcionariosColecao = Object.values(dados).filter(f => f && f.nome);
                            todosFuncionarios.push(...funcionariosColecao);
                            console.log(`👥 Funcionários de ${colecao}: ${funcionariosColecao.length}`);
                        } catch (error) {
                            console.warn(`⚠️ Erro ao carregar de ${colecao}:`, error);
                        }
                    }
                    
                    // Deduplicar por ID e filtrar funcionários inativos
                    const funcionariosUnicos = new Map();
                    for (const func of todosFuncionarios) {
                        if (func.id && !funcionariosUnicos.has(func.id) && func.ativo !== false) {
                            funcionariosUnicos.set(func.id, func);
                        }
                    }
                    
                    this.funcionarios = Array.from(funcionariosUnicos.values());
                    console.log(`👥 Total funcionários únicos carregados: ${this.funcionarios.length}`);
                    
                } catch (error) {
                    console.warn('⚠️ Erro ao carregar funcionários do Firebase:', error);
                }
            }
            
            // Normalização leve para evitar formatos legados
            try {
                this.lancamentos = (window.FolhaUtils && typeof window.FolhaUtils.normalizarLancamentos === 'function')
                    ? window.FolhaUtils.normalizarLancamentos(this.lancamentos || [])
                    : (this.lancamentos || []);
            } catch (e) {
                console.warn('⚠️ Falha ao normalizar registros no relatório:', e);
            }

            console.log(`📊 Dados prontos para relatórios: ${this.lancamentos.length} lançamentos, ${this.funcionarios.length} funcionários`);
            
            // CORREÇÃO: Configurar funcionário individual se modal estiver aberto
            this.configurarFuncionarioIndividual();
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados para relatórios:', error);
        }
    }
    
    /**
     * 👥 CONFIGURAR FUNCIONÁRIO INDIVIDUAL
     */
    configurarFuncionarioIndividual() {
        const funcionarioInput = document.getElementById('funcionarioRelatorio');
        if (!funcionarioInput) return;
        
        console.log(`👥 Configurando funcionário individual com ${this.funcionarios.length} funcionários`);
        
        // CORREÇÃO: Usar configuração manual mais simples e robusta
        this.configurarAutocompleteManual(funcionarioInput);
    }
    
    /**
     * 🔧 CONFIGURAR AUTOCOMPLETE MANUAL
     */
    configurarAutocompleteManual(funcionarioInput) {
        if (funcionarioInput._autocompleteConfigured) return;
        
        // CORREÇÃO: Não usar datalist para evitar a seta - apenas event listener
        funcionarioInput.addEventListener('input', (e) => {
            const valor = e.target.value.toLowerCase();
            const funcionariosMatch = this.funcionarios.filter(f => 
                f.nome && f.nome.toLowerCase().includes(valor)
            );
            console.log(`🔍 Funcionários encontrados: ${funcionariosMatch.length}`, funcionariosMatch.map(f => f.nome));
        });
        
        funcionarioInput._autocompleteConfigured = true;
        console.log(`✅ Autocomplete manual configurado com ${this.funcionarios.length} funcionários (sem datalist)`);
    }

    /**
     * 📊 ABRIR MODAL DE RELATÓRIOS
     */
    openRelatorioModal() {
        console.log('📊 Abrindo modal de relatórios...');
        
        // Criar modal dinamicamente se não existir
        if (!document.getElementById('relatorioModal')) {
            this.createRelatorioModal();
        }
        
        // Atualizar dados a cada abertura para garantir dados mais recentes
        try { 
            this.loadData().then(() => {
                // CORREÇÃO: Configurar funcionário individual após carregar dados
                this.configurarFuncionarioIndividual();
            }); 
        } catch {}

        const modal = document.getElementById('relatorioModal');
        if (modal) {
            modal.style.display = 'block';
            
            // Configurar data padrão (mês atual)
            this.setCurrentMonthInModal();
        }
    }
    
    /**
     * 🏗️ CRIAR MODAL DE RELATÓRIOS
     */
    createRelatorioModal() {
        const modalHTML = `
            <div id="relatorioModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-chart-bar"></i> Gerar Relatórios
                        </h3>
                        <span class="close-modal" onclick="closeRelatorioModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <form id="relatorioForm">
                            <div class="form-group">
                                <label for="tipoRelatorio" style="margin:0;">
                                    <i class="fas fa-file-alt"></i> Tipo de Relatório:
                                </label>
                                <select id="tipoRelatorio" required>
                                    <option value="">Selecione o tipo</option>
                                    ${RELATORIOS_CONFIG.TIPOS_RELATORIO.map(tipo => 
                                        `<option value="${tipo.value}">${tipo.label}</option>`
                                    ).join('')}
                                </select>
                            </div>
                            
                            <div class="campos-grid">
                                <div class="form-group">
                                    <label for="dataInicio">
                                        <i class="fas fa-calendar-alt"></i> Data Início:
                                    </label>
                                    <input type="month" id="dataInicio" required>
                                </div>
                                <div class="form-group">
                                    <label for="dataFim">
                                        <i class="fas fa-calendar-alt"></i> Data Fim:
                                    </label>
                                    <input type="month" id="dataFim" required>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="tipoContratoRelatorio">
                                    <i class="fas fa-briefcase"></i> Tipo de Contrato:
                                </label>
                                <select id="tipoContratoRelatorio">
                                    <option value="">Todos</option>
                                    <option value="CLT">CLT</option>
                                    <option value="PJ">PJ</option>
                                    <option value="AUTONOMO">Autônomo</option>
                                    <option value="DIARISTA">Diarista</option>
                                    <option value="ESTAGIO">Estágio</option>
                                    <option value="TEMPORARIO">Temporário</option>
                                    <option value="OUTROS">Outros</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="relatorioOrientacaoImpressao">
                                    <i class="fas fa-print"></i> Orientação de Impressão/PDF:
                                </label>
                                <select id="relatorioOrientacaoImpressao">
                                    <option value="auto">Automática (Recomendado)</option>
                                    <option value="portrait">Retrato</option>
                                    <option value="landscape">Paisagem</option>
                                </select>
                            </div>

                            <div class="campos-grid" id="pfMesesFilterGroup" style="display:none; grid-template-columns: 1fr 1fr; gap: 12px;">
                                <div class="form-group">
                                    <label for="pfMesesMin">
                                        <i class="fas fa-filter"></i> Meses (mínimo):
                                    </label>
                                    <input type="number" id="pfMesesMin" min="0" max="120" step="1" inputmode="numeric" placeholder="Ex.: 3">
                                </div>
                                <div class="form-group">
                                    <label for="pfMesesMax">
                                        <i class="fas fa-filter"></i> Meses (máximo):
                                    </label>
                                    <input type="number" id="pfMesesMax" min="0" max="120" step="1" inputmode="numeric" placeholder="Ex.: 12">
                                </div>
                            </div>
                            
                            <div class="form-group" id="todosFuncionariosToggleGroup" style="display: none;">
                                <label for="todosFuncionariosAtivos">
                                    <i class="fas fa-users"></i> Gerar para Todos os Funcionários Ativos:
                                </label>
                                <div id="todosFuncionariosContainer" class="toggle-container funcionarios-individuais">
                                    <div class="toggle-switch">
                                        <input type="checkbox" id="todosFuncionariosAtivos" checked>
                                        <span class="toggle-slider"></span>
                                    </div>
                                    <span id="todosFuncionariosDescricao" class="toggle-description">
                                        Funcionário Individual - Selecione um funcionário específico
                                    </span>
                                </div>
                            </div>
                            
                            <div class="form-group" id="funcionarioRelatorioGroup" style="display: none;">
                                <label for="funcionarioRelatorio">
                                    <i class="fas fa-user"></i> Funcionário (Individual):
                                </label>
                                <div class="autocomplete-container">
                                    <input type="text" id="funcionarioRelatorio" class="autocomplete-input" 
                                           placeholder="Selecione um funcionário...">
                                    <div class="autocomplete-icons-container">
                                        <span class="autocomplete-icon" title="Listar Funcionários" 
                                              onclick="openFuncionariosListModalForRelatorio()">
                                            <i class="fas fa-list"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <h3>Formato de Exportação</h3>
                            <div class="export-options">
                                ${(() => {
                                    const formats = Array.isArray(RELATORIOS_CONFIG.FORMATOS_EXPORTACAO) ? RELATORIOS_CONFIG.FORMATOS_EXPORTACAO.slice() : [];
                                    const printFmt = formats.find(f => f && f.value === 'print');
                                    const rest = formats.filter(f => f && f.value !== 'print');
                                    const printBtn = printFmt ? `
                                        <button type="button" class="export-button relatorio-export-btn" data-formato="${printFmt.value}" style="background-color: ${printFmt.color}">
                                            <i class="${printFmt.icon}"></i>
                                            ${printFmt.label}
                                        </button>
                                    ` : '';
                                    const columnsBtn = `
                                        <button id="btnReportColumnsConfig" type="button" class="export-button relatorio-export-btn report-columns-btn" onclick="window.folhaRelatorios && window.folhaRelatorios.openReportColumnsConfigModal && window.folhaRelatorios.openReportColumnsConfigModal()" style="background-color: #6b7280" title="Configurar colunas deste relatório" aria-label="Configurar colunas do relatório">
                                            <i class="fas fa-list"></i>
                                            Colunas
                                            <span id="reportColumnsHint" class="report-columns-hint"></span>
                                        </button>
                                    `;
                                    const restBtns = rest.map(formato => `
                                        <button type="button" class="export-button relatorio-export-btn" data-formato="${formato.value}" style="background-color: ${formato.color}">
                                            <i class="${formato.icon}"></i>
                                            ${formato.label}
                                        </button>
                                    `).join('');
                                    return `${printBtn}${columnsBtn}${restBtns}`;
                                })()}
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer relatorio-footer-actions footer-with-info">
                        <div class="footer-info" style="color: #666; font-size: 14px;">
                            <i class="fas fa-info-circle"></i> Selecione o período e formato desejado
                        </div>
                        <div class="footer-secondary relatorio-footer-buttons">
                            <button type="button" class="back-button relatorio-footer-btn" onclick="closeRelatorioModal()">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Configurar event listeners do modal
        this.setupRelatorioModalListeners();
    }
    
    /**
     * 🎯 CONFIGURAR LISTENERS DO MODAL
     */
    setupRelatorioModalListeners() {
        // Tipo de relatório
        const tipoRelatorio = document.getElementById('tipoRelatorio');
        if (tipoRelatorio) {
            tipoRelatorio.addEventListener('change', () => {
                this.updateRelatorioTypeUI();
            });
        }
        
        // Toggle todos funcionários
        const todosFuncionariosToggle = document.getElementById('todosFuncionariosAtivos');
        if (todosFuncionariosToggle) {
            todosFuncionariosToggle.addEventListener('change', () => {
                this.updateTodosFuncionariosToggle();
            });
            
            // Adicionar click listener no container do toggle para garantir funcionamento visual
            const toggleContainer = document.querySelector('#todosFuncionariosContainer .toggle-switch');
            if (toggleContainer) {
                toggleContainer.addEventListener('click', (e) => {
                    // Prevenir duplo disparo se clicou diretamente no input
                    if (e.target.type === 'checkbox') return;
                    
                    // Toggle manual do checkbox
                    todosFuncionariosToggle.checked = !todosFuncionariosToggle.checked;
                    
                    // Disparar evento change
                    todosFuncionariosToggle.dispatchEvent(new Event('change'));
                });
            }
        }
        
        // Botões de exportação
        const exportButtons = document.querySelectorAll('.export-button[data-formato]');
        exportButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const formato = btn.dataset.formato;
                if (formato) {
                    this.gerarRelatorio(formato);
                }
            });
        });
        
        // Click fora do modal
        const modal = document.getElementById('relatorioModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeRelatorioModal();
                }
            });
        }

        try {
            this.refreshTipoContratoOptions();
        } catch (_) {}
        this.updateRelatorioTypeUI();
    }

    normalizeContratoTipo(value) {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return '';
        let s = raw;
        try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
        s = s.toUpperCase().replace(/\s+/g, ' ');
        if (s === 'CLT') return 'CLT';
        if (s === 'PJ' || s === 'P.J.' || s === 'PESSOA JURIDICA' || s === 'PESSOA JURÍDICA') return 'PJ';
        if (s.includes('AUTONOMO') || s.includes('AUTONOM')) return 'AUTONOMO';
        if (s.includes('DIARISTA')) return 'DIARISTA';
        if (s.includes('ESTAGIO') || s.includes('ESTAGI')) return 'ESTAGIO';
        if (s.includes('TEMPORAR')) return 'TEMPORARIO';
        if (s.includes('OUTRO')) return 'OUTROS';
        return s;
    }

    refreshTipoContratoOptions() {
        const select = document.getElementById('tipoContratoRelatorio');
        if (!select) return;
        const current = select.value;

        const known = [
            { value: '', label: 'Todos' },
            { value: 'CLT', label: 'CLT' },
            { value: 'PJ', label: 'PJ' },
            { value: 'AUTONOMO', label: 'Autônomo' },
            { value: 'DIARISTA', label: 'Diarista' },
            { value: 'ESTAGIO', label: 'Estágio' },
            { value: 'TEMPORARIO', label: 'Temporário' },
            { value: 'OUTROS', label: 'Outros' }
        ];

        const found = new Set();
        known.forEach(k => found.add(k.value));

        try {
            const list = Array.isArray(this.funcionarios) ? this.funcionarios : [];
            list.forEach((f) => {
                const raw = f && (f.tipoContrato || f.contratoTipo || f.tipo_contrato || f.regime || f.vinculo || f['vínculo']);
                const norm = this.normalizeContratoTipo(raw);
                if (!norm) return;
                if (!found.has(norm)) {
                    found.add(norm);
                    known.push({ value: norm, label: raw ? String(raw) : norm });
                }
            });
        } catch (_) {}

        select.innerHTML = known.map((o) => `<option value="${String(o.value).replace(/"/g, '&quot;')}">${String(o.label).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</option>`).join('');
        if (known.some(o => o.value === current)) select.value = current;
        else select.value = '';
    }

    updateRelatorioTypeUI() {
        this.toggleFuncionarioField();
        this.toggleProvisaoFeriasMesesFilter();
        this.updateReportColumnsButton();
    }

    toggleProvisaoFeriasMesesFilter() {
        const tipo = (document.getElementById('tipoRelatorio') && document.getElementById('tipoRelatorio').value) || '';
        const group = document.getElementById('pfMesesFilterGroup');
        if (!group) return;
        const shouldShow = tipo === 'provisao_ferias';
        group.style.display = shouldShow ? 'grid' : 'none';
        if (!shouldShow) {
            const minEl = document.getElementById('pfMesesMin');
            const maxEl = document.getElementById('pfMesesMax');
            if (minEl) minEl.value = '';
            if (maxEl) maxEl.value = '';
        }
    }

    updateReportColumnsButton() {
        const btn = document.getElementById('btnReportColumnsConfig');
        const hint = document.getElementById('reportColumnsHint');
        const tipo = (document.getElementById('tipoRelatorio') && document.getElementById('tipoRelatorio').value) || '';
        const supported = this.isReportColumnsSupported(tipo);
        if (btn) {
            btn.disabled = !supported;
            btn.style.opacity = supported ? '1' : '0.45';
            btn.title = supported ? 'Configurar colunas deste relatório' : 'Este tipo não possui colunas configuráveis';
        }
        if (hint) {
            if (!tipo) { hint.textContent = ''; return; }
            if (!supported) { hint.textContent = 'Sem colunas'; return; }
            try {
                const defs = this.getReportColumnsDefs(tipo);
                const cfg = this.getReportColumnsConfigSync(tipo);
                const total = defs.length;
                const visible = defs.filter(d => cfg[d.key] !== false).length;
                hint.textContent = `${visible}/${total}`;
            } catch (_) {
                hint.textContent = '';
            }
        }
    }

    getUserContextForReportPrefs() {
        let uid = '';
        let tenantId = '';
        try {
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getCurrentUid === 'function') {
                uid = String(svc.getCurrentUid() || '').trim();
            }
        } catch (_) {}
        try {
            if (!uid) {
                const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
                if (svc && svc.authService && typeof svc.authService.getAuth === 'function') {
                    const auth = svc.authService.getAuth();
                    uid = String((auth && auth.currentUser && auth.currentUser.uid) || '').trim();
                }
            }
        } catch (_) {}
        try {
            if (!uid) {
                const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
                const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
                uid = String(current.uid || current.id || current.userId || persistent.uid || persistent.id || persistent.userId || '').trim();
            }
        } catch (_) {}

        try {
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getCurrentTenantId === 'function') {
                const t = svc.getCurrentTenantId();
                if (t) tenantId = String(t);
            }
            if (!tenantId && svc && typeof svc.getTenantId === 'function') {
                const t = svc.getTenantId();
                if (t) tenantId = String(t);
            }
        } catch (_) {}
        try {
            if (!tenantId && window.appTenantId) tenantId = String(window.appTenantId);
        } catch (_) {}
        try {
            if (!tenantId) {
                const stored = localStorage.getItem('company_info');
                if (stored) {
                    const obj = JSON.parse(stored);
                    const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                    if (id) tenantId = String(id);
                }
            }
        } catch (_) {}

        return { uid: uid || 'anon', tenantId: tenantId || 'default' };
    }

    getReportColumnsStorageKey(tipoRelatorio) {
        const ctx = this.getUserContextForReportPrefs();
        return `folha_report_cols_${ctx.tenantId}_${ctx.uid}__${String(tipoRelatorio || 'default')}`;
    }

    getReportColumnsRemotePath(tipoRelatorio) {
        const ctx = this.getUserContextForReportPrefs();
        return `users/${ctx.uid}/preferences/folhaReportColumns/${ctx.tenantId}/${String(tipoRelatorio || 'default')}`;
    }

    isReportColumnsSupported(tipoRelatorio) {
        const t = String(tipoRelatorio || '');
        if (!t) return false;
        if (t === 'individual') return false;
        if (t === 'recibo_horas_extras') return false;
        if (t === 'extrato_bh') return false;
        return this.getReportColumnsDefs(t).length > 0;
    }

    getReportColumnsDefs(tipoRelatorio) {
        const t = String(tipoRelatorio || '');
        if (t === 'completo' || t === 'mensal' || t === 'anual') {
            return [
                { key: 'funcionario', label: 'Funcionário' },
                { key: 'cargo', label: 'Cargo' },
                { key: 'formaPgto', label: 'Forma Pgto.' },
                { key: 'periodo', label: 'Período' },
                { key: 'tipo', label: 'Tipo' },
                { key: 'percentQuinzena', label: '% Quinzena' },
                { key: 'salarioBase', label: 'Salário Base' },
                { key: 'quinzena', label: 'Quinzena' },
                { key: 'acrescimos', label: 'Acréscimos' },
                { key: 'descontos', label: 'Descontos' },
                { key: 'vales', label: 'Vales' },
                { key: 'liquido', label: 'Líquido' }
            ];
        }
        if (t === 'quinzena') {
            return [
                { key: 'funcionario', label: 'Funcionário' },
                { key: 'cargo', label: 'Cargo' },
                { key: 'formaPgto', label: 'Forma Pgto.' },
                { key: 'periodo', label: 'Período' },
                { key: 'percentual', label: 'Percentual' },
                { key: 'valorBase', label: 'Valor Base' },
                { key: 'valorQuinzena', label: 'Valor Quinzena' },
                { key: 'acrescimos', label: 'Acréscimos' },
                { key: 'descontos', label: 'Descontos' },
                { key: 'valorLiquido', label: 'Valor Líquido' }
            ];
        }
        if (t === 'provisao_ferias') {
            return [
                { key: 'funcionario', label: 'Funcionário' },
                { key: 'cargo', label: 'Cargo' },
                { key: 'admissao', label: 'Admissão' },
                { key: 'vencimento', label: 'Vencimento' },
                { key: 'meses', label: 'Meses' },
                { key: 'provisao', label: 'Provisão' }
            ];
        }
        if (t === 'provisao_rescisao_detalhada') {
            return [
                { key: 'funcionario', label: 'Funcionário' },
                { key: 'cargo', label: 'Cargo' },
                { key: 'admissao', label: 'Admissão' },
                { key: 'decimoTerceiro', label: '13º Proporcional' },
                { key: 'feriasProp', label: 'Férias Proporcionais' },
                { key: 'tercoFerias', label: '1/3 Férias' },
                { key: 'avisoPrevio', label: 'Aviso Prévio' },
                { key: 'fgts', label: 'FGTS' },
                { key: 'multaFgts', label: 'Multa FGTS' },
                { key: 'total', label: 'Total' }
            ];
        }
        return [];
    }

    getDefaultReportColumnsConfig(tipoRelatorio) {
        const defs = this.getReportColumnsDefs(tipoRelatorio);
        const cfg = {};
        defs.forEach(d => { cfg[d.key] = true; });
        return cfg;
    }

    getReportColumnsConfigSync(tipoRelatorio) {
        const key = this.getReportColumnsStorageKey(tipoRelatorio);
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return this.getDefaultReportColumnsConfig(tipoRelatorio);
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return this.getDefaultReportColumnsConfig(tipoRelatorio);
            const defs = this.getReportColumnsDefs(tipoRelatorio);
            const normalized = this.getDefaultReportColumnsConfig(tipoRelatorio);
            defs.forEach(d => {
                if (Object.prototype.hasOwnProperty.call(parsed, d.key)) {
                    normalized[d.key] = parsed[d.key] !== false;
                }
            });
            return normalized;
        } catch (_) {
            return this.getDefaultReportColumnsConfig(tipoRelatorio);
        }
    }

    async ensureReportColumnsConfigLoaded(tipoRelatorio) {
        if (!this.isReportColumnsSupported(tipoRelatorio)) return;
        const key = this.getReportColumnsStorageKey(tipoRelatorio);
        try {
            const raw = localStorage.getItem(key);
            if (raw) return;
        } catch (_) {}
        try {
            const path = this.getReportColumnsRemotePath(tipoRelatorio);
            const remote = (typeof window.getData === 'function') ? await window.getData(path, { debounceMs: 0 }) : null;
            if (remote && typeof remote === 'object') {
                localStorage.setItem(key, JSON.stringify(remote));
            }
        } catch (_) {}
    }

    async saveReportColumnsConfig(tipoRelatorio, config) {
        const key = this.getReportColumnsStorageKey(tipoRelatorio);
        const defs = this.getReportColumnsDefs(tipoRelatorio);
        const sanitized = {};
        defs.forEach(d => { sanitized[d.key] = config[d.key] !== false; });
        try { localStorage.setItem(key, JSON.stringify(sanitized)); } catch (_) {}
        try {
            const path = this.getReportColumnsRemotePath(tipoRelatorio);
            if (typeof window.saveData === 'function') {
                await window.saveData(path, sanitized, { debounceMs: 0, showToast: false });
            }
        } catch (_) {}
        try { this.updateReportColumnsButton(); } catch (_) {}
    }

    async openReportColumnsConfigModal() {
        const tipo = (document.getElementById('tipoRelatorio') && document.getElementById('tipoRelatorio').value) || '';
        if (!this.isReportColumnsSupported(tipo)) {
            this.showNotification('Este tipo de relatório não possui colunas configuráveis.', 'info');
            return;
        }
        await this.ensureReportColumnsConfigLoaded(tipo);
        const defs = this.getReportColumnsDefs(tipo);
        const cfg = this.getReportColumnsConfigSync(tipo);
        if (!document.getElementById('reportColumnsConfigModal')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div id="reportColumnsConfigModal" class="modal">
                    <div class="modal-content" style="max-width:560px;">
                        <div class="modal-header">
                            <h3 class="modal-title"><i class="fas fa-list"></i> Colunas do Relatório</h3>
                            <span class="close-modal" onclick="window.folhaRelatorios && window.folhaRelatorios.closeReportColumnsConfigModal && window.folhaRelatorios.closeReportColumnsConfigModal()">&times;</span>
                        </div>
                        <div class="modal-body">
                            <div id="reportColumnsConfigMeta" style="color:#64748b; font-size:13px; margin-bottom:10px;"></div>
                            <div id="reportColumnsConfigList"></div>
                        </div>
                        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px;">
                            <button type="button" class="btn btn-secondary" onclick="window.folhaRelatorios && window.folhaRelatorios.closeReportColumnsConfigModal && window.folhaRelatorios.closeReportColumnsConfigModal()">Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="window.folhaRelatorios && window.folhaRelatorios.saveReportColumnsConfigFromModal && window.folhaRelatorios.saveReportColumnsConfigFromModal()">Salvar</button>
                        </div>
                    </div>
                </div>
            `);

            try {
                const modalEl = document.getElementById('reportColumnsConfigModal');
                if (modalEl && !modalEl._outsideClickConfigured) {
                    modalEl.addEventListener('click', (e) => {
                        if (e.target === modalEl) this.closeReportColumnsConfigModal();
                    });
                    modalEl._outsideClickConfigured = true;
                }
            } catch (_) {}
        }

        const modal = document.getElementById('reportColumnsConfigModal');
        const list = document.getElementById('reportColumnsConfigList');
        const meta = document.getElementById('reportColumnsConfigMeta');
        if (meta) {
            const label = (RELATORIOS_CONFIG.TIPOS_RELATORIO.find(t => t.value === tipo)?.label) || tipo;
            meta.textContent = `Tipo: ${label}`;
        }
        if (list) {
            const items = defs.map(d => {
                const checked = cfg[d.key] !== false;
                return `
                    <label class="report-col-item">
                        <input type="checkbox" class="report-col-check" data-col="${d.key}" ${checked ? 'checked' : ''}>
                        <span class="report-col-label">${d.label}</span>
                    </label>
                `;
            }).join('');
            list.innerHTML = `<div class="report-col-grid">${items}</div>`;
        }
        if (modal) {
            modal.style.display = 'block';
            modal.dataset.tipoRelatorio = tipo;
        }
    }

    closeReportColumnsConfigModal() {
        const modal = document.getElementById('reportColumnsConfigModal');
        if (modal) modal.style.display = 'none';
    }

    async saveReportColumnsConfigFromModal() {
        const modal = document.getElementById('reportColumnsConfigModal');
        if (!modal) return;
        const tipo = modal.dataset.tipoRelatorio || '';
        if (!this.isReportColumnsSupported(tipo)) return;
        const defs = this.getReportColumnsDefs(tipo);
        const cfg = {};
        defs.forEach(d => { cfg[d.key] = true; });
        Array.from(modal.querySelectorAll('.report-col-check')).forEach(ch => {
            const key = ch.getAttribute('data-col');
            if (key) cfg[key] = !!ch.checked;
        });
        if (defs.every(d => cfg[d.key] === false)) {
            cfg[defs[0].key] = true;
        }
        await this.saveReportColumnsConfig(tipo, cfg);
        this.closeReportColumnsConfigModal();
        this.showNotification('Configuração de colunas salva.', 'success');
    }

    applyReportColumnsConfigToHtml(tipoRelatorio, html) {
        if (!this.isReportColumnsSupported(tipoRelatorio)) return html;
        const defs = this.getReportColumnsDefs(tipoRelatorio);
        const defsJson = JSON.stringify(defs);
        const key = this.getReportColumnsStorageKey(tipoRelatorio);
        let out = String(html || '');
        out = out.replace(/<div\s+class="relatorio-container"/i, `<div class="relatorio-container" data-report-type="${String(tipoRelatorio).replace(/"/g, '&quot;')}"`);
        if (/data-report-columns-configured/i.test(out)) return out;
        out += `
<script data-report-columns-configured="1">(function(){
  try {
    var defs = ${defsJson};
    var cfgKey = ${JSON.stringify(key)};
    var cfg = null;
    try { cfg = JSON.parse(localStorage.getItem(cfgKey) || 'null'); } catch(e) { cfg = null; }
    if (!cfg || typeof cfg !== 'object') {
      cfg = {};
      (defs||[]).forEach(function(d){ cfg[d.key] = true; });
    }
    function norm(s){
      try {
        return String(s||'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ');
      } catch(e) {
        return String(s||'').trim().toUpperCase().replace(/\s+/g,' ');
      }
    }
    var labelToKey = {};
    (defs||[]).forEach(function(d){ labelToKey[norm(d.label)] = d.key; });
    var root = document.querySelector('[data-report-type]') || document.querySelector('.pf-provisao-ferias') || document.body;
    if (!root) return;
    var tables = Array.from(root.querySelectorAll('table'));
    if (!tables.length) return;
    tables.forEach(function(table){
      var ths = Array.from(table.querySelectorAll('thead th'));
      if (!ths.length) return;
      var colKeys = ths.map(function(th){
        var txt = norm(th.textContent||'');
        var key = th.getAttribute('data-col') || labelToKey[txt] || '';
        if (key) th.setAttribute('data-col', key);
        return key;
      });
      var hiddenIdx = [];
      colKeys.forEach(function(key, idx){
        if (!key) return;
        if (cfg[key] === false) hiddenIdx.push(idx);
      });
      if (!hiddenIdx.length) return;
      var rows = Array.from(table.querySelectorAll('tr'));
      rows.forEach(function(tr){
        var cells = Array.from(tr.children);
        hiddenIdx.forEach(function(i){ if (cells[i]) cells[i].style.display = 'none'; });
      });
      try {
        table.querySelectorAll('tbody td[colspan], tfoot td[colspan]').forEach(function(td){
          var cs = Number(td.getAttribute('colspan')||0);
          if (!cs) return;
          var next = Math.max(1, cs - hiddenIdx.length);
          td.setAttribute('colspan', String(next));
        });
      } catch(e) {}
    });
  } catch(e) {}
})();</script>`;
        return out;
    }
    
    /**
     * 📅 CONFIGURAR MÊS ATUAL NO MODAL
     */
    setCurrentMonthInModal() {
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        
        const dataInicio = document.getElementById('dataInicio');
        const dataFim = document.getElementById('dataFim');
        
        if (dataInicio && !dataInicio.value) {
            dataInicio.value = mesAtual;
        }
        
        if (dataFim && !dataFim.value) {
            dataFim.value = mesAtual;
        }
        
        console.log('📅 Mês atual definido no modal de relatórios:', mesAtual);
    }
    
    /**
     * 🔄 ALTERNAR CAMPO FUNCIONÁRIO
     */
    toggleFuncionarioField() {
        const funcionarioGroup = document.getElementById('funcionarioRelatorioGroup');
        const toggleGroup = document.getElementById('todosFuncionariosToggleGroup');
        if (toggleGroup) toggleGroup.style.display = 'block';
        if (funcionarioGroup) funcionarioGroup.style.display = 'none';
        this.updateTodosFuncionariosToggle();
    }
    
    /**
     * 🔄 ATUALIZAR TOGGLE TODOS FUNCIONÁRIOS
     */
    updateTodosFuncionariosToggle() {
        const toggle = document.getElementById('todosFuncionariosAtivos');
        const descricao = document.getElementById('todosFuncionariosDescricao');
        const container = document.getElementById('todosFuncionariosContainer');
        const funcionarioGroup = document.getElementById('funcionarioRelatorioGroup');
        
        if (!toggle || !descricao || !container) return;
        
        if (toggle.checked) {
            // Todos os funcionários ativos
            descricao.textContent = 'Todos os Funcionários Ativos - Gerar relatório consolidado';
            container.className = 'toggle-container funcionarios-todos';
            if (funcionarioGroup) funcionarioGroup.style.display = 'none';
        } else {
            // Funcionário individual
            descricao.textContent = 'Funcionário Individual - Selecione um funcionário específico';
            container.className = 'toggle-container funcionarios-individuais';
            if (funcionarioGroup) funcionarioGroup.style.display = 'block';
        }
    }

    getFuncionarioFiltroRelatorio() {
        const todosFuncionarios = (document.getElementById('todosFuncionariosAtivos') && document.getElementById('todosFuncionariosAtivos').checked);
        const funcionarioElement = document.getElementById('funcionarioRelatorio');
        const funcionarioId = (funcionarioElement && funcionarioElement.dataset && funcionarioElement.dataset.funcionarioId)
            ? String(funcionarioElement.dataset.funcionarioId).trim()
            : '';
        const funcionarioNome = (funcionarioElement && funcionarioElement.value)
            ? String(funcionarioElement.value).trim()
            : '';
        const contratoSelect = document.getElementById('tipoContratoRelatorio');
        const contratoTipo = contratoSelect ? String(contratoSelect.value || '').trim() : '';
        if (!todosFuncionarios && !funcionarioId) {
            throw new Error('Selecione um funcionário para gerar o relatório individual.');
        }
        return { todosFuncionarios, funcionarioId, funcionarioNome, contratoTipo };
    }

    filtrarDadosPorFuncionarioRelatorio(dados, filtro) {
        const lista = Array.isArray(dados) ? dados : [];
        const contratoFiltro = filtro && filtro.contratoTipo ? this.normalizeContratoTipo(filtro.contratoTipo) : '';
        return lista.filter((lancamento) => {
            if (!filtro) return true;
            if (!filtro.todosFuncionarios && filtro.funcionarioId) {
                const id = (lancamento && lancamento.funcionario && lancamento.funcionario.id) || lancamento.funcionarioId || '';
                if (String(id) !== String(filtro.funcionarioId)) return false;
            }
            if (contratoFiltro) {
                const func = this.getFuncionarioDetalhado(lancamento);
                const tipo = this.normalizeContratoTipo(func && (func.tipoContrato || func.contratoTipo || func.tipo_contrato || func.regime || func.vinculo || func['vínculo']));
                if (!tipo) return false;
                if (contratoFiltro === 'OUTROS') {
                    const known = new Set(['CLT','PJ','AUTONOMO','DIARISTA','ESTAGIO','TEMPORARIO']);
                    return !known.has(tipo);
                }
                return tipo === contratoFiltro;
            }
            return true;
        });
    }

    getFuncionarioDetalhado(lancamento) {
        const funcionarioLancamento = (lancamento && lancamento.funcionario && typeof lancamento.funcionario === 'object')
            ? lancamento.funcionario
            : {};
        const id = funcionarioLancamento.id || lancamento.funcionarioId || lancamento.idFuncionario || lancamento.func_id || '';
        const funcionarioCadastro = (this.funcionarios || []).find(f => String(f.id || '') === String(id || '')) || {};
        return { ...funcionarioCadastro, ...funcionarioLancamento };
    }
    
    /**
     * 📊 GERAR RELATÓRIO
     */
    async gerarRelatorio(formato) {
        try {
            const tipoRelatorio = ((document.getElementById('tipoRelatorio') && document.getElementById('tipoRelatorio').value) || 'completo');
            const dataInicio = (document.getElementById('dataInicio') && document.getElementById('dataInicio').value);
            const dataFim = (document.getElementById('dataFim') && document.getElementById('dataFim').value);
            
            if (!tipoRelatorio || !dataInicio || !dataFim) {
                this.showNotification('Preencha todos os campos obrigatórios', 'warning');
                return;
            }
            
            // ✅ CORREÇÃO CRÍTICA: Usar APENAS dados da tabela principal (não incluir folhas fechadas)
            // Priorizar dados do FolhaLancamentos que já filtra folhas fechadas
            const baseDados = (window.folhaLancamentos && window.folhaLancamentos.lancamentos) || this.lancamentos || [];
            // Normalizar: garantir que cada item tenha id/mesAno
            const dadosFonte = Array.isArray(baseDados) ? baseDados : Object.values(baseDados);
            
            // ✅ FILTRO ADICIONAL: Garantir que não há folhas fechadas nos dados base
            let folhasFechadasRemovidas = 0;
            const amostraFolhasFechadas = [];
            const dadosLimpos = dadosFonte.filter(item => {
                const isClosed = item.status === 'mes_fechado';
                if (isClosed) {
                    folhasFechadasRemovidas += 1;
                    if (amostraFolhasFechadas.length < 5) {
                        amostraFolhasFechadas.push((item && item.funcionario && item.funcionario.nome) || 'sem nome');
                    }
                }
                return !isClosed;
            });

            if (folhasFechadasRemovidas > 0) {
                console.log(`🚫 Folhas fechadas removidas dos dados base do relatório: ${folhasFechadasRemovidas}`, amostraFolhasFechadas);
            }
            
            console.log(`📊 Dados base para relatório: ${dadosLimpos.length}/${dadosFonte.length} (folhas fechadas excluídas)`);
            
            // Filtrar dados por período (usando dados já limpos)
            const dadosFiltrados = this.filtrarDadosPorPeriodo(dataInicio, dataFim, dadosLimpos);
            
            const tiposQuePermitemSemLancamentos = new Set(['provisao_ferias', 'provisao_rescisao_detalhada', 'extrato_bh']);
            if (dadosFiltrados.length === 0 && !tiposQuePermitemSemLancamentos.has(tipoRelatorio)) {
                this.showNotification('Nenhum dado encontrado para o período selecionado', 'warning');
                return;
            }
            
            const filtroFuncionario = this.getFuncionarioFiltroRelatorio();
            const dadosFiltradosPorFuncionario = this.filtrarDadosPorFuncionarioRelatorio(dadosFiltrados, filtroFuncionario);
            if (dadosFiltradosPorFuncionario.length === 0 && tipoRelatorio !== 'provisao_ferias' && tipoRelatorio !== 'provisao_rescisao_detalhada' && tipoRelatorio !== 'extrato_bh') {
                this.showNotification('Nenhum dado encontrado para o funcionário selecionado no período', 'warning');
                return;
            }

            // Gerar relatório baseado no tipo
            let relatorioHTML;
            switch (tipoRelatorio) {
                case 'completo':
                    relatorioHTML = await this.gerarRelatorioCompleto(dadosFiltradosPorFuncionario, dataInicio, dataFim);
                    break;
                case 'quinzena':
                    relatorioHTML = await this.gerarRelatorioQuinzena(dadosFiltradosPorFuncionario, dataInicio, dataFim);
                    break;
                case 'fechamento':
                    relatorioHTML = await this.gerarRelatorioFechamentoComAbatimento(dadosFiltradosPorFuncionario, dataInicio, dataFim);
                    break;
                case 'simples':
                    relatorioHTML = await this.gerarRelatorioSimples(dadosFiltradosPorFuncionario, dataInicio, dataFim, {});
                    break;
                case 'mensal':
                    // Fallback: usar relatório completo quando funções específicas não existem
                    if (typeof this.gerarRelatorioMensal === 'function') {
                        relatorioHTML = await this.gerarRelatorioMensal(dadosFiltradosPorFuncionario, dataInicio, dataFim);
                    } else {
                        relatorioHTML = await this.gerarRelatorioCompleto(dadosFiltradosPorFuncionario, dataInicio, dataFim);
                    }
                    break;
                case 'anual':
                    if (typeof this.gerarRelatorioAnual === 'function') {
                        relatorioHTML = await this.gerarRelatorioAnual(dadosFiltradosPorFuncionario, dataInicio, dataFim);
                    } else {
                        relatorioHTML = await this.gerarRelatorioCompleto(dadosFiltradosPorFuncionario, dataInicio, dataFim);
                    }
                    break;
                case 'individual':
                    if (filtroFuncionario.todosFuncionarios) {
                        // Gerar para todos os funcionários ativos
                        relatorioHTML = await this.gerarDemonstrativoTodosFuncionarios(dadosFiltrados, dataInicio, dataFim);
                    } else {
                        relatorioHTML = await this.gerarDemonstrativoIndividualPorId(filtroFuncionario.funcionarioId, dadosFiltradosPorFuncionario);
                    }
                    break;
                case 'recibo_horas_extras':
                    {
                        if (filtroFuncionario.todosFuncionarios) {
                            relatorioHTML = await this.gerarReciboHorasExtrasTodosAtivos(dadosFiltrados, dataInicio, dataFim);
                        } else {
                            relatorioHTML = await this.gerarReciboHorasExtrasIndividualPorId(filtroFuncionario.funcionarioId, dadosFiltradosPorFuncionario, dataInicio, dataFim);
                        }
                    }
                    break;
                case 'provisao_ferias':
                    relatorioHTML = await this.gerarRelatorioProvisaoFerias(dataInicio, dataFim, filtroFuncionario);
                    break;
                case 'provisao_rescisao_detalhada':
                    relatorioHTML = await this.gerarRelatorioProvisaoRescisaoDetalhada(dataInicio, dataFim, filtroFuncionario);
                    break;
                case 'extrato_bh':
                    relatorioHTML = await this.gerarRelatorioExtratoBH(dataInicio, dataFim, filtroFuncionario);
                    break;
                default:
                    // Fallback para relatório completo
                    relatorioHTML = await this.gerarRelatorioCompleto(dadosFiltradosPorFuncionario, dataInicio, dataFim);
            }

            try {
                await this.ensureReportColumnsConfigLoaded(tipoRelatorio);
                relatorioHTML = this.applyReportColumnsConfigToHtml(tipoRelatorio, relatorioHTML);
            } catch (_) {}
            
            // Exportar no formato solicitado
            await this.exportarRelatorio(relatorioHTML, formato, tipoRelatorio);
            
            this.closeRelatorioModal();
            this.showNotification('Relatório gerado com sucesso!', 'success');
            
        } catch (error) {
            console.error('❌ Erro ao gerar relatório:', error);
            this.showNotification('Erro ao gerar relatório: ' + error.message, 'error');
        }
    }
    
    /**
     * 🔍 FILTRAR DADOS POR PERÍODO (CORRIGIDO - INCLUI FILTRO DE FUNCIONÁRIOS INATIVOS)
     */
    filtrarDadosPorPeriodo(dataInicio, dataFim, dados = this.lancamentos) {
        const fonte = Array.isArray(dados) ? dados : (dados ? Object.values(dados) : []);
        return fonte.filter(lancamento => {
            // Filtrar por período
            const mesAno = lancamento.mesAno;
            const dentroPeríodo = mesAno >= dataInicio && mesAno <= dataFim;
            
            // ✅ CORREÇÃO CRÍTICA: FILTRAR FOLHAS FECHADAS
            // Relatórios devem usar APENAS dados da tabela principal (não incluir folhas fechadas)
            const statusFolha = lancamento.status;
            const isFolhaFechada = statusFolha === 'mes_fechado';
            
            if (isFolhaFechada) {
                console.log('🚫 Folha fechada filtrada do relatório:', ((lancamento && lancamento.funcionario && lancamento.funcionario.nome) || ''), '- Status:', statusFolha);
                return false;
            }
            
            // ✅ FILTRAR FUNCIONÁRIOS INATIVOS (NOVA FUNCIONALIDADE - VERSÃO ROBUSTA)
            let funcionarioAtivo = true;
            if (lancamento.funcionario && lancamento.funcionario.id) {
                // Buscar funcionário atual no sistema para verificar status
                const funcionarioAtual = this.funcionarios.find(f => f.id === lancamento.funcionario.id);
                if (funcionarioAtual && funcionarioAtual.ativo === false) {
                    funcionarioAtivo = false;
                    console.log('🚫 Lançamento de funcionário inativo filtrado no relatório (verificação cruzada):', lancamento.funcionario.nome);
                }
                // Também verificar a propriedade direta no lançamento (para compatibilidade)
                else if (lancamento.funcionario.ativo === false) {
                    funcionarioAtivo = false;
                    console.log('🚫 Lançamento de funcionário inativo filtrado no relatório (propriedade direta):', lancamento.funcionario.nome);
                }
            }
            
            return dentroPeríodo && funcionarioAtivo;
        });
    }
    
    /**
     * 📄 GERAR RELATÓRIO COMPLETO
     */
    async gerarRelatorioCompleto(dados, dataInicio, dataFim) {
        const periodo = this.formatarPeriodo(dataInicio, dataFim);
        const totais = this.calcularTotais(dados);
        const cabecalho = await this.gerarCabecalhoRelatorio('FOLHA DE PAGAMENTO COMPLETA', periodo);
        
        return `
            <div class="relatorio-container">
                ${cabecalho}
                
                <div class="relatorio-resumo">
                    <div class="resumo-item">
                        <h4>Total de Funcionários:</h4>
                        <span>${this.contarFuncionariosUnicos(dados)}</span>
                    </div>
                    <div class="resumo-item">
                        <h4>Total de Lançamentos:</h4>
                        <span>${dados.length}</span>
                    </div>
                    <div class="resumo-item">
                        <h4>Total Bruto:</h4>
                        <span>R$ ${totais.bruto.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="resumo-item">
                        <h4>Total Líquido:</h4>
                        <span class="valor-destaque">R$ ${totais.liquido.toFixed(2).replace('.', ',')}</span>
                    </div>
                </div>
                
                <table class="relatorio-table">
                    <thead>
                        <tr>
                            <th>Funcionário</th>
                            <th>Cargo</th>
                            <th>Forma Pgto.</th>
                            <th>Período</th>
                            <th>Tipo</th>
                            <th>% Quinzena</th>
                            <th>Salário Base</th>
                            <th>Quinzena</th>
                            <th>Acréscimos</th>
                            <th>Descontos</th>
                            <th>Vales</th>
                            <th>Líquido</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dados.map(lancamento => this.gerarLinhaRelatorio(lancamento)).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="6"><strong>TOTAIS GERAIS:</strong></td>
                            <td><strong>R$ ${this.somarCampo(dados, 'salarioBaseDisplay').toFixed(2).replace('.', ',')}</strong></td>
                            <td><strong>R$ ${this.somarCampo(dados, 'quinzena').toFixed(2).replace('.', ',')}</strong></td>
                            <td><strong>R$ ${this.somarCampo(dados, 'acrescimos').toFixed(2).replace('.', ',')}</strong></td>
                            <td><strong>R$ ${totais.descontos.toFixed(2).replace('.', ',')}</strong></td>
                            <td><strong>R$ ${this.somarCampo(dados, 'vales').toFixed(2).replace('.', ',')}</strong></td>
                            <td><strong>R$ ${totais.liquido.toFixed(2).replace('.', ',')}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                
                ${this.gerarRodapeRelatorio()}
            </div>
        `;
    }
    
    /**
     * 📅 GERAR RELATÓRIO DE QUINZENA
     */
    async gerarRelatorioQuinzena(dados, dataInicio, dataFim) {
        // ✅ CORREÇÃO CRÍTICA: Filtrar APENAS quinzenas da tabela principal (não fechadas)
        const dadosQuinzena = dados.filter(d => {
            const tipoPagamento = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
                ? window.FolhaUtils.resolveTipoPagamento(d)
                : (String((d && (d.tipoPagamento || d.tipo || d.tipoFolha)) || 'mes').toLowerCase().includes('quinz') ? 'quinzena' : 'mes');
            const isQuinzena = tipoPagamento === 'quinzena';
            const isNotClosed = d.status !== 'mes_fechado';
            
            if (isQuinzena && !isNotClosed) {
                console.log('🚫 Quinzena fechada excluída do relatório:', ((d && d.funcionario && d.funcionario.nome) || ''), '- Status:', d.status);
            }
            
            return isQuinzena && isNotClosed;
        });
        
        console.log(`📊 Relatório de Quinzena: ${dadosQuinzena.length} quinzenas da tabela principal (excluindo fechadas)`);
        
        const periodo = this.formatarPeriodo(dataInicio, dataFim);
        const totais = this.calcularTotais(dadosQuinzena);
        const cabecalho = await this.gerarCabecalhoRelatorio('RELATÓRIO DE QUINZENA', periodo);
        
        // ✅ CORREÇÃO CRÍTICA: Calcular totais EXATAMENTE como nas colunas da tabela
        console.log('🧮 Calculando totais exatos para cada coluna...');
        
        const totaisBase = dadosQuinzena.reduce((acc, l) => {
            const valor = window.FolhaUtils.getSalarioBaseDisplay(l);
            console.log(`📊 Base ${((l && l.funcionario && l.funcionario.nome) || '')}: ${valor}`);
            return acc + valor;
        }, 0);
        
        const totaisQuinzena = dadosQuinzena.reduce((acc, l) => {
            const valor = window.FolhaUtils.calcularValorQuinzena(l);
            console.log(`📊 Quinzena ${((l && l.funcionario && l.funcionario.nome) || '')}: ${valor}`);
            return acc + valor;
        }, 0);
        
        const totaisAdicionais = dadosQuinzena.reduce((acc, l) => {
            const valor = window.FolhaUtils.calcularAcrescimosDisplay(l);
            console.log(`📊 Acréscimos ${((l && l.funcionario && l.funcionario.nome) || '')}: ${valor}`);
            return acc + valor;
        }, 0);
        
        const totaisDescontos = dadosQuinzena.reduce((acc, l) => {
            const valor = window.FolhaUtils.calcularDescontosDisplay(l);
            console.log(`📊 Descontos ${((l && l.funcionario && l.funcionario.nome) || '')}: ${valor}`);
            return acc + valor;
        }, 0);
        
        const totaisLiquido = dadosQuinzena.reduce((acc, l) => {
            const valor = window.FolhaUtils.calcularSalarioLiquidoDisplay(l);
            console.log(`📊 Líquido ${((l && l.funcionario && l.funcionario.nome) || '')}: ${valor}`);
            return acc + valor;
        }, 0);
        
        console.log('🧮 TOTAIS CALCULADOS:');
        console.log(`📊 Total Base: ${totaisBase.toFixed(2)}`);
        console.log(`📊 Total Quinzena: ${totaisQuinzena.toFixed(2)}`);
        console.log(`📊 Total Acréscimos: ${totaisAdicionais.toFixed(2)}`);
        console.log(`📊 Total Descontos: ${totaisDescontos.toFixed(2)}`);
        console.log(`📊 Total Líquido: ${totaisLiquido.toFixed(2)}`);
        
        return `
            <div class="relatorio-container">
                ${cabecalho}
                
                <table class="relatorio-table">
                    <thead>
                        <tr>
                            <th>Funcionário</th>
                            <th>Cargo</th>
                            <th>Forma Pgto.</th>
                            <th>Período</th>
                            <th>Percentual</th>
                            <th>Valor Base</th>
                            <th>Valor Quinzena</th>
                            <th>Acréscimos</th>
                            <th>Descontos</th>
                            <th>Valor Líquido</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dadosQuinzena.map(lancamento => {
                            const funcionario = this.getFuncionarioDetalhado(lancamento);
                            const formaPgto = (window.FolhaUtils && typeof window.FolhaUtils.formatarFormaPagamentoDetalhada === 'function')
                                ? window.FolhaUtils.formatarFormaPagamentoDetalhada(funcionario)
                                : (funcionario.formaPagamento || '-');
                            return `
                                <tr>
                                    <td>${(funcionario.nome || 'N/A')}</td>
                                    <td>${(funcionario.cargo || 'N/A')}</td>
                                    <td>${formaPgto}</td>
                                    <td>${this.formatMesAno(lancamento.mesAno)}</td>
                                    <td>${this.getPercentualDisplay(lancamento)}</td>
                                    <td>R$ ${window.FolhaUtils.getSalarioBaseDisplay(lancamento).toFixed(2).replace('.', ',')}</td>
                                    <td>R$ ${window.FolhaUtils.calcularValorQuinzena(lancamento).toFixed(2).replace('.', ',')}</td>
                                    <td>R$ ${window.FolhaUtils.calcularAcrescimosDisplay(lancamento).toFixed(2).replace('.', ',')}</td>
                                    <td>R$ ${window.FolhaUtils.calcularDescontosDisplay(lancamento).toFixed(2).replace('.', ',')}</td>
                                    <td><strong>${window.FolhaUtils.formatarMoeda(window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento))}</strong></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                
                <!-- ✅ TOTAIS MOVIDOS PARA SEÇÃO SEPARADA (ÚLTIMA PÁGINA) -->
                <div class="totais-gerais" style="page-break-before: always; margin-top: 40px;">
                    <h3 style="text-align: center; margin-bottom: 30px; color: #2c3e50;">TOTAIS GERAIS DO RELATÓRIO</h3>
                    
                    <table class="totais-table" style="width: 100%; border-collapse: collapse; margin: 0 auto; max-width: 800px;">
                        <thead>
                            <tr style="background-color: #34495e; color: white;">
                                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Descrição</th>
                                <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total Valor Base</td>
                                <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">R$ ${totaisBase.toFixed(2).replace('.', ',')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total 1° Quinzena</td>
                                <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">R$ ${totaisQuinzena.toFixed(2).replace('.', ',')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total Acréscimos</td>
                                <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">R$ ${totaisAdicionais.toFixed(2).replace('.', ',')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total Descontos</td>
                                <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">R$ ${totaisDescontos.toFixed(2).replace('.', ',')}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">Total 2° Quinzena</td>
                                <td style="padding: 10px; border: 1px solid #ddd; text-align: right; font-weight: bold;">R$ ${totaisLiquido.toFixed(2).replace('.', ',')}</td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <div style="margin-top: 30px; text-align: center; color: #7f8c8d;">
                        <p><strong>Total de Quinzenas:</strong> ${dadosQuinzena.length}</p>
                        <p><strong>Funcionários Contemplados:</strong> ${this.contarFuncionariosUnicos(dadosQuinzena)}</p>
                        <p><strong>Período:</strong> ${periodo}</p>
                    </div>
                </div>
                
                ${this.gerarRodapeRelatorio()}
            </div>
        `;
    }

    async gerarRelatorioFechamentoComAbatimento(dados, dataInicio, dataFim) {
        const dadosMes = dados.filter(d => (d.tipo || d.tipoPagamento) === 'mes');
        const periodo = this.formatarPeriodo(dataInicio, dataFim);
        const cabecalho = await this.gerarCabecalhoRelatorio('RELATÓRIO DE FECHAMENTO (COM ABATIMENTO)', periodo);
        
        // Calcular totais gerais usando funções padronizadas
        const totaisBruto = dadosMes.reduce((acc, l) => acc + (((l && l.valores && l.valores.bruto) || (l && l.calculos && l.calculos.salarioBruto) || 0)), 0);
        const totaisINSS = dadosMes.reduce((acc, l) => acc + (((l && l.valores && l.valores.descontos && l.valores.descontos.inss) || 0)), 0);
        const totaisSindicato = dadosMes.reduce((acc, l) => acc + (((l && l.valores && l.valores.descontos && l.valores.descontos.sindicato) || 0)), 0);
        const totaisDescontosOutros = dadosMes.reduce((acc, l) => {
            // Preferir valor monetário de faltas
            const calc = l.calculos || {};
            const calcInner = calc.calculos || calc;
            const descontoFaltasMonetario = Number(((calcInner && calcInner.descontoFaltas) || (l && l.valores && l.valores.descontos && l.valores.descontos.faltas) || 0)) || 0;
            const totalVales = this.calcularTotalValesLancamento(l);
            const diretos = totalVales + (l.outrosDescontos || 0) + descontoFaltasMonetario +
                            (l.descontoRepousoRemunerado || 0) + (l.descontoINSSManual || 0) +
                            (l.contribuicaoConfederativa || 0) + (l.contribuicaoSindical || 0) +
                            (l.descontoIRPJ || 0) + (l.emprestimoConsignado || 0);
            const aninhados = (totalVales + ((l && l.valores && l.valores.descontos && l.valores.descontos.outros) || 0) + descontoFaltasMonetario);
            return acc + (diretos || aninhados || 0);
        }, 0);
        const totaisAbatimento = dadosMes.reduce((acc, l) => acc + (((l && l.fechamento && l.fechamento.abatimentos && l.fechamento.abatimentos.quinzenaPago) || 0)), 0);
        const totaisLiquido = dadosMes.reduce((acc, l) => acc + (((l && l.fechamento && l.fechamento.saldoFinalLiquido) || (l && l.valores && l.valores.liquido) || (l && l.calculos && l.calculos.salarioLiquido) || 0)), 0);
        
        return `
            <div class="relatorio-container">
                ${cabecalho}
                <table class="relatorio-table">
                    <thead>
                        <tr>
                            <th>Funcionário</th>
                            <th>Cargo</th>
                            <th>Forma Pgto.</th>
                            <th>Período</th>
                            <th>Bruto (inclui Assid.)</th>
                            <th>INSS</th>
                            <th>Sindicato</th>
                            <th>Descontos</th>
                            <th>(-) Quinzenas</th>
                            <th>= Saldo Líquido</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dadosMes.map(l => {
                            const bruto = ((l && l.valores && l.valores.bruto) || (l && l.calculos && l.calculos.salarioBruto) || 0);
                            const inss = ((l && l.valores && l.valores.descontos && l.valores.descontos.inss) || 0);
                            const sindicato = ((l && l.valores && l.valores.descontos && l.valores.descontos.sindicato) || 0);
                            const descontosOutros = (this.calcularTotalValesLancamento(l) + ((l && l.valores && l.valores.descontos && l.valores.descontos.outros) || 0) + (((l && l.calculos && l.calculos.calculos && l.calculos.calculos.descontoFaltas) || (l && l.calculos && l.calculos.descontoFaltas) || (l && l.valores && l.valores.descontos && l.valores.descontos.faltas) || 0)));
                            const abat = ((l && l.fechamento && l.fechamento.abatimentos && l.fechamento.abatimentos.quinzenaPago) || 0);
                            const saldo = (((l && l.fechamento && l.fechamento.saldoFinalLiquido) || (l && l.valores && l.valores.liquido) || (l && l.calculos && l.calculos.salarioLiquido) || 0));
                            const funcionario = this.getFuncionarioDetalhado(l);
                            const formaPgto = (window.FolhaUtils && typeof window.FolhaUtils.formatarFormaPagamentoDetalhada === 'function')
                                ? window.FolhaUtils.formatarFormaPagamentoDetalhada(funcionario)
                                : (funcionario.formaPagamento || '-');
                            return `
                                <tr>
                                    <td>${(funcionario.nome || 'N/A')}</td>
                                    <td>${(funcionario.cargo || 'N/A')}</td>
                                    <td>${formaPgto}</td>
                                    <td>${this.formatMesAno(l.mesAno)}</td>
                                    <td>R$ ${bruto.toFixed(2).replace('.', ',')}</td>
                                    <td>R$ ${inss.toFixed(2).replace('.', ',')}</td>
                                    <td>R$ ${sindicato.toFixed(2).replace('.', ',')}</td>
                                    <td>R$ ${descontosOutros.toFixed(2).replace('.', ',')}</td>
                                    <td>R$ ${abat.toFixed(2).replace('.', ',')}</td>
                                    <td><strong>R$ ${saldo.toFixed(2).replace('.', ',')}</strong></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="4"><strong>TOTAIS GERAIS:</strong></td>
                            <td><strong>R$ ${totaisBruto.toFixed(2).replace('.', ',')}</strong></td>
                            <td><strong>R$ ${totaisINSS.toFixed(2).replace('.', ',')}</strong></td>
                            <td><strong>R$ ${totaisSindicato.toFixed(2).replace('.', ',')}</strong></td>
                            <td><strong>R$ ${totaisDescontosOutros.toFixed(2).replace('.', ',')}</strong></td>
                            <td><strong>R$ ${totaisAbatimento.toFixed(2).replace('.', ',')}</strong></td>
                            <td><strong>R$ ${totaisLiquido.toFixed(2).replace('.', ',')}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                ${this.gerarRodapeRelatorio()}
            </div>
        `;
    }

    async gerarRelatorioSimples(dados, dataInicio, dataFim, { tipo } = {}) {
        const filtro = tipo ? dados.filter(d => (d.tipo || d.tipoPagamento) === tipo) : dados;
        const periodo = this.formatarPeriodo(dataInicio, dataFim);
        const cabecalho = await this.gerarCabecalhoRelatorio('RELATÓRIO SIMPLES', periodo);
        
        // Calcular total geral usando função padronizada
        const totalGeral = filtro.reduce((acc, l) => {
            const isQz = (l.tipo || l.tipoPagamento) === 'quinzena';
            const valor = isQz ? window.FolhaUtils.calcularSalarioLiquidoDisplay(l) : (((l && l.fechamento && l.fechamento.saldoFinalLiquido) || window.FolhaUtils.calcularSalarioLiquidoDisplay(l)));
            return acc + valor;
        }, 0);
        
        return `
            <div class="relatorio-container">
                ${cabecalho}
                <table class="relatorio-table">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Cargo</th>
                            <th>Forma Pgto.</th>
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtro.map(l => {
                            const isQz = (l.tipo || l.tipoPagamento) === 'quinzena';
                            const valor = isQz ? window.FolhaUtils.calcularSalarioLiquidoDisplay(l) : (((l && l.fechamento && l.fechamento.saldoFinalLiquido) || window.FolhaUtils.calcularSalarioLiquidoDisplay(l)));
                            const funcionario = this.getFuncionarioDetalhado(l);
                            const formaPgto = (window.FolhaUtils && typeof window.FolhaUtils.formatarFormaPagamentoDetalhada === 'function')
                                ? window.FolhaUtils.formatarFormaPagamentoDetalhada(funcionario)
                                : (funcionario.formaPagamento || '-');
                            return `
                                <tr>
                                    <td>${(funcionario.nome || 'N/A')}</td>
                                    <td>${(funcionario.cargo || 'N/A')}</td>
                                    <td>${formaPgto}</td>
                                    <td><strong>R$ ${valor.toFixed(2).replace('.', ',')}</strong></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="3"><strong>TOTAL GERAL:</strong></td>
                            <td><strong>R$ ${totalGeral.toFixed(2).replace('.', ',')}</strong></td>
                        </tr>
                    </tfoot>
                </table>
                ${this.gerarRodapeRelatorio()}
            </div>
        `;
    }
    
    /**
     * 🏢 GERAR CABEÇALHO DO RELATÓRIO
     */
    async gerarCabecalhoRelatorio(titulo, periodo) {
        // Obter dados dinâmicos da empresa
        const empresa = await this.obterDadosEmpresa();
        
        return `
            <div class="header">
                <div class="logo">
                    ${empresa.logo && empresa.logo.trim() !== '' ? 
                        `<img src="${empresa.logo}" alt="Logo da Empresa" />` : 
                        `<svg viewBox="0 0 100 100" style="width: 80px; height: 80px;">
                            <circle cx="50" cy="50" r="45" fill="#2c3e50" stroke="#34495e" stroke-width="2"/>
                            <text x="50" y="60" text-anchor="middle" fill="white" font-size="24" font-weight="bold">JN</text>
                        </svg>`
                    }
                </div>
                <div class="company-info">
                    <div class="company-name">${empresa.nome || empresa.name}</div>
                    <div class="company-details">CNPJ: ${empresa.cnpj}</div>
                    <div class="company-details">${empresa.endereco || empresa.address}</div>
                    <div class="company-details">${empresa.cidade || empresa.city} - ${empresa.estado || empresa.state}</div>
                    <div class="company-details">Fone: ${empresa.telefone || empresa.phone}</div>
                    ${empresa.email ? `<div class="company-details">Email: ${empresa.email}</div>` : ''}
                </div>
            </div>
            
            <div class="title">${titulo}${periodo ? ` - ${periodo}` : ''}</div>
            <div class="subtitle">Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}</div>
        `;
    }
    
    /**
     * 🦶 GERAR RODAPÉ DO RELATÓRIO
     */
    gerarRodapeRelatorio() {
        return `
            <div class="relatorio-footer">
                <div class="assinaturas">
                    <div class="assinatura">
                        <div class="linha-assinatura"></div>
                        <p>Responsável pela Folha</p>
                    </div>
                    <div class="assinatura">
                        <div class="linha-assinatura"></div>
                        <p>Diretor Financeiro</p>
                    </div>
                </div>
                
                <div class="info-sistema">
                    <p>Sistema de Folha de Pagamento - SisWeb</p>
                    <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>
        `;
    }
    
    /**
     * 🎨 GERAR LOGO SVG PADRÃO
     */
    gerarLogoSvgPadrao() {
        return `
            <svg width="80" height="80" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="45" fill="#2c3e50" stroke="#3498db" stroke-width="2"/>
                <text x="50" y="35" text-anchor="middle" fill="white" font-size="14" font-weight="bold">SisWeb</text>
                <text x="50" y="55" text-anchor="middle" fill="#3498db" font-size="10">SINDICATO</text>
                <text x="50" y="70" text-anchor="middle" fill="#3498db" font-size="8">MINERAÇÃO</text>
            </svg>
        `;
    }
    
    /**
     * 📊 GERAR LINHA DO RELATÓRIO
     */
    gerarLinhaRelatorio(lancamento) {
        const tipoPagamento = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
            ? window.FolhaUtils.resolveTipoPagamento(lancamento)
            : (String((lancamento && (lancamento.tipoPagamento || lancamento.tipo || lancamento.tipoFolha)) || 'mes').toLowerCase().includes('quinz') ? 'quinzena' : 'mes');
        const percentualQuinzena = lancamento.quinzenaPercentual || lancamento.percentualQuinzena || (tipoPagamento === 'quinzena' ? 50 : 100);
        const valorQuinzena = window.FolhaUtils.calcularValorQuinzena(lancamento);
        const acrescimos = window.FolhaUtils.calcularAcrescimosDisplay(lancamento);
        const descontos = window.FolhaUtils.calcularDescontosDisplay(lancamento);
        const salarioLiquido = window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento);

        // Tornar a linha adaptativa: incluir um botão para relatório detalhado do lançamento
        const id = lancamento.id || lancamento.key || '';
        const btnImprimir = id ? `<button class="mini-print" data-id="${id}"><i class="fas fa-print"></i></button>` : '';

        const funcionario = this.getFuncionarioDetalhado(lancamento);
        const formaPgto = (window.FolhaUtils && typeof window.FolhaUtils.formatarFormaPagamentoDetalhada === 'function')
            ? window.FolhaUtils.formatarFormaPagamentoDetalhada(funcionario)
            : (funcionario.formaPagamento || '-');
        return `
            <tr>
                <td>${(funcionario.nome || 'N/A')} ${btnImprimir}</td>
                <td>${(funcionario.cargo || 'N/A')}</td>
                <td>${formaPgto}</td>
                <td>${this.formatMesAno(lancamento.mesAno)}</td>
                <td>
                    <span class="badge-tipo ${tipoPagamento}">
                        ${tipoPagamento === 'quinzena' ? 'Quinzena' : 'Mês Fechado'}
                    </span>
                </td>
                <td>${percentualQuinzena}%</td>
                <td>R$ ${window.FolhaUtils.getSalarioBaseDisplay(lancamento).toFixed(2).replace('.', ',')}</td>
                <td>R$ ${valorQuinzena.toFixed(2).replace('.', ',')}</td>
                <td>R$ ${acrescimos.toFixed(2).replace('.', ',')}</td>
                <td>R$ ${descontos.toFixed(2).replace('.', ',')}</td>
                <td>R$ ${Number(this.calcularTotalValesLancamento(lancamento) || 0).toFixed(2).replace('.', ',')}</td>
                <td><strong>R$ ${salarioLiquido.toFixed(2).replace('.', ',')}</strong></td>
            </tr>
        `;
    }
    
    /**
     * 🧮 CALCULAR TOTAIS (CORRIGIDO - USA FUNÇÕES PADRONIZADAS)
     */
    calcularTotais(dados) {
        return dados.reduce((acc, lancamento) => {
            const calculos = lancamento.calculos || {};
            return {
                bruto: acc.bruto + (calculos.salarioBruto || 0),
                descontos: acc.descontos + window.FolhaUtils.calcularDescontosDisplay(lancamento),
                liquido: acc.liquido + window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento)
            };
        }, { bruto: 0, descontos: 0, liquido: 0 });
    }
    
    /**
     * 🔢 SOMAR CAMPO ESPECÍFICO (CORRIGIDO - USA FUNÇÕES PADRONIZADAS)
     */
    somarCampo(dados, campo) {
        return dados.reduce((acc, lancamento) => {
            const calculos = lancamento.calculos || {};
            switch (campo) {
                case 'salarioBase':
                    // Mantido para compat; não usado no tfoot principal
                    return acc + (calculos.salarioBase || 0);
                case 'salarioBaseDisplay':
                    // Usado no TOTAIS GERAIS do relatório: respeita toggle para quinzena
                    return acc + window.FolhaUtils.getSalarioBaseDisplay(lancamento);
                case 'quinzena':
                    return acc + window.FolhaUtils.calcularValorQuinzena(lancamento);
                case 'acrescimos':
                    return acc + window.FolhaUtils.calcularAcrescimosDisplay(lancamento);
                case 'descontos':
                    return acc + window.FolhaUtils.calcularDescontosDisplay(lancamento);
                case 'liquido':
                    return acc + window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento);
                case 'vales':
                    return acc + this.calcularTotalValesLancamento(lancamento);
                case 'adicionais':
                    return acc + this.calcularAdicionais(lancamento);
                default:
                    return acc;
            }
        }, 0);
    }
    
    /**
     * 💰 CALCULAR ADICIONAIS
     */
    calcularAdicionais(lancamento) {
        const calculos = lancamento.calculos || {};
        const calculosAninhados = (calculos && calculos.calculos) || {};
        // Somatório de todos acréscimos: horas extras, bonificações, periculosidade, adicional noturno, insalubridade, salário família
        return (
            (calculos.valorHorasExtras || 0) +
            (lancamento.bonificacoes || calculos.bonificacoes || 0) +
            (calculos.valorPericulosidade || 0) +
            (calculos.valorAdicionalNoturno || 0) +
            (calculos.valorInsalubridade || 0) +
            (calculos.valorSalarioFamilia || 0)
        );
    }
    
    /**
     * 📅 CALCULAR VALOR QUINZENA
     */
    calcularValorQuinzena(lancamento) {
        if (lancamento.tipoPagamento !== 'quinzena') return 0;
        
        if (lancamento.quinzenaValorManual) {
            return lancamento.quinzenaValorManual;
        }
        
        const salarioBase = ((lancamento && lancamento.calculos && lancamento.calculos.salarioBase) || 0);
        const percentual = lancamento.quinzenaPercentual || 50;
        return salarioBase * (percentual / 100);
    }
    
    /**
     * 👥 CONTAR FUNCIONÁRIOS ÚNICOS
     */
    contarFuncionariosUnicos(dados) {
        const funcionariosUnicos = new Set();
        dados.forEach(lancamento => {
            if (lancamento && lancamento.funcionario && lancamento.funcionario.id) {
                funcionariosUnicos.add(lancamento.funcionario.id);
            }
        });
        return funcionariosUnicos.size;
    }
    
    /**
     * 📅 FORMATAR PERÍODO
     */
    formatarPeriodo(dataInicio, dataFim) {
        const inicio = this.formatMesAno(dataInicio);
        const fim = this.formatMesAno(dataFim);
        return inicio === fim ? inicio : `${inicio} a ${fim}`;
    }
    
    /**
     * 📅 FORMATAR MÊS/ANO
     */
    formatMesAno(mesAno) {
        if (!mesAno) return 'N/A';
        const [ano, mes] = mesAno.split('-');
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return `${meses[parseInt(mes) - 1]} ${ano}`;
    }
    
    /**
     * 📊 OBTER DISPLAY DO PERCENTUAL
     */
    getPercentualDisplay(lancamento) {
        const tipoPagamento = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
            ? window.FolhaUtils.resolveTipoPagamento(lancamento)
            : (String((lancamento && (lancamento.tipoPagamento || lancamento.tipo || lancamento.tipoFolha)) || 'mes').toLowerCase().includes('quinz') ? 'quinzena' : 'mes');
        if (tipoPagamento === 'quinzena') {
            if (lancamento.quinzenaValorManual) {
                return 'Manual';
            }
            const p = lancamento.percentualQuinzena ?? lancamento.quinzenaPercentual ?? 50;
            return `${p}%`;
        }
        return '100%';
    }

    normalizeRelatorioPrintOptions(options = {}) {
        const rawOrientation = String((options && options.orientation) || '').toLowerCase();
        const orientation = rawOrientation === 'landscape' ? 'landscape' : 'portrait';
        const margin = (options && options.margin) || (orientation === 'landscape' ? '9mm' : '12mm');
        const pageWidthPx = orientation === 'landscape' ? 1122 : 793;
        return { orientation, margin, pageWidthPx };
    }

    getRelatorioDefaultOrientation(tipoRelatorio = '') {
        const tipo = String(tipoRelatorio || '').toLowerCase();
        const relatoriosLargos = new Set([
            'completo',
            'quinzena',
            'mensal',
            'anual',
            'fechamento',
            'provisao_rescisao_detalhada',
            'extrato_bh'
        ]);
        return relatoriosLargos.has(tipo) ? 'landscape' : 'portrait';
    }

    getRelatorioPrintOptions(tipoRelatorio = '') {
        const select = document.getElementById('relatorioOrientacaoImpressao');
        const raw = String((select && select.value) || 'auto').toLowerCase();
        const orientation = raw === 'portrait' || raw === 'landscape'
            ? raw
            : this.getRelatorioDefaultOrientation(tipoRelatorio);
        return this.normalizeRelatorioPrintOptions({ orientation });
    }

    getRelatorioOrientationOverrideCSS(printOptions = {}) {
        const options = this.normalizeRelatorioPrintOptions(printOptions);
        const pageRule = printOptions && printOptions.omitPageSize
            ? `@page { margin: ${options.margin}; }`
            : `@page { size: A4 ${options.orientation}; margin: ${options.margin}; }`;
        return `
            html {
                --relatorio-page-width-px: ${options.pageWidthPx};
                --relatorio-print-margin: ${options.margin};
            }
            html[data-print-orientation="${options.orientation}"] .relatorio-container {
                max-width: 100%;
            }
            @media print {
                ${pageRule}
                html[data-print-orientation="${options.orientation}"] .relatorio-container {
                    max-width: 100%;
                }
            }
        `;
    }

    applyRelatorioPrintAttributes(html, tipoRelatorio = '', printOptions = null) {
        const options = printOptions ? this.normalizeRelatorioPrintOptions(printOptions) : null;
        try {
            return String(html || '').replace(/<html(\s[^>]*)?>/i, (match) => {
                const attrs = [];
                if (tipoRelatorio && !/data-report-type=/i.test(match)) {
                    attrs.push(`data-report-type="${String(tipoRelatorio).replace(/"/g, '&quot;')}"`);
                }
                if (options && !/data-print-orientation=/i.test(match)) {
                    attrs.push(`data-print-orientation="${options.orientation}"`);
                }
                if (!attrs.length) return match;
                return match.replace(/>$/, ` ${attrs.join(' ')}>`);
            });
        } catch (_) {
            return html;
        }
    }
    
    /**
     * 📤 EXPORTAR RELATÓRIO
     */
    async exportarRelatorio(relatorioHTML, formato, tipoRelatorio) {
        const periodoTag = `${(((document.getElementById('dataInicio') && document.getElementById('dataInicio').value) || '').replace('-', ''))}-${(((document.getElementById('dataFim') && document.getElementById('dataFim').value) || '').replace('-', ''))}`;
        // Personalização de nome para recibo de horas extras
        const slugify = (str = '') => {
            return String(str)
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remover acentos
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .substring(0, 60);
        };

        let nomeArquivo = `${tipoRelatorio}_${periodoTag || new Date().toISOString().split('T')[0]}`;
        if (tipoRelatorio === 'recibo_horas_extras') {
            const todosAtivos = !!(document.getElementById('todosFuncionariosAtivos') && document.getElementById('todosFuncionariosAtivos').checked);
            const nomeFuncionario = ((document.getElementById('funcionario') && document.getElementById('funcionario').value) || '').trim();
            if (todosAtivos) {
                nomeArquivo = `recibo_horas_extras_todos_ativos_${periodoTag}`;
            } else if (nomeFuncionario) {
                nomeArquivo = `recibo_horas_extras_${slugify(nomeFuncionario)}_${periodoTag}`;
            } else {
                nomeArquivo = `recibo_horas_extras_${periodoTag}`;
            }
        }

        const printOptions = this.getRelatorioPrintOptions(tipoRelatorio);

        switch (formato) {
            case 'print':
                // Título customizado para recibo de horas extras
                const titulo = tipoRelatorio === 'recibo_horas_extras' ? 'Recibo de Pagamento - Horas Extras' : 'Relatório - SisWeb';
                this.imprimirRelatorio(relatorioHTML, titulo, tipoRelatorio, printOptions);
                break;
            case 'pdf':
                await this.exportarPDF(relatorioHTML, nomeArquivo, tipoRelatorio, printOptions);
                break;
            case 'excel':
                this.exportarExcel(relatorioHTML, nomeArquivo);
                break;
            default:
                throw new Error('Formato de exportação não suportado');
        }
    }
    
    /**
     * 🖨️ IMPRIMIR RELATÓRIO
     */
    imprimirRelatorio(relatorioHTML, tituloCustomizado = 'Relatório - SisWeb', tipoRelatorio = '', printOptions = null) {
        const isLikelyReciboDoc = tipoRelatorio === 'recibo' || /id=["']recibo-content["']/i.test(String(relatorioHTML || '')) || /\brecibo-page\b/i.test(String(relatorioHTML || ''));
        const printWindow = window.open('', '_blank');
        if (!printWindow || !printWindow.document) {
            console.error('❌ Erro ao abrir janela de impressão');
            this.showNotification('Erro ao abrir janela de impressão. Verifique se popups estão bloqueados.', 'error');
            return;
        }

        const resolvedPrintOptions = printOptions ? this.normalizeRelatorioPrintOptions(printOptions) : null;
        const commonCssOptions = isLikelyReciboDoc
            ? { ...(resolvedPrintOptions || {}), omitPageSize: true }
            : (resolvedPrintOptions || undefined);
        const commonCss = this.getRelatorioCSS(commonCssOptions);
        const orientationCss = resolvedPrintOptions
            ? this.getRelatorioOrientationOverrideCSS({ ...resolvedPrintOptions, omitPageSize: isLikelyReciboDoc })
            : '';

        // Detectar se o HTML já é um documento completo
        const isFullDoc = /<html[\s>]/i.test(relatorioHTML) || /<!DOCTYPE/i.test(relatorioHTML);
        let finalHTML = '';
        if (isFullDoc) {
            // Injetar CSS comum e título dentro do <head> do documento gerado
            finalHTML = relatorioHTML.replace(/<head>/i, `<head><title>${tituloCustomizado}</title><link rel="stylesheet" href="../print-styles.css"><style>${commonCss}</style>`);
            if (orientationCss) {
                finalHTML = finalHTML.replace(/<\/head>/i, `<style>${orientationCss}</style></head>`);
            }
        } else {
            const htmlAttrs = [
                tipoRelatorio ? `data-report-type="${String(tipoRelatorio).replace(/"/g, '&quot;')}"` : '',
                resolvedPrintOptions ? `data-print-orientation="${resolvedPrintOptions.orientation}"` : ''
            ].filter(Boolean).join(' ');
            finalHTML = `<!DOCTYPE html><html${htmlAttrs ? ` ${htmlAttrs}` : ''}><head><title>${tituloCustomizado}</title><link rel="stylesheet" href="../print-styles.css"><style>${commonCss}${orientationCss}</style></head><body>${relatorioHTML}</body></html>`;
        }

        finalHTML = this.applyRelatorioPrintAttributes(finalHTML, tipoRelatorio, resolvedPrintOptions);
        const isReciboDoc = tipoRelatorio === 'recibo' || /id=["']recibo-content["']/i.test(finalHTML) || /\brecibo-page\b/i.test(finalHTML);

        // Injetar script de fonte adaptativa para impressão de relatórios genéricos
        const adaptScript = this.getRelatorioAdaptivePrintScript();
        if (!isReciboDoc) {
            try {
                finalHTML = finalHTML.replace(/<\/body>/i, adaptScript + '</body>');
            } catch (e) {
                finalHTML += adaptScript;
            }
        }

        printWindow.document.open();
        printWindow.document.write(finalHTML);
        printWindow.document.close();

        // Aguardar carregamento para garantir que scripts de autoajuste e estilos apliquem antes de imprimir
        let printStarted = false;
        const onLoad = () => {
            if (printStarted) return;
            printStarted = true;
            const doc = printWindow.document;
            const waitForFonts = (() => {
                try {
                    return doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
                } catch {
                    return Promise.resolve();
                }
            })();
            const waitForImages = (() => {
                try {
                    const images = Array.from(doc.images || []);
                    return Promise.all(images.map((img) => {
                        if (img.complete) return Promise.resolve();
                        return new Promise((resolve) => {
                            img.addEventListener('load', resolve, { once: true });
                            img.addEventListener('error', resolve, { once: true });
                            setTimeout(resolve, 1200);
                        });
                    }));
                } catch {
                    return Promise.resolve();
                }
            })();
            try { printWindow.focus(); } catch {}
            try { printWindow.moveTo(0, 0); } catch {}
            try { printWindow.resizeTo(screen.availWidth || 1100, screen.availHeight || 800); } catch {}
            Promise.all([waitForFonts, waitForImages]).finally(() => setTimeout(() => {
                try { printWindow.focus(); } catch {}
                try { printWindow.print(); } catch {}
                if (!isReciboDoc) {
                    setTimeout(() => { try { printWindow.close(); } catch {} }, 1200);
                }
            }, 180));
        };
        // Nem todos os navegadores disparam load corretamente após document.write; usar ambos como fallback
        try {
            printWindow.addEventListener('load', onLoad, { once: true });
        } catch {
            // Fallback: tempo fixo
            setTimeout(onLoad, 600);
        }
        setTimeout(onLoad, 900);
    }

    getRelatorioAdaptivePrintScript(options = {}) {
        const autoPrint = !!(options && options.autoPrint);
        const autoClose = options && Object.prototype.hasOwnProperty.call(options, 'autoClose') ? !!options.autoClose : true;
        return `
        <script>(function(){
            var adaptativo = true;
            var emImpressao = false;
            var printFitTimer = null;
            try {
                var qs = new URLSearchParams(location.search);
                var ap = qs.get('adapt');
                if (typeof ap === 'string') { adaptativo = !(ap.toLowerCase() === 'false' || ap === '0'); }
            } catch (e) {}

            function setRootVar(name, value) {
                try { document.documentElement.style.setProperty(name, String(value)); } catch (e) {}
            }

            function removeRootVar(name) {
                try { document.documentElement.style.removeProperty(name); } catch (e) {}
            }

            function isLandscapeNow() {
                try {
                    var forced = String(document.documentElement.getAttribute('data-print-orientation') || '').toLowerCase();
                    if (!emImpressao && forced === 'landscape') return true;
                    if (!emImpressao && forced === 'portrait') return false;
                    return !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
                } catch (e) {}
                return false;
            }

            function marginToPx(fallback) {
                try {
                    var raw = String(getComputedStyle(document.documentElement).getPropertyValue('--relatorio-print-margin') || '').trim();
                    var n = parseFloat(raw.replace(',', '.'));
                    if (!Number.isFinite(n)) return fallback;
                    if (/cm$/i.test(raw)) return n * 37.795;
                    if (/mm$/i.test(raw)) return n * 3.7795;
                    if (/in$/i.test(raw)) return n * 96;
                    return n;
                } catch (e) {}
                return fallback;
            }

            function getPageWidth(landscape) {
                return landscape ? 1122 : 793;
            }

            function measureReportWidth(root) {
                var width = 0;
                try {
                    var tables = Array.from(root.querySelectorAll('table'));
                    tables.forEach(function(t){
                        try {
                            var w = Math.max(t.scrollWidth || 0, t.getBoundingClientRect().width || 0);
                            if (w > width) width = w;
                        } catch(e) {}
                    });
                    if (!width) {
                        var rect = root.getBoundingClientRect();
                        width = Math.max(root.scrollWidth || 0, rect.width || 0);
                    }
                } catch (e) {}
                return width;
            }

            function calcularFonteParaLargura(root, landscape) {
                var pageW = getPageWidth(landscape);
                var marginPx = marginToPx(landscape ? 34 : 45);
                var disponivelW = Math.max(1, pageW - marginPx * 2 - 2);
                setRootVar('--fs', '1');
                var width = measureReportWidth(root);
                if (!width || !disponivelW) return 1;
                var escalaW = disponivelW / width;
                if (adaptativo && escalaW < 1) {
                    return Math.max(0.72, Math.min(1, escalaW - 0.02));
                }
                return 1;
            }

            function ajustarFonteRelatorio(){
                try {
                    var root = document.querySelector('.relatorio-container') || document.body;
                    if (!root) return;
                    var portraitFs = calcularFonteParaLargura(root, false);
                    var landscapeFs = calcularFonteParaLargura(root, true);
                    setRootVar('--fs-portrait', portraitFs.toFixed(3));
                    setRootVar('--fs-landscape', landscapeFs.toFixed(3));
                    if (emImpressao) {
                        removeRootVar('--fs');
                    } else {
                        setRootVar('--fs', (isLandscapeNow() ? landscapeFs : portraitFs).toFixed(3));
                    }
                } catch (e) {}
            }

            function scheduleFit() {
                ajustarFonteRelatorio();
                setTimeout(ajustarFonteRelatorio, 80);
                setTimeout(ajustarFonteRelatorio, 220);
            }

            function startPrintFitLoop() {
                stopPrintFitLoop();
                printFitTimer = setInterval(ajustarFonteRelatorio, 450);
            }

            function stopPrintFitLoop() {
                if (printFitTimer) {
                    clearInterval(printFitTimer);
                    printFitTimer = null;
                }
            }

            function onBeforePrint(){
                emImpressao = true;
                scheduleFit();
                startPrintFitLoop();
                try { if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function(){ setTimeout(scheduleFit, 60); }); } } catch(e){}
            }

            function onAfterPrint(){
                emImpressao = false;
                stopPrintFitLoop();
                setRootVar('--fs', '1');
                setRootVar('--fs-portrait', '1');
                setRootVar('--fs-landscape', '1');
            }

            try {
                window.addEventListener('beforeprint', onBeforePrint);
                window.addEventListener('afterprint', onAfterPrint);
                window.addEventListener('resize', function(){ if (emImpressao) scheduleFit(); else ajustarFonteRelatorio(); });
                window.addEventListener('focus', function(){ if (emImpressao) scheduleFit(); });
                document.addEventListener('visibilitychange', function(){ if (emImpressao) scheduleFit(); });
                var printMq = window.matchMedia && window.matchMedia('print');
                if (printMq && printMq.addEventListener) {
                    printMq.addEventListener('change', function(e){ if (e.matches) onBeforePrint(); else onAfterPrint(); });
                }
            } catch(e){}
            setTimeout(ajustarFonteRelatorio, 80);
            ${autoPrint ? `
            window.onload = function() {
                setTimeout(function() {
                    try { window.focus(); } catch(e) {}
                    onBeforePrint();
                    setTimeout(function() {
                        try { window.focus(); } catch(e) {}
                        try { window.print(); } catch(e) {}
                        ${autoClose ? `setTimeout(function() { try { window.close(); } catch(e) {} }, 1000);` : ''}
                    }, 180);
                }, 500);
            };` : ''}
        })();</script>`;
    }
    
    /**
     * 📄 EXPORTAR PDF
     */
    async exportarPDF(relatorioHTML, nomeArquivo, tipoRelatorio = '', printOptions = null) {
        try {
            console.log('📄 Iniciando geração de PDF...');
            
            // ✅ MÉTODO: Usar window.print() com CSS que incorpora estilos do relatório
            const printWindow = window.open('', '_blank');
            const resolvedPrintOptions = printOptions ? this.normalizeRelatorioPrintOptions(printOptions) : this.normalizeRelatorioPrintOptions({ orientation: this.getRelatorioDefaultOrientation(tipoRelatorio) });
            const orientationCss = this.getRelatorioOrientationOverrideCSS(resolvedPrintOptions);

            // Detectar se o HTML contém um documento completo
            const isFullDoc = /<html[\s>]/i.test(relatorioHTML) || /<!DOCTYPE/i.test(relatorioHTML);
            // Extrair estilos embutidos do HTML gerado (quando houver)
            const embeddedStyleBlocks = (relatorioHTML.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [])
                .map((block) => String(block)
                    .replace(/<style[^>]*>/i, '')
                    .replace(/<\/style>/i, '')
                )
                .join('\n')
                .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD]/g, '');
            // Extrair conteúdo do body se o HTML for documento completo
            const bodyMatch = relatorioHTML.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            const bodyContent = isFullDoc ? (bodyMatch ? bodyMatch[1] : relatorioHTML) : relatorioHTML;

            // ✅ Estilos de impressão acrescentando regras para cores em PDF
            const cssEstilos = `
                <style>
                    ${this.getRelatorioCSS(resolvedPrintOptions)}
                    /* Estilos embutidos do recibo (preservar layout e cores) */
                    ${embeddedStyleBlocks}
                    ${orientationCss}
                    @media print {
                        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
                        .relatorio-container { max-width: 100%; }
                        /* Garantir cores exatas em cabeçalhos e linhas finais */
                        .detalhes-table th { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                        .total-final { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
                        @page { size: A4 ${resolvedPrintOptions.orientation}; margin: ${resolvedPrintOptions.margin}; }
                    }
                </style>
            `;

            const finalDoc = `
                <!DOCTYPE html>
                <html${tipoRelatorio ? ` data-report-type="${String(tipoRelatorio).replace(/"/g, '&quot;')}"` : ''} data-print-orientation="${resolvedPrintOptions.orientation}">
                <head>
                    <title>Relatório - ${nomeArquivo}</title>
                    <meta charset="utf-8">
                    ${cssEstilos}
                </head>
                <body>
                    ${bodyContent}
                    ${this.getRelatorioAdaptivePrintScript({ autoPrint: true, autoClose: true })}
                </body>
                </html>
            `;

            printWindow.document.open();
            printWindow.document.write(finalDoc);
            printWindow.document.close();
            
            console.log('✅ PDF gerado com sucesso (print com estilos incorporados)');
            
        } catch (error) {
            console.error('❌ Erro ao gerar PDF:', error);
            throw new Error('Erro ao gerar PDF: ' + error.message);
        }
    }
    
    /**
     * 📊 EXPORTAR EXCEL
     */
    exportarExcel(relatorioHTML, nomeArquivo) {
        try {
            console.log('📊 Iniciando geração de Excel...');
            
            // Extrair dados da tabela principal
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = relatorioHTML;
            
            // Suportar diferentes layouts: usar .relatorio-table, depois .detalhes-table, senão primeira <table>
            let table = tempDiv.querySelector('.relatorio-table');
            if (!table) table = tempDiv.querySelector('.detalhes-table');
            if (!table) table = tempDiv.querySelector('table');
            if (!table) {
                throw new Error('Tabela não encontrada no relatório');
            }
            
            // ✅ MELHORAR: Gerar Excel real com formatação
            let excelContent = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="utf-8">
                    <meta name="ProgId" content="Excel.Sheet">
                    <meta name="Generator" content="Microsoft Excel 15">
                    <style>
                        .header { font-weight: bold; background-color: #4472C4; color: white; }
                        .currency { mso-number-format: "R$ #,##0.00"; text-align: right; }
                        .total-row { font-weight: bold; background-color: #E7E6E6; }
                        table { border-collapse: collapse; width: 100%; }
                        td, th { border: 1px solid #000; padding: 5px; }
                    </style>
                </head>
                <body>
                    <table>
                        <tr class="header">
                            <td colspan="9" style="text-align: center; font-size: 16px;">${nomeArquivo}</td>
                        </tr>
                        <tr><td colspan="9"></td></tr>
            `;
            
            // Extrair cabeçalhos
            const headers = table.querySelectorAll('thead tr th');
            if (headers.length > 0) {
                excelContent += '<tr class="header">';
                headers.forEach(header => {
                    excelContent += `<td>${header.textContent.trim()}</td>`;
                });
                excelContent += '</tr>';
            }
            
            // Extrair dados das linhas
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                excelContent += '<tr>';
                cells.forEach((cell, index) => {
                    let cellValue = cell.textContent.trim();
                    
                    // Detectar valores monetários e aplicar formatação
                    if (cellValue.startsWith('R$')) {
                        // ✅ CORREÇÃO: Manter formatação brasileira (vírgula) no Excel
                        const valorLimpo = cellValue.replace('R$', '').trim();
                        excelContent += `<td class="currency">${valorLimpo}</td>`;
                    } else {
                        excelContent += `<td>${cellValue}</td>`;
                    }
                });
                excelContent += '</tr>';
            });
            
            // Adicionar totais se existirem
            const totaisSection = tempDiv.querySelector('.totais-gerais');
            if (totaisSection) {
                const totaisTable = totaisSection.querySelector('.totais-table tbody');
                if (totaisTable) {
                    excelContent += '<tr><td colspan="9"></td></tr>';
                    excelContent += '<tr class="header"><td colspan="9" style="text-align: center;">TOTAIS GERAIS</td></tr>';
                    
                    const totaisRows = totaisTable.querySelectorAll('tr');
                    totaisRows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 2) {
                            const descricao = cells[0].textContent.trim();
                            const valor = cells[1].textContent.trim();
                            // ✅ CORREÇÃO: Manter formatação brasileira (vírgula) nos totais
                            const valorLimpo = valor.replace('R$', '').trim();
                            
                            excelContent += '<tr class="total-row">';
                            excelContent += `<td colspan="8">${descricao}</td>`;
                            excelContent += `<td class="currency">${valorLimpo}</td>`;
                            excelContent += '</tr>';
                        }
                    });
                }
            }
            
            excelContent += `
                    </table>
                </body>
                </html>
            `;
            
            // Criar e baixar arquivo Excel
            const blob = new Blob([excelContent], { 
                type: 'application/vnd.ms-excel;charset=utf-8;' 
            });
            
            const link = document.createElement('a');
            if (link.download !== undefined) {
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', `${nomeArquivo}.xls`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
            
            console.log('✅ Excel gerado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao gerar Excel:', error);
            throw new Error('Erro ao gerar Excel: ' + error.message);
        }
    }
    
    /**
     * 🎨 OBTER CSS DO RELATÓRIO
     */
    getRelatorioCSS(printOptions = {}) {
        const omitPageSize = !!(printOptions && printOptions.omitPageSize);
        const options = this.normalizeRelatorioPrintOptions(printOptions || {});
        const pageRule = omitPageSize
            ? `@page { margin: ${options.margin}; }`
            : `@page { size: A4 ${options.orientation}; margin: ${options.margin}; }`;
        return `
            :root {
                --fs: 1;
                --fs-portrait: 1;
                --fs-landscape: 1;
                --relatorio-page-width-px: ${options.pageWidthPx};
                --relatorio-print-margin: ${options.margin};
            }
            .relatorio-container {
                font-family: Arial, sans-serif;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }

            .relatorio-container { color: #111827; }

            .relatorio-container table { font-variant-numeric: tabular-nums; }

            .relatorio-container .relatorio-table,
            .relatorio-container .data-table,
            .relatorio-container .detalhes-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
            }

            .relatorio-container .relatorio-table thead th,
            .relatorio-container .data-table thead th,
            .relatorio-container .detalhes-table thead th {
                position: sticky;
                top: 0;
                z-index: 2;
                white-space: nowrap;
            }

            .relatorio-container .relatorio-table td,
            .relatorio-container .data-table td,
            .relatorio-container .detalhes-table td {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                line-height: 1.25;
            }

            .relatorio-container .relatorio-table tfoot td,
            .relatorio-container .data-table tfoot td,
            .relatorio-container .detalhes-table tfoot td,
            .relatorio-container .relatorio-table .total-row td,
            .relatorio-container .data-table .total-row td,
            .relatorio-container .detalhes-table .total-row td,
            .relatorio-container .totais-table td,
            .relatorio-container .summary-totals .value,
            .relatorio-container .summary-item .value {
                overflow: visible;
                text-overflow: clip;
                white-space: nowrap;
                word-break: normal;
                overflow-wrap: normal;
                font-variant-numeric: tabular-nums;
            }

            .relatorio-container .relatorio-table tfoot td:not(:first-child),
            .relatorio-container .data-table tfoot td:not(:first-child),
            .relatorio-container .detalhes-table tfoot td:not(:first-child),
            .relatorio-container .relatorio-table .total-row td:not(:first-child),
            .relatorio-container .data-table .total-row td:not(:first-child),
            .relatorio-container .detalhes-table .total-row td:not(:first-child),
            .relatorio-container .totais-table td:last-child,
            .relatorio-container .summary-totals .value,
            .relatorio-container .summary-item .value {
                min-width: 92px;
                text-align: right;
                font-family: 'Consolas', 'Courier New', monospace;
            }

            .relatorio-container .relatorio-table tfoot td:first-child,
            .relatorio-container .data-table tfoot td:first-child,
            .relatorio-container .detalhes-table tfoot td:first-child,
            .relatorio-container .relatorio-table .total-row td:first-child,
            .relatorio-container .data-table .total-row td:first-child,
            .relatorio-container .detalhes-table .total-row td:first-child {
                min-width: 120px;
                white-space: normal;
            }

            .relatorio-container.bh-extrato-report {
                max-width: 100%;
            }

            .relatorio-container .bh-extrato-table {
                table-layout: fixed;
                font-size: 12px;
            }

            .relatorio-container .bh-extrato-table thead th {
                white-space: normal;
                overflow-wrap: normal;
                word-break: normal;
                hyphens: auto;
                line-height: 1.15;
                text-align: center;
                vertical-align: middle;
                padding: 8px 6px;
            }

            .relatorio-container .bh-extrato-table thead th .th-sub {
                display: block;
                font-size: 0.86em;
                font-weight: 600;
            }

            .relatorio-container .bh-extrato-table td {
                padding: 7px 6px;
                vertical-align: top;
            }

            .relatorio-container .bh-extrato-table td:nth-child(1),
            .relatorio-container .bh-extrato-table td:nth-child(2),
            .relatorio-container .bh-extrato-table td:nth-child(4) {
                white-space: normal;
                overflow: visible;
                text-overflow: clip;
                overflow-wrap: anywhere;
            }

            .relatorio-container .bh-extrato-table td:nth-child(3),
            .relatorio-container .bh-extrato-table td:nth-child(5),
            .relatorio-container .bh-extrato-table td:nth-child(6),
            .relatorio-container .bh-extrato-table td:nth-child(7),
            .relatorio-container .bh-extrato-table td:nth-child(8) {
                white-space: nowrap;
            }

            .relatorio-container { overflow-x: auto; }
            
            /* Cabeçalho baseado no romaneiopct */
            .header {
                display: flex;
                margin-bottom: 20px;
                border-bottom: 2px solid #333;
                padding-bottom: 15px;
                align-items: flex-start;
            }
            
            .logo {
                width: 120px;
                text-align: center;
                margin-right: 20px;
                flex-shrink: 0;
            }
            
            .logo img {
                max-width: 100%;
                height: auto;
                max-height: 100px;
            }
            
            .logo svg {
                width: 80px;
                height: 80px;
            }
            
            .company-info {
                flex: 1;
                padding-left: 15px;
            }
            
            .company-name {
                font-size: 20px;
                font-weight: bold;
                margin-bottom: 8px;
                color: #2c3e50;
                text-transform: uppercase;
            }
            
            .company-details {
                font-size: 12px;
                margin-bottom: 4px;
                color: #555;
                line-height: 1.3;
            }
            
            .title {
                text-align: center;
                font-size: 18px;
                font-weight: bold;
                margin: 20px 0 10px 0;
                text-transform: uppercase;
                color: #2c3e50;
            }
            
            .subtitle {
                text-align: center;
                font-size: 14px;
                color: #666;
                margin-bottom: 20px;
            }
            
            .relatorio-resumo {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .resumo-item {
                text-align: center;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 6px;
                border-left: 4px solid #3498db;
            }
            
            .relatorio-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
            }
            
            .relatorio-table th {
                background-color: #2c3e50;
                color: white;
                padding: 12px;
                text-align: left;
                font-size: 14px;
            }
            
            .relatorio-table td {
                padding: 10px 12px;
                border-bottom: 1px solid #dee2e6;
                font-size: 13px;
            }
            
            .relatorio-table .total-row {
                background-color: #f8f9fa;
                font-weight: bold;
            }
            
            .valor-destaque {
                color: #28a745;
                font-weight: bold;
            }
            
            .badge-tipo {
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: bold;
            }
            
            .badge-tipo.quinzena {
                background-color: #17a2b8;
                color: white;
            }
            
            .badge-tipo.mes {
                background-color: #28a745;
                color: white;
            }
            
            .relatorio-footer {
                margin-top: 40px;
                border-top: 1px solid #dee2e6;
                padding-top: 20px;
            }
            
            .assinaturas {
                display: flex;
                justify-content: space-around;
                margin-bottom: 30px;
            }
            
            .assinatura {
                text-align: center;
            }
            
            .linha-assinatura {
                width: 200px;
                height: 1px;
                background-color: #000;
                margin: 40px auto 10px;
            }
            
            .info-sistema {
                text-align: center;
                color: #666;
                font-size: 12px;
            }
            
            @media print {
                .relatorio-container {
                    padding: 0;
                }
                .relatorio-container { overflow: visible; max-width: 100%; }

                .relatorio-container .relatorio-table:not(.bh-extrato-table),
                .relatorio-container .data-table:not(.bh-extrato-table),
                .relatorio-container .detalhes-table:not(.bh-extrato-table) {
                    table-layout: auto;
                }

                .relatorio-table th, .relatorio-table td,
                .data-table th, .data-table td,
                .detalhes-table th, .detalhes-table td { box-sizing: border-box; }

                .relatorio-table thead,
                .data-table thead,
                .detalhes-table thead { display: table-header-group; }

                .relatorio-table tfoot,
                .data-table tfoot,
                .detalhes-table tfoot { display: table-footer-group; }

                .relatorio-table tr,
                .data-table tr,
                .detalhes-table tr { break-inside: avoid; page-break-inside: avoid; }

                .relatorio-table th,
                .data-table th,
                .detalhes-table th {
                    position: static;
                    font-size: clamp(10px, calc(14px * var(--fs, 1)), 14px);
                    padding: clamp(5px, calc(12px * var(--fs, 1)), 12px);
                    white-space: nowrap;
                }

                .relatorio-table td,
                .data-table td,
                .detalhes-table td {
                    font-size: clamp(9px, calc(13px * var(--fs, 1)), 13px);
                    padding: clamp(4px, calc(10px * var(--fs, 1)), 10px) clamp(5px, calc(12px * var(--fs, 1)), 12px);
                    white-space: nowrap;
                }

                .relatorio-container .relatorio-table tfoot td,
                .relatorio-container .data-table tfoot td,
                .relatorio-container .detalhes-table tfoot td,
                .relatorio-container .relatorio-table .total-row td,
                .relatorio-container .data-table .total-row td,
                .relatorio-container .detalhes-table .total-row td,
                .relatorio-container .totais-table td {
                    overflow: visible;
                    text-overflow: clip;
                    white-space: nowrap;
                    font-size: clamp(8px, calc(12px * var(--fs, 1)), 12px);
                    padding: clamp(4px, calc(8px * var(--fs, 1)), 8px) clamp(5px, calc(10px * var(--fs, 1)), 10px);
                }

                .relatorio-container .relatorio-table tfoot td:first-child,
                .relatorio-container .data-table tfoot td:first-child,
                .relatorio-container .detalhes-table tfoot td:first-child,
                .relatorio-container .relatorio-table .total-row td:first-child,
                .relatorio-container .data-table .total-row td:first-child,
                .relatorio-container .detalhes-table .total-row td:first-child {
                    white-space: normal;
                }

                .relatorio-container .bh-extrato-table th {
                    font-size: clamp(8px, calc(11px * var(--fs, 1)), 11px);
                    padding: clamp(4px, calc(7px * var(--fs, 1)), 7px) clamp(3px, calc(5px * var(--fs, 1)), 5px);
                    white-space: normal;
                    line-height: 1.12;
                }

                .relatorio-container .bh-extrato-table td {
                    font-size: clamp(8px, calc(10px * var(--fs, 1)), 10px);
                    padding: clamp(3px, calc(6px * var(--fs, 1)), 6px) clamp(3px, calc(5px * var(--fs, 1)), 5px);
                }

                .relatorio-container .bh-extrato-table td:nth-child(1),
                .relatorio-container .bh-extrato-table td:nth-child(2),
                .relatorio-container .bh-extrato-table td:nth-child(4) {
                    white-space: normal;
                    overflow-wrap: anywhere;
                }

                .header,
                .title,
                .subtitle,
                .summary-cards,
                .summary-box,
                .relatorio-footer { break-inside: avoid; page-break-inside: avoid; }

                ${pageRule}
            }
            @media print and (orientation: portrait) {
                :root {
                    --fs: var(--fs-portrait, 1);
                }
            }
            @media print and (orientation: landscape) {
                :root {
                    --fs: var(--fs-landscape, 1);
                }
            }
        `;
    }
    
    /**
     * 👤 GERAR DEMONSTRATIVO INDIVIDUAL
     */
    async gerarDemonstrativoIndividual(folhaId) {
        const lancamento = this.lancamentos.find(l => (l.id || l.key) === folhaId);
        if (!lancamento) {
            this.showNotification('Lançamento não encontrado!', 'error');
            return;
        }
        
        // ✅ VERIFICAR SE FUNCIONÁRIO ESTÁ ATIVO
        if (lancamento.funcionario && lancamento.funcionario.ativo === false) {
            this.showNotification('Não é possível gerar demonstrativo para funcionário inativo!', 'warning');
            return;
        }
        
        const demonstrativoHTML = await this.gerarDemonstrativoIndividualPorId(lancamento.funcionario.id, [lancamento]);
        this.imprimirRelatorio(demonstrativoHTML);
    }
    
    /**
     * 👥 GERAR DEMONSTRATIVO PARA TODOS OS FUNCIONÁRIOS ATIVOS
     */
    async gerarDemonstrativoTodosFuncionarios(dados, dataInicio, dataFim) {
        console.log(`👥 Gerando demonstrativo para todos os funcionários ativos`);
        console.log(`📊 Dados recebidos: ${dados.length} lançamentos`);
        console.log(`📅 Período: ${dataInicio} a ${dataFim}`);
        
        // Obter todos os funcionários ativos que têm lançamentos no período
        const funcionariosComLancamentos = new Map();
        
        dados.forEach(lancamento => {
            if (lancamento.funcionario && lancamento.funcionario.id) {
                const funcionarioId = lancamento.funcionario.id;
                console.log(`👤 Processando lançamento do funcionário: ${lancamento.funcionario.nome} (${funcionarioId})`);
                
                if (!funcionariosComLancamentos.has(funcionarioId)) {
                    funcionariosComLancamentos.set(funcionarioId, []);
                    console.log(`➕ Novo funcionário adicionado: ${lancamento.funcionario.nome}`);
                }
                funcionariosComLancamentos.get(funcionarioId).push(lancamento);
            }
        });
        
        console.log(`📋 Funcionários únicos encontrados: ${funcionariosComLancamentos.size}`);
        for (const [funcionarioId, lancamentos] of funcionariosComLancamentos) {
            const funcionario = (lancamentos && lancamentos[0] && lancamentos[0].funcionario);
            console.log(`  - ${((funcionario && funcionario.nome) || '')}: ${lancamentos.length} lançamentos`);
        }
        
        if (funcionariosComLancamentos.size === 0) {
            return '<p>Nenhum lançamento encontrado para funcionários ativos no período selecionado.</p>';
        }
        
        // Gerar demonstrativo para cada funcionário
        const demonstrativos = [];
        for (const [funcionarioId, lancamentos] of funcionariosComLancamentos) {
            console.log(`🔄 Gerando demonstrativo para funcionário: ${(((lancamentos && lancamentos[0] && lancamentos[0].funcionario && lancamentos[0].funcionario.nome) || ''))}`);
            const demonstrativo = await this.gerarDemonstrativoIndividualPorId(funcionarioId, lancamentos);
            if (demonstrativo && !demonstrativo.includes('não encontrado') && !demonstrativo.includes('inativo')) {
                demonstrativos.push(demonstrativo);
                console.log(`✅ Demonstrativo gerado com sucesso para: ${(((lancamentos && lancamentos[0] && lancamentos[0].funcionario && lancamentos[0].funcionario.nome) || ''))}`);
            } else {
                console.log(`❌ Demonstrativo não gerado para: ${(((lancamentos && lancamentos[0] && lancamentos[0].funcionario && lancamentos[0].funcionario.nome) || ''))}`, (demonstrativo && demonstrativo.substring ? demonstrativo.substring(0, 100) : demonstrativo));
            }
        }
        
        console.log(`📊 Total de demonstrativos gerados: ${demonstrativos.length}`);
        
        if (demonstrativos.length === 0) {
            return '<p>Nenhum demonstrativo pôde ser gerado para os funcionários ativos.</p>';
        }
        
        // Combinar todos os demonstrativos com quebras de página (SEM CABEÇALHO DESNECESSÁRIO)
        return demonstrativos.join('<div style="page-break-before: always;"></div>');
    }
    
    /**
     * 👤 GERAR DEMONSTRATIVO INDIVIDUAL POR ID
     */
    async gerarDemonstrativoIndividualPorId(funcionarioId, dados) {
        const funcionario = this.funcionarios.find(f => f.id === funcionarioId);
        const lancamentosFuncionario = dados.filter(l => ((l && l.funcionario && l.funcionario.id) === funcionarioId));
        
        // ✅ VERIFICAR SE FUNCIONÁRIO ESTÁ ATIVO
        if (!funcionario || funcionario.ativo === false) {
            return '<p>Funcionário não encontrado ou inativo. Não é possível gerar demonstrativo.</p>';
        }
        
        if (lancamentosFuncionario.length === 0) {
            return '<p>Não há Lançamento em Folha para este Funcionario.</p>';
        }
        
        // ✅ USAR FORMATO DO RECIBO DETALHADO (IGUAL AO RECIBO DE PAGAMENTO - QUINZENA)
        const lancamento = lancamentosFuncionario[0]; // Usar primeiro lançamento como base
        
        // Obter dados da empresa
        const dadosEmpresa = await this.obterDadosEmpresa();
        
        // Calcular valores usando as mesmas funções do recibo
        try { window.FolhaUtils.ensureCalculosPresent(lancamento); } catch {}
        const calculos = lancamento.calculos || {};
        const calculosAninhados = (calculos && calculos.calculos) || {};
        // Exibir salário base em modo display (respeita toggle em quinzena)
        const salarioBase = window.FolhaUtils.getSalarioBaseDisplay(lancamento);
        const valorQuinzena = window.FolhaUtils.calcularValorQuinzena(lancamento);
        const totalAcrescimos = window.FolhaUtils.calcularAcrescimosDisplay(lancamento);
        const totalDescontos = window.FolhaUtils.calcularDescontosDisplay(lancamento);
        const salarioLiquido = window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento);
        
        // Detalhes dos acréscimos
        const horasExtras = Number((calculosAninhados && calculosAninhados.valorHorasExtras) || calculos.valorHorasExtras || 0);
        const bonificacoes = Number(lancamento.bonificacoes || calculos.bonificacoes || (calculosAninhados && calculosAninhados.bonificacoes) || 0);
        const premioAssiduidade = Number(lancamento.premioAssiduidade || calculos.premioAssiduidade || (calculosAninhados && calculosAninhados.premioAssiduidade) || 0);
        const periculosidade = Number((calculosAninhados && calculosAninhados.valorPericulosidade) || calculos.valorPericulosidade || 0);
        const adicionalNoturno = Number((calculosAninhados && calculosAninhados.valorAdicionalNoturno) || calculos.valorAdicionalNoturno || 0);
        const insalubridade = Number((calculosAninhados && calculosAninhados.valorInsalubridade) || calculos.valorInsalubridade || 0);
        const salarioFamilia = Number((calculosAninhados && calculosAninhados.valorSalarioFamilia) || calculos.valorSalarioFamilia || 0);
        
        // Detalhes dos descontos (ajuste por vínculo: CLT vs não-CLT; INSS manual)
        const tipoContrato = String((lancamento && lancamento.funcionario && lancamento.funcionario.tipoContrato) || '').toLowerCase();
        const vinculosSemINSSAuto = new Set(['temporario','terceirizado','estagio','estagiario']);
        const inssAuto = Number(((calculosAninhados && calculosAninhados.calculoINSS && calculosAninhados.calculoINSS.valor) || (calculos && calculos.inss && calculos.inss.valor) || 0));
        const irrfAuto = Number(((calculosAninhados && calculosAninhados.calculoIRRF && calculosAninhados.calculoIRRF.valor) || (calculos && calculos.irrf && calculos.irrf.valor) || 0));
        const descontoINSSManual = lancamento.descontoINSSManual || 0;
        const inssFinal = descontoINSSManual > 0 ? descontoINSSManual : (vinculosSemINSSAuto.has(tipoContrato) ? 0 : inssAuto);
        const irrfFinal = vinculosSemINSSAuto.has(tipoContrato) ? 0 : irrfAuto;
        const vales = Number(this.calcularTotalValesLancamento(lancamento) || 0);
        const outrosDescontos = Number(lancamento.outrosDescontos || calculos.outrosDescontos || (calculosAninhados && calculosAninhados.outrosDescontos) || 0);
        const descontoRepousoRemunerado = Number(lancamento.descontoRepousoRemunerado || calculos.descontoRepousoRemunerado || (calculosAninhados && calculosAninhados.descontoRepousoRemunerado) || 0);
        let descontoFaltas = (((calculos && calculos.calculos && calculos.calculos.descontoFaltas) || calculos.descontoFaltas || 0));
        if (!descontoFaltas) {
            try {
                const salarioBaseParaFaltas = Number(lancamento.salarioBase || ((lancamento && lancamento.funcionario && lancamento.funcionario.salarioBase) || 0));
                const baseAjustadaParaFaltas = Math.max(0, salarioBaseParaFaltas - descontoRepousoRemunerado);
                const diasFaltasDeclarados = Number(lancamento.faltas || 0);
                let diasParaCalculo = diasFaltasDeclarados;
                if (!diasFaltasDeclarados && Number.isFinite(lancamento.diasTrabalhados)) {
                    const diasMensaisPadrao = 30;
                    diasParaCalculo = Math.max(0, diasMensaisPadrao - Number(lancamento.diasTrabalhados || 0));
                }
                if (baseAjustadaParaFaltas > 0 && diasParaCalculo > 0 && window.FolhaCalculos && typeof window.FolhaCalculos.calcularDescontoFaltas === 'function') {
                    descontoFaltas = Number(window.FolhaCalculos.calcularDescontoFaltas(baseAjustadaParaFaltas, diasParaCalculo) || 0);
                }
            } catch {}
        }
        // descontoINSSManual já considerado em inssFinal
        const contribuicaoConfederativa = lancamento.contribuicaoConfederativa || 0;
        const contribuicaoSindical = lancamento.contribuicaoSindical || 0;
        const descontoIRPJ = lancamento.descontoIRPJ || 0;
        const emprestimoConsignado = lancamento.emprestimoConsignado || 0;
        
        // Usar a mesma função do recibo detalhado
        return await this.gerarHtmlReciboDetalhado(
            dadosEmpresa, funcionario, lancamento, {
                salarioBase, valorQuinzena, totalAcrescimos, totalDescontos, salarioLiquido,
                horasExtras, bonificacoes, premioAssiduidade, periculosidade, adicionalNoturno, insalubridade, salarioFamilia,
                inss: inssFinal, irrf: irrfFinal, vales, outrosDescontos, descontoFaltas, descontoRepousoRemunerado, descontoINSSManual, contribuicaoConfederativa, contribuicaoSindical, descontoIRPJ, emprestimoConsignado
            }
        );
        
    }

    /**
     * 🧾 GERAR RECIBO INDIVIDUAL DETALHADO (NOVO)
     */
    async gerarReciboIndividualDetalhado(folhaId) {
        console.log('🧾 Gerando recibo para folhaId:', folhaId);

        // Evitar reload desnecessário: usar cache se disponível; recarregar só se vazio ou não encontrado
        const hasCache = (window.folhaSystem && Array.isArray(window.folhaSystem.folhas) && window.folhaSystem.folhas.length > 0)
            || (Array.isArray(this.lancamentos) && this.lancamentos.length > 0);
        if (!hasCache) {
            console.log('🔄 Cache vazio, recarregando dados...');
            await this.loadData();
        }

        // Preferir dataset normalizado do sistema
        let datasetSistema = (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) ? window.folhaSystem.folhas : [];
        let datasetPrimario = datasetSistema.length ? datasetSistema : this.lancamentos;
        console.log('📊 Lançamentos disponíveis:', datasetPrimario.length);
        const idsLancamentos = datasetPrimario.map(l => l.id || l.key || 'SEM_ID');
        const detalhesLancamentos = this.lancamentos.map(l => ({
            id: l.id,
            key: l.key,
            funcionario: ((l && l.funcionario && l.funcionario.nome) || undefined),
            mesAno: l.mesAno
        }));

        console.log('🔍 IDs dos lançamentos:', idsLancamentos);
        console.log('📋 Lançamentos detalhados:', detalhesLancamentos);

        let lancamento = datasetPrimario.find(l => (l.id || l.key) === folhaId);
        if (!lancamento) {
            console.log('🔄 Recibo: lançamento não encontrado no cache, recarregando dados...');
            await this.loadData();
            datasetSistema = (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) ? window.folhaSystem.folhas : [];
            datasetPrimario = datasetSistema.length ? datasetSistema : this.lancamentos;
            lancamento = datasetPrimario.find(l => (l.id || l.key) === folhaId);
        }

        // Fallback: buscar diretamente do Firebase se não encontrado
        if (!lancamento && window.database) {
            try {
                const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
                const resolvePath = (p) => {
                    try {
                        if (window.FolhaUtils && typeof window.FolhaUtils.resolveFirebasePath === 'function') {
                            return window.FolhaUtils.resolveFirebasePath(p);
                        }
                        const base = String(p || '');
                        if (!base) return base;
                        if (/^companies(\/|$)/.test(base) || /^users(\/|$)/.test(base)) return base;
                        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
                        if (svc && typeof svc.getNamespacedPath === 'function') {
                            return svc.getNamespacedPath(base);
                        }
                        const rawTenant = window.appTenantId || (window.companyInfo && (window.companyInfo.companyId || window.companyInfo.companyID || window.companyInfo.tenantId || window.companyInfo.id));
                        if (rawTenant) return `companies/${String(rawTenant)}/${base}`;
                        const stored = localStorage.getItem('company_info');
                        if (stored) {
                            const obj = JSON.parse(stored);
                            const t = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                            if (t) return `companies/${String(t)}/${base}`;
                        }
                    } catch {}
                    return p;
                };
                const snap = await get(ref(window.database, resolvePath(`folhas/${folhaId}`)));
                if (snap.exists()) {
                    lancamento = { id: folhaId, ...(snap.val() || {}) };
                }
            } catch (e) {
                console.warn('⚠️ Fallback Firebase para recibo falhou:', e);
            }
        }
        if (!lancamento) {
            console.error('❌ Lançamento não encontrado! ID procurado:', folhaId);
            console.error('📋 Lançamentos disponíveis:', datasetPrimario.map(l => ({
                id: l.id || l.key,
                funcionario: ((l && l.funcionario && l.funcionario.nome) || undefined)
            })));            
            this.showNotification('Lançamento não encontrado!', 'error');
            return;
        }
        
        // ✅ VERIFICAR SE FUNCIONÁRIO ESTÁ ATIVO
        if (lancamento.funcionario && lancamento.funcionario.ativo === false) {
            this.showNotification('Não é possível gerar recibo para funcionário inativo!', 'warning');
            return;
        }

        console.log('👤 Procurando funcionário com ID:', ((lancamento && lancamento.funcionario && lancamento.funcionario.id) || ''));
        console.log('📋 Funcionários disponíveis no relatórios:', this.funcionarios.length);
        console.log('🔍 IDs dos funcionários:', this.funcionarios.map(f => `${f.nome} (${f.id})`));
        console.log('📊 Estrutura do lançamento.funcionario:', lancamento.funcionario);
        
        let funcionario = this._resolveFuncionarioForLancamento(lancamento);
        
        console.log('✅ Funcionário encontrado:', funcionario.nome);

        // Obter dados da empresa do banco
        const dadosEmpresa = await this.obterDadosEmpresa();
        
        // Calcular valores detalhados usando as funções corretas
        try { window.FolhaUtils.ensureCalculosPresent(lancamento); } catch {}
        const calculos = lancamento.calculos || {};
        const calculosAninhados = (calculos && calculos.calculos) || {};
        // Exibir salário base em modo display (respeita toggle em quinzena)
        const salarioBase = window.FolhaUtils.getSalarioBaseDisplay(lancamento);
        const valorQuinzena = window.FolhaUtils.calcularValorQuinzena(lancamento);
        const totalAcrescimos = window.FolhaUtils.calcularAcrescimosDisplay(lancamento);
        const totalDescontos = window.FolhaUtils.calcularDescontosDisplay(lancamento);
        const salarioLiquido = window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento);
        
        // Detalhes dos acréscimos
        const horasExtras = (((calculos && calculos.calculos && calculos.calculos.valorHorasExtras) || calculos.valorHorasExtras || 0));
        const bonificacoes = lancamento.bonificacoes || 0;
        const premioAssiduidade = lancamento.premioAssiduidade || calculos.premioAssiduidade || 0;
        const periculosidade = (((calculos && calculos.calculos && calculos.calculos.valorPericulosidade) || calculos.valorPericulosidade || 0));
        const adicionalNoturno = (((calculos && calculos.calculos && calculos.calculos.valorAdicionalNoturno) || calculos.valorAdicionalNoturno || 0));
        const insalubridade = (((calculos && calculos.calculos && calculos.calculos.valorInsalubridade) || calculos.valorInsalubridade || 0));
        const salarioFamilia = (((calculos && calculos.calculos && calculos.calculos.valorSalarioFamilia) || calculos.valorSalarioFamilia || 0));
        
        // Detalhes dos descontos (ajuste por vínculo: CLT vs não-CLT; INSS manual)
        const tipoContrato = String((lancamento && lancamento.funcionario && lancamento.funcionario.tipoContrato) || '').toLowerCase();
        const vinculosSemINSSAuto = new Set(['temporario','terceirizado','estagio','estagiario']);
        const inssAuto = (((calculos && calculos.calculos && calculos.calculos.calculoINSS && calculos.calculos.calculoINSS.valor) || (calculos && calculos.inss && calculos.inss.valor) || 0));
        const irrfAuto = (((calculos && calculos.calculos && calculos.calculos.calculoIRRF && calculos.calculos.calculoIRRF.valor) || (calculos && calculos.irrf && calculos.irrf.valor) || 0));
        const descontoINSSManual = lancamento.descontoINSSManual || 0;
        const inssFinal = descontoINSSManual > 0 ? descontoINSSManual : (vinculosSemINSSAuto.has(tipoContrato) ? 0 : inssAuto);
        const irrfFinal = vinculosSemINSSAuto.has(tipoContrato) ? 0 : irrfAuto;
        const vales = this.calcularTotalValesLancamento(lancamento) || 0;
        const outrosDescontos = lancamento.outrosDescontos || 0;
        const descontoRepousoRemunerado = Number(lancamento.descontoRepousoRemunerado || calculos.descontoRepousoRemunerado || (calculosAninhados && calculosAninhados.descontoRepousoRemunerado) || 0);
        let descontoFaltas = (((calculos && calculos.calculos && calculos.calculos.descontoFaltas) || calculos.descontoFaltas || 0));
        if (!descontoFaltas) {
            try {
                const salarioBaseParaFaltas = Number(lancamento.salarioBase || ((lancamento && lancamento.funcionario && lancamento.funcionario.salarioBase) || 0));
                const baseAjustadaParaFaltas = Math.max(0, salarioBaseParaFaltas - descontoRepousoRemunerado);
                const diasFaltasDeclarados = Number(lancamento.faltas || 0);
                let diasParaCalculo = diasFaltasDeclarados;
                if (!diasFaltasDeclarados && Number.isFinite(lancamento.diasTrabalhados)) {
                    const diasMensaisPadrao = 30;
                    diasParaCalculo = Math.max(0, diasMensaisPadrao - Number(lancamento.diasTrabalhados || 0));
                }
                if (baseAjustadaParaFaltas > 0 && diasParaCalculo > 0 && window.FolhaCalculos && typeof window.FolhaCalculos.calcularDescontoFaltas === 'function') {
                    descontoFaltas = Number(window.FolhaCalculos.calcularDescontoFaltas(baseAjustadaParaFaltas, diasParaCalculo) || 0);
                }
            } catch {}
        }
        const contribuicaoConfederativa = Number(lancamento.contribuicaoConfederativa || calculos.contribuicaoConfederativa || (calculosAninhados && calculosAninhados.contribuicaoConfederativa) || 0);
        const contribuicaoSindical = Number(lancamento.contribuicaoSindical || calculos.contribuicaoSindical || (calculosAninhados && calculosAninhados.contribuicaoSindical) || 0);
        const descontoIRPJ = Number(lancamento.descontoIRPJ || calculos.descontoIRPJ || (calculosAninhados && calculosAninhados.descontoIRPJ) || 0);
        const emprestimoConsignado = Number(lancamento.emprestimoConsignado || calculos.emprestimoConsignado || (calculosAninhados && calculosAninhados.emprestimoConsignado) || 0);

        const reciboHTML = await this.gerarHtmlReciboDetalhado(
            dadosEmpresa, funcionario, lancamento, {
                salarioBase, valorQuinzena, totalAcrescimos, totalDescontos, salarioLiquido,
                horasExtras, bonificacoes, premioAssiduidade, periculosidade, adicionalNoturno, insalubridade, salarioFamilia,
                inss: inssFinal, irrf: irrfFinal, vales, outrosDescontos, descontoFaltas, descontoRepousoRemunerado, descontoINSSManual,
                contribuicaoConfederativa, contribuicaoSindical, descontoIRPJ, emprestimoConsignado
            }
        );
        
        // CORREÇÃO: Usar nome do funcionário no título
        const tituloPersonalizado = `Recibo de Pagamento - ${funcionario.nome}`;
        this.imprimirRelatorio(reciboHTML, tituloPersonalizado, 'recibo');
    }

    _resolveFuncionarioForLancamento(lancamento) {
        try {
            const resolveId = (x) => {
                try { return String(((x && x.funcionario && x.funcionario.id) || x.funcionarioId || x.idFuncionario || x.func_id || '')).trim(); } catch { return ''; }
            };
            const norm = (s) => { try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' '); } catch { return ''; } };
            const sources = [];
            try { if (Array.isArray(this.funcionarios)) sources.push(...this.funcionarios); } catch {}
            try { if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) sources.push(...window.folhaSystem.funcionarios); } catch {}
            try { if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) sources.push(...window.folhaFuncionarios.funcionarios); } catch {}
            const fid = resolveId(lancamento) || ((lancamento && lancamento.funcionario && lancamento.funcionario.id) || '');
            const nomeLanc = (lancamento && lancamento.funcionario && lancamento.funcionario.nome) ? String(lancamento.funcionario.nome) : '';
            const alvoNome = norm(nomeLanc);
            let found = null;
            if (fid) {
                found = sources.find(f => String(f.id) === String(fid)) || null;
            }
            if (!found && alvoNome) {
                found = sources.find(f => norm(f && f.nome) === alvoNome) || sources.find(f => norm(f && f.nome).includes(alvoNome)) || null;
            }
            const base = (lancamento && lancamento.funcionario && typeof lancamento.funcionario === 'object') ? { ...lancamento.funcionario } : {};
            if (found) {
                base.id = base.id || found.id;
                base.nome = base.nome || found.nome || nomeLanc || '';
                base.cargo = base.cargo || found.cargo || '';
                base.tipoContrato = base.tipoContrato || found.tipoContrato || found.funcionarioTipoContrato || '';
                const sb = Number(base.salarioBase || found.salarioBase || found.salario || 0) || 0;
                if (sb > 0) base.salarioBase = sb;
            } else {
                if (!base.nome) base.nome = nomeLanc || 'N/A';
                if (!base.id) base.id = fid || 'N/A';
            }
            return base;
        } catch (e) {
            console.warn('⚠️ Falha ao resolver funcionário para recibo:', e);
            return (lancamento && lancamento.funcionario) || { id: 'N/A', nome: 'N/A', cargo: '' };
        }
    }

    /**
     * 🧾 RECIBO DE HORAS EXTRAS — INDIVIDUAL POR FUNCIONÁRIO
     */
    async gerarReciboHorasExtrasIndividualPorId(funcionarioId, dados, dataInicio, dataFim) {
        const funcionario = this.funcionarios.find(f => String(f.id) === String(funcionarioId)) || {};
        const empresa = await this.obterDadosEmpresa();
        const periodo = this.formatarPeriodo(dataInicio, dataFim);
        const lista = (Array.isArray(dados) ? dados : []);
        const lancamentosFuncionario = lista.filter(l => String(l.funcionario?.id) === String(funcionarioId));
        if (lancamentosFuncionario.length === 0) {
            return '<p>Não há horas extras registradas no período para o funcionário selecionado.</p>';
        }
        const linhas = [];
        let totalValor = 0;
        let totalHoras = 0;
        const descontos = [];
        let totalDescontos = 0;
        const observacoesList = [];
        for (const lanc of lancamentosFuncionario) {
            try { window.FolhaUtils && window.FolhaUtils.ensureCalculosPresent && window.FolhaUtils.ensureCalculosPresent(lanc); } catch {}
            const calculos = lanc.calculos || {};
            const nested = (calculos && calculos.calculos) || {};
            const horasExtras = Number(lanc.horasExtras ?? calculos.horasExtras ?? 0);
            const percentual = Number(lanc.percentualExtra ?? calculos.percentualExtra ?? 50);
            const salarioHora = Number(nested.salarioHora ?? calculos.salarioHora ?? 0) || (Number(calculos.salarioBase || lanc.funcionario?.salarioBase || 0) / 220) || 0;
            const valorHorasExtras = Number(nested.valorHorasExtras ?? calculos.valorHorasExtras ?? 0);
            if (horasExtras > 0) {
                const valor = valorHorasExtras || (window.FolhaCalculos && typeof window.FolhaCalculos.calcularHorasExtras === 'function'
                    ? Number(window.FolhaCalculos.calcularHorasExtras(horasExtras, percentual, salarioHora))
                    : (salarioHora * horasExtras * (1 + (percentual / 100))));
                totalValor += valor;
                totalHoras += horasExtras;
                linhas.push({ periodo: (lanc.mesAno || periodo), horas: horasExtras, percentual, salarioHora, valor });
            }

            // Descontos dinâmicos, respeitando vínculo
            const tipoContrato = (lanc.funcionario && lanc.funcionario.tipoContrato) || (funcionario && funcionario.tipoContrato) || '';
            const vinculosSemINSSAuto = new Set(['temporario','terceirizado','estagio','estagiario']);
            const inssAuto = Number(((nested && nested.calculoINSS && nested.calculoINSS.valor) || (calculos && calculos.inss && calculos.inss.valor) || 0));
            const irrfAuto = Number(((nested && nested.calculoIRRF && nested.calculoIRRF.valor) || (calculos && calculos.irrf && calculos.irrf.valor) || 0));
            const descontoINSSManual = Number(lanc.descontoINSSManual || 0);
            const inssFinal = descontoINSSManual > 0 ? descontoINSSManual : (vinculosSemINSSAuto.has(String(tipoContrato).toLowerCase()) ? 0 : inssAuto);
            const irrfFinal = vinculosSemINSSAuto.has(String(tipoContrato).toLowerCase()) ? 0 : irrfAuto;
            const vales = Number(this.calcularTotalValesLancamento(lanc) || 0);
            const outrosDescontos = Number(lanc.outrosDescontos || calculos.outrosDescontos || (nested && nested.outrosDescontos) || 0);

            const pushDesc = (descricao, referencia, valorNum) => {
                const v = Number(valorNum || 0);
                if (v > 0) {
                    descontos.push({ descricao, referencia: referencia || '', valor: v });
                    totalDescontos += v;
                }
            };
            pushDesc('INSS', '', inssFinal);
            pushDesc('IRRF', '', irrfFinal);
            pushDesc('Vales', 'Adiantamentos', vales);
            pushDesc('Outros Descontos', '', outrosDescontos);
            if (descontoINSSManual > 0) pushDesc('Desconto INSS (Manual)', '', descontoINSSManual);

            if (lanc.observacoes && String(lanc.observacoes).trim() !== '') {
                observacoesList.push(String(lanc.observacoes).trim());
            }
        }
        // Neutralizar descontos para o recibo de horas extras
        descontos.length = 0;
        totalDescontos = 0;
        const observacoes = observacoesList.length > 0 ? observacoesList.join(' | ') : '';
        return this._gerarHtmlReciboHorasExtras({ empresa, funcionario, periodo, linhas, totalValor, totalHoras, descontos, totalDescontos, observacoes });
    }

    /**
     * 🧾 RECIBO DE HORAS EXTRAS — TODOS OS ATIVOS
     */
    async gerarReciboHorasExtrasTodosAtivos(dados, dataInicio, dataFim) {
        const empresa = await this.obterDadosEmpresa();
        const periodo = this.formatarPeriodo(dataInicio, dataFim);
        const porFuncionario = new Map();
        const base = Array.isArray(dados) ? dados : [];
        for (const lanc of base) {
            try { window.FolhaUtils && window.FolhaUtils.ensureCalculosPresent && window.FolhaUtils.ensureCalculosPresent(lanc); } catch {}
            const calculos = lanc.calculos || {};
            const horasExtras = Number(lanc.horasExtras ?? calculos.horasExtras ?? 0);
            if (horasExtras > 0 && lanc.funcionario && lanc.funcionario.id) {
                const key = String(lanc.funcionario.id);
                if (!porFuncionario.has(key)) porFuncionario.set(key, []);
                porFuncionario.get(key).push(lanc);
            }
        }
        if (porFuncionario.size === 0) {
            return '<p>Não há horas extras registradas no período para funcionários ativos.</p>';
        }
        let html = '';
        for (const [funcId, lista] of porFuncionario.entries()) {
            const funcionario = this.funcionarios.find(f => String(f.id) === String(funcId)) || (lista[0]?.funcionario) || {};
            const linhas = [];
            let totalValor = 0;
            let totalHoras = 0;
            const descontos = [];
            let totalDescontos = 0;
            const observacoesList = [];
            for (const lanc of lista) {
                const calculos = lanc.calculos || {};
                const nested = (calculos && calculos.calculos) || {};
                const horasExtras = Number(lanc.horasExtras ?? calculos.horasExtras ?? 0);
                const percentual = Number(lanc.percentualExtra ?? calculos.percentualExtra ?? 50);
                const salarioHora = Number(nested.salarioHora ?? calculos.salarioHora ?? 0) || (Number(calculos.salarioBase || lanc.funcionario?.salarioBase || 0) / 220) || 0;
                const valorHorasExtras = Number(nested.valorHorasExtras ?? calculos.valorHorasExtras ?? 0);
                if (horasExtras > 0) {
                    const valor = valorHorasExtras || (window.FolhaCalculos && typeof window.FolhaCalculos.calcularHorasExtras === 'function'
                        ? Number(window.FolhaCalculos.calcularHorasExtras(horasExtras, percentual, salarioHora))
                        : (salarioHora * horasExtras * (1 + (percentual / 100))));
                    totalValor += valor;
                    totalHoras += horasExtras;
                    linhas.push({ periodo: (lanc.mesAno || periodo), horas: horasExtras, percentual, salarioHora, valor });
                }

                // Descontos dinâmicos por funcionário
                const tipoContrato = (lanc.funcionario && lanc.funcionario.tipoContrato) || (funcionario && funcionario.tipoContrato) || '';
                const vinculosSemINSSAuto = new Set(['temporario','terceirizado','estagio','estagiario']);
                const inssAuto = Number(((nested && nested.calculoINSS && nested.calculoINSS.valor) || (calculos && calculos.inss && calculos.inss.valor) || 0));
                const irrfAuto = Number(((nested && nested.calculoIRRF && nested.calculoIRRF.valor) || (calculos && calculos.irrf && calculos.irrf.valor) || 0));
                const descontoINSSManual = Number(lanc.descontoINSSManual || 0);
                const inssFinal = descontoINSSManual > 0 ? descontoINSSManual : (vinculosSemINSSAuto.has(String(tipoContrato).toLowerCase()) ? 0 : inssAuto);
                const irrfFinal = vinculosSemINSSAuto.has(String(tipoContrato).toLowerCase()) ? 0 : irrfAuto;
                const vales = Number(this.calcularTotalValesLancamento(lanc) || 0);
                const outrosDescontos = Number(lanc.outrosDescontos || calculos.outrosDescontos || (nested && nested.outrosDescontos) || 0);

                const pushDesc = (descricao, referencia, valorNum) => {
                    const v = Number(valorNum || 0);
                    if (v > 0) {
                        descontos.push({ descricao, referencia: referencia || '', valor: v });
                        totalDescontos += v;
                    }
                };
                pushDesc('INSS', '', inssFinal);
                pushDesc('IRRF', '', irrfFinal);
                pushDesc('Vales', 'Adiantamentos', vales);
                pushDesc('Outros Descontos', '', outrosDescontos);
                if (descontoINSSManual > 0) pushDesc('Desconto INSS (Manual)', '', descontoINSSManual);

                if (lanc.observacoes && String(lanc.observacoes).trim() !== '') {
                    observacoesList.push(String(lanc.observacoes).trim());
                }
            }
            if (linhas.length > 0) {
                // Neutralizar descontos para o recibo de horas extras (todos ativos)
                descontos.length = 0;
                totalDescontos = 0;
                const observacoes = observacoesList.length > 0 ? observacoesList.join(' | ') : '';
                html += this._gerarHtmlReciboHorasExtras({ empresa, funcionario, periodo, linhas, totalValor, totalHoras, descontos, totalDescontos, observacoes });
                html += '<div style="page-break-before: always;"></div>';
            }
        }
        return html;
    }

    getReciboAutoFitStyles() {
        return `
        :root {
            --recibo-print-scale: 1;
            --recibo-print-scale-portrait: 1;
            --recibo-print-scale-landscape: 1;
            --recibo-content-width: 100%;
            --recibo-content-width-portrait: 100%;
            --recibo-content-width-landscape: 100%;
            --recibo-page-width: 100%;
            --recibo-page-width-portrait: 689px;
            --recibo-page-width-landscape: 1034px;
            --recibo-fs-portrait: 1;
            --recibo-fs-landscape: 1;
        }
        @media print {
            .recibo-page {
                width: var(--recibo-page-width) !important;
                max-width: none !important;
                min-height: 0 !important;
                margin: 0 auto !important;
                padding: 0 !important;
                overflow: visible !important;
                page-break-inside: avoid !important;
                break-inside: avoid-page !important;
            }
            #recibo-content {
                width: var(--recibo-content-width) !important;
                max-width: none !important;
                zoom: var(--recibo-print-scale) !important;
                transform: none !important;
                transform-origin: top left !important;
                page-break-inside: avoid !important;
                break-inside: avoid-page !important;
            }
        }
        @media print and (orientation: portrait) {
            :root {
                --recibo-print-scale: var(--recibo-print-scale-portrait);
                --recibo-content-width: var(--recibo-content-width-portrait);
                --recibo-page-width: var(--recibo-page-width-portrait);
                --fs: var(--recibo-fs-portrait);
            }
        }
        @media print and (orientation: landscape) {
            :root {
                --recibo-print-scale: var(--recibo-print-scale-landscape);
                --recibo-content-width: var(--recibo-content-width-landscape);
                --recibo-page-width: var(--recibo-page-width-landscape);
                --fs: var(--recibo-fs-landscape);
            }
        }
        `;
    }

    getReciboAutoFitScript() {
        return `
    <script>
    (function() {
        var emImpressao = false;
        var adaptativo = true;
        var printFitTimer = null;
        try {
            var qs = new URLSearchParams(location.search);
            var ap = qs.get('adapt');
            if (typeof ap === 'string') adaptativo = !(ap.toLowerCase() === 'false' || ap === '0');
        } catch (e) {}

        function setRootVar(name, value) {
            try { document.documentElement.style.setProperty(name, String(value)); } catch (e) {}
        }

        function removeRootVar(name) {
            try { document.documentElement.style.removeProperty(name); } catch (e) {}
        }

        function isLandscapeNow() {
            try { return !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches); } catch (e) {}
            return false;
        }

        function getPageMetrics(landscape) {
            var pageW = landscape ? 1122 : 793;
            var pageH = landscape ? 793 : 1122;
            var margin = landscape ? 40 : 48;
            if (typeof landscape !== 'boolean') {
                landscape = isLandscapeNow();
                pageW = landscape ? 1122 : 793;
                pageH = landscape ? 793 : 1122;
                margin = landscape ? 40 : 48;
            }
            try {
                var css = getComputedStyle(document.documentElement);
                if (typeof landscape !== 'boolean') {
                    pageW = Number(css.getPropertyValue('--a4-width-px')) || pageW;
                    pageH = Number(css.getPropertyValue('--a4-height-px')) || pageH;
                    margin = Number(css.getPropertyValue('--print-margin-px')) || margin;
                }
            } catch (e) {}
            return {
                width: Math.max(1, pageW - margin * 2 - 8),
                height: Math.max(1, pageH - margin * 2 - 8)
            };
        }

        function measureContent(conteudo) {
            var base = conteudo.getBoundingClientRect();
            var width = Math.max(conteudo.scrollWidth || 0, base.width || 0);
            var height = Math.max(conteudo.scrollHeight || 0, base.height || 0);
            try {
                Array.from(conteudo.children || []).forEach(function(child) {
                    var rect = child.getBoundingClientRect();
                    width = Math.max(width, rect.right - base.left);
                    height = Math.max(height, rect.bottom - base.top);
                });
                Array.from(conteudo.querySelectorAll('table, .header, .title, .funcionario-info, .duas-colunas, .observacoes, .data-recibo, .assinaturas, .footer')).forEach(function(node) {
                    var rect = node.getBoundingClientRect();
                    width = Math.max(width, rect.right - base.left);
                    height = Math.max(height, rect.bottom - base.top);
                });
            } catch (e) {}
            return { width: Math.max(1, width), height: Math.max(1, height) };
        }

        function resetForMeasure(conteudo, pagina, metrics) {
            setRootVar('--recibo-print-scale', '1');
            setRootVar('--recibo-content-width', '100%');
            setRootVar('--recibo-page-width', metrics.width + 'px');
            setRootVar('--fs', '1');
            try { pagina.style.setProperty('--fs', '1'); } catch (e) {}
            conteudo.style.zoom = '';
            conteudo.style.transform = 'none';
            conteudo.style.transformOrigin = 'top left';
            conteudo.style.width = '';
            pagina.style.zoom = '';
            pagina.style.height = '';
            pagina.style.width = '';
            pagina.style.maxWidth = '';
        }

        function calcularAjusteParaOrientacao(conteudo, pagina, metrics) {
            resetForMeasure(conteudo, pagina, metrics);
            var measured = measureContent(conteudo);
            var escalaW = metrics.width / measured.width;
            var escalaH = metrics.height / measured.height;
            var escala = adaptativo ? Math.min(1, escalaW, escalaH) : 1;
            var fs = 1;

            if (adaptativo && escala < 0.92) {
                fs = Math.max(0.74, Math.min(1, escala + 0.08));
                setRootVar('--fs', fs.toFixed(3));
                try { pagina.style.setProperty('--fs', fs.toFixed(3)); } catch (e) {}
                measured = measureContent(conteudo);
                escalaW = metrics.width / measured.width;
                escalaH = metrics.height / measured.height;
                escala = Math.min(1, escalaW, escalaH);
            }

            escala = adaptativo ? Math.max(0.48, Math.min(1, escala - 0.012)) : 1;
            return {
                scale: escala,
                fs: fs,
                pageWidth: metrics.width,
                contentWidth: metrics.width / escala
            };
        }

        function aplicarAjuste(nome, ajuste) {
            setRootVar('--recibo-print-scale-' + nome, ajuste.scale.toFixed(3));
            setRootVar('--recibo-content-width-' + nome, ajuste.contentWidth.toFixed(2) + 'px');
            setRootVar('--recibo-page-width-' + nome, ajuste.pageWidth.toFixed(2) + 'px');
            setRootVar('--recibo-fs-' + nome, ajuste.fs.toFixed(3));
        }

        function ativarAjusteAtual(ajuste) {
            if (emImpressao) {
                removeRootVar('--recibo-print-scale');
                removeRootVar('--recibo-content-width');
                removeRootVar('--recibo-page-width');
                removeRootVar('--fs');
                return;
            }
            setRootVar('--recibo-print-scale', ajuste.scale.toFixed(3));
            setRootVar('--recibo-content-width', ajuste.contentWidth.toFixed(2) + 'px');
            setRootVar('--recibo-page-width', ajuste.pageWidth.toFixed(2) + 'px');
            setRootVar('--fs', ajuste.fs.toFixed(3));
        }

        function limparInlineMedicao(conteudo, pagina) {
            conteudo.style.width = '';
            conteudo.style.zoom = '';
            conteudo.style.transform = '';
            conteudo.style.transformOrigin = '';
            pagina.style.width = '';
            pagina.style.height = '';
            pagina.style.maxWidth = '';
            pagina.style.minHeight = '';
            pagina.style.zoom = '';
        }

        function ajustarEscalaParaA4() {
            var conteudo = document.getElementById('recibo-content');
            var pagina = document.getElementById('recibo-page');
            if (!conteudo || !pagina) return;

            var portrait = calcularAjusteParaOrientacao(conteudo, pagina, getPageMetrics(false));
            var landscape = calcularAjusteParaOrientacao(conteudo, pagina, getPageMetrics(true));
            aplicarAjuste('portrait', portrait);
            aplicarAjuste('landscape', landscape);
            ativarAjusteAtual(isLandscapeNow() ? landscape : portrait);
            limparInlineMedicao(conteudo, pagina);
        }

        function scheduleFit() {
            ajustarEscalaParaA4();
            setTimeout(ajustarEscalaParaA4, 80);
            setTimeout(ajustarEscalaParaA4, 220);
        }

        function startPrintFitLoop() {
            stopPrintFitLoop();
            printFitTimer = setInterval(ajustarEscalaParaA4, 450);
        }

        function stopPrintFitLoop() {
            if (printFitTimer) {
                clearInterval(printFitTimer);
                printFitTimer = null;
            }
        }

        function onBeforePrint() {
            emImpressao = true;
            scheduleFit();
            startPrintFitLoop();
            try {
                if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleFit);
            } catch (e) {}
        }

        function onAfterPrint() {
            emImpressao = false;
            stopPrintFitLoop();
            var conteudo = document.getElementById('recibo-content');
            var pagina = document.getElementById('recibo-page');
            setRootVar('--recibo-print-scale', '1');
            setRootVar('--fs', '1');
            if (conteudo) {
                conteudo.style.zoom = '';
                conteudo.style.transform = '';
                conteudo.style.transformOrigin = '';
                conteudo.style.width = '';
            }
            if (pagina) {
                pagina.style.width = '';
                pagina.style.height = '';
                pagina.style.maxWidth = '';
                pagina.style.minHeight = '';
                pagina.style.zoom = '';
                try { pagina.style.setProperty('--fs', '1'); } catch (e) {}
            }
        }

        window.addEventListener('beforeprint', onBeforePrint);
        window.addEventListener('afterprint', onAfterPrint);
        window.addEventListener('resize', function() { if (emImpressao) scheduleFit(); else ajustarEscalaParaA4(); });
        window.addEventListener('focus', function() { if (emImpressao) scheduleFit(); });
        document.addEventListener('visibilitychange', function() { if (emImpressao) scheduleFit(); });
        try {
            var printMq = window.matchMedia('print');
            if (printMq && printMq.addEventListener) {
                printMq.addEventListener('change', function(e) {
                    emImpressao = !!e.matches;
                    if (emImpressao) scheduleFit(); else onAfterPrint();
                });
            }
            var portraitMq = window.matchMedia('(orientation: portrait)');
            if (portraitMq && portraitMq.addEventListener) {
                portraitMq.addEventListener('change', function() { if (emImpressao) scheduleFit(); });
            }
        } catch (e) {}
        setTimeout(ajustarEscalaParaA4, 100);
    })();
    </script>`;
    }

    /**
     * 🧾 HTML de Recibo de Horas Extras (usa o mesmo layout do Recibo Mensal)
     */
    _gerarHtmlReciboHorasExtras({ empresa, funcionario, periodo, linhas, totalValor, totalHoras, descontos = [], totalDescontos = 0, observacoes = '' }) {
        const dataEmissao = new Date().toLocaleDateString('pt-BR');
        const salarioBaseNum = Number((funcionario && funcionario.salarioBase) || 0);
        const nomeFuncionario = (funcionario && funcionario.nome) || (funcionario && funcionario.displayName) || 'Funcionário';
        const cpf = (funcionario && funcionario.cpf) || 'N/A';
        const cargo = (funcionario && funcionario.cargo) || 'N/A';
        const pis = (funcionario && funcionario.pis) || 'N/A';
        const ctps = (funcionario && funcionario.ctps) || 'N/A';
        const tipoContrato = (funcionario && funcionario.tipoContrato ? String(funcionario.tipoContrato).toUpperCase() : 'N/A');
        const dataAdmissional = (funcionario && funcionario.dataAdmissional ? new Date(funcionario.dataAdmissional).toLocaleDateString('pt-BR') : 'N/A');

        const linhasHtml = (linhas || []).map(l => {
            const horas = Number(l.horas || 0);
            const perc = Number(l.percentual || 0);
            const valorHora = Number(l.salarioHora || 0);
            const valor = Number(l.valor || 0);
            return `
                <tr>
                    <td>Horas Extras ${perc.toFixed(0)}%</td>
                    <td>${horas.toFixed(2).replace('.', ',')} h × R$ ${valorHora.toFixed(2).replace('.', ',')}</td>
                    <td class="valor">R$ ${valor.toFixed(2).replace('.', ',')}</td>
                </tr>
            `;
        }).join('');

        // Totais consolidados para o resumo
        const totalProventosNum = Number(totalValor || 0);
        const totalDescontosNum = Number(totalDescontos || 0);
        // Conforme solicitado: Líquido e A Receber refletem o total das horas extras
        const valorLiquidoNum = totalProventosNum;
        const valorReceberNum = totalProventosNum;

        const valorLiquidoRealNum = valorLiquidoNum;
        const valorReceberRealNum = valorReceberNum;
        const descontosHtml = '';

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recibo de Pagamento - Horas Extras</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            font-size: 12px;
            line-height: 1.4;
        }
        .header {
            display: flex;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            align-items: flex-start;
        }
        .logo {
            width: 120px;
            text-align: center;
            margin-right: 20px;
            flex-shrink: 0;
        }
        .logo img { max-width: 100%; height: auto; max-height: 100px; }
        .logo svg { width: 80px; height: 80px; }
        .company-info { flex: 1; padding-left: 15px; min-width: 0; }
        .company-name { font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #2c3e50; text-transform: uppercase; }
        .company-details { font-size: 12px; margin-bottom: 4px; color: #555; line-height: 1.3; }
        .title {
            text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; text-transform: uppercase; color: #2c3e50; border: 2px solid #2c3e50; padding: 10px; background-color: #f8f9fa;
        }
        .funcionario-info { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; background-color: #f9f9f9; }
        .info-row { display: grid; grid-template-columns: minmax(108px, max-content) minmax(0, 1fr) minmax(108px, max-content) minmax(0, 1fr); gap: 4px 10px; align-items: start; margin-bottom: 8px; }
        .info-label { font-weight: bold; min-width: 0; }
        .info-value { min-width: 0; overflow-wrap: anywhere; word-break: normal; }
        .detalhes-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
        .detalhes-table th, .detalhes-table td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 11px; word-break: break-word; overflow-wrap: anywhere; }
        .detalhes-table th { background-color: #0d2339; color: white; font-weight: bold; text-align: center; text-transform: uppercase; }
        .detalhes-table .valor { text-align: right; font-family: 'Consolas', 'Courier New', monospace; font-weight: bold; white-space: nowrap; word-break: normal; overflow-wrap: normal; font-variant-numeric: tabular-nums; }
        .total-row { background-color: #e3f2fd; font-weight: bold; }
        .total-final { background-color: #1976d2; color: white; font-size: 14px; }
        .duas-colunas { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; }
        .coluna { flex: 1; min-width: 0; }
        :root { --a4-width-px: 793; --a4-height-px: 1122; --print-margin-px: 48; --fs: 1; }
        .recibo-page { max-width: calc(var(--a4-width-px) - 2 * var(--print-margin-px)); width: 100%; margin: 0 auto; padding: 0; box-sizing: border-box; }
        .recibo-scale { transform-origin: top left; will-change: transform; }
        @page { margin: 12mm; }
        @media (max-width: 680px) {
            .info-row { grid-template-columns: minmax(100px, max-content) minmax(0, 1fr); }
        }
        @media print and (orientation: landscape) {
            :root { --a4-width-px: 1122; --a4-height-px: 793; --print-margin-px: 40; }
        }
        @media print {
            html, body { margin: 0; padding: 0; }
            .detalhes-table, .detalhes-table th, .detalhes-table td { box-sizing: border-box; }
            .recibo-page { width: 100%; max-width: none; height: auto; min-height: 0; margin: 0 auto; padding: 0; overflow: visible; page-break-inside: auto; break-inside: auto; }
            #recibo-content { width: 100%; max-width: 100%; transform: none !important; zoom: 1 !important; page-break-inside: auto; break-inside: auto; }
            body { font-size: 11px; line-height: 1.3; }
            .header { margin-bottom: 12px; padding-bottom: 10px; }
            .logo img { max-height: 70px; }
            .logo svg { width: 60px; height: 60px; }
            .company-name { font-size: 18px; margin-bottom: 6px; }
            .company-details { font-size: 11px; line-height: 1.25; }
            .title { font-size: 16px; margin: 12px 0; padding: 6px; border-width: 1px; }
            .funcionario-info { margin-bottom: 12px; padding: 10px; }
            .funcionario-info .info-row { margin-bottom: 6px; }
            .info-label { min-width: 0; }
            .info-value { min-width: 0; overflow-wrap: anywhere; }
            .duas-colunas { gap: clamp(8px, calc(12px * var(--fs, 1)), 12px); }
            .detalhes-table { font-size: clamp(8.5px, calc(10px * var(--fs, 1)), 10px); }
            .detalhes-table th, .detalhes-table td {
                padding: clamp(2px, calc(4px * var(--fs, 1)), 4px) clamp(3px, calc(6px * var(--fs, 1)), 6px);
                vertical-align: top;
            }
            .detalhes-table td:not(.valor),
            .detalhes-table th:not(:last-child) {
                white-space: normal !important;
                word-break: break-word !important;
                overflow-wrap: anywhere !important;
            }
            .detalhes-table th { background-color: #0d2339 !important; color: white !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .detalhes-table .valor { white-space: nowrap !important; word-break: normal !important; overflow-wrap: normal !important; }
            .total-final { background-color: #1976d2 !important; color: white !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .recibo-page, #recibo-content, .duas-colunas, .detalhes-table { page-break-inside: auto; break-inside: auto; }
            .detalhes-table tr, .assinaturas, .footer, .total-row, .total-final, .data-recibo { page-break-inside: avoid; break-inside: avoid; }
        }
        .grupo-titulo { font-weight: bold; text-transform: uppercase; margin: 8px 0; color: #2c3e50; }
        .assinaturas { margin-top: 50px; display: flex; justify-content: space-between; }
        .assinatura-bloco { text-align: center; width: 45%; }
        .linha-assinatura { border-top: 1px solid #333; margin-top: 40px; padding-top: 5px; font-weight: bold; }
        .assinatura-label { margin-top: 6px; font-weight: bold; font-size: 11px; }
        .assinatura-dados { margin-top: 4px; font-size: 10px; }
        .data-recibo { text-align: right; margin-top: 30px; font-style: italic; }
        ${this.getReciboAutoFitStyles()}
    </style>
</head>
<body>
    <div id="recibo-page" class="recibo-page">
    <div id="recibo-content" class="recibo-scale">
        <!-- Cabeçalho -->
        <div class="header">
            <div class="logo">
                ${empresa.logo && empresa.logo.trim() !== '' ? 
                    `<img src="${empresa.logo}" alt="Logo da Empresa" />` : 
                    `<svg viewBox="0 0 100 100" style="width: 80px; height: 80px;">
                        <circle cx="50" cy="50" r="45" fill="#2c3e50" stroke="#34495e" stroke-width="2"/>
                        <text x="50" y="60" text-anchor="middle" fill="white" font-size="24" font-weight="bold">JN</text>
                    </svg>`
                }
            </div>
            <div class="company-info">
                <div class="company-name">${empresa.nome || empresa.name || 'Empresa'}</div>
                <div class="company-details">CNPJ: ${empresa.cnpj || '-'}</div>
                ${(empresa.endereco || empresa.address) ? `<div class="company-details">${empresa.endereco || empresa.address}</div>` : ''}
                ${(empresa.cidade || empresa.city || empresa.estado || empresa.state) ? `<div class="company-details">${empresa.cidade || empresa.city || ''}${(empresa.estado || empresa.state) ? ' - ' + (empresa.estado || empresa.state) : ''}</div>` : ''}
                ${(empresa.telefone || empresa.phone) ? `<div class="company-details">Fone: ${empresa.telefone || empresa.phone}</div>` : ''}
                ${empresa.email ? `<div class="company-details">Email: ${empresa.email}</div>` : ''}
            </div>
        </div>

        <!-- Título -->
        <div class="title">RECIBO DE PAGAMENTO - HORAS EXTRAS</div>

        <!-- Informações do funcionário -->
        <div class="funcionario-info">
            <div class="info-row">
                <div class="info-label">Funcionário:</div>
                <div class="info-value">${nomeFuncionario}</div>
                <div class="info-label">Período:</div>
                <div class="info-value">${periodo}</div>
            </div>
            <div class="info-row">
                <div class="info-label">CPF:</div>
                <div class="info-value">${cpf}</div>
                <div class="info-label">Data Emissão:</div>
                <div class="info-value">${dataEmissao}</div>
            </div>
            <div class="info-row">
                <div class="info-label">PIS:</div>
                <div class="info-value">${pis}</div>
                <div class="info-label">Cargo:</div>
                <div class="info-value">${cargo}</div>
            </div>
            <div class="info-row">
                <div class="info-label">CTPS:</div>
                <div class="info-value">${ctps}</div>
                <div class="info-label">Salário Base:</div>
                <div class="info-value">R$ ${salarioBaseNum.toFixed(2).replace('.', ',')}</div>
            </div>
            <div class="info-row">
                <div class="info-label">Data Admissional:</div>
                <div class="info-value">${dataAdmissional}</div>
                <div class="info-label">Tipo Contrato:</div>
                <div class="info-value">${tipoContrato}</div>
            </div>
        </div>

        <!-- Proventos -->
        <div class="duas-colunas">
            <div class="coluna">
                <div class="grupo-titulo">Horas Extras (Créditos)</div>
                <table class="detalhes-table proventos-table">
                    <colgroup>
                        <col style="width: 44%;">
                        <col style="width: 30%;">
                        <col style="width: 26%;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Descrição</th>
                            <th>Referência</th>
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasHtml}
                        <tr class="total-row">
                            <td><strong>TOTAL HORAS EXTRAS</strong></td>
                            <td></td>
                            <td class="valor"><strong>R$ ${totalProventosNum.toFixed(2).replace('.', ',')}</strong></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Resumo final -->
        <table class="detalhes-table resumo-table">
            <colgroup>
                <col style="width: 56%;">
                <col style="width: 16%;">
                <col style="width: 28%;">
            </colgroup>
            <thead>
                <tr>
                    <th>Resumo</th>
                    <th></th>
                    <th>Valor</th>
                </tr>
            </thead>
            <tbody>
                <tr class="total-row">
                    <td><strong>Total Horas Extras</strong></td>
                    <td></td>
                    <td class="valor"><strong>R$ ${totalProventosNum.toFixed(2).replace('.', ',')}</strong></td>
                </tr>
                <tr class="total-row">
                    <td><strong>Valor Líquido</strong></td>
                    <td></td>
                    <td class="valor"><strong>R$ ${valorLiquidoNum.toFixed(2).replace('.', ',')}</strong></td>
                </tr>
                <tr class="total-final">
                    <td><strong>Valor a Receber</strong></td>
                    <td></td>
                    <td class="valor"><strong>R$ ${valorReceberNum.toFixed(2).replace('.', ',')}</strong></td>
                </tr>
            </tbody>
        </table>

        <!-- Observações -->
        <div class="observacoes" style="margin: 16px 0; padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9;">
            <strong>Observações:</strong><br>
            ${observacoes && observacoes.trim() !== ''
                ? observacoes
                : `Recibo de horas extras referente ao período ${periodo}. Total de horas: ${Number(totalHoras || 0).toFixed(2).replace('.', ',')} h.`}
        </div>

        <!-- Data do recibo -->
        <div class="data-recibo">
            ${(empresa && empresa.cidade) ? empresa.cidade : 'São Miguel do Guamá - PA'}, ${dataEmissao}
        </div>

        <!-- Assinaturas -->
        <div class="assinaturas">
            <div class="assinatura-bloco">
                <div class="linha-assinatura"></div>
                <div class="assinatura-label">FUNCIONÁRIO</div>
                <div class="assinatura-dados">
                    ${nomeFuncionario}<br>
                    CPF: ${cpf}
                </div>
            </div>
            <div class="assinatura-bloco">
                <div class="linha-assinatura"></div>
                <div class="assinatura-label">RESPONSÁVEL PELO PAGAMENTO</div>
                <div class="assinatura-dados">
                    ${(empresa && (empresa.nome || empresa.name)) || 'Empresa'}<br>
                    CNPJ: ${empresa && empresa.cnpj ? empresa.cnpj : 'N/A'}
                </div>
            </div>
        </div>

        <!-- Rodapé -->
        <div class="footer" style="margin-top: 40px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
            Este documento serve como comprovante de pagamento e deve ser conservado pelo funcionário.<br>
            Emitido em ${dataEmissao} às ${new Date().toLocaleTimeString('pt-BR')}
        </div>
    </div>
    </div>
    ${this.getReciboAutoFitScript()}
</body>
</html>`;
    }

    /**
     * 🏢 OBTER DADOS DA EMPRESA DO BANCO
     */
    async obterDadosEmpresa() {
        try {
            const normalizeLogo = (value) => {
                if (!value) return '';
                const s = String(value).trim();
                if (!s) return '';
                if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('file:')) return s;
                if (/^https?:\/\//i.test(s)) return s;
                if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 80) return `data:image/png;base64,${s}`;
                if (/^(\.\/|\.\.\/|\/)/.test(s) || /\.(png|jpg|jpeg|webp|svg)$/i.test(s)) return s;
                return s;
            };

            const centralSvc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (centralSvc && typeof centralSvc.getCompanyProfileForReport === 'function') {
                try {
                    const centralResult = await centralSvc.getCompanyProfileForReport();
                    const centralData = centralResult && centralResult.success !== false
                        ? (centralResult.data || centralResult)
                        : null;
                    if (centralData && typeof centralData === 'object') {
                        const logoCandidate = centralData.logoUrl || centralData.logoURL || centralData.logoDownloadURL || centralData.logoStoragePath || centralData.logoPath || centralData.logo || centralData.logoBase64 || centralData.logoData || '';
                        return { ...centralData, logo: normalizeLogo(logoCandidate) };
                    }
                } catch (error) {
                    console.warn('Aviso ao obter empresa pelo helper central:', error);
                }
            }

            const resolveCompanyId = () => {
                try {
                    const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
                    if (svc && typeof svc.getCurrentTenantId === 'function') {
                        const t = svc.getCurrentTenantId();
                        if (t) return String(t);
                    }
                    if (svc && typeof svc.getTenantId === 'function') {
                        const t = svc.getTenantId();
                        if (t) return String(t);
                    }
                } catch (_) {}
                try {
                    if (window.appTenantId) return String(window.appTenantId);
                    const stored = localStorage.getItem('company_info');
                    if (stored) {
                        const obj = JSON.parse(stored);
                        const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                        if (id) return String(id);
                    }
                } catch (_) {}
                // Fallback via currentUser / persistentUser
                try {
                    const cu = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
                    const pu = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
                    const id = cu.companyId || cu.tenantId || pu.companyId || pu.tenantId;
                    if (id) return String(id);
                } catch (_) {}
                return null;
            };

            const tenantId = resolveCompanyId();
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            let companyData = {};

            if (tenantId && svc && typeof svc.setTenantId === 'function') {
                try { svc.setTenantId(tenantId); } catch (_) {}
            }

            // ✅ ESTÁGIO 1: Perfil /profile — fonte canônica pequena para cabeçalhos
            if (tenantId && typeof window.getData === 'function') {
                try {
                    const byPath = await window.getData(`companies/${tenantId}/profile`, { debounceMs: 0 });
                    if (byPath && typeof byPath === 'object' && (byPath.nome || byPath.name)) {
                        companyData = { ...companyData, ...byPath, id: tenantId, companyId: tenantId, tenantId: tenantId };
                    }
                } catch (_) {}
            }

            if (tenantId && (!companyData || (!companyData.nome && !companyData.name))) {
                try {
                    const companyPayload = typeof window.getData === 'function' ? await window.getData(`companies/${tenantId}/profile`, { debounceMs: 0 }) : (typeof getData === 'function' ? await getData(`companies/${tenantId}/profile`, { debounceMs: 0 }) : null);
                    if (companyPayload && typeof companyPayload === 'object') {
                        companyData = { ...companyData, ...companyPayload, id: tenantId, companyId: tenantId, tenantId: tenantId };
                    }
                } catch (e) {
                    console.warn("Aviso ao tentar obter companyData via getData:", e);
                }
            }

            if (!companyData || (!companyData.nome && !companyData.name)) {
                try {
                    const raw = localStorage.getItem('company_info');
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        companyData = { ...companyData, ...parsed };
                    }
                } catch (_) {}
            }

            const dadosPadrao = {
                nome: "Empresa não informada",
                name: "Empresa não informada",
                cnpj: "-",
                endereco: "-",
                address: "-",
                cidade: "-",
                city: "-",
                estado: "-",
                state: "-",
                telefone: "-",
                phone: "-",
                email: "-",
                logo: "",
                logoSvg: true
            };

            const empresaFinal = { ...dadosPadrao, ...(companyData || {}) };

            const nameResolved = empresaFinal.name || empresaFinal.nome;
            if (nameResolved) {
                empresaFinal.nome = nameResolved;
                empresaFinal.name = nameResolved;
            }
            const addressResolved = empresaFinal.address || empresaFinal.endereco;
            if (addressResolved) {
                empresaFinal.endereco = addressResolved;
                empresaFinal.address = addressResolved;
            }
            const cityResolved = empresaFinal.city || empresaFinal.cidade;
            if (cityResolved) {
                empresaFinal.cidade = cityResolved;
                empresaFinal.city = cityResolved;
            }
            const stateResolved = empresaFinal.state || empresaFinal.estado;
            if (stateResolved) {
                empresaFinal.estado = stateResolved;
                empresaFinal.state = stateResolved;
            }
            const phoneResolved = empresaFinal.phone || empresaFinal.telefone;
            if (phoneResolved) {
                empresaFinal.telefone = phoneResolved;
                empresaFinal.phone = phoneResolved;
            }
            const logoCandidate = empresaFinal.logoUrl || empresaFinal.logoURL || empresaFinal.logoDownloadURL || empresaFinal.logoStoragePath || empresaFinal.logoPath || empresaFinal.logo || empresaFinal.logoBase64 || empresaFinal.logoData || '';
            empresaFinal.logo = normalizeLogo(logoCandidate);

            return empresaFinal;
        } catch (error) {
            console.error("Erro ao obter dados da empresa:", error);
            return {
                nome: "Empresa não informada",
                cnpj: "-",
                endereco: "-",
                cidade: "-",
                estado: "-",
                telefone: "-",
                logoSvg: true
            };
        }
    }

    // (movido para fora da classe)

    /**
     * 📄 GERAR HTML DO RECIBO DETALHADO
     */
    async gerarHtmlReciboDetalhado(empresa, funcionario, lancamento, valores) {
        const mesAno = this.formatMesAno(lancamento.mesAno);
        const dataEmissao = new Date().toLocaleDateString('pt-BR');
        const tipoPagamento = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
            ? window.FolhaUtils.resolveTipoPagamento(lancamento)
            : (String((lancamento && (lancamento.tipoPagamento || lancamento.tipo || lancamento.tipoFolha)) || 'mes').toLowerCase().includes('quinz') ? 'quinzena' : 'mes');
        const tipoFolha = tipoPagamento === 'quinzena' ? 'QUINZENA' : 'FOLHA MENSAL';
        const percentualQuinzena = lancamento.quinzenaPercentual || lancamento.percentualQuinzena || 50;
        const isQuinzena = tipoPagamento === 'quinzena';
        const usarBruto = Boolean(lancamento.usarSalarioBrutoParaQuinzena);
        const mostrarBonificacoesRow = !(isQuinzena && usarBruto);

        // Normalização de números para evitar erros de toFixed
        const toNum = (x) => Number(x || 0);
        const salarioBaseNum = toNum(valores.salarioBase);
        const horasExtrasNum = toNum(valores.horasExtras);
        const bonificacoesNum = toNum(valores.bonificacoes);
        const premioAssiduidadeNum = toNum(valores.premioAssiduidade);
        const periculosidadeNum = toNum(valores.periculosidade);
        const adicionalNoturnoNum = toNum(valores.adicionalNoturno);
        const insalubridadeNum = toNum(valores.insalubridade);
        const salarioFamiliaNum = toNum(valores.salarioFamilia);
        const inssNum = toNum(valores.inss);
        const irrfNum = toNum(valores.irrf);
        const valesNum = toNum(valores.vales);
        const valesDetalhados = this.normalizarValesDetalhados(lancamento);
        const escapeHtml = (value) => String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const formatarDataVale = (data) => (window.FolhaUtils && typeof window.FolhaUtils.formatarDataBR === 'function')
            ? window.FolhaUtils.formatarDataBR(data)
            : (data || 'Sem data');
        const valesDetalhadosRows = valesDetalhados.length ? valesDetalhados.map((vale) => `
                    <tr>
                        <td>Vale</td>
                        <td>${escapeHtml(formatarDataVale(vale.data))}${vale.observacao ? ` - ${escapeHtml(vale.observacao)}` : ''}</td>
                        <td class="valor">R$ ${Number(vale.valor || 0).toFixed(2).replace('.', ',')}</td>
                    </tr>`).join('') : '';
        const totalValesRow = valesDetalhados.length > 1 ? `
                    <tr class="total-row">
                        <td><strong>Total Vales</strong></td>
                        <td></td>
                        <td class="valor"><strong>R$ ${valesNum.toFixed(2).replace('.', ',')}</strong></td>
                    </tr>` : '';
        const outrosDescontosNum = toNum(valores.outrosDescontos);
        const descontoFaltasNum = toNum(valores.descontoFaltas);
        const descontoRepousoRemuneradoNum = toNum(valores.descontoRepousoRemunerado);
        const descontoINSSManualNum = toNum(valores.descontoINSSManual);
        const inssReciboNum = inssNum > 0 ? inssNum : descontoINSSManualNum;
        const contribuicaoConfederativaNum = toNum(valores.contribuicaoConfederativa);
        const contribuicaoSindicalNum = toNum(valores.contribuicaoSindical);
        const descontoIRPJNum = toNum(valores.descontoIRPJ);
        const emprestimoConsignadoNum = toNum(valores.emprestimoConsignado);
        const valorQuinzenaNum = toNum(valores.valorQuinzena);
        const totalAcrescimosNum = toNum(valores.totalAcrescimos);
        const totalDescontosNum = toNum(valores.totalDescontos);
        const salarioLiquidoNum = toNum(valores.salarioLiquido);
        const statusRecibo = String((window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function')
            ? window.FolhaUtils.normalizarStatus(lancamento.status)
            : (lancamento && lancamento.status) || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[^a-z_]/g, '');
        const quinzenaJaBaixada = isQuinzena && (statusRecibo === 'quinzena_paga' || statusRecibo === 'quinzenapaga');
        const quinzenaMesFechado = isQuinzena && (statusRecibo === 'mes_fechado' || statusRecibo === 'mesfechado');
        const quinzenaAberta = isQuinzena && !quinzenaJaBaixada && !quinzenaMesFechado;
        const valorQuinzenaReciboNum = isQuinzena && window.FolhaUtils && typeof window.FolhaUtils.calcularValorQuinzena === 'function'
            ? Number(window.FolhaUtils.calcularValorQuinzena(lancamento) || valorQuinzenaNum || 0)
            : valorQuinzenaNum;
        const quinzenaComoDesconto = valorQuinzenaReciboNum > 0 && (!isQuinzena || quinzenaJaBaixada || quinzenaMesFechado);
        const valorQuinzenaDescontoNum = quinzenaComoDesconto ? valorQuinzenaReciboNum : 0;
        const totalDescontosReciboNum = totalDescontosNum + valorQuinzenaDescontoNum;
        // Fallback robusto para salário líquido e valor a receber
        const totalProventosNumCalc = salarioBaseNum + totalAcrescimosNum;
        const salarioLiquidoCalcNum = (Number.isFinite(salarioLiquidoNum) && salarioLiquidoNum !== 0)
            ? salarioLiquidoNum
            : (totalProventosNumCalc - totalDescontosReciboNum);
        const valorReceberReciboNum = quinzenaAberta && valorQuinzenaReciboNum > 0
            ? valorQuinzenaReciboNum
            : salarioLiquidoCalcNum;
        const salarioLiquidoResumoLabel = quinzenaAberta ? 'Valor da Quinzena' : 'Salário Líquido';
        const salarioLiquidoResumoNum = quinzenaAberta ? valorReceberReciboNum : salarioLiquidoCalcNum;

        // ⚙️ Notas opcionais (encargos) controladas por FolhaConfig.POLITICAS.mostrarNotasEncargos
        const politicas = (window.FolhaConfig && window.FolhaConfig.POLITICAS) || {};
        const mostrarNotas = politicas.mostrarNotasEncargos !== false;
        const contrato = String((lancamento && lancamento.funcionario && lancamento.funcionario.tipoContrato) || '').toLowerCase();
        const naoCLT = ['temporario','terceirizado','estagio','estagiario'].includes(contrato);
        const usarNotaEncargos = mostrarNotas && naoCLT;
        const usarNotaInssManual = mostrarNotas && (lancamento && lancamento.descontoINSSManual > 0);
        const notasHtml = `${usarNotaEncargos ? '<div class=\"nota-discreta\">(Encargos automáticos suprimidos para vínculo não-CLT)</div>' : ''}${usarNotaInssManual ? '<div class=\"nota-discreta\">(INSS manual aplicado)</div>' : ''}`;
        const lancamentoQuitado = (window.FolhaUtils && typeof window.FolhaUtils.lancamentoContaNoResumo === 'function')
            ? !window.FolhaUtils.lancamentoContaNoResumo(lancamento)
            : false;
        const valorPagoLancamentoNum = window.FolhaUtils && typeof window.FolhaUtils.calcularValorPagoLancamento === 'function'
            ? Number(window.FolhaUtils.calcularValorPagoLancamento(lancamento) || 0)
            : 0;
        const valorFinalLabel = lancamentoQuitado ? 'Valor Pago' : 'Valor a Receber';
        const valorFinalNum = lancamentoQuitado ? valorPagoLancamentoNum : valorReceberReciboNum;

        return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recibo de Pagamento - ${funcionario.nome}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            font-size: 12px;
            line-height: 1.4;
        }
        
        /* Cabeçalho baseado no romaneiopct */
        .header {
            display: flex;
            margin-bottom: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            align-items: flex-start;
        }
        
        .logo {
            width: 120px;
            text-align: center;
            margin-right: 20px;
            flex-shrink: 0;
        }
        
        .logo img {
            max-width: 100%;
            height: auto;
            max-height: 100px;
        }
        
        .logo svg {
            width: 80px;
            height: 80px;
        }
        
        .company-info {
            flex: 1;
            padding-left: 15px;
            min-width: 0;
        }
        
        .company-name {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #2c3e50;
            text-transform: uppercase;
        }
        
        .company-details {
            font-size: 12px;
            margin-bottom: 4px;
            color: #555;
            line-height: 1.3;
        }
        
        .title {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin: 20px 0;
            text-transform: uppercase;
            color: #2c3e50;
            border: 2px solid #2c3e50;
            padding: 10px;
            background-color: #f8f9fa;
        }
        
        /* Informações do funcionário */
        .funcionario-info {
            margin-bottom: 20px;
            border: 1px solid #ddd;
            padding: 15px;
            background-color: #f9f9f9;
        }
        
        .info-row {
            display: grid;
            grid-template-columns: minmax(108px, max-content) minmax(0, 1fr) minmax(108px, max-content) minmax(0, 1fr);
            gap: 4px 10px;
            align-items: start;
            margin-bottom: 8px;
        }
        
        .info-label {
            font-weight: bold;
            min-width: 0;
        }
        
        .info-value {
            min-width: 0;
            overflow-wrap: anywhere;
            word-break: normal;
        }
        
        /* Tabela de detalhes */
        .detalhes-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            table-layout: fixed;
        }
        
        .detalhes-table th, 
        .detalhes-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-size: 11px;
            word-break: break-word;
            overflow-wrap: anywhere;
        }
        
        .detalhes-table th {
            background-color: #0d2339;
            color: white;
            font-weight: bold;
            text-align: center;
            text-transform: uppercase;
        }
        
        .detalhes-table .valor {
            text-align: right;
            font-family: 'Courier New', monospace;
            font-weight: bold;
            white-space: nowrap;
            word-break: normal;
            overflow-wrap: normal;
        }
        
        .total-row {
            background-color: #e3f2fd;
            font-weight: bold;
        }
        
        .total-final {
            background-color: #1976d2;
            color: white;
            font-size: 14px;
        }
        /* Layout em duas colunas para Proventos x Descontos */
        .duas-colunas {
            display: flex;
            gap: 16px;
            align-items: flex-start;
            margin-bottom: 16px;
        }
        .coluna {
            flex: 1;
            min-width: 0;
        }
        /* Layout adaptativo de impressão (A4) */
        :root {
            --a4-width-px: 793;   /* 8.27in * 96dpi */
            --a4-height-px: 1122; /* 11.69in * 96dpi */
            --print-margin-px: 48; /* ~12mm em px aproximado */
        }
        .recibo-page {
            max-width: calc(var(--a4-width-px) - 2 * var(--print-margin-px));
            width: 100%;
            margin: 0 auto;
            padding: 0;
            box-sizing: border-box;
        }
        .recibo-scale {
            transform-origin: top left;
            will-change: transform;
        }
        @page {
            margin: 12mm;
        }
        @media (max-width: 680px) {
            .info-row {
                grid-template-columns: minmax(100px, max-content) minmax(0, 1fr);
            }
        }
        @media print and (orientation: landscape) {
            :root {
                --a4-width-px: 1122;
                --a4-height-px: 793;
                --print-margin-px: 40;
            }
        }
        @media print {
            html, body {
                margin: 0;
                padding: 0;
            }
            .detalhes-table, .detalhes-table th, .detalhes-table td { box-sizing: border-box; }
            .recibo-page {
                width: 100%;
                max-width: none;
                height: auto;
                min-height: 0;
                margin: 0 auto;
                padding: 0;
                overflow: visible;
                page-break-inside: auto;
                break-inside: auto;
            }
            #recibo-content {
                width: 100%;
                max-width: 100%;
                transform: none !important;
                zoom: 1 !important;
                page-break-inside: auto;
                break-inside: auto;
            }
        }
        .grupo-titulo {
            font-weight: bold;
            text-transform: uppercase;
            margin: 8px 0;
            color: #2c3e50;
        }
        
        /* Seção de assinaturas */
        .assinaturas {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
        }
        
        .assinatura-bloco {
            text-align: center;
            width: 45%;
        }
        
        .linha-assinatura {
            border-top: 1px solid #333;
            margin-top: 40px;
            padding-top: 5px;
            font-weight: bold;
        }
        .assinatura-label {
            margin-top: 6px;
            font-weight: bold;
            font-size: 11px;
        }
        .assinatura-dados {
            margin-top: 4px;
            font-size: 10px;
        }
        .nota-discreta {
            font-size: 11px;
            color: #666;
            margin-top: 4px;
        }
        
        .data-recibo {
            text-align: right;
            margin-top: 30px;
            font-style: italic;
        }
        
        @media print {
            body { margin: 0; }
            .header { margin-bottom: 12px; padding-bottom: 10px; }
            /* Compactação adicional para caber em uma página */
            body { font-size: 11px; line-height: 1.3; }
            .logo img { max-height: 70px; }
            .logo svg { width: 60px; height: 60px; }
            .company-name { font-size: 18px; margin-bottom: 6px; }
            .company-details { font-size: 11px; line-height: 1.25; }
            .title { font-size: 16px; margin: 12px 0; padding: 6px; border-width: 1px; }

            .funcionario-info { margin-bottom: 12px; padding: 10px; }
            .funcionario-info .info-row { margin-bottom: 6px; }
            .info-label { min-width: 0; }
            .info-value { min-width: 0; overflow-wrap: anywhere; }
            .duas-colunas { gap: clamp(8px, calc(12px * var(--fs, 1)), 12px); }

            .detalhes-table { font-size: clamp(8.5px, calc(10px * var(--fs, 1)), 10px); }
            .detalhes-table th, .detalhes-table td {
                padding: clamp(2px, calc(4px * var(--fs, 1)), 4px) clamp(3px, calc(6px * var(--fs, 1)), 6px);
                vertical-align: top;
            }
            .detalhes-table td:not(.valor),
            .detalhes-table th:not(:last-child) {
                white-space: normal !important;
                word-break: break-word !important;
                overflow-wrap: anywhere !important;
            }
            .detalhes-table th {
                background-color: #0d2339 !important;
                color: white !important;
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }
            .detalhes-table .valor {
                white-space: nowrap !important;
                word-break: normal !important;
                overflow-wrap: normal !important;
                font-family: 'Consolas', 'Courier New', monospace;
                font-variant-numeric: tabular-nums;
            }
            .grupo-titulo { margin: 6px 0; }
            .total-final {
                background-color: #1976d2 !important;
                color: white !important;
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }

            .observacoes { page-break-inside: avoid; break-inside: avoid; margin-top: 10px; padding: 6px; }
            .data-recibo { margin-top: 12px; }

            .assinaturas { margin-top: 16px; }
            .assinatura-bloco { margin-top: 8px; }
            .linha-assinatura { margin-top: 12px; }

            .recibo-page, #recibo-content, .duas-colunas, .detalhes-table {
                page-break-inside: auto;
                break-inside: auto;
            }
            .detalhes-table tr, .assinaturas, .footer, .total-row, .total-final, .data-recibo {
                page-break-inside: avoid; break-inside: avoid;
            }
            .observacoes { page-break-inside: avoid; break-inside: avoid; }
        }
        ${this.getReciboAutoFitStyles()}
    </style>
</head>
<body>
    <div id="recibo-page" class="recibo-page">
    <div id="recibo-content" class="recibo-scale">
    <!-- Cabeçalho com logo e dados da empresa -->
    <div class="header">
        <div class="logo">
            ${empresa.logo && empresa.logo.trim() !== '' ? 
                `<img src="${empresa.logo}" alt="Logo da Empresa" />` : 
                `<svg viewBox="0 0 100 100" style="width: 80px; height: 80px;">
                    <circle cx="50" cy="50" r="45" fill="#2c3e50" stroke="#34495e" stroke-width="2"/>
                    <text x="50" y="60" text-anchor="middle" fill="white" font-size="24" font-weight="bold">JN</text>
                </svg>`
            }
        </div>
        <div class="company-info">
            <div class="company-name">${empresa.nome || empresa.name}</div>
            <div class="company-details">CNPJ: ${empresa.cnpj}</div>
            <div class="company-details">${empresa.endereco || empresa.address}</div>
            ${notasHtml}
            <div class="company-details">${empresa.cidade || empresa.city} - ${empresa.estado || empresa.state}</div>
            <div class="company-details">Fone: ${empresa.telefone || empresa.phone}</div>
            ${empresa.email ? `<div class="company-details">Email: ${empresa.email}</div>` : ''}
        </div>
    </div>
    
    <!-- Título do documento -->
    <div class="title">RECIBO DE PAGAMENTO - ${tipoFolha}</div>
    
    <!-- Informações do funcionário -->
    <div class="funcionario-info">
        <div class="info-row">
            <div class="info-label">Funcionário:</div>
            <div class="info-value">${funcionario.nome}</div>
            <div class="info-label">Período:</div>
            <div class="info-value">${mesAno}</div>
        </div>
        <div class="info-row">
            <div class="info-label">CPF:</div>
            <div class="info-value">${funcionario.cpf || 'N/A'}</div>
            <div class="info-label">Data Emissão:</div>
            <div class="info-value">${dataEmissao}</div>
        </div>
        <div class="info-row">
            <div class="info-label">PIS:</div>
            <div class="info-value">${funcionario.pis || 'N/A'}</div>
            <div class="info-label">Cargo:</div>
            <div class="info-value">${funcionario.cargo || 'N/A'}</div>
        </div>
        <div class="info-row">
            <div class="info-label">CTPS:</div>
            <div class="info-value">${funcionario.ctps || 'N/A'}</div>
            <div class="info-label">Salário Base:</div>
            <div class="info-value">R$ ${salarioBaseNum.toFixed(2).replace('.', ',')}</div>
        </div>
        <div class="info-row">
            <div class="info-label">Data Admissional:</div>
            <div class="info-value">${funcionario.dataAdmissional ? new Date(funcionario.dataAdmissional).toLocaleDateString('pt-BR') : 'N/A'}</div>
            <div class="info-label">Tipo Contrato:</div>
            <div class="info-value">${funcionario.tipoContrato ? funcionario.tipoContrato.toUpperCase() : 'N/A'}</div>
        </div>
    </div>
    
    <!-- Proventos x Descontos (duas colunas) -->
    <div class="duas-colunas">
        <!-- PROVENTOS / CRÉDITOS -->
        <div class="coluna">
            <div class="grupo-titulo">Proventos (Créditos)</div>
                <table class="detalhes-table proventos-table">
                <colgroup>
                    <col style="width: 44%;">
                    <col style="width: 30%;">
                    <col style="width: 26%;">
                </colgroup>
                <thead>
                    <tr>
                        <th>Descrição</th>
                        <th>Referência</th>
                        <th>Valor</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- SALÁRIO BASE -->
                    <tr>
                        <td><strong>SALÁRIO BASE</strong></td>
                        <td>Salário Contratual</td>
                        <td class="valor">R$ ${salarioBaseNum.toFixed(2).replace('.', ',')}</td>
                    </tr>
                    
                    <!-- ACRÉSCIMOS -->
                    ${horasExtrasNum > 0 ? `
                    <tr>
                        <td>Horas Extras</td>
                        <td>${(lancamento.horasExtras || 0)}h x ${(lancamento.percentualExtra || 50)}%</td>
                        <td class="valor">R$ ${horasExtrasNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    ${mostrarBonificacoesRow && bonificacoesNum > 0 ? `
                    <tr>
                        <td>Bonificações</td>
                        <td>Valor Adicional</td>
                        <td class="valor">R$ ${bonificacoesNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    ${periculosidadeNum > 0 ? `
                    <tr>
                        <td>Adicional de Periculosidade</td>
                        <td>30% do Salário Base</td>
                        <td class="valor">R$ ${periculosidadeNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    ${adicionalNoturnoNum > 0 ? `
                    <tr>
                        <td>Adicional Noturno</td>
                        <td>20% sobre horas noturnas</td>
                        <td class="valor">R$ ${adicionalNoturnoNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    ${insalubridadeNum > 0 ? `
                    <tr>
                        <td>Adicional de Insalubridade</td>
                        <td>Grau médio/máximo</td>
                        <td class="valor">R$ ${insalubridadeNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    ${salarioFamiliaNum > 0 ? `
                    <tr>
                        <td>Salário Família</td>
                        <td>${lancamento.quantidadeFilhos || 0} filho(s)</td>
                        <td class="valor">R$ ${salarioFamiliaNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    ${premioAssiduidadeNum > 0 ? `
                    <tr>
                        <td>Prêmio de Assiduidade</td>
                        <td>Valor Informado</td>
                        <td class="valor">R$ ${premioAssiduidadeNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    <!-- TOTAL PROVENTOS (Salário Base + Acréscimos) -->
                    <tr class="total-row">
                        <td><strong>TOTAL PROVENTOS</strong></td>
                        <td></td>
                        <td class="valor"><strong>R$ ${( (salarioBaseNum + totalAcrescimosNum) ).toFixed(2).replace('.', ',')}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>
        
        <!-- DESCONTOS / DÉBITOS -->
        <div class="coluna">
            <div class="grupo-titulo">Descontos (Débitos)</div>
            <table class="detalhes-table descontos-table">
                <colgroup>
                    <col style="width: 34%;">
                    <col style="width: 40%;">
                    <col style="width: 26%;">
                </colgroup>
                <thead>
                    <tr>
                        <th>Descrição</th>
                        <th>Referência</th>
                        <th>Valor</th>
                    </tr>
                </thead>
                <tbody>
                    ${inssReciboNum > 0 ? `
                    <tr>
                        <td>INSS</td>
                        <td>Previdência Social</td>
                        <td class="valor">R$ ${inssReciboNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    ${irrfNum > 0 ? `
                    <tr>
                        <td>IRRF</td>
                        <td>Imposto de Renda</td>
                        <td class="valor">R$ ${irrfNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    ${valesNum > 0 ? (valesDetalhados.length ? `${valesDetalhadosRows}${totalValesRow}` : `
                    <tr>
                        <td>Vales</td>
                        <td>Adiantamentos</td>
                        <td class="valor">R$ ${valesNum.toFixed(2).replace('.', ',')}</td>
                    </tr>`) : ''}
                    
                    ${outrosDescontosNum > 0 ? `
                    <tr>
                        <td>Outros Descontos</td>
                        <td>Diversos</td>
                        <td class="valor">R$ ${outrosDescontosNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    ${descontoFaltasNum > 0 ? `
                    <tr>
                        <td>Desconto por Faltas</td>
                        <td>${lancamento.faltas || 0} dia(s)</td>
                        <td class="valor">R$ ${descontoFaltasNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    ${descontoRepousoRemuneradoNum > 0 ? `
                    <tr>
                        <td>Desc. Repouso Remunerado</td>
                        <td>Manual</td>
                        <td class="valor">R$ ${descontoRepousoRemuneradoNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    ${contribuicaoConfederativaNum > 0 ? `
                    <tr>
                        <td>Contribuição Confederativa</td>
                        <td>Sindical</td>
                        <td class="valor">R$ ${contribuicaoConfederativaNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    ${contribuicaoSindicalNum > 0 ? `
                    <tr>
                        <td>Contribuição Sindical</td>
                        <td>Sindical</td>
                        <td class="valor">R$ ${contribuicaoSindicalNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    ${descontoIRPJNum > 0 ? `
                    <tr>
                        <td>Desconto IRPJ</td>
                        <td>Imposto</td>
                        <td class="valor">R$ ${descontoIRPJNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    ${emprestimoConsignadoNum > 0 ? `
                    <tr>
                        <td>Empréstimo Consignado CLT</td>
                        <td>Financeira</td>
                        <td class="valor">R$ ${emprestimoConsignadoNum.toFixed(2).replace('.', ',')}</td>
                    </tr>` : ''}
                    
                    <!-- QUINZENA COMO DÉBITO (se aplicável) -->
                    ${quinzenaComoDesconto ? `
                    <tr class="total-row">
                        <td><strong>QUINZENA (${percentualQuinzena}%)</strong></td>
                        <td>Pagamento Antecipado</td>
                        <td class="valor"><strong>R$ ${valorQuinzenaDescontoNum.toFixed(2).replace('.', ',')}</strong></td>
                    </tr>` : ''}
                    
                    <!-- TOTAL DESCONTOS -->
                    <tr class="total-row">
                        <td><strong>TOTAL DESCONTOS</strong></td>
                        <td></td>
                        <td class="valor"><strong>R$ ${totalDescontosReciboNum.toFixed(2).replace('.', ',')}</strong></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Resumo final -->
    <table class="detalhes-table resumo-table">
        <colgroup>
            <col style="width: 56%;">
            <col style="width: 16%;">
            <col style="width: 28%;">
        </colgroup>
        <thead>
            <tr>
                <th>Resumo</th>
                <th></th>
                <th>Valor</th>
            </tr>
        </thead>
        <tbody>
            <tr class="total-row">
                <td><strong>Total Proventos</strong></td>
                <td></td>
                <td class="valor"><strong>R$ ${( (salarioBaseNum + totalAcrescimosNum) ).toFixed(2).replace('.', ',')}</strong></td>
            </tr>
            <tr class="total-row">
                <td><strong>Total Descontos</strong></td>
                <td></td>
                <td class="valor"><strong>R$ ${totalDescontosReciboNum.toFixed(2).replace('.', ',')}</strong></td>
            </tr>
            <tr class="total-row">
                <td><strong>${salarioLiquidoResumoLabel}</strong></td>
                <td></td>
                <td class="valor"><strong>R$ ${salarioLiquidoResumoNum.toFixed(2).replace('.', ',')}</strong></td>
            </tr>
            <tr class="total-final">
                <td><strong>${valorFinalLabel}</strong></td>
                <td></td>
                <td class="valor"><strong>R$ ${valorFinalNum.toFixed(2).replace('.', ',')}</strong></td>
            </tr>
        </tbody>
    </table>
    
    <!-- Observações -->
    <div class="observacoes" style="margin: 16px 0; padding: 8px; border: 1px solid #ddd; background-color: #f9f9f9;">
        <strong>Observações:</strong><br>
        ${lancamento.observacoes || 'Nenhuma observação adicional.'}
    </div>
    
    <!-- Data do recibo -->
    <div class="data-recibo">
        São Miguel do Guamá - PA, ${dataEmissao}
    </div>
    
    <!-- Assinaturas -->
    <div class="assinaturas">
        <div class="assinatura-bloco">
            <div class="linha-assinatura"></div>
            <div class="assinatura-label">FUNCIONÁRIO</div>
            <div class="assinatura-dados">
                ${funcionario.nome}<br>
                CPF: ${funcionario.cpf || 'N/A'}
            </div>
        </div>
        
        <div class="assinatura-bloco">
            <div class="linha-assinatura"></div>
            <div class="assinatura-label">RESPONSÁVEL PELO PAGAMENTO</div>
            <div class="assinatura-dados">
                ${empresa.nome || empresa.name}<br>
                CNPJ: ${empresa.cnpj}
            </div>
        </div>
    </div>
    
    <!-- Rodapé legal -->
    <div class="footer" style="margin-top: 40px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 10px;">
        Este documento serve como comprovante de pagamento e deve ser conservado pelo funcionário.<br>
        Emitido em ${dataEmissao} às ${new Date().toLocaleTimeString('pt-BR')}
    </div>
    ${this.getReciboAutoFitScript()}
    </div>
    </div>
</body>
</html>`;
    }
    
    /**
     * ❌ FECHAR MODAL RELATÓRIO
     */
    closeRelatorioModal() {
        const modal = document.getElementById('relatorioModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    /**
     * 📢 MOSTRAR NOTIFICAÇÃO
     */
    showNotification(message, type = 'info') {
        // Usar sistema de toast unificado
        if (window.FolhaUtils && window.FolhaUtils.showToast) {
            window.FolhaUtils.showToast(message, type);
        } else {
            // Fallback para console apenas (sem alert)
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    // =================== NOVOS RELATÓRIOS ===================
    async gerarRelatorioQuinzenaLegado(folhas, mes, ano) {
        const folhasQ = (folhas || []).filter(f => ((f && f.tipo) === 'quinzena'));
        const header = await this._gerarCabecalhoPadrao('RELATÓRIO DE QUINZENA', mes, ano);
        
        // Calcular totais gerais
        const totaisBonificacoes = folhasQ.reduce((acc, f) => acc + (Number(((f && f.valores && f.valores.bonificacoes) || 0))), 0);
        const totaisLiquido = folhasQ.reduce((acc, f) => acc + (Number(((f && f.valores && f.valores.liquido) || 0))), 0);
        
        const linhas = folhasQ.map(f => {
            const perc = (((f && f.quinzena && f.quinzena.percentual) != null)) ? `${Math.round(((f.quinzena.percentual || 0)*100))}%` : '-';
            const val = Number(((f && f.quinzena && f.quinzena.valorManual) || 0)) > 0 ? `R$ ${Number(f.quinzena.valorManual).toFixed(2)}` : perc;
            return `<tr>
                <td>${(((f && f.funcionario && f.funcionario.nome) || ''))}</td>
                <td>${(((f && f.funcionario && f.funcionario.cargo) || ''))}</td>
                <td>${val}</td>
                <td style="text-align:right;">R$ ${(Number(((f && f.valores && f.valores.bonificacoes) || 0)).toFixed(2))}</td>
                <td style="text-align:right;">R$ ${(Number(((f && f.valores && f.valores.liquido) || 0)).toFixed(2))}</td>
            </tr>`;
        }).join('');
        return `${header}
            <table class="relatorio-table">
                <thead><tr><th>Nome</th><th>Cargo</th><th>%/Valor</th><th>Bonificações</th><th>Líquido</th></tr></thead>
                <tbody>${linhas}</tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="3"><strong>TOTAIS GERAIS:</strong></td>
                        <td style="text-align:right;"><strong>R$ ${totaisBonificacoes.toFixed(2)}</strong></td>
                        <td style="text-align:right;"><strong>R$ ${totaisLiquido.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>`;
    }

    async gerarRelatorioFechamentoComAbatimentoLegado(folhas, mes, ano) {
        const folhasM = (folhas || []).filter(f => (((f && f.tipo) || 'mes') === 'mes'));
        const header = await this._gerarCabecalhoPadrao('RELATÓRIO DE FECHAMENTO', mes, ano);
        
        // Calcular totais gerais
        const totaisBruto = folhasM.reduce((acc, f) => acc + (Number(((f && f.valores && f.valores.bruto) || 0))), 0);
        const totaisINSS = folhasM.reduce((acc, f) => acc + (Number(((f && f.valores && f.valores.descontos && f.valores.descontos.inss) || 0))), 0);
        const totaisSindicato = folhasM.reduce((acc, f) => acc + (Number(((f && f.valores && f.valores.descontos && f.valores.descontos.sindicato) || 0))), 0);
        const totaisOutros = folhasM.reduce((acc, f) => acc + (Number(((f && f.valores && f.valores.descontos && f.valores.descontos.outros) || 0))), 0);
        const totaisAbatimento = folhasM.reduce((acc, f) => acc + (Number(((f && f.fechamento && f.fechamento.abatimentos && f.fechamento.abatimentos.quinzenaPago) || 0))), 0);
        const totaisLiquido = folhasM.reduce((acc, f) => acc + (Number(((f && f.fechamento && f.fechamento.saldoFinalLiquido) || (f && f.valores && f.valores.liquido) || 0))), 0);
        
        const linhas = folhasM.map(f => {
            const bruto = Number(((f && f.valores && f.valores.bruto) || 0));
            const inss = Number(((f && f.valores && f.valores.descontos && f.valores.descontos.inss) || 0));
            const sind = Number(((f && f.valores && f.valores.descontos && f.valores.descontos.sindicato) || 0));
            const outros = Number(((f && f.valores && f.valores.descontos && f.valores.descontos.outros) || 0));
            const abat = Number(((f && f.fechamento && f.fechamento.abatimentos && f.fechamento.abatimentos.quinzenaPago) || 0));
            const liquido = Number(((f && f.fechamento && f.fechamento.saldoFinalLiquido) || (f && f.valores && f.valores.liquido) || 0));
            return `<tr>
                <td>${(((f && f.funcionario && f.funcionario.nome) || ''))}</td>
                <td>${(((f && f.funcionario && f.funcionario.cargo) || ''))}</td>
                <td style="text-align:right;">R$ ${bruto.toFixed(2)}</td>
                <td style="text-align:right;">R$ ${inss.toFixed(2)}</td>
                <td style="text-align:right;">R$ ${sind.toFixed(2)}</td>
                <td style="text-align:right;">R$ ${outros.toFixed(2)}</td>
                <td style="text-align:right; color:#e67e22;">- R$ ${abat.toFixed(2)}</td>
                <td style="text-align:right; font-weight:bold;">R$ ${liquido.toFixed(2)}</td>
            </tr>`;
        }).join('');
        return `${header}
            <table class="relatorio-table">
                <thead><tr><th>Nome</th><th>Cargo</th><th>Bruto</th><th>INSS</th><th>Sindicato</th><th>Outros Desc.</th><th>Abate Quinz.</th><th>Líquido</th></tr></thead>
                <tbody>${linhas}</tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="2"><strong>TOTAIS GERAIS:</strong></td>
                        <td style="text-align:right;"><strong>R$ ${totaisBruto.toFixed(2)}</strong></td>
                        <td style="text-align:right;"><strong>R$ ${totaisINSS.toFixed(2)}</strong></td>
                        <td style="text-align:right;"><strong>R$ ${totaisSindicato.toFixed(2)}</strong></td>
                        <td style="text-align:right;"><strong>R$ ${totaisOutros.toFixed(2)}</strong></td>
                        <td style="text-align:right;"><strong>- R$ ${totaisAbatimento.toFixed(2)}</strong></td>
                        <td style="text-align:right;"><strong>R$ ${totaisLiquido.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>`;
    }

    async gerarRelatorioSimplesLegado(folhas, mes, ano, { tipo } = {}) {
        const filtro = (folhas||[]).filter(f => (!tipo || ((f && f.tipo) === tipo)));
        const header = await this._gerarCabecalhoPadrao('RELATÓRIO SIMPLES', mes, ano);
        
        // Calcular total geral
        const totalGeral = filtro.reduce((acc, f) => {
            const valor = (((f && f.tipo) === 'quinzena') ? (Number(((f && f.valores && f.valores.liquido) || 0)))
                                                  : (Number(((f && f.fechamento && f.fechamento.saldoFinalLiquido) || (f && f.valores && f.valores.liquido) || 0))));
            return acc + valor;
        }, 0);
        
        const linhas = filtro.map(f => {
            const valor = (((f && f.tipo) === 'quinzena') ? (Number(((f && f.valores && f.valores.liquido) || 0)))
                                                  : (Number(((f && f.fechamento && f.fechamento.saldoFinalLiquido) || (f && f.valores && f.valores.liquido) || 0))));
            return `<tr>
                <td>${(((f && f.funcionario && f.funcionario.nome) || ''))}</td>
                <td>${(((f && f.funcionario && f.funcionario.cargo) || ''))}</td>
                <td style="text-align:right;">R$ ${valor.toFixed(2)}</td>
            </tr>`;
        }).join('');
        return `${header}
            <table class="relatorio-table">
                <thead><tr><th>Nome</th><th>Cargo</th><th>Valor</th></tr></thead>
                <tbody>${linhas}</tbody>
                <tfoot>
                    <tr class="total-row">
                        <td colspan="2"><strong>TOTAL GERAL:</strong></td>
                        <td style="text-align:right;"><strong>R$ ${totalGeral.toFixed(2)}</strong></td>
                    </tr>
                </tfoot>
            </table>`;
    }

    _parseISODate(value) {
        const s = String(value || '').trim();
        if (!s) return null;
        const d = new Date(`${s}T00:00:00`);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    _addMonths(baseDate, months) {
        const d = new Date(baseDate.getTime());
        d.setMonth(d.getMonth() + Number(months || 0));
        return d;
    }

    _diffMonths(fromDate, toDate) {
        if (!(fromDate instanceof Date) || !(toDate instanceof Date)) return 0;
        let months = (toDate.getFullYear() - fromDate.getFullYear()) * 12 + (toDate.getMonth() - fromDate.getMonth());
        if (toDate.getDate() < fromDate.getDate()) months -= 1;
        return Math.max(0, months);
    }

    _resolveFuncionariosRelatorio(filtroFuncionario = {}) {
        const ativos = (this.funcionarios || []).filter((f) => f && f.ativo !== false);
        const contratoFiltro = filtroFuncionario && filtroFuncionario.contratoTipo ? this.normalizeContratoTipo(filtroFuncionario.contratoTipo) : '';
        let lista = ativos;
        if (contratoFiltro) {
            const known = new Set(['CLT','PJ','AUTONOMO','DIARISTA','ESTAGIO','TEMPORARIO']);
            lista = lista.filter((f) => {
                const tipo = this.normalizeContratoTipo(f && (f.tipoContrato || f.contratoTipo || f.tipo_contrato || f.regime || f.vinculo || f['vínculo']));
                if (!tipo) return false;
                if (contratoFiltro === 'OUTROS') return !known.has(tipo);
                return tipo === contratoFiltro;
            });
        }
        if (!filtroFuncionario || filtroFuncionario.todosFuncionarios || !filtroFuncionario.funcionarioId) return lista;
        return lista.filter((f) => String(f.id) === String(filtroFuncionario.funcionarioId));
    }

    _formatCurrency(valor) {
        return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
    }

    async gerarRelatorioProvisaoFerias(dataInicio, dataFim, filtroFuncionario = {}) {
        const funcionarios = this._resolveFuncionariosRelatorio(filtroFuncionario);
        const periodoRef = this._parseISODate(`${dataFim}-01`) || new Date();
        const rawMin = (document.getElementById('pfMesesMin') && document.getElementById('pfMesesMin').value);
        const rawMax = (document.getElementById('pfMesesMax') && document.getElementById('pfMesesMax').value);
        let mesesMin = rawMin !== '' && rawMin != null ? Number(rawMin) : null;
        let mesesMax = rawMax !== '' && rawMax != null ? Number(rawMax) : null;
        if (!Number.isFinite(mesesMin)) mesesMin = null;
        if (!Number.isFinite(mesesMax)) mesesMax = null;
        if (mesesMin != null && mesesMax != null && mesesMin > mesesMax) {
            const tmp = mesesMin;
            mesesMin = mesesMax;
            mesesMax = tmp;
        }

        const linhas = funcionarios.map((func) => {
            const admissao = this._parseISODate(func.dataAdmissional);
            const salarioBase = Number(func.salarioBase || func.salario || 0);
            if (!admissao) {
                return {
                    nome: func.nome || 'N/A',
                    cargo: func.cargo || 'N/A',
                    admissaoTxt: '-',
                    vencimentoTxt: '-',
                    mesesProvisao: 0,
                    valorProvisao: 0
                };
            }
            const mesesServico = this._diffMonths(admissao, periodoRef);
            const ciclos = Math.floor(mesesServico / 12);
            const inicioCiclo = this._addMonths(admissao, ciclos * 12);
            const mesesProvisao = Math.min(12, this._diffMonths(inicioCiclo, periodoRef) + 1);
            const fimAquisitivo = this._addMonths(inicioCiclo, 12);
            const vencimentoFerias = this._addMonths(fimAquisitivo, 12);
            const valorProvisao = (salarioBase * (mesesProvisao / 12)) * (4 / 3);
            return {
                nome: func.nome || 'N/A',
                cargo: func.cargo || 'N/A',
                admissaoTxt: admissao.toLocaleDateString('pt-BR'),
                vencimentoTxt: vencimentoFerias.toLocaleDateString('pt-BR'),
                mesesProvisao,
                valorProvisao
            };
        }).filter((l) => {
            if (!l) return false;
            const m = Number(l.mesesProvisao || 0);
            if (mesesMin != null && m < mesesMin) return false;
            if (mesesMax != null && m > mesesMax) return false;
            return true;
        });
        const totalProvisao = linhas.reduce((acc, l) => acc + Number(l.valorProvisao || 0), 0);
        const header = await this.gerarCabecalhoRelatorio('PROVISÃO DE FÉRIAS', this.formatarPeriodo(dataInicio, dataFim));
        const safeText = (v) => {
            const s = String(v == null ? '' : v);
            return s
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        };

        const linhasHtml = linhas.map((l) => {
            const nome = safeText(l.nome);
            const cargo = safeText(l.cargo);
            return `
                <tr>
                    <td class="pf-cell pf-cell-text pf-cell-name" title="${nome}">${nome}</td>
                    <td class="pf-cell pf-cell-text" title="${cargo}">${cargo}</td>
                    <td class="pf-cell pf-cell-date" title="${safeText(l.admissaoTxt)}">${safeText(l.admissaoTxt)}</td>
                    <td class="pf-cell pf-cell-date" title="${safeText(l.vencimentoTxt)}">${safeText(l.vencimentoTxt)}</td>
                    <td class="pf-cell pf-cell-num" title="${safeText(l.mesesProvisao)}">${safeText(l.mesesProvisao)}</td>
                    <td class="pf-cell pf-cell-money" title="${safeText(this._formatCurrency(l.valorProvisao))}">${safeText(this._formatCurrency(l.valorProvisao))}</td>
                </tr>
            `;
        }).join('');
        return `
            <div class="relatorio-container pf-report pf-provisao-ferias">
                <style>
                    :root { --pf-k: 1; --pf-page-margin: 12mm; }

                    .pf-report { color: #111827; }
                    .pf-report .title { letter-spacing: 0.6px; }

                    .pf-summary { display: grid; grid-template-columns: repeat(12, 1fr); gap: 12px; margin: 14px 0 16px 0; }
                    .pf-card { grid-column: span 6; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; padding: 12px 14px; }
                    .pf-card h4 { margin: 0 0 6px 0; font-size: 12px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.4px; }
                    .pf-card p { margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; font-variant-numeric: tabular-nums; }
                    .pf-card.pf-card-accent { border-left: 5px solid #2563eb; }
                    .pf-card.pf-card-success { border-left: 5px solid #16a34a; }

                    .pf-table-wrap { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff; }
                    .pf-table-scroll { overflow-x: auto; overflow-y: hidden; }

                    .pf-table {
                        width: 100%;
                        border-collapse: separate;
                        border-spacing: 0;
                        table-layout: fixed;
                        font-variant-numeric: tabular-nums;
                    }

                    .pf-table col.col-func { width: 26%; }
                    .pf-table col.col-cargo { width: 18%; }
                    .pf-table col.col-adm { width: 13%; }
                    .pf-table col.col-venc { width: 13%; }
                    .pf-table col.col-meses { width: 12%; }
                    .pf-table col.col-valor { width: 18%; }

                    .pf-table thead th {
                        position: sticky;
                        top: 0;
                        z-index: 2;
                        background: #0b1f33;
                        color: #fff;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                        font-size: 12px;
                        font-weight: 800;
                        padding: 10px 10px;
                        border-bottom: 1px solid rgba(255,255,255,0.12);
                        white-space: nowrap;
                    }

                    .pf-table tbody td {
                        font-size: 12px;
                        padding: 8px 10px;
                        border-bottom: 1px solid #eef2f7;
                        background: #fff;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        line-height: 1.25;
                    }

                    .pf-table tbody tr:nth-child(odd) td { background: #fbfdff; }
                    .pf-table tbody tr:hover td { background: #f3f8ff; }

                    .pf-cell-date { text-align: center; }
                    .pf-cell-num { text-align: center; }
                    .pf-cell-money { text-align: right; }
                    .pf-cell-name { font-weight: 700; color: #0f172a; }

                    .pf-foot {
                        display: grid;
                        grid-template-columns: 1fr auto;
                        gap: 12px;
                        padding: 10px 12px;
                        border-top: 1px solid #e5e7eb;
                        background: #f8fafc;
                        align-items: center;
                    }

                    .pf-foot .pf-foot-note { font-size: 12px; color: #475569; }
                    .pf-foot .pf-foot-total { font-size: 14px; font-weight: 900; color: #0f172a; font-variant-numeric: tabular-nums; }

                    @media (max-width: 900px) {
                        .pf-summary { grid-template-columns: 1fr; }
                        .pf-card { grid-column: span 12; }
                    }

                    @media print {
                        :root { --pf-page-margin: 10mm; }
                        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        .relatorio-container { max-width: 100% !important; padding: 0 !important; }
                        .pf-table-scroll { overflow: visible !important; }
                        .pf-table-wrap { border-radius: 0; border: 1px solid #d1d5db; }
                        .pf-table thead { display: table-header-group; }
                        .pf-table tfoot { display: table-footer-group; }
                        .pf-table tr { break-inside: avoid; page-break-inside: avoid; }
                        .pf-table thead th {
                            position: static;
                            background: #0b1f33 !important;
                            color: #fff !important;
                            font-size: clamp(10px, calc(12px * var(--pf-k, 1)), 12px);
                            padding: clamp(5px, calc(8px * var(--pf-k, 1)), 8px) clamp(6px, calc(10px * var(--pf-k, 1)), 10px);
                        }
                        .pf-table tbody td {
                            font-size: clamp(9px, calc(11px * var(--pf-k, 1)), 11px);
                            padding: clamp(4px, calc(7px * var(--pf-k, 1)), 7px) clamp(5px, calc(9px * var(--pf-k, 1)), 9px);
                        }
                        .pf-summary { gap: 10px; margin: 10px 0 12px 0; }
                        .pf-card { border-radius: 0; }
                        .pf-card p { font-size: clamp(13px, calc(18px * var(--pf-k, 1)), 18px); }
                        .pf-foot { border-top: 1px solid #d1d5db; }

                        @page { size: A4 portrait; margin: var(--pf-page-margin); }
                    }

                    @media print and (orientation: landscape) {
                        @page { size: A4 landscape; margin: var(--pf-page-margin); }
                        .pf-table col.col-func { width: 28%; }
                        .pf-table col.col-cargo { width: 20%; }
                        .pf-table col.col-adm { width: 12%; }
                        .pf-table col.col-venc { width: 12%; }
                        .pf-table col.col-meses { width: 10%; }
                        .pf-table col.col-valor { width: 18%; }
                    }
                </style>

                ${header}

                <div class="pf-summary">
                    <div class="pf-card pf-card-accent">
                        <h4>Funcionários Considerados</h4>
                        <p>${linhas.length}</p>
                    </div>
                    <div class="pf-card pf-card-success">
                        <h4>Total Provisão de Férias</h4>
                        <p>${safeText(this._formatCurrency(totalProvisao))}</p>
                    </div>
                </div>

                <div class="pf-table-wrap">
                    <div class="pf-table-scroll">
                        <table class="pf-table" aria-label="Provisão de férias">
                            <colgroup>
                                <col class="col-func" />
                                <col class="col-cargo" />
                                <col class="col-adm" />
                                <col class="col-venc" />
                                <col class="col-meses" />
                                <col class="col-valor" />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Funcionário</th>
                                    <th>Cargo</th>
                                    <th>Admissão</th>
                                    <th>Vencimento</th>
                                    <th>Meses</th>
                                    <th>Provisão</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${linhasHtml || '<tr><td class="pf-cell" colspan="6" style="text-align:center; padding: 14px; color:#64748b;">Sem dados para o período</td></tr>'}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="6" style="padding:0;">
                                        <div class="pf-foot">
                                            <div class="pf-foot-note">Valores estimados incluem 1/3 constitucional (provisão equivalente a 4/3).</div>
                                            <div class="pf-foot-total">Total: ${safeText(this._formatCurrency(totalProvisao))}</div>
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <script>
                    (function(){
                        function computeScale(){
                            try {
                                var table = document.querySelector('.pf-provisao-ferias .pf-table');
                                if (!table) return;
                                var isLandscape = false;
                                try { isLandscape = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches); } catch(e) {}
                                var pageW = isLandscape ? 1122 : 793;
                                var marginPx = 38;
                                var available = pageW - marginPx * 2 - 2;
                                var width = table.scrollWidth || table.getBoundingClientRect().width || 0;
                                if (!width || !available) return;
                                var k = available / width;
                                if (k > 1) k = 1;
                                if (k < 0.76) k = 0.76;
                                document.documentElement.style.setProperty('--pf-k', String(k));
                            } catch(e) {}
                        }
                        try { window.addEventListener('beforeprint', computeScale); } catch(e) {}
                        try { window.addEventListener('afterprint', function(){ document.documentElement.style.setProperty('--pf-k','1'); }); } catch(e) {}
                        setTimeout(computeScale, 50);
                        try { if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function(){ setTimeout(computeScale, 50); }); } } catch(e) {}
                    })();
                </script>
            </div>
        `;
    }

    async gerarRelatorioProvisaoRescisaoDetalhada(dataInicio, dataFim, filtroFuncionario = {}) {
        const funcionarios = this._resolveFuncionariosRelatorio(filtroFuncionario);
        const referencia = this._parseISODate(`${dataFim}-01`) || new Date();
        const anoRef = referencia.getFullYear();
        const linhas = funcionarios.map((func) => {
            const admissao = this._parseISODate(func.dataAdmissional);
            const salarioBase = Number(func.salarioBase || func.salario || 0);
            const inicioAno = new Date(anoRef, 0, 1);
            const base13 = admissao && admissao > inicioAno ? admissao : inicioAno;
            const meses13 = Math.min(12, this._diffMonths(base13, referencia) + 1);
            const decimoTerceiro = salarioBase * (meses13 / 12);
            const mesesFerias = admissao ? Math.min(12, (this._diffMonths(admissao, referencia) % 12) + 1) : 0;
            const feriasProporcionais = salarioBase * (mesesFerias / 12);
            const tercoConstitucional = feriasProporcionais / 3;
            const avisoPrevio = salarioBase;
            const fgtsBase = salarioBase * meses13 * 0.08;
            const multaFgts = fgtsBase * 0.4;
            const total = decimoTerceiro + feriasProporcionais + tercoConstitucional + avisoPrevio + fgtsBase + multaFgts;
            return {
                nome: func.nome || 'N/A',
                cargo: func.cargo || 'N/A',
                admissaoTxt: admissao ? admissao.toLocaleDateString('pt-BR') : '-',
                decimoTerceiro,
                feriasProporcionais,
                tercoConstitucional,
                avisoPrevio,
                fgtsBase,
                multaFgts,
                total
            };
        });
        const totalGeral = linhas.reduce((acc, l) => acc + Number(l.total || 0), 0);
        const header = await this.gerarCabecalhoRelatorio('PROVISÃO DE RESCISÃO DETALHADA', this.formatarPeriodo(dataInicio, dataFim));
        const linhasHtml = linhas.map((l) => `
            <tr>
                <td>${l.nome}</td>
                <td>${l.cargo}</td>
                <td style="text-align:center;">${l.admissaoTxt}</td>
                <td style="text-align:right;">${this._formatCurrency(l.decimoTerceiro)}</td>
                <td style="text-align:right;">${this._formatCurrency(l.feriasProporcionais)}</td>
                <td style="text-align:right;">${this._formatCurrency(l.tercoConstitucional)}</td>
                <td style="text-align:right;">${this._formatCurrency(l.avisoPrevio)}</td>
                <td style="text-align:right;">${this._formatCurrency(l.fgtsBase)}</td>
                <td style="text-align:right;">${this._formatCurrency(l.multaFgts)}</td>
                <td style="text-align:right; font-weight:bold;">${this._formatCurrency(l.total)}</td>
            </tr>
        `).join('');
        return `
            <div class="relatorio-container">
                ${header}
                <div class="summary-cards">
                    <div class="summary-card info"><h4>Funcionários Considerados</h4><p>${linhas.length}</p></div>
                    <div class="summary-card warning"><h4>Provisão Total de Rescisão</h4><p>${this._formatCurrency(totalGeral)}</p></div>
                </div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Funcionário</th>
                            <th>Cargo</th>
                            <th>Admissão</th>
                            <th>13º Proporcional</th>
                            <th>Férias Proporcionais</th>
                            <th>1/3 Férias</th>
                            <th>Aviso Prévio</th>
                            <th>FGTS</th>
                            <th>Multa FGTS</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasHtml || '<tr><td colspan="10" style="text-align:center;">Sem dados para o período</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    _bhToHHMM(minutos) {
        const total = Number(minutos || 0);
        const sinal = total < 0 ? '-' : '';
        const abs = Math.abs(total);
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return `${sinal}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    _bhFuncionarioChaves(funcionario) {
        if (!funcionario) return [];
        const chaves = [];
        const add = (value, digitsOnly = false) => {
            let s = String(value || '').trim();
            if (digitsOnly) s = s.replace(/\D/g, '');
            if (s && !chaves.includes(s)) chaves.push(s);
        };
        add(funcionario.id);
        add(funcionario.funcionarioId);
        add(funcionario.key);
        add(funcionario.$key);
        add(funcionario.cpf, true);
        add(funcionario.matricula);
        add(funcionario.codigo);
        return chaves;
    }

    _bhLancamentoSortTime(lancamento) {
        const raw = (lancamento && (lancamento.data || lancamento.createdAt)) || '';
        const date = this._parseISODate(String(raw).slice(0, 10));
        return date ? date.getTime() : 0;
    }

    _bhLancamentoDedupKey(lancamento) {
        if (!lancamento) return '';
        return String(lancamento.id || lancamento.key || lancamento.lancamentoId || [
            lancamento.data || '',
            lancamento.createdAt || '',
            lancamento.minutos || 0,
            lancamento.compensado || 0,
            lancamento.descricao || lancamento.observacao || ''
        ].join('|'));
    }

    _bhColetarLancamentosBatch(chaves = [], batch = {}) {
        const vistos = new Set();
        const out = [];
        for (const chave of chaves) {
            const lista = (batch && batch[String(chave)]) || [];
            if (!Array.isArray(lista) || lista.length === 0) continue;
            for (const lancamento of lista) {
                const dedupKey = this._bhLancamentoDedupKey(lancamento);
                if (dedupKey && vistos.has(dedupKey)) continue;
                if (dedupKey) vistos.add(dedupKey);
                out.push(lancamento);
            }
        }
        return out.sort((a, b) => this._bhLancamentoSortTime(a) - this._bhLancamentoSortTime(b));
    }

    async _listarLancamentosBH(funcionario, inicioISO, fimISO) {
        if (!window.BHFirebase || typeof window.BHFirebase.bhListLancamentos !== 'function' || !funcionario) return [];
        const chaves = this._bhFuncionarioChaves(funcionario);
        for (const chave of chaves) {
            try {
                const lista = await window.BHFirebase.bhListLancamentos(chave, { inicioISO, fimISO, fresh: false });
                if (Array.isArray(lista) && lista.length > 0) return lista;
            } catch {}
        }
        return [];
    }

    async gerarRelatorioExtratoBH(dataInicio, dataFim, filtroFuncionario = {}) {
        const funcionarios = this._resolveFuncionariosRelatorio(filtroFuncionario);
        const inicioISO = `${String(dataInicio)}-01`;
        const fimDate = this._parseISODate(`${dataFim}-01`) || new Date();
        const fimISO = new Date(fimDate.getFullYear(), fimDate.getMonth() + 1, 0).toISOString().slice(0, 10);
        const linhas = [];
        const chavesPorFuncionario = new Map();
        const todasChaves = [];
        funcionarios.forEach((func) => {
            const chaves = this._bhFuncionarioChaves(func);
            chavesPorFuncionario.set(func, chaves);
            chaves.forEach(chave => todasChaves.push(chave));
        });

        let lancamentosBatch = null;
        if (todasChaves.length > 0 && window.BHFirebase && typeof window.BHFirebase.bhListLancamentosBatch === 'function') {
            try {
                lancamentosBatch = await window.BHFirebase.bhListLancamentosBatch(todasChaves, { inicioISO, fimISO, fresh: false });
            } catch (error) {
                console.warn('Aviso ao carregar Banco de Horas em lote; usando fallback individual:', error);
            }
        }

        for (const func of funcionarios) {
            const chaves = chavesPorFuncionario.get(func) || [];
            const lancamentos = lancamentosBatch
                ? this._bhColetarLancamentosBatch(chaves, lancamentosBatch)
                : await this._listarLancamentosBH(func, inicioISO, fimISO);
            lancamentos.forEach((l) => {
                const minutos = Number((l && l.minutos) || 0);
                const compensado = Math.max(0, Number((l && l.compensado) || 0));
                const saldo = minutos >= 0 ? Math.max(0, minutos - compensado) : minutos;
                linhas.push({
                    nome: func.nome || 'N/A',
                    cargo: func.cargo || 'N/A',
                    data: (l && l.data) || '',
                    descricao: (l && l.descricao) || (l && l.observacao) || '-',
                    movimento: this._bhToHHMM(minutos),
                    compensado: this._bhToHHMM(compensado),
                    saldo: this._bhToHHMM(saldo),
                    venceEm: (l && l.venceEm) || '-'
                });
            });
        }
        const header = await this.gerarCabecalhoRelatorio('EXTRATOS DE BANCO DE HORAS', this.formatarPeriodo(dataInicio, dataFim));
        const linhasHtml = linhas.map((l) => `
            <tr>
                <td>${l.nome}</td>
                <td>${l.cargo}</td>
                <td style="text-align:center;">${l.data ? new Date(`${l.data}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</td>
                <td>${l.descricao}</td>
                <td style="text-align:right;">${l.movimento}</td>
                <td style="text-align:right;">${l.compensado}</td>
                <td style="text-align:right; font-weight:bold;">${l.saldo}</td>
                <td style="text-align:center;">${l.venceEm && l.venceEm !== '-' ? new Date(`${l.venceEm}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</td>
            </tr>
        `).join('');
        return `
            <div class="relatorio-container bh-extrato-report">
                ${header}
                <div class="summary-cards">
                    <div class="summary-card info"><h4>Funcionários Considerados</h4><p>${funcionarios.length}</p></div>
                    <div class="summary-card success"><h4>Lançamentos de BH</h4><p>${linhas.length}</p></div>
                </div>
                <table class="data-table bh-extrato-table">
                    <colgroup>
                        <col style="width:18%">
                        <col style="width:14%">
                        <col style="width:9%">
                        <col style="width:25%">
                        <col style="width:10%">
                        <col style="width:9%">
                        <col style="width:7%">
                        <col style="width:8%">
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Funcionário</th>
                            <th>Cargo</th>
                            <th>Data</th>
                            <th>Descrição</th>
                            <th>Movimento <span class="th-sub">(HH:MM)</span></th>
                            <th>Compensado</th>
                            <th>Saldo</th>
                            <th>Vence <span class="th-sub">em</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${linhasHtml || '<tr><td colspan="8" style="text-align:center;">Sem lançamentos de Banco de Horas no período</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    async _gerarCabecalhoPadrao(titulo, mes, ano) {
        // Reaproveitar logo/cabeçalho padrão com dados dinâmicos
        const periodo = `${String(mes).padStart(2,'0')}/${ano}`;
        const empresa = await this.obterDadosEmpresa();
        
        return `<div class="header">
            <div class="logo">
                ${empresa.logo && empresa.logo.trim() !== '' ? 
                    `<img src="${empresa.logo}" alt="Logo da Empresa" />` : 
                    `<svg viewBox="0 0 100 100" style="width: 80px; height: 80px;">
                        <circle cx="50" cy="50" r="45" fill="#2c3e50" stroke="#34495e" stroke-width="2"/>
                        <text x="50" y="60" text-anchor="middle" fill="white" font-size="24" font-weight="bold">JN</text>
                    </svg>`
                }
            </div>
            <div class="company-info">
                <div class="company-name">${empresa.nome || empresa.name}</div>
                <div class="company-details">CNPJ: ${empresa.cnpj}</div>
                <div class="company-details">${empresa.endereco || empresa.address}</div>
                <div class="company-details">${empresa.cidade || empresa.city} - ${empresa.estado || empresa.state}</div>
                <div class="company-details">Fone: ${empresa.telefone || empresa.phone}</div>
                ${empresa.email ? `<div class="company-details">Email: ${empresa.email}</div>` : ''}
            </div>
        </div>
        <div class="title">${titulo} - ${periodo}</div>
        <div class="subtitle">Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}</div>`;
    }

    /**
     * 📊 ABRIR MODAL DE RESUMO DA FOLHA (SELEÇÃO DE COLUNAS)
     */
    openResumoFolhaModal() {
        console.log('📊 Abrindo modal de Resumo da Folha...');
        if (!document.getElementById('resumoFolhaModal')) {
            this.createResumoFolhaModal();
        }
        try { this.loadData(); } catch {}
        const modal = document.getElementById('resumoFolhaModal');
        if (modal) {
            modal.style.display = 'block';
            // Definir mês atual padrão
            try {
                const now = new Date();
                const mesTela = document.getElementById('mesAno');
                const yyyyMm = (mesTela && mesTela.value)
                    ? String(mesTela.value)
                    : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                const di = document.getElementById('resumoDataInicio');
                const df = document.getElementById('resumoDataFim');
                if (di && !di.value) di.value = yyyyMm;
                if (df && !df.value) df.value = yyyyMm;
            } catch {}
        }
    }

    closeResumoFolhaModal() {
        const modal = document.getElementById('resumoFolhaModal');
        if (modal) modal.style.display = 'none';
    }

    createResumoFolhaModal() {
        const COLS = [
            { key: 'funcionarioNome', label: 'Funcionário' },
            { key: 'cpf', label: 'CPF' },
            { key: 'cargo', label: 'Cargo' },
            { key: 'formaPagamento', label: 'Forma de Pagamento' },
            { key: 'tipoContrato', label: 'Vínculo' },
            { key: 'mesAno', label: 'Mês/Ano' },
            { key: 'salarioBase', label: 'Salário Base' },
            { key: 'valorHorasExtras', label: 'Horas Extras (R$)' },
            { key: 'bonificacoes', label: 'Bonificações' },
            { key: 'periculosidade', label: 'Periculosidade' },
            { key: 'adicionalNoturno', label: 'Adicional Noturno' },
            { key: 'insalubridade', label: 'Insalubridade' },
            { key: 'salarioFamilia', label: 'Salário Família' },
            { key: 'premioAssiduidade', label: 'Prêmio Assiduidade' },
            { key: 'valorQuinzena', label: 'Quinzena (R$)' },
            { key: 'inss', label: 'INSS' },
            { key: 'irrf', label: 'IRRF' },
            { key: 'vales', label: 'Vales' },
            { key: 'outrosDescontos', label: 'Outros Descontos' },
            { key: 'descontoFaltas', label: 'Faltas (R$)' },
            { key: 'descontoRepousoRemunerado', label: 'Repouso Remunerado' },
            { key: 'descontoINSSManual', label: 'INSS (Manual)' },
            { key: 'contribuicaoConfederativa', label: 'Contribuição Confederativa' },
            { key: 'contribuicaoSindical', label: 'Contribuição Sindical' },
            { key: 'descontoIRPJ', label: 'IRPJ' },
            { key: 'emprestimoConsignado', label: 'Empréstimo' },
            { key: 'totalAcrescimos', label: 'Total Acréscimos' },
            { key: 'totalDescontos', label: 'Total Descontos' },
            { key: 'salarioLiquido', label: 'Salário Líquido' },
            { key: 'valorPago', label: 'Valor Pago' },
            { key: 'saldoAberto', label: 'Saldo em Aberto' }
        ];
        // Agrupamento visual de colunas
        const grupos = {
            'Dados': ['funcionarioNome','cpf','cargo','formaPagamento','tipoContrato','mesAno'],
            'Proventos': ['salarioBase','valorHorasExtras','bonificacoes','periculosidade','adicionalNoturno','insalubridade','salarioFamilia','premioAssiduidade'],
            'Quinzena': ['valorQuinzena'],
            'Descontos': ['inss','irrf','vales','outrosDescontos','descontoFaltas','descontoRepousoRemunerado','descontoINSSManual','contribuicaoConfederativa','contribuicaoSindical','descontoIRPJ','emprestimoConsignado'],
            'Totais': ['totalAcrescimos','totalDescontos','salarioLiquido','valorPago','saldoAberto']
        };
        const defaultCols = ['funcionarioNome','cargo','formaPagamento','mesAno','valorQuinzena','totalAcrescimos','totalDescontos','salarioLiquido'];
        const renderItens = (keys) => keys.map(k => {
            const col = COLS.find(c => c.key === k);
            if (!col) return '';
            const inputId = `resumoCol_${col.key}`;
            return `
                <div class="checkbox-item" data-key="${col.key}">
                    <input type="checkbox" id="${inputId}" name="resumoCols" value="${col.key}" ${defaultCols.includes(col.key) ? 'checked' : ''}>
                    <label class="checkbox-label" for="${inputId}">${col.label}</label>
                </div>
            `;
        }).join('');
        const checkboxSectionsInner = Object.entries(grupos).map(([titulo, keys]) => `
            <div class="checkbox-card">
                <div class="checkbox-card-header">
                    <div class="checkbox-heading"><strong>${titulo}</strong></div>
                    <div class="checkbox-group-actions">
                        <button type="button" class="mini-btn select-group">Selecionar grupo</button>
                        <button type="button" class="mini-btn clear-group">Limpar grupo</button>
                    </div>
                </div>
                <div class="checkbox-card-body">
                    <div class="checkbox-grid">${renderItens(keys)}</div>
                </div>
            </div>
        `).join('');
        const checkboxSections = `<div class="checkbox-cards-grid">${checkboxSectionsInner}</div>`;
        const checkboxes = COLS.map(c => `<label class="checkbox-item"><input type="checkbox" name="resumoCols" value="${c.key}" ${defaultCols.includes(c.key) ? 'checked' : ''}> ${c.label}</label>`).join('');
        const modalHTML = `
            <div id="resumoFolhaModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <i class="fas fa-table"></i> Resumo da Folha (Seleção de Colunas)
                        </h3>
                        <span class="close-modal" onclick="window.closeResumoFolhaModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="campos-grid">
                            <div class="form-group">
                                <label for="resumoDataInicio"><i class="fas fa-calendar-alt"></i> Data Início:</label>
                                <input type="month" id="resumoDataInicio" required>
                            </div>
                            <div class="form-group">
                                <label for="resumoDataFim"><i class="fas fa-calendar-alt"></i> Data Fim:</label>
                                <input type="month" id="resumoDataFim" required>
                            </div>
                            <div class="form-group">
                                <label for="resumoFuncionario"><i class="fas fa-user"></i> Funcionário:</label>
                                <div class="autocomplete-container">
                                    <input type="text" id="resumoFuncionario" class="autocomplete-input" placeholder="Filtrar por funcionário...">
                                    <div class="autocomplete-icons-container">
                                        <span class="autocomplete-icon" title="Listar Funcionários" onclick="window.folhaRelatorios && window.folhaRelatorios.openFuncionariosListModalForResumo && window.folhaRelatorios.openFuncionariosListModalForResumo()">
                                            <i class="fas fa-list"></i>
                                        </span>
                                        <span class="autocomplete-icon" title="Limpar Filtro" onclick="(function(){const i=document.getElementById('resumoFuncionario'); if(i){i.value=''; i.dataset.funcionarioId='';}})()" style="color:#dc3545;">
                                            <i class="fas fa-times"></i>
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label for="resumoOrientacaoImpressao"><i class="fas fa-print"></i> Orientação de Impressão:</label>
                                <select id="resumoOrientacaoImpressao">
                                    <option value="auto">Automático (Recomendado)</option>
                                    <option value="portrait">Retrato</option>
                                    <option value="landscape">Paisagem</option>
                                </select>
                            </div>
                            <div class="form-group resumo-filter-option">
                                <label for="resumoSomenteAbertos"><i class="fas fa-filter"></i> Status:</label>
                                <label class="resumo-toggle">
                                    <input type="checkbox" id="resumoSomenteAbertos">
                                    <span>Imprimir apenas lançamentos em aberto</span>
                                </label>
                                <small>Desconsidera lançamentos pagos, baixados ou fechados.</small>
                            </div>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-columns"></i> Seleção de Colunas:</label>
                            <div class="checkbox-filter">
                                <input type="text" id="resumoColSearch" placeholder="Filtrar colunas..." style="width:100%; padding:6px;">
                            </div>
                            ${checkboxSections}
                            <div class="checkbox-toolbar resumo-toolbar" style="margin-top:8px;">
                                <button type="button" class="btn-listar resumo-toolbar-btn" id="resumoSelectAll"><i class="fas fa-check-double"></i> Selecionar Tudo</button>
                                <button type="button" class="btn-editar resumo-toolbar-btn" id="resumoClearAll"><i class="fas fa-eraser"></i> Limpar Seleção</button>
                                <button type="button" class="btn-salvar resumo-toolbar-btn" id="resumoPresetFinanceiro" title="Bruto/Acréscimos/Descontos/Líquido"><i class="fas fa-coins"></i> Financeiro</button>
                                <button type="button" class="btn-adicionar resumo-toolbar-btn" id="resumoPresetRH" title="Dados básicos + faltas"><i class="fas fa-users"></i> RH</button>
                                <button type="button" class="btn-editar resumo-toolbar-btn" id="resumoPresetProventos" title="Salário Base + Proventos"><i class="fas fa-plus-circle"></i> Proventos</button>
                                <button type="button" class="btn-listar resumo-toolbar-btn" id="resumoPresetDescontos" title="Mapa de Descontos"><i class="fas fa-minus-circle"></i> Descontos</button>
                                <button type="button" class="btn-listar resumo-toolbar-btn" id="resumoPresetQuinzena" title="Itens da Quinzena"><i class="fas fa-calendar-alt"></i> Quinzena</button>
                                <button type="button" class="btn-salvar resumo-toolbar-btn" id="resumoPresetCompleto" title="Todas as colunas"><i class="fas fa-layer-group"></i> Completo</button>
                            </div>
                        </div>
                        <div class="form-group">
                            <small style="color:#666">O resumo será gerado em layout compacto, adaptado ao número de colunas escolhidas.</small>
                        </div>
                    </div>
                    <div class="modal-footer resumo-footer">
                        <div class="footer-secondary">
                            <button type="button" class="btn-cancelar resumo-footer-btn" onclick="window.closeResumoFolhaModal()"><i class="fas fa-times"></i> Cancelar</button>
                        </div>
                        <div class="footer-primary">
                            <button type="button" class="btn-salvar resumo-footer-btn" id="btnGerarResumoFolha"><i class="fas fa-file-alt"></i> Gerar Resumo</button>
                        </div>
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        // Bind ações básicas
        document.getElementById('resumoSelectAll').addEventListener('click', () => {
            document.querySelectorAll('#resumoFolhaModal input[name="resumoCols"]').forEach(cb => cb.checked = true);
        });
        document.getElementById('resumoClearAll').addEventListener('click', () => {
            document.querySelectorAll('#resumoFolhaModal input[name="resumoCols"]').forEach(cb => cb.checked = false);
        });
        // Presets de seleção
        const setCols = (keys) => {
            const all = Array.from(document.querySelectorAll('#resumoFolhaModal input[name="resumoCols"]'));
            all.forEach(cb => cb.checked = keys.includes(cb.value));
        };
        const financeiroKeys = ['funcionarioNome','mesAno','salarioBase','valorHorasExtras','totalAcrescimos','totalDescontos','salarioLiquido','valorPago','saldoAberto'];
        const rhKeys = ['funcionarioNome','cpf','cargo','tipoContrato','mesAno','descontoFaltas','salarioFamilia','valorHorasExtras','salarioLiquido'];
        const proventosKeys = ['funcionarioNome','mesAno','salarioBase','valorHorasExtras','bonificacoes','periculosidade','adicionalNoturno','insalubridade','salarioFamilia','premioAssiduidade','totalAcrescimos','salarioLiquido'];
        const descontosKeys = ['funcionarioNome','mesAno','inss','irrf','vales','outrosDescontos','descontoFaltas','descontoRepousoRemunerado','descontoINSSManual','contribuicaoConfederativa','contribuicaoSindical','descontoIRPJ','emprestimoConsignado','totalDescontos','salarioLiquido'];
        const quinzenaKeys = ['funcionarioNome','mesAno','salarioBase','valorQuinzena','totalAcrescimos','totalDescontos','salarioLiquido'];
        const completoKeys = COLS.map(c => c.key);
        document.getElementById('resumoPresetFinanceiro').addEventListener('click', () => setCols(financeiroKeys));
        document.getElementById('resumoPresetRH').addEventListener('click', () => setCols(rhKeys));
        document.getElementById('resumoPresetProventos').addEventListener('click', () => setCols(proventosKeys));
        document.getElementById('resumoPresetDescontos').addEventListener('click', () => setCols(descontosKeys));
        document.getElementById('resumoPresetQuinzena').addEventListener('click', () => setCols(quinzenaKeys));
        document.getElementById('resumoPresetCompleto').addEventListener('click', () => setCols(completoKeys));

        // Filtro de colunas por texto
        const colSearch = document.getElementById('resumoColSearch');
        if (colSearch) {
            colSearch.addEventListener('input', (e) => {
                const q = String(e.target.value || '').toLowerCase();
                document.querySelectorAll('#resumoFolhaModal .checkbox-item').forEach(el => {
                    const txt = el.textContent.toLowerCase();
                    el.style.display = (!q || txt.includes(q)) ? 'flex' : 'none';
                });
                // Ocultar cards sem itens visíveis
                document.querySelectorAll('#resumoFolhaModal .checkbox-card').forEach(card => {
                    const anyVisible = Array.from(card.querySelectorAll('.checkbox-item')).some(el => el.style.display !== 'none');
                    card.style.display = anyVisible ? 'block' : 'none';
                });
            });
        }

        // Toggle de item ao clicar no container
        document.querySelectorAll('#resumoFolhaModal .checkbox-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target && e.target.tagName.toLowerCase() === 'input') return; // já tratou
                const input = item.querySelector('input[type="checkbox"]');
                if (input) input.checked = !input.checked;
            });
        });

        // Ações por grupo (card)
        document.querySelectorAll('#resumoFolhaModal .checkbox-card').forEach(card => {
            const selectBtn = card.querySelector('.select-group');
            const clearBtn = card.querySelector('.clear-group');
            const inputs = card.querySelectorAll('input[name="resumoCols"]');
            if (selectBtn) selectBtn.addEventListener('click', () => { inputs.forEach(cb => cb.checked = true); });
            if (clearBtn) clearBtn.addEventListener('click', () => { inputs.forEach(cb => cb.checked = false); });
        });

        document.getElementById('btnGerarResumoFolha').addEventListener('click', async () => {
            const di = document.getElementById('resumoDataInicio').value;
            const df = document.getElementById('resumoDataFim').value;
            const cols = Array.from(document.querySelectorAll('#resumoFolhaModal input[name="resumoCols"]:checked')).map(cb => cb.value);
            const orientacaoSelecionada = String((document.getElementById('resumoOrientacaoImpressao') && document.getElementById('resumoOrientacaoImpressao').value) || 'auto').toLowerCase();
            const somenteAbertos = !!(document.getElementById('resumoSomenteAbertos') && document.getElementById('resumoSomenteAbertos').checked);
            if (!di || !df || cols.length === 0) {
                alert('Selecione período e ao menos uma coluna.');
                return;
            }
            await this.loadData();
            const dados = this.lancamentos || [];
            const funcInput = document.getElementById('resumoFuncionario');
            const funcFiltro = {
                id: (funcInput && funcInput.dataset && funcInput.dataset.funcionarioId) ? String(funcInput.dataset.funcionarioId) : '',
                text: (funcInput && funcInput.value) ? String(funcInput.value) : ''
            };
            const html = await this.gerarResumoFolhaCompact(dados, di, df, cols, funcFiltro, { orientacao: orientacaoSelecionada, somenteAbertos });
            this.imprimirRelatorio(html, 'Resumo da Folha');
        });
    }

    async gerarResumoFolhaCompact(dados, dataInicio, dataFim, cols, funcionarioFiltro = {}, opcoesImpressao = {}) {
        const from = String(dataInicio);
        const to = String(dataFim);
        const somenteAbertos = !!(opcoesImpressao && opcoesImpressao.somenteAbertos);
        const inRange = (mesAno) => {
            const s = String(mesAno||'');
            return s >= from && s <= to;
        };
        const norm = (s) => {
            try { return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); } catch { return ''; }
        };
        const funcId = String(funcionarioFiltro.id || '').trim();
        const funcText = String(funcionarioFiltro.text || '').trim();
        const funcNorm = norm(funcText);
        const parseNum = (v) => {
            if (v == null || v === '') return NaN;
            if (typeof v === 'number') return v;
            const s = String(v).trim();
            if (!s) return NaN;
            const n1 = s.replace(/[^0-9,.-]/g, '');
            if (n1.includes(',')) {
                const f = parseFloat(n1.replace(/\./g, '').replace(/,/g, '.'));
                return isNaN(f) ? NaN : f;
            }
            const f = parseFloat(n1);
            return isNaN(f) ? NaN : f;
        };
        const resolveTipo = (l) => {
            if (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function') {
                return window.FolhaUtils.resolveTipoPagamento(l);
            }
            return l.tipoPagamento || l.tipo || l.tipoFolha || '';
        };
        const keyOf = (l, idx) => {
            const id = (l && l.funcionario && l.funcionario.id) || l.funcionarioId || '';
            const nome = norm((l && l.funcionario && l.funcionario.nome) || '');
            const base = id || nome;
            const mes = String(l && l.mesAno || '');
            const tipo = String(resolveTipo(l) || '');
            if (base && mes) return `${base}|${mes}|${tipo}`;
            const rid = String(l && (l.id || l.key) || '');
            return rid ? `${rid}|${idx}` : `__idx_${idx}`;
        };
        const scoreOf = (l) => {
            const c = l && l.calculos ? l.calculos : {};
            const calc = (c && c.calculos) || c;
            const desconto = parseNum(l.totalDescontos ?? calc.totalDescontos ?? c.totalDescontos);
            const acres = parseNum(l.totalAcrescimos ?? calc.totalAcrescimos ?? c.totalAcrescimos);
            const liq = parseNum(l.salarioLiquido ?? l.salarioLiquidoFinal ?? l.valorLiquido ?? calc.salarioLiquido ?? c.salarioLiquido);
            const inss = parseNum(l.descontoINSSManual ?? calc.descontoINSSManual ?? c.descontoINSSManual ?? (calc.calculoINSS && calc.calculoINSS.valor) ?? (c.inss && c.inss.valor));
            const irrf = parseNum(l.descontoIRRFManual ?? calc.descontoIRRFManual ?? c.descontoIRRFManual ?? (calc.calculoIRRF && calc.calculoIRRF.valor) ?? (c.irrf && c.irrf.valor));
            let score = 0;
            if (Number.isFinite(desconto) && desconto > 0) score += 4;
            if (Number.isFinite(liq)) score += 3;
            if (Number.isFinite(acres) && acres > 0) score += 2;
            if (Number.isFinite(inss) || Number.isFinite(irrf)) score += 1;
            const status = String(l && l.status || '').toLowerCase();
            if (status && status !== 'rascunho') score += 1;
            const ts = parseNum(l.updated || l.updatedAt || l.dataProcessamento || l.dataAtualizacao);
            if (Number.isFinite(ts)) score += Math.min(2, Math.max(0, ts / 1e15));
            return score;
        };
        const filtrados = dados
            .filter(l => inRange(l.mesAno))
            .filter(l => {
                if (funcId) {
                    const lid = (l && l.funcionario && l.funcionario.id) || l.funcionarioId || '';
                    return String(lid) === funcId;
                }
                if (funcNorm) {
                    const nome = norm((l.funcionario && l.funcionario.nome) || '');
                    const cargo = norm((l.funcionario && l.funcionario.cargo) || '');
                    return nome.includes(funcNorm) || cargo.includes(funcNorm);
                }
                return true;
            });
        const byKey = new Map();
        filtrados.forEach((l, idx) => {
            const k = keyOf(l, idx);
            const prev = byKey.get(k);
            if (!prev) {
                byKey.set(k, l);
                return;
            }
            const sPrev = scoreOf(prev);
            const sNow = scoreOf(l);
            if (sNow > sPrev) {
                byKey.set(k, l);
            }
        });
        const selecionadosBase = Array.from(byKey.values())
            .map(l => {
            try { window.FolhaUtils.ensureCalculosPresent && window.FolhaUtils.ensureCalculosPresent(l); } catch {}
            const c = l.calculos || {};
            const calc = c.calculos || c;
            const base = (window.FolhaUtils && window.FolhaUtils.getSalarioBaseDisplay) ? window.FolhaUtils.getSalarioBaseDisplay(l) : (c.salarioBase||0);
            const qz = (window.FolhaUtils && window.FolhaUtils.calcularValorQuinzena) ? window.FolhaUtils.calcularValorQuinzena(l) : 0;
            const acres = (window.FolhaUtils && window.FolhaUtils.calcularAcrescimosDisplay) ? window.FolhaUtils.calcularAcrescimosDisplay(l) : 0;
            const descs = (window.FolhaUtils && window.FolhaUtils.calcularDescontosDisplay) ? window.FolhaUtils.calcularDescontosDisplay(l) : 0;
            const liq = (window.FolhaUtils && window.FolhaUtils.calcularSalarioLiquidoDisplay) ? window.FolhaUtils.calcularSalarioLiquidoDisplay(l) : 0;
            const valorPago = (window.FolhaUtils && window.FolhaUtils.calcularValorPagoLancamento) ? window.FolhaUtils.calcularValorPagoLancamento(l) : 0;
            const saldoAberto = (window.FolhaUtils && window.FolhaUtils.calcularSaldoLiquidoEmAberto) ? window.FolhaUtils.calcularSaldoLiquidoEmAberto(l) : liq;
            const funcionario = this.getFuncionarioDetalhado(l);
            const tipoContrato = String((funcionario && funcionario.tipoContrato)||'').toLowerCase();
            const vinculosSemINSSAuto = new Set(['temporario','terceirizado','estagio','estagiario']);
            const inssAuto = (((calc && calc.calculoINSS && calc.calculoINSS.valor) || (c.inss && c.inss.valor) || 0));
            const irrfAuto = (((calc && calc.calculoIRRF && calc.calculoIRRF.valor) || (c.irrf && c.irrf.valor) || 0));
            const inssFinal = (l.descontoINSSManual>0) ? l.descontoINSSManual : (vinculosSemINSSAuto.has(tipoContrato) ? 0 : inssAuto);
            const irrfFinal = vinculosSemINSSAuto.has(tipoContrato) ? 0 : irrfAuto;
            const contaNoResumo = (window.FolhaUtils && typeof window.FolhaUtils.lancamentoContaNoResumo === 'function')
                ? window.FolhaUtils.lancamentoContaNoResumo(l)
                : true;
            return {
                funcionarioNome: (funcionario && funcionario.nome) || '',
                cpf: (funcionario && funcionario.cpf) || '',
                cargo: (funcionario && funcionario.cargo) || '',
                formaPagamento: (window.FolhaUtils && typeof window.FolhaUtils.formatarFormaPagamentoDetalhada === 'function')
                    ? window.FolhaUtils.formatarFormaPagamentoDetalhada(funcionario || {})
                    : ((funcionario && funcionario.formaPagamento) || ''),
                tipoContrato: (funcionario && funcionario.tipoContrato) || '',
                mesAno: l.mesAno || '',
                salarioBase: base,
                valorHorasExtras: Number((calc && calc.valorHorasExtras) || (c && c.valorHorasExtras) || 0),
                bonificacoes: Number(l.bonificacoes || calc.bonificacoes || 0),
                periculosidade: Number((calc && calc.valorPericulosidade) || (c && c.valorPericulosidade) || 0),
                adicionalNoturno: Number((calc && calc.valorAdicionalNoturno) || (c && c.valorAdicionalNoturno) || 0),
                insalubridade: Number((calc && calc.valorInsalubridade) || (c && c.valorInsalubridade) || 0),
                salarioFamilia: Number((calc && calc.valorSalarioFamilia) || (c && c.valorSalarioFamilia) || 0),
                premioAssiduidade: Number(calc.premioAssiduidade || 0),
                valorQuinzena: qz,
                inss: Number(inssFinal||0),
                irrf: Number(irrfFinal||0),
                vales: Number(this.calcularTotalValesLancamento(l) || 0),
                outrosDescontos: Number(l.outrosDescontos || c.outrosDescontos || 0),
                descontoFaltas: Number(calc.descontoFaltas || c.descontoFaltas || 0),
                descontoRepousoRemunerado: Number(calc.descontoRepousoRemunerado || c.descontoRepousoRemunerado || 0),
                descontoINSSManual: Number(l.descontoINSSManual || 0),
                contribuicaoConfederativa: Number(l.contribuicaoConfederativa || calc.contribuicaoConfederativa || 0),
                contribuicaoSindical: Number(l.contribuicaoSindical || calc.contribuicaoSindical || 0),
                descontoIRPJ: Number(l.descontoIRPJ || calc.descontoIRPJ || 0),
                emprestimoConsignado: Number(l.emprestimoConsignado || calc.emprestimoConsignado || 0),
                totalAcrescimos: acres,
                totalDescontos: descs,
                salarioLiquido: liq,
                valorPago,
                saldoAberto,
                contaNoResumo
            };
        });
        const selecionados = somenteAbertos
            ? selecionadosBase.filter(r => r.contaNoResumo !== false)
            : selecionadosBase;
        const textCols = new Set(['funcionarioNome','cargo','formaPagamento','tipoContrato','cpf','mesAno']);
        const highlightCols = new Set(['valorQuinzena','salarioLiquido','valorPago','saldoAberto']);
        const headers = cols.map(key => {
            const titulo = key.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()).replace('Cpf','CPF');
            const baseCls = textCols.has(key) ? (key === 'funcionarioNome' ? 'nome-col text-col' : 'text-col') : 'valor';
            const cls = highlightCols.has(key) ? `${baseCls} destaque-col` : baseCls;
            return `<th class="${cls}">${titulo}</th>`;
        }).join('');
        // Cabeçalho da empresa
        let empresa = {};
        try { empresa = await this.obterDadosEmpresa() || {}; } catch (e) { empresa = {}; }
        const orientacaoInput = String((opcoesImpressao && opcoesImpressao.orientacao) || 'auto').toLowerCase();
        const orientacaoResolvida = (orientacaoInput === 'portrait' || orientacaoInput === 'landscape')
            ? orientacaoInput
            : (cols.length > 8 ? 'landscape' : 'portrait');
        const paginaMargin = orientacaoResolvida === 'landscape' ? '8mm' : '10mm';
        const fonteTabela = orientacaoResolvida === 'landscape' ? '10px' : '9px';
        const paddingTabela = orientacaoResolvida === 'landscape' ? '5px' : '4px';
        const larguraNome = orientacaoResolvida === 'landscape' ? '190px' : '140px';
        const larguraTexto = orientacaoResolvida === 'landscape' ? '160px' : '120px';
        const fmtMoedaResumo = (valor) => {
            const numero = Number(valor || 0);
            const seguro = Number.isFinite(numero) ? numero : 0;
            try {
                return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(seguro);
            } catch (e) {
                return `R$ ${seguro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
        };
        const rows = selecionados.length > 0 ? selecionados.map(r => `<tr>${cols.map(k => {
            const val = (typeof r[k] === 'number') ? fmtMoedaResumo(r[k]) : (r[k] || '');
            const baseCls = textCols.has(k) ? (k === 'funcionarioNome' ? 'nome-cell text-cell' : 'text-cell') : 'valor';
            const cls = highlightCols.has(k) ? `${baseCls} destaque-cell` : baseCls;
            return `<td class="${cls}">${val}</td>`;
        }).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" class="text-cell empty-row">Nenhum lançamento encontrado para os filtros selecionados.</td></tr>`;
        const resumoAviso = somenteAbertos
            ? 'Filtro aplicado: exibindo apenas lançamentos em aberto. Lançamentos pagos, baixados ou fechados foram desconsiderados.'
            : 'Resumo operacional: totais principais consideram lançamentos não baixados. Cartões adicionais exibem Total Pagos e Total Restantes.';
        const tituloResumo = somenteAbertos ? 'Resumo da Folha - Lançamentos em Aberto' : 'Resumo da Folha - Layout Compacto';
        const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Resumo da Folha</title>
<style>
body { font-family: Arial, sans-serif; margin: 0; padding: 16px; color: #333; }
.header { display:flex; align-items:flex-start; border-bottom:2px solid #333; padding-bottom:12px; margin-bottom:16px; }
.logo { width:100px; margin-right:16px; }
.company-info { flex:1; }
.company-name { font-size:18px; font-weight:bold; color:#2c3e50; }
.company-details { font-size:12px; color:#555; }
.title { text-align:center; font-size:16px; font-weight:bold; margin:14px 0; color:#2c3e50; }
.compact-table { width:100%; border-collapse:collapse; }
.compact-table th, .compact-table td { border:1px solid #ddd; padding:${paddingTabela}; font-size:${fonteTabela}; line-height:1.15; vertical-align:middle; }
.compact-table th { background:#0d2339; color:#fff; text-transform:uppercase; font-weight:700; }
.text-col, .text-cell { text-align:left; font-weight:600; font-family: Arial, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: ${larguraTexto}; }
.nome-col, .nome-cell { text-align:left; font-weight:700; color:#1b3a57; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: ${larguraNome}; }
.valor { text-align:right; font-family:'Courier New', monospace; font-weight:600; white-space: nowrap; }
.destaque-col { font-weight:700; }
.destaque-cell { font-weight:700; white-space: nowrap; }
td.nome-cell { background: #f6faff; }
.compact-table tbody tr:nth-child(odd) { background-color: #f9fbfd; }
.compact-table tbody tr:nth-child(even) { background-color: #ffffff; }
.compact-table td, .compact-table th { color: #1a1a1a; }
.compact-table .empty-row { text-align:center; padding:14px; color:#666; font-style:italic; white-space:normal; }
.compact-table thead { display: table-header-group; }
.compact-table tr { break-inside: avoid; page-break-inside: avoid; }
@media print {
  @page { size: A4 ${orientacaoResolvida}; margin: ${paginaMargin}; }
  body { padding: 0; }
  .compact-table { table-layout: fixed; }
  td.nome-cell { background: #f6faff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
@media print { .compact-table th { background:#0d2339 !important; color:#fff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
@media print {
  .compact-table tbody tr:nth-child(odd) { background-color: #f9fbfd !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .compact-table tbody tr:nth-child(even) { background-color: #ffffff !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}

/* Resumo de Subtotais Adaptativo */
.compact-summary { margin-top: 16px; }
.summary-header { font-weight: 700; color:#0d2339; margin-bottom: 8px; }
.summary-totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin-bottom: 8px; }
.total-card { border: 1px solid #ddd; border-radius: 8px; padding: 10px; display:flex; align-items:center; justify-content:space-between; gap: 12px; }
.total-card.credit { background: #e8f6ff; border-color: #bfe7ff; }
.total-card.debit { background: #fff5f5; border-color: #ffd7d7; }
.total-card.net { background: #f4fff4; border-color: #cde8cd; }
.total-card.paid { background: #eef9f1; border-color: #cfead7; }
.total-card.remaining { background: #fff6ec; border-color: #ffe0bf; }
.total-card .label { font-weight: 600; color:#333; }
.total-card .value { font-weight: 800; font-family:'Courier New', monospace; margin-left: 8px; white-space: nowrap; }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
.summary-item { border: 1px solid #ddd; border-radius: 6px; background: #fafafa; padding: 8px; display:flex; align-items:center; justify-content:space-between; }
.summary-item .label { font-weight: 600; color: #333; }
.summary-item .value { text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }
/* Zebra opcional no resumo */
.compact-summary.zebra .summary-grid .summary-item:nth-child(odd) { background: #f7fbff; }
.compact-summary.zebra .summary-grid .summary-item:nth-child(even) { background: #ffffff; }
/* Quebra de página condicional para impressão */
@media print { .compact-summary.page-break { page-break-before: always; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">
    ${empresa.logo ? `<img src="${empresa.logo}" alt="Logo" />` : ''}
  </div>
  <div class="company-info">
    <div class="company-name">${empresa.nome || empresa.name || ''}</div>
    <div class="company-details">CNPJ: ${empresa.cnpj || ''}</div>
    <div class="company-details">Período: ${from} a ${to}</div>
    ${somenteAbertos ? '<div class="company-details">Filtro: somente lançamentos em aberto</div>' : ''}
  </div>
</div>
<div class="title">${tituloResumo}</div>
<div style="margin-bottom:10px; padding:8px 12px; border-radius:6px; background:#eef6ff; border:1px solid #d6e8ff; color:#1f4f82; font-size:12px;">
  ${resumoAviso}
</div>
<table class="compact-table">
  <thead><tr>${headers}</tr></thead>
  <tbody>${rows}</tbody>
</table>
${(() => {
  const cfg = (typeof window !== 'undefined' && window.resumoFolhaConfig) ? window.resumoFolhaConfig : { pageBreakMode: 'auto', threshold: 12, zebra: true };
  const numericCols = new Set(['salarioBase','valorHorasExtras','bonificacoes','periculosidade','adicionalNoturno','insalubridade','salarioFamilia','premioAssiduidade','valorQuinzena','inss','irrf','vales','outrosDescontos','descontoFaltas','descontoRepousoRemunerado','descontoINSSManual','contribuicaoConfederativa','contribuicaoSindical','descontoIRPJ','emprestimoConsignado','totalAcrescimos','totalDescontos','salarioLiquido','valorPago','saldoAberto']);
  const selectedNumeric = cols.filter(k => numericCols.has(k));
  if (selectedNumeric.length === 0) return '';
  const labels = (k) => {
    switch(k){
      case 'valorQuinzena': return 'Quinzena (R$)';
      case 'salarioLiquido': return 'Salário Líquido';
      case 'valorPago': return 'Valor Pago';
      case 'saldoAberto': return 'Saldo em Aberto';
      case 'salarioBase': return 'Salário Base';
      case 'salarioFamilia': return 'Salário Família';
      case 'totalAcrescimos': return 'Total Acréscimos';
      case 'totalDescontos': return 'Total Descontos';
      case 'descontoRepousoRemunerado': return 'Repouso Remunerado';
      case 'descontoINSSManual': return 'INSS (Manual)';
      case 'emprestimoConsignado': return 'Empréstimo';
      default: return k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase()).replace('Cpf','CPF');
    }
  };
  const totals = Object.fromEntries(selectedNumeric.map(k => [k, selecionados.reduce((sum, r) => sum + (Number(r[k])||0), 0)]));
  const totalAcrescimosReal = selecionados.reduce((sum, r) => sum + (Number(r.totalAcrescimos)||0), 0);
  const totalDescontosReal = selecionados.reduce((sum, r) => sum + (Number(r.totalDescontos)||0), 0);
  const totalLiquidoReal = selecionados.reduce((sum, r) => sum + (Number(r.salarioLiquido)||0), 0);
  const totalPagos = selecionados.reduce((sum, r) => sum + (Number(r.valorPago)||0), 0);
  const totalRestantes = selecionados.reduce((sum, r) => sum + (Number(r.saldoAberto)||0), 0);
  const creditKeys = ['salarioBase','valorHorasExtras','bonificacoes','periculosidade','adicionalNoturno','insalubridade','salarioFamilia','premioAssiduidade','totalAcrescimos'];
  const neutralKeys = ['valorQuinzena'];
  const debitKeys = ['inss','irrf','vales','outrosDescontos','descontoFaltas','descontoRepousoRemunerado','descontoINSSManual','contribuicaoConfederativa','contribuicaoSindical','descontoIRPJ','emprestimoConsignado','totalDescontos'];
  const fmt = (n) => fmtMoedaResumo(n);
  const statusCards = somenteAbertos
    ? `<div class="total-card remaining"><div class="label">Total em Aberto</div><div class="value">${fmt(totalRestantes)}</div></div>`
    : `<div class="total-card paid"><div class="label">Total Pagos</div><div class="value">${fmt(totalPagos)}</div></div>
    <div class="total-card remaining"><div class="label">Total Restantes</div><div class="value">${fmt(totalRestantes)}</div></div>`;
  const totalsCards = `<div class="summary-totals">
    <div class="total-card credit"><div class="label">Total Acréscimos</div><div class="value">${fmt(totalAcrescimosReal)}</div></div>
    <div class="total-card debit"><div class="label">Total Descontos</div><div class="value">${fmt(totalDescontosReal)}</div></div>
    <div class="total-card net"><div class="label">Total Líquido</div><div class="value">${fmt(totalLiquidoReal)}</div></div>
    ${statusCards}
  </div>`;
  // Remover duplicatas: não repetir agregados já exibidos nos cartões
  const aggregatedSet = new Set(['totalAcrescimos','totalDescontos','salarioLiquido']);
  const isCredit = (k) => creditKeys.includes(k);
  const isNeutral = (k) => neutralKeys.includes(k);
  const isDebit  = (k) => debitKeys.includes(k);
  const gridKeys = selectedNumeric
    .filter(k => !aggregatedSet.has(k))
    .sort((a,b) => {
      const pa = isCredit(a) ? 0 : isNeutral(a) ? 1 : isDebit(a) ? 2 : 3;
      const pb = isCredit(b) ? 0 : isNeutral(b) ? 1 : isDebit(b) ? 2 : 3;
      if (pa !== pb) return pa - pb;
      // manter ordem do usuário dentro do grupo
      return cols.indexOf(a) - cols.indexOf(b);
    });
  const itemsHtml = gridKeys.map(k => {
    const v = fmtMoedaResumo(totals[k] || 0);
    return `<div class="summary-item"><div class="label">${labels(k)}</div><div class="value">${v}</div></div>`;
  }).join('');
  const pageBreakClass = (cfg.pageBreakMode === 'always') ? 'page-break' : (cfg.pageBreakMode === 'auto' && selectedNumeric.length > (cfg.threshold||12) ? 'page-break' : '');
  const zebraClass = (cfg.zebra ? 'zebra' : '');
  return `<div class="compact-summary ${pageBreakClass} ${zebraClass}"><div class="summary-header">Resumo de Subtotais</div>${totalsCards}<div class="summary-grid">${itemsHtml}</div></div>`;
})()}
</body>
</html>`;
        return html;
    }
}

// ✅ Helper global de dados da empresa (fora da classe)
if (!window.getCompanyData) {
	try {
		window.getCompanyData = async function() {
			try {
				const normalizeLogo = (value) => {
					if (!value) return '';
					const s = String(value).trim();
					if (!s) return '';
					if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('file:')) return s;
					if (/^https?:\/\//i.test(s)) return s;
					if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 80) return `data:image/png;base64,${s}`;
					if (/^(\.\/|\.\.\/|\/)/.test(s) || /\.(png|jpg|jpeg|webp|svg)$/i.test(s)) return s;
					return s;
				};

				const centralSvc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
				if (centralSvc && typeof centralSvc.getCompanyProfileForReport === 'function') {
					try {
						const centralResult = await centralSvc.getCompanyProfileForReport();
						const centralData = centralResult && centralResult.success !== false
							? (centralResult.data || centralResult)
							: null;
						if (centralData && typeof centralData === 'object') {
							const logoCandidate = centralData.logoUrl || centralData.logoURL || centralData.logoDownloadURL || centralData.logoStoragePath || centralData.logoPath || centralData.logo || centralData.logoBase64 || centralData.logoData || '';
							const merged = { ...centralData, logo: normalizeLogo(logoCandidate) };
							try { localStorage.setItem('company_info', JSON.stringify({ ...merged })); } catch (_) {}
							return merged;
						}
					} catch (error) {
						console.warn('Aviso ao obter empresa pelo helper central:', error);
					}
				}

				const resolveCompanyId = () => {
					try {
						const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
						if (svc && typeof svc.getCurrentTenantId === 'function') {
							const t = svc.getCurrentTenantId();
							if (t) return String(t);
						}
						if (svc && typeof svc.getTenantId === 'function') {
							const t = svc.getTenantId();
							if (t) return String(t);
						}
					} catch (_) {}
					try {
						if (window.appTenantId) return String(window.appTenantId);
						if (window.companyInfo) {
							const raw = window.companyInfo;
							const id = raw && (raw.companyId || raw.companyID || raw.tenantId || raw.id);
							if (id) return String(id);
						}
						const stored = localStorage.getItem('company_info');
						if (stored) {
							const obj = JSON.parse(stored);
							const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
							if (id) return String(id);
						}
					} catch (_) {}
					return null;
				};

				const defaults = {
					nome: "Empresa não informada",
					name: "Empresa não informada",
					cnpj: "-",
					endereco: "-",
					address: "-",
					cidade: "-",
					city: "-",
					estado: "-",
					state: "-",
					telefone: "-",
					phone: "-",
					email: "-",
					logo: "",
					logoSvg: true
				};

				const tenantId = resolveCompanyId();
				const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
				let companyData = null;

				if (tenantId && svc && typeof svc.setTenantId === 'function') {
					try { svc.setTenantId(tenantId); } catch (_) {}
				}

				if (tenantId && svc && typeof svc.loadFromFirebase === 'function') {
					try {
						const byPath = await svc.loadFromFirebase(`companies/${tenantId}/profile`);
						const byPathData = byPath && (byPath.success === false ? byPath.data : (byPath.data || byPath));
						if (byPathData && typeof byPathData === 'object') {
							companyData = { ...byPathData, id: tenantId, companyId: tenantId, tenantId: tenantId };
						}
					} catch (_) {}
				}

				if (!companyData && typeof window.getData === 'function' && tenantId) {
					try {
						const byPath = await window.getData(`companies/${tenantId}/profile`, { debounceMs: 0 });
						if (byPath && typeof byPath === 'object') {
							companyData = { ...byPath, id: tenantId, companyId: tenantId, tenantId: tenantId };
						}
					} catch (_) {}
				}

				if (!companyData) {
					try {
						const stored = localStorage.getItem('company_info');
						if (stored) {
							const obj = JSON.parse(stored);
							if (obj && typeof obj === 'object') companyData = obj;
						}
					} catch (_) {}
				}

				if (!companyData && tenantId) {
					try {
						const companyPayload = await getData(`companies/${tenantId}/profile`);
						if (companyPayload && typeof companyPayload === 'object') {
							companyData = { ...companyPayload, id: tenantId, companyId: tenantId, tenantId: tenantId };
						}
					} catch (_) {}
				}

				const merged = { ...defaults, ...(companyData || {}) };
				const nomeResolved = merged.name || merged.nome;
				if (nomeResolved) { merged.nome = nomeResolved; merged.name = nomeResolved; }
				const enderecoResolved = merged.address || merged.endereco;
				if (enderecoResolved) { merged.endereco = enderecoResolved; merged.address = enderecoResolved; }
				const cidadeResolved = merged.city || merged.cidade;
				if (cidadeResolved) { merged.cidade = cidadeResolved; merged.city = cidadeResolved; }
				const estadoResolved = merged.state || merged.estado;
				if (estadoResolved) { merged.estado = estadoResolved; merged.state = estadoResolved; }
				const telefoneResolved = merged.phone || merged.telefone;
				if (telefoneResolved) { merged.telefone = telefoneResolved; merged.phone = telefoneResolved; }
				const logoCandidate = merged.logoUrl || merged.logoURL || merged.logoDownloadURL || merged.logoStoragePath || merged.logoPath || merged.logo || merged.logoBase64 || merged.logoData || '';
				merged.logo = normalizeLogo(logoCandidate);
				if (!merged.logo || String(merged.logo).trim() === '') merged.logo = '';
				try { localStorage.setItem('company_info', JSON.stringify({ ...merged })); } catch (_) {}
				return merged;
			} catch (e) {
				return {
					nome: "Empresa não informada",
					cnpj: "-",
					endereco: "-",
					cidade: "-",
					estado: "-",
					telefone: "-",
					logo: '',
					logoSvg: true
				};
			}
		};
		console.log('📌 getCompanyData global exposto para relatórios externos');
	} catch (ex) {
		// não bloquear se falhar
	}
}

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.openRelatorioModal = function() {
    if (window.folhaRelatorios) {
        window.folhaRelatorios.openRelatorioModal();
    }
};

window.closeRelatorioModal = function() {
    if (window.folhaRelatorios) {
        window.folhaRelatorios.closeRelatorioModal();
    }
};

window.printFolha = function(folhaId) {
    if (window.folhaRelatorios) {
        // NOVO: Usar recibo detalhado em vez do demonstrativo simples
        window.folhaRelatorios.gerarReciboIndividualDetalhado(folhaId);
    }
};

// REMOVIDO: Função duplicada - usar apenas a versão de folha-main.js

// 🖨️ Atalhos diretos para os três relatórios solicitados
window.imprimirRelatorio = async function(tipo) {
    if (!window.folhaRelatorios) return;
    // Usar dados mais recentes dos lançamentos
    const dadosBrutos = (window.folhaLancamentos && window.folhaLancamentos.lancamentos) || window.folhaRelatorios.lancamentos || [];
    const mesEl = document.getElementById('mesAno');
    const mesSelecionado = ((mesEl && mesEl.value) || '');
    const dataInicio = mesSelecionado || new Date().toISOString().slice(0, 7);
    const dataFim = dataInicio;
    
    // ✅ APLICAR FILTRO DE FUNCIONÁRIOS INATIVOS (CORREÇÃO CRÍTICA)
    const dados = window.folhaRelatorios.filtrarDadosPorPeriodo(dataInicio, dataFim, dadosBrutos);
    console.log(`📊 Dados filtrados para relatório ${tipo}: ${dados.length}/${dadosBrutos.length}`);

    let html = '';
    switch (tipo) {
        case 'quinzena':
            html = await window.folhaRelatorios.gerarRelatorioQuinzena(dados, dataInicio, dataFim);
            break;
        case 'fechamento':
            html = await window.folhaRelatorios.gerarRelatorioFechamentoComAbatimento(dados, dataInicio, dataFim);
            break;
        case 'simples':
            html = await window.folhaRelatorios.gerarRelatorioSimples(dados, dataInicio, dataFim, {});
            break;
        default:
            console.warn('Tipo de relatório não suportado:', tipo);
            return;
    }
    window.folhaRelatorios.imprimirRelatorio(html);
};

// ✅ INICIALIZAÇÃO AUTOMÁTICA
document.addEventListener('DOMContentLoaded', () => {
    // Aguardar carregamento dos outros módulos
    const initRelatorios = () => {
        if (window.database) {
            window.folhaRelatorios = new FolhaRelatorios();
            console.log('✅ Sistema de relatórios inicializado');
        } else {
            setTimeout(initRelatorios, 1000);
        }
    };
    
    initRelatorios();
    // Garantir funções globais para onclick de folha.html
    if (!window.openRelatorioModal) {
        window.openRelatorioModal = function() {
            if (window.folhaRelatorios) {
                window.folhaRelatorios.openRelatorioModal();
            } else {
                console.warn('Relatórios ainda não inicializados. Tentando novamente...');
                setTimeout(() => window.openRelatorioModal && window.openRelatorioModal(), 300);
            }
        };
    }
    if (!window.openResumoFolhaModal) {
        window.openResumoFolhaModal = function() {
            if (window.folhaRelatorios) {
                window.folhaRelatorios.openResumoFolhaModal();
            } else {
                console.warn('Relatórios ainda não inicializados. Tentando novamente...');
                setTimeout(() => window.openResumoFolhaModal && window.openResumoFolhaModal(), 300);
            }
        };
    }
    if (!window.closeResumoFolhaModal) {
        window.closeResumoFolhaModal = function() {
            if (window.folhaRelatorios) {
                window.folhaRelatorios.closeResumoFolhaModal();
            } else {
                const modal = document.getElementById('resumoFolhaModal');
                if (modal) modal.style.display = 'none';
            }
        };
    }
    if (!window.closeRelatorioModal) {
        window.closeRelatorioModal = function() {
            if (window.folhaRelatorios) {
                window.folhaRelatorios.closeRelatorioModal();
            } else {
                const modal = document.getElementById('relatorioModal');
                if (modal) modal.style.display = 'none';
            }
        };
    }
});

// ✅ FUNÇÃO GLOBAL PARA ABRIR MODAL DE FUNCIONÁRIOS (ESPECÍFICA PARA RELATÓRIOS)
window.openFuncionariosListModalForRelatorio = function() {
    if (window.folhaRelatorios) {
        window.folhaRelatorios.openFuncionariosListModalForRelatorio();
    } else {
        console.warn('⚠️ Módulo folhaRelatorios não carregado');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    }
};

// ✅ FUNÇÃO DE DEBUG PARA TESTAR DEMONSTRATIVO INDIVIDUAL
window.debugDemonstrativoIndividual = function(nomeFuncionario) {
    console.log(`🔍 ===== DEBUG DEMONSTRATIVO INDIVIDUAL: ${nomeFuncionario} =====`);
    
    if (!window.folhaRelatorios) {
        console.error('❌ folhaRelatorios não carregado');
        return;
    }
    
    // Buscar funcionário por nome
    const funcionario = window.folhaRelatorios.funcionarios.find(f => 
        f.nome && f.nome.toLowerCase().includes(nomeFuncionario.toLowerCase())
    );
    
    if (!funcionario) {
        console.error(`❌ Funcionário "${nomeFuncionario}" não encontrado no cadastro`);
        console.log('👥 Funcionários disponíveis:', window.folhaRelatorios.funcionarios.map(f => f.nome));
        return;
    }
    
    console.log(`👤 Funcionário encontrado:`, funcionario);
    
    // Obter dados como no relatório
    const baseDados = (window.folhaLancamentos && window.folhaLancamentos.lancamentos) || window.folhaRelatorios.lancamentos || [];
    const dadosLimpos = baseDados.filter(item => item.status !== 'mes_fechado');
    
    console.log(`📊 Total de dados limpos: ${dadosLimpos.length}`);
    
    // Buscar lançamentos do funcionário
    const lancamentosFuncionario = dadosLimpos.filter(l => ((l && l.funcionario && l.funcionario.id) === funcionario.id));
    console.log(`📋 Lançamentos do funcionário ${funcionario.nome}: ${lancamentosFuncionario.length}`);
    
    if (lancamentosFuncionario.length > 0) {
        console.log('📅 Meses/Anos dos lançamentos:', lancamentosFuncionario.map(l => l.mesAno));
        console.log('🔍 Exemplo de lançamento:', lancamentosFuncionario[0]);
    } else {
        console.log('⚠️ NENHUM LANÇAMENTO ENCONTRADO');
        console.log('🔍 Verificando todos os IDs nos dados:');
        const idsUnicos = [...new Set(dadosLimpos.map(l => ((l && l.funcionario && l.funcionario.id))).filter(Boolean))];
        console.log('🆔 IDs únicos nos dados:', idsUnicos);
        console.log('🎯 ID procurado:', funcionario.id);
        
        // Verificar correspondências parciais
        const correspondencias = dadosLimpos.filter(l => 
            ((l && l.funcionario && l.funcionario.nome && l.funcionario.nome.toLowerCase().includes(nomeFuncionario.toLowerCase())))
        );
        if (correspondencias.length > 0) {
            console.log('🔍 Correspondências por nome:', correspondencias.map(l => 
                `${(((l && l.funcionario && l.funcionario.nome) || ''))} (ID: ${(((l && l.funcionario && l.funcionario.id) || ''))})`
            ));
        }
    }
    
    console.log(`🔍 ===== FIM DEBUG =====`);
    return {
        funcionario,
        lancamentos: lancamentosFuncionario,
        totalDados: dadosLimpos.length
    };
};

// ✅ EXPORTAR PARA MÓDULOS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FolhaRelatorios, RELATORIOS_CONFIG };
}
