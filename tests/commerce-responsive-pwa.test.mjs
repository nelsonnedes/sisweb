import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), 'utf8');

function walkHtml(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (full.includes(`${join('node_modules')}`) || full.includes(`${join('tmp')}`)) continue;
    const st = statSync(full);
    if (st.isDirectory()) walkHtml(full, out);
    else if (entry.endsWith('.html')) out.push(relative(root, full).replace(/\\/g, '/'));
  }
  return out;
}

test('vendas e compras carregam camada responsiva compartilhada para PWA', () => {
  const vendasHtml = read('vendas.html');
  const comprasHtml = read('compras.html');
  const css = read('commerce-responsive.css');
  const js = read('commerce-responsive.js');

  [vendasHtml, comprasHtml].forEach((html) => {
    assert.match(html, /commerce-responsive\.css\?v=2026-06-07-print-context-v13/);
    assert.match(html, /commerce-responsive\.js\?v=2026-06-07-print-context-v13/);
    assert.match(html, /commerce-pdf-share\.js\?v=2026-06-23-logo-print-dataurl-v1/);
  });
  assert.match(vendasHtml, /vendas\.js\?v=2026-06-23-cadastro-fiscal-nfe-v1/);
  assert.match(comprasHtml, /compras\.js\?v=2026-06-23-cadastro-fiscal-nfe-v1/);
  assert.match(vendasHtml, /firebaseService\.js\?v=2026-06-12-tenant-auth-guard-v1/);
  assert.match(comprasHtml, /firebaseService\.js\?v=2026-06-12-tenant-auth-guard-v1/);

  assert.match(css, /@media \(max-width: 768px\)/);
  assert.match(css, /\.table-responsive\.mobile-cards td\[data-label="Ações"\]/);
  assert.match(css, /#listaPedidosModal \.table-responsive,[\s\S]*max-height: none !important;/);
  assert.match(css, /\.commerce-orders-table-wrap\.mobile-cards td,[\s\S]*#listaPedidosModal \.commerce-orders-table-wrap\.mobile-cards #listaPedidosTable td \{[\s\S]*white-space: normal !important;/);
  assert.match(css, /\.commerce-detail-table-wrap\.mobile-cards tr,[\s\S]*height: auto !important;/);
  assert.match(css, /\.commerce-detail-table-wrap\.mobile-cards \.commerce-card-money,[\s\S]*word-break: keep-all;/);
  assert.match(css, /\.commerce-detail-table-wrap\.mobile-cards td \{[\s\S]*grid-template-columns: minmax\(112px, 42%\) minmax\(0, 1fr\) !important;/);
  assert.match(css, /\.commerce-detail-table-wrap\.mobile-cards td:last-child:not\(\.commerce-full-row\),[\s\S]*\.commerce-detail-table-wrap\.mobile-cards td\[data-label="Total"\],[\s\S]*\.commerce-detail-table-wrap\.mobile-cards td\[data-label="Status"\] \{[\s\S]*min-width: 100% !important;[\s\S]*justify-content: initial !important;/);
  assert.match(css, /#visualizarPedidoModal \.pedido-detail-field,[\s\S]*#visualizarPedidoModal \.pedido-detail-value,[\s\S]*#visualizarPedidoModal \.pedido-meta-row \{[\s\S]*overflow-wrap: anywhere;/);
  assert.match(css, /\.table-responsive\.mobile-cards td\.commerce-full-row \{[\s\S]*width: 100% !important;[\s\S]*word-break: normal !important;/);
  assert.match(css, /#pedidoForm input\[type="date"\] \{[\s\S]*width: 100% !important;/);
  assert.match(css, /\.commerce-payment-table-wrap\.mobile-cards td \{[\s\S]*grid-template-columns: 1fr !important;/);
  assert.match(css, /\.commerce-report-table-wrap\.mobile-cards td \{[\s\S]*grid-template-columns: minmax\(104px, 40%\) minmax\(0, 1fr\) !important;/);
  assert.match(css, /\.modal-header \.close,[\s\S]*\.modal-header \.close-modal \{[\s\S]*flex: 0 0 44px;/);
  assert.match(js, /function applyLabels\(table\)/);
  assert.match(js, /cell\.dataset\.label = label/);
  assert.match(js, /MutationObserver/);
  assert.match(js, /window\.SiswebCommerceResponsive = \{ enhanceAll:/);
});

test('compras aguarda tenant autenticado antes de ler dados operacionais', () => {
  const html = read('compras.html');
  const js = read('compras.js');
  const readyScriptIndex = html.indexOf('window.__siswebFirebaseServiceReady');
  assert.notEqual(readyScriptIndex, -1, 'bootstrap do firebaseService precisa existir em compras');
  const beforeFirebaseModule = html.slice(0, readyScriptIndex);

  assert.doesNotMatch(beforeFirebaseModule, /localStorage\.getItem\('company_info'\)/);
  assert.doesNotMatch(beforeFirebaseModule, /window\.appTenantId\s*=\s*String\(tenant\)/);
  assert.match(html, /firebaseService\.js\?v=2026-06-12-tenant-auth-guard-v1/);
  assert.match(html, /compras\.js\?v=2026-06-23-cadastro-fiscal-nfe-v1/);

  const initStart = js.indexOf("document.addEventListener('DOMContentLoaded', async () =>");
  const guardCall = js.indexOf('await garantirContextoEmpresaCompras();', initStart);
  const loadSuppliersCall = js.indexOf('carregarFornecedores(),', initStart);

  assert.match(js, /async function garantirContextoEmpresaCompras\(\)/);
  assert.match(js, /window\.__siswebFirebaseServiceReady/);
  assert.match(js, /function isFirebaseOfflineModeCompras\(\)/);
  assert.match(js, /resolveAuthenticatedTenant\(\{ timeoutMs: 4500, allowCached: isOffline \}\)/);
  assert.match(js, /if \(tenant && isFirebaseOfflineModeCompras\(\)\) return \{ success: true, companyId: tenant, fallback: true, offline: true \};/);
  assert.doesNotMatch(js, /if \(tenant\) return \{ success: true, companyId: tenant, fallback: true \};/);
  assert.ok(guardCall > initStart, 'guarda precisa estar dentro da inicializacao de compras');
  assert.ok(loadSuppliersCall > guardCall, 'fornecedores/produtos devem carregar depois da guarda');
  assert.match(js, /limparContextoEmpresaComprasInseguro\(\)/);
});

test('abas de clientes em vendas e fornecedores em compras sao nativas', () => {
  const vendasHtml = read('vendas.html');
  const comprasHtml = read('compras.html');
  const vendasJs = read('vendas.js');
  const comprasJs = read('compras.js');
  const clientHtml = read('client.html');
  const fornecedorHtml = read('fornecedor.html');
  const clientJs = read('js/client.js');
  const fornecedorJs = read('js/fornecedor.js');
  const css = read('commerce-responsive.css');

  assert.match(vendasHtml, /id="vendasClientesPanel" data-native-module="clientes"/);
  assert.match(vendasHtml, /id="vendasClienteForm" class="sales-client-form"/);
  assert.match(vendasHtml, /id="vendasClientesTable"/);
  assert.doesNotMatch(vendasHtml, /id="clientesEmbeddedFrame"/);
  assert.doesNotMatch(vendasHtml, /data-src="client\.html\?embedded=true"/);
  assert.match(comprasHtml, /id="comprasFornecedoresPanel" data-native-module="fornecedores"/);
  assert.match(comprasHtml, /id="comprasFornecedorForm" class="purchase-supplier-form"/);
  assert.match(comprasHtml, /id="comprasFornecedoresTable"/);
  assert.doesNotMatch(comprasHtml, /id="fornecedoresEmbeddedFrame"/);
  assert.doesNotMatch(comprasHtml, /data-src="fornecedor\.html\?embedded=true"/);

  assert.doesNotMatch(vendasHtml, /window\.location\.href=['"]client\.html['"]/);
  assert.doesNotMatch(comprasHtml, /window\.location\.href=['"]fornecedor\.html['"]/);
  assert.doesNotMatch(comprasJs, /window\.location\.href\s*=\s*['"]fornecedor\.html['"]/);
  assert.doesNotMatch(vendasJs, /window\.open\(['"]client\.html['"]/);

  assert.match(vendasJs, /async function carregarClientesAbaVenda\(forceRefresh = false\)/);
  assert.match(vendasJs, /tabName === 'clientes'[\s\S]*carregarClientesAbaVenda\(false\)/);
  assert.match(vendasJs, /function vendasClientesGetService\(\)/);
  assert.match(vendasJs, /async function vendasClientesSalvar\(event\)/);
  assert.match(vendasJs, /async function vendasClientesExcluir\(id\)/);
  assert.match(vendasJs, /window\.vendasClientesNovo = vendasClientesNovo/);
  assert.match(vendasJs, /window\.vendasClientesRecarregar = vendasClientesRecarregar/);
  assert.doesNotMatch(vendasJs, /function carregarPainelEmbutido\(content\)/);
  assert.match(comprasJs, /async function carregarFornecedoresAbaCompra\(forceRefresh = false\)/);
  assert.match(comprasJs, /tabId === 'clientes'[\s\S]*carregarFornecedoresAbaCompra\(false\)/);
  assert.match(comprasJs, /function comprasFornecedoresGetService\(\)/);
  assert.match(comprasJs, /async function comprasFornecedoresSalvar\(event\)/);
  assert.match(comprasJs, /async function comprasFornecedoresExcluir\(id\)/);
  assert.match(comprasJs, /window\.comprasFornecedoresNovo = comprasFornecedoresNovo/);
  assert.match(comprasJs, /window\.comprasFornecedoresRecarregar = comprasFornecedoresRecarregar/);
  assert.doesNotMatch(comprasJs, /function carregarPainelEmbutido\(content\)/);

  assert.match(clientHtml, /document\.documentElement\.classList\.add\('sisweb-embedded'\)/);
  assert.match(fornecedorHtml, /document\.documentElement\.classList\.add\('sisweb-embedded'\)/);
  assert.match(css, /html\.sisweb-embedded main-menu,[\s\S]*html\.sisweb-embedded \.global-system-footer/);

  assert.match(clientJs, /source: 'sisweb-commerce-embedded'/);
  assert.match(clientJs, /type: 'sisweb:clients:updated'/);
  assert.match(fornecedorJs, /source: 'sisweb-commerce-embedded'/);
  assert.match(fornecedorJs, /type: 'sisweb:suppliers:updated'/);
  assert.match(vendasJs, /event\.origin !== window\.location\.origin/);
  assert.match(comprasJs, /event\.origin !== window\.location\.origin/);
});

test('pdf de pedidos em PWA usa jsPDF local e compartilhamento nativo quando disponivel', () => {
  const helper = read('commerce-pdf-share.js');
  const sw = read('sw.js');

  assert.match(helper, /JSPDF_LOCAL = '\/assets\/vendor\/jspdf\.umd\.min\.js'/);
  assert.match(helper, /JSPDF_CDN = 'https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/2\.5\.1\/jspdf\.umd\.min\.js'/);
  assert.match(helper, /function buildPrintDocument\(options = \{\}\)/);
  assert.match(helper, /sisweb-print-header/);
  assert.match(helper, /function printHtmlDocument\(options = \{\}\)/);
  assert.match(helper, /options\.html \|\| buildPrintDocument\(options\)/);
  assert.match(helper, /function extractFirebaseStoragePathFromUrl\(value\)/);
  assert.match(helper, /isFirebaseStorageHttpUrl\(candidate\)/);
  assert.match(helper, /function withTimeout\(promise, timeoutMs/);
  assert.match(helper, /async function resolveCompanyLogoDataUrl\(company = \{\}, options = \{\}\)/);
  assert.match(helper, /async function preparePrintOptions\(options = \{\}\)/);
  assert.match(helper, /service\.getStorageDataURL/);
  assert.match(helper, /company\.logoStoragePath/);
  assert.match(helper, /new File\(\[blob\], safeName, \{ type: 'application\/pdf' \}\)/);
  assert.match(helper, /navigator\.canShare && navigator\.share/);
  assert.match(sw, /'\/assets\/vendor\/jspdf\.umd\.min\.js'/);
});

test('pdf PWA converte logo do Storage para DataURL antes de desenhar cabecalho', async () => {
  const helper = read('commerce-pdf-share.js');
  const calls = [];
  class FakeDoc {
    constructor() {
      this.pages = 1;
      this.internal = {
        pageSize: {
          getWidth: () => 210,
          getHeight: () => 297,
        },
      };
    }
    setFillColor(...args) { calls.push({ type: 'setFillColor', args }); }
    setDrawColor(...args) { calls.push({ type: 'setDrawColor', args }); }
    setTextColor(...args) { calls.push({ type: 'setTextColor', args }); }
    setFontSize(size) { calls.push({ type: 'setFontSize', size }); }
    setFont(...args) { calls.push({ type: 'setFont', args }); }
    roundedRect(...args) { calls.push({ type: 'roundedRect', args }); }
    rect(...args) { calls.push({ type: 'rect', args }); }
    circle(...args) { calls.push({ type: 'circle', args }); }
    text(...args) { calls.push({ type: 'text', args }); }
    line(...args) { calls.push({ type: 'line', args }); }
    addImage(...args) { calls.push({ type: 'addImage', args }); }
    addPage() { this.pages += 1; calls.push({ type: 'addPage' }); }
    setPage(page) { calls.push({ type: 'setPage', page }); }
    getNumberOfPages() { return this.pages; }
    splitTextToSize(value) { return [String(value ?? '')]; }
    output() { return 'PDF'; }
  }
  const logoDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const context = {
    window: {
      jspdf: { jsPDF: FakeDoc },
      firebaseService: {
        async getStorageDataURL(path) {
          calls.push({ type: 'getStorageDataURL', path });
          return logoDataUrl;
        },
      },
    },
    console,
    navigator: {},
  };
  vm.runInNewContext(helper, context);
  await context.window.SiswebCommercePdf.createOrdersPdf({
    company: {
      name: 'Empresa Teste',
      logoStoragePath: 'companies/tenant-a/profile/logo/logo.png',
    },
    orders: [{ numero: '1', data: '2026-06-07', status: 'pendente', itens: [], total: 0 }],
    formatDate: (value) => String(value || ''),
    formatCurrency: (value) => `R$ ${Number(value || 0).toFixed(2)}`,
    formatNumber: (value) => String(value || 0),
  });

  assert.ok(calls.some((call) => call.type === 'getStorageDataURL' && call.path === 'companies/tenant-a/profile/logo/logo.png'));
  assert.ok(calls.some((call) => call.type === 'addImage' && call.args[0] === logoDataUrl));
});

test('pdf PWA prioriza logoStoragePath e nao faz fetch CORS da URL tokenizada do Firebase Storage', async () => {
  const helper = read('commerce-pdf-share.js');
  const calls = [];
  class FakeDoc {
    constructor() {
      this.pages = 1;
      this.internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    }
    setFillColor(...args) { calls.push({ type: 'setFillColor', args }); }
    setDrawColor(...args) { calls.push({ type: 'setDrawColor', args }); }
    setTextColor(...args) { calls.push({ type: 'setTextColor', args }); }
    setFontSize(size) { calls.push({ type: 'setFontSize', size }); }
    setFont(...args) { calls.push({ type: 'setFont', args }); }
    roundedRect(...args) { calls.push({ type: 'roundedRect', args }); }
    rect(...args) { calls.push({ type: 'rect', args }); }
    circle(...args) { calls.push({ type: 'circle', args }); }
    text(...args) { calls.push({ type: 'text', args }); }
    line(...args) { calls.push({ type: 'line', args }); }
    addImage(...args) { calls.push({ type: 'addImage', args }); }
    addPage() { this.pages += 1; calls.push({ type: 'addPage' }); }
    setPage(page) { calls.push({ type: 'setPage', page }); }
    getNumberOfPages() { return this.pages; }
    splitTextToSize(value) { return [String(value ?? '')]; }
    output() { return 'PDF'; }
  }
  const logoDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const storagePath = 'companies/1749492103278/profile/logo/1779188923523_Logo_JN.png';
  const tokenUrl = `https://firebasestorage.googleapis.com/v0/b/sisweb-7ce82.firebasestorage.app/o/${encodeURIComponent(storagePath)}?alt=media&token=abc`;
  const context = {
    window: {
      location: { origin: 'https://sisweb-7ce82.web.app' },
      jspdf: { jsPDF: FakeDoc },
      firebaseService: {
        async getStorageDataURL(path) {
          calls.push({ type: 'getStorageDataURL', path });
          if (/^https?:/i.test(String(path))) throw new Error('Nao deve usar URL HTTP no Storage getter');
          return logoDataUrl;
        },
      },
    },
    fetch() {
      calls.push({ type: 'fetch' });
      throw new Error('fetch CORS nao deve ser chamado para URL do Firebase Storage');
    },
    console,
    navigator: {},
    URL,
    decodeURIComponent,
  };
  vm.runInNewContext(helper, context);
  await context.window.SiswebCommercePdf.createOrdersPdf({
    company: {
      name: 'Empresa Teste',
      logoUrl: tokenUrl,
      logoStoragePath: storagePath,
    },
    orders: [{ numero: '1', data: '2026-06-07', status: 'pendente', itens: [], total: 0 }],
    formatDate: (value) => String(value || ''),
    formatCurrency: (value) => `R$ ${Number(value || 0).toFixed(2)}`,
    formatNumber: (value) => String(value || 0),
  });

  assert.ok(calls.some((call) => call.type === 'getStorageDataURL' && call.path === storagePath));
  assert.ok(!calls.some((call) => call.type === 'getStorageDataURL' && /^https?:/i.test(String(call.path))));
  assert.ok(!calls.some((call) => call.type === 'fetch'));
  assert.ok(calls.some((call) => call.type === 'addImage' && call.args[0] === logoDataUrl));

  calls.length = 0;
  await context.window.SiswebCommercePdf.createOrdersPdf({
    company: {
      name: 'Empresa Teste',
      logoUrl: tokenUrl,
    },
    orders: [{ numero: '2', data: '2026-06-07', status: 'pendente', itens: [], total: 0 }],
    formatDate: (value) => String(value || ''),
    formatCurrency: (value) => `R$ ${Number(value || 0).toFixed(2)}`,
    formatNumber: (value) => String(value || 0),
  });

  assert.ok(calls.some((call) => call.type === 'getStorageDataURL' && call.path === storagePath));
  assert.ok(!calls.some((call) => call.type === 'fetch'));
});

test('HTML de impressao converte logo do Storage para DataURL antes de montar cabecalho', async () => {
  const helper = read('commerce-pdf-share.js');
  const calls = [];
  const storagePath = 'companies/tenant-a/profile/logo/logo.png';
  const downloadUrl = 'https://firebasestorage.googleapis.com/v0/b/sisweb-7ce82.firebasestorage.app/o/logo.png?alt=media&token=abc';
  const logoDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const context = {
    window: {
      location: { origin: 'https://sisweb-7ce82.web.app' },
      firebaseService: {
        async getStorageDataURL(path) {
          calls.push({ type: 'getStorageDataURL', path });
          return logoDataUrl;
        },
      },
    },
    fetch() {
      calls.push({ type: 'fetch' });
      throw new Error('fetch CORS nao deve ser chamado para URL do Firebase Storage');
    },
    console,
    navigator: {},
    URL,
    decodeURIComponent,
  };

  vm.runInNewContext(helper, context);
  const prepared = await context.window.SiswebCommercePdf.preparePrintOptions({
    title: 'Pedido de Venda',
    company: {
      name: 'Empresa Teste',
      logo: downloadUrl,
      logoStoragePath: storagePath,
    },
    bodyHtml: '<section>Conteudo do pedido</section>',
  });
  const html = context.window.SiswebCommercePdf.buildPrintDocument(prepared);

  assert.ok(calls.some((call) => call.type === 'getStorageDataURL' && call.path === storagePath));
  assert.ok(!calls.some((call) => call.type === 'fetch'));
  assert.match(html, /data:image\/png;base64,iVBORw0KGgo=/);
  assert.doesNotMatch(html, /firebasestorage\.googleapis\.com/);
  assert.doesNotMatch(html, /<img src="companies\//);
});

test('lista de pedidos usa impressao HTML no PC e PDF apenas em PWA', () => {
  const vendasJs = read('vendas.js');
  const comprasJs = read('compras.js');
  const vendasHtml = read('vendas.html');
  const comprasHtml = read('compras.html');
  const firebaseService = read('firebaseService.js');

  assert.match(vendasJs, /async function imprimirPedidosSelecionados\(\)[\s\S]*if \(isCommercePwaPrintContext\(\)\) \{[\s\S]*await exportarPedidosVendaPdf\(pedidosParaImprimir\)[\s\S]*await imprimirPedidosVendaSelecionadosDesktop\(pedidosParaImprimir\)/);
  assert.match(comprasJs, /async function imprimirPedidosSelecionados\(\)[\s\S]*if \(isCommercePwaPrintContext\(\)\) \{[\s\S]*await exportarPedidosCompraPdf\(pedidosParaImprimir\)[\s\S]*await imprimirPedidosCompraSelecionadosDesktop\(pedidosParaImprimir\)/);

  assert.match(vendasJs, /async function imprimirPedidosVendaSelecionadosDesktop\(pedidosParaImprimir\)/);
  assert.match(vendasJs, /window\.matchMedia\('\(pointer: coarse\)'\)\.matches[\s\S]*window\.innerWidth <= 768/);
  assert.match(vendasJs, /display-mode: minimal-ui/);
  assert.doesNotMatch(vendasJs, /\|\| window\.innerWidth <= 768/);
  assert.doesNotMatch(vendasJs, /return window\.innerWidth <= 768/);
  assert.match(vendasJs, /await imprimirPedido\(getPedidoVendaId\(pedidos\[0\]\)\)/);
  assert.match(vendasJs, /await gerarHTMLImpressaoPedido\(pedido\)/);
  assert.match(vendasJs, /await helper\.preparePrintOptions\(printOptions\)/);
  assert.match(vendasJs, /function montarHTMLImpressaoLotePedidos\(documentos, title = 'Pedidos'\)/);
  assert.match(vendasJs, /\.sisweb-print-batch-page \{ break-after: page; page-break-after: always;/);

  assert.match(comprasJs, /async function imprimirPedidosCompraSelecionadosDesktop\(pedidosParaImprimir\)/);
  assert.match(comprasJs, /window\.matchMedia\('\(pointer: coarse\)'\)\.matches[\s\S]*window\.innerWidth <= 768/);
  assert.match(comprasJs, /display-mode: minimal-ui/);
  assert.doesNotMatch(comprasJs, /\|\| window\.innerWidth <= 768/);
  assert.doesNotMatch(comprasJs, /return window\.innerWidth <= 768/);
  assert.match(comprasJs, /await imprimirPedido\(getPedidoCompraId\(pedidos\[0\]\)\)/);
  assert.match(comprasJs, /await gerarHTMLImpressaoPedidoCompra\(pedido\)/);
  assert.match(comprasJs, /await helper\.preparePrintOptions\(printOptions\)/);
  assert.match(comprasJs, /function montarHTMLImpressaoLotePedidos\(documentos, title = 'Pedidos'\)/);
  assert.match(comprasJs, /async function gerarHTMLImpressaoPedidoCompra\(pedido\)/);

  [
    { html: vendasHtml, version: '2026-06-12-tenant-auth-guard-v1' },
    { html: comprasHtml, version: '2026-06-12-tenant-auth-guard-v1' },
  ].forEach(({ html, version }) => {
    assert.match(html, new RegExp(`firebaseService\\.js\\?v=${version}`));
    assert.match(html, /const existingFirebaseService = window\.firebaseService \|\| \{\}/);
    assert.match(html, /\.\.\.existingFirebaseService,[\s\S]*\.\.\.firebaseSvc/);
    assert.match(html, /serverTimestamp: firebaseSvc\.getServerTimestamp \|\| existingFirebaseService\.serverTimestamp/);
  });
  assert.match(vendasHtml, /window\.__siswebFirebaseServiceReady = \(async function/);
  assert.match(vendasHtml, /resolveAuthenticatedTenant: firebaseSvc\.resolveAuthenticatedTenant \|\| existingFirebaseService\.resolveAuthenticatedTenant/);
  assert.match(firebaseService, /getStorageDataURL,\s*deleteStorageFile/);
  assert.match(firebaseService, /const isTenantLogoPath = [\s\S]*profile\\\/logo/);
  assert.match(firebaseService, /callFunction\('getCompanyLogoDataUrl'/);
});

test('compras possui relatórios e busca de fornecedor carregados no script ativo', () => {
  const comprasHtml = read('compras.html');
  const comprasJs = read('compras.js');

  assert.match(comprasHtml, /onclick="gerarRelatorioCompras\(\)"/);
  assert.match(comprasHtml, /onclick="exportarRelatorioComprasCSV\(\)"/);
  assert.match(comprasHtml, /onclick="exportarRelatorioComprasPDF\(\)"/);
  assert.match(comprasHtml, /onclick="abrirCustomizarColunasCompras\(\)"/);
  assert.match(comprasHtml, /<th class="actions-col">Ações<\/th>/);
  assert.match(comprasHtml, /commerce-responsive\.js\?v=2026-06-07-print-context-v13/);

  assert.match(comprasJs, /async function gerarRelatorioCompras\(\)/);
  assert.match(comprasJs, /function exportarRelatorioComprasCSV\(\)/);
  assert.match(comprasJs, /function exportarRelatorioComprasPDF\(\)/);
  assert.match(comprasJs, /clone\.querySelectorAll\('h3, button, input, \.action-buttons, \.acoes-buttons, \.no-print, \[data-col="acoes"\]'\)/);
  assert.match(comprasJs, /await helper\.preparePrintOptions\(printOptions\)/);
  assert.match(comprasJs, /helper\.printHtmlDocument\(preparedOptions\)/);
  assert.match(comprasJs, /function abrirCustomizarColunasCompras\(\)/);
  assert.match(comprasJs, /function aplicarCustomizacaoColunasCompras\(\)/);
  assert.match(comprasJs, /function filtrarFornecedoresSelect\(\)/);
  assert.match(comprasJs, /window\.filtrarFornecedoresSelect = filtrarFornecedoresSelect/);
  assert.doesNotMatch(comprasJs, /window\.filtrarFornecedoresSelect = \(\) => \{\}/);
  assert.match(comprasJs, /viewPedidoFornecedorDetalhes/);
  assert.match(comprasJs, /class="acoes-cell"/);
});

test('paginas html nao mantem cachebuster antigo do menu PWA', () => {
  const offenders = walkHtml(root).filter((path) => {
    const html = read(path);
    return /menu-component\.js\?v=(?!2026-06-07-commerce-pwa-menu-v1|2026-06-10-promo-crud-functions-v2|2026-06-10-subscription-status-ux-v1|2026-06-10-admin-assinaturas-v1|2026-06-11-admin-trial-v1|2026-06-11-admin-trial-v2|2026-06-11-profile-admin-v1|2026-06-11-company-profile-permissions-v1|2026-06-11-company-profile-permissions-v2|2026-06-11-company-profile-permissions-v3)/.test(html);
  });
  assert.deepEqual(offenders, []);
});

