import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function buildSandbox(db) {
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
    CustomEvent: globalThis.CustomEvent,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      key: () => null,
      length: 0
    },
    document: {
      readyState: 'complete',
      getElementById: () => makeElement(),
      querySelector: () => makeElement(),
      querySelectorAll: () => [],
      createElement: () => makeElement(),
      addEventListener() {}
    },
    addEventListener() {},
    dispatchEvent() { return true; },
    window: null, global: null,
    setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.firebaseService = db;
  vm.createContext(sandbox);
  vm.runInContext(read('species-utils.js'), sandbox);
  vm.runInContext(read('species-modal-standard.js'), sandbox);
  vm.runInContext(read('species-store.js'), sandbox);
  vm.runInContext(read('modules/crud/species-crud.js'), sandbox);
  return sandbox;
}

function makeDb(seed) {
  const data = { ...(seed || {}) };
  const calls = { saveToFirebase: 0, loadFromFirebase: 0 };
  return {
    calls,
    data,
    async saveToFirebase(path, key, payload) {
      calls.saveToFirebase += 1;
      data[String(key)] = { ...payload };
      return { success: true };
    },
    async loadFromFirebase() {
      calls.loadFromFirebase += 1;
      return { success: true, data: { ...data } };
    },
    invalidateCache() {},
    invalidateCollectionCache() {},
    getTenantId: () => 'tenant_teste',
    getNamespacedPath: (p) => `companies/tenant_teste/${p}`
  };
}

test('SpeciesCRUD exporta API canonica', () => {
  const sandbox = buildSandbox(makeDb());
  const crud = sandbox.SpeciesCRUD;
  for (const fn of ['save', 'remove', 'resolveRecordId', 'matchesId', 'findDuplicate', 'invalidateAll']) {
    assert.equal(typeof crud[fn], 'function', `${fn} deve existir`);
  }
});

test('SpeciesCRUD.save cria registro com id e verifica leitura', async () => {
  const db = makeDb();
  const sandbox = buildSandbox(db);
  const res = await sandbox.SpeciesCRUD.save({ name: 'Mista', scientific: '' });
  assert.equal(res.success, true);
  assert.ok(res.id, 'id gerado');
  assert.equal(res.verified, true, 'read-back deve confirmar o registro');
  assert.ok(db.data[res.id], 'registro persistido no firebase');
  assert.equal(db.data[res.id].especie, 'Mista');
});

test('SpeciesCRUD.save edita mantendo o mesmo id', async () => {
  const db = makeDb({ AAA: { id: 'AAA', especie: 'Ipe', nomeCientifico: '' } });
  const sandbox = buildSandbox(db);
  const res = await sandbox.SpeciesCRUD.save({ id: 'AAA', name: 'Ipe', scientific: 'Handroanthus' });
  assert.equal(res.success, true);
  assert.equal(res.id, 'AAA');
  assert.equal(res.isEdit, true);
  assert.equal(db.data.AAA.nomeCientifico, 'Handroanthus');
});

test('SpeciesCRUD.save concorrente no mesmo registro faz uma unica escrita', async () => {
  const db = makeDb();
  const sandbox = buildSandbox(db);
  const [a, b] = await Promise.all([
    sandbox.SpeciesCRUD.save({ id: 'X1', name: 'Mista' }),
    sandbox.SpeciesCRUD.save({ id: 'X1', name: 'Mista' })
  ]);
  assert.equal(a.success, true);
  assert.equal(b.success, true);
  assert.equal(a.id, b.id);
  assert.equal(db.calls.saveToFirebase, 1, 'write fisico unico via trava inflight');
});

test('SpeciesCRUD.save rejeita nome vazio sem tocar no firebase', async () => {
  const db = makeDb();
  const sandbox = buildSandbox(db);
  await assert.rejects(() => sandbox.SpeciesCRUD.save({ name: '   ' }), /obrigatório/);
  assert.equal(db.calls.saveToFirebase, 0);
});

test('SpeciesCRUD.resolveRecordId unifica aliases de id', () => {
  const sandbox = buildSandbox(makeDb());
  const crud = sandbox.SpeciesCRUD;
  assert.equal(crud.resolveRecordId({ firebaseKey: 'K1' }), 'K1');
  assert.equal(crud.resolveRecordId({ key: 'K2' }), 'K2');
  assert.equal(crud.resolveRecordId({ id: 'K3' }), 'K3');
  assert.equal(crud.resolveRecordId({ originalId: 'K4' }), 'K4');
  assert.equal(crud.resolveRecordId({}), '');
  assert.ok(crud.matchesId({ key: 'K2', originalId: 'OLD' }, 'K2'));
  assert.ok(!crud.matchesId({ id: 'A' }, 'B'));
});

test('SpeciesCRUD.remove exige id e usa deleteData', async () => {
  const db = makeDb({ DEL: { id: 'DEL', especie: 'X' } });
  db.deleteData = async (path) => {
    assert.match(path, /especies\/DEL/);
    delete db.data.DEL;
    return { success: true };
  };
  const sandbox = buildSandbox(db);
  const res = await sandbox.SpeciesCRUD.remove('DEL');
  assert.equal(res.success, true);
  await assert.rejects(() => sandbox.SpeciesCRUD.remove('  '), /inválido/);
});
