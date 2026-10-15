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
    // P5 — Contingência SVC (NFe mod 55). Desligada por default (emissão normal).
    // Ativação é MANUAL e explícita por tenant (nunca automática): exige motivo
    // 15–255 chars (NFePHP Contingency; MOC Anexo III). tipo vazio = resolve
    // pela UF do emitente (SVC_POR_UF). Produção exige SEFAZ origem com SVC
    // ativo — homologar por UF antes de usar.
    contingencia: {
      ativa: false,
      tipo: '',         // '' = auto pela UF | 'SVC-AN' | 'SVC-RS'
      motivo: '',       // 15–255 chars, obrigatório ao ativar
      ativadaEm: '',    // ISO da entrada em contingência (= dhCont do XML)
      ativadaPor: '',   // uid
    },
    // Prazos de eventos fiscais (horas desde a autorização). null = sem
    // bloqueio (só informa o decorrido). PREENCHA conforme MOC/NT vigente
    // antes de ativar — nenhum valor aqui é regra oficial.
    prazosFiscais: {
      cancNFeHoras: null,
      ccNFeHoras: null,
    },
    impostos: {
      // Defaults aplicados ao criar novo item — ajustável por produto
      icms: {
        regime: 'simplesNacional',
        csosn: '102',   // Simples Nacional sem crédito (CRT 1/2)
        cst: '00',      // CST ICMS Regime Normal (CRT 3) — select por regime na UI
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
      // A14: DIFAL/partilha NÃO implementado no builder (sem ICMSUFDest).
      // Config removida para não induzir a erro — partilha exige tabela de
      // alíquotas internas por UF de destino (futura Onda 3b). Se algum dia
      // for reativado, voltar com: difal: { habilitado, aliquotaFCP, partilhaUF }.
      // Reforma Tributária (LC 214/2025 — NT 2024.002 / schema PL_010f)
      // Default HABILITADO e neutro (CST 000/cClassTrib 000001/alíq. 0):
      // a SEFAZ exige <IBSCBS> em todo item (cStat 1115 se ausente).
      ibscbs: {
        habilitado: true,
        cst: '000',
        cClassTrib: '000001',
        pIBSUF: 0,      // % alíquota IBS UF
        pIBSMun: 0,     // % alíquota IBS Município
        pCBS: 0,        // % alíquota CBS
        pRedAliq: 0,    // % redução de alíquota (gRed)
        pDif: 0,        // % diferimento (gDif)
        credPresOper: { cCredPres: '', pCredPres: 0, vBCCredPres: 0 },
      },
      is: {
        habilitado: false,
        cstIS: '',        // CST do Imposto Seletivo
        cClassTribIS: '', // Classificação Tributária do IS
        pIS: 0,           // % alíquota IS
        adRemIS: 0,       // alíquota IS por valor (opcional)
      },
      // Lei da Transparência (12.741/2012) — aproximação de tributos (IBPT)
      ibpt: {
        federal: 0, estadual: 0, municipal: 0, fonte: 'IBPT',
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
    // A15: responsável técnico do XML (infRespTec) — CNPJ da software-house
    respTec: {
      cnpj: '', xContato: '', email: '', fone: '',
    },
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

  // ─── Sincronizar o contador oficial (numeros/{modKey}) com nfe/nfce.proximoNumero ──
  // O contador real fica em fiscal/config/numeros/{nfe|nfce}.proximoNumero; o campo
  // "Próx. Número" da UI lê nfe.proximoNumero. Sem isto ficam dessincronizados após emitir.
  function aplicarContadorNaConfig(cfg) {
    try {
      const nums = cfg && cfg.numeros;
      if (nums && nums.nfe && Number.isFinite(Number(nums.nfe.proximoNumero))) {
        cfg.nfe = cfg.nfe || {};
        cfg.nfe.proximoNumero = Number(nums.nfe.proximoNumero);
      }
      if (nums && nums.nfce && Number.isFinite(Number(nums.nfce.proximoNumero))) {
        cfg.nfce = cfg.nfce || {};
        cfg.nfce.proximoNumero = Number(nums.nfce.proximoNumero);
      }
    } catch (_) {}
    return cfg;
  }

  // ─── Carregar configuração do tenant ──────────────────────────────────────
  async function loadConfig(tenantId) {
    try {
      if (!window.firebaseService) throw new Error('Firebase não inicializado');
      const directConfig = await loadConfigFromRealtime(tenantId);
      if (directConfig) {
        const merged = aplicarContadorNaConfig(deepMerge(structuredClone(DEFAULT_CONFIG), directConfig));
        try { localStorage.setItem(localKey(tenantId), JSON.stringify(merged)); } catch (_) {}
        return merged;
      }
      if (typeof window.firebaseService.callFunction === 'function') {
        const result = await window.firebaseService.callFunction('nf_obterConfiguracaoFiscal', { tenantId });
        if (result && result.config && typeof result.config === 'object') {
          const merged = aplicarContadorNaConfig(deepMerge(structuredClone(DEFAULT_CONFIG), result.config));
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

  // ─── Alíquota interestadual (Resolução do Senado 22/1989, alt. 13/2012) ───
  //  4%  → mercadoria importada (conteúdo de importação > 40%)
  //  7%  → origem Sul/Sudeste (exceto ES) para destino N/NE/CO/ES
  //  12% → demais operações interestaduais
  const UF_ORIGEM_7 = ['SP', 'RJ', 'MG', 'PR', 'SC', 'RS'];
  const UF_DESTINO_7 = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'PA', 'PB', 'PE', 'PI', 'RN', 'RO', 'RR', 'SE', 'TO'];
  function aliquotaInterestadual(ufOrigem, ufDestino, importado) {
    if (importado === true) return 4;
    const orig = String(ufOrigem || '').toUpperCase();
    const dest = String(ufDestino || '').toUpperCase();
    if (UF_ORIGEM_7.includes(orig) && UF_DESTINO_7.includes(dest)) return 7;
    return 12;
  }

  // ─── Obter alíquota ICMS para operação ───────────────────────────────────
  // opts.importado (A11): mercadoria importada (conteúdo >40%) → 4% na
  // interestadual (Res. Senado 13/2012). Retrocompatível (opts opcional).
  function calcularICMS(config, ufOrigem, ufDestino, valorProduto, opts = {}) {
    const imp = config.impostos || {};
    const icms = imp.icms || {};
    const regime = config.empresa.regime;
    const isInterestadual = ufOrigem !== ufDestino;
    const importado = opts.importado === true || icms.importado === true;
    const aliquota = isInterestadual
      ? aliquotaInterestadual(ufOrigem, ufDestino, importado)
      : (icms.aliquotaInterna || 0);

    // A3: CRT 1 (SN) e CRT 2 (excesso sublimite) usam tags CSOSN — sem
    // destaque de vBC/vICMS nos totais (antes o excesso caía no ramo normal).
    if (regime === 'simplesNacional' || regime === 'simplesExcesso') {
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

    // Regime Normal / Lucro (CRT 3 — excesso sublimite usa CST, não CSOSN)
    const cstCfg = String(icms.cst || '00').replace(/\D/g, '').padStart(2, '0').slice(-2);
    const reducao = icms.reducaoBC || 0;
    const vBC = valorProduto * (1 - reducao / 100);
    const vICMS = vBC * (aliquota / 100);
    return {
      cst: cstCfg,
      csosn: null,
      orig: '0',
      modBC: icms.modalidadeBC || '3',
      pRedBC: reducao > 0 ? reducao : undefined, // A12: CST 20/51 exige redução
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

  // ─── Reforma Tributária: IBS/CBS ─────────────────────────────────────────
  // NT 2025.002-RTC (fonte: NFePHP sped-nfe master): a partir do schema
  // PL_010 (schema > 9 no Make), TODO item de NF-e carrega <IBSCBS> —
  // cClassTrib presente liga flagIBSCBS e o grupo é exigido pela SEFAZ
  // (homologação já rejeita cStat 1115 sem ele, mesmo com CST 000/alíq. 0).
  // Por isso o default aqui é HABILITADO (CST 000, cClassTrib 000001,
  // alíquotas 0 — neutro fiscalmente) e o builder emite SEMPRE que
  // cst+cClassTrib existirem, mesmo se `habilitado` estiver ausente em
  // dado legado. Desabilitar = remover CST/cClassTrib (não só o flag).
  function calcularIBSCBS(config, valorProduto) {
    const g = (config.impostos && config.impostos.ibscbs) || {};
    // Presença de CST+cClassTrib = intenção de emitir IBSCBS (dado legado ou
    // config parcial sem o flag). Só retorna null quando AMBOS estão vazios.
    const hasTrib = String(g.cst || '').trim() !== '' && String(g.cClassTrib || '').trim() !== '';
    if (!g.habilitado && !hasTrib) return null;
    // Proveniência do neutro: valores padrão (CST 000/cClassTrib 000001/
    // alíquotas 0) SEM confirmação explícita do tenant => defaultNeutro.
    // A emissão exige opt-in (confirmDialog na NF-e) e grava a ciência na
    // config (neutroConfirmado). Sem inventar regra: só marca a origem.
    const neutro = String(g.cst || '000').trim() === '000'
      && String(g.cClassTrib || '000001').trim() === '000001'
      && !(Number(g.pIBSUF) > 0) && !(Number(g.pIBSMun) > 0) && !(Number(g.pCBS) > 0);
    const out = {
      habilitado: true,
      cst: g.cst || '000',
      cClassTrib: g.cClassTrib || '000001',
      pIBSUF: Number(g.pIBSUF) || 0,
      pIBSMun: Number(g.pIBSMun) || 0,
      pCBS: Number(g.pCBS) || 0,
      vBC: round2(valorProduto),
    };
    if (neutro && g.neutroConfirmado !== true) out.defaultNeutro = true;
    if (Number(g.pRedAliq) > 0) out.pRedAliq = Number(g.pRedAliq);
    if (Number(g.pDif) > 0) out.pDif = Number(g.pDif);
    if (g.credPresOper && g.credPresOper.cCredPres) out.credPresOper = { ...g.credPresOper };
    // Doação (TTribNFe indDoacao=1 — Fase C): flag da config fiscal
    if (g.indDoacao === '1' || g.indDoacao === 1) out.indDoacao = '1';
    // Grupos alternativos/opcionais do TTribNFe (passthrough quando informados)
    ['transfCred', 'ajusteCompet', 'estornoCred', 'credPresIBSZFM', 'mono', 'tribRegular', 'tribCompraGov', 'alcZfm', 'indDoacao'].forEach((k) => {
      if (g[k] && typeof g[k] === 'object') out[k] = { ...g[k] };
      else if (k === 'indDoacao' && (g[k] === '1' || g[k] === 1)) out[k] = '1';
    });
    return out;
  }

  // ─── Reforma Tributária: Imposto Seletivo ────────────────────────────────
  function calcularIS(config, valorProduto) {
    const g = (config.impostos && config.impostos.is) || {};
    if (!g.habilitado) return null;
    return {
      habilitado: true,
      cstIS: g.cstIS || '',
      cClassTribIS: g.cClassTribIS || '',
      pIS: Number(g.pIS) || 0,
      adRemIS: g.adRemIS != null && g.adRemIS !== '' ? Number(g.adRemIS) : null,
      vBCIS: round2(valorProduto),
    };
  }

  // ─── Validar CNPJ (canônico em NFValidator; delega em runtime) ─────────────
  function validarCNPJ(cnpj) {
    try {
      if (typeof window !== 'undefined' && window.NFValidator && typeof window.NFValidator.validarCNPJ === 'function') {
        return window.NFValidator.validarCNPJ(cnpj);
      }
    } catch (_) {}
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

  // ─── Validar CPF (canônico em NFValidator; delega em runtime) ──────────────
  function validarCPF(cpf) {
    try {
      if (typeof window !== 'undefined' && window.NFValidator && typeof window.NFValidator.validarCPF === 'function') {
        return window.NFValidator.validarCPF(cpf);
      }
    } catch (_) {}
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

  // ─── Ajustar CFOP ao tipo de operação (cStat 733) ─────────────────────────
  // 1xxx/5xxx = Interna (idDest 1); 2xxx/6xxx = Interestadual (idDest 2).
  // Troca só o 1º dígito, mantendo a operação (ex.: 5102 -> 6102).
  function ajustarCFOP(idDest, cfop) {
    const c = String(cfop || '');
    if (!/^[1256]\d{3}$/.test(c)) return c;
    const interna = String(idDest) === '1';
    const primeiro = c[0];
    if (interna) {
      if (primeiro === '6') return '5' + c.slice(1);
      if (primeiro === '2') return '1' + c.slice(1);
    } else if (String(idDest) === '2') {
      if (primeiro === '5') return '6' + c.slice(1);
      if (primeiro === '1') return '2' + c.slice(1);
    }
    return c;
  }

  // ─── Prazo de eventos (cancel/CC): decorrido desde a autorização ──────────
  // Matemática pura, sem regra fiscal embutida: o LIMITE vem da config do
  // tenant (prazosFiscais, null = sem bloqueio). Gêmea no backend
  // (avaliarPrazoEventoFiscal em nf-functions.js) — manter sincronizadas.
  function avaliarPrazoEvento(autorizadaEmIso, limiteHoras, agoraMs) {
    const ref = Date.parse(String(autorizadaEmIso || ''));
    if (!Number.isFinite(ref)) return { decorridoHoras: null, excedido: false, semReferencia: true };
    const agora = Number.isFinite(agoraMs) ? agoraMs : Date.now();
    const decorridoHoras = Math.max(0, (agora - ref) / 3600000);
    const limite = Number(limiteHoras);
    if (!Number.isFinite(limite) || limite <= 0) return { decorridoHoras, excedido: false, semReferencia: false };
    return { decorridoHoras, excedido: decorridoHoras > limite, semReferencia: false };
  }

  function formatarDecorridoHoras(decorridoHoras) {
    if (!Number.isFinite(decorridoHoras)) return 'período desconhecido';
    if (decorridoHoras < 1) return `há ${Math.max(1, Math.round(decorridoHoras * 60))} min`;
    if (decorridoHoras < 48) return `há ${Math.floor(decorridoHoras)}h${Math.round((decorridoHoras % 1) * 60)}min`;
    return `há ${Math.floor(decorridoHoras / 24)} dias`;
  }

  // ─── P5 Contingência SVC: UF → ambiente (fonte: NFePHP Contingency.md;
  // abaixo do MOC, acima do código). Gêmea no backend (SVC_POR_UF em
  // nf-functions.js) — manter sincronizadas. Tenant pode forçar o tipo
  // (override explícito), nunca inventado em silêncio.
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
  function tpEmisDeTipoSVC(tipo) {
    if (tipo === 'SVC-RS') return '7';
    if (tipo === 'SVC-AN') return '6';
    return '1';
  }
  // Valida o bloco contingencia da config (ativação manual explícita).
  // Retorna { valid, errors[] } no mesmo formato de NFValidator.
  function validarContingencia(cont) {
    const errors = [];
    const c = cont && typeof cont === 'object' ? cont : {};
    if (!c.ativa) return { valid: true, errors };
    const tipo = String(c.tipo || '').trim().toUpperCase();
    if (tipo !== '' && tipo !== 'SVC-AN' && tipo !== 'SVC-RS') {
      errors.push('Tipo de contingência inválido (use SVC-AN ou SVC-RS, ou vazio para auto pela UF)');
    }
    const motivo = String(c.motivo || '').trim();
    if (motivo.length < 15 || motivo.length > 255) {
      errors.push('Motivo da contingência obrigatório (15–255 caracteres)');
    }
    if (c.ativadaEm && Number.isNaN(new Date(c.ativadaEm).getTime())) {
      errors.push('Data de ativação da contingência inválida');
    }
    return { valid: errors.length === 0, errors };
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
    aliquotaInterestadual,
    calcularIBSCBS,
    calcularIS,
    ajustarCFOP,
    avaliarPrazoEvento,
    formatarDecorridoHoras,
    SVC_POR_UF,
    resolverTipoSVC,
    tpEmisDeTipoSVC,
    validarContingencia,
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
