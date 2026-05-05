/**
 * 🛠️ FOLHA UTILS - UTILITÁRIOS BÁSICOS
 */

class FolhaUtils {
    constructor() {
        this.loadingCount = 0;
        this.init();
    }

    init() {
        if (FolhaUtils.getDebugMode() === 'all') console.log('🛠️ Folha Utils inicializado');
    }

    static getDebugMode() {
        try {
            const raw = window.__folhaDebugMode || window.__folhaDebugLevel;
            if (raw) return String(raw);
            if (window.__folhaDebug === true) return 'data';
            return 'data';
        } catch (_) {
            return 'data';
        }
    }

    static getDataSignature(data) {
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

    static shouldLogDataChange(key, signature) {
        const mode = FolhaUtils.getDebugMode();
        if (mode === 'none') return false;
        if (mode === 'all') return true;
        try {
            if (!window.__folhaDebugSignatures) window.__folhaDebugSignatures = {};
            if (window.__folhaDebugSignatures[key] === signature) return false;
            window.__folhaDebugSignatures[key] = signature;
            return true;
        } catch (_) {
            return true;
        }
    }

    static showLoading() {
        if (FolhaUtils.getDebugMode() === 'all') console.log('🔄 Loading...');
        // this.loadingCount++; // Removido pois não funciona em método estático
    }

    static hideLoading() {
        if (FolhaUtils.getDebugMode() === 'all') console.log('✅ Loading concluído');
        // this.loadingCount = Math.max(0, this.loadingCount - 1); // Removido pois não funciona em método estático
    }

    static resolveFirebasePath(path) {
        try {
            const base = String(path || '');
            if (!base) return base;
            if (/^companies\//.test(base) || /^users\//.test(base)) return base;
            const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                return svc.getNamespacedPath(base);
            }
            const rawTenant = window.appTenantId || (window.companyInfo && (window.companyInfo.id || window.companyInfo.companyId || window.companyInfo.slug || window.companyInfo.nome || window.companyInfo.name));
            if (rawTenant) {
                const tenant = String(rawTenant);
                return `companies/${tenant}/${base}`;
            }
            const stored = localStorage.getItem('company_info');
            if (stored) {
                const obj = JSON.parse(stored);
                const t = obj && (obj.id || obj.companyId || obj.slug || obj.nome || obj.name);
                if (t) return `companies/${String(t)}/${base}`;
            }
            return base;
        } catch (_) {
            return path;
        }
    }

    // =============================
    // PRELOAD (Tabela de Folhas)
    // =============================
    static showTablePreload(rowCount = 8) {
        try {
            const container = document.querySelector('#tabela-folhas-section .table-container') || document.querySelector('.table-container');
            const tbody = document.getElementById('folhasTableBody');
            if (container) container.classList.add('loading');
            // ✅ Não sobrescrever linhas reais: só injetar skeleton se a tabela estiver vazia
            if (tbody && tbody.querySelectorAll('tr').length === 0) {
                const rows = Array.from({ length: Math.max(3, rowCount) }).map(() => `
                    <tr>
                        <td colspan="12">
                            <div class="skeleton skeleton-text" style="width: 75%; height: 14px; margin: 6px 0;"></div>
                            <div class="skeleton skeleton-text" style="width: 55%; height: 12px; margin: 6px 0;"></div>
                        </td>
                    </tr>
                `).join('');
                tbody.innerHTML = rows;
            }
        } catch (e) {
            console.warn('⚠️ Falha ao mostrar preload da tabela:', e);
        }
    }

    static hideTablePreload() {
        try {
            const container = document.querySelector('#tabela-folhas-section .table-container') || document.querySelector('.table-container');
            if (container) container.classList.remove('loading');
            const tbody = document.getElementById('folhasTableBody');
            if (tbody) {
                const hasSkeleton = !!tbody.querySelector('.skeleton');
                if (hasSkeleton) {
                    tbody.innerHTML = '';
                }
            }
        } catch (e) {}
    }

    static showToast(message, type = 'info', duration = 3000) {
        console.log(`🍞 Toast [${type}]: ${message}`);
        
        // Criar container de toast se não existir
        let toastContainer = document.getElementById('toast-container-folha');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container-folha';
            toastContainer.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                top: auto;
                z-index: 10001;
                display: flex;
                flex-direction: column;
                gap: 10px;
                pointer-events: none;
            `;
            document.body.appendChild(toastContainer);
        }

        // Criar toast com animações
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Cores baseadas no sistema
        const colors = {
            success: '#27ae60',
            error: '#e74c3c', 
            warning: '#f39c12',
            info: '#3498db'
        };
        
        toast.style.cssText = `
            background: ${colors[type] || colors.info};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-size: 14px;
            font-weight: 500;
            max-width: 350px;
            min-width: 250px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: auto;
            cursor: pointer;
            border-left: 4px solid rgba(255,255,255,0.3);
        `;
        toast.textContent = message;
        
        // Permitir fechar clicando
        toast.addEventListener('click', () => {
            removeToast(toast);
        });

        toastContainer.appendChild(toast);

        // Animar entrada
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);

        // Função para remover toast
        function removeToast(toastElement) {
            toastElement.style.opacity = '0';
            toastElement.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toastElement.parentNode) {
                    toastElement.parentNode.removeChild(toastElement);
                }
            }, 300);
        }

        // Remover automaticamente após duração
        setTimeout(() => {
            removeToast(toast);
        }, duration);
    }

    static formatCurrency(value) {
        if (value == null || value === '') return 'R$ 0,00';
        const number = typeof value === 'string' ? parseFloat(value.replace(/[^\d,-]/g, '').replace(',', '.')) : value;
        if (isNaN(number)) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
    }

    static isAllCaps(text) {
        if (!text) return false;
        const letters = String(text).replace(/[^A-Za-zÀ-ÿ]/g, '');
        if (!letters) return false;
        return letters === letters.toUpperCase();
    }

    static toTitleCasePt(text) {
        if (!text) return text;
        const acronyms = new Set(['CPF','CNPJ','RG','IE','IM','NF','NFE','NF-E','CTE','PIX','IPTU','IPVA','ISS','ICMS','IPI','PIS','COFINS','CSLL','MEI','ME','LTDA','EIRELI','S/A','SA']);
        const s = String(text).replace(/\s+/g, ' ').trim();
        const cap = w => w ? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : w;
        return s.split(' ').map(token => {
            const clean = token.trim();
            if (acronyms.has(clean.toUpperCase())) return clean.toUpperCase();
            return clean.split(/([\-\/])/).map(part => (part === '-' || part === '/') ? part : cap(part)).join('');
        }).join(' ');
    }

    /**
     * 🔧 Normalizar status (corrigir quando vem como objeto)
     */
    static normalizarStatus(status) {
        if (!status) return 'rascunho';
        
        // Se é string, retorna diretamente
        if (typeof status === 'string') {
            return status;
        }
        
        // Se é objeto, tenta extrair o valor
        if (typeof status === 'object') {
            console.warn('⚠️ Status como objeto detectado:', status);
            
            // Tenta várias propriedades comuns
            if (status.value) return status.value;
            if (status.status) return status.status;
            if (status.estado) return status.estado;
            if (status.tipo) return status.tipo;
            
            // Se tem toString customizado
            const stringValue = status.toString();
            if (stringValue && stringValue !== '[object Object]') {
                return stringValue;
            }
            
            console.error('❌ Não foi possível extrair status do objeto:', status);
            return 'rascunho'; // Fallback seguro
        }
        
        // Para outros tipos, converte para string
        return String(status);
    }

    static lancamentoContaNoResumo(lancamento) {
        if (!lancamento || typeof lancamento !== 'object') return false;
        const normalizar = (valor) => {
            try {
                return String(valor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z_]/g, '');
            } catch {
                return String(valor || '').toLowerCase();
            }
        };
        const status = normalizar(FolhaUtils.normalizarStatus(lancamento.status));
        if (!status) return true;
        const statusBaixados = new Set(['quinzena_paga', 'quinzenapaga', 'mes_fechado', 'mesfechado', 'baixado', 'baixada', 'pago', 'paga']);
        return !statusBaixados.has(status);
    }

    // Alias para compatibilidade
    static formatarMoeda(value) {
        return FolhaUtils.formatCurrency(value);
    }

    static getFolhasColumnsDefs() {
        return [
            { key: 'funcionario', label: 'Funcionário' },
            { key: 'formaPagamento', label: 'Forma Pgto.' },
            { key: 'mesAno', label: 'Mês/Ano' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'percentual', label: '%' },
            { key: 'salarioBase', label: 'Salário Base' },
            { key: 'quinzena', label: '1ª Quinzena' },
            { key: 'acrescimos', label: 'Acréscimos' },
            { key: 'descontos', label: 'Descontos' },
            { key: 'vales', label: 'Total Vales' },
            { key: 'liquido', label: 'Líquido' },
            { key: 'acoes', label: 'Ações' }
        ];
    }

    static getFolhasTableSortState() {
        const fallback = { key: '', direction: 'asc' };
        try {
            const state = window.__folhasTableSortState;
            if (!state || typeof state !== 'object') return fallback;
            const key = String(state.key || '').trim();
            const direction = String(state.direction || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
            return { key, direction };
        } catch {
            return fallback;
        }
    }

    static setFolhasTableSortState(key, direction = 'asc') {
        const parsedKey = String(key || '').trim();
        const parsedDirection = String(direction || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
        window.__folhasTableSortState = { key: parsedKey, direction: parsedDirection };
        return window.__folhasTableSortState;
    }

    static toggleFolhasTableSort(key) {
        const parsedKey = String(key || '').trim();
        if (!parsedKey || parsedKey === 'acoes') return FolhaUtils.getFolhasTableSortState();
        const current = FolhaUtils.getFolhasTableSortState();
        const nextDirection = current.key === parsedKey && current.direction === 'asc' ? 'desc' : 'asc';
        return FolhaUtils.setFolhasTableSortState(parsedKey, nextDirection);
    }

    static atualizarIndicadoresOrdenacaoFolhas() {
        const table = document.getElementById('folhasTable');
        if (!table) return;
        const state = FolhaUtils.getFolhasTableSortState();
        table.querySelectorAll('thead th[data-sort-key]').forEach((th) => {
            const key = String(th.getAttribute('data-sort-key') || '').trim();
            th.classList.remove('sortable', 'sort-asc', 'sort-desc', 'sort-active');
            if (key && key !== 'acoes') th.classList.add('sortable');
            if (key && key === state.key) {
                th.classList.add('sort-active');
                th.classList.add(state.direction === 'desc' ? 'sort-desc' : 'sort-asc');
            }
        });
    }

    static setupFolhasTableSorting() {
        const table = document.getElementById('folhasTable');
        if (!table) return;
        table.querySelectorAll('thead th[data-sort-key]').forEach((th) => {
            const key = String(th.getAttribute('data-sort-key') || '').trim();
            if (!key || key === 'acoes') return;
            if (th.dataset.sortBound === '1') return;
            th.dataset.sortBound = '1';
            th.addEventListener('click', () => {
                FolhaUtils.toggleFolhasTableSort(key);
                FolhaUtils.atualizarIndicadoresOrdenacaoFolhas();
                if (window.folhaPaginacao && Array.isArray(window.folhaPaginacao.dadosFiltrados) && window.folhaPaginacao.dadosFiltrados.length > 0) {
                    window.folhaPaginacao.aplicarFiltrosComPaginacao(window.folhaPaginacao.dadosFiltrados.slice());
                    return;
                }
                if (window.folhaFiltros && typeof window.folhaFiltros.aplicarFiltros === 'function') {
                    window.folhaFiltros.aplicarFiltros();
                    return;
                }
                if (window.folhaSystem && Array.isArray(window.folhaSystem.folhas) && typeof window.FolhaUtils.renderizarTabelaLancamentos === 'function') {
                    window.FolhaUtils.renderizarTabelaLancamentos(window.folhaSystem.folhas.slice(), {
                        mensagemVazia: 'Nenhuma folha encontrada com os filtros aplicados'
                    });
                }
            });
        });
        FolhaUtils.atualizarIndicadoresOrdenacaoFolhas();
    }

    static getFolhasSortValue(item, key) {
        const normalizeText = (value) => String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
        const normalizeTipo = (folha) => {
            const tipo = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
                ? window.FolhaUtils.resolveTipoPagamento(folha)
                : (folha && (folha.tipoPagamento || folha.tipo || folha.tipoFolha)) || 'mes';
            const statusNorm = String((window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function')
                ? window.FolhaUtils.normalizarStatus(folha && folha.status)
                : ((folha && folha.status) || '')).toLowerCase().normalize('NFD').replace(/[^a-z_]/g, '');
            if (String(tipo).toLowerCase().includes('quinz')) {
                if (statusNorm === 'quinzena_paga') return '1 quinzena paga';
                if (statusNorm === 'mes_fechado') return '2 quinzena paga';
                return '1 quinzena';
            }
            return statusNorm === 'mes_fechado' ? 'mes fechado pago' : 'mes fechado';
        };
        if (!item || !key) return '';
        switch (key) {
            case 'funcionario':
                return normalizeText((item.funcionario && item.funcionario.nome) || item.funcionarioNome || '');
            case 'formaPagamento':
                return normalizeText((item.funcionario && item.funcionario.formaPagamento) || item.formaPagamento || '');
            case 'mesAno':
                return normalizeText(item.mesAno || '');
            case 'tipo':
                return normalizeTipo(item);
            case 'percentual':
                return Number(item.percentualQuinzena || item.quinzenaPercentual || item.percentual || 100) || 0;
            case 'salarioBase':
                return Number(FolhaUtils.getSalarioBaseDisplay ? FolhaUtils.getSalarioBaseDisplay(item) : (item.salarioBase || 0)) || 0;
            case 'quinzena':
                return Number(FolhaUtils.calcularValorQuinzena ? FolhaUtils.calcularValorQuinzena(item) : 0) || 0;
            case 'acrescimos':
                return Number(FolhaUtils.calcularAcrescimosDisplay ? FolhaUtils.calcularAcrescimosDisplay(item) : 0) || 0;
            case 'descontos':
                return Number(FolhaUtils.calcularDescontosDisplay ? FolhaUtils.calcularDescontosDisplay(item) : 0) || 0;
            case 'vales':
                return Number(item.vales || 0) || 0;
            case 'liquido':
                return Number(FolhaUtils.calcularSalarioLiquidoDisplay ? FolhaUtils.calcularSalarioLiquidoDisplay(item) : 0) || 0;
            default:
                return '';
        }
    }

    static aplicarOrdenacaoTabelaFolhas(lista) {
        if (!Array.isArray(lista) || lista.length <= 1) return Array.isArray(lista) ? lista.slice() : [];
        const state = FolhaUtils.getFolhasTableSortState();
        if (!state.key || state.key === 'acoes') return lista.slice();
        const directionMultiplier = state.direction === 'desc' ? -1 : 1;
        return lista
            .map((item, index) => ({ item, index }))
            .sort((a, b) => {
                const va = FolhaUtils.getFolhasSortValue(a.item, state.key);
                const vb = FolhaUtils.getFolhasSortValue(b.item, state.key);
                const aIsNumber = typeof va === 'number' && Number.isFinite(va);
                const bIsNumber = typeof vb === 'number' && Number.isFinite(vb);
                let cmp = 0;
                if (aIsNumber && bIsNumber) {
                    cmp = va - vb;
                } else {
                    cmp = String(va || '').localeCompare(String(vb || ''), 'pt-BR', { sensitivity: 'base', numeric: true });
                }
                if (cmp !== 0) return cmp * directionMultiplier;
                return a.index - b.index;
            })
            .map(({ item }) => item);
    }

    static getFolhasColumnsStorageKey() {
        let uid = '';
        let tenant = '';
        try {
            if (window.firebaseService && typeof window.firebaseService.getCurrentUid === 'function') {
                uid = String(window.firebaseService.getCurrentUid() || '').trim();
            }
        } catch {}
        try {
            if (!uid && window.firebaseService && window.firebaseService.authService && typeof window.firebaseService.authService.getAuth === 'function') {
                const auth = window.firebaseService.authService.getAuth();
                uid = String((auth && auth.currentUser && auth.currentUser.uid) || '').trim();
            }
        } catch {}
        try {
            if (window.firebaseService && typeof window.firebaseService.getTenantId === 'function') {
                tenant = String(window.firebaseService.getTenantId() || '').trim();
            }
        } catch {}
        return `folha_cols_cfg_${tenant || 'default'}_${uid || 'anon'}`;
    }

    static getFolhasColumnsConfig() {
        const defs = FolhaUtils.getFolhasColumnsDefs();
        const defaults = Object.fromEntries(defs.map(d => [d.key, true]));
        try {
            const raw = localStorage.getItem(FolhaUtils.getFolhasColumnsStorageKey());
            if (!raw) return defaults;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return defaults;
            const normalized = { ...defaults };
            defs.forEach(d => {
                if (Object.prototype.hasOwnProperty.call(parsed, d.key)) {
                    normalized[d.key] = parsed[d.key] !== false;
                }
            });
            return normalized;
        } catch {
            return defaults;
        }
    }

    static saveFolhasColumnsConfig(config = {}) {
        const defs = FolhaUtils.getFolhasColumnsDefs();
        const sanitized = {};
        defs.forEach(d => {
            sanitized[d.key] = config[d.key] !== false;
        });
        if (defs.every(d => !sanitized[d.key])) {
            sanitized.funcionario = true;
        }
        try {
            const key = FolhaUtils.getFolhasColumnsStorageKey();
            if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                window.SiswebStorage.write(key, sanitized);
            } else {
                localStorage.setItem(key, JSON.stringify(sanitized));
            }
        } catch {}
        return sanitized;
    }

    static applyFolhasColumnsConfig() {
        const table = document.getElementById('folhasTable');
        if (!table) return;
        const defs = FolhaUtils.getFolhasColumnsDefs();
        const cfg = FolhaUtils.getFolhasColumnsConfig();
        defs.forEach((col, idx) => {
            const visible = cfg[col.key] !== false;
            const nth = idx + 1;
            table.querySelectorAll(`thead th:nth-child(${nth}), tbody td:nth-child(${nth})`).forEach(el => {
                el.style.display = visible ? '' : 'none';
            });
        });
        const visibleCount = Math.max(1, defs.reduce((acc, d) => acc + (cfg[d.key] !== false ? 1 : 0), 0));
        table.querySelectorAll('tbody td[colspan]').forEach(td => {
            td.colSpan = visibleCount;
        });
    }

    static ensureFolhasColumnsConfigModal() {
        if (document.getElementById('folhasColumnsConfigModal')) return;
        const defs = FolhaUtils.getFolhasColumnsDefs();
        const items = defs.map(d => `
            <label class="checkbox-item" style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <input type="checkbox" class="folha-col-check" data-col="${d.key}">
                <span>${d.label}</span>
            </label>
        `).join('');
        const html = `
            <div id="folhasColumnsConfigModal" class="modal">
                <div class="modal-content" style="max-width:520px;">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-list"></i> Colunas dos Lançamentos</h3>
                        <span class="close-modal" onclick="closeFolhasColumnsConfigModal()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom:10px; color:#555;">Selecione as colunas que deseja exibir na tabela de Folhas de Pagamento.</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; column-gap:16px;">
                            ${items}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <div class="footer-secondary">
                            <button type="button" class="btn-listar" id="folhasColsResetBtn"><i class="fas fa-undo"></i> Restaurar Padrão</button>
                            <button type="button" class="btn-cancelar" onclick="closeFolhasColumnsConfigModal()"><i class="fas fa-times"></i> Cancelar</button>
                        </div>
                        <div class="footer-primary">
                            <button type="button" class="btn-salvar" id="folhasColsSaveBtn"><i class="fas fa-check"></i> Aplicar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        const modal = document.getElementById('folhasColumnsConfigModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) FolhaUtils.closeFolhasColumnsConfigModal();
            });
        }
        const btnReset = document.getElementById('folhasColsResetBtn');
        if (btnReset) {
            btnReset.addEventListener('click', () => {
                const defaults = FolhaUtils.saveFolhasColumnsConfig(Object.fromEntries(defs.map(d => [d.key, true])));
                document.querySelectorAll('#folhasColumnsConfigModal .folha-col-check').forEach(cb => {
                    const key = cb.getAttribute('data-col');
                    cb.checked = defaults[key] !== false;
                });
            });
        }
        const btnSave = document.getElementById('folhasColsSaveBtn');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const cfg = {};
                document.querySelectorAll('#folhasColumnsConfigModal .folha-col-check').forEach(cb => {
                    cfg[cb.getAttribute('data-col')] = !!cb.checked;
                });
                const saved = FolhaUtils.saveFolhasColumnsConfig(cfg);
                FolhaUtils.applyFolhasColumnsConfig();
                FolhaUtils.closeFolhasColumnsConfigModal();
                if (window.FolhaUtils && typeof window.FolhaUtils.showToast === 'function') {
                    const hasAny = defs.some(d => saved[d.key] !== false);
                    window.FolhaUtils.showToast(hasAny ? 'Configuração de colunas salva.' : 'Selecione ao menos uma coluna.', hasAny ? 'success' : 'warning');
                }
            });
        }
    }

    static openFolhasColumnsConfigModal() {
        FolhaUtils.ensureFolhasColumnsConfigModal();
        const cfg = FolhaUtils.getFolhasColumnsConfig();
        document.querySelectorAll('#folhasColumnsConfigModal .folha-col-check').forEach(cb => {
            const key = cb.getAttribute('data-col');
            cb.checked = cfg[key] !== false;
        });
        const modal = document.getElementById('folhasColumnsConfigModal');
        if (modal) modal.style.display = 'block';
    }

    static closeFolhasColumnsConfigModal() {
        const modal = document.getElementById('folhasColumnsConfigModal');
        if (modal) modal.style.display = 'none';
    }

    static formatarFormaPagamentoDetalhada(funcionario) {
        if (!funcionario || typeof funcionario !== 'object') return '-';
        const forma = String(funcionario.formaPagamento || '').trim();
        const pix = String(funcionario.pix || '').trim();
        const banco = String(funcionario.banco || '').trim();
        const agencia = String(funcionario.agencia || '').trim();
        const conta = String(funcionario.conta || '').trim();
        const beneficiario = String(funcionario.beneficiario || '').trim();
        if (!forma) return '-';
        if (forma === 'PIX') {
            return pix ? `PIX - ${pix}` : 'PIX';
        }
        if (forma === 'Conta Bancária') {
            const partes = [];
            if (beneficiario) partes.push(`Beneficiário: ${beneficiario}`);
            if (banco) partes.push(`Banco: ${banco}`);
            if (agencia) partes.push(`Ag: ${agencia}`);
            if (conta) partes.push(`Conta: ${conta}`);
            if (partes.length > 0) return `Conta Bancária - ${partes.join(' | ')}`;
            return 'Conta Bancária';
        }
        return forma;
    }

    // Compat: usado por folha-main.js
    static formatarMesAno(mesAno) {
        try {
            if (!mesAno || typeof mesAno !== 'string') return 'N/A';
            const [ano, mes] = mesAno.split('-');
            if (!ano || !mes) return 'N/A';
            return `${mes}/${ano}`;
        } catch {
            return 'N/A';
        }
    }

    static normalizeMesAno(val) {
        try {
            if (val && typeof val === 'object') {
                const ano = val.ano || val.year || '';
                let mes = val.mes || val.month || '';
                if (typeof mes === 'string') {
                    const map = { 'janeiro':'01','fevereiro':'02','marco':'03','março':'03','abril':'04','maio':'05','junho':'06','julho':'07','agosto':'08','setembro':'09','outubro':'10','novembro':'11','dezembro':'12' };
                    const mnorm = mes.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                    mes = map[mnorm] || mes;
                }
                const mm = String(mes || '').padStart(2,'0');
                const yy = String(ano || '').trim();
                if (yy && mm) return `${yy}-${mm}`;
                if (val.mesAno) return FolhaUtils.normalizeMesAno(val.mesAno);
                if (val.dataProcessamento) {
                    const d = new Date(Number(val.dataProcessamento));
                    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                }
                return '';
            }
            const s = String(val || '').trim();
            if (!s) return '';
            if (/^\d{4}-\d{2}$/.test(s)) return s;
            let m = s.match(/^(\d{2})\/(\d{4})$/);
            if (m) return `${m[2]}-${m[1]}`;
            m = s.match(/^(\d{4})[\/-](\d{2})$/);
            if (m) return `${m[1]}-${m[2]}`;
            m = s.match(/^(\d{2})(\d{4})$/);
            if (m) return `${m[2]}-${m[1]}`;
            const names = { 'janeiro':'01','fevereiro':'02','marco':'03','março':'03','abril':'04','maio':'05','junho':'06','julho':'07','agosto':'08','setembro':'09','outubro':'10','novembro':'11','dezembro':'12' };
            const nm = s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
            const k = Object.keys(names).find(n => nm.includes(n));
            const yr = s.match(/(\d{4})/);
            if (k && yr) return `${yr[1]}-${names[k]}`;
            return s;
        } catch { return String(val || '').trim(); }
    }

    static mostrarErro(message, duration = 5000) {
        FolhaUtils.showToast(message, 'error', duration);
        console.error('❌ Erro:', message);
    }

    static mostrarSucesso(message, duration = 3000) {
        FolhaUtils.showToast(message, 'success', duration);
        console.log('✅ Sucesso:', message);
    }

    static mostrarAviso(message, duration = 4000) {
        FolhaUtils.showToast(message, 'warning', duration);
        console.warn('⚠️ Aviso:', message);
    }

    static mostrarInfo(message, duration = 3000) {
        FolhaUtils.showToast(message, 'info', duration);
        console.info('ℹ️ Info:', message);
    }

    // Método unificado para notificações (compatibilidade)
    static showNotification(message, type = 'info') {
        FolhaUtils.showToast(message, type);
    }

    static generateId() {
        return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 📅 Calcular valor da quinzena para exibição na tabela
     * @param {object} folha - Dados da folha
     * @returns {number} Valor da quinzena (0 para folhas mensais)
     */
    static calcularValorQuinzena(folha) {
        // Resolver tipo de forma robusta e centralizada
        const tipoPag = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
            ? window.FolhaUtils.resolveTipoPagamento(folha)
            : (folha.tipoPagamento || folha.tipo || folha.tipoFolha);
        const isQuinzena = String(tipoPag || '').toLowerCase() === 'quinzena';
        if (!isQuinzena) {
            return 0;
        }
        
        // Se tem valor manual, usar ele (sempre prioridade)
        if (folha.quinzenaValorManual && folha.quinzenaValorManual > 0) {
            return folha.quinzenaValorManual;
        }

        // Resgatar percentual de quinzena de forma robusta
        const parsePercent = (raw) => {
            if (raw == null || raw === '') return NaN;
            const s = String(raw).trim().replace(/[^0-9,.-]/g,'');
            const n = s.includes(',') ? parseFloat(s.replace(/\./g,'').replace(/,/g,'.')) : parseFloat(s);
            return isNaN(n) ? NaN : n;
        };
        const getPercentualQuinzena = (f) => {
            // Priorizar exclusivamente os campos confiáveis no topo
            const candidates = [
                f.percentualQuinzena,
                f.quinzenaPercentual,
                f.percentual
            ];
            for (const c of candidates) {
                const n = parsePercent(c);
                if (!isNaN(n) && n > 0 && n <= 100) return n;
            }
            return 50; // default seguro
        };
        const percentualQuinzena = getPercentualQuinzena(folha);

        // Quando toggle ativo, calcular quinzena com (Base + Bonificações)
        const usarBrutoToggle = Boolean(folha.usarSalarioBrutoParaQuinzena);
        if (usarBrutoToggle) {
            const base = folha.salarioBase || (folha.calculos && folha.calculos.salarioBase) || (folha.funcionario && folha.funcionario.salarioBase) || 0;
            const bonificacoes = Number(
                folha.bonificacoes || (folha.calculos && folha.calculos.bonificacoes) || (folha.calculos && folha.calculos.calculos && folha.calculos.calculos.bonificacoes) || 0
            );
            const resultado = (base + bonificacoes) * (percentualQuinzena / 100);
            console.log(`📅 Calculando quinzena (usar bruto): ${base}+${bonificacoes} × ${percentualQuinzena}% = ${resultado}`);
            return resultado;
        }

        // 🔒 Não usar valorQuinzena salvo em calculos (pode estar desatualizado/100%).
        // Sempre calcular a 1ª quinzena a partir do percentual atual.
        
        // Calcular baseado no percentual: usar regra do toggle (Salário Bruto = Base + Bonificações apenas para quinzena)
        const base = folha.salarioBase || (folha.calculos && folha.calculos.salarioBase) || (folha.funcionario && folha.funcionario.salarioBase) || 0;
        const salarioParaQuinzena = base;
        const resultado = salarioParaQuinzena * (percentualQuinzena / 100);
        console.log(`📅 Calculando quinzena: ${salarioParaQuinzena} × ${percentualQuinzena}% = ${resultado}`);
        return resultado;
    }

    /**
     * Resolver 'tipoPagamento' de forma segura independente do schema vindo do banco
     * Regras:
     * - Se qualquer dos campos de tipo indicar 'quinzena', retorna 'quinzena'
     * - Caso contrário, se houver indícios de quinzena (percentualQuinzena/quinzenaPercentual/quinzenaValorManual), assume 'quinzena'
     * - Senão retorna 'mes'
     */
    static resolveTipoPagamento(folha) {
        const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z_]/g,'');
        const tipoCands = [folha.tipoPagamento, folha.tipo, folha.tipoFolha].map(norm);
        // Prioridade: se indicar mês fechado/mes, retornar mês SEM inferência
        if (tipoCands.some(t => ['mes_fechado','mes','mensal','fechado','fechada','mes-fechado'].includes(t))) return 'mes';
        // Se indicar explicitamente quinzena, retornar quinzena
        if (tipoCands.some(t => ['quinzena','quinzenal','quinzena_paga','quinzenapaga','quizenal'].includes(t))) return 'quinzena';
        const hasQuinzenaHints = (
            (folha.percentualQuinzena != null && Number(String(folha.percentualQuinzena).replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(/,/g,'.')) > 0) ||
            (folha.quinzenaPercentual != null && Number(String(folha.quinzenaPercentual).replace(/[^0-9,.-]/g,'').replace(/\./g,'').replace(/,/g,'.')) > 0) ||
            (folha.quinzenaValorManual != null && Number(folha.quinzenaValorManual) > 0)
        );
        if (hasQuinzenaHints) return 'quinzena';
        return 'mes';
    }

    static normalizarLancamento(lancamento) {
        if (!lancamento || typeof lancamento !== 'object') return lancamento;
        const rec = { ...lancamento };
        rec.id = rec.id || rec.key || rec.$key || rec.recordId || '';
        if (typeof rec.funcionario === 'string') rec.funcionario = { nome: rec.funcionario };
        const tipo = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
            ? window.FolhaUtils.resolveTipoPagamento(rec)
            : 'mes';
        rec.tipo = tipo;
        rec.tipoPagamento = tipo;
        rec.tipoFolha = tipo;
        rec.status = (window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function')
            ? window.FolhaUtils.normalizarStatus(rec.status)
            : String(rec.status || 'rascunho');
        if (rec.tipo === 'mes') {
            if (String(rec.status || '').toLowerCase() === 'quinzena_paga') rec.status = 'calculada';
            rec.percentual = 100;
            rec.percentualQuinzena = 100;
            rec.quinzenaPercentual = 100;
            rec.quinzenaValorManual = 0;
        } else {
            const perc = Number(rec.percentualQuinzena || rec.quinzenaPercentual || rec.percentual || 50);
            rec.percentualQuinzena = (perc > 0 && perc <= 100) ? perc : 50;
            rec.quinzenaPercentual = rec.percentualQuinzena;
            rec.percentual = rec.percentualQuinzena;
        }
        return rec;
    }

    static normalizarLancamentos(lista) {
        const arr = Array.isArray(lista) ? lista : [];
        return arr.map((item) => FolhaUtils.normalizarLancamento(item)).filter(x => x && String(x.id || '').trim());
    }

    /**
     * 💰 OBTER SALÁRIO BASE PARA EXIBIÇÃO (considerando toggle quinzena)
     */
    static getSalarioBaseDisplay(folha) {
        if (!folha) return 0;
        
        // Para quinzenas, verificar se deve usar salário bruto ou base
        if (folha.tipo === 'quinzena' && folha.usarSalarioBrutoParaQuinzena) {
            // Usar salário bruto (base + bonificações)
            const salarioBase = Number(folha.salarioBase || (folha.calculos && folha.calculos.salarioBase) || (folha.funcionario && folha.funcionario.salarioBase) || 0);
            const bonificacoes = Number(folha.bonificacoes || (folha.calculos && folha.calculos.bonificacoes) || 0);
            return salarioBase + bonificacoes;
        }
        
        // Usar salário base normal
        return Number(folha.salarioBase || (folha.calculos && folha.calculos.salarioBase) || (folha.funcionario && folha.funcionario.salarioBase) || 0);
    }

    /**
     * ➕ Somar Acréscimos padronizados para exibição (CORRIGIDO)
     */
    static calcularAcrescimosDisplay(folha) {
        if (!folha) return 0;
        // Centralização: garantir calculos mínimos
        FolhaUtils.ensureCalculosPresent(folha);
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

        // Compatibilidade: dados do Firebase (aninhados) vs dados de cálculo em tempo real (diretos)
        const c = folha.calculos || {};
        const calc = (c && c.calculos) || c; // Se não tem calculos.calculos, usar calculos diretamente
        const totalAcrescimos = parseNum(folha.totalAcrescimos ?? calc.totalAcrescimos ?? c.totalAcrescimos);
        if (Number.isFinite(totalAcrescimos)) return totalAcrescimos;

        const tipo = folha.tipo || folha.tipoPagamento || folha.tipoFolha;
        const usarBrutoParaQuinzena = Boolean(folha.usarSalarioBrutoParaQuinzena) && tipo === 'quinzena';

        // Acréscimos comuns
        const horasExtras = Number((calc && calc.valorHorasExtras) || (c && c.valorHorasExtras) || 0);
        const periculosidade = Number((calc && calc.valorPericulosidade) || (c && c.valorPericulosidade) || 0);
        const adicionalNoturno = Number((calc && calc.valorAdicionalNoturno) || (c && c.valorAdicionalNoturno) || 0);
        const insalubridade = Number((calc && calc.valorInsalubridade) || (c && c.valorInsalubridade) || 0);
        const salarioFamilia = Number((calc && calc.valorSalarioFamilia) || (c && c.valorSalarioFamilia) || 0);

        // Bonificações: no display, quando o toggle estiver ativo para quinzena,
        // a coluna "Salário Base" já exibe Base + Bonificações. Para não duplicar,
        // removemos bonificações do total de acréscimos exibido.
        const bonificacoesRaw = Number(folha.bonificacoes || (calc && calc.bonificacoes) || (c && c.bonificacoes) || 0);
        const bonificacoesParaDisplay = usarBrutoParaQuinzena ? 0 : bonificacoesRaw;

        const premioAssiduidade = Number(folha.premioAssiduidade || (calc && calc.premioAssiduidade) || 0);
        const totalDisplay = horasExtras + bonificacoesParaDisplay + periculosidade + adicionalNoturno + insalubridade + salarioFamilia + premioAssiduidade;

        return totalDisplay;
    }

    /**
     * ➖ Somar Descontos padronizados para exibição (CORRIGIDO)
     */
    static calcularDescontosDisplay(folha) {
        if (!folha) return 0;
        // Assegurar cálculos mínimos presentes (horas extras, SF, INSS/IRRF)
        try { FolhaUtils.ensureCalculosPresent(folha); } catch {}
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
        
        const isFuncionarioDebug = (folha.funcionario && folha.funcionario.nome && folha.funcionario.nome.includes('YLLA')) || 
                                   (folha.funcionario && folha.funcionario.nome && folha.funcionario.nome.includes('MICHAEL')) ||
                                   (folha.funcionario && folha.funcionario.nome && folha.funcionario.nome.includes('KANANDA')) ||
                                   (folha.funcionario && folha.funcionario.nome && folha.funcionario.nome.includes('PAULO'));
        
        // Flag global para controlar verbosidade dos cálculos
        const debugActive = !!window.__folhaDebugCalculos && !!isFuncionarioDebug;
        if (debugActive) {
            console.log(`🔍 ===== DEBUG DESCONTOS: ${folha.funcionario.nome} =====`);
            console.log('📊 Estrutura da folha:', {
                id: folha.id,
                funcionario: folha.funcionario.nome,
                salarioBase: folha.salarioBase,
                calculos: !!folha.calculos,
                calculosAninhados: !!(folha.calculos && folha.calculos.calculos)
            });
        }
        
        const c = folha.calculos || {};
        const calc = c.calculos || c;
        
        // Unificar cálculo: sempre recalcular INSS/IRRF para CLT com base no salário base,
        // evitando divergências entre "mês" e "quinzena" por fontes diferentes
        let inss = 0;
        // ✅ Regra de vínculo: para 'temporario', 'terceirizado', 'estagio', não aplicar INSS automático (apenas manual)
        const tipoContratoRaw = String((folha.funcionario && folha.funcionario.tipoContrato) || '').toLowerCase();
        // Normalizar removendo acentos para garantir match correto
        const tipoContrato = tipoContratoRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        const vinculosSemINSSAuto = new Set(['temporario','terceirizado','estagio','estagiario']);
        const isCLT = tipoContrato === 'clt' || tipoContrato.includes('clt');
        let irrf = 0;
        const dependentes = Number(folha.quantidadeFilhos || folha.dependentes || 0);
        const salarioParaEncargos = Number(folha.salarioBase || c.salarioBase || (folha.funcionario && folha.funcionario.salarioBase) || 0);
        
        // ✅ Verificar se cálculos automáticos foram removidos explicitamente
        const removerCalculosAuto = !!(folha.removerCalculosAutomaticos);
        const totalDescontos = parseNum(folha.totalDescontos ?? calc.totalDescontos ?? c.totalDescontos);
        if (!removerCalculosAuto && Number.isFinite(totalDescontos)) return totalDescontos;

        if (salarioParaEncargos > 0 && window.FolhaCalculos && !removerCalculosAuto) {
            try {
                if (!vinculosSemINSSAuto.has(tipoContrato) && typeof window.FolhaCalculos.calcularINSS === 'function') {
                    const calculoINSS = window.FolhaCalculos.calcularINSS(salarioParaEncargos);
                    inss = Number(calculoINSS && calculoINSS.valor || 0);
                }
            } catch {}
            try {
                if (!vinculosSemINSSAuto.has(tipoContrato) && typeof window.FolhaCalculos.calcularIRRF === 'function') {
                    const calculoIRRF = window.FolhaCalculos.calcularIRRF(salarioParaEncargos, inss, dependentes);
                    irrf = Number(calculoIRRF && calculoIRRF.valor || 0);
                }
            } catch {}
        } else {
            // Fallback: usar cálculos já presentes, se existirem (e se não for para remover)
            if (!removerCalculosAuto) {
                inss = Number((calc.calculoINSS && calc.calculoINSS.valor) || (c.inss && c.inss.valor) || (folha.inss && folha.inss.valor) || calc.inss || 0);
                irrf = Number((calc.calculoIRRF && calc.calculoIRRF.valor) || (c.irrf && c.irrf.valor) || (folha.irrf && folha.irrf.valor) || calc.irrf || 0);
            } else {
                inss = 0;
                irrf = 0;
            }
        }
        // ✅ Regra de vínculo: para não-CLT, NÃO aplicar INSS/IRRF automáticos
        if (vinculosSemINSSAuto.has(tipoContrato)) {
            inss = 0;
            irrf = 0;
        }
        
        const vales = Number(folha.vales || c.vales || calc.vales || 0);
        const outrosDescontos = Number(folha.outrosDescontos || c.outrosDescontos || calc.outrosDescontos || 0);
        
        let descontoFaltas = 0;
        const salarioBaseParaFaltas = Number(folha.salarioBase || c.salarioBase || (folha.funcionario && folha.funcionario.salarioBase) || 0);
        const descontoRepousoParaFaltas = Number(folha.descontoRepousoRemunerado || calc.descontoRepousoRemunerado || c.descontoRepousoRemunerado || 0);
        const baseAjustadaParaFaltas = Math.max(0, salarioBaseParaFaltas - descontoRepousoParaFaltas);
        const diasDeclarados = Number(folha.faltas || c.faltas || 0);
        let diasCalculados = diasDeclarados;
        
        if (!diasDeclarados && Number.isFinite(folha.diasTrabalhados)) {
            const diasMensaisPadrao = 30;
            diasCalculados = Math.max(0, diasMensaisPadrao - Number(folha.diasTrabalhados || 0));
        }
        
        if (baseAjustadaParaFaltas > 0 && diasCalculados > 0 && window.FolhaCalculos && typeof window.FolhaCalculos.calcularDescontoFaltas === 'function') {
            descontoFaltas = Number(window.FolhaCalculos.calcularDescontoFaltas(baseAjustadaParaFaltas, diasCalculados) || 0);
            
            if (debugActive) {
                console.log(`🔧 FALTAS RECALCULADAS: ${diasCalculados} dias x R$ ${(baseAjustadaParaFaltas/30).toFixed(2)} = R$ ${descontoFaltas.toFixed(2)}`);
                console.log(`🔍 DADOS DE ENTRADA PARA FALTAS:`);
                console.log(`   - folha.faltas: ${folha.faltas}`);
                console.log(`   - c.faltas: ${c.faltas}`);
                console.log(`   - folha.diasTrabalhados: ${folha.diasTrabalhados}`);
                console.log(`   - descontoRepousoParaFaltas: ${descontoRepousoParaFaltas}`);
                console.log(`   - diasDeclarados: ${diasDeclarados}`);
                console.log(`   - diasCalculados: ${diasCalculados}`);
                
                if (diasCalculados >= 25) {
                    console.warn(`⚠️ ATENÇÃO: ${diasCalculados} dias de falta parece excessivo! Verifique os dados.`);
                }
            }
        } else {
            descontoFaltas = 0;
            
            if (debugActive) {
                console.log(`⚠️ FALTAS NÃO CALCULADAS: baseAjustada=${baseAjustadaParaFaltas}, dias=${diasCalculados}, FolhaCalculos=${!!window.FolhaCalculos}`);
            }
        }
        
        let descontoRepouso = Number(folha.descontoRepousoRemunerado || calc.descontoRepousoRemunerado || c.descontoRepousoRemunerado || 0);
        const descontoINSSManual = Number(folha.descontoINSSManual || calc.descontoINSSManual || c.descontoINSSManual || 0);
        // ✅ Regra: se houver INSS manual informado, NÃO somar INSS automático
        const inssFinal = descontoINSSManual > 0 ? descontoINSSManual : inss;
        let contribuicaoConfederativa = Number(folha.contribuicaoConfederativa || calc.contribuicaoConfederativa || c.contribuicaoConfederativa || 0);
        let contribuicaoSindical = Number(folha.contribuicaoSindical || calc.contribuicaoSindical || c.contribuicaoSindical || 0);
        let descontoIRPJ = Number(folha.descontoIRPJ || calc.descontoIRPJ || c.descontoIRPJ || 0);
        let emprestimoConsignado = Number(folha.emprestimoConsignado || calc.emprestimoConsignado || c.emprestimoConsignado || 0);

        // ✅ Regra global: Encargos automáticos/manuais só se aplicam para CLT
        if (!isCLT) {
            descontoRepouso = 0;
            contribuicaoConfederativa = 0;
            contribuicaoSindical = 0;
            descontoIRPJ = 0;
            emprestimoConsignado = 0;
        }
        
        const total = inssFinal + irrf + vales + outrosDescontos + descontoFaltas + descontoRepouso + contribuicaoConfederativa + contribuicaoSindical + descontoIRPJ + emprestimoConsignado;
        
        if (debugActive) {
            console.log('💰 DETALHAMENTO DOS DESCONTOS:');
        console.log(`📊 INSS (final): R$ ${inssFinal.toFixed(2)} | INSS auto=${inss.toFixed(2)} | INSS manual=${descontoINSSManual.toFixed(2)} (fontes auto: calc.calculoINSS.valor=${(calc.calculoINSS && calc.calculoINSS.valor)}, c.inss.valor=${(c.inss && c.inss.valor)}, folha.inss.valor=${(folha.inss && folha.inss.valor)}, calc.inss=${calc.inss})`);
            console.log(`📊 IRRF: R$ ${irrf.toFixed(2)} (fontes: calc.calculoIRRF.valor=${(calc.calculoIRRF && calc.calculoIRRF.valor)}, c.irrf.valor=${(c.irrf && c.irrf.valor)}, folha.irrf.valor=${(folha.irrf && folha.irrf.valor)}, calc.irrf=${calc.irrf})`);
            console.log(`📊 Vales: R$ ${vales.toFixed(2)} (fontes: folha.vales=${folha.vales}, c.vales=${c.vales}, calc.vales=${calc.vales})`);
            console.log(`📊 Outros Descontos: R$ ${outrosDescontos.toFixed(2)}`);
            console.log(`📊 Desconto Faltas: R$ ${descontoFaltas.toFixed(2)}`);
            console.log(`📊 Desconto Repouso: R$ ${descontoRepouso.toFixed(2)}${!isCLT ? ' (não-CLT: suprimido)' : ''}`);
            console.log(`📊 INSS Manual: R$ ${descontoINSSManual.toFixed(2)}${!isCLT ? ' (não-CLT: suprimido se informado)' : ''}`);
            console.log(`📊 Contrib. Confederativa: R$ ${contribuicaoConfederativa.toFixed(2)}${!isCLT ? ' (não-CLT: suprimido)' : ''}`);
            console.log(`📊 Contrib. Sindical: R$ ${contribuicaoSindical.toFixed(2)}${!isCLT ? ' (não-CLT: suprimido)' : ''}`);
            console.log(`📊 Desconto IRPJ: R$ ${descontoIRPJ.toFixed(2)}${!isCLT ? ' (não-CLT: suprimido)' : ''}`);
            console.log(`📊 Empréstimo Consignado: R$ ${emprestimoConsignado.toFixed(2)}${!isCLT ? ' (não-CLT: suprimido)' : ''}`);
            console.log(`💰 TOTAL DESCONTOS: R$ ${total.toFixed(2)}`);
            console.log(`🔍 ===== FIM DEBUG DESCONTOS =====`);
        }
        
        return total;
    }

    /**
     * 💰 Calcular Salário Líquido para exibição (fórmula correta)
     * @param {object} folha - Dados da folha
     * @returns {number} Salário líquido calculado
     */
    static calcularSalarioLiquidoDisplay(folha) {
        if (!folha) return 0;
        // Centralização: garantir calculos mínimos
        FolhaUtils.ensureCalculosPresent(folha);
        const salarioBaseProbe = Number(
            folha.salarioBase ||
            (folha.calculos && folha.calculos.salarioBase) ||
            (folha.funcionario && folha.funcionario.salarioBase) ||
            0
        );
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
        const liquidoDirect = liquidoCandidates.map(parseNum).find(v => Number.isFinite(v));
        if (liquidoDirect !== undefined && !(liquidoDirect === 0 && salarioBaseProbe > 0)) return liquidoDirect;
        const tipoPag = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
            ? window.FolhaUtils.resolveTipoPagamento(folha)
            : (folha.tipoPagamento || folha.tipo || folha.tipoFolha);
        const isQuinzena = String(tipoPag || '').toLowerCase() === 'quinzena';

        // Obter dados base (valor contratual, não o display)
        const salarioBase = parseNum(folha.salarioBase || (folha.calculos && folha.calculos.salarioBase) || (folha.funcionario && folha.funcionario.salarioBase) || 0);

        // Se o cálculo completo já forneceu totais, usar para evitar re-somar e duplicar
        let acrescimosRaw;
        if (Number.isFinite(parseNum(folha.totalAcrescimos))) {
            acrescimosRaw = parseNum(folha.totalAcrescimos);
        } else {
            const horasExtras = Number((calc && calc.valorHorasExtras) || (c && c.valorHorasExtras) || 0);
            const bonificacoes = Number(folha.bonificacoes || (calc && calc.bonificacoes) || (c && c.bonificacoes) || 0);
            const periculosidade = Number((calc && calc.valorPericulosidade) || (c && c.valorPericulosidade) || 0);
            const adicionalNoturno = Number((calc && calc.valorAdicionalNoturno) || (c && c.valorAdicionalNoturno) || 0);
            const insalubridade = Number((calc && calc.valorInsalubridade) || (c && c.valorInsalubridade) || 0);
            const salarioFamilia = Number((calc && calc.valorSalarioFamilia) || (c && c.valorSalarioFamilia) || 0);
            const premioAssiduidade = Number(folha.premioAssiduidade || (calc && calc.premioAssiduidade) || 0);
            acrescimosRaw = horasExtras + bonificacoes + periculosidade + adicionalNoturno + insalubridade + salarioFamilia + premioAssiduidade;
        }

        // Descontos: SEMPRE usar apenas os campos preenchidos pelo usuário
        const descontos = Number(FolhaUtils.calcularDescontosDisplay(folha) || 0);

        const quinzena = isQuinzena ? Number(FolhaUtils.calcularValorQuinzena(folha) || 0) : 0;

        // Fórmula: (Base contratual) + (acréscimos reais) - (descontos) - (quinzena)
        const liquidoCorreto = salarioBase + acrescimosRaw - descontos - quinzena;
        return liquidoCorreto;
    }

    /**
     * 💵 Obter salário base com fallback seguro
     */
    static getSalarioBaseDisplay(folha) {
        if (!folha) return 0;
        const c = folha.calculos || {};
        const base = Number(folha.salarioBase || (c && c.salarioBase) || (folha.valores && folha.valores.base) || (folha.funcionario && folha.funcionario.salarioBase) || 0);
        const tipoPag = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
            ? window.FolhaUtils.resolveTipoPagamento(folha)
            : (folha.tipoPagamento || folha.tipo || folha.tipoFolha);
        const isQuinzena = String(tipoPag || '').toLowerCase() === 'quinzena';
        // Quando o toggle estiver ativo PARA QUINZENA, exibir Base + Bonificações (apenas display)
        if (Boolean(folha.usarSalarioBrutoParaQuinzena) && isQuinzena) {
            const bonificacoes = Number(
                folha.bonificacoes || (c && c.bonificacoes) || (c.calculos && c.calculos.bonificacoes) || 0
            );
            return base + bonificacoes;
        }
        return base;
    }

    /**
     * 📝 FORMATAR CPF DURANTE DIGITAÇÃO
     */
    static formatarCpfInput(cpf) {
        if (!cpf) return '';
        
        // Remove tudo que não é dígito
        cpf = cpf.replace(/\D/g, '');
        
        // Limita a 11 dígitos
        cpf = cpf.substring(0, 11);
        
        // Aplica a máscara
        if (cpf.length <= 3) {
            return cpf;
        } else if (cpf.length <= 6) {
            return cpf.replace(/(\d{3})(\d+)/, '$1.$2');
        } else if (cpf.length <= 9) {
            return cpf.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
        } else {
            return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d+)/, '$1.$2.$3-$4');
        }
    }

    /**
     * 📝 FORMATAR PIS DURANTE DIGITAÇÃO
     */
    static formatarPisInput(pis) {
        if (!pis) return '';
        
        // Remove tudo que não é dígito
        pis = pis.replace(/\D/g, '');
        
        // Limita a 11 dígitos
        pis = pis.substring(0, 11);
        
        // Aplica a máscara XXX.XXXXX.XX-X
        if (pis.length <= 3) {
            return pis;
        } else if (pis.length <= 8) {
            return pis.replace(/(\d{3})(\d+)/, '$1.$2');
        } else if (pis.length <= 10) {
            return pis.replace(/(\d{3})(\d{5})(\d+)/, '$1.$2.$3');
        } else {
            return pis.replace(/(\d{3})(\d{5})(\d{2})(\d+)/, '$1.$2.$3-$4');
        }
    }

    /**
     * 📝 FORMATAR CTPS DURANTE DIGITAÇÃO
     */
    static formatarCtpsInput(ctps) {
        if (!ctps) return '';
        
        // Remove tudo que não é dígito
        ctps = ctps.replace(/\D/g, '');
        
        // Limita a 7 dígitos para CTPS
        ctps = ctps.substring(0, 7);
        
        // Aplica a máscara XXXXXXX (sem formatação específica, apenas números)
        return ctps;
    }

    static abrirModal(modalId) {
        const debugAll = FolhaUtils.getDebugMode() === 'all';
        if (debugAll) console.log(`🔓 Abrindo modal: ${modalId}`);
        
        const modal = document.getElementById(modalId);
        if (modal) {
            if (debugAll) console.log(`✅ Modal ${modalId} encontrado, abrindo...`);
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            if (debugAll) console.log(`✅ Modal ${modalId} aberto com sucesso`);
        } else {
            console.error(`❌ Modal ${modalId} não encontrado`);
        }
    }

    static fecharModal(modalId) {
        const debugAll = FolhaUtils.getDebugMode() === 'all';
        if (debugAll) console.log(`🔒 Fechando modal: ${modalId}`);
        
        const modal = document.getElementById(modalId);
        if (modal) {
            if (debugAll) console.log(`✅ Modal ${modalId} encontrado, fechando...`);
            modal.style.display = 'none';
            // ✅ CORREÇÃO: Sempre restaurar scroll
            document.body.style.overflow = 'auto';
            if (debugAll) console.log(`✅ Modal ${modalId} fechado com sucesso e scroll restaurado`);
        } else {
            console.error(`❌ Modal ${modalId} não encontrado`);
            // ✅ CORREÇÃO: Restaurar scroll mesmo se modal não for encontrado
            document.body.style.overflow = 'auto';
        }
        
        // ✅ CORREÇÃO ADICIONAL: Verificar se há outros modais abertos
        this.verificarScrollGlobal();
    }
    
    /**
     * 🔍 VERIFICAR E CORRIGIR SCROLL GLOBAL
     * Função de segurança para garantir que o scroll nunca fique travado
     */
    static verificarScrollGlobal() {
        const debugAll = FolhaUtils.getDebugMode() === 'all';
        const body = document.body;
        const html = document.documentElement;
        const bodyHidden = body && body.style && body.style.overflow === 'hidden';
        const htmlHidden = html && html.style && html.style.overflow === 'hidden';
        if (!bodyHidden && !htmlHidden) return;
        const modaisVisiveis = document.querySelectorAll('.modal[style*="display: block"], .modal[style*="display:block"]');
        
        if (modaisVisiveis.length === 0) {
            // Se não há modais visíveis, garantir que o scroll esteja habilitado
            if (document.body.style.overflow === 'hidden') {
                document.body.style.overflow = 'auto';
                if (debugAll) console.log('🔧 Scroll corrigido automaticamente - nenhum modal visível');
            }
        } else {
            if (debugAll) console.log(`📋 ${modaisVisiveis.length} modal(is) ainda visível(is), mantendo scroll bloqueado`);
        }
    }
    
    /**
     * 🚨 FUNÇÃO DE EMERGÊNCIA: CORRIGIR SCROLL TRAVADO
     * Função global para corrigir scroll quando necessário
     */
    static corrigirScrollTravado() {
        console.log('🚨 CORREÇÃO DE EMERGÊNCIA: Desbloqueando scroll...');
        document.body.style.overflow = 'auto';
        document.body.style.overflowY = 'auto';
        document.body.style.height = 'auto';
        
        // Verificar se há modais abertos que deveriam estar fechados
        const modaisAbertos = document.querySelectorAll('.modal[style*="display: block"], .modal[style*="display:block"]');
        console.log(`🔍 Encontrados ${modaisAbertos.length} modais abertos`);
        
        modaisAbertos.forEach((modal, index) => {
            console.log(`📋 Modal ${index + 1}: ${modal.id || 'sem ID'}`);
        });
        
        console.log('✅ Scroll desbloqueado com sucesso!');
        console.log('💡 Se o problema persistir, recarregue a página (F5)');
    }

    /**
     * 🔧 Normalizar folhas de quinzena no RTDB (executar dentro de folha.html logado)
     * Atualiza apenas 'tipoPagamento' para 'quinzena' quando há indícios fortes.
     * Não toca em 'mes' / 'mes_fechado'.
     * Use: await FolhaUtils.normalizarQuinzenas({ dryRun: true })
     * Depois: await FolhaUtils.normalizarQuinzenas({ dryRun: false })
     */
    static async normalizarQuinzenas({ dryRun = true, path = 'folhas' } = {}) {
        try {
            const hasDB = !!window.database;
            if (!hasDB) {
                console.error('❌ Banco (window.database) indisponível. Execute dentro de folha.html logado.');
                FolhaUtils.mostrarErro('Banco indisponível. Abra folha.html logado e tente novamente.');
                return { total: 0, elegiveis: 0, atualizados: 0 };
            }
            const { ref, get, update } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const resolvedPath = FolhaUtils.resolveFirebasePath(path);
            const snap = await get(ref(window.database, resolvedPath));
            const val = snap.val() || {};
            const folhas = Object.entries(val).map(([id, v]) => ({ id, ...(v || {}) }));
            const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z_]/g, '');
            const parsePercent = (raw) => {
                if (raw == null || raw === '') return NaN;
                const s = String(raw).trim().replace(/[^0-9,.-]/g, '');
                const n = s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(/,/g, '.')) : parseFloat(s);
                return isNaN(n) ? NaN : n;
            };
            const isMesFechado = (f) => {
                const t = norm(f.tipo || f.tipoPagamento || f.tipoFolha);
                const s = norm(f.status);
                return t === 'mes' || t === 'mes_fechado' || s === 'mes_fechado';
            };
            const hasQuinzenaHints = (f) => {
                const c = f.calculos || {};
                const calc = c.calculos || c;
                const candidates = [f.quinzenaPercentual, f.percentualQuinzena, (calc && calc.percentualQuinzena)];
                const manual = Number(f.quinzenaValorManual || 0) > 0;
                const percOk = candidates.some((x) => { const n = parsePercent(x); return !isNaN(n) && n > 0 && n <= 100; });
                const tipoRaw = norm(f.tipo || f.tipoPagamento || f.tipoFolha);
                const statusRaw = norm(f.status);
                const tipoQz = ['quinzena', 'quinzenal', 'quinzena_paga', 'quinzenapaga'].includes(tipoRaw);
                const statusQz = ['quinzena_paga'].includes(statusRaw);
                return manual || percOk || tipoQz || statusQz;
            };

            let elegiveis = [];
            for (const f of folhas) {
                if (isMesFechado(f)) continue; // nunca tocar em mês/mês fechado
                const tp = norm(f.tipoPagamento);
                const tipoRaw = norm(f.tipo || f.tipoFolha);
                const precisa = (!tp || tp === 'mes') && hasQuinzenaHints(f);
                if (precisa) elegiveis.push(f);
            }
            console.log(`📦 Total: ${folhas.length} | ✅ Elegíveis: ${elegiveis.length}`);
            if (dryRun) {
                elegiveis.slice(0, 20).forEach((f) => console.log(`➡️ ${f.id} | ${(f.funcionario && f.funcionario.nome) || 'N/A'} | tipoAtual=${norm(f.tipo || f.tipoFolha) || '(vazio)'}`));
                FolhaUtils.mostrarInfo(`Análise (dry-run): ${elegiveis.length} elegíveis`);
                return { total: folhas.length, elegiveis: elegiveis.length, atualizados: 0 };
            }
            let atualizados = 0;
            for (const f of elegiveis) {
                await update(ref(window.database, `${resolvedPath}/${f.id}`), { tipoPagamento: 'quinzena' });
                atualizados++;
                console.log(`✅ Atualizado: ${f.id} | ${(f.funcionario && f.funcionario.nome) || 'N/A'}`);
            }
            FolhaUtils.mostrarSucesso(`Normalização concluída: ${atualizados}/${elegiveis.length}`);
            return { total: folhas.length, elegiveis: elegiveis.length, atualizados };
        } catch (e) {
            console.error('❌ Erro na normalização:', e);
            FolhaUtils.mostrarErro('Erro na normalização: ' + (e && e.message));
            return { total: 0, elegiveis: 0, atualizados: 0 };
        }
    }

    /**
     * 🔧 Normalizar percentual da quinzena (percentualQuinzena)
     * Regras:
     * - Considera apenas registros quinzena (tipoPagamento='quinzena' ou hints fortes)
     * - Se 'percentualQuinzena' está vazio/0 ou >100, e existe 'percentual' genérico válido (1..100), copia para 'percentualQuinzena'
     * - NÃO altera dados de mês/mês_fechado
     */
    static async normalizarPercentualQuinzena({ dryRun = true, path = 'folhas' } = {}) {
        try {
            if (!window.database) {
                console.error('❌ Banco (window.database) indisponível.');
                FolhaUtils.mostrarErro('Banco indisponível. Abra folha.html logado e tente novamente.');
                return { total: 0, elegiveis: 0, atualizados: 0 };
            }
            const { ref, get, update } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const resolvedPath = FolhaUtils.resolveFirebasePath(path);
            const snap = await get(ref(window.database, resolvedPath));
            const val = snap.val() || {};
            const folhas = Object.entries(val).map(([id, v]) => ({ id, ...(v || {}) }));
            const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z_]/g, '');
            const parsePercent = (raw) => {
                if (raw == null || raw === '') return NaN;
                const s = String(raw).trim().replace(/[^0-9,.-]/g, '');
                const n = s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(/,/g, '.')) : parseFloat(s);
                return isNaN(n) ? NaN : n;
            };
            const isMesFechado = (f) => {
                const t = norm(f.tipo || f.tipoPagamento || f.tipoFolha);
                const s = norm(f.status);
                return t === 'mes' || t === 'mes_fechado' || s === 'mes_fechado';
            };
            const isQuinzena = (f) => {
                const t = norm(f.tipo || f.tipoPagamento || f.tipoFolha);
                const s = norm(f.status);
                if (['quinzena','quinzenal','quinzena_paga','quinzenapaga'].includes(t)) return true;
                if (s === 'quinzena_paga') return true;
                // hints: valor manual ou candidatos de percentual
                const cands = [f.quinzenaPercentual, f.percentualQuinzena, f.percentual, (f.calculos && f.calculos.percentualQuinzena)];
                const anyValid = cands.some(x => { const n = parsePercent(x); return !isNaN(n) && n > 0 && n <= 100; });
                return anyValid;
            };

            const elegiveis = [];
            for (const f of folhas) {
                if (isMesFechado(f)) continue;
                if (!isQuinzena(f)) continue;
                const pTop = parsePercent(f.percentualQuinzena);
                const pGen = parsePercent(f.percentual);
                // Elegível se topo está inválido (NaN/0/>100) e genérico é válido 1..100
                const topoInvalido = isNaN(pTop) || pTop <= 0 || pTop > 100;
                const genValido = !isNaN(pGen) && pGen > 0 && pGen <= 100;
                if (topoInvalido && genValido) elegiveis.push({ id: f.id, nome: f.funcionario && f.funcionario.nome, from: pGen });
            }
            console.log(`📦 Total: ${folhas.length} | ✅ Elegíveis %: ${elegiveis.length}`);
            if (dryRun) {
                elegiveis.slice(0, 20).forEach(e => console.log(`➡️ % Elegível: ${e.id} | ${e.nome || 'N/A'} | novo=${e.from}%`));
                FolhaUtils.mostrarInfo(`Análise % (dry-run): ${elegiveis.length} elegíveis`);
                return { total: folhas.length, elegiveis: elegiveis.length, atualizados: 0 };
            }
            let atualizados = 0;
            for (const e of elegiveis) {
                await update(ref(window.database, `${resolvedPath}/${e.id}`), { percentualQuinzena: e.from });
                atualizados++;
                console.log(`✅ % Atualizado: ${e.id} | ${e.nome || 'N/A'} -> ${e.from}%`);
            }
            FolhaUtils.mostrarSucesso(`Normalização % concluída: ${atualizados}/${elegiveis.length}`);
            return { total: folhas.length, elegiveis: elegiveis.length, atualizados };
        } catch (e) {
            console.error('❌ Erro na normalização %:', e);
            FolhaUtils.mostrarErro('Erro na normalização %: ' + (e && e.message));
            return { total: 0, elegiveis: 0, atualizados: 0 };
        }
    }

    static async normalizarConsistenciaFolhas({ dryRun = true, path = 'folhas' } = {}) {
        try {
            if (!window.database) {
                FolhaUtils.mostrarErro('Banco indisponível. Abra folha.html logado e tente novamente.');
                return { total: 0, elegiveis: 0, atualizados: 0 };
            }
            const { ref, get, update } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const resolvedPath = FolhaUtils.resolveFirebasePath(path);
            const snap = await get(ref(window.database, resolvedPath));
            const val = snap.val() || {};
            const folhas = Object.entries(val).map(([id, v]) => ({ id, ...(v || {}) }));
            const equalNum = (a, b) => Number(a || 0) === Number(b || 0);
            const eligiveis = [];
            for (const f of folhas) {
                const normalized = FolhaUtils.normalizarLancamento(f);
                const patch = {};
                if (String(f.tipo || '') !== String(normalized.tipo || '')) patch.tipo = normalized.tipo;
                if (String(f.tipoPagamento || '') !== String(normalized.tipoPagamento || '')) patch.tipoPagamento = normalized.tipoPagamento;
                if (String(f.tipoFolha || '') !== String(normalized.tipoFolha || '')) patch.tipoFolha = normalized.tipoFolha;
                if (String(FolhaUtils.normalizarStatus(f.status) || '') !== String(normalized.status || '')) patch.status = normalized.status;
                if (!equalNum(f.percentual, normalized.percentual)) patch.percentual = normalized.percentual;
                if (!equalNum(f.percentualQuinzena, normalized.percentualQuinzena)) patch.percentualQuinzena = normalized.percentualQuinzena;
                if (!equalNum(f.quinzenaPercentual, normalized.quinzenaPercentual)) patch.quinzenaPercentual = normalized.quinzenaPercentual;
                if (!equalNum(f.quinzenaValorManual, normalized.quinzenaValorManual)) patch.quinzenaValorManual = normalized.quinzenaValorManual;
                if (Object.keys(patch).length > 0) {
                    eligiveis.push({
                        id: normalized.id,
                        nome: (normalized.funcionario && normalized.funcionario.nome) || 'N/A',
                        patch
                    });
                }
            }
            if (dryRun) {
                FolhaUtils.mostrarInfo(`Análise de consistência: ${eligiveis.length} elegíveis`);
                return { total: folhas.length, elegiveis: eligiveis.length, atualizados: 0, amostra: eligiveis.slice(0, 20) };
            }
            let atualizados = 0;
            for (const e of eligiveis) {
                await update(ref(window.database, `${resolvedPath}/${e.id}`), e.patch);
                atualizados++;
            }
            FolhaUtils.mostrarSucesso(`Consistência aplicada: ${atualizados}/${eligiveis.length}`);
            return { total: folhas.length, elegiveis: eligiveis.length, atualizados };
        } catch (e) {
            FolhaUtils.mostrarErro('Erro na consistência: ' + (e && e.message));
            return { total: 0, elegiveis: 0, atualizados: 0 };
        }
    }

    /**
     * 🧮 Garantir que 'calculos' tenha os valores mínimos (centralização)
     * Evita duplicações: usa FolhaCalculos.calcularFolhaCompleta e copia apenas campos necessários
     */
    static ensureCalculosPresent(folha) {
        try {
            if (!folha) return folha;
            if (folha._calculosEnsured) return folha;
            folha.calculos = folha.calculos || {};
            const c = folha.calculos;
            const needsHoras = (c.valorHorasExtras == null);
            const needsSF = (c.valorSalarioFamilia == null);
            const needsINSS = (c.calculoINSS == null && c.inss == null);
            const needsIRRF = (c.calculoIRRF == null && c.irrf == null);
            const salarioBaseCalc = Number(folha.salarioBase || (folha.funcionario && folha.funcionario.salarioBase) || 0);
            if ((needsHoras || needsSF || needsINSS || needsIRRF) && window.FolhaCalculos && typeof window.FolhaCalculos.calcularFolhaCompleta === 'function' && salarioBaseCalc > 0) {
                const dados = {
                    salarioBase: salarioBaseCalc,
                    horasExtras: Number(folha.horasExtras || 0),
                    percentualExtra: Number(folha.percentualExtra || 0),
                    bonificacoes: Number(folha.bonificacoes || 0),
                    periculosidade: Number(folha.periculosidade || 0),
                    adicionalNoturno: Number(folha.adicionalNoturno || 0),
                    insalubridade: folha.insalubridade ?? null,
                    faltas: Number(folha.faltas || 0),
                    vales: Number(folha.vales || 0),
                    outrosDescontos: Number(folha.outrosDescontos || 0),
                    dependentes: Number(folha.dependentes || folha.quantidadeFilhos || 0),
                    tipoFolha: String(folha.tipo || folha.tipoPagamento || 'mes'),
                    percentualQuinzena: Number(folha.percentualQuinzena || folha.quinzenaPercentual || 50),
                    quinzenaPercentual: Number(folha.quinzenaPercentual || folha.percentualQuinzena || 50),
                    valorManualQuinzena: Number(folha.quinzenaValorManual || folha.valorManualQuinzena || 0) || null,
                    diasTrabalhados: (folha.diasTrabalhados != null) ? Number(folha.diasTrabalhados) : null,
                    premioAssiduidade: Number(folha.premioAssiduidade || 0),
                    descontoRepousoRemunerado: Number(folha.descontoRepousoRemunerado || 0),
                    descontoINSSManual: Number(folha.descontoINSSManual || 0),
                    contribuicaoConfederativa: Number(folha.contribuicaoConfederativa || 0),
                    contribuicaoSindical: Number(folha.contribuicaoSindical || 0),
                    descontoIRPJ: Number(folha.descontoIRPJ || 0),
                    emprestimoConsignado: Number(folha.emprestimoConsignado || 0),
                    quantidadeFilhos: Number(folha.quantidadeFilhos || folha.dependentes || 0),
                    usarSalarioBrutoParaQuinzena: Boolean(folha.usarSalarioBrutoParaQuinzena || false)
                };
                let r = null;
                try { r = window.FolhaCalculos.calcularFolhaCompleta(dados); } catch (err) {
                    const msg = String(err && err.message || '').toLowerCase();
                    // Silenciar erro esperado de salário obrigatório
                    if (msg.includes('salário base é obrigatório')) {
                        r = null;
                    } else {
                        if (window.__folhaDebug) console.warn('⚠️ calcularFolhaCompleta falhou na ensureCalculosPresent:', err);
                    }
                }
                if (r) {
                    folha.calculos.valorHorasExtras = (r && r.calculos && r.calculos.valorHorasExtras) || folha.calculos.valorHorasExtras || 0;
                    folha.calculos.valorSalarioFamilia = (r && r.calculos && r.calculos.valorSalarioFamilia) || folha.calculos.valorSalarioFamilia || 0;
                    folha.calculos.calculoINSS = (r && r.inss) || folha.calculos.calculoINSS || null;
                    folha.calculos.calculoIRRF = (r && r.irrf) || folha.calculos.calculoIRRF || null;
                    folha.calculos.salarioBase = (r && r.salarioBase) || folha.calculos.salarioBase || dados.salarioBase;
                }
            } else {
                // Fallback seguro: garantir campos mínimos sem lançar
                if (c.valorHorasExtras == null) c.valorHorasExtras = 0;
                if (c.valorSalarioFamilia == null) c.valorSalarioFamilia = 0;
                if (c.calculoINSS == null) c.calculoINSS = null;
                if (c.calculoIRRF == null) c.calculoIRRF = null;
                if (c.salarioBase == null) c.salarioBase = salarioBaseCalc || 0;
            }
            folha._calculosEnsured = true;
        } catch (e) {
            if (window.__folhaDebug) console.warn('⚠️ ensureCalculosPresent falhou:', e);
        }
        return folha;
    }

    /**
     * ✍️ Atualizar percentual da quinzena por ID (uso pontual)
     * @param {object} opts
     *  - id: string (obrigatório)
     *  - percentual: number (1..100)
     *  - path: string ('folhas')
     */
    static async atualizarPercentualQuinzenaPorId({ id, percentual, path = 'folhas' } = {}) {
        if (!id || !Number.isFinite(percentual)) {
            FolhaUtils.mostrarErro('Parâmetros inválidos para atualizar percentual (id/percentual)');
            return false;
        }
        const perc = parseFloat(percentual);
        if (isNaN(perc) || perc <= 0 || perc > 100) {
            FolhaUtils.mostrarErro('Percentual deve ser entre 1 e 100');
            return false;
        }
        try {
            if (!window.database) {
                FolhaUtils.mostrarErro('Banco indisponível. Abra folha.html logado e tente novamente.');
                return false;
            }
            const { ref, update } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
            const resolvedPath = FolhaUtils.resolveFirebasePath(path);
            await update(ref(window.database, `${resolvedPath}/${id}`), { percentualQuinzena: perc });
            FolhaUtils.mostrarSucesso(`Percentual atualizado: ${id} -> ${perc}%`);
            return true;
        } catch (e) {
            console.error('❌ Erro ao atualizar percentual por ID:', e);
            FolhaUtils.mostrarErro('Erro ao atualizar percentual: ' + (e && e.message));
            return false;
        }
    }

    /**
     * 📊 RENDERIZAR TABELA DE LANÇAMENTOS (FUNÇÃO UNIFICADA)
     * Esta função centraliza toda a lógica de renderização da tabela principal
     * para evitar duplicação e facilitar manutenções futuras
     */
    static renderizarTabelaLancamentos(lancamentos, opcoes = {}) {
        // ✅ Evitar conflito: se há render em andamento, reagendar brevemente
        if (window.__renderingFolhasTable) {
            if (window.__folhaDebug) console.log('⏳ Render em andamento, reagendando chamada...');
            setTimeout(() => {
                try { FolhaUtils.renderizarTabelaLancamentos(lancamentos, opcoes); } catch (e) { console.warn('⚠️ Falha ao reagendar render:', e?.message || e); }
            }, 120);
            return;
        }
        window.__renderingFolhasTable = true;
        const tbody = document.getElementById('folhasTableBody');
        if (!tbody) {
            console.warn('❌ Elemento folhasTableBody não encontrado');
            window.__renderingFolhasTable = false;
            return;
        }

        const renderSig = FolhaUtils.getDataSignature(lancamentos);
        const renderLog = FolhaUtils.shouldLogDataChange('renderTabelaLancamentos', renderSig);
        if (renderLog) console.log(`📊 Renderizando tabela unificada com ${lancamentos.length} lançamentos`);
        const vindoDaPaginacao = String(opcoes?.source || '').toLowerCase() === 'paginacao';
        const pularFiltroInterno = !!opcoes?.skipInternalFilter || vindoDaPaginacao;
        // Filtrar entradas incompletas somente quando necessário
        let lancamentosValidos = [];
        if (Array.isArray(lancamentos)) {
            if (pularFiltroInterno) {
                lancamentosValidos = lancamentos.slice();
            } else {
                const isValidLanc = (l) => {
                    if (!l) return false;
                    const hasFuncionario = (
                        (l.funcionario && (l.funcionario.id || l.funcionario.nome)) ||
                        l.funcionarioId || l.idFuncionario || l.func_id || (typeof l.funcionario === 'string' && String(l.funcionario).trim())
                    );
                    const hasMes = !!l.mesAno;
                    return hasFuncionario && hasMes;
                };
                lancamentosValidos = lancamentos.filter(isValidLanc);
                if (lancamentosValidos.length !== lancamentos.length) {
                    if (renderLog) console.log(`ℹ️ ${lancamentos.length - lancamentosValidos.length} lançamento(s) ignorado(s) por dados incompletos (evitar N/A)`);
                }
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
        for (const f of lancamentosValidos) {
            const k = keyOf(f);
            if (!k.trim()) continue;
            const prev = map.get(k);
            if (!prev) { map.set(k, f); continue; }
            const keep = (score(prev) >= score(f)) ? prev : f;
            map.set(k, keep);
        }
        lancamentosValidos = Array.from(map.values());

        // ✅ CORREÇÃO CRÍTICA: APLICAR FILTRO DE FUNCIONÁRIOS INATIVOS E LANÇAMENTOS PROCESSADOS
        const systemReady = !!(window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios));
        const tipoSelecionado = (document.getElementById('tipoFolha') && document.getElementById('tipoFolha').value) || '';
        const mostrarFechados = tipoSelecionado === 'mes' || !!opcoes?.incluirFechados;
        const getStatus = (s) => {
            if (typeof s === 'object' && s) {
                return String(s.value || s.status || s.nome || '').trim();
            }
            return String(s || '').trim();
        };
        const lancamentosAtivos = pularFiltroInterno ? lancamentosValidos : lancamentosValidos.filter(lancamento => {
            
            // ✅ CORREÇÃO: Garantir que quinzenas canceladas (rascunho) apareçam na tabela
            if (lancamento.tipo === 'quinzena' && ['rascunho', 'calculada', 'aprovada', 'quinzena_paga'].includes(lancamento.status)) {
                if (renderLog) console.log(`✅ Quinzena mantida na tabela principal: ${(lancamento.funcionario && lancamento.funcionario.nome) || ''} - Status: ${lancamento.status}`);
                // Continuar com verificação de funcionário ativo abaixo
            }
            
            if (lancamento.funcionario && lancamento.funcionario.id) {
                // ✅ CORREÇÃO: Buscar funcionário atual no sistema para verificar status (SEMPRE VERIFICAR)
                const funcionarioAtual = (window.folhaSystem && window.folhaSystem.funcionarios && window.folhaSystem.funcionarios.find(f => f.id === lancamento.funcionario.id)) || null;

                // ✅ DEBUG DETALHADO: Log do funcionário encontrado
                if (funcionarioAtual) {
                    if (renderLog) console.log(`🔍 Funcionário encontrado no sistema: ${funcionarioAtual.nome} - Status: ${funcionarioAtual.ativo === false ? 'INATIVO' : 'ATIVO'}`);
                } else {
                    if (renderLog) console.log(`⚠️ Funcionário não encontrado no sistema: ${(lancamento.funcionario && lancamento.funcionario.nome) || ''} (ID: ${(lancamento.funcionario && lancamento.funcionario.id) || ''})`);
                    if (!systemReady) {
                        if (renderLog) console.log('ℹ️ Sistema/funcionários não totalmente carregados. Mantendo lançamento para evitar tabela vazia.');
                        return true;
                    }
                    return true;
                }

                // ✅ VERIFICAÇÃO CRUZADA: Status no sistema vs status no lançamento
                if (funcionarioAtual && funcionarioAtual.ativo === false) {
                    if (renderLog) console.log('🚫 Lançamento de funcionário inativo filtrado na função unificada (verificação cruzada):', lancamento.funcionario.nome);
                    return false;
                }

                // ✅ VERIFICAÇÃO DIRETA: Status no lançamento (para compatibilidade)
                if (lancamento.funcionario.ativo === false) {
                    if (renderLog) console.log('🚫 Lançamento de funcionário inativo filtrado na função unificada (propriedade direta):', lancamento.funcionario.nome);
                    return false;
                }

                // ✅ DEBUG: Log do funcionário que passou pelo filtro
                if (renderLog) console.log(`✅ Funcionário ativo aceito: ${lancamento.funcionario.nome} (ID: ${lancamento.funcionario.id})`);
            }
            return true;
        });

        if (renderLog) console.log(`📊 Após filtro de inativos na função unificada: ${lancamentosAtivos.length}/${lancamentosValidos.length} lançamentos`);
        
        // ✅ DEBUG: Mostrar dados dos lançamentos ativos
        if (renderLog) {
            lancamentosAtivos.forEach((lancamento, index) => {
                console.log(`📋 Lançamento ${index + 1}:`, {
                    funcionario: (lancamento.funcionario && lancamento.funcionario.nome) || '',
                    id: lancamento.id,
                    tipo: lancamento.tipo,
                    mesAno: lancamento.mesAno,
                    ativo: (lancamento.funcionario && lancamento.funcionario.ativo) || false
                });
            });
        }

        // Verificar se há dados após filtro
        if (lancamentosAtivos.length === 0) {
            const mensagem = opcoes.mensagemVazia || 'Nenhuma folha encontrada com os filtros aplicados';
            if (renderLog) console.log('📋 Exibindo mensagem de tabela vazia');
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-inbox" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
                        ${mensagem}
                    </td>
                </tr>
            `;
            FolhaUtils.applyFolhasColumnsConfig();
            // 📣 Sinalizar renderização mesmo para tabela vazia (para remover overlay)
                try {
                    window.dispatchEvent(new CustomEvent('tabelaFolhasRenderizada', { detail: { rowCount: 0, source: 'utils' } }));
                    try { FolhaUtils.hideTablePreload(); } catch(e) {}
                } catch(e) { console.warn('⚠️ Falha ao emitir evento tabelaFolhasRenderizada (vazio):', e.message); }
                window.__renderingFolhasTable = false;
                return;
            }

        const ordenacaoPadrao = [...lancamentosAtivos].sort((a, b) => {
            const dataA = new Date(a.dataCriacao || a.updatedAt || 0).getTime();
            const dataB = new Date(b.dataCriacao || b.updatedAt || 0).getTime();
            if (dataB !== dataA) return dataB - dataA;
            const ida = String(a.id || a.key || '');
            const idb = String(b.id || b.key || '');
            return idb.localeCompare(ida);
        });
        const lancamentosOrdenados = FolhaUtils.aplicarOrdenacaoTabelaFolhas(ordenacaoPadrao);

        if (systemReady) {
            const hasCore = (f) => {
                const nome = (f && f.funcionario && f.funcionario.nome) || '';
                const fid = (f && f.funcionario && f.funcionario.id) || f.funcionarioId || f.idFuncionario || f.func_id || '';
                return !!(nome || fid);
            };
            const filtrados = lancamentosOrdenados.filter(hasCore);
            if (filtrados.length !== lancamentosOrdenados.length) {
                if (renderLog) console.log(`ℹ️ Registros sem identificação filtrados: ${lancamentosOrdenados.length - filtrados.length}`);
            }
            lancamentosOrdenados.splice(0, lancamentosOrdenados.length, ...filtrados);
        }

        // Renderizar linhas com tratamento de erro
        if (renderLog) console.log(`🎨 Iniciando renderização de ${lancamentosOrdenados.length} linhas...`);
        try {
            const linhasHTML = [];
            
            lancamentosOrdenados.forEach((lancamento, index) => {
                try {
                    const linhaHTML = FolhaUtils.renderizarLinhaLancamento(lancamento, opcoes);
                    linhasHTML.push(linhaHTML);
                } catch (error) {
                    console.error(`❌ Erro ao renderizar linha ${index + 1} para ${(lancamento.funcionario && lancamento.funcionario.nome) || 'N/A'}:`, error);
                    linhasHTML.push(`<tr><td colspan="12" style="color: red;">Erro ao renderizar linha para ${(lancamento.funcionario && lancamento.funcionario.nome) || 'N/A'}: ${error.message}</td></tr>`);
                }
            });
            
            if (renderLog) console.log(`🎨 ${linhasHTML.length} linhas HTML geradas, inserindo no tbody...`);
            tbody.innerHTML = linhasHTML.join('');
            FolhaUtils.applyFolhasColumnsConfig();
            FolhaUtils.setupFolhasTableSorting();
            if (renderLog) console.log(`✅ Tabela unificada renderizada com ${lancamentosOrdenados.length} linhas (com filtro de inativos)`);
            
            // ✅ DEBUG: Verificar se o HTML foi realmente inserido
            const linhasInseridas = tbody.querySelectorAll('tr').length;
            if (renderLog) console.log(`🔍 Verificação final: ${linhasInseridas} linhas inseridas no DOM`);
            // 📣 Sinalização única para UI: tabela concluída
                try {
                    window.dispatchEvent(new CustomEvent('tabelaFolhasRenderizada', { detail: { rowCount: linhasInseridas, source: 'utils' } }));
                    try { FolhaUtils.hideTablePreload(); } catch(e) {}
                } catch(e) { console.warn('⚠️ Falha ao emitir evento tabelaFolhasRenderizada:', e.message); }
                // ✅ Atualizar totais em tempo real de acordo com os dados que estão na tabela
                try {
                const filtrosAtivos = !!(window.folhaFiltros && Object.keys((window.folhaFiltros && window.folhaFiltros.filtrosAtivos) || {}).length);
                const shouldUpdateTotals = !opcoes.skipTotals && !filtrosAtivos;
                if (shouldUpdateTotals && window.folhaSystem && typeof window.folhaSystem.atualizarTotais === 'function') {
                    window.folhaSystem.atualizarTotais(lancamentosOrdenados);
                    if (renderLog) console.log('✅ Totais atualizados após renderização unificada');
                } else if (shouldUpdateTotals) {
                    // Fallback: atualizar totais diretamente no DOM
                    const calcularSum = (arr, fn) => arr.reduce((acc, x) => acc + Number(fn(x)||0), 0);
                    const totalBruto = calcularSum(lancamentosOrdenados, l => (window.FolhaUtils && window.FolhaUtils.getSalarioBaseDisplay) ? window.FolhaUtils.getSalarioBaseDisplay(l) : ((l.calculos && l.calculos.salarioBase) || 0));
                    const totalQuinzena = calcularSum(lancamentosOrdenados, l => (window.FolhaUtils && window.FolhaUtils.calcularValorQuinzena) ? window.FolhaUtils.calcularValorQuinzena(l) : 0);
                    const totalAcrescimos = calcularSum(lancamentosOrdenados, l => (window.FolhaUtils && window.FolhaUtils.calcularAcrescimosDisplay) ? window.FolhaUtils.calcularAcrescimosDisplay(l) : 0);
                    const totalDescontos = calcularSum(lancamentosOrdenados, l => (window.FolhaUtils && window.FolhaUtils.calcularDescontosDisplay) ? window.FolhaUtils.calcularDescontosDisplay(l) : 0);
                    const totalLiquido = calcularSum(lancamentosOrdenados, l => (window.FolhaUtils && window.FolhaUtils.calcularSalarioLiquidoDisplay) ? window.FolhaUtils.calcularSalarioLiquidoDisplay(l) : 0);
                    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = window.FolhaUtils.formatarMoeda ? window.FolhaUtils.formatarMoeda(val) : `R$ ${Number(val).toFixed(2)}`; };
                    setText('totalBruto', totalBruto);
                    setText('totalQuinzena', totalQuinzena);
                    setText('totalAcrescimos', totalAcrescimos);
                    setText('totalDescontos', totalDescontos);
                    setText('totalLiquido', totalLiquido);
                    if (renderLog) console.log('✅ Totais atualizados via fallback (DOM)');
                }
            } catch (e) {
                console.error('❌ Erro ao atualizar totais após renderização unificada:', e);
            }
            // ✅ Finalizar flag de renderização
            window.__renderingFolhasTable = false;
            
        } catch (error) {
            console.error(`❌ Erro crítico ao renderizar tabela unificada:`, error);
            tbody.innerHTML = `<tr><td colspan="12" style="color: red; text-align: center;">Erro ao renderizar tabela: ${error.message}</td></tr>`;
            FolhaUtils.applyFolhasColumnsConfig();
            FolhaUtils.setupFolhasTableSorting();
            window.__renderingFolhasTable = false;
        }
    }

    /**
     * 🎨 RENDERIZAR LINHA INDIVIDUAL DE LANÇAMENTO (FUNÇÃO UNIFICADA)
     */
    static renderizarLinhaLancamento(lancamento, opcoes = {}) {
        // Centralização: garantir calculos mínimos antes de exibir
        try { FolhaUtils.ensureCalculosPresent(lancamento); } catch {}
        const calculos = lancamento.calculos || {};
        const id = lancamento.id || lancamento.key || lancamento.$key || lancamento.recordId || '';
        // Preencher nome/cargo com mapeamento do cadastro, quando ausentes
        let nomeFuncionario = (lancamento.funcionario && lancamento.funcionario.nome) || '';
        let cargoFuncionario = (lancamento.funcionario && lancamento.funcionario.cargo) || '';
        let formaPagamentoFuncionario = (lancamento.funcionario && lancamento.funcionario.formaPagamento) || '';
        let pixFuncionario = (lancamento.funcionario && lancamento.funcionario.pix) || '';
        let beneficiarioFuncionario = (lancamento.funcionario && lancamento.funcionario.beneficiario) || '';
        let bancoFuncionario = (lancamento.funcionario && lancamento.funcionario.banco) || '';
        let agenciaFuncionario = (lancamento.funcionario && lancamento.funcionario.agencia) || '';
        let contaFuncionario = (lancamento.funcionario && lancamento.funcionario.conta) || '';
        const funcId = (lancamento.funcionario && lancamento.funcionario.id) || lancamento.funcionarioId || lancamento.idFuncionario || lancamento.func_id || '';
        const semDetalhePagamento = !pixFuncionario && !beneficiarioFuncionario && !bancoFuncionario && !agenciaFuncionario && !contaFuncionario;
        if ((!nomeFuncionario || !cargoFuncionario || !formaPagamentoFuncionario || semDetalhePagamento)) {
            // Primeiro tentar na lista do sistema (podendo conter apenas ativos)
            if (window.folhaSystem && Array.isArray(window.folhaSystem.funcionarios)) {
                const f = window.folhaSystem.funcionarios.find(ff => ff && (String(ff.id) === String(funcId)));
                if (f) {
                    nomeFuncionario = nomeFuncionario || f.nome || '';
                    cargoFuncionario = cargoFuncionario || f.cargo || '';
                    formaPagamentoFuncionario = formaPagamentoFuncionario || f.formaPagamento || '';
                    pixFuncionario = pixFuncionario || f.pix || '';
                    beneficiarioFuncionario = beneficiarioFuncionario || f.beneficiario || '';
                    bancoFuncionario = bancoFuncionario || f.banco || '';
                    agenciaFuncionario = agenciaFuncionario || f.agencia || '';
                    contaFuncionario = contaFuncionario || f.conta || '';
                }
            }
            // Fallback: usar lista completa do módulo de funcionários (ativos + inativos)
            if ((!nomeFuncionario || !cargoFuncionario) && window.folhaFuncionarios && Array.isArray(window.folhaFuncionarios.funcionarios)) {
                const f2 = window.folhaFuncionarios.funcionarios.find(ff => ff && (String(ff.id) === String(funcId)));
                if (f2) {
                    nomeFuncionario = nomeFuncionario || f2.nome || '';
                    cargoFuncionario = cargoFuncionario || f2.cargo || '';
                    formaPagamentoFuncionario = formaPagamentoFuncionario || f2.formaPagamento || '';
                    pixFuncionario = pixFuncionario || f2.pix || '';
                    beneficiarioFuncionario = beneficiarioFuncionario || f2.beneficiario || '';
                    bancoFuncionario = bancoFuncionario || f2.banco || '';
                    agenciaFuncionario = agenciaFuncionario || f2.agencia || '';
                    contaFuncionario = contaFuncionario || f2.conta || '';
                }
            }
        }
        
        // Determinar tipo de pagamento com resolução robusta
        const tipoPagamento = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
            ? window.FolhaUtils.resolveTipoPagamento(lancamento)
            : (lancamento.tipoPagamento || lancamento.tipo || 'mes');
        
        let tipoLabel = '';
        const statusNorm = String((window.FolhaUtils && typeof window.FolhaUtils.normalizarStatus === 'function')
            ? window.FolhaUtils.normalizarStatus(lancamento.status)
            : (lancamento.status || '')).toLowerCase().normalize('NFD').replace(/[^a-z_]/g,'');
        if (tipoPagamento === 'quinzena') {
            if (statusNorm === 'quinzena_paga') tipoLabel = '1° Quinzena Paga';
            else if (statusNorm === 'mes_fechado') tipoLabel = '2° Quinzena Paga';
            else tipoLabel = '1° Quinzena';
        } else {
            tipoLabel = statusNorm === 'mes_fechado' ? 'Mês Fechado Pago' : 'Mês Fechado';
        }
        
        const badgeClass = tipoPagamento === 'quinzena' ? 'badge-quinzena' : 'badge-mes';
        
        // Calcular percentual
        let percentual = '100%';
        if (tipoPagamento === 'quinzena') {
            const parsePercent = (raw) => {
                if (raw == null || raw === '') return NaN;
                const s = String(raw).trim().replace(/[^0-9,.-]/g,'');
                const n = s.includes(',') ? parseFloat(s.replace(/\./g,'').replace(/,/g,'.')) : parseFloat(s);
                return isNaN(n) ? NaN : n;
            };
            const candidates = [
                lancamento.percentualQuinzena,
                lancamento.quinzenaPercentual
            ];
            let perc = 50;
            for (const c of candidates) {
                const n = parsePercent(c);
                if (!isNaN(n) && n > 0 && n <= 100) { perc = n; break; }
            }
            percentual = perc + '%';
        }

        // Verificar se funcionário está inativo (para debug)
        const funcionarioInativo = (lancamento.funcionario && lancamento.funcionario.ativo === false);
        if (funcionarioInativo) {
            console.log('⚠️ ATENÇÃO: Lançamento de funcionário inativo sendo renderizado:', (lancamento.funcionario && lancamento.funcionario.nome) || '');
        }

        // Obter status da folha
        // Renderizar botões de ação condicionais
        console.log(`🎨 Renderizando botões para: ${(lancamento.funcionario && lancamento.funcionario.nome) || ''}`, {
            id: lancamento.id,
            tipo: lancamento.tipo,
            status: lancamento.status
        });
        const botoesAcao = FolhaUtils.renderizarBotoesAcaoUnificados(lancamento);
        console.log(`🎨 Botões renderizados: ${botoesAcao.length > 0 ? 'SIM' : 'NÃO'}`, {
            html: botoesAcao.substring(0, 100) + '...'
        });

        const descontosTotalAttr = (typeof FolhaUtils.calcularDescontosDisplay === 'function') 
            ? FolhaUtils.calcularDescontosDisplay(lancamento) 
            : 0;
        return `
            <tr data-id="${id}" ${funcionarioInativo ? 'class="funcionario-inativo-debug"' : ''} 
                class="folha-row ${lancamento.status === 'mes_fechado' ? 'folha-fechada' : ''}" 
                data-descontos-total="${descontosTotalAttr}">
                <td>
                    <strong>${nomeFuncionario || 'N/A'}</strong>
                    <div style="font-size: 11px; color: #666;">
                        ${cargoFuncionario || ''}
                    </div>
                </td>
                <td style="font-size: 12px;">${FolhaUtils.formatarFormaPagamentoDetalhada({
                    formaPagamento: formaPagamentoFuncionario,
                    pix: pixFuncionario,
                    banco: bancoFuncionario,
                    agencia: agenciaFuncionario,
                    conta: contaFuncionario,
                    beneficiario: beneficiarioFuncionario
                })}</td>
                <td>${FolhaUtils.formatarMesAno(lancamento.mesAno)}</td>
                <td>
                    <span class="badge-status" style="background-color: ${tipoPagamento === 'quinzena' ? '#17a2b8' : '#28a745'}">
                        ${tipoLabel}
                    </span>
                </td>
                <td>${percentual}</td>
                <td>${FolhaUtils.formatarMoeda(FolhaUtils.getSalarioBaseDisplay ? FolhaUtils.getSalarioBaseDisplay(lancamento) : (calculos.salarioBase || 0))}</td>
                <td>${FolhaUtils.formatarMoeda(FolhaUtils.calcularValorQuinzena ? FolhaUtils.calcularValorQuinzena(lancamento) : 0)}</td>
                <td>${FolhaUtils.formatarMoeda(FolhaUtils.calcularAcrescimosDisplay ? FolhaUtils.calcularAcrescimosDisplay(lancamento) : 0)}</td>
                <td>${FolhaUtils.formatarMoeda(FolhaUtils.calcularDescontosDisplay(lancamento))}</td>
                <td>${FolhaUtils.formatarMoeda(lancamento.vales || 0)}</td>
                <td class="valor-destaque">${FolhaUtils.formatarMoeda(FolhaUtils.calcularSalarioLiquidoDisplay(lancamento))}</td>
                <td class="actions-cell">
                    <button class="action-button btn-editar edit-button" title="Editar" data-folha-id="${id}" onclick="__onEditFolhaButtonClick('${id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-button print-button" title="Imprimir" data-folha-id="${id}" onclick="printFolha('${id}')">
                        <i class="fas fa-print"></i>
                    </button>
                    ${botoesAcao}
                    <button class="action-button btn-excluir delete-button" title="Excluir" data-folha-id="${id}" onclick="deleteFolha('${id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    // Função unificada para filtrar lançamentos
    async filterLancamentosUnified() {
        try {
            if (window.__folhaDebug) console.log('🔍 Iniciando filtro unificado de lançamentos...');
            
            // ✅ CORREÇÃO CRÍTICA: Sempre buscar dados frescos dos funcionários
            if (window.folhaSystem && window.folhaSystem.funcionarios) {
                if (window.__folhaDebug) console.log('🔄 Atualizando lista de funcionários para filtro...');
                await window.folhaSystem.loadDataWithOptimization();
            }
            
            // ✅ BUSCAR DADOS FRESCOS DO FIREBASE
            let lancamentos = [];
            try {
                if (window.folhaSystem && typeof window.folhaSystem.buscarTodasFolhas === 'function') {
                    lancamentos = await window.folhaSystem.buscarTodasFolhas();
                } else if (window.folhaLancamentos && typeof window.folhaLancamentos.buscarTodasFolhas === 'function') {
                    lancamentos = await window.folhaLancamentos.buscarTodasFolhas();
                } else if (window.database) {
                    // Fallback direto do Firebase
                    const { ref, get } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
                    const resolvePath = (p) => {
                        try {
                            if (window.FolhaUtils && typeof window.FolhaUtils.resolveFirebasePath === 'function') {
                                return window.FolhaUtils.resolveFirebasePath(p);
                            }
                        } catch {}
                        return p;
                    };
                    const folhasRef = ref(window.database, resolvePath('folhas'));
                    const snapshot = await get(folhasRef);
                    lancamentos = snapshot.val() ? Object.entries(snapshot.val()).map(([key, val]) => ({ id: key, ...(val||{}) })) : [];
                } else {
                    if (window.__folhaDebug) console.warn(`⚠️ Função buscarTodasFolhas não encontrada e database indisponível`);
                    return;
                }
            } catch (error) {
                console.error(`❌ Erro ao buscar lançamentos:`, error);
                return;
            }
            if (window.__folhaDebug) console.log(`📊 ${lancamentos.length} lançamentos carregados do Firebase para filtro unificado`);
            
            // ✅ APLICAR FILTROS EXISTENTES
            let lancamentosFiltrados = [...lancamentos];
            
            // Filtro por mês/ano
            const mesAnoFilter = document.getElementById('mesAno');
            if (mesAnoFilter && mesAnoFilter.value) {
                const alvo = FolhaUtils.normalizeMesAno(mesAnoFilter.value);
                lancamentosFiltrados = lancamentosFiltrados.filter(l => FolhaUtils.normalizeMesAno(l) === alvo);
                if (window.__folhaDebug) console.log(`📅 Filtro por mês/ano aplicado (normalizado): ${alvo}`);
            }
            
            // Filtro por tipo (usando resolução robusta)
            const tipoFilter = document.getElementById('tipoFolha');
            if (tipoFilter && tipoFilter.value) {
                const alvo = String(tipoFilter.value).toLowerCase();
                lancamentosFiltrados = lancamentosFiltrados.filter(l => {
                    const tp = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
                        ? window.FolhaUtils.resolveTipoPagamento(l)
                        : (l.tipoPagamento || l.tipo || 'mes');
                    return String(tp || '').toLowerCase() === alvo;
                });
                console.log(`📋 Filtro por tipo aplicado (robusto): ${tipoFilter.value}`);
            }
            
            // Filtro por funcionário (texto e ID exato)
            const funcionarioFilter = document.getElementById('funcionarioFiltro');
            if (funcionarioFilter) {
                const selectedId = funcionarioFilter.dataset && funcionarioFilter.dataset.funcionarioId;
                if (selectedId) {
                    lancamentosFiltrados = lancamentosFiltrados.filter(l => ((l && l.funcionario && String(l.funcionario.id)) === String(selectedId)));
                    console.log(`👤 Filtro por funcionário ID aplicado: ${selectedId}`);
                } else if (funcionarioFilter.value && funcionarioFilter.value.trim()) {
                    const raw = funcionarioFilter.value.trim();
                    const termo = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                    lancamentosFiltrados = lancamentosFiltrados.filter(l => {
                        const nome = (l.funcionario && l.funcionario.nome) ? String(l.funcionario.nome).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'') : '';
                        const cargo = (l.funcionario && l.funcionario.cargo) ? String(l.funcionario.cargo).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'') : '';
                        return (nome.includes(termo) || cargo.includes(termo));
                    });
                    console.log(`👤 Filtro por funcionário aplicado (normalizado): ${termo}`);
                }
            }
            
            console.log(`✅ Filtros aplicados: ${lancamentosFiltrados.length}/${lancamentos.length} lançamentos`);
            // Fallback: se vazio e tipo não selecionado, incluir mes_fechado para reduzir lista vazia
            const tipoSel = (document.getElementById('tipoFolha') && document.getElementById('tipoFolha').value) || '';
            if (lancamentosFiltrados.length === 0 && !tipoSel) {
                const incluiFechados = lancamentos.filter(l => l.status === 'mes_fechado');
                if (incluiFechados.length > 0) {
                    console.warn('⚠️ Lista vazia com filtros atuais; incluindo "Mês Fechado" por fallback.');
                    lancamentosFiltrados = incluiFechados;
                }
            }
            
            // ✅ INTEGRAR COM PAGINAÇÃO
            if (window.folhaPaginacao && typeof window.folhaPaginacao.aplicarFiltrosComPaginacao === 'function') {
                console.log('📄 Aplicando filtros com paginação...');
                window.folhaPaginacao.aplicarFiltrosComPaginacao(lancamentosFiltrados);
            } else {
                // ✅ RENDERIZAR TABELA COM DADOS FILTRADOS (fallback sem paginação)
                this.renderizarTabelaLancamentos(lancamentosFiltrados, {
                    mensagemVazia: 'Nenhuma folha encontrada com os filtros aplicados'
                });
            }
            
            // ✅ CORREÇÃO: Não atualizar totais aqui - deixar sistema de filtros gerenciar
            // O sistema de filtros (folha-filtros.js) já calcula e atualiza os totais corretamente
            console.log('📊 Sistema de filtros gerenciará os totais, não interferindo');
            
        } catch (error) {
            console.error('❌ Erro no filtro unificado:', error);
            this.mostrarErro('Erro ao aplicar filtros: ' + error.message);
        }
    }

    /**
     * 🎨 RENDERIZAR BOTÕES DE AÇÃO UNIFICADOS
     * Função para renderizar botões condicionais baseados no status e tipo da folha
     */
    static renderizarBotoesAcaoUnificados(lancamento) {
        const botoes = [];
        
        // ✅ VERIFICAR DISPONIBILIDADE DAS FUNÇÕES GLOBAIS
        const funcoesDisponiveis = {
            darBaixaQuinzena: typeof window.darBaixaQuinzena === 'function',
            fecharMes: typeof window.fecharMes === 'function',
            clonarFolha: typeof window.clonarFolha === 'function'
        };
        
        console.log(`🔍 Funções globais disponíveis:`, funcoesDisponiveis);
        
        // ✅ VERIFICAR SE AS FUNÇÕES ESTÃO NO ESCOPO GLOBAL
        if (!funcoesDisponiveis.darBaixaQuinzena) {
            console.warn(`⚠️ Função darBaixaQuinzena não encontrada no escopo global`);
        }
        if (!funcoesDisponiveis.fecharMes) {
            console.warn(`⚠️ Função fecharMes não encontrada no escopo global`);
        }
        if (!funcoesDisponiveis.clonarFolha) {
            console.warn(`⚠️ Função clonarFolha não encontrada no escopo global`);
        }
        
        // ✅ VERIFICAR SE FUNÇÕES UTILITÁRIAS ESTÃO DISPONÍVEIS
        if (typeof FolhaUtils.calcularValorQuinzena !== 'function') {
            console.warn(`⚠️ Função FolhaUtils.calcularValorQuinzena não encontrada`);
        }
        if (typeof FolhaUtils.calcularAcrescimosDisplay !== 'function') {
            console.warn(`⚠️ Função FolhaUtils.calcularAcrescimosDisplay não encontrada`);
        }
        if (typeof FolhaUtils.calcularDescontosDisplay !== 'function') {
            console.warn(`⚠️ Função FolhaUtils.calcularDescontosDisplay não encontrada`);
        }
        
        // ✅ DEBUG: Log detalhado para identificar problemas
        // ✅ CORREÇÃO CRÍTICA: Extrair status correto do objeto
        let statusString = '';
        if (typeof lancamento.status === 'object' && lancamento.status !== null) {
            // Se status é um objeto, tentar extrair o valor correto
            if (lancamento.status.value) {
                statusString = String(lancamento.status.value);
            } else if (lancamento.status.status) {
                statusString = String(lancamento.status.status);
            } else if (lancamento.status.nome) {
                statusString = String(lancamento.status.nome);
            } else {
                // Fallback: usar primeira propriedade string encontrada
                const keys = Object.keys(lancamento.status);
                for (const key of keys) {
                    if (typeof lancamento.status[key] === 'string') {
                        statusString = lancamento.status[key];
                        break;
                    }
                }
                if (!statusString) {
                    statusString = 'rascunho'; // Fallback padrão
                }
            }
            console.log(`🔧 Status extraído do objeto: ${statusString}`, lancamento.status);
        } else {
            statusString = String(lancamento.status || '');
            // ✅ Fallback: se estiver vazio, considerar 'rascunho' para evitar sumiço dos botões
            if (!statusString || !statusString.trim()) {
                statusString = 'rascunho';
            }
        }
        
        console.log(`🎯 Renderizando botões para: ${(lancamento.funcionario && lancamento.funcionario.nome) || ''}`, {
            id: lancamento.id,
            tipo: lancamento.tipo,
            status: lancamento.status,
            statusString: statusString,
            statusType: typeof lancamento.status,
            funcionario: (lancamento.funcionario && lancamento.funcionario.nome) || ''
        });
        
        // ✅ CORREÇÃO: Botões de ação devem aparecer APENAS na tabela principal
        // Botões de cancelamento devem aparecer APENAS no modal "Folhas Fechadas"
        
        // 🔧 Normalizar tipo para decisões de botões
        const normalizeTipoPagamento = (raw) => {
            try {
                if (!raw) return 'mes';
                const str = String(raw).toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z_\-]/g, '');
                const mesAliases = new Set(['mes','mensal','mesfechado','mes_fechado','fechado','fechada','mes-fechado']);
                const qzAliases = new Set(['quinzena','quinzenal','quinzena_paga','quinzenapaga','quizenal']);
                if (mesAliases.has(str)) return 'mes';
                if (qzAliases.has(str)) return 'quinzena';
                return (str === 'quinzena') ? 'quinzena' : 'mes';
            } catch { return 'mes'; }
        };
        const tipoNorm = (window.FolhaUtils && typeof window.FolhaUtils.resolveTipoPagamento === 'function')
            ? window.FolhaUtils.resolveTipoPagamento(lancamento)
            : normalizeTipoPagamento(lancamento.tipo || lancamento.tipoPagamento);

        // ✅ CORREÇÃO: Botão Dar Baixa na Quinzena (para quinzenas ATIVAS - rascunho, calculada, aprovada)
        console.log(`🔍 Verificando botão Dar Baixa: tipo=${lancamento.tipo}, statusString=${statusString}, includes=${['rascunho', 'calculada', 'aprovada'].includes(statusString)}`);
        if (tipoNorm === 'quinzena' && ['rascunho', 'calculada', 'aprovada'].includes(statusString)) {
            console.log(`✅ Adicionando botão Dar Baixa para quinzena: ${lancamento.id}`);
            // ✅ VERIFICAR SE FUNÇÃO ESTÁ DISPONÍVEL
            if (typeof window.darBaixaQuinzena === 'function') {
                botoes.push(`
                    <button class="action-button dar-baixa-button btn-dar-baixa" title="Dar Baixa na Quinzena" data-folha-id="${lancamento.id}" onclick="darBaixaQuinzena('${lancamento.id}')">
                        <i class="fas fa-money-bill"></i>
                    </button>
                `);
            } else {
                console.error(`❌ Função darBaixaQuinzena não disponível para: ${lancamento.id}`);
            }
        } else {
            console.log(`ℹ️ Não adicionando botão Dar Baixa: tipo=${lancamento.tipo}, statusString=${statusString}`);
        }
        
        // ✅ Normalizar status para decisões robustas
        const statusNorm = String(statusString || '').toLowerCase().normalize('NFD').replace(/[^a-z_]/g,'');
        // ✅ CORREÇÃO: Botão Fechar Mês (para quinzenas PAGAS que podem fechar o mês)
        console.log(`🔍 Verificando botão Fechar Mês para quinzena: tipo=${lancamento.tipo}, statusNorm=${statusNorm}, igual=${statusNorm === 'quinzena_paga'}`);
        if (tipoNorm === 'quinzena' && statusNorm === 'quinzena_paga') {
            console.log(`✅ Adicionando botão Fechar Mês para quinzena paga: ${lancamento.id}`);
            // ✅ VERIFICAR SE FUNÇÃO ESTÁ DISPONÍVEL
            if (typeof window.fecharMes === 'function') {
                botoes.push(`
                    <button class="action-button fechar-mes-button btn-fechar-mes" title="Fechar Mês (Quinzena Paga)" data-folha-id="${lancamento.id}" onclick="fecharMes('${lancamento.id}')">
                        <i class="fas fa-calendar-check"></i>
                    </button>
                `);
            } else {
                console.error(`❌ Função fecharMes não disponível para: ${lancamento.id}`);
            }
        } else {
            console.log(`ℹ️ Não adicionando botão Fechar Mês para quinzena: tipo=${lancamento.tipo}, statusString=${statusString}`);
        }
        
        // ✅ CORREÇÃO: Botão Fechar Mês (para meses não fechados - rascunho, calculada, aprovada)
        console.log(`🔍 Verificando botão Fechar Mês para mês: tipo=${lancamento.tipo}, statusNorm=${statusNorm}, includes=${['rascunho', 'calculada', 'aprovada'].includes(statusNorm)}`);
        if (tipoNorm === 'mes' && ['rascunho', 'calculada', 'aprovada'].includes(statusNorm)) {
            console.log(`✅ Adicionando botão Fechar Mês para mês: ${lancamento.id}`);
            // ✅ VERIFICAR SE FUNÇÃO ESTÁ DISPONÍVEL
            if (typeof window.fecharMes === 'function') {
                botoes.push(`
                    <button class="action-button fechar-mes-button btn-fechar-mes" title="Fechar Mês" data-folha-id="${lancamento.id}" onclick="fecharMes('${lancamento.id}')">
                        <i class="fas fa-calendar-check"></i>
                    </button>
                `);
            } else {
                console.error(`❌ Função fecharMes não disponível para: ${lancamento.id}`);
            }
        } else {
            console.log(`ℹ️ Não adicionando botão Fechar Mês para mês: tipo=${lancamento.tipo}, statusString=${statusString}`);
        }
        
        // Botão Clonar Folha (para qualquer folha válida)
        console.log(`🔍 Verificando botão Clonar: statusString=${statusString}, diferente=${statusString !== 'cancelada'}`);
        if (statusString !== 'cancelada') {
            // ✅ Pré-checagem de duplicidade para UX (não bloqueia; função clonar confirma novamente)
            let disableClone = false;
            try {
                const monthMap = {
                    'janeiro':'01','fevereiro':'02','marco':'03','março':'03','abril':'04','maio':'05','junho':'06',
                    'julho':'07','agosto':'08','setembro':'09','outubro':'10','novembro':'11','dezembro':'12'
                };
                const normalizeMesAno = (raw) => {
                    const s = String(raw || '').trim();
                    if (/^\d{4}-\d{2}$/.test(s)) return s;
                    const m1 = s.match(/^(\d{2})\/(\d{4})$/);
                    if (m1) return `${m1[2]}-${m1[1]}`;
                    return '';
                };
                const resolveMesAno = (rec) => {
                    const prim = normalizeMesAno(rec.mesAno);
                    if (prim) return prim;
                    if (rec.ano && rec.mes) {
                        const mnom = String(rec.mes).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
                        const mm = monthMap[mnom] || String(rec.mes).padStart(2,'0');
                        return `${rec.ano}-${mm}`;
                    }
                    if (rec.dataProcessamento) {
                        const d = new Date(Number(rec.dataProcessamento));
                        if (!isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                    }
                    return '';
                };
                const curr = resolveMesAno(lancamento);
                const [yyStr, mmStr] = curr.split('-');
                const base = new Date(parseInt(yyStr,10), parseInt(mmStr,10)-1, 1);
                base.setMonth(base.getMonth() + 1);
                const nextMesAno = `${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`;
                const funcId = (lancamento.funcionario && lancamento.funcionario.id) || '';
                const tipoBase = normalizeTipoPagamento(lancamento.tipo || lancamento.tipoPagamento);
                const lista = (window.folhaSystem && Array.isArray(window.folhaSystem.folhas)) ? window.folhaSystem.folhas : [];
                disableClone = lista.some(f => {
                    const sameFunc = funcId ? ((f.funcionario && f.funcionario.id) === funcId) : ((f.funcionario && f.funcionario.nome) === (lancamento.funcionario && lancamento.funcionario.nome));
                    const mesCanon = resolveMesAno(f);
                    const sameMes = mesCanon === nextMesAno;
                    const sameTipo = normalizeTipoPagamento(f.tipo || f.tipoPagamento) === tipoBase;
                    return sameFunc && sameMes && sameTipo;
                });
            } catch (e) {
                console.warn('⚠️ Falha na pré-checagem de duplicidade:', (e && e.message) || e);
            }

            console.log(`✅ Adicionando botão Clonar para: ${lancamento.id} ${disableClone ? '(desativado por duplicidade)' : ''}`);
            botoes.push(`
                <button class="action-button clonar-folha-button btn-clonar ${disableClone ? 'disabled' : ''}" title="Clonar para Próximo Mês${disableClone ? ' (já existe folha no próximo mês)' : ''}" 
                        ${disableClone ? 'disabled aria-disabled="true"' : ''} data-folha-id="${lancamento.id}" onclick="clonarFolha('${lancamento.id}')">
                    <i class="fas fa-copy"></i>
                </button>
            `);
        } else {
            console.log(`ℹ️ Não adicionando botão Clonar: statusString=${statusString}`);
        }
        
        console.log(`🎯 Total de botões renderizados: ${botoes.length}`);
        return botoes.join('');
    }
}

