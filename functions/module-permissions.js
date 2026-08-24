'use strict';

/**
 * module-permissions.js — Dicionário canônico de permissões por módulo + helpers.
 *
 * Infraestrutura central de RBAC por módulo (além do Finance). Fase 1: define o
 * dicionário, normalização e resolução de permissões efetivas por papel, SEM
 * alterar regras RTDB (para não quebrar acesso de membros existentes).
 *
 * Convenção da chave de módulo (mesmo padrão do Finance):
 *   - booleano `true`  → habilita leitura+escrita+gestão.
 *   - objeto `{ enabled?, read?, write?, manage? }` → granular.
 *
 * Uso (backend):
 *   const { resolveMemberModulePermissions, MODULE_PERMISSIONS } = require('./module-permissions');
 */

const MODULE_PERMISSIONS = Object.freeze({
  finance: Object.freeze({ label: 'Financeiro', aliases: Object.freeze(['financas', 'financial']) }),
  sales: Object.freeze({ label: 'Vendas', aliases: Object.freeze([]) }),
  purchases: Object.freeze({ label: 'Compras', aliases: Object.freeze(['purchase']) }),
  inventory: Object.freeze({ label: 'Estoque de produtos', aliases: Object.freeze(['stock_products']) }),
  stock: Object.freeze({ label: 'Estoque de toras', aliases: Object.freeze(['logs']) }),
  payroll: Object.freeze({ label: 'Folha de pagamento', aliases: Object.freeze(['folha']) }),
  fiscal: Object.freeze({ label: 'Fiscal / NF-e', aliases: Object.freeze(['nfe', 'nf']) }),
  romaneios: Object.freeze({ label: 'Romaneios', aliases: Object.freeze(['romaneio']) }),
  clients: Object.freeze({ label: 'Clientes', aliases: Object.freeze(['customer']) }),
  suppliers: Object.freeze({ label: 'Fornecedores', aliases: Object.freeze(['supplier', 'fornecedor']) }),
  products: Object.freeze({ label: 'Produtos', aliases: Object.freeze(['product']) }),
  species: Object.freeze({ label: 'Espécies', aliases: Object.freeze(['especies', 'especie']) }),
  config: Object.freeze({ label: 'Configurações / preferências', aliases: Object.freeze(['settings', 'preferences']) }),
});

const MODULE_KEYS = Object.freeze(Object.keys(MODULE_PERMISSIONS));

// Papéis que têm acesso total a todos os módulos (retrocompatível com o modelo atual).
const FULL_ACCESS_ROLES = Object.freeze(new Set(['owner', 'admin', 'company_admin']));
// Papéis financeiros (padrão Finance atual).
const FINANCE_ROLES = Object.freeze(new Set(['finance', 'financial', 'financeiro']));

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Normaliza uma chave de permissão (true | {read,write,manage,enabled}) para o
 * objeto canônico { enabled, read, write, manage } com booleans.
 */
function normalizeModuleEntry(entry) {
  if (entry === true) {
    return { enabled: true, read: true, write: true, manage: true };
  }
  if (!isPlainObject(entry)) {
    return { enabled: false, read: false, write: false, manage: false };
  }
  const enabled = entry.enabled === true || entry.write === true || entry.manage === true;
  return {
    enabled,
    read: entry.read === true || enabled,
    write: entry.write === true || entry.manage === true,
    manage: entry.manage === true,
  };
}

/**
 * Mapa de alias → chave canônica de módulo (resolve `financas` → `finance`).
 */
function resolveModuleKey(key) {
  if (typeof key !== 'string' || key.trim() === '') return '';
  const k = key.trim().toLowerCase();
  if (MODULE_KEYS.includes(k)) return k;
  for (const canonical of MODULE_KEYS) {
    if (MODULE_PERMISSIONS[canonical].aliases.includes(k)) return canonical;
  }
  return '';
}

/**
 * Normaliza um objeto de `permissions` (usuário) contra o dicionário, retornando
 * SOMENTE chaves válidas de módulo, cada uma normalizada para o objeto canônico.
 * Chaves fora do dicionário são descartadas (não inventar permissões).
 */
function normalizePermissions(permissions) {
  const source = isPlainObject(permissions) ? permissions : {};
  const result = {};
  for (const rawKey of Object.keys(source)) {
    const canonical = resolveModuleKey(rawKey);
    if (!canonical) continue;
    result[canonical] = normalizeModuleEntry(source[rawKey]);
  }
  return result;
}

/**
 * Retorna as permissões padrão de um papel (piso, nunca revogatório).
 * - owner/admin/company_admin → todas as chaves habilitadas (mantém acesso atual).
 * - finance/financial/financeiro → só finance habilitada (mantém comportamento atual).
 * - outros papéis → nenhuma chave habilitada (sem inventar; admin pode conceder depois).
 */
function defaultPermissionsForRole(role) {
  const r = String(role || '').trim().toLowerCase();
  const result = {};
  if (FULL_ACCESS_ROLES.has(r)) {
    for (const mod of MODULE_KEYS) {
      result[mod] = { enabled: true, read: true, write: true, manage: true };
    }
    return result;
  }
  if (FINANCE_ROLES.has(r)) {
    result.finance = { enabled: true, read: true, write: true, manage: true };
    return result;
  }
  return result;
}

/**
 * Combina `permissions` explícitas do usuário com o padrão do papel (piso).
 * As permissões explícitas têm precedência (não revogam o que o papel já dá),
 * e são mescladas: papel dá o piso; explícitas podem adicionar/extender.
 */
function resolveMemberModulePermissions(record) {
  const role = String(
    (record && (record.role || record.profileRole)) || 'other',
  ).trim().toLowerCase();
  const explicit = normalizePermissions(
    (record && record.permissions) || (record && record.adminPermissions),
  );
  const base = defaultPermissionsForRole(role);
  const merged = {};
  for (const mod of MODULE_KEYS) {
    // para papéis full access, mantém habilitado
    if (base[mod]) {
      merged[mod] = base[mod];
    } else if (explicit[mod]) {
      merged[mod] = explicit[mod];
    }
  }
  return merged;
}

/**
 * Verifica se um registro de usuário tem permissão para um módulo + ação.
 * action: 'read' | 'write' | 'manage' | 'enabled' (default 'read').
 */
function modulePermissionAllows(record, moduleKey, action = 'read') {
  const resolved = resolveMemberModulePermissions(record);
  const entry = resolved[moduleKey];
  if (!entry) return false;
  if (action === 'enabled') return entry.enabled === true;
  return entry[action] === true || entry.enabled === true;
}

/**
 * Verifica se a chave de módulo é válida (está no dicionário) OU é alias.
 */
function isValidModuleKey(key) {
  return resolveModuleKey(key) !== '';
}

module.exports = {
  MODULE_PERMISSIONS,
  MODULE_KEYS,
  FULL_ACCESS_ROLES,
  FINANCE_ROLES,
  isPlainObject,
  normalizeModuleEntry,
  resolveModuleKey,
  normalizePermissions,
  defaultPermissionsForRole,
  resolveMemberModulePermissions,
  modulePermissionAllows,
  isValidModuleKey,
};
