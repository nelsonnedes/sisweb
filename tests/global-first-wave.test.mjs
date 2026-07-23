import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const repoRoot = fileURLToPath(new URL('../', import.meta.url));

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ignorePatternMatches(pattern, file) {
  const normalizedPattern = String(pattern || '').replace(/\\/g, '/');
  const normalizedFile = String(file || '').replace(/\\/g, '/');
  if (normalizedPattern === normalizedFile || normalizedPattern === `**/${normalizedFile}`) return true;
  if (normalizedPattern.startsWith('**/')) {
    return ignorePatternMatches(normalizedPattern.slice(3), normalizedFile);
  }
  const regex = new RegExp(`^${normalizedPattern.split('*').map(escapeRegExp).join('.*')}$`, 'i');
  return regex.test(normalizedFile);
}

function isIgnored(ignore, file) {
  return ignore.some((pattern) => ignorePatternMatches(pattern, file));
}

function collectFilesRecursively(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const abs = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return collectFilesRecursively(abs, rel);
    return [rel];
  });
}

test('firebase hosting nao publica ferramentas internas e backups', () => {
  const firebaseConfig = JSON.parse(read('firebase.json'));
  const ignore = firebaseConfig.hosting.ignore;

  const blocked = [
    'docs/**',
    'functions/**',
    'package.json',
    'tests/**',
    'tmp/**',
    'tools/**',
    'aplicar_correcao_vendas.html',
    'aplicar_estrategia_hibrida.html',
    'auto_sync_firebase.html',
    'corrigir_fornecedores.html',
    'corrigir_romaneios.html',
    'firebase-rules-update.html',
    'fix-firebase-rules.html',
    'folha_pagamento/normalizar-quinzena.html',
    'folha_pagamento/teste-firebase-simples.html',
    'folha_pagamento/teste-modal-integrado.html',
    'limpar_clientes.html',
    'limpar_especies.html',
    'migrar-contas.html',
    'migrar-financas-mensal.html',
    'migrar_rastreabilidade.html',
    'migrate-to-firebase.html',
    'migration-tool.html',
    'reset-client.html',
    'reset-system.html',
    'sincronizar.html',
    'verificar_romaneios.html',
    'compras_legacy.html',
    'index_bak.html',
    'romaneiopct_back.html',
    'romaneiotora_otimizado.html',
    'romaneiotora_versao_dev.html',
    'template.html'
  ];

  for (const file of blocked) {
    assert.ok(ignore.includes(file), `${file} precisa ficar fora do deploy publico`);
  }

  assert.equal(ignore.includes('admin.html'), false);
  assert.equal(ignore.includes('subscription.html'), false);
  assert.equal(ignore.includes('subscription-status.html'), false);
});

