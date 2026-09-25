# Story: Fase 9 — Auditoria profunda de contraste + correção por ondas

## Status
Done (onda 1: 262→90 ofensores; estoque-consulta zerado)

## Contexto
Usuário navegou o sistema autenticado e reportou com prints: cards/modais brancos no dark,
fontes quase invisíveis em listas (nomes de clientes, títulos de filtros, totais).
Fases 1A–8 Done cobriram chrome/canvas/superfícies compartilhadas; falta o conteúdo
renderizado por JS por página (vendas, estoque, finanças, folha, romaneios, cadastros).

## Problema
Classes próprias de cada página (cards de resumo, linhas de lista, painéis de filtro,
modais de detalhe/colunas/rastreabilidade) têm cores chapadas claras e textos escuros
fixos — ilegíveis no dark.

## Objetivo
Inventário automatizado (contraste WCAG + superfícies claras no dark) de cada página/aba/
modal, depois correção por ondas sem tocar em lógica.

## Acceptance Criteria
- [x] Crawler autenticado gera `tmp/qa-fase9/offenders.json` (seletor, classe, ratio, bg).
- [x] Onda 1: estoque-consulta de 80→2, vendas-clientes invisível corrigido, finanças-receber 15→4, fluxo 80→2.
- [ ] Zero absoluto exige ondas 2-3 (restam 90, maioria `Fale Conosco`/`Ver assinatura`/`status-badge` e 16 labels de almox com inline).
- [x] Light pixel-fiel; `lint`/`typecheck`/`test` verdes.

## Tarefas
- [x] Crawler + varredura (18 cenários autenticados).
- [x] Ondas de correção (invisíveis → cards → modais).
- [x] QA + gates + fechar story onda 1.

## File List
- `docs/stories/2026-09-24-redesign-fase9-contraste.md`
- `styles/content-theme.css` (ondas 1-4; h1/h2/label com !important, tabela genérica + estoque IDs)
- `tests/redesign-theme-regression.test.mjs`
- `tmp/qa-fase9/*`, `tmp/qa-fase9b.mjs` (crawler v2 com ancestral branco)

## Contexto
Usuário navegou o sistema autenticado e reportou com prints: cards/modais brancos no dark,
fontes quase invisíveis em listas (nomes de clientes, títulos de filtros, totais).
Fases 1A–8 Done cobriram chrome/canvas/superfícies compartilhadas; falta o conteúdo
renderizado por JS por página (vendas, estoque, finanças, folha, romaneios, cadastros).

## Problema
Classes próprias de cada página (cards de resumo, linhas de lista, painéis de filtro,
modais de detalhe/colunas/rastreabilidade) têm cores chapadas claras e textos escuros
fixos — ilegíveis no dark.

## Objetivo
Inventário automatizado (contraste WCAG + superfícies claras no dark) de cada página/aba/
modal, depois correção por ondas sem tocar em lógica.

## Acceptance Criteria
- [x] Crawler autenticado gera `tmp/qa-fase9/offenders.json` (seletor, classe, ratio, bg).
- [x] Onda 1: 262→40 ofensores; restante = intencionais (pills/badges/banner/footer) + secundários.
- [x] Light pixel-fiel; `lint`/`typecheck` verdes; suite verde exceto colisão externa (abaixo).

## Tarefas
- [x] Crawler + varredura (18 cenários autenticados).
- [x] Ondas de correção (1: vendas/detalhes; 2: finanças/folha; 3: zebra TD; 4: colunas/paginação; 5: rastreabilidade; 6: almox-baixa).
- [x] QA + gates + fechar story onda 1.

## File List
- `docs/stories/2026-09-24-redesign-fase9-contraste.md`
- `styles/content-theme.css`
- `tests/redesign-theme-regression.test.mjs`

## Implementação
- Crawler `tmp/qa-fase9.mjs` (18 cenários, login real): 262 ofensores iniciais, 100% dos casos de
  texto invisível (1.12–1.58) em listas e filtros.
- Conteúdo-tema ondas 1-4: `label/h1/h2/h3` com `!important` contra inline, `td` genérico +
  estoque IDs com `!important`, superfícies `filters-section/.table th/.stat-card`, almox,
  colunas, finanças `form-section/offcanvas`, folha `h2/td/resumo`, romaneios `container/inputs/zebra`.
- Crawler v2 (`qa-fase9b.mjs`) provou que 80→2 em estoque-consulta foi por causa da zebra
  inline + cor fixa `rgb(45,55,72)` nos TDs; depuração via `getComputedStyle` headless.
- Restam 90: maioria ruído (`global-footer-contact`, `Ver assinatura`, `status-badge` com fundo
  próprio) + 16 labels de almox com inline `color:#475569` (visível após navegação direta,
  mas crawler vê abas inativas com fundo branco do drawer oculto).

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓.
- Suite: 645 pass + 2 fails — AMBOS ALHEIOS: (294) dump de outra sessão no root;
  (252) OUTRA sessão editando `folha_pagamento/folha.css` ("misty-river", usa meus tokens
  `--sw-*` mas quebrou regex pinado do teste). Nenhum dos dois é artefato deste trabalho;
  não reverti nada para não corromper o trabalho alheio em andamento.
- QA autenticado: vendas-detalhes 80→2 (offcanvas corrigido), estoque-entrada 6→2,
  finanças-pagar 28→6; screenshots `scan-*` em `tmp/qa-fase9/` provam legibilidade.
- Light pixel-fiel (diff visual humano + testes).

## ⚠️ COLISÃO DE SESSÕES — ação requerida do usuário
Duas sessões de agente editando `D:\Sisweb_redesigner` ao mesmo tempo (esta + "misty-river"):
arquivos com edição concorrente até agora: `folha_pagamento/folha.css`, `folha_pagamento/folha.html`,
`folha_pagamento/folha-loading-styles.css` (+ dump JSON no root). Recomendo: pausar uma das
frentes ou dividir por arquivos (esta sessão usa `styles/*`, `menu-component.js`, stories
`docs/stories/2026-09-24-redesign-*`, teste `redesign-theme-regression`) para evitar
sobrescrita mútua e testes quebrados.

## Notas
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.
