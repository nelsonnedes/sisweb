import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Layout das abas de Emissão + regressões de build/hidden.
// Contexto (logs reais): grupos condicionais apareciam quando deveriam estar
// ocultos porque `.form-group { display:flex }` (regra de autor) sobrescreve
// `[hidden]` da UA stylesheet. Correção: `[hidden] { display:none !important }`.
const html = fs.readFileSync('notas-fiscais.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('hosting-files.json', 'utf8'));

test('[hidden] hard rule: grupos condicionais (NFref/Cartão) nunca aparecem indevidos', () => {
  assert.match(html, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/, 'regra [hidden] com !important existe no CSS');
  assert.match(html, /id="nfNFrefGroup"\s+hidden/, 'grupo NFref começa oculto');
  assert.match(html, /id="nfCardGroup"\s+hidden/, 'grupo Cartão começa oculto');
});

test('form-row responsivo: flex-wrap + base mínima (fim do campo espremido)', () => {
  assert.match(html, /\.form-row\s*\{[^}]*flex-wrap:\s*wrap/s, 'form-row quebra linha');
  assert.match(html, /\.form-group\s*\{[^}]*flex:\s*1 1 200px/s, 'form-group com base de 200px');
  assert.match(html, /@media \(max-width: 768px\)[\s\S]{0,700}\.form-group\s*\{[^}]*max-width:\s*100% !important/s, 'mobile 100%');
});

test('edit rascunho sincroniza grupos condicionais (finNFe→NFref, tPag→Cartão)', () => {
  assert.match(html, /gRef\.hidden\s*=\s*String\(ide\.finNFe \|\| '1'\) === '1'/, 'NFref recalculado na edição');
  assert.match(html, /gCard\.hidden\s*=\s*!\[?'?03'?,?\s*'?04'?\]\.includes/, 'Cartão recalculado na edição');
  assert.match(html, /nfCardTpIntegra'?,\s*card\.tpIntegra/, 'restaura tpIntegra do cartão');
});

test('hosting-files.json publica todos os JS referenciados no HTML (anti-404)', () => {
  const scripts = [...html.matchAll(/<script\s+src="([^"?]+)(?:\?v=[^"]*)?"/g)].map((m) => m[1]);
  const locais = scripts.filter((s) => !/^https?:|^\/\//.test(s));
  const faltando = locais.filter((s) => !manifest.includes(s));
  assert.deepEqual(faltando, [], 'nenhum JS local fora do manifest (404/MIME)');
});
