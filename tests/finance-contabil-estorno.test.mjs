import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const src = readFileSync('financas.js', 'utf8');

function extract(name) {
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

function loadMoney() {
  const sb = {};
  vm.createContext(sb);
  for (const fn of ['parseCurrencyValue', 'financeMoneyToCents', 'somarValoresCents', 'centsParaValor']) {
    vm.runInContext(extract(fn), sb);
  }
  return sb;
}

test('centavos: 0.1+0.2 fecha exato; pt-BR com milhar', () => {
  const sb = loadMoney();
  assert.equal(sb.somarValoresCents([0.1, 0.2]), 30);
  assert.equal(sb.centsParaValor(sb.somarValoresCents([0.1, 0.2])), 0.3);
  assert.equal(sb.financeMoneyToCents('1.234,56'), 123456);
  assert.equal(sb.financeMoneyToCents('10,01'), 1001);
  assert.equal(sb.financeMoneyToCents(undefined), 0);
  assert.equal(sb.somarValoresCents([10.01, 20.02, 30.03]), 6006);
});

test('totais e normalização usam o somador canônico (sem float solto)', () => {
  assert.match(src, /function somarValoresCents\(valores\)/);
  assert.match(src, /centsParaValor\(contasReceberPendentes\.reduce\(\(total, conta\) => \{/);
  assert.match(src, /centsParaValor\(contasPagarPendentes\.reduce\(\(total, conta\) => \{/);
  assert.match(src, /return total \+ financeMoneyToCents\(valorRestante\);/);
  assert.match(src, /const pagoCents = financeMoneyToCents\(valorPago\);/);
});

test('estorno cria contrapartida vinculada e preserva a original', () => {
  assert.match(src, /async function estornarConta\(id, tipo\)/);
  assert.match(src, /estornoDe: \{ tipo: normalizedType, id: String\(conta\.id\) \}/);
  assert.match(src, /await createFinanceAccountsAuthoritative\(inverso, \[inversa\]/);
  assert.match(src, /origem: 'estorno'/);
  assert.match(src, /Conta sem movimento — use Excluir em vez de Estornar/);
  const body = src.slice(src.indexOf('async function estornarConta('), src.indexOf('async function excluirConta('));
  assert.doesNotMatch(body, /financeDeleteAccount/, 'estorno nunca deleta');
  assert.match(src, /onclick="estornarConta\(\$\{accountIdArg\}, 'receber'\)"/);
  assert.match(src, /onclick="estornarConta\(\$\{accountIdArg\}, 'pagar'\)"/);
});

test('competência carimbada na criação/edição/estorno', () => {
  const matches = src.match(/dataCompetencia: /g) || [];
  assert.ok(matches.length >= 4, `esperava 4+ carimbos (achados: ${matches.length})`);
  assert.match(src, /dataCompetencia: normalizeDateISOInput\(dataEmissao\) \|\| dataParcela,/);
  assert.match(src, /dataCompetencia: contaOriginal\.dataCompetencia \|\| normalizeDateISOInput\(dataEmissao\) \|\| vencISO,/);
  assert.match(src, /dataCompetencia: hoje,/);
});
