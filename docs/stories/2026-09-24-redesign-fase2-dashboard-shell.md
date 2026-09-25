# Story: Fase 2 — Shell do dashboard (index inline + marca do módulo)

## Status
Done

## Contexto
Continuação de `2026-09-24-redesign-frontend-login-index-tema.md` (Fases 1A/1B Done).

## Contexto
Continuação de `2026-09-24-redesign-frontend-login-index-tema.md` (Fases 1A/1B Done).
O `index.html` ainda carrega ~780 linhas de `<style>` inline com sistemas legados de cards
(`.dashboard-card`, `.stat-card`, `.forex-*`, `.currency-*`, `.chart-*`, `.recent-*`,
`.indicator-*`, `.export-button`) duplicados/concorrentes com `modules/dashboard/*.css`,
e o módulo usa marca estrangeira (`--primary-gradient` roxo `#667eea→#764ba2`,
`--dashboard-primary` azul `#3498db`).

## Problema
1. CSS inline do index polui o escopo global e diverge dos módulos (duas fontes de verdade).
2. Acentos do dashboard (título, refresh, topo dos KPI cards) estão em roxo/azul genérico,
   fora da identidade `#FE6A00` validada no lab.

## Objetivo
`index.html` sem `<style>` inline, com toda regra viva portada para CSS escopado, e módulo
dashboard falando a marca Sisweb — sem alterar boot, tenant guard, fallback ou widgets.

## Acceptance Criteria
- [x] Auditoria estática lista cada seletor do inline como VIVO (usado no DOM/JS/módulos) ou
      MORTO, com evidência (grep + DOM renderizado no QA).
- [x] `index.html` sem `<style>` inline; trava de regressão no teste.
- [x] Vars do módulo migradas para a marca (gradiente primário laranja; sucesso/alerta/perigo/
      info oficiais `cores.md §3.3`); roxo `#667eea/#764ba2` e azul `#3498db` eliminados do shell.
- [x] QA visual dark + light + engrenagem: paridade de layout, nova marca aplicada, 0 erros.
- [x] `npm run lint`, `npm run typecheck`, `npm test` passam; smoke localhost 200.

## Tarefas
- [x] Rodar auditoria de seletores (inline × módulos × DOM renderizado).
- [x] Migrar brand vars do módulo dashboard.
- [x] Portar regras vivas para `styles/dashboard-theme.css` (body padding + preflight box-sizing).
- [x] Remover inline do `index.html`; re-verificar visual + gates.
- [x] Atualizar File List e fechar story.

## File List
- `docs/stories/2026-09-24-redesign-fase2-dashboard-shell.md`
- `index.html` (+22/−785: remoção do inline)
- `styles/dashboard-theme.css` (preflight box-sizing, body padding, texto light, h1 marca, ilha do menu)
- `modules/dashboard/dashboard-professional-styles.css` (vars de marca, `--font-primary` Aileron, `.pagination-btn`)
- `modules/dashboard/dashboard-styles.css` (vars de marca; `--dashboard-dark`/`--dashboard-light` mantidos)
- `modules/dashboard/dashboard-widgets.js` (`CHART_COLORS` oficiais — só dataset visual, sem lógica)
- `modules/dashboard/README.md` (paleta documentada)
- `tests/redesign-theme-regression.test.mjs` (trava anti-inline no index + marca do módulo)

## Implementação
- Auditoria (`tmp/audit-fase2.mjs` + `tmp/audit-dom.mjs`): 83 classes no inline; DOM renderizado
  (165 classes, tenant training) usa ZERO classes dos sistemas legados
  (`.dashboard-card`, `.stat-card`, `.forex-*`, `.currency-*`, `.chart-*`, `.recent-*`,
  `.indicator-*`, `.export-button`, `.footer-copyright`); `section-title` sem ponto nunca casou
  elemento algum. Prova de morte em `tmp/qa-1b/index-dom.json`.
- Regras vivas portadas: `body` padding 20px + preflight `box-sizing` escopado a
  `html[data-theme]` (única exceção sancionada — módulos foram autorados sob border-box global);
  `.container` herdado do módulo (1400px, valor vivo). `--dashboard-dark` e `--dark-gradient`
  preservados de propósito (texto/acentos neutros).
- Módulos `dashboard-*.css` só são carregados por `index.html` (+ labs isolados, que pinam as
  próprias vars) — migração sem blast radius.
- Falha intermitente honrada: suite acusou 1 fail (minha asserção anti-roxo achou resíduo no
  `.pagination-btn` + `CHART_COLORS`); migrados, suite voltou a 639/0.

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (639 pass, 0 fail, 1 skip emulador).
- QA visual pós-mudança (6 capturas, 0 erros): dark com acentos de marca nos KPIs, light com
  texto legível (correção do 2º bloco `prefers-color-scheme` do módulo), engrenagem OK,
  troca de tema por clique OK. Métricas computadas idênticas antes/depois da remoção.
- `git diff --stat -- index.html`: +22/−785.

## Notas
- `C:\Sisweb` intocável; trabalho só em `D:\Sisweb_redesigner`, validação só em `localhost`.
- Regra de ouro: nenhuma lógica de boot/tenant/widgets será alterada — só CSS e vars.
