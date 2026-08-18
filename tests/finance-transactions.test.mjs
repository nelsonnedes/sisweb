import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { __test } = require('../functions/finance-functions.js');

const {
  FinanceValidationError,
  assertFinanceAccess,
  assertReceiptReference,
  buildAccountsCreateTreeMutation,
  buildCanonicalCreatedAccount,
  buildAccountDeleteTreeMutation,
  buildAccountEditTreeMutation,
  buildAccountMutation,
  buildReceiptMutation,
  buildSequenceMutation,
  createHandlers,
  currentFinancialState,
  normalizePaymentRequest,
  normalizeAccountCreateRequest,
  normalizeAccountEditRequest,
  normalizeAccountDeleteRequest,
  normalizeReceiptUpdateRequest,
  normalizeSequenceRequest,
  pruneOperationRecords,
  resolveAuthenticatedTenant,
  resolveFinanceAccountLocation,
} = __test;

const FIXED_NOW = '2026-07-17T12:00:00.000Z';

function createOpenAccount() {
  return {
    descricao: 'Conta de teste',
    valorOriginal: 10.01,
    valor: 10.01,
    historicosPagamento: [],
    valorPago: 0,
    valorRestante: 10.01,
    status: 'pendente',
    revision: 4,
  };
}

function createRegisterRequest({
  operationId = 'payment-op-0001',
  expected = {},
  paymentValue = 3.33,
  paidValue = 3.33,
  remainingValue = 6.68,
  status = 'parcial',
} = {}) {
  return normalizePaymentRequest({
    tipo: 'receber',
    mes: '2026-07',
    contaId: 'account-0001',
    operationId,
    expected: {
      historyLength: 0,
      valorPago: 0,
      valorRestante: 10.01,
      status: 'pendente',
      revision: 4,
      ...expected,
    },
    patch: {
      historicosPagamento: [{
        data: '2026-07-17',
        valor: paymentValue,
        metodo: 'pix',
        jurosAplicado: 0,
        diasAtraso: 0,
        operationId,
      }],
      valorPago: paidValue,
      valorRestante: remainingValue,
      status,
      dataPagamento: status === 'pago' ? '2026-07-17' : null,
      metodoPagamento: 'pix',
      jurosBaseDate: '2026-07-17',
    },
  });
}

test('sequencias RX e PX sao unicas e idempotentes por operationId', () => {
  for (const scenario of [
    { type: 'receber', prefix: 'RX' },
    { type: 'pagar', prefix: 'PX' },
  ]) {
    const firstRequest = normalizeSequenceRequest({
      tipo: scenario.type,
      operationId: `sequence-${scenario.prefix.toLowerCase()}-0001`,
    });
    const first = buildSequenceMutation(null, firstRequest, FIXED_NOW);

    assert.equal(first.outcome, 'commit');
    assert.equal(first.numero, `${scenario.prefix}000001`);
    assert.equal(first.current, 1);

    const retry = buildSequenceMutation(
      first.value,
      firstRequest,
      '2026-07-17T12:01:00.000Z',
    );

    assert.equal(retry.outcome, 'idempotent');
    assert.equal(retry.numero, first.numero);
    assert.equal(retry.current, first.current);
    assert.strictEqual(retry.value, first.value);

    const secondRequest = normalizeSequenceRequest({
      tipo: scenario.type,
      operationId: `sequence-${scenario.prefix.toLowerCase()}-0002`,
    });
    const second = buildSequenceMutation(first.value, secondRequest, FIXED_NOW);

    assert.equal(second.outcome, 'commit');
    assert.equal(second.numero, `${scenario.prefix}000002`);
    assert.notEqual(second.numero, first.numero);
    assert.equal(second.current, 2);
    assert.equal(Object.keys(second.value.operations).length, 2);
  }
});

test('callable inicializa sequencia ausente e confirma o numero autoritativo', async () => {
  const snapshot = (value) => ({
    exists: () => value !== undefined && value !== null,
    val: () => value,
  });
  let persistedSequence = null;
  const database = {
    ref(path) {
      return {
        async get() {
          if (path === 'companies/tenant-0001/users/member-0001') {
            return snapshot({ role: 'finance', active: true });
          }
          if (path === 'roles/member-0001') return snapshot(undefined);
          if (path === 'companies/tenant-0001/ownerUid') return snapshot(undefined);
          return snapshot(undefined);
        },
        async transaction(update) {
          assert.equal(
            path,
            'companies/tenant-0001/sequences/contasPagarManual',
          );
          const next = update(persistedSequence);
          if (next === undefined) {
            return { committed: false, snapshot: snapshot(persistedSequence) };
          }
          persistedSequence = next;
          return { committed: true, snapshot: snapshot(persistedSequence) };
        },
      };
    },
  };
  class TestHttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const handlers = createHandlers({
    database: () => database,
    HttpsError: TestHttpsError,
    isSuperAdmin: async () => false,
    now: () => FIXED_NOW,
  });

  const response = await handlers.financeNextSequence({
    tipo: 'pagar',
    operationId: 'sequence-callable-px-0001',
  }, {
    auth: {
      uid: 'member-0001',
      token: { companyId: 'tenant-0001', subscriptionStatus: 'active' },
    },
  });

  assert.deepEqual(response, {
    success: true,
    tipo: 'pagar',
    numero: 'PX000001',
    current: 1,
    idempotent: false,
  });
  assert.equal(
    persistedSequence.operations['sequence-callable-px-0001'].numero,
    'PX000001',
  );
});

test('criacao manual em lote e atomica e idempotente', () => {
  const request = normalizeAccountCreateRequest({
    tipo: 'receber',
    operationId: 'create-accounts-batch-0001',
    accounts: [
      {
        mes: '2026-07',
        account: {
          id: 'manual-account-0001', cliente: 'Cliente A', clienteId: 'client-a',
          descricao: 'Parcela 1', valor: 50, valorOriginal: 50, valorRestante: 50,
          valorTotal: 100, dataVencimento: '2026-07-20', status: 'pendente',
          categoria: 'vendas', tipo: 'boleto', jurosTipo: 'none', jurosTaxa: 0,
          parcela: 1, totalParcelas: 2, origem: 'manual', numero: 'RX000001-01',
        },
      },
      {
        mes: '2026-08',
        account: {
          id: 'manual-account-0002', cliente: 'Cliente A', clienteId: 'client-a',
          descricao: 'Parcela 2', valor: 50, valorOriginal: 50, valorRestante: 50,
          valorTotal: 100, dataVencimento: '2026-08-20', status: 'pendente',
          categoria: 'vendas', tipo: 'boleto', jurosTipo: 'none', jurosTaxa: 0,
          parcela: 2, totalParcelas: 2, origem: 'manual', numero: 'RX000001-02',
        },
      },
    ],
  });
  const canonicalEntries = request.accounts.map((item) => ({
    month: item.month,
    account: buildCanonicalCreatedAccount(item, request, 'tenant-0001', FIXED_NOW),
  }));
  const first = buildAccountsCreateTreeMutation({}, request, canonicalEntries, FIXED_NOW);
  const retryEntries = request.accounts.map((item) => ({
    month: item.month,
    account: buildCanonicalCreatedAccount(item, request, 'tenant-0001', '2026-08-21T12:00:00.000Z'),
  }));
  const retry = buildAccountsCreateTreeMutation(
    first.tree,
    request,
    retryEntries,
    '2026-08-21T12:00:00.000Z',
  );
  const partialTree = { '2026-07': first.tree['2026-07'] };
  const partialRetry = buildAccountsCreateTreeMutation(partialTree, request, canonicalEntries, FIXED_NOW);

  assert.equal(first.outcome, 'commit');
  assert.equal(first.accounts.length, 2);
  assert.equal(first.accounts[0].status, 'pendente');
  assert.equal(first.accounts[1]._financeOperations['create-accounts-batch-0001'].kind, 'create');
  assert.equal(retry.outcome, 'idempotent');
  assert.equal(partialRetry.outcome, 'conflict');
});

