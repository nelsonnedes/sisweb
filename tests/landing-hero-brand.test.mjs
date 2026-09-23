import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(rel) {
  return fs.readFileSync(path.resolve(rel), 'utf8');
}

test('Landing topbar: marca oficial (icone+nome) no lugar do logo anterior', () => {
  const html = read('landing-vendas.html');
  assert.match(html, /<div class="lv-logo"><img src="assets\/brand\/icone\.ico" alt="" aria-hidden="true" width="30" height="30"/);
  assert.match(html, /<img src="assets\/brand\/nome\.ico" alt="Sisweb — Gestão para Madeireiras" width="88" height="26" loading="eager" decoding="async"/);
  assert.doesNotMatch(html, /<div class="lv-logo"><img src="assets\/icons\/icon-192x192\.png"/);
  assert.doesNotMatch(html, /<strong>Sisweb<\/strong> <span>Gestão Madeireira<\/span>/);
  assert.doesNotMatch(html, /lv-hero-brand/);
});

test('Landing favicons: icone oficial em todas as refs (apple-touch preservado)', () => {
  const html = read('landing-vendas.html');
  assert.match(html, /<link rel="icon" href="assets\/brand\/icone\.ico" sizes="any">/);
  assert.doesNotMatch(html, /<link rel="icon" href="favicon\.ico"/);
  assert.doesNotMatch(html, /assets\/icons\/icon\.svg/);
  assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="assets\/icons\/apple-touch-icon\.png">/);
  assert.match(html, /<link rel="manifest" href="manifest\.json">/);
});

test('Landing badge: icone oficial da marca (igual topbar)', () => {
  const html = read('landing-vendas.html');
  assert.match(html, /<span class="lv-badge"><img src="assets\/brand\/icone\.ico" alt="" aria-hidden="true" width="18" height="18"/);
  assert.ok(html.indexOf('lv-badge') < html.indexOf('Sua madeireira do <em>pátio</em>'), 'badge antes do h1');
});

test('Landing hero: h1 preservado com Archivo expandido + logo dimensionada (anti-regressão)', () => {  const html = read('landing-vendas.html');
  const css = read('landing-vendas.css');
  assert.match(html, /<h1>Sua madeireira do <em>pátio<\/em> à <em>nota<\/em> em um só sistema\.<\/h1>/);
  assert.match(html, /family=Archivo:ital,wdth,wght/);
  assert.match(css, /\.lv-hero-copy h1\{[^}]*font-family:"Archivo",var\(--lv-font-display\)/);
  assert.match(css, /\.lv-hero-copy h1\{[^}]*font-stretch:125%/);
  assert.match(css, /\.lv-logo img\[src\*="nome"\]\{[^}]*height:24px/);
  // Hooks e CTAs intactos
  assert.match(html, /id="lv-hero-carousel"/);
  assert.match(html, /id="lv-hero-phone-carousel"/);
  assert.match(html, /login\.html\?mode=register/);
});

test('Landing hero: assets da marca publicados (disco + allowlist)', () => {
  const manifest = read('hosting-files.json');
  for (const asset of ['assets/brand/icone.ico', 'assets/brand/nome.ico']) {
    assert.ok(fs.existsSync(path.resolve(asset)), `${asset} existe em disco`);
    assert.ok(manifest.includes(`"${asset}"`), `${asset} na allowlist do build`);
  }
});
