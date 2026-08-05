import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('baixa individual e modal expõem exclusão permanente selecionada', () => {
  const html = read('estoque.html');

  assert.match(html, /id="excluirTorasSaidaSelecionadasBtn"[\s\S]*onclick="excluirTorasSaidaSelecionadas\(\)"/);
  assert.match(html, /id="excluirTorasModalSelecionadasBtn"[\s\S]*onclick="excluirTorasModalSelecionadas\(\)"/);
  assert.match(html, /<option value="exclusao">Exclusão<\/option>/);
  assert.match(html, /Excluir Selecionadas/);
});

test('exclusão em lote é tenant-scoped, auditável e multipath', () => {
  const js = read('estoque.js');
  const block = js.match(/async function excluirTorasDoEstoqueEmLote[\s\S]*?(?=\nasync function excluirTora\()/)?.[0] || '';

  assert.match(block, /updates\[`estoqueTorasAtual\/\$\{String\(tora\.id\)\}`\] = null/);
  assert.match(block, /updates\[`movimentacoesToras\/\$\{String\(mov\.id\)\}`\] = mov/);
  assert.match(block, /await window\.firebaseService\.updatePaths\(updates\)/);
  assert.match(block, /tipo: 'exclusao'/);
  assert.match(block, /observacoes: 'Exclusão permanente em lote'/);
  assert.match(block, /const estoqueRestante = estoqueAtual\.filter/);
  assert.match(block, /estoqueAtual = estoqueRestante/);
});

test('seleção do modal nunca inclui toras já carregadas na baixa', () => {
  const js = read('estoque.js');
  const modalIds = js.match(/function obterIdsTorasModalMarcadasParaExclusao[\s\S]*?\n\}/)?.[0] || '';
  const toggle = js.match(/function toggleToraSelecao[\s\S]*?(?=\nfunction confirmarSelecaoToras)/)?.[0] || '';

  assert.match(modalIds, /idsJaCarregados/);
  assert.match(modalIds, /!idsJaCarregados\.has/);
  assert.match(toggle, /const normalizedToraId = String\(toraId\)/);
  assert.match(toggle, /String\(t\.id\) === normalizedToraId/);
  assert.match(js, /function atualizarAcoesExclusaoToras/);
  assert.match(js, /async function excluirTorasSaidaSelecionadas/);
  assert.match(js, /async function excluirTorasModalSelecionadas/);
});

test('exclusão individual reutiliza a mesma transação em lote', () => {
  const js = read('estoque.js');
  const block = js.match(/async function excluirTora\(toraId\)[\s\S]*?\n\}/)?.[0] || '';

  assert.match(block, /return excluirTorasDoEstoqueEmLote\(\[toraId\]/);
  assert.doesNotMatch(block, /saveToFirebase|saveData|estoqueAtual = estoqueAtual\.filter/);
});
