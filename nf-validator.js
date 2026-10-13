/**
 * nf-validator.js — Validações Legais e Fiscais NF-e
 * Valida: campos obrigatórios, CNPJ/CPF, NCM, CFOP, valores, schema
 * Sisweb — NF-e Sistema Multi-Tenant
 */

const NFValidator = (() => {
  'use strict';

  // ─── Resultados de validação ───────────────────────────────────────────────
  function ok()       { return { valid: true,  errors: [] }; }
  function fail(msgs) { return { valid: false, errors: Array.isArray(msgs) ? msgs : [msgs] }; }
  function merge(...results) {
    const errors = results.flatMap(r => r.errors || []);
    return { valid: errors.length === 0, errors };
  }

  // ─── CNPJ ──────────────────────────────────────────────────────────────────
  function validarCNPJ(cnpj) {
    const n = String(cnpj || '').replace(/\D/g, '');
    if (n.length !== 14) return false;
    if (/^(\d)\1+$/.test(n)) return false;
    const calc = (s, w) => {
      let sum = 0, p = w;
      for (let i = 0; i < s.length; i++) { sum += parseInt(s[i]) * p--; if (p < 2) p = 9; }
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return parseInt(n[12]) === calc(n.slice(0, 12), 5) &&
           parseInt(n[13]) === calc(n.slice(0, 13), 6);
  }

  // ─── CPF ───────────────────────────────────────────────────────────────────
  function validarCPF(cpf) {
    const n = String(cpf || '').replace(/\D/g, '');
    if (n.length !== 11 || /^(\d)\1+$/.test(n)) return false;
    const calc = (s, len) => {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += parseInt(s[i]) * (len + 1 - i);
      const r = (sum * 10) % 11;
      return r >= 10 ? 0 : r;
    };
    return calc(n, 9) === parseInt(n[9]) && calc(n, 10) === parseInt(n[10]);
  }

  // ─── NCM (8 dígitos numéricos) ─────────────────────────────────────────────
  function validarNCM(ncm) {
    const n = String(ncm || '').replace(/\D/g, '');
    return n.length === 8;
  }

  // ─── CFOP (4 dígitos: 1-9 + 3 dígitos) ────────────────────────────────────
  function validarCFOP(cfop) {
    return /^[1-9]\d{3}$/.test(String(cfop || '').trim());
  }

  // ─── CEP ───────────────────────────────────────────────────────────────────
  function validarCEP(cep) {
    return /^\d{8}$/.test(String(cep || '').replace(/\D/g, ''));
  }

  function validarCodigoMunicipio(codigo) {
    const n = String(codigo || '').replace(/\D/g, '');
    return /^\d{7}$/.test(n) && n !== '0000000';
  }

  function validarPlaca(placa) {
    const p = String(placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p) || /^[A-Z]{4}[0-9]{3}$/.test(p);
  }

  function parseNumeroFiscal(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const raw = String(v || '').trim();
    if (!raw) return 0;
    if (raw.includes(',')) return parseFloat(raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')) || 0;
    return parseFloat(raw.replace(/[^\d.-]/g, '')) || 0;
  }

  // ─── Chave NF-e (44 dígitos) ───────────────────────────────────────────────
  function validarChaveNFe(chave) {
    const n = String(chave || '').replace(/\D/g, '');
    if (n.length !== 44) return false;
    // Verificar DV
    let soma = 0, peso = 2;
    for (let i = 42; i >= 0; i--) {
      soma += parseInt(n[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;
    return parseInt(n[43]) === dv;
  }

  // ─── Validar emitente ──────────────────────────────────────────────────────
  function validarEmitente(emit) {
    const erros = [];
    if (!emit) { erros.push('Dados do emitente não configurados'); return fail(erros); }
    if (!emit.cnpj || !validarCNPJ(emit.cnpj)) erros.push('CNPJ do emitente inválido');
    if (!emit.razaoSocial || emit.razaoSocial.trim().length < 2) erros.push('Razão Social do emitente obrigatória');
    if (!emit.endereco?.logradouro) erros.push('Logradouro do emitente obrigatório');
    if (!emit.endereco?.numero) erros.push('Número do endereço do emitente obrigatório');
    if (!emit.endereco?.municipio) erros.push('Município do emitente obrigatório');
    if (!validarCodigoMunicipio(emit.endereco?.codigoMunicipio)) erros.push('Código IBGE do município do emitente obrigatório/inválido');
    if (!emit.endereco?.uf || !/^[A-Z]{2}$/.test(emit.endereco.uf)) erros.push('UF do emitente inválida');
    if (!emit.endereco?.cep || !validarCEP(emit.endereco.cep)) erros.push('CEP do emitente inválido');
    if (!emit.ie && emit.crt !== 1) erros.push('Inscrição Estadual do emitente obrigatória (regime normal)');
    if (!emit.crt || ![1, 2, 3].includes(emit.crt)) erros.push('CRT do emitente inválido (1=SN, 2=SN excesso, 3=Normal)');
    return erros.length ? fail(erros) : ok();
  }

  // ─── Validar destinatário ──────────────────────────────────────────────────
  function validarDestinatario(dest) {
    const erros = [];
    if (!dest) { erros.push('Dados do destinatário não informados'); return fail(erros); }
    const cnpjLimpo = String(dest.cnpj || '').replace(/\D/g, '');
    const cpfLimpo  = String(dest.cpf  || '').replace(/\D/g, '');
    if (!cnpjLimpo && !cpfLimpo) {
      erros.push('CNPJ ou CPF do destinatário obrigatório');
    } else if (cnpjLimpo && !validarCNPJ(cnpjLimpo)) {
      erros.push('CNPJ do destinatário inválido');
    } else if (!cnpjLimpo && cpfLimpo && !validarCPF(cpfLimpo)) {
      erros.push('CPF do destinatário inválido');
    }
    if (!dest.nome || dest.nome.trim().length < 2) erros.push('Nome/Razão Social do destinatário obrigatório');
    if (!dest.endereco?.logradouro) erros.push('Logradouro do destinatário obrigatório');
    if (!dest.endereco?.municipio)  erros.push('Município do destinatário obrigatório');
    if (!validarCodigoMunicipio(dest.endereco?.codigoMunicipio)) erros.push('Código IBGE do município do destinatário obrigatório/inválido');
    if (!dest.endereco?.uf || !/^[A-Z]{2}$/.test(dest.endereco.uf)) erros.push('UF do destinatário inválida');
    if (!dest.endereco?.cep || !validarCEP(dest.endereco.cep)) erros.push('CEP do destinatário inválido');
    return erros.length ? fail(erros) : ok();
  }

  // ─── Validar item da NF-e ──────────────────────────────────────────────────
  function validarItem(item, index) {
    const n = index + 1;
    const erros = [];
    if (!item.xProd || item.xProd.trim().length < 1) erros.push(`Item ${n}: Descrição do produto obrigatória`);
    if (!item.ncm  || !validarNCM(item.ncm))          erros.push(`Item ${n}: NCM inválido (${item.ncm}) — deve ter 8 dígitos`);
    if (!item.cfop || !validarCFOP(item.cfop))         erros.push(`Item ${n}: CFOP inválido (${item.cfop})`);
    if (!item.uCom || item.uCom.trim().length < 1)     erros.push(`Item ${n}: Unidade comercial obrigatória`);
    if (!(parseFloat(item.qCom) > 0))                  erros.push(`Item ${n}: Quantidade deve ser maior que zero`);
    if (!(parseFloat(item.vUnCom) > 0))                erros.push(`Item ${n}: Valor unitário deve ser maior que zero`);
    if (!(parseFloat(item.vProd) > 0))                 erros.push(`Item ${n}: Valor total do produto deve ser maior que zero`);
    // ICMS
    if (!item.imposto?.icms) erros.push(`Item ${n}: Grupo de impostos ICMS obrigatório`);
    // PIS/COFINS
    if (!item.imposto?.pis)    erros.push(`Item ${n}: Grupo PIS obrigatório`);
    if (!item.imposto?.cofins) erros.push(`Item ${n}: Grupo COFINS obrigatório`);
    // Gate CRT × CSOSN/CST (Fase A — rejeição 931 se cruzar). O CRT vem do
    // emitente (nfe.emit.crt); aqui valida-se o código do item quando o CRT
    // é conhecido (validarNFe injeta via item._crt).
    const crtItem = item._crt ?? item.crt ?? null;
    if (crtItem != null && String(crtItem).trim() !== '' && window.NFTaxTables?.validarCodigoICMS) {
      const ic = item.imposto?.icms || {};
      // Prioridade pelo regime (item pode carregar resíduo do outro campo):
      // CRT 3 → cst; CRT 1/2 → csosn; sem CRT conhecido → cst, senão csosn.
      const codItem = (String(crtItem) === '3' ? (ic.cst || ic.csosn) : (ic.csosn || ic.cst)) || item.csosn || '';
      const gate = window.NFTaxTables.validarCodigoICMS(crtItem, codItem);
      if (!gate.ok) erros.push(`Item ${n}: ${gate.erro}`);
      // ICMS monofásico (02/15/53/61) exige campos adRem do item — SOMENTE
      // quando o código é CST de 2 dígitos (CSOSN 102 termina em "02" mas
      // não é monofásico; o gate acima já separou grupo csosn × cst).
      const codRaw = String(codItem).trim();
      const cod2 = gate.grupo === 'cst' ? codRaw.replace(/\D/g, '').padStart(2, '0').slice(-2) : '';
      if (['02', '15', '61'].includes(cod2)) {
        const m = item.imposto?.icms || {};
        if (!(parseFloat(cod2 === '61' ? m.adRemICMSRet : m.adRemICMS) >= 0 && String(cod2 === '61' ? m.adRemICMSRet : m.adRemICMS ?? '').trim() !== '')) {
          erros.push(`Item ${n}: CST ${cod2} exige alíquota adRem do ICMS no item`);
        }
      }
    }
    // PIS/COFINS CST 03 exige quantidade × alíquota (PISQtde/COFINSQtde)
    for (const [grp, tag] of [['pis', 'PIS'], ['cofins', 'COFINS']]) {
      const cstPC = String(item.imposto?.[grp]?.cST || '').replace(/\D/g, '').padStart(2, '0').slice(-2);
      if (cstPC === '03') {
        const g = item.imposto?.[grp] || {};
        if (!(parseFloat(g.qBCProd) > 0)) erros.push(`Item ${n}: ${tag} CST 03 exige quantidade vendida (qBCProd)`);
        if (!(parseFloat(g.vAliqProd) > 0) && !(parseFloat(g.vPIS ?? g.vCOFINS) > 0)) erros.push(`Item ${n}: ${tag} CST 03 exige alíquota por unidade (vAliqProd) ou valor`);
      }
      if (window.NFTaxTables?.grupoPISCOFINS && cstPC && !window.NFTaxTables.grupoPISCOFINS(cstPC)) {
        erros.push(`Item ${n}: ${tag} CST ${cstPC} inválido (MOC: 01–99)`);
      }
    }
    // IBS/CBS (cStat 1115): grupo EXIGIDO em todo item (fonte: NFePHP
    // sped-nfe master — flagIBSCBS ligada por cClassTrib presente). Ausência
    // = rejeição SEFAZ, então o validador bloqueia antes de transmitir.
    // cClassTrib: validação ESTRUTURAL oficial (IT 2024.001 — prefixo = CST),
    // sem select obsoleto (tabela atualizada por IT no Portal NF-e).
    const gIbs = item.imposto?.ibscbs;
    if (!gIbs || !gIbs.cst || !gIbs.cClassTrib || gIbs.habilitado === false) {
      erros.push(`Item ${n}: IBS/CBS não informado (grupo <IBSCBS> obrigatório — cStat 1115). Habilite IBS/CBS na Configuração fiscal`);
    } else {
      if (window.NFTaxTables?.validarCClassTrib) {
        const cc = window.NFTaxTables.validarCClassTrib(gIbs.cst, gIbs.cClassTrib);
        if (!cc.ok) erros.push(`Item ${n}: ${cc.erro}`);
      }
      // indDoacao (Fase C, TTribNFe): só aceita 1
      if (gIbs.indDoacao != null && String(gIbs.indDoacao).trim() !== '' && String(gIbs.indDoacao) !== '1') {
        erros.push(`Item ${n}: indDoacao inválido (somente 1=operação de doação)`);
      }
      // ALC/ZFM (Fase C, TALCZFMCBS_NFe): tp 1|2, processo 8–12, ref. numéricos
      const alc = gIbs.alcZfm;
      if (alc) {
        if (!['1', '2'].includes(String(alc.tp))) erros.push(`Item ${n}: gALCZFMCBS.tp inválido (1|2)`);
        if (alc.nProcSuframa != null && String(alc.nProcSuframa).trim() !== '' && !/^[A-Za-z0-9]{8,12}$/.test(String(alc.nProcSuframa).trim())) {
          erros.push(`Item ${n}: gALCZFMCBS.nProcSuframa deve ter 8–12 caracteres`);
        }
      }
      const cstIbs = String(gIbs.cst || gIbs.CST || '');
      const hasMono = !!(gIbs.mono && (gIbs.mono.ibs || gIbs.mono.cbs));
      if (hasMono && cstIbs !== '620') erros.push(`Item ${n}: monofásico (gIBSCBSMono) exige CST 620`);
      if (!hasMono && cstIbs === '620') erros.push(`Item ${n}: CST 620 exige grupo monofásico (mono.ibs/mono.cbs)`);
      if (hasMono) {
        for (const lado of ['ibs', 'cbs']) {
          const m = gIbs.mono[lado];
          if (!m) continue;
          if (!['adRem', 'adValorem'].includes(m.regime)) erros.push(`Item ${n}: mono.${lado}.regime deve ser adRem ou adValorem`);
          if (![m.padrao, m.reten, m.ret, m.bio].some(Boolean)) erros.push(`Item ${n}: mono.${lado} sem blocos (padrao/reten/ret/bio)`);
        }
      }
      const baseAlt = !!(gIbs.transfCred || gIbs.ajusteCompet);
      if ((gIbs.tribRegular || gIbs.tribCompraGov) && (baseAlt || hasMono)) {
        erros.push(`Item ${n}: gTribRegular/gTribCompraGov só com base gIBSCBS (não com CST 620/800/811)`);
      }
      const tr = gIbs.tribRegular;
      if (tr) {
        for (const k of ['cstReg', 'cClassTribReg', 'pAliqEfetRegIBSUF', 'vTribRegIBSUF', 'pAliqEfetRegIBSMun', 'vTribRegIBSMun', 'pAliqEfetRegCBS', 'vTribRegCBS']) {
          if (tr[k] == null || String(tr[k]).trim() === '') erros.push(`Item ${n}: gTribRegular.${k} obrigatório`);
        }
      }
      const tg = gIbs.tribCompraGov;
      if (tg) {
        for (const k of ['pAliqIBSUF', 'vTribIBSUF', 'pAliqIBSMun', 'vTribIBSMun', 'pAliqCBS', 'vTribCBS']) {
          if (tg[k] == null || String(tg[k]).trim() === '') erros.push(`Item ${n}: gTribCompraGov.${k} obrigatório`);
        }
      }
    } // fim else (ibscbs presente)
    return erros.length ? fail(erros) : ok();
  }

  // ─── Validar totais ────────────────────────────────────────────────────────
  function validarTotais(total, itens) {
    const erros = [];
    if (!total) { erros.push('Totais da NF-e não calculados'); return fail(erros); }
    // Validar se vNF bate com soma dos itens
    const somaItens = itens.reduce((acc, it) => acc + (parseFloat(it.vProd) || 0), 0);
    const vNF = parseFloat(total.vNF) || 0;
    const vDesc = parseFloat(total.vDesc) || 0;
    const vFrete = parseFloat(total.vFrete) || 0;
    const vIPI = parseFloat(total.vIPI) || 0;
    const esperado = somaItens + vIPI - vDesc + vFrete;
    if (Math.abs(esperado - vNF) > 0.02) {
      erros.push(`Total da NF (${vNF.toFixed(2)}) diverge do esperado (${esperado.toFixed(2)})`);
    }
    return erros.length ? fail(erros) : ok();
  }

  // ─── Validar transporte/volumes ───────────────────────────────────────────
  function validarTransporte(transp) {
    const erros = [];
    const t = transp || {};
    const modFrete = parseInt(t.modFrete ?? 9);
    if (![0, 1, 2, 3, 4, 9].includes(modFrete)) erros.push('Modalidade do frete inválida');
    if (modFrete === 9) return erros.length ? fail(erros) : ok();

    const transporta = t.transporta || {};
    const cnpj = String(transporta.CNPJ || transporta.cnpj || '').replace(/\D/g, '');
    const cpf = String(transporta.CPF || transporta.cpf || '').replace(/\D/g, '');
    if (cnpj && !validarCNPJ(cnpj)) erros.push('CNPJ do transportador inválido');
    if (!cnpj && cpf && !validarCPF(cpf)) erros.push('CPF do transportador inválido');
    const ufTransporta = String(transporta.UF || transporta.uf || '').trim();
    if (ufTransporta && !/^[A-Z]{2}$/.test(ufTransporta)) erros.push('UF do transportador inválida');

    const veic = t.veicTransp || {};
    const temVeiculo = ['placa', 'UF', 'uf', 'RNTC', 'rntc', 'antt'].some((k) => String(veic[k] || '').trim());
    if (temVeiculo) {
      if (!validarPlaca(veic.placa)) erros.push('Placa do veículo inválida');
      const ufPlaca = String(veic.UF || veic.uf || '').trim();
      if (!/^[A-Z]{2}$/.test(ufPlaca)) erros.push('UF da placa do veículo inválida');
      const rntc = String(veic.RNTC || veic.rntc || veic.antt || '').trim();
      if (rntc.length > 20) erros.push('ANTT/RNTC deve ter no máximo 20 caracteres');
    }

    const vols = Array.isArray(t.vol) ? t.vol : (t.vol ? [t.vol] : []);
    vols.forEach((vol, idx) => {
      const n = idx + 1;
      // qVol é inteiro no leiaute (nº de volumes, pattern [0-9]{1,15}); decimal
      // (ex. "0,010" m³) pertence ao item (qCom) — recusar com mensagem, nunca strip.
      const qVolRaw = String(vol.qVol ?? '').trim();
      if (qVolRaw && !/^[0-9]{1,15}$/.test(qVolRaw)) erros.push(`Volume ${n}: quantidade deve ser número inteiro (nº de volumes); quantidade em m³ vai no item`);
      else if (qVolRaw && parseInt(qVolRaw, 10) <= 0) erros.push(`Volume ${n}: quantidade deve ser maior que zero`);
      const pesoBInformado = vol.pesoB !== '' && vol.pesoB != null;
      const pesoLInformado = vol.pesoL !== '' && vol.pesoL != null;
      const pesoB = parseNumeroFiscal(vol.pesoB);
      const pesoL = parseNumeroFiscal(vol.pesoL);
      if (pesoBInformado && pesoB < 0) erros.push(`Volume ${n}: peso bruto não pode ser negativo`);
      if (pesoLInformado && pesoL < 0) erros.push(`Volume ${n}: peso líquido não pode ser negativo`);
      if (pesoBInformado && pesoLInformado && pesoB < pesoL) erros.push(`Volume ${n}: peso bruto não pode ser menor que o peso líquido`);
      const lacres = Array.isArray(vol.lacres) ? vol.lacres : [];
      lacres.forEach((lac, lacIdx) => {
        const valor = String(lac || '').trim();
        if (!valor) return;
        if (valor.length > 60) erros.push(`Volume ${n}: lacre ${lacIdx + 1} deve ter no máximo 60 caracteres`);
      });
    });

    return erros.length ? fail(erros) : ok();
  }

  // ─── Validar identificação (ide) ───────────────────────────────────────────
  function validarIde(ide) {
    const erros = [];
    if (!ide) { erros.push('Dados de identificação não informados'); return fail(erros); }
    if (!ide.nNF || parseInt(ide.nNF) <= 0) erros.push('Número da NF-e inválido');
    if (!ide.serie) erros.push('Série da NF-e obrigatória');
    if (!ide.dhEmi) erros.push('Data/hora de emissão obrigatória');
    if (![55, 65].includes(parseInt(ide.mod))) erros.push('Modelo inválido (deve ser 55 ou 65)');
    if (![0, 1].includes(parseInt(ide.tpNF)))  erros.push('Tipo de operação inválido (0=Entrada, 1=Saída)');
    if (![1, 2].includes(parseInt(ide.tpAmb))) erros.push('Ambiente inválido (1=Produção, 2=Homologação)');
    // dhSaiEnt (Fase C, opcional): se informada, deve ser data válida
    if (ide.dhSaiEnt != null && String(ide.dhSaiEnt).trim() !== '' && Number.isNaN(new Date(ide.dhSaiEnt).getTime())) {
      erros.push('Data de saída/entrada (dhSaiEnt) inválida');
    }
    // finNFe (finalidade) e indPres (presença) — MOC Tabelas (telas referência)
    if (ide.finNFe != null && String(ide.finNFe).trim() !== '' && !['1', '2', '3', '4'].includes(String(ide.finNFe))) {
      erros.push('Finalidade da NF-e inválida (1=Normal, 2=Complementar, 3=Ajuste, 4=Devolução)');
    }
    if (ide.indPres != null && String(ide.indPres).trim() !== '' && !['0', '1', '2', '3', '4', '5', '9'].includes(String(ide.indPres))) {
      erros.push('Indicador de presença inválido (0–5, 9)');
    }
    if (!validarCodigoMunicipio(ide.cMunFG)) erros.push('Código IBGE do município de ocorrência obrigatório/inválido');
    // Compras governamentais (ide > gCompraGov, TCompraGov — regras da doc do schema oficial)
    const cg = ide.compraGov;
    if (cg) {
      if (!['1', '2', '3', '4', '5', '6'].includes(String(cg.tpEnteGov))) erros.push('ide.compraGov.tpEnteGov inválido (1=União, 2=Estados, 3=DF, 4=Municípios, 5=Consórcio, 6=Comitê Gestor IBS)');
      if (!['1', '2', '3', '4'].includes(String(cg.tpOperGov))) erros.push('ide.compraGov.tpOperGov inválido (1-4)');
      if (cg.pRedutor == null || String(cg.pRedutor).trim() === '' || !(Number(cg.pRedutor) >= 0)) erros.push('ide.compraGov.pRedutor obrigatório (>= 0)');
      const refs = Array.isArray(cg.refDFeAnt) ? cg.refDFeAnt : (cg.refDFeAnt ? [cg.refDFeAnt] : []);
      const tpOp = String(cg.tpOperGov);
      if (tpOp === '2' && refs.length !== 1) erros.push('ide.compraGov: tpOperGov 2 exige exatamente 1 refDFeAnt');
      if (tpOp === '3' && refs.length < 1) erros.push('ide.compraGov: tpOperGov 3 exige ao menos 1 refDFeAnt');
      if ((tpOp === '1' || tpOp === '4') && refs.length > 0) erros.push('ide.compraGov: tpOperGov 1 e 4 vedam refDFeAnt');
      refs.forEach((r) => {
        if (!/^[0-9]{44}$/.test(String(r).replace(/\D/g, ''))) erros.push('ide.compraGov.refDFeAnt deve ter 44 dígitos');
      });
    }
    return erros.length ? fail(erros) : ok();
  }

  // ─── Validação completa de NF-e ────────────────────────────────────────────
  function validarNFe(nfe) {
    if (!nfe || typeof nfe !== 'object') return fail('Objeto NF-e não fornecido');
    const ideResult  = validarIde(nfe.ide);
    const emitResult = validarEmitente(nfe.emit);
    const destResult = validarDestinatario(nfe.dest);
    // Gate CRT × código por item: o CRT é do emitente (nfe.emit.crt)
    const crtEmit = nfe.emit?.crt ?? null;
    const itensResult = (nfe.det || []).length > 0
      ? merge(...(nfe.det || []).map((item, i) => validarItem(crtEmit != null ? { ...item, _crt: crtEmit } : item, i)))
      : fail('Nenhum item adicionado à NF-e');
    const totalResult = validarTotais(nfe.total?.ICMSTot || nfe.total, nfe.det || []);
    const transpResult = validarTransporte(nfe.transp);
    return merge(ideResult, emitResult, destResult, itensResult, totalResult, transpResult);
  }

  // ─── Validar configuração antes de emitir ─────────────────────────────────
  function validarConfigParaEmissao(config) {
    const erros = [];
    if (!config) { erros.push('Configuração fiscal não carregada'); return fail(erros); }
    const emp = config.empresa || {};
    if (!emp.cnpj || !validarCNPJ(emp.cnpj)) erros.push('CNPJ da empresa não configurado/inválido');
    if (!emp.razaoSocial) erros.push('Razão Social não configurada');
    if (!emp.endereco?.uf) erros.push('UF da empresa não configurada');
    if (!validarCodigoMunicipio(emp.endereco?.codigoMunicipio)) erros.push('Código IBGE do município da empresa não configurado/inválido');
    // Verificar certificado
    const cert = config.certificado || {};
    if (!cert.tipo) erros.push('Certificado digital não configurado. Acesse Configuração > Certificado Digital');
    return erros.length ? fail(erros) : ok();
  }

  // ─── API pública ──────────────────────────────────────────────────────────
  return {
    validarCNPJ,
    validarCPF,
    validarNCM,
    validarCFOP,
    validarCEP,
    validarCodigoMunicipio,
    validarPlaca,
    validarChaveNFe,
    validarEmitente,
    validarDestinatario,
    validarItem,
    validarTotais,
    validarTransporte,
    validarIde,
    validarNFe,
    validarConfigParaEmissao,
  };
})();

window.NFValidator = NFValidator;
