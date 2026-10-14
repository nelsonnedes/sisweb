import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Onda 2 (auditoria A3/A4/A5/A10/A12/A15): motor fiscal.
const tablesSrc = fs.readFileSync('nf-tax-tables.js', 'utf8');
const builderSrc = fs.readFileSync('nf-xml-builder.js', 'utf8');
const B = new Function('window', 'console', builderSrc + '; return window.NFXmlBuilder;')({ window: {} }, console);
const validatorSrc = fs.readFileSync('nf-validator.js', 'utf8');
const V = new Function('window', 'console', tablesSrc + '\n' + validatorSrc + '; return window.NFValidator;')({ window: {} }, console);
const cfgSrc = fs.readFileSync('nf-config.js', 'utf8');
const cfgWin = {};
new Function('window', 'console', 'localStorage', 'structuredClone', cfgSrc)(cfgWin, console, { getItem: () => null, setItem: () => {} }, structuredClone);
const C = cfgWin.NFConfigService;
const html = fs.readFileSync('notas-fiscais.html', 'utf8');

function itemBase(icms = { csosn: '102' }) {
  return {
    cProd: '1', xProd: 'PROD', ncm: '94036000', cfop: '5102', uCom: 'UN',
    qCom: 1, vUnCom: 100, vProd: 100,
    imposto: {
      icms, pis: { cST: '07' }, cofins: { cST: '07' },
      ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0, pIBSMun: 0, pCBS: 0 },
    },
  };
}
function nfeBase(det, crt = 1, ideExtra = {}) {
  const nfe = {
    emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE', ie: '123456789', crt,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '100', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '200', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55, ...ideExtra },
    det, transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 100 }],
  };
  nfe.total = B.calcularTotais(det, 0, 0);
  return nfe;
}

test('A3: excesso sublimite (CRT 2) usa ramo SN sem destaque', () => {
  const r = C.calcularICMS({ empresa: { regime: 'simplesExcesso' }, impostos: { icms: {} } }, 'SP', 'SP', 100);
  assert.equal(r.csosn, '102');
  assert.equal(r.vBC, 0);
  assert.equal(r.vICMS, 0);
  assert.equal(r.destaca, false);
});

test('A4: NFref após verProc; finNFe 2/3/4 exige chave 44 díg.', () => {
  const n = nfeBase([itemBase()], 1, { finNFe: '4', NFref: ['35260111222333000181550010000000011000000001'] });
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<verProc>Sisweb 1\.0<\/verProc><NFref><refNFe>35260111222333000181550010000000011000000001<\/refNFe><\/NFref>/);
  const bad = V.validarNFe(nfeBase([itemBase()], 1, { finNFe: '4' }));
  assert.match(bad.errors.join('|'), /Finalidade 4 exige chave/);
  assert.ok(html.includes('id="nfNFref"'), 'campo da chave referenciada existe');
});

test('A5: impostoDevol com finNFe=4 (default pDevol=100 + IPI/vIPIDevol — leiaute 4.00)', () => {
  const it = itemBase({ cst: '00' });
  it.imposto.ipi = { cST: '00', vBC: 100, pIPI: 5, vIPI: 5 };
  const n = nfeBase([it], 3, { finNFe: '4', NFref: ['35260111222333000181550010000000011000000001'] });
  const xml = B.buildNFeXML(n).xml;
  // TDec_0302Max100 (2 casas) + vIPIDevol DENTRO de <IPI> (cStat 225 corrigido)
  assert.match(xml, /<impostoDevol><pDevol>100\.00<\/pDevol><IPI><vIPIDevol>5\.00<\/vIPIDevol><\/IPI><\/impostoDevol><vItem>/);
  const r = V.validarNFe(n);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

test('A10: CEST e orig no item', () => {
  const it = itemBase();
  it.cest = '1234567';
  it.imposto.icms.orig = '1';
  const n = nfeBase([it], 1);
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<CEST>1234567<\/CEST>/);
  assert.match(xml, /<ICMSSN102><orig>1<\/orig>/);
  assert.ok(html.includes('id="itemCEST"'), 'CEST no modo manual');
  assert.ok(html.includes('id="itemCESTCad"'), 'CEST no modo cadastrado');
  assert.ok(html.includes('id="itemOrig"'), 'origem no modo manual');
});

test('A12: pRedBC no cálculo + CST 20 exige redução', () => {
  const r = C.calcularICMS({ empresa: { regime: 'lucroReal' }, impostos: { icms: { cst: '20', reducaoBC: 10 } } }, 'SP', 'SP', 100);
  assert.equal(r.pRedBC, 10);
  assert.equal(r.vBC, 90);
  const bad = V.validarItem(itemBase({ cst: '20' }), 0);
  assert.match(bad.errors.join('|'), /CST 20 exige redução/);
  assert.ok(html.includes('id="cfgReducaoBC"'), 'config de redução BC existe');
});

test('A15: infRespTec quando configurado; ausente = omitido', () => {
  const n = nfeBase([itemBase()], 1);
  n.respTec = { cnpj: '11222333000181', xContato: 'Suporte', email: 'a@b.com', fone: '11999999999' };
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<infRespTec><CNPJ>11222333000181<\/CNPJ><xContato>Suporte<\/xContato><email>a@b\.com<\/email><fone>11999999999<\/fone><\/infRespTec><\/infNFe>/);
  const n2 = nfeBase([itemBase()], 1);
  assert.doesNotMatch(B.buildNFeXML(n2).xml, /infRespTec/);
  assert.ok(html.includes('id="panelRespTec"'), 'painel responsável técnico existe');
});