test('callable cria a primeira conta quando a arvore financeira ainda nao existe', async () => {
  const snapshot = (value) => ({
    exists: () => value !== undefined && value !== null,
    val: () => value,
  });
  let persistedTree = null;
  const database = {
    ref(path) {
      return {
        async get() {
          if (path === 'companies/tenant-0001/users/member-0001') {
            return snapshot({ role: 'finance', active: true });
          }
          if (path === 'roles/member-0001') return snapshot(undefined);
          if (path === 'companies/tenant-0001/ownerUid') return snapshot(undefined);
          return snapshot(undefined);
        },
        async transaction(update) {
          assert.equal(path, 'companies/tenant-0001/financas/receber');
          const next = update(persistedTree);
          if (next === undefined) {
            return { committed: false, snapshot: snapshot(persistedTree) };
          }
          persistedTree = next;
          return { committed: true, snapshot: snapshot(persistedTree) };
        },
      };
    },
  };
  class TestHttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const handlers = createHandlers({
    database: () => database,
    HttpsError: TestHttpsError,
    isSuperAdmin: async () => false,
    now: () => FIXED_NOW,
  });
  const payload = {
    tipo: 'receber',
    operationId: 'create-first-receivable-0001',
    accounts: [{
      mes: '2026-07',
      account: {
        id: 'first-receivable-0001',
        cliente: 'Cliente Inicial',
        clienteId: 'client-initial',
        descricao: 'Primeira conta',
        valor: 80,
        valorOriginal: 80,
        valorRestante: 80,
        valorTotal: 80,
        dataVencimento: '2026-07-20',
        status: 'pendente',
        categoria: 'outros',
        tipo: 'pix',
        jurosTipo: 'none',
        jurosTaxa: 0,
        parcela: 1,
        totalParcelas: 1,
        origem: 'manual',
        numero: 'RX000001',
      },
    }],
  };
  const context = {
    auth: {
      uid: 'member-0001',
      token: { companyId: 'tenant-0001', subscriptionStatus: 'active' },
    },
  };

  const first = await handlers.financeCreateAccounts(payload, context);
  const retry = await handlers.financeCreateAccounts(payload, context);

  assert.equal(first.success, true);
  assert.equal(first.idempotent, false);
  assert.equal(first.accounts[0].id, 'first-receivable-0001');
  assert.equal(retry.success, true);
  assert.equal(retry.idempotent, true);
  assert.equal(
    persistedTree['2026-07']['first-receivable-0001']._financeOperations[
      'create-first-receivable-0001'
    ].kind,
    'create',
  );
});

test('criacao manual rejeita valor divergente e particao incorreta', () => {
  assert.throws(
    () => normalizeAccountCreateRequest({
      tipo: 'pagar', operationId: 'create-invalid-month-0001',
      accounts: [{
        mes: '2026-08',
        account: {
          id: 'manual-invalid-0001', valor: 10, valorOriginal: 10,
          valorRestante: 9, dataVencimento: '2026-07-20', origem: 'manual',
        },
      }],
    }),
    /Partição mensal/,
  );
  const request = normalizeAccountCreateRequest({
    tipo: 'pagar', operationId: 'create-invalid-value-0001',
    accounts: [{
      mes: '2026-07',
      account: {
        id: 'manual-invalid-value-0001', fornecedor: 'Fornecedor A', fornecedorId: 'supplier-a',
        descricao: 'Conta inválida', valor: 10, valorOriginal: 10,
        valorRestante: 9, dataVencimento: '2026-07-20', origem: 'manual',
      },
    }],
  });
  assert.throws(
    () => buildCanonicalCreatedAccount(request.accounts[0], request, 'tenant-0001', FIXED_NOW),
    /valorRestante deve corresponder/,
  );
});

test('exclusao de conta localiza particao movida e nao finge sucesso ausente', () => {
  const account = {
    ...createOpenAccount(),
    id: 'account-moved-0001',
    dataVencimento: '2026-08-20',
  };
  const request = normalizeAccountDeleteRequest({
    tipo: 'receber', mes: '2026-07', contaId: account.id,
    operationId: 'delete-moved-account-0001',
    expected: {
      historyLength: 0, valorPago: 0, valorRestante: 10.01,
      status: 'pendente', revision: 4,
    },
  });
  const committed = buildAccountDeleteTreeMutation({
    '2026-08': { [account.id]: account },
  }, request);
  const absent = buildAccountDeleteTreeMutation({}, request);

  assert.equal(committed.outcome, 'commit');
  assert.equal(committed.deletedMonth, '2026-08');
  assert.equal(committed.tree['2026-08'][account.id], undefined);
  assert.deepEqual(absent, { outcome: 'not-found' });
});

test('baixa localiza conta em outra particao ou no formato plano legado', () => {
  const request = {
    type: 'pagar',
    month: '2026-07',
    accountId: 'account-moved-0001',
  };
  const account = {
    ...createOpenAccount(),
    id: request.accountId,
    dataVencimento: '2026-06-10',
  };

  assert.deepEqual(
    resolveFinanceAccountLocation({ '2026-06': { [request.accountId]: account } }, request),
    {
      outcome: 'found',
      month: '2026-06',
      path: '2026-06/account-moved-0001',
      legacy: false,
    },
  );
  assert.deepEqual(
    resolveFinanceAccountLocation({ [request.accountId]: account }, request),
    {
      outcome: 'found',
      month: '2026-06',
      path: 'account-moved-0001',
      legacy: true,
    },
  );
  assert.deepEqual(resolveFinanceAccountLocation({}, request), { outcome: 'not-found' });
  assert.deepEqual(
    resolveFinanceAccountLocation({
      '2026-06': { [request.accountId]: account },
      '2026-07': { [request.accountId]: { ...account, dataVencimento: '2026-07-10' } },
    }, request),
    { outcome: 'conflict', reason: 'duplicate-remote-id' },
  );
});

