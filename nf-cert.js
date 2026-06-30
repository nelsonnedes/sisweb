/**
 * nf-cert.js — Gerenciamento de Certificado Digital
 * Suporte: A1 (.pfx/.p12) | A3 Token | A3 Nuvem (BirdID, SafeID, VaultID)
 * Sisweb — NF-e Sistema Multi-Tenant
 *
 * SEGURANÇA:
 *  - PFX nunca trafega em claro após upload
 *  - Criptografia AES-256-GCM no browser antes de salvar
 *  - Chave derivada do UID do usuário via PBKDF2
 *  - Armazenado no Firebase Storage com rules restritas por tenant
 *  - Assinatura XML delegada à Cloud Function (proxy mTLS seguro)
 */

const NFCertService = (() => {
  'use strict';

  // ─── Tipos suportados ──────────────────────────────────────────────────────
  const TIPOS = {
    A1:     'Certificado A1 (arquivo .pfx/.p12)',
    A3:     'Certificado A3 (Token/Smartcard USB)',
    nuvem:  'Certificado A3 em Nuvem (BirdID / SafeID / VaultID)',
  };

  const PROVEDORES_NUVEM = {
    birdid:  { nome: 'BirdID',  url: 'https://birdid.com.br/api' },
    safeid:  { nome: 'SafeID',  url: 'https://cav.certisign.com.br' },
    vaultid: { nome: 'VaultID', url: 'https://vaultid.com.br/api' },
  };

  const MAX_A1_FILE_SIZE = 5 * 1024 * 1024;

  function arrayBufferToBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
  }

  // ─── Criptografar PFX no browser (AES-256-GCM + PBKDF2) ──────────────────
  async function encryptPFX(pfxArrayBuffer, uid, password) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(uid + password),
      { name: 'PBKDF2' }, false, ['deriveKey']
    );
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, ['encrypt']
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key, pfxArrayBuffer
    );
    // Empacotar: [salt(16)] + [iv(12)] + [ciphertext]
    const result = new Uint8Array(16 + 12 + encrypted.byteLength);
    result.set(salt, 0);
    result.set(iv, 16);
    result.set(new Uint8Array(encrypted), 28);
    return result.buffer;
  }

  // ─── Extrair metadados do PFX (via forge — carregado externamente) ─────────
  async function extrairMetadadosPFX(pfxArrayBuffer, senha) {
    if (!window.forge) {
      throw new Error('Biblioteca node-forge não carregada. Adicione o script forge.min.js.');
    }
    try {
      const bytes = new Uint8Array(pfxArrayBuffer);
      const der   = String.fromCharCode(...bytes);
      const asn1  = forge.asn1.fromDer(der);
      const p12   = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

      // Extrair certificado
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag  = (certBags[forge.pki.oids.certBag] || [])[0];
      if (!certBag || !certBag.cert) throw new Error('Certificado não encontrado no PFX');

      const cert    = certBag.cert;
      const subject = cert.subject.attributes.reduce((acc, a) => {
        acc[a.shortName] = a.value; return acc;
      }, {});
      const issuer  = cert.issuer.attributes.reduce((acc, a) => {
        acc[a.shortName] = a.value; return acc;
      }, {});

      const notBefore = cert.validity.notBefore;
      const notAfter  = cert.validity.notAfter;
      const agora     = new Date();
      const diasRestantes = Math.ceil((notAfter - agora) / 86400000);

      // Extrair CNPJ do campo CN ou serialNumber
      const cn = subject.CN || '';
      const cnpjMatch = cn.match(/(\d{14})/);
      const cnpj = cnpjMatch ? cnpjMatch[1] : '';

      return {
        titular:        cn,
        cnpj,
        emissor:        issuer.O || issuer.CN || '',
        validoDe:       notBefore.toISOString(),
        validoAte:      notAfter.toISOString(),
        diasRestantes,
        expirado:       diasRestantes <= 0,
        proximoVencer:  diasRestantes > 0 && diasRestantes <= 30,
        serial:         cert.serialNumber,
      };
    } catch (e) {
      throw new Error(`Erro ao ler certificado: ${e.message}. Verifique a senha.`);
    }
  }

  // ─── Upload de certificado A1 ─────────────────────────────────────────────
  async function uploadCertificadoA1(tenantId, uid, pfxFile, senha) {
    if (!pfxFile) throw new Error('Arquivo de certificado não selecionado');
    if (!senha)   throw new Error('Senha do certificado é obrigatória');
    if (!tenantId) throw new Error('Tenant não identificado para salvar o certificado.');
    if (!uid || uid === 'local') throw new Error('Sessão autenticada não encontrada para proteger o certificado.');
    if (Number(pfxFile.size || 0) > MAX_A1_FILE_SIZE) {
      throw new Error('O certificado A1 deve ter no máximo 5MB para o upload seguro.');
    }

    const pfxBuffer = await pfxFile.arrayBuffer();

    // 1. Extrair metadados (valida senha)
    const meta = await extrairMetadadosPFX(pfxBuffer, senha);
    if (meta.expirado) throw new Error(`Certificado expirado em ${new Date(meta.validoAte).toLocaleDateString('pt-BR')}`);

    // 2. Criptografar antes de salvar
    const encrypted = await encryptPFX(pfxBuffer, uid, senha);
    const encryptedPfxBase64 = arrayBufferToBase64(encrypted);

    // 3. Delegar persistência ao backend para cortar escrita direta no browser
    const certMeta = await chamarCloudFunction('nf_uploadCertificadoA1', {
      tenantId,
      originalFileName: pfxFile.name || '',
      encryptedPfxBase64,
      certMeta: {
        titular: meta.titular,
        cnpjCert: meta.cnpj,
        emissor: meta.emissor,
        validoDe: meta.validoDe,
        validoAte: meta.validoAte,
        serial: meta.serial,
      },
    });
    if (!certMeta || certMeta.tipo !== 'A1') {
      throw new Error('Cloud Function de certificado retornou resposta inválida.');
    }
    return certMeta;
  }

  // ─── Carregar PFX descriptografado para uso (apenas em memória) ────────────
  async function carregarPFXDescriptografado() {
    throw new Error('Leitura local do certificado A1 não é suportada; a assinatura ocorre no backend seguro.');
  }

  async function carregarMetadadosDireto(tenantId) {
    const svc = window.firebaseService || null;
    if (!svc || !tenantId) return { status: 'unavailable', data: null };
    let successfulRead = false;
    try {
      if (typeof svc.loadFromFirebase === 'function') {
        const canonical = await svc.loadFromFirebase(`companies/${tenantId}/fiscal/certificado`);
        successfulRead = true;
        const canonicalData = canonical && canonical.success ? canonical.data : canonical && typeof canonical === 'object' ? canonical.data : null;
        if (canonicalData && typeof canonicalData === 'object') return { status: 'found', data: canonicalData };
      }
    } catch (_) {}
    try {
      const dbService = svc.dbService || null;
      if (dbService && typeof dbService.getDatabase === 'function' && typeof dbService.ref === 'function' && typeof dbService.get === 'function') {
        const db = dbService.getDatabase();
        const legacySnap = await dbService.get(dbService.ref(db, `tenants/${tenantId}/config-fiscal/certificado`));
        successfulRead = true;
        if (legacySnap && typeof legacySnap.exists === 'function' && legacySnap.exists()) {
          const legacyData = legacySnap.val();
          if (legacyData && typeof legacyData === 'object') return { status: 'found', data: legacyData };
        }
      }
    } catch (_) {}
    return successfulRead ? { status: 'missing', data: null } : { status: 'unavailable', data: null };
  }

  // ─── Carregar metadados do certificado ────────────────────────────────────
  async function carregarMetadados(tenantId) {
    if (!tenantId) return null;
    const directMeta = await carregarMetadadosDireto(tenantId);
    if (directMeta && directMeta.status === 'found') return directMeta.data;
    if (directMeta && directMeta.status === 'missing') return null;
    const result = await chamarCloudFunction('nf_obterResumoCertificadoFiscal', { tenantId });
    return result && result.meta && typeof result.meta === 'object' ? result.meta : null;
  }

  async function salvarReferenciaCertificado(tenantId, certMeta) {
    if (!tenantId) throw new Error('Tenant não identificado.');
    if (!certMeta || typeof certMeta !== 'object') throw new Error('Metadados do certificado inválidos.');
    return chamarCloudFunction('nf_salvarReferenciaCertificado', {
      tenantId,
      certMeta,
    });
  }

  // ─── Verificar status do certificado ──────────────────────────────────────
  function verificarStatusCertificado(meta) {
    if (!meta) return { ok: false, status: 'nao_configurado', msg: 'Certificado digital não configurado' };
    if (meta.tipo === 'token' || meta.tipo === 'A3') {
      return {
        ok: false,
        status: 'ponte_local_requerida',
        msg: 'Certificado A3 Token/Cartão configurado. A emissão exige ponte local homologada; o navegador não acessa o token diretamente.',
        bloqueiaEmissao: true
      };
    }
    if (meta.tipo === 'nuvem') {
      if (!meta.integracaoAtiva) {
        return {
          ok: false,
          status: 'nuvem_nao_integrada',
          msg: 'Certificado A3 em nuvem selecionado. A integração OAuth/API do provedor ainda precisa ser ativada.',
          bloqueiaEmissao: true
        };
      }
    }
    const agora = new Date();
    const valido = meta.validoAte ? new Date(meta.validoAte) : null;
    if (valido && valido < agora) {
      return { ok: false, status: 'expirado', msg: `Certificado expirado em ${valido.toLocaleDateString('pt-BR')}` };
    }
    const dias = meta.diasRestantes || 0;
    if (dias <= 30) {
      return { ok: true, status: 'proximo_vencer', msg: `Certificado vence em ${dias} dias`, alerta: true };
    }
    return { ok: true, status: 'valido', msg: `Válido até ${valido?.toLocaleDateString('pt-BR') || 'N/A'}` };
  }

  async function verificarPonteA3Local(bridgeUrl) {
    const url = String(bridgeUrl || 'http://127.0.0.1:37773').replace(/\/+$/, '');
    if (window.SiswebA3Bridge && typeof window.SiswebA3Bridge.health === 'function') {
      try {
        const result = await window.SiswebA3Bridge.health();
        return { ok: result !== false, mode: 'native-object', detail: result || null };
      } catch (error) {
        return { ok: false, mode: 'native-object', error: error.message };
      }
    }
    if (typeof fetch !== 'function' || typeof AbortController !== 'function') {
      return { ok: false, mode: 'unavailable', error: 'Ambiente sem fetch/AbortController para testar ponte local.' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    try {
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) return { ok: false, mode: 'http', status: response.status };
      let detail = null;
      try { detail = await response.json(); } catch (_) {}
      return { ok: true, mode: 'http', url, detail };
    } catch (error) {
      return { ok: false, mode: 'http', url, error: error.name === 'AbortError' ? 'Timeout ao verificar ponte local.' : error.message };
    } finally {
      clearTimeout(timer);
    }
  }

  async function salvarReferenciaA3Token(tenantId, uid, options = {}) {
    if (!tenantId) throw new Error('Tenant não identificado.');
    const payload = {
      tipo: 'token',
      modo: 'local-bridge',
      bridgeRequired: true,
      status: 'aguardando_ponte_local',
      observacao: 'A3 Token/Cartão exige aplicativo local/Native Messaging/PKCS#11 para assinar NF-e.',
      bridgeUrl: String(options && options.bridgeUrl || '').trim(),
      middleware: String(options && options.middleware || '').trim(),
      bridgeUrlConfigured: !!(options && options.bridgeUrl),
      updatedAt: new Date().toISOString(),
      updatedBy: uid || ''
    };
    return salvarReferenciaCertificado(tenantId, payload);
  }

  // ─── Configurar certificado A3 Nuvem (OAuth 2.0) ─────────────────────────
  // Suporte: BirdID | SafeID (Certisign) | VaultID
  // Fluxo: Authorization Code com PKCE (RFC 7636) — sem expor client_secret no browser
  async function configurarA3Nuvem(tenantId, uid, provedor, credenciais) {
    if (!PROVEDORES_NUVEM[provedor]) throw new Error(`Provedor desconhecido: ${provedor}`);

    // ── Endpoints OAuth por provedor ────────────────────────────────────────
    const OAUTH_ENDPOINTS = {
      birdid: {
        authUrl:    'https://sign.birdid.com.br/oauth/authorize',
        tokenUrl:   'https://sign.birdid.com.br/oauth/token',
        scope:      'sign',
        clientId:   credenciais.clientId || '',
      },
      safeid: {
        authUrl:    'https://cav.certisign.com.br/oauth/authorize',
        tokenUrl:   'https://cav.certisign.com.br/oauth/token',
        scope:      'sign_nfe',
        clientId:   credenciais.clientId || '',
      },
      vaultid: {
        authUrl:    'https://api.vaultid.com.br/oauth/authorize',
        tokenUrl:   'https://api.vaultid.com.br/oauth/token',
        scope:      'openid sign',
        clientId:   credenciais.clientId || '',
      },
    };
    const ep = OAUTH_ENDPOINTS[provedor];
    if (!ep.clientId) throw new Error('clientId do provedor não informado');

    // ── PKCE: gerar code_verifier + code_challenge ───────────────────────────
    const verifier  = _gerarCodeVerifier();
    const challenge = await _gerarCodeChallenge(verifier);

    // ── Estado CSRF ──────────────────────────────────────────────────────────
    const state = crypto.getRandomValues(new Uint8Array(16))
      .reduce((s, b) => s + b.toString(16).padStart(2,'0'), '');

    // ── Redirect URI (mesma origem) ──────────────────────────────────────────
    const redirectUri = `${window.location.origin}/oauth-callback.html`;

    // ── Construir URL de autorização ─────────────────────────────────────────
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id:     ep.clientId,
      redirect_uri:  redirectUri,
      scope:         ep.scope,
      state,
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });
    const authorizationUrl = `${ep.authUrl}?${authParams}`;

    // ── Salvar state + verifier no sessionStorage para o callback ────────────
    sessionStorage.setItem('nf_oauth_state',    state);
    sessionStorage.setItem('nf_oauth_verifier', verifier);
    sessionStorage.setItem('nf_oauth_provedor', provedor);
    sessionStorage.setItem('nf_oauth_tenantId', tenantId);
    sessionStorage.setItem('nf_oauth_uid',      uid);

    // ── Abrir popup OAuth ────────────────────────────────────────────────────
    const popup = window.open(
      authorizationUrl,
      'OAuthA3Nuvem',
      'width=520,height=680,resizable=yes,scrollbars=yes'
    );
    if (!popup) throw new Error('Popup bloqueado pelo browser. Permita popups para este site.');

    // ── Aguardar resposta via postMessage do callback ────────────────────────
    const resultado = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        window.removeEventListener('message', handler);
        reject(new Error('Timeout na autenticação OAuth (5min)'));
      }, 5 * 60 * 1000);

      const handler = async (event) => {
        if (event.origin !== window.location.origin) return;
        if (!event.data?.type?.startsWith('nf_oauth_')) return;
        clearTimeout(timer);
        window.removeEventListener('message', handler);

        if (event.data.type === 'nf_oauth_error') {
          reject(new Error(event.data.error || 'Erro OAuth'));
          return;
        }
        if (event.data.type === 'nf_oauth_code') {
          // Verificar state CSRF
          if (event.data.state !== state) {
            reject(new Error('State OAuth inválido — possível CSRF'));
            return;
          }
          // Trocar code por token via Cloud Function (não expor client_secret no browser)
          try {
            const tokenResult = await chamarCloudFunction('nf_configurarCertNuvem', {
              tenantId, provedor,
              credenciais: {
                code:         event.data.code,
                clientId:     ep.clientId,
                redirectUri,
                codeVerifier: verifier,
              },
            });
            resolve(tokenResult);
          } catch (e) {
            reject(e);
          }
        }
      };
      window.addEventListener('message', handler);
    });

    // ── Salvar metadados (sem tokens em texto claro) ─────────────────────────
    const certMeta = {
      tipo:          'nuvem',
      provedor,
      nomeProvedor:  PROVEDORES_NUVEM[provedor].nome,
      configuradoEm: new Date().toISOString(),
      configuradoPor: uid,
      // Info do certificado retornada pela CF
      titular:       resultado.titular || '',
      validoAte:     resultado.validoAte || '',
      cnpjCertificado: resultado.cnpjCertificado || '',
    };
    return salvarReferenciaCertificado(tenantId, certMeta);
  }

  // ── PKCE helpers ───────────────────────────────────────────────────────────
  function _gerarCodeVerifier() {
    const arr = crypto.getRandomValues(new Uint8Array(32));
    return btoa(String.fromCharCode(...arr))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  async function _gerarCodeChallenge(verifier) {
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  // ── Verificar se token A3 Nuvem ainda é válido (via CF) ───────────────────
  async function verificarTokenNuvem(tenantId) {
    try {
      const result = await chamarCloudFunction('nf_configurarCertNuvem', {
        tenantId, acao: 'verificar',
      });
      return result;
    } catch (_) {
      return { valido: false };
    }
  }

  async function aguardarFirebaseServiceCallable(timeoutMs = 7000) {
    const deadline = Date.now() + Math.max(500, Number(timeoutMs) || 7000);
    while (Date.now() < deadline) {
      const svc = window.firebaseService || window.FirebaseService || null;
      if (svc && typeof svc.callFunction === 'function') return svc;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  // ─── Chamar Cloud Function ────────────────────────────────────────────────
  async function chamarCloudFunction(nome, dados) {
    const svc = await aguardarFirebaseServiceCallable();
    if (!svc || typeof svc.callFunction !== 'function') {
      throw new Error('Firebase Functions não configurado. Recarregue a página após o login e tente novamente.');
    }
    return svc.callFunction(nome, dados);
  }

  // ─── Assinar XML via Cloud Function (seguro — backend) ────────────────────
  async function assinarXML(tenantId, xmlString, senhaA1 = null) {
    /**
     * A assinatura NUNCA acontece no browser para A3/nuvem.
     * Para A1: enviamos o XML + PFX criptografado para a CF que assina com a chave privada.
     * A Cloud Function não retorna a chave privada, apenas o XML assinado.
     */
    const result = await chamarCloudFunction('nf_assinarXML', {
      tenantId,
      xml: xmlString,
      senhaA1: senhaA1 || null, // senha usada pela CF para descriptografar A1
    });
    if (!result || !result.xmlAssinado) {
      throw new Error(result?.erro || 'Falha na assinatura digital');
    }
    return result.xmlAssinado;
  }

  // ─── Remover certificado ──────────────────────────────────────────────────
  async function removerCertificado(tenantId) {
    if (!tenantId) throw new Error('Tenant não identificado.');
    await chamarCloudFunction('nf_removerCertificado', { tenantId });
  }

  return {
    TIPOS,
    PROVEDORES_NUVEM,
    uploadCertificadoA1,
    carregarMetadados,
    verificarStatusCertificado,
    configurarA3Nuvem,
    verificarPonteA3Local,
    salvarReferenciaA3Token,
    verificarTokenNuvem,
    assinarXML,
    removerCertificado,
    extrairMetadadosPFX,
  };
})();

window.NFCertService = NFCertService;
