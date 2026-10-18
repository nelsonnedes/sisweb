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
  stripXmlDecl,
  toFiscalDateTime,
  extrairConteudoTag,
  extrairBlocoTag,
  escapeXml,
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

const MDFE_NS = 'http://www.portalfiscal.inf.br/mdfe';

// SOAP 1.2: a operação dos web services MDF-e/SVRS viaja no parâmetro
// `action` do Content-Type — mesmo mecanismo homologado da NF-e
// (soapActionFor em nf-functions.js). Operações dos WSDLs SVRS:
// MDFeRecepcaoSinc/mdfeRecepcao, MDFeConsulta/mdfeConsulta,
// MDFeRecepcaoEvento/mdfeRecepcaoEvento.
const MDFE_SOAP_ACTIONS = {
  MDFeRecepcaoSinc: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoSinc/mdfeRecepcao',
  MDFeConsulta: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta/mdfeConsulta',
  MDFeRecepcaoEvento: 'http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeRecepcaoEvento/mdfeRecepcaoEvento',
};

function mdfeSoapAction(service) {
  return MDFE_SOAP_ACTIONS[service] || '';
}

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
    const signedXml = assinarXMLcomForge(xml, pfx, senhaA1, { tagName: 'infMDFe', idPrefix: 'MDFe', namespace: MDFE_NS });
    // MDFeRecepcaoSinc (SVRS): o conteúdo do <mdfeDadosMsg> é o MDF-e SEM a
    // declaração <?xml?> e SEM wrapper enviMDFe, comprimido em gzip e
    // codificado em base64 — exigência do serviço síncrono. Referência
    // homologada: NFePHP sped-mdfe Tools::sefazEnviaLote (indSinc=1 →
    // base64_encode(gzencode($sxml))). O envio cru gerava HTTP 400 vazio.
    const payload = require('zlib').gzipSync(Buffer.from(stripXmlDecl(signedXml), 'utf8')).toString('base64');
    const response = await postSefaz(MDFe_ENDPOINTS[env].MDFeRecepcaoSinc, mdfeSoap('MDFeRecepcaoSinc', payload, cUF), pfx, senhaA1, mdfeSoapAction('MDFeRecepcaoSinc'));
    const result = parseSefazResponse(response.body, ['100', '150']);
    const respostaNaoParseada = result.cStat === '999';
    if (respostaNaoParseada) {
      functions.logger.warn(`[mdfe_emitir] Resposta não parseada | HTTP ${response.status} | body: ${String(response.body || '').slice(0, 1200)}`);
    }
    const status = result.autorizada ? 'autorizado' : 'rejeitado';
    const xmlStoragePath = await persistXml(tenantId, mdfeId, signedXml);
    await updateMdfe(tenantId, mdfeId, { status, chaveAcesso: key, cStat: result.cStat, xMotivo: result.xMotivo, protocolo: result.nProt, xmlStoragePath, enviadoEm: new Date().toISOString(), ...(respostaNaoParseada ? { erroMsg: `HTTP ${response.status}: ${String(response.body || '').slice(0, 600)}` } : {}) });
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
  const env = environment(data.ambiente);

  try {
    const access = await assertMdfeAdmin(context, tenantId);
    const pfx = await descriptografarPFXdoStorage(tenantId, access.uid, senhaA1);
    const payload = `<consSitMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00"><tpAmb>${env === 'producao' ? 1 : 2}</tpAmb><xServ>CONSULTAR</xServ><chMDFe>${key}</chMDFe></consSitMDFe>`;
    const response = await postSefaz(MDFe_ENDPOINTS[env].MDFeConsulta, mdfeSoap('MDFeConsulta', payload, key.slice(0, 2)), pfx, senhaA1, mdfeSoapAction('MDFeConsulta'));
    const result = parseSefazResponse(response.body, ['100', '101', '150'], { first: true });
    const bodyConsulta = String(response.body || '');

    // A SEFAZ pode retornar múltiplos <cStat>: um do documento MDF-e principal
    // e outro(s) de evento(s) vinculado(s) (ex.: NF-e referenciada cancelada
    // com cStat 216, ou MDF-e encerrado com cStat 135).
    const eventoCodes = new Set(['135', '136', '155', '215', '216', '217']);
    const allCStat = result.allCStat || [result.cStat];
    const allXMotivo = result.allXMotivo || [result.xMotivo];

    let cStatIdx = 0;
    if (allCStat.length > 1) {
      const naoEvento = allCStat.findIndex((c) => !eventoCodes.has(c));
      cStatIdx = naoEvento >= 0 ? naoEvento : 0;
    }

    const cStatPrincipal = allCStat[cStatIdx] || '999';
    const xMotivoPrincipal = allXMotivo[cStatIdx] || result.xMotivo || 'Resposta não parseada';

    functions.logger.info(`[mdfe_consultar] cStat principal=${cStatPrincipal} (todos=${allCStat.join(',')}) | xMotivo=${xMotivoPrincipal}`);

    if (cStatPrincipal === '999') {
      functions.logger.warn(`[mdfe_consultar] Resposta não parseada | HTTP ${response.status} | body: ${bodyConsulta.slice(0, 1200)}`);
    }
    // Situação real: eventos vinculados no procEventoMDFe (110112 encerramento /
    // 110111 cancelamento) definem se o documento está Encerrado/Cancelado.
    const tpEvento = extrairConteudoTag(bodyConsulta, 'tpEvento');
    const cStatEvento = extrairConteudoTag(extrairBlocoTag(bodyConsulta, 'retEventoMDFe'), 'cStat');
    const eventoOk = ['135', '136', '155', '101'].includes(cStatEvento);
    const situacao = ((tpEvento === '110111' || tpEvento === '110112') && eventoOk)
      ? (tpEvento === '110112' ? 'encerrado' : 'cancelado')
      : (['100', '150'].includes(cStatPrincipal) ? 'autorizado'
        : (cStatPrincipal === '217' ? 'nao_encontrado' : 'indefinida'));
    const statusDerivado = situacao === 'encerrado' ? 'encerrado'
      : (situacao === 'cancelado' ? 'cancelado'
        : (situacao === 'autorizado' ? 'autorizado' : ''));
    await updateMdfe(tenantId, mdfeId, {
      chaveAcesso: key,
      ...(statusDerivado ? { status: statusDerivado } : {}),
      ultimaConsultaSefaz: {
        cStat: cStatPrincipal,
        xMotivo: xMotivoPrincipal,
        situacao,
        tpEvento,
        cStatEvento,
        em: new Date().toISOString(),
      },
    });
    return {
      autorizada: situacao === 'autorizado' || situacao === 'encerrado',
      cancelado: situacao === 'cancelado',
      situacao,
      cStat: cStatPrincipal,
      xMotivo: xMotivoPrincipal,
      protocolo: result.nProt,
      tpEvento,
      cStatEvento,
    };
  } catch (error) {
    functions.logger.error('[mdfe_consultar] Erro:', (error && error.message) || error, (error && error.stack) || '');
    if (error instanceof functions.https.HttpsError) throw error;
    const msg = String((error && error.message) || error || '');
    if (/senha|mac verify|pkcs12|password/i.test(msg)) {
      throw httpsError('invalid-argument', 'Senha do certificado A1 inválida.');
    }
    if (/certificado|pfx|chave privada/i.test(msg)) {
      throw httpsError('failed-precondition', 'Certificado A1 não configurado ou inválido para esta empresa.');
    }
    if (/timeout/i.test(msg)) {
      throw httpsError('deadline-exceeded', 'A SEFAZ não respondeu a tempo. Tente novamente.');
    }
    throw httpsError('internal', `Falha na consulta do MDF-e: ${msg || 'erro desconhecido'}`);
  }
});

