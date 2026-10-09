import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// A4-strangler: leituras/escritas passam por sw*/SiswebData-first.
// Bare getData(/saveData( fora dos helpers = regressão.
function assertNoBareGlobals(src, file, allowedWindowLines) {
  const lines = src.split('\n');
  const bad = [];
  lines.forEach((ln, i) => {
    const t = ln.trim();
    if (t.startsWith('//')) return;
    if (/window\.getData\s*\(/.test(ln) || /window\.saveData\s*\(/.test(ln)) {
      if (!allowedWindowLines(i + 1)) bad.push(`${i + 1}: ${t.slice(0, 100)}`);
      return;
    }
    if (/(^|[^.A-Za-z_])getData\s*\(/.test(ln) || /(^|[^.A-Za-z_])saveData\s*\(/.test(ln)) {
      if (/function swGet|function swSave|saveDataProdutos/.test(ln)) return;
      bad.push(`${i + 1}: ${t.slice(0, 100)}`);
    }
  });
  assert.deepEqual(bad, [], `${file}: acessos globais fora do strangler: ${bad.join(' | ')}`);
}

test('estoque_produtos roteia via swGet/swSave', () => {
  const src = read('estoque_produtos.js');
  const gets = (src.match(/swGet\s*\(/g) || []).length;
  assert.ok(gets >= 14, `esperado >= 14 swGet, obtido ${gets}`);
  assert.ok(/swSave\s*\(/.test(src), 'esperado swSave na escrita de prefs');
  // window.getData/saveData só dentro dos helpers (linhas do helper)
  // (range atualizado na Onda 1 UX-feedback: bloco __alm* inserido antes).
  const helperRange = (n) => n >= 64 && n <= 96;
  assertNoBareGlobals(src, 'estoque_produtos.js', helperRange);
});

test('correcao-interface-database prefere SiswebData no fallback', () => {
  const src = read('correcao-interface-database.js');
  assert.ok(/SiswebData\.get/.test(src), 'loadData deve tentar SiswebData');
  assert.ok(/SiswebData\.save/.test(src), 'saveData fallback deve tentar SiswebData');
  assert.ok(/typeof getData === 'function'/.test(src), 'fallback legado preservado (leitura)');
  assert.ok(/typeof saveData === 'function'/.test(src), 'fallback legado preservado (escrita)');
});
