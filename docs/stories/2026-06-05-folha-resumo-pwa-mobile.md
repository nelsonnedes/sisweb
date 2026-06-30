# Story: Resumo da Folha e PWA mobile consistente

## Contexto

No `Resumo da Folha`, o card `Total Acrescimos` podia ficar visualmente colado ao valor (`Total AcrescimosR$`) e estava somando `Quinzena` dentro do total de acrescimos. Para RH, quinzena deve aparecer como informacao propria, nao como acrescimo.

Em teste mobile/PWA, os lancamentos da folha aparentaram nao carregar. A tela inicia `#tabela-folhas-section` e `#totais-section` escondidas e depende da conclusao da inicializacao principal para exibi-las; em mobile, atraso de Firebase/modulos pode deixar a estrutura oculta.

## Objetivo

Corrigir os totais do resumo para refletir a logica de RH e reforcar a exibicao da tabela de lancamentos em PWA/mobile mesmo quando a inicializacao demorar ou houver fallback de renderizacao.

## Acceptance Criteria

- [x] `Total Acrescimos` tem espacamento visual antes do valor monetario.
- [x] `Total Acrescimos` nao soma `Quinzena`.
- [x] `Quinzena` permanece disponivel como subtotal separado quando selecionada.
- [x] Cards `Total Acrescimos`, `Total Descontos` e `Total Liquido` usam agregados reais da folha.
- [x] Renderizacao central de lancamentos torna `#tabela-folhas-section` e `#totais-section` visiveis.
- [x] Se a inicializacao principal falhar/atrasar, as secoes principais deixam de ficar presas em `display:none`.
- [x] Nao criar storage global novo e preservar o multitenancy existente.

## Tasks

- [x] Revisar montagem dos cards do `Resumo da Folha`.
- [x] Separar `valorQuinzena` do grupo de creditos/acrescimos.
- [x] Ajustar CSS dos cards de totais para evitar texto colado.
- [x] Revisar inicializacao de tabela/totais em mobile/PWA.
- [x] Adicionar guarda de visibilidade na renderizacao central.
- [x] Adicionar testes de regressao.
- [x] Rodar quality gates.

## Dev Notes

- `totalAcrescimosReal` usa `r.totalAcrescimos`, nao a soma de colunas selecionadas.
- `valorQuinzena` fica em `neutralKeys`, mantendo ordenacao separada no resumo de subtotais.
- A correcao mobile/PWA atua apenas na visibilidade da estrutura; nao altera leitura Firebase nem caminhos tenant.

## File List

- `docs/stories/2026-06-05-folha-resumo-pwa-mobile.md`
- `folha_pagamento/folha-relatorios.js`
- `folha_pagamento/folha-utils.js`
- `folha_pagamento/folha-main.js`
- `.aiox-core/local/folha-resumo-pwa-verificacao.html`
- `tests/folha-resumo-fechadas.test.mjs`

## QA Notes

- `node --test tests/folha-resumo-fechadas.test.mjs` passou com 3/3.
- `node --check folha_pagamento/folha-relatorios.js; node --check folha_pagamento/folha-utils.js; node --check folha_pagamento/folha-main.js` passou.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `npm test` passou com 41/41.
- Browser local validado em `.aiox-core/local/folha-resumo-pwa-verificacao.html`: secoes iniciaram escondidas, renderizacao exibiu tabela/totais e mostrou 1 lancamento falso.
