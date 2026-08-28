/**
 * Cloud Functions MDF-e: sequencia, autorizacao, consulta e encerramento.
 * O certificado A1 permanece no backend e o XML e transmitido via mTLS.
 */
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nf = require('./nf-functions');

const {
  assertTenantAccess,
  hasFiscalAdminPermission,
  sanitizePathSegment,
  descriptografarPFXdoStorage,
  assinarXMLcomForge,
  postSefaz,
  parseSefazResponse,
} = nf.__mdfeInternals;

const MDFe_ENDPOINTS = {
  homologacao: {
    MDFeRecepcaoSinc: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx',
    MDFeConsulta: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx',
    MDFeRecepcaoEvento: 'https://mdfe-homologacao.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx',
  },
  producao: {
    MDFeRecepcaoSinc: 'https://mdfe.svrs.rs.gov.br/ws/MDFeRecepcaoSinc/MDFeRecepcaoSinc.asmx',
    MDFeConsulta: 'https://mdfe.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx',
    MDFeRecepcaoEvento: 'https://mdfe.svrs.rs.gov.br/ws/MDFeRecepcaoEvento/MDFeRecepcaoEvento.asmx',
  },
};

const UF_CODES = {
  AC: '12', AL: '27', AP: '16', AM: '13', BA: '29', CE: '23', DF: '53', ES: '32',
  GO: '52', MA: '21', MT: '51', MS: '50', MG: '31', PA: '15', PB: '25', PR: '41',
  PE: '26', PI: '22', RJ: '33', RN: '24', RS: '43', RO: '11', RR: '14', SC: '42',
  SP: '35', SE: '28', TO: '17',
};

function onMdfeCall(handler) {
  return functions.https.onCall(async (requestOrData, maybeContext) => {
    const isV2 = requestOrData && typeof requestOrData === 'object'
      && Object.prototype.hasOwnProperty.call(requestOrData, 'data')
      && (Object.prototype.hasOwnProperty.call(requestOrData, 'auth')
        || Object.prototype.hasOwnProperty.call(requestOrData, 'rawRequest'));
    return handler(isV2 ? requestOrData.data || {} : requestOrData || {}, isV2 ? requestOrData : maybeContext || {});
  });
}

function httpsError(code, message) {
  return new functions.https.HttpsError(code, message);
}

function digits(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

function requireAccessKey(value) {
  const key = digits(value);
  if (!/^\d{44}$/.test(key)) throw httpsError('invalid-argument', 'Chave MDF-e deve conter 44 dígitos.');
  return key;
}

function requireCnpj(value) {
  const cnpj = digits(value);
  if (!/^\d{14}$/.test(cnpj)) throw httpsError('invalid-argument', 'CNPJ do emitente deve conter 14 dígitos.');
  return cnpj;
}

function requireMunicipio(value) {
  const code = digits(value);
  if (!/^\d{7}$/.test(code) || code === '0000000') {
    throw httpsError('invalid-argument', 'Código IBGE do município deve conter 7 dígitos.');
  }
  return code;
}

function environment(value) {
  return String(value || '').toLowerCase() === 'producao' ? 'producao' : 'homologacao';
}

function mdfeSoap(service, payload, cUF) {
  const ns = `http://www.portalfiscal.inf.br/mdfe/wsdl/${service}`;
  return `<?xml version="1.0" encoding="UTF-8"?>`
    + `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:mdfe="${ns}">`
    + `<soap:Header><mdfeCabecMsg xmlns="${ns}"><cUF>${cUF}</cUF><cVersao>3.00</cVersao></mdfeCabecMsg></soap:Header>`
    + `<soap:Body><mdfeDadosMsg xmlns="${ns}">${payload}</mdfeDadosMsg></soap:Body></soap:Envelope>`;
}

function extractXmlValue(xml, tag) {
  const match = String(xml || '').match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1] : '';
}

function extractMdfeKey(xml) {
  const match = String(xml || '').match(/<infMDFe[^>]*\sId="MDFe(\d{44})"/i);
  if (!match) throw httpsError('invalid-argument', 'XML MDF-e sem Id válido.');
  return match[1];
}

function validateXml(xml) {
  if (!/<MDFe\b/i.test(String(xml || '')) || !/<infMDFe\b/i.test(String(xml || ''))) {
    throw httpsError('invalid-argument', 'XML MDF-e inválido ou ausente.');
  }
  return String(xml);
}

async function assertMdfeAdmin(context, tenantId) {
  const access = await assertTenantAccess(context, tenantId);
  if (!hasFiscalAdminPermission(access)) throw httpsError('permission-denied', 'Usuário sem permissão fiscal para operar MDF-e.');
  return access;
}

