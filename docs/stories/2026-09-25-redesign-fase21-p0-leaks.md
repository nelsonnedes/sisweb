# Story: Fase 21 — P0 leaks (injetados, h4/legend, admin, species-standard)

## Status
Done (worktree C:\Sisweb, sem commit — publicar no lote seguinte)

## Contexto
Auditoria P0 da base C:\Sisweb (`docs/stories/2026-09-25-plano-temas-pendencias.md`).

## Implementação
- `romaneio-manager.js` (template injetado): overrides dark p/ `thead th`, `tbody td`,
  `.modal-footer` (claro = fallback light).
- `species-manager.js`: override dark p/ `.species-list-filter-input` + `#speciesListFilter`.
- `species-modal-standard.css`: override dark real do `#speciesListFilter` (+ `:focus`) —
  achado via CDP que a regra vencedora vinha deste arquivo, não do manager.
- `login.html`: MFA h3/shield/p em vars.
- `vendas.html` + `compras.html`: legends em `var(--sw-label)`, `border #dee2e6` em
  `var(--sw-border)`, h4s em `var(--sw-text-1)`.
- `company.html`: h4 em var. `estoque.html`: box do modal em vars.
- `financas.html`: faixa Selecionar em `var(--sw-surface-2)`.
- `styles/content-theme.css`: guarda `:active` tabelas estoque; links dropdown
  `#listaModal`; labels modais cadastros (`--sw-label !important`).
- `subscription-status.html`: `.message-center` em surface + 12 inline JS de
  severity em `var(--sw-alert-*)`.
- `admin-settings.html` + `admin-subscriptions.html`: superfícies/textos em vars.
- `tests/redesign-theme-regression.test.mjs`: teste Fase 21 (21/21 na suite).

## Validação
- `npm test` 663 pass / 0 fail / 1 skipped; lint+typecheck OK.
- QA `tmp/qa-fase21.mjs` em `:5501` (0 erros): legend `#c7cfd6`, hero subscription em
  gradiente, filtro species com texto `var(--sw-text-1)` (prova via CDP).

## File List
- `romaneio-manager.js`, `species-manager.js`, `species-modal-standard.css`
- `login.html`, `vendas.html`, `compras.html`, `company.html`, `estoque.html`
- `financas.html`, `subscription-status.html`, `admin-settings.html`
- `admin-subscriptions.html`, `styles/content-theme.css`
- `tests/redesign-theme-regression.test.mjs`, `tmp/qa-fase21.mjs`
