# Subscription Effective Profile Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer Login, guards e tela de assinatura resolverem o mesmo status efetivo quando `users/{uid}` e `companies/{companyId}/users/{uid}` divergirem.

**Architecture:** `firebaseService.js` recebe um reconciliador puro e um loader autenticado tenant-scoped. `auth.js` e `subscription-status.html` deixam de escolher réplicas independentemente e passam a consumir o mesmo envelope, mantendo o resolvedor de status existente como interpretação final.

**Tech Stack:** JavaScript ES Modules, Firebase Auth v10, Firebase Realtime Database v10, Node.js Test Runner, Firebase Hosting Preview Channels.

## Global Constraints

- Firebase Auth e o contexto canônico continuam sendo as únicas fontes de UID e tenant.
- `blocked` explícito prevalece; `endDate` futura válida prevalece sobre `expired` legado quando não há bloqueio.
- Não mesclar identidade, papel, permissão ou tenant entre réplicas.
- Falha das duas leituras retorna `unknown`; cache local não concede autorização.
- Não criar Function, não alterar Rules e não escrever reparos de dados.
- Publicar primeiro em Preview e promover somente o Hosting após smoke autenticado.

---

### Task 1: Reconciliador Puro De Perfis

**Files:**
- Modify: `firebaseService.js` próximo de `resolveSubscriptionStatusForWriteGuard`
- Create: `tests/subscription-effective-profile.test.mjs`

**Interfaces:**
- Consumes: dois objetos opcionais `rootProfile` e `tenantProfile`.
- Produces: `reconcileSubscriptionReplicaProfiles(rootProfile, tenantProfile, nowMs)` retornando `{ data, statusKey, source, warnings }`.

- [x] **Step 1: Escrever os testes que reproduzem a divergência**

```js
test('trial futuro do tenant prevalece sobre expired legado da raiz', () => {
  const root = { subscriptionStatus: 'expired', subscription: { endDate: past } };
  const tenant = { subscriptionStatus: 'trial_active', subscription: { type: 'free_trial', endDate: future } };
  const result = reconcile(root, tenant, NOW);
  assert.equal(result.statusKey, 'trial_active');
  assert.equal(result.data.subscription.endDate, future);
});

test('blocked explicito prevalece sobre vigencia futura', () => {
  const root = { subscriptionStatus: 'active', subscription: { endDate: future } };
  const tenant = { accountStatus: 'blocked' };
  assert.equal(reconcile(root, tenant, NOW).statusKey, 'blocked');
});
```

Cobrir também duas datas vencidas, apenas uma réplica, pending sem vigência e ausência das duas réplicas.

- [x] **Step 2: Executar o teste e confirmar a falha inicial**

Run: `node --test tests/subscription-effective-profile.test.mjs`

Expected: FAIL porque `reconcileSubscriptionReplicaProfiles` ainda não existe.

- [x] **Step 3: Implementar o reconciliador mínimo**

```js
function reconcileSubscriptionReplicaProfiles(rootProfile, tenantProfile, nowMs = Date.now()) {
    const root = rootProfile && typeof rootProfile === 'object' ? rootProfile : null;
    const tenant = tenantProfile && typeof tenantProfile === 'object' ? tenantProfile : null;
    const replicas = [
        root ? { source: 'root', profile: root } : null,
        tenant ? { source: 'tenant', profile: tenant } : null
    ].filter(Boolean);
    if (!replicas.length) return { data: null, statusKey: 'unknown', source: 'none', warnings: ['profile_missing'] };

    const blocked = replicas.find(({ profile }) => isExplicitlyBlockedSubscriptionProfile(profile));
    if (blocked) return buildEffectiveSubscriptionProfile(root, blocked.profile, 'blocked', blocked.source, replicas);

    const future = replicas
        .map((entry) => ({ ...entry, endMs: getSubscriptionEndTimestamp(entry.profile) }))
        .filter((entry) => Number.isFinite(entry.endMs) && entry.endMs > nowMs)
        .sort((a, b) => b.endMs - a.endMs)[0];
    if (future) {
        const statusKey = isTrialSubscriptionProfile(future.profile) ? 'trial_active' : 'active';
        return buildEffectiveSubscriptionProfile(root, future.profile, statusKey, future.source, replicas);
    }

    const pending = replicas.find(({ profile }) => isPendingSubscriptionProfile(profile));
    if (pending) return buildEffectiveSubscriptionProfile(root, pending.profile, 'pending', pending.source, replicas);

    const dated = replicas
        .map((entry) => ({ ...entry, endMs: getSubscriptionEndTimestamp(entry.profile) }))
        .filter((entry) => Number.isFinite(entry.endMs))
        .sort((a, b) => b.endMs - a.endMs)[0];
    const selected = dated || replicas[0];
    const fallbackStatus = resolveSubscriptionStatusForWriteGuard(selected.profile);
    return buildEffectiveSubscriptionProfile(root, selected.profile, fallbackStatus, selected.source, replicas);
}
```

