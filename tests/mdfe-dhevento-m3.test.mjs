import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const nfFunctions = readFileSync('functions/nf-functions.js', 'utf8');
const mdfeFunctions = readFileSync('functions/mdfe-functions.js', 'utf8');

function loadToFiscalDateTime() {
  const match = nfFunctions.match(/function toFiscalDateTime\(date = new Date\(\)\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'toFiscalDateTime não encontrada em functions/nf-functions.js');
  const context = {};
  vm.runInNewContext(`${match[0]}; this.toFiscalDateTime = toFiscalDateTime;`, context);
  return context.toFiscalDateTime;
}

test('MDF-e usa toFiscalDateTime no dhEvento (sem UTC rotulado -03:00)', () => {
  assert.match(mdfeFunctions, /<dhEvento>\$\{toFiscalDateTime\(\)\}<\/dhEvento>/);
  assert.doesNotMatch(
    mdfeFunctions,
    /toISOString\(\)\.replace\('Z', '-03:00'\)/,
    'dhEvento não pode rotular o horário UTC como -03:00 (produz 3h no futuro)',
  );
  assert.match(nfFunctions, /exports\.__mdfeInternals = \{[\s\S]*toFiscalDateTime,/);
  assert.match(mdfeFunctions, /^\s*toFiscalDateTime,$/m);
});

test('toFiscalDateTime converte UTC para -03:00 e nunca fica no futuro', () => {
  const toFiscalDateTime = loadToFiscalDateTime();
  assert.equal(toFiscalDateTime(new Date('2026-10-13T14:00:00.000Z')), '2026-10-13T11:00:00-03:00');
  assert.equal(toFiscalDateTime(new Date('2026-01-01T02:30:00.000Z')), '2025-12-31T23:30:00-03:00');
  const agora = toFiscalDateTime();
  assert.match(agora, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
  const diff = Date.parse(agora) - Date.now();
  assert.ok(diff <= 2000, `dhEvento não pode exceder o horário atual (diff=${diff}ms)`);
  assert.ok(diff > -5000, `dhEvento não pode estar muito defasado (diff=${diff}ms)`);
});

test('precedente NF-e permanece: eventos usam toFiscalDateTime', () => {
  const usos = nfFunctions.match(/const dhEvento = toFiscalDateTime\(\);/g) || [];
  assert.ok(usos.length >= 3, 'NF-e deve manter os 3 usos homologados de toFiscalDateTime');
});

test('encerramento 110112 envia eventoMDFe direto (sem envEventoMDFe) com evEncMDFe completo', () => {
  assert.match(mdfeFunctions, /const nProt = digits\(data\.nProt\);/);
  assert.match(mdfeFunctions, /\/\^\\d\{15\}\$\/\.test\(nProt\)/);
  assert.match(mdfeFunctions, /<descEvento>Encerramento<\/descEvento><nProt>\$\{nProt\}<\/nProt><dtEnc>\$\{dtEnc\}<\/dtEnc><cUF>\$\{cMunEnc\.slice\(0, 2\)\}<\/cUF><cMun>\$\{cMunEnc\}<\/cMun>/);
  assert.match(mdfeFunctions, /const payload = signedEvent;/, 'eventoMDFe direto (NFePHP sefazEvento)');
  assert.doesNotMatch(mdfeFunctions, /<envEventoMDFe/, 'wrapper gerava cStat 215 (element is not declared)');
  const js = readFileSync('mdf-e.js', 'utf8');
  // Cancelamento mantém o protocolo direto; encerramento (form e rápido)
  // passou a validar 15 dígitos antes de chamar a SEFAZ.
  assert.match(js, /nProt: mdfe\.protocolo \|\| ''/);
  assert.match(js, /nProt: nProtRapido,/);
  assert.match(js, /\^\\d\{15\}\$\/\.test\(nProt\)/);
  assert.match(js, /\^\\d\{15\}\$\/\.test\(nProtRapido\)/);
});
