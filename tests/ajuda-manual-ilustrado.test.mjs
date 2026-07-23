import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const readPngDimensions = (path) => {
  const buffer = readFileSync(new URL(`../${path}`, import.meta.url));
  const signature = buffer.subarray(0, 8).toString('hex');

  assert.equal(signature, '89504e470d0a1a0a', `${path} precisa ser PNG valido`);

  return {
    size: buffer.byteLength,
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
};

test('ajuda manual usa prints sanitizados sem imagens externas ou help-assets publicos', () => {
  const ajudaHtml = read('ajuda.html');
  const ajudaJs = read('ajuda.js');
  const firebaseConfig = JSON.parse(read('firebase.json'));

  assert.match(ajudaHtml, /Sem dados reais/);
  assert.match(ajudaJs, /HELP_VERSION/);
  assert.match(ajudaJs, /assets\/help-manual/);
  assert.match(ajudaJs, /manual-shot-image/);
  assert.match(ajudaJs, /Print sanitizado/);
  assert.match(ajudaHtml, /help-gallery\.generated\.js/);
  assert.match(ajudaJs, /SISWEB_HELP_FULL_GALLERY/);

  for (const source of [ajudaHtml, ajudaJs]) {
    assert.doesNotMatch(source, /text_to_image/i);
    assert.doesNotMatch(source, /coreva-normal\.trae\.ai/i);
    assert.doesNotMatch(source, /help-assets\//i);
  }

  assert.ok(firebaseConfig.hosting.ignore.includes('help-assets/**'), 'help-assets precisa ficar fora do Hosting');
  assert.ok(
    firebaseConfig.hosting.headers.some((item) => item.source === 'assets/help-manual/**/*.@(png|webp|avif)'),
    'prints do manual precisam ter cache proprio no Hosting'
  );
});

test('ajuda cobre modulos publicos e oculta conteudo interno de super admin', () => {
  const ajudaJs = read('ajuda.js');
  const requiredIds = [
    'inicio',
    'navegacao',
    'empresa',
    'cadastros',
    'romaneios',
    'vendas',
    'compras',
    'estoque',
    'financas',
    'folha',
    'fiscal',
    'assinatura',
    'perfil',
    'suporte'
  ];

  for (const id of requiredIds) {
    assert.match(ajudaJs, new RegExp(`id:\\s*'${id}'`), `topico ${id} precisa existir`);
  }

  assert.match(ajudaJs, /Central de Suporte/);
  assert.match(ajudaJs, /QR Code PIX/);
  assert.match(ajudaJs, /Notas Fiscais e MDF-e/);
  assert.doesNotMatch(ajudaJs, /id:\s*'admin'/);
  assert.doesNotMatch(ajudaJs, /Super Admin/);
  assert.doesNotMatch(ajudaJs, /Fila de suporte no Admin/);
});

test('ajuda documenta modais e fluxo de busca responsivo', () => {
  const ajudaHtml = read('ajuda.html');
  const ajudaJs = read('ajuda.js');

  assert.match(ajudaHtml, /id="helpSearchInput"/);
  assert.match(ajudaHtml, /id="helpLightbox"/);
  assert.match(ajudaHtml, /manual-layout/);
  assert.match(ajudaHtml, /@media \(max-width: 980px\)/);
  assert.match(ajudaHtml, /@media \(max-width: 640px\)/);
  assert.match(ajudaJs, /tokens\.every\(\(token\) => topic\._idx\.includes\(token\)\)/);

  const modalMentions = [
    'Lista de Pedidos',
    'QR Code PIX',
    'Registrar Pagamento',
    'Rastreabilidade',
    'Resposta do suporte',
    'Solicitar prorrogação'
  ];
  for (const text of modalMentions) {
    assert.match(ajudaJs, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('ajuda publica sem sessao esconde menu e oferece registro', () => {
  const ajudaHtml = read('ajuda.html');

  assert.match(ajudaHtml, /<body class="manual-auth-pending">/);
  assert.match(ajudaHtml, /class="manual-public-gate"/);
  assert.match(ajudaHtml, /Registrar-se/);
  assert.match(ajudaHtml, /subscription\.html\?cupom=BLACKFRIDAI20&utm_source=copy&utm_medium=share&utm_campaign=madeireiro/);
  assert.match(ajudaHtml, /body\.manual-public main-menu/);
  assert.match(ajudaHtml, /manual-private/);
  assert.match(ajudaHtml, /import \{ authService \} from '\.\/firebaseService\.js\?v=[^"'\s]+'/);
  assert.match(ajudaHtml, /function applyManualAccessMode\(\)/);
  assert.match(ajudaHtml, /authService\.getCurrentUser\(\)/);
  assert.doesNotMatch(ajudaHtml, /auth\.js\?v=/);
});

test('prints sanitizados do manual existem para modulos publicos', () => {
  const requiredAssets = [
    'inicio-1',
    'navegacao-1',
    'empresa-1',
    'empresa-2',
    'cadastros-1',
    'romaneios-1',
    'romaneios-2',
    'vendas-1',
    'vendas-2',
    'vendas-3',
    'compras-1',
    'compras-2',
    'estoque-1',
    'estoque-2',
    'financas-1',
    'financas-2',
    'folha-1',
    'folha-2',
    'folha-3',
    'fiscal-1',
    'assinatura-1',
    'assinatura-2',
    'perfil-1',
    'perfil-2',
    'suporte-1'
  ];

  for (const asset of requiredAssets) {
    const path = `assets/help-manual/${asset}.png`;
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `print sanitizado ausente: ${path}`);
    const image = readPngDimensions(path);

    assert.ok(image.size > 8000, `print sanitizado pequeno demais: ${path}`);
    assert.ok(image.width >= 320, `print sanitizado estreito demais: ${path}`);
    assert.ok(image.height >= 240, `print sanitizado baixo demais: ${path}`);
  }
});

test('galeria completa cobre rotas, abas e modais publicos sem admin', () => {
  const galleryJs = read('assets/help-manual/help-gallery.generated.js');
  const inventory = JSON.parse(read('docs/help-manual-inventory.generated.json'));
  const routes = JSON.parse(read('tools/help-screenshots/routes.full-training.generated.json'));
  const pngFiles = readdirSync(new URL('../assets/help-manual/', import.meta.url)).filter((file) => file.endsWith('.png'));

  assert.match(galleryJs, /SISWEB_HELP_FULL_GALLERY/);
  assert.ok(routes.length >= 150, 'rotas completas precisam cobrir paginas, abas, modais e acoes');
  assert.ok(pngFiles.length >= routes.length, 'prints completos precisam existir no diretorio do manual');
  assert.equal(inventory.summary.publicOperational, 17);
  assert.equal(inventory.summary.accountSupport, 8);
  assert.ok(inventory.summary.modals >= 80);
  assert.ok(inventory.summary.tabs >= 60);

  for (const source of [galleryJs, JSON.stringify(routes)]) {
    assert.doesNotMatch(source, /admin\.html/i);
    assert.doesNotMatch(source, /admin-access-governance/i);
    assert.doesNotMatch(source, /Super Admin/i);
    assert.doesNotMatch(source, /Fila de Suporte/i);
  }

  for (const expected of ['romaneios', 'compras', 'estoque', 'financas', 'folha', 'fiscal', 'vendas']) {
    assert.match(galleryJs, new RegExp(`"${expected}"\\s*:`), `galeria precisa conter ${expected}`);
  }
});

