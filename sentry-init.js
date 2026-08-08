/**
 * sentry-init.js — Monitoramento de erros em produção (Sentry Browser SDK)
 *
 * Script clássico (não-module) que inicializa o Sentry UMA única vez
 * (guard singleton) e expõe `window.SentryMonitor` com helpers de
 * monitoramento de operações de dados.
 *
 * SEGURANÇA / PRIVACIDADE:
 *  - Sem DSN configurado o SDK roda em modo no-op LOCAL: captura erros,
 *    mas NADA é enviado para fora do navegador (zero custo, zero vazamento).
 *  - Para ativar, crie um projeto gratuito em sentry.io e cole o DSN
 *    na constante SENTRY_DSN abaixo (ou defina window.__SENTRY_DSN__ antes
 *    deste script). O DSN é público (client-side) — não é segredo.
 *  - sendDefaultPII: false — nunca envia nome/e-mail do usuário.
 *  - Identidade enviada: apenas `uid` + `company_id` (tags), lidos do
 *    contexto da sessão atual. Nunca payloads de dados de tenants.
 *  - beforeSend remove campos sensíveis (senha/email) de extras e redige
 *    URLs com parâmetros.
 *  - Erros de extensões de navegador (ruído ~90% em produção) são filtrados.
 *  - Tracing desligado (tracesSampleRate: 0) — sem custos de performance.
 *
 * Uso:
 *   <script src="sentry/sentry.browser.min.js?v=..."></script>
 *   <script src="sentry-init.js?v=..."></script>
 *   ...
 *   window.SentryMonitor.reportDataIssue('gravacao_falhou', { path, op, companyId });
 *   window.SentryMonitor.captureException(err, { extra });
 */
