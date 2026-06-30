import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('support backend exposes callable functions and avoids companies inherited write path', () => {
  const functionsSource = read('functions/index.js');

  for (const fn of [
    'createSupportTicket',
    'addSupportTicketMessage',
    'listMySupportTickets',
    'getSupportTicket',
    'updateSupportTicketStatus',
    'listSupportTicketsAdmin'
  ]) {
    const callableSource = ['createSupportTicket', 'addSupportTicketMessage'].includes(fn)
      ? 'SMTP_SECRET_RUNTIME_OPTIONS\\.https\\.onCall'
      : 'https\\.onCall';
    assert.match(functionsSource, new RegExp(`exports\\.${fn}\\s*=\\s*${callableSource}`));
  }

  assert.match(functionsSource, /supportTicketsByCompany\/\$\{caller\.companyId\}/);
  assert.match(functionsSource, /supportTicketMessagesByCompany\/\$\{caller\.companyId\}/);
  assert.match(functionsSource, /supportTicketsByUser\/\$\{caller\.uid\}/);
  assert.match(functionsSource, /supportTicketNotifications\/\$\{ticketId \|\| 'unknown'\}/);
  assert.doesNotMatch(functionsSource, /companies\/\$\{caller\.companyId\}\/supportTickets/);
  assert.doesNotMatch(functionsSource, /companies\/\$\{companyId\}\/supportTickets/);
});

test('support functions resolve tenant server-side, rate-limit and notify safely', () => {
  const functionsSource = read('functions/index.js');

  assert.match(functionsSource, /resolveSupportCaller/);
  assert.match(functionsSource, /resolveCompanyIdForUser/);
  assert.match(functionsSource, /if \(isSuperAdmin && options\.allowRequestedCompanyId\)/);
  assert.match(functionsSource, /if \(!caller\.isSuperAdmin\) await assertSupportRateLimit\(caller\.companyId, caller\.uid, 'create'\)/);
  assert.match(functionsSource, /supportTicketRateLimits\/\$\{companyId\}\/\$\{uid\}/);
  assert.match(functionsSource, /stripHtmlTags/);
  assert.match(functionsSource, /sanitizeSupportText/);
  assert.match(functionsSource, /function getSmtpRuntimeConfig/);
  assert.match(functionsSource, /defineSecret\('SMTP_PASS'\)/);
  assert.match(functionsSource, /const functionsV1 = require\('firebase-functions\/v1'\)/);
  assert.match(functionsSource, /functionsV1\.runWith\(\{\s*secrets:\s*\[SMTP_PASS_SECRET\]\s*\}\)/);
  assert.doesNotMatch(functionsSource, /functions\.runWith/);
  assert.match(functionsSource, /readSecretValue\(SMTP_PASS_SECRET\)/);
  assert.match(functionsSource, /function readLocalSecretEnv\(name\)/);
  assert.match(functionsSource, /readLocalSecretEnv\('SMTP_PASS'\)/);
  assert.match(functionsSource, /readLocalSecretEnv\('SMTP_PASS_LOCAL'\)/);
  assert.match(functionsSource, /process\.env\.FUNCTIONS_EMULATOR === 'true'/);
  assert.doesNotMatch(functionsSource, /process\.env\.SMTP_PASS \|\| process\.env\.SMTP_PASS_LOCAL/);
  assert.doesNotMatch(functionsSource, /functions\.config\(\)/);
  assert.doesNotMatch(functionsSource, /nzuimpbnmjsvsfzq/);
  assert.match(functionsSource, /notifySupportAdminByEmail\(ticketPayload, messagePayload, caller, 'created'\)/);
  assert.match(functionsSource, /notifySupportAdminByEmail\(updatedTicket, messagePayload, caller, 'customer_message'\)/);
  assert.match(functionsSource, /notifySupportCustomer\(updatedTicket, messagePayload\)/);
  assert.match(functionsSource, /source:\s*'support'/);
});

test('listMySupportTickets lista espelho por auth.uid sem exigir companyId do cliente', () => {
  const functionsSource = read('functions/index.js');
  const start = functionsSource.indexOf('exports.listMySupportTickets');
  const end = functionsSource.indexOf('exports.getSupportTicket', start);
  const block = functionsSource.slice(start, end);

  assert.match(block, /context\.auth\.uid/);
  assert.match(block, /supportTicketsByUser\/\$\{uid\}/);
  assert.doesNotMatch(block, /resolveSupportCaller/);
  assert.doesNotMatch(block, /companyId/);
});

