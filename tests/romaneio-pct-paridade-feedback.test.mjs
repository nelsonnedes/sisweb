import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

// Paridade de feedback TL x PCT (relatos 2026-10-10):
// 1) modal Lista de Romaneios do PCT mostra "Carregando romaneios..." como o TL;
// 2) PCT exibe toast ao editar/adicionar/atualizar item como o TL.

const pctLista = fs.readFileSync('modules/romaneiopct/modal-lista-romaneios-pct.js', 'utf8');
const tlLista = fs.readFileSync('modules/modals/modal-lista-romaneios.js', 'utf8');
const pctTab = fs.readFileSync('romaneiopct-tabela.js', 'utf8');

test('PCT lista: estado de carregamento espelha o TL', async (t) => {
  await t.test('TL tem branch isLoading com spinner', () => {
    assert.ok(tlLista.includes('Carregando romaneios...'), 'TL mostra spinner');
  });

  await t.test('PCT define isLoading ao carregar e reseta no finally', () => {
    assert.ok(pctLista.includes('state.isLoading = true'), 'PCT liga isLoading');
    assert.ok(pctLista.includes('updateLoadingState'), 'PCT tem updateLoadingState');
    assert.ok(pctLista.includes('state.isLoading = false'), 'PCT desliga isLoading');
  });

  await t.test('PCT renderiza linha Carregando romaneios...', () => {
    assert.ok(pctLista.includes('Carregando romaneios...'), 'PCT mostra spinner');
    assert.ok(pctLista.includes('if (state.isLoading)'), 'PCT checa isLoading no render');
  });
});

test('PCT itens: toasts espelham o TL', async (t) => {  await t.test('editar mostra info como no TL', () => {
    assert.ok(pctTab.includes("notifyUser('Item carregado para edição', 'info')"),
      'PCT informa item carregado para edicao');
  });

  await t.test('atualizar mostra sucesso como no TL', () => {
    assert.ok(pctTab.includes("notifyUser('Item atualizado com sucesso!', 'success')"),
      'PCT confirma item atualizado');
  });

  await t.test('adicionar mostra sucesso', () => {
    assert.ok(pctTab.includes("notifyUser('Item adicionado ao romaneio.', 'success')"),
      'PCT confirma item adicionado');
  });
});

test('Pos-save: PCT/PES/TORA/pre perguntam limpar como o TL', async (t) => {  const prompt = "Deseja limpar o formulário para criar um novo romaneio?";
  await t.test('PCT pergunta antes de limpar', () => {
    const src = fs.readFileSync('romaneiopct-tabela.js', 'utf8');
    assert.ok(src.includes(prompt), 'PCT tem prompt pos-save');
    assert.ok(src.includes('limparFormularioAposSalvamento();'), 'PCT limpa apos confirmar');
  });

  await t.test('PES pergunta antes de resetForm', () => {
    const src = fs.readFileSync('romaneiopes.html', 'utf8');
    assert.ok(src.includes(prompt), 'PES tem prompt pos-save');
  });

  await t.test('TORA pergunta antes de limpar', () => {
    const src = fs.readFileSync('romaneiotora_tabela.js', 'utf8');
    assert.ok(src.includes(prompt), 'TORA tem prompt pos-save');
  });

  await t.test('pre-romaneio pergunta antes de limpar', () => {
    const src = fs.readFileSync('preromaneio.js', 'utf8');
    assert.ok(src.includes('Deseja limpar o formulário para criar um novo pré-romaneio?'),
      'pre tem prompt pos-save');
  });
});

test('PES/TORA itens: toasts espelham o TL', async (t) => {
  await t.test('PES editar/adicionar/atualizar com toast', () => {
    const src = fs.readFileSync('romaneiopes.html', 'utf8');
    assert.ok(src.includes("notifyUser('Item carregado para edição', 'info')"), 'PES edit info');
    assert.ok(src.includes("notifyUser('Item atualizado com sucesso!', 'success')"), 'PES update');
    assert.ok(src.includes("notifyUser('Item adicionado ao romaneio.', 'success')"), 'PES add');
  });

  await t.test('TORA adicionar/atualizar com toast', () => {
    const src = fs.readFileSync('romaneiotora_tabela.js', 'utf8');
    assert.ok(src.includes("'Item atualizado com sucesso!'"), 'TORA update');
    assert.ok(src.includes("'Item adicionado com sucesso!'"), 'TORA add');
  });
});

test('Save TORA/TL: loader padronizado SiswebLoading', async (t) => {
  await t.test('TORA usa SiswebLoading primeiro', () => {
    const src = fs.readFileSync('romaneiotora_tabela.js', 'utf8');
    assert.ok(src.includes("window.SiswebLoading.show('Salvando romaneio...'"),
      'TORA mostra loader padrao');
    assert.ok(src.includes('window.SiswebLoading.hide()'), 'TORA esconde loader');
  });

  await t.test('modulo compartilhado usa SiswebLoading primeiro', () => {
    const src = fs.readFileSync('modules/romaneio/salvar-romaneio.js', 'utf8');
    assert.ok(src.includes("window.SiswebLoading.show('Salvando romaneio...'"),
      'TL mostra loader padrao');
  });
});
