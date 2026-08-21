# Plano — Adaptação Mobile Romaneios (preromaneio, TL, PCT, PES, Tora) + ajudabitolas
Data: 2026-08-20 | Status: Proposta (aguarda aprovação) | Base: estoque mobile validado

## 1) Objetivo
Levar aos 6 módulos a mesma qualidade mobile do estoque (estoque.html:53-298, CEREBRO §12) sem quebrar funcionalidade. Escopo: visualização e operação em 390x844 touch, preservando desktop >768 e impressão.

## 2) Baseline estoque (o que copiar, sem inventar)
- **Cards por ID**: `@media(max-width:768px){ #idTable tbody tr{display:block!important; border-radius:10px; padding:12px} #idTable thead{display:none!important} #idTable tbody{display:flex; flex-direction:column; gap:12px} }`
- **Labels**: JS injeta `data-label` por célula (derivado de defs/labelMap) + CSS `#id td[data-label]::before{content:attr(data-label); position:static!important; width:auto!important; top:auto!important; left:auto!important; transform:none!important; padding-right:0!important}` — antídoto ao bug `ui-components.css:433-445` (`td:before position:absolute; width:40%`).
- **Seleção/Ações**: faixa full-width `td[data-label="Selecionar"]` e `td.actions-cell` com `border-top`, checkbox 20px, btn 36px.
- **Coluna oculta**: `td[style*="display: none"]{display:none!important}`.
- **Forms**: `.mobile-collapse-header` (fora do h3) + `.mobile-collapse-body` (display:none mobile, block desktop/print) + JS `inicializarMobileCollapses()`/`expandirFormSection()` com `matchMedia` e `aria-expanded`.
- **Filtros**: `offcanvas-drawer` + `toggleOffcanvas(id)`.
- **Overflow**: `.table-responsive{overflow:visible!important} .table-wide{min-width:0!important; width:100%!important}`.
- **Princípio**: override LOCAL por ID no `<style>` do próprio HTML, NUNCA em `ui-components.css`. NÃO carregar `commerce-responsive.js`.

## 3) Auditoria resumida (código real)
| Módulo | CSS carregados | Tabelas (wrapper / table / tbody) | Render JS (data-label?) | @media existente | Risco mobile |
|---|---|---|---|---|---|
| preromaneio.html | romaneio-comum, species-modal-standard, print (sem ui-components/commerce) | #tabela-serrados/#tabela-toras (sem mobile-cards) | preromaneio.js:695 `data-label` não injetado | 1024px sticky col + 500px grid | Baixo bug cards, mas scroll sem labels |
| romaneiotl.html | ui-components, romaneio-comum, species-modal-standard | #romaneioTable / #romaneioTableBody (mobile-cards ESTÁTICO) | modules/items/renderizar-tabela.js:138 (sem data-label) | 640px header + 980px modal | **QUEBRADO**: mobile-cards sem data-label + sem override static |
| romaneiopct.html | ui-components, romaneio-comum, species-modal-standard | #romaneioTable / #romaneioTableBody (sem mobile-cards) | romaneiopct-tabela.js:783 (sem data-label), 11 cols min-width:1200 | 640px header | Scroll horizontal, sem cards |
| romaneiopes.html | (monolítico inline ~3700 linhas) — sem modules/romaneiopes | similar PCT, sem mobile-cards | inline <script> (sem data-label) | — | Scroll, sem cards |
| romaneiotora.html | menu, layout-comum, romaneio-comum, species-modal-standard, ui-components, print | #romaneioTable (mobile-cards, min-width:1350, 18 cols) + fornecedorListTable/speciesListTable/romaneioListTable (sem cards) | romaneiotora.js:2148 updateTableBody (sem data-label) + romaneio-manager.js:659 + fornecedor-modals.js:1831 | 1200px/900px (oculta cols 1,2,6,7,10-14) + print | **QUEBRADO** + colunas ocultas no card |
| ajudabitolas.html | menu + font-awesome (sem ui/romaneio/commerce) | 2 tables estáticas sem wrapper (313,485) | inline classificarMadeira() | 0 @media | Estoura <400px, sem scroll wrapper |

Compartilhados: `romaneio-comum.css` (768/1200/980/720/480), `ui-components.css:327-445` (mobile-cards bug), `species-modal-standard`, `print-styles.css`. `/modules` tem 43 arquivos; TL 100% modular, TORA parcial, PCT híbrido, PES monolítico.

## 4) Princípios e anti-padrões
- NÃO tocar `ui-components.css` (afeta vendas/compras/fornecedor/client/estoque). Override local por ID.
- NÃO adicionar `commerce-responsive.css/js` nos romaneios (auto-add mobile-cards, dispara bug).
- NÃO injetar `data-label` em relatórios que devem manter scroll (aqui tudo é operacional → cards OK).
- Respeitar `display: none!important` para colunas desmarcadas; chevron fora do h3 (h3.textContent sobrescreve).
- `min-width:1200/1350` deve virar `min-width:0` no mobile via override; manter desktop intacto.

