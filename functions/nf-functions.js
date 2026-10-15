/**
 * nf-functions.js — Cloud Functions: Assinatura XML + Envio SEFAZ (Proxy mTLS)
 * Sisweb — NF-e Sistema Multi-Tenant
 *
 * DEPLOY: Adicionar ao index.js via:
 *   const nfFunctions = require('./nf-functions');
 *   exports.nf_assinarXML    = nfFunctions.nf_assinarXML;
 *   exports.nf_enviarSEFAZ   = nfFunctions.nf_enviarSEFAZ;
 *   exports.nf_consultarNFe  = nfFunctions.nf_consultarNFe;
 *   exports.nf_cancelarNFe   = nfFunctions.nf_cancelarNFe;
 *
 * DEPS NECESSÁRIAS (adicionar ao functions/package.json):
 *   "node-forge": "^1.3.1",
 *   "axios": "^1.6.0"
 */

'use strict';

const functions = require('firebase-functions');
const admin     = require('firebase-admin');
const crypto    = require('crypto');

function onFiscalCall(handler) {
  return functions.https.onCall(async (requestOrData, maybeContext) => {
    const isV2CallableRequest = requestOrData
      && typeof requestOrData === 'object'
      && Object.prototype.hasOwnProperty.call(requestOrData, 'data')
      && (
        Object.prototype.hasOwnProperty.call(requestOrData, 'auth')
        || Object.prototype.hasOwnProperty.call(requestOrData, 'rawRequest')
        || Object.prototype.hasOwnProperty.call(requestOrData, 'acceptsStreaming')
      );
    const data = isV2CallableRequest ? requestOrData.data : requestOrData;
    const context = isV2CallableRequest ? requestOrData : maybeContext;
    return handler(data || {}, context || {});
  });
}

// ─── Lazy-load node-forge (instalar antes do deploy) ──────────────────────
function getForge() {
  try { return require('node-forge'); }
  catch(e) { throw new Error('node-forge não instalado. Execute: cd functions && npm install node-forge'); }
}

// ─── SEFAZ Endpoints por ambiente e UF ────────────────────────────────────
const SEFAZ_EP = {
  homologacao: {
    NfeAutorizacao4:    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    NfeRetAutorizacao4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    NFeRecepcaoEvento4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NfeRecepcaoEvento4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NFeInutilizacao4:   'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
    NfeInutilizacao4:   'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  },
  producao: {
    NfeAutorizacao4:    'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    NfeRetAutorizacao4: 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo4: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
    NFeRecepcaoEvento4: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NfeRecepcaoEvento4: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NFeInutilizacao4:   'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
    NfeInutilizacao4:   'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
    // UF próprias
    SP: { NfeAutorizacao4: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx' },
    MG: { NfeAutorizacao4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4' },
  },
  // P5 SVC (catálogo NFePHP wsnfe_4.00, blocos SVCAN/SVCRS — homolog+produção,
  // todos os serviços; SVC-RS compartilha a infra/hosts do SVRS, distinguido
  // pelo tpEmis 6/7 no XML).
  'svc-an': {
    homologacao: {
      NfeAutorizacao4:    'https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
      NfeRetAutorizacao4: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
      NfeConsultaProtocolo4: 'https://hom.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
      NFeRecepcaoEvento4: 'https://hom.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
      NfeInutilizacao4:   'https://hom.sefazvirtual.fazenda.gov.br/NFeInutilizacao4/NFeInutilizacao4.asmx',
      NfeStatusServico4:  'https://hom.sefazvirtual.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx',
    },
    producao: {
      NfeAutorizacao4:    'https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx',
      NfeRetAutorizacao4: 'https://www.sefazvirtual.fazenda.gov.br/NFeRetAutorizacao4/NFeRetAutorizacao4.asmx',
      NfeConsultaProtocolo4: 'https://www.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx',
      NFeRecepcaoEvento4: 'https://www.sefazvirtual.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
      NfeInutilizacao4:   'https://www.sefazvirtual.fazenda.gov.br/NFeInutilizacao4/NFeInutilizacao4.asmx',
      NfeStatusServico4:  'https://www.sefazvirtual.fazenda.gov.br/NFeStatusServico4/NFeStatusServico4.asmx',
    },
  },
  'svc-rs': {
    homologacao: {
      NfeAutorizacao4:    'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      NfeRetAutorizacao4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
      NfeConsultaProtocolo4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      NFeRecepcaoEvento4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
      NfeInutilizacao4:   'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
      NfeStatusServico4:  'https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    },
    producao: {
      NfeAutorizacao4:    'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
      NfeRetAutorizacao4: 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
      NfeConsultaProtocolo4: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta/NfeConsulta4.asmx',
      NFeRecepcaoEvento4: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
      NfeInutilizacao4:   'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
      NfeStatusServico4:  'https://nfe.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx',
    },
  },
};

const UF_CODIGO_IBGE = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53'
};

const CCE_COND_USO = 'A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario; III - a data de emissao ou de saida.';

function getEndpoint(servico, ambiente, uf, tpEmis) {
  // P5: nota em contingência SVC vive no SVC (sem retransmissão à origem —
  // fonte: NFePHP Contingency): autorização, consulta, eventos e inutilização
  // usam o bloco svc-*. tpEmis ausente/inválido = rota normal (compatível).
  const svc = resolverAmbienteSVC(tpEmis);
  if (svc && SEFAZ_EP[svc] && SEFAZ_EP[svc][ambiente] && SEFAZ_EP[svc][ambiente][servico]) {
    return SEFAZ_EP[svc][ambiente][servico];
  }
  const env = SEFAZ_EP[ambiente] || SEFAZ_EP.homologacao;
  // UF própria?
  if (ambiente === 'producao' && env[uf] && env[uf][servico]) return env[uf][servico];
  return env[servico] || SEFAZ_EP.homologacao[servico];
}

// P5 Contingência SVC — mapa UF→ambiente autoritativo no backend (fonte:
// NFePHP Contingency.md; gêmea de exibição em nf-config.js SVC_POR_UF).
// Tenant pode forçar o tipo (override explícito), nunca inventado.
const SVC_POR_UF = {
  'AC': 'SVC-AN', 'AL': 'SVC-AN', 'AP': 'SVC-AN', 'CE': 'SVC-AN',
  'DF': 'SVC-AN', 'ES': 'SVC-AN', 'MG': 'SVC-AN', 'PA': 'SVC-AN',
  'PB': 'SVC-AN', 'PI': 'SVC-AN', 'RJ': 'SVC-AN', 'RN': 'SVC-AN',
  'RO': 'SVC-AN', 'RR': 'SVC-AN', 'RS': 'SVC-AN', 'SC': 'SVC-AN',
  'SE': 'SVC-AN', 'SP': 'SVC-AN', 'TO': 'SVC-AN',
  'AM': 'SVC-RS', 'BA': 'SVC-RS', 'GO': 'SVC-RS', 'MA': 'SVC-RS',
  'MS': 'SVC-RS', 'MT': 'SVC-RS', 'PE': 'SVC-RS', 'PR': 'SVC-RS',
};
function resolverTipoSVC(uf, override) {
  const fixo = String(override || '').trim().toUpperCase();
  if (fixo === 'SVC-AN' || fixo === 'SVC-RS') return fixo;
  return SVC_POR_UF[String(uf || '').trim().toUpperCase()] || '';
}
function resolverAmbienteSVC(tpEmis) {
  const t = String(tpEmis ?? '').trim();
  if (t === '6') return 'svc-an';
  if (t === '7') return 'svc-rs';
  return null;
}
// tpEmis persistido no registro da nota (fonte da verdade do roteamento);
// fallback = param explícito do cliente; default '1' (rota normal).
async function lerTpEmisNota(db, tenantId, modKey, nfId, fallback) {
  const fb = ['6', '7'].includes(String(fallback ?? '').trim()) ? String(fallback).trim() : '1';
  try {
    for (const ref of getFiscalNoteRefs(db, tenantId, modKey, nfId)) {
      const snap = await ref.get().catch(() => null);
      if (snap && snap.exists()) {
        const v = snap.val() || {};
        const t = String((v.ide && v.ide.tpEmis) ?? v.tpEmis ?? '').trim();
        if (t !== '') return t;
      }
    }
  } catch (_) {}
  return fb;
}

function sanitizePathSegment(value, fieldName) {
  const out = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(out)) {
    throw new functions.https.HttpsError('invalid-argument', `${fieldName} inválido`);
  }
  return out;
}

function normalizeCompanyCandidate(value) {
  return String(value || '').trim();
}

function hasTenantCandidate(source, tenantId) {
  if (!source || typeof source !== 'object') return false;
  const values = [
    source.companyId,
    source.companyID,
    source.tenantId,
    source.empresaId
  ].map(normalizeCompanyCandidate).filter(Boolean);
  return values.includes(tenantId);
}

// M4: allowlist de UID superadmin (mesmo padrao do core em index.js).
// Impede bypass de tenant via claim 'superadmin' forjado/inesperado.
const SUPER_ADMIN_UIDS = new Set(
  String(process.env.SUPERADMIN_UIDS || 'HfrQ6ObQq2aSEoeEE4Ng9jpAolB3')
    .split(/[,\s;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
);
function isSuperAdminUidAllowed(uid) {
  return !!uid && SUPER_ADMIN_UIDS.has(String(uid).trim());
}

async function assertTenantAccess(context, tenantId) {
  const uid = context && context.auth ? String(context.auth.uid || '') : '';
  const token = context && context.auth ? (context.auth.token || {}) : {};
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  if (token.superadmin === true && isSuperAdminUidAllowed(uid)) {
    return { uid, tenantId, superadmin: true, userData: {}, memberData: {} };
  }

  const db = admin.database();
  const [userSnap, memberSnap] = await Promise.all([
    db.ref(`users/${uid}`).get().catch(() => null),
    db.ref(`companies/${tenantId}/users/${uid}`).get().catch(() => null)
  ]);
  const userData = userSnap && userSnap.exists() && userSnap.val() && typeof userSnap.val() === 'object'
    ? userSnap.val()
    : {};
  const memberData = memberSnap && memberSnap.exists() && memberSnap.val() && typeof memberSnap.val() === 'object'
    ? memberSnap.val()
    : {};

  if (memberData.active === false || userData.adminActive === false || userData.accountStatus === 'blocked') {
    throw new functions.https.HttpsError('permission-denied', 'Usuário sem acesso ativo ao tenant fiscal.');
  }
  if (hasTenantCandidate(token, tenantId) || hasTenantCandidate(userData, tenantId) || memberSnap && memberSnap.exists()) {
    return { uid, tenantId, superadmin: false, userData, memberData };
  }
  throw new functions.https.HttpsError('permission-denied', 'Usuário não pertence ao tenant fiscal informado.');
}

function hasFiscalAdminPermission(access) {
  if (access && access.superadmin === true) return true;
  const sources = [access && access.userData, access && access.memberData].filter(Boolean);
  if (sources.some((source) => {
    const role = String(source.role || '').trim().toLowerCase();
    if (role === 'owner' || role === 'admin' || role === 'company_admin') return true;
    const permissions = source.permissions || source.adminPermissions || {};
    if (!permissions || typeof permissions !== 'object') return false;
    if (permissions.fiscal === true) return true;
    if (permissions.fiscal && (permissions.fiscal.write === true || permissions.fiscal.admin === true || permissions.fiscal.certificados === true)) return true;
    if (permissions.certificados === true) return true;
    if (permissions.certificados && (permissions.certificados.write === true || permissions.certificados.delete === true)) return true;
    return false;
  })) return true;
  return hasPrimaryFiscalCompanyAccountPermission(access);
}

function hasPrimaryFiscalCompanyAccountPermission(access) {
  if (!access || !access.uid || !access.tenantId) return false;
  const sources = [access.userData, access.memberData].filter((source) => source && typeof source === 'object');
  if (!sources.length) return false;
  const delegatedRole = sources.some((source) => {
    const role = String(source.role || '').trim().toLowerCase();
    return !!source.adminOwnerUid || role === 'sub_admin' || role === 'sub-user' || role === 'sub_user';
  });
  if (delegatedRole) return false;
  const activePrimaryAccount = sources.some((source) => {
    if (!hasTenantCandidate(source, access.tenantId)) return false;
    const sourceUid = String(source.uid || access.uid || '').trim();
    if (sourceUid && sourceUid !== access.uid) return false;
    const subscription = source.subscription && typeof source.subscription === 'object' ? source.subscription : {};
    const subscriptionStatus = String(source.subscriptionStatus || '').trim().toLowerCase();
    const accountStatus = String(source.accountStatus || '').trim().toLowerCase();
    return subscription.active === true
      || subscriptionStatus === 'active'
      || subscriptionStatus === 'trial_active'
      || accountStatus === 'active';
  });
  return activePrimaryAccount;
}

async function assertFiscalCertificateAdmin(context, tenantId) {
  const access = await assertTenantAccess(context, tenantId);
  if (!hasFiscalAdminPermission(access)) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas admin fiscal da empresa pode gerenciar certificado.');
  }
  return access;
}

async function assertFiscalConfigAdmin(context, tenantId) {
  const access = await assertTenantAccess(context, tenantId);
  if (!hasFiscalAdminPermission(access)) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas admin fiscal da empresa pode alterar configuração fiscal.');
  }
  return access;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function sanitizeFiscalText(value, fieldName, minLen, maxLen) {
  const out = String(value || '').trim().replace(/\s+/g, ' ');
  if (out.length < minLen || out.length > maxLen) {
    throw new functions.https.HttpsError('invalid-argument', `${fieldName} deve ter entre ${minLen} e ${maxLen} caracteres.`);
  }
  return out;
}

function escapeXml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function requireAccessKey(chave) {
  const out = onlyDigits(chave);
  if (!/^\d{44}$/.test(out)) {
    throw new functions.https.HttpsError('invalid-argument', 'Chave NF-e deve conter 44 dígitos.');
  }
  return out;
}

function requireCnpj(cnpjEmit) {
  const cnpj = onlyDigits(cnpjEmit);
  if (!/^\d{14}$/.test(cnpj)) {
    throw new functions.https.HttpsError('invalid-argument', 'CNPJ do emitente deve conter 14 dígitos.');
  }
  return cnpj;
}

function resolveCUFFromUf(ufEmit) {
  const uf = String(ufEmit || '').trim().toUpperCase();
  return UF_CODIGO_IBGE[uf] || '';
}

function resolveCUF({ chave, ufEmit, cUF }) {
  const explicit = onlyDigits(cUF);
  if (/^\d{2}$/.test(explicit)) return explicit;
  if (chave) {
    const key = onlyDigits(chave);
    if (/^\d{44}$/.test(key)) return key.slice(0, 2);
  }
  const byUf = resolveCUFFromUf(ufEmit);
  if (byUf) return byUf;
  throw new functions.https.HttpsError('invalid-argument', 'UF/cUF do emitente é obrigatório para o serviço fiscal.');
}

function toFiscalDateTime(date = new Date()) {
  const localBrazil = new Date(date.getTime() - (3 * 60 * 60 * 1000));
  return localBrazil.toISOString().replace(/\.\d{3}Z$/, '-03:00');
}

function getModKey(modelo) {
  return modelo == 65 ? 'nfce' : 'nfe';
}

function getFiscalNoteRefs(db, tenantId, modKey, nfId) {
  return [
    db.ref(`companies/${tenantId}/fiscal/notas/${modKey}/${nfId}`),
    db.ref(`tenants/${tenantId}/notas-fiscais/${modKey}/${nfId}`)
  ];
}

function getTenantCertificateStoragePrefix(tenantId) {
  return `tenants/${tenantId}/certificados/`;
}

function getCertificateMetadataRefs(db, tenantId) {
  return [
    db.ref(`companies/${tenantId}/fiscal/certificado`),
    db.ref(`tenants/${tenantId}/config-fiscal/certificado`)
  ];
}

async function loadCertificateMetadata(db, tenantId) {
  for (const ref of getCertificateMetadataRefs(db, tenantId)) {
    try {
      const snap = await ref.get();
      if (!snap.exists()) continue;
      const value = snap.val();
      if (value && typeof value === 'object') return value;
    } catch (_) {}
  }
  return {};
}

async function saveCertificateMetadata(db, tenantId, payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  await Promise.all(getCertificateMetadataRefs(db, tenantId).map((ref) => ref.set(data)));
  return data;
}

async function clearCertificateMetadata(db, tenantId) {
  await Promise.all(getCertificateMetadataRefs(db, tenantId).map((ref) => ref.remove().catch(() => {})));
}

function sanitizeOptionalCertificateText(value, fieldName, maxLen = 240) {
  const out = String(value || '').trim().replace(/\s+/g, ' ');
  if (!out) return '';
  if (out.length > maxLen) {
    throw new functions.https.HttpsError('invalid-argument', `${fieldName} excede ${maxLen} caracteres.`);
  }
  return out;
}

function sanitizeCertificateDate(value, fieldName) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', `${fieldName} inválida.`);
  }
  return parsed.toISOString();
}

function sanitizeLocalBridgeUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    throw new functions.https.HttpsError('invalid-argument', 'bridgeUrl inválida.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new functions.https.HttpsError('invalid-argument', 'bridgeUrl deve usar http ou https.');
  }
  const host = String(url.hostname || '').trim().toLowerCase();
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new functions.https.HttpsError('invalid-argument', 'bridgeUrl deve apontar para localhost/127.0.0.1.');
  }
  return url.toString().replace(/\/+$/, '');
}

function cloneJsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeObjects(target, source) {
  if (!isPlainObject(source)) return cloneJsonSafe(source);
  const out = isPlainObject(target) ? { ...target } : {};
  for (const key of Object.keys(source)) {
    const srcValue = source[key];
    if (isPlainObject(srcValue)) {
      out[key] = deepMergeObjects(out[key], srcValue);
    } else {
      out[key] = cloneJsonSafe(srcValue);
    }
  }
  return out;
}

function sanitizeFiscalObjectPayload(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new functions.https.HttpsError('invalid-argument', `${fieldName} deve ser um objeto.`);
  }
  return cloneJsonSafe(value);
}

async function loadFiscalConfig(db, tenantId) {
  const snap = await db.ref(`companies/${tenantId}/fiscal/config`).get().catch(() => null);
  if (!snap || !snap.exists()) return {};
  const value = snap.val();
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function buildNextFiscalConfig(currentConfig, incomingPatch, uid, options = {}) {
  const current = isPlainObject(currentConfig) ? currentConfig : {};
  const patch = sanitizeFiscalObjectPayload(incomingPatch, 'payload');
  const nowIso = new Date().toISOString();
  const next = deepMergeObjects(current, patch);
  next.createdAt = current.createdAt || patch.createdAt || nowIso;
  next.updatedAt = nowIso;
  next.updatedBy = uid;

  const trackedImpostos = options && options.trackedImpostos && isPlainObject(options.trackedImpostos)
    ? cloneJsonSafe(options.trackedImpostos)
    : (patch.impostos && isPlainObject(patch.impostos) ? cloneJsonSafe(patch.impostos) : null);
  if (trackedImpostos) {
    const vigencias = Array.isArray(current.vigencias) ? current.vigencias.slice(-49) : [];
    vigencias.push({
      inicio: nowIso,
      impostos: trackedImpostos
    });
    next.vigencias = vigencias;
  }

  if (options && options.section && isPlainObject(next[options.section])) {
    next[options.section] = {
      ...next[options.section],
      updatedAt: nowIso,
      updatedBy: uid
    };
  }

  return next;
}

function sanitizeCertificateReferenceInput(input, uid) {
  const source = input && typeof input === 'object' ? input : {};
  const tipo = String(source.tipo || '').trim().toLowerCase();
  const nowIso = new Date().toISOString();

  if (tipo === 'token' || tipo === 'a3' || tipo === 'a3_token') {
    const bridgeUrl = sanitizeLocalBridgeUrl(source.bridgeUrl || '');
    return {
      tipo: 'token',
      modo: 'local-bridge',
      bridgeRequired: true,
      status: 'aguardando_ponte_local',
      observacao: 'A3 Token/Cartão exige aplicativo local/Native Messaging/PKCS#11 para assinar NF-e.',
      bridgeUrl,
      bridgeUrlConfigured: !!bridgeUrl,
      middleware: sanitizeOptionalCertificateText(source.middleware || '', 'middleware', 240),
      updatedAt: nowIso,
      updatedBy: uid
    };
  }

  if (tipo === 'nuvem') {
    const cnpjCertificado = onlyDigits(source.cnpjCertificado || source.cnpjCert || '');
    if (cnpjCertificado && !/^\d{14}$/.test(cnpjCertificado)) {
      throw new functions.https.HttpsError('invalid-argument', 'CNPJ do certificado em nuvem deve conter 14 dígitos.');
    }
    return {
      tipo: 'nuvem',
      provedor: sanitizeOptionalCertificateText(source.provedor || '', 'provedor', 80),
      nomeProvedor: sanitizeOptionalCertificateText(source.nomeProvedor || '', 'nomeProvedor', 120),
      configuradoEm: sanitizeCertificateDate(source.configuradoEm || nowIso, 'configuradoEm') || nowIso,
      configuradoPor: sanitizeOptionalCertificateText(source.configuradoPor || uid || '', 'configuradoPor', 120),
      titular: sanitizeOptionalCertificateText(source.titular || '', 'titular', 240),
      validoAte: sanitizeCertificateDate(source.validoAte || '', 'validoAte'),
      cnpjCertificado,
      integracaoAtiva: source.integracaoAtiva === true,
      updatedAt: nowIso,
      updatedBy: uid
    };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Tipo de certificado não suportado para referência segura.');
}

function sanitizeCertificateCnpj(value) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  if (!/^\d{14}$/.test(digits)) {
    throw new functions.https.HttpsError('invalid-argument', 'CNPJ do certificado inválido.');
  }
  return digits;
}

function sanitizeOriginalFileName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 180);
}

function sanitizeTenantCertificateStorageRef(value, tenantId) {
  const raw = String(value || '').trim();
  const prefix = getTenantCertificateStoragePrefix(tenantId);
  if (!raw || raw.includes('..') || raw.includes('//')) return '';
  return raw.startsWith(prefix) ? raw : '';
}

function decodeBase64Payload(value, fieldName) {
  const raw = String(value || '').replace(/\s+/g, '');
  if (!raw) {
    throw new functions.https.HttpsError('invalid-argument', `${fieldName} obrigatório.`);
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(raw)) {
    throw new functions.https.HttpsError('invalid-argument', `${fieldName} inválido.`);
  }
  try {
    const buffer = Buffer.from(raw, 'base64');
    if (!buffer.length) throw new Error('empty');
    return buffer;
  } catch (_) {
    throw new functions.https.HttpsError('invalid-argument', `${fieldName} inválido.`);
  }
}

function sanitizeCertificateMetaInput(input) {
  const source = input && typeof input === 'object' ? input : {};
  const titular = sanitizeFiscalText(source.titular, 'Titular do certificado', 1, 200);
  const validoDe = sanitizeCertificateDate(source.validoDe, 'Data inicial do certificado');
  const validoAte = sanitizeCertificateDate(source.validoAte, 'Validade do certificado');
  const now = new Date();
  const diasRestantes = validoAte
    ? Math.ceil((new Date(validoAte).getTime() - now.getTime()) / 86400000)
    : 0;
  return {
    tipo: 'A1',
    titular,
    cnpjCert: sanitizeCertificateCnpj(source.cnpjCert || source.cnpj),
    emissor: sanitizeOptionalCertificateText(source.emissor, 'Emissor do certificado', 200),
    validoDe,
    validoAte,
    diasRestantes,
    serial: sanitizeOptionalCertificateText(source.serial, 'Serial do certificado', 200)
  };
}

function summarizeCertificateText(value, maxLen = 240) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLen);
}

function summarizeCertificateDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function summarizeCertificateNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : null;
}

function buildCertificatePublicSummary(meta, tenantId) {
  const source = meta && typeof meta === 'object' ? meta : {};
  const summary = {};
  const tipo = summarizeCertificateText(source.tipo, 40);
  if (!tipo) return null;

  summary.tipo = tipo;

  const modo = summarizeCertificateText(source.modo, 80);
  if (modo) summary.modo = modo;

  const status = summarizeCertificateText(source.status, 120);
  if (status) summary.status = status;

  const observacao = summarizeCertificateText(source.observacao, 320);
  if (observacao) summary.observacao = observacao;

  const titular = summarizeCertificateText(source.titular, 240);
  if (titular) summary.titular = titular;

  const emissor = summarizeCertificateText(source.emissor, 240);
  if (emissor) summary.emissor = emissor;

  const serial = summarizeCertificateText(source.serial, 240);
  if (serial) summary.serial = serial;

  const provedor = summarizeCertificateText(source.provedor, 120);
  if (provedor) summary.provedor = provedor;

  const nomeProvedor = summarizeCertificateText(source.nomeProvedor, 160);
  if (nomeProvedor) summary.nomeProvedor = nomeProvedor;

  const middleware = summarizeCertificateText(source.middleware, 240);
  if (middleware) summary.middleware = middleware;

  const cnpjCert = onlyDigits(source.cnpjCert || source.cnpjCertificado || '');
  if (cnpjCert) summary.cnpjCert = cnpjCert.slice(0, 14);

  const validoDe = summarizeCertificateDate(source.validoDe);
  if (validoDe) summary.validoDe = validoDe;

  const validoAte = summarizeCertificateDate(source.validoAte);
  if (validoAte) summary.validoAte = validoAte;

  const configuradoEm = summarizeCertificateDate(source.configuradoEm);
  if (configuradoEm) summary.configuradoEm = configuradoEm;

  const updatedAt = summarizeCertificateDate(source.updatedAt);
  if (updatedAt) summary.updatedAt = updatedAt;

  const uploadedAt = summarizeCertificateDate(source.uploadedAt);
  if (uploadedAt) summary.uploadedAt = uploadedAt;

  const diasRestantesInformado = summarizeCertificateNumber(source.diasRestantes);
  if (diasRestantesInformado !== null) {
    summary.diasRestantes = diasRestantesInformado;
  } else if (validoAte) {
    summary.diasRestantes = Math.ceil((new Date(validoAte).getTime() - Date.now()) / 86400000);
  }

  if (typeof summary.diasRestantes === 'number') {
    summary.expirado = summary.diasRestantes < 0;
    summary.proximoVencer = summary.diasRestantes <= 30;
  }

  if (source.bridgeRequired === true) summary.bridgeRequired = true;
  if (source.bridgeUrlConfigured === true || summarizeCertificateText(source.bridgeUrl, 240)) {
    summary.bridgeUrlConfigured = true;
  }
  if (source.integracaoAtiva === true) summary.integracaoAtiva = true;
  if (sanitizeTenantCertificateStorageRef(source.storageRef || source.path || source.filePath, tenantId)) {
    summary.storageConfigured = true;
  }

  return summary;
}

