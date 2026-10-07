import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../financas.js', import.meta.url), 'utf8');

test('tabelas receber/pagar: overlay sempre liberado (anti-travamento)', () => {
  assert.ok(/function finalizarOverlayFinanceTabela/.test(src), 'helper existe');
  const n = (src.match(/finalizarOverlayFinanceTabela\(overlay, shouldOverlay\)/g) || []).length;
  assert.ok(n >= 2, 'receber e pagar usam no finally');
  assert.ok(/financeLoadingCount = Math\.max\(0,/.test(src), 'contador nunca negativo');
});
