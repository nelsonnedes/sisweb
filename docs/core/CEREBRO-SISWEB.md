# CEREBRO-SISWEB — Memória operacional do projeto

> Este arquivo é a memória persistente de trabalho do SisWeb. Serve para qualquer
> sessão (Codex, opencode, deepseek) retomar contexto sem regressões e sem perder
> o "porquê" das decisões já tomadas. SEMPRE consultar antes de implementar.
>
> Atualizado em: 2026-08-14 (sessão de correção UTC financeiro + modais + deploy v2)

---

## 1. Visão geral do sistema

- **Nome:** SisWeb (Sisweb) — gestão madeireira (romaneios TL/PC/Pés/Tora), vendas, compras, estoque, finanças, folha de pagamento, NF-e/MDF-e, suporte, assinaturas, Sentry.
- **Projeto Firebase/GCP:** `sisweb-7ce82`
  - Hosting: `https://sisweb-7ce82.web.app`
  - RTDB: `https://sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app`
  - Auth domain: `sisweb-7ce82.firebaseapp.com`
  - Storage: `sisweb-7ce82.firebasestorage.app`
- **Stack:** HTML/CSS/JS vanilla (sem framework), Firebase SDK v10.7.1 modular via `firebase-init.js` (singleton), Cloud Functions 1st gen (financeiras) e 2nd gen (sentry/billing/NF), PWA com service worker.
- **Multi-tenant:** regras RTDB por tenant (company_id); auth com claim `company_id`; callables validam tenant; SuperAdmin UID `HfrQ6ObQq2aSEoeEE4Ng9jpAolB3` (Nelson).

## 2. Arquitetura-chave (o que NUNCA esquecer)

- **`firebase-init.js`** é o ÚNICO ponto de import do SDK (imports ESM do CDN gstatic 10.7.1). Singleton. Página e módulos importam `{ app, auth, db, storage, functions, ref, set, get, ... }` daqui. **Não criar novos imports diretos de gstatic.**
- **`firebaseService.js`** = camada compat de serviços (`firebaseService.saveData`, `callFunction`, monitoramento de conexão). `firebase-compat-bridge.js` fornece `push()` síncrono com `.key` para chamadores legados.
- **Backend financeiro** (`functions/finance-functions.js`): juros, dias de atraso, validação de estado (`assertRegisterMutation`), histórico de pagamentos. Valida pelo **dia civil do negócio (America/Sao_Paulo)**, não UTC. Helpers críticos: `todayDayNumber(nowIso)`, `dateToDayNumber(value)`, `currentFinancialState`.
- **Cache-busters:** `inject-cachebusters.mjs` injeta `?v=<sha256 curto>` em `<script src>` e `<link rel=stylesheet>`. **Só processa `<script>`** (não `<link>`)—cache-buster de CSS é manual. Arquivos dependentes (ex.: `sw.js`, códigos inline de páginas) têm versão manual (ex.: `APP_VERSION`, `romaneio-comum.css?v=...`).
- **Service worker** (`sw.js`): `APP_VERSION` controla invalidação de cache PWA; `SISWEB_PWA_UPDATED` alerta release check.

## 3. Mapa de módulos e áreas

| Área | Arquivo(s) principal | Módulos associados |
|---|---|---|
| Login | `login.html`, `auth.js`, `firebaseService.js` | `js/deep-clean.js`, `firebase-init.js` |
| Dashboard | `index.html`, `modules/dashboard/*` | dashboard-core, dashboard-widgets |
| Vendas/Compras | `vendas.html`, `compras.html` | `commerce-*`, `romaneios-client-save-fix.js` |
| Estoque | `estoque.html`, `estoque_produtos.js`, `estoque.js` | `species-*`, `tora-geometry-utils.js` |
| Finanças | `financas.html`, `financas.js` | `js/pix-brcode.js`, `js/commerce-boleto-pix.js`, functions `finance*` |
| Folha | `folha_pagamento/folha.html` + `folha-filtros.js` etc | folha-main, folha-lancamentos |
| Romaneios | `romaneiopct/tl/pes/preromaneio/tora.html` | `romaneio-comum.css`, `client-modal-handler.js`, `modules/modals/*`, `modules/romaneiopct/*`, `preromaneio-modals.js`, `fornecedor-modals.js` |
| Cadastros | `client.html`, `fornecedor.html`, `species.html`, `company.html` | js/client.js, species-modal-standard.js |
| NF/MDF | `notas-fiscais.html`, `mdf-e.html` | `nf-*` functions (2nd gen) |
| Admin | `admin.html` + `scripts/admin/*` | admin-ui, admin-main |
| Suporte | `central-suporte*`, `support-callable-service.js` | functions `*SupportTicket*` |
| Perfil/Assinatura | `user-profile.html`, `subscription*.html` | functions `Subscription*` |

