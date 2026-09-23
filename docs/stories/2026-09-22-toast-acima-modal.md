# Story: Toasts acima do modal Lista de Pedidos

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commits `7c8e5dc` + `02c457b` (bumps toast.js) → push `origin/main` ✓
  - Build `hosting-dist` (478 arquivos) ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `vendas.html`, `compras.html`, `modules/core/toast.js`, `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Sintoma:** com Lista de Pedidos aberta, toasts abriam por baixo (invisíveis).

## Causa raiz

`.modal` em `ui-components.css` usa `z-index: 9999990`; containers de toast usavam 9999 (páginas) e 99999 (unificado) — ambos abaixo do modal.

## Correção

Containers para `z-index: 10000000` nos 3 pontos (acima de modal e loading; sem mexer no modal para não quebrar empilhamento entre modais). Mobile herda (só reposiciona).

## Acceptance Criteria

- [x] Toast visível com qualquer modal aberto (lista, detalhes, produto).
- [x] Sem alteração em modal/loading.
- [x] Gates verdes (629 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.html`, `compras.html`, `modules/core/toast.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] lint, typecheck, suite cheia (sem JS de lógica alterado)
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
