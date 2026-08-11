# Story: Monitoramento de Erros em Produção com Sentry

**Data:** 2026-08-07
**Status:** Implementada
**Ramificação:** `codex/recovery-p0-freebuff-regressions`

> **Objetivo:** Instrumentar o sistema com Sentry (SDK local, plano gratuito) para coletar erros de produção — falhas de gravação, exclusão, updates, sincronização, conflitos, duplicações e filtros — de forma segura, sem vazamento de dados entre tenants, sem PII e sem custos indevidos.

## Decisões de Implementação

1. **SDK local, sem CDN.** O bundle `@sentry/browser` (bundle.tracing.min.js, ~146 KB) foi baixado da fonte oficial (browser.sentry-cdn.com) e vendado em `sentry/sentry.browser.min.js` + `sentry/LICENSE` (MIT). Motivos: CSP `'self'`, PWA/offline, cachebuster por hash (`inject-cachebusters`), zero dependência externa em runtime.

2. **DSN configurado (ativado em 2026-08-07).** `sentry-init.js` usa o DSN do projeto real do cliente. Sem DSN o SDK roda em modo no-op local (captura erros mas NADA é enviado) — esse modo continua disponível como fallback (`window.__SENTRY_DSN__` = null). DSN é público (client-side) — não é segredo.

3. **Segurança multi-tenant e privacidade.**
   - `sendDefaultPII: false` — nunca envia nome/e-mail do usuário; identidade = apenas `uid`.
   - Tags de tenant: `company_id` lido de `firebaseService.getTenantId()`, `window.appTenantId`, localStorage ou query params — somente da sessão do próprio browser (impossível cross-tenant).
   - `beforeSend` redige campos sensíveis (senha/token/cpf/cartão) em extras/contexts e redige URLs com query params.
   - Erros de extensões de navegador (Grammarly, LastPass, etc.) e ruído benigno (ResizeObserver loop, Script error, aborts) são filtrados (~90% do ruído).

4. **Zero custo de performance.** `tracesSampleRate: 0` — tracing desligado. Apenas erros (free tier ~50k/mês).

5. **Injeção em todas as 29 páginas publicadas.** `<script src="sentry/sentry.browser.min.js?v=...">` + `<script src="sentry-init.js?v=...">` logo após `<head>`, com cachebuster hash. Em `folha_pagamento/folha.html` o caminho é relativo (`../sentry/...`) pois fica em subpasta — os hashes foram aplicados manualmente (o `inject-cachebusters.mjs` só processa HTMLs da raiz). Guard singleton protege contra includes duplicados.

6. **Monitoramento de operações de dados.** `window.SentryMonitor.reportDataIssue(type, {path, op, collection, errorCode, errorMessage})` com tipos: `gravacao_falhou`, `exclusao_falhou`, `update_falhou`, `conflito`, `duplicacao`, `filtro_invalido`, `falha_dados`, `validacao`. Instrumentados os catches centrais:
   - `firebaseService.js` (`saveData` → gravacao_falhou, `removeData` → exclusao_falhou)
   - `modules/core/firebase-service.js` (`saveData`, `deleteData`, `syncQueue` → conflito)
   As chamadas são no-op-safe (`if (window.SentryMonitor)`) — zero impacto se o SDK não carregar.

7. **CSP do `admin.html` atualizado.** `connect-src` ganhou `https://*.sentry.io`, `https://*.ingest.sentry.io` e `https://*.ingest.us.sentry.io` (geo US) para permitir o envio de eventos sem afrouxar script-src `'self'` (SDK local).

8. **Release e ambiente.** `release` via `window.__SISWEB_RELEASE__` (default `sisweb-local`); `environment` derivado do hostname (development/production). Permite rastrear regressões por release no Sentry.

9. **Painel de Monitoramento no Admin (arquitetura híbrida — Opção C).** Seção "Monitoramento de Erros (Sentry)" na aba Segurança & Auditoria do admin.html + sininho no header. Três peças novas em `functions/sentry-functions.js`:
   - `sentrySyncIssues` (callable, superadmin): consulta a Sentry API sob demanda (`project:read`) e grava resumo sanitizado em `system/sentry/issues` no RTDB.
   - `sentryGetIssueDetail` (callable, superadmin): retorna issue + 5 eventos recentes (topo do stack) para o botão "Copiar relatório" — sem gravar nada.
   - `sentryWebhook` (HTTP, token secreto no path `?token=`): recebe webhooks do Sentry e grava o resumo em tempo real — alimenta o sininho.
   - RBAC: `assertSuperAdminCall` em todas as callables (mesmo padrão de `syncGoogleCloudBillingCostExport`).
   - Secrets: `SENTRY_API_TOKEN` (Bearer `sntrys_...`) e `SENTRY_WEBHOOK_TOKEN` — nunca no client.

10. **Espelho sanitizado no RTDB.** `system/sentry/issues/{id}` guarda apenas metadados: id, título, nível, status, tipo, mensagem (300 chars, redigida), página, company_id, release, datas, contagens — nunca payloads de dados. Regras existentes de `system/*` já protegem: `.read` superadmin, `.write:false` (só o Admin SDK das Functions escreve).

11. **Sininho de alertas (24h).** Ícone de sino no header do admin: badge com quantidade de erros `error`/`fatal` das últimas 24h não vistos; clique abre lista dos últimos 12; "Marcar como vistos" persiste em localStorage (`sentry_bell_seen_v1`). Atualiza em tempo real via `subscribe("system/sentry/issues")`.