async function deleteTenantCertificateFiles(bucket, tenantId, keepPath = '') {
  const prefix = getTenantCertificateStoragePrefix(tenantId);
  const [files] = await bucket.getFiles({ prefix });
  let removed = 0;
  await Promise.all(files.map(async (file) => {
    if (keepPath && file.name === keepPath) return;
    await file.delete().catch(() => {});
    removed += 1;
  }));
  return removed;
}

async function updateFiscalNote(db, tenantId, modKey, nfId, patch) {
  await Promise.all(getFiscalNoteRefs(db, tenantId, modKey, nfId).map((ref) => ref.update(patch).catch(() => {})));
}

function normalizeSeqEvento(value, fallback = 1) {
  const seq = parseInt(value || fallback, 10);
  if (!Number.isFinite(seq) || seq < 1 || seq > 99) {
    throw new functions.https.HttpsError('invalid-argument', 'Sequência do evento deve estar entre 1 e 99.');
  }
  return seq;
}

// Decorrido desde a autorização p/ eventos (cancel/CC). Matemática pura — o
// LIMITE vem da config do tenant (prazosFiscais, null = sem bloqueio, pois
// nenhum valor aqui é regra oficial). Gêmea do cliente (avaliarPrazoEvento
// em nf-config.js) — manter sincronizadas.
function avaliarPrazoEventoFiscal(autorizadaEmIso, limiteHoras, agoraMs) {
  const ref = Date.parse(String(autorizadaEmIso || ''));
  if (!Number.isFinite(ref)) return { decorridoHoras: null, excedido: false, semReferencia: true };
  const agora = Number.isFinite(agoraMs) ? agoraMs : Date.now();
  const decorridoHoras = Math.max(0, (agora - ref) / 3600000);
  const limite = Number(limiteHoras);
  if (!Number.isFinite(limite) || limite <= 0) return { decorridoHoras, excedido: false, semReferencia: false };
  return { decorridoHoras, excedido: decorridoHoras > limite, semReferencia: false };
}

function formatarDecorridoHorasFiscal(decorridoHoras) {
  if (!Number.isFinite(decorridoHoras)) return 'período desconhecido';
  if (decorridoHoras < 1) return `há ${Math.max(1, Math.round(decorridoHoras * 60))} min`;
  if (decorridoHoras < 48) return `há ${Math.floor(decorridoHoras)}h${Math.round((decorridoHoras % 1) * 60)}min`;
  return `há ${Math.floor(decorridoHoras / 24)} dias`;
}

// ─── Descriptografar PFX salvo no Firebase (AES-GCM + PBKDF2) ────────────
async function descriptografarPFXdoStorage(tenantId, uid, senha) {
  const db = admin.database();
  const meta = await loadCertificateMetadata(db, tenantId);
  if (meta.tipo && meta.tipo !== 'A1') {
    throw new Error(`Certificado ${meta.tipo} não é suportado por esta assinatura A1. A3 Token/Cartão exige ponte local ou assinatura remota homologada.`);
  }
  // Tentar Storage primeiro, fallback ao DB
  let encBuffer;
  try {
    const bucket = admin.storage().bucket();
    const storageRef = sanitizeTenantCertificateStorageRef(meta.storageRef || meta.path || meta.filePath, tenantId);
    if (storageRef) {
      const [data] = await bucket.file(storageRef).download();
      encBuffer = data;
    } else {
      const [files] = await bucket.getFiles({ prefix: getTenantCertificateStoragePrefix(tenantId) });
      const certFile = files.find((file) => file.name.endsWith('.enc'));
      if (certFile) {
        const [data] = await certFile.download();
        encBuffer = data;
      }
    }
  } catch (_) {}

  if (!encBuffer) {
    // Fallback: ler do Realtime DB (base64)
    const snap = await db.ref(`tenants/${tenantId}/config-fiscal/certificado/pfxEnc`).get();
    if (!snap.exists()) {
      throw new Error('Certificado A1 não encontrado para esta empresa. Acesse Configuração > Certificado Digital e faça o upload do .pfx (A1).');
    }
    const b64 = snap.val();
    encBuffer = Buffer.from(b64, 'base64');
  }

  // Descriptografar AES-GCM + PBKDF2 (igual ao browser nf-cert.js)
  const salt       = encBuffer.slice(0, 16);
  const iv         = encBuffer.slice(16, 28);
  const ciphertext = encBuffer.slice(28);
  const keyOwnerUid = String(meta.uploadedBy || uid || '').trim();
  if (!keyOwnerUid) {
    throw new Error('Metadados do certificado não informam o usuário de criptografia.');
  }
  const keyMat     = crypto.pbkdf2Sync(keyOwnerUid + senha, salt, 100000, 32, 'sha256');
  const decipher   = crypto.createDecipheriv('aes-256-gcm', keyMat, iv);
  // Tag GCM é os últimos 16 bytes
  const tag        = ciphertext.slice(-16);
  const ct         = ciphertext.slice(0, -16);
  decipher.setAuthTag(tag);
  let pfx;
  try {
    pfx = Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch (e) {
    throw new Error('Falha ao descriptografar o certificado A1 — senha do certificado incorreta. Verifique a senha informada e tente novamente.');
  }
  return pfx;
}

// ─── Assinar XML com RSA-SHA1 (XMLDSIG — exigido pela SEFAZ) ─────────────
// Forma do DIGEST (C14N aproximada): a forma enviada + o xmlns herdado da raiz
// renderizado no elemento assinado quando ele não declara o próprio namespace.
// NF-e usa o default (nfe); MDF-e passa o seu via options.namespace — o digest
// precisa do namespace REAL do documento (cStat 297 se divergir).
function buildSignedHashForm(sentForm, tagName, namespace) {
  if (new RegExp(`^<${tagName}[^>]*\\sxmlns=`, 'i').test(sentForm)) return sentForm;
  return sentForm.replace(new RegExp(`^<${tagName}`, 'i'), `<${tagName} xmlns="${namespace}"`);
}

// Extração tolerante a prefixo/namespace (a SEFAZ varia conforme o lote —
// ex.: <ns2:tpEvento> ou tag com xmlns; regex rígida lia "indefinida" num
// MDF-e encerrado e permitia reencerramento). Autocontidas p/ extração em teste.
function extrairConteudoTag(body, localName) {
    const pattern = new RegExp(
        `<(?:[A-Za-z_][\\w:.-]*:)?${localName}(?:\\s[^>]*)?>([^<]*)<\\/(?:[A-Za-z_][\\w:.-]*:)?${localName}>`,
    );
    const m = String(body || '').match(pattern);
    return m ? m[1] : '';
}

function extrairBlocoTag(body, localName) {
    const pattern = new RegExp(
        `<(?:[A-Za-z_][\\w:.-]*:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w:.-]*:)?${localName}>`,
    );
    const m = String(body || '').match(pattern);
    return m ? m[1] : '';
}

// Índice onde a <Signature> deve ser inserida: ANTES do fechamento do PAI do
// elemento assinado (após eventuais irmãos completos — ex.: infMDFeSupl).
// O leiaute DFe exige a Signature como último filho do PAI:
//  - evento NF-e: dentro de <evento> (irmão de infEvento) — NÃO na raiz envEvento
//  - MDF-e: depois de infMDFeSupl (antes de </MDFe>)
//  - NFe/inut: último filho da raiz.
// Retorna -1 quando não encontra (chamador usa fallback legado).
// Parser próprio (sem indexOf no fechamento): respeita aspas em atributos
// (">" dentro de atributo não quebra) e conta profundidade em irmãos de
// mesmo nome aninhados. Autocontida p/ extração em teste (sem helpers externos).
function findSignatureInsertIndex(xml, fromIdx) {
    function fimTag(i) {
        let aspas = null;
        for (let k = i + 1; k < xml.length; k++) {
            const c = xml[k];
            if (aspas) {
                if (c === aspas) aspas = null;
                continue;
            }
            if (c === '"' || c === "'") { aspas = c; continue; }
            if (c === '>') return k + 1;
        }
        return -1;
    }
    function nomeTag(abertura, inicio, fim) {
        const m = abertura.slice(inicio, fim).match(/^\s*([A-Za-z_][\w:.-]*)/);
        return m ? m[1] : '';
    }
    function pularElemento(inicio, nome) {
        let profundidade = 1;
        let k = inicio;
        while (k < xml.length && profundidade > 0) {
            const lt = xml.indexOf('<', k);
            if (lt < 0) return -1;
            if (xml.startsWith('<!--', lt)) {
                const fim = xml.indexOf('-->', lt + 4);
                if (fim < 0) return -1;
                k = fim + 3;
                continue;
            }
            if (xml.startsWith('</', lt)) {
                const fim = fimTag(lt);
                if (fim < 0) return -1;
                if (nomeTag(xml, lt + 2, fim - 1) === nome) profundidade--;
                k = fim;
                continue;
            }
            if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) {
                const fim = fimTag(lt);
                if (fim < 0) return -1;
                k = fim;
                continue;
            }
            const fim = fimTag(lt);
            if (fim < 0) return -1;
            const interno = xml.slice(lt + 1, fim - 1);
            const autoFechada = /\/\s*$/.test(interno);
            if (!autoFechada && nomeTag(xml, lt + 1, fim - 1) === nome) profundidade++;
            k = fim;
        }
        return profundidade === 0 ? k : -1;
    }
    let i = fromIdx;
    while (i < xml.length) {
        while (i < xml.length && /\s/.test(xml[i])) i++;
        if (i >= xml.length) return -1;
        if (xml[i] !== '<') return -1;
        if (xml.startsWith('</', i)) return i;
        if (xml.startsWith('<!--', i)) {
            const fim = xml.indexOf('-->', i + 4);
            if (fim < 0) return -1;
            i = fim + 3;
            continue;
        }
        if (xml.startsWith('<?', i) || xml.startsWith('<!', i)) {
            const fim = fimTag(i);
            if (fim < 0) return -1;
            i = fim;
            continue;
        }
        const fim = fimTag(i);
        if (fim < 0) return -1;
        const interno = xml.slice(i + 1, fim - 1);
        if (/\/\s*$/.test(interno)) { i = fim; continue; }
        const nome = nomeTag(xml, i + 1, fim - 1);
        if (!nome) return -1;
        i = pularElemento(fim, nome);
        if (i < 0) return -1;
    }
    return -1;
}

function assinarXMLcomForge(xmlStr, pfxBuffer, senha, options = {}) {
  // Compactar ANTES de assinar: a assinatura cobre exatamente os bytes enviados
  // (SEFAZ rejeita whitespace entre tags — cStat 588 — e valida a assinatura).
  xmlStr = compactXml(xmlStr);
  const forge = getForge();
  const bytes  = pfxBuffer.toString('binary');
  const asn1   = forge.asn1.fromDer(bytes);
  const p12    = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  const tagName = options.tagName || 'infNFe';
  const idPrefix = options.idPrefix || 'NFe';

  // Extrair chave privada (fallback p/ keyBag simples) e o certificado-FOLHA
  // (o que casa com a chave privada — deve ir no KeyInfo, senão o RSA não
  // confere com o certificado embutido e a SEFAZ retorna 297).
  const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const plainKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBagArr  = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || plainKeyBags[forge.pki.oids.keyBag] || []);
  const certBagArr = (certBags[forge.pki.oids.certBag] || []);
  if (!keyBagArr.length)  throw new Error('Chave privada não encontrada no certificado A1.');
  if (!certBagArr.length) throw new Error('Certificado não encontrado no arquivo A1.');
  const privateKey = keyBagArr[0].key;
  const privModHex = privateKey && privateKey.n ? privateKey.n.toString(16) : '';
  const allCerts = certBagArr.map((b) => b.cert);
  const leafIdx = allCerts.findIndex((c) => c && c.publicKey && c.publicKey.n && c.publicKey.n.toString(16) === privModHex);
  const leafCert = leafIdx >= 0 ? allCerts[leafIdx] : allCerts[0];

  // Serializar certificado-FOLHA em base64 (KeyInfo deve trazer o signatário)
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(leafCert)).getBytes();
  const certB64 = Buffer.from(certDer, 'binary').toString('base64');

  // Localizar tag a assinar (infNFe, infEvento ou infInut) e seu Id
  const idPattern = new RegExp(`<${tagName}[^>]*\\sId="(${idPrefix}[^"]+)"[^>]*>`, 'i');
  const idMatch = xmlStr.match(idPattern);
  if (!idMatch) throw new Error(`Atributo Id="${idPrefix}..." não encontrado em <${tagName}>`);
  const refId = idMatch[1];

  // Forma ENVIADA: SEM xmlns redundante (cStat 587) e SEM &quot;/&apos;/&gt; em texto.
  // Forma do DIGEST (canônica): a enviada + o xmlns herdado renderizado (C14N).
  // As duas são C14N-equivalentes: o digest confere e o leiaute é aceito.
  const elementPattern = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i');
  const signedElementMatch = xmlStr.match(elementPattern);
  if (!signedElementMatch) throw new Error(`Elemento <${tagName}> não encontrado no XML`);
  const rawElement = signedElementMatch[0];
  const sentForm = rawElement
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&gt;/g, '>')
    .replace(/<([A-Za-z][\w:.-]*)([^>]*)\/>/g, '<$1$2></$1>');
  const namespace = options.namespace || 'http://www.portalfiscal.inf.br/nfe';
  const hashForm = buildSignedHashForm(sentForm, tagName, namespace);

  // SHA-1 da forma canônica
  const md = forge.md.sha1.create();
  md.update(hashForm, 'utf8');
  const digestB64 = Buffer.from(md.digest().bytes(), 'binary').toString('base64');

  // SignedInfo com tags de fechamento EXPLÍCITAS (sem self-closing).
  // O C14N expande <x/> para <x></x>; self-closing no bruto quebra o RSA (cStat 297).
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">`
    + `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>`
    + `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>`
    + `<Reference URI="#${refId}"><Transforms>`
    + `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>`
    + `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>`
    + `</Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>`
    + `<DigestValue>${digestB64}</DigestValue></Reference></SignedInfo>`;

  // Assinar SignedInfo com RSA-SHA1
  const mdSign = forge.md.sha1.create();
  mdSign.update(signedInfo, 'utf8');
  const sigBytes = privateKey.sign(mdSign);
  const sigB64   = Buffer.from(sigBytes, 'binary').toString('base64');

  // Bloco Signature
  const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">\
${signedInfo}\
<SignatureValue>${sigB64}</SignatureValue>\
<KeyInfo><X509Data><X509Certificate>${certB64}</X509Certificate></X509Data></KeyInfo>\
</Signature>`;

  // Documento final usa a FORMA ENVIADA (sem xmlns redundante, entidades
  // normalizadas — C14N). Replacer-function evita interpretar `$`.
  const xmlComSentForm = xmlStr.replace(signedElementMatch[0], () => sentForm);
  // Injetar Signature como ÚLTIMO filho do PAI do elemento assinado (ver
  // findSignatureInsertIndex): evento NF-e dentro de <evento> (não no envEvento
  // — sem isso a SEFAZ rejeita "Falha no schema XML (em envEvento/evento[1])");
  // MDF-e após infMDFeSupl; NFe/inut no fim da raiz. O Reference cobre apenas o
  // elemento assinado — a posição da Signature não altera o digest.
  const idxElementEnd = xmlComSentForm.indexOf(sentForm) + sentForm.length;
  const idxInsert = idxElementEnd > sentForm.length ? findSignatureInsertIndex(xmlComSentForm, idxElementEnd) : -1;
  const xmlAssinado = idxInsert >= 0
    ? xmlComSentForm.slice(0, idxInsert) + signature + xmlComSentForm.slice(idxInsert)
    : xmlComSentForm.replace(sentForm, () => `${sentForm}${signature}`);
  return xmlAssinado;
}

