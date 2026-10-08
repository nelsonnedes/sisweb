import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Trava o alinhamento da linha de totais do ROMANEIO DE TORAS (3 modos).
// Causa-raiz: applyToraLayout contava base 3 (Plaqueta/Custódia/AUTEF) e
// esquecia a Espécie (sempre visível) → colspan 7 em vez de 8, deslocando
// todos os totais uma coluna à esquerda e esvaziando a última.
const cfg = readFileSync('romaneio-print-config.js', 'utf8');
const rel = readFileSync('modules/reports/imprimir-romaneio.js', 'utf8');

test('tora: label de totais cobre as 4 colunas fixas (Plaqueta/Custódia/AUTEF/Espécie)', () => {
  assert.match(cfg, /\[\s*'rodo',\s*'comprimento',\s*'oco1',\s*'oco2'\s*\]/);
  assert.match(cfg, /const baseVisible = 4 \+ \['rodo', 'comprimento', 'oco1', 'oco2'\]/);
  assert.doesNotMatch(cfg, /const baseVisible = 3 \+ \['rodo', 'comprimento', 'oco1', 'oco2'\]/);
});

test('tora: linha de totais tem label colspan 8 + spacer geo 5 (20/19/18 colunas)', () => {
  assert.match(rel, /<td colspan="8" class="text-right tora-total-label">Total:<\/td>/);
  assert.match(rel, /<td colspan="5" class="tora-geo-spacer"><\/td>/);
});

test('tora: coluna M³ Líq. intitulada V. Francon (relatório + resumo + config)', () => {
  assert.match(rel, /<th class="col-vl-tora">V\. Francon<\/th>/);
  assert.match(rel, /<th class="text-right">V\. Francon<\/th>/);
  assert.doesNotMatch(rel, /M³ Líq\.<\/th>/);
  assert.match(cfg, /id: 'm3Liquido', label: 'V\. Francon'/);
});

test('tora: total da coluna Preço é média ponderada por volume (não média simples)', () => {
  assert.match(rel, /totals\.valor \/ totals\.vl/);
  assert.doesNotMatch(rel, /precos\.reduce\(\(a,b\)=>a\+b,0\) \/ totals\.precos\.length/);
  assert.match(rel, /totals\.vl > 0 \? formatarMoeda\(precoMedio\) : '-'/);
});
