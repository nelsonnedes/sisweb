import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../folha_pagamento/folha-relatorios.js', import.meta.url), 'utf8');

// A4-strangler: leituras devem passar por swGet (SiswebData-first com
// fallback legado). O único window.getData permitido é o fallback
// dentro do próprio helper.
test('folha-relatorios roteia leituras via swGet', () => {
  const swCalls = (src.match(/swGet\s*\(/g) || []).length;
  assert.ok(swCalls >= 8, `esperado >= 8 chamadas swGet, obtido ${swCalls}`);

  const lines = src.split('\n');
  const inHelper = new Set();
  let depth = 0, helperStart = -1;
  lines.forEach((ln, i) => {
    if (/async function swGet\(/.test(ln)) helperStart = i;
    if (helperStart >= 0) {
      inHelper.add(i);
      depth += (ln.match(/\{/g) || []).length - (ln.match(/\}/g) || []).length;
      if (depth <= 0 && i > helperStart) helperStart = -1;
    }
  });

  const bad = [];
  lines.forEach((ln, i) => {
    if (inHelper.has(i)) return;
    if (/(^|[^.A-Za-z_])getData\s*\(/.test(ln) || /window\.getData\s*\(/.test(ln)) {
      bad.push(`${i + 1}: ${ln.trim().slice(0, 100)}`);
    }
  });
  assert.deepEqual(bad, [], `leituras fora do swGet: ${bad.join(' | ')}`);
});
