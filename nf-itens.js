/**
 * nf-itens.js — Lógica de Construção e Reconciliação de Itens da NF-e (A23)
 * Sisweb — NF-e Sistema Multi-Tenant
 *
 * Desacopla as regras de montagem, validação e tributação de itens
 * de notas-fiscais.html, eliminando código duplicado entre os modos
 * manual, cadastrado e edição de itens.
 */
(function () {
  'use strict';

  function parseMoeda(v) {
    if (typeof v === 'number') return v;
    const s = String(v || '').replace(/[^\d,.-]/g, '').replace(',', '.');
    return parseFloat(s) || 0;
  }

  /**
   * Valida o NCM estruturalmente: 8 dígitos e não genérico (00000000).
   * A tabela TIPI oficial não é versionada no app — sem validação semântica.
   */
  function validarNCM(ncm) {
    const ncmD = String(ncm || '').replace(/\D/g, '');
    if (ncmD.length !== 8) return { valid: false, erro: 'NCM deve ter 8 dígitos' };
    if (/^0+$/.test(ncmD)) return { valid: false, erro: 'NCM 00000000 é genérico — informe o NCM real da mercadoria' };
    return { valid: true };
  }

  /**
   * CFOP canônico (NFTaxTables via NFValidator). Centraliza os 3 usos deste
   * módulo para não divergir do validador de entrada (4xxx/8xxx/9xxx rejeitados).
   */
  function cfopCanonicoValido(cfop) {
    const cfopD = String(cfop || '').trim();
    if (window.NFValidator?.validarCFOP) return window.NFValidator.validarCFOP(cfopD);
    if (window.NFTaxTables?.validarCFOP) return window.NFTaxTables.validarCFOP(cfopD);
    return /^[123567]\d{3}$/.test(cfopD);
  }

  /**
   * Valida dados brutos de entrada de item (comum ao modo manual, cadastrado e edição).
   * @returns {{ valid: boolean, erro?: string }}
   */
  function validarEntradaItem({ nome, qtd, vUnit, ncm, cfop }) {
    if (!nome || !String(nome).trim()) return { valid: false, erro: 'Informe o nome do produto' };
    if (!(parseFloat(qtd) > 0)) return { valid: false, erro: 'Quantidade deve ser maior que zero' };
    if (!(parseFloat(vUnit) > 0)) return { valid: false, erro: 'Valor unitário inválido' };
    const ncmVal = validarNCM(ncm);
    if (!ncmVal.valid) return ncmVal;
    const cfopD = String(cfop || '').trim();
    const cfopValido = cfopCanonicoValido(cfopD);
    if (!cfopValido) return { valid: false, erro: 'CFOP inválido (ex: 5102, 6102)' };
    return { valid: true };
  }

  /**
   * Cria um item fiscal completo e consistente para NF-e.
   * Aplica hierarquia: Natureza da Operação > Item/Produto > Configuração Global.
   */
  function criarItemFiscal(params = {}) {
    const {
      id = 'it_' + Date.now(),
      cProd = 'MANUAL_' + Date.now(),
      xProd = '',
      ncm = '00000000',
      cfop = '5102',
      uCom = 'UN',
      qCom = 1,
      vUnCom = 0,
      csosn = '102',
      cest = '',
      orig = '0',
      importado = false,
      natOpId = '',
      cfg = {},
      ufDest = 'SP',
    } = params;

    const ncmLimpo = String(ncm || '').replace(/\D/g, '').padStart(8, '0');
    const cestLimpo = String(cest || '').replace(/\D/g, '');
    const qtd = parseFloat(qCom) || 0;
    const unit = parseFloat(vUnCom) || 0;
    const total = Math.round((qtd * unit) * 100) / 100;

    // 1. Resolver regra da Natureza da Operação
    const nat = natOpId && window.NFNaturezas?.getById ? window.NFNaturezas.getById(natOpId) : null;
    const cfopNat = (nat?.cfopPadrao || '').trim();
    const codNat = (nat?.csosn || '').trim();
    const crt = window.NFConfigService?.getCRT?.(cfg.empresa?.regime) ?? 1;
    // Naturezas padrão guardam CSOSN (Simples). Em CRT 3 (Regime Normal) o
    // CSOSN é rejeitado pela SEFAZ (cStat 931) — só prevalece se for válido.
    const codNatOk = codNat && (!window.NFTaxTables?.validarCodigoICMS
      || window.NFTaxTables.validarCodigoICMS(crt, codNat).ok);

    let cfopEff = (cfopNat && cfopCanonicoValido(cfopNat)) ? cfopNat : cfop;
    let csosnEff = codNatOk ? codNat : csosn;

    const item = {
      id,
      cProd,
      xProd: String(xProd).trim(),
      ncm: ncmLimpo,
      cfop: cfopEff,
      uCom: (window.SiswebUnidades ? SiswebUnidades.fiscal(uCom || 'UN') : String(uCom || 'UN').trim().toUpperCase()),
      uTrib: (window.SiswebUnidades ? SiswebUnidades.fiscal(uCom || 'UN') : String(uCom || 'UN').trim().toUpperCase()),
      qCom: qtd,
      vUnCom: unit,
      vProd: total,
      csosn: csosnEff,
      cest: cestLimpo || undefined,
      importado: !!importado || undefined,
    };

    // 2. Resolver regras finas da Natureza (Fase B - Destino x Produto)
    let regraNat = null;
    if (nat && window.NFNaturezas?.resolverRegra) {
      regraNat = window.NFNaturezas.resolverRegra(nat, {
        ufDest,
        ncm: ncmLimpo,
        produtoId: cProd,
      });
      if (regraNat && window.NFNaturezas?.aplicarRegraNoItem) {
        window.NFNaturezas.aplicarRegraNoItem(item, regraNat);
      }
    }

    // 3. Calcular Impostos
    item.imposto = item.imposto || {};
    const ufOrig = cfg.empresa?.endereco?.uf || 'SP';

    // ICMS
    const icmsCalc = window.NFConfigService?.calcularICMS
      ? window.NFConfigService.calcularICMS(cfg, ufOrig, ufDest, total, { importado: !!item.importado })
      : { vBC: 0, vICMS: 0 };

    item.imposto.icms = {
      ...icmsCalc,
      csosn: item.csosn,
      orig: String(orig || '0'),
    };

    // Regime Normal (CRT 3): define CST no ICMS
    if (String(crt) === '3' && /^[0-9]{2}$/.test(item.csosn || '')) {
      item.imposto.icms.cst = item.csosn;
    }

    // PIS / COFINS
    const pc = window.NFConfigService?.calcularPISCOFINS
      ? window.NFConfigService.calcularPISCOFINS(cfg, total)
      : { pis: { cST: '07' }, cofins: { cST: '07' } };
    item.imposto.pis = item.imposto.pis || pc.pis;
    item.imposto.cofins = item.imposto.cofins || pc.cofins;

    // IPI
    const ipi = window.NFConfigService?.calcularIPI?.(cfg, total);
    if (ipi) item.imposto.ipi = ipi;

    // IBS / CBS (RTC): só emite quando habilitado explicitamente na config fiscal.
    const ibscbs = window.NFConfigService?.calcularIBSCBS?.(cfg, total);
    if (ibscbs) item.imposto.ibscbs = ibscbs;

    // IS (Imposto Seletivo)
    const isSel = window.NFConfigService?.calcularIS?.(cfg, total);
    if (isSel) item.imposto.is = isSel;

    return item;
  }

  /**
   * Recalcula os impostos de um item existente preservando dados do produto.
   */
  function recalcularImpostosItem(item, { cfg = {}, ufDest = 'SP', natOpId = '' } = {}) {
    const total = parseFloat(item.vProd || item.total) || 0;
    const nat = natOpId && window.NFNaturezas?.getById ? window.NFNaturezas.getById(natOpId) : null;
    const cfopNat = (nat?.cfopPadrao || '').trim();
    const codNat = (nat?.csosn || '').trim();
    const crt = window.NFConfigService?.getCRT?.(cfg.empresa?.regime) ?? 1;
    const codNatOk = codNat && (!window.NFTaxTables?.validarCodigoICMS
      || window.NFTaxTables.validarCodigoICMS(crt, codNat).ok);

    if (cfopNat && cfopCanonicoValido(cfopNat)) item.cfop = cfopNat;
    const codPadrao = String(crt) === '3'
      ? (cfg.impostos?.icms?.cst || '00')
      : (cfg.impostos?.icms?.csosn || '102');
    const codEff = (codNatOk ? codNat : '')
      || item.csosn || item.imposto?.icms?.csosn || item.imposto?.icms?.cst
      || codPadrao;
    item.csosn = codEff;

    const ufOrig = cfg.empresa?.endereco?.uf || 'SP';

    const imposto = {
      ...(item.imposto || {}),
      icms: item.imposto?.icms || { csosn: item.csosn, orig: 0 },
      pis: item.imposto?.pis || { cST: '07' },
      cofins: item.imposto?.cofins || { cST: '07' },
    };

    try {
      imposto.icms = {
        ...window.NFConfigService?.calcularICMS?.(cfg, ufOrig, ufDest, total, { importado: !!item.importado }) || { vBC: 0, pICMS: 0, vICMS: 0 },
        csosn: item.csosn,
        orig: item.imposto?.icms?.orig ?? 0,
      };
      if (String(crt) === '3' && /^[0-9]{2}$/.test(item.csosn || '')) {
        imposto.icms.cst = item.csosn;
      }
      const pc = window.NFConfigService?.calcularPISCOFINS?.(cfg, total) || { pis: { cST: '07' }, cofins: { cST: '07' } };
      imposto.pis = pc.pis;
      imposto.cofins = pc.cofins;
      const ipi = window.NFConfigService?.calcularIPI?.(cfg, total);
      if (ipi) imposto.ipi = ipi;
      else delete imposto.ipi;
      const ibscbs = window.NFConfigService?.calcularIBSCBS?.(cfg, total);
      if (ibscbs) imposto.ibscbs = ibscbs;
      else delete imposto.ibscbs;
      const isSel = window.NFConfigService.calcularIS?.(cfg, total);
      if (isSel) imposto.is = isSel;
      else delete imposto.is;
    } catch (_) {}

    item.imposto = imposto;
    return imposto;
  }

  const api = {
    validarNCM,
    validarEntradaItem,
    criarItemFiscal,
    recalcularImpostosItem,
    parseMoeda,
  };

  if (typeof window !== 'undefined') window.NFItens = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
