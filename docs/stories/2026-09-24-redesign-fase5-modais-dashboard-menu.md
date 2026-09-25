# Story: Fase 5 — Modais com identidade, sem vencidas, pill estendida, ilha estendida

## Status
Done

## Contexto
Feedback do usuário com prints reais em `localhost:5500`:
1. Registro: scroll na página (não preso no modal) + lockup ícone/nome (e nos demais modais).
2. Remover "A Receber/Pagar Vencidas" do dashboard.
3. Pill "Premium • 184 dia(s)": estendida + fundo melhor.
4. Ilha do topo estendida sob o sininho/engrenagem (dropdown sobre o menu).

## Problema
- `.modal-content` com `overflow-y:auto` interno prende o scroll; modais sem lockup.
- Tabelas vencidas renderizadas pelo `dashboard-widgets.js` (template + `renderPaginatedTable`).
- Pill inline-flex encolhida, fundo branco no dark.
- Triggers do sininho/engrenagem fora da ilha visual.

## Objetivo
Os 4 pontos atendidos sem quebrar lógica, rotas ou backend; QA autenticado com dados reais.

## Acceptance Criteria
- [x] Registro abre com lockup; modal rola na página; forgot/contact com lockup; overflow 0.
- [x] Dashboard sem `.data-tables`; sem `console.error` de container ausente; dados seguem íntegros.
- [x] Pill full-width com fundo de marca por tema.
- [x] Ilha (shell) sob os triggers; dropdowns sobre a ilha; mobile preservado.
- [x] QA autenticado + `lint`/`typecheck`/`test` verdes.

## Tarefas
- [x] Modais login (lockup ×3 + scroll).
- [x] Remoção vencidas (index + widgets + guards).
- [x] Pill + ilha estendida.
- [x] QA + gates + fechar story.

## File List
- `docs/stories/2026-09-24-redesign-fase5-modais-dashboard-menu.md`
- `login.html`, `styles/auth.css`
- `index.html`, `modules/dashboard/dashboard-widgets.js`
- `styles/sisweb-tokens.css`, `styles/shell-theme.css`
- `tests/redesign-theme-regression.test.mjs`

## Implementação
- Modais: lockup oficial (compacto 56/150px) em registro, recuperação e contato; scroll
  transferido para a página (`.modal.open` com `overflow-y:auto`, `.modal-content` sem
  corte interno); lógica e acessibilidade intactas.
- Vencidas: bloco `.data-tables` removido do `index.html` e do template do
  `dashboard-widgets.js`; 4 chamadas `renderPaginatedTable` com guards de existência
  (cálculo/cache de dados preservados, zero `console.error`); nenhum teste referenciava as tabelas.
- Pill: `display:flex; width:100%` + vars `--sw-pill-*` (brand translúcido no dark, `#fff1e8` no light).
- Ilha: `.sisweb-menu-shell` virou a ilha (`.menu` interno transparente); triggers sobre a ilha,
  dropdowns pairando; mobile inalterado (drawer segue no `.menu`).

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (641 pass, 0 fail, 1 skip emulador).
- QA autenticado com dados reais: modal registro (lockup + scroll de página + overflowX 0),
  dashboard sem vencidas, pill estendida, ilha sob sininho/engrenagem; 0 erros de frontend.
- 13 capturas em `tmp/qa-auth/`.

## Notas
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.