## 4. Modais de lista (clientes/fornecedores/espécies) — CONSENSO ATUAL

- Padrão: **4 itens por página**, colunas Nome/Cidade/Estado/Telefone/Email/Ações, filtro por texto, max-height e estado vazio.
- Paginação: `modal-clientes.js` e `modal-clientes-pct.js` usam `itemsPerPage: 4`; `preromaneio-modals.js` usa `ITEMS_PER_PAGE = 4`; `fornecedor-modals.js` usa `window._fornPageSize || 4`.
- CSS em `romaneio-comum.css`: botões de ação 26px, `td` 26px height/padding 3px 8px, tr 32px, `.btn-group` com `margin: 0 !important`. **Estes 20-26px vs 30-54px é o estado desejado** (não "inflar" de volta).
- `client-modal-handler.js` instala `window.openClientListModal` (guard assíncrono). **IMPORTANTE conhecido:** as páginas de romaneio definem `window.openClientListModal` inline (ex.: `romaneiopct.html` ~linha 4099) após o módulo, sobrescrevendo o guard → `openClientListModalGuard` fica `undefined` em produção. Se for necessário proteger o clique antecipado, tratar o override nas páginas.

## 5. Padrão de datas financeiro — REGRA CRÍTICA (fix 2026-08-14)

- "Hoje" no financeiro = **dia civil America/Sao_Paulo**, em FRONTEND e BACKEND igualmente.
- Frontend: `getTodayISODateUTC()` em `financas.js` retorna `toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})` (fallback UTC). Usado por `getTodayStartTimestampLocal()`.
- Backend: `FINANCE_TIME_ZONE='America/Sao_Paulo'`, `getTodayISODateInTimeZone(nowIso,tz)`, `todayDayNumber(nowIso)` — usados nos 5 pontos de cálculo de status/atraso.
- **Riscos de regressão:** (1) mudar de volta para `Date.UTC`/`getUTCDate()` reintroduz o bug das 21h; (2) backend SEM fuso mas frontend COM (ou vice-versa) causa o 400 `Dias de atraso não correspondem`; (3) `new Date('YYYY-MM-DD')` é interpretado como UTC no JS — SEMPRE usar `Date.UTC()`/parse consistente.
- Teste de guarda: `tests/finance-timezone-business-day.test.mjs` (5 cenários), `tests/finance-transactions.test.mjs` (`FIXED_NOW='2026-07-17T12:00:00.000Z'`).

## 6. Armadilhas recorrentes (evitar regressão)

1. **Não usar `Set-Content -Encoding utf8`/PowerShell nos HTMLs** → BOM + mojibake cp1252. Se corromper, restaurar do `hosting-dist` e reescrever via Node (LF, sem BOM). Validar `git diff --stat` pequeno e ausência de BOM.
2. **Deploy de functions v2 em lote estoura quota de CPU Cloud Run** (20 vCPU us-central1). Deployar SERIAL (uma por vez) ou em grupos de 2-3. Ver `docs/runbooks/cloud-functions-deploy-quota-runbook.md`.
3. **firebase-init depende 100% do CDN gstatic** — se a rede do usuário bloquear `gstatic.com`, login e tudo falha com `ERR_CONNECTION_TIMED_OUT`. Ver nota na seção 8.
4. **O override inline de modais nas páginas de romaneio** sobrescreve guards/globals de módulos JS — ao adicionar guards, tanto o módulo quanto a página precisam cooperar.
5. **`npm test` usa regex sobre o código** — ao renomear constantes (ex.: `APP_VERSION`, `itemsPerPage`), atualizar os testes correspondentes em `tests/` (senão a suíte falha).
6. **`inject-cachebusters.mjs` só trata `<script>`**; mudanças em CSS/inline/sw exigem bump manual.
7. **Auth persistence = SESSION** (login limpa em `deep-clean.js`); testes manuais de login precisam reautenticar por sessão.

