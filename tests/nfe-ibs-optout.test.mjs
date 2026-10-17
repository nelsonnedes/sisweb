import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// Provas matemáticas e fiscais: cStat 1080 (arredondamento), cStat 1026
// (alíquota válida para CST 000) e cStat 1115 (presença obrigatória).
const nfConfig = readFileSync('nf-config.js', 'utf8');
const nfService = readFileSync('nf-service.js', 'utf8');
const nfItens = readFileSync('nf-itens.js', 'utf8');
const nfBuilder = readFileSync('nf-xml-builder.js', 'utf8');

function extract(src, name, argsPattern) {
  const m = src.match(new RegExp(`function ${name}\\(${argsPattern}\\) \\{[\\s\\S]*?\\n(  )?\\}`));
  assert.ok(m, `${name} não encontrada`);
  return m[0];
}

test('cStat 1026: CST 000 exige alíquotas explícitas quando habilitado; sem alíquota rejeita', () => {
  const ctx = {};
  vm.runInNewContext(
    extract(nfConfig, 'round2', 'v') + '\n'
    + extract(nfConfig, 'calcularIBSCBS', 'config, valorProduto')
    + '\nthis.calcularIBSCBS = calcularIBSCBS;',
    ctx,
  );
  const calc = ctx.calcularIBSCBS;
  // Com habilitado: true + cst + cClassTrib + alíquotas explícitas → emite
  const explicit = calc({
    impostos: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pCBS: 0.9 } },
  }, 1000);
  assert.equal(explicit.pIBSUF, 0.1);
  assert.equal(explicit.pCBS, 0.9);
  assert.equal(explicit.cst, '000');
  assert.equal(explicit.cClassTrib, '000001');
  // Sem cst+cClassTrib → null (não emite IBS/CBS)
  assert.equal(calc({ impostos: { ibscbs: { habilitado: true } } }, 1000), null);
  // Sem alíquotas (e sem cst/cClassTrib) → null
  assert.equal(calc({ impostos: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001' } } }, 1000), null);
});

test('cStat 1080: total do XML soma os centavos arredondados de cada item', () => {
  const src = readFileSync('nf-xml-builder.js', 'utf8');
  const m = src.match(/function roundCents\(v\) \{[\s\S]*?\n  \}/);
  assert.ok(m, 'roundCents existe');
  const mCalc = src.match(/function calcularTotais\(itens, desconto, frete\) \{[\s\S]*?\n  \}/);
  assert.ok(mCalc, 'calcularTotais encontrada');
  const mMono = src.match(/function monoLadoTotais\(lado, m\) \{[\s\S]*?\n  \}/);
  const mDev = src.match(/function devTribVal\(d\) \{[\s\S]*?\n  \}/);
  assert.ok(mMono && mDev, 'helpers mono/devTrib encontrados');

  const context = {};
  vm.runInNewContext(
    `${m[0]};`
    + `function parseFiscalNumber(v){ if (typeof v === 'number') return Number.isFinite(v) ? v : 0;`
    + ` const raw = String(v || '').trim(); if (!raw) return 0;`
    + ` return parseFloat(raw.replace(/[^\\d.-]/g, '')) || 0; }`
    + `${mMono[0]}; ${mDev[0]};`
    + `${mCalc[0]}; this.calcularTotais = calcularTotais; this.roundCents = roundCents;`,
    context,
  );
  const { calcularTotais, roundCents } = context;

  // Cenário real da nota 1720: 5 itens fracionários totalizando R$ 7.781,72
  const det1720 = [
    { vProd: 201.59, imposto: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pIBSMun: 0, pCBS: 0.9 } } },
    { vProd: 3414.93, imposto: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pIBSMun: 0, pCBS: 0.9 } } },
    { vProd: 3204.00, imposto: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pIBSMun: 0, pCBS: 0.9 } } },
    { vProd: 13.35, imposto: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pIBSMun: 0, pCBS: 0.9 } } },
    { vProd: 947.85, imposto: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pIBSMun: 0, pCBS: 0.9 } } },
  ];
  const tot = calcularTotais(det1720, 0, 0);

  assert.equal(tot.vIBSUF, 7.77, 'total vIBSUF bate 7.77 exato, eliminando o cStat 1080');
});

test('nf-service.js não aplica fallback automático de IBS/CBS (sem emissão por padrão)', () => {
  assert.ok(!nfService.includes('imposto.ibscbs = ibscbsCalc || {'), 'sem fallback hardcoded de ibscbs');
  assert.ok(!nfService.includes('pIBSUF = 0.1'), 'sem normalização automática de pIBSUF');
  assert.ok(!nfService.includes('pCBS = 0.9'), 'sem normalização automática de pCBS');
});
