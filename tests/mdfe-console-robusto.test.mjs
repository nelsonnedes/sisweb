import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const js = readFileSync('mdf-e.js', 'utf8');
const service = readFileSync('nf-service.js', 'utf8');
const html = readFileSync('mdf-e.html', 'utf8');

test('console MDF-e: nenhum acesso cru a veiculo/condutor de registro legado', () => {
  assert.doesNotMatch(js, /mdfe\.veiculo\./, 'usar mdfe.veiculo?. ou defensiva em mdfeDamdfeConteudo');
  assert.doesNotMatch(js, /mdfe\.condutor\./, 'usar mdfe.condutor?. ou defensiva em mdfeDamdfeConteudo');
  assert.match(js, /const veiculo = m\.veiculo && typeof m\.veiculo === 'object' \? m\.veiculo : \{\};/);
  assert.match(js, /const condutor = m\.condutor && typeof m\.condutor === 'object' \? m\.condutor : \{\};/);
  assert.match(js, /const docs = Array\.isArray\(m\.documentos\) \? m\.documentos : \[\];/);
  assert.match(js, /const veiculoEdit = mdfe\.veiculo \|\| \{\};/);
  assert.match(js, /String\(mdfe\.veiculo\?\.placa \|\| ''\)\.toLowerCase\(\)/);
  assert.ok((js.match(/mdfe\.veiculo\?\.placa \|\| '-'/g) || []).length >= 2, 'select de encerramento + relatório');
  assert.match(js, /documentosFiscais = Array\.isArray\(mdfe\.documentos\) \? mdfe\.documentos\.map\(\(d\) => \(\{ \.\.\.d \}\)\) : \[\];/);
});

test('visualizarMdfe: abre preview do DAMDFE (registro incompleto não quebra)', () => {
  const bloco = js.match(/function visualizarMdfe\(id\) \{[\s\S]*?\n\}/);
  assert.ok(bloco, 'visualizarMdfe deve existir');
  assert.match(bloco[0], /mdfeAbrirPreviewDamdfe\(mdfe\)/);
  assert.doesNotMatch(bloco[0], /\$\{mdfe\.veiculo\./);
  assert.doesNotMatch(js, /notifyUser\(detalhes\)/, 'toast de texto substituído pelo preview');
});

test('mdf-e.html: mdfeSerie sem warning de autocomplete', () => {
  assert.match(html, /<input type="text" id="mdfeSerie" value="1" autocomplete="off">/);
});

test('nf-service: dataEmissao é a data LOCAL do emitente (não o slice UTC)', () => {
  assert.doesNotMatch(service, /dataEmissao: dhEmi\.slice\(0, 10\)/);
  assert.match(service, /dataEmissao: new Date\(new Date\(dhEmi\)\.getTime\(\) - 3 \* 60 \* 60 \* 1000\)\.toISOString\(\)\.slice\(0, 10\)/);
});
