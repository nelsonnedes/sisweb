import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const nfFunctions = readFileSync('functions/nf-functions.js', 'utf8');
const mdfeFunctions = readFileSync('functions/mdfe-functions.js', 'utf8');
const mdfeJs = readFileSync('mdf-e.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

function loadParseSefazResponse() {
  const match = nfFunctions.match(/function parseSefazResponse\(xmlResp[\s\S]*?\n\}/);
  assert.ok(match, 'parseSefazResponse não encontrada');
  const context = {};
  vm.runInNewContext(`${match[0]}; this.parseSefazResponse = parseSefazResponse;`, context);
  return context.parseSefazResponse;
}

const RESP_CONSULTA_ENCERRADO = '<?xml version="1.0"?><soap:Envelope><soap:Body>'
  + '<retConsSitMDFe versao="3.00"><tpAmb>2</tpAmb><verAplic>SVRS</verAplic>'
  + '<cStat>100</cStat><xMotivo>Autorizado o uso do MDF-e</xMotivo>'
  + '<protMDFe><infProt><chMDFe>15261018615107000100580010000000181048637654</chMDFe><nProt>915260000005034</nProt>'
  + '<cStat>100</cStat><xMotivo>Autorizado o uso do MDF-e</xMotivo></infProt></protMDFe>'
  + '<procEventoMDFe><eventoMDFe><infEvento><tpEvento>110112</tpEvento></infEvento></eventoMDFe>'
  + '<retEventoMDFe><infEvento><cStat>135</cStat><xMotivo>Evento registrado e vinculado ao MDF-e</xMotivo></infEvento></retEventoMDFe></procEventoMDFe>'
  + '</retConsSitMDFe></soap:Body></soap:Envelope>';

test('parseSefazResponse: default = último cStat (autorização preservada); first = retorno principal', () => {
  const parse = loadParseSefazResponse();
  const legado = parse(RESP_CONSULTA_ENCERRADO, ['100', '101', '150']);
  assert.equal(legado.cStat, '135', 'default continua pegando o status final (evento/protocolo)');
  const principal = parse(RESP_CONSULTA_ENCERRADO, ['100', '101', '150'], { first: true });
  assert.equal(principal.cStat, '100', 'consulta usa o cStat do retorno principal');
  assert.equal(principal.xMotivo, 'Autorizado o uso do MDF-e');
  assert.equal(principal.nProt, '915260000005034');
});

test('backend: consulta MDF-e deriva a verdade (encerrado/cancelado/autorizado) sem sobrescrever o documento', () => {
  assert.match(mdfeFunctions, /parseSefazResponse\(response\.body, \['100', '101', '150'\], \{ first: true \}\)/);
  assert.match(mdfeFunctions, /const tpEvento = extrairConteudoTag\(bodyConsulta, 'tpEvento'\);/);
  assert.match(mdfeFunctions, /tpEvento === '110112' \? 'encerrado' : 'cancelado'/);
  assert.match(mdfeFunctions, /ultimaConsultaSefaz: \{/);
  assert.match(mdfeFunctions, /const statusDerivado = situacao === 'encerrado' \? 'encerrado'/);
  assert.doesNotMatch(mdfeFunctions, /updateMdfe\(tenantId, mdfeId, \{ cStat: result\.cStat, xMotivo: result\.xMotivo, protocolo: result\.nProt/, 'consulta não sobrescreve cStat/xMotivo do documento');
  assert.match(mdfeFunctions, /cancelado: situacao === 'cancelado',/);
});

test('backend: consulta NF-e usa first + detecta cancelamento no procEventoNFe', () => {
  assert.match(nfFunctions, /parseSefazResponse\(resp\.body, \['100', '150'\], \{ first: true \}\)/);
  assert.match(nfFunctions, /const temEventoCancelamento = \['110111'\]\.includes\(extrairConteudoTag\(bodyConsulta, 'tpEvento'\)\);/);
  assert.match(nfFunctions, /const cancelada = temEventoCancelamento && \['135', '155', '101'\]\.includes\(cStatEventoCancel\);/);
  assert.match(nfFunctions, /cancelada,\s*\n\s*situacao,/);
});

function loadTagHelpers() {
  const wanted = ['extrairConteudoTag', 'extrairBlocoTag'];
  const context = {};
  for (const name of wanted) {
    const match = nfFunctions.match(new RegExp(`function ${name}\\(body, localName\\) \\{[\\s\\S]*?\\n\\}`));
    assert.ok(match, `${name} não encontrada`);
    vm.runInNewContext(`${match[0]}; this.${name} = ${name};`, context);
  }
  return context;
}

test('extrairConteudoTag: prefixo ns, xmlns e tag lisa', () => {
  const { extrairConteudoTag, extrairBlocoTag } = loadTagHelpers();
  assert.equal(extrairConteudoTag('<tpEvento>110112</tpEvento>', 'tpEvento'), '110112');
  assert.equal(extrairConteudoTag('<ns2:tpEvento>110112</ns2:tpEvento>', 'tpEvento'), '110112');
  assert.equal(extrairConteudoTag('<tpEvento xmlns="http://www.portalfiscal.inf.br/mdfe">110111</tpEvento>', 'tpEvento'), '110111');
  assert.equal(extrairConteudoTag('<outra>1</outra>', 'tpEvento'), '');
  assert.equal(extrairConteudoTag('', 'tpEvento'), '');
  const bloco = extrairBlocoTag(
    '<retConsSitMDFe><ns:retEventoMDFe><infEvento><cStat>135</cStat></infEvento></ns:retEventoMDFe></retConsSitMDFe>',
    'retEventoMDFe',
  );
  assert.equal(extrairConteudoTag(bloco, 'cStat'), '135');
});

test('cliente MDF-e: feedback de execução + Situação real (não o cStat do evento)', () => {
  assert.match(mdfeJs, /mdfeMostrarAlerta\('⏳ Consultando o MDF-e na SEFAZ — aguardando retorno\.\.\.', 'warn'\)/);
  assert.match(mdfeJs, /SiswebLoading\.show\('Consultando o MDF-e na SEFAZ\.\.\.'\)/);
  assert.match(mdfeJs, /encerrado: 'ENCERRADO \(evento 110112 registrado na SEFAZ\)'/);
  assert.match(mdfeJs, /CANCELADO \(evento 110111 registrado na SEFAZ\)'/);
  assert.match(mdfeJs, /mdfe\.ultimaConsultaSefaz = result\?\.ultimaConsultaSefaz/);
  assert.doesNotMatch(mdfeJs, /mdfe\.cStat = result\?\.cStat/, 'consulta não pode poluir o cStat do documento');
  assert.match(mdfeJs, /MDF-e Nº \$\{mdfe\.numero \|\| ''\} — Consulta SEFAZ: cStat \$\{result\?\.cStat \|\| '\?'\} — \$\{result\?\.xMotivo \|\| 'sem motivo'\}\\nSituação real: \$\{situacaoTxt\}/);
});

test('consulta NF-e: operation/method exatos do catálogo SVRS (NFeConsultaProtocolo4/nfeConsultaNF)', () => {
  // Fonte: NFePHP sped-nfe storage/wsnfe_4.00_mod55.xml (bloco SVRS).
  // Antes usávamos .../NfeConsultaProtocolo4/nfeConsulta → SOAP Fault
  // "action not recognized" (consulta quebrada em produção).
  assert.match(nfFunctions, /NfeConsultaProtocolo4: 'nfeConsultaNF', \/\/ catálogo NFePHP wsnfe \(SVRS\): method=nfeConsultaNF/);
  assert.match(nfFunctions, /const SOAP_ACTION_NS = \{\s*\n\s*NfeConsultaProtocolo4: 'NFeConsultaProtocolo4',\s*\n\};/);
  assert.match(nfFunctions, /const ns = SOAP_ACTION_NS\[servico\] \|\| servico;/);
  assert.match(nfFunctions, /const ns = SOAP_ACTION_NS\[servico\] \|\| servico;\n  return method \? `http:\/\/www\.portalfiscal\.inf\.br\/nfe\/wsdl\/\$\{ns\}\/\$\{method\}` : '';/);
});

test('cliente NF-e: banner global acima das abas (visível também na Consulta)', () => {
  const ocorrencias = (html.match(/id="emissaoAlerta"/g) || []).length;
  assert.equal(ocorrencias, 1, 'alerta global único (sem duplicar)');
  assert.ok(
    html.indexOf('id="emissaoAlerta"') < html.indexOf('id="emissao"'),
    'banner fora/antes da aba Emissão — antes ficava dentro e a Consulta não o exibia',
  );
});

test('cliente NF-e: banner do topo com a verdade (persistente) + cancelada prevalece', () => {
  assert.match(html, /mostrarAlertaEmissao\('⏳ Consultando a NF-e na SEFAZ — aguardando retorno\.\.\.', 'warn'\)/);
  assert.match(html, /mostrarAlertaEmissao\(`NF-e \$\{nf\.numero \|\| ''\} — Consulta SEFAZ: cStat \$\{cStat\} — \$\{motivo\}\\nSituação real: \$\{situacaoTxt\}/);
  assert.match(html, /CANCELADA \(evento 110111 registrado na SEFAZ\)/);
  assert.match(html, /status: 'cancelada',\s*\n\s*cStatCancelamento: res\.cStatEventoCancelamento \|\| cStat,/);
  assert.match(html, /white-space:pre-line;\$\{estilos\[tipo\]\|\|estilos\.erro\}/);
});
