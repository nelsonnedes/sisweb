# Subscription Read-Only Expiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a data real de vencimento prevalecer sobre marcadores legados e liberar a carencia unica de modo leitura sem permitir gravacoes.

**Architecture:** O frontend e o backend mantem o contrato atual, mas passam a avaliar `subscription.endDate` antes de aceitar `active` ou `trial_active`. A callable continua autoritativa para conceder a carencia e o frontend apenas renderiza/consome o resultado.

**Tech Stack:** JavaScript, Firebase Auth, Realtime Database, Cloud Functions callable, Node test runner.

## Global Constraints

- Nao alterar dados financeiros reais.
- Preservar compatibilidade de contas ativas sem data final.
- Nao conceder mais de uma carencia por usuario.
- Publicar Functions antes de Hosting e testar somente depois dos deploys.

---

### Task 1: Contrato de status efetivo

**Files:**
- Create: `tests/subscription-readonly-expiry.test.mjs`
- Modify: `auth.js`
- Modify: `firebaseService.js`

**Interfaces:**
- Consumes: `subscriptionStatus`, `subscription.active`, `subscription.endDate`.
- Produces: `resolveSubscriptionStatus(user): 'active'|'trial_active'|'expired'|'pending'|'pending_grace'|'blocked'|'unknown'`.

- [ ] **Step 1: Escrever testes que exercitam vencido, futuro e sem data**

```js
assert.equal(resolve({ subscriptionStatus: 'active', subscription: { active: true, endDate: '2026-06-13T12:47:30.000Z' } }, now), 'expired');
assert.equal(resolve({ subscriptionStatus: 'active', subscription: { active: true, endDate: '2026-08-13T12:47:30.000Z' } }, now), 'active');
assert.equal(resolve({ subscriptionStatus: 'active', subscription: { active: true } }, now), 'active');
```

- [ ] **Step 2: Executar o teste e confirmar falha inicial**

Run: `node --test tests/subscription-readonly-expiry.test.mjs`

Expected: FAIL porque `active` vencido ainda resolve como ativo.

- [ ] **Step 3: Ajustar a precedencia nos dois resolutores do navegador**

```js
const subscriptionEnd = parseAnyDateSafe(user.subscription && user.subscription.endDate);
const activeMarker = normalized === 'active' || normalized === 'ativo' || user.subscription?.active === true;
if (activeMarker && subscriptionEnd) return subscriptionEnd.getTime() > Date.now() ? 'active' : 'expired';
if (activeMarker) return 'active';
```

- [ ] **Step 4: Executar o teste focado**

Run: `node --test tests/subscription-readonly-expiry.test.mjs`

Expected: PASS.

### Task 2: Callable autoritativa e UX

**Files:**
- Modify: `functions/index.js`
- Modify: `subscription-status.html`
- Modify: `sw.js`
- Test: `tests/subscription-readonly-expiry.test.mjs`

**Interfaces:**
- Consumes: usuario autenticado e `lateGraceDays`.
- Produces: `{ success, readOnlyUntil, graceDays, alreadyGranted? }`.

- [ ] **Step 1: Cobrir a precedencia temporal da callable**

```js
assert.match(functionBody, /endDate[\s\S]*endDate\.getTime\(\) > Date\.now\(\)/);
assert.doesNotMatch(functionBody, /subscriptionStatus === 'active'[\s\S]*\|\|[\s\S]*endDate/);
```

- [ ] **Step 2: Alterar `isActive` para respeitar data valida**

```js
const activeMarker = user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trial_active' || subscription.active === true;
const isActive = activeMarker && (!endDate || endDate.getTime() > Date.now());
```

- [ ] **Step 3: Corrigir a mensagem visual do estado expirado**

```html
<h3>Modo leitura temporario disponivel</h3>
```

- [ ] **Step 4: Rodar validacoes locais**

Run: `node --check functions/index.js`

Expected: sem erro.

Run: `node --test tests/subscription-readonly-expiry.test.mjs tests/subscription-status-help-guide.test.mjs`

Expected: PASS.

### Task 3: Deploy e smoke

**Files:**
- Modify: `docs/stories/2026-07-15-financas-integridade-seguranca-relatorios.md`

**Interfaces:**
- Consumes: Functions e Hosting validados localmente.
- Produces: evidencia de producao e pendencia multitenant atualizada.

- [ ] **Step 1: Publicar a callable corrigida**

Run: `firebase deploy --only functions:grantReadOnlyGrace --project sisweb-7ce82 --non-interactive`

Expected: Deploy complete.

- [ ] **Step 2: Publicar Hosting**

Run: `npm run build:hosting && firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`

Expected: Deploy complete.

- [ ] **Step 3: Validar tenant expirado**

Confirmar que o botao concede a carencia, redireciona ao sistema e o guard bloqueia qualquer submit/mutacao.