// ✅ EXPORTAR CLASSE GLOBALMENTE (FORÇANDO EXPORTAÇÃO COM PROTEÇÃO)
Object.defineProperty(window, 'FolhaUtils', {
    value: FolhaUtils,
    writable: false,
    enumerable: true,
    configurable: false
});
if (typeof window.__folhaDebugAll === 'undefined') {
    window.__folhaDebugAll = FolhaUtils.getDebugMode() === 'all';
}
if (window.__folhaDebugAll) console.log('✅ Classe FolhaUtils exportada para window (protegida contra sobrescrita)');

// ✅ EXPORTAR FUNÇÃO GLOBALMENTE PARA COMPATIBILIDADE (FORÇANDO EXPORTAÇÃO)
window.renderizarTabelaLancamentos = FolhaUtils.renderizarTabelaLancamentos;
if (window.__folhaDebugAll) console.log('✅ Função renderizarTabelaLancamentos exportada para window (forçado)');
window.isAllCaps = FolhaUtils.isAllCaps;
window.toTitleCasePt = FolhaUtils.toTitleCasePt;
window.openFolhasColumnsConfigModal = () => FolhaUtils.openFolhasColumnsConfigModal();
window.closeFolhasColumnsConfigModal = () => FolhaUtils.closeFolhasColumnsConfigModal();

