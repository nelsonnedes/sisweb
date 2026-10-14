import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

// Testes-ouro da geometria madeireira (4b do roadmap): travam o comportamento
// atual dos módulos canônicos SEM alterar call-sites. Qualquer unificação
// futura das cópias (romaneiotora/preromaneio/estoque) deve passar aqui.

const toraSrc = readFileSync('tora-geometry-utils.js', 'utf8');
const pctSrc = readFileSync('modules/romaneiopct/calculos-pct.js', 'utf8');

function extract(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, `função ${name} precisa existir`);
  const j = src.indexOf('{', i);
  let d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced ' + name);
}

function loadTora() {
  const sb = { window: {}, console };
  vm.createContext(sb);
  vm.runInContext('var window = this.window; var console = this.console;', sb);
  const toNumber = extract(toraSrc, 'toNumber');
  const smalian = extract(toraSrc, 'calcularVolumeGeoSmalian');
  vm.runInContext(`${toNumber}; ${smalian}; this.smalian = calcularVolumeGeoSmalian; this.toNumber = toNumber;`, sb);
  return sb;
}

function loadPct() {
  const sb = { console };
  vm.createContext(sb);
  vm.runInContext(`${extract(pctSrc, 'calcularVolumePCT')}; this.pct = calcularVolumePCT;`, sb);
  return sb;
}

test('Smalian: tora afunilada 500cm base-40 topo-30 = 0.490874 m³', () => {
  const sb = loadTora();
  const v = sb.smalian(500, 40, 40, 30, 30);
  assert.ok(Math.abs(v - 0.490874) < 1e-6, `Smalian deu ${v}`);
});

test('Smalian: cilindro perfeito = π·r²·h; zeros e inválidos = 0', () => {
  const sb = loadTora();
  const v = sb.smalian(850, 225, 225, 225, 225);
  const esperado = Math.PI * Math.pow(2.25 / 2, 2) * 8.5;
  assert.ok(Math.abs(v - esperado) < 1e-9, `cilindro deu ${v}, esperado ${esperado}`);
  assert.equal(sb.smalian(0, 40, 40, 30, 30), 0);
  assert.equal(sb.smalian(500, 0, 0, 0, 0), 0);
  assert.equal(sb.smalian('', 'a', null, undefined, ''), 0);
  // vírgula pt-BR no toNumber
  assert.equal(sb.toNumber('2,5'), 2.5);
});

test('PCT canônico: 300×15×2.5cm ×10 ×ppp1 ≈ 0.1125 m³; ppp2 dobra', () => {
  const sb = loadPct();
  assert.ok(Math.abs(sb.pct(300, 15, 2.5, 10, 1) - 0.1125) < 1e-9);
  assert.ok(Math.abs(sb.pct(300, 15, 2.5, 10, 2) - 0.225) < 1e-9);
  assert.ok(Math.abs(sb.pct(300, 15, 2.5, 10, { valido: true, valor: 2 }) - 0.225) < 1e-9);
  assert.equal(sb.pct(0, 15, 2.5, 10, 1), 0);
  assert.equal(sb.pct('a', 15, 2.5, 10, 1), 0);
});

test('módulos canônicos referenciados (mapa do 4b)', () => {
  assert.match(toraSrc, /window\.ToraGeometry = \{/);
  assert.match(pctSrc, /function calcularVolumePCT\(comprimento, largura, espessura, quantidade, pecasPorPacote\)/);
});
