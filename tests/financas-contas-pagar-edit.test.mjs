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

function loadFinanceEditHelpers() {
  const source = read('financas.js');
  const helpersBlock = blockBetween(
    source,
    'function normalizeTipoKey',
    'function resolveCategoriaPadrao'
  );
  const context = {
    window: {},
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    }
  };
  vm.createContext(context);
  vm.runInContext(`${helpersBlock}
    this.helpers = {
      resolveFinanceTipoOperacional,
      normalizeCategoriaForFinanceSave,
      normalizeTipoPagamentoForFinanceSave,
      applyContaFinanceiroTipoPagamento
    };`, context, { filename: 'financas-contas-pagar-edit.vm.js' });
  return context.helpers;
}

test('edicao de conta a pagar sincroniza tipo operacional legado e atual', () => {
  const helpers = loadFinanceEditHelpers();
  const conta = {
    tipo: 'pagar',
    tipoPagamento: 'boleto',
    tipo_pagamento: 'boleto'
  };

  assert.equal(helpers.resolveFinanceTipoOperacional(conta), 'boleto');

  const tipoKey = helpers.applyContaFinanceiroTipoPagamento(conta, 'pix', 'pagar');

  assert.equal(tipoKey, 'pix');
  assert.equal(conta.tipo, 'pix');
  assert.equal(conta.tipoPagamento, 'pix');
  assert.equal(conta.tipo_pagamento, 'pix');
  assert.equal(helpers.resolveFinanceTipoOperacional(conta), 'pix');
});

test('contas a pagar preservam categoria normalizada sem falso outros', () => {
  const helpers = loadFinanceEditHelpers();

  assert.equal(helpers.normalizeCategoriaForFinanceSave('Serviços'), 'servicos');
  assert.equal(helpers.normalizeCategoriaForFinanceSave('pix'), 'pix');
  assert.equal(helpers.normalizeCategoriaForFinanceSave('', 'outros'), 'outros');
  assert.equal(helpers.normalizeTipoPagamentoForFinanceSave('Boleto', 'pagar'), 'boleto');
});

test('salvarContaPagar usa contrato novo de tipo e cachebuster atualizado', () => {
  const js = read('financas.js');
  const html = read('financas.html');
  const sw = read('sw.js');

  assert.match(js, /const tipoKey = applyContaFinanceiroTipoPagamento\(conta, tipo, 'pagar'\);/);
  assert.match(js, /tipoPagamento: tipoKey/);
  assert.match(js, /tipo_pagamento: tipoKey/);
  assert.match(js, /let tipoAtual = String\(resolveFinanceTipoOperacional\(conta\) \|\| ''\)\.toLowerCase\(\)\.trim\(\);/);
  assert.match(js, /inRangeRec\.map\(c => resolveFinanceTipoOperacional\(c\)\)/);
  assert.match(js, /inRangePag\.map\(c => resolveFinanceTipoOperacional\(c\)\)/);
  assert.match(js, /callFinanceCallable\('financeUpdateAccount'/);
  assert.match(js, /callFinanceCallable\('financeDeleteAccount'/);
  assert.match(js, /callFinanceCallable\('financeUpdatePaymentReceipt'/);
  assert.match(js, /updateFinanceAccountAuthoritative\('pagar', contaOriginal, conta\)/);
  assert.match(js, /updateFinanceAccountAuthoritative\('receber', contaOriginal, conta\)/);
  assert.doesNotMatch(js, /saveToFirebase\(`financas\/(?:receber|pagar)\/\$\{mkDel\}`/);
  assert.doesNotMatch(js, /salvarContaFinanceiraPersistida/);
  assert.doesNotMatch(js, /conta\.categoria = getBaseCategoriaKeys\(\)\.includes\(categoriaKey\) \? categoriaKey : 'outros';/);
  assert.match(html, /financas\.js\?v=[^"'\s]+/);
  assert.match(sw, /const APP_VERSION = '2026-07-23-firebase-bootstrap-rollout-v1'/);
});
