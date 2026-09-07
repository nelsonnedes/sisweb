# Portal Independente do Parceiro Sisweb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um portal exclusivo para parceiros sem empresa Sisweb obrigatória, com acesso autenticado, dados isolados, comissões, clientes indicados e comunicação por canais autorizados.

**Architecture:** O portal usará o mesmo Firebase Auth, mas uma capability `partner` independente de `companyId`. O backend derivará `partnerId`, participantes e vínculos do token/RTDB; o navegador nunca autorizará acesso enviando IDs arbitrários. A UI será separada de `cadastro-parceiro.html`, preservando o cadastro público e os callables legados durante a migração.

**Tech Stack:** HTML/CSS/JavaScript vanilla, Firebase Auth, Cloud Functions Node.js 22, Realtime Database, Firebase Storage, testes Node `node:test`, `agent-browser`.

## Global Constraints

- Não exigir `companyId` para capability de parceiro.
- Exigir e-mail Firebase verificado antes de `claimPartnerAccount`.
- Parceiro `blocked` ou `pending` não acessa dashboard, lembretes ou mensagens.
- Não aceitar `partnerId`, `companyId`, `ownerUid` ou participante enviados pelo cliente como autoridade.
- Não retornar UID, e-mail completo, `companyId` ou `requestId` no dashboard do parceiro.
- Manter `campaignPartners`, referrals, commissions e `partnerReminders` compatíveis.
- Escritas novas somente por Cloud Functions/Admin SDK; RTDB client permanece bloqueado.
- Mensagens `partner_superadmin` e `partner_client` ficam separadas dos tickets empresariais existentes.
- Não criar anexos na primeira entrega de mensagens.
- Não gravar credenciais reais, senhas ou tokens em arquivos, testes ou logs.

---

### Task 1: Modelo de capacidade e claim seguro

**Files:**
- Modify: `functions/partner-functions.js`
- Modify: `functions/index.js`
- Modify: `firebaseService.js`
- Test: `tests/partner-program.test.mjs`

**Interfaces:**
- Produces callable `claimPartnerAccount({code?: string})` returning `{success, partnerId, status, capabilities}`.
- `findPartnerForCaller(auth)` becomes read-only and rejects unverified email, inactive status, and owner conflicts.

- [ ] Write static tests for `claimPartnerAccount`, email verification, blocked status, and non-overwriting owner claim.
- [ ] Run `node --test tests/partner-program.test.mjs` and confirm the new assertions fail before implementation.
- [ ] Add `claimPartnerAccount` using `context.auth.uid`, `context.auth.token.email`, `email_verified`, transaction/compare-and-set, and `status === active`.
- [ ] Add `firebaseService.claimPartnerAccount(payload)` using authenticated callable handling.
- [ ] Export the callable from `functions/index.js` and the wrapper from the service export object.
- [ ] Run `node --check functions/partner-functions.js`, `node --check functions/index.js`, and partner tests.

### Task 2: Dedicated partner portal and routing

**Files:**
- Create: `portal-parceiro.html`
- Modify: `cadastro-parceiro.html`
- Modify: `landing-vendas.html`
- Modify: `login.html`
- Modify: `auth.js`
- Modify: `hosting-files.json`
- Test: `tests/partner-program.test.mjs`

**Interfaces:**
- Portal calls `claimPartnerAccount`, `getMyPartnerDashboard`, and future conversation wrappers.
- Login accepts `redirect=portal-parceiro.html` and preserves the target without sending partner-only users to `company.html`.

- [ ] Add static tests requiring the new portal route, partner-only redirect, no company requirement, and landing links to the portal.
- [ ] Run those tests to confirm failure.
- [ ] Create portal UI states: visitor, activation pending, email unverified, active partner, blocked/pending, and no-partner.
- [ ] Move dashboard rendering from `cadastro-parceiro.html` into the portal while leaving registration and a migration link in the old page.
- [ ] Change landing “Meu painel do Parceiro” and “Acessar meu Painel” to `portal-parceiro.html`.
- [ ] Add portal-aware redirect handling in `login.html`/`auth.js`, preserving normal users’ existing company routing.
- [ ] Add portal files to `hosting-files.json`, run inline syntax checks, and test desktop/mobile layout with `agent-browser`.

