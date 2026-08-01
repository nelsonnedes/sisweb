# Smoke de producao no tenant de testes

> **Data:** 22/07/2026  
> **Escopo:** navegacao, leitura, cadastros, Financeiro, Vendas, Compras, Empresa, Folha, Estoque, Fiscal e Romaneios.  
> **Seguranca:** nenhum documento fiscal foi emitido e nenhuma integracao externa foi acionada.

## Contexto validado

- O login concluiu com tenant operacional `1774030248295` e assinatura `trial_active`.
- O usuario administrativo esta registrado em `/roles/{uid}` como `admin`.
- O membro existe em `/companies/1774030248295/users/{uid}`, mas sem `role` ou permissao financeira.
- A empresa nao possui `ownerUid` no cadastro atual.
- Essa divergencia explica por que Functions autorizam mutacoes e as Rules negam leituras financeiras no navegador.

## Matriz de resultados

| Modulo/fluxo | Resultado | Evidencia principal | Prioridade |
| --- | --- | --- | --- |
| Login e Dashboard | Parcial | Login funciona; Dashboard zera contas financeiras existentes. | P0 |
| Clientes | Parcial | Criar e editar funcionam, mas a tabela so atualiza apos recarregar. | P1 |
| Fornecedores | Falhou em integridade | Novo registro foi gravado em `fornecedores/undefined`, sem ID utilizavel. | P0 |
| Financeiro - leitura | Falhou | Tela entra em `Modo Offline` e mostra zero contas apesar dos registros existentes. | P0 |
| Financeiro - conta a receber manual | Falhou | `financeNextSequence` retorna `Sequencia financeira sem confirmacao autoritativa`. | P0 |
| Financeiro - conta a pagar manual | Parcial | Conta e gravada pelo backend, mas a tela permanece vazia por falta de leitura. | P0 |
| Financeiro - baixa | Bloqueado | A conta existente nao chega a tabela; a baixa nao pode ser iniciada pela UI. | P0 |
| Venda pendente | OK com ressalva | Pedido gravado sem financeiro, como previsto para status pendente. | P1 |
| Venda aprovada | OK com defeito de dados | Conta a receber criada; segundo salvamento manteve uma unica conta. | P0 |
| Compra pendente | OK com ressalva | Pedido gravado sem financeiro, como previsto para status pendente. | P1 |
| Compra aprovada | Falhou com rollback | UI informou falha financeira e o pedido permaneceu pendente, sem conta parcial. | P0 |
| Empresa | Falhou | Pagina mostra empresa/tenant nao identificados e campos vazios. | P0 |
| Folha | Falhou | Interface mostra `Online`, mas leituras retornam vazio/permissao negada. | P0 |
| Estoque | Parcial | Fornecedores e romaneios carregam apos espera; houve aviso de caminhos sem dados. | P1 |
| NF-e e MDF-e | Smoke de abertura OK | NF-e abriu em homologacao e MDF-e sem erro imediato; nenhuma emissao executada. | P2 |
| Especies | Falhou | Abrir `species.html` redireciona para login e perde contexto de tenant. | P0 |
| Romaneio TL/Tora/Pre-romaneio | Falhou | Fallback tenta `signInAnonymously`; TL ainda depende do global `firebase`. | P0 |
| Romaneio PCT | Smoke de abertura OK | Sem erro imediato no primeiro carregamento. | P1 |
| Romaneio Pes | Parcial | Pagina recebe aviso de listener PCT, indicando contaminacao entre modulos. | P1 |

## Evidencias tecnicas confirmadas

### Autorizacao financeira divergente

- `database.rules.json` exige papel/permissao em `companies/{companyId}/users/{uid}` para ler `financas`.
- `assertFinanceAccess` nas Functions tambem reconhece o papel global em `/roles/{uid}`.
- O tenant de teste tem papel global administrativo, mas nao tem papel financeiro no membro da empresa.
- Resultado: o servidor grava; o navegador nao le. O sistema exibe estado vazio como se nao houvesse dados.

Nao corrigir relaxando a escrita financeira. A correcao deve definir uma fonte canonica de RBAC, migrar os membros e manter Functions e Rules semanticamente equivalentes.

