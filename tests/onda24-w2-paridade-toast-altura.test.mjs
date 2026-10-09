import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Onda 24: W2 (cache writePath) + paridade resumo vendas + toast baixa +
// altura uniforme dos campos PCT/TL/PES.
const svc = readFileSync('firebaseService.js', 'utf8');
const vendas = readFileSync('vendas.js', 'utf8');
const financas = readFileSync('financas.js', 'utf8');
const pct = readFileSync('romaneiopct.html', 'utf8');
const tl = readFileSync('romaneiotl.html', 'utf8');
const pes = readFileSync('romaneiopes.html', 'utf8');

test('W2: writePath com cache+TTL e derrubada em erro', () => {
  assert.match(svc, /const writePathCache = new Map\(\)/);
  assert.match(svc, /WRITE_PATH_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(svc, /getCachedWritePath\(path\)/);
  assert.match(svc, /setCachedWritePath\(path, writePath\)/);
  assert.match(svc, /dropCachedWritePath\(path\)/);
});

test('paridade vendas: resumo desmarcável + detalhado por categoria', () => {
  assert.match(vendas, /TORA: o resumo é opcional/);
  assert.match(vendas, /modoAgrupamento === 'nenhum' && !ehToraDims/);
  assert.match(vendas, /Detalhado por categoria \(TORA sem resumo\)/);
  assert.match(vendas, /romaneio_det_/);
  const decls = vendas.match(/const (listaBrutaDims|ehToraDims) =/g) || [];
  assert.equal(decls.length, 2, 'listaBrutaDims/ehToraDims declarados 1x cada');
});

test('finanças: mensagem de regra do servidor vai ao toast', () => {
  assert.match(financas, /exibir o texto real em vez do genérico/);
  assert.match(financas, /showBusiness/);
  assert.match(financas, /network request failed/);
});

test('PCT/TL/PES: campos do formulário com altura uniforme 38px', () => {
  for (const [nome, src, ids] of [
    ['pct', pct, ['#comprimento', '#quantidade', '#pecasPorPacote', '#preRomaneioSelect']],
    ['tl', tl, ['#comprimento', '#largura', '#quantidade', '#preRomaneioSelect']],
    ['pes', pes, ['#comprimento', '#quantidade', '#pecasPorPacote', '#preRomaneioSelect']],
  ]) {
    const i = src.indexOf('Uniformizar altura dos campos');
    assert.ok(i !== -1, `bloco ausente: ${nome}`);
    const bloco = src.slice(i, i + 600);
    for (const id of ids) assert.ok(bloco.includes(id), `${nome}: ${id} ausente`);
    assert.match(bloco, /height: 38px !important/);
  }
});
