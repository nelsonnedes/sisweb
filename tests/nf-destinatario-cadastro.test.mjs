import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Destinatário: povoado completo do cadastro + campos fiscais visíveis.
// Regressão (prints): "Contribuinte ICMS" não vinha do cadastro; IE/CEP/N°/
// Bairro não existiam no form; helper do transporte colado (margin negativo).
const html = fs.readFileSync('notas-fiscais.html', 'utf8');

test('campos fiscais do destinatário existem (IE, CEP, N°, Bairro, Cód. IBGE)', () => {
  assert.match(html, /id="nfClienteIE"/, 'IE');
  assert.match(html, /id="nfClienteCep"/, 'CEP');
  assert.match(html, /id="nfClienteNumero"/, 'N°');
  assert.match(html, /id="nfClienteBairro"/, 'Bairro');
  assert.match(html, /id="nfClienteCodMun"/, 'Cód. IBGE');
  assert.match(html, /id="nfIndIEDest"/, 'Contribuinte ICMS');
});

test('handler unificado povoа tudo do cadastro incluindo indIEDest', () => {
  assert.match(html, /function nfAoSelecionarCliente\(\)/, 'função unificada');
  assert.match(html, /v\('indIEDest', 'indicadorInscricaoEstadual', 'ieIndicator'\)/, 'lê indIEDest do cadastro');
  assert.match(html, /selInd\.value = indCadastro/, 'aplica indIEDest do cadastro');
  assert.match(html, /remember|set\('nfClienteIE', ie \|\| ''\)/, 'seta IE');
  assert.match(html, /set\('nfClienteNumero', v\('numero', 'number'\) \|\| dset\('numero'\)\)/, 'seta N°');
  assert.match(html, /set\('nfClienteBairro', v\('bairro', 'neighborhood'\)/, 'seta Bairro');
  assert.match(html, /onchange="nfAoSelecionarCliente\(\)"/, 'select usa o handler');
});

test('carregarClientesNF: datasets completos e onchange unificado', () => {
  assert.match(html, /opt\.dataset\.indIEDest = c\.indIEDest \|\| c\.indicadorInscricaoEstadual/, 'dataset indIEDest');
  assert.match(html, /opt\.dataset\.ie = c\.ie \|\| c\.inscricaoEstadual \|\| c\.stateRegistration/, 'dataset IE');
  assert.match(html, /opt\.dataset\.numero = c\.numero \|\| c\.number/, 'dataset numero');
  assert.match(html, /select\.onchange = function\(\) \{ nfAoSelecionarCliente\(\); \}/, 'onchange delega');
});

test('montarDestFromForm usa campos dedicados (sem split de string)', () => {
  assert.match(html, /logradouro: document\.getElementById\('nfClienteEndereco'\)\?\.value\.trim\(\)/, 'logradouro dedicado');
  assert.match(html, /numero:     document\.getElementById\('nfClienteNumero'\)\?\.value\.trim\(\)/, 'numero dedicado');
  assert.match(html, /bairro:     document\.getElementById\('nfClienteBairro'\)\?\.value\.trim\(\)/, 'bairro dedicado');
  assert.match(html, /codigoMunicipio: document\.getElementById\('nfClienteCodMun'\)\?\.value\.trim\(\)/, 'código IBGE dedicado');
  assert.doesNotMatch(html, /nfClienteEndereco'\)\?\.value\.split\(','\)/, 'sem parse de logradouro,número');
});

test('editarRascunho restaura os campos fiscais do destinatário', () => {
  assert.match(html, /set\('nfClienteIE',\s*dest\.ie \|\| ''\)/, 'IE no restore');
  assert.match(html, /set\('nfClienteNumero',\s*dest\.endereco\?\.numero \|\| ''\)/, 'N° no restore');
  assert.match(html, /set\('nfIndIEDest',\s*dest\.indIEDest != null \? String\(dest\.indIEDest\) : '9'\)/, 'indIEDest no restore');
});

test('transporte: helper text sem margin-top negativo (não cola nos campos)', () => {
  assert.match(html, /\.nf-help-text\s*\{[^}]*margin:\s*2px 0 12px/s, 'sem -4px');
  assert.doesNotMatch(html, /\.nf-help-text\s*\{[^}]*margin:\s*-4px/s, 'sem margin negativo');
  assert.match(html, /#nfReboquesLista:not\(:empty\) \+ \.nf-help-text\s*\{[^}]*margin-top:\s*10px/s, 'espaço após lista de reboques');
});
