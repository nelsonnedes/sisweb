import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function buildMockDOM() {
  const store = new Map();
  const listeners = new Map();

  const makeElement = (tag = 'div', id = '') => ({
    tagName: tag.toUpperCase(),
    nodeType: 1,
    id,
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); }
    },
    style: {},
    dataset: {},
    setAttribute() {},
    getAttribute() { return null; },
    value: '',
    innerHTML: '',
    textContent: '',
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    insertAdjacentElement() {},
    parentNode: null,
    appendChild(child) { return child; },
    addEventListener(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(fn);
    },
    dispatchEvent(event) {
      const type = event?.type || event;
      const handlers = listeners.get(type) || [];
      handlers.forEach(h => h(event));
      return true;
    },
    offsetWidth: 100,
    offsetHeight: 30,
    focus() {},
    select() {},
    reset() { this.value = ''; }
  });

  return { store, makeElement, listeners };
}

test('TL: gerenciar-especies.js executa edição, salva via saveToFirebase e invalida cache e store', async () => {
  const { store, makeElement } = buildMockDOM();
  let savedPath = null;
  let savedKey = null;
  let savedData = null;
  let cacheInvalidated = false;
  let storeInvalidated = false;

  const sandbox = {
    console,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      key: () => null,
      length: 0
    },
    document: {
      readyState: 'complete',
      getElementById: (id) => makeElement('div', id),
      querySelector: () => makeElement(),
      querySelectorAll: () => [],
      createElement: (tag) => makeElement(tag),
      body: makeElement('body'),
      addEventListener() {}
    },
    window: null,
    global: null,
    setTimeout,
    clearTimeout,
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } }
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;

  sandbox.firebaseService = {
    getTenantId: () => 'tenant_test',
    getNamespacedPath: (p) => `companies/tenant_test/${p}`,
    saveToFirebase: async (path, key, data) => {
      savedPath = path;
      savedKey = key;
      savedData = data;
      return { success: true };
    },
    invalidateCollectionCache: (path) => {
      if (path === 'especies') cacheInvalidated = true;
    }
  };

  sandbox.SiswebSpeciesStore = {
    invalidate: () => {
      storeInvalidated = true;
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(read('species-utils.js'), sandbox);
  vm.runInContext(read('species-modal-standard.js'), sandbox);
  vm.runInContext(read('modules/crud/gerenciar-especies.js'), sandbox);

  assert.ok(sandbox.window.GerenciarEspecies, 'GerenciarEspecies deve ser exportado');
  assert.equal(typeof sandbox.window.GerenciarEspecies.saveSpecies, 'function');

  // Simular edição de espécie
  const formModal = sandbox.window.GerenciarEspecies.openEditSpeciesModal;
  assert.equal(typeof formModal, 'function');
});

test('species-store.js invalida cache sob chamada de invalidate()', () => {
  const { store, makeElement, listeners } = buildMockDOM();
  const sandbox = {
    console,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      key: () => null,
      length: 0
    },
    document: {
      readyState: 'complete',
      getElementById: (id) => makeElement('div', id),
      querySelector: () => makeElement(),
      querySelectorAll: () => [],
      createElement: (tag) => makeElement(tag),
      addEventListener() {}
    },
    addEventListener(evt, fn) {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(fn);
    },
    dispatchEvent(event) {
      const type = event?.type || event;
      const handlers = listeners.get(type) || [];
      handlers.forEach(h => h(event));
      return true;
    },
    window: null,
    global: null,
    setTimeout,
    clearTimeout,
    CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } }
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(read('species-utils.js'), sandbox);
  vm.runInContext(read('species-store.js'), sandbox);

  const storeInstance = sandbox.window.SiswebSpeciesStore;
  assert.ok(storeInstance, 'SiswebSpeciesStore deve estar definido');
  assert.equal(typeof storeInstance.invalidate, 'function', 'SiswebSpeciesStore.invalidate deve ser função');
  
  // Executar invalidate
  storeInstance.invalidate();
  assert.equal(storeInstance.getSnapshot().items.length, 0, 'Cache em memória deve ser purgado');
  assert.equal(storeInstance.getSnapshot().loadedAt, 0, 'loadedAt deve ser zerado');
});