### Task 3: Dashboard privacy and active-status enforcement

**Files:**
- Modify: `functions/partner-functions.js`
- Modify: `tests/partner-program.test.mjs`
- Modify: `database.rules.json` only if a new read node is required

**Interfaces:**
- `getMyPartnerDashboard({cursor?, limit?})` returns redacted records with `clientRef`, commercial name, status, plan, due date, aggregates, commissions, and projections.
- `sendBillingReminder({clientRef, message, idempotencyKey})` resolves target data only on the backend.

- [ ] Add tests asserting no `referredUid`, `companyId`, full e-mail, or `requestId` in partner responses.
- [ ] Add tests for partner A/B isolation and blocked/pending rejection.
- [ ] Replace client-provided target `companyId` with backend-resolved `clientRef` while preserving a temporary compatibility path only if required by existing persisted links.
- [ ] Make partner lookup read-only and enforce active status in dashboard/reminder paths.
- [ ] Limit reminder recipients to the company primary/financial contact, not every company member.
- [ ] Make rate-limit writes transactional and fail closed on RTDB errors.
- [ ] Run partner tests and security-focused tests.

### Task 4: Partner conversations with SuperAdmin and client

**Files:**
- Modify: `functions/partner-functions.js`
- Modify: `functions/index.js`
- Modify: `firebaseService.js`
- Modify: `database.rules.json`
- Modify: `portal-parceiro.html`
- Modify: `menu-component.js` only for client notification summaries
- Test: `tests/partner-program.test.mjs`

**Interfaces:**
- `createPartnerConversation({channel, clientRef?, subject, message})` derives partner from auth.
- `listPartnerConversations({channel, cursor?, limit?})` filters by authenticated participant.
- `getPartnerConversation({conversationId})` checks participant authorization.
- `sendPartnerMessage({conversationId, body, idempotencyKey})` derives author role and validates participants.
- Channels: `partner_superadmin` and `partner_client`.

- [ ] Add static authorization tests for both channels and rejection of arbitrary partner/client IDs.
- [ ] Add new RTDB paths with no client write permissions.
- [ ] Implement backend participant checks and append-only message/audit records.
- [ ] Add portal inbox tabs for SuperAdmin and client channels with clear separation.
- [ ] Add minimal client notification summary without exposing private conversation content to unrelated members.
- [ ] Run rules JSON validation, partner tests, and manual browser tests with two isolated sessions.

### Task 5: SuperAdmin controls and operational safety

**Files:**
- Modify: `admin.html`
- Modify: `scripts/admin/admin-main.js`
- Modify: `firebaseService.js`
- Modify: `functions/partner-functions.js`
- Modify: `tests/partner-program.test.mjs`

**Interfaces:**
- Existing partner list/detail remains functional.
- Add partner status/capability view, claim state, conversation inbox, and safe commission mutation.

- [ ] Add tests for admin-only access, blocked partner, and idempotent `markCommissionPaid`.
- [ ] Add UI indicators for `ownerUid` claim status and verified e-mail without exposing credentials.
- [ ] Add conversation view by channel and participant.
- [ ] Make commission totals transaction-safe and audit every status/configuration mutation.
- [ ] Avoid exposing raw partner objects to the admin browser when a redacted view is sufficient.

### Task 6: End-to-end QA and rollout

**Files:**
- Modify: `docs/core/CEREBRO-SISWEB.md`
- Modify: `tests/partner-program.test.mjs`
- Generated: cachebusters/`hosting-dist`

- [ ] Run `node --check` on every changed JavaScript file.
- [ ] Run `npm --prefix functions run lint`.
- [ ] Run `npm run validate:pr`.
- [ ] Use a dedicated test partner and test client; never use production credentials in files or logs.
- [ ] Verify partner without company can activate, log in, see only own data, and message correct channel.
- [ ] Verify a second partner cannot see first partner’s client or conversations.
- [ ] Verify SuperAdmin tabs Parceiros, Campanhas, Assinaturas, Empresas and support channel behavior.
- [ ] Run `node tools/inject-cachebusters.mjs`, `npm run build:hosting`, deploy database/functions/hosting in order.
- [ ] Update CEREBRO with rollout, tests, known limitations, and deployment outcome.
- [ ] Commit and push only intended files after final review.
