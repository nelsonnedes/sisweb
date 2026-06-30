import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add: (...items) => items.forEach((item) => classes.add(item)),
    remove: (...items) => items.forEach((item) => classes.delete(item)),
    toggle: (item, force) => {
      const shouldHave = force === undefined ? !classes.has(item) : Boolean(force);
      if (shouldHave) classes.add(item);
      else classes.delete(item);
      return shouldHave;
    },
    contains: (item) => classes.has(item),
    toArray: () => [...classes],
  };
}

function createElement({ hidden = false, attrs = {}, classes = [] } = {}) {
  return {
    hidden,
    attrs: { ...attrs },
    dataset: {},
    listeners: {},
    textContent: '',
    classList: createClassList(classes),
    children: {},
    addEventListener(event, fn) {
      this.listeners[event] = fn;
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    getAttribute(name) {
      return this.attrs[name] ?? null;
    },
    querySelector(selector) {
      return this.children[selector] || null;
    },
  };
}

function loadFolhaUtilsWithAcoesDom() {
  const code = read('folha_pagamento/folha-utils.js');
  const storageWrites = [];
  const section = createElement({ classes: ['acoes-recolhidas'] });
  const content = createElement({ hidden: true });
  const toggle = createElement({
    attrs: {
      'aria-expanded': 'false',
      'aria-controls': 'acoesPrincipaisConteudo',
    },
  });
  const text = createElement();
  const icon = createElement({ classes: ['fas', 'fa-chevron-down', 'acoes-toggle-icon'] });
  text.textContent = 'Expandir ações';
  toggle.children['.acoes-toggle-text'] = text;
  toggle.children['.acoes-toggle-icon'] = icon;

  const elements = {
    'acoes-principais': section,
    acoesPrincipaisConteudo: content,
    toggleAcoesPrincipais: toggle,
  };
  const listeners = {};
  const documentMock = {
    addEventListener: (event, fn) => { listeners[`document:${event}`] = fn; },
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { insertAdjacentHTML: () => {} },
    documentElement: { style: {} },
  };
  const windowMock = {
    __folhaDebugMode: 'none',
    document: documentMock,
    addEventListener: (event, fn) => { listeners[event] = fn; },
    dispatchEvent: () => {},
    getComputedStyle: () => ({ display: 'none', visibility: 'hidden' }),
  };

  const context = {
    window: windowMock,
    document: documentMock,
    localStorage: {
      getItem: () => null,
      setItem: (key, value) => storageWrites.push([key, value]),
    },
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    setTimeout: () => {},
    clearTimeout: () => {},
    CustomEvent: function CustomEvent(type, init) { return { type, ...init }; },
  };

  vm.runInNewContext(code, context, { filename: 'folha-utils.js' });
  return {
    FolhaUtils: context.window.FolhaUtils,
    elements,
    section,
    content,
    toggle,
    text,
    icon,
    storageWrites,
  };
}

function loadFolhaFiltrosFallback(FolhaUtils = {}) {
  const code = read('folha_pagamento/folha-filtros.js');
  const context = {
    window: {
      FolhaUtils,
      folhaSystem: { funcionarios: [] },
      folhaFuncionarios: { funcionarios: [] },
      __folhaDebug: false,
    },
    document: {
      addEventListener: () => {},
      getElementById: () => null,
    },
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    module: { exports: {} },
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    setTimeout: () => {},
    CustomEvent: function CustomEvent(type, init) { return { type, ...init }; },
  };

  vm.runInNewContext(code, context, { filename: 'folha-filtros.js' });
  const filtros = Object.create(context.module.exports.FolhaFiltros.prototype);
  filtros.formatMesAno = (value) => value || 'N/A';
  filtros.getTipoColor = () => '#28a745';
  filtros.getPercentualDisplay = () => '100%';
  filtros.renderizarBotoesAcaoFallback = () => '<button class="action-button clonar-folha-button">Clonar</button>';
  return filtros;
}

test('acoes principais load collapsed in HTML before JavaScript runs', () => {
  const folhaHtml = read('folha_pagamento/folha.html');
  const folhaCss = read('folha_pagamento/folha.css');

  assert.match(folhaHtml, /<section id="acoes-principais" class="acoes-recolhidas">/);
  assert.match(folhaHtml, /id="toggleAcoesPrincipais"/);
  assert.match(folhaHtml, /aria-expanded="false"/);
  assert.match(folhaHtml, /aria-controls="acoesPrincipaisConteudo"/);
  assert.match(folhaHtml, /id="acoesPrincipaisConteudo" class="form-buttons" hidden/);
  assert.match(folhaHtml, /<span class="acoes-toggle-text">Expandir ações<\/span>/);
  assert.match(folhaCss, /#acoesPrincipaisConteudo\[hidden\]\s*\{\s*display:\s*none !important;/);
});

test('acoes principais toggle expands and collapses without localStorage persistence', () => {
  const {
    FolhaUtils,
    section,
    content,
    toggle,
    text,
    icon,
    storageWrites,
  } = loadFolhaUtilsWithAcoesDom();

  assert.equal(FolhaUtils.setupAcoesPrincipaisToggle(), true);
  assert.equal(content.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(text.textContent, 'Expandir ações');
  assert.equal(section.classList.contains('acoes-recolhidas'), true);

  assert.equal(typeof toggle.listeners.click, 'function');
  toggle.listeners.click();

  assert.equal(content.hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(text.textContent, 'Recolher ações');
  assert.equal(section.classList.contains('acoes-expandidas'), true);
  assert.equal(icon.classList.contains('fa-chevron-up'), true);

  toggle.listeners.click();

  assert.equal(content.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(text.textContent, 'Expandir ações');
  assert.equal(section.classList.contains('acoes-recolhidas'), true);
  assert.equal(icon.classList.contains('fa-chevron-down'), true);
  assert.deepEqual(storageWrites, []);
});

test('acoes de lancamento mes fechado pago render collapsed and keep other rows unchanged', () => {
  const {
    FolhaUtils,
    elements,
    storageWrites,
  } = loadFolhaUtilsWithAcoesDom();

  const paidHtml = FolhaUtils.renderizarAcoesLancamento({
    id: 'folha-fabio-2026-05',
    tipo: 'mes',
    status: 'mes_fechado',
  }, '', {
    tipoPagamento: 'mes',
    statusNorm: 'mes_fechado',
  });

  assert.match(paidHtml, /class="paid-actions-collapse"/);
  assert.match(paidHtml, /aria-expanded="false"/);
  assert.match(paidHtml, /class="paid-actions-panel" hidden/);
  assert.match(paidHtml, />Ações<\/span>/);
  assert.match(paidHtml, /__onEditFolhaButtonClick\(this\.dataset\.folhaId\)/);
  assert.match(paidHtml, /printFolha\(this\.dataset\.folhaId\)/);
  assert.match(paidHtml, /deleteFolha\(this\.dataset\.folhaId\)/);

  const quinzenaHtml = FolhaUtils.renderizarAcoesLancamento({
    id: 'folha-fabio-quinzena',
    tipo: 'quinzena',
    status: 'mes_fechado',
  }, '', {
    tipoPagamento: 'quinzena',
    statusNorm: 'mes_fechado',
  });

  assert.doesNotMatch(quinzenaHtml, /paid-actions-collapse/);
  assert.match(quinzenaHtml, /class="action-button btn-editar edit-button"/);

  const panel = createElement({ hidden: true });
  const toggle = createElement({
    attrs: {
      'aria-controls': 'acoesPagamento_folha-fabio-2026-05',
      'aria-expanded': 'false',
    },
  });
  const text = createElement();
  const icon = createElement({ classes: ['fas', 'fa-chevron-down', 'paid-actions-toggle-icon'] });
  text.textContent = 'Ações';
  toggle.children['.paid-actions-toggle-text'] = text;
  toggle.children['.paid-actions-toggle-icon'] = icon;
  elements['acoesPagamento_folha-fabio-2026-05'] = panel;

  assert.equal(FolhaUtils.toggleAcoesLancamentoPago(toggle), true);
  assert.equal(panel.hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(text.textContent, 'Recolher');
  assert.equal(icon.classList.contains('fa-chevron-up'), true);

  assert.equal(FolhaUtils.toggleAcoesLancamentoPago(toggle), true);
  assert.equal(panel.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(text.textContent, 'Ações');
  assert.equal(icon.classList.contains('fa-chevron-down'), true);
  assert.deepEqual(storageWrites, []);
});

test('coluna acoes da tabela principal fica sticky a direita', () => {
  const folhaHtml = read('folha_pagamento/folha.html');
  const folhaCss = read('folha_pagamento/folha.css');

  assert.match(folhaHtml, /<th data-sort-key="acoes"><i class="fas fa-cogs"><\/i> Ações<\/th>/);
  assert.match(folhaCss, /#folhasTable\s*\{[\s\S]*overflow:\s*visible;/);
  assert.match(folhaCss, /#folhasTable \.actions-cell\s*\{[\s\S]*position:\s*sticky;[\s\S]*right:\s*0;[\s\S]*z-index:\s*12;/);
  assert.match(folhaCss, /#folhasTable th\[data-sort-key="acoes"\]\s*\{[\s\S]*position:\s*sticky;[\s\S]*right:\s*0;[\s\S]*z-index:\s*16;/);
  assert.match(folhaCss, /#folhasTable tbody tr:hover td\.actions-cell\s*\{[\s\S]*background:\s*#f8f9fa;/);
  assert.match(folhaCss, /#folhasTable tbody tr\.folha-fechada td\.actions-cell\s*\{[\s\S]*background:\s*#f8f9fa;/);
  assert.match(folhaCss, /@media print\s*\{[\s\S]*#folhasTable th\[data-sort-key="acoes"\],[\s\S]*#folhasTable td\.actions-cell\s*\{[\s\S]*position:\s*static !important;/);
});

test('fallback de filtros preserva 12 colunas e acoes pagas recolhidas', () => {
  let renderAcoesOptions = null;
  const filtros = loadFolhaFiltrosFallback({
    normalizarStatus: () => 'mes_fechado',
    resolveTipoPagamento: () => 'mes',
    calcularDescontosDisplay: () => 30,
    calcularTotalVales: () => 70,
    calcularSalarioLiquidoDisplay: () => 900,
    calcularAcrescimosDisplay: () => 0,
    calcularValorQuinzena: () => 0,
    getSalarioBaseDisplay: () => 1000,
    formatarMoeda: (value) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`,
    formatarFormaPagamentoLancamento: () => '<span data-pagamento="pix">Ver Qrcode</span>',
    isLancamentoMesFechadoPago: () => true,
    renderizarAcoesLancamento: (_lancamento, botoes, opcoes) => {
      renderAcoesOptions = opcoes;
      assert.match(botoes, /__onEditFolhaButtonClick/);
      assert.match(botoes, /deleteFolha/);
      return '<div class="paid-actions-collapse">Ações</div>';
    },
  });

  const html = filtros.renderTableRow({
    id: 'folha-fallback-1',
    mesAno: '2026-05',
    tipoPagamento: 'mes',
    status: 'mes_fechado',
    funcionario: {
      id: 'func-1',
      nome: 'Fabio Da Silva',
      cargo: 'Operador',
      formaPagamento: 'PIX',
      pix: '64704424200',
      pixTipo: 'cpf',
    },
    calculos: { salarioBase: 1000 },
  });

  assert.equal((html.match(/<td\b/g) || []).length, 12);
  assert.match(html, /<td style="font-size: 12px;"><span data-pagamento="pix">Ver Qrcode<\/span><\/td>/);
  assert.match(html, /class="folha-row folha-fechada"/);
  assert.match(html, /class="actions-cell paid-actions-cell"/);
  assert.match(html, /paid-actions-collapse/);
  assert.equal(renderAcoesOptions.tipoPagamento, 'mes');
  assert.equal(renderAcoesOptions.statusNorm, 'mes_fechado');
});
