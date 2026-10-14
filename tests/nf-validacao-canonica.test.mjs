import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const cfgSrc = readFileSync('nf-config.js', 'utf8');
const valSrc = readFileSync('nf-validator.js', 'utf8');
const taxSrc = readFileSync('nf-tax-tables.js', 'utf8');
const itensSrc = readFileSync('nf-itens.js', 'utf8');
const natSrc = readFileSync('nf-naturezas.js', 'utf8');

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

function loadValidator() {
  const sb = { window: {} };
  vm.createContext(sb);
  vm.runInContext(`${extract(valSrc, 'ok')}; ${extract(valSrc, 'fail')}; ${extract(valSrc, 'merge')};`, sb);
  // validarCFOP do validator referencia window.NFTaxTables: injeta o canônico
  vm.runInContext(`window.NFTaxTables = { validarCFOP: ${extract(taxSrc, 'validarCFOP')} };`, sb);
  vm.runInContext(`${extract(valSrc, 'validarCNPJ')}; ${extract(valSrc, 'validarCPF')}; ${extract(valSrc, 'validarNCM')}; ${extract(valSrc, 'validarCFOP')};`, sb);
  return sb;
}

test('CNPJ/CPF: vetores conhecidos + acordo total entre config e validator', () => {
  const sb = loadValidator();
  // vetores válidos (dígitos verificadores conferidos à mão)
  assert.equal(sb.validarCNPJ('11.222.333/0001-81'), true);
  assert.equal(sb.validarCNPJ('11222333000181'), true);
  assert.equal(sb.validarCPF('529.982.247-25'), true);
  assert.equal(sb.validarCPF('52998224725'), true);
  // inválidos
  for (const bad of ['11111111111111', '00000000000000', '123', '', null, undefined, '11111111111', '00000000000', '12345678901']) {
    assert.equal(sb.validarCNPJ(bad), false, `CNPJ ${bad} inválido`);
  }
  assert.equal(sb.validarCPF('11111111111'), false);
  assert.equal(sb.validarCPF('00000000000'), false);
  assert.equal(sb.validarCPF('123'), false);
  // bateria de acordo: fallback local da config ≡ validator (inclui r==10 no CPF)
  const cnpjBase = ['11222333000181', '11222333000182', '00000000000191', '60701190000104', '99999999999999'];
  const cpfBase = ['52998224725', '52998224726', '00000000619', '00000000620', '12345678909', '11144477735'];
  const cfgSb = { window: {} };
  vm.createContext(cfgSb);
  vm.runInContext(`${extract(cfgSrc, 'validarCNPJ')}; ${extract(cfgSrc, 'validarCPF')};`, cfgSb);
  for (const v of [...cnpjBase, 'abc', '']) {
    assert.equal(cfgSb.validarCNPJ(v), sb.validarCNPJ(v), `CNPJ acordo em ${v}`);
  }
  for (const v of [...cpfBase, 'abc', '']) {
    assert.equal(cfgSb.validarCPF(v), sb.validarCPF(v), `CPF acordo em ${v}`);
  }
});

test('nf-config delega CNPJ/CPF ao NFValidator (canônico único)', () => {
  const cnpjBody = cfgSrc.slice(cfgSrc.indexOf('function validarCNPJ(cnpj)'), cfgSrc.indexOf('function validarCNPJ(cnpj)') + 500);
  assert.match(cnpjBody, /window\.NFValidator\.validarCNPJ\(cnpj\)/);
  const cpfBody = cfgSrc.slice(cfgSrc.indexOf('function validarCPF(cpf)'), cfgSrc.indexOf('function validarCPF(cpf)') + 500);
  assert.match(cpfBody, /window\.NFValidator\.validarCPF\(cpf\)/);
});

test('CFOP canônico: 1/2/3 e 5/6/7 passam; 4xxx/8xxx/9xxx reprovam', () => {
  const sb = loadValidator();
  for (const ok of ['1102', '2102', '3102', '5102', '6102', '7102', '5929', '1209']) {
    assert.equal(sb.validarCFOP(ok), true, `CFOP ${ok} válido`);
  }
  for (const bad of ['4102', '8102', '9102', '0102', '123', 'abcd', '', null, undefined, '51020']) {
    assert.equal(sb.validarCFOP(bad), false, `CFOP ${bad} inválido`);
  }
});

test('itens e naturezas usam o canônico (sem fallback divergente)', () => {
  assert.doesNotMatch(itensSrc, /\[1-9\]\\d\{3\}/, 'itens sem fallback largo');
  assert.doesNotMatch(natSrc, /\[1-9\]\\d\{3\}\$\/\.test\(r\.cfop\)/, 'naturezas sem fallback largo');
  assert.match(itensSrc, /NFValidator\?\.validarCFOP/);
  assert.match(natSrc, /NFValidator\?\.validarCFOP/);
});
