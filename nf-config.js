/**
 * nf-config.js — Serviço de Configuração Fiscal Multi-Tenant
 * Gerencia: empresa, certificado, impostos, SEFAZ endpoints
 * Sisweb — NF-e Sistema
 *
 * PATH CANÔNICO: companies/{tenantId}/fiscal/config
 * (Alinhado ao namespace do firebaseService.js — não usa tenants/ para evitar
 *  duplo namespace companies/{id}/tenants/{id}/...)
 */

const NFConfigService = (() => {
  'use strict';

  // ─── Estrutura padrão de configuração fiscal ──────────────────────────────
  const DEFAULT_CONFIG = {
    empresa: {
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      ie: '',          // Inscrição Estadual
      im: '',          // Inscrição Municipal
      crt: 1,          // 1=SN, 2=SN excesso, 3=Normal
      regime: 'simplesNacional', // simplesNacional | lucroPresumido | lucroReal
      endereco: {
        logradouro: '', numero: '', complemento: '',
        bairro: '', municipio: '', uf: '',
        cep: '', pais: 'Brasil', codigoPais: '1058',
        codigoMunicipio: '',
      },
      telefone: '',
      email: '',
    },
    nfe: {
      serie: '1',
      proximoNumero: 1,
      ambiente: 'homologacao', // homologacao | producao
      cfopPadrao: '5102',
      naturezaOperacao: 'Venda de Mercadoria',
      tpImp: '1',    // 1=DANFE retrato, 2=paisagem, 5=NFC-e
      tpEmis: '1',   // 1=normal
      indFinal: '0', // 0=normal, 1=consumidor final
      indPres: '0',  // 0=não se aplica, 1=operação presencial
    },
    nfce: {
      serie: '1',
      proximoNumero: 1,
      ambiente: 'homologacao',
      cscId: '',     // ID token QR Code
      cscToken: '',  // Token CSC para QR Code
    },
    impostos: {
      // Defaults aplicados ao criar novo item — ajustável por produto
      icms: {
        regime: 'simplesNacional',
        csosn: '102',   // Simples Nacional sem crédito
        cst: null,      // null = usar CSOSN
        aliquotaInterna: 0,    // % alíquota interna (0 = Simples não destaca)
        aliquotaInterestadual: 12, // % padrão
        modalidadeBC: '3', // 3=valor da operação
        reducaoBC: 0,
      },
      pis: {
        cst: '07',   // Isenta (SN)
        aliquota: 0,
        valorBC: 0,
      },
      cofins: {
        cst: '07',   // Isenta (SN)
        aliquota: 0,
        valorBC: 0,
      },
      ipi: {
        habilitado: false,
        cst: '99',
        aliquota: 0,
      },
      difal: {
        habilitado: false,
        aliquotaFCP: 0,
        partilhaUF: 60, // % UF destino (2024: 100%)
      },
    },
    certificado: {
      tipo: null,      // 'A1' | 'A3' | 'nuvem'
      validade: null,
      titular: '',
      cnpjCert: '',
      // A1: referência criptografada no Storage (nunca o PFX direto)
      storageRef: null,
      // A3 nuvem: provedor e endpoint
      provedorNuvem: null, // 'birdid' | 'safeid' | 'vaultid'
      endpointNuvem: null,
    },
    municipiosNFSe: [], // [{ codigoIBGE, nome, uf, aliquotaISS, provedor }]
    vigencias: [],      // Histórico de configurações para auditoria
    updatedAt: null,
    createdAt: null,
  };

  // ─── Firebase path canônico para config fiscal do tenant ─────────────────
  // USA companies/{tenantId}/fiscal/config para alinhar ao namespace do
  // firebaseService.js. Paths começando com companies/ são passados sem
  // prefixação adicional pelo getNamespacedPath().
  function getConfigPath(tenantId) {
    if (!tenantId) throw new Error('tenantId é obrigatório');
    return `companies/${tenantId}/fiscal/config`;
  }

  // ─── Path de seção individual (ex: impostos, preferencias, naturezas) ─────
  function getSectionPath(tenantId, section) {
    return `${getConfigPath(tenantId)}/${section}`;
  }

  // ─── Chave localStorage ───────────────────────────────────────────────────
  function localKey(tenantId) {
    return `nf_config_${tenantId}`;
  }

  async function loadConfigFromRealtime(tenantId) {
    if (!tenantId) return null;
    const svc = window.firebaseService || null;
    if (!svc || typeof svc.loadFromFirebase !== 'function') return null;
    try {
      const result = await svc.loadFromFirebase(getConfigPath(tenantId));
      const data = result && result.success ? result.data : result && typeof result === 'object' ? result.data : null;
      return data && typeof data === 'object' ? data : null;
    } catch (_) {
      return null;
    }
  }

  // ─── Carregar configuração do tenant ──────────────────────────────────────
  async function loadConfig(tenantId) {
    try {
      if (!window.firebaseService) throw new Error('Firebase não inicializado');
      const directConfig = await loadConfigFromRealtime(tenantId);
      if (directConfig) {
        const merged = deepMerge(structuredClone(DEFAULT_CONFIG), directConfig);
        try { localStorage.setItem(localKey(tenantId), JSON.stringify(merged)); } catch (_) {}
        return merged;
      }
      if (typeof window.firebaseService.callFunction === 'function') {
        const result = await window.firebaseService.callFunction('nf_obterConfiguracaoFiscal', { tenantId });
        if (result && result.config && typeof result.config === 'object') {
          const merged = deepMerge(structuredClone(DEFAULT_CONFIG), result.config);
          // Atualizar cache local
          try { localStorage.setItem(localKey(tenantId), JSON.stringify(merged)); } catch (_) {}
          return merged;
        }
      } else {
        throw new Error('Cloud Function fiscal indisponível para leitura.');
      }
      // Tentar localStorage como fallback
      const raw = localStorage.getItem(localKey(tenantId));
      if (raw) {
        try { return deepMerge(structuredClone(DEFAULT_CONFIG), JSON.parse(raw)); } catch (_) {}
      }
      return structuredClone(DEFAULT_CONFIG);
    } catch (e) {
      console.warn('[NFConfig] Fallback localStorage:', e.message);
      const raw = localStorage.getItem(localKey(tenantId));
      if (raw) {
        try { return deepMerge(structuredClone(DEFAULT_CONFIG), JSON.parse(raw)); } catch (_) {}
      }
      return structuredClone(DEFAULT_CONFIG);
    }
  }

  // ─── Salvar configuração do tenant ────────────────────────────────────────
  async function saveConfig(tenantId, config) {
    const toSave = structuredClone(config || {});
    if (!window.firebaseService?.callFunction) {
      throw new Error('Cloud Function fiscal indisponível para salvar configurações.');
    }
    const result = await window.firebaseService.callFunction('nf_salvarConfiguracaoFiscal', {
      tenantId,
      mode: 'full',
      config: toSave,
    });
    const persisted = result && result.config && typeof result.config === 'object' ? result.config : toSave;
    localStorage.setItem(localKey(tenantId), JSON.stringify(persisted));
    console.log(`[NFConfig] Config salva via callable segura: ${getConfigPath(tenantId)}`);
    return persisted;
  }

  // ─── Salvar apenas seção específica (ex: 'impostos', 'nfe', 'empresa') ────
  async function saveConfigSection(tenantId, section, data) {
    if (!window.firebaseService?.callFunction) {
      throw new Error('Cloud Function fiscal indisponível para salvar a seção.');
    }
    const path = getSectionPath(tenantId, section);
    const payload = structuredClone(data || {});
    const result = await window.firebaseService.callFunction('nf_salvarConfiguracaoFiscal', {
      tenantId,
      mode: 'section',
      section,
      payload,
    });
    if (result && result.config && typeof result.config === 'object') {
      localStorage.setItem(localKey(tenantId), JSON.stringify(result.config));
    } else {
      const cached = localStorage.getItem(localKey(tenantId));
      if (cached) {
        try {
          const obj = JSON.parse(cached);
          obj[section] = { ...obj[section], ...payload };
          localStorage.setItem(localKey(tenantId), JSON.stringify(obj));
        } catch (_) {}
      }
    }
    console.log(`[NFConfig] Seção "${section}" salva via callable segura: ${path}`);
  }

  // ─── Obter alíquota ICMS para operação ───────────────────────────────────
  function calcularICMS(config, ufOrigem, ufDestino, valorProduto) {
    const imp = config.impostos || {};
    const icms = imp.icms || {};
    const regime = config.empresa.regime;
    const isInterestadual = ufOrigem !== ufDestino;
    const aliquota = isInterestadual
      ? (window.NFeTables?.ICMS_INTERESTADUAL?.[ufDestino] ?? 12)
      : (icms.aliquotaInterna || 0);

    if (regime === 'simplesNacional') {
      // SN geralmente não destaca ICMS — CST 102 ou CSOSN adequado
      return {
        cst: null,
        csosn: icms.csosn || '102',
        vBC: 0,
        pICMS: 0,
        vICMS: 0,
        destaca: false,
      };
    }

    // Regime Normal / Lucro
    const reducao = icms.reducaoBC || 0;
    const vBC = valorProduto * (1 - reducao / 100);
    const vICMS = vBC * (aliquota / 100);
    return {
      cst: icms.cst || '00',
      csosn: null,
      orig: '0',
      modBC: icms.modalidadeBC || '3',
      vBC: round2(vBC),
      pICMS: aliquota,
      vICMS: round2(vICMS),
      destaca: true,
    };
  }

  // ─── Obter alíquotas PIS/COFINS ───────────────────────────────────────────
  function calcularPISCOFINS(config, valorProduto) {
    const imp = config.impostos || {};
    const regime = config.empresa.regime;
    if (regime === 'simplesNacional') {
      return {
        pis:    { cST: '07', vBC: 0, pPIS:    0, vPIS:    0 },
        cofins: { cST: '07', vBC: 0, pCOFINS: 0, vCOFINS: 0 },
      };
    }
    const pisCst     = imp.pis?.cst     || '01';
    const cofCst     = imp.cofins?.cst  || '01';
    const pisAl      = imp.pis?.aliquota    || 0.65;
    const cofAl      = imp.cofins?.aliquota || 3.00;
    const vBC        = round2(valorProduto);
    return {
      pis:    { cST: pisCst, vBC, pPIS: pisAl,    vPIS:    round2(vBC * pisAl / 100) },
      cofins: { cST: cofCst, vBC, pCOFINS: cofAl, vCOFINS: round2(vBC * cofAl / 100) },
    };
  }

  // ─── Obter IPI quando habilitado na configuracao fiscal ───────────────────
  function calcularIPI(config, valorProduto) {
    const ipi = config.impostos?.ipi || {};
    if (!ipi.habilitado) return null;
    const aliquota = parseFloat(ipi.aliquota) || 0;
    const vBC = round2(valorProduto);
    const cst = String(ipi.cst || '99').replace(/\D/g, '').padStart(2, '0').slice(-2);
    return {
      cST: cst,
      CST: cst,
      cEnq: String(ipi.cEnq || '999').replace(/\D/g, '').padStart(3, '0').slice(-3),
      vBC,
      pIPI: aliquota,
      vIPI: round2(vBC * aliquota / 100),
    };
  }

  // ─── Validar CNPJ ──────────────────────────────────────────────────────────
  function validarCNPJ(cnpj) {
    const n = String(cnpj || '').replace(/\D/g, '');
    if (n.length !== 14 || /^(\d)\1+$/.test(n)) return false;
    const calc = (s, w) => {
      let sum = 0, p = w;
      for (let i = 0; i < s.length; i++) {
        sum += parseInt(s[i]) * p--;
        if (p < 2) p = 9;
      }
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(n.slice(0, 12), 5);
    const d2 = calc(n.slice(0, 13), 6);
    return parseInt(n[12]) === d1 && parseInt(n[13]) === d2;
  }

  // ─── Validar CPF ───────────────────────────────────────────────────────────
  function validarCPF(cpf) {
    const n = String(cpf || '').replace(/\D/g, '');
    if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
    const calc = (s, len) => {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += parseInt(s[i]) * (len + 1 - i);
      const r = (sum * 10) % 11;
      return r === 10 || r === 11 ? 0 : r;
    };
    return calc(n, 9) === parseInt(n[9]) && calc(n, 10) === parseInt(n[10]);
  }

  // ─── Formatar CNPJ ─────────────────────────────────────────────────────────
  function formatarCNPJ(v) {
    const n = String(v || '').replace(/\D/g, '').slice(0, 14);
    return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  // ─── Formatar CPF ──────────────────────────────────────────────────────────
  function formatarCPF(v) {
    const n = String(v || '').replace(/\D/g, '').slice(0, 11);
    return n.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }

  // ─── Formatar CEP ──────────────────────────────────────────────────────────
  function formatarCEP(v) {
    const n = String(v || '').replace(/\D/g, '').slice(0, 8);
    return n.replace(/^(\d{5})(\d{3})$/, '$1-$2');
  }

  // ─── Helper: arredondar para 2 decimais ────────────────────────────────────
  function round2(v) {
    return Math.round((parseFloat(v) || 0) * 100) / 100;
  }

  // ─── Deep merge simples ────────────────────────────────────────────────────
  function deepMerge(target, source) {
    if (!source || typeof source !== 'object') return target;
    const out = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        out[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        out[key] = source[key];
      }
    }
    return out;
  }

  // ─── Obter label de regime ────────────────────────────────────────────────
  function getRegimeLabel(regime) {
    const labels = {
      simplesNacional: 'Simples Nacional',
      simplesExcesso:  'Simples Nacional – excesso',
      lucroPresumido:  'Lucro Presumido',
      lucroReal:       'Lucro Real',
    };
    return labels[regime] || regime;
  }

  // ─── Obter CRT pelo regime ────────────────────────────────────────────────
  function getCRT(regime) {
    if (regime === 'simplesNacional') return 1;
    if (regime === 'simplesExcesso')  return 2;
    return 3;
  }

  // ─── API pública ──────────────────────────────────────────────────────────
  return {
    loadConfig,
    saveConfig,
    saveConfigSection,
    getConfigPath,
    getSectionPath,
    calcularICMS,
    calcularPISCOFINS,
    calcularIPI,
    validarCNPJ,
    validarCPF,
    formatarCNPJ,
    formatarCPF,
    formatarCEP,
    round2,
    deepMerge,
    getRegimeLabel,
    getCRT,
    DEFAULT_CONFIG,
  };
})();

window.NFConfigService = NFConfigService;