test('callable de baixa transaciona a conta recuperada em outra particao', async () => {
  const accountId = 'account-recovered-0001';
  const rootPath = 'companies/tenant-0001/financas/pagar';
  const tree = {
    '2026-06': {
      [accountId]: {
        ...createOpenAccount(),
        id: accountId,
        dataVencimento: '2026-06-10',
      },
    },
  };
  const snapshot = (value) => ({
    exists: () => value !== undefined && value !== null,
    val: () => value,
  });
  const database = {
    ref(path) {
      return {
        async get() {
          if (path === 'companies/tenant-0001/users/member-0001') {
            return snapshot({ role: 'owner', active: true });
          }
          if (path === 'roles/member-0001') return snapshot(undefined);
          if (path === 'companies/tenant-0001/ownerUid') return snapshot('member-0001');
          if (path === rootPath) return snapshot(tree);
          return snapshot(undefined);
        },
        async transaction(update) {
          const requestedPath = `${rootPath}/2026-07/${accountId}`;
          const recoveredPath = `${rootPath}/2026-06/${accountId}`;
          if (path !== requestedPath && path !== recoveredPath) {
            throw new Error(`Unexpected transaction path: ${path}`);
          }
          const current = path === recoveredPath ? tree['2026-06'][accountId] : null;
          assert.equal(update(null), null, 'null provisório deve aguardar o estado remoto');
          const next = update(current);
          if (next === undefined) {
            return { committed: false, snapshot: snapshot(current) };
          }
          tree['2026-06'][accountId] = next;
          return { committed: true, snapshot: snapshot(next) };
        },
      };
    },
  };
  class TestHttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const handlers = createHandlers({
    database: () => database,
    HttpsError: TestHttpsError,
    isSuperAdmin: async () => false,
    now: () => FIXED_NOW,
  });
  const operationId = 'payment-recovered-0001';
  const response = await handlers.financeRegisterPayment({
    tipo: 'pagar',
    mes: '2026-07',
    contaId: accountId,
    operationId,
    expected: {
      historyLength: 0,
      valorPago: 0,
      valorRestante: 10.01,
      status: 'vencido',
      revision: 4,
    },
    patch: {
      historicosPagamento: [{
        data: '2026-07-17',
        valor: 3.33,
        metodo: 'pix',
        jurosAplicado: 0,
        diasAtraso: 37,
        operationId,
      }],
      valorPago: 3.33,
      valorRestante: 6.68,
      status: 'parcial',
      dataPagamento: null,
      metodoPagamento: 'pix',
      jurosBaseDate: '2026-07-17',
    },
  }, {
    auth: {
      uid: 'member-0001',
      token: { companyId: 'tenant-0001', subscriptionStatus: 'active' },
    },
  });

  assert.equal(response.success, true);
  assert.equal(response.resolvedMonth, '2026-06');
  assert.equal(response.legacyPath, false);
  assert.equal(response.account.valorPago, 3.33);
  assert.equal(tree['2026-06'][accountId].revision, 5);
});

test('pagamento parcial preserva os valores exatos em centavos', () => {
  const request = createRegisterRequest();
  const result = buildAccountMutation(
    createOpenAccount(),
    request,
    'register',
    FIXED_NOW,
  );

  assert.equal(result.outcome, 'commit');
  assert.equal(result.account.valorPago, 3.33);
  assert.equal(result.account.valorRestante, 6.68);
  assert.equal(result.account.status, 'parcial');
  assert.equal(result.account.revision, 5);
  assert.equal(result.account.historicosPagamento.length, 1);
  assert.equal(result.account.historicosPagamento[0].jurosTipoAplicado, 'none');
  assert.equal(result.account.historicosPagamento[0].jurosTaxaAplicada, 0);

  const financialState = currentFinancialState(result.account);
  assert.equal(financialState.originalCents, 1001);
  assert.equal(financialState.paidCents, 333);
  assert.equal(financialState.remainingCents, 668);
});

test('saldo restante de um centavo continua parcial', () => {
  const request = createRegisterRequest({
    operationId: 'payment-one-cent-0001',
    paymentValue: 10,
    paidValue: 10,
    remainingValue: 0.01,
    status: 'parcial',
  });
  const result = buildAccountMutation(
    createOpenAccount(),
    request,
    'register',
    FIXED_NOW,
  );

  assert.equal(result.outcome, 'commit');
  assert.equal(result.account.valorRestante, 0.01);
  assert.equal(result.account.status, 'parcial');
});

test('pagamento acima do valor exigivel e rejeitado', () => {
  const request = createRegisterRequest({
    operationId: 'payment-over-0001',
    paymentValue: 10.02,
    paidValue: 10.02,
    remainingValue: 0,
    status: 'pago',
  });
  const result = buildAccountMutation(
    createOpenAccount(),
    request,
    'register',
    FIXED_NOW,
  );

  assert.equal(result.outcome, 'invalid');
  assert.match(result.reason, /Pagamento excede o valor/);
});

test('expected financeiro ou revision stale produz conflito', () => {
  const staleScenarios = [
    {
      operationId: 'payment-stale-value-0001',
      expected: { valorRestante: 9.99 },
    },
    {
      operationId: 'payment-stale-revision-0001',
      expected: { revision: 3 },
    },
  ];

  for (const scenario of staleScenarios) {
    const result = buildAccountMutation(
      createOpenAccount(),
      createRegisterRequest(scenario),
      'register',
      FIXED_NOW,
    );

    assert.deepEqual(result, { outcome: 'conflict', reason: 'stale-state' });
  }
});

test('repetir a mesma baixa e idempotente e nao duplica o historico', () => {
  const request = createRegisterRequest({ operationId: 'payment-retry-0001' });
  const first = buildAccountMutation(
    createOpenAccount(),
    request,
    'register',
    FIXED_NOW,
  );
  assert.equal(first.outcome, 'commit');

  const retry = buildAccountMutation(
    first.account,
    request,
    'register',
    '2026-07-17T12:01:00.000Z',
  );

  assert.equal(retry.outcome, 'idempotent');
  assert.strictEqual(retry.account, first.account);
  assert.equal(retry.account.revision, 5);
  assert.equal(retry.account.historicosPagamento.length, 1);
  assert.equal(Object.keys(retry.account._financeOperations).length, 1);

  const changedPayload = createRegisterRequest({
    operationId: 'payment-retry-0001',
    paymentValue: 2.22,
    paidValue: 2.22,
    remainingValue: 7.79,
  });
  assert.deepEqual(
    buildAccountMutation(first.account, changedPayload, 'register', FIXED_NOW),
    { outcome: 'conflict', reason: 'operation-reused' },
  );
});

test('exclusao de pagamento recalcula historico saldo e revision', () => {
  const firstPayment = {
    data: '2026-07-10',
    valor: 3.33,
    metodo: 'pix',
    operationId: 'payment-entry-0001',
  };
  const secondPayment = {
    data: '2026-07-12',
    valor: 2.22,
    metodo: 'boleto',
    operationId: 'payment-entry-0002',
  };
  const account = {
    ...createOpenAccount(),
    historicosPagamento: [firstPayment, secondPayment],
    valorPago: 5.55,
    valorRestante: 4.46,
    status: 'parcial',
    revision: 6,
  };
  const request = normalizePaymentRequest({
    tipo: 'receber',
    mes: '2026-07',
    contaId: 'account-0001',
    operationId: 'payment-delete-0001',
    expected: {
      historyLength: 2,
      valorPago: 5.55,
      valorRestante: 4.46,
      status: 'parcial',
      revision: 6,
    },
    patch: {
      historicosPagamento: [firstPayment],
      valorPago: 3.33,
      valorRestante: 6.68,
      status: 'parcial',
      jurosBaseDate: '2026-07-10',
    },
  });
  const result = buildAccountMutation(account, request, 'delete', FIXED_NOW);

  assert.equal(result.outcome, 'commit');
  assert.deepEqual(result.account.historicosPagamento, [{
    ...firstPayment,
    jurosAplicado: 0,
    diasAtraso: 0,
  }]);
  assert.equal(result.account.valorPago, 3.33);
  assert.equal(result.account.valorRestante, 6.68);
  assert.equal(result.account.status, 'parcial');
  assert.equal(result.account.revision, 7);
});

