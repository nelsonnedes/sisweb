import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const functions = fs.readFileSync('functions/index.js', 'utf8');
const menu = fs.readFileSync('menu-component.js', 'utf8');
const auth = fs.readFileSync('auth.js', 'utf8');

test('suporte: backend persiste ticketId na notificação do tenant', () => {
  assert.match(functions, /const ticketId = sanitizeText\(payload && payload\.ticketId/);
  assert.match(functions, /if \(ticketId\) item\.ticketId = ticketId;/);
  assert.match(functions, /ticketId: ticket\.id \|\| ''/);
});

test('sino: lê users/{uid}/notifications source=support e gera alerta linkado', () => {
  assert.match(menu, /support_notif__/);
  assert.match(menu, /users\/\$\{ctx\.uid\}\/notifications/);
  assert.match(menu, /subscription-status\.html'[\s\S]{0,120}supportTicket=/);
  assert.match(menu, /alerts-item-support/);
  assert.match(menu, /Abrir ticket/);
});

test('deep link: abre o ticket e ignora duplicidade do alerta de login', () => {
  assert.match(menu, /window\.openSiswebSupportTicket/);
  assert.match(menu, /params\.get\('supportTicket'\)/);
  assert.match(auth, /String\(n\.source \|\| ''\) !== 'support'/);
});

test('href de alerta relativo é normalizado a partir de folha_pagamento', () => {
  assert.match(menu, /normalizeAlertHref\(href\)/);
  assert.match(menu, /const href = this\.normalizeAlertHref\(/);
  assert.match(menu, /return this\.resolveUrl\(h\)/);
});
