class FolhaLancamentos {
    constructor() {
        this.lancamentos = [];
        this.isEditMode = false;
        this.lancamentoAtual = {};
        this._isHydratingForm = false;
        this._fechadasCache = { items: [], lastUpdated: 0 };
        this._folhasFechadasFiltrosAtivos = { mesAno: '', funcionario: '' };
        this.setupDataListeners(); // Configurar listener para atualizações de dados
        // Adiar primeira carga até que o database esteja pronto ou dados do sistema estejam prontos
        this._initialLoadDone = false;
        if (window.database) {
            this._initialLoadDone = true;
            this.loadLancamentos();
        } else {
            // Usar evento de dados prontos como fallback
            window.addEventListener('folhaDataReady', () => {
                if (!this._initialLoadDone) {
                    this._initialLoadDone = true;
                    this.loadLancamentos();
                }
            }, { once: true });
        }
    }

    _resolvePath(path) {
        try {
            if (window.FolhaUtils && typeof window.FolhaUtils.resolveFirebasePath === 'function') {
                return window.FolhaUtils.resolveFirebasePath(path);
            }
            const base = String(path || '');
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
        return path;
    }

    _findLancamentoByAnyId(id) {
        const alvo = String(id || '').trim();
        if (!alvo) return null;
        const sources = [
            this.lancamentos,
            window.folhaSystem && window.folhaSystem.folhas
        ];
        for (const source of sources) {
            if (!Array.isArray(source)) continue;
            const found = source.find((item) => {
                const itemId = item && (item.id || item.key || item.$key || item.recordId);
                return String(itemId || '').trim() === alvo;
            });
            if (found) return found;
        }
        return null;
    }

    _resolveEditLancamentoId(data = {}) {
        const current = this.lancamentoAtual || {};
        const funcionarioId = String(
            (data && data.funcionario && data.funcionario.id) ||
            (current && current.funcionario && current.funcionario.id) ||
            ''
        ).trim();
        const domId = (() => {
            try {
                const idEl = document.getElementById('folhaId');
                return idEl ? String(idEl.value || '').trim() : '';
            } catch { return ''; }
        })();
        const candidates = [
            this._editLancamentoId,
            current.id,
            current.key,
            current.$key,
            current.recordId,
            domId,
            data.id,
            data.key,
            data.$key,
            data.recordId
        ].map((id) => String(id || '').trim()).filter(Boolean);

        for (const id of candidates) {
            if (this._findLancamentoByAnyId(id)) return id;
        }

        const stable = candidates.find((id) => !funcionarioId || id !== funcionarioId);
        return stable || candidates[0] || '';
    }

    _ensureEditLancamentoIdentity(data = {}) {
        if (!this.isEditMode) return data;
        const originalId = this._resolveEditLancamentoId(data);
        if (!originalId) return data;

        const previousId = String(data.id || '').trim();
        data.id = originalId;

        try {
            const idEl = document.getElementById('folhaId');
            if (idEl && String(idEl.value || '').trim() !== originalId) {
                idEl.value = originalId;
            }
        } catch {}

        if (previousId && previousId !== originalId) {
            console.warn('🛡️ ID do lançamento preservado durante edição:', {
                recebido: previousId,
                preservado: originalId
            });
        }
        return data;
    }

    _findFuncionarioCadastro(id, nome) {
        const alvoId = String(id || '').trim();
        const norm = (value) => {
            try {
                return String(value || '').toLowerCase().trim()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
            } catch { return ''; }
        };
        const alvoNome = norm(nome);
        const sources = [
            window.folhaFuncionarios && window.folhaFuncionarios.funcionarios,
            window.folhaSystem && window.folhaSystem.funcionarios
        ];
        for (const source of sources) {
            if (!Array.isArray(source)) continue;
            let found = null;
            if (alvoId) found = source.find((func) => String((func && func.id) || '').trim() === alvoId);
            if (!found && alvoNome) found = source.find((func) => norm(func && func.nome) === alvoNome);
            if (found) return found;
        }
        return null;
    }

    _syncFuncionarioAtivoFlag(data = {}) {
        if (!data || !data.funcionario || typeof data.funcionario !== 'object') return data;
        const cadastro = this._findFuncionarioCadastro(data.funcionario.id, data.funcionario.nome);
        if (!cadastro) return data;
        if (cadastro.ativo === false) {
            data.funcionario.ativo = false;
        } else if (data.funcionario.ativo === false) {
            delete data.funcionario.ativo;
        }
        return data;
    }

    setupDataListeners() {
        // Evitar loop: ignorar eventos originados deste próprio módulo
        this._lastReloadAt = 0;
        window.addEventListener('folhas:updated', (e) => {
            const src = e && e.detail && e.detail.source;
            if (src === 'folha-lancamentos') {
                // Ignorar evento disparado por loadLancamentos deste módulo
                return;
            }
            const now = Date.now();
            if (now - this._lastReloadAt < 1000) {
                // Debounce rápido para evitar múltiplos reloads em cascata
                return;
            }
            console.log('📡 Evento folhas:updated recebido - recarregando lançamentos');
            this._lastReloadAt = now;
            this.loadLancamentos(); // Método para recarregar dados do Firebase
        });
    }

    async loadLancamentos() {
        try {
            if (!window.database) {
                console.warn('⚠️ Firebase database não disponível. Aguardando folhaDataReady para carregar lançamentos...');
                if (!this._waitingForDb) {
                    this._waitingForDb = true;
                    window.addEventListener('folhaDataReady', () => {
                        this._waitingForDb = false;
                        this.loadLancamentos();
                    }, { once: true });
                }
                return;
            }
            const { ref, get } = await import('../firebase/sdk/firebase-database.js');
            const primaryRef = ref(window.database, this._resolvePath('folhas'));
            const primarySnap = await get(primaryRef);
            const primaryArr = primarySnap.val() ? Object.entries(primarySnap.val()).map(([key, val]) => ({ ...(val || {}), id: key })) : [];
            this.lancamentos = (window.FolhaUtils && typeof window.FolhaUtils.normalizarLancamentos === 'function')
                ? window.FolhaUtils.normalizarLancamentos(primaryArr)
                : primaryArr;
            console.log('✅ Lançamentos recarregados:', this.lancamentos.length);
            // 🔗 Manter folhaSystem.folhas sincronizado com os lançamentos (evita divergência entre módulos)
            try {
                if (window.folhaSystem) {
                    window.folhaSystem.folhas = [...this.lancamentos];
                    // Normalizar mesAno através do reconciliador do sistema, se disponível
                    if (typeof window.folhaSystem.reconcileFolhasWithFuncionarios === 'function') {
                        window.folhaSystem.reconcileFolhasWithFuncionarios();
                    }
                    // Notificar que os dados estão prontos para filtros e renderizações dependentes
                    try {
                        window.dispatchEvent(new CustomEvent('folhaDataReady', {
                            detail: { folhas: (window.folhaSystem.folhas || []), funcionarios: (window.folhaSystem.funcionarios || []) }
                        }));
                    } catch (e) { console.warn('⚠️ Falha ao emitir folhaDataReady pós-reload:', e); }
                    // Reaplicar filtros para refletir imediatamente na UI
                    try { window.folhaFiltros && window.folhaFiltros.aplicarFiltros && window.folhaFiltros.aplicarFiltros(); } catch (e) { console.warn('⚠️ Falha ao reaplicar filtros pós-reload:', e); }
                }
            } catch (e) { console.warn('⚠️ Falha ao sincronizar folhaSystem.folhas com lançamentos:', e); }
            // Atualizar cache de fechadas com base nos lançamentos mais recentes
            this._fechadasCache.items = this._filtrarFechadas(this.lancamentos);
            this._fechadasCache.lastUpdated = Date.now();
            this._refreshFolhasFechadasModalSeAberto();
            // 🔔 Notificar outros módulos para aplicarem filtros/render
            try {
                window.dispatchEvent(new CustomEvent('folhas:updated', { detail: { total: this.lancamentos.length, source: 'folha-lancamentos' } }));
            } catch (e) {
                console.warn('⚠️ Falha ao disparar evento folhas:updated:', e);
            }
        } catch (error) {
            console.error('❌ Erro ao recarregar lançamentos:', error);
        }
    }

    // 🔍 Buscar todas as folhas diretamente do Firebase (para filtros e relatórios)
    async buscarTodasFolhas() {
        try {
            if (!window.database) {
                console.warn('⚠️ Firebase database não disponível em buscarTodasFolhas. Retornando cache atual.');
                return Array.isArray(this.lancamentos) ? this.lancamentos : [];
            }
            const { ref, get } = await import('../firebase/sdk/firebase-database.js');
            const primaryRef = ref(window.database, this._resolvePath('folhas'));
            const primarySnap = await get(primaryRef);
            const primaryArr = primarySnap.val() ? Object.entries(primarySnap.val()).map(([key, val]) => ({ id: key, ...(val || {}) })) : [];
            let arr = (window.FolhaUtils && typeof window.FolhaUtils.normalizarLancamentos === 'function')
                ? window.FolhaUtils.normalizarLancamentos(primaryArr)
                : primaryArr;
            // Atualizar cache local para consistência
            this.lancamentos = arr;
            // Sincronizar sistema principal
            try {
                if (window.folhaSystem) {
                    window.folhaSystem.folhas = [...arr];
                    if (typeof window.folhaSystem.reconcileFolhasWithFuncionarios === 'function') {
                        window.folhaSystem.reconcileFolhasWithFuncionarios();
                    }
                    try { window.dispatchEvent(new CustomEvent('folhaDataReady', { detail: { folhas: (window.folhaSystem.folhas||[]), funcionarios: (window.folhaSystem.funcionarios||[]) } })); } catch {}
                    try { window.folhaFiltros && window.folhaFiltros.aplicarFiltros && window.folhaFiltros.aplicarFiltros(); } catch {}
                }
            } catch (e) { console.warn('⚠️ Falha ao sincronizar sistema após buscarTodasFolhas:', e); }
            return arr;
        } catch (error) {
            const msg = String((error && (error.code || error.message)) || error || '');
            const isPermission = msg.toLowerCase().includes('permission');
            if (isPermission) {
                console.warn('⚠️ Sem permissão para buscar folhas. Usando cache atual.');
                return Array.isArray(this.lancamentos) ? this.lancamentos : [];
            }
            console.error('❌ Erro em buscarTodasFolhas:', error);
            return Array.isArray(this.lancamentos) ? this.lancamentos : [];
        }
    }

    // 🔧 Normalizar mês/ano para formato YYYY-MM
    _normalizeMes(m) {
        try {
            if (window.FolhaUtils && typeof window.FolhaUtils.normalizeMesAno === 'function') {
                return window.FolhaUtils.normalizeMesAno(m);
            }
        } catch {}
        const s = String(m || '').trim();
        if (/^\d{4}-\d{2}$/.test(s)) return s;
        const m1 = s.match(/^(\d{2})\/(\d{4})$/);
        if (m1) return `${m1[2]}-${m1[1]}`;
        const m2 = s.match(/^(\d{4})[\/-](\d{2})$/);
        if (m2) return `${m2[1]}-${m2[2]}`;
        return s;
    }

    // 🔧 Extrair status como string de forma robusta
    _statusStr(s) {
        if (typeof s === 'object' && s) return String(s.value || s.status || s.nome || '').trim();
        return String(s || '').trim();
    }

    // 🔍 Filtrar folhas fechadas (mes_fechado) e quinzenas pagas
    _filtrarFechadas(lista) {
        return (lista || []).filter(f => {
            const st = (window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function')
                ? window.FolhaUtils.normalizarStatus(f && f.status)
                : this._statusStr(f && f.status);
            const isQuinzena = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
                ? window.FolhaUtils.resolveTipoPagamento(f) === 'quinzena'
                : String((f && (f.tipo || f.tipoPagamento)) || '') === 'quinzena';
            return st === 'mes_fechado' || (isQuinzena && st === 'quinzena_paga');
        });
    }

    _isFolhasFechadasModalAberto() {
        const modal = document.getElementById('folhasFechadasModal');
        return !!(modal && modal.style.display === 'block');
    }

    _normalizarTextoFiltroFolhasFechadas(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    _getMesAnoPadraoFolhasFechadas() {
        const candidatos = [];
        try {
            const mesPagina = document.getElementById('mesAno');
            if (mesPagina && mesPagina.value) candidatos.push(mesPagina.value);
        } catch {}
        try {
            if (window.folhaFiltros && window.folhaFiltros.filtrosAtivos && window.folhaFiltros.filtrosAtivos.mesAno) {
                candidatos.push(window.folhaFiltros.filtrosAtivos.mesAno);
            }
        } catch {}
        try {
            const mesModal = document.getElementById('filtroFechadasMesAno');
            if (mesModal && mesModal.value) candidatos.push(mesModal.value);
        } catch {}
        try {
            if (this._folhasFechadasFiltrosAtivos && this._folhasFechadasFiltrosAtivos.mesAno) {
                candidatos.push(this._folhasFechadasFiltrosAtivos.mesAno);
            }
        } catch {}
        for (const candidato of candidatos) {
            const mes = this._normalizeMes(candidato);
            if (/^\d{4}-\d{2}$/.test(mes)) return mes;
        }
        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    }

    _getFolhasFechadasFiltrosFromDom() {
        const mesInput = document.getElementById('filtroFechadasMesAno');
        const funcInput = document.getElementById('filtroFechadasFuncionario');
        return {
            mesAno: this._normalizeMes(mesInput ? mesInput.value : ''),
            funcionario: String(funcInput ? funcInput.value : '').trim()
        };
    }

    _setFolhasFechadasFiltrosToDom(filtros = {}) {
        const mesInput = document.getElementById('filtroFechadasMesAno');
        const funcInput = document.getElementById('filtroFechadasFuncionario');
        const mesAno = this._normalizeMes(filtros.mesAno || '');
        if (mesInput) mesInput.value = /^\d{4}-\d{2}$/.test(mesAno) ? mesAno : '';
        if (funcInput) funcInput.value = String(filtros.funcionario || '');
        this._folhasFechadasFiltrosAtivos = {
            mesAno: /^\d{4}-\d{2}$/.test(mesAno) ? mesAno : '',
            funcionario: String(filtros.funcionario || '').trim()
        };
    }

    _filtrarFolhasFechadasPorFiltros(lista, filtros = {}) {
        const mesVal = this._normalizeMes(filtros.mesAno || '');
        const termo = this._normalizarTextoFiltroFolhasFechadas(filtros.funcionario || '');
        let base = Array.isArray(lista) ? lista.slice() : [];
        if (mesVal) base = base.filter(f => this._normalizeMes(f.mesAno) === mesVal);
        if (termo) base = base.filter(f => {
            const nome = this._normalizarTextoFiltroFolhasFechadas(f && f.funcionario && f.funcionario.nome);
            const cargo = this._normalizarTextoFiltroFolhasFechadas(f && f.funcionario && f.funcionario.cargo);
            return nome.includes(termo) || cargo.includes(termo);
        });
        return base;
    }

    _renderFolhasFechadasComFiltros(mensagemVazia = 'Nenhuma folha fechada encontrada com os filtros') {
        const filtros = this._getFolhasFechadasFiltrosFromDom();
        this._folhasFechadasFiltrosAtivos = filtros;
        const baseCache = Array.isArray(this._fechadasCache.items) && this._fechadasCache.items.length
            ? this._fechadasCache.items
            : this._filtrarFechadas(this.lancamentos);
        const filtradas = this._filtrarFolhasFechadasPorFiltros(baseCache, filtros);
        this._renderFolhasFechadasTable(filtradas, mensagemVazia);
    }

    _refreshFolhasFechadasModalSeAberto() {
        if (!this._isFolhasFechadasModalAberto()) return;
        this._renderFolhasFechadasComFiltros();
    }

    _getFolhasFechadasSortState() {
        const state = this._folhasFechadasSortState;
        if (!state || typeof state !== 'object') {
            this._folhasFechadasSortState = { key: '', direction: 'asc' };
        }
        const key = String((this._folhasFechadasSortState && this._folhasFechadasSortState.key) || '').trim();
        const direction = String((this._folhasFechadasSortState && this._folhasFechadasSortState.direction) || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
        this._folhasFechadasSortState = { key, direction };
        return this._folhasFechadasSortState;
    }

    _toggleFolhasFechadasSort(key) {
        const parsedKey = String(key || '').trim();
        if (!parsedKey || parsedKey === 'acoes') return this._getFolhasFechadasSortState();
        const current = this._getFolhasFechadasSortState();
        const direction = (current.key === parsedKey && current.direction === 'asc') ? 'desc' : 'asc';
        this._folhasFechadasSortState = { key: parsedKey, direction };
        return this._folhasFechadasSortState;
    }

    _updateFolhasFechadasSortIndicators() {
        const table = document.querySelector('#folhasFechadasModal .folhas-fechadas-table');
        if (!table) return;
        const state = this._getFolhasFechadasSortState();
        table.querySelectorAll('thead th[data-sort-key]').forEach((th) => {
            const key = String(th.getAttribute('data-sort-key') || '').trim();
            th.classList.remove('sortable', 'sort-active', 'sort-asc', 'sort-desc');
            if (key && key !== 'acoes') th.classList.add('sortable');
            if (key && key === state.key) {
                th.classList.add('sort-active');
                th.classList.add(state.direction === 'desc' ? 'sort-desc' : 'sort-asc');
            }
        });
    }

    _setupFolhasFechadasSorting() {
        const table = document.querySelector('#folhasFechadasModal .folhas-fechadas-table');
        if (!table) return;
        table.querySelectorAll('thead th[data-sort-key]').forEach((th) => {
            const key = String(th.getAttribute('data-sort-key') || '').trim();
            if (!key || key === 'acoes') return;
            if (th.dataset.sortBound === '1') return;
            th.dataset.sortBound = '1';
            th.addEventListener('click', () => {
                this._toggleFolhasFechadasSort(key);
                this.filtrarFolhasFechadas();
            });
        });
        this._updateFolhasFechadasSortIndicators();
    }

    _getFolhaFechadaSortValue(f, key) {
        const text = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const isQuinzena = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
            ? window.FolhaUtils.resolveTipoPagamento(f) === 'quinzena'
            : String((f && (f.tipo || f.tipoPagamento)) || '').toLowerCase().includes('quinz');
        const st = (window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function')
            ? window.FolhaUtils.normalizarStatus(f && f.status)
            : this._statusStr(f && f.status);
        const stNorm = String(st || '').toLowerCase().normalize('NFD').replace(/[^a-z_]/g, '');
        const tipoLabel = isQuinzena
            ? (stNorm === 'quinzena_paga' ? '1 quinzena paga' : (stNorm === 'mes_fechado' ? '2 quinzena paga' : '1 quinzena'))
            : (stNorm === 'mes_fechado' ? 'mes fechado pago' : 'mes fechado');
        switch (key) {
            case 'funcionario':
                return text((f && f.funcionario && f.funcionario.nome) || '');
            case 'mesAno':
                return text(this._normalizeMes(f && f.mesAno));
            case 'tipo':
                return text(tipoLabel);
            case 'percentual':
                return Number(isQuinzena ? (f.quinzenaPercentual || f.percentualQuinzena || 50) : 100) || 0;
            case 'salarioBase':
                return Number(window.FolhaUtils?.getSalarioBaseDisplay ? window.FolhaUtils.getSalarioBaseDisplay(f) : (f && f.salarioBase) || 0) || 0;
            case 'quinzena':
                return Number(window.FolhaUtils?.calcularValorQuinzena ? window.FolhaUtils.calcularValorQuinzena(f) : 0) || 0;
            case 'detalhes':
                return Number(window.FolhaUtils?.calcularAcrescimosDisplay ? window.FolhaUtils.calcularAcrescimosDisplay(f) : (f && f.acrescimos) || 0) || 0;
            case 'liquido':
                return Number(window.FolhaUtils?.calcularSalarioLiquidoDisplay ? window.FolhaUtils.calcularSalarioLiquidoDisplay(f) : (f && f.liquido) || 0) || 0;
            default:
                return '';
        }
    }

    _ordenarFolhasFechadas(lista) {
        if (!Array.isArray(lista) || lista.length <= 1) return Array.isArray(lista) ? lista.slice() : [];
        const state = this._getFolhasFechadasSortState();
        if (!state.key || state.key === 'acoes') return lista.slice();
        const mult = state.direction === 'desc' ? -1 : 1;
        return lista
            .map((item, index) => ({ item, index }))
            .sort((a, b) => {
                const va = this._getFolhaFechadaSortValue(a.item, state.key);
                const vb = this._getFolhaFechadaSortValue(b.item, state.key);
                const aNum = typeof va === 'number' && Number.isFinite(va);
                const bNum = typeof vb === 'number' && Number.isFinite(vb);
                let cmp = 0;
                if (aNum && bNum) cmp = va - vb;
                else cmp = String(va || '').localeCompare(String(vb || ''), 'pt-BR', { sensitivity: 'base', numeric: true });
                if (cmp !== 0) return cmp * mult;
                return a.index - b.index;
            })
            .map(x => x.item);
    }

    _renderFolhasFechadasTable(lista, mensagemVazia = 'Nenhuma folha fechada encontrada') {
        const tbody = document.getElementById('folhasFechadasTable');
        const info = document.getElementById('folhasFechadasInfo');
        if (!tbody) return;
        const base = this._ordenarFolhasFechadas(lista);
        if (!base.length) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:#666;">${mensagemVazia}</td></tr>`;
            if (info) info.textContent = 'Nenhuma folha fechada encontrada';
            this._updateFolhasFechadasSortIndicators();
            return;
        }
        const linhas = base.map(f => {
            const nome = (f.funcionario && f.funcionario.nome) || '—';
            const cargo = (f.funcionario && f.funcionario.cargo) || '';
            const mes = f.mesAno || '—';
            const isQuinzena = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
                ? window.FolhaUtils.resolveTipoPagamento(f) === 'quinzena'
                : String(f.tipo || f.tipoPagamento) === 'quinzena';
            const st = (window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function')
                ? window.FolhaUtils.normalizarStatus(f.status)
                : this._statusStr(f.status);
            const stNorm = String(st || '').toLowerCase().normalize('NFD').replace(/[^a-z_]/g, '');
            const tipoLabel = isQuinzena
                ? (stNorm === 'quinzena_paga' ? '1° Quinzena Paga' : (stNorm === 'mes_fechado' ? '2° Quinzena Paga' : '1° Quinzena'))
                : (stNorm === 'mes_fechado' ? 'Mês Fechado Pago' : 'Mês Fechado');
            const perc = isQuinzena ? (f.quinzenaPercentual || f.percentualQuinzena || 50) : 100;
            const salarioBase = window.FolhaUtils?.getSalarioBaseDisplay ? window.FolhaUtils.getSalarioBaseDisplay(f) : (f.salarioBase || 0);
            const quinz = window.FolhaUtils?.calcularValorQuinzena ? window.FolhaUtils.calcularValorQuinzena(f) : 0;
            const liquido = window.FolhaUtils?.calcularSalarioLiquidoDisplay ? window.FolhaUtils.calcularSalarioLiquidoDisplay(f) : (f.liquido || 0);
            return `<tr>
                <td data-label="Funcionário" class="ff-col-funcionario"><strong class="ff-nome">${nome}</strong>${cargo ? `<div class="ff-cargo">${cargo}</div>` : ''}</td>
                <td data-label="Mês/Ano">${mes}</td>
                <td data-label="Tipo"><span class="badge-status ${isQuinzena ? 'badge-quinzena' : 'badge-mes'}">${tipoLabel}</span></td>
                <td data-label="Percentual">${perc}%</td>
                <td data-label="Salário Base">${window.FolhaUtils?.formatarMoeda ? window.FolhaUtils.formatarMoeda(salarioBase) : salarioBase}</td>
                <td data-label="1ª Quinzena">${window.FolhaUtils?.formatarMoeda ? window.FolhaUtils.formatarMoeda(quinz) : quinz}</td>
                <td data-label="Detalhes" class="ff-col-detalhes"><span class="detalhes-info">Acresc.: ${window.FolhaUtils?.formatarMoeda ? window.FolhaUtils.formatarMoeda(f.acrescimos || 0) : (f.acrescimos || 0)} | Desc.: ${window.FolhaUtils?.formatarMoeda ? window.FolhaUtils.formatarMoeda(f.descontos || 0) : (f.descontos || 0)}</span></td>
                <td data-label="Líquido"><strong>${window.FolhaUtils?.formatarMoeda ? window.FolhaUtils.formatarMoeda(liquido) : liquido}</strong></td>
                <td data-label="Ações" class="actions-cell">
                    <button class="action-button btn-estornar" title="Estornar Fechamento" onclick="estornarFechamento('${f.id}')" data-folha-id="${f.id}">
                        <i class="fas fa-undo"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');
        tbody.innerHTML = linhas;
        if (window.FolhaUtils && typeof window.FolhaUtils.applyMobileTableLabels === 'function') {
            window.FolhaUtils.applyMobileTableLabels(document.getElementById('folhasFechadasModal'));
        }
        if (info) info.textContent = `Mostrando ${base.length} folha(s) fechadas`;
        this._updateFolhasFechadasSortIndicators();
    }

    loadFolhasFechadas(opcoes = {}) {
        try {
            const todos = (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) ? window.folhaSystem.folhas : (this.lancamentos || []);
            const fechadas = this._filtrarFechadas(todos);
            this._fechadasCache.items = fechadas;
            this._fechadasCache.lastUpdated = Date.now();
            if (opcoes.aplicarFiltros || this._isFolhasFechadasModalAberto()) {
                this._renderFolhasFechadasComFiltros('Nenhuma folha fechada encontrada com os filtros');
            } else {
                this._renderFolhasFechadasTable(fechadas, 'Nenhuma folha fechada encontrada');
            }
        } catch (e) {
            console.error('❌ Erro ao listar folhas fechadas:', e);
        }
    }

    // Exibir notificação padronizada dentro da classe
    showNotification(message, type = 'info', duration = 3000) {
        try {
            if (window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
                window.FolhaUtils.showToast(message, type, duration);
            } else {
                console[(type === 'error') ? 'error' : 'log'](message);
                if (type === 'error') alert(message);
            }
        } catch(e) {
            console.error('❌ Erro ao exibir notificação:', e);
        }
    }

    // Método openEditFolhaModal como parte da classe para corrigir sintaxe
    async openEditFolhaModal(lancamentoId) {
        console.log('💰 Abrindo modal editar folha:', lancamentoId);
        // Preferir dados normalizados do sistema
        let lancamento = (window.folhaSystem && Array.isArray(window.folhaSystem.folhas))
            ? window.folhaSystem.folhas.find(f => (f.id || f.key) === lancamentoId)
            : null;
        if (!lancamento) {
            lancamento = this.lancamentos.find(l => (l.id || l.key) === lancamentoId);
        }
        // Fallback: buscar diretamente do Firebase
        if (!lancamento && window.database) {
            try {
                const { ref, get } = await import('../firebase/sdk/firebase-database.js');
                const snap = await get(ref(window.database, this._resolvePath(`folhas/${lancamentoId}`)));
                if (snap.exists()) {
                    lancamento = { id: lancamentoId, ...(snap.val() || {}) };
                }
            } catch (e) {
                console.warn('⚠️ Fallback Firebase para edição falhou:', e);
            }
        }
        try {
            if (lancamentoId) {
                console.log('🔎 Estado antes da reconciliação:', {
                    id: lancamento && (lancamento.id || lancamento.key),
                    nome: lancamento && lancamento.funcionario && lancamento.funcionario.nome,
                    tipoContrato: lancamento && lancamento.funcionario && lancamento.funcionario.tipoContrato,
                    mesAno: lancamento && lancamento.mesAno
                });
                lancamento = await this._reconcileLancamentoForEdit(lancamentoId, lancamento);
                console.log('✅ Após reconciliação:', {
                    id: lancamento && (lancamento.id || lancamento.key),
                    nome: lancamento && lancamento.funcionario && lancamento.funcionario.nome,
                    tipoContrato: lancamento && lancamento.funcionario && lancamento.funcionario.tipoContrato,
                    mesAno: lancamento && lancamento.mesAno
                });
            } else if (!lancamento) {
                try {
                    const hint = this._editHint || null;
                    if (hint && (hint.nome || hint.mesAno)) {
                        const found = this._findLancamentoByFuncionarioMes(hint.nome, hint.mesAno);
                        if (found) {
                            lancamento = found;
                            lancamentoId = found.id || found.key;
                            console.log('🔎 Edit fallback por nome+mes:', { id: lancamentoId, nome: hint.nome, mesAno: hint.mesAno });
                        }
                    }
                } catch (e) { console.warn('⚠️ Falha no fallback por nome+mes:', e); }
            }
        } catch (e) { console.warn('⚠️ Falha ao reconciliar dados para edição:', e); }
        if (Array.isArray(lancamento)) {
            try {
                const hint = this._editHint || {};
                const nome = hint.nome || '';
                const mes = hint.mesAno || '';
                const found = this._findLancamentoByFuncionarioMes(nome, mes);
                if (found) {
                    lancamento = found;
                    lancamentoId = found.id || found.key;
                    console.log('🔎 Ajuste: seleção de objeto correta a partir de array', { id: lancamentoId, nome, mes });
                }
            } catch {}
        }
        if (!lancamento || Array.isArray(lancamento)) {
            this.showNotification('Lançamento não encontrado!', 'error');
            return;
        }
        
        this.isEditMode = true;
        this.lancamentoAtual = lancamento;
        this._editLancamentoId = lancamento.id || lancamento.key || lancamento.$key || lancamento.recordId || lancamentoId || '';
        
        // Evitar cálculos intermediários enquanto o formulário é hidratado.
        this._isHydratingForm = true;
        try {
            // Limpar formulário antes de preencher para evitar estados residuais
            this.clearFolhaForm();

            // Preencher formulário
            this.fillFolhaForm(lancamento);
        } finally {
            this._isHydratingForm = false;
        }
        try {
            console.log('🧩 Checagem pós-fill:', {
                idInput: (document.getElementById('folhaId')||{}).value,
                nomeInput: (document.getElementById('folhaFuncionario')||{}).value,
                mesAnoInput: (document.getElementById('folhaMesAno')||{}).value,
                tipoPagamentoInput: (document.getElementById('folhaTipoPagamento')||{}).value
            });
        } catch {}
    
        // Reforço: garantir que o valor do campo "Tipo de Pagamento" está correto após possíveis manipulações do DOM
        setTimeout(() => {
            const tipoSelect = document.getElementById('folhaTipoPagamento');
            if (tipoSelect && lancamento) {
                // Normalizar tipo novamente para garantir valor correto
                const normalizeTipoPagamento = (raw) => {
                    try {
                        if (!raw) return 'mes';
                        const str = String(raw).toLowerCase()
                            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                            .replace(/[^a-z_\-]/g, '');
                        const mesAliases = new Set(['mes','mês','mensal','mensalidade','mesfechado','mes_fechado','fechado','fechada','mes-fechado']);
                        const qzAliases = new Set(['quinzena','quinzenal','quinzena_paga','quinzenapaga','quizenal']);
                        if (mesAliases.has(str)) return 'mes';
                        if (qzAliases.has(str)) return 'quinzena';
                        return (str === 'quinzena') ? 'quinzena' : 'mes';
                    } catch { return 'mes'; }
                };
                let tipoPgVal = normalizeTipoPagamento(lancamento.tipoPagamento || lancamento.tipo || lancamento.tipoFolha || (lancamento.status === 'quinzena_paga' ? 'quinzena' : 'mes'));
                tipoSelect.value = tipoPgVal;
            }
        }, 50);
        
        // Configurar modal
        const modalTitle = document.getElementById('folhaModalTitle');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Folha de Pagamento';
        }
        
        const saveBtn = document.getElementById('saveFolhaBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Atualizar';
        }
        
        // Mostrar modal
        const modal = document.getElementById('folhaModal');
        if (modal) {
            modal.style.display = 'block';
        }
        
        // ✅ CONFIGURAR CÁLCULO EM TEMPO REAL APÓS ABRIR O MODAL
        setTimeout(() => {
            console.log('🔍 [DEBUG] Inicialização folhaLancamentos:', typeof window.folhaLancamentos, window.folhaLancamentos);
            console.log('🔧 Configurando cálculo em tempo real para edição...');
            this.setupCalculoRealTime();
            this.setupValesDetalhados();
            
            // Configurar opções de quinzena
            this.toggleQuinzenaOptions();
            this.toggleValorManual();
            // Garantir botão salvar vinculado
            this.setupEventListeners();
            this.ensureSaveButtonBound();
            
            // Configurar modo cumulativo (desligado por padrão para edição)
            const modoCumulativo = document.getElementById('modoCumulativo');
            if (modoCumulativo) {
                modoCumulativo.checked = false;
                this.updateModoCumulativoDescription();
            }
            
            // ✅ CORREÇÃO: Forçar recálculo após configurar tudo
            setTimeout(() => {
                console.log('🧮 Forçando recálculo inicial para edição...');
                // Aplicar restrições de encargos conforme contrato do lançamento
                try { this.applyEncargoRestrictionsByLancamento(); } catch (e) { console.warn('⚠️ Falha ao aplicar restrições por contrato:', e); }
                this.calcularFolhaRealTime();
            }, 100);
            try {
                const needsRefill = () => {
                    const nomeEl = document.getElementById('folhaFuncionario');
                    const mesEl = document.getElementById('folhaMesAno');
                    const idEl = document.getElementById('folhaId');
                    const nomeEmpty = !nomeEl || !String(nomeEl.value||'').trim();
                    const mesEmpty = !mesEl || !String(mesEl.value||'').trim();
                    const idEmpty = !idEl || !String(idEl.value||'').trim();
                    return nomeEmpty || mesEmpty || idEmpty;
                };
                if (needsRefill()) {
                    const refill = () => {
                        this._isHydratingForm = true;
                        try {
                            this.fillFolhaForm(this.lancamentoAtual || {});
                        } catch(e) {
                            console.warn('⚠️ Refill falhou:', e);
                        } finally {
                            this._isHydratingForm = false;
                        }
                        try {
                            this.applyEncargoRestrictionsByLancamento();
                            if (typeof this.ensureEncargoFieldsEnabledForCLT === 'function') this.ensureEncargoFieldsEnabledForCLT();
                            this.calcularFolhaRealTime();
                        } catch(e) { console.warn('⚠️ Refill falhou ao recalcular:', e); }
                    };
                    window.addEventListener('folhaDataReady', function onReady() {
                        window.removeEventListener('folhaDataReady', onReady);
                        setTimeout(refill, 80);
                    }, { once: true });
                }
            } catch {}
        }, 100);
    }

    _findLancamentoByFuncionarioMes(nomeRaw, mesRaw) {
        try {
            const norm = (s) => { try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' '); } catch { return ''; } };
            const normMes = (val) => { try { return this._normalizeMes(val); } catch { const s=String(val||'').trim(); const m=s.match(/^(\d{2})\/(\d{4})$/); return m?`${m[2]}-${m[1]}`:s; } };
            const alvoNome = norm(nomeRaw);
            const alvoMes = normMes(mesRaw);
            const pool = [];
            try { if (Array.isArray(this.lancamentos)) pool.push(...this.lancamentos); } catch {}
            try { if (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) pool.push(...window.folhaSystem.folhas); } catch {}
            try { if (Array.isArray(window.pendingFolhasData)) pool.push(...window.pendingFolhasData); } catch {}
            try { if (window.folhaMain && Array.isArray(window.folhaMain.folhas)) pool.push(...window.folhaMain.folhas); } catch {}
            const match = pool.filter(f => {
                const nome = (f && f.funcionario && f.funcionario.nome) ? norm(f.funcionario.nome) : '';
                const mes = f && f.mesAno ? normMes(f.mesAno) : '';
                const tipo = String((f && (f.tipoPagamento||f.tipo||'mes'))||'mes').toLowerCase();
                return (!!alvoNome && nome === alvoNome) && (!!alvoMes && mes === alvoMes) && (!!tipo);
            });
            let candidates = match;
            if (candidates.length === 0 && alvoNome) {
                candidates = pool.filter(f => {
                    const nome = (f && f.funcionario && f.funcionario.nome) ? norm(f.funcionario.nome) : '';
                    return nome === alvoNome;
                });
            }
            if (candidates.length === 0) return null;
            const score = (x) => { const t = new Date(x.updatedAt || x.dataAtualizacao || x.dataCriacao || 0).getTime() || 0; const c = x.calculos ? 1 : 0; const i = x.id ? 1 : 0; return (t*10) + (c*2) + i; };
            candidates.sort((a,b)=>score(b)-score(a));
            return candidates[0];
        } catch { return null; }
    }

    async _reconcileLancamentoForEdit(lancamentoId, lancamento) {
        try {
            const norm = (s) => {
                try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' '); } catch { return ''; }
            };
            const resolveId = (x) => {
                try { return String((x && x.funcionario && x.funcionario.id) || x.funcionarioId || x.idFuncionario || x.func_id || ''); } catch { return ''; }
            };
            const getById = (id) => {
                try {
                    if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) {
                        const f = window.folhaSystem.funcionarios.find(ff => String(ff.id) === String(id));
                        if (f) return f;
                    }
                    if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                        const f2 = window.folhaFuncionarios.funcionarios.find(ff => String(ff.id) === String(id));
                        if (f2) return f2;
                    }
                } catch {}
                return null;
            };
            const getByName = (name) => {
                const alvo = norm(name);
                if (!alvo) return null;
                try {
                    if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) {
                        const f = window.folhaSystem.funcionarios.find(ff => norm(ff.nome) === alvo);
                        if (f) return f;
                    }
                    if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                        const f2 = window.folhaFuncionarios.funcionarios.find(ff => norm(ff.nome) === alvo);
                        if (f2) return f2;
                    }
                } catch {}
                return null;
            };
            let out = lancamento || null;
            if (!out) {
                if (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) {
                    out = window.folhaSystem.folhas.find(f => (f.id || f.key) === lancamentoId) || null;
                }
                if (!out && Array.isArray(this.lancamentos)) {
                    out = this.lancamentos.find(l => (l.id || l.key) === lancamentoId) || null;
                }
            }
            if (!out && window.database) {
                try {
                    const { ref, get } = await import('../firebase/sdk/firebase-database.js');
                    const primaryPath = this._resolvePath(`folhas/${lancamentoId}`);
                    let snap = await get(ref(window.database, primaryPath));
                    if (!snap.exists() && primaryPath !== `folhas/${lancamentoId}`) {
                        snap = await get(ref(window.database, `folhas/${lancamentoId}`));
                    }
                    if (snap.exists()) {
                        out = { id: lancamentoId, ...(snap.val() || {}) };
                        console.log('🗄️ Reconciliar: encontrado em caminho primário folhas/', lancamentoId);
                    }
                } catch (e) {
                    console.warn('⚠️ Falha ao buscar lançamento no Firebase:', e);
                }
            }
            if (!out) return null;
            console.log('🔎 Reconciliar: base encontrada', { id: out.id || out.key, funcIsObj: typeof out.funcionario === 'object' });
            const fid = resolveId(out);
            let fobj = null;
            if (fid) fobj = getById(fid);
            if (!fobj) {
                const rawNome = (out.funcionario && out.funcionario.nome) || (typeof out.funcionario === 'string' ? out.funcionario : '') || '';
                if (rawNome) fobj = getByName(rawNome);
            }
            console.log('🔎 Reconciliar: funcionário resolvido', { hasId: !!fid, found: !!fobj });
            const func = out.funcionario && typeof out.funcionario === 'object' ? { ...out.funcionario } : {};
            if (fobj) {
                func.id = func.id || fobj.id;
                func.nome = func.nome || fobj.nome || (typeof out.funcionario === 'string' ? out.funcionario : '');
                func.cargo = func.cargo || fobj.cargo || '';
                func.tipoContrato = func.tipoContrato || fobj.tipoContrato || fobj.funcionarioTipoContrato || '';
                const sb = Number(func.salarioBase || fobj.salarioBase || fobj.salario || 0) || 0;
                if (sb > 0) func.salarioBase = sb;
            }
            out.funcionario = func.id || func.nome ? func : out.funcionario || func;
            if (!out.mesAno) {
                let mes = '';
                try { if (window.folhaFiltros && window.folhaFiltros.filtrosAtivos && window.folhaFiltros.filtrosAtivos.mesAno) mes = window.folhaFiltros.filtrosAtivos.mesAno; } catch {}
                if (!mes) {
                    const hoje = new Date();
                    mes = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
                }
                out.mesAno = mes;
            }
            console.log('✅ Reconciliar: saída final', { id: out.id || out.key, nome: out.funcionario && out.funcionario.nome, tipoContrato: out.funcionario && out.funcionario.tipoContrato, mesAno: out.mesAno });
            return out;
        } catch (e) {
            return lancamento;
        }
    }

    // Métodos reconstruídos baseados em padrões de outros módulos

    openNovaFolhaModal() {
        console.log('💰 Abrindo modal nova folha...');
        
        this.isEditMode = false;
        this._editLancamentoId = '';
        this.lancamentoAtual = { status: 'rascunho', funcionario: {}, tipo: 'mes', tipoPagamento: 'mes', mesAno: '' };
        
        this.clearFolhaForm();
        
        const modalTitle = document.getElementById('folhaModalTitle');
        if (modalTitle) {
            modalTitle.innerHTML = '<i class="fas fa-plus"></i> Nova Folha de Pagamento';
        }
        
        const saveBtn = document.getElementById('saveFolhaBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
        }
        
        const mesAnoInput = document.getElementById('folhaMesAno');
        if (mesAnoInput) {
            if (!mesAnoInput.value) {
                const hoje = new Date();
                const mesAno = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
                mesAnoInput.value = mesAno;
            }
            this.lancamentoAtual.mesAno = mesAnoInput.value;
        }

        const modal = document.getElementById('folhaModal');
        if (modal) {
            modal.style.display = 'block';
        }
        
        setTimeout(() => {
            this.setupCalculoRealTime();
            this.setupValesDetalhados();
            const tipoSelect = document.getElementById('folhaTipoPagamento');
            if (tipoSelect) {
                if (!tipoSelect.value) tipoSelect.value = 'mes';
                tipoSelect.dispatchEvent(new Event('change'));
            }
            this.toggleQuinzenaOptions();
            this.toggleValorManual();
            this.setupEventListeners();
            try { this.setupResumoBindings(); } catch {}
            this.ensureSaveButtonBound();
            const funcInput = document.getElementById('folhaFuncionario');
            if (funcInput) {
                try { funcInput.focus(); } catch {}
                funcInput.dataset.lastFocused = 'true';
                if (window.folhaFuncionarios) {
                    window.folhaFuncionarios.targetField = 'folhaFuncionario';
                }
            }
            setTimeout(() => {
                try { this.applyEncargoRestrictionsByLancamento(); } catch {}
                try { this.calcularFolhaRealTime(); } catch {}
            }, 100);
        }, 100);
    }

    setupResumoBindings() {
        const idsResumo = ['resumoBruto','resumoQuinzena','resumoAcrescimos','resumoDescontos','resumoLiquido'];
        idsResumo.forEach(id => { const el = document.getElementById(id); if (!el) return; el._resumoBound = true; });
        const bindIds = [
            'funcionarioSalario','folhaHorasExtras','folhaPercentualExtra','folhaBonificacoes','folhaPremioAssiduidade',
            'folhaDiasTrabalhados','folhaQtdFilhos','folhaSalarioFamilia','folhaFaltas','folhaVales','folhaDescRepousoRemunerado',
            'folhaDescontoINSSManual','folhaContribuicaoConfederativa','folhaContribuicaoSindical','folhaDescontoIRRFManual','folhaEmprestimoConsignado',
            'folhaOutrosDescontos','quinzenaPercentual','quinzenaValorManual','usarSalarioBrutoParaQuinzena','folhaTipoPagamento',
            'folhaRemoverCalculosAutomaticos'
        ];
        const tryBind = (id, types=['input','change']) => {
            const el = document.getElementById(id);
            if (!el || el._resumoCalcBound) return;
            types.forEach(t => { try { el.addEventListener(t, () => this.calcularFolhaRealTime()); } catch {} });
            el._resumoCalcBound = true;
            try {
                if (!el._ptbrDisplay && el.type !== 'checkbox') {
                    const disp = document.createElement('div');
                    disp.className = 'ptbr-display';
                    disp.style.cssText = 'font-size:12px;color:#555;margin-top:2px;';
                    if (el.parentNode) el.parentNode.insertBefore(disp, el.nextSibling);
                    el._ptbrDisplay = disp;
                }
            } catch {}
        };
        bindIds.forEach(id => tryBind(id));
        try { this.calcularFolhaRealTime(); } catch {}
    }

    openFolhasFechadasModal() {
        console.log('📂 Abrindo modal de folhas fechadas...');
        
        const modal = document.getElementById('folhasFechadasModal');
        if (modal) {
            modal.style.display = 'block';
        }
        this._setupFolhasFechadasSorting();
        
        // ✅ Configurar filtros padrão e auto-filtragem
        try {
            const mesInput = document.getElementById('filtroFechadasMesAno');
            const funcInput = document.getElementById('filtroFechadasFuncionario');
            this._setFolhasFechadasFiltrosToDom({
                mesAno: this._getMesAnoPadraoFolhasFechadas(),
                funcionario: funcInput ? funcInput.value : (this._folhasFechadasFiltrosAtivos && this._folhasFechadasFiltrosAtivos.funcionario) || ''
            });
            // Debounce simples
            let t;
            const trigger = () => { clearTimeout(t); t = setTimeout(() => this.filtrarFolhasFechadas(), 150); };
            if (mesInput && !mesInput._fechadasBound) { mesInput.addEventListener('change', trigger); mesInput._fechadasBound = true; }
            if (funcInput && !funcInput._fechadasBound) { funcInput.addEventListener('input', trigger); funcInput._fechadasBound = true; }
        } catch(e) { console.warn('⚠️ Falha ao configurar filtros auto do modal fechadas:', e); }

        this.loadFolhasFechadas({ aplicarFiltros: true });
    }

    closeFolhaModal() {
        const modal = document.getElementById('folhaModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        this.clearFolhaForm();
        this.isEditMode = false;
        this._editLancamentoId = '';
        this.lancamentoAtual = null;
    }

    closeFolhasFechadasModal() {
        const modal = document.getElementById('folhasFechadasModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    filtrarFolhasFechadas() {
        console.log('🔍 Filtrando folhas fechadas...');
        const tbody = document.getElementById('folhasFechadasTable');
        if (!tbody) return;
        this._renderFolhasFechadasComFiltros('Nenhuma folha fechada encontrada com os filtros');
    }

    // Métodos auxiliares mencionados na função openEditFolhaModal
    clearFolhaForm() {
        const form = document.getElementById('folhaForm');
        if (form) form.reset();
        this._renderValesDetalhados([]);
        this._setFolhaValesTotal(0);
    }

    _parseFolhaNumber(value) {
        if (window.FolhaUtils && typeof window.FolhaUtils.parseNumeroFolha === 'function') {
            return window.FolhaUtils.parseNumeroFolha(value);
        }
        if (value == null || value === '') return 0;
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const raw = String(value).replace(/[^0-9,.-]/g, '');
        if (!raw) return 0;
        const parsed = raw.includes(',')
            ? parseFloat(raw.replace(/\./g, '').replace(/,/g, '.'))
            : parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    _normalizarValeDetalhado(item = {}, index = 0) {
        return {
            id: String(item.id || item.key || `vale_${Date.now()}_${index}`),
            data: String(item.data || item.date || item.dataVale || '').trim(),
            valor: this._parseFolhaNumber(item.valor ?? item.value ?? item.total ?? 0),
            observacao: String(item.observacao || item.observacoes || item.descricao || item.description || '').trim()
        };
    }

    _getValesDetalhadosFromLancamento(lancamento = {}) {
        let detalhes = [];
        try {
            if (window.FolhaUtils && typeof window.FolhaUtils.normalizarValesDetalhados === 'function') {
                detalhes = window.FolhaUtils.normalizarValesDetalhados(lancamento);
            }
        } catch {}
        if (!detalhes.length) {
            const fontes = [lancamento.valesDetalhados, lancamento.historicoVales, lancamento.valesHistorico, lancamento.detalhesVales];
            const origem = fontes.find(Array.isArray);
            if (Array.isArray(origem)) {
                detalhes = origem.map((item, index) => this._normalizarValeDetalhado(item, index))
                    .filter(item => item.valor > 0 || item.data || item.observacao);
            }
        }
        if (!detalhes.length) {
            const totalLegado = this._parseFolhaNumber(lancamento.vales || (lancamento.calculos && lancamento.calculos.vales) || 0);
            if (totalLegado > 0) {
                detalhes = [{
                    id: 'vale_legado',
                    data: '',
                    valor: totalLegado,
                    observacao: 'Valor legado sem data'
                }];
            }
        }
        return detalhes.map((item, index) => this._normalizarValeDetalhado(item, index));
    }

    _formatFolhaMoney(value) {
        const total = this._parseFolhaNumber(value);
        return total.toFixed(2);
    }

    _setFolhaValesTotal(total) {
        const valor = Math.round(this._parseFolhaNumber(total) * 100) / 100;
        const input = document.getElementById('folhaVales');
        if (input) {
            input.value = valor > 0 ? valor.toFixed(2) : '0.00';
            input.readOnly = true;
            if (input._ptbrDisplay) {
                input._ptbrDisplay.textContent = (window.FolhaUtils && window.FolhaUtils.formatarMoeda)
                    ? window.FolhaUtils.formatarMoeda(valor)
                    : `R$ ${valor.toFixed(2).replace('.', ',')}`;
            }
        }
        return valor;
    }

    _collectValesDetalhadosFromForm() {
        const tbody = document.getElementById('folhaValesDetalhadosBody');
        if (!tbody) return [];
        return Array.from(tbody.querySelectorAll('tr[data-vale-row="1"]')).map((row, index) => {
            const data = row.querySelector('[data-vale-field="data"]');
            const valor = row.querySelector('[data-vale-field="valor"]');
            const observacao = row.querySelector('[data-vale-field="observacao"]');
            return this._normalizarValeDetalhado({
                id: row.dataset.valeId || `vale_${Date.now()}_${index}`,
                data: data ? data.value : '',
                valor: valor ? valor.value : 0,
                observacao: observacao ? observacao.value : ''
            }, index);
        }).filter(item => item.valor > 0 || item.data || item.observacao);
    }

    _syncValesDetalhadosTotal({ recalculate = true } = {}) {
        const detalhes = this._collectValesDetalhadosFromForm();
        const total = detalhes.reduce((sum, item) => sum + this._parseFolhaNumber(item.valor), 0);
        this._setFolhaValesTotal(total);
        this._syncValesDetalhadosEmpty();
        if (recalculate) {
            try {
                if (typeof this.scheduleCalcularFolhaRealTime === 'function') this.scheduleCalcularFolhaRealTime(80);
                else this.calcularFolhaRealTime();
            } catch {}
        }
        return total;
    }

    _syncValesDetalhadosEmpty() {
        const tbody = document.getElementById('folhaValesDetalhadosBody');
        const empty = document.getElementById('folhaValesDetalhadosEmpty');
        const wrap = document.querySelector('#folhaValesDetalhadosSection .vales-detalhados-table-wrap');
        const hasRows = !!(tbody && tbody.querySelector('tr[data-vale-row="1"]'));
        if (empty) empty.style.display = hasRows ? 'none' : 'block';
        if (wrap) wrap.style.display = hasRows ? 'block' : 'none';
    }

    _addValeDetalhadoRow(item = {}) {
        const tbody = document.getElementById('folhaValesDetalhadosBody');
        if (!tbody) return;
        const detalhe = this._normalizarValeDetalhado(item, tbody.children.length);
        const tr = document.createElement('tr');
        tr.dataset.valeRow = '1';
        tr.dataset.valeId = detalhe.id;

        const tdData = document.createElement('td');
        tdData.dataset.label = 'Data';
        const inputData = document.createElement('input');
        inputData.type = 'date';
        inputData.dataset.valeField = 'data';
        inputData.value = detalhe.data;
        tdData.appendChild(inputData);

        const tdValor = document.createElement('td');
        tdValor.dataset.label = 'Valor';
        const inputValor = document.createElement('input');
        inputValor.type = 'number';
        inputValor.step = '0.01';
        inputValor.min = '0';
        inputValor.dataset.valeField = 'valor';
        inputValor.placeholder = '0,00';
        inputValor.value = detalhe.valor > 0 ? this._formatFolhaMoney(detalhe.valor) : '';
        tdValor.appendChild(inputValor);

        const tdObs = document.createElement('td');
        tdObs.dataset.label = 'Observação';
        const inputObs = document.createElement('input');
        inputObs.type = 'text';
        inputObs.dataset.valeField = 'observacao';
        inputObs.maxLength = 120;
        inputObs.placeholder = 'Observação';
        inputObs.value = detalhe.observacao;
        tdObs.appendChild(inputObs);

        const tdAcoes = document.createElement('td');
        tdAcoes.dataset.label = 'Ações';
        const btnRemover = document.createElement('button');
        btnRemover.type = 'button';
        btnRemover.className = 'action-button delete-button vale-remover-btn';
        btnRemover.title = 'Remover vale';
        btnRemover.innerHTML = '<i class="fas fa-trash"></i>';
        tdAcoes.appendChild(btnRemover);

        tr.appendChild(tdData);
        tr.appendChild(tdValor);
        tr.appendChild(tdObs);
        tr.appendChild(tdAcoes);
        tbody.appendChild(tr);

        [inputData, inputValor, inputObs].forEach((input) => {
            input.addEventListener('input', () => this._syncValesDetalhadosTotal());
            input.addEventListener('change', () => this._syncValesDetalhadosTotal());
        });
        btnRemover.addEventListener('click', () => {
            tr.remove();
            this._syncValesDetalhadosTotal();
        });
        this._syncValesDetalhadosEmpty();
    }

    _renderValesDetalhados(detalhes = []) {
        const tbody = document.getElementById('folhaValesDetalhadosBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        detalhes.forEach(item => this._addValeDetalhadoRow(item));
        this._syncValesDetalhadosTotal({ recalculate: false });
    }

    setupValesDetalhados() {
        const btn = document.getElementById('addValeDetalhadoBtn');
        if (btn && !btn._valesDetalhadosBound) {
            btn.addEventListener('click', () => {
                const hoje = new Date();
                const data = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
                this._addValeDetalhadoRow({ data, valor: 0, observacao: '' });
                this._syncValesDetalhadosTotal();
                const tbody = document.getElementById('folhaValesDetalhadosBody');
                const valorInput = tbody && tbody.querySelector('tr:last-child [data-vale-field="valor"]');
                if (valorInput) valorInput.focus();
            });
            btn._valesDetalhadosBound = true;
        }
        this._syncValesDetalhadosEmpty();
    }

    // Implementar fillFolhaForm completo baseado na estrutura do HTML
    fillFolhaForm(lancamento) {
        console.log('📝 Preenchendo formulário com dados:', lancamento);
        
        // Campos básicos
        try { const idEl = document.getElementById('folhaId'); if (idEl) idEl.value = lancamento.id || lancamento.key || ''; } catch {}
        {
            try {
                if (lancamento && lancamento.funcionario && typeof lancamento.funcionario === 'string') {
                    lancamento.funcionario = { nome: String(lancamento.funcionario).trim() };
                }
            } catch {}
            try {
                const getId = (x) => {
                    try {
                        if (!x) return '';
                        const a = (x.funcionario && x.funcionario.id) || x.funcionarioId || x.idFuncionario || x.func_id || '';
                        return a ? String(a) : '';
                    } catch { return ''; }
                };
                let fid = getId(lancamento);
                if ((!lancamento.funcionario || !lancamento.funcionario.nome) && fid) {
                    let found = null;
                    try {
                        if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) {
                            found = window.folhaSystem.funcionarios.find(ff => String(ff.id) === String(fid)) || null;
                        }
                    } catch {}
                    if (!found) {
                        try {
                            if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                                found = window.folhaFuncionarios.funcionarios.find(ff => String(ff.id) === String(fid)) || null;
                            }
                        } catch {}
                    }
                    if (found) {
                        try {
                            lancamento.funcionario = { ...(lancamento.funcionario || {}), id: found.id, nome: found.nome || (lancamento.funcionario && lancamento.funcionario.nome) || '', cargo: found.cargo || (lancamento.funcionario && lancamento.funcionario.cargo) || '' };
                            if (!lancamento.funcionario.tipoContrato) {
                                lancamento.funcionario.tipoContrato = found.tipoContrato || found.funcionarioTipoContrato || lancamento.funcionario.tipoContrato || '';
                            }
                            const sb = Number(found.salarioBase || found.salario || 0) || 0;
                            if (sb > 0 && !lancamento.funcionario.salarioBase) lancamento.funcionario.salarioBase = sb;
                        } catch {}
                    }
                }
            } catch {}
            let nome = ((lancamento && lancamento.funcionario && lancamento.funcionario.nome) || lancamento.funcionario || '');
            if (window.isAllCaps && window.toTitleCasePt && window.isAllCaps(nome)) nome = window.toTitleCasePt(nome);
            const el = document.getElementById('folhaFuncionario');
            if (el) { el.value = nome; try { el.dataset.lastFocused = 'true'; } catch {} }
            try {
                if (el && lancamento && lancamento.funcionario && typeof lancamento.funcionario === 'object') {
                    if (lancamento.funcionario.id) el.dataset.funcionarioId = lancamento.funcionario.id;
                    el.dataset.funcionarioData = JSON.stringify(lancamento.funcionario);
                    try {
                        const fc = lancamento.funcionario;
                        if (!fc.tipoContrato && fc.funcionarioTipoContrato) fc.tipoContrato = fc.funcionarioTipoContrato;
                        if (!this.lancamentoAtual) this.lancamentoAtual = lancamento;
                        if (!this.lancamentoAtual.funcionario) this.lancamentoAtual.funcionario = {};
                        this.lancamentoAtual.funcionario.tipoContrato = fc.tipoContrato || this.lancamentoAtual.funcionario.tipoContrato;
                    } catch {}
                }
            } catch {}
            try {
                if (el && (!el.dataset.funcionarioId || !String(el.dataset.funcionarioId).trim()) && String(nome||'').trim()) {
                    const norm = (s) => { try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' '); } catch { return ''; } };
                    const alvo = norm(nome);
                    let fobj = null;
                    try {
                        if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) {
                            fobj = window.folhaSystem.funcionarios.find(ff => norm(ff.nome) === alvo) || null;
                        }
                    } catch {}
                    if (!fobj) {
                        try {
                            if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                                fobj = window.folhaFuncionarios.funcionarios.find(ff => norm(ff.nome) === alvo) || null;
                            }
                        } catch {}
                    }
                    if (fobj) {
                        const sb2 = Number(fobj.salarioBase || fobj.salario || 0) || 0;
                        const func = {
                            ...(lancamento.funcionario || {}),
                            id: fobj.id,
                            nome: fobj.nome || nome,
                            cargo: (lancamento.funcionario && lancamento.funcionario.cargo) || fobj.cargo || '',
                            tipoContrato: (lancamento.funcionario && lancamento.funcionario.tipoContrato) || fobj.tipoContrato || fobj.funcionarioTipoContrato || '',
                            formaPagamento: (lancamento.funcionario && lancamento.funcionario.formaPagamento) || fobj.formaPagamento || '',
                            pix: (lancamento.funcionario && lancamento.funcionario.pix) || fobj.pix || '',
                            pixTipo: (lancamento.funcionario && (lancamento.funcionario.pixTipo || lancamento.funcionario.tipoPix || lancamento.funcionario.tipoChavePix)) || fobj.pixTipo || fobj.tipoPix || fobj.tipoChavePix || '',
                            favorecidoPix: (lancamento.funcionario && (lancamento.funcionario.favorecidoPix || lancamento.funcionario.nomeFavorecidoPix)) || fobj.favorecidoPix || fobj.nomeFavorecidoPix || '',
                            beneficiario: (lancamento.funcionario && lancamento.funcionario.beneficiario) || fobj.beneficiario || '',
                            banco: (lancamento.funcionario && lancamento.funcionario.banco) || fobj.banco || '',
                            agencia: (lancamento.funcionario && lancamento.funcionario.agencia) || fobj.agencia || '',
                            conta: (lancamento.funcionario && lancamento.funcionario.conta) || fobj.conta || ''
                        };
                        if (sb2 > 0 && !func.salarioBase) func.salarioBase = sb2;
                        el.dataset.funcionarioId = func.id;
                        el.dataset.funcionarioData = JSON.stringify(func);
                        try {
                            this.lancamentoAtual.funcionario = func;
                            const salEl = document.getElementById('funcionarioSalario');
                            if (salEl && func.salarioBase > 0) salEl.value = func.salarioBase;
                            this.applyEncargoRestrictionsByLancamento();
                            if (typeof this.ensureEncargoFieldsEnabledForCLT === 'function') this.ensureEncargoFieldsEnabledForCLT();
                        } catch {}
                        console.log('🔗 Dataset de funcionário populado por nome na edição:', func);
                    }
                }
            } catch {}
        }
        try {
            const mesEl = document.getElementById('folhaMesAno');
            if (mesEl) {
                mesEl.value = lancamento.mesAno || '';
                if (!String(mesEl.value || '').trim()) {
                    let mesFallback = '';
                    try {
                        if (window.folhaFiltros && window.folhaFiltros.filtrosAtivos && window.folhaFiltros.filtrosAtivos.mesAno) {
                            mesFallback = window.folhaFiltros.filtrosAtivos.mesAno;
                        }
                    } catch {}
                    if (!mesFallback) {
                        const hoje = new Date();
                        mesFallback = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}`;
                    }
                    mesEl.value = mesFallback;
                    try {
                        if (!this.lancamentoAtual) this.lancamentoAtual = lancamento || {};
                        this.lancamentoAtual.mesAno = mesFallback;
                    } catch {}
                }
            }
        } catch {}
        
        // Tipo de Pagamento com normalização
        const tipoSelect = document.getElementById('folhaTipoPagamento');
        if (tipoSelect) {
            const tipoVal = this.normalizeTipoPagamento(lancamento.tipoPagamento || lancamento.tipo || lancamento.tipoFolha || 'mes');
            tipoSelect.value = tipoVal;
            // Forçar evento change para toggles
            tipoSelect.dispatchEvent(new Event('change'));
        }
        
        // Preencher campos numéricos com fallback
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val ?? 0); };
        {
            let base = 0;
            try {
                base = (lancamento.salarioBase || (lancamento.funcionario && lancamento.funcionario.salarioBase) || (lancamento.calculos && (lancamento.calculos.salarioBase || (lancamento.calculos.calculos && lancamento.calculos.calculos.salarioBase))) || 0);
            } catch {}
            const salEl = document.getElementById('funcionarioSalario');
            if (salEl) salEl.value = base;
            try { this.lancamentoAtual.salarioBase = base; } catch {}
            try { if (salEl && salEl._ptbrDisplay) salEl._ptbrDisplay.textContent = (window.FolhaUtils && window.FolhaUtils.formatarMoeda) ? window.FolhaUtils.formatarMoeda(base) : base; } catch {}
        }
        setVal('folhaDiasTrabalhados', lancamento.diasTrabalhados);
        setVal('folhaHorasExtras', lancamento.horasExtras);
        setVal('folhaPercentualExtra', lancamento.percentualExtra);
        setVal('folhaPremioAssiduidade', lancamento.premioAssiduidade);
        setVal('folhaBonificacoes', lancamento.bonificacoes);
        setVal('folhaQtdFilhos', (lancamento.quantidadeFilhos || lancamento.dependentes));
        setVal('folhaSalarioFamilia', lancamento.salarioFamilia);
        setVal('folhaFaltas', lancamento.faltas);
        this._renderValesDetalhados(this._getValesDetalhadosFromLancamento(lancamento));
        setVal('folhaDescRepousoRemunerado', lancamento.descontoRepousoRemunerado);
        setVal('folhaDescontoINSSManual', lancamento.descontoINSSManual);
        setVal('folhaContribuicaoConfederativa', lancamento.contribuicaoConfederativa);
        setVal('folhaContribuicaoSindical', lancamento.contribuicaoSindical);
        setVal('folhaDescontoIRRFManual', (lancamento.descontoIRRFManual || lancamento.descontoIRPJ)); // Compatibilidade
        setVal('folhaEmprestimoConsignado', lancamento.emprestimoConsignado);
        setVal('folhaOutrosDescontos', lancamento.outrosDescontos);

        // ✅ Configuração de Auto/Manual e preenchimento de campos unificados
        const toggleAuto = document.getElementById('folhaRemoverCalculosAutomaticos');
        const isAutoRemoved = !!(lancamento.removerCalculosAutomaticos);
        if (toggleAuto) toggleAuto.checked = isAutoRemoved;
        
        // Preenchimento de campos unificados com dados salvos
        // Se estiver no modo Auto, esses valores serão atualizados pelo recálculo subsequente (calcularFolhaRealTime).
        // Se estiver no modo Manual, esses valores serão preservados.
        
        // INSS: Se o cálculo automático estiver removido, o valor salvo no campo manual É o total.
        // Se estiver ativado, o valor total é a soma do automático + ajuste.
        // Mas como agora unificamos os campos, o valor que vem do banco pode estar dividido.
        // Se removerCalculosAutomaticos=true, usamos descontoINSSManual direto.
        // Se removerCalculosAutomaticos=false, calculamos o total para exibir.
        
        let valINSS = 0;
        let valIRRF = 0;
        
        if (lancamento.removerCalculosAutomaticos) {
            valINSS = lancamento.descontoINSSManual || 0;
            valIRRF = lancamento.descontoIRRFManual || lancamento.descontoIRPJ || 0;
        } else {
            // INSS: Soma o valor automático salvo com eventual ajuste manual salvo
            const inssAuto = (lancamento.calculos && lancamento.calculos.inss && lancamento.calculos.inss.valor) || 0;
            const inssManual = lancamento.descontoINSSManual || 0;
            valINSS = inssAuto + inssManual;
            
            // IRRF: Soma automático + ajuste
            const irrfAuto = (lancamento.calculos && lancamento.calculos.irrf && lancamento.calculos.irrf.valor) || 0;
            const irrfManual = lancamento.descontoIRRFManual || lancamento.descontoIRPJ || 0;
            valIRRF = irrfAuto + irrfManual;
        }
        
        // FGTS: Tenta pegar valor salvo explícito ou calcula 8% da base salva (apenas estimativa inicial)
        let valFGTS = lancamento.fgts || 0;
        if (!valFGTS && lancamento.calculos) {
            // Se não tem valor salvo explícito, tenta estimar do histórico
             const baseFgts = (lancamento.calculos.salarioBruto || lancamento.salarioBruto || 0);
             valFGTS = baseFgts * 0.08;
        }

        setVal('folhaDescontoINSSManual', valINSS);
        setVal('folhaDescontoIRRFManual', valIRRF);
        setVal('folhaDescontoFGTS', valFGTS);

        const qz = document.getElementById('quinzenaPercentual');
        if (qz) {
            // Preferir campos específicos da quinzena; usar genérico apenas se específicos ausentes
            const pTop = (lancamento.percentualQuinzena ?? lancamento.quinzenaPercentual);
            const pGen = lancamento.percentual;
            qz.value = (pTop && pTop > 0 && pTop <= 100) ? pTop : ((pGen && pGen > 0 && pGen <= 100) ? pGen : 40);
        }

        // Opções de quinzena se aplicável
        if (lancamento.tipo === 'quinzena') {
            document.getElementById('quinzenaOptions').style.display = 'block';
            const qzEl = document.getElementById('quinzenaPercentual');
            if (qzEl) {
                const pTop = (lancamento.percentualQuinzena ?? lancamento.quinzenaPercentual);
                const pGen = lancamento.percentual;
                qzEl.value = (pTop && pTop > 0 && pTop <= 100) ? pTop : ((pGen && pGen > 0 && pGen <= 100) ? pGen : '40');
            }
            // Outros campos de quinzena...
        }
        
        // Realizar cálculo inicial do resumo
        try { this.applyEncargoRestrictionsByLancamento(); } catch(e){}
        try { this.ensureEncargoFieldsEnabledForCLT && this.ensureEncargoFieldsEnabledForCLT(); } catch(e){}
        try { this.calcularFolhaRealTime(); } catch(e){ console.warn('⚠️ Falha ao calcular resumo inicial:', e); }
        
        // Adicionar preenchimento para mais campos conforme HTML
        // Ex: document.getElementById('folhaSalarioBase').value = lancamento.salarioBase || '';
        // Continuar com todos os campos relevantes
    }
    
    // Adicionar método normalizeTipoPagamento (já presente no setTimeout, extrair)
    normalizeTipoPagamento(raw) {
        if (!raw) return 'mes';
        const str = String(raw).toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z_\-]/g, '');
        const mesAliases = new Set(['mes','mês','mensal','mensalidade','mesfechado','mes_fechado','fechado','fechada','mes-fechado']);
        const qzAliases = new Set(['quinzena','quinzenal','quinzena_paga','quinzenapaga','quizenal']);
        if (mesAliases.has(str)) return 'mes';
        if (qzAliases.has(str)) return 'quinzena';
        return (str === 'quinzena') ? 'quinzena' : 'mes';
    }
    
    // Expandir collectLancamentoData para coletar todos os campos (sem quebrar estrutura)
    collectLancamentoData() {
        const curr = this.lancamentoAtual || {};
        const valStr = (id) => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
        const valNum = (id) => { const v = valStr(id); const s = v.replace(/[^0-9,.-]/g,''); const n = s.includes(',') ? parseFloat(s.replace(/\./g,'').replace(/,/g,'.')) : parseFloat(s || '0'); return isNaN(n) ? 0 : n; };
        const normalizeMes = (val) => { if (window.FolhaUtils && typeof window.FolhaUtils.normalizeMesAno === 'function') { return window.FolhaUtils.normalizeMesAno(val); } const s = String(val||'').trim(); if (/^\d{4}-\d{2}$/.test(s)) return s; const m=s.match(/^(\d{2})\/(\d{4})$/); if(m) return `${m[2]}-${m[1]}`; return s; };
        const normalizeTipo = (raw) => { const s = String(raw||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); return s.includes('quinz') ? 'quinzena' : 'mes'; };

        // Preservar estrutura de funcionario
        let funcionarioNome = valStr('folhaFuncionario') || ((curr.funcionario && curr.funcionario.nome) || '');
        if (window.isAllCaps(funcionarioNome)) funcionarioNome = window.toTitleCasePt(funcionarioNome);
        const funcionarioSalarioBase = valNum('funcionarioSalario');
        const salarioBasePersistido = this._parseFolhaNumber(
            curr.salarioBase
            || (curr.funcionario && curr.funcionario.salarioBase)
            || (curr.calculos && (curr.calculos.salarioBase || (curr.calculos.calculos && curr.calculos.calculos.salarioBase)))
            || 0
        );
        const salarioBase = funcionarioSalarioBase > 0
            ? funcionarioSalarioBase
            : salarioBasePersistido;
        const funcionario = curr.funcionario ? { ...curr.funcionario } : {};
        funcionario.nome = funcionarioNome;
        if (!isNaN(funcionarioSalarioBase) && funcionarioSalarioBase > 0) funcionario.salarioBase = funcionarioSalarioBase;
        // Incorporar dados do dataset se disponíveis
        const funcInputEl = document.getElementById('folhaFuncionario');
        if (funcInputEl) {
            const fid = funcInputEl.dataset.funcionarioId;
            if (fid) funcionario.id = fid;
            const fdata = funcInputEl.dataset.funcionarioData;
            if (fdata) {
                try {
                    const obj = JSON.parse(fdata);
                    funcionario.id = funcionario.id || obj.id;
                    funcionario.nome = funcionario.nome || obj.nome;
                    if (!funcionario.salarioBase && (obj.salarioBase || obj.salario)) {
                        const sal = Number(obj.salarioBase || obj.salario || 0) || 0;
                        if (sal > 0) funcionario.salarioBase = sal;
                    }
                    if (obj.tipoContrato && !funcionario.tipoContrato) funcionario.tipoContrato = obj.tipoContrato;
                    if (obj.funcionarioTipoContrato && !funcionario.tipoContrato) funcionario.tipoContrato = obj.funcionarioTipoContrato;
                    if (obj.cargo && !funcionario.cargo) funcionario.cargo = obj.cargo;
                    ['formaPagamento', 'pix', 'pixTipo', 'tipoPix', 'tipoChavePix', 'favorecidoPix', 'nomeFavorecidoPix', 'beneficiario', 'banco', 'agencia', 'conta'].forEach((key) => {
                        if (!funcionario[key] && obj[key]) funcionario[key] = obj[key];
                    });
                } catch (e) {
                    console.warn('⚠️ Falha ao ler dataset de funcionário:', e);
                }
            }
        }

        const tipoPagamentoRaw = valStr('folhaTipoPagamento') || (curr.tipoPagamento || curr.tipo || 'mes');
        const tipo = normalizeTipo(tipoPagamentoRaw);
        const tipoPagamento = tipo;
        const statusAtual = (window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function')
            ? window.FolhaUtils.normalizarStatus(curr.status)
            : (typeof curr.status === 'string' ? curr.status : String(curr.status || 'rascunho'));
        const valesDetalhados = this._collectValesDetalhadosFromForm();
        let totalValesDetalhados = valesDetalhados.reduce((sum, item) => sum + this._parseFolhaNumber(item.valor), 0);
        if (!valesDetalhados.length) totalValesDetalhados = valNum('folhaVales');
        totalValesDetalhados = Math.round(totalValesDetalhados * 100) / 100;

        const data = {
            id: valStr('folhaId') || curr.id || curr.key || '',
            funcionario,
            mesAno: normalizeMes(valStr('folhaMesAno') || curr.mesAno || ''),
            tipoPagamento,
            tipo,
            tipoFolha: tipo,
            status: statusAtual,
            // Campos numéricos
            salarioBase,
            diasTrabalhados: valNum('folhaDiasTrabalhados'),
            horasExtras: valNum('folhaHorasExtras'),
            percentualExtra: valNum('folhaPercentualExtra'),
            premioAssiduidade: valNum('folhaPremioAssiduidade'),
            bonificacoes: valNum('folhaBonificacoes'),
            quantidadeFilhos: valNum('folhaQtdFilhos'),
            salarioFamilia: valNum('folhaSalarioFamilia'),
            faltas: valNum('folhaFaltas'),
            vales: totalValesDetalhados,
            valesDetalhados,
            descontoRepousoRemunerado: valNum('folhaDescRepousoRemunerado'),
            descontoINSSManual: valNum('folhaDescontoINSSManual'),
            contribuicaoConfederativa: valNum('folhaContribuicaoConfederativa'),
            contribuicaoSindical: valNum('folhaContribuicaoSindical'),
            descontoIRPJ: valNum('folhaDescontoIRRFManual'), // Mantém chave para compatibilidade backend
            descontoIRRFManual: valNum('folhaDescontoIRRFManual'), // Nova chave correta
            fgts: valNum('folhaDescontoFGTS'), // Campo FGTS unificado
            emprestimoConsignado: valNum('folhaEmprestimoConsignado'),
            outrosDescontos: valNum('folhaOutrosDescontos'),
            quinzenaValorManual: valNum('quinzenaValorManual'),
            usarSalarioBrutoParaQuinzena: !!(document.getElementById('usarSalarioBrutoParaQuinzena') && document.getElementById('usarSalarioBrutoParaQuinzena').checked),
            removerCalculosAutomaticos: !!(document.getElementById('folhaRemoverCalculosAutomaticos') && document.getElementById('folhaRemoverCalculosAutomaticos').checked)
        };
        // Percentual da quinzena (compatibilidade)
        const percQz = valNum('quinzenaPercentual');
        if (percQz > 0) { data.percentualQuinzena = percQz; data.percentual = percQz; }
        if (tipo === 'quinzena' && (!percQz || percQz <= 0) && !(data.quinzenaValorManual && data.quinzenaValorManual > 0)) {
            data.percentualQuinzena = 50;
            data.percentual = 50;
        }
        if (tipo === 'mes') {
            data.tipo = 'mes';
            data.tipoPagamento = 'mes';
            data.tipoFolha = 'mes';
            data.quinzenaValorManual = 0;
            data.percentualQuinzena = 100;
            data.quinzenaPercentual = 100;
            data.percentual = 100;
            if (String(data.status || '').toLowerCase() === 'quinzena_paga') data.status = 'calculada';
        } else {
            data.tipo = 'quinzena';
            data.tipoPagamento = 'quinzena';
            data.tipoFolha = 'quinzena';
            if (!data.percentualQuinzena || Number(data.percentualQuinzena) <= 0) data.percentualQuinzena = 50;
            data.quinzenaPercentual = data.percentualQuinzena;
            data.percentual = data.percentualQuinzena;
        }

        // Lógica de Delta para salvar ajuste corretamente (Unificação Visual vs Lógica Separada)
        if (!data.removerCalculosAutomaticos && data.salarioBase > 0 && window.FolhaCalculos && typeof window.FolhaCalculos.calcularFolhaCompleta === 'function') {
            try {
                // Simular cálculo automático puro (sem manuais) para descobrir a base automática
                const simulacao = window.FolhaCalculos.calcularFolhaCompleta({
                    ...data,
                    descontoINSSManual: 0,
                    descontoIRPJ: 0,
                    descontoIRRFManual: 0
                });
                
                const inssAuto = (simulacao.inss && simulacao.inss.valor) || 0;
                const irrfAuto = (simulacao.irrf && simulacao.irrf.valor) || 0;
                
                // Calcular delta (Ajuste = Total Visual - Auto)
                // Se o usuário não mexeu no valor auto, o delta será 0.
                const inssTotalVisual = valNum('folhaDescontoINSSManual');
                const irrfTotalVisual = valNum('folhaDescontoIRRFManual');
                
                let deltaINSS = inssTotalVisual - inssAuto;
                let deltaIRRF = irrfTotalVisual - irrfAuto;
                
                // Arredondar para evitar flutuação de ponto flutuante
                if (Math.abs(deltaINSS) < 0.02) deltaINSS = 0;
                if (Math.abs(deltaIRRF) < 0.02) deltaIRRF = 0;
                
                data.descontoINSSManual = deltaINSS;
                data.descontoIRPJ = deltaIRRF; // Compatibilidade
                data.descontoIRRFManual = deltaIRRF;
                
            } catch (e) {
                console.warn('Erro ao calcular delta de ajustes:', e);
            }
        } else if (data.removerCalculosAutomaticos) {
            // ✅ CORREÇÃO: Se removerCalculosAutomaticos está ativo, zerar os deltas e usar os valores manuais como "totais"
            // Na verdade, se removemos o cálculo automático, o valor inserido no campo É o valor final.
            // Não há "automático" para subtrair.
            // Então, descontoINSSManual = Valor Digitado.
            // Mas precisamos garantir que o backend não tente somar com um "automático fantasma".
            // O backend (FolhaCalculos) já verifica a flag 'removerCalculosAutomaticos' e zera o INSS/IRRF automático.
            // Portanto, podemos salvar o valor total digitado diretamente nos campos manuais.
            
            data.descontoINSSManual = valNum('folhaDescontoINSSManual');
            data.descontoIRPJ = valNum('folhaDescontoIRRFManual');
            data.descontoIRRFManual = valNum('folhaDescontoIRRFManual');
            
            // Garantir que não haja resquícios de cálculos antigos
            if (data.calculos) {
                if (data.calculos.inss) data.calculos.inss.valor = 0;
                if (data.calculos.irrf) data.calculos.irrf.valor = 0;
            }
        }

        this._syncFuncionarioAtivoFlag(data);
        this._ensureEditLancamentoIdentity(data);
        return data;
    }
    
    // Implementar createLancamento e updateLancamento com Firebase, similar a outros módulos
    async createLancamento(data) {
        console.log('➕ Criando novo lançamento (via Manager):', data);
        try {
            if (window.UIAuth && typeof window.UIAuth.isAuthenticated === 'function') {
                const authed = !!window.UIAuth.isAuthenticated();
                if (!authed) throw new Error('Autenticação necessária para salvar');
            }

            // Preparação dos dados (mantendo lógica original)
            if (!data || typeof data !== 'object') data = {};
            if (!(typeof data.status === 'string' && data.status.trim())) data.status = 'rascunho';

            // ... Lógica de resolver funcionário (mantida resumida aqui, mas importante preservar) ...
            // [Bloco de resolução de funcionário omitido para brevidade na substituição, 
            // mas deve ser mantido se eu for substituir a função inteira. 
            // Como SearchReplace substitui bloco exato, preciso copiar a lógica interna ou referenciá-la.]
            // VOU COPIAR A LÓGICA DE RESOLUÇÃO DA LEITURA ANTERIOR PARA O PAYLOAD ABAIXO.
            
            // --- INÍCIO DA CÓPIA DA LÓGICA DE RESOLUÇÃO ---
            try {
                const resolveId = (x) => {
                    try { return String((x && x.funcionario && x.funcionario.id) || x.funcionarioId || x.idFuncionario || x.func_id || ''); } catch { return ''; }
                };
                const norm = (s) => { try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' '); } catch { return ''; } };
                const getById = (id) => {
                    try {
                        if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) {
                            const f = window.folhaSystem.funcionarios.find(ff => String(ff.id) === String(id));
                            if (f) return f;
                        }
                        if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                            const f2 = window.folhaFuncionarios.funcionarios.find(ff => String(ff.id) === String(id));
                            if (f2) return f2;
                        }
                    } catch {}
                    return null;
                };
                const getByName = (name) => {
                    const alvo = norm(name);
                    if (!alvo) return null;
                    try {
                        if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) {
                            const f = window.folhaSystem.funcionarios.find(ff => norm(ff.nome) === alvo);
                            if (f) return f;
                        }
                        if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                            const f2 = window.folhaFuncionarios.funcionarios.find(ff => norm(ff.nome) === alvo);
                            if (f2) return f2;
                        }
                    } catch {}
                    return null;
                };
                const fid = resolveId(data);
                if (!data.funcionario || typeof data.funcionario !== 'object') data.funcionario = {};
                if (fid) {
                    data.funcionario.id = data.funcionario.id || fid;
                    if (!data.funcionario.nome) {
                        const found = getById(fid);
                        if (found) {
                            try {
                                data.funcionario.nome = found.nome || data.funcionario.nome || '';
                                data.funcionario.cargo = data.funcionario.cargo || found.cargo || '';
                                data.funcionario.tipoContrato = data.funcionario.tipoContrato || found.tipoContrato || found.funcionarioTipoContrato || '';
                                const sb = Number(found.salarioBase || found.salario || 0) || 0;
                                if (sb > 0 && !data.funcionario.salarioBase) data.funcionario.salarioBase = sb;
                            } catch {}
                        }
                    }
                } else {
                    const nomeRaw = (data.funcionario && data.funcionario.nome) || '';
                    if (nomeRaw) {
                        const foundByName = getByName(nomeRaw);
                        if (foundByName) {
                            try {
                                data.funcionario.id = foundByName.id;
                                data.funcionario.nome = foundByName.nome || data.funcionario.nome || '';
                                data.funcionario.cargo = data.funcionario.cargo || foundByName.cargo || '';
                                data.funcionario.tipoContrato = data.funcionario.tipoContrato || foundByName.tipoContrato || foundByName.funcionarioTipoContrato || '';
                                const sb2 = Number(foundByName.salarioBase || foundByName.salario || 0) || 0;
                                if (sb2 > 0 && !data.funcionario.salarioBase) data.funcionario.salarioBase = sb2;
                            } catch (e) {}
                        }
                    }
                }
                if (!data.mesAno) {
                    try {
                        const ms = document.getElementById('folhaMesAno');
                        if (ms && ms.value) data.mesAno = ms.value;
                    } catch {}
                }
            } catch {}
            const __clean = (obj) => { Object.keys(obj).forEach((k)=>{ const v=obj[k]; if (v===undefined) { delete obj[k]; } else if (v && typeof v==='object' && !Array.isArray(v)) { obj[k]=__clean(v); } }); return obj; };
            data = __clean(data);
            
            // Cálculos (mantidos)
             try {
                if (window.FolhaCalculos && typeof window.FolhaCalculos.calcularFolhaCompleta === 'function') {
                    const dados = {
                        salarioBase: Number(data.funcionario && data.funcionario.salarioBase || data.salarioBase || 0),
                        horasExtras: Number(data.horasExtras || 0),
                        percentualExtra: Number(data.percentualExtra || 0),
                        bonificacoes: Number(data.bonificacoes || 0),
                        periculosidade: Number(data.periculosidade || 0),
                        adicionalNoturno: Number(data.adicionalNoturno || 0),
                        insalubridade: data.insalubridade ?? null,
                        faltas: Number(data.faltas || 0),
                        vales: Number(data.vales || 0),
                        outrosDescontos: Number(data.outrosDescontos || 0),
                        dependentes: Number(data.dependentes || data.quantidadeFilhos || 0),
                        tipoFolha: String(data.tipo || data.tipoPagamento || 'mes'),
                        percentualQuinzena: Number(data.percentualQuinzena || data.quinzenaPercentual || 50),
                        quinzenaPercentual: Number(data.quinzenaPercentual || data.percentualQuinzena || 50),
                        valorManualQuinzena: Number(data.quinzenaValorManual || data.valorManualQuinzena || 0) || null,
                        diasTrabalhados: (data.diasTrabalhados != null) ? Number(data.diasTrabalhados) : null,
                        premioAssiduidade: Number(data.premioAssiduidade || 0),
                        descontoRepousoRemunerado: Number(data.descontoRepousoRemunerado || 0),
                        descontoINSSManual: Number(data.descontoINSSManual || 0),
                        contribuicaoConfederativa: Number(data.contribuicaoConfederativa || 0),
                        contribuicaoSindical: Number(data.contribuicaoSindical || 0),
                        descontoIRPJ: Number(data.descontoIRPJ || 0),
                        emprestimoConsignado: Number(data.emprestimoConsignado || 0),
                        quantidadeFilhos: Number(data.quantidadeFilhos || data.dependentes || 0),
                        usarSalarioBrutoParaQuinzena: Boolean(data.usarSalarioBrutoParaQuinzena || false),
                        tipoContrato: String((data.funcionario && data.funcionario.tipoContrato) || data.tipoContrato || '').toLowerCase()
                    };
                    const r = window.FolhaCalculos.calcularFolhaCompleta(dados);
                    data.calculos = {
                        valorHorasExtras: (r && r.calculos && r.calculos.valorHorasExtras) || 0,
                        valorSalarioFamilia: (r && r.calculos && r.calculos.valorSalarioFamilia) || 0,
                        calculoINSS: (r && r.inss) || null,
                        calculoIRRF: (r && r.irrf) || null,
                        salarioBase: (r && r.salarioBase) || dados.salarioBase
                    };
                }
            } catch (e) {
                console.warn('⚠️ Falha ao preparar calculos na criação:', e);
            }
            
            // ✅ CORREÇÃO: Forçar limpeza de cálculos automáticos no update se a flag estiver ativa
            // O objeto data.calculos pode vir preenchido do cálculo completo acima.
            // Se removerCalculosAutomaticos=true, precisamos zerar inss e irrf DENTRO de data.calculos antes de salvar
            
            if (data.removerCalculosAutomaticos && data.calculos) {
                if (data.calculos.calculoINSS) {
                    data.calculos.calculoINSS.valor = 0;
                    data.calculos.calculoINSS.baseCalculo = 0;
                }
                // Compatibilidade com estrutura antiga/alternativa
                if (data.calculos.inss) {
                    data.calculos.inss.valor = 0;
                    data.calculos.inss.baseCalculo = 0;
                }
                
                if (data.calculos.calculoIRRF) {
                    data.calculos.calculoIRRF.valor = 0;
                    data.calculos.calculoIRRF.baseCalculo = 0;
                }
                if (data.calculos.irrf) {
                    data.calculos.irrf.valor = 0;
                    data.calculos.irrf.baseCalculo = 0;
                }
                
                // FGTS (opcional, mas bom zerar se for auto)
                // O FGTS é 8%, mas se for removido auto, o valor manual deve prevalecer.
                // Não zeramos FGTS aqui pois ele é salvo como campo raiz, não dentro de calculos obrigatoriamente.
            }

            // --- FIM DA PREPARAÇÃO DE DADOS ---

            // 🔄 LÓGICA DE SALVAMENTO ATUALIZADA (OFFLINE-FIRST)
            let newId = data.id;
            
            // Gerar ID se não existir
            if (!newId) {
                try {
                    // Tentar gerar ID compatível com Firebase
                    // Se estiver online ou com SDK carregado
                    if (window.database) {
                        const { ref, push } = await import('../firebase/sdk/firebase-database.js');
                        newId = push(ref(window.database, 'folhas')).key;
                    }
                } catch(e) {}
                
                // Fallback para ID offline se falhar geração do SDK
                if (!newId) {
                    newId = 'off_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
                }
            }
            data.id = newId;
            
            try { if (data && data.mesAno) { data.mesAno = this._normalizeMes(data.mesAno); } } catch {}
            try { data.dataCriacao = new Date().toISOString(); } catch {}

            // ✅ USAR O MANAGER PARA SALVAR (Gerencia fila offline)
            if (window.saveData) {
                await window.saveData(`folhas/${newId}`, data);
                console.log('✅ Lançamento enviado para manager:', newId);
            } else {
                // Fallback crítico (nunca deve acontecer se carregar scripts)
                console.error('❌ window.saveData não disponível');
                throw new Error('Sistema de salvamento não inicializado');
            }

            // Atualizar caches locais imediatamente
            try {
                const novo = { ...data };
                if (Array.isArray(this.lancamentos)) {
                    const idxLocal = this.lancamentos.findIndex(l => String((l && (l.id || l.key)) || '') === String(newId));
                    if (idxLocal >= 0) this.lancamentos[idxLocal] = { ...this.lancamentos[idxLocal], ...novo };
                    else this.lancamentos.push(novo);
                } else {
                    this.lancamentos = [novo];
                }
                if (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) {
                    const idxSys = window.folhaSystem.folhas.findIndex(l => String((l && (l.id || l.key)) || '') === String(newId));
                    if (idxSys >= 0) window.folhaSystem.folhas[idxSys] = { ...window.folhaSystem.folhas[idxSys], ...novo };
                    else window.folhaSystem.folhas.push(novo);
                }
                this._fechadasCache.items = this._filtrarFechadas(this.lancamentos);
                this._fechadasCache.lastUpdated = Date.now();
                
                try { window.dispatchEvent(new CustomEvent('folhas:updated', { detail: { total: (this.lancamentos||[]).length, source: 'createLancamento' } })); } catch(e) {}
                
                try {
                    if (window.folhaFiltros && typeof window.folhaFiltros.aplicarFiltros === 'function') {
                        setTimeout(() => window.folhaFiltros.aplicarFiltros(), 50);
                    }
                } catch (e) {}
            } catch(e) { console.warn('⚠️ Falha ao atualizar caches após criação:', e); }
            
            return newId;
        } catch (error) {
            throw new Error('Erro ao criar lançamento: ' + error.message);
        }
    }
    
    async updateLancamento(data) {
        console.log('🔄 Atualizando lançamento (via Manager):', data);
        try {
            if (window.UIAuth && typeof window.UIAuth.isAuthenticated === 'function') {
                const authed = !!window.UIAuth.isAuthenticated();
                if (!authed) throw new Error('Autenticação necessária para salvar');
            }

            // Preparação dos dados (mantendo lógica original)
            if (!data || typeof data !== 'object') data = {};
            this._ensureEditLancamentoIdentity(data);
            this._syncFuncionarioAtivoFlag(data);
            if (!(typeof data.status === 'string' && data.status.trim())) delete data.status;

            // --- INÍCIO DA CÓPIA DA LÓGICA DE RESOLUÇÃO ---
            try {
                const resolveId = (x) => {
                    try { return String((x && x.funcionario && x.funcionario.id) || x.funcionarioId || x.idFuncionario || x.func_id || ''); } catch { return ''; }
                };
                const norm = (s) => { try { return String(s||'').toLowerCase().trim().normalize('NFD').replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' '); } catch { return ''; } };
                const getById = (id) => {
                    try {
                        if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) {
                            const f = window.folhaSystem.funcionarios.find(ff => String(ff.id) === String(id));
                            if (f) return f;
                        }
                        if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                            const f2 = window.folhaFuncionarios.funcionarios.find(ff => String(ff.id) === String(id));
                            if (f2) return f2;
                        }
                    } catch {}
                    return null;
                };
                const getByName = (name) => {
                    const alvo = norm(name);
                    if (!alvo) return null;
                    try {
                        if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) {
                            const f = window.folhaSystem.funcionarios.find(ff => norm(ff.nome) === alvo);
                            if (f) return f;
                        }
                        if (window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                            const f2 = window.folhaFuncionarios.funcionarios.find(ff => norm(ff.nome) === alvo);
                            if (f2) return f2;
                        }
                    } catch {}
                    return null;
                };
                const fid = resolveId(data);
                if (!data.funcionario || typeof data.funcionario !== 'object') data.funcionario = {};
                if (fid) {
                    data.funcionario.id = data.funcionario.id || fid;
                    if (!data.funcionario.nome) {
                        const found = getById(fid);
                        if (found) {
                            try {
                                data.funcionario.nome = found.nome || data.funcionario.nome || '';
                                data.funcionario.cargo = data.funcionario.cargo || found.cargo || '';
                                data.funcionario.tipoContrato = data.funcionario.tipoContrato || found.tipoContrato || found.funcionarioTipoContrato || '';
                                const sb = Number(found.salarioBase || found.salario || 0) || 0;
                                if (sb > 0 && !data.funcionario.salarioBase) data.funcionario.salarioBase = sb;
                            } catch {}
                        }
                    }
                } else {
                    const nomeRaw = (data.funcionario && data.funcionario.nome) || '';
                    if (nomeRaw) {
                        const foundByName = getByName(nomeRaw);
                        if (foundByName) {
                            try {
                                data.funcionario.id = foundByName.id;
                                data.funcionario.nome = foundByName.nome || data.funcionario.nome || '';
                                data.funcionario.cargo = data.funcionario.cargo || foundByName.cargo || '';
                                data.funcionario.tipoContrato = data.funcionario.tipoContrato || foundByName.tipoContrato || foundByName.funcionarioTipoContrato || '';
                                const sb2 = Number(foundByName.salarioBase || foundByName.salario || 0) || 0;
                                if (sb2 > 0 && !data.funcionario.salarioBase) data.funcionario.salarioBase = sb2;
                            } catch (e) {}
                        }
                    }
                }
                if (!data.mesAno) {
                    try {
                        const ms = document.getElementById('folhaMesAno');
                        if (ms && ms.value) data.mesAno = ms.value;
                    } catch {}
                }
            } catch {}
            this._syncFuncionarioAtivoFlag(data);
            const __clean2 = (obj) => { Object.keys(obj).forEach((k)=>{ const v=obj[k]; if (v===undefined) { delete obj[k]; } else if (v && typeof v==='object' && !Array.isArray(v)) { obj[k]=__clean2(v); } }); return obj; };
            data = __clean2(data);
            
            // Cálculos (mantidos)
            try {
                if (window.FolhaCalculos && typeof window.FolhaCalculos.calcularFolhaCompleta === 'function') {
                    const dados = {
                        salarioBase: Number(data.funcionario && data.funcionario.salarioBase || data.salarioBase || 0),
                        horasExtras: Number(data.horasExtras || 0),
                        percentualExtra: Number(data.percentualExtra || 0),
                        bonificacoes: Number(data.bonificacoes || 0),
                        periculosidade: Number(data.periculosidade || 0),
                        adicionalNoturno: Number(data.adicionalNoturno || 0),
                        insalubridade: data.insalubridade ?? null,
                        faltas: Number(data.faltas || 0),
                        vales: Number(data.vales || 0),
                        outrosDescontos: Number(data.outrosDescontos || 0),
                        dependentes: Number(data.dependentes || data.quantidadeFilhos || 0),
                        tipoFolha: String(data.tipo || data.tipoPagamento || 'mes'),
                        percentualQuinzena: Number(data.percentualQuinzena || data.quinzenaPercentual || 50),
                        quinzenaPercentual: Number(data.quinzenaPercentual || data.percentualQuinzena || 50),
                        valorManualQuinzena: Number(data.quinzenaValorManual || data.valorManualQuinzena || 0) || null,
                        diasTrabalhados: (data.diasTrabalhados != null) ? Number(data.diasTrabalhados) : null,
                        premioAssiduidade: Number(data.premioAssiduidade || 0),
                        descontoRepousoRemunerado: Number(data.descontoRepousoRemunerado || 0),
                        descontoINSSManual: Number(data.descontoINSSManual || 0),
                        contribuicaoConfederativa: Number(data.contribuicaoConfederativa || 0),
                        contribuicaoSindical: Number(data.contribuicaoSindical || 0),
                        descontoIRPJ: Number(data.descontoIRPJ || 0),
                        emprestimoConsignado: Number(data.emprestimoConsignado || 0),
                        quantidadeFilhos: Number(data.quantidadeFilhos || data.dependentes || 0),
                        usarSalarioBrutoParaQuinzena: Boolean(data.usarSalarioBrutoParaQuinzena || false),
                        tipoContrato: String((data.funcionario && data.funcionario.tipoContrato) || data.tipoContrato || '').toLowerCase()
                    };
                    const r = window.FolhaCalculos.calcularFolhaCompleta(dados);
                    data.calculos = {
                        valorHorasExtras: (r && r.calculos && r.calculos.valorHorasExtras) || 0,
                        valorSalarioFamilia: (r && r.calculos && r.calculos.valorSalarioFamilia) || 0,
                        calculoINSS: (r && r.inss) || null,
                        calculoIRRF: (r && r.irrf) || null,
                        salarioBase: (r && r.salarioBase) || dados.salarioBase
                    };
                }
            } catch (e) {
                console.warn('⚠️ Falha ao preparar calculos na atualização:', e && e.message ? e.message : e);
            }
            
            // --- FIM DA PREPARAÇÃO DE DADOS ---

            // Garantir ID
            if (!data.id) {
                try { 
                    const idEl = document.getElementById('folhaId'); 
                    if (idEl && idEl.value) data.id = idEl.value; 
                } catch {}
            }
            if (!data.id) throw new Error('ID não identificado para atualização');

            try { if (data && data.mesAno) { data.mesAno = this._normalizeMes(data.mesAno); } } catch {}
            try { data.updatedAt = new Date().toISOString(); } catch {}

            // ✅ USAR O MANAGER PARA SALVAR (Gerencia fila offline)
            if (window.saveData) {
                await window.saveData(`folhas/${data.id}`, data);
                console.log('✅ Lançamento atualizado via manager:', data.id);
            } else {
                console.error('❌ window.saveData não disponível');
                throw new Error('Sistema de salvamento não inicializado');
            }

            this.showNotification('Folha atualizada com sucesso!', 'success');
            
            // Atualizar caches locais imediatamente
            try {
                if (Array.isArray(this.lancamentos)) {
                    const idx = this.lancamentos.findIndex(l => String((l && (l.id || l.key)) || '') === String(data.id));
                    if (idx >= 0) {
                        this.lancamentos[idx] = { ...this.lancamentos[idx], ...data };
                    } else {
                        this.lancamentos.push({ ...data });
                    }
                }
                if (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) {
                    const i2 = window.folhaSystem.folhas.findIndex(l => String((l && (l.id || l.key)) || '') === String(data.id));
                    if (i2 >= 0) {
                        window.folhaSystem.folhas[i2] = { ...window.folhaSystem.folhas[i2], ...data };
                    } else {
                        window.folhaSystem.folhas.push({ ...data });
                    }
                }
                
                // Atualizar cache de fechadas
                this._fechadasCache.items = this._filtrarFechadas(this.lancamentos);
                this._fechadasCache.lastUpdated = Date.now();
                
                // Atualizar modal se estiver aberto
                const modal = document.getElementById('folhasFechadasModal');
                if (modal && modal.style.display === 'block' && typeof this.filtrarFolhasFechadas === 'function') {
                    this.filtrarFolhasFechadas();
                }
            } catch (e) {
                console.warn('⚠️ Falha ao atualizar caches locais após update:', e);
            }
            
            try {
                window.dispatchEvent(new CustomEvent('folhas:updated', { detail: { total: (this.lancamentos||[]).length, source: 'updateLancamento' } }));
            } catch (e) {}
            
        } catch (error) {
            throw new Error('Erro ao atualizar lançamento: ' + error.message);
        }
    }

    // 🗑️ Excluir folha por ID (classe)
    async excluirFolha(folhaId) {
        try {
            if (!folhaId) { this.showNotification('ID inválido para exclusão', 'error'); return; }
            
            const confirma = typeof confirm === 'function' ? confirm('Confirma excluir esta folha? Esta ação não pode ser desfeita.') : true;
            if (!confirma) return;
            
            // ✅ USAR O MANAGER PARA DELETAR (saveData com null)
            if (window.saveData) {
                await window.saveData(`folhas/${folhaId}`, null);
                console.log('✅ Solicitação de exclusão enviada ao manager:', folhaId);
            } else {
                throw new Error('Sistema de salvamento não inicializado');
            }

            // Atualizar cache local
            if (Array.isArray(this.lancamentos)) {
                this.lancamentos = this.lancamentos.filter(l => (l.id || l.key) !== folhaId);
            }
            // ✅ Sincronizar sistema principal
            if (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) {
                window.folhaSystem.folhas = window.folhaSystem.folhas.filter(l => (l.id || l.key) !== folhaId);
            }
            // Atualizar cache de fechadas
            this._fechadasCache.items = this._filtrarFechadas(this.lancamentos);
            this._fechadasCache.lastUpdated = Date.now();
            // ✅ Padronizar evento no 'window' para que listeners captem e recarreguem
            try { window.dispatchEvent(new CustomEvent('folhas:updated', { detail: { source: 'excluirFolha' } })); } catch {}
            this.showNotification('Folha excluída com sucesso', 'success');
        } catch (e) {
            console.error('❌ Erro ao excluir folha:', e);
            this.showNotification('Erro ao excluir folha: ' + (e && e.message ? e.message : e), 'error');
        }
    }
    
    // Atualizar openEditFolhaModal para usar o fillFolhaForm completo e remover setTimeout redundante, já que agora está no fill
    // No código existente, integrar ao openEditFolhaModal

    setupCalculoRealTime() {
        console.log('🧮 Configurando cálculo em tempo real...');
        // Debounce helper para evitar recálculo excessivo em eventos de input
        if (!this.scheduleCalcularFolhaRealTime) {
            this._calcRTTimer = null;
            this.scheduleCalcularFolhaRealTime = (delay = 180) => {
                try { if (this._calcRTTimer) clearTimeout(this._calcRTTimer); } catch {}
                this._calcRTTimer = setTimeout(() => {
                    try { this.calcularFolhaRealTime(); } catch (e) { console.warn('⚠️ Falha no recálculo debounced:', e); }
                }, delay);
            };
        }
        const idsInput = [
            'folhaDiasTrabalhados','folhaHorasExtras','folhaPercentualExtra','folhaPremioAssiduidade','folhaBonificacoes',
            'folhaQtdFilhos','folhaSalarioFamilia','folhaFaltas','folhaVales','folhaDescRepousoRemunerado',
            'folhaDescontoINSSManual','folhaContribuicaoConfederativa','folhaContribuicaoSindical','folhaDescontoIRPJ',
            'folhaEmprestimoConsignado','folhaOutrosDescontos','funcionarioSalario','quinzenaValorManual'
        ];
        const idsChange = ['quinzenaPercentual','folhaTipoPagamento','folhaMesAno','usarSalarioBrutoParaQuinzena'];
        const bind = (id, type='input') => {
            const el = document.getElementById(id);
            if (!el || el._calcBound) return;
            el.addEventListener(type, () => this.scheduleCalcularFolhaRealTime());
            // Alguns navegadores disparam recálculo somente em change para inputs number
            if (type === 'input') {
                el.addEventListener('change', () => this.scheduleCalcularFolhaRealTime());
            }
            // Criar exibição auxiliar em PT-BR (sem afetar valor do input)
            if (!el._ptbrDisplay) {
                const disp = document.createElement('div');
                disp.className = 'ptbr-display';
                disp.style.cssText = 'font-size:12px;color:#555;margin-top:2px;';
                // Inserir após o input
                if (el.parentNode) {
                    el.parentNode.insertBefore(disp, el.nextSibling);
                }
                el._ptbrDisplay = disp;
            }
            el._calcBound = true;
            // Recalcular imediatamente ao vincular
            try { this.calcularFolhaRealTime(); } catch {}
        };
        idsInput.forEach(id => bind(id, 'input'));
        idsChange.forEach(id => bind(id, 'change'));

        // Listener específico para o Toggle de Remover Cálculos
        const toggleAuto = document.getElementById('folhaRemoverCalculosAutomaticos');
        if (toggleAuto) {
            toggleAuto.addEventListener('change', () => {
                const checked = toggleAuto.checked;
                // Se ativado (Remover), zerar campos unificados
                if (checked) {
                    const zerar = (id) => {
                        const el = document.getElementById(id);
                        if (el) { el.value = '0'; if(el._ptbrDisplay) el._ptbrDisplay.textContent = 'R$ 0,00'; }
                    };
                    zerar('folhaDescontoINSSManual');
                    zerar('folhaDescontoIRRFManual');
                    zerar('folhaDescontoFGTS');
                }
                // Forçar recálculo para atualizar labels e totais
                this.calcularFolhaRealTime();
            });
        }

        // Toggle de badges de cálculo (info)
        const bindToggleBadge = (toggleId, badgeId) => {
            const t = document.getElementById(toggleId);
            const b = document.getElementById(badgeId);
            if (!t || !b || t._boundToggle) return;
            t.addEventListener('click', () => {
                const visible = b.style.display === 'block';
                b.style.display = visible ? 'none' : 'block';
                t.classList.toggle('active', !visible);
                // Garantir conteúdo atualizado ao abrir
                if (!visible) {
                    try { this.calcularFolhaRealTime(); } catch {}
                }
            });
            t._boundToggle = true;
        };
        bindToggleBadge('heInfoToggle','heCalcBadge');
        bindToggleBadge('sfInfoToggle','sfCalcBadge');
        bindToggleBadge('faltasInfoToggle','faltasCalcBadge');
        bindToggleBadge('diagInfoToggle','diagCalcBadge');
    }

    toggleQuinzenaOptions() {
        console.log('🔄 Alternando opções de quinzena...');
        const tipoSel = document.getElementById('folhaTipoPagamento');
        const opts = document.getElementById('quinzenaOptions');
        const isQz = (tipoSel && String(tipoSel.value).toLowerCase() === 'quinzena');
        if (opts) opts.style.display = isQz ? 'block' : 'none';
        // ✅ Ao mudar para Quinzena sem percentual definido, aplicar default 50%
        try {
            const qzInput = document.getElementById('quinzenaPercentual');
            if (isQz && qzInput) {
                const raw = String(qzInput.value || '').trim();
                const num = Number(raw);
                if (!raw || isNaN(num) || num <= 0) {
                    qzInput.value = '50';
                    console.log('🎯 Percentual de quinzena ajustado para 50% (default)');
                }
            }
        } catch (e) { console.warn('⚠️ Falha ao ajustar percentual de quinzena:', e); }
        // Recalcular após alterar exibição
        try { this.toggleValorManual(); } catch {}
        try { this.calcularFolhaRealTime(); } catch {}
    }

    toggleValorManual() {
        console.log('🔄 Alternando valor manual...');
        const percSel = document.getElementById('quinzenaPercentual');
        const manualGroup = document.getElementById('valorManualGroup');
        const isManual = percSel && String(percSel.value).toLowerCase() === 'manual';
        if (manualGroup) manualGroup.style.display = isManual ? 'block' : 'none';
        try { this.calcularFolhaRealTime(); } catch {}
    }

    updateModoCumulativoDescription() {
        console.log('📝 Atualizando descrição do modo cumulativo...');
    }

    calcularFolhaRealTime() {
        if (this._isHydratingForm) return;
        console.log('🧮 Calculando folha em tempo real...');
        const parsePtBrNumber = (raw) => {
            const s = String(raw || '').trim();
            if (!s) return 0;
            // Remover R$ e espaços
            const n1 = s.replace(/[^0-9,.-]/g, '');
            // Se tiver vírgula, tratar como decimal; remover pontos (separador de milhar)
            if (n1.includes(',')) {
                const n2 = n1.replace(/\./g, '').replace(/,/g, '.');
                const f = parseFloat(n2);
                return isNaN(f) ? 0 : f;
            }
            const f = parseFloat(n1);
            return isNaN(f) ? 0 : f;
        };
        const getNum = (id) => { const el = document.getElementById(id); const v = el ? parsePtBrNumber(el.value || 0) : 0; return isNaN(v) ? 0 : v; };
        const fmt = (v) => {
            try { return (window.FolhaUtils && window.FolhaUtils.formatarMoeda) ? window.FolhaUtils.formatarMoeda(v) : v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); } catch { return `R$ ${Number(v||0).toFixed(2)}`; }
        };
        // Salário base: preferir da folha atual ou do funcionário
        const folha = this.lancamentoAtual || {};
        const salarioBaseInput = getNum('funcionarioSalario');
        const salarioBase = (salarioBaseInput && salarioBaseInput > 0)
            ? salarioBaseInput
            : Number(folha.salarioBase || (folha.funcionario && folha.funcionario.salarioBase) || 0);
        const bonificacoes = getNum('folhaBonificacoes');
        const premioAssiduidade = getNum('folhaPremioAssiduidade');
        const horasExtras = getNum('folhaHorasExtras');
        const percExtra = getNum('folhaPercentualExtra');
        // Horas Extras: usar cálculo oficial quando disponível
        let valorExtra = 0;
        if (salarioBase > 0 && horasExtras > 0 && percExtra > 0) {
            const salarioHora = salarioBase / 220;
            try {
                if (window.FolhaCalculos && typeof window.FolhaCalculos.calcularHorasExtras === 'function') {
                    valorExtra = Number(window.FolhaCalculos.calcularHorasExtras(horasExtras, percExtra, salarioHora)) || (salarioHora * horasExtras * (1 + percExtra/100));
                } else {
                    // Fallback com arredondamento por etapa (peculiaridade)
                    const round2 = v => Math.round(v*100)/100;
                    const horaNormal = round2(salarioHora);
                    const valorHoraExtra = round2(horaNormal * (1 + percExtra/100));
                    valorExtra = round2(valorHoraExtra * horasExtras);
                }
            } catch (e) {
                const round2 = v => Math.round(v*100)/100;
                const horaNormal = round2(salarioHora);
                const valorHoraExtra = round2(horaNormal * (1 + percExtra/100));
                valorExtra = round2(valorHoraExtra * horasExtras);
            }
            // Log discreto
            try { if (window.__folhaLogExtras) console.log(`🧮 [HE Modal] Base=${salarioBase} | Hora=${(salarioHora).toFixed(6)} | Perc=${percExtra}% | Horas=${horasExtras} | Extra=R$ ${valorExtra.toFixed(2)}`); } catch {}
        }
        const qtdFilhos = getNum('folhaQtdFilhos');
        // Salário Família: refletir automaticamente conforme dependentes e base
        let salarioFamilia = getNum('folhaSalarioFamilia');
        try {
            const dependentes = getNum('folhaQtdFilhos');
            const diasTrab = getNum('folhaDiasTrabalhados') || null;
            if (window.FolhaCalculos && typeof window.FolhaCalculos.calcularSalarioFamilia === 'function') {
                const valorSF = Number(window.FolhaCalculos.calcularSalarioFamilia(dependentes, salarioBase, diasTrab)) || 0;
                salarioFamilia = valorSF;
                const sfInput = document.getElementById('folhaSalarioFamilia');
                if (sfInput) {
                    sfInput.value = String(valorSF.toFixed(2));
                    if (sfInput._ptbrDisplay) sfInput._ptbrDisplay.textContent = fmt(valorSF);
                }
            } else {
                // Fallback básico quando motor não está disponível
                try {
                    const cota = 65.00;
                    const elegivel = salarioBase > 0 && salarioBase <= 1906.04;
                    const propor = (Number.isFinite(diasTrab) && diasTrab > 0) ? (diasTrab / 30) : 1;
                    const valorSF = elegivel ? (cota * dependentes * propor) : 0;
                    salarioFamilia = Number.isFinite(valorSF) ? valorSF : 0;
                    const sfInput = document.getElementById('folhaSalarioFamilia');
                    if (sfInput) {
                        sfInput.value = String((salarioFamilia).toFixed(2));
                        if (sfInput._ptbrDisplay) sfInput._ptbrDisplay.textContent = fmt(salarioFamilia);
                    }
                } catch {}
            }
        } catch (e) {}
        const faltasDias = getNum('folhaFaltas');
        let descRepouso = getNum('folhaDescRepousoRemunerado');
        // Calcular desconto faltas (com fallback usando dias trabalhados)
        const diasTrabVal = getNum('folhaDiasTrabalhados');
        const diasMensais = 30;
        let faltasCalc = faltasDias;
        if ((!faltasCalc || faltasCalc <= 0) && Number.isFinite(diasTrabVal) && diasTrabVal > 0) {
            faltasCalc = Math.max(0, diasMensais - diasTrabVal);
        }
        const baseAjustadaParaFaltas = Math.max(0, salarioBase - (descRepouso || 0));
        let descontoFaltas = 0;
        if (baseAjustadaParaFaltas > 0 && faltasCalc > 0) {
            if (window.FolhaCalculos && typeof window.FolhaCalculos.calcularDescontoFaltas === 'function') {
                descontoFaltas = Number(window.FolhaCalculos.calcularDescontoFaltas(baseAjustadaParaFaltas, faltasCalc) || 0);
            } else {
                const diaria = baseAjustadaParaFaltas / 30;
                descontoFaltas = Math.round((diaria * faltasCalc) * 100) / 100;
            }
        }
        const vales = getNum('folhaVales');
        const outrosDescontos = getNum('folhaOutrosDescontos');
        let descINSSManual = getNum('folhaDescontoINSSManual');
        let confed = getNum('folhaContribuicaoConfederativa');
        let sindical = getNum('folhaContribuicaoSindical');
        let irpj = getNum('folhaDescontoIRRFManual'); // Ajustado para novo ID
        let empr = getNum('folhaEmprestimoConsignado');
        const tipo = (document.getElementById('folhaTipoPagamento') && document.getElementById('folhaTipoPagamento').value) || 'mes';
        const usarBruto = !!(document.getElementById('usarSalarioBrutoParaQuinzena') && document.getElementById('usarSalarioBrutoParaQuinzena').checked);
        const removerCalculosAuto = !!(document.getElementById('folhaRemoverCalculosAutomaticos') && document.getElementById('folhaRemoverCalculosAutomaticos').checked);
        
        const baseQuinzena = usarBruto ? (salarioBase + bonificacoes) : salarioBase;
        const percRawEl = document.getElementById('quinzenaPercentual');
        const percRawVal = percRawEl ? String(percRawEl.value || '').toLowerCase() : '';
        let percQuinzena = 0;
        if (percRawVal && percRawVal !== 'manual') {
            percQuinzena = Number(percRawVal) || 0;
        }
        let valorQuinzena = 0;
        if (tipo === 'quinzena') {
            if (percRawVal === 'manual') {
                valorQuinzena = getNum('quinzenaValorManual');
            } else if (baseQuinzena > 0 && percQuinzena > 0) {
                valorQuinzena = baseQuinzena * (percQuinzena/100);
            }
        }
        
        // INSS/IRRF alinhados ao motor oficial (mesma base de encargos)
        // Preferir cálculo integrado para manter consistência com a tabela
        let inss = 0, irrf = 0;
        if (salarioBase > 0 && window.FolhaCalculos) {
            try {
                // ✅ Obter contrato do input diretamente (prioridade para dados frescos)
                let contratoRaw = '';
                const funcInput = document.getElementById('folhaFuncionario');
                if (funcInput && funcInput.dataset.funcionarioData) {
                    try {
                        const fd = JSON.parse(funcInput.dataset.funcionarioData);
                        contratoRaw = String(fd.tipoContrato || fd.funcionarioTipoContrato || '').toLowerCase();
                    } catch {}
                }
                if (!contratoRaw) {
                    contratoRaw = String((folha.funcionario && folha.funcionario.tipoContrato) || '').toLowerCase();
                }
                console.log('🧮 Preparando cálculo real-time. Contrato:', contratoRaw);
                
                const dadosCalc = {
                    salarioBase: salarioBase,
                    horasExtras: horasExtras,
                    percentualExtra: percExtra,
                    bonificacoes: bonificacoes,
                    faltas: faltasCalc || 0,
                    vales: vales || 0,
                    outrosDescontos: outrosDescontos || 0,
                    dependentes: qtdFilhos || 0,
                    quantidadeFilhos: qtdFilhos || 0,
                    tipoFolha: tipo || 'mes',
                    diasTrabalhados: (Number.isFinite(diasTrabVal) ? diasTrabVal : null),
                    premioAssiduidade: premioAssiduidade || 0,
                    descontoRepousoRemunerado: descRepouso || 0,
                    descontoINSSManual: descINSSManual || 0,
                    contribuicaoConfederativa: confed || 0,
                    contribuicaoSindical: sindical || 0,
                    descontoIRPJ: irpj || 0,
                    emprestimoConsignado: empr || 0,
                    tipoContrato: contratoRaw,
                    removerCalculosAutomaticos: removerCalculosAuto
                };
                const r = window.FolhaCalculos.calcularFolhaCompleta(dadosCalc);
                inss = (r && r.inss && r.inss.valor) || 0;
                irrf = (r && r.irrf && r.irrf.valor) || 0;
                
                // ✅ Atualizar campos visuais de cálculo automático (Unificado)
                try {
                    const elINSS = document.getElementById('folhaDescontoINSSManual');
                    const elIRRF = document.getElementById('folhaDescontoIRRFManual');
                    const elFGTS = document.getElementById('folhaDescontoFGTS');
                    const labelINSS = document.getElementById('labelINSS') || document.querySelector('label[for="folhaDescontoINSSManual"]');
                    const labelIRRF = document.getElementById('labelIRRF') || document.querySelector('label[for="folhaDescontoIRRFManual"]');
                    const labelFGTS = document.getElementById('labelFGTS') || document.querySelector('label[for="folhaDescontoFGTS"]');

                    if (removerCalculosAuto) {
                        // Modo Manual (Sem Cálculos Automáticos)
                        if (labelINSS) labelINSS.innerHTML = '<i class="fas fa-edit"></i> INSS (Manual):';
                        if (labelIRRF) labelIRRF.innerHTML = '<i class="fas fa-edit"></i> IRRF (Manual):';
                        if (labelFGTS) labelFGTS.innerHTML = '<i class="fas fa-edit"></i> FGTS (Manual):';
                        
                        // Valores dependem exclusivamente do input do usuário (não sobrescrevemos aqui)
                        // A limpeza inicial é feita pelo listener do toggle
                    } else {
                        // Modo Automático (Calculado + Editável)
                        if (labelINSS) labelINSS.innerHTML = '<i class="fas fa-calculator"></i> INSS (Auto):';
                        if (labelIRRF) labelIRRF.innerHTML = '<i class="fas fa-calculator"></i> IRRF (Auto):';
                        if (labelFGTS) labelFGTS.innerHTML = '<i class="fas fa-calculator"></i> FGTS (8%):';

                        // Preencher campos com valores calculados se não estiverem focados (sincronização reativa)
                        if (elINSS && document.activeElement !== elINSS) {
                            elINSS.value = inss > 0 ? inss.toFixed(2) : '0,00';
                            if(elINSS._ptbrDisplay) elINSS._ptbrDisplay.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inss);
                            // Atualizar variável local para o cálculo final bater com o visual
                            descINSSManual = inss; 
                        }
                        
                        if (elIRRF && document.activeElement !== elIRRF) {
                            elIRRF.value = irrf > 0 ? irrf.toFixed(2) : '0,00';
                            if(elIRRF._ptbrDisplay) elIRRF._ptbrDisplay.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(irrf);
                            // Atualizar variável local
                            irpj = irrf;
                        }

                        if (elFGTS && document.activeElement !== elFGTS) {
                            // Calcular FGTS (Base Bruta * 8%)
                            const baseFGTS = (r && r.salarioBruto) ? r.salarioBruto : (salarioBase + bonificacoes + valorExtra + premioAssiduidade);
                            const valFGTS = baseFGTS * 0.08;
                            
                            elFGTS.value = valFGTS > 0 ? valFGTS.toFixed(2) : '0,00';
                            if(elFGTS._ptbrDisplay) elFGTS._ptbrDisplay.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valFGTS);
                        }
                    }
                } catch(e) { console.warn('Erro ao atualizar UI unificada:', e); }
            } catch (e) {
                console.warn('⚠️ Erro no cálculo real-time:', e);
            }
        } // Fechamento do if (salarioBase > 0 && window.FolhaCalculos)

            // Bruto/Acréscimos/Descontos/Líquido
            const bruto = salarioBase;
            const acrescimosLegacy = bonificacoes + valorExtra + salarioFamilia + premioAssiduidade;
            
            // Definição final dos descontos de impostos (prioriza valor do input/variável atualizada)
            let inssFinal = descINSSManual; 
            let irrfFinal = irpj;
            
            // Se estiver removendo cálculos automáticos, usar apenas o valor manual (sem soma de automático)
            // Mas descINSSManual já está capturando o valor do input (que é o total visível)
            // O problema é que 'inssFinal' é somado a outros descontos.
            // Se inss > 0 (automático), ele pode estar sendo somado em algum lugar?
            // Não, inss e irrf são calculados apenas para preencher os campos.
            // A variável 'inss' (linha 1821) guarda o valor automático calculado AGORA.
            // Se 'removerCalculosAuto' for true, 'inss' e 'irrf' não são zerados explicitamente no bloco acima,
            // mas os campos visuais são.
            // POREM, se o bloco 'if (salarioBase > 0 && window.FolhaCalculos)' for executado,
            // ele calcula 'inss' e 'irrf' baseados no contrato.
            // Se 'removerCalculosAutomaticos' for passado para o backend, ele deve retornar 0.
            // Vamos verificar se a variável local 'inss' e 'irrf' estão zeradas quando removerCalculosAuto é true.
            
            if (removerCalculosAuto) {
                // Forçar zero nas variáveis locais automáticas se a flag estiver ativa
                inss = 0;
                irrf = 0;
                // E garantir que os finais usem apenas o valor manual (que já está em descINSSManual/irpj)
                // Se o usuário digitou 0, será 0.
            } else {
                // Se automático ativo, descINSSManual e irpj contêm o valor DO INPUT.
                // O input, por sua vez, foi atualizado para (inssAuto + ajuste).
                // Então descINSSManual JÁ É o total final.
            }
            
            // Garantir consistência
            inssFinal = descINSSManual;
            irrfFinal = irpj;
            
            const descontos = inssFinal + irrfFinal + vales + outrosDescontos + descontoFaltas + descRepouso + confed + sindical + empr;
            
            // Para quinzena: líquido da 2ª quinzena = (Base + Acréscimos − Descontos − 1ª Quinzena)
            const liquido = (tipo === 'quinzena')
                ? (bruto + acrescimosLegacy - descontos - valorQuinzena)
                : (bruto + acrescimosLegacy - descontos);
            
            // Atualizar UI
            const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmt(v); };
            setText('resumoBruto', bruto);
            setText('resumoQuinzena', valorQuinzena);


        // Alinhar cálculo do modal com FolhaUtils para evitar divergências
        let lanc = (this.collectLancamentoData && typeof this.collectLancamentoData === 'function') ? this.collectLancamentoData() : {};
        
        // ✅ Obter contrato para garantir isenção correta nos cálculos visuais
        const contratoRawForDisplay = (function() {
             const funcInput = document.getElementById('folhaFuncionario');
             let c = '';
             // Prioridade 1: Dataset (dados frescos da seleção)
             if (funcInput && funcInput.dataset.funcionarioData) {
                 try {
                     const fd = JSON.parse(funcInput.dataset.funcionarioData);
                     c = String(fd.tipoContrato || fd.funcionarioTipoContrato || '');
                 } catch {}
             }
             // Prioridade 2: Estado interno do lançamento
             if (!c) c = (folha.funcionario && folha.funcionario.tipoContrato) || '';
             
             // Prioridade 3: Fallback - buscar na lista global pelo nome (caso dataset falhe)
             if (!c && funcInput && funcInput.value && window.folhaFuncionarios && window.folhaFuncionarios.funcionarios) {
                 const fEncontrado = window.folhaFuncionarios.funcionarios.find(f => f.nome === funcInput.value);
                 if (fEncontrado) c = fEncontrado.tipoContrato || '';
             }
             
             return String(c).toLowerCase();
        })();

        lanc = {
            ...lanc,
            funcionario: {
                ...(folha.funcionario || lanc.funcionario || {}),
                tipoContrato: contratoRawForDisplay
            },
            salarioBase: salarioBase,
            tipo: tipo,
            tipoPagamento: tipo
        };
        try {
            if (window.FolhaCalculos && typeof window.FolhaCalculos.calcularFolhaCompleta === 'function') {
                const dadosCalc = {
                    salarioBase: salarioBase,
                    horasExtras: horasExtras,
                    percentualExtra: percExtra,
                    bonificacoes: bonificacoes,
                    faltas: faltasCalc || 0,
                    vales: vales || 0,
                    outrosDescontos: outrosDescontos || 0,
                    dependentes: qtdFilhos || 0,
                    quantidadeFilhos: qtdFilhos || 0,
                    tipoFolha: tipo || 'mes',
                    diasTrabalhados: (Number.isFinite(diasTrabVal) ? diasTrabVal : null),
                    premioAssiduidade: premioAssiduidade || 0,
                    descontoRepousoRemunerado: descRepouso || 0,
                    descontoINSSManual: descINSSManual || 0,
                    contribuicaoConfederativa: confed || 0,
                    contribuicaoSindical: sindical || 0,
                    descontoIRPJ: irpj || 0,
                    emprestimoConsignado: empr || 0,
                    tipoContrato: contratoRawForDisplay, // Reutilizar a variável calculada acima
                    removerCalculosAutomaticos: removerCalculosAuto // ✅ Passar flag para o cálculo final
                };
                lanc.calculos = window.FolhaCalculos.calcularFolhaCompleta(dadosCalc);
                
                // Se removerCalculosAutomaticos=true, garantir que lanc.calculos reflita isso (valores zerados)
                if (removerCalculosAuto) {
                    if (lanc.calculos.inss) lanc.calculos.inss.valor = 0;
                    if (lanc.calculos.irrf) lanc.calculos.irrf.valor = 0;
                }
            }
        } catch {}
        // Unificar exibição de Acréscimos com a tabela, usando FolhaUtils
        const acrescimosDisplay = (window.FolhaUtils && typeof window.FolhaUtils.calcularAcrescimosDisplay === 'function')
            ? window.FolhaUtils.calcularAcrescimosDisplay(lanc)
            : acrescimosLegacy;
        setText('resumoAcrescimos', acrescimosDisplay);
        
        // CORREÇÃO CRÍTICA: Total Descontos deve usar estritamente a soma dos inputs visíveis quando em modo manual
        // A função FolhaUtils.calcularDescontosDisplay tende a recalcular usando o motor se 'calculos' estiver presente
        // Se removerCalculosAutomaticos=true, lanc.calculos.inss e irrf foram zerados acima, mas vamos garantir
        // que o valor exibido seja consistente com a soma manual.
        
        let descontosDisplay;
        if (removerCalculosAuto) {
            // Soma direta dos componentes manuais (que são os totais neste modo)
            const somaManual = (lanc.descontoINSSManual || 0) + 
                               (lanc.descontoIRRFManual || 0) + // ou descontoIRPJ
                               (vales || 0) +
                               (lanc.outrosDescontos || 0) + 
                               // Faltas aqui sempre em R$, nunca em dias.
                               // O campo lanc.faltas representa dias e não deve entrar na soma monetária.
                               descontoFaltas +
                               (lanc.descontoRepousoRemunerado || 0) + 
                               (lanc.contribuicaoConfederativa || 0) + 
                               (lanc.contribuicaoSindical || 0) + 
                               (lanc.emprestimoConsignado || 0);
                               
            descontosDisplay = fmt(somaManual);
        } else {
            // Modo automático: usar FolhaUtils ou soma local
            descontosDisplay = (window.FolhaUtils && typeof window.FolhaUtils.calcularDescontosDisplay === 'function') ? window.FolhaUtils.calcularDescontosDisplay(lanc) : descontos;
        }

        const liquidoDisplay = (window.FolhaUtils && typeof window.FolhaUtils.calcularSalarioLiquidoDisplay === 'function') ? window.FolhaUtils.calcularSalarioLiquidoDisplay(lanc) : liquido;

        setText('resumoDescontos', descontosDisplay);
        setText('resumoLiquido', liquidoDisplay);
        const faltasTotalEl = document.getElementById('folhaTotalFaltas');
        if (faltasTotalEl) {
            const arred = Math.round(descontoFaltas * 100) / 100;
            faltasTotalEl.value = String(arred.toFixed(2));
            if (faltasTotalEl._ptbrDisplay) faltasTotalEl._ptbrDisplay.textContent = fmt(arred);
        }

        // Atualizar exibição PT-BR auxiliar para inputs monetários
        try {
            const idsMonetarios = ['folhaBonificacoes','folhaPremioAssiduidade','folhaSalarioFamilia','folhaVales','folhaDescRepousoRemunerado','folhaDescontoINSSManual','folhaContribuicaoConfederativa','folhaContribuicaoSindical','folhaDescontoIRRFManual','folhaEmprestimoConsignado','folhaOutrosDescontos','funcionarioSalario'];
            idsMonetarios.forEach(id => {
                const el = document.getElementById(id);
                if (!el || !el._ptbrDisplay) return;
                const val = getNum(id);
                el._ptbrDisplay.textContent = fmt(val);
            });
            // Exibição especial: Horas Extras deve mostrar o valor monetário calculado abaixo do input
            const heInput = document.getElementById('folhaHorasExtras');
            if (heInput && heInput._ptbrDisplay) {
                heInput._ptbrDisplay.textContent = fmt(valorExtra);
            }
        } catch (e) { console.warn('⚠️ Falha ao atualizar exibição PT-BR de inputs:', e); }

        // Atualizar badges de cálculo (se estiverem visíveis, mas atualizamos conteúdo sempre)
        try {
            const round2 = v => Math.round(v*100)/100;
            const horaNormal = round2(salarioBase > 0 ? (salarioBase/220) : 0);
            const valorHoraExtraUnit = round2(horaNormal * (1 + (percExtra/100)));
            const heBadge = document.getElementById('heCalcBadge');
            if (heBadge) {
                heBadge.innerHTML = `
                  <span class="calc-pill">Hora normal: R$ ${horaNormal.toFixed(2)}</span>
                  <span class="calc-pill">Hora extra ${percExtra}%: R$ ${valorHoraExtraUnit.toFixed(2)}</span>
                  <span class="calc-pill">Total HE: R$ ${valorExtra.toFixed(2)}</span>
                `;
            }
            const sfBadge = document.getElementById('sfCalcBadge');
            if (sfBadge) {
                const cota = 65.00;
                const elegivel = salarioBase > 0 && salarioBase <= 1906.04;
                const propor = (Number.isFinite(diasTrabVal) && diasTrabVal > 0) ? `${diasTrabVal}/${diasMensais}` : `—/${diasMensais}`;
                sfBadge.innerHTML = `
                  <span class="calc-pill">Dependentes: ${qtdFilhos}</span>
                  <span class="calc-pill">Cota: R$ ${cota.toFixed(2)}</span>
                  <span class="calc-pill">Elegível: ${elegivel ? 'Sim' : 'Não'}</span>
                  <span class="calc-pill">Proporção: ${propor}</span>
                  <span class="calc-pill">SF: R$ ${salarioFamilia.toFixed(2)}</span>
                `;
            }
            const faltasBadge = document.getElementById('faltasCalcBadge');
            if (faltasBadge) {
                const diaria = round2(salarioBase > 0 ? (salarioBase/30) : 0);
                faltasBadge.innerHTML = `
                  <span class="calc-pill">Diária base: R$ ${diaria.toFixed(2)}</span>
                  <span class="calc-pill">Faltas: ${faltasCalc || 0}</span>
                  <span class="calc-pill">Total: R$ ${descontoFaltas.toFixed(2)}</span>
                `;
            }
        } catch (e) { console.warn('⚠️ Falha ao atualizar badges de cálculo:', e); }

        // Badge de diagnóstico: comparar descontos do modal vs. cálculo padronizado da tabela
        try {
            const diagBadge = document.getElementById('diagCalcBadge');
            if (diagBadge) {
                // Construir uma folha de referência com cálculos completos
                let r = null;
                if (window.FolhaCalculos && typeof window.FolhaCalculos.calcularFolhaCompleta === 'function') {
                    try {
                        const dadosCalc = {
                            salarioBase: salarioBase,
                            horasExtras: horasExtras,
                            percentualExtra: percExtra,
                            bonificacoes: bonificacoes,
                            faltas: faltasCalc || 0,
                            vales: vales || 0,
                            outrosDescontos: outrosDescontos || 0,
                            dependentes: qtdFilhos || 0,
                            quantidadeFilhos: qtdFilhos || 0,
                            tipoFolha: tipo || 'mes',
                            diasTrabalhados: (Number.isFinite(diasTrabVal) ? diasTrabVal : null),
                            premioAssiduidade: premioAssiduidade || 0,
                            descontoRepousoRemunerado: descRepouso || 0,
                            descontoINSSManual: descINSSManual || 0,
                            contribuicaoConfederativa: confed || 0,
                            contribuicaoSindical: sindical || 0,
                            descontoIRPJ: irpj || 0,
                            emprestimoConsignado: empr || 0,
                            removerCalculosAutomaticos: removerCalculosAuto // ✅ Passar flag para o cálculo de referência
                        };
                        r = window.FolhaCalculos.calcularFolhaCompleta(dadosCalc);
                    } catch {}
                }
                const folhaBase = this.lancamentoAtual || {};
                const folhaTabela = {
                    ...folhaBase,
                    calculos: r || (folhaBase && folhaBase.calculos) || {},
                    salarioBase: salarioBase,
                    vales: vales,
                    outrosDescontos: outrosDescontos,
                    faltas: faltasCalc,
                    descontoRepousoRemunerado: descRepouso,
                    descontoINSSManual: descINSSManual,
                    contribuicaoConfederativa: confed,
                    contribuicaoSindical: sindical,
                    descontoIRPJ: irpj,
                    emprestimoConsignado: empr,
                    tipoPagamento: tipo
                };
                // Modal: calcular via FolhaUtils com os dados atuais do modal
                const descontosModal = (window.FolhaUtils && typeof window.FolhaUtils.calcularDescontosDisplay === 'function') 
                    ? window.FolhaUtils.calcularDescontosDisplay(folhaTabela) 
                    : descontos;
                // Tabela: ler do DOM quando possível, com fallback para FolhaUtils
                let descontosTabela = 0;
                try {
                    const rowSelId = (folhaBase.id || folhaBase.key || folhaBase.recordId || '');
                    const row = document.querySelector(`tr[data-id="${rowSelId}"]`);
                    if (row) {
                        const attr = row.getAttribute('data-descontos-total');
                        if (attr != null && String(attr).trim() !== '') {
                            descontosTabela = parsePtBrNumber(attr);
                        } else {
                            const tds = row.querySelectorAll('td');
                            if (tds && tds.length >= 8 && tds[7]) {
                                descontosTabela = parsePtBrNumber(tds[7].textContent);
                            } else {
                                descontosTabela = Number((window.FolhaUtils && window.FolhaUtils.calcularDescontosDisplay) ? window.FolhaUtils.calcularDescontosDisplay(folhaTabela) : 0);
                            }
                        }
                    } else {
                        descontosTabela = Number((window.FolhaUtils && window.FolhaUtils.calcularDescontosDisplay) ? window.FolhaUtils.calcularDescontosDisplay(folhaTabela) : 0);
                    }
                } catch (e) {
                    descontosTabela = Number((window.FolhaUtils && window.FolhaUtils.calcularDescontosDisplay) ? window.FolhaUtils.calcularDescontosDisplay(folhaTabela) : 0);
                }
                // Alinhar Δ ao que é exibido (2 casas decimais) para evitar 3,13 vs 3,12
                const round2 = v => Math.round(Number(v) * 100) / 100;
                const modalRounded = round2(descontosModal);
                const tabelaRounded = round2(descontosTabela);
                const diff = round2(modalRounded - tabelaRounded);
                const contrato = String((folhaBase && folhaBase.funcionario && folhaBase.funcionario.tipoContrato) || '').toLowerCase() || '—';
                diagBadge.innerHTML = `
                  <span class="calc-pill">Modal: ${fmt(modalRounded)}</span>
                  <span class="calc-pill">Tabela: ${fmt(tabelaRounded)}</span>
                  <span class="calc-pill">Δ: ${fmt(diff)}</span>
                  <span class="calc-pill">Tipo: ${String(tipo || '').toLowerCase()}</span>
                  <span class="calc-pill">Vínculo: ${contrato}</span>
                `;
            }
        } catch (e) { console.warn('⚠️ Falha ao atualizar badge de diagnóstico:', e); }
    }

    // ✅ Desabilitar/zerar inputs de encargos quando contrato do lançamento não for CLT
    applyEncargoRestrictionsByLancamento() {
        try {
            const folha = this.lancamentoAtual || {};
            const raw = (folha.funcionario && folha.funcionario.tipoContrato) || '';
            const norm = String(raw || '')
                .toLowerCase()
                .trim()
                .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
            
            // Lógica unificada com folha-calculos.js
            const vinculosIsentos = ['temporario', 'terceirizado', 'estagio', 'estagiario', 'pj', 'autonomo'];
            const isIsento = vinculosIsentos.some(v => norm === v || norm.includes(v));
            const isCLT = !isIsento && (norm === '' || norm === 'clt' || norm.includes('clt') || norm.includes('efetivo') || norm.includes('carteira'));
            
            console.log(`🔒 Verificando restrições de encargos: Contrato="${raw}" -> Isento=${isIsento}, CLT=${isCLT}`);

            // ✅ Desabilitar/zerar inputs de encargos quando contrato do lançamento não for CLT ou quando removerCalculosAutomaticos estiver ativo
            const removerAuto = document.getElementById('folhaRemoverCalculosAutomaticos') && document.getElementById('folhaRemoverCalculosAutomaticos').checked;
            
            const ids = ['folhaDescRepousoRemunerado','folhaDescontoINSSManual','folhaContribuicaoConfederativa','folhaContribuicaoSindical','folhaDescontoIRRFManual','folhaDescontoFGTS','folhaEmprestimoConsignado'];
            ids.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                
                // Se for isento OU se o usuário optou por remover cálculos automáticos, zera e desabilita (ou apenas zera?)
                // O usuário pediu: "ao Selecionar Remover calculos automaticos remover tambem dos campos ja existentes tabem"
                // Interpretando: zerar os campos e talvez desabilitar.
                // Mas "remover calculos automaticos" geralmente se refere aos implícitos (INSS/IRRF de tabela).
                // Se ele quer remover dos "campos já existentes" (manuais), então zeramos também.
                
                // Nova lógica:
                // 1. Se contrato for ISENTO (PJ, Estágio): Força zero e desabilita.
                // 2. Se for CLT mas "Remover Cálculos" marcado: Zera os campos manuais também?
                //    O pedido diz "remover tambem dos campos ja existentes". Vou assumir que ele quer limpar os valores.
                //    Mas talvez não desabilitar, para permitir edição manual se quiser.
                //    Porém, "remover cálculos automáticos" sugere que o sistema não deve preencher nada.
                //    Vou zerar os valores se a checkbox for marcada AGORA (evento change), mas aqui no applyRestricoes
                //    vamos apenas verificar a isenção legal.
                
                const shouldDisable = isIsento; 
                
                // Se o usuário optou por remover, não desabilitamos, apenas limpamos
                // Se isento, desabilitamos.
                el.disabled = isIsento;
                try { el.readOnly = false; } catch {}
                
                if (shouldDisable || removerAuto) {
                    if (removerAuto) {
                        // Se removerAuto, apenas zera o valor visualmente se for o momento de carga/toggle
                        // Mas não bloqueia edição se não for isento
                        // No entanto, se o usuário escrever algo e o toggle estiver ON, o que acontece?
                        // Idealmente, toggle ON = "modo sem cálculos".
                    }
                    if (isIsento) {
                        el.value = '0';
                        if (el._ptbrDisplay) el._ptbrDisplay.textContent = 'R$ 0,00';
                        el.classList.add('input-disabled-calc');
                    }
                } else {
                    el.classList.remove('input-disabled-calc');
                }
            });
            
            // Listener específico para o checkbox de remover cálculos
            const toggleRemover = document.getElementById('folhaRemoverCalculosAutomaticos');
            if (toggleRemover && !toggleRemover._boundClear) {
                toggleRemover.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        // Zerar campos unificados (manuais/auto)
                        // Incluir FGTS na lista de limpeza
                        const allIds = [...ids, 'folhaDescontoFGTS'];
                        allIds.forEach(id => {
                            const el = document.getElementById(id);
                            if (el && !el.disabled) {
                                el.value = '0';
                                if (el._ptbrDisplay) el._ptbrDisplay.textContent = 'R$ 0,00';
                            }
                        });
                        this.scheduleCalcularFolhaRealTime();
                    } else {
                        // Recalcular para restaurar automáticos
                        this.scheduleCalcularFolhaRealTime();
                    }
                });
                toggleRemover._boundClear = true;
            }
            
            if (isIsento) {
                console.log('🔒 Contrato isento de encargos automáticos. Inputs desabilitados.');
            } else {
                this.ensureEncargoFieldsEnabledForCLT();
            }
        } catch (e) {
            console.warn('⚠️ Falha ao aplicar restrições de encargos por lançamento:', e);
        }
    }

    ensureEncargoFieldsEnabledForCLT() {
        const ids = ['folhaDescRepousoRemunerado','folhaDescontoINSSManual','folhaContribuicaoConfederativa','folhaContribuicaoSindical','folhaDescontoIRRFManual','folhaEmprestimoConsignado'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            try { el.disabled = false; } catch {}
            try { el.readOnly = false; } catch {}
            try { el.removeAttribute('disabled'); } catch {}
            try { el.removeAttribute('aria-disabled'); } catch {}
            try { el.classList.remove('disabled'); } catch {}
        });
    }

    // Adicionar método setupEventListeners similar a outros módulos para configurar submit do form sem duplicação
    setupEventListeners() {
        // Evitar configuração dupla
        if (this._eventListenersConfigured) {
            console.log('⚠️ Event listeners de lançamentos já configurados, pulando...');
            return;
        }
        
        // Aguardar DOM
        setTimeout(() => {
            console.log('🎯 Configurando event listeners de lançamentos...');
            
            const folhaForm = document.getElementById('folhaForm');
        if (folhaForm) {
            console.log('✅ Configurando event listener para folhaForm');
            
            // Verificar se já configurado
            if (folhaForm._lancamentosListenerConfigured) {
                console.log('⚠️ Event listener de lançamento já configurado, pulando...');
                this._eventListenersConfigured = true;
                return;
            }
            
            // Remover existing onsubmit
            folhaForm.onsubmit = null;
            
            // Adicionar listener
            folhaForm.addEventListener('submit', (e) => {
                console.log('📝 Submit do formulário de folha capturado');
                e.preventDefault();
                this.handleFolhaSubmit(e);
            });
            
            // Marcar como configurado
            folhaForm._lancamentosListenerConfigured = true;
            
            // Configurar botão save para chamar handler diretamente (evitar submit duplo)
            const saveFolhaBtn = document.getElementById('saveFolhaBtn');
            if (saveFolhaBtn) {
                console.log('🔘 Configurando botão de salvar folha');
                
                // Limpar existing onclick
                saveFolhaBtn.onclick = null;
                const newBtn = saveFolhaBtn.cloneNode(true);
                saveFolhaBtn.parentNode.replaceChild(newBtn, saveFolhaBtn);
                
                newBtn.addEventListener('click', (e) => {
                    console.log('🔘 Botão salvar folha clicado');
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleFolhaSubmit(e);
                });
                newBtn._lancamentosSaveBound = true;
            }
        } else {
            console.warn('⚠️ folhaForm não encontrado');
        }
        
        // Remover onchange inline e configurar listeners de mudança programáticos
        try {
            const tipoSelect = document.getElementById('folhaTipoPagamento');
            if (tipoSelect) {
                tipoSelect.removeAttribute('onchange');
                tipoSelect.addEventListener('change', () => this.toggleQuinzenaOptions());
            }
            const percSelect = document.getElementById('quinzenaPercentual');
            if (percSelect) {
                percSelect.removeAttribute('onchange');
                percSelect.addEventListener('change', () => { this.toggleValorManual(); this.scheduleCalcularFolhaRealTime(); });
            }
            // Bind recalcular em tempo real
            const bindCalc = (id) => { const el = document.getElementById(id); if (el && !el._calcBound) { el.addEventListener('input', () => this.scheduleCalcularFolhaRealTime()); el._calcBound = true; } };
            ['folhaDiasTrabalhados','folhaHorasExtras','folhaPercentualExtra','folhaPremioAssiduidade','folhaBonificacoes','folhaQtdFilhos','folhaSalarioFamilia','folhaFaltas','folhaVales','folhaDescRepousoRemunerado','folhaDescontoINSSManual','folhaContribuicaoConfederativa','folhaContribuicaoSindical','folhaDescontoIRPJ','folhaEmprestimoConsignado','folhaOutrosDescontos','quinzenaPercentual','folhaTipoPagamento','quinzenaValorManual','usarSalarioBrutoParaQuinzena'].forEach(bindCalc);

            // ✅ Garantir que seleção de funcionário preencha o campo correto e atualize dados
            const funcInput = document.getElementById('folhaFuncionario');
            if (funcInput && !funcInput._funcBound) {
                funcInput.addEventListener('focus', () => {
                    funcInput.dataset.lastFocused = 'true';
                    if (window.folhaFuncionarios) window.folhaFuncionarios.targetField = 'folhaFuncionario';
                });
                const applyFuncionarioChange = () => {
                    const dataStr = funcInput.dataset.funcionarioData || '';
                    console.log('🔄 Aplicando mudança de funcionário:', dataStr ? 'Dados encontrados' : 'Sem dados');
                    try {
                        const dados = dataStr ? JSON.parse(dataStr) : null;
                        if (dados) {
                            const tipoContrato = dados.tipoContrato || dados.funcionarioTipoContrato || dados.contrato || undefined;
                            console.log('👤 Funcionário selecionado:', dados.nome, 'Contrato:', tipoContrato);
                            
                            this.lancamentoAtual.funcionario = {
                                id: dados.id,
                                nome: dados.nome,
                                salarioBase: Number(dados.salarioBase || dados.salario || 0) || 0,
                                tipoContrato: tipoContrato,
                                cargo: dados.cargo || undefined
                            };
                            this.lancamentoAtual.salarioBase = this.lancamentoAtual.funcionario.salarioBase || 0;
                            const salEl = document.getElementById('funcionarioSalario');
                            if (salEl && this.lancamentoAtual.funcionario.salarioBase > 0) {
                                salEl.value = this.lancamentoAtual.funcionario.salarioBase;
                            }
                            
                            // Forçar atualização da interface de encargos imediatamente
                            try { 
                                this.applyEncargoRestrictionsByLancamento(); 
                            } catch (e) {
                                console.warn('⚠️ Erro ao aplicar restrições:', e);
                            }
                            
                            try { this.ensureEncargoFieldsEnabledForCLT(); } catch {}
                            this.scheduleCalcularFolhaRealTime();
                        }
                    } catch (e) {
                        console.warn('⚠️ Falha ao aplicar dados de funcionário selecionado:', e);
                    }
                };
                funcInput.addEventListener('change', applyFuncionarioChange);
                funcInput.addEventListener('input', () => {
                    if (!funcInput.value) {
                        funcInput.dataset.funcionarioId = '';
                        funcInput.dataset.funcionarioData = '';
                        this.lancamentoAtual.funcionario = { nome: '' };
                    }
                });
                try {
                    const icon = funcInput.parentElement && funcInput.parentElement.querySelector('.autocomplete-icon');
                    if (icon) {
                        icon.onclick = null;
                        const newIcon = icon.cloneNode(true);
                        icon.parentNode.replaceChild(newIcon, icon);
                        newIcon.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            funcInput.dataset.lastFocused = 'true';
                            if (window.folhaFuncionarios) window.folhaFuncionarios.targetField = 'folhaFuncionario';
                            if (window.openFuncionariosListModal) window.openFuncionariosListModal();
                        });
                    }
                } catch (e) {
                    console.warn('⚠️ Não foi possível ajustar ícone de lista de funcionários:', e);
                }
                funcInput._funcBound = true;
            }
        } catch (e) {
            console.warn('⚠️ Falha ao configurar listeners de mudança de selects:', e);
        }

        // Só marcar como configurado se o formulário foi realmente encontrado e listeners adicionados
        if (folhaForm) {
            this._eventListenersConfigured = true;
            console.log('✅ Event listeners de lançamentos configurados');
        } else {
            this._eventListenersConfigured = false;
            setTimeout(() => {
                console.log('🔁 Retentando configuração de event listeners de lançamentos...');
                this.setupEventListeners();
            }, 400);
        }
    }, 100);
}

