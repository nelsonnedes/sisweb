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

test('PCT itens: toasts espelham o TL', async (t) => {
  await t.test('editar mostra info como no TL', () => {
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
