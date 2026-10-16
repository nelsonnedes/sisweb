import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync('user-profile.html', 'utf8');

test('fallback de foto nunca grava o arquivo original em base64', () => {
  assert.doesNotMatch(
    html,
    /const imageData = e\.target\.result;\s*\n\s*localStorage\.setItem\('userPhoto', imageData\)/,
    'setItem direto do resultado do FileReader (sem resize/guarda)',
  );
});

test('fallback reduz a foto e guarda o setItem com try/catch', () => {
  assert.match(html, /function reduzirFotoParaCache\(dataUrl, cb\)/);
  assert.match(html, /const MAX = 256/);
  assert.match(html, /toDataURL\('image\/jpeg', 0\.8\)/);
  const i = html.indexOf('// Fallback para Base64 local caso Storage falhe');
  assert.ok(i >= 0, 'bloco fallback existe');
  const bloco = html.slice(i, i + 1200);
  assert.match(bloco, /reduzirFotoParaCache\(rawData/, 'fallback usa o redutor');
  assert.match(bloco, /try \{\s*\n\s*localStorage\.setItem\('userPhoto', imageData\)/, 'setItem com try/catch');
});