## 7. Qualidade / testes

- Comandos: `npm run lint` (eslint folha_pagamento), `npm run typecheck` (tsc allowJs), `npm test` (node:test), `npm run build:hosting` (para `hosting-dist`, 457+ arquivos), `firebase deploy --only hosting`.
- Estado da suíte em 2026-08-14: **416 testes / 415 pass / 0 fail**; financeiros 56/56.
- Diretório de testes: `tests/*.test.mjs` (node:test, lê arquivos e asserts via regex/funcional). Novos testes devem seguir esse padrão.

## 8. Incidente login `ERR_CONNECTION_TIMED_OUT` (gstatic) — 2026-08-14

- Sintoma: `firebase-app.js:1 Failed to load resource: net::ERR_CONNECTION_TIMED_OUT` (idem auth/database/functions/storage) no login.
- Diagnóstico: o browser não consegue alcançar `https://www.gstatic.com/firebasejs/10.7.1/*`. **Do ambiente de dev, todos os SDKs gstatic retornam 200** e o login/todas as páginas carregam normalmente. Trata-se de **bloqueio de rede/firewall/VPN/ISP do ambiente do cliente**, não de deploy errado, lint ou código.
- Impacto: sem gstatic, o app não inicia (0 SDKs → login impossível, nenhuma página funcional). Chamadas a CDNs (`cdnjs`, `jsdelivr`, `fonts.googleapis`) também podem falhar na mesma rede.
- Mitigação possível (não executada): vender os SDKs do Firebase localmente (ex.: `firebase/sdk/*.js`) espelhando o padrão já usado para o Sentry (`sentry/sentry.browser.min.js`), trocando imports de `firebase-init.js` para local. Isso remove a dependência de CDN para funcionamento básico. Avaliar impacto de licença (Apache 2.0/MIT) e tamanho (~200-400KB).
- **Próximo passo sugerido (se desejado):** implementar fallback/vendor dos SDKs e testar em rede sem acesso a gstatic.

## 9. Deploy / operações

- Hosting: `firebase deploy --only hosting` (build `hosting-dist` 457 arquivos, ~20MB).
- Functions: ver runbook de quota (seção 6.2). Deploy serial para v2.
- Sentry: callables `sentry*` exigem SuperAdmin; issues em RTDB `system/sentry/issues`. DSN ativo; `tracesSampleRate:0`.
- Rules RTDB: por tenant; billing budget topic `sisweb-cloud-billing-budget-alerts`.

## 10. Histórico recente (mini-log por data)

- **2026-08-15:** 
  - Otimização de performance $O(1)$ e zero-lag de abertura do modal de pedidos em Vendas (`vendas.js`) e Compras (`compras.js`);
  - Reutilização de `obterDadosEmpresa` no lote de impressão eliminando requisições repetidas;
  - Desbloqueio completo de edição em contas pendentes/vencidas sem pagamento no Financeiro (`financas.js`);
  - Cálculo de juros de mora e multa contratual (2%) por vencimento individual de fatura + suporte a Juros Compostos;
  - Backfill e migração atômica de `dataEmissao` em 331 contas legadas no Firebase RTDB;
  - Correção de CSP para ingest do Sentry no `index.html`;
  - Suíte completa passando com 416 testes executados / 415 pass / 0 falhas e deploy no Firebase Hosting ativo.
- **2026-08-14:** fix UTC financeiro (fuso SP front+back) deployado; fix modais romaneios (4/página, 26px, margin 0) deployado; runbook quota + handoff criados; verificação Login com gstatic OK daqui; incidente gstatic do cliente diagnosticado como rede.
- **2026-08-11:** handoff incidente Sentry (token SENTRY_API_TOKEN com escopo de escrita; 403 no Resolver resolvido).
- **2026-08-10:** commit guard folha normalizeMes; modal lista clientes unificado; monitoramento Sentry (story 2026-08-07).

## 11. Como manter este cérebro

- Atualizar após QUALQUER mudança de arquitetura, decisão, fix ou descoberta de armadilha.
- Referenciar story/plano com data para aprofundamento (documents em `docs/stories/`, `docs/superpowers/plans/`, `docs/runbooks/`).
- Manter seções curtas e orientadas a "evitar regressão" — este arquivo é memória operacional, não doc de specs.