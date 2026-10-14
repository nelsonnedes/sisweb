import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const mdfeFunctions = readFileSync('functions/mdfe-functions.js', 'utf8');
const nfFunctions = readFileSync('functions/nf-functions.js', 'utf8');

function loadSoapAction() {
  const mapMatch = mdfeFunctions.match(/const MDFE_SOAP_ACTIONS = \{[\s\S]*?\n\};/);
  assert.ok(mapMatch, 'MDFE_SOAP_ACTIONS não encontrado em functions/mdfe-functions.js');
  const fnMatch = mdfeFunctions.match(/function mdfeSoapAction\(service\) \{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'mdfeSoapAction não encontrada em functions/mdfe-functions.js');
  const context = {};
  vm.runInNewContext(`${mapMatch[0]}\n${fnMatch[0]}; this.mdfeSoapAction = mdfeSoapAction;`, context);
  return context.mdfeSoapAction;
}

test('M4: todas as chamadas MDF-e enviam SOAP action (nada sem action)', () => {
  const chamadas = mdfeFunctions.match(/postSefaz\(/g) || [];
  const actions = mdfeFunctions.match(/mdfeSoapAction\('/g) || [];
  assert.equal(chamadas.length, 3, 'MDF-e tem exatamente 3 chamadas postSefaz');
  assert.equal(actions.length, chamadas.length, 'toda chamada postSefaz do MDF-e deve passar mdfeSoapAction');
  for (const servico of ['MDFeRecepcaoSinc', 'MDFeConsulta', 'MDFeRecepcaoEvento']) {
    const re = new RegExp(
      `postSefaz\\(MDFe_ENDPOINTS\\[env\\]\\.${servico}, mdfeSoap\\('${servico}'[\\s\\S]*?mdfeSoapAction\\('${servico}'\\)\\)`,
    );
    assert.match(mdfeFunctions, re, `chamada de ${servico} sem mdfeSoapAction`);
  }
});

test('M4: ações espelham as operações dos WSDLs SVRS (namespace mdfe)', () => {
  const mdfeSoapAction = loadSoapAction();
  const esperado = {
    MDFeRecepcaoSinc: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc/mdfeRecepcao',
    MDFeConsulta: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta/mdfeConsulta',
    MDFeRecepcaoEvento: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento/mdfeRecepcaoEvento',
  };
  for (const [servico, action] of Object.entries(esperado)) {
    assert.equal(mdfeSoapAction(servico), action);
    const partes = action.match(/^http:\/\/www\.portalfiscal\.inf\.br\/mdfe\/wsdl\/([A-Za-z0-9]+)\/([a-z][A-Za-z0-9]*)$/);
    assert.ok(partes, `formato da action inválido: ${action}`);
    assert.equal(partes[1], servico, 'serviço da action deve casar com o endpoint usado');
  }
  assert.equal(mdfeSoapAction('ServicoInexistente'), '');
});

test('M4: mecanismo compartilhado NF-e permanece (precedente não regride)', () => {
  assert.match(nfFunctions, /function soapActionFor\(servico\)/);
  assert.match(nfFunctions, /const resp = await postSefaz\(url, soap, pfxBuffer, senhaA1, soapActionFor\('NFeAutorizacao4'\)\)/);
  assert.match(nfFunctions, /'Content-Type': action \? `application\/soap\+xml; charset=utf-8; action="\$\{action\}"`/);
});
