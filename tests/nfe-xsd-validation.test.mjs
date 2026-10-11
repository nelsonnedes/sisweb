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
  if (rtc || adv) {
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
