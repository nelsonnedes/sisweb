import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function buildSandbox() {
  const store = new Map();
  const makeElement = () => ({
    nodeType: 1,
    classList: { add() {}, remove() {}, contains() { return false; } },
    style: {},
    dataset: {},
    setAttribute() {}, getAttribute() { return null; },
    value: '', innerHTML: '', textContent: '',
    querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, insertAdjacentElement() {}, parentNode: null,
    addEventListener() {}, dispatchEvent() {},
    offsetWidth: 0, offsetHeight: 0, focus() {}
  });
  const sandbox = {
    console,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      key: (i) => Array.from(store.keys())[i] || null,
      get length() { return store.size; }
    },
    document: {
      readyState: 'complete',
      activeElement: null,
      getElementById: () => makeElement(),
      querySelector: () => makeElement(),
      querySelectorAll: () => [],
      createElement: () => makeElement(),
      addEventListener() {}
    },
    addEventListener() {},
    window: null, global: null,
    setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('species-utils.js'), sandbox);
  vm.runInContext(read('species-modal-standard.js'), sandbox);
  return sandbox;
}

const seedSpecies = (sandbox, key, records) => {
  sandbox.localStorage.setItem(key, JSON.stringify(records));
};

test('merge ignora window.getData (fonte imprevisivel de outros modulos)', () => {
  const sandbox = buildSandbox();
  const { SiswebSpeciesModal: modal } = sandbox;
  seedSpecies(sandbox, 'companies/__no_tenant__/especies', {
    S1: { id: 'S1', especie: 'Ipe', nomeCientifico: '' }
  });
  // Simula outro módulo (ex.: fornecedor-modals) vencendo a disputa pelo global.
  sandbox.getData = () => ({ c1: { nome: 'Cliente Fantasma', descricao: 'Lista de Clientes' } });
  assert.equal(modal.getExactDuplicate('Cliente Fantasma', ''), null);
  assert.ok(modal.getExactDuplicate('Ipe', ''), 'especie namespaced continua valida');
});

test('fonte explicita vazia e autoritativa: nao faz merge com caches', () => {
  const sandbox = buildSandbox();
  const { SiswebSpeciesModal: modal } = sandbox;
  seedSpecies(sandbox, 'companies/__no_tenant__/especies', {
    G1: { id: 'G1', especie: 'Teste3', nomeCientifico: '' }
  });
  assert.deepEqual(modal.getSpeciesList(() => []), []);
  assert.equal(modal.getExactDuplicate('Teste3', '', () => []), null);
});

test('chaves avulsas sem namespace nao alimentam o merge', () => {
  const sandbox = buildSandbox();
  const { SiswebSpeciesModal: modal } = sandbox;
  seedSpecies(sandbox, 'especies', {
    G9: { id: 'G9', especie: 'Teste3', nomeCientifico: '' }
  });
  assert.equal(modal.getExactDuplicate('Teste3', ''), null);
  seedSpecies(sandbox, 'companies/__no_tenant__/especies', {
    S2: { id: 'S2', especie: 'Teste3', nomeCientifico: '' }
  });
  assert.ok(modal.getExactDuplicate('Teste3', ''), 'namespaced continua valendo');
});
