# Story: Fase 13 — Dropdown recolhe + modais romaneio + páginas brancas

## Status
Done

## Contexto
Usuário com prints: (1) dropdown da engrenagem NÃO recolhe após clique em item — bug de
comportamento; (2) telas ainda brancas no dark: modais "Lista de Romaneios" e "Configurar
Impressão" (PCT), user-profile, company, subscription-status, ajuda (+ modal Sobre).

## Problema
- `setupDropdowns` do menu-component só alterna no trigger e no clique-fora; links internos
  (navegação ou Tema) mantêm o painel aberto.
- Modais de lista/impressão dos romaneios e páginas de perfil/empresa/assinatura/ajuda usam
  superfícies próprias claras sem camada dark.

## Objetivo
Dropdown recolhe ao escolher + camada dark por área, sem tocar em lógica.

## Acceptance Criteria
- [x] Clique em item da engrenagem fecha o painel (navegação e Tema).
- [x] Modais romaneio + 4 páginas sem superfícies brancas destoantes no dark.
- [x] QA autenticado + gates verdes + lista de pendências publicada.

## Tarefas
- [x] Fix recolhimento.
- [x] Auditoria classes por área.
- [x] Camada + QA + gates + pendências.

## File List
- `docs/stories/2026-09-24-redesign-fase13-dropdown-paginas.md`
- `menu-component.js` (recolhe painel ao clicar em item, 80ms p/ tema aplicar)
- `styles/content-theme.css` (lista/print-config/profile/company/subscription/ajuda + zebra TD + paginação espelhada)
- `styles/shell-theme.css` (bloco `@media print`: nunca imprimir o dark)
- `tests/redesign-theme-regression.test.mjs`

## Implementação
- Gear: listener no painel fecha em clique em `a.settings-action` (verificado: tema aplica + fecha).
- Debugging de cascata com protocolo DevTools (`CSS.getMatchedStylesForNode`): achou regra
  `(1,2,3)` escondida (`html body #x .modal-body > .rlc-pagination-bar` branca) e zebra no TD
  (`td` pinta sobre `tr`) — ambas vencidas com espelhamento documentado.
- Print: reset para papel claro no print.

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test`: 646 pass + 1 fail ALHEIO ao trabalho
  (teste 294 exige allowlist p/ `redesign-do-sisweb-login-index-e-tema-light-dark.json`,
  dump de OUTRA sessão de agente em 24/09 19:35 — não criado nem tocado por este trabalho;
  não deletado para não corromper a sessão alheia).
- QA autenticado: gear recolhe, PCT dark (linhas/paginação/filtro), profile hero em marca,
  company/subscription/ajuda dark; 0 erros de frontend.

## Fases ainda pendentes (backlog honesto)
- Fase 14: print-config modal — screenshot de confirmação (regras aplicadas, falta evidência visual).
- Fase 15: passada light-theme completa (paridade pixel em todas as páginas no Claro).
- Fase 16: passada mobile 390px nas páginas temizadas.
- Fase 17: QA visual do admin (exige conta superadmin) + auditoria print completa por página.
- Trilhas declaradas fora do tema: checkout `subscription.html`, `backup/`, lab `marqueting/`.

## Notas
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.