`buildEffectiveSubscriptionProfile` deve copiar o perfil raiz como base e sobrescrever somente `subscription`, `subscriptionStatus`, `accountStatus`, `pendingPayment`, `trialStart`, `subscriptionStart` e `subscriptionEnd` a partir da réplica selecionada. O array `warnings` recebe apenas códigos como `subscription_replica_divergence`.

- [x] **Step 4: Executar os testes focados**

Run: `node --test tests/subscription-effective-profile.test.mjs tests/subscription-readonly-expiry.test.mjs`

Expected: todos os testes PASS.

- [ ] **Step 5: Commit lógico**

```bash
git add firebaseService.js tests/subscription-effective-profile.test.mjs
git commit -m "fix(auth): reconcile subscription profile replicas"
```

---

### Task 2: Loader Autenticado Tenant-Scoped

**Files:**
- Modify: `firebaseService.js` próximo de `getUserProfileForSession`
- Modify: `tests/subscription-effective-profile.test.mjs`

**Interfaces:**
- Consumes: `getEffectiveUserProfile(uid, options = {})`, onde `options.companyId` é opcional.
- Produces: Promise de `{ success, data, statusKey, source, warnings }`.

- [x] **Step 1: Adicionar testes estáticos do contrato de segurança**

```js
test('loader efetivo valida uid e tenant pelo contexto autenticado', () => {
  const service = read('firebaseService.js');
  const block = between(service, 'async function getEffectiveUserProfile', 'function startAnonymousAuthIfEnabled');
  assert.match(block, /String\(currentUser\.uid/);
  assert.match(block, /resolveSessionContextForUser\(currentUser\)/);
  assert.match(block, /companies\/\$\{companyId\}\/users\/\$\{requestedUid\}/);
  assert.doesNotMatch(block, /localStorage/);
});
```

- [x] **Step 2: Executar e confirmar a falha**

Run: `node --test tests/subscription-effective-profile.test.mjs`

Expected: FAIL porque o loader e a exposição pública ainda não existem.

- [x] **Step 3: Implementar leitura autenticada das duas réplicas**

```js
async function getEffectiveUserProfile(uid, options = {}) {
    const currentUser = (auth && auth.currentUser) || getWindowFirebaseAuthUser();
    const requestedUid = String(uid || currentUser && currentUser.uid || '').trim();
    if (!currentUser || !requestedUid || String(currentUser.uid || '') !== requestedUid) {
        return { success: false, data: null, statusKey: 'unknown', source: 'none', warnings: ['auth_uid_mismatch'] };
    }

    const session = await resolveSessionContextForUser(currentUser);
    const companyId = normalizeTenantContextValue(session && session.companyId);
    const requestedCompanyId = normalizeTenantContextValue(options.companyId);
    if (requestedCompanyId && requestedCompanyId !== companyId) {
        return { success: false, data: null, statusKey: 'unknown', source: 'none', warnings: ['tenant_mismatch'] };
    }

    const readWarnings = [];
    let rootProfile = null;
    try {
        const rootResult = await loadUserProfileSingleFlight(currentUser);
        rootProfile = rootResult && rootResult.ok ? rootResult.profile : null;
        if (rootResult && rootResult.ok === false) readWarnings.push('root_profile_unavailable');
    } catch (_) {
        readWarnings.push('root_profile_unavailable');
    }
    let tenantProfile = null;
    if (companyId) {
        try {
            const tenantSnapshot = await get(ref(db, `companies/${companyId}/users/${requestedUid}`));
            tenantProfile = tenantSnapshot.exists() ? tenantSnapshot.val() : null;
        } catch (_) {
            readWarnings.push('tenant_profile_unavailable');
        }
    }
    const reconciled = reconcileSubscriptionReplicaProfiles(rootProfile, tenantProfile);
    return { success: !!reconciled.data, ...reconciled, warnings: [...readWarnings, ...reconciled.warnings] };
}
```

Tratar a falha de uma leitura isoladamente para que a outra réplica permaneça utilizável. Expor a função em `authService.getEffectiveUserProfile` e `window.firebaseService.getEffectiveUserProfile`.

- [x] **Step 4: Executar testes focados e sintaxe**

Run: `node --check firebaseService.js`

Run: `node --test tests/subscription-effective-profile.test.mjs tests/auth-session-phase2.test.mjs`

Expected: sintaxe válida e todos os testes PASS.

- [ ] **Step 5: Commit lógico**

```bash
git add firebaseService.js tests/subscription-effective-profile.test.mjs
git commit -m "feat(auth): expose effective subscription profile"
```

---

### Task 3: Integrar Login, Guards E Tela De Status

**Files:**
- Modify: `auth.js` em `loadUserProfileFromFirebase`
- Modify: `subscription-status.html` em `loadCurrentUserSnapshot`
- Modify: `tests/subscription-effective-profile.test.mjs`
- Modify: `tests/auth-session-phase2.test.mjs`

