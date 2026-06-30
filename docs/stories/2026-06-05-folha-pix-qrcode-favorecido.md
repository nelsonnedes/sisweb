# Story: Separar favorecido PIX e exibir QR Code na folha

## Status
Ready for Review

## Contexto
O módulo `folha_pagamento/folha.html` é usado para cadastro de funcionários e lançamentos da folha. O cadastro atual guarda a chave PIX no campo `pix`, enquanto a tabela de lançamentos mostra a forma de pagamento junto com a chave PIX.

## Problema
Quando a forma de pagamento é PIX, o campo PIX acaba misturando identificação do favorecido com os dados da chave. Em Folha Lançamentos, a chave PIX fica exposta na tabela, quando o usuário deseja apenas uma ação para abrir o QR Code.

## Objetivo
Separar o nome do favorecido da chave PIX no cadastro de funcionário e alterar a tabela de lançamentos para exibir somente a ação `Ver Qrcode` quando o pagamento for PIX. Ao clicar, deve abrir um modal com o QR Code do PIX, o nome do favorecido abaixo do QR Code, o banco e o valor líquido do lançamento.

## Acceptance Criteria
- [x] Em `Editar Funcionário`, quando a forma de pagamento for `PIX`, existe um campo `Nome` para informar o favorecido.
- [x] O campo `Chave PIX` guarda apenas os dados da chave PIX.
- [x] Em Folha Lançamentos, registros com forma de pagamento `PIX` não exibem a chave PIX diretamente na tabela.
- [x] Em Folha Lançamentos, registros com forma de pagamento `PIX` exibem a ação `Ver Qrcode`.
- [x] Ao clicar em `Ver Qrcode`, um modal mostra o QR Code da chave PIX, o nome do favorecido abaixo do QR Code, o banco e o valor líquido.
- [x] Registros antigos sem nome de favorecido PIX usam fallback seguro para beneficiário ou nome do funcionário.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` passa.

## Tarefas
- [x] Criar story para rastrear a implementação.
- [x] Mapear fluxo atual de funcionário, PIX e lançamentos.
- [x] Acionar especialistas para análise de arquitetura e qualidade.
- [x] Implementar campo favorecido PIX no modal de funcionário.
- [x] Persistir e recarregar favorecido PIX no cadastro.
- [x] Alterar renderização da forma de pagamento PIX para `Ver Qrcode`.
- [x] Implementar modal de QR Code com favorecido, banco e valor líquido.
- [x] Rodar gates e atualizar File List.

## File List
- `docs/stories/2026-06-05-folha-pix-qrcode-favorecido.md`
- `folha_pagamento/folha.html`
- `folha_pagamento/folha.css`
- `folha_pagamento/folha-funcionarios.js`
- `folha_pagamento/folha-lancamentos.js`
- `folha_pagamento/folha-main.js`
- `folha_pagamento/folha-utils.js`
- `tests/folha-pix-qrcode.test.mjs`

## Análise técnica
- `folha_pagamento/folha.html` contém o modal de funcionário e a tabela de lançamentos.
- `folha_pagamento/folha-funcionarios.js` controla visibilidade, preenchimento, validação e persistência dos campos de funcionário.
- `folha_pagamento/folha-utils.js` centraliza a renderização da linha de lançamento e o formato detalhado da forma de pagamento.
- `folha_pagamento/folha-main.js` possui renderização alternativa/fallback da tabela e também deve usar o mesmo helper para manter comportamento consistente.
- O novo campo persistido é `favorecidoPix`; `beneficiario` fica preservado para Conta Bancária e é usado apenas como fallback legado.
- `banco` continua sendo o campo existente do funcionário, agora mantido disponível também quando a forma é `PIX`.
- A implementação não altera paths Firebase nem regras de tenant; permanece nos fluxos multi-tenant já resolvidos pelos managers existentes.

## Validações
- `node --check folha_pagamento/folha-funcionarios.js`
- `node --check folha_pagamento/folha-utils.js`
- `node --check folha_pagamento/folha-main.js`
- `node --check folha_pagamento/folha-lancamentos.js`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Browser local: helper real `FolhaUtils.formatarFormaPagamentoLancamento` renderizou `Ver Qrcode`; modal abriu com QR, favorecido, banco e valor líquido; chave PIX não apareceu no HTML visível da célula.
