# Story: Impressão fase 2 — PES + Company + MDF-e (about:blank)

## Contexto

Fase 1 (story 2026-09-21-impressao-mobile-about-blank-voltar, commit `98f3c0d`, deploy hosting OK) corrigiu TL/Tora canônico, PCT e fallback manager + motor compartilhado. Restaram 3 pontos com o mesmo `about:blank` mobile: PES inline (`romaneiopes.html:4816` abre antes do conteúdo, sem viewport, trigger só `onload`), Company (`company.html:1734` helper com nome errado cai sempre no fallback sem CSS) e MDF-e (`mdf-e.js:820` sem validação/viewport/Voltar).

## Análise

- [x] PES: `window.open` antes do `printContent`, sem `viewport`, `onload=>print 120ms` único, Fechar só `window.close()`.
- [x] Company: `window.SiswebCommercePrint || window.SiswebPrintHelper` (morto) vs canônico `window.SiswebCommercePdf`; fallback sem CSS/viewport/Voltar e `print()` imediato.
- [x] MDF-e: `window.open` sem validação, HTML sem doctype/viewport, só botão Imprimir (sem Voltar).

## Critérios de aceite

- [ ] PES: `window.open` DEPOIS do `printContent`; `viewport` no head; Fechar com fallback `history.back()`; validação `null/closed/sem document`; trigger robusto (`fonts.ready` + fallbacks, sem remover `onload` existente nem `applyToPrintDocument('PES')`).
- [ ] Company: helper canônico `window.SiswebCommercePdf` primeiro (mantidos legados como fallback); fallback com doc completo (`doctype/charset/viewport`), barra Voltar/Imprimir, `print()` com try + foco (sem mudar dados/QR/georef).
- [ ] MDF-e: valida janela (`null/closed/sem document`); doc com `doctype/viewport`; barra com Voltar (`close()+history.back`) + Imprimir manual (sem auto-print, sem mudar conteúdo do relatório).
- [ ] Sem regressão: cálculos PES/CONAMA, spacer/colspan, `print-actions` oculto no print, dados company/QR, filtro período MDF-e e PWA branches inalterados.
- [ ] Gates: `node --check`, teste fase 2, `lint`, `typecheck`, `npm test` (admitido flaky e2e preexistente), `validate:pr`.

## Fora de escopo (posterior)

- Folha 2º motor, NF sem helper, `@page` único, `printService.js` morto, `print-styles.css 50px` global, `isCommercePwa` vs `isEstoquePwa`.

## File list

- `romaneiopes.html`
- `company.html`
- `mdf-e.js`
- `tests/romaneio-print-mobile-blank.test.mjs` (estender fase 2)
- `docs/stories/2026-09-21-impressao-fase2-pes-company-mdf.md` (este arquivo)

## Checklist

- [x] `node --check` nos 3 arquivos + teste
- [x] Teste fase 2 passa (7/7 no arquivo, 3 novos)
- [x] `npm run lint`, `npm run typecheck` OK
- [x] `npm run validate:pr` 6/6 (unit 578/0/1, e2e passou desta vez)
- [x] `git diff --stat` pequeno, sem BOM, sem `logs.md`
- [x] Commit `f9e7521` + push + deploy hosting (com fase 3 junta; inject 1 HTML `mdf-e.html`; build 478 arquivos; deploy "Deploy complete!" 6 arquivos novos)
- [x] Pós-deploy: PES padronizado para `← Voltar` + `Imprimir` (antes `Imprimir` + `Fechar`), mesma ordem dos demais romaneios — commit seguinte

## Evidências

- `node --check mdf-e.js` OK (HTMLs validados via teste de leitura).
- `node --test tests/romaneio-print-mobile-blank.test.mjs` 7/7.
- `npm run validate:pr` 6/6.
- `git status`: M `romaneiopes.html`, `company.html`, `mdf-e.js`, `tests/romaneio-print-mobile-blank.test.mjs` + ?? story. Não commitado a pedido (usuário em teste).
