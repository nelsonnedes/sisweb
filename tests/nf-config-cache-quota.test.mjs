import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const nfConfig = readFileSync('nf-config.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

test('espelho de config nunca quebra o save (quota do localStorage)', () => {
  assert.match(nfConfig, /function espelharCacheConfig\(tenantId, config\)/);
  assert.match(
    nfConfig,
    /try \{\s*\n\s*localStorage\.setItem\(localKey\(tenantId\), JSON\.stringify\(config\)\);\s*\n\s*\} catch/,
    'setItem do espelho com try/catch',
  );
  assert.doesNotMatch(
    nfConfig,
    /^\s*localStorage\.setItem\(localKey\(tenantId\), JSON\.stringify\((persisted|result\.config)\)\);/m,
    'saveConfig sem setItem direto (sem guarda)',
  );
});

test('fallback local do HTML resiste a quota excedida', () => {
  const i = html.indexOf('// Fallback: salvar apenas no localStorage');
  assert.ok(i >= 0, 'bloco fallback existe');
  const bloco = html.slice(i, i + 600);
  assert.match(bloco, /try \{/, 'setItem do fallback com try/catch');
});
