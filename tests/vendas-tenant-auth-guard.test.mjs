import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('vendas nao pre-carrega tenant por company_info antes do auth', () => {
  const html = read('vendas.html');
  const readyScriptIndex = html.indexOf('window.__siswebFirebaseServiceReady');
  assert.notEqual(readyScriptIndex, -1, 'bootstrap do firebaseService precisa existir');
  const beforeFirebaseModule = html.slice(0, readyScriptIndex);

  assert.doesNotMatch(beforeFirebaseModule, /localStorage\.getItem\('company_info'\)/);
  assert.doesNotMatch(beforeFirebaseModule, /window\.appTenantId\s*=\s*String\(tenant\)/);
  assert.match(html, /firebaseService\.js\?v=[^"'\s]+/);
  assert.match(html, /vendas\.js\?v=[^"'\s]+/);
});

test('vendas aguarda tenant autenticado antes de ler dados operacionais', () => {
  const js = read('vendas.js');
  const initStart = js.indexOf('async function inicializarSistema()');
  const loadCall = js.indexOf('await carregarDados();', initStart);
  const guardCall = js.indexOf('await garantirContextoEmpresaVendas();', initStart);

  assert.match(js, /async function garantirContextoEmpresaVendas\(\)/);
  assert.match(js, /window\.__siswebFirebaseServiceReady/);
  assert.match(js, /function isFirebaseOfflineModeVendas\(\)/);
  assert.match(js, /resolveAuthenticatedTenant\(\{ timeoutMs: 4500, allowCached: isOffline \}\)/);
  assert.doesNotMatch(js, /fallback: true, offline: true/);
  assert.doesNotMatch(js, /if \(tenant\) return \{ success: true, companyId: tenant, fallback: true \};/);
  assert.ok(guardCall > initStart, 'guarda precisa estar dentro da inicializacao');
  assert.ok(loadCall > guardCall, 'carregarDados deve acontecer depois da guarda');
  assert.match(js, /limparContextoEmpresaVendasInseguro\(\)/);
});

test('firebaseService expoe resolvedor central de tenant autenticado', () => {
  const service = read('firebaseService.js');

  assert.match(service, /async function resolveAuthenticatedTenant\(options = \{\}\)/);
  assert.match(service, /resolveAuthenticatedTenant: resolveAuthenticatedTenant/);
  assert.match(service, /resolveAuthenticatedTenant,/);
  assert.match(service, /const firebaseOffline = typeof window !== 'undefined'/);
  assert.doesNotMatch(service, /authenticated: false, cached: true/);
  assert.match(service, /const previousTenant = normalizeTenantContextValue/);
  assert.match(service, /const safePrevious = previousTenant && previousTenant !== tenant \? \{\} : previous/);
});
