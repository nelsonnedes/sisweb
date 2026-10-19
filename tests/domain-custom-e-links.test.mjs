import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const landingJs = fs.readFileSync('landing-vendas.js', 'utf8');
const landingHtml = fs.readFileSync('landing-vendas.html', 'utf8');
const auth = fs.readFileSync('auth.js', 'utf8');
const oldHost = ['sisweb-7ce82', 'web', 'app'].join('.');

test('landing: domínio novo no canonical/OG e nenhum link para o domínio antigo', () => {
  assert.match(landingHtml, /rel="canonical" href="https:\/\/siswebsoftware\.com\.br\/landing-vendas\.html"/);
  assert.match(landingHtml, /property="og:url" content="https:\/\/siswebsoftware\.com\.br\/landing-vendas\.html"/);
  assert.equal(landingHtml.includes(oldHost), false);
  assert.equal(landingJs.includes(oldHost), false);
});

test('compartilhamento: texto profissional, sem emojis e links do domínio novo', () => {
  assert.match(landingJs, /\*Sisweb - Gestão completa para madeireiras e serrarias\*/);
  assert.match(landingJs, /- Romaneios de toras e serrados/);
  assert.match(landingJs, /\*30 dias grátis\*/);
  assert.match(landingJs, /https:\/\/siswebsoftware\.com\.br\/landing-vendas\.html#simulador/);
  assert.match(landingJs, /https:\/\/siswebsoftware\.com\.br\/login\.html\?mode=register/);
  assert.match(landingJs, /encodeURIComponent\(SHARE_COMMERCIAL_TEXT\)/);
  assert.doesNotMatch(landingJs, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  assert.match(landingHtml, /og:image" content="https:\/\/siswebsoftware\.com\.br\/assets\/brand\/og-sisweb\.png"/);
});

test('assinatura: links absolutos funcionam a partir de folha_pagamento', () => {
  assert.match(auth, /href="\/subscription-status\.html"/);
  assert.match(auth, /return '\/subscription-status\.html\?reason=pending'/);
  assert.match(auth, /return '\/subscription\.html\?reason=pending'/);
  assert.doesNotMatch(auth, /href="subscription-status\.html"/);
});