test('exclusao da ultima baixa restaura status vencido quando aplicavel', () => {
  const payment = {
    data: '2026-07-10', valor: 3.33, metodo: 'pix', jurosAplicado: 0,
    diasAtraso: 0, jurosTipoAplicado: 'none', jurosTaxaAplicada: 0,
    operationId: 'payment-overdue-entry-0001',
  };
  const account = {
    ...createOpenAccount(),
    dataVencimento: '2026-06-10',
    historicosPagamento: [payment],
    valorPago: 3.33,
    valorRestante: 6.68,
    status: 'parcial',
    revision: 6,
  };
  const request = normalizePaymentRequest({
    tipo: 'receber', mes: '2026-06', contaId: 'account-overdue-0001',
    operationId: 'delete-overdue-payment-0001',
    expected: {
      historyLength: 1, valorPago: 3.33, valorRestante: 6.68,
      status: 'parcial', revision: 6,
    },
    patch: {
      historicosPagamento: [], valorPago: 0, valorRestante: 10.01,
      status: 'pendente', jurosBaseDate: null,
    },
  });
  const result = buildAccountMutation(account, request, 'delete', FIXED_NOW);

  assert.equal(result.outcome, 'commit');
  assert.equal(result.account.status, 'vencido');
  assert.equal(result.account.valorRestante, 10.01);
});

test('backend recalcula juros e rejeita valor forjado pelo cliente', () => {
  const account = {
    ...createOpenAccount(),
    valorOriginal: 100,
    valor: 100,
    valorRestante: 100,
    dataVencimento: '2026-06-17',
    jurosTipo: 'simples',
    jurosTaxa: 3,
    revision: 1,
  };
  const requestFor = (interest, remaining, operationId) => normalizePaymentRequest({
    tipo: 'receber',
    mes: '2026-06',
    contaId: 'account-interest-0001',
    operationId,
    expected: {
      historyLength: 0,
      valorPago: 0,
      valorRestante: 100,
      status: 'vencido',
      revision: 1,
    },
    patch: {
      historicosPagamento: [{
        data: '2026-07-17',
        valor: 10,
        metodo: 'pix',
        jurosAplicado: interest,
        diasAtraso: 30,
        operationId,
      }],
      valorPago: 10,
      valorRestante: remaining,
      status: 'parcial',
      dataPagamento: null,
      metodoPagamento: 'pix',
      jurosBaseDate: '2026-07-17',
    },
  });

  const valid = buildAccountMutation(
    account,
    requestFor(3, 93, 'payment-interest-valid-0001'),
    'register',
    FIXED_NOW,
  );
  assert.equal(valid.outcome, 'commit');
  assert.equal(valid.account.valorRestante, 93);

  const forged = buildAccountMutation(
    account,
    requestFor(1000, 1090, 'payment-interest-forged-0001'),
    'register',
    FIXED_NOW,
  );
  assert.equal(forged.outcome, 'invalid');
  assert.match(forged.reason, /Juros do pagamento não correspondem/);
});

test('exclusao intermediaria recalcula juros historicos no servidor', () => {
  const firstPayment = {
    data: '2026-07-17',
    valor: 50,
    jurosAplicado: 3,
    diasAtraso: 30,
    jurosTipoAplicado: 'simples',
    jurosTaxaAplicada: 3,
    operationId: 'payment-interest-entry-0001',
  };
  const secondPayment = {
    data: '2026-08-16',
    valor: 10,
    jurosAplicado: 1.59,
    diasAtraso: 30,
    jurosTipoAplicado: 'simples',
    jurosTaxaAplicada: 3,
    operationId: 'payment-interest-entry-0002',
  };
  const account = {
    ...createOpenAccount(),
    valorOriginal: 100,
    valor: 100,
    dataVencimento: '2026-06-17',
    jurosTipo: 'simples',
    jurosTaxa: 6,
    historicosPagamento: [firstPayment, secondPayment],
    valorPago: 60,
    valorRestante: 44.59,
    status: 'parcial',
    jurosBaseDate: '2026-08-16',
    revision: 8,
  };
  const request = normalizePaymentRequest({
    tipo: 'receber',
    mes: '2026-06',
    contaId: 'account-interest-delete-0001',
    operationId: 'payment-interest-delete-0001',
    expected: {
      historyLength: 2,
      valorPago: 60,
      valorRestante: 44.59,
      status: 'parcial',
      revision: 8,
    },
    patch: {
      historicosPagamento: [secondPayment],
      valorPago: 10,
      valorRestante: 90,
      status: 'parcial',
      jurosBaseDate: '2026-08-16',
    },
  });
  const result = buildAccountMutation(account, request, 'delete', FIXED_NOW);

  assert.equal(result.outcome, 'commit');
  assert.equal(result.account.valorPago, 10);
  assert.equal(result.account.valorRestante, 96);
  assert.equal(result.account.historicosPagamento[0].jurosAplicado, 6);
  assert.equal(result.account.historicosPagamento[0].diasAtraso, 60);
});

test('edicao transacional permite descricao e preserva campos pagos imutaveis', () => {
  const payment = {
    data: '2026-07-10',
    valor: 20,
    jurosAplicado: 2,
    diasAtraso: 10,
    operationId: 'payment-before-edit-0001',
  };
  const original = {
    id: 'account-edit-0001',
    descricao: 'Conta original',
    valor: 100,
    valorOriginal: 100,
    valorPago: 20,
    valorRestante: 82,
    historicosPagamento: [payment],
    status: 'parcial',
    dataVencimento: '2026-07-20',
    jurosBaseDate: '2026-07-10',
    comprovanteUrl: 'https://firebasestorage.googleapis.com/original.pdf',
    revision: 3,
  };
  const request = normalizeAccountEditRequest({
    tipo: 'pagar',
    mesOrigem: '2026-07',
    mesDestino: '2026-07',
    contaId: original.id,
    operationId: 'account-edit-operation-0001',
    expected: {
      historyLength: 1,
      valorPago: 20,
      valorRestante: 82,
      status: 'parcial',
      revision: 3,
    },
    account: {
      ...original,
      descricao: 'Conta atualizada',
      valor: 100,
      valorOriginal: 100,
      valorRestante: 0,
      valorPago: 150,
      status: 'pago',
      dataVencimento: '2026-07-20',
      historicosPagamento: [],
      comprovanteUrl: 'https://attacker.invalid/forged.pdf',
    },
  });
  const first = buildAccountEditTreeMutation({
    '2026-07': { [original.id]: original },
  }, request, FIXED_NOW);

  assert.equal(first.outcome, 'commit');
  assert.equal(first.account.descricao, 'Conta atualizada');
  assert.equal(first.account.valorOriginal, 100);
  assert.equal(first.account.valorPago, 20);
  assert.equal(first.account.valorRestante, 82);
  assert.equal(first.account.status, 'parcial');
  assert.deepEqual(first.account.historicosPagamento, [payment]);
  assert.equal(first.account.comprovanteUrl, original.comprovanteUrl);
  assert.equal(first.account.revision, 4);
  assert.strictEqual(first.tree['2026-07'][original.id], first.account);

  const retry = buildAccountEditTreeMutation(first.tree, request, '2026-07-17T12:01:00.000Z');
  assert.equal(retry.outcome, 'idempotent');
  assert.strictEqual(retry.account, first.account);
});

