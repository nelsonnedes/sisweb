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

## 10. Erros abertos encontrados na navegação autenticada (2026-08-16)

> **STATUS 2026-08-16 (opencode):** BUGs A/B/C **CORRIGIDOS no código/regras**.
> Pendente: **deploy das regras** (`firebase deploy --only database` para `database.rules.json`).
> BUG-C sem deploy (código) — validado por suíte (449 pass / 0 fail).

Navegação real (madeportes27@gmail.com, tenant `1774030248295`): index, finanças, vendas, estoque, espécies, romaneio pct, folha, notas-fiscais, mdf-e, compras — sem erros na maioria. Erros reais em **Folha** e **Notas Fiscais**:

1. **BUG-A — Folha: `cargos` com `Permission denied` p/ tenant normal.**
   - Sintoma (folha.html): `❌ Erro ao carregar cargos: Permission denied` (folha-firebase-manager.js:369), `⚠️ Sem permissão para carregar cargos` (folha-cargos.js:592), `❌ Erro ao carregar dados: unknown`.
   - Causa: `CARGOS_CONFIG.COLLECTION='cargos'` → `_resolvePath('cargos')` lê `companies/{tenant}/cargos`. Em `database.rules.json` NÃO havia `companies/$companyId/cargos` com `.read` (só `folha/cargos` com `.write`, linha 148; `funcionarios`/`folhas` top-level têm `.read` linhas 197/202). Cai na regra raiz `$companyId.read: superadmin` (linha 9) → negado.
   - **Fix aplicado (2026-08-16):** adicionado `cargos` em `companies/$companyId` (`.read`+`.write`, padrão `funcionarios`, `.indexOn` nome/ativo) em `database.rules.json`. **Falta deploy `--only database`.**

2. **BUG-B — Notas Fiscais: salvar `fiscal/naturezas-operacao` → `PERMISSION_DENIED`.**
   - Sintoma: `set at /companies/1774030248295/fiscal/naturezas-operacao/nat_* failed: permission_denied` (11x, seed padrão) + `❌ Erro ao salvar dados no Firebase: PERMISSION_DENIED`.
   - Causa: regra `fiscal` em `database.rules.json:235` só tem `.read` (sem `.write`). `nf-naturezas.js` chama `saveToFirebase('companies/{t}/fiscal/naturezas-operacao', nat.id, payload)`.
   - **Fix aplicado (2026-08-16):** `.write` adicionado ao nó `fiscal` em `database.rules.json` (padrão company/assinatura). **Falta deploy `--only database`.**

3. **BUG-C — Dupla prefixação de caminhos que já começam com `companies/`.**
   - Sintoma: `🧭 Caminhos candidatos para escrita: ["companies/1774030248295/companies/1774030248295/fiscal/naturezas-operacao"]` (tenant duplicado).
   - Causa: `firebaseService.js:2099` (`checkCandidates = candidates.map(c => companies/${tenantId}/${c})`) prefixa de novo caminho canônico já com `companies/`. `getNamespacedPath()` (linhas 71/1303) já protege (`startsWith('companies/')` retorna direto) — o log é diagnóstico, mas confunde e pode gerar verificação de existência errada.
   - **Fix aplicado (2026-08-16):** `checkCandidates` em `firebaseService.js` usa `getNamespacedPath(c)` em vez de concatenação fixa. Sem deploy; validado pela suíte.

## 11. Histórico recente (mini-log por data)

