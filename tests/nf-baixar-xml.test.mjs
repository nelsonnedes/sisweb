import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// nf_baixarXML: fallback backend (Admin SDK) quando o download direto falha (CORS/regras).
const fn = fs.readFileSync('functions/nf-functions.js', 'utf8');
const idx = fs.readFileSync('functions/index.js', 'utf8');
const html = fs.readFileSync('notas-fiscais.html', 'utf8');

test('callable nf_baixarXML existe e é exportado', () => {
  assert.match(fn, /exports\.nf_baixarXML = onFiscalCall/, 'callable registrado');
  assert.match(idx, /exports\.nf_baixarXML\s+= nfFunctions\.nf_baixarXML/, 'exportado no index');
});

test('nf_baixarXML exige auth + vínculo e lê via Admin SDK', () => {
  const body = fn.split('exports.nf_baixarXML')[1].split('CLOUD FUNCTION 4')[0];
  assert.match(body, /if \(!context\.auth\)/, 'exige autenticação');
  assert.match(body, /assertTenantAccess\(context, tenantId\)/, 'checa vínculo com tenant');
  assert.match(body, /admin\.storage\(\)\.bucket\(\)/, 'lê via Admin SDK (imune a CORS/regras)');
  assert.match(body, /xmlProcStoragePath/, 'prefere nfeProc');
  assert.match(body, /xmlBase64/, 'retorna base64');
  assert.match(body, /startsWith\('companies\/'\)/, 'restringe paths ao tenant');
});

test('frontend tenta direto e cai para nf_baixarXML', () => {
  assert.match(html, /callFunction\('nf_baixarXML'/, 'fallback via callable');
  assert.match(html, /viaServidor \? '⬇️ XML autorizado baixado \(via servidor\)'/, 'toast indica via servidor');
});
