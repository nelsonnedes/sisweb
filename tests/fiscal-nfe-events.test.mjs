import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('backend exporta CC-e e inutilizacao NF-e reais', () => {
  const functionsIndex = read('functions/index.js');
  const nfFunctions = read('functions/nf-functions.js');

  assert.match(functionsIndex, /exports\.nf_cartaCorrecaoNFe\s*=\s*nfFunctions\.nf_cartaCorrecaoNFe/);
  assert.match(functionsIndex, /exports\.nf_inutilizarNumeracao\s*=\s*nfFunctions\.nf_inutilizarNumeracao/);
  assert.match(nfFunctions, /exports\.nf_cartaCorrecaoNFe\s*=\s*onFiscalCall/);
  assert.match(nfFunctions, /exports\.nf_inutilizarNumeracao\s*=\s*onFiscalCall/);
});

test('eventos fiscais sao assinados e enviados aos servicos SEFAZ corretos', () => {
  const nfFunctions = read('functions/nf-functions.js');

  assert.match(nfFunctions, /tpEvento>110110<\/tpEvento>/);
  assert.match(nfFunctions, /xCondUso>\$\{escapeXml\(CCE_COND_USO\)\}<\/xCondUso>/);
  assert.match(nfFunctions, /assinarXMLcomForge\(eventoXml, pfxBuffer, senhaA1, \{ tagName: 'infEvento', idPrefix: 'ID' \}\)/);
  assert.match(nfFunctions, /getEndpoint\('NFeRecepcaoEvento4', env\)/);
  assert.match(nfFunctions, /parseSefazResponse\(resp\.body, \['135', '136'\]\)/);
});

test('inutilizacao monta infInut assinado, valida faixa local e persiste auditoria', () => {
  const nfFunctions = read('functions/nf-functions.js');

  assert.match(nfFunctions, /<infInut Id="\$\{idInut\}">/);
  assert.match(nfFunctions, /<xServ>INUTILIZAR<\/xServ>/);
  assert.match(nfFunctions, /await assertNoLocalAuthorizedNumberInRange\(db, tenantId, modKey, serie, numeroInicial, numeroFinal\)/);
  assert.match(nfFunctions, /assinarXMLcomForge\(inutXml, pfxBuffer, senhaA1, \{ tagName: 'infInut', idPrefix: 'ID' \}\)/);
  assert.match(nfFunctions, /getEndpoint\('NFeInutilizacao4', env\)/);
  assert.match(nfFunctions, /parseSefazResponse\(resp\.body, \['102'\]\)/);
  assert.match(nfFunctions, /companies\/\$\{tenantId\}\/fiscal\/notas\/inutilizacoes\/\$\{recordId\}/);
});

test('endpoints SEFAZ homologacao usam o host correto (nfe-homologacao)', () => {
  const nfFunctions = read('functions/nf-functions.js');
  assert.doesNotMatch(nfFunctions, /homologacao\.nfe\.svrs\.rs\.gov\.br/, 'host inexistente derruba a consulta (getaddrinfo ENOTFOUND)');
  assert.match(nfFunctions, /https:\/\/nfe-homologacao\.svrs\.rs\.gov\.br\/ws\/NfeAutorizacao\/NFeAutorizacao4\.asmx/);
  assert.match(nfFunctions, /https:\/\/nfe-homologacao\.svrs\.rs\.gov\.br\/ws\/NfeRetAutorizacao\/NFeRetAutorizacao4\.asmx/);
  assert.match(nfFunctions, /https:\/\/nfe-homologacao\.svrs\.rs\.gov\.br\/ws\/NfeConsulta\/NfeConsulta4\.asmx/);
});

test('assinatura usa forma canônica (C14N): xmlns explícito + entidades de texto', () => {
  const nfFunctions = read('functions/nf-functions.js');
  // O digest deve cobrir o xmlns herdado (que o bruto não tem) e expandir
  // &quot;/&apos;/&gt; como o C14N faz — senão SEFAZ retorna 297.
  // Porém o ENVIADO não pode ter xmlns redundante (cStat 587) — usa-se sentForm.
  assert.match(nfFunctions, /xmlns="http:\/\/www\.portalfiscal\.inf\.br\/nfe"/, 'forma do digest com xmlns explícito');
  assert.match(nfFunctions, /sentForm/, 'forma enviada sem xmlns redundante');
  assert.match(nfFunctions, /hashForm/, 'forma do digest (canônica)');
  assert.match(nfFunctions, /replace\(\/&quot;\/g/, 'expande &quot; (C14N usa " literal)');
  assert.match(nfFunctions, /replace\(\/&apos;\/g/, 'expande &apos; (C14N usa \' literal)');
  assert.match(nfFunctions, /replace\(\/&gt;\/g/, 'expande &gt; (C14N usa > literal)');
  assert.match(nfFunctions, /replace\(signedElementMatch\[0\], \(\) =>/, 'injeção sem interpretar $');
  assert.match(nfFunctions, /leafCert/, 'KeyInfo com o certificado-FOLHA (casa com a chave)');
  // SignedInfo SEM self-closing: o C14N expande <x/> para <x></x> e o bruto divergiria (RSA → 297).
  assert.doesNotMatch(nfFunctions, /<CanonicalizationMethod[^>]*\/>/, 'SignedInfo sem self-closing (CanonicalizationMethod)');
  assert.doesNotMatch(nfFunctions, /<SignatureMethod[^>]*\/>/, 'SignedInfo sem self-closing (SignatureMethod)');
  assert.doesNotMatch(nfFunctions, /<Transform[^>]*\/>/, 'SignedInfo sem self-closing (Transform)');
  assert.doesNotMatch(nfFunctions, /<DigestMethod[^>]*\/>/, 'SignedInfo sem self-closing (DigestMethod)');
});
