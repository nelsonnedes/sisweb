import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tl = fs.readFileSync('modules/reports/imprimir-romaneio.js', 'utf8');
const pct = fs.readFileSync('modules/romaneiopct/imprimir-romaneio-pct.js', 'utf8');
const pes = fs.readFileSync('romaneiopes.html', 'utf8');

test('resumo TL tem pecas por pacote e subtotal por especie', () => {
  assert.match(tl, /Pçs\/Pac\./);
  assert.match(tl, /subtotal-especie-row/);
  assert.match(tl, /Subtotal \$\{especie\}/);
  assert.match(tl, /const pppTexto = row\.pppVariado/);
});

test('resumo PCT tem pecas por pacote e subtotal por especie', () => {
  assert.match(pct, /Pçs\/Pac\./);
  assert.match(pct, /subtotal-especie-row/);
  assert.match(pct, /Subtotal \$\{especie\}/);
  assert.match(pct, /pppVariado/);
});

test('resumo PES tem pecas por pacote e subtotal por especie', () => {
  assert.match(pes, /Pçs\/Pac\./);
  assert.match(pes, /subtotal-especie-row/);
  assert.match(pes, /Subtotal \$\{especie\}/);
  assert.match(pes, /speciesDimTotals/);
});
