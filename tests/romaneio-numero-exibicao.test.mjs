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
  assert.equal(formatarNumeroExibicao({ numeroExibicao: 4 }, 'PCT_x'), 'Nº 4');
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

test('vínculos continuam por id (display nunca vira chave)', () => {
  // obterIdEstavel segue id-first
  assert.ok(/romaneio\.id \|\| romaneio\.numero/.test(vendas), 'id estável id-first em vendas');
  // option values intactos (índice em vendas, id em compras/estoque)
  assert.ok(/opt\.value = String\(index\)/.test(vendas), 'vendas option por índice');
  assert.ok(/opt\.value = r\.id/.test(estoque), 'estoque saída por id');
});
