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

test('dashboard exige auth antes de reusar tenant cacheado online e redireciona logout parcial para login', () => {
  const indexHtml = read('index.html');

  assert.match(indexHtml, /function getDashboardFirebaseService\(\)/);
  assert.match(indexHtml, /function isOfflineDashboardFallbackAllowed\(\)/);
  assert.match(indexHtml, /function redirectDashboardToLogin\(reason = 'tenant_required'\)/);
  assert.match(indexHtml, /await svc\.waitForAuthReady\(2500\)/);
  assert.match(indexHtml, /const allowOfflineFallback = isOfflineDashboardFallbackAllowed\(\);/);
  assert.match(indexHtml, /const fallbackTenant = allowOfflineFallback \? getCachedDashboardTenant\(\) : null;/);
  assert.match(indexHtml, /clearDashboardTenantContext\(\);\s*redirectDashboardToLogin\('tenant_required'\);/s);
  assert.match(indexHtml, /const tenantContext = await enforceTenantContext\(\);\s*if \(tenantContext && tenantContext\.redirected\) return;/s);
});

test('callFunction aguarda auth da sessao e tenta refresh unico em 401 antes de falhar', () => {
  const firebaseService = read('firebaseService.js');
  const callFunctionBlock = blockBetween(firebaseService, 'async function callFunction(functionName, payload = {})', 'async function callSupportFunction');

  assert.match(firebaseService, /async function primeCallableAuthSession\(timeoutMs = 4500\)/);
  assert.match(firebaseService, /function getWindowFirebaseAuthUser\(\)/);
  assert.match(firebaseService, /function requiresAuthenticatedCallable\(functionName\)/);
  assert.match(firebaseService, /const currentUser = await primeCallableAuthSession\(4500\);/);
  assert.match(firebaseService, /if \(needsAuth && !currentUser\) \{/);
  assert.match(firebaseService, /if \(needsAuth && currentUser\) \{/);
  assert.match(firebaseService, /await getCallableIdToken\(currentUser, true\);/);
  assert.match(firebaseService, /const result = await callable\(safePayload\);/);
  assert.match(firebaseService, /if \(!isCallableUnauthenticatedError\(error\)\) throw error;/);
  assert.match(firebaseService, /const retried = await callable\(safePayload\);/);
  assert.match(firebaseService, /return unwrapCallableResult\(retried\);/);
  assert.doesNotMatch(callFunctionBlock, /callFunctionWithExplicitAuth\(safeName/);
  assert.match(firebaseService, /if \(currentUser && isCallableUnauthenticatedError\(error\) && typeof currentUser\.getIdTokenResult === 'function'\)/);
  assert.match(firebaseService, /await currentUser\.getIdTokenResult\(true\);/);
});

test('logout central do firebaseService limpa sessao local e contexto de tenant', () => {
  const firebaseService = read('firebaseService.js');

  assert.match(firebaseService, /localStorage\.removeItem\('currentUser'\);/);
  assert.match(firebaseService, /localStorage\.removeItem\('persistentUser'\);/);
  assert.match(firebaseService, /localStorage\.removeItem\('siswebAuthSession'\);/);
  assert.match(firebaseService, /try \{ sessionStorage\.clear\(\); \} catch \(_\) \{\}/);
  assert.match(firebaseService, /clearTenantContext\(\);/);
});
