import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const js = readFileSync('nf-danfe.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

function loadDanfe({ withQrLib = false } = {}) {
  let fillRectCalls = 0;
  const context = {
    window: {},
    document: { addEventListener() {} },
    console: { log() {}, warn() {}, error() {} },
  };
  if (withQrLib) {
    vm.runInNewContext(readFileSync('assets/vendor/qrcode-generator.js', 'utf8'), context);
    context.document.createElement = (tag) => {
      if (String(tag).toLowerCase() !== 'canvas') throw new Error('só canvas no teste');
      return {
        width: 0,
        height: 0,
        getContext: () => ({
          fillRect() { fillRectCalls++; },
          fillStyle: '',
        }),
        toDataURL: () => 'data:image/png;base64,TESTE',
      };
    };
  }
  vm.runInNewContext(js, context);
  assert.ok(context.window.NFDanfe, 'NFDanfe deve existir');
  return { NFDanfe: context.window.NFDanfe, fillRectCalls: () => fillRectCalls };
}

const CHAVE44 = '35260112345678000195550010000017241517317380';

test('CODE128: tabela íntegra (107 entradas, somas de módulos, start/stop)', () => {
  const { NFDanfe } = loadDanfe();
  const P = NFDanfe.CODE128_PATTERNS;
  assert.equal(P.length, 107, 'índices 0–106');
  for (let i = 0; i <= 105; i++) {
    assert.match(P[i], /^[1-4]{6}$/, `padrão ${i} com 6 elementos 1–4`);
    const soma = P[i].split('').reduce((s, d) => s + Number(d), 0);
    assert.equal(soma, 11, `padrão ${i} soma 11 módulos`);
  }
  assert.equal(P[105], '211232', 'START C oficial');
  assert.match(P[106], /^[1-4]{7}$/, 'STOP com 7 elementos');
  assert.equal(P[106].split('').reduce((s, d) => s + Number(d), 0), 13, 'STOP soma 13 módulos (MOC)');
});

test('CODE128C: valores + checksum + 277 módulos p/ chave de 44 dígitos', () => {
  const { NFDanfe } = loadDanfe();
  const P = NFDanfe.CODE128_PATTERNS;
  const values = NFDanfe.buildCode128CValues(CHAVE44);
  assert.ok(values, 'chave válida gera valores');
  assert.equal(values[0], 105, 'abre com START C');
  assert.equal(values[values.length - 1], 106, 'fecha com STOP');
  assert.equal(values.length, 1 + 22 + 1 + 1, 'start + 22 pares + DV + stop');
  const esperadoDV = values.slice(0, -2).reduce((s, v, i) => s + (i === 0 ? v : v * i), 0) % 103;
  assert.equal(values[values.length - 2], esperadoDV, 'dígito verificador mod 103');
  assert.equal(values[values.length - 2], values[1 + 22], 'DV na posição correta');
  const modulos = values.map((v) => P[v]).join('').split('').reduce((s, d) => s + Number(d), 0);
  assert.equal(modulos, 277, '11 + 22×11 + 11 + 13 (MOC: 297 com quiet zone)');
  assert.equal(NFDanfe.buildCode128CValues('123'), null, 'dígitos ímpares → null');
  assert.equal(NFDanfe.buildCode128CValues(''), null, 'vazio → null');
});

test('CODE128C: desenho com doc mockado + recusa inválida', () => {
  const { NFDanfe } = loadDanfe();
  let rects = 0;
  const doc = { setFillColor() {}, rect() { rects++; } };
  assert.equal(NFDanfe.drawCode128C(doc, CHAVE44, 0, 0, 80, 15), true);
  assert.equal(rects, 76, '24 símbolos × 3 barras + STOP com 4');
  assert.equal(NFDanfe.drawCode128C(doc, '123', 0, 0, 80, 15), false);
});

test('QR NFC-e: 100% local, sem vazamento a terceiro', () => {
  assert.doesNotMatch(js, /api\.qrserver\.com\/v1\/create-qr-code/, 'sem fallback que vaza a chave');
  assert.doesNotMatch(js, /new window\.QRCode\(/, 'sem qrcodejs via CDN (bloqueado pelo CSP)');
  assert.doesNotMatch(html, /qrcodejs/, 'tag CDN morta removida do HTML');
  assert.match(html, /src="assets\/vendor\/qrcode-generator\.js\?v=[0-9a-f]+"/);
});

test('QR NFC-e: gera PNG local com a lib vendored; null sem ela', async () => {
  const { NFDanfe, fillRectCalls } = loadDanfe({ withQrLib: true });
  const url = await NFDanfe.gerarQRCodeDataURL('https://exemplo.test/qr?ch=123', 200);
  assert.ok(url && url.startsWith('data:image/png'), 'data URL PNG');
  assert.ok(fillRectCalls() > 100, `módulos pintados (${fillRectCalls()})`);
  const semLib = loadDanfe().NFDanfe;
  assert.equal(await semLib.gerarQRCodeDataURL('abc', 80), null, 'sem lib → null (texto alternativo, sem vazar)');
  assert.equal(await semLib.gerarQRCodeDataURL('', 80), null, 'texto vazio → null');
});
