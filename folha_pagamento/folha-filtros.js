/**
 * 🔍 FOLHA FILTROS - Sistema de filtros e pesquisas avançadas
 * Baseado nos padrões do romaneiopct com filtros dinâmicos
 * Implementa filtros por período, funcionário, tipo e busca em tempo real
 */

// ✅ CONFIGURAÇÕES E CONSTANTES
const FILTROS_CONFIG = {
    DEBOUNCE_DELAY: 120,  // Delay para filtros em tempo real (otimizado)
    FILTROS_DISPONIVEIS: [
        { id: 'mesAno', label: 'Mês/Ano', type: 'month' },
        { id: 'tipoFolha', label: 'Tipo', type: 'select' },
        { id: 'funcionarioFiltro', label: 'Funcionário', type: 'autocomplete' }
    ],
    OPCOES_TIPO: [
        { value: '', label: 'Todos' },
        { value: 'quinzena', label: 'Quinzena' },
        { value: 'mes', label: 'Mês Fechado' }
    ]
};

function persistLocalValue(storageKey, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write(storageKey, data) !== false;
        }
    } catch (_) {}
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    localStorage.setItem(storageKey, payload);
    return true;
}

function readPersistedLocalValue(storageKey, fallback = null) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.read === 'function') {
            const value = window.SiswebStorage.read(storageKey);
            return value == null ? fallback : value;
        }
    } catch (_) {}
    try {
        const value = localStorage.getItem(storageKey);
        return value == null ? fallback : value;
    } catch (_) {
        return fallback;
    }
}

// ✅ CLASSE PRINCIPAL DE FILTROS
class FolhaFiltros {
    constructor() {
        this.filtrosAtivos = {};
        this.dadosOriginais = [];
        this.dadosFiltrados = [];
        this.debounceTimers = {};
        this._dataReady = false;
        this._initialRendered = false;
        this._lastValidMesAno = '';
        this._dataReadyApplied = false;
        this._lastApplySignature = '';
        this._lastApplyAt = 0;
        this._lastDataReadySignature = '';
        this._lastDataReadyAt = 0;
        
        this.init();
    }
    
    init() {
        if (window.__folhaDebug) console.log('🔍 Inicializando sistema de filtros...');
        this.setupEventListeners();
        this.setupSyncListeners();
        this.setupAutocompleteFilters();
        
        // ✅ CORREÇÃO: Carregar dados primeiro, depois aguardar evento folhaDataReady
        this.loadInitialData();
        // 🔁 Restaurar filtros persistidos do storage
        this.restorePersistedFilters && this.restorePersistedFilters();
        
        // ✅ FALLBACK: aplicar mês atual SOMENTE se dados estiverem prontos e houver registros do mês
        setTimeout(() => {
            if (this._dataReady && this.dadosOriginais.length > 0 && Object.keys(this.filtrosAtivos).length === 0) {
                const now = new Date();
                const yyyyMm = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                const existeMes = this.dadosOriginais.some(f => f && f.mesAno === yyyyMm);
                if (existeMes) {
                    if (window.__folhaDebug) console.log('⚠️ Fallback: Aplicando mês atual após timeout (existe dado para o mês)...');
                    this.setCurrentMonth();
                } else {
                    if (window.__folhaDebug) console.log('ℹ️ Fallback de mês atual ignorado (sem dados para o mês)');
                }
            }
        }, 3000);
    }

    /**
     * 🔁 Restaurar filtros ativos do storage
     */
    restorePersistedFilters() {
        try {
            const savedRaw = readPersistedLocalValue('folha_filtros_ativos', '{}');
            const saved = typeof savedRaw === 'string' ? JSON.parse(savedRaw || '{}') : (savedRaw || {});
            const mesAnoFilter = document.getElementById('mesAno');
            const tipoFolhaFilter = document.getElementById('tipoFolha');
            const funcionarioFilter = document.getElementById('funcionarioFiltro');
            const normalizeMes = (val) => { if (window.FolhaUtils && typeof window.FolhaUtils.normalizeMesAno === 'function') { return window.FolhaUtils.normalizeMesAno(val); } const s = String(val||'').trim(); if (/^\d{4}-\d{2}$/.test(s)) return s; const m=s.match(/^(\d{2})\/(\d{4})$/); if(m) return `${m[2]}-${m[1]}`; const m2=s.match(/^(\d{4})[\/-](\d{2})$/); if(m2) return `${m2[1]}-${m2[2]}`; return s; };
            const now = new Date();
            const yyyyMm = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            const savedMesAno = saved && saved.mesAno ? normalizeMes(saved.mesAno) : '';
            const mesAnoInicial = /^\d{4}-\d{2}$/.test(savedMesAno) ? savedMesAno : yyyyMm;
            const allowedTipos = ['', 'quinzena', 'mes'];

            if (mesAnoFilter) {
                mesAnoFilter.value = mesAnoInicial;
                this.filtrosAtivos.mesAno = mesAnoInicial;
            } else {
                this.filtrosAtivos.mesAno = mesAnoInicial;
            }
            this._lastValidMesAno = mesAnoInicial;
            this._restoredMesAnoFromStorage = !!savedMesAno;

            // Padronizar Tipo inicial para "Todos" quando storage estiver vazio ou inválido
            if (tipoFolhaFilter) {
                const tipoVal = (saved && typeof saved.tipoFolha === 'string' && allowedTipos.includes(saved.tipoFolha)) ? saved.tipoFolha : '';
                tipoFolhaFilter.value = tipoVal;
                this.filtrosAtivos.tipoFolha = tipoVal;
            } else {
                this.filtrosAtivos.tipoFolha = (saved && typeof saved.tipoFolha === 'string' && allowedTipos.includes(saved.tipoFolha)) ? saved.tipoFolha : '';
            }

            // Restaurar funcionário se houver
            if (funcionarioFilter && saved && saved.funcionario) {
                funcionarioFilter.value = saved.funcionario;
                this.filtrosAtivos.funcionario = saved.funcionario;
            }

            // Persistir nova base dos filtros ativos (com mês atual quando necessário)
            try { persistLocalValue('folha_filtros_ativos', this.filtrosAtivos); } catch(e) {}
            if (window.__folhaDebug) console.log('🔁 Filtros restaurados/normalizados:', this.filtrosAtivos);
        } catch (e) {
            console.warn('⚠️ Falha ao restaurar filtros persistidos:', e.message);
        }
    }
    
    /**
     * 🎯 CONFIGURAR EVENT LISTENERS (CORRIGIDO - COM PROTEÇÃO CONTRA DUPLICAÇÃO)
     */
    setupEventListeners() {
        // PROTEÇÃO CONTRA DUPLICAÇÃO
        if (this._eventListenersConfigured) {
            if (window.__folhaDebug) console.log('⚠️ Event listeners de filtros já foram configurados, pulando...');
            return;
        }
        
        if (window.__folhaDebug) console.log('🎯 Configurando event listeners de filtros...');

        // Utilitário: debounce simples
        if (!this._debouncers) this._debouncers = {};
        const debounce = (key, fn, delay = 250) => {
            return (...args) => {
                if (this._debouncers[key]) clearTimeout(this._debouncers[key]);
                this._debouncers[key] = setTimeout(() => fn.apply(this, args), delay);
            };
        };
        // Utilitário: normalizar texto (remover acentos)
        const normalizeText = (s) => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // Filtro de mês/ano - COM PROTEÇÃO
        const mesAnoFilter = document.getElementById('mesAno');
        if (mesAnoFilter && !mesAnoFilter._filtroListenerConfigured) {
            mesAnoFilter.addEventListener('change', () => {
                if (mesAnoFilter.value) this._lastValidMesAno = mesAnoFilter.value;
                this.updateFiltro('mesAno', mesAnoFilter.value);
            });
            mesAnoFilter.addEventListener('input', () => {
                if (mesAnoFilter.value) this._lastValidMesAno = mesAnoFilter.value;
            });
            // Guardar contra limpezas não intencionais (por outros módulos)
            try {
                const obs = new MutationObserver(() => {
                    const v = mesAnoFilter.value;
                    if (!v && this._lastValidMesAno) {
                        console.log('🛡️ Restaurando Mês/Ano após limpeza não intencional:', this._lastValidMesAno);
                        mesAnoFilter.value = this._lastValidMesAno;
                    }
                });
                obs.observe(mesAnoFilter, { attributes: true, attributeFilter: ['value'] });
                mesAnoFilter._mesAnoObserver = obs;
            } catch(e) { console.warn('⚠️ Falha ao observar Mês/Ano:', e.message); }
            mesAnoFilter._filtroListenerConfigured = true;
            if (window.__folhaDebug) console.log('✅ Event listener mesAno configurado');
        }
        
        // Filtro de tipo - COM PROTEÇÃO
        const tipoFolhaFilter = document.getElementById('tipoFolha');
        if (tipoFolhaFilter && !tipoFolhaFilter._filtroListenerConfigured) {
            tipoFolhaFilter.addEventListener('change', () => {
                this.updateFiltro('tipoFolha', tipoFolhaFilter.value);
            });
            tipoFolhaFilter._filtroListenerConfigured = true;
            if (window.__folhaDebug) console.log('✅ Event listener tipoFolha configurado');
        }
        
        // Filtro de funcionário - COM PROTEÇÃO
        const funcionarioFilter = document.getElementById('funcionarioFiltro');
        if (funcionarioFilter && !funcionarioFilter._filtroListenerConfigured) {
            // Input digitação texto - FILTRO EM TEMPO REAL
            const applyFuncionarioFilterDebounced = debounce('funcionarioFiltro', (valor) => {
                const norm = normalizeText(valor);
                if (norm) {
                    this.updateFiltro('funcionario', norm);
                    delete this.filtrosAtivos.funcionarioId;
                } else {
                    delete this.filtrosAtivos.funcionario;
                    delete this.filtrosAtivos.funcionarioId;
                }
                this.aplicarFiltros();
            }, 300);
            funcionarioFilter.addEventListener('input', (event) => {
                const valor = event.target.value.trim();
                if (window.__folhaDebug) console.log(`🔍 Filtro de funcionário (debounced): "${valor}"`);
                applyFuncionarioFilterDebounced(valor);
            });
            
            // Suporte a seleção via autocomplete: quando dataset.funcionarioId é setado, filtrar por id
            funcionarioFilter.addEventListener('change', (event) => {
                const selectedId = event.target.dataset.funcionarioId || '';
                if (selectedId) {
                    if (window.__folhaDebug) console.log(`🎯 Funcionário selecionado via modal, aplicando filtro por ID: ${selectedId}`);
                    // Priorizar filtro por id (exato). Remover texto para evitar conflito
                    delete this.filtrosAtivos.funcionario;
                    this.updateFiltro('funcionarioId', selectedId);
                    
                    // Aplicar filtros imediatamente
                    setTimeout(() => {
                        this.aplicarFiltros();
                    }, 100);
                } else if (!event.target.value.trim()) {
                    // Se limpou o campo, remover os filtros de funcionário e recarregar
                    delete this.filtrosAtivos.funcionario;
                    delete this.filtrosAtivos.funcionarioId;
                    this.aplicarFiltros();
                    this.updateClearButton();
                }
            });
            
            funcionarioFilter._filtroListenerConfigured = true;
            console.log('✅ Event listeners funcionarioFiltro configurados (input + change)');
        }
        
        // Botão limpar filtros
        this.createClearFiltersButton();
        
        // Escutar mudanças nos dados dos outros módulos
        this.setupDataListeners();
        
        this._eventListenersConfigured = true;
        console.log('✅ Event listeners de filtros configurados (sem duplicação)');
    }
    
