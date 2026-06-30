# Story: Centralizar acoes da lista de pedidos

## Contexto

No modal `Lista de Pedidos` de `vendas.html`, a coluna `Acoes` fica ao lado da coluna `Atualizado`.

## Problema

Os icones da coluna `Acoes` podem sobrepor ou invadir visualmente a data da coluna `Atualizado`, especialmente quando a tabela fica apertada.

## Objetivo

Centralizar os icones dentro da propria coluna `Acoes`, mantendo largura suficiente e evitando interferencia na coluna `Atualizado`.

## Acceptance Criteria

- [x] Coluna `Acoes` do modal `Lista de Pedidos` tem largura/min-width propria.
- [x] Botoes ficam centralizados dentro da coluna `Acoes`.
- [x] Celula `Acoes` nao usa `display:flex` diretamente no `td`, preservando layout de tabela.
- [x] Coluna `Atualizado` permanece separada e sem sobreposicao.
- [x] Testes de regressao cobrem HTML/CSS/renderizacao.
- [x] Quality gates executados.

## Tasks

- [x] Revisar CSS e HTML gerado do modal.
- [x] Ajustar CSS da coluna `Acoes`.
- [x] Ajustar renderizacao da linha para wrapper interno.
- [x] Adicionar teste de regressao.
- [x] Rodar quality gates.

## File List

- `docs/stories/2026-06-06-vendas-lista-pedidos-acoes-centralizadas.md`
- `vendas.html`
- `vendas.js`
- `tests/vendas-lista-pedidos-acoes.test.mjs`

## QA Notes

- `node --check vendas.js`
- `node --test tests/vendas-lista-pedidos-acoes.test.mjs`
- QA via Playwright em 1280px e 760px: `acoes-cell` computado como `table-cell`, `.acoes-buttons` como `flex` centralizado, todos os botoes dentro da celula `Acoes`, e separacao positiva de 2px da coluna `Atualizado`.
- `npm run lint`
- `npm run typecheck`
- `npm test` (54 testes)
- `git diff --check` nos arquivos da story passou; apenas avisos de CRLF do Windows.
