# Story: Fase 22 — P1, favicon marca, PWA install, toast (publish)

## Status
Done (C:\Sisweb, aguardando publish no mesmo lote)

## Contexto
Backlog `2026-09-25-plano-temas-pendencias.md` (P1) + Onda C (toast) + pedido:
favicon = `icone.ico` + install PWA mobile/desktop.

## Implementação
- Favicon: 30 HTMLs raiz + folha `favicon.ico` → `/assets/brand/icone.ico`
  (URL nova = cache-bust automático; PNGs/SVG mantidos; manifest segue PNG).
- Modal headers: `financas.js` (2), `compras.html` (1), `romaneio-manager.js` (1)
  slate → `var(--sw-gradient)`.
- `user-profile.html`: roxo `#667eea/#764ba2` → marca (hero, botões, ícones,
  focus, sombras) nos dois temas.
- Finanças: backup `#fff3cd` → warning tint; info parcial `#e3f2fd` → info tint;
  resumo `#f9f9f9` → surface-2.
- Login: MFA secundários em vars. Folha: botões/ícones debug em semantic vars.
- `species-manager.js`: `tr` JS com border em var + hover em `var(--sw-hover)`
  (inline ganhava do CSS — leak real).
- `romaneio-manager.js`: `.filter-input:focus` em marca.
- `styles/shell-theme.css`: links `.menu-quick-actions` no dark.
- `styles/content-theme.css`: header autocomplete estoque no dark.
- Toast (Onda C): verificado — z-index 10000000 (acima da paleta), surface
  temática, full-width no mobile; sem mudança necessária.
- PWA: manifest válido (3 ícones existentes), sw.js + manifest no hosting,
  SW ativo + botão `#sisweb-pwa-install-btn` visível (desktop), sem overflow 390px.
- `tests/redesign-theme-regression.test.mjs`: teste Fase 22 + Fase 15 sem
  depender do dump de 40MB em tmp (invariante agora: fora da raiz + nunca commitado).

## Validação
- Suite + QA `tmp/qa-fase22.mjs` + `tmp/qa-fase21.mjs` na consolidação do publish.

## File List
- 30 HTMLs (favicon) + `folha_pagamento/folha.html`
- `financas.js`, `financas.html`, `compras.html`, `romaneio-manager.js`
- `user-profile.html`, `login.html`, `species-manager.js`
- `styles/shell-theme.css`, `styles/content-theme.css`
- `tests/redesign-theme-regression.test.mjs`
- `docs/stories/2026-09-25-plano-temas-pendencias.md`
- `tmp/qa-fase22.mjs`
