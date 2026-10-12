import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// IBS/CBS monofásico (CST 620, TMonofasia) + gTribRegular/gTribCompraGov
// (TTribRegular/TTribCompraGov) + ide gCompraGov (TCompraGov) — PL_010f v1.04.
// Testes de unidade do builder/validador (sem Java); a validade XSD oficial
// é coberta em tests/nfe-xsd-validation.test.mjs.
const builderSrc = fs.readFileSync('nf-xml-builder.js', 'utf8');
const B = new Function('window', 'console', builderSrc + '; return window.NFXmlBuilder;')({ window: {} }, console);
const validatorSrc = fs.readFileSync('nf-validator.js', 'utf8');
const V = new Function('window', 'console', validatorSrc + '; return window.NFValidator;')({ window: {} }, console);

function itemBase(ibscbs) {
  return {
    cProd: '1', xProd: 'GASOLINA', ncm: '27101259', cfop: '5656', uCom: 'L',
    qCom: 1000, vUnCom: 5, vProd: 5000,
    imposto: {
      icms: { cst: '00', vBC: 5000, pICMS: 18, vICMS: 900 },
      pis: { cST: '01' }, cofins: { cST: '01' },
      ibscbs,
    },
  };
}

const MONO_ADREM = {
  habilitado: true, cst: '620', cClassTrib: '620001',
  mono: {
    ibs: { regime: 'adRem', padrao: { qBCMono: 1000, aliq: 0.05 } },
    cbs: { regime: 'adRem', padrao: { qBCMono: 1000, aliq: 0.03 }, reten: { qBCMonoReten: 200, aliqReten: 0.03 } },
  },
};

test('gIBSCBSMono adRem: blocos, auto-cálculo e totais do item', () => {
  const tot = B.calcularTotais([itemBase(MONO_ADREM)], 0, 0);
  // IBS: 1000×0.05=50.00 | CBS padrao: 1000×0.03=30.00, reten: 200×0.03=6.00
  assert.equal(tot.vMonoIBS, 50);
  assert.equal(tot.vMonoCBS, 30);
  assert.equal(tot.vMonoRetenCBS, 6);
  assert.equal(tot.vBCIBSCBS, 0);
});

test('gIBSCBSMono adValorem IBS (UF+Mun) e CBS', () => {
  const g = {
    habilitado: true, cst: '620', cClassTrib: '620001',
    mono: {
      ibs: { regime: 'adValorem', padrao: { vBCMono: 1000, aliqUF: 10, aliqMun: 2 } },
      cbs: { regime: 'adValorem', padrao: { vBCMono: 1000, aliq: 9 } },
    },
  };
  const tot = B.calcularTotais([itemBase(g)], 0, 0);
  assert.equal(tot.vMonoIBS, 120); // 100 + 20
  assert.equal(tot.vMonoCBS, 90);
});

test('buildTotal emite IBSCBSTot+gMono mesmo sem vBCIBSCBS', () => {
  const nfe = {
    emit: { cnpj: '11222333000181', razaoSocial: 'E', ie: '1', crt: 3,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'R', numero: '1', bairro: 'B', municipio: 'S', cep: '01001000' } },
    dest: { nome: 'C', cnpj: '11222333000181', indIEDest: 9,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'R', numero: '2', bairro: 'B', municipio: 'S', cep: '01001000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308' },
    det: [itemBase(MONO_ADREM)], transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 5000 }],
  };
  nfe.total = B.calcularTotais(nfe.det, 0, 0);
  const { xml } = B.buildNFeXML(nfe);
  assert.match(xml, /<gIBSCBSMono>/, 'bloco monofásico no item');
  assert.match(xml, /<qBCMono>1000\.0000<\/qBCMono>/, 'quantidade 4 decimais');
  assert.match(xml, /<vIBSMono>50\.00<\/vIBSMono>/, 'auto-cálculo adRem');
  assert.match(xml, /<vTotIBSMonoItem>50\.00<\/vTotIBSMonoItem>/, 'total do item obrigatório');
  assert.match(xml, /<IBSCBSTot>.*<gMono><vIBSMono>50\.00<\/vIBSMono>/, 'gMono nos totais');
});

test('mono com CST diferente de 620 é recusado no builder', () => {
  const g = { ...MONO_ADREM, cst: '000' };
  const nfe = {
    emit: { cnpj: '11222333000181', razaoSocial: 'E', ie: '1', crt: 3,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'R', numero: '1', bairro: 'B', municipio: 'S', cep: '01001000' } },
    dest: { nome: 'C', cnpj: '11222333000181', indIEDest: 9,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'R', numero: '2', bairro: 'B', municipio: 'S', cep: '01001000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308' },
    det: [itemBase(g)], transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 5000 }],
  };
  nfe.total = B.calcularTotais(nfe.det, 0, 0);
  assert.throws(() => B.buildNFeXML(nfe), /exige CST 620/);
});

