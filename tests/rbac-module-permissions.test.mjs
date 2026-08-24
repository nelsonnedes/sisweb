import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const {
  MODULE_PERMISSIONS,
  MODULE_KEYS,
  resolveModuleKey,
  normalizePermissions,
  defaultPermissionsForRole,
  resolveMemberModulePermissions,
  modulePermissionAllows,
  isValidModuleKey,
} = require('../functions/module-permissions.js');

test('dicionario de modulos contem chaves canonicas e labels', () => {
  assert.ok(MODULE_KEYS.length >= 10);
  for (const key of MODULE_KEYS) {
    assert.ok(MODULE_PERMISSIONS[key], `modulo ${key} precisa ter entrada`);
    assert.ok(MODULE_PERMISSIONS[key].label, `modulo ${key} precisa ter label`);
  }
  assert.ok(MODULE_KEYS.includes('finance'));

  // chaves invalidas nao fariam parte do dicionario
  assert.ok(!MODULE_KEYS.includes('não-existe'));
});

test('aliases resolvem para o modulo canonico', () => {
  assert.equal(resolveModuleKey('credit'), '');
  assert.equal(resolveModuleKey('financas'), 'finance');
  assert.equal(resolveModuleKey('financial'), 'finance');
  assert.equal(resolveModuleKey('folha'), 'payroll');
  assert.equal(resolveModuleKey('especies'), 'species');
  assert.equal(resolveModuleKey('nfe'), 'fiscal');
  assert.equal(resolveModuleKey('SALES'), 'sales');
  assert.equal(resolveModuleKey(''), '');
});

test('isValidModuleKey aceita modulo e alias, rejeita invalido', () => {
  assert.equal(isValidModuleKey('sales'), true);
  assert.equal(isValidModuleKey('financas'), true);
  assert.equal(isValidModuleKey('adslkfh'), false);
});

test('normalizePermissions: boolean true vira completo, objeto granular preserva sub-acoes', () => {
  const n = normalizePermissions({ sales: true, finance: { read: true }, bogus: true });
  assert.deepEqual(n.sales, { enabled: true, read: true, write: true, manage: true });
  assert.deepEqual(n.finance, { enabled: false, read: true, write: false, manage: false });
  // chave fora do dicionario (bogus) é descartada
  assert.equal(n.bogus, undefined);
});

test('normalizePermissions: chaves fora do dicionario sao descartadas', () => {
  const n = normalizePermissions({ myCustomThing: true });
  assert.deepEqual(n, {});
});

test('default: owner/admin/company_admin tem todas as chaves habilitadas', () => {
  for (const role of ['owner', 'admin', 'company_admin']) {
    const d = defaultPermissionsForRole(role);
    assert.equal(Object.keys(d).length, MODULE_KEYS.length, `${role} deve ter todas as chaves`);
    for (const k of MODULE_KEYS) assert.equal(d[k].enabled, true, `${role}.${k} deve estar habilitado`);
  }
});

test('default: papel finance habilita apenas finance (comportamento atual preservado)', () => {
  const d = defaultPermissionsForRole('finance');
  assert.ok(d.finance);
  assert.equal(d.finance.enabled, true);
  assert.equal(Object.keys(d).length, 1);
  // same para aliases financeiros
  const d2 = defaultPermissionsForRole('financial');
  assert.ok(d2.finance);
});

test('resolveMemberModulePermissions: admin mantém acesso total apos mesclar', () => {
  const rec = resolveMemberModulePermissions({ role: 'admin' });
  assert.equal(rec.finance.enabled, true);
  assert.equal(rec.sales.enabled, true);
});

test('resolveMemberModulePermissions: mescla papel + permisoes explicitas (nao revoga)', () => {
  // finance por papel + sales concedida explicitamente
  const rec = resolveMemberModulePermissions({ role: 'finance', permissions: { sales: true } });
  assert.ok(rec.finance);
  assert.equal(rec.finance.enabled, true);
  assert.ok(rec.sales);
  assert.equal(rec.sales.enabled, true);
});

test('modulePermissionAllows: leitura granular respeita read', () => {
  // viewer tem apenas finance.read -> leitura OK, escrita NAO
  const rec = { role: 'viewer', permissions: { finance: { read: true } } };
  assert.equal(modulePermissionAllows(rec, 'finance', 'read'), true);
  assert.equal(modulePermissionAllows(rec, 'finance', 'write'), false);
  assert.equal(modulePermissionAllows(rec, 'finance', 'enabled'), false);
});
