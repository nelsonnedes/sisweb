import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('acao Notificar do Admin tambem cria notificacao interna para o usuario', () => {
  const adminMain = read('scripts/admin/admin-main.js');
  const functionsIndex = read('functions/index.js');

  assert.match(adminMain, /var targetUid = String\(user\.uid \|\| user\.id \|\| user\.userId/);
  assert.match(adminMain, /targetUid: targetUid/);
  assert.match(adminMain, /notificationMessage: internalMessage/);

  assert.match(functionsIndex, /const targetUid = sanitizeText\(payload\.targetUid \|\| payload\.uid \|\| ''\)/);
  assert.match(functionsIndex, /pushUserNotification\(targetUid/);
  assert.match(functionsIndex, /source: 'subscription-admin-email'/);
  assert.match(functionsIndex, /internalNotification: !!targetUid/);
});
