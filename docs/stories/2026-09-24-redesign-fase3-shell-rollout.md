# Story: Fase 3 — Rollout do shell de tema (vendas, finanças, estoque)

## Status
Done

## Contexto
Continuação das Fases 1A/1B/2 (login + index Done).

## Contexto
Continuação das Fases 1A/1B/2 (login + index Done). As páginas operacionais usam o mesmo
`<main-menu>` (engrenagem com Tema), mas sem tokens/bootstrap/manager o controle de tema não
as alcança. Escopo: `vendas.html`, `financas.html`, `estoque.html` — integração de shell
(canvas + menu), SEM remover inline próprio e SEM tocar em lógica (Fase 4 fará o resto).

## Problema
1. As 3 páginas não carregam tokens nem `SiswebTheme`: tema escolhido na engrenagem não persiste
   visualmente fora do index/login.
2. Regras de shell (preflight, canvas, ilha do menu) viviam só em `dashboard-theme.css`.

## Objetivo
As 3 páginas respeitam Claro/Escuro/Sistema no canvas e no menu, com a engrenagem funcional,
sem nenhuma mudança de comportamento, rota ou lógica de negócio.

## Acceptance Criteria
- [x] `styles/shell-theme.css` criado com as partes compartilhadas (sem duplicar dashboard-theme).
- [x] 3 páginas com tokens + shell + bootstrap anti-FOUC + `sisweb-theme.js`; guards/redirecionamentos intactos.
- [x] QA: canvas dark `#121417` / light `#F8F9FA`, ilha do menu clara, 0 erros de frontend; guards preservados.
- [x] `npm run lint`, `npm run typecheck`, `npm test` passam; smoke localhost 200 nas 3 + login + index.

## Tarefas
- [x] Extrair shell compartilhado; referenciar no index.
- [x] Integrar as 3 páginas.
- [x] QA + gates + fechar story.

## File List
- `docs/stories/2026-09-24-redesign-fase3-shell-rollout.md`
- `styles/shell-theme.css`
- `styles/dashboard-theme.css` (remoção das partes movidas)
- `index.html` (link do shell)
- `vendas.html`, `financas.html`, `estoque.html`
- `tests/redesign-theme-regression.test.mjs`

## Implementação
- `styles/shell-theme.css` (novo): preflight box-sizing, canvas por tema, Tema ativo, ilha do
  menu + responsivo — extraído do `dashboard-theme.css` sem duplicação (trava no teste).
- `index.html` referencia o shell; `vendas/financas/estoque.html` ganharam tokens + shell +
  bootstrap + `sisweb-theme.js` (só `<head>`, lógica intacta).
- Guards comprovados intactos: sem sessão, `vendas`/`estoque` redirecionam para
  `login.html?reason=ui_guard` (Regra de Ouro); QA visual usou `?noRedirect=true`.
- Estado de transição declarado: no dark, canvas + menu vão ao timber mas o conteúdo próprio
  das 3 páginas segue claro (inline delas intacto) — superfícies por página = Fase 4.
  Light das 3 páginas é pixel-fiel ao original (só a ilha do menu mudou, padrão lab).

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (640 pass, 0 fail, 1 skip emulador).
- QA (`tmp/qa-fase3.mjs`, 6 capturas em `tmp/qa-fase3/`): canvas dark/light, ilha branca,
  3 opções de Tema, engrenagem funcional; 0 erros de frontend (4 `PERMISSION_DENIED` são o
  backend negando sessão anônima headless — segurança funcionando, não regressão).
- Smoke no servidor persistente: `vendas/financas/estoque/login/index.html` +
  `styles/shell-theme.css` = 200.

## Notas
- `C:\Sisweb` intocável; trabalho só em `D:\Sisweb_redesigner`, validação só em `localhost`.
- Inline próprio das 3 páginas fica para a Fase 4 (auditoria por página, como na Fase 2).
