import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const itensSrc = readFileSync('nf-itens.js', 'utf8');
const validatorSrc = readFileSync('nf-validator.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

function loadItens() {
  const context = { window: {}, console: { log() {}, warn() {}, error() {} } };
  vm.runInNewContext(itensSrc, context);
  const api = context.window.NFItens;
  assert.ok(api, 'NFItens deve existir em nf-itens.js');
  return api;
}

const ERRO_GENERICO = 'NCM 00000000 é genérico — informe o NCM real da mercadoria';

test('P3: validarNCM recusa o genérico 00000000 e mantém NCM real válido', () => {
  const { validarNCM } = loadItens();
  assert.deepEqual({ ...validarNCM('00000000') }, { valid: false, erro: ERRO_GENERICO });
  assert.deepEqual({ ...validarNCM('000000000') }, { valid: false, erro: 'NCM deve ter 8 dígitos' });
  assert.deepEqual({ ...validarNCM('123') }, { valid: false, erro: 'NCM deve ter 8 dígitos' });
  assert.deepEqual({ ...validarNCM('') }, { valid: false, erro: 'NCM deve ter 8 dígitos' });
  assert.deepEqual({ ...validarNCM(' 00-000.000 ') }, { valid: false, erro: ERRO_GENERICO });
  assert.deepEqual({ ...validarNCM('44071100') }, { valid: true });
  assert.deepEqual({ ...validarNCM(' 44.071-100 ') }, { valid: true });
});

test('P3: validarEntradaItem bloqueia item com NCM genérico (manual/cadastrado/edição)', () => {
  const { validarEntradaItem } = loadItens();
  const base = { nome: 'Madeira', qtd: 1, vUnit: 10, cfop: '5102' };
  assert.deepEqual({ ...validarEntradaItem({ ...base, ncm: '00000000' }) }, { valid: false, erro: ERRO_GENERICO });
  assert.deepEqual({ ...validarEntradaItem({ ...base, ncm: '44071100' }) }, { valid: true });
  assert.equal(validarEntradaItem({ ...base, ncm: '4407110' }).erro, 'NCM deve ter 8 dígitos');
});

test('P3: validador de emissão recusa NCM genérico com mensagem orientativa', () => {
  assert.match(validatorSrc, /function validarNCM\(ncm\) \{[\s\S]*?return !\/\^0\+\$\/\.test\(n\);/);
  assert.match(validatorSrc, /NCM 00000000 é genérico — informe o NCM real da mercadoria/);
  assert.match(validatorSrc, /^\s+validarNCM,$/m, 'validarNCM deve seguir exportado pela API do validador');
  // Sem inventar TIPI: apenas o placeholder é bloqueado — NCM estruturalmente
  // válido (8 dígitos, não nulo) passa, pois a base oficial não é vendorizada.
  const context = { window: {}, console: { log() {}, warn() {}, error() {} } };
  vm.runInNewContext(validatorSrc, context);
  const V = context.window.NFValidator;
  assert.equal(V.validarNCM('00000000'), false);
  assert.equal(V.validarNCM('99999999'), true, 'validação estrutural não inventa base TIPI');
  assert.equal(V.validarNCM('44071100'), true);
});

test('P3: UI usa o validador central (edição e fallbacks dos dois modos)', () => {
  assert.match(html, /window\.NFItens\?\.validarNCM \? window\.NFItens\.validarNCM\(ncm\)/);
  const fallbacks = html.match(/!\/\^0\{8\}\$\/\.test\(ncm\)/g) || [];
  assert.ok(fallbacks.length >= 3, `fallbacks sem checagem de genérico: ${fallbacks.length}`);
  assert.match(itensSrc, /^    validarNCM,$/m);
});
