# Story: Romaneio — Toolbar em 2 linhas + CSS mobile

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `vendas.html`, `compras.html`, `compras.js` (toggle da caixa), `commerce-responsive.css`, `tests/romaneio-preview-uso-trava.test.mjs` (+2 testes)
- **Fora de escopo:** lógica de carga/preview (intocada), CSS fora de `.romaneio-*`.

## Objetivo

Linha 1: `Tipo de Romaneio:` + `Romaneio:`. Linha 2 (`romaneio-toolbar-row`): botões `Carregar Itens` + `Limpar` e a caixa de agrupamento. Tudo adaptado ao mobile.

## Acceptance Criteria

- [x] Mesma estrutura nas 2 telas: `form-row` (selects) + `form-row romaneio-toolbar-row` (actions + group-box). Ids/handlers/visibilidade intactos.
- [x] Compras: caixa some quando nenhuma opção visível (`agruparBoxCompra`).
- [x] Desktop: botões à esquerda (Carregar flexível, Limpar compacto), caixa flexível à direita, checkboxes lado a lado.
- [x] Mobile (≤768px): empilha tudo full-width (form-row grid + actions card + fieldset grid 1fr); checkboxes viram cards 44px com highlight; novos ids no padrão 18px.
- [x] Regras existentes de `.romaneio-actions`/mobile preservadas byte-a-byte (só adição).
- [x] Gates verdes (602 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.html`, `compras.html`, `compras.js`, `commerce-responsive.css`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] lint, typecheck, suite cheia
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
