'use strict';

const functionsV1 = require('firebase-functions/v1');
const admin = require('firebase-admin');
const {
  isPlainObject,
  modulePermissionAllows,
} = require('./module-permissions');

const ROMANEIO_TYPES = new Set(['tl', 'pct', 'pes', 'tora', 'pre_tl', 'pre_pct', 'pre_pes', 'pre_tora']);
const ACTIVE_SUBSCRIPTIONS = new Set(['active', 'trial_active']);
const INACTIVE_STATUSES = new Set(['inactive', 'inativo', 'blocked', 'bloqueado', 'disabled', 'suspended']);
const MAX_ROMANEIO_NUMERO = 999999;
const MAX_OPERATION_RECORDS = 512;

let configuredSuperAdminResolver = async () => false;

class RomaneioValidationError extends Error {
  constructor(message, reason = 'validation') {
    super(message);
    this.name = 'RomaneioValidationError';
    this.reason = reason;
  }
}

function normalizePathSegment(value, label) {
  const normalized = String(value === undefined || value === null ? '' : value).trim();
  if (!normalized) throw new RomaneioValidationError(`${label} é obrigatório.`);
  if (normalized.length > 160 || /[.#$\[\]/\u0000-\u001f\u007f]/.test(normalized)) {
    throw new RomaneioValidationError(`${label} é inválido.`);
  }
  return normalized;
}
function normalizeOperationId(value) {
  const operationId = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(operationId)) {
    throw new RomaneioValidationError('operationId deve ter de 8 a 128 caracteres alfanuméricos, "_" ou "-".');
  }
  return operationId;
}
function normalizeRomaneioType(value) {
  const tipo = String(value || '').trim().toLowerCase();
  if (!ROMANEIO_TYPES.has(tipo)) throw new RomaneioValidationError('tipo de romaneio inválido.');
  return tipo;
}
function normalizeRequest(data) {
  const payload = isPlainObject(data) ? data : {};
  return {
    tipo: normalizeRomaneioType(payload.tipo || payload.type),
    operationId: normalizeOperationId(payload.operationId),
    recordId: normalizePathSegment(payload.recordId || payload.id, 'recordId'),
  };
}
function pad(n) { return String(n).padStart(6, '0'); }

function buildRomaneioSequenceMutation(currentValue, request, nowIso) {
  const source = typeof currentValue === 'number'
    ? { current: currentValue }
    : (isPlainObject(currentValue) ? currentValue : {});
  if (source.operations !== undefined && !isPlainObject(source.operations)) {
    return { outcome: 'conflict', reason: 'invalid-remote-operations' };
  }
  const operations = source.operations || {};
  const prior = operations[request.operationId];
  if (prior) {
    if (prior.tipo === request.tipo && prior.recordId === request.recordId
      && typeof prior.numero === 'string' && Number.isSafeInteger(prior.current)) {
      return { outcome: 'idempotent', value: source, numero: prior.numero, current: prior.current };
    }
    return { outcome: 'conflict', reason: 'operation-reused' };
  }
  const current = source.current === undefined ? 0 : Number(source.current);
  if (!Number.isSafeInteger(current) || current < 0 || current >= MAX_ROMANEIO_NUMERO) {
    return { outcome: 'conflict', reason: 'invalid-sequence' };
  }
  const next = current + 1;
  if (next > MAX_ROMANEIO_NUMERO) return { outcome: 'conflict', reason: 'limit-reached' };
  const numero = pad(next);
  const nextOperations = {
    ...operations,
    [request.operationId]: {
      tipo: request.tipo,
      recordId: request.recordId,
      numero,
      current: next,
      completedAt: nowIso,
    },
  };
  const entries = Object.entries(nextOperations).slice(-MAX_OPERATION_RECORDS);
  return {
    outcome: 'commit',
    value: {
      ...source,
      current: next,
      last: numero,
      operations: Object.fromEntries(entries),
    },
    numero,
    current: next,
  };
}

