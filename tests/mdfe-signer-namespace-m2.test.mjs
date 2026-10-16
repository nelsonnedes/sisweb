import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const nfFunctions = readFileSync('functions/nf-functions.js', 'utf8');
const mdfeFunctions = readFileSync('functions/mdfe-functions.js', 'utf8');

const NS_NFE = 'http://www.portalfiscal.inf.br/nfe';
const NS_MDFE = 'http://www.portalfiscal.inf.br/mdfe';

function loadHashForm() {
  const match = nfFunctions.match(/function buildSignedHashForm\(sentForm, tagName, namespace\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'buildSignedHashForm não encontrada em functions/nf-functions.js');
  const context = {};
  vm.runInNewContext(`${match[0]}; this.buildSignedHashForm = buildSignedHashForm;`, context);
  return context.buildSignedHashForm;
}

test('M2: digest usa o namespace do documento (NF-e default, MDF-e explícito)', () => {
  assert.match(nfFunctions, /const namespace = options\.namespace \|\| 'http:\/\/www\.portalfiscal\.inf\.br\/nfe';/);
  assert.match(nfFunctions, /const hashForm = buildSignedHashForm\(sentForm, tagName, namespace\);/);
  assert.doesNotMatch(
    nfFunctions,
    /xmlns="http:\/\/www\.portalfiscal\.inf\.br\/nfe"`\)/,
    'namespace não pode mais estar hardcoded inline no digest',
  );
});

test('M2: MDF-e passa o namespace mdfe nos dois signer calls (lote e evento)', () => {
  assert.match(mdfeFunctions, /const MDFE_NS = 'http:\/\/www\.portalfiscal\.inf\.br\/mdfe';/);
  assert.match(mdfeFunctions, /assinarXMLcomForge\(xml, pfx, senhaA1, \{ tagName: 'infMDFe', idPrefix: 'MDFe', namespace: MDFE_NS \}\)/);
  assert.match(mdfeFunctions, /assinarXMLcomForge\(event, pfx, senhaA1, \{ tagName: 'infEvento', idPrefix: 'ID', namespace: MDFE_NS \}\)/);
  const usos = mdfeFunctions.match(/namespace: MDFE_NS/g) || [];
  assert.equal(usos.length, 3, 'as três assinaturas MDF-e devem declarar o namespace mdfe (lote + encerramento + cancelamento)');
});

test('M2: precedente NF-e não muda (nenhum call site passa namespace)', () => {
  const usosNf = nfFunctions.match(/namespace: ['"]http/g) || [];
  assert.equal(usosNf.length, 0, 'NF-e deve usar o default (nfe) sem passar namespace');
  assert.match(nfFunctions, /\{ tagName: 'infEvento', idPrefix: 'ID' \}/);
  assert.match(nfFunctions, /\{ tagName: 'infInut', idPrefix: 'ID' \}/);
  assert.match(nfFunctions, /assinarXMLcomForge\(xml, pfxBuffer, senhaA1\)/);
});

test('M2: forma do digest injeta o xmlns herdado correto e preserva o explícito', () => {
  const buildSignedHashForm = loadHashForm();
  const infe = '<infNFe Id="NFe35260111222333000181550010000000011000000001"><ide><cUF>35</cUF></ide></infNFe>';
  assert.equal(
    buildSignedHashForm(infe, 'infNFe', NS_NFE),
    '<infNFe xmlns="http://www.portalfiscal.inf.br/nfe" Id="NFe35260111222333000181550010000000011000000001"><ide><cUF>35</cUF></ide></infNFe>',
  );
  const infMdfe = '<infMDFe Id="MDFe35261012345678000195580010000000011000000001" versao="3.00"><ide></ide></infMDFe>';
  const comNs = buildSignedHashForm(infMdfe, 'infMDFe', NS_MDFE);
  assert.match(comNs, /^<infMDFe xmlns="http:\/\/www\.portalfiscal\.inf\.br\/mdfe" Id="MDFe/);
  assert.doesNotMatch(comNs, /portalfiscal\.inf\.br\/nfe/, 'digest MDF-e não pode carregar namespace nfe');
  const explicito = '<infMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" Id="MDFe1"><ide></ide></infMDFe>';
  assert.equal(buildSignedHashForm(explicito, 'infMDFe', NS_MDFE), explicito, 'xmlns explícito não é duplicado');
});