// ─── Wrapper SOAP para webservices SEFAZ ─────────────────────────────────
// SOAP 1.2 exige a "action" no Content-Type; a SEFAZ rejeita sem ela
// ("Unable to handle request without a valid action parameter").
const SOAP_ACTION_METHOD = {
  NfeConsultaProtocolo4: 'nfeConsultaNF', // catálogo NFePHP wsnfe (SVRS): method=nfeConsultaNF
  NFeAutorizacao4:       'nfeAutorizacaoLote',
  NFeRetAutorizacao4:    'nfeRetAutorizacaoLote',
  NFeRecepcaoEvento4:    'nfeRecepcaoEvento',
  NFeInutilizacao4:      'nfeInutilizacaoNF',
};
// Namespace da action/envelope = campo "operation" do WSDL (catálogo NFePHP
// wsnfe_4.00_mod55.xml, bloco SVRS): em geral coincide com o serviço lógico,
// mas a consulta é "NFeConsultaProtocolo4" (F maiúsculo). Evidência ao vivo:
// SOAP Fault "action not recognized" até o par operation/method exato.
const SOAP_ACTION_NS = {
  NfeConsultaProtocolo4: 'NFeConsultaProtocolo4',
};
function soapActionFor(servico) {
  const method = SOAP_ACTION_METHOD[servico];
  const ns = SOAP_ACTION_NS[servico] || servico;
  return method ? `http://www.portalfiscal.inf.br/nfe/wsdl/${ns}/${method}` : '';
}

// Remove a declaração <?xml ...?> (não pode aparecer embutida dentro de outro XML).
function stripXmlDecl(xml) {
  return String(xml || '').replace(/^\s*<\?xml[^>]*\?>\s*/i, '');
}

// SEFAZ (cStat 588) rejeita "caracteres de edição" entre tags → XML compacto.
function compactXml(xml) {
  return String(xml || '').replace(/>\s+</g, '><').trim();
}