### Sequencia financeira

Em `functions/finance-functions.js`, `financeNextSequence` retorna o valor atual quando a transacao recebe `null`:

```js
if (current === null) return current;
```

Com isso, `decision` nao e construida e a verificacao da operacao autoritativa falha. O caso foi reproduzido ao criar conta a receber manual.

### Vendas

- Aprovacao do pedido `PED17847619623518387` criou `CR_PED17847619623518387_001`.
- Repetir o salvamento preservou exatamente uma conta, validando idempotencia deste caso.
- O pedido salvo contem `dataEmissao` serializada a partir de um elemento DOM, nao da string ISO.
- Para tipo `receber`, a data de vencimento informada foi substituida pela data do pedido.

### Compras

- Aprovacao de `PC-1784762054229` falhou ao combinar pedido e `financas/pagar` em `updatePaths`.
- O pedido permaneceu `pendente` e nenhuma conta vinculada foi criada: nao houve persistencia parcial.
- O frontend ainda tenta escrever Financeiro diretamente; deve usar a mesma fronteira servidor-side adotada pelas operacoes financeiras.

### Empresa

O script da pagina acessa `window.firebaseService.authService` antes da inicializacao compartilhada. O erro interrompe a identificacao do tenant e impede carregar perfil, logo e PIX.

### Fornecedores

- O cadastro de teste foi gravado literalmente em `companies/1774030248295/fornecedores/undefined`.
- O objeto persistido nao possui `id`, por isso aparece com valor vazio nos selects.
- Um novo fornecedor que repita o fluxo pode sobrescrever o registro anterior em vez de criar outro.
- A correcao deve gerar a chave antes de persistir, salvar a mesma chave no campo `id` e rejeitar `undefined`, `null` ou string vazia na camada de servico.

### Folha e telas legadas

- `folha-main.js` escuta `resolvePath('folhas')`, enquanto o modelo/Rules usam `companies/{tenant}/folha`.
- A Folha tem varios resolvedores de caminho concorrentes e apresenta `Online` mesmo sem leitura autorizada.
- `firebaseService.unified.js`, TL e Tora tentam login anonimo quando nao encontram usuario.
- Em aplicacao autenticada e multi-tenant, esse fallback nao deve substituir a sessao real.

## Registros descartaveis criados

Manter ate a correcao para repeticao dos testes; depois limpar com verificacao de vinculos:

- Cliente: `1784761472923_4oehp5`.
- Fornecedor: chave literal `undefined`, nome prefixado `CODEX-QA Fornecedor 20260722-2005`.
- Conta a pagar manual: `CP17847618053113493`.
- Pedido de venda: `PED17847619623518387`.
- Conta a receber da venda: `CR_PED17847619623518387_001`.
- Pedido de compra: `PC-1784762054229`.
- Nao houve conta a receber manual nem conta a pagar vinculada ao pedido de compra.

## Ordem de correcao derivada do smoke

1. Preservar o codigo publicado em branch de recuperacao e criar testes para estes casos.
2. Canonizar RBAC de membro/empresa e alinhar Rules com Functions sem ampliar privilegios.
3. Corrigir `financeNextSequence` e restaurar os testes de transacao.
4. Migrar Compras para orquestracao servidor-side, preservando o rollback atual.
5. Corrigir bootstrap da Empresa e restaurar perfil/logo/PIX.
6. Remover fallback anonimo e corrigir caminhos de Folha/Especies/Romaneios.
7. Corrigir imediatamente a chave `undefined` de Fornecedores e depois o refresh de Fornecedores/Clientes.
8. Corrigir `dataEmissao`/vencimento em Vendas e adicionar teste de contrato.
9. Repetir smoke com tenant ativo e tenant expirado em leitura antes do deploy geral.

## Gate para iniciar implementacao

- Criar ou atualizar story com criterios de aceitacao por dominio.
- Preservar a fonte publicada sem copiar metadados do Freebuff.
- Testes devem falhar antes da correcao e passar depois.
- Deploy deve ser seletivo: Functions, depois Rules quando necessario, por ultimo Hosting.
- Nenhuma tela pode transformar `permission_denied` em lista vazia ou indicador `Online`.
