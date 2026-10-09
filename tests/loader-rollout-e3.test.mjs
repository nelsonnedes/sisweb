import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Padronização "Inicializando Sistema de {Módulo}..." + E3 (loader nos
// deletes PCT + tag do helper).
const vendasJs = readFileSync('vendas.js', 'utf8');
const comprasJs = readFileSync('compras.js', 'utf8');
const pctHtml = readFileSync('romaneiopct.html', 'utf8');
const listaPct = readFileSync('modules/romaneiopct/modal-lista-romaneios-pct.js', 'utf8');
const clientesPct = readFileSync('modules/romaneiopct/modal-clientes-pct.js', 'utf8');

test('textos de inicialização seguem o padrão "Inicializando Sistema de X..."', () => {
  assert.match(vendasJs, /Inicializando Sistema de Vendas\.\.\./);
  assert.match(comprasJs, /Inicializando Sistema de Compras\.\.\./);
  assert.doesNotMatch(vendasJs, /Iniciando sistema\.\.\./);
  assert.doesNotMatch(comprasJs, /Inicializando sistema de compras\.\.\./);
});

test('E3: romaneiopct carrega o helper de loading', () => {
  assert.match(pctHtml, /js\/sisweb-loading\.js\?v=[0-9a-f]{12}/);
});

test('E3: delete de romaneio PCT mostra/esconde loader (finally)', () => {
  const i = listaPct.indexOf('async function deleteRomaneio(romaneioId)');
  assert.ok(i !== -1);
  const tail = listaPct.slice(i, i + 3000);
  assert.match(tail, /SiswebLoading\.show\('Excluindo romaneio\.\.\.'\)/);
  assert.match(tail, /finally \{\s+try \{ if \(window\.SiswebLoading/);
});

test('E3: delete de cliente PCT mostra/esconde loader (finally)', () => {
  const i = clientesPct.indexOf('async function deleteClient(clientId, clientName)');
  assert.ok(i !== -1);
  const tail = clientesPct.slice(i, i + 800);
  assert.match(tail, /SiswebLoading\.show\('Excluindo cliente\.\.\.'\)/);
  assert.match(clientesPct, /\} finally \{\s+try \{ if \(window\.SiswebLoading && typeof window\.SiswebLoading\.hide/);
});
