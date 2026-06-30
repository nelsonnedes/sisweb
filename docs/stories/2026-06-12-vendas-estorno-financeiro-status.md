# Story: Vendas - estorno financeiro ao rebaixar status do pedido

## Status

Ready for Review

## Contexto

Foi identificado em producao que o pedido de venda `000074` possui financeiro gerado em `financas/receber/2026-05/CR_PED17762596576691544_001`. Ao tentar alterar o pedido para `Pendente`, a parcela poderia permanecer no Financeiro, deixando conta a receber vencida mesmo quando o pedido deixa de estar aprovado/entregue.

Log de console enviado em 2026-06-12 mostrou a causa da regressao pos-deploy:

- `update at / failed: permission_denied` durante `updatePaths`;
- o lote possuia remocoes financeiras e caminhos legados `contasReceber`;
- as regras atuais permitem escrita em `companies/{companyId}/financas/receber` e `companies/{companyId}/vendas/pedidos`, mas nao em `companies/{companyId}/contasReceber`;
- apos a falha, o fallback salvava somente `vendas/pedidos`, podendo deixar financeiro vinculado e criar falso sucesso para o usuario.

Leitura somente consulta em producao mostrou:

- pedido `PED17762596576691544`, numero `000074`, ainda salvo como `aprovado`;
- conta vinculada com `origemId: PED17762596576691544`, `pedidoNumero: 000074`, descricao `Venda - Pedido 000074 - Cheque-pré`, valor `R$ 1.200,00`, vencimento `2026-05-15`.

## Objetivo

Garantir que pedidos de venda alterados para `Pendente` ou `Cancelado` removam as contas a receber vinculadas quando ainda nao houver recebimento parcial/total, sem apagar contas ja pagas ou parcialmente recebidas.

## Acceptance Criteria

- [x] Ao salvar pedido com novo status `pendente` ou `cancelado`, contas a receber vinculadas sem recebimento sao removidas no mesmo `updatePaths` que salva o pedido.
- [x] A busca por contas vinculadas cobre `origemId`, id `CR_{pedidoId}_...`, `pedidoNumero` e descricao contendo `Pedido {numero}` para dados legados.
- [x] Contas com status `pago`, `parcial`, recebimentos registrados ou saldo parcialmente abatido bloqueiam a mudanca para status sem financeiro.
- [x] Exclusao de pedido usa a mesma remocao robusta dos caminhos mensais e legados.
- [x] `vendas.html` versiona `vendas.js` para derrubar cache da correcao.
- [x] Testes automatizados cobrem o caso do pedido `000074`.
- [x] Remocao atomica em producao nao inclui `contasReceber` legado sem regra de escrita.
- [x] Se o estorno financeiro nao puder ser feito no mesmo lote atomico, o sistema nao conclui com falso sucesso.

## Evidencias

- `node --check vendas.js`: passou.
- `node --check compras.js`: passou.
- `node --check tests/vendas-financeiro-status.test.mjs`: passou.
- `node --test tests/vendas-financeiro-status.test.mjs tests/vendas-tenant-auth-guard.test.mjs tests/commerce-responsive-pwa.test.mjs tests/qa-visual-pwa-routes.test.mjs`: passou com 27 testes.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: passou com 156 testes.
- `firebase deploy --only hosting --project sisweb-7ce82 --dry-run`: passou.
- `firebase deploy --only hosting --project sisweb-7ce82`: executado com sucesso.
- `npm run security:postdeploy`: passou com 37/37 checks.
- Verificacao HTTP de producao: `vendas.html` aponta para `vendas.js?v=2026-06-12-vendas-finance-status-v3`; `vendas.js` publicado contem `includeLegacy: false`, a mensagem `Nao foi possivel estornar o financeiro vinculado` e nao contem mais `residualUpdates` para `contasReceber/${mk}`.
- Smoke no navegador em `vendas.html?verify=status-save-v3-browser`: pagina carregou com `pedidoForm`, `listaPedidosModal` e `vendas.js?v=2026-06-12-vendas-finance-status-v3`; sem `warn/error` no console durante o carregamento.
- 2026-06-16: owner confirmou teste manual pelo usuario operacional no pedido `000074`; edicao aplicada pelo sistema e fluxo considerado OK.

## Observacao Operacional

Esta story corrigiu o fluxo para as proximas alteracoes. O dado financeiro real do pedido `000074` nao foi alterado via CLI; a validacao final ocorreu pelo usuario operacional no sistema em 2026-06-16.

## Pendencias

- Nenhuma pendencia operacional aberta para o pedido `000074` apos confirmacao manual do owner em 2026-06-16.

## File List

- `docs/stories/2026-06-12-vendas-estorno-financeiro-status.md`
- `vendas.js`
- `vendas.html`
- `tests/vendas-financeiro-status.test.mjs`
- `tests/vendas-tenant-auth-guard.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
