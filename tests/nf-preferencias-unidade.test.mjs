import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const prefs = read('nf-preferencias.js');
const nf = read('notas-fiscais.html');
const fn = read('functions/nf-functions.js');

test('Unidade Padrão persiste ao selecionar e aplica na emissão', () => {
  assert.match(prefs, /getElementById\('prefUnidadePadrao'\)\?\.addEventListener\('change'/);
  assert.match(prefs, /unidadePadrao: ev\.target\.value/);
  assert.match(prefs, /aplicarNaFormulario\(\)/);
  assert.doesNotMatch(prefs, /#2c3e50/, 'painel de preferências não deve ter cor fixa (deve usar tokens)');
});

test('Checkbox da Reforma Tributária não estica e é temático', () => {
  assert.match(nf, /\.form-group input\[type="checkbox"\]\s*\{[^}]*width:\s*18px/);
  assert.match(nf, /class="cfg-check-wrap"><input type="checkbox" id="cfgIbsCbsHabilitado"/);
  assert.match(nf, /class="cfg-check-wrap"><input type="checkbox" id="cfgIsHabilitado"/);
});

test('Consulta SEFAZ usa endpoint 4.00 (NfeConsulta4)', () => {
  assert.match(fn, /NfeConsultaProtocolo4:\s*'https:\/\/nfe-homologacao\.svrs\.rs\.gov\.br\/ws\/NfeConsulta\/NfeConsulta4\.asmx'/);
  assert.match(fn, /NfeConsultaProtocolo4:\s*'https:\/\/nfe\.svrs\.rs\.gov\.br\/ws\/NfeConsulta\/NfeConsulta4\.asmx'/);
  assert.doesNotMatch(fn, /NfeConsulta2\/NfeConsulta2\.asmx/);
});
