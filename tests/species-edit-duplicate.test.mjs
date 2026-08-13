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

const makeRecord = (species, key, especie, nomeCientifico, updatedAt) => ({
  ...species.toCanonicalRecord({
    id: key, key, firebaseKey: key, originalId: key,
    especie, nomeCientifico, updatedAt, createdAt: '2024-01-01T00:00:00.000Z'
  }, 0, { id: key, updatedAt }),
  key, firebaseKey: key, originalId: key,
  name: especie, nome: especie, nomeComum: especie,
  scientificName: nomeCientifico, scientific: nomeCientifico
});

test('species-utils preserve o originalId ao re-normalizar listas já normalizadas', () => {
  const { SiswebSpecies: tools } = buildSandbox();
  const normalized = tools.normalizeList([
    makeRecord(tools, 'AAA', 'Ipê', 'Handroanthus albus', '2026-01-01T10:00:00.000Z'),
    makeRecord(tools, 'BBB', 'Cedro', 'Cedrela fissilis', '2026-01-01T09:00:00.000Z')
  ]);
  // Re-normalizar a lista consolidada (cenário de getSpeciesList) não pode perder o id real.
  const renormalized = tools.normalizeList(normalized);
  const ipe = renormalized.find((s) => s.especie === 'Ipê');
  assert.ok(ipe, 'Ipê deve sobreviver a re-normalização');
  const ids = [ipe.id, ipe.key, ipe.firebaseKey, ipe.originalId]
    .map((value) => String(value || '').trim());
  assert.ok(ids.includes('AAA'), `id real '$AAA' preservado em ${ids.join(',')}`);
});

test('edicao mudando apenas o nome cientifico nao e bloqueada como duplicata', () => {
  const sandbox = buildSandbox();
  const { SiswebSpecies: tools } = sandbox;
  const { SiswebSpeciesModal: modal } = sandbox;

  const currentSpecies = [
    makeRecord(tools, 'AAA_especie1', 'Ipê', 'Handroanthus albus', '2026-01-01T10:00:00.000Z'),
    makeRecord(tools, 'BBB_especie2', 'Cedro', 'Cedrela fissilis', '2026-01-01T09:00:00.000Z')
  ];

  // Cache local de espécies (como grava o loadFromFirebase)
  const rawCache = {
    AAA_especie1: { id: 'AAA_especie1', especie: 'Ipê', nomeCientifico: 'Handroanthus albus', updatedAt: '2026-01-01T10:00:00.000Z' },
    BBB_especie2: { id: 'BBB_especie2', especie: 'Cedro', nomeCientifico: 'Cedrela fissilis', updatedAt: '2026-01-01T09:00:00.000Z' }
  };
  sandbox.localStorage.setItem('companies/__no_tenant__/especies', JSON.stringify(rawCache));

  // Editar Ipê mudando SOMENTE o nome científico (nome comum inalterado)
  const duplicate = modal.getExactDuplicate('Ipê', 'AAA_especie1', () => currentSpecies);
  assert.equal(duplicate, null, 'a espécie em edição não deve ser reportada como duplicata');

  // Criar com nome realmente duplicado continua bloqueado
  const createDuplicate = modal.getExactDuplicate('Ipê', '', () => currentSpecies);
  assert.ok(createDuplicate, 'criação de nome duplicado continua bloqueada');
});

test('species-modal-standard exporta showModal/hideModal para abertura centralizada', () => {
  const sandbox = buildSandbox();
  const modal = sandbox.SiswebSpeciesModal;
  assert.equal(typeof modal.showModal, 'function');
  assert.equal(typeof modal.hideModal, 'function');
  assert.equal(typeof modal.getExactDuplicate, 'function');
});