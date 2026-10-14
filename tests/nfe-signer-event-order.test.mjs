import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const nfFunctions = readFileSync('functions/nf-functions.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

function loadInsertIndex() {
  const match = nfFunctions.match(/function findSignatureInsertIndex\(xml, fromIdx\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'findSignatureInsertIndex não encontrada');
  const context = {};
  vm.runInNewContext(`${match[0]}; this.findSignatureInsertIndex = findSignatureInsertIndex;`, context);
  return context.findSignatureInsertIndex;
}

function assinarSimulado(findSignatureInsertIndex, xml, signedTag) {
  const openRe = new RegExp(`<${signedTag}[^>]*>[\\s\\S]*?<\\/${signedTag}>`, 'i');
  const m = xml.match(openRe);
  const sentForm = m[0];
  const idxEnd = xml.indexOf(sentForm) + sentForm.length;
  const idx = findSignatureInsertIndex(xml, idxEnd);
  return { idx, resultado: idx >= 0 ? xml.slice(0, idx) + '<Signature/>' + xml.slice(idx) : 'FALHOU' };
}

test('signer: inserta antes do fechamento do PAI do elemento assinado', () => {
  assert.match(nfFunctions, /function findSignatureInsertIndex\(xml, fromIdx\)/);
  assert.match(nfFunctions, /const idxInsert = idxElementEnd > sentForm\.length \? findSignatureInsertIndex\(xmlComSentForm, idxElementEnd\) : -1;/);
  assert.match(nfFunctions, /xmlComSentForm\.slice\(0, idxInsert\) \+ signature \+ xmlComSentForm\.slice\(idxInsert\)/);
  assert.doesNotMatch(nfFunctions, /lastIndexOf\(rootClose\)/, 'injeção no fim da raiz quebra eventos NF-e (envEvento)');
});

test('evento NF-e: Signature DENTRO de <evento> (regressão "Falha no schema XML envEvento/evento")', () => {
  const f = loadInsertIndex();
  const xml = '<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">\n<idLote>1</idLote>\n<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">\n<infEvento Id="ID11011144444444444444444444444444444444444444444444 01">\n<chNFe>4</chNFe>\n</infEvento>\n</evento>\n</envEvento>'.replace('44 01', '4401');
  const { resultado } = assinarSimulado(f, xml, 'infEvento');
  assert.match(resultado, /<\/infEvento>\s*<Signature\/><\/evento>/);
  assert.doesNotMatch(resultado, /<\/evento>\s*<Signature\/><\/envEvento>/, 'Signature NÃO pode ficar no nível do envEvento');
  assert.ok(resultado.indexOf('<Signature/>') < resultado.indexOf('</evento>'), 'dentro do evento');
});

test('MDF-e: Signature depois de infMDFeSupl (último filho de MDFe)', () => {
  const f = loadInsertIndex();
  const xml = '<MDFe xmlns="http://www.portalfiscal.inf.br/mdfe"><infMDFe Id="MDFe1" versao="3.00"><ide></ide></infMDFe><infMDFeSupl><qrCodMDFe>https://x</qrCodMDFe></infMDFeSupl></MDFe>';
  const { resultado } = assinarSimulado(f, xml, 'infMDFe');
  assert.match(resultado, /<\/infMDFeSupl><Signature\/><\/MDFe>/);
});

test('NFe e eventoMDFe: último filho da raiz (comportamento preservado)', () => {
  const f = loadInsertIndex();
  const nfe = '<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe1" versao="4.00"><ide></ide></infNFe></NFe>';
  assert.match(assinarSimulado(f, nfe, 'infNFe').resultado, /<\/infNFe><Signature\/><\/NFe>/);
  const evt = '<eventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00"><infEvento Id="ID1101121"><chMDFe>1</chMDFe></infEvento></eventoMDFe>';
  assert.match(assinarSimulado(f, evt, 'infEvento').resultado, /<\/infEvento><Signature\/><\/eventoMDFe>/);
});

test('irmão com filho de MESMO nome aninhado: Signature depois do irmão (não dentro)', () => {
  const f = loadInsertIndex();
  const xml = '<evento xmlns="http://www.portalfiscal.inf.br/nfe"><infEvento Id="ID1101111"><chNFe>1</chNFe></infEvento><det><det>ninho</det></det></evento>';
  const { idx, resultado } = assinarSimulado(f, xml, 'infEvento');
  assert.ok(idx >= 0, 'encontrou posição');
  assert.match(resultado, /<\/det><\/det><Signature\/><\/evento>/);
  assert.doesNotMatch(resultado, /<det><Signature\/>/, 'Signature NÃO pode ficar dentro do irmão');
});

test('irmão com ">" em atributo: parser não quebra', () => {
  const f = loadInsertIndex();
  const xml = '<evento xmlns="http://www.portalfiscal.inf.br/nfe"><infEvento Id="ID1101111"><chNFe>1</chNFe></infEvento><obs compara="a>b">x</obs></evento>';
  const { idx, resultado } = assinarSimulado(f, xml, 'infEvento');
  assert.ok(idx >= 0, 'encontrou posição mesmo com > em atributo');
  assert.match(resultado, /<\/obs><Signature\/><\/evento>/);
});

test('cancelamento: falha NÃO muda o status da nota (segue autorizada p/ retry)', () => {
  assert.doesNotMatch(nfFunctions, /status:\s+ret\.autorizada \? 'cancelada' : 'erro_cancelamento'/);
  assert.match(nfFunctions, /const patchCancel = ret\.autorizada/);
  assert.match(nfFunctions, /erroCancelamento:\s+`cStat \$\{ret\.cStat\}/);
  // Cliente: listagem mostra o estado real + permite nova tentativa
  assert.match(html, /erro_cancelamento: \['⚠️ Erro cancelamento', 'warning'\]/);
  assert.match(html, /\$\{\['autorizada','erro_cancelamento'\]\.includes\(n\.status\) \? `<button class="btn btn-danger btn-small" onclick="iniciarCancelamento/);
});
