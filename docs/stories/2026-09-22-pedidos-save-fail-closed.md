# Story: Pedidos — Save fail-closed (fim do "sucesso fantasma" pós-reload)

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `vendas.js` (`salvarPedido`, `saveData`), `compras.js` (`salvarPedido`, `saveData`), `tests/romaneio-preview-uso-trava.test.mjs` (+2 testes)
- **Fora de escopo:** regras/validações do servidor, callables, reconciliação offline.

## Diagnóstico (produção, dados reais)

Sintoma: editou → limpou → recarregou romaneio → salvou + imprimiu OK → reload voltou ao antigo.
Causa raiz (auditoria de equipe, confirmada no código):
1. `window.pedidos`/`window.compras` mutados ANTES da rede; falhas remotas só geravam `warn`.
2. `saveData` retornava `true` mesmo sem servidor → toast de sucesso incondicional (vendas) / fallback "ok" (compras sem financeiro).
3. Reload é Firebase-first + TTL 60s sem invalidação pós-callable → mostra o antigo.
4. Lista/impressão liam memória → mascaravam na sessão.

## Correção (cirúrgica, contrato de `saveData` preservado)

- Vendas: snapshot `backupPedidos` + flag `__rvSaveDataRemoteOk` (remoto real) + gate `salvouServidor`: sem confirmação → rollback da memória, toast de ERRO claro, formulário aberto para retry. Com confirmação → invalida `vendas/pedidos` + `pedidosVenda` no cache de leitura.
- Compras: flag `__rcSaveDataRemoteOk`; fallback só confirma com remoto OK (senão throw antes de tocar memória); invalida `pedidosCompra` no sucesso.
- Mudança de comportamento intencional: falha remota agora aparece como ERRO (antes: sucesso falso). Offline puro não "salva" mais.

## Acceptance Criteria

- [x] Sem toast de sucesso sem confirmação do servidor (ordem verificada em teste).
- [x] Rollback de memória + retry preservado na falha.
- [x] Invalidação pós-callable (fecha a janela de 60s de dado velho).
- [x] Gates verdes (609 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.js`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
