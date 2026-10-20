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
  }
});
