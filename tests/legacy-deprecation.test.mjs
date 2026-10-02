import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function buildSandbox({ silent = false } = {}) {
  const warnings = [];
  const sandbox = {
    console: { warn(m) { warnings.push(String(m)); } },
    SISWEB_LEGACY_SILENT: silent,
    window: null,
    setTimeout, clearTimeout
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  return { sandbox, warnings };
}

function install(sandbox, src) {
  vm.runInContext(src, sandbox);
}

const SRC = read('modules/core/legacy-deprecation.js');

test('trap preserva semântica: leitura devolve impl vigente + avisa', async () => {
  const { sandbox, warnings } = buildSandbox();
  sandbox.getData = async (k) => ({ ok: k });
  install(sandbox, SRC);
  const fn = sandbox.getData;
  assert.equal(typeof fn, 'function');
  assert.deepEqual(await fn('x'), { ok: 'x' });
  assert.ok(warnings.length >= 1, 'esperado warn na leitura');
  assert.ok(warnings[0].includes('SiswebData.get'), 'warn deve apontar o substituto');
});

test('trap preserva escrita: sobrescrita troca impl + avisa com local', () => {
  const { sandbox, warnings } = buildSandbox();
  sandbox.getData = () => 'legado-a';
  install(sandbox, SRC);
  sandbox.getData = () => 'legado-b';
  assert.equal(sandbox.getData(), 'legado-b');
  assert.ok(warnings.some((w) => w.includes('sobrescrita')), 'esperado warn de sobrescrita');
});

test('throttle: 1 warn por local chamador, comportamento intacto após teto', () => {
  const { sandbox, warnings } = buildSandbox();
  sandbox.saveData = (k, d) => ({ k, d });
  install(sandbox, SRC);
  for (let i = 0; i < 60; i++) void sandbox.saveData;
  assert.ok(warnings.length <= 26, `teto de warns respeitado, obtido ${warnings.length}`);
  assert.deepEqual(sandbox.saveData('a', 1), { k: 'a', d: 1 });
  const s = sandbox.__siswebLegacy.stats();
  assert.equal(s.reads, 61);
});

test('stats contabilizam leituras e sobrescritas', () => {
  const { sandbox } = buildSandbox();
  install(sandbox, SRC);
  sandbox.getData = () => 1;
  void sandbox.getData;
  void sandbox.getData;
  const s = sandbox.__siswebLegacy.stats();
  assert.equal(s.overwrites, 1);
  assert.ok(s.reads >= 2);
  assert.ok(Object.keys(s.locations).length >= 1);
});

test('opt-out SISWEB_LEGACY_SILENT pula instalação sem quebrar', () => {
  const { sandbox, warnings } = buildSandbox({ silent: true });
  sandbox.getData = () => 'x';
  install(sandbox, SRC);
  assert.equal(sandbox.getData(), 'x');
  assert.equal(warnings.length, 0);
  assert.equal(sandbox.__siswebLegacyTrapInstalled, true);
});

test('stats expoe sucesso da instalação (trapped)', () => {
  const { sandbox } = buildSandbox();
  install(sandbox, SRC);
  const s = sandbox.__siswebLegacy.stats();
  assert.equal(s.trapped.getData, true);
  assert.equal(s.trapped.saveData, true);
});

test('idempotente: dupla inclusão não reinstala nem duplica warns', () => {
  const { sandbox, warnings } = buildSandbox();
  sandbox.getData = () => 'x';
  install(sandbox, SRC);
  install(sandbox, SRC);
  void sandbox.getData;
  assert.ok(warnings.length <= 2, `sem duplicação, obtido ${warnings.length}`);
});
