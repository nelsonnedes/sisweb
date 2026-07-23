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

test('company.html usa Function para salvar perfil de empresa sem writes diretos de tenant', () => {
  const page = read('company.html');
  const srcService = read('src/services/firebaseService.js');

  assert.match(page, /src\/services\/firebaseService\.js\?v=[^"'\s]+/);
  assert.match(page, /auth\.js\?v=[^"'\s]+/);
  assert.match(page, /id="companyContextName"/);
  assert.match(page, /id="companyContextId"/);
  assert.match(page, /id="companySecurityNotice"/);
  assert.match(page, /typeof window\.firebaseService\.updateMyCompanyProfile !== 'function'/);
  assert.match(page, /await window\.firebaseService\.updateMyCompanyProfile\(profilePayload\)/);
  assert.doesNotMatch(page, /saveToFirebase\(`companies\/\$\{profileCompanyId\}\/profile`/);
  assert.doesNotMatch(page, /updateFirebase\(`users\/\$\{uid\}`/);
  assert.doesNotMatch(page, /saveData\(`companies\/\$\{window\.appTenantId\}\/users\/\$\{uid\}`/);
  assert.doesNotMatch(page, /saveData\(`roles\/\$\{uid\}`/);

  assert.match(srcService, /async function callFunction\(functionName, payload = \{\}\)/);
  assert.match(srcService, /async function updateMyCompanyProfile\(payload\)/);
  assert.match(srcService, /callFunction\('updateMyCompanyProfile', data\)/);
  assert.match(srcService, /async function createCompanyOnboarding\(companyPayload\)/);
  assert.match(srcService, /updateMyCompanyProfile,/);
});

test('logo de perfil da empresa continua isolada por tenant sem depender da assinatura', () => {
  const storageRules = read('storage.rules');
  const logoBlock = blockBetween(
    storageRules,
    'match /companies/{companyId}/profile/logo/{fileName}',
    '// ANEXOS DE TICKETS DE SUPORTE'
  );

  assert.match(logoBlock, /allow read: if true/);
  assert.match(logoBlock, /request\.auth\.token\.companyId == companyId/);
  assert.match(logoBlock, /request\.auth\.token\.companyID == companyId/);
  assert.match(logoBlock, /request\.auth\.token\.tenantId == companyId/);
  assert.match(logoBlock, /request\.resource\.size < 2 \* 1024 \* 1024/);
  assert.match(logoBlock, /request\.resource\.contentType\.matches\('image\/\.\*'\)/);
  assert.doesNotMatch(logoBlock, /subscriptionStatus/);
});

test('sincronizacao global nao tenta ler systemConfig legado sem necessidade', () => {
  const databaseUtils = read('database-utils.js');
  const syncAllBlock = blockBetween(
    databaseUtils,
    'async function syncAllData()',
    'function ensureDataCompatibility()'
  );

  assert.match(syncAllBlock, /'companies'/);
  assert.doesNotMatch(syncAllBlock, /'systemConfig'/);
  assert.doesNotMatch(syncAllBlock, /'financas\/pagar'/);
  assert.doesNotMatch(syncAllBlock, /'financas\/receber'/);
  assert.match(databaseUtils, /const SERVER_AUTHORITATIVE_SYNC_KEYS = new Set\(\[[\s\S]*'financas\/pagar',[\s\S]*'financas\/receber'/);
  assert.match(databaseUtils, /if \(firebaseLoadFailed\) return false;/);
  assert.match(databaseUtils, /if \(!saveResult \|\| saveResult\.success !== true\) return false;/);
});

test('company.html normaliza empresas legadas e renderiza cards responsivos sem acoes perigosas', () => {
  const page = read('company.html');
  const displayBlock = blockBetween(
    page,
    'async function displayCompaniesOnPage()',
    'async function selectCompany(companyId)'
  );

  assert.match(page, /const normalizeCompanyRecord = function\(company, fallbackId\)/);
  assert.match(page, /const extractLegacyCompanyNode = function\(source\)/);
  assert.match(page, /Object\.entries\(raw\)/);
  assert.match(page, /\.company-hero\s*\{[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(page, /\.company-context-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(page, /\.company-cards-grid/);
  assert.match(page, /\.company-card\.is-incomplete/);
  assert.match(page, /formatCompanyCnpjDisplay\(company\.cnpj\)/);
  assert.match(page, /formatCompanyPhoneDisplay\(company\.phone\)/);
  assert.match(page, /<strong>CNPJ<\/strong>/);
  assert.match(page, /escapeHtml\(displayName\)/);
  assert.match(displayBlock, /Gerencie pelo Admin/);
  assert.match(displayBlock, /Editar perfil/);
  assert.doesNotMatch(displayBlock, /Selecionar/);
  assert.doesNotMatch(displayBlock, /deleteCompany\('/);
});

test('company.html imprime perfil da empresa com georeferenciamento e QR de navegacao', () => {
  const page = read('company.html');
  const firebaseJson = read('firebase.json');

  assert.match(page, /commerce-pdf-share\.js\?v=[^"'\s]+/);
  assert.match(page, /qrcodejs\/1\.0\.0\/qrcode\.min\.js/);
  assert.match(page, /id="geoLatitude"/);
  assert.match(page, /id="geoLongitude"/);
  assert.match(page, /id="btnLocateCompany"/);
  assert.match(page, /id="btnPrintCompany"/);
  assert.match(page, /function buildCompanyNavigationUrl\(latitude, longitude\)/);
  assert.match(page, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(page, /new window\.QRCode\(holder,/);
  assert.match(page, /function printCompanyReport\(\)/);
  assert.match(page, /readCompanyGeoFromForm\(\{ silent: false \}\)/);
  assert.match(page, /\.\.\.geoPayload/);
  assert.match(page, /https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/);
  assert.match(page, /<strong>Georeferenciamento<\/strong>/);
  assert.match(firebaseJson, /geolocation=\(self\)/);
});

test('updateMyCompanyProfile sanitiza e preserva coordenadas da empresa', () => {
  const functionsIndex = read('functions/index.js');
  const srcService = read('src/services/firebaseService.js');

  assert.match(functionsIndex, /function sanitizeCompanyGeolocationPayload\(payload = \{\}, current = \{\}\)/);
  assert.match(functionsIndex, /sanitizeGeoCoordinateText\(rawLatitude, -90, 90\)/);
  assert.match(functionsIndex, /sanitizeGeoCoordinateText\(rawLongitude, -180, 180\)/);
  assert.match(functionsIndex, /Coordenadas geográficas inválidas/);
  assert.match(functionsIndex, /const geoProfilePayload = sanitizeCompanyGeolocationPayload\(payload, current\)/);
  assert.match(functionsIndex, /\.\.\.geoProfilePayload/);
  assert.match(functionsIndex, /navigationUrl: mapUrl/);
  assert.match(functionsIndex, /geolocation: \{/);

  assert.match(srcService, /const defaultNavigationUrl = latitude && longitude/);
  assert.match(srcService, /geoLatitude: latitude/);
  assert.match(srcService, /navigationUrl/);
});

test('company.html preserva edicao apos falha e nao envia logo para tenant Date.now', () => {
  const page = read('company.html');
  const saveBlock = blockBetween(
    page,
    'async function saveCompany()',
    '// ✅ FUNÇÃO showCompanyList CORRIGIDA COM LOGO'
  );

  assert.match(saveBlock, /const resolvedFormCompanyId = String\(/);
  assert.match(saveBlock, /window\.appTenantId/);
  assert.match(saveBlock, /window\.companyInfo && \(window\.companyInfo\.companyId/);
  assert.match(saveBlock, /const draftCompanyId = window\.__companyOnboardingMode[\s\S]*: resolvedFormCompanyId/);
  assert.match(saveBlock, /uploadLogoToFirebase\(logoFile, draftCompanyId, existingLogoPayload\)/);
  assert.match(saveBlock, /restoreCompanySaveButton\(\)/);
  assert.match(saveBlock, /Somente um admin da empresa pode alterar o perfil/);
  assert.doesNotMatch(saveBlock, /editingId = null;\s*document\.getElementById\('saveBtn'\)\.textContent = 'Salvar Empresa'/);
  assert.match(saveBlock, /effectiveCompany = savedProfile;[\s\S]*editingId = null;/);
});

test('updateMyCompanyProfile permite somente conta primaria marcada por ownerUid', () => {
  const source = read('functions/index.js');
  const accessBlock = blockBetween(
    source,
    'async function assertCompanyProfileWriteAccess(context, companyId, userData, token)',
    'function buildMirrorUserPatch'
  );

  assert.match(source, /function isPrimaryCompanyAccountForProfile\(uid, tenant, userData, companyData\)/);
  assert.match(source, /return !!ownerUid && ownerUid === uid/);
  assert.doesNotMatch(source, /authEmail === companyEmail/);
  assert.doesNotMatch(source, /profile\.ownerUid/);
  assert.doesNotMatch(accessBlock, /profileData\.createdBy/);
  assert.match(accessBlock, /const primaryCompanyAccount = isPrimaryCompanyAccountForProfile\(uid, tenant, userData, companyData\)/);
  assert.match(accessBlock, /\|\| primaryCompanyAccount/);
  assert.doesNotMatch(accessBlock, /subscriptionStatus\s*={0,3}\s*'active'/);
});