// Garantir que o botão de salvar está vinculado mesmo se listeners iniciais não rodaram
ensureSaveButtonBound() {
    const folhaForm = document.getElementById('folhaForm');
    if (folhaForm && !folhaForm._lancamentosListenerConfigured) {
        folhaForm.addEventListener('submit', (e) => {
            console.log('📝 Submit do formulário (ensure)');
            e.preventDefault();
            this.handleFolhaSubmit(e);
        });
        folhaForm._lancamentosListenerConfigured = true;
    }
    const saveBtn = document.getElementById('saveFolhaBtn');
    if (saveBtn && !saveBtn._lancamentosSaveBound) {
        saveBtn.onclick = null;
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        
        newBtn.addEventListener('click', (e) => {
            console.log('🔘 Botão salvar folha (ensure)');
            e.preventDefault();
            e.stopPropagation();
            this.handleFolhaSubmit(e);
        });
        newBtn._lancamentosSaveBound = true;
    }
}
// Método removido daqui, pois deve estar dentro da classe

    // Implementar validateLancamentoData básico
    validateLancamentoData(data) {
    if (!data.funcionario || !String(data.funcionario.nome || '').trim()) {
        alert('Funcionário é obrigatório');
        return false;
    }
    const funcId = String((data.funcionario && data.funcionario.id) || '').trim();
    if (!funcId) {
        alert('Selecione o funcionário na lista');
        return false;
    }
    const salarioBaseVal = Number((data.funcionario && data.funcionario.salarioBase) || data.salarioBase || 0);
    if (!Number.isFinite(salarioBaseVal) || salarioBaseVal <= 0) {
        alert('Salário base deve ser maior que zero');
        return false;
    }
    const tpRaw = String(data.tipoPagamento || '').toLowerCase();
    const tpNorm = tpRaw.includes('quinz') ? 'quinzena' : 'mes';
    if (!data.tipo || String(data.tipo).toLowerCase() !== tpNorm) data.tipo = tpNorm;
    if (!data.tipoPagamento || String(data.tipoPagamento).toLowerCase() !== tpNorm) data.tipoPagamento = tpNorm;
    data.tipoFolha = tpNorm;
    if (tpNorm === 'mes') {
        data.quinzenaValorManual = 0;
        data.percentualQuinzena = 100;
        data.quinzenaPercentual = 100;
        data.percentual = 100;
    }
    if (!String(data.mesAno || '').trim()) {
        alert('Mês/Ano é obrigatório');
        return false;
    }
    if (Array.isArray(data.valesDetalhados)) {
        const valeIncompleto = data.valesDetalhados.find(item => (item.data || item.observacao) && !(Number(item.valor || 0) > 0));
        if (valeIncompleto) {
            alert('Informe o valor do vale ou remova a linha incompleta.');
            return false;
        }
    }
    return true;
}

    // Adicionar método handleFolhaSubmit para gerenciar salvamento, similar a outros módulos
    async handleFolhaSubmit(event) {
        event.preventDefault();
        if (this._savingFolha) return;
        this._savingFolha = true;
        console.log('💾 Submetendo formulário de folha');
        try {
            if (window.UIAuth && typeof window.UIAuth.isAuthenticated === 'function') {
                const authed = !!window.UIAuth.isAuthenticated();
                if (!authed) {
                    try { window.UIAuth.redirectToLogin && window.UIAuth.redirectToLogin('save_requires_auth'); } catch {}
                    return;
                }
            }
            if (!window.database) {
                alert('Firebase indisponível no momento. Aguarde inicialização ou faça login.');
                return;
            }
        } catch(e) { /* silencioso */ }

        try {
            const data = this.collectLancamentoData();
            this._ensureEditLancamentoIdentity(data);
            this._syncFuncionarioAtivoFlag(data);
            if (!data.id && this.isEditMode) {
                const cur = this.lancamentoAtual || {};
                data.id = cur.id || cur.key || '';
                if (!data.id && Array.isArray(this.lancamentos)) {
                    const nomeRef = String((data.funcionario && data.funcionario.nome) || '').trim().toLowerCase();
                    const mesRef = String(data.mesAno || '').trim();
                    const found = this.lancamentos.find(l => {
                        const nome = String((l && l.funcionario && l.funcionario.nome) || '').trim().toLowerCase();
                        const mes = String((l && l.mesAno) || '').trim();
                        return nomeRef && mesRef && nome === nomeRef && mes === mesRef;
                    });
                    if (found) data.id = found.id || found.key || '';
                }
            }
            const isValid = this.validateLancamentoData(data);
            if (!isValid) return;

            let id = data.id;
            if (id) {
                await this.updateLancamento(data);
            } else {
                id = await this.createLancamento(data);
            }

            this.closeFolhaModal();
            // Notificar sistema principal para recarregar dados
            // ✅ Padronizar evento no 'window'
            try { window.dispatchEvent(new CustomEvent('folhas:updated', { detail: { source: 'handleFolhaSubmit' } })); } catch {}
            console.log('✅ Folha salva e evento disparado');
        } catch (error) {
            console.error('❌ Erro ao salvar folha:', error);
            alert('Erro ao salvar: ' + error.message);
        } finally {
            this._savingFolha = false;
        }
    }
} // Fechamento correto da classe FolhaLancamentos

