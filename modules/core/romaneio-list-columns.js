// modules/core/romaneio-list-columns.js
// Redimensionamento de colunas, altura de linhas (densidade) e controle de paginação
// para os Modais de Lista de Romaneios (TL, PCT, PES, Tora e Pré-Romaneio)
(function () {
    'use strict';

    var SCRIPT = document.currentScript || {};
    var DATA = SCRIPT.dataset || {};
    var PAGE = String(DATA.page || '').trim().toLowerCase();
    var TARGET = String(DATA.target || '').trim();

    var CONTRACT_BY_PAGE = {
        tl: ['Data', 'Cliente', 'Espécies', 'Itens', 'Volume (m³)', 'Valor Total', 'Ações'],
        pct: ['Data', 'Cliente', 'Espécies', 'Itens', 'Volume (m³)', 'Valor Total', 'Ações'],
        pes: ['Data', 'Cliente', 'Espécies', 'Itens', 'Volume (m³)', 'Valor Total', 'Ações'],
        tora: ['Data', 'Fornecedor', 'Espécies', 'Itens', 'Volume (m³)', 'Valor Total', 'Ações'],
        preromaneio: ['Data', 'Cliente', 'Tipo', 'Volume', 'Valor', 'Ações']
    };

    var MIN_WIDTH = 60;
    var MAX_WIDTH = 500;
    var MIN_ACTIONS_WIDTH = 140;
    var SAVE_DEBOUNCE_MS = 400;

    var DEFAULTS = {
        'Data': 95,
        'Cliente': 260,
        'Fornecedor': 260,
        'Espécies': 210,
        'Tipo': 120,
        'Itens': 70,
        'Volume (m³)': 115,
        'Volume': 115,
        'Valor Total': 130,
        'Valor': 130,
        'Ações': MIN_ACTIONS_WIDTH
    };

    var widthsCache = {};
    var rowHeightCache = {};
    var pageSizeCache = {};
    var saveTimer = null;
    var initialized = false;

    function resolveUid() {
        try {
            if (window.firebaseAuthUser && window.firebaseAuthUser.uid) return String(window.firebaseAuthUser.uid);
            if (window.firebaseService && window.firebaseService.authService && typeof window.firebaseService.authService.getAuth === 'function') {
                var user = window.firebaseService.authService.getAuth().currentUser;
                if (user && user.uid) return String(user.uid);
            }
            var raw = localStorage.getItem('currentUser') || localStorage.getItem('persistentUser') || localStorage.getItem('user_session') || localStorage.getItem('firebase_user');
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && (parsed.uid || parsed.id || parsed.userId)) return String(parsed.uid || parsed.id || parsed.userId);
            }
        } catch (_) {}
        return 'anon';
    }

    function resolveTenant() {
        try {
            var svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.getTenantId === 'function') {
                var t = svc.getTenantId();
                if (t) return String(t);
            }
            if (svc && typeof svc.getCurrentTenantId === 'function') {
                var t2 = svc.getCurrentTenantId();
                if (t2) return String(t2);
            }
            if (window.appTenantId) return String(window.appTenantId);
            if (window.__currentCompanyId) return String(window.__currentCompanyId);
            var infoRaw = localStorage.getItem('company_info');
            if (infoRaw) {
                var info = JSON.parse(infoRaw);
                if (info && (info.companyId || info.companyID || info.tenantId || info.id)) {
                    return String(info.companyId || info.companyID || info.tenantId || info.id);
                }
            }
        } catch (_) {}
        return 'default';
    }

    function buildPath(pageKey) {
        var p = pageKey || PAGE || 'tl';
        var uid = resolveUid();
        var tenant = resolveTenant();
        return 'users/' + uid + '/preferences/romaneioListColumns/' + tenant + '/' + p;
    }

    function localStorageKey(pageKey) {
        var p = pageKey || PAGE || 'tl';
        return 'sisweb_romaneioListColumns_' + resolveTenant() + '_' + resolveUid() + '_' + p;
    }

    function rowHeightStorageKey(pageKey) {
        var p = pageKey || PAGE || 'tl';
        return 'sisweb_romaneioListRowHeight_' + resolveTenant() + '_' + resolveUid() + '_' + p;
    }

    function pageSizeStorageKey(pageKey) {
        var p = pageKey || PAGE || 'tl';
        return 'sisweb_romaneioListPageSize_' + resolveTenant() + '_' + resolveUid() + '_' + p;
    }

    function contract(pageKey) {
        var p = pageKey || PAGE || 'tl';
        return CONTRACT_BY_PAGE[p] || CONTRACT_BY_PAGE.tl;
    }

    function clamp(value, min, max) {
        var n = Math.round(Number(value));
        if (!isFinite(n)) return null;
        return Math.max(min, Math.min(max, n));
    }

    function sanitizeWidths(raw, pageKey) {
        var clean = {};
        if (!raw || typeof raw !== 'object') return clean;
        var p = pageKey || PAGE || 'tl';
        contract(p).forEach(function (label) {
            if (raw[label] !== undefined && raw[label] !== null) {
                var min = label === 'Ações' ? MIN_ACTIONS_WIDTH : MIN_WIDTH;
                var val = clamp(raw[label], min, MAX_WIDTH);
                if (val !== null) clean[label] = val;
            }
        });
        return clean;
    }

    function getWidthsSync(pageKey) {
        var p = pageKey || PAGE || 'tl';
        if (widthsCache[p] && Object.keys(widthsCache[p]).length > 0) return widthsCache[p];
        try {
            var raw = localStorage.getItem(localStorageKey(p));
            if (raw) {
                var parsed = JSON.parse(raw);
                var sanitized = sanitizeWidths(parsed, p);
                if (Object.keys(sanitized).length > 0) {
                    widthsCache[p] = sanitized;
                    return sanitized;
                }
            }
        } catch (_) {}
        var def = {};
        contract(p).forEach(function (label) {
            if (DEFAULTS[label]) def[label] = DEFAULTS[label];
        });
        widthsCache[p] = def;
        return def;
    }

    function scheduleSave(clean, pageKey) {
        var p = pageKey || PAGE || 'tl';
        widthsCache[p] = clean;
        try {
            localStorage.setItem(localStorageKey(p), JSON.stringify(clean));
        } catch (_) {}
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            saveRemote(clean, p);
        }, SAVE_DEBOUNCE_MS);
    }

    function loadRemote(pageKey) {
        return new Promise(function (resolve) {
            var p = pageKey || PAGE || 'tl';
            if (resolveUid() === 'anon') return resolve(null);
            var svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (!svc || typeof svc.loadFromFirebase !== 'function') return resolve(null);
            try {
                svc.loadFromFirebase(buildPath(p)).then(function (res) {
                    var data = res && res.data ? res.data : res;
                    if (data && typeof data === 'object') {
                        var sanitized = sanitizeWidths(data, p);
                        resolve(sanitized);
                    } else {
                        resolve(null);
                    }
                }).catch(function () {
                    resolve(null);
                });
            } catch (_) {
                resolve(null);
            }
        });
    }

    function saveRemote(clean, pageKey) {
        var p = pageKey || PAGE || 'tl';
        if (resolveUid() === 'anon') return;
        var svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
        if (!svc || typeof svc.saveToFirebase !== 'function') return;
        try {
            svc.saveToFirebase(buildPath(p), null, clean, { silent: true }).catch(function () {});
        } catch (_) {}
    }

    function setColumnWidth(th, width) {
        if (!th) return;
        var px = width + 'px';
        th.style.setProperty('width', px, 'important');
        th.style.setProperty('min-width', px, 'important');
        th.style.setProperty('max-width', px, 'important');
    }

    function ensureFixedLayout(table) {
        if (!table) return;
        table.style.setProperty('table-layout', 'fixed', 'important');
        table.classList.add('rlc-fixed');
        // Evita o "esticamento" das colunas para preencher 100%: com larguras em px,
        // a tabela deve ocupar exatamente a soma das colunas (não redistribuir espaço extra),
        // senão o browser reajusta todas as colunas ao aparecer/desaparecer a barra de rolagem
        // (causando "movimento" das colunas ao passar o mouse ou redimensionar).
        table.style.setProperty('width', 'auto', 'important');
        table.style.setProperty('min-width', '0', 'important');
        table.style.setProperty('max-width', '100%', 'important');
    }

    function applyWidths(table, clean, pageKey) {
        if (!table || !clean) return;
        var p = pageKey || PAGE || 'tl';
        var headers = table.querySelectorAll('thead th');
        contract(p).forEach(function (label, index) {
            if (index >= headers.length || !clean[label]) return;
            setColumnWidth(headers[index], clean[label]);
        });
        if (Object.keys(clean).length > 0) ensureFixedLayout(table);
    }

    function attachResize(table, pageKey) {
        if (!table) return;
        var p = pageKey || PAGE || 'tl';
        var headers = table.querySelectorAll('thead th');
        for (let index = 0; index < headers.length; index++) {
            let th = headers[index];
            if (th.__rlcAttached) continue;
            th.__rlcAttached = true;
            th.style.position = 'relative';

            let handle = document.createElement('div');
            handle.className = 'rlc-handle';
            handle.title = 'Arraste para ajustar a largura da coluna';
            th.appendChild(handle);

            handle.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var label = contract(p)[index] || '';
                var min = label === 'Ações' ? MIN_ACTIONS_WIDTH : MIN_WIDTH;
                var startX = e.clientX;
                var startWidth = th.getBoundingClientRect().width;
                th.classList.add('rlc-resizing');
                try {
                    handle.setPointerCapture(e.pointerId);
                } catch (_) {}

                function onMove(ev) {
                    var width = clamp(startWidth + (ev.clientX - startX), min, MAX_WIDTH);
                    setColumnWidth(th, width);
                    ensureFixedLayout(table);
                    th.title = width + 'px';
                }

                function onUp() {
                    th.classList.remove('rlc-resizing');
                    handle.removeEventListener('pointermove', onMove);
                    handle.removeEventListener('pointerup', onUp);
                    handle.removeEventListener('pointercancel', onUp);
                    var clean = {};
                    var headersNow = table.querySelectorAll('thead th');
                    contract(p).forEach(function (labelNow, idx) {
                        if (idx < headersNow.length && headersNow[idx].style.width) {
                            var px = parseInt(headersNow[idx].style.width, 10);
                            clean[labelNow] = clamp(px, labelNow === 'Ações' ? MIN_ACTIONS_WIDTH : MIN_WIDTH, MAX_WIDTH);
                        }
                    });
                    scheduleSave(sanitizeWidths(clean, p), p);
                }

                handle.addEventListener('pointermove', onMove);
                handle.addEventListener('pointerup', onUp);
                handle.addEventListener('pointercancel', onUp);
            });
        }
    }

    // === GERENCIAMENTO DE ALTURA DE LINHAS (DENSIDADE) ===
    var ROW_HEIGHT_CLASSES = {
        compacta: 'rlc-density-compact',
        normal: 'rlc-density-normal',
        confortavel: 'rlc-density-comfortable'
    };

    function getRowHeight(pageKey) {
        var p = pageKey || PAGE || 'tl';
        if (rowHeightCache[p]) return rowHeightCache[p];
        try {
            var val = localStorage.getItem(rowHeightStorageKey(p));
            if (val && ROW_HEIGHT_CLASSES[val]) {
                rowHeightCache[p] = val;
                return val;
            }
        } catch (_) {}
        return 'normal';
    }

    function setRowHeight(tableOrContainer, heightOption, pageKey) {
        var p = pageKey || PAGE || 'tl';
        var valid = ROW_HEIGHT_CLASSES[heightOption] ? heightOption : 'normal';
        rowHeightCache[p] = valid;
        try {
            localStorage.setItem(rowHeightStorageKey(p), valid);
        } catch (_) {}

        var targets = [];
        if (tableOrContainer) {
            targets.push(tableOrContainer);
            if (tableOrContainer.closest) {
                var modal = tableOrContainer.closest('.modal') || tableOrContainer.closest('.modal-content') || tableOrContainer.closest('#listaModal') || tableOrContainer.closest('#romaneioListModal');
                if (modal) targets.push(modal);
                var content = tableOrContainer.closest('.modal-content');
                if (content) targets.push(content);
                var container = tableOrContainer.closest('.table-container') || tableOrContainer.closest('.table-responsive');
                if (container) targets.push(container);
                var table = tableOrContainer.tagName === 'TABLE' ? tableOrContainer : tableOrContainer.querySelector('table');
                if (table) targets.push(table);
            }
        }
        
        // Também buscar os modais ativos no DOM
        ['listaModal', 'romaneioListModal'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) {
                targets.push(el);
                var c = el.querySelector('.modal-content');
                if (c) targets.push(c);
                var t = el.querySelector('table');
                if (t) targets.push(t);
                var tc = el.querySelector('.table-container, .table-responsive');
                if (tc) targets.push(tc);
            }
        });
        document.querySelectorAll('div[id*="romaneioModal"]').forEach(function(el) {
            targets.push(el);
            var c = el.querySelector('.modal-content');
            if (c) targets.push(c);
            var t = el.querySelector('table');
            if (t) targets.push(t);
            var tc = el.querySelector('.table-container, .table-responsive');
            if (tc) targets.push(tc);
        });

        // Aplicar as classes
        targets.forEach(function (target) {
            if (!target || !target.classList) return;
            Object.values(ROW_HEIGHT_CLASSES).forEach(function (cls) {
                target.classList.remove(cls);
            });
            target.classList.add(ROW_HEIGHT_CLASSES[valid]);
        });

        // Sincronizar o select na tela se existir
        document.querySelectorAll('.rlc-density-select').forEach(function(sel) {
            if (sel.value !== valid) sel.value = valid;
        });
    }

    // === GERENCIAMENTO DE ITENS POR PÁGINA ===
    function getPageSize(pageKey, defaultVal) {
        var p = pageKey || PAGE || 'tl';
        if (pageSizeCache[p]) return pageSizeCache[p];
        try {
            var raw = localStorage.getItem(pageSizeStorageKey(p));
            var n = parseInt(raw, 10);
            if ([5, 10, 50, 100].includes(n)) {
                pageSizeCache[p] = n;
                return n;
            }
        } catch (_) {}
        var d = [5, 10, 50, 100].includes(defaultVal) ? defaultVal : 10;
        pageSizeCache[p] = d;
        return d;
    }

    function setPageSize(val, pageKey) {
        var p = pageKey || PAGE || 'tl';
        var n = parseInt(val, 10);
        if ([5, 10, 50, 100].includes(n)) {
            pageSizeCache[p] = n;
            try {
                localStorage.setItem(pageSizeStorageKey(p), String(n));
            } catch (_) {}
            return n;
        }
        return 10;
    }

    function injectStyles() {
        if (document.getElementById('rlc-styles')) return;
        var style = document.createElement('style');
        style.id = 'rlc-styles';
        style.textContent = `
            /* === PADRONIZAÇÃO DIMENSIONAL DOS 5 MODAIS DE LISTAGEM DE ROMANEIOS === */
            #listaModal .modal-content,
            #romaneioListModal .modal-content,
            div[id*="romaneioModal"] .modal-content {
                width: 95% !important;
                max-width: 1200px !important;
                height: min(88vh, 720px) !important;
                min-height: min(560px, calc(100vh - 140px)) !important;
                max-height: calc(100vh - 110px) !important;
                display: flex !important;
                flex-direction: column !important;
                margin: 2.5vh auto !important;
                border-radius: 8px !important;
                background: #ffffff !important;
                box-shadow: 0 12px 36px rgba(0, 0, 0, 0.28) !important;
                overflow: hidden !important;
                box-sizing: border-box !important;
            }

            #listaModal .modal-header,
            #romaneioListModal .modal-header,
            div[id*="romaneioModal"] .modal-header {
                flex: 0 0 auto !important;
                height: 52px !important;
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%) !important;
                color: #ffffff !important;
                padding: 12px 20px !important;
                border-radius: 8px 8px 0 0 !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                box-sizing: border-box !important;
            }

            #listaModal .modal-body,
            #romaneioListModal .modal-body,
            div[id*="romaneioModal"] .modal-body {
                flex: 1 1 auto !important;
                display: flex !important;
                flex-direction: column !important;
                overflow: hidden !important;
                padding: 16px 20px 10px !important;
                gap: 10px !important;
                min-height: 0 !important;
                max-height: none !important;
                box-sizing: border-box !important;
            }

            #listaModal .filter-container,
            #romaneioListModal .filter-container,
            #listaModal .search-box,
            #romaneioListModal #romaneioListFilter,
            div[id*="romaneioModal"] .search-box,
            div[id*="romaneioModal"] input[type="text"] {
                flex: 0 0 auto !important;
            }

            #listaModal .table-container,
            #listaModal .table-responsive,
            #romaneioListModal .table-container,
            #romaneioListModal .table-responsive,
            div[id*="romaneioModal"] .table-container,
            div[id*="romaneioModal"] .table-responsive {
                flex: 1 1 auto !important;
                min-height: 0 !important;
                max-height: none !important;
                overflow-y: auto !important;
                overflow-x: auto !important;
                scrollbar-gutter: stable !important;
                border: 1px solid #e2e8f0 !important;
                border-radius: 6px !important;
                background: #ffffff !important;
                margin-bottom: 4px !important;
            }

            #listaModal table,
            #romaneioListModal table,
            div[id*="romaneioModal"] table {
                width: 100% !important;
                border-collapse: collapse !important;
                margin: 0 !important;
            }

            #listaModal thead th,
            #romaneioListModal thead th,
            div[id*="romaneioModal"] thead th {
                position: sticky !important;
                top: 0 !important;
                z-index: 10 !important;
                background: #2c3e50 !important;
                color: #ffffff !important;
                font-weight: 600 !important;
                padding: 10px 10px !important;
                font-size: 13px !important;
                white-space: nowrap !important;
                border-bottom: 2px solid #1e293b !important;
            }

            #listaModal .modal-footer,
            #romaneioListModal .modal-footer,
            div[id*="romaneioModal"] .modal-footer {
                flex: 0 0 auto !important;
                height: auto !important;
                min-height: 56px !important;
                padding: 10px 20px !important;
                border-top: 1px solid #e2e8f0 !important;
                background: #f8fafc !important;
                border-radius: 0 0 8px 8px !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                flex-wrap: wrap !important;
                gap: 8px 12px !important;
                box-sizing: border-box !important;
            }

            /* Redimensionamento de Colunas */
            .romaneio-list-cols th { position: relative; }
            .rlc-handle {
                position: absolute;
                top: 0;
                right: -4px;
                width: 8px;
                height: 100%;
                cursor: col-resize;
                touch-action: none;
                user-select: none;
                -webkit-user-select: none;
                z-index: 25;
            }
            .rlc-handle:hover {
                background: rgba(37, 99, 235, 0.45);
            }
            .romaneio-list-cols.rlc-fixed {
                table-layout: fixed !important;
                width: 100% !important;
            }
            .rlc-resizing th { user-select: none; }
            .rlc-resizing { cursor: col-resize !important; }

            /* === ALTURAS DE LINHA / DENSIDADE (COM FORÇA MÁXIMA !IMPORTANT) === */
            /* 1. COMPACTA */
            body .rlc-density-compact table tbody tr td,
            body table.rlc-density-compact tbody tr td,
            body .modal.rlc-density-compact table tbody tr td,
            body .modal-content.rlc-density-compact table tbody tr td,
            body #listaModal.rlc-density-compact table td,
            body #romaneioListModal.rlc-density-compact table td,
            body div[id*="romaneioModal"].rlc-density-compact table td,
            body #listaModal .rlc-density-compact table td,
            body #romaneioListModal .rlc-density-compact table td,
            body div[id*="romaneioModal"] .rlc-density-compact table td,
            body #listaModal.rlc-density-compact tbody td,
            body #romaneioListModal.rlc-density-compact tbody td,
            body div[id*="romaneioModal"].rlc-density-compact tbody td,
            body #clientListModal.rlc-density-compact .table tbody td,
            body #speciesListModal.rlc-density-compact .table tbody td,
            body #fornecedorListModal.rlc-density-compact .table tbody td,
            body .rlc-density-compact td {
                padding: 2px 6px !important;
                font-size: 11.5px !important;
                line-height: 1.15 !important;
                height: 28px !important;
                max-height: 30px !important;
            }
            body .rlc-density-compact tr,
            body .rlc-density-compact tbody tr,
            body #listaModal.rlc-density-compact tr,
            body #romaneioListModal.rlc-density-compact tr,
            body #clientListModal.rlc-density-compact .table tbody tr,
            body #speciesListModal.rlc-density-compact .table tbody tr,
            body #fornecedorListModal.rlc-density-compact .table tbody tr {
                height: 28px !important;
                max-height: 30px !important;
            }
            body .rlc-density-compact .btn-group,
            body .rlc-density-compact .btn-group-custom,
            body .modal-content.rlc-density-compact .btn-group,
            body .modal-content.rlc-density-compact .btn-group-custom,
            body #listaModal.rlc-density-compact .btn-group,
            body #romaneioListModal.rlc-density-compact .btn-group,
            body #clientListModal.rlc-density-compact .btn-group,
            body #speciesListModal.rlc-density-compact .btn-group,
            body #fornecedorListModal.rlc-density-compact .btn-group {
                gap: 2px !important;
                display: inline-flex !important;
                align-items: center !important;
            }
            body .rlc-density-compact .action-button,
            body .rlc-density-compact .action-btn-custom,
            body .rlc-density-compact .btn-action,
            body .modal-content.rlc-density-compact table button,
            body .modal-content.rlc-density-compact table .action-button,
            body .modal-content.rlc-density-compact table .action-btn-custom,
            body .modal-content.rlc-density-compact table .btn-action,
            body #listaModal.rlc-density-compact table button,
            body #romaneioListModal.rlc-density-compact table button,
            body #listaModal.rlc-density-compact .action-button,
            body #romaneioListModal.rlc-density-compact .action-button,
            body #clientListModal.rlc-density-compact table button,
            body #speciesListModal.rlc-density-compact table button,
            body #fornecedorListModal.rlc-density-compact table button,
            body #clientListModal.rlc-density-compact .action-button,
            body #speciesListModal.rlc-density-compact .action-button,
            body #fornecedorListModal.rlc-density-compact .action-button {
                width: 24px !important;
                height: 24px !important;
                min-width: 24px !important;
                min-height: 24px !important;
                max-width: 24px !important;
                max-height: 24px !important;
                font-size: 10.5px !important;
                padding: 0 !important;
                margin: 0 1px !important;
                line-height: 1 !important;
            }
            body .rlc-density-compact button i,
            body .rlc-density-compact .action-button i,
            body .rlc-density-compact .action-btn-custom i {
                font-size: 10px !important;
            }

            /* 2. NORMAL (Padrão) */
            body .rlc-density-normal table tbody tr td,
            body table.rlc-density-normal tbody tr td,
            body .modal.rlc-density-normal table tbody tr td,
            body .modal-content.rlc-density-normal table tbody tr td,
            body #listaModal.rlc-density-normal table td,
            body #romaneioListModal.rlc-density-normal table td,
            body div[id*="romaneioModal"].rlc-density-normal table td,
            body #listaModal .rlc-density-normal table td,
            body #romaneioListModal .rlc-density-normal table td,
            body div[id*="romaneioModal"] .rlc-density-normal table td,
            body #listaModal.rlc-density-normal tbody td,
            body #romaneioListModal.rlc-density-normal tbody td,
            body div[id*="romaneioModal"].rlc-density-normal tbody td,
            body #clientListModal.rlc-density-normal .table tbody td,
            body #speciesListModal.rlc-density-normal .table tbody td,
            body #fornecedorListModal.rlc-density-normal .table tbody td,
            body .rlc-density-normal td {
                padding: 8px 10px !important;
                font-size: 13px !important;
                line-height: 1.35 !important;
                height: 42px !important;
            }
            body .rlc-density-normal tr,
            body .rlc-density-normal tbody tr,
            body #listaModal.rlc-density-normal tr,
            body #romaneioListModal.rlc-density-normal tr,
            body #clientListModal.rlc-density-normal .table tbody tr,
            body #speciesListModal.rlc-density-normal .table tbody tr,
            body #fornecedorListModal.rlc-density-normal .table tbody tr {
                height: 42px !important;
            }
            body .rlc-density-normal .btn-group,
            body .rlc-density-normal .btn-group-custom,
            body .modal-content.rlc-density-normal .btn-group,
            body .modal-content.rlc-density-normal .btn-group-custom,
            body #listaModal.rlc-density-normal .btn-group,
            body #romaneioListModal.rlc-density-normal .btn-group,
            body #clientListModal.rlc-density-normal .btn-group,
            body #speciesListModal.rlc-density-normal .btn-group,
            body #fornecedorListModal.rlc-density-normal .btn-group {
                gap: 4px !important;
                display: inline-flex !important;
                align-items: center !important;
            }
            body .rlc-density-normal .action-button,
            body .rlc-density-normal .action-btn-custom,
            body .rlc-density-normal .btn-action,
            body .modal-content.rlc-density-normal table button,
            body .modal-content.rlc-density-normal table .action-button,
            body .modal-content.rlc-density-normal table .action-btn-custom,
            body .modal-content.rlc-density-normal table .btn-action,
            body #listaModal.rlc-density-normal table button,
            body #romaneioListModal.rlc-density-normal table button,
            body #listaModal.rlc-density-normal .action-button,
            body #romaneioListModal.rlc-density-normal .action-button,
            body #clientListModal.rlc-density-normal table button,
            body #speciesListModal.rlc-density-normal table button,
            body #fornecedorListModal.rlc-density-normal table button,
            body #clientListModal.rlc-density-normal .action-button,
            body #speciesListModal.rlc-density-normal .action-button,
            body #fornecedorListModal.rlc-density-normal .action-button {
                width: 32px !important;
                height: 32px !important;
                min-width: 32px !important;
                min-height: 32px !important;
                max-width: 32px !important;
                max-height: 32px !important;
                font-size: 12.5px !important;
                padding: 0 !important;
                margin: 0 2px !important;
            }
            body .rlc-density-normal button i,
            body .rlc-density-normal .action-button i,
            body .rlc-density-normal .action-btn-custom i {
                font-size: 12px !important;
            }

            /* 3. CONFORTÁVEL */
            body .rlc-density-comfortable table tbody tr td,
            body table.rlc-density-comfortable tbody tr td,
            body .modal.rlc-density-comfortable table tbody tr td,
            body .modal-content.rlc-density-comfortable table tbody tr td,
            body #listaModal.rlc-density-comfortable table td,
            body #romaneioListModal.rlc-density-comfortable table td,
            body div[id*="romaneioModal"].rlc-density-comfortable table td,
            body #listaModal .rlc-density-comfortable table td,
            body #romaneioListModal .rlc-density-comfortable table td,
            body div[id*="romaneioModal"] .rlc-density-comfortable table td,
            body #listaModal.rlc-density-comfortable tbody td,
            body #romaneioListModal.rlc-density-comfortable tbody td,
            body div[id*="romaneioModal"].rlc-density-comfortable tbody td,
            body #clientListModal.rlc-density-comfortable .table tbody td,
            body #speciesListModal.rlc-density-comfortable .table tbody td,
            body #fornecedorListModal.rlc-density-comfortable .table tbody td,
            body .rlc-density-comfortable td {
                padding: 16px 12px !important;
                font-size: 14.5px !important;
                line-height: 1.55 !important;
                height: 58px !important;
            }
            body .rlc-density-comfortable tr,
            body .rlc-density-comfortable tbody tr,
            body #listaModal.rlc-density-comfortable tr,
            body #romaneioListModal.rlc-density-comfortable tr,
            body #clientListModal.rlc-density-comfortable .table tbody tr,
            body #speciesListModal.rlc-density-comfortable .table tbody tr,
            body #fornecedorListModal.rlc-density-comfortable .table tbody tr {
                height: 58px !important;
            }
            body .rlc-density-comfortable .btn-group,
            body .rlc-density-comfortable .btn-group-custom,
            body .modal-content.rlc-density-comfortable .btn-group,
            body .modal-content.rlc-density-comfortable .btn-group-custom,
            body #listaModal.rlc-density-comfortable .btn-group,
            body #romaneioListModal.rlc-density-comfortable .btn-group,
            body #clientListModal.rlc-density-comfortable .btn-group,
            body #speciesListModal.rlc-density-comfortable .btn-group,
            body #fornecedorListModal.rlc-density-comfortable .btn-group {
                gap: 6px !important;
                display: inline-flex !important;
                align-items: center !important;
            }
            body .rlc-density-comfortable .action-button,
            body .rlc-density-comfortable .action-btn-custom,
            body .rlc-density-comfortable .btn-action,
            body .modal-content.rlc-density-comfortable table button,
            body .modal-content.rlc-density-comfortable table .action-button,
            body .modal-content.rlc-density-comfortable table .action-btn-custom,
            body .modal-content.rlc-density-comfortable table .btn-action,
            body #listaModal.rlc-density-comfortable table button,
            body #romaneioListModal.rlc-density-comfortable table button,
            body #listaModal.rlc-density-comfortable .action-button,
            body #romaneioListModal.rlc-density-comfortable .action-button,
            body #clientListModal.rlc-density-comfortable table button,
            body #speciesListModal.rlc-density-comfortable table button,
            body #fornecedorListModal.rlc-density-comfortable table button,
            body #clientListModal.rlc-density-comfortable .action-button,
            body #speciesListModal.rlc-density-comfortable .action-button,
            body #fornecedorListModal.rlc-density-comfortable .action-button {
                width: 38px !important;
                height: 38px !important;
                min-width: 38px !important;
                min-height: 38px !important;
                max-width: 38px !important;
                max-height: 38px !important;
                font-size: 14px !important;
                padding: 0 !important;
                margin: 0 3px !important;
            }
            body .rlc-density-comfortable button i,
            body .rlc-density-comfortable .action-button i,
            body .rlc-density-comfortable .action-btn-custom i {
                font-size: 14px !important;
            }

            /* Barra de Controles e Paginação */
            .rlc-pagination-bar {
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex-wrap: wrap !important;
                gap: 10px !important;
                padding: 6px 0 2px !important;
                margin-top: 4px !important;
                flex-shrink: 0 !important;
            }
            .rlc-pagination-controls {
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            .rlc-pagination-controls button {
                min-width: 32px;
                height: 32px;
                padding: 0 8px;
                border: 1px solid #cbd5e1;
                background: #ffffff;
                color: #334155;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12.5px;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
            }
            .rlc-pagination-controls button:hover:not(:disabled) {
                background: #f1f5f9;
                border-color: #94a3b8;
            }
            .rlc-pagination-controls button.active {
                background: #2563eb !important;
                color: #ffffff !important;
                border-color: #2563eb !important;
                font-weight: 700;
            }
            .rlc-pagination-controls button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                background: #f8fafc;
            }
            .rlc-pagination-options {
                display: inline-flex;
                align-items: center;
                gap: 12px;
                font-size: 13px;
                color: #475569;
            }
            .rlc-pagination-options select {
                padding: 5px 10px;
                border: 1px solid #cbd5e1;
                border-radius: 4px;
                background: #ffffff;
                color: #1e293b;
                font-size: 12.5px;
                cursor: pointer;
                outline: none;
            }
            .rlc-pagination-options select:focus {
                border-color: #2563eb;
                box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * ✅ RENDERIZADOR PADRONIZADO DA BARRA DE PAGINAÇÃO
     */
    function renderPaginationBar(container, options) {
        if (!container) return;
        injectStyles();

        var totalItems = options.totalItems || 0;
        var currentPage = options.currentPage || 1;
        var pageSize = options.pageSize || 10;
        var pageKey = options.pageKey || PAGE || 'tl';
        var onPageChange = options.onPageChange || function () {};
        var onPageSizeChange = options.onPageSizeChange || function () {};
        var onDensityChange = options.onDensityChange || function () {};

        var totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        container.className = 'rlc-pagination-bar';
        container.innerHTML = `
            <div class="rlc-pagination-options">
                <label style="display: inline-flex; align-items: center; gap: 6px; margin: 0; font-weight: 500;">
                    Exibir:
                    <select class="rlc-page-size-select">
                        <option value="5" ${pageSize === 5 ? 'selected' : ''}>5 por página</option>
                        <option value="10" ${pageSize === 10 ? 'selected' : ''}>10 por página</option>
                        <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 por página</option>
                        <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 por página</option>
                    </select>
                </label>
                <label style="display: inline-flex; align-items: center; gap: 6px; margin: 0; font-weight: 500;">
                    Densidade:
                    <select class="rlc-density-select">
                        <option value="compacta" ${getRowHeight(pageKey) === 'compacta' ? 'selected' : ''}>Compacta</option>
                        <option value="normal" ${getRowHeight(pageKey) === 'normal' ? 'selected' : ''}>Normal</option>
                        <option value="confortavel" ${getRowHeight(pageKey) === 'confortavel' ? 'selected' : ''}>Confortável</option>
                    </select>
                </label>
            </div>
            <div class="rlc-pagination-controls"></div>
        `;

        // Eventos dos selects
        var sizeSelect = container.querySelector('.rlc-page-size-select');
        if (sizeSelect) {
            sizeSelect.onchange = function () {
                var newSize = setPageSize(this.value, pageKey);
                onPageSizeChange(newSize);
            };
        }

        var densitySelect = container.querySelector('.rlc-density-select');
        if (densitySelect) {
            densitySelect.onchange = function () {
                var table = container.closest('.modal-content') ? container.closest('.modal-content').querySelector('table') : null;
                setRowHeight(table || container, this.value, pageKey);
                onDensityChange(this.value);
            };
        }

        var controls = container.querySelector('.rlc-pagination-controls');
        if (!controls) return;

        function addBtn(label, targetPage, disabled, active) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.innerHTML = label;
            if (active) btn.classList.add('active');
            btn.disabled = !!disabled;
            btn.onclick = function () {
                if (!disabled && targetPage !== currentPage) {
                    onPageChange(targetPage);
                }
            };
            controls.appendChild(btn);
        }

        addBtn('<i class="fas fa-angle-double-left"></i>', 1, currentPage === 1);
        addBtn('<i class="fas fa-angle-left"></i>', currentPage - 1, currentPage === 1);

        var startPage = Math.max(1, currentPage - 2);
        var endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            addBtn('1', 1, false, currentPage === 1);
            if (startPage > 2) {
                var span = document.createElement('span');
                span.textContent = '...';
                span.style.padding = '0 4px';
                controls.appendChild(span);
            }
        }

        for (var i = startPage; i <= endPage; i++) {
            addBtn(String(i), i, false, i === currentPage);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                var span2 = document.createElement('span');
                span2.textContent = '...';
                span2.style.padding = '0 4px';
                controls.appendChild(span2);
            }
            addBtn(String(totalPages), totalPages, false, currentPage === totalPages);
        }

        addBtn('<i class="fas fa-angle-right"></i>', currentPage + 1, currentPage === totalPages);
        addBtn('<i class="fas fa-angle-double-right"></i>', totalPages, currentPage === totalPages);
    }

    function initTable(tableElement, pageKey) {
        if (!tableElement) return;
        injectStyles();
        var p = pageKey || PAGE || 'tl';
        tableElement.classList.add('romaneio-list-cols');
        var clean = getWidthsSync(p);
        if (Object.keys(clean).length > 0) applyWidths(tableElement, clean, p);
        attachResize(tableElement, p);
        setRowHeight(tableElement, getRowHeight(p), p);

        if (resolveUid() !== 'anon') {
            loadRemote(p).then(function (remote) {
                if (remote && Object.keys(remote).length > 0 && tableElement) {
                    widthsCache[p] = remote;
                    applyWidths(tableElement, remote, p);
                }
            });
        }
    }

    window.RomaneioListColumns = {
        buildPath: buildPath,
        sanitize: sanitizeWidths,
        getWidths: getWidthsSync,
        saveWidths: scheduleSave,
        applyWidths: applyWidths,
        attachResize: attachResize,
        getRowHeight: getRowHeight,
        setRowHeight: setRowHeight,
        getPageSize: getPageSize,
        setPageSize: setPageSize,
        renderPaginationBar: renderPaginationBar,
        initTable: initTable
    };
})();
