# Story: Recibo de quinzena e clone limpo

## Contexto

Apos os ajustes de PIX, saldo em aberto e valor pago historico, o recibo ainda precisava diferenciar a primeira quinzena em aberto da quinzena ja baixada. Antes da baixa, o recibo representa o pagamento da propria quinzena. Depois da baixa, a quinzena vira abatimento/desconto e o valor a receber passa a ser o saldo final do fechamento mensal.

Ao clonar um lancamento para o proximo mes, campos variaveis do periodo anterior, como vales e faltas, nao devem ser levados para o novo mes.

## Objetivo

Corrigir a semantica do recibo para `Tipo: Quinzena` e garantir que a clonagem para o proximo mes comece sem vales, faltas e residuos de calculo relacionados.

## Acceptance Criteria

- [x] Recibo de quinzena ainda nao baixada mostra `Valor a Receber` com o valor da quinzena.
- [x] Recibo de quinzena ainda nao baixada nao lista a quinzena como desconto/abatimento.
- [x] Recibo de quinzena baixada lista a quinzena em descontos como pagamento antecipado.
- [x] Recibo de quinzena baixada mostra `Valor a Receber` com o saldo final restante do mes.
- [x] Recibo de mes fechado continua mostrando `Valor Pago` quando o lancamento estiver quitado.
- [x] Recibo detalhado mostra INSS apenas uma vez, como `INSS` / `Previdencia Social`, mesmo quando houver ajuste manual e historico de vales.
- [x] Clonar para o proximo mes zera `vales`, `valesDetalhados`, historicos de vales, `faltas`, `diasTrabalhados` e residuos de desconto de faltas/vales em calculos aninhados.
- [x] Nao criar novo caminho global; manter dados no proprio lancamento multi-tenant.

## Tasks

- [x] Mapear fluxo do recibo detalhado e os estados da quinzena.
- [x] Separar quinzena aberta de quinzena baixada no recibo.
- [x] Ajustar totais do recibo para abater quinzena somente apos baixa/fechamento.
- [x] Remover duplicidade visual de INSS manual no recibo detalhado.
- [x] Limpar campos variaveis na clonagem para o proximo mes.
- [x] Adicionar testes automatizados para recibo e clone.
- [x] Rodar quality gates.

## File List

- `docs/stories/2026-06-05-folha-recibo-quinzena-clone-limpo.md`
- `folha_pagamento/folha-relatorios.js`
- `folha_pagamento/folha-lancamentos.js`
- `tests/folha-recibo-quinzena-clone.test.mjs`
- `tests/folha-liquido-quitado.test.mjs`

## QA Notes

- `node --test tests/folha-recibo-quinzena-clone.test.mjs tests/folha-liquido-quitado.test.mjs tests/folha-pix-qrcode.test.mjs`
- `node --check folha_pagamento/folha-relatorios.js; node --check folha_pagamento/folha-lancamentos.js`
- `npm run lint`
- `npm run typecheck`
- `npm test`
