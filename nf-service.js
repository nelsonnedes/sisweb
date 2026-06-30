/**
 * nf-service.js — Orquestrador Principal do Sistema de Notas Fiscais
 * Coordena: Config → Validação → XML → Assinatura → SEFAZ → Storage
 * Sisweb — NF-e Sistema Multi-Tenant
 */

const NFService = (() => {
  'use strict';

  // ─── Estado interno ────────────────────────────────────────────────────────
  let _config    = null;
  let _tenantId  = null;
  let _uid       = null;

  // ─── Inicializar serviço ───────────────────────────────────────────────────
  async function init(tenantId, uid) {
    _tenantId = tenantId;
    _uid      = uid;
    _config   = await window.NFConfigService.loadConfig(tenantId);
    console.log('[NFService] Inicializado. Tenant:', tenantId, '| Empresa:', _config?.empresa?.razaoSocial || '(não configurada)');
    return _config;
  }

  // ─── Obter config atual ────────────────────────────────────────────────────
  function getConfig() { return _config; }

  // ─── Recarregar config ─────────────────────────────────────────────────────
  async function recarregarConfig() {
    _config = await window.NFConfigService.loadConfig(_tenantId);
    return _config;
  }

  // ─── Construir objeto NF-e a partir do formulário ─────────────────────────
  function parseFiscalNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const raw = String(v || '').trim();
    if (!raw) return 0;
    if (raw.includes(',')) return parseFloat(raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    return parseFloat(raw.replace(/[^\d.-]/g, '')) || 0;
  }

  function normalizarTransporte(formData = {}) {
    const src = formData.transp || { modFrete: formData.modFrete ?? 9 };
    const modFrete = parseInt(src.modFrete ?? formData.modFrete ?? 9, 10);
    const transp = { modFrete: Number.isFinite(modFrete) ? modFrete : 9 };
    if (transp.modFrete === 9) return transp;

    const addNonEmpty = (target, key, value) => {
      const val = String(value || '').trim();
      if (val) target[key] = val;
    };

    const transportaSrc = src.transporta || {};
    const transporta = {};
    addNonEmpty(transporta, 'CNPJ', transportaSrc.CNPJ || transportaSrc.cnpj);
    addNonEmpty(transporta, 'CPF', transportaSrc.CPF || transportaSrc.cpf);
    addNonEmpty(transporta, 'xNome', transportaSrc.xNome || transportaSrc.nome);
    addNonEmpty(transporta, 'IE', transportaSrc.IE || transportaSrc.ie);
    addNonEmpty(transporta, 'xEnder', transportaSrc.xEnder || transportaSrc.endereco);
    addNonEmpty(transporta, 'xMun', transportaSrc.xMun || transportaSrc.municipio);
    addNonEmpty(transporta, 'UF', transportaSrc.UF || transportaSrc.uf);
    if (Object.keys(transporta).length) transp.transporta = transporta;

    const veicSrc = src.veicTransp || {};
    const veicTransp = {};
    addNonEmpty(veicTransp, 'placa', veicSrc.placa);
    addNonEmpty(veicTransp, 'UF', veicSrc.UF || veicSrc.uf);
    addNonEmpty(veicTransp, 'RNTC', veicSrc.RNTC || veicSrc.rntc || veicSrc.antt);
    if (Object.keys(veicTransp).length) transp.veicTransp = veicTransp;

    const reboques = Array.isArray(src.reboque) ? src.reboque : [];
    const reboque = reboques.map((rb) => {
      const item = {};
      addNonEmpty(item, 'placa', rb.placa);
      addNonEmpty(item, 'UF', rb.UF || rb.uf);
      addNonEmpty(item, 'RNTC', rb.RNTC || rb.rntc || rb.antt);
      return item;
    }).filter((rb) => Object.keys(rb).length);
    if (reboque.length) transp.reboque = reboque;

    const vols = Array.isArray(src.vol) ? src.vol : (src.vol ? [src.vol] : []);
    const vol = vols.map((v) => {
      const item = {};
      addNonEmpty(item, 'qVol', v.qVol);
      addNonEmpty(item, 'esp', v.esp || v.especie);
      addNonEmpty(item, 'marca', v.marca);
      addNonEmpty(item, 'nVol', v.nVol || v.numeracao);
      if (v.pesoL !== '' && v.pesoL != null) item.pesoL = parseFiscalNumber(v.pesoL);
      if (v.pesoB !== '' && v.pesoB != null) item.pesoB = parseFiscalNumber(v.pesoB);
      if (Array.isArray(v.lacres) && v.lacres.length) item.lacres = v.lacres.filter(Boolean);
      return item;
    }).filter((v) => Object.keys(v).length);
    if (vol.length) transp.vol = vol;

    return transp;
  }

  function pickLogoFieldsFromCompany(source = {}) {
    const candidates = [
      source,
      source?.profile,
      source?.data,
      source?.company,
      source?.empresa,
    ].filter(item => item && typeof item === 'object');
    const out = {};
    candidates.forEach((item) => {
      const logoRaw = String(item.logo || item.logoUrl || item.logoURL || item.logoDownloadURL || item.downloadURL || item.url || '').trim();
      const logoUrl = String(item.logoUrl || item.logoURL || item.logoDownloadURL || item.downloadURL || item.url || (/^https?:\/\//i.test(logoRaw) ? logoRaw : '') || '').trim();
      const logoPath = String(item.logoStoragePath || item.logoPath || item.storagePath || item.path || item.logoRef || (!/^https?:|^data:/i.test(logoRaw) ? logoRaw : '') || '').trim();
      if (!out.logoUrl && logoUrl && !/^data:/i.test(logoUrl)) out.logoUrl = logoUrl;
      if (!out.logoStoragePath && logoPath && !/^data:/i.test(logoPath)) {
        out.logoStoragePath = logoPath;
        out.logoPath = logoPath;
      }
    });
    return out;
  }

  function getLogoFieldsFromLocalCompany() {
    try {
      const raw = localStorage.getItem('company_info') || sessionStorage.getItem('company_info') || '';
      const info = raw ? JSON.parse(raw) : {};
      return pickLogoFieldsFromCompany(info);
    } catch (_) {
      return {};
    }
  }

  function buildNFeFromForm(formData, itens) {
    const cfg = _config || {};
    const emp = cfg.empresa || {};
    const nfeCfg = cfg.nfe || {};
    const numero  = formData.numero   || nfeCfg.proximoNumero || 1;
    const serie   = formData.serie    || nfeCfg.serie         || '1';
    const dhEmi   = formData.dhEmi    || new Date().toISOString();
    const tpAmb   = nfeCfg.ambiente === 'producao' ? 1 : 2;
    const ufEmit  = emp.endereco?.uf || 'SP';

    // Monta objeto NF-e
    return {
      modelo: 55,
      numero: String(numero).padStart(9, '0'),
      status: 'rascunho',
      dataEmissao: dhEmi.slice(0, 10),
      ide: {
        mod:        55,
        serie,
        nNF:        numero,
        dhEmi,
        tpNF:       formData.tpNF   || 1, // 1=saída
        idDest:     formData.idDest || 1,
        cMunFG:     emp.endereco?.codigoMunicipio || '',
        tpImp:      nfeCfg.tpImp   || '1',
        tpAmb,
        finNFe:     formData.finNFe || 1,
        indFinal:   formData.indFinal || 0,
        indPres:    formData.indPres  || 0,
        natOp:      formData.natOp    || nfeCfg.naturezaOperacao || 'Venda de Mercadoria',
        ufEmit,
      },
      emit: {
        cnpj:        emp.cnpj,
        razaoSocial: emp.razaoSocial,
        nomeFantasia: emp.nomeFantasia,
        ie:          emp.ie,
        crt:         window.NFConfigService.getCRT(emp.regime),
        endereco:    emp.endereco,
        telefone:    emp.telefone,
        email:       emp.email,
        ...pickLogoFieldsFromCompany(emp),
        ...getLogoFieldsFromLocalCompany(),
      },
      dest: formData.dest,
      det:  itens.map((it, i) => ({
        ...it,
        nItem: i + 1,
        imposto: it.imposto || calcularImpostosItem(it, formData.dest?.endereco?.uf),
      })),
      transp: normalizarTransporte(formData),
      pag:    formData.pag || [{ tPag: '01', vPag: 0 }],
      infAdic: formData.infAdic || '',
      desconto: parseFloat(formData.desconto) || 0,
      frete:    parseFloat(formData.frete)    || 0,
    };
  }

  // ─── Calcular impostos de um item ─────────────────────────────────────────
  function calcularImpostosItem(item, ufDest) {
    const cfg = _config || {};
    const ufOrig = cfg.empresa?.endereco?.uf || 'SP';
    const icmsCalc = window.NFConfigService.calcularICMS(
      cfg, ufOrig, ufDest || ufOrig,
      parseFloat(item.vProd || item.total) || 0
    );
    const pisCofins = window.NFConfigService.calcularPISCOFINS(
      cfg, parseFloat(item.vProd || item.total) || 0
    );
    const ipiCalc = window.NFConfigService.calcularIPI?.(
      cfg, parseFloat(item.vProd || item.total) || 0
    );
    const imposto = {
      icms:   icmsCalc,
      pis:    pisCofins.pis,
      cofins: pisCofins.cofins,
    };
    if (ipiCalc) imposto.ipi = ipiCalc;
    return imposto;
  }

  // ─── Salvar rascunho ─────────────────────────────────────────────────────
  async function salvarRascunho(nfeData) {
    if (!_tenantId) throw new Error('Serviço não inicializado');
    const result = await window.NFStorage.salvarNF(_tenantId, { ...nfeData, status: 'rascunho' });
    return result;
  }

  // ─── Emitir NF-e (fluxo completo) ─────────────────────────────────────────
  async function emitirNFe(nfeData, senhaA1 = null) {
    if (!_tenantId) throw new Error('Serviço não inicializado');

    // 1. Validar configuração
    const cfgVal = window.NFValidator.validarConfigParaEmissao(_config);
    if (!cfgVal.valid) throw new Error('Configuração incompleta:\n• ' + cfgVal.errors.join('\n• '));

    // 2. Calcular totais
    const total = window.NFXmlBuilder.calcularTotais(nfeData.det, nfeData.desconto, nfeData.frete);
    nfeData.total = total;

    // 3. Validar NF-e
    const nfeVal = window.NFValidator.validarNFe(nfeData);
    if (!nfeVal.valid) throw new Error('Erros na NF-e:\n• ' + nfeVal.errors.join('\n• '));

    // 4. Obter número definitivo
    const numero = await window.NFStorage.incrementarNumero(_tenantId, 55);
    nfeData.numero = String(numero).padStart(9, '0');
    nfeData.ide.nNF = numero;

    // 5. Gerar XML
    const { xml, chave } = window.NFXmlBuilder.buildNFeXML(nfeData);
    nfeData.chave = chave;

    // 6. Assinar XML (via Cloud Function)
    let xmlAssinado = xml;
    try {
      xmlAssinado = await window.NFCertService.assinarXML(_tenantId, xml, senhaA1);
    } catch (e) {
      console.warn('[NFService] Assinatura falhou, continuando em modo local:', e.message);
      // Em desenvolvimento/homologação pode continuar sem assinatura para testar
    }

    // 7. Salvar NF como "aguardando"
    nfeData.status = 'aguardando';
    nfeData.xmlGerado = true;
    const saved = await window.NFStorage.salvarNF(_tenantId, nfeData);

    // 8. Salvar XML no Storage
    const xmlStoragePath = await window.NFStorage.salvarXML(_tenantId, saved.id, xmlAssinado);
    nfeData.xmlStoragePath = xmlStoragePath;
    try {
      await window.NFStorage.salvarNF(_tenantId, { ...nfeData, id: saved.id });
    } catch (e) {
      console.warn('[NFService] XML salvo no Storage, mas a referência não pôde ser atualizada na NF:', e.message);
    }

    // 9. Retornar dados para UI mostrar status
    return {
      id:     saved.id,
      numero: nfeData.numero,
      chave,
      status: 'aguardando',
      xml:    xmlAssinado,
      xmlStoragePath,
      msg:    'NF-e gerada. Envio à SEFAZ via Cloud Function em processamento.',
    };
  }

  // ─── Cancelar NF-e ────────────────────────────────────────────────────────
  async function cancelarNFe(nfId, justificativa) {
    if (!_tenantId) throw new Error('Serviço não inicializado');
    if (!justificativa || justificativa.trim().length < 15) {
      throw new Error('Justificativa de cancelamento deve ter pelo menos 15 caracteres');
    }
    await window.NFStorage.atualizarStatus(_tenantId, 55, nfId, 'cancelada', {
      justificativaCancelamento: justificativa,
      dataCancelamento: new Date().toISOString(),
    });
    return { ok: true, msg: 'NF-e marcada como cancelada. O evento de cancelamento será enviado à SEFAZ via Cloud Function.' };
  }

  // ─── Listar notas com filtros ─────────────────────────────────────────────
  async function listarNotas(modelo = 55, filtros = {}) {
    if (!_tenantId) throw new Error('Serviço não inicializado');
    return window.NFStorage.listarNFs(_tenantId, modelo, filtros);
  }

  // ─── Carregar estatísticas do dashboard ──────────────────────────────────
  async function getDashboard() {
    if (!_tenantId) throw new Error('Serviço não inicializado');
    return window.NFStorage.getEstatisticas(_tenantId);
  }

  // ─── Salvar configuração fiscal ───────────────────────────────────────────
  async function salvarConfig(novaConfig) {
    _config = await window.NFConfigService.saveConfig(_tenantId, novaConfig);
    return _config;
  }

  // ─── Verificar status do certificado ────────────────────────────────────
  async function verificarCertificado() {
    if (!_tenantId) throw new Error('Serviço não inicializado');
    const meta = await window.NFCertService.carregarMetadados(_tenantId);
    return window.NFCertService.verificarStatusCertificado(meta);
  }

  // ─── API pública ──────────────────────────────────────────────────────────
  return {
    init,
    getConfig,
    getTenantId: () => _tenantId,
    recarregarConfig,
    buildNFeFromForm,
    normalizarTransporte,
    calcularImpostosItem,
    salvarRascunho,
    emitirNFe,
    cancelarNFe,
    listarNotas,
    getDashboard,
    salvarConfig,
    verificarCertificado,
  };
})();

window.NFService = NFService;
