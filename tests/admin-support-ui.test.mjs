import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin possui aba de suporte restrita e integrada as callables', () => {
  const adminHtml = read('admin.html');
  const adminMain = read('scripts/admin/admin-main.js');
  const menu = read('menu-component.js');

  assert.match(adminHtml, /id="tab-support"/);
  assert.match(adminHtml, /id="supportTicketsTable"/);
  assert.match(adminHtml, /id="supportStatusFilter"/);
  assert.match(adminHtml, /id="supportPriorityFilter"/);
  assert.match(adminHtml, /id="supportTicketsBody"/);
  assert.match(adminHtml, /firebaseService\.js\?v=2026-06-11-profile-admin-v1/);
  assert.match(adminHtml, /scripts\/admin\/admin-main\.js\?v=2026-06-11-profile-admin-v1/);

  assert.match(adminMain, /supportTickets/);
  assert.match(adminMain, /resolveAdminFirebaseService/);
  assert.match(adminMain, /\/firebaseService\.js\?v=/);
  assert.match(adminMain, /loadSupportTicketsPanel/);
  assert.match(adminMain, /listSupportTicketsAdmin/);
  assert.match(adminMain, /getSupportTicket/);
  assert.match(adminMain, /addSupportTicketMessage/);
  assert.match(adminMain, /updateSupportTicketStatus/);
  assert.match(adminMain, /if \(access\.isSuperAdmin\) \{\s*tabs\.push\(\{key:"support"/);
  assert.match(adminMain, /if \(access\.isSuperAdmin\) \{\s*allowedTabs\.push\("support"\)/);
  assert.match(adminMain, /new URLSearchParams\(window\.location\.search/);

  assert.match(menu, /admin\.html\?tab=support/);
  assert.match(menu, /Fila de Suporte/);
  assert.match(menu, /isSuperAdmin: true/);
  assert.match(menu, /\$\{!adminContext\.isSuperAdmin \? `<a href="#" class="[^"]*support-link/);
});

test('admin suporte renderiza conversa, resposta e nota interna sem escrita direta no banco', () => {
  const adminMain = read('scripts/admin/admin-main.js');

  assert.match(adminMain, /support-thread/);
  assert.match(adminMain, /support-reply-box/);
  assert.match(adminMain, /createSupportAttachmentField/);
  assert.match(adminMain, /uploadAdminSupportAttachments/);
  assert.match(adminMain, /uploadSupportAttachment/);
  assert.match(adminMain, /support-message-attachments/);
  assert.match(adminMain, /attachments:\s*attachments/);
  assert.match(adminMain, /visibility:\s*internalCheck\.checked \? "internal" : "customer"/);
  assert.match(adminMain, /Nota interna/);
  assert.match(adminMain, /Fechar ticket/);
  assert.doesNotMatch(adminMain, /supportTicketsByCompany\/\$\{/);
  assert.doesNotMatch(adminMain, /supportTickets\/\$\{/);
});

