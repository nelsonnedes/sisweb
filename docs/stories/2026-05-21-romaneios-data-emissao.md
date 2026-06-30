# Story: Data de emissao nos romaneios TL, PCT e PES

## Objetivo

Adicionar o campo Data de Emissao antes do campo Cliente nos formularios de romaneio TL, PCT e PES, garantindo que o valor seja gravado no registro do romaneio e reaproveitado em edicoes, listas, impressoes e lancamentos financeiros relacionados.

## Checklist

- [x] Campo `romaneioData` incluido antes de `clienteInput` em TL, PCT e PES.
- [x] Campo Data alinhado na mesma linha antes de Cliente, com largura fixa compacta.
- [x] Campo Cliente expandido para ocupar todo o espaco restante da linha no desktop, mantendo quebra responsiva no mobile.
- [x] Valor padrao definido com a data local atual, sem depender de UTC.
- [x] Salvamento grava `data` e `dataEmissao`.
- [x] Edicao recarrega a data do romaneio existente.
- [x] Limpeza de formulario restaura a data atual.
- [x] Listas, impressoes e lancamentos financeiros priorizam `dataEmissao`/`data` antes de `timestamp`.
- [x] Formatacao evita deslocamento de um dia em strings `YYYY-MM-DD`.
- [x] Validacoes executadas.

## Arquivos alterados

- `romaneiotl.html`
- `romaneiopct.html`
- `romaneiopes.html`
- `modules/romaneio/salvar-romaneio.js`
- `romaneiopct-tabela.js`
- `modules/romaneiopct/carregar-romaneio-pct.js`
- `modules/romaneiopct/modal-lista-romaneios-pct.js`
- `modules/romaneiopct/imprimir-romaneio-pct.js`
- `modules/modals/modal-lista-romaneios.js`
- `modules/reports/imprimir-romaneio.js`

## Validacao

- `node --check` nos JavaScripts alterados.
- Checagem sintatica dos scripts inline de `romaneiotl.html`, `romaneiopct.html` e `romaneiopes.html`.
- `git diff --check`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Verificacao local no navegador em `http://127.0.0.1:5501/` confirmou o campo antes de Cliente e preenchido com `2026-05-21` em TL, PCT e PES.
- Verificacao local confirmou Data antes de Cliente, ambos na mesma linha, Cliente ocupando o restante do formulario e `rightGap` igual a `0` nos tres HTMLs.
