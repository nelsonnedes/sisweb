import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// E5: estoque stub vira real + NF-e/MDF-e ops longas com loader (finally).
// Emissão fiscal NUNCA é disparada em teste — só pareamento estático.
const estoqueJs = readFileSync('estoque.js', 'utf8');
const estoqueHtml = readFileSync('estoque.html', 'utf8');
const mdfeJs = readFileSync('mdf-e.js', 'utf8');
const mdfeHtml = readFileSync('mdf-e.html', 'utf8');
const nfHtml = readFileSync('notas-fiscais.html', 'utf8');

test('E5: estoque show/hide delegam ao helper com fallback ao modal próprio', () => {
  assert.doesNotMatch(estoqueJs, /Preload overlays visuais removidos/);
  assert.match(estoqueJs, /window\.SiswebLoading\.show\(message \|\| 'Processando\.\.\.'\)/);
  assert.match(estoqueJs, /getElementById\('loadingModal'\)/);
  assert.match(estoqueJs, /getElementById\('loadingMessage'\)/);
  assert.match(estoqueHtml, /js\/sisweb-loading\.js\?v=[0-9a-f]{12}/);
});

test('E5: MDF-e emitir + rascunho com loader em finally', () => {
  assert.match(mdfeHtml, /js\/sisweb-loading\.js\?v=[0-9a-f]{12}/);
  const emit = mdfeJs.indexOf('async function emitirMdfe()');
  assert.ok(emit !== -1);
  assert.match(mdfeJs.slice(emit, emit + 1200), /SiswebLoading\.show\('Emitindo MDF-e\.\.\.'\)/);
  assert.match(mdfeJs, /SiswebLoading\.show\('Salvando rascunho\.\.\.'\)/);
  const hideCount = (mdfeJs.match(/SiswebLoading\.hide\(\)/g) || []).length;
  assert.ok(hideCount >= 2, `hides=${hideCount}`);
});

test('E5: NF-e emissão + rascunho com loader (spinner de botão mantido)', () => {
  assert.match(nfHtml, /js\/sisweb-loading\.js\?v=[0-9a-f]{12}/);
  assert.match(nfHtml, /SiswebLoading\.show\('Emitindo NF-e\.\.\.'\)/);
  assert.match(nfHtml, /SiswebLoading\.show\('Salvando rascunho\.\.\.'\)/);
  assert.match(nfHtml, /fa-spinner fa-spin.*Emitindo/);
  assert.match(nfHtml, /Confirmar e Emitir/);
});
