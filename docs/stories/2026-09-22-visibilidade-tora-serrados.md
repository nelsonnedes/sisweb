# Story: Visibilidade TORA x serrados + Resumo em vendas

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `commerce-responsive.css`, `compras.js`, `vendas.html`, `vendas.js`, `tests/romaneio-preview-uso-trava.test.mjs` (+2 testes)

## Diagnóstico

1. **CSS anulava `hidden`:** `.romaneio-group-fieldset{display:flex}` vence o UA `[hidden]` — o fieldset de compras nunca escondia para TORA. Regra `[hidden]{display:none!important}` adicionada.
2. **Vendas sem condicional:** fieldset sempre visível, inclusive TORA. Criado modo Resumo-para-TORA (checkbox + visibilidade total espelhando compras).
3. Compras: visibilidade antecipada (vale com lista vazia).

## Comportamento final (novo + edição)

- TORA: só `Carregar apenas o Resumo`; fieldset oculto; default Resumo.
- TL/PCT/PES: só fieldset (3 modos); Resumo oculto; default E x L.
- Edição infere o tipo do pedido (`romaneioTipo`) para visibilidade + restaura checkbox; mismatch resolve para o tipo.

## Acceptance Criteria

- [x] Modo resumo em vendas: preview por espécie + carga 1:1 + trava de reuso (usa `origemId`, participa do mapa).
- [x] Exclusões por modo (4 sets) + limpeza ao trocar.
- [x] Gates verdes (627 pass, 0 fail, 1 skip emulator).

## File List

- `commerce-responsive.css`, `compras.js`, `vendas.html`, `vendas.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
