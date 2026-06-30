# Story: Ações da folha recolhidas por padrão

## Status
Ready for Review

## Contexto
Na página filha de folha de pagamento, o bloco de botões acima de `Folhas de Pagamento` ocupa muito espaço no carregamento inicial, especialmente em telas menores. O usuário pediu que esse bloco venha recolhido e que a expansão seja uma decisão manual do usuário.

## Problema
O bloco `#acoes-principais` nasce expandido no HTML e mostra todas as ações antes da tabela de folhas, atrasando a leitura da área principal.

## Objetivo
Carregar o bloco de ações principais recolhido por padrão, com controle acessível para expandir/recolher sem persistência global e sem alterar dados multi-tenant.

## Acceptance Criteria
- [x] Ao carregar a página, `#acoes-principais` vem recolhido.
- [x] O usuário consegue expandir e recolher as ações por um botão acessível.
- [x] O estado inicial recolhido é definido no HTML para evitar flash visual.
- [x] O estado visual não é persistido em `localStorage`, Firebase ou chave global sem escopo de tenant.
- [x] A seção `Folhas de Pagamento` e os handlers existentes dos botões continuam preservados.
- [x] A recomendação para lançamentos `Mês Fechado Pago` fica documentada sem alterar regra de negócio nesta entrega.
- [x] Lançamentos mensais com status `mes_fechado` exibem as ações recolhidas por padrão na tabela de folhas.
- [x] O usuário consegue expandir e recolher as ações de cada lançamento pago sem afetar outras linhas.
- [x] Linhas `1° Quinzena`, `1° Quinzena Paga`, `2° Quinzena Paga` e meses em aberto preservam os botões atuais.
- [x] O recolhimento das ações pagas não persiste estado em `localStorage`, Firebase ou chave global sem escopo de tenant.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` passa.

## Tarefas
- [x] Analisar o bloco com agentes especialistas de UX e QA/técnico.
- [x] Implementar disclosure recolhido por padrão em `#acoes-principais`.
- [x] Adicionar helper JS acessível para alternar expandido/recolhido.
- [x] Adicionar cobertura de regressão para HTML, toggle e ausência de persistência.
- [x] Validar no navegador local.
- [x] Rodar gates finais e atualizar File List.
- [x] Implementar ações recolhidas por linha para `Mês Fechado Pago`.
- [x] Cobrir em teste o estado inicial recolhido e a preservação das demais linhas.
- [x] Rodar gates finais novamente e atualizar validações.

## File List
- `docs/stories/2026-06-05-folha-acoes-recolhidas-lancamentos-pagos.md`
- `folha_pagamento/folha.html`
- `folha_pagamento/folha.css`
- `folha_pagamento/folha-utils.js`
- `folha_pagamento/folha-main.js`
- `tests/folha-acoes-recolhidas.test.mjs`

## Análise técnica
- O recolhimento deve nascer no HTML com `hidden` e `aria-expanded="false"` para evitar o grid aberto antes do JS carregar.
- Não deve haver persistência por padrão, porque a preferência visual sem escopo pode vazar comportamento entre usuários/empresas.
- A implementação deve preservar os botões e seus handlers inline atuais.
- Para `Mês Fechado Pago`, o rótulo é derivado de `status === 'mes_fechado'`, não de um tipo bruto separado.
- O collapse das ações pagas é aplicado somente quando `tipoPagamento === 'mes'` e `status === 'mes_fechado'`; quinzenas pagas continuam com ações abertas.

## Sugestão para `Mês Fechado Pago`
Manter as linhas pagas visíveis para auditoria, mas recolher apenas a célula de ações/detalhes quando `tipoPagamento` for mensal e `status` estiver como `mes_fechado`. Um botão discreto `Ações do pagamento` pode abrir `Ver detalhes`, `Imprimir`, `Estornar fechamento` quando aplicável e `Excluir lançamento` separado como ação destrutiva. Isso reduz ruído sem esconder registros já pagos.

## Validações
- `node --check folha_pagamento/folha-utils.js`
- `node --check folha_pagamento/folha-main.js`
- `node --test tests/folha-acoes-recolhidas.test.mjs`
- `node --test tests/folha-pix-qrcode.test.mjs`
- Navegador local: confirmado estado inicial `hidden=true` e `aria-expanded="false"` em `http://127.0.0.1:8765/folha_pagamento/folha.html`
- Navegador local para ações pagas: acesso à folha foi redirecionado para `company.html` pela guarda de autenticação/empresa do browser; fluxo novo validado por testes automatizados.
- `npm run lint`
- `npm run typecheck`
- `npm test`
