import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const src = read('modules/core/client-list-columns.js');
const saveFix = read('romaneios-client-save-fix.js');
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

test('modulo: saveToFirebase chamado com a assinatura (path, null, clean) e anterior ao fallback saveData', () => {
  const remote = src.match(/function remoteSave\(clean\) \{[\s\S]*?\n    \}/)?.[0] || '';
  assert.ok(remote.length > 0, 'bloco remoteSave encontrado');
  const saveToFirebaseIdx = remote.indexOf('svc.saveToFirebase(path, null, clean)');
  const saveDataIdx = remote.indexOf('svc.saveData(path, clean)');
  assert.ok(saveToFirebaseIdx >= 0, 'saveToFirebase(path, null, clean) presente');
  assert.ok(saveDataIdx >= 0, 'fallback saveData(path, clean) presente');
  assert.ok(saveToFirebaseIdx < saveDataIdx, 'saveToFirebase (3-arg, convencao global) deve ser tentado antes do saveData local');
  assert.doesNotMatch(remote, /saveToFirebase\(path, clean\)/);
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

test('modulo: larguras aplicadas com !important (vence CSS global com width XX% !important do fornecedor)', () => {
  assert.match(src, /function setColumnWidth\(th, px\)/);
  assert.match(src, /th\.style\.setProperty\('width', px \+ 'px', 'important'\)/);
  assert.match(src, /setColumnWidth\(headers\[index\], clean\[label\]\)/);
  assert.match(src, /setColumnWidth\(th, width\)/);
  assert.doesNotMatch(src, /headers\[index\]\.style\.width = clean\[label\]/);
  assert.doesNotMatch(src, /th\.style\.width = width \+ 'px'/);
});

test('modulo: table-layout fixed aplicado via inline !important (vence table-layout auto !important do CSS global)', () => {
  assert.match(src, /function ensureFixedLayout\(table\)/);
  assert.match(src, /table\.style\.setProperty\('table-layout', 'fixed', 'important'\)/);
  assert.match(src, /ensureFixedLayout\(table\)/);
});

test('modulo: closures do drag com escopo por iteracao (sem var compartilhado no loop)', () => {
  const block = src.match(/function attachResize\(table\) \{[\s\S]*?\n    \}/)?.[0] || '';
  assert.ok(block.length > 0, 'bloco attachResize encontrado');
  assert.match(block, /let th = headers\[index\]/);
  assert.match(block, /let handle = document\.createElement\('div'\)/);
  assert.doesNotMatch(block, /var th = headers\[index\]/);
  assert.doesNotMatch(block, /var handle = document\.createElement/);
});

test('paginas: tag do modulo com data-page e data-target corretos', () => {
  assert.match(pages.preromaneio, /modules\/core\/client-list-columns\.js[^>]*data-page="preromaneio"[^>]*data-target="clientListTable"/);
  assert.match(pages.tl, /modules\/core\/client-list-columns\.js[^>]*data-page="tl"[^>]*data-target="clientListTable"/);
  assert.match(pages.pct, /modules\/core\/client-list-columns\.js[^>]*data-page="pct"[^>]*data-target="clientListTable"/);
  assert.match(pages.pes, /modules\/core\/client-list-columns\.js[^>]*data-page="pes"[^>]*data-target="clientListBody"/);
  assert.match(pages.tora, /modules\/core\/client-list-columns\.js[^>]*data-page="fornecedores"[^>]*data-target="fornecedorListTable"/);
});

test('romaneios-client-save-fix: id null grava flat (convencao nativa), id auto segue com push-key', () => {
  const patch = saveFix.match(/svc\.saveToFirebase = async \(path, id, data\) => \{[\s\S]*?\n        \};/)?.[0] || '';
  assert.ok(patch.length > 0, 'patch saveToFirebase do adapter encontrado');
  const nullBranch = patch.match(/finalId === null\) \{[\s\S]*?\n                \}/)?.[0] || '';
  assert.ok(nullBranch.includes('svc.saveData(base, data)'), 'id null delega para saveData(base, data) (escrita flat, sem push-key)');
  assert.ok(nullBranch.indexOf('push()') < 0, 'id null nao gera child push-key');
  assert.ok(patch.includes("finalId === 'auto'"), 'id auto mantem geracao de key');
});

test('romaneiopes: divergencia de Acoes corrigida (sem regras de tabela para clientListModal)', () => {
  assert.doesNotMatch(pages.pes, /#clientListModal \.table/);
});
