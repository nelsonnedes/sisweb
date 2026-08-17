/**
 * tests/rules-e-namespace-bugs.test.mjs
 *
 * Regression guards para os BUGs encontrados na navegação de 2026-08-16:
 * - BUG-A: Folha `cargos` com `Permission denied` (regra companies/$companyId/cargos ausente)
 * - BUG-B: NF-e seed `fiscal/naturezas-operacao` `PERMISSION_DENIED` (nó fiscal sem .write)
 * - BUG-C: Dupla prefixação `companies/{t}/companies/{t}/...` em checkCandidates
 */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const rules = JSON.parse(read('database.rules.json'));
const companyRules = rules.rules.companies['$companyId'];

test('BUG-A: companies/$companyId/cargos existe com .read e .write (Folha Permission denied)', () => {
  assert.ok(companyRules.cargos, 'nó companies/$companyId/cargos deve existir');
  assert.ok(companyRules.cargos['.read'], 'cargos deve ter .read');
  assert.ok(companyRules.cargos['.write'], 'cargos deve ter .write');
  assert.match(companyRules.cargos['.read'], /auth\.token\.superadmin/, 'read deve aceitar superadmin');
});

test('BUG-B: nó fiscal deve ter .write (NF-e seed naturezas-operacao)', () => {
  assert.ok(companyRules.fiscal, 'nó companies/$companyId/fiscal deve existir');
  assert.ok(companyRules.fiscal['.read'], 'fiscal deve ter .read');
  assert.ok(companyRules.fiscal['.write'], 'fiscal deve ter .write (sem isso, PERMISSION_DENIED no seed)');
});

test('BUG-C: checkCandidates usa getNamespacedPath(c) sem concatenação fixa (dupla prefixação)', () => {
  const src = read('firebaseService.js');
  assert.match(src, /const checkCandidates = candidates\.map\(c => getNamespacedPath\(c\)\)/,
    'checkCandidates deve mapear via getNamespacedPath(c)');
  assert.doesNotMatch(src, /candidates\.map\(c => `companies\/\$\{tenantId\}\/\$\{c\}`\)/,
    'concatenação fixa companies/${tenantId}/${c} deve ter sido removida');
});