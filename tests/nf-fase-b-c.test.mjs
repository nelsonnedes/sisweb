import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Garantia natureza→item + Fase B (regras Destino×Produto) + Fase C
// (gALCZFMCBS, vItem/vNFTot, dhSaiEnt, indDoacao).
const tablesSrc = fs.readFileSync('nf-tax-tables.js', 'utf8');
const natSrc = fs.readFileSync('nf-naturezas.js', 'utf8');
const N = new Function('window', 'module', 'document', tablesSrc + '\n' + natSrc + '; return window.NFNaturezas;')({ window: {} }, undefined, undefined);
const builderSrc = fs.readFileSync('nf-xml-builder.js', 'utf8');
const B = new Function('window', 'console', builderSrc + '; return window.NFXmlBuilder;')({ window: {} }, console);
const validatorSrc = fs.readFileSync('nf-validator.js', 'utf8');
const V = new Function('window', 'console', tablesSrc + '\n' + validatorSrc + '; return window.NFValidator;')({ window: {} }, console);
const html = fs.readFileSync('notas-fiscais.html', 'utf8');
const natHtml = fs.readFileSync('nf-naturezas.js', 'utf8');
const prodSrc = fs.readFileSync('nf-produtos-nf.js', 'utf8');

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
function nfeBase(det, crt = 1) {
  const nfe = {
    emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE', ie: '123456789', crt,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '100', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '200', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55 },
    det, transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 100 }],
  };
  nfe.total = B.calcularTotais(det, 0, 0);
  return nfe;
}

test('resolverRegra: prioridade destino exato > QUALQUER, produto exato > QUALQUER', () => {
  const nat = { id: 'n1', cfopPadrao: '5102', csosn: '102', regras: [
    { id: 'r1', destino: 'QUALQUER', produto: 'QUALQUER', cfop: '5102', codigo: '102' },
    { id: 'r2', destino: 'RJ', produto: 'QUALQUER', cfop: '6102', codigo: '102' },
    { id: 'r3', destino: 'RJ', produto: 'NCM:27101921', cfop: '6101', codigo: '102' },
  ] };
  assert.equal(N.resolverRegra(nat, { ufDest: 'SP', ncm: '94036000' }).id, 'r1');
  assert.equal(N.resolverRegra(nat, { ufDest: 'RJ', ncm: '94036000' }).id, 'r2');
  assert.equal(N.resolverRegra(nat, { ufDest: 'RJ', ncm: '27101921' }).id, 'r3');
  assert.equal(N.resolverRegra({ cfopPadrao: '5102', regras: [] }, { ufDest: 'RJ' }), null);
  assert.equal(N.resolverRegra(null, {}), null);
});

test('aplicarRegraNoItem: cfop/códigos/PIS/IBS sem inventar', () => {
  const it = itemBase();
  const r = N.aplicarRegraNoItem(it, { cfop: '6102', codigo: '00', pisCst: '01', cofinsCst: '01', cstIBS: '000', cClassTrib: '000001', aliq: '18', base: '100' });
  assert.equal(r.aplicado, true);
  assert.equal(it.cfop, '6102');
  assert.equal(it.imposto.icms.csosn, '00');
  assert.equal(it.imposto.icms.cst, '00');
  assert.equal(it.imposto.pis.cST, '01');
  assert.equal(it.imposto.ibscbs.cst, '000');
  assert.equal(it._regraAliq, 18);
  const inv = N.aplicarRegraNoItem(itemBase(), { cfop: '99' });
  assert.equal(inv.aplicado, false, 'CFOP inválido não aplica');
});

test('garantia natureza→item no HTML: nfNatOpId + reconciliação nos 3 modos', () => {
  assert.ok(html.includes('id="nfNatOpId"') || html.includes("natIdHidden.id = 'nfNatOpId'"), 'id da natureza no form');
  assert.ok(html.includes('natOpId:'), 'coletarFormDataNF carrega natOpId');
  assert.ok(html.includes('reconcilia'), 'reconciliação documentada nos 3 modos');
  assert.ok(html.includes('imposto.icms.cst = csosnEff'), 'CST Regime Normal a partir do campo');
  assert.ok(html.includes("nfPopularCodigoICMSItem('itemCSOSNCad', nat.csosn)") || prodSrc.includes("nfPopularCodigoICMSItem('itemCSOSNCad', nat.csosn)"), 'produto respeita natureza');
});

