import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const js = readFileSync('mdf-e.js', 'utf8');
const html = readFileSync('mdf-e.html', 'utf8');

test('senha A1 do MDF-e 100% no modal central pequeno (sem campos inline)', () => {
  for (const id of ['mdfeSenhaA1', 'mdfeSenhaA1Encerramento']) {
    assert.doesNotMatch(html, new RegExp(`id="${id}"`), `campo inline residual: ${id}`);
  }
  assert.match(js, /function mdfeSolicitarSenhaA1\(opts = \{\}\)/);
  assert.match(js, /window\.promptDialog\(\{\s*\n\s*title: 'Senha do certificado A1',\s*\n\s*message: mensagem,/);
  assert.match(js, /inputType: 'password',/);
  // 4 fluxos com contexto próprio
  assert.match(js, /message: 'Informe a senha do certificado A1 para emitir e transmitir o MDF-e\.',\s*\n\s*confirmLabel: 'Emitir',/);
  assert.match(js, /message: 'Informe a senha do certificado A1 para encerrar o MDF-e\.',\s*\n\s*confirmLabel: 'Encerrar MDF-e',/);
  assert.match(js, /message: 'Informe a senha do certificado A1 para encerrar o MDF-e\.',\s*\n\s*confirmLabel: 'Encerrar',/);
  assert.match(js, /message: 'Informe a senha do certificado A1 para consultar o MDF-e na SEFAZ\.',\s*\n\s*confirmLabel: 'Consultar',/);
  // Município do encerramento rápido também via modal (texto visível; fallback nativo documentado)
  assert.match(js, /await window\.promptDialog\(\{\s*\n\s*title: 'Encerrar MDF-e',\s*\n\s*message: 'Informe o município de encerramento:',[\s\S]{0,220}inputType: 'text',/);
  // Nenhum prompt nativo de SENHA restante
  assert.doesNotMatch(js, /window\.prompt\('Informe a senha/);
});

test('status: pill clicável com ícone e cor distinta por status (padrão NF-e)', () => {
  assert.match(js, /const MDFE_STATUS_MAP = \{/);
  assert.match(js, /rascunho:          \['🟡 Rascunho', 'warning'\]/);
  assert.match(js, /autorizado:        \['✅ Autorizado', 'success'\]/);
  assert.match(js, /encerrado:         \['🏁 Encerrado', 'brand'\]/);
  assert.match(js, /rejeitado:         \['❌ Rejeitado', 'danger'\]/);
  assert.match(js, /cancelado:         \['🚫 Cancelado', 'text-3'\]/);
  assert.match(js, /erro_envio:        \['⚠️ Erro envio', 'warning'\]/);
  assert.match(js, /erro_encerramento: \['⚠️ Erro encerr\.', 'warning'\]/);
  assert.match(js, /function mdfeStatusPill\(mdfe\)/);
  assert.match(js, /onclick="mdfeMostrarDetalheStatus\('\$\{escapeHtmlMdfe\(mdfe\.id\)\}'\)"/);
  assert.match(js, /background:color-mix\(in srgb, var\(--sw-\$\{tok\}\) 25%, transparent\);border:1px solid var\(--sw-\$\{tok\}\)/);
  assert.match(js, /<td data-label="Status">\$\{mdfeStatusPill\(mdfe\)\}<\/td>/);
  assert.doesNotMatch(js, /status-badge status-\$\{escapeHtmlMdfe\(mdfe\.status\)\}/);
});

test('ações: Clonar sempre disponível; Excluir só sem vínculo fiscal', () => {
  assert.match(js, /function clonarMdfe\(id\)/);
  assert.match(js, /function excluirMdfe\(id\)/);
  assert.match(js, /function __mdfePreencherFormularioDoRegistro\(mdfe\)/);
  // DRY: editar e clonar usam o MESMO preenchimento
  assert.equal((js.match(/__mdfePreencherFormularioDoRegistro\(mdfe\);/g) || []).length, 2);
  // Repõe também as UFs do percurso (campo novo p/ cStat 663)
  assert.match(js, /percEl\.value = Array\.isArray\(mdfe\.percursoUfs\)\s*\n\s*\? mdfe\.percursoUfs\.join\(', '\)\s*\n\s*: String\(mdfe\.percursoUfs \|\| ''\);/);
  assert.match(js, /mdfeEditando = null;\s*\n\s*document\.getElementById\('mdfeNumero'\)\.value = numeroAtualMdfe\.toString\(\)\.padStart\(9, '0'\);/);
  assert.match(js, /const permitidos = \['rascunho', 'rejeitado', 'erro_envio', 'erro_encerramento'\];/);
  assert.match(js, /svc\.removeFromFirebase\(`companies\/\$\{tenantIdMdfe\}\/fiscal\/mdfe\/\$\{id\}`\)/);
  assert.match(js, /if \(res && res\.success === false\) throw new Error\(res\.error \|\| 'Falha ao excluir no servidor\.'\);/);
  assert.match(js, /svc\.invalidateReadCacheForPath\?\.\(`companies\/\$\{tenantIdMdfe\}\/fiscal\/mdfe`\)/);
  // Botões no renderer
  assert.match(js, /onclick="clonarMdfe\('\$\{escapeHtmlMdfe\(mdfe\.id\)\}'\)"/);
  assert.match(js, /\$\{\['rascunho', 'rejeitado', 'erro_envio', 'erro_encerramento'\]\.includes\(String\(mdfe\.status\)\) \? `\s*\n\s*<button type="button" onclick="excluirMdfe/);
  assert.match(js, /window\.clonarMdfe = clonarMdfe;/);
  assert.match(js, /window\.excluirMdfe = excluirMdfe;/);
});
