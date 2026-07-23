import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('estoque carrega helper compartilhado e scripts cache-bustados para impressao PWA', () => {
  const html = read('estoque.html');

  assert.match(html, /commerce-pdf-share\.js\?v=[^"'\s]+/);
  assert.match(html, /estoque_produtos\.js\?v=[^"'\s]+/);
  assert.match(html, /estoque\.js\?v=[^"'\s]+/);
  assert.match(html, /import \* as fbService from '\.\/firebaseService\.js\?v=[^"'\s]+'/);
});

test('estoque e financas evitam cards/filtros quebrados no PWA mobile', () => {
  const estoqueHtml = read('estoque.html');
  const estoqueJs = read('estoque.js');
  const financasHtml = read('financas.html');

  assert.match(estoqueHtml, /\.table-responsive\.mobile-cards \.table-wide-estoque,[\s\S]*min-width: 0;[\s\S]*width: 100%;/);
  assert.match(estoqueHtml, /class="manual-saida-grid" style="display:flex; gap:8px; flex-wrap:nowrap; align-items:flex-end; min-width:1780px;"/);
  assert.match(estoqueHtml, /class="filtro-toras-modal-grid" style="display:flex; gap:8px; flex-wrap:nowrap; align-items:center; min-width:1090px;"/);
  assert.match(estoqueHtml, /\.manual-saida-grid,[\s\S]*\.filtro-toras-modal-grid \{[\s\S]*min-width: 0 !important;[\s\S]*flex-wrap: wrap !important;/);

  for (const label of ['Selecionar', 'Plaqueta', 'Custódia', 'Espécie', 'Volume Líquido', 'Volume Geo.', 'Ações']) {
    assert.match(estoqueJs, new RegExp(`data-label="${label.replace('.', '\\.')}"`));
  }
  assert.doesNotMatch(estoqueJs, /<td data-col="plaqueta">/);

  assert.match(financasHtml, /\.filters-row\{ display:flex; flex-wrap:wrap; gap:8px; align-items:flex-end; width:100%; \}/);
  assert.match(financasHtml, /@media \(max-width: 768px\)\{[\s\S]*\.filters-row\{ display:grid; grid-template-columns:1fr; gap:12px; \}/);
  assert.doesNotMatch(financasHtml, /\.filters-row\{ display:flex; flex-wrap:nowrap;/);
});

test('botoes de impressao do estoque separam PWA PDF de desktop HTML', () => {
  const js = read('estoque.js');

  assert.match(js, /function isEstoquePwaPrintContext\(\)/);
  assert.match(js, /display-mode: minimal-ui/);
  assert.match(js, /window\.matchMedia\('\(pointer: coarse\)'\)\.matches[\s\S]*window\.innerWidth <= 768/);
  assert.doesNotMatch(js, /return window\.innerWidth <= 768/);

  assert.match(js, /async function exportarTabelaEstoquePdf\(options = \{\}\)[\s\S]*helper\.exportTableReportPdf/);
  assert.match(js, /async function entregarRelatorioEstoque\(options = \{\}\)[\s\S]*if \(isEstoquePwaPrintContext\(\)\)[\s\S]*await exportarTabelaEstoquePdf\(pdfOptions\)/);
  assert.match(js, /function imprimirHtmlEstoque\(htmlCompleto, windowFeatures = 'width=1100,height=800'\)[\s\S]*helper\.printHtmlDocument/);
  assert.match(js, /async function imprimirDoIframe\(\)[\s\S]*if \(isEstoquePwaPrintContext\(\) && payload\.pdfOptions\)[\s\S]*await exportarTabelaEstoquePdf\(payload\.pdfOptions\)/);

  assert.match(js, /async function imprimirConsultaEstoque\(\)[\s\S]*await entregarRelatorioEstoque\(\{[\s\S]*title: 'Consulta de Estoque'/);
  assert.match(js, /async function imprimirEstoqueProdutos\(\)[\s\S]*await entregarRelatorioEstoque\(\{[\s\S]*title: 'Estoque de Almoxarifado'/);
  assert.match(js, /async function imprimirMovimentacoesEstoque\(\)[\s\S]*await entregarRelatorioEstoque\(\{[\s\S]*title: 'Histórico de Movimentações'/);
  assert.match(js, /async function imprimirRelatorioEstoque\(\)[\s\S]*const pdfData = extrairTabelasRelatorioEstoquePdf/);
  assert.match(js, /async function imprimirRastreabilidadeEstoque\(\)[\s\S]*await entregarRelatorioEstoque\(\{[\s\S]*title: 'Rastreabilidade de Toras'/);

  assert.match(js, /return await prepararLogoEmpresaRelatorio\(\{ \.\.\.centralData/);
  assert.match(js, /return await prepararLogoEmpresaRelatorio\(empresaFinal\)/);
  const logoPreparationFn = js.slice(js.indexOf('async function prepararLogoEmpresaRelatorio'), js.indexOf('function obterLogoEmpresaSrc'));
  assert.match(logoPreparationFn, /getStorageDownloadURL/);
  assert.match(logoPreparationFn, /resolveCompanyLogoDataUrl/);
  const logoHtmlFn = js.slice(js.indexOf('function obterLogoEmpresaSrc'), js.indexOf('function montarRelatorioHtml'));
  assert.doesNotMatch(logoHtmlFn, /logoStoragePath|logoPath/);
  assert.doesNotMatch(logoHtmlFn, /getStorageDataURL|resolveCompanyLogoDataUrl/);
  assert.match(logoHtmlFn, /return '';/);
});

test('estoque resolve logo multitenant antes de montar cabecalho HTML', async () => {
  const js = read('estoque.js');
  const start = js.indexOf('function normalizarLogoStoragePathEstoque');
  const end = js.indexOf('function montarRelatorioHtml');
  assert.ok(start > -1);
  assert.ok(end > start);

  const storagePath = 'companies/tenant-a/profile/logo/logo.png';
  const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/sisweb-7ce82.firebasestorage.app/o/${encodeURIComponent(storagePath)}?alt=media&token=abc`;
  const logoDataUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const calls = [];
  const context = {
    window: {
      location: { origin: 'https://sisweb-7ce82.web.app' },
      firebaseService: {
        async getStorageDownloadURL(path) {
          calls.push({ type: 'getStorageDownloadURL', path });
          return downloadUrl;
        },
      },
      SiswebCommercePdf: {
        async resolveCompanyLogoDataUrl(company) {
          calls.push({ type: 'resolveCompanyLogoDataUrl', path: company.logoStoragePath || company.logoPath });
          return logoDataUrl;
        },
      },
    },
    console: { warn() {} },
    URL,
    decodeURIComponent,
  };

  vm.runInNewContext(`${js.slice(start, end)}
    window.__estoqueLogoTest = {
      normalizarLogoStoragePathEstoque,
      prepararLogoEmpresaRelatorio,
      obterLogoEmpresaSrc
    };
  `, context);

  const api = context.window.__estoqueLogoTest;
  assert.equal(api.obterLogoEmpresaSrc({ logo: storagePath }), '');
  assert.equal(api.normalizarLogoStoragePathEstoque(downloadUrl), storagePath);

  const prepared = await api.prepararLogoEmpresaRelatorio({
    name: 'Empresa Teste',
    logoStoragePath: storagePath,
  });
  assert.equal(prepared.logoUrl, downloadUrl);
  assert.equal(prepared.logoStoragePath, storagePath);
  assert.equal(api.obterLogoEmpresaSrc(prepared), downloadUrl);
  assert.ok(calls.some((call) => call.type === 'getStorageDownloadURL' && call.path === storagePath));
  assert.ok(!calls.some((call) => call.type === 'resolveCompanyLogoDataUrl'));

  calls.length = 0;
  context.window.firebaseService.getStorageDownloadURL = async (path) => {
    calls.push({ type: 'getStorageDownloadURL', path });
    throw new Error('URL indisponivel');
  };
  const fallback = await api.prepararLogoEmpresaRelatorio({
    name: 'Empresa Teste',
    logo: storagePath,
  });
  assert.equal(fallback.logoDataUrl, logoDataUrl);
  assert.equal(api.obterLogoEmpresaSrc(fallback), logoDataUrl);
  assert.ok(calls.some((call) => call.type === 'resolveCompanyLogoDataUrl' && call.path === storagePath));
});

test('helper compartilhado exporta PDF tabular para relatorios do estoque', async () => {
  const helper = read('commerce-pdf-share.js');
  const calls = [];

  class FakeDoc {
    constructor(options) {
      this.options = options;
      this.pages = 1;
      calls.push({ type: 'ctor', options });
      this.internal = {
        pageSize: {
          getWidth: () => (options.orientation === 'landscape' ? 297 : 210),
          getHeight: () => (options.orientation === 'landscape' ? 210 : 297),
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
    URL,
    decodeURIComponent,
  };

  vm.runInNewContext(helper, context);
  assert.equal(typeof context.window.SiswebCommercePdf.createTableReportPdf, 'function');
  assert.equal(typeof context.window.SiswebCommercePdf.exportTableReportPdf, 'function');

  const result = await context.window.SiswebCommercePdf.createTableReportPdf({
    company: {
      name: 'Empresa Teste',
      logoStoragePath: 'companies/tenant-a/profile/logo/logo.png',
    },
    title: 'Consulta de Estoque',
    badgeText: 'Estoque',
    summaryRows: [['Total de Toras', '2']],
    columns: [
      { label: 'Plaqueta' },
      { label: 'Volume', align: 'right' },
    ],
    rows: [
      ['T-001', '1,250 m³'],
      ['T-002', '<strong>2,500 m³</strong>'],
    ],
  });

  assert.equal(result, 'PDF');
  assert.ok(calls.some((call) => call.type === 'ctor' && call.options.orientation === 'landscape'));
  assert.ok(calls.some((call) => call.type === 'getStorageDataURL' && call.path === 'companies/tenant-a/profile/logo/logo.png'));
  assert.ok(calls.some((call) => call.type === 'addImage' && call.args[0] === logoDataUrl));
  assert.ok(calls.some((call) => call.type === 'text' && JSON.stringify(call.args).includes('Consulta de Estoque')));
  assert.ok(calls.some((call) => call.type === 'text' && JSON.stringify(call.args).includes('Total de Toras')));
  assert.ok(calls.some((call) => call.type === 'text' && JSON.stringify(call.args).includes('T-002')));
  assert.ok(!calls.some((call) => call.type === 'text' && JSON.stringify(call.args).includes('<strong>')));
});
