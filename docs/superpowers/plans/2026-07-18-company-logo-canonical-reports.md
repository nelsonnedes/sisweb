# Company Logo Canonical Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manter uma unica logo ativa por tenant e garantir seu uso nos cabecalhos de relatorios e impressoes, incluindo o Financeiro.

**Architecture:** Uploads sobrescrevem o objeto `profile/logo/current`. Depois do perfil persistido, Functions reconciliam o prefixo tenant-scoped e removem objetos diferentes da referencia mantida. Relatorios continuam consumindo `getCompanyProfileForReport`, e o Financeiro recebe CSS de A4 paisagem real.

**Tech Stack:** Firebase Storage, Realtime Database, Cloud Functions, JavaScript, HTML print, Node test runner.

## Global Constraints

- Nunca excluir a logo anterior antes de persistir o perfil novo.
- Nunca listar ou remover fora de `companies/{companyId}/profile/logo/`.
- Nao enumerar o Storage no navegador.
- Nao usar fallback base64 no Realtime Database.
- Validar e publicar Functions antes de recuperar/remover objetos reais.

---

### Task 1: Reconciliacao backend tenant-scoped

**Files:**
- Modify: `functions/index.js`
- Modify: `tests/company-logo-storage-policy.test.mjs`
- Modify: `tests/security-rbac-multitenant.test.mjs`

**Interfaces:**
- Consumes: `companyId` e `nextProfile.logoStoragePath`.
- Produces: `reconcileCompanyLogoObjects(companyId, keepPath): Promise<{ attempted, deletedCount, failedCount }>`.

- [ ] **Step 1: Escrever testes de ordem e isolamento**

```js
assert.match(updateBlock, /await profileRef\.set\(nextProfile\);[\s\S]*await reconcileCompanyLogoObjects/);
assert.match(helper, /const prefix = `companies\/\$\{companyId\}\/profile\/logo\/`/);
assert.match(helper, /file\.name !== keepPath/);
```

- [ ] **Step 2: Executar testes e confirmar falha**

Run: `node --test tests/company-logo-storage-policy.test.mjs tests/security-rbac-multitenant.test.mjs`

Expected: FAIL porque nao existe reconciliacao por prefixo.

- [ ] **Step 3: Implementar reconciliacao pos-save**

```js
async function reconcileCompanyLogoObjects(companyId, keepPath) {
    const prefix = `companies/${companyId}/profile/logo/`;
    if (!keepPath || !keepPath.startsWith(prefix)) return { attempted: false, deletedCount: 0, failedCount: 0 };
    const [files] = await admin.storage().bucket().getFiles({ prefix });
    const stale = files.filter((file) => file.name !== keepPath);
    const results = await Promise.allSettled(stale.map((file) => file.delete({ ignoreNotFound: true })));
    return {
        attempted: true,
        deletedCount: results.filter((item) => item.status === 'fulfilled').length,
        failedCount: results.filter((item) => item.status === 'rejected').length
    };
}
```

- [ ] **Step 4: Chamar o helper apos `profileRef.set` nos dois fluxos**

Aplicar em `upsertCompanyProfile` e `updateMyCompanyProfile`, retornando `logoCleanup` sem expor nomes de objetos.

- [ ] **Step 5: Rodar testes focados**

Run: `node --test tests/company-logo-storage-policy.test.mjs tests/security-rbac-multitenant.test.mjs`

Expected: PASS.

### Task 2: Remover limpeza duplicada no cliente

**Files:**
- Modify: `company.html`
- Modify: `scripts/admin/admin-main.js`
- Modify: `tests/company-logo-storage-policy.test.mjs`

**Interfaces:**
- Consumes: `logoCleanup` retornado pela Function.
- Produces: salvamento sem delete direto do navegador.

- [ ] **Step 1: Atualizar testes para exigir backend autoritativo**

```js
assert.doesNotMatch(companySaveBlock, /cleanupReplacedCompanyLogo\(logoPayload\)/);
assert.match(companySaveBlock, /profileResult[\s\S]*logoCleanup/);
```

