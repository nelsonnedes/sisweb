import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function loadFolhaUtils() {
  const code = read('folha_pagamento/folha-utils.js');
  const listeners = {};
  const windowMock = {
    __folhaDebugMode: 'none',
    addEventListener: (event, fn) => { listeners[event] = fn; },
    dispatchEvent: () => {},
    getComputedStyle: () => ({ display: 'none', visibility: 'hidden' }),
  };
  const documentMock = {
    addEventListener: (event, fn) => { listeners[`document:${event}`] = fn; },
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { insertAdjacentHTML: () => {} },
    documentElement: { style: {} },
  };
  windowMock.document = documentMock;
  const context = {
    window: windowMock,
    document: documentMock,
    localStorage: {
      getItem: () => null,
      setItem: () => {},
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
  return context.window.FolhaUtils;
}

test('folha principal agrupa lancamentos em aberto antes dos pagos', () => {
  const FolhaUtils = loadFolhaUtils();
  FolhaUtils.lancamentoContaNoResumo = (item) => item.aberto;
  FolhaUtils.getFolhasTableSortState = () => ({ key: '', direction: 'asc' });

  const lista = [
    { id: 'pago-1', aberto: false },
    { id: 'aberto-1', aberto: true },
    { id: 'pago-2', aberto: false },
    { id: 'aberto-2', aberto: true },
  ];

  assert.deepEqual(
    FolhaUtils.aplicarOrdenacaoTabelaFolhas(lista).map((item) => item.id),
    ['aberto-1', 'aberto-2', 'pago-1', 'pago-2']
  );
});

test('ordenacao por coluna continua apenas dentro de cada grupo', () => {
  const FolhaUtils = loadFolhaUtils();
  FolhaUtils.lancamentoContaNoResumo = (item) => item.aberto;
  FolhaUtils.getFolhasTableSortState = () => ({ key: 'funcionario', direction: 'asc' });

  const lista = [
    { id: 'pago-carlos', aberto: false, funcionario: { nome: 'Carlos' } },
    { id: 'aberto-zuleica', aberto: true, funcionario: { nome: 'Zuleica' } },
    { id: 'pago-beto', aberto: false, funcionario: { nome: 'Beto' } },
    { id: 'aberto-ana', aberto: true, funcionario: { nome: 'Ana' } },
  ];

  assert.deepEqual(
    FolhaUtils.aplicarOrdenacaoTabelaFolhas(lista).map((item) => item.id),
    ['aberto-ana', 'aberto-zuleica', 'pago-beto', 'pago-carlos']
  );
});

test('fallback da tabela principal usa a ordenacao central e totais na mesma lista', () => {
  const folhaMain = read('folha_pagamento/folha-main.js');

  assert.match(folhaMain, /const folhasOrdenadas = \(window\.FolhaUtils && typeof window\.FolhaUtils\.aplicarOrdenacaoTabelaFolhas === 'function'\)/);
  assert.match(folhaMain, /window\.FolhaUtils\.aplicarOrdenacaoTabelaFolhas\(folhasFiltradas\)/);
  assert.match(folhaMain, /folhasOrdenadas\.map\(folha =>/);
  assert.match(folhaMain, /this\.atualizarTotais\(folhasOrdenadas\)/);
});

test('modais operacionais de folha possuem labels para cards mobile', () => {
  const funcionarios = read('folha_pagamento/folha-funcionarios.js');
  const cargos = read('folha_pagamento/folha-cargos.js');
  const lancamentos = read('folha_pagamento/folha-lancamentos.js');

  ['Nome', 'CPF', 'Cargo', 'Forma Pgto.', 'Salário', 'Status', 'Ações'].forEach((label) => {
    assert.match(funcionarios, new RegExp(`data-label="${label}"`));
  });
  ['Nome', 'Salário Base', 'Periculosidade', 'Adicional Noturno', 'Total', 'Ações'].forEach((label) => {
    assert.match(cargos, new RegExp(`data-label="${label}"`));
  });
  ['Funcionário', 'Mês/Ano', 'Tipo', 'Percentual', 'Salário Base', '1ª Quinzena', 'Detalhes', 'Líquido', 'Ações'].forEach((label) => {
    assert.match(lancamentos, new RegExp(`data-label="${label}"`));
  });

  assert.match(funcionarios, /applyMobileTableLabels\(document\.getElementById\('funcionariosListModal'\)\)/);
  assert.match(cargos, /applyMobileTableLabels\(document\.getElementById\('cargosListModal'\)\)/);
  assert.match(lancamentos, /applyMobileTableLabels\(document\.getElementById\('folhasFechadasModal'\)\)/);
});

test('CSS final transforma modais em cards e preserva QR legivel no PWA', () => {
  const folhaCss = read('folha_pagamento/folha.css');
  const folhaHtml = read('folha_pagamento/folha.html');
  const utils = read('folha_pagamento/folha-utils.js');

  assert.match(utils, /static applyMobileTableLabels\(root = document\)/);
  assert.match(utils, /FolhaUtils\.applyMobileTableLabels\(table\)/);

  assert.match(folhaHtml, /class="pix-qrcode-layout"/);
  assert.match(folhaHtml, /class="pix-qrcode-preview"/);
  assert.match(folhaHtml, /class="pix-qrcode-info"/);
  const qrModalMarkup = folhaHtml.slice(
    folhaHtml.indexOf('<div id="pixQrCodeModal"'),
    folhaHtml.indexOf('<!-- Modal de Cargo -->')
  );
  assert.doesNotMatch(qrModalMarkup, /class="close-button"/);
  assert.match(qrModalMarkup, /class="back-button close-modal-btn" onclick="FolhaUtils\.closePixQrCodeModal\(\)"/);

  assert.match(folhaCss, /PWA: override final para modais de Folha em formato de cards no mobile/);
  assert.match(folhaCss, /@media screen and \(max-width: 700px\) \{[\s\S]*#funcionariosListModal \.funcionarios-list-table/);
  assert.match(folhaCss, /#cargosListModal table tbody td,[\s\S]*display: grid !important/);
  assert.match(folhaCss, /#folhasFechadasModal \.folhas-fechadas-table tbody td \{[\s\S]*grid-template-columns: minmax\(96px, 38%\) minmax\(0, 1fr\) !important/);
  assert.match(folhaCss, /#folhasFechadasModal \.folhas-fechadas-table tbody td:nth-child\(n\) \{[\s\S]*min-width: 0 !important/);
  assert.match(folhaCss, /#folhasFechadasModal \.folhas-fechadas-table td\.actions-cell \{[\s\S]*position: static !important/);
  assert.match(folhaCss, /@media screen and \(max-width: 640px\) \{[\s\S]*#pixQrCodeModal \.pix-qrcode-layout \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(folhaCss, /#pixQrCodeModal \.pix-qrcode-chave-row \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 32px !important/);
  assert.match(folhaCss, /#pixQrCodeModal \.pix-qrcode-edit-button \{[\s\S]*min-width: 32px !important/);
  assert.match(folhaCss, /#pixQrCodeModal \.pix-qrcode-container \{[\s\S]*aspect-ratio: 1 \/ 1 !important/);
  assert.match(folhaCss, /#pixQrCodeModal \.modal-footer \{[\s\S]*justify-content: center/);
  assert.match(folhaCss, /#pixQrCodeModal \.modal-footer \.footer-secondary \{[\s\S]*justify-content: center/);
  assert.match(folhaCss, /#pixQrCodeModal \.modal-footer \.close-modal-btn \{[\s\S]*justify-content: center/);
  assert.match(folhaCss, /#pixQrCodeModal \.modal-footer \.close-modal-btn \{[\s\S]*width: min\(100%, 180px\) !important/);
  assert.match(folhaCss, /#pixQrCodeModal \.modal-header \{[\s\S]*justify-content: center/);
  assert.match(folhaCss, /#pixQrCodeModal \.modal-title \{[\s\S]*text-align: center/);
  assert.match(utils, /const qrSize = Math\.max\(200, Math\.min\(240, Math\.floor\(viewportWidth \* 0\.64\)\)\)/);
});
