import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const js = readFileSync('mdf-e.js', 'utf8');

function loadDamdfe(extraWindow = {}) {
  const context = {
    window: { ...extraWindow },
    document: { addEventListener() {}, getElementById: () => null },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(readFileSync('assets/vendor/qrcode-generator.js', 'utf8'), context);
  vm.runInNewContext(js, context);
  const internals = context.window.__mdfeDamdfeInternals;
  assert.ok(internals, '__mdfeDamdfeInternals deve existir');
  return { internals, context };
}

test('logo: mesma tolerância dos pedidos (data/https/base64-cru/path)', () => {
  const { internals } = loadDamdfe();
  const n = internals.mdfeNormalizeLogo;
  assert.equal(n('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
  assert.equal(n('https://x.test/l.png'), 'https://x.test/l.png');
  assert.equal(n('A'.repeat(100)), `data:image/png;base64,${'A'.repeat(100)}`);
  assert.equal(n('/logos/x.png'), '/logos/x.png');
  assert.equal(n('logo.webp'), 'logo.webp');
  assert.equal(n(''), '');
  assert.equal(n(null), '');
});

test('empresa: espelha PT/EN + IE + logo genérico (padrão pedidos)', () => {
  const { internals } = loadDamdfe();
  const e = internals.normalizeCompanyForMdfeReport({
    nome: 'JN', cnpj: '18615107000100', inscricaoEstadual: '15123',
    endereco: 'Rua X', cidade: 'Belém', estado: 'PA', telefone: '91 1',
    logo: 'B'.repeat(100),
  });
  assert.equal(e.name, 'JN');
  assert.equal(e.nome, 'JN');
  assert.equal(e.address, 'Rua X');
  assert.equal(e.endereco, 'Rua X');
  assert.equal(e.city, 'Belém');
  assert.equal(e.state, 'PA');
  assert.equal(e.phone, '91 1');
  assert.equal(e.ie, '15123');
  assert.equal(e.logoDataUrl, `data:image/png;base64,${'B'.repeat(100)}`);
  const e2 = internals.normalizeCompanyForMdfeReport({ name: 'Y', logo: 'https://x.test/l.png' });
  assert.equal(e2.logoUrl, 'https://x.test/l.png');
  assert.equal(e2.nome, 'Y');
});

test('empresa: cascata perfil direto quando central ausente (paridade DANFE)', async () => {
  const profile = { nome: 'Perfil Direto', cnpj: '00', logoUrl: 'https://x.test/p.png' };
  const { internals } = loadDamdfe({
    firebaseService: {
      getTenantId: () => 'TENANT-1',
      loadFromFirebase: async (path) => {
        assert.equal(path, 'companies/TENANT-1/profile');
        return { success: true, data: profile };
      },
    },
  });
  const e = await internals.obterDadosEmpresaMdfe();
  assert.equal(e.name, 'Perfil Direto');
  assert.equal(e.logoUrl, 'https://x.test/p.png');
});

test('empresa: localStorage como último recurso; vazio sem fonte', async () => {
  const { internals } = loadDamdfe({
    firebaseService: { loadFromFirebase: async () => ({ success: false }) },
  });
  const e = await internals.obterDadosEmpresaMdfe();
  assert.equal(e.name, 'Empresa não informada');
});

test('logo: resolver Storage com teto 2MB + download fallback', async () => {
  const big = `data:image/png;base64,${'C'.repeat(3 * 1024 * 1024)}`;
  const { internals } = loadDamdfe({
    firebaseService: {
      getStorageDataURL: async () => big,
      getDownloadURL: async () => 'https://x.test/dl.png',
    },
  });
  assert.equal(await internals.mdfeResolverLogoEmpresa({ logoStoragePath: 'empresas/1/l.png' }), 'https://x.test/dl.png');
  const { internals: i2 } = loadDamdfe({
    firebaseService: { getStorageDataURL: async () => 'data:image/png;base64,AAA' },
  });
  assert.equal(await i2.mdfeResolverLogoEmpresa({ logoStoragePath: 'a/b.png' }), 'data:image/png;base64,AAA');
});

test('wiring: cascata + tolerância presentes no código', () => {
  assert.match(js, /loadFromFirebase\(`companies\/\$\{tid\}\/profile`\)/);
  assert.match(js, /function mdfeResolverTenantId\(\)/);
  assert.match(js, /function mdfeNormalizeLogo\(value\)/);
  assert.match(js, /out\.nome = out\.name; out\.endereco = out\.address;/);
});
