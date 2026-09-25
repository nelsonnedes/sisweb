# Story: Fase 10 — Unificação cards padrão KPI + fundos + footers

## Status
Done

## Contexto
Usuário com prints: padronizar cards das páginas com o designer dos cards do Dashboard
(KPI: superfície, barra de acento no topo, ícone circular, valor mono, label uppercase),
fundos das páginas iguais ao do dashboard, e reclama de divergências (cards vendas/compra,
fundos) + layout do vendas (largura, footer "MELHORE").

## Problema
Cada página tem seu sistema de cards (vendas `.sales-clients-stat`, finanças
`.dashboard-card` em gradientes, estoque `.stat-card`) e larguras/footers próprios.

## Objetivo
Um padrão KPI único nos dois temas; fundo global com glow sutil do dashboard;
container 1400px; footers padronizados — sem tocar em lógica.

## Acceptance Criteria
- [x] Cards de resumo das páginas no padrão KPI (dark + light).
- [x] Fundo com glow + largura 1400 + footers padronizados.
- [x] QA autenticado + gates verdes.

## Tarefas
- [x] Auditoria classes de cards/footers.
- [x] Camada de unificação.
- [x] QA + gates + fechar story.

## File List
- `docs/stories/2026-09-24-redesign-fase10-cards-unificados.md`
- `styles/content-theme.css` (largura 1400, padrão KPI vendas/finanças/estoque dark+light)
- `styles/shell-theme.css` (glow no fundo dark, rodapé global)
- `tests/redesign-theme-regression.test.mjs`

## Implementação
- Rodapé é global (`global-footer.js` injeta `.global-system-footer` em todas) → regra única no shell.
- KPI pattern: superfície + borda + raio 14 + barra de acento 4px (`::before`); vendas/estoque
  neutros com gradiente de marca; finanças com semânticas (receber=info, pagar=danger,
  saldo=success); valores em `Source Code Pro`; footer do `global-footer.js` com borda e link.
- Fundo dark com glow radial de marca (padrão lab-index-a); container 1300→1400 via var.

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (646 pass, 0 fail, 1 skip emulador).
- QA autenticado: vendas-clientes e finanças com cards KPI, rodapé com borda; 0 erros.

## Notas
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.
