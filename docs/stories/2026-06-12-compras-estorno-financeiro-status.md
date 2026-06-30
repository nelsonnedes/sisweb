# Story: Compras - estorno financeiro ao rebaixar status do pedido

## Status

Ready for Review

## Contexto

Apos a correcao de Vendas, a mesma classe de risco foi encontrada em Compras: pedidos de compra com status alterado para `Pendente` ou `Cancelado` nao devem manter contas a pagar vinculadas em `financas/pagar` quando ainda nao houve pagamento.

O fluxo antigo de `compras.js` ja calculava `shouldGenerateFinance`, mas ainda podia:

- remover contas somente por `origemId`, sem cobrir dados legados por numero/descricao;
- cair em fallback local apos falha de `updatePaths`;
- chamar `saveData('compras')` e `saveData('contasPagar')`, criando risco de divergencia entre pedido oficial e financeiro.

## Objetivo

Garantir que pedidos de compra alterados para `Pendente` ou `Cancelado` removam as contas a pagar vinculadas quando ainda nao houver pagamento parcial/total, sem falso sucesso em caso de falha no lote atomico.

## Acceptance Criteria

- [x] A busca por contas vinculadas cobre `origemId`, ID `CP-{pedidoId}-...`, `pedidoNumero` e descricao contendo `Compra {numero}` ou `Pedido {numero}`.
- [x] Contas com status `pago`, `parcial`, pagamentos/baixas registrados ou saldo parcialmente abatido bloqueiam a edicao/exclusao.
- [x] Salvamento de pedido com financeiro usa `updatePaths` atomico para `pedidosCompra` e `financas/pagar`.
- [x] Se a sincronizacao financeira falhar, o sistema nao conclui com falso sucesso.
- [x] Exclusao de pedido usa a mesma remocao robusta de contas a pagar.
- [x] `compras.html` versiona `compras.js` para derrubar cache da correcao.
- [x] Testes automatizados cobrem o estorno financeiro de Compras.

## Evidencias

- `node --check compras.js`: passou.
- `node --check tests/compras-financeiro-status.test.mjs`: passou.
- `node --test tests/compras-financeiro-status.test.mjs tests/vendas-financeiro-status.test.mjs tests/commerce-responsive-pwa.test.mjs tests/qa-visual-pwa-routes.test.mjs`: 26 testes passaram.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: 158 testes passaram.
- `firebase deploy --only hosting --project sisweb-7ce82 --dry-run`: passou.
- `firebase deploy --only hosting --project sisweb-7ce82`: passou.
- `npm run security:postdeploy`: 37/37 checks passaram.
- Verificacao HTTP em producao: `compras.html` aponta para `compras.js?v=2026-06-12-compras-finance-status-v1`.
- Verificacao HTTP em producao: `compras.js` publicado contem as travas de sincronizacao financeira e nao contem os fallbacks legados perigosos `saveData('compras')` / `saveData('contasPagar')`.
- Smoke no navegador integrado: `compras.html` abriu autenticado, exibiu `Sistema de Compras`, aba `Pedidos de Compras` e script `compras-finance-status-v1`.
- Follow-up observado no smoke: console mostrou `Permission denied` para alguns caminhos operacionais do tenant em Compras. Resolvido na story `2026-06-12-vendas-compras-tenant-estrito-online.md`, exigindo tenant autenticado quando online e permitindo cache apenas offline.

## Observacao Operacional

Esta story corrige o fluxo para proximas alteracoes. Nao altera dados reais de pedidos de compra diretamente via CLI.

## File List

- `docs/stories/2026-06-12-compras-estorno-financeiro-status.md`
- `compras.js`
- `compras.html`
- `tests/compras-financeiro-status.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
