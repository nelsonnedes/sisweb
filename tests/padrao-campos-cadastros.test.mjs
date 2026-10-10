import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Padronização 09/10: botões Lista/Novo fora do campo e coloridos (padrão
// estoque) + Buscar Cliente/Fornecedor (padrão NF) — sem regressão.
const comum = readFileSync('romaneio-comum.css', 'utf8');
const pct = readFileSync('romaneiopct.html', 'utf8');
const tl = readFileSync('romaneiotl.html', 'utf8');
const pes = readFileSync('romaneiopes.html', 'utf8');
const tora = readFileSync('romaneiotora.html', 'utf8');
const pre = readFileSync('preromaneio.html', 'utf8');
const estoqueHtml = readFileSync('estoque.html', 'utf8');
const estoqueJs = readFileSync('estoque.js', 'utf8');

test('CSS global do padrão: flex, botões 36px, só tokens --sw-*', () => {
  assert.match(comum, /\.species-combobox-inline \{/);
  assert.match(comum, /\.species-combobox-inline input \{/);
  assert.match(comum, /\.species-combobox-inline \.species-icon-btn \{/);
  assert.match(comum, /var\(--sw-text-3\)/);
  assert.match(comum, /var\(--sw-success\)/);
  assert.match(comum, /var\(--sw-on-brand\)/);
  const i = comum.indexOf('.species-combobox-inline {');
  const block = comum.slice(i, i + 1600);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,6}\b/);
  assert.match(comum, /@media \(max-width: ?768px\)/);
});

const pages = { pct, tl, pes, tora, pre };
for (const [nome, src] of Object.entries(pages)) {
  test(`${nome}: zero ícone sobreposto restante`, () => {
    assert.doesNotMatch(src, /<span class="autocomplete-icon"/);
    assert.doesNotMatch(src, /<div class="autocomplete-icons-container">/);
  });
}

test('pct/tl: cliente+espécie com handlers onclick preservados', () => {
  assert.match(pct, /onclick="openClientListModal\(event\)"/);
  assert.match(pct, /onclick="openNewClientModal\(event\)"/);
  assert.match(pct, /onclick="openSpeciesListModal\(event\)"/);
  assert.match(pct, /onclick="openNewSpeciesModal\(event\)"/);
  assert.match(tl, /onclick="openClientListModal\(\)"/);
  assert.match(tl, /onclick="openNewClientModal\(\)"/);
  assert.match(tl, /onclick="openSpeciesListModal\(\)"/);
  assert.match(tl, /onclick="openNewSpeciesModal\(\)"/);
});

test('pes: delegação data-action preservada nos botões', () => {
  assert.match(pes, /data-action="open-client-list"/);
  assert.match(pes, /data-action="open-new-client"/);
  assert.match(pes, /data-action="open-species-list"/);
  assert.match(pes, /data-action="open-new-species"/);
  assert.match(pes, /id="clienteSuggestions"/);
  assert.match(pes, /id="especieSuggestions"/);
});

test('tora: fornecedor+espécie com handlers preservados', () => {
  assert.match(tora, /onclick="openFornecedorListModal\(\)"/);
  assert.match(tora, /onclick="openNewFornecedorModal\(\)"/);
  assert.match(tora, /onclick="openSpeciesListModal\(\)"/);
  assert.match(tora, /id="fornecedorInput"/);
});

test('pre: 4 blocos (cliente+espécie+fornecedor+espécieTora) com titles', () => {
  assert.match(pre, /id="especieToraInput"/);
  const btns = pre.match(/species-icon-btn/g) || [];
  assert.equal(btns.length, 8, '4 blocos x 2 botões');
  assert.match(pre, /title="Listar Clientes"/);
  assert.match(pre, /title="Listar Fornecedores"/);
});

test('todas: Lista=secondary, Novo/Nova=success, fora do campo', () => {
  for (const [nome, src] of Object.entries(pages)) {
    const lista = src.match(/btn-secondary species-icon-btn/g) || [];
    const novo = src.match(/btn-success species-icon-btn/g) || [];
    assert.ok(lista.length >= 2, `${nome}: Lista`);
    assert.ok(novo.length >= 2, `${nome}: Novo`);
    assert.match(src, /species-combobox-inline/);
  }
});

test('estoque: Buscar + select na mesma linha (padrão NF flex 1/2)', () => {
  assert.match(estoqueHtml, /id="fornecedorBusca"/);
  assert.match(estoqueHtml, /placeholder="Buscar fornecedor\.\.\."/);
  assert.match(estoqueHtml, /oninput="filtrarFornecedorSelectEstoque\(\)"/);
  assert.match(estoqueHtml, /id="fornecedorBusca"[^>]*style="flex: 1;/);
  assert.match(estoqueHtml, /id="fornecedorSelect"[^>]*style="flex: 2;/);
  assert.match(estoqueJs, /function filtrarFornecedorSelectEstoque\(\)/);
  assert.match(estoqueJs, /getElementById\('fornecedorBusca'\)/);
});

test('referências intactas: vendas/compras/NF mantêm Buscar', () => {
  const vendas = readFileSync('vendas.html', 'utf8');
  const compras = readFileSync('compras.html', 'utf8');
  const nf = readFileSync('notas-fiscais.html', 'utf8');
  assert.match(vendas, /id="clienteBusca"/);
  assert.match(compras, /id="fornecedorBusca"/);
  assert.match(nf, /id="nfClienteBusca"/);
});

test('helper global filtrarSelectPorBusca existe e é defensivo', () => {
  const menu = readFileSync('menu-component.js', 'utf8');
  assert.match(menu, /window\.filtrarSelectPorBusca = function\(selectId, buscaId\)/);
  assert.match(menu, /opt\.hidden = !ok;/);
  assert.match(menu, /dataset\.documento/);
});

const buscas = [
  ['vendas.html', 'produtoSelect', 'produtoBusca'],
  ['vendas.html', 'relFiltroCliente', 'relClienteBusca'],
  ['vendas.html', 'relFiltroEspecie', 'relEspecieBusca'],
  ['compras.html', 'produtoSelect', 'produtoBusca'],
  ['compras.html', 'relFornecedor', 'relFornecedorBusca'],
  ['financas.html', 'receberCliente', 'receberClienteBusca'],
  ['financas.html', 'pagarFornecedor', 'pagarFornecedorBusca'],
  ['financas.html', 'filtroReceberCliente', 'filtroReceberClienteBusca'],
  ['financas.html', 'filtroPagarFornecedor', 'filtroPagarFornecedorBusca'],
  ['estoque.html', 'baixaProdutoSelectInline', 'baixaProdutoBuscaInline'],
  ['estoque.html', 'entradaProdutoSelect', 'entradaProdutoBusca'],
  ['estoque.html', 'baixaProdutoSelect', 'baixaProdutoBusca'],
];

for (const [file, selectId, buscaId] of buscas) {
  test(`${file}: Buscar filtra ${selectId} na mesma linha`, () => {
    const src = readFileSync(file, 'utf8');
    assert.match(src, new RegExp(`id="${buscaId}"`));
    assert.match(src, new RegExp(`filtrarSelectPorBusca\\('${selectId}','${buscaId}'\\)`));
    assert.match(src, new RegExp(`id="${buscaId}"[^>]*style="flex: 1;`));
    assert.match(src, new RegExp(`id="${selectId}"[^>]*style="flex: 2;`));
  });
}