test('edicao no mesmo mes e idempotente apos resposta perdida', () => {
  const original = { ...createOpenAccount(), dataVencimento: '2026-07-20' };
  const request = normalizeAccountEditRequest({
    tipo: 'receber',
    mesOrigem: '2026-07',
    mesDestino: '2026-07',
    contaId: 'account-0001',
    operationId: 'account-edit-same-month-0001',
    expected: {
      historyLength: 0,
      valorPago: 0,
      valorRestante: 10.01,
      status: 'pendente',
      revision: 4,
    },
    account: {
      id: 'account-0001',
      descricao: 'Descrição atualizada',
      valor: 10.01,
      valorOriginal: 10.01,
      dataVencimento: '2026-07-20',
    },
  });
  const first = buildAccountEditTreeMutation({ '2026-07': { 'account-0001': original } }, request, FIXED_NOW);
  const retry = buildAccountEditTreeMutation(first.tree, request, '2026-07-17T12:01:00.000Z');

  assert.equal(first.outcome, 'commit');
  assert.equal(retry.outcome, 'idempotent');
  assert.strictEqual(retry.account, first.account);
});

test('edicao de conta aberta rejeita valor zero e juros nao canonicos', () => {
  const original = { ...createOpenAccount(), dataVencimento: '2026-07-20' };
  const expected = {
    historyLength: 0,
    valorPago: 0,
    valorRestante: 10.01,
    status: 'pendente',
    revision: 4,
  };
  const requestFor = (account, operationId) => normalizeAccountEditRequest({
    tipo: 'receber',
    mesOrigem: '2026-07',
    mesDestino: '2026-07',
    contaId: 'account-0001',
    operationId,
    expected,
    account,
  });
  const tree = { '2026-07': { 'account-0001': original } };

  const zero = buildAccountEditTreeMutation(
    tree,
    requestFor({ ...original, valor: 0, valorOriginal: 0 }, 'account-edit-zero-0001'),
    FIXED_NOW,
  );
  const invalidInterest = buildAccountEditTreeMutation(
    tree,
    requestFor({ ...original, jurosTipo: 'none', jurosTaxa: 5 }, 'account-edit-interest-invalid-0001'),
    FIXED_NOW,
  );

  assert.equal(zero.outcome, 'invalid');
  assert.match(zero.reason, /deve ser positivo/);
  assert.equal(invalidInterest.outcome, 'invalid');
  assert.match(invalidInterest.reason, /juros editada é inválida/);
});

test('tenant autenticado vem exclusivamente de context.auth.token.companyId', () => {
  const resolved = resolveAuthenticatedTenant({
    companyId: 'context-company',
    tenantId: 'context-tenant',
    auth: {
      uid: 'user-0001',
      companyId: 'auth-company',
      token: {
        companyId: 'token-company',
        subscriptionStatus: 'ACTIVE',
      },
    },
  });

  assert.deepEqual(resolved, {
    uid: 'user-0001',
    companyId: 'token-company',
    subscriptionStatus: 'active',
  });

  assert.throws(
    () => resolveAuthenticatedTenant({
      companyId: 'context-company',
      auth: {
        uid: 'user-0001',
        companyId: 'auth-company',
        token: { subscriptionStatus: 'active' },
      },
    }),
    (error) => {
      assert.ok(error instanceof FinanceValidationError);
      assert.equal(error.reason, 'permission-denied');
      assert.match(error.message, /Tenant autenticado ausente no token\./);
      return true;
    },
  );
});

test('callable exige membership ativa e permissão financeira', async () => {
  const context = {
    auth: {
      uid: 'member-0001',
      token: { companyId: 'tenant-0001', subscriptionStatus: 'active' },
    },
  };
  const snapshot = (value) => ({
    exists: () => value !== undefined,
    val: () => value,
  });
  const databaseFor = (member, role, ownerUid) => ({
    ref(path) {
      return {
        get: async () => {
          if (path.startsWith('companies/') && path.includes('/users/')) return snapshot(member);
          if (path.startsWith('roles/')) return snapshot(role);
          if (path.endsWith('/ownerUid')) return snapshot(ownerUid);
          return snapshot(undefined);
        },
      };
    },
  });

  await assert.rejects(
    assertFinanceAccess(context, databaseFor(undefined, undefined), async () => false),
    (error) => error instanceof FinanceValidationError
      && error.reason === 'permission-denied'
      && /Membership financeira/.test(error.message),
  );
  await assert.rejects(
    assertFinanceAccess(context, databaseFor({ role: 'viewer' }, undefined), async () => false),
    (error) => error instanceof FinanceValidationError
      && error.reason === 'permission-denied'
      && /Permissão financeira/.test(error.message),
  );
  await assert.doesNotReject(
    assertFinanceAccess(context, databaseFor({ role: 'finance' }, undefined), async () => false),
  );
  await assert.rejects(
    assertFinanceAccess(context, databaseFor({ permissions: { finance: { read: true } } }, undefined), async () => false),
    (error) => error instanceof FinanceValidationError
      && error.reason === 'permission-denied'
      && /Permissão financeira/.test(error.message),
  );
  await assert.doesNotReject(
    assertFinanceAccess(context, databaseFor({ permissions: { finance: { write: true } } }, undefined), async () => false),
  );
  await assert.rejects(
    assertFinanceAccess(context, databaseFor({ role: 'viewer' }, { role: 'finance' }), async () => false),
    (error) => error instanceof FinanceValidationError
      && error.reason === 'permission-denied'
      && /Permissão financeira/.test(error.message),
  );
  await assert.doesNotReject(
    assertFinanceAccess(context, databaseFor({ role: 'viewer' }, { role: 'finance', companyId: 'tenant-0001' }), async () => false),
  );
  await assert.doesNotReject(
    assertFinanceAccess(
      context,
      databaseFor(
        { accountStatus: 'active' },
        undefined,
        'member-0001',
      ),
      async () => false,
    ),
  );
  await assert.rejects(
    assertFinanceAccess(
      context,
      databaseFor(
        { accountStatus: 'active' },
        undefined,
        'other-member',
      ),
      async () => false,
    ),
    (error) => error instanceof FinanceValidationError
      && error.reason === 'permission-denied'
      && /Permissão financeira/.test(error.message),
  );
  await assert.rejects(
    assertFinanceAccess(
      context,
      databaseFor(
        undefined,
        undefined,
        'member-0001',
      ),
      async () => false,
    ),
    (error) => error instanceof FinanceValidationError
      && /Membership financeira/.test(error.message),
  );
  await assert.rejects(
    assertFinanceAccess(context, databaseFor({ role: 'owner', active: false }, undefined, 'member-0001'), async () => false),
    (error) => error instanceof FinanceValidationError
      && error.reason === 'permission-denied'
      && /inativo/.test(error.message),
  );
  await assert.rejects(
    assertFinanceAccess(context, databaseFor({ role: 'owner', adminActive: false }, undefined, 'member-0001'), async () => false),
    (error) => error instanceof FinanceValidationError
      && error.reason === 'permission-denied'
      && /inativo/.test(error.message),
  );
});

