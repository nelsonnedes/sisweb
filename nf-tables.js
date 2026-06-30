/**
 * nf-tables.js — Tabelas Fiscais Brasileiras
 * NF-e Mod.55 | Multi-tenant | Sisweb
 */

// ─── CFOP mais utilizados (saída/entrada) ───────────────────────────────────
const CFOP_TABLE = {
  // SAÍDA — Operações Estaduais (5.xxx)
  '5101': 'Venda de produção do estabelecimento',
  '5102': 'Venda de mercadoria adquirida ou recebida de terceiros',
  '5103': 'Venda de produção do estabelecimento, efetuada fora do estabelecimento',
  '5104': 'Venda de mercadoria por conta e ordem de terceiros',
  '5115': 'Venda de mercadoria adquirida para industrialização',
  '5116': 'Venda de produção do estabelecimento originada de encomenda',
  '5120': 'Venda de ativo imobilizado',
  '5150': 'Transferência de produção do estabelecimento',
  '5151': 'Transferência de mercadoria adquirida ou recebida de terceiros',
  '5201': 'Devolução de compra para industrialização',
  '5202': 'Devolução de compra para comercialização',
  '5410': 'Venda de mercadoria sujeita ao regime de substituição tributária',
  '5411': 'Devolução de compra de mercadoria sujeita ao regime de substituição tributária',
  '5501': 'Remessa de produção para industrialização por encomenda',
  '5910': 'Remessa em bonificação, doação ou brinde',
  '5949': 'Outra saída de mercadoria ou prestação de serviço não especificado',

  // SAÍDA — Operações Interestaduais (6.xxx)
  '6101': 'Venda de produção do estabelecimento',
  '6102': 'Venda de mercadoria adquirida ou recebida de terceiros',
  '6107': 'Venda de produção do estabelecimento, destinada a não contribuinte',
  '6108': 'Venda de mercadoria adquirida, destinada a não contribuinte',
  '6120': 'Venda de ativo imobilizado',
  '6201': 'Devolução de compra para industrialização',
  '6202': 'Devolução de compra para comercialização',
  '6410': 'Venda de mercadoria sujeita ao regime de substituição tributária',
  '6502': 'Remessa de sucata ou resíduo',
  '6910': 'Remessa em bonificação, doação ou brinde',
  '6949': 'Outra saída de mercadoria ou prestação de serviço não especificado',

  // ENTRADA (1.xxx/2.xxx)
  '1101': 'Compra para industrialização',
  '1102': 'Compra para comercialização',
  '1116': 'Compra para industrialização originada de encomenda',
  '1120': 'Compra para ativo imobilizado',
  '1201': 'Devolução de venda de produção do estabelecimento',
  '1202': 'Devolução de venda de mercadoria adquirida',
  '1401': 'Compra para industrialização em operação com mercadoria sujeita ao regime de substituição tributária',
  '2101': 'Compra para industrialização (interestadual)',
  '2102': 'Compra para comercialização (interestadual)',
  '2201': 'Devolução de venda de produção (interestadual)',
  '2202': 'Devolução de venda de mercadoria adquirida (interestadual)',
};

// ─── CST ICMS (Regime Normal) ──────────────────────────────────────────────
const CST_ICMS = {
  '00': 'Tributada integralmente',
  '10': 'Tributada e com cobrança do ICMS por substituição tributária',
  '20': 'Com redução de base de cálculo',
  '30': 'Isenta ou não tributada e com cobrança do ICMS por substituição tributária',
  '40': 'Isenta',
  '41': 'Não tributada',
  '50': 'Suspensão',
  '51': 'Diferimento',
  '60': 'ICMS cobrado anteriormente por substituição tributária',
  '70': 'Com redução de base de cálculo e cobrança do ICMS por substituição tributária',
  '90': 'Outras',
};

// ─── CSOSN (Simples Nacional) ──────────────────────────────────────────────
const CSOSN = {
  '101': 'Tributada pelo Simples Nacional com permissão de crédito',
  '102': 'Tributada pelo Simples Nacional sem permissão de crédito',
  '103': 'Isenção do ICMS no Simples Nacional para faixa de receita bruta',
  '201': 'Tributada pelo Simples Nacional com permissão de crédito e com cobrança do ICMS por substituição tributária',
  '202': 'Tributada pelo Simples Nacional sem permissão de crédito e com cobrança do ICMS por substituição tributária',
  '203': 'Isenção do ICMS no Simples Nacional para faixa de receita bruta e com cobrança do ICMS por substituição tributária',
  '300': 'Imune',
  '400': 'Não tributada pelo Simples Nacional',
  '500': 'ICMS cobrado anteriormente por substituição tributária (substituído) ou por antecipação',
  '900': 'Outros',
};

