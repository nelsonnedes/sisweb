# Story: Exclusao permanente de toras selecionadas

**Status:** implementado, validado local/online e publicado no Hosting em 02/08/2026.

## Contexto

A Baixa Individual e o modal `Selecionar Toras para Baixa` permitiam selecionar registros, mas nao ofereciam a exclusao permanente em lote aprovada pelo usuario. A exclusao individual existente tambem removia a tora do estado local antes de confirmar a persistencia remota.

## Regra aplicada

- excluir somente toras persistidas no estoque do tenant ativo;
- nunca tratar item manual de baixa como registro persistido;
- exigir uma confirmacao explicita antes da exclusao permanente;
- remover as toras e registrar uma movimentacao de auditoria na mesma atualizacao multipath;
- alterar os arrays locais somente depois do sucesso da persistencia;
- no modal, excluir apenas a selecao nova, sem incluir toras ja carregadas na baixa;
- reutilizar o mesmo fluxo transacional na exclusao individual.

## Validacao

- [x] `node --check estoque.js`
- [x] testes focados de busca, exclusao, Estoque, Romaneio e clonagem
- [x] contrato de atualizacao multipath e auditoria automatizado
- [x] `npm test`: 349 aprovados e 1 skip esperado do Emulator
- [x] `npm run lint`, `npm run typecheck` e `git diff --check`
- [x] `npm run build:hosting`: 450 arquivos e 19.620.066 bytes
- [x] smoke local: exclusao selecionada na Baixa Individual
- [x] smoke local: exclusao selecionada no modal de Baixa por Lote
- [x] smoke local: recusa no dialogo nao altera dados
- [x] item manual permanece fora da selecao persistida por contrato automatizado
- [x] auditoria remota confirmou `baixa_individual` e `modal_baixa_lote`
- [x] Hosting publicado e smoke online concluido

## Busca de toras e Romaneio Vinculado

- [x] Consulta, Baixa Individual e Baixa por Lote pesquisam Plaqueta, Descricao/Especie e Custodia.
- [x] Movimentacoes e Rastreabilidade usam o mesmo contrato de busca.
- [x] `Romaneio Vinculado` exibe numero, cliente/fornecedor e volume quando o vinculo e estruturado.
- [x] observacoes legadas continuam visiveis quando o vinculo estruturado nao existe.
- [x] busca sem acento validada localmente e no Hosting.

## Arquivos

- `estoque.html`
- `estoque.js`
- `tests/estoque-exclusao-selecionados.test.mjs`
- `tests/estoque-busca-romaneio-vinculado.test.mjs`