- [ ] **Step 2: Remover o delete pos-save do navegador**

Manter o upload e o perfil, mas apenas registrar aviso se `logoCleanup.failedCount > 0`.

- [ ] **Step 3: Validar sintaxe e testes**

Run: `node --test tests/company-logo-storage-policy.test.mjs tests/company-profile-permissions.test.mjs`

Expected: PASS.

### Task 3: Financeiro em A4 paisagem real

**Files:**
- Modify: `financas.js`
- Modify: `tests/financas-relatorios-exportacoes.test.mjs`

**Interfaces:**
- Consumes: itens selecionados e perfil preparado com DataURL.
- Produces: HTML imprimivel sem corte ou compressao de retrato.

- [ ] **Step 1: Escrever teste de largura e quebra**

```js
assert.match(source, /@page \{ size: A4 landscape; margin: 8mm; \}/);
assert.match(source, /\.sisweb-print-page \{ max-width: none; \}/);
assert.match(source, /\.sisweb-print-section \{ break-inside: auto; page-break-inside: auto; \}/);
```

- [ ] **Step 2: Ajustar somente o CSS extra do Financeiro**

```css
@page { size: A4 landscape; margin: 8mm; }
.sisweb-print-page { max-width: none; }
.sisweb-print-section { break-inside: auto; page-break-inside: auto; }
.finance-print-table { width: 100%; table-layout: fixed; }
```

- [ ] **Step 3: Rodar teste focado**

Run: `node --test tests/financas-relatorios-exportacoes.test.mjs`

Expected: PASS.

### Task 4: Auditoria de consumidores de relatorio

**Files:**
- Modify: `tests/company-logo-storage-policy.test.mjs`
- Modify: `docs/stories/2026-07-15-financas-integridade-seguranca-relatorios.md`

**Interfaces:**
- Consumes: perfil canonico e helper de impressao.
- Produces: evidencia para Vendas, Compras, Estoque, Financeiro, Folha, MDF-e e Romaneios.

- [ ] **Step 1: Verificar consumidores ativos**

Exigir `getCompanyProfileForReport`, `preparePrintOptions` ou resolvedor central equivalente em cada modulo ativo, sem leitura de `localStorage.companies` como fonte autoritativa.

- [ ] **Step 2: Rodar suites de relatorio/PWA**

Run: `node --test tests/company-logo-storage-policy.test.mjs tests/commerce-responsive-pwa.test.mjs tests/financas-relatorios-exportacoes.test.mjs tests/estoque-pwa-impressao.test.mjs`

Expected: PASS.

### Task 5: Deploy, recuperacao e limpeza real

**Files:**
- Modify: `sw.js`
- Modify: `docs/stories/2026-07-15-financas-integridade-seguranca-relatorios.md`

**Interfaces:**
- Consumes: codigo validado e dois objetos legados identicos.
- Produces: perfil operacional apontando para `profile/logo/current` e prefixo sem duplicatas ativas.

- [ ] **Step 1: Executar gates completos**

Run: `npm run lint && npm run typecheck && npm test && npm run build:hosting`

Expected: PASS.

- [ ] **Step 2: Publicar Functions e Hosting**

Run: `firebase deploy --only functions:upsertCompanyProfile,functions:updateMyCompanyProfile,functions:getCompanyLogoDataUrl,functions:grantReadOnlyGrace --project sisweb-7ce82 --non-interactive`

Run: `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`

Expected: Deploy complete.

- [ ] **Step 3: Fazer backup direcionado e recuperar `current`**

Exportar `companies/1749492103278/profile` para arquivo temporario, copiar a imagem legada validada para `companies/1749492103278/profile/logo/current` e atualizar apenas os campos de logo do perfil.

- [ ] **Step 4: Validar antes de excluir**

Confirmar DataURL pelo backend, cabecalho financeiro e isolamento do tenant.

- [ ] **Step 5: Remover duplicatas legadas**

Excluir os dois objetos legados somente depois do smoke positivo e confirmar que o prefixo ativo contem apenas `current`.

