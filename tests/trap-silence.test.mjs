import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function bootSandbox(files) {
  const warns = [];
  const sandbox = {
    console: {
      log() {},
      warn(msg) { warns.push(String(msg)); },
      error() {}
    },
    localStorage: {
      _m: new Map(),
      getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
      setItem(k, v) { this._m.set(k, String(v)); },
      removeItem(k) { this._m.delete(k); }
    },
    document: { addEventListener() {} },
    setTimeout,
    clearTimeout
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(read(f), sandbox, { filename: f });
  return { sandbox, warns };
}

// Ordem real das páginas: armadilha A4 primeiro, depois os scripts migrados.
// Prova runtime (além do estático) de que o boot não dispara depreciação.
test('boot com trap: scripts migrados emitem zero warns', () => {
  const { sandbox, warns } = bootSandbox([
    'modules/core/legacy-deprecation.js',
    'modules/core/sisweb-data.js',
    'data-functions.js',
    'utils.js',
    'folha_pagamento/folha-firebase-manager.js'
  ]);
  const stats = sandbox.window.__siswebLegacy.stats();
  assert.deepEqual(warns, []);
  assert.equal(stats.reads, 0);
  assert.equal(stats.overwrites, 0);
  assert.equal(typeof sandbox.window.FolhaDB, 'object');
  assert.equal(typeof sandbox.window.FolhaDB.getData, 'function');
  assert.equal(typeof sandbox.window.LocalStore, 'object');
  assert.equal(typeof sandbox.window.cleanOldData, 'function');
});

test('LocalStore mantém canonicalização species->especies', () => {
  const { sandbox, warns } = bootSandbox([
    'modules/core/legacy-deprecation.js',
    'utils.js'
  ]);
  sandbox.window.LocalStore.saveData('species', [{ id: 'x' }]);
  assert.equal(JSON.stringify(sandbox.window.LocalStore.getData('especies')), JSON.stringify([{ id: 'x' }]));
  assert.deepEqual(warns, []);
});