test('comprovante novo pertence ao Storage financeiro do tenant', () => {
  const storagePath = 'companies/tenant-0001/financas/recebimentos/account-0001_receipt.pdf';
  const validUrl = `https://firebasestorage.googleapis.com/v0/b/sisweb-7ce82.firebasestorage.app/o/${encodeURIComponent(storagePath)}?alt=media&token=test`;

  assert.doesNotThrow(() => assertReceiptReference({
    comprovanteUrl: validUrl,
    comprovanteStoragePath: storagePath,
  }, 'tenant-0001'));
  assert.throws(
    () => assertReceiptReference({
      comprovanteUrl: 'javascript:alert(1)',
      comprovanteStoragePath: storagePath,
    }, 'tenant-0001'),
    /Firebase Storage/,
  );
  assert.throws(
    () => assertReceiptReference({
      comprovanteUrl: validUrl,
      comprovanteStoragePath: 'companies/tenant-0002/financas/receipt.pdf',
    }, 'tenant-0001'),
    /tenant autenticado/,
  );
  assert.throws(
    () => assertReceiptReference({
      comprovanteUrl: `https://firebasestorage.googleapis.com/v0/b/attacker.firebasestorage.app/o/${encodeURIComponent(storagePath)}?alt=media`,
      comprovanteStoragePath: storagePath,
    }, 'tenant-0001'),
    /projeto Sisweb/,
  );
});

test('baixa retroativa ou futura e rejeitada pelo servidor', () => {
  const historical = {
    data: '2026-07-16',
    valor: 1,
    metodo: 'pix',
    jurosAplicado: 0,
    diasAtraso: 0,
    operationId: 'payment-existing-0001',
  };
  const accountWithHistory = {
    ...createOpenAccount(),
    historicosPagamento: [historical],
    valorPago: 1,
    valorRestante: 9.01,
    status: 'parcial',
    jurosBaseDate: '2026-07-16',
    revision: 5,
  };
  const retroactive = normalizePaymentRequest({
    tipo: 'receber',
    mes: '2026-07',
    contaId: 'account-0001',
    operationId: 'payment-retroactive-0001',
    expected: { historyLength: 1, valorPago: 1, valorRestante: 9.01, status: 'parcial', revision: 5 },
    patch: {
      historicosPagamento: [historical, {
        data: '2026-07-15', valor: 1, metodo: 'pix', jurosAplicado: 0, diasAtraso: 0,
        operationId: 'payment-retroactive-0001',
      }],
      valorPago: 2,
      valorRestante: 8.01,
      status: 'parcial',
      dataPagamento: null,
      metodoPagamento: 'pix',
      jurosBaseDate: '2026-07-15',
    },
  });
  const future = createRegisterRequest({ operationId: 'payment-future-0001' });
  future.patch.historicosPagamento[0].data = '2026-07-18';
  future.patch.jurosBaseDate = '2026-07-18';

  const retroactiveResult = buildAccountMutation(accountWithHistory, retroactive, 'register', FIXED_NOW);
  const futureResult = buildAccountMutation(createOpenAccount(), future, 'register', FIXED_NOW);
  assert.equal(retroactiveResult.outcome, 'invalid');
  assert.match(retroactiveResult.reason, /última baixa/);
  assert.equal(futureResult.outcome, 'invalid');
  assert.match(futureResult.reason, /futuro/);
});

test('edicao rejeita mudanca de valor e vencimento depois da primeira baixa', () => {
  const payment = {
    data: '2026-07-10', valor: 20, jurosAplicado: 0, diasAtraso: 0,
    operationId: 'payment-before-invalid-edit-0001',
  };
  const original = {
    ...createOpenAccount(),
    id: 'account-invalid-edit-0001',
    dataVencimento: '2026-07-20',
    valor: 100,
    valorOriginal: 100,
    valorPago: 20,
    valorRestante: 80,
    historicosPagamento: [payment],
    status: 'parcial',
    revision: 3,
  };
  const expected = { historyLength: 1, valorPago: 20, valorRestante: 80, status: 'parcial', revision: 3 };
  const belowPaid = normalizeAccountEditRequest({
    tipo: 'pagar', mesOrigem: '2026-07', mesDestino: '2026-07', contaId: original.id,
    operationId: 'account-edit-below-paid-0001', expected,
    account: { ...original, valor: 10, valorOriginal: 10 },
  });
  const wrongMonth = normalizeAccountEditRequest({
    tipo: 'pagar', mesOrigem: '2026-07', mesDestino: '2026-07', contaId: original.id,
    operationId: 'account-edit-wrong-month-0001', expected,
    account: { ...original, dataVencimento: '2026-08-20' },
  });
  const changedInterest = normalizeAccountEditRequest({
    tipo: 'pagar', mesOrigem: '2026-07', mesDestino: '2026-07', contaId: original.id,
    operationId: 'account-edit-interest-after-paid-0001', expected,
    account: { ...original, jurosTipo: 'simples', jurosTaxa: 6 },
  });

  const tree = { '2026-07': { [original.id]: original } };
  const belowPaidResult = buildAccountEditTreeMutation(tree, belowPaid, FIXED_NOW);
  const wrongMonthResult = buildAccountEditTreeMutation(tree, wrongMonth, FIXED_NOW);
  const changedInterestResult = buildAccountEditTreeMutation(tree, changedInterest, FIXED_NOW);
  assert.equal(belowPaidResult.outcome, 'invalid');
  assert.match(belowPaidResult.reason, /não podem mudar após a primeira baixa/);
  assert.equal(wrongMonthResult.outcome, 'invalid');
  assert.match(wrongMonthResult.reason, /não podem mudar após a primeira baixa/);
  assert.equal(changedInterestResult.outcome, 'invalid');
  assert.match(changedInterestResult.reason, /não podem mudar após a primeira baixa/);
});

test('edicao valida anexos do tenant e preserva proveniencia protegida', () => {
  const original = {
    ...createOpenAccount(),
    id: 'account-attachment-0001',
    dataVencimento: '2026-07-20',
    origem: 'pedido_venda',
    origemId: 'pedido-0001',
  };
  const expected = { historyLength: 0, valorPago: 0, valorRestante: 10.01, status: 'pendente', revision: 4 };
  const storagePath = 'companies/tenant-0001/financas/anexos/receber/account-attachment-0001_invoice.pdf';
  const validUrl = `https://firebasestorage.googleapis.com/v0/b/sisweb-7ce82.firebasestorage.app/o/${encodeURIComponent(storagePath)}?alt=media&token=test`;
  const requestFor = (url, operationId) => {
    const request = normalizeAccountEditRequest({
      tipo: 'receber', mesOrigem: '2026-07', mesDestino: '2026-07', contaId: original.id,
      operationId, expected,
      account: {
        ...original,
        origem: 'forjado',
        origemId: 'attacker',
        anexos: [{ url, storagePath, name: 'invoice.pdf' }],
      },
    });
    request.authorizedCompanyId = 'tenant-0001';
    return request;
  };

  const invalid = buildAccountEditTreeMutation(
    { '2026-07': { [original.id]: original } },
    requestFor('https://attacker.invalid/invoice.pdf', 'account-attachment-invalid-0001'),
    FIXED_NOW,
  );
  const valid = buildAccountEditTreeMutation(
    { '2026-07': { [original.id]: original } },
    requestFor(validUrl, 'account-attachment-valid-0001'),
    FIXED_NOW,
  );
  assert.equal(invalid.outcome, 'invalid');
  assert.match(invalid.reason, /Firebase Storage/);
  assert.equal(valid.outcome, 'commit');
  assert.equal(valid.account.origem, 'pedido_venda');
  assert.equal(valid.account.origemId, 'pedido-0001');
  assert.equal(valid.account.anexos[0].storagePath, storagePath);
});