test('getSupportTicket le mensagens sem depender de indice RTDB em tempo de abertura', () => {
  const functionsSource = read('functions/index.js');
  const start = functionsSource.indexOf('exports.getSupportTicket');
  const end = functionsSource.indexOf('exports.updateSupportTicketStatus', start);
  const block = functionsSource.slice(start, end);

  assert.match(block, /supportTicketMessagesByCompany\/\$\{companyId\}\/\$\{ticketId\}`\)\.get\(\)/);
  assert.match(block, /visibleMessages\.sort/);
  assert.match(block, /visibleMessages = visibleMessages\.slice\(-200\)/);
  assert.match(block, /supportTicketAudit\/\$\{ticketId\}`\)\.get\(\)/);
  assert.match(block, /audit = audit\.slice\(-100\)/);
  assert.doesNotMatch(block, /orderByChild\('createdAt'\)/);
});

test('database rules block direct support writes and restrict global queue to superadmin', () => {
  const rules = JSON.parse(read('database.rules.json')).rules;

  assert.equal(rules.supportTickets['.write'], false);
  assert.match(rules.supportTickets['.read'], /superadmin/);
  assert.equal(rules.supportTicketsByCompany['.write'], false);
  assert.match(rules.supportTicketsByCompany['.read'], /superadmin/);
  assert.equal(rules.supportTicketMessagesByCompany['.write'], false);
  assert.deepEqual(rules.supportTicketMessagesByCompany.$companyId.$ticketId['.indexOn'], ['createdAt']);
  assert.equal(rules.supportTicketAudit['.write'], false);
  assert.ok(rules.supportTicketAudit.$ticketId['.indexOn'].includes('createdAt'));
  assert.equal(rules.supportTicketNotifications['.write'], false);
  assert.match(rules.supportTicketNotifications['.read'], /superadmin/);
  assert.equal(rules.supportTicketRateLimits['.read'], false);
  assert.equal(rules.supportTicketRateLimits['.write'], false);
  assert.equal(rules.supportTicketsByUser.$uid['.write'], false);
  assert.match(rules.supportTicketsByUser.$uid['.read'], /auth\.uid == \$uid/);
});

