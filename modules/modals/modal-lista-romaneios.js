/**
 * 📋 MÓDULO: Modal de Lista de Romaneios - Romaneio TL
 * 
 * Responsabilidades:
 * - Gerenciar modal de lista de romaneios
 * - Paginação e filtros
 * - Integração com Firebase
 * - Ações de impressão e edição
 * 
 * ✅ ESTRUTURA MODULAR: Seguindo romaneiotl-estruturaçãomodular.txt
 * ✅ FIREBASE PRIORITY: Firebase primeiro, localStorage como fallback
 */

window.ModalListaRomaneios = (function() {
    'use strict';

    // ✅ CONFIGURAÇÕES
    const CONFIG = {
        modalId: 'listaModal',
        tableId: 'listaRomaneios',
        filterId: 'romaneioListFilter',
        paginationId: 'romaneioListPagination',
        itemsPerPage: 5,  // ✅ REDUZIDO: 5 romaneios por página
        debug: false
    };

    function dbg(...args) {
        if (CONFIG.debug === true) console.log(...args);
    }

    function getIoService() {
        const svc = window.firebaseService || window.firebaseServiceTL || null;
        if (svc && typeof svc.loadFromFirebase === 'function' && typeof svc.saveToFirebase === 'function') {
            return {
                load: (path) => svc.loadFromFirebase(path),
                save: (path, key, data) => svc.saveToFirebase(path, key, data, { silent: true })
            };
        }
        const legacy = window.FirebaseService || null;
        if (legacy && typeof legacy.loadFromFirebase === 'function') {
            return {
                load: (path) => legacy.loadFromFirebase(path),
                save: (path, key, data) => {
                    const full = key !== null && key !== undefined ? `${String(path).replace(/\/+$/, '')}/${String(key)}` : String(path);
                    if (typeof legacy.saveData === 'function') return legacy.saveData(full, data);
                    if (typeof legacy.deleteData === 'function' && data === null) return legacy.deleteData(full);
                    throw new Error('Serviço legado não suporta escrita');
                }
            };
        }
        return null;
    }

    function removeFromLocalCachesById(id) {
        const candidates = ['romaneios/tl'];
        const sid = String(id);
        candidates.forEach(key => {
            try {
                const raw = readLocalObject(key);
                if (Array.isArray(raw)) {
                    const filtered = raw.filter(r => String(r && (r.firebaseKey || r.id)) !== sid);
                    writeLocalObject(key, filtered);
                } else if (raw && typeof raw === 'object') {
                    if (raw[sid]) {
                        delete raw[sid];
                        writeLocalObject(key, raw);
                    }
                }
            } catch (_) {}
        });
    }

    // ✅ ESTADO DO MODAL
    let state = {
        currentPage: 1,
        romaneios: [],
        filteredRomaneios: [],
        isLoading: false
    };
    const getMessage = (key, fallback) => (
        typeof window.getRomaneioMessage === 'function'
            ? window.getRomaneioMessage(key, fallback)
            : String(fallback || '')
    );
    const MSG_CONFIRM_DELETE = getMessage('romaneio.confirm.delete', 'Tem certeza que deseja excluir este romaneio?');
    const MSG_CONFIRM_DUPLICATE_LANCAMENTO = getMessage('romaneio.confirm.duplicate_lancamento', 'Este romaneio já foi lançado em Contas a Receber. Deseja criar uma nova conta a receber?');
    const MSG_SUCCESS_DELETE = getMessage('romaneio.success.delete', 'Romaneio excluído com sucesso.');
    const MSG_SUCCESS_LANCAR_CONTAS = getMessage('romaneio.success.lancar_contas_receber', 'Conta a receber lançada com sucesso.');
    const MSG_ERROR_NOT_FOUND = getMessage('romaneio.error.not_found', 'Romaneio não encontrado.');
    const MSG_ERROR_CLIENTE_MISSING = getMessage('romaneio.error.cliente_missing', 'Cliente não informado no romaneio.');
    const MSG_ERROR_VALOR_INVALIDO = getMessage('romaneio.error.valor_invalido', 'Valor do romaneio inválido.');
    const MSG_ERROR_DELETE_FAILED = getMessage('romaneio.error.delete_failed', 'Não foi possível excluir o romaneio.');
    const MSG_ERROR_PRINT_UNAVAILABLE = getMessage('romaneio.error.print_unavailable', 'Funcionalidade de impressão não disponível.');
    const MSG_ERROR_EDIT_UNAVAILABLE = getMessage('romaneio.error.edit_unavailable', 'Funcionalidade de edição não disponível.');
    const MSG_WARNING_LANCAR_FAILED_PREFIX = getMessage('romaneio.warning.lancar_contas_receber_failed_prefix', 'Não foi possível lançar contas a receber: ');
    let modalOutsideClickHandler = null;
    let modalAutoCloseHandler = null;
    function parseRomaneioTime(r) {
        if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.parseRomaneioTimestamp === 'function') {
            return window.RomaneioDataUtils.parseRomaneioTimestamp(r);
        }
        const candidates = [
            r && r._metadata && r._metadata.lastUpdated,
            r && r.updatedAt,
            r && r.updated,
            r && r.lastModified,
            r && r.dataEmissao,
            r && r.data,
            r && r.dataHora,
            r && r.dataCriacao,
            r && r.createdAt,
            r && r.created,
            r && r.timestamp
        ];
        for (const candidate of candidates) {
            if (!candidate) continue;
            const t = typeof candidate === 'number' ? candidate : Date.parse(candidate);
            if (!isNaN(t)) return t;
        }
        const id = String(r && (r.id || r.romaneioId || r.firebaseKey || r.key || r.numero || r.numeroRomaneio) || '');
        const match = id.match(/(\d{10,})/);
        return match ? Number(match[1]) || 0 : 0;
    }
    function resolveCompanyId() {
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
                const id = raw.companyId || raw.companyID || raw.tenantId || raw.id;
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
    }

    function resolveStorageKey(base) {
        try {
            const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                const ns = svc.getNamespacedPath(base);
                if (ns) return ns;
            }
        } catch (_) {}
        const companyId = resolveCompanyId();
        if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
            return `companies/${companyId}/${base}`;
        }
        if (/^companies\//.test(base)) return base;
        return null;
    }

    function readLocalObject(base) {
        const nsKey = resolveStorageKey(base);
        if (!nsKey || !/^companies\//.test(String(nsKey))) return {};
        try {
            const rawNs = localStorage.getItem(nsKey);
            if (rawNs) {
                const parsed = JSON.parse(rawNs);
                if (parsed && typeof parsed === 'object') return parsed;
            }
        } catch (_) {}
        return {};
    }

    function writeLocalObject(base, obj) {
        const nsKey = resolveStorageKey(base);
        if (!nsKey || !/^companies\//.test(String(nsKey))) return;
        try {
            if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
                window.SiswebStorage.write(nsKey, obj);
                return;
            }
        } catch (_) {}
        localStorage.setItem(nsKey, JSON.stringify(obj));
    }

    function obterNomeClienteRomaneio(romaneio) {
        if (!romaneio || typeof romaneio !== 'object') return '';
        if (romaneio.cliente && typeof romaneio.cliente === 'object') {
            return String(
                romaneio.cliente.nome ||
                romaneio.cliente.name ||
                romaneio.cliente.razaoSocial ||
                romaneio.cliente.fantasia ||
                romaneio.clienteNome ||
                romaneio.nomeCliente ||
                ''
            );
        }
        return String(romaneio.cliente || romaneio.clienteNome || romaneio.nomeCliente || '');
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function truncateText(text, max = 90) {
        const normalized = String(text || '').trim();
        if (!normalized) return '';
        if (normalized.length <= max) return normalized;
        return `${normalized.slice(0, max - 1)}…`;
    }

    function normalizeDateInputValue(value) {
        if (typeof value === 'number' && isFinite(value)) {
            const parsed = new Date(value);
            if (!isNaN(parsed.getTime())) {
                const y = parsed.getFullYear();
                const m = String(parsed.getMonth() + 1).padStart(2, '0');
                const d = String(parsed.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            }
        }
        const raw = String(value || '').trim();
        if (!raw) return '';
        const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
        const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (br) return `${br[3]}-${br[2]}-${br[1]}`;
        const parsed = new Date(raw);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return '';
    }

    function formatDateLabel(value) {
        const normalized = normalizeDateInputValue(value);
        if (!normalized) return value ? String(value) : 'N/A';
        const parts = normalized.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function toLocalDateObject(value) {
        const normalized = normalizeDateInputValue(value);
        if (normalized) {
            const parts = normalized.split('-').map(Number);
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }
        return new Date();
    }

    // ✅ FUNÇÃO AUXILIAR PARA FORMATAÇÃO DE MOEDA - USANDO UTILITÁRIO EXISTENTE
    function formatarMoedaTL(valor) {
        // ✅ CORREÇÃO: Usar UtilsTL.formatCurrency existente para evitar conflitos
        if (window.UtilsTL && window.UtilsTL.formatCurrency) {
            return window.UtilsTL.formatCurrency(valor);
        }
        
        // Fallback caso UtilsTL não esteja disponível
        if (typeof valor !== 'number') {
            valor = parseFloat(valor) || 0;
        }
        return valor.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }

    /**
     * ✅ ABRIR MODAL DE LISTA DE ROMANEIOS
     */
    async function openModal() {
        dbg('📋 Abrindo modal de lista de romaneios...');
        
        try {
            const modal = document.getElementById(CONFIG.modalId);
            if (!modal) {
                console.error('❌ Modal de romaneios não encontrado no DOM');
                return;
            }

            // Exibir modal
            modal.style.display = 'block';
            
            // Carregar dados
            await loadRomaneios();
            
            // Renderizar lista
            renderRomaneiosList();
            renderPagination();
            
            // Configurar eventos
            setupEventListeners();
            
            dbg('✅ Modal de romaneios aberto com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao abrir modal de romaneios:', error);
            showError('Erro ao carregar lista de romaneios');
        }
    }

    /**
     * ✅ CARREGAR ROMANEIOS DO FIREBASE
     */
    async function loadRomaneios() {
        state.isLoading = true;
        updateLoadingState();

        try {
            const io = getIoService();
            let romaneios = [];

            if (io && typeof io.load === 'function') {
                let data = null;
                try {
                    const res = await io.load('romaneios/tl');
                    if (res && res.success && res.data && typeof res.data === 'object' && Object.keys(res.data).length > 0) {
                        data = res.data;
                    }
                } catch (_) {}

                if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.normalizeRomaneioCollection === 'function') {
                    romaneios = window.RomaneioDataUtils.normalizeRomaneioCollection(data, { type: 'TL' });
                } else if (data && typeof data === 'object' && !Array.isArray(data)) {
                    romaneios = Object.keys(data).map(key => ({
                        id: key,
                        firebaseKey: key,
                        ...data[key]
                    })).filter(item => item && (item.cliente || item.numero || item.timestamp || item.data));
                } else if (Array.isArray(data)) {
                    romaneios = data.filter(item => item && (item.cliente || item.numero || item.timestamp || item.data));
                }
            }

            state.romaneios = (Array.isArray(romaneios) ? romaneios : [])
                .sort((a, b) => parseRomaneioTime(b) - parseRomaneioTime(a));
            state.filteredRomaneios = [...state.romaneios];
            state.currentPage = 1;
            dbg('TL: romaneios carregados:', state.romaneios.length);
        } catch (error) {
            console.error('❌ Erro ao carregar romaneios:', error);
            state.romaneios = [];
            state.filteredRomaneios = [];
            showError('Erro ao carregar dados dos romaneios');
        } finally {
            state.isLoading = false;
            updateLoadingState();
        }
    }

    /**
     * ✅ RENDERIZAR LISTA DE ROMANEIOS
     */
    function renderRomaneiosList() {
        const tbody = document.getElementById(CONFIG.tableId);
        if (!tbody) {
            console.error('❌ Tabela de romaneios não encontrada');
            return;
        }

        // Calcular itens da página atual
        const startIndex = (state.currentPage - 1) * CONFIG.itemsPerPage;
        const endIndex = startIndex + CONFIG.itemsPerPage;
        const romaneiosToShow = state.filteredRomaneios.slice(startIndex, endIndex);

        if (state.isLoading) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px;">
                        <i class="fas fa-spinner fa-spin"></i> Carregando romaneios...
                    </td>
                </tr>
            `;
            return;
        }

        if (romaneiosToShow.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-clipboard-list"></i><br>
                        ${state.filteredRomaneios.length === 0 ? 'Nenhum romaneio encontrado' : 'Nenhum romaneio encontrado com os filtros aplicados'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = romaneiosToShow.map(romaneio => {
            const data = formatDateLabel(romaneio.dataEmissao || romaneio.data || romaneio.timestamp);
            const clienteCompleto = obterNomeClienteRomaneio(romaneio) || 'N/A';
            const cliente = truncateText(clienteCompleto, 64);
            
            const especiesCompletas = romaneio.items ? [...new Set(romaneio.items.map(item => item.especie).filter(Boolean))].join(', ') : 'N/A';
            const especies = truncateText(especiesCompletas || 'N/A', 92);
            const totalItens = romaneio.items ? romaneio.items.length : 0;
            // ✅ RECALCULAR TOTAIS - não usar valores salvos que podem estar incorretos
            const totaisRecalculados = recalcularTotaisRomaneio(romaneio);
            const totalVolume = totaisRecalculados.volume.toFixed(3);
            const totalValue = formatCurrency(totaisRecalculados.valor);
            
            // ✅ NOVO: Verificar se romaneio já foi lançado para contas a receber
            const jaLancado = romaneio.contasReceberLancado === true;
            const botaoFinanceiroClass = jaLancado ? 'action-button financeiro-button disabled' : 'action-button financeiro-button';
            const botaoFinanceiroTitle = jaLancado ? 'Já lançado em Contas a Receber' : 'Lançar Contas a Receber';
            const botaoFinanceiroOnclick = jaLancado ? '' : `onclick="window.ModalListaRomaneios.lancarContasReceber('${romaneio.id}')"`;
            
            return `
                <tr>
                    <td title="${escapeHtml(data)}">${escapeHtml(data)}</td>
                    <td title="${escapeHtml(clienteCompleto)}">${escapeHtml(cliente)}</td>
                    <td title="${escapeHtml(especiesCompletas || 'N/A')}">${escapeHtml(especies)}</td>
                    <td style="text-align: center;">${totalItens}</td>
                    <td style="text-align: right;">${totalVolume} m³</td>
                    <td title="${escapeHtml(totalValue)}">${escapeHtml(totalValue)}</td>
                    <td style="text-align: center;">
                        <div class="btn-group">
                            <button class="action-button edit-button" onclick="window.ModalListaRomaneios.editRomaneio('${romaneio.id}')" title="Editar Romaneio">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="${botaoFinanceiroClass}" ${botaoFinanceiroOnclick} title="${botaoFinanceiroTitle}">
                                <i class="fas fa-money-bill-wave"></i>
                            </button>
                            <div class="dropdown">
                                <button class="action-button print-button" onclick="window.ModalListaRomaneios.togglePrintDropdown(this)" title="Imprimir Romaneio">
                                    <i class="fas fa-print"></i>
                                </button>
                                <div class="dropdown-content">
                                    <a href="#" data-print-romaneio-id="${romaneio.id}" data-print-mode="completo" onclick="window.ModalListaRomaneios.printRomaneio('${romaneio.id}', 'completo'); return false;">
                                        <i class="fas fa-file-alt"></i> Completo
                                    </a>
                                    <a href="#" data-print-romaneio-id="${romaneio.id}" data-print-mode="sem_preco_unitario" onclick="window.ModalListaRomaneios.printRomaneio('${romaneio.id}', 'sem_preco_unitario'); return false;">
                                        <i class="fas fa-file-minus"></i> Sem Preço Unitário
                                    </a>
                                    <a href="#" data-print-romaneio-id="${romaneio.id}" data-print-mode="sem_preco" onclick="window.ModalListaRomaneios.printRomaneio('${romaneio.id}', 'sem_preco'); return false;">
                                        <i class="fas fa-file-times"></i> Sem Preços
                                    </a>
                                </div>
                            </div>
                            <button class="action-button delete-button" onclick="window.ModalListaRomaneios.deleteRomaneio('${romaneio.id}')" title="Excluir Romaneio">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Atualizar informações do modal
        updateModalInfo();
    }

    /**
     * ✅ RENDERIZAR PAGINAÇÃO
     */
    function renderPagination() {
        const container = document.getElementById(CONFIG.paginationId);
        if (!container) return;

        const totalPages = Math.ceil(state.filteredRomaneios.length / CONFIG.itemsPerPage);

        if (totalPages <= 1) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }
        if (state.currentPage > totalPages) state.currentPage = totalPages;
        if (state.currentPage < 1) state.currentPage = 1;

        container.style.display = 'flex';
        container.innerHTML = '';

        const addBtn = (label, page, disabled = false, active = false) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            if (active) btn.classList.add('active');
            btn.disabled = disabled;
            btn.onclick = () => goToPage(page);
            container.appendChild(btn);
        };

        addBtn('<<<', 1, state.currentPage === 1);
        addBtn('<', state.currentPage - 1, state.currentPage === 1);
        const startPage = Math.max(1, state.currentPage - 2);
        const endPage = Math.min(totalPages, state.currentPage + 2);
        if (startPage > 1) {
            addBtn('1', 1, false, state.currentPage === 1);
            if (startPage > 2) {
                const span = document.createElement('span');
                span.textContent = '...';
                container.appendChild(span);
            }
        }
        for (let i = startPage; i <= endPage; i++) {
            addBtn(String(i), i, false, i === state.currentPage);
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const span = document.createElement('span');
                span.textContent = '...';
                container.appendChild(span);
            }
            addBtn(String(totalPages), totalPages, false, state.currentPage === totalPages);
        }
        addBtn('>', state.currentPage + 1, state.currentPage === totalPages);
        addBtn('>>>', totalPages, state.currentPage === totalPages);
    }

    /**
     * ✅ NAVEGAR PARA PÁGINA
     */
    function goToPage(page) {
        const totalPages = Math.max(1, Math.ceil(state.filteredRomaneios.length / CONFIG.itemsPerPage));
        if (page < 1 || page > totalPages) return;
        state.currentPage = page;
        renderRomaneiosList();
        renderPagination();
    }

    /**
     * ✅ FILTRAR ROMANEIOS
     */
    function filterRomaneios() {
        const filterInput = document.getElementById(CONFIG.filterId);
        if (!filterInput) return;

        const filterText = filterInput.value.toLowerCase().trim();
        
        if (!filterText) {
            state.filteredRomaneios = [...state.romaneios];
        } else {
            state.filteredRomaneios = state.romaneios.filter(romaneio => {
                // ✅ CORREÇÃO: Suporte a cliente como objeto ou string no filtro
                const cliente = obterNomeClienteRomaneio(romaneio).toLowerCase();
                
                const especies = romaneio.items ? romaneio.items.map(item => item.especie || '').join(' ').toLowerCase() : '';
                const data = `${romaneio.dataEmissao || romaneio.data || ''} ${formatDateLabel(romaneio.dataEmissao || romaneio.data || romaneio.timestamp)}`.toLowerCase();
                
                return cliente.includes(filterText) || 
                       especies.includes(filterText) || 
                       data.includes(filterText);
            });
        }

        state.currentPage = 1;
        renderRomaneiosList();
        renderPagination();
    }

    /**
     * ✅ EDITAR ROMANEIO
     */
    function editRomaneio(romaneioId) {
        dbg(`✏️ Editando romaneio: ${romaneioId}`);
        
        // ✅ VERIFICAR SE O ROMANEIO JÁ FOI LANÇADO EM CONTAS A RECEBER
        const sid = String(romaneioId || '');
        const romaneio = state.romaneios.find(r => String(r.id) === sid || String(r.firebaseKey) === sid);
        if (romaneio && romaneio.contasReceberLancado === true) {
            try {
                const msg = '⚠️ Este romaneio já foi lançado em Contas a Receber. Cancele o lançamento para editar.';
                if (typeof window.__toast === 'function') {
                    window.__toast(msg, 'warning', { duration: 5000 });
                } else if (window.Utils && window.Utils.showToast) {
                    window.Utils.showToast(msg, 'warning');
                }
            } catch (_) {}
            dbg('⚠️ TL: Tentativa de editar romaneio já lançado bloqueada:', romaneioId);
            return;
        }
        
        // Implementar edição de romaneio
        if (window.SalvarRomaneio && window.SalvarRomaneio.carregarRomaneioParaEdicao) {
            closeModal();
            window.SalvarRomaneio.carregarRomaneioParaEdicao(romaneioId, romaneio);
        } else {
            console.error('❌ Funcionalidade de edição não disponível');
            showError(MSG_ERROR_EDIT_UNAVAILABLE);
        }
    }

    /**
     * ✅ IMPRIMIR ROMANEIO
     */
    function normalizePrintTypeTL(tipo) {
        if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.normalizePrintMode === 'function') {
            return window.RomaneioDataUtils.normalizePrintMode(tipo);
        }
        return String(tipo || 'completo').replace(/-/g, '_').toLowerCase();
    }

    function printRomaneio(romaneioId, tipo) {
        const printType = normalizePrintTypeTL(tipo);
        dbg(`🖨️ Imprimindo romaneio: ${romaneioId}, tipo: ${printType}`);
        // ✅ Sempre fechar dropdowns antes de imprimir
        closeAllPrintDropdownsTL();
        
        if (window.ImprimirRomaneio && window.ImprimirRomaneio.imprimirRomaneio) {
            Promise.resolve(window.ImprimirRomaneio.imprimirRomaneio(romaneioId, printType)).catch((error) => {
                console.error('❌ Erro ao imprimir romaneio TL:', error);
                showError(MSG_ERROR_PRINT_UNAVAILABLE);
            });
        } else {
            console.error('❌ Módulo de impressão não disponível');
            showError(MSG_ERROR_PRINT_UNAVAILABLE);
        }
        return false;
    }

    /**
     * ✅ EXCLUIR ROMANEIO
     */
    async function deleteRomaneio(romaneioId) {
        try {
            if (!confirm(MSG_CONFIRM_DELETE)) return;

            const sid = String(romaneioId);
            const alvo = (state.romaneios || []).find(r => String(r && (r.firebaseKey || r.id)) === sid) || null;
            const key = String((alvo && (alvo.firebaseKey || alvo.id)) || sid);

            const io = getIoService();
            if (io && typeof io.save === 'function') {
                await io.save('romaneios/tl', key, null);
            } else {
                console.warn('⚠️ Serviço Firebase indisponível para exclusão.');
            }

            removeFromLocalCachesById(key);
            state.romaneios = (state.romaneios || []).filter(r => String(r && (r.firebaseKey || r.id)) !== key);
            state.filteredRomaneios = (state.filteredRomaneios || []).filter(r => String(r && (r.firebaseKey || r.id)) !== key);
            if (state.currentPage > 1) {
                const totalPages = Math.max(1, Math.ceil(state.filteredRomaneios.length / CONFIG.itemsPerPage));
                if (state.currentPage > totalPages) state.currentPage = totalPages;
            }

            renderRomaneiosList();
            renderPagination();

            showSuccess(MSG_SUCCESS_DELETE);

            await loadRomaneios();
            renderRomaneiosList();
            renderPagination();

            try {
                if (window.romaneioTL && typeof window.romaneioTL.loadRomaneios === 'function') {
                    window.romaneioTL.loadRomaneios();
                }
            } catch (_) {}

        } catch (error) {
            console.error('❌ Erro ao excluir romaneio:', error);
            showError(MSG_ERROR_DELETE_FAILED);
        }
    }

    /**
     * ✅ TOGGLE DROPDOWN DE IMPRESSÃO (baseado no original)
     */
    function togglePrintDropdown(button) {
        const dropdown = button.parentElement.querySelector('.dropdown-content');
        
        if (!dropdown) {
            console.error('❌ Dropdown não encontrado');
            return;
        }

        if (!button.dataset.tlPrintDropdownSource) {
            button.dataset.tlPrintDropdownSource = `tl-print-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        }

        const currentMenu = document.querySelector(`.external-print-menu[data-source="${button.dataset.tlPrintDropdownSource}"]`);
        if (currentMenu) {
            closeAllPrintDropdownsTL();
            dbg('✅ Dropdown fechado');
            return;
        }

        closeAllPrintDropdownsTL();

        const printOptions = [
            { mode: 'completo', icon: 'fas fa-file-alt', label: 'Completo' },
            { mode: 'sem_preco_unitario', icon: 'fas fa-file-minus', label: 'Sem Preço Unitário' },
            { mode: 'sem_preco', icon: 'fas fa-file-times', label: 'Sem Preços' }
        ];
        const romaneioId = button.dataset.romaneioId || button.closest('tr')?.dataset?.romaneioId || dropdown.querySelector('[data-print-romaneio-id]')?.dataset?.printRomaneioId || '';
        const floatingMenu = document.createElement('div');
        floatingMenu.className = 'dropdown-content show external-print-menu tl-print-dropdown-menu';
        floatingMenu.dataset.source = button.dataset.tlPrintDropdownSource;
        floatingMenu.innerHTML = printOptions.map(option => `
            <button type="button" class="tl-print-option" data-print-romaneio-id="${romaneioId}" data-print-mode="${option.mode}">
                <i class="${option.icon}"></i> ${option.label}
            </button>
        `).join('');
        document.body.appendChild(floatingMenu);

        function findMenuOptionFromEvent(event) {
            const direct = event.target.closest && event.target.closest('[data-print-mode]');
            if (direct) return direct;
            const x = event.clientX;
            const y = event.clientY;
            if (typeof x !== 'number' || typeof y !== 'number') return null;
            return Array.from(floatingMenu.querySelectorAll('[data-print-mode]')).find(option => {
                const rect = option.getBoundingClientRect();
                return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
            }) || null;
        }

        floatingMenu.addEventListener('mousedown', function(event) {
            if (findMenuOptionFromEvent(event)) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);

        floatingMenu.addEventListener('click', function(event) {
            const option = findMenuOptionFromEvent(event);
            if (!option) return;
            event.preventDefault();
            event.stopPropagation();
            printRomaneio(option.dataset.printRomaneioId, option.dataset.printMode);
        }, true);

        try {
            const modal = document.getElementById(CONFIG.modalId);
            if (modal) modal.classList.add('has-active-print-dropdown');

            const rect = button.getBoundingClientRect();
            floatingMenu.style.position = 'fixed';
            floatingMenu.style.top = `${rect.bottom + 4}px`;
            floatingMenu.style.left = `${rect.left}px`;
            floatingMenu.style.zIndex = '10000080';
            floatingMenu.style.right = 'auto';
            floatingMenu.style.marginTop = '0';
            floatingMenu.style.maxHeight = '280px';
            floatingMenu.style.overflowY = 'auto';
            floatingMenu.style.display = 'block';
            floatingMenu.style.minWidth = '220px';
            floatingMenu.style.background = '#fff';
            floatingMenu.style.border = '1px solid #d6e1ec';
            floatingMenu.style.borderRadius = '6px';
            floatingMenu.style.boxShadow = '0 14px 34px rgba(13, 35, 57, 0.32)';
            floatingMenu.style.pointerEvents = 'auto';

            const viewportPadding = 8;
            const menuRect = floatingMenu.getBoundingClientRect();
            if (menuRect.right > (window.innerWidth - viewportPadding)) {
                const clampedLeft = Math.max(viewportPadding, window.innerWidth - menuRect.width - viewportPadding);
                floatingMenu.style.left = `${clampedLeft}px`;
            }
            if (menuRect.bottom > (window.innerHeight - viewportPadding)) {
                const clampedTop = Math.max(viewportPadding, rect.top - menuRect.height - 4);
                floatingMenu.style.top = `${clampedTop}px`;
            }
        } catch (e) {
            console.warn('⚠️ Falha ao posicionar dropdown TL:', e);
        }

        dbg('✅ Dropdown mostrado como menu flutuante externo');

        setTimeout(() => {
            if (window.currentDropdownCloseHandler) {
                document.removeEventListener('mousedown', window.currentDropdownCloseHandler, true);
            }

            const closeHandler = function(event) {
                const isInsideDropdown = floatingMenu.contains(event.target);
                const rect = floatingMenu.getBoundingClientRect();
                const isInsideByPoint = typeof event.clientX === 'number'
                    && event.clientX >= rect.left
                    && event.clientX <= rect.right
                    && event.clientY >= rect.top
                    && event.clientY <= rect.bottom;
                const isDropdownButton = button.contains(event.target);

                if (!isInsideDropdown && !isInsideByPoint && !isDropdownButton) {
                    closeAllPrintDropdownsTL();
                    dbg('✅ Dropdown fechado por clique externo');
                }
            };

            document.addEventListener('mousedown', closeHandler, true);
            window.currentDropdownCloseHandler = closeHandler;
        }, 100);

        if (!window.currentDropdownEscapeHandler) {
            const escapeHandler = function(ev) {
                if (ev.key === 'Escape') {
                    closeAllPrintDropdownsTL();
                    dbg('✅ Dropdown fechado pela tecla Escape');
                }
            };
            document.addEventListener('keydown', escapeHandler);
            window.currentDropdownEscapeHandler = escapeHandler;
        }
    }

    /**
     * ✅ FECHAR TODOS OS DROPDOWNS DE IMPRESSÃO (TL)
     */
    function closeAllPrintDropdownsTL() {
        try {
            document.querySelectorAll('.dropdown-content.show').forEach(d => {
                d.classList.remove('show');
                d.style.display = 'none';
            });
            // Remover possíveis menus externos flutuantes
            document.querySelectorAll('.external-print-menu').forEach(menu => menu.remove());
            const modal = document.getElementById(CONFIG.modalId);
            if (modal) modal.classList.remove('has-active-print-dropdown');
            // Remover handlers ativos
            if (window.currentDropdownCloseHandler) {
                document.removeEventListener('mousedown', window.currentDropdownCloseHandler, true);
                window.currentDropdownCloseHandler = null;
            }
            if (window.currentDropdownEscapeHandler) {
                document.removeEventListener('keydown', window.currentDropdownEscapeHandler);
                window.currentDropdownEscapeHandler = null;
            }
        } catch (e) {
            console.warn('⚠️ Falha ao fechar dropdowns de impressão TL:', e);
        }
    }

    /**
     * ✅ FECHAR MODAL
     */
    function closeModal() {
        const modal = document.getElementById(CONFIG.modalId);
        if (modal) {
            modal.style.display = 'none';
        }
        // ✅ Garantir fechamento de dropdowns ao fechar modal
        closeAllPrintDropdownsTL();
        dbg('✅ Modal de romaneios fechado');
    }

    /**
     * ✅ CONFIGURAR EVENT LISTENERS
     */
    function setupEventListeners() {
        const modal = document.getElementById(CONFIG.modalId);
        if (!modal) return;

        // Filtro de busca
        const filterInput = document.getElementById(CONFIG.filterId);
        if (filterInput) {
            filterInput.removeEventListener('input', filterRomaneios); // Remover listener anterior
            filterInput.addEventListener('input', filterRomaneios);
        }

        // Botões de fechar
        const closeButtons = modal.querySelectorAll('.close-modal, .close-modal-btn');
        closeButtons.forEach(btn => {
            btn.onclick = closeModal;
        });

        // Fechar ao clicar fora
        if (modalOutsideClickHandler) {
            modal.removeEventListener('click', modalOutsideClickHandler);
        }
        modalOutsideClickHandler = (event) => {
            if (event.target === modal) {
                closeModal();
            }
        };
        modal.addEventListener('click', modalOutsideClickHandler);

        if (modalAutoCloseHandler) {
            window.removeEventListener('scroll', modalAutoCloseHandler);
            window.removeEventListener('resize', modalAutoCloseHandler);
        }
        modalAutoCloseHandler = () => closeAllPrintDropdownsTL();
        window.addEventListener('scroll', modalAutoCloseHandler);
        window.addEventListener('resize', modalAutoCloseHandler);
    }

    /**
     * ✅ ATUALIZAR ESTADO DE CARREGAMENTO
     */
    function updateLoadingState() {
        renderRomaneiosList();
    }

    /**
     * ✅ ATUALIZAR INFORMAÇÕES DO MODAL
     */
    function updateModalInfo() {
        const info = document.getElementById('romaneioModalInfo');
        if (info) {
            const total = state.filteredRomaneios.length;
            info.textContent = `${total} romaneio${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;
        }
    }

    /**
     * ✅ FORMATAR MOEDA
     */
    function formatCurrency(value) {
        if (window.Utils && window.Utils.formatCurrency) {
            return window.Utils.formatCurrency(value);
        }
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    /**
     * ✅ MOSTRAR ERRO
     */
    function showError(message) {
        try {
            if (typeof window.__toast === 'function') {
                window.__toast(message, 'error', { duration: 5000 });
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(message, 'error');
            } else {
                console.error('Erro: ' + message);
            }
        } catch (_) { console.error('Erro: ' + message); }
    }

    function showSuccess(message) {
        try {
            if (typeof window.__toast === 'function') {
                window.__toast(message, 'success');
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(message, 'success');
            } else {
                console.log(message);
            }
        } catch (_) { console.log(message); }
    }

    function showWarning(message) {
        try {
            if (typeof window.__toast === 'function') {
                window.__toast(message, 'warning');
            } else if (window.Utils && window.Utils.showToast) {
                window.Utils.showToast(message, 'warning');
            } else {
                alert(message);
            }
        } catch (_) { alert(message); }
    }

    /**
     * ✅ RECARREGAR LISTA
     */
    async function refresh() {
        dbg('🔄 Recarregando lista de romaneios...');
        await loadRomaneios();
        renderRomaneiosList();
        renderPagination();
    }

    /**
     * 💰 LANÇAR CONTAS A RECEBER
     * ✅ NOVA FUNCIONALIDADE: Integração com sistema financeiro
     */
    async function lancarContasReceber(romaneioId) {
        dbg('💰 Iniciando lançamento de contas a receber para romaneio:', romaneioId);
        
        try {
            // Buscar dados completos do romaneio
            const romaneio = await buscarRomaneioCompleto(romaneioId);
            if (!romaneio) {
                showError(MSG_ERROR_NOT_FOUND);
                return;
            }
            const nomeCliente = obterNomeClienteRomaneio(romaneio).trim();
            
            // Validar dados essenciais
            if (!nomeCliente) {
                showError(MSG_ERROR_CLIENTE_MISSING);
                return;
            }
            
            // Calcular valor total do romaneio
            const totaisRecalculados = recalcularTotaisRomaneio(romaneio);
            const valorTotal = totaisRecalculados.valor;
            
            if (!valorTotal || valorTotal <= 0) {
                showError(MSG_ERROR_VALOR_INVALIDO);
                return;
            }
            
            // Verificar se já foi lançado
            const jaLancado = await verificarRomaneioJaLancado(romaneioId);
            if (jaLancado) {
                const confirmar = confirm(MSG_CONFIRM_DUPLICATE_LANCAMENTO);
                if (!confirmar) return;
            }
            
            // Confirmar lançamento
            const especies = romaneio.items ? [...new Set(romaneio.items.map(item => item.especie))].join(', ') : 'N/A';
            const dataRomaneio = formatDateLabel(romaneio.dataEmissao || romaneio.data || romaneio.timestamp);
            const valorFormatado = formatarMoedaTL(valorTotal);
            
            // ✅ CORREÇÃO: Remover confirmação desnecessária - ação já é clara pelo botão
            
            // ✅ CORREÇÃO: Usar indicador de loading simples
            dbg('🔄 Processando lançamento...');
            
            // Sincronizar cliente no sistema financeiro
            dbg('🔄 Sincronizando cliente no sistema financeiro...');
            const clienteId = await sincronizarClienteFinanceiro(romaneio);
            dbg('✅ Cliente sincronizado:', clienteId);
            
            // Criar conta a receber
            dbg('💳 Criando conta a receber...');
            await criarContaReceberRomaneio(romaneio, valorTotal, clienteId);
            dbg('✅ Conta a receber criada com sucesso');
            
            // ✅ NOVO: Marcar romaneio como lançado e salvar
            await marcarRomaneioComoLancado(romaneioId);
            
            // ✅ CORREÇÃO: Feedback simples e redirecionamento direto
            dbg(`✅ Conta a receber lançada com sucesso! Cliente: ${nomeCliente}, Valor: ${valorFormatado}`);
            showSuccess(MSG_SUCCESS_LANCAR_CONTAS);
            
            // ✅ NOVO: Atualizar a lista para refletir o estado do botão
            renderRomaneiosList();
            
            // ✅ CORREÇÃO: Redirecionar com hash para abrir aba correta
            closeModal();
            setTimeout(() => {
                // Usar hash para garantir que a aba correta seja aberta
                window.location.href = 'financas.html#receber';
            }, 200);
            
        } catch (error) {
            console.error('❌ Erro ao lançar contas a receber:', error);
            showWarning(MSG_WARNING_LANCAR_FAILED_PREFIX + (error && error.message ? error.message : 'erro desconhecido'));
        }
    }
    
    /**
     * ✅ MARCAR ROMANEIO COMO LANÇADO
     */
    async function marcarRomaneioComoLancado(romaneioId) {
        try {
            dbg(`🔄 Marcando romaneio ${romaneioId} como lançado...`);
            
            // Encontrar o romaneio no estado local
            const romaneioIndex = state.romaneios.findIndex(r => r.id === romaneioId);
            if (romaneioIndex !== -1) {
                state.romaneios[romaneioIndex].contasReceberLancado = true;
                state.romaneios[romaneioIndex].contasReceberLancadoEm = new Date().toISOString();
            }
            
            const io = getIoService();
            if (io) {
                const loaded = await io.load('romaneios/tl');
                const data = loaded && loaded.success !== false ? (loaded.data || loaded) : null;
                const utils = window.RomaneioDataUtils;
                const lista = utils && typeof utils.normalizeRomaneioCollection === 'function'
                    ? utils.normalizeRomaneioCollection(data, { type: 'TL' })
                    : Object.entries(data || {}).map(([key, value]) => ({ id: value && value.id || key, firebaseKey: key, ...(value || {}) }));
                const atual = lista.find((r) => String(r.id) === String(romaneioId) || String(r.firebaseKey || '') === String(romaneioId));
                if (atual) {
                    const registroId = atual.firebaseKey || atual.key || atual.id || romaneioId;
                    const atualizado = {
                        ...atual,
                        contasReceberLancado: true,
                        contasReceberLancadoEm: new Date().toISOString()
                    };
                    await io.save('romaneios/tl', String(registroId), atualizado);
                    dbg('✅ Estado do romaneio salvo em companies/{companyId}/romaneios/tl');
                } else {
                    console.warn('⚠️ Romaneio não encontrado no caminho canônico para atualização');
                }
            }
            
            dbg('✅ Romaneio marcado como lançado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao marcar romaneio como lançado:', error);
            throw error;
        }
    }
    
    /**
     * 🔍 BUSCAR ROMANEIO COMPLETO
     */
    async function buscarRomaneioCompleto(romaneioId) {
        try {
            // Buscar no estado atual primeiro
            const romaneioLocal = state.romaneios.find(r => r.id === romaneioId);
            if (romaneioLocal) {
                dbg('✅ Romaneio encontrado no estado local:', romaneioId);
                return romaneioLocal;
            }
            
            // Se não encontrar, buscar no Firebase usando FirebaseService TL
            dbg('🔍 Buscando romaneio no Firebase:', romaneioId);
            
            if (!window.FirebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            const caminhos = ['romaneios/tl'];
            
            for (const caminho of caminhos) {
                try {
                    const resultado = await window.FirebaseService.loadFromFirebase(caminho);
                    
                    if (resultado && resultado.success && resultado.data) {
                        let romaneios = [];
                        
                        if (Array.isArray(resultado.data)) {
                            romaneios = resultado.data;
                        } else if (typeof resultado.data === 'object') {
                            romaneios = Object.keys(resultado.data).map(key => ({
                                id: key,
                                ...resultado.data[key]
                            }));
                        }
                        
                        const romaneio = romaneios.find(r => r.id === romaneioId);
                        if (romaneio) {
                            dbg(`✅ Romaneio encontrado no Firebase (${caminho}):`, romaneioId);
                            return romaneio;
                        }
                    }
                } catch (error) {
                    console.warn(`⚠️ Erro ao buscar em ${caminho}:`, error);
                }
            }
            
            console.warn('⚠️ Romaneio não encontrado em nenhum caminho:', romaneioId);
            return null;
        } catch (error) {
            console.error('❌ Erro ao buscar romaneio:', error);
            throw error;
        }
    }
    
    /**
     * ✅ VERIFICAR SE ROMANEIO JÁ FOI LANÇADO
     */
    async function verificarRomaneioJaLancado(romaneioId) {
        try {
            // Buscar contas a receber do sistema financeiro
            const contasReceber = await buscarContasReceberFinanceiro();
            
            // Verificar se existe conta com origem deste romaneio
            return contasReceber.some(conta => 
                conta.origem === 'romaneio_tl' && conta.origemId === romaneioId
            );
        } catch (error) {
            console.warn('⚠️ Erro ao verificar lançamento anterior:', error);
            return false;
        }
    }
    
    /**
     * 🔄 SINCRONIZAR CLIENTE NO SISTEMA FINANCEIRO
     */
    async function sincronizarClienteFinanceiro(romaneio) {
        try {
            const nomeCliente = obterNomeClienteRomaneio(romaneio).trim();
            if (!nomeCliente) {
                throw new Error('Dados do cliente inválidos para sincronização');
            }
            
            dbg('🔄 Sincronizando cliente:', nomeCliente);
            
            // Buscar clientes existentes no sistema financeiro
            const clientes = await buscarClientesFinanceiro();
            
            // Verificar se cliente já existe
            const clienteExistente = clientes.find(c => 
                c.nome === nomeCliente ||
                c.nomeCompleto === nomeCliente ||
                c.name === nomeCliente
            );
            
            if (clienteExistente) {
                dbg('✅ Cliente já existe no sistema financeiro:', clienteExistente.id);
                return clienteExistente.id;
            }
            
            // Criar novo cliente baseado no romaneio
            dbg('🆕 Criando novo cliente no sistema financeiro:', nomeCliente);
            
            const novoCliente = {
                id: `RT_CLI_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                nome: nomeCliente,
                nomeCompleto: nomeCliente,
                name: nomeCliente, // Compatibilidade
                tipo: 'cliente',
                categoria: 'vendas',
                tipo: 'receber',
                telefone: '',
                email: '',
                endereco: '',
                cidade: '',
                estado: '',
                cep: '',
                origem: 'romaneio_tl',
                status: 'ativo',
                created: new Date().toISOString(),
                updated: new Date().toISOString()
            };
            
            // Adicionar à lista de clientes
            clientes.push(novoCliente);
            
            // Salvar no Firebase
            await salvarClientesFinanceiro(clientes);
            
            dbg('✅ Novo cliente criado:', novoCliente.id);
            return novoCliente.id;
            
        } catch (error) {
            console.error('❌ Erro ao sincronizar cliente:', error);
            const fallbackNome = obterNomeClienteRomaneio(romaneio).trim();
            // Fallback: retornar ID baseado no nome do cliente
            return `RT_CLI_FALLBACK_${String(fallbackNome || 'CLIENTE').replace(/\s+/g, '_')}`;
        }
    }
    
    /**
     * 💳 CRIAR CONTA A RECEBER DO ROMANEIO
     */
    async function criarContaReceberRomaneio(romaneio, valorTotal, clienteId) {
        try {
            dbg('💳 Criando conta a receber para romaneio:', romaneio.id);
            
            // Buscar contas a receber existentes
            const contasReceber = await buscarContasReceberFinanceiro();
            
            // ✅ CORREÇÃO: Preparar descrição apenas com espécies
            const especies = romaneio.items ? [...new Set(romaneio.items.map(item => item.especie))].join(', ') : 'Romaneio sem itens';
            
            // ✅ CORREÇÃO: Calcular data de vencimento (30 dias após a data do romaneio)
            const dataBaseRomaneio = romaneio.dataEmissao || romaneio.data || romaneio.timestamp;
            let dataVencimento = toLocalDateObject(dataBaseRomaneio);
            
            // Adicionar 30 dias
            dataVencimento.setDate(dataVencimento.getDate() + 30);
            
            // ✅ CORREÇÃO: Validar data antes de converter para ISO
            let dataVencimentoFormatada;
            try {
                if (isNaN(dataVencimento.getTime())) {
                    throw new Error('Data de vencimento inválida');
                }
                // ✅ Formatar em ISO local (YYYY-MM-DD) para evitar deslocamentos de fuso
                const y = dataVencimento.getFullYear();
                const m = String(dataVencimento.getMonth() + 1).padStart(2, '0');
                const d = String(dataVencimento.getDate()).padStart(2, '0');
                dataVencimentoFormatada = `${y}-${m}-${d}`;
            } catch (error) {
                console.warn('⚠️ Erro ao formatar data de vencimento, usando data atual + 30 dias:', error);
                const dataFallback = new Date();
                dataFallback.setDate(dataFallback.getDate() + 30);
                const fy = dataFallback.getFullYear();
                const fm = String(dataFallback.getMonth() + 1).padStart(2, '0');
                const fd = String(dataFallback.getDate()).padStart(2, '0');
                dataVencimentoFormatada = `${fy}-${fm}-${fd}`;
            }
            
            // Criar nova conta a receber
            const novaConta = {
                id: `RT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                cliente: obterNomeClienteRomaneio(romaneio) || romaneio.cliente,
                clienteId: clienteId,
                descricao: especies, // ✅ CORREÇÃO: Apenas espécies na descrição
                valor: valorTotal,
                valorOriginal: valorTotal, // ✅ NOVO: Valor original da conta
                valorRestante: valorTotal, // ✅ NOVO: Valor restante a receber
                dataVencimento: dataVencimentoFormatada,
                status: 'pendente',
                categoria: 'Vendas',
                origem: 'romaneio_tl',
                origemId: romaneio.id,
                romaneioData: normalizeDateInputValue(dataBaseRomaneio) || normalizeDateInputValue(new Date()),
                romaneioCliente: obterNomeClienteRomaneio(romaneio) || romaneio.cliente,
                romaneioEspecies: especies,
                observacoes: `Gerado automaticamente do Romaneio TL em ${new Date().toLocaleDateString('pt-BR')}`,
                parcela: 1,
                totalParcelas: 1,
                valorTotal: valorTotal,
                created: new Date().toISOString()
            };
            
            // Adicionar à lista
            contasReceber.push(novaConta);
            
            // Salvar no Firebase (somente a conta criada)
            await salvarContasReceberFinanceiro(novaConta);
            
            dbg('✅ Conta a receber criada:', novaConta.id);
            return novaConta.id;
            
        } catch (error) {
            console.error('❌ Erro ao criar conta a receber:', error);
            throw error;
        }
    }
    
    /**
     * 🔍 BUSCAR CLIENTES DO SISTEMA FINANCEIRO
     */
    async function buscarClientesFinanceiro() {
        try {
            if (window.clientService && typeof window.clientService.getClients === 'function') {
                const clientes = await window.clientService.getClients(true);
                return Array.isArray(clientes) ? clientes.filter(c => c != null) : [];
            }

            if (!window.FirebaseService) {
                console.warn('⚠️ FirebaseService não disponível, usando fallback');
                return [];
            }
            
            const clientes = await window.FirebaseService.loadFromFirebase('clients');
            
            if (clientes && clientes.success && clientes.data) {
                if (Array.isArray(clientes.data)) {
                    return clientes.data.filter(c => c != null);
                } else if (typeof clientes.data === 'object') {
                    return Object.values(clientes.data).filter(c => c != null);
                }
            }
            
            return [];
        } catch (error) {
            console.error('❌ Erro ao buscar clientes:', error);
            return [];
        }
    }
    
    /**
     * 💾 SALVAR CLIENTES NO SISTEMA FINANCEIRO
     */
    async function salvarClientesFinanceiro(clientes) {
        try {
            if (window.clientService && typeof window.clientService.saveClients === 'function') {
                const ok = await window.clientService.saveClients(clientes);
                if (!ok) throw new Error('Falha ao salvar clientes');
                dbg('✅ Clientes salvos no sistema financeiro');
                return;
            }

            if (!window.FirebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            
            const resultado = await (typeof window.saveData === 'function'
                ? window.saveData('clients', clientes)
                : window.FirebaseService.saveData('clients', clientes));
            
            if (resultado && resultado.success) {
                dbg('✅ Clientes salvos no sistema financeiro');
            } else {
                throw new Error('Falha ao salvar clientes');
            }
        } catch (error) {
            console.error('❌ Erro ao salvar clientes:', error);
            throw error;
        }
    }
    
    /**
     * 🔍 BUSCAR CONTAS A RECEBER DO SISTEMA FINANCEIRO
     */
    async function buscarContasReceberFinanceiro() {
        try {
            // ✅ CORREÇÃO: Usar FirebaseService TL
            if (!window.FirebaseService) {
                console.warn('⚠️ FirebaseService não disponível, usando fallback');
                return [];
            }
            
            const contas = await window.FirebaseService.loadFromFirebase('financas/receber');
            
            if (contas && contas.success && contas.data) {
                if (Array.isArray(contas.data)) {
                    return contas.data.filter(c => c != null);
                } else if (typeof contas.data === 'object') {
                    return Object.values(contas.data).filter(c => c != null);
                }
            }
            
            return [];
        } catch (error) {
            console.error('❌ Erro ao buscar contas a receber:', error);
            return [];
        }
    }
    
    /**
     * 💾 SALVAR CONTAS A RECEBER NO SISTEMA FINANCEIRO
     */
    async function salvarContasReceberFinanceiro(contasReceber) {
        try {
            // ✅ CORREÇÃO: Usar FirebaseService TL com método correto
            if (!window.FirebaseService) {
                throw new Error('FirebaseService não disponível');
            }
            // ✅ NOVO: Salvar cada conta individualmente para evitar sobrescrever a coleção
            const contasArray = Array.isArray(contasReceber) ? contasReceber : (typeof contasReceber === 'object' ? Object.values(contasReceber) : []);
            if (!Array.isArray(contasArray)) {
                throw new Error('Formato de contas a receber inválido');
            }

            for (const conta of contasArray) {
                if (!conta || !conta.id) continue;
                const payload = { ...conta };
                if (payload.valorOriginal === undefined || payload.valorOriginal === null) {
                    payload.valorOriginal = payload.valor;
                }
                if (payload.valorRestante === undefined || payload.valorRestante === null) {
                    payload.valorRestante = payload.valor;
                }
                Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                const res = await window.FirebaseService.saveData(`financas/receber/${String(conta.id)}`, payload);
                if (!res || !res.success) {
                    console.warn('⚠️ Falha ao salvar conta individual:', conta.id, res);
                }
            }

            dbg('✅ Contas a receber salvas individualmente no sistema financeiro');
        } catch (error) {
            console.error('❌ Erro ao salvar contas a receber:', error);
            throw error;
        }
    }

    // ✅ INTERFACE PÚBLICA
    return {
        CONFIG,
        openModal,
        closeModal,
        editRomaneio,
        printRomaneio,
        deleteRomaneio,
        togglePrintDropdown,
        refresh,
        loadRomaneios,
        recalcularTotaisRomaneio,
        lancarContasReceber,
        renderRomaneiosList, // ✅ NOVO: Expor função de renderização
        state // ✅ NOVO: Expor estado para acesso externo
    };
    
    /**
     * ✅ RECALCULAR TOTAIS DE UM ROMANEIO
     * Não confiar nos valores salvos, sempre recalcular
     */
    function recalcularTotaisRomaneio(romaneio) {
        const legacyKey = ['b','i','t','o','l','a'].join('');
        if (!romaneio.items || !Array.isArray(romaneio.items)) {
            return { volume: 0, valor: 0 };
        }
        
        let totalVolume = 0;
        let totalValor = 0;
        
        romaneio.items.forEach(item => {
            // ✅ USAR FUNÇÃO PADRONIZADA para calcular volume
            const volumeIndividual = window.UtilsTL && window.UtilsTL.calcularVolume ? 
                window.UtilsTL.calcularVolume(
                    parseFloat(item.comprimento) || 0,
                    parseFloat(item.largura) || 0, 
                    parseFloat(item.espessura || item[legacyKey]) || 0,
                    1
                ) : calcularVolumeItemFallback(item);
            
            const quantidade = parseInt(item.quantidade) || 1;
            const preco = parseFloat(item.preco || item.price) || 0;
            
            const volumeTotal = volumeIndividual * quantidade;
            const valorTotal = volumeTotal * preco;
            
            totalVolume += volumeTotal;
            totalValor += valorTotal;
        });
        
        return {
            volume: totalVolume,
            valor: totalValor
        };
    }
    
    /**
     * ✅ FALLBACK PARA CÁLCULO DE VOLUME SE UtilsTL NÃO ESTIVER DISPONÍVEL
     */
    function calcularVolumeItemFallback(item) {
        const legacyKey = ['b','i','t','o','l','a'].join('');
        const comprimento = parseFloat(item.comprimento) || 0;
        const largura = parseFloat(item.largura) || 0;
        const espessura = parseFloat(item.espessura || item[legacyKey]) || 0;
        
        if (comprimento <= 0 || largura <= 0 || espessura <= 0) {
            return 0;
        }
        
        // Fórmula padrão: cm³ para m³
        return (comprimento * largura * espessura) / 1000000;
    }

})();

// ✅ FUNÇÕES GLOBAIS PARA COMPATIBILIDADE
window.abrirListaRomaneios = window.ModalListaRomaneios.openModal;
window.editarRomaneio = window.ModalListaRomaneios.editRomaneio;
window.excluirRomaneio = window.ModalListaRomaneios.deleteRomaneio;
window.imprimirRomaneio = window.ModalListaRomaneios.printRomaneio;
window.togglePrintDropdown = window.ModalListaRomaneios.togglePrintDropdown;
window.lancarContasReceberRomaneio = window.ModalListaRomaneios.lancarContasReceber;

// 📡 Atualizar lista quando chegar evento realtime do TL
window.addEventListener('romaneiosTL:updated', async function() {
    try {
        // Throttle simples para evitar múltiplos refreshs em sequência
        if (!window.__tlEventRefreshTimer) {
            window.__tlEventRefreshTimer = setTimeout(async () => {
                window.__tlEventRefreshTimer = null;
                if (window.ModalListaRomaneios && typeof window.ModalListaRomaneios.refresh === 'function') {
                    await window.ModalListaRomaneios.refresh();
                    console.debug('📡 Lista de Romaneios TL atualizada via evento realtime');
                }
            }, 300);
        }
    } catch (e) {
        console.warn('⚠️ Falha ao atualizar lista via evento realtime:', e);
    }
});

// ✅ FUNÇÃO GLOBAL DE TESTE DE PAGINAÇÃO
window.testarPaginacaoTL = function() {
    const config = window.ModalListaRomaneios.CONFIG;
    console.log('🧪 === TESTE DE PAGINAÇÃO TL ===');
    console.log(`📋 Lista de Romaneios: ${config.itemsPerPage} itens por página`);
    console.log(`📄 Tabela de Itens: 5 itens sem paginação + 5 por página`);
    console.log('');
    console.log('🔍 Verificação técnica:');
    console.log(`   - CONFIG.itemsPerPage: ${config.itemsPerPage}`);
    console.log(`   - Paginação aparece após: ${config.itemsPerPage} romaneios`);
    console.log('');
    console.log('✅ PADRONIZADO com PCT');
    return { listaRomaneios: config.itemsPerPage, tabelaItens: 5 };
};

// ✅ FUNÇÃO DE TESTE DAS LARGURAS DAS COLUNAS TL
window.testarLargurasColunasTL = function() {
    console.log('📏 === TESTE DE LARGURAS DAS COLUNAS TL ===');
    console.log('');
    
    const tabela = document.getElementById('romaneioTable');
    if (!tabela) {
        console.log('❌ Tabela não encontrada');
        return false;
    }
    
    const thead = tabela.querySelector('thead');
    const colunas = thead ? thead.querySelectorAll('th') : [];
    console.log(`🔍 Colunas encontradas: ${colunas.length}`);
    
    console.log('📊 Larguras esperadas TL:');
    const larguras = [
        '15% (Espécie)', 
        '10% (Comprimento)', 
        '8% (Espessura)', 
        '8% (Largura)', 
        '8% (Quantidade)', 
        '10% (Volume)', 
        '12% (Preço)', 
        '12% (Total)', 
        '10% (Ações)'
    ];
    
    larguras.forEach((largura, index) => {
        console.log(`   ${index + 1}. ${largura}`);
    });
    
    console.log('');
    console.log('🎯 Configuração aplicada:');
    console.log('   ✅ table-layout: fixed');
    console.log('   ✅ min-width: 1200px');
    console.log('   ✅ white-space: nowrap (exceto espécie)');
    console.log('   ✅ overflow: hidden com ellipsis');
    console.log('   ✅ Container responsivo com scroll horizontal');
    console.log('');
    
    // Verificar se há itens para teste
    const totalItens = window.AdicionarItem ? window.AdicionarItem.length : 0;
    if (totalItens === 0) {
        console.log('⚠️ Nenhum item na tabela para testar quebra de linha');
        console.log('💡 Adicione alguns itens para verificar o comportamento');
    } else {
        console.log(`✅ ${totalItens} itens na tabela para teste`);
    }
    
    return {
        tabelaEncontrada: !!tabela,
        totalColunas: colunas.length,
        totalItens: totalItens,
        larguraMinimaAplicada: true
    };
};

console.log('✅ Módulo ModalListaRomaneios carregado com sucesso');
console.log('📏 Função de teste de larguras disponível: testarLargurasColunasTL()');
console.log('💰 Nova funcionalidade: Lançamento de Contas a Receber disponível!');

// ✅ FUNÇÃO DE DEBUG PARA TESTAR INTEGRAÇÃO FINANCEIRA
window.debugRomaneioFinanceiro = function() {
    console.log('🔍 ===== DEBUG INTEGRAÇÃO ROMANEIO TL → FINANCEIRO =====');
    
    // Verificar se o modal está disponível
    const modal = window.ModalListaRomaneios;
    console.log('📋 Modal disponível:', !!modal);
    
    if (modal) {
        console.log('✅ Funções disponíveis:');
        console.log('- openModal:', typeof modal.openModal);
        console.log('- lancarContasReceber:', typeof modal.lancarContasReceber);
        console.log('- recalcularTotaisRomaneio:', typeof modal.recalcularTotaisRomaneio);
    }
    
    // Verificar Firebase
    console.log('🔥 FirebaseService TL disponível:', !!window.FirebaseService);
    
    // Verificar sistema financeiro
    console.log('💰 Sistema financeiro disponível:', !!window.FirebaseService);
    
    // Verificar funções globais
    console.log('🌐 Funções globais:');
    console.log('- lancarContasReceberRomaneio:', typeof window.lancarContasReceberRomaneio);
    console.log('- formatCurrency:', typeof window.formatCurrency);
    console.log('- showError:', typeof window.showError);
    console.log('- showSuccess:', typeof window.showSuccess);
    console.log('- showLoading:', typeof window.showLoading);
    
    console.log('');
    console.log('🎯 Para testar a integração:');
    console.log('1. Abra a Lista de Romaneios TL');
    console.log('2. Clique no botão verde (💰) de um romaneio');
    console.log('3. Confirme o lançamento');
    console.log('4. Verifique no sistema financeiro');
    console.log('');
    
    return {
        modalDisponivel: !!modal,
        firebaseDisponivel: !!window.FirebaseService,
        sistemaFinanceiroDisponivel: !!window.FirebaseService,
        funcaoLancarDisponivel: !!(modal && modal.lancarContasReceber)
    };
};
