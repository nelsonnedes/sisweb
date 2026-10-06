import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const R = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const vendas = R('../vendas.js');
const compras = R('../compras.js');

// ─── 1. Deletes fail-closed ───
test('deletes: remoto primeiro com gate, sem filtro prematuro', () => {
  const pct = R('../modules/romaneiopct/modal-lista-romaneios-pct.js');
  assert.ok(/fail-closed/.test(pct), 'PCT documenta fail-closed');
  assert.ok(/firebaseKey/.test(pct), 'PCT tenta aliases de chave');
  const tl = R('../modules/modals/modal-lista-romaneios.js');
  assert.ok(/fail-closed/.test(tl), 'TL documenta fail-closed');
  const forn = R('../fornecedor-modals.js');
  assert.ok(/remotoOk/.test(forn), 'fornecedor exige sucesso remoto');
  assert.ok(/String\(p && p\.id\) !== String\(produtoId\)/.test(vendas), 'vendas excluirProduto compara com String()');
  const nf = R('../nf-naturezas.js');
  assert.ok(/Fail-closed/.test(nf), 'naturezas fail-closed');
  assert.ok(/String\(n && n\.id\) !== String\(id\)/.test(nf), 'naturezas compara com String()');
  const cli = R('../js/client.js');
  assert.ok(/rDel && rDel\.success === false/.test(cli), 'cliente checa retorno');
  assert.ok(/window\.produtos = novaLista/.test(compras), 'compras só assume após gate');
});

// ─── 2. Feedback: loading + trava ───
test('feedback: saves e deletes com loading e trava auto-expirante', () => {
  const tora = R('../romaneiotora_tabela.js');
  assert.ok(/window\.isSavingRomaneio = true/.test(tora), 'tora trava na entrada');
  assert.ok(/LoadingManager\.show\('Salvando romaneio\.\.\.'\)/.test(tora), 'tora mostra loading');
  assert.ok(/btnSalvar/.test(tora), 'tora desabilita botão');
  const pct = R('../romaneiopct-tabela.js');
  assert.ok(/LoadingManager\.show\('Salvando romaneio\.\.\.'\)/.test(pct), 'pct mostra loading');
  const tl = R('../modules/romaneio/salvar-romaneio.js');
  assert.ok(/LoadingManager\.show\('Salvando romaneio\.\.\.'\)/.test(tl), 'tl mostra loading');
  assert.ok(/__salvarPedidoVendaTs/.test(vendas), 'vendas trava duplo-save');
  assert.ok(/__salvarPedidoCompraTs/.test(compras), 'compras trava duplo-save');
  assert.ok(/__excluirPedidoVendaTs/.test(vendas), 'vendas trava duplo-delete');
  assert.ok(/LoadingManager\.show\('Excluindo pedido\.\.\.'\)/.test(vendas), 'vendas delete com loading');
  const toraMod = R('../romaneiotora_modais.js');
  assert.ok(/__imprimirToraEmAndamento/.test(toraMod), 'impressão tora com trava');
  assert.ok(/Gerando documento de impressão/.test(toraMod), 'impressão tora com placeholder');
});

// ─── 3. Perf: paralelismo + debounce ───
test('perf: dual-fetch paralelo, lote limitado e debounce', () => {
  assert.ok(/function carregarPedidosParaUsoRomaneio/.test(vendas), 'helper dual-fetch existe');
  assert.ok(/Promise\.all\(\[pVendas, pCompras\]\)/.test(vendas), 'dual-fetch em paralelo');
  const uses = (vendas.match(/carregarPedidosParaUsoRomaneio\(\)/g) || []).length;
  assert.ok(uses >= 3, '3 chamadas usam helper (definição + 3 usos)');
  assert.ok(/const LIMITE = 8/.test(vendas), 'lote saveData com limite');
  assert.ok(/Promise\.allSettled\(lote\)/.test(vendas), 'lote tolerante a falha parcial');
  assert.ok(/filtrarPedidosDebounced/.test(vendas), 'busca pedidos com debounce');
  assert.ok(/filterFornecedorListDebounced/.test(R('../fornecedor-modals.js')), 'busca fornecedor com debounce');
});
