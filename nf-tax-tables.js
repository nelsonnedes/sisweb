/**
 * nf-tax-tables.js — Tabelas fiscais oficiais + gates CRT×código (NF-e)
 * Sisweb — NF-e Sistema Multi-Tenant
 *
 * FONTES (hierarquia MOC > NT > XSD > SEFAZ > NFePHP > código):
 *  - MOC NF-e 4.00: CST ICMS (00–90), CSOSN (101–900), CST PIS/COFINS
 *    (01–99), CRT (1/2/3), finNFe (1–4), indPres (0–5,9), CFOP.
 *  - XSD oficial PL_010f (vendorizado em tests/schemas/nfe):
 *    TCST=\d{3}, TcClassTrib=\d{6}, TcCredPres=\d{2}, TDevTrib, TEnteGov,
 *    ICMS02/15/53/61, PISQtde/COFINSQtde, gDevTrib, vItem/vNFTot.
 *  - Portal Nacional da NF-e → Documentos → Diversos (tabelas RTC,
 *    atualizadas por Informe Técnico — NUNCA versionar códigos aqui):
 *    Tabela cClassTrib, Tabela CST IBS/CBS, Tabela cCredPres,
 *    Tabela Alíquotas CBS. Regra estrutural oficial (IT 2024.001):
 *    os 3 primeiros dígitos do cClassTrib são idênticos ao CST.
 *  - NFePHP sped-nfe master (cross-check): TraitTagDetICMS/IBSCBS/IS/Total.
 *
 * ANTI-OBSOLESCÊNCIA (orientação expressa): cClassTrib/cCredPres têm
 * centenas de códigos atualizados por IT — o app NÃO mantém select fixo.
 * Valida por FORMATO + regra estrutural (prefixo=CST) e expõe TABLE_META
 * (fonte/versão/URL) para conferência e futura carga administrativa.
 */
