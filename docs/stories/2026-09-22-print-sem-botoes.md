# Story: Impressão — barra Voltar/Imprimir fora do papel

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `commerce-pdf-share.js`, `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Sintoma:** botões Voltar/Imprimir impressos em todas as impressões.

## Causa raiz (dupla, no motor compartilhado)

1. **Guerra de especificidade:** `.sisweb-print-back:not(.no-print)` (0-2-0, todas as mídias) vencia `@media print .sisweb-print-back` (0-1-0) — a barra vencia no papel em todo doc do builder.
2. **Fluxos com HTML próprio** (lote pedidos, estoque): `ensurePrintAux` injetava a barra sem nenhuma regra de ocultação.

## Correção (só `commerce-pdf-share.js`)

- `@media print` espelha os seletores (0-2-0 + ordem posterior); tela intacta.
- `ensurePrintAux(doc, opts)`: injeta `<style data-sisweb-print-back>@media print{...display:none!important}</style>` só quando o doc não tem regra equivalente (sem duplicar); respeita `showBackBar === false` (antes re-adicionava a barra).
- Fluxos standalone (company/mdf-e/romaneios) já tinham regra equivalente — intocados.

## Acceptance Criteria

- [x] Barra visível na tela, ausente no papel em todos os fluxos.
- [x] Sem duplicação de `<style>`; opt-out respeitado.
- [x] Gates verdes (630 pass, 0 fail, 1 skip emulator).

## File List

- `commerce-pdf-share.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
