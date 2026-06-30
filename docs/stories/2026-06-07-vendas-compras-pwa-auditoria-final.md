# Story: Auditoria final PWA em Vendas e Compras

## Contexto

O usuario pediu uma nova analise completa em `vendas.html` e `compras.html`, cobrindo abas, modais, relatorios, botoes, filtros e tabelas para identificar desalinhamentos, sobreposicoes, campos estourando e pontos inadequados para PWA.

## Analise

- [x] Delegar auditoria separada para Vendas.
- [x] Delegar auditoria separada para Compras.
- [x] Revisar wrappers e renderizadores dinamicos de listas, produtos, relatorios e pagamentos.
- [x] Validar localmente em viewport PWA `319x531`.
- [x] Corrigir estado vazio de tabela-card estreito.
- [x] Corrigir acoes que usavam apenas `id` em vez de `id || firebaseKey`.
- [x] Atualizar cache-busting e versao PWA.

## Criterios de aceite

- [x] Carrinho, pagamentos, produtos, listas e relatorios usam wrappers mobile-card adequados.
- [x] Tabelas dinamicas possuem `data-label` explicito nos pontos criticos.
- [x] Campos de contas a pagar/receber ocupam largura util no PWA.
- [x] Lista de pedidos e relatorios nao sobrepoem botoes/colunas no mobile.
- [x] Estado vazio de pedidos ocupa a largura do card.
- [x] Botoes de relatorio ficam alinhados e com texto claro no PWA.
- [x] `firebaseKey` e respeitado nos fluxos de Visualizar/Editar/Excluir quando nao ha `id`.
- [x] Validacoes obrigatorias realizadas.
- [x] Gates executados.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: ajustes sao de apresentacao e identificacao local de registros ja carregados; nao adicionam leituras globais nem vazamento entre tenants.
- Responsividade e Padronizacao: Vendas e Compras usam a camada comum `commerce-responsive.css` e os mesmos wrappers de cards.
- Conformidade Legal: sem alteracao em calculos fiscais, financeiros, trabalhistas ou ambientais.

## File list

- `commerce-responsive.css`
- `vendas.html`
- `compras.html`
- `vendas.js`
- `compras.js`
- `fornecedor.html`
- `sw.js`
- `menu-component.js`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`

## Evidencias

- Explorador de Compras apontou riscos em contas, produtos, relatorios, datas, modal de colunas e testes sem cobertura visual.
- Explorador de Vendas apontou riscos em contas, lista de pedidos, relatorios, `firebaseKey`, close mobile e modal de colunas.
- Browser local `319x531`: formularios de Vendas e Compras sem overflow real nas tabelas de carrinho/pagamento.
- Browser local `319x531`: Lista de Pedidos de Compras com estado vazio em largura completa apos correcao.
- Browser local `319x531`: Relatorios de Vendas e Compras com botoes alinhados e tabelas-card sem labels ausentes.
- Browser local `319x531`: Produtos de Vendas e Compras com wrappers mobile-card e sem overflow real.
- Teste focado inicial: `node --test tests\\commerce-responsive-pwa.test.mjs tests\\qa-visual-pwa-routes.test.mjs tests\\pwa-mobile-menu-session.test.mjs tests\\pwa-install-icon.test.mjs tests\\vendas-lista-pedidos-acoes.test.mjs` com 22 testes aprovados.
- Gates finais: `npm run lint`, `npm run typecheck` e `npm test` aprovados; suite completa com 89 testes.
- Deploy: `firebase deploy --only hosting` concluido para `https://sisweb-7ce82.web.app`.
- Producao validada: `sw.js`, `vendas.html`, `compras.html`, `commerce-responsive.css`, `vendas.js` e `compras.js` respondem 200 na versao `2026-06-07-commerce-pwa-audit-v6`.
