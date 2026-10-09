import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// E2: compras stub → helper (26 calls vivas), com pareamento show/hide auditado.
const comprasJs = readFileSync('compras.js', 'utf8');
const comprasHtml = readFileSync('compras.html', 'utf8');

test('E2: LoadingManager delega ao helper com fallback para a div própria', () => {
  assert.doesNotMatch(comprasJs, /Removido loadingOverlay do DOM/);
  assert.match(comprasJs, /window\.SiswebLoading\.show\(message\)/);
  assert.match(comprasJs, /window\.SiswebLoading\.hide\(\)/);
  assert.match(comprasJs, /document\.getElementById\('loadingOverlay'\)/);
  assert.match(comprasJs, /document\.getElementById\('loadingText'\)/);
});

test('E2: listarPedidos esconde o loader em finally (sem overlay preso)', () => {
  const showIdx = comprasJs.indexOf("LoadingManager.show('Carregando pedidos...');");
  assert.ok(showIdx !== -1, 'show de listarPedidos ausente');
  const tail = comprasJs.slice(showIdx, showIdx + 1500);
  assert.match(tail, /\} finally \{\s+LoadingManager\.hide\(\);/);
});

test('E2: compras carrega helper + tem div do overlay', () => {
  assert.match(comprasHtml, /js\/sisweb-loading\.js\?v=[0-9a-f]{12}/);
  assert.match(comprasHtml, /id="loadingOverlay"/);
  assert.match(comprasHtml, /id="loadingText"/);
});

test('E2: shows e hides balanceados em compras', () => {
  const shows = (comprasJs.match(/LoadingManager\.show\(/g) || []).length;
  const hides = (comprasJs.match(/LoadingManager\.hide\(\)/g) || []).length;
  assert.ok(shows > 0 && hides >= shows, `shows=${shows} hides=${hides}`);
});

test('E2b: overlay acompanha o tema (sem tudo-branco no dark)', () => {
  const comum = readFileSync('layout-comum.css', 'utf8');
  assert.match(comum, /html\[data-theme="dark"\] \.loading-overlay/);
  assert.match(comum, /background: rgba\(0, 0, 0, 0\.7\)/);
  const helper = readFileSync('js/sisweb-loading.js', 'utf8');
  assert.match(helper, /html\[data-theme=/);
  assert.match(helper, /rgba\(0,0,0,0\.7\)/);
  assert.match(helper, /var\(--sw-surface/);
  assert.match(helper, /var\(--sw-text-1/);
});
