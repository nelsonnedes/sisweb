import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const src = read('modules/core/client-list-columns.js');
const pages = {
  preromaneio: read('preromaneio.html'),
  tl: read('romaneiotl.html'),
  pct: read('romaneiopct.html'),
  pes: read('romaneiopes.html'),
  tora: read('romaneiotora.html')
};

test('modulo: contrato de colunas por pagina', () => {
  assert.match(src, /var CONTRACT_BY_PAGE = \{/);
  for (const page of ['pct', 'tl', 'pes', 'preromaneio']) {
    assert.match(src, new RegExp(`${page}: \\['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'A\\u00e7\\u00f5es'\\]`));
  }
  assert.match(src, /fornecedores: \['Nome', 'CNPJ', 'Cidade', 'Estado', 'Telefone', 'A\u00e7\u00f5es'\]/);
});

test('modulo: sanitizacao com clamp e minimo proprio de Acoes', () => {
  assert.match(src, /MIN_WIDTH = 60/);
  assert.match(src, /MAX_WIDTH = 400/);
  assert.match(src, /MIN_ACTIONS_WIDTH = PAGE === 'fornecedores' \? 150 : 120/);
  assert.match(src, /function sanitize\(raw\)/);
  assert.match(src, /Math\.max\(min, Math\.min\(max, n\)\)/);
});

test('modulo: paths e chaves de persistencia', () => {
  assert.match(src, /users\/' \+ uid \+ '\/preferences\//);
  assert.match(src, /fornecedorListColumns\/' \+ tenant/);
  assert.match(src, /clientListColumns\/' \+ tenant \+ '\/' \+ PAGE/);
  assert.match(src, /sisweb_/);
});

test('modulo: persistencia local + remota com debounce e espelho', () => {
  assert.match(src, /SAVE_DEBOUNCE_MS = 400/);
  assert.match(src, /localStorage\.setItem\(localStorageKey\(\)/);
  assert.match(src, /function remoteSave\(clean\)/);
  assert.match(src, /clearTimeout\(saveTimer\)/);
  assert.match(src, /setTimeout\(function \(\) \{/);
});

test('modulo: aplicacao de larguras, drag com pointer events e observer', () => {
  assert.match(src, /function applyWidths\(table, clean\)/);
  assert.match(src, /table\.classList\.add\('clc-fixed'\)/);
  assert.match(src, /function attachResize\(table\)/);
  assert.match(src, /pointerdown/);
  assert.match(src, /setPointerCapture/);
  assert.match(src, /MutationObserver/);
  assert.match(src, /window\.ClientListColumns = \{/);
  assert.match(src, /injectStyles/);
});
