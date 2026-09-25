/* Sisweb — gerenciador global de tema (Claro / Escuro / Sistema).
    Fonte: styles/sisweb-tokens.css. Persistência: localStorage "sisweb:theme".
    Fase 19: espelha no banco (companies/{tenant}/ui/theme) quando há tenant
    autenticado — localStorage continua o cache síncrono (first paint nunca
    espera rede; tudo fail-open). Sem imports e sem backend obrigatório. */
(function () {
  'use strict';

  var STORAGE_KEY = 'sisweb:theme';
  var THEME_EVENT = 'sisweb:theme-change';
  var MODES = ['light', 'dark', 'system'];
  var DEFAULT_MODE = 'dark';

  function getStoredMode() {
    try {
      var value = localStorage.getItem(STORAGE_KEY);
      return MODES.indexOf(value) !== -1 ? value : DEFAULT_MODE;
    } catch (_) {
      return DEFAULT_MODE;
    }
  }

  function prefersLight() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  }

  function resolveEffective(mode) {
    if (mode === 'system') return prefersLight() ? 'light' : 'dark';
    return mode;
  }

  function currentMode() {
    return document.documentElement.getAttribute('data-theme-mode') || getStoredMode();
  }

  function syncMeta(effective) {
    try {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', effective === 'light' ? '#f8f9fa' : '#121417');
    } catch (_) {}
  }

  function syncMenuOptions(mode) {
    try {
      var options = document.querySelectorAll('[data-theme-option]');
      options.forEach(function (el) {
        var active = el.getAttribute('data-theme-option') === mode;
        el.setAttribute('aria-checked', active ? 'true' : 'false');
        el.classList.toggle('is-active', active);
      });
    } catch (_) {}
  }

  function apply(mode, persist) {
    var safe = MODES.indexOf(mode) !== -1 ? mode : DEFAULT_MODE;
    var effective = resolveEffective(safe);
    document.documentElement.setAttribute('data-theme', effective);
    document.documentElement.setAttribute('data-theme-mode', safe);
    if (persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, safe); } catch (_) {}
    }
    syncMeta(effective);
    syncMenuOptions(safe);
    if (persist !== false) scheduleCloudSave();
    try {
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { mode: safe, effective: effective } }));
    } catch (_) {}
    return { mode: safe, effective: effective };
  }

  function bindMenuClicks() {
    document.addEventListener('click', function (event) {
      var target = event.target && event.target.closest
        ? event.target.closest('[data-theme-option]')
        : null;
      if (!target) return;
      event.preventDefault();
      var option = target.getAttribute('data-theme-option');
      if (option === 'config') {
        openThemeSettings();
        return;
      }
      apply(option);
    });
  }

  function bindSystemChanges() {
    try {
      var media = window.matchMedia('(prefers-color-scheme: light)');
      var onChange = function () {
        if (currentMode() === 'system') apply('system', false);
      };
      if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
      else if (typeof media.addListener === 'function') media.addListener(onChange);
    } catch (_) {}
  }

  function observeLateMenu() {
    try {
      var observer = new MutationObserver(function () { syncMenuOptions(currentMode()); });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      window.setTimeout(function () { observer.disconnect(); syncMenuOptions(currentMode()); }, 10000);
    } catch (_) {}
  }

  /* ===== Personalização de cores (Fase 16: Configurações) ===== */
  var CUSTOM_KEY = 'sisweb:theme:custom';

  var CUSTOM_VARS = [
    { key: '--sw-brand', label: 'Marca', affects: 'Botões primários, item ativo do menu, abas ativas, foco',
      light: '#fe6a00', dark: '#fe6a00' },
    { key: '--sw-link', label: 'Links', affects: 'Fale Conosco, links de ajuda e mensagens',
      light: '#c83818', dark: '#ff7a45' },
    { key: '--sw-bg', label: 'Fundo', affects: 'Canvas de todas as páginas',
      light: '#f8f9fa', dark: '#121417' },
    { key: '--sw-surface', label: 'Superfícies', affects: 'Cards, modais, tabelas, dropdowns, painéis',
      light: '#ffffff', dark: '#1e2228' },
    { key: '--sw-text-1', label: 'Textos', affects: 'Títulos, valores, conteúdo principal',
      light: '#111827', dark: '#f2ede4' },
    { key: '--sw-success', label: 'Sucesso', affects: 'Pagos, saldos positivos, confirmações',
      light: '#16a34a', dark: '#16a34a' },
    { key: '--sw-warning', label: 'Atenção', affects: 'Pendentes, avisos, trials, rascunhos',
      light: '#f59e0b', dark: '#f59e0b' },
    { key: '--sw-danger', label: 'Perigo', affects: 'Excluir, cancelar, vencidos, erros',
      light: '#dc2626', dark: '#dc2626' },
    { key: '--sw-info', label: 'Informativo', affects: 'Dicas, ajuda, badges de informação',
      light: '#2563eb', dark: '#2563eb' },
    { key: '--sw-chrome-bg', label: 'Menu do topo', affects: 'Fundo do menu do topo, painel de mensagens do sininho e dropdown da engrenagem',
      light: '#ffffff', dark: '#1e2228' },
    { key: '--sw-label', label: 'Etiquetas', affects: 'Rótulos de campos, filtros e cartões do dashboard, finanças, compras e vendas',
      light: '#4b5563', dark: '#c7cfd6' }
  ];

  function getCustomTheme() {
    try {
      var raw = localStorage.getItem(CUSTOM_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return { light: {}, dark: {} };
      return {
        light: parsed.light && typeof parsed.light === 'object' ? parsed.light : {},
        dark: parsed.dark && typeof parsed.dark === 'object' ? parsed.dark : {}
      };
    } catch (_) {
      return { light: {}, dark: {} };
    }
  }

  function saveCustomTheme(custom) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom)); } catch (_) {}
  }

  function themeDefault(key, theme) {
    for (var i = 0; i < CUSTOM_VARS.length; i++) {
      if (CUSTOM_VARS[i].key === key) return CUSTOM_VARS[i][theme] || CUSTOM_VARS[i].dark;
    }
    return '';
  }

  function applyCustomTheme() {
    var effective = document.documentElement.getAttribute('data-theme') || 'dark';
    var theme = effective === 'light' ? 'light' : 'dark';
    var custom = getCustomTheme()[theme] || {};
    var root = document.documentElement;
    for (var i = 0; i < CUSTOM_VARS.length; i++) {
      var key = CUSTOM_VARS[i].key;
      if (custom[key]) root.style.setProperty(key, custom[key]);
      else root.style.removeProperty(key);
    }
  }

  function setCustomVar(key, value, theme) {
    var effective = document.documentElement.getAttribute('data-theme') || 'dark';
    var target = theme === 'light' || theme === 'dark' ? theme : (effective === 'light' ? 'light' : 'dark');
    var custom = getCustomTheme();
    var def = themeDefault(key, target);
    if (!value || String(value).toLowerCase() === String(def).toLowerCase()) delete custom[target][key];
    else custom[target][key] = String(value);
    saveCustomTheme(custom);
    applyCustomTheme();
    scheduleCloudSave();
  }

  function resetCustomVars(theme) {
    var custom = getCustomTheme();
    if (theme === 'light' || theme === 'dark') custom[theme] = {};
    else { custom.light = {}; custom.dark = {}; }
    saveCustomTheme(custom);
    applyCustomTheme();
    scheduleCloudSave();
  }

  function shiftLightness(hex, delta) {
    var h = String(hex || '').replace('#', '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return hex;
    var r = parseInt(h.slice(0, 2), 16) / 255;
    var g = parseInt(h.slice(2, 4), 16) / 255;
    var b = parseInt(h.slice(4, 6), 16) / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, s = 0, hh = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) hh = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
      hh *= 60;
    }
    l = Math.min(0.96, Math.max(0.04, l + delta / 100));
    var c2 = (1 - Math.abs(2 * l - 1)) * s;
    var x = c2 * (1 - Math.abs(((hh / 60) % 2) - 1));
    var m = l - c2 / 2, rr = 0, gg = 0, bb = 0;
    if (hh < 60) { rr = c2; gg = x; }
    else if (hh < 120) { rr = x; gg = c2; }
    else if (hh < 180) { gg = c2; bb = x; }
    else if (hh < 240) { gg = x; bb = c2; }
    else if (hh < 300) { rr = x; bb = c2; }
    else { rr = c2; bb = x; }
    var to = (v) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return '#' + to(rr) + to(gg) + to(bb);
  }

  var settingsTarget = 'dark';

  function openThemeSettings() {
    var effective = document.documentElement.getAttribute('data-theme') || 'dark';
    settingsTarget = effective === 'light' ? 'light' : 'dark';
    var existing = document.getElementById('siswebThemeModal');
    if (existing) { existing.remove(); }
    var overlay = document.createElement('div');
    overlay.id = 'siswebThemeModal';
    overlay.className = 'sw-theme-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Configurações de Tema');
    var rows = CUSTOM_VARS.map(function (v, i) {
      return '<div class="sw-theme-row" data-var="' + v.key + '">'
        + '<div class="sw-theme-row-head"><strong>' + v.label + '</strong>'
        + '<button type="button" class="sw-theme-reset" data-reset="' + i + '" title="Restaurar padrão">↺</button></div>'
        + '<div class="sw-theme-affects">' + v.affects + '</div>'
        + '<div class="sw-theme-controls">'
        + '<input type="color" data-picker="' + i + '" value="' + v[settingsTarget] + '" aria-label="Cor ' + v.label + '">'
        + '<input type="range" min="-40" max="40" step="1" value="0" data-shade="' + i + '" aria-label="Suavizar ou escurecer ' + v.label + '">'
        + '<span class="sw-theme-hex" data-hex="' + i + '">' + v[settingsTarget] + '</span>'
        + '</div></div>';
    }).join('');
    overlay.innerHTML = '<div class="sw-theme-dialog">'
      + '<div class="sw-theme-dialog-head"><h2>Configurações de Tema</h2>'
      + '<button type="button" class="sw-theme-close" aria-label="Fechar">×</button></div>'
      + '<div class="sw-theme-tabs" role="tablist">'
      + '<button type="button" class="sw-theme-tab' + (settingsTarget === 'light' ? ' active' : '') + '" data-target="light">Claro</button>'
      + '<button type="button" class="sw-theme-tab' + (settingsTarget === 'dark' ? ' active' : '') + '" data-target="dark">Escuro</button>'
      + '</div>'
      + '<p class="sw-theme-hint">Ajuste cada cor e use a barra para suavizar ou escurecer. Vale para o tema selecionado acima e é salvo neste navegador.</p>'
      + '<div class="sw-theme-rows">' + rows + '</div>'
      + '<div class="sw-theme-foot">'
      + '<button type="button" class="sw-theme-reset-all">Restaurar padrão</button>'
      + '<button type="button" class="sw-theme-done">Concluir</button>'
      + '</div></div>';
    document.body.appendChild(overlay);
    syncSettingsValues();
    overlay.addEventListener('click', function (event) {
      var t = event.target;
      var closest = function (sel) { return t && t.closest ? t.closest(sel) : null; };
      if (t === overlay || closest('.sw-theme-close') || closest('.sw-theme-done')) {
        overlay.remove();
        return;
      }
      var tab = closest('.sw-theme-tab');
      if (tab) {
        settingsTarget = tab.getAttribute('data-target') === 'light' ? 'light' : 'dark';
        overlay.querySelectorAll('.sw-theme-tab').forEach(function (el) {
          el.classList.toggle('active', el === tab);
        });
        syncSettingsValues();
        return;
      }
      if (closest('.sw-theme-reset-all')) {
        resetCustomVars(settingsTarget);
        syncSettingsValues();
        return;
      }
      var resetBtn = closest('.sw-theme-reset');
      if (resetBtn) {
        var idx = +resetBtn.getAttribute('data-reset');
        setCustomVar(CUSTOM_VARS[idx].key, '', settingsTarget);
        syncSettingsValues();
      }
    });
    overlay.addEventListener('input', function (event) {
      var t = event.target;
      if (!t || !t.getAttribute) return;
      var pi = t.getAttribute('data-picker');
      var si = t.getAttribute('data-shade');
      if (pi !== null && pi !== undefined && pi !== '') {
        var v = CUSTOM_VARS[+pi];
        setCustomVar(v.key, t.value, settingsTarget);
        var hex = overlay.querySelector('[data-hex="' + pi + '"]');
        if (hex) hex.textContent = t.value;
        var shade = overlay.querySelector('[data-shade="' + pi + '"]');
        if (shade) shade.value = '0';
        return;
      }
      if (si !== null && si !== undefined && si !== '') {
        var v2 = CUSTOM_VARS[+si];
        var base = (getCustomTheme()[settingsTarget] || {})[v2.key] || v2[settingsTarget];
        var next = shiftLightness(base, +t.value);
        setCustomVar(v2.key, next, settingsTarget);
        var picker = overlay.querySelector('[data-picker="' + si + '"]');
        if (picker) picker.value = next;
        var hex2 = overlay.querySelector('[data-hex="' + si + '"]');
        if (hex2) hex2.textContent = next;
      }
    });
    function syncSettingsValues() {
      var custom = getCustomTheme()[settingsTarget] || {};
      CUSTOM_VARS.forEach(function (v, i) {
        var current = custom[v.key] || v[settingsTarget];
        var picker = overlay.querySelector('[data-picker="' + i + '"]');
        if (picker) picker.value = current;
        var hex = overlay.querySelector('[data-hex="' + i + '"]');
        if (hex) hex.textContent = current;
        var shade = overlay.querySelector('[data-shade="' + i + '"]');
        if (shade) shade.value = '0';
      });
    }
  }

  window.SiswebTheme = {
    get: currentMode,
    getEffective: function () {
      return document.documentElement.getAttribute('data-theme') || resolveEffective(currentMode());
    },
    set: function (mode) { return apply(mode); },
    toggle: function () {
      return apply(resolveEffective(currentMode()) === 'dark' ? 'light' : 'dark');
    },
    onChange: function (callback) {
      window.addEventListener(THEME_EVENT, function (event) { callback(event.detail); });
    },
    getCustom: getCustomTheme,
    setCustom: setCustomVar,
    resetCustom: resetCustomVars,
    openSettings: openThemeSettings,
    cloudSync: function () { cloudLoadNow(); return true; }
  };

  /* ===== Tema por tenant (Fase 19: companies/{tenant}/ui/theme no RTDB) =====
     localStorage = cache síncrono (first paint nunca espera rede).
     Nuvem = convergência entre navegador/dispositivos (last-write-wins por
     updatedAt). Tudo fail-open: sem tenant, sem svc ou offline, só o local vale.
     Superadmin sem tenant usa só o local (nunca escreve nó de tenant). */
  var CLOUD_TS_KEY = 'sisweb:theme:updatedAt';
  var cloudTimer = null;

  function readTenantId() {
    try {
      if (window.appTenantId && String(window.appTenantId).trim()) return String(window.appTenantId).trim();
      var raw = null;
      try { raw = localStorage.getItem('company_info'); } catch (_) {}
      if (raw) {
        var info = JSON.parse(raw);
        var id = info && (info.id || info.companyId || info.tenantId);
        if (id && String(id).trim()) return String(id).trim();
      }
      if (window.companyInfo) {
        var c = window.companyInfo;
        var id2 = c.id || c.companyId || c.tenantId;
        if (id2 && String(id2).trim()) return String(id2).trim();
      }
    } catch (_) {}
    return '';
  }

  function readAuthUid() {
    try {
      var raw = null;
      try { raw = localStorage.getItem('company_info'); } catch (_) {}
      if (raw) {
        var info = JSON.parse(raw);
        if (info && info._authUid) return String(info._authUid);
      }
    } catch (_) {}
    return '';
  }

  function cloudSvc() {
    try { return window.firebaseService || window.firebaseServiceTL || window.FirebaseService || null; } catch (_) { return null; }
  }

  function sanitizeCloudTheme(data) {
    if (!data || typeof data !== 'object') return null;
    var out = { mode: null, custom: { light: {}, dark: {} }, updatedAt: 0 };
    if (data.mode === 'light' || data.mode === 'dark' || data.mode === 'system') out.mode = data.mode;
    var ts = Number(data.updatedAt);
    if (isFinite(ts) && ts > 0) out.updatedAt = ts;
    ['light', 'dark'].forEach(function (t) {
      var src = data.custom && data.custom[t];
      if (!src || typeof src !== 'object') return;
      for (var i = 0; i < CUSTOM_VARS.length; i++) {
        var key = CUSTOM_VARS[i].key;
        var v = src[key];
        if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim())) out.custom[t][key] = v.trim().toLowerCase();
      }
    });
    return out;
  }

  function scheduleCloudSave() {
    try {
      if (cloudTimer) clearTimeout(cloudTimer);
      cloudTimer = setTimeout(cloudSaveNow, 1500);
    } catch (_) {}
  }

  async function cloudSaveNow() {
    try {
      var tid = readTenantId();
      var svc = cloudSvc();
      if (!tid || !svc) return;
      var payload = { mode: currentMode(), custom: getCustomTheme(), updatedAt: Date.now() };
      var uid = readAuthUid();
      if (uid) payload.updatedBy = uid;
      var res = null;
      /* updatePaths (batch atômico) quando existir; senão saveToFirebase. */
      try {
        if (typeof svc.updatePaths === 'function') res = await svc.updatePaths({ 'ui/theme': payload });
        else if (typeof svc.saveToFirebase === 'function') res = await svc.saveToFirebase('ui/theme', null, payload);
      } catch (e) {
        res = { success: false, error: String((e && e.message) || e).slice(0, 160) };
      }
      if (res && res.success) {
        try { localStorage.setItem(CLOUD_TS_KEY, String(payload.updatedAt)); } catch (_) {}
      }
    } catch (_) {}
  }

  async function cloudLoadNow() {
    try {
      var tid = readTenantId();
      var svc = cloudSvc();
      if (!tid || !svc || typeof svc.loadFromFirebase !== 'function') return;
      var res = await svc.loadFromFirebase('ui/theme');
      var raw = res && res.data !== undefined ? res.data : res;
      var clean = sanitizeCloudTheme(raw);
      if (!clean) return;
      var hasCloudCustom = Object.keys(clean.custom.light).length > 0 || Object.keys(clean.custom.dark).length > 0;
      if (!clean.mode && !hasCloudCustom) return;
      var localTs = 0;
      try { localTs = Number(localStorage.getItem(CLOUD_TS_KEY)) || 0; } catch (_) {}
      var localMode = null;
      try { localMode = localStorage.getItem(STORAGE_KEY); } catch (_) {}
      var localHasCustom = false;
      try { localHasCustom = !!localStorage.getItem(CUSTOM_KEY); } catch (_) {}
      if (clean.updatedAt > localTs || (!localMode && !localHasCustom)) {
        if (clean.mode) apply(clean.mode);
        var merged = getCustomTheme();
        ['light', 'dark'].forEach(function (t) {
          Object.keys(clean.custom[t]).forEach(function (k) { merged[t][k] = clean.custom[t][k]; });
        });
        saveCustomTheme(merged);
        applyCustomTheme();
        try { localStorage.setItem(CLOUD_TS_KEY, String(clean.updatedAt || Date.now())); } catch (_) {}
      } else {
        scheduleCloudSave();
      }
    } catch (_) {}
  }

  function bootCloudSync() {
    var attempts = 0;
    var tick = function () {
      attempts++;
      try {
        if (readTenantId() && cloudSvc()) { cloudLoadNow(); return; }
      } catch (_) {}
      if (attempts < 12) {
        try { setTimeout(tick, 2500); } catch (_) {}
      }
    };
    try { setTimeout(tick, 1500); } catch (_) {}
    try {
      window.addEventListener('tenantContextReady', function () {
        try { setTimeout(cloudLoadNow, 500); } catch (_) {}
      });
    } catch (_) {}
    try {
      window.addEventListener('storage', function (event) {
        try {
          if (event && (event.key === STORAGE_KEY || event.key === CUSTOM_KEY)) {
            apply(getStoredMode(), false);
            applyCustomTheme();
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  apply(getStoredMode(), false);
  applyCustomTheme();
  bindMenuClicks();
  bindSystemChanges();
  bootCloudSync();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      syncMenuOptions(currentMode());
      observeLateMenu();
    });
  } else {
    syncMenuOptions(currentMode());
    observeLateMenu();
  }
})();
