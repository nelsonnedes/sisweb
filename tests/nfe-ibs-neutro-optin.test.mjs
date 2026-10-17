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

test('calcularIBSCBS: habilitado:false retorna null; habilitado:true sem cst+cClassTrib retorna null', () => {
  const calc = loadCalcularIBSCBS();
  assert.equal(calc({ impostos: { ibscbs: { habilitado: false } } }, 100), null);
  assert.equal(calc({ impostos: { ibscbs: { habilitado: true } } }, 100), null);
  // habilitado:true + cst+cClassTrib + alíquotas → emite
  const emit = calc({ impostos: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pCBS: 0.9 } } }, 100);
  assert.equal(emit.habilitado, true);
  assert.equal(emit.pIBSUF, 0.1);
  assert.equal(emit.pCBS, 0.9);
});

test('nf-service.js não tem fallback automático de IBS/CBS (sem emissão por padrão)', () => {
  assert.doesNotMatch(nfService, /imposto\.ibscbs = ibscbsCalc \|\| \{/, 'sem fallback hardcoded de ibscbs');
});

test('UI: opt-in com confirmDialog + registro na config + retry único', () => {
  assert.match(html, /e\.code === 'IBS_NEUTRO_CONFIRMACAO'/);
  assert.match(html, /Emitir com IBS\/CBS neutro/);
  assert.match(html, /neutroConfirmado: true, neutroCienciaEm/);
  assert.match(html, /await window\.NFService\.salvarConfig\(cfg\)/);
  assert.match(html, /confirmarEmissao\.__ibsNeutroRetry/);
});
