/**
 * tests/sentry-admin-monitor.test.mjs
 *
 * Regression guard do painel de Monitoramento de Erros (Sentry) no admin:
 * 1. Cloud Functions expõem sentrySyncIssues / sentryGetIssueDetail / sentryWebhook
 *    com RBAC superadmin e secrets (token nunca hardcoded).
 * 2. Nenhuma credencial da Sentry (DSN secret, API key) existe no client.
 * 3. O admin.html possui a seção Sentry e o sininho; admin-main.js inicializa
 *    com subscribe realtime e callables.
 * 4. As regras do RTDB continuam protegendo system/* (superadmin read, .write false).
 */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const allowlist = JSON.parse(readFileSync(new URL('../hosting-files.json', import.meta.url), 'utf8'));

test('sentry-functions.js existe, usa secrets e RBAC superadmin (sem token hardcoded)', () => {
  const src = read('functions/sentry-functions.js');
  assert.match(src, /defineSecret\('SENTRY_API_TOKEN'\)/, 'token da API deve vir de secret');
  assert.match(src, /defineSecret\('SENTRY_WEBHOOK_TOKEN'\)/, 'token do webhook deve vir de secret');
  assert.match(src, /sentrySyncIssues = onCallV2/, 'deve exportar sentrySyncIssues');
  assert.match(src, /sentryGetIssueDetail = onCallV2/, 'deve exportar sentryGetIssueDetail');
  assert.match(src, /sentryResolveIssue = onCallV2/, 'deve exportar sentryResolveIssue');
  assert.match(src, /sentryWebhook = onRequestV2/, 'deve exportar sentryWebhook');
  assert.match(src, /assertSuperAdminCall\(request\)/, 'toda callable deve exigir superadmin');
  assert.match(src, /timingSafeEqual/, 'webhook deve validar token com timing-safe compare');
  assert.match(src, /SENSITIVE_PATTERN/, 'deve redigir campos sensíveis');
  assert.match(src, /RTDB_ISSUES_PATH = 'system\/sentry\/issues'/, 'deve gravar em system/sentry (protegido por regras)');
  assert.doesNotMatch(src, /sntrys_/, 'token da Sentry nunca hardcoded no código');
  assert.doesNotMatch(src, /b4258fde0ba4c6c34342d39454e23501/, 'secret do DSN nunca hardcoded no backend');
});

test('functions/index.js registra as 4 exports do módulo Sentry', () => {
  const idx = read('functions/index.js');
  assert.match(idx, /const sentryFunctions = require\('\.\/sentry-functions'\)/, 'deve importar o módulo');
  assert.match(idx, /sentryFunctions\.configure\(\{ isCallerSuperAdmin \}\)/, 'deve injetar o helper de RBAC');
  assert.match(idx, /exports\.sentrySyncIssues = sentryFunctions\.sentrySyncIssues/, 'deve registrar sentrySyncIssues');
  assert.match(idx, /exports\.sentryGetIssueDetail = sentryFunctions\.sentryGetIssueDetail/, 'deve registrar sentryGetIssueDetail');
  assert.match(idx, /exports\.sentryResolveIssue = sentryFunctions\.sentryResolveIssue/, 'deve registrar sentryResolveIssue');
  assert.match(idx, /exports\.sentryWebhook = sentryFunctions\.sentryWebhook/, 'deve registrar sentryWebhook');
});

