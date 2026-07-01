import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('checkout Mercado Pago usa o id real do container do Brick', () => {
  const html = read('subscription.html');

  assert.match(html, /id="paymentBrick_container"/);
  assert.match(html, /getElementById\('paymentBrick_container'\)/);
  assert.doesNotMatch(html, /getElementById\('paymentBrickContainer'\)/);
});

test('link publico de assinatura registra antes de pagamento ou teste gratis', () => {
  const html = read('subscription.html');
  const login = read('login.html');
  const company = read('company.html');

  assert.match(html, /function redirectToSubscriptionRegistration\(intent, plan\)/);
  assert.match(html, /function buildCompanyOnboardingTarget\(intent, plan\)/);
  assert.match(html, /params\.set\('mode', 'register'\)/);
  assert.match(html, /params\.set\('redirect', onboardingTarget\)/);
  assert.match(html, /async function requireSubscriptionLogin\(reason, options = \{\}\)/);
  assert.match(html, /await hasAuthenticatedSubscriptionUser\(\)/);
  assert.match(html, /async function showPaymentModal\(plan, options = \{\}\)/);
  assert.match(html, /await requireSubscriptionLogin\('subscription_payment'[\s\S]*preferRegistration: true[\s\S]*intent: 'payment'/);
  assert.match(html, /await requireSubscriptionLogin\('subscription_free_trial'[\s\S]*preferRegistration: true[\s\S]*intent: 'free_trial'/);
  assert.match(html, /function getPaidPlanActionLabel\(\)/);
  assert.match(html, /return 'Assinar'/);
  assert.match(html, /Começar \$\{trialDays\} dias grátis/);
  assert.match(html, /function handlePostOnboardingSubscriptionIntent\(\)/);
  assert.match(html, /await activateFreePlan\(\{ fromOnboarding: true \}\)/);
  assert.match(html, /await showPaymentModal\(intent\.plan, \{ fromOnboarding: true \}\)/);
  assert.doesNotMatch(html, /onclick="showPaymentModal\('\$\{planKey\}'\)">Renovar Assinatura/);

  assert.match(login, /window\.__siswebLoginInitialSearch = window\.location\.search \|\| ''/);
  assert.match(login, /function getLoginInitialParams\(\)/);
  assert.match(login, /urlParams\.delete\('noRedirect'\)/);
  assert.match(login, /const cleanUrl = window\.location\.pathname \+ \(urlParams\.toString\(\) \? '\?' \+ urlParams\.toString\(\) : ''\)/);
  assert.match(login, /String\(initialParams\.get\('mode'\) \|\| ''\)\.toLowerCase\(\) === 'register'/);

  assert.match(company, /menu-component\.js\?v=2026-07-01-menu-global-dedupe-v1/);
  assert.match(company, /auth\.js\?v=2026-06-11-company-profile-permissions-v3/);
  assert.match(company, /function getCompanyOnboardingReturnTarget\(\)/);
  assert.match(company, /reason'\) \|\| ''\)\.toLowerCase\(\) === 'subscription_onboarding'/);
  assert.match(company, /access\.mode === 'has_company' && isSubscriptionOnboardingRequest\(\)/);
  assert.match(company, /window\.location\.href = getCompanyOnboardingReturnTarget\(\)/);
});

test('cupons promocionais aceitam link publico e aliases de plano no backend', () => {
  const html = read('subscription.html');
  const functionsIndex = read('functions/index.js');

  assert.match(html, /function readPromoCodeFromUrl\(\)/);
  assert.match(html, /params\.get\('cupom'\)[\s\S]*params\.get\('promo'\)[\s\S]*params\.get\('coupon'\)/);
  assert.match(html, /normalizePromoCodeInput/);
  assert.match(html, /prefillPromoCodeFromUrl\(\)/);
  assert.match(html, /planId:\s*currentPlan/);
  assert.match(html, /planKey:\s*currentPlan/);

  assert.match(functionsIndex, /function normalizePromoCodeValue/);
  assert.ok(functionsIndex.includes(".replace(/[^A-Z0-9_-]/g, '')"));
  assert.match(functionsIndex, /const code = normalizePromoCodeValue\(payload\.code\)/);
  assert.match(functionsIndex, /payload\.planId \|\| payload\.plan \|\| payload\.planKey/);
  assert.match(functionsIndex, /system\/promocodes\/\$\{safeCode\}/);
});

test('configuracoes comerciais podem ser lidas no link publico sem expor dados de pagamento', () => {
  const html = read('subscription.html');
  const functionsIndex = read('functions/index.js');

  assert.match(functionsIndex, /function publicSubscriptionSettingsShape\(input\)/);
  assert.match(functionsIndex, /return \{ success: true, settings: publicSubscriptionSettingsShape\(normalized\), public: true \};/);
  assert.doesNotMatch(functionsIndex, /Apenas usuários autenticados podem consultar configurações/);
  assert.match(functionsIndex, /paymentMeta:\s*\{\s*supportEmail:/);
  const publicShape = functionsIndex.slice(
    functionsIndex.indexOf('function publicSubscriptionSettingsShape'),
    functionsIndex.indexOf('function mergeSubscriptionSettingsInput')
  );
  assert.doesNotMatch(publicShape, /pixKey:/);
  assert.doesNotMatch(publicShape, /beneficiary:/);

  assert.match(html, /function getDefaultSettings\(\)/);
  assert.match(html, /function normalizeClientSubscriptionSettings\(input\)/);
  assert.match(html, /subscriptionSettingsPublicCache/);
  assert.match(html, /__fallback: true/);
  assert.match(html, /Plano Mensal/);
  assert.match(html, /Plano Trimestral/);
  assert.match(html, /Plano Premium/);
  assert.match(html, /freeTrialDays: 30/);
  assert.doesNotMatch(html, /subscriptionSettings = cached \|\| null/);
});

test('admin campanhas gera link publico e compartilhamento WhatsApp para cupons ativos', () => {
  const adminMain = read('scripts/admin/admin-main.js');

  assert.match(adminMain, /function buildPromoPublicUrl/);
  assert.match(adminMain, /\/subscription\.html\?/);
  assert.match(adminMain, /params\.set\("utm_campaign", "madeireiro"\)/);
  assert.match(adminMain, /function buildPromoShareText/);
  assert.match(adminMain, /sistema para gestão do segmento madeireiro/);
  assert.match(adminMain, /window\.copyPromoShareLink = copyPromoShareLink/);
  assert.match(adminMain, /window\.openPromoWhatsappShare = openPromoWhatsappShare/);
  assert.match(adminMain, /data-promo-action="copy"/);
  assert.match(adminMain, /data-promo-action="whatsapp"/);
  assert.doesNotMatch(adminMain, /onclick="window\.editPromoCode/);
});

test('admin cupons usa Cloud Functions administrativas em vez de escrita direta em system', () => {
  const adminMain = read('scripts/admin/admin-main.js');
  const firebaseService = read('firebaseService.js');
  const functionsIndex = read('functions/index.js');

  for (const fn of [
    'listPromoCodesAdmin',
    'getPromoCodeAdmin',
    'upsertPromoCodeAdmin',
    'archivePromoCodeAdmin'
  ]) {
    assert.match(functionsIndex, new RegExp(`exports\\.${fn}\\s*=\\s*https\\.onCall`));
    assert.match(firebaseService, new RegExp(`async function ${fn}`));
    assert.match(firebaseService, new RegExp(`${fn}[:,]?`));
    assert.match(adminMain, new RegExp(`window\\.firebaseService\\.${fn}`));
  }

  assert.match(functionsIndex, /await assertSuperAdmin\(context, 'Apenas superadmin pode salvar cupom promocional\.'\)/);
  assert.match(functionsIndex, /normalizePromoCodeAdminPayload/);
  assert.match(functionsIndex, /appendPromoCodeAudit/);
  assert.match(functionsIndex, /promoAppliesToPlan\(promo, planId\)/);
  assert.match(functionsIndex, /promoAppliesToPlan\(promo, pricing && pricing\.planKey\)/);
  assert.match(adminMain, /data-promo-action="archive"/);
  assert.match(adminMain, /class="promoPlanInput"/);
  assert.doesNotMatch(adminMain, /getAll\("system\/promocodes/);
  assert.doesNotMatch(adminMain, /saveToFirebase\("system\/promocodes/);
});

test('Mercado Pago usa Secret Manager em producao e webhook exige token configurado', () => {
  const functionsIndex = read('functions/index.js');

  assert.match(functionsIndex, /defineSecret\('MERCADO_PAGO_ACCESS_TOKEN'\)/);
  assert.match(functionsIndex, /defineSecret\('MERCADO_PAGO_WEBHOOK_TOKEN'\)/);
  assert.match(functionsIndex, /defineSecret\('MERCADO_PAGO_WEBHOOK_URL'\)/);
  assert.match(functionsIndex, /readSecretValue\(MERCADO_PAGO_ACCESS_TOKEN_SECRET\) \|\| readLocalSecretEnv\('MERCADO_PAGO_ACCESS_TOKEN_LOCAL'\)/);
  assert.match(functionsIndex, /readSecretValue\(MERCADO_PAGO_WEBHOOK_TOKEN_SECRET\) \|\| readLocalSecretEnv\('MERCADO_PAGO_WEBHOOK_TOKEN_LOCAL'\)/);
  assert.match(functionsIndex, /readSecretValue\(MERCADO_PAGO_WEBHOOK_URL_SECRET\) \|\| readLocalSecretEnv\('MERCADO_PAGO_WEBHOOK_URL_LOCAL'\)/);
  assert.doesNotMatch(functionsIndex, /process\.env\.MERCADO_PAGO_ACCESS_TOKEN_LOCAL/);
  assert.doesNotMatch(functionsIndex, /process\.env\.MERCADO_PAGO_WEBHOOK_TOKEN_LOCAL/);
  assert.doesNotMatch(functionsIndex, /process\.env\.MERCADO_PAGO_WEBHOOK_URL_LOCAL/);
  assert.match(functionsIndex, /if \(!requiredWebhookToken\) \{/);
  assert.match(functionsIndex, /webhook_token_not_configured/);
  assert.doesNotMatch(functionsIndex, /if \(requiredWebhookToken\) \{[\s\S]{0,180}invalid_webhook_token/);
});

