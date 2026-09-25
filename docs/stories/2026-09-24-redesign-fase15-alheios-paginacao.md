# Story: Fase 15 — Alheios + ajudabitolas + paginação unificada

## Status
Done

## Contexto
Usuário autorizou assumir os "alheios" (dump da sessão pausada + regex quebrado pela edição
concorrente em `folha.css`); relatou zebra em ajudabitolas e pediu paginação da Lista de
Pedidos como padrão global.

## Implementação
- Dump `redesign-do-sisweb-login-index-e-tema-light-dark.json` movido da raiz para `tmp/`
  (coberto por `hosting.ignore`; conteúdo preservado).
- Teste `folha-acoes-recolhidas` atualizado para aceitar `var(--sw-surface-2)` (equivalente
  claro, adaptativo no dark) em vez de só `#f8f9fa`.
- Ajudabitolas: hover `#f1f1f1` → `var(--sw-hover)` com fallback.
- Paginação unificada em `content-theme.css`: `.pagination-controls` (cor de marca, ativo em
  marca), `#receberPagination/#pagarPagination` (padrão Lista de Pedidos, ativo em marca),
  zebra genérica de TD neutralizada para a zebra do TR valer.
- Auditoria: paginadores de vendas/romaneios/folha/estoque/finanças usam `.pagination-controls`,
  `.rlc-pagination-*`, `.paginacao-controles/.btn-paginacao` ou `#receber/#pagarPagination` —
  todos cobertos.

## Validação
- Suite + regressão do tema nas verificações finais.
- QA: paginação dark íntegra; ajudabitolas sem flash branco no hover.

## File List
- `tmp/redesign-do-sisweb-login-index-e-tema-light-dark.json` (realocado)
- `tests/folha-acoes-recolhidas.test.mjs`, `ajudabitolas.html`
- `styles/content-theme.css`, `tests/redesign-theme-regression.test.mjs`
