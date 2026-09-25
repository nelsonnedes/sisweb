# Story: Fase 12 — Folha: meses fechados no dark

## Status
Done

## Contexto
Print do usuário: linhas "MÊS FECHADO PAGO" brancas com texto lavado no dark, enquanto
as demais linhas já estavam timber.

## Problema
`.folha-fechada` (`folha.css`): `background-color: #f8f9fa; opacity: 0.8` + `td { color: #6c757d }`.

## Objetivo
Meses fechados legíveis no dark sem perder a distinção visual de "encerrado".

## Acceptance Criteria
- [x] Linhas fechadas em superfície-2 com texto legível, sem opacity.
- [x] Gates verdes.

## Tarefas
- [x] Regras + QA + gates.

## File List
- `styles/content-theme.css`
- `docs/stories/2026-09-24-redesign-fase12-folha-fechada.md`

## Implementação
- `html[data-theme="dark"] body #folhasTable tr.folha-fechada` → surface-2, opacity 1,
  td em tinta-2, hover em `--sw-hover` (especificidade documentada contra o legado).

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (646 pass, 0 fail, 1 skip).
- QA: folha 100% dark (filtros, ações, tabela, paginação); 0 erros.

## Notas
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.
