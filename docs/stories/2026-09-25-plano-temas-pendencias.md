# Backlog: refinamentos tema light/dark (base C:\Sisweb, pós-Fase 20)

## Status
Em dia — 28/09 Fase 25.5 (gates verdes: lint+typecheck OK, 676 testes 676/0/1).
Em dia — 04/10 thead marca no estoque (gates verdes: lint+typecheck OK, 727 testes 727/0/1).

## 04/10 — thead marinho fantasma no estoque (resolvido, validado pelo usuário)
- [x] Forense no browser: `backgroundImage` chegava como
      `linear-gradient(135deg, #2c3e50→#34495e)` hardcoded de stylesheet obsoleto
      em cache; vars saudáveis (`--primary-color #fe6a00`), sem poisoning de tema.
- [x] Regra thead ancorada em ID `(1,1,2)` + `!important` + posição após os `<link>`
      (`estoque.html`): cobre `#tabelaEntrada/SaidaToras/Estoque/Movimentacoes/
      Produtos/TorasDisponiveis`, `#rastreabilidadeModal table` (ID está no modal,
      não na tabela), `table.saida-plaqueta-results-table` (sem classe `.table`),
      fallback `table[id^="tabela"]` + `.table thead th`; variante `sticky-actions`.
- [x] Lock das abas `.tabs .tab/.active/:hover` nos tokens com `!important`
      (mesma vulnerabilidade ao stale, sem mudar layout).
- [x] `?v=` por hash de conteúdo nos 4 CSS com versão estática em `estoque.html`
      (commerce `41ca2775b90e`, tokens `48ded6f95e02`, shell `c1329199a1c6`,
      content `db8b0cf45fdc`) — invalida cache HTTP + SW de uma vez.
- [x] Telemetria `theme-check` do thead no boot (prova do CSS aplicado).
- [x] Commits `467a494`, `75f3788`, `c49edd9`, `ab8cd81`, `0a3f842` + publish
      produção (verificado via fetch: regra ID e `?v=` novos no ar).

## 04/10 (cont.) — blindagem geral anti-stale
- [x] Mesmo padrão ID-ancorado em `vendas.html` (IDs + `table.table.commerce-*`)
      e `compras.html` (upgrade da regra sem `!important`).
- [x] `scripts/sync-css-cachebusters.mjs`: 95 `?v=` estáticos → hash de conteúdo
      em 27 páginas (fora: `backup/`, `subscription.html` — trabalho paralelo).
      Commit `54d7d72` + publish (verificado via fetch em vendas/compras).
- [x] SW mantido em `staleWhileRevalidate` para CSS: agora seguro (URL muda com
      o conteúdo); JS crítico de auth já era `networkFirst`. Migração de `?v=`
      de JS fica como trabalho futuro.
- [x] Telemetria `theme-check` mantida (1 log/boot; valor diagnóstico provado).
- [ ] Aguardando usuário: limpeza de espécies-lixo em Gerenciar Espécies.
- [ ] Aguardando antigravity: `tmp/redesign-*.json` (~40MB) — avaliar ao término
      e atualizar artefatos.
- [ ] Soak A4: remoção física dos globais após 09/10 (`docs/legacy-removal-gate.md`).

## 04/10 (cont.2) — `?v=` de JS por hash (sem regressão)
- [x] Inventário: 296 pares `js?v=`; escopo real = 5 refs estáticas
      (`folha.html` document.write auth-diagnostics + commerce-pdf-share,
      `estoque.html`/`user-profile.html` import firebaseService,
      `portal-parceiro.html` src sisweb-theme) + 7 hashes obsoletos
      (firebase-init, romaneio-comum, layout-comum). Fora: `.codex-worktrees/`
      (duplicatas), `backup/`, `subscription.html`, dinâmicos via variável
      (`menu-component` Date.now/PWA, `ADMIN_ASSET_VERSION` hash-format).
- [x] `sync-css-cachebusters.mjs` cobre `src=` + `from`/`import()`; flags
      `--check`/`--resync`; pós-aplicação `--check --resync` = 0.
- [x] Deduplicação natural: mesmo arquivo → mesmo `?v=` em todas as páginas
      (firebaseService `7e1ef38a`, commerce-pdf-share `e6699735`, etc.).
- [x] Validação cruzada: hashes conferidos via `Get-FileHash` independente.
- [x] Gates verdes (lint+typecheck, 727 testes 727/0/1), commit `590051d`,
      publish verificado via fetch (estoque + romaneiopct).