(function () {
  'use strict';

  // ─── Metadados das tabelas oficiais (conferência, não código fixo) ─────
  const TABLE_META = {
    cClassTrib: {
      tabela: 'Tabela de Código de Classificação Tributária do IBS e da CBS',
      fonte: 'Portal Nacional da NF-e → Documentos → Diversos',
      informe: 'IT 2025.002 v1.60 (publicada em 23/06/2026; atualizada por IT)',
      url: 'http://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/NJarYc9nus=',
      regra: 'Os 3 primeiros dígitos do cClassTrib são idênticos ao CST-IBS/CBS (IT 2024.001)',
      formatoXSD: 'TcClassTrib = \\d{6}',
    },
    cstIBS: {
      tabela: 'Tabela CST IBS/CBS',
      fonte: 'Portal Nacional da NF-e → Documentos → Diversos',
      formatoXSD: 'TCST = \\d{3}',
    },
    cCredPres: {
      tabela: 'Tabela de Código de Crédito Presumido do IBS e CBS',
      fonte: 'Portal Nacional da NF-e → Documentos → Diversos',
      formatoXSD: 'TcCredPres = \\d{2}',
    },
    aliqCBS: {
      tabela: 'Tabela de Alíquotas da CBS',
      fonte: 'Portal Nacional da NF-e → Documentos → Diversos',
      informe: 'Publicada em 12/05/2026',
    },
  };

  // ─── CST ICMS — Regime Normal / Excesso sublimite (MOC 4.00) ────────────
  const CST_ICMS_FULL = {
    '00': 'Tributada integralmente',
    '10': 'Tributada e com cobrança por ST',
    '20': 'Com redução de base de cálculo',
    '30': 'Isenta ou não tributada com ST',
    '40': 'Isenta',
    '41': 'Não tributada',
    '50': 'Suspensão',
    '51': 'Diferimento',
    '60': 'ICMS cobrado anteriormente por ST',
    '70': 'Redução de base e cobrança por ST',
    '90': 'Outros',
    // Monofásicos adRem (NT 2023.001 — mesmos do NFePHP TraitTagDetICMS)
    '02': 'Monofásica própria sobre combustíveis',
    '15': 'Monofásica própria com retenção sobre combustíveis',
    '53': 'Monofásica sobre combustíveis com diferimento',
    '61': 'Monofásica sobre combustíveis cobrada anteriormente',
  };
  const CST_ICMS_MONO = ['02', '15', '53', '61'];

  // ─── CSOSN — Simples Nacional (MOC 4.00) ────────────────────────────────
  const CSOSN_FULL = {
    '101': 'Tributada SN com permissão de crédito',
    '102': 'Tributada SN sem permissão de crédito',
    '103': 'Isenção SN para faixa de receita bruta',
    '201': 'Tributada SN com crédito e com ST',
    '202': 'Tributada SN sem crédito e com ST',
    '203': 'Isenção SN para faixa de receita e com ST',
    '300': 'Imune',
    '400': 'Não tributada SN',
    '500': 'ICMS cobrado anteriormente por ST/antecipação',
    '900': 'Outros',
  };

  // ─── CST PIS/COFINS (MOC 4.00) + grupo de emissão ──────────────────────
  // aliq: PISAliq/COFINSAliq | qtde: PISQtde/COFINSQtde (CST 03) | nt: PISNT/COFINSNT
  const CST_PIS_COFINS_FULL = {
    '01': ['Tributável alíquota básica', 'aliq'],
    '02': ['Tributável alíquota diferenciada', 'aliq'],
    '03': ['Tributável quantidade vendida × alíquota por unidade', 'qtde'],
    '04': ['Monofásica revenda a alíquota zero', 'nt'],
    '05': ['Substituição tributária', 'nt'],
    '06': ['Alíquota zero', 'nt'],
    '07': ['Isenta', 'nt'],
    '08': ['Sem incidência', 'nt'],
    '09': ['Suspensa', 'nt'],
    '49': ['Outras operações de saída', 'nt'],
    '50': ['Crédito vinc. receita tributada mercado interno', 'nt'],
    '51': ['Crédito vinc. receita não tributada mercado interno', 'nt'],
    '52': ['Crédito vinc. receita de exportação', 'nt'],
    '53': ['Crédito vinc. receitas trib. e não trib. mercado interno', 'nt'],
    '54': ['Crédito vinc. receitas trib. mercado interno e exportação', 'nt'],
    '55': ['Crédito vinc. receitas não trib. mercado interno e exportação', 'nt'],
    '56': ['Crédito vinc. receitas trib./não trib. mercado interno e exportação', 'nt'],
    '60': ['Crédito presumido aquisição vinc. receita tributada MI', 'nt'],
    '61': ['Crédito presumido aquisição vinc. receita não trib. MI', 'nt'],
    '62': ['Crédito presumido aquisição vinc. receita de exportação', 'nt'],
    '63': ['Outras operações de crédito', 'nt'],
    '64': ['Crédito vinc. receitas mistas', 'nt'],
    '65': ['Crédito vinc. exportação', 'nt'],
    '66': ['Crédito presumido', 'nt'],
    '67': ['Outros créditos', 'nt'],
    '70': ['Aquisição sem direito a crédito', 'nt'],
    '71': ['Isenção (sem direito a crédito)', 'nt'],
    '72': ['Suspensão (sem direito a crédito)', 'nt'],
    '73': ['Alíquota zero (sem direito a crédito)', 'nt'],
    '74': ['Sem incidência (sem direito a crédito)', 'nt'],
    '75': ['Substituição tributária (sem direito a crédito)', 'nt'],
    '98': ['Outras operações de entrada', 'nt'],
    '99': ['Outras operações', 'nt'],
  };

  // ─── Finalidade (finNFe) e presença (indPres) — MOC 4.00 ────────────────
  const FIN_NFE = {
    '1': 'Normal',
    '2': 'Complementar',
    '3': 'Ajuste',
    '4': 'Devolução',
  };
  const IND_PRES = {
    '0': 'Não se aplica',
    '1': 'Operação presencial',
    '2': 'Não presencial — Internet',
    '3': 'Não presencial — Teleatendimento',
    '4': 'NFC-e entrega em domicílio',
    '5': 'Presencial fora do estabelecimento',
    '9': 'Não presencial — outros',
  };

  // ─── Gates CRT × código ────────────────────────────────────────────────
  // CRT 1/2 (SN/excesso) → SOMENTE CSOSN; CRT 3 (Normal) → SOMENTE CST.
  // Cruzar = rejeição SEFAZ (ex.: 931 CSOSN incompatível com CRT).
  function regimeDoCRT(crt) {
    const c = String(crt ?? '').trim();
    if (c === '1' || c === '2') return 'sn';
    if (c === '3') return 'normal';
    return '';
  }

  function validarCodigoICMS(crt, codigo) {
    const cod = String(codigo ?? '').trim();
    const reg = regimeDoCRT(crt);
    if (!reg) return { ok: false, grupo: '', erro: `CRT inválido (${crt || 'vazio'}) — informe 1, 2 ou 3` };
    if (!cod) return { ok: false, grupo: '', erro: 'Código ICMS/CSOSN não informado no item' };
    if (reg === 'sn') {
      if (CSOSN_FULL[cod]) return { ok: true, grupo: 'csosn', erro: '' };
      if (CST_ICMS_FULL[cod]) {
        return { ok: false, grupo: 'cst', erro: `CST ${cod} com CRT ${crt} (Simples): use CSOSN — CST de Regime Normal com CRT 1/2 é rejeitado pela SEFAZ` };
      }
      return { ok: false, grupo: '', erro: `CSOSN ${cod} inválido (MOC: 101–900)` };
    }
    if (CST_ICMS_FULL[cod]) return { ok: true, grupo: 'cst', erro: '' };
    if (CSOSN_FULL[cod]) {
      return { ok: false, grupo: 'csosn', erro: `CSOSN ${cod} com CRT 3 (Regime Normal): use CST ICMS — CSOSN com CRT 3 é rejeitado pela SEFAZ (cStat 931)` };
    }
    return { ok: false, grupo: '', erro: `CST ${cod} inválido (MOC: 00–90)` };
  }

  function grupoPISCOFINS(cst) {
    const e = CST_PIS_COFINS_FULL[String(cst ?? '').trim()];
    return e ? e[1] : '';
  }

  function descreverPISCOFINS(cst) {
    const e = CST_PIS_COFINS_FULL[String(cst ?? '').trim()];
    return e ? e[0] : '';
  }

  // ─── RTC: validação estrutural (sem select obsoleto) ───────────────────
  // IT 2024.001: prefixo do cClassTrib (3 dígitos) === CST.
  function validarCClassTrib(cst, code) {
    const c = String(cst ?? '').trim();
    const k = String(code ?? '').trim();
    if (!/^\d{3}$/.test(c)) return { ok: false, erro: `CST IBS/CBS inválido (${c || 'vazio'}) — 3 dígitos (TCST)` };
    if (!/^\d{6}$/.test(k)) return { ok: false, erro: `cClassTrib inválido (${k || 'vazio'}) — 6 dígitos (TcClassTrib)` };
    if (k.slice(0, 3) !== c) {
      return { ok: false, erro: `cClassTrib ${k} incompatível com CST ${c} — os 3 primeiros dígitos devem ser idênticos ao CST (IT 2024.001)` };
    }
    return { ok: true, erro: '' };
  }

  function validarCCredPres(code) {
    const k = String(code ?? '').trim();
    if (!k) return { ok: true, erro: '' }; // opcional
    if (!/^\d{2}$/.test(k)) return { ok: false, erro: `cCredPres inválido (${k}) — 2 dígitos, tabela oficial Portal NF-e` };
    return { ok: true, erro: '' };
  }

  const api = {
    TABLE_META,
    CST_ICMS_FULL, CST_ICMS_MONO, CSOSN_FULL, CST_PIS_COFINS_FULL,
    FIN_NFE, IND_PRES,
    regimeDoCRT, validarCodigoICMS, grupoPISCOFINS, descreverPISCOFINS,
    validarCClassTrib, validarCCredPres,
  };
  if (typeof window !== 'undefined') window.NFTaxTables = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  return api;
})();