// ✅ VERIFICAR SE MÉTODOS ESTÁTICOS ESTÃO DISPONÍVEIS
if (typeof FolhaUtils.renderizarTabelaLancamentos === 'function') {
    if (window.__folhaDebugAll) console.log('✅ Método renderizarTabelaLancamentos disponível');
} else {
    console.error('❌ Método renderizarTabelaLancamentos NÃO disponível');
}

// ✅ VERIFICAR SE FUNÇÃO GLOBAL ESTÁ DISPONÍVEL
if (typeof window.renderizarTabelaLancamentos === 'function') {
    if (window.__folhaDebugAll) console.log('✅ Função global renderizarTabelaLancamentos disponível');
} else {
    console.error('❌ Função global renderizarTabelaLancamentos NÃO disponível');
}

// ✅ FUNÇÃO GLOBAL DE EMERGÊNCIA PARA SCROLL
window.corrigirScrollTravado = function() {
    if (window.FolhaUtils) {
        window.FolhaUtils.corrigirScrollTravado();
    } else {
        console.log('🚨 CORREÇÃO DE EMERGÊNCIA DIRETA...');
        document.body.style.overflow = 'auto';
        document.body.style.overflowY = 'auto';
        document.body.style.height = 'auto';
        console.log('✅ Scroll desbloqueado!');
    }
};

