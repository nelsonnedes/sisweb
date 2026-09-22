# Story: Romaneio — Agrupar: box + modo Dimensões + condicionais Compras

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commit feature `3e35ddd` → push `origin/main` ✓
  - Build `hosting-dist` (478 arquivos) com código novo confirmado no artefato ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `vendas.html`, `vendas.js`, `compras.html`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs` (+6 testes)
- **Fora de escopo:** schema de romaneios, rules, financeiro, CSS global.

## Objetivo

1. Vendas: retângulo "Agrupar:" com 2 checkboxes — novo "Espécie Espessura x Largura x Comprimento" + atual "Agrupar por Espécie e Espessura".
2. Compras: opções do "Agrupar:" só para PCT/TL/PES; "Carregar apenas o Resumo (Agrupar por Espécie)" só para TORA.

## Acceptance Criteria

- [x] Vendas tem `<fieldset id="agruparFieldset">` com legend "Agrupar:" e os 2 checkboxes; id legado preservado.
- [x] Modos mutuamente exclusivos (`alternarModoAgrupamentoVendas`); nenhum marcado = legado por categoria (default inalterado).
- [x] Novo modo ancora nos itens brutos (resumo descarta comprimento — comprovado na análise); respeita exclusões do preview via categoria derivada; grupos por 4-tupla com preço médio ponderado; `tipo: romaneio_dimensoes` + `produtoId romaneio_dim_*` (sem colisão; reagrupador do carrinho blindado por construção).
- [x] Novo modo desabilitado para TORA (UI + guarda no load com toast).
- [x] `romaneiosOrigem` do pedido passa a incluir `romaneio_dimensoes`.
- [x] Compras: `#opcaoResumoEspecie` visível só TORA; `#agruparDimsFieldset` (hidden default) visível só PCT/TL/PES; ao esconder, desmarca (anti modo-fantasma); leitura ANDada com tipo (`lerModoAgrupamentoCompra`).
- [x] Compras: modos dims (espécie+E+L+C) e espécie+espessura com chaves normalizadas (`toFixed(2)`, alias bitola), nomes distintos (sem fusão com legado no pós-carga), vínculo completo nos itens.
- [x] `npm run lint`, `npm run typecheck`, `npm test` verdes (597 pass, 0 fail, 1 skip emulator).

## Limitações honestas

- No novo modo Vendas, excluir uma categoria no preview exclui todos os comprimentos dela (exclusão grossa → carga fina).
- Preços divergentes na mesma 4-tupla fundem em média ponderada por volume (documentado no toast? não — média silenciosa, igual ao modo espécie atual).
- `agruparItensRomaneioNoCarrinho` (pós-carga) não reagrupa `romaneio_dimensoes` — intencional.

## File List

- `vendas.html` (fieldset Agrupar:)
- `vendas.js` (modos, ramo dimensões, vínculo, resets)
- `compras.html` (id + fieldset condicional)
- `compras.js` (visibilidade, modos, ramos, guards)
- `tests/romaneio-preview-uso-trava.test.mjs` (16 testes)

## Quality Gates

- [x] `node --check` nos 2 JS
- [x] `npm run lint` / `typecheck` / `test`
- [x] Publicar (commit + push + deploy hosting) — concluído
