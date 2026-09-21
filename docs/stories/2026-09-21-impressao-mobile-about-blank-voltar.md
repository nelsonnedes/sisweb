# Story: Impressão mobile — corrigir about:blank sem botão Voltar

## Contexto

No mobile, ao clicar em Imprimir (principalmente romaneios TL/PCT/Tora), abre aba `about:blank` sem botão voltar e sem disparar `print()`. Diagnóstico da equipe (2026-09-21): `window.open('', '_blank')` parcial no mobile retorna truthy sem histórico/nav, `onload + setTimeout 250ms` não dispara após `document.write`, HTML parcial sem `viewport`/botão fechar, `close()` imediato, e PCT abre a janela ANTES dos dados (blank visível por segundos). Padrão correto já existe em estoque (`iframe preview modal`) e folha (`fonts.ready + fallback 900ms + lock`) e em `commerce-pdf-share.js:626` (viewport + duplo trigger + fallback iframe), mas não foi replicado no caminho romaneio.

## Análise (equipe de especialistas, sem código alterado na fase 1)

- [x] Mapear todos pontos de impressão (TL/PCT/PES/Tora/Pré + vendas/compras/finanças/estoque/folha/company/NF/MDF + `printService.js` morto + `print-styles.css`).
- [x] Diagnosticar C1–C6 do `about:blank` mobile (ver parecer arquitetural 2026-09-21).
- [x] Levantar duplicações/conflitos (`imprimirRomaneioTora` 4 vias, `@page` triplo, `.modal table height 50px`, `isCommercePwaPrintContext` vs `isEstoquePwaPrintContext`, `company.html` helper com nome errado).
- [x] Definir fix mínimo aditivo sem regressão (abaixo).

## Critérios de aceite

- [x] No PC, um pedido selecionado na Lista chama o mesmo `imprimirPedido(id)` usado em Detalhes.
- [x] PCT não exibe `about:blank` vazio: `window.open` ocorre DEPOIS de `gerarConteudoImpressao` + dados empresa (sem janela antecipada).
- [x] TL/Tora canônico (`abrirJanelaImpressao`): janela parcial detectada (`null/closed/sem document`), `viewport` garantido, barra Voltar/Imprimir visível na tela e oculta no `@media print`, trigger robusto (`onload` + `fonts.ready` + timeout fallback com guarda contra duplo `print`), sem `close()` imediato.
- [x] Fallback `romaneio-manager.js`: HTML completo (`doctype`, `charset`, `viewport`), barra Voltar/Fechar funcional (`window.close()` + fallback `history.back()`), auto-print robusto.
- [x] Motor compartilhado (`commerce-pdf-share.js`): `buildPrintDocument` injeta barra Voltar/Imprimir; CSS isenta `.sisweb-print-back` do `button{display:none}` global e esconde a barra só em `@media print`; `printHtmlDocument` mantém contrato `targetWindow` + duplo trigger (teste `commerce-responsive-pwa` preservado).
- [x] Nenhuma regressão: desktop imprime igual; PWA branch inalterado; `RomaneioPrintConfig.applyToPrintDocument` preservado; `ui-components.css` e `.mobile-cards` intocados; `@media print display:revert` dos cards preservado.
- [x] Gates verdes: `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate:pr`.

## Fora de escopo (anotado p/ posterior, NÃO nesta story)

- PES inline (`romaneiopes.html:4816`), folha 2º motor (`folha-relatorios.js:2333`), `company.html:1734` helper com nome errado, MDF/NF sem helper, `@page` único, `printService.js` morto, `print-styles.css 50px` global, cache-busters/SW bump + deploy hosting.

## File list

- `modules/reports/imprimir-romaneio.js`
- `modules/romaneiopct/imprimir-romaneio-pct.js`
- `romaneio-manager.js`
- `commerce-pdf-share.js`
- `tests/romaneio-print-mobile-blank.test.mjs` (novo)
- `docs/core/CEREBRO-SISWEB.md` (apêndice ao concluir)
- `docs/stories/2026-09-21-impressao-mobile-about-blank-voltar.md` (este arquivo)

## Checklist de validação

- [x] `node --check` nos 4 arquivos alterados + novo teste
- [x] Novo teste focado passa (4/4)
- [x] `npm run lint` OK
- [x] `npm run typecheck` OK
- [x] `npm test` 575 pass / 0 fail / 1 skip (validate:pr; `npm test` direto: 572/3 fails só no e2e puppeteer flaky `romaneios-modals-customization` — Timeout navegação + assert Pré, sem relação com print; retry no validate passou)
- [x] `npm run validate:pr` 6/6 OK
- [x] Revisar `git diff --stat` pequeno e sem BOM/mojibake (`logs.md` revertido, só 4 fontes + story + teste)
- [x] Atualizar este arquivo (aceites) + apêndice Cérebro (sem reescrever histórico)

## Evidências

- `node --check commerce-pdf-share.js / romaneio-manager.js / modules/reports/imprimir-romaneio.js / modules/romaneiopct/imprimir-romaneio-pct.js / tests/romaneio-print-mobile-blank.test.mjs` OK.
- `node --test tests/romaneio-print-mobile-blank.test.mjs` 4/4.
- `npm run validate:pr` 6/6 (lint, typecheck, unit 575/0/1, PR focus 80/80, cachebusters read-only).
- `git status`: M `commerce-pdf-share.js`, `modules/reports/imprimir-romaneio.js`, `modules/romaneiopct/imprimir-romaneio-pct.js`, `romaneio-manager.js` + ?? story + teste. Sem commit/push/deploy (não solicitado).
