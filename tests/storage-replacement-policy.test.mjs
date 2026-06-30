import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('company logos use a canonical tenant path and clean replaced legacy objects', () => {
  const firebaseService = read('firebaseService.js');
  const companyHtml = read('company.html');
  const adminMain = read('scripts/admin/admin-main.js');

  const uploadCompanyLogoBody = firebaseService.match(/async function uploadCompanyLogo[\s\S]*?async function extendSubscriptionAccess/)[0];

  assert.match(uploadCompanyLogoBody, /companies\/\$\{tenant\}\/profile\/logo\/current/);
  assert.match(uploadCompanyLogoBody, /previousStoragePath/);
  assert.match(uploadCompanyLogoBody, /extractFirebaseStoragePathFromUrl\(previousRaw\)/);
  assert.match(uploadCompanyLogoBody, /deleteStorageFile\(previousPath\)/);
  assert.match(uploadCompanyLogoBody, /previousPath\.startsWith\(logoPrefix\)/);
  assert.doesNotMatch(uploadCompanyLogoBody, /profile\/logo\/\$\{Date\.now\(\)\}/);

  assert.match(firebaseService, /extractStoragePathFromUrl: extractFirebaseStoragePathFromUrl/);
  assert.match(companyHtml, /uploadLogoToFirebase\(logoFile, draftCompanyId, existingLogoPayload\)/);
  assert.match(companyHtml, /previousLogoPath/);
  assert.match(companyHtml, /extractStoragePathFromUrl/);
  assert.match(adminMain, /previousStoragePath: currentLogoPayload\.logoStoragePath/);
});

test('finance storage keeps append for new attachments and replace for substitutions', () => {
  const storageService = read('storageService.js');
  const financas = read('financas.js');

  assert.match(storageService, /function _extractStoragePathFromUrl/);
  assert.match(storageService, /function _resolveReplaceStoragePath\(path\)/);
  assert.match(storageService, /const replacePath = _resolveReplaceStoragePath\(options\.replaceStoragePath \|\| options\.previousStoragePath \|\| ''\)/);
  assert.match(storageService, /const safePath = replacePath \|\| `companies\/\$\{tenantId\}\/\$\{relativePath\}_\$\{Date\.now\(\)\}_\$\{safeFileName\}`/);
  assert.match(storageService, /storageMode: replacePath \? 'replace' : 'append'/);
  assert.match(storageService, /async uploadAttachment\(file, path, extra = \{\}, options = \{\}\)/);

  assert.match(financas, /async function uploadAttachmentMetaForConta\(file, tipo, contaId, uploadOptions = \{\}\)/);
  assert.match(financas, /async function uploadFinanceStorageMeta\(file, path, extra = \{\}, uploadOptions = \{\}\)/);
  assert.match(financas, /const previousStoragePath = resolveAttachmentStoragePath\(target\)/);
  assert.match(financas, /replaceStoragePath: previousStoragePath/);
  assert.match(financas, /await window\.firebaseService\.saveToFirebase\(base, String\(conta\.id\), conta\);[\s\S]*deleteStorageFileSafely\(previousStoragePath, target\.url\)/);
  assert.match(financas, /const previous = resolveHistoricoPagamento\(conta, registroRef\);[\s\S]*replaceStoragePath: previousStoragePath/);
  assert.match(financas, /await salvarContaFinanceiraPersistida\(conta, tipo\);[\s\S]*deleteStorageFileSafely\(previousStoragePath \|\| previous\.storagePath, previous\.url\)/);
  assert.match(financas, /catch\(_\) \{[\s\S]*mostrarNotificacao\('Falha ao salvar no banco online\. Verifique conexão\.', 'warning'\);[\s\S]*return;/);
});

