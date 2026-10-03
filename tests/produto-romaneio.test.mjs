import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const src = readFileSync(new URL('../vendas.js', import.meta.url), 'utf8');

function extract(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nf ' + name);
  const j = src.indexOf('{', i);
  let d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(extract('calcularVolumeSerradoM3'), sandbox);
const calc = sandbox.calcularVolumeSerradoM3;

test('volume serrado: 2.5 x 15 x 300 cm x 10 pçs', () => {
  // 2.5*15*300/1e6 = 0.01125 m³/pc × 10 ≈ 0.112 (float) em 3 casas
  assert.equal(calc(2.5, 15, 300, 10, 1), 0.112);
});

test('volume serrado: ppp multiplica (PCT)', () => {
  assert.equal(calc(2.5, 15, 300, 10, 2), 0.225);
});

test('volume serrado: zero quando dimensão falta', () => {
  assert.equal(calc(0, 15, 300, 10, 1), 0);
  assert.equal(calc('', 15, 300, 10, 1), 0);
  assert.equal(calc(2.5, 15, 300, 0, 1), 0);
});

test('volume serrado: aceita vírgula decimal pt-BR', () => {
  assert.equal(calc('2,5', '15', '300', 10, 1), 0.112);
});

test('salvarProduto persiste campos do romaneio', () => {
  assert.ok(/produto\.tipoProduto = 'romaneio'/.test(src), 'tipoProduto persistido');
  assert.ok(/produto\.volumeM3 = calcularVolumeSerradoM3/.test(src), 'volumeM3 persistido');
  assert.ok(/produto\.romaneioId = d\.romaneioId/.test(src), 'romaneioId persistido');
});

test('aba Produtos padronizada: form inline + modal de lista, sem produtoModal', () => {
  const html = readFileSync(new URL('../vendas.html', import.meta.url), 'utf8');
  assert.ok(!/produtoModal/.test(html + src), 'sem referência a produtoModal');
  assert.ok(/id="listaProdutosModal"/.test(html), 'modal Lista de Produtos existe');
  assert.ok(/id="secaoProdutoForm"/.test(html), 'form inline existe');
  assert.ok(/name="tipoProdutoForm"/.test(html), 'radios Comum/Romaneio existem');
  assert.ok(/id="previewProdutoRomaneio"/.test(html), 'preview existe');
  for (const fn of ['alternarTipoProdutoForm', 'fecharProdutoForm', 'carregarItensProdutoRomaneio', 'renderPreviewProdutoRomaneio', 'adicionarEstoqueGruposRomaneio', 'renderPreviewProdutoManuel', 'carregarRomaneiosEm', 'acharProdutoSerradoExistente', 'adicionarItemProdutoManuel', 'excluirItemProdutoManuel', 'limparItensProdutoManuel', 'adicionarEstoqueManuel', 'agruparItensRomaneioExLxC', 'excluirGrupoPreviewRomaneio', 'gruposRomaneioSelecionados']) {
    assert.ok(src.includes('function ' + fn + '('), `função ${fn} existe`);
  }
  assert.ok(!/usarGrupoProdutoRomaneio/.test(src), 'usarGrupo removido (checkboxes no preview)');
  assert.ok(!/agrProdEsp/.test(src), 'checkboxes Agrupar removidos (auto ExLxC)');
  assert.ok(/value="manuel"[^>]*> Produto Manuel/.test(html), 'radio Produto Manuel existe');
  assert.ok(/id="produtoManuelFooter"/.test(html), 'footer manuel existe');
  assert.ok(/id="produtoRomaneioFooter"/.test(html), 'footer romaneio existe');
  assert.ok(/id="previewProdutoManuel"/.test(html), 'preview manuel existe');
  assert.ok(/id="formProdutoBase"/.test(html), 'base do form existe');
  assert.ok(/adicionarItemProdutoManuel/.test(html), 'botão Adicionar item existe');
  assert.ok(!/agrProdEsp/.test(html + src), 'checkboxes Agrupar removidos (auto ExLxC)');
});