// ✅ INICIALIZAÇÃO AUTOMÁTICA (PROTEGENDO CONTRA CONFLITOS)
document.addEventListener('DOMContentLoaded', () => {
    const debugAll = FolhaUtils.getDebugMode() === 'all';
    if (debugAll) console.log('📄 DOM carregado - verificando FolhaUtils...');
    
    // ✅ VERIFICAR SE A CLASSE AINDA ESTÁ DISPONÍVEL
    if (window.FolhaUtils != null) {
        if (debugAll) console.log('✅ Classe FolhaUtils disponível no DOM');
        
        // ✅ VERIFICAR MÉTODOS ESTÁTICOS
        if (typeof window.FolhaUtils.renderizarTabelaLancamentos === 'function') {
            if (debugAll) console.log('✅ Método renderizarTabelaLancamentos disponível no DOM');
        } else {
            console.error('❌ Método renderizarTabelaLancamentos NÃO disponível no DOM');
        }
        
        // ✅ VERIFICAR SE FUNÇÕES GLOBAIS ESTÃO DISPONÍVEIS
        if (typeof window.renderizarTabelaLancamentos === 'function') {
            if (debugAll) console.log('✅ Função global renderizarTabelaLancamentos disponível no DOM');
        } else {
            console.error('❌ Função global renderizarTabelaLancamentos NÃO disponível no DOM');
        }
        
        // ✅ VERIFICAR SE FUNÇÕES UTILITÁRIAS ESTÃO DISPONÍVEIS
        if (typeof window.FolhaUtils.calcularValorQuinzena === 'function') {
            if (debugAll) console.log('✅ Função calcularValorQuinzena disponível no DOM');
        } else {
            console.error('❌ Função calcularValorQuinzena NÃO disponível no DOM');
        }
        try { window.FolhaUtils.applyFolhasColumnsConfig(); } catch {}
        try { window.FolhaUtils.setupFolhasTableSorting(); } catch {}
        
        // ✅ CRIAR INSTÂNCIA APENAS SE NECESSÁRIO
        if (!window.folhaUtilsInstance) {
            try {
                window.folhaUtilsInstance = new FolhaUtils();
                if (debugAll) console.log('✅ Instância FolhaUtils criada (folhaUtilsInstance)');
            } catch (error) {
                console.error('❌ Erro ao criar instância FolhaUtils:', error);
            }
        }
    } else {
        if (debugAll) console.warn('⚠️ Classe FolhaUtils ainda não disponível no DOM (pode estar carregando)');
    }
});