// 🔧 Inicialização fora da classe (export correto da instância)
console.log('🔍 [DEBUG] Inicializando folha-lancamentos.js...');
window.folhaLancamentos = new FolhaLancamentos();
console.log('✅ [DEBUG] window.folhaLancamentos criado:', window.folhaLancamentos);

// Adicionar funções recuperadas como globais, baseadas em contexto e padrões do sistema
// Verificado: não existem definições atuais, adicionando de forma segura sem duplicação

async function __findLancamentoById(id) {
    // Preferir dataset do sistema
    let l = (window.folhaSystem && Array.isArray(window.folhaSystem.folhas))
        ? window.folhaSystem.folhas.find(f => (f.id || f.key) === id)
        : null;
    if (!l && window.folhaLancamentos && Array.isArray(window.folhaLancamentos.lancamentos)) {
        l = window.folhaLancamentos.lancamentos.find(x => (x.id || x.key) === id);
    }
    if (!l && window.database) {
        try {
            const { ref, get } = await import('../firebase/sdk/firebase-database.js');
            const resolvePath = (p) => {
                try {
                    if (window.folhaLancamentos && typeof window.folhaLancamentos._resolvePath === 'function') {
                        return window.folhaLancamentos._resolvePath(p);
                    }
                } catch {}
                return p;
            };
            const primaryPath = resolvePath(`folhas/${id}`);
            let snap = await get(ref(window.database, primaryPath));
            if (!snap.exists() && primaryPath !== `folhas/${id}`) {
                snap = await get(ref(window.database, `folhas/${id}`));
            }
            if (snap.exists()) {
                l = { id, ...(snap.val() || {}) };
            }
        } catch (e) { console.warn('⚠️ Fallback Firebase findById falhou:', e); }
    }
    return l || null;
}

