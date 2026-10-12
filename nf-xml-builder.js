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
  function buildIde(ide, chaveInfo) {
    // TDateTimeUTC: sem milissegundos, offset -03:00 (validado no schema oficial)
    const dhEmi = ide.dhEmi ? new Date(ide.dhEmi).toISOString().replace(/\.\d{3}Z$/, '-03:00') : '';
    return `
    <ide>
      <cUF>${getCUF(ide.ufEmit)}</cUF>
      <cNF>${chaveInfo.cNF}</cNF>
      <natOp>${esc(ide.natOp || 'Venda de mercadoria')}</natOp>
      <mod>${ide.mod || 55}</mod>
      <serie>${ide.serie || 1}</serie>
      <nNF>${ide.nNF || 1}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
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
      <verProc>Sisweb 1.0</verProc>
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

  // ─── ICMS por CST (Regime Normal) — tags corretas do leiaute 4.00 ─────────
  //  00→ICMS00 | 10→ICMS10 | 20→ICMS20 | 30→ICMS30 | 40/41/50→ICMS40
  //  51→ICMS51 | 60→ICMS60 | 70→ICMS70 | 90→ICMS90 (demais)
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
      case '00':
        return `<ICMS00><orig>${orig}</orig><CST>00</CST><modBC>${icms.modBC || 3}</modBC><vBC>${num(icms.vBC)}</vBC><pICMS>${num(icms.pICMS)}</pICMS><vICMS>${num(icms.vICMS)}</vICMS></ICMS00>`;
      case '10':
        return `<ICMS10><orig>${orig}</orig><CST>10</CST><modBC>${icms.modBC || 3}</modBC><vBC>${num(icms.vBC)}</vBC><pICMS>${num(icms.pICMS)}</pICMS><vICMS>${num(icms.vICMS)}</vICMS>${st()}</ICMS10>`;
      case '20':
        return `<ICMS20><orig>${orig}</orig><CST>20</CST><modBC>${icms.modBC || 3}</modBC><pRedBC>${num(icms.pRedBC)}</pRedBC><vBC>${num(icms.vBC)}</vBC><pICMS>${num(icms.pICMS)}</pICMS><vICMS>${num(icms.vICMS)}</vICMS></ICMS20>`;
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
        return `<ICMS51><orig>${orig}</orig><CST>51</CST><modBC>${icms.modBC || 3}</modBC>${icms.pRedBC != null ? `<pRedBC>${num(icms.pRedBC)}</pRedBC>` : ''}<vBC>${num(icms.vBC)}</vBC><pICMS>${num(icms.pICMS)}</pICMS><vICMSOp>${num(icms.vICMSOp)}</vICMSOp><pDif>${num(icms.pDif)}</pDif><vICMSDif>${num(icms.vICMSDif)}</vICMSDif><vICMS>${num(icms.vICMS)}</vICMS></ICMS51>`;
      case '60':
        return `<ICMS60><orig>${orig}</orig><CST>60</CST><vBCSTRet>${num(icms.vBCSTRet)}</vBCSTRet>${icms.pST != null ? `<pST>${num(icms.pST)}</pST>` : ''}<vICMSSTRet>${num(icms.vICMSSTRet)}</vICMSSTRet></ICMS60>`;
      case '70':
        return `<ICMS70><orig>${orig}</orig><CST>70</CST><modBC>${icms.modBC || 3}</modBC><pRedBC>${num(icms.pRedBC)}</pRedBC><vBC>${num(icms.vBC)}</vBC><pICMS>${num(icms.pICMS)}</pICMS><vICMS>${num(icms.vICMS)}</vICMS>${st()}</ICMS70>`;
      default:
        return `<ICMS90><orig>${orig}</orig><CST>90</CST>${icms.modBC ? `<modBC>${icms.modBC}</modBC>` : ''}<vBC>${num(icms.vBC)}</vBC>${icms.pICMS != null ? `<pICMS>${num(icms.pICMS)}</pICMS>` : ''}<vICMS>${num(icms.vICMS)}</vICMS>${st()}</ICMS90>`;
    }
  }

  // ─── PIS ─────────────────────────────────────────────────────────────────
  function buildPIS(pis) {
    const cst = pis?.cST || '07';
    if (cst === '01' || cst === '02') {
      return `<PISAliq><CST>${cst}</CST><vBC>${num(pis.vBC)}</vBC><pPIS>${num(pis.pPIS,4)}</pPIS><vPIS>${num(pis.vPIS)}</vPIS></PISAliq>`;
    }
    return `<PISNT><CST>${cst}</CST></PISNT>`;
  }

  // ─── COFINS ───────────────────────────────────────────────────────────────
  function buildCOFINS(cofins) {
    const cst = cofins?.cST || '07';
    if (cst === '01' || cst === '02') {
      return `<COFINSAliq><CST>${cst}</CST><vBC>${num(cofins.vBC)}</vBC><pCOFINS>${num(cofins.pCOFINS,4)}</pCOFINS><vCOFINS>${num(cofins.vCOFINS)}</vCOFINS></COFINSAliq>`;
    }
    return `<COFINSNT><CST>${cst}</CST></COFINSNT>`;
  }

  // ─── IBS/CBS (Reforma Tributária — grupo <IBSCBS>, TTribNFe) ──────────────
  // Validado contra o schema oficial PL_010f_v1.04 (DFeTiposBasicos TTribNFe /
  // TCIBS_NFe). Emitido apenas quando habilitado na config/item (minOccurs=0),
  // preservando o comportamento atual quando ausente.
  function buildIBSCBS(item) {
    const g = item?.imposto?.ibscbs;
    if (!g || !g.habilitado) return '';
    if (!g.cst || !g.cClassTrib) {
      throw new Error('IBS/CBS: CST e cClassTrib são obrigatórios quando o grupo está habilitado');
    }
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
    // Grupo base — choice do TTribNFe: gIBSCBS | gTransfCred (CST 800) | gAjusteCompet (CST 811)
    let baseGroup;
    if (g.transfCred) {
      baseGroup = `<gTransfCred><vIBS>${num(g.transfCred.vIBS)}</vIBS><vCBS>${num(g.transfCred.vCBS)}</vCBS></gTransfCred>`;
    } else if (g.ajusteCompet) {
      baseGroup = `<gAjusteCompet><competApur>${esc(g.ajusteCompet.competApur)}</competApur><vIBS>${num(g.ajusteCompet.vIBS)}</vIBS><vCBS>${num(g.ajusteCompet.vCBS)}</vCBS></gAjusteCompet>`;
    } else {
      baseGroup = `<gIBSCBS><vBC>${num(vBCn)}</vBC>`
        + `<gIBSUF><pIBSUF>${num(pIBSUF, 4)}</pIBSUF>${gDifTag()}${gRedTag(pIBSUF)}<vIBSUF>${num(vIBSUFn)}</vIBSUF></gIBSUF>`
        + `<gIBSMun><pIBSMun>${num(pIBSMun, 4)}</pIBSMun>${gDifTag()}${gRedTag(pIBSMun)}<vIBSMun>${num(vIBSMunn)}</vIBSMun></gIBSMun>`
        + `<vIBS>${num(vIBSn)}</vIBS>`
        + `<gCBS><pCBS>${num(pCBS, 4)}</pCBS>${gDifTag()}${gRedTag(pCBS)}<vCBS>${num(vCBSn)}</vCBS></gCBS>`
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
    return `\n        <IBSCBS><CST>${esc(g.cst)}</CST><cClassTrib>${esc(g.cClassTrib)}</cClassTrib>${baseGroup}${estorno}${cred}</IBSCBS>`;
  }

  // ─── Imposto Seletivo (<IS>, TIS) — Reforma Tributária ────────────────────
  function buildIS(item) {
    const g = item?.imposto?.is;
    if (!g || !g.habilitado) return '';
    if (!g.cstIS || !g.cClassTribIS) {
      throw new Error('IS: CSTIS e cClassTribIS são obrigatórios quando o grupo está habilitado');
    }
    const vBCISn = parseFiscalNumber(g.vBCIS != null ? g.vBCIS : (item.vProd || item.total));
    const pIS = parseFiscalNumber(g.pIS);
    const vISn = g.vIS != null ? parseFiscalNumber(g.vIS) : vBCISn * pIS / 100;
    const adRem = g.adRemIS != null ? `<adRemIS>${num(g.adRemIS, 4)}</adRemIS>` : '';
    return `\n        <IS><CSTIS>${esc(g.cstIS)}</CSTIS><cClassTribIS>${esc(g.cClassTribIS)}</cClassTribIS>`
      + `<vBCIS>${num(vBCISn)}</vBCIS><pIS>${num(pIS, 4)}</pIS>${adRem}<vIS>${num(vISn)}</vIS></IS>`;
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
  function buildDet(item, nItem, crt) {
    const imp = item.imposto || {};
    const icms = imp.icms || {};
    const usaCSOSN = crt === 1 || crt === 2;
    const icmsXml = usaCSOSN ? buildICMSSN(icms) : buildICMSNormal(icms);
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
      </imposto>
    </det>`;
  }

  // ─── Bloco <total> ────────────────────────────────────────────────────────
  function buildTotal(tot) {
    const t = tot || {};
    return `
    <total>
      <ICMSTot>
        <vBC>${num(t.vBC)}</vBC>
        <vICMS>${num(t.vICMS)}</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
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
      </ICMSTot>${(Number(t.vIS) > 0) ? `<ISTot><vIS>${num(t.vIS)}</vIS></ISTot>` : ''}${(Number(t.vBCIBSCBS) > 0) ? `<IBSCBSTot><vBCIBSCBS>${num(t.vBCIBSCBS)}</vBCIBSCBS><gIBS><gIBSUF><vDif>${num(t.vDifIBSUF)}</vDif><vDevTrib>0.00</vDevTrib><vIBSUF>${num(t.vIBSUF)}</vIBSUF></gIBSUF><gIBSMun><vDif>${num(t.vDifIBSMun)}</vDif><vDevTrib>0.00</vDevTrib><vIBSMun>${num(t.vIBSMun)}</vIBSMun></gIBSMun><vIBS>${num(t.vIBS)}</vIBS><vCredPres>${num(t.vCredPres)}</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gIBS><gCBS><vDif>${num(t.vDifCBS)}</vDif><vDevTrib>0.00</vDevTrib><vCBS>${num(t.vCBS)}</vCBS><vCredPres>${num(t.vCredPres)}</vCredPres><vCredPresCondSus>0.00</vCredPresCondSus></gCBS>${(Number(t.vIBSEstCred) > 0 || Number(t.vCBSEstCred) > 0) ? `<gEstornoCred><vIBSEstCred>${num(t.vIBSEstCred)}</vIBSEstCred><vCBSEstCred>${num(t.vCBSEstCred)}</vCBSEstCred></gEstornoCred>` : ''}</IBSCBSTot>` : ''}
    </total>`;
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
    const qVol = onlyDigits(v.qVol);
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

  function buildTransp(transp) {
    const t = transp || {};
    const modFrete = t.modFrete !== undefined ? t.modFrete : 9;
    const transportaXml = buildTransporta(t.transporta);
    const veicXml = buildVeiculo('veicTransp', t.veicTransp);
    const reboqueXml = (Array.isArray(t.reboque) ? t.reboque : [])
      .map((rb) => buildVeiculo('reboque', rb))
      .join('');
    const volXml = (Array.isArray(t.vol) ? t.vol : (t.vol ? [t.vol] : []))
      .map(buildVolume)
      .join('');
    return `
    <transp>
      <modFrete>${modFrete}</modFrete>${transportaXml}${veicXml}${reboqueXml}${volXml}
    </transp>`;
  }

  // ─── Bloco <pag> (pagamento) ──────────────────────────────────────────────
  function buildPag(pag) {
    const pagamentos = Array.isArray(pag) && pag.length > 0 ? pag : [{ tPag: '01', vPag: 0 }];
    const detPag = pagamentos.map(p =>
      `<detPag><tPag>${p.tPag || '01'}</tPag><vPag>${num(p.vPag)}</vPag></detPag>`
    ).join('');
    return `<pag>${detPag}</pag>`;
  }

  // ─── Bloco <infAdic> ──────────────────────────────────────────────────────
  function buildInfAdic(obs) {
    if (!obs) return '';
    return `<infAdic><infCpl>${esc(obs)}</infCpl></infAdic>`;
  }

  // ─── Calcular totais a partir dos itens ───────────────────────────────────
  function calcularTotais(itens, desconto, frete) {
    let vProd = 0, vBC = 0, vICMS = 0, vIPI = 0, vPIS = 0, vCOFINS = 0;
    let vBCIBSCBS = 0, vIBSUF = 0, vIBSMun = 0, vCBS = 0, vIS = 0;
    let vDifIBSUF = 0, vDifIBSMun = 0, vDifCBS = 0, vCredPres = 0, vIBSEstCred = 0, vCBSEstCred = 0;
    itens.forEach(it => {
      vProd   += parseFloat(it.vProd || it.total) || 0;
      vBC     += parseFloat(it.imposto?.icms?.vBC) || 0;
      vICMS   += parseFloat(it.imposto?.icms?.vICMS) || 0;
      vIPI    += parseFloat(it.imposto?.ipi?.vIPI) || 0;
      vPIS    += parseFloat(it.imposto?.pis?.vPIS) || 0;
      vCOFINS += parseFloat(it.imposto?.cofins?.vCOFINS) || 0;
      // Reforma Tributária: IBSCBS
      const gi = it.imposto?.ibscbs;
      if (gi && gi.habilitado) {
        const bc = parseFiscalNumber(gi.vBC != null ? gi.vBC : (it.vProd || it.total));
        const puf = parseFiscalNumber(gi.pIBSUF), pmu = parseFiscalNumber(gi.pIBSMun), pcb = parseFiscalNumber(gi.pCBS);
        vBCIBSCBS += bc;
        vIBSUF    += gi.vIBSUF  != null ? parseFiscalNumber(gi.vIBSUF)  : bc * puf / 100;
        vIBSMun   += gi.vIBSMun != null ? parseFiscalNumber(gi.vIBSMun) : bc * pmu / 100;
        vCBS      += gi.vCBS    != null ? parseFiscalNumber(gi.vCBS)    : bc * pcb / 100;
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
    return { vProd, vBC, vICMS, vIPI, vPIS, vCOFINS, vDesc, vFrete, vNF,
      vTotTrib: vICMS + vIPI + vPIS + vCOFINS + vIBS + vCBS + vIS,
      vBCIBSCBS, vIBSUF, vIBSMun, vIBS, vCBS, vIS,
      vDifIBSUF, vDifIBSMun, vDifCBS, vCredPres, vIBSEstCred, vCBSEstCred };
  }

  // ─── Montar XML NF-e completo (sem assinatura) ────────────────────────────
  // NOTA: O XML pré-assinatura é apenas <NFe> — o <nfeProc> é o container
  //       pós-autorização retornado pela SEFAZ junto com o protocolo.
  function buildNFeXML(nfe) {
    const { emit, dest, ide, det, transp, pag, infAdic } = nfe;
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

    const itensXml = (det || []).map((it, i) => buildDet(it, i + 1, emit.crt || 1)).join('');

    // ──────────────────────────────────────────────────────────────────────
    // XML pré-assinatura: apenas <NFe><infNFe>...</infNFe></NFe>
    // Após assinar (Cloud Function) → <Signature> é injetado dentro de <infNFe>
    // Após autorização SEFAZ        → wrapped em <nfeProc><NFe>...</NFe><protNFe>...</protNFe></nfeProc>
    // ──────────────────────────────────────────────────────────────────────
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="${NS}">
<infNFe Id="NFe${chaveInfo.chave}" versao="4.00">${buildIde(ide, chaveInfo)}${buildEmit(emit)}${buildDest(dest, ide.tpAmb)}${itensXml}${buildTotal(total)}${buildTransp(transp)}${buildPag(pag)}${buildInfAdic(infAdic)}
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
