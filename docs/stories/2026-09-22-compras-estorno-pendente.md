# Story: Compras — estorno ao voltar para Pendente (paridade Vendas)

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `compras.js` (`salvarPedido`), `tests/compras-financeiro-status.test.mjs` (+1 teste)
- **Sintoma:** editar compra → Pendente mantinha o financeiro (vendas estornava).

## Causa raiz

`contasCriar` era montado das parcelas da UI sem o gate `shouldGenerateFinance` (vendas tem em `contasParaCriarPayload`). No Pendente, o callable removia as antigas e **recriava** as mesmas — efeito líquido zero. O modo legado tinha o mesmo furo.

## Correção (espelho de vendas)

- `contasCriar` só quando `shouldGenerateFinance`; em pendente/cancelado, vão só remoções.
- Toast `Financeiro do pedido N estornado: M parcela(s)` (paridade).
- Modo legado: recriação também gated; remoção e pedido incondicionais.
- Bloqueio com pagamento realizado e `romaneiosOrigem`/fail-closed intactos.

## Acceptance Criteria

- [x] Editar → Pendente/Cancelado sem pagamento: contas removidas, nada recriado.
- [x] Com pagamento: bloqueio mantido.
- [x] Fluxo normal (aprovado/entregue) inalterado.
- [x] Gates verdes (628 pass, 0 fail, 1 skip emulator).

## File List

- `compras.js`, `tests/compras-financeiro-status.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