**Interfaces:**
- Consumes: `window.firebaseService.getEffectiveUserProfile(uid, { companyId })`.
- Produces: o mesmo perfil reconciliado para `login`, `getCurrentUserDetails`, guards e UI.

- [x] **Step 1: Escrever os testes de integração estática**

```js
test('login e status usam o perfil efetivo compartilhado', () => {
  const auth = read('auth.js');
  const status = read('subscription-status.html');
  assert.match(auth, /firebaseService\.getEffectiveUserProfile/);
  assert.match(status, /firebaseService\.getEffectiveUserProfile/);
  assert.doesNotMatch(statusBlock, /candidates\.push\(`companies\/\$\{tenantId\}\/users\/\$\{uid\}`\)/);
});
```

- [x] **Step 2: Executar e confirmar a falha**

Run: `node --test tests/subscription-effective-profile.test.mjs tests/auth-session-phase2.test.mjs`

Expected: FAIL porque os consumidores ainda selecionam réplicas separadamente.

- [x] **Step 3: Adaptar o helper do Auth**

```js
async function loadUserProfileFromFirebase(uid) {
    try {
        const id = String(uid || '').trim();
        if (!id) return null;
        if (window.firebaseService && typeof window.firebaseService.getEffectiveUserProfile === 'function') {
            const result = await window.firebaseService.getEffectiveUserProfile(id);
            return result && result.success && result.data ? result.data : null;
        }
        if (window.firebaseService && typeof window.firebaseService.getUserProfile === 'function') {
            return await window.firebaseService.getUserProfile(id);
        }
        return null;
    } catch (_) {
        return null;
    }
}
```

Manter o fallback raiz somente para compatibilidade de páginas ainda não migradas.

- [x] **Step 4: Adaptar a tela de assinatura**

```js
async function loadCurrentUserSnapshot(details) {
    const uid = String(details && (details.uid || details.id || details.userId) || '').trim();
    if (uid && window.firebaseService && typeof window.firebaseService.getEffectiveUserProfile === 'function') {
        const result = await window.firebaseService.getEffectiveUserProfile(uid);
        if (result && result.success && result.data) return result.data;
    }
    return details || null;
}
```

Remover apenas a precedência duplicada dos caminhos raiz/tenant; preservar os fallbacks de compatibilidade sem varredura global para usuário comum.

- [x] **Step 5: Executar testes focados**

Run: `node --test tests/subscription-effective-profile.test.mjs tests/subscription-readonly-expiry.test.mjs tests/auth-session-phase2.test.mjs tests/subscription-checkout-pix.test.mjs`

Expected: todos os testes PASS.

- [ ] **Step 6: Commit lógico**

```bash
git add auth.js subscription-status.html tests/subscription-effective-profile.test.mjs tests/auth-session-phase2.test.mjs
git commit -m "fix(auth): share effective subscription status"
```

---

### Task 4: Rastreabilidade, Gates E Rollout

**Files:**
- Modify: `docs/stories/2026-07-14-auth-navigation-performance-ux.md`
- Modify: `docs/superpowers/plans/2026-08-02-subscription-effective-profile-reconciliation.md`

**Interfaces:**
- Consumes: implementação e testes das Tasks 1 a 3.
- Produces: evidência reproduzível de qualidade, Preview e smoke live.

- [x] **Step 1: Atualizar a story e checkboxes do plano**

Registrar causa raiz, arquivos, testes, URL do Preview, escopo de deploy e resultado do smoke sem credenciais ou identificadores reais.

- [x] **Step 2: Executar quality gates completos**

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run build:hosting`

Run: `git diff --check`

Expected: todos os gates PASS; somente o skip documentado do Emulator pode permanecer.

- [x] **Step 3: Publicar Preview Channel**

Run: `firebase hosting:channel:deploy subscription-profile-20260802 --expires 7d --project sisweb-7ce82`

Expected: Preview criado com 450 arquivos allowlisted e sem deploy de Functions ou Rules.

- [x] **Step 4: Smoke autenticado controlado**

Validar com o tenant de teste:

1. login segue para Home, não para `reason=expired`;
2. `subscription-status.html` mostra Trial ativo e a mesma data final;
3. Empresa abre com o tenant correto;
4. logout encerra a sessão e o guard bloqueia reabertura.

- [x] **Step 5: Promover somente Hosting**

Run: `firebase deploy --only hosting --project sisweb-7ce82`

Expected: release live concluída sem Functions, Rules, Storage ou Database.

- [x] **Step 6: Repetir smoke live e registrar evidência**

Confirmar os quatro cenários do Preview no domínio `https://sisweb-7ce82.web.app/` e atualizar a story.

- [ ] **Step 7: Commit documental final**

```bash
git add docs/stories/2026-07-14-auth-navigation-performance-ux.md docs/superpowers/plans/2026-08-02-subscription-effective-profile-reconciliation.md
git commit -m "docs(auth): record subscription reconciliation rollout"
```
