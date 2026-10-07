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
});

test('folha-main loadDataType roteia via swGet', () => {
  const src = readFileSync(new URL('../folha_pagamento/folha-main.js', import.meta.url), 'utf8');
  assert.ok(/async function swGet\(/.test(src), 'helper swGet presente');
  const lines = src.split('\n');
  const bad = lines
    .map((ln, i) => ({ ln, i }))
    .filter(({ ln }) => /(^|[^.A-Za-z_])getData\s*\(/.test(ln) && !/function swGet/.test(ln))
    .map(({ ln, i }) => `${i + 1}: ${ln.trim().slice(0, 100)}`);
  assert.deepEqual(bad, [], `leituras fora do swGet: ${bad.join(' | ')}`);
});

// Migração FolhaDB: nenhum script da folha pode tocar os globais disputados
// window.getData/window.saveData (armadilha legacy-deprecation.js). Leituras
// passam por swGet (SiswebData-first, fallback FolhaDB); escritas por FolhaDB.
test('folha usa namespace FolhaDB e nao disputa os globais legados', () => {
  const files = ['folha-firebase-manager.js', 'folha-firebase-optimized.js',
    'folha-main.js', 'folha-relatorios.js', 'folha-funcionarios.js',
    'folha-lancamentos.js', 'folha-cargos.js', 'folha-utils.js',
    'folha-filtros.js', 'folha-paginacao.js', 'banco-horas-config.js',
    'banco-horas-service.js', 'banco-horas-firebase.js',
    'banco-horas-relatorios.js', 'banco-horas-ui.js'];
  const bad = [];
  for (const f of files) {
    const src = readFileSync(new URL(`../folha_pagamento/${f}`, import.meta.url), 'utf8');
    src.split('\n').forEach((ln, i) => {
      const code = ln.split('//')[0];
      if (/window\.(getData|saveData|setupListener)\s*[=(]/.test(code)) {
        bad.push(`${f}:${i + 1}: ${ln.trim().slice(0, 100)}`);
      }
    });
  }
  assert.deepEqual(bad, [], `toques no global legado: ${bad.join(' | ')}`);
  const manager = readFileSync(new URL('../folha_pagamento/folha-firebase-manager.js', import.meta.url), 'utf8');
  assert.match(manager, /window\.FolhaDB\s*=/);
  assert.match(manager, /getData:\s*folhaGetData/);
  assert.match(manager, /saveData:\s*folhaSaveData/);
});
