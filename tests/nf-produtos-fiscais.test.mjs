import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const prodSrc = readFileSync('nf-produtos-nf.js', 'utf8');
const itensSrc = readFileSync('nf-itens.js', 'utf8');
const serviceSrc = readFileSync('nf-service.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

function loadProdutosNF({ loadData = {}, onSave = null } = {}) {
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
    document: { getElementById: () => null },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(prodSrc, context);
  return { api: context.window.NFProdutosNF, calls, context };
}

function nfeFixture(det) {
  return {
    numero: '000000001',
    ide: { serie: '1', tpNF: 0 },
    chave: '3'.repeat(44),
    dataEmissao: '2026-10-13',
    det,
  };
}

test('P2: NF-e lê o path canônico do estoque, sem paths legados tenants/', () => {
  assert.doesNotMatch(prodSrc, /`tenants\//, 'nf-produtos-nf.js não pode ler tenants/... (path sem escrita)');
  assert.match(prodSrc, /companies\/\$\{tenantId\}\/estoqueProdutos/);
});

test('P2: carregar() usa companies/{tenant}/estoqueProdutos e normaliza objeto/array', async () => {
  const { api, calls } = loadProdutosNF({
    loadData: { PROD_1: { id: 'PROD_1', nome: 'Viga' }, PROD_2: { id: 'PROD_2', nome: 'Tábua' } },
  });
  const lista = await api.carregar('tenant42');
  assert.equal(lista.length, 2);
  assert.equal(calls.load[0], 'companies/tenant42/estoqueProdutos');
  assert.ok(calls.load.every((p) => !String(p).startsWith('tenants/')), 'nenhuma leitura em tenants/');
  assert.equal(api.getById('PROD_1').nome, 'Viga');
});

test('registro automático: exposto na API e grava nó canônico tenant-scoped', () => {
  assert.match(prodSrc, /registrarProdutosDaNota/);
  assert.match(prodSrc, /return \{ carregar,[^}]*registrarProdutosDaNota \};/);
  assert.match(prodSrc, /await fb\(\)\.saveToFirebase\(path, null, lista\)/);
  assert.match(prodSrc, /`companies\/\$\{tid\}\/estoqueProdutos`/);
});

test('registro automático: dedupe por nome normalizado + merge só fiscal/preço (não toca estoque)', async () => {
  const { api, calls } = loadProdutosNF({
    loadData: {
      PROD_1: { id: 'PROD_1', nome: 'Viga de Ipê', quantidade: 5, precoMedio: 10, precoVenda: 7, unidade: 'M3', categoria: 'Madeira' },
    },
  });
  const resultado = await api.registrarProdutosDaNota(nfeFixture([
    {
      xProd: 'VIGA DE IPE ', ncm: '44071100', cfop: '1102', uCom: 'm3', csosn: '102',
      vUnCom: 2500.75, imposto: { icms: { orig: '0' } },
    },
    { xProd: 'Tábua', ncm: '44071200', cfop: '1102', uCom: 'UN', csosn: '101', vUnCom: 120 },
    { xProd: '' },
  ]), 'tenant42');

  assert.deepEqual({ ...resultado }, { criados: 1, atualizados: 1, ignorados: 1 });
  assert.equal(calls.save.length, 1);
  const { path, id, data } = calls.save[0];
  assert.equal(path, 'companies/tenant42/estoqueProdutos');
  assert.equal(id, null, 'grava o nó inteiro (padrão canônico do módulo Estoque)');
  assert.equal(data.length, 2);

  const viga = data.find((p) => p.id === 'PROD_1');
  assert.equal(viga.quantidade, 5, 'merge não pode zerar/alterar quantidade do estoque');
  assert.equal(viga.precoMedio, 10, 'merge não pode alterar preço médio');
  assert.equal(viga.categoria, 'Madeira', 'merge não pode sobrescrever categoria');
  assert.equal(viga.ncm, '44071100');
  assert.equal(viga.cfopPadrao, '1102');
  assert.equal(viga.precoVenda, 2500.75, 'Vl.Unit. da nota atualiza o valor de venda (pauta)');
  assert.equal(viga.fiscal.cst, '102');
  assert.equal(viga.fiscal.origem, '0');
  assert.equal(viga.fiscal.valorPauta, 2500.75, 'pauta = Vl.Unit. digitado na aba Itens');
  assert.equal(viga.fiscal.ultimaNota.numero, '000000001');
  assert.equal(viga.fiscal.ultimaNota.tpNF, 0, 'registro independe de tpNF (entrada)');

  const tabua = data.find((p) => p.nome === 'Tábua');
  assert.ok(tabua, 'produto novo criado');
  assert.match(tabua.id, /^PROD_/);
  assert.equal(tabua.quantidade, 0);
  assert.equal(tabua.precoMedio, 0);
  assert.equal(tabua.precoVenda, 120);
  assert.equal(tabua.origemCadastro, 'nfe');
  assert.equal(tabua.fiscal.ncm, '44071200');
  assert.equal(tabua.fiscal.cst, '101');
  assert.equal(tabua.fiscal.valorPauta, 120);
});

test('registro automático: sem itens ou sem tenant não escreve nada', async () => {
  const { api, calls } = loadProdutosNF({ loadData: {} });
  assert.deepEqual({ ...(await api.registrarProdutosDaNota(nfeFixture([]), 'tenant42')) }, { criados: 0, atualizados: 0, ignorados: 0 });
  assert.deepEqual({ ...(await api.registrarProdutosDaNota(nfeFixture([{ xProd: 'X', ncm: '1'.repeat(8) }]), '')) }, { criados: 0, atualizados: 0, ignorados: 1 });
  assert.equal(calls.save.length, 0);
});

test('UI: checkbox Produto Cadastrado (Fiscais), Vl.Unit. como pauta e hook pós-autorização', () => {
  assert.match(html, /id="nfRegistrarProdutosFiscais" checked/);
  assert.match(html, /Produto Cadastrado \(Fiscais\)/);
  // Pauta é o próprio Vl.Unit. — nenhum campo extra de pauta na UI
  assert.doesNotMatch(html, /id="itemValorPauta"/);
  assert.doesNotMatch(html, /id="itemValorPautaCad"/);
  assert.doesNotMatch(html, /id="nfEditItemPauta"/);
  assert.match(html, /autorizada && registrarProdutosFiscais && _notaEmCurso && window\.NFProdutosNF\?\.registrarProdutosDaNota/);
  assert.match(html, /registrarProdutosDaNota\(notaParaCatalogo, obterTenantIdNF\(\)\)[\s\S]{0,200}\.then\(/);
  assert.doesNotMatch(
    html,
    /await window\.NFProdutosNF\.registrarProdutosDaNota/,
    'cadastro no catálogo não pode bloquear o fluxo de emissão (fire-and-forget)',
  );
  assert.match(html, /nf_cadastro_produtos_fiscais_\$\{tid0\}/);
});

test('registro usa Vl.Unit. (vUnCom) como pauta — sem campo paralelo', () => {
  assert.match(prodSrc, /Vl\.Unit\. da aba Itens = valor da pauta do produto/);
  assert.match(prodSrc, /const valorPauta = parseFloat\(item\.vUnCom \|\| item\.valorUnitario\) \|\| 0;/);
  assert.match(prodSrc, /if \(valorPauta > 0\) existente\.precoVenda = valorPauta;/);
  assert.doesNotMatch(prodSrc, /item\.valorPauta/, 'registro não depende de campo valorPauta do item');
  assert.doesNotMatch(itensSrc, /valorPauta/, 'criarItemFiscal não precisa de campo extra de pauta');
});

test('N1: calcularImpostosItem repassa { importado } ao cálculo do ICMS', () => {
  const bloco = serviceSrc.match(/function calcularImpostosItem\(item, ufDest\) \{[\s\S]*?\n  \}/);
  assert.ok(bloco, 'calcularImpostosItem deve existir');
  assert.match(bloco[0], /calcularICMS\(\s*cfg, ufOrig, ufDest \|\| ufOrig,\s*parseFloat\(item\.vProd \|\| item\.total\) \|\| 0,\s*\{ importado: !!item\.importado \}\s*\)/);
});