    /**
     * 📡 CONFIGURAR LISTENERS DE SINCRONIZAÇÃO (NOVA FUNCIONALIDADE)
     */
    setupSyncListeners() {
        // Listener para mudanças de dados do sistema principal
        window.addEventListener('folhaDataChanged', (event) => {
            console.log('📡 Evento de mudança de dados recebido nos filtros:', event.detail);
            
            // Se a mudança incluir funcionários ou folhas, recarregar dados
            if (event.detail.dataTypes.some(type => ['funcionarios', 'folhas'].includes(type))) {
                console.log('🔄 Recarregando dados dos filtros devido a mudança no sistema...');
                setTimeout(() => {
                    this.reloadData();
                }, 500); // Delay para garantir que o banco foi atualizado
            }
        });
        // Listener direto para atualizações de folhas (emitido em folha-lancamentos)
        window.addEventListener('folhas:updated', (e) => {
            const src = e && e.detail && e.detail.source;
            console.log('📡 Evento folhas:updated recebido nos filtros - reloading data', { source: src });
            if (!this._dataReady) { console.log('⏳ Ignorando reload até dados prontos'); return; }
            const fastSources = new Set(['createLancamento','updateLancamento','handleFolhaSubmit']);
            const delay = fastSources.has(src) ? 60 : 150;
            if (this._reloadTimer) clearTimeout(this._reloadTimer);
            this._reloadTimer = setTimeout(() => {
                this._reloadTimer = null;
                this.reloadData();
            }, delay);
        });
        
        // ✅ NOVO: Listener para saber quando dados do main estão prontos
        window.addEventListener('folhaDataReady', (event) => {
            this._dataReady = true;
            this.dadosOriginais = (event && event.detail && Array.isArray(event.detail.folhas)) ? event.detail.folhas : (window.folhaSystem && Array.isArray(window.folhaSystem.folhas) ? window.folhaSystem.folhas : []);
            this.dadosFiltrados = [...this.dadosOriginais];
            const dataKey = this._getDataSignature(this.dadosOriginais);
            const now = Date.now();
            if (this._lastDataReadySignature === dataKey && (now - this._lastDataReadyAt) < 800) {
                return;
            }
            this._lastDataReadySignature = dataKey;
            this._lastDataReadyAt = now;
            if (window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function') {
                if (window.FolhaUtils.shouldLogDataChange('folhaDataReady', dataKey)) {
                    console.log('📡 Dados do folha-main prontos, assumindo controle da renderização...');
                }
            }
            setTimeout(() => {
                if (this._dataReadyApplied) { return; }
                const now = new Date();
                const yyyyMm = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
                const mesInput = document.getElementById('mesAno');
                const existsMes = Array.isArray(this.dadosOriginais) && this.dadosOriginais.some(f => {
                    const s = String((f && f.mesAno) || '').trim();
                    if (/^\d{4}-\d{2}$/.test(s)) return s === yyyyMm;
                    const m = s.match(/^(\d{2})\/(\d{4})$/);
                    return m ? `${m[2]}-${m[1]}` === yyyyMm : false;
                });
                if (existsMes && (!this.filtrosAtivos.mesAno || String(this.filtrosAtivos.mesAno).trim() === '')) {
                    if (mesInput) { mesInput.value = yyyyMm; }
                    this._lastValidMesAno = yyyyMm;
                    this.filtrosAtivos.mesAno = yyyyMm;
                    try { persistLocalValue('folha_filtros_ativos', this.filtrosAtivos); } catch(e) {}
                }
                this._dataReadyApplied = true;
                this.aplicarFiltros();
            }, 150);
        });
        
            if (window.__folhaDebug) console.log('✅ Listeners de sincronização configurados nos filtros');
    }

    /**
     * 📊 CONFIGURAR LISTENERS DE DADOS (CORRIGIDO - SEM INTERCEPTAÇÃO PERIGOSA)
     */
    setupDataListeners() {
        // ❌ Desativado watcher periódico que causava re-render em loop
        // ✅ Usar somente eventos: 'folhas:updated' e 'folhaDataChanged'
        console.log('ℹ️ Watcher periódico desativado; usando somente eventos para sincronizar dados');
    }
    
    /**
     * 📋 CARREGAR DADOS INICIAIS
     */
    loadInitialData() {
        let origem = [];
        // ✅ Preferir SEMPRE dados normalizados do sistema quando disponíveis
        if (window.folhaSystem && Array.isArray(window.folhaSystem.folhas) && window.folhaSystem.folhas.length > 0) {
            origem = [...window.folhaSystem.folhas];
        } else if (window.folhaLancamentos && Array.isArray(window.folhaLancamentos.lancamentos) && window.folhaLancamentos.lancamentos.length > 0) {
            origem = [...window.folhaLancamentos.lancamentos];
        }
        if (window.FolhaUtils && typeof window.FolhaUtils.normalizarLancamentos === 'function') {
            origem = window.FolhaUtils.normalizarLancamentos(origem);
        }
        this.dadosOriginais = origem;
        this.dadosFiltrados = [...this.dadosOriginais];
        const dataKey = this._getDataSignature(this.dadosOriginais);
        if (window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function') {
            if (window.FolhaUtils.shouldLogDataChange('loadInitialData', dataKey)) {
                console.log(`🔍 ${this.dadosOriginais.length} registros carregados para filtros`);
                console.log(`🔍 Dados carregados: ${this.dadosOriginais.length} registros disponíveis para filtros`);
            }
        }

        // Fallback: se vazio, tentar buscar do Firebase/serviço
        if (!Array.isArray(this.dadosOriginais) || this.dadosOriginais.length === 0) {
            setTimeout(async () => {
                try {
                    let arr = [];
                    if (window.folhaLancamentos && typeof window.folhaLancamentos.buscarTodasFolhas === 'function') {
                        arr = await window.folhaLancamentos.buscarTodasFolhas();
                    } else if (window.database) {
                        const { ref, get } = await import('../firebase-init.js');
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
                        const folhasRef = ref(window.database, resolvePath('folhas'));
                        const snapshot = await get(folhasRef);
                        arr = snapshot.val() ? Object.entries(snapshot.val()).map(([key, val]) => ({ ...(val || {}), id: key })) : [];
                    }
                    if (window.FolhaUtils && typeof window.FolhaUtils.normalizarLancamentos === 'function') {
                        arr = window.FolhaUtils.normalizarLancamentos(arr);
                    }
                    if (Array.isArray(arr) && arr.length > 0) {
                        // ⚠️ Somente usar fallback bruto se dados normalizados não estiverem disponíveis
                        if (!(window.folhaSystem && Array.isArray(window.folhaSystem.folhas) && window.folhaSystem.folhas.length > 0)) {
                            this.dadosOriginais = arr;
                            this.dadosFiltrados = [...arr];
                            console.log(`✅ Fallback de dados iniciais carregado: ${arr.length} registros`);
                        } else {
                            console.log('ℹ️ Ignorando fallback bruto; dados normalizados já disponíveis no sistema');
                        }
                        // Não aplicar filtros automaticamente; aguardar dados prontos
                    }
                } catch (e) {
                    console.error('❌ Erro no fallback de loadInitialData:', e);
                }
            }, 600);
        }
    }
    
    /**
     * 🎨 RENDERIZAR TABELA FILTRADA (FALLBACK)
     */
    renderizarTabelaFiltrada(dadosFiltrados) {
        if (!window.FolhaUtils || !window.FolhaUtils.renderizarTabelaLancamentos) {
            console.warn('⚠️ FolhaUtils não disponível para renderizar tabela filtrada');
            return;
        }
        
        try {
            // Usar a função unificada de renderização
            window.FolhaUtils.renderizarTabelaLancamentos(dadosFiltrados);
            const sig = window.FolhaUtils && typeof window.FolhaUtils.getDataSignature === 'function'
                ? window.FolhaUtils.getDataSignature(dadosFiltrados)
                : String((dadosFiltrados && dadosFiltrados.length) || 0);
            const logRender = window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function'
                ? window.FolhaUtils.shouldLogDataChange('folhaFiltros.renderFallback', sig)
                : !!window.__folhaDebug;
            if (logRender) console.log(`✅ Tabela filtrada renderizada com ${dadosFiltrados.length} itens`);
        } catch (error) {
            console.error('❌ Erro ao renderizar tabela filtrada:', error);
        }
    }
    
