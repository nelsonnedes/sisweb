import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function loadFolhaUtils() {
  const code = read('folha_pagamento/folha-utils.js');
  const windowMock = {
    __folhaDebugMode: 'none',
    addEventListener: () => {},
    dispatchEvent: () => {},
    getComputedStyle: () => ({ display: 'none', visibility: 'hidden' }),
  };
  const documentMock = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { insertAdjacentHTML: () => {} },
    documentElement: { style: {} },
  };
  windowMock.document = documentMock;
  const context = {
    window: windowMock,
    document: documentMock,
    localStorage: { getItem: () => null, setItem: () => {} },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {},
    clearTimeout: () => {},
    CustomEvent: function CustomEvent(type, init) { return { type, ...init }; },
  };
  vm.runInNewContext(code, context, { filename: 'folha-utils.js' });
  return context.window.FolhaUtils;
}

function loadFolhaRelatorios(FolhaUtils) {
  const code = `${read('folha_pagamento/folha-relatorios.js')}\nwindow.__FolhaRelatorios = FolhaRelatorios;`;
  const documentMock = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { appendChild: () => {}, insertAdjacentHTML: () => {} },
  };
  const windowMock = {
    FolhaUtils,
    addEventListener: () => {},
    dispatchEvent: () => {},
    folhaSystem: { folhas: [] },
    folhaLancamentos: { lancamentos: [] },
    folhaFuncionarios: { funcionarios: [] },
  };
  windowMock.document = documentMock;
  const context = {
    window: windowMock,
    document: documentMock,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => {},
    clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem: () => {} },
    getData: async () => ({}),
  };
  vm.runInNewContext(code, context, { filename: 'folha-relatorios.js' });
  return Object.create(context.window.__FolhaRelatorios.prototype);
}

const empresa = {
  nome: 'Empresa Teste',
  cnpj: '00.000.000/0001-00',
  endereco: 'Rua Teste',
  cidade: 'Cidade',
  estado: 'UF',
  telefone: '(00) 0000-0000',
};

const funcionario = {
  nome: 'Funcionario Quinzena',
  cpf: '000.000.000-00',
  cargo: 'Operador',
  tipoContrato: 'CLT',
};

const valoresBase = {
  salarioBase: 2000,
  valorQuinzena: 800,
  totalAcrescimos: 0,
  totalDescontos: 0,
  salarioLiquido: 1200,
  horasExtras: 0,
  bonificacoes: 0,
  premioAssiduidade: 0,
  periculosidade: 0,
  adicionalNoturno: 0,
  insalubridade: 0,
  salarioFamilia: 0,
  inss: 0,
  irrf: 0,
  vales: 0,
  outrosDescontos: 0,
  descontoFaltas: 0,
  descontoRepousoRemunerado: 0,
  descontoINSSManual: 0,
  contribuicaoConfederativa: 0,
  contribuicaoSindical: 0,
  descontoIRPJ: 0,
  emprestimoConsignado: 0,
};

test('recibo de quinzena aberta paga a quinzena e nao abate como desconto', async () => {
  const FolhaUtils = loadFolhaUtils();
  const relatorios = loadFolhaRelatorios(FolhaUtils);
  const html = await relatorios.gerarHtmlReciboDetalhado(empresa, funcionario, {
    id: 'folha-qz-aberta',
    tipoPagamento: 'quinzena',
    tipo: 'quinzena',
    status: 'calculada',
    mesAno: '2026-06',
    percentualQuinzena: 50,
    quinzenaValorManual: 800,
    salarioLiquido: 1200,
    funcionario,
  }, valoresBase);

  assert.match(html, /Valor da Quinzena/);
  assert.match(html, /Valor a Receber[\s\S]*R\$ 800,00/);
  assert.doesNotMatch(html, /QUINZENA \(50%\)[\s\S]*Pagamento Antecipado/);
  assert.match(html, /TOTAL DESCONTOS[\s\S]*R\$ 0,00/);
});

