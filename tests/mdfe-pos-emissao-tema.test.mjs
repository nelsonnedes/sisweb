import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const js = readFileSync('mdf-e.js', 'utf8');
const html = readFileSync('mdf-e.html', 'utf8');

function loadDamdfe() {
  const context = {
    window: {},
    document: { addEventListener() {}, getElementById: () => null },
    console: { log() {}, warn() {}, error() {} },
  };
  vm.runInNewContext(readFileSync('assets/vendor/qrcode-generator.js', 'utf8'), context);
  vm.runInNewContext(js, context);
  const internals = context.window.__mdfeDamdfeInternals;
  assert.ok(internals, '__mdfeDamdfeInternals deve existir');
  return internals;
}

test('pós-emissão: zera filtros antes de ir à Consulta (nº novo sempre visível)', () => {
  const bloco = js.match(/\/\/ Pós-autorização: limpa os filtros[\s\S]*?showTab\('consulta'\); \} catch \(\_\) \{\}/);
  assert.ok(bloco, 'bloco pós-autorização deve existir');
  assert.match(bloco[0], /buscaEl\.value = '';/);
  assert.match(bloco[0], /filtroEl\.value = '';/);
  assert.match(bloco[0], /try \{ consultarMdfes\(\); \} catch \(\_\) \{\}/);
});

test('tema: CSS padrão do sistema (sem bloco legado de botões)', () => {
  assert.match(html, /<link rel="stylesheet" href="ui-components\.css\?v=182b0b8037bb">/);
  assert.doesNotMatch(html, /\.btn-warning \{\s*\n\s*background-color: var\(--warning-color\);\s*\n\s*color: white;/);
  assert.doesNotMatch(html, /\.btn-primary \{\s*\n\s*background-color: var\(--primary-color\);\s*\n\s*color: white;/);
  assert.match(html, /\.btn-small \{/, 'btn-small (ausente no padrão) preservado');
});

test('ações: Encerrar em vermelho (paridade com Cancelar da NF-e)', () => {
  assert.match(js, /onclick="encerrarMdfeRapido\('\$\{escapeHtmlMdfe\(mdfe\.id\)\}'\)" class="btn btn-danger btn-small"/);
  assert.match(js, /onclick="editarMdfe\('\$\{escapeHtmlMdfe\(mdfe\.id\)\}'\)" class="btn btn-warning btn-small"/);
});

test('emitente: logo + texto alinhados em flex (sem float)', () => {
  const { mdfeDamdfeConteudo, mdfeDamdfeCss } = loadDamdfe();
  assert.match(mdfeDamdfeCss(), /\.damdfe-emit\{[^}]*display:flex/);
  assert.doesNotMatch(mdfeDamdfeCss(), /float:left/);
  const out = mdfeDamdfeConteudo(
    { numero: '20', veiculo: {}, documentos: [] },
    { name: 'E', cnpj: '1', logoSrc: 'https://x.test/l.png' },
  );
  const emit = out.match(/<div class="damdfe-emit">([\s\S]*?)<\/div><\/div>/);
  assert.ok(emit, 'bloco flex do emitente');
  assert.ok(emit[1].indexOf('<img') !== -1 && emit[1].indexOf('<img') < emit[1].indexOf('<div><strong>'));
});

test('preview/impressão: escopo claro imune ao tema', () => {
  const { mdfeDamdfeCss, mdfeDamdfeDocumento } = loadDamdfe();
  assert.match(mdfeDamdfeCss(), /\.damdfe-scope\{background:#fff;color:#000;color-scheme:light;\}/);
  const doc = mdfeDamdfeDocumento({ numero: '1', veiculo: {}, documentos: [] }, {});
  assert.match(doc, /<div class="damdfe-scope">/);
});
