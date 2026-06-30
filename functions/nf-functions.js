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
    NfeAutorizacao4:    'https://homologacao.nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    NfeRetAutorizacao4: 'https://homologacao.nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo4: 'https://homologacao.nfe.svrs.rs.gov.br/ws/NfeConsulta2/NfeConsulta2.asmx',
    NFeRecepcaoEvento4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NfeRecepcaoEvento4: 'https://nfe-homologacao.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NFeInutilizacao4:   'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
    NfeInutilizacao4:   'https://nfe-homologacao.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
  },
  producao: {
    NfeAutorizacao4:    'https://nfe.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
    NfeRetAutorizacao4: 'https://nfe.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
    NfeConsultaProtocolo4: 'https://nfe.svrs.rs.gov.br/ws/NfeConsulta2/NfeConsulta2.asmx',
    NFeRecepcaoEvento4: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NfeRecepcaoEvento4: 'https://nfe.svrs.rs.gov.br/ws/recepcaoevento/recepcaoevento4.asmx',
    NFeInutilizacao4:   'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
    NfeInutilizacao4:   'https://nfe.svrs.rs.gov.br/ws/nfeinutilizacao/nfeinutilizacao4.asmx',
    // UF próprias
    SP: { NfeAutorizacao4: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx' },
    MG: { NfeAutorizacao4: 'https://nfe.fazenda.mg.gov.br/nfe2/services/NFeAutorizacao4' },
  },
};

const UF_CODIGO_IBGE = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53'
};

const CCE_COND_USO = 'A Carta de Correcao e disciplinada pelo paragrafo 1o-A do art. 7o do Convenio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularizacao de erro ocorrido na emissao de documento fiscal, desde que o erro nao esteja relacionado com: I - as variaveis que determinam o valor do imposto tais como: base de calculo, aliquota, diferenca de preco, quantidade, valor da operacao ou da prestacao; II - a correcao de dados cadastrais que implique mudanca do remetente ou do destinatario; III - a data de emissao ou de saida.';