- **2026-08-16:** navegação autenticada completa + War Room (`docs/runbooks/war-room-equipe-erros.md`); BUGs A/B/C abertos (folha cargos permission; fiscal write; dupla prefixação).
  - Correção de edição/salvamento de espécies nos modais de Romaneio TL, PCT, PES e Tora (`romaneiotl.html`, `romaneiopct.html`, `romaneiopes.html`, `romaneiotora.html`): implementado `saveToFirebase(path, key, data)` com invalidação de cache no `firebase-service.js`, adicionado suporte a `invalidate()` e recarga forçada no `species-store.js` (`SiswebSpeciesStore`), e corrigida a validação de duplicidade e recarga da tabela de espécies em `modules/crud/gerenciar-especies.js`;
  - Correção de sincronização instantânea em Espécies (`species.html` / `js/species.js`): atualização otimista local + invalidação profunda de cache multi-alias (`especies`, `species`, etc.) no `firebase-service.js`, garantindo que a lista atualize na hora ao salvar/editar sem depender de F5;
  - Correção de verificação de duplicidade (`species-modal-standard.js`): `getSpeciesList` e `getExactDuplicate` agora priorizam a lista autoritativa em memória (`extraSource`), evitando falsos positivos de duplicidade gerados por chaves legadas e permitindo renomear e editar normalmente;
  - Correção de `RangeError: Maximum call stack size exceeded` (`modules/core/firebase-service.js`): removida reatribuição circular/auto-referencial que sobrescrevia `invalidateCache` na instância;
  - Análise e diagnóstico de Pen Test (OWASP ZAP);
  - Criação e deploy de `robots.txt` e `sitemap.xml` com regras de desindexação de áreas administrativas e privadas;
  - Configuração de cache e headers HTTP para robôs no `firebase.json`;
  - Suíte de 416 testes validada (0 falhas) e deploy no Firebase Hosting ativo.
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

## 13. Sincronia opencode × Antigravity (2026-08-16)

