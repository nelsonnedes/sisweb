import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/unidades.js', 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const U = sandbox.SiswebUnidades;

test('normaliza Metro Linear para LN e preserva unidades usuais', () => {
  for (const value of ['ML', 'ml', 'LN', 'Ln', 'm', 'mt', 'Metro Linear', 'METROS LINEARES']) {
    assert.equal(U.normalizar(value), 'LN', value);
    assert.equal(U.texto(value), 'LN', value);
  }
  assert.equal(U.normalizar('UN'), 'UN');
  assert.equal(U.normalizar('Un'), 'UN');
  assert.equal(U.normalizar('PC'), 'PC');
  assert.equal(U.normalizar('M3'), 'm³');
  assert.equal(U.normalizar('M²'), 'm²');
  assert.equal(U.normalizar('kg'), 'kg');
});

test('rótulo de formulário usa sigla e nome; fiscal permanece ML', () => {
  assert.equal(U.nome('LN'), 'LN - Metro Linear');
  assert.equal(U.nome('ML'), 'LN - Metro Linear');
  assert.equal(U.nome('UN'), 'UN - Unidade');
  assert.equal(U.fiscal('LN'), 'ML');
  assert.equal(U.fiscal('Metro Linear'), 'ML');
  assert.equal(U.fiscal('M³'), 'M³');
});

test('selects operacionais exibem LN - Metro Linear', () => {
  const vendas = fs.readFileSync('vendas.html', 'utf8');
  const compras = fs.readFileSync('compras.html', 'utf8');
  const estoque = fs.readFileSync('estoque-madeira-serrada.html', 'utf8');
  for (const html of [vendas, compras, estoque]) {
    assert.match(html, /<option value="LN">LN - Metro Linear<\/option>/);
  }
  assert.equal((vendas.match(/<option value="LN">LN - Metro Linear<\/option>/g) || []).length, 3);
});

test('listas/impressões usam LN em vez de ml', () => {
  const vendas = fs.readFileSync('vendas.js', 'utf8');
  const estoque = fs.readFileSync('js/estoque-madeira-serrada.js', 'utf8');
  const pre = fs.readFileSync('preromaneio.js', 'utf8');
  assert.doesNotMatch(vendas, /metrosLinearesDe\(p\).*?\+ ' ml'/);
  assert.doesNotMatch(vendas, /formatNumber\(metrosLinearesDe\(produto\), 2\) \+ ' ml'/);
  assert.doesNotMatch(estoque, /metrosLineares\(p\), 2\) \+ ' ml'/);
  assert.match(pre, /formatDecimalBR\(ml, 3, ' LN'\)/);
  const config = fs.readFileSync('romaneio-print-config.js', 'utf8');
  assert.doesNotMatch(config, /label: 'ml'/);
  assert.match(config, /label: 'LN'/);
});

test('Vendas não aplica title-case em unidade (LN não vira Ln)', () => {
  const vendas = fs.readFileSync('vendas.js', 'utf8');
  assert.match(vendas, /SiswebUnidades\.normalizar\(unidadeRaw\)/);
  assert.doesNotMatch(vendas, /const unidade = isAllCaps\(unidadeRaw\) \? toTitleCasePt\(unidadeRaw\)/);
});