12. **Copiar para diagnóstico.** Cada issue tem botão "Copiar" (gera relatório estruturado com stack topo, via `sentryGetIssueDetail`) e há "Copiar resumo" da lista — texto pronto para colar no chat do desenvolvedor. HTML sempre escapado (`sentryEscapeHtml`) — sem XSS.

## Checklist

- [x] SDK Sentry baixado e vendado em `sentry/sentry.browser.min.js` + `LICENSE`
- [x] `sentry-init.js` criado: guard singleton, DSN null default, beforeSend com filtros/redação, API `window.SentryMonitor` (reportDataIssue, captureException, wrap, setTenant)
- [x] Scripts injetados nas 29 páginas publicadas (logo após `<head>`, com cachebuster hash)
- [x] `folha_pagamento/folha.html` com caminho relativo `../sentry/...` e cachebusters manuais
- [x] `hosting-files.json` atualizado (452 arquivos: +`sentry/sentry.browser.min.js`, +`sentry-init.js`)
- [x] CSP do `admin.html` com `connect-src *.sentry.io / *.ingest.sentry.io / *.ingest.us.sentry.io`
- [x] Cachebusters reconciliados (`inject-cachebusters.mjs`) nas 28 páginas da raiz
- [x] Instrumentação CRUD: `firebaseService.js` (saveData/removeData) e `modules/core/firebase-service.js` (saveData/deleteData/syncQueue)
- [x] Testes `tests/sentry-monitor.test.mjs` (4 testes)
- [x] `npm run validate:pr` 6/6
- [x] Painel admin: seção Sentry na aba Segurança & Auditoria (KPIs, filtros, tabela, copiar relatório/resumo)
- [x] Sininho no header do admin com badge 24h e lista realtime
- [x] Cloud Functions `sentrySyncIssues` / `sentryGetIssueDetail` / `sentryWebhook` (RBAC superadmin + secrets)
- [x] Testes `tests/sentry-admin-monitor.test.mjs` (6 testes: RBAC, sem credenciais no client, UI, regras RTDB)

## Arquivos Alterados

- `sentry/sentry.browser.min.js` (novo, ~146 KB, @sentry/browser)
- `sentry/LICENSE` (novo, MIT)
- `sentry-init.js` (novo, 298 linhas)
- `firebase.json` (CSP admin.html)
- `hosting-files.json` (+2 arquivos)
- `firebaseService.js` (+linhas: reportDataIssue em saveData/removeData)
- `modules/core/firebase-service.js` (+linhas: reportDataIssue em saveData/deleteData/syncQueue)
- 29 páginas HTML (script tags Sentry com cachebuster)
- `functions/sentry-functions.js` (novo — sync, detalhe, webhook)
- `functions/index.js` (registro das 3 exports do Sentry)
- `admin.html` (seção Monitoramento de Erros + sininho)
- `scripts/admin/admin-main.js` (lógica do painel e do sininho)
- `tests/sentry-monitor.test.mjs` (novo)
- `tests/sentry-admin-monitor.test.mjs` (novo)

## Ativação (pós-deploy)

Verificação em produção em 2026-08-08:

- [x] **DSN configurado** em `sentry-init.js` (projeto real, ingest.us) — erros já chegam ao Sentry.
- [x] **Secret `SENTRY_API_TOKEN`** criada e ENABLED no projeto (v1).
- [x] **Secret `SENTRY_WEBHOOK_TOKEN`** criada e ENABLED no projeto (v1).
- [x] **Functions publicadas**: `sentrySyncIssues`, `sentryGetIssueDetail`, `sentryWebhook` listadas em produção (v2, nodejs22, us-central1).
- [x] **Hosting publicado**: `sentry/sentry.browser.min.js` e `sentry-init.js` servidos do live `sisweb-7ce82.web.app` (SDK @sentry/browser 10.69.0).
- [x] **Botão "Resolver" no painel admin** (commit `e8e795e`): callable `sentryResolveIssue` (PUT `status: resolved` na Sentry API), RBAC superadmin, badge "Resolvido", re-sync automático pós-resolução.
- [x] **FIX PÓS-PRODUÇÃO (2026-08-10/11 — ver handoff):** Token `SENTRY_API_TOKEN` original tinha apena escopo `org:ci` → `sentrySyncIssues`/`sentryGetIssueDetail`/`sentryResolveIssue` retornavam 403 ("Token da Sentry API inválido ou sem permissão"). Novo token com escopos `project:read` + `project:write` (+ org/team/alerts/event) criado no Sentry, secret atualizado para **versão 2** e as 3 functions redeployadas. **Validado em produção:** sync OK (count=1, stored=1), PUT resolve OK (200) e botão "Resolver" funcionou de ponta a ponta (issue `JAVASCRIPT-NEXTJS-2` marcada como resolvida na Sentry + RTDB).
- [ ] **Webhook no Sentry**: Settings → Projects → javascript-nextjs → Webhooks (plugin/Internal Integration) → URL `https://us-central1-sisweb-7ce82.cloudfunctions.net/sentryWebhook?token=<SENTRY_WEBHOOK_TOKEN>` → salvar e enviar teste (ação manual no painel do Sentry).
- [ ] Configurar alertas no Sentry: e-mail/Telegram para `[dados]` e novas issues.
- [ ] Conferir no Sentry (Issues) se os primeiros erros de produção chegam; criar alerta de "novas issues" para monitorar regressões.
- [ ] Corrigir a issue `ReferenceError: normalizeMes is not defined` (folha_pagamento/folha-filtros) — já corrigida no código pelo commit `0d65508` (helper movido para o escopo do método `limparFiltros`); aguardar nova release e conferir se reaparece no Sentry.
