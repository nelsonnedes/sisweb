import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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
});
