# Story: Logo-cache sistema-wide — romaneios, estoque, folha e DANFE

## Contexto

Após o pacote de pedidos (cache + warm-up + espera + lote 1×, commit `12cec5a`), auditoria sistema-wide (2 especialistas) mostrou as mesmas doenças no resto do sistema: romaneios com URL crua e `print()` em tempo fixo; estoque preferindo URL https crua; folha com URL/path cru; DANFE com `fetch` próprio sem memo. Finanças, Company e MDF já estavam cobertos pelo motor compartilhado.

## Decisão

Aplicar A+B+C completo (escolha do usuário): levar DataURL em cache + espera de imagem a todos os módulos, sempre com guardas `typeof` (sem o motor na página, comportamento anterior preservado).

## Critérios de aceite

- [x] Fase A romaneios: `commerce-pdf-share.js` incluído em TL/PCT/Tora/PES; `upgradeRomaneioLogoToDataUrl` / `upgradePctLogoToDataUrl` / PES inline / manager fallback convertem para DataURL; espera de imagem nos auto-prints inline (TL/Tora via `replaceAll`, PES no `onload`, manager via `goWhenReady`).
- [x] Fase B estoque: `prepararLogoEmpresaRelatorio` tenta DataURL em cache primeiro, fallback integral preservado.
- [x] Fase C folha + NF: `obterDadosEmpresa` (2 saídas) e `carregarLogoDANFE` usam resolvedor com guardas; `<script>` do motor em `folha.html` e `notas-fiscais.html`.
- [x] Teste `estoque-pwa-impressao` atualizado para o novo contrato (DataURL primeiro — §6.5).
- [x] Gates: focado 10/10, `validate:pr` 6/6 (581/0/1).

## File list

- `modules/reports/imprimir-romaneio.js`
- `modules/romaneiopct/imprimir-romaneio-pct.js`
- `romaneiopes.html`
- `romaneio-manager.js`
- `romaneiotl.html`, `romaneiopct.html`, `romaneiotora.html`
- `estoque.js`
- `folha_pagamento/folha-relatorios.js`
- `folha_pagamento/folha.html`
- `nf-danfe.js`
- `notas-fiscais.html`
- `tests/estoque-pwa-impressao.test.mjs` (contrato DataURL-primeiro)
- `tests/romaneio-print-mobile-blank.test.mjs` (teste sistema-wide)
- `docs/stories/2026-09-21-logo-cache-sistema-wide.md` (este arquivo)

## Checklist

- [x] `node --check` nos fontes alterados
- [x] Focado 10/10
- [x] `npm run validate:pr` 6/6
- [x] `git diff --stat` revisado, sem segredos/BOM/`logs.md`
- [ ] Sem commit/push/deploy (aguardando ordem)

## Evidências

- Falha intermediária real: `estoque-pwa-impressao:134` travava prioridade antiga (URL crua); atualizado para DataURL-primeiro + mock registrando `company.logo`.
- Restante ainda aberto (não mexido): BH one-liners, `@page` único, `printService.js` morto, `print-styles.css 50px` global, `isCommercePwa` vs `isEstoquePwa`.
