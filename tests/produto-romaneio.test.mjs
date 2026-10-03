import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const src = readFileSync(new URL('../vendas.js', import.meta.url), 'utf8');

function extract(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nf ' + name);
  const j = src.indexOf('{', i);
  let d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(extract('calcularVolumeSerradoM3'), sandbox);
const calc = sandbox.calcularVolumeSerradoM3;

test('volume serrado: 2.5 x 15 x 300 cm x 10 pçs', () => {
  // 2.5*15*300/1e6 = 0.01125 m³/pc × 10 ≈ 0.112 (float) em 3 casas
  assert.equal(calc(2.5, 15, 300, 10, 1), 0.112);
});

test('volume serrado: ppp multiplica (PCT)', () => {
  assert.equal(calc(2.5, 15, 300, 10, 2), 0.225);
});

test('volume serrado: zero quando dimensão falta', () => {
  assert.equal(calc(0, 15, 300, 10, 1), 0);
  assert.equal(calc('', 15, 300, 10, 1), 0);
  assert.equal(calc(2.5, 15, 300, 0, 1), 0);
});

test('volume serrado: aceita vírgula decimal pt-BR', () => {
  assert.equal(calc('2,5', '15', '300', 10, 1), 0.112);
});

test('salvarProduto persiste campos do romaneio', () => {
  assert.ok(/produto\.tipoProduto = 'romaneio'/.test(src), 'tipoProduto persistido');
  assert.ok(/produto\.volumeM3 = calcularVolumeSerradoM3/.test(src), 'volumeM3 persistido');
  assert.ok(/produto\.romaneioId = d\.romaneioId/.test(src), 'romaneioId persistido');
});
