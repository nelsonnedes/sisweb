# HANDOFF — SisWeb para Codex (2026-08-11)

**Autor:** Sessão anterior (opencode/deepseek)
**Destino:** Codex CLI — assumir próximos passos e/ou revisão
**Branch atual:** `codex/recovery-p0-freebuff-regressions` (sincronizada com `origin`)

> Todos os commits e deploys abaixo já estão **commitados, publicados e em produção**. Working tree limpo.
> Basta continuar a partir daqui — nada está pendente de commit nesta sessão.

---

## 1. Incidente Sentry 403 — RESOLVIDO (ação da última sessão)

### Sintoma
`ReferenceError: normalizeMes is not defined` apareceu no painel Sentry do admin. Ao clicar **Resolver**,
o console mostrava `Failed to load resource: 403` (2x) e a issue não era resolvida.

### Diagnóstico (E2E reproduzido)
- Não era RBAC do Firebase (`assertSuperAdminCall` passava).
- A callable `sentryResolveIssue` (v2, `functions/sentry-functions.js:284`) lançava
  `permission-denied: "Token da Sentry API inválido ou sem permissão."`
- A causa real: o secret `SENTRY_API_TOKEN` (v1) tinha **apenas escopo `org:ci`** — o GET de issues
  funcionava (sync), mas o **PUT** (`/api/0/issues/{id}/` com `status: resolved`) falhava.

### Correção aplicada
1. Novo token criado no Sentry (org `nelson-nedes-do-rosario-brito`) com escopos:
   `project:read`, `project:write` (+ org/team/alerts/event), formato `sntryu_...`.
   - ⚠️ O token `sntrys_...` passado antes só tinha `org:ci` — não serve para issues.
2. Secret atualizado: `firebase functions:secrets:set SENTRY_API_TOKEN` → **versão 2**.
3. Deploy das 3 functions com o novo secret (2nd Gen, nodejs22, us-central1):
   - `sentrySyncIssues`, `sentryGetIssueDetail`, `sentryResolveIssue`
4. Re-testado em produção via API:
   - GET issues → 200 (issue `7660833177` / `JAVASCRIPT-NEXTJS-2` listada)
   - PUT `status: resolved` → 200
   - PUT `status: unresolved` → 200 (reabertura para teste)
   - Callable `sentrySyncIssues` → `{success:true, count:1, stored:1}`
5. Usuário confirmou: **botão "Resolver" funcionou de ponta a ponta** (issue resolvida na Sentry + RTDB
   atualizado, painel mostra badge "Resolvido").

### Pendência aberta (manual, no painel do Sentry)
- `SENTRY_WEBHOOK_TOKEN` já existe (v1), mas o **webhook ainda não foi configurado** no Sentry:
  Settings → Projects → `javascript-nextjs` → Webhooks → URL
  `https://us-central1-sisweb-7ce82.cloudfunctions.net/sentryWebhook?token=<SENTRY_WEBHOOK_TOKEN>`
- Configurar alertas (e-mail/Telegram) p/ issues `[dados]` e novas issues.

---

## 2. Últimos 10 dias — Commits (01/08 → 10/08)

### 2026-08-01/02 — Fundação
- `22ac28d` fix: unifica correções do Codex com hardening de segurança no admin
- `a97880c` / `7ed3a1b` chore: gitignore worktrees/logs

### 2026-08-05 — Vendas / Financeiro / Auth / Estoque
- `7fa5560` feat(orders): clonagem segura de pedidos de vendas e compras
- `8038ab3` feat(romaneiotora): autocomplete de fornecedores com renderização segura
- `1948fa5` feat(estoque): busca de toras e exclusão em lote com romaneios vinculados
- `a7027a3` / `8345f44` fix(vendas): editar/excluir item de pedido de fato (sem duplicar/clonar)
- `8cfc962` / `9b53080` fix(financeiro): callable `financeSyncCompra` exportada no index.js + fallback legado
- `4ea9107` / `ed16262` fix(financeiro): data de emissão nas contas geradas; return no branch de edição
- `1bc2385` / `d5e4785` / `f66fdca` / `afa69f0` fix(auth): logout estável (modular auth bridge), reconciliação
  do `effectiveSubscription`/`subscriptionRequests` entre réplicas do perfil
- `cfb5f79` fix(romaneiotl): aguardar compat bridge antes de configurar auth (getter recursivo removido)
- `ff8d43f` fix(romaneiotora): cursor pointer nos botões dos modais
- `05f70ea` docs(plans): freebuff production recovery plan

### 2026-08-06 — UI Romaneios
- `13b4da2` fix(ui): padronizar botões de ação e modais (TL/PES/TORA/preromaneio)
- `4f3cf59` fix(auth/ui): deslog ao abrir modais no preromaneio; listas de romaneios como o TL

