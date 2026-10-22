import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const moduleSrc = fs.readFileSync('modules/core/importar-romaneio.js', 'utf8');
const hosting = fs.readFileSync('hosting-files.json', 'utf8');

test('modulo de importacao cobre tipos, filtro, preview e exclusao de item', () => {
  assert.match(moduleSrc, /romaneios\/tl/);
  assert.match(moduleSrc, /romaneios\/pct/);
  assert.match(moduleSrc, /romaneios\/pes/);
  assert.match(moduleSrc, /romaneios\/tora/);
  assert.match(moduleSrc, /irFilter/);
  assert.match(moduleSrc, /data-ir-remove/);
  assert.match(moduleSrc, /existing\.concat/);
  assert.ok(hosting.includes('"modules/core/importar-romaneio.js"'));
});

test('lista de romaneios das quatro paginas oferece Importar Itens', () => {
  const checks = [
    ['modules/modals/modal-lista-romaneios.js', /open\('tl'/],
    ['modules/romaneiopct/modal-lista-romaneios-pct.js', /open\('pct'/],
    ['romaneiopes.html', /open\('pes'/],
    ['romaneio-manager.js', /open\('tora'/]
  ];
  for (const [file, pattern] of checks) {
    const src = fs.readFileSync(file, 'utf8');
    assert.match(src, /Importar Itens/);
    assert.match(src, pattern);
  }
  for (const file of ['romaneiotl.html', 'romaneiopct.html', 'romaneiopes.html', 'romaneiotora.html']) {
    const html = fs.readFileSync(file, 'utf8');
    assert.ok(html.includes('modules/core/importar-romaneio.js'), `${file} carrega importador`);
  }
});
