import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function loadFolhaUtils(options = {}) {
  const code = read('folha_pagamento/folha-utils.js');
  const listeners = {};
  const getElementById = options.getElementById || (() => null);
  const windowMock = {
    __folhaDebugMode: 'none',
    addEventListener: (event, fn) => { listeners[event] = fn; },
    dispatchEvent: () => {},
    getComputedStyle: () => ({ display: 'none', visibility: 'hidden' }),
    ...(options.window || {}),
  };
  const documentMock = {
    addEventListener: (event, fn) => { listeners[`document:${event}`] = fn; },
    getElementById,
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { insertAdjacentHTML: () => {} },
    documentElement: { style: {} },
    ...(options.document || {}),
  };
  windowMock.document = documentMock;
  const context = {
    window: windowMock,
    document: documentMock,
    localStorage: {
      getItem: (key) => (key === 'company_info' ? JSON.stringify({ cidade: 'São Paulo' }) : null),
      setItem: () => {},
    },
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    setTimeout: () => {},
    clearTimeout: () => {},
    CustomEvent: function CustomEvent(type, init) { return { type, ...init }; },
  };
  vm.runInNewContext(code, context, { filename: 'folha-utils.js' });
  return context.window.FolhaUtils;
}

test('folha funcionario modal separates PIX favorecido from chave and keeps banco available', () => {
  const folhaHtml = read('folha_pagamento/folha.html');
  const folhaFuncionarios = read('folha_pagamento/folha-funcionarios.js');

  assert.match(folhaHtml, /qrcodejs\/1\.0\.0\/qrcode\.min\.js/);
  assert.match(folhaHtml, /id="funcionarioPixFavorecido"/);
  assert.match(folhaHtml, /id="funcionarioPixFavorecidoGroup"/);
  assert.match(folhaHtml, /id="funcionarioPixTipo"/);
  assert.match(folhaHtml, /id="funcionarioPixTipoGroup"/);
  assert.match(folhaHtml, /id="funcionarioPixHelp"/);
  assert.match(folhaHtml, /CPF\/CNPJ somente números; telefone com DDD; e-mail completo; chave aleatória no formato UUID/);
  assert.match(folhaHtml, /id="funcionarioPixTipoHelp"/);
  assert.match(folhaHtml, /evita confundir CPF com telefone/);
  assert.match(folhaHtml, /id="funcionarioBancoPixHelp"/);
  assert.match(folhaHtml, /banco onde a chave está cadastrada/);
  assert.match(folhaHtml, /id="funcionarioBancoGroup"/);
  assert.match(folhaHtml, /id="pixQrCodeModal"/);
  assert.match(folhaHtml, /id="pixQrCodeChave"/);
  assert.match(folhaHtml, /id="pixQrCodeEditFuncionario"/);
  assert.match(folhaHtml, /id="pixQrCodeLiquido"/);

  assert.match(folhaFuncionarios, /favorecidoPix:\s*document\.getElementById\('funcionarioPixFavorecido'\)\.value\.trim\(\)/);
  assert.match(folhaFuncionarios, /pixTipo:\s*\(function\(\)\{/);
  assert.match(folhaFuncionarios, /Chave PIX incompatível com o tipo selecionado\. Confira CPF\/CNPJ, telefone com DDD, e-mail ou chave aleatória/);
  assert.match(folhaFuncionarios, /openEditFuncionarioModal\(funcionarioId, opcoes = \{\}\)/);
  assert.match(folhaFuncionarios, /focusFieldId = String\(opcoes\.focusField \|\| 'funcionarioNome'\)/);
  assert.match(folhaFuncionarios, /funcionario\.favorecidoPix \|\| funcionario\.nomeFavorecidoPix/);
  assert.match(folhaFuncionarios, /bancoGroup\.style\.display = \(mostrarConta \|\| mostrarPix\) \? 'flex' : 'none'/);
  assert.match(folhaFuncionarios, /if \(!mostrarConta && !mostrarPix && bancoField\) bancoField\.value = ''/);
});

test('folha lancamentos render PIX as Ver Qrcode without exposing pix key in button attributes', () => {
  const folhaUtils = read('folha_pagamento/folha-utils.js');
  const folhaMain = read('folha_pagamento/folha-main.js');

  assert.match(folhaUtils, /static formatarFormaPagamentoLancamento\(funcionario, opcoes = \{\}\)/);
  assert.match(folhaUtils, /<span>Ver Qrcode<\/span>/);
  assert.match(folhaUtils, /data-folha-id="\$\{refAttr\}"/);
  assert.doesNotMatch(folhaUtils, /data-pix/);
  assert.match(folhaUtils, /static openPixQrCode\(ref\)/);
  assert.match(folhaUtils, /favorecidoEl\.textContent = `Favorecido:/);
  assert.match(folhaUtils, /bancoEl\.textContent = `Banco:/);
  assert.match(folhaUtils, /chaveEl\.textContent = `Chave Pix:/);
  assert.match(folhaUtils, /editButton\.style\.display = funcionarioId \? 'inline-flex' : 'none'/);
  assert.match(folhaUtils, /static openPixFuncionarioEditFromQrCode\(\)/);
  assert.match(folhaUtils, /openEditFuncionarioModal\(funcionarioId, \{ focusField: 'funcionarioPix' \}\)/);
  assert.match(folhaUtils, /liquidoEl\.textContent = `Valor líquido:/);
  assert.match(folhaUtils, /buildPixBrCode/);
  assert.match(folhaUtils, /text:\s*pixPayload/);
  assert.doesNotMatch(folhaUtils, /text:\s*data\.pix/);
  assert.match(folhaUtils, /new window\.QRCode\(container, options\)/);

  const renderLinha = folhaUtils.slice(
    folhaUtils.indexOf('static renderizarLinhaLancamento'),
    folhaUtils.indexOf('// Função unificada para filtrar lançamentos')
  );
  assert.match(renderLinha, /formatarFormaPagamentoLancamento/);
  assert.doesNotMatch(renderLinha, /formatarFormaPagamentoDetalhada/);
  assert.match(renderLinha, /salarioLiquidoDisplay/);
  assert.match(renderLinha, /liquido:\s*valorPixLancamento/);

  assert.match(folhaMain, /formatarFormaPagamentoLancamento\(funcionarioDetalhado/);
  assert.match(folhaMain, /liquidoFormatado:\s*fmt\(valorPix\)/);
});

test('folha PIX QR payload uses BR Code EMV with valid CRC and liquid value', () => {
  const FolhaUtils = loadFolhaUtils();
  const payload = FolhaUtils.buildPixBrCode({
    pix: '11999999999',
    favorecido: 'Fábio Da Silva',
    liquido: 1234.56,
    ref: 'folha-fabio-2026-04',
    cidade: 'São Paulo',
  });

  assert.match(payload, /^000201/);
  assert.match(payload, /br\.gov\.bcb\.pix/);
  assert.match(payload, /54071234\.56/);
  assert.match(payload, /5914FABIO DA SILVA/);
  assert.match(payload, /6009SAO PAULO/);
  assert.match(payload, /62070503\*\*\*/);
  assert.match(payload, /5802BR/);
  assert.match(payload, /6304[A-F0-9]{4}$/);

  const semCrc = payload.slice(0, -4);
  const crc = payload.slice(-4);
  assert.equal(FolhaUtils.crc16CcittFalse(semCrc), crc);
});

test('folha PIX normalizes CPF, telefone, email and EVP keys for BR Code', () => {
  const FolhaUtils = loadFolhaUtils();

  assert.equal(FolhaUtils.normalizePixKeyForBrCode('529.982.247-25'), '52998224725');
  assert.equal(FolhaUtils.normalizePixKeyForBrCode('(67) 99999-9999'), '+5567999999999');
  assert.equal(FolhaUtils.normalizePixKeyForBrCode('5567999999999'), '+5567999999999');
  assert.equal(FolhaUtils.normalizePixKeyForBrCode('067 99999-9999'), '+5567999999999');
  assert.equal(FolhaUtils.normalizePixKeyForBrCode('11900000083'), '11900000083');
  assert.equal(FolhaUtils.normalizePixKeyForBrCode('11900000083', 'telefone'), '+5511900000083');
  assert.equal(FolhaUtils.normalizePixKeyForBrCode('pessoa.teste@Email.COM '), 'pessoa.teste@email.com');
  assert.equal(
    FolhaUtils.normalizePixKeyForBrCode('123E4567-E12B-12D1-A456-426655440000'),
    '123e4567-e12b-12d1-a456-426655440000'
  );

  const payload = FolhaUtils.buildPixBrCode({
    pix: '(67) 99999-9999',
    favorecido: 'Maria do Socorro Pereira de Sousa',
    liquido: 1072.81,
    ref: 'folha-maria-telefone',
    cidade: 'Campo Grande',
  });

  assert.match(payload, /0114\+5567999999999/);
  assert.match(payload, /54071072\.81/);
  assert.match(payload, /5925MARIA DO SOCORRO PEREIR/);
  assert.match(payload, /6012CAMPO GRANDE/);
  assert.equal(FolhaUtils.crc16CcittFalse(payload.slice(0, -4)), payload.slice(-4));
});

test('folha PIX payload for Fabio uses CPF key, liquid value and static txid compatibility', () => {
  const FolhaUtils = loadFolhaUtils();
  const payload = FolhaUtils.buildPixBrCode({
    pix: '647.044.242-00',
    pixTipo: 'cpf',
    favorecido: 'Fabio Da Silva',
    liquido: 658.41,
    cidade: 'Brasilia',
  });

  assert.match(payload, /011164704424200/);
  assert.match(payload, /5406658\.41/);
  assert.match(payload, /5914FABIO DA SILVA/);
  assert.match(payload, /6008BRASILIA/);
  assert.match(payload, /62070503\*\*\*/);
  assert.equal(FolhaUtils.getPixDisplayKey({ pix: '647.044.242-00', pixTipo: 'cpf' }), '64704424200');
  assert.equal(FolhaUtils.crc16CcittFalse(payload.slice(0, -4)), payload.slice(-4));
});

test('folha PIX QR falls back to funcionario name when PIX favorecido is empty', () => {
  const FolhaUtils = loadFolhaUtils();

  assert.equal(
    FolhaUtils.resolvePixFavorecido({
      nome: 'João Funcionário',
      favorecidoPix: '',
      nomeFavorecidoPix: '',
      beneficiario: 'Beneficiário Legado',
    }),
    'João Funcionário'
  );

  const ref = FolhaUtils.registerPixQrCodeData('folha-joao-pix', {
    pix: '647.044.242-00',
    pixTipo: 'cpf',
    favorecido: '',
    funcionarioNome: 'João Funcionário',
    beneficiario: 'Beneficiário Legado',
    liquido: 658.41,
  });
  const data = FolhaUtils.resolvePixQrCodeData(ref);

  assert.equal(data.favorecido, 'João Funcionário');
  assert.equal(FolhaUtils.resolvePixFavorecido(data, data.funcionarioNome), 'João Funcionário');
});

test('folha PIX QR blocks paid lancamento and keeps modal at zero saldo', () => {
  const elements = {};
  const makeEl = () => ({
    style: {},
    dataset: {},
    textContent: '',
    innerHTML: '',
    addEventListener: () => {},
  });
  [
    'pixQrCodeModal',
    'pixQrCodeContainer',
    'pixQrCodeFallback',
    'pixQrCodeFavorecido',
    'pixQrCodeBanco',
    'pixQrCodeChave',
    'pixQrCodeEditFuncionario',
    'pixQrCodeLiquido',
  ].forEach((id) => { elements[id] = makeEl(); });

  const FolhaUtils = loadFolhaUtils({
    getElementById: (id) => elements[id] || null,
  });
  let buildCalled = false;
  FolhaUtils.buildPixBrCode = () => {
    buildCalled = true;
    return 'payload';
  };

  const ref = FolhaUtils.registerPixQrCodeData('folha-pix-paga', {
    pix: '647.044.242-00',
    pixTipo: 'cpf',
    favorecido: 'Fabio Da Silva',
    funcionarioNome: 'Fabio Da Silva',
    banco: 'Mercado Pago',
    liquido: 0,
    liquidoFormatado: FolhaUtils.formatarMoeda(0),
    valorPago: 1500,
    valorPagoFormatado: FolhaUtils.formatarMoeda(1500),
    pagamentoQuitado: true,
  });

  FolhaUtils.openPixQrCode(ref);

  assert.equal(buildCalled, false);
  assert.match(elements.pixQrCodeLiquido.textContent, /Valor líquido:\s*R\$\s*0,00/);
  assert.match(elements.pixQrCodeFallback.textContent, /Não há saldo PIX em aberto para gerar QR Code/);
  assert.match(elements.pixQrCodeFallback.textContent, /Valor pago:\s*R\$\s*1\.500,00/);
  assert.equal(elements.pixQrCodeFallback.style.display, 'block');
  assert.equal(elements.pixQrCodeModal.style.display, 'block');
});

test('folha PIX row registers paid QR with zero saldo and total valor pago', () => {
  const FolhaUtils = loadFolhaUtils();
  const lancamento = {
    id: 'folha-pix-paga-linha',
    tipoPagamento: 'mes',
    status: 'mes_fechado',
    salarioLiquido: 1000,
    valesDetalhados: [
      { data: '2026-05-10', valor: 200 },
      { data: '2026-05-20', valor: 50 },
    ],
    mesAno: '2026-05',
    funcionario: {
      id: 'func-pix-pago',
      nome: 'Funcionario Pix Pago',
      cargo: 'Operador',
      formaPagamento: 'PIX',
      pix: '647.044.242-00',
      pixTipo: 'cpf',
      banco: 'Mercado Pago',
      salarioBase: 2000,
    },
  };

  const rowHtml = FolhaUtils.renderizarLinhaLancamento(lancamento);
  const data = FolhaUtils.resolvePixQrCodeData('folha-pix-paga-linha');

  assert.match(rowHtml, /Ver Qrcode/);
  assert.equal(data.liquido, 0);
  assert.equal(data.liquidoFormatado, FolhaUtils.formatarMoeda(0));
  assert.equal(data.valorPago, 1250);
  assert.equal(data.valorPagoFormatado, FolhaUtils.formatarMoeda(1250));
  assert.equal(data.pagamentoQuitado, true);
});

test('folha PIX quinzena uses quinzena value before baixa and liquid final after baixa', () => {
  const FolhaUtils = loadFolhaUtils();
  const baseLancamento = {
    id: 'folha-pix-quinzena',
    tipoPagamento: 'quinzena',
    tipo: 'quinzena',
    salarioLiquido: 1200,
    quinzenaValorManual: 800,
    mesAno: '2026-05',
    funcionario: {
      id: 'func-pix-quinzena',
      nome: 'Funcionario Pix Quinzena',
      cargo: 'Operador',
      formaPagamento: 'PIX',
      pix: '647.044.242-00',
      pixTipo: 'cpf',
      banco: 'Mercado Pago',
      salarioBase: 2000,
    },
  };

  FolhaUtils.renderizarLinhaLancamento({
    ...baseLancamento,
    id: 'folha-pix-quinzena-aberta',
    status: 'calculada',
  });
  const aberta = FolhaUtils.resolvePixQrCodeData('folha-pix-quinzena-aberta');
  assert.equal(aberta.liquido, 800);
  assert.equal(aberta.valorPago, 0);
  assert.equal(aberta.pagamentoQuitado, false);

  FolhaUtils.renderizarLinhaLancamento({
    ...baseLancamento,
    id: 'folha-pix-quinzena-paga',
    status: 'quinzena_paga',
  });
  const quinzenaPaga = FolhaUtils.resolvePixQrCodeData('folha-pix-quinzena-paga');
  assert.equal(quinzenaPaga.liquido, 1200);
  assert.equal(quinzenaPaga.valorPago, 800);
  assert.equal(quinzenaPaga.pagamentoQuitado, false);

  FolhaUtils.renderizarLinhaLancamento({
    ...baseLancamento,
    id: 'folha-pix-quinzena-fechada',
    status: 'mes_fechado',
  });
  const fechada = FolhaUtils.resolvePixQrCodeData('folha-pix-quinzena-fechada');
  assert.equal(fechada.liquido, 0);
  assert.equal(fechada.valorPago, 2000);
  assert.equal(fechada.pagamentoQuitado, true);
});

test('folha lancamento snapshot carries PIX metadata from selected funcionario dataset', () => {
  const folhaLancamentos = read('folha_pagamento/folha-lancamentos.js');
  const folhaUtils = read('folha_pagamento/folha-utils.js');

  assert.match(folhaLancamentos, /'formaPagamento', 'pix', 'pixTipo', 'tipoPix', 'tipoChavePix', 'favorecidoPix', 'nomeFavorecidoPix', 'beneficiario', 'banco', 'agencia', 'conta'/);
  assert.match(folhaLancamentos, /pixTipo: \(lancamento\.funcionario && \(lancamento\.funcionario\.pixTipo \|\| lancamento\.funcionario\.tipoPix \|\| lancamento\.funcionario\.tipoChavePix\)\)/);
  assert.match(folhaLancamentos, /favorecidoPix: \(lancamento\.funcionario && \(lancamento\.funcionario\.favorecidoPix \|\| lancamento\.funcionario\.nomeFavorecidoPix\)\)/);
  assert.match(folhaLancamentos, /function __getValorFinanceiroLancamento\(lancamento, kind\)/);
  assert.match(folhaLancamentos, /const valor = __getValorFinanceiroLancamento\(lancamento, kind\)/);
  assert.match(folhaUtils, /funcionarioId: String\(funcionario\.id \|\| opcoes\.funcionarioId \|\| ''\)\.trim\(\)/);
});
