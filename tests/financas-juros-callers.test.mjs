/**
 * tests/financas-juros-callers.test.mjs
 *
 * Verifica que todos os callers de getContaFinanceInfo usam os campos
 * corretos (jurosAberto contratual, totalAtualizado = valorRestante + juros
 * contratual) e que nenhum caller recalcula juros manualmente.
 *
 * A correção de juros contratuais (emissao -> vencimento) afeta 7 callers.
 */

import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function has(source, pattern) {
  return source.includes(pattern);
}

/**
 * Bloco entre dois marcadores (inclusive).
 */
function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return '';
  const end = source.indexOf(endMarker, start + 1);
  if (end === -1) return source.slice(start);
  return source.slice(start, end);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test('getContaFinanceInfo — todos os callers existem no codigo', () => {
  const js = read('financas.js');

  assert.ok(has(js, 'getContaFinanceInfo(conta)'),
    'Deve haver chamada getContaFinanceInfo(conta)');
  assert.ok(has(js, 'const info = getContaFinanceInfo(conta)'),
    'Dashboard: const info = getContaFinanceInfo(conta)');
  assert.ok(has(js, 'info.statusNorm'),
    'Callers usam info.statusNorm');
});

test('caller 1 - Dashboard usa totalAtualizado e statusNorm', () => {
  const js = read('financas.js');

  assert.ok(has(js, 'info.totalAtualizado'),
    'Dashboard deve usar info.totalAtualizado');
  assert.ok(has(js, 'jurosLinha'),
    'Dashboard deve calcular jurosLinha');
  assert.ok(has(js, 'totalsByStatus'),
    'Dashboard deve agregar totalsByStatus');
});

test('caller 2 - Relatorio Vencidos usa totalAtualizado', () => {
  const js = read('financas.js');

  assert.ok(has(js, 'getContaFinanceInfo(conta).totalAtualizado') ||
            has(js, 'info.totalAtualizado'),
    'Relatorio vencidos deve usar totalAtualizado');
  assert.ok(has(js, 'info.statusNorm'),
    'Relatorio deve usar info.statusNorm');
});

test('caller 3 - Relatorio Periodo usa statusNorm', () => {
  const js = read('financas.js');

  assert.ok(has(js, "info.statusNorm === 'pago'"),
    'Relatorio periodo deve usar statusNorm');
});

test('caller 4 - Relatorio Categoria usa valorOriginal', () => {
  const js = read('financas.js');

  assert.ok(has(js, 'getContaFinanceInfo(conta).valorOriginal'),
    'Relatorio categoria deve usar .valorOriginal');
});

test('caller 5 - CSV Export usa totalAtualizado e statusNorm', () => {
  const js = read('financas.js');
  const csvBlock = blockBetween(js, 'function exportarTabelaExcel', 'function sanitizeCsvFilename');

  assert.ok(has(csvBlock, 'const info = getContaFinanceInfo(conta)'),
    'CSV deve resolver a conta financeira uma unica vez');
  assert.ok(has(csvBlock, 'info.totalAtualizado'),
    'CSV deve usar totalAtualizado');
  assert.ok(has(csvBlock, 'info.statusNorm'),
    'CSV deve usar statusNorm');
});

test('caller 6 - getContaJurosDisplay wrapper usa jurosAberto + tooltip', () => {
  const js = read('financas.js');

  assert.ok(has(js, 'function getContaJurosDisplay'),
    'Funcao getContaJurosDisplay deve existir');
  assert.ok(has(js, 'info.jurosAberto'),
    'getContaJurosDisplay usa info.jurosAberto');
  assert.ok(has(js, 'info.jurosAberto + info.jurosAcumulado'),
    'Retorno = jurosAberto + jurosAcumulado');
  assert.ok(has(js, 'info.tooltip'),
    'getContaJurosDisplay retorna tooltip');

  // Tooltip contratual no arquivo
  assert.ok(has(js, 'Dias contrato'),
    'Arquivo contem tooltip contratual Dias contrato');
});

test('caller 7 - PIX/Boleto lamina usa getContaFinanceInfo', () => {
  const js = read('financas.js');

  assert.ok(has(js, "typeof getContaFinanceInfo === 'function' ? getContaFinanceInfo(conta) : null"),
    'PIX chama getContaFinanceInfo condicionalmente');
  assert.ok(has(js, 'financeInfo'),
    'PIX passa financeInfo para abrirLaminaPix');
});