test('rotas ativas nao inicializam o Firestore desativado', () => {
  const firebaseConfig = JSON.parse(read('firebase.json'));
  const company = read('company.html');
  const romaneioTora = read('romaneiotora.html');
  const legacyCompanyService = read('src/services/firebaseService.js');

  assert.equal(Object.hasOwn(firebaseConfig, 'firestore'), false);
  assert.doesNotMatch(company, /firebase-firestore-compat\.js/);
  assert.doesNotMatch(romaneioTora, /firebase-firestore-compat\.js/);
  assert.doesNotMatch(legacyCompanyService, /firebase\.firestore\s*\(/);
  assert.doesNotMatch(legacyCompanyService, /firestoreService/);
});

test('firebase hosting bloqueia segredos, dumps e dados reais', () => {
  const firebaseConfig = JSON.parse(read('firebase.json'));
  const ignore = firebaseConfig.hosting.ignore;

  const blocked = [
    'service-account.json',
    'service-account*.json',
    'serviceAccount*.json',
    '*service*account*.json',
    'Clients.json',
    'fornecedores.json',
    'contasReceber.json',
    'romaneiosTora.json',
    'sisweb-*-rtdb-export*.json',
    '*default-rtdb-export*.json',
    '**/.env',
    '**/.env.*',
    '**/*.pem',
    '**/*.key',
    '**/*.p12',
    '**/*.pfx',
    '**/*.sqlite',
    '**/*.db',
    '**/*rtdb-export*.json',
    '**/*dump*.json',
    '**/*backup*.json',
    '**/*diagnostic*.json',
    '**/*.txt',
    '**/*.pdf',
    '**/*.backup.*',
    '**/*backup*',
    'tmp-*',
    'A\u00e7\u00f5es',
    'Logo JN.png',
    'database.rules.json',
    'firestore.rules',
    'firestore.indexes.json',
    'storage.rules',
    'cors.json',
    'firebase-no-cache.json',
    'vercel.json',
    'relatorio_correcao*.json',
    'report_categories.json',
    'sisweb-diagnostic*.json',
    'temp_file_list.json',
    'scripts/audit-company-logos-storage.cjs',
    'scripts/inspect_company_nodes.cjs',
    'scripts/migracao_sisweb_v3.cjs',
    'scripts/migracao_v4_romaneiosPes.cjs',
    'scripts/migracao_v4_vendas.cjs',
    'scripts/migrar-financas-mensal.js',
    'scripts/migrar-tabelas-contas.js',
    'scripts/migrate-company-logos-to-storage.cjs',
    'scripts/patch_js_paths.cjs',
    '.aiox-core/**',
    '.codex/**',
    '**/*.ps1',
    '**/*.cjs',
    '**/*.mjs'
  ];

  for (const pattern of blocked) {
    assert.ok(ignore.includes(pattern), `${pattern} precisa ficar fora do deploy publico`);
  }

  const publicScriptAllowlist = new Set([
    'scripts/admin/admin-main.js',
    'scripts/admin/admin-ui.js'
  ]);
  const scriptsDir = new URL('../scripts', import.meta.url);
  const scriptFiles = collectFilesRecursively(fileURLToPath(scriptsDir)).map((file) => `scripts/${file.replace(/\\/g, '/')}`);
  for (const file of scriptFiles) {
    if (publicScriptAllowlist.has(file)) {
      assert.equal(isIgnored(ignore, file), false, `${file} precisa ser publicado para o admin funcionar`);
    } else {
      assert.ok(isIgnored(ignore, file), `${file} precisa ficar fora do deploy publico ou entrar explicitamente na allowlist`);
    }
  }
});

test('json publico da raiz fica restrito a allowlist', () => {
  const firebaseConfig = JSON.parse(read('firebase.json'));
  const ignore = firebaseConfig.hosting.ignore;
  const publicJsonAllowlist = new Set(['manifest.json', 'estados-cidades.json']);
  const rootJsonFiles = readdirSync(repoRoot).filter((name) => name.endsWith('.json'));

  for (const file of rootJsonFiles) {
    if (publicJsonAllowlist.has(file)) continue;
    assert.ok(isIgnored(ignore, file), `${file} precisa estar coberto por hosting.ignore ou entrar explicitamente na allowlist publica`);
  }
});

test('cache local do hosting nao guarda entradas sensiveis', () => {
  const cacheUrl = new URL('../.firebase/hosting..cache', import.meta.url);
  if (!existsSync(cacheUrl)) return;

  const cache = readFileSync(cacheUrl, 'utf8');
  const blocked = [
    /service-account.*\.json/i,
    /Clients\.json/i,
    /fornecedores\.json/i,
    /contasReceber\.json/i,
    /romaneiosTora\.json/i,
    /rtdb-export.*\.json/i,
    /database\.rules\.json/i,
    /firestore\.rules/i,
    /firestore\.indexes\.json/i,
    /storage\.rules/i,
    /firebase-rules.*\.json/i,
    /cors\.json/i,
    /firebase-no-cache\.json/i,
    /vercel\.json/i
  ];

  for (const pattern of blocked) {
    assert.doesNotMatch(cache, pattern, `.firebase/hosting..cache nao pode manter ${pattern}`);
  }
});

test('service account e dumps nao sao rastreados pelo Git', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map((file) => file.replace(/\\/g, '/'));

  const allowedExamples = new Set(['.env.example', 'functions/.env.example']);
  const blocked = [
    /(^|\/)service[-_]?account.*\.json$/i,
    /(^|\/)Clients\.json$/i,
    /(^|\/)fornecedores\.json$/i,
    /(^|\/)contasReceber\.json$/i,
    /(^|\/)romaneiosTora\.json$/i,
    /rtdb-export.*\.json$/i,
    /(^|\/)\.env($|\.)/i,
    /\.(pem|p12|pfx|key)$/i
  ];

  for (const file of tracked) {
    if (allowedExamples.has(file)) continue;
    for (const pattern of blocked) {
      assert.doesNotMatch(file, pattern, `${file} nao pode ficar rastreado no Git`);
    }
  }
});

