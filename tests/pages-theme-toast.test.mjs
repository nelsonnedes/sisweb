import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('toast T1 delega ao NotificationService e fallback quebra linha (sem ellipsis)', () => {
  const toast = read('modules/core/toast.js');
  assert.ok(toast.includes('window.NotificationService.show(s, type, opts)'), 'T1 delega ao servico canonico');
  assert.match(toast, /String\(message \|\| ''\)/);
  assert.match(toast, /if \(!s\) return;/);
  assert.match(toast, /z-index:10000000/);
  assert.ok(toast.includes('white-space:pre-line'), 'fallback quebra linha (pre-line)');
  assert.ok(!toast.includes('white-space:nowrap'), 'fallback sem nowrap');
  assert.ok(!toast.includes('error: 0'), 'erro nao gruda (sem duration 0)');
});

test('toast canônico: botao fechar imune a button{width:100%} das paginas', () => {
  const svc = read('js/notification-service.js');
  assert.ok(svc.includes('.sw-toast-close{'), 'regra do fechar existe');
  assert.ok(svc.includes('width:auto;flex:0 0 auto'), 'fechar imune a width global');
  const toast = read('modules/core/toast.js');
  assert.ok(toast.includes('flex:0 0 auto;width:auto'), 'fallback T1 tambem imune');
});

test('subscription-status: ilha clara vira bitematica no escuro', () => {
  const html = read('subscription-status.html');
  assert.ok(html.includes('html[data-theme="dark"]'), 'bloco dark existe');
  assert.ok(html.includes('--sisweb-panel: var(--sw-surface);'), 'painel segue surface no escuro');
  assert.ok(html.includes('--sisweb-ink: var(--sw-text-1);'), 'tinta segue texto-1 no escuro');
  assert.ok(html.includes('html[data-theme="dark"] body'), 'fundo do body no escuro');
  assert.ok(!html.includes('color:#1e293b'), 'sem titulo slate fixo nos alertas');
  assert.ok(!html.includes('background-color: #fefefe'), 'modais sem branco fixo');
});

test('user-profile: cards, modal Editar e MFA em tokens', () => {
  const html = read('user-profile.html');
  assert.ok(html.includes('.modal-title {') && html.includes('color: var(--sw-text-1);'), 'titulo do modal em texto-1');
  assert.ok(html.includes('.info-value {') && html.includes('color: var(--sw-text-1);'), 'valores em texto-1');
  assert.ok(html.includes('color: var(--sw-text-2);') && !html.includes('color:#475569'), 'sem slate fixo no MFA');
  assert.ok(!html.includes('#991b1b') && !html.includes('#065f46'), 'MFA sem cores fixas');
});
