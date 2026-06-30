import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin concede trial 30 dias por callable seguro com auditoria e comunicacao automatica', () => {
  const adminHtml = read('admin.html');
  const adminMain = read('scripts/admin/admin-main.js');
  const functionsIndex = read('functions/index.js');
  const firebaseService = read('firebaseService.js');

  assert.match(adminHtml, /firebaseService\.js\?v=2026-06-11-profile-admin-v1/);
  assert.match(adminHtml, /scripts\/admin\/admin-main\.js\?v=2026-06-11-profile-admin-v1/);
  assert.match(adminMain, /ADMIN_ASSET_VERSION = "2026-06-11-profile-admin-v1"/);
  assert.match(adminMain, /function canGrantAdminTrialForStatus/);
  assert.match(adminMain, /function isNoSubscriptionStatus/);
  assert.match(adminMain, /function isAdminSubscriptionOverviewStatus/);
  assert.match(adminMain, /return isNoSubscriptionStatus\(key\) \|\| \["superadmin","trial_active","pending","pending_grace","active","expired","blocked"\]/);
  assert.match(adminMain, /const relevant = users\.filter[\s\S]*isAdminSubscriptionOverviewStatus\(k\)/);
  assert.match(adminMain, /var aInfo = resolveAdminSubscriptionDates\(a\)/);
  assert.match(adminMain, /aInfo\.lastEventDate \|\| aInfo\.registrationDate \|\| aInfo\.startDate/);
  assert.match(adminMain, /Sem assinatura/);
  assert.match(adminMain, /cliente sem assinatura, expirado, bloqueado ou pendente/);
  assert.match(adminMain, /Trial 30d/);
  assert.match(adminMain, /grantAdminFreeTrialDialog\(user\)/);
  assert.match(adminMain, /sininho e tamb[eé]m no e-mail cadastrado/);
  assert.match(adminMain, /resolveAdminFirebaseService\("grantAdminFreeTrial"\)/);
  assert.match(adminMain, /firebaseSvc\.grantAdminFreeTrial/);

  assert.match(firebaseService, /async function grantAdminFreeTrial/);
  assert.match(firebaseService, /function getCallableErrorMessage/);
  assert.match(firebaseService, /Erro interno na Function/);
  assert.match(firebaseService, /callAdminCallableWithRetry\('grantAdminFreeTrial'/);
  assert.match(firebaseService, /grantAdminFreeTrial: grantAdminFreeTrial/);
  assert.match(firebaseService, /grantAdminFreeTrial,/);

  assert.match(functionsIndex, /exports\.grantAdminFreeTrial = SMTP_SECRET_RUNTIME_OPTIONS\.https\.onCall/);
  assert.match(functionsIndex, /await assertSuperAdmin\(context, 'Apenas superadmin pode conceder trial administrativo\.'\)/);
  assert.match(functionsIndex, /\[admin-free-trial-auth-user\]/);
  assert.match(functionsIndex, /\[admin-free-trial-sync\]/);
  assert.match(functionsIndex, /\[admin-free-trial-claims\]/);
  assert.match(functionsIndex, /subscriptionStatus: 'trial_active'/);
  assert.match(functionsIndex, /subscriptionEndDate: endIso/);
  assert.match(functionsIndex, /pendingPayment: null/);
  assert.match(functionsIndex, /adminTrialGrant:/);
  assert.match(functionsIndex, /REQUEST_SUPERSEDED_BY_ADMIN_TRIAL/);
  assert.match(functionsIndex, /ADMIN_FREE_TRIAL_GRANTED/);
  assert.match(functionsIndex, /source: 'admin-free-trial'/);
  assert.match(functionsIndex, /await sendSystemEmail/);
  assert.match(functionsIndex, /emailSent/);
  assert.match(functionsIndex, /setCustomUserClaims\(targetUid, nextClaims\)/);
  assert.match(functionsIndex, /revokeRefreshTokens\(targetUid\)/);
});
