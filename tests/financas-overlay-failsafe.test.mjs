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

test('edit save: guarda unica por fluxo + timeout no callable (anti-pisca)', () => {
  const src = readFileSync(new URL('../financas.js', import.meta.url), 'utf8');
  const dupes = (src.match(/ignorando clique duplo/g) || []).length;
  assert.equal(dupes, 1);
  assert.ok(/Promise\.race\(\[service\.callFunction/.test(src), 'callable com timeout');
  assert.ok(/finance\/timeout/.test(src), 'erro de timeout identificavel');
  assert.ok(/clearTimeout\(timer\)/.test(src), 'timer limpo');
});

test('impressao: colunas texto quebram, valores fixos (sem sobrepor)', () => {
  const src3 = readFileSync(new URL('../financas.js', import.meta.url), 'utf8');
  assert.ok(/cliente:.finance-print-wrap/.test(src3), 'cliente quebra linha');
  assert.ok(/colWidthMap/.test(src3), 'larguras por coluna existem');
  assert.ok(!/columnClassMap\[k\] \|\| .finance-print-nowrap/.test(src3), 'sem nowrap como default');
});

test('relatorio e filtro: @page sem size (layout de volta) + ts com cache', () => {
  const src4 = readFileSync(new URL('../financas.js', import.meta.url), 'utf8');
  assert.ok(!/@page \{ size:/.test(src4), 'sem size fixo no @page');
  assert.ok(/function tsVencConta/.test(src4), 'helper existe');
  const uses = (src4.match(/tsVencConta\(/g) || []).length;
  assert.ok(uses >= 10, 'hot paths usam cache');
});

test('print landscape usa largura real + build em chunks', () => {
  const src5 = readFileSync(new URL('../commerce-pdf-share.js', import.meta.url), 'utf8');
  assert.ok(/orientation: landscape/.test(src5), 'landscape com largura real');
  assert.ok(!/@page \{\s*size:/.test(src5), 'sem size fixo no helper');
  const fin = readFileSync(new URL('../financas.js', import.meta.url), 'utf8');
  assert.ok(/li \+= 250/.test(fin) || /i \+= 250/.test(fin), 'tbody em chunks');
  assert.ok(/__tsHojeCacheDia/.test(fin), 'tsHoje memoizado');
  assert.ok(/__tsDateCache/.test(fin), 'parse de data com cache');
});
