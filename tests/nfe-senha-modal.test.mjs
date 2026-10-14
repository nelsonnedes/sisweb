import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const html = readFileSync('notas-fiscais.html', 'utf8');

test('sem resíduos: campos de senha inline removidos da NF-e', () => {
  for (const id of ['certSenhaBox', 'emissaoSenhaA1', 'btnConfirmarEmissao', 'nfCceSenha', 'nfRtcSenha', 'nfInutSenha']) {
    assert.doesNotMatch(html, new RegExp(`id="${id}"`), `campo residual: ${id}`);
  }
  // O upload do certificado (formulário próprio) permanece — não é prompt de operação
  assert.match(html, /id="certSenha"/);
});

test('emissão: senha via modal central (mesmo padrão do Consultar SEFAZ)', () => {
  assert.match(html, /async function liberarSenhaEmissao\(\)/);
  assert.match(
    html,
    /const senha = await solicitarSenhaA1NF\('Senha do certificado A1', \{\s*\n\s*message: 'Informe a senha do certificado A1 para emitir e transmitir a NF-e\.',\s*\n\s*confirmLabel: 'Emitir',\s*\n\s*\}\);\s*\n\s*if \(!senha\) return;\s*\n\s*ocultarAlertaEmissao\(\);\s*\n\s*await confirmarEmissao\(senha\);/,
  );
  assert.match(html, /async function confirmarEmissao\(senhaParam\) \{/);
  assert.match(html, /const senha = typeof senhaParam === 'string' \? senhaParam : '';/);
});

test('CC-e, RTC e Inutilização: senha via modal central com contexto próprio', () => {
  assert.match(html, /message: 'Informe a senha do certificado A1 para enviar a Carta de Correção \(CC-e\)\.',\s*\n\s*confirmLabel: 'Enviar CC-e',/);
  assert.match(html, /message: 'Informe a senha do certificado A1 para enviar o evento RTC à SEFAZ\.',\s*\n\s*confirmLabel: 'Enviar evento',/);
  assert.match(html, /message: 'Informe a senha do certificado A1 para enviar a inutilização à SEFAZ\.',\s*\n\s*confirmLabel: 'Enviar inutilização',/);
});

test('helper parametrizado (mensagem/rotulo nas duas vias)', () => {
  assert.match(html, /function solicitarSenhaA1NF\(titulo = 'Senha do certificado A1', opts = \{\}\)/);
  assert.match(html, /const mensagem = opts\.message \|\| 'Informe a senha do certificado A1 para consultar a SEFAZ\.';/);
  assert.match(html, /const rotuloOk = opts\.confirmLabel \|\| 'Consultar';/);
  assert.match(html, /message: mensagem,/);
  assert.match(html, /confirmLabel: rotuloOk,/);
  // Fallback autossuficiente também parametrizado
  assert.match(html, /p\.textContent = mensagem;/);
  assert.match(html, /const btnOk = mkBtn\(rotuloOk, true\);/);
});
