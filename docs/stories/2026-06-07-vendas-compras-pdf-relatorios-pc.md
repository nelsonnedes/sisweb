# Story: Padronizacao PC de PDFs, relatorios e acoes em Vendas/Compras

## Contexto

O usuario pediu foco nos layouts de PDF, impressao e relatorios para PC, pois os botoes de imprimir nao estavam seguindo o layout padrao do sistema. Tambem apontou que, em `vendas.html` > Relatorios na versao PC, os icones da coluna Acoes estavam colados.

## Analise

- [x] Capturar producao em viewport desktop.
- [x] Delegar analise/correcao de PDF e relatorios.
- [x] Delegar analise/correcao de acoes em Vendas Relatorios PC.
- [x] Integrar correcoes locais.
- [x] Validar visualmente local e em producao.
- [x] Rodar gates.
- [x] Fazer deploy.

## Criterios de aceite

- [x] PDFs/impressoes de Vendas e Compras seguem visual profissional consistente com Sisweb no PC.
- [x] Relatorios impressos usam cabecalho, tabela, totais e espacamento padronizados.
- [x] Coluna Acoes em Vendas Relatorios no desktop tem icones centralizados e com gap adequado.
- [x] Ajustes nao quebram PWA nem fluxo de PDF compartilhavel.
- [x] Validacoes obrigatorias realizadas.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: aprovada. As alteracoes nao criam escrita nova em banco, preservam leitura multi-tenant existente via `obterDadosEmpresa()` e apenas clonam/sanitizam DOM para impressao; PWA continua usando helper local de jsPDF.
- Responsividade e Padronizacao: aprovada. Relatorios e impressoes usam `SiswebCommercePdf`/`sisweb-print-*`; coluna Acoes em Vendas Relatorios tem fallback desktop para `.relatorio-acoes-buttons` e `.acoes-buttons` generico com gap de 6px.
- Conformidade Legal: aprovada. Nao houve alteracao de calculos fiscais, folha, estoque ou regras governamentais; mudancas sao de apresentacao de relatorios/PDF.

## File list

- `commerce-pdf-share.js`
- `print-styles.css`
- `vendas.html`
- `vendas.js`
- `compras.html`
- `compras.js`
- `fornecedor.html`
- `sw.js`
- `menu-component.js`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/vendas-lista-pedidos-acoes.test.mjs`

## Evidencias

- Producao antes do ajuste: Vendas > Relatorios apresentava `#relatoriosTable .acoes-buttons` com gaps `[0, 0]` e assets `v7`.
- Local `127.0.0.1:8770` com dados ficticios em DOM e viewport 1366x768: assets `v8`, helper `SiswebCommercePdf` ativo, funcoes globais ativas, gaps `[6, 6]`, `pageOverflow = 0`.
- Producao limpa `https://sisweb-7ce82.web.app/vendas.html?noRedirect=true&verify=print-pc-v8`: assets `v8`, helper ativo, funcoes globais ativas, gaps `[6, 6]`, `pageOverflow = 0`.
- HTTP pos-deploy: `vendas.html` referencia `commerce-print-pc-v8`; `sw.js` publica `APP_VERSION = '2026-06-07-commerce-print-pc-v8'`; `vendas.js` publicado contem `relatorio-acoes-buttons`, `window.gerarRelatorio` e `printHtmlDocument`.
- `node --check commerce-pdf-share.js`, `node --check vendas.js`, `node --check compras.js`.
- `node --test tests/commerce-responsive-pwa.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/vendas-lista-pedidos-acoes.test.mjs`: 16/16.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: 90/90.
- `firebase deploy --only hosting`: concluido em `https://sisweb-7ce82.web.app`.
