# Story: PWA responsivo em Estoque e Financas

## Status

Ready for Review

## Contexto

A auditoria geral de 2026-06-11 identificou risco de cards mobile sem rotulo no Estoque e filtros de Financas forçando largura horizontal em telas pequenas.

## Objetivo

Reduzir estouro visual em PWA/mobile sem alterar regra de negocio, persistencia ou calculos.

## Acceptance Criteria

- [x] Tabela de itens de entrada do Estoque gera `data-label` nas celulas exibidas como cards mobile.
- [x] Tabelas largas do Estoque deixam de impor `min-width` em wrappers `mobile-cards` abaixo de 768px.
- [x] Linha manual de baixa e filtro de toras do Estoque quebram linha no mobile.
- [x] Filtros de Financas usam quebra responsiva e grid de uma coluna em telas pequenas.
- [x] Teste automatizado cobre os contratos responsivos.

## Tasks

- [x] Adicionar rótulos mobile em `renderizarTabelaEntrada`.
- [x] Adicionar classes responsivas para linha manual e filtro de toras.
- [x] Ajustar CSS de filtros de Financas para evitar `nowrap` global.
- [x] Adicionar teste de regressao PWA.
- [x] Rodar teste focado.

## Evidencias

- `node --test tests/estoque-pwa-impressao.test.mjs`: passou com 5 testes.
- `node --check estoque.js`: passou.

## Pendencias

- Fazer validacao visual real em 360x640 e 390x844 para Estoque entrada, baixa manual e Financas Receber/Pagar.
- Unificar contrato mobile de tabelas em helper compartilhado para reduzir CSS inline legado.

## File List

- `docs/stories/2026-06-11-pwa-estoque-financas-responsivo.md`
- `estoque.html`
- `estoque.js`
- `financas.html`
- `tests/estoque-pwa-impressao.test.mjs`
