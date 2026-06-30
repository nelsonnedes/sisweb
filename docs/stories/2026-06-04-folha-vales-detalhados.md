# Story: Histórico detalhado de vales na folha

## Status
Done

## Contexto
O módulo `folha_pagamento/folha.html` é usado em produção com dados reais e contexto multi-tenant por empresa. Em `Folha de Pagamento > Lançamentos`, o campo `Vales` era um total único, sem histórico individual de datas e valores.

## Problema
Quando um funcionário recebia mais de um vale no mês, o lançamento guardava apenas o total. Isso dificultava conferência, recibos e relatórios, porque não havia rastreio de cada data/valor.

## Objetivo
Adicionar histórico detalhado de vales no lançamento da folha, preservando o campo numérico `vales` como total compatível com cálculos, tabelas, relatórios e recibos existentes.

## Acceptance Criteria
- [x] Modal de folha exibe `Histórico de Vales` com data, valor, observação e ação de remover.
- [x] Campo `Total Vales` é calculado automaticamente e permanece compatível com o campo legado `vales`.
- [x] Lançamento salva `valesDetalhados` sem criar novo caminho no banco.
- [x] Folhas antigas com apenas `vales` continuam abrindo com valor preservado.
- [x] Tabelas, ordenação, filtros, resumo e relatórios usam a soma correta dos detalhes.
- [x] Recibo detalhado exibe os vales individualmente quando houver histórico.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` passa.

## Tarefas
- [x] Mapear fluxo do campo `Vales` no formulário, cálculo, listagem e relatórios.
- [x] Implementar UI responsiva para histórico de vales.
- [x] Persistir `valesDetalhados` junto ao lançamento e manter `vales` como total.
- [x] Atualizar helpers de cálculo/exibição para totalizar detalhes.
- [x] Atualizar recibo e relatórios relevantes.
- [x] Validar online sem salvar dados reais.
- [x] Rodar gates e atualizar File List.

## File List
- `docs/stories/2026-06-04-folha-vales-detalhados.md`
- `folha_pagamento/folha.html`
- `folha_pagamento/folha.css`
- `folha_pagamento/folha-lancamentos.js`
- `folha_pagamento/folha-utils.js`
- `folha_pagamento/folha-relatorios.js`
- `folha_pagamento/folha-main.js`
- `folha_pagamento/folha-filtros.js`

## Analise tecnica
- O campo legado `vales` continua sendo salvo como numero total para evitar regressao em calculos e filtros.
- O novo array `valesDetalhados` fica dentro do proprio lancamento em `companies/{companyId}/folhas/{folhaId}`, sem criar caminhos globais ou compartilhados entre empresas.
- `FolhaUtils.calcularTotalVales` centraliza a regra: quando houver detalhes, soma os itens; quando nao houver, usa o valor legado.
- O recibo detalhado substitui a linha unica de vales por linhas individuais e adiciona total quando houver mais de um item.
- O teste online abriu `Nova Folha`, adicionou dois vales de `100,50` e `249,50`, confirmou `Total Vales = 350,00` e fechou o modal sem salvar.

## Validacoes
- `node --check folha_pagamento/folha-lancamentos.js`
- `node --check folha_pagamento/folha-utils.js`
- `node --check folha_pagamento/folha-relatorios.js`
- `node --check folha_pagamento/folha-main.js`
- `node --check folha_pagamento/folha-filtros.js`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `git diff --check -- folha_pagamento/folha.html folha_pagamento/folha.css folha_pagamento/folha-utils.js folha_pagamento/folha-lancamentos.js folha_pagamento/folha-relatorios.js folha_pagamento/folha-main.js folha_pagamento/folha-filtros.js`
- `firebase deploy --only hosting --project sisweb-7ce82`

## Notas de seguranca
- Nao foi criada migracao em dados reais.
- Nao foi criado novo caminho no Firebase.
- O teste online nao clicou em salvar e nao gravou lancamento de teste.
