# Story: Fase 20 — ajudabitolas padrão + header pagamento + Onda C mobile

## Status
Done

## Contexto
ajudabitolas com hero/atenuantes/tabelas em claro no dark (não carregava
content-theme; H1 sem gradiente; pastéis ilegíveis); header do modal
Pagamento/Recebimento sem padrão; Onda C (390px) pendente.

## Implementação
- `ajudabitolas.html`: link `content-theme.css`; tintas em vars (h1-h4, h2 borda marca,
  h3 marca, p, label `--sw-label`, inputs, botões em gradiente, ícones marca,
  bordas em var); bloco dark p/ `.header-section`, `.result`, `.alert-card`
  (warning tint), `.comparison-table .correction/.previous` (success/warning tints).
- `financas.html`: `.modal-header` com borda em var; `#pagamentoModal .modal-header`
  em barra (padrão anexosModal) com título em var.
- Onda C: 390px em 6 páginas sem overflow horizontal (scrollW=390) + paleta 358px,
  0 erros.
- `tests/redesign-theme-regression.test.mjs`: teste Fase 20 (20/20 na suite).

## Validação
- Gates + `npm test` na consolidação do publish; QA `tmp/qa-fase20.mjs` (0 erros).

## File List
- `ajudabitolas.html`, `financas.html`, `tests/redesign-theme-regression.test.mjs`
- `tmp/qa-fase20.mjs`, `tmp/qa-fase20/`
