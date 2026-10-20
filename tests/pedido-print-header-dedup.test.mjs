import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const vendas = fs.readFileSync('vendas.js', 'utf8');
const compras = fs.readFileSync('compras.js', 'utf8');
const print = fs.readFileSync('commerce-pdf-share.js', 'utf8');

test('pedido de venda/compra imprime numero e datas uma unica vez', () => {
  assert.match(vendas, /title: 'Pedido de Venda'/);
  assert.match(compras, /title: 'Pedido de Compra'/);
  assert.doesNotMatch(vendas, /title: `Pedido de Venda N/);
  assert.doesNotMatch(compras, /title: `Pedido de Compra N/);
  assert.doesNotMatch(vendas, /<strong>Número:<\/strong>/);
  assert.doesNotMatch(compras, /<strong>Número:<\/strong>/);
  assert.doesNotMatch(vendas, /<strong>Emissão:<\/strong>/);
  assert.doesNotMatch(compras, /<strong>Emissão:<\/strong>/);
  assert.match(print, /Impresso em: .* às /);
});

test('compras define unidadeTexto para visualizacao de pedidos', () => {
  assert.match(compras, /function unidadeTexto\(u\)/);
});

test('print standalone define tokens e evita titulo quebrado', () => {
  assert.match(print, /:root \{\s*--sw-brand:/);
  assert.match(print, /\.sisweb-print-title \{[\s\S]*?overflow-wrap: anywhere/);
});
