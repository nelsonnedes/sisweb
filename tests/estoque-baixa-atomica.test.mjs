import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { __test } = require('../functions/finance-functions.js');

const {
  applyEstoqueBaixa,
  applyEstoqueEstorno,
  createHandlers,
  normalizeEstoqueMovementRequest,
} = __test;

const FIXED_NOW = '2026-10-14T12:00:00.000Z';

function createEstoqueHarness(seed = {}) {
  const snapshot = (value) => ({
    exists: () => value !== undefined && value !== null,
    val: () => value,
  });
  const clone = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
  const persisted = {};
  for (const [key, value] of Object.entries(seed)) persisted[key] = clone(value);
  const database = {
    ref(path) {
      return {
        async get() {
          if (path === 'companies/tenant-0001/users/member-0001') {
            return snapshot({ role: 'finance', active: true });
          }
          if (path === 'roles/member-0001') return snapshot(undefined);
          if (path === 'companies/tenant-0001/ownerUid') return snapshot(undefined);
          return snapshot(clone(persisted[path]));
        },
        async update(updates) {
          // chaves relativas ao ref (como no RTDB real)
          let node = persisted[path];
          if (node === undefined || node === null || typeof node !== 'object') {
            node = {};
            persisted[path] = node;
          }
          for (const [key, value] of Object.entries(updates)) {
            const parts = String(key).split('/');
            let target = node;
            for (let i = 0; i < parts.length - 1; i++) {
              if (target[parts[i]] === undefined || target[parts[i]] === null || typeof target[parts[i]] !== 'object') {
                target[parts[i]] = {};
              }
              target = target[parts[i]];
            }
            const leaf = parts[parts.length - 1];
            if (value === null) delete target[leaf];
            else target[leaf] = clone(value);
          }
          return null;
        },
        async remove() {
          delete persisted[path];
          return null;
        },
        async transaction(updateFn) {
          const current = clone(Object.hasOwn(persisted, path) ? persisted[path] : null);
          const next = updateFn(current);
          if (next === undefined) return { committed: false, snapshot: snapshot(clone(current)) };
          persisted[path] = clone(next);
          return { committed: true, snapshot: snapshot(clone(next)) };
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

function produtoSerrado() {
  return {
    id: 'P-SER-1',
    pecas: 10,
    volumeM3: 0.112,
    estoque: 0.112,
    metrosLineares: 30,
    largura: 15,
    comprimento: 300,
    updated: '2026-10-01T00:00:00.000Z',
  };
}

function movimentoBaixaSerradoUN() {
  return {
    produtoId: 'P-SER-1',
    modo: 'serrado',
    base: 'pecas',
    quantidade: 2,
    f: 0.8,
    consumir: { vol: 0.022, pecas: 2, est: 0 },
  };
}

test('normalize aceita baixa válida e rejeita payloads ruins', () => {
  const ok = normalizeEstoqueMovementRequest({
    operationId: 'baixa-PV123-1',
    kind: 'baixa',
    pedidoId: 'PV-123',
    movimentos: [movimentoBaixaSerradoUN()],
  });
  assert.equal(ok.operationId, 'baixa-PV123-1');
  assert.equal(ok.kind, 'baixa');
  assert.equal(ok.movimentos.length, 1);

  assert.throws(() => normalizeEstoqueMovementRequest({
    operationId: 'baixa-PV123-1', kind: 'baixa', pedidoId: 'PV-123', movimentos: [],
  }), /movimentos é obrigatório/);
  assert.throws(() => normalizeEstoqueMovementRequest({
    operationId: 'baixa-PV123-1',
    kind: 'baixa',
    pedidoId: 'PV-123',
    movimentos: [{ ...movimentoBaixaSerradoUN(), produtoId: 'a/b' }],
  }), /produtoId é inválido/);
  assert.throws(() => normalizeEstoqueMovementRequest({
    operationId: 'baixa-PV123-1',
    kind: 'baixa',
    pedidoId: 'PV-123',
    movimentos: [{ ...movimentoBaixaSerradoUN(), f: 1 }],
  }), /fator proporcional/);
  assert.throws(() => normalizeEstoqueMovementRequest({
    operationId: 'estorno-x', kind: 'estorno', pedidoId: 'PV-123',
  }), /baseOpId/);
  assert.throws(() => normalizeEstoqueMovementRequest({
    operationId: 'estorno-x', kind: 'estorno', pedidoId: 'PV-123',
    baseOpId: 'baixa-PV123-1', movimentos: [movimentoBaixaSerradoUN()],
  }), /registro da baixa original/);
});

test('applyEstoqueBaixa espelha a matemática do cliente (UN: 10pc/0.112m³ - 2pc)', () => {
  const decision = applyEstoqueBaixa(produtoSerrado(), movimentoBaixaSerradoUN(), FIXED_NOW);
  assert.equal(decision.status, 'ok');
  assert.equal(decision.product.pecas, 8);
  assert.ok(Math.abs(decision.product.volumeM3 - 0.09) < 0.001);
  assert.equal(decision.product.estoque, decision.product.volumeM3);
  assert.equal(decision.product.updated, FIXED_NOW);
});

test('applyEstoqueBaixa manual deduz estoque; sem saldo aborta insufficient', () => {
  const mov = {
    produtoId: 'P-MAN-1', modo: 'manual', base: 'est', quantidade: 12, f: 1,
    consumir: { vol: 0, pecas: 0, est: 12 },
  };
  const ok = applyEstoqueBaixa({ id: 'P-MAN-1', estoque: 24 }, mov, FIXED_NOW);
  assert.equal(ok.status, 'ok');
  assert.equal(ok.product.estoque, 12);
  const sem = applyEstoqueBaixa({ id: 'P-MAN-1', estoque: 5 }, mov, FIXED_NOW);
  assert.equal(sem.status, 'abort');
  assert.equal(sem.reason, 'insufficient');
  assert.equal(sem.disponivel, 5);
  assert.equal(sem.pedido, 12);
  const gone = applyEstoqueBaixa(null, mov, FIXED_NOW);
  assert.deepEqual([gone.status, gone.reason], ['abort', 'not-found']);
});

test('callable aplica baixa, grava registro e é idempotente no replay', async () => {
  const { handlers, persisted, context } = createEstoqueHarness({
    'companies/tenant-0001/produtos/P-SER-1': produtoSerrado(),
  });
  const payload = {
    operationId: 'baixa-PV2001-1',
    kind: 'baixa',
    pedidoId: 'PV-2001',
    movimentos: [movimentoBaixaSerradoUN()],
  };
  const first = await handlers.estoqueAplicarMovimento(payload, context);
  assert.equal(first.success, true);
  assert.equal(first.idempotent, false);
  assert.equal(persisted['companies/tenant-0001/produtos/P-SER-1'].pecas, 8);
  assert.equal(persisted['companies/tenant-0001/estoque/movimentos/baixa-PV2001-1'].status, 'aplicado');
  assert.equal(persisted['companies/tenant-0001/estoque/movimentos/baixa-PV2001-1'].efeito, 'deduziu');

  const replay = await handlers.estoqueAplicarMovimento(payload, context);
  assert.equal(replay.success, true);
  assert.equal(replay.idempotent, true);
  assert.equal(persisted['companies/tenant-0001/produtos/P-SER-1'].pecas, 8);
});

test('segundo comprador concorrente falha fail-closed (failed-precondition)', async () => {
  const { handlers, persisted, context } = createEstoqueHarness({
    'companies/tenant-0001/produtos/P-SER-1': produtoSerrado(),
  });
  await handlers.estoqueAplicarMovimento({
    operationId: 'baixa-PV2001-1',
    kind: 'baixa',
    pedidoId: 'PV-2001',
    // Leva 9 das 10 peças (f=0.1).
    movimentos: [{
      produtoId: 'P-SER-1', modo: 'serrado', base: 'pecas', quantidade: 9, f: 0.1,
      consumir: { vol: 0.101, pecas: 9, est: 0 },
    }],
  }, context);
  assert.equal(persisted['companies/tenant-0001/produtos/P-SER-1'].pecas, 1);
  await assert.rejects(
    handlers.estoqueAplicarMovimento({
      operationId: 'baixa-PV2002-1',
      kind: 'baixa',
      pedidoId: 'PV-2002',
      movimentos: [movimentoBaixaSerradoUN()],
    }, context),
    (error) => {
      assert.equal(error.code, 'failed-precondition');
      assert.match(error.message, /SALDO_INSUFICIENTE:P-SER-1:disponivel=1:pedido=2/);
      return true;
    },
  );
  // Falha no meio não deixa parcial: claim liberada, estoque intacto (1 peça).
  assert.equal(persisted['companies/tenant-0001/estoque/movimentos/baixa-PV2002-1'], undefined);
  assert.equal(persisted['companies/tenant-0001/produtos/P-SER-1'].pecas, 1);
});

test('estorno inverte a baixa (round-trip) e estorno-de-estorno rededuz', async () => {
  const { handlers, persisted, context } = createEstoqueHarness({
    'companies/tenant-0001/produtos/P-SER-1': produtoSerrado(),
  });
  await handlers.estoqueAplicarMovimento({
    operationId: 'baixa-PV2001-1', kind: 'baixa', pedidoId: 'PV-2001',
    movimentos: [movimentoBaixaSerradoUN()],
  }, context);
  const devolveu = await handlers.estoqueAplicarMovimento({
    operationId: 'estorno-baixa-PV2001-1', kind: 'estorno', pedidoId: 'PV-2001',
    baseOpId: 'baixa-PV2001-1',
  }, context);
  assert.equal(devolveu.success, true);
  const apos = persisted['companies/tenant-0001/produtos/P-SER-1'];
  assert.equal(apos.pecas, 10);
  assert.ok(Math.abs(apos.volumeM3 - 0.112) < 0.002);
  assert.equal(
    persisted['companies/tenant-0001/estoque/movimentos/estorno-baixa-PV2001-1'].efeito,
    'devolveu',
  );
  // Replay do estorno é idempotente (não devolve de novo).
  await handlers.estoqueAplicarMovimento({
    operationId: 'estorno-baixa-PV2001-1', kind: 'estorno', pedidoId: 'PV-2001',
    baseOpId: 'baixa-PV2001-1',
  }, context);
  assert.equal(persisted['companies/tenant-0001/produtos/P-SER-1'].pecas, 10);
  // Compensação: estornar o estorno rededuz (caminho da compensação do save).
  const rededuziu = await handlers.estoqueAplicarMovimento({
    operationId: 'comp-estorno-baixa-PV2001-1', kind: 'estorno', pedidoId: 'PV-2001',
    baseOpId: 'estorno-baixa-PV2001-1',
  }, context);
  assert.equal(rededuziu.success, true);
  assert.equal(persisted['companies/tenant-0001/produtos/P-SER-1'].pecas, 8);
});

test('estorno legado (sem registro) aplica inverso dos movimentos enviados', async () => {
  const { handlers, persisted, context } = createEstoqueHarness({
    'companies/tenant-0001/produtos/P-SER-1': { ...produtoSerrado(), pecas: 8, volumeM3: 0.09, estoque: 0.09 },
  });
  const res = await handlers.estoqueAplicarMovimento({
    operationId: 'estorno-leg-PV1999-1-a1b2c3',
    kind: 'estorno',
    legacy: true,
    pedidoId: 'PV-1999',
    movimentos: [movimentoBaixaSerradoUN()],
  }, context);
  assert.equal(res.success, true);
  assert.equal(persisted['companies/tenant-0001/produtos/P-SER-1'].pecas, 10);
});

test('claim em_processamento bloqueia; após TTL permite takeover', async () => {
  const stale = new Date(Date.parse(FIXED_NOW) - 11 * 60 * 1000).toISOString();
  const { handlers, persisted, context } = createEstoqueHarness({
    'companies/tenant-0001/produtos/P-SER-1': produtoSerrado(),
    'companies/tenant-0001/estoque/movimentos/baixa-PV2001-1': {
      status: 'em_processamento', kind: 'baixa', pedidoId: 'PV-2001',
      createdAt: stale, createdBy: 'member-0001',
    },
  });
  const payload = {
    operationId: 'baixa-PV2001-1', kind: 'baixa', pedidoId: 'PV-2001',
    movimentos: [movimentoBaixaSerradoUN()],
  };
  const took = await handlers.estoqueAplicarMovimento(payload, context);
  assert.equal(took.success, true);
  assert.equal(persisted['companies/tenant-0001/produtos/P-SER-1'].pecas, 8);

  const fresh = new Date(Date.parse(FIXED_NOW) - 60 * 1000).toISOString();
  const second = createEstoqueHarness({
    'companies/tenant-0001/produtos/P-SER-1': produtoSerrado(),
    'companies/tenant-0001/estoque/movimentos/baixa-PV2002-1': {
      status: 'em_processamento', kind: 'baixa', pedidoId: 'PV-2002',
      createdAt: fresh, createdBy: 'member-0001',
    },
  });
  await assert.rejects(
    second.handlers.estoqueAplicarMovimento({
      operationId: 'baixa-PV2002-1', kind: 'baixa', pedidoId: 'PV-2002',
      movimentos: [movimentoBaixaSerradoUN()],
    }, second.context),
    (error) => {
      assert.equal(error.code, 'aborted');
      return true;
    },
  );
});

test('permitirNegativo explícito deduz sem trava (política do tenant)', async () => {
  const { handlers, persisted, context } = createEstoqueHarness({
    'companies/tenant-0001/produtos/P-SER-1': { ...produtoSerrado(), pecas: 1, volumeM3: 0.011, estoque: 0.011 },
  });
  const res = await handlers.estoqueAplicarMovimento({
    operationId: 'baixa-PV2003-1', kind: 'baixa', pedidoId: 'PV-2003',
    permitirNegativo: true,
    movimentos: [movimentoBaixaSerradoUN()],
  }, context);
  assert.equal(res.success, true);
  // Sem a trava, o fator aplica sobre o saldo curto (1 peça x f=0.8).
  assert.equal(persisted['companies/tenant-0001/produtos/P-SER-1'].pecas, 1);
  assert.ok(persisted['companies/tenant-0001/produtos/P-SER-1'].volumeM3 < 0.011);
  assert.equal(
    persisted['companies/tenant-0001/estoque/movimentos/baixa-PV2003-1'].permitirNegativo,
    true,
  );
});