test('atualizacao de comprovante e idempotente e preserva dados financeiros', () => {
  const account = {
    ...createOpenAccount(),
    historicosPagamento: [{
      data: '2026-07-17', valor: 3.33, metodo: 'pix', jurosAplicado: 0, diasAtraso: 0,
      operationId: 'payment-receipt-entry-0001',
    }],
    valorPago: 3.33,
    valorRestante: 6.68,
    status: 'parcial',
    revision: 6,
  };
  const storagePath = 'companies/tenant-0001/financas/recebimentos/account-0001_receipt.pdf';
  const url = `https://firebasestorage.googleapis.com/v0/b/sisweb-7ce82.firebasestorage.app/o/${encodeURIComponent(storagePath)}?alt=media&token=test`;
  const request = normalizeReceiptUpdateRequest({
    tipo: 'receber', mes: '2026-07', contaId: 'account-0001', registroRef: 0,
    operationId: 'receipt-update-0001',
    expected: { historyLength: 1, valorPago: 3.33, valorRestante: 6.68, status: 'parcial', revision: 6 },
    receipt: { url, storagePath },
  });
  const first = buildReceiptMutation(account, request, FIXED_NOW);
  const retry = buildReceiptMutation(first.account, request, '2026-07-17T12:01:00.000Z');

  assert.equal(first.outcome, 'commit');
  assert.equal(first.account.revision, 7);
  assert.equal(first.account.historicosPagamento[0].comprovanteStoragePath, storagePath);
  assert.equal(first.account.comprovanteUrl, url);
  assert.equal(first.account.comprovanteStoragePath, storagePath);
  assert.equal(first.account.valorRestante, 6.68);
  assert.equal(retry.outcome, 'idempotent');

  const removeRequest = normalizeReceiptUpdateRequest({
    tipo: 'receber', mes: '2026-07', contaId: 'account-0001', registroRef: 0,
    operationId: 'receipt-remove-0001',
    expected: { historyLength: 1, valorPago: 3.33, valorRestante: 6.68, status: 'parcial', revision: 7 },
    receipt: { url: null, storagePath: null },
  });
  const removed = buildReceiptMutation(first.account, removeRequest, FIXED_NOW);
  assert.equal(removed.outcome, 'commit');
  assert.equal(removed.account.comprovanteUrl, null);
  assert.equal(removed.account.comprovanteStoragePath, null);
});

test('normalizadores de exclusao e comprovante rejeitam caminhos ambiguos', () => {
  const deletion = normalizeAccountDeleteRequest({
    tipo: 'pagar', mes: '2026-07', contaId: 'account-0001', operationId: 'account-delete-0001',
    expected: { historyLength: 0, valorPago: 0, valorRestante: 10.01, status: 'pendente', revision: 4 },
  });
  assert.equal(deletion.type, 'pagar');
  assert.equal(deletion.month, '2026-07');
  assert.throws(
    () => normalizeReceiptUpdateRequest({
      tipo: 'receber', mes: '2026-07', contaId: 'account-0001', operationId: 'receipt-invalid-0001',
      expected: { historyLength: 0, valorPago: 0, valorRestante: 10.01, status: 'pendente', revision: 4 },
      registroRef: '../admin',
    }),
    /Referência do comprovante/,
  );
});

test('ledger de idempotencia permanece limitado aos registros mais recentes', () => {
  const records = Object.fromEntries(Array.from({ length: 300 }, (_, index) => [
    `operation-${String(index).padStart(4, '0')}`,
    { current: index + 1, completedAt: `2026-07-17T12:${String(index % 60).padStart(2, '0')}:00.000Z` },
  ]));
  const pruned = pruneOperationRecords(records, 256, 'current');

  assert.equal(Object.keys(pruned).length, 256);
  assert.ok(pruned['operation-0299']);
  assert.equal(pruned['operation-0000'], undefined);
});

function createPurchaseSyncHarness() {
  const snapshot = (value) => ({
    exists: () => value !== undefined && value !== null,
    val: () => value,
  });
  const persisted = {};
  const database = {
    ref(path) {
      return {
        async get() {
          if (path === 'companies/tenant-0001/users/member-0001') {
            return snapshot({ role: 'finance', active: true });
          }
          if (path === 'roles/member-0001') return snapshot(undefined);
          if (path === 'companies/tenant-0001/ownerUid') return snapshot(undefined);
          return snapshot(persisted[path]);
        },
        async update(updates) {
          for (const [key, value] of Object.entries(updates)) {
            if (value === null) {
              delete persisted[key];
            } else {
              persisted[key] = value;
            }
          }
          return null;
        },
      };
    },
  };
  class TestHttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }
  const handlers = createHandlers({
    database: () => database,
    HttpsError: TestHttpsError,
    isSuperAdmin: async () => false,
    now: () => FIXED_NOW,
  });
  const context = {
    auth: {
      uid: 'member-0001',
      token: { companyId: 'tenant-0001', subscriptionStatus: 'active' },
    },
  };
  return { handlers, persisted, context };
}

test('callable financeSyncCompra salva pedido e conta a pagar atomicamente', async () => {
  const { handlers, persisted, context } = createPurchaseSyncHarness();
  const payload = {
    operationId: 'purchase-sync-atomic-0001',
    pedido: {
      id: 'PC-1776259657669',
      numero: 'PC-1001',
      data: '2026-05-20',
      status: 'aprovado',
      fornecedor: { id: 'supplier-a', nome: 'Fornecedor A' },
      itens: [{ id: 1, tipo: 'manual', produtoNome: 'MADEIRA', quantidade: 10, precoUnitario: 50, total: 500 }],
      total: 500,
      contasPagar: [{ id: 'CP-PC-1776259657669-0', valor: 500, vencimento: '2026-05-25', tipo: 'pagar', observacao: 'Parcela única' }],
    },
    contasCriar: [{
      id: 'CP-PC-1776259657669-0',
      fornecedor: 'Fornecedor A',
      descricao: 'Compra PC-1001 - Parcela única',
      valor: 500,
      valorOriginal: 500,
      valorRestante: 500,
      dataVencimento: '2026-05-25',
      dataEmissao: '2026-05-20',
      status: 'pendente',
      tipoPagamento: 'pagar',
    }],
    contasRemover: [],
  };

  const response = await handlers.financeSyncCompra(payload, context);

  assert.equal(response.success, true);
  assert.equal(response.idempotent, false);
  assert.equal(response.pedidoId, 'PC-1776259657669');
  assert.equal(persisted['pedidosCompra/PC-1776259657669'].id, 'PC-1776259657669');
  const account = persisted['financas/pagar/2026-05/CP-PC-1776259657669-0'];
  assert.equal(account.id, 'CP-PC-1776259657669-0');
  assert.equal(account.tipo, 'pagar');
  assert.equal(account.categoria, 'compras');
  assert.equal(account.origem, 'compras');
  assert.equal(account.origemId, 'PC-1776259657669');
  assert.equal(account.valor, 500);
  assert.equal(account.valorOriginal, 500);
  assert.equal(account.valorRestante, 500);
  assert.equal(account.valorPago, 0);
  assert.equal(account.dataVencimento, '2026-05-25');
  assert.equal(account.dataEmissao, '2026-05-20');
  assert.equal(account.status, 'pendente');
  assert.equal(account.fornecedorId, 'supplier-a');
  assert.equal(account.pedidoNumero, 'PC-1001');
  assert.equal(account.revision, 0);
  assert.equal(account.created, FIXED_NOW);
});

