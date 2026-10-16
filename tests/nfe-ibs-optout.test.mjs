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

test('cStat 1026: CST 000 usa alíquotas oficiais de teste (0.1% e 0.9%), nunca zero', () => {
  const ctx = {};
  vm.runInNewContext(
    extract(nfConfig, 'round2', 'v') + '\n'
    + extract(nfConfig, 'calcularIBSCBS', 'config, valorProduto')
    + '\nthis.calcularIBSCBS = calcularIBSCBS;',
    ctx,
  );
  const calc = ctx.calcularIBSCBS;
  // Config habilitada sem alíquotas: usa os valores oficiais de teste
  const def = calc({ impostos: { ibscbs: { habilitado: true } } }, 1000);
  assert.equal(def.pIBSUF, 0.1, 'pIBSUF default = 0.1%');
  assert.equal(def.pCBS, 0.9, 'pCBS default = 0.9%');
  assert.equal(def.cst, '000');
  assert.equal(def.cClassTrib, '000001');

  // Config com zero explícito e CST 000: normaliza para 0.1% e 0.9% (evita cStat 1026)
  const zeros = calc({ impostos: { ibscbs: { habilitado: true, cst: '000', pIBSUF: 0, pCBS: 0 } } }, 1000);
  assert.equal(zeros.pIBSUF, 0.1, 'pIBSUF com zero vira 0.1%');
  assert.equal(zeros.pCBS, 0.9, 'pCBS com zero vira 0.9%');

  // Config com valores maiores que zero: respeita o valor configurado
  const custom = calc({ impostos: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 1.5, pCBS: 3.0 } } }, 1000);
  assert.equal(custom.pIBSUF, 1.5);
  assert.equal(custom.pCBS, 3.0);
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
  // Item 1: 201.59 * 0.1% = 0.20159 -> 0.20
  // Item 2: 3414.93 * 0.1% = 3.41493 -> 3.41
  // Item 3: 3204.00 * 0.1% = 3.20400 -> 3.20
  // Item 4: 13.35 * 0.1% = 0.01335 -> 0.01
  // Item 5: 947.85 * 0.1% = 0.94785 -> 0.95
  // Soma dos itens formatados: 0.20 + 3.41 + 3.20 + 0.01 + 0.95 = 7.77
  const det1720 = [
    { vProd: 201.59, imposto: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pIBSMun: 0, pCBS: 0.9 } } },
    { vProd: 3414.93, imposto: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pIBSMun: 0, pCBS: 0.9 } } },
    { vProd: 3204.00, imposto: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pIBSMun: 0, pCBS: 0.9 } } },
    { vProd: 13.35, imposto: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pIBSMun: 0, pCBS: 0.9 } } },
    { vProd: 947.85, imposto: { ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0.1, pIBSMun: 0, pCBS: 0.9 } } },
  ];
  const tot = calcularTotais(det1720, 0, 0);

  // Sem roundCents dava 7.78; com roundCents dá 7.77 (exatamente igual à soma dos itens)
  assert.equal(tot.vIBSUF, 7.77, 'total vIBSUF bate 7.77 exato, eliminando o cStat 1080');
});

test('emitirNFe normaliza itens antigos com alíquota zero para as alíquotas oficiais de teste', () => {
  assert.match(
    nfService,
    /if \(!Number\.isFinite\(ibs\.pIBSUF\) \|\| Number\(ibs\.pIBSUF\) <= 0\) ibs\.pIBSUF = 0\.1;/,
    'normalização de pIBSUF para 0.1%',
  );
  assert.match(
    nfService,
    /if \(!Number\.isFinite\(ibs\.pCBS\) \|\| Number\(ibs\.pCBS\) <= 0\) ibs\.pCBS = 0\.9;/,
    'normalização de pCBS para 0.9%',
  );
});
