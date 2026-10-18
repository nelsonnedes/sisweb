import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// Teste dedicado de parseSefazResponse (nf-functions.js).
// Contrato:
//   - default  -> ÚLTIMO cStat/xMotivo (status final do lote/protocolo/evento)
//   - first:true -> PRIMEIRO cStat/xMotivo (retorno principal da consulta)
const nfFunctions = readFileSync('functions/nf-functions.js', 'utf8');

function loadParse() {
  const match = nfFunctions.match(/function parseSefazResponse\(xmlResp[\s\S]*?\n\}/);
  assert.ok(match, 'parseSefazResponse não encontrada');
  const context = {};
  vm.runInNewContext(`${match[0]}; this.parseSefazResponse = parseSefazResponse;`, context);
  return context.parseSefazResponse;
}

const RESP_MULTI = '<?xml version="1.0"?><soap:Envelope><soap:Body>'
  + '<retConsSitMDFe versao="3.00"><tpAmb>2</tpAmb><cStat>100</cStat>'
  + '<xMotivo>Autorizado o uso do MDF-e</xMotivo>'
  + '<protMDFe><infProt><chMDFe>15261018615107000100580010000000181048637654</chMDFe>'
  + '<nProt>915260000005034</nProt><cStat>100</cStat>'
  + '<xMotivo>Autorizado o uso do MDF-e</xMotivo></infProt></protMDFe>'
  + '<procEventoMDFe><retEventoMDFe><infEvento><cStat>135</cStat>'
  + '<xMotivo>Evento registrado e vinculado ao MDF-e</xMotivo></infEvento></retEventoMDFe></procEventoMDFe>'
  + '</retConsSitMDFe></soap:Body></soap:Envelope>';

test('default = último cStat/xMotivo (status final do protocolo/evento)', () => {
  const parse = loadParse();
  const ret = parse(RESP_MULTI, ['100', '150']);
  assert.equal(ret.cStat, '135');
  assert.equal(ret.xMotivo, 'Evento registrado e vinculado ao MDF-e');
  assert.equal(ret.autorizada, false);
  assert.equal(ret.allCStat.join(','), '100,100,135');
  assert.equal(ret.allXMotivo.join('|'),
    'Autorizado o uso do MDF-e|Autorizado o uso do MDF-e|Evento registrado e vinculado ao MDF-e');
});

test('first = primeiro cStat/xMotivo (retorno principal da consulta)', () => {
  const parse = loadParse();
  const ret = parse(RESP_MULTI, ['100', '101', '150'], { first: true });
  assert.equal(ret.cStat, '100');
  assert.equal(ret.xMotivo, 'Autorizado o uso do MDF-e');
  assert.equal(ret.autorizada, true);
  assert.equal(ret.nProt, '915260000005034');
});

test('default em autorização: 103 do lote seguido de 100 do protocolo => autorizada', () => {
  const parse = loadParse();
  const xml = '<retEnviNFe><cStat>103</cStat><xMotivo>Lote recebido com sucesso</xMotivo>'
    + '<protNFe><infProt><chNFe>15261018615107000100550010000017261016277195</chNFe>'
    + '<nProt>315260000113137</nProt><cStat>100</cStat>'
    + '<xMotivo>Autorizado o uso da NF-e</xMotivo>'
    + '<dhRecbto>2026-10-18T12:00:00-03:00</dhRecbto></infProt></protNFe></retEnviNFe>';
  const ret = parse(xml, ['100', '150']);
  assert.equal(ret.cStat, '100');
  assert.equal(ret.xMotivo, 'Autorizado o uso da NF-e');
  assert.equal(ret.autorizada, true);
  assert.equal(ret.nProt, '315260000113137');
  assert.equal(ret.chNFe, '15261018615107000100550010000017261016277195');
  assert.equal(ret.dhRecbto, '2026-10-18T12:00:00-03:00');
});

test('cStat único: default e first retornam o mesmo resultado', () => {
  const parse = loadParse();
  const xml = '<retConsSitNFe><cStat>217</cStat><xMotivo>Rejeicao: NF-e nao consta na base de dados da SEFAZ</xMotivo></retConsSitNFe>';
  const semOpts = parse(xml, ['100']);
  const comFirst = parse(xml, ['100'], { first: true });
  assert.equal(semOpts.cStat, '217');
  assert.equal(comFirst.cStat, '217');
  assert.equal(semOpts.xMotivo, 'Rejeicao: NF-e nao consta na base de dados da SEFAZ');
  assert.equal(comFirst.xMotivo, semOpts.xMotivo);
  assert.equal(semOpts.autorizada, false);
});

test('sem cStat => 999, motivo padrão e não autorizada', () => {
  const parse = loadParse();
  const ret = parse('<soap:Envelope><soap:Body></soap:Body></soap:Envelope>', ['100']);
  assert.equal(ret.cStat, '999');
  assert.equal(ret.xMotivo, 'Resposta não parseada');
  assert.equal(ret.autorizada, false);
  assert.equal(ret.allCStat.length, 0);
  assert.equal(ret.allXMotivo.length, 0);
  assert.equal(ret.nProt, '');
});

test('autorizada respeita o cStat escolhido (default last × first)', () => {
  const parse = loadParse();
  const xml = '<ret><cStat>101</cStat><xMotivo>Cancelamento homologado</xMotivo>'
    + '<retEvento><infEvento><cStat>100</cStat><xMotivo>Autorizado</xMotivo></infEvento></retEvento></ret>';
  // default = último (100) com allowlist ['100'] => autorizada
  assert.equal(parse(xml, ['100']).autorizada, true);
  // first = primeiro (101) com allowlist ['100'] => não autorizada
  assert.equal(parse(xml, ['100'], { first: true }).autorizada, false);
  // first com allowlist incluindo 101 => autorizada
  assert.equal(parse(xml, ['100', '101'], { first: true }).autorizada, true);
});
