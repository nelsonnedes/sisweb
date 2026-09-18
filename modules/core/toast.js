/**
 * 🍞 Toast Unificado — Sisweb
 * Módulo único para notificações toast em todo o sistema.
 * Substitui implementações duplicadas em login.html, romaneiotora.html, menu-component.js, etc.
 * 
 * Uso:
 *   import { toast } from './modules/core/toast.js';
 *   toast('Mensagem', 'success');
 *   toast.error('Erro!');
 *   toast.warning('Atenção!');
 *   toast.info('Info');
 * 
 * API global (compatibilidade):
 *   window.__toast(message, type, opts)
 *   window.alert(message)  // redireciona para toast
 */

const TOAST_CONFIG = {
    containerId: '__toast_container__',
    maxToasts: 4,
    dedupeMs: 500,
    durations: {
        error: 0,
        warning: 4000,
        success: 3000,
        info: 3000
    }
};

let lastMsg = '';
let lastAt = 0;

function ensureContainer() {
    let c = document.getElementById('__toast_container__');
    if (!c) {
        c = document.createElement('div');
        c.id = '__toast_container__';
        c.setAttribute('role', 'status');
        c.setAttribute('aria-live', 'polite');
        c.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;';
        document.body.appendChild(c);
    }
    return c;
}

function colorFor(type) {
    const colors = {
        error: '#b91c1c',
        success: '#15803d',
        warning: '#b45309',
        info: '#1e293b'
    };
    return colors[type] || colors.info;
}

function show(message, type = 'info', opts = {}) {
    try {
        const now = Date.now();
        const s = String(message || '');
        if (!s) return;
        if (s === lastMsg && now - lastAt < TOAST_CONFIG.dedupeMs) return;
        lastMsg = s;
        lastAt = now;

        const c = ensureContainer();
        while (c.children.length >= 4) {
            try { c.removeChild(c.firstElementChild); } catch (e) { break; }
        }

        const t = document.createElement('div');
        t.setAttribute('role', 'status');
        const bg = colorFor(type);
        t.style.cssText = `background:${bg};color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.25);font:14px/1.4 system-ui;max-width:420px;display:flex;align-items:center;gap:10px;pointer-events:auto;`;

        const txt = document.createElement('div');
        txt.textContent = s;
        txt.title = s;
        txt.style.cssText = 'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

        const close = document.createElement('button');
        close.textContent = '×';
        close.setAttribute('aria-label', 'Fechar');
        close.style.cssText = 'background:transparent;border:0;color:#fff;font-size:16px;line-height:1;cursor:pointer;';
        close.onclick = function() { try { c.removeChild(t); } catch(e) {} };

        t.appendChild(txt);
        t.appendChild(close);
        c.appendChild(t);

        const dDefault = TOAST_CONFIG.durations[type] || 3000;
        const d = (opts && typeof opts.duration === 'number') ? opts.duration : dDefault;
        if (d > 0) {
            setTimeout(function() { try { c.removeChild(t); } catch(e) {} }, d);
        }
    } catch (e) {}
}

// Expor API
const toast = {
    show,
    error: (msg, opts) => show(msg, 'error', opts),
    success: (msg, opts) => show(msg, 'success', opts),
    warning: (msg, opts) => show(msg, 'warning', opts),
    info: (msg, opts) => show(msg, 'info', opts)
};

// Instalar globalmente (compatibilidade)
if (typeof window !== 'undefined') {
    // Instalar __toast
    if (!window.__toast || typeof window.__toast !== 'function' || window.__toast.toString().includes('[native code]')) {
        window.__toast = function(message, type, opts) { show(message, type, opts); };
    }

    // Redirecionar window.alert para toast (apenas uma vez)
    if (!window.__siswebAlertOverridden) {
        const originalAlert = window.alert;
        window.alert = function(msg) {
            const m = String(msg || '');
            const lower = m.toLowerCase();
            let type = 'info';
            if (lower.includes('erro') || lower.includes('error') || lower.includes('❌')) type = 'error';
            else if (lower.includes('sucesso') || lower.includes('✅')) type = 'success';
            else if (lower.includes('selecione') || lower.includes('fornecedor') || lower.includes('aviso') || lower.includes('atenção') || lower.includes('atencao') || lower.includes('antes de') || lower.includes('confirme') || lower.includes('deseja')) type = 'warning';
            window.__toast(m, type);
        };
        window.__siswebAlertOverridden = true;
    }

    // Redirecionar Utils.showToast se existir
    try {
        if (window.Utils && typeof window.Utils.showToast === 'function') {
            window.Utils.showToast = function(message, type, opts) { window.__toast(message, type, opts); };
        }
    } catch (_) {}
}

// Exportar para módulos
export { toast, show };

export default toast;