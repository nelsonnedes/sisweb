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
  assert.ok(!/existente\.pecas =/.test(src), 'ramo somados removido (trava substitui)');
  assert.ok(/puladosTravados/.test(src), 'save pula travados e informa');
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
  assert.ok(/\.btn \+ \.btn/.test(html) && /margin-top: 10px/.test(html), 'espaço explícito entre botões empilhados');
});

test('preview: trava JÁ EM ESTOQUE igual pedidos (inativo + cadeado)', () => {
  assert.ok(/algumTravado/.test(src), 'flag de trava no render existe');
  assert.ok(/Romaneio já adicionado ao estoque/.test(src), 'banner com cadeado existe');
  assert.ok(/Já em estoque — desativado/.test(src), 'badge com cadeado no grupo existe');
  assert.ok(!/function anotarEstoquePreviewProduto/.test(src), 'anotação antiga removida (lock é no render)');
  // Grupos travados: checkbox desabilitado + desmarcado + card esmaecido
  assert.ok(/disabled/.test(src), 'checkbox desativado existe');
  // Corrida coberta no save: pula travados e informa
  assert.ok(/puladosTravados/.test(src), 'contador de pulados existe');
  // Sufixo na option espelha o "USADO Ped." dos pedidos
  assert.ok(/EM ESTOQUE/.test(src), 'sufixo na option existe');
});

test('disponibilidade: delta romaneio−estoque (8→9 pçs libera 1)', () => {
  const sandbox2 = { window: { produtos: [] } };
  vm.createContext(sandbox2);
  vm.runInContext(extract('disponibilidadeGrupoRomaneio'), sandbox2);
  const disp = sandbox2.disponibilidadeGrupoRomaneio;
  const grupo = { gid: 'R1||X', romaneioId: 'R1', especie: 'Orelha-de-macaco', espessura: 4, largura: 7, comprimento: 700, pecas: 9, volume: 0.196, ml: 63 };
  // sem estoque: livre (vm tem protótipo próprio: compara campo a campo)
  const d0 = disp(grupo);
  assert.equal(d0.travado, false);
  assert.equal(d0.parcial, false);
  // estoque com 8: parcial de 1
  sandbox2.window.produtos = [{ tipoProduto: 'romaneio', romaneioId: 'R1', especie: 'orelha-de-macaco', espessura: 4, largura: 7, comprimento: 700, pecas: 8, volumeM3: 0.174, metrosLineares: 56 }];
  const d1 = disp(grupo);
  assert.equal(d1.travado, false);
  assert.equal(d1.parcial, true);
  assert.equal(d1.dispPecas, 1);
  assert.equal(d1.estPecas, 8);
  // estoque com 9: travado
  sandbox2.window.produtos = [{ tipoProduto: 'romaneio', romaneioId: 'R1', especie: 'Orelha-de-macaco', espessura: 4, largura: 7, comprimento: 700, pecas: 9, volumeM3: 0.196, metrosLineares: 63 }];
  const d2 = disp(grupo);
  assert.equal(d2.travado, true);
  assert.equal(d2.parcial, false);
  // soma múltiplos produtos em estoque
  sandbox2.window.produtos = [
    { tipoProduto: 'romaneio', romaneioId: 'R1', especie: 'Orelha-de-macaco', espessura: 4, largura: 7, comprimento: 700, pecas: 5, volumeM3: 0.1, metrosLineares: 35 },
    { tipoProduto: 'romaneio', romaneioId: 'R1', especie: 'Orelha-de-macaco', espessura: 4, largura: 7, comprimento: 700, pecas: 3, volumeM3: 0.074, metrosLineares: 21 }
  ];
  const d3 = disp(grupo);
  assert.equal(d3.parcial, true);
  assert.equal(d3.dispPecas, 1);
  assert.equal(d3.estPecas, 8);
});

