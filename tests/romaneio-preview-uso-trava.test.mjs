import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const vendas = fs.readFileSync(new URL('../vendas.js', import.meta.url), 'utf8');
const compras = fs.readFileSync(new URL('../compras.js', import.meta.url), 'utf8');
const vendasHtml = fs.readFileSync(new URL('../vendas.html', import.meta.url), 'utf8');
const comprasHtml = fs.readFileSync(new URL('../compras.html', import.meta.url), 'utf8');

// ---------------------------------------------------------------------------
// Vendas: helpers de vínculo (aditivos, fail-open)
// ---------------------------------------------------------------------------
test('vendas expõe helpers de vínculo do romaneio sem quebrar fluxo antigo', () => {
  assert.match(vendas, /function obterIdEstavelRomaneioVendas\(/);
  assert.match(vendas, /function buscarUsoRomaneioVendas\(/);
  assert.match(vendas, /function construirMapaUsosRomaneioVendas\(/);
  assert.match(vendas, /function mensagemUsoRomaneioVendas\(/);
  assert.match(vendas, /fail-open/);
  // Pedidos cancelados não bloqueiam reuso
  assert.match(vendas, /cancelado/);
});

test('vendas: preview tem exclusão por item e estado desativado com nº do pedido', () => {
  assert.match(vendas, /window\.romaneioPreviewToggleVendas/);
  assert.match(vendas, /window\.romaneioPreviewExcluirVendas/);
  assert.match(vendas, /data-rv-pk/);
  assert.match(vendas, /Usado no pedido Nº/);
  assert.match(vendas, /Excluído — não será carregado/);
  assert.match(vendas, /apenas os selecionados serão carregados/i);
});

test('vendas: carregar itens respeita preview e trava reuso com toast claro', async () => {
  assert.match(vendas, /async function adicionarItensRomaneio\(\)/);
  assert.match(vendas, /romaneioPreviewExcluidos/);
  assert.match(vendas, /resumoFiltrado/);
  assert.match(vendas, /Todos os itens foram excluídos no preview/);
  assert.match(vendas, /mensagemUsoRomaneioVendas\(numeroExibicaoAtual, usoAtual\)/);
  assert.match(vendas, /Romaneio já utilizado/);
  // Itens criados passam a carregar vínculo (aditivo, leitores antigos ignoram)
  assert.match(vendas, /origemId: idEstavelAtual/);
  assert.match(vendas, /romaneioNumero: numeroExibicaoAtual/);
});

test('vendas: dropdown anota reuso sem desabilitar e preview bloqueia botão', () => {
  assert.match(vendas, /USADO Ped\. Nº/);
  assert.match(vendas, /romaneio-load-btn/);
  assert.match(vendas, /btn\.disabled = true/);
  assert.doesNotMatch(vendas, /opt\.disabled = true/);
});

test('vendas: salvamento persiste romaneiosOrigem sem afetar financeiro', () => {
  const block = vendas.slice(
    vendas.indexOf('const pedidoData = {'),
    vendas.indexOf('if (editandoPedidoId) {', vendas.indexOf('const pedidoData = {'))
  );
  assert.match(block, /itensCarrinho/);
  assert.match(vendas, /pedidoData\.romaneiosOrigem = Array\.from\(mapaOrigens\.values\(\)\)/);
  // Vínculo nunca bloqueia salvamento
  assert.match(vendas, /vínculo best-effort: nunca bloqueia salvamento/);
});

// ---------------------------------------------------------------------------
// Compras: espelho do comportamento
// ---------------------------------------------------------------------------
test('compras expõe helpers de vínculo do romaneio sem quebrar fluxo antigo', () => {
  assert.match(compras, /function obterIdEstavelRomaneioCompra\(/);
  assert.match(compras, /function buscarUsoRomaneioCompra\(/);
  assert.match(compras, /function construirMapaUsosRomaneioCompra\(/);
  assert.match(compras, /function mensagemUsoRomaneioCompra\(/);
  assert.match(compras, /function renderizarPreviewRomaneioCompra\(/);
  assert.match(compras, /fail-open/);
});

test('compras: preview real com exclusão por item e desativado com nº pedido', () => {
  assert.match(compras, /window\.romaneioPreviewToggleCompra/);
  assert.match(compras, /window\.romaneioPreviewExcluirCompra/);
  assert.match(compras, /data-rc-idx/);
  assert.match(compras, /Usado no pedido Nº/);
  assert.match(compras, /Excluído — não será carregado/);
  // Preview unificado no CONAMA; TORA legado permanece oculto
  assert.match(compras, /previewToraBox\) previewToraBox\.style\.display = 'none'/);
});

test('compras: carregar itens respeita preview e trava reuso com toast claro', () => {
  assert.match(compras, /romaneioPreviewExcluidosCompra/);
  assert.match(compras, /itensParaCarregar/);
  assert.match(compras, /Todos os itens foram excluídos no preview/);
  assert.match(compras, /mensagemUsoRomaneioCompra\(numeroExibicao, usoPersistente\)/);
  assert.match(compras, /já foi utilizado no pedido de/);
  // Mantém trava de sessão pré-existente
  assert.match(compras, /já foi adicionado ao carrinho/);
  // Vínculo aditivo nos itens
  assert.match(compras, /romaneioNumero: numeroExibicao/);
  assert.match(compras, /romaneioTipo: tipo/);
});

test('compras: salvamento persiste romaneiosOrigem sem afetar financeiro', () => {
  assert.match(compras, /pedido\.romaneiosOrigem = Array\.from\(mapaOrigens\.values\(\)\)/);
  assert.match(compras, /vínculo best-effort: nunca bloqueia salvamento/);
  assert.match(compras, /financeSyncCompra/);
});

test('edicao do proprio pedido nao se autobloqueia (ignora id em edicao)', () => {
  assert.match(vendas, /ignorarId/);
  assert.match(vendas, /String\(p\.id \|\| ''\) === ignorarId/);
  assert.match(compras, /ignorarId/);
  assert.match(compras, /String\(p\.id \|\| ''\) === ignorarId/);
});

// ---------------------------------------------------------------------------
// Agrupamento: fieldset "Agrupar:" + modos (vendas)
// ---------------------------------------------------------------------------
test('vendas: fieldset Agrupar com 2 checkboxes sem quebrar id legado', () => {
  assert.match(vendasHtml, /fieldset id="agruparFieldset"/);
  assert.match(vendasHtml, /Agrupar:/);
  assert.match(vendasHtml, /id="agruparDimensoesCheckbox"/);
  assert.match(vendasHtml, /Espécie Espessura x Largura x Comprimento/);
  assert.match(vendasHtml, /id="agruparEspecieCheckbox"/);
  assert.match(vendasHtml, /Espécie Espessura x Largura/);
  assert.match(comprasHtml, /Espécie Espessura x Largura/);
  assert.doesNotMatch(vendasHtml, /Agrupar por Espécie e Espessura/);
});

test('vendas: modos exclusivos, TORA desabilita dimensões, leitura fail-open', () => {
  assert.match(vendas, /window\.alternarModoAgrupamentoVendas = function \(modo\)/);
  assert.match(vendas, /function atualizarEstadoAgrupamentoVendas\(tipoSelecionado\)/);
  assert.match(vendas, /function lerModoAgrupamentoVendas\(\)/);
  assert.match(vendas, /cbDims\.disabled = true/);
  assert.match(vendas, /vale apenas para romaneios PCT\/TL\/PES/);
});

test('vendas: modo dimensões ancora em brutos com tipo próprio sem colisão', () => {
  assert.match(vendas, /function derivarChaveCategoriaVendas\(item\)/);
  assert.match(vendas, /function chaveGrupoDimensoesVendas\(/);
  assert.match(vendas, /romaneio_dimensoes/);
  assert.match(vendas, /romaneio_dim_/);
  assert.match(vendas, /t !== 'romaneio_dimensoes'/);
});

// ---------------------------------------------------------------------------
// Agrupamento condicional (compras): Resumo só TORA, fieldset só PCT/TL/PES
// ---------------------------------------------------------------------------
test('compras: resumo legado identificado e fieldset oculto por padrão', () => {
  assert.match(comprasHtml, /id="opcaoResumoEspecie"/);
  assert.match(comprasHtml, /id="agruparDimsFieldset"/);
  assert.match(comprasHtml, /hidden/);
  assert.match(comprasHtml, /id="agruparDimensoesCompra"/);
  assert.match(comprasHtml, /id="agruparEspecieEspessuraCompra"/);
  assert.match(comprasHtml, /Carregar apenas o Resumo/);
});

test('compras: visibilidade condicional ANDada com tipo, sem modo fantasma', () => {
  assert.match(compras, /window\.alternarModoAgrupamentoCompra = function \(modo\)/);
  assert.match(compras, /function atualizarVisibilidadeAgrupamentoCompra\(tipo\)/);
  assert.match(compras, /function lerModoAgrupamentoCompra\(\)/);
  assert.match(compras, /fieldset\.hidden = !isSerrado/);
  assert.match(compras, /cbResumo\.checked = false/);
});

test('compras: novos modos agrupam por dims com chaves estáveis', () => {
  assert.match(compras, /function chaveGrupoDimsCompra\(/);
  assert.match(compras, /function chaveGrupoEspecieCompra\(/);
  assert.match(compras, /function normDimCompra\(valor\)/);
  assert.match(compras, /function lerEspessuraCompra\(item\)/);
  assert.match(compras, /modoAgrupa === 'dimensoes'/);
  assert.match(compras, /grupos/);
});

// ---------------------------------------------------------------------------
// Limpar carrinho + peças + preview ao vivo
// ---------------------------------------------------------------------------
test('vendas e compras têm botão Limpar ao lado de Carregar Itens', () => {
  assert.match(vendasHtml, /onclick="limparCarrinhoItens\(\)"/);
  assert.match(vendasHtml, /romaneio-clear-btn/);
  assert.match(comprasHtml, /onclick="limparCarrinhoItens\(\)"/);
  assert.match(comprasHtml, /romaneio-clear-btn/);
  assert.match(vendas, /function limparCarrinhoItens\(\)/);
  assert.match(compras, /window\.limparCarrinhoItens = function\(\)/);
  assert.match(vendas, /Limpar todos os itens do carrinho\? Esta ação não pode ser desfeita/);
  assert.match(compras, /Limpar todos os itens do pedido\? Esta ação não pode ser desfeita/);
});

test('compras PCT/TL/PES exibe peças igual vendas', () => {
  assert.match(compras, /function infoPecasItemCompra\(item, tipo\)/);
  assert.match(compras, /function quantidadePecasItemCompra\(item, tipo\)/);
  assert.match(compras, /Peças/);
  assert.match(compras, /rot\.pecasInfo/);
  assert.match(compras, /nomeItemDims/);
  assert.match(compras, /nomeGrupo/);
});

test('checkboxes atualizam o preview em tempo real', () => {
  assert.match(vendas, /if \(romaneioSelecionado\) __rvRefazerPreviewVendas\(\);/);
  assert.match(vendas, /modoPrevVendas/);
  assert.match(vendas, /será carregado 1 item por grupo/);
  assert.match(compras, /if \(romaneioAtualCompra\) renderizarPreviewRomaneioCompra\(\);/);
  assert.match(compras, /cartaoItemPrev/);
  assert.match(compras, /serão carregados os grupos selecionados/);
});
