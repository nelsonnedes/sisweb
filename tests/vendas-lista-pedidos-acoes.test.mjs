import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function cssRule(source, selector) {
  const index = source.indexOf(selector);
  assert.notEqual(index, -1, `Selector not found: ${selector}`);
  const open = source.indexOf('{', index);
  const close = source.indexOf('}', open);
  return source.slice(open + 1, close);
}

test('lista de pedidos reserva e centraliza coluna acoes sem invadir atualizado', () => {
  const vendasHtml = read('vendas.html');
  const vendasJs = read('vendas.js');

  assert.match(vendasHtml, /<th class="atualizado-col">Atualizado<\/th>/);
  assert.match(vendasHtml, /<th class="actions-col">Ações<\/th>/);
  assert.match(vendasJs, /<td data-label="Atualizado" class="atualizado-cell">\$\{updatedStr\}<\/td>/);
  assert.match(vendasJs, /<td data-label="Ações" class="acoes-cell commerce-actions-cell">\s*<div class="acoes-buttons">/);
  assert.match(vendasJs, /<td data-label="Número">\s*<label class="pedido-numero-cell">/);
  assert.match(vendasJs, /<td data-label="Total" style="text-align: right;">/);
  assert.match(vendasJs, /commerce-full-row/);

  const acoesCell = cssRule(vendasHtml, '#listaPedidosModal .acoes-cell');
  assert.doesNotMatch(acoesCell, /display\s*:\s*flex/);
  assert.match(acoesCell, /white-space\s*:\s*nowrap/);

  const actionsColumns = cssRule(vendasHtml, '#listaPedidosModal th.actions-col,');
  const minWidth = Number(actionsColumns.match(/min-width\s*:\s*(\d+)px/)?.[1] || 0);
  const width = Number(actionsColumns.match(/(?:^|\n)\s*width\s*:\s*(\d+)px/)?.[1] || 0);
  assert.ok(minWidth >= 152, 'a coluna deve comportar quatro botoes de 32px e seus espacamentos');
  assert.match(actionsColumns, /text-align\s*:\s*center/);
  assert.equal(width, minWidth);

  const atualizadoColumns = cssRule(vendasHtml, '#listaPedidosModal th.atualizado-col,');
  assert.match(atualizadoColumns, /min-width\s*:\s*104px/);
  assert.match(atualizadoColumns, /white-space\s*:\s*nowrap/);

  const actionsWrapper = cssRule(vendasHtml, '#listaPedidosModal .acoes-buttons');
  assert.match(actionsWrapper, /display\s*:\s*flex/);
  assert.match(actionsWrapper, /justify-content\s*:\s*center/);
  assert.match(actionsWrapper, /width\s*:\s*100%/);

  const actionButtons = cssRule(vendasHtml, '#listaPedidosModal .acoes-buttons .btn-small');
  assert.match(actionButtons, /flex\s*:\s*0 0 32px/);
  assert.match(actionButtons, /min-width\s*:\s*32px/);
});

test('relatorios desktop reserva e espaca botoes da coluna acoes', () => {
  const vendasHtml = read('vendas.html');
  const vendasJs = read('vendas.js');

  assert.match(vendasHtml, /<th data-col="acoes" class="actions-col">Ações<\/th>/);
  assert.match(vendasHtml, /@media \(min-width:\s*769px\)\s*{[\s\S]*#relatoriosTable th\.actions-col,/);
  assert.match(vendasJs, /<td data-col="acoes" data-label="Ações" class="relatorio-acoes-cell commerce-actions-cell">/);
  assert.match(vendasJs, /<div class="relatorio-acoes-buttons acoes-buttons commerce-actions-wrap">/);

  const actionsColumns = cssRule(vendasHtml, '#relatoriosTable th.actions-col,');
  assert.match(actionsColumns, /min-width\s*:\s*132px/);
  assert.match(actionsColumns, /text-align\s*:\s*center/);
  assert.match(actionsColumns, /vertical-align\s*:\s*middle/);
  assert.match(actionsColumns, /white-space\s*:\s*nowrap/);
  assert.match(actionsColumns, /width\s*:\s*132px/);
  assert.match(vendasHtml, /#relatoriosTable td\[data-col="acoes"\]/);

  const actionsWrapper = cssRule(vendasHtml, '#relatoriosTable .relatorio-acoes-buttons');
  assert.match(actionsWrapper, /display\s*:\s*flex/);
  assert.match(actionsWrapper, /gap\s*:\s*6px/);
  assert.match(actionsWrapper, /justify-content\s*:\s*center/);
  assert.match(actionsWrapper, /width\s*:\s*100%/);
  assert.match(vendasHtml, /#relatoriosTable td\[data-col="acoes"\] \.acoes-buttons/);

  const actionButtons = cssRule(vendasHtml, '#relatoriosTable .relatorio-acoes-buttons .btn-small');
  assert.match(actionButtons, /flex\s*:\s*0 0 32px/);
  assert.match(actionButtons, /height\s*:\s*30px/);
  assert.match(actionButtons, /min-width\s*:\s*32px/);
  assert.match(actionButtons, /padding\s*:\s*0/);
  assert.match(actionButtons, /width\s*:\s*32px/);
  assert.match(vendasHtml, /#relatoriosTable td\[data-col="acoes"\] \.acoes-buttons \.btn-small/);
});

test('relatorios mobile esconde linhas sem carrego disponivel com !important (Mostrar s o disponivel)', () => {
  const vendasHtml = read('vendas.html');
  const vendasJs = read('vendas.js');
  const crmCss = read('commerce-responsive.css');

  // Checkbox "Mostrar só disponível" no Relatório de Vendas esta ligado ao filtro
  assert.match(vendasHtml, /id="relFiltroDisponivel"[^>]*onchange="toggleFiltroCarregoDisponivel\(this\.checked\)"/);
  assert.match(vendasJs, /function toggleFiltroCarregoDisponivel\(/);

  // Root cause: em mobile o container .mobile-cards força .tr { display: block !important },
  // que vence um simples style="display:none" inline (important de folha vence normal inline).
  assert.match(crmCss, /\.table-responsive\.mobile-cards tr \{[\s\S]*display:\s*block\s*!important/);

  // Fix: o filtro usa setProperty('display', 'none', 'important') para vencer o !important acima
  // e garantir r.style.display === 'none' (lido por toggleSelecionarTodos e pelo footer do próprio filtro).
  assert.match(vendasJs, /\br\.style\.setProperty\('display',\s*\(checked\s*&&\s*\(pago\s*\|\|\s*\!has\s*\|\|\s*vol\s*<=\s*0\)\)\s*\?\s*'none'\s*:\s*''\s*,\s*'important'\)/);
  assert.doesNotMatch(vendasJs, /r\.style\.display\s*=\s*\(checked\s*&&\s*\(pago\s*\|\|\s*\!has\s*\|\|\s*vol\s*<=\s*0\)\)\s*\?\s*'none'\s*:\s*''/);
});
