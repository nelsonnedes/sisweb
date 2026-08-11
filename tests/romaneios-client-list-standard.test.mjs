import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const pesHtml = read('romaneiopes.html');
const preHtml = read('preromaneio.html');
const preJs = read('preromaneio-modals.js');
const pctHtml = read('romaneiopct.html');

const clientLabels = ['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'Ações'];

const extractFn = (src, fnName) => {
  const match = src.match(new RegExp(`function ${fnName}\\([^)]*\\) \\{[\\s\\S]*?(?=\\r?\\n\\s*function )`));
  return match ? match[0] : '';
};

test('romaneiopes: renderiza com fallback legível e três ações seguras', () => {
  assert.match(pesHtml, /const clientValue = .*N\u00e3o informado/);
  assert.match(pesHtml, /const appendCell = \(row, value\) => \{[\s\S]*?createElement\('td'\)/);
  assert.match(pesHtml, /cell\.textContent = value/);
  for (const cls of ['select-button', 'edit-button', 'delete-button']) {
    assert.match(pesHtml, new RegExp(`createClientAction\\('${cls}'`));
  }
  assert.match(pesHtml, /button\.setAttribute\('aria-label', title\)/);

  const renderFn = extractFn(pesHtml, 'renderClientListModal');
  assert.match(renderFn, /clientValue\(client\.name, client\.nome\)/);
  assert.match(renderFn, /clientValue\(client\.cidade, client\.city\)/);
  assert.match(renderFn, /clientValue\(client\.estado, client\.state\)/);
  assert.match(renderFn, /clientValue\(client\.phone, client\.telefone, client\.celular\)/);
  assert.match(renderFn, /clientValue\(client\.email\)/);
  assert.doesNotMatch(renderFn, /N\/A/);
});

test('romaneiopes: empty state usa colspan=6 e nunca N/A', () => {
  const renderFn = extractFn(pesHtml, 'renderClientListModal');
  const emptyState = renderFn.match(/pageItems\.length === 0[\s\S]{0,400}/)?.[0] || '';
  assert.match(emptyState, /colspan="6"/);
  assert.doesNotMatch(emptyState, /N\/A/);
});

test('preromaneio html: cabeçalho segue o contrato de seis colunas do PCT', () => {
  for (const label of clientLabels) {
    assert.match(preHtml, new RegExp(`<th[^>]*>${label}</th>`), `coluna ${label} ausente no cabeçalho`);
  }
  assert.match(preHtml, /<th style="width: 120px; text-align: center;">A\u00e7\u00f5es<\/th>/);
});

test('preromaneio js: renderizador usa textContent, fallback Não informado e três ações', () => {
  assert.match(preJs, /const clientValue = .*N\u00e3o informado/);
  assert.match(preJs, /const appendCell = \(row, value\) => \{[\s\S]*?createElement\('td'\)/);
  assert.match(preJs, /cell\.textContent = value/);
  for (const cls of ['select-button', 'edit-button', 'delete-button']) {
    assert.match(preJs, new RegExp(`createClientAction\\('${cls}'`));
  }
  assert.match(preJs, /setAttribute\('aria-label', title\)/);
  assert.match(preJs, /colspan="6"/);

  const renderFn = extractFn(preJs, 'renderClientList');
  assert.match(renderFn, /clientValue\(client\.name, client\.nome\)/);
  assert.match(renderFn, /clientValue\(client\.city, client\.cidade\)/);
  assert.match(renderFn, /clientValue\(client\.state, client\.estado\)/);
  assert.match(renderFn, /clientValue\(client\.phone, client\.telefone, client\.celular\)/);
  assert.match(renderFn, /clientValue\(client\.email\)/);
  assert.doesNotMatch(renderFn, /N\/A/);
});

test('preromaneio js: handlers de edição e exclusão existem e usam o modal/estado de edição', () => {
  assert.match(preJs, /function editPreRomaneioClient\(id\) \{/);
  assert.match(preJs, /function deletePreRomaneioClient\(id\) \{/);
  assert.match(preJs, /editingClientId/);
  assert.match(preJs, /clientModalTitle/);
  assert.match(preJs, /window\.clientService[\s\S]*deleteClient|window\.deleteClient/);
});

test('romaneiopct: referência de experiência mantém seis colunas e ações', () => {
  for (const label of clientLabels) {
    assert.match(pctHtml, new RegExp(`<th[^>]*>${label}</th>`), `coluna ${label} ausente no cabeçalho PCT`);
  }
  assert.match(pctHtml, /<th style="width: 120px; text-align: center;">A\u00e7\u00f5es<\/th>/);
  assert.match(pctHtml, /colspan="6"/);
});