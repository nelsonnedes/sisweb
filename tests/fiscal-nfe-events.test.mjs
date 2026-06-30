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
