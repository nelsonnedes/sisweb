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
    /* Fase 25 (V1/V2): reaplica os customs do tema efetivo SEMPRE — trocar
       Claro↔Escuro (ou virada do SO) nunca mais carrega tinta do outro tema. */
    applyCustomTheme();
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

  /* ===== Personalização de cores (Fase 16: Configurações; Fase 25: cobertura total milimétrica) ===== */
  var CUSTOM_KEY = 'sisweb:theme:custom';

  var CUSTOM_VARS = [
    // --- Marca & Identidade ---
    { category: 'brand', categoryLabel: 'Marca & Identidade',
      key: '--sw-brand', label: 'Cor da marca principal', affects: 'Botões primários, itens ativos do menu, abas selecionadas, foco e destaques',
      light: '#fe6a00', dark: '#fe6a00' },
    { category: 'brand', categoryLabel: 'Marca & Identidade',
      key: '--sw-brand-light', label: 'Marca (tom claro)', affects: 'Gradiente superior da marca, badges e realces secundários',
      light: '#ff7a45', dark: '#ff7a45' },
    { category: 'brand', categoryLabel: 'Marca & Identidade',
      key: '--sw-brand-dark', label: 'Marca (tom escuro)', affects: 'Gradiente inferior da marca, sombras e detalhes escuros',
      light: '#c83818', dark: '#c83818' },
    { category: 'brand', categoryLabel: 'Marca & Identidade',
      key: '--sw-brand-soft', label: 'Fundo suave da marca', affects: 'Fundo sutil de cards ativos, seleções e áreas promocionais',
      light: '#fff1e8', dark: '#2d1a0e' },
    { category: 'brand', categoryLabel: 'Marca & Identidade',
      key: '--sw-on-brand', label: 'Texto sobre a marca', affects: 'Texto sobre botões da marca, abas ativas, tags e páginas ativas',
      light: '#ffffff', dark: '#ffffff' },
    { category: 'brand', categoryLabel: 'Marca & Identidade',
      key: '--sw-focus', label: 'Foco do teclado', affects: 'Destaque e contorno visual dos campos ativos selecionados via teclado',
      light: '#fe6a00', dark: '#fe6a00' },

    // --- Superfícies & Estrutura ---
    { category: 'surface', categoryLabel: 'Superfícies & Estrutura',
      key: '--sw-bg', label: 'Fundo da página', affects: 'Canvas geral e fundo de todas as páginas do sistema',
      light: '#f8f9fa', dark: '#121417' },
    { category: 'surface', categoryLabel: 'Superfícies & Estrutura',
      key: '--sw-surface', label: 'Superfícies / Cards', affects: 'Cards de dados, modais, painéis, containers e tabelas',
      light: '#ffffff', dark: '#1e2228' },
    { category: 'surface', categoryLabel: 'Superfícies & Estrutura',
      key: '--sw-surface-2', label: 'Superfície secundária', affects: 'Linhas alternadas de tabelas, cabeçalhos e rodapés de modais',
      light: '#f3f4f6', dark: '#242b33' },
    { category: 'surface', categoryLabel: 'Superfícies & Estrutura',
      key: '--sw-border', label: 'Bordas e divisórias', affects: 'Linhas divisórias, contorno de cards, tabelas, modais e seções',
      light: '#e5e7eb', dark: '#2e353d' },
    { category: 'surface', categoryLabel: 'Superfícies & Estrutura',
      key: '--sw-hover', label: 'Realce ao passar o mouse', affects: 'Fundo ao passar o cursor em menus, tabelas, abas e botões',
      light: '#e9edf1', dark: '#242b33' },

    // --- Menu Superior & Navegação ---
    { category: 'navigation', categoryLabel: 'Menu Superior & Navegação',
      key: '--sw-chrome-bg', label: 'Fundo do menu superior', affects: 'Botões de ação dos alertas e menu mobile; a barra principal usa o gradiente da marca por padrão',
      light: '#ffffff', dark: '#1e2228' },
    { category: 'navigation', categoryLabel: 'Menu Superior & Navegação',
      key: '--sw-island-border', label: 'Borda do menu superior', affects: 'Bordas da barra do menu superior e dos dropdowns flutuantes',
      light: '#e5e7eb', dark: '#2e353d' },
    { category: 'navigation', categoryLabel: 'Menu Superior & Navegação',
      key: '--sw-island-ink', label: 'Títulos e destaques do menu', affects: 'Nome da empresa, usuário e títulos dentro do menu e dropdowns',
      light: '#111827', dark: '#f2ede4' },
    { category: 'navigation', categoryLabel: 'Menu Superior & Navegação',
      key: '--sw-island-muted', label: 'Texto dos itens do menu', affects: 'Itens normais do menu do topo e opções secundárias',
      light: '#6b7280', dark: '#c7cfd6' },
    { category: 'navigation', categoryLabel: 'Menu Superior & Navegação',
      key: '--sw-island-icon', label: 'Ícones do menu', affects: 'Ícones dos itens de menu, sininho e engrenagem de configurações',
      light: '#9ca3af', dark: '#8b949d' },
    { category: 'navigation', categoryLabel: 'Menu Superior & Navegação',
      key: '--sw-island-link', label: 'Links nos menus suspensos', affects: 'Links dentro do painel da engrenagem e menu rápido mobile',
      light: '#4b5563', dark: '#c7cfd6' },

    // --- Textos & Tipografia ---
    { category: 'typography', categoryLabel: 'Textos & Tipografia',
      key: '--sw-text-1', label: 'Texto principal / Títulos', affects: 'Títulos, valores financeiros de destaque e conteúdo principal',
      light: '#111827', dark: '#f2ede4' },
    { category: 'typography', categoryLabel: 'Textos & Tipografia',
      key: '--sw-text-2', label: 'Texto secundário', affects: 'Células das tabelas, descrições, resumos e parágrafos',
      light: '#4b5563', dark: '#c7cfd6' },
    { category: 'typography', categoryLabel: 'Textos & Tipografia',
      key: '--sw-text-3', label: 'Texto terciário / Dicas', affects: 'Textos explicativos pequenos, datas, dicas e ícones de apoio',
      light: '#6b7280', dark: '#8b949d' },
    { category: 'typography', categoryLabel: 'Textos & Tipografia',
      key: '--sw-label', label: 'Etiquetas de formulários', affects: 'Rótulos dos campos, filtros e títulos de cartões de relatórios',
      light: '#4b5563', dark: '#c7cfd6' },
    { category: 'typography', categoryLabel: 'Textos & Tipografia',
      key: '--sw-link', label: 'Links e hiperlinks', affects: 'Links clicáveis, suporte, fale conosco e termos',
      light: '#c83818', dark: '#ff7a45' },

    // --- Formulários & Campos ---
    { category: 'forms', categoryLabel: 'Formulários & Campos',
      key: '--sw-input-bg', label: 'Fundo dos campos', affects: 'Fundo dos inputs de texto, selects, textareas e caixas de busca',
      light: '#ffffff', dark: '#121417' },
    { category: 'forms', categoryLabel: 'Formulários & Campos',
      key: '--sw-input-border', label: 'Borda dos campos', affects: 'Bordas de inputs, selects e caixas de busca desmarcadas',
      light: '#d1d5db', dark: '#2e353d' },
    { category: 'forms', categoryLabel: 'Formulários & Campos',
      key: '--sw-input-placeholder', label: 'Texto de exemplo (placeholder)', affects: 'Texto de exemplo exibido antes do preenchimento dos campos',
      light: '#9ca3af', dark: '#8b949d' },

    // --- Status, Assinatura & Notificações ---
    { category: 'status', categoryLabel: 'Status, Assinatura & Avisos',
      key: '--sw-pill-ink', label: 'Texto da assinatura', affects: 'Texto do status do plano na pílula do menu superior',
      light: '#c83818', dark: '#ff7a45' },
    { category: 'status', categoryLabel: 'Status, Assinatura & Avisos',
      key: '--sw-pill-bg', label: 'Fundo da pílula de assinatura', affects: 'Fundo do indicador de plano no menu superior',
      light: '#fff1e8', dark: '#321f15' },
    { category: 'status', categoryLabel: 'Status, Assinatura & Avisos',
      key: '--sw-pill-border', label: 'Borda da pílula de assinatura', affects: 'Borda do indicador de plano no menu superior',
      light: '#fdba74', dark: '#7a3e14' },
    { category: 'status', categoryLabel: 'Status, Assinatura & Avisos',
      key: '--sw-alert-bg', label: 'Fundo dos alertas', affects: 'Fundo dos cartões na central de mensagens e avisos do sininho',
      light: '#f8fafc', dark: '#242b33' },
    { category: 'status', categoryLabel: 'Status, Assinatura & Avisos',
      key: '--sw-alert-title', label: 'Título dos alertas', affects: 'Títulos das notificações e avisos do sistema',
      light: '#1e293b', dark: '#f2ede4' },
    { category: 'status', categoryLabel: 'Status, Assinatura & Avisos',
      key: '--sw-alert-msg', label: 'Mensagem dos alertas', affects: 'Corpo do texto das mensagens do sininho',
      light: '#475569', dark: '#c7cfd6' },
    { category: 'status', categoryLabel: 'Status, Assinatura & Avisos',
      key: '--sw-alert-link', label: 'Link das notificações', affects: 'Links de ação nas mensagens e avisos do sininho',
      light: '#2563eb', dark: '#ff7a45' },

    // --- Cores Semânticas ---
    { category: 'semantic', categoryLabel: 'Cores Semânticas',
      key: '--sw-success', label: 'Sucesso / Confirmado', affects: 'Contas pagas, saldos positivos, confirmações e aprovações',
      light: '#16a34a', dark: '#16a34a' },
    { category: 'semantic', categoryLabel: 'Cores Semânticas',
      key: '--sw-warning', label: 'Atenção / Pendente', affects: 'Contas pendentes, alertas preventivos, rascunhos e avisos',
      light: '#f59e0b', dark: '#f59e0b' },
    { category: 'semantic', categoryLabel: 'Cores Semânticas',
      key: '--sw-danger', label: 'Perigo / Cancelado', affects: 'Exclusões, cancelamentos, contas vencidas e erros do sistema',
      light: '#dc2626', dark: '#dc2626' },
    { category: 'semantic', categoryLabel: 'Cores Semânticas',
      key: '--sw-info', label: 'Informativo / Dicas', affects: 'Dicas de preenchimento, badges informativos e guias',
      light: '#2563eb', dark: '#2563eb' }
  ];

  function getCustomTheme() {
    try {
      var raw = localStorage.getItem(CUSTOM_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return { light: {}, dark: {} };
      return {
        light: parsed.light && typeof parsed.light === 'object' ? Object.assign({}, parsed.light) : {},
        dark: parsed.dark && typeof parsed.dark === 'object' ? Object.assign({}, parsed.dark) : {}
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

  function hexToRgba(hex, alpha) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return 'rgba(254, 106, 0, ' + alpha + ')';
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  function updateBrandDerivatives(theme, customOverride) {
    var custom = customOverride || (getCustomTheme()[theme] || {});
    var b = custom['--sw-brand'] || themeDefault('--sw-brand', theme);
    var bl = custom['--sw-brand-light'] || themeDefault('--sw-brand-light', theme);
    var bd = custom['--sw-brand-dark'] || themeDefault('--sw-brand-dark', theme);
    var root = document.documentElement;

    if (custom['--sw-brand'] || custom['--sw-brand-light'] || custom['--sw-brand-dark']) {
      root.style.setProperty('--sw-gradient', 'linear-gradient(135deg, ' + bl + ' 0%, ' + b + ' 50%, ' + bd + ' 100%)');
      root.style.setProperty('--sw-focus-ring', hexToRgba(b, 0.25));
      root.style.setProperty('--sw-shadow-brand', '0 6px 18px ' + hexToRgba(b, 0.35));
    } else {
      root.style.removeProperty('--sw-gradient');
      root.style.removeProperty('--sw-focus-ring');
      root.style.removeProperty('--sw-shadow-brand');
    }
  }

  function applyCustomTheme() {
    var effective = document.documentElement.getAttribute('data-theme') || 'dark';
    var theme = effective === 'light' ? 'light' : 'dark';
    var custom = getCustomTheme()[theme] || {};
    var root = document.documentElement;

    // 1. Limpa ou aplica todas as variáveis registradas no tema correspondente
    for (var i = 0; i < CUSTOM_VARS.length; i++) {
      var key = CUSTOM_VARS[i].key;
      if (custom[key]) {
        root.style.setProperty(key, custom[key]);
      } else {
        root.style.removeProperty(key);
      }
    }

    // 2. Sincroniza variáveis herdadas de layout
    if (custom['--sw-surface']) root.style.setProperty('--container-background', custom['--sw-surface']);
    else root.style.removeProperty('--container-background');

    if (custom['--sw-surface-2']) root.style.setProperty('--light-bg', custom['--sw-surface-2']);
    else root.style.removeProperty('--light-bg');

    if (custom['--sw-border']) root.style.setProperty('--border-color', custom['--sw-border']);
    else root.style.removeProperty('--border-color');

    if (custom['--sw-text-1']) root.style.setProperty('--text-main', custom['--sw-text-1']);
    else root.style.removeProperty('--text-main');

    if (custom['--sw-text-3']) root.style.setProperty('--text-muted', custom['--sw-text-3']);
    else root.style.removeProperty('--text-muted');

    // 3. Atualiza os derivados da marca para o tema ativo
    updateBrandDerivatives(theme, custom);
  }

  function setCustomVar(key, value, theme) {
    var effective = document.documentElement.getAttribute('data-theme') || 'dark';
    var target = theme === 'light' || theme === 'dark' ? theme : (effective === 'light' ? 'light' : 'dark');
    var custom = getCustomTheme();
    var def = themeDefault(key, target);
    var cleanVal = String(value || '').trim().toLowerCase();
    if (!cleanVal || cleanVal === String(def).toLowerCase()) {
      delete custom[target][key];
    } else {
      custom[target][key] = cleanVal;
    }
    saveCustomTheme(custom);
    applyCustomTheme();
    scheduleCloudSave();
  }

  function resetCustomVars(theme) {
    var custom = getCustomTheme();
    if (theme === 'light' || theme === 'dark') {
      custom[theme] = {};
    } else {
      custom.light = {};
      custom.dark = {};
    }
    saveCustomTheme(custom);
    applyCustomTheme();
    try { localStorage.setItem(CLOUD_TS_KEY, String(Date.now())); } catch (_) {}
    cloudSaveNow();
  }

  function shiftLightness(hex, delta) {
    var h = String(hex || '').replace('#', '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return hex;
    var d = Number(delta) || 0;
    if (d === 0) return '#' + h.toLowerCase();
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    var clampByte = function (v) { return Math.min(255, Math.max(0, Math.round(v))); };
    var toHexByte = function (v) { return clampByte(v).toString(16).padStart(2, '0'); };

    // Tons neutros de cinza: ajuste linear direto em RGB para resposta milimétrica
    if (r === g && g === b) {
      var shift = d * 2.55;
      return '#' + toHexByte(r + shift) + toHexByte(g + shift) + toHexByte(b + shift);
    }

    var rf = r / 255, gf = g / 255, bf = b / 255;
    var max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
    var l = (max + min) / 2, s = 0, hh = 0;
    if (max !== min) {
      var diff = max - min;
      s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
      if (max === rf) hh = (gf - bf) / diff + (gf < bf ? 6 : 0);
      else if (max === gf) hh = (bf - rf) / diff + 2;
      else hh = (rf - gf) / diff + 4;
      hh *= 60;
    }

    var targetL;
    if (d >= 0) targetL = l + (1 - l) * (d / 50);
    else targetL = l + l * (d / 50);
    targetL = Math.max(0.01, Math.min(0.99, targetL));

    var c2 = (1 - Math.abs(2 * targetL - 1)) * s;
    var x = c2 * (1 - Math.abs(((hh / 60) % 2) - 1));
    var m = targetL - c2 / 2, rr = 0, gg = 0, bb = 0;
    if (hh < 60) { rr = c2; gg = x; }
    else if (hh < 120) { rr = x; gg = c2; }
    else if (hh < 180) { gg = c2; bb = x; }
    else if (hh < 240) { gg = x; bb = c2; }
    else if (hh < 300) { rr = x; bb = c2; }
    else { rr = c2; bb = x; }

    return '#' + toHexByte((rr + m) * 255) + toHexByte((gg + m) * 255) + toHexByte((bb + m) * 255);
  }

  var settingsTarget = 'dark';
  var dragBases = {};
  var debouncedSaveTimer = null;

  function scheduleDebouncedThemeSave(key, val, theme) {
    if (debouncedSaveTimer) clearTimeout(debouncedSaveTimer);
    debouncedSaveTimer = setTimeout(function () {
      setCustomVar(key, val, theme);
    }, 300);
  }

  function openThemeSettings() {
    var effective = document.documentElement.getAttribute('data-theme') || 'dark';
    settingsTarget = effective === 'light' ? 'light' : 'dark';
    dragBases = {};

    var existing = document.getElementById('siswebThemeModal');
    if (existing) { existing.remove(); }
    var overlay = document.createElement('div');
    overlay.id = 'siswebThemeModal';
    overlay.className = 'sw-theme-modal';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Configurações de Tema');

    var categories = [
      { id: 'brand', label: 'Marca & Identidade', icon: '🌟' },
      { id: 'surface', label: 'Superfícies & Estrutura', icon: '🎨' },
      { id: 'navigation', label: 'Menu Superior & Navegação', icon: '🧭' },
      { id: 'typography', label: 'Textos & Tipografia', icon: '✍️' },
      { id: 'forms', label: 'Formulários & Campos', icon: '📝' },
      { id: 'status', label: 'Status, Assinatura & Avisos', icon: '🔔' },
      { id: 'semantic', label: 'Cores Semânticas', icon: '🚥' }
    ];

    var customState = getCustomTheme()[settingsTarget] || {};

    var rowsHtml = '';
    categories.forEach(function (cat) {
      var catVars = [];
      CUSTOM_VARS.forEach(function (v, idx) {
        if (v.category === cat.id) catVars.push({ v: v, idx: idx });
      });
      if (!catVars.length) return;

      rowsHtml += '<div class="sw-theme-category-head" data-category="' + cat.id + '">'
        + '<span class="sw-theme-cat-icon">' + cat.icon + '</span> ' + cat.label + '</div>';

      catVars.forEach(function (item) {
        var v = item.v;
        var i = item.idx;
        var cur = customState[v.key] || v[settingsTarget];
        rowsHtml += '<div class="sw-theme-row" data-var="' + v.key + '" data-category="' + v.category + '">'
          + '<div class="sw-theme-row-head">'
          + '<div class="sw-theme-row-title-wrap">'
          + '<strong>' + v.label + '</strong>'
          + '<span class="sw-theme-var-name">' + v.key + '</span>'
          + '</div>'
          + '<button type="button" class="sw-theme-reset" data-reset="' + i + '" title="Restaurar padrão">↺</button>'
          + '</div>'
          + '<div class="sw-theme-affects">' + v.affects + '</div>'
          + '<div class="sw-theme-controls">'
          + '<div class="sw-theme-picker-combo">'
          + '<span class="sw-theme-swatch" data-swatch="' + i + '" style="background-color:' + cur + '"></span>'
          + '<input type="color" data-picker="' + i + '" value="' + cur + '" aria-label="Cor ' + v.label + '">'
          + '</div>'
          + '<div class="sw-theme-range-wrap">'
          + '<span class="sw-theme-range-icon" title="Escurecer">−</span>'
          + '<input type="range" class="sw-theme-range" min="-50" max="50" step="0.1" value="0" data-shade="' + i + '" aria-label="Ajuste fino milimétrico de ' + v.label + '">'
          + '<span class="sw-theme-range-icon" title="Clarear">+</span>'
          + '</div>'
          + '<input type="text" class="sw-theme-hex" data-hex-input="' + i + '" data-hex="' + i + '" value="' + cur + '" maxlength="7" spellcheck="false" aria-label="Código hexadecimal de ' + v.label + '">'
          + '</div></div>';
      });
    });

    overlay.innerHTML = '<div class="sw-theme-dialog">'
      + '<div class="sw-theme-dialog-head"><h2>Configurações de Tema</h2>'
      + '<button type="button" class="sw-theme-close" aria-label="Fechar">×</button></div>'
      + '<div class="sw-theme-tabs" role="tablist">'
      + '<button type="button" class="sw-theme-tab' + (settingsTarget === 'light' ? ' active' : '') + '" data-target="light">Claro</button>'
      + '<button type="button" class="sw-theme-tab' + (settingsTarget === 'dark' ? ' active' : '') + '" data-target="dark">Escuro</button>'
      + '</div>'
      + '<p class="sw-theme-hint">Ajuste qualquer detalhe com o seletor ou use a barra milimétrica para escurecer ou clarear. A visualização reflete imediatamente na tela para o tema selecionado.</p>'
      + '<div class="sw-theme-search-wrap">'
      + '<span class="sw-theme-search-icon">🔍</span>'
      + '<input type="text" class="sw-theme-search" placeholder="Buscar detalhe ou elemento (ex: fundo, menu, borda, tabela, campos)..." aria-label="Buscar opções">'
      + '</div>'
      + '<div class="sw-theme-rows">' + rowsHtml
      + '<div class="sw-theme-empty" style="display:none; text-align:center; padding:24px 10px; color:var(--sw-island-muted); font-size:13px;">Nenhum detalhe ou campo encontrado para esta busca.</div>'
      + '</div>'
      + '<div class="sw-theme-foot">'
      + '<button type="button" class="sw-theme-reset-all">Restaurar padrão</button>'
      + '<button type="button" class="sw-theme-done">Concluir</button>'
      + '</div></div>';

    document.body.appendChild(overlay);
    syncSettingsValues();

    // Captura inicial para o arraste suave e milimétrico
    overlay.addEventListener('pointerdown', function (event) {
      var t = event.target;
      if (t && t.matches && t.matches('input[type="range"]')) {
        var si = t.getAttribute('data-shade');
        if (si !== null && si !== undefined && si !== '') {
          var v = CUSTOM_VARS[+si];
          var curCustom = getCustomTheme()[settingsTarget] || {};
          dragBases[si] = curCustom[v.key] || v[settingsTarget];
        }
      }
    });

    // Busca rápida
    overlay.addEventListener('input', function (event) {
      var t = event.target;
      if (t && t.classList && t.classList.contains('sw-theme-search')) {
        var q = String(t.value || '').trim().toLowerCase();
        var rowEls = overlay.querySelectorAll('.sw-theme-row');
        var anyVisible = false;
        rowEls.forEach(function (row) {
          var txt = (row.textContent || '').toLowerCase();
          var ok = !q || txt.indexOf(q) !== -1;
          row.style.display = ok ? '' : 'none';
          if (ok) anyVisible = true;
        });
        var emptyMsg = overlay.querySelector('.sw-theme-empty');
        if (emptyMsg) emptyMsg.style.display = anyVisible ? 'none' : 'block';

        var headEls = overlay.querySelectorAll('.sw-theme-category-head');
        headEls.forEach(function (hd) {
          var catId = hd.getAttribute('data-category');
          var visibleChild = overlay.querySelector('.sw-theme-row[data-category="' + catId + '"]:not([style*="display: none"])');
          hd.style.display = visibleChild ? '' : 'none';
        });
      }
    });

    // Ações de clique (abas, fechar, reset)
    overlay.addEventListener('click', function (event) {
      var t = event.target;
      var closest = function (sel) { return t && t.closest ? t.closest(sel) : null; };

      if (t === overlay || closest('.sw-theme-close') || closest('.sw-theme-done')) {
        // Fixa e persiste o tema visualizado como ativo
        apply(settingsTarget, true);
        overlay.remove();
        return;
      }

      var tab = closest('.sw-theme-tab');
      if (tab) {
        var nextTarget = tab.getAttribute('data-target') === 'light' ? 'light' : 'dark';
        if (nextTarget !== settingsTarget) {
          settingsTarget = nextTarget;
          // Muda o visual da página para o tema selecionado na aba sem vazamento
          document.documentElement.setAttribute('data-theme', settingsTarget);
          syncMeta(settingsTarget);
          syncMenuOptions(settingsTarget);
          applyCustomTheme();
          overlay.querySelectorAll('.sw-theme-tab').forEach(function (el) {
            el.classList.toggle('active', el === tab);
          });
          syncSettingsValues();
        }
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

    // Eventos de entrada em tempo real (milissegundo a milissegundo, ultra-responsivo)
    overlay.addEventListener('input', function (event) {
      var t = event.target;
      if (!t || !t.getAttribute) return;

      var pi = t.getAttribute('data-picker');
      var si = t.getAttribute('data-shade');
      var hi = t.getAttribute('data-hex-input');

      // Seletor nativo de cor
      if (pi !== null && pi !== undefined && pi !== '') {
        var v = CUSTOM_VARS[+pi];
        var val = t.value;
        document.documentElement.style.setProperty(v.key, val);
        if (v.key === '--sw-brand' || v.key === '--sw-brand-light' || v.key === '--sw-brand-dark') {
          var tempCustom = Object.assign({}, getCustomTheme()[settingsTarget]);
          tempCustom[v.key] = val;
          updateBrandDerivatives(settingsTarget, tempCustom);
        }
        var swatch = overlay.querySelector('[data-swatch="' + pi + '"]');
        if (swatch) swatch.style.backgroundColor = val;
        var hex = overlay.querySelector('[data-hex-input="' + pi + '"]');
        if (hex) hex.value = val;
        var shade = overlay.querySelector('[data-shade="' + pi + '"]');
        if (shade) shade.value = '0';
        dragBases[pi] = val;
        scheduleDebouncedThemeSave(v.key, val, settingsTarget);
        return;
      }

      // Slider milimétrico
      if (si !== null && si !== undefined && si !== '') {
        var v2 = CUSTOM_VARS[+si];
        var curCustom2 = getCustomTheme()[settingsTarget] || {};
        var base = dragBases[si] || curCustom2[v2.key] || v2[settingsTarget];
        var next = shiftLightness(base, +t.value);

        document.documentElement.style.setProperty(v2.key, next);
        if (v2.key === '--sw-brand' || v2.key === '--sw-brand-light' || v2.key === '--sw-brand-dark') {
          var tempCustom2 = Object.assign({}, curCustom2);
          tempCustom2[v2.key] = next;
          updateBrandDerivatives(settingsTarget, tempCustom2);
        }

        var picker = overlay.querySelector('[data-picker="' + si + '"]');
        if (picker) picker.value = next;
        var swatch2 = overlay.querySelector('[data-swatch="' + si + '"]');
        if (swatch2) swatch2.style.backgroundColor = next;
        var hex2 = overlay.querySelector('[data-hex-input="' + si + '"]');
        if (hex2) hex2.value = next;

        scheduleDebouncedThemeSave(v2.key, next, settingsTarget);
        return;
      }

      // Entrada manual de HEX
      if (hi !== null && hi !== undefined && hi !== '') {
        var v3 = CUSTOM_VARS[+hi];
        var rawHex = String(t.value || '').trim();
        if (/^#?[0-9a-f]{6}$/i.test(rawHex)) {
          var cleanHex = (rawHex.indexOf('#') === 0 ? rawHex : '#' + rawHex).toLowerCase();
          document.documentElement.style.setProperty(v3.key, cleanHex);
          if (v3.key === '--sw-brand' || v3.key === '--sw-brand-light' || v3.key === '--sw-brand-dark') {
            var tempCustom3 = Object.assign({}, getCustomTheme()[settingsTarget]);
            tempCustom3[v3.key] = cleanHex;
            updateBrandDerivatives(settingsTarget, tempCustom3);
          }
          var picker3 = overlay.querySelector('[data-picker="' + hi + '"]');
          if (picker3) picker3.value = cleanHex;
          var swatch3 = overlay.querySelector('[data-swatch="' + hi + '"]');
          if (swatch3) swatch3.style.backgroundColor = cleanHex;
          var shade3 = overlay.querySelector('[data-shade="' + hi + '"]');
          if (shade3) shade3.value = '0';
          dragBases[hi] = cleanHex;
          scheduleDebouncedThemeSave(v3.key, cleanHex, settingsTarget);
        }
      }
    });

    // Ao soltar ou sair do campo, grava imediatamente
    overlay.addEventListener('change', function (event) {
      var t = event.target;
      if (!t || !t.getAttribute) return;
      var pi = t.getAttribute('data-picker');
      var si = t.getAttribute('data-shade');
      var hi = t.getAttribute('data-hex-input');

      if (pi !== null && pi !== undefined && pi !== '') {
        var v = CUSTOM_VARS[+pi];
        setCustomVar(v.key, t.value, settingsTarget);
      } else if (si !== null && si !== undefined && si !== '') {
        var v2 = CUSTOM_VARS[+si];
        var hex2 = overlay.querySelector('[data-hex-input="' + si + '"]');
        if (hex2 && hex2.value) setCustomVar(v2.key, hex2.value, settingsTarget);
      } else if (hi !== null && hi !== undefined && hi !== '') {
        var v3 = CUSTOM_VARS[+hi];
        var rawHex = String(t.value || '').trim();
        if (/^#?[0-9a-f]{6}$/i.test(rawHex)) {
          var clean = (rawHex.indexOf('#') === 0 ? rawHex : '#' + rawHex).toLowerCase();
          setCustomVar(v3.key, clean, settingsTarget);
        } else {
          syncSettingsValues();
        }
      }
    });

    function syncSettingsValues() {
      var custom = getCustomTheme()[settingsTarget] || {};
      CUSTOM_VARS.forEach(function (v, i) {
        var current = custom[v.key] || v[settingsTarget];
        var picker = overlay.querySelector('[data-picker="' + i + '"]');
        if (picker) picker.value = current;
        var swatch = overlay.querySelector('[data-swatch="' + i + '"]');
        if (swatch) swatch.style.backgroundColor = current;
        var hex = overlay.querySelector('[data-hex-input="' + i + '"]');
        if (hex) hex.value = current;
        var shade = overlay.querySelector('[data-shade="' + i + '"]');
        if (shade) shade.value = '0';
        dragBases[i] = current;
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
        /* Fase 25 (V5): substitui (não união) — last-write-wins real. */
        var merged = { light: clean.custom.light, dark: clean.custom.dark };
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
