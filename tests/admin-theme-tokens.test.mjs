import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('engrenagem: painel e secao Administracao tem override no escuro', () => {
  const shell = read('styles/shell-theme.css');
  assert.ok(shell.includes('html[data-theme="dark"] main-menu .settings-dropdown .settings-panel'), 'painel da engrenagem no escuro');
  assert.ok(shell.includes('html[data-theme="dark"] main-menu .settings-dropdown .admin-section'), 'secao Administracao no escuro');
  assert.ok(shell.includes('html[data-theme="dark"] main-menu .settings-dropdown .settings-action'), 'acoes da engrenagem no escuro');
  const admin = read('admin.html');
  assert.ok(!admin.includes('#6366f1'), 'admin sem indigo fixo (token info)');
});

test('governanca: textos em tokens + pasteis com variante dark', () => {
  const html = read('admin-access-governance.html');
  assert.ok(!html.includes('color: #0f172a'), 'sem texto slate fixo');
  assert.ok(html.includes('background: var(--sw-bg);'), 'fundo em token');
  assert.ok(html.includes('html[data-theme="dark"] .panel'), 'painel com variante dark');
  assert.ok(html.includes('html[data-theme="dark"] .chip.ok'), 'chips com variante dark');
});

test('admin-settings e admin-subscriptions: superficies bitematicas', () => {
  const settings = read('admin-settings.html');
  assert.ok(settings.includes('background: var(--sw-bg);'), 'settings com fundo em token');
  assert.ok(settings.includes('.settings-card {') && settings.includes('background: var(--sw-surface);'), 'cards em surface (bitematico direto)');
  assert.ok(settings.includes('html[data-theme="dark"] .audit-before'), 'diff auditoria com variante dark');
  const subs = read('admin-subscriptions.html');
  assert.ok(subs.includes('html[data-theme="dark"] .status-active'), 'pills com variante dark');
  assert.ok(subs.includes('html[data-theme="dark"] .data-origin-panel'), 'painel origem com variante dark');
  assert.ok(!subs.includes('color:#64748b'), 'sem cinza fixo nos templates JS');
  assert.ok(!settings.includes('background: #f8fafc') && !subs.includes('background: #f8fafc'), 'sem painel claro (trava Fase 19)');
});
