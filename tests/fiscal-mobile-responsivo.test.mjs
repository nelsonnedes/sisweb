import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const nfHtml = fs.readFileSync('notas-fiscais.html', 'utf8');
const nfDash = fs.readFileSync('nf-dashboard.js', 'utf8');
const mdfHtml = fs.readFileSync('mdf-e.html', 'utf8');
const pfHtml = fs.readFileSync('produtos-fiscais.html', 'utf8');
const pfJs = fs.readFileSync('js/produtos-fiscais.js', 'utf8');

test('NF-e mobile: dashboard vira cards (nf-card-table + data-label)', () => {
  assert.match(nfHtml, /<table class="data-table nf-card-table">[\s\S]*id="relatorioCorpo"/);
  for (const label of ['Número', 'Data', 'Destinatário', 'Status', 'Valor Total']) {
    assert.match(nfDash, new RegExp('data-label="' + label + '"'), 'dashboard: ' + label);
  }
});

test('NF-e mobile: stepper 3x2, transporte, revisão e tabelas ajustadas', () => {
  assert.match(nfHtml, /\.nf-stepper \{\s*display: grid !important;\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) !important;/);
  assert.match(nfHtml, /\.nf-step \{\s*min-width: 0 !important;/);
  assert.match(nfHtml, /\.nf-summary-item strong \{\s*white-space: normal !important;/);
  assert.match(nfHtml, /\.nf-subsection-grid \{\s*grid-template-columns: minmax\(0, 1fr\) !important;/);
  assert.match(nfHtml, /\.nf-review-line span \{[\s\S]*?overflow-wrap: anywhere;/);
  assert.match(nfHtml, /#consulta \.nf-mobile-table-container \{[\s\S]*?max-height: min\(55vh, 420px\) !important;/);
  assert.match(nfHtml, /\.nf-mobile-table-container,[\s\S]*?max-height: none !important;/);
});

test('MDF-e e Produtos Fiscais: tabelas usam data-label/cards no mobile', () => {
  assert.match(mdfHtml, /\.mdfe-table td::before \{\s*content: attr\(data-label\)/);
  assert.match(mdfHtml, /\.mdfe-table thead \{\s*display: none;/);
  assert.match(pfHtml, /class="table-responsive"/);
  assert.match(pfJs, /data-label="Código"/);
  assert.match(pfHtml, /commerce-responsive\.js/);
});
