import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { planType, collect, pad } = require('../scripts/romaneios-numeracao-migrate.cjs');

function rec(id, extra = {}) {
  return { id, record: { id, ...extra }, path: `companies/t/romaneios/tl/${id}`, key: id, nodePath: 'romaneios/tl' };
}

test('preserva números únicos, preenche lacunas/ausentes e renumera duplicados', () => {
  const result = planType([
    rec('b', { numeroExibicao: 2 }),
    rec('a', { numeroExibicao: 1 }),
    rec('c', {}),
    rec('d', { numeroExibicao: 2 }),
  ], 'tl');
  assert.equal(result.max, 4);
  assert.deepEqual(result.changes.map(x => [x.id, x.numero, x.numeroFormatado]), [
    ['a', 1, '000001'],
    ['b', 2, '000002'],
    ['c', 3, '000003'],
    ['d', 4, '000004'],
  ]);
  assert.equal(result.duplicates.length, 1);
  assert.equal(result.duplicates[0].id, 'd');
});

test('não altera id, numero técnico nem caminho', () => {
  const item = rec('TL_1_abc', { numero: 'TL_1_abc', numeroExibicao: 7 });
  const change = planType([item], 'tl').changes[0];
  assert.equal(change.patch[`${item.path}/numeroSequencial`], 7);
  assert.equal(change.patch[`${item.path}/numeroFormatado`], '000007');
  assert.equal(change.patch[`${item.path}/legacyId`], 'TL_1_abc');
  assert.equal(change.patch[`${item.path}/id`], undefined);
  assert.equal(change.patch[`${item.path}/numero`], undefined);
});

test('deduplica espelhos canônico/legado por id', () => {
  const company = {
    romaneios: { tl: { x: { id: 'TL_1' } } },
    romaneiosTl: { x: { id: 'TL_1' } },
  };
  const result = collect(company, 'tenant', 'tl', ['romaneios/tl', 'romaneiosTl']);
  assert.equal(result.records.length, 1);
  assert.equal(result.warnings.length, 1);
  assert.equal(result.records[0].path, 'companies/tenant/romaneios/tl/x');
  assert.equal(result.records[0].aliases[0], 'companies/tenant/romaneiosTl/x');
});

test('pré-romaneio separa famílias pelo campo tipo e não inventa tipo ausente', () => {
  const company = {
    preromaneios: {
      a: { id: 'a', tipo: 'TL' },
      b: { id: 'b', tipo: 'PCT' },
      c: { id: 'c' },
    },
  };
  const tl = collect(company, 'tenant', 'pre_tl', ['preromaneios']);
  assert.equal(tl.records.length, 1);
  assert.equal(tl.records[0].id, 'a');
  assert.equal(collect(company, 'tenant', 'pre_pes', ['preromaneios']).records.length, 0);
});

test('padding de seis dígitos', () => {
  assert.equal(pad(142), '000142');
  assert.equal(pad(999999), '999999');
});