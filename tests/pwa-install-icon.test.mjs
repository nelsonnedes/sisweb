import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const readText = (path) => read(path).toString('utf8');

function pngSize(path) {
  const buffer = read(path);
  assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('PWA install icons use Sisweb product identity instead of tenant logo', () => {
  const manifest = JSON.parse(readText('manifest.json'));
  const iconSvg = readText('assets/icons/icon.svg');

  assert.equal(manifest.theme_color, '#0f172a');
  assert.equal(manifest.background_color, '#0f172a');
  assert.deepEqual(
    manifest.icons.map((icon) => icon.src),
    [
      '/assets/icons/icon-144x144.png',
      '/assets/icons/icon-192x192.png',
      '/assets/icons/icon-512x512.png',
    ]
  );
  assert.match(manifest.icons[1].purpose, /maskable/);
  assert.match(manifest.icons[2].purpose, /maskable/);

  assert.match(iconSvg, /Sisweb app icon/);
  assert.match(iconSvg, /warehouse, logistics and timber management/);
  assert.doesNotMatch(iconSvg, /JN|MADEIRAS|COM[ÉE]RCIO|EXP MADEIRAS/i);
});

test('PWA icon PNG files have installable dimensions and valid favicon exists', () => {
  assert.deepEqual(pngSize('assets/icons/icon-144x144.png'), { width: 144, height: 144 });
  assert.deepEqual(pngSize('assets/icons/apple-touch-icon.png'), { width: 180, height: 180 });
  assert.deepEqual(pngSize('assets/icons/icon-192x192.png'), { width: 192, height: 192 });
  assert.deepEqual(pngSize('assets/icons/icon-512x512.png'), { width: 512, height: 512 });

  const favicon = read('favicon.ico');
  assert.equal(favicon.readUInt16LE(0), 0);
  assert.equal(favicon.readUInt16LE(2), 1);
  assert.ok(favicon.readUInt16LE(4) >= 1);
});

test('PWA bootstrap and service worker publish the product icon assets', () => {
  const menuComponent = readText('menu-component.js');
  const sw = readText('sw.js');
  const pushService = readText('src/services/pushService.js');
  const indexHtml = readText('index.html');
  const loginHtml = readText('login.html');
  const preromaneioHtml = readText('preromaneio.html');

  assert.match(menuComponent, /const PWA_VERSION = '2026-06-11-profile-admin-v1'/);
  assert.match(menuComponent, /link\[rel="icon"\]\[sizes="192x192"\]/);
  assert.match(menuComponent, /assets\/icons\/icon-192x192\.png/);
  assert.match(menuComponent, /link\[rel="apple-touch-icon"\]/);
  assert.match(menuComponent, /assets\/icons\/apple-touch-icon\.png/);

  assert.match(sw, /const APP_VERSION = '2026-06-26-boleto-pix-lamina-v3'/);
  assert.match(sw, /'\/assets\/icons\/icon-144x144\.png'/);
  assert.match(sw, /'\/assets\/icons\/icon-192x192\.png'/);
  assert.match(sw, /'\/assets\/icons\/icon-512x512\.png'/);
  assert.match(sw, /'\/assets\/icons\/apple-touch-icon\.png'/);

  assert.match(pushService, /icon: '\/assets\/icons\/icon-192x192\.png'/);
  assert.doesNotMatch(pushService, /icon: '\/icons\/icon-192x192\.png'/);

  [indexHtml, loginHtml, preromaneioHtml].forEach((html) => {
    assert.match(html, /<link rel="manifest" href="manifest\.json">/);
    assert.match(html, /<meta name="theme-color" content="#0f172a">/);
    assert.match(html, /<link rel="icon" type="image\/png" sizes="192x192" href="assets\/icons\/icon-192x192\.png">/);
    assert.match(html, /<link rel="apple-touch-icon" sizes="180x180" href="assets\/icons\/apple-touch-icon\.png">/);
  });
});

