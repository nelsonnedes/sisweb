import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const nfFunctions = readFileSync('functions/nf-functions.js', 'utf8');
const nfStorage = readFileSync('nf-storage.js', 'utf8');
const nfService = readFileSync('nf-service.js', 'utf8');

function loadServerFn(name, args) {
  const match = nfFunctions.match(new RegExp(`function ${name}\\(${args}\\) \\{[\\s\\S]*?\\n\\}`));
  assert.ok(match, `${name} não encontrada`);
  const context = {};
  vm.runInNewContext(`${match[0]}; this.${name} = ${name};`, context);
  return context[name];
}

test('normalizeSerieFiscal: 0-999, default 1', () => {
  const norm = loadServerFn('normalizeSerieFiscal', 'raw');
  assert.equal(norm('1'), '1');
  assert.equal(norm('2'), '2');
  assert.equal(norm('001'), '1');
  assert.equal(norm(0), '0');
  assert.equal(norm(undefined), '1');
  assert.equal(norm(''), '1');
  assert.equal(norm('abc'), '1');
  assert.equal(norm('1000'), '1');
  assert.equal(norm('-1'), '1');
});

test('aplicarReservaNumero: incrementa, semeia série nova do legado, nunca regride', () => {
  const aplicar = loadServerFn('aplicarReservaNumero', 'current, seedProximo, nowIso');
  const now = '2026-10-14T12:00:00.000Z';
  const cont = aplicar({ proximoNumero: 1715, updatedAt: 'x' }, 1, now);
  assert.equal(cont.proximoNumero, 1716);
  const seed = aplicar(null, 1715, now);
  assert.equal(seed.proximoNumero, 1716);
  const seedObj = aplicar({}, 100, now);
  assert.equal(seedObj.proximoNumero, 101);
  const semSeed = aplicar(null, 1, now);
  assert.equal(semSeed.proximoNumero, 2);
});

test('backend reserva por série com seed do legado (só série 1)', () => {
  assert.match(nfFunctions, /numeros\/\$\{modKey\}\/\$\{serieKey\}/);
  assert.match(nfFunctions, /normalizeSerieFiscal\(rawSerie\)/);
  assert.match(nfFunctions, /serieKey === '1'/);
  assert.match(nfFunctions, /numeros\/\$\{modKey\}\/proximoNumero/);
  assert.match(nfFunctions, /serie: serieKey/);
});

test('cliente propaga a série e lê/escreve por série (com fallback legado)', () => {
  assert.match(nfStorage, /normalizarSerieContador/);
  assert.match(nfStorage, /nf_reservarNumero', \{ tenantId, modelo, serie: serieKey \}/);
  assert.match(nfStorage, /numeros\/\$\{modKey\}\/\$\{serieKey\}/);
  assert.match(nfStorage, /série 1 herda o contador legado/);
  assert.match(nfService, /incrementarNumero\(_tenantId, 55, nfeData\?\.ide\?\.serie\)/);
});