test('hosting aplica headers basicos de hardening em todas as rotas', () => {
  const firebaseConfig = JSON.parse(read('firebase.json'));
  const globalHeaders = firebaseConfig.hosting.headers.find((entry) => entry.source === '**');
  assert.ok(globalHeaders, 'headers globais precisam existir');

  const headerMap = new Map(globalHeaders.headers.map((header) => [header.key, header.value]));
  assert.equal(headerMap.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headerMap.get('X-Frame-Options'), 'DENY');
  assert.equal(headerMap.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.match(headerMap.get('Permissions-Policy') || '', /camera=\(\)/);
  assert.equal(headerMap.get('Cross-Origin-Opener-Policy'), 'same-origin');
});

test('redirect pos-login aceita apenas alvos internos normalizados', () => {
  const authSource = read('auth.js');
  const loginSource = read('login.html');

  assert.match(authSource, /function normalizeInternalRedirectTarget/);
  assert.match(authSource, /const requested = normalizeInternalRedirectTarget\(opts\.requestedRedirect\)/);
  assert.match(authSource, /compact\.startsWith\('https:\/\/'\)/);
  assert.match(authSource, /compact\.startsWith\('\/\/'\)/);
  assert.match(authSource, /compact\.startsWith\('javascript:'\)/);
  assert.doesNotMatch(authSource, /const requested = String\(opts\.requestedRedirect \|\| ''\)\.trim\(\)/);

  assert.match(loginSource, /function sanitizeInternalRedirectTarget/);
  assert.match(loginSource, /sanitizeInternalRedirectTarget\(redirect \|\| 'index\.html', 'index\.html'\)/);
  assert.match(loginSource, /sanitizeInternalRedirectTarget\(result\.flowRedirect\)/);
  assert.doesNotMatch(loginSource, /decodeURIComponent\(redirect\)/);
});

test('toasts e notificacoes criticas nao injetam mensagem como HTML', () => {
  const comprasSource = read('compras.js');
  const vendasSource = read('vendas.js');
  const adminUiSource = read('scripts/admin/admin-ui.js');
  const notificationsSource = read('src/components/ui/notifications.js');

  assert.match(comprasSource, /const safeMessage = escapeHtml\(message\)/);
  assert.doesNotMatch(comprasSource, /<div class="toast-message">\$\{message\}<\/div>/);

  for (const source of [vendasSource, adminUiSource, notificationsSource]) {
    assert.match(source, /messageEl\.textContent = String\(message == null \? '' : message\)/);
    assert.doesNotMatch(source, /toast-message">\$\{message\}/);
    assert.doesNotMatch(source, /notification-message">\$\{message\}/);
  }
});

test('menu global expoe suporte profissional no desktop e no mobile', () => {
  const source = read('menu-component.js');

  assert.match(source, /class="[^"]*support-link/);
  assert.doesNotMatch(source, /mobile-menu-link/);
  assert.doesNotMatch(source, /mobile-logout-link/);
  assert.match(source, /showSupport/);
  assert.match(source, /supportModal/);
  assert.match(source, /sendSiswebSupportWhatsApp/);
  assert.match(source, /copySiswebSupportContext/);
  assert.match(source, /window\.customElements && !window\.customElements\.get\('main-menu'\)/);
});

test('central de suporte inclui contexto multi-tenant e nao usa mailto direto no menu', () => {
  const source = read('menu-component.js');

  assert.match(source, /Empresa\/Tenant/);
  assert.match(source, /companyId \|\| current\.companyID \|\| current\.tenantId/);
  assert.match(source, /window\.appTenantId/);
  assert.match(source, /Módulo/);
  assert.match(source, /URL/);
  assert.match(source, /Usuário/);
  assert.doesNotMatch(source, /mailto:nedes1@hotmail\.com/);
  assert.doesNotMatch(source, /tel:\+5591991311049/);
});

test('rodape global abre suporte e nao duplica prefixo Sistema de', () => {
  const source = read('menu-component.js');
  const footerBlockStart = source.indexOf('function bindFooterContact');
  assert.notEqual(footerBlockStart, -1);
  const footerBlock = source.slice(footerBlockStart, source.indexOf('function bindFooterTitleObserver', footerBlockStart));

  assert.match(footerBlock, /window\.showSupport/);
  assert.doesNotMatch(footerBlock, /aboutLink/);
  assert.match(source, /<p>&copy; 2024 <span class="global-footer-module"><\/span>/);
  assert.match(source, /Sistema\\s\+de\\s\+Sistema\\s\+de/);
});

test('rotas oficiais do menu existem e nao apontam para ferramentas bloqueadas', () => {
  const source = read('menu-component.js');
  const firebaseConfig = JSON.parse(read('firebase.json'));
  const ignore = new Set(firebaseConfig.hosting.ignore);
  const routes = new Set();
  const re = /resolveUrl\('([^']+\.html(?:\?[^']*)?)'\)/g;
  let match;

  while ((match = re.exec(source))) {
    routes.add(match[1].split('?')[0]);
  }

  assert.ok(routes.has('vendas.html'));
  assert.ok(routes.has('compras.html'));
  assert.ok(routes.has('folha_pagamento/folha.html'));
  assert.ok(routes.has('admin.html'));
  assert.ok(routes.has('subscription-status.html'));

  for (const route of routes) {
    assert.equal(ignore.has(route), false, `${route} esta no menu e nao pode estar bloqueada no deploy`);
    assert.ok(existsSync(new URL(`../${route}`, import.meta.url)), `${route} precisa existir no workspace`);
  }
});

test('dashboard CSP permite callables de suporte sem liberar cloudfunctions global', () => {
  const indexHtml = read('index.html');

  assert.match(indexHtml, /connect-src[^"]*https:\/\/us-central1-sisweb-7ce82\.cloudfunctions\.net/);
  assert.doesNotMatch(indexHtml, /connect-src[^"]*https:\/\/\*\.cloudfunctions\.net/);
});