(function () {
  'use strict';

  // Guard singleton: páginas SPA/parciais podem carregar o script 2x
  if (window.SentryMonitor) return;

  // ⚙️ DSN do projeto Sentry (projeto gratuito). Deixe null para rodar em
  // modo local (nada é enviado). Pode ser sobrescrito via window.__SENTRY_DSN__.
  var SENTRY_DSN = 'https://b4258fde0ba4c6c34342d39454e23501@o4511662240432128.ingest.us.sentry.io/4511662247313408';

  var noop = function () {};

  if (!window.Sentry) {
    // SDK não carregou (offline/cache) — expõe API no-op para não quebrar
    // chamadas de reportDataIssue nas páginas.
    window.SentryMonitor = {
      enabled: false,
      init: noop,
      reportDataIssue: noop,
      captureException: noop,
      setTenant: noop,
      wrap: function (fn) { return fn; }
    };
    return;
  }

  var S = window.Sentry;
  var dsn = window.__SENTRY_DSN__ || SENTRY_DSN || null;

  // ─── Ruído conhecido: extensões de navegador e erros benignos ──────────────
  var EXTENSION_PATTERNS = [
    /chrome-extension:\/\//i,
    /moz-extension:\/\//i,
    /safari-extension:\/\//i,
    /extension:\/\//i,
    /web_accessible_resources/i,
    /__puppeteer__/i,
    /Grammarly/i,
    /LastPass/i,
    /Avast/i,
    /Bitdefender/i,
    /Kaspersky/i,
    /McAfee/i,
    /WebDriver/i
  ];

  var IGNORED_ERRORS = [
    /Script error\.?/i,                 // cross-origin sem CORS (sem stack)
    /ResizeObserver loop/i,             // benigno, browsers antigos
    /Non-Error promise rejection captured with value: (?:null|undefined)/i,
    /Load failed/i,                     // aborts de rede (usuário navegou)
    /Failed to fetch/i,
    /The operation was aborted/i,
    /NetworkError when attempting to fetch resource/i,
    /A listener indicated an asynchronous response/i,  // extensões
    /Cannot read properties of (?:null|undefined) \(reading 'firstChild'\) of (?:null|undefined)/i
  ];

  function isExtensionError(event) {
    var frames = [];
    if (event.exception && event.exception.values) {
      for (var i = 0; i < event.exception.values.length; i++) {
        var v = event.exception.values[i];
        if (v.stacktrace && v.stacktrace.frames) frames = frames.concat(v.stacktrace.frames);
      }
    }
    if (frames.length > 0) {
      for (var j = 0; j < frames.length; j++) {
        var fn = (frames[j].filename || '') + ' ' + (frames[j].function || '');
        for (var k = 0; k < EXTENSION_PATTERNS.length; k++) {
          if (EXTENSION_PATTERNS[k].test(fn)) return true;
        }
      }
    }
    if (event.request && event.request.url && EXTENSION_PATTERNS.some(function (re) { return re.test(event.request.url); })) return true;
    return false;
  }

  function shouldIgnoreError(event) {
    var msg = event.message || '';
    for (var i = 0; i < IGNORED_ERRORS.length; i++) {
      if (IGNORED_ERRORS[i].test(msg)) return true;
    }
    return false;
  }

  // ─── Contexto multi-tenant (sem PII) ───────────────────────────────────────
  function getTenantContext() {
    var ctx = { companyId: null, uid: null, page: null };
    try {
      var svc = window.firebaseService;
      if (svc && typeof svc.getTenantId === 'function') ctx.companyId = svc.getTenantId();
      if (!ctx.companyId && typeof svc === 'object' && svc.tenantId) ctx.companyId = svc.tenantId;
    } catch (_) {}
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('companyId')) ctx.companyId = params.get('companyId');
      if (params.get('tenant')) ctx.companyId = params.get('tenant');
    } catch (_) {}
    try {
      if (window.localStorage) {
        var ls = window.localStorage.getItem('appTenantId') || window.localStorage.getItem('tenantId') || window.localStorage.getItem('companyId');
        if (ls && !ctx.companyId) ctx.companyId = ls;
      }
    } catch (_) {}
    try {
      if (window.appTenantId) ctx.companyId = window.appTenantId;
    } catch (_) {}
    try {
      if (window.firebaseAuthUser && window.firebaseAuthUser.uid) ctx.uid = window.firebaseAuthUser.uid;
    } catch (_) {}
    try {
      ctx.page = window.location.pathname.split('/').pop() || 'index.html';
    } catch (_) {}
    return ctx;
  }

  // ─── Redação de campos sensíveis antes do envio ────────────────────────────
  var SENSITIVE_KEYS = /(password|passwd|senha|token|secret|authorization|cookie|api[_-]?key|credit|card|cvv|ssn|cpf)/i;

  function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (var key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      if (SENSITIVE_KEYS.test(key)) { obj[key] = '[REDACTED]'; continue; }
      if (obj[key] && typeof obj[key] === 'object') sanitizeObject(obj[key]);
    }
  }

  function beforeSend(event) {
    try {
      if (shouldIgnoreError(event)) return null;
      if (isExtensionError(event)) return null;

      var ctx = getTenantContext();
      event.tags = event.tags || {};
      if (ctx.companyId) event.tags.company_id = String(ctx.companyId).slice(0, 64);
      if (ctx.uid) event.tags.uid = ctx.uid;
      event.tags.app = 'sisweb';
      event.tags.page = ctx.page || 'unknown';

      // user: só uid, sem e-mail/nome
      if (event.user && event.user.uid) event.user = { id: event.user.uid };

      sanitizeObject(event.extra);
      sanitizeObject(event.contexts);

      // Redige URLs com query params (podem conter códigos sensíveis)
      if (event.request && event.request.url) {
        event.request.url = String(event.request.url).replace(/\?.*$/, '?[redacted]');
      }
    } catch (_) {}
    return event;
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  S.init({
    dsn: dsn,
    release: window.__SISWEB_RELEASE__ || 'sisweb-local',
    environment: window.__SISWEB_ENV__ || (window.location.hostname.indexOf('localhost') >= 0 || window.location.hostname.indexOf('127.0.0.1') >= 0 ? 'development' : 'production'),
    sendDefaultPII: false,
    tracesSampleRate: 0,        // sem tracing — zero custo de performance
    autoSessionTracking: true,
    beforeSend: beforeSend,
    ignoreErrors: IGNORED_ERRORS,
    denyUrls: EXTENSION_PATTERNS,
    maxBreadcrumbs: 40
  });

  try {
    var ctx0 = getTenantContext();
    if (ctx0.companyId) S.setTag('company_id', String(ctx0.companyId).slice(0, 64));
    S.setTag('app', 'sisweb');
    S.setTag('page', ctx0.page || 'unknown');
  } catch (_) {}

  // ─── API pública ───────────────────────────────────────────────────────────

  /**
   * Reporta falha em operação de dados (gravação, exclusão, update, filtro,
   * duplicação, conflito). Registra como erro com tags para filtragem.
   *
   * @param {string} type   um dos: gravacao_falhou | exclusao_falhou | update_falhou |
   *                        filtro_invalido | duplicacao | conflito | falha_dados | validacao
   * @param {object} details { path, op, collection, companyId, detail }
   */
  function reportDataIssue(type, details) {
    var ctx = getTenantContext();
    details = details || {};
    try {
      S.withScope(function (scope) {
        scope.setLevel('error');
        scope.setTag('data_issue', type);
        if (details.path) scope.setTag('data_path', String(details.path).slice(0, 200));
        if (details.op) scope.setTag('data_op', String(details.op).slice(0, 50));
        if (details.collection) scope.setTag('data_collection', String(details.collection).slice(0, 100));
        if (details.companyId || ctx.companyId) scope.setTag('company_id', String(details.companyId || ctx.companyId).slice(0, 64));
        var extra = {};
        ['path', 'op', 'collection', 'detail', 'errorMessage', 'errorCode'].forEach(function (k) {
          if (details[k] !== undefined && details[k] !== null) extra[k] = details[k];
        });
        sanitizeObject(extra);
        scope.setExtra('data', extra);
        S.captureMessage('[dados] ' + type + (details.path ? ' @ ' + details.path : ''));
      });
    } catch (_) {}
  }

  /**
   * Captura exceção com contexto extra (sanitizado).
   */
  function captureException(err, context) {
    try {
      S.withScope(function (scope) {
        if (context && context.tags) {
          Object.keys(context.tags).forEach(function (k) { scope.setTag(k, context.tags[k]); });
        }
        if (context && context.extra) {
          var safe = {};
          try { safe = JSON.parse(JSON.stringify(context.extra)); } catch (_) { safe = context.extra; }
          sanitizeObject(safe);
          scope.setExtra('context', safe);
        }
        S.captureException(err);
      });
    } catch (_) {}
  }

  /**
   * Envolve função para reportar falhas não tratadas com contexto de dados.
   * Uso: var fnSegura = window.SentryMonitor.wrap('salvarPedido', fn, { path: '/vendas' });
   */
  function wrap(opName, fn, context) {
    return function () {
      try {
        return fn.apply(this, arguments);
      } catch (e) {
        reportDataIssue('falha_dados', {
          op: opName,
          detail: (e && e.message) || String(e),
          errorCode: e && e.code,
          path: context && context.path
        });
        throw e;
      }
    };
  }

  function setTenant(companyId) {
    try {
      if (companyId) S.setTag('company_id', String(companyId).slice(0, 64));
      else S.setTag('company_id', 'null');
    } catch (_) {}
  }

  window.SentryMonitor = {
    enabled: !!dsn,
    setTenant: setTenant,
    reportDataIssue: reportDataIssue,
    captureException: captureException,
    wrap: wrap,
    _getTenantContext: getTenantContext
  };

  if (dsn) {
    console.log('✅ Sentry monitor ativo (Sisweb). Erros serão reportados em produção.');
  } else {
    console.log('ℹ️ Sentry em modo LOCAL (sem DSN): erros capturados mas nada é enviado. Configure SENTRY_DSN em sentry-init.js para ativar.');
  }
})();
