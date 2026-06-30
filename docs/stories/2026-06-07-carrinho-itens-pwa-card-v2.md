# Story: Carrinho de itens legivel no PWA

## Contexto

O usuario marcou `Carrinho de Itens` em `compras.html` e depois em `vendas.html` no viewport mobile `319x531`. Mesmo apos a conversao para cards, os itens ainda apareciam embaralhados porque regras locais antigas mantinham linhas do carrinho com altura de tabela compacta.

## Analise

- [x] Reproduzir visualmente pelos prints do Browser em Compras e Vendas.
- [x] Identificar conflito de CSS: `#itensTable tr` e `#carrinhoItensTable tr` com `height: 28px`.
- [x] Identificar conflito de padding/line-height de tabela compacta vencendo o layout de card.
- [x] Manter desktop preservado, aplicando overrides apenas em `@media (max-width: 768px)`.

## Criterios de aceite

- [x] Cada item do carrinho vira um card com altura automatica.
- [x] Produto aparece como titulo legivel do card.
- [x] Quantidade, Preco Unitario e Total ficam em linhas com rotulo e valor sem sobreposicao.
- [x] Acoes ocupam uma linha propria do card.
- [x] Validacao visual local em Vendas e Compras.
- [x] Gates executados.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: ajuste somente CSS/cache, sem consultas ou escrita em dados multi-tenant.
- Responsividade e Padronizacao: corrige Vendas e Compras pela camada comum `commerce-responsive.css`.
- Conformidade Legal: sem impacto em regras fiscais, trabalhistas, ambientais ou calculos oficiais.

## File list

- `commerce-responsive.css`
- `vendas.html`
- `compras.html`
- `fornecedor.html`
- `menu-component.js`
- `sw.js`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`

## Evidencias

- Browser comments do usuario mostram o carrinho sobreposto em `compras.html` e `vendas.html`.
- Browser local em `319x531`: carrinho ficticio sem sobreposicao, sem overflow horizontal e com cards de altura automatica.
- Browser local autenticado: `pedidoData`, `pedidoNumero` e `pedidoStatus` medidos com a mesma largura em Vendas e Compras.
- Gates: `npm run lint`, `npm run typecheck`, `npm test`.
- Deploy Hosting executado; producao publica `sw.js` e paginas com `2026-06-07-detail-values-mobile-v5`.