function buildSoapEnvelope(servico, xmlNFe, versaoQrNfe = '4.00', cUF = '35') {
  const ns = SOAP_ACTION_NS[servico] || servico;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/${ns}">
  <soap:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${ns}">
    <cUF>${cUF}</cUF><cVersao>${versaoQrNfe}</cVersao>
  </nfeCabecMsg></soap:Header>
  <soap:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${ns}">${xmlNFe}</nfeDadosMsg></soap:Body>
</soap:Envelope>`;
}

// ─── HTTP SOAP POST para SEFAZ ────────────────────────────────────────────
async function postSefaz(url, soapBody, pfxBuffer, pfxSenha, action = '') {
  const https = require('https');
  const { URL } = require('url');

  const forge = getForge();
  const pfxStr = pfxBuffer.toString('binary');
  const asn1   = forge.asn1.fromDer(pfxStr);
  const p12    = forge.pkcs12.pkcs12FromAsn1(asn1, pfxSenha);

  const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const plainKeyBags = p12.getBags({ bagType: forge.pki.oids.keyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const keyBagArr  = (keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || plainKeyBags[forge.pki.oids.keyBag] || []);
  const certBagArr = certBags[forge.pki.oids.certBag] || [];
  if (!keyBagArr.length)  throw new Error('Chave privada não encontrada no certificado A1.');
  if (!certBagArr.length) throw new Error('Certificado não encontrado no arquivo A1.');
  const privKey = keyBagArr[0].key;
  const privKeyPem = forge.pki.privateKeyToPem(privKey);
  // ORDENAR a cadeia: o certificado-FOLHA (que casa com a chave privada) PRIMEIRO.
  // Caso contrário o OpenSSL falha com "x509 ... key values mismatch" no handshake.
  const privModHex = privKey && privKey.n ? privKey.n.toString(16) : '';
  const certs = certBagArr.map((b) => b.cert);
  const leafIdx = certs.findIndex((c) => c && c.publicKey && c.publicKey.n && c.publicKey.n.toString(16) === privModHex);
  const orderedCerts = leafIdx > 0 ? [certs[leafIdx], ...certs.filter((_, i) => i !== leafIdx)] : certs;
  const clientCertPems = orderedCerts.map((c) => forge.pki.certificateToPem(c));
  // CA para VALIDAR o certificado do SERVIDOR SEFAZ: a raiz ICP-Brasil não está no
  // trust store do Node, então usamos a cadeia do próprio PFX + as raízes padrão do Node.
  // (Corrige "unable to get local issuer certificate" no handshake mTLS.)
  let nodeRootCerts = [];
  try { nodeRootCerts = require('tls').rootCertificates || []; } catch (_) { nodeRootCerts = []; }
  const caList = Array.from(new Set([...clientCertPems, ...nodeRootCerts]));

  const parsed = new URL(url);

  function doRequest(rejectUnauthorized) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': action ? `application/soap+xml; charset=utf-8; action="${action}"` : 'application/soap+xml; charset=utf-8',
          'Content-Length': Buffer.byteLength(soapBody, 'utf8'),
        },
        key:  privKeyPem,
        // Só a folha em `cert` (casa com a chave privada); a cadeia vai em `ca`.
        cert: clientCertPems[0],
        ca:   caList,
        rejectUnauthorized,
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout SEFAZ (30s)')); });
      req.write(soapBody, 'utf8');
      req.end();
    });
  }

  try {
    // Padrão: valida o certificado do servidor (seguro).
    return await doRequest(true);
  } catch (e) {
    const msg = String((e && e.message) || '');
    // A raiz ICP-Brasil do servidor SEFAZ normalmente não está no trust store do Node.
    // Fallback: repetir SEM validar a cadeia do servidor — o mTLS (client cert) segue
    // autenticando a empresa junto à SEFAZ e o host é fixo/conhecido.
    if (/unable to (get local issuer|verify)|self.signed|issuer certificate|CERT_|UNABLE_TO_|DEPTH_ZERO|unsafe legacy/i.test(msg)) {
      functions.logger.warn('[postSefaz] Verificação TLS do servidor SEFAZ indisponível; repetindo sem validar a cadeia do servidor (mTLS mantido): ' + msg);
      return await doRequest(false);
    }
    throw e;
  }
}

// ─── Descrição amigável dos códigos de status (cStat) mais comuns ────────
const SEFAZ_CSTAT_DESC = {
  '100': 'NF-e autorizada',
  '101': 'Cancelamento homologado',
  '102': 'Inutilização homologada',
  '110': 'NF-e denegada',
  '135': 'Evento registrado e vinculado à NF-e',
  '136': 'Evento registrado (não vinculado)',
  '150': 'NF-e autorizada fora de prazo',
  '155': 'Cancelamento homologado fora de prazo',
  '204': 'Duplicidade de NF-e',
  '208': 'Chave de acesso do emitente ausente',
  '217': 'NF-e não consta na base de dados da SEFAZ',
  '225': 'Falha no schema XML',
  '226': 'Código da UF do emitente diverge do cadastro',
  '233': 'IE do destinatário não cadastrada',
  '236': 'Chave de acesso com dígito verificador inválido',
  '252': 'Ambiente informado diverge do cadastro da empresa',
  '539': 'Duplicidade de NF-e com diferença na chave de acesso',
  '562': 'Chave de acesso não confere com a UF',
  '580': 'Rejeição: parâmetro divergente',
  '593': 'Chave de acesso com assinatura inválida',
  '596': 'Chave de acesso não corresponde à UF do emitente',
  '614': 'Chave de acesso não corresponde ao emitente',
  '615': 'Chave de acesso divergente',
  '656': 'Consumo indevido (excesso de consultas)',
  '999': 'Erro de comunicação com a SEFAZ — resposta não interpretada',
};
function descreverCStat(cStat) {
  return SEFAZ_CSTAT_DESC[String(cStat || '').trim()] || '';
}

// ─── Parsear retorno SEFAZ (extrai cStat e xMotivo) ──────────────────────
// opts.first: pega o cStat do RETORNO PRINCIPAL (consSit*) — que é o PRIMEIRO
// do documento; o ÚLTIMO pode pertencer a um evento/protocolo interno (ex.:
// consulta de NF-e/MDF-e encerrado/cancelado devolvia 135 do evento de
// encerramento em vez do 100 do documento). Default 'last' preserva o
// comportamento de autorização (protNFe/protMDFe = status final do lote).
function parseSefazResponse(xmlResp, successCodes = ['100', '150'], opts = {}) {
  const xml = String(xmlResp || '');
  const cStatMatches = Array.from(xml.matchAll(/<cStat>(\d+)<\/cStat>/g)).map((m) => m[1]);
  const xMotivoMatches = Array.from(xml.matchAll(/<xMotivo>([^<]+)<\/xMotivo>/g)).map((m) => m[1]);
  const nProtMatch  = xml.match(/<nProt>(\d+)<\/nProt>/);
  const chNFeMatch  = xml.match(/<chNFe>(\d+)<\/chNFe>/);
  const dhRecbtoMatch = xml.match(/<dhRecbto>([^<]+)<\/dhRecbto>/);
  const cStatPick = opts.first ? 0 : cStatMatches.length - 1;
  const cStat = cStatMatches.length ? cStatMatches[cStatPick] : '999';
  const cStatIdxX = opts.first ? 0 : xMotivoMatches.length - 1;
  const xMotivo = xMotivoMatches.length ? xMotivoMatches[Math.max(0, Math.min(cStatIdxX, xMotivoMatches.length - 1))] : 'Resposta não parseada';
  return {
    cStat,
    xMotivo,
    nProt:   nProtMatch    ? nProtMatch[1]    : '',
    chNFe:   chNFeMatch    ? chNFeMatch[1]    : '',
    dhRecbto: dhRecbtoMatch ? dhRecbtoMatch[1] : '',
    autorizada: successCodes.includes(cStat),
    xmlRetorno: xmlResp,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 1: nf_assinarXML
// Assina o XML NF-e com o certificado A1 armazenado de forma segura
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_assinarXML = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, xml, senhaA1 } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  if (!xml)      throw new functions.https.HttpsError('invalid-argument', 'xml obrigatório');
  if (!senhaA1)  throw new functions.https.HttpsError('invalid-argument', 'senhaA1 obrigatório');

  // Verificar se o caller pertence ao tenant
  const { uid } = await assertTenantAccess(context, tenantId);

  try {
    const pfxBuffer  = await descriptografarPFXdoStorage(tenantId, uid, senhaA1);
    const xmlAssinado = assinarXMLcomForge(xml, pfxBuffer, senhaA1);
    return { xmlAssinado };
  } catch (e) {
    console.error('[nf_assinarXML] Erro:', e.message);
    throw new functions.https.HttpsError('internal', `Falha na assinatura: ${e.message}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 2: nf_enviarSEFAZ
// Envia NF-e assinada à SEFAZ via mTLS e persiste o retorno
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_enviarSEFAZ = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, nfId: rawNfId, modelo, xmlAssinado, senhaA1, ambiente } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  const nfId = sanitizePathSegment(rawNfId, 'nfId');
  if (!xmlAssinado || !senhaA1) {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId, nfId, xmlAssinado e senhaA1 são obrigatórios');
  }

  const { uid } = await assertTenantAccess(context, tenantId);
  const env    = ambiente === 'producao' ? 'producao' : 'homologacao';
  const modKey = modelo == 65 ? 'nfce' : 'nfe';
  const db     = admin.database();

  try {
    const pfxBuffer = await descriptografarPFXdoStorage(tenantId, uid, senhaA1);

    // Montar lote NF-e (envio individual)
    const loteXml = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${Date.now()}</idLote><indSinc>1</indSinc>${stripXmlDecl(xmlAssinado)}</enviNFe>`;

    // Extrair UF do XML assinado para roteamento SEFAZ correto por estado
    const ufEmitMatch = xmlAssinado.match(/<UF>([A-Z]{2})<\/UF>/);
    const ufEmit = ufEmitMatch ? ufEmitMatch[1] : 'SP';

    // P5: tpEmis do XML assinado decide o ambiente (SVC vive no SVC).
    const tpEmisEnvio = (xmlAssinado.match(/<tpEmis>(\d)<\/tpEmis>/) || [])[1] || '1';
    const url  = getEndpoint('NfeAutorizacao4', env, ufEmit, tpEmisEnvio);
    const chaveMatch = xmlAssinado.match(/Id="NFe(\d{44})"/);
    const cUF = resolveCUF({ chave: chaveMatch ? chaveMatch[1] : '', ufEmit });
    const soap = buildSoapEnvelope('NFeAutorizacao4', loteXml, '4.00', cUF);

    functions.logger.info(`[nf_enviarSEFAZ] Enviando NF ${nfId} | UF=${ufEmit} | Amb=${env} | tpEmis=${tpEmisEnvio} | URL=${url}`);
    const resp = await postSefaz(url, soap, pfxBuffer, senhaA1, soapActionFor('NFeAutorizacao4'));
    const ret  = parseSefazResponse(resp.body);

    functions.logger.info(`[nf_enviarSEFAZ] Retorno cStat=${ret.cStat} — ${ret.xMotivo}`);
    if (ret.cStat === '999') {
      functions.logger.warn(`[nf_enviarSEFAZ] Resposta não parseada | HTTP ${resp.status} | nfId=${nfId} | body: ${String(resp.body || '').slice(0, 900)}`);
    }

    // Persistir o XML ASSINADO no Storage (Admin SDK) — centraliza e evita 403 no cliente.
    let xmlStoragePath = '';
    try {
      xmlStoragePath = `companies/${tenantId}/fiscal/xmls/nfe/${nfId}.xml`;
      await admin.storage().bucket().file(xmlStoragePath).save(Buffer.from(xmlAssinado, 'utf8'), {
        resumable: false, contentType: 'application/xml',
        metadata: { contentType: 'application/xml', metadata: { tenantId, nfId, tipo: 'nfe-assinada' } },
      });
    } catch (e) {
      functions.logger.warn('[nf_enviarSEFAZ] Falha ao salvar XML assinado:', (e && e.message) || e);
      xmlStoragePath = '';
    }

    // A7: persistir o XML autorizado (nfeProc = NFe assinada + protNFe da SEFAZ)
    // no Storage. O protNFe vem da resposta real da SEFAZ (nunca fabricado).
    let xmlProcStoragePath = '';
    if (ret.autorizada && ret.nProt) {
      try {
        const nfeMatch  = String(xmlAssinado || '').match(/<NFe[\s\S]*?<\/NFe>/);
        const protMatch = String(resp.body || '').match(/<protNFe[\s\S]*?<\/protNFe>/);
        if (nfeMatch && protMatch) {
          const nfeProc = `<?xml version="1.0" encoding="UTF-8"?>\n<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">\n${nfeMatch[0]}\n${protMatch[0]}\n</nfeProc>`;
          const storagePath = `companies/${tenantId}/fiscal/xmls/nfe/${nfId}-proc.xml`;
          await admin.storage().bucket().file(storagePath).save(Buffer.from(nfeProc, 'utf8'), {
            resumable: false,
            contentType: 'application/xml',
            metadata: { contentType: 'application/xml', metadata: { tenantId, nfId, tipo: 'nfeProc' } },
          });
          xmlProcStoragePath = storagePath;
        }
      } catch (e) {
        functions.logger.warn(`[nf_enviarSEFAZ] Falha ao persistir nfeProc: ${e.message}`);
      }
    }

    // Persistir resultado no Firebase
    // Distinguir rejeição fiscal (cStat numérico) de erro de comunicação (999/sem cStat)
    const falhaComunicacao = !ret.autorizada && (!/^\d{3}$/.test(String(ret.cStat)) || ret.cStat === '999');
    const statusFinal = ret.autorizada ? 'autorizada' : (falhaComunicacao ? 'erro_envio' : 'rejeitada');
    const patch = {
      status:        statusFinal,
      cStat:         ret.cStat,
      xMotivo:       ret.xMotivo,
      descricao:     descreverCStat(ret.cStat) || ret.xMotivo || '',
      nProt:         ret.nProt,
      dhAutorizacao: ret.dhRecbto || new Date().toISOString(),
      tpEmis:        tpEmisEnvio,
      ambienteSefaz: resolverAmbienteSVC(tpEmisEnvio) || 'normal',
      updatedAt:     new Date().toISOString(),
      ...(falhaComunicacao ? { erroMsg: `Sem retorno válido da SEFAZ (cStat ${ret.cStat}). Tente reenviar/consultar.` } : {}),
      ...(xmlStoragePath ? { xmlStoragePath } : {}),
      ...(xmlProcStoragePath ? { xmlProcStoragePath } : {}),
    };
    await updateFiscalNote(db, tenantId, modKey, nfId, patch);

    return {
      autorizada: ret.autorizada,
      status:     statusFinal,
      cStat:      ret.cStat,
      xMotivo:    ret.xMotivo,
      descricao:  descreverCStat(ret.cStat) || ret.xMotivo || '',
      nProt:      ret.nProt,
      dhRecbto:   ret.dhRecbto,
      tpEmis:     tpEmisEnvio,
      ambienteSefaz: resolverAmbienteSVC(tpEmisEnvio) || 'normal',
      xmlProcStoragePath,
    };
  } catch (e) {
    functions.logger.error('[nf_enviarSEFAZ] Erro:', (e && e.message) || e, (e && e.stack) || '');
    // Registrar erro no Firebase
    try {
      await updateFiscalNote(db, tenantId, modKey, nfId, {
        status: 'erro_envio', erroMsg: e.message, updatedAt: new Date().toISOString(),
      });
    } catch (_) {}
    throw new functions.https.HttpsError('internal', `Falha no envio SEFAZ: ${e.message}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 2b: nf_reservarNumero
// Reserva o próximo número NF-e em transação atômica (evita duplicidade),
// POR SÉRIE: contador em numeros/{modKey}/{serie}. Migração: o contador
// legado em numeros/{modKey} (série única antiga) semeia a série 1 uma única
// vez — sem isso, a série 1 recomeçaria do 1 e duplicaria notas já emitidas.
// Gêmea de teste: aplicarReservaNumero (extraível por vm).
function normalizeSerieFiscal(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 999) return '1';
  return String(n);
}

function aplicarReservaNumero(current, seedProximo, nowIso) {
  const cur = current && typeof current === 'object' ? current : {};
  const atual = Number(cur.proximoNumero);
  if (Number.isFinite(atual) && atual >= 1) {
    return { ...cur, proximoNumero: Math.floor(atual) + 1, updatedAt: nowIso };
  }
  const seed = Number(seedProximo);
  const base = Number.isFinite(seed) && seed >= 1 ? Math.floor(seed) : 1;
  return { proximoNumero: base + 1, updatedAt: nowIso };
}

exports.nf_reservarNumero = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, modelo, serie: rawSerie } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  await assertTenantAccess(context, tenantId);

  const modKey = String(modelo) === '65' ? 'nfce' : (String(modelo) === 'nfse' ? 'nfse' : 'nfe');
  const serieKey = normalizeSerieFiscal(rawSerie);
  const ref = admin.database().ref(`companies/${tenantId}/fiscal/config/numeros/${modKey}/${serieKey}`);

  let seedProximo = 1;
  if (serieKey === '1') {
    try {
      const leg = await admin.database().ref(`companies/${tenantId}/fiscal/config/numeros/${modKey}/proximoNumero`).get().catch(() => null);
      const n = leg && leg.exists() ? Number(leg.val()) : NaN;
      if (Number.isFinite(n) && n >= 1) seedProximo = Math.floor(n);
    } catch (_) {}
  }

  const tx = await ref.transaction((current) => aplicarReservaNumero(current, seedProximo, new Date().toISOString()));
  if (!tx.committed) {
    throw new functions.https.HttpsError('aborted', 'Não foi possível reservar a numeração da NF-e.');
  }
  const value = tx.snapshot.val() || {};
  return { numero: (Number(value.proximoNumero) || 1) - 1, serie: serieKey };
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 3: nf_consultarNFe
// Consulta protocolo de autorização na SEFAZ
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_consultarNFe = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, chave, senhaA1, ambiente, tpEmis: rawTpEmis } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  if (!chave || !senhaA1) {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId, chave e senhaA1 são obrigatórios');
  }

  const { uid } = await assertTenantAccess(context, tenantId);
  const env = ambiente === 'producao' ? 'producao' : 'homologacao';

  try {
    const pfxBuffer = await descriptografarPFXdoStorage(tenantId, uid, senhaA1);
    const consultaXml = `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${env === 'producao' ? 1 : 2}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chave}</chNFe></consSitNFe>`;

    const cUF = resolveCUF({ chave });
    // P5: nota autorizada em SVC é consultada no SVC (cliente informa o tpEmis
    // do registro; sem ele, rota normal — compatível).
    const tpEmisCons = ['6', '7'].includes(String(rawTpEmis ?? '').trim()) ? String(rawTpEmis).trim() : '1';
    const url  = getEndpoint('NfeConsultaProtocolo4', env, undefined, tpEmisCons);
    // As actions do asmx SVRS de consulta variam de nome entre versões do WSDL
    // (SOAP Fault "action not recognized" em 05/2026 para NfeConsultaProtocolo4
    // E NfeConsulta4). Auto-descoberta com fallback ORDENADO: usa a primeira
    // que o servidor reconhecer (Fault "not recognized" → próxima). A vencedora
    // é registrada no log para fixação definitiva.
    const baseAction = soapActionFor('NfeConsultaProtocolo4');
    const alternativas = [
      baseAction,
      'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF',
      'http://www.portalfiscal.inf.br/nfe/wsdl/NfeConsultaProtocolo4/nfeConsulta',
      'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsulta4/nfeConsulta',
    ].filter((a, i, arr) => a && arr.indexOf(a) === i);
    let resp = null;
    let actionUsada = '';
    const faultsTentados = [];
    for (const action of alternativas) {
      const soap = buildSoapEnvelope('NfeConsultaProtocolo4', consultaXml, '4.00', cUF);
      const tentativa = await postSefaz(url, soap, pfxBuffer, senhaA1, action);
      actionUsada = action;
      resp = tentativa;
      const body = String(tentativa.body || '');
      const naoReconhecida = tentativa.status === 500 && /action .* was not recognized/i.test(body);
      if (!naoReconhecida) break;
      faultsTentados.push(action);
    }
    if (faultsTentados.length) {
      functions.logger.warn(`[nf_consultarNFe] Actions não reconhecidas: ${faultsTentados.join(' | ')}`);
    }
    functions.logger.info(`[nf_consultarNFe] action usada: ${actionUsada}`);
    const ret  = parseSefazResponse(resp.body, ['100', '150'], { first: true });

    if (ret.cStat === '999') {
      functions.logger.warn(`[nf_consultarNFe] Resposta não parseada | HTTP ${resp.status} | chave=${chave} | body: ${String(resp.body || '').slice(0, 800)}`);
    }

    // Verdade da situação: a consulta de uma NF-e cancelada devolve o cStat do
    // retorno principal (100 = autorizada) + o evento 110111 no procEventoNFe.
    // Extração tolerante a prefixo/namespace (mesmo caso do MDF-e).
    const bodyConsulta = String(resp.body || '');
    const temEventoCancelamento = ['110111'].includes(extrairConteudoTag(bodyConsulta, 'tpEvento'));
    const cStatEventoCancel = extrairConteudoTag(extrairBlocoTag(bodyConsulta, 'retEvento'), 'cStat');
    const cancelada = temEventoCancelamento && ['135', '155', '101'].includes(cStatEventoCancel);
    const situacao = cancelada ? 'cancelada' : (ret.autorizada ? 'autorizada' : 'indefinida');

    return {
      cStat:   ret.cStat,
      xMotivo: ret.xMotivo,
      descricao: descreverCStat(ret.cStat) || ret.xMotivo || '',
      nProt:   ret.nProt,
      autorizada: ret.autorizada,
      cancelada,
      situacao,
      cStatEventoCancelamento: cancelada ? cStatEventoCancel : '',
      // Diagnóstico quando a resposta não foi interpretada (mesmo padrão do
      // erroMsg do MDF-e) — evita caçar logs de runtime.
      ...(ret.cStat === '999' ? { httpStatus: resp.status, respostaSefaz: bodyConsulta.slice(0, 1500) } : {}),
      actionUsada,
    };
  } catch (e) {
    functions.logger.error('[nf_consultarNFe] Erro:', (e && e.message) || e, (e && e.stack) || '');
    throw new functions.https.HttpsError('internal', `Falha na consulta: ${e.message}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION: nf_baixarXML
// Retorna o XML autorizado (nfeProc quando disponível) via Admin SDK — fallback
// quando o download direto do Storage falha no browser (CORS ou regras/claims).
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_baixarXML = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, nfId: rawNfId, modelo } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  const nfId = sanitizePathSegment(rawNfId, 'nfId');
  if (!tenantId || !nfId) {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId e nfId são obrigatórios');
  }
  await assertTenantAccess(context, tenantId);
  const modKey = getModKey(modelo);
  try {
    const db = admin.database();
    let note = null;
    for (const ref of getFiscalNoteRefs(db, tenantId, modKey, nfId)) {
      try {
        const snap = await ref.get();
        if (snap.exists()) { note = snap.val() || {}; break; }
      } catch (_) {}
    }
    if (!note) {
      throw new functions.https.HttpsError('not-found', 'Nota não encontrada');
    }
    const candidates = [note.xmlProcStoragePath, note.xmlStoragePath, note.xmlPath]
      .map((p) => String(p || '').replace(/^\/+/, ''))
      .filter((p) => p && !p.includes('..') && (p.startsWith('companies/') || p.startsWith('tenants/')));
    if (!candidates.length) {
      throw new functions.https.HttpsError('not-found', 'XML não disponível para esta nota');
    }
    const bucket = admin.storage().bucket();
    let lastErr = null;
    for (const storagePath of candidates) {
      try {
        const [buf] = await bucket.file(storagePath).download();
        if (buf && buf.length) {
          return { xmlBase64: buf.toString('base64'), storagePath, chave: note.chave || '' };
        }
      } catch (e) { lastErr = e; }
    }
    functions.logger.warn(`[nf_baixarXML] Arquivo ausente | tid=${tenantId} nfId=${nfId} | tried=${candidates.join(',')} | err=${lastErr && lastErr.message}`);
    throw new functions.https.HttpsError('not-found', 'Arquivo XML não encontrado no Storage');
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    functions.logger.error('[nf_baixarXML] Erro:', (e && e.message) || e);
    throw new functions.https.HttpsError('internal', `Falha ao ler XML: ${(e && e.message) || e}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 4: nf_cancelarNFe
// Registra evento de cancelamento na SEFAZ (prazo: até 24h/30 dias)
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_cancelarNFe = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, nfId: rawNfId, modelo, chave, nProt, justificativa, senhaA1, ambiente, cnpjEmit, nSeqEvento } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  const nfId = sanitizePathSegment(rawNfId, 'nfId');
  const chaveNFe = requireAccessKey(chave);
  if (!nProt || !justificativa || !senhaA1) {
    throw new functions.https.HttpsError('invalid-argument', 'Campos obrigatórios: tenantId, nfId, chave, nProt, justificativa, senhaA1');
  }
  if (justificativa.trim().length < 15) {
    throw new functions.https.HttpsError('invalid-argument', 'Justificativa deve ter mínimo 15 caracteres');
  }

  const { uid } = await assertTenantAccess(context, tenantId);
  const env    = ambiente === 'producao' ? 'producao' : 'homologacao';
  const modKey = modelo == 65 ? 'nfce' : 'nfe';
  const db     = admin.database();
  const dhEvento = toFiscalDateTime();
  // P5: evento vai ao SVC que autorizou a nota (registro é a fonte da verdade).
  const tpEmisCanc = await lerTpEmisNota(db, tenantId, modKey, nfId, (data || {}).tpEmis);
  // Prazo de cancelamento: decorrido desde dhAutorizacao vs limite da config
  // do tenant (prazosFiscais.cancNFeHoras; null = sem bloqueio). Antes do PFX
  // e da SEFAZ — poupa a ida quando já estourado.
  try {
    const cfgPrazo = await loadFiscalConfig(db, tenantId);
    const limiteCanc = cfgPrazo && cfgPrazo.prazosFiscais ? cfgPrazo.prazosFiscais.cancNFeHoras : null;
    if (Number(limiteCanc) > 0) {
      const notaSnap = await db.ref(`companies/${tenantId}/fiscal/notas/${modKey}/${nfId}`).get().catch(() => null);
      const nota = notaSnap && notaSnap.exists() ? notaSnap.val() : null;
      const avaliacao = avaliarPrazoEventoFiscal(nota && (nota.dhAutorizacao || nota.dhRecbto), limiteCanc);
      if (avaliacao.excedido) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `PRAZO_EXCEDIDO: NF-e autorizada ${formatarDecorridoHorasFiscal(avaliacao.decorridoHoras)} (limite configurado: ${limiteCanc}h). Confira o prazo no MOC/NT vigente.`,
        );
      }
    }
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    functions.logger.warn(`[nf_cancelarNFe] checagem de prazo indisponível (segue sem bloquear): ${(e && e.message) || e}`);
  }
  const cnpj     = requireCnpj(cnpjEmit);
  const cUF      = resolveCUF({ chave: chaveNFe });
  const seq      = normalizeSeqEvento(nSeqEvento, 1);
  const seqStr   = String(seq).padStart(2, '0');

  try {
    const pfxBuffer = await descriptografarPFXdoStorage(tenantId, uid, senhaA1);

    const eventoXml = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
      <idLote>${Date.now()}</idLote>
      <evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
        <infEvento Id="ID110111${chaveNFe}${seqStr}">
          <cOrgao>${cUF}</cOrgao>
          <tpAmb>${env === 'producao' ? 1 : 2}</tpAmb>
          <CNPJ>${cnpj}</CNPJ>
          <chNFe>${chaveNFe}</chNFe>
          <dhEvento>${dhEvento}</dhEvento>
          <tpEvento>110111</tpEvento>
          <nSeqEvento>${seq}</nSeqEvento>
          <verEvento>1.00</verEvento>
          <detEvento versao="1.00">
            <descEvento>Cancelamento</descEvento>
            <nProt>${escapeXml(nProt)}</nProt>
            <xJust>${escapeXml(justificativa.trim().slice(0, 255))}</xJust>
          </detEvento>
        </infEvento>
      </evento>
    </envEvento>`;

    const eventoAssinado = assinarXMLcomForge(eventoXml, pfxBuffer, senhaA1, { tagName: 'infEvento', idPrefix: 'ID' });
    const url  = getEndpoint('NFeRecepcaoEvento4', env, undefined, tpEmisCanc);
    const soap = buildSoapEnvelope('NFeRecepcaoEvento4', eventoAssinado, '1.00', cUF);
    const resp = await postSefaz(url, soap, pfxBuffer, senhaA1, soapActionFor('NFeRecepcaoEvento4'));
    const ret  = parseSefazResponse(resp.body, ['135', '136', '155']);

    // Falha NÃO muda o status da nota: sem evento registrado ela segue
    // AUTORIZADA na SEFAZ (permite nova tentativa). Só sucesso vira 'cancelada'.
    const patchCancel = ret.autorizada
      ? {
          status:               'cancelada',
          cStatCancelamento:    ret.cStat,
          xMotivoCancelamento:  ret.xMotivo,
          dataCancelamento:     new Date().toISOString(),
          justificativaCancelamento: justificativa,
          xmlCancelamentoRetorno: ret.xmlRetorno,
          nSeqEventoCancelamento: seq,
          updatedAt:            new Date().toISOString(),
        }
      : {
          erroCancelamento:     `cStat ${ret.cStat}: ${ret.xMotivo || 'SEFAZ não registrou o evento de cancelamento'}`,
          cStatCancelamento:    ret.cStat,
          xMotivoCancelamento:  ret.xMotivo,
          updatedAt:            new Date().toISOString(),
        };
    await updateFiscalNote(db, tenantId, modKey, nfId, patchCancel);

    return {
      cancelada: ret.autorizada,
      cStat:     ret.cStat,
      xMotivo:   ret.xMotivo,
    };
  } catch (e) {
    throw new functions.https.HttpsError('internal', `Falha no cancelamento: ${e.message}`);
  }
});

