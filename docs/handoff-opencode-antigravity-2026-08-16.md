# Handoff opencode → Antigravity (2026-08-16)

> Leia antes: `docs/core/CEREBRO-SISWEB.md` (seções 10, 13 e 14) e `docs/runbooks/war-room-equipe-erros.md`.

## O que o opencode resolveu nesta sessão

1. **BUG-A — Folha `cargos` `Permission denied`** (do War Room):
   - Fix: regra `companies/$companyId/cargos` adicionada em `database.rules.json` (espelho de `funcionarios`; `.read`+`.write` com company/assinatura; `.indexOn` nome/ativo).
   - **Pendente:** `firebase deploy --only database` (canônico via `firebase.json` → `database.rules.json`).
   - Validar depois: abrir `folha_pagamento/folha.html` logado como tenant normal e ver `📋 N cargos carregados` (sem `Permission denied`).

2. **BUG-B — NF-e seed `fiscal/naturezas-operacao` `PERMISSION_DENIED`**:
   - Fix: `.write` adicionado ao nó `fiscal` em `database.rules.json` (padrão company/assinatura).
   - **Pendente:** deploy das regras (junto com BUG-A).
   - Validar: abrir `notas-fiscais.html` e conferir que `nat_*` é salvo em `companies/{t}/fiscal/naturezas-operacao` sem warning `permission_denied`.

3. **BUG-C — Dupla prefixação `companies/{t}/companies/{t}/...`**:
   - Fix: em `firebaseService.js`, `checkCandidates = candidates.map(c => getNamespacedPath(c))` (antes concatenava `companies/${tenantId}/${c}` fixo). `getNamespacedPath` já protege caminhos que começam com `companies/`.
   - Sem deploy; suíte 449 pass / 0 fail.

4. **UI dos 5 modais de lista de romaneios (TL, PCT, PES, Tora, Pré-Romaneio) — 4 bugs corrigidos** (sessão posterior):
   - (1) Modal estourava o limite inferior da viewport: `min-height: 560px` fixo + `margin` + `padding-top:60px` do backdrop excediam `100vh`. Fix em `romaneio-comum.css` (seções 1363-1483 e 2085-2263) e `modules/core/romaneio-list-columns.js` (`injectStyles`): `min-height: min(560px, calc(100vh - 140px))` e `max-height: calc(100vh - 110px)`.
   - (2) Paginação sobrepunha o footer: `.table-container{min-height:280px !important}` empurrava `.rlc-pagination-bar` para fora do `.modal-body` (que tem `overflow:hidden`). Fix: `min-height: 0` na table-container (tabela rola internamente), pagination fica dentro do body, footer sempre visível.
   - (3) Controle de **Densidade** estava cortado/invisível (select morava na pagination empurrada para fora). Agora visível nos 5 modais.
   - (4) CSS duplicado/injetado removido de `romaneiopct.html`: bloco `#listaModal .modal-content{overflow-y:auto !important; max-height:90vh !important}` + `#listaModal{overflow:hidden !important}` era redundante/conflitante com a fonte canônica. Footer dos modais ganhou `flex-wrap:wrap; gap`.
   - **Validação no browser local (localhost, autenticado, viewport 624px):** TL/PCT/PES/Tora/Pré-Romaneio com `content.bottom <= viewport`, paginação dentro do body, densidade visível, sem sobreposição de botões no footer.
   - **Quality gates:** suíte **452 pass / 0 fail / 1 skip**; `tests/romaneios-modals-customization.test.mjs` 6/6; `npm run lint` e `npm run typecheck` limpos.

5. **Espaço vazio abaixo do footer nos modais de lista — corrigido** (sessão posterior):
   - Sintoma: nos modais "Lista de Romaneios" (TL/PCT/PES/Tora/Pré), "Lista de Clientes", "Lista de Espécies" e "Lista de Fornecedores", havia ~50px de vazio abaixo dos botões, com a tabela "resumida" em altura.
   - **Causa raiz:** regras inline genéricas `.modal-body { max-height: 350px }` (`romaneiotl.html`, `romaneiopes.html`, e `#speciesListModal .modal-body{max-height:350px}` em `romaneiotora.html`) limitavam o body a 350px; o `modal-content` tem `height:min(88vh,720px)` (514px), então o `flex:1` do body não preenchia e o excedente virava vazio abaixo do footer.
   - **Fix:** `max-height: none !important` nos seletores canônicos `.modal-body` — `modules/core/romaneio-list-columns.js` (`#rlc-styles`), `romaneio-comum.css` (blocos ~1136, ~1384, ~2218) — e removidas as regras inline `max-height:350px` dos HTMLs (`romaneiotl.html`, `romaneiopes.html`, `romaneiotora.html`).
   - **Validado no browser:** gap abaixo do footer = **1px** em todos os modais (era ~50px); tabela expande e rola internamente (`overflow-y:auto` — 17 linhas rolam sem empurrar o footer); density select, paginação e botões do footer preservados (Configurar Impressão 187px, Fechar 96px, sem overlap).
   - **Quality gates:** suíte **452 pass / 0 fail / 1 skip**; lint e typecheck limpos.

## Estado do working tree (MUITO IMPORTANTE)

- **Arquivos alterados pelo Antigravity (NÃO commitados, trabalho em andamento — não atropelar):**
  - Novos: `modules/core/romaneio-list-columns.js`, `tests/romaneios-modals-customization.test.mjs`.
  - Modificados: `modules/modals/modal-lista-romaneios.js`, `modules/romaneiopct/modal-lista-romaneios-pct.js`, `preromaneio-modals.js`, `romaneio-manager.js`, `romaneiopes.html`, `romaneiotl.html`, `romaneiotora.html`, `romaneiopct.html`, `preromaneio.html`, `romaneio-comum.css`, `auth.js`, `tests/e2e-browser-romaneios.test.mjs`, `package.json` (puppeteer), cache-busters em HTMLs admin/login/vendas/compras/etc.
- **Arquivos alterados pelo opencode (esta sessão):** `database.rules.json` (BUGs A/B), `firebaseService.js` (BUG-C), `romaneio-comum.css` + `modules/core/romaneio-list-columns.js` + `romaneiopct.html` + `romaneiotl.html` + `romaneiopes.html` + `romaneiotora.html` (fix UI modais: overflow viewport, densidade, botões do footer, **espaço vazio abaixo do footer**), `docs/core/CEREBRO-SISWEB.md`, `docs/runbooks/war-room-equipe-erros.md`.
- **Sem sobreposição de arquivos** entre as duas partes (refinamento dos arquivos do Antigravity, sem atropelo).

## Próximos passos sugeridos

1. **Commitar o trabalho de modais de romaneios** que ficou em andamento (revisar `romaneio-list-columns.js` + integração nos 5 modais; rodar `romaneios-modals-customization.test.mjs` e o e2e puppeteer).
2. **Deploy das regras** (`firebase deploy --only database`) — coordenar com o opencode/Nelson, pois afeta todos os tenants.
3. Depois do deploy, validar folha (cargos) e notas-fiscais (seed naturezas) em produção.
4. Manter a suíte verde: **452 pass / 0 fail** (1 skip).

## Não tocar sem coordenar
- `database.rules.json` / `firebase-rules-*.json` (regras de produção — impactam todos os tenants).
- Regra de ouro das funções v2: deploy SERIAL (quota 20 vCPU Cloud Run).