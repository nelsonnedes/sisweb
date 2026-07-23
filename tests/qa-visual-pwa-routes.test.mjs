import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('auth guard nao redireciona rotas operacionais para dashboard durante navegacao autenticada', () => {
  const auth = read('auth.js');

  assert.match(auth, /function isAuthLandingPath\(pathname\)/);
  assert.match(auth, /return isAuthLandingPath\(currentPathname\) \? 'admin\.html\?tab=dashboard' : null/);
  assert.doesNotMatch(auth, /if \(!requested \|\| lowerRequested === 'index\.html'/);
  assert.match(auth, /const safeExistingCurrent = sameCachedUser \? existingCurrent : \{\}/);
  assert.match(auth, /const currentCompany = sameCachedUser/);
});

test('vendas compras financeiro e notas usam botoes de aba sem submit implicito', () => {
  for (const file of ['vendas.html', 'compras.html', 'financas.html', 'notas-fiscais.html']) {
    const html = read(file);
    assert.doesNotMatch(html, /<button class="tab/);
    assert.match(html, /<button type="button" class="tab/);
  }

  const vendasJs = read('vendas.js');
  const vendasHtml = read('vendas.html');
  assert.match(vendasHtml, /\.numero-cell/);
  assert.match(vendasJs, /<span class="numero-cell">/);
  assert.match(vendasJs, /function refreshCommerceResponsiveTables\(\)/);
  assert.match(vendasJs, /window\.SiswebCommerceResponsive\.enhanceAll\(\)/);
});

test('fornecedores usa cards responsivos e camada compartilhada de comercio no mobile', () => {
  const html = read('fornecedor.html');

  assert.match(html, /commerce-responsive\.css\?v=[^"'\s]+/);
  assert.match(html, /commerce-responsive\.js\?v=[^"'\s]+/);
  assert.match(html, /<div class="table-responsive mobile-cards">/);
  assert.match(html, /@media \(max-width: 768px\)/);
  assert.match(html, /\.actions-bar,[\s\S]*\.form-row \{[\s\S]*grid-template-columns: 1fr;/);
});

test('clientes preserva pagina responsiva e modo embutido legado', () => {
  const html = read('client.html');
  const js = read('js/client.js');

  assert.match(html, /commerce-responsive\.css\?v=[^"'\s]+/);
  assert.match(html, /commerce-responsive\.js\?v=[^"'\s]+/);
  assert.match(html, /<div class="table-responsive mobile-cards">/);
  assert.match(html, /document\.documentElement\.classList\.add\('sisweb-embedded'\)/);
  assert.match(js, /data-label="Nome \/ Razão Social"/);
  assert.match(js, /notifyParentClientsUpdated/);
  assert.match(js, /escapeHtml\(item\.cnpj \|\| '-'\)/);
});

test('tipo de produto usa radios compactos e opcoes alinhadas em telas pequenas', () => {
  const css = read('commerce-responsive.css');
  const vendas = read('vendas.html');
  const compras = read('compras.html');

  [vendas, compras].forEach((html) => {
    assert.match(html, /class="product-type-selector"/);
    assert.match(html, /Produto Manual/);
    assert.match(html, /Produto Romaneio/);
    assert.match(html, /Produto Cadastrado/);
  });

  assert.match(css, /\.product-type-selector input\[type="radio"\] \{[\s\S]*width: 18px !important;[\s\S]*flex: 0 0 18px;/);
  assert.match(css, /@media \(max-width: 768px\) \{[\s\S]*\.product-type-selector \{[\s\S]*grid-template-columns: 1fr !important;/);
  assert.match(css, /\.product-type-selector label \{[\s\S]*justify-content: flex-start !important;[\s\S]*min-height: 44px;/);
});

test('vendas e compras padronizam checkboxes romaneio e carrinho no PWA', () => {
  const css = read('commerce-responsive.css');
  const vendas = read('vendas.html');
  const compras = read('compras.html');
  const vendasJs = read('vendas.js');
  const comprasJs = read('compras.js');

  [vendas, compras].forEach((html) => {
    assert.match(html, /class="form-group romaneio-actions"/);
    assert.match(html, /class="commerce-check-option romaneio-group-option"/);
    assert.match(html, /class="table-responsive mobile-cards commerce-cart-table-wrap"/);
    assert.match(html, /class="table-responsive mobile-cards commerce-orders-table-wrap"/);
    assert.match(html, /class="table-responsive mobile-cards commerce-detail-table-wrap"/);
    assert.match(html, /class="table commerce-cart-table" id="carrinhoItensTable"/);
    assert.match(html, /Carregar Itens/);
  });

  assert.match(vendas, /class="commerce-check-option rel-filter-available"/);
  assert.match(vendas, /class="commerce-check-option rel-select-all"/);
  assert.match(vendas, /class="commerce-check-option summary-print-option"/);
  assert.match(vendas, /class="table-responsive mobile-cards commerce-payment-table-wrap"/);
  assert.match(compras, /class="table-responsive mobile-cards commerce-payment-table-wrap"/);
  assert.match(vendas, /class="table-responsive mobile-cards commerce-report-table-wrap"/);
  assert.match(compras, /class="table-responsive mobile-cards commerce-report-table-wrap"/);

  assert.match(css, /input\[type="checkbox"\],[\s\S]*width: 18px !important;[\s\S]*accent-color: #0d6efd;/);
  assert.match(css, /\.romaneio-actions \{[\s\S]*display: flex;[\s\S]*align-items: flex-end;/);
  assert.match(css, /@media \(max-width: 768px\) \{[\s\S]*\.romaneio-actions \{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(css, /\.table-responsive\.mobile-cards td \{[\s\S]*display: grid !important;[\s\S]*grid-template-columns: minmax\(96px, 38%\) minmax\(0, 1fr\);/);
  assert.match(css, /\.commerce-cart-table-wrap\.mobile-cards td\[data-label="Produto"\] \{[\s\S]*grid-template-columns: 1fr;/);
  assert.match(css, /\.commerce-cart-table-wrap\.mobile-cards tr \{[\s\S]*height: auto !important;[\s\S]*overflow: hidden;/);
  assert.match(css, /\.commerce-cart-table-wrap\.mobile-cards td \{[\s\S]*padding: 10px 12px !important;[\s\S]*line-height: 1\.3 !important;/);
  assert.match(css, /\.commerce-cart-table-wrap\.mobile-cards td\[data-label="Produto"\] \{[\s\S]*display: block !important;[\s\S]*background: #f8fafc;/);
  assert.match(css, /\.commerce-cart-table-wrap\.mobile-cards td\[data-label="Ações"\] \.btn-small,[\s\S]*height: 40px !important;/);
  assert.match(css, /\.commerce-orders-table-wrap\.mobile-cards tr,[\s\S]*#listaPedidosModal \.commerce-orders-table-wrap\.mobile-cards #listaPedidosTable tr \{[\s\S]*height: auto !important;/);
  assert.match(css, /\.commerce-orders-table-wrap\.mobile-cards \.commerce-actions-wrap,[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.commerce-detail-table-wrap\.mobile-cards td\[data-label="Produto"\] \{[\s\S]*display: block !important;/);
  assert.match(css, /\.commerce-detail-table-wrap\.mobile-cards td:last-child:not\(\.commerce-full-row\),[\s\S]*\.commerce-detail-table-wrap\.mobile-cards td\[data-label="Total"\],[\s\S]*\.commerce-detail-table-wrap\.mobile-cards td\[data-label="Status"\] \{[\s\S]*width: 100% !important;[\s\S]*min-width: 100% !important;/);
  assert.match(css, /#visualizarPedidoModal \.modal-header h2 \{[\s\S]*font-size: 1\.25rem;/);
  assert.match(css, /#pedidoForm input\[type="date"\] \{[\s\S]*width: 100% !important;[\s\S]*-webkit-appearance: none;/);
  assert.match(css, /#pedidoForm \.form-row > \.form-group \{[\s\S]*width: 100% !important;[\s\S]*max-width: 100% !important;/);
  assert.match(css, /#relatorios \.form-group > button \{[\s\S]*width: 100%;[\s\S]*justify-content: center;/);
  assert.match(css, /\.commerce-payment-table-wrap\.mobile-cards input,[\s\S]*\.commerce-payment-table-wrap\.mobile-cards select,[\s\S]*width: 100% !important;/);
  assert.match(css, /\.commerce-report-table-wrap\.mobile-cards td \{[\s\S]*grid-template-columns: minmax\(104px, 40%\) minmax\(0, 1fr\) !important;/);
  assert.match(css, /\.modal-header \.close,[\s\S]*\.modal-header \.close-modal \{[\s\S]*flex: 0 0 44px;/);

  assert.match(vendasJs, /data-label="Produto"[\s\S]*data-label="Quantidade"[\s\S]*data-label="Preço Unit\."[\s\S]*data-label="Total"[\s\S]*data-label="Ações"/);
  assert.match(vendas, /<i class="fas fa-list"><\/i> Colunas/);
  assert.match(vendasJs, /pedidosFiltrados\.some\(p => getPedidoVendaId\(p\) === String\(id\)\)/);
  assert.match(vendasJs, /refreshCommerceResponsiveTables\(\);/);
  assert.match(vendasJs, /data-label="Valor"[\s\S]*id="conta-valor-\$\{safeId\}"/);
  assert.match(vendasJs, /data-col="numero" data-label="Número"/);
  assert.match(vendasJs, /const safeId = getPedidoVendaId\(pedido\)/);
  assert.match(comprasJs, /data-label="Produto"[\s\S]*data-label="Quantidade"[\s\S]*data-label="Preço Unit\."[\s\S]*data-label="Total"[\s\S]*data-label="Ações"/);
  assert.match(compras, /<i class="fas fa-list"><\/i> Colunas/);
  assert.match(comprasJs, /pedidosListFiltered\.some\(p => getPedidoCompraId\(p\) === String\(id\)\)/);
  assert.match(comprasJs, /SiswebCommerceResponsive\.enhanceAll\(\)/);
  assert.match(comprasJs, /data-label="Valor"[\s\S]*id="conta-valor-\$\{safeId\}"/);
  assert.match(comprasJs, /data-label="Grupo"[\s\S]*data-label="Preço Médio\/m³"/);
});

test('lista de pedidos usa PDF compartilhavel em PWA para vendas e compras', () => {
  const helper = read('commerce-pdf-share.js');
  const vendasHtml = read('vendas.html');
  const comprasHtml = read('compras.html');
  const vendasJs = read('vendas.js');
  const comprasJs = read('compras.js');
  const sw = read('sw.js');

  [vendasHtml, comprasHtml].forEach((html) => {
    assert.match(html, /commerce-pdf-share\.js\?v=[^"'\s]+/);
  });
  assert.match(vendasHtml, /vendas\.js\?v=[^"'\s]+/);
  assert.match(comprasHtml, /compras\.js\?v=[^"'\s]+/);

  assert.match(helper, /JSPDF_LOCAL = '\/assets\/vendor\/jspdf\.umd\.min\.js'/);
  assert.match(helper, /navigator\.canShare/);
  assert.match(helper, /navigator\.share/);
  assert.match(helper, /application\/pdf/);
  assert.match(helper, /window\.SiswebCommercePdf = \{/);
  assert.match(sw, /'\/assets\/vendor\/jspdf\.umd\.min\.js'/);

  assert.match(vendasJs, /async function exportarPedidosVendaPdf\(pedidosParaImprimir\)/);
  assert.match(vendasJs, /function isCommercePwaPrintContext\(\)/);
  assert.match(vendasJs, /await exportarPedidosVendaPdf\(pedidosParaImprimir\)/);
  assert.match(vendasJs, /await exportarPedidosVendaPdf\(\[pedido\]\)/);
  assert.doesNotMatch(vendasJs, /for \(const id of ids\)[\s\S]{0,180}await imprimirPedido\(id\)/);

  assert.match(comprasJs, /async function exportarPedidosCompraPdf\(pedidosParaImprimir\)/);
  assert.match(comprasJs, /function isCommercePwaPrintContext\(\)/);
  assert.match(comprasJs, /await exportarPedidosCompraPdf\(pedidosParaImprimir\)/);
  assert.match(comprasJs, /await exportarPedidosCompraPdf\(\[pedido\]\)/);
  assert.match(comprasJs, /window\.imprimirPedido = imprimirPedido/);
  assert.doesNotMatch(comprasJs, /for \(const id of ids\)[\s\S]{0,180}await imprimirPedido\(id\)/);
});

test('modais de lista e detalhes de pedidos usam cards mobile e acoes corretas', () => {
  const vendasHtml = read('vendas.html');
  const comprasHtml = read('compras.html');
  const css = read('commerce-responsive.css');
  const vendasJs = read('vendas.js');
  const comprasJs = read('compras.js');

  [vendasHtml, comprasHtml].forEach((html) => {
    assert.match(html, /class="table-responsive mobile-cards commerce-orders-table-wrap"/);
    assert.match(html, /class="table commerce-orders-table"/);
    assert.match(html, /class="table-responsive mobile-cards commerce-detail-table-wrap"/);
    assert.match(html, /onclick="imprimirPedido\(window\.pedidoVisualizando\)"/);
    assert.match(html, /onclick="editarPedido\(window\.pedidoVisualizando\); fecharModal\('visualizarPedidoModal'\);"/);
  });

  assert.match(css, /#listaPedidosModal \.commerce-orders-table-wrap\.mobile-cards #listaPedidosTable td \{[\s\S]*white-space: normal !important;/);
  assert.match(css, /\.commerce-orders-table-wrap\.mobile-cards \.commerce-actions-wrap,[\s\S]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.commerce-detail-table-wrap\.mobile-cards \.commerce-card-money,[\s\S]*white-space: nowrap;/);
  assert.match(css, /\.commerce-detail-table-wrap\.mobile-cards \.commerce-card-value \{[\s\S]*justify-self: end;/);
  assert.match(css, /\.commerce-detail-table-wrap\.mobile-cards td:last-child:not\(\.commerce-full-row\),[\s\S]*justify-content: initial !important;/);
  assert.match(css, /#visualizarPedidoModal \.modal-header \.close,[\s\S]*#visualizarPedidoModal \.modal-header \.close-modal,[\s\S]*flex: 0 0 44px;/);

  assert.match(vendasJs, /const pedido = window\.pedidos\.find\(p => getPedidoVendaId\(p\) === String\(pedidoId\)\)/);
  assert.match(vendasJs, /data-label="Total"><span class="commerce-card-value commerce-card-money commerce-card-strong">/);
  assert.match(vendasJs, /data-label="Valor"><span class="commerce-card-value commerce-card-money">/);
  assert.match(vendasJs, /if \(isCommercePwaPrintContext\(\) && window\.SiswebCommercePdf\) \{[\s\S]*await exportarPedidosVendaPdf\(\[pedido\]\)/);
  assert.match(comprasJs, /const pedido = window\.compras\.find\(p => String\(p\.id \|\| p\.firebaseKey\) === String\(pedidoId\)\)/);
  assert.match(comprasJs, /data-label="Total"><span class="commerce-card-value commerce-card-money commerce-card-strong">/);
  assert.match(comprasJs, /data-label="Valor"><span class="commerce-card-value commerce-card-money">/);
  assert.match(comprasJs, /if \(isCommercePwaPrintContext\(\) && window\.SiswebCommercePdf\) \{[\s\S]*await exportarPedidosCompraPdf\(\[pedido\]\)/);
});

test('modulos com overflow visual possuem correcoes mobile de largura', () => {
  const financas = read('financas.html');
  const romaneioCss = read('romaneio-comum.css');
  const profile = read('user-profile.html');
  const subscription = read('subscription-status.html');
  const notas = read('notas-fiscais.html');

  assert.match(financas, /#fluxoCaixaChart \{[\s\S]*width: 100% !important;/);
  assert.match(romaneioCss, /\.form-buttons,[\s\S]*\.buttons-container \{[\s\S]*grid-template-columns: 1fr !important;/);
  assert.match(romaneioCss, /\.pre-romaneio-group,[\s\S]*\.pre-romaneio-left \{[\s\S]*grid-template-columns: 1fr !important;/);
  assert.match(profile, /\.profile-card \{[\s\S]*max-width: 100%;[\s\S]*overflow: hidden;/);
  assert.match(subscription, /\.status-info,[\s\S]*\.module-grid \{[\s\S]*grid-template-columns: 1fr !important;/);
  assert.match(notas, /#nfForm \.form-group\[style\*="max-width"\] \{[\s\S]*max-width: none !important;/);
});

test('fallback mobile de tabelas e modais de comercio nao depende apenas do JS', () => {
  const css = read('commerce-responsive.css');

  assert.match(css, /\.modal-content > form \{[\s\S]*overflow-y: auto;/);
  assert.match(css, /\.table-responsive \{[\s\S]*overflow-x: auto;/);
  assert.match(css, /\.table-responsive\.mobile-cards \{[\s\S]*overflow: visible !important;/);
  assert.match(css, /@media \(min-width: 769px\) and \(max-width: 1024px\)/);
  assert.match(css, /\.action-buttons \{[\s\S]*align-items: stretch !important;/);
  assert.match(css, /\.summary-row \{[\s\S]*display: grid !important;[\s\S]*grid-template-columns: minmax\(0, 1fr\) auto;/);
  assert.match(css, /\.columns-item \{[\s\S]*display: grid !important;[\s\S]*grid-template-columns: 1fr;/);
});

test('service worker publica nova versao PWA para invalidar cache visual', () => {
  const sw = read('sw.js');
  const menuComponent = read('menu-component.js');

  assert.match(sw, /const APP_VERSION = '2026-07-23-firebase-bootstrap-rollout-v1'/);
  assert.match(menuComponent, /const PWA_VERSION = '2026-07-23-firebase-bootstrap-rollout-v1'/);
  assert.match(sw, /cache: 'no-store'/);
  assert.match(sw, /SISWEB_PWA_UPDATED/);
});
