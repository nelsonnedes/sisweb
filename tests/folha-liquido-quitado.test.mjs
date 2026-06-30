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

test('liquido quitado separa valor historico, valor pago e saldo em aberto', () => {
  const FolhaUtils = loadFolhaUtils();
  const lancamentoPago = {
    id: 'folha-paga-1',
    tipoPagamento: 'mes',
    status: 'mes_fechado',
    salarioLiquido: 1234.56,
    funcionario: { id: 'func-1', nome: 'Funcionario Pago', salarioBase: 2000 },
  };
  const lancamentoAberto = {
    id: 'folha-aberta-1',
    tipoPagamento: 'mes',
    status: 'calculada',
    salarioLiquido: 987.65,
    funcionario: { id: 'func-2', nome: 'Funcionario Aberto', salarioBase: 1500 },
  };

  assert.equal(FolhaUtils.calcularSalarioLiquidoDisplay(lancamentoPago), 1234.56);
  assert.equal(FolhaUtils.calcularSaldoLiquidoEmAberto(lancamentoPago), 0);
  assert.equal(FolhaUtils.calcularValorPagoLancamento(lancamentoPago), 1234.56);
  assert.equal(FolhaUtils.calcularSaldoLiquidoEmAberto(lancamentoAberto), 987.65);
  assert.equal(FolhaUtils.calcularValorPagoLancamento(lancamentoAberto), 0);
});

test('tabela mostra saldo zerado sem esconder valor pago', () => {
  const FolhaUtils = loadFolhaUtils();
  const lancamentoPago = {
    id: 'folha-paga-2',
    tipoPagamento: 'mes',
    status: 'mes_fechado',
    salarioLiquido: 1000,
    mesAno: '2026-05',
    funcionario: {
      id: 'func-3',
      nome: 'Funcionario Pago',
      cargo: 'Operador',
      formaPagamento: 'DINHEIRO',
      salarioBase: 1000,
    },
    calculos: { salarioBase: 1000 },
  };

  const cellHtml = FolhaUtils.formatarLiquidoLancamentoTabela(lancamentoPago);
  assert.match(cellHtml, /liquido-saldo-zerado/);
  assert.match(cellHtml, /R\$\s*0,00/);
  assert.match(cellHtml, /Pago: R\$\s*1\.000,00/);

  const rowHtml = FolhaUtils.renderizarLinhaLancamento(lancamentoPago);
  assert.match(rowHtml, /class="valor-destaque liquido-cell"/);
  assert.match(rowHtml, /R\$\s*0,00/);
  assert.match(rowHtml, /Pago: R\$\s*1\.000,00/);
  assert.match(rowHtml, /paid-actions-collapse/);
});

test('valor pago quitado representa total recebido pelo funcionario', () => {
  const FolhaUtils = loadFolhaUtils();
  const lancamentoPago = {
    id: 'folha-paga-total',
    tipoPagamento: 'mes',
    status: 'mes_fechado',
    salarioLiquido: 1000,
    vales: 250,
    quinzenaValorManual: 500,
    funcionario: { id: 'func-4', nome: 'Funcionario Total', salarioBase: 2500 },
  };

  assert.equal(FolhaUtils.calcularSaldoLiquidoEmAberto(lancamentoPago), 0);
  assert.equal(FolhaUtils.calcularValorPagoLancamento(lancamentoPago), 1750);

  const cellHtml = FolhaUtils.formatarLiquidoLancamentoTabela(lancamentoPago);
  assert.match(cellHtml, /R\$\s*0,00/);
  assert.match(cellHtml, /Pago: R\$\s*1\.750,00/);
});