test('auditoria de acesso admin negado usa callable server-side em vez de write direto', () => {
  const adminMain = read('scripts/admin/admin-main.js');
  const audit = read('functions/security-audit-functions.js');
  const index = read('functions/index.js');
  assert.match(adminMain, /callFunction\("recordAdminAccessDenied"/);
  assert.doesNotMatch(adminMain, /saveData\("users\/" \+ uid \+ "\/securityAudit/);
  assert.match(audit, /exports\.recordAdminAccessDenied = functions\.https\.onCall/);
  assert.match(audit, /resolveAuth/);
  assert.match(audit, /auth\.uid/);
  assert.match(audit, /securityAudit\/adminAccessDenied/);
  assert.match(index, /exports\.recordAdminAccessDenied = securityAuditFunctions\.recordAdminAccessDenied/);
});

test('leituras RTDB ativas não misturam o SDK local com firebase-database do CDN', () => {
  const finance = read('financas.js');
  const pct = read('modules/romaneiopct/modal-lista-romaneios-pct.js');
  assert.doesNotMatch(finance, /gstatic\.com\/firebasejs\/10\.7\.1\/firebase-database\.js/);
  assert.doesNotMatch(pct, /gstatic\.com\/firebasejs\/10\.7\.1\/firebase-database\.js/);
  assert.match(finance, /import\('\.\/firebase\/sdk\/firebase-database\.js'\)/);
  assert.match(pct, /import\('\.\.\/\.\.\/firebase\/sdk\/firebase-database\.js'\)/);
});

test('sanitização Sentry é limitada contra objetos circulares ou profundos', () => {
  const src = read('sentry-init.js');
  assert.match(src, /function sanitizeObject\(obj, seen, depth\)/);
  assert.match(src, /seen\.has\(obj\)/);
  assert.match(src, /depth > 12/);
});

test('nenhuma credencial da Sentry vaza para o client (páginas publicadas e scripts)', () => {
  const htmls = allowlist.filter((f) => f.toLowerCase().endsWith('.html'));
  const files = [
    'admin.html',
    'scripts/admin/admin-main.js',
    'scripts/admin/admin-ui.js',
    'firebaseService.js',
    ...htmls
  ];
  const problems = [];
  for (const f of files) {
    let content = '';
    try { content = read(f); } catch (_) { continue; }
    if (/sntrys_/.test(content)) problems.push(`${f}: API key da Sentry presente`);
    if (/b4258fde0ba4c6c34342d39454e23501/.test(content)) problems.push(`${f}: secret do DSN presente`);
    if (/_jgs9RmXdfIfYdYCM9w0VD/.test(content)) problems.push(`${f}: fragmento do token presente`);
  }
  assert.deepEqual(problems, [], `Credenciais vazadas:\n${problems.join('\n')}`);
});

test('admin.html contém a seção Sentry e o sininho (com badges de acessibilidade)', () => {
  const html = read('admin.html');
  assert.match(html, /sentryIssuesBody/, 'tabela de issues');
  assert.match(html, /sentrySyncBtn/, 'botão sincronizar');
  assert.match(html, /sentryCopySummaryBtn/, 'botão copiar resumo');
  assert.match(html, /sentryLevelFilter/, 'filtro por nível');
  assert.match(html, /sentryKpi24h/, 'KPI erros 24h');
  assert.match(html, /sentryBellHost/, 'host do sininho');
  assert.match(html, /sentryBellBadge/, 'badge do sininho');
  assert.match(html, /aria-label="Abrir alertas de erros de produção"/, 'aria-label no sininho');
  assert.match(html, /Monitoramento de Erros \(Sentry\)/, 'título da seção');
  assert.match(html, /Somente metadados — sem dados de clientes/, 'aviso de privacidade');
});

test('admin-main.js inicializa o monitoramento realtime e as ações do painel', () => {
  const src = read('scripts/admin/admin-main.js');
  assert.match(src, /function sentryInit\(\)/, 'deve existir init do monitor');
  assert.match(src, /sentryInit\(\);/, 'deve ser chamado no bootstrap');
  assert.match(src, /if \(!sentryIsSuperAdmin\(\)\) return;/, 'init deve exigir superadmin');
  assert.match(src, /subscribe\("system\/sentry\/issues"/, 'deve assinar o espelho realtime');
  assert.match(src, /callFunction\("sentrySyncIssues"/, 'deve chamar a callable de sync');
  assert.match(src, /callFunction\("sentryGetIssueDetail"/, 'deve chamar a callable de detalhe');
  assert.match(src, /sentryBuildReportText/, 'deve montar relatório copiável');
  assert.match(src, /sentryEscapeHtml/, 'deve escapar HTML (anti-XSS)');
  assert.match(src, /navigator\.clipboard\.writeText/, 'deve copiar para a área de transferência');
});

test('regras do RTDB seguem protegendo system/* (superadmin read, .write false)', () => {
  const rules = JSON.parse(read('database.rules.json'));
  const system = (rules.rules || {}).system;
  assert.ok(system, 'regra system/ deve existir');
  assert.match(String(system['.read'] || ''), /superadmin/, 'leitura deve exigir superadmin');
  assert.equal(system['.write'], false, 'escrita direta do client proibida (só Admin SDK)');
});
