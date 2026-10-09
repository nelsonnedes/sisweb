import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Onda 1 UX-feedback: R-21/R-22 (tora), A-01..A-07 (almoxarifado), E-01 (baixa toras).
// Onda 2: F-11/F-12 (eventos SEFAZ), H-31..H-34 (folha), R-23/R-25 (pré-romaneio).
// Trava: todo save/baixa/estorno/evento crítico precisa de lock in-flight + botão com
// estado de loading + restauração garantida nas saídas de erro.
const tora = readFileSync('romaneiotora_modais.js', 'utf8');
const alm = readFileSync('estoque_produtos.js', 'utf8');
const est = readFileSync('estoque.js', 'utf8');
const nfHtml = readFileSync('notas-fiscais.html', 'utf8');
const folhaLanc = readFileSync('folha_pagamento/folha-lancamentos.js', 'utf8');
const folhaFunc = readFileSync('folha_pagamento/folha-funcionarios.js', 'utf8');
const folhaCargos = readFileSync('folha_pagamento/folha-cargos.js', 'utf8');
const pre = readFileSync('preromaneio.js', 'utf8');
const preModals = readFileSync('preromaneio-modals.js', 'utf8');
const admin = readFileSync('scripts/admin/admin-main.js', 'utf8');
const menu = readFileSync('menu-component.js', 'utf8');
const comumCss = readFileSync('layout-comum.css', 'utf8');
const vendasHtml = readFileSync('vendas.html', 'utf8');
const estoqueHtml = readFileSync('estoque.html', 'utf8');
const compras = readFileSync('compras.js', 'utf8');
const nfJs = readFileSync('notas-fiscais.js', 'utf8');
const nfNat = readFileSync('nf-naturezas.js', 'utf8');
const folhaRel = readFileSync('folha_pagamento/folha-relatorios.js', 'utf8');

