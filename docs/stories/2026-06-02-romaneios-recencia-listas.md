# Story: Romaneios recentes primeiro em listas e seletores

Data: 2026-06-02

## Objetivo

Padronizar os campos e modais que carregam romaneios ou pre-romaneios para sempre exibirem os registros mais recentes no topo, sem alterar caminhos Firebase, regras multi-tenant ou payloads gravados.

## Escopo

- Estoque, Entrada de Toras e romaneios relacionados da Saida.
- Compras e Compras legado.
- Vendas.
- Pre-romaneios usados por TL, PCT, PES e Tora.
- Modais/listas de romaneios TL, PCT, PES e Tora.

## Decisoes

- A ordenacao deve priorizar metadados de atualizacao quando existirem e depois datas de emissao/criacao.
- A ordenacao deve aceitar `dataEmissao`, `data`, `dataHora`, `updatedAt`, `updated`, `lastModified`, `dataCriacao`, `createdAt`, `created`, `timestamp` e timestamp dentro do id.
- Nao criar novo caminho no Firebase e nao misturar dados entre empresas.

## Checklist

- [x] Mapear pontos que carregam romaneios em selects e modais.
- [x] Padronizar criterio de recencia em Estoque.
- [x] Padronizar criterio de recencia em Compras e Compras legado.
- [x] Padronizar criterio de recencia em Vendas.
- [x] Padronizar criterio de recencia nos seletores de Pre-Romaneio.
- [x] Padronizar criterio de recencia nas listas/modais TL, PCT, PES e Tora.
- [x] Validar sintaxe JS.
- [x] Rodar gates do projeto: lint, typecheck e test.

## Arquivos Alterados

- `estoque.js`
- `compras.js`
- `compras_legacy.js`
- `vendas.js`
- `pre-romaneio-selector.js`
- `preromaneio-modals.js`
- `romaneiopes.html`
- `romaneio-manager.js`
- `modules/modals/modal-lista-romaneios.js`
- `modules/romaneiopct/modal-lista-romaneios-pct.js`
- `modules/romaneiopct/carregar-romaneio-pct.js`
- `correcao-lista-romaneios.js`
- `romaneiotora_modais.js`
- `corrigir_vendas_romaneios.js`
