# Story: Folha mobile com abertos primeiro, modais em cards e QR PWA

## Contexto

Em mobile/PWA, a tabela de lancamentos da Folha esconde os cabecalhos e o usuario perde a ordenacao por titulo de coluna. Tambem ha modais de Folha que ainda usam tabelas largas, e o modal de QR Code PIX fica discrepante em telas pequenas.

## Objetivo

Agrupar lancamentos em aberto no topo da Folha e adaptar os modais operacionais principais para cards responsivos em PWA, incluindo o modal de QR Code PIX.

## Acceptance Criteria

- [x] Lancamentos em aberto aparecem sempre antes dos lancamentos pagos/quitados na tabela principal.
- [x] Ordenacao por coluna, quando usada no desktop, permanece dentro do agrupamento de em aberto/pago.
- [x] Fallback de renderizacao da tabela principal tambem respeita em aberto primeiro.
- [x] Modais de funcionarios, cargos e folhas fechadas viram cards em telas pequenas.
- [x] Modal QR Code PIX tem layout mobile/PWA responsivo, QR legivel e dados organizados.
- [x] Impressoes e desktop nao sao afetados pelo layout mobile.
- [x] Multitenancy existente permanece preservado.

## Tasks

- [x] Revisar ordenacao central da tabela principal.
- [x] Criar helper de agrupamento em aberto primeiro.
- [x] Aplicar ordenacao no fallback da tabela principal.
- [x] Adicionar `data-label` nas linhas dos modais principais.
- [x] Criar CSS de cards mobile para os modais.
- [x] Ajustar modal QR Code PIX para PWA.
- [x] Adicionar testes de regressao.
- [x] Rodar quality gates.

## Dev Notes

- `quinzena_paga` ainda conta como em aberto porque representa saldo final do mes a pagar.
- `mes_fechado` final e status baixados/pagos devem ficar no grupo pago/quitado.
- O CSS dos cards deve usar `@media screen` para nao alterar impressao.

## File List

- `docs/stories/2026-06-05-folha-mobile-abertos-modais-qrcode.md`
- `folha_pagamento/folha-utils.js`
- `folha_pagamento/folha-main.js`
- `folha_pagamento/folha-funcionarios.js`
- `folha_pagamento/folha-cargos.js`
- `folha_pagamento/folha-lancamentos.js`
- `folha_pagamento/folha.html`
- `folha_pagamento/folha.css`
- `tests/folha-mobile-abertos-modais-qrcode.test.mjs`

## QA Notes

- `node --check folha_pagamento/folha-utils.js folha_pagamento/folha-main.js folha_pagamento/folha-funcionarios.js folha_pagamento/folha-cargos.js folha_pagamento/folha-lancamentos.js`
- `node --test tests/folha-mobile-abertos-modais-qrcode.test.mjs`
- `npm run lint`
- `npm run typecheck`
- `npm test` (50 testes)
- `git diff --check` nos arquivos da story; apenas avisos de CRLF do Windows.
- QA visual via `playwright-core` do runtime do Codex em viewport 390x844: modais principais com celulas em grid/card, Folhas Fechadas sem min-width antiga, QR em uma coluna, container quadrado e chave PIX com botao editar fixo.
- Correcao adicional: footer do modal QR com botao Fechar centralizado em desktop e PWA; Playwright confirmou `centerDelta: 0` em 1280x900 e 390x844.
- Correcao adicional PWA: removido o botao Fechar duplicado do topo do modal QR; Playwright confirmou `topCloseButtons: 0`, `footerCloseButtons: 1` e footer `centerDelta: 0` em 390x844.
- A ferramenta dedicada do Browser nao ficou chamavel nesta rodada; a validacao visual foi feita com Playwright pelo runtime local.
- A tentativa de abrir novos agentes especialistas retornou limite de threads de agentes atingido; a revisao foi feita localmente com testes e QA visual.
