# Story: Romaneio — Editar agrupado em 1 clique (sem confirm)

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commit `06b1a6d` → push `origin/main` ✓
  - Build `hosting-dist` (478 arquivos) com código novo confirmado no artefato ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `vendas.js` (`editarItem`), `compras.js` (`editarItemCompra`), `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Fora de escopo:** fallback sem `itensOriginais` (inalterado), conversão manual no salvar (legado).

## Problema

Editar item agrupado perguntava "Deseja Desagrupar para Edição?" e, após OK, exigia clicar em editar de novo. Em vendas, ainda deixava `itemEmEdicaoId` apontando para o id removido (dangling).

## Solução

Um clique em Editar: expande o grupo (splice no lugar) e já carrega o **primeiro** item no formulário manual, marcando-o como em edição (`primeiroDesagrupado.id` / `index`). Sem `confirm`; toast informa o desagrupamento. Fallback sem originais intacto.

## Acceptance Criteria

- [x] Sem `window.confirm` nos dois fluxos (verificado por grep + teste).
- [x] Primeiro desagrupado vai ao formulário com valores/nome/unidade/preço; demais ficam no carrinho.
- [x] `Adicionar` atualiza o primeiro in-place (ids/índices válidos; sem dangling).
- [x] Gates verdes (607 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.js`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