test('recibo de quinzena baixada abate quinzena e mostra saldo final a receber', async () => {
  const FolhaUtils = loadFolhaUtils();
  const relatorios = loadFolhaRelatorios(FolhaUtils);
  const html = await relatorios.gerarHtmlReciboDetalhado(empresa, funcionario, {
    id: 'folha-qz-paga',
    tipoPagamento: 'quinzena',
    tipo: 'quinzena',
    status: 'quinzena_paga',
    mesAno: '2026-06',
    percentualQuinzena: 50,
    quinzenaValorManual: 800,
    salarioLiquido: 1200,
    funcionario,
  }, valoresBase);

  assert.match(html, /QUINZENA \(50%\)[\s\S]*Pagamento Antecipado[\s\S]*R\$ 800,00/);
  assert.match(html, /TOTAL DESCONTOS[\s\S]*R\$ 800,00/);
  assert.match(html, /Salário Líquido[\s\S]*R\$ 1200,00/);
  assert.match(html, /Valor a Receber[\s\S]*R\$ 1200,00/);
  assert.doesNotMatch(html, /Valor Pago[\s\S]*R\$ 800,00/);
});

test('recibo mostra INSS uma unica vez mesmo com manual e historico de vales', async () => {
  const FolhaUtils = loadFolhaUtils();
  const relatorios = loadFolhaRelatorios(FolhaUtils);
  const html = await relatorios.gerarHtmlReciboDetalhado(empresa, funcionario, {
    id: 'folha-inss-vales',
    tipoPagamento: 'mes',
    tipo: 'mes',
    status: 'calculada',
    mesAno: '2026-06',
    salarioLiquido: 1650,
    descontoINSSManual: 150,
    funcionario,
    valesDetalhados: [
      { data: '2026-06-05', valor: 100, observacao: 'Adiantamento' },
      { data: '2026-06-12', valor: 250, observacao: 'Vale semanal' },
    ],
  }, {
    ...valoresBase,
    valorQuinzena: 0,
    inss: 150,
    descontoINSSManual: 150,
    vales: 350,
    totalDescontos: 500,
    salarioLiquido: 1500,
  });

  const inssRows = html.match(/<td>INSS<\/td>/g) || [];
  assert.equal(inssRows.length, 1);
  assert.match(html, /<td>INSS<\/td>[\s\S]*Previdência Social[\s\S]*R\$ 150,00/);
  assert.doesNotMatch(html, /Desconto INSS \(Manual\)/);
  assert.match(html, /Vale[\s\S]*Adiantamento[\s\S]*R\$ 100,00/);
  assert.match(html, /Total Vales[\s\S]*R\$ 350,00/);
});

test('clone para proximo mes limpa vales, faltas e residuos de calculo', () => {
  const folhaLancamentos = read('folha_pagamento/folha-lancamentos.js');

  assert.match(folhaLancamentos, /function __limparCamposVariaveisCloneFolha\(clone\)/);
  assert.match(folhaLancamentos, /clone\.faltas = 0/);
  assert.match(folhaLancamentos, /clone\.vales = 0/);
  assert.match(folhaLancamentos, /clone\.valesDetalhados = \[\]/);
  assert.match(folhaLancamentos, /clone\.diasTrabalhados = null/);
  assert.match(folhaLancamentos, /delete clone\.historicoVales/);
  assert.match(folhaLancamentos, /delete clone\.valesHistorico/);
  assert.match(folhaLancamentos, /delete clone\.detalhesVales/);
  assert.match(folhaLancamentos, /zerar\(clone\.calculos, \['faltas', 'vales', 'descontoFaltas'\]\)/);
  assert.match(folhaLancamentos, /const clone = __limparCamposVariaveisCloneFolha\(\{ \.\.\.original, id: null, mesAno: novoMesAno, status: 'rascunho' \}\)/);
});
