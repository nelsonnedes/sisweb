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
  const source = read('compras.js');
  const helpersBlock = blockBetween(
    source,
    'function toMonthKey',
    'async function salvarPedido'
  );
  const context = {
    window: {},
    getData: async () => []
  };
  vm.createContext(context);
  vm.runInContext(`${helpersBlock}
    this.helpers = {
      contaPagarPertenceAoPedidoCompra,
      carregarContasPagarVinculadasPedidoCompra,
      isContaPagarComPagamento,
      montarUpdatesRemocaoContasPagarCompra
    };`, context);
  return context;
}

test('compras estorna financeiro ao voltar pedido para pendente ou cancelado', async () => {
  const context = loadFinanceHelpers();
  const { helpers } = context;
  const pedido = { id: 'PC-1776259657669', numero: '000052' };
  const conta = {
    id: 'CP-PC-1776259657669-0',
    origem: 'compras',
    origemId: 'PC-1776259657669',
    pedidoNumero: '000052',
    descricao: 'Compra 000052 - Cheque-pré',
    dataVencimento: '2026-05-15',
    valorOriginal: 1200,
    valorRestante: 1200,
    status: 'pendente'
  };

  assert.equal(helpers.contaPagarPertenceAoPedidoCompra(conta, pedido), true);
  assert.equal(
    helpers.contaPagarPertenceAoPedidoCompra({ ...conta, origemId: '', pedidoNumero: '' }, pedido),
    true,
    'deve localizar contas legadas pela descricao Compra 000052'
  );
  assert.equal(helpers.isContaPagarComPagamento(conta), false);
  assert.equal(helpers.isContaPagarComPagamento({ ...conta, status: 'parcial' }), true);
  assert.equal(helpers.isContaPagarComPagamento({ ...conta, valorRestante: 900 }), true);

  const { id: _id, ...contaLegadaSemId } = conta;
  context.window.firebaseService = {
    loadFromFirebase: async () => ({
      success: true,
      data: {
        '2026-05': {
          'CP-PC-1776259657669-0': contaLegadaSemId
        }
      }
    })
  };

  const vinculadas = await helpers.carregarContasPagarVinculadasPedidoCompra(pedido);
  assert.equal(vinculadas.length, 1);
  assert.equal(vinculadas[0].id, 'CP-PC-1776259657669-0');

  const updates = helpers.montarUpdatesRemocaoContasPagarCompra(vinculadas);
  assert.equal(updates['financas/pagar/2026-05/CP-PC-1776259657669-0'], null);
  assert.equal(
    updates['financas/pagar/CP-PC-1776259657669-0'],
    undefined,
    'estorno nao deve recriar o caminho flat financeiro legado',
  );
});

test('compras cai em modo legado quando callable ainda nao publicada e preserva rollback', () => {
  const js = read('compras.js');

  assert.match(js, /financeSyncCompra indisponível/);
  assert.match(js, /Usando modo legado de escrita direta/);
  assert.match(js, /errorCode === 'internal'/);
  assert.match(js, /dataEmissao: c\.dataEmissao \|\| pedido\.data \|\| ''/);
  assert.match(js, /updates\[`financas\/pagar\/\$\{mk\}\/\$\{contaId\}`\] = conta/);
  assert.match(js, /Não foi possível sincronizar o financeiro do pedido de compra\. Nenhuma alteração foi concluída\./);
});

test('compras versiona script e evita falso sucesso quando financeiro nao sincroniza', () => {
  const html = read('compras.html');
  const js = read('compras.js');

  assert.match(html, /compras\.js\?v=[^"'\s]+/);
  assert.match(js, /financeSyncCompra/);
  assert.match(js, /contasRemover = vinculadas\.map/);
  assert.match(js, /Não foi possível sincronizar o financeiro do pedido de compra\. Nenhuma alteração foi concluída\./);
  assert.match(js, /Não foi possível remover o financeiro vinculado ao pedido de compra\. Nenhuma alteração foi concluída\./);
  assert.doesNotMatch(js, /await saveData\('compras', window\.compras\)/);
  assert.doesNotMatch(js, /await saveData\('contasPagar'/);
});
