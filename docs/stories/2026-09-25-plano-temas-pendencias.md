# Backlog: refinamentos tema light/dark (base C:\Sisweb, pós-Fase 20)

## Status
Aberto — auditoria 25/09 (gates verdes: lint+typecheck OK, 663 testes 662/0/1).

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
