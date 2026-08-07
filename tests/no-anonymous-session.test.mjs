import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('romaneiotl.html não cria sessão anônima e inicia listener realtime só com sessão real', () => {
  const html = read('romaneiotl.html');

  assert.match(html, /from '\.\/firebase-init\.js\?v=[^']+'/);
  assert.match(html, /import '\.\/firebase-compat-bridge\.js\?v=[^']+'/);
  assert.doesNotMatch(html, /signInAnonymously/);
  assert.match(html, /auth\.onAuthStateChanged/);
  assert.match(html, /sem sessão anônima/);
  assert.match(html, /window\.firebaseAuthUser = null/);
  assert.match(html, /function iniciarListenerRealtimeTL\(\)/);
  assert.match(html, /window\.__tlRealtimeAttached/);
  assert.match(html, /db\.ref\(usePath\)\.on\('value'/);
});

test('firebaseService.unified.js nunca cria sessão anônima durante a inicialização', () => {
  const source = read('firebaseService.unified.js');

  assert.doesNotMatch(source, /signInAnonymously/);
  assert.match(source, /Nenhum usuário autenticado — sessão anônima não será criada/);
  assert.match(source, /this\.currentUid = user\.uid/);
  assert.match(source, /this\.currentUid = null/);
  assert.match(source, /prosseguindo sem autenticação/);
});
