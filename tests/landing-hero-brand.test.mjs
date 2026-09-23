import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function read(rel) {
  return fs.readFileSync(path.resolve(rel), 'utf8');
}

test('Landing hero: bloco de marca oficial acima do badge (sem placeholder)', () => {
  const html = read('landing-vendas.html');
  assert.match(html, /<div class="lv-hero-brand">/);
  assert.match(html, /<img src="assets\/brand\/icone\.ico" alt="" aria-hidden="true" width="72" height="72" loading="eager" fetchpriority="high" decoding="async">/);
  assert.match(html, /<img src="assets\/brand\/nome\.ico" alt="Sisweb — Gestão para Madeireiras" width="240" loading="eager" fetchpriority="high" decoding="async">/);
  assert.doesNotMatch(html, /Logotipo Sisweb/);
  const brandIdx = html.indexOf('lv-hero-brand');
  const badgeIdx = html.indexOf('lv-badge');
  const h1Idx = html.indexOf('Sua madeireira do <em>pátio</em>');
  assert.ok(brandIdx > 0 && brandIdx < badgeIdx && badgeIdx < h1Idx, 'marca vem antes do badge e do h1');
});

test('Landing hero: h1 preservado com Archivo expandido (anti-regressão)', () => {
  const html = read('landing-vendas.html');
  const css = read('landing-vendas.css');
  assert.match(html, /<h1>Sua madeireira do <em>pátio<\/em> à <em>nota<\/em> em um só sistema\.<\/h1>/);
  assert.match(html, /family=Archivo:ital,wdth,wght/);
  assert.match(css, /\.lv-hero-copy h1\{[^}]*font-family:"Archivo",var\(--lv-font-display\)/);
  assert.match(css, /\.lv-hero-copy h1\{[^}]*font-stretch:125%/);
  assert.match(css, /\.lv-hero-brand\{[^}]*display:flex/);
  assert.match(css, /\.lv-hero-brand img\[src\*="nome"\]\{[^}]*width:min\(230px,58vw\)/);
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
