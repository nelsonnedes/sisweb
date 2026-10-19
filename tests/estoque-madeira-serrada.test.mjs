import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync('estoque-madeira-serrada.html', 'utf8');
const js = fs.readFileSync('js/estoque-madeira-serrada.js', 'utf8');
const menu = fs.readFileSync('menu-component.js', 'utf8');
const hosting = fs.readFileSync('hosting-files.json', 'utf8');
const vendas = fs.readFileSync('vendas.js', 'utf8');

test('menu Estoque aponta para a página de madeira serrada', () => {
  assert.match(menu, /resolveUrl\('estoque-madeira-serrada\.html'\)[\s\S]{0,80}Estoque de Madeira Serrada/);
  assert.ok(hosting.includes('"estoque-madeira-serrada.html"'));
  assert.ok(hosting.includes('"js/estoque-madeira-serrada.js"'));
});

test('página: busca, Novo Produto, tabela e modal com as duas opções', () => {
  assert.match(html, /id="emsSearch"/);
  assert.match(html, /id="emsNewBtn"[\s\S]*Novo Produto/);
  assert.match(html, /id="emsTableBody"/);
  assert.match(html, /id="emsModal"/);
  assert.match(html, /name="emsTipo" value="manual"/);
  assert.match(html, /name="emsTipo" value="romaneio"/);
  assert.match(html, /id="emsManualPreview"/);
  assert.match(html, /id="emsRomPreview"/);
  assert.match(html, /Adicionar Estoque/);
  assert.match(html, /Carregar Itens/);
});

test('módulo: lê/salva o mesmo nó produtos e padroniza paginação', () => {
  assert.match(js, /var NODE = 'produtos'/);
  assert.match(js, /loadFromFirebase\(NODE\)/);
  assert.match(js, /saveToFirebase\(NODE/);
  assert.match(js, /PAGE_OPTIONS = \[10, 25, 50, 100\]/);
  assert.match(js, /PAGE_DEFAULT = 25/);
  assert.match(html, /class="nf-pagination-bar"/);
  assert.match(js, /romaneios\/tl/);
  assert.match(js, /volumeFromDims/);
  assert.match(js, /function hasStock/);
  assert.match(js, /ems-modal-open/);
  assert.match(js, /function romLabel/);
  assert.match(vendas, /function temDimsSerrado/);
  assert.match(vendas, /sortRomaneiosProdutoByDate/);
  assert.match(js, /romDateMs/);
  assert.match(js, /function volumeProduto/);
  assert.match(vendas, /function volumeSerradoProduto/);
});

test('tabela exibe estoque serrado completo (pç · m³ · ml · m²) e sufixo', () => {
  assert.match(js, /function estoqueDetalhado/);
  assert.match(js, /p\\u00e7 \\u00b7/);
  assert.match(js, /m\\u00b3 \\u00b7/);
  assert.match(js, /ml \\u00b7/);
  assert.match(js, /m\\u00b2/);
  assert.match(js, / Serrado/);
});

function extrairFuncao(nome) {
  const i = js.indexOf('function ' + nome + '(');
  if (i < 0) throw new Error('função não encontrada: ' + nome);
  const j = js.indexOf('{', i);
  let d = 0;
  for (let k = j; k < js.length; k++) {
    if (js[k] === '{') d++;
    if (js[k] === '}') { d--; if (d === 0) return js.slice(i, k + 1); }
  }
  throw new Error('função desbalanceada: ' + nome);
}

test('estoqueDetalhado formata pç/m³/ml/m² do serrado', () => {
  const sb = { num: (v) => parseFloat(String(v == null ? '' : v).replace(',', '.')) || 0 };
  vm.createContext(sb);
  vm.runInContext(extrairFuncao('fmtNum'), sb);
  sb.volumeProduto = () => 0.01;
  vm.runInContext(extrairFuncao('estoqueDetalhado'), sb);
  const p = { nome: 'Mista 1x100x100', tipoProduto: 'romaneio', pecas: 1, volumeM3: 0.01, largura: 100, comprimento: 100 };
  assert.equal(sb.estoqueDetalhado(p), '1 pç · 0,010 m³ · 1,00 ml · 1,00 m²');
});