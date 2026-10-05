import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const src = readFileSync(new URL('../vendas.js', import.meta.url), 'utf8');

function extract(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('nf ' + name);
  const j = src.indexOf('{', i);
  let d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(extract('calcularVolumeSerradoM3'), sandbox);
const calc = sandbox.calcularVolumeSerradoM3;

test('volume serrado: 2.5 x 15 x 300 cm x 10 pçs', () => {
  // 2.5*15*300/1e6 = 0.01125 m³/pc × 10 ≈ 0.112 (float) em 3 casas
  assert.equal(calc(2.5, 15, 300, 10, 1), 0.112);
});

test('volume serrado: ppp multiplica (PCT)', () => {
  assert.equal(calc(2.5, 15, 300, 10, 2), 0.225);
});

test('volume serrado: zero quando dimensão falta', () => {
  assert.equal(calc(0, 15, 300, 10, 1), 0);
  assert.equal(calc('', 15, 300, 10, 1), 0);
  assert.equal(calc(2.5, 15, 300, 0, 1), 0);
});

test('volume serrado: aceita vírgula decimal pt-BR', () => {
  assert.equal(calc('2,5', '15', '300', 10, 1), 0.112);
});

test('salvarProduto persiste campos do romaneio', () => {
  assert.ok(/produto\.tipoProduto = 'romaneio'/.test(src), 'tipoProduto persistido');
  assert.ok(/produto\.volumeM3 = calcularVolumeSerradoM3/.test(src), 'volumeM3 persistido');
  assert.ok(/produto\.romaneioId = d\.romaneioId/.test(src), 'romaneioId persistido');
});

test('aba Estoque de Madeira Serrada padronizada: form inline + modal de lista, sem produtoModal', () => {
  const html = readFileSync(new URL('../vendas.html', import.meta.url), 'utf8');
  assert.ok(!/produtoModal/.test(html + src), 'sem referência a produtoModal');
  assert.ok(/id="listaProdutosModal"/.test(html), 'modal existe (id mantido)');
  assert.ok(/<h2>Lista de Madeira Serrada em Estoque<\/h2>/.test(html), 'título do modal renomeado');
  assert.ok(/Estoque de Madeira Serrada\s*<\/button>/.test(html), 'aba renomeada');
  assert.ok(/Listar Madeira Serrada/.test(html), 'botão que abre o modal renomeado');
  assert.ok(/<title>Lista de Madeira Serrada em Estoque<\/title>/.test(src), 'título de impressão renomeado');
  assert.ok(/LISTA DE MADEIRA SERRADA EM ESTOQUE/.test(src), 'cabeçalho de impressão renomeado');
  assert.ok(/sisweb-print-back/.test(src), 'barra Voltar/Imprimir padrão no relatório');
  assert.ok(/window\.print\(\)/.test(src), 'botão Imprimir dispara impressão');
  assert.ok(/id="secaoProdutoForm"/.test(html), 'form inline existe');
  assert.ok(/name="tipoProdutoForm"/.test(html), 'radios Comum/Romaneio existem');
  assert.ok(/id="previewProdutoRomaneio"/.test(html), 'preview existe');
  for (const fn of ['alternarTipoProdutoForm', 'fecharProdutoForm', 'carregarItensProdutoRomaneio', 'renderPreviewProdutoRomaneio', 'adicionarEstoqueGruposRomaneio', 'renderPreviewProdutoManuel', 'carregarRomaneiosEm', 'acharProdutoSerradoExistente', 'adicionarItemProdutoManuel', 'excluirItemProdutoManuel', 'limparItensProdutoManuel', 'adicionarEstoqueManuel', 'agruparItensRomaneioExLxC', 'excluirGrupoPreviewRomaneio', 'gruposRomaneioSelecionados', 'temDimsSerrado', 'metrosLinearesDe', 'limparCamposProdutoManuel']) {
    assert.ok(src.includes('function ' + fn + '('), `função ${fn} existe`);
  }
});

test('romaneio em pedidos: usos com status + baixa na aprovação', () => {
  const html = readFileSync(new URL('../vendas.html', import.meta.url), 'utf8');
  for (const fn of ['statusRomaneioConferido', 'buscarUsosRomaneioVendas', 'anotarUsosPreviewProduto', 'baixarEstoqueSerradoPorAprovacao']) {
    assert.ok(src.includes('function ' + fn + '('), `função ${fn} existe`);
  }
  assert.ok(/uso-romaneio-badge/.test(src), 'slot de badge no preview existe');
  assert.ok(!/usarGrupoProdutoRomaneio/.test(src), 'usarGrupo removido (checkboxes no preview)');
  assert.ok(!/agrProdEsp/.test(src), 'checkboxes Agrupar removidos (auto ExLxC)');
  assert.ok(/value="manuel"[^>]*> Produto Manual/.test(html), 'radio Produto Manual existe');
  assert.ok(/id="produtoManuelFooter"/.test(html), 'footer manuel existe');
  assert.ok(/id="produtoRomaneioFooter"/.test(html), 'footer romaneio existe');
  assert.ok(/id="unidadeItem"/.test(html), 'campo Unidade no Cadastrado existe');
  assert.ok(/id="previewProdutoManuel"/.test(html), 'preview manuel existe');
  assert.ok(/id="formProdutoBase"/.test(html), 'base do form existe');
  assert.ok(!/id="produto(Form|Manuel|Romaneio)Footer" class="modal-footer action-buttons"/.test(html), 'footers sem action-buttons (!important global quebrava o hide)');
  for (const fn of ['isProdutoReal']) {
    assert.ok(src.includes('function ' + fn + '('), `função ${fn} existe`);
  }
  assert.ok(/id="produtoRomaneioVinculo"/.test(html), 'vínculo romaneio existe');
  assert.ok(/id="produtoDimsFields"/.test(html), 'bloco dims existe');
  assert.ok(/lbl-estoque/.test(html), 'labels de estoque com span existem');
  assert.ok(/adicionarItemProdutoManuel/.test(html), 'botão Adicionar item existe');
  assert.ok(/id="produtosSelectAll"/.test(html), 'checkbox selecionar todos existe');
  assert.ok(/imprimirProdutosSelecionados/.test(html + src), 'impressão existe');
  assert.ok(/excluirProdutosSelecionados/.test(html + src), 'exclusão em lote existe');
  assert.ok(/imprimirRelatorioProdutos/.test(src), 'relatório com cabeçalho existe');
  assert.ok(/RESUMO — ESPÉCIE x ESPESSURA x LARGURA/.test(src), 'resumo no rodapé existe');
  assert.ok(/id="produtoRomaneioId2" onchange="atualizarVolumeProdutoRomaneio\(\)"/.test(html), 'troca de romaneio não apaga preview (multi)');
  assert.ok(/\[prod-form\] modo=/.test(src), 'log diagnóstico de footers presente');
  assert.ok(/<th>M\. Linear<\/th>/.test(html), 'coluna M. Linear existe');
  assert.ok(/Volume \(m³\)/.test(html), 'coluna Volume existe');
  assert.ok(/existente\.pecas =/.test(src), 'acúmulo soma peças');
  assert.ok(/existente\.volumeM3 =/.test(src), 'acúmulo soma volumeM3');
  assert.ok(/metrosLinearesDe/.test(src), 'helper metros lineares existe');
  assert.ok(/g\.ml =/.test(src), 'grupo acumula ml');
  assert.ok(!/agrProdEsp/.test(html + src), 'checkboxes Agrupar removidos (auto ExLxC)');
});

test('dropdown romaneio: item.volume é TOTAL, sem × quantidade (TL/PCT/PES)', () => {
  // Itens serrados salvam volume total: PCT (unit×qtd×ppp), TL (unit×qtd),
  // PES (totais = SUM item.volume). Multiplicar de novo inflava o m³ exibido.
  assert.ok(!/volumeInformado \* quantidade/.test(src), 'sem dupla multiplicação');
  assert.ok(!/vi \* q/.test(src), 'rótulo do select sem dupla multiplicação');
  assert.ok(/return total \+ volumeInformado;/.test(src), 'dropdown soma o total direto');
  assert.ok(/volumeTotal = volumeInformado;/.test(src), 'CONAMA soma o total direto');
});

test('mobile: footers ocultos preservados + campos sem estouro (vendas produtos)', () => {
  const css = readFileSync(new URL('../commerce-responsive.css', import.meta.url), 'utf8');
  // grid !important vencia inline display:none e exibia os 3 footers = botões repetidos
  assert.ok(/\.modal-footer:not\(\[style\*="display:none"\]\)/.test(css), 'footer oculto preservado no mobile');
  // iOS zooma campos com fonte <16px
  assert.ok(/input,\s*select,\s*textarea\s*\{\s*font-size:\s*16px/.test(css), 'anti-zoom iOS no breakpoint mobile');
  // selects com opções longas (romaneio) em largura total
  assert.ok(/#secaoProdutoForm select/.test(css), 'campos do form de produto em largura total');
  assert.ok(/#listaProdutosModal select/.test(css), 'campos do modal em largura total');
});

test('adicionar estoque romaneio: trava + loading + save único em lote', () => {
  // Trava anti-duplo-clique (mobile lento, risco de duplicar produtos)
  assert.ok(/__adicionarEstoqueRomaneioEmAndamento/.test(src), 'flag in-flight existe');
  assert.ok(/já em andamento/.test(src), 'aviso quando ocupado');
  // Feedback durante a gravação + restauração garantida
  assert.ok(/LoadingManager\.show\(`Adicionando/.test(src), 'loading com progresso');
  assert.ok(/finally\s*\{/.test(src), 'bloco finally restaura estado');
  assert.ok(/LoadingManager\.hide/.test(src), 'loading sempre escondido');
  // 1 round-trip em vez de N (era 1 saveToFirebase por grupo)
  const ini = src.indexOf('async function adicionarEstoqueGruposRomaneio()');
  const fim = src.indexOf('\nfunction renderPreviewProdutoManuel()', ini);
  const fluxo = ini >= 0 && fim > ini ? src.slice(ini, fim) : '';
  assert.ok(fluxo.length > 0, 'fluxo localizado');
  assert.ok(!/saveToFirebase\('produtos'/.test(fluxo), 'sem save por item no fluxo de grupos');
  assert.ok(/await saveData\('produtos', filtrarProdutosPersistiveis/.test(src), 'save único em lote');
  // Cards do preview com classe (layout ordenado desktop/mobile)
  assert.ok(/class="grupo-rom-card"/.test(src), 'cards com classe');
  assert.ok(/class="grm-body"/.test(src), 'corpo do card com min-width:0');
});

test('estoque 0 persiste: peças sem fallback || 1', () => {
  // Zerar peças caía em || 1 e a lista exibia 1 (coluna mostra peças p/ serrado)
  assert.ok(!/pecas:\s*num\('produtoPecas'\)\s*\|\|\s*1/.test(src), 'sem coerção de 0 para 1');
  assert.ok(/pecas:\s*Math\.max\(0,\s*num\('produtoPecas'\)\)/.test(src), 'zero permitido, negativo bloqueado');
});

test('mobile: selecionar-todos visível acima da tabela', () => {
  const html = readFileSync(new URL('../vendas.html', import.meta.url), 'utf8');
  assert.ok(/id="produtosSelectAllMobile"/.test(html), 'checkbox mobile existe');
  assert.ok(/\.produtos-selectall-mobile/.test(html), 'visível só ≤768px');
  assert.ok(/produtosSelectAllMobile/.test(src), 'estado espelhado no contador');
});

test('preview: refetch do romaneio + sincronia de grupos', () => {
  // Cache stale escondia itens novos após editar o romaneio
  assert.ok(!/Cache primeiro/.test(src), 'sem cache-first no carregar itens');
  assert.ok(/idEstavel/.test(src), 'resolução por ID estável');
  assert.ok(/posPorGid/.test(src), 'substituição no lugar preserva checkbox');
  assert.ok(/gidNovos/.test(src), 'grupos removidos do romaneio saem do preview');
});

test('lista oculta serrado zerado; select-all mobile após Imprimir/Excluir', () => {
  assert.ok(/function estoqueZeradoNaLista/.test(src), 'filtro de zerados existe');
  assert.ok(/!estoqueZeradoNaLista\(p\)/.test(src), 'lista aplica o filtro');
  const html = readFileSync(new URL('../vendas.html', import.meta.url), 'utf8');
  const iBtns = html.indexOf('excluirProdutosSelecionados');
  const iSel = html.indexOf('produtosSelectAllMobile');
  assert.ok(iBtns > 0 && iSel > iBtns, 'select-all mobile abaixo dos botões');
});

test('mobile: pares Adicionar/Cancelar empilhados (sem sobreposição)', () => {
  const html = readFileSync(new URL('../vendas.html', import.meta.url), 'utf8');
  assert.ok(/#grupoBtnDimsAdicionar/.test(html), 'bloco de botões do editar existe');
  assert.ok(/#botoesItensManuel/.test(html), 'bloco de botões do manuel existe');
  assert.ok(/margin-left: 0 !important/.test(html), 'mata o margin inline no mobile');
});

test('preview: aviso JÁ EM ESTOQUE sem desmarcar (aditivo por desenho)', () => {
  assert.ok(/function romaneioIdsEmEstoque/.test(src), 'helper de ids em estoque existe');
  assert.ok(/function anotarEstoquePreviewProduto/.test(src), 'anotação de estoque existe');
  // Usa o mesmo matcher do save (acharProdutoSerradoExistente) — aviso e ação concordam
  assert.ok(/acharProdutoSerradoExistente\(g\.romaneioId, g\)/.test(src), 'badge usa o matcher do somados');
  // Não desmarca nem altera opacidade (só o alerta de pedido conferido faz isso)
  const ini = src.indexOf('function anotarEstoquePreviewProduto()');
  const fim = src.indexOf('async function anotarUsosPreviewProduto', ini);
  const fn = ini >= 0 && fim > ini ? src.slice(ini, fim) : '';
  assert.ok(fn.length > 0, 'função localizada');
  assert.ok(!/\.checked\s*=\s*false/.test(fn), 'não desmarca grupos');
  assert.ok(!/opacity/.test(fn), 'não esmaece card');
  assert.ok(/slot vazio|slot\.innerHTML \(\|\| ''\)/.test(fn) || /\(slot\.innerHTML/.test(fn), 'só escreve em slot vazio');
  // Sufixo na option espelha o "USADO Ped." dos pedidos
  assert.ok(/EM ESTOQUE/.test(src), 'sufixo na option existe');
});
