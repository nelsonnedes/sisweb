import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const tl = fs.readFileSync('modules/reports/imprimir-romaneio.js', 'utf8');
const pct = fs.readFileSync('modules/romaneiopct/imprimir-romaneio-pct.js', 'utf8');
const pes = fs.readFileSync('romaneiopes.html', 'utf8');

test('resumo TL tem pecas por pacote e subtotal por dimensao', () => {
  assert.ok(tl.includes('Pçs/Pac.'));
  assert.match(tl, /subtotal-especie-row/);
  assert.ok(tl.includes('Subtotal ${row.especie}'));
  assert.match(tl, /const dimKeyOf =/);
});

test('resumo PCT tem pecas por pacote e subtotal por dimensao', () => {
  assert.ok(pct.includes('Pçs/Pac.'));
  assert.match(pct, /subtotal-especie-row/);
  assert.ok(pct.includes('Subtotal ${row.especie}'));
  assert.match(pct, /const pppTexto = row\.observacao/);
});

test('resumo PES tem pecas por pacote e subtotal por dimensao', () => {
  assert.ok(pes.includes('Pçs/Pac.'));
  assert.match(pes, /subtotal-especie-row/);
  assert.ok(pes.includes('Subtotal ${row.especie}'));
  assert.match(pes, /const dimKeyPes =/);
});
