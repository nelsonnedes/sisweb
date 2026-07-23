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

function parseAnyDateSafe(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function loadBrowserResolvers() {
  const authSource = read('auth.js');
  const serviceSource = read('firebaseService.js');
  const authBlock = blockBetween(authSource, 'function resolveSubscriptionStatus', 'function resolveSubscriptionRedirect');
  const serviceBlock = blockBetween(serviceSource, 'function resolveSubscriptionStatusForWriteGuard', 'function isWritePathProtectedBySubscription');
  const context = {
    Date,
    Number,
    Math,
    parseInt,
    parseAnyDateSafe,
    localStorage: { getItem: () => null }
  };
  vm.createContext(context);
  vm.runInContext(`${authBlock}\n${serviceBlock}\nthis.resolveAuth = resolveSubscriptionStatus; this.resolveWrite = resolveSubscriptionStatusForWriteGuard;`, context);
  return context;
}

test('status efetivo usa endDate antes de marcador active legado', () => {
  const { resolveAuth, resolveWrite } = loadBrowserResolvers();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const expired = { subscriptionStatus: 'active', subscription: { active: true, endDate: past } };
  const active = { subscriptionStatus: 'active', subscription: { active: true, endDate: future } };
  const undated = { subscriptionStatus: 'active', subscription: { active: true } };

  assert.equal(resolveAuth(expired), 'expired');
  assert.equal(resolveWrite(expired), 'expired');
  assert.equal(resolveAuth(active), 'active');
  assert.equal(resolveWrite(active), 'active');
  assert.equal(resolveAuth(undated), 'active');
  assert.equal(resolveWrite(undated), 'active');
});

test('trial vencido nao permanece trial_active', () => {
  const { resolveAuth, resolveWrite } = loadBrowserResolvers();
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const user = { subscriptionStatus: 'trial_active', subscription: { active: true, type: 'free_trial', endDate: past } };

  assert.equal(resolveAuth(user), 'expired');
  assert.equal(resolveWrite(user), 'expired');
});

test('grantReadOnlyGrace usa marcador ativo condicionado a data futura', () => {
  const functionsSource = read('functions/index.js');
  const block = blockBetween(functionsSource, 'exports.grantReadOnlyGrace', 'exports.requestSubscriptionExtension');

  assert.match(block, /const activeMarker =/);
  assert.match(block, /activeMarker && \(!endDate \|\| endDate\.getTime\(\) > Date\.now\(\)\)/);
  assert.doesNotMatch(block, /const isActive = \(user\.subscriptionStatus === 'active'[\s\S]*\|\| \(subscription\.active/);
});

test('pagina descreve carencia de leitura sem dizer que assinatura expirada esta ativa', () => {
  const html = read('subscription-status.html');

  assert.match(html, /Modo leitura temporário disponível/);
  assert.doesNotMatch(html, /Modo leitura ativo até o vencimento/);
});