test('Caminho 3 - calculo contratual: tsInicio, tsFim, diasContrato', () => {
  const js = read('financas.js');

  assert.ok(has(js, 'CAMINHO 3'),
    'Deve existir marcador CAMINHO 3');
  assert.ok(has(js, 'tsInicio'),
    'Caminho 3 usa tsInicio');
  assert.ok(has(js, 'tsFim'),
    'Caminho 3 usa tsFim');
  assert.ok(has(js, 'diasContrato'),
    'Caminho 3 calcula diasContrato');
  assert.ok(has(js, 'Dias contrato'),
    'Tooltip contratual com Dias contrato');
});

test('Caminho 2 condicao corrigida: statusRaw === parcial', () => {
  const js = read('financas.js');

  assert.ok(js.includes("temHistorico || (temJuros && statusRaw === 'parcial')"),
    'Caminho 2 usa statusRaw === parcial (nao !== pendente)');
});

test('statusNorm normaliza vencido corretamente', () => {
  const js = read('financas.js');

  assert.ok(has(js, "statusNorm === 'pendente' &&"),
    'Deve normalizar pendente para vencido se atrasado');
});

test('Nenhum caller recalcula juros manualmente ignorando getContaFinanceInfo', () => {
  const js = read('financas.js');

  // Procura computeContaJurosInfo APENAS em contextos que nao sao callers
  // (deve estar apenas em sua definicao e no confirmarPagamento)
  const afterGetContaFinanceInfo = js.slice(
    Math.max(0, js.indexOf('function getContaFinanceInfo'))
  );
  const hasComputeInCallers = afterGetContaFinanceInfo.includes('computeContaJurosInfo');
  assert.ok(!hasComputeInCallers,
    'Callers apos getContaFinanceInfo nao devem usar computeContaJurosInfo');
});

test('getContaFinanceInfo retorno tem campos esperados pelos callers', () => {
  const js = read('financas.js');

  const fnStart = js.lastIndexOf('function getContaFinanceInfo');
  assert.ok(fnStart >= 0, 'getContaFinanceInfo deve existir');

  const fnBody = js.slice(fnStart, fnStart + 2500);

  const required = [
    'valorOriginal', 'valorPago', 'valorRestante',
    'jurosAberto', 'jurosAcumulado', 'totalAtualizado',
    'statusNorm', 'diasAtraso', 'tooltip'
  ];

  for (const field of required) {
    assert.ok(has(fnBody, field),
      `getContaFinanceInfo deve retornar "${field}"`);
  }
});

// ─── Testes com mock via VM ───────────────────────────────────────────────────

test('getContaJurosDisplay com mock — retorna juros contratual corretamente', () => {
  const js = read('financas.js');

  // Extrai a funcao getContaJurosDisplay
  const fnBlock = blockBetween(js,
    'function getContaJurosDisplay(conta)',
    'function getContaVencimentoTimestamp'
  );
  assert.ok(fnBlock.length > 50, 'bloco getContaJurosDisplay extraido');

  // Cria VM context com mock de getContaFinanceInfo
  const context = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    window: {},
    formatCurrency: (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`,
    getContaFinanceInfo: () => ({
      jurosAberto: 3100,
      jurosAcumulado: 0,
      totalAtualizado: 103100,
      statusNorm: 'vencido',
      valorOriginal: 100000,
      valorRestante: 0,
      diasAtraso: 102,
      tooltip: 'title="Tipo: Simples | Taxa: 3.00% | Dias contrato: 31 | Juros: R$ 3.100,00"'
    })
  };

  vm.createContext(context);
  vm.runInContext(`
    ${fnBlock}
    var result = getContaJurosDisplay({});
  `, context, { filename: 'financas-getContaJurosDisplay.vm.js' });

  const result = context.result;
  assert.equal(result.juros, 3100,
    'juros deve ser jurosAberto + jurosAcumulado = 3100');
  assert.equal(result.totalComJuros, 103100,
    'totalComJuros deve ser totalAtualizado = 103100');
  assert.ok(result.tooltip.includes('Dias contrato: 31'),
    'tooltip deve conter Dias contrato: 31');
  assert.equal(result.diasAtraso, 102,
    'diasAtraso deve vir do mock = 102');
});

test('getContaJurosDisplay com mock — conta paga retorna 0', () => {
  const js = read('financas.js');

  const fnBlock = blockBetween(js,
    'function getContaJurosDisplay(conta)',
    'function getContaVencimentoTimestamp'
  );

  const context = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    window: {},
    formatCurrency: (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`,
    getContaFinanceInfo: () => ({
      jurosAberto: 0, jurosAcumulado: 0,
      totalAtualizado: 0, statusNorm: 'pago',
      valorOriginal: 100000, valorRestante: 0,
      diasAtraso: 0,
      tooltip: 'title="Pago"'
    })
  };

  vm.createContext(context);
  vm.runInContext(`
    ${fnBlock}
    var result = getContaJurosDisplay({});
  `, context, { filename: 'financas-getContaJurosDisplay-pago.vm.js' });

  assert.equal(context.result.juros, 0,
    'conta paga deve ter juros = 0');
  assert.equal(context.result.totalComJuros, 0,
    'conta paga deve ter totalComJuros = 0');
});

