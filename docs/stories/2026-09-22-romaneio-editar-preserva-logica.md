# Story: Romaneio — Editar+recarregar+salvar preserva a lógica (lista/impressão)

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `vendas.js`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs` (+3 testes)
- **Fora de escopo:** reagrupadores pós-carga, conversão manual na edição de item, `romaneiosOrigem` append-only (comportamentos legados mantidos).

## Diagnóstico (análise profunda do ciclo)

1. **Bug crítico introduzido por nós:** `limparExclusoesPreviewVendas()` chamava a si mesma (um `replaceAll` atingiu o corpo da função). Todo reset (novo/editar/selecionar/pós-carga) estourava a pilha dentro de `try/catch` silencioso — exclusões e caches nunca limpavam. Corrigido + teste anti-regressão.
2. **Modo não persistia:** edição zerava os checkboxes e reselecionar o tipo impunha o padrão, ignorando a lógica original do pedido. Novo campo `pedido.modoAgrupamentoRomaneio` (salvo com fallback ao anterior) + restauração na edição (vendas e compras).
3. **Lista/impressão:** já eram verbatim (`produtoNome` direto, sem re-derivação) — confirmado em tabela, detalhes, impressão e PDF. Apenas classificação cosmética de `romaneio_dimensoes` alinhada nos 3 pontos (sem mudança visual).

## Acceptance Criteria

- [x] Resets de preview funcionam (3 sets limpos; sem recursão).
- [x] Editar pedido restaura o checkbox do modo salvo; reselecionar tipo preserva em vez de impor padrão.
- [x] Salvar em edição mantém modo anterior quando nenhum novo foi usado.
- [x] Lista, detalhes, impressão e PDF exibem o gravado para os 3 tipos.
- [x] Gates verdes (606 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.js`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
