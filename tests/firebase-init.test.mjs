/**
 * tests/firebase-init.test.mjs
 *
 * Verifica que todos os símbolos exportados por firebase-init.js estão
 * corretamente definidos no arquivo de origem e que nenhum export foi
 * removido acidentalmente (regression guard).
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/**
 * Extrai a lista de símbolos exportados do bloco `export { ... }`
 * no final do arquivo firebase-init.js.
 */
function extractExports(source) {
  const exportBlock = source.match(/export\s*\{([^}]+)\}/);
  if (!exportBlock) {
    throw new Error('Bloco export { ... } não encontrado em firebase-init.js');
  }
  const lines = exportBlock[1]
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('//'));

  const exports = [];
  for (const line of lines) {
    // Pula comentários em linha própria (já filtrados acima, mas segurança)
    if (line.startsWith('//')) continue;

    // Lida com aliases: `_app as app,` ou `ref, set, get,`
    const parts = line.split(',').filter(p => p.trim());
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Comentários no final da linha: `getBlob,  // comentário`
      const clean = trimmed.replace(/\/\/.*$/, '').trim();
      if (!clean) continue;

      // Se tem ` as `, pega o nome após as (alias)
      // Ex: `_app as app` → nome exportado é `app`
      // Ex: `updatePassword as firebaseUpdatePassword` → nome exportado é `firebaseUpdatePassword`
      const aliasMatch = clean.match(/(\S+)\s+as\s+(\S+)/);
      if (aliasMatch) {
        exports.push({ internal: aliasMatch[1], exported: aliasMatch[2] });
      } else {
        exports.push({ internal: clean, exported: clean });
      }
    }
  }
  return exports;
}

/**
 * Verifica que o símbolo `name` (ou seu alias interno) aparece
 * em algum lugar do código fonte (import, declaração, etc.)
 */
