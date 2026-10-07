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

test('tabelas fluidas: coalesce + yield + cache de normalizacao', () => {
  const src2 = readFileSync(new URL('../financas.js', import.meta.url), 'utf8');
  assert.ok(/function agendarCarregarTabela/.test(src2), 'coalesce existe');
  assert.ok(/agendarCarregarTabela\('receber'/.test(src2), 'listener receber coalescido');
  assert.ok(/await new Promise\(r => setTimeout\(r, 0\)\)/.test(src2), 'cede paint apos spinner');
  assert.ok(/function assinaturaNormConta/.test(src2), 'assinatura existe');
  assert.ok(/__finNormSig/.test(src2), 'cache aplicado nos loops');
});

test('permissoes: sem reads legados + tenant com fallbacks', () => {
  const html = readFileSync(new URL('../financas.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../financas.js', import.meta.url), 'utf8');
  assert.ok(/Normaliza legados para o can/.test(html), 'load normaliza antes de ler');
  assert.ok(!/alts\.add/.test(html), 'sem tentativas em variantes sem regra');
  assert.ok(/getCurrentTenantId/.test(html), 'tenant com fallbacks canonicos');
  assert.ok(/__finPermWarnMap/.test(html), 'throttle de warnings por path');
  assert.ok(/financas\/receber/.test(js), 'tombstone no canonico');
});