test('Fase C: gALCZFMCBS após gRed, antes de vCBS', () => {
  const it = itemBase();
  it.imposto.ibscbs.alcZfm = { tp: '1', nProcSuframa: '12345678', pAliqEfetRegCBS: 9, vTribRegCBS: 9 };
  const n = nfeBase([it], 1);
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<gALCZFMCBS><tpALCZFMCBS>1<\/tpALCZFMCBS><nProcSuframa>12345678<\/nProcSuframa><pAliqEfetRegCBS>9\.0000<\/pAliqEfetRegCBS><vTribRegCBS>9\.00<\/vTribRegCBS><\/gALCZFMCBS><vCBS>/);
  const bad = V.validarItem((() => { const x = itemBase(); x.imposto.ibscbs.alcZfm = { tp: '3' }; return x; })(), 0);
  assert.equal(bad.valid, false);
  assert.match(bad.errors.join('|'), /tp inválido/);
});

test('Fase C: indDoacao só aceita 1', () => {
  const it = itemBase();
  it.imposto.ibscbs.indDoacao = '1';
  const n = nfeBase([it], 1);
  assert.match(B.buildNFeXML(n).xml, /<cClassTrib>000001<\/cClassTrib><indDoacao>1<\/indDoacao>/);
  const bad = V.validarItem((() => { const x = itemBase(); x.imposto.ibscbs.indDoacao = '2'; return x; })(), 0);
  assert.match(bad.errors.join('|'), /indDoacao inválido/);
});

test('Fase C: vItem por det + vNFTot no contexto RTC', () => {
  const it = itemBase();
  const n = nfeBase([it], 1);
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<\/imposto>\s*<vItem>100\.00<\/vItem>\s*<\/det>/, 'vItem = vProd+vIPI');
  assert.match(xml, /<vNFTot>100\.00<\/vNFTot>/, 'vNFTot = vNF + IBS/CBS/IS (zeros)');
  // Sem RTC: sem vNFTot (XML legado inalterado)
  const it2 = itemBase();
  delete it2.imposto.ibscbs;
  const n2 = nfeBase([it2], 1);
  n2.total = B.calcularTotais(n2.det, 0, 0);
  const xml2 = B.buildNFeXML(n2).xml;
  assert.match(xml2, /<vItem>100\.00<\/vItem>/, 'vItem sempre');
  assert.doesNotMatch(xml2, /<vNFTot>/, 'sem RTC = sem vNFTot');
});

test('Fase C: dhSaiEnt opcional no ide', () => {
  const n = nfeBase([itemBase()], 1);
  n.ide.dhSaiEnt = '2026-10-13T10:00:00-03:00';
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<dhEmi>.*<\/dhEmi><dhSaiEnt>.*<\/dhSaiEnt><tpNF>/, 'dhSaiEnt após dhEmi, antes de tpNF');
  const bad = V.validarNFe((() => { const x = nfeBase([itemBase()], 1); x.ide.dhSaiEnt = 'ontem'; return x; })());
  assert.match(bad.errors.join('|'), /dhSaiEnt.*inválida/);
});

test('Fase B no HTML: regras na natureza + produto fiscal + natOpId no build', () => {
  assert.ok(natHtml.includes('natOpRegrasLista'), 'editor de regras no modal');
  assert.ok(natHtml.includes('natOpRegraAdd'), 'botão adicionar regra');
  assert.ok(html.includes('natOpId:'), 'natOpId no formData');
  assert.ok(html.includes('resolverRegra') || fs.readFileSync('nf-service.js', 'utf8').includes('resolverRegra'), 'service resolve regras');
  assert.ok(fs.readFileSync('nf-service.js', 'utf8').includes('regraAplicada'), 'CFOP explícito pula ajustarCFOP');
  assert.ok(prodSrc.includes('aplicarFiscalProduto'), 'override fiscal por produto');
});
