'use strict';

/**
 * module-permissions-functions.js — Callables de RBAC por módulo (Fase 1).
 *
 * Apenas infraestrutura aditiva: define/atribui/backfill as permissões de módulo
 * dos membros. NÃO altera as regras RTDB (para não quebrar acesso existente).
 *
 * Reusa helpers de functions/module-permissions.js.
 */

const admin = require('firebase-admin');
const functionsV1 = require('firebase-functions/v1');
const {
  MODULE_KEYS,
  normalizePermissions,
  resolveMemberModulePermissions,
  isValidModuleKey,
} = require('./module-permissions');

let isCallerSuperAdmin = async () => false;

function configure(options = {}) {
  if (typeof options.isCallerSuperAdmin === 'function') {
    isCallerSuperAdmin = options.isCallerSuperAdmin;
  }
}

function enforceAuth(context) {
  if (!context || !context.auth || !context.auth.uid) {
    throw new functionsV1.https.HttpsError('unauthenticated', 'Autenticação necessária.');
  }
}

async function assertSuperAdmin(context) {
  const allowed = await isCallerSuperAdmin(context);
  if (!allowed) {
    throw new functionsV1.https.HttpsError('permission-denied', 'Apenas superadmin pode executar esta operação.');
  }
}

/**
 * setMemberModulePermissions({ tenantId, userId, permissions })
 * Define (e mescla) as permissões de módulo de um membro específico do tenant.
 * Superadmin-only. Valida as chaves contra o dicionário (não inventa).
 */
function setMemberModulePermissions(data, context) {
  enforceAuth(context);
  return assertSuperAdmin(context).then(async () => {
    const payload = data || {};
    const tenantId = String(payload.tenantId || '');
    const userId = String(payload.userId || '');
    if (!tenantId || !userId) {
      throw new functionsV1.https.HttpsError('invalid-argument', 'tenantId e userId são obrigatórios.');
    }
    const normalized = normalizePermissions(payload.permissions || {});
    if (Object.keys(normalized).length === 0 && Object.keys(payload.permissions || {}).length > 0) {
      throw new functionsV1.https.HttpsError('invalid-argument', 'Nenhuma chave de módulo válida fornecida.');
    }

    const memberRef = admin.database().ref(`companies/${tenantId}/users/${userId}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists()) {
      throw new functionsV1.https.HttpsError('not-found', 'Membro não encontrado no tenant.');
    }
    const current = memberSnap.val() || {};
    const resolved = resolveMemberModulePermissions({ role: current.role, permissions: { ...(current.permissions || {}), ...normalized } });

    const outPermissions = {};
    for (const key of Object.keys(resolved)) {
      outPermissions[key] = resolved[key].enabled === true
        ? resolved[key]
        : resolved[key];
    }

    await memberRef.update({ permissions: outPermissions, updatedAt: new Date().toISOString() });

    // espelho em roles/{uid} para consistência com o padrão do sistema
    await admin.database().ref(`roles/${userId}`).update({ permissions: outPermissions, updatedAt: new Date().toISOString() });

    return { success: true, tenantId, userId, permissions: outPermissions };
  });
}

/**
 * applyDefaultModulePermissions({ tenantId })
 * Aplica (merge, idempotente) as permissões padrão por papel a TODOS os membros
 * do tenant, sem revogar permissões explícitas existentes. Superadmin-only.
 * Preparatório para a Fase 2 (adicionar exigência de permissions.* nas regras).
 */
function applyDefaultModulePermissions(data, context) {
  enforceAuth(context);
  return assertSuperAdmin(context).then(async () => {
    const payload = data || {};
    const tenantId = String(payload.tenantId || '');
    if (!tenantId) {
      throw new functionsV1.https.HttpsError('invalid-argument', 'tenantId é obrigatório.');
    }

    const usersSnap = await admin.database().ref(`companies/${tenantId}/users`).get();
    if (!usersSnap.exists()) {
      return { success: true, tenantId, updated: 0, applied: [] };
    }

    const users = usersSnap.val() || {};
    const targets = {};
    const applied = [];
    for (const uid of Object.keys(users)) {
      const record = users[uid] || {};
      const resolved = resolveMemberModulePermissions(record);
      const currentPerm = record.permissions || {};
      const merged = { ...currentPerm };
      for (const key of Object.keys(resolved)) {
        if (resolved[key].enabled === true || !merged[key]) merged[key] = resolved[key];
      }
      targets[uid] = merged;
      applied.push(uid);
    }

    const updates = {};
    for (const uid of Object.keys(targets)) {
      updates[`companies/${tenantId}/users/${uid}/permissions`] = targets[uid];
    }
    if (Object.keys(updates).length > 0) {
      await admin.database().ref('/').update(updates);
    }

    return { success: true, tenantId, updated: applied.length, applied };
  });
}

module.exports = {
  configure,
  setMemberModulePermissions: functionsV1.https.onCall(setMemberModulePermissions),
  applyDefaultModulePermissions: functionsV1.https.onCall(applyDefaultModulePermissions),
};
