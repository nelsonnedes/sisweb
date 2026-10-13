import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Validação XSD no pipeline: gera a NF-e pelo builder real e valida contra o
// schema OFICIAL em uso (PL_010f_v1.04 — nfe_v4.00.xsd), incluindo os grupos
// da Reforma Tributária (IBS/CBS/IS). Depende de Java para rodar o validador
// (xsd-schema-validator); sem o módulo, o teste é pulado.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const builderSrc = fs.readFileSync(path.join(root, 'nf-xml-builder.js'), 'utf8');
const B = new Function('window', 'console', builderSrc + '; return window.NFXmlBuilder;')({ window: {} }, console);
const XSD = path.join(root, 'tests', 'schemas', 'nfe', 'nfe_v4.00.xsd');

let validator = null;
try { validator = (await import('xsd-schema-validator')).default; } catch { validator = null; }

// Assinatura sintaticamente válida (schema xmldsig) — a assinatura real é
// produzida pela Cloud Function; aqui apenas satisfazemos o schema do <NFe>.
const SIGNATURE = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">`
  + `<SignedInfo><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>`
  + `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>`
  + `<Reference URI="#NFe00000000000000000000000000000000000000000000"><Transforms>`
  + `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>`
  + `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>`
  + `</Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>`
  + `<DigestValue>AAAAAAAAAAAAAAAAAAAAAAAAAAA=</DigestValue></Reference></SignedInfo>`
  + `<SignatureValue>AAAAAAAAAAAAAAAAAAAAAAAAAAA=</SignatureValue>`
  + `<KeyInfo><X509Data><X509Certificate>AAAA</X509Certificate></X509Data></KeyInfo></Signature>`;

function buildXml(opts = {}) {
  const rtc = !!opts.rtc;
  const adv = !!opts.adv;
  const det = [{
    cProd: '1', xProd: 'PRODUTO TESTE', ncm: '94036000', cfop: '5102', uCom: 'UN',
    qCom: 1, vUnCom: 100, vProd: 100,
    imposto: { icms: { cst: '00', vBC: 100, pICMS: 18, vICMS: 18 }, pis: { cST: '07' }, cofins: { cST: '07' } },
  }];
  if (opts.ibscbs) {
    det[0].imposto.ibscbs = opts.ibscbs;
    det[0].imposto.is = { habilitado: true, cstIS: '000', cClassTribIS: '000001', pIS: 0.1 };
  } else if (rtc || adv) {
    det[0].imposto.ibscbs = { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 10, pIBSMun: 0, pCBS: 9 };
    if (adv) {
      det[0].imposto.ibscbs.pRedAliq = 25;
      det[0].imposto.ibscbs.pDif = 10;
      det[0].imposto.ibscbs.credPresOper = { cCredPres: '01', pCredPres: 5, vBCCredPres: 100 };
    }
    det[0].imposto.is = { habilitado: true, cstIS: '000', cClassTribIS: '000001', pIS: 0.1 };
  }
  const nfe = {
    emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE LTDA', ie: '123456789', crt: 3,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '100', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
      endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '200', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
    ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55 },
    det, transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 100 }], infAdic: '', desconto: 0, frete: 0,
  };
  if (opts.compraGov) nfe.ide.compraGov = opts.compraGov;
  nfe.total = B.calcularTotais(nfe.det, 0, 0);
  return B.buildNFeXML(nfe).xml.replace('</infNFe>', `</infNFe>${SIGNATURE}`);
}

