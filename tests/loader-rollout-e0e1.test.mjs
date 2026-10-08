import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// E0: helper único de loading (nenhuma página ligada ainda — só vendas carrega,
// sem chamar). E1: vendas.html ganha a div que ativa as 33 calls existentes.
const helper = readFileSync('js/sisweb-loading.js', 'utf8');
const helperCode = helper.replace(/\/\*[\s\S]*?\*\//g, '');
const vendasHtml = readFileSync('vendas.html', 'utf8');
const vendasJs = readFileSync('vendas.js', 'utf8');

test('E0: helper expõe API show/hide sem auto-executar', () => {
  assert.match(helperCode, /window\.SiswebLoading = \{/);
  assert.match(helperCode, /show: show/);
  assert.match(helperCode, /hide: hide/);
  assert.match(helperCode, /getDepth/);
  assert.doesNotMatch(helperCode, /show\(['"]/);
});

test('E0: overlay e CSS criados sob demanda, uma vez, com reentrância', () => {
  assert.match(helperCode, /globalLoadingOverlay/);
  assert.match(helperCode, /sisweb-loading-style/);
  assert.match(helperCode, /depth \+= 1/);
  assert.match(helperCode, /depth = Math\.max\(0, depth - 1\)/);
  assert.match(helperCode, /function hide\(force\)/);
  assert.match(helperCode, /\.active\{display:flex/);
});

test('E1: vendas tem div + texto + helper ligado, sem mudar vendas.js', () => {
  assert.match(vendasHtml, /id="loadingOverlay"/);
  assert.match(vendasHtml, /id="loadingText"/);
  assert.match(vendasHtml, /js\/sisweb-loading\.js\?v=[0-9a-f]{12}/);
  assert.match(vendasJs, /document\.getElementById\('loadingOverlay'\)/);
  assert.match(vendasJs, /document\.getElementById\('loadingText'\)/);
});