- **Antigravity (sessão anterior, commits):** unificação de ações/footers/cores dos modais das 5 páginas de romaneio; **`romaneio-list-columns.js` novo** (947 linhas: redimensionamento de colunas, densidade de linhas, paginação dos Modais de Lista TL/PCT/PES/Tora/Pré); e2e puppeteer em `tests/e2e-browser-romaneios.test.mjs`; `auth.js` com `window.__skipAuthRedirect` (guard de loop de redirecionamento); `tests/romaneios-modals-customization.test.mjs`.
- **Onde parou (working tree NÃO commitado — 30 arquivos + 2 novos):** `modules/modals/modal-lista-romaneios.js` (+177), `preromaneio-modals.js` (+93), `romaneio-manager.js` (+70), `romaneiopct/modal-lista-romaneios-pct.js` (+89), `romaneiopes.html` (+118), `romaneio-comum.css`, `auth.js`, cache-busters nos HTMLs, `package.json` (puppeteer). **NÃO reverter/commit por cima sem revisar.**
- **opencode (esta sessão):** BUGs A/B/C corrigidos (`database.rules.json`: `cargos` top-level + `.write` em `fiscal`; `firebaseService.js`: `checkCandidates` via `getNamespacedPath`). Suíte **449 pass / 0 fail**. Nenhuma sobreposição com arquivos do Antigravity.
- **opencode (sessão UI modais):** corrigidos os 4 bugs de interface dos 5 modais de lista (TL, PCT, PES, Tora, Pré-Romaneio) validados no browser local (localhost, autenticado): (1) `modal-content` estourava viewport (`min-height:560px` fixo → `min-height:min(560px, calc(100vh - 140px))` e `max-height:calc(100vh - 110px)` em `romaneio-comum.css` + `modules/core/romaneio-list-columns.js`); (2) paginação sobrepunha o footer (`table-container{min-height:280px}` → `min-height:0`, tabela rola internamente e `.rlc-pagination-bar` fica dentro do body); (3) Densidade visível (antes cortada/`clipped`); (4) removido CSS duplicado/injetado do `romaneiopct.html` (`#listaModal .modal-content{overflow-y:auto;max-height:90vh}` redundante). Footer ganhou `flex-wrap:wrap; gap`. **Validado:** TL/PCT/PES/Tora/Pré content bottom ≤ viewport, pag dentro do body, density visível, sem overlap de botões. **Suíte 452 pass / 0 fail / 1 skip** (+3 regressão BUGs A/B/C); `romaneios-modals-customization` 6/6; lint e typecheck limpos. Nenhuma sobreposição com working tree do Antigravity.
- **opencode (sessão UI modais — rodapé/altura):** corrigido espaço vazio abaixo do footer nos modais de lista (Lista de Romaneios TL/PCT/PES/Tora/Pré, Lista de Clientes, Lista de Espécies, Lista de Fornecedores). **Causa raiz:** regras inline genéricas `.modal-body { max-height: 350px }` (romaneiotl.html, romaneiopes.html, `#speciesListModal` no romaneiotora.html) limitavam o body a 350px, impedindo o `flex:1` de preencher o `modal-content` com `height:min(88vh,720px)` (514px) → ~50px de vazio abaixo dos botões. **Correção:** `max-height: none !important` nos seletores canônicos `.modal-body` (`romaneio-list-columns.js` `#rlc-styles` bloco modal-body; `romaneio-comum.css` blocos 1384-1393, 2218-2225 e 1136-1145; removido `max-height:350px` de speciesListModal) + removidas as regras inline `max-height:350px` dos HTMLs. **Validado no browser:** gap abaixo do footer = 1px em todos os modais (era ~50px); tabela expande (table-container flex:1, scroll interno com overflow-y:auto — 17 linhas rolam, footer fixo sem overlap; density select e paginação visíveis; botões Configurar Impressão/Fechar em tamanho natural). **Suíte 452 pass / 0 fail / 1 skip**; lint e typecheck limpos.
- **opencode (sessão UI modais — barra centralizada + Exibir/Densidade em Clientes/Espécies):** (1) `.rlc-pagination-bar` agora `justify-content: center` (antes `space-between`) em `modules/core/romaneio-list-columns.js` → "Exibir:", "Densidade:" e paginação ficam centralizados e alinhados na horizontal nos modais de romaneio; (2) adicionados selectors de densidade com ID (`body #clientListModal/.speciesListModal/.fornecedorListModal.rlc-density-{compact,normal,comfortable} .table tbody td/tr/.btn-group/.action-button/table button`) nos 3 blocos de densidade do rlc → densidade agora altera altura de linha/botões nos modais Clientes/Espécies/Fornecedores (vence `#clientListModal .table tbody td { height:26px !important }` de `romaneio-comum.css`); (3) modais Clientes/Espécies reutilizam `renderPaginationBar` (pageKey `clientes`/`especies`) com `onPageSizeChange`/`onDensityChange`/`onPageChange`, exibindo sempre a barra e sincronizando `itemsPerPage` com `getPageSize` em: `modules/modals/modal-clientes.js`, `modules/modals/modal-especies.js`, `modules/romaneiopct/modal-clientes-pct.js`, `modules/romaneiopct/modal-especies-pct.js`, `preromaneio-modals.js` (clientes `preromaneio-clientes`/espécies `preromaneio-especies` via `renderPagination` com 5º arg pageKey), `romaneiopes.html` (clientes `pes-clientes`/espécies `pes-especies` via `renderPaginationControls` com pageKey). Fallback legado preservado quando `RomaneioListColumns` não existe. **Suíte 452 pass / 0 fail / 1 skip**; `node --check` OK; lint/typecheck limpos (não cobrem os arquivos alterados).
- **opencode (sessão colunas "se movem" + barra no Fornecedores + PES print + PERMISSION_DENIED Configurar Impressão):** (1) **Causa raiz das colunas "pulando"**: `table-layout:fixed` + `width:100%` esticava colunas além do px (soma CSS 1020 vs tabela 1111) e redistribuía espaço ao aparecer/rolar a scrollbar → resize não-linear (+24px por +1px mouse). **Fix:** `ensureFixedLayout` em `modules/core/romaneio-list-columns.js` seta inline `width:auto !important; min-width:0 !important; max-width:100% !important` + classe `rlc-fixed`; `scrollbar-gutter: stable !important` em `.table-container`/`.modal-table-scroll` (rlc `#rlc-styles` + `romaneio-comum.css` ~1157-1167). Validado: resize linear `[1,2,3,4,5]` (antes saltos ~15-24px). (2) **Barra Exibir/Densidade/paginação no modal Lista de Fornecedores** (romaneiotora + preromaneio via `fornecedor-modals.js` `renderFornecedorListBasic`): passa a usar `renderPaginationBar` (pageKey `fornecedores`, `getPageSize`/`setPageSize`); cache-buster do script bumpado (`?v=2f5a1c9e8d77`) em tora/preromaneio. **Validado nos 15 modais de lista** das 5 páginas (TL/PCT/PES/Tora/Pré × Romaneios/Clientes/Espécies/Fornecedores) com barra rlc. (3) **PERMISSION_DENIED ao salvar Configurar Impressão** (`romaneio-print-config.js` salva em `companies/{t}/configuracoes/romaneioPrintColumns/{tipo}`): faltava nó `configuracoes` nas rules → adicionado `configuracoes` (read/write tenant, mesmo padrão `preferences`) em `database.rules.json` — **requer `firebase deploy --only database`**. (4) **Dropdown de impressão do PES padronizado**: `romaneiopes.html` trocou `print-dropdown`/`print-menu`/`togglePrintMenu` custom por `.dropdown`/`.dropdown-content` (links `Completo`/`Sem Preço Unitário`/`Sem Preços`, `position:fixed` ao abrir, fecha outros) igual TL/PCT/Tora. **Suíte 452 pass / 0 fail / 1 skip**; `node --check` OK; lint/typecheck limpos.

