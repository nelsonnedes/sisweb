# Story: Fase 17 — Toolbar vendas, hover parity compras, chrome/etiquetas, paginação global

## Status
Done

## Contexto
Usuário reportou com prints: (1) botões da aba Relatórios do Sistema de Vendas espremidos
em coluna vertical; (2) linha da Lista de Pedidos de compras com flash branco no hover;
(3) novos ajustes em Configurações para fundo do menu do topo (+sininho+engrenagem) e
etiquetas; (4) paginações de fornecedor/client/species no padrão da Lista de Pedidos de
vendas, global via temas; (5) liberou credenciais p/ Onda B (usadas só em memória, via env).

## Causas raiz (evidência empírica via CDP)
- Toolbar: `.action-buttons` preso na 6ª `.form-group` (213px) — botões quebravam 1 por linha.
- Hover branco: `species-manager.js` injeta global
  `.table tbody tr:hover { background-color: #f8f9fa !important }` (vence o dark no TR;
  TDs transparentes deixam o branco vazar). `romaneio-manager.js` injetava `#f1f7fb` (ID vence).

## Implementação
- `vendas.html`: botões/checkbox/badge movidos p/ `.action-buttons.relatorios-toolbar`
  full-width abaixo dos filtros (só move, handlers/ids intactos); layout em content-theme.
- `species-manager.js` / `romaneio-manager.js`: injeções com override
  `html[data-theme="dark"]` p/ `var(--sw-hover)` (claro mantém fallback legado).
- `romaneio-manager.js`: paginação injetada com overrides dark (padrão Lista de Pedidos).
- `styles/content-theme.css`: guarda TR hover dark `!important`; hover explícito
  `#listaPedidosModal #listaPedidosTable`; etiquetas → `var(--sw-label)`;
  paginação global (`.pagination-controls/.pagination/.pagination-container/.btn-paginacao`,
  `[id$="Pagination"/"pagination"]`, `[id*="aginacao"]`, `#romaneioTablePagination`) claro+escuro,
  ativo sempre na marca.
- `styles/sisweb-tokens.css`: `--sw-chrome-bg` (dark #1e2228 / light #ffffff),
  `--sw-label` (dark #c7cfd6 / light #4b5563).
- `js/sisweb-theme.js`: paleta 9 → 11 linhas (Menu do topo, Etiquetas). Motor inalterado.
- `styles/shell-theme.css`: ilha do topo, dropdowns (sininho+engrenagem), badge e mobile
  passam a `var(--sw-chrome-bg)`.
- `fornecedor.html`, `client.html`, `species.html`: ativo `#3498db` → `var(--sw-brand)`.
- `tests/redesign-theme-regression.test.mjs`: teste Fase 17 (17/17 na suite).

## Validação
- Gates: lint OK, typecheck OK, `npm test` 651 pass / 0 fail / 1 skipped.
- QA `tmp/qa-fase17.mjs` (0 erros): toolbar 5 botões mesma linha + full-width; hover dark
  `rgb(36,43,51)`; paleta 11 linhas; chrome/etiqueta custom aplicados ao vivo e resetados;
  light vendas/fornecedor/compras íntegros. Tema devolvido ao escuro.
- Credenciais usadas apenas como env do processo QA; nada gravado no repo.

## File List
- `vendas.html`, `species-manager.js`, `romaneio-manager.js`
- `styles/content-theme.css`, `styles/sisweb-tokens.css`, `styles/shell-theme.css`
- `js/sisweb-theme.js`, `fornecedor.html`, `client.html`, `species.html`
- `tests/redesign-theme-regression.test.mjs`, `tmp/qa-fase17.mjs`, `tmp/qa-fase17/`
