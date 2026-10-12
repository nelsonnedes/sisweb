import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Lote 3: filtros alinhados, XML com leitura liberada, CC-e com histórico+PDF, cancel com loader.
const html = fs.readFileSync('notas-fiscais.html', 'utf8');
const danfe = fs.readFileSync('nf-danfe.js', 'utf8');
const rules = fs.readFileSync('storage.rules', 'utf8');

test('filtros da Consulta equalizados em 38px (escopo #consulta)', () => {
  assert.match(html, /#consulta \.form-group \.btn \{[^}]*height: 38px !important/, 'botões 38px com !important (vence global 36px)');
  assert.match(html, /#consulta #searchNF\.search-box/, 'busca no escopo');
  assert.match(html, /#consulta > \.form-row \{ align-items: center !important/, 'linha centralizada');
});

test('storage.rules: leitura fiscal só com vínculo; escrita mantém assinatura', () => {
  const bloco = rules.split('DOCUMENTOS FISCAIS')[1].split('CERTIFICADOS FISCAIS')[0];
  assert.match(bloco, /allow read:/, 'read separado');
  assert.match(bloco, /allow write:/, 'write separado');
  const readParte = bloco.split('allow write:')[0];
  assert.doesNotMatch(readParte, /subscriptionStatus/, 'read sem exigir assinatura');
  assert.match(bloco, /subscriptionStatus == 'active'/, 'write ainda exige assinatura');
});

test('modal CC-e lista histórico (eventos/cce + legado) com botão PDF por sequência', () => {
  assert.match(html, /carregarHistoricoCCeNF/, 'função de histórico presente');
  assert.match(html, /nf\?\.eventos\?\.cce/, 'lê eventos/cce');
  assert.match(html, /nf\?\.cartasCorrecao/, 'lê legado cartasCorrecao');
  assert.match(html, /baixarDACCE\('/, 'botão PDF por CC-e');
  assert.match(html, /window\.baixarDACCE = baixarDACCE/, 'baixarDACCE global');
});

test('DACC-e gerado com condição de uso oficial e exportado', () => {
  assert.match(danfe, /CCE_COND_USO/, 'texto MOC presente');
  assert.match(danfe, /Convênio S\/N, de 15 de dezembro de 1970/, 'fonte oficial citada');
  assert.match(danfe, /abrirDACCe,/, 'abrirDACCe exportado');
  assert.match(danfe, /gerarDACCe,/, 'gerarDACCe exportado');
});

test('cancelamento tem trava, loader e feedback robusto', () => {
  const fn = html.split('async function _iniciarCancelamentoComDados')[1].split('async function editarRascunho')[0];
  assert.match(fn, /__nfEventoInFlight = true/, 'trava anti-duplo-envio');
  assert.match(fn, /SiswebLoading\.show\('Cancelando NF-e/, 'loader durante transmissão');
  assert.match(fn, /Enviando cancelamento à SEFAZ/, 'toast de progresso');
  assert.match(fn, /__nfEventoFim\(null\)/, 'liberação garantida em finally');
  assert.match(fn, /data\?\.cancelada/, 'sem TypeError se data nula');
});