function __getFinanceService() {
    const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
    if (svc && typeof svc.loadFromFirebase === 'function' && typeof svc.saveToFirebase === 'function') {
        return svc;
    }
    if (typeof window.getData === 'function' && typeof window.saveData === 'function') {
        return {
            loadFromFirebase: async (path) => {
                try {
                    const data = await window.getData(path, { useCache: false, forceRefresh: true, debounceMs: 0 });
                    return { success: true, data, source: 'manager' };
                } catch (e) {
                    return { success: false, error: (e && e.message) || String(e), source: 'manager' };
                }
            },
            saveToFirebase: async (path, key, data) => {
                try {
                    const finalPath = key ? `${String(path).replace(/\/+$/,'')}/${String(key)}` : String(path);
                    await window.saveData(finalPath, data, { requireAuth: true });
                    return { success: true, key: key ? String(key) : null, source: 'manager' };
                } catch (e) {
                    return { success: false, error: (e && e.message) || String(e), source: 'manager' };
                }
            }
        };
    }
    return null;
}

function __normalizeMesAnoLocal(m) {
    try {
        if (window.FolhaUtils && typeof window.FolhaUtils.normalizeMesAno === 'function') {
            return window.FolhaUtils.normalizeMesAno(m);
        }
    } catch {}
    const s = String(m || '').trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    const m1 = s.match(/^(\d{2})\/(\d{4})$/);
    if (m1) return `${m1[2]}-${m1[1]}`;
    const m2 = s.match(/^(\d{4})[\/-](\d{2})$/);
    if (m2) return `${m2[1]}-${m2[2]}`;
    return new Date().toISOString().slice(0, 7);
}

