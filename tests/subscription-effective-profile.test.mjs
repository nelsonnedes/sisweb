import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `bloco ${startMarker} precisa existir`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `fim ${endMarker} precisa existir`);
  return source.slice(start, end);
}

function loadReconciler() {
  const source = read('firebaseService.js');
  const block = blockBetween(
    source,
    'function resolveSubscriptionStatusForWriteGuard',
    'function isWritePathProtectedBySubscription',
  );
  const context = {
    Date,
    Number,
    Math,
    parseInt,
    localStorage: { getItem: () => null },
  };
  vm.createContext(context);
  vm.runInContext(
    `${block}\nthis.reconcile = reconcileSubscriptionReplicaProfiles;`,
    context,
  );
  return context.reconcile;
}

const NOW = Date.now();
const past = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();
const olderPast = new Date(NOW - 48 * 60 * 60 * 1000).toISOString();
const future = new Date(NOW + 24 * 60 * 60 * 1000).toISOString();

test('trial futuro do tenant prevalece sobre expired legado da raiz', () => {
  const reconcile = loadReconciler();
  const root = { uid: 'same-user', subscriptionStatus: 'expired', subscription: { endDate: past } };
  const tenant = {
    uid: 'ignored-tenant-copy',
    subscriptionStatus: 'trial_active',
    subscription: { type: 'free_trial', endDate: future },
  };

  const result = reconcile(root, tenant, NOW);

  assert.equal(result.statusKey, 'trial_active');
  assert.equal(result.source, 'tenant');
  assert.equal(result.data.uid, 'same-user');
  assert.equal(result.data.subscription.endDate, future);
  assert.deepEqual(Array.from(result.warnings), ['subscription_replica_divergence']);
});

test('blocked explicito prevalece sobre vigencia futura', () => {
  const reconcile = loadReconciler();
  const root = { subscriptionStatus: 'active', subscription: { endDate: future } };
  const tenant = { accountStatus: 'blocked' };

  const result = reconcile(root, tenant, NOW);

  assert.equal(result.statusKey, 'blocked');
  assert.equal(result.data.accountStatus, 'blocked');
});

test('duas replicas vencidas permanecem expiradas pela data mais recente', () => {
  const reconcile = loadReconciler();
  const root = { subscriptionStatus: 'expired', subscription: { endDate: olderPast } };
  const tenant = { subscriptionStatus: 'expired', subscription: { endDate: past } };

  const result = reconcile(root, tenant, NOW);

  assert.equal(result.statusKey, 'expired');
  assert.equal(result.source, 'tenant');
  assert.equal(result.data.subscription.endDate, past);
});

test('uma unica replica valida continua funcional', () => {
  const reconcile = loadReconciler();
  const tenant = { subscriptionStatus: 'active', subscription: { endDate: future } };

  const result = reconcile(null, tenant, NOW);

  assert.equal(result.statusKey, 'active');
  assert.equal(result.source, 'tenant');
  assert.equal(result.data.subscription.endDate, future);
});

test('pending sem vigencia futura permanece pendente', () => {
  const reconcile = loadReconciler();
  const root = { subscriptionStatus: 'expired', subscription: { endDate: past } };
  const tenant = { subscriptionStatus: 'pending', pendingPayment: { status: 'pending' } };

  const result = reconcile(root, tenant, NOW);

  assert.equal(result.statusKey, 'pending');
  assert.equal(result.source, 'tenant');
});

test('ausencia das duas replicas retorna unknown sem perfil inventado', () => {
  const reconcile = loadReconciler();
  const result = reconcile(null, null, NOW);

  assert.equal(result.statusKey, 'unknown');
  assert.equal(result.source, 'none');
  assert.equal(result.data, null);
  assert.deepEqual(Array.from(result.warnings), ['profile_missing']);
});

test('loader efetivo valida uid e tenant pelo contexto autenticado', () => {
  const service = read('firebaseService.js');
  const block = blockBetween(
    service,
    'async function getEffectiveUserProfile',
    'async function resolveSessionContextForUser',
  );

  assert.match(block, /String\(currentUser\.uid \|\| ''\) !== requestedUid/);
  assert.match(block, /resolveSessionContextForUser\(currentUser\)/);
  assert.match(block, /companies\/\$\{companyId\}\/users\/\$\{requestedUid\}/);
  assert.match(block, /reconcileSubscriptionReplicaProfiles\(rootProfile, tenantProfile\)/);
  assert.match(block, /root_profile_unavailable/);
  assert.match(block, /tenant_profile_unavailable/);
  assert.doesNotMatch(block, /localStorage|sessionStorage/);
});

test('perfil efetivo usa single-flight invalidado junto com a sessao Auth', () => {
  const service = read('firebaseService.js');
  const reset = blockBetween(
    service,
    'function resetSessionSingleFlights',
    'function isCanonicalAuthGenerationCurrent',
  );

  assert.match(service, /let effectiveUserProfilePromise = null;/);
  assert.match(service, /getEffectiveUserProfile: getEffectiveUserProfile/);
  assert.match(reset, /effectiveUserProfilePromise = null;/);
  assert.match(reset, /effectiveUserProfileSnapshot = null;/);
});

test('login e tela de assinatura usam o perfil efetivo compartilhado', () => {
  const auth = read('auth.js');
  const status = read('subscription-status.html');
  const authLoader = blockBetween(
    auth,
    'async function loadUserProfileFromFirebase',
    'function readCachedSuperAdminFlag',
  );
  const statusLoader = blockBetween(
    status,
    'async function loadCurrentUserSnapshot',
    'async function loadSubscriptionSettingsSafe',
  );

  assert.match(authLoader, /firebaseService\.getEffectiveUserProfile/);
  assert.match(authLoader, /result && result\.success && result\.data/);
  assert.match(statusLoader, /firebaseService\.getEffectiveUserProfile/);
  assert.doesNotMatch(statusLoader, /candidates\.push\(`companies\/\$\{tenantId\}\/users\/\$\{uid\}`\)/);
  assert.doesNotMatch(statusLoader, /candidates\.push\(`users\/\$\{uid\}`\)/);
});
