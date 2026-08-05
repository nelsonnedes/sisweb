import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('romaneiotora carrega somente os provedores modulares ativos', () => {
  const html = read('romaneiotora.html');

  assert.doesNotMatch(html, /<script[^>]+src="romaneiotora_modais\.js/);
  assert.doesNotMatch(html, /<script[^>]+src="firebaseService\.unified\.js/);
  assert.doesNotMatch(html, /<script[^>]+src="modules\/core\/firebase-service\.js/);
  assert.match(html, /import\('\.\/firebaseService\.js\?v=[^']+'\)/);
  assert.match(html, /window\.__siswebFirebaseServiceReady/);
  assert.match(html, /window\.FirebaseService = window\.firebaseService/);
  for (const source of [
    'fornecedor-modals.js',
    'species-manager.js',
    'modules/modals/modal-especies.js',
    'romaneio-manager.js',
    'modules/reports/imprimir-romaneio.js'
  ]) {
    assert.match(html, new RegExp(`<script[^>]+src="${source.replaceAll('.', '\\.')}[^>]*>`));
  }
});

test('sincronização de tora mantém Firebase como fonte autoritativa', () => {
  const main = read('romaneiotora.js');

  assert.match(main, /let firebaseReadSucceeded = false/);
  assert.match(main, /firebaseReadSucceeded = true/);
  assert.match(main, /source: 'server-unavailable'/);
  assert.doesNotMatch(main, /Modo DownloadOnly: Firebase vazio mas Local tem/);
  assert.match(main, /getFromFirebase\(canonicalSyncKey\)/);
  assert.match(main, /typeof window\.firebaseService\.loadFromFirebase === 'function'/);
});

test('tabela é a única proprietária das ações globais de item', () => {
  const main = read('romaneiotora.js');
  const table = read('romaneiotora_tabela.js');
  const active = `${main}\n${table}`;

  for (const name of ['adicionarItem', 'removerItem', 'limparCamposItem']) {
    const declarations = active.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g')) || [];
    assert.equal(declarations.length, 1, `${name} deve ter um único proprietário ativo`);
  }

  assert.match(main, /function adicionarItemFallback\(/);
  assert.match(main, /function removerItemFallback\(/);
  assert.match(main, /function limparCamposItemFallback\(/);
  assert.match(table, /window\.limparCamposItem = limparCamposItem/);
});

test('edição de tora repõe o item e limpa o estado de edição', () => {
  const table = read('romaneiotora_tabela.js');

  assert.match(table, /const editIndex = Number\.isInteger\(window\.itemEditandoIndex\)/);
  assert.match(table, /window\.romaneioItems\.splice\(targetIndex, 0, novoItem\)/);
  assert.match(table, /window\.itemEditandoIndex = null/);
  for (const alias of ['diametro', 'volumeEstimado', 'volumeLiquido', 'precoUnitario', 'valorTotal']) {
    assert.match(table, new RegExp(`${alias}:`), `item deve preservar alias ${alias}`);
  }
});

test('rascunho de tora permanece local e isolado por tenant', () => {
  const table = read('romaneiotora_tabela.js');
  const draftFunction = table.match(/async function salvarEstadoRomaneioEmEdicao\(\) \{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(draftFunction, /getStorageKey\('romaneioToraEmEdicao'\)/);
  assert.match(draftFunction, /persistLocalValue\(draftKey/);
  assert.doesNotMatch(draftFunction, /saveData\(/);
  assert.match(table, /localStorage\.removeItem\(getStorageKey\('romaneioToraEmEdicao'\)\)/);
});

test('modal canônico usa escaping e cursor explícito nos controles', () => {
  const manager = read('romaneio-manager.js');

  assert.match(manager, /function escapeRomaneioHtml\(/);
  assert.match(manager, /function toInlineRomaneioArg\(/);
  assert.match(manager, /button:not\(:disabled\)[\s\S]*cursor: pointer/);
  assert.match(manager, /const actionId = toInlineRomaneioArg\(r\.id\)/);
  assert.match(manager, /escapeRomaneioHtml\(nome\)/);
  assert.match(manager, /escapeRomaneioHtml\(resumo/);
});

test('fornecedor canônico mantém autocomplete e seleção após retirar o monólito', () => {
  const html = read('romaneiotora.html');
  const fornecedores = read('fornecedor-modals.js');

  assert.match(html, /showClientSuggestions\(this\)/);
  assert.match(fornecedores, /async function showClientSuggestions\(input\)/);
  assert.match(fornecedores, /await fetchFornecedores\(\)/);
  assert.match(fornecedores, /selectClient\(fornecedor\)/);
  assert.match(fornecedores, /window\.showClientSuggestions = showClientSuggestions/);
});

test('lista canônica de fornecedores preserva ações seguras sem HTML de dados', () => {
  const fornecedores = read('fornecedor-modals.js');
  const renderBasic = fornecedores.match(/async function renderFornecedorListBasic\(filter = ''\) \{[\s\S]*?\n    let _fornecedorFilterTimer/)?.[0] || '';

  assert.match(renderBasic, /editClientFromList\(String\(f\.id\)\)/);
  assert.match(renderBasic, /excluirFornecedor\(String\(f\.id\)\)/);
  assert.doesNotMatch(renderBasic, /tr\.innerHTML\s*=/);
});
