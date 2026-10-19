import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// CRT 3 (Regime Normal) × Naturezas padrão (CSOSN do Simples): o código da
// natureza só prevalece se for válido no regime; caso contrário o CST do item
// é preservado (rejeição SEFAZ cStat 931).
const tablesSrc = fs.readFileSync('nf-tax-tables.js', 'utf8');
const cfgSrc = fs.readFileSync('nf-config.js', 'utf8');
const itensSrc = fs.readFileSync('nf-itens.js', 'utf8');
const html = fs.readFileSync('notas-fiscais.html', 'utf8');

function loadItens(natureCod = '102') {
  const win = {};
  new Function('window', 'console', 'localStorage', 'structuredClone', cfgSrc)(
    win, console, { getItem: () => null, setItem: () => {} }, structuredClone,
  );
  new Function('window', 'console', tablesSrc)(win, console);
  win.NFNaturezas = { getById: () => ({ id: 'nat_compra', csosn: natureCod, cfopPadrao: '1102' }) };
  new Function('window', 'console', itensSrc)(win, console);
  return win;
}

function cfgFor(win, regime) {
  const cfg = JSON.parse(JSON.stringify(win.NFConfigService.DEFAULT_CONFIG));
  cfg.empresa = { ...(cfg.empresa || {}), regime, endereco: { uf: 'SP' } };
  cfg.impostos.icms = { ...(cfg.impostos.icms || {}), cst: '00', csosn: '102' };
  return cfg;
}

const criar = (win, cfg, csosn) => win.NFItens.criarItemFiscal({
  xProd: 'Compra de Mercadoria', ncm: '44071100', cfop: '1102', uCom: 'UN',
  qCom: 1, vUnCom: 10, csosn, natOpId: 'nat_compra', cfg, ufDest: 'SP',
});

test('CRT 3: natureza com CSOSN 102 não sobrescreve o CST válido do item', () => {
  const win = loadItens('102');
  const item = criar(win, cfgFor(win, 'lucroReal'), '00');
  assert.equal(item.csosn, '00');
  assert.notEqual(item.csosn, '102');
  assert.equal(item.imposto.icms.cst, '00');
});

test('CRT 1: natureza com CSOSN 102 continua prevalecendo', () => {
  const win = loadItens('102');
  const item = criar(win, cfgFor(win, 'simplesNacional'), '102');
  assert.equal(item.csosn, '102');
  assert.equal(item.imposto.icms.csosn, '102');
});

test('CRT 3: recalcular item não reintroduz CSOSN 102 da natureza', () => {
  const win = loadItens('102');
  const cfg = cfgFor(win, 'lucroReal');
  const item = criar(win, cfg, '00');
  win.NFItens.recalcularImpostosItem(item, { cfg, natOpId: 'nat_compra', ufDest: 'SP' });
  assert.equal(item.csosn, '00');
  assert.notEqual(item.imposto.icms.cst, '102');
});

test('CRT 3: natureza com CST válido (10) ainda prevalece sobre o item', () => {
  const win = loadItens('10');
  const item = criar(win, cfgFor(win, 'lucroReal'), '00');
  assert.equal(item.csosn, '10');
  assert.equal(item.imposto.icms.cst, '10');
});

test('romaneio: código ICMS vem do regime (sem 102 hardcoded em CRT 3)', () => {
  const ini = html.indexOf('function adicionarItemNFRomaneio');
  const fim = html.indexOf('function selecionarConamaNFeClick', ini);
  const bloco = html.slice(ini, fim);
  assert.match(bloco, /const csosnRom = String\(crtRom\) === '3'/);
  assert.doesNotMatch(bloco, /csosn: '102'/);
});
