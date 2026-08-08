/**
 * tests/sentry-monitor.test.mjs
 *
 * Regression guard do monitoramento Sentry:
 * 1. sentry-init.js expõe API segura: guard singleton, DSN desligado por
 *    padrão (zero custo/vazamento até configurar), sem PII, sem tracing.
 * 2. Todas as páginas publicadas incluem o SDK local + init com cachebuster
 *    (caminho relativo correto em subpastas).
 * 3. Os serviços de dados reportam falhas de CRUD (gravação/exclusão/conflito).
 * 4. Nenhuma página referencia o SDK Sentry por CDN (deve ser local).
 */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const allowlist = JSON.parse(readFileSync(new URL('../hosting-files.json', import.meta.url), 'utf8'));
const publishedHtmls = allowlist.filter((f) => f.toLowerCase().endsWith('.html'));

test('sentry-init.js está configurado com DSN válido (sem PII, sem tracing, guard singleton)', () => {
  const src = read('sentry-init.js');
  assert.match(src, /if \(window\.SentryMonitor\) return;/, 'deve ter guard singleton');
  assert.match(
    src,
    /var SENTRY_DSN = 'https:\/\/[a-f0-9]{32}@o\d+\.ingest(?:\.us)?\.sentry\.io\/\d+';/,
    'DSN deve ser um DSN válido do Sentry'
  );
  assert.match(src, /window\.__SENTRY_DSN__/, 'deve permitir sobrescrever via window.__SENTRY_DSN__');
  assert.match(src, /sendDefaultPII: false/, 'nunca enviar PII');
  assert.match(src, /tracesSampleRate: 0/, 'tracing desligado (sem custo de performance)');
  assert.match(src, /function reportDataIssue/, 'deve expor reportDataIssue');
  assert.match(src, /reportDataIssue: reportDataIssue/, 'window.SentryMonitor.reportDataIssue');
  assert.match(src, /SENSITIVE_KEYS = \/\(password\|passwd\|senha/, 'deve redigir campos sensíveis');
  assert.match(src, /isExtensionError/, 'deve filtrar erros de extensões');
  assert.match(src, /window\.SentryMonitor = \{\s*enabled:/, 'deve expor API pública');
  assert.match(src, /window\.SentryMonitor = \{\s*enabled: !!dsn/, 'enabled deve refletir o DSN');
});

test('todas as páginas publicadas carregam Sentry local com cachebuster (sem CDN)', () => {
  const missing = [];
  for (const file of publishedHtmls) {
    const html = read(file);
    const bundleOk = /sentry\/sentry\.browser\.min\.js\?v=[a-f0-9]+/.test(html);
    const initOk = /sentry-init\.js\?v=[a-f0-9]+/.test(html);
    const pathOk = /src="(\.\.\/|)sentry\/sentry\.browser\.min\.js/.test(html);
    if (!bundleOk) missing.push(`${file}: SDK ausente/sem cachebuster`);
    if (!initOk) missing.push(`${file}: init ausente/sem cachebuster`);
    if (!pathOk) missing.push(`${file}: caminho do SDK inválido`);
    if (/sentry-cdn\.com/.test(html)) missing.push(`${file}: SDK por CDN (deve ser local)`);
  }
  assert.deepEqual(missing, [], `Páginas sem Sentry correto:\n${missing.join('\n')}`);
});

test('bundle local do Sentry existe e é o bundle de browser (não vazio, com licença)', () => {
  const bundle = read('sentry/sentry.browser.min.js');
  assert.ok(bundle.length > 50000, 'bundle deve ter mais de 50KB');
  assert.match(bundle, /@sentry\/browser/, 'deve ser o SDK do Sentry Browser');
  const license = read('sentry/LICENSE');
  assert.ok(license.includes('MIT'), 'deve incluir licença MIT');
});

test('serviços de dados reportam falhas de CRUD ao SentryMonitor (no-op-safe)', () => {
  const svc = read('firebaseService.js');
  assert.match(svc, /window\.SentryMonitor && window\.SentryMonitor\.reportDataIssue/, 'saveData deve checar guard antes de reportar');
  assert.match(svc, /reportDataIssue\('gravacao_falhou'/, 'saveData deve reportar gravacao_falhou');
  assert.match(svc, /reportDataIssue\('exclusao_falhou'/, 'removeData deve reportar exclusao_falhou');

  const core = read('modules/core/firebase-service.js');
  assert.match(core, /reportDataIssue\('gravacao_falhou'/, 'saveData core deve reportar');
  assert.match(core, /reportDataIssue\('exclusao_falhou'/, 'deleteData core deve reportar');
  assert.match(core, /reportDataIssue\('conflito'/, 'syncQueue deve reportar conflito');
});