async function readFiscalConfig(tenantId) {
  const snapshot = await admin.database().ref(`companies/${tenantId}/fiscal/config`).get();
  return snapshot.exists() && snapshot.val() && typeof snapshot.val() === 'object' ? snapshot.val() : {};
}

async function persistXml(tenantId, mdfeId, xml) {
  const storagePath = `companies/${tenantId}/fiscal/xmls/mdfe/${mdfeId}.xml`;
  await admin.storage().bucket().file(storagePath).save(Buffer.from(xml, 'utf8'), {
    resumable: false,
    contentType: 'application/xml',
    metadata: { contentType: 'application/xml', metadata: { tenantId, mdfeId } },
  });
  return storagePath;
}

async function updateMdfe(tenantId, mdfeId, patch) {
  await admin.database().ref(`companies/${tenantId}/fiscal/mdfe/${mdfeId}`).update({
    ...patch,
    id: mdfeId,
    tenantId,
    updatedAt: new Date().toISOString(),
  });
}

exports.mdfe_reservarNumero = onMdfeCall(async (data, context) => {
  if (!context.auth) throw httpsError('unauthenticated', 'Autenticação obrigatória.');
  const tenantId = sanitizePathSegment(data.tenantId, 'tenantId');
  await assertMdfeAdmin(context, tenantId);
  const ref = admin.database().ref(`companies/${tenantId}/fiscal/sequences/mdfe`);
  const transaction = await ref.transaction((current) => {
    const next = Number(current && current.nextNumero) || 1;
    return { nextNumero: next + 1, updatedAt: new Date().toISOString() };
  });
  if (!transaction.committed) throw httpsError('aborted', 'Não foi possível reservar a numeração MDF-e.');
  const value = transaction.snapshot.val() || {};
  return { numero: Number(value.nextNumero) - 1 };
});

exports.mdfe_emitir = onMdfeCall(async (data, context) => {
  if (!context.auth) throw httpsError('unauthenticated', 'Autenticação obrigatória.');
  const tenantId = sanitizePathSegment(data.tenantId, 'tenantId');
  const mdfeId = sanitizePathSegment(data.mdfeId, 'mdfeId');
  const xml = validateXml(data.xml);
  const senhaA1 = String(data.senhaA1 || '');
  if (!senhaA1) throw httpsError('invalid-argument', 'Senha do certificado A1 é obrigatória.');
  const access = await assertMdfeAdmin(context, tenantId);
  const key = extractMdfeKey(xml);
  const config = await readFiscalConfig(tenantId);
  const configuredCnpj = requireCnpj(config.empresa && config.empresa.cnpj);
  const xmlCnpj = extractXmlValue(xml, 'CNPJ');
  if (xmlCnpj && digits(xmlCnpj) !== configuredCnpj) throw httpsError('invalid-argument', 'CNPJ do XML diverge do emitente configurado.');
  const env = environment(data.ambiente);
  const cUF = key.slice(0, 2);
  if (!Object.values(UF_CODES).includes(cUF)) throw httpsError('invalid-argument', 'UF do MDF-e inválida.');

  try {
    const pfx = await descriptografarPFXdoStorage(tenantId, access.uid, senhaA1);
    const signedXml = assinarXMLcomForge(xml, pfx, senhaA1, { tagName: 'infMDFe', idPrefix: 'MDFe' });
    const payload = `<enviMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00"><idLote>${Date.now()}</idLote><indSinc>1</indSinc>${signedXml}</enviMDFe>`;
    const response = await postSefaz(MDFe_ENDPOINTS[env].MDFeRecepcaoSinc, mdfeSoap('MDFeRecepcaoSinc', payload, cUF), pfx, senhaA1);
    const result = parseSefazResponse(response.body, ['100', '150']);
    const status = result.autorizada ? 'autorizado' : 'rejeitado';
    const xmlStoragePath = await persistXml(tenantId, mdfeId, signedXml);
    await updateMdfe(tenantId, mdfeId, { status, chaveAcesso: key, cStat: result.cStat, xMotivo: result.xMotivo, protocolo: result.nProt, xmlStoragePath, enviadoEm: new Date().toISOString() });
    return { status, autorizada: result.autorizada, chaveAcesso: key, cStat: result.cStat, xMotivo: result.xMotivo, protocolo: result.nProt };
  } catch (error) {
    await updateMdfe(tenantId, mdfeId, { status: 'erro_envio', chaveAcesso: key, erroMsg: error.message }).catch(() => {});
    if (error instanceof functions.https.HttpsError) throw error;
    throw httpsError('internal', `Falha no envio MDF-e: ${error.message}`);
  }
});

