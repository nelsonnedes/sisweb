import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// E4: loader nos deletes TL/PES/TORA (romaneio + cliente PES) + tags do helper.
// Prints com popup ficam de fora (await antes de window.open quebra o gesto).
const tlHtml = readFileSync('romaneiotl.html', 'utf8');
const pesHtml = readFileSync('romaneiopes.html', 'utf8');
const toraHtml = readFileSync('romaneiotora.html', 'utf8');
const tlModal = readFileSync('modules/modals/modal-lista-romaneios.js', 'utf8');
const manager = readFileSync('romaneio-manager.js', 'utf8');

test('E4: TL/PES/TORA carregam o helper de loading', () => {
  for (const [nome, src] of [['tl', tlHtml], ['pes', pesHtml], ['tora', toraHtml]]) {
    assert.match(src, /js\/sisweb-loading\.js\?v=[0-9a-f]{12}/, `tag ausente: ${nome}`);
  }
});

test('E4: delete TL mostra/esconde loader (finally)', () => {
  const i = tlModal.indexOf('async function deleteRomaneio(romaneioId)');
  assert.ok(i !== -1);
  const tail = tlModal.slice(i, i + 1200);
  assert.match(tail, /SiswebLoading\.show\('Excluindo romaneio\.\.\.'\)/);
  assert.match(tlModal, /\} finally \{\s+try \{ if \(window\.SiswebLoading && typeof window\.SiswebLoading\.hide/);
});

test('E4: deletes PES (romaneio + cliente) mostram/escondem loader', () => {
  const d = pesHtml.indexOf('async function deleteRomaneio(index)');
  assert.ok(d !== -1);
  assert.match(pesHtml.slice(d, d + 800), /SiswebLoading\.show\('Excluindo romaneio\.\.\.'\)/);
  const c = pesHtml.indexOf('function deleteClientFromList(clientId)');
  assert.ok(c !== -1);
  assert.match(pesHtml.slice(c, c + 900), /SiswebLoading\.show\('Excluindo cliente\.\.\.'\)/);
  assert.match(pesHtml, /SiswebLoading\.hide\(\); \} catch \(\_\) \{\}/);
});

test('E4: wrappers TORA escondem loader no settle (sem quebrar toast)', () => {
  assert.match(manager, /window\.excluirRomaneioTora = function/);
  assert.match(manager, /window\.excluirRomaneioGeneric = \(type, id\) =>/);
  assert.match(manager, /__hideLoader\(\)/);
  assert.match(manager, /Não foi possível excluir o romaneio no servidor\./);
  assert.match(manager, /Não foi possível excluir no servidor\. Verifique sua conexão\./);
});
