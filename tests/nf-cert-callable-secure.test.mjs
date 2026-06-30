import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `bloco ${startMarker} precisa existir`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `fim ${endMarker} precisa existir`);
  return source.slice(start, end);
}

test('cliente de certificado A1 usa callable segura e nao grava Storage/DB direto', () => {
  const source = read('nf-cert.js');
  const upload = blockBetween(source, 'async function uploadCertificadoA1', 'async function carregarPFXDescriptografado');
  const pfxRead = blockBetween(source, 'async function carregarPFXDescriptografado', 'async function carregarMetadados');
  const metadata = blockBetween(source, 'async function carregarMetadados', 'async function salvarReferenciaCertificado');
  const saveReference = blockBetween(source, 'async function salvarReferenciaCertificado', 'function verificarStatusCertificado');
  const token = blockBetween(source, 'async function salvarReferenciaA3Token', '// ─── Configurar certificado A3 Nuvem');
  const remove = blockBetween(source, 'async function removerCertificado', 'return {');

  assert.match(source, /const MAX_A1_FILE_SIZE = 5 \* 1024 \* 1024;/);
  assert.match(source, /async function aguardarFirebaseServiceCallable\(timeoutMs = 7000\)/);
  assert.match(source, /const svc = await aguardarFirebaseServiceCallable\(\);/);
  assert.match(source, /return svc\.callFunction\(nome, dados\);/);
  assert.doesNotMatch(source, /window\.firebase\.functions\(\)\.httpsCallable/);
  assert.match(source, /function arrayBufferToBase64\(buffer\)/);
  assert.match(upload, /const encryptedPfxBase64 = arrayBufferToBase64\(encrypted\);/);
  assert.match(upload, /chamarCloudFunction\('nf_uploadCertificadoA1', \{/);
  assert.match(upload, /originalFileName: pfxFile\.name \|\| ''/);
  assert.doesNotMatch(upload, /storageService\.upload/);
  assert.doesNotMatch(upload, /saveToFirebase\(/);
  assert.match(pfxRead, /throw new Error\('Leitura local do certificado A1 não é suportada; a assinatura ocorre no backend seguro\.'/);
  assert.doesNotMatch(pfxRead, /loadFromFirebase\(/);
  assert.match(metadata, /const directMeta = await carregarMetadadosDireto\(tenantId\);/);
  assert.match(metadata, /svc\.loadFromFirebase\(`companies\/\$\{tenantId\}\/fiscal\/certificado`\)/);
  assert.match(metadata, /return successfulRead \? \{ status: 'missing', data: null \} : \{ status: 'unavailable', data: null \};/);
  assert.match(metadata, /if \(directMeta && directMeta\.status === 'found'\) return directMeta\.data;/);
  assert.match(metadata, /if \(directMeta && directMeta\.status === 'missing'\) return null;/);
  assert.match(metadata, /chamarCloudFunction\('nf_obterResumoCertificadoFiscal', \{ tenantId \}\)/);
  assert.match(saveReference, /chamarCloudFunction\('nf_salvarReferenciaCertificado', \{/);
  assert.match(token, /return salvarReferenciaCertificado\(tenantId, payload\);/);
  assert.doesNotMatch(token, /saveToFirebase\(/);
  assert.match(remove, /await chamarCloudFunction\('nf_removerCertificado', \{ tenantId \}\);/);
  assert.doesNotMatch(remove, /removeFromFirebase\(/);
});

test('backend de certificado A1 usa metadado canonico e uploadedBy para descriptografia compartilhada', () => {
  const source = read('functions/nf-functions.js');
  const decrypt = blockBetween(source, 'async function descriptografarPFXdoStorage', '// ─── Assinar XML com RSA-SHA1');
  const certRead = blockBetween(source, 'exports.nf_obterResumoCertificadoFiscal', 'exports.nf_obterConfiguracaoFiscal');
  const configRead = source.slice(source.indexOf('exports.nf_obterConfiguracaoFiscal'));

  assert.match(source, /function onFiscalCall\(handler\)/);
  assert.match(source, /const isV2CallableRequest = requestOrData/);
  assert.match(source, /const data = isV2CallableRequest \? requestOrData\.data : requestOrData;/);
  assert.match(source, /const context = isV2CallableRequest \? requestOrData : maybeContext;/);
  assert.match(source, /function getCertificateMetadataRefs\(db, tenantId\)/);
  assert.match(source, /db\.ref\(`companies\/\$\{tenantId\}\/fiscal\/certificado`\)/);
  assert.match(source, /db\.ref\(`tenants\/\$\{tenantId\}\/config-fiscal\/certificado`\)/);
  assert.match(source, /exports\.nf_uploadCertificadoA1 = onFiscalCall/);
  assert.match(source, /exports\.nf_salvarReferenciaCertificado = onFiscalCall/);
  assert.match(source, /exports\.nf_obterResumoCertificadoFiscal = onFiscalCall/);
  assert.match(source, /exports\.nf_obterConfiguracaoFiscal = onFiscalCall/);
  assert.match(source, /function buildCertificatePublicSummary\(meta, tenantId\)/);
  assert.match(decrypt, /const meta = await loadCertificateMetadata\(db, tenantId\);/);
  assert.match(decrypt, /const storageRef = sanitizeTenantCertificateStorageRef\(meta\.storageRef \|\| meta\.path \|\| meta\.filePath, tenantId\);/);
  assert.match(decrypt, /const keyOwnerUid = String\(meta\.uploadedBy \|\| uid \|\| ''\)\.trim\(\);/);
  assert.match(certRead, /const tenantId = sanitizePathSegment\(rawTenantId, 'tenantId'\)/);
  assert.match(certRead, /await assertTenantAccess\(context, tenantId\)/);
  assert.match(certRead, /meta: buildCertificatePublicSummary\(meta, tenantId\)/);
  assert.doesNotMatch(certRead, /pfxEnc/);
  assert.match(configRead, /const tenantId = sanitizePathSegment\(rawTenantId, 'tenantId'\)/);
  assert.match(configRead, /await assertTenantAccess\(context, tenantId\)/);
  assert.match(configRead, /const config = await loadFiscalConfig\(db, tenantId\);/);
});
