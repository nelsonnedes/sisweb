# Story: Coluna Acoes fixa na folha

## Status
Ready for Review

## Contexto
Nas tabelas de estoque, a coluna `Acoes` permanece visivel durante o scroll horizontal usando celulas sticky. O usuario pediu para analisar esse padrao e aplicar comportamento equivalente na tabela principal de folha de pagamento.

## Problema
A tabela `#folhasTable` pode ficar larga por causa das colunas financeiras e de pagamento. Quando o usuario rola horizontalmente, a coluna de acoes sai da area visivel, dificultando editar, imprimir, excluir ou abrir as acoes recolhidas de lancamentos pagos.

## Objetivo
Manter a coluna `Acoes` da tabela principal de folha sempre visivel a direita durante o scroll horizontal, seguindo o padrao visual do estoque e sem alterar dados, filtros, Firebase ou regras multitenant.

## Acceptance Criteria
- [x] A coluna `Acoes` de `#folhasTable` fica fixa a direita durante scroll horizontal.
- [x] O cabecalho `Acoes` acompanha o mesmo alinhamento da coluna fixa.
- [x] A celula fixa preserva largura, botoes atuais e o painel recolhido de `Mes Fechado Pago`.
- [x] Hover e linhas fechadas mantem fundo legivel, sem sobrepor texto das demais colunas.
- [x] Impressao nao fica presa ao posicionamento sticky.
- [x] A mudanca nao persiste estado em `localStorage`, Firebase ou qualquer chave sem escopo tenant.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` passa.

## Tarefas
- [x] Comparar o padrao sticky usado em estoque com a tabela de folha.
- [x] Acionar agentes especialistas para revisao de UX/frontend e QA.
- [x] Implementar CSS scoped em `#folhasTable`.
- [x] Corrigir fallback de filtros para preservar o contrato de 12 colunas.
- [x] Adicionar cobertura de regressao para o comportamento sticky.
- [x] Validar gates finais.
- [x] Atualizar File List e validacoes.

## File List
- `docs/stories/2026-06-05-folha-coluna-acoes-fixa.md`
- `folha_pagamento/folha.css`
- `folha_pagamento/folha-filtros.js`
- `tests/folha-acoes-recolhidas.test.mjs`

## Analise tecnica
- O estoque usa `position: sticky`, `right: 0`, `z-index`, fundo proprio e sombra lateral em `th/td` da coluna de acoes.
- A folha ja centraliza a coluna por `#folhasTable .actions-cell` e define largura de 176px; a mudanca deve reaproveitar essa estrutura.
- As acoes de `Mes Fechado Pago` ja ficam recolhidas dentro da mesma celula, entao o CSS sticky deve preservar `display: flex` e o alinhamento atual.
- A implementacao deve ser apenas visual. Nao ha necessidade de JS, migracao de dados, escrita em tenant ou persistencia.
- O `table { overflow: hidden; }` global impedia o sticky real no inicio do scroll; `#folhasTable` precisa sobrescrever para `overflow: visible`.
- O fallback antigo de filtros renderizava 11 celulas e pulava `Forma Pgto.`. Foi alinhado para manter 12 colunas e usar o mesmo helper de acoes quando disponivel.

## Validações
- `node --test tests/folha-acoes-recolhidas.test.mjs`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Navegador local com fixture temporario e CSS real: no inicio e no meio do scroll horizontal, `th[data-sort-key="acoes"]` e `td.actions-cell` mantiveram `right` igual ao contêiner, com `position: sticky`, `z-index` 16/12 e fundo legivel.
