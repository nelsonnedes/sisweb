# Story: Warm-up da logo silencioso (fim do warn toda abertura)

- **Data:** 2026-09-22
- **Status:** Done (publicado junto com abf4ce7 — ver evidências em 2026-09-22-listar-boot-honesto)
- **Escopo:** `commerce-pdf-share.js` (`quiet`), `vendas.js` + `compras.js` (warm-up), `tests/romaneio-preview-uso-trava.test.mjs` (+ asserts)
- **Sintoma:** `Logo da empresa indisponível para PDF via Storage: ...excedeu 6000ms` a cada abertura de vendas/compras.

## Impacto avaliado

Zero funcional: warm-up é background (idle), falha contida, impressão segue sem logo, memo da sessão já evitava repetição. Efeito real: ruído no console (+ breadcrumbs no Sentry) e 1 cadeia lenta por page-load.

## Correção

`quiet: true` no warm-up (vendas+compras) → `resolveCompanyLogoDataUrl` pula os `console.warn` esperados; impressões reais continuam verbosas. Fluxo e timeouts intactos.

## Acceptance Criteria

- [x] Abertura de página sem warns de logo (warm-up silencioso).
- [x] Falha em impressão real ainda loga (diagnóstico preservado).
- [x] Gates verdes (625 pass, 0 fail, 1 skip emulator).

## File List

- `commerce-pdf-share.js`, `vendas.js`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
