/**
 * nf-xml-builder.js — Gerador de XML NF-e Modelo 55 (schema v4.00)
 * Sisweb — NF-e Sistema Multi-Tenant
 * Ref: NT SEFAZ 2020.006 / PL_008j
 */

const NFXmlBuilder = (() => {
  'use strict';

  // ─── Namespace oficial SEFAZ ───────────────────────────────────────────────
  const NS = 'http://www.portalfiscal.inf.br/nfe';

  // ─── Sanitizar texto para XML ──────────────────────────────────────────────
  // SEFAZ (cStat 225): campos TString só aceitam Latin-1 (padrão [!-ÿ]) e sem
  // espaço no início/fim. Normaliza pontuação Unicode e remove o que não cabe.
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2013\u2014\u2015]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/[^\x20-\xFF]/g, '')
      .replace(/^\s+|\s+$/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .slice(0, 3000);
  }

  function parseFiscalNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const raw = String(v || '').trim();
    if (!raw) return 0;
    if (raw.includes(',')) return parseFloat(raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    return parseFloat(raw.replace(/[^\d.-]/g, '')) || 0;
  }

  function requireCodigoMunicipio(value, label) {
    const codigo = String(value || '').replace(/\D/g, '');
    if (!/^\d{7}$/.test(codigo) || codigo === '0000000') {
      throw new Error(`${label} obrigatório/inválido para gerar XML NF-e`);
    }
    return codigo;
  }

  // ─── Formatar número decimal ───────────────────────────────────────────────
  function num(v, dec = 2) {
    const n = parseFiscalNumber(v);
    return n.toFixed(dec);
  }

  // ─── Gerar cUF (código UF SEFAZ) ──────────────────────────────────────────
  function getCUF(uf) {
    const map = {
      AC:12,AL:27,AP:16,AM:13,BA:29,CE:23,DF:53,ES:32,GO:52,
      MA:21,MT:51,MS:50,MG:31,PA:15,PB:25,PR:41,PE:26,PI:22,
      RJ:33,RN:24,RS:43,RO:11,RR:14,SC:42,SP:35,SE:28,TO:17,
    };
    return String(map[uf] || 35);
  }

  // ─── Calcular DV da chave NF-e ────────────────────────────────────────────
  function calcDV(chave43) {
    let soma = 0, peso = 2;
    for (let i = 42; i >= 0; i--) {
      soma += parseInt(chave43[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  }

  // ─── Gerar chave NF-e (44 dígitos) ────────────────────────────────────────
  function gerarChave(emit, ide) {
    const cuf  = getCUF(emit.endereco?.uf || 'SP').padStart(2, '0');
    const aamm = new Date(ide.dhEmi).toISOString().slice(2, 7).replace('-', '');
    const cnpj = String(emit.cnpj || '').replace(/\D/g, '').padStart(14, '0');
    const mod  = String(ide.mod  || 55).padStart(2, '0');
    const serie= String(ide.serie || 1).padStart(3, '0');
    const nnf  = String(ide.nNF  || 1).padStart(9, '0');
    const temis= '1'; // emissão normal
    const cnf  = String(Math.floor(Math.random() * 99999999)).padStart(8, '0');
    const base43 = cuf + aamm + cnpj + mod + serie + nnf + temis + cnf;
    const dv   = calcDV(base43);
    return { chave: base43 + dv, cNF: cnf, cDV: String(dv) };
  }

  // ─── Bloco <ide> ──────────────────────────────────────────────────────────
  // M1 (validado em 2026-10-11 contra o schema oficial PL_010f_v1.04 —
  // leiauteNFe_v4.00.xsd): `indPag` NÃO faz parte do grupo <ide> no leiaute
  // 4.00 (existe apenas em <detPag>, minOccurs=0). Portanto NÃO deve ser
  // emitido em <ide>.
  // ─── Compras governamentais (ide > gCompraGov, TCompraGov — RTC) ───────
  // Ordem XSD: após verProc (builder não emite dhCont/xJust/gPagAntecipado).
  // Regras de refDFeAnt por tpOperGov vêm da documentação do schema oficial:
  // tpOperGov 2 = exatamente 1 chave; 3 = 1..99; 1 e 4 = vedado.
  function buildCompraGov(cg) {
    if (!cg) return '';
    const refs = Array.isArray(cg.refDFeAnt) ? cg.refDFeAnt : (cg.refDFeAnt ? [cg.refDFeAnt] : []);
    return `<gCompraGov><tpEnteGov>${esc(cg.tpEnteGov)}</tpEnteGov><pRedutor>${num(cg.pRedutor, 4)}</pRedutor><tpOperGov>${esc(cg.tpOperGov)}</tpOperGov>${refs.map((r) => `<refDFeAnt>${esc(String(r).replace(/\D/g, ''))}</refDFeAnt>`).join('')}</gCompraGov>`;
  }

  function buildIde(ide, chaveInfo) {
    // TDateTimeUTC: sem milissegundos, offset -03:00 (validado no schema oficial)
    const dhEmi = ide.dhEmi ? new Date(ide.dhEmi).toISOString().replace(/\.\d{3}Z$/, '-03:00') : '';
    // dhSaiEnt (Fase C, opcional): data/hora da saída ou entrada da mercadoria
    const dhSaiEnt = ide.dhSaiEnt ? new Date(ide.dhSaiEnt).toISOString().replace(/\.\d{3}Z$/, '-03:00') : '';
    // A4: NFref — finNFe 2/3/4 exige documento referenciado (MOC)
    const refs = Array.isArray(ide.NFref) ? ide.NFref : (ide.NFref ? [ide.NFref] : []);
    const nfrefXml = refs.map((r) => String(r || '').replace(/\D/g, '').slice(0, 44))
      .filter((r) => r.length === 44)
      .map((r) => `<NFref><refNFe>${r}</refNFe></NFref>`).join('');
    return `
    <ide>
      <cUF>${getCUF(ide.ufEmit)}</cUF>
      <cNF>${chaveInfo.cNF}</cNF>
      <natOp>${esc(ide.natOp || 'Venda de mercadoria')}</natOp>
      <mod>${ide.mod || 55}</mod>
      <serie>${ide.serie || 1}</serie>
      <nNF>${ide.nNF || 1}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      ${dhSaiEnt && dhSaiEnt !== 'Invalid Date' ? `<dhSaiEnt>${dhSaiEnt}</dhSaiEnt>` : ''}
      <tpNF>${ide.tpNF ?? 1}</tpNF>
      <idDest>${ide.idDest || 1}</idDest>
      <cMunFG>${requireCodigoMunicipio(ide.cMunFG, 'Código IBGE do município de ocorrência')}</cMunFG>
      <tpImp>${ide.tpImp || 1}</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chaveInfo.cDV}</cDV>
      <tpAmb>${ide.tpAmb || 2}</tpAmb>
      <finNFe>${ide.finNFe || 1}</finNFe>
      <indFinal>${ide.indFinal || 0}</indFinal>
      <indPres>${ide.indPres || 0}</indPres>
      <procEmi>0</procEmi>
      <verProc>Sisweb 1.0</verProc>${nfrefXml}${buildCompraGov(ide.compraGov)}
    </ide>`;
  }

  // ─── Bloco <emit> ─────────────────────────────────────────────────────────
  function buildEmit(emit) {
    const cnpj = String(emit.cnpj || '').replace(/\D/g, '');
    const cep  = String(emit.endereco?.cep || '').replace(/\D/g, '');
    return `
    <emit>
      <CNPJ>${cnpj}</CNPJ>
      <xNome>${esc(emit.razaoSocial)}</xNome>
      ${emit.nomeFantasia ? `<xFant>${esc(emit.nomeFantasia)}</xFant>` : ''}
      <enderEmit>
        <xLgr>${esc(emit.endereco?.logradouro)}</xLgr>
        <nro>${esc(emit.endereco?.numero)}</nro>
        ${emit.endereco?.complemento ? `<xCpl>${esc(emit.endereco.complemento)}</xCpl>` : ''}
        <xBairro>${esc(emit.endereco?.bairro || 'Centro')}</xBairro>
        <cMun>${requireCodigoMunicipio(emit.endereco?.codigoMunicipio, 'Código IBGE do município do emitente')}</cMun>
        <xMun>${esc(emit.endereco?.municipio)}</xMun>
        <UF>${emit.endereco?.uf}</UF>
        <CEP>${cep}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        ${emit.telefone ? `<fone>${String(emit.telefone).replace(/\D/g, '')}</fone>` : ''}
      </enderEmit>
      <IE>${String(emit.ie || '').replace(/\D/g, '')}</IE>
      <CRT>${emit.crt || 1}</CRT>
    </emit>`;
  }

  // ─── Bloco <dest> ─────────────────────────────────────────────────────────
  function buildDest(dest, tpAmb) {
    const cnpj = String(dest.cnpj || '').replace(/\D/g, '');
    const cpf  = String(dest.cpf  || '').replace(/\D/g, '');
    const cep  = String(dest.endereco?.cep || '').replace(/\D/g, '');
    // Em homologação, SEFAZ exige nome "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO..."
    const xNome = tpAmb == 2
      ? 'NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL'
      : esc(dest.nome);
    return `
    <dest>
      ${cnpj ? `<CNPJ>${cnpj}</CNPJ>` : `<CPF>${cpf}</CPF>`}
      <xNome>${xNome}</xNome>
      <enderDest>
        <xLgr>${esc(dest.endereco?.logradouro)}</xLgr>
        <nro>${esc(dest.endereco?.numero || 'S/N')}</nro>
        ${dest.endereco?.complemento ? `<xCpl>${esc(dest.endereco.complemento)}</xCpl>` : ''}
        <xBairro>${esc(dest.endereco?.bairro || 'Centro')}</xBairro>
        <cMun>${requireCodigoMunicipio(dest.endereco?.codigoMunicipio, 'Código IBGE do município do destinatário')}</cMun>
        <xMun>${esc(dest.endereco?.municipio)}</xMun>
        <UF>${dest.endereco?.uf || 'SP'}</UF>
        <CEP>${cep}</CEP>
        <cPais>1058</cPais>
        <xPais>Brasil</xPais>
        ${dest.telefone ? `<fone>${String(dest.telefone).replace(/\D/g, '')}</fone>` : ''}
      </enderDest>
      <indIEDest>${dest.indIEDest || 9}</indIEDest>
      ${dest.ie && dest.indIEDest !== '9' ? `<IE>${esc(dest.ie)}</IE>` : ''}
      ${dest.email ? `<email>${esc(dest.email)}</email>` : ''}
    </dest>`;
  }

  // ─── ICMS por CSOSN (Simples Nacional) ───────────────────────────────────
  // Cobertura completa do leiaute 4.00:
  //  101→ICMSSN101 | 102/103/300/400→ICMSSN102 | 201→ICMSSN201
  //  202/203→ICMSSN202 | 500→ICMSSN500 | 900→ICMSSN900
  function buildICMSSN(icms) {
    const orig = icms.orig || 0;
    const csosn = String(icms.csosn || '102');
    const st = () => {
      const parts = [];
      if (icms.modBCST) parts.push(`<modBCST>${icms.modBCST}</modBCST>`);
      if (icms.pMVAST != null) parts.push(`<pMVAST>${num(icms.pMVAST)}</pMVAST>`);
      if (icms.pRedBCST != null) parts.push(`<pRedBCST>${num(icms.pRedBCST)}</pRedBCST>`);
      parts.push(`<vBCST>${num(icms.vBCST)}</vBCST><pICMSST>${num(icms.pICMSST)}</pICMSST><vICMSST>${num(icms.vICMSST)}</vICMSST>`);
      return parts.join('');
    };
    switch (csosn) {
      case '101':
        return `<ICMSSN101><orig>${orig}</orig><CSOSN>101</CSOSN><pCredSN>${num(icms.pCredSN)}</pCredSN><vCredICMSSN>${num(icms.vCredICMSSN)}</vCredICMSSN></ICMSSN101>`;
      case '201':
        return `<ICMSSN201><orig>${orig}</orig><CSOSN>201</CSOSN><pCredSN>${num(icms.pCredSN)}</pCredSN><vCredICMSSN>${num(icms.vCredICMSSN)}</vCredICMSSN>${st()}</ICMSSN201>`;
      case '202':
      case '203':
        return `<ICMSSN202><orig>${orig}</orig><CSOSN>${csosn}</CSOSN>${st()}</ICMSSN202>`;
      case '500':
        return `<ICMSSN500><orig>${orig}</orig><CSOSN>500</CSOSN><vBCSTRet>${num(icms.vBCSTRet)}</vBCSTRet>${icms.pST != null ? `<pST>${num(icms.pST)}</pST>` : ''}<vICMSSTRet>${num(icms.vICMSSTRet)}</vICMSSTRet></ICMSSN500>`;
      case '900':
        return `<ICMSSN900><orig>${orig}</orig><CSOSN>900</CSOSN>${icms.modBC ? `<modBC>${icms.modBC}</modBC>` : ''}<vBC>${num(icms.vBC)}</vBC>${icms.pICMS != null ? `<pICMS>${num(icms.pICMS)}</pICMS>` : ''}<vICMS>${num(icms.vICMS)}</vICMS>${st()}</ICMSSN900>`;
      default: {
        const code = ['102', '103', '300', '400'].includes(csosn) ? csosn : '102';
        return `<ICMSSN102><orig>${orig}</orig><CSOSN>${code}</CSOSN></ICMSSN102>`;
      }
    }
  }

  // ─── FCP (A13, Convênios — opcional por item) ────────────────────────────
  // Trio vBCFCP/pFCP/vFCP nos ramos 00/10/20/51/70/90 (NFePHP). Totais vFCP
  // acumulados (antes 0.00 fixo). Item: imposto.icms.{vBCFCP,pFCP,vFCP}.
  function fcpTag(icms) {
    const has = icms.vBCFCP != null && String(icms.vBCFCP).trim() !== ''
      || icms.pFCP != null && String(icms.pFCP).trim() !== ''
      || (parseFiscalNumber(icms.vFCP) > 0);
    if (!has) return '';
    return `<vBCFCP>${num(icms.vBCFCP)}</vBCFCP><pFCP>${num(icms.pFCP, 4)}</pFCP><vFCP>${num(icms.vFCP)}</vFCP>`;
  }

  // ─── ICMS por CST (Regime Normal) — tags corretas do leiaute 4.00 ─────────
  //  00→ICMS00 | 10→ICMS10 | 20→ICMS20 | 30→ICMS30 | 40/41/50→ICMS40
  //  51→ICMS51 | 60→ICMS60 | 70→ICMS70 | 90→ICMS90
  //  Monofásicos adRem (NT 2023.001, XSD+ NFePHP TraitTagDetICMS):
  //  02→ICMS02 | 15→ICMS15 | 53→ICMS53 | 61→ICMS61
  //  (qualquer outro código cai em ICMS90 — NUNCA silencioso: o validador
  //  barra CST fora da tabela oficial antes de chegar aqui.)
  function buildICMSNormal(icms) {
    const orig = icms.orig || 0;
    const cst = String(icms.cst || '00').replace(/\D/g, '').padStart(2, '0').slice(-2);
    const st = () => {
      const parts = [];
      if (icms.modBCST) parts.push(`<modBCST>${icms.modBCST}</modBCST>`);
      if (icms.pMVAST != null) parts.push(`<pMVAST>${num(icms.pMVAST)}</pMVAST>`);
      if (icms.pRedBCST != null) parts.push(`<pRedBCST>${num(icms.pRedBCST)}</pRedBCST>`);
      parts.push(`<vBCST>${num(icms.vBCST)}</vBCST><pICMSST>${num(icms.pICMSST)}</pICMSST><vICMSST>${num(icms.vICMSST)}</vICMSST>`);
      return parts.join('');
    };
    switch (cst) {
      case '02': {
        // ICMS02: monofásica própria combustíveis (qBCMono? + adRemICMS + vICMSMono)
        const vMono = icms.vICMSMono != null && icms.vICMSMono !== '' ? parseFiscalNumber(icms.vICMSMono) : parseFiscalNumber(icms.qBCMono) * parseFiscalNumber(icms.adRemICMS);
        return `<ICMS02><orig>${orig}</orig><CST>02</CST>${icms.qBCMono != null && String(icms.qBCMono).trim() !== '' ? `<qBCMono>${num(icms.qBCMono, 4)}</qBCMono>` : ''}<adRemICMS>${num(icms.adRemICMS, 4)}</adRemICMS><vICMSMono>${num(vMono)}</vICMSMono></ICMS02>`;
      }
      case '15': {
        // ICMS15: monofásica própria + retenção (+pRedAdRem/motRedAdRem? 1|9)
        const vMono = icms.vICMSMono != null && icms.vICMSMono !== '' ? parseFiscalNumber(icms.vICMSMono) : parseFiscalNumber(icms.qBCMono) * parseFiscalNumber(icms.adRemICMS);
        const vRet = icms.vICMSMonoReten != null && icms.vICMSMonoReten !== '' ? parseFiscalNumber(icms.vICMSMonoReten) : parseFiscalNumber(icms.qBCMonoReten) * parseFiscalNumber(icms.adRemICMSReten);
        const red = icms.pRedAdRem != null && String(icms.pRedAdRem).trim() !== ''
          ? `<pRedAdRem>${num(icms.pRedAdRem, 4)}</pRedAdRem><motRedAdRem>${['1', '9'].includes(String(icms.motRedAdRem)) ? icms.motRedAdRem : '9'}</motRedAdRem>` : '';
        return `<ICMS15><orig>${orig}</orig><CST>15</CST>${icms.qBCMono != null && String(icms.qBCMono).trim() !== '' ? `<qBCMono>${num(icms.qBCMono, 4)}</qBCMono>` : ''}<adRemICMS>${num(icms.adRemICMS, 4)}</adRemICMS><vICMSMono>${num(vMono)}</vICMSMono>${icms.qBCMonoReten != null && String(icms.qBCMonoReten).trim() !== '' ? `<qBCMonoReten>${num(icms.qBCMonoReten, 4)}</qBCMonoReten>` : ''}<adRemICMSReten>${num(icms.adRemICMSReten, 4)}</adRemICMSReten><vICMSMonoReten>${num(vRet)}</vICMSMonoReten>${red}</ICMS15>`;
      }
      case '53': {
        // ICMS53: monofásica com diferimento (todos opcionais após CST)
        const opt = (tag, v, dec = 2) => (v != null && String(v).trim() !== '' ? `<${tag}>${num(v, dec)}</${tag}>` : '');
        return `<ICMS53><orig>${orig}</orig><CST>53</CST>${opt('qBCMono', icms.qBCMono, 4)}${opt('adRemICMS', icms.adRemICMS, 4)}${opt('vICMSMonoOp', icms.vICMSMonoOp)}${opt('pDif', icms.pDif, 4)}${opt('vICMSMonoDif', icms.vICMSMonoDif)}${opt('vICMSMono', icms.vICMSMono)}${opt('qBCMonoDif', icms.qBCMonoDif, 4)}${opt('adRemICMSDif', icms.adRemICMSDif, 4)}</ICMS53>`;
      }
      case '61': {
        // ICMS61: monofásica cobrada anteriormente (qBCMonoRet? + adRemICMSRet + vICMSMonoRet)
        return `<ICMS61><orig>${orig}</orig><CST>61</CST>${icms.qBCMonoRet != null && String(icms.qBCMonoRet).trim() !== '' ? `<qBCMonoRet>${num(icms.qBCMonoRet, 4)}</qBCMonoRet>` : ''}<adRemICMSRet>${num(icms.adRemICMSRet, 4)}</adRemICMSRet><vICMSMonoRet>${num(icms.vICMSMonoRet)}</vICMSMonoRet></ICMS61>`;
      }
      case '00':
        return `<ICMS00><orig>${orig}</orig><CST>00</CST><modBC>${icms.modBC || 3}</modBC><vBC>${num(icms.vBC)}</vBC><pICMS>${num(icms.pICMS)}</pICMS><vICMS>${num(icms.vICMS)}</vICMS>${fcpTag(icms)}</ICMS00>`;
      case '10':
        return `<ICMS10><orig>${orig}</orig><CST>10</CST><modBC>${icms.modBC || 3}</modBC><vBC>${num(icms.vBC)}</vBC><pICMS>${num(icms.pICMS)}</pICMS><vICMS>${num(icms.vICMS)}</vICMS>${fcpTag(icms)}${st()}</ICMS10>`;
      case '20':
        return `<ICMS20><orig>${orig}</orig><CST>20</CST><modBC>${icms.modBC || 3}</modBC><pRedBC>${num(icms.pRedBC)}</pRedBC><vBC>${num(icms.vBC)}</vBC><pICMS>${num(icms.pICMS)}</pICMS><vICMS>${num(icms.vICMS)}</vICMS>${fcpTag(icms)}</ICMS20>`;
      case '30':
        return `<ICMS30><orig>${orig}</orig><CST>30</CST>${st()}</ICMS30>`;
      case '40':
      case '41':
      case '50': {
        const deson = Number(icms.vICMSDeson) > 0
          ? `<vICMSDeson>${num(icms.vICMSDeson)}</vICMSDeson><motDesICMS>${icms.motDesICMS || 9}</motDesICMS>`
          : '';
        return `<ICMS40><orig>${orig}</orig><CST>${cst}</CST>${deson}</ICMS40>`;
      }
      case '51':
        return `<ICMS51><orig>${orig}</orig><CST>51</CST><modBC>${icms.modBC || 3}</modBC>${icms.pRedBC != null ? `<pRedBC>${num(icms.pRedBC)}</pRedBC>` : ''}<vBC>${num(icms.vBC)}</vBC><pICMS>${num(icms.pICMS)}</pICMS><vICMSOp>${num(icms.vICMSOp)}</vICMSOp><pDif>${num(icms.pDif)}</pDif><vICMSDif>${num(icms.vICMSDif)}</vICMSDif><vICMS>${num(icms.vICMS)}</vICMS>${fcpTag(icms)}</ICMS51>`;
      case '60':
        return `<ICMS60><orig>${orig}</orig><CST>60</CST><vBCSTRet>${num(icms.vBCSTRet)}</vBCSTRet>${icms.pST != null ? `<pST>${num(icms.pST)}</pST>` : ''}<vICMSSTRet>${num(icms.vICMSSTRet)}</vICMSSTRet></ICMS60>`;
      case '70':
        return `<ICMS70><orig>${orig}</orig><CST>70</CST><modBC>${icms.modBC || 3}</modBC><pRedBC>${num(icms.pRedBC)}</pRedBC><vBC>${num(icms.vBC)}</vBC><pICMS>${num(icms.pICMS)}</pICMS><vICMS>${num(icms.vICMS)}</vICMS>${fcpTag(icms)}${st()}</ICMS70>`;
      default:
        return `<ICMS90><orig>${orig}</orig><CST>90</CST>${icms.modBC ? `<modBC>${icms.modBC}</modBC>` : ''}<vBC>${num(icms.vBC)}</vBC>${icms.pICMS != null ? `<pICMS>${num(icms.pICMS)}</pICMS>` : ''}<vICMS>${num(icms.vICMS)}</vICMS>${fcpTag(icms)}${st()}</ICMS90>`;
    }
  }

  // ─── PIS (MOC: 01/02→PISAliq | 03→PISQtde | demais→PISNT) ────────────────
  function buildPIS(pis) {
    const cst = String(pis?.cST || '07').replace(/\D/g, '').padStart(2, '0').slice(-2);
    if (cst === '01' || cst === '02') {
      return `<PISAliq><CST>${cst}</CST><vBC>${num(pis.vBC)}</vBC><pPIS>${num(pis.pPIS,4)}</pPIS><vPIS>${num(pis.vPIS)}</vPIS></PISAliq>`;
    }
    if (cst === '03') {
      const vPIS = pis.vPIS != null && pis.vPIS !== '' ? parseFiscalNumber(pis.vPIS) : parseFiscalNumber(pis.qBCProd) * parseFiscalNumber(pis.vAliqProd);
      return `<PISQtde><CST>03</CST><qBCProd>${num(pis.qBCProd, 4)}</qBCProd><vAliqProd>${num(pis.vAliqProd, 4)}</vAliqProd><vPIS>${num(vPIS)}</vPIS></PISQtde>`;
    }
    return `<PISNT><CST>${cst}</CST></PISNT>`;
  }

  // ─── COFINS (MOC: 01/02→COFINSAliq | 03→COFINSQtde | demais→COFINSNT) ────
  function buildCOFINS(cofins) {
    const cst = String(cofins?.cST || '07').replace(/\D/g, '').padStart(2, '0').slice(-2);
    if (cst === '01' || cst === '02') {
      return `<COFINSAliq><CST>${cst}</CST><vBC>${num(cofins.vBC)}</vBC><pCOFINS>${num(cofins.pCOFINS,4)}</pCOFINS><vCOFINS>${num(cofins.vCOFINS)}</vCOFINS></COFINSAliq>`;
    }
    if (cst === '03') {
      const vCOFINS = cofins.vCOFINS != null && cofins.vCOFINS !== '' ? parseFiscalNumber(cofins.vCOFINS) : parseFiscalNumber(cofins.qBCProd) * parseFiscalNumber(cofins.vAliqProd);
      return `<COFINSQtde><CST>03</CST><qBCProd>${num(cofins.qBCProd, 4)}</qBCProd><vAliqProd>${num(cofins.vAliqProd, 4)}</vAliqProd><vCOFINS>${num(vCOFINS)}</vCOFINS></COFINSQtde>`;
    }
    return `<COFINSNT><CST>${cst}</CST></COFINSNT>`;
  }

  // ─── IBS/CBS monofásico (gIBSCBSMono, TMonofasia — CST 620) ─────────────
  // Espelho do XSD oficial (DFeTiposBasicos TMonofasia, PL_010f) + cross-check
  // NFePHP TraitTagDetIBSCBS::tagIBSCBSMono:
  //  - IBS e CBS, cada lado em regime adRem OU adValorem, com blocos
  //    padrao/reten/ret (+gpBioDiferenca p/ mistura EAC/gasolina);
  //  - sub-blocos emitidos SOMENTE quando o gatilho existe (NFePHP usa
  //    !empty(qBCMono/vBCMono/qBCMonoReten/vBCMonoReten/vRet/qBCBioComb));
  //  - totais do item (vTotIBSMonoItem/vTotCBSMonoItem, obrigatórios):
  //    vMono + vMonoReten por lado (NFePHP: sem Ret, sem gpBio, sem Dif);
  //  - totais W34 gMono acumulam vMono/vMonoReten/vMonoRet por lado.
  // Valores (v) são auto-calculados (q×aliq ou vBC×aliq) quando ausentes,
  // como no gIBSCBS; override explícito prevalece.
  function monoLadoTotais(lado, m) {
    if (!m) return { tot: 0, padrao: 0, reten: 0, ret: 0 };
    const f = parseFiscalNumber;
    const pad = m.padrao || {}, ret = m.reten || {}, rdo = m.ret || {};
    let padrao = 0, reten = 0;
    if (m.regime === 'adRem') {
      const q = f(pad.qBCMono), a = f(pad.aliq);
      padrao = pad.v != null && pad.v !== '' ? f(pad.v) : q * a;
      const qr = f(ret.qBCMonoReten), ar = f(ret.aliqReten);
      reten = ret.vReten != null && ret.vReten !== '' ? f(ret.vReten) : qr * ar;
    } else {
      const bc = f(pad.vBCMono);
      padrao = pad.v != null && pad.v !== '' ? f(pad.v)
        : (lado === 'ibs'
          ? bc * f(pad.aliqUF) / 100 + bc * f(pad.aliqMun) / 100
          : bc * f(pad.aliq) / 100);
      const bcr = f(ret.vBCMonoReten);
      reten = ret.vReten != null && ret.vReten !== '' ? f(ret.vReten) : bcr * f(ret.aliqReten) / 100;
    }
    const retido = f(rdo.v);
    // NFePHP UB105a-10/UB105b-10: vTot = vMono + vMonoReten (sem Ret, sem bio)
    return { tot: padrao + reten, padrao, reten, ret: retido };
  }
  function buildMonoAdRem(lado, m) {
    const tagV = lado === 'ibs' ? 'IBS' : 'CBS';
    const pad = m.padrao || {}, ret = m.reten || {}, rdo = m.ret || {}, bio = m.bio || {};
    const t = monoLadoTotais(lado, m);
    let s = '';
    if (m.padrao) s += `<gMonoPadrao><qBCMono>${num(pad.qBCMono, 4)}</qBCMono><adRem${tagV}>${num(pad.aliq, 4)}</adRem${tagV}><v${tagV}Mono>${num(t.padrao)}</v${tagV}Mono></gMonoPadrao>`;
    if (m.reten) s += `<gMonoReten><qBCMonoReten>${num(ret.qBCMonoReten, 4)}</qBCMonoReten><adRem${tagV}Reten>${num(ret.aliqReten, 4)}</adRem${tagV}Reten><v${tagV}MonoReten>${num(t.reten)}</v${tagV}MonoReten></gMonoReten>`;
    if (m.ret) s += `<gMonoRet><v${tagV}MonoRet>${num(t.ret)}</v${tagV}MonoRet></gMonoRet>`;
    if (m.bio) s += `<gpBioDiferenca><qBCBioComb>${num(bio.qBCBioComb, 4)}</qBCBioComb><v${tagV}Diferenca>${num(bio.vDif)}</v${tagV}Diferenca></gpBioDiferenca>`;
    return s;
  }
  function buildMonoAdValorem(lado, m) {
    const pad = m.padrao || {}, ret = m.reten || {}, rdo = m.ret || {}, bio = m.bio || {};
    const t = monoLadoTotais(lado, m);
    let s = '';
    if (lado === 'ibs') {
      if (m.padrao) {
        const bc = parseFiscalNumber(pad.vBCMono);
        const vUF = pad.vUF != null && pad.vUF !== '' ? parseFiscalNumber(pad.vUF) : bc * parseFiscalNumber(pad.aliqUF) / 100;
        const vMun = pad.vMun != null && pad.vMun !== '' ? parseFiscalNumber(pad.vMun) : bc * parseFiscalNumber(pad.aliqMun) / 100;
        s += `<gMonoPadrao><vBCMono>${num(pad.vBCMono)}</vBCMono><pAliqMonoUF>${num(pad.aliqUF, 4)}</pAliqMonoUF><vIBSMonoUF>${num(vUF)}</vIBSMonoUF><pAliqMonoMun>${num(pad.aliqMun, 4)}</pAliqMonoMun><vIBSMonoMun>${num(vMun)}</vIBSMonoMun><vIBSMono>${num(t.padrao)}</vIBSMono></gMonoPadrao>`;
      }
      if (m.reten) s += `<gMonoReten><vBCMonoReten>${num(ret.vBCMonoReten)}</vBCMonoReten><pAliqMonoReten>${num(ret.aliqReten, 4)}</pAliqMonoReten><vIBSMonoReten>${num(t.reten)}</vIBSMonoReten></gMonoReten>`;
      if (m.ret) s += `<gMonoRet><vIBSMonoRet>${num(t.ret)}</vIBSMonoRet></gMonoRet>`;
      if (m.bio) s += `<gpBioDiferenca><qBCBioComb>${num(bio.qBCBioComb, 4)}</qBCBioComb><vIBSDiferenca>${num(bio.vDif)}</vIBSDiferenca></gpBioDiferenca>`;
    } else {
      if (m.padrao) s += `<gMonoPadrao><vBCMono>${num(pad.vBCMono)}</vBCMono><pAliqMonoCBS>${num(pad.aliq, 4)}</pAliqMonoCBS><vCBSMono>${num(t.padrao)}</vCBSMono></gMonoPadrao>`;
      if (m.reten) s += `<gMonoReten><vBCMonoReten>${num(ret.vBCMonoReten)}</vBCMonoReten><pAliqMonoReten>${num(ret.aliqReten, 4)}</pAliqMonoReten><vCBSMonoReten>${num(t.reten)}</vCBSMonoReten></gMonoReten>`;
      if (m.ret) s += `<gMonoRet><vCBSMonoRet>${num(t.ret)}</vCBSMonoRet></gMonoRet>`;
      if (m.bio) s += `<gpBioDiferenca><qBCBioComb>${num(bio.qBCBioComb, 4)}</qBCBioComb><vCBSDiferenca>${num(bio.vDif)}</vCBSDiferenca></gpBioDiferenca>`;
    }
    return s;
  }
  function buildIBSCBSMono(mono) {
    const m = mono || {};
    const tIBS = monoLadoTotais('ibs', m.ibs);
    const tCBS = monoLadoTotais('cbs', m.cbs);
    const vTotIBS = m.vTotIBSMonoItem != null && m.vTotIBSMonoItem !== '' ? parseFiscalNumber(m.vTotIBSMonoItem) : tIBS.tot;
    const vTotCBS = m.vTotCBSMonoItem != null && m.vTotCBSMonoItem !== '' ? parseFiscalNumber(m.vTotCBSMonoItem) : tCBS.tot;
    let s = '<gIBSCBSMono>';
    if (m.ibs) s += m.ibs.regime === 'adValorem' ? `<gIBSMonoAdValorem>${buildMonoAdValorem('ibs', m.ibs)}</gIBSMonoAdValorem>` : `<gIBSMonoAdRem>${buildMonoAdRem('ibs', m.ibs)}</gIBSMonoAdRem>`;
    if (m.cbs) s += m.cbs.regime === 'adValorem' ? `<gCBSMonoAdValorem>${buildMonoAdValorem('cbs', m.cbs)}</gCBSMonoAdValorem>` : `<gCBSMonoAdRem>${buildMonoAdRem('cbs', m.cbs)}</gCBSMonoAdRem>`;
    s += `<vTotIBSMonoItem>${num(vTotIBS)}</vTotIBSMonoItem><vTotCBSMonoItem>${num(vTotCBS)}</vTotCBSMonoItem></gIBSCBSMono>`;
    return s;
  }

  // ─── IBS/CBS (Reforma Tributária — grupo <IBSCBS>, TTribNFe) ──────────────
  // Validado contra o schema oficial PL_010f_v1.04 (DFeTiposBasicos TTribNFe /
  // TCIBS_NFe). Presença de CST+cClassTrib = intenção de emitir (a SEFAZ
  // exige o grupo em todo item — cStat 1115 se ausente; fonte: NFePHP
  // sped-nfe master, flagIBSCBS ligada por cClassTrib presente). O flag
  // `habilitado=false` com CST+cClassTrib preenchidos NÃO omite (dado legado
  // ou config parcial); omitir exige remover CST/cClassTrib.
  function buildIBSCBS(item) {
    const g = item?.imposto?.ibscbs;
    if (!g) return '';
    if (!g.cst || !g.cClassTrib) return '';
    if (g.habilitado === false) return '';
    const vBCn = parseFiscalNumber(g.vBC != null ? g.vBC : (item.vProd || item.total));
    const pIBSUF = parseFiscalNumber(g.pIBSUF), pIBSMun = parseFiscalNumber(g.pIBSMun), pCBS = parseFiscalNumber(g.pCBS);
    const pRed = parseFiscalNumber(g.pRedAliq);
    const pDif = parseFiscalNumber(g.pDif);
    const efet = (p) => p * (1 - pRed / 100);
    const gRedTag = (pAliq) => pRed > 0
      ? `<gRed><pRedAliq>${num(pRed, 4)}</pRedAliq><pAliqEfet>${num(efet(pAliq), 4)}</pAliqEfet></gRed>` : '';
    const gDifTag = () => pDif > 0
      ? `<gDif><pDif>${num(pDif, 4)}</pDif><vDif>${num(vBCn * pDif / 100)}</vDif></gDif>` : '';
    const vIBSUFn = g.vIBSUF != null ? parseFiscalNumber(g.vIBSUF) : vBCn * pIBSUF / 100;
    const vIBSMunn = g.vIBSMun != null ? parseFiscalNumber(g.vIBSMun) : vBCn * pIBSMun / 100;
    const vIBSn = vIBSUFn + vIBSMunn;
    const vCBSn = g.vCBS != null ? parseFiscalNumber(g.vCBS) : vBCn * pCBS / 100;
    // Devolução de tributo (TDevTrib, NT 2025.002 v1.50 — NFePHP): pDevTrib?
    // + vDevTrib, após gDif e antes de gRed/vIBSUF em cada lado.
    const devTribTag = (d) => (d && (d.v != null && String(d.v).trim() !== '' || d.vDevTrib != null)
      ? `<gDevTrib>${d.p != null && String(d.p).trim() !== '' ? `<pDevTrib>${num(d.p, 4)}</pDevTrib>` : ''}<vDevTrib>${num(d.v != null ? d.v : d.vDevTrib)}</vDevTrib></gDevTrib>` : '');
    // Grupo base — choice do TTribNFe: gIBSCBSMono (CST 620) | gTransfCred
    // (CST 800) | gAjusteCompet (CST 811) | gIBSCBS (demais CST)
    let baseGroup;
    if (g.mono) {
      if (String(g.cst) !== '620') {
        throw new Error('IBS/CBS monofásico (gIBSCBSMono) exige CST 620');
      }
      baseGroup = buildIBSCBSMono(g.mono);
    } else if (g.transfCred) {
      baseGroup = `<gTransfCred><vIBS>${num(g.transfCred.vIBS)}</vIBS><vCBS>${num(g.transfCred.vCBS)}</vCBS></gTransfCred>`;
    } else if (g.ajusteCompet) {
      baseGroup = `<gAjusteCompet><competApur>${esc(g.ajusteCompet.competApur)}</competApur><vIBS>${num(g.ajusteCompet.vIBS)}</vIBS><vCBS>${num(g.ajusteCompet.vCBS)}</vCBS></gAjusteCompet>`;
    } else {
      // gTribRegular/gTribCompraGov: filhos de TCIBS_NFe (após gCBS) — só com base gIBSCBS
      const tribRegularTag = g.tribRegular
        ? `<gTribRegular><CSTReg>${esc(g.tribRegular.cstReg)}</CSTReg><cClassTribReg>${esc(g.tribRegular.cClassTribReg)}</cClassTribReg>`
          + `<pAliqEfetRegIBSUF>${num(g.tribRegular.pAliqEfetRegIBSUF, 4)}</pAliqEfetRegIBSUF><vTribRegIBSUF>${num(g.tribRegular.vTribRegIBSUF)}</vTribRegIBSUF>`
          + `<pAliqEfetRegIBSMun>${num(g.tribRegular.pAliqEfetRegIBSMun, 4)}</pAliqEfetRegIBSMun><vTribRegIBSMun>${num(g.tribRegular.vTribRegIBSMun)}</vTribRegIBSMun>`
          + `<pAliqEfetRegCBS>${num(g.tribRegular.pAliqEfetRegCBS, 4)}</pAliqEfetRegCBS><vTribRegCBS>${num(g.tribRegular.vTribRegCBS)}</vTribRegCBS></gTribRegular>` : '';
      const tribCompraGovTag = g.tribCompraGov
        ? `<gTribCompraGov><pAliqIBSUF>${num(g.tribCompraGov.pAliqIBSUF, 4)}</pAliqIBSUF><vTribIBSUF>${num(g.tribCompraGov.vTribIBSUF)}</vTribIBSUF>`
          + `<pAliqIBSMun>${num(g.tribCompraGov.pAliqIBSMun, 4)}</pAliqIBSMun><vTribIBSMun>${num(g.tribCompraGov.vTribIBSMun)}</vTribIBSMun>`
          + `<pAliqCBS>${num(g.tribCompraGov.pAliqCBS, 4)}</pAliqCBS><vTribCBS>${num(g.tribCompraGov.vTribCBS)}</vTribCBS></gTribCompraGov>` : '';
      // ALC/ZFM alíquota zero CBS (TALCZFMCBS_NFe — após gRed, antes de vCBS):
      // tp 1|2 + nProcSuframa? (8–12) + alíquota/valor de referência.
      const alcTag = g.alcZfm
        ? `<gALCZFMCBS><tpALCZFMCBS>${['1', '2'].includes(String(g.alcZfm.tp)) ? g.alcZfm.tp : '1'}</tpALCZFMCBS>`
          + `${g.alcZfm.nProcSuframa ? `<nProcSuframa>${esc(String(g.alcZfm.nProcSuframa).slice(0, 12))}</nProcSuframa>` : ''}`
          + `<pAliqEfetRegCBS>${num(g.alcZfm.pAliqEfetRegCBS, 4)}</pAliqEfetRegCBS><vTribRegCBS>${num(g.alcZfm.vTribRegCBS)}</vTribRegCBS></gALCZFMCBS>` : '';
      baseGroup = `<gIBSCBS><vBC>${num(vBCn)}</vBC>`
        + `<gIBSUF><pIBSUF>${num(pIBSUF, 4)}</pIBSUF>${gDifTag()}${devTribTag(g.devTribUF)}${gRedTag(pIBSUF)}<vIBSUF>${num(vIBSUFn)}</vIBSUF></gIBSUF>`
        + `<gIBSMun><pIBSMun>${num(pIBSMun, 4)}</pIBSMun>${gDifTag()}${devTribTag(g.devTribMun)}${gRedTag(pIBSMun)}<vIBSMun>${num(vIBSMunn)}</vIBSMun></gIBSMun>`
        + `<vIBS>${num(vIBSn)}</vIBS>`
        + `<gCBS><pCBS>${num(pCBS, 4)}</pCBS>${gDifTag()}${devTribTag(g.devTribCBS)}${gRedTag(pCBS)}${alcTag}<vCBS>${num(vCBSn)}</vCBS></gCBS>${tribRegularTag}${tribCompraGovTag}`
        + `</gIBSCBS>`;
    }
    // Estorno de crédito (opcional)
    const estorno = g.estornoCred
      ? `<gEstornoCred><vIBSEstCred>${num(g.estornoCred.vIBSEstCred)}</vIBSEstCred><vCBSEstCred>${num(g.estornoCred.vCBSEstCred)}</vCBSEstCred></gEstornoCred>` : '';
    // Crédito presumido — choice: gCredPresOper | gCredPresIBSZFM (opcional)
    let cred = '';
    if (g.credPresIBSZFM) {
      const z = g.credPresIBSZFM;
      cred = `<gCredPresIBSZFM><competApur>${esc(z.competApur)}</competApur><tpCredPresIBSZFM>${esc(z.tpCredPresIBSZFM)}</tpCredPresIBSZFM><vCredPresIBSZFM>${num(z.vCredPresIBSZFM)}</vCredPresIBSZFM></gCredPresIBSZFM>`;
    } else {
      const cp = g.credPresOper;
      if (cp && cp.cCredPres) {
        const bcCP = cp.vBCCredPres != null ? parseFiscalNumber(cp.vBCCredPres) : vBCn;
        const pCP = parseFiscalNumber(cp.pCredPres);
        const vCP = cp.vCredPres != null ? parseFiscalNumber(cp.vCredPres) : (bcCP * pCP / 100);
        const gIBS = cp.gIBSCredPres !== false
          ? `<gIBSCredPres><pCredPres>${num(pCP, 4)}</pCredPres><vCredPres>${num(vCP)}</vCredPres></gIBSCredPres>` : '';
        const gCbs = cp.gCBSCredPres !== false
          ? `<gCBSCredPres><pCredPres>${num(pCP, 4)}</pCredPres><vCredPres>${num(vCP)}</vCredPres></gCBSCredPres>` : '';
        cred = `<gCredPresOper><vBCCredPres>${num(bcCP)}</vBCCredPres><cCredPres>${esc(cp.cCredPres)}</cCredPres>${gIBS}${gCbs}</gCredPresOper>`;
      }
    }
    return `\n        <IBSCBS><CST>${esc(g.cst)}</CST><cClassTrib>${esc(g.cClassTrib)}</cClassTrib>${g.indDoacao === '1' || g.indDoacao === 1 ? '<indDoacao>1</indDoacao>' : ''}${baseGroup}${estorno}${cred}</IBSCBS>`;
  }

  // ─── Imposto Seletivo (<IS>, TIS) — Reforma Tributária ────────────────────
  // Cross-check NFePHP TraitTagDetIS::tagIS:
  //  - vBCIS+pIS+adRemIS(opc) SÓ quando vBCIS informado (isset);
  //  - uTrib+qTrib SÓ quando AMBOS informados;
  //  - vIS sempre.
  // Nosso contrato: vBC/pIS sempre presentes no objeto (default do form) →
  // emitimos o bloco completo; adRemIS só quando preenchido; uTrib+qTrib
  // quando ambos presentes (passthrough uTribIS/qTribIS).
  function buildIS(item) {
    const g = item?.imposto?.is;
    if (!g || !g.habilitado) return '';
    if (!g.cstIS || !g.cClassTribIS) {
      throw new Error('IS: CSTIS e cClassTribIS são obrigatórios quando o grupo está habilitado');
    }
    const vBCISn = parseFiscalNumber(g.vBCIS != null ? g.vBCIS : (item.vProd || item.total));
    const pIS = parseFiscalNumber(g.pIS);
    const vISn = g.vIS != null ? parseFiscalNumber(g.vIS) : vBCISn * pIS / 100;
    const adRem = (g.adRemIS != null && String(g.adRemIS).trim() !== '')
      ? `<adRemIS>${num(g.adRemIS, 4)}</adRemIS>` : '';
    const uTribQ = (g.uTribIS && g.qTribIS != null && String(g.qTribIS).trim() !== '')
      ? `<uTrib>${esc(String(g.uTribIS).slice(0, 6))}</uTrib><qTrib>${num(g.qTribIS, 4)}</qTrib>` : '';
    return `\n        <IS><CSTIS>${esc(g.cstIS)}</CSTIS><cClassTribIS>${esc(g.cClassTribIS)}</cClassTribIS>`
      + `<vBCIS>${num(vBCISn)}</vBCIS><pIS>${num(pIS, 4)}</pIS>${adRem}${uTribQ}<vIS>${num(vISn)}</vIS></IS>`;
  }

  // ─── IPI (opcional por configuracao fiscal) ───────────────────────────────
  function buildIPI(ipi) {
    if (!ipi) return '';
    const cst = String(ipi.cST || ipi.CST || ipi.cst || '').replace(/\D/g, '').padStart(2, '0').slice(-2);
    if (!cst) return '';
    const cEnq = String(ipi.cEnq || '999').replace(/\D/g, '').padStart(3, '0').slice(-3);
    const tributado = !['01', '02', '03', '04', '05', '51', '52', '53', '54', '55'].includes(cst);
    const grupo = tributado
      ? `<IPITrib><CST>${cst}</CST><vBC>${num(ipi.vBC)}</vBC><pIPI>${num(ipi.pIPI)}</pIPI><vIPI>${num(ipi.vIPI)}</vIPI></IPITrib>`
      : `<IPINT><CST>${cst}</CST></IPINT>`;
    return `<IPI><cEnq>${cEnq}</cEnq>${grupo}</IPI>`;
  }

  // ─── Bloco <det> (item) ───────────────────────────────────────────────────
  // vItem (Fase C, XSD det — após </imposto>): participação do item no total
  // (vProd + IPI do item; override explícito prevalece). Soma dos vItem
  // acompanha vProd+vIPI dos itens.
  // impostoDevol (A5, XSD det — após </imposto>, antes de <vItem>): emitido
  // quando finNFe=4 (devolução) ou item.imposto.devol presente (pDevol % +
  // vIPIDevol; default pDevol=100 com IPI do item).
  function buildImpostoDevol(item, finNFe) {
    const d = item?.imposto?.devol;
    const isDevol = String(finNFe) === '4' || (d && (d.pDevol != null || d.vIPIDevol != null));
    if (!isDevol) return '';
    const pDevol = d?.pDevol != null && String(d.pDevol).trim() !== '' ? parseFiscalNumber(d.pDevol) : 100;
    const vIPIDevol = d?.vIPIDevol != null && String(d.vIPIDevol).trim() !== ''
      ? parseFiscalNumber(d.vIPIDevol) : parseFiscalNumber(item?.imposto?.ipi?.vIPI);
    return `<impostoDevol><pDevol>${num(pDevol, 4)}</pDevol><vIPIDevol>${num(vIPIDevol)}</vIPIDevol></impostoDevol>`;
  }
  function buildDet(item, nItem, crt, finNFe) {
    const imp = item.imposto || {};
    const icms = imp.icms || {};
    const usaCSOSN = crt === 1 || crt === 2;
    const icmsXml = usaCSOSN ? buildICMSSN(icms) : buildICMSNormal(icms);
    const vProdn = parseFiscalNumber(item.vProd || item.total);
    const vIPIn = parseFiscalNumber(imp.ipi?.vIPI);
    const vItemn = item.vItem != null && item.vItem !== '' ? parseFiscalNumber(item.vItem) : vProdn + vIPIn;
    return `
    <det nItem="${nItem}">
      <prod>
        <cProd>${esc(item.cProd || item.codigo || String(nItem))}</cProd>
        <cEAN>${item.cEAN || 'SEM GTIN'}</cEAN>
        <xProd>${esc(item.xProd)}</xProd>
        <NCM>${String(item.ncm || item.NCM || '00000000').replace(/\D/g,'').padStart(8,'0')}</NCM>
        ${item.cest ? `<CEST>${item.cest}</CEST>` : ''}
        <CFOP>${item.cfop}</CFOP>
        <uCom>${esc(item.uCom || item.unidade || 'UN')}</uCom>
        <qCom>${num(item.qCom || item.quantidade, 4)}</qCom>
        <vUnCom>${num(item.vUnCom || item.valorUnitario, 10)}</vUnCom>
        <vProd>${num(item.vProd || item.total)}</vProd>
        <cEANTrib>${item.cEAN || 'SEM GTIN'}</cEANTrib>
        <uTrib>${esc(item.uTrib || item.uCom || item.unidade || 'UN')}</uTrib>
        <qTrib>${num(item.qTrib || item.qCom || item.quantidade, 4)}</qTrib>
        <vUnTrib>${num(item.vUnTrib || item.vUnCom || item.valorUnitario, 10)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>${icmsXml}</ICMS>
        ${buildIPI(imp.ipi)}
        <PIS>${buildPIS(imp.pis)}</PIS>
        <COFINS>${buildCOFINS(imp.cofins)}</COFINS>${buildIS(item)}${buildIBSCBS(item)}
      </imposto>${buildImpostoDevol(item, finNFe)}
      <vItem>${num(vItemn)}</vItem>
    </det>`;
  }

  // ─── Bloco <total> ────────────────────────────────────────────────────────
  // vNFTot (Fase C, XSD total — após IBSCBSTot): total + impostos "por fora"
  // (IBS+CBS+IS); override explícito prevalece. Emitido no contexto RTC.
  function buildTotal(tot) {
    const t = tot || {};
    const ibsTot = parseFiscalNumber(t.vIBS) + parseFiscalNumber(t.vCBS) + parseFiscalNumber(t.vIS);
    const vNFTot = t.vNFTot != null && t.vNFTot !== '' ? parseFiscalNumber(t.vNFTot) : parseFiscalNumber(t.vNF) + ibsTot;
    const hasRTC = Number(t.vBCIBSCBS) > 0
      || ['vMonoIBS', 'vMonoCBS', 'vMonoRetenIBS', 'vMonoRetenCBS', 'vMonoRetIBS', 'vMonoRetCBS'].some((k) => Number(t[k]) > 0)
      || Number(t.vIS) > 0;
    return `
    <total>
      <ICMSTot>
        <vBC>${num(t.vBC)}</vBC>
        <vICMS>${num(t.vICMS)}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>${num(t.vFCP)}</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>${((Number(t.qBCMono) > 0 || Number(t.vICMSMono) > 0 || Number(t.qBCMonoReten) > 0 || Number(t.vICMSMonoReten) > 0 || Number(t.qBCMonoRet) > 0 || Number(t.vICMSMonoRet) > 0) ? `<qBCMono>${num(t.qBCMono)}</qBCMono><vICMSMono>${num(t.vICMSMono)}</vICMSMono><qBCMonoReten>${num(t.qBCMonoReten)}</qBCMonoReten><vICMSMonoReten>${num(t.vICMSMonoReten)}</vICMSMonoReten><qBCMonoRet>${num(t.qBCMonoRet)}</qBCMonoRet><vICMSMonoRet>${num(t.vICMSMonoRet)}</vICMSMonoRet>` : '')}
        <vProd>${num(t.vProd)}</vProd>
        <vFrete>${num(t.vFrete)}</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>${num(t.vDesc)}</vDesc>
        <vII>0.00</vII>
        <vIPI>${num(t.vIPI)}</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>${num(t.vPIS)}</vPIS>
        <vCOFINS>${num(t.vCOFINS)}</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${num(t.vNF)}</vNF>
      </ICMSTot>${(Number(t.vIS) > 0) ? `<ISTot><vIS>${num(t.vIS)}</vIS></ISTot>` : ''}${buildIBSCBSTot(t)}${hasRTC ? `<vNFTot>${num(vNFTot)}</vNFTot>` : ''}
    </total>`;
  }

  // ─── Bloco <total> — IBSCBSTot (TIBSCBSMonoTot) ────────────────────────
  // gMono (Totais da Monofasia, só modelos 55/65): emitido quando há valores
  // monofásicos, mesmo sem vBCIBSCBS (monofásico é quantitativo, não tem vBC).
  function devTribVal(d) {
    if (!d) return 0;
    const v = d.v != null ? d.v : d.vDevTrib;
    return parseFiscalNumber(v);
  }
  function buildIBSCBSTot(t) {
    const hasMono = ['vMonoIBS', 'vMonoCBS', 'vMonoRetenIBS', 'vMonoRetenCBS', 'vMonoRetIBS', 'vMonoRetCBS']
      .some((k) => Number(t[k]) > 0);
    if (!(Number(t.vBCIBSCBS) > 0) && !hasMono) return '';
    const gMono = hasMono
      ? `<gMono><vIBSMono>${num(t.vMonoIBS)}</vIBSMono><vCBSMono>${num(t.vMonoCBS)}</vCBSMono>`
        + `<vIBSMonoReten>${num(t.vMonoRetenIBS)}</vIBSMonoReten><vCBSMonoReten>${num(t.vMonoRetenCBS)}</vCBSMonoReten>`
        + `<vIBSMonoRet>${num(t.vMonoRetIBS)}</vIBSMonoRet><vCBSMonoRet>${num(t.vMonoRetCBS)}</vCBSMonoRet></gMono>` : '';
    return `<IBSCBSTot><vBCIBSCBS>${num(t.vBCIBSCBS)}</vBCIBSCBS><gIBS><gIBSUF><vDif>${num(t.vDifIBSUF)}</vDif><vDevTrib>${num(t.vDevTribIBSUF)}</vDevTrib><vIBSUF>${num(t.vIBSUF)}</vIBSUF></gIBSUF><gIBSMun><vDif>${num(t.vDifIBSMun)}</vDif><vDevTrib>${num(t.vDevTribIBSMun)}</vDevTrib><vIBSMun>${num(t.vIBSMun)}</vIBSMun></gIBSMun><vIBS>${num(t.vIBS)}</vIBS><vCredPres>${num(t.vCredPres)}</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gIBS><gCBS><vDif>${num(t.vDifCBS)}</vDif><vDevTrib>${num(t.vDevTribCBS)}</vDevTrib><vCBS>${num(t.vCBS)}</vCBS><vCredPres>${num(t.vCredPres)}</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gCBS>${gMono}${(Number(t.vIBSEstCred) > 0 || Number(t.vCBSEstCred) > 0) ? `<gEstornoCred><vIBSEstCred>${num(t.vIBSEstCred)}</vIBSEstCred><vCBSEstCred>${num(t.vCBSEstCred)}</vCBSEstCred></gEstornoCred>` : ''}</IBSCBSTot>`;
  }

  // ─── Responsável técnico (A15, NT — infRespTec no infNFe) ───────────────
  // Emitido quando configurado (config.respTec {cnpj, xContato?, email?, fone?}).
  function buildInfRespTec(rt) {
    if (!rt || !/^[0-9]{14}$/.test(String(rt.cnpj || '').replace(/\D/g, ''))) return '';
    return `<infRespTec><CNPJ>${String(rt.cnpj).replace(/\D/g, '')}</CNPJ>`
      + `${rt.xContato ? `<xContato>${esc(String(rt.xContato).slice(0, 60))}</xContato>` : ''}`
      + `${rt.email ? `<email>${esc(String(rt.email).slice(0, 60))}</email>` : ''}`
      + `${rt.fone ? `<fone>${esc(String(rt.fone).replace(/\D/g, '').slice(0, 14))}</fone>` : ''}`
      + `</infRespTec>`;
  }

  // ─── Bloco <transp> ───────────────────────────────────────────────────────
  function onlyDigits(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function cleanCode(v) {
    return String(v || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  }

  function buildTransporta(transporta) {
    const t = transporta || {};
    const cnpj = onlyDigits(t.CNPJ || t.cnpj);
    const cpf = onlyDigits(t.CPF || t.cpf);
    const parts = [];
    if (cnpj.length === 14) parts.push(`<CNPJ>${cnpj}</CNPJ>`);
    else if (cpf.length === 11) parts.push(`<CPF>${cpf}</CPF>`);
    if (t.xNome || t.nome) parts.push(`<xNome>${esc(t.xNome || t.nome).slice(0, 60)}</xNome>`);
    if (t.IE || t.ie) parts.push(`<IE>${esc(t.IE || t.ie).slice(0, 14)}</IE>`);
    if (t.xEnder || t.endereco) parts.push(`<xEnder>${esc(t.xEnder || t.endereco).slice(0, 60)}</xEnder>`);
    if (t.xMun || t.municipio) parts.push(`<xMun>${esc(t.xMun || t.municipio).slice(0, 60)}</xMun>`);
    if (t.UF || t.uf) parts.push(`<UF>${esc(t.UF || t.uf).slice(0, 2).toUpperCase()}</UF>`);
    return parts.length ? `<transporta>${parts.join('')}</transporta>` : '';
  }

  function buildVeiculo(tag, veiculo) {
    const v = veiculo || {};
    const placa = cleanCode(v.placa).slice(0, 8);
    const uf = String(v.UF || v.uf || '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2);
    const rntc = cleanCode(v.RNTC || v.rntc || v.antt).slice(0, 20);
    if (!placa || !uf) return '';
    return `<${tag}><placa>${placa}</placa><UF>${uf}</UF>${rntc ? `<RNTC>${rntc}</RNTC>` : ''}</${tag}>`;
  }

  function buildVolume(vol) {
    const v = vol || {};
    const parts = [];
    // qVol é inteiro no leiaute (vol/qVol: pattern [0-9]{1,15} — nº de volumes).
    // Decimal digitado (ex. "0,010" m³, que pertence ao item qCom) é OMITIDO em vez
    // de corrompido para "0010"; formulário/validador barram com mensagem.
    const qVolRaw = String(v.qVol ?? '').trim();
    const qVol = /^[0-9]{1,15}$/.test(qVolRaw) ? qVolRaw : '';
    if (qVol) parts.push(`<qVol>${qVol}</qVol>`);
    if (v.esp || v.especie) parts.push(`<esp>${esc(v.esp || v.especie).slice(0, 60)}</esp>`);
    if (v.marca) parts.push(`<marca>${esc(v.marca).slice(0, 60)}</marca>`);
    if (v.nVol || v.numeracao) parts.push(`<nVol>${esc(v.nVol || v.numeracao).slice(0, 60)}</nVol>`);
    if (v.pesoL !== '' && v.pesoL != null) parts.push(`<pesoL>${num(v.pesoL, 3)}</pesoL>`);
    if (v.pesoB !== '' && v.pesoB != null) parts.push(`<pesoB>${num(v.pesoB, 3)}</pesoB>`);
    const lacres = Array.isArray(v.lacres) ? v.lacres : [];
    lacres.filter(Boolean).forEach((lac) => parts.push(`<lacres><nLacre>${esc(lac).slice(0, 60)}</nLacre></lacres>`));
    return parts.length ? `<vol>${parts.join('')}</vol>` : '';
  }

  function buildTransp(transp, idDest) {
    const t = transp || {};
    const modFrete = parseInt(t.modFrete ?? 9, 10);
    const mf = Number.isFinite(modFrete) ? modFrete : 9;
    const volXml = (Array.isArray(t.vol) ? t.vol : (t.vol ? [t.vol] : []))
      .map(buildVolume)
      .join('');
    // X03-30: modFrete 9 → só modFrete (+vol).
    if (mf === 9) {
      return `<transp><modFrete>9</modFrete>${volXml}</transp>`;
    }
    const transportaXml = buildTransporta(t.transporta);
    // X02-20 (868): operação interestadual (idDest 2) não informa veicTransp/reboque.
    const semVeicReboque = String(idDest) === '2';
    const veicXml = semVeicReboque ? '' : buildVeiculo('veicTransp', t.veicTransp);
    const reboqueXml = semVeicReboque ? '' : (Array.isArray(t.reboque) ? t.reboque : [])
      .map((rb) => buildVeiculo('reboque', rb))
      .join('');
    return `<transp><modFrete>${mf}</modFrete>${transportaXml}${veicXml}${reboqueXml}${volXml}</transp>`;
  }

  // ─── Bloco <pag> (pagamento) ──────────────────────────────────────────────
  // YA03-30 (cStat 904, NT 2017.002 / MOC Anexo I): tPag 90 (Sem pagamento) ou 91
  // com vPag<>0 → "Rejeicao: Informado indevidamente campo valor de pagamento".
  // XSD oficial: vPag "poderá ser omitida quando tPag=90", mas o elemento NÃO tem
  // minOccurs="0" (é required) — por isso emitimos 0.00 (forma aprovada), nunca omitimos.
  // A17: card (cartão) dentro do detPag quando informado (tPag 03/04/17).
  function buildPag(pag) {
    const pagamentos = Array.isArray(pag) && pag.length > 0 ? pag : [{ tPag: '01', vPag: 0 }];
    const detPag = pagamentos.map(p => {
      const tPag = p.tPag || '01';
      const vPag = (tPag === '90' || tPag === '91') ? 0 : p.vPag;
      const c = p.card || null;
      const card = (c && ['03', '04', '17'].includes(String(tPag)) && (c.tpIntegra || c.CNPJ || c.tBand || c.cAut))
        ? `<card><tpIntegra>${['1', '2'].includes(String(c.tpIntegra)) ? c.tpIntegra : '2'}</tpIntegra>`
          + `${c.CNPJ ? `<CNPJ>${esc(String(c.CNPJ).replace(/\D/g, ''))}</CNPJ>` : ''}`
          + `${c.tBand ? `<tBand>${esc(String(c.tBand))}</tBand>` : ''}`
          + `${c.cAut ? `<cAut>${esc(String(c.cAut))}</cAut>` : ''}</card>` : '';
      return `<detPag><tPag>${tPag}</tPag><vPag>${num(vPag)}</vPag>${card}</detPag>`;
    }).join('');
    return `<pag>${detPag}</pag>`;
  }

  // ─── Cobrança parcelada (A16 — cobr/fat + dup) ───────────────────────────
  // XSD: fat (nFat?, vOrig?, vDesc?, vLiq?) + dup[] (nDup?, dVenc?, vDup).
  function buildCobr(cobr) {
    if (!cobr) return '';
    const dup = Array.isArray(cobr.dup) ? cobr.dup : (cobr.dup ? [cobr.dup] : []);
    const f = cobr.fat || {};
    const fat = (f.nFat || f.vOrig || f.vDesc || f.vLiq)
      ? `<fat>${f.nFat ? `<nFat>${esc(String(f.nFat).slice(0, 60))}</nFat>` : ''}`
        + `${f.vOrig != null && String(f.vOrig).trim() !== '' ? `<vOrig>${num(f.vOrig)}</vOrig>` : ''}`
        + `${f.vDesc != null && String(f.vDesc).trim() !== '' ? `<vDesc>${num(f.vDesc)}</vDesc>` : ''}`
        + `${f.vLiq != null && String(f.vLiq).trim() !== '' ? `<vLiq>${num(f.vLiq)}</vLiq>` : ''}</fat>` : '';
    const dups = dup.map((d) => {
      const vDup = parseFiscalNumber(d.vDup);
      if (!(vDup > 0)) return '';
      return `<dup>${d.nDup ? `<nDup>${esc(String(d.nDup).slice(0, 60))}</nDup>` : ''}`
        + `${/^\d{4}-\d{2}-\d{2}$/.test(String(d.dVenc || '')) ? `<dVenc>${d.dVenc}</dVenc>` : ''}`
        + `<vDup>${num(vDup)}</vDup></dup>`;
    }).join('');
    if (!fat && !dups) return '';
    return `<cobr>${fat}${dups}</cobr>`;
  }

  // ─── Bloco <infAdic> ──────────────────────────────────────────────────────
  function buildInfAdic(obs) {
    if (!obs) return '';
    return `<infAdic><infCpl>${esc(obs)}</infCpl></infAdic>`;
  }

  // ─── Calcular totais a partir dos itens ───────────────────────────────────
  function calcularTotais(itens, desconto, frete) {
    let vProd = 0, vBC = 0, vICMS = 0, vIPI = 0, vPIS = 0, vCOFINS = 0, vFCP = 0;
    let vBCIBSCBS = 0, vIBSUF = 0, vIBSMun = 0, vCBS = 0, vIS = 0;
    let vDifIBSUF = 0, vDifIBSMun = 0, vDifCBS = 0, vCredPres = 0, vIBSEstCred = 0, vCBSEstCred = 0;
    let vDevTribIBSUF = 0, vDevTribIBSMun = 0, vDevTribCBS = 0;
    let vMonoIBS = 0, vMonoCBS = 0, vMonoRetenIBS = 0, vMonoRetenCBS = 0, vMonoRetIBS = 0, vMonoRetCBS = 0;
    // ICMS monofásico (NT 2023.001 — ICMSTot qBCMono/vICMSMono/... opcionais)
    let qBCMono = 0, vICMSMono = 0, qBCMonoReten = 0, vICMSMonoReten = 0, qBCMonoRet = 0, vICMSMonoRet = 0;
    itens.forEach(it => {
      vProd   += parseFloat(it.vProd || it.total) || 0;
      vBC     += parseFloat(it.imposto?.icms?.vBC) || 0;
      vICMS   += parseFloat(it.imposto?.icms?.vICMS) || 0;
      vFCP    += parseFiscalNumber(it.imposto?.icms?.vFCP);
      // ICMS monofásico por item (CST 02/15/53/61): totais opcionais do ICMSTot.
      // Auto-cálculo q×adRem espelha o buildICMSNormal (o item raramente
      // traz vICMSMono preenchido). NOTA XSD: nos TOTAIS qBCMono* é
      // TDec_1302 (2 decimais), diferente do item (TDec_1104v, 4 casas).
      const mi = it.imposto?.icms || {};
      const mcs = String(mi.cst || '');
      if (['02', '15', '53', '61'].includes(mcs)) {
        const q = parseFiscalNumber(mi.qBCMono), a = parseFiscalNumber(mi.adRemICMS);
        const qr = parseFiscalNumber(mi.qBCMonoReten), ar = parseFiscalNumber(mi.adRemICMSReten);
        qBCMono      += q;
        vICMSMono    += mi.vICMSMono != null && mi.vICMSMono !== '' ? parseFiscalNumber(mi.vICMSMono) : q * a;
        qBCMonoReten += qr;
        vICMSMonoReten += mi.vICMSMonoReten != null && mi.vICMSMonoReten !== '' ? parseFiscalNumber(mi.vICMSMonoReten) : qr * ar;
        qBCMonoRet   += parseFiscalNumber(mi.qBCMonoRet);
        vICMSMonoRet += parseFiscalNumber(mi.vICMSMonoRet);
      }
      vIPI    += parseFloat(it.imposto?.ipi?.vIPI) || 0;
      vPIS    += parseFloat(it.imposto?.pis?.vPIS) || 0;
      vCOFINS += parseFloat(it.imposto?.cofins?.vCOFINS) || 0;
      // Reforma Tributária: IBSCBS (mesma regra do buildIBSCBS: emite se
      // cst+cClassTrib presentes e habilitado !== false)
      const gi = it.imposto?.ibscbs;
      if (gi && gi.cst && gi.cClassTrib && gi.habilitado !== false) {
        // Monofásico (CST 620) é quantitativo (qBCMono/vBCMono) — não tem vBC
        // de IBS/CBS: só acumula totais gMono, sem poluir vBCIBSCBS/vIBS/vCBS.
        if (gi.mono) {
          const tI = monoLadoTotais('ibs', gi.mono.ibs);
          const tC = monoLadoTotais('cbs', gi.mono.cbs);
          vMonoIBS += tI.padrao; vMonoRetenIBS += tI.reten; vMonoRetIBS += tI.ret;
          vMonoCBS += tC.padrao; vMonoRetenCBS += tC.reten; vMonoRetCBS += tC.ret;
        } else {
        const bc = parseFiscalNumber(gi.vBC != null ? gi.vBC : (it.vProd || it.total));
        const puf = parseFiscalNumber(gi.pIBSUF), pmu = parseFiscalNumber(gi.pIBSMun), pcb = parseFiscalNumber(gi.pCBS);
        vBCIBSCBS += bc;
        vIBSUF    += gi.vIBSUF  != null ? parseFiscalNumber(gi.vIBSUF)  : bc * puf / 100;
        vIBSMun   += gi.vIBSMun != null ? parseFiscalNumber(gi.vIBSMun) : bc * pmu / 100;
        vCBS      += gi.vCBS    != null ? parseFiscalNumber(gi.vCBS)    : bc * pcb / 100;
        vDevTribIBSUF  += devTribVal(gi.devTribUF);
        vDevTribIBSMun += devTribVal(gi.devTribMun);
        vDevTribCBS    += devTribVal(gi.devTribCBS);
        const pdif = parseFiscalNumber(gi.pDif);
        if (pdif > 0) { vDifIBSUF += bc * pdif / 100; vDifIBSMun += bc * pdif / 100; vDifCBS += bc * pdif / 100; }
        const cp = gi.credPresOper;
        if (cp && cp.cCredPres) {
          const bcCP = cp.vBCCredPres != null ? parseFiscalNumber(cp.vBCCredPres) : bc;
          const pCP = parseFiscalNumber(cp.pCredPres);
          vCredPres += cp.vCredPres != null ? parseFiscalNumber(cp.vCredPres) : bcCP * pCP / 100;
        }
        if (gi.estornoCred) {
          vIBSEstCred += parseFiscalNumber(gi.estornoCred.vIBSEstCred);
          vCBSEstCred += parseFiscalNumber(gi.estornoCred.vCBSEstCred);
        }
        }
      }
      // Imposto Seletivo
      const gs = it.imposto?.is;
      if (gs && gs.habilitado) {
        const bcis = parseFiscalNumber(gs.vBCIS != null ? gs.vBCIS : (it.vProd || it.total));
        vIS += gs.vIS != null ? parseFiscalNumber(gs.vIS) : bcis * parseFiscalNumber(gs.pIS) / 100;
      }
    });
    const vDesc  = parseFloat(desconto) || 0;
    const vFrete = parseFloat(frete)    || 0;
    const vNF    = vProd + vIPI - vDesc + vFrete;
    const vIBS   = vIBSUF + vIBSMun;
    return { vProd, vBC, vICMS, vIPI, vPIS, vCOFINS, vFCP, vDesc, vFrete, vNF,
      vTotTrib: vICMS + vIPI + vPIS + vCOFINS + vIBS + vCBS + vIS,
      vBCIBSCBS, vIBSUF, vIBSMun, vIBS, vCBS, vIS,
      vDifIBSUF, vDifIBSMun, vDifCBS, vCredPres, vIBSEstCred, vCBSEstCred,
      vDevTribIBSUF, vDevTribIBSMun, vDevTribCBS,
      vMonoIBS, vMonoCBS, vMonoRetenIBS, vMonoRetenCBS, vMonoRetIBS, vMonoRetCBS,
      qBCMono, vICMSMono, qBCMonoReten, vICMSMonoReten, qBCMonoRet, vICMSMonoRet };
  }

  // ─── Montar XML NF-e completo (sem assinatura) ────────────────────────────
  // NOTA: O XML pré-assinatura é apenas <NFe> — o <nfeProc> é o container
  //       pós-autorização retornado pela SEFAZ junto com o protocolo.
  function buildNFeXML(nfe) {
    const { emit, dest, ide, det, transp, pag, infAdic, cobr } = nfe;
    // Garantir campos ide
    ide.ufEmit = emit?.endereco?.uf || 'SP';
    ide.mod    = ide.mod    || 55;
    ide.tpAmb  = ide.tpAmb  || 2; // homologação por padrão
    ide.tpNF   = ide.tpNF   ?? 1; // 4.00: 0=Entrada, 1=Saída

    const chaveInfo = gerarChave(emit, ide);
    ide.cMunFG = requireCodigoMunicipio(
      ide.cMunFG || emit?.endereco?.codigoMunicipio,
      'Código IBGE do município de ocorrência'
    );

    // Calcular totais se não vierem prontos
    const total = nfe.total || calcularTotais(det || [], nfe.desconto, nfe.frete);

    const itensXml = (det || []).map((it, i) => buildDet(it, i + 1, emit.crt || 1, ide.finNFe)).join('');

    // ──────────────────────────────────────────────────────────────────────
    // XML pré-assinatura: apenas <NFe><infNFe>...</infNFe></NFe>
    // Após assinar (Cloud Function) → <Signature> é injetado dentro de <infNFe>
    // Após autorização SEFAZ        → wrapped em <nfeProc><NFe>...</NFe><protNFe>...</protNFe></nfeProc>
    // ──────────────────────────────────────────────────────────────────────
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="${NS}">
<infNFe Id="NFe${chaveInfo.chave}" versao="4.00">${buildIde(ide, chaveInfo)}${buildEmit(emit)}${buildDest(dest, ide.tpAmb)}${itensXml}${buildTotal(total)}${buildTransp(transp, ide.idDest)}${buildPag(pag)}${buildCobr(cobr)}${buildInfAdic(infAdic)}${buildInfRespTec(nfe.respTec)}
</infNFe>
</NFe>`;

    // SEFAZ (cStat 588) rejeita "caracteres de edição" entre tags: gerar XML COMPACTO
    // (sem quebras/indentação). A assinatura é feita sobre esta forma compacta.
    const compact = xml.replace(/>\s+</g, '><').trim();
    return { xml: compact, chave: chaveInfo.chave, total };
  }

  return {
    buildNFeXML,
    calcularTotais,
    gerarChave,
    calcDV,
  };
})();

window.NFXmlBuilder = NFXmlBuilder;
