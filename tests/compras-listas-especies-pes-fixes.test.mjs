import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Trava os 4 itens do log do usuário (Lista PES, species, Compras/Produtos, Pedido de Compras).
const pesSrc = readFileSync('romaneiopes.html', 'utf8');
const speciesJs = readFileSync('js/species.js', 'utf8');
const speciesManager = readFileSync('species-manager.js', 'utf8');
const comprasJs = readFileSync('compras.js', 'utf8');
const comprasHtml = readFileSync('compras.html', 'utf8');

test('PES deleteRomaneio purga multi-chave com fail-closed (padrão PCT)', () => {
  assert.match(pesSrc, /alvo\.firebaseKey, alvo\.key, alvo\.id, alvo\.numero/);
  assert.match(pesSrc, /removeFromFirebase\(`romaneios\/pes\/\$\{k\}`\)/);
  assert.match(pesSrc, /Falha ao excluir romaneio no servidor/);
});

test('PES deleteRomaneio purga espelhos locais (anti-ressurreição)', () => {
  assert.match(pesSrc, /getLocalStorageKeys\('romaneios\/pes'\)/);
  assert.match(pesSrc, /romaneiosPesModalList = romaneiosPesModalList\.filter/);
});

test('lista de espécies ignora nós de metadado da coleção', () => {
  assert.match(speciesJs, /k !== '_metadata' && k !== 'metadata'/);
  assert.match(speciesManager, /k !== '_metadata' && k !== 'metadata'/);
  // fallback sem normalizeList também usa os dados filtrados
  assert.match(speciesJs, /Object\.keys\(rawData\)\.map/);
  // auto-clean enxerga o placeholder como vazio
  assert.match(speciesJs, /nome === 'Nome não informado'/);
});

test('exclusão de espécie é otimista com restauração em falha', () => {
  assert.match(speciesJs, /Remoção otimista/);
  assert.match(speciesJs, /currentSpecies = \(currentSpecies \|\| \[\]\)\.filter\(s => !aliasMatch\(s\)\)/);
});

test('aba Pedido de Compras não abre o modal sozinha (paridade vendas)', () => {
  assert.doesNotMatch(comprasJs, /if \(tabId === 'pedidos'\) listarPedidos\(\);/);
  // abrir pelo botão e pós-save/delete continua funcionando
  assert.match(comprasHtml, /onclick="listarPedidos\(\)"/);
});

test('Lista de Produtos de compras é modal com seleção em massa (paridade vendas)', () => {
  assert.match(comprasHtml, /id="listaProdutosModal"/);
  assert.match(comprasHtml, /compraProdutosSelectAll/);
  assert.match(comprasHtml, /imprimirProdutosSelecionadosCompra\(\)/);
  assert.match(comprasHtml, /excluirProdutosSelecionadosCompra\(\)/);
  assert.match(comprasJs, /function toggleSelecionarTodosProdutosCompra/);
  assert.match(comprasJs, /function toggleSelecionarProdutoCompra/);
  assert.match(comprasJs, /function imprimirRelatorioProdutosCompra/);
  assert.match(comprasJs, /function excluirProdutosSelecionadosCompra/);
  assert.match(comprasJs, /comprasProdutosSelecionados/);
  assert.match(comprasJs, /id="listaProdutosModal"|getElementById\('listaProdutosModal'\)/);
});
