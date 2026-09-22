# Story: Fail-closed expandido — excluirPedido compras + romaneio-manager

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `compras.js` (`excluirPedido` fallback), `romaneio-manager.js` (`saveData`/`deleteData`, `excluirRomaneioTora`), `tests/romaneio-preview-uso-trava.test.mjs` (+2 testes)
- **Fora de escopo (mapeado p/ próximo round):** `excluirPedido` vendas (exige rollback de estoque+financeiro), produtos/fornecedores/carregos (vendas+compras), cleanups financeiros silenciosos, legado `romaneio-firebase-service` offline→success.

## Achados da auditoria (mesmo anti-padrão)

- Compras `excluirPedido` sem financeiro: fallback `saveData` sempre-true → corrigido com `__rcSaveDataRemoteOk` (throw antes de tocar memória).
- `romaneio-manager.saveData`: `{success:false}` virava `count++` → corrigido (`falhas`, retorno `count>0 && falhas===0`); chamadores que checam (ex.: tabela Tora) passam a exibir erro corretamente.
- `romaneio-manager.deleteData`: local limpo antes/depois sem checar → reordenado remoto-primeiro com throw em falha explícita; offline-first preservado (sem serviço = comportamento antigo); `excluirRomaneioTora` com guarda anti-unhandled-rejection + toast de erro.

## Acceptance Criteria

- [x] Falha explícita nunca vira sucesso nesses 3 pontos.
- [x] Sem mudança quando serviço ausente/retorno indefinido (só `success===false` bloqueia).
- [x] Gates verdes (611 pass, 0 fail, 1 skip emulator).

## File List

- `compras.js`, `romaneio-manager.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
