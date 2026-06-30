# Story: Correcao PWA dos detalhes de pedido em producao

## Contexto

O usuario logou em producao e apontou que, em `compras.html`, o modal `Detalhes do Pedido` ainda exibia dados fora do campo visual em PWA. A analise deve cobrir tambem `vendas.html`, pois os modais compartilham estrutura e CSS.

## Analise

- [x] Reproduzir o problema no browser logado em producao com viewport `319x531`.
- [x] Confirmar que a ultima celula do detalhe herdava comportamento de coluna de acoes.
- [x] Corrigir a camada responsiva comum para Vendas e Compras.
- [x] Atualizar versao PWA/cache para forcar recarregamento dos assets.
- [x] Integrar retorno dos agentes locais de Vendas e Compras.
- [x] Validar localmente por estrutura, testes e checks de sintaxe.
- [x] Rodar gates.
- [x] Fazer deploy e validar producao.

## Criterios de aceite

- [x] `Detalhes do Pedido` nao corta `Total` nem `Status` no mobile.
- [x] A ultima coluna em tabelas de detalhe deixa de ser tratada como coluna estreita de acoes.
- [x] Assets de Vendas/Compras usam a nova versao `2026-06-07-commerce-pwa-detail-modal-v7`.
- [x] Lista, relatorios e filtros permanecem responsivos apos a correcao.
- [x] Validacoes obrigatorias realizadas.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: ajuste restrito a CSS/cache e marcacao visual; sem novas consultas, sem alteracao de tenant e sem dados globais.
- Responsividade e Padronizacao: correcao aplicada em `commerce-responsive.css`, compartilhada por Vendas e Compras.
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
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/vendas-lista-pedidos-acoes.test.mjs`

## Evidencias

- Browser em producao `319x531`: modal `Detalhes do Pedido` de Compras reproduziu corte visual na linha `Total`.
- Medicao DOM em producao: `td[data-label="Total"]` tinha largura computada de cerca de `80px`, enquanto o conteudo precisava de mais largura.
- Agente de Compras reforcou markup de detalhes, lista, produtos, pagamentos, relatorios e filtros.
- Agente de Vendas reforcou markup de detalhes, lista, produtos, relatorios, carrinho, contas e teste focado de acoes.
- Teste focado: `node --test tests\\commerce-responsive-pwa.test.mjs tests\\qa-visual-pwa-routes.test.mjs tests\\pwa-mobile-menu-session.test.mjs tests\\pwa-install-icon.test.mjs tests\\vendas-lista-pedidos-acoes.test.mjs` com 22 testes aprovados.
- Gates finais: `npm run lint`, `npm run typecheck` e `npm test` aprovados; suite completa com 89 testes.
- Deploy: `firebase deploy --only hosting` concluido para `https://sisweb-7ce82.web.app`.
- Producao validada por HTTP: `sw.js`, `vendas.html`, `compras.html`, `commerce-responsive.css`, `vendas.js` e `compras.js` respondem 200 na versao `2026-06-07-commerce-pwa-detail-modal-v7`.
- Browser em producao `319x531`: modal `Detalhes do Pedido` de Compras sem celulas problematicas; `Total` e `Status` com largura de card de cerca de `255px`.
- Browser em producao `319x531`: modal `Detalhes do Pedido` de Vendas sem celulas problematicas; `Total` e `Status` com largura de card de cerca de `255px`.
