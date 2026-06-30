# Story - Toras: Custodia e Volume Geometrico

Data: 2026-05-28

## Objetivo

Padronizar os dados complementares de toras em `preromaneio.html` e `romaneiotora.html`, incluindo `Custodia`, `Comp. Geo.`, `X1`, `X2`, `X3`, `X4` e `V. Geo.` sem substituir os campos comerciais ja usados em estoque e compras.

## Padrao Definido

- Campos canonicos por item: `custodia`, `compGeo`, `x1`, `x2`, `x3`, `x4`, `volumeGeo`.
- `volumeGeo` e calculado pelo metodo de Smalian: media das areas da base e topo multiplicada pelo comprimento geometrico.
- Base usa a media de `X1` e `X2`; topo usa a media de `X3` e `X4`.
- `volumeLiquido`, `volumeSerraria`, `volume` e `quantidade` continuam sendo os campos comerciais usados por compras.

## Checklist

- [x] Criar utilitario compartilhado para calculo e normalizacao dos campos geometricos de tora.
- [x] Incluir campos no formulario e tabela de toras do pre-romaneio.
- [x] Salvar, editar, limpar e recarregar os novos campos em pre-romaneio TORA.
- [x] Incluir campos no formulario e tabela de `romaneiotora.html`.
- [x] Compatibilizar o fluxo Carregar Itens do pre-romaneio para romaneio de tora.
- [x] Compatibilizar importacao Excel ativa `romaneiotora-import-v4.js`.
- [x] Preservar campos novos no payload salvo de `romaneiosTora`.
- [x] Manter `compras.js` consumindo apenas os campos comerciais existentes.
- [x] Validar sintaxe dos arquivos alterados.

## File List

- `tora-geometry-utils.js`
- `preromaneio.html`
- `preromaneio.js`
- `romaneiotora.html`
- `romaneiotora.js`
- `romaneiotora_tabela.js`
- `romaneiotora-import-v4.js`
- `compras.js`
