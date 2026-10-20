import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/romaneio-numero.js', 'utf8');
const calls = [];
const sandbox = {
  SISWEB_ROMANEIO_SEQUENCE: true,
  firebaseService: {
    async callFunction(name, payload) {
      calls.push({ name, payload });
      return { success: true, numeroSequencial: 142, numeroFormatado: '000142' };
    },
  },
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const number = sandbox.SiswebRomaneioNumero;

test('formata número de seis dígitos com fallbacks', () => {
  assert.equal(number.formatar({ numeroFormatado: '000142' }), '000142');
  assert.equal(number.formatar({ numeroSequencial: 7 }), '000007');
  assert.equal(number.formatar({ numeroExibicao: 3 }), '000003');
  assert.equal(number.formatar({}), '');
});

test('reserva com operationId determinístico e reenvia idempotente', async () => {
  const record = { id: 'TL_1778178288808_8wfqvkkt5' };
  await number.aplicar('tl', record);
  assert.equal(record.numeroSequencial, 142);
  assert.equal(record.numeroFormatado, '000142');
  assert.equal(record.numeroExibicao, 142);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'romaneioReservarNumero');
  assert.equal(calls[0].payload.tipo, 'tl');
  assert.match(calls[0].payload.operationId, /^rom-tl-/);
  await number.aplicar('tl', record);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].payload.operationId, calls[0].payload.operationId);
});

test('sem flag não chama o backend', async () => {
  const sb = { SISWEB_ROMANEIO_SEQUENCE: false, firebaseService: { async callFunction() { throw new Error('não deveria chamar'); } } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(source, sb);
  const result = await sb.SiswebRomaneioNumero.aplicar('pct', { id: 'PCT_1' });
  assert.equal(result.numeroFormatado, undefined);
});

test('integração chama o número na criação dos cinco tipos', () => {
  const pctPage = fs.readFileSync('romaneiopct.html', 'utf8');
  assert.match(pctPage, /setCompanyClaim,\s*callFunction,/, 'PCT expõe callFunction no firebaseService global');
  const tl = fs.readFileSync('modules/romaneio/salvar-romaneio.js', 'utf8');
  assert.match(tl, /SiswebRomaneioNumero\.aplicar\('tl'/);
  assert.match(fs.readFileSync('romaneiopct-tabela.js', 'utf8'), /SiswebRomaneioNumero\.aplicar\('pct'/);
  assert.match(fs.readFileSync('romaneiopes.html', 'utf8'), /SiswebRomaneioNumero\.aplicar\('pes'/);
  assert.match(fs.readFileSync('romaneiotora_tabela.js', 'utf8'), /SiswebRomaneioNumero\.aplicar\('tora'/);
  assert.match(fs.readFileSync('preromaneio.js', 'utf8'), /SiswebRomaneioNumero\.aplicar\('pre_'/);
});

test('listas dos cinco tipos exibem o número formatado', () => {
  for (const file of ['modules/modals/modal-lista-romaneios.js', 'modules/romaneiopct/modal-lista-romaneios-pct.js', 'romaneiopes.html', 'romaneiotora_modais.js', 'preromaneio-modals.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /formatarNumeroExibicao/);
  }
});