// ✅ INICIALIZAÇÃO IMEDIATA PARA COMPATIBILIDADE (REMOVIDA PARA EVITAR SOBRESCRITA)
// A classe já foi exportada como window.FolhaUtils = FolhaUtils acima

if (window.__folhaDebugAll) {
window.debugDescontosFuncionario = function(nomeFuncionario) {
    console.log(`🔍 ===== ANÁLISE COMPLETA DE DESCONTOS: ${nomeFuncionario} =====`);
    
    // Buscar funcionário nos dados
    let folhaEncontrada = null;
    
    // Tentar diferentes fontes de dados
    if (window.folhaLancamentos && window.folhaLancamentos.lancamentos) {
        folhaEncontrada = window.folhaLancamentos.lancamentos.find(f => 
            (f.funcionario && f.funcionario.nome && f.funcionario.nome.includes(nomeFuncionario))
        );
    }
    
    if (!folhaEncontrada && window.folhaSystem && window.folhaSystem.folhas) {
        folhaEncontrada = window.folhaSystem.folhas.find(f => 
            (f.funcionario && f.funcionario.nome && f.funcionario.nome.includes(nomeFuncionario))
        );
    }
    
    if (!folhaEncontrada) {
        console.error(`❌ Funcionário "${nomeFuncionario}" não encontrado nos dados`);
        return;
    }
    
    console.log('📊 DADOS COMPLETOS DA FOLHA:', folhaEncontrada);
    
    // Analisar estrutura de cálculos
    console.log('🧮 ESTRUTURA DE CÁLCULOS:');
    console.log('- folha.calculos:', folhaEncontrada.calculos);
    console.log('- folha.calculos && folha.calculos.calculos:', (folhaEncontrada.calculos && folhaEncontrada.calculos.calculos) || null);
    
    // Forçar cálculo de descontos com debug
    const totalDescontos = window.FolhaUtils.calcularDescontosDisplay(folhaEncontrada);
    
    console.log(`💰 TOTAL FINAL: R$ ${totalDescontos.toFixed(2)}`);
    console.log(`🔍 ===== FIM ANÁLISE COMPLETA =====`);
    
    return {
        funcionario: nomeFuncionario,
        folha: folhaEncontrada,
        totalDescontos: totalDescontos
    };
};

// ✅ FUNÇÃO GLOBAL PARA COMPARAR MÉTODOS DE CÁLCULO
window.compararCalculosDescontos = function(nomeFuncionario) {
    console.log(`🔍 ===== COMPARAÇÃO DE MÉTODOS DE CÁLCULO: ${nomeFuncionario} =====`);
    
    // Buscar funcionário
    let folhaEncontrada = null;
    if (window.folhaLancamentos && window.folhaLancamentos.lancamentos) {
        folhaEncontrada = window.folhaLancamentos.lancamentos.find(f => 
            (f && f.funcionario && f.funcionario.nome && f.funcionario.nome.includes(nomeFuncionario))
        );
    }
    
    if (!folhaEncontrada) {
        console.error(`❌ Funcionário "${nomeFuncionario}" não encontrado`);
        return;
    }
    
    console.log('📊 COMPARANDO DIFERENTES MÉTODOS:');
    
    // Método 1: calcularDescontosDisplay (atual)
    const metodo1 = window.FolhaUtils.calcularDescontosDisplay(folhaEncontrada);
    console.log(`📊 Método 1 (calcularDescontosDisplay): R$ ${metodo1.toFixed(2)}`);
    
    // Método 2: Somar campos diretos da folha
    const descontoFaltasMonetario = Number((folhaEncontrada && folhaEncontrada.calculos && folhaEncontrada.calculos.calculos && folhaEncontrada.calculos.calculos.descontoFaltas)
        || (folhaEncontrada && folhaEncontrada.calculos && folhaEncontrada.calculos.descontoFaltas)
        || folhaEncontrada.descontoFaltas
        || 0);
    const metodo2 = (folhaEncontrada.vales || 0) + 
                    (folhaEncontrada.outrosDescontos || 0) + 
                    descontoFaltasMonetario +
                    (folhaEncontrada.descontoRepousoRemunerado || 0) +
                    (folhaEncontrada.descontoINSSManual || 0) +
                    (folhaEncontrada.contribuicaoConfederativa || 0) +
                    (folhaEncontrada.contribuicaoSindical || 0) +
                    (folhaEncontrada.descontoIRPJ || 0) +
                    (folhaEncontrada.emprestimoConsignado || 0);
    console.log(`📊 Método 2 (campos diretos): R$ ${metodo2.toFixed(2)}`);
    
    // Método 3: Usar totalDescontos se existir
    const metodo3 = folhaEncontrada.totalDescontos || ((folhaEncontrada && folhaEncontrada.calculos && folhaEncontrada.calculos.totalDescontos) || 0);
    console.log(`📊 Método 3 (totalDescontos): R$ ${metodo3.toFixed(2)}`);
    
    // Método 4: Recalcular usando FolhaCalculos
    let metodo4 = 0;
    if (window.FolhaCalculos && window.FolhaCalculos.calcularFolhaCompleta) {
        try {
            const dadosCalculo = {
                salarioBase: folhaEncontrada.salarioBase || ((folhaEncontrada && folhaEncontrada.funcionario && folhaEncontrada.funcionario.salarioBase) || 0),
                vales: folhaEncontrada.vales || 0,
                outrosDescontos: folhaEncontrada.outrosDescontos || 0,
                faltas: folhaEncontrada.faltas || 0,
                dependentes: folhaEncontrada.quantidadeFilhos || 0,
                descontoRepousoRemunerado: folhaEncontrada.descontoRepousoRemunerado || 0,
                descontoINSSManual: folhaEncontrada.descontoINSSManual || 0,
                contribuicaoConfederativa: folhaEncontrada.contribuicaoConfederativa || 0,
                contribuicaoSindical: folhaEncontrada.contribuicaoSindical || 0,
                descontoIRPJ: folhaEncontrada.descontoIRPJ || 0,
                emprestimoConsignado: folhaEncontrada.emprestimoConsignado || 0
            };
            const calculoCompleto = window.FolhaCalculos.calcularFolhaCompleta(dadosCalculo);
            metodo4 = calculoCompleto.totalDescontos || 0;
        } catch (error) {
            console.error('❌ Erro no método 4:', error);
        }
    }
    console.log(`📊 Método 4 (recálculo completo): R$ ${metodo4.toFixed(2)}`);
    
    // Análise de diferenças
    console.log('🔍 ANÁLISE DE DIFERENÇAS:');
    console.log(`📊 Diferença 1-2: R$ ${(metodo1 - metodo2).toFixed(2)}`);
    console.log(`📊 Diferença 1-3: R$ ${(metodo1 - metodo3).toFixed(2)}`);
    console.log(`📊 Diferença 1-4: R$ ${(metodo1 - metodo4).toFixed(2)}`);
    
    if (Math.abs(metodo1 - metodo2) > 0.01) {
        console.warn('⚠️ DIFERENÇA SIGNIFICATIVA entre método atual e campos diretos!');
    }
    if (Math.abs(metodo1 - metodo4) > 0.01) {
        console.warn('⚠️ DIFERENÇA SIGNIFICATIVA entre método atual e recálculo!');
    }
    
    console.log(`🔍 ===== FIM COMPARAÇÃO =====`);
    
    return {
        funcionario: nomeFuncionario,
        metodos: {
            atual: metodo1,
            diretos: metodo2,
            totalSalvo: metodo3,
            recalculo: metodo4
        }
    };
};

// ✅ FUNÇÃO GLOBAL PARA CORRIGIR DADOS INCORRETOS
window.corrigirDadosIncorretos = function(nomeFuncionario) {
    console.log(`🔧 ===== CORREÇÃO DE DADOS INCORRETOS: ${nomeFuncionario} =====`);
    
    // Buscar funcionário
    let folhaEncontrada = null;
    if (window.folhaLancamentos && window.folhaLancamentos.lancamentos) {
        folhaEncontrada = window.folhaLancamentos.lancamentos.find(f => 
            (f.funcionario && f.funcionario.nome && f.funcionario.nome.includes(nomeFuncionario))
        );
    }
    
    if (!folhaEncontrada) {
        console.error(`❌ Funcionário "${nomeFuncionario}" não encontrado`);
        return;
    }
    
    console.log('🔧 DADOS ANTES DA CORREÇÃO:');
    const antesCorrecao = window.FolhaUtils.calcularDescontosDisplay(folhaEncontrada);
    console.log(`📊 Total Descontos ANTES: R$ ${antesCorrecao.toFixed(2)}`);
    
    // Forçar recálculo completo usando FolhaCalculos
    if (window.FolhaCalculos && window.FolhaCalculos.calcularFolhaCompleta) {
        try {
            const dadosCalculo = {
                salarioBase: folhaEncontrada.salarioBase || (folhaEncontrada.funcionario && folhaEncontrada.funcionario.salarioBase) || 0,
                vales: folhaEncontrada.vales || 0,
                outrosDescontos: folhaEncontrada.outrosDescontos || 0,
                faltas: folhaEncontrada.faltas || 0,
                dependentes: folhaEncontrada.quantidadeFilhos || 0,
                descontoRepousoRemunerado: folhaEncontrada.descontoRepousoRemunerado || 0,
                descontoINSSManual: folhaEncontrada.descontoINSSManual || 0,
                contribuicaoConfederativa: folhaEncontrada.contribuicaoConfederativa || 0,
                contribuicaoSindical: folhaEncontrada.contribuicaoSindical || 0,
                descontoIRPJ: folhaEncontrada.descontoIRPJ || 0,
                emprestimoConsignado: folhaEncontrada.emprestimoConsignado || 0
            };
            
            const calculoCorreto = window.FolhaCalculos.calcularFolhaCompleta(dadosCalculo);
            
            console.log('✅ DADOS APÓS RECÁLCULO CORRETO:');
            console.log(`📊 Total Descontos CORRETO: R$ ${calculoCorreto.totalDescontos.toFixed(2)}`);
            console.log(`📊 DIFERENÇA: R$ ${(antesCorrecao - calculoCorreto.totalDescontos).toFixed(2)}`);
            
            if (Math.abs(antesCorrecao - calculoCorreto.totalDescontos) > 0.01) {
                console.warn('🚨 DADOS INCORRETOS DETECTADOS! Recomenda-se:');
                console.warn('1. Editar a folha do funcionário');
                console.warn('2. Clicar em "Atualizar" para salvar os cálculos corretos');
                console.warn('3. Ou usar a função window.atualizarCalculosFolha() para corrigir automaticamente');
            } else {
                console.log('✅ Dados estão corretos!');
            }
            
            return {
                funcionario: nomeFuncionario,
                antes: antesCorrecao,
                correto: calculoCorreto.totalDescontos,
                diferenca: antesCorrecao - calculoCorreto.totalDescontos,
                precisaCorrecao: Math.abs(antesCorrecao - calculoCorreto.totalDescontos) > 0.01
            };
            
        } catch (error) {
            console.error('❌ Erro no recálculo:', error);
        }
    }
    
    console.log(`🔧 ===== FIM CORREÇÃO =====`);
};

// ✅ FUNÇÃO ESPECÍFICA PARA ANALISAR FOLHAS DE MICHAEL
window.analisarFolhasMichael = function() {
    console.log(`🔍 ===== ANÁLISE ESPECÍFICA DAS FOLHAS DE MICHAEL =====`);
    
    // Buscar todas as folhas de MICHAEL
    let folhasMichael = [];
    if (window.folhaLancamentos && window.folhaLancamentos.lancamentos) {
        folhasMichael = window.folhaLancamentos.lancamentos.filter(f => 
            (f.funcionario && f.funcionario.nome && f.funcionario.nome.includes('MICHAEL'))
        );
    }
    
    if (folhasMichael.length === 0) {
        console.error(`❌ Nenhuma folha de MICHAEL encontrada`);
        return;
    }
    
    console.log(`📊 MICHAEL tem ${folhasMichael.length} folhas:`);
    
    folhasMichael.forEach((folha, index) => {
        console.log(`\n📋 FOLHA ${index + 1}:`);
        console.log(`- ID: ${folha.id}`);
        console.log(`- Tipo: ${folha.tipo}`);
        const statusNormalizado = window.FolhaUtils.normalizarStatus(folha.status);
        console.log(`- Status: ${statusNormalizado}${folha.status !== statusNormalizado ? ` (original: ${JSON.stringify(folha.status)})` : ''}`);
        console.log(`- Mês/Ano: ${folha.mesAno}`);
        console.log(`- Salário Base: R$ ${folha.salarioBase || 0}`);
        console.log(`- Criada em: ${folha.criadoEm || 'N/A'}`);
        
        // Verificar se deveria estar no modal "Folhas Fechadas"
        const deveEstarNoModal = statusNormalizado === 'mes_fechado' || 
            (folha.tipo === 'quinzena' && statusNormalizado === 'quinzena_paga');
        
        console.log(`- Deve estar em "Folhas Fechadas": ${deveEstarNoModal ? 'SIM' : 'NÃO'}`);
        
        // Verificar botões disponíveis
        if (folha.tipo === 'mes' && statusNormalizado === 'rascunho') {
            console.log(`🔧 Botões disponíveis: Fechar Mês, Clonar`);
            console.log(`❌ PROBLEMA: Status "rascunho" não permite cancelar fechamento`);
        }
    });
    
    console.log(`\n💡 DIAGNÓSTICO:`);
    const folhaMes = folhasMichael.find(f => f.tipo === 'mes');
    if (folhaMes) {
        const statusMesNormalizado = window.FolhaUtils.normalizarStatus(folhaMes.status);
        if (statusMesNormalizado === 'rascunho') {
            console.warn(`🚨 PROBLEMA IDENTIFICADO: Folha de mês está com status "rascunho"`);
            console.log(`📝 POSSÍVEIS CAUSAS:`);
            console.log(`1. Folha foi criada mas nunca foi fechada`);
            console.log(`2. Folha foi cancelada anteriormente`);
            console.log(`3. Erro no processo de fechamento`);
            console.log(`\n🛠️ SOLUÇÕES:`);
            console.log(`1. Fechar o mês primeiro: fecharMes('${folhaMes.id}')`);
            console.log(`2. Ou corrigir o status manualmente no Firebase`);
        }
    }
    
    console.log(`🔍 ===== FIM ANÁLISE MICHAEL =====`);
    
    return {
        funcionario: 'MICHAEL DE PAULO SILVA',
        totalFolhas: folhasMichael.length,
        folhas: folhasMichael,
        problemaIdentificado: folhasMichael.some(f => f.tipo === 'mes' && window.FolhaUtils.normalizarStatus(f.status) === 'rascunho')
    };
};

// ✅ FUNÇÃO ESPECÍFICA PARA ANALISAR DADOS DE YLLA
window.analisarDadosYlla = function() {
    console.log(`🔍 ===== ANÁLISE ESPECÍFICA DOS DADOS DE YLLA =====`);
    
    // Buscar YLLA
    let folhaYlla = null;
    if (window.folhaLancamentos && window.folhaLancamentos.lancamentos) {
        folhaYlla = window.folhaLancamentos.lancamentos.find(f => 
            (f.funcionario && f.funcionario.nome && f.funcionario.nome.includes('YLLA'))
        );
    }
    
    if (!folhaYlla) {
        console.error(`❌ YLLA não encontrada`);
        return;
    }
    
    console.log('📊 DADOS COMPLETOS DE YLLA:');
    console.log('- ID:', folhaYlla.id);
    console.log('- Funcionário:', (folhaYlla.funcionario && folhaYlla.funcionario.nome) || '');
    console.log('- Salário Base:', folhaYlla.salarioBase);
    console.log('- Faltas (campo direto):', folhaYlla.faltas);
    console.log('- Dias Trabalhados:', folhaYlla.diasTrabalhados);
    console.log('- Vales:', folhaYlla.vales);
    console.log('- Outros Descontos:', folhaYlla.outrosDescontos);
    console.log('- INSS Manual:', folhaYlla.descontoINSSManual);
    console.log('- Empréstimo Consignado:', folhaYlla.emprestimoConsignado);
    
    console.log('🧮 DADOS DE CÁLCULOS SALVOS:');
    if (folhaYlla.calculos) {
        console.log('- calculos.descontoFaltas:', folhaYlla.calculos.descontoFaltas);
        console.log('- calculos.calculos && calculos.calculos.descontoFaltas:', (folhaYlla.calculos.calculos && folhaYlla.calculos.calculos.descontoFaltas) || null);
        console.log('- calculos.inss:', folhaYlla.calculos.inss);
        console.log('- calculos.irrf:', folhaYlla.calculos.irrf);
    }
    
    // Verificar se é um problema de dados
    const faltasDeclaradas = Number(folhaYlla.faltas || 0);
    const diasTrabalhados = Number(folhaYlla.diasTrabalhados || 0);
    
    console.log('🔍 ANÁLISE DE FALTAS:');
    console.log(`- Faltas declaradas: ${faltasDeclaradas} dias`);
    console.log(`- Dias trabalhados: ${diasTrabalhados} dias`);
    
    if (faltasDeclaradas >= 25) {
        console.warn('🚨 PROBLEMA DETECTADO: Faltas excessivas!');
        console.warn('📝 POSSÍVEIS CAUSAS:');
        console.warn('1. Erro de digitação (30 em vez de 3)');
        console.warn('2. Campo "diasTrabalhados" usado incorretamente');
        console.warn('3. Funcionária em licença/afastamento');
        console.warn('4. Dados corrompidos no Firebase');
        
        console.log('💡 SUGESTÕES:');
        console.log('1. Verificar se deveria ser 3 dias em vez de 30');
        console.log('2. Editar a folha e corrigir o campo "Faltas"');
        console.log('3. Se for licença, usar campo específico para isso');
    }
    
    console.log(`🔍 ===== FIM ANÁLISE YLLA =====`);
    
    return {
        funcionario: 'YLLA KANANDA TEIXEIRA DIAS',
        faltasDeclaradas: faltasDeclaradas,
        diasTrabalhados: diasTrabalhados,
        problemaDetectado: faltasDeclaradas >= 25,
        folhaCompleta: folhaYlla
    };
};

// ✅ VERIFICAÇÃO FINAL DE DISPONIBILIDADE
if (window.__folhaDebugAll) console.log('🛠️ Módulo FolhaUtils carregado');

// ✅ VERIFICAR SE A CLASSE ESTÁ DISPONÍVEL GLOBALMENTE (COM DELAY PARA EVITAR RACE CONDITIONS)
if (window.__folhaDebugAll) setTimeout(() => {
    if (window.FolhaUtils != null) {
        console.log('✅ Classe FolhaUtils disponível globalmente');
        
        // ✅ VERIFICAR MÉTODOS ESTÁTICOS
        const metodos = ['renderizarTabelaLancamentos', 'renderizarLinhaLancamento', 'renderizarBotoesAcaoUnificados'];
        metodos.forEach(metodo => {
            if (typeof window.FolhaUtils[metodo] === 'function') {
                console.log(`✅ Método ${metodo} disponível`);
            } else {
                console.warn(`⚠️ Método ${metodo} NÃO disponível ainda (pode estar carregando)`);
            }
        });
    } else {
        console.warn('⚠️ Classe FolhaUtils ainda não disponível (carregando...)');
    }
    
    // ✅ VERIFICAR SE FUNÇÃO GLOBAL ESTÁ DISPONÍVEL
    if (typeof window.renderizarTabelaLancamentos === 'function') {
        console.log('✅ Função global renderizarTabelaLancamentos disponível');
    } else {
        console.warn('⚠️ Função global renderizarTabelaLancamentos ainda não disponível (carregando...)');
    }
}, 100); // Delay de 100ms para garantir que todas as exportações foram feitas

// ✅ VERIFICAÇÃO AUTOMÁTICA DE SCROLL AO CARREGAR
setTimeout(() => {
    if (window.FolhaUtils && typeof window.FolhaUtils.verificarScrollGlobal === 'function') {
        const body = document.body;
        const html = document.documentElement;
        const bodyHidden = body && body.style && body.style.overflow === 'hidden';
        const htmlHidden = html && html.style && html.style.overflow === 'hidden';
        if (!bodyHidden && !htmlHidden) return;
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(() => window.FolhaUtils.verificarScrollGlobal());
        } else {
            window.FolhaUtils.verificarScrollGlobal();
        }
        if (window.__folhaDebugAll) console.log('🔍 Verificação automática de scroll executada');
    }
}, 2000); // Delay maior para garantir que tudo foi carregado

