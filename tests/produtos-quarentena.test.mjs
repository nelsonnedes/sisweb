import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const src = readFileSync(new URL('../vendas.js', import.meta.url), 'utf8');

function extract(src, start) {
  const i = src.indexOf(start);
  if (i < 0) throw new Error('não encontrado: ' + start);
  const j = src.indexOf('{', i);
  let d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('chaves desbalanceadas: ' + start);
}

test('fallbacks whole-list filtram espécies (sem saveData cru de window.produtos)', () => {
  const bare = [];
  src.split('\n').forEach((ln, i) => {
    if (/saveData\('produtos', window\.produtos\)/.test(ln)) bare.push(i + 1);
  });
  assert.deepEqual(bare, [], `saveData cru nas linhas: ${bare.join(',')}`);
  assert.ok(/registrarIdsProdutosRaw\(produtos_raw\)/.test(src), 'carga registra ids raw');
  assert.ok(/Informe o nome do produto/.test(src), 'trava de nome vazio presente');
});

test('filtrarProdutosPersistiveis: mantém produtos, descarta espécies/fantasmas', () => {
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(
    extract(src, 'function isNomeFantasma(') + '\n' + extract(src, 'function registrarIdsProdutosRaw(') + '\n' + extract(src, 'function isProdutoJunk(') + '\n' + extract(src, 'function filtrarProdutosPersistiveis('),
    sandbox
  );
  vm.runInContext(`
    window.__produtosRawIds = new Set();
    window.__produtosNovosIds = new Set();
    registrarIdsProdutosRaw([
      { id: 'p1', codigo: '000001', nome: 'Parafuso' },
      { id: 'p2', codigo: '000002', nome: 'Porca' }
    ]);
    this.__out = filtrarProdutosPersistiveis([
      { id: 'p1', codigo: '000001', nome: 'Parafuso' },
      { id: 'p2', codigo: '000002', nome: 'Porca' },
      { id: 'esp1', nome: 'Tora Pinus', nomeCientifico: 'Pinus sp' },
      { id: 'PROD_123', codigo: '000091', nome: 'Produto sem nome' },
      {}
    ]);
    this.__outNew = (function () {
      window.__produtosNovosIds.add('PROD_999');
      return filtrarProdutosPersistiveis([{ id: 'PROD_999', codigo: '000100', nome: 'Novo' }]);
    })();
  `, sandbox);
  assert.equal(sandbox.__out.map((p) => p.id).join(','), 'p1,p2');
  assert.equal(sandbox.__outNew.map((p) => p.id).join(','), 'PROD_999');
});

test('quarentena v2: purga puro-lixo mesmo com id registrado', () => {
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  const src = readFileSync(new URL('../vendas.js', import.meta.url), 'utf8');
  function extract(src, start) {
    const i = src.indexOf(start);
    const j = src.indexOf('{', i);
    let d = 0;
    for (let k = j; k < src.length; k++) {
      if (src[k] === '{') d++;
      if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
    }
    throw new Error('unbalanced ' + start);
  }
  vm.runInContext(
    extract(src, 'function isNomeFantasma(') + '\n' + extract(src, 'function registrarIdsProdutosRaw(') + '\n' + extract(src, 'function isProdutoJunk(') + '\n' + extract(src, 'function filtrarProdutosPersistiveis('),
    sandbox
  );
  vm.runInContext(`
    window.__produtosRawIds = new Set();
    window.__produtosNovosIds = new Set();
    registrarIdsProdutosRaw([
      { id: 'g1', codigo: '000001' },
      { id: 'p1', codigo: '000010', nome: 'Parafuso' },
      { id: 'e1', codigo: '000011' }
    ]);
    // g1: sem nome/preço/estoque -> purge; p1: com nome -> fica;
    // e1: sem nome MAS com estoque -> fica (dado real)
    this.__out = filtrarProdutosPersistiveis([
      { id: 'g1', codigo: '000001' },
      { id: 'p1', codigo: '000010', nome: 'Parafuso' },
      { id: 'e1', codigo: '000011', estoque: 5 }
    ]);
  `, sandbox);
  assert.equal(sandbox.__out.map((p) => p.id).join(','), 'p1,e1');
});

test('quarentena v2: literal "Produto sem nome" vale como ausência de nome', () => {
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  const src = readFileSync(new URL('../vendas.js', import.meta.url), 'utf8');
  function extract(src, start) {
    const i = src.indexOf(start);
    const j = src.indexOf('{', i);
    let d = 0;
    for (let k = j; k < src.length; k++) {
      if (src[k] === '{') d++;
      if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
    }
    throw new Error('unbalanced ' + start);
  }
  vm.runInContext(
    extract(src, 'function isNomeFantasma(') + '\n' + extract(src, 'function registrarIdsProdutosRaw(') + '\n' + extract(src, 'function isProdutoJunk(') + '\n' + extract(src, 'function filtrarProdutosPersistiveis('),
    sandbox
  );
  vm.runInContext(`
    window.__produtosRawIds = new Set();
    window.__produtosNovosIds = new Set();
    registrarIdsProdutosRaw([{ id: 'g9', codigo: '000009' }]);
    this.__out = filtrarProdutosPersistiveis([{ id: 'g9', codigo: '000009', nome: 'Produto sem nome' }]);
  `, sandbox);
  assert.equal(sandbox.__out.length, 0);
});

test('literais Nome não informado / Produto sem nome valem como vazio', () => {
  const sandbox = { window: {} };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  const src = readFileSync(new URL('../vendas.js', import.meta.url), 'utf8');
  function extract(src, start) {
    const i = src.indexOf(start);
    const j = src.indexOf('{', i);
    let d = 0;
    for (let k = j; k < src.length; k++) {
      if (src[k] === '{') d++;
      if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
    }
    throw new Error('unbalanced ' + start);
  }
  vm.runInContext(
    extract(src, 'function isNomeFantasma(') + '\n' + extract(src, 'function nomeSignificativo(') + '\n' + extract(src, 'function nomeExibicaoProduto('),
    sandbox
  );
  vm.runInContext(`
    this.__a = nomeExibicaoProduto({ nome: 'Nome não informado', nomeCientifico: 'Pinus sp' });
    this.__b = nomeExibicaoProduto({ nome: 'Produto sem nome' });
    this.__c = nomeExibicaoProduto({ nomeComum: 'Tora' });
  `, sandbox);
  assert.equal(sandbox.__a, 'Pinus sp');
  assert.equal(sandbox.__b, 'Produto sem nome');
  assert.equal(sandbox.__c, 'Tora');
});
