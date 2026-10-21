import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('estoque-madeira-serrada.html', 'utf8');
const js = fs.readFileSync('js/estoque-madeira-serrada.js', 'utf8');
const coreSrc = fs.readFileSync('js/estoque-serrado-core.js', 'utf8');
const menu = fs.readFileSync('menu-component.js', 'utf8');
const hosting = fs.readFileSync('hosting-files.json', 'utf8');
const vendas = fs.readFileSync('vendas.js', 'utf8');

test('menu Estoque aponta para a página e o core está publicado', () => {
  assert.match(menu, /resolveUrl\('estoque-madeira-serrada\.html'\)[\s\S]{0,80}Estoque de Madeira Serrada/);
  assert.ok(hosting.includes('"estoque-madeira-serrada.html"'));
  assert.ok(hosting.includes('"js/estoque-madeira-serrada.js"'));
  assert.ok(hosting.includes('"js/estoque-serrado-core.js"'));
});

test('página: busca, Novo Produto, tabela padrão Vendas e modal completo', () => {
  assert.match(html, /id="emsSearch"/);
  assert.match(html, /id="emsNewBtn"[\s\S]*Novo Produto/);
  assert.match(html, /id="emsTableBody"/);
  assert.match(html, /id="emsSelectAll"/);
  assert.match(html, /id="emsSelectAllMobile"/);
  assert.match(html, /id="emsPrintSelectedBtn"/);
  assert.match(html, /id="emsDeleteSelectedBtn"/);
  assert.match(html, /id="emsModal"/);
  assert.match(html, /name="emsTipo" value="manual"/);
  assert.match(html, /name="emsTipo" value="romaneio"/);
  assert.match(html, /id="emsBaseSection"/);
  assert.match(html, /id="emsDimsSection"/);
  assert.match(html, /id="emsManualPreview"/);
  assert.match(html, /id="emsRomPreview"/);
  assert.match(html, /Adicionar Estoque/);
  assert.match(html, /Carregar Itens/);
  for (const label of ['Código', 'Nome', 'Preço', 'Estoque', 'M. Linear', 'Volume (m³)', 'Ações']) {
    assert.ok(new RegExp('<th[^>]*>' + label.replace('(', '\\(').replace(')', '\\)') + '</th>').test(html), label);
  }
  assert.doesNotMatch(html, /<th>Espécie<\/th>/);
  assert.doesNotMatch(html, /<th>Dimensões \(cm\)<\/th>/);
});

test('módulo usa o core canônico e mantém paginação da página', () => {
  assert.match(js, /var NODE = 'produtos'/);
  assert.match(js, /loadFromFirebase\(NODE\)/);
  assert.match(js, /saveToFirebase\(NODE/);
  assert.match(js, /PAGE_OPTIONS = \[10, 25, 50, 100\]/);
  assert.match(js, /PAGE_DEFAULT = 25/);
  assert.match(js, /window\.EstoqueSerradoCore/);
  assert.match(js, /C\.temDimsSerrado/);
  assert.match(js, /C\.estoqueZeradoNaLista/);
  assert.match(js, /C\.calcularVolume/);
  assert.match(js, /C\.volumeProduto/);
  assert.match(js, /C\.metrosLineares/);
  assert.match(js, /romDateMs/);
  assert.match(js, /ems-modal-open/);
  assert.match(js, /function disponibilidade/);
  assert.match(js, /function buildPayload/);
  assert.match(js, /function removeSelected/);
  assert.match(js, /function printSelected/);
  assert.match(js, /function toggleSelectAll/);
  assert.match(js, /selected: new Set/);
  assert.doesNotMatch(js, /estoqueDetalhado/);
  assert.match(vendas, /function temDimsSerrado/);
  assert.match(vendas, /function volumeSerradoProduto/);
  assert.match(vendas, /for \(const prod of criadosProdutos\)/, 'Vendas grava produtos por item, sem substituir o nó inteiro');
});

test('edicao e preview nao exibem chave tecnica do romaneio', () => {
  assert.match(js, /function numeroLegivel/);
  assert.match(js, /function limparDescricaoRomaneio/);
  assert.match(js, /function resolverRomaneio/);
  assert.match(js, /opt\.textContent = romLabel\(rom\)/);
  assert.match(js, /src\.descricao = limparDescricaoRomaneio/);
  assert.match(js, /romaneioNumero: numeroLegivel\(src\.romaneioNumero/);
  assert.match(js, /romaneioNumero: romNumero\(rom\)/);
  assert.match(js, /Romaneio já adicionado ao estoque/);
  assert.match(js, /Já em estoque — desativado/);
  assert.match(js, /function romaneioItemInfo/);
  assert.match(js, /box\.innerHTML = banner \+ rows/);
});

test('core canônico replica fórmulas do Vendas e trata zero/ppp', () => {
  const sb = {};
  vm.createContext(sb);
  vm.runInContext(coreSrc, sb);
  const C = sb.EstoqueSerradoCore;
  assert.equal(C.calcularVolume(2.5, 15, 300, 10, 1), 0.112);
  assert.equal(C.calcularVolume(2.5, 15, 300, 10, 2), 0.225);
  assert.equal(C.calcularVolume(2.5, 15, 300, 0, 1), 0);
  assert.equal(C.volumeProduto({ espessura: 2.5, largura: 15, comprimento: 300, pecas: 10 }), 0.112);
  assert.equal(C.volumeProduto({ volumeM3: 0.5, estoque: 9 }), 0.5);
  assert.equal(C.metrosLineares({ comprimento: 300, pecas: 10, pecasPorPacote: 2 }), 30);
  assert.equal(C.area({ largura: 15, comprimento: 300, pecas: 10, pecasPorPacote: 2 }), 9);
  assert.equal(C.temDimsSerrado({ tipoProduto: 'romaneio' }), true);
  assert.equal(C.temDimsSerrado({ volumeM3: 0.1, pecas: 2 }), true);
  assert.equal(C.estoqueZeradoNaLista({ tipoProduto: 'romaneio', pecas: 1, estoque: 0 }), false);
  assert.equal(C.estoqueZeradoNaLista({ tipoProduto: 'romaneio', pecas: 0, estoque: 0 }), true);
  assert.equal(C.estoqueZeradoNaLista({ tipoProduto: 'manual', estoque: 0 }), true);
  assert.equal(C.isProdutoJunk({ nome: 'Produto sem nome', preco: 0, estoque: 0 }), true);
});

test('edição preserva tipo romaneio e não zera volume/km', () => {
  assert.match(js, /var tipo = item && item\.tipoProduto === 'romaneio' \? 'romaneio' : 'manual'/);
  assert.match(js, /romRadio\.disabled = false/);
  assert.match(js, /tipo === 'romaneio' \? 'm³'/);
  assert.match(js, /volume = \(tipo === 'romaneio' && Number\(src\.volumeM3\) > 0\)/);
  assert.match(js, /metrosLineares: ml/);
  assert.match(js, /created: clean\.created \|\| now/);
  assert.match(js, /estoque = volume/);
});
