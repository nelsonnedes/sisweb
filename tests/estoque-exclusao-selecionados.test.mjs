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

test('movimentacoes: limpar filtros em linha propria + excluir selecionados', () => {
  const html2 = read('estoque.html');
  const js2 = read('estoque.js');
  assert.match(html2, /<div class="form-row mov-acoes-row">/);
  assert.match(html2, /onclick="excluirMovimentacoesSelecionadas\(\)"/);
  assert.match(html2, /id="movExcluirSelectedCount"/);
  const block = js2.match(/async function excluirMovimentacoesSelecionadas\(\)[\s\S]*?\n\}/)?.[0] || '';
  assert.match(block, /movimentacoesToras\//);
  assert.match(block, /__excluirMovEmAndamento/);
  assert.match(js2, /atualizarContadorMovExcluir/);
});

test('movimentacoes: buscar tora unico cobre plaqueta/especie/custodia/autef', () => {
  const html3 = read('estoque.html');
  const js3 = read('estoque.js');
  // id duplicado eliminado (era 2x filtroBuscaToraMov)
  assert.equal((html3.match(/id="filtroBuscaToraMov"/g) || []).length, 1);
  // placeholder anuncia AUTEF
  assert.match(html3, /custódia ou AUTEF/);
  // match cobre AUTEF (via obterTextoBuscaTora)
  assert.match(js3, /geo\.autef \|\| item\.autef/);
  // filtro aplicado uma única vez (resíduo removido)
  const carrega = js3.match(/async function carregarTabelaMovimentacoes[\s\S]*?Ordenação dinâmica/)?.[0] || '';
  assert.equal((carrega.match(/if \(filtro\.buscaTora\)/g) || []).length, 1);
  // consulta usa o mesmo matcher (com AUTEF)
  assert.match(js3, /toraCorrespondeBusca\(t, filtro\.busca\)/);
  // botoes em largura padrao (sem width 100% inline)
  assert.doesNotMatch(html3, /mov-acoes-row[\s\S]{0,400}?style="width: 100%;"/);
});
