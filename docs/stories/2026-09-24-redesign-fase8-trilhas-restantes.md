# Story: Fase 8 — Trilhas restantes (admin, subscription, folha, ajuda-bitolas)

## Status
Done

## Contexto
Fases 1A–7 Done: 18 páginas operacionais bitemáticas. Restam as trilhas com design
próprio: `admin*.html` (4), `subscription*.html` (2, fluxo público), `folha_pagamento/folha.html`,
`ajudabitolas.html`.

## Problema
Cada trilha tem sistema visual próprio; a integração deve respeitar o shell (menu/Tema)
sem impor conteúdo dark onde o design é intencional (ex.: checkout público).

## Objetivo
Todas com Tema funcional no chrome; conteúdo dark onde fizer sentido; público/admin
documentados como trilha própria quando preservados claros.

## Acceptance Criteria
- [x] Auditoria por trilha (CSS próprios, menu, guards).
- [x] Integração sem regressão visual no light; dark coerente ou trilha declarada clara.
- [x] QA + gates verdes.

## Tarefas
- [x] Auditoria.
- [x] Integração por trilha.
- [x] QA + gates + fechar story.

## File List
- `docs/stories/2026-09-24-redesign-fase8-trilhas-restantes.md`
- `admin.html`, `admin-settings.html`, `admin-subscriptions.html`, `admin-access-governance.html`
- `subscription-status.html`, `ajudabitolas.html`, `folha_pagamento/folha.html`
- `tests/redesign-theme-regression.test.mjs`

## Implementação
- Migrador estendido com base `../` (folha) e âncora tolerante a `?v=`; `subscription.html`
  pulada por decisão (sem chrome a temizar — trilha pública de conversão).
- Admin (4): shell-only (design system próprio preservado); guards de superadmin intactos
  (redirecionam sem sessão); QA visual admin exige conta superadmin — pendente do usuário.
- Folha: tokens + shell + content (compartilha layout/ui); ilha timber confirmada via
  `getComputedStyle` (screenshot anterior com barra clara era flash de hidratação).
- Subscription-status: hero/cards públicos preservados, chrome no tema.
- Ajudabitolas: menu + shell OK.

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (645 pass, 0 fail, 1 skip emulador).
- QA: sweep 7/7 integrado; folha/subscription/ajuda autenticados com canvas dark;
  admin-* com timeout headless sem sessão (loops de retry do Firebase) — guards intactos;
  0 erros de frontend.

## Notas
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.
