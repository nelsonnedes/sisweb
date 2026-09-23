# Story: Impressão PCT — resumos em negrito padrão TL

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `modules/romaneiopct/imprimir-romaneio-pct.js` (3 regras `font-weight`), `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Evidência (anexo):** TL nítido e forte; PCT com corpo fino lavado nos resumos.

## Correção (só peso da fonte)

- `.resumo-dimensoes-table td` → bold (cabeçalhos e totais já eram fortes).
- `.resumo-conama td` → bold.
- `.total-info-pill` → bold.
- Tamanhos, famílias, cores, layout, colunas e dados 100% intactos.

## Acceptance Criteria

- [x] Corpo dos 2 resumos + pills em negrito como o TL.
- [x] Zero reflow (só `font-weight`; tabelas `fixed` com folga).
- [x] Gates verdes (638 pass, 0 fail, 1 skip emulator).

## File List

- `modules/romaneiopct/imprimir-romaneio-pct.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
