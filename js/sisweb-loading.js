/**
 * SiswebLoading — overlay global único de loading (E0 do plano de rollout).
 *
 * Uso: SiswebLoading.show('Salvando pedido...') ... try/finally ... SiswebLoading.hide()
 * - Cria overlay + CSS sob demanda (uma vez por página; nunca duplica).
 * - Contador de reentrância: ops aninhadas (save → refresh) não piscam;
 *   hide() só oculta quando balanceado. hide(true) força reset (catch-all).
 * - Não auto-executa nada no load; não depende de ToastManager nem de CSS externo
 *   (as regras espelham layout-comum.css para visual idêntico onde ele existe).
 */
(function () {
    'use strict';

    var OVERLAY_ID = 'globalLoadingOverlay';
    var STYLE_ID = 'sisweb-loading-style';

    var CSS = ''
        + '#' + OVERLAY_ID + '{position:fixed;top:0;left:0;width:100%;height:100%;'
        + 'background:rgba(255,255,255,0.9);display:none;justify-content:center;'
        + 'align-items:center;z-index:99999;backdrop-filter:blur(2px);}'
        + '#' + OVERLAY_ID + '.active{display:flex;}'
        + 'html[data-theme="dark"] #' + OVERLAY_ID + '{background:rgba(0,0,0,0.7);}'
        + '#' + OVERLAY_ID + ' .loading-content{background:var(--sw-surface,#fff);padding:30px;border-radius:12px;'
        + 'text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.1);border:1px solid var(--sw-border,#f0f0f0);}'
        + '#' + OVERLAY_ID + ' .loading-spinner{width:50px;height:50px;border:4px solid #f3f3f3;'
        + 'border-top:4px solid #3498db;border-radius:50%;'
        + 'animation:sisweb-loading-spin 1s linear infinite;margin:0 auto 15px auto;}'
        + '#' + OVERLAY_ID + ' .loading-text{color:var(--sw-text-1,#111);font-size:14px;}'
        + '@keyframes sisweb-loading-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}';

    var depth = 0;

    function ensureStyle() {
        try {
            if (document.getElementById(STYLE_ID)) return;
            var st = document.createElement('style');
            st.id = STYLE_ID;
            st.textContent = CSS;
            document.head.appendChild(st);
        } catch (_) {}
    }

    function ensureOverlay() {
        var overlay = document.getElementById(OVERLAY_ID);
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.className = 'loading-overlay';
        overlay.style.display = 'none';
        var content = document.createElement('div');
        content.className = 'loading-content';
        var spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        var text = document.createElement('div');
        text.className = 'loading-text';
        text.textContent = 'Carregando...';
        content.appendChild(spinner);
        content.appendChild(text);
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        return overlay;
    }

    function show(texto) {
        try {
            ensureStyle();
            var overlay = ensureOverlay();
            var textEl = overlay.querySelector('.loading-text');
            if (textEl) textEl.textContent = String(texto || 'Carregando...');
            depth += 1;
            overlay.style.display = 'flex';
            if (overlay.classList) overlay.classList.add('active');
        } catch (_) {}
    }

    function hide(force) {
        try {
            if (force === true) {
                depth = 0;
            } else {
                depth = Math.max(0, depth - 1);
            }
            if (depth !== 0) return;
            var overlay = document.getElementById(OVERLAY_ID);
            if (!overlay) return;
            if (overlay.classList) overlay.classList.remove('active');
            overlay.style.display = 'none';
        } catch (_) {}
    }

    try {
        window.SiswebLoading = {
            show: show,
            hide: hide,
            getDepth: function () { return depth; }
        };
    } catch (_) {}
})();