test('support ticket attachments use compressed Storage and backend metadata validation', () => {
  const functionsSource = read('functions/index.js');
  const storageRules = read('storage.rules');
  const storageService = read('storageService.js');
  const menu = read('menu-component.js');

  assert.match(functionsSource, /SUPPORT_ATTACHMENT_MAX_COUNT = 3/);
  assert.match(functionsSource, /SUPPORT_ATTACHMENT_MAX_BYTES = 6 \* 1024 \* 1024/);
  assert.match(functionsSource, /function normalizeSupportAttachments\(value, companyId, actor\)/);
  assert.match(functionsSource, /sanitizeSupportAttachmentUrl/);
  assert.match(functionsSource, /supportAttachmentCompanyId\(storagePath\)/);
  assert.match(functionsSource, /attachments = normalizeSupportAttachments\(payload\.attachments, caller\.companyId, caller\)/);
  assert.match(functionsSource, /attachments = normalizeSupportAttachments\(payload\.attachments, companyId, caller\)/);
  assert.match(functionsSource, /messagePayload = \{[\s\S]*attachments,/);
  assert.match(functionsSource, /supportAttachmentEmailLines\(messagePayload\.attachments/);
  assert.doesNotMatch(functionsSource, /data:image\/[a-z]+;base64/);

  assert.match(storageRules, /match \/companies\/\{companyId\}\/support\/\{allPaths=\*\*\}/);
  assert.match(storageRules, /request\.resource\.size < 6 \* 1024 \* 1024/);
  assert.match(storageRules, /request\.resource\.contentType\.matches\('image\/\.\*\|application\/pdf'\)/);

  assert.match(storageService, /async uploadSupportAttachment\(file, context = \{\}\)/);
  assert.match(storageService, /_prepareUploadFile\(file, \{ maxSizeMB: 0\.5, maxWidthOrHeight: 1280 \}\)/);
  assert.match(storageService, /_compressImageWithCanvas/);
  assert.match(storageService, /customMetadata\.compressed = 'true'/);
  assert.match(storageService, /companies\/\$\{companyId\}\/support\/tickets\/\$\{ticketId\}/);

  assert.match(menu, /id="siswebSupportAttachments"/);
  assert.match(menu, /id="siswebSupportReplyAttachments"/);
  assert.match(menu, /__siswebUploadSupportAttachments/);
  assert.match(menu, /uploadSupportAttachment\(file/);
  assert.match(menu, /support-public-mode \.support-attachment-field/);
  assert.match(menu, /support-message-attachments/);
});

test('frontend exposes support service wrappers and modal sends support ticket', () => {
  const firebaseService = read('firebaseService.js');
  const menu = read('menu-component.js');

  for (const fn of [
    'createSupportTicket',
    'addSupportTicketMessage',
    'listMySupportTickets',
    'getSupportTicket',
    'updateSupportTicketStatus',
    'listSupportTicketsAdmin',
    'sendPublicSupportEmail'
  ]) {
    assert.match(firebaseService, new RegExp(`async function ${fn}`));
    assert.match(firebaseService, new RegExp(`${fn}[:,]?`));
  }

  assert.match(menu, /sendSiswebSupportTicket/);
  assert.match(menu, /__siswebResolveFirebaseService/);
  assert.match(menu, /await import\(moduleUrl\)/);
  assert.match(menu, /__siswebResolveSupportAuthUser/);
  assert.match(menu, /switchSiswebSupportView/);
  assert.match(menu, /loadSiswebSupportTickets/);
  assert.match(menu, /sendSiswebSupportTicketReply/);
  assert.match(menu, /closeSiswebSupportTicket/);
  assert.match(menu, /service\.listMySupportTickets/);
  assert.match(menu, /service\.getSupportTicket/);
  assert.match(menu, /service\.addSupportTicketMessage/);
  assert.match(menu, /service\.createSupportTicket/);
  assert.match(menu, /Entre novamente no Sisweb para enviar ticket com segurança/);
  assert.match(menu, /function __siswebIsPublicSupportMode\(\)/);
  assert.match(menu, /window\.__siswebSupportPublicMode === true/);
  assert.match(menu, /Histórico de tickets disponível após registro e login/);
  assert.match(menu, /Para abrir ticket com histórico, registre-se ou entre no Sisweb/);
  assert.match(menu, /if \(!__siswebIsPublicSupportMode\(\)\) \{/);
  assert.match(menu, /sendPublicSupportEmail/);
  assert.match(menu, /Envio direto indisponível\. Use WhatsApp ou copie os dados\./);
  assert.match(menu, /Enviando e-mail para o Admin/);
  assert.match(menu, /E-mail enviado ao Admin com sucesso/);
  assert.match(menu, /SISWEB_SUPPORT_DRAFT_PREFIX/);
  assert.match(menu, /__siswebSaveSupportDraft/);
  assert.match(menu, /__siswebRestoreSupportDraft/);
  assert.match(menu, /navigator\.onLine === false/);
  assert.match(menu, /support-ticket/);
  assert.match(menu, /Enviar ticket/);
  assert.match(menu, /Meus tickets/);
  assert.match(menu, /Responder neste ticket/);
  assert.match(menu, /Anexos/);
  assert.match(menu, /Tratando e enviando anexo/);
  assert.match(menu, /attachments/);
  assert.match(menu, /WhatsApp/);
  assert.match(menu, /E-mail/);
  assert.match(menu, /Copiar dados/);
});

test('public support email uses SMTP only on backend with rate limit and server-side recipients', () => {
  const functionsSource = read('functions/index.js');
  const firebaseService = read('firebaseService.js');
  const menu = read('menu-component.js');

  assert.match(functionsSource, /exports\.sendPublicSupportEmail\s*=\s*SMTP_SECRET_RUNTIME_OPTIONS\.https\.onCall/);
  assert.match(functionsSource, /PUBLIC_SUPPORT_EMAIL_LIMIT_PER_DAY/);
  assert.match(functionsSource, /assertPublicSupportEmailRateLimit\(context, payload\)/);
  assert.match(functionsSource, /publicSupportRateLimitKey\(context, payload\)/);
  assert.match(functionsSource, /resolveSupportAdminEmails\(\)/);
  assert.match(functionsSource, /sendSystemEmail\(\{/);
  assert.match(functionsSource, /publicSupportEmailLogs/);
  assert.match(functionsSource, /website \|\| payload\.companyWebsite/);
  assert.doesNotMatch(functionsSource, /to:\s*payload\.to/);
  assert.doesNotMatch(functionsSource, /recipients\s*=\s*parseSupportEmailList\(payload/);

  assert.match(firebaseService, /async function sendPublicSupportEmail\(payload\)/);
  assert.match(firebaseService, /callSupportFunction\('sendPublicSupportEmail', payload\)/);
  assert.match(menu, /service\.sendPublicSupportEmail\(\{/);
  assert.match(menu, /website: ''/);
  assert.match(menu, /clientFingerprint/);
});
