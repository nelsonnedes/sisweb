import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const vendas = fs.readFileSync(new URL('../vendas.js', import.meta.url), 'utf8');
const compras = fs.readFileSync(new URL('../compras.js', import.meta.url), 'utf8');
const vendasHtml = fs.readFileSync(new URL('../vendas.html', import.meta.url), 'utf8');
const comprasHtml = fs.readFileSync(new URL('../compras.html', import.meta.url), 'utf8');
const responsiveCss = fs.readFileSync(new URL('../commerce-responsive.css', import.meta.url), 'utf8');

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `Inicio ausente: ${start}`);
  assert.notEqual(to, -1, `Fim ausente: ${end}`);
  return source.slice(from, to);
}

test('lista de vendas oferece clonagem sem persistencia imediata', () => {
  const block = between(vendas, 'async function clonarPedido(', 'async function excluirPedido(');
  assert.match(vendas, /onclick="clonarPedido\('\$\{safeId\}'\)"/);
  assert.match(block, /await novoPedido\(\)/);
  assert.match(block, /pedidoStatus'\)\.value = 'pendente'/);
  assert.match(block, /editandoPedidoId = null/);
  assert.match(block, /delete clone\.id/);
  assert.match(block, /delete clone\.historicosPagamento/);
  assert.doesNotMatch(block, /saveData|saveToFirebase|updatePaths/);
});

test('lista de compras oferece clonagem com novo numero e sem vinculo financeiro', () => {
  const block = between(compras, 'async function clonarPedido(', 'async function excluirPedido(');
  assert.match(compras, /onclick="clonarPedido\('\$\{safeId\}'\)"/);
  assert.match(block, /novoPedido\(false\)/);
  assert.match(block, /await generateOrderNumber\(\)/);
  assert.match(block, /pedidoStatus'\)\.value = 'pendente'/);
  assert.match(block, /pedidoEmEdicao = null/);
  assert.match(block, /delete clone\.id/);
  assert.match(block, /delete clone\.historicosPagamento/);
  assert.doesNotMatch(block, /saveData|saveToFirebase|updatePaths/);
});

test('clones sao expostos somente como acoes de interface', () => {
  assert.match(vendas, /window\.clonarPedido = clonarPedido/);
  assert.match(compras, /window\.clonarPedido = clonarPedido/);
  assert.match(vendas, /title="Clonar" aria-label="Clonar pedido"/);
  assert.match(compras, /title="Clonar" aria-label="Clonar pedido"/);
});

test('quarta acao cabe no desktop e no card responsivo', () => {
  assert.match(vendasHtml, /td\.acoes-cell\s*\{[\s\S]*?min-width:\s*164px/);
  assert.match(comprasHtml, /td\.acoes-cell\s*\{[\s\S]*?min-width:\s*164px/);
  assert.match(responsiveCss, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
});
