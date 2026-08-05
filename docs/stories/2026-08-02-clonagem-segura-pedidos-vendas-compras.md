# Story: Clonagem segura de pedidos comerciais

**Status:** Implementada, validada e publicada no Hosting.

## Objetivo

Permitir clonar pedidos na Lista de Pedidos de Vendas e Compras sem reaproveitar IDs, baixas, históricos ou vínculos financeiros do documento original.

## Critérios de Aceitação

- [x] Vendas e Compras exibem a ação `Clonar` na coluna Ações.
- [x] O clone abre no formulário para revisão e não grava automaticamente.
- [x] O clone recebe novo número, data atual e status `Pendente`.
- [x] Cliente/fornecedor, itens, desconto e condições de pagamento são preservados.
- [x] Vencimentos mantêm a distância relativa ao pedido original.
- [x] IDs, históricos, valores pagos, data de quitação e `operationId` não são copiados.
- [x] A quarta ação cabe na tabela desktop e no card responsivo.
- [x] Smoke autenticado local confirma Vendas e Compras sem persistência automática do clone.
- [x] Hosting publicado após aprovação.

## Regressão corrigida em 05/08/2026

- Os botões Editar/Remover de item renderizavam `onclick="editarItem(${item.id})"` sem aspas; itens clonados com id `ITEM-...` geravam `ReferenceError: ITEM is not defined` ao clicar.
- Correção: `escapeJsString(item.id)` com aspas simples em `vendas.js` e comparação de id sem tipo rígido (`String(i.id) === String(itemId)`) em `editarItem`/`removerItem`.
- Compras usa índice numérico (`removerItem(${index})`) e não foi afetado.
- Testes: 358 aprovados (0 falhas), incluindo 2 novos casos em `tests/order-clone.test.mjs`.

## Regressão corrigida em 05/08/2026 (edição de itens)

- Ao editar um pedido, excluir um item mostrava "removido com sucesso" mas o item permanecia: o `find` usava coerção de tipo mas o `filter` comparava com `!==` estrito (id numérico vs string do onclick).
- Ao editar um item e adicionar, o fluxo removia o item e re-adicionava como novo, duplicando o conteúdo quando a remoção falhava.
- Correção: `removerItem` usa `String(i.id) !== String(itemId)`; `editarItem` marca `itemEmEdicaoId` e o próximo "Adicionar" atualiza o item na mesma posição (mesmo id), sem duplicar; `validarEstoque` desconta a quantidade antiga do item em edição para validar apenas o delta; estado é limpo em novo/cancelar/clonar/salvar.
- Testes: 358 aprovados (0 falhas), casos novos de edição e validação de estoque em `tests/order-clone.test.mjs`.

## Segurança Financeira

Clonar apenas prepara um rascunho em memória. O Financeiro continua sendo criado pelo fluxo normal quando o novo pedido é salvo com status que exige integração, usando o novo ID do pedido. Nenhuma callable, Rule ou estrutura de banco foi adicionada.

## Testes

- `node --check vendas.js`
- `node --check compras.js`
- `node --test tests/order-clone.test.mjs tests/commerce-responsive-pwa.test.mjs tests/vendas-financeiro-status.test.mjs tests/compras-financeiro-status.test.mjs`
- `npm test`: 343 aprovados e 1 skip esperado do Emulator.
- `npm run lint`, `npm run typecheck` e `git diff --check`: aprovados.
- `npm run build:hosting`: 450 arquivos allowlisted e 19.615.794 bytes, sem publicação.

## Ambiente Local

O workspace atual está disponível em `http://127.0.0.1:5510/`. A porta 5500 foi descartada porque servia uma cópia antiga sem a nova ação.

## File List

- `vendas.js`
- `vendas.html`
- `compras.js`
- `compras.html`
- `commerce-responsive.css`
- `tests/order-clone.test.mjs`
- `docs/stories/2026-08-02-clonagem-segura-pedidos-vendas-compras.md`