function __pad2(n) {
    return String(n).padStart(2, '0');
}

function __getMonthKeyFromLancamento(lancamento) {
    return __normalizeMesAnoLocal(lancamento && lancamento.mesAno);
}

function __getDataVencimento(lancamento, kind) {
    const mesKey = __getMonthKeyFromLancamento(lancamento);
    const [y, m] = mesKey.split('-').map(Number);
    if (!y || !m) return new Date().toISOString().slice(0, 10);
    if (kind === 'quinzena') {
        return `${y}-${__pad2(m)}-15`;
    }
    const lastDay = new Date(y, m, 0);
    return `${lastDay.getFullYear()}-${__pad2(lastDay.getMonth() + 1)}-${__pad2(lastDay.getDate())}`;
}

function __getMesAnoRef(mesAno) {
    const norm = __normalizeMesAnoLocal(mesAno);
    const parts = String(norm || '').split('-');
    if (parts.length === 2) return `${__pad2(parts[1])}-${parts[0]}`;
    return norm;
}

function __extractPxNumber(value) {
    const s = String(value || '').trim().toUpperCase();
    const m = s.match(/^PX0*([0-9]+)$/);
    return m ? Number(m[1]) : NaN;
}

async function __getNextPxNumero(svc, mesKey) {
    let max = 0;
    try {
        const resRoot = await svc.loadFromFirebase('financas/pagar');
        if (resRoot && resRoot.success && resRoot.data) {
            const data = resRoot.data;
            const pushNum = (n) => { if (Number.isFinite(n) && n > max) max = n; };
            if (Array.isArray(data)) {
                data.forEach(c => pushNum(__extractPxNumber(c && (c.pedidoNumero || c.numero || c.documento))));
            } else if (typeof data === 'object') {
                Object.entries(data).forEach(([k, v]) => {
                    if (/^\d{4}-\d{2}$/.test(k) && v && typeof v === 'object') {
                        Object.values(v).forEach(c => pushNum(__extractPxNumber(c && (c.pedidoNumero || c.numero || c.documento))));
                    } else if (v && typeof v === 'object' && (v.pedidoNumero || v.numero)) {
                        pushNum(__extractPxNumber(v.pedidoNumero || v.numero));
                    }
                });
            }
        }
    } catch {}
    if (max === 0 && mesKey) {
        try {
            const resMonth = await svc.loadFromFirebase(`financas/pagar/${mesKey}`);
            const arr = (resMonth && resMonth.success && resMonth.data)
                ? (Array.isArray(resMonth.data) ? resMonth.data : Object.values(resMonth.data || {}))
                : [];
            arr.forEach(c => {
                const n = __extractPxNumber(c && (c.pedidoNumero || c.numero || c.documento));
                if (Number.isFinite(n) && n > max) max = n;
            });
        } catch {}
    }
    const next = max + 1;
    return `PX${String(next).padStart(6, '0')}`;
}