test('NF-e gerada é válida contra o XSD oficial (nfe_v4.00.xsd)', { skip: !validator ? 'xsd-schema-validator ausente' : false }, async (t) => {
  await t.test('sem grupos RTC', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({}), XSD));
  });
  await t.test('com grupos IBS/CBS e IS', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({ rtc: true }), XSD));
  });
  await t.test('com gRed/gDif/gCredPresOper (avançados)', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({ adv: true }), XSD));
  });
  await t.test('gTransfCred (CST 800)', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({ ibscbs: { habilitado: true, cst: '800', cClassTrib: '800001', transfCred: { vIBS: 10, vCBS: 5 } } }), XSD));
  });
  await t.test('gAjusteCompet (CST 811)', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({ ibscbs: { habilitado: true, cst: '811', cClassTrib: '811001', ajusteCompet: { competApur: '2026-01', vIBS: 10, vCBS: 5 } } }), XSD));
  });
  await t.test('gEstornoCred', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({ ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 10, pIBSMun: 0, pCBS: 9, estornoCred: { vIBSEstCred: 1, vCBSEstCred: 2 } } }), XSD));
  });
  await t.test('gCredPresIBSZFM', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({ ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 10, pIBSMun: 0, pCBS: 9, credPresIBSZFM: { competApur: '2026-01', tpCredPresIBSZFM: '1', vCredPresIBSZFM: 5 } } }), XSD));
  });
  await t.test('gIBSCBSMono adRem (CST 620)', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({ ibscbs: { habilitado: true, cst: '620', cClassTrib: '620001',
      mono: {
        ibs: { regime: 'adRem', padrao: { qBCMono: 100, aliq: 0.05 }, reten: { qBCMonoReten: 10, aliqReten: 0.05 }, ret: { v: 1 }, bio: { qBCBioComb: 5, vDif: 0.25 } },
        cbs: { regime: 'adRem', padrao: { qBCMono: 100, aliq: 0.03 } },
      } } }), XSD));
  });
  await t.test('gIBSCBSMono adValorem (CST 620)', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({ ibscbs: { habilitado: true, cst: '620', cClassTrib: '620001',
      mono: {
        ibs: { regime: 'adValorem', padrao: { vBCMono: 1000, aliqUF: 10, aliqMun: 2 } },
        cbs: { regime: 'adValorem', padrao: { vBCMono: 1000, aliq: 9 }, ret: { v: 2 } },
      } } }), XSD));
  });
  await t.test('gTribRegular + gTribCompraGov', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({ ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 10, pIBSMun: 0, pCBS: 9,
      tribRegular: { cstReg: '000', cClassTribReg: '000001', pAliqEfetRegIBSUF: 10, vTribRegIBSUF: 10, pAliqEfetRegIBSMun: 0, vTribRegIBSMun: 0, pAliqEfetRegCBS: 9, vTribRegCBS: 9 },
      tribCompraGov: { pAliqIBSUF: 10, vTribIBSUF: 10, pAliqIBSMun: 0, vTribIBSMun: 0, pAliqCBS: 9, vTribCBS: 9 } } }), XSD));
  });
  await t.test('ide gCompraGov (tpOperGov 2 + 1 chave)', async () => {
    await assert.doesNotReject(() => validator.validateXML(buildXml({ rtc: true,
      compraGov: { tpEnteGov: '4', pRedutor: 10, tpOperGov: '2', refDFeAnt: ['35260111222333000181550010000000011000000001'] } }), XSD));
  });
  await t.test('ICMS02 monofásico (qBCMono + adRem)', async () => {
    const det = [{
      cProd: '1', xProd: 'DIESEL', ncm: '27101921', cfop: '5656', uCom: 'L',
      qCom: 100, vUnCom: 5, vProd: 500,
      imposto: { icms: { cst: '02', qBCMono: 100, adRemICMS: 0.05 }, pis: { cST: '07' }, cofins: { cST: '07' },
        ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0, pIBSMun: 0, pCBS: 0 } },
    }];
    const nfe = {
      emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE LTDA', ie: '123456789', crt: 3,
        endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '100', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
      dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
        endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '200', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
      ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55 },
      det, transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 500 }], infAdic: '', desconto: 0, frete: 0,
    };
    nfe.total = B.calcularTotais(nfe.det, 0, 0);
    await assert.doesNotReject(() => validator.validateXML(B.buildNFeXML(nfe).xml.replace('</infNFe>', `</infNFe>${SIGNATURE}`), XSD));
  });
  await t.test('PIS/COFINS CST 03 (Qtde)', async () => {
    const det = [{
      cProd: '1', xProd: 'PRODUTO TESTE', ncm: '94036000', cfop: '5102', uCom: 'UN',
      qCom: 10, vUnCom: 10, vProd: 100,
      imposto: { icms: { cst: '00', vBC: 100, pICMS: 18, vICMS: 18 }, pis: { cST: '03', qBCProd: 10, vAliqProd: 0.5 }, cofins: { cST: '03', qBCProd: 10, vAliqProd: 2.5 },
        ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0, pIBSMun: 0, pCBS: 0 } },
    }];
    const nfe = {
      emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE LTDA', ie: '123456789', crt: 3,
        endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '100', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
      dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
        endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '200', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
      ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55 },
      det, transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 100 }], infAdic: '', desconto: 0, frete: 0,
    };
    nfe.total = B.calcularTotais(nfe.det, 0, 0);
    await assert.doesNotReject(() => validator.validateXML(B.buildNFeXML(nfe).xml.replace('</infNFe>', `</infNFe>${SIGNATURE}`), XSD));
  });
  await t.test('gDevTrib no item + totais', async () => {
    const ibscbs = { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 10, pIBSMun: 0, pCBS: 9,
      devTribUF: { p: 10, v: 10 }, devTribCBS: { v: 9 } };
    await assert.doesNotReject(() => validator.validateXML(buildXml({ ibscbs }), XSD));
  });
  await t.test('gALCZFMCBS (tp 1 + Suframa)', async () => {
    const ibscbs = { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 0, pIBSMun: 0, pCBS: 0,
      alcZfm: { tp: '1', nProcSuframa: '12345678', pAliqEfetRegCBS: 9, vTribRegCBS: 9 } };
    await assert.doesNotReject(() => validator.validateXML(buildXml({ ibscbs }), XSD));
  });
  await t.test('vItem + vNFTot + indDoacao + dhSaiEnt', async () => {
    const xml = buildXml({ rtc: true });
    assert.match(xml, /<vItem>100\.00<\/vItem>/);
    assert.match(xml, /<vNFTot>119\.10<\/vNFTot>/, 'vNF 100 + IBS 10 + CBS 9 + IS 0.10');
    const det = [{
      cProd: '1', xProd: 'PRODUTO TESTE', ncm: '94036000', cfop: '5102', uCom: 'UN',
      qCom: 1, vUnCom: 100, vProd: 100,
      imposto: { icms: { cst: '00', vBC: 100, pICMS: 18, vICMS: 18 }, pis: { cST: '07' }, cofins: { cST: '07' },
        ibscbs: { habilitado: true, cst: '000', cClassTrib: '000001', pIBSUF: 10, pIBSMun: 0, pCBS: 9, indDoacao: '1' } },
    }];
    const nfe = {
      emit: { cnpj: '11222333000181', razaoSocial: 'EMPRESA TESTE LTDA', ie: '123456789', crt: 3,
        endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '100', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
      dest: { nome: 'CLIENTE TESTE', cnpj: '11222333000181', indIEDest: 9,
        endereco: { uf: 'SP', codigoMunicipio: '3550308', logradouro: 'RUA TESTE', numero: '200', bairro: 'CENTRO', municipio: 'SAO PAULO', cep: '01001000' } },
      ide: { serie: '1', nNF: 1, dhEmi: new Date().toISOString(), dhSaiEnt: new Date().toISOString(), tpNF: 1, tpAmb: 2, cMunFG: '3550308', mod: 55 },
      det, transp: { modFrete: 9 }, pag: [{ tPag: '01', vPag: 100 }], infAdic: '', desconto: 0, frete: 0,
    };
    nfe.total = B.calcularTotais(nfe.det, 0, 0);
    await assert.doesNotReject(() => validator.validateXML(B.buildNFeXML(nfe).xml.replace('</infNFe>', `</infNFe>${SIGNATURE}`), XSD));
  });
});

test('dhEmi sem milissegundos (TDateTimeUTC)', () => {
  const xml = buildXml({});
  const m = xml.match(/<dhEmi>([^<]+)<\/dhEmi>/);
  assert.ok(m, 'dhEmi presente');
  assert.doesNotMatch(m[1], /\.\d{3}/, 'dhEmi não pode conter milissegundos');
  assert.match(m[1], /[+-]\d{2}:\d{2}$/, 'dhEmi com offset');
});

test('<indPag> não é emitido em <ide>', () => {
  assert.doesNotMatch(buildXml({}), /<indPag>/);
});

test('<vTotTrib> omitido do XML (opcional no schema; evita cStat 685)', () => {
  assert.doesNotMatch(buildXml({}), /<vTotTrib>/);
  assert.doesNotMatch(buildXml({ rtc: true }), /<vTotTrib>/);
});
