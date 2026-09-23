# Story: Fail-closed expandido 2 — produtos, carregos, excluirPedido, fornecedores

- **Data:** 2026-09-22
- **Status:** Done (publicado junto com 1fdc2ea — ver evidências em 2026-09-22-pedidos-anti-undefined)
- **Escopo:** `vendas.js` (produtos salvar/excluir, carregos ×2, excluirPedido, cleanups), `compras.js` (produtos, fornecedores), `tests/romaneio-preview-uso-trava.test.mjs` (+4 testes)
- **Fora de escopo:** `atualizarEstoqueProdutos` remoto (reversão de memória coberta pelos rollbacks), legado offline-first.

## Correções

- Vendas produtos salvar/excluir: snapshot + remoto checado + rollback + erro (fim do "salvo localmente" silencioso).
- Vendas carregos (único e selecionados): backup por pedido + remoto checado + rollback + erro.
- Vendas excluirPedido: snapshots (pedidos + estoque), gate no financeiro vinculado (aborta sem deletar) e gate no delete do pedido, com rollbacks.
- Cleanups `removerContasReceberAnteriores/PorLista`: retornam boolean (chamadores antigos ignoram sem quebrar).
- Compras produtos (`persistProdutosCatalog` com rollback interno) e fornecedores (service lança com remoto real; UI já tratava throw).

## Acceptance Criteria

- [x] Nenhum desses fluxos confirma sucesso sem servidor.
- [x] Falha restaura memória/tela e mantém contexto para retry.
- [x] Contratos preservados (retornos antigos mantidos onde lidos).
- [x] Gates verdes (615 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.js`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
