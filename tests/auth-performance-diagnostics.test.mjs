import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('auth-performance-diagnostics.js');
const baselinePages = [
  'login.html',
  'index.html',
  'vendas.html',
  'compras.html',
  'estoque.html',
  'financas.html',
  'notas-fiscais.html',
  'client.html',
  'fornecedor.html',
  'company.html',
  'romaneiotl.html',
  'folha_pagamento/folha.html'
];
const instrumentedFiles = [
  'firebaseService.js',
  'auth.js',
  'modules/core/firebase-service.js',
  'src/services/firebaseService.js',
  'financas.html',
  'romaneiotl.html',
  'folha_pagamento/folha.html',
  'firebase-connection-manager-compat.js',
  'folha_pagamento/folha-firebase-manager.js',
  'romaneio-firebase-service.js'
];
const forcedRefreshFiles = [
  'firebaseService.js',
  'auth.js',
  'modules/core/firebase-service.js',
  'src/services/firebaseService.js',
  'index.html',
  'estoque.html',
  'company.html'
];
const productionLogFiles = [
  ...instrumentedFiles,
  'login.html',
  'index.html',
  'estoque.html',
  'company.html',
  'firebaseService.unified.js',
  'src/services/firebaseService.unified.js'
];

function createContext(search = '?diag=auth-perf') {
  const calls = {
    console: 0,
    fetch: 0,
    storage: 0,
    beacon: 0,
    marker: 0
  };
  const storage = {
    getItem() { calls.storage += 1; },
    setItem() { calls.storage += 1; },
    removeItem() { calls.storage += 1; }
  };
  const performance = {
    now: () => 25,
    getEntriesByType: (type) => type === 'navigation'
      ? [{ duration: 120, domInteractive: 60, domContentLoadedEventEnd: 90, loadEventEnd: 120 }]
      : [{ name: 'https://example.invalid/private?token=secret' }]
  };
  const window = {
    location: { search, pathname: '/financas.html' },
    navigator: {
      onLine: true,
      sendBeacon() { calls.beacon += 1; }
    },
    performance,
    crypto: webcrypto,
    localStorage: storage,
    sessionStorage: storage,
    indexedDB: { open() { calls.storage += 1; } },
    document: {
      documentElement: {
        setAttribute(name, value) {
          if (name === 'data-sisweb-auth-perf' && value === 'ready') calls.marker += 1;
        }
      },
      addEventListener() {}
    },
    addEventListener() {},
    fetch() { calls.fetch += 1; },
    console: new Proxy({}, { get: () => () => { calls.console += 1; } })
  };
  window.window = window;
  return {
    context: vm.createContext({
      window,
      URLSearchParams,
      TextEncoder,
      Uint8Array,
      Date,
      Math,
      JSON,
      Set,
      Object,
      Number,
      String,
      Array
    }),
    window,
    calls
  };
}

async function waitForTaggedSnapshot(diag) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const snapshot = diag.snapshot();
    if (snapshot.state.tenantTag && snapshot.events.some((event) => event.resourceTag)) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return diag.snapshot();
}

test('diagnostico fica totalmente inativo fora do opt-in exato', () => {
  for (const search of ['', '?diag=auth_perf', '?diag=AUTH-PERF', '?other=auth-perf']) {
    const { context, window, calls } = createContext(search);
    vm.runInContext(source, context);
    assert.equal(window.__SISWEB_AUTH_PERF__, undefined);
    assert.deepEqual(calls, { console: 0, fetch: 0, storage: 0, beacon: 0, marker: 0 });
  }
});

test('API publica e congelada aceita somente operacoes tipadas', () => {
  const { context, window, calls } = createContext();
  vm.runInContext(source, context);

  const diag = window.__SISWEB_AUTH_PERF__;
  assert.ok(Object.isFrozen(diag));
  assert.deepEqual(Object.keys(diag).sort(), [
    'auth',
    'cache',
    'clear',
    'internet',
    'listener',
    'phase',
    'read',
    'rtdb',
    'snapshot',
    'tenant',
    'tokenRefresh'
  ]);
  assert.equal(diag.mark, undefined);
  assert.equal(diag.count, undefined);
  assert.equal(calls.marker, 1);
});

test('snapshot em memoria usa allowlists, HMAC efemero e nao contem PII', async () => {
  const { context, window, calls } = createContext();
  vm.runInContext(source, context);

  const diag = window.__SISWEB_AUTH_PERF__;
  const tenant = '1749492103278';
  const uid = 'J9of0kidtbcEDGG8v1ukTeibhuk2';
  const email = 'person@example.com';
  const token = 'eyJhbGciOiJSUzI1NiJ9.private.signature';
  const resource = `companies/${tenant}/users/${uid}/${email}/${token}`;

  diag.auth('authenticated', 'root_service', 10);
  diag.rtdb(false, 'root_service');
  diag.internet(true, 'browser');
  diag.tenant(tenant, 'root_service');
  diag.read(resource, 'root_service', 'physical', 'success', 15);
  diag.read(resource, 'root_service', 'logical', 'started', 0);
  diag.cache(resource, 'memory', 'hit', 'core_service');
  diag.listener('auth', 'add', 'root_service', 0);
  diag.tokenRefresh('login_initial_claims', 'auth_guard', 'success', 20);
  diag.phase(email, email, email, 5);
  const snapshot = await waitForTaggedSnapshot(diag);
  const serialized = JSON.stringify(snapshot);
  const reads = snapshot.events.filter((event) => event.kind === 'data_read');

  assert.equal(snapshot.routeCode, 'finance');
  assert.equal(snapshot.state.auth, 'authenticated');
  assert.equal(snapshot.state.rtdb, 'disconnected');
  assert.equal(snapshot.state.internet, 'online');
  assert.equal(snapshot.state.tenantPresent, true);
  assert.match(snapshot.state.tenantTag || '', /^[0-9a-f]{24}$/);
  assert.equal(reads.length, 2);
  assert.match(reads[0].resourceTag || '', /^[0-9a-f]{24}$/);
  assert.equal(reads[0].resourceTag, reads[1].resourceTag);
  assert.equal(snapshot.events.at(-1).phase, 'unknown');
  assert.equal(snapshot.events.at(-1).source, 'unknown');
  assert.equal(snapshot.events.at(-1).outcome, 'unknown');
  assert.ok(Object.isFrozen(snapshot));
  assert.ok(Object.isFrozen(snapshot.events));
  assert.doesNotMatch(serialized, new RegExp([tenant, uid, email, token].join('|')));
  assert.doesNotMatch(serialized, /example\.invalid|private\?token/);
  assert.deepEqual(calls, { console: 0, fetch: 0, storage: 0, beacon: 0, marker: 1 });
});