function getEndpoint(servico, ambiente, uf) {
  const env = SEFAZ_EP[ambiente] || SEFAZ_EP.homologacao;
  // UF própria?
  if (ambiente === 'producao' && env[uf] && env[uf][servico]) return env[uf][servico];
  return env[servico] || SEFAZ_EP.homologacao[servico];
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

async function assertTenantAccess(context, tenantId) {
  const uid = context && context.auth ? String(context.auth.uid || '') : '';
  const token = context && context.auth ? (context.auth.token || {}) : {};
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  if (token.superadmin === true) return { uid, tenantId, superadmin: true, userData: {}, memberData: {} };

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
    if (!snap.exists()) throw new Error('Certificado A1 não encontrado no sistema');
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
  const pfx = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pfx;
}

// ─── Assinar XML com RSA-SHA1 (XMLDSIG — exigido pela SEFAZ) ─────────────
function assinarXMLcomForge(xmlStr, pfxBuffer, senha, options = {}) {
  const forge = getForge();
  const bytes  = pfxBuffer.toString('binary');
  const asn1   = forge.asn1.fromDer(bytes);
  const p12    = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  const tagName = options.tagName || 'infNFe';
  const idPrefix = options.idPrefix || 'NFe';

  // Extrair chave privada
  const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
  const cert       = certBags[forge.pki.oids.certBag][0].cert;

  // Serializar certificado em base64
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certB64 = Buffer.from(certDer, 'binary').toString('base64');

  // Localizar tag a assinar (infNFe, infEvento ou infInut) e seu Id
  const idPattern = new RegExp(`<${tagName}[^>]*\\sId="(${idPrefix}[^"]+)"[^>]*>`, 'i');
  const idMatch = xmlStr.match(idPattern);
  if (!idMatch) throw new Error(`Atributo Id="${idPrefix}..." não encontrado em <${tagName}>`);
  const refId = idMatch[1];

  // Canonicalizar o elemento fiscal alvo (C14N simples usado pelo legado Sisweb)
  const elementPattern = new RegExp(`<${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'i');
  const signedElementMatch = xmlStr.match(elementPattern);
  if (!signedElementMatch) throw new Error(`Elemento <${tagName}> não encontrado no XML`);
  const signedElementC14n = signedElementMatch[0];

  // SHA-1 do elemento canonicalizado
  const md = forge.md.sha1.create();
  md.update(signedElementC14n, 'utf8');
  const digestB64 = Buffer.from(md.digest().bytes(), 'binary').toString('base64');

  // SignedInfo
  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">\
<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>\
<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>\
<Reference URI="#${refId}">\
<Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>\
<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/></Transforms>\
<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>\
<DigestValue>${digestB64}</DigestValue>\
</Reference></SignedInfo>`;

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

  // Injetar Signature logo após o elemento fiscal assinado
  const xmlAssinado = xmlStr.replace(signedElementMatch[0], `${signedElementMatch[0]}${signature}`);
  return xmlAssinado;
}

// ─── Wrapper SOAP para webservices SEFAZ ─────────────────────────────────
function buildSoapEnvelope(servico, xmlNFe, versaoQrNfe = '4.00', cUF = '35') {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:nfe="http://www.portalfiscal.inf.br/nfe/wsdl/${servico}">
  <soap:Header><nfeCabecMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${servico}">
    <cUF>${cUF}</cUF><cVersao>${versaoQrNfe}</cVersao>
  </nfeCabecMsg></soap:Header>
  <soap:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/${servico}">${xmlNFe}</nfeDadosMsg></soap:Body>
</soap:Envelope>`;
}

// ─── HTTP SOAP POST para SEFAZ ────────────────────────────────────────────
async function postSefaz(url, soapBody, pfxBuffer, pfxSenha) {
  const https = require('https');
  const { URL } = require('url');

  const forge = getForge();
  const pfxStr = pfxBuffer.toString('binary');
  const asn1   = forge.asn1.fromDer(pfxStr);
  const p12    = forge.pkcs12.pkcs12FromAsn1(asn1, pfxSenha);

  const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const privKeyPem = forge.pki.privateKeyToPem(keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key);
  const certPem    = forge.pki.certificateToPem(certBags[forge.pki.oids.certBag][0].cert);

  const parsed = new URL(url);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(soapBody, 'utf8'),
      },
      key:  privKeyPem,
      cert: certPem,
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

// ─── Parsear retorno SEFAZ (extrai cStat e xMotivo) ──────────────────────
function parseSefazResponse(xmlResp, successCodes = ['100', '150']) {
  const xml = String(xmlResp || '');
  const cStatMatches = Array.from(xml.matchAll(/<cStat>(\d+)<\/cStat>/g)).map((m) => m[1]);
  const xMotivoMatches = Array.from(xml.matchAll(/<xMotivo>([^<]+)<\/xMotivo>/g)).map((m) => m[1]);
  const nProtMatch  = xml.match(/<nProt>(\d+)<\/nProt>/);
  const chNFeMatch  = xml.match(/<chNFe>(\d+)<\/chNFe>/);
  const dhRecbtoMatch = xml.match(/<dhRecbto>([^<]+)<\/dhRecbto>/);
  const cStat = cStatMatches.length ? cStatMatches[cStatMatches.length - 1] : '999';
  const xMotivo = xMotivoMatches.length ? xMotivoMatches[xMotivoMatches.length - 1] : 'Resposta não parseada';
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
    const loteXml = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
      <idLote>${Date.now()}</idLote><indSinc>1</indSinc>
      ${xmlAssinado}
    </enviNFe>`;

    // Extrair UF do XML assinado para roteamento SEFAZ correto por estado
    const ufEmitMatch = xmlAssinado.match(/<UF>([A-Z]{2})<\/UF>/);
    const ufEmit = ufEmitMatch ? ufEmitMatch[1] : 'SP';

    const url  = getEndpoint('NfeAutorizacao4', env, ufEmit);
    const chaveMatch = xmlAssinado.match(/Id="NFe(\d{44})"/);
    const cUF = resolveCUF({ chave: chaveMatch ? chaveMatch[1] : '', ufEmit });
    const soap = buildSoapEnvelope('NFeAutorizacao4', loteXml, '4.00', cUF);

    functions.logger.info(`[nf_enviarSEFAZ] Enviando NF ${nfId} | UF=${ufEmit} | Amb=${env} | URL=${url}`);
    const resp = await postSefaz(url, soap, pfxBuffer, senhaA1);
    const ret  = parseSefazResponse(resp.body);

    functions.logger.info(`[nf_enviarSEFAZ] Retorno cStat=${ret.cStat} — ${ret.xMotivo}`);

    // Persistir resultado no Firebase
    const patch = {
      status:        ret.autorizada ? 'autorizada' : 'rejeitada',
      cStat:         ret.cStat,
      xMotivo:       ret.xMotivo,
      nProt:         ret.nProt,
      dhAutorizacao: ret.dhRecbto || new Date().toISOString(),
      updatedAt:     new Date().toISOString(),
    };
    await updateFiscalNote(db, tenantId, modKey, nfId, patch);

    return {
      autorizada: ret.autorizada,
      cStat:      ret.cStat,
      xMotivo:    ret.xMotivo,
      nProt:      ret.nProt,
      dhRecbto:   ret.dhRecbto,
    };
  } catch (e) {
    console.error('[nf_enviarSEFAZ] Erro:', e.message);
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
// CLOUD FUNCTION 3: nf_consultarNFe
// Consulta protocolo de autorização na SEFAZ
// ═══════════════════════════════════════════════════════════════════════════
exports.nf_consultarNFe = onFiscalCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Autenticação obrigatória');
  }
  const { tenantId: rawTenantId, chave, senhaA1, ambiente } = data || {};
  const tenantId = sanitizePathSegment(rawTenantId, 'tenantId');
  if (!chave || !senhaA1) {
    throw new functions.https.HttpsError('invalid-argument', 'tenantId, chave e senhaA1 são obrigatórios');
  }

  const { uid } = await assertTenantAccess(context, tenantId);
  const env = ambiente === 'producao' ? 'producao' : 'homologacao';

  try {
    const pfxBuffer = await descriptografarPFXdoStorage(tenantId, uid, senhaA1);
    const consultaXml = `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.01">
      <tpAmb>${env === 'producao' ? 1 : 2}</tpAmb>
      <xServ>CONSULTAR</xServ>
      <chNFe>${chave}</chNFe>
    </consSitNFe>`;

    const cUF = resolveCUF({ chave });
    const url  = getEndpoint('NfeConsultaProtocolo4', env);
    const soap = buildSoapEnvelope('NfeConsultaProtocolo4', consultaXml, '4.00', cUF);
    const resp = await postSefaz(url, soap, pfxBuffer, senhaA1);
    const ret  = parseSefazResponse(resp.body);

    return {
      cStat:   ret.cStat,
      xMotivo: ret.xMotivo,
      nProt:   ret.nProt,
      autorizada: ret.autorizada,
    };
  } catch (e) {
    throw new functions.https.HttpsError('internal', `Falha na consulta: ${e.message}`);
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
    const url  = getEndpoint('NFeRecepcaoEvento4', env);
    const soap = buildSoapEnvelope('NFeRecepcaoEvento4', eventoAssinado, '1.00', cUF);
    const resp = await postSefaz(url, soap, pfxBuffer, senhaA1);
    const ret  = parseSefazResponse(resp.body, ['135', '136', '155']);

    // Atualizar status no Firebase
    await updateFiscalNote(db, tenantId, modKey, nfId, {
      status:               ret.autorizada ? 'cancelada' : 'erro_cancelamento',
      cStatCancelamento:    ret.cStat,
      xMotivoCancelamento:  ret.xMotivo,
      dataCancelamento:     new Date().toISOString(),
      justificativaCancelamento: justificativa,
      xmlCancelamentoRetorno: ret.xmlRetorno,
      nSeqEventoCancelamento: seq,
      updatedAt:            new Date().toISOString(),
    });

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
    const url  = getEndpoint('NFeRecepcaoEvento4', env);
    const soap = buildSoapEnvelope('NFeRecepcaoEvento4', eventoAssinado, '1.00', cUF);
    const resp = await postSefaz(url, soap, pfxBuffer, senhaA1);
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
  const { tenantId: rawTenantId, modelo, serie: rawSerie, numeroInicial: rawIni, numeroFinal: rawFim, justificativa, senhaA1, ambiente, cnpjEmit, ufEmit, cUF: rawCUF, ano } = data || {};
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
    const url  = getEndpoint('NFeInutilizacao4', env);
    const soap = buildSoapEnvelope('NFeInutilizacao4', inutAssinado, '4.00', cUF);
    const resp = await postSefaz(url, soap, pfxBuffer, senhaA1);
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