// ─── CST PIS/COFINS ────────────────────────────────────────────────────────
const CST_PIS_COFINS = {
  '01': 'Operação Tributável com Alíquota Básica',
  '02': 'Operação Tributável com Alíquota Diferenciada',
  '03': 'Operação Tributável com Alíquota por Unidade de Medida de Produto',
  '04': 'Operação Tributável Monofásica – Revenda a Alíquota Zero',
  '05': 'Operação Tributável por Substituição Tributária',
  '06': 'Operação Tributável a Alíquota Zero',
  '07': 'Operação Isenta da Contribuição',
  '08': 'Operação sem Incidência da Contribuição',
  '09': 'Operação com Suspensão da Contribuição',
  '49': 'Outras Operações de Saída',
  '50': 'Operação com Direito a Crédito – Vinculada Exclusivamente a Receita Tributada no Mercado Interno',
  '70': 'Operação de Aquisição sem Direito a Crédito',
  '98': 'Outras Operações de Entrada',
  '99': 'Outras Operações',
};

// ─── UF com código IBGE e SEFAZ ───────────────────────────────────────────
const UF_TABLE = {
  AC: { nome: 'Acre',                 ibge: 12, sefaz: 'SVRS' },
  AL: { nome: 'Alagoas',             ibge: 27, sefaz: 'SVRS' },
  AP: { nome: 'Amapá',               ibge: 16, sefaz: 'SVRS' },
  AM: { nome: 'Amazonas',            ibge: 13, sefaz: 'AM'   },
  BA: { nome: 'Bahia',               ibge: 29, sefaz: 'BA'   },
  CE: { nome: 'Ceará',               ibge: 23, sefaz: 'SVRS' },
  DF: { nome: 'Distrito Federal',    ibge: 53, sefaz: 'SVRS' },
  ES: { nome: 'Espírito Santo',      ibge: 32, sefaz: 'SVRS' },
  GO: { nome: 'Goiás',               ibge: 52, sefaz: 'GO'   },
  MA: { nome: 'Maranhão',            ibge: 21, sefaz: 'SVRS' },
  MT: { nome: 'Mato Grosso',         ibge: 51, sefaz: 'MT'   },
  MS: { nome: 'Mato Grosso do Sul',  ibge: 50, sefaz: 'MS'   },
  MG: { nome: 'Minas Gerais',        ibge: 31, sefaz: 'MG'   },
  PA: { nome: 'Pará',                ibge: 15, sefaz: 'SVRS' },
  PB: { nome: 'Paraíba',             ibge: 25, sefaz: 'SVRS' },
  PR: { nome: 'Paraná',              ibge: 41, sefaz: 'PR'   },
  PE: { nome: 'Pernambuco',          ibge: 26, sefaz: 'PE'   },
  PI: { nome: 'Piauí',               ibge: 22, sefaz: 'SVRS' },
  RJ: { nome: 'Rio de Janeiro',      ibge: 33, sefaz: 'RJ'   },
  RN: { nome: 'Rio Grande do Norte', ibge: 24, sefaz: 'SVRS' },
  RS: { nome: 'Rio Grande do Sul',   ibge: 43, sefaz: 'RS'   },
  RO: { nome: 'Rondônia',            ibge: 11, sefaz: 'SVRS' },
  RR: { nome: 'Roraima',             ibge: 14, sefaz: 'SVRS' },
  SC: { nome: 'Santa Catarina',      ibge: 42, sefaz: 'SVRS' },
  SP: { nome: 'São Paulo',           ibge: 35, sefaz: 'SP'   },
  SE: { nome: 'Sergipe',             ibge: 28, sefaz: 'SVRS' },
  TO: { nome: 'Tocantins',           ibge: 17, sefaz: 'SVRS' },
};

// ─── Alíquotas ICMS interestaduais (por UF destino) ──────────────────────
// Conforme Resolução SF 22/1989 e alterações
const ICMS_INTERESTADUAL = {
  // Destino nas regiões N, NE, CO: alíquota 12% para origem Sul/Sudeste
  AC: 12, AL: 12, AP: 12, AM: 12, BA: 12, CE: 12, DF: 12,
  ES: 12, GO: 12, MA: 12, MT: 12, MS: 12, PA: 12, PB: 12,
  PE: 12, PI: 12, RN: 12, RO: 12, RR: 12, SE: 12, TO: 12,
  // Destino Sul/Sudeste: 7% (de outros estados Sul/Sudeste) ou 12% (de N/NE/CO)
  MG: 12, PR: 12, RJ: 12, RS: 12, SC: 12, SP: 12,
};

// ─── Regime Tributário (CRT) ───────────────────────────────────────────────
const CRT = {
  1: 'Simples Nacional',
  2: 'Simples Nacional – excesso de sublimite de receita bruta',
  3: 'Regime Normal',
};

