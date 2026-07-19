# Design: logo canonica por tenant em relatorios e impressoes

## Contexto

O upload atual ja grava em
`companies/{companyId}/profile/logo/current`, mas a limpeza depende apenas da
referencia anterior conhecida pelo navegador. Perfis sem referencia ou com URL
legada podem deixar objetos repetidos no prefixo do tenant. No tenant operacional
foram encontrados dois objetos legados identicos e validos, enquanto o perfil
canonico estava sem `logoStoragePath` e `logoUrl`.

## Decisao

O perfil `companies/{companyId}/profile` e a unica fonte da identidade usada em
relatorios. A logo atual sera o objeto canonico
`companies/{companyId}/profile/logo/current`. Depois da persistencia confirmada
do perfil, o backend lista somente `companies/{companyId}/profile/logo/` e remove
todos os objetos diferentes da referencia mantida. A limpeza nunca ocorre antes
do perfil ser salvo e nunca atravessa o prefixo do tenant.

O navegador continua responsavel pelo upload, mas deixa de enumerar ou excluir
objetos antigos. `updateMyCompanyProfile` e `upsertCompanyProfile` executam a
reconciliacao autoritativa e retornam um resumo sem nomes sensiveis. Falha de
limpeza nao desfaz um perfil ja persistido; ela retorna aviso observavel e pode
ser repetida de forma idempotente.

Relatorios e impressoes carregam o perfil pelo contrato
`getCompanyProfileForReport`. Saidas HTML e PDF convertem a logo para DataURL
quando necessario. O Financeiro usa A4 paisagem com largura real de paisagem e
permite quebra de tabelas longas entre paginas.

## Superficies

- `functions/index.js`: validacao tenant-scoped e reconciliacao pos-save.
- `firebaseService.js` e `src/services/firebaseService.js`: upload canonico e
  consumo do retorno autoritativo.
- `company.html` e `scripts/admin/admin-main.js`: salvamento sem limpeza duplicada
  no cliente.
- `commerce-pdf-share.js`: cabecalho e resolucao DataURL compartilhados.
- `financas.js`: layout paisagem e selecao impressa.
- Modulos auditados: Vendas, Compras, Estoque, Financeiro, Folha, MDF-e e
  Romaneios.

## Recuperacao controlada

1. Exportar o perfil operacional para backup temporario.
2. Copiar uma das imagens legadas identicas para `profile/logo/current`.
3. Persistir `logoStoragePath`, `logoPath` e metadados no perfil.
4. Validar a callable de DataURL e uma impressao financeira.
5. Excluir os objetos legados somente depois do smoke positivo.

O bucket possui soft delete de sete dias; objetos removidos deixam de aparecer
no prefixo ativo, mas podem permanecer faturaveis durante essa janela de
recuperacao do Google Cloud.

## Criterios de aceite

- Cada tenant possui no maximo um objeto ativo no prefixo de logo depois de
  salvar/atualizar o perfil.
- Um novo upload sobrescreve `profile/logo/current` e torna essa referencia a
  fonte de todos os cabecalhos.
- Falha no salvamento do perfil nunca remove a logo ainda referenciada.
- A limpeza valida prefixo e nao remove objetos de outro tenant.
- Financeiro imprime apenas os itens selecionados, sem compressao de retrato ou
  tabela cortada.
- Vendas, Compras, Estoque, Financeiro, Folha, MDF-e e Romaneios continuam
  resolvendo identidade pelo perfil canonico.
- Functions e Hosting sao publicados e verificados antes do teste do usuario.