    /**
     * 🔄 ATUALIZAR FILTRO
     */
    updateFiltro(tipo, valor) {
        if (valor && valor.trim() !== '') {
            this.filtrosAtivos[tipo] = valor;
        } else {
            delete this.filtrosAtivos[tipo];
        }
        try { persistLocalValue('folha_filtros_ativos', this.filtrosAtivos); } catch(e) {}
        
        const filtrosKey = Object.keys(this.filtrosAtivos || {}).sort().map((k) => `${k}:${String(this.filtrosAtivos[k] ?? '')}`).join('|');
        const logUpdate = window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function'
            ? window.FolhaUtils.shouldLogDataChange('folhaFiltros.updateFiltro', `${tipo}|${valor}|${filtrosKey}`)
            : !!window.__folhaDebug;
        if (logUpdate) console.log('🔍 Filtros ativos:', this.filtrosAtivos);
        if (logUpdate) console.log(`🎯 Filtro ${tipo} atualizado para: "${valor}" - aplicando filtros...`);
        // ✅ Quando Mês/Ano muda, forçar reload do banco para garantir dados frescos
        if (tipo === 'mesAno') {
            this._forceDbReload = true;
            this.reloadData();
            // A aplicação dos filtros será agendada após dados frescos
            return;
        }
        // Aplicação com debounce para evitar múltiplas renderizações sucessivas
        this.scheduleApply();
        this.updateClearButton();
        
        if (logUpdate) console.log('✅ Totais devem ter sido atualizados após mudança de filtro');
    }

    /**
     * ⏱️ Debounce global de aplicação de filtros
     */
    scheduleApply(delay = 120) {
        if (this._applyTimer) clearTimeout(this._applyTimer);
        this._applyTimer = setTimeout(() => {
            try { this.aplicarFiltros(); } finally { this._applyTimer = null; }
        }, delay);
    }

    _getDataSignature(data) {
        if (!Array.isArray(data) || data.length === 0) return '0|0||';
        let maxTs = 0;
        let firstId = '';
        let lastId = '';
        for (const item of data) {
            if (!firstId) firstId = String(item && (item.id || item.key || item.$key || item.recordId) || '');
            lastId = String(item && (item.id || item.key || item.$key || item.recordId) || lastId || '');
            const t = new Date(item.updatedAt || item.dataAtualizacao || item.dataCriacao || item.createdAt || 0).getTime() || 0;
            if (t > maxTs) maxTs = t;
        }
        return `${data.length}|${maxTs}|${firstId}|${lastId}`;
    }

    _getApplySignature() {
        const filtrosKey = Object.keys(this.filtrosAtivos || {})
            .sort()
            .map((k) => `${k}:${String(this.filtrosAtivos[k] ?? '')}`)
            .join('|');
        const dataKey = this._getDataSignature(this.dadosOriginais);
        return `${filtrosKey}::${dataKey}`;
    }
    
    /**
     * ⏱️ DEBOUNCE FILTER (CORRIGIDO)
     */
    debounceFilter(tipo, valor) {
        // Limpar timer anterior
        if (this.debounceTimers[tipo]) {
            clearTimeout(this.debounceTimers[tipo]);
        }
        
        // ✅ CORREÇÃO: Aplicar filtro imediatamente para funcionário
        if (tipo === 'funcionario' && valor.trim()) {
            this.updateFiltro(tipo, valor);
        }
        
        // Configurar novo timer
        this.debounceTimers[tipo] = setTimeout(() => {
            const logDebounce = window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function'
                ? window.FolhaUtils.shouldLogDataChange('folhaFiltros.debounce', `${tipo}|${valor}`)
                : !!window.__folhaDebug;
            if (logDebounce) console.log(`⏱️ Aplicando filtro com debounce: ${tipo} = "${valor}"`);
            
            // ✅ CORREÇÃO: Aplicar filtros após o delay
            this.aplicarFiltros();
            
            // Limpar timer
            delete this.debounceTimers[tipo];
        }, FILTROS_CONFIG.DEBOUNCE_DELAY);
    }
    