exports.mdfe_encerrar = onMdfeCall(async (data, context) => {
  if (!context.auth) throw httpsError('unauthenticated', 'Autenticação obrigatória.');
  const tenantId = sanitizePathSegment(data.tenantId, 'tenantId');
  const mdfeId = sanitizePathSegment(data.mdfeId, 'mdfeId');
  const key = requireAccessKey(data.chave);
  const nProt = digits(data.nProt);
  if (!/^\d{15}$/.test(nProt)) throw httpsError('invalid-argument', 'Protocolo de autorização (nProt, 15 dígitos) é obrigatório para o encerramento.');
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
    + `<dhEvento>${toFiscalDateTime()}</dhEvento><tpEvento>110112</tpEvento><nSeqEvento>${sequence}</nSeqEvento>`
    + `<detEvento versaoEvento="3.00"><evEncMDFe><descEvento>Encerramento</descEvento><nProt>${nProt}</nProt><dtEnc>${dtEnc}</dtEnc><cUF>${cMunEnc.slice(0, 2)}</cUF><cMun>${cMunEnc}</cMun></evEncMDFe></detEvento>`
    + `</infEvento></eventoMDFe>`;
  try {
    const pfx = await descriptografarPFXdoStorage(tenantId, access.uid, senhaA1);
    const signedEvent = assinarXMLcomForge(event, pfx, senhaA1, { tagName: 'infEvento', idPrefix: 'ID', namespace: MDFE_NS });
    // MDFeRecepcaoEvento recebe o eventoMDFe DIRETO (sem wrapper envEventoMDFe —
    // referência NFePHP sped-mdfe Tools::sefazEvento; o wrapper gerava cStat 215
    // "envEventoMDFe element is not declared").
    const payload = signedEvent;
    const response = await postSefaz(MDFe_ENDPOINTS[env].MDFeRecepcaoEvento, mdfeSoap('MDFeRecepcaoEvento', payload, key.slice(0, 2)), pfx, senhaA1, mdfeSoapAction('MDFeRecepcaoEvento'));
    const result = parseSefazResponse(response.body, ['135', '136', '155']);
    await updateMdfe(tenantId, mdfeId, { status: result.autorizada ? 'encerrado' : 'erro_encerramento', cStat: result.cStat, xMotivo: result.xMotivo, protocoloEncerramento: result.nProt, dataEncerramento: dtEnc, municipioEncerramento: cMunEnc });
    return { encerrado: result.autorizada, cStat: result.cStat, xMotivo: result.xMotivo, protocolo: result.nProt };
  } catch (error) {
    await updateMdfe(tenantId, mdfeId, { status: 'erro_encerramento', erroMsg: error.message }).catch(() => {});
    if (error instanceof functions.https.HttpsError) throw error;
    throw httpsError('internal', `Falha no encerramento MDF-e: ${error.message}`);
  }
});