test('quinzena paga mostra valor pago da quinzena e mantem saldo final em aberto', () => {
  const FolhaUtils = loadFolhaUtils();
  const lancamentoQuinzenaPaga = {
    id: 'folha-quinzena-paga',
    tipoPagamento: 'quinzena',
    tipo: 'quinzena',
    status: 'quinzena_paga',
    salarioLiquido: 1200,
    quinzenaValorManual: 800,
    funcionario: { id: 'func-5', nome: 'Funcionario Quinzena', salarioBase: 2000 },
  };
  const lancamentoQuinzenaPagaTexto = {
    ...lancamentoQuinzenaPaga,
    status: 'Quinzena Paga',
  };

  assert.equal(FolhaUtils.lancamentoContaNoResumo(lancamentoQuinzenaPaga), true);
  assert.equal(FolhaUtils.calcularSaldoLiquidoEmAberto(lancamentoQuinzenaPaga), 1200);
  assert.equal(FolhaUtils.calcularValorPagoLancamento(lancamentoQuinzenaPaga), 800);
  assert.equal(FolhaUtils.calcularValorPagoLancamento(lancamentoQuinzenaPagaTexto), 800);
  assert.equal(FolhaUtils.calcularValorPixLancamento(lancamentoQuinzenaPaga), 1200);
  assert.equal(FolhaUtils.isPixLancamentoQuitado(lancamentoQuinzenaPaga), false);

  const cellHtml = FolhaUtils.formatarLiquidoLancamentoTabela(lancamentoQuinzenaPaga);
  assert.match(cellHtml, /R\$\s*1\.200,00/);
  assert.match(cellHtml, /Pago: R\$\s*800,00/);
});

test('recibos e resumo preservam valor pago como historico', () => {
  const folhaRelatorios = read('folha_pagamento/folha-relatorios.js');
  const folhaUtils = read('folha_pagamento/folha-utils.js');
  const folhaMain = read('folha_pagamento/folha-main.js');
  const folhaFiltros = read('folha_pagamento/folha-filtros.js');

  assert.match(folhaRelatorios, /const valorPagoLancamentoNum = window\.FolhaUtils && typeof window\.FolhaUtils\.calcularValorPagoLancamento === 'function'/);
  assert.match(folhaRelatorios, /const quinzenaAberta = isQuinzena && !quinzenaJaBaixada && !quinzenaMesFechado/);
  assert.match(folhaRelatorios, /const quinzenaComoDesconto = valorQuinzenaReciboNum > 0 && \(!isQuinzena \|\| quinzenaJaBaixada \|\| quinzenaMesFechado\)/);
  assert.match(folhaRelatorios, /const valorFinalLabel = lancamentoQuitado \? 'Valor Pago' : 'Valor a Receber'/);
  assert.match(folhaRelatorios, /const valorFinalNum = lancamentoQuitado \? valorPagoLancamentoNum : valorReceberReciboNum/);
  assert.match(folhaRelatorios, /\{ key: 'valorPago', label: 'Valor Pago' \}/);
  assert.match(folhaRelatorios, /\{ key: 'saldoAberto', label: 'Saldo em Aberto' \}/);
  assert.match(folhaRelatorios, /const totalPagos = selecionados\.reduce\(\(sum, r\) => sum \+ \(Number\(r\.valorPago\)\|\|0\), 0\)/);
  assert.match(folhaRelatorios, /const totalRestantes = selecionados\.reduce\(\(sum, r\) => sum \+ \(Number\(r\.saldoAberto\)\|\|0\), 0\)/);
  assert.match(folhaUtils, /static calcularValorPagoLancamento\(lancamento\)/);
  assert.match(folhaUtils, /static calcularSaldoLiquidoEmAberto\(lancamento\)/);
  assert.match(folhaUtils, /static calcularValorPixLancamento\(lancamento\)/);
  assert.match(folhaMain, /const totalPagos = folhasDedupe\.reduce/);
  assert.match(folhaFiltros, /totais\.pagos = \(this\.dadosFiltrados \|\| \[\]\)\.reduce/);
  assert.match(folhaMain, /formatarLiquidoLancamentoTabela\(folha/);
  assert.match(folhaFiltros, /formatarLiquidoLancamentoTabela\(lancamento/);
});