async function resolveCceSequence(db, tenantId, modKey, nfId, rawSeq) {
  if (rawSeq != null && rawSeq !== '') return normalizeSeqEvento(rawSeq, 1);
  for (const ref of getFiscalNoteRefs(db, tenantId, modKey, nfId)) {
    try {
      const snap = await ref.get();
      if (!snap.exists()) continue;
      const note = snap.val() || {};
      const events = note.eventos && note.eventos.cce && typeof note.eventos.cce === 'object'
        ? note.eventos.cce
        : {};
      const cartas = note.cartasCorrecao && typeof note.cartasCorrecao === 'object'
        ? note.cartasCorrecao
        : {};
      const seqs = [...Object.keys(events), ...Object.keys(cartas)]
        .map((key) => parseInt(String(key).replace(/\D/g, ''), 10))
        .filter((value) => Number.isFinite(value));
      if (seqs.length) return normalizeSeqEvento(Math.max(...seqs) + 1, 1);
    } catch (_) {}
  }
  return 1;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 5: nf_cartaCorrecaoNFe
// Registra Carta de Correcao Eletronica (evento 110110)
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_cartaCorrecaoNFe = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, nfId: rawNfId, modelo, chave, correcao, senhaA1, ambiente, cnpjEmit, nSeqEvento } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  const nfId = sanitizePathSegment(rawNfId, 'nfId');
  const chaveNFe = requireAccessKey(chave);
  const textoCorrecao = sanitizeFiscalText(correcao, 'Correção', 15, 1000);
  if (!senhaA1) {
    throw new functions.https.HttpsError('invalid-argument', 'senhaA1 obrigatório');
  }

  const { uid } = await assertTenantAccess(context, tenantId);
  const env    = ambiente === 'producao' ? 'producao' : 'homologacao';
  const modKey = getModKey(modelo);
  const db     = admin.database();
  const cnpj   = requireCnpj(cnpjEmit);
  const cUF    = resolveCUF({ chave: chaveNFe });
  // P5: CC-e vai ao SVC que autorizou a nota (registro é a fonte da verdade).
  const tpEmisCce = await lerTpEmisNota(db, tenantId, modKey, nfId, (data || {}).tpEmis);
  const seq    = await resolveCceSequence(db, tenantId, modKey, nfId, nSeqEvento);
  const seqStr = String(seq).padStart(2, '0');
  const dhEvento = toFiscalDateTime();

  try {
    const pfxBuffer = await descriptografarPFXdoStorage(tenantId, uid, senhaA1);
    const eventoXml = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
      <idLote>${Date.now()}</idLote>
      <evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
        <infEvento Id="ID110110${chaveNFe}${seqStr}">
          <cOrgao>${cUF}</cOrgao>
          <tpAmb>${env === 'producao' ? 1 : 2}</tpAmb>
          <CNPJ>${cnpj}</CNPJ>
          <chNFe>${chaveNFe}</chNFe>
          <dhEvento>${dhEvento}</dhEvento>
          <tpEvento>110110</tpEvento>
          <nSeqEvento>${seq}</nSeqEvento>
          <verEvento>1.00</verEvento>
          <detEvento versao="1.00">
            <descEvento>Carta de Correcao</descEvento>
            <xCorrecao>${escapeXml(textoCorrecao)}</xCorrecao>
            <xCondUso>${escapeXml(CCE_COND_USO)}</xCondUso>
          </detEvento>
        </infEvento>
      </evento>
    </envEvento>`;

    const eventoAssinado = assinarXMLcomForge(eventoXml, pfxBuffer, senhaA1, { tagName: 'infEvento', idPrefix: 'ID' });
    const url  = getEndpoint('NFeRecepcaoEvento4', env, undefined, tpEmisCce);
    const soap = buildSoapEnvelope('NFeRecepcaoEvento4', eventoAssinado, '1.00', cUF);
    const resp = await postSefaz(url, soap, pfxBuffer, senhaA1, soapActionFor('NFeRecepcaoEvento4'));
    const ret  = parseSefazResponse(resp.body, ['135', '136']);
    const nowIso = new Date().toISOString();
    const eventPayload = {
      tipo: 'cce',
      tpEvento: '110110',
      nSeqEvento: seq,
      correcao: textoCorrecao,
      cStat: ret.cStat,
      xMotivo: ret.xMotivo,
      nProt: ret.nProt,
      dhEvento,
      autorizada: ret.autorizada,
      xmlRetorno: ret.xmlRetorno,
      updatedAt: nowIso,
    };
    await updateFiscalNote(db, tenantId, modKey, nfId, {
      cStatCartaCorrecao: ret.cStat,
      xMotivoCartaCorrecao: ret.xMotivo,
      ultimaCartaCorrecao: eventPayload,
      [`eventos/cce/${seqStr}`]: eventPayload,
      updatedAt: nowIso,
    });
    return {
      autorizada: ret.autorizada,
      cStat: ret.cStat,
      xMotivo: ret.xMotivo,
      nProt: ret.nProt,
      nSeqEvento: seq,
    };
  } catch (e) {
    throw new functions.https.HttpsError('internal', `Falha na Carta de Correção: ${e.message}`);
  }
});

async function assertNoLocalAuthorizedNumberInRange(db, tenantId, modKey, serie, numeroInicial, numeroFinal) {
  const blockingStatuses = new Set(['autorizada', 'cancelada', 'denegada']);
  const refs = [
    db.ref(`companies/${tenantId}/fiscal/notas/${modKey}`),
    db.ref(`tenants/${tenantId}/notas-fiscais/${modKey}`)
  ];
  for (const ref of refs) {
    try {
      const snap = await ref.get();
      if (!snap.exists()) continue;
      const notes = snap.val() || {};
      for (const note of Object.values(notes)) {
        if (!note || typeof note !== 'object') continue;
        const noteSerie = parseInt(note.serie || note.ide && note.ide.serie || 0, 10);
        const noteNumber = parseInt(note.numero || note.ide && note.ide.nNF || 0, 10);
        const noteStatus = String(note.status || '').toLowerCase();
        if (noteSerie === serie && noteNumber >= numeroInicial && noteNumber <= numeroFinal && blockingStatuses.has(noteStatus)) {
          throw new functions.https.HttpsError('failed-precondition', `Numeração ${noteNumber} da série ${serie} já possui NF-e ${noteStatus} no Sisweb.`);
        }
      }
    } catch (e) {
      if (e instanceof functions.https.HttpsError) throw e;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 6: nf_inutilizarNumeracao
// Inutiliza faixa de numeracao NF-e/NFC-e na SEFAZ
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_inutilizarNumeracao = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, modelo, serie: rawSerie, numeroInicial: rawIni, numeroFinal: rawFim, justificativa, senhaA1, ambiente, cnpjEmit, ufEmit, cUF: rawCUF, ano, tpEmis: rawTpEmis } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  const mod = String(modelo == 65 ? 65 : 55);
  const modKey = getModKey(mod);
  const serie = parseInt(rawSerie, 10);
  const numeroInicial = parseInt(rawIni, 10);
  const numeroFinal = parseInt(rawFim, 10);
  if (!Number.isFinite(serie) || serie < 0 || serie > 999) {
    throw new functions.https.HttpsError('invalid-argument', 'Série deve estar entre 0 e 999.');
  }
  if (!Number.isFinite(numeroInicial) || !Number.isFinite(numeroFinal) || numeroInicial < 1 || numeroFinal < numeroInicial || numeroFinal > 999999999) {
    throw new functions.https.HttpsError('invalid-argument', 'Faixa de numeração inválida.');
  }
  const xJust = sanitizeFiscalText(justificativa, 'Justificativa', 15, 255);
  if (!senhaA1) {
    throw new functions.https.HttpsError('invalid-argument', 'senhaA1 obrigatório');
  }

  const { uid } = await assertTenantAccess(context, tenantId);
  const env = ambiente === 'producao' ? 'producao' : 'homologacao';
  const db = admin.database();
  await assertNoLocalAuthorizedNumberInRange(db, tenantId, modKey, serie, numeroInicial, numeroFinal);
  const cnpj = requireCnpj(cnpjEmit);
  const cUF = resolveCUF({ ufEmit, cUF: rawCUF });
  const anoNum = parseInt(ano || new Date().getFullYear(), 10);
  const ano2 = String(Number.isFinite(anoNum) ? anoNum % 100 : new Date().getFullYear() % 100).padStart(2, '0');
  const idInut = `ID${cUF}${ano2}${cnpj}${mod}${String(serie).padStart(3, '0')}${String(numeroInicial).padStart(9, '0')}${String(numeroFinal).padStart(9, '0')}`;

  try {
    const pfxBuffer = await descriptografarPFXdoStorage(tenantId, uid, senhaA1);
    const inutXml = `<inutNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
      <infInut Id="${idInut}">
        <tpAmb>${env === 'producao' ? 1 : 2}</tpAmb>
        <xServ>INUTILIZAR</xServ>
        <cUF>${cUF}</cUF>
        <ano>${ano2}</ano>
        <CNPJ>${cnpj}</CNPJ>
        <mod>${mod}</mod>
        <serie>${serie}</serie>
        <nNFIni>${numeroInicial}</nNFIni>
        <nNFFin>${numeroFinal}</nNFFin>
        <xJust>${escapeXml(xJust)}</xJust>
      </infInut>
    </inutNFe>`;
    const inutAssinado = assinarXMLcomForge(inutXml, pfxBuffer, senhaA1, { tagName: 'infInut', idPrefix: 'ID' });
    // P5: sem nota vinculada — cliente informa tpEmis da contingência ativa (default: rota normal).
    const tpEmisInut = ['6', '7'].includes(String(rawTpEmis ?? '').trim()) ? String(rawTpEmis).trim() : '1';
    const url  = getEndpoint('NFeInutilizacao4', env, undefined, tpEmisInut);
    const soap = buildSoapEnvelope('NFeInutilizacao4', inutAssinado, '4.00', cUF);
    const resp = await postSefaz(url, soap, pfxBuffer, senhaA1, soapActionFor('NFeInutilizacao4'));
    const ret  = parseSefazResponse(resp.body, ['102']);
    const nowIso = new Date().toISOString();
    const recordId = `${modKey}_${ano2}_${String(serie).padStart(3, '0')}_${String(numeroInicial).padStart(9, '0')}_${String(numeroFinal).padStart(9, '0')}`;
    const payload = {
      id: recordId,
      modelo: Number(mod),
      serie,
      numeroInicial,
      numeroFinal,
      justificativa: xJust,
      cUF,
      cnpjEmit: cnpj,
      ambiente: env,
      cStat: ret.cStat,
      xMotivo: ret.xMotivo,
      nProt: ret.nProt,
      autorizada: ret.autorizada,
      xmlRetorno: ret.xmlRetorno,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await Promise.all([
      db.ref(`companies/${tenantId}/fiscal/notas/inutilizacoes/${recordId}`).set(payload),
      db.ref(`tenants/${tenantId}/notas-fiscais/inutilizacoes/${recordId}`).set(payload).catch(() => {})
    ]);
    return {
      autorizada: ret.autorizada,
      inutilizada: ret.autorizada,
      cStat: ret.cStat,
      xMotivo: ret.xMotivo,
      nProt: ret.nProt,
      id: recordId,
    };
  } catch (e) {
    throw new functions.https.HttpsError('internal', `Falha na inutilização: ${e.message}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 7: nf_removerCertificado
// Upload seguro do certificado A1 via callable
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_uploadCertificadoA1 = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, encryptedPfxBase64, originalFileName, certMeta } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  await assertFiscalCertificateAdmin(context, tenantId);

  const encryptedBuffer = decodeBase64Payload(encryptedPfxBase64, 'encryptedPfxBase64');
  if (encryptedBuffer.length < 48) {
    throw new functions.https.HttpsError('invalid-argument', 'Conteúdo do certificado criptografado é inválido.');
  }
  if (encryptedBuffer.length > 5 * 1024 * 1024) {
    throw new functions.https.HttpsError('invalid-argument', 'Certificado A1 excede o limite seguro de 5MB.');
  }

  const sanitizedMeta = sanitizeCertificateMetaInput(certMeta);
  const db = admin.database();
  const bucket = admin.storage().bucket();
  const fileHash = crypto.createHash('sha1').update(String(context.auth.uid || '')).digest('hex').slice(0, 12);
  const storageRef = `${getTenantCertificateStoragePrefix(tenantId)}cert_a1_${Date.now()}_${fileHash}.enc`;
  const file = bucket.file(storageRef);
  const nowIso = new Date().toISOString();
  const certRecord = {
    ...sanitizedMeta,
    storageRef,
    originalFileName: sanitizeOriginalFileName(originalFileName),
    uploadedAt: nowIso,
    uploadedBy: String(context.auth.uid || ''),
    updatedAt: nowIso,
    updatedBy: String(context.auth.uid || '')
  };

  try {
    await file.save(encryptedBuffer, {
      resumable: false,
      contentType: 'application/octet-stream',
      metadata: {
        contentType: 'application/octet-stream',
        metadata: {
          tenantId,
          uploadedBy: String(context.auth.uid || ''),
          originalFileName: certRecord.originalFileName || ''
        }
      }
    });
    await saveCertificateMetadata(db, tenantId, certRecord);
    await deleteTenantCertificateFiles(bucket, tenantId, storageRef).catch(() => {});
    return certRecord;
  } catch (error) {
    await file.delete().catch(() => {});
    throw new functions.https.HttpsError('internal', `Falha ao salvar certificado A1: ${error.message}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 8: nf_removerCertificado
// Remove certificado do Storage com segurança
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_removerCertificado = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  await assertFiscalCertificateAdmin(context, tenantId);

  try {
    const db = admin.database();
    const bucket = admin.storage().bucket();
    await deleteTenantCertificateFiles(bucket, tenantId);
    await clearCertificateMetadata(db, tenantId);
    await admin.database().ref(`tenants/${tenantId}/config-fiscal/certificado/pfxEnc`).remove().catch(() => {});
    return { ok: true };
  } catch (e) {
    throw new functions.https.HttpsError('internal', e.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 9: nf_salvarReferenciaCertificado
// Persiste metadados A3 token/nuvem via backend seguro
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_salvarReferenciaCertificado = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, certMeta } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  await assertFiscalCertificateAdmin(context, tenantId);
  const uid = String(context.auth.uid || '').trim();
  const db = admin.database();
  const nextMeta = sanitizeCertificateReferenceInput(certMeta, uid);
  await saveCertificateMetadata(db, tenantId, nextMeta);
  return nextMeta;
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 10: nf_salvarConfiguracaoFiscal
// Persiste configuracao fiscal por backend seguro
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_salvarConfiguracaoFiscal = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const source = data && typeof data === 'object' ? data : {};
  const tenantId = sanitizePathSegment(source.tenantId, 'tenantId');
  await assertFiscalConfigAdmin(context, tenantId);
  const uid = String(context.auth.uid || '').trim();
  const db = admin.database();
  const current = await loadFiscalConfig(db, tenantId);
  const mode = String(source.mode || 'full').trim().toLowerCase() === 'section' ? 'section' : 'full';

  let nextConfig;
  if (mode === 'section') {
    const section = sanitizePathSegment(source.section, 'section');
    const payload = sanitizeFiscalObjectPayload(source.payload, 'payload');
    nextConfig = buildNextFiscalConfig(current, { [section]: payload }, uid, {
      section,
      trackedImpostos: section === 'impostos' ? payload : null
    });
  } else {
    const config = sanitizeFiscalObjectPayload(source.config, 'config');
    nextConfig = buildNextFiscalConfig(current, config, uid, {
      trackedImpostos: config.impostos && isPlainObject(config.impostos) ? config.impostos : null
    });
  }

  await db.ref(`companies/${tenantId}/fiscal/config`).set(nextConfig);

  // Espelhar dados da empresa em companies/{tenantId}/profile via Admin SDK.
  // (Antes o cliente escrevia direto e era negado: profile .write = superadmin.)
  try {
    const emp = (nextConfig && nextConfig.empresa) || {};
    if (emp.cnpj || emp.razaoSocial) {
      const end = emp.endereco || {};
      await db.ref(`companies/${tenantId}/profile`).update({
        cnpj: emp.cnpj || '', razaoSocial: emp.razaoSocial || '', nomeFantasia: emp.nomeFantasia || '',
        ie: emp.ie || '', im: emp.im || '', regime: emp.regime || '',
        telefone: emp.telefone || '', email: emp.email || '',
        logradouro: end.logradouro || '', numero: end.numero || '', complemento: end.complemento || '',
        bairro: end.bairro || '', municipio: end.municipio || '', uf: end.uf || '', cep: end.cep || '',
        name: emp.razaoSocial || '', fantasia: emp.nomeFantasia || '', phone: emp.telefone || '',
        state: end.uf || '', city: end.municipio || '',
        updatedAt: new Date().toISOString(), updatedByNF: true,
      });
    }
  } catch (e) {
    functions.logger.warn('[nf_salvarConfiguracaoFiscal] Falha ao espelhar profile:', (e && e.message) || e);
  }

  return {
    success: true,
    tenantId,
    config: nextConfig
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 11: nf_configurarCertNuvem (placeholder A3 Nuvem)
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_configurarCertNuvem = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  // Implementação futura: integrar com BirdID/SafeID/VaultID via Secret Manager
  throw new functions.https.HttpsError('unimplemented', 'Certificado A3 Nuvem será implementado na próxima fase');
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 12: nf_obterResumoCertificadoFiscal
// Lê apenas o resumo público do certificado via backend seguro
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_obterResumoCertificadoFiscal = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  await assertTenantAccess(context, tenantId);
  const db = admin.database();
  const meta = await loadCertificateMetadata(db, tenantId);
  return {
    success: true,
    tenantId,
    meta: buildCertificatePublicSummary(meta, tenantId)
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 13: nf_obterConfiguracaoFiscal
// Lê configuração fiscal via backend seguro
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_obterConfiguracaoFiscal = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  await assertTenantAccess(context, tenantId);
  const db = admin.database();
  const config = await loadFiscalConfig(db, tenantId);
  return {
    success: true,
    tenantId,
    config
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION 14: nf_eventoRTC
// Registra Evento de Conciliação Tributária (RTC) — tpEventos 112110..412130
// (pacote oficial Eventos_RTC). Mesmo pipeline dos demais eventos
// (assinarXMLcomForge infEvento + NFeRecepcaoEvento4). O <detEvento> é
// construído no backend a partir do payload validado (frontend apenas coleta);
// histórico em eventos/rtc/NN (espelho do padrão eventos/cce/NN).
// ═══════════════════════════════════════════════════════════════════════════
const RTC_EVENT_DEFS = {
  112110: { desc: 'Informação de efetivo pagamento integral para liberar crédito presumido do adquirente', autor: ['1'], scalar: ['indQuitacao:1'] },
  112120: { desc: 'Importação em ALC/ZFM não convertida em isenção', autor: ['1'], group: 'gConsumo', qty: 'qtde', unit: 'unidade', credit: false },
  112130: { desc: 'Perecimento, perda, roubo ou furto durante o transporte contratado pelo fornecedor', autor: ['1'], group: 'gPerecimento', qty: 'qPerecimento', unit: 'uPerecimento', credit: true },
  112140: { desc: 'Fornecimento não realizado com pagamento antecipado', autor: ['1'], group: 'gItemNaoFornecido', qty: 'qNaoFornecida', unit: 'uNaoFornecida', credit: false },
  112150: { desc: 'Atualização da Data de Previsão de Entrega', autor: ['1'], scalar: ['dPrevEntrega:date'] },
  211110: { desc: 'Solicitação de Apropriação de crédito presumido', autor: ['1', '2'], creditPresumed: true },
  211124: { desc: 'Perecimento, perda, roubo ou furto durante o transporte contratado pelo adquirente', autor: ['2'], group: 'gPerecimento', qty: 'qPerecimento', unit: 'uPerecimento', credit: false },
  211128: { desc: 'Aceite de débito na apuração por emissão de nota de crédito', autor: ['2'], scalar: ['indAceitacao:flag'] },
  211130: { desc: 'Imobilização de Item', autor: ['2'], group: 'gImobilizacao', qty: 'qImobilizado', unit: 'uImobilizado', credit: false },
  211140: { desc: 'Solicitação de Apropriação de Crédito de Combustível', autor: ['2'], group: 'gConsumoComb', qty: 'qComb', unit: 'uComb', credit: false },
  211150: { desc: 'Solicitação de Apropriação de Crédito para bens e serviços que dependem de atividade do adquirente', autor: ['2'], credito: true },
  212110: { desc: 'Manifestação sobre Pedido de Transferência de Crédito de IBS em Operação de Sucessão', autor: ['8'], scalar: ['indAceitacao:flag'] },
  212120: { desc: 'Manifestação sobre Pedido de Transferência de Crédito de CBS em Operação de Sucessão', autor: ['8'], scalar: ['indAceitacao:flag'] },
  412120: { desc: 'Manifestação do Fisco sobre Pedido de Transferência de Crédito de IBS em Operação de Sucessão', autor: ['5'], scalar: ['indDeferimento:flag', 'cMotivo:motivo', 'xMotivo:text500'] },
  412130: { desc: 'Manifestação do Fisco sobre Pedido de Transferência de Crédito de CBS em Operação de Sucessão', autor: ['5'], scalar: ['indDeferimento:flag', 'cMotivo:motivo', 'xMotivo:text500'] },
};

function rtcDec2(v, field) {
  const s = String(v == null ? '' : v).trim().replace(',', '.');
  if (!/^(0|0\.[0-9]{1,2}|[1-9][0-9]{0,12}(\.[0-9]{1,2})?)$/.test(s)) {
    throw new functions.https.HttpsError('invalid-argument', `RTC ${field}: decimal 13+2 inválido`);
  }
  return Number(s).toFixed(2);
}
function rtcDec4(v, field) {
  const s = String(v == null ? '' : v).trim().replace(',', '.');
  if (!/^(0|0\.[0-9]{1,4}|[1-9][0-9]{0,10}(\.[0-9]{1,4})?)$/.test(s)) {
    throw new functions.https.HttpsError('invalid-argument', `RTC ${field}: decimal 11+4 inválido`);
  }
  return Number(s).toFixed(4);
}
function rtcNItem(v) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1 || n > 990) throw new functions.https.HttpsError('invalid-argument', 'RTC nItem deve estar entre 1 e 990');
  return n;
}
function rtcBuildDetEvento(tpEvento, p) {
  const def = RTC_EVENT_DEFS[tpEvento];
  if (!def) throw new functions.https.HttpsError('invalid-argument', `RTC tpEvento ${tpEvento} não suportado`);
  const cOrgao = String(p.cOrgaoAutor || '').trim();
  if (!/^[0-9]{2}$/.test(cOrgao)) throw new functions.https.HttpsError('invalid-argument', 'RTC cOrgaoAutor: código IBGE da UF (2 dígitos)');
  const tpAutor = String(p.tpAutor != null ? p.tpAutor : def.autor[0]).trim();
  if (!def.autor.includes(tpAutor)) throw new functions.https.HttpsError('invalid-argument', `RTC ${tpEvento}: tpAutor deve ser ${def.autor.join(' ou ')}`);
  const verAplic = String(p.verAplic || '').trim();
  if (verAplic.length < 1 || verAplic.length > 20) throw new functions.https.HttpsError('invalid-argument', 'RTC verAplic: 1–20 caracteres');
  let body = '';
  if (def.scalar) {
    const sc = (p.scalar && typeof p.scalar === 'object') ? p.scalar : {};
    for (const spec of def.scalar) {
      const [key, kind] = spec.split(':');
      if (kind === '1') { body += `<${key}>1</${key}>`; continue; }
      const raw = sc[key];
      if (kind === 'flag') {
        const s = String(raw).trim();
        if (s !== '0' && s !== '1') throw new functions.https.HttpsError('invalid-argument', `RTC ${key}: deve ser 0 ou 1`);
        body += `<${key}>${s}</${key}>`;
      } else if (kind === 'date') {
        const s = String(raw || '').trim();
        if (!/^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(s)) throw new functions.https.HttpsError('invalid-argument', `RTC ${key}: data AAAA-MM-DD`);
        body += `<${key}>${s}</${key}>`;
      } else if (kind === 'motivo') {
        const s = String(raw).trim();
        if (s !== '1' && s !== '2') throw new functions.https.HttpsError('invalid-argument', `RTC ${key}: deve ser 1 ou 2`);
        body += `<${key}>${s}</${key}>`;
      } else if (kind === 'text500') {
        const s = String(raw || '').trim().replace(/\s+/g, ' ');
        if (s.length < 1 || s.length > 500) throw new functions.https.HttpsError('invalid-argument', `RTC ${key}: 1–500 caracteres`);
        body += `<${key}>${escapeXml(s)}</${key}>`;
      }
    }
  } else {
    const itens = Array.isArray(p.itens) ? p.itens : [];
    if (!itens.length) throw new functions.https.HttpsError('invalid-argument', `RTC ${tpEvento}: informe ao menos 1 item`);
    if (itens.length > 990) throw new functions.https.HttpsError('invalid-argument', 'RTC: máximo 990 itens por evento');
    const seen = new Set();
    for (const it of itens) {
      const n = rtcNItem(it.nItem);
      if (seen.has(n)) throw new functions.https.HttpsError('invalid-argument', `RTC: nItem ${n} duplicado`);
      seen.add(n);
      if (def.creditPresumed) {
        const cc = String(it.cCredPres || '').trim();
        if (!/^[0-9]{2}$/.test(cc)) throw new functions.https.HttpsError('invalid-argument', 'RTC cCredPres: 2 dígitos');
        let s = `<gCredPresOper nItem="${n}"><vBCCredPres>${rtcDec2(it.vBCCredPres, 'vBCCredPres')}</vBCCredPres><cCredPres>${cc}</cCredPres>`;
        for (const lado of ['gIBSCredPres', 'gCBSCredPres']) {
          const g = it[lado];
          if (!g) continue;
          const ps = String(g.pCredPres == null ? '' : g.pCredPres).trim().replace(',', '.');
          if (!/^(0|0\.[0-9]{2,4}|[1-9][0-9]{0,2}(\.[0-9]{2,4})?)$/.test(ps)) throw new functions.https.HttpsError('invalid-argument', `RTC ${lado}.pCredPres inválido`);
          s += `<${lado}><pCredPres>${String(Number(ps))}</pCredPres><vCredPres>${rtcDec2(g.vCredPres, lado + '.vCredPres')}</vCredPres></${lado}>`;
        }
        body += s + '</gCredPresOper>';
      } else if (def.credito) {
        body += `<gCredito nItem="${n}"><vCredIBS>${rtcDec2(it.vCredIBS, 'vCredIBS')}</vCredIBS><vCredCBS>${rtcDec2(it.vCredCBS, 'vCredCBS')}</vCredCBS></gCredito>`;
      } else {
        const u = String(it.unit || '').trim();
        if (u.length < 1 || u.length > 6) throw new functions.https.HttpsError('invalid-argument', `RTC ${def.unit}: 1–6 caracteres`);
        let g = `<${def.group} nItem="${n}"><vIBS>${rtcDec2(it.vIBS, 'vIBS')}</vIBS><vCBS>${rtcDec2(it.vCBS, 'vCBS')}</vCBS>`
          + `<gControleEstoque><${def.qty}>${rtcDec4(it.qty, def.qty)}</${def.qty}><${def.unit}>${escapeXml(u)}</${def.unit}>`;
        if (def.credit) g += `<vIBS>${rtcDec2(it.cIBS, 'crédito vIBS')}</vIBS><vCBS>${rtcDec2(it.cCBS, 'crédito vCBS')}</vCBS>`;
        body += g + '</gControleEstoque></' + def.group + '>';
      }
    }
  }
  return `<detEvento versao="1.00"><descEvento>${escapeXml(def.desc)}</descEvento>`
    + `<cOrgaoAutor>${cOrgao}</cOrgaoAutor><tpAutor>${tpAutor}</tpAutor>`
    + `<verAplic>${escapeXml(verAplic)}</verAplic>${body}</detEvento>`;
}

async function resolveRtcSequence(db, tenantId, modKey, nfId, rawSeq) {
  if (rawSeq != null && rawSeq !== '') return normalizeSeqEvento(rawSeq, 1);
  for (const ref of getFiscalNoteRefs(db, tenantId, modKey, nfId)) {
    try {
      const snap = await ref.get();
      if (!snap.exists()) continue;
      const note = snap.val() || {};
      const events = note.eventos && note.eventos.rtc && typeof note.eventos.rtc === 'object' ? note.eventos.rtc : {};
      const seqs = Object.keys(events).map((k) => parseInt(String(k).replace(/\D/g, ''), 10)).filter(Number.isFinite);
      if (seqs.length) return normalizeSeqEvento(Math.max(...seqs) + 1, 1);
    } catch (_) {}
  }
  return 1;
}

exports.nf_eventoRTC = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, nfId: rawNfId, modelo, chave, tpEvento, cOrgaoAutor, tpAutor, verAplic, scalar, itens, senhaA1, ambiente, cnpjEmit, nSeqEvento } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  const nfId = sanitizePathSegment(rawNfId, 'nfId');
  const chaveNFe = requireAccessKey(chave);
  const tp = String(tpEvento || '').trim();
  if (!RTC_EVENT_DEFS[tp]) {
    throw new functions.https.HttpsError('invalid-argument', `tpEvento RTC não suportado: ${tp}`);
  }
  if (!senhaA1) {
    throw new functions.https.HttpsError('invalid-argument', 'senhaA1 obrigatório');
  }

  const { uid } = await assertTenantAccess(context, tenantId);
  const env    = ambiente === 'producao' ? 'producao' : 'homologacao';
  const modKey = getModKey(modelo);
  const db     = admin.database();
  const cnpj   = requireCnpj(cnpjEmit);
  const cUF    = resolveCUF({ chave: chaveNFe });
  // P5: evento RTC vai ao SVC que autorizou a nota (registro é a fonte da verdade).
  const tpEmisRtc = await lerTpEmisNota(db, tenantId, modKey, nfId, (data || {}).tpEmis);
  const seq    = await resolveRtcSequence(db, tenantId, modKey, nfId, nSeqEvento);
  const seqStr = String(seq).padStart(2, '0');
  const dhEvento = toFiscalDateTime();
  const detEvento = rtcBuildDetEvento(tp, { cOrgaoAutor, tpAutor, verAplic, scalar, itens });

  try {
    const pfxBuffer = await descriptografarPFXdoStorage(tenantId, uid, senhaA1);
    const eventoXml = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
      <idLote>${Date.now()}</idLote>
      <evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
        <infEvento Id="ID${tp}${chaveNFe}${seqStr}">
          <cOrgao>${cUF}</cOrgao>
          <tpAmb>${env === 'producao' ? 1 : 2}</tpAmb>
          <CNPJ>${cnpj}</CNPJ>
          <chNFe>${chaveNFe}</chNFe>
          <dhEvento>${dhEvento}</dhEvento>
          <tpEvento>${tp}</tpEvento>
          <nSeqEvento>${seq}</nSeqEvento>
          <verEvento>1.00</verEvento>
          ${detEvento}
        </infEvento>
      </evento>
    </envEvento>`;

    const eventoAssinado = assinarXMLcomForge(eventoXml, pfxBuffer, senhaA1, { tagName: 'infEvento', idPrefix: 'ID' });
    const url  = getEndpoint('NFeRecepcaoEvento4', env, undefined, tpEmisRtc);
    const soap = buildSoapEnvelope('NFeRecepcaoEvento4', eventoAssinado, '1.00', cUF);
    const resp = await postSefaz(url, soap, pfxBuffer, senhaA1, soapActionFor('NFeRecepcaoEvento4'));
    const ret  = parseSefazResponse(resp.body, ['135', '136']);
    const nowIso = new Date().toISOString();
    const resumo = scalar && typeof scalar === 'object'
      ? Object.entries(scalar).map(([k, v]) => `${k}=${v}`).join('; ').slice(0, 200)
      : `${Array.isArray(itens) ? itens.length : 0} item(ns)`;
    const eventPayload = {
      tipo: 'rtc',
      tpEvento: tp,
      descEvento: RTC_EVENT_DEFS[tp].desc,
      nSeqEvento: seq,
      resumo,
      cStat: ret.cStat,
      xMotivo: ret.xMotivo,
      nProt: ret.nProt,
      dhEvento,
      autorizada: ret.autorizada,
      xmlRetorno: ret.xmlRetorno,
      updatedAt: nowIso,
    };
    await updateFiscalNote(db, tenantId, modKey, nfId, {
      ultimaEventoRTC: eventPayload,
      [`eventos/rtc/${seqStr}`]: eventPayload,
      updatedAt: nowIso,
    });
    return {
      autorizada: ret.autorizada,
      cStat: ret.cStat,
      xMotivo: ret.xMotivo,
      nProt: ret.nProt,
      nSeqEvento: seq,
      tpEvento: tp,
    };
  } catch (e) {
    if (e instanceof functions.https.HttpsError) throw e;
    throw new functions.https.HttpsError('internal', `Falha no Evento RTC: ${e.message}`);
  }
});

// Compartilhado apenas pelo módulo MDF-e do backend; não é uma API callable.
exports.__mdfeInternals = {
  assertTenantAccess,
  hasFiscalAdminPermission,
  sanitizePathSegment,
  descriptografarPFXdoStorage,
  assinarXMLcomForge,
  postSefaz,
  parseSefazResponse,
  stripXmlDecl,
  toFiscalDateTime,
  extrairConteudoTag,
  extrairBlocoTag,
};
