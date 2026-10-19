import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { __test } = require('../functions/romaneio-functions.js');
const {
  buildRomaneioSequenceMutation,
  normalizeRequest,
  normalizeRomaneioType,
  RomaneioValidationError,
} = __test;

const NOW = '2026-10-19T12:00:00.000Z';
const BASE = {
  tipo: 'tl',
  operationId: 'romaneio-tl-0001',
  recordId: 'TL_1778178288808_8wfqvkkt5',
};

test('primeiro número é 000001 e retry é idempotente', () => {
  const first = buildRomaneioSequenceMutation(null, BASE, NOW);
  assert.equal(first.outcome, 'commit');
  assert.equal(first.numero, '000001');
  assert.equal(first.current, 1);

  const retry = buildRomaneioSequenceMutation(first.value, BASE, NOW);
  assert.equal(retry.outcome, 'idempotent');
  assert.equal(retry.numero, '000001');
  assert.equal(retry.current, 1);
});

test('sequência avança e preserva operações anteriores', () => {
  const first = buildRomaneioSequenceMutation(null, BASE, NOW);
  const second = buildRomaneioSequenceMutation(first.value, {
    ...BASE,
    operationId: 'romaneio-tl-0002',
    recordId: 'TL_1778178288808_other',
  }, NOW);
  assert.equal(second.outcome, 'commit');
  assert.equal(second.numero, '000002');
  assert.equal(second.current, 2);
  assert.ok(second.value.operations['romaneio-tl-0001']);
  assert.ok(second.value.operations['romaneio-tl-0002']);
});

test('operationId reutilizado com outro registro/tipo gera conflito', () => {
  const first = buildRomaneioSequenceMutation(null, BASE, NOW);
  const conflict = buildRomaneioSequenceMutation(first.value, {
    ...BASE,
    recordId: 'TL_1778178288808_outro',
  }, NOW);
  assert.equal(conflict.outcome, 'conflict');
  assert.equal(conflict.reason, 'operation-reused');
});

test('limite 999999 é fail-closed', () => {
  const result = buildRomaneioSequenceMutation({ current: 999999, operations: {} }, BASE, NOW);
  assert.equal(result.outcome, 'conflict');
  assert.equal(result.reason, 'invalid-sequence');
  const atLimit = buildRomaneioSequenceMutation({ current: 999998, operations: {} }, BASE, NOW);
  assert.equal(atLimit.outcome, 'commit');
  assert.equal(atLimit.numero, '999999');
});

test('tipos válidos e rejeição de tipo desconhecido', () => {
  for (const tipo of ['tl', 'pct', 'pes', 'tora', 'pre_tl', 'pre_pct', 'pre_pes', 'pre_tora']) {
    assert.equal(normalizeRomaneioType(tipo), tipo);
  }
  assert.throws(() => normalizeRomaneioType('outro'), RomaneioValidationError);
});

test('normalizeRequest exige operação e registro', () => {
  const request = normalizeRequest(BASE);
  assert.equal(request.tipo, 'tl');
  assert.equal(request.operationId, BASE.operationId);
  assert.equal(request.recordId, BASE.recordId);
  assert.throws(() => normalizeRequest({ ...BASE, operationId: 'curto' }), RomaneioValidationError);
  assert.throws(() => normalizeRequest({ ...BASE, recordId: '' }), RomaneioValidationError);
});

function createHarness() {
  const persisted = { 'companies/t/sequences/romaneios/tl': null };
  const snap = (v) => ({ exists: () => v !== undefined && v !== null, val: () => v });
  const clone = (v) => v === undefined ? v : JSON.parse(JSON.stringify(v));
  const database = {
    ref(path) {
      return {
        async get() {
          if (path === 'companies/t/users/u1') return snap({ role: 'owner', active: true });
          if (path === 'roles/u1') return snap(undefined);
          if (path === 'companies/t/ownerUid') return snap('u1');
          return snap(clone(persisted[path]));
        },
        async transaction(fn) {
          const current = clone(persisted[path] === undefined ? null : persisted[path]);
          const next = fn(current);
          if (next === undefined) return { committed: false, snapshot: snap(current) };
          persisted[path] = clone(next);
          return { committed: true, snapshot: snap(next) };
        },
      };
    },
  };
  const handlers = __test.createHandlers({
    database: () => database,
    HttpsError: class extends Error { constructor(code, message) { super(message); this.code = code; } },
    isSuperAdmin: async () => false,
    now: () => NOW,
  });
  return { handlers, context: { auth: { uid: 'u1', token: { companyId: 't', subscriptionStatus: 'active' } } } };
}

test('callable reserva número no caminho do tenant e é idempotente', async () => {
  const { handlers, context } = createHarness();
  const payload = { tipo: 'tl', operationId: 'romaneio-tl-callable-1', recordId: 'TL_1' };
  const first = await handlers.romaneioReservarNumero(payload, context);
  assert.equal(first.success, true);
  assert.equal(first.numeroFormatado, '000001');
  const retry = await handlers.romaneioReservarNumero(payload, context);
  assert.equal(retry.idempotent, true);
  assert.equal(retry.numeroFormatado, '000001');
});