## 14. Recomendações para o Antigravity continuar (2026-08-16)

1. **BUGs A/B já corrigidos nas regras** — falta `firebase deploy --only database` (canônico `database.rules.json` via `firebase.json`). Depois validar folha (cargos) e NF-e (seed naturezas) com tenant real.
2. **Terminar o trabalho de modais de romaneios** que ficou no working tree: revisar `romaneio-list-columns.js` + integração nos 5 modais, garantir testes `romaneios-modals-customization` e e2e puppeteer verdes, e commitar com mensagem clara.
3. **Cuidado com cache-busters:** HTMLs já com `?v=` novos no working tree; conferir `inject-cachebusters.mjs` só processa `<script>` (CSS manual).
4. **Não alterar `database.rules.json`** em paralelo com o Antigravity sem coordenar — mudanças de regras afetam todos os tenants em produção.
## 15. Sincronia opencode × Antigravity (2026-08-17)

- **Edição de Toras no Estoque (`estoque.js` / `estoque.html`):**
  - **Falso positivo de plaqueta duplicada**: A consulta de estoque filtra toras ativas (`status === 'disponivel'`), mas a validação de plaquetas varria todas as toras históricas. Criada a função `toraEstaAtivaNoEstoque(tora)` para ignorar registros com status `baixado`, `saida`, `consumido`, `estornado`, etc. Toras baixadas no passado não bloqueiam o reuso de plaqueta no saldo ativo.
  - **Otimização de largura de colunas**: Criada classe `.table col.medida { width: 85px; }` para dimensões técnicas (`diametro`, `comprimento`, `oco1`, `oco2`, `desconto`, `compGeo`, `x1`, `x2`, `x3`, `x4`), reduzindo o tamanho total das 4 tabelas de toras em ~35%. Alinhamentos harmonizados via `getEntradaColumnsDefs`.
- **Fixação Estática e Eliminação do Scroll do Backdrop nos Modais de Romaneios (`modules/core/romaneio-list-columns.js` / `romaneiopes.html` / `romaneio-manager.js`):**
  - **Causa raiz do movimento vertical na rolagem do mouse**: Em `romaneiopes.html` e `romaneiotora.js`, o overlay do modal possuía `overflow-y: auto` somado a paddings/margens, fazendo a janela inteira do modal rolar para cima e para baixo.
  - **Fix canônico**: Todos os overlays de modais de listagem (`#listaModal`, `#romaneioListModal`, `#clientListModal`, `#speciesListModal`, `#fornecedorListModal`, `div[id*="romaneioModal"]`) agora possuem `overflow: hidden !important; padding: 0 !important; margin: 0 !important; position: fixed !important; display: flex !important; align-items: center !important; justify-content: center !important;`. O `.modal-content` tem `margin: 0 auto !important; height: calc(100vh - 48px) !important; max-height: 760px !important; min-height: 380px !important;`. O scroll vertical roda exclusivamente dentro da tabela (`.table-container, .table-responsive { overflow-y: auto !important; }`), mantendo o modal 100% estático no centro da tela.
  - **Densidade em Tempo Real**: `setRowHeight` propaga classes (`rlc-density-compact`, `rlc-density-normal`, `rlc-density-comfortable`) diretamente no `document.body` e em todos os modais da tela.
- **Quality Gates e Deploy**: `npm run validate:pr` (6/6 PASS), cachebusters injetados dinamicamente via `inject-cachebusters.mjs`, deploy no Firebase Hosting e post-deploy security check (37/37 checks aprovados).

## 16. Modernização do Estoque e Módulo StockTableColumns (2026-08-17)