// Cancelamento (tpEvento 110111 — Ajuste SINIEF 21/2010, cláusula 13ª: até
// 24h da autorização e transporte não iniciado; nunca de MDF-e encerrado).
// Mesmo envelope do encerramento: eventoMDFe DIRETO (sem wrapper).
exports.mdfe_cancelar = onMdfeCall(async (data, context) => {
  if (!context.auth) throw httpsError('unauthenticated', 'Autenticação obrigatória.');
  const tenantId = sanitizePathSegment(data.tenantId, 'tenantId');
  const mdfeId = sanitizePathSegment(data.mdfeId, 'mdfeId');
  const key = requireAccessKey(data.chave);
  const nProt = digits(data.nProt);
  if (!/^\d{15}$/.test(nProt)) throw httpsError('invalid-argument', 'Protocolo de autorização (nProt, 15 dígitos) é obrigatório para o cancelamento.');
  const xJust = String(data.xJust || '').trim().slice(0, 255);
  if (xJust.length < 15) throw httpsError('invalid-argument', 'Justificativa do cancelamento (mín. 15 caracteres, MOC) é obrigatória.');
  const senhaA1 = String(data.senhaA1 || '');
  if (!senhaA1) throw httpsError('invalid-argument', 'Senha do certificado A1 é obrigatória.');
  const access = await assertMdfeAdmin(context, tenantId);
  const config = await readFiscalConfig(tenantId);
  const cnpj = requireCnpj(config.empresa && config.empresa.cnpj);
  const env = environment(data.ambiente);
  const sequence = String(Number(data.nSeqEvento) || 1).padStart(3, '0');
  const eventId = `ID110111${key}${sequence.slice(-2)}`;
  const event = `<eventoMDFe xmlns="http://www.portalfiscal.inf.br/mdfe" versao="3.00"><infEvento Id="${eventId}">`
    + `<cOrgao>${key.slice(0, 2)}</cOrgao><tpAmb>${env === 'producao' ? 1 : 2}</tpAmb><CNPJ>${cnpj}</CNPJ><chMDFe>${key}</chMDFe>`
    + `<dhEvento>${toFiscalDateTime()}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>${sequence}</nSeqEvento>`
    + `<detEvento versaoEvento="3.00"><evCancMDFe><descEvento>Cancelamento</descEvento><nProt>${nProt}</nProt><xJust>${escapeXml(xJust)}</xJust></evCancMDFe></detEvento>`
    + `</infEvento></eventoMDFe>`;
  try {
    const pfx = await descriptografarPFXdoStorage(tenantId, access.uid, senhaA1);
    const signedEvent = assinarXMLcomForge(event, pfx, senhaA1, { tagName: 'infEvento', idPrefix: 'ID', namespace: MDFE_NS });
    // Mesmo padrão do encerramento: eventoMDFe direto (wrapper gerava cStat 215).
    const payload = signedEvent;
    const response = await postSefaz(MDFe_ENDPOINTS[env].MDFeRecepcaoEvento, mdfeSoap('MDFeRecepcaoEvento', payload, key.slice(0, 2)), pfx, senhaA1, mdfeSoapAction('MDFeRecepcaoEvento'));
    const result = parseSefazResponse(response.body, ['135', '136', '155']);
    await updateMdfe(tenantId, mdfeId, { status: result.autorizada ? 'cancelado' : 'erro_cancelamento', cStat: result.cStat, xMotivo: result.xMotivo, protocoloCancelamento: result.nProt, dataCancelamento: toFiscalDateTime(), justificativaCancelamento: xJust });
    return { cancelado: result.autorizada, cStat: result.cStat, xMotivo: result.xMotivo, protocolo: result.nProt };
  } catch (error) {
    await updateMdfe(tenantId, mdfeId, { status: 'erro_cancelamento', erroMsg: error.message }).catch(() => {});
    if (error instanceof functions.https.HttpsError) throw error;
    throw httpsError('internal', `Falha no cancelamento MDF-e: ${error.message}`);
  }
});
