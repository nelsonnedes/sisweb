import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function extractFunction(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `bloco ${startMarker} precisa existir`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `fim ${endMarker} precisa existir`);
  return source.slice(start, end);
}

// ---------------------------------------------------------------------------
// Contrato estático: o save precisa descarregar edições pendentes ANTES de
// montar o payload (sem isso, valor digitado + salvar em seguida persiste
// o valor antigo — debounce de 180ms ainda não disparou).
// ---------------------------------------------------------------------------
test('vendas: salvarPedido descarrega parcelas pendentes antes do payload', () => {
  const vendas = read('vendas.js');
  const saveStart = vendas.indexOf('async function salvarPedido');
  assert.notEqual(saveStart, -1, 'salvarPedido precisa existir');
  const payloadAt = vendas.indexOf('contasReceber: [...contasReceber]', saveStart);
  assert.notEqual(payloadAt, -1, 'payload precisa incluir contasReceber');
  const flushAt = vendas.indexOf('descarregarEdicaoParcelasVenda()', saveStart);
  assert.notEqual(flushAt, -1, 'salvarPedido precisa descarregar edições pendentes');
  assert.ok(flushAt < payloadAt, 'flush precisa ocorrer ANTES de montar o payload');
});

test('compras: salvarPedido descarrega parcelas pendentes antes do payload', () => {
  const compras = read('compras.js');
  const saveStart = compras.indexOf('async function salvarPedido');
  assert.notEqual(saveStart, -1, 'salvarPedido precisa existir');
  const payloadAt = compras.indexOf('contasPagar: contasPagar', saveStart);
  assert.notEqual(payloadAt, -1, 'payload precisa incluir contasPagar');
  const flushAt = compras.indexOf('descarregarEdicaoParcelasCompra()', saveStart);
  assert.notEqual(flushAt, -1, 'salvarPedido precisa descarregar edições pendentes');
  assert.ok(flushAt < payloadAt, 'flush precisa ocorrer ANTES de montar o payload');
});

// ---------------------------------------------------------------------------
// Comportamento: flush aplica valor/dias/vencimento/obs do DOM e limpa timers
// ---------------------------------------------------------------------------
function runFlush({ source, flushStart, flushEnd, flushName, contasVar, diasMapVar, valorMapVar, calls }) {
  const flushSrc = extractFunction(source, flushStart, flushEnd);
  const context = {
    [contasVar]: [{ id: 'CR1', valor: 100, dias: 30, vencimento: '2026-02-01', observacao: 'antiga' }],
    [diasMapVar]: new Map([['CR1', 12345]]),
    document: {
      getElementById: (id) => {
        const table = {
          'conta-valor-CR1': { value: '200', disabled: false },
          'conta-dias-CR1': { value: '45', disabled: false },
          'conta-venc-CR1': { value: '2026-03-01', disabled: false },
          'conta-obs-CR1': { value: 'nova obs', disabled: false }
        };
        return table[id] || null;
      }
    }
  };
  if (valorMapVar) context[valorMapVar] = new Map([['CR1', 67890]]);
  context.parseCurrencyValue = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const numericValue = value.toString().replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(numericValue) || 0;
  };
  context.addDaysISO = (baseStr, days) => {
    const [y, m, d] = baseStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + parseInt(days, 10)));
    return date.toISOString().slice(0, 10);
  };
  context.atualizarValorConta = (id, v) => {
    calls.push(['valor', id, v]);
    if (valorMapVar) context[valorMapVar].delete(String(id));
  };
  context.onParcelaValorBlur = (id, v) => {
    calls.push(['valor', id, v]);
  };
  context.atualizarDiasConta = (id, v) => {
    calls.push(['dias', id, v]);
    context[diasMapVar].delete(String(id));
  };
  context.atualizarDiasContaPagar = (id, v) => {
    calls.push(['dias', id, v]);
    context[diasMapVar].delete(String(id));
  };
  context.atualizarVencimentoConta = (id, v) => {
    calls.push(['venc', id, v]);
  };
  context.atualizarObservacaoConta = (id, v) => {
    calls.push(['obs', id, v]);
  };
  context.onParcelaDateBlur = (id, el) => {
    calls.push(['venc', id, el && el.value]);
  };
  vm.createContext(context);
  vm.runInContext(`${flushSrc}\n${flushName}();`, context);
  return context;
}

test('vendas: flush aplica DOM na memória e limpa timers pendentes', () => {
  const vendas = read('vendas.js');
  const calls = [];
  const context = runFlush({
    source: vendas,
    flushStart: 'function descarregarEdicaoParcelasVenda() {',
    flushEnd: '\nfunction atualizarTotalContasReceber()',
    flushName: 'descarregarEdicaoParcelasVenda',
    contasVar: 'contasReceber',
    diasMapVar: 'debounceDiasContaTimers',
    valorMapVar: 'debounceValorContaTimers',
    calls
  });
  const conta = context.contasReceber.find(c => String(c.id) === 'CR1');
  assert.ok(conta, 'conta CR1 precisa existir');
  assert.equal(conta.valor, 200, 'valor aplicado é o digitado, não o antigo (100)');
  assert.equal(conta.dias, 45, 'dias aplicado do DOM');
  assert.equal(conta.vencimento, '2026-03-18', 'vencimento calculado a partir de dias');
  assert.equal(conta.observacao, 'nova obs', 'observação aplicada do DOM');
  assert.equal(context.debounceValorContaTimers.size, 0, 'timer de valor pendente consumido');
  assert.equal(context.debounceDiasContaTimers.size, 0, 'timer de dias pendente consumido');
});

test('compras: flush aplica DOM na memória e limpa timers pendentes', () => {
  const compras = read('compras.js');
  const calls = [];
  const context = runFlush({
    source: compras,
    flushStart: 'function descarregarEdicaoParcelasCompra() {',
    flushEnd: '\nfunction onParcelaValorInput(',
    flushName: 'descarregarEdicaoParcelasCompra',
    contasVar: 'contasPagar',
    diasMapVar: 'debounceDiasContaPagarTimers',
    valorMapVar: null,
    calls
  });
  const kinds = calls.map(c => c[0]).sort();
  assert.deepEqual(kinds, ['dias', 'obs', 'valor', 'venc'], 'valor+dias+vencimento+obs aplicados do DOM');
  assert.equal(context.debounceDiasContaPagarTimers.size, 0, 'timer de dias pendente consumido');
});
