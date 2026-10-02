import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

function extractFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('função não encontrada: ' + name);
  const j = src.indexOf('{', i);
  let d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('chaves desbalanceadas: ' + name);
}

function load(names, file) {
  const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(names.map((n) => extractFn(src, n)).join('\n'), sandbox);
  return sandbox;
}

const compras = load(
  ['toUTCDateConta', 'diffDaysISOConta', 'reordenarParaOriginalPagar', 'redistribuirProgressivoParcelasPagar'],
  'compras.js'
);
const vendas = load(
  ['diffDaysISO', 'reordenarParaOriginal', 'redistribuirProgressivoParcelas'],
  'vendas.js'
);

const vals = (r) => (r.parcelas || []).map((p) => p.valor);

function caso3x10k(fn) {
  const mk = (id, v) => ({ id, valor: v, vencimento: '2026-10-02', baseVencimento: '2026-10-02', dias: 0 });
  return fn([mk('a', 10000), mk('b', 10000), mk('c', 10000)], 'a', 20000, 30000);
}

test('compras: 3x10k mesma data, 1a->20k redistribui 20k/5k/5k', () => {
  const r = caso3x10k(compras.redistribuirProgressivoParcelasPagar);
  assert.equal(r.success, true);
  assert.deepEqual(vals(r), [20000, 5000, 5000]);
});

test('vendas: 3x10k mesma data, 1a->20k redistribui 20k/5k/5k', () => {
  const r = caso3x10k(vendas.redistribuirProgressivoParcelas);
  assert.equal(r.success, true);
  assert.deepEqual(vals(r), [20000, 5000, 5000]);
});

test('compras: datas diferentes respeitam ordem de vencimento', () => {
  const mk = (id, v, dias, venc) => ({ id, valor: v, vencimento: venc, baseVencimento: venc, dias });
  const r = compras.redistribuirProgressivoParcelasPagar(
    [mk('a', 10000, 30, '2026-11-01'), mk('b', 10000, 60, '2026-12-01'), mk('c', 10000, 90, '2027-01-01')],
    'a', 20000, 30000);
  assert.equal(r.success, true);
  assert.deepEqual(vals(r), [20000, 5000, 5000]);
});

test('compras: empate de dias preserva ordem visual (edita a do meio)', () => {
  const mk = (id, v) => ({ id, valor: v, vencimento: '2026-10-02', baseVencimento: '2026-10-02', dias: 0 });
  const r = compras.redistribuirProgressivoParcelasPagar(
    [mk('a', 10000), mk('b', 10000), mk('c', 10000)], 'b', 14000, 30000);
  assert.equal(r.success, true);
  // a anterior mantém, b fixada, c absorve o restante
  assert.deepEqual(vals(r), [10000, 14000, 6000]);
});

test('vendas: valor acima do total falha com mensagem (sem crash)', () => {
  const mk = (id, v) => ({ id, valor: v, vencimento: '2026-10-02', baseVencimento: '2026-10-02', dias: 0 });
  const r = vendas.redistribuirProgressivoParcelas(
    [mk('a', 10000), mk('b', 10000)], 'a', 99999, 20000);
  assert.equal(r.success, false);
  assert.ok(typeof r.message === 'string' && r.message.length > 0);
});
