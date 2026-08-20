# Spec — Adaptação Mobile do Sistema Financeiro (financas.html)

> Data: 2026-08-19 · Status: aprovado pelo usuário · Base: padrão mobile validado do Controle de Estoque de Toras (commit `0397b63`)

## Objetivo

Levar o Sistema Financeiro (`financas.html` / `financas.js`) para a mesma experiência mobile do Controle de Estoque de Toras: tabelas viram cards, formulários longos ficam recolhidos com opção de expandir, filtros vão para offcanvas, sem regressões no desktop, sem duplicações/conflitos e sem quebrar o que já funciona.

## Escopo (aprovado)

1. **Tabelas que viram cards**: apenas as 3 principais operacionais — Contas a Receber (`#receberTable`), Contas a Pagar (`#pagarTable`) e Fluxo de Caixa (`#fluxoTable`). Relatório (dinâmico, `min-width:720px`, usado em impressão) e Anexos (modal) **mantêm scroll horizontal**.
2. **Filtros com offcanvas**: Receber (7 campos) e Pagar (7 campos) escondidos em `offcanvas-drawer` com botão "Filtros". Fluxo tem só 2 filtros e fica visível.
3. **Formulários colapsados**: "Nova Conta a Receber" (13+ campos) e "Nova Conta a Pagar" (12+ campos) recolhidos por padrão no mobile, com auto-expand no modo edição.

## Contexto técnico

- `financas.html` (2011 linhas) carrega `ui-components.css` (linha 14), `layout-comum.css` (15), `print-styles.css` (65), `menu-component.js` (70). `financas.js` (9581 linhas, monólito) carrega por último (linha 2009).
- Nenhuma tabela de finanças usa `table-responsive`/`mobile-cards`/`data-label` hoje (grep = zero). Mobile atual = scroll horizontal + empilhamento de forms/filtros.
- **Regra global bugada** em `ui-components.css:433-445`: `.table-responsive.mobile-cards td:before { position:absolute; top:50%; left:12px; width:40%; ... }`. Só dispara com a classe `mobile-cards`. **Decisão: NÃO usar `mobile-cards` em finanças** — usar override local por ID com `position:static !important` (mesmo antídoto do estoque.html:220-244). Não mexer em `ui-components.css`.
- **Não carregar `commerce-responsive.js`** em finanças (auto-adiciona `mobile-cards` em qualquer `.table-responsive` → dispararia o bug na tabela de relatório `min-width:720px`).
- Colunas de Receber/Pagar são dinâmicas por preferência (localStorage `company_{tenant}__printPrefs_finance_{tipo}`, `financas.js:2782`) e o `colspan` do empty-state é calculado (4522/4817). Logo, `data-label` deve derivar do `labelMap` real (financas.js:4513) por `colKey`, nunca por índice fixo.
- `showTab` definido 3× (stub inline 960, função real 3180, `window.showTab` 9279) — não alterar.
- `sw.js` `APP_VERSION='2026-08-14-modal-list-heights-v1'` é assertada em 5 testes (`qa-visual-pwa-routes`, `pwa-mobile-menu-session`, `pwa-install-icon`, `financas-contas-pagar-edit`, `client-supplier-fiscal-fields`) — precisa bump + atualização dos testes.
- `financas.html` e `financas.js` já estão no `hosting-files.json` (linhas 261-262). Nenhum arquivo novo entra no manifesto.
- `tools/inject-cachebusters.mjs` processa só JS da raiz; CSS é manual. Rodar antes do deploy.

## Padrões a copiar (fonte: estoque)

### CSS cards mobile (por ID)
Copiar o antídoto `td[data-label]::before` (estoque.html:220-244): `content: attr(data-label)`, `font-weight:700 !important`, `color:#64748b !important`, `font-size:11px !important`, `text-transform:uppercase !important`, `letter-spacing:0.4px !important`, `text-align:left !important`, `margin-right:12px !important`, `flex:1 1 auto !important`, `white-space:normal !important`, **`position:static !important; width:auto !important; top:auto !important; left:auto !important; transform:none !important; padding-right:0 !important;`**.

Transformação `tr→card` (estoque.html:136-158): `display:block !important`, `background:#fff !important`, `border:1px solid #e2e8f0 !important`, `border-radius:10px !important`, `box-shadow:0 2px 8px rgba(15,23,42,0.05) !important`, `padding:12px 14px !important`, `margin-bottom:12px !important`. Esconder `thead`/`colgroup` (102-119). Coluna checkbox e ações em faixa full-width (246-376).

### CSS colapso (estoque.html:2053-2110)
`.mobile-collapse-header` (flex, space-between, cursor:pointer, user-select:none), `.mobile-collapse-icon` (chevron), `.mobile-collapse-body` (`display:block`). No mobile: body `display:none`, `.open` → `display:block`, chevron rotaciona com `[aria-expanded="true"]`. Desktop (`min-width:769px`): body `display:block !important`, ícone `display:none`, cursor default. `@media print`: body `display:block !important`.

