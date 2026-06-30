# Story: PDF compartilhavel na Lista de Pedidos PWA

## Contexto

O usuario solicitou que, no PWA, o botao Imprimir da Lista de Pedidos disponibilize PDF para compartilhar ou imprimir, tanto em Vendas quanto em Compras. O fluxo antigo abria uma janela por pedido selecionado, comportamento fragil em app instalado e mobile.

## Analise

- [x] Identificar `imprimirPedidosSelecionados()` em `vendas.js` e `compras.js`.
- [x] Identificar risco de `window.open()`/`print()` em sequencia no PWA.
- [x] Integrar geracao de PDF unica por pedido ou selecao.
- [x] Manter impressao desktop individual como fluxo legado quando apropriado.
- [x] Empacotar `jsPDF` localmente para reduzir dependencia de CDN no PWA.
- [x] Corrigir largura do campo Data no formulario mobile de Vendas e Compras.
- [x] Corrigir Lista de Pedidos de Compras com cards mobile sem sobreposicao.
- [x] Padronizar tabelas do modal Detalhes do Pedido como cards no PWA.
- [x] Impedir quebra vertical de valores monetarios em Detalhes do Pedido.

## Criterios de aceite

- [x] Lista de Pedidos em Vendas gera um unico PDF para os pedidos selecionados.
- [x] Lista de Pedidos em Compras gera um unico PDF para os pedidos selecionados.
- [x] Impressao individual em mobile/PWA usa PDF compartilhavel/download.
- [x] PDF usa Web Share API quando o aparelho suporta compartilhamento de arquivos.
- [x] PDF baixa arquivo quando compartilhamento nativo nao esta disponivel.
- [x] Campo Data do `pedidoForm` fica com a mesma largura dos demais campos no mobile.
- [x] Lista de Pedidos em Compras nao sobrepoe dados nem acoes no PWA.
- [x] Modal Detalhes do Pedido mantem header, tabelas, Imprimir e Editar legiveis no PWA.
- [x] Valores como `R$ 750,00` aparecem em uma linha nos cards de Detalhes.
- [x] Validacao visual/local em Vendas e Compras.
- [x] Gates executados.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: geracao acontece no browser com dados ja carregados do tenant atual; sem novas leituras globais ou escrita em dados.
- Responsividade e Padronizacao: comportamento PWA usa compartilhamento/download nativo e regras comuns em `commerce-responsive.css`.
- Conformidade Legal: nao altera calculos fiscais, financeiros ou trabalhistas; apenas formato de impressao/compartilhamento de pedidos.

## File list

- `assets/vendor/jspdf.umd.min.js`
- `commerce-pdf-share.js`
- `commerce-responsive.css`
- `vendas.html`
- `compras.html`
- `vendas.js`
- `compras.js`
- `sw.js`
- `menu-component.js`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`

## Evidencias

- Browser comments do usuario indicam PWA/mobile com campo Data desalinhado e necessidade de PDF compartilhavel na lista de pedidos.
- Browser local autenticado em `319x531`: Vendas carregou `vendas.js?v=2026-06-07-detail-values-mobile-v5` e exibiu `PDF gerado: pedido-venda-*.pdf` apos imprimir pedido selecionado.
- Browser local autenticado em `319x531`: Compras carregou `compras.js?v=2026-06-07-detail-values-mobile-v5` e exibiu `PDF gerado: pedido-compra-*.pdf` apos imprimir pedido selecionado.
- Verificacao local com dados ficticios: `commerce-pdf-share.js` gerou blob `application/pdf` usando `/assets/vendor/jspdf.umd.min.js`.
- Fixture mobile local em `319x531`: Lista de Pedidos e Detalhes do Pedido sem overflow horizontal; Detalhes sem sobreposicao de celulas.
- Teste estatico: botoes `Imprimir` e `Editar` do modal Detalhes chamam `imprimirPedido(window.pedidoVisualizando)` e `editarPedido(window.pedidoVisualizando)`.
- Teste estatico: valores monetarios em Detalhes usam `commerce-card-money` com `white-space: nowrap`.
- Gates: `npm run lint`, `npm run typecheck`, `npm test` com 89 testes aprovados.
- Pos-deploy: `sw.js`, `compras.html`, `vendas.html`, `commerce-responsive.css`, `compras.js` e `vendas.js` publicados com `2026-06-07-detail-values-mobile-v5`; scripts contem `commerce-card-value`, `commerce-card-money`, `data-label="Total"` e `data-label="Valor"`.
