/**
 * tests/healthcheck-singleton-compliance.test.mjs
 *
 * Regression guard do Passo 3 (healthcheck corrigido):
 * 1. O healthcheck deve reconhecer o bootstrap canônico do Firebase
 *    (firebase-init.js com cachebuster ?v=, compat bridge, firebaseService.js)
 * 2. folha_pagamento/folha.html (publicada) deve usar o singleton e
 *    nunca mais importar Firebase direto do CDN, usar signInAnonymously
 *    ou inicializar app inline
 * 3. Todas as páginas publicadas com Firebase devem passar pelo
 *    bootstrap canônico (sem CDN direto, sem anon auth, sem init duplicado)
 * 4. romaneiotl.html e romaneiotora.html não devem conter initializeApp
 *    inline nem referência a signInAnonymously
 */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const allowlist = JSON.parse(readFileSync(new URL('../hosting-files.json', import.meta.url), 'utf8'));

const CDN_RE = /(?:from\s+|import\s*\()\s*['"][^'"]*firebasejs\//gi;
const CDN_SCRIPT_RE = /(?:src|href)="[^"]*firebasejs\//gi;
const INIT_RE = /from\s*['"]\.{0,2}\/firebase-init\.js(?:\?[^'"]*)?['"]|import\(['"]\.{0,2}\/firebase-init\.js(?:\?[^'"]*)?/gi;
const BRIDGE_RE = /from\s*['"]\.{0,2}\/firebase-compat-bridge\.js(?:\?[^'"]*)?['"]|import\(['"]\.{0,2}\/firebase-compat-bridge\.js(?:\?[^'"]*)?/gi;
const SERVICE_RE = /(?:from\s*['"]|import\(['"]|src\s*=\s*['"])(?:\.{0,2}\/)?firebaseService\.js(?:\?[^'"]*)?['"]|src\s*=\s*['"]src\/services\/firebaseService\.js(?:\?[^'"]*)?['"]/gi;
const ANON_RE = /signInAnonymously/gi;
const INIT_APP_RE = /(?:firebase\.)?initializeApp\s*\(/gi;

function extractRegex(source, name) {
  const m = source.match(new RegExp(`${name}\\s*=\\s*(/(?:[^/\\\\]|\\\\.)+/[a-z]*)`));
  assert.ok(m, `regex ${name} não encontrado no healthcheck`);
  return new Function(`return ${m[1]}`)();
}

function testRe(re, input, label) {
  re.lastIndex = 0;
  assert.ok(re.test(input), label);
}

test('healthcheck-firebase-sdk.mjs reconhece cachebuster ?v= no firebase-init', () => {
  const source = read('tools/healthcheck-firebase-sdk.mjs');

  const initRe = extractRegex(source, 'FIREBASE_INIT_IMPORT_RE');
  testRe(initRe, "from './firebase-init.js?v=21eb04e409d8'", 'deve aceitar ?v= no import estático');
  testRe(initRe, "import('../firebase-init.js?v=21eb04e409d8')", 'deve aceitar ../ + ?v=');
  testRe(initRe, "from './firebase-init.js'", 'deve aceitar sem cachebuster');

  const bridgeRe = extractRegex(source, 'COMPAT_BRIDGE_IMPORT_RE');
  testRe(bridgeRe, "import './firebase-compat-bridge.js?v=21eb04e409d8'", 'deve reconhecer compat bridge com ?v=');

  const serviceRe = extractRegex(source, 'FIREBASE_SERVICE_IMPORT_RE');
  testRe(serviceRe, "import('./firebaseService.js?v=676ba9f2a922')", 'deve reconhecer firebaseService.js');
  testRe(serviceRe, '<script src="firebaseService.js?v=676ba9f2a922"', 'deve reconhecer script sem ./');
  testRe(serviceRe, '<script src="src/services/firebaseService.js?v=4179fa979425"', 'deve reconhecer src/services');

  const anonRe = extractRegex(source, 'SIGNIN_ANONYMOUS_RE');
  testRe(anonRe, 'signInAnonymously()', 'deve detectar signInAnonymously');

  const initAppRe = extractRegex(source, 'INLINE_INITIALIZE_APP_RE');
  testRe(initAppRe, 'firebase.initializeApp(firebaseConfig)', 'deve detectar initializeApp inline');

  assert.match(source, /SCAN_SUBDIRS/, 'deve varrer subdiretórios de deploy');
});

test('folha_pagamento/folha.html usa singleton firebase-init.js (sem CDN direto, sem anon, sem init duplicado)', () => {
  const html = read('folha_pagamento/folha.html');
  assert.match(html, /from\s*['"]\.\.\/firebase-init\.js\?v=/,
    'deve importar o singleton via ../firebase-init.js?v=');
  assert.doesNotMatch(html, CDN_RE, 'não deve importar Firebase direto do CDN');
  assert.doesNotMatch(html, CDN_SCRIPT_RE, 'não deve ter script direto do CDN');
  assert.doesNotMatch(html, ANON_RE, 'não deve conter signInAnonymously');
  assert.doesNotMatch(html, INIT_APP_RE, 'não deve inicializar app inline (singleton faz isso)');
  assert.doesNotMatch(html, /firebaseConfig\s*=/, 'não deve duplicar credenciais');
  assert.match(html, /window\.firebaseAuth\s*=/, 'deve expor firebaseAuth');
  assert.match(html, /window\.firebaseOnAuthStateChanged\s*=/, 'deve expor onAuthStateChanged');
});

test('romaneiotl.html não tem bloco morto de initializeApp nem anon auth', () => {
  const html = read('romaneiotl.html');
  assert.doesNotMatch(html, INIT_APP_RE, 'não deve conter initializeApp inline');
  assert.doesNotMatch(html, ANON_RE, 'não deve conter signInAnonymously');
  assert.match(html, /aguardarFirebaseTLCompat/, 'deve manter espera do compat bridge');
});

test('romaneiotora.html não referencia signInAnonymously (nem em comentário)', () => {
  const html = read('romaneiotora.html');
  assert.doesNotMatch(html, ANON_RE, 'não deve conter signInAnonymously');
});

test('todas as páginas publicadas com Firebase passam pelo bootstrap canônico', () => {
  const publishedHtmls = allowlist.filter((f) => f.toLowerCase().endsWith('.html'));
  assert.ok(publishedHtmls.length >= 25, `allowlist com poucos HTMLs? (${publishedHtmls.length})`);

  const violations = [];
  for (const file of publishedHtmls) {
    let html;
    try {
      html = read(file);
    } catch {
      violations.push(`${file}: ARQUIVO AUSENTE`);
      continue;
    }
    const hasCanonical = INIT_RE.test(html) || BRIDGE_RE.test(html) || SERVICE_RE.test(html);
    const cdnDirect = (html.match(CDN_RE) || []).length + (html.match(CDN_SCRIPT_RE) || []).length;
    const anon = (html.match(ANON_RE) || []).length;
    const initApp = (html.match(INIT_APP_RE) || []).length;
    const usesFirebase = cdnDirect > 0 || anon > 0 || initApp > 0 || hasCanonical;

    if (!usesFirebase) continue;
    if (!hasCanonical) violations.push(`${file}: FIREBASE SEM BOOTSTRAP CANÔNICO`);
    if (cdnDirect > 0) violations.push(`${file}: CDN DIRETO (${cdnDirect})`);
    if (anon > 0) violations.push(`${file}: signInAnonymously (${anon})`);
    if (initApp > 0) violations.push(`${file}: initializeApp inline (${initApp})`);
  }

  assert.deepEqual(violations, [], `Páginas publicadas violando o singleton:\n${violations.join('\n')}`);
});
