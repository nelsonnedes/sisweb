import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// Trava de inventário: novas definições de window.getData precisam ser
// registradas aqui (migração para SiswebData em andamento).
test('inventario de definidores window.getData conhecido', () => {
  const hits = [];
  const scan = (file) => {
    const src = read(file);
    if (/window\.getData\s*=/.test(src)) hits.push(file);
  };
  const roots = ['client-service.js', 'fornecedor-modals.js', 'fornecedor-manager.js',
    'database-adapter.js', 'database-utils.js', 'data-functions.js', 'utils.js',
    'romaneiotora.js', 'romaneio-firebase-service.js', 'romaneiopct_funcoes.js',
    'romaneiotora_modais.js', 'vendas.js', 'estoque.js', 'compras.js', 'notas-fiscais.js',
    'financas.js', 'folha_pagamento/folha-firebase-manager.js', 'standardized-client-modal.js'];
  for (const f of roots) {
    try { scan(f); } catch (_) {}
  }
  for (const f of hits) {
    assert.ok(roots.includes(f), `novo definidor inesperado: ${f}`);
  }
  assert.ok(hits.length >= 8, 'inventário deve cobrir os definidores conhecidos');
  assert.ok(!read('modules/core/sisweb-data.js').includes('window.getData ='),
    'namespace canônico não deve disputar o global');
});

function buildSandbox(service) {
  const sandbox = {
    console,
    localStorage: {
      _m: new Map(),
      getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
      setItem(k, v) { this._m.set(k, String(v)); },
      removeItem(k) { this._m.delete(k); }
    },
    window: null,
    setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  if (service) sandbox.firebaseService = service;
  vm.createContext(sandbox);
  vm.runInContext(read('modules/core/sisweb-data.js'), sandbox);
  return sandbox;
}

test('SiswebData.get normaliza retorno do service', async () => {
  const sandbox = buildSandbox({
    async loadFromFirebase() { return { success: true, data: { a: 1 }, source: 'x' }; }
  });
  const res = await sandbox.SiswebData.get('clients');
  assert.equal(res.success, true);
  assert.deepEqual(res.data, { a: 1 });
});

test('SiswebData.get cai para localStorage namespaced sem service', async () => {
  const sandbox = buildSandbox(null);
  sandbox.localStorage.setItem('companies/t1/clients', JSON.stringify([{ id: '1' }]));
  const tribal = await sandbox.SiswebData.get('companies/t1/clients');
  assert.equal(tribal.success, true);
  assert.equal(JSON.stringify(tribal.data), JSON.stringify([{ id: '1' }]));
  const missing = await sandbox.SiswebData.get('nope');
  assert.equal(missing.success, false);
});

test('SiswebData.save prefere saveToFirebase 3-arg', async () => {
  const calls = [];
  const sandbox = buildSandbox({
    async saveToFirebase(p, k, d) { calls.push(['tbf', p, k, d]); return { success: true }; },
    async saveData(k, d) { calls.push(['sd', k, d]); return { success: true }; }
  });
  const res = await sandbox.SiswebData.save('clients', 'c1', { id: 'c1' });
  assert.equal(res.success, true);
  assert.deepEqual(calls, [['tbf', 'clients', 'c1', { id: 'c1' }]]);
});

test('SiswebData.save usa saveData caminho completo quando saveToFirebase ausente', async () => {
  const calls = [];
  const sandbox = buildSandbox({
    async saveData(k, d) { calls.push([k, d]); return { success: true }; }
  });
  await sandbox.SiswebData.save('clients', 'c9', { id: 'c9' });
  assert.deepEqual(calls, [['clients/c9', { id: 'c9' }]]);
});

// Strangler PCT: data-functions.js e utils.js não disputam os globais legados
// (data-functions em IIFE só com espaço; utils expõe fallback em LocalStore).
test('pct nao disputa os globais legados (data-functions/utils)', () => {
  const df = read('data-functions.js');
  assert.doesNotMatch(df, /window\.getData\s*=/);
  assert.doesNotMatch(df, /window\.saveData\s*=/);
  const utils = read('utils.js');
  assert.doesNotMatch(utils, /window\.getData\s*=/);
  assert.doesNotMatch(utils, /window\.saveData\s*=/);
  assert.doesNotMatch(utils, /typeof window\.getData/);
  assert.doesNotMatch(utils, /typeof window\.saveData/);
  assert.match(utils, /window\.LocalStore/);
});
