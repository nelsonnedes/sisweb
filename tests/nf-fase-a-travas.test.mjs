import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Fase A — travas fiscais que eliminam rejeição/autuação:
// gate CRT×CSOSN/CST, PIS/COFINS Qtde (CST 03), ICMS monofásicos 02/15/53/61,
// gDevTrib, cClassTrib estrutural (sem select obsoleto), finNFe/indPres.
const tablesSrc = fs.readFileSync('nf-tax-tables.js', 'utf8');
const T = new Function('window', 'module', tablesSrc + '; return window.NFTaxTables;')({ window: {} }, undefined);
const builderSrc = fs.readFileSync('nf-xml-builder.js', 'utf8');
const B = new Function('window', 'console', builderSrc + '; return window.NFXmlBuilder;')({ window: {} }, console);
const validatorSrc = fs.readFileSync('nf-validator.js', 'utf8');
const V = new Function('window', 'console', tablesSrc + '\n' + validatorSrc + '; return window.NFValidator;')({ window: {} }, console);
const html = fs.readFileSync('notas-fiscais.html', 'utf8');

function itemBase(icmsExtra = {}, pisCst = '07', cofinsCst = '07') {
  return {
    cProd: '1', xProd: 'PROD', ncm: '94036000', cfop: '5102', uCom: 'UN',
    qCom: 1, vUnCom: 100, vProd: 100,
    imposto: {
      icms: { csosn: '102', ...icmsExtra },
      pis: { cST: pisCst }, cofins: { cST: cofinsCst },
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

test('tabelas oficiais: CSOSN 10 códigos, CST ICMS com monofásicos, PIS/COFINS por grupo', () => {
  assert.equal(Object.keys(T.CSOSN_FULL).length, 10);
  assert.ok(T.CSOSN_FULL['203'] && T.CSOSN_FULL['300']);
  assert.ok(T.CST_ICMS_FULL['02'] && T.CST_ICMS_FULL['61']);
  assert.deepEqual(T.CST_ICMS_MONO, ['02', '15', '53', '61']);
  assert.equal(T.grupoPISCOFINS('01'), 'aliq');
  assert.equal(T.grupoPISCOFINS('03'), 'qtde');
  assert.equal(T.grupoPISCOFINS('07'), 'nt');
  assert.equal(T.grupoPISCOFINS('99'), 'nt');
  assert.equal(T.grupoPISCOFINS('XX'), '');
  assert.ok(T.TABLE_META.cClassTrib.url.includes('nfe.fazenda.gov.br'), 'fonte oficial referenciada');
});

test('gate CRT: SN só CSOSN, Normal só CST (cruzamento barra)', () => {
  assert.deepEqual(T.validarCodigoICMS(1, '102'), { ok: true, grupo: 'csosn', erro: '' });
  assert.deepEqual(T.validarCodigoICMS(2, '900'), { ok: true, grupo: 'csosn', erro: '' });
  assert.deepEqual(T.validarCodigoICMS(3, '00'), { ok: true, grupo: 'cst', erro: '' });
  assert.deepEqual(T.validarCodigoICMS(3, '61'), { ok: true, grupo: 'cst', erro: '' });
  const snComCST = T.validarCodigoICMS(1, '00');
  assert.equal(snComCST.ok, false);
  assert.match(snComCST.erro, /Simples/);
  const normalComCSOSN = T.validarCodigoICMS(3, '102');
  assert.equal(normalComCSOSN.ok, false);
  assert.match(normalComCSOSN.erro, /931/);
  assert.equal(T.validarCodigoICMS(3, '999').ok, false);
  assert.equal(T.validarCodigoICMS(9, '00').ok, false);
});

test('cClassTrib estrutural IT 2024.001: prefixo === CST, sem lista fixa', () => {
  assert.deepEqual(T.validarCClassTrib('000', '000001'), { ok: true, erro: '' });
  assert.deepEqual(T.validarCClassTrib('620', '620001'), { ok: true, erro: '' });
  const troca = T.validarCClassTrib('000', '620001');
  assert.equal(troca.ok, false);
  assert.match(troca.erro, /idênticos ao CST/);
  assert.equal(T.validarCClassTrib('00', '000001').ok, false);
  assert.equal(T.validarCClassTrib('000', 'ABC001').ok, false);
  assert.deepEqual(T.validarCCredPres('01'), { ok: true, erro: '' });
  assert.equal(T.validarCCredPres('1').ok, false);
});

test('validador injeta CRT do emitente no item (rejeita cruzamento)', () => {
  const rSN = V.validarNFe(nfeBase([itemBase({ csosn: '102' })], 1));
  assert.equal(rSN.valid, true, JSON.stringify(rSN.errors));
  const rCross = V.validarNFe(nfeBase([itemBase({ csosn: '102', cst: undefined })], 3));
  // csosn 102 com CRT 3 → erro (usa csosn do item pois cst ausente)
  assert.equal(rCross.valid, false);
  assert.match(rCross.errors.join('|'), /CRT 3.*CSOSN|CSOSN .* CRT 3/);
  const rCST = V.validarNFe(nfeBase([itemBase({ cst: '00' })], 3));
  assert.equal(rCST.valid, true, JSON.stringify(rCST.errors));
});

test('builder ICMS monofásicos 02/15/53/61 (antes caíam em ICMS90)', () => {
  const n02 = nfeBase([itemBase({ cst: '02', qBCMono: 100, adRemICMS: 0.05 })], 3);
  n02.total = B.calcularTotais(n02.det, 0, 0);
  const x02 = B.buildNFeXML(n02).xml;
  assert.match(x02, /<ICMS02><orig>0<\/orig><CST>02<\/CST><qBCMono>100\.0000<\/qBCMono><adRemICMS>0\.0500<\/adRemICMS><vICMSMono>5\.00<\/vICMSMono><\/ICMS02>/);
  assert.match(x02, /<qBCMono>100\.00<\/qBCMono><vICMSMono>5\.00<\/vICMSMono>/, 'totais ICMSTot (2 decimais no total)');
  const n61 = nfeBase([itemBase({ cst: '61', adRemICMSRet: 0.03, vICMSMonoRet: 3 })], 3);
  n61.total = B.calcularTotais(n61.det, 0, 0);
  assert.match(B.buildNFeXML(n61).xml, /<ICMS61><orig>0<\/orig><CST>61<\/CST><adRemICMSRet>0\.0300<\/adRemICMSRet><vICMSMonoRet>3\.00<\/vICMSMonoRet><\/ICMS61>/);
  const n53 = nfeBase([itemBase({ cst: '53', qBCMono: 10, adRemICMS: 0.02 })], 3);
  n53.total = B.calcularTotais(n53.det, 0, 0);
  assert.match(B.buildNFeXML(n53).xml, /<ICMS53><orig>0<\/orig><CST>53<\/CST>/);
  const n15 = nfeBase([itemBase({ cst: '15', qBCMono: 50, adRemICMS: 0.04, qBCMonoReten: 10, adRemICMSReten: 0.04 })], 3);
  n15.total = B.calcularTotais(n15.det, 0, 0);
  assert.match(B.buildNFeXML(n15).xml, /<ICMS15><orig>0<\/orig><CST>15<\/CST>.*<vICMSMonoReten>0\.40<\/vICMSMonoReten><\/ICMS15>/);
});

test('builder PIS/COFINS CST 03 → Qtde (antes caía em NT)', () => {
  const n = nfeBase([itemBase({}, '03', '03')], 1);
  n.det[0].imposto.pis = { cST: '03', qBCProd: 100, vAliqProd: 0.05 };
  n.det[0].imposto.cofins = { cST: '03', qBCProd: 100, vAliqProd: 0.25 };
  n.total = B.calcularTotais(n.det, 0, 0);
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<PISQtde><CST>03<\/CST><qBCProd>100\.0000<\/qBCProd><vAliqProd>0\.0500<\/vAliqProd><vPIS>5\.00<\/vPIS><\/PISQtde>/);
  assert.match(xml, /<COFINSQtde><CST>03<\/CST><qBCProd>100\.0000<\/qBCProd><vAliqProd>0\.2500<\/vAliqProd><vCOFINS>25\.00<\/vCOFINS><\/COFINSQtde>/);
});

test('validador exige qBCProd/vAliqProd no CST 03', () => {
  const bad = V.validarItem(itemBase({}, '03', '07'), 0);
  assert.equal(bad.valid, false);
  assert.match(bad.errors.join('|'), /CST 03 exige quantidade/);
  const ok = itemBase({}, '03', '07');
  ok.imposto.pis = { cST: '03', qBCProd: 10, vAliqProd: 0.1 };
  assert.equal(V.validarItem(ok, 0).valid, true);
});

test('gDevTrib: item emite após gDif; totais somam (antes 0.00 fixo)', () => {
  const it = itemBase();
  it.imposto.ibscbs.devTribUF = { p: 10, v: 5 };
  it.imposto.ibscbs.devTribCBS = { v: 2.5 };
  const n = nfeBase([it], 1);
  n.total = B.calcularTotais(n.det, 0, 0);
  assert.equal(n.total.vDevTribIBSUF, 5);
  assert.equal(n.total.vDevTribCBS, 2.5);
  const xml = B.buildNFeXML(n).xml;
  assert.match(xml, /<gDevTrib><pDevTrib>10\.0000<\/pDevTrib><vDevTrib>5\.00<\/vDevTrib><\/gDevTrib>/);
  assert.match(xml, /<IBSCBSTot>.*<vDevTrib>5\.00<\/vDevTrib>.*<vDevTrib>2\.50<\/vDevTrib>/);
});

test('cClassTrib com prefixo trocado barra no validarNFe', () => {
  const it = itemBase();
  it.imposto.ibscbs.cClassTrib = '620001'; // CST 000 × prefixo 620
  const r = V.validarNFe(nfeBase([it], 1));
  assert.equal(r.valid, false);
  assert.match(r.errors.join('|'), /idênticos ao CST/);
});

test('UI Fase A: selects por regime, finNFe/indPres, config CST Normal', () => {
  assert.ok(html.includes('id="nfFinNFe"'), 'select finalidade');
  assert.ok(html.includes('id="nfIndPres"'), 'select presença');
  assert.ok(html.includes('id="cfgIcmsCst"'), 'config CST Regime Normal');
  assert.ok(html.includes('nfPopularCodigoICMSItem'), 'popular por regime');
  assert.ok(html.includes('nf-tax-tables.js'), 'módulo de tabelas carregado');
  assert.match(html, /CRT 1\/2.*SOMENTE CSOSN/, 'documenta o gate');
});