// ─── Finalidade da NF-e ────────────────────────────────────────────────────
const FINALIDADE_NFE = {
  1: 'NF-e normal',
  2: 'NF-e complementar',
  3: 'NF-e de ajuste',
  4: 'Devolução de mercadoria',
};

// ─── Tipo de Emissão ───────────────────────────────────────────────────────
const TIPO_EMISSAO = {
  1: 'Emissão normal',
  2: 'Contingência FS-IA',
  3: 'Contingência SCAN (desativada)',
  4: 'Contingência DPEC (desativada)',
  5: 'Contingência FS-DA',
  6: 'Contingência SVC-AN',
  7: 'Contingência SVC-RS',
  9: 'Contingência off-line NFC-e',
};

// ─── Modalidade Frete ──────────────────────────────────────────────────────
const MODALIDADE_FRETE = {
  0: 'Contratação do Frete por conta do Remetente (CIF)',
  1: 'Contratação do Frete por conta do Destinatário (FOB)',
  2: 'Contratação do Frete por conta de Terceiros',
  3: 'Transporte Próprio por conta do Remetente',
  4: 'Transporte Próprio por conta do Destinatário',
  9: 'Sem Ocorrência de Transporte',
};

// ─── Forma de Pagamento ────────────────────────────────────────────────────
const FORMA_PAGAMENTO = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '14': 'Duplicata Mercantil',
  '15': 'Boleto Bancário',
  '16': 'Depósito Bancário',
  '17': 'Pagamento Instantâneo (PIX)',
  '18': 'Transferência bancária, Carteira Digital',
  '19': 'Programa de fidelidade, Cashback, Crédito Virtual',
  '90': 'Sem Pagamento',
  '99': 'Outros',
};

// ─── Tipo de Pessoa ────────────────────────────────────────────────────────
const TIPO_PESSOA = {
  PJ: 'Pessoa Jurídica (CNPJ)',
  PF: 'Pessoa Física (CPF)',
  EX: 'Estrangeiro',
};

// ─── Unidades de Medida mais comuns ───────────────────────────────────────
const UNIDADES = [
  'UN', 'PC', 'CX', 'KG', 'G', 'T', 'L', 'ML',
  'M', 'M2', 'M3', 'CM', 'MM', 'PAR', 'DZ', 'CT',
  'SC', 'FD', 'RL', 'AMP', 'VDA', 'PCT', 'JG',
];

// ─── Indicador IE Destinatário ────────────────────────────────────────────
const IND_IE_DEST = {
  1: 'Contribuinte ICMS',
  2: 'Contribuinte isento',
  9: 'Não Contribuinte',
};

// ─── Helper: obter código IBGE da UF ──────────────────────────────────────
function getIBGEByUF(uf) {
  return (UF_TABLE[uf] && UF_TABLE[uf].ibge) || 0;
}

// ─── Helper: obter ambiente SEFAZ por UF ──────────────────────────────────
function getSefazByUF(uf) {
  return (UF_TABLE[uf] && UF_TABLE[uf].sefaz) || 'SVRS';
}

// ─── Helper: CFOP sugerido por operação ───────────────────────────────────
function sugerirCFOP(tipoOperacao, destinatario, regime) {
  // saida estadual não contribuinte
  if (tipoOperacao === 'saida') {
    if (destinatario === 'interestadual_naocontrib') return '6108';
    if (destinatario === 'interestadual')            return '6102';
    return '5102';
  }
  return '1102';
}

// ─── Helper: CRT por regime ────────────────────────────────────────────────
function getCRT(regime) {
  if (regime === 'simplesNacional') return 1;
  if (regime === 'simplесExcesso') return 2;
  return 3; // Lucro Presumido / Lucro Real
}

// ─── Helper: CSOSN padrão por regime ──────────────────────────────────────
function getDefaultCSOSN(regime) {
  if (regime === 'simplesNacional') return '102';
  return null; // usa CST
}

// ─── Helper: CST padrão para Lucro Presumido/Real ─────────────────────────
function getDefaultCST(tributacao) {
  if (tributacao === 'isento') return '40';
  return '00'; // tributação integral
}

// Exportar para uso global
window.NFeTables = {
  CFOP_TABLE,
  CST_ICMS,
  CSOSN,
  CST_PIS_COFINS,
  UF_TABLE,
  ICMS_INTERESTADUAL,
  CRT,
  FINALIDADE_NFE,
  TIPO_EMISSAO,
  MODALIDADE_FRETE,
  FORMA_PAGAMENTO,
  TIPO_PESSOA,
  UNIDADES,
  IND_IE_DEST,
  getIBGEByUF,
  getSefazByUF,
  sugerirCFOP,
  getCRT,
  getDefaultCSOSN,
  getDefaultCST,
};
