import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const tlJs = read('modules/modals/modal-clientes.js');
const pctJs = read('modules/romaneiopct/modal-clientes-pct.js');
const pesHtml = read('romaneiopes.html');
const preJs = read('preromaneio-modals.js');
const fornecedorJs = read('fornecedor-modals.js');
const comumCss = read('romaneio-comum.css');
const toraHtml = read('romaneiotora.html');
const pctHtml = read('romaneiopct.html');
const preHtml = read('preromaneio.html');

test('paginacao: todos os modais usam 4 itens por pagina por padrao', () => {
  assert.match(tlJs, /itemsPerPage: 4/);
  assert.match(pctJs, /itemsPerPage: 4/);
  assert.match(pesHtml, /const listItemsPerPage = 4/);
  assert.match(preJs, /const ITEMS_PER_PAGE = 4/);
  assert.match(fornecedorJs, /window\._fornPageSize \|\| 4/);
  assert.doesNotMatch(tlJs, /itemsPerPage: 5/);
  assert.doesNotMatch(pctJs, /itemsPerPage: 5/);
  assert.doesNotMatch(pesHtml, /const listItemsPerPage = 5/);
  assert.doesNotMatch(preJs, /const ITEMS_PER_PAGE = 10/);
});

test('altura de linhas: padding vertical reduzido e compacto em todos os modais', () => {
  assert.ok(comumCss.includes('#clientListModal .table thead th,'), 'seletor thead th do CSS comum presente');
  assert.ok(comumCss.match(/thead th,\s*\r?\n#fornecedorListModal \.table thead th,[\s\S]{0,400}padding: 5px 8px !important;/), 'th do CSS comum com padding vertical 5px');
  assert.ok(comumCss.match(/tbody td,\s*\r?\n#fornecedorListModal \.table tbody td,[\s\S]{0,400}padding: 3px 8px !important;/), 'td do CSS comum com padding vertical 3px');
  assert.ok(comumCss.match(/tbody tr,\s*\r?\n#fornecedorListModal \.table tbody tr,[\s\S]{0,400}height: 32px !important;/), 'tr do CSS comum com altura compacta');

  assert.match(pctHtml, /#clientListModal \.table td \{[\s\S]{0,200}padding: 4px 8px;[\s\S]{0,120}(height: 24px|padding)/s);
  assert.match(preHtml, /#clientListModal \.table td \{[\s\S]{0,200}padding: 4px 8px;[\s\S]{0,120}height: 24px/s);
  assert.match(pesHtml, /\.modal table td \{[\s\S]{0,200}padding: 4px 8px;[\s\S]{0,120}height: 24px/s);
  assert.match(toraHtml, /#fornecedorListModal \.table th \{[\s\S]{0,200}padding: 5px 8px;/s);
  assert.match(toraHtml, /#fornecedorListModal \.table td \{[\s\S]{0,200}padding: 4px 8px;/s);
});

test('foco: ao abrir o modal o cursor fica no campo de filtro em todas as implementacoes ativas', () => {
  assert.match(tlJs, /setTimeout\(\(\) => \{\s*filterInput\.focus\(\);\s*\}, 300\)/);
  assert.match(pctJs, /setTimeout\(\(\) => \{\s*filterInput\.focus\(\);\s*\}, 300\)/);
  assert.ok(pesHtml.includes("setTimeout(() => focusFilter.focus(), 300)"), 'PES usa setTimeout para foco');
  assert.ok(preJs.includes("setTimeout(() => filterInput.focus(), 300)"), 'Pre utiliza setTimeout para foco');
  assert.ok(fornecedorJs.includes("setTimeout(() => filterInput.focus(), 300)"), 'Fornecedor utiliza setTimeout para foco');
});

test('foco: abertura de modal nao faz focus() direto sem delay nos modais-alvo', () => {
  const forneOpen = fornecedorJs.match(/async function openFornecedorListModal\(\) \{[\s\S]+\n\}/)?.[0] || '';
  assert.ok(forneOpen.length > 300, 'bloco openFornecedorListModal capturado');
  assert.ok(forneOpen.includes('setTimeout'), 'Fornecedor usa setTimeout');
  assert.doesNotMatch(forneOpen, /filterInput\.focus\(\);\s*\n\s*\}/, 'Fornecedor nao faz focus() sem delay');

  const pesOpen = pesHtml.match(/function openClientListModal\(\) \{[\s\S]+\n\s*\}/)?.[0] || '';
  assert.ok(pesOpen.length > 500, 'bloco openClientListModal do PES capturado');
  assert.ok(pesOpen.includes('setTimeout'), 'PES usa setTimeout');
});