function symbolDefined(source, name) {
  // Verifica se o símbolo aparece como:
  // - Import: `import { ..., name, ... } from` ou `import { ..., name as alias, ... }`
  // - Declaração: `let name;` ou `const name =` ou `function name()`
  // - Atribuição: `name = ...`
  const patterns = [
    new RegExp(`import\\s*\\{[^}]*\\b${escapeRegex(name)}\\b[^}]*\\}\\s*from`),
    new RegExp(`\\blet\\s+${escapeRegex(name)}\\b`),
    new RegExp(`\\bconst\\s+${escapeRegex(name)}\\b`),
    new RegExp(`\\bfunction\\s+${escapeRegex(name)}\\b`),
    new RegExp(`\\b${escapeRegex(name)}\\s*=`),
    new RegExp(`_${escapeRegex(name)}\\b`)  // internal vars like _app, _auth
  ];
  return patterns.some(p => p.test(source));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('firebase-init.js exporta símbolos esperados', () => {
  const source = read('firebase-init.js');
  const exports = extractExports(source);

  // Verifica exports essenciais obrigatórios
  const requiredExports = [
    'app', 'auth', 'db', 'storage', 'functions',
    'ref', 'set', 'get', 'remove', 'push', 'update',
    'onValue', 'off', 'serverTimestamp',
    'signOut', 'onAuthStateChanged',
    'signInWithEmailAndPassword',
    'httpsCallable',
    'storageRef', 'uploadBytes', 'getDownloadURL', 'deleteObject',
    'getBlob',
    'getAuth', 'getDatabase', 'getStorage', 'initializeApp', 'getApps',
    'FIREBASE_CONFIG'
  ];

  const exportedNames = exports.map(e => e.exported);

  for (const sym of requiredExports) {
    assert.ok(
      exportedNames.includes(sym),
      `Símbolo obrigatório "${sym}" não encontrado nos exports`
    );
  }

  // Verifica que NÃO exporta símbolos que deveriam estar mortos
  const forbiddenExports = ['startCanonicalAuthObserver'];
  for (const sym of forbiddenExports) {
    assert.ok(
      !exportedNames.includes(sym),
      `Símbolo proibido "${sym}" ainda está sendo exportado`
    );
  }
});

test('firebase-init.js — todos os exports têm definição correspondente no código', () => {
  const source = read('firebase-init.js');
  const exports = extractExports(source);

  const undefinedSymbols = [];
  for (const exp of exports) {
    // Para aliases (ex: _app as app), verifica que o nome interno existe
    // Para símbolos diretos (ex: ref), verifica que existe
    if (!symbolDefined(source, exp.internal)) {
      // Tenta com prefixo _ (para casos como _app que é `let _app`)
      if (!symbolDefined(source, `_${exp.internal}`)) {
        undefinedSymbols.push(exp.exported);
      }
    }
  }

  if (undefinedSymbols.length > 0) {
    // Tenta um lookup mais detalhado para debug
    const details = undefinedSymbols.map(sym => {
      const idx = source.indexOf(sym);
      return idx >= 0
        ? `${sym} (encontrado na posição ${idx})`
        : `${sym} (NÃO encontrado no arquivo!)`;
    });
    assert.fail(`Símbolos sem definição aparente no código:\n  ${details.join('\n  ')}`);
  }
});

test('firebase-init.js não contém referências diretas a versões obsoletas', () => {
  const source = read('firebase-init.js');

  // Todas as URLs devem usar v10.7.1
  const versionMatches = source.match(/firebasejs\/(\d+\.\d+\.\d+)\//g) || [];
  for (const v of versionMatches) {
    const ver = v.match(/firebasejs\/(\d+\.\d+\.\d+)\//)[1];
    assert.equal(ver, '10.7.1', `Versão incorreta encontrada: ${ver}`);
  }

  // Não deve conter imports de compat
  assert.doesNotMatch(source, /-compat\.js/, 'firebase-init.js não deve importar compat SDK');
});

test('firebase-compat-bridge.js importa de firebase-init.js corretamente', () => {
  const source = read('firebase-compat-bridge.js');

  // Deve importar de firebase-init.js
  assert.match(source, /from\s+['"]\.\/firebase-init\.js['"]/,
    'bridge deve importar de firebase-init.js');

  // Não deve ter imports diretos do CDN
  assert.doesNotMatch(source, /firebasejs\/\d+\.\d+\.\d+\//,
    'bridge não deve importar diretamente do CDN');

  // Deve exportar window.firebase
  assert.match(source, /window\.firebase\s*=/, 'bridge deve definir window.firebase');

  // Verifica métodos essenciais do bridge
  assert.match(source, /once\s*\(/, 'bridge deve emular .once()');
  assert.match(source, /\.on\s*\(/, 'bridge deve emular .on()');
  assert.match(source, /currentUser/, 'bridge deve emular currentUser');
});

test('serviço da empresa aguarda a ponte modular antes de acessar Firebase', () => {
  const company = read('company.html');
  const service = read('src/services/firebaseService.js');

  assert.match(
    company,
    /<script type="module" src="src\/services\/firebaseService\.js\?v=[0-9a-f]{12}"><\/script>/
  );
  assert.match(service, /import '\.\.\/\.\.\/firebase-compat-bridge\.js'/);
  assert.match(service, /const firebase = window\.firebase/);
  assert.doesNotMatch(service, /const firebaseConfig =/);
});

test('firebase-init.js — arquivo principal não regrediu em tamanho', () => {
  const source = read('firebase-init.js');
  const lines = source.split('\n').length;

  // Limite superior: se o arquivo crescer muito, algo errado aconteceu
  assert.ok(lines <= 200, `firebase-init.js cresceu demais (${lines} linhas, esperado <= 200)`);
  assert.ok(lines >= 80, `firebase-init.js encolheu demais (${lines} linhas, esperado >= 80)`);
});

test('healthcheck-firebase-sdk.mjs inclui verificação de compliance', () => {
  const source = read('tools/healthcheck-firebase-sdk.mjs');

  // Deve ter as verificações de compliance
  assert.match(source, /checkFirebaseInitCompliance/,
    'healthcheck deve ter função checkFirebaseInitCompliance');
  assert.match(source, /hasFirebaseBootstrap/,
    'healthcheck deve verificar o bootstrap completo');
  assert.match(source, /hasFirebaseInitImport/,
    'healthcheck deve manter compatibilidade do relatório');
  assert.match(source, /CDN_DIRETO_FORA_DO_BOOTSTRAP|FIREBASE_INIT_MODULE/,
    'healthcheck deve detectar CDN direto');
});

test('healthcheck reconhece o bootstrap compartilhado nas páginas publicadas', () => {
  const run = spawnSync(
    process.execPath,
    ['tools/healthcheck-firebase-sdk.mjs', '--json', '--ci'],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8'
    }
  );

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(run.stdout);
  assert.equal(report.scope, 'hosting');
  assert.ok(report.summary.pagesWithFirebase > 0, 'deve reconhecer páginas Firebase no Hosting');
  assert.equal(report.summary.errors, 0, 'não deve haver páginas publicadas fora do bootstrap');

  const folha = report.results.find(item => item.file === 'folha_pagamento/folha.html');
  assert.ok(folha, 'folha.html deve fazer parte do escopo publicado');
  assert.equal(folha.status, 'ok');
  assert.equal(folha.compliance.hasFirebaseBootstrap, true);
});

test('auditoria de cache e SDK considera somente artefatos publicados por padrão', () => {
  const run = spawnSync(
    process.execPath,
    ['tools/audit-cachebusters.mjs', '--json', '--ci'],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8'
    }
  );

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(run.stdout);
  assert.equal(report.scope, 'hosting');
  assert.equal(report.summary.localWithoutVersion, 0);
  assert.deepEqual(report.firebaseSdk.versions, ['10.7.1']);
  assert.equal(report.firebaseSdk.directOutsideBootstrap, 0);
});

test('módulos Firebase compartilhados usam URL canônica sem query string', () => {
  const hostedFiles = JSON.parse(read('hosting-files.json'));
  const invalidReferences = [];

  for (const file of hostedFiles.filter(item => item.endsWith('.html') || item.endsWith('.js'))) {
    const source = read(file).replace(/<!--[\s\S]*?-->/g, '');
    if (/firebase-(?:init|compat-bridge)\.js\?v=/i.test(source)) {
      invalidReferences.push(file);
    }
  }

  assert.deepEqual(
    invalidReferences,
    [],
    `imports Firebase com query criam identidades duplicadas: ${invalidReferences.join(', ')}`
  );
});