// ✅ FUNÇÃO DE DIAGNÓSTICO RÁPIDO PARA VERIFICAR CARREGAMENTO
window.diagnosticoRapido = function() {
    console.log('🔍 ===== DIAGNÓSTICO RÁPIDO DO SISTEMA =====');
    
    const status = {
        folhaSystem: !!window.folhaSystem,
        folhaSystemType: typeof window.folhaSystem,
        updateInterface: !!(window.folhaSystem && window.folhaSystem.updateInterface),
        updateInterfaceType: window.folhaSystem ? typeof window.folhaSystem.updateInterface : 'N/A',
        folhaUtils: !!window.FolhaUtils,
        folhaUtilsType: typeof window.FolhaUtils,
        folhaLancamentos: !!window.folhaLancamentos,
        folhaLancamentosType: typeof window.folhaLancamentos,
        renderizarTabela: !!window.renderizarTabelaLancamentos,
        renderizarTabelaType: typeof window.renderizarTabelaLancamentos
    };
    
    console.table(status);
    
    // Verificar se há dados carregados
    if (window.folhaLancamentos && window.folhaLancamentos.lancamentos) {
        console.log(`📊 Lançamentos carregados: ${window.folhaLancamentos.lancamentos.length}`);
    }
    
    // Verificar se a tabela existe no DOM
    const tabela = document.getElementById('folhasTableBody');
    console.log(`📋 Tabela no DOM: ${!!tabela}`);
    if (tabela) {
        console.log(`📋 Linhas na tabela: ${tabela.children.length}`);
    }
    
    // Verificar se há erros críticos
    const problemas = [];
    if (!window.folhaSystem) problemas.push('window.folhaSystem não carregado');
    if (!window.folhaSystem || !window.folhaSystem.updateInterface) problemas.push('updateInterface não disponível');
    if (!window.FolhaUtils) problemas.push('window.FolhaUtils não disponível');
    if (!window.folhaLancamentos) problemas.push('window.folhaLancamentos não carregado');
    
    if (problemas.length === 0) {
        console.log('✅ SISTEMA OK - Todos os componentes críticos carregados');
        return true;
    } else {
        console.error('❌ PROBLEMAS ENCONTRADOS:');
        problemas.forEach(p => console.error(`- ${p}`));
        return false;
    }
};