test('buffer e circular, limitado e pode ser limpo sem persistencia', () => {
  const { context, window } = createContext();
  vm.runInContext(source, context);
  const diag = window.__SISWEB_AUTH_PERF__;

  for (let index = 0; index < 1005; index += 1) {
    diag.phase('bootstrap', 'browser', 'observed', index);
  }
  assert.equal(diag.snapshot().events.length, 1000);
  diag.clear();
  assert.equal(diag.snapshot().events.length, 0);
});

test('implementacao nao possui canais de persistencia, rede ou console', () => {
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|caches\.|document\.cookie/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);
  assert.doesNotMatch(source, /console\.(?:log|warn|error|debug)/);
});

test('rotas da baseline carregam o diagnostico somente antes do bootstrap', () => {
  for (const page of baselinePages) {
    const html = read(page);
    const scriptPath = page.includes('/') ? '../auth-performance-diagnostics.js' : 'auth-performance-diagnostics.js';
    assert.match(html, /new URLSearchParams\(window\.location\.search\)\.get\('diag'\) === 'auth-perf'/, `${page} precisa exigir opt-in exato`);
    assert.ok(html.includes(scriptPath), `${page} precisa apontar para o diagnostico compartilhado`);

    const diagIndex = html.indexOf('auth-performance-diagnostics.js');
    const firstBootstrap = [
      html.indexOf('menu-component.js'),
      html.indexOf('firebase-app'),
      html.indexOf('firebaseService.js'),
      html.indexOf('firebase-service.js')
    ].filter((index) => index >= 0).sort((a, b) => a - b)[0];
    if (Number.isFinite(firstBootstrap)) {
      assert.ok(diagIndex < firstBootstrap, `${page} precisa carregar diagnostico antes do bootstrap`);
    }
  }
});

test('arquivo de diagnostico faz parte da allowlist do Hosting', () => {
  const manifest = JSON.parse(read('hosting-files.json'));
  assert.ok(manifest.includes('auth-performance-diagnostics.js'));
});

test('folha nao publica painel ou script legado de diagnostico', () => {
  const folha = read('folha_pagamento/folha.html');
  assert.doesNotMatch(folha, /id=["']diagnostico-section["']/i);
  assert.doesNotMatch(folha, /problems_and_diagnostics/i);
  assert.doesNotMatch(folha, /debug-folha-utils\.js/i);
  assert.match(folha, /auth-performance-diagnostics\.js/);
  assert.match(folha, /get\('diag'\) === 'auth-perf'/);
});

test('servicos da baseline usam a API tipada sem interceptar o Firebase', () => {
  for (const file of instrumentedFiles) {
    const content = read(file);
    assert.ok(content.includes('__SISWEB_AUTH_PERF__'), `${file} precisa integrar o diagnostico opt-in`);
  }

  assert.match(read('firebaseService.js'), /authPerfRead\(path, 'logical'/);
  assert.match(read('modules/core/firebase-service.js'), /authPerfTLCache\(path, 'memory', 'hit'\)/);
  assert.match(read('src/services/firebaseService.js'), /authPerfCompanyListener\('auth', 'add'\)/);
  assert.doesNotMatch(source, /prototype\.|Proxy\(|firebase\s*=|onAuthStateChanged\s*=/);
});

test('todo refresh forcado inventariado possui motivo diagnostico fechado', () => {
  for (const file of forcedRefreshFiles) {
    const content = read(file);
    const refreshes = [...content.matchAll(/getIdToken(?:Result)?\(true\)/g)];
    for (const refresh of refreshes) {
      const prefix = content.slice(Math.max(0, refresh.index - 320), refresh.index);
      assert.match(prefix, /tokenRefresh\(/i, `${file} possui refresh forcado sem motivo perto do indice ${refresh.index}`);
    }
  }
});

test('logs publicados nao imprimem identificadores, caminhos ou payloads de negocio', () => {
  const dangerousConsole = /console\.(?:log|warn|error|debug)\([^\n]*(?:user\.uid|user\.email|normalizedEmail|firebaseConfig\.(?:apiKey|databaseURL)|currentTenantId|\$\{(?:path|writePath|nsPath|candidate|candidatePath|cleanPath|pathKey|remotePath)|,\s*(?:data|payload|deduplicatedCandidates)\s*\))/i;
  for (const file of productionLogFiles) {
    assert.doesNotMatch(read(file), dangerousConsole, `${file} ainda possui console com dado sensivel ou caminho bruto`);
  }
});