function isInactiveAccessRecord(snapshot) {
  if (!snapshot || typeof snapshot.exists !== 'function' || !snapshot.exists()) return false;
  const value = snapshot.val();
  if (!isPlainObject(value)) return false;
  const status = String(value.status || value.accountStatus || '').trim().toLowerCase();
  return value.active === false || value.adminActive === false || value.enabled === false
    || value.disabled === true || INACTIVE_STATUSES.has(status);
}
function resolveAuthenticatedTenant(context) {
  if (!context || !context.auth || !context.auth.uid) {
    throw new RomaneioValidationError('Autenticação obrigatória.', 'unauthenticated');
  }
  const token = isPlainObject(context.auth.token) ? context.auth.token : {};
  if (!token.companyId) {
    throw new RomaneioValidationError('Tenant autenticado ausente no token.', 'permission-denied');
  }
  return {
    uid: String(context.auth.uid),
    companyId: normalizePathSegment(token.companyId, 'companyId do token'),
    subscriptionStatus: String(token.subscriptionStatus || '').trim().toLowerCase(),
  };
}
async function assertRomaneioAccess(context, db, isSuperAdmin) {
  const resolved = resolveAuthenticatedTenant(context);
  const superAdmin = await isSuperAdmin(context);
  if (!superAdmin && !ACTIVE_SUBSCRIPTIONS.has(resolved.subscriptionStatus)) {
    throw new RomaneioValidationError('Assinatura sem acesso ativo.', 'permission-denied');
  }
  const [memberSnapshot, roleSnapshot, ownerSnapshot] = await Promise.all([
    db.ref(`companies/${resolved.companyId}/users/${resolved.uid}`).get(),
    db.ref(`roles/${resolved.uid}`).get(),
    db.ref(`companies/${resolved.companyId}/ownerUid`).get(),
  ]);
  if (!superAdmin && (!memberSnapshot || !memberSnapshot.exists())) {
    throw new RomaneioValidationError('Membership não encontrada para o tenant.', 'permission-denied');
  }
  if (isInactiveAccessRecord(memberSnapshot) || isInactiveAccessRecord(roleSnapshot)) {
    throw new RomaneioValidationError('Membro ou perfil de acesso está inativo.', 'permission-denied');
  }
  if (!superAdmin) {
    const member = memberSnapshot.val();
    const role = roleSnapshot && roleSnapshot.exists() ? roleSnapshot.val() : null;
    const roleCompanyId = String(role && (role.companyId || role.companyID || role.tenantId) || '').trim();
    const roleMatches = !!roleCompanyId && roleCompanyId === resolved.companyId;
    const memberAccess = modulePermissionAllows(member, 'romaneios', 'write');
    const roleAccess = roleMatches && modulePermissionAllows(role, 'romaneios', 'write');
    const ownerAccess = ownerSnapshot && ownerSnapshot.exists()
      && String(ownerSnapshot.val() || '').trim() === resolved.uid;
    if (!memberAccess && !roleAccess && !ownerAccess) {
      throw new RomaneioValidationError('Permissão de romaneios não concedida para o membro.', 'permission-denied');
    }
  }
  return resolved;
}

function createHandlers(options = {}) {
  const database = options.database || (() => admin.database());
  const HttpsError = options.HttpsError || functionsV1.https.HttpsError;
  const isSuperAdmin = options.isSuperAdmin || (() => configuredSuperAdminResolver());
  const now = options.now || (() => new Date().toISOString());

  function throwInputAsHttps(error) {
    if (!(error instanceof RomaneioValidationError)) throw error;
    const code = error.reason === 'unauthenticated'
      ? 'unauthenticated'
      : (error.reason === 'permission-denied' ? 'permission-denied' : 'invalid-argument');
    throw new HttpsError(code, error.message);
  }
  async function runAuthorized(context, action) {
    try {
      const db = database();
      const access = await assertRomaneioAccess(context, db, isSuperAdmin);
      return await action(db, access);
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof RomaneioValidationError) throwInputAsHttps(error);
      throw new HttpsError('unavailable', 'Reserva de número de romaneio indisponível.');
    }
  }

  async function romaneioReservarNumero(data, context) {
    return runAuthorized(context, async (db, access) => {
      let request;
      try {
        request = normalizeRequest(data);
      } catch (error) {
        throwInputAsHttps(error);
      }
      const reference = db.ref(`companies/${access.companyId}/sequences/romaneios/${request.tipo}`);
      let decision;
      const transaction = await reference.transaction((current) => {
        decision = buildRomaneioSequenceMutation(current, request, now());
        return decision.outcome === 'commit' ? decision.value
          : (decision.outcome === 'idempotent' ? current : undefined);
      }, undefined, false);
      if (!decision) decision = { outcome: 'not-found' };
      if (decision.outcome === 'conflict' || !transaction.committed) {
        throw new HttpsError('aborted', 'Conflito na sequência de romaneios.');
      }
      const authoritative = transaction.snapshot && transaction.snapshot.val();
      const operation = authoritative && authoritative.operations
        && authoritative.operations[request.operationId];
      if (!operation || !operation.numero) {
        throw new HttpsError('internal', 'Sequência de romaneios sem confirmação autoritativa.');
      }
      return {
        success: true,
        tipo: request.tipo,
        numeroSequencial: operation.current,
        numeroFormatado: operation.numero,
        idempotent: decision.outcome === 'idempotent',
      };
    });
  }

  return { romaneioReservarNumero };
}

function configure(options = {}) {
  if (typeof options.isCallerSuperAdmin !== 'function') {
    throw new TypeError('isCallerSuperAdmin é obrigatório para configurar Romaneio Functions.');
  }
  configuredSuperAdminResolver = options.isCallerSuperAdmin;
}

const handlers = createHandlers();

exports.configure = configure;
exports.romaneioReservarNumero = functionsV1.https.onCall(handlers.romaneioReservarNumero);
exports.__test = {
  RomaneioValidationError,
  assertRomaneioAccess,
  buildRomaneioSequenceMutation,
  createHandlers,
  normalizeRequest,
  normalizeRomaneioType,
  resolveAuthenticatedTenant,
};