    /**
     * 🎯 APLICAR FILTROS
     */
    aplicarFiltros() {
        // Garantir base de dados carregada antes de aplicar
        if (!Array.isArray(this.dadosOriginais) || this.dadosOriginais.length === 0) {
            // Tentar carregar rapidamente da origem disponível
            this.loadInitialData();
        }
        const nowTs = Date.now();
        const applyKey = this._getApplySignature();
        if (applyKey && this._lastApplySignature === applyKey && (nowTs - this._lastApplyAt) < 800) {
            return;
        }
        this._lastApplySignature = applyKey;
        this._lastApplyAt = nowTs;
        const dataKey = this._getDataSignature(this.dadosOriginais);
        const logApply = window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function'
            ? window.FolhaUtils.shouldLogDataChange('folhaFiltros.apply', `${applyKey}|${dataKey}`)
            : !!window.__folhaDebug;
        
        // ✅ SANITIZAÇÃO DE DADOS: Remover itens inválidos, vazios ou corrompidos antes de filtrar
        // Isso evita que a paginação receba "fantasmas" ou itens vazios
        let dadosFiltrados = this.dadosOriginais.filter(item => {
            if (!item || typeof item !== 'object') return false;
            // Verificar campos mínimos obrigatórios para exibição
            // Aceitar se tiver ID/Key E (Funcionário OU Mês/Ano)
            const temId = item.id || item.key || item.$key || item.recordId;
            const temFuncionario = item.funcionario && (item.funcionario.nome || item.funcionario.id);
            const temMesAno = item.mesAno && typeof item.mesAno === 'string';
            
            return temId && (temFuncionario || temMesAno);
        });
        
        const temFiltrosAtivos = Object.keys(this.filtrosAtivos).length > 0;
        const normalizeMes = (val) => {
            if (window.FolhaUtils && typeof window.FolhaUtils.normalizeMesAno === 'function') {
                return window.FolhaUtils.normalizeMesAno(val);
            }
            if (!val) return '';
            const s = String(val).trim();
            if (/^\d{4}-\d{2}$/.test(s)) return s;
            const m = s.match(/^(\d{2})\/(\d{4})$/);
            if (m) return `${m[2]}-${m[1]}`;
            const m2 = s.match(/^(\d{4})[\/-](\d{2})$/);
            if (m2) return `${m2[1]}-${m2[2]}`;
            const m3 = s.match(/^(\d{2})(\d{4})$/);
            if (m3) return `${m3[2]}-${m3[1]}`;
            return s;
        };
        
        if (logApply) console.log(`🔍 Aplicando filtros... Filtros ativos: ${temFiltrosAtivos ? 'SIM' : 'NÃO'}`);
        
        // ✅ CORREÇÃO: Sempre aplicar filtros automáticos para consistência, incluindo filtro de inativos em todos os casos
        if (logApply) console.log('🎯 Aplicando filtros automáticos essenciais (sempre)...');
        
        // Sempre aplicar filtros essenciais: ocultar inativos APENAS quando for possível confirmar
        const normalize = (s)=> String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        const getFuncionarioAtual = (l) => {
            const lista = (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) ? window.folhaSystem.funcionarios : [];
            if (!lista.length) return null;
            const id = (l && l.funcionario && l.funcionario.id) || (l && l.funcionarioId) || '';
            if (id) {
                const byId = lista.find(f => String(f.id) === String(id));
                if (byId) return byId;
            }
            const nomeLanc = normalize((l && l.funcionario && l.funcionario.nome) || '');
            if (nomeLanc) {
                const byName = lista.find(f => normalize(f.nome) === nomeLanc);
                if (byName) return byName;
            }
            return null;
        };
        let inativosConfirmados = 0;
        let inativosDiretos = 0;
        dadosFiltrados = dadosFiltrados.filter(lancamento => {
            // Não excluir 'mes_fechado' por padrão; será tratado via filtro de tipo
            const funcionarioAtual = getFuncionarioAtual(lancamento);
            // Excluir APENAS quando confirmado como inativo
            if (funcionarioAtual && funcionarioAtual.ativo === false) {
                inativosConfirmados += 1;
                return false;
            }
            if (lancamento.funcionario && lancamento.funcionario.ativo === false) {
                inativosDiretos += 1;
                return false;
            }
            // Se não for possível confirmar (não encontrado), manter o lançamento para não deixar a tabela vazia
            return true;
        });
        if (logApply && (inativosConfirmados > 0 || inativosDiretos > 0)) {
            console.log(`🚫 Inativos filtrados: ${inativosConfirmados} confirmados, ${inativosDiretos} diretos`);
        }
        
        if (logApply) {
            if (temFiltrosAtivos) {
                console.log('🎯 Aplicando filtros adicionais do usuário...');
            } else {
                console.log('📋 Sem filtros adicionais do usuário');
            }
        }
        
        // Aplicar cada filtro ativo do usuário
        Object.entries(this.filtrosAtivos).forEach(([tipo, valor]) => {
            if (valor && valor.toString().trim() !== '') {
                switch (tipo) {
                    case 'mesAno':
                        {
                            const alvo = normalizeMes(valor);
                            const resolveMesAno = (rec) => {
                                const s = String(rec.mesAno||'').trim();
                                if (/^\d{4}-\d{2}$/.test(s)) return s;
                                const m1 = s.match(/^(\d{2})\/(\d{4})$/);
                                if (m1) return `${m1[2]}-${m1[1]}`;
                                if (rec.ano && rec.mes) {
                                    const map = {'janeiro':'01','fevereiro':'02','marco':'03','março':'03','abril':'04','maio':'05','junho':'06','julho':'07','agosto':'08','setembro':'09','outubro':'10','novembro':'11','dezembro':'12'};
                                    const mnom = String(rec.mes).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                                    const mm = map[mnom] || String(rec.mes).padStart(2,'0');
                                    return `${rec.ano}-${mm}`;
                                }
                                if (rec.dataProcessamento) {
                                    const d = new Date(Number(rec.dataProcessamento));
                                    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                                }
                                return s;
                            };
                            dadosFiltrados = dadosFiltrados.filter(l => normalizeMes(resolveMesAno(l)) === alvo);
                        }
                        break;
                    case 'tipoFolha':
                        dadosFiltrados = dadosFiltrados.filter(l => l.tipo === valor);
                        break;
                    case 'funcionario':
                        {
                            const normalize = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                            const termo = normalize(valor);
                            dadosFiltrados = dadosFiltrados.filter(l => 
                                (l && l.funcionario && l.funcionario.nome && normalize(l.funcionario.nome).includes(termo)) ||
                                (l && l.funcionario && l.funcionario.cargo && normalize(l.funcionario.cargo).includes(termo))
                            );
                        }
                        break;
                    case 'funcionarioId':
                        // ✅ CORREÇÃO: Filtro por ID exato (mais preciso)
                        dadosFiltrados = dadosFiltrados.filter(l => {
                            const idA = (l && l.funcionario && l.funcionario.id) || '';
                            const idB = (l && l.funcionarioId) || '';
                            return String(idA) === String(valor) || String(idB) === String(valor);
                        });
                        break;
                    case 'buscaTextoLivre':
                        const busca = valor.toLowerCase().trim();
                        dadosFiltrados = dadosFiltrados.filter(l => 
                            (l && l.funcionario && l.funcionario.nome && l.funcionario.nome.toLowerCase().includes(busca)) ||
                            (l && l.funcionario && l.funcionario.cargo && l.funcionario.cargo.toLowerCase().includes(busca)) ||
                            (l && l.mesAno && l.mesAno.includes(busca))
                        );
                        break;
                }
            }
        });

        // Não excluir 'mes_fechado' por padrão; filtro de tipo controla visibilidade
        
        // ✅ CORREÇÃO CRÍTICA: Atualizar dados filtrados da instância ANTES de renderizar
        this.dadosFiltrados = dadosFiltrados;

        const badgeId = 'mesAnoBadgeInfo';
        const mesInput = document.getElementById('mesAno');
        const old = document.getElementById(badgeId);
        if (old) old.remove();
        if (this.dadosFiltrados.length === 0 && this.dadosOriginais.length > 0 && this.filtrosAtivos.mesAno) {
            const alvo = normalizeMes(this.filtrosAtivos.mesAno);
            const existeNoBanco = this.dadosOriginais.some(d => normalizeMes(d.mesAno) === alvo);
            if (!existeNoBanco && mesInput) {
                const badge = document.createElement('div');
                badge.id = badgeId;
                badge.style.cssText = 'font-size:12px;color:#c62828;margin-top:4px;';
                badge.textContent = 'Sem dados para este período';
                mesInput.after(badge);
            }
        }
        
        // ✅ CORREÇÃO: Preferir paginação, com fallback automático se a página renderizar vazia
        if (window.folhaPaginacao && typeof window.folhaPaginacao.aplicarFiltrosComPaginacao === 'function') {
            if (logApply) console.log('📊 Aplicando filtros via sistema de paginação...');
            try { window.folhaPaginacao.paginaAtual = 1; } catch(e) {}
            window.folhaPaginacao.aplicarFiltrosComPaginacao(dadosFiltrados);
            // ✅ CORREÇÃO: Aumentar timeout e verificar flag de renderização para evitar conflito
            setTimeout(() => {
                // Se estiver renderizando (flag do utils), não interferir
                if (window.__renderingFolhasTable) {
                    if (logApply) console.log('⏳ Renderização em andamento, cancelando fallback de filtros...');
                    return;
                }

                const tbody = document.getElementById('folhasTableBody');
                const temLinhas = tbody && tbody.querySelectorAll('tr').length > 0 && !tbody.textContent.includes('Nenhuma folha encontrada');
                
                // Só aplicar fallback se realmente estiver vazio E não estiver renderizando
                if (!temLinhas && dadosFiltrados.length > 0) {
                    // Verificação extra: se a paginação diz que tem itens, vamos confiar nela e não sobrescrever
                    if (window.folhaPaginacao && window.folhaPaginacao.totalItens > 0) {
                         if (logApply) console.log('ℹ️ Paginação ativa com itens detectados, evitando sobrescrever tabela com fallback.');
                         return;
                    }

                    if (logApply) console.log('⚠️ Página de paginação vazia ou inválida; aplicando renderização direta como fallback');
                    this.renderizarTabelaFiltrada(dadosFiltrados);
                    // 🔄 Sincronizar texto de paginação com renderização completa
                    if (window.folhaPaginacao && typeof window.folhaPaginacao.sincronizarInfoComRenderDireto === 'function') {
                        window.folhaPaginacao.sincronizarInfoComRenderDireto(dadosFiltrados.length);
                    }
                }
            }, 600);
        } else {
            // Fallback: renderizar diretamente
            if (logApply) console.log('📊 Aplicando filtros via renderização direta...');
            this.renderizarTabelaFiltrada(dadosFiltrados);
        }
        
        // ✅ CORREÇÃO CRÍTICA: SEMPRE calcular totais após renderizar, independente do método
        if (logApply) console.log('🧮 Calculando totais após aplicar filtros...');
        this.calcularTotaisFiltrados();
        
        // ✅ CORREÇÃO: Emitir evento para coordenar totais com outros módulos
        window.dispatchEvent(new CustomEvent('totaisFiltradosAtualizados', {
            detail: {
                dadosFiltrados: this.dadosFiltrados,
                temFiltrosAtivos: Object.keys(this.filtrosAtivos).length > 0
            }
        }));
        
        // ✅ CORREÇÃO: Atualizar contador de filtros ativos
        this.updateClearButton();
        
        if (logApply) console.log(`🔍 Filtros aplicados: ${dadosFiltrados.length}/${this.dadosOriginais.length} registros, totais atualizados`);
    }
    
    /**
     * 🎯 APLICAR FILTRO ESPECÍFICO
     */
    aplicarFiltroEspecifico(dados, tipo, valor) {
        switch (tipo) {
            case 'mesAno':
                const normalizeMes = (val) => { if (window.FolhaUtils && typeof window.FolhaUtils.normalizeMesAno === 'function') { return window.FolhaUtils.normalizeMesAno(val); } const s = String(val||'').trim(); if (/^\d{4}-\d{2}$/.test(s)) return s; const m = s.match(/^(\d{2})\/(\d{4})$/); if (m) return `${m[2]}-${m[1]}`; const m2 = s.match(/^(\d{4})[\/-](\d{2})$/); if (m2) return `${m2[1]}-${m2[2]}`; return s.toLowerCase(); };
                return dados.filter(item => normalizeMes(item.mesAno) === normalizeMes(valor));
                
            case 'tipoFolha':
                return dados.filter(item => (item.tipoPagamento || item.tipo || '').toLowerCase() === String(valor || '').toLowerCase());
                
            case 'funcionario':
                const valorLower = String(valor || '').toLowerCase();
                return dados.filter(item => {
                    const funcionario = item.funcionario;
                    if (!funcionario) return false;
                    
                    return (
                        (funcionario && funcionario.nome && funcionario.nome.toLowerCase().includes(valorLower)) ||
                        (funcionario && funcionario.cpf && funcionario.cpf.includes(valor)) ||
                        (funcionario && funcionario.cargo && funcionario.cargo.toLowerCase().includes(valorLower)) ||
                        (funcionario && funcionario.pis && funcionario.pis.includes(valor))
                    );
                });
            case 'funcionarioId':
                return dados.filter(item => (((item && item.funcionario && item.funcionario.id) || '') === String(valor || '')));
                
            default:
                return dados;
        }
    }
    
