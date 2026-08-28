# MDF-e: Consolidacao e Cards Mobile

## Objetivo

Consolidar o comportamento do MDF-e em `mdf-e.js` e adaptar as areas operacionais para telas pequenas, preservando o layout tabular no desktop e as capacidades atuais do formulario.

## Decisao arquitetural

- `mdf-e.html` permanece responsavel por markup, labels e estilos.
- `mdf-e.js` passa a ser a unica fonte de comportamento.
- O bloco inline legado de `mdf-e.html` fica desativado como referencia de migracao; a inicializacao de estados, cidades e CEP sera mantida no JS ativo.
- A persistencia atual e mantida sem ampliar o escopo para integracao fiscal real.

## Interface responsiva

- Consulta: cada linha da tabela vira um card com `data-label`, status visivel e grupo de acoes.
- Documentos fiscais: cabecalho permanece no desktop; no mobile, cada documento vira card rotulado.
- Tabela de NF-e adicionada dinamicamente segue o mesmo padrao.
- Formularios continuam em uma coluna no mobile; botoes preservam area minima de toque.
- Encerramento e dashboard mantem o comportamento atual, recebendo apenas ajustes de largura quando necessario.

## Fluxo de dados

1. O carregamento inicial configura data/hora, dados locais, selects e dashboard.
2. Consulta, encerramento, edicao e dashboard usam o mesmo estado `mdfes`.
3. Acoes de aba recebem o elemento acionado explicitamente, sem depender de `window.event`.
4. Renderizadores aplicam escape de texto e `data-label` nas celulas geradas.

## Validacao

- Teste estatico para garantir fonte unica, seletores responsivos e labels dos rows.
- Smoke autenticado em `320x640`, `390x844` e `1280x800`.
- Validar as quatro abas, filtro de consulta, adicao/remocao de documento e navegacao programatica.
- Rodar `npm run lint`, `npm run typecheck` e `npm test` conforme os gates do projeto.
