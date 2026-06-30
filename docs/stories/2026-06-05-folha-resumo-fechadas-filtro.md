# Story: Resumo da Folha limpo e Folhas Fechadas filtradas

## Contexto

O relatorio `Resumo da Folha` precisava exibir valores monetarios com formatacao brasileira completa, como `R$ 1.945,00`, e reduzir ruido visual nos cards de totais removendo o sufixo `(selecionados)`.

No modal `Folhas Fechadas`, a listagem inicial respeitava o `Mes/Ano` escolhido na tela principal, mas apos `Estornar Fechamento` o modal era recarregado sem reaplicar o filtro, misturando folhas de outros periodos.

## Objetivo

Melhorar a apresentacao dos totais/valores do `Resumo da Folha` e preservar o filtro ativo do modal `Folhas Fechadas` em qualquer recarga causada por update ou estorno.

## Acceptance Criteria

- [x] Valores numericos do `Resumo da Folha` sao renderizados como moeda BRL com separador de milhar.
- [x] Cards `Total Acrescimos` e `Total Descontos` nao exibem mais `(selecionados)`.
- [x] Subtotais do resumo usam o mesmo formatador BRL dos cards principais.
- [x] Ao abrir `Folhas Fechadas`, o filtro padrao de `Mes/Ano` segue o mes escolhido na tela principal quando houver.
- [x] Ao estornar fechamento com o modal aberto, a tabela e recarregada mantendo o filtro de `Mes/Ano` e funcionario.
- [x] A solucao nao cria storage global novo e preserva o isolamento multi-tenant existente.

## Tasks

- [x] Mapear montagem do `Resumo da Folha`.
- [x] Implementar formatacao BRL centralizada no resumo.
- [x] Remover sufixo `(selecionados)` dos cards de totais.
- [x] Mapear fluxo de reload do modal `Folhas Fechadas`.
- [x] Reaplicar filtros ativos apos update/estorno.
- [x] Adicionar teste automatizado de regressao.
- [x] Rodar quality gates.

## Dev Notes

- A mudanca e apenas de apresentacao e preservacao de filtro; nao altera formulas da folha.
- O filtro do modal fica em memoria/DOM do modulo, sem novo caminho Firebase ou chave localStorage.
- O fallback de `Mes/Ano` permanece como mes anterior somente quando nao ha selecao na pagina nem filtro ativo.

## File List

- `docs/stories/2026-06-05-folha-resumo-fechadas-filtro.md`
- `folha_pagamento/folha-relatorios.js`
- `folha_pagamento/folha-lancamentos.js`
- `.aiox-core/local/folha-resumo-fechadas-verificacao.html`
- `tests/folha-resumo-fechadas.test.mjs`

## QA Notes

- `node --test tests/folha-resumo-fechadas.test.mjs` passou com 2/2.
- `node --check folha_pagamento/folha-relatorios.js; node --check folha_pagamento/folha-lancamentos.js` passou.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `npm test` passou com 40/40.
- Browser local validado em `.aiox-core/local/folha-resumo-fechadas-verificacao.html`: filtro abriu em `2026-05`, estorno falso preservou `2026-05`, e junho nao apareceu apos o reload.
