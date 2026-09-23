# Story: Itens do Pedido — Unidade m³ padrão + Enter adiciona

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commit `9fbb43c` (+ min-quantidade junto) → push `origin/main` ✓
  - `inject-cachebusters`: bump `vendas.js?v=a50c234f1495` ✓
  - Build `hosting-dist` (478 arquivos) com código novo confirmado no artefato ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `vendas.html`, `compras.html`, `vendas.js` (resets), `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Fora de escopo:** validações de quantidade (intactas no JS).

## Objetivo

1. `Unidade:` com `m³` como padrão no formulário de itens (vendas + compras).
2. Com foco em `Preço Unit.:`, Enter adiciona o item.

## Implementação

- HTML: `selected` na option `m³` (ordem das options intacta; `form.reset()` volta ao m³).
- Vendas: resets pós-Adicionar/atualizar para `'m³'` (era `'UN'`). Compras não resetava (mantém última escolha; default inicial m³).
- Enter: `onkeydown` com `preventDefault` em `precoManual` → `adicionarItemManual()` e `precoUnitario` → `adicionarItem()` (ambas as telas). Bônus: elimina submit nativo acidental nesses campos. Validações das funções respeitadas (toast em dado inválido).

## Acceptance Criteria

- [x] Novo item manual abre com m³; após Adicionar volta a m³ (vendas) / mantém escolha (compras).
- [x] Enter no preço adiciona/atualiza; Enter não dispara submit fantasma.
- [x] Edição de item preserva a unidade do item (fills intactos).
- [x] Gates verdes (620 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.html`, `compras.html`, `vendas.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] lint, typecheck, suite cheia (JS: só 2 linhas de reset)
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
