# Story: Impressão fase 3 — Folha (holerite + demais via imprimirRelatorio)

## Contexto

Fases 1–2 corrigiram TL/Tora/PCT/PES/Company/MDF + motor compartilhado (deploy OK). Usuário reporta: na Folha, ao imprimir holerite (e outras impressões), a nova barra Voltar/Imprimir não aparece. Causa: Folha usa motor próprio (`folha_pagamento/folha-relatorios.js:imprimirRelatorio`), fora do `commerce-pdf-share.js` — monta `finalHTML` sem `viewport` (branch não-full-doc) e sem barra Voltar; a control-bar injetada pelo adaptive script tem Fechar só com `window.close()` (morre no mobile parcial).

## Análise

- [x] `imprimirRelatorio:2018`: `window.open('', '_blank')` (contrato de teste: manter exato, sem `popup=yes`), `finalHTML` sem viewport no branch wrapper, sem barra Voltar, trigger robusto já existente (fonts+images+900ms) preservado.
- [x] `injectControlBar:2278`: Fechar = `window.close()` puro.
- [x] `exportarPDF:2334`: `finalDoc` head sem viewport.
- [x] BH one-liners (`banco-horas-ui.js:1374,1418,1479,1547`) ficam para depois (família separada, anotado).

## Critérios de aceite

- [ ] `imprimirRelatorio` injeta `viewport` (se ausente) + barra `.folha-print-back` (Voltar `close()+history.back` + Imprimir) visível na tela e oculta em `@media print`, para docs full e wrapper, recibo incluso.
- [ ] `injectControlBar` Fechar com fallback `history.back()`.
- [ ] `exportarPDF` head com `viewport`.
- [ ] Sem regressão: contratos de teste preservados (`window.open('', '_blank')`, sem `popup=yes`, `imprimirRelatorio(...)` / `exportarPDF(...)` / `@page` / orientação / adapt script); cálculos, tenant, PWA inalterados.
- [ ] Gates: `node --check`, teste fase 3, `lint`, `typecheck`, `validate:pr`.

## File list

- `folha_pagamento/folha-relatorios.js`
- `tests/romaneio-print-mobile-blank.test.mjs` (estender fase 3)
- `docs/stories/2026-09-21-impressao-fase3-folha.md` (este arquivo)

## Checklist

- [x] `node --check` + teste focado (8/8)
- [x] `npm run lint`, `npm run typecheck` OK
- [x] `npm run validate:pr` 6/6 (unit 579/0/1, e2e passou)
- [x] `git diff --stat` pequeno, sem BOM, sem `logs.md`
- [ ] Sem commit/push/deploy (usuário testa antes)

## Evidências

- `node --check folha_pagamento/folha-relatorios.js` OK.
- `node --test tests/romaneio-print-mobile-blank.test.mjs` 8/8 (inclui fase 3).
- `npm run validate:pr` 6/6.
- Não commitado a pedido (usuário em teste). Restante anotado: BH one-liners (`banco-horas-ui.js:1374,1418,1479,1547`), NF sem helper, `@page` único, `printService.js` morto, `print-styles.css 50px` global.
