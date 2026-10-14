import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const svc = readFileSync(new URL('../firebaseService.js', import.meta.url), 'utf8');
const pct = readFileSync(
  new URL('../modules/romaneiopct/modal-lista-romaneios-pct.js', import.meta.url),
  'utf8',
);
const folha = readFileSync(
  new URL('../folha_pagamento/folha-firebase-manager.js', import.meta.url),
  'utf8',
);

function logoutBody() {
  const start = svc.indexOf('async logout()');
  assert.ok(start >= 0, 'logout existe');
  return svc.slice(start, svc.indexOf('},', start) + 3);
}

test('logout encerra listeners antes do signOut e limpa users/roles', () => {
  const body = logoutBody();
  assert.ok(/unsubscribeAllRealtimeSubscriptions\(\)/.test(body), 'registry encerrado');
  assert.ok(/runSessionTeardowns\(\)/.test(body), 'teardowns de módulos executados');
  assert.ok(body.indexOf('runSessionTeardowns()') < body.indexOf('signOut(auth)'), 'antes do signOut');
  assert.ok(/localStorage\.removeItem\('users'\)/.test(body), 'users removido (menu lê users)');
  assert.ok(/localStorage\.removeItem\('roles'\)/.test(body), 'roles removido (menu lê roles)');
});

test('teardown de sessão registrado e exportado; troca de tenant dispara', () => {
  assert.ok(/function registerSessionTeardown\(fn\)/.test(svc), 'registry existe');
  assert.ok(/function runSessionTeardowns\(\)/.test(svc), 'executor existe');
  assert.ok(/registerSessionTeardown:\s*registerSessionTeardown/.test(svc), 'exportado no service');
  const setTenant = svc.slice(svc.indexOf('function setTenantId(id)'), svc.indexOf('function setTenantId(id)') + 2200);
  assert.ok(/previous !== window\.appTenantId/.test(setTenant), 'só age em troca real');
  assert.ok(/runSessionTeardowns\(\)/.test(setTenant), 'troca executa teardowns');
  assert.ok(/unsubscribeAllRealtimeSubscriptions\(\)/.test(setTenant), 'troca encerra registry');
});

test('modal PCT: closeModal desinscreve + registra teardown de sessão', () => {
  assert.ok(/function stopRealtimeRomaneiosPct\(\)/.test(pct), 'stop existe');
  const closeStart = pct.indexOf('function closeModal()');
  const closeBody = pct.slice(closeStart, closeStart + 400);
  assert.ok(/stopRealtimeRomaneiosPct\(\)/.test(closeBody), 'close desinscreve');
  assert.ok(/registerSessionTeardown\(stopRealtimeRomaneiosPct\)/.test(pct), 'teardown registrado');
});

test('manager da folha registra cleanup no teardown de sessão', () => {
  assert.ok(/registerSessionTeardown\(\(\) => \{ try \{ manager\.cleanup\(\);/.test(folha), 'cleanup registrado');
});
