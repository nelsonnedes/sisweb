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
test('vendas: fieldset Agrupar com 3 checkboxes, default E x L', () => {
  assert.match(vendasHtml, /fieldset id="agruparFieldset"/);
  assert.match(vendasHtml, /Agrupar:/);
  assert.match(vendasHtml, /id="agruparDimensoesCheckbox"/);
  assert.match(vendasHtml, /Espécie Espessura x Largura x Comprimento/);
  assert.match(vendasHtml, /id="agruparEspecieCheckbox"/);
  assert.match(vendasHtml, />Espécie Espessura<\/span>/);
  assert.match(vendasHtml, /id="agruparEspecieLarguraCheckbox" checked/);
  assert.match(vendasHtml, />Espécie Espessura x Largura<\/span>/);
  assert.match(comprasHtml, />Espécie Espessura<\/span>/);
  assert.match(comprasHtml, /id="agruparEspecieCompra"/);
  assert.match(comprasHtml, /id="agruparEspecieEspessuraCompra" checked/);
  assert.doesNotMatch(vendasHtml, /Agrupar por Espécie e Espessura/);
});

test('vendas: 3 modos exatos, default obrigatório, sem ramo morto', () => {
  assert.match(vendas, /window\.alternarModoAgrupamentoVendas = function \(modo\)/);
  assert.match(vendas, /function atualizarEstadoAgrupamentoVendas\(tipoSelecionado\)/);
  assert.match(vendas, /function lerModoAgrupamentoVendas\(\)/);
  assert.match(vendas, /cbDims\.disabled = true/);
  assert.match(vendas, /vale apenas para romaneios PCT\/TL\/PES/);
  assert.match(vendas, /Selecione ao menos um modo de agrupamento/);
  assert.match(vendas, /Selecione um modo no quadro "Agrupar:"/);
  assert.match(vendas, /function chaveGrupoEspVendas\(/);
  assert.match(vendas, /function agruparResumoPorEspessuraVendas\(/);
  assert.match(vendas, /function agruparBrutosPorDimensoesVendas\(/);
  assert.match(vendas, /function limparExclusoesPreviewVendas\(\)/);
  assert.match(vendas, /Inalcançável: modo obrigatório/);
});

test('vendas: preview fiel por modo (linhas = unidades de carga)', () => {
  assert.match(vendas, /modoAgrupPreviewVendas/);
  assert.match(vendas, /renderGrupoPrev/);
  assert.match(vendas, /__rvSetAlvoVendas/);
  assert.match(vendas, /será carregado 1 item por grupo/);
  assert.match(vendas, /grupos selecionados/);
});

test('compras: 3 modos + default + obrigatório, sem item-a-item morto', () => {
  assert.match(comprasHtml, /alternarModoAgrupamentoCompra\('largura'\)/);
  assert.match(comprasHtml, /alternarModoAgrupamentoCompra\('especie'\)/);
  assert.match(compras, /function chaveGrupoEspLargCompra\(/);
  assert.match(compras, /Selecione um modo no quadro "Agrupar:"/);
  assert.match(compras, /Selecione ao menos um modo de agrupamento/);
  assert.match(compras, /por espécie\+espessura\+largura/);
  assert.doesNotMatch(compras, /Lógica Item a Item/);
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

test('toolbar do romaneio: selects em cima, botões + agrupar embaixo', () => {
  for (const html of [vendasHtml, comprasHtml]) {
    const idxTipo = html.indexOf('id="tipoRomaneio"');
    const idxToolbar = html.indexOf('romaneio-toolbar-row');
    const idxCarregar = html.indexOf('romaneio-load-btn');
    const idxLimpar = html.indexOf('romaneio-clear-btn');
    assert.ok(idxTipo !== -1 && idxToolbar !== -1 && idxCarregar !== -1 && idxLimpar !== -1);
    assert.ok(idxTipo < idxToolbar, 'selects antes da toolbar');
    assert.ok(idxToolbar < idxCarregar && idxCarregar < idxLimpar, 'carregar antes de limpar');
  }
  assert.match(vendasHtml, /romaneio-group-box/);
  assert.match(comprasHtml, /id="agruparBoxCompra"/);
  assert.match(compras, /agruparBoxCompra/);
});

test('css da toolbar: desktop lado a lado, mobile empilhado full-width', () => {
  const css = fs.readFileSync(new URL('../commerce-responsive.css', import.meta.url), 'utf8');
  assert.match(css, /\.romaneio-toolbar-row \{[\s\S]*?align-items: stretch;/);
  assert.match(css, /\.romaneio-group-box \{[\s\S]*?flex: 1 1 320px;/);
  assert.match(css, /\.romaneio-group-fieldset \{[\s\S]*?display: flex;/);
  assert.match(css, /\.romaneio-clear-btn \{[\s\S]*?width: 100%;/);
  assert.match(css, /\.romaneio-group-fieldset \{[\s\S]*?grid-template-columns: 1fr;/);
  assert.match(css, /#agruparDimensoesCheckbox,/);
  assert.match(css, /#agruparDimensoesCompra,/);
  assert.match(css, /#agruparEspecieEspessuraCompra/);
});

// ---------------------------------------------------------------------------
// Editar+recarregar+salvar preserva a lógica (lista/impressão fiéis)
// ---------------------------------------------------------------------------
test('resets de preview não são recursivos (limpa os 3 sets)', () => {
  assert.match(vendas, /function limparExclusoesPreviewVendas\(\) \{\s*\n\s*romaneioPreviewExcluidos = new Set\(\);/);
  assert.match(vendas, /romaneioPreviewExcluidosEsp = new Set\(\);/);
  assert.match(vendas, /romaneioPreviewExcluidosDims = new Set\(\);/);
  assert.doesNotMatch(vendas, /function limparExclusoesPreviewVendas\(\) \{\s*\n\s*limparExclusoesPreviewVendas\(\);/);
});

test('modo de agrupamento persiste no pedido e restaura na edição', () => {
  assert.match(vendas, /pedidoData\.modoAgrupamentoRomaneio/);
  assert.match(vendas, /modoSalvoVenda/);
  assert.match(compras, /pedido\.modoAgrupamentoRomaneio/);
  assert.match(compras, /modoSalvoCompra/);
});

test('editar agrupado desagrupa e carrega em 1 clique (sem confirm)', () => {
  assert.doesNotMatch(vendas, /Deseja Desagrupar para Edição/);
  assert.doesNotMatch(compras, /Deseja Desagrupar para Edição/);
  assert.match(vendas, /primeiroDesagrupado/);
  assert.match(vendas, /itemEmEdicaoId = String\(primeiroDesagrupado\.id\)/);
  assert.match(compras, /primeiroDesagrupado/);
  assert.match(compras, /itemEmEdicaoIndex = index;/);
  assert.match(vendas, /primeiro carregado para edição/);
  assert.match(compras, /primeiro carregado para edição/);
});

test('editarItem cobre romaneio_dimensoes (formulário nunca fica vazio)', () => {
  assert.match(vendas, /case 'romaneio':\s*\n\s*case 'romaneio_dimensoes':/);
  assert.match(vendas, /tiposConhecidos/);
  assert.match(vendas, /tipoSeguro/);
});

test('quantidades aceitam frações (volumes m³) sem travar submit nativo', () => {
  for (const html of [vendasHtml, comprasHtml]) {
    assert.match(html, /id="quantidadeManual" min="0"/);
    assert.match(html, /id="quantidade" min="0"/);
  }
  assert.doesNotMatch(vendasHtml, /id="quantidadeManual" min="1"/);
  assert.doesNotMatch(comprasHtml, /id="quantidadeManual" min="1"/);
});

test('logo da impressão: memo de falha evita repagar cadeia lenta', () => {
  const helper = fs.readFileSync(new URL('../commerce-pdf-share.js', import.meta.url), 'utf8');
  assert.match(helper, /logoFailMemo/);
  assert.match(helper, /LOGO_FAIL_TTL_MS/);
  assert.match(helper, /logoFalhouRecente\(company\)/);
  assert.match(helper, /marcarLogoFalha\(company\)/);
  assert.match(helper, /quiet/);
  assert.match(helper, /if \(!quiet\) console\.warn/);
  assert.match(vendas, /preparePrintOptions\(\{ company: company \|\| \{\}, quiet: true \}\)/);
  assert.match(compras, /preparePrintOptions\(\{ company: company \|\| \{\}, quiet: true \}\)/);
});

// ---------------------------------------------------------------------------
// Boot honesto: sem falso "entre novamente", fila one-shot, botões travados
// ---------------------------------------------------------------------------
test('vendas: boot state machine + fila one-shot no listar', () => {
  assert.match(vendas, /__siswebVendasBootState = 'booting'/);
  assert.match(vendas, /__siswebVendasBootPromise = inicializarSistema\(\);/);
  assert.match(vendas, /__siswebVendasBootState = 'ready'/);
  assert.match(vendas, /__siswebVendasBootState = 'failed'/);
  assert.match(vendas, /__siswebVendasListarPendente/);
  assert.match(vendas, /Conectando à sua empresa, abrindo a lista em instantes/);
  assert.match(vendasHtml, /onclick="listarPedidos\(\)"[^>]*disabled/);
  assert.match(vendasHtml, /data-sisweb-operational-locked="true"/);
  assert.match(vendas, /b\.title = 'Conectando à sua empresa\.\.\.';/);
});

test('compras: boot state machine + fila one-shot no listar', () => {
  assert.match(compras, /__siswebComprasBootState = 'booting'/);
  assert.match(compras, /__siswebComprasBootPromise = inicializarSistemaCompras\(\);/);
  assert.match(compras, /__siswebComprasBootState = 'ready'/);
  assert.match(compras, /__siswebComprasBootState = 'failed'/);
  assert.match(compras, /__siswebComprasListarPendente/);
  assert.match(compras, /Conectando à sua empresa, abrindo a lista em instantes/);
  assert.match(comprasHtml, /onclick="listarPedidos\(\)"[^>]*disabled/);
  assert.match(comprasHtml, /data-sisweb-operational-locked="true"/);
  assert.match(compras, /b\.title = 'Conectando à sua empresa\.\.\.';/);
});

test('upload legado funciona no bridge modular (dual-world)', () => {
  const legacy = fs.readFileSync(new URL('../src/services/firebaseService.js', import.meta.url), 'utf8');
  assert.doesNotMatch(legacy, /const downloadURL = await snapshot\.ref\.getDownloadURL\(\);/);
  assert.match(legacy, /snapRef/);
  assert.match(legacy, /await ref\.getDownloadURL\(\)/);
});

test('TORA mostra só Resumo; serrados só fieldset (vendas+compras)', () => {
  assert.match(vendasHtml, /id="opcaoResumoVenda"/);
  assert.match(vendasHtml, /id="agruparResumoVendas"/);
  assert.match(vendas, /labelResumo\) labelResumo\.style\.display = isTora/);
  assert.match(vendas, /fieldset\.hidden = /);
  assert.match(compras, /labelResumo\) labelResumo\.style\.display = isTora/);
  const css = fs.readFileSync(new URL('../commerce-responsive.css', import.meta.url), 'utf8');
  assert.match(css, /\.romaneio-group-fieldset\[hidden\]/);
});

test('vendas: modo resumo por espécie com preview e carga fiéis', () => {
  assert.match(vendas, /romaneioPreviewExcluidosResumo/);
  assert.match(vendas, /agrupado_.*_resumo/);
  assert.match(vendas, /Resumo por Espécie/);
  assert.match(vendas, /tipoInferido/);
});

test('company: toasts do fluxo logo/save blindados e rastreáveis', () => {
  const company = fs.readFileSync(new URL('../company.html', import.meta.url), 'utf8');
  assert.match(company, /function companyToast\(msg, type, opts\)/);
  assert.match(company, /\[company-toast\]/);
  assert.match(company, /companyToast\(msg, 'warning', \{ duration: 6000 \}\);/);
  assert.match(company, /companyToast\(msg, 'success'\);/);
  assert.match(company, /companyToast\(msg, 'error', \{ duration: 5000 \}\);/);
});

test('toasts acima do modal Lista de Pedidos (vendas+compras+unificado)', () => {
  assert.match(vendasHtml, /\.toast-container \{[\s\S]*?z-index: 10000000;/);
  assert.match(comprasHtml, /\.toast-container \{[\s\S]*?z-index: 10000000;/);
  const unified = fs.readFileSync(new URL('../modules/core/toast.js', import.meta.url), 'utf8');
  assert.match(unified, /z-index:10000000/);
});

test('barra Voltar/Imprimir nunca sai no papel (todos os fluxos)', () => {
  const helper = fs.readFileSync(new URL('../commerce-pdf-share.js', import.meta.url), 'utf8');
  assert.match(helper, /\.sisweb-print-back:not\(\.no-print\),\s*\n\s*\.sisweb-print-back \{\s*\n\s*display: none !important;/);
  assert.match(helper, /data-sisweb-print-back/);
  assert.match(helper, /showBackBar === false/);
});

test('unidade m³ padrão e Enter no preço adiciona (vendas+compras)', () => {
  for (const html of [vendasHtml, comprasHtml]) {
    assert.match(html, /option value="m³" selected/);
    assert.match(html, /id="precoManual"[^>]*onkeydown="if\(event\.key==='Enter'\)/);
    assert.match(html, /id="precoUnitario"[^>]*onkeydown="if\(event\.key==='Enter'\)/);
  }
  assert.match(vendas, /unidadeManual'\)\.value = 'm³'/);
});

test('lista e impressão exibem itens dimensoes pelo nome (sem re-derivação)', () => {
  const ocorrencias = vendas.match(/item\.tipo === 'romaneio_dimensoes'/g) || [];
  assert.ok(ocorrencias.length >= 3, 'tabela, detalhes e impressão classificam romaneio_dimensoes');
});

// ---------------------------------------------------------------------------
// Persistência fail-closed: sem sucesso fantasma (reversão pós-reload)
// ---------------------------------------------------------------------------
test('vendas: save só confirma com servidor, com rollback e sem mentir', () => {
  assert.match(vendas, /__rvSaveDataRemoteOk/);
  assert.match(vendas, /backupPedidos/);
  assert.match(vendas, /window\.pedidos = backupPedidos/);
  assert.match(vendas, /salvouServidor/);
  assert.match(vendas, /Nenhuma alteração foi perdida/);
  assert.match(vendas, /invalidateReadCacheForPath\('vendas\/pedidos'\)/);
  const idxGate = vendas.indexOf('salvouServidor');
  const idxSucesso = vendas.indexOf("ToastManager.success('Pedido salvo com sucesso!'");
  assert.ok(idxGate !== -1 && idxSucesso !== -1 && idxGate < idxSucesso, 'sucesso só após gate do servidor');
});

test('compras: fallback valida remoto antes de confirmar', () => {
  assert.match(compras, /__rcSaveDataRemoteOk/);
  assert.match(compras, /Nenhuma alteração foi perdida/);
  assert.match(compras, /invalidateReadCacheForPath\('pedidosCompra'\)/);
  const idxGate = compras.indexOf('__rcSaveDataRemoteOk');
  const idxAssign = compras.indexOf('window.compras = nextCompras');
  assert.ok(idxGate !== -1 && idxAssign !== -1 && idxGate < idxAssign, 'memória só após confirmação');
});

test('compras: excluir também é fail-closed no fallback', () => {
  const block = compras.slice(compras.indexOf('async function excluirPedido(id)'), compras.indexOf('async function excluirPedido(id)') + 4000);
  assert.match(block, /__rcSaveDataRemoteOk/);
  assert.match(block, /Nenhuma alteração foi perdida/);
});

test('romaneio-manager: save/delete falham fechado em success:false explícito', () => {
  const manager = fs.readFileSync(new URL('../romaneio-manager.js', import.meta.url), 'utf8');
  assert.match(manager, /falhas/);
  assert.match(manager, /return count > 0 && falhas === 0/);
  assert.match(manager, /Não foi possível excluir o romaneio no servidor/);
  assert.match(manager, /Remoto primeiro/);
});

// ---------------------------------------------------------------------------
// Anti-undefined: SDK do Firebase aborta escrita com propriedades undefined
// ---------------------------------------------------------------------------
test('desagrupar não cria chave undefined (delete em vez de atribuir)', () => {
  assert.doesNotMatch(vendas, /itensOriginais: undefined/);
  assert.doesNotMatch(compras, /itensOriginais: undefined/);
});

test('save saneia undefined profundos antes de qualquer escrita remota', () => {
  assert.match(vendas, /function sanearIndefinidosFirebase\(valor\)/);
  assert.match(vendas, /sanearIndefinidosFirebase\(pedidoData\);/);
  assert.match(vendas, /sanearIndefinidosFirebase\(updatesAdd\);/);
  assert.match(compras, /function sanearIndefinidosFirebase\(valor\)/);
  assert.match(compras, /sanearIndefinidosFirebase\(pedido\);/);
  assert.match(compras, /sanearIndefinidosFirebase\(updates\);/);
});

// ---------------------------------------------------------------------------
// Fail-closed expandido: produtos, carregos, excluirPedido, fornecedores
// ---------------------------------------------------------------------------
test('vendas: produtos e carregos com rollback e sem sucesso fantasma', () => {
  assert.match(vendas, /backupProdutos/);
  assert.match(vendas, /produtoRemotoOk/);
  assert.match(vendas, /backupCarrego/);
  assert.match(vendas, /carregoRemotoOk/);
  assert.match(vendas, /carregoUnicoOk/);
  assert.match(vendas, /Nenhuma alteração foi perdida/);
});

test('vendas: excluirPedido com rollback de estoque+financeiro', () => {
  assert.match(vendas, /backupPedidosVenda/);
  assert.match(vendas, /backupEstoqueVenda/);
  assert.match(vendas, /finRemotoOk/);
  assert.match(vendas, /pedidoRemotoOk/);
  assert.match(vendas, /Nenhuma alteração foi concluída/);
});

test('vendas: cleanups financeiros retornam status', () => {
  const blockA = vendas.slice(vendas.indexOf('async function removerContasReceberAnteriores('), vendas.indexOf('async function listarContasReceberSemRecebimento('));
  assert.match(blockA, /return true/);
  assert.match(blockA, /return false/);
  assert.match(vendas, /async function removerContasReceberPorLista\(lista\)/);
  const blockB = vendas.slice(vendas.indexOf('async function removerContasReceberPorLista(lista)'), vendas.indexOf('async function logAuditoriaTransacao('));
  assert.match(blockB, /return true/);
  assert.match(blockB, /return false/);
});

test('compras: produtos e fornecedores com rollback e sem sucesso fantasma', () => {
  assert.match(compras, /persistProdutosCatalog/);
  assert.match(compras, /okCatalogo/);
  assert.match(compras, /Nenhuma alteração foi perdida/);
  const svc = compras.slice(compras.indexOf('function comprasFornecedoresGetService()'), compras.indexOf('function comprasFornecedoresMostrarEstado('));
  assert.match(svc, /__rcSaveDataRemoteOk/);
});