### 2026-08-07 — Firebase / CI / Limpeza
- `378f304` fix(auth): remover sessão anônima em romaneiotl (isolamento de tenant)
- `9e2a2fb` fix(firebase): healthcheck correto (cachebuster, scan recursivo, anon/initApp); `folha.html` no singleton `firebase-init`
- `1bac01c` / `42d8e34` chore: remover 29 HTMLs legados não publicados (backup `backup/legacy-html-2026-08-07`)
- `06d694c` chore(ci): validação pre-merge e smoke de preview do Hosting
- `38d1112` feat(sentry): SDK local vendado + instrumentação CRUD + painel admin + callables (`sentrySyncIssues`/`sentryGetIssueDetail`/`sentryWebhook`)

### 2026-08-08 — Auth Fases 4–6
- `4b864e7` fix(functions): `fullUserCleanup` resolve companyId em mirrors, remove empresa inteira, limpa subscriptionRequests cross-company
- `bd304e3` feat(auth): Fase 4 — dedup single-flight, cache TTL tenant-scoped, unsubscribes no logout, alertas do menu com TTL
- `380db0c` fix(admin): invalidar cache TTL após fullUserCleanup/limpeza de assinatura
- `2a66cc0` feat(admin): varredura de empresas órfãs (`sweepOrphanCompanies`) com dry-run e remoção supervisionada
- `d72edf8` feat(pwa): Fase 5 — SW: network-first HTML, stale-while-revalidate JS/CSS, cache-first assets imutáveis, limpeza por versão
- `f405709` docs(story): Fase 5 concluída
- `f847635` feat(auth): Fase 6 — Portal de Acesso Premium (controlador único, modais acessíveis, Fale Conosco público)

### 2026-08-10 — Fixes e botão Resolver
- `903f68f` fix(auth): eliminar flicker do rodapé no Portal de Acesso (Fase 6): não mover footer pós-paint, flex column no body, remover aviso RTDB transitório (CLS no login)
- `0d65508` fix(folha): `ReferenceError: normalizeMes is not defined` ao limpar filtros — helper movido para o escopo do método `limparFiltros` (estava dentro do bloco `if mesAno`)
- `363d10f` chore(assets): FontAwesome local (all.min.css + woff2) no lugar de CDN; registro em hosting-files.json
- `da2921b` fix(romaneiopes): padronizar modal Lista de Clientes com TL/PCT — 6 colunas, filtro completo, max-height, estado vazio
- `e8e795e` feat(admin): botão **Resolver** no painel Sentry — callable `sentryResolveIssue` (PUT status resolved), RBAC superadmin, badge "Resolvido", guards de teste

---

## 3. Deploys feitos na última sessão (2026-08-11)

| Alvo | Ação | Resultado |
|---|---|---|
| Secret `SENTRY_API_TOKEN` | `firebase functions:secrets:set` | **v2** (token com `project:write`) |
| Functions (3) | `firebase deploy --only functions:sentrySyncIssues,sentryGetIssueDetail,sentryResolveIssue` | ✅ publicadas (nodejs22 v2) |
| Hosting | `firebase deploy --only hosting` | ✅ 456 arquivos publicados |

---

## 4. Próximos passos sugeridos para o Codex

1. **Webhook Sentry** (único passo manual pendente da story): configurar no painel do Sentry com
   `SENTRY_WEBHOOK_TOKEN` (não commitar o valor; ler do Secret Manager).
2. **Monitorar regressões** no Sentry: verificar se `normalizeMes is not defined` reaparece (o fix
   `0d65508` já está em produção desde o deploy de hosting de 2026-08-11).
3. **Alertas**: criar alerta de "novas issues" no Sentry para monitoramento contínuo.
4. `npm run lint` + `npm run typecheck` + `npm test` para validar o estado atual (sem mudanças de código
   nesta sessão — apenas docs e config de produção; esperado verde).
5. Revisar `docs/stories/2026-08-07-sentry-monitoramento-producao.md` (atualizada com o fix do token e
   validação em produção).

---

## 5. Credenciais/chaves de contexto (NÃO versionar)

- Org Sentry: `nelson-nedes-do-rosario-brito` · Project: `javascript-nextjs`
- `SENTRY_API_TOKEN` → Secret Manager v2 (token `sntryu_...` no `functions/.env` local, gitignored)
- `SENTRY_WEBHOOK_TOKEN` → Secret Manager v1 (valor apenas no Secret Manager)
- Login test E2E (produção): `nedes1@hotmail.com` (superadmin) — senha/credenciais não estão no repo