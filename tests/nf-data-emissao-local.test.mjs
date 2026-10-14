import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const html = readFileSync('notas-fiscais.html', 'utf8');

test('data de emissão padrão usa data LOCAL (nunca UTC — cStat 703 na virada de dia)', () => {
  assert.doesNotMatch(html, /dtEl\.value = new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(html, /preencherDataEmissaoPadraoNF[\s\S]{0,600}getTimezoneOffset\(\) \* 60000/);
});

test('coletor: hoje → instante atual com 60s de tolerância; sem meio-dia fixo futuro', () => {
  assert.doesNotMatch(html, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\);\s*\n\s*const dhEmiDate/);
  assert.match(html, /const hojeLocalIso = new Date\(agoraLocal\.getTime\(\) - agoraLocal\.getTimezoneOffset\(\) \* 60000\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.match(html, /dataInput === hojeLocalIso\s*\n\s*\? new Date\(agoraLocal\.getTime\(\) - 60000\)\.toISOString\(\)/);
});

test('fórmula local: 01:00Z (offset -180) → dia anterior local', () => {
  const contexto = {
    FakeDate: class extends Date {
      constructor(...args) {
        super(...(args.length ? args : ['2026-10-14T01:00:00.000Z']));
      }
      getTimezoneOffset() {
        return 180;
      }
    },
  };
  vm.runInNewContext(
    'const d = new FakeDate(); this.resultado = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);',
    contexto,
  );
  assert.equal(contexto.resultado, '2026-10-13', '01:00Z com offset -180 é 22:00 do dia 13 local');
});

test('builder NF-e: dhEmi/dhSaiEnt deslocam o instante para Brasília antes de rotular -03:00', () => {
  const builder = readFileSync('nf-xml-builder.js', 'utf8');
  assert.match(builder, /function toBrasiliaDateTime\(value\) \{/);
  assert.match(builder, /const dhEmi = toBrasiliaDateTime\(ide\.dhEmi\);/);
  assert.match(builder, /const dhSaiEnt = toBrasiliaDateTime\(ide\.dhSaiEnt\);/);
  assert.match(builder, /toBrasiliaDateTime\(ide\.dhEmi\)\.slice\(2, 7\)/);
  assert.doesNotMatch(
    builder,
    /new Date\(ide\.dhEmi\)\.toISOString\(\)\.replace\(\/\\\.\\d\{3\}Z\$\//,
    'nunca rotular UTC como -03:00 sem deslocar (cStat 703)',
  );
  const match = builder.match(/function toBrasiliaDateTime\(value\) \{[\s\S]*?\n  \}/);
  const contexto = {};
  vm.runInNewContext(`${match[0]}; this.toBrasiliaDateTime = toBrasiliaDateTime;`, contexto);
  const f = contexto.toBrasiliaDateTime;
  assert.equal(f('2026-10-14T01:04:05.987Z'), '2026-10-13T22:04:05-03:00');
  assert.equal(f('2026-10-13T12:00:00-03:00'), '2026-10-13T12:00:00-03:00', 'idempotente');
  assert.equal(f(''), '');
  assert.equal(f('ontem'), '');
  const saida = f('2026-10-14T01:00:00.000Z');
  assert.ok(Date.parse(saida) <= Date.parse('2026-10-14T01:00:00.000Z'), 'nunca no futuro vs instante de entrada');
});
