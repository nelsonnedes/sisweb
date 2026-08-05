import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function extractFunction(source, name) {
  return source.match(new RegExp(`function ${name}\\([\\s\\S]*?(?=\\nfunction |\\nasync function |$)`))?.[0] || '';
}

test('busca de tora normaliza acentos e agrega plaqueta, descrição, espécie e custódia', () => {
  const js = read('estoque.js');
  const normalizeSource = extractFunction(js, 'normalizarTextoBuscaEstoque');
  const searchableSource = extractFunction(js, 'obterTextoBuscaTora');
  const matchesSource = extractFunction(js, 'toraCorrespondeBusca');

  assert.ok(normalizeSource, 'normalizarTextoBuscaEstoque deve existir');
  assert.ok(searchableSource, 'obterTextoBuscaTora deve existir');
  assert.ok(matchesSource, 'toraCorrespondeBusca deve existir');

  const factory = new Function('normalizarCamposGeoEstoque', `
    ${normalizeSource}
    ${searchableSource}
    ${matchesSource}
    return { normalizarTextoBuscaEstoque, obterTextoBuscaTora, toraCorrespondeBusca };
  `);
  const helpers = factory(item => ({ custodia: item.custodia || item.custody || '' }));
  const tora = {
    plaqueta: 'ABC-123',
    descricaoTora: 'Peça Especial',
    especie: 'Angelim Vermelho',
    custodia: 'Pátio São José',
    localizacao: 'Lote 7'
  };

  assert.equal(helpers.normalizarTextoBuscaEstoque('  CUSTÓDIA  '), 'custodia');
  assert.equal(helpers.toraCorrespondeBusca(tora, 'abc-123'), true);
  assert.equal(helpers.toraCorrespondeBusca(tora, 'peca especial'), true);
  assert.equal(helpers.toraCorrespondeBusca(tora, 'ANGELIM'), true);
  assert.equal(helpers.toraCorrespondeBusca(tora, 'sao jose'), true);
  assert.equal(helpers.toraCorrespondeBusca(tora, 'inexistente'), false);
});

test('consulta, baixa individual e baixa por lote reutilizam a busca compartilhada', () => {
  const js = read('estoque.js');
  const html = read('estoque.html');
  const modal = extractFunction(js, 'carregarTorasDisponiveis');
  const individual = extractFunction(js, 'obterCandidatosPlaquetaSaida');
  const consulta = extractFunction(js, 'carregarTabelaEstoque');

  assert.match(modal, /toraCorrespondeBusca\(tora, especieFiltro\)/);
  assert.match(individual, /toraCorrespondeBusca\(t, filtro\)/);
  assert.match(consulta, /toraCorrespondeBusca\(t, filtro\.busca\)/);
  assert.match(individual, /normalizarTextoBuscaEstoque\(a\.plaqueta\)/);
  assert.match(html, /Plaqueta, descrição\/espécie ou custódia/);
  assert.match(html, /Espécie, descrição, plaqueta ou custódia/);
});

test('movimentações e rastreabilidade pesquisam a tora pelo mesmo contrato', () => {
  const js = read('estoque.js');
  const html = read('estoque.html');
  const movementSearch = extractFunction(js, 'obterTextoBuscaMovimentacao');
  const movementTable = extractFunction(js, 'carregarTabelaMovimentacoes');
  const movementFilters = extractFunction(js, 'filtrarMovimentacoes');
  const traceText = extractFunction(js, 'registroRastreabilidadeTexto');
  const traceFilter = extractFunction(js, 'filtrarRegistrosRastreabilidade');

  assert.match(html, /id="filtroBuscaToraMov"/);
  assert.match(html, /for="rastFiltroPlaqueta">Buscar tora:/);
  assert.match(movementSearch, /obterTextoBuscaTora\(mov\)/);
  assert.match(movementFilters, /buscaTora: document\.getElementById\('filtroBuscaToraMov'\)/);
  assert.match(movementTable, /obterTextoBuscaMovimentacao\(m\)\.includes\(buscaTora\)/);
  assert.match(traceText, /reg\.custodia/);
  assert.match(traceText, /reg\.descricaoTora/);
  assert.match(traceFilter, /registroRastreabilidadeTexto\(reg\)\.includes\(plaqueta\)/);
  assert.match(js, /buscaTora: filtroMovimentacoesAtual\.buscaTora/);
});

test('Romaneio Vinculado exibe número, pessoa e volume com fallback legado seguro', () => {
  const js = read('estoque.js');
  const html = read('estoque.html');
  const formatterSource = extractFunction(js, 'formatarRomaneiosVinculadosMovimentacao');

  assert.ok(formatterSource, 'formatarRomaneiosVinculadosMovimentacao deve existir');
  const factory = new Function(
    'normalizarRomaneiosRastreabilidade',
    'parseNumeroEstoque',
    'formatNumber',
    'escapeHtml',
    `${formatterSource}; return formatarRomaneiosVinculadosMovimentacao;`
  );
  const formatter = factory(
    lista => Array.isArray(lista) ? lista : [],
    value => Number(value) || 0,
    value => Number(value).toFixed(3).replace('.', ','),
    value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  );
  const mov = {
    romaneiosRelacionados: [{ numero: '000123', clienteNome: 'Cliente <Teste>', volumeSerraria: 12.345 }],
    observacoes: 'texto antigo'
  };

  assert.equal(formatter(mov, { plain: true }), 'Romaneio 000123 - Cliente <Teste> - 12,345 m³');
  assert.match(formatter(mov), /Cliente &lt;Teste&gt;/);
  assert.match(formatter(mov), /romaneio-vinculado-item/);
  assert.equal(formatter({ observacoes: 'Vínculo legado' }, { plain: true }), 'Vínculo legado');
  assert.match(js, /observacoes: formatarRomaneiosVinculadosMovimentacao\(mov, \{ plain \}\)/);
  assert.match(html, /\.romaneio-vinculado-item/);
});