    /**
     * 📊 ATUALIZAR TABELA COM DADOS FILTRADOS
     */
    updateTableWithFilteredData() {
        const sig = window.FolhaUtils && typeof window.FolhaUtils.getDataSignature === 'function'
            ? window.FolhaUtils.getDataSignature(this.dadosFiltrados)
            : String((this.dadosFiltrados && this.dadosFiltrados.length) || 0);
        const logUpdate = window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function'
            ? window.FolhaUtils.shouldLogDataChange('folhaFiltros.updateTable', sig)
            : !!window.__folhaDebug;
        if (logUpdate) console.log(`📊 Atualizando tabela com ${this.dadosFiltrados.length} dados filtrados (folha-filtros.js)`);
        
        if (this.dadosFiltrados.length === 0) {
            // Usar lógica específica de filtros para mensagem vazia
            const tableBody = document.getElementById('folhasTableBody');
            if (tableBody) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="12" style="text-align: center; padding: 20px; color: #666;">
                            <i class="fas fa-filter" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                            ${Object.keys(this.filtrosAtivos).length > 0 
                                ? 'Nenhum registro encontrado com os filtros aplicados'
                                : 'Nenhuma folha de pagamento cadastrada'
                            }
                        </td>
                    </tr>
                `;
            }
            this.updateTotais({ bruto: 0, quinzena: 0, acrescimos: 0, descontos: 0, liquido: 0 });
            return;
        }
        
        // ✅ Integrar paginação quando disponível
        if (window.folhaPaginacao && typeof window.folhaPaginacao.aplicarFiltrosComPaginacao === 'function') {
            window.folhaPaginacao.aplicarFiltrosComPaginacao(this.dadosFiltrados);
        } else if (window.FolhaUtils && typeof window.FolhaUtils.renderizarTabelaLancamentos === 'function') {
            // ✅ VERIFICAR SE FUNÇÃO UNIFICADA ESTÁ DISPONÍVEL
            window.FolhaUtils.renderizarTabelaLancamentos(this.dadosFiltrados, {
                mensagemVazia: 'Nenhum resultado encontrado com os filtros aplicados'
            });
        } else {
            // FALLBACK: Usar renderização original se função unificada não estiver disponível
            console.warn('⚠️ FolhaUtils.renderizarTabelaLancamentos não disponível, usando renderização fallback (filtros)');
            this.updateTableWithFilteredDataFallback();
        }
        
        // ✅ Atualizar totais em tempo real de acordo com os dados filtrados
        try {
            if (window.folhaSystem && typeof window.folhaSystem.atualizarTotais === 'function') {
                window.folhaSystem.atualizarTotais(this.dadosFiltrados);
                if (logUpdate) console.log('✅ Totais atualizados com dados filtrados (updateTableWithFilteredData)');
            }
        } catch (e) {
            console.error('❌ Erro ao atualizar totais após renderização de filtros:', e);
        }
        
        if (logUpdate) console.log(`✅ Tabela renderizada: ${this.dadosFiltrados.length} registros (updateTableWithFilteredData)`);
    }
    
    /**
     * 📊 FALLBACK: Atualizar tabela com dados filtrados (compatibilidade)
     */
    updateTableWithFilteredDataFallback() {
        const tableBody = document.getElementById('folhasTableBody');
        if (!tableBody) return;
        const sig = window.FolhaUtils && typeof window.FolhaUtils.getDataSignature === 'function'
            ? window.FolhaUtils.getDataSignature(this.dadosFiltrados)
            : String((this.dadosFiltrados && this.dadosFiltrados.length) || 0);
        const logFallback = window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function'
            ? window.FolhaUtils.shouldLogDataChange('folhaFiltros.fallback', sig)
            : !!window.__folhaDebug;
        if (logFallback) console.log(`📊 Fallback de filtros: ${this.dadosFiltrados.length} dados para renderizar`);
        
        // ✅ APLICAR FILTRO DE FUNCIONÁRIOS INATIVOS E STATUS FINAL NO FALLBACK DE FILTROS
        let inativosConfirmados = 0;
        let inativosDiretos = 0;
        const dadosFiltradosAtivos = this.dadosFiltrados.filter(lancamento => {
            // NÃO filtrar por 'mes_fechado' aqui; deixar o filtro 'Tipo' controlar isso
            if (lancamento.funcionario && lancamento.funcionario.id) {
                const lista = (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) ? window.folhaSystem.funcionarios : [];
                const funcionarioAtual = lista.find(f => String(f.id) === String(lancamento.funcionario.id));
                if (funcionarioAtual && funcionarioAtual.ativo === false) {
                    inativosConfirmados += 1;
                    return false;
                }
                if (lancamento.funcionario.ativo === false) {
                    inativosDiretos += 1;
                    return false;
                }
            }
            return true;
        });
        
        if (logFallback) {
            console.log(`📊 Após filtro de inativos no fallback de filtros: ${dadosFiltradosAtivos.length}/${this.dadosFiltrados.length} dados`);
            if (inativosConfirmados > 0 || inativosDiretos > 0) {
                console.log(`🚫 Inativos filtrados no fallback: ${inativosConfirmados} confirmados, ${inativosDiretos} diretos`);
            }
        }
        
        const normStr = (s) => { try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' '); } catch { return ''; } };
        const resolveTipo = (f) => { const raw = String((f.tipoPagamento||f.tipo||'mes')).toLowerCase(); return raw.includes('quinz') ? 'quinzena' : 'mes'; };
        const keyOf = (f) => {
            const idRef = (f && f.funcionario && f.funcionario.id) ? String(f.funcionario.id) : '';
            const nmRef = (f && f.funcionario && f.funcionario.nome) ? normStr(f.funcionario.nome) : '';
            const fk = idRef || nmRef;
            const mes = String(f.mesAno || '').trim();
            const tipo = resolveTipo(f);
            return `${fk}|${mes}|${tipo}`;
        };
        const score = (x) => {
            const t = new Date(x.updatedAt || x.dataAtualizacao || x.dataCriacao || 0).getTime() || 0;
            const c = x.calculos ? 1 : 0;
            const i = x.id ? 1 : 0;
            return (t*10) + (c*2) + i;
        };
        const map = new Map();
        for (const f of dadosFiltradosAtivos) {
            const k = keyOf(f);
            if (!k.trim()) continue;
            const prev = map.get(k);
            if (!prev) { map.set(k, f); continue; }
            const keep = (score(prev) >= score(f)) ? prev : f;
            map.set(k, keep);
        }
        const deduped = Array.from(map.values());
        const dadosOrdenados = deduped.sort((a, b) => new Date(b.dataCriacao || 0) - new Date(a.dataCriacao || 0));
        
        // Renderização única padronizada para evitar sobreposição
        tableBody.innerHTML = dadosOrdenados.map(lancamento => 
            this.renderTableRow(lancamento)
        ).join('');
        try { window.dispatchEvent(new CustomEvent('tabelaFolhasRenderizada', { detail: { rowCount: dadosOrdenados.length, source: 'filtros-fallback' } })); } catch{}
        
        if (logFallback) console.log(`✅ Tabela de filtros atualizada com ${dadosOrdenados.length} linhas (fallback com filtro de inativos)`);
    }
    
    /**
     * 🎨 RENDERIZAR LINHA DA TABELA
     */
    renderTableRow(lancamento) {
        if (window.FolhaUtils && typeof window.FolhaUtils.renderizarLinhaLancamento === 'function') {
            return window.FolhaUtils.renderizarLinhaLancamento(lancamento);
        }

        const calculos = lancamento.calculos || {};
        let tipoPag = 'mes';
        // Normalizar tipoPagamento, independentemente do schema que veio do banco
        try {
            tipoPag = window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function'
                ? window.FolhaUtils.resolveTipoPagamento(lancamento)
                : (lancamento.tipoPagamento || lancamento.tipo || lancamento.tipoFolha || 'mes');
            lancamento.tipoPagamento = tipoPag;
        } catch {}
        const statusNorm = String((window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function')
            ? window.FolhaUtils.normalizarStatus(lancamento.status)
            : (lancamento.status || '')).toLowerCase().normalize('NFD').replace(/[^a-z_]/g,'');
        const tipoLabel = tipoPag === 'quinzena'
            ? (statusNorm === 'quinzena_paga' ? '1° Quinzena Paga' : (statusNorm === 'mes_fechado' ? '2° Quinzena Paga' : '1° Quinzena'))
            : (statusNorm === 'mes_fechado' ? 'Mês Fechado Pago' : 'Mês Fechado');
        // Fallback: preencher nome/cargo via listas globais se ausentes
        let nome = (lancamento && lancamento.funcionario && lancamento.funcionario.nome) || '';
        let cargo = (lancamento && lancamento.funcionario && lancamento.funcionario.cargo) || '';
        const id = (lancamento && lancamento.funcionario && lancamento.funcionario.id) || (lancamento && lancamento.funcionarioId) || '';
        const formaPagamentoBase = (lancamento && lancamento.funcionario && lancamento.funcionario.formaPagamento) || lancamento.formaPagamento || '';
        let funcionarioCadastro = null;
        if ((!nome || !cargo || !formaPagamentoBase) && id) {
            const getF = () => {
                if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) {
                    const f = window.folhaSystem.funcionarios.find(x => x && String(x.id) === String(id));
                    if (f) return f;
                }
                if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                    const f2 = window.folhaFuncionarios.funcionarios.find(x => x && String(x.id) === String(id));
                    if (f2) return f2;
                }
                return null;
            };
            const found = getF();
            if (found) {
                funcionarioCadastro = found;
                nome = nome || found.nome || '';
                cargo = cargo || found.cargo || '';
            }
        }
        
        const descontosTotalAttr = (window.FolhaUtils && typeof window.FolhaUtils.calcularDescontosDisplay === 'function')
            ? window.FolhaUtils.calcularDescontosDisplay(lancamento)
            : 0;
        const totalVales = (window.FolhaUtils && typeof window.FolhaUtils.calcularTotalVales === 'function')
            ? window.FolhaUtils.calcularTotalVales(lancamento)
            : Number(lancamento.vales || 0);
        const rowId = (lancamento.id || lancamento.key || lancamento.$key || lancamento.recordId || '');
        const funcionarioDetalhado = {
            ...(funcionarioCadastro || {}),
            ...((lancamento && lancamento.funcionario) || {})
        };
        const salarioLiquido = (window.FolhaUtils && typeof window.FolhaUtils.calcularSalarioLiquidoDisplay === 'function')
            ? window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento)
            : Number(calculos.salarioLiquido || calculos.liquido || lancamento.salarioLiquido || 0);
        const formatarMoeda = (valor) => (window.FolhaUtils && typeof window.FolhaUtils.formatarMoeda === 'function')
            ? window.FolhaUtils.formatarMoeda(valor)
            : `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`;
        const saldoLiquido = (window.FolhaUtils && typeof window.FolhaUtils.calcularSaldoLiquidoEmAberto === 'function')
            ? window.FolhaUtils.calcularSaldoLiquidoEmAberto(lancamento)
            : (statusNorm === 'mes_fechado' ? 0 : salarioLiquido);
        const valorPago = (window.FolhaUtils && typeof window.FolhaUtils.calcularValorPagoLancamento === 'function')
            ? window.FolhaUtils.calcularValorPagoLancamento(lancamento)
            : (statusNorm === 'mes_fechado' ? salarioLiquido : 0);
        const valorPix = (window.FolhaUtils && typeof window.FolhaUtils.calcularValorPixLancamento === 'function')
            ? window.FolhaUtils.calcularValorPixLancamento(lancamento)
            : saldoLiquido;
        const pixQuitado = (window.FolhaUtils && typeof window.FolhaUtils.isPixLancamentoQuitado === 'function')
            ? window.FolhaUtils.isPixLancamentoQuitado(lancamento)
            : (valorPago > 0 && Math.abs(saldoLiquido) < 0.005);
        const formaPagamentoHtml = (window.FolhaUtils && typeof window.FolhaUtils.formatarFormaPagamentoLancamento === 'function')
            ? window.FolhaUtils.formatarFormaPagamentoLancamento({
                id,
                nome,
                formaPagamento: funcionarioDetalhado.formaPagamento || lancamento.formaPagamento || '',
                pix: funcionarioDetalhado.pix || funcionarioDetalhado.chavePix || lancamento.pix || lancamento.chavePix || '',
                pixTipo: funcionarioDetalhado.pixTipo || funcionarioDetalhado.tipoPix || lancamento.pixTipo || '',
                favorecidoPix: funcionarioDetalhado.favorecidoPix || funcionarioDetalhado.pixNome || lancamento.favorecidoPix || '',
                beneficiario: funcionarioDetalhado.beneficiario || lancamento.beneficiario || '',
                banco: funcionarioDetalhado.banco || lancamento.banco || '',
                agencia: funcionarioDetalhado.agencia || lancamento.agencia || '',
                conta: funcionarioDetalhado.conta || lancamento.conta || ''
            }, {
                id: rowId,
                nomeFuncionario: nome,
                liquido: valorPix,
                liquidoFormatado: formatarMoeda(valorPix),
                valorPago,
                valorPagoFormatado: formatarMoeda(valorPago),
                pagamentoQuitado: pixQuitado
            })
            : (funcionarioDetalhado.formaPagamento || lancamento.formaPagamento || '-');
        const isMesFechadoPago = (window.FolhaUtils && typeof window.FolhaUtils.isLancamentoMesFechadoPago === 'function')
            ? window.FolhaUtils.isLancamentoMesFechadoPago(lancamento, tipoPag, statusNorm)
            : (tipoPag === 'mes' && statusNorm === 'mes_fechado');
        const liquidoTabelaHtml = (window.FolhaUtils && typeof window.FolhaUtils.formatarLiquidoLancamentoTabela === 'function')
            ? window.FolhaUtils.formatarLiquidoLancamentoTabela(lancamento, {
                valorHistorico: salarioLiquido,
                saldoAberto: saldoLiquido,
                valorPago
            })
            : formatarMoeda(saldoLiquido);
        const botoesAcaoFallback = `
                    <button class="action-button edit-button btn-editar" title="Editar" data-folha-id="${rowId}" onclick="__onEditFolhaButtonClick('${rowId}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-button print-button" title="Imprimir" data-folha-id="${rowId}" onclick="printFolha('${rowId}')">
                        <i class="fas fa-print"></i>
                    </button>
                    ${this.renderizarBotoesAcaoFallback(lancamento)}
                    <button class="action-button delete-button btn-excluir" title="Excluir" data-folha-id="${rowId}" onclick="deleteFolha('${rowId}')">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
        const acoesLancamentoHtml = (window.FolhaUtils && typeof window.FolhaUtils.renderizarAcoesLancamento === 'function')
            ? window.FolhaUtils.renderizarAcoesLancamento(lancamento, botoesAcaoFallback, {
                tipoPagamento: tipoPag,
                statusNorm
            })
            : botoesAcaoFallback;
        return `
            <tr class="folha-row ${statusNorm === 'mes_fechado' ? 'folha-fechada' : ''}" data-id="${rowId}" data-descontos-total="${descontosTotalAttr}">
                <td>
                    <strong>${(nome || 'N/A')}</strong>
                    <div style="font-size: 11px; color: #666;">
                        ${(cargo || '')}
                    </div>
                </td>
                <td style="font-size: 12px;">${formaPagamentoHtml}</td>
                <td>${this.formatMesAno(lancamento.mesAno)}</td>
                <td>
                    <span class="badge-status" style="background-color: ${this.getTipoColor(tipoPag)}">
                        ${tipoLabel}
                    </span>
                </td>
                <td>${this.getPercentualDisplay(lancamento)}</td>
                <td>${formatarMoeda(window.FolhaUtils && window.FolhaUtils.getSalarioBaseDisplay ? window.FolhaUtils.getSalarioBaseDisplay(lancamento) : Number(calculos.salarioBase || 0))}</td>
                <td>${formatarMoeda(window.FolhaUtils && window.FolhaUtils.calcularValorQuinzena ? window.FolhaUtils.calcularValorQuinzena(lancamento) : 0)}</td>
                <td>${formatarMoeda(window.FolhaUtils && window.FolhaUtils.calcularAcrescimosDisplay ? window.FolhaUtils.calcularAcrescimosDisplay(lancamento) : 0)}</td>
                <td>${formatarMoeda(window.FolhaUtils && window.FolhaUtils.calcularDescontosDisplay ? window.FolhaUtils.calcularDescontosDisplay(lancamento) : descontosTotalAttr)}</td>
                <td>${formatarMoeda(totalVales)}</td>
                <td class="valor-destaque liquido-cell">${liquidoTabelaHtml}</td>
                <td class="actions-cell${isMesFechadoPago ? ' paid-actions-cell' : ''}">
                    ${acoesLancamentoHtml}
                </td>
            </tr>
        `;
    }
    
    /**
     * 🧮 CALCULAR TOTAIS FILTRADOS
     */
        calcularTotaisFiltrados() {
        const sig = window.FolhaUtils && typeof window.FolhaUtils.getDataSignature === 'function'
            ? window.FolhaUtils.getDataSignature(this.dadosFiltrados)
            : String((this.dadosFiltrados && this.dadosFiltrados.length) || 0);
        const logTotais = window.FolhaUtils && typeof window.FolhaUtils.shouldLogDataChange === 'function'
            ? window.FolhaUtils.shouldLogDataChange('folhaFiltros.totais', sig)
            : !!window.__folhaDebug;
        if (logTotais) console.log('🧮 INICIANDO cálculo de totais filtrados...', this.dadosFiltrados.length, 'registros');
        
        const dadosParaResumo = (this.dadosFiltrados || []).filter((lancamento) => {
            if (window.FolhaUtils && typeof window.FolhaUtils.lancamentoContaNoResumo === 'function') {
                return window.FolhaUtils.lancamentoContaNoResumo(lancamento);
            }
            return true;
        });
        const totais = dadosParaResumo.reduce((acc, lancamento) => {
            // ✅ CORREÇÃO CRÍTICA: Usar as mesmas funções do folha-main.js para consistência
            const salarioBase = window.FolhaUtils.getSalarioBaseDisplay ?
                window.FolhaUtils.getSalarioBaseDisplay(lancamento) :
                (((lancamento && lancamento.calculos && lancamento.calculos.salarioBase) || lancamento.salarioBase || 0));

            const valorQuinzena = window.FolhaUtils.calcularValorQuinzena(lancamento);
            const acrescimos = window.FolhaUtils.calcularAcrescimosDisplay(lancamento);
            const descontos = window.FolhaUtils.calcularDescontosDisplay(lancamento);
            const liquido = window.FolhaUtils.calcularSaldoLiquidoEmAberto
                ? window.FolhaUtils.calcularSaldoLiquidoEmAberto(lancamento)
                : window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento);

            return {
                bruto: acc.bruto + Number(salarioBase || 0),
                quinzena: acc.quinzena + Number(valorQuinzena || 0),
                acrescimos: acc.acrescimos + Number(acrescimos || 0),
                descontos: acc.descontos + Number(descontos || 0),
                liquido: acc.liquido + Number(liquido || 0)
            };
        }, { bruto: 0, quinzena: 0, acrescimos: 0, descontos: 0, liquido: 0 });
        totais.pagos = (this.dadosFiltrados || []).reduce((acc, lancamento) => {
            const liquido = window.FolhaUtils.calcularValorPagoLancamento
                ? window.FolhaUtils.calcularValorPagoLancamento(lancamento)
                : window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento);
            return acc + Number(liquido || 0);
        }, 0);
        totais.restantes = totais.liquido;