function fnBody(src, sig) {
  const s = src.indexOf(sig);
  assert.ok(s >= 0, `função não achada: ${sig}`);
  // Avança até o fim da lista de parâmetros (suporta destructuring) e pega o `{` do corpo.
  let depth = 0;
  let k = src.indexOf('(', s); // abre-parênteses da assinatura
  for (; k < src.length; k++) {
    if (src[k] === '(') depth++;
    else if (src[k] === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  const j = src.indexOf('{', k);
  depth = 0;
  let m = j;
  for (; m < src.length; m++) {
    if (src[m] === '{') depth++;
    else if (src[m] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(j, m + 1);
}

test('R-21/R-22: helper de trava existe no módulo tora', () => {
  assert.match(tora, /__toraSaveSpeciesInFlight = false/);
  assert.match(tora, /__toraSaveClientInFlight = false/);
  assert.match(tora, /function __toraNotify\(msg, type\)/);
  assert.match(tora, /function __toraSetSaveBtn\(btn, busy, busyText\)/);
});

test('R-22 saveSpecies: trava na entrada + restore nas duas saídas + toast', () => {
  const b = fnBody(tora, 'async function saveSpecies()');
  assert.match(b, /if \(__toraSaveSpeciesInFlight\) return false/);
  assert.match(b, /__toraSaveSpeciesInFlight = true/);
  assert.match(b, /getElementById\('saveSpeciesBtn'\)/);
  assert.match(b, /__toraSetSaveBtn\(.*true, 'Salvando\.\.\.'\)/);
  assert.match(b, /__toraNotify\(mensagem, 'success'\)/);
  assert.match(b, /__toraNotify\(`Erro ao salvar espécie/);
  assert.equal((b.match(/__toraSaveSpeciesInFlight = false/g) || []).length, 2);
  assert.doesNotMatch(b, /alert\(mensagem\)/);
});

test('R-21 saveClient: trava na entrada + restore nas duas saídas + toast', () => {
  const b = fnBody(tora, 'async function saveClient()');
  assert.match(b, /if \(__toraSaveClientInFlight\) return false/);
  assert.match(b, /__toraSaveClientInFlight = true/);
  assert.match(b, /getElementById\('saveClientBtn'\)/);
  assert.match(b, /__toraNotify\(mensagem, 'success'\)/);
  assert.match(b, /__toraNotify\(`Erro ao salvar fornecedor/);
  assert.equal((b.match(/__toraSaveClientInFlight = false/g) || []).length, 2);
  assert.doesNotMatch(b, /alert\(mensagem\)/);
  assert.match(tora, /id="saveClientBtn"/);
});

test('A-01..A-07: helper do almoxarifado + 8 locks instalados', () => {
  assert.match(alm, /const __almInFlight = \{\}/);
  assert.match(alm, /function __almBegin\(key, btn, label\)/);
  assert.match(alm, /function __almEnd\(key, op\)/);
  assert.match(alm, /function __almNotify\(msg, type\)/);
  for (const key of ['save-prod', 'entrada-prod', 'edit-prod', 'saida-prod',
    'baixa-prod-modal', 'baixa-prod-inline', 'edit-mov-prod', 'estorno-prod']) {
    assert.ok(alm.includes(`__almBegin('${key}'`), `sem begin: ${key}`);
    assert.ok(alm.includes(`__almEnd('${key}'`), `sem end: ${key}`);
  }
});

test('A-01..A-07: sem alert de sucesso/erro pós-write nos fluxos travados', () => {
  for (const sig of ['async function salvarProdutoAlmoxarifadoPeloFormulario(',
    'async function registrarEntradaProduto(',
    'async function salvarEdicaoModalProdutoAlmoxarifado(',
    'async function registrarSaidaProduto(',
    'async function salvarEdicaoMovimentacaoProduto(',
    'async function estornarMovimentacaoProduto(']) {
    const b = fnBody(alm, sig);
    assert.doesNotMatch(b, /alert\('Produto atualizado/);
    assert.doesNotMatch(b, /alert\('Erro ao (atualizar|registrar|salvar|estornar)/);
    assert.match(b, /__almNotify\(/);
  }
});

test('E-01 registrarSaida: lock + overlay + botão restaurado nos dois fins', () => {
  assert.match(est, /let registrarSaidaEmAndamento = false;/);
  const b = fnBody(est, 'async function registrarSaida(event)');
  assert.match(b, /if \(registrarSaidaEmAndamento\) return/);
  assert.match(b, /registrarSaidaEmAndamento = true/);
  assert.match(b, /showLoading\('Registrando baixa\.\.\.'\)/);
  assert.match(b, /querySelector\('#saidaForm button\[type="submit"\]'\)/);
  assert.match(b, /Registrando\.\.\./);
  assert.match(b, /registrarSaidaEmAndamento = false;\s*\n\s*if \(qtdManuais/);
  assert.match(est, /registrarSaidaEmAndamento = false;\s*\n\s*alert\('Erro ao registrar saída/);
  assert.match(b, /hideLoading\(\)/);
});

test('F-11/F-12: helper de trava dos eventos fiscais existe', () => {
  assert.match(nfHtml, /let __nfEventoInFlight = false;/);
  assert.match(nfHtml, /function __nfEventoBtn\(fnName, busy, busyText/);
  assert.match(nfHtml, /function __nfEventoFim\(btn\)/);
});

test('F-11 CC-e: trava na entrada + restore nas duas saídas + overlay', () => {
  const b = fnBody(nfHtml, 'async function enviarCartaCorrecaoNF()');
  assert.match(b, /if \(__nfEventoInFlight\) return;/);
  assert.match(b, /__nfEventoInFlight = true;/);
  assert.match(b, /__nfEventoBtn\('enviarCartaCorrecaoNF', true, 'Enviando\.\.\.'\)/);
  assert.match(b, /SiswebLoading\.show\('Enviando CC-e à SEFAZ\.\.\.'\)/);
  assert.match(b, /__nfEventoFim\(__cceBtn\)/);
  assert.equal((b.match(/__nfEventoFim\(/g) || []).length, 2);
});

test('F-12 inutilização: trava na entrada + restore nas duas saídas + overlay', () => {
  const b = fnBody(nfHtml, 'async function enviarInutilizacaoNF()');
  assert.match(b, /if \(__nfEventoInFlight\) return;/);
  assert.match(b, /__nfEventoInFlight = true;/);
  assert.match(b, /__nfEventoBtn\('enviarInutilizacaoNF', true, 'Enviando\.\.\.'\)/);
  assert.match(b, /SiswebLoading\.show\('Enviando inutilização à SEFAZ\.\.\.'\)/);
  assert.match(b, /__nfEventoFim\(__inutBtn\)/);
  assert.equal((b.match(/__nfEventoFim\(/g) || []).length, 2);
});

test('H-31..H-34: helper de trava dos lançamentos existe', () => {
  assert.match(folhaLanc, /window\.__folhaLancamentoEmAndamento = new Set\(\)/);
  assert.match(folhaLanc, /function __folhaLancamentoBegin\(key\)/);
  assert.match(folhaLanc, /function __folhaLancamentoEnd\(key\)/);
  assert.match(folhaLanc, /FolhaUtils\.showLoading\(\)/);
});

test('H-31..H-33: baixa/estorno/clone/delete com trava por id', () => {
  for (const [sig, key] of [
    ['window.darBaixaQuinzena = async function', "'baixa:'"],
    ['window.estornarFechamento = async function', "'estorno:'"],
    ['window.clonarFolha = async function', "'clone:'"],
    ['window.deleteFolha = async function', "'delete:'"],
  ]) {
    const b = fnBody(folhaLanc, sig);
    assert.ok(b.includes(`__folhaLancamentoBegin(__flKey)`), `sem begin: ${sig}`);
    assert.ok(b.includes('__folhaLancamentoEnd('), `sem end: ${sig}`);
    assert.ok(b.includes(key), `sem chave ${key}: ${sig}`);
  }
});

test('H-34 fecharMes: overlay mantendo o id-set existente', () => {
  const b = fnBody(folhaLanc, 'window.fecharMes = async function');
  assert.match(b, /__fechandoMesIds\.add\(id\)/);
  assert.match(b, /FolhaUtils\.showLoading\(\)/);
  assert.match(b, /FolhaUtils\.hideLoading\(\)/);
});

test('H-32 deletes com trava (funcionário/cargo)', () => {
  assert.match(folhaFunc, /__folhaDelEmAndamento\.has\(__delFuncKey\)/);
  assert.match(folhaFunc, /__folhaDelEmAndamento\.delete\(__delFuncKey\)/);
  assert.match(folhaCargos, /__folhaDelEmAndamento\.has\(__delCargoKey\)/);
  assert.match(folhaCargos, /FolhaUtils\.showLoading\(\)/);
  assert.match(folhaCargos, /FolhaUtils\.hideLoading\(\)/);
});

test('R-23 salvarPreRomaneio: trava + botão + toast (sem alert pós-write)', () => {
  assert.match(pre, /let __preRomaneioSaving = false;/);
  assert.match(pre, /function __preNotify\(msg, type\)/);
  const b = fnBody(pre, 'async function salvarPreRomaneio()');
  assert.match(b, /if \(__preRomaneioSaving\) return;/);
  assert.match(pre, /getElementById\('btnSalvarPreRomaneio'\)/);
  assert.match(b, /__preNotify\('Pré-Romaneio salvo com sucesso!'(.|\n)*'success'\)/);
  assert.doesNotMatch(b, /alert\('Pré-Romaneio salvo com sucesso!'\)/);
  assert.doesNotMatch(b, /alert\('Erro ao salvar no Firebase/);
  assert.equal((b.match(/__preRomaneioSaving = false/g) || []).length, 3);
});

test('R-25 modais pré: trava nos deletes e no carregamento', () => {
  assert.match(preModals, /window\.__preModalEmAndamento = new Set\(\)/);
  assert.match(preModals, /function __preModalBegin\(key\)/);
  assert.match(preModals, /function __preModalEnd\(key\)/);
  const del = fnBody(preModals, 'async function excluirPreRomaneio(');
  assert.match(del, /__preModalBegin\(__preDelKey\)/);
  assert.ok((del.match(/__preModalEnd\(/g) || []).length >= 3, 'restore nos 3 fins do delete');
  assert.doesNotMatch(del, /alert\('Não foi possível excluir no servidor/);
  assert.doesNotMatch(del, /alert\('Erro ao excluir registro/);
  const cli = fnBody(preModals, 'function deletePreRomaneioClient(');
  assert.match(cli, /__preModalBegin\(__preDelCliKey\)/);
  const load = fnBody(preModals, 'function carregarPreRomaneio(');
  assert.match(load, /__preModalBegin\(__preLoadKey\)/);
});

test('S-51 delete parceiro: trava + botão + restore nos 2 fins', () => {
  const b = fnBody(admin, 'async function submitPartnerDeleteModal()');
  assert.match(b, /if \(window\.__partnerDeleteInFlight\) return;/);
  assert.match(b, /window\.__partnerDeleteInFlight = true;/);
  assert.match(b, /getElementById\("partnerDeleteConfirmBtn"\)/);
  assert.match(b, /Excluindo\.\.\./);
  assert.equal((b.match(/window\.__partnerDeleteInFlight = false/g) || []).length, 2);
});

test('S-51 config parceiro + upload anexos com trava', () => {
  const cfg = fnBody(admin, 'async function savePartnerConfig()');
  assert.match(cfg, /if \(window\.__partnerConfigSaving\) return;/);
  assert.match(cfg, /getElementById\("partnerCommissionSave"\)/);
  assert.equal((cfg.match(/window\.__partnerConfigSaving = false/g) || []).length, 2);
  const up = fnBody(admin, 'function uploadAdminSupportAttachments(');
  assert.match(up, /input\.disabled = true;/);
  assert.match(up, /\} finally \{/);
  assert.match(up, /input\.disabled = false;/);
});

test('S-52 reply suporte: trava + botão com id + restore', () => {
  assert.match(menu, /id="siswebSupportReplySendBtn"/);
  const b = fnBody(menu, 'function __siswebSendSupportTicketReply()');
  assert.match(b, /if \(window\.__supportReplyInFlight\) return;/);
  assert.match(b, /window\.__supportReplyInFlight = true;/);
  assert.match(b, /getElementById\('siswebSupportReplySendBtn'\)/);
  assert.equal((b.match(/window\.__supportReplyInFlight = false/g) || []).length, 2);
});

test('P-41 estoque: excel e impressão com overlay garantido', () => {
  const xls = fnBody(est, 'function exportarRelatorioEstoqueExcel(');
  assert.match(xls, /showLoading\('Gerando Excel\.\.\.'\)/);
  assert.match(xls, /\} finally \{/);
  const prt = fnBody(est, 'function imprimirRelatorioEstoque(');
  assert.match(prt, /showLoading\('Gerando relatório\.\.\.'\)/);
  assert.match(prt, /\} finally \{/);
  // Overlay some ANTES do diálogo de impressão/PDF.
  assert.ok(prt.indexOf('hideLoading()') < prt.indexOf('entregarRelatorioEstoque'), 'hide antes de entregar');
});

test('P-41 compras CSV: toast de início e fim', () => {
  const b = fnBody(compras, 'function exportarRelatorioComprasCSV()');
  assert.match(b, /ToastManager\.info\('Gerando CSV\.\.\.'\)/);
  assert.match(b, /ToastManager\.success\('CSV exportado com sucesso\.'\)/);
});

test('Skeleton tematizado: só tokens --sw-*, sem cor hardcoded', () => {
  assert.match(comumCss, /\.skeleton-box/);
  assert.match(comumCss, /\.skeleton-row/);
  assert.match(comumCss, /@keyframes sisweb-skeleton/);
  assert.match(comumCss, /prefers-reduced-motion/);
  const block = comumCss.slice(comumCss.indexOf('.skeleton-row'));
  assert.match(block, /var\(--sw-surface-2\)/);
  assert.match(block, /var\(--sw-hover\)/);
  assert.match(block, /var\(--sw-border\)/);
  assert.doesNotMatch(block, /#[0-9a-fA-F]{3,6}\b/);
  assert.match(est, /tbody\.innerHTML = getSkeletonRows\(movimentacoesColspan, 5\)/);
});

test('Skeleton estático nos tbodys de boot (limpo pelo render)', () => {
  assert.match(vendasHtml, /<tbody id="produtosTable"><tr class="skeleton-row"/);
  assert.match(estoqueHtml, /<tbody id="estoqueTable"><tr class="skeleton-row"/);
  assert.match(estoqueHtml, /<tbody id="movimentacaoTable"><tr class="skeleton-row"/);
});

test('F-15 morto removido; F-16 submit com trava', () => {
  assert.doesNotMatch(nfJs, /async function salvarRascunho\(\)/);
  assert.match(nfJs, /o fluxo vivo e salvarRascunhoNF em notas-fiscais\.html/);
  const b = fnBody(nfJs, 'async function emitirNotaFiscal()');
  assert.match(b, /if \(__nfEmitindo\) return;/);
  assert.match(b, /__nfEmitindo = true;/);
  assert.match(b, /querySelector\('#nfForm button\[type="submit"\]'\)/);
  assert.match(b, /Emitindo\.\.\./);
  assert.equal((b.match(/__nfEmitindo = false/g) || []).length, 2);
});

test('H-35 recibo: overlay com hide antes da impressão', () => {
  const b = fnBody(folhaRel, 'async gerarReciboIndividualDetalhado(folhaId)');
  assert.match(b, /if \(this\._gerandoReciboLock\)/);
  assert.match(b, /FolhaUtils\.showLoading\(\)/);
  assert.match(b, /FolhaUtils\.hideLoading\(\)/);
  assert.ok(b.indexOf('hideLoading()') < b.indexOf('this.imprimirRelatorio(reciboHTML'), 'hide antes de imprimir');
});

test('H-35 imprimirRelatorio global: trava + overlay + finally', () => {
  const b = fnBody(folhaRel, 'window.imprimirRelatorio = async function');
  assert.match(b, /__folhaLancamentoEmAndamento\.has\(__relKey\)/);
  assert.match(b, /FolhaUtils\.showLoading\(\)/);
  assert.match(b, /\} finally \{/);
  assert.match(b, /FolhaUtils\.hideLoading\(\)/);
});

test('H-31b baixa de quinzena exige confirmação explícita', () => {
  assert.match(folhaLanc, /Confirma dar baixa na quinzena/);
  assert.match(folhaLanc, /O pagamento será registrado no financeiro/);
});

test('F-13 naturezas: modal com trava + botão; delete com trava por id', () => {
  const b = fnBody(nfNat, 'async function _salvarDoModal()');
  assert.match(b, /if \(window\.__nfNatSaving\) return;/);
  assert.match(b, /getElementById\('natOpSalvar'\)/);
  assert.match(b, /window\.__nfNatSaving = true;/);
  assert.equal((b.match(/window\.__nfNatSaving = false/g) || []).length, 2);
  assert.match(nfHtml, /__nfNatDeleting\.has\(__nfRemKey\)/);
  assert.match(nfHtml, /__nfNatDeleting\.delete\(__nfRemKey\)/);
});

test('F-14 token manual com trava sem leak; manifesto é sync-local', () => {
  const b = fnBody(nfHtml, 'function salvarTokenManual()');
  assert.match(b, /if \(window\.__nfTokenSaving\) return;/);
  assert.ok((b.match(/window\.__nfTokenSaving = false/g) || []).length >= 3, 'reset em todos os fins');
});

test('R-24 delete tora: overlay com hide no finally', () => {
  const b = fnBody(tora, 'async function excluirRomaneio(');
  assert.match(b, /window\.deletingRomaneio = true;/);
  assert.match(b, /SiswebLoading\.show\('Excluindo romaneio\.\.\.'\)/);
  assert.match(b, /\} finally \{/);
  assert.match(b, /SiswebLoading\.hide\(\)/);
});

test('R-26 export excel tora: trava + overlay + toast (sem alert)', () => {
  const b = fnBody(tora, 'function exportarRomaneioExcelFirebase(');
  assert.match(b, /if \(window\.__toraExportInFlight\) return;/);
  assert.match(b, /SiswebLoading\.show\('Gerando Excel\.\.\.'\)/);
  assert.match(b, /__toraNotify\('Excel gerado com sucesso\.', 'success'\)/);
  assert.match(b, /__toraNotify\('Erro ao exportar romaneio para Excel/);
  assert.doesNotMatch(b, /alert\('Erro ao exportar romaneio para Excel/);
  assert.equal((b.match(/window\.__toraExportInFlight = false/g) || []).length, 2);
});