test('callable financeSyncCompra remove contas vinculadas e substitui em edicao', async () => {
  const { handlers, persisted, context } = createPurchaseSyncHarness();
  persisted['financas/pagar/2026-05/CP-PC-OLD-0000'] = { id: 'CP-PC-OLD-0000', status: 'pendente' };

  const payload = {
    operationId: 'purchase-sync-replace-0001',
    pedido: {
      id: 'PC-1776259657669',
      numero: 'PC-1001',
      data: '2026-05-20',
      status: 'aprovado',
      fornecedor: { id: 'supplier-a', nome: 'Fornecedor A' },
      itens: [{ id: 1, tipo: 'manual', produtoNome: 'MADEIRA', quantidade: 10, precoUnitario: 50, total: 500 }],
      total: 500,
      contasPagar: [],
    },
    contasCriar: [],
    contasRemover: [{ mes: '2026-05', contaId: 'CP-PC-OLD-0000' }],
  };

  const response = await handlers.financeSyncCompra(payload, context);

  assert.equal(response.success, true);
  assert.equal(persisted['financas/pagar/2026-05/CP-PC-OLD-0000'], undefined);
  assert.equal(persisted['pedidosCompra/PC-1776259657669'].numero, 'PC-1001');
});

test('callable financeSyncCompra rejeita valores invalidos antes de gravar', async () => {
  const { handlers, persisted, context } = createPurchaseSyncHarness();
  const base = {
    operationId: 'purchase-sync-invalid-0001',
    pedido: {
      id: 'PC-1776259657669',
      numero: 'PC-1001',
      data: '2026-05-20',
      status: 'aprovado',
      fornecedor: { id: 'supplier-a', nome: 'Fornecedor A' },
      itens: [{ id: 1, tipo: 'manual', produtoNome: 'MADEIRA', quantidade: 10, precoUnitario: 50, total: 500 }],
      total: 500,
    },
    contasCriar: [{
      id: 'CP-PC-1776259657669-0',
      fornecedor: 'Fornecedor A',
      descricao: 'Compra',
      valor: 0,
      valorOriginal: 0,
      valorRestante: 0,
      dataVencimento: '2026-05-25',
      status: 'pendente',
    }],
    contasRemover: [],
  };

  await assert.rejects(
    handlers.financeSyncCompra(base, context),
    (error) => error.code === 'invalid-argument' && /positivo/.test(error.message),
  );
  assert.equal(persisted['pedidosCompra/PC-1776259657669'], undefined);
  assert.equal(persisted['financas/pagar/2026-05/CP-PC-1776259657669-0'], undefined);
});

test('callable financeSyncCompra rejeita dataVencimento fora do formato esperado', async () => {
  const { handlers, context } = createPurchaseSyncHarness();
  const payload = {
    operationId: 'purchase-sync-date-0001',
    pedido: {
      id: 'PC-1776259657669',
      numero: 'PC-1001',
      data: '2026-05-20',
      status: 'aprovado',
      fornecedor: { id: 'supplier-a', nome: 'Fornecedor A' },
      total: 100,
    },
    contasCriar: [{
      id: 'CP-PC-1776259657669-0',
      fornecedor: 'Fornecedor A',
      descricao: 'Compra',
      valor: 100,
      valorOriginal: 100,
      valorRestante: 100,
      dataVencimento: '25/05/2026',
      status: 'pendente',
    }],
    contasRemover: [],
  };

  await assert.rejects(
    handlers.financeSyncCompra(payload, context),
    (error) => error.code === 'invalid-argument' && /YYYY-MM-DD/.test(error.message),
  );
});

test('callable financeSyncVenda salva pedido e conta a receber atomicamente', async () => {
  const { handlers, persisted, context } = createPurchaseSyncHarness();
  const payload = {
    operationId: 'sale-sync-0001',
    pedido: {
      id: 'PV-1776259657669',
      numero: 'PV-2001',
      data: '2026-06-15',
      status: 'aprovado',
      cliente: { id: 'client-a', nome: 'Cliente A' },
      clienteId: 'client-a',
      total: 250,
    },
    contasCriar: [{
      id: 'CR_PV-1776259657669_001',
      cliente: { id: 'client-a', nome: 'Cliente A' },
      descricao: 'Venda - Pedido PV-2001',
      valor: 250,
      valorOriginal: 250,
      valorRestante: 250,
      dataVencimento: '2026-06-25',
      status: 'pendente',
      tipoPagamento: 'boleto',
    }],
    contasRemover: [],
  };

  const result = await handlers.financeSyncVenda(payload, context);
  assert.equal(result.success, true);
  assert.equal(result.pedidoId, 'PV-1776259657669');
  assert.ok(persisted['vendas/pedidos/PV-1776259657669']);
  assert.ok(persisted['pedidosVenda/PV-1776259657669']);
  assert.equal(persisted['vendas/pedidos/PV-1776259657669'].numero, 'PV-2001');
  const conta = persisted['financas/receber/2026-06/CR_PV-1776259657669_001'];
  assert.ok(conta);
  assert.equal(conta.valor, 250);
  assert.equal(conta.tipo, 'receber');
  assert.equal(conta.origemId, 'PV-1776259657669');
  assert.equal(conta.clienteId, 'client-a');
});

test('callable financeSyncVenda remove contas vinculadas e substitui em edicao', async () => {
  const { handlers, persisted, context } = createPurchaseSyncHarness();
  persisted['financas/receber/2026-06/CR_PV-1776259657669_001'] = {
    id: 'CR_PV-1776259657669_001',
    valor: 250,
    origemId: 'PV-1776259657669',
  };

  const payload = {
    operationId: 'sale-sync-edit-0001',
    pedido: {
      id: 'PV-1776259657669',
      numero: 'PV-2001',
      data: '2026-07-10',
      status: 'aprovado',
      cliente: { id: 'client-a', nome: 'Cliente A' },
      clienteId: 'client-a',
      total: 300,
    },
    contasCriar: [{
      id: 'CR_PV-1776259657669_001',
      cliente: { id: 'client-a', nome: 'Cliente A' },
      descricao: 'Venda - Pedido PV-2001 - Parcela 1/1',
      valor: 300,
      valorOriginal: 300,
      valorRestante: 300,
      dataVencimento: '2026-07-20',
      status: 'pendente',
      tipoPagamento: 'pix',
    }],
    contasRemover: [{
      mes: '2026-06',
      contaId: 'CR_PV-1776259657669_001',
    }],
  };

  const result = await handlers.financeSyncVenda(payload, context);
  assert.equal(result.success, true);
  assert.equal(persisted['financas/receber/2026-06/CR_PV-1776259657669_001'], undefined);
  assert.equal(persisted['financas/receber/2026-07/CR_PV-1776259657669_001'].valor, 300);
});