        if (logTotais) {
            console.log('🧮 TOTAIS FILTRADOS CALCULADOS:', {
                'Registros no resumo': dadosParaResumo.length,
                'Total Bruto': totais.bruto.toFixed(2),
                'Total Quinzena': totais.quinzena.toFixed(2), 
                'Total Acréscimos': totais.acrescimos.toFixed(2),
                'Total Descontos': totais.descontos.toFixed(2),
                'Total Líquido': totais.liquido.toFixed(2),
                'Total Pagos': totais.pagos.toFixed(2),
                'Total Restantes': totais.restantes.toFixed(2)
            });
        }

        this.updateTotais(totais);
    }
    
    /**
     * 📊 ATUALIZAR TOTAIS NA INTERFACE
     */
    updateTotais(totais) {
        const totalBruto = document.getElementById('totalBruto');
        const totalQuinzena = document.getElementById('totalQuinzena');
        const totalAcrescimos = document.getElementById('totalAcrescimos');
        const totalDescontos = document.getElementById('totalDescontos');
        const totalLiquido = document.getElementById('totalLiquido');
        const totalPagos = document.getElementById('totalPagos');
        const totalRestantes = document.getElementById('totalRestantes');
        
        if (totalBruto) {
            totalBruto.textContent = window.FolhaUtils.formatarMoeda(totais.bruto);
        }
        
        if (totalQuinzena) {
            totalQuinzena.textContent = window.FolhaUtils.formatarMoeda(totais.quinzena || 0);
        }
        
        if (totalAcrescimos) {
            totalAcrescimos.textContent = window.FolhaUtils.formatarMoeda(totais.acrescimos || 0);
        }
        
        if (totalDescontos) {
            totalDescontos.textContent = window.FolhaUtils.formatarMoeda(totais.descontos);
        }
        
        if (totalLiquido) {
            totalLiquido.textContent = window.FolhaUtils.formatarMoeda(totais.liquido);
        }
        
        if (totalPagos) {
            totalPagos.textContent = window.FolhaUtils.formatarMoeda(totais.pagos || 0);
        }
        
        if (totalRestantes) {
            totalRestantes.textContent = window.FolhaUtils.formatarMoeda(totais.restantes ?? totais.liquido ?? 0);
        }
    }
    
    /**
     * 📈 ATUALIZAR ESTATÍSTICAS DOS FILTROS
     */
    updateFilterStats() {
        // Criar ou atualizar indicador de filtros ativos
        let filterIndicator = document.getElementById('filterIndicator');
        
        if (!filterIndicator) {
            filterIndicator = document.createElement('div');
            filterIndicator.id = 'filterIndicator';
            filterIndicator.style.cssText = `
                background-color: #e3f2fd;
                border-left: 4px solid #2196f3;
                padding: 10px;
                margin: 10px 0;
                border-radius: 4px;
                font-size: 14px;
            `;
            
            const filtrosSection = document.getElementById('filtros-section');
            if (filtrosSection) {
                filtrosSection.appendChild(filterIndicator);
            }
        }
        
        const totalFiltrados = this.dadosFiltrados.length;
        const totalOriginal = this.dadosOriginais.length;
        const filtrosAtivosCount = Object.keys(this.filtrosAtivos).length;
        
        if (filtrosAtivosCount > 0) {
            filterIndicator.innerHTML = `
                <i class="fas fa-filter"></i> 
                <strong>${filtrosAtivosCount} filtro(s) ativo(s):</strong> 
                Mostrando ${totalFiltrados} de ${totalOriginal} registros
                ${this.getFiltrosAtivosText()}
            `;
            filterIndicator.style.display = 'block';
        } else {
            filterIndicator.style.display = 'none';
        }
    }
    
    /**
     * 📝 OBTER TEXTO DOS FILTROS ATIVOS
     */
    getFiltrosAtivosText() {
        const filtrosTexto = Object.entries(this.filtrosAtivos).map(([tipo, valor]) => {
            switch (tipo) {
                case 'mesAno':
                    return `Período: ${this.formatMesAno(valor)}`;
                case 'tipoFolha':
                    return `Tipo: ${valor === 'quinzena' ? 'Quinzena' : 'Mês Fechado'}`;
                case 'funcionario':
                    return `Funcionário: "${valor}"`;
                default:
                    return `${tipo}: ${valor}`;
            }
        });
        
        return filtrosTexto.length > 0 ? `<br><small>${filtrosTexto.join(' • ')}</small>` : '';
    }
    
    /**
     * 🧹 CRIAR BOTÃO LIMPAR FILTROS
     */
    createClearFiltersButton() {
        const filtrosSection = document.getElementById('filtros-section');
        if (!filtrosSection) return;
        
        const clearButton = document.createElement('button');
        clearButton.id = 'clearFiltersBtn';
        clearButton.type = 'button';
        clearButton.className = 'btn-cancelar';
        clearButton.innerHTML = '<i class="fas fa-times"></i> Limpar Filtros';
        clearButton.style.cssText = `
            margin-top: 10px;
            display: none;
        `;
        
        clearButton.addEventListener('click', () => {
            this.limparFiltros();
        });
        
        filtrosSection.appendChild(clearButton);
    }
    
    /**
     * 🔄 ATUALIZAR BOTÃO LIMPAR
     */
    updateClearButton() {
        const clearButton = document.getElementById('clearFiltersBtn');
        if (clearButton) {
            const hasActiveFilters = Object.keys(this.filtrosAtivos).length > 0;
            clearButton.style.display = hasActiveFilters ? 'inline-flex' : 'none';
        }
    }
    
    /**
     * 🧹 LIMPAR FILTROS DE FUNCIONÁRIO
     */
    limparFiltrosFuncionario() {
        if (window.__folhaDebug) console.log('🧹 Limpando filtros de funcionário...');
        
        // Limpar campo de input
        const funcionarioFilter = document.getElementById('funcionarioFiltro');
        if (funcionarioFilter) {
            funcionarioFilter.value = '';
            delete funcionarioFilter.dataset.funcionarioId;
            delete funcionarioFilter.dataset.funcionarioData;
        }
        
        // Remover filtros ativos
        delete this.filtrosAtivos.funcionario;
        delete this.filtrosAtivos.funcionarioId;
        
        // Aplicar filtros limpos (voltar para primeira página)
        try { if (window.folhaPaginacao) window.folhaPaginacao.paginaAtual = 1; } catch(e) {}
        this.aplicarFiltros();
        
        if (window.__folhaDebug) console.log('✅ Filtros de funcionário limpos');
    }
    
    /**
     * 🧹 LIMPAR TODOS OS FILTROS
     */
    limparFiltros() {
        // Limpar objeto de filtros ativos
        this.filtrosAtivos = {};
        
        // 1. Resetar Mês/Ano para o mês atual (padrão) se houver dados
        const mesAno = document.getElementById('mesAno');
        if (mesAno) {
            const now = new Date();
            const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // Verificar se existe dados para o mês atual
            const normalizeMes = (val) => { 
                if (window.FolhaUtils && typeof window.FolhaUtils.normalizeMesAno === 'function') { 
                    return window.FolhaUtils.normalizeMesAno(val); 
                } 
                return String(val||'').trim(); 
            };
            
            const existeMes = Array.isArray(this.dadosOriginais) && this.dadosOriginais.some(f => normalizeMes(f.mesAno) === mesAtual);
            
            if (existeMes) {
                // Se existe mês atual, definir como padrão
                mesAno.value = mesAtual;
                this.filtrosAtivos.mesAno = mesAtual;
                if (window.__folhaDebug) console.log('🧹 Limpar Filtros: Resetando para Mês Atual:', mesAtual);
            } else {
                // Se não, limpar
                mesAno.value = '';
            }
        }
        
        // 2. Resetar Tipo para 'Todos'
        const tipoFolha = document.getElementById('tipoFolha');
        if (tipoFolha) tipoFolha.value = '';
        
        // 3. Resetar Funcionário
        const funcionarioFiltro = document.getElementById('funcionarioFiltro');
        if (funcionarioFiltro) {
            funcionarioFiltro.value = '';
            delete funcionarioFiltro.dataset.funcionarioId;
            delete funcionarioFiltro.dataset.funcionarioData;
        }
        
        // 4. Reaplicar filtros
        // Isso vai chamar aplicarFiltros() que já faz a sanitização correta
        try { if (window.folhaPaginacao) window.folhaPaginacao.paginaAtual = 1; } catch(e) {}
        
        console.log('🧹 Reaplicando filtros após limpeza...');
        if (mesAno && (!this.filtrosAtivos.mesAno || String(this.filtrosAtivos.mesAno).trim() === '')) {
            const meses = Array.from(new Set(
                (Array.isArray(this.dadosOriginais) ? this.dadosOriginais : [])
                    .map(f => normalizeMes(f.mesAno))
                    .filter(v => v && /^\d{4}-\d{2}$/.test(v))
            ));
            if (meses.length > 0) {
                meses.sort();
                const ultimo = meses[meses.length - 1] || '';
                if (ultimo) {
                    mesAno.value = ultimo;
                    this.filtrosAtivos.mesAno = ultimo;
                }
            }
        }
        this.aplicarFiltros();
        this.updateClearButton();
        
        // ✅ REMOVIDO: Bloco setTimeout que sobrescrevia dadosFiltrados com dadosOriginais brutos (sem sanitização)
        // A função aplicarFiltros já garante a sanitização e cálculo correto dos totais
        
        this.showNotification('Filtros resetados para o padrão!', 'info');
    }
    
    /**
     * 📅 CONFIGURAR MÊS ATUAL
     */
    setCurrentMonth() {
        const hoje = new Date();
        const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
        const normalizeMes = (val) => { if (window.FolhaUtils && typeof window.FolhaUtils.normalizeMesAno === 'function') { return window.FolhaUtils.normalizeMesAno(val); } const s = String(val||'').trim(); if (/^\d{4}-\d{2}$/.test(s)) return s; const m = s.match(/^(\d{2})\/(\d{4})$/); if (m) return `${m[2]}-${m[1]}`; const m2 = s.match(/^(\d{4})[\/-](\d{2})$/); if (m2) return `${m2[1]}-${m2[2]}`; return s; };
        const mesAnoFilter = document.getElementById('mesAno');
        if (mesAnoFilter) {
            // Aplicar mês padrão APENAS uma vez e somente se houver dados
            if (!this._defaultMonthSet) {
                const existeMes = Array.isArray(this.dadosOriginais) && this.dadosOriginais.some(f => normalizeMes(f.mesAno) === mesAtual);
                if (existeMes && (!mesAnoFilter.value || String(mesAnoFilter.value).trim() === '')) {
                    mesAnoFilter.value = mesAtual;
                    this._defaultMonthSet = true;
                    if (window.__folhaDebug) console.log('📅 Mês atual definido no filtro (uma vez):', mesAtual);
                    // Aplicar sem fallback agressivo
                    this.updateFiltro('mesAno', mesAtual);
                } else {
                    if (window.__folhaDebug) console.log('ℹ️ Mês padrão não aplicado (dados ausentes ou usuário já definiu)');
                }
            }
        }
    }
    
    /**
     * 🔍 CONFIGURAR AUTOCOMPLETE NOS FILTROS
     */
    setupAutocompleteFilters() {
        const funcionarioFilter = document.getElementById('funcionarioFiltro');
        if (funcionarioFilter && window.folhaFuncionarios) {
            // Se existir um setup específico no futuro, usar. Caso não, adicionar comportamento padrão simples.
            if (typeof window.folhaFuncionarios.setupFuncionarioAutocomplete === 'function') {
                window.folhaFuncionarios.setupFuncionarioAutocomplete(funcionarioFilter);
            } else {
                // Fallback: quando abrir a lista e escolher um funcionário, aplicar ao input
                // A seleção é efetuada em folha-funcionarios; aqui garantimos limpeza no blur se necessário
                funcionarioFilter.addEventListener('blur', () => {
                    if (!funcionarioFilter.value) {
                        delete funcionarioFilter.dataset.funcionarioId;
                    }
                });
            }
        }
    }
    
    /**
     * 🎨 OBTER COR DO TIPO
     */
    getTipoColor(tipo) {
        return tipo === 'quinzena' ? '#17a2b8' : '#28a745';
    }
    
    /**
     * 📅 FORMATAR MÊS/ANO
     */
    formatMesAno(mesAno) {
        if (!mesAno) return 'N/A';
        const [ano, mes] = mesAno.split('-');
        const meses = [
            'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
            'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
        ];
        return `${meses[parseInt(mes) - 1]}/${ano}`;
    }
    
    /**
     * 📊 OBTER DISPLAY DO PERCENTUAL
     */
    getPercentualDisplay(lancamento) {
        if (lancamento.tipoPagamento === 'quinzena') {
            if (lancamento.quinzenaValorManual) {
                return 'Manual';
            }
            const p = lancamento.percentualQuinzena ?? lancamento.quinzenaPercentual ?? 50;
            return `${p}%`;
        }
        return '100%';
    }
    
    /**
     * 🔍 BUSCAR POR TEXTO LIVRE
     */
    buscarTextoLivre(texto) {
        if (!texto || texto.trim() === '') {
            this.dadosFiltrados = [...this.dadosOriginais];
        } else {
            const textoLower = texto.toLowerCase().trim();
            this.dadosFiltrados = this.dadosOriginais.filter(item => {
                const funcionario = item.funcionario || {};
                const calculos = item.calculos || {};
                
                return (
                    (funcionario && funcionario.nome && funcionario.nome.toLowerCase().includes(textoLower)) ||
                    (funcionario && funcionario.cpf && funcionario.cpf.includes(texto)) ||
                    (funcionario && funcionario.cargo && funcionario.cargo.toLowerCase().includes(textoLower)) ||
                    (funcionario && funcionario.pis && funcionario.pis.includes(texto)) ||
                    (item && item.mesAno && item.mesAno.includes(texto)) ||
                    (item && item.tipoPagamento && item.tipoPagamento.toLowerCase().includes(textoLower)) ||
                    (calculos && calculos.salarioLiquido != null && calculos.salarioLiquido.toString().includes(texto))
                );
            });
        }
        
        this.updateTableWithFilteredData();
        this.updateFilterStats();
    }
    
    /**
     * 📊 OBTER DADOS FILTRADOS
     */
    getDadosFiltrados() {
        return this.dadosFiltrados;
    }
    
    /**
     * 📊 OBTER DADOS ORIGINAIS
     */
    getDadosOriginais() {
        return this.dadosOriginais;
    }
    
    /**
     * 🔄 RECARREGAR DADOS
     */
    reloadData() {
        // ✅ Preferir dados normalizados do sistema; mas quando solicitado, recarregar do banco
        const systemFolhas = (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) ? window.folhaSystem.folhas : [];
        const mustReloadFromDb = !!this._forceDbReload || (!systemFolhas || systemFolhas.length === 0);
        if (mustReloadFromDb && window.folhaLancamentos && typeof window.folhaLancamentos.buscarTodasFolhas === 'function') {
            console.log('🔥 Reload forçado: buscando dados diretamente do banco...');
            window.folhaLancamentos.buscarTodasFolhas().then(arr => {
                if (Array.isArray(arr)) {
                    this.dadosOriginais = arr;
                    this.dadosFiltrados = [...arr];
                    console.log(`✅ Reload do banco concluído: ${arr.length} registros`);
                    // Limpar flag
                    this._forceDbReload = false;
                    // Aplicar filtros após obter dados frescos
                    this.scheduleApply(100);
                } else {
                    console.warn('⚠️ Buscar do banco retornou dados inválidos; mantendo conjunto atual');
                    this.scheduleApply(180);
                }
            }).catch(e => {
                console.error('❌ Erro ao buscar dados do banco na reloadData:', e);
                this.scheduleApply(180);
            });
            return;
        }
        if (systemFolhas.length > 0) {
            console.log(`🔄 Reload usando dados normalizados do sistema (${systemFolhas.length})`);
            this.dadosOriginais = systemFolhas;
            this.dadosFiltrados = [...systemFolhas];
        } else {
            console.log('ℹ️ Reload sem dados normalizados; mantendo conjunto atual');
        }
        // Aplicar com debounce para evitar múltiplas renderizações pós-reconexão
        this.scheduleApply(120);
    }
    
    /**
     * 📢 MOSTRAR NOTIFICAÇÃO
     */
    showNotification(message, type = 'info') {
        // Usar sistema de notificações do romaneiopct se disponível
        if (window.FolhaUtils && window.FolhaUtils.showToast) {
            window.FolhaUtils.showToast(message, type);
        } else {
            // Fallback simples
            console.log(`${type.toUpperCase()}: ${message}`);
        }
    }

    /**
     * 🎨 RENDERIZAR BOTÕES DE AÇÃO PARA FALLBACK
     * Função para renderizar botões condicionais baseados no status e tipo da folha
     */
    renderizarBotoesAcaoFallback(lancamento) {
        const botoes = [];
        // ✅ Normalizar tipo/status para decisões robustas
        const tipoRaw = String(lancamento.tipoPagamento || lancamento.tipo || '').toLowerCase().normalize('NFD').replace(/[^a-z_]/g,'');
        const tipoNorm = tipoRaw.includes('quinz') ? 'quinzena' : 'mes';
        const statusRaw = (typeof lancamento.status === 'object') ? (lancamento.status.value || lancamento.status.status || lancamento.status.nome || '') : (lancamento.status || '');
        const statusNorm = String(statusRaw).toLowerCase().normalize('NFD').replace(/[^a-z_]/g,'');
        
        // ✅ Botão Dar Baixa na Quinzena (para quinzenas ATIVAS - rascunho, calculada, aprovada)
        if (tipoNorm === 'quinzena' && ['rascunho', 'calculada', 'aprovada'].includes(statusNorm)) {
            botoes.push(`
                <button class="action-button dar-baixa-button" title="Dar Baixa na Quinzena" 
                        onclick="darBaixaQuinzena('${lancamento.id}')">
                    <i class="fas fa-money-bill"></i>
                </button>
            `);
        }
        
        // ✅ Botão Fechar Mês (para quinzenas PAGAS que podem fechar o mês)
        if (tipoNorm === 'quinzena' && statusNorm === 'quinzena_paga') {
            botoes.push(`
                <button class="action-button fechar-mes-button" title="Fechar Mês (Quinzena Paga)" 
                        onclick="fecharMes('${lancamento.id}')">
                    <i class="fas fa-calendar-check"></i>
                </button>
            `);
        }
        
        // ✅ Botão Fechar Mês (para meses não fechados - rascunho, calculada, aprovada)
        if (tipoNorm === 'mes' && ['rascunho', 'calculada', 'aprovada'].includes(statusNorm)) {
            botoes.push(`
                <button class="action-button fechar-mes-button" title="Fechar Mês" 
                        onclick="fecharMes('${lancamento.id}')">
                    <i class="fas fa-calendar-check"></i>
                </button>
            `);
        }
        
        // ✅ Botão Clonar Folha (para qualquer folha válida)
        if (lancamento.status !== 'cancelada') {
            botoes.push(`
                <button class="action-button clonar-folha-button" title="Clonar para Próximo Mês" 
                        onclick="clonarFolha('${lancamento.id}')">
                    <i class="fas fa-copy"></i>
                </button>
            `);
        }
        
        return botoes.join('');
    }
}

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.limparFiltros = function() {
    if (window.folhaFiltros) {
        window.folhaFiltros.limparFiltros();
    }
};

