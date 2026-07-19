import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `Start marker not found: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `End marker not found after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

test('dashboard consome a sessao canonica, preserva timeout e redireciona logout confirmado', () => {
  const indexHtml = read('index.html');

  assert.match(indexHtml, /function getDashboardFirebaseService\(\)/);
  assert.match(indexHtml, /function redirectDashboardToLogin\(reason = 'tenant_required'\)/);
  assert.match(indexHtml, /await svc\.resolveAuthenticatedTenant\(\{ timeoutMs: 5000 \}\)/);
  assert.match(indexHtml, /context\.code === 'auth-timeout'/);
  assert.match(indexHtml, /context\.code === 'auth-observer-error'/);
  assert.doesNotMatch(indexHtml, /authenticated: false, offline: true/);
  assert.match(indexHtml, /clearDashboardTenantContext\(\);\s*redirectDashboardToLogin\('tenant_required'\);/s);
  assert.match(indexHtml, /const tenantContext = await enforceTenantContext\(\);\s*if \(!tenantContext \|\| tenantContext\.success !== true \|\| tenantContext\.redirected\)/s);
});

test('callFunction usa token central em cache e tenta refresh unico apenas apos erro autenticado', () => {
  const firebaseService = read('firebaseService.js');
  const callFunctionBlock = blockBetween(firebaseService, 'async function callFunction(functionName, payload = {})', 'async function callSupportFunction');

  assert.match(firebaseService, /async function primeCallableAuthSession\(timeoutMs = 4500\)/);
  assert.match(firebaseService, /function getWindowFirebaseAuthUser\(\)/);
  assert.match(firebaseService, /function requiresAuthenticatedCallable\(functionName\)/);
  assert.match(firebaseService, /const currentUser = await primeCallableAuthSession\(4500\);/);
  assert.match(firebaseService, /if \(needsAuth && !currentUser\) \{/);
  assert.match(firebaseService, /if \(needsAuth && currentUser\) \{/);
  assert.match(callFunctionBlock, /await getCallableIdToken\(currentUser, false\);/);
  assert.match(firebaseService, /const result = await callable\(safePayload\);/);
  assert.match(firebaseService, /if \(!isCallableUnauthenticatedError\(error\)\) throw error;/);
  assert.match(callFunctionBlock, /if \(!isCallableUnauthenticatedError\(error\)\) throw error;\s*await getCallableIdToken\(currentUser, true\);/s);
  assert.match(firebaseService, /const retried = await callable\(safePayload\);/);
  assert.match(firebaseService, /return unwrapCallableResult\(retried\);/);
  assert.doesNotMatch(callFunctionBlock, /callFunctionWithExplicitAuth\(safeName/);
  assert.match(firebaseService, /if \(currentUser && isCallableUnauthenticatedError\(error\) && typeof currentUser\.getIdTokenResult === 'function'\)/);
  assert.match(firebaseService, /await getIdTokenResultSingleFlight\(currentUser, \{/);
});

test('logout central do firebaseService limpa sessao local e contexto de tenant', () => {
  const firebaseService = read('firebaseService.js');

  assert.match(firebaseService, /localStorage\.removeItem\('currentUser'\);/);
  assert.match(firebaseService, /localStorage\.removeItem\('persistentUser'\);/);
  assert.match(firebaseService, /localStorage\.removeItem\('siswebAuthSession'\);/);
  assert.match(firebaseService, /try \{ sessionStorage\.clear\(\); \} catch \(_\) \{\}/);
  assert.match(firebaseService, /clearTenantContext\(\);/);
});