**Padrão HTML obrigatório**: `<h3>`/`<label>` DENTRO do `.mobile-collapse-header` e ícone FORA do `h3` (irmão), pois funções de edição sobrescrevem `h3.textContent` e apagariam ícone aninhado. Body = `nextElementSibling` imediato do header.

### CSS offcanvas (estoque.html:546-581)
`.offcanvas-drawer` (card branco, border, radius, shadow, `animation: slideDown`), `.offcanvas-header` (flex, border-bottom, h3 16px), `.btn-close`. Drawer abre/fecha via `style.display` + `toggleOffcanvas(id)` (estoque.js:890-898).

### JS (estoque.js:900-945)
`inicializarMobileCollapses()`: percorre `.mobile-collapse-header`, liga click/keydown (Enter/Espaço), reage a `matchMedia('(max-width:768px)')`; `dataset.userOpened` preserva expansão manual ao redimensionar. `expandirFormSection(header)`: adiciona `open`, marca `userOpened='true'`, seta `aria-expanded`.

## Implementação

### 1. `financas.html` — CSS inline
Novo bloco no 2º `<style>` (antes do fechamento, ~linha 1699):
- `@media (max-width:768px)`: transformação `tr→card` para `#receberTable`, `#pagarTable`, `#fluxoTable`; esconder theads; bloco genérico `td[data-label]::before` com antídoto; coluna checkbox e ações full-width.
- Bloco `.mobile-collapse-*` (copiado do estoque).
- Bloco `.offcanvas-*` (copiado do estoque).

### 2. `financas.html` — HTML
- Envolver `#receberForm` e `#pagarForm` em `.mobile-collapse-header` (com h3 + chevron fora) + `.mobile-collapse-body` com IDs `finReceberBody` e `finPagarBody`.
- Envolver `.filters-section` de Receber e Pagar em `offcanvas-drawer` com IDs `finFiltrosReceberDrawer` e `finFiltrosPagarDrawer` (`style="display:none"`), com header + botão fechar.
- Adicionar botão "Filtros" (`onclick="toggleOffcanvas('finFiltrosReceberDrawer')"`) na `.btn-group` de cada aba.

### 3. `financas.js` — data-label
- `carregarTabelaReceber` (4598-4607): adicionar `data-label="${labelMap[colKey]}"` em cada `<td>`; `data-label="Selecionar"` no checkbox; `data-label="Ações"` na célula de ações.
- `carregarTabelaPagar` (4861-4870): idem.
- `gerarTabelaFluxo` (7223-7235): labels fixos Data/Entradas/Saídas/Saldo do Dia/Saldo Acumulado.

### 4. `financas.js` — colapso + offcanvas + auto-expand
- Copiar `inicializarMobileCollapses`, `expandirFormSection`, `toggleOffcanvas`.
- Chamar `inicializarMobileCollapses()` na inicialização (após o fluxo de `DOMContentLoaded`/`window.__siswebFirebaseServiceReady`, ~813-866).
- Auto-expand: nas funções de edição de receber/pagar e no `limparFormulario('receberForm'/'pagarForm')` (linhas 1127/1335 no HTML).

### 5. `sw.js`
`APP_VERSION = '2026-08-19-financas-mobile-v1'`. Atualizar os 5 testes que a assertam.

### 6. Testes
Novo `tests/financas-mobile-cards.test.mjs` (padrão regex do estoque):
- Antídoto `td[data-label]::before` com `position:static !important` presente para as 3 tabelas.
- `finReceberBody`/`finPagarBody` colapsáveis + CSS mobile `display:none`/`.open`/desktop `!important`.
- Funções `inicializarMobileCollapses`/`expandirFormSection`/`toggleOffcanvas` presentes e chamadas.
- `data-label` injetado nos renderizadores (receber/pagar/fluxo).
- `APP_VERSION` nova.

## Validação (browser)

- Local: `python -m http.server 4210 --directory hosting-dist`; login `madeportes27@gmail.com` / `Gsanto1w@`; ir a `/financas.html?fresh=`.
- Mobile 390x844: (a) 3 tabelas viram cards sem sobreposição (valR == tdR, `::before` static); (b) forms recolhidos por padrão, clique expande; (c) offcanvas abre/fecha; (d) sem overflow horizontal da página; (e) modais ainda funcionam.
- Desktop 1280x800: nada colapsado, chevrons ocultos, tabelas íntegras (sem cards).
- Print: bodies colapsados visíveis.

## Gates

`npm test` (sem falhas novas), `npm run lint`, `npm run typecheck`, `npm run build:hosting`, `node tools/inject-cachebusters.mjs`, deploy via allowlist (`npm run deploy:hosting`), validar produção.

## Fora de escopo (não quebrar)

- `ui-components.css` (regra 433-445 intacta).
- `commerce-responsive.js/css` (não adicionar em finanças).
- `showTab` (3 definições) e ordem de scripts do firebase-init.
- Relatório (`min-width:720px`) e Anexos: mantêm scroll.
- `print-styles.css`, `menu.css`, `layout-comum.css`: intocados.