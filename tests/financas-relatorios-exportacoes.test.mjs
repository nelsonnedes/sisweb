import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../financas.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../financas.html', import.meta.url), 'utf8');
const sharedPrintSource = readFileSync(new URL('../commerce-pdf-share.js', import.meta.url), 'utf8');

function loadFunction(startName, nextName) {
  const start = source.indexOf(`function ${startName}`);
  const nextFunctionStart = source.indexOf(`function ${nextName}`, start);
  const end = source.slice(Math.max(0, nextFunctionStart - 6), nextFunctionStart) === 'async '
    ? nextFunctionStart - 6
    : nextFunctionStart;
  assert.ok(start >= 0 && end > start, `função ${startName} não localizada`);
  const context = {};
  vm.runInNewContext(source.slice(start, end), context);
  return context[startName];
}

function loadFinanceCompanyApi() {
  const start = source.indexOf('function clearFinanceReportCompanyCache()');
  const end = source.indexOf('const defaultPrintColumns', start);
  assert.ok(start >= 0 && end > start, 'bloco de perfil empresarial do Financeiro não localizado');
  const calls = [];
  const context = {
    window: {
      firebaseService: {
        getCompanyProfileForReport: async (options) => {
          calls.push(options);
          return {
            success: true,
            companyId: options.companyId,
            data: {
              companyId: options.companyId,
              nome: `Empresa ${options.companyId}`,
              cnpj: '12345678000190',
              logoStoragePath: `companies/${options.companyId}/profile/logo/current`,
            },
          };
        },
      },
      SiswebCommercePdf: {
        resolveCompanyLogoDataUrl: async () => 'data:image/png;base64,aGVhZGVy',
        buildPrintHeader: () => '<header></header>',
        preparePrintOptions: async (options) => options,
        printHtmlDocument: () => {},
        exportTableReportPdf: async () => ({ mode: 'download', fileName: 'relatorio.pdf' }),
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(`
    let financeReportCompanyCache = null;
    let financeSessionTenant = 'tenant-a';
    ${source.slice(start, end)}
    this.financeCompanyApi = {
      getFinanceReportCompanyProfile,
      prepareFinanceReportCompany,
      clearFinanceReportCompanyCache,
      setTenant(value) { financeSessionTenant = value; }
    };
  `, context, { filename: 'financas-company-profile.vm.js' });
  return { api: context.financeCompanyApi, calls, windowMock: context.window };
}

test('renderização de relatório codifica conteúdo dinâmico por contexto HTML', () => {
  const escapeFinanceHtml = loadFunction('escapeFinanceHtml', 'getFinanceInlineStringArgument');
  assert.equal(
    escapeFinanceHtml(`<img src=x onerror="alert('x')">`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;',
  );
  assert.match(source, /renderFinanceReportModel\(model\)[\s\S]*escapeFinanceHtml/);
  assert.match(source, /contentElement\.innerHTML = `\$\{header\}\$\{renderFinanceReportModel\(model\)\}`/);
  assert.match(source, /function imprimirTabela\(tipo\)[\s\S]*escapeFinanceHtml\(conta\.descricao \|\| '-'\)/);
  assert.match(source, /imprimirHistoricoConta[\s\S]*escapeFinanceHtml\(conta\.observacoesPagamento/);
  assert.match(source, /function getSafeFinanceImageUrl/);
  assert.match(source, /function getSafeFinanceDownloadUrl/);
  assert.match(source, /getSafeFinanceDownloadUrl\(pagamento\.comprovanteUrl\)/);
  assert.match(source, /\^data:image\\\/\(\?:png\|jpeg\|jpg\|gif\|webp\)/);
});

test('tabelas e anexos financeiros neutralizam HTML e argumentos inline', () => {
  assert.match(source, /function getFinanceInlineStringArgument\(value\)/);
  assert.match(source, /escapeFinanceHtml\(JSON\.stringify/);
  assert.match(source, /case 'cliente':[\s\S]*?escapeFinanceHtml\(nomeCliente\)/);
  assert.match(source, /case 'fornecedor':[\s\S]*?escapeFinanceHtml\(nomeFornecedor\)/);
  assert.match(source, /case 'descricao':[\s\S]*?escapeFinanceHtml\(conta\.descricao/);
  assert.match(source, /const accountIdAttr = escapeFinanceHtml\(conta\.id\)/);
  assert.match(source, /onclick="openFinanceAttachment\(\$\{urlArg\}\)"/);
  assert.match(source, /getSafeFinanceDownloadUrl\(getContaPrimaryAttachmentUrl\(conta\)\)/);
  assert.doesNotMatch(source, /attachmentJs|comprovanteUrlJs|urlJs/);
  assert.doesNotMatch(source, /onclick="(?:editarConta|excluirConta|abrirModalPagamento)\('\$\{conta\.id\}/);
  assert.match(source, /getSafeFinanceDownloadUrl\(getContaPrimaryAttachmentUrl\(editCtx\.contaOriginal\)\)/);
  assert.match(source, /preview-existing'[\s\S]*openFinanceAttachment\(btn\.dataset\.url\)/);
  assert.doesNotMatch(source, /window\.open\(String\(btn\.dataset\.url\)/);
  assert.match(source, /function replaceFinanceSelectOptions\(select, initialLabel, items\)/);
  assert.match(source, /option\.textContent = String\(item/);
  assert.doesNotMatch(source, /select\.innerHTML = opcaoInicial \+ combined\.map/);
  assert.doesNotMatch(source, /catsRecKeys\.map\(k=>`<option/);
  assert.doesNotMatch(source, /tiposRecKeys\.map\(k=>`<option/);
});

test('formatacao de data invalida nunca devolve payload persistido', () => {
  const start = source.indexOf('function formatDate(dateValue)');
  const end = source.indexOf('// ✅ NORMALIZAÇÃO DE DATAS PARA COMPARAÇÃO', start);
  assert.ok(start >= 0 && end > start);
  const context = {
    parseDateLocalSafe: () => new Date('invalid'),
  };
  vm.runInNewContext(source.slice(start, end), context);
  assert.equal(context.formatDate('<img src=x onerror=alert(1)>'), '-');
});

test('CSV operacional permanece seguro, mas sai da barra de relatórios', () => {
  const sanitizeFinanceCsvCell = loadFunction('sanitizeFinanceCsvCell', 'downloadFinanceCsv');
  for (const value of ['=SUM(A1:A2)', '+cmd', '-10+20', '@IMPORTXML', '  =1+1']) {
    assert.match(sanitizeFinanceCsvCell(value), /^"\s*'/);
  }
  assert.equal(sanitizeFinanceCsvCell('Madeira "A"'), '"Madeira ""A"""');
  assert.doesNotMatch(html, /id="financeReportCsvBtn"/);
  assert.match(source, /type: 'text\/csv;charset=utf-8'/);
  assert.match(source, /URL\.revokeObjectURL\(url\)/);
  assert.match(source, /function exportarTabelaExcel/);
});

test('relatórios declaram origem e oferecem imprimir no lugar de CSV', () => {
  assert.match(html, /id="relContaOrigem"/);
  assert.match(html, /value="receber"[^>]*>Contas a Receber</);
  assert.match(html, /value="pagar"[^>]*>Contas a Pagar</);
  assert.match(html, /id="financeReportPrintBtn"[\s\S]*onclick="imprimirRelatorioAtual\(\)"/);
  assert.match(html, /id="financeReportPrintBtn"[\s\S]*fa-print[\s\S]*Imprimir/);
  assert.match(html, /id="financeReportPdfBtn"/);
});

test('pipeline exige confirmação remota do escopo antes de gerar o modelo', () => {
  assert.match(source, /async function loadFinanceReportMonthsStrict/);
  assert.match(source, /if \(!result \|\| result\.success !== true\) throw new Error/);
  assert.match(source, /await ensureFinanceReportScope\(range\);[\s\S]*buildFinanceReportModel\(range\)/);
  assert.match(source, /\['faturamento', 'pagamentos'\]\.includes\(tipo\)[\s\S]*loadAllFinanceReportPartitionsStrict\(origem\)/);
  assert.match(source, /loadFinanceReportMonthsStrict\(origem, months\)/);
  assert.match(source, /resultElement\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(source, /resultElement\.setAttribute\('aria-busy', 'false'\)/);
});

test('modelos de categorias e pagamentos isolam a origem selecionada', () => {
  const start = source.indexOf('function buildFinanceReportModel');
  const end = source.indexOf('function formatFinanceReportValue', start);
  assert.ok(start >= 0 && end > start, 'builder financeiro não localizado');
  const context = {
    contasReceber: [{
      id: 'r1', cliente: 'Cliente A', categoria: 'Vendas', valor: 100,
      dataVencimento: '2026-07-10', status: 'pendente',
    }],
    contasPagar: [{
      id: 'p1', fornecedor: 'Fornecedor B', categoria: 'Compras', valor: 200,
      dataVencimento: '2026-07-11', status: 'pago', dataPagamento: '2026-07-12',
      historicosPagamento: [{ data: '2026-07-12', metodo: 'Pix', valor: 80 }],
    }],
    FINANCE_REPORT_ORIGIN_LABELS: { receber: 'Contas a Receber', pagar: 'Contas a Pagar' },
    FINANCE_REPORT_TITLES: {
      inadimplencia: 'Inadimplência', faturamento: 'Faturamento', pagamentos: 'Pagamentos',
      categorias: 'Categorias', clientes: 'Clientes', fornecedores: 'Fornecedores',
    },
    isFinanceDateInRange: (value, from, to) => value >= from && value <= to,
    getFinancePartyName: (conta, origem) => origem === 'receber' ? conta.cliente : conta.fornecedor,
    getCategoriaLabel: (value) => value,
    getContaFinanceInfo: (conta) => ({
      statusNorm: String(conta.status || '').toLowerCase(),
      valorOriginal: Number(conta.valor || 0),
      valorPago: 80,
      totalAtualizado: Number(conta.valor || 0),
      valorRestante: Number(conta.valor || 0),
    }),
    parseCurrencyValue: (value) => Number(value || 0),
    resolveFinanceTipoOperacional: () => 'pix',
    getTodayISODateLocal: () => '2026-07-18',
    getTodayStartTimestampLocal: () => new Date('2026-07-18T00:00:00').getTime(),
    normalizeDateISOInput: (value) => value,
    normalizeDateToTimestamp: (value) => new Date(`${value}T00:00:00`).getTime(),
  };
  vm.runInNewContext(source.slice(start, end), context);

  const receber = context.buildFinanceReportModel({
    origem: 'receber', tipo: 'categorias', dataInicio: '2026-07-01', dataFim: '2026-07-31', signature: 'r',
  });
  assert.equal(receber.rows.length, 1);
  assert.equal(receber.rows[0].nome, 'Vendas');
  assert.equal(receber.summaries[0].value, 100);

  const pagar = context.buildFinanceReportModel({
    origem: 'pagar', tipo: 'categorias', dataInicio: '2026-07-01', dataFim: '2026-07-31', signature: 'p',
  });
  assert.equal(pagar.rows.length, 1);
  assert.equal(pagar.rows[0].nome, 'Compras');
  assert.equal(pagar.summaries[0].value, 200);

  const pagamentos = context.buildFinanceReportModel({
    origem: 'pagar', tipo: 'pagamentos', dataInicio: '2026-07-01', dataFim: '2026-07-31', signature: 'pg',
  });
  assert.equal(pagamentos.rows.length, 1);
  assert.equal(pagamentos.rows[0].parte, 'Fornecedor B');
  assert.equal(pagamentos.summaries[0].value, 80);
  assert.match(pagamentos.columns.find((column) => column.key === 'valor').label, /pago/i);
});

test('os tipos adaptativos compartilham o mesmo modelo para tela, impressão e PDF', () => {
  for (const reportType of ['inadimplencia', 'faturamento', 'pagamentos', 'categorias', 'clientes', 'fornecedores']) {
    assert.match(source, new RegExp(`${reportType}:`));
  }
  assert.match(source, /const FINANCE_REPORT_TYPE_OPTIONS = Object\.freeze/);
  assert.match(source, /function syncFinanceReportTypeOptions/);
  assert.match(source, /function imprimirRelatorioAtual/);
  assert.match(source, /exportarPDF\(model\)/);
  assert.match(source, /renderFinanceReportModel\(model\)/);
});

test('financeiro usa perfil central e cabecalho compartilhado em todas as saidas', () => {
  const sharedHelperIndex = html.indexOf('commerce-pdf-share.js');
  const financeRuntimeIndex = html.indexOf('financas.js');

  assert.ok(sharedHelperIndex >= 0, 'commerce-pdf-share.js precisa ser carregado no Financeiro');
  assert.ok(financeRuntimeIndex > sharedHelperIndex, 'o helper compartilhado precisa carregar antes de financas.js');
  assert.match(source, /async function getFinanceReportCompanyProfile/);
  assert.match(source, /getCompanyProfileForReport\(\{ companyId: tenantId \}\)/);
  assert.match(source, /async function prepareFinanceReportCompany/);
  assert.match(source, /SiswebCommercePdf\.buildPrintHeader/);
  assert.match(source, /SiswebCommercePdf\.printHtmlDocument/);
  assert.match(source, /SiswebCommercePdf\.exportTableReportPdf/);
  assert.doesNotMatch(source, /localStorage\.getItem\('companies'\)/);
});

test('impressao financeira selecionada substitui o placeholder e usa A4 adaptavel', () => {
  assert.match(source, /win\.document\.write\([\s\S]*?win\.document\.close\(\);/);
  assert.match(sharedPrintSource, /target\.document\.open\(\);[\s\S]*target\.document\.write\(html\);[\s\S]*target\.document\.close\(\);/);
  assert.match(source, /@page \{ size: A4; margin: 8mm; \}/);
  assert.doesNotMatch(source, /@page \{ size: A4 landscape/);
  assert.match(source, /\.sisweb-print-page \{ max-width: 100%; \}/);
  assert.match(source, /\.sisweb-print-section \{ break-inside: auto; page-break-inside: auto; \}/);
  assert.match(source, /\.finance-print-table \{ width: 100%; table-layout: fixed; \}/);
  assert.match(source, /\.finance-print-nowrap \{ white-space:nowrap; overflow-wrap:normal; word-break:normal; \}/);
  assert.match(source, /pedidoNumero:\s*'finance-print-nowrap finance-print-doc'/);
  assert.match(source, /<td class="\$\{columnClassMap\[k\] \|\| 'finance-print-nowrap'\}">/);
});

test('perfil e logo de relatorio sao invalidados com a sessao financeira', () => {
  assert.match(source, /function clearFinanceReportCompanyCache\(\)/);
  assert.match(source, /function clearFinancePrivateSessionState\(\)[\s\S]*clearFinanceReportCompanyCache\(\)/);
  assert.match(source, /returnedTenant[\s\S]*returnedTenant !== tenantId/);
  assert.match(source, /resolveCompanyLogoDataUrl\(company, \{[\s\S]*timeoutMs: options\.logoTimeoutMs \|\| 10000/);
});

test('resolvedor empresarial usa cache por tenant e rejeita perfil divergente', async () => {
  const { api, calls, windowMock } = loadFinanceCompanyApi();

  const first = await api.getFinanceReportCompanyProfile();
  const second = await api.getFinanceReportCompanyProfile();
  assert.equal(first.companyId, 'tenant-a');
  assert.equal(second.companyId, 'tenant-a');
  assert.equal(calls.length, 1, 'o mesmo tenant deve reutilizar o perfil em memória');

  const prepared = await api.prepareFinanceReportCompany();
  assert.equal(prepared.logoDataUrl, 'data:image/png;base64,aGVhZGVy');

  api.setTenant('tenant-b');
  const third = await api.getFinanceReportCompanyProfile();
  assert.equal(third.companyId, 'tenant-b');
  assert.equal(calls.length, 2, 'a troca de tenant deve carregar outro perfil');

  api.clearFinanceReportCompanyCache();
  windowMock.firebaseService.getCompanyProfileForReport = async () => ({
    success: true,
    companyId: 'tenant-a',
    data: { companyId: 'tenant-a', nome: 'Empresa divergente' },
  });
  await assert.rejects(
    () => api.getFinanceReportCompanyProfile(),
    /divergente do tenant autenticado/,
  );
});

test('previa e PDF reutilizam empresa preparada sem recalcular o dataset', () => {
  assert.match(source, /const company = await prepareFinanceReportCompany\(\);[\s\S]*model\.company = company/);
  assert.match(source, /buildPrintHeader\([\s\S]*renderFinanceReportModel\(model\)/);
  assert.match(source, /exportTableReportPdf\(\{[\s\S]*summaryRows:[\s\S]*columns:[\s\S]*rows:/);
});

test('impressão do relatório abre cedo e substitui o documento temporário', () => {
  const start = source.indexOf('async function imprimirRelatorioAtual()');
  const end = source.indexOf('async function exportarDados', start);
  assert.ok(start >= 0 && end > start, 'fluxo de impressão do relatório não localizado');
  const printFlow = source.slice(start, end);
  assert.ok(printFlow.indexOf("window.open('', '_blank')") < printFlow.indexOf('await getCurrentFinanceReportModel'));
  assert.match(printFlow, /win\.document\.write\([\s\S]*win\.document\.close\(\)/);
  assert.match(printFlow, /preparePrintOptions\([\s\S]*targetWindow: win/);
  assert.match(printFlow, /printHtmlDocument\(prepared\)/);
  assert.match(source, /function buildFinanceReportPrintBody\(model\)[\s\S]*escapeFinanceHtml/);
});

test('alterar filtros invalida resultado e navegar não sobrescreve período escolhido', () => {
  assert.match(source, /\['relContaOrigem', 'tipoRelatorio', 'relDataInicio', 'relDataFim'\][\s\S]*invalidateFinanceReport/);
  assert.match(source, /signature: `\$\{origem\}\|\$\{tipo\}\|\$\{dataInicio\}\|\$\{dataFim\}`/);
  assert.match(source, /if \(campo && !campo\.value\)[\s\S]*campo\.value = primeiroDiaStr/);
  assert.match(source, /if \(campo && !campo\.value\)[\s\S]*campo\.value = ultimoDiaStr/);
});

test('layout de relatórios mantém ações e tabela responsivas', () => {
  assert.match(html, /\.report-criteria-grid\s*\{[\s\S]*grid-template-columns: repeat\(4, minmax\(150px, 1fr\)\)/);
  assert.match(html, /@media \(max-width: 1100px\)[\s\S]*grid-template-columns: repeat\(2, minmax\(180px, 1fr\)\)/);
  assert.match(html, /@media \(max-width: 768px\)[\s\S]*\.report-criteria-grid[\s\S]*grid-template-columns: 1fr/);
  assert.match(html, /\.report-actions\s*\{[\s\S]*display: flex/);
  assert.match(html, /\.finance-report-table-wrap\s*\{[\s\S]*overflow-x: auto/);
  assert.match(html, /@media \(max-width: 768px\)[\s\S]*\.report-actions[\s\S]*grid-template-columns: 1fr 1fr/);
  assert.match(html, /class="report-actions" role="group"[^>]*aria-busy="false"/);
  assert.match(source, /function setFinanceReportBusy/);
  assert.match(source, /window\.__financeReportRequestId !== requestId/);
  assert.match(source, /role="region" aria-label="Dados do relatório" tabindex="0"/);
  assert.match(source, /<caption class="finance-sr-only">/);
});

test('erros de relatório são traduzidos para recuperação orientada ao usuário', () => {
  const getFinanceReportFriendlyError = loadFunction('getFinanceReportFriendlyError', 'gerarRelatorio');
  assert.match(getFinanceReportFriendlyError({ message: 'Permission denied' }), /Entre novamente/);
  assert.match(getFinanceReportFriendlyError({ code: 'unavailable', message: 'offline' }), /Verifique a conexão/);
  assert.doesNotMatch(getFinanceReportFriendlyError(new Error('segredo interno')), /segredo interno/);
});

test('modal financeiro bloqueia corrida de estado e oferece navegação acessível', () => {
  assert.match(html, /id="pagamentoModal"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*aria-labelledby="pagamentoModalTitle"/);
  assert.match(html, /button[^>]*data-payment-modal-close[^>]*aria-label="Fechar"/);
  assert.match(html, /#pagamentoComprovante[\s\S]*width: 100%/);
  assert.match(source, /const paymentAccountId = String\(contaAtualEdicao/);
  assert.match(source, /const paymentType = String\(tipoContaAtual/);
  assert.match(source, /setPaymentModalBusy\(true\)/);
  assert.match(source, /isPaymentModalBusy\(\)[\s\S]*Aguarde a conclusão da operação financeira/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /window\.confirm\('Excluir este pagamento\?/);
});

test('logout, troca de tenant e bfcache removem estado financeiro privado', () => {
  assert.match(source, /function clearFinancePrivateSessionState\(\)[\s\S]*detachFinanceListeners\(\)/);
  assert.match(source, /window\.financeReportMonthsConfirmedReceber = new Set\(\)/);
  assert.match(source, /window\.__financeReportState = null/);
  assert.match(source, /addEventListener\('sisweb:session-state'/);
  assert.match(source, /detail\.authenticated !== true[\s\S]*clearFinancePrivateSessionState\(\)/);
  assert.match(source, /currentTenant !== financeSessionTenant[\s\S]*clearFinancePrivateSessionState\(\)/);
  assert.match(source, /addEventListener\('pagehide', clearFinancePrivateSessionState\)/);
  assert.match(source, /event && event\.persisted[\s\S]*window\.location\.reload\(\)/);
  assert.doesNotMatch(source, /visibilitychange[^\n]*detachFinanceListeners/);
});

test('sanitizacao de preferencias nao grava antes do tenant autoritativo', () => {
  assert.match(source, /savePrintPreferences\(tipo, \{ order, visible \}, \{ persistRemote: false \}\)/);
  assert.match(source, /const shouldPersistRemote = options\.persistRemote !== false && !!financeSessionTenant/);
  assert.doesNotMatch(source, /else if \(window\.firebaseSet && window\.firebaseRef && window\.database\)/);
});

test('tentativa incerta não reutiliza upload em outra conta', () => {
  assert.match(source, /function clearFinancePaymentAttemptState/);
  assert.match(source, /window\.__financePendingStorageReview = pendingReview\.slice\(-10\)/);
  assert.match(source, /clearFinancePaymentAttemptState\(form, \{ uncertain: !!form\.__financePendingPaymentUpload \}\)/);
  assert.match(source, /clearFinancePaymentAttemptState\(form, \{ uncertain: hasUncertainUpload \}\)/);
});

test('criacao manual usa lote autoritativo e compensa anexos rejeitados', () => {
  assert.match(source, /callFinanceCallable\('financeCreateAccounts'/);
  assert.match(source, /__financePendingCreate/);
  assert.match(source, /createFinanceAccountsAuthoritative\('receber'/);
  assert.match(source, /createFinanceAccountsAuthoritative\('pagar'/);
  assert.match(source, /cleanupRejectedFinanceCreateUploads/);
  assert.match(source, /cleanupDeletedFinanceAccountStorage/);
  assert.doesNotMatch(source, /Criação das contas a (?:receber|pagar)/);
});
