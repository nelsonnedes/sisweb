import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const funcs = readFileSync('functions/mdfe-functions.js', 'utf8');
const nfFuncs = readFileSync('functions/nf-functions.js', 'utf8');
const funcsIndex = readFileSync('functions/index.js', 'utf8');
const js = readFileSync('mdf-e.js', 'utf8');

test('backend: mdfe_cancelar espelha o encerramento (evento 110111 direto)', () => {
  assert.match(funcs, /exports\.mdfe_cancelar = onMdfeCall\(async \(data, context\) => \{/);
  assert.match(funcs, /const eventId = `ID110111\$\{key\}\$\{sequence\.slice\(-2\)\}`;/);
  assert.match(funcs, /<tpEvento>110111<\/tpEvento>/);
  assert.match(
    funcs,
    /<detEvento versaoEvento="3\.00"><evCancMDFe><descEvento>Cancelamento<\/descEvento><nProt>\$\{nProt\}<\/nProt><xJust>\$\{escapeXml\(xJust\)\}<\/xJust><\/evCancMDFe><\/detEvento>/,
  );
  assert.doesNotMatch(funcs, /<envEventoMDFe/, 'wrapper gerava cStat 215 (como no encerramento)');
  assert.match(funcs, /if \(!\/\^\\d\{15\}\$\/\.test\(nProt\)\) throw httpsError\('invalid-argument', 'Protocolo de autorização/);
  assert.match(funcs, /if \(xJust\.length < 15\) throw httpsError\('invalid-argument', 'Justificativa do cancelamento/);
  assert.match(funcs, /status: result\.autorizada \? 'cancelado' : 'erro_cancelamento'/);
  assert.match(funcs, /protocoloCancelamento: result\.nProt/);
  assert.match(funcs, /return \{ cancelado: result\.autorizada, cStat: result\.cStat, xMotivo: result\.xMotivo, protocolo: result\.nProt \};/);
  assert.match(funcs, /status: 'erro_cancelamento', erroMsg: error\.message/);
  assert.match(
    funcs,
    /postSefaz\(MDFe_ENDPOINTS\[env\]\.MDFeRecepcaoEvento, mdfeSoap\('MDFeRecepcaoEvento', payload, key\.slice\(0, 2\)\), pfx, senhaA1, mdfeSoapAction\('MDFeRecepcaoEvento'\)\)/,
  );
});
test('backend: escapeXml compartilhado com o MDF-e (xJust com acento não quebra XML)', () => {
  assert.match(nfFuncs, /^\s*escapeXml,$/m);
  assert.match(funcs, /^\s*escapeXml,$/m);
});

test('backend: callable re-exportada no index (sem isso o deploy não a enxerga)', () => {
  assert.match(funcsIndex, /exports\.mdfe_cancelar = mdfeFunctions\.mdfe_cancelar;/);
});

test('frontend: botão Cancelar + fluxo com justificativa (MOC ≥15)', () => {
  assert.match(
    js,
    /onclick="cancelarMdfe\('\$\{escapeHtmlMdfe\(mdfe\.id\)\}'\)" class="btn btn-danger btn-small" title="Cancelar MDF-e"/,
  );
  assert.match(js, /\$\{\['autorizado', 'erro_cancelamento'\]\.includes\(String\(mdfe\.status\)\) \? `\s*\n\s*<button type="button" onclick="cancelarMdfe\('/);
  assert.match(js, /async function cancelarMdfe\(id\)/);
  assert.match(js, /Justificativa do cancelamento \(mín\. 15 caracteres\)/);
  assert.match(js, /if \(String\(justificativa\)\.trim\(\)\.length < 15\)/);
  assert.match(js, /callFunction\('mdfe_cancelar', \{/);
  assert.match(js, /nProt: mdfe\.protocolo \|\| '',\s*\n\s*xJust: String\(justificativa\)\.trim\(\),/);
  assert.match(js, /mdfe\.status = 'cancelado';/);
  assert.match(js, /mdfe\.protocoloCancelamento = result\.protocolo \|\| '';/);
  assert.match(js, /window\.cancelarMdfe = cancelarMdfe;/);
  assert.match(js, /label: '🚫 Cancelar MDF-e', onclick: \(\) => \{ try \{ document\.getElementById\('mdfeStatusDetalheModal'\)/);
});

test('cancelado: pill existe; exclusão segue vedada (documento fiscal)', () => {
  assert.match(js, /cancelado:.*Cancelado/);
  assert.doesNotMatch(js, /'rascunho', 'rejeitado', 'erro_envio', 'erro_encerramento', 'cancelado'/);
  assert.match(js, /const permitidos = \['rascunho', 'rejeitado', 'erro_envio', 'erro_encerramento'\];/);
});
