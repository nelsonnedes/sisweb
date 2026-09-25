# Story: Fase 7 — Superfícies de conteúdo por página (vendas, finanças, estoque +)

## Status
Done (ondas 1 + 2: 18 páginas integradas)

## Contexto
Fases 1A–6 Done: chrome bitemático; canvas por tema.

## Contexto
Fases 1A–6 Done: chrome (menu/dropdowns/sininho/modais) bitemático; canvas por tema.
Pendente: conteúdo próprio das páginas operacionais segue claro no dark (cards, tabelas,
inputs, painéis de vendas/finanças/estoque). CSS compartilhados candidatos:
`layout-comum.css`, `ui-components.css`, `commerce-responsive.css` + inlines por página.

## Problema
Migrar superfícies de conteúdo exige auditoria por sistema de classes (Fase 2 mostrou o
método: DOM renderizado × CSS × JS) para não quebrar páginas que compartilham CSS.

## Objetivo
Conteúdo das 3 páginas (depois as demais) legível e autoral no dark, light pixel-fiel,
sem tocar em lógica.

## Acceptance Criteria
- [x] Auditoria: dono de cada superfície (compartilhado × inline × página).
- [x] Camada de conteúdo por tema sem vazar para páginas fora do escopo.
- [x] QA autenticado com dados reais (dark + light) + gates verdes.

## Tarefas
- [x] Auditoria dos compartilhados + inlines das 3 páginas.
- [x] Implementar camada por onda (vendas → finanças → estoque).
- [x] QA + gates + fechar story.

## File List
- `docs/stories/2026-09-24-redesign-fase7-paginas-conteudo.md`
- `styles/content-theme.css` (novo: remap de vars + superfícies hardcoded + abas + h1)
- `vendas.html`, `financas.html`, `estoque.html` (link da camada)
- `tests/redesign-theme-regression.test.mjs`

## Implementação
- `layout-comum.css`/`ui-components.css` são var-driven: `content-theme.css` remapeia
  `--container-background`, `--light-bg`, `--border-color`, `--text-main/muted` sob
  `html[data-theme="dark"]`, virando todas as consumidoras de uma vez sem editar os arquivos.
- Superfícies com HEX chapado (tables, paginação, modais, botões de ação, loading, mobile
  cards) ganharam regras dark; botões semânticos preservados.
- Abas `.tabs/.tab` (estrutura de cada página intacta, tinta do tema) + `h1` + `.chart-container`
  + `.summary-box` após evidência nos screenshots.
- Onda 2: migração auditável em lote (`tmp/migrate-fase7b.mjs`, dry-run + diff) para 15
  páginas (compras, client, fornecedor, species, 4 romaneios, pré-romaneio, notas, mdf-e,
  importar espécies, company, ajuda, user-profile); content-theme só onde há layout/ui.
- Família romaneios: folhas `.container`, `h2/labels`, inputs, zebra e vazio da
  `#romaneioTable`, date IDs com `!important` cirúrgico contra o legado (depuração via
  `getComputedStyle` headless).
- Fora do escopo (trilhas próprias): `admin*.html` (design system admin), `subscription*.html`
  (fluxo público de pagamento), `folha_pagamento/folha.html` (escopo de folha), backup/lab.

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (644 pass, 0 fail, 1 skip emulador).
- QA autenticado: romaneio TL 100% dark (date, zebra, vazio, totais), clientes dark,
  compras dark; guards `ui_guard`/`tenant_required` intactos nas 15; light pixel-fiel;
  0 erros de frontend (2 mensagens de backend sem sessão são esperadas).

## Notas
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.
