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

test('rules nao expoem pagamentos ou system para qualquer autenticado', () => {
  const rules = JSON.parse(read('database.rules.json')).rules;

  assert.equal(rules.subscriptionPayments['.read'], 'auth != null && auth.token.superadmin == true');
  assert.equal(rules.system['.read'], 'auth != null && auth.token.superadmin == true');
  assert.equal(rules.system['.write'], false);
  assert.match(rules.subscriptionPayments.$paymentId['.read'], /data\.child\('uid'\)\.val\(\) == auth\.uid/);
  assert.match(rules.subscriptionPayments.$paymentId['.read'], /data\.child\('companyId'\)\.val\(\) == root\.child\('users\/' \+ auth\.uid \+ '\/companyId'\)\.val\(\)/);
});

test('rules nao permitem escrita herdada no tenant nem solicitacao direta de assinatura', () => {
  const rules = JSON.parse(read('database.rules.json')).rules;
  const tenantRules = rules.companies.$companyId;

  assert.equal(tenantRules['.write'], false);
  assert.equal(tenantRules['.read'], 'auth != null && auth.token.superadmin == true');
  assert.match(tenantRules.profile['.read'], /root\.child\('companies\/' \+ \$companyId \+ '\/users\/' \+ auth\.uid\)\.exists\(\)/);
  assert.equal(tenantRules.profile['.write'], 'auth != null && auth.token.superadmin == true');
  assert.match(tenantRules.financas['.read'], /permissions\/finance\/read/);
  assert.match(tenantRules.financas['.read'], /adminActive'\)\.val\(\) != false/);
  assert.match(tenantRules.financas['.read'], /ownerUid'\)\.val\(\) == auth\.uid/);
  assert.doesNotMatch(tenantRules.financas['.read'], /profile\/email/);
  assert.match(tenantRules.financas['.read'], /users\/' \+ auth\.uid \+ '\/companyId'\)\.val\(\) == \$companyId/);
  assert.match(tenantRules.financas.receber.$month.$accountId['.write'], /ownerUid'\)\.val\(\) == auth\.uid/);
  assert.match(tenantRules.financas.pagar.$month.$accountId['.write'], /subscriptionStatus'\)\.val\(\) == 'active'/);
  assert.match(tenantRules.printPreferences['.write'], /ownerUid'\)\.val\(\) == auth\.uid/);
  assert.match(tenantRules.finance_snapshots['.write'], /ownerUid'\)\.val\(\) == auth\.uid/);
  assert.doesNotMatch(JSON.stringify(tenantRules.financas), /profile\/email/);

  for (const child of ['admin', 'adminSettings', 'roles', 'permissions', 'access', 'accessGovernance', 'system', 'settings']) {
    assert.match(tenantRules[child]['.write'], /auth\.token\.superadmin == true/);
  }

  assert.equal(rules.subscriptionRequests.$uid['.write'], false);
});

test('rules liberam apenas caminhos operacionais seguros apos bloquear escrita herdada do tenant', () => {
  const rules = JSON.parse(read('database.rules.json')).rules;
  const tenantRules = rules.companies.$companyId;

  assert.equal(tenantRules['.write'], false);

  for (const child of ['printPreferences', 'finance_snapshots', 'sequences']) {
    assert.ok(tenantRules[child], `${child} precisa ter regra propria`);
    assert.match(tenantRules[child]['.read'], /auth\.token\.companyID == \$companyId/);
    assert.match(tenantRules[child]['.read'], /root\.child\('companies\/' \+ \$companyId \+ '\/users\/' \+ auth\.uid\)\.exists\(\)/);
    assert.match(tenantRules[child]['.read'], /permissions\/finance\/read/);
  }

  assert.match(tenantRules.printPreferences['.write'], /auth\.token\.tenantId == \$companyId/);
  assert.doesNotMatch(tenantRules.printPreferences['.write'], /subscriptionStatus == 'active'/);
  assert.match(tenantRules.printPreferences['.write'], /permissions\/finance\/write/);
  assert.doesNotMatch(tenantRules.printPreferences['.write'], /permissions\/finance\/read/);

  assert.match(tenantRules.finance_snapshots['.write'], /root\.child\('companies\/' \+ \$companyId \+ '\/users\/' \+ auth\.uid\)\.exists\(\)/);
  assert.match(tenantRules.finance_snapshots['.write'], /subscriptionStatus'\)\.val\(\) == 'trial_active'/);
  assert.match(tenantRules.finance_snapshots['.write'], /permissions\/finance\/write/);
  assert.equal(tenantRules.sequences['.write'], 'auth != null && auth.token.superadmin == true');

  for (const type of ['receber', 'pagar']) {
    const accountWrite = tenantRules.financas[type].$month.$accountId['.write'];
    const accountValidate = tenantRules.financas[type].$month.$accountId['.validate'];
    assert.match(accountWrite, /!data\.exists\(\)/);
    assert.match(accountWrite, /!data\.hasChild\('historicosPagamento'\)/);
    assert.match(accountWrite, /data\.child\('valorPago'\)\.val\(\) == 0/);
    assert.match(accountWrite, /permissions\/finance\/write/);
    assert.match(accountValidate, /newData\.child\('id'\)\.val\(\) == \$accountId/);
    assert.match(accountValidate, /newData\.child\('valorOriginal'\)\.val\(\) == newData\.child\('valor'\)\.val\(\)/);
    assert.match(accountValidate, /!newData\.hasChild\('anexos'\)/);
  }
});

test('modulos operacionais exigem membership ao escrever (brecha fechada)', () => {
  const rules = JSON.parse(read('database.rules.json')).rules;
  const tenantRules = rules.companies.$companyId;

  const operationalWrites = [
    'clients',
    'fornecedores',
    'produtos',
    'especies',
    'estoqueTorasAtual',
    'movimentacoesToras',
    'rastreabilidade',
    'funcionarios',
    'folhas',
    'cargos',
    'configuracoes',
    'fiscal',
    'preferences',
  ];

  for (const name of operationalWrites) {
    assert.ok(tenantRules[name], `nó ${name} precisa existir`);
    const w = tenantRules[name]['.write'];
    assert.match(w, /auth\.token\.superadmin == true/, `${name} deve permitir bypass superadmin`);
    assert.match(w, /root\.child\('companies\/' \+ \$companyId \+ '\/users\/' \+ auth\.uid\)\.exists\(\)/, `${name} deve exigir membership`);
  }
});

test('SuperAdmin em Functions depende de allowlist e nao de marcador em RTDB', () => {
  const source = read('functions/index.js');
  const isCallerBlock = blockBetween(source, 'async function isCallerSuperAdmin', 'async function assertSuperAdmin');
  const syncBlock = blockBetween(source, 'exports.syncMyAdminClaims', 'exports.auditAdminClaimsInconsistencies');
  const ensureBlock = blockBetween(source, 'async function ensureSuperAdminClaimIfAllowed', 'async function isDbMarkedSuperAdmin');
  const auditBlock = blockBetween(source, 'exports.auditAdminClaimsInconsistencies', 'exports.setUserAccessStatus');

  assert.match(ensureBlock, /if \(!isSuperAdminEmail\(email\) && !isSuperAdminUidAllowed\(uid\)\) return false/);
  assert.match(isCallerBlock, /token\.superadmin === true && isSuperAdminUidAllowed\(uid\)/);
  assert.doesNotMatch(isCallerBlock, /token\.superadmin === true && !isSuperAdminUidAllowed\(uid\)/);
  assert.doesNotMatch(isCallerBlock, /isDbMarkedSuperAdmin/);
  assert.match(auditBlock, /hasSuperadmin && !isGlobalAllowlisted/);
  assert.match(auditBlock, /superadmin=true fora da allowlist global/);
  assert.doesNotMatch(syncBlock, /source: 'db_marker'/);
  assert.doesNotMatch(syncBlock, /const byDb = await isDbMarkedSuperAdmin/);
});

test('onboarding gera companyId no servidor e primeiro usuario vira admin da empresa', () => {
  const source = read('functions/index.js');
  const block = blockBetween(source, 'exports.createCompanyOnboarding', 'exports.reconcileSuperAdminClaims');

  assert.match(block, /let companyId = `\$\{Date\.now\(\)\}\$\{Math\.floor\(Math\.random\(\) \* 1000\)\}`/);
  assert.doesNotMatch(block, /input\.id \|\| input\.companyId \|\| input\.companyID/);
  assert.match(block, /const nextClaims = \{ \.\.\.currentClaims, companyId, tenantId: companyId \}/);
  assert.match(block, /companies\/\$\{companyId\}\/users\/\$\{uid\}/);
  assert.match(block, /role: 'admin'/);
  assert.match(block, /adminActive: true/);
  assert.match(block, /ownerUid: uid/);
});

test('updateMyCompanyProfile resolve empresa server-side e rejeita IDOR', () => {
  const source = read('functions/index.js');
  const block = blockBetween(source, 'exports.updateMyCompanyProfile', 'exports.getCompanyLogoDataUrl');

  assert.match(block, /const requestedCompanyId = sanitizeText\(payload\.companyId \|\| payload\.id \|\| payload\.companyID \|\| payload\.tenantId \|\| '', ''\)/);
  assert.match(block, /const companyId = await resolveCompanyIdForUser/);
  assert.match(block, /requestedCompanyId !== companyId/);
  assert.match(block, /companyId informado não pertence ao usuário autenticado/);
  assert.match(block, /await assertCompanyProfileWriteAccess\(context, companyId, userData, token\)/);
  assert.doesNotMatch(block, /payload\.companyId\s*\|\|\s*payload\.id\s*\|\|\s*userData\.companyId/);
  assert.doesNotMatch(block, /Assinatura sem permissão de escrita/);
  assert.doesNotMatch(block, /subscriptionStatus === 'active'/);
});

test('updateMyUserProfile salva perfil proprio por Admin SDK sem aceitar targetUid', () => {
  const source = read('functions/index.js');
  const block = blockBetween(source, 'exports.updateMyUserProfile', 'exports.getCompanyLogoDataUrl');

  assert.match(block, /if \(!context\.auth \|\| !context\.auth\.uid\)/);
  assert.match(block, /normalizeSelfProfilePayload\(data\)/);
  assert.match(block, /admin\.auth\(\)\.updateUser\(uid, authPatch\)/);
  assert.match(block, /applyUserPatchAcrossScopes\(uid, patch/);
  assert.doesNotMatch(block, /targetUid/);
  assert.doesNotMatch(block, /companyId\s*=/);
});

test('NF Functions validam tenant antes de certificado, escrita ou remocao', () => {
  const source = read('functions/nf-functions.js');

  assert.match(source, /async function assertTenantAccess\(context, tenantId\)/);
  assert.match(source, /companies\/\$\{tenantId\}\/users\/\$\{uid\}/);
  assert.match(source, /throw new functions\.https\.HttpsError\('permission-denied', 'Usuário não pertence ao tenant fiscal informado\.'\)/);
  assert.match(source, /async function assertFiscalCertificateAdmin\(context, tenantId\)/);
  assert.match(source, /function hasPrimaryFiscalCompanyAccountPermission\(access\)/);
  assert.match(source, /return !!source\.adminOwnerUid \|\| role === 'sub_admin'/);
  assert.match(source, /subscriptionStatus === 'active'/);

  for (const fn of ['nf_assinarXML', 'nf_enviarSEFAZ', 'nf_consultarNFe', 'nf_cancelarNFe', 'nf_cartaCorrecaoNFe', 'nf_inutilizarNumeracao']) {
    const marker = `exports.${fn} = onFiscalCall`;
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${fn} precisa existir`);
    const nextExport = source.indexOf('exports.', start + marker.length);
    const block = source.slice(start, nextExport === -1 ? source.length : nextExport);
    assert.match(block, /const tenantId = sanitizePathSegment\(rawTenantId, 'tenantId'\)/, `${fn} precisa sanitizar tenantId`);
    assert.match(block, /await assertTenantAccess\(context, tenantId\)/, `${fn} precisa validar tenant`);
  }

  const upload = blockBetween(source, 'exports.nf_uploadCertificadoA1', 'exports.nf_removerCertificado');
  assert.match(upload, /const tenantId = sanitizePathSegment\(rawTenantId, 'tenantId'\)/);
  assert.match(upload, /await assertFiscalCertificateAdmin\(context, tenantId\)/);
  assert.match(upload, /saveCertificateMetadata\(db, tenantId, certRecord\)/);
  assert.match(upload, /deleteTenantCertificateFiles\(bucket, tenantId, storageRef\)/);

  const remover = blockBetween(source, 'exports.nf_removerCertificado', 'exports.nf_salvarReferenciaCertificado');
  assert.match(remover, /await assertFiscalCertificateAdmin\(context, tenantId\)/);
  assert.match(remover, /await clearCertificateMetadata\(db, tenantId\)/);
  assert.doesNotMatch(remover, /const \{ tenantId \} = data \|\| \{\}/);

  const referencia = blockBetween(source, 'exports.nf_salvarReferenciaCertificado', 'exports.nf_salvarConfiguracaoFiscal');
  assert.match(referencia, /const tenantId = sanitizePathSegment\(rawTenantId, 'tenantId'\)/);
  assert.match(referencia, /await assertFiscalCertificateAdmin\(context, tenantId\)/);
  assert.match(referencia, /sanitizeCertificateReferenceInput\(certMeta, uid\)/);
  assert.match(referencia, /saveCertificateMetadata\(db, tenantId, nextMeta\)/);

  const config = blockBetween(source, 'exports.nf_salvarConfiguracaoFiscal', 'exports.nf_configurarCertNuvem');
  assert.match(config, /const tenantId = sanitizePathSegment\(source\.tenantId, 'tenantId'\)/);
  assert.match(config, /await assertFiscalConfigAdmin\(context, tenantId\)/);
  assert.match(config, /await db\.ref\(`companies\/\$\{tenantId\}\/fiscal\/config`\)\.set\(nextConfig\);/);

  const certRead = blockBetween(source, 'exports.nf_obterResumoCertificadoFiscal', 'exports.nf_obterConfiguracaoFiscal');
  assert.match(certRead, /const tenantId = sanitizePathSegment\(rawTenantId, 'tenantId'\)/);
  assert.match(certRead, /await assertTenantAccess\(context, tenantId\)/);
  assert.match(certRead, /const meta = await loadCertificateMetadata\(db, tenantId\);/);
  assert.match(certRead, /meta: buildCertificatePublicSummary\(meta, tenantId\)/);
  assert.doesNotMatch(certRead, /certificado\/pfxEnc/);

  const configReadStart = source.indexOf('exports.nf_obterConfiguracaoFiscal');
  assert.notEqual(configReadStart, -1, 'nf_obterConfiguracaoFiscal precisa existir');
  const configRead = source.slice(configReadStart);
  assert.match(configRead, /const tenantId = sanitizePathSegment\(rawTenantId, 'tenantId'\)/);
  assert.match(configRead, /await assertTenantAccess\(context, tenantId\)/);
  assert.match(configRead, /const config = await loadFiscalConfig\(db, tenantId\);/);
});

test('storage rules nao deixam usuario comum ler certificado ou comprovante de outro uid', () => {
  const rules = read('storage.rules');
  const certBlock = blockBetween(rules, 'match /tenants/{tenantId}/certificados/{allPaths=**}', 'match /subscription-proofs/{uid}/{allPaths=**}');
  const companyProofBlock = blockBetween(rules, 'match /companies/{companyId}/subscription-proofs/{uid}/{allPaths=**}', 'match /companies/{companyId}/logs/{fileName}');

  assert.match(certBlock, /allow read: if request\.auth != null && request\.auth\.token\.superadmin == true/);
  assert.match(certBlock, /allow write: if request\.auth != null &&\s*request\.auth\.token\.superadmin == true/);
  assert.match(certBlock, /request\.resource == null/);
  assert.match(certBlock, /request\.resource\.contentType == 'application\/octet-stream'/);
  assert.doesNotMatch(certBlock, /request\.auth\.token\.companyId == tenantId/);
  assert.doesNotMatch(certBlock, /request\.auth\.token\.tenantId == tenantId/);
  assert.doesNotMatch(certBlock, /subscriptionStatus == 'active'/);
  assert.doesNotMatch(certBlock, /allow read, write/);

  const proofRead = companyProofBlock.slice(
    companyProofBlock.indexOf('allow read:'),
    companyProofBlock.indexOf('allow write:')
  );
  assert.match(companyProofBlock, /request\.auth\.uid == uid/);
  assert.doesNotMatch(proofRead, /request\.auth\.token\.companyId == companyId/);
  assert.doesNotMatch(proofRead, /request\.auth\.token\.tenantId == companyId/);
});
