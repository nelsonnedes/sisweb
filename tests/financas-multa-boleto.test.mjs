import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { __test } = require('../functions/finance-functions.js');
const { buildCanonicalCreatedAccount } = __test;

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('boleto com juros: multaTaxa aceita na criacao e edicao (server)', () => {
  const srv = read('functions/finance-functions.js');
  assert.ok(/'multaTaxa'/.test(srv), 'multaTaxa nas allowlists');
  const creatIdx = srv.indexOf('CREATABLE_MANUAL_ACCOUNT_FIELDS');
  const creatBlock = srv.slice(creatIdx, srv.indexOf(']);', creatIdx));
  assert.ok(/'multaTaxa'/.test(creatBlock), 'multaTaxa na criacao');
  const editIdx = srv.indexOf('EDITABLE_ACCOUNT_FIELDS');
  const editBlock = srv.slice(editIdx, srv.indexOf(']);', editIdx));
  assert.ok(/'multaTaxa'/.test(editBlock), 'multaTaxa na edicao');
  assert.ok(/multaTaxa: parseInterestRate\(source\.multaTaxa\)/.test(srv), 'multaTaxa normalizada na conta canonica');
});

test('dataCompetencia aceita na criacao manual e cai para o vencimento (fix financeCreateAccounts)', () => {
  const srv = read('functions/finance-functions.js');
  const creatIdx = srv.indexOf('CREATABLE_MANUAL_ACCOUNT_FIELDS');
  const creatBlock = srv.slice(creatIdx, srv.indexOf(']);', creatIdx));
  assert.ok(/'dataCompetencia'/.test(creatBlock), 'dataCompetencia na allowlist de criacao');
  const editIdx = srv.indexOf('EDITABLE_ACCOUNT_FIELDS');
  const editBlock = srv.slice(editIdx, srv.indexOf(']);', editIdx));
  assert.ok(/'dataCompetencia'/.test(editBlock), 'dataCompetencia na allowlist de edicao');

  const baseAccount = {
    id: 'manual-competencia-0001', cliente: 'Cliente A', clienteId: 'client-a',
    descricao: 'Conta com competencia', valor: 10, valorOriginal: 10,
    valorRestante: 10, valorTotal: 10, dataVencimento: '2026-07-20',
    dataCompetencia: '2026-07-10', status: 'pendente', categoria: 'vendas',
    tipo: 'pix', jurosTipo: 'none', jurosTaxa: 0, parcela: 1, totalParcelas: 1,
    origem: 'manual', numero: 'RX000099',
  };
  const request = {
    tipo: 'receber', type: 'receber', operationId: 'create-competencia-0001',
    accounts: [{ accountId: 'manual-competencia-0001', month: '2026-07', account: { ...baseAccount } }],
  };
  const canonical = buildCanonicalCreatedAccount(
    request.accounts[0], request, 'tenant-0001', '2026-07-17T12:00:00.000Z',
  );
  assert.equal(canonical.dataCompetencia, '2026-07-10', 'dataCompetencia informada e preservada');

  const semCompetencia = buildCanonicalCreatedAccount(
    { accountId: 'manual-competencia-0001', month: '2026-07', account: { ...baseAccount, dataCompetencia: undefined } },
    request, 'tenant-0001', '2026-07-17T12:00:00.000Z',
  );
  assert.equal(semCompetencia.dataCompetencia, '2026-07-20', 'fallback: vencimento quando ausente');
});

test('save receber/pagar: trava anti-duplo + overlay + botao', () => {
  const js = read('financas.js');
  assert.ok(/window\.__financeSaving = true/.test(js), 'trava setada');
  assert.ok(/mostrarLoading\(true, 'Salvando conta\.\.\.'\)/.test(js), 'overlay ao salvar');
  assert.ok(/mostrarLoading\(false\)/.test(js), 'overlay escondido');
  assert.ok(/setSubmitButtonLoading\(rsBtn, true, 'Salvando\.\.\.'\)/.test(js) || /setSubmitButtonLoading\(rsOk, false\)/.test(js), 'botao receber com loading');
  assert.ok(/Salvamento j\u00e1 em andamento/.test(js), 'aviso em duplo-clique');
});
