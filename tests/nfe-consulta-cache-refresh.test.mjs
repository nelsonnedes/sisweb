import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync('notas-fiscais.html', 'utf8');

test('cache de leitura: invalidação explícita pós-backend (filtro atualiza sem reload)', () => {
  assert.match(html, /function nfInvalidarCacheConsulta\(tid\)/);
  assert.match(html, /svc\.invalidateReadCacheForPath\(`companies\/\$\{tid\}\/fiscal\/notas\/nfe`\)/);
  assert.match(html, /svc\.invalidateReadCacheForPath\(`companies\/\$\{tid\}\/fiscal\/notas`\)/);
});

test('cancelamento: invalida antes de recarregar a Consulta', () => {
  // O cancel grava no BACKEND (Admin SDK) — sem invalidar, o filtro relê o
  // snapshot anterior e a nota cancelada permanece na lista até reload total.
  assert.match(
    html,
    /nfInvalidarCacheConsulta\(tid\);\s*\n\s*consultarNotas\(\);/,
    'invalidação imediatamente antes do consultarNotas do cancelamento',
  );
});

test('inutilização: invalida antes de recarregar a Consulta', () => {
  assert.match(html, /nfInvalidarCacheConsulta\(obterTenantIdNF\(\)\);\s*\n\s*consultarNotas\(\);/);
});
