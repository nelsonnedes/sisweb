import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const prodSrc = readFileSync('nf-produtos-nf.js', 'utf8');
const vendasSrc = readFileSync('vendas.js', 'utf8');
const itensSrc = readFileSync('nf-itens.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

// Extrai "function NAME(...) {...}" com balanceamento de chaves (padrão produto-romaneio.test.mjs).
function extract(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('função não encontrada: ' + name);
  const j = src.indexOf('{', i);
  let d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('chaves desbalanceadas: ' + name);
}

function runFn(code) {
  const sb = {};
  vm.createContext(sb);
  vm.runInContext(code, sb);
  return sb;
}

function loadNFe({ loadData = {}, onSave = null } = {}) {
  const calls = { load: [], save: [] };
  const context = {
    window: {
      firebaseService: {
        async loadFromFirebase(path) {
          calls.load.push(path);
          return { success: true, data: typeof loadData === 'function' ? loadData(path) : loadData };
        },
        async saveToFirebase(path, id, data) {
          calls.save.push({ path, id, data });
          if (onSave) return onSave(path, id, data);
          return { success: true };
        },
      },
    },
    document: { getElementById: () => null, createElement: () => ({ dataset: {}, style: {} }) },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(prodSrc, context);
  return { api: context.window.NFProdutosNF, calls };
}

function loadItens() {
  const context = { window: {}, console: { log() {}, warn() {}, error() {} } };
  vm.createContext(context);
  vm.runInContext(itensSrc, context);
  return context.window.NFItens;
}

function nfeFixture(det) {
  return {
    numero: '000000001',
    ide: { serie: '1', tpNF: 1 },
    chave: '4'.repeat(44),
    dataEmissao: '2026-10-15',
    det,
  };
}

// ─── 1. Rename ──────────────────────────────────────────────────────────────
test('rename: "📦 Produto Cadastrado (NF-e)" existe; "(Estoque)" sumiu; substring preservada', () => {
  assert.match(html, /📦 Produto Cadastrado \(NF-e\)/);
  assert.doesNotMatch(html, /Produto Cadastrado \(Estoque\)/, 'rótulo antigo removido da aba Itens');
  assert.match(html, /Produto Cadastrado/, 'substring preservada (qa-visual-pwa-routes continua verde)');
});

// ─── 2. Estrutura da seção Romaneio ─────────────────────────────────────────
test('romaneio UI: radio value="romaneio" + seção hidden + 2 selects + 4 options', () => {
  assert.match(html, /value="romaneio"/);
  assert.match(html, /🌲 Produto Romaneio \(CONAMA\)/);
  assert.match(html, /id="nfSecaoProdutoRomaneio"[^>]*style="display:none/);
  assert.match(html, /id="nfTipoRomaneio"/);
  assert.match(html, /id="nfRomaneioSelect"/);
  for (const v of ['romaneiosTL', 'romaneiosPct', 'romaneiosPes', 'romaneiosTora']) {
    assert.match(html, new RegExp('value="' + v + '"'), 'option ' + v + ' existe (mesmos values de vendas)');
  }
  // Lado a lado: os dois selects vivem na mesma seção, tipo antes do romaneio, antes da tabela
  const sec = html.indexOf('id="nfSecaoProdutoRomaneio"');
  const tipo = html.indexOf('id="nfTipoRomaneio"');
  const sel = html.indexOf('id="nfRomaneioSelect"');
  const fim = html.indexOf('id="tabelaItensNF"');
  assert.ok(sec > 0 && sec < tipo && tipo < sel && sel < fim, 'ordem: seção > tipo > select > tabela');
});

test('romaneio UI: campos Descrição/Qtd/Valor/NCM/CFOP + unidade M³ + botão + preview CONAMA', () => {
  assert.match(html, /id="itemDescricaoRom" readonly/);
  assert.match(html, /id="itemQuantidadeRom"/);
  assert.match(html, /id="itemValorUnitarioRom"/);
  assert.match(html, /id="itemNCMRom"/);
  assert.match(html, /id="itemCFOPRom"/);
  assert.match(html, /id="itemUnRom"[^>]*>M³</);
  assert.match(html, /onclick="adicionarItemNFRomaneio\(\)"/);
  assert.match(html, /id="nfPreviewRomaneioNFe"/);
  assert.match(html, /id="nfListaConamaNFe"/);
});

// ─── 3. Módulo: nó, swap, registro, hook, toggle ────────────────────────────
test('módulo: NODE_PRODUTOS_NFE + carregarProdutosNFe lê o nó fiscal + swap em popularSelectCadastrados', async () => {
  assert.match(prodSrc, /const NODE_PRODUTOS_NFE = 'fiscal\/produtos-nfe'/);
  assert.match(prodSrc, /companies\/\$\{tenantId\}\/\$\{NODE_PRODUTOS_NFE\}/);
  const body = extract(prodSrc, 'popularSelectCadastrados');
  assert.match(body, /_produtosNFe/, 'dropdown lê SÓ o nó novo (D1)');
  assert.doesNotMatch(body, /_produtos(?!NFe)/, 'swap completo: sem leitura do cache legado/estoque');

  const { api, calls } = loadNFe({ loadData: [{ nome: 'Maçaranduba Madeira em Viga' }] });
  const lista = await api.carregarProdutosNFe('tenantNF');
  assert.equal(lista.length, 1);
  assert.equal(calls.load[0], 'companies/tenantNF/fiscal/produtos-nfe');
});

test('registrarProdutosNFeDaNota: filtra ^MANUAL_|^ROMANEIO_ (D2) + dedupe + origens', async () => {
  assert.match(prodSrc, /\^\(MANUAL_\|ROMANEIO_\)/, 'filtro de prefixos no código');
  const { api, calls } = loadNFe({
    loadData: {
      NFE_1: { id: 'NFE_1', nome: 'Maçaranduba Madeira em Viga', ncm: '44071100', precoVenda: 100, unidade: 'M³', cfopPadrao: '5102', origemCadastro: 'nfe-manual' },
    },
  });
  const resultado = await api.registrarProdutosNFeDaNota(nfeFixture([
    { xProd: 'MAÇARANDUBA madeira em viga ', cProd: 'ROMANEIO_1', ncm: '44071100', cfop: '5102', uCom: 'M³', vUnCom: 250 },
    { xProd: 'Pinus Madeira em Tábua', cProd: 'MANUAL_2', ncm: '44071200', cfop: '5102', uCom: 'M³', vUnCom: 120 },
    { xProd: 'Produto Cadastrado X', cProd: 'PROD_9', ncm: '44079990', cfop: '5102', uCom: 'UN', vUnCom: 10 },
    { xProd: '', cProd: 'MANUAL_3' },
  ]), 'tNF');

  assert.deepEqual({ ...resultado }, { criados: 1, atualizados: 1, ignorados: 2 });
  assert.equal(calls.save.length, 1);
  const { path, id, data } = calls.save[0];
  assert.equal(path, 'companies/tNF/fiscal/produtos-nfe');
  assert.equal(id, null);
  const mac = data.find((p) => p.id === 'NFE_1');
  assert.equal(mac.precoVenda, 250, 'merge atualiza preço sem duplicar nome normalizado');
  assert.equal(mac.ncm, '44071100');
  const pinus = data.find((p) => p.nome === 'Pinus Madeira em Tábua');
  assert.ok(pinus, 'item MANUAL_ criado');
  assert.equal(pinus.origemCadastro, 'nfe-manual');
  assert.equal(pinus.unidade, 'M³');
});

test('hook confirmarEmissao: NFe APÓS o bloco do checkbox, fire-and-forget, sem toast', () => {
  const iFiscais = html.indexOf('Produto Cadastrado (Fiscais)');
  const iNFe = html.indexOf('Produto Cadastrado (NF-e) + Romaneio');
  assert.ok(iFiscais > 0 && iNFe > iFiscais, 'hook NFe vem APÓS o bloco do checkbox');
  const bloco = html.slice(iNFe, html.indexOf('mostrarAlertaEmissao(`${autorizada', iNFe));
  assert.match(bloco, /registrarProdutosNFeDaNota\(notaParaCatalogoNFe, obterTenantIdNF\(\)\)/);
  assert.match(bloco, /\.catch\(/, 'fire-and-forget com catch');
  assert.match(bloco, /console\.warn/, 'falha só loga');
  assert.doesNotMatch(bloco, /notifyUser/, 'SEM toast (só console)');
  assert.doesNotMatch(bloco, /await window\.NFProdutosNF/, 'sem await: nunca bloqueia a emissão');
});

test("alterarTipoProduto tem branch 'romaneio' p/ 3 seções + limpar campos estendido", () => {
  const body = extract(prodSrc, 'alterarTipoProduto');
  assert.match(body, /getElementById\('nfSecaoProdutoRomaneio'\)/);
  assert.match(body, /tipo === 'romaneio'/);
  assert.match(body, /mostrar\(secRomaneio, true\)/);
  assert.match(body, /mostrar\(secManual, false\); mostrar\(secCadastrado, false\); mostrar\(secRomaneio, true\)/);
  const limpar = extract(prodSrc, '_limparCamposItem');
  for (const id of ['nfTipoRomaneio', 'nfRomaneioSelect', 'itemDescricaoRom', 'itemQuantidadeRom', 'itemValorUnitarioRom', 'itemNCMRom', 'itemCFOPRom']) {
    assert.ok(limpar.includes("'" + id + "'"), '_limparCamposItem cobre ' + id);
  }
  assert.match(limpar, /nfListaConamaNFe/);
});

// ─── 4. Comportamental via vm ───────────────────────────────────────────────
test("descricaoConamaNFe('Maçaranduba','Viga') === 'Maçaranduba Madeira Serrada em Viga'", () => {
  const { api } = loadNFe();
  assert.equal(api.descricaoConamaNFe('Maçaranduba', 'Viga'), 'Maçaranduba Madeira Serrada em Viga');
  assert.equal(api.descricaoConamaNFe('Ipê', 'Tora'), 'Ipê Madeira Serrada em Tora');
});

test('classificarCategoriaNFe nos limites + ouro idêntico a vendas.js', () => {
  const { api } = loadNFe();
  assert.equal(api.classificarCategoriaNFe(5, 15), 'Viga');
  assert.equal(api.classificarCategoriaNFe(1.5, 5), 'Ripa');
  assert.equal(api.classificarCategoriaNFe(2, 15), 'Tábua');
  // NOTA: a story lista "Outro: 50/50", mas pelos thresholds 50/50 é
  // 'Bloco, quadrado ou filé' (>12/>12) — trava-se o OURO (nf === vendas).
  assert.equal(api.classificarCategoriaNFe(3, 1), 'Outro', 'caso genuinamente Outro');
  const sb = runFn(extract(vendasSrc, 'classificarProdutoConama'));
  const ouro = sb.classificarProdutoConama;
  for (const [e, l] of [[5, 15], [1.5, 5], [2, 15], [50, 50], [3, 1], [4, 7], [10, 25], [6, 9], [2.5, 5]]) {
    assert.equal(api.classificarCategoriaNFe(e, l), ouro(e, l), `ouro esp=${e} larg=${l}`);
  }
  assert.equal(api.classificarCategoriaNFe(50, 50), 'Bloco, quadrado ou filé');
});

test('resumoConamaNFe serrado: volume = item.volume total (sem × quantidade)', () => {
  const { api } = loadNFe();
  const res = api.resumoConamaNFe({
    tipoRomaneio: 'romaneiosPct',
    itens: [
      { especie: 'Ipê', espessura: 5, largura: 15, comprimento: 300, quantidade: 10, volume: 0.5, precoUnitario: 100 },
      { especie: 'Pinus', espessura: 2.5, largura: 15, comprimento: 300, quantidade: 10, pecasPorPacote: 2 },
    ],
  });
  assert.equal(res['Ipê']['Viga'].volume, 0.5, 'usa o total informado, não multiplica pela qtd');
  assert.equal(res['Ipê']['Viga'].valorTotal, 50);
  assert.equal(res['Ipê']['Viga'].precoUnitario, 100);
  // 2.5*15*300/1e6 = 0.01125 unit × 10 qtd × 2 ppp = 0.225 (só sem volume informado)
  assert.ok(Math.abs(res['Pinus']['Tábua'].volume - 0.225) < 1e-9);
});

test('resumoConamaNFe tora: cilindro − oco; volumeLiquido × qtd quando informado', () => {
  const { api } = loadNFe();
  const res = api.resumoConamaNFe({
    tipo: 'tora',
    itens: [{ especie: 'Jatobá', diametro: 50, comprimento: 500, oco1: 10, oco2: 10, quantidade: 1 }],
  });
  const esperado = Math.PI * Math.pow(0.25, 2) * 5 - 0.05;
  assert.ok(Math.abs(res['Jatobá']['Tora'].volume - esperado) < 1e-9, 'cilindro menos oco');
  const res2 = api.resumoConamaNFe({
    tipo: 'tora',
    itens: [{ especie: 'Jatobá', volumeLiquido: 0.8, quantidade: 2 }],
  });
  assert.ok(Math.abs(res2['Jatobá']['Tora'].volume - 1.6) < 1e-9);
});

test('buscarNoCatalogoNFe: match por nome normalizado; null quando ausente', async () => {
  const { api } = loadNFe({
    loadData: [{ nome: 'Maçaranduba Madeira em Viga', ncm: '44071100', precoVenda: 2500.75 }],
  });
  await api.carregarProdutosNFe('t1');
  assert.deepEqual(
    { ...api.buscarNoCatalogoNFe('MACARANDUBA MADEIRA EM VIGA') },
    { ncm: '44071100', precoVenda: 2500.75 },
    'sem acento/maiúsculas encontra o cadastro',
  );
  assert.equal(api.buscarNoCatalogoNFe('Pinus Madeira em Tábua'), null);
  assert.equal(api.buscarNoCatalogoNFe(''), null);
});

test('normalizarNomeProduto idempotente (extraída do módulo, reutilizada — sem duplicar)', () => {
  const sb = runFn(extract(prodSrc, 'normalizarNomeProduto'));
  const f = sb.normalizarNomeProduto;
  assert.equal(f('  Maçaranduba   MADEIRA em Viga '), 'macaranduba madeira em viga');
  assert.equal(f(f('  Maçaranduba   MADEIRA em Viga ')), f('  Maçaranduba   MADEIRA em Viga '));
  assert.equal(f(''), '');
});

// ─── 5. Fail-closed ─────────────────────────────────────────────────────────
test('fail-closed: adicionarItemNFRomaneio usa NFItens.validarEntradaItem + cProd ROMANEIO_ + uCom M³', () => {
  const body = extract(html, 'adicionarItemNFRomaneio');
  assert.match(body, /window\.NFItens\?\.validarEntradaItem/, 'validação central (regex no HTML)');
  assert.match(body, /validarEntradaItem\(\{ nome, qtd, vUnit, ncm, cfop \}\)/);
  assert.match(body, /cProd: 'ROMANEIO_'/);
  assert.match(body, /uCom: 'M³'/);
});

test('fail-closed: NCM vazio/genérico nunca vira item válido; registrar só replica (sem NCM inventado)', () => {
  const I = loadItens();
  const base = { nome: 'Maçaranduba Madeira em Viga', qtd: 0.5, vUnit: 100, cfop: '5102' };
  assert.equal(I.validarEntradaItem({ ...base, ncm: '' }).valid, false, 'NCM vazio bloqueado');
  assert.equal(I.validarEntradaItem({ ...base, ncm: '00000000' }).valid, false, 'NCM genérico bloqueado');
  assert.equal(I.validarEntradaItem({ ...base, ncm: '44071100' }).valid, true);
  // Registrar NÃO inventa NCM: só replica o item autorizado (assert de código, sem Firebase).
  const regBody = extract(prodSrc, 'registrarProdutosNFeDaNota');
  assert.match(regBody, /ncm: String\(item\.ncm \|\| ''\)/, 'replica; vazio continua vazio');
  assert.doesNotMatch(regBody, /00000000/, 'sem default genérico');
  assert.doesNotMatch(regBody, /44\d{6}/, 'sem NCM hardcoded');
});
