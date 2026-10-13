import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Onda 4 (auditoria A21/A22/A23): arquitetura e centralização.
const tablesSrc = fs.readFileSync('nf-tax-tables.js', 'utf8');
const T = new Function('window', 'module', tablesSrc + '; return window.NFTaxTables;')({ window: {} }, undefined);
const cfgSrc = fs.readFileSync('nf-config.js', 'utf8');
const cfgWin = {};
new Function('window', 'console', 'localStorage', 'structuredClone', cfgSrc)(cfgWin, console, { getItem: () => null, setItem: () => {} }, structuredClone);
const itensSrc = fs.readFileSync('nf-itens.js', 'utf8');
const I = new Function('window', 'module', tablesSrc + '\n' + cfgSrc + '\n' + itensSrc + '; return window.NFItens;')({ window: cfgWin }, undefined);
const html = fs.readFileSync('notas-fiscais.html', 'utf8');

test('A21: validarCFOP centralizado em NFTaxTables (1/2/3/5/6/7xxx)', () => {
  assert.equal(T.validarCFOP('5102'), true);
  assert.equal(T.validarCFOP('6102'), true);
  assert.equal(T.validarCFOP('1102'), true);
  assert.equal(T.validarCFOP('2102'), true);
  assert.equal(T.validarCFOP('3102'), true);
  assert.equal(T.validarCFOP('7102'), true);
  assert.equal(T.validarCFOP('4102'), false);
  assert.equal(T.validarCFOP('8102'), false);
  assert.equal(T.validarCFOP('123'), false);
  assert.equal(T.validarCFOP(''), false);
});

test('A22: UF_LIST oficial no NFTaxTables (27 estados)', () => {
  assert.equal(Array.isArray(T.UF_LIST), true);
  assert.equal(T.UF_LIST.length, 27);
  assert.ok(T.UF_LIST.includes('SP') && T.UF_LIST.includes('PA') && T.UF_LIST.includes('RJ'));
});

test('A23: NFItens.validarEntradaItem valida entradas comuns de forma central', () => {
  const v1 = I.validarEntradaItem({ nome: 'Madeira', qtd: 2, vUnit: 50, ncm: '44071100', cfop: '5102' });
  assert.equal(v1.valid, true);

  const vSemNome = I.validarEntradaItem({ nome: '', qtd: 1, vUnit: 10, ncm: '44071100', cfop: '5102' });
  assert.equal(vSemNome.valid, false);
  assert.match(vSemNome.erro, /nome/i);

  const vQtdZero = I.validarEntradaItem({ nome: 'M', qtd: 0, vUnit: 10, ncm: '44071100', cfop: '5102' });
  assert.equal(vQtdZero.valid, false);
  assert.match(vQtdZero.erro, /quantidade/i);

  const vNcmInv = I.validarEntradaItem({ nome: 'M', qtd: 1, vUnit: 10, ncm: '123', cfop: '5102' });
  assert.equal(vNcmInv.valid, false);
  assert.match(vNcmInv.erro, /8 dígitos/i);

  const vCfopInv = I.validarEntradaItem({ nome: 'M', qtd: 1, vUnit: 10, ncm: '44071100', cfop: '8102' });
  assert.equal(vCfopInv.valid, false);
  assert.match(vCfopInv.erro, /CFOP/i);
});

test('A23: NFItens.criarItemFiscal monta item completo com impostos e RTC', () => {
  const item = I.criarItemFiscal({
    xProd: 'Tora de Ipê',
    ncm: '44039900',
    cfop: '5102',
    uCom: 'M3',
    qCom: 2.5,
    vUnCom: 400,
    csosn: '102',
    cfg: cfgWin.NFConfigService.DEFAULT_CONFIG,
    ufDest: 'PA',
  });
  assert.equal(item.xProd, 'Tora de Ipê');
  assert.equal(item.vProd, 1000);
  assert.equal(item.imposto.pis.cST, '07');
  assert.equal(item.imposto.ibscbs.habilitado, true);
  assert.equal(item.imposto.ibscbs.cst, '000');
});

test('A23: HTML inclui nf-itens.js e removeu função duplicada legada', () => {
  assert.ok(html.includes('<script src="nf-itens.js"></script>'), 'script importado no HTML');
  assert.ok(html.includes('via NFItens'), 'modos usam NFItens');
  assert.doesNotMatch(html, /document\.getElementById\('itemProduto'\)\?\.value/, 'código legado com itemProduto removido');
});
