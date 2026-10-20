import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

function extract(src, name) {
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

const enh = readFileSync(new URL('../romaneio-table-enhancements.js', import.meta.url), 'utf8');
const sb = {};
vm.createContext(sb);
vm.runInContext(extract(enh, 'numeroExibicaoValido'), sb);
vm.runInContext(extract(enh, 'proximoNumeroExibicao'), sb);
vm.runInContext(extract(enh, 'formatarNumeroExibicao'), sb);
const { numeroExibicaoValido, proximoNumeroExibicao, formatarNumeroExibicao } = sb;

test('numeroExibicaoValido: só inteiro positivo', () => {
  assert.equal(numeroExibicaoValido(3), 3);
  assert.equal(numeroExibicaoValido('7'), 7);
  assert.equal(numeroExibicaoValido(0), 0);
  assert.equal(numeroExibicaoValido(-2), 0);
  assert.equal(numeroExibicaoValido('PCT_123'), 0);
  assert.equal(numeroExibicaoValido(undefined), 0);
  assert.equal(numeroExibicaoValido(null), 0);
});

test('proximoNumeroExibicao: max+1, ignora legados', () => {
  assert.equal(proximoNumeroExibicao([]), 1);
  assert.equal(proximoNumeroExibicao([{ numeroExibicao: 1 }, { numeroExibicao: 2 }]), 3);
  assert.equal(proximoNumeroExibicao([{ id: 'PCT_123' }, { numeroExibicao: 5 }]), 6);
  assert.equal(proximoNumeroExibicao([{ numeroExibicao: 'Nº 4' }]), 1);
});

test('formatarNumeroExibicao: prefixo só no display, nunca gravado', () => {
  assert.equal(formatarNumeroExibicao({ numeroExibicao: 4 }, 'PCT_x'), 'Nº 000004');
  assert.equal(formatarNumeroExibicao({}, 'PCT_x'), 'PCT_x');
  assert.equal(formatarNumeroExibicao({ numeroExibicao: 0 }, 'TL_y'), 'TL_y');
});

const vendas = readFileSync(new URL('../vendas.js', import.meta.url), 'utf8');
const compras = readFileSync(new URL('../compras.js', import.meta.url), 'utf8');
const estoque = readFileSync(new URL('../estoque.js', import.meta.url), 'utf8');

test('saves atribuem numeroExibicao sem tocar nas chaves', () => {
  const pct = readFileSync(new URL('../romaneiopct-tabela.js', import.meta.url), 'utf8');
  assert.ok(/proximoNumeroExibicao/.test(pct), 'PCT atribui');
  const tl = readFileSync(new URL('../modules/romaneio/salvar-romaneio.js', import.meta.url), 'utf8');
  assert.ok(/proximoNumeroExibicao/.test(tl), 'TL atribui');
  assert.ok(/gerarIdRomaneio\(\)/.test(tl), 'TL mantém id TL_ timestamp');
  const tora = readFileSync(new URL('../romaneiotora_tabela.js', import.meta.url), 'utf8');
  assert.ok(/numeroExibicaoAnterior/.test(tora), 'Tora preserva em edição');
  assert.ok(/`TORA-\$\{timestamp\}`/.test(tora), 'Tora mantém id TORA- timestamp');
  const pesHtml = readFileSync(new URL('../romaneiopes.html', import.meta.url), 'utf8');
  assert.ok(/proximoNumeroExibicao\(romaneiosEdicaoBase\)/.test(pesHtml), 'PES atribui');
  // Nenhum save grava prefixo "Nº " (só display formata)
  for (const [nm, s] of [['pct', pct], ['tl', tl], ['tora', tora], ['pes', pesHtml]]) {
    assert.ok(!/numeroExibicao\s*=\s*[`'"]Nº/.test(s), `${nm}: sem prefixo gravado`);
  }
  for (const [nm, s] of [['pct', pct], ['tl', tl], ['tora', tora], ['pes', pesHtml]]) {
    assert.ok(/SISWEB_ROMANEIO_SEQUENCE !== true/.test(s), `${nm}: numeração local desativada no modo oficial`);
  }
  const numero = readFileSync(new URL('../js/romaneio-numero.js', import.meta.url), 'utf8');
  assert.ok(/current && root\.SISWEB_ROMANEIO_SEQUENCE !== true/.test(numero), 'modo oficial sempre reserva no servidor');
});

test('displays usam formatarNumeroExibicao com fallback legado', () => {
  assert.ok(/formatarNumeroExibicao/.test(vendas), 'vendas usa');
  assert.ok(/formatarNumeroExibicao/.test(compras), 'compras usa');
  assert.ok(/formatarNumeroExibicao/.test(estoque), 'estoque usa');
  // Módulo carregado nas páginas de venda/compra
  const vendasHtml = readFileSync(new URL('../vendas.html', import.meta.url), 'utf8');
  const comprasHtml = readFileSync(new URL('../compras.html', import.meta.url), 'utf8');
  assert.ok(/romaneio-table-enhancements\.js\?v=[0-9a-f]{12}/.test(vendasHtml), 'vendas carrega módulo');
  assert.ok(/romaneio-table-enhancements\.js\?v=[0-9a-f]{12}/.test(comprasHtml), 'compras carrega módulo');
});

test('financeiro e impressao exibem o numero sequencial sem trocar a chave tecnica', () => {
  const financas = readFileSync(new URL('../financas.js', import.meta.url), 'utf8');
  const modalTl = readFileSync(new URL('../modules/modals/modal-lista-romaneios.js', import.meta.url), 'utf8');
  const modalPct = readFileSync(new URL('../modules/romaneiopct/modal-lista-romaneios-pct.js', import.meta.url), 'utf8');
  assert.ok(/conta\.romaneioNumero/.test(financas), 'financeiro prioriza numero do romaneio');
  assert.ok(/documentoExibicao/.test(financas), 'financeiro usa o numero do romaneio na coluna de documento');
  assert.ok(/origem:\s*'romaneio_tl'[\s\S]{0,300}romaneioNumero/.test(modalTl), 'TL grava numero na conta');
  assert.ok(/origem:\s*'romaneio_pct'[\s\S]{0,300}romaneioNumero/.test(modalPct), 'PCT grava numero na conta');

  const printTl = readFileSync(new URL('../modules/reports/imprimir-romaneio.js', import.meta.url), 'utf8');
  const printPct = readFileSync(new URL('../modules/romaneiopct/imprimir-romaneio-pct.js', import.meta.url), 'utf8');
  const pes = readFileSync(new URL('../romaneiopes.html', import.meta.url), 'utf8');
  const toraManager = readFileSync(new URL('../romaneio-manager.js', import.meta.url), 'utf8');
  assert.ok(/numeroImpressaoRomaneio/.test(printTl), 'TL/Tora usam numero na impressao');
  assert.ok(/numeroSequencial: romaneio\.numeroSequencial/.test(printTl), 'Tora preserva numero ao carregar para impressao');
  assert.ok(/numeroImpressao/.test(printPct), 'PCT usa numero na impressao');
  assert.ok(/numeroFmtPesPrint/.test(pes), 'PES usa numero na impressao');
  assert.ok(/numeroFmt/.test(toraManager), 'Tora exibe numero na lista canonica');
  assert.ok(/function limparDescricaoRomaneioVendas/.test(vendas), 'Vendas limpa descricao tecnica');
  assert.ok(/function resolverRomaneioProduto/.test(vendas), 'Vendas resolve rotulo completo do romaneio');
  assert.ok(/numero: numeroRomaneioRegistro\(r\)/.test(vendas), 'Vendas grava numero oficial, nao chave tecnica');
});

test('vínculos continuam por id (display nunca vira chave)', () => {
  // obterIdEstavel segue id-first
  assert.ok(/romaneio\.id \|\| romaneio\.numero/.test(vendas), 'id estável id-first em vendas');
  // option values intactos (índice em vendas, id em compras/estoque)
  assert.ok(/opt\.value = String\(index\)/.test(vendas), 'vendas option por índice');
  assert.ok(/opt\.value = r\.id/.test(estoque), 'estoque saída por id');
});