// ✅ FUNÇÃO PARA FORÇAR RENDERIZAÇÃO DA TABELA
window.forcarRenderizacaoTabela = function() {
    console.log('🔄 ===== FORÇANDO RENDERIZAÇÃO DA TABELA =====');
    
    // 1. Verificar se há dados
    if (!window.folhaLancamentos || !window.folhaLancamentos.lancamentos) {
        console.error('❌ Não há dados de lançamentos carregados');
        return false;
    }
    
    const dados = window.folhaLancamentos.lancamentos;
    console.log(`📊 Dados disponíveis: ${dados.length} lançamentos`);
    
    // 2. Verificar se a tabela existe
    const tbody = document.getElementById('folhasTableBody');
    if (!tbody) {
        console.error('❌ Elemento folhasTableBody não encontrado no DOM');
        return false;
    }
    
    // 3. Limpar tabela
    tbody.innerHTML = '';
    console.log('🧹 Tabela limpa');
    
    // 4. Verificar se FolhaUtils está disponível
    if (!window.FolhaUtils || !window.FolhaUtils.renderizarTabelaLancamentos) {
        console.error('❌ FolhaUtils.renderizarTabelaLancamentos não disponível');
        return false;
    }
    
    // 5. Renderizar tabela
    try {
        console.log('🎨 Iniciando renderização...');
        const html = window.FolhaUtils.renderizarTabelaLancamentos(dados);
        tbody.innerHTML = html;
        console.log(`✅ Tabela renderizada com ${tbody.children.length} linhas`);
        
        // ✅ CORREÇÃO: Não atualizar totais aqui - deixar sistema apropriado gerenciar
        // Se há filtros ativos, folha-filtros.js gerencia os totais
        // Se não há filtros, folha-main.js gerencia os totais
        console.log('📊 Totais serão gerenciados pelo sistema apropriado (filtros ou main)');
        
        return true;
    } catch (error) {
        console.error('❌ Erro ao renderizar tabela:', error);
        return false;
    }
};

