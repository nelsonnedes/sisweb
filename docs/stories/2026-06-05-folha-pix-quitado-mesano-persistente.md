# Story: PIX quitado e Mes/Ano persistente

## Contexto

O modulo `folha_pagamento/folha.html` opera com dados reais multi-tenant no Firebase. Apos um lancamento ser baixado como mes pago, o saldo operacional em aberto deve ser zero, mas o sistema ainda precisa preservar e exibir corretamente o valor total pago ao funcionario para auditoria, recibos e relatorios.

O usuario tambem relatou que, ao carregar a pagina, a escolha de `Mes/Ano` deveria permanecer ate o usuario decidir mudar, evitando troca automatica para o mes atual ou limpeza quando a carga inicial ainda nao encontrou dados.

## Objetivo

Separar o saldo em aberto do PIX do valor total pago ao funcionario, bloquear QR Code pagavel para lancamentos ja quitados, e persistir a escolha de `Mes/Ano` sem sobrescrita agressiva na inicializacao.

## Acceptance Criteria

- [x] Lancamento quitado abre o modal `QR Code PIX` com `Valor liquido: R$ 0,00`.
- [x] Lancamento quitado nao gera QR Code PIX pagavel nem Pix Copia e Cola de novo pagamento.
- [x] O modal de PIX quitado preserva favorecido, banco e chave para consulta do RH.
- [x] A coluna `Liquido` em `Mes Fechado Pago` exibe saldo `R$ 0,00` e `Pago` com o valor total real pago ao funcionario, considerando vales/adiantamentos e quinzena quando aplicavel.
- [x] Em `Tipo: Quinzena`, o QR usa o valor da quinzena antes da baixa e usa o saldo liquido final apos `Dar baixa na quinzena`.
- [x] Apos `Dar baixa na quinzena`, a coluna `Liquido` mostra o saldo final em aberto e `Pago` com o valor da quinzena.
- [x] Relatorios e totais de pagos usam o mesmo helper de valor pago, sem misturar com saldo em aberto.
- [x] A escolha de `Mes/Ano` salva no storage e permanece ao recarregar a pagina ate o usuario mudar.
- [x] O filtro `Mes/Ano` nao e apagado automaticamente se a carga inicial ou o periodo escolhido ainda nao tiver lancamentos.
- [x] Nao criar novo caminho global; respeitar isolamento multi-tenant existente.

## Tasks

- [x] Mapear fluxo PIX, calculo de valor pago e persistencia do filtro.
- [x] Implementar helper de valor total pago ao funcionario.
- [x] Separar valor PIX, saldo em aberto e valor pago historico.
- [x] Ajustar fluxo de quinzena aberta, quinzena paga e mes fechado.
- [x] Passar saldo em aberto para o QR Code PIX e manter valor pago como dado auxiliar.
- [x] Bloquear geracao de QR para lancamento quitado/sem saldo.
- [x] Ajustar restauracao e sincronizacao de `Mes/Ano` para confiar no valor salvo.
- [x] Adicionar testes automatizados.
- [x] Rodar quality gates.

## Dev Notes

- `calcularSaldoLiquidoEmAberto` deve continuar representando somente o que ainda pode ser pago.
- `calcularValorPagoLancamento` deve representar valor recebido/quitado pelo funcionario quando status indica baixa.
- Para quinzena ou vales, o valor pago pode ser maior que o saldo liquido final, pois inclui adiantamentos ja pagos.
- O QR Code PIX e instrumento de novo pagamento; em lancamento quitado, gerar QR sem valor seria perigoso.

## File List

- `docs/stories/2026-06-05-folha-pix-quitado-mesano-persistente.md`
- `folha_pagamento/folha-utils.js`
- `folha_pagamento/folha-main.js`
- `folha_pagamento/folha-filtros.js`
- `folha_pagamento/folha-relatorios.js`
- `folha_pagamento/folha-lancamentos.js`
- `tests/folha-pix-qrcode.test.mjs`
- `tests/folha-liquido-quitado.test.mjs`
- `tests/folha-mesano-persistencia.test.mjs`

## QA Notes

- `node --test tests/folha-pix-qrcode.test.mjs tests/folha-liquido-quitado.test.mjs tests/folha-mesano-persistencia.test.mjs`
- `node --check folha_pagamento/folha-utils.js; node --check folha_pagamento/folha-main.js; node --check folha_pagamento/folha-filtros.js; node --check folha_pagamento/folha-relatorios.js; node --check folha_pagamento/folha-lancamentos.js`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Verificacao local no navegador com harness `.aiox-core/local/folha-verificacao.html`: validado modal quitado com saldo zero, sem QR, e valor pago historico.
