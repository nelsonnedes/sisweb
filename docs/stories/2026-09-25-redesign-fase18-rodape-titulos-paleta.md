# Story: Fase 18 — Rodapé ancorado, títulos padrão, paleta blindada

## Status
Done

## Contexto
Dashboard com rodapé mais largo que o conteúdo (container 1200px vs rodapé 1400px);
títulos grandes de cada módulo em branco/legado; header da paleta quebrado no
company.html (`button { width: 100% }` esticava o ×).

## Implementação
- Rodapé: `menu-component.js` + espelho `global-footer.js` ancoram o
  `.global-system-footer` no `.container` (fallback body) — largura sempre = conteúdo,
  do dashboard (1200px) aos módulos (1300/1400px), romaneios incluídos.
- Títulos: `.sw-page-title` em content-theme (gradiente oficial + tipografia, receita do
  dashboard; alinhamento/tamanho preservados) aplicado aos H1 de 22 páginas
  (vendas, compras, estoque, finanças, folha, notas, mdf-e, cadastros, company,
  romaneios ×5, admin ×4, ajudabitolas, importar). `user-profile` (nome dinâmico),
  login e landings excluídos por decisão.
- Paleta: blindagem em shell-theme (flex + `width:auto !important` cirúrgico no
  close/tabs/resets contra `button` global do legado).

## Validação
- Regressão do tema 18/18; gates + QA na consolidação da Fase 19.

## File List
- `menu-component.js`, `global-footer.js`
- `styles/content-theme.css`, `styles/shell-theme.css`
- 22 HTMLs com `sw-page-title`, `tests/redesign-theme-regression.test.mjs`
