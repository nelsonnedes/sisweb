import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const nfConfig = readFileSync('nf-config.js', 'utf8');
const nfFunctions = readFileSync('functions/nf-functions.js', 'utf8');
const html = readFileSync('notas-fiscais.html', 'utf8');

function loadFn(src, name, args, indentedClose) {
  const close = indentedClose ? '\\n  \\}' : '\\n\\}';
  const match = src.match(new RegExp(`function ${name}\\(${args}\\) \\{[\\s\\S]*?${close}`));
  assert.ok(match, `${name} não encontrada`);
  const context = {};
  vm.runInNewContext(`${match[0]}; this.${name} = ${name};`, context);
  return context[name];
}

test('avaliarPrazoEvento: matemática pura, sem lei embutida', () => {
  const avaliar = loadFn(nfConfig, 'avaliarPrazoEvento', 'autorizadaEmIso, limiteHoras, agoraMs', true);
  const agora = Date.parse('2026-10-14T12:00:00.000Z');
  const aut30h = new Date(agora - 30 * 3600000).toISOString();
  assert.deepEqual(avaliar(aut30h, 24, agora).excedido, true);
  assert.ok(Math.abs(avaliar(aut30h, 24, agora).decorridoHoras - 30) < 1e-9);
  assert.equal(avaliar(aut30h, null, agora).excedido, false);
  assert.equal(avaliar(aut30h, 0, agora).excedido, false);
  assert.equal(avaliar(aut30h, 48, agora).excedido, false);
  assert.equal(avaliar('invalida', 24, agora).semReferencia, true);
  assert.equal(avaliar('', 24, agora).semReferencia, true);
});

test('gêmea do backend sincronizada + config default sem bloqueio', () => {
  const server = loadFn(nfFunctions, 'avaliarPrazoEventoFiscal', 'autorizadaEmIso, limiteHoras, agoraMs');
  const agora = Date.parse('2026-10-14T12:00:00.000Z');
  const aut30h = new Date(agora - 30 * 3600000).toISOString();
  assert.equal(server(aut30h, 24, agora).excedido, true);
  assert.equal(server(aut30h, null, agora).excedido, false);
  assert.match(nfConfig, /cancNFeHoras: null,/);
  assert.match(nfConfig, /ccNFeHoras: null,/);
  assert.match(nfConfig, /PREENCHA conforme MOC\/NT vigente/);
});

test('backend bloqueia antes do PFX quando estourado (failed-precondition)', () => {
  assert.match(nfFunctions, /prazosFiscais\.cancNFeHoras/);
  assert.match(nfFunctions, /fiscal\/notas\/\$\{modKey\}\/\$\{nfId\}/);
  assert.match(nfFunctions, /PRAZO_EXCEDIDO: NF-e autorizada/);
  assert.match(nfFunctions, /'failed-precondition'/);
  const gatePos = nfFunctions.indexOf('PRAZO_EXCEDIDO');
  const pfxPos = nfFunctions.indexOf('descriptografarPFXdoStorage(tenantId, uid, senhaA1)', gatePos);
  assert.ok(gatePos >= 0 && pfxPos > gatePos, 'gate antes do PFX/SEFAZ');
});

test('cliente: pré-check antes da senha + decorrido na mensagem', () => {
  assert.match(html, /avaliarPrazoEvento\(notaPre\.dhAutorizacao \|\| notaPre\.dhRecbto, limitePre\)/);
  assert.match(html, /Prazo de cancelamento excedido \(autorizada/);
  assert.match(html, /para assinar o evento de cancelamento\.' \+ prazoInfoTxt/);
});