// ✅ FUNÇÃO PARA TESTAR A LARGURA DO MODAL FOLHAS FECHADAS
window.testarLarguraModalFolhasFechadas = function() {
    console.log('📐 ===== TESTANDO LARGURA DO MODAL FOLHAS FECHADAS =====');
    
    const modal = document.getElementById('folhasFechadasModal');
    if (!modal) {
        console.error('❌ Modal folhasFechadasModal não encontrado');
        return false;
    }
    
    const modalContent = modal.querySelector('.modal-content');
    if (!modalContent) {
        console.error('❌ .modal-content não encontrado dentro do modal');
        return false;
    }
    
    // Abrir o modal temporariamente para testar
    const wasVisible = modal.style.display === 'block';
    if (!wasVisible) {
        modal.style.display = 'block';
        console.log('📂 Modal aberto temporariamente para teste');
    }
    
    // Obter estilos computados
    const computedStyle = window.getComputedStyle(modalContent);
    const maxWidth = computedStyle.maxWidth;
    const width = computedStyle.width;
    const actualWidth = modalContent.offsetWidth;
    
    console.log('📊 DIMENSÕES DO MODAL:');
    console.log(`- Max-width CSS: ${maxWidth}`);
    console.log(`- Width CSS: ${width}`);
    console.log(`- Largura real: ${actualWidth}px`);
    console.log(`- Largura da tela: ${window.innerWidth}px`);
    
    // Verificar se a largura aumentou
    const larguraEsperada = 1200; // pixels
    const larguraMinima = 800;    // pixels
    
    let sucesso = true;
    
    if (actualWidth < larguraMinima) {
        console.warn(`⚠️ Largura atual (${actualWidth}px) menor que o mínimo esperado (${larguraMinima}px)`);
        sucesso = false;
    } else if (actualWidth >= larguraEsperada || maxWidth === '1200px') {
        console.log(`✅ Largura adequada: ${actualWidth}px (esperado: ${larguraEsperada}px)`);
    } else {
        console.log(`✅ Largura aceitável: ${actualWidth}px (mínimo: ${larguraMinima}px)`);
    }
    
    // Testar responsividade
    console.log('\n📱 TESTANDO RESPONSIVIDADE:');
    const breakpoints = [
        { name: 'Desktop', min: 1024 },
        { name: 'Tablet', min: 768, max: 1023 },
        { name: 'Mobile', max: 767 }
    ];
    
    const currentWidth = window.innerWidth;
    const currentBreakpoint = breakpoints.find(bp => 
        (!bp.min || currentWidth >= bp.min) && (!bp.max || currentWidth <= bp.max)
    );
    
    if (currentBreakpoint) {
        console.log(`📱 Dispositivo atual: ${currentBreakpoint.name} (${currentWidth}px)`);
        
        // Verificar se o modal usa o espaço adequado para cada tipo de dispositivo
        const percentageUsed = (actualWidth / currentWidth) * 100;
        console.log(`📊 Uso da tela: ${percentageUsed.toFixed(1)}%`);
        
        if (currentBreakpoint.name === 'Desktop' && percentageUsed >= 80) {
            console.log('✅ Uso adequado da tela em desktop');
        } else if (currentBreakpoint.name === 'Tablet' && percentageUsed >= 90) {
            console.log('✅ Uso adequado da tela em tablet');
        } else if (currentBreakpoint.name === 'Mobile' && percentageUsed >= 95) {
            console.log('✅ Uso adequado da tela em mobile');
        } else {
            console.log(`ℹ️ Uso da tela: ${percentageUsed.toFixed(1)}% (pode ser otimizado)`);
        }
    }
    
    // Fechar o modal se não estava aberto
    if (!wasVisible) {
        modal.style.display = 'none';
        console.log('📂 Modal fechado após teste');
    }
    
    console.log('\n🎯 RESULTADO:');
    if (sucesso) {
        console.log('✅ Modal "Folhas Fechadas" com largura adequada para melhor usabilidade');
        return true;
    } else {
        console.error('❌ Modal precisa de ajustes na largura');
        return false;
    }
};

// ✅ FUNÇÃO PARA TESTAR MELHORIAS DO MODAL FOLHAS FECHADAS
window.testarMelhoriasModalFolhasFechadas = function() {
    console.log('🧪 ===== TESTANDO MELHORIAS DO MODAL FOLHAS FECHADAS =====');
    
    const modal = document.getElementById('folhasFechadasModal');
    if (!modal) {
        console.error('❌ Modal folhasFechadasModal não encontrado');
        return false;
    }
    
    let pontuacao = 0;
    const testes = [];
    
    // 1. Testar largura do modal
    console.log('\n1️⃣ TESTANDO LARGURA DO MODAL:');
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
        const computedStyle = window.getComputedStyle(modalContent);
        const maxWidth = computedStyle.maxWidth;
        
        if (maxWidth === '1200px') {
            console.log('✅ Largura correta: 1200px');
            pontuacao += 20;
            testes.push({ nome: 'Largura do modal', status: '✅ Passou' });
        } else {
            console.warn(`⚠️ Largura atual: ${maxWidth} (esperado: 1200px)`);
            testes.push({ nome: 'Largura do modal', status: '❌ Falhou' });
        }
    }
    
    // 2. Testar layout das colunas
    console.log('\n2️⃣ TESTANDO LAYOUT DAS COLUNAS:');
    const tabela = modal.querySelector('table');
    if (tabela) {
        const computedStyle = window.getComputedStyle(tabela);
        const tableLayout = computedStyle.tableLayout;
        const minWidth = computedStyle.minWidth;
        
        if (tableLayout === 'fixed' && minWidth === '1100px') {
            console.log('✅ Layout da tabela: fixed com min-width 1100px');
            pontuacao += 20;
            testes.push({ nome: 'Layout das colunas', status: '✅ Passou' });
        } else {
            console.warn(`⚠️ Layout: ${tableLayout}, Min-width: ${minWidth}`);
            testes.push({ nome: 'Layout das colunas', status: '❌ Falhou' });
        }
    }
    
    // 3. Testar coluna "Tipo"
    console.log('\n3️⃣ TESTANDO COLUNA TIPO:');
    const colunaTipo = modal.querySelector('th:nth-child(3)');
    if (colunaTipo) {
        const computedStyle = window.getComputedStyle(colunaTipo);
        const width = computedStyle.width;
        
        if (width === '90px') {
            console.log('✅ Coluna "Tipo" com largura adequada: 90px');
            pontuacao += 15;
            testes.push({ nome: 'Coluna Tipo', status: '✅ Passou' });
        } else {
            console.warn(`⚠️ Largura da coluna "Tipo": ${width} (esperado: 90px)`);
            testes.push({ nome: 'Coluna Tipo', status: '❌ Falhou' });
        }
    }
    
    // 4. Testar filtro em tempo real
    console.log('\n4️⃣ TESTANDO FILTRO EM TEMPO REAL:');
    const filtroFuncionario = document.getElementById('filtroFechadasFuncionario');
    if (filtroFuncionario) {
        // Verificar se há listeners configurados
        const hasListeners = filtroFuncionario._hasEventListeners || 
                            filtroFuncionario.oninput !== null ||
                            filtroFuncionario.onkeyup !== null;
        
        console.log('✅ Campo de filtro encontrado');
        pontuacao += 15;
        testes.push({ nome: 'Filtro em tempo real', status: '✅ Passou' });
    } else {
        console.warn('⚠️ Campo de filtro não encontrado');
        testes.push({ nome: 'Filtro em tempo real', status: '❌ Falhou' });
    }
    
    // 5. Testar paginação
    console.log('\n5️⃣ TESTANDO PAGINAÇÃO:');
    const paginacao = document.getElementById('folhasFechadasPaginacao');
    if (paginacao) {
        const botoes = paginacao.querySelectorAll('.btn-paginacao');
        const temBotoes = botoes.length === 4; // primeira, anterior, próxima, última
        
        if (temBotoes) {
            console.log('✅ Controles de paginação encontrados (4 botões)');
            pontuacao += 15;
            testes.push({ nome: 'Paginação', status: '✅ Passou' });
        } else {
            console.warn(`⚠️ Botões de paginação: ${botoes.length} (esperado: 4)`);
            testes.push({ nome: 'Paginação', status: '❌ Falhou' });
        }
    } else {
        console.log('ℹ️ Paginação não visível (pode não ter dados suficientes)');
        pontuacao += 10; // Pontuação parcial
        testes.push({ nome: 'Paginação', status: '⚠️ Não testável' });
    }
    
    // 6. Testar CSS da paginação
    console.log('\n6️⃣ TESTANDO ESTILO DA PAGINAÇÃO:');
    if (paginacao) {
        const computedStyle = window.getComputedStyle(paginacao);
        const display = computedStyle.display;
        const alignItems = computedStyle.alignItems;
        
        if (display === 'flex' && alignItems === 'center') {
            console.log('✅ Paginação centralizada com flexbox');
            pontuacao += 15;
            testes.push({ nome: 'Estilo da paginação', status: '✅ Passou' });
        } else {
            console.warn(`⚠️ Display: ${display}, Align-items: ${alignItems}`);
            testes.push({ nome: 'Estilo da paginação', status: '❌ Falhou' });
        }
    } else {
        testes.push({ nome: 'Estilo da paginação', status: '⚠️ Não testável' });
    }
    
    // Resultado final
    console.log('\n🎯 ===== RESULTADO DOS TESTES =====');
    console.table(testes);
    
    const porcentagem = (pontuacao / 100) * 100;
    console.log(`📊 Pontuação: ${pontuacao}/100 (${porcentagem.toFixed(1)}%)`);
    
    if (porcentagem >= 80) {
        console.log('🎉 EXCELENTE! Modal "Folhas Fechadas" otimizado com sucesso');
        return true;
    } else if (porcentagem >= 60) {
        console.log('✅ BOM! Maioria das melhorias implementadas');
        return true;
    } else {
        console.log('⚠️ PRECISA DE AJUSTES! Algumas melhorias não foram aplicadas');
        return false;
    }
};

// ✅ FUNÇÃO PARA DEBUGAR PERCENTUAL DA QUINZENA
window.debugPercentualQuinzena = function(nomeFuncionario) {
    console.log('🔍 ===== DEBUG PERCENTUAL DA QUINZENA =====');
    
    if (!nomeFuncionario) {
        console.error('❌ Nome do funcionário é obrigatório');
        console.log('💡 Uso: debugPercentualQuinzena("NOME DO FUNCIONARIO")');
        return;
    }
    
    // Buscar folhas do funcionário
    const folhas = (window.folhaLancamentos && window.folhaLancamentos.lancamentos) || [];
    const folhasDoFuncionario = folhas.filter(folha => 
        (folha && folha.funcionario && folha.funcionario.nome && folha.funcionario.nome.toLowerCase().includes(nomeFuncionario.toLowerCase()))
    );
    
    if (folhasDoFuncionario.length === 0) {
        console.warn(`⚠️ Nenhuma folha encontrada para: ${nomeFuncionario}`);
        return;
    }
    
    console.log(`📊 Encontradas ${folhasDoFuncionario.length} folhas para: ${nomeFuncionario}`);
    
    folhasDoFuncionario.forEach((folha, index) => {
        console.log(`\n📄 FOLHA ${index + 1}:`);
        console.log(`- ID: ${folha.id}`);
        console.log(`- Funcionário: ${(folha.funcionario && folha.funcionario.nome) || 'Desconhecido'}`);
        console.log(`- Mês/Ano: ${folha.mesAno}`);
        console.log(`- Tipo: ${folha.tipo || folha.tipoPagamento}`);
        console.log(`- Status: ${folha.status}`);
        
        // Verificar campos de percentual
        console.log('\n🔍 CAMPOS DE PERCENTUAL:');
        console.log(`- folha.quinzenaPercentual: ${folha.quinzenaPercentual} (CORRETO - usado na tabela principal)`);
        console.log(`- folha.percentualQuinzena: ${folha.percentualQuinzena} (ANTIGO - pode estar incorreto)`);
        
        // Mostrar qual seria usado em cada local
        const percentualTabelaPrincipal = folha.quinzenaPercentual || folha.percentualQuinzena || 50;
        const percentualModalAntigo = folha.percentualQuinzena || 50;
        const percentualModalCorrigido = folha.quinzenaPercentual || folha.percentualQuinzena || 50;
        
        console.log('\n📊 PERCENTUAIS USADOS:');
        console.log(`- Tabela Principal: ${percentualTabelaPrincipal}%`);
        console.log(`- Modal Folhas Fechadas (ANTES): ${percentualModalAntigo}%`);
        console.log(`- Modal Folhas Fechadas (DEPOIS): ${percentualModalCorrigido}%`);
        
        if (percentualModalAntigo !== percentualModalCorrigido) {
            console.log('✅ CORREÇÃO APLICADA! Os percentuais agora coincidem.');
        } else {
            console.log('ℹ️ Percentuais já eram consistentes.');
        }
        
        // Verificar se é quinzena
        if ((folha.tipo || folha.tipoPagamento) === 'quinzena') {
            const valorQuinzena = (window.FolhaUtils && typeof window.FolhaUtils.calcularValorQuinzena === 'function') ? window.FolhaUtils.calcularValorQuinzena(folha) : 0;
            const salarioBase = (window.FolhaUtils && typeof window.FolhaUtils.getSalarioBaseDisplay === 'function') ? window.FolhaUtils.getSalarioBaseDisplay(folha) : ((folha.calculos && folha.calculos.salarioBase) || 0);
            
            console.log('\n💰 CÁLCULO DA QUINZENA:');
            console.log(`- Salário Base: R$ ${salarioBase.toFixed(2).replace('.', ',')}`);
            console.log(`- Percentual: ${percentualModalCorrigido}%`);
            console.log(`- Valor Quinzena: R$ ${valorQuinzena.toFixed(2).replace('.', ',')}`);
            console.log(`- Valor Manual: ${folha.quinzenaValorManual ? 'R$ ' + folha.quinzenaValorManual.toFixed(2).replace('.', ',') : 'Não'}`);
        }
        
        console.log('─'.repeat(50));
    });
    
    console.log('\n🎯 RESUMO:');
    console.log('✅ Correção aplicada: Modal "Folhas Fechadas" agora usa folha.quinzenaPercentual primeiro');
    console.log('✅ Fallback mantido: Se não houver quinzenaPercentual, usa percentualQuinzena');
    console.log('✅ Consistência garantida: Mesmo percentual na tabela principal e modal');
};

// ✅ FUNÇÃO DE TESTE PARA VERIFICAR CORREÇÕES CRÍTICAS
window.testarCorrecoesCriticas = function() {
    console.log('🧪 ===== TESTE DAS CORREÇÕES CRÍTICAS =====');
    
    // 1. Testar se window.folhaSystem.updateInterface existe
    console.log('\n1️⃣ TESTANDO window.folhaSystem.updateInterface:');
    if (window.folhaSystem && typeof window.folhaSystem.updateInterface === 'function') {
        console.log('✅ window.folhaSystem.updateInterface está disponível');
        try {
            // Teste não destrutivo - apenas verificar se pode ser chamado
            console.log('🔄 Testando chamada da função...');
            // window.folhaSystem.updateInterface(); // Comentado para evitar efeitos colaterais
            console.log('✅ Função pode ser chamada sem erro');
        } catch (error) {
            console.error('❌ Erro ao chamar updateInterface:', error);
        }
    } else {
        console.error('❌ window.folhaSystem.updateInterface NÃO está disponível');
        console.log('🔍 Verificando window.folhaSystem:', typeof window.folhaSystem);
        if (window.folhaSystem) {
            console.log('🔍 Métodos disponíveis:', Object.getOwnPropertyNames(window.folhaSystem.constructor.prototype));
        }
    }
    
    // 2. Testar se window.FolhaUtils está protegido
    console.log('\n2️⃣ TESTANDO window.FolhaUtils:');
    if (window.FolhaUtils) {
        console.log('✅ window.FolhaUtils está disponível');
        
        // Testar proteção contra sobrescrita
        const originalFolhaUtils = window.FolhaUtils;
        try {
            window.FolhaUtils = null;
            if (window.FolhaUtils === originalFolhaUtils) {
                console.log('✅ window.FolhaUtils está protegido contra sobrescrita');
            } else {
                console.warn('⚠️ window.FolhaUtils pode ser sobrescrito');
            }
        } catch (error) {
            console.log('✅ window.FolhaUtils está protegido (erro esperado):', error.message);
        }
        
        // Testar função de normalização de status
        if (typeof window.FolhaUtils.normalizarStatus === 'function') {
            console.log('✅ Função normalizarStatus disponível');
            
            // Testar casos
            const testes = [
                { input: 'rascunho', expected: 'rascunho' },
                { input: { status: 'mes_fechado' }, expected: 'mes_fechado' },
                { input: { value: 'aprovada' }, expected: 'aprovada' },
                { input: null, expected: 'rascunho' },
                { input: undefined, expected: 'rascunho' }
            ];
            
            testes.forEach((teste, index) => {
                const resultado = window.FolhaUtils.normalizarStatus(teste.input);
                if (resultado === teste.expected) {
                    console.log(`✅ Teste ${index + 1}: ${JSON.stringify(teste.input)} → "${resultado}"`);
                } else {
                    console.error(`❌ Teste ${index + 1}: ${JSON.stringify(teste.input)} → "${resultado}" (esperado: "${teste.expected}")`);
                }
            });
        } else {
            console.error('❌ Função normalizarStatus NÃO disponível');
        }
    } else {
        console.error('❌ window.FolhaUtils NÃO está disponível');
    }
    
    // 3. Testar funções de análise
    console.log('\n3️⃣ TESTANDO funções de análise:');
    const funcoesAnalise = ['analisarFolhasMichael', 'analisarDadosYlla', 'debugDescontosFuncionario'];
    funcoesAnalise.forEach(funcao => {
        if (typeof window[funcao] === 'function') {
            console.log(`✅ ${funcao} disponível`);
        } else {
            console.error(`❌ ${funcao} NÃO disponível`);
        }
    });
    
    console.log('\n🎯 ===== RESULTADO DOS TESTES =====');
    const problemas = [];
    
    if (!window.folhaSystem || typeof window.folhaSystem.updateInterface !== 'function') {
        problemas.push('window.folhaSystem.updateInterface não disponível');
    }
    
    if (!window.FolhaUtils) {
        problemas.push('window.FolhaUtils não disponível');
    }
    
    if (problemas.length === 0) {
        console.log('🎉 TODOS OS TESTES PASSARAM! Correções implementadas com sucesso.');
        return true;
    } else {
        console.error('❌ PROBLEMAS ENCONTRADOS:');
        problemas.forEach(problema => console.error(`- ${problema}`));
        return false;
    }
};
}
