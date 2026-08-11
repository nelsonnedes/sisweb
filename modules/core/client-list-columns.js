// modules/core/client-list-columns.js
// Redimensionamento por arraste das colunas das Listas de Clientes (PCT/TL/PES/Pre-romaneio)
// e da Lista de Fornecedores (romaneiotora), com persistencia por usuario + tenant.
// Spec: docs/superpowers/specs/2026-08-11-client-list-columns-resize-design.md
(function () {
    'use strict';

    var SCRIPT = document.currentScript || {};
    var DATA = SCRIPT.dataset || {};
    var PAGE = String(DATA.page || '').trim().toLowerCase();
    var TARGET = String(DATA.target || '').trim();

    var CONTRACT_BY_PAGE = {
        pct: ['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'Ações'],
        tl: ['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'Ações'],
        pes: ['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'Ações'],
        preromaneio: ['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'Ações'],
        fornecedores: ['Nome', 'CNPJ', 'Cidade', 'Estado', 'Telefone', 'Ações']
    };
    var MIN_WIDTH = 60;
    var MAX_WIDTH = 400;
    var MIN_ACTIONS_WIDTH = PAGE === 'fornecedores' ? 150 : 120;
    var SAVE_DEBOUNCE_MS = 400;
    var DEFAULTS = {
        'Nome': 200,
        'Cidade': 130,
        'Estado': 80,
        'Telefone': 140,
        'Email': 200,
        'CNPJ': 170,
        'Ações': MIN_ACTIONS_WIDTH
    };

    var widthsCache = null;
    var saveTimer = null;
    var initialized = false;

    function resolveUid() {
        try {
            if (window.firebaseAuthUser && window.firebaseAuthUser.uid) return String(window.firebaseAuthUser.uid);
            if (window.firebaseService && window.firebaseService.authService && typeof window.firebaseService.authService.getAuth === 'function') {
                var user = window.firebaseService.authService.getAuth().currentUser;
                if (user && user.uid) return String(user.uid);
            }
            var raw = localStorage.getItem('currentUser') || localStorage.getItem('persistentUser');
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

    function buildPath() {
        var uid = resolveUid();
        var tenant = resolveTenant();
        var base = 'users/' + uid + '/preferences/';
        if (PAGE === 'fornecedores') {
            return base + 'fornecedorListColumns/' + tenant;
        }
        return base + 'clientListColumns/' + tenant + '/' + PAGE;
    }

    function localStorageKey() {
        var feature = PAGE === 'fornecedores' ? 'fornecedorListColumns' : 'clientListColumns';
        var suffix = PAGE === 'fornecedores' ? '' : '_' + PAGE;
        return 'sisweb_' + feature + '_' + resolveTenant() + '_' + resolveUid() + suffix;
    }

    function contract() {
        return CONTRACT_BY_PAGE[PAGE] || CONTRACT_BY_PAGE.pct;
    }

    function clamp(value, min, max) {
        var n = Math.round(Number(value));
        if (!isFinite(n)) return null;
        return Math.max(min, Math.min(max, n));
    }

    function sanitize(raw) {
        var clean = {};
        if (!raw || typeof raw !== 'object') return clean;
        contract().forEach(function (label) {
            var min = label === 'Ações' ? MIN_ACTIONS_WIDTH : MIN_WIDTH;
            var px = clamp(raw[label], min, MAX_WIDTH);
            if (px !== null) clean[label] = px;
        });
        return clean;
    }

    function saveLocal(clean) {
        try {
            localStorage.setItem(localStorageKey(), JSON.stringify(clean));
        } catch (_) {}
    }

    function remoteSave(clean) {
        var path = buildPath();
        var svc = window.firebaseService;
        if (svc && typeof svc.saveToFirebase === 'function') {
            return svc.saveToFirebase(path, null, clean).catch(function (e) {
                console.error('client-list-columns: falha ao salvar remoto', e);
            });
        }
        if (svc && typeof svc.saveData === 'function') {
            return svc.saveData(path, clean).catch(function (e) {
                console.error('client-list-columns: falha ao salvar remoto', e);
            });
        }
        return Promise.resolve();
    }

    function scheduleSave(clean) {
        saveLocal(clean);
        widthsCache = clean;
        if (resolveUid() === 'anon') return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            remoteSave(clean);
        }, SAVE_DEBOUNCE_MS);
    }

    function loadRemote() {
        var path = buildPath();
        var svc = window.firebaseService;
        var loader = (svc && typeof svc.loadFromFirebase === 'function') ? svc.loadFromFirebase.bind(svc) : null;
        if (!loader) return Promise.resolve(null);
        return loader(path).then(function (result) {
            var data = (result && result.success && result.data) ? result.data : result;
            var clean = sanitize(data);
            if (Object.keys(clean).length > 0) saveLocal(clean);
            return clean;
        }).catch(function () {
            return null;
        });
    }

    function getWidthsSync() {
        if (widthsCache) return widthsCache;
        try {
            var raw = localStorage.getItem(localStorageKey());
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    widthsCache = sanitize(parsed);
                    return widthsCache;
                }
            }
        } catch (_) {}
        widthsCache = {};
        return widthsCache;
    }

    function applyWidths(table, clean) {
        if (!table || !clean) return;
        var headers = table.querySelectorAll('thead th');
        contract().forEach(function (label, index) {
            if (index >= headers.length || !clean[label]) return;
            headers[index].style.width = clean[label] + 'px';
        });
        if (Object.keys(clean).length > 0) table.classList.add('clc-fixed');
    }

    function attachResize(table) {
        var headers = table.querySelectorAll('thead th');
        for (let index = 0; index < headers.length; index++) {
            let th = headers[index];
            if (th.__clcAttached) continue;
            th.__clcAttached = true;
            let handle = document.createElement('div');
            handle.className = 'clc-handle';
            handle.title = 'Arraste para ajustar a largura';
            th.appendChild(handle);
            handle.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var label = contract()[index] || '';
                var min = label === 'Ações' ? MIN_ACTIONS_WIDTH : MIN_WIDTH;
                var startX = e.clientX;
                var startWidth = th.getBoundingClientRect().width;
                th.classList.add('clc-resizing');
                try {
                    handle.setPointerCapture(e.pointerId);
                } catch (_) {}
                function onMove(ev) {
                    var width = clamp(startWidth + (ev.clientX - startX), min, MAX_WIDTH);
                    th.style.width = width + 'px';
                    table.classList.add('clc-fixed');
                    th.title = width + 'px';
                }
                function onUp() {
                    th.classList.remove('clc-resizing');
                    handle.removeEventListener('pointermove', onMove);
                    handle.removeEventListener('pointerup', onUp);
                    handle.removeEventListener('pointercancel', onUp);
                    var clean = {};
                    var headersNow = table.querySelectorAll('thead th');
                    contract().forEach(function (labelNow, idx) {
                        if (idx < headersNow.length && headersNow[idx].style.width) {
                            var px = parseInt(headersNow[idx].style.width, 10);
                            clean[labelNow] = clamp(px, labelNow === 'Ações' ? MIN_ACTIONS_WIDTH : MIN_WIDTH, MAX_WIDTH);
                        }
                    });
                    scheduleSave(sanitize(clean));
                }
                handle.addEventListener('pointermove', onMove);
                handle.addEventListener('pointerup', onUp);
                handle.addEventListener('pointercancel', onUp);
            });
        }
    }

    function injectStyles() {
        if (document.getElementById('clc-styles')) return;
        var style = document.createElement('style');
        style.id = 'clc-styles';
        style.textContent = '.client-list-cols th{position:relative;}.clc-handle{position:absolute;top:0;right:-4px;width:8px;height:100%;cursor:col-resize;touch-action:none;user-select:none;-webkit-user-select:none;}.clc-handle:hover{background:rgba(0,0,0,.12);}.client-list-cols.clc-fixed{table-layout:fixed;width:auto;}.clc-resizing th{user-select:none;}.clc-resizing{cursor:col-resize;}';
        document.head.appendChild(style);
    }

    function init() {
        if (initialized || !PAGE || !TARGET) return;
        var table = null;
        function setup() {
            if (table) return true;
            var tbody = document.getElementById(TARGET);
            if (!tbody) return false;
            table = tbody.closest('table');
            if (!table) return false;
            injectStyles();
            table.classList.add('client-list-cols');
            var clean = getWidthsSync();
            if (Object.keys(clean).length > 0) applyWidths(table, clean);
            attachResize(table);
            if (resolveUid() !== 'anon') {
                loadRemote().then(function (remote) {
                    if (remote && Object.keys(remote).length > 0 && table) {
                        widthsCache = remote;
                        applyWidths(table, remote);
                    }
                });
            }
            return true;
        }
        if (!setup()) {
            var observer = new MutationObserver(function () {
                if (setup()) observer.disconnect();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.ClientListColumns = {
        buildPath: buildPath,
        sanitize: sanitize,
        getWidths: getWidthsSync,
        save: scheduleSave,
        apply: applyWidths,
        attach: attachResize,
        init: init
    };
})();
