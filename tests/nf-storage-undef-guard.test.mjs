import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const serviceSrc = readFileSync('firebaseService.js', 'utf8');
const storageSrc = readFileSync('nf-storage.js', 'utf8');

function loadDeepStrip() {
  const match = serviceSrc.match(/function deepStripUndefined\(value\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'deepStripUndefined não encontrada em firebaseService.js');
  const context = {};
  vm.runInNewContext(`${match[0]}; this.deepStripUndefined = deepStripUndefined;`, context);
  return context.deepStripUndefined;
}

function loadNFStorage(mock) {
  const context = { window: { firebaseService: mock }, console: { log() {}, warn() {}, error() {} } };
  vm.runInNewContext(storageSrc, context);
  return context.window.NFStorage;
}

test('firebaseService: sanitiza undefined profundo ANTES de qualquer ramo de escrita', () => {
  assert.match(serviceSrc, /function deepStripUndefined\(value\)/);
  const posClean = serviceSrc.indexOf('data = deepStripUndefined(data);');
  const posNullBranch = serviceSrc.indexOf('if (key === null || key === undefined) {');
  assert.ok(posClean > 0, 'sanitização deve ser aplicada no início do fluxo');
  assert.ok(posClean < posNullBranch, 'sanitização deve vir antes dos ramos de escrita');
});

test('deepStripUndefined: remove undefined em objetos, preserva falsy válidos e datas', () => {
  const clean = loadDeepStrip();
  const entrada = {
    a: undefined,
    b: { c: undefined, d: 1, e: { f: undefined, g: 'x' } },
    zero: 0,
    falso: false,
    vazio: '',
    nulo: null,
    data: new Date('2026-10-13T00:00:00Z'),
    lista: [undefined, { h: undefined, i: 2 }],
  };
  const saida = clean(entrada);
  const plain = (v) => JSON.parse(JSON.stringify(v));
  assert.equal('a' in saida, false);
  assert.deepEqual(plain(saida.b), { d: 1, e: { g: 'x' } });
  assert.equal(saida.zero, 0);
  assert.equal(saida.falso, false);
  assert.equal(saida.vazio, '');
  assert.equal(saida.nulo, null);
  assert.ok(saida.data instanceof Date);
  assert.equal(saida.lista.length, 2);
  assert.equal(saida.lista[0], null, 'undefined em array vira null (RTDB rejeita undefined)');
  assert.deepEqual(plain(saida.lista[1]), { i: 2 });
});

test('deepStripUndefined: payload de NF-e com undefined aninhado fica gravável', () => {
  const clean = loadDeepStrip();
  const nota = {
    id: 'nf_1', numero: '000001690', status: 'aguardando',
    respTec: undefined, cobr: undefined,
    det: [{ ncm: '44071100', cest: undefined, importado: undefined, imposto: { icbsbs: undefined, icms: { vBC: 100 } } }],
  };
  const saida = clean(nota);
  assert.equal('respTec' in saida, false);
  assert.equal('cobr' in saida, false);
  assert.equal('cest' in saida.det[0], false);
  assert.equal('importado' in saida.det[0], false);
  assert.equal('icbsbs' in saida.det[0].imposto, false);
  assert.equal(saida.det[0].imposto.icms.vBC, 100);
});

test('NFStorage.salvarNF: fail-closed quando saveToFirebase devolve success:false', async () => {
  const api = loadNFStorage({
    saveToFirebase: async () => ({ success: false, error: 'set failed: value argument contains undefined' }),
    loadFromFirebase: async () => ({ success: true, data: null }),
  });
  await assert.rejects(
    () => api.salvarNF('t1', { modelo: 55, numero: '000001690', status: 'aguardando' }),
    /set failed|salvar NF/i,
  );
  const ok = loadNFStorage({
    saveToFirebase: async () => ({ success: true }),
    loadFromFirebase: async () => ({ success: true, data: null }),
  });
  const res = await ok.salvarNF('t1', { modelo: 55, numero: '000001690', status: 'aguardando' });
  assert.match(res.id, /^nf_/);
  assert.match(res.path, /^companies\/t1\/fiscal\/notas\/nfe\//);
});

test('NFStorage.atualizarStatus: fail-closed quando saveToFirebase devolve success:false', async () => {
  const api = loadNFStorage({
    loadFromFirebase: async () => ({ success: true, data: { id: 'nf_1', status: 'aguardando' } }),
    saveToFirebase: async () => ({ success: false, error: 'value argument contains undefined' }),
  });
  await assert.rejects(
    () => api.atualizarStatus('t1', 55, 'nf_1', 'erro_envio', { cStat: '1026' }),
    /undefined|atualizar a NF-e/i,
  );
  const ok = loadNFStorage({
    loadFromFirebase: async () => ({ success: true, data: { id: 'nf_1' } }),
    saveToFirebase: async () => ({ success: true }),
  });
  await ok.atualizarStatus('t1', 55, 'nf_1', 'autorizada');
});
