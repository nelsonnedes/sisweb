# Story: Correção de layout e orientação nos relatórios da folha

## Status
Done

## Contexto
O módulo `folha_pagamento/folha.html` é usado em produção com dados reais no Firebase. Em `Relatórios > Gerar Relatórios`, alguns tipos de relatório exibem a seção `TOTAIS GERAIS` com valores truncados e não há controle claro para escolher orientação de impressão/PDF entre retrato e paisagem.

## Problema
Os relatórios da folha precisam manter legibilidade dos totais, tabelas e PDFs, especialmente quando há valores monetários longos ou várias colunas. A ausência de orientação configurável limita a impressão e pode causar cortes no PDF.

## Objetivo
Revisar o fluxo de relatórios, impressão e PDF da folha para corrigir truncamentos, permitir orientação retrato/paisagem e reduzir discrepâncias sem alterar regras de cálculo ou dados de produção.

## Acceptance Criteria
- [x] `TOTAIS GERAIS` não trunca valores monetários nos relatórios.
- [x] Usuário consegue escolher orientação retrato ou paisagem antes de imprimir/exportar PDF.
- [x] Orientação escolhida é aplicada no HTML de impressão e no PDF quando houver exportação.
- [x] Correções preservam cálculos e filtros existentes.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` passa.

## Tarefas
- [x] Criar story para rastrear a correção.
- [x] Mapear geração de relatórios, impressão e PDF.
- [x] Identificar causa de truncamento em totais e tabelas.
- [x] Aplicar correção de baixo risco.
- [x] Adicionar teste de regressão quando aplicável.
- [x] Rodar gates e atualizar File List.

## File List
- `docs/stories/2026-05-28-folha-relatorios-impressao-orientacao.md`
- `folha_pagamento/folha-relatorios.js`
- `tests/company-logo-storage-policy.test.mjs`

## Análise Técnica
- O fluxo `Gerar Relatórios` cria HTML por tipo e envia para `exportarRelatorio`, que decide entre imprimir, PDF via `window.print()` e Excel.
- O truncamento vinha do CSS comum de tabelas, que aplicava `overflow: hidden`, `text-overflow: ellipsis` e `white-space: nowrap` também em `tfoot`, `.total-row` e `.totais-table`.
- A orientação estava fixa no CSS comum como `A4 portrait`, com fallback indireto para paisagem apenas pela orientação do navegador, sem controle no modal.
- O relatório `Resumo da Folha` já possuía seletor próprio de orientação e foi preservado.

## Validações
- `node --check folha_pagamento/folha-relatorios.js`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `git diff --check -- folha_pagamento/folha-relatorios.js tests/company-logo-storage-policy.test.mjs docs/stories/2026-05-28-folha-relatorios-impressao-orientacao.md`
- Validação de leitura com usuário real da empresa `1749492103278`, mês `2026-04`: 34 folhas brutas em `companies/{companyId}/folhas`, 23 folhas após os filtros normais de relatório, com geração em memória dos HTMLs `completo`, `quinzena` e `simples`.
- Na validação real, o CSS confirmou `@page A4 landscape`, `@page A4 portrait`, `data-print-orientation` e regras de totais sem `ellipsis`.

## Notas de segurança
- Não alterar regras de cálculo.
- Não executar migrações em dados reais.
- Não alterar dados no Firebase.
