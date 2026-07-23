import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function blockBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `bloco ${startMarker} precisa existir`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `fim ${endMarker} precisa existir`);
  return source.slice(start, end);
}

function loadFinanceHelpers() {
  const source = read('vendas.js');
  const endMarker = source.includes('/**\r\n * ✅ VALIDAR ESTOQUE ANTES DE ADICIONAR ITEM')
    ? '/**\r\n * ✅ VALIDAR ESTOQUE ANTES DE ADICIONAR ITEM'
    : '/**\n * ✅ VALIDAR ESTOQUE ANTES DE ADICIONAR ITEM';
  const helpersBlock = blockBetween(
    source,
    'function getPedidoVendaRef',
    endMarker
  );
  const context = {
    window: {},
    getData: async () => [],
    toMonthKey: (value) => String(value || 'sem-data').slice(0, 7)
  };
  vm.createContext(context);
  vm.runInContext(`${helpersBlock}
    this.helpers = {
      contaReceberPertenceAoPedidoVenda,
      carregarContasReceberVinculadasPedidoVenda,
      isContaReceberComRecebimento,
      montarUpdatesRemocaoContasReceberVenda
    };`, context);
  return context;
}

test('vendas estorna financeiro ao voltar pedido para pendente ou cancelado', async () => {
  const context = loadFinanceHelpers();
  const { helpers } = context;
  const pedido = { id: 'PED17762596576691544', numero: '000074' };
  const conta = {
    id: 'CR_PED17762596576691544_001',
    origem: 'pedido_venda',
    origemId: 'PED17762596576691544',
    pedidoNumero: '000074',
    descricao: 'Venda - Pedido 000074 - Cheque-pré',
    dataVencimento: '2026-05-15',
    valorOriginal: 1200,
    valorRestante: 1200,
    status: 'pendente'
  };

  assert.equal(helpers.contaReceberPertenceAoPedidoVenda(conta, pedido), true);
  assert.equal(
    helpers.contaReceberPertenceAoPedidoVenda({ ...conta, origemId: '', pedidoNumero: '' }, pedido),
    true,
    'deve localizar contas legadas pela descricao Pedido 000074'
  );
  assert.equal(helpers.isContaReceberComRecebimento(conta), false);

  context.window.firebaseService = {
    loadFromFirebase: async () => ({
      success: true,
      data: {
        '2026-05': {
          CR_PED17762596576691544_001: conta
        }
      }
    })
  };

  const vinculadas = await helpers.carregarContasReceberVinculadasPedidoVenda(pedido);
  assert.equal(vinculadas.length, 1);
  assert.equal(vinculadas[0].id, 'CR_PED17762596576691544_001');

  const updates = helpers.montarUpdatesRemocaoContasReceberVenda(vinculadas);
  assert.equal(updates['financas/receber/2026-05/CR_PED17762596576691544_001'], null);
  assert.equal(updates['financas/receber/CR_PED17762596576691544_001'], undefined);
  assert.equal(updates['contasReceber/2026-05/CR_PED17762596576691544_001'], null);

  const updatesPermitidosProducao = helpers.montarUpdatesRemocaoContasReceberVenda(vinculadas, { includeLegacy: false });
  assert.equal(updatesPermitidosProducao['financas/receber/2026-05/CR_PED17762596576691544_001'], null);
  assert.equal(updatesPermitidosProducao['financas/receber/CR_PED17762596576691544_001'], undefined);
  assert.equal(
    updatesPermitidosProducao['contasReceber/2026-05/CR_PED17762596576691544_001'],
    undefined,
    'updatePaths em producao nao deve tocar contasReceber legado sem permissao de escrita'
  );
});

test('vendas versiona script para derrubar cache da correcao financeira', () => {
  const html = read('vendas.html');
  assert.match(html, /vendas\.js\?v=[^"'\s]+/);
});

test('vendas evita falso sucesso se estorno financeiro nao for atomico', () => {
  const js = read('vendas.js');

  assert.match(js, /montarUpdatesRemocaoContasReceberVenda\(removiveis, \{ includeLegacy: false \}\)/);
  assert.match(js, /Não foi possível estornar o financeiro vinculado\. Nenhuma alteração foi concluída\./);
  assert.match(js, /let hasFinanceMutation = removiveis\.length > 0/);
  assert.match(js, /Object\.keys\(updatesAdd\)\.some\(path => String\(path\)\.startsWith\('financas\/receber\/'\)\)/);
  assert.match(js, /Não foi possível sincronizar o financeiro do pedido de venda\. Nenhuma alteração foi concluída\./);
  assert.doesNotMatch(js, /residualUpdates\[`contasReceber\/\$\{mk\}/);
});
