# Story: Correção de desaparecimento de lançamento ao editar funcionário na folha

## Status
Done

## Contexto
O módulo `folha_pagamento/folha.html` opera em produção com dados reais no Firebase. Em Folhas de Pagamento > Lançamentos, o usuário pode editar uma folha/lançamento e também alterar dados do funcionário vinculado. Ao atualizar o lançamento, o registro deve permanecer visível e íntegro na lista.

## Problema
Ao editar um lançamento, alterar/carregar dados do funcionário em `Editar Folha de Pagamento` e clicar em `Atualizar`, o lançamento desaparece ao voltar para a lista de Folhas de Pagamento > Lançamentos.

## Objetivo
Encontrar a causa do desaparecimento e corrigir de forma conservadora, preservando o identificador do lançamento, o vínculo com o funcionário e os filtros/listagens existentes.

## Acceptance Criteria
- [x] Edição de lançamento preserva a chave/id original do lançamento.
- [x] Alterar/carregar funcionário durante a edição não faz o lançamento desaparecer da lista.
- [x] Campos do funcionário atualizados no lançamento não substituem metadados críticos do lançamento.
- [x] Correção respeita caminhos multi-tenant no Firebase.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` passa.

## Tarefas
- [x] Criar story para rastrear a correção.
- [x] Mapear fluxo de edição de lançamento e de seleção/edição de funcionário.
- [x] Identificar ponto exato em que o lançamento perde chave, funcionário ou filtro de visibilidade.
- [x] Aplicar correção de baixo risco.
- [x] Adicionar teste de regressão quando aplicável.
- [x] Rodar gates e atualizar File List.

## File List
- `docs/stories/2026-05-28-folha-edicao-lancamento-funcionario.md`
- `folha_pagamento/folha-lancamentos.js`
- `folha_pagamento/folha-funcionarios.js`
- `folha_pagamento/folha.html`
- `tests/company-logo-storage-policy.test.mjs`

## Análise técnica
- A lista de funcionários podia escolher o campo alvo por `lastFocused`. Como o filtro principal `funcionarioFiltro` e o campo do modal `folhaFuncionario` podiam ficar marcados ao mesmo tempo, uma seleção feita dentro de `Editar Folha de Pagamento` podia cair no filtro da listagem e aplicar um filtro invisível para o usuário.
- A edição agora prioriza explicitamente `folhaFuncionario` quando o modal de folha está aberto, e os ícones de lista informam o `targetField` correto.
- O update da folha agora preserva o ID original do lançamento em modo edição, evitando que dados do funcionário selecionado sejam confundidos com a chave da folha.
- O snapshot de `funcionario.ativo` no lançamento é sincronizado com o cadastro atual, removendo `ativo:false` obsoleto quando o funcionário está ativo no cadastro.

## Validações
- `node --check folha_pagamento/folha-lancamentos.js`
- `node --check folha_pagamento/folha-funcionarios.js`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `git diff --check -- folha_pagamento/folha-lancamentos.js folha_pagamento/folha-funcionarios.js folha_pagamento/folha.html tests/company-logo-storage-policy.test.mjs docs/stories/2026-05-28-folha-edicao-lancamento-funcionario.md`

## Notas de segurança
- Não executar migrações em dados reais.
- Não alterar regras Firebase nesta story.
- Não limpar, renomear ou mover dados existentes.
