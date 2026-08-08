import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const source = read('firebaseService.js');

function extractBetween(src, start, end) {
  const startIndex = src.indexOf(start);
  assert.notEqual(startIndex, -1, `inicio ausente: ${start}`);
  const endIndex = src.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `fim ausente: ${end}`);
  return src.slice(startIndex, endIndex);
}

function evalInVm(code, extraGlobals = {}) {
  const sandbox = {
    Date, Map, Set, Object, Array, String, Number, Math, JSON, RegExp, Promise,
    console: { log() {}, warn() {}, error() {}, debug() {} },
    ...extraGlobals
  };
  sandbox.window = sandbox;
  return vm.runInNewContext(code, sandbox, { timeout: 5000 });
}

test('servico raiz possui wrapper dedup e core separado para leituras', () => {
  assert.match(source, /async function loadFromFirebase\(path\) \{/);
  assert.match(source, /async function loadFromFirebaseCore\(path\) \{/);
  assert.match(source, /const pendingReadFlights = new Map\(\)/);
  assert.match(source, /const readCacheStore = new Map\(\)/);
  assert.ok(
    source.indexOf('const flight = (async () => {') > source.indexOf('async function loadFromFirebase(path)'),
    'wrapper deve executar core dentro de single-flight'
  );
  assert.ok(
    source.indexOf('loadFromFirebaseCore(path)') > source.indexOf('async function loadFromFirebase(path)'),
    'wrapper deve delegar para loadFromFirebaseCore'
  );
});

test('leituras concorrentes do mesmo tenant+path compartilham uma unica promise', async () => {
  let coreCalls = 0;
  let resolveCore;
  const gate = new Promise((resolve) => { resolveCore = resolve; });

  const sandbox = {
    pendingReadFlights: new Map(),
    readCacheStore: new Map(),
    Date, Map, Set, Promise, Object, Array, String, Number, Math, JSON, RegExp,
    getTenantId: () => 'tenant-a',
    authPerfRead() {},
    loadFromFirebaseCore: () => { coreCalls += 1; return gate; },
    console: { log() {}, warn() {}, error() {}, debug() {} }
  };

  const wrapperCode = `
    async function loadFromFirebase(path) {
      const flightKey = (getTenantId() || 'no-tenant') + '::' + String(path || '');
      const existing = pendingReadFlights.get(flightKey);
      if (existing) return existing;
      const flight = (async () => {
        const result = await loadFromFirebaseCore(path);
        return result;
      })();
      pendingReadFlights.set(flightKey, flight);
      try { return await flight; } finally { pendingReadFlights.delete(flightKey); }
    }
  `;

  const run = () => vm.runInNewContext(wrapperCode + '; loadFromFirebase;', sandbox);
  const loadFn = run();

  const p1 = loadFn('especies');
  const p2 = loadFn('especies');
  assert.equal(coreCalls, 1, 'segunda leitura concorrente nao pode chamar core de novo');

  resolveCore({ success: true, data: { a: 1 } });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.deepEqual(r1, { success: true, data: { a: 1 } });
  assert.deepEqual(r2, { success: true, data: { a: 1 } });
  assert.equal(sandbox.pendingReadFlights.size, 0, 'flight precisa ser limpo no finally');
});

test('TTL classifica perfil, cadastros e financeiro por categoria', () => {
  const block = extractBetween(source, 'const READ_TTL_BY_CATEGORY = Object.freeze({', 'function getReadTtlForPath(path) {') +
    '\n' + extractBetween(source, 'function getReadTtlForPath(path) {', 'function readFlightKey(path)');
  const fn = evalInVm(block + '; getReadTtlForPath;');
  assert.equal(fn('users/uid-x'), 5 * 60 * 1000);
  assert.equal(fn('companies/t1/profile'), 5 * 60 * 1000);
  assert.equal(fn('companies/t1/users/uid-x'), 5 * 60 * 1000);
  assert.equal(fn('especies'), 3 * 60 * 1000);
  assert.equal(fn('fornecedores'), 3 * 60 * 1000);
  assert.equal(fn('financas/pagar'), 60 * 1000);
  assert.equal(fn('contasReceber'), 60 * 1000);
  assert.equal(fn('vendas/pedidos'), 60 * 1000);
});

test('invalidateReadCacheForPath limpa o proprio caminho, filhos e pais', () => {
  const block = extractBetween(source, 'function invalidateReadCacheForPath(path) {', '// ✅ FUNÇÃO PRINCIPAL PARA CARREGAR DADOS DO FIREBASE');
  const sandbox = {
    readCacheStore: new Map([
      ['tenant-a::financas', { at: 1 }],
      ['tenant-a::financas/pagar', { at: 1 }],
      ['tenant-a::financas/pagar/conta-1', { at: 1 }],
      ['tenant-a::especies', { at: 1 }],
      ['tenant-b::financas', { at: 1 }]
    ]),
    getTenantId: () => 'tenant-a',
    Map, String
  };
  const fn = vm.runInNewContext(block + '; invalidateReadCacheForPath;', sandbox);
  fn('financas/pagar');
  assert.deepEqual([...sandbox.readCacheStore.keys()].sort(), ['tenant-a::especies', 'tenant-b::financas']);
});

test('cache retorna resultado fresco e escrita invalida o caminho', async () => {
  const calls = [];
  const sandbox = {
    pendingReadFlights: new Map(),
    readCacheStore: new Map(),
    Date, Map, Set, Promise, Object, Array, String, Number, Math, JSON, RegExp,
    getTenantId: () => 'tenant-a',
    getReadTtlForPath: () => 60 * 1000,
    authPerfRead() {},
    loadFromFirebaseCore: (p) => { calls.push(p); return Promise.resolve({ success: true, data: { n: calls.length } }); },
    invalidateReadCacheForPath: (p) => {
      for (const key of [...sandbox.readCacheStore.keys()]) {
        if (key.includes('::' + p)) sandbox.readCacheStore.delete(key);
      }
    },
    console: { log() {}, warn() {}, error() {}, debug() {} }
  };
  const code = `
    async function loadFromFirebase(path) {
      const flightKey = (getTenantId() || 'no-tenant') + '::' + String(path || '');
      const existing = pendingReadFlights.get(flightKey);
      if (existing) return existing;
      const cached = readCacheStore.get(flightKey);
      if (cached && (Date.now() - cached.at) < getReadTtlForPath(path)) return cached.result;
      const flight = (async () => {
        const result = await loadFromFirebaseCore(path);
        if (result && result.success && result.data !== null && result.data !== undefined) {
          readCacheStore.set(flightKey, { result, at: Date.now() });
        }
        return result;
      })();
      pendingReadFlights.set(flightKey, flight);
      try { return await flight; } finally { pendingReadFlights.delete(flightKey); }
    }
  `;
  const loadFn = vm.runInNewContext(code + '; loadFromFirebase;', sandbox);

  const first = await loadFn('especies');
  assert.deepEqual(calls, ['especies']);
  assert.equal(first.data.n, 1);

  const second = await loadFn('especies');
  assert.deepEqual(calls, ['especies'], 'segunda leitura deve vir do cache sem chamar core');
  assert.equal(second.data.n, 1);

  sandbox.invalidateReadCacheForPath('especies');
  const third = await loadFn('especies');
  assert.deepEqual(calls, ['especies', 'especies'], 'apos invalidação deve reler');
  assert.equal(third.data.n, 2);
});

test('escritas do servico raiz invalidam o cache de leituras', () => {
  assert.match(source, /invalidateReadCacheForPath\(path\);/);
  assert.ok(
    source.indexOf('invalidateReadCacheForPath(path);') > source.indexOf('async function saveToFirebase('),
    'saveToFirebase deve invalidar no caminho de escrita'
  );
  assert.match(source, /for \(const key of Object\.keys\(ns \|\| \{\}\)\) invalidateReadCacheForPath\(key\);/);
  assert.ok(
    source.indexOf('invalidateReadCacheForPath(finalDeletePath)') > source.indexOf('async function deleteFromFirebase('),
    'deleteFromFirebase deve invalidar o caminho final'
  );
  assert.match(
    extractBetween(source, 'const flight = (async () => {', '})();'),
    /if \(result && result\.success && result\.data !== null && result\.data !== undefined\)/
  );
  assert.match(
    extractBetween(source, 'const flight = (async () => {', '})();'),
    /readCacheStore\.set\(flightKey, \{ result, at: Date\.now\(\) \}\)/
  );
});