test('baixa por unidade: UN→peças, M³→volume, ML→ml, DZ→×12', () => {
  const sbU = { metrosLinearesDe: (p) => Math.round(((parseFloat(p.comprimento) || 0) / 100) * (parseFloat(p.pecas) || 0) * 100) / 100 };
  vm.createContext(sbU);
  vm.runInContext(extract('normalizarUnidadeMedida'), sbU);
  vm.runInContext(extract('dimensoesEstoqueSerrado'), sbU);
  vm.runInContext(extract('razaoBaixaSerrado'), sbU);
  vm.runInContext(extract('aplicarBaixaSerrado'), sbU);
  vm.runInContext(extract('aplicarBaixaManual'), sbU);
  const norm = sbU.normalizarUnidadeMedida;
  assert.equal(norm('UN'), 'UN');
  assert.equal(norm('unidade'), 'UN');
  assert.equal(norm('PC'), 'UN');
  assert.equal(norm('DZ'), 'DZ');
  assert.equal(norm('dúzia'), 'DZ');
  assert.equal(norm('m³'), 'M3');
  assert.equal(norm('M3'), 'M3');
  assert.equal(norm('ml'), 'ML');
  assert.equal(norm('LN'), 'ML');
  assert.equal(norm('m²'), 'M2');
  const mk = () => ({ pecas: 10, volumeM3: 0.112, metrosLineares: 30, largura: 15, comprimento: 300, estoque: 0.112 });
  const rU = sbU.razaoBaixaSerrado(mk(), 2, 'UN');
  assert.equal(rU.base, 'pecas');
  assert.equal(rU.consumido, 2);
  assert.equal(rU.disponivel, 10);
  const rM = sbU.razaoBaixaSerrado(mk(), 0.056, 'm³');
  assert.equal(rM.base, 'vol');
  assert.ok(Math.abs(rM.razao - 0.5) < 1e-9);
  const rD = sbU.razaoBaixaSerrado(mk(), 1, 'DZ');
  assert.equal(rD.base, 'pecas');
  assert.equal(rD.consumido, 10);
  const rML = sbU.razaoBaixaSerrado(mk(), 15, 'ml');
  assert.equal(rML.base, 'ml');
  assert.equal(rML.consumido, 15);
  // clamp: pedido maior que o saldo
  const rC = sbU.razaoBaixaSerrado(mk(), 99, 'UN');
  assert.equal(rC.razao, 1);
  assert.equal(rC.consumido, 10);
  // baixa proporcional em todas as dims
  const p1 = mk();
  sbU.aplicarBaixaSerrado(p1, 2, 'UN', -1);
  assert.equal(p1.pecas, 8);
  assert.ok(Math.abs(p1.volumeM3 - 0.09) < 0.001);
  // reversão devolve
  sbU.aplicarBaixaSerrado(p1, 2, 'UN', 1);
  assert.equal(p1.pecas, 10);
  // manual: DZ converte ×12
  const pm = { estoque: 24, unidade: 'UN' };
  sbU.aplicarBaixaManual(pm, 1, 'DZ', -1);
  assert.equal(pm.estoque, 12);
  sbU.aplicarBaixaManual(pm, 1, 'DZ', 1);
  assert.equal(pm.estoque, 24);
});