exports.mdfe_consultar = onMdfeCall(async (data, context) => {
  if (!context.auth) throw httpsError('unauthenticated', 'Autenticação obrigatória.');
  const tenantId = sanitizePathSegment(data.tenantId, 'tenantId');
  const mdfeId = sanitizePathSegment(data.mdfeId, 'mdfeId');
  const key = requireAccessKey(data.chave);
  const senhaA1 = String(data.senhaA1 || '');
  if (!senhaA1) throw httpsError('invalid-argument', 'Senha do certificado A1 é obrigatória.');
  const access = await assertMdfeAdmin(context, tenantId);
  const env = environment(data.ambiente);
  const pfx = await descriptografarPFXdoStorage(tenantId, access.uid, senhaA1);
  const payload = `<consSitMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00"><tpAmb>${env === 'producao' ? 1 : 2}</tpAmb><xServ>CONSULTAR</xServ><chMDFe>${key}</chMDFe></consSitMDFe>`;
  const response = await postSefaz(MDFe_ENDPOINTS[env].MDFeConsulta, mdfeSoap('MDFeConsulta', payload, key.slice(0, 2)), pfx, senhaA1);
  const result = parseSefazResponse(response.body, ['100', '101', '150']);
  await updateMdfe(tenantId, mdfeId, { cStat: result.cStat, xMotivo: result.xMotivo, protocolo: result.nProt, chaveAcesso: key });
  return { autorizada: result.autorizada, cStat: result.cStat, xMotivo: result.xMotivo, protocolo: result.nProt };
});

exports.mdfe_encerrar = onMdfeCall(async (data, context) => {
  if (!context.auth) throw httpsError('unauthenticated', 'Autenticação obrigatória.');
  const tenantId = sanitizePathSegment(data.tenantId, 'tenantId');
  const mdfeId = sanitizePathSegment(data.mdfeId, 'mdfeId');
  const key = requireAccessKey(data.chave);
  const cMunEnc = requireMunicipio(data.cMunEnc);
  const senhaA1 = String(data.senhaA1 || '');
  if (!senhaA1) throw httpsError('invalid-argument', 'Senha do certificado A1 é obrigatória.');
  const access = await assertMdfeAdmin(context, tenantId);
  const config = await readFiscalConfig(tenantId);
  const cnpj = requireCnpj(config.empresa && config.empresa.cnpj);
  const env = environment(data.ambiente);
  const sequence = String(Number(data.nSeqEvento) || 1).padStart(3, '0');
  const eventId = `ID110112${key}${sequence.slice(-2)}`;
  const dtEnc = String(data.dtEnc || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dtEnc)) throw httpsError('invalid-argument', 'Data de encerramento inválida.');
  const event = `<eventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00"><infEvento Id="${eventId}">`
    + `<cOrgao>${key.slice(0, 2)}</cOrgao><tpAmb>${env === 'producao' ? 1 : 2}</tpAmb><CNPJ>${cnpj}</CNPJ><chMDFe>${key}</chMDFe>`
    + `<dhEvento>${new Date().toISOString().replace('Z', '-03:00')}</dhEvento><tpEvento>110112</tpEvento><nSeqEvento>${sequence}</nSeqEvento>`
    + `<detEvento versaoEvento="3.00"><evEncMDFe><descEvento>Encerramento</descEvento><dtEnc>${dtEnc}</dtEnc><cMunEnc>${cMunEnc}</cMunEnc></evEncMDFe></detEvento>`
    + `</infEvento></eventoMDFe>`;
  try {
    const pfx = await descriptografarPFXdoStorage(tenantId, access.uid, senhaA1);
    const signedEvent = assinarXMLcomForge(event, pfx, senhaA1, { tagName: 'infEvento', idPrefix: 'ID' });
    const payload = `<envEventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00"><idLote>${Date.now()}</idLote>${signedEvent}</envEventoMDFe>`;
    const response = await postSefaz(MDFe_ENDPOINTS[env].MDFeRecepcaoEvento, mdfeSoap('MDFeRecepcaoEvento', payload, key.slice(0, 2)), pfx, senhaA1);
    const result = parseSefazResponse(response.body, ['135', '136', '155']);
    await updateMdfe(tenantId, mdfeId, { status: result.autorizada ? 'encerrado' : 'erro_encerramento', cStat: result.cStat, xMotivo: result.xMotivo, protocoloEncerramento: result.nProt, dataEncerramento: dtEnc, municipioEncerramento: cMunEnc });
    return { encerrado: result.autorizada, cStat: result.cStat, xMotivo: result.xMotivo, protocolo: result.nProt };
  } catch (error) {
    await updateMdfe(tenantId, mdfeId, { status: 'erro_encerramento', erroMsg: error.message }).catch(() => {});
    if (error instanceof functions.https.HttpsError) throw error;
    throw httpsError('internal', `Falha no encerramento MDF-e: ${error.message}`);
  }
});