## Fase 25.5 — modais de lista na marca + fix parcelas (28/09)
- [x] rlc-styles (footer, thead border, paginação completa) → tokens.
- [x] Ações dos 5 romaneios no padrão vendas (marca; excluir danger).
- [x] Neutros temáticos (secondary/limpar/back/close/disabled/modelo-excel).
- [x] Bug parcelas: flush de debounce no início dos salvarPedido (vendas+compras) + teste novo.
- [x] Bump SW `2026-09-28-tema-marca-fase25-5` + publish produção.

## P0 — quebra visível (dark)
- [x] `login.html:155` h3 MFA `color:#2c3e50` → var (auth.css não cobre `h3` nu).
- [x] `vendas.html:1183` + `compras.html:1118` `legend` `#2c3e50` → var (sem regra dark).
- [x] `h4` sem contraparte dark: `vendas.html:1214,1292`, `compras.html:1143,1151,1233`,
      `company.html:2340` (`#2c3e50`) → `var(--sw-text-1)` (h1/h2/h3 já têm).
- [x] `romaneio-manager.js:488-492` injetado `tbody td{color:#333;border:#eee}` (ID vence
      o tema) + `:475-486` `thead th{#2c3e50}` + `:519-526` `.modal-footer{#f8fafc}` →
      overrides `html[data-theme="dark"]` no template (padrão Fase 17).
- [x] `species-manager.js:2110-2147` filtros `background:#fff!important;color:#111827!important` →
      `var(--sw-input-bg)` / `var(--sw-text-1)` com `!important` no dark.
- [x] `estoque.html:190-196` `tr:active{background:#f8fafc!important}` → guarda dark.
- [x] `financas.html:1046-1049` `td[data-label=Selecionar]{background:#f8fafc!important}` → var.
- [x] `estoque.html:3202` box inline `#f8fafc/#475569` → surface/text vars.
- [x] `subscription-status.html:89-91` painel interno `linear-gradient(#eff6ff,#fff)` → surface.
- [x] `admin-settings.html:333,374,404,460` + `admin-subscriptions.html:383-384,412`
      `#f8fafc/#334155` → vars (admin sem cobertura content-theme).
- [x] `romaneiopct.html:1834,1875,2092` + `romaneio-comum.css:1040,1230` `color:#2c3e50!important`
      → contraparte `html[data-theme="dark"]`.

## P1 — drift de marca / sutilezas
- [x] `.modal-header{linear-gradient(#2c3e50,#34495e)}` (`financas.js:458,525`,
      `compras.html:1939`, `romaneio-manager.js:411-419`) → `var(--sw-gradient)`.
- [x] `user-profile.html:78,172,251,357` roxo `#667eea` no CLARO (dark já coberto) → marca.
- [x] Ilhas claras: `financas.html:1863` `#fff3cd`, `financas.js:5548` `#e3f2fd`,
      `financas.js:5908` `#f9f9f9` → `var(--sw-alert-*)`.
- [x] `login.html:154,275,290` + `ajudabitolas.html:122,306` slates secundários → vars.
- [x] `folha_pagamento/folha.html:1260-1277,305-326` botões/ícones debug → semantic vars.
- [x] Bordas claras: `species-manager.js:760,911`, `menu-component.js:1126`,
      `romaneio-manager.js:557,577` → `var(--sw-border)`.
- [x] `vendas.html:1216`, `compras.html:1144,1152` `border:#dee2e6` → `var(--sw-border)`.
- [x] `estoque.html:866,899,1132,1191` + `financas.html:743` confirmar cobertura por ID.

## P2 — higiene (sem quebra)
- [x] `index.html:398` h1 inline + `login.html:145` register inline (cobertos; remover).
- [x] Origens Fase 17: `species-manager.js:761,912,1852`, `romaneio-comum.css` cobertos.

## Restos do plano
- [x] Onda A: evidência modal Configurar Impressão; veredito labels Almoxarifado/h2;
      recontagem do crawler.
- [x] Onda C: toast system check.

## Disciplina de workflow (standing rules)
- [x] Todo asset referenciado: tracked + em `hosting-files.json` (lição marqueting/*.ico).
- [x] Bump SW (`sw.js` + `PWA_VERSION`) a cada publish com mudança visual.
- [x] Nunca reescrever arquivos via cmdlets de texto PS 5.1 (mojibake) — node/Copy-Item/edit.
- [x] `C:\Sisweb\tmp\redesign-*.json` (40MB, untracked): decidir destino (arquivo externo).
- [x] Após qualquer mudança em CSS/JS: `node scripts/sync-css-cachebusters.mjs --check`
      (com `--resync` se o conteúdo mudou mas o `?v=` já era hash) — nenhum `?v=`
      obsoleto; nunca versionar trabalho paralelo junto.
