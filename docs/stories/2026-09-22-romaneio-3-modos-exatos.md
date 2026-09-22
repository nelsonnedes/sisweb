# Story: Romaneio — 3 modos exatos + default obrigatório + sem código morto

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `vendas.html`, `vendas.js`, `compras.html`, `compras.js`, `commerce-responsive.css` (nowrap), `tests/romaneio-preview-uso-trava.test.mjs` (+4 testes)
- **Fora de escopo:** financeiro, rules, reagrupadores pós-carga (intocados).

## Objetivo

1. `Espécie Espessura x Largura` agrupa exatamente por espécie+espessura+largura.
2. Todo checkbox reflete exatamente a lógica no Preview (linhas = unidades de carga).
3. Terceiro checkbox `Espécie Espessura` (= lógica antiga); desktop horizontal.
4. `Espécie Espessura x Largura` default; carregar exige um checkbox; sem código morto.

## Acceptance Criteria

- [x] 3 modos com chaves exatas: A `ESP||esp`, B `espécie+categoria` (≡ esp+larg), C 4-tupla; mesma partição preview↔carga.
- [x] Vendas: agregadores únicos `agruparResumoPorEspessuraVendas` / `agruparBrutosPorDimensoesVendas` (preview e carga, sem duplicação); fallback de preço com equivalência exata ao legado (`valorCheio`).
- [x] Preview fiel: linhas por grupo com exclusão na granularidade do modo (3 sets); banners e contadores por modo; trava de reuso intacta.
- [x] Troca de modo limpa exclusões (granularidades incompatíveis); revert impede zero-selecionado (UI) + guarda fail-closed na carga.
- [x] Removidos: ramo per-categoria `tipo: romaneio` (vendas) e `Lógica Item a Item` (compras); `largura` numérica adicionada ao resumo (aditivo).
- [x] Compras: 3 modos + resumo TORA; item-a-item removido; preview por seções já era exato (exclusão por índice).
- [x] Ouvintes legados preservados (`agruparEspecieCheckbox` virou modo A; ids reutilizados).
- [x] Desktop: fieldset `nowrap` (3 lado a lado); mobile empilhado (regra existente).
- [x] Gates verdes (603 pass, 0 fail, 1 skip emulator).

## Limitações honestas

- Preço médio ponderado em grupos heterogêneos (igual ao legado).
- `produtoId`s do modo B são novos (`agrupado_*_*_*`): cargas antigas (versão anterior) não fundem com as novas — uma linha a mais, sem corrupção.
- Reagrupador pós-carga (checkbox A, legado) pode re-colapsar itens B em A — ação explícita do usuário, com toast.

## File List

- `vendas.html`, `vendas.js`, `compras.html`, `compras.js`, `commerce-responsive.css`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
