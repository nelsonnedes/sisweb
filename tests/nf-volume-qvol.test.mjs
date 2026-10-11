import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nf = readFileSync(new URL('../notas-fiscais.html', import.meta.url), 'utf8');

test('Volume qVol: auto-preenche com a soma das quantidades dos itens quando não informado', () => {
  assert.match(nf, /qVol não informado → preencher com a soma das quantidades dos itens/);
  assert.match(nf, /const somaQtd = \(_itensNF \|\| \[\]\)\.reduce/);
  assert.match(nf, /vols\[0\]\.qVol = String\(Math\.round\(somaQtd\)\)/);
});