test('validador: CST 620 sem mono e mono sem CST 620', () => {
  const okMono = V.validarItem(itemBase(MONO_ADREM), 0);
  assert.equal(okMono.valid, true, JSON.stringify(okMono.errors));
  const semMono = V.validarItem(itemBase({ habilitado: true, cst: '620', cClassTrib: '620001', pIBSUF: 0, pIBSMun: 0, pCBS: 0 }), 0);
  assert.equal(semMono.valid, false);
  assert.match(semMono.errors.join('|'), /CST 620 exige grupo monofásico/);
  const cstErrado = V.validarItem(itemBase({ ...MONO_ADREM, cst: '000' }), 0);
  assert.equal(cstErrado.valid, false);
  assert.match(cstErrado.errors.join('|'), /exige CST 620/);
});

test('validador: regime inválido e lado sem blocos', () => {
  const g = { habilitado: true, cst: '620', cClassTrib: '620001', mono: { ibs: { regime: 'x' } } };
  const r = V.validarItem(itemBase(g), 0);
  assert.equal(r.valid, false);
  assert.match(r.errors.join('|'), /regime deve ser adRem ou adValorem/);
  assert.match(r.errors.join('|'), /sem blocos/);
});

test('gTribRegular/gTribCompraGov: builder emite após gCBS; validador exige campos', () => {
  const g = {
    habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 10, pIBSMun: 0, pCBS: 9,
    tribRegular: { cstReg: '000', cClassTribReg: '000001', pAliqEfetRegIBSUF: 10, vTribRegIBSUF: 10, pAliqEfetRegIBSMun: 0, vTribRegIBSMun: 0, pAliqEfetRegCBS: 9, vTribRegCBS: 9 },
    tribCompraGov: { pAliqIBSUF: 10, vTribIBSUF: 10, pAliqIBSMun: 0, vTribIBSMun: 0, pAliqCBS: 9, vTribCBS: 9 },
  };
  const r = V.validarItem(itemBase(g), 0);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  const incompleto = V.validarItem(itemBase({ ...g, tribRegular: { cstReg: '000' } }), 0);
  assert.equal(incompleto.valid, false);
  assert.match(incompleto.errors.join('|'), /gTribRegular\.cClassTribReg obrigatório/);
  const comBaseAlt = V.validarItem(itemBase({ ...g, transfCred: { vIBS: 1, vCBS: 1 } }), 0);
  assert.equal(comBaseAlt.valid, false);
  assert.match(comBaseAlt.errors.join('|'), /só com base gIBSCBS/);
});

test('ide gCompraGov: validador aplica regras tpOperGov×refDFeAnt do schema', () => {
  const ideBase = { nNF: 1, serie: '1', dhEmi: new Date().toISOString(), mod: 55, tpNF: 1, tpAmb: 2, cMunFG: '3550308' };
  const chave = '35260111222333000181550010000000011000000001';
  const ok1 = V.validarIde({ ...ideBase, compraGov: { tpEnteGov: '4', pRedutor: 10, tpOperGov: '1' } });
  assert.equal(ok1.valid, true, JSON.stringify(ok1.errors));
  const op2semRef = V.validarIde({ ...ideBase, compraGov: { tpEnteGov: '4', pRedutor: 10, tpOperGov: '2' } });
  assert.match(op2semRef.errors.join('|'), /tpOperGov 2 exige exatamente 1 refDFeAnt/);
  const op1comRef = V.validarIde({ ...ideBase, compraGov: { tpEnteGov: '4', pRedutor: 10, tpOperGov: '1', refDFeAnt: [chave] } });
  assert.match(op1comRef.errors.join('|'), /tpOperGov 1 e 4 vedam refDFeAnt/);
  const op2ok = V.validarIde({ ...ideBase, compraGov: { tpEnteGov: '2', pRedutor: 0, tpOperGov: '2', refDFeAnt: [chave] } });
  assert.equal(op2ok.valid, true, JSON.stringify(op2ok.errors));
  const refInvalida = V.validarIde({ ...ideBase, compraGov: { tpEnteGov: '2', pRedutor: 0, tpOperGov: '3', refDFeAnt: ['123'] } });
  assert.match(refInvalida.errors.join('|'), /44 dígitos/);
});
