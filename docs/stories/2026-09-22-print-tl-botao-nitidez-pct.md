# Story: Impressão TL sem botão duplicado + nitidez PCT

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `modules/reports/imprimir-romaneio.js`, `modules/romaneiopct/imprimir-romaneio-pct.js`, `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Sintoma:** about:blank do TL com 2 Imprimir (topo + rodapé); PCT apagado para clientes.

## Causa raiz

1. TL mantinha footer legado (`imprimirRelatorio()`) + barra `ensureRomaneioPrintAux` (guarda só enxerga `.sisweb-print-back`, botão nu passava).
2. PCT: texto `#333`, detalhes `#555`, totais `#f8f9fa` sem cor, bordas `#eee` (somem no papel).

## Correção

- TL: removidos bloco do botão + helper (PCT/Tora nunca tiveram; `button{display:none}` mantido como rede de segurança).
- PCT só cores (zero reflow): base `#000`, detalhes `#1f2937`, totais `#e6f2ff/#0066cc` (padrão TL), bordas `#dcdcdc`. Tamanhos intactos.
- Fase 2 proposta (com validação visual): pisos de fonte `dense=2` (5.4–6.6px) e `scale<0.85` — não mexidos aqui por risco de overflow.

## Acceptance Criteria

- [x] TL com 1 barra (Voltar+Imprimir) na tela, zero botão no papel.
- [x] PCT com contraste AA nos textos-base.
- [x] Gates verdes (632 pass, 0 fail, 1 skip emulator).

## File List

- `modules/reports/imprimir-romaneio.js`, `modules/romaneiopct/imprimir-romaneio-pct.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
