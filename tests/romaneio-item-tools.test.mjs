import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('modules/core/romaneio-item-tools.js', 'utf8');
const sb = { window: {} };
sb.window = sb;
vm.createContext(sb);
vm.runInContext(src, sb);
const tools = sb.SiswebRomaneioItens;

test('parseDimensoes aceita 5, 5x12, 5x12x300 e decimais', () => {
  assert.equal(JSON.stringify(tools.parseDimensoes('').values), '[]');
  assert.equal(JSON.stringify(tools.parseDimensoes('5').values), '[5]');
  assert.equal(JSON.stringify(tools.parseDimensoes('5x12').values), '[5,12]');
  assert.equal(JSON.stringify(tools.parseDimensoes(' 5 X 12,5 x 300 ').values), '[5,12.5,300]');
  assert.equal(tools.parseDimensoes('5x').ok, false);
  assert.equal(tools.parseDimensoes('5x12x300x1').ok, false);
});

test('matchDimensoes compara na ordem e rejeita tokens demais', () => {
  const item = { espessura: 5, largura: 12, comprimento: 300 };
  assert.equal(tools.matchDimensoes(item, [5], ['espessura', 'largura', 'comprimento']), true);
  assert.equal(tools.matchDimensoes(item, [12], ['espessura', 'largura', 'comprimento']), false);
  assert.equal(tools.matchDimensoes(item, [5, 12], ['espessura', 'largura', 'comprimento']), true);
  assert.equal(tools.matchDimensoes(item, [5, 12, 300], ['espessura', 'largura', 'comprimento']), true);
  assert.equal(tools.matchDimensoes(item, [5, 12, 300], ['rodo', 'comprimento']), false);
});

test('matchEspecie ignora caixa e acentos', () => {
  assert.equal(tools.matchEspecie({ especie: 'Cupiúba' }, 'cupiuba'), true);
  assert.equal(tools.matchEspecie({ especie: 'Pinus' }, 'cupiuba'), false);
});

test('tabelas carregam o helper e a barra de filtros', () => {
  for (const file of ['romaneiotl.html', 'romaneiopct.html', 'romaneiopes.html', 'romaneiotora.html', 'preromaneio.html']) {
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('romaneio-item-tools.js'), `${file} carrega helper`);
    assert.ok(html.includes('romaneio-items-filters'), `${file} tem filtros`);
    assert.ok(html.includes('romaneio-items-title'), `${file} tem titulo padronizado`);
  }
});

test('selecionar todos fica no cabecalho da primeira coluna', () => {
  const pages = [
    ['romaneiotl.html', ['tlItemSelectAll'], 'Espécie'],
    ['romaneiopct.html', ['pctItemSelectAll'], 'Espécie'],
    ['romaneiopes.html', ['pesItemSelectAll'], 'Espécie'],
    ['romaneiotora.html', ['toraItemSelectAll'], 'Plaqueta'],
    ['preromaneio.html', ['preSerradosItemSelectAll', 'preTorasItemSelectAll'], null]
  ];
  for (const [file, ids, label] of pages) {
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(!html.includes('romaneio-items-selectall'), `${file} nao tem selecionar todos na barra`);
    for (const id of ids) {
      assert.match(html, new RegExp(`<label class="romaneio-check-head" for="${id}"><input[^>]+id="${id}"[^>]*></label>\\s*<span>`, 'i'), `${file} ${id} no cabecalho`);
    }
    if (label) assert.ok(html.includes(`</label> <span>${label}</span>`), `${file} rotulo apos checkbox`);
  }
});

test('totais usam a lista filtrada em todas as tabelas', () => {
  const checks = [
    ['modules/items/renderizar-tabela.js', [/atualizarTotais\(items\)/, /items = tlFilteredItems\(items\)/]],
    ['romaneiopct-tabela.js', [/atualizarTotais\(itensFiltrados\)/, /pctFilteredItems\(Array\.isArray\(itensBase\)/]],
    ['romaneiopes.html', [/atualizarTotais\(lista\)/, /pesFilteredItems\(Array\.isArray\(lista\)/]],
    ['romaneiotora.js', [/const itens = toraFilteredItems\(todosItens\)/]],
    ['preromaneio.js', [/atualizarTotais\(visiveis\)/, /preFilteredItems\(Array\.isArray\(lista\)/]]
  ];
  for (const [file, patterns] of checks) {
    const src = fs.readFileSync(file, 'utf8');
    for (const pattern of patterns) assert.match(src, pattern, `${file} ${pattern}`);
  }
});
