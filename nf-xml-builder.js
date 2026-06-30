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
  function esc(v) {
    return String(v || '')
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
  function buildIde(ide, chaveInfo) {
    const dhEmi = ide.dhEmi ? new Date(ide.dhEmi).toISOString().replace('Z', '-03:00') : '';
    return `
    <ide>
      <cUF>${getCUF(ide.ufEmit)}</cUF>
      <cNF>${chaveInfo.cNF}</cNF>
      <natOp>${esc(ide.natOp || 'Venda de mercadoria')}</natOp>
      <mod>${ide.mod || 55}</mod>
      <serie>${ide.serie || 1}</serie>
      <nNF>${ide.nNF || 1}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>${ide.tpNF || 1}</tpNF>
      <idDest>${ide.idDest || 1}</idDest>
      <cMunFG>${requireCodigoMunicipio(ide.cMunFG, 'Código IBGE do município de ocorrência')}</cMunFG>
      <tpImp>${ide.tpImp || 1}</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${chaveInfo.cDV}</cDV>
      <tpAmb>${ide.tpAmb || 2}</tpAmb>
      <finNFe>${ide.finNFe || 1}</finNFe>
      <indFinal>${ide.indFinal || 0}</indFinal>
      <indPres>${ide.indPres || 0}</indPres>
      <indPag>0</indPag>
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
      ${dest.email ? `<email>${esc(dest.email)}</email>` : ''}
    </dest>`;
  }

  // ─── ICMS por CSOSN (Simples Nacional) ───────────────────────────────────
  function buildICMSSN(icms) {
    const csosn = icms.csosn || '102';
    switch (csosn) {
      case '101': return `<ICMSSN101><orig>${icms.orig||0}</orig><CSOSN>101</CSOSN><pCredSN>${num(icms.pCredSN,2)}</pCredSN><vCredICMSSN>${num(icms.vCredICMSSN,2)}</vCredICMSSN></ICMSSN101>`;
      case '400': return `<ICMSSN400><orig>${icms.orig||0}</orig><CSOSN>400</CSOSN></ICMSSN400>`;
      case '500': return `<ICMSSN500><orig>${icms.orig||0}</orig><CSOSN>500</CSOSN><vBCSTRet>${num(0)}</vBCSTRet><pST>${num(0)}</pST><vICMSSTRet>${num(0)}</vICMSSTRet></ICMSSN500>`;
      default:    return `<ICMSSN102><orig>${icms.orig||0}</orig><CSOSN>102</CSOSN></ICMSSN102>`;
    }
  }

  // ─── ICMS por CST (Regime Normal) ────────────────────────────────────────
  function buildICMSNormal(icms) {
    const cst = icms.cst || '00';
    if (cst === '00' || cst === '20') {
      return `<ICMS00>
        <orig>${icms.orig||0}</orig><CST>${cst}</CST>
        <modBC>${icms.modBC||3}</modBC><vBC>${num(icms.vBC)}</vBC>
        <pICMS>${num(icms.pICMS)}</pICMS><vICMS>${num(icms.vICMS)}</vICMS>
      </ICMS00>`;
    }
    if (cst === '40' || cst === '41') {
      return `<ICMS40><orig>${icms.orig||0}</orig><CST>${cst}</CST></ICMS40>`;
    }
    return `<ICMS90><orig>${icms.orig||0}</orig><CST>90</CST></ICMS90>`;
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
        <COFINS>${buildCOFINS(imp.cofins)}</COFINS>
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
        <vTotTrib>0.00</vTotTrib>
      </ICMSTot>
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
    itens.forEach(it => {
      vProd   += parseFloat(it.vProd || it.total) || 0;
      vBC     += parseFloat(it.imposto?.icms?.vBC) || 0;
      vICMS   += parseFloat(it.imposto?.icms?.vICMS) || 0;
      vIPI    += parseFloat(it.imposto?.ipi?.vIPI) || 0;
      vPIS    += parseFloat(it.imposto?.pis?.vPIS) || 0;
      vCOFINS += parseFloat(it.imposto?.cofins?.vCOFINS) || 0;
    });
    const vDesc  = parseFloat(desconto) || 0;
    const vFrete = parseFloat(frete)    || 0;
    const vNF    = vProd + vIPI - vDesc + vFrete;
    return { vProd, vBC, vICMS, vIPI, vPIS, vCOFINS, vDesc, vFrete, vNF };
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
    ide.tpNF   = ide.tpNF   || 1; // saída

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

    return { xml, chave: chaveInfo.chave, total };
  }

  // ─── Montar nfeProc (pós-autorização, para armazenamento/DANFE) ───────────
  function buildNFeProc(xmlAssinadoComProtocolo, nProt, dhRecbto, versao = '4.00') {
    // Extrair o bloco <NFe>...</NFe> do XML assinado
    const nfeMatch = xmlAssinadoComProtocolo.match(/<NFe[\s\S]*?<\/NFe>/);
    const nfeXml = nfeMatch ? nfeMatch[0] : xmlAssinadoComProtocolo;
    const dhFmt = dhRecbto || new Date().toISOString().replace('Z', '-03:00');
    return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="${versao}" xmlns="${NS}">
${nfeXml}
<protNFe versao="${versao}">
  <infProt>
    <tpAmb>2</tpAmb>
    <verAplic>SVRS${versao}</verAplic>
    <chNFe></chNFe>
    <dhRecbto>${dhFmt}</dhRecbto>
    <nProt>${nProt}</nProt>
    <digVal></digVal>
    <cStat>100</cStat>
    <xMotivo>Autorizado o uso da NF-e</xMotivo>
  </infProt>
</protNFe>
</nfeProc>`;
  }

  return {
    buildNFeXML,
    buildNFeProc,
    calcularTotais,
    gerarChave,
    calcDV,
  };
})();

window.NFXmlBuilder = NFXmlBuilder;
