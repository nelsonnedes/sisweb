import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync('notas-fiscais.html', 'utf8');

test('NF-e mantém diagnóstico opcional com script válido', () => {
  assert.match(html, /document\.write\('<script src="auth-performance-diagnostics\.js\?v=[^']+"><\\\/script>'\)/);
  assert.doesNotMatch(html, /document\.write\('\s*<!--/);
});

test('NF-e define contrato de cards para todas as tabelas operacionais', () => {
  for (const className of ['nf-items-table', 'nf-notas-table', 'nf-volumes-table', 'nf-naturezas-table']) {
    assert.match(html, new RegExp(`nf-card-table[^\\"]*${className}`), `${className} deve usar o contrato de cards`);
  }
  assert.match(html, /\.nf-card-table tbody > tr > td\[data-label\]::before[\s\S]*position: static !important/);
  assert.match(html, /\.nf-card-table tbody > tr > td\[data-label="Ações"\][\s\S]*display: flex !important/);
  assert.match(html, /\.nf-card-table tbody > tr > td\[data-label="Ações"\][\s\S]*min-width: 36px !important/);
});

test('NF-e injeta rótulos mobile em itens, consulta, volumes e naturezas', () => {
  for (const label of [
    'Produto', 'NCM', 'CFOP', 'UN', 'Qtd', 'Vl.Unit.', 'Total', 'CSOSN',
    'Número', 'Data', 'Destinatário', 'Valor Total', 'Chave / Protocolo', 'Status',
    'Qtd.', 'Espécie', 'Marca', 'Numeração', 'Pesos', 'Lacres',
    'Descrição', 'Ativo', 'Ações',
  ]) {
    assert.match(html, new RegExp(`data-label="${label}"`), `rótulo ausente: ${label}`);
  }
});

test('NF-e empilha seletores e mantém os modais dentro da viewport mobile', () => {
  assert.match(html, /\.nf-customer-picker[\s\S]*grid-template-columns: minmax\(0, 1fr\) 40px 40px/);
  assert.match(html, /\.nf-natureza-picker[\s\S]*grid-template-columns: minmax\(0, 1fr\) 40px/);
  assert.match(html, /#nfEditItemModal \.modal-content[\s\S]*max-height: calc\(100dvh - 16px\) !important/);
  assert.match(html, /#nfFiscalEventModal \.modal-body[\s\S]*overflow-y: auto !important/);
  assert.match(html, /#modalNatOp > div > div:nth-child\(2\)[\s\S]*overflow-y: auto !important/);
  assert.match(html, /#nfForm \.nf-form-actions[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)/);
});
