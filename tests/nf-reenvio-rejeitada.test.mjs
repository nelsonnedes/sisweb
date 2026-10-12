import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Reenvio de rejeitada/erro_envio: editar + corrigir + reemitir com o MESMO
// número (sem vínculo na SEFAZ — sem protocolo de autorização). Só rascunho,
// rejeitada e erro_envio têm botão Editar; autorizada/cancelada/inutilizada/
// aguardando nunca.
const html = fs.readFileSync('notas-fiscais.html', 'utf8');
const svc = fs.readFileSync('nf-service.js', 'utf8');

test('botão Editar existe para rascunho, rejeitada e erro_envio (não só rascunho)', () => {
  assert.match(html, /\['rascunho','rejeitada','erro_envio'\]\.includes\(n\.status\) \? `<button class="btn btn-warning btn-small" onclick="editarRascunho\('/);
  assert.match(html, /title="\$\{n\.status==='rascunho' \? 'Editar' : 'Corrigir e reenviar'\}"/, 'rótulo explica o reenvio');
});

test('autorizada/cancelada/inutilizada/aguardando NÃO têm botão Editar', () => {
  const btnLine = html.split('\n').find((l) => l.includes("title=\"${n.status==='rascunho'"));
  assert.ok(btnLine, 'linha do botão encontrada');
  assert.doesNotMatch(btnLine, /autorizada|cancelada|inutilizada|aguardando/, 'só os 3 status editáveis');
});

test('editarRascunho barra status com vínculo fiscal mesmo se chamado direto', () => {
  assert.match(html, /if \(modo === 'editar' && !\['rascunho', 'rejeitada', 'erro_envio'\]\.includes\(stEdit\)\)/, 'trava fail-closed');
  assert.match(html, /só rascunho, rejeitada ou erro de envio/, 'mensagem orienta a clonar');
});

test('reenvio reaproveita id + número (não consome numeração nova)', () => {
  assert.match(html, /Reenvio de rejeitada\/erro_envio: preserva id \+ número/, 'pré-montagem preserva');
  assert.match(html, /_notaEmCurso\.numero = orig\.numero/, 'número reaproveitado');
  assert.match(svc, /reaproveita o MESMO número quando for reenvio/, 'service não reserva número no reenvio');
  assert.match(svc, /stReenvio === 'rejeitada' \|\| stReenvio === 'erro_envio'/, 'condição de reenvio');
});

test('edição de rejeitada recalcula IBSCBS neutro (caso 1115)', () => {
  assert.match(html, /Recarregar itens \(recalcula IBSCBS neutro se o item legado não tinha/, 'fallback na carga');
  assert.ok(html.includes('calcularIBSCBS?.(cfg0, tot0)'), 'recalcula pela config atual');
});

test('mensagem pós-edição orienta sobre o reenvio (cStat + motivo)', () => {
  assert.match(html, /Corrija e clique em Emitir — mesmo número, sem vínculo na SEFAZ/, 'mensagem de reenvio');
  assert.match(html, /cStat \$\{nf\.cStat \|\| '\?'\}/, 'mostra o cStat da rejeição');
});