function __resolveTipoPagamento(lancamento) {
    try {
        if (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function') {
            return window.FolhaUtils.resolveTipoPagamento(lancamento);
        }
    } catch {}
    return String((lancamento && (lancamento.tipoPagamento || lancamento.tipo || lancamento.tipoFolha)) || 'mes').toLowerCase();
}

function __normalizeStatusLocal(status) {
    try {
        if (window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function') {
            return window.FolhaUtils.normalizarStatus(status);
        }
    } catch {}
    if (typeof status === 'object' && status) {
        return String(status.value || status.status || status.nome || '').trim();
    }
    return String(status || '').trim();
}

function __toNumber(v) {
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
}

function __getLiquidoLancamento(lancamento) {
    try {
        if (window.FolhaUtils && typeof window.FolhaUtils.calcularSalarioLiquidoDisplay === 'function') {
            const v = window.FolhaUtils.calcularSalarioLiquidoDisplay(lancamento);
            if (Number.isFinite(v)) return v;
        }
    } catch {}
    const direct = __toNumber(lancamento && (lancamento.salarioLiquido || lancamento.salarioLiquidoFinal || lancamento.valorLiquido || (lancamento.calculos && (lancamento.calculos.salarioLiquido || lancamento.calculos.salarioLiquidoFinal || lancamento.calculos.liquido))));
    if (Number.isFinite(direct)) return direct;
    const base = __toNumber(lancamento && (lancamento.salarioBase || (lancamento.calculos && lancamento.calculos.salarioBase)));
    const acres = __toNumber(lancamento && (lancamento.totalAcrescimos || lancamento.acrescimos || (lancamento.calculos && lancamento.calculos.totalAcrescimos)));
    const desc = __toNumber(lancamento && (lancamento.totalDescontos || lancamento.descontos || (lancamento.calculos && lancamento.calculos.totalDescontos)));
    const quinz = __toNumber(lancamento && (lancamento.quinzenaValorManual || lancamento.valorQuinzena || (window.FolhaUtils && window.FolhaUtils.calcularValorQuinzena ? window.FolhaUtils.calcularValorQuinzena(lancamento) : 0)));
    const tipo = __resolveTipoPagamento(lancamento);
    return (Number(base || 0) + Number(acres || 0) - Number(desc || 0) - (tipo === 'quinzena' ? Number(quinz || 0) : 0));
}

