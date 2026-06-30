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
      const qVol = String(vol.qVol || '').replace(/\D/g, '');
      if (qVol && parseInt(qVol, 10) <= 0) erros.push(`Volume ${n}: quantidade deve ser maior que zero`);
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
    if (![1, 2].includes(parseInt(ide.tpNF)))  erros.push('Tipo de operação inválido (1=Entrada, 2=Saída)');
    if (![1, 2].includes(parseInt(ide.tpAmb))) erros.push('Ambiente inválido (1=Produção, 2=Homologação)');
    if (!validarCodigoMunicipio(ide.cMunFG)) erros.push('Código IBGE do município de ocorrência obrigatório/inválido');
    return erros.length ? fail(erros) : ok();
  }

  // ─── Validação completa de NF-e ────────────────────────────────────────────
  function validarNFe(nfe) {
    if (!nfe || typeof nfe !== 'object') return fail('Objeto NF-e não fornecido');
    const ideResult  = validarIde(nfe.ide);
    const emitResult = validarEmitente(nfe.emit);
    const destResult = validarDestinatario(nfe.dest);
    const itensResult = (nfe.det || []).length > 0
      ? merge(...(nfe.det || []).map((item, i) => validarItem(item, i)))
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
