/* SisWeb NotificationService — feedback visual único (Onda A, 2026-10-10).
 * Script clássico (sem ESM): carregado em todas as páginas via menu-component.js.
 * API:
 *   NotificationService.show(message, type, opts)
 *   NotificationService.success|warning|error|info(message, opts)
 *   confirmDialog({ title, message, confirmLabel, cancelLabel, danger }) -> Promise<boolean>
 * Compat: define window.__toast se ausente. NAO sobrescreve o popup nativo (Onda F).
 * Cores SOMENTE via tokens var(--sw-*) com fallback hardcoded.
 */
(function initSiswebNotifications() {
    'use strict';
    if (typeof window === 'undefined') return;
    if (window.NotificationService && typeof window.NotificationService.show === 'function') return;

    var TYPES = ['success', 'warning', 'error', 'info'];
    var DURATIONS = { success: 3000, info: 3000, warning: 4000, error: 6000 };
    var TITLES = { success: 'Sucesso', warning: 'Atenção', error: 'Erro', info: 'Informação' };
    var ICONS = {
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    var MAX_TOASTS = 4;
    var DEDUPE_MS = 500;
    var lastMsg = '';
    var lastAt = 0;

    function ensureStyles() {
        if (document.getElementById('sw-notify-styles')) return;
        var css = [
            '#sw-toast-container{position:fixed;top:16px;right:16px;z-index:10000000;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:min(420px,calc(100vw - 32px));}',
            '.sw-toast{display:flex;align-items:flex-start;gap:10px;pointer-events:auto;color:#fff;padding:10px 12px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.25);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;animation:swToastIn .18s ease-out;}',
            '.sw-toast-success{background:var(--sw-success,#16a34a);}',
            '.sw-toast-warning{background:var(--sw-warning,#f59e0b);}',
            '.sw-toast-error{background:var(--sw-danger,#dc2626);}',
            '.sw-toast-info{background:var(--sw-info,#2563eb);}',
            '.sw-toast-icon{font-size:16px;line-height:1.4;}',
            '.sw-toast-body{flex:1;min-width:0;}',
            '.sw-toast-title{font-weight:700;font-size:13px;}',
            '.sw-toast-message{overflow-wrap:anywhere;white-space:pre-line;}',
            '.sw-toast-close{background:transparent;border:0;color:#fff;font-size:16px;line-height:1;cursor:pointer;padding:0 0 0 4px;opacity:.85;}',
            '.sw-toast-close:hover{opacity:1;}',
            '@keyframes swToastIn{from{opacity:0;transform:translateY(-6px);}to{opacity:1;transform:none;}}',
            '#sw-confirm-overlay{position:fixed;inset:0;z-index:10000001;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;}',
            '#sw-confirm-box{background:var(--sw-surface,#fff);color:inherit;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);max-width:440px;width:100%;padding:20px;}',
            '#sw-confirm-box h3{margin:0 0 8px;font-size:16px;display:flex;align-items:center;gap:8px;}',
            '#sw-confirm-box p{margin:0 0 18px;font-size:14px;line-height:1.5;}',
            '#sw-confirm-actions{display:flex;justify-content:flex-end;gap:10px;}',
            '#sw-confirm-actions button{border:0;border-radius:8px;padding:9px 16px;font-size:14px;font-weight:600;cursor:pointer;}',
            '#sw-confirm-cancel{background:transparent;border:1px solid #cbd5e1 !important;}',
            '#sw-confirm-ok{background:var(--sw-info,#2563eb);color:#fff;}',
            '#sw-confirm-ok.danger{background:var(--sw-danger,#dc2626);}',
            '@media (max-width:600px){#sw-toast-container{top:auto;bottom:12px;left:12px;right:12px;max-width:none;}}'
        ].join('\n');
        var el = document.createElement('style');
        el.id = 'sw-notify-styles';
        el.textContent = css;
        document.head.appendChild(el);
    }

    function ensureContainer() {
        var c = document.getElementById('sw-toast-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'sw-toast-container';
            c.setAttribute('role', 'status');
            c.setAttribute('aria-live', 'polite');
            document.body.appendChild(c);
        }
        return c;
    }

    function show(message, type, opts) {
        try {
            ensureStyles();
            var safeType = TYPES.indexOf(type) !== -1 ? type : 'info';
            var text = String(message == null ? '' : message).trim();
            if (!text) return;
            var now = Date.now();
            if (text === lastMsg && now - lastAt < DEDUPE_MS) return;
            lastMsg = text;
            lastAt = now;

            var c = ensureContainer();
            while (c.children.length >= MAX_TOASTS) {
                try { c.removeChild(c.firstElementChild); } catch (e) { break; }
            }

            var t = document.createElement('div');
            t.className = 'sw-toast sw-toast-' + safeType;
            t.setAttribute('role', 'status');

            var icon = document.createElement('span');
            icon.className = 'sw-toast-icon';
            var ie = document.createElement('i');
            ie.className = 'fas ' + ICONS[safeType];
            ie.setAttribute('aria-hidden', 'true');
            icon.appendChild(ie);

            var body = document.createElement('div');
            body.className = 'sw-toast-body';
            var title = document.createElement('div');
            title.className = 'sw-toast-title';
            title.textContent = (opts && opts.title) || TITLES[safeType];
            var msg = document.createElement('div');
            msg.className = 'sw-toast-message';
            msg.textContent = text;
            body.appendChild(title);
            body.appendChild(msg);

            var close = document.createElement('button');
            close.className = 'sw-toast-close';
            close.type = 'button';
            close.textContent = '×';
            close.setAttribute('aria-label', 'Fechar notificação');
            close.onclick = function () { try { t.remove(); } catch (e) {} };

            t.appendChild(icon);
            t.appendChild(body);
            t.appendChild(close);
            c.appendChild(t);

            var dflt = DURATIONS[safeType];
            var d = (opts && typeof opts.duration === 'number') ? opts.duration : dflt;
            if (d > 0) {
                setTimeout(function () { try { t.remove(); } catch (e) {} }, d);
            }
        } catch (e) { /* nunca quebrar a página por causa de toast */ }
    }

    function confirmDialog(options) {
        var o = options || {};
        return new Promise(function (resolve) {
            try {
                ensureStyles();
                var settled = false;
                function done(value) {
                    if (settled) return;
                    settled = true;
                    try { document.removeEventListener('keydown', onKey, true); } catch (e) {}
                    try { overlay.remove(); } catch (e) {}
                    resolve(value);
                }
                function onKey(ev) {
                    if (ev && ev.key === 'Escape') done(false);
                }

                var overlay = document.createElement('div');
                overlay.id = 'sw-confirm-overlay';
                var box = document.createElement('div');
                box.id = 'sw-confirm-box';
                box.setAttribute('role', 'alertdialog');
                box.setAttribute('aria-modal', 'true');

                var h = document.createElement('h3');
                var hi = document.createElement('i');
                hi.className = o.danger
                    ? 'fas fa-exclamation-triangle'
                    : 'fas fa-question-circle';
                hi.setAttribute('aria-hidden', 'true');
                h.appendChild(hi);
                h.appendChild(document.createTextNode(String(o.title || 'Confirmação')));

                var p = document.createElement('p');
                p.textContent = String(o.message || 'Deseja continuar?');

                var actions = document.createElement('div');
                actions.id = 'sw-confirm-actions';
                var btnCancel = document.createElement('button');
                btnCancel.id = 'sw-confirm-cancel';
                btnCancel.type = 'button';
                btnCancel.textContent = String(o.cancelLabel || 'Cancelar');
                btnCancel.onclick = function () { done(false); };
                var btnOk = document.createElement('button');
                btnOk.id = 'sw-confirm-ok';
                btnOk.type = 'button';
                if (o.danger) btnOk.className = 'danger';
                btnOk.textContent = String(o.confirmLabel || 'Confirmar');
                btnOk.onclick = function () { done(true); };

                actions.appendChild(btnCancel);
                actions.appendChild(btnOk);
                box.appendChild(h);
                box.appendChild(p);
                box.appendChild(actions);
                overlay.appendChild(box);
                overlay.addEventListener('click', function (ev) {
                    if (ev.target === overlay) done(false);
                });
                document.addEventListener('keydown', onKey, true);
                document.body.appendChild(overlay);
                try { btnCancel.focus(); } catch (e) {}
            } catch (e) {
                // Fail-closed: sem DOM nao ha confirmacao (nunca usa popup nativo).
                resolve(false);
            }
        });
    }

    var NotificationService = {
        show: show,
        success: function (msg, opts) { show(msg, 'success', opts); },
        warning: function (msg, opts) { show(msg, 'warning', opts); },
        error: function (msg, opts) { show(msg, 'error', opts); },
        info: function (msg, opts) { show(msg, 'info', opts); }
    };

    window.NotificationService = NotificationService;
    window.confirmDialog = window.confirmDialog || confirmDialog;
    // Compat: menu-component e páginas que esperam window.__toast passam a funcionar
    // mesmo onde modules/core/toast.js não foi importado.
    if (typeof window.__toast !== 'function' || String(window.__toast).indexOf('[native code]') !== -1) {
        window.__toast = function (message, type, opts) { show(message, type, opts); };
    }
})();