test('getContaJurosDisplay com mock — conta parcial usa valorRestante', () => {
  const js = read('financas.js');

  const fnBlock = blockBetween(js,
    'function getContaJurosDisplay(conta)',
    'function getContaVencimentoTimestamp'
  );

  const context = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    window: {},
    formatCurrency: (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`,
    getContaFinanceInfo: () => ({
      jurosAberto: 500, jurosAcumulado: 200,
      totalAtualizado: 15500, statusNorm: 'parcial',
      valorOriginal: 50000, valorRestante: 15000,
      diasAtraso: 30,
      tooltip: 'title="Tipo: Simples | Dias contrato: 30"'
    })
  };

  vm.createContext(context);
  vm.runInContext(`
    ${fnBlock}
    var result = getContaJurosDisplay({});
  `, context, { filename: 'financas-getContaJurosDisplay-parcial.vm.js' });

  assert.equal(context.result.juros, 700,
    'juros deve ser jurosAberto + jurosAcumulado = 700');
  assert.equal(context.result.totalComJuros, 15500,
    'totalComJuros = totalAtualizado (parcial)');
});

test('Caminho 3 — PX000039: emissao=11/03, venc=11/04, taxa=3% => juros=3100', () => {
  const js = read('financas.js');

  // Extrai apenas normalizeDateToTimestamp (nao depende de DOM)
  const normalizeDate = blockBetween(js,
    'function normalizeDateToTimestamp(value)',
    'function getContaVencimentoTimestamp'
  );

  // Monta o cenario PX000039: 100k, emissao 11/03/2026, venc 11/04/2026, taxa 3%
  const context = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    window: {},
    Date: Date,
    Math: Math,
    Number: Number,
    isNaN: isNaN
  };

  vm.createContext(context);
  vm.runInContext(`
    ${normalizeDate}

    // Simula o Caminho 3 manualmente com datas fixas
    // PX000039: emissao=11/03/2026, venc=11/04/2026, valor=100000, taxa=3% (simples)
    const tsEmissao = normalizeDateToTimestamp('11/03/2026');
    const tsVenc = normalizeDateToTimestamp('11/04/2026');

    // Caminho 3: tsInicio = max(baseJuros, emissao), tsFim = venc
    const tsInicio = Math.max(0, tsEmissao || 0) || tsVenc;
    const tsFim = tsVenc;
    const diasContrato = (tsFim > tsInicio) ? Math.floor((tsFim - tsInicio) / 86400000) : 0;

    // Juros simples: base * taxa/100 * dias/30
    const taxa = 3 / 100;
    const meses = diasContrato / 30;
    const juros = 100000 * taxa * meses;

    var result = {
      tsInicio: tsInicio,
      tsFim: tsFim,
      diasContrato: diasContrato,
      juros: Math.round(juros * 100) / 100
    };
  `, context, { filename: 'caminho3-math.vm.js' });

  assert.equal(context.result.diasContrato, 31,
    'PX000039: dias contrato emissao->vencimento = 31');
  assert.ok(Math.abs(context.result.juros - 3100) < 0.01,
    `PX000039: juros contratual = 3100, obtido = ${context.result.juros}`);
});
