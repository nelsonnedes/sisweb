# Story: Liquido quitado como saldo em aberto

## Status
Ready for Review

## Contexto
Na tabela de lancamentos da folha, apos clicar em `Fechar Mes`, o pagamento passa a estar quitado, mas a coluna `Liquido` continua exibindo o ultimo valor liquido calculado. O usuario pediu analisar tambem impacto em recibos e relatorios.

## Problema
O sistema usa a mesma funcao para dois conceitos diferentes:
- valor liquido calculado/pago, usado para recibos, PIX, historico e relatorios financeiros;
- saldo liquido em aberto, usado na leitura operacional da tabela e de totais restantes.

Quando o lancamento mensal fica com status `mes_fechado`, o saldo em aberto deve ser zero, mas o valor pago deve continuar preservado para recibo e auditoria.

## Objetivo
Separar valor liquido historico, valor pago e saldo liquido em aberto, exibindo saldo zerado na tabela de lancamentos quitados sem apagar o valor pago de recibos, QR Code PIX, financeiro e relatorios historicos.

## Acceptance Criteria
- [x] Lancamento mensal com status `mes_fechado` exibe saldo liquido `R$ 0,00` na tabela principal e informa o valor pago.
- [x] Lancamentos em aberto continuam exibindo o liquido calculado normalmente.
- [x] O valor liquido historico permanece disponivel para recibos, QR Code PIX, financeiro e relatorios de pagamento.
- [x] Recibos continuam imprimindo o valor pago/recebido, nao o saldo zerado.
- [x] Relatorios historicos continuam somando valores pagos quando o contexto for pagamento/historico.
- [x] Totais de aberto/restante usam saldo em aberto, enquanto total pago usa o valor historico pago.
- [x] A ordenacao por `Liquido` na tabela considera o saldo em aberto.
- [x] A mudanca nao grava dados em Firebase, nao altera paths e nao quebra isolamento multitenant.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` passa.

## Tarefas
- [x] Mapear os usos de liquido na tabela, filtros, recibos, PIX, financeiro e relatorios.
- [x] Criar helpers de saldo liquido em aberto e valor pago.
- [x] Aplicar o helper apenas nas visoes operacionais de saldo/restante.
- [x] Preservar `calcularSalarioLiquidoDisplay` para valor historico.
- [x] Adicionar cobertura de regressao.
- [x] Rodar gates finais.
- [x] Atualizar File List e validacoes.

## File List
- `docs/stories/2026-06-05-folha-liquido-quitado-saldo-aberto.md`
- `folha_pagamento/folha-utils.js`
- `folha_pagamento/folha-main.js`
- `folha_pagamento/folha-filtros.js`
- `folha_pagamento/folha-relatorios.js`
- `folha_pagamento/folha.css`
- `tests/folha-liquido-quitado.test.mjs`

## Analise tecnica
- `FolhaUtils.calcularSalarioLiquidoDisplay` deve continuar representando o valor calculado/historico do lancamento.
- Novo helper de valor pago deve retornar o liquido historico apenas quando o lancamento estiver baixado/quitado.
- A tabela principal deve usar novo helper de saldo em aberto, pois `mes_fechado` representa quitacao do mes.
- Recibos detalhados usam `salarioLiquido` para documentar o pagamento realizado e nao devem ser zerados.
- QR Code PIX usa o valor calculado antes da baixa; apos quitado, as acoes ficam recolhidas e o QR nao deve ser o indicador de saldo.
- Relatorios historicos devem preservar valores pagos; resumo operacional e totais restantes devem separar pagos e em aberto.
- A tabela principal renderiza saldo e valor pago no mesmo campo para evitar a leitura equivocada de que o valor historico foi perdido.
- O recibo detalhado usa `Valor Pago` quando o lancamento ja esta quitado, mantendo o mesmo valor liquido historico.
- O Resumo da Folha passa a disponibilizar colunas `Valor Pago` e `Saldo em Aberto` para conferencia financeira.

## Validações
- `node --test tests/folha-liquido-quitado.test.mjs`
- `node --test tests/folha-acoes-recolhidas.test.mjs tests/folha-pix-qrcode.test.mjs tests/folha-liquido-quitado.test.mjs`
- `node --check folha_pagamento/folha-utils.js`
- `node --check folha_pagamento/folha-main.js`
- `node --check folha_pagamento/folha-filtros.js`
- `node --check folha_pagamento/folha-relatorios.js`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Navegador local com fixture temporario e CSS/helper real: celula exibiu `R$ 0,00` e `Pago: R$ 1.000,00`; fixture removido apos validacao.
