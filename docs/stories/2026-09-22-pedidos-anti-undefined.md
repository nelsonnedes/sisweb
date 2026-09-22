# Story: Pedidos — Anti-undefined no save (Firebase abortava escrita)

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Escopo:** `vendas.js`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs` (+2 testes)
- **Sintoma (produção):** `update failed / set failed: values argument contains undefined in ...itens.N.itensOriginais` ao salvar pedido.

## Causa raiz

Desagrupar criava `itensOriginais: undefined` (chave presente, valor undefined). O SDK do Firebase valida antes de serializar e aborta a escrita inteira — `JSON.stringify` descartaria, mas o `update`/`set` nunca chega lá.

## Correção (2 camadas)

1. Desagrupar usa `delete` (chave nem existe) — vendas e compras.
2. `sanearIndefinidosFirebase()` (recursivo, in place) aplicado ao pedido e aos `updates` antes de `updatePaths`/`set` — cinturão contra qualquer outra fonte.

## Acceptance Criteria

- [x] Nenhum `itensOriginais: undefined` no código.
- [x] Save saneia antes de toda escrita remota de pedido.
- [x] Gates verdes (617 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.js`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [x] Publicado (commit + push + deploy)