## 5) Arquitetura da solução
- **Por módulo, override inline**: bloco `<style>` no fim do `<head>` ou antes de `</head>` com `@media(max-width:768px){ #idTable thead{display:none!important} #idTable tbody{display:flex;flex-direction:column;gap:12px} #idTable tbody tr{...block card...} #idTable td[data-label]::before{position:static!important ...} }` + `@media(min-width:769px){...reverte...}`
- **JS**: injetar `data-label` nos renderizadores existentes (não reescrever). Ex: `romaneiotora.js:2149 <td data-label="Plaqueta">`, `renderizar-tabela.js:138` via defs, `romaneiopct-tabela.js:833` idem. Manter `Estoque` como referência: `escapeHtml(label)`.
- **Forms**: aplicar `.mobile-collapse` nos grids longos (preromaneio campos, romaneiotora geofields, PCT dimensoes). Reuso de `inicializarMobileCollapses()` copiado do estoque.js:900.
- **Modais**: manter scroll interno (`table-container overflow:auto`), não converter modais de lista em cards (são listas curtas com paginação); apenas garantir `min-height:0` e `flex:1`.
- **ajudabitolas**: envolver tables em `.table-responsive{overflow-x:auto}` + cards estáticos opcionais, sem JS pesado.

## 6) Detalhe por módulo (incremental)
**F1 - romaneiotora** (maior risco, 18 cols): decidir com PO quais colunas aparecem no card (proposta: Plaqueta/Custódia/AUTEF/Espécie/Rodo/Comprimento/Desconto/M³/V.Geo/Preço/Valor/Ações = 12; ocultar Oco/X no card mas manter em desktop). Remover `display:none` de 900px dentro de 768px.
**F2 - romaneiotl**: replicar F1 no `modules/items/renderizar-tabela.js`.
**F3 - romaneiopct**: 11 cols → card completo; módulo híbrido: alterar `romaneiopct-tabela.js:833` + modais PCT.
**F4 - romaneiopes**: extrair render inline para função nomeada antes de injetar labels (evitar duplicação); depois mesmo padrão.
**F5 - preromaneio**: já tem sticky; adicionar wrapper `table-responsive` + card leve (2 tabelas) + collapse nos forms de filtros.
**F6 - ajudabitolas**: adicionar wrapper + `@media` simples (table font-size 12px, padding 6px) + manter FAQ toggle existente.

## 7) Ordem e equipe
Ordem: F1 → F2 → F3 → F4 → F5 → F6 (maior impacto/risco primeiro, menor por último). Cada fase: branch `feat/romaneio-<modulo>-mobile`, gates, deploy hosting parcial.

Equipe proposta:
- **Aria (architect)** — dono do plano, revisão de `romaneio-comum.css` compartilhado.
- **Dex (dev) + subagente Dev-B** — implementação HTML/CSS/JS por módulo (um por vez).
- **Quinn (qa)** — testes `*.test.mjs` + validação browser 390x844/1280x800 (getBoundingClientRect, doc scroll, aria).
- **Dara (data)** — se precisar ajustar `firebaseService`/`StockTableColumns` (não previsto).
Skills: `architect-first` (sem arquitetura perfeita, sem código), `coderabbit-review` no PR, `checklist-runner`.

## 8) Riscos e mitigação
- `romaneio-comum.css` compartilhado: só overrides locais; qualquer toque global exige review de TL/PCT/PES/Tora/Pré.
- `modules/modals/modal-especies.js` compartilhado Tora+TL: testar ambos após injetar labels.
- `romaneiotora_tabela.js` delega a `window.updateTableBody`: manter compatibilidade (`:272`).
- Armadilha `tbody id` (financas): verificar se `#romaneioTableBody` é tbody (sim) → usar `#romaneioTable tbody tr` correto.
- Impressão: `@media print` deve manter `display:block!important` nos collapse bodies.

## 9) Testes e validação
- Novo `tests/romaneios-mobile-cards.test.mjs` (1 por módulo): `@media 768` com `#idTable tbody tr{display:block}`, `td[data-label]::before{position:static}`, render injeta `data-label`.
- Atualizar `tests/romaneios-modals-customization.test.mjs` se afetar modais.
- Browser: cards com labels via `::before static`, docSW==clientW, collapse aria, desktop reverte.
- Gates: `npm run lint` `npm run typecheck` `npm test` antes de cada fase.

## 10) Fora de escopo
Mudar `ui-components.css`, carregar `commerce-responsive.js`, reescrever `/modules` inteiro, alterar regras RTDB.
