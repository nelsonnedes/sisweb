import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Trava a ressurreição da Lista de Clientes (PCT): delete mostrava sucesso
// mas o cliente reaparecia — o cache de leitura (clients = 3 min TTL)
// sobrevivia ao delete e o refresh relia dado velho.
const svc = readFileSync('firebaseService.js', 'utf8');
const modal = readFileSync('modules/romaneiopct/modal-clientes-pct.js', 'utf8');

test('deleteFromFirebase invalida a coleção-pai (anti-ressurreição do cache)', () => {
  assert.match(svc, /Anti-ressurreição/);
  assert.match(svc, /const noNs = String\(path/);
  assert.match(svc, /while \(segs\.length > 1\)/);
  assert.match(svc, /invalidateReadCacheForPath\(segs\.join\('\/'\)\)/);
});

test('delete de cliente PCT resolve multi-chave e verifica (fail-closed)', () => {
  assert.match(modal, /pushChave\(clientId\)/);
  assert.match(modal, /pushChave\(k\)/);
  assert.match(modal, /checkClientStillExists\(chaves, normName\)/);
  assert.match(modal, /Exclusão não confirmada no servidor/);
  assert.match(modal, /purgeLocalClientMirrors\(chaves, normName\)/);
  assert.match(modal, /function purgeLocalClientMirrors/);
  assert.match(modal, /function checkClientStillExists/);
});
