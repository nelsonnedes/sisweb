import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('menu mobile usa gatilhos completos para alertas/configuracoes e exibe sair', () => {
  const menuComponent = read('menu-component.js');
  const menuCss = read('menu.css');

  assert.match(menuComponent, /const PWA_VERSION = '2026-07-01-alerts-overflow-fix-v1'/);
  assert.match(menuComponent, /class="sisweb-menu-shell"/);
  assert.match(menuComponent, /class="menu-quick-actions" aria-label="Ações rápidas"/);
  assert.ok(
    menuComponent.indexOf('class="alerts-dropdown"') < menuComponent.indexOf('class="settings-dropdown"'),
    'alertas devem aparecer antes da engrenagem no topo mobile'
  );
  assert.match(menuComponent, /class="menu-item-trigger alerts-trigger" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false"/);
  assert.match(menuComponent, /class="menu-item-trigger settings-trigger" role="button" tabindex="0" aria-haspopup="true" aria-expanded="false"/);
  assert.match(menuComponent, /class="dropdown-content settings-panel"/);
  assert.match(menuComponent, /class="user-info settings-profile-card-slot"/);
  assert.match(menuComponent, /class="settings-profile-card"/);
  assert.match(menuComponent, /class="settings-section-title">Conta/);
  assert.match(menuComponent, /class="settings-section-title">Operação/);
  assert.match(menuComponent, /class="settings-section-title">Ajuda/);
  assert.match(menuComponent, /class="settings-section settings-exit"/);
  assert.match(menuComponent, /class="settings-action logout-link"/);
  assert.doesNotMatch(menuComponent, /mobile-menu-link/);
  assert.doesNotMatch(menuComponent, /mobile-logout-link/);
  assert.match(menuComponent, /\$\{!adminContext\.isSuperAdmin \? `<a href="#" class="[^"]*support-link/);
  assert.match(menuComponent, /admin\.html\?tab=support/);
  assert.match(menuComponent, /const settingsTrigger = this\.querySelector\('\.settings-dropdown \.menu-item-trigger'\)/);
  assert.match(menuComponent, /const alertsTrigger = this\.querySelector\('\.alerts-dropdown \.menu-item-trigger'\)/);
  assert.match(menuComponent, /const logoutLinks = this\.querySelectorAll\('\.logout-link'\)/);
  assert.match(menuComponent, /settingsTrigger\.addEventListener\('keydown'/);
  assert.match(menuComponent, /alertsTrigger\.addEventListener\('keydown'/);
  assert.doesNotMatch(menuComponent, /settingsIcon\.addEventListener\('click'/);
  assert.doesNotMatch(menuComponent, /alertsIcon\.addEventListener\('click'/);

  assert.doesNotMatch(menuCss, /mobile-menu-link/);
  assert.doesNotMatch(menuCss, /mobile-logout-link/);
  assert.match(menuCss, /\.menu-quick-actions \{[\s\S]*display: flex;/);
  assert.match(menuCss, /@media \(max-width: 1024px\) \{[\s\S]*\.menu-quick-actions \{[\s\S]*margin-left: 0;/);
  assert.match(menuCss, /\.menu-quick-actions \.menu-item-trigger \{[\s\S]*width: 42px;/);
});

test('PWA verifica updates instalados e service worker responde versao atual', () => {
  const menuComponent = read('menu-component.js');
  const sw = read('sw.js');

  assert.match(sw, /const APP_VERSION = '2026-08-27-romaneio-tora-quota-v1'/);
  assert.match(menuComponent, /window\.addEventListener\('online', \(\) => checkForUpdate\(true\)\)/);
  assert.match(menuComponent, /window\.addEventListener\('pageshow', \(\) => checkForUpdate\(true\)\)/);
  assert.match(menuComponent, /window\.setTimeout\(\(\) => checkForUpdate\(true\), 1500\)/);
  assert.match(menuComponent, /window\.SiswebPWACheckForUpdate = \(\) => checkForUpdate\(true\)/);
  assert.match(menuComponent, /checkForUpdate: \(\) => \(typeof window\.SiswebPWACheckForUpdate === 'function'/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /self\.clients\.claim\(\)/);
  assert.match(sw, /SISWEB_PWA_UPDATED/);
  assert.match(menuComponent, /bindWorkerMessages/);
  assert.match(sw, /event\.data && event\.data\.type === 'GET_VERSION'/);
  assert.match(sw, /cache: 'no-store'/);
  assert.match(menuComponent, /sessionStorage\.setItem\('siswebPwaUpdateReady', PWA_VERSION\)/);
  assert.doesNotMatch(menuComponent, /window\.location\.reload\(\)/);
});

test('PWA fase 5: network-first so para HTML, SWR para JS/CSS e cache-first para assets', () => {
  const sw = read('sw.js');

  // Navegacao: network-first (HTML sempre da rede, fallback ao cache)
  assert.match(sw, /if \(request\.mode === 'navigate'\)/);
  assert.match(sw, /event\.respondWith\(networkFirst\(request\)\);/);
  assert.match(sw, /async function networkFirst\(request\) \{/);

  // JS/CSS/worker: stale-while-revalidate (cache quente + revalidacao em background)
  assert.match(sw, /request\.destination === 'script' \|\| request\.destination === 'style' \|\| request\.destination === 'worker'/);
  assert.match(sw, /event\.respondWith\(staleWhileRevalidate\(request\)\);/);
  assert.match(sw, /async function staleWhileRevalidate\(request\) \{/);
  assert.match(sw, /if \(cached\) \{\s*return cached;\s*\}/);

  // Imagens/fontes/midia: cache-first
  assert.match(sw, /destination === 'image' \|\| destination === 'font' \|\| destination === 'audio' \|\| destination === 'video'/);
  assert.match(sw, /event\.respondWith\(cacheFirst\(request\)\);/);
  assert.match(sw, /async function cacheFirst\(request\) \{/);

  // Limpeza de cache por versao no activate
  assert.match(sw, /\.filter\(\(cacheName\) => cacheName !== CACHE_NAME\)/);
  assert.match(sw, /caches\.delete\(cacheName\)/);
});

test('menu principal tem escopo proprio para manter visual igual entre paginas', () => {
  const menuComponent = read('menu-component.js');
  const menuCss = read('menu.css');

  assert.match(menuComponent, /\.sisweb-menu-shell \.menu-item \{[\s\S]*font-weight: 700;[\s\S]*border-radius: 6px;/);
  assert.match(menuComponent, /\.sisweb-menu-shell \.dropdown-content \{[\s\S]*width: max-content;[\s\S]*z-index: 5000;/);
  assert.match(menuComponent, /\.sisweb-menu-shell \.dropdown-content a \{[\s\S]*text-overflow: ellipsis;/);
  assert.match(menuCss, /main-menu \.sisweb-menu-shell \.menu-item \{[\s\S]*font-weight: 700;[\s\S]*border-radius: 6px;/);
  assert.match(menuCss, /main-menu \.sisweb-menu-shell \.dropdown-content \{[\s\S]*z-index: 5000;/);
  assert.match(menuComponent, /\.sisweb-menu-shell \.alerts-panel \{[\s\S]*width: min\(420px, calc\(100vw - 24px\)\);[\s\S]*max-width: 420px;/);
  assert.match(menuCss, /main-menu \.sisweb-menu-shell \.alerts-panel \{[\s\S]*width: min\(420px, calc\(100vw - 24px\)\);[\s\S]*max-width: 420px;/);
  assert.match(menuCss, /@media \(max-width: 1024px\) \{[\s\S]*main-menu \.sisweb-menu-shell \.menu-item \{[\s\S]*width: 100%;/);
});

test('sininho superadmin alerta bloqueio de faturamento firebase no hover desktop', () => {
  const menuComponent = read('menu-component.js');

  assert.match(menuComponent, /getAdminOperationalAlerts\(ctx, now\)/);
  assert.match(menuComponent, /ctx && ctx\.isSuperAdmin/);
  assert.match(menuComponent, /system\/operationalAlerts\/firebaseBilling/);
  assert.match(menuComponent, /system\/deployHealth\/firebase/);
  assert.match(menuComponent, /sisweb_admin_deploy_last_error/);
  assert.match(menuComponent, /recordFirebaseBillingError/);
  assert.match(menuComponent, /clearFirebaseBillingError/);
  assert.match(menuComponent, /generateuploadurl/);
  assert.match(menuComponent, /write access/);
  assert.match(menuComponent, /please check billing account/);
  assert.match(menuComponent, /https:\/\/console\.cloud\.google\.com\/billing\/linkedaccount\?project=sisweb-7ce82/);
  assert.match(menuComponent, /Deploy\/Cloud Functions bloqueado por faturamento/);
  assert.match(menuComponent, /window\.matchMedia\('\(hover: hover\) and \(pointer: fine\)'\)/);
  assert.match(menuComponent, /alertsShell\.addEventListener\('mouseenter'/);
  assert.match(menuComponent, /target="_blank" rel="noopener noreferrer"/);
});

test('auth PWA mantem cache duravel para UX sem usa-lo como autorizacao', () => {
  const auth = read('auth.js');
  const login = read('login.html');
  const menuComponent = read('menu-component.js');
  const subscriptionHtml = read('subscription.html');
  const subscriptionStatusHtml = read('subscription-status.html');

  assert.match(auth, /const SISWEB_AUTH_SESSION_KEY = 'siswebAuthSession'/);
  assert.match(auth, /const SISWEB_AUTH_SESSION_MAX_AGE_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(auth, /function persistAuthenticatedSession\(user, options = \{\}\) \{/);
  assert.match(auth, /function getUsableCachedAuthSession\(\) \{/);
  assert.match(auth, /function clearCompanyContextCache\(\) \{/);
  assert.match(auth, /async function restoreCompanyContextFromCachedUser\(user\) \{/);
  assert.match(auth, /async function tryAllowCachedAuthSession\(source\) \{\s*void source;\s*return \{ allowed: false \};\s*\}/);
  assert.doesNotMatch(auth, /return \{ allowed: true, user: cached\.user \}/);
  assert.match(auth, /const cachedAuth = await tryAllowCachedAuthSession\('pwa_cached_session'\)/);
  assert.match(auth, /persistAuthenticatedSession\(guardUserDetails, \{ source: 'firebase_guard' \}\)/);
  assert.match(auth, /window\.markSiswebSessionAuthenticated = persistAuthenticatedSession/);
  assert.match(auth, /window\.clearSiswebDurableAuthSession = clearDurableAuthSession/);
  assert.match(auth, /window\.clearSiswebCompanyContextCache = clearCompanyContextCache/);
  assert.match(auth, /clearDurableAuthSession\(\);/);
  assert.match(auth, /clearCompanyContextCache\(\);/);
  assert.match(login, /window\.markSiswebSessionAuthenticated\(result\.user \|\| result\.currentUser \|\| \{ email \}, \{ source: 'login_page' \}\)/);
  assert.match(login, /const email = String\(\(emailInput && emailInput\.value\) \|\| ''\)\.trim\(\)\.toLowerCase\(\)/);
  assert.match(login, /id="email" name="email" autocomplete="email" inputmode="email" autocapitalize="none" autocorrect="off" spellcheck="false"/);
  assert.match(login, /auth\.js\?v=[^"'\s]+/);
  assert.match(login, /\.\/firebaseService\.js\?v=[^"'\s]+/);
  assert.match(login, /window\.firebaseService = \{ \.\.\.\(window\.firebaseService \|\| \{\}\), authService, isFirebaseOperational, setCompanyClaim \}/);
  assert.match(login, /localStorage\.removeItem\('siswebAuthSession'\)/);
  assert.match(login, /localStorage\.removeItem\('company_info'\)/);
  assert.match(menuComponent, /localStorage\.removeItem\('siswebAuthSession'\)/);
  assert.match(menuComponent, /localStorage\.removeItem\('company_info'\)/);

  const firebaseService = read('firebaseService.js');
  assert.match(firebaseService, /browserLocalPersistence/);
  assert.match(firebaseService, /authPersistenceReady = setPersistence/);
  assert.match(firebaseService, /await authPersistenceReady/);
  assert.match(firebaseService, /authPersistenceReady,/);
  assert.match(firebaseService, /auth\/invalid-login-credentials/);
  assert.match(auth, /async function waitForAuthInfrastructureReady\(\)/);
  assert.match(auth, /await waitForAuthInfrastructureReady\(\)/);
  assert.match(auth, /window\.__siswebAuthInitializedForPath === window\.location\.pathname/);
  assert.doesNotMatch(auth, /sessionStorage\.getItem\(AUTH_INITIALIZED_KEY\) === 'true'/);

  assert.match(auth, /function isSubscriptionSelfServiceTarget\(value\)/);
  assert.match(auth, /if \(!requested && isSubscriptionSelfServiceTarget\(currentPathname\)\) \{/);
  assert.match(auth, /Página pública de assinatura detectada/);
  assert.match(login, /requestedIsSubscriptionSelfService/);
  assert.match(subscriptionHtml, /Oferta pública carregada sem sessão autenticada/);
  assert.match(subscriptionHtml, /async function requireSubscriptionLogin\(reason, options = \{\}\)/);
  assert.match(subscriptionHtml, /redirect', getSubscriptionReturnTarget\(\)/);
  assert.match(subscriptionHtml, /auth\.js\?v=[^"'\s]+/);
  assert.match(subscriptionStatusHtml, /auth\.js\?v=[^"'\s]+/);
  assert.doesNotMatch(subscriptionHtml, /login\.html\?redirect=subscription\.html/);
  assert.doesNotMatch(subscriptionHtml, /statusKey === 'active'[\s\S]{0,180}window\.location\.href = 'index\.html'/);
});

test('folha lancamentos vira cards no mobile sem trocar renderizacao desktop', () => {
  const folhaUtils = read('folha_pagamento/folha-utils.js');
  const folhaMain = read('folha_pagamento/folha-main.js');
  const folhaCss = read('folha_pagamento/folha.css');

  [
    'Funcionário',
    'Forma Pgto.',
    'Mês/Ano',
    'Tipo',
    'Salário Base',
    '1ª Quinzena',
    'Acréscimos',
    'Descontos',
    'Total Vales',
    'Líquido',
    'Ações',
  ].forEach((label) => {
    assert.match(folhaUtils, new RegExp(`data-label="${label}"`));
    assert.match(folhaMain, new RegExp(`data-label="${label}"`));
  });

  assert.match(folhaCss, /@media screen and \(max-width: 640px\) \{/);
  assert.match(folhaCss, /#folhasTable thead \{\s*display: none;/);
  assert.match(folhaCss, /#folhasTable tbody td::before \{[\s\S]*content: attr\(data-label\)/);
  assert.match(folhaCss, /#folhasTable \.actions-cell,[\s\S]*position: static !important;/);
  assert.match(folhaCss, /#folhasTable tbody td\[colspan\] \{[\s\S]*text-align: center;/);
});