- **Módulo `modules/core/stock-table-columns.js` (Novo):**
  - Gerencia o redimensionamento interativo de colunas (`.stock-resizer`) com persistência em `localStorage` (`sisweb_stock_cols_*`) para as 6 tabelas do estoque (`tabelaEntrada`, `tabelaSaidaToras`, `tabelaEstoque`, `tabelaMovimentacoes`, `tabelaProdutos`, `tabelaTorasDisponiveis`).
  - Cabeçalhos `sticky` com gradiente escuro canônico (`#2c3e50` a `#34495e`), texto em alto contraste, `box-shadow` e `scrollbar-gutter: stable`.
  - Registrado em `hosting-files.json` e importado com cachebuster dinâmico em `estoque.html`.
- **Botões de Ação Canônicos no Estoque:**
  - Padronizados com `stock-btn-action` (28px × 28px, bordas arredondadas, ícones centralizados): `stock-btn-edit` (`#3498db`), `stock-btn-delete` (`#e74c3c`), `stock-btn-down` (`#e67e22`), `stock-btn-history` (`#6f42c1`).
- **Relatórios de Estoque com Cards Métricos (`stock-summary-grid` / `stock-summary-card`):**
  - Substituído o antigo `summary-box` por grid responsivo de cards com ícones temáticos (`blue`, `green`, `purple`, `amber`) para Total de Toras, Volume Total, Volume Geométrico, Valor Total, Entradas, Saídas, Saldo e Rendimento Médio.
- **Validação e Deploy**: Testes unitários `tests/stock-table-columns.test.mjs` (3/3 PASS), validação E2E com Puppeteer em produção com credenciais reais, `npm run validate:pr` (6/6 PASS) e deploy no Firebase Hosting.

## 17. Orientação de Impressão, Ajuste de Colunas Flexível, Relatório por Fornecedor e Campo AUTEF (2026-08-17)

- **1. Orientação de Impressão (Retrato / Paisagem) nos Relatórios de Estoque (`estoque.html` / `estoque.js`):**
  - **Causa raiz**: `@page { size: landscape; margin: 10mm; }` estático ignorava os botões de orientação do navegador na impressão do iframe.
  - **Correção**: Implementados alternadores Retrato / Paisagem no header do modal de pré-visualização (`#relatorioPreviewModal`). Criada a função `alterarOrientacaoPreviewRelatorio(orientacao)` que injeta dinamicamente `<style id="print-orientation-style">@page { size: ${orientacao} !important; margin: 10mm; }</style>` no documento do iframe e atualiza `pdfOptions.orientation` para o contexto PWA.
- **2. Redimensionamento de Coluna Flexível (`modules/core/stock-table-columns.js`):**
  - **Causa raiz**: O tamanho do texto do título da coluna travava a largura mínima ao ajustar com o mouse.
  - **Correção**: A tabela agora usa `table-layout: fixed !important;` com `th, td { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`, tooltip nativo `title` ao passar o mouse e `Math.max(25, ...)` no manipulador de resize, permitindo encolher livremente a coluna mesmo que o texto do título seja longo.