function __getValorFinanceiroLancamento(lancamento, kind) {
    if (kind === 'quinzena' && __resolveTipoPagamento(lancamento) === 'quinzena') {
        try {
            if (window.FolhaUtils && typeof window.FolhaUtils.calcularValorQuinzena === 'function') {
                const valorQuinzena = Number(window.FolhaUtils.calcularValorQuinzena(lancamento) || 0);
                if (Number.isFinite(valorQuinzena) && valorQuinzena > 0) return valorQuinzena;
            }
        } catch {}
        const manual = __toNumber(lancamento && (lancamento.quinzenaValorManual || lancamento.valorManualQuinzena || lancamento.valorQuinzena));
        if (Number.isFinite(manual) && manual > 0) return manual;
    }
    return __getLiquidoLancamento(lancamento);
}

function __getFinanceiroEntry(lancamento, kind) {
    if (!lancamento) return null;
    if (lancamento.financeiro && typeof lancamento.financeiro === 'object') {
        if (lancamento.financeiro[kind]) return lancamento.financeiro[kind];
    }
    if (lancamento.financeiroId && (lancamento.financeiroTipo || kind) === kind) {
        return { id: lancamento.financeiroId, mesKey: lancamento.financeiroMesKey, status: lancamento.financeiroStatus };
    }
    return null;
}

function __setFinanceiroEntry(lancamento, kind, entry) {
    if (!lancamento) return;
    if (!lancamento.financeiro || typeof lancamento.financeiro !== 'object') lancamento.financeiro = {};
    if (entry) {
        lancamento.financeiro[kind] = entry;
    } else if (lancamento.financeiro[kind]) {
        delete lancamento.financeiro[kind];
    }
}

async function __findFinanceiroByOrigem(lancamento, kind, monthKey) {
    const svc = __getFinanceService();
    if (!svc || typeof svc.loadFromFirebase !== 'function') return null;
    const res = await svc.loadFromFirebase(`financas/pagar/${monthKey}`);
    const arr = (res && res.success && res.data)
        ? (Array.isArray(res.data) ? res.data : Object.values(res.data || {}))
        : [];
    return arr.find(c => c && String(c.origem || '') === 'folha_pagamento' && String(c.origemId || '') === String(lancamento.id) && String(c.origemTipo || '') === kind) || null;
}

async function __persistLancamento(lancamento) {
    if (window.folhaLancamentos && typeof window.folhaLancamentos.updateLancamento === 'function') {
        await window.folhaLancamentos.updateLancamento(lancamento);
    } else if (window.saveData) {
        await window.saveData(`folhas/${lancamento.id}`, lancamento);
    }
}

async function __gerarFinanceiro(lancamento, kind) {
    const svc = __getFinanceService();
    if (!svc || typeof svc.saveToFirebase !== 'function' || typeof svc.loadFromFirebase !== 'function') {
        if (window.folhaLancamentos) window.folhaLancamentos.showNotification('Serviço financeiro indisponível para gerar lançamento.', 'error');
        return null;
    }
    const mesKey = __getMonthKeyFromLancamento(lancamento);
    const existing = __getFinanceiroEntry(lancamento, kind);
    if (existing && existing.id && existing.mesKey) {
        if (window.folhaLancamentos) window.folhaLancamentos.showNotification('Financeiro já gerado para este lançamento.', 'info');
        return existing;
    }
    const found = await __findFinanceiroByOrigem(lancamento, kind, mesKey);
    if (found && found.id) {
        const entry = { id: found.id, mesKey, status: found.status || 'pendente' };
        __setFinanceiroEntry(lancamento, kind, entry);
        await __persistLancamento(lancamento);
        if (window.folhaLancamentos) window.folhaLancamentos.showNotification('Financeiro já existia e foi vinculado ao lançamento.', 'info');
        return entry;
    }
    const valor = __getValorFinanceiroLancamento(lancamento, kind);
    if (!Number.isFinite(valor) || valor <= 0) {
        if (window.folhaLancamentos) window.folhaLancamentos.showNotification('Valor líquido inválido para gerar financeiro.', 'warning');
        return null;
    }
    const func = (lancamento && lancamento.funcionario) || {};
    const nome = func.nome || 'Funcionário';
    const mesAno = __normalizeMesAnoLocal(lancamento && lancamento.mesAno);
    const baseTipo = __resolveTipoPagamento(lancamento);
    const tipoLabel = kind === 'quinzena' ? '1° Quinzena' : (baseTipo === 'quinzena' ? '2° Quinzena' : 'Mês Fechado');
    const mesRef = __getMesAnoRef(mesAno);
    const categoria = baseTipo === 'quinzena'
        ? (kind === 'quinzena' ? 'quinzena_1' : 'quinzena_2')
        : 'mes_fechado';
    const descricao = kind === 'quinzena'
        ? `Referente: 1° Quinzena ${mesRef}`
        : (baseTipo === 'quinzena' ? `Referente: 2° Quinzena ${mesRef}` : `Referente: Mês Fechado ${mesRef}`);
    const pedidoNumero = await __getNextPxNumero(svc, mesKey);
    const contaId = `FP_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const conta = {
        id: contaId,
        fornecedorId: func.id || lancamento.funcionarioId || '',
        fornecedor: nome,
        descricao,
        pedidoNumero,
        numero: pedidoNumero,
        valor: valor,
        valorOriginal: valor,
        valorRestante: valor,
        dataVencimento: __getDataVencimento(lancamento, kind),
        status: 'pendente',
        categoria,
        tipo: 'pagar',
        observacoes: '',
        origem: 'folha_pagamento',
        origemId: String(lancamento.id || ''),
        origemTipo: kind,
        mesAno: mesAno
    };
    const res = await svc.saveToFirebase(`financas/pagar/${mesKey}`, String(contaId), conta);
    if (!res || !res.success) {
        const errMsg = res && res.error ? res.error : 'Falha ao gerar financeiro. Tente novamente.';
        if (window.folhaLancamentos) window.folhaLancamentos.showNotification(errMsg, 'error');
        return null;
    }
    const entry = { id: contaId, mesKey, status: 'pendente', valor: valor };
    __setFinanceiroEntry(lancamento, kind, entry);
    await __persistLancamento(lancamento);
    if (window.folhaLancamentos) {
        const fmt = window.FolhaUtils && window.FolhaUtils.formatarMoeda ? window.FolhaUtils.formatarMoeda(valor) : `R$ ${valor.toFixed(2).replace('.', ',')}`;
        window.folhaLancamentos.showNotification(`Financeiro gerado: ${fmt}`, 'success');
    }
    return entry;
}

async function __estornarFinanceiro(lancamento, kind) {
    const svc = __getFinanceService();
    if (!svc || typeof svc.loadFromFirebase !== 'function' || typeof svc.saveToFirebase !== 'function') {
        if (window.folhaLancamentos) window.folhaLancamentos.showNotification('Serviço financeiro indisponível para estorno.', 'error');
        return { ok: false };
    }
    const mesKey = __getMonthKeyFromLancamento(lancamento);
    let entry = __getFinanceiroEntry(lancamento, kind);
    if (!entry || !entry.id) {
        const found = await __findFinanceiroByOrigem(lancamento, kind, mesKey);
        if (found && found.id) {
            entry = { id: found.id, mesKey, status: found.status || 'pendente' };
            __setFinanceiroEntry(lancamento, kind, entry);
            await __persistLancamento(lancamento);
        }
    }
    if (!entry || !entry.id) {
        if (window.folhaLancamentos) window.folhaLancamentos.showNotification('Nenhum financeiro vinculado encontrado para estorno.', 'info');
        return { ok: false, reason: 'not_found' };
    }
    const res = await svc.loadFromFirebase(`financas/pagar/${entry.mesKey || mesKey}`);
    const arr = (res && res.success && res.data)
        ? (Array.isArray(res.data) ? res.data : Object.values(res.data || {}))
        : [];
    const conta = arr.find(c => c && String(c.id) === String(entry.id)) || null;
    const status = String((conta && conta.status) || entry.status || 'pendente').toLowerCase();
    if (status === 'pago' || status === 'parcial') {
        const msg = status === 'pago'
            ? 'Financeiro não estornado: já está quitado.'
            : 'Financeiro não estornado: possui pagamento parcial.';
        if (window.folhaLancamentos) window.folhaLancamentos.showNotification(msg, 'warning');
        return { ok: false, reason: status };
    }
    await svc.saveToFirebase(`financas/pagar/${entry.mesKey || mesKey}`, String(entry.id), null);
    __setFinanceiroEntry(lancamento, kind, null);
    await __persistLancamento(lancamento);
    if (window.folhaLancamentos) window.folhaLancamentos.showNotification('Financeiro estornado com sucesso!', 'success');
    return { ok: true };
}

window.darBaixaQuinzena = async function(id) {
    console.log(`💸 Dando baixa na quinzena: ${id}`);
    try {
        const lancamento = await __findLancamentoById(id);
        const tipoNorm = __resolveTipoPagamento(lancamento);
        const statusNorm = __normalizeStatusLocal(lancamento && lancamento.status).toLowerCase();
        if (!lancamento || tipoNorm !== 'quinzena' || !['rascunho', 'calculada', 'aprovada'].includes(statusNorm)) {
            throw new Error('Quinzena inválida para baixa');
        }
        
        // Atualizar status e salvar
        lancamento.status = 'quinzena_paga';
        lancamento.dataPagamento = new Date().toISOString();
        await window.folhaLancamentos.updateLancamento(lancamento);
        await __gerarFinanceiro(lancamento, 'quinzena');
        
        // Notificar atualização
        try { window.dispatchEvent(new CustomEvent('folhas:updated', { detail: { source: 'darBaixaQuinzena' } })); } catch {}
        // Reaplicar filtros
        try { window.folhaSystem && window.folhaSystem.aplicarFiltrosComDadosFrescos && window.folhaSystem.aplicarFiltrosComDadosFrescos(); } catch {}
        window.folhaLancamentos.showNotification('Quinzena baixada com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro ao dar baixa:', error);
        window.folhaLancamentos.showNotification('Erro ao dar baixa: ' + error.message, 'error');
    }
};

window.fecharMes = async function(id) {
    console.log(`📅 Fechando mês: ${id}`);
    try {
        // Idempotência: evitar duplicações de clique ou delegação
        if (!window.__fechandoMesIds) window.__fechandoMesIds = new Set();
        if (window.__fechandoMesIds.has(id)) {
            console.log('⏳ Fechamento já em andamento para:', id);
            return;
        }
        window.__fechandoMesIds.add(id);

        const lancamento = await __findLancamentoById(id);
        if (!lancamento) throw new Error('Lançamento não encontrado');
        const normStr = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
        const status = (typeof lancamento.status === 'object') ? normStr(lancamento.status.value || lancamento.status.status || lancamento.status.nome) : normStr(lancamento.status);
        if (status === 'mes_fechado') {
            window.folhaLancamentos.showNotification('Este mês já está fechado.', 'info');
            window.__fechandoMesIds.delete(id);
            return;
        }
        
        // Atualizar status e salvar
        lancamento.status = 'mes_fechado';
        lancamento.dataFechamento = new Date().toISOString();
        await window.folhaLancamentos.updateLancamento(lancamento);
        await __gerarFinanceiro(lancamento, 'mes');
        
        // Notificar atualização
        try { window.dispatchEvent(new CustomEvent('folhas:updated', { detail: { source: 'fecharMes' } })); } catch {}
        // Reaplicar filtros
        try { window.folhaSystem && window.folhaSystem.aplicarFiltrosComDadosFrescos && window.folhaSystem.aplicarFiltrosComDadosFrescos(); } catch {}
        window.folhaLancamentos.showNotification('Mês fechado com sucesso!', 'success');
        window.__fechandoMesIds.delete(id);
    } catch (error) {
        console.error('❌ Erro ao fechar mês:', error);
        window.folhaLancamentos.showNotification('Erro ao fechar mês: ' + error.message, 'error');
        try { window.__fechandoMesIds && window.__fechandoMesIds.delete(id); } catch {}
    }
};

function __limparCamposVariaveisCloneFolha(clone) {
    if (!clone || typeof clone !== 'object') return clone;
    clone.faltas = 0;
    clone.vales = 0;
    clone.valesDetalhados = [];
    clone.diasTrabalhados = null;
    delete clone.historicoVales;
    delete clone.valesHistorico;
    delete clone.detalhesVales;

    const zerar = (obj, keys) => {
        if (!obj || typeof obj !== 'object') return;
        keys.forEach((key) => {
            if (Object.prototype.hasOwnProperty.call(obj, key)) obj[key] = 0;
        });
    };
    zerar(clone, ['descontoFaltas']);
    if (clone.calculos && typeof clone.calculos === 'object') {
        clone.calculos = { ...clone.calculos };
        zerar(clone.calculos, ['faltas', 'vales', 'descontoFaltas']);
        if (clone.calculos.calculos && typeof clone.calculos.calculos === 'object') {
            clone.calculos.calculos = { ...clone.calculos.calculos };
            zerar(clone.calculos.calculos, ['faltas', 'vales', 'descontoFaltas']);
        }
    }
    if (clone.valores && typeof clone.valores === 'object') {
        clone.valores = { ...clone.valores };
        if (clone.valores.descontos && typeof clone.valores.descontos === 'object') {
            clone.valores.descontos = { ...clone.valores.descontos };
            zerar(clone.valores.descontos, ['faltas', 'vales', 'descontoFaltas']);
        }
    }
    return clone;
}

window.clonarFolha = async function(id) {
    console.log(`📋 Clonando folha: ${id}`);
    try {
        const original = await __findLancamentoById(id);
        if (!original || original.status === 'cancelada') {
            throw new Error('Folha inválida para clonagem');
        }
        
        // Calcular próximo mês/ano
        const normMes = (val) => { if (window.FolhaUtils && typeof window.FolhaUtils.normalizeMesAno === 'function') { return window.FolhaUtils.normalizeMesAno(val); } const s = String(val || '').trim(); if (/^\d{4}-\d{2}$/.test(s)) return s; const m = s.match(/^(\d{2})\/(\d{4})$/); if (m) return `${m[2]}-${m[1]}`; return s; };
        const baseMesAno = normMes(original.mesAno || new Date().toISOString().slice(0,7));
        const [ano, mes] = baseMesAno.split('-').map(Number);
        const proximo = new Date(ano, (mes - 1), 1);
        proximo.setMonth(proximo.getMonth() + 1);
        const novoMesAno = `${proximo.getFullYear()}-${String(proximo.getMonth() + 1).padStart(2, '0')}`;
        
        // Verificar duplicidade
        const existe = (window.folhaLancamentos && Array.isArray(window.folhaLancamentos.lancamentos)) ? window.folhaLancamentos.lancamentos.some(l => {
            const sameFunc = ((l && l.funcionario && l.funcionario.id) === (original && original.funcionario && original.funcionario.id));
            const sameMes = normMes(l.mesAno) === novoMesAno;
            const tipoL = String(l.tipo || l.tipoPagamento || '').toLowerCase();
            const tipoO = String(original.tipo || original.tipoPagamento || '').toLowerCase();
            const sameTipo = tipoL === tipoO;
            return sameFunc && sameMes && sameTipo;
        }) : false;
        if (existe) throw new Error('Já existe folha para o próximo mês');
        
        // Clonar dados
        const clone = __limparCamposVariaveisCloneFolha({ ...original, id: null, mesAno: novoMesAno, status: 'rascunho' });
        delete clone.id; // Garantir novo ID
        
        // Criar novo
        const novoId = await window.folhaLancamentos.createLancamento(clone);
        
        // Notificar
        try { window.dispatchEvent(new CustomEvent('folhas:updated', { detail: { source: 'clonarFolha' } })); } catch {}
        window.folhaLancamentos.showNotification('Folha clonada com sucesso para ' + novoMesAno, 'success');
    } catch (error) {
        console.error('❌ Erro ao clonar:', error);
        window.folhaLancamentos.showNotification('Erro ao clonar folha: ' + error.message, 'error');
    }
};

// Wrappers globais para compatibilidade com atributos inline do HTML
if (!window.toggleQuinzenaOptions) {
    window.toggleQuinzenaOptions = function() {
        if (window.folhaLancamentos && typeof window.folhaLancamentos.toggleQuinzenaOptions === 'function') {
            window.folhaLancamentos.toggleQuinzenaOptions();
        } else {
            console.warn('⚠️ toggleQuinzenaOptions indisponível no momento');
        }
    };
}
if (!window.toggleValorManual) {
    window.toggleValorManual = function() {
        if (window.folhaLancamentos && typeof window.folhaLancamentos.toggleValorManual === 'function') {
            window.folhaLancamentos.toggleValorManual();
        } else {
            console.warn('⚠️ toggleValorManual indisponível no momento');
        }
    };
}
if (!window.updateModoCumulativoDescription) {
    window.updateModoCumulativoDescription = function() {
        if (window.folhaLancamentos && typeof window.folhaLancamentos.updateModoCumulativoDescription === 'function') {
            window.folhaLancamentos.updateModoCumulativoDescription();
        } else {
            console.warn('⚠️ updateModoCumulativoDescription indisponível no momento');
        }
    };
}

// 🖊️ Editar Folha (handler global chamado pelos botões da tabela)
window.editFolha = function(folhaId) {
    try {
        let id = String(folhaId || '').trim();
        if (!id || id === 'undefined' || id === 'null') {
            try {
                const ev = window.event;
                let node = ev && ev.target;
                while (node && node.tagName && String(node.tagName).toLowerCase() !== 'tr') { node = node.parentNode; }
                const rid = node && (node.getAttribute && node.getAttribute('data-id'));
                if (rid) id = String(rid).trim();
                try {
                    const cells = node && node.querySelectorAll('td');
                    const nomeCell = cells && cells[0];
                    const mesCell = cells && cells[1];
                    const nome = nomeCell ? String(nomeCell.textContent||'').trim() : '';
                    const mesTxt = mesCell ? String(mesCell.textContent||'').trim() : '';
                    const mesNorm = (function(s){ const m=s.trim(); const mm=m.match(/^(\d{2})\/(\d{4})$/); if(mm) return `${mm[2]}-${mm[1]}`; return m; })(mesTxt);
                    if (window.folhaLancamentos) { window.folhaLancamentos._editHint = { nome, mesAno: mesNorm }; }
                } catch {}
            } catch {}
        }
        if (window.folhaLancamentos && typeof window.folhaLancamentos.openEditFolhaModal === 'function') {
            return window.folhaLancamentos.openEditFolhaModal(id);
        }
        console.warn('⚠️ Módulo folhaLancamentos não disponível para edição agora');
        if (window.FolhaUtils && window.FolhaUtils.mostrarAviso) {
            window.FolhaUtils.mostrarAviso('Sistema carregando. Tente novamente em alguns segundos.');
        }
    } catch (e) {
        console.error('❌ Erro ao abrir edição de folha:', e);
        alert('Não foi possível abrir a edição agora.');
    }
};

// 🗑️ Excluir Folha por ID
window.deleteFolha = async function(folhaId) {
    try {
        if (!folhaId) { window.folhaLancamentos.showNotification('ID inválido para exclusão', 'error'); return; }
        
        const confirma = confirm('Confirma excluir esta folha? Esta ação não pode ser desfeita.');
        if (!confirma) return;
        
        // ✅ USAR O MANAGER PARA DELETAR (saveData com null)
        if (window.saveData) {
            await window.saveData(`folhas/${folhaId}`, null);
            console.log('✅ Solicitação de exclusão (global) enviada ao manager:', folhaId);
        } else {
            throw new Error('Sistema de salvamento não inicializado');
        }

        // Atualizar cache local
        if (window.folhaLancamentos && Array.isArray(window.folhaLancamentos.lancamentos)) {
            window.folhaLancamentos.lancamentos = window.folhaLancamentos.lancamentos.filter(l => l.id !== folhaId);
        }
        try { window.dispatchEvent(new CustomEvent('folhas:updated', { detail: { source: 'deleteFolhaGlobal' } })); } catch {}
        window.folhaLancamentos.showNotification('Folha excluída com sucesso', 'success');
    } catch (e) {
        console.error('❌ Erro ao excluir folha:', e);
        window.folhaLancamentos.showNotification('Erro ao excluir folha: ' + (e && e.message ? e.message : e), 'error');
    }
};

// ... existing code ...

// ↩️ Estornar fechamento (reabrir)
window.estornarFechamento = async function(id) {
    console.log(`↩️ Estornando fechamento: ${id}`);
    try {
        const lanc = await __findLancamentoById(id);
        if (!lanc) throw new Error('Lançamento não encontrado');
        const tipoNorm = __resolveTipoPagamento(lanc);
        const statusNorm = __normalizeStatusLocal(lanc && lanc.status).toLowerCase();
        const kind = (tipoNorm === 'quinzena' && statusNorm === 'quinzena_paga') ? 'quinzena' : 'mes';
        lanc.status = 'aprovada';
        if (kind === 'quinzena') {
            lanc.dataPagamento = null;
        } else {
            lanc.dataFechamento = null;
        }
        await window.folhaLancamentos.updateLancamento(lanc);
        await __estornarFinanceiro(lanc, kind);
        try { window.dispatchEvent(new CustomEvent('folhas:updated', { detail: { source: 'estornarFechamento' } })); } catch {}
        window.folhaLancamentos.showNotification('Fechamento estornado com sucesso!', 'success');
    } catch (e) {
        console.error('❌ Erro ao estornar fechamento:', e);
        window.folhaLancamentos.showNotification('Erro ao estornar: ' + (e && e.message ? e.message : e), 'error');
    }
};
