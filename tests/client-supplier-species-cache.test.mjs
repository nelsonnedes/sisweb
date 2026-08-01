import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('firebase-service possui invalidacao automatica de cache em lote ao salvar/excluir', () => {
  const code = read('modules/core/firebase-service.js');
  assert.match(code, /invalidateCollectionCache\(path\)/);
  assert.match(code, /invalidateCache\(path\)/);
  assert.match(code, /this\.invalidateCollectionCache\(key\);/);
});

test('firebase-service bloqueia exclusao acidental de nos raiz e IDs invalidos', () => {
  const code = read('modules/core/firebase-service.js');
  assert.match(code, /Exclusão de nó raiz ou ID inválido bloqueada por segurança/);
  assert.match(code, /cleanPath === 'fornecedores'/);
  assert.match(code, /cleanPath\.endsWith\('\/undefined'\)/);
});

test('js/client.js invalida cache ao salvar e excluir clientes', () => {
  const code = read('js/client.js');
  assert.match(code, /window\.firebaseService\.invalidateCache\('clients'\)/);
  assert.match(code, /ensureAuthAndTenant\(\)/);
  assert.match(code, /cleanId === 'undefined'/);
});

test('js/fornecedor.js invalida cache e valida ID ao salvar e excluir fornecedores', () => {
  const code = read('js/fornecedor.js');
  assert.match(code, /window\.firebaseService\.invalidateCache\('fornecedores'\)/);
  assert.match(code, /ensureTenantContext\(\)/);
  assert.match(code, /cleanId === 'undefined'/);
});

test('js/species.js invalida cache ao salvar e excluir especies', () => {
  const code = read('js/species.js');
  assert.match(code, /window\.firebaseService\.invalidateCache\('especies'\)/);
  assert.match(code, /ensureAuthAndTenant\(\)/);
});

test('romaneios-client-save-fix.js invalida cache em saveClient e deleteClient', () => {
  const code = read('romaneios-client-save-fix.js');
  assert.match(code, /window\.firebaseService\.invalidateCache\('clients'\)/);
});
