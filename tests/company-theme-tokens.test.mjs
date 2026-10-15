import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('company.html: superfícies vivas usam tokens --sw-* (claro/escuro)', () => {
  const html = read('company.html');
  assert.match(html, /body \{\s*\n?\s*background: var\(--sw-bg\);/, 'body usa var(--sw-bg)');
  assert.ok(html.includes('background-color: var(--sw-surface-2);'), 'cards de seção usam surface-2');
  assert.ok(!html.includes('background-color: #f8fafc'), 'sem card claro fixo na UI viva');
  assert.ok(!html.includes('border: 1px solid #cbd5e1'), 'sem borda clara fixa na UI viva');
  assert.ok(!html.includes('color: #1e293b'), 'sem título slate fixo na UI viva');
  assert.ok(!html.includes("style.backgroundColor = '#f3f4f6'"), 'CNPJ readonly sem cinza fixo');
});

test('company.html: inputs e cards seguem os tokens de tema', () => {
  const html = read('company.html');
  assert.ok(html.includes('border: 1px solid var(--sw-input-border);'), 'inputs com borda temática');
  assert.ok(html.includes('background: var(--sw-input-bg);'), 'inputs com fundo temático');
  assert.ok(html.includes('.company-card-meta {') && html.includes('color: var(--sw-text-2);'), 'meta do card em texto-2');
  assert.ok(html.includes('.company-card-note {') && html.includes('color: var(--sw-text-3);'), 'nota do card em texto-3');
});