- **3. Inclusão Canônica do Campo AUTEF e Novos Relatórios (`estoque.html`, `estoque.js`, `romaneiotora.html`, `romaneiotora.js`, `tora-geometry-utils.js`):**
  - **Campo AUTEF**: Integrado no formulário de entrada (`autefEntrada`), formulário de saída manual (`manualAutefSaida`), formulário de romaneio de toras (`autef`), navegação por Enter (`configurarNavegacaoEnter` e `camposSequencia`) e persistência geométrica/tora (`normalizarCamposGeoItem`, `normalizarCamposGeoEstoque`, `normalizarCamposGeoTora`).
  - **Alinhamento do Grid no Formulário**: `#entrada .entrada-tora-grid` ajustado para `grid-template-columns: minmax(110px, 0.65fr) minmax(100px, 0.55fr) minmax(120px, 0.7fr) minmax(280px, 1.8fr);`, permitindo que Plaqueta, Custódia, AUTEF (largura compacta com folga) e Espécies fiquem alinhados na mesma linha.
  - **Sincronia das Células da Tabela**: Corrigida a renderização de linhas em `renderizarTabelaEntrada` e `torasDisponiveisTable` com a inclusão de `<td data-col="autef">${geo.autef || item.autef || '-'}</td>` após Custódia, eliminando deslocamento de colunas.
  - **Relatórios Automáticos Reativos**: Filtros (`tipoRelatorio`, `relDataInicio`, `relDataFim`, `relFiltroTipo`, `relAgruparResponsavel`) aplicam o relatório imediatamente ao mudar de valor e na abertura da aba (`showTab('relatorios')`), sem necessidade de botão manual de gerar.
  - **Resize Dinâmico nos Relatórios**: As tabelas de relatórios agora recebem `StockTableColumns.initTable` dinamicamente em cada renderização com layout fixo e persistência de larguras.
  - **Novos Tipos de Relatório**:
    - `fornecedor` ("Estoque por Fornecedor (Toras)"): gerado por `gerarRelatorioPorFornecedor(onlySelected)` com métricas agregadas por fornecedor (quantidade, volume líquido, volume geométrico, médias de rodo/comprimento/volume, preço médio e valor total).
    - `especies` ("Estoque Agrupado Por Espécies (Toras)"): renomeado e mantido com agregação completa.
    - `autef` ("Estoque Por AUTEF (Toras)"): gerado por `gerarRelatorioPorAutef(onlySelected)` (mantendo compatibilidade com `localizacao`).
  - **Padronização e Expansão do Módulo de Almoxarifado / Produtos (`estoque_produtos.js`, `estoque.html`):**
    - **Provisão de Rescisão Detalhada Completa (Individual TRCT e Consolidado)**: Reestruturada e aprofundada a lógica do relatório `provisao_rescisao_detalhada` em `folha_pagamento/folha-relatorios.js`.
      - **Modo Individual (quando "Todos os Funcionários Ativos" está desativado)**: Renderiza um **Termo de Rescisão de Contrato de Trabalho (TRCT) / Demonstrativo Rescisório de Fato**, com identificação oficial das partes, rubricas detalhadas de proventos (Saldo de Salário com dias úteis, Aviso Prévio com Lei nº 12.506/2011 [30 a 90 dias], 13º Salário proporcional e sobre aviso, Férias proporcionais + 1/3, Férias vencidas + 1/3, Férias sobre aviso + 1/3, Adicionais de periculosidade, insalubridade, noturno e horas extras), deduções detalhadas (INSS sobre saldo e 13º, IRRF com dependentes, desconto de faltas não justificadas e DSR, vales/adiantamentos e outros descontos), quadro de valor líquido a receber, demonstrativo de FGTS com Multa Rescisória de 40% (GRRF), custo global da empresa e termo de declaração com campos para assinaturas.
      - **Modo Consolidado (quando "Todos os Funcionários Ativos" está ativado)**: Renderiza um relatório gerencial analítico executivo em formato de tabela completa com todas as colunas de proventos, descontos, líquido a pagar, multa FGTS e custo por colaborador, acompanhado de cards executivos de topo e rodapé com total geral consolidado da empresa.
      - **Controle Interativo de Impressão, Orientação Dinâmica (Retrato / Paisagem) e Eliminação de Barras de Rolagem no PDF**:
        - Adicionada barra de controle interativa no topo da pré-visualização de impressão (com botões estilizados para Imprimir/Salvar PDF, alternar entre Retrato e Paisagem dinamicamente e Fechar, automaticamente oculta em `@media print`).
        - Implementada a função `window.trocarOrientacao(orientacao)` que recalcula a escala responsiva (`--fs`) e atualiza o `@page` em tempo real.
        - Eliminadas divs com `overflow-x: auto` e declarada a supressão absoluta de barras de rolagem (`::-webkit-scrollbar { display: none !important; }` e `overflow: visible !important;` em `@media print`), garantindo que tanto a impressão quanto o PDF gerado caibam 100% na largura da folha sem estourar e sem barras de rolagem no rodapé.
    - **Impressão Única e Estável de Recibos/Holerites (`folha.html`)**: Corrigida a abertura de abas duplicadas (`about:blank`) ao clicar no botão "Imprimir" na tabela de lançamentos. Eliminada a sobreposição de listeners no documento e contêiner que reexecutavam o clique, adicionada trava de concorrência/debounce em `window.printFolha` e `gerarReciboIndividualDetalhado` e garantida a renderização e impressão imediata do recibo em janela única.
    - **Sincronização Atômica Financeira de Vendas (`financeSyncVenda`)**: Criada a Cloud Function autoritativa `financeSyncVenda` (em `functions/finance-functions.js` e `functions/index.js`) espelhando o padrão transacional de compras. Ao salvar ou editar um pedido de venda em `vendas.js`, o pedido e suas parcelas a receber são sincronizados atomicamente no servidor via Admin SDK (com validação canônica de valores numéricos, datas `YYYY-MM-DD` e estorno/substituição de parcelas anteriores), eliminando rejeições de `updatePaths` e inconsistências no módulo financeiro.
    - **Povoamento Confiável de Relatórios de Almoxarifado**: Corrigido o carregamento de dados em `gerarRelatorioProdutosSaldo` e `gerarRelatorioProdutosMovimentacao`, sincronizando bidirecionalmente `window.paginaAtualRelatorio` e `window.totalItensRelatorioAtual` e eliminando o erro de slice `NaN`.
    - **Totais por Produto e Valor Financeiro por Responsável (`produtos_movimentacao`)**: Quando "Agrupar por Responsável" está marcado, o sistema renderiza automaticamente um painel executivo consolidado com a tabela de **Totais por Produto (Entradas, Saídas/Consumo, Ajustes, Preço Médio e Valor Total Consumido em R$)** e total geral do colaborador/responsável, omitindo cards gerais duplicados no final.
    - **Seleção Isolada por Checkbox na Tabela do Responsável**: Inserido checkbox dedicado no cabeçalho da tabela de cada responsável (`.check-grupo-responsavel`), permitindo selecionar/desselecionar com 1 clique **APENAS** as movimentações daquele responsável, com sincronização automática com `window.relatorioSelecionados` e o checkbox mestre.
    - **Modal Profissional de Edição de Produtos (`#modalEditarProdutoAlmoxarifado`)**: Criado modal dedicado com **100% de todos os campos editáveis** (`Nome`, `Categoria`, `Localização Física`, `Unidade`, `Quantidade/Saldo`, `Estoque Mínimo`, `Preço Médio Unitário`, `Documento/NF`, `Responsável`, `Data da Alteração`, `Motivo/Observações`), mantendo o usuário na mesma aba e sem recarregar a tela.
    - **Card de Filtros Redesenhado & Responsivo**: Área de filtros do Almoxarifado redesenhada em container com CSS Grid responsivo (`minmax(165px, 1fr)`) e barra de ações inferior claramente separada, eliminando qualquer sobreposição visual de botões ou campos.
    - **Alinhamento do Cabeçalho de Relatórios de Estoque**: Substituído o texto duplicado *"Resultado do Relatório"* pelo controle *"Agrupar por Responsável"* perfeitamente alinhado e responsivo.
    - **Parâmetros de Reposição & Alertas (Opção 1)**: Inclusão do campo `estoqueMinimo` (Ponto de Pedido / Estoque Mínimo) e coluna `status` com badges coloridos (🟢 *Normal*, 🟡 *Ponto Pedido*, 🔴 *Crítico*).
    - **Categorização & Localização Física (Opção 2 - "Galpão / Escritório")**: Inclusão dos campos `categoria` (*Geral, EPI, Peças / Mecânica, Óleos & Lubrificantes, Elétrica, Ferramentas, Combustíveis, Material de Escritório, Outros*) e `localizacao` (*Galpão, Escritório, Oficina, Serraria, Refeitório*), com filtros dedicados na aba de produtos.
    - **Tabela Fluida e Adaptativa**: Implementada a classe `.table-report-estoque` com `.report-table-container` (`min-width: 0 !important; width: 100% !important; table-layout: fixed !important;`).
    - **Renderização Dinâmica do DOM**: `<colgroup>` e `<thead>` gerados dinamicamente com base estritamente nas colunas visíveis ativas do modal *Configurar Colunas*.
    - **Redimensionamento Interativo**: Ativado `StockTableColumns.initTable(tabelaProdutos, 'produtos_saldo')` com persistência local de larguras de colunas.
    - **Posicionamento Canônico dos Totais**: Removidos os cards soltos do topo e consolidados os 4 cards executivos **abaixo da paginação**:
      1. 📦 `Itens Cadastrados`
      2. 🔢 `Quantidade Total`
      3. 💰 `Valor Total em Estoque (R$)`
      4. ⚠️ `Estoque Baixo / Crítico`
    - **Impressão Direta e Profissional (`imprimirEstoqueProdutos`)**: Impressão direta (`preview: false`) de 100% dos produtos do filtro quando sem seleção ou dos selecionados, com cabeçalho oficial multitenant e os 4 cards consolidados.
  - **Padronização da Aba "Consultar Estoque" (`estoque.js`, `estoque.html`):**
    - **Inclusão de Oco 1 e Oco 2**: Adicionadas as colunas `oco1` ("Oco 1 (cm)") e `oco2` ("Oco 2 (cm)") na tabela `#tabelaEstoque`, na modal de *Configurar Colunas* e no gerador de relatórios/impressão.
    - **Tabela Adaptativa e Redimensionamento**: Implementado colgroup adaptativo com suporte a `StockTableColumns.initTable(tabelaEstoque, 'consulta_estoque')`, ajustando a largura da tabela fluidamente.
    - **Posicionamento Canônico dos Totais e Médias por Espécie**: Removidos os blocos redundantes e posicionados os 4 cards consolidados (`Total de Toras`, `Volume Líquido Total`, `Volume Geométrico Total` e `Valor Total`) e o painel de **Médias de Rodo e Volume por Espécie** **abaixo da paginação**, calculados sobre 100% dos registros filtrados.
    - **Impressão Total vs. Seleção**: Impressão de 100% das toras/páginas do filtro aplicado quando sem seleção (`estoqueSelecionadas.size === 0`); quando há checkboxes marcados, imprime estritamente a seleção. O documento impresso/PDF incorpora os 4 cards de totais e o painel de médias por espécie, com orientação dinâmica (`auto`) e ocultação de controles (`.no-print`, `.actions-col`, `.actions-cell`).
  - **Paginação e Resumo Estatístico em Relatórios de Estoque (`estoque.js`, `estoque.html`, `estoque_produtos.js`):**
    - Opção inicial padrão: `<option value="">Selecione o tipo de Relatório</option>`, mantendo a interface limpa até a escolha explícita do usuário.
    - Opções padronizadas de paginação: `[10, 25, 50, 100]` com persistência em `localStorage` por empresa/usuário.
    - Seletor "Itens por página" integrado com navegação de páginas (`mudarPaginaRelatorio`).
    - **Cards de Resumo Estatístico Consolidados**: Posicionados **abaixo da paginação** com os valores totais calculados sobre o conjunto completo de dados filtrados:
      - **Toras**: `Total de Toras`, `Volume Líquido Total`, `Volume Geométrico Total` e `Valor Total`.
      - **Saldo Atual de Produtos (Almoxarifado)**: `Itens Cadastrados`, `Quantidade Total`, `Valor Total em Estoque (R$)` e `Estoque Baixo / Crítico`.
      - **Movimentação de Produtos (Almoxarifado)**: `Total de Movimentações`, `Entradas (Registros / Qtd)`, `Saídas (Registros / Qtd)` e `Ajustes & Devoluções`.
    - **Médias de Rodo e Volume por Espécie**: Painel consolidado posicionado **logo abaixo dos cards de totalizadores**, apresentando cards individuais por espécie contendo `Média Rodo: X,X cm` e `Média Volu: X,XXX m³`, com a mesma lógica e precisão aplicadas em `romaneiotora.html`.
    - **Unificação de Totais na Impressão e em Tela**: `gerarRodapeRelatorio` unificado para evitar qualquer duplicação redundante de totais em tela ou no documento impresso/PDF gerado.
    - **Impressão Total vs. Seleção**: Quando nenhuma linha está selecionada, o sistema repassa `disablePagination: true` para todas as funções de relatório (toras e almoxarifado), imprimindo **100% de todas as páginas/registros do filtro aplicado**. Quando há seleção, imprime estritamente os itens selecionados.
- **4. Quality Gates e Deploy**:
  - `node --check` 100% OK em todos os arquivos modificados.
  - `inject-cachebusters.mjs` atualizado.
  - `npm run validate:pr` 6/6 PASS (lint, typecheck, 460 testes unitários, PR focus e auditoria de cachebusters).
  - Deploy em produção realizado com sucesso no Firebase Hosting e 37/37 checks aprovados no post-deploy security check.

## 12. Como manter este cérebro

- Atualizar após QUALQUER mudança de arquitetura, decisão, fix ou descoberta de armadilha.
- Referenciar story/plano com data para aprofundamento (documents em `docs/stories/`, `docs/superpowers/plans/`, `docs/runbooks/`).
- Manter seções curtas e orientadas a "evitar regressão" — este arquivo é memória operacional, não doc de specs.