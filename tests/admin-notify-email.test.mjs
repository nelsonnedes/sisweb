import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync('scripts/admin/admin-main.js', 'utf8');
const adminHtml = fs.readFileSync('admin.html', 'utf8');
const firebase = JSON.parse(fs.readFileSync('firebase.json', 'utf8'));

test('Notificar abre modal com modelos e mensagem personalizada', () => {
  assert.match(src, /Notificar cliente por e-mail/);
  assert.match(src, /value="atual"/);
  assert.match(src, /value="empresa"/);
  assert.match(src, /value="fluxo"/);
  assert.match(src, /value="personalizada"/);
  assert.match(src, /notifyEmailSubject/);
  assert.match(src, /notifyEmailBody/);
  assert.match(src, /window\.AdminUI\.modal/);
  assert.match(src, /sendSubscriptionEmail/);
});

test('CSP do admin permite scripts externos sem inline theme script', () => {
  assert.ok(!adminHtml.includes('// Bootstrap de tema (anti-FOUC)'));
  assert.match(adminHtml, /js\/admin-theme-bootstrap\.js/);
  const block = firebase.hosting.headers.find(h => h.source === '/admin.html');
  assert.ok(block);
  const csp = block.headers.find(h => h.key === 'Content-Security-Policy').value;
  assert.match(csp, /script-src-attr 'unsafe-inline'/);
  assert.match(csp, /https:\/\/apis\.google\.com/);
  assert.doesNotMatch(csp, /script-src [^;]*'unsafe-inline'/);
});
