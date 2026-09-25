# Story: Fase 4 — Menu/dropdown/sininho por tema + fix overflow login + QA autenticado

## Status
Done

## Contexto
Feedback real do usuário testando em `localhost:5500` com dados autenticados (prints):
1. Fundos do menu do topo, dropdown da engrenagem e mensagens do sininho precisam de cores melhores.
2. Campos do login estourando a tela (overflow horizontal).
3. Diretriz permanente: QA sempre autenticado no sistema, ajustando inconsistências em loop.

## Problema
1. Dropdown/engrenagem e painel de alertas são sempre brancos — destoam no tema escuro.
2. Causa raiz do overflow no login: a remoção do `* { box-sizing: border-box }` legado não foi
   reposta no `auth.css`; `input`/`select`/`modal` com `width:100% + padding` transbordam.
3. Ilha do menu 100% clara no dark: trocar para superfície timber no escuro (feedback > lab).

## Objetivo
Chrome do sistema (menu, dropdowns, sininho) coerente por tema + login sem overflow em
qualquer viewport + harness de QA autenticado reutilizável (sem credencial no repo).

## Acceptance Criteria
- [x] `auth.css` com preflight box-sizing escopado; login sem scroll horizontal em 360/390/768/1366.
- [x] Dropdowns, painel de alertas e itens do sininho com superfícies por tema (dark timber / light papel).
- [x] Ilha do menu por tema (timber no dark, branca no light), ativo em gradiente de marca.
- [x] QA autenticado (dados reais) dark + light: dashboard, sininho aberto, engrenagem aberta,
      login mobile; 0 erros de frontend; guards de backend intactos.
- [x] `npm run lint`, `npm run typecheck`, `npm test` passam; story com File List.

## Tarefas
- [x] Fix overflow login + trava de regressão.
- [x] Superfícies por tema no shell (menu/dropdown/sininho).
- [x] Harness QA autenticado (credenciais só via env, nunca no repo) + iteração visual.
- [x] Gates + fechar story.

## File List
- `docs/stories/2026-09-24-redesign-fase4-chrome-tema-login-overflow.md`
- `styles/auth.css` (preflight box-sizing escopado)
- `styles/sisweb-tokens.css` (vars `--sw-island-*` e `--sw-alert-*` por tema)
- `styles/shell-theme.css` (ilha/dropdown/sininho/greeting/pill por tema)
- `tests/redesign-theme-regression.test.mjs` (trava anti-overflow)
- `tmp/qa-auth.mjs`, `tmp/dbg-greet.mjs` (harness QA autenticado — fora do git)

## Implementação
- Overflow login: causa raiz = remoção do `* { box-sizing }` sem reposição; fix com preflight
  escopado `body.sw-auth *` + trava no teste. Overflow 0px em 360/390/768/1366.
- Ilha/dropdown/sininho por tema via novas vars (sem duplicação): island timber `#1E2228` no
  dark (feedback do usuário > lab), dropdowns e alertas com severidade preservada em tintas
  translúcidas no dark e pastéis no light.
- Cascata vencida com evidência: `.greeting-name` exigiu `(0,5,2)` contra `(0,3,0)` injetado;
  depuração via `getComputedStyle` headless (`tmp/dbg-greet.mjs`).
- QA autenticado com dados reais (`tmp/qa-auth.mjs`, credenciais só via env): login real,
  `recomputeSystemAlerts()` + 3 itens reais com severidade, troca de tema por clique,
  vendas/estoque/finanças autenticadas, overflow em 4 viewports.

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (640 pass, 0 fail, 1 skip emulador).
- QA autenticado: 0 erros de frontend; 12 capturas em `tmp/qa-auth/` (dashboard com dados,
  sininho com 3 alertas reais, engrenagem, light, 3 páginas, login 390).
- Servidor persistente em `localhost:5500` (200) para teste humano contínuo.

## Notas
- `C:\Sisweb` intocável; `localhost` apenas.
- Credenciais de QA via `SISWEB_QA_EMAIL`/`SISWEB_QA_PASS` no ambiente — proibido commitar.
- Recomendado ao usuário rotacionar a senha após este QA compartilhado.
