import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const nfConfig = readFileSync('nf-config.js', 'utf8');
const nfService = readFileSync('nf-service.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

function loadCalcularIBSCBS() {
  const round = nfConfig.match(/function round2\(v\) \{[\s\S]*?\n  \}/);
  const calc = nfConfig.match(/function calcularIBSCBS\(config, valorProduto\) \{[\s\S]*?\n  \}/);
  assert.ok(round && calc, 'calcularIBSCBS/round2 não encontradas');
  const context = {};
  vm.runInNewContext(`${round[0]}; ${calc[0]}; this.calcularIBSCBS = calcularIBSCBS;`, context);
  return context.calcularIBSCBS;
}

test('neutro por default marca defaultNeutro; explícito não marca', () => {
  const calc = loadCalcularIBSCBS();
  const padrao = calc({ impostos: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001' } } }, 100);
  assert.equal(padrao.defaultNeutro, true);
  const confirmado = calc({ impostos: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', neutroConfirmado: true } } }, 100);
  assert.equal(confirmado.defaultNeutro, undefined);
  const comAliquota = calc({ impostos: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pCBS: 0.9 } } }, 100);
  assert.equal(comAliquota.defaultNeutro, undefined);
  const outraClass = calc({ impostos: { ibscbs: { habilitado: true, cst: '010', cClassTrib: '010001' } } }, 100);
  assert.equal(outraClass.defaultNeutro, undefined);
  const desligado = calc({ impostos: { ibscbs: { habilitado: false } } }, 100);
  assert.equal(desligado, null);
});

test('emissão bloqueia antes de consumir número sem ciência do neutro', () => {
  assert.match(nfService, /usaNeutroDefault[\s\S]{0,400}defaultNeutro === true/);
  assert.match(nfService, /err\.code = 'IBS_NEUTRO_CONFIRMACAO'/);
  const gatePos = nfService.indexOf("err.code = 'IBS_NEUTRO_CONFIRMACAO'");
  const numeroPos = nfService.indexOf('incrementarNumero(_tenantId, 55');
  assert.ok(gatePos >= 0 && numeroPos >= 0 && gatePos < numeroPos, 'gate antes da reserva de número');
  assert.match(nfService, /imposto\.ibscbs = ibscbsCalc \|\| \{/, 'fallback com alíquotas oficiais de teste');
});

test('UI: opt-in com confirmDialog + registro na config + retry único', () => {
  assert.match(html, /e\.code === 'IBS_NEUTRO_CONFIRMACAO'/);
  assert.match(html, /Emitir com IBS\/CBS neutro/);
  assert.match(html, /neutroConfirmado: true, neutroCienciaEm/);
  assert.match(html, /await window\.NFService\.salvarConfig\(cfg\)/);
  assert.match(html, /confirmarEmissao\.__ibsNeutroRetry/);
});
