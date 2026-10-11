import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

// Fase A IBGE: serviço único + snapshot + delegação (sem regressão fiscal).

test('serviço único existe com cadeia cache→API→snapshot', async (t) => {
  const svc = fs.readFileSync('js/municipios-ibge.js', 'utf8');
  await t.test('API listar/resolverCodigo/limparCache', () => {
    assert.ok(svc.includes('window.MunicipiosIBGE'), 'expõe global');
    assert.ok(svc.includes('async function listar'), 'listar');
    assert.ok(svc.includes('async function resolverCodigo'), 'resolverCodigo');
    assert.ok(svc.includes('function limparCache'), 'limparCache');
  });

  await t.test('TTL 30 dias e snapshot embarcado', () => {
    assert.ok(svc.includes('30 * 24 * 60 * 60 * 1000'), 'TTL 30d');
    assert.ok(svc.includes('data/municipios-ibge.json'), 'snapshot local');
    assert.ok(svc.includes('../data/municipios-ibge.json'), 'snapshot subpasta');
  });

  await t.test('código 7 dígitos e normalização acento-insensível', () => {
    assert.ok(svc.includes("padStart(7, '0')"), '7 dígitos');
    assert.ok(svc.includes("normalize('NFD')"), 'remove acentos');
  });
});

test('snapshot oficial completo', async (t) => {
  const snap = JSON.parse(fs.readFileSync('data/municipios-ibge.json', 'utf8'));
  await t.test('27 UFs e 5571 municípios', () => {
    assert.strictEqual(Object.keys(snap).length, 27);
    const total = Object.values(snap).reduce((s, a) => s + a.length, 0);
    assert.strictEqual(total, 5571);
  });

  await t.test('ids numéricos e nomes ordenados', () => {
    assert.ok(snap.SP.some((c) => c.nome === 'São Paulo' && c.id === 3550308),
      'São Paulo 3550308');
    const nomes = snap.MG.map((c) => c.nome);
    const ord = [...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    assert.deepStrictEqual(nomes, ord, 'MG ordenado pt-BR');
  });
});

test('delegação preserva assinaturas', async (t) => {
  const pontos = ['js/client.js', 'js/fornecedor.js', 'fornecedor-modals.js',
    'company.html', 'cities-loader.js', 'preromaneio-modals.js'];
  for (const f of pontos) {
    await t.test(`${f} usa o serviço com fallback`, () => {
      const src = fs.readFileSync(f, 'utf8');
      assert.ok(src.includes('window.MunicipiosIBGE'), `${f} delega`);
    });
  }

  await t.test('campo canônico mantido no save', () => {
    for (const f of ['js/client.js', 'js/fornecedor.js']) {
      const src = fs.readFileSync(f, 'utf8');
      assert.ok(src.includes('codigoMunicipio'), `${f} grava canônico`);
    }
  });

  await t.test('deploy: serviço e snapshot no allowlist + menu carrega', () => {
    const allow = fs.readFileSync('hosting-files.json', 'utf8');
    assert.ok(allow.includes('js/municipios-ibge.js'), 'serviço publica');
    assert.ok(allow.includes('data/municipios-ibge.json'), 'snapshot publica');
    const menu = fs.readFileSync('menu-component.js', 'utf8');
    assert.ok(menu.includes('js/municipios-ibge.js'), 'menu carrega global');
  });
});
