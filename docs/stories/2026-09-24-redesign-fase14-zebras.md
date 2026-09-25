# Story: Fase 14 — Zebras restantes (compras, fornecedores, stats)

## Status
Done

## Contexto
Prints do usuário: linhas brancas alternadas em Compras (fornecedores/produtos/relatórios)
e modal Fornecedores no Romaneio Tora; stat cards brancos em Compras; dropdown de
impressão do PES já ok.

## Problema
Zebras com seletores fora do padrão já neutralizado (`.table`) ou `!important` local.

## Objetivo
Zebra dark em todas as listas + stats no padrão KPI, sem tocar em lógica.

## Acceptance Criteria
- [x] Nenhuma linha branca com texto lavado nas listas auditadas (dark).
- [x] Stats de compras no padrão KPI.
- [x] QA autenticado + gates verdes.

## Tarefas
- [x] Depuração CDP por área.
- [x] Correção + QA + gates.

## File List
- `docs/stories/2026-09-24-redesign-fase14-zebras.md`
- `styles/content-theme.css` (espelhos `.table` por ID dos modais de cadastro + KPI compras)
- `tests/redesign-theme-regression.test.mjs`

## Implementação
- Depuração via `CSS.getMatchedStylesForNode`: legado `#x .table tbody tr:nth-child(even) td`
  com `!important` (1,2,2) nos modais de cadastro; espelhado com attr do tema (1,3,3).
- Compras: `.purchase-suppliers-stat` no padrão KPI (dark + light); linhas já cobertas.
- Dropdown de impressão do PES verificado íntegro (sem ajuste necessário).

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓; regressão do tema 14/14 ✓.
- Suite: 645 pass + 2 fails alheios (294 dump de outra sessão; 252 regex quebrado pela
  edição concorrente em `folha.css` — ambos fora deste trabalho).
- QA autenticado: modal fornecedores e compras-fornecedores dark íntegros; 0 erros.

## Notas
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.