test('fluxos usam baixa por unidade + pedido exibe Nº', () => {
  assert.ok(/aplicarBaixaSerrado\(produto, item\.quantidade, item\.unidade/.test(src), 'save deduz por unidade');
  assert.ok(/aplicarBaixaSerrado\(alvo, qtd, unidadeItem, -1\)/.test(src), 'aprovação deduz por unidade');
  assert.ok(/aplicarBaixaSerrado\(produto, item\.quantidade, item\.unidade/.test(src), 'reversão por unidade');
  assert.ok(/validarEstoque\(produtoId, quantidade, itemEdicao/.test(src), 'validação recebe unidade');
  assert.ok(/sufixoNumero/.test(src), 'pedido exibe Nº do romaneio');
  const comprasSrc = readFileSync(new URL('../compras.js', import.meta.url), 'utf8');
  assert.ok(/sufixoNumeroC/.test(comprasSrc), 'compra exibe Nº do romaneio');
});

test('carrinho serrado não-m³: quantidade vira m³ + linha "COD - Nome - N Peças"', () => {
  const sbC = { temDimsSerrado: (p) => !!(p && p.tipoProduto === 'romaneio') };
  vm.createContext(sbC);
  vm.runInContext(extract('normalizarUnidadeMedida'), sbC);
  vm.runInContext(extract('dimsSerradoProduto'), sbC);
  vm.runInContext(extract('converterItemSerradoParaM3'), sbC);
  vm.runInContext(extract('detalheSerradoItem'), sbC);
  const conv = sbC.converterItemSerradoParaM3;
  const prod = { tipoProduto: 'romaneio', espessura: 7, largura: 14, comprimento: 850 };
  // 7*14*850/1e6 = 0.0833 m³/pç × 2 = 0.167 (3 casas)
  const c1 = conv(prod, 2, 'UN');
  assert.equal(c1.volume, 0.167);
  assert.equal(c1.pecasOrigem, 2);
  assert.equal(c1.unidadeOrigem, 'UN');
  assert.equal(sbC.detalheSerradoItem({ unidadeOrigem: 'UN', pecasOrigem: 2 }), '2 Peças');
  // DZ multiplica ×12
  const cDz = conv(prod, 1, 'DZ');
  assert.equal(cDz.pecasOrigem, 12);
  assert.equal(cDz.volume, 1);
  // ML e M² convertem
  const cMl = conv(prod, 10, 'ml');
  assert.ok(cMl.volume > 0 && cMl.unidadeOrigem === 'ml');
  const cM2 = conv(prod, 5, 'm²');
  assert.ok(cM2.volume > 0);
  // stored-ratio: 24 ml de produto com 0,067 m³ → 0,067 (não 0,001)
  const sbS = { metrosLinearesDe: (p) => parseFloat(p.metrosLineares) || 0 };
  vm.createContext(sbS);
  vm.runInContext(extract('normalizarUnidadeMedida'), sbS);
  vm.runInContext(extract('dimsSerradoProduto'), sbS);
  vm.runInContext(extract('converterItemSerradoParaM3'), sbS);
  sbS.temDimsSerrado = () => true;
  const prodMl = { tipoProduto: 'romaneio', espessura: 4, largura: 7, comprimento: 400, pecas: 6, volumeM3: 0.067, metrosLineares: 24 };
  assert.equal(sbS.converterItemSerradoParaM3(prodMl, 24, 'LN').volume, 0.067);
  // sem registro: fórmula cm → 4*7/1e4*24 = 0,0672
  const prodMl2 = { tipoProduto: 'romaneio', espessura: 4, largura: 7, comprimento: 400 };
  assert.equal(sbS.converterItemSerradoParaM3(prodMl2, 24, 'LN').volume, 0.067);
  // M² stored-ratio: área total 0,07*4*6=1,68 m² com 0,067 → 1 m² ≈ 0,04
  assert.equal(sbS.converterItemSerradoParaM3(prodMl, 1, 'm²').volume, 0.04);
  // select Produto exibe m² (fonte única: dimensoesEstoqueSerrado)
  assert.ok(/dimensoesEstoqueSerrado\(p\)\.area/.test(src), 'm² do select sem fórmula duplicada');
  // inferência display-only: m³ direto que equivale a peças inteiras
  const sbI = { window: { produtos: [{ id: 'P9', especie: 'Orelha-de-macaco', espessura: 6, largura: 12, comprimento: 700, pecas: 10, volumeM3: 0.504 }] } };
  vm.createContext(sbI);
  vm.runInContext(extract('normalizarUnidadeMedida'), sbI);
  vm.runInContext(extract('dimsSerradoProduto'), sbI);
  vm.runInContext(extract('pecaSingular'), sbI);
  vm.runInContext(extract('pecasInteirasDetalhe'), sbI);
  vm.runInContext(extract('detalheSerradoItem'), sbI);
  vm.runInContext(extract('rotuloSerradoLinha'), sbI);
  // 0,0504 = 1 peça exata → "1 Peça" (singular)
  assert.equal(sbI.detalheSerradoItem({ produtoId: 'P9', quantidade: 0.0504, unidade: 'm³' }), '1 Peça');
  // 0,050 ≈ 0,992 peça (0,8% off, dentro de 2%) → "1 Peça"
  assert.equal(sbI.detalheSerradoItem({ produtoId: 'P9', quantidade: 0.05, unidade: 'm³' }), '1 Peça');
  // 0,06 ≈ 1,19 peça (19% off) → sem detalhe
  assert.equal(sbI.detalheSerradoItem({ produtoId: 'P9', quantidade: 0.06, unidade: 'm³' }), '');
  // ML direto: 7 ml de peça 700cm → 1 peça
  assert.equal(sbI.detalheSerradoItem({ produtoId: 'P9', quantidade: 7, unidade: 'LN' }), '1 Peça');
  // espécie derivada do nome quando campo ausente
  const sbN = { window: { produtos: [{ id: 'PX', nome: 'Orelha-de-macaco 6x12x700' }] } };
  vm.createContext(sbN);
  vm.runInContext(extract('dimsSerradoProduto'), sbN);
  vm.runInContext(extract('rotuloSerradoLinha'), sbN);
  assert.equal(sbN.rotuloSerradoLinha({ produtoId: 'PX' }), 'Orelha-de-macaco - 6cmx12cmx700cm');
  // m³ não converte; sem dims não converte; manual não converte
  assert.equal(conv(prod, 2, 'm³'), null);
  assert.equal(conv(prod, 2, 'M3'), null);
  assert.equal(conv({ tipoProduto: 'romaneio' }, 2, 'UN'), null);
  assert.equal(conv({ tipoProduto: 'manual', estoque: 5 }, 2, 'UN'), null);
  // PC = pacote × ppp do produto (2 pac c/6 = 12); UN ignora ppp
  const prodPpp = { tipoProduto: 'romaneio', espessura: 7, largura: 14, comprimento: 850, pecasPorPacote: 6 };
  const cPc = conv(prodPpp, 2, 'PC');
  assert.equal(cPc.pecasOrigem, 12);
  const cUnPpp = conv(prodPpp, 2, 'UN');
  assert.equal(cUnPpp.pecasOrigem, 2);
  // rótulo com dims separadas
  const sbR = { produtos: [{ id: 'P1', especie: 'Orelha-de-macaco', espessura: 7, largura: 14, comprimento: 850 }] };
  vm.createContext(sbR);
  sbR.window = { produtos: sbR.produtos };
  vm.runInContext(extract('dimsSerradoProduto'), sbR);
  vm.runInContext(extract('rotuloSerradoLinha'), sbR);
  assert.equal(sbR.rotuloSerradoLinha({ produtoId: 'P1' }), 'Orelha-de-macaco - 7cmx14cmx850cm');
  assert.equal(sbR.rotuloSerradoLinha({ produtoId: 'XX' }), null);
  // fallback: produto legado sem dims, só nome com padrão ExLxC
  const sbL = { window: { produtos: [{ id: 'L1', especie: 'Orelha-de-macaco', nome: 'Orelha-de-macaco 7x14x850' }] } };
  vm.createContext(sbL);
  vm.runInContext(extract('normalizarUnidadeMedida'), sbL);
  vm.runInContext(extract('dimsSerradoProduto'), sbL);
  vm.runInContext(extract('converterItemSerradoParaM3'), sbL);
  sbL.temDimsSerrado = () => true;
  const dLeg = sbL.dimsSerradoProduto(sbL.window.produtos[0]);
  assert.deepEqual(JSON.parse(JSON.stringify(dLeg)), { E: 7, L: 14, C: 850 });
  const cLeg = sbL.converterItemSerradoParaM3(sbL.window.produtos[0], 2, 'UN');
  assert.equal(cLeg.volume, 0.167);
  // decimal com vírgula
  const dVir = sbL.dimsSerradoProduto({ nome: 'Pinus 2,5x15x300' });
  assert.deepEqual(JSON.parse(JSON.stringify(dVir)), { E: 2.5, L: 15, C: 300 });
  // render usa detalhe quando há origem (carrinho E visualização do pedido)
  const detUses = (src.match(/detalheSerradoItem\(item\)/g) || []).length;
  assert.ok(detUses >= 2, 'carrinho e visualização usam detalhe');
  assert.ok(/converterItemSerradoParaM3\(produto, quantidade, unidadeItem\)/.test(src), 'adicionar converte');
});