window.limparFiltroFuncionario = function() {
    if (window.folhaFiltros) {
        window.folhaFiltros.limparFiltrosFuncionario();
    }
};

window.aplicarFiltros = function() {
    if (window.folhaFiltros) {
        window.folhaFiltros.aplicarFiltros();
    }
};

window.buscarTextoLivre = function(texto) {
    if (window.folhaFiltros) {
        window.folhaFiltros.buscarTextoLivre(texto);
    }
};

// ✅ INICIALIZAÇÃO AUTOMÁTICA - PRIORIDADE ALTA
document.addEventListener('DOMContentLoaded', () => {
    // ✅ Inicializar filtros somente quando dependências-chave estiverem prontas
    const maxAttempts = 50;
    let attempts = 0;
    const initFiltros = () => {
        const dbOk = !!window.database;
        const utilsOk = !!(window.FolhaUtils && typeof window.FolhaUtils.renderizarTabelaLancamentos === 'function');
        if (dbOk && utilsOk) {
            window.folhaFiltros = new FolhaFiltros();
            console.log('✅ Sistema de filtros inicializado com prioridade (db+utils prontos)');
            return;
        }
        if (attempts < maxAttempts) {
            attempts++;
            setTimeout(initFiltros, 200);
        } else {
            // Última tentativa mesmo sem utils, com fallback interno
            window.folhaFiltros = new FolhaFiltros();
            console.warn('⚠️ Inicializando filtros sem FolhaUtils pronto (usando fallbacks)');
        }
    };
    initFiltros();
});

// ✅ EXPORTAR PARA MÓDULOS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FolhaFiltros, FILTROS_CONFIG };
}
