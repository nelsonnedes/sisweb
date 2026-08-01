/**
 * Configuracao de colunas de impressao para modais de Lista de Romaneios.
 *
 * Persistencia: companies/{companyId}/configuracoes/romaneioPrintColumns/{tipo}
 * via firebaseService.saveToFirebase/loadFromFirebase. O localStorage e apenas
 * cache tenantizado para leitura rapida e contingencia offline.
 */
(function () {
    'use strict';

    if (window.RomaneioPrintConfig) return;

    const CONFIG_PATH = 'configuracoes/romaneioPrintColumns';
    const CACHE_PREFIX = 'sisweb:romaneioPrintColumns';
    const MODULES = {
        TL: {
            key: 'tl',
            label: 'Romaneio TL',
            columns: [
                { id: 'qtd', label: 'Qtd.', selectors: ['.tl-main-table .col-qtd'] },
                { id: 'pes', label: 'Pés', selectors: ['.tl-main-table .col-pes'] },
                { id: 'm3', label: 'M³', selectors: ['.tl-main-table .col-vm3'] },
                { id: 'm2', label: 'M²', selectors: ['.tl-main-table .col-vm2'] },
                { id: 'ml', label: 'ml', selectors: ['.tl-main-table .col-ml'] },
                { id: 'precoUnitario', label: 'Preço/M³', selectors: ['.tl-main-table .col-unit'] },
                { id: 'valor', label: 'Valor', selectors: ['.tl-main-table .col-total'] }
            ]
        },
        PCT: {
            key: 'pct',
            label: 'Romaneio PCT',
            columns: [
                { id: 'qtd', label: 'Qtd.', selectors: ['#pct-main-table .col-qtd', '#pct-cont-table .col-qtd'] },
                { id: 'pes', label: 'Pés', selectors: ['#pct-main-table .col-pes', '#pct-cont-table .col-pes'] },
                { id: 'm3', label: 'M³', selectors: ['#pct-main-table .col-vm3', '#pct-cont-table .col-vm3'] },
                { id: 'm2', label: 'M²', selectors: ['#pct-main-table .col-vm2', '#pct-cont-table .col-vm2'] },
                { id: 'ml', label: 'ml', selectors: ['#pct-main-table .col-ml', '#pct-cont-table .col-ml'] },
                { id: 'precoUnitario', label: 'Preço/M³', selectors: ['#pct-main-table .col-unit', '#pct-cont-table .col-unit'] },
                { id: 'valor', label: 'Valor', selectors: ['#pct-main-table .col-total', '#pct-cont-table .col-total'] }
            ]
        },
        PES: {
            key: 'pes',
            label: 'Romaneio PES',
            columns: [
                { id: 'qtd', label: 'Qtd.', selectors: ['.items-table .col-quantidade'] },
                { id: 'pes', label: 'Pés', selectors: ['.items-table .col-pes'] },
                { id: 'm3', label: 'M³', selectors: ['.items-table .col-m3'] },
                { id: 'm2', label: 'M²', selectors: ['.items-table .col-m2'] },
                { id: 'ml', label: 'ml', selectors: ['.items-table .col-ml'] },
                { id: 'precoUnitario', label: 'Preço/M³', selectors: ['.items-table .col-unit-price'] },
                { id: 'valor', label: 'Valor', selectors: ['.items-table .col-total-price'] }
            ]
        },
        TORA: {
            key: 'tora',
            label: 'Romaneio Tora',
            columns: [
                { id: 'rodo', label: 'Rodo', selectors: ['.tora-main-table .col-rodo-tora'] },
                { id: 'comprimento', label: 'Comp.', selectors: ['.tora-main-table .col-comprimento-tora'] },
                { id: 'oco1', label: 'Oco 1', selectors: ['.tora-main-table .col-oco1-tora'] },
                { id: 'oco2', label: 'Oco 2', selectors: ['.tora-main-table .col-oco2-tora'] },
                { id: 'm3Bruto', label: 'M³ Bruto', selectors: ['.tora-main-table .col-vb-tora'] },
                { id: 'm3Desc', label: 'M³ Desc.', selectors: ['.tora-main-table .col-vd-tora'] },
                { id: 'm3Liquido', label: 'M³ Líq.', selectors: ['.tora-main-table .col-vl-tora'] },
                { id: 'compGeo', label: 'Comp. Geo.', selectors: ['.tora-main-table .col-compgeo-tora'] },
                { id: 'x1', label: 'X1', selectors: ['.tora-main-table .col-x1-tora'] },
                { id: 'x2', label: 'X2', selectors: ['.tora-main-table .col-x2-tora'] },
                { id: 'x3', label: 'X3', selectors: ['.tora-main-table .col-x3-tora'] },
                { id: 'x4', label: 'X4', selectors: ['.tora-main-table .col-x4-tora'] },
                { id: 'vGeo', label: 'V. Geo.', selectors: ['.tora-main-table .col-vgeo-tora'] },
                { id: 'difPercent', label: 'Dif. %', selectors: ['.tora-main-table .col-difperc-tora'], defaultWhenMissing: true },
                { id: 'precoUnitario', label: 'Preço', selectors: ['.tora-main-table .col-unit-tora'] },
                { id: 'valor', label: 'Valor', selectors: ['.tora-main-table .col-total-tora'] }
            ]
        }
    };

    const state = {
        configs: {},
        schemaVersions: {},
        loaded: {},
        loading: {}
    };

    function normalizeModule(moduleKey) {
        const key = String(moduleKey || '').trim().toUpperCase();
        if (MODULES[key]) return key;
        const fromValue = Object.keys(MODULES).find((candidate) => MODULES[candidate].key === String(moduleKey || '').toLowerCase());
        return fromValue || 'TL';
    }

    function getAllIds(moduleKey) {
        const def = MODULES[normalizeModule(moduleKey)];
        return def.columns.map((column) => column.id);
    }

    function normalizeSelection(moduleKey, rawColumns, rawConfig = null) {
        const normalized = normalizeModule(moduleKey);
        const def = MODULES[normalized];
        const all = getAllIds(normalized);
        const allowed = new Set(all);
        const selected = Array.isArray(rawColumns) ? rawColumns.map(String).filter((id) => allowed.has(id)) : all;
        const schemaVersion = rawConfig && Number(rawConfig.schemaVersion || 0);
        if (Array.isArray(rawColumns) && schemaVersion < 2) {
            def.columns.forEach((column) => {
                if (column.defaultWhenMissing && !selected.includes(column.id)) selected.push(column.id);
            });
        }
        return selected.length ? Array.from(new Set(selected)) : all;
    }

    function isLikelyCompanyId(value) {
        if (value === null || value === undefined) return false;
        const id = String(value).trim();
        return id.length >= 3 && !/\s/.test(id);
    }

    function resolveCompanyId() {
        try {
            const svc = window.firebaseService || window.FirebaseService || window.firebaseServiceTL;
            if (svc && typeof svc.getCurrentTenantId === 'function') {
                const id = svc.getCurrentTenantId();
                if (isLikelyCompanyId(id)) return String(id);
            }
            if (svc && typeof svc.getTenantId === 'function') {
                const id = svc.getTenantId();
                if (isLikelyCompanyId(id)) return String(id);
            }
        } catch (_) {}
        try {
            if (isLikelyCompanyId(window.appTenantId)) return String(window.appTenantId);
            const candidates = [window.companyInfo, window.currentUser];
            for (const item of candidates) {
                if (!item || typeof item !== 'object') continue;
                const id = item.companyId || item.companyID || item.tenantId || item.id;
                if (isLikelyCompanyId(id)) return String(id);
            }
            const stored = localStorage.getItem('company_info') || localStorage.getItem('companyInfo');
            if (stored) {
                const obj = JSON.parse(stored);
                const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                if (isLikelyCompanyId(id)) return String(id);
            }
        } catch (_) {}
        return null;
    }

    function cacheKey(moduleKey) {
        const companyId = resolveCompanyId();
        if (!companyId) return null;
        return `${CACHE_PREFIX}:${companyId}:${MODULES[normalizeModule(moduleKey)].key}`;
    }

    function readCache(moduleKey) {
        const key = cacheKey(moduleKey);
        if (!key) return null;
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && Array.isArray(parsed.columns) ? parsed : null;
        } catch (_) {
            return null;
        }
    }

    function writeCache(moduleKey, payload) {
        const key = cacheKey(moduleKey);
        if (!key || !payload) return;
        try {
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (_) {}
    }

    function getFirebaseService() {
        return window.firebaseService || window.FirebaseService || window.firebaseServiceTL || null;
    }

    async function loadConfig(moduleKey) {
        const normalized = normalizeModule(moduleKey);
        const def = MODULES[normalized];
        const cached = readCache(normalized);
        if (cached) {
            state.configs[normalized] = normalizeSelection(normalized, cached.columns, cached);
            state.schemaVersions[normalized] = Number(cached.schemaVersion || 0);
        }

        const companyId = resolveCompanyId();
        const svc = getFirebaseService();
        if (!companyId || !svc || typeof svc.loadFromFirebase !== 'function' || (svc.isOperational && !svc.isOperational().operational)) {
            state.loaded[normalized] = true;
            state.configs[normalized] = state.configs[normalized] || getAllIds(normalized);
            return state.configs[normalized];
        }

        try {
            const result = await svc.loadFromFirebase(`${CONFIG_PATH}/${def.key}`);
            const data = result && result.success !== false ? result.data : null;
            if (data && Array.isArray(data.columns)) {
                const columns = normalizeSelection(normalized, data.columns, data);
                state.configs[normalized] = columns;
                state.schemaVersions[normalized] = Number(data.schemaVersion || 0);
                writeCache(normalized, {
                    module: normalized,
                    companyId,
                    columns,
                    schemaVersion: 2,
                    updatedAt: data.updatedAt || new Date().toISOString()
                });
            } else if (!state.configs[normalized]) {
                state.configs[normalized] = getAllIds(normalized);
            }
        } catch (error) {
            console.warn('[RomaneioPrintConfig] Falha ao carregar configuracao de impressao:', error);
            state.configs[normalized] = state.configs[normalized] || getAllIds(normalized);
        } finally {
            state.loaded[normalized] = true;
        }
        return state.configs[normalized];
    }

    async function ensureLoaded(moduleKey) {
        const normalized = normalizeModule(moduleKey);
        if (state.loaded[normalized]) return state.configs[normalized] || getAllIds(normalized);
        if (!state.loading[normalized]) {
            state.loading[normalized] = loadConfig(normalized).finally(() => {
                delete state.loading[normalized];
            });
        }
        return state.loading[normalized];
    }

    async function saveConfig(moduleKey, columns) {
        const normalized = normalizeModule(moduleKey);
        const def = MODULES[normalized];
        const companyId = resolveCompanyId();
        const selected = normalizeSelection(normalized, columns, { schemaVersion: 2 });
        const payload = {
            module: normalized,
            companyId: companyId || '',
            columns: selected,
            schemaVersion: 2,
            updatedAt: new Date().toISOString()
        };

        state.configs[normalized] = selected;
        state.schemaVersions[normalized] = 2;
        state.loaded[normalized] = true;
        writeCache(normalized, payload);

        const svc = getFirebaseService();
        if (!companyId) {
            throw new Error('Empresa ativa nao identificada. Nao foi possivel salvar a configuracao.');
        }
        if (!svc || typeof svc.saveToFirebase !== 'function') {
            throw new Error('FirebaseService indisponivel para salvar a configuracao.');
        }

        const result = await svc.saveToFirebase(CONFIG_PATH, def.key, payload);
        if (!result || result.success === false) {
            throw new Error((result && result.error) || 'Falha ao salvar configuracao.');
        }
        return payload;
    }

    function getSelectedColumnsSync(moduleKey) {
        const normalized = normalizeModule(moduleKey);
        if (state.configs[normalized]) {
            return normalizeSelection(normalized, state.configs[normalized], { schemaVersion: state.schemaVersions[normalized] || 0 });
        }
        const cached = readCache(normalized);
        if (cached) {
            state.configs[normalized] = normalizeSelection(normalized, cached.columns, cached);
            state.schemaVersions[normalized] = Number(cached.schemaVersion || 0);
            return state.configs[normalized];
        }
        return getAllIds(normalized);
    }

    function injectStyles() {
        if (document.getElementById('romaneio-print-config-styles')) return;
        const style = document.createElement('style');
        style.id = 'romaneio-print-config-styles';
        style.textContent = `
            .romaneio-print-config-trigger {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                min-height: 40px;
                padding: 0 14px;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                background: #f8fafc;
                color: #24384d;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
            }
            .romaneio-print-config-trigger:hover {
                background: #eef2f7;
                border-color: #94a3b8;
            }
            .romaneio-print-config-modal {
                position: fixed;
                inset: 0;
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 10000080;
                padding: 18px;
                background: rgba(15, 23, 42, 0.52);
            }
            .romaneio-print-config-modal.is-open { display: flex; }
            .romaneio-print-config-dialog {
                width: min(720px, 96vw);
                max-height: min(86vh, 760px);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                border-radius: 8px;
                background: #fff;
                box-shadow: 0 22px 60px rgba(15, 23, 42, 0.34);
            }
            .romaneio-print-config-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 16px 20px;
                background: #2c3e50;
                color: #fff;
            }
            .romaneio-print-config-title {
                margin: 0;
                font-size: 18px;
                font-weight: 800;
            }
            .romaneio-print-config-close {
                border: 0;
                background: transparent;
                color: #fff;
                font-size: 24px;
                line-height: 1;
                cursor: pointer;
            }
            .romaneio-print-config-body {
                padding: 18px 20px;
                overflow: auto;
            }
            .romaneio-print-config-note {
                margin: 0 0 14px;
                color: #475569;
                font-size: 13px;
                line-height: 1.35;
            }
            .romaneio-print-config-toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-bottom: 14px;
            }
            .romaneio-print-config-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                gap: 10px;
            }
            .romaneio-print-config-option {
                display: grid;
                grid-template-columns: 18px 1fr;
                align-items: center;
                gap: 10px;
                min-height: 44px;
                padding: 10px 12px;
                border: 1px solid #d8e0e8;
                border-radius: 6px;
                background: #f8fafc;
                color: #1f2937;
                font-weight: 700;
                cursor: pointer;
            }
            .romaneio-print-config-option input { margin: 0; }
            .romaneio-print-config-footer {
                display: flex;
                flex-wrap: wrap;
                justify-content: flex-end;
                gap: 10px;
                padding: 14px 20px;
                border-top: 1px solid #e2e8f0;
                background: #f8fafc;
            }
            .romaneio-print-config-btn {
                min-height: 40px;
                padding: 0 16px;
                border-radius: 6px;
                border: 1px solid #cbd5e1;
                background: #fff;
                color: #24384d;
                font-weight: 700;
                cursor: pointer;
            }
            .romaneio-print-config-btn.primary {
                border-color: #16a34a;
                background: #22a85f;
                color: #fff;
            }
            .romaneio-print-config-btn.secondary {
                background: #2c3e50;
                border-color: #2c3e50;
                color: #fff;
            }
            .romaneio-print-config-status {
                flex: 1 1 220px;
                align-self: center;
                color: #475569;
                font-size: 13px;
            }
            @media (max-width: 640px) {
                .romaneio-print-config-footer { justify-content: stretch; }
                .romaneio-print-config-btn,
                .romaneio-print-config-trigger { width: 100%; }
            }
        `;
        document.head.appendChild(style);
    }

    function getModal() {
        injectStyles();
        let modal = document.getElementById('romaneioPrintConfigModal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'romaneioPrintConfigModal';
        modal.className = 'romaneio-print-config-modal';
        modal.innerHTML = `
            <div class="romaneio-print-config-dialog" role="dialog" aria-modal="true" aria-labelledby="romaneioPrintConfigTitle">
                <div class="romaneio-print-config-header">
                    <h3 id="romaneioPrintConfigTitle" class="romaneio-print-config-title">Configurar Impressão</h3>
                    <button type="button" class="romaneio-print-config-close" data-action="close" aria-label="Fechar">&times;</button>
                </div>
                <div class="romaneio-print-config-body">
                    <p class="romaneio-print-config-note">Marque as colunas que devem sair na impressão deste tipo de romaneio. A configuração é salva somente para a empresa ativa.</p>
                    <div class="romaneio-print-config-toolbar">
                        <label class="romaneio-print-config-option" style="min-width: 210px;">
                            <input type="checkbox" id="romaneioPrintSelectAll">
                            <span>Selecionar todas</span>
                        </label>
                    </div>
                    <div id="romaneioPrintConfigGrid" class="romaneio-print-config-grid"></div>
                </div>
                <div class="romaneio-print-config-footer">
                    <div id="romaneioPrintConfigStatus" class="romaneio-print-config-status"></div>
                    <button type="button" class="romaneio-print-config-btn" data-action="defaults">Restaurar padrão</button>
                    <button type="button" class="romaneio-print-config-btn secondary" data-action="close">Cancelar</button>
                    <button type="button" class="romaneio-print-config-btn primary" data-action="save">Salvar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal || event.target.closest('[data-action="close"]')) closeModal();
        });
        return modal;
    }

    function setStatus(message, isError) {
        const status = document.getElementById('romaneioPrintConfigStatus');
        if (!status) return;
        status.textContent = message || '';
        status.style.color = isError ? '#b91c1c' : '#475569';
    }

    function renderModal(moduleKey, selected) {
        const normalized = normalizeModule(moduleKey);
        const def = MODULES[normalized];
        const selectedSet = new Set(normalizeSelection(normalized, selected));
        const modal = getModal();
        modal.dataset.moduleKey = normalized;
        const title = modal.querySelector('#romaneioPrintConfigTitle');
        if (title) title.textContent = `Configurar Impressão - ${def.label}`;

        const grid = modal.querySelector('#romaneioPrintConfigGrid');
        if (grid) {
            grid.innerHTML = def.columns.map((column) => `
                <label class="romaneio-print-config-option">
                    <input type="checkbox" value="${column.id}" ${selectedSet.has(column.id) ? 'checked' : ''}>
                    <span>${column.label}</span>
                </label>
            `).join('');
        }

        const selectAll = modal.querySelector('#romaneioPrintSelectAll');
        const updateSelectAll = () => {
            const boxes = Array.from(modal.querySelectorAll('#romaneioPrintConfigGrid input[type="checkbox"]'));
            const checked = boxes.filter((box) => box.checked).length;
            if (selectAll) {
                selectAll.checked = checked === boxes.length;
                selectAll.indeterminate = checked > 0 && checked < boxes.length;
            }
        };
        updateSelectAll();
        if (selectAll) {
            selectAll.onchange = () => {
                modal.querySelectorAll('#romaneioPrintConfigGrid input[type="checkbox"]').forEach((box) => {
                    box.checked = selectAll.checked;
                });
                updateSelectAll();
            };
        }
        modal.querySelectorAll('#romaneioPrintConfigGrid input[type="checkbox"]').forEach((box) => {
            box.onchange = updateSelectAll;
        });

        modal.querySelector('[data-action="defaults"]').onclick = () => {
            renderModal(normalized, getAllIds(normalized));
            setStatus('Padrão restaurado. Clique em Salvar para gravar.', false);
        };
        modal.querySelector('[data-action="save"]').onclick = async () => {
            const checked = Array.from(modal.querySelectorAll('#romaneioPrintConfigGrid input[type="checkbox"]:checked')).map((box) => box.value);
            if (!checked.length) {
                setStatus('Selecione ao menos uma coluna para imprimir.', true);
                return;
            }
            setStatus('Salvando configuração...', false);
            try {
                await saveConfig(normalized, checked);
                setStatus('Configuração salva para a empresa ativa.', false);
                setTimeout(closeModal, 550);
            } catch (error) {
                setStatus(error && error.message ? error.message : 'Falha ao salvar configuração.', true);
            }
        };
        setStatus('', false);
    }

    async function openModal(moduleKey) {
        const normalized = normalizeModule(moduleKey);
        const modal = getModal();
        renderModal(normalized, getSelectedColumnsSync(normalized));
        modal.classList.add('is-open');
        try {
            const selected = await ensureLoaded(normalized);
            renderModal(normalized, selected);
        } catch (error) {
            setStatus(error && error.message ? error.message : 'Nao foi possivel carregar a configuracao.', true);
        }
    }

    function closeModal() {
        const modal = document.getElementById('romaneioPrintConfigModal');
        if (modal) modal.classList.remove('is-open');
    }

    function hideElements(doc, selectors) {
        selectors.forEach((selector) => {
            try {
                doc.querySelectorAll(selector).forEach((node) => {
                    node.style.display = 'none';
                    node.setAttribute('data-print-config-hidden', '1');
                });
            } catch (_) {}
        });
    }

    function countDynamicCells(doc, selector) {
        const firstRow = doc.querySelector('tbody tr');
        if (!firstRow) return 0;
        try {
            return firstRow.querySelectorAll(selector).length;
        } catch (_) {
            return 0;
        }
    }

    function getPrintMode(doc) {
        try {
            const mode = doc.body && doc.body.getAttribute('data-print-mode');
            return String(mode || 'completo').replace(/-/g, '_').toLowerCase();
        } catch (_) {
            return 'completo';
        }
    }

    function isVisibleByPrintMode(columnId, mode) {
        if (columnId === 'valor' && mode === 'sem_preco') return false;
        if (columnId === 'precoUnitario' && (mode === 'sem_preco' || mode === 'sem_preco_unitario')) return false;
        return true;
    }

    function setColSpanOrHide(node, count) {
        if (!node) return;
        if (count <= 0) {
            node.style.display = 'none';
            node.setAttribute('data-print-config-hidden', '1');
        } else {
            node.colSpan = count;
        }
    }

    function applyPCTLayout(doc, selectedSet) {
        const mode = getPrintMode(doc);
        const baseVisible = 3;
        const tailVisible = ['qtd', 'pes', 'm3', 'm2', 'ml', 'precoUnitario', 'valor'].filter((id) => selectedSet.has(id) && isVisibleByPrintMode(id, mode)).length;
        const compCount = countDynamicCells(doc, '.col-comp-dyn-pct');
        doc.querySelectorAll('.pct-base-spacer').forEach((node) => setColSpanOrHide(node, baseVisible));
        doc.querySelectorAll('.pct-tail-spacer').forEach((node) => setColSpanOrHide(node, tailVisible));
        doc.querySelectorAll('.pct-total-label').forEach((node) => setColSpanOrHide(node, baseVisible + compCount));
    }

    function applyPESLayout(doc, selectedSet) {
        const mode = getPrintMode(doc);
        const baseVisible = 3;
        const tailVisible = ['qtd', 'pes', 'm3', 'm2', 'ml', 'precoUnitario', 'valor'].filter((id) => selectedSet.has(id) && isVisibleByPrintMode(id, mode)).length;
        const compCount = countDynamicCells(doc, '.col-comp-dyn');
        doc.querySelectorAll('.pes-base-spacer').forEach((node) => setColSpanOrHide(node, baseVisible));
        doc.querySelectorAll('.pes-tail-spacer').forEach((node) => setColSpanOrHide(node, tailVisible));
        doc.querySelectorAll('.pes-total-label').forEach((node) => setColSpanOrHide(node, baseVisible));
        doc.querySelectorAll('.pes-total-comp-spacer').forEach((node) => setColSpanOrHide(node, compCount));
    }

    function applyTLLayout(doc, selectedSet) {
        void doc;
        void selectedSet;
    }

    function applyToraLayout(doc, selectedSet) {
        const baseVisible = 3 + ['rodo', 'comprimento', 'oco1', 'oco2'].filter((id) => selectedSet.has(id)).length;
        const geoVisible = ['compGeo', 'x1', 'x2', 'x3', 'x4'].filter((id) => selectedSet.has(id)).length;
        doc.querySelectorAll('.tora-total-label').forEach((node) => setColSpanOrHide(node, baseVisible));
        doc.querySelectorAll('.tora-geo-spacer').forEach((node) => setColSpanOrHide(node, geoVisible));
    }

    function applyToPrintDocument(printDocument, moduleKey) {
        const doc = printDocument || document;
        const normalized = normalizeModule(moduleKey);
        const def = MODULES[normalized];
        const selected = getSelectedColumnsSync(normalized);
        const selectedSet = new Set(selected);
        const hiddenSelectors = [];

        def.columns.forEach((column) => {
            if (!selectedSet.has(column.id)) hiddenSelectors.push(...column.selectors);
        });
        hideElements(doc, hiddenSelectors);

        if (doc.body) {
            doc.body.setAttribute('data-romaneio-print-config', selected.join(','));
            doc.body.setAttribute('data-romaneio-print-config-module', normalized);
        }

        if (normalized === 'TL') applyTLLayout(doc, selectedSet);
        if (normalized === 'PCT') applyPCTLayout(doc, selectedSet);
        if (normalized === 'PES') applyPESLayout(doc, selectedSet);
        if (normalized === 'TORA') applyToraLayout(doc, selectedSet);
    }

    function preloadAll() {
        Object.keys(MODULES).forEach((key) => {
            ensureLoaded(key).catch(() => {});
        });
    }

    window.RomaneioPrintConfig = {
        MODULES,
        openModal,
        closeModal,
        ensureLoaded,
        loadConfig,
        saveConfig,
        applyToPrintDocument,
        getSelectedColumnsSync,
        resolveCompanyId
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectStyles();
            setTimeout(preloadAll, 800);
        });
    } else {
        injectStyles();
        setTimeout(preloadAll, 800);
    }
})();
