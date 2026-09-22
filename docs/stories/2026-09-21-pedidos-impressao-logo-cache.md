# Story: Pedidos Vendas/Compras — impressão rápida + logo determinística

## Contexto

Usuário reporta: ao imprimir pedidos, demora no mobile e no desktop, e após a demora a logo nem sempre carrega na 1ª tentativa. Diagnóstico ponta a ponta: cada clique re-executa do zero `obterDadosEmpresa` + `resolveCompanyLogoDataUrl` (4 serviços × N candidatos sequenciais, 6s cada, sem cache) e o `print()` dispara em delay fixo sem aguardar o decode da imagem; no lote, tudo isso roda N vezes (1× por pedido).

## Decisão

Pacote A+B+C+D (escolhido pelo usuário; E paralelização e F persistência rejeitadas — F conflita com a remoção deliberada de `data:` do `company_info` em `firebaseService.js:3859` e com o Cérebro §31 de quota).

## Critérios de aceite

- [x] A: cache em memória do DataURL da logo (`logoDataUrlCache`, chave = fonte; `clearPrintLogoCache` exposto; teto 20 entradas).
- [x] B: warm-up em background no init de vendas/compras (`requestIdleCallback`, nunca bloqueia/quebra).
- [x] C: `printHtmlDocument` aguarda `fonts.ready` + decode das imagens com teto 1800ms (backstops preservados).
- [x] D: lote resolve empresa+logo 1× e injeta via 2º argumento (contrato já existente em `gerarHTMLImpressaoPedido(pedido)` / `...Compra(pedido)`).
- [x] Teste `commerce-responsive-pwa` atualizado para o novo contrato do lote (Cérebro §6.5: regex acompanha código).
- [x] Gates: `node --check`, focado 9/9, `validate:pr` 6/6 (580/0/1).

## File list

- `commerce-pdf-share.js`
- `vendas.js`
- `compras.js`
- `tests/commerce-responsive-pwa.test.mjs` (regex lote compras)
- `tests/romaneio-print-mobile-blank.test.mjs` (novo teste pacote)
- `docs/stories/2026-09-21-pedidos-impressao-logo-cache.md` (este arquivo)

## Checklist

- [x] `node --check` nos 3 fontes + testes
- [x] Focado 9/9 + `commerce-responsive-pwa` 11/11
- [x] `npm run lint`, `npm run typecheck` OK (via validate:pr)
- [x] `npm run validate:pr` 6/6
- [x] `git diff --stat` revisado, sem segredos/BOM/`logs.md`
- [ ] Sem commit/push/deploy (aguardando ordem)

## Evidências

- Falha intermediária real encontrada e corrigida: `commerce-responsive-pwa:393` exigia chamada de 1 argumento; atualizada para o contrato de 2 (lote reutiliza empresa).
- Comportamento esperado após deploy: 1ª impressão resolve 1× (warm-up cobre a maioria), repetidas instantâneas com logo em DataURL; lote de N pedidos paga 1× o custo.
