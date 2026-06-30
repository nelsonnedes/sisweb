# Story: Paginação, Scroll Horizontal e Ordenação nos Romaneios

Data: 2026-06-01

## Objetivo

Padronizar as tabelas de itens dos romaneios para permitir seleção de itens por página, rolagem horizontal quando as colunas excederem a área visível e ordenação pelo título das colunas, preservando o comportamento de gravação, edição, exclusão e cálculos existentes.

## Escopo

- Romaneio PCT (`romaneiopct.html` / `romaneiopct-tabela.js`)
- Romaneio TL (`romaneiotl.html` / `modules/items/renderizar-tabela.js`)
- Romaneio PES (`romaneiopes.html`)
- Romaneio de Toras (`romaneiotora.html` / `romaneiotora.js`)
- Pré-Romaneio (`preromaneio.html` / `preromaneio.js`), para manter compatibilidade com o fluxo de toras e serrados

## Decisões

- Criar um helper visual reutilizável (`romaneio-table-enhancements.js`) para evitar duplicar ordenação e CSS de scroll em cada módulo.
- Usar o mesmo padrão visual e de classes da Folha de Pagamento para ordenação por cabeçalho: `data-sort-key`, `sortable`, `sort-active`, `sort-asc`, `sort-desc` e ícones `⇅`, `▲`, `▼`.
- Ordenar o array de itens já usado pelo renderizador de cada tabela, sem alterar caminhos Firebase, tenant/companyId ou payloads gravados.
- Manter a coluna "Ações" fora da ordenação.
- Manter os seletores de itens por página já existentes em PCT, TL e PES, completando o padrão no Romaneio de Toras e Pré-Romaneio.
- Registrar este padrão para futura aplicação em `estoque.html`.

## Checklist

- [x] Mapear renderizadores e paginações dos romaneios.
- [x] Criar helper comum para scroll horizontal e ordenação por cabeçalho.
- [x] Alinhar ícones e classes de ordenação ao padrão da Folha de Pagamento.
- [x] Integrar helper no PCT, TL, PES, Toras e Pré-Romaneio.
- [x] Implementar "Itens por página" no Romaneio de Toras e Pré-Romaneio.
- [x] Preservar cálculos e índices de edição/exclusão após ordenação.
- [x] Ajustar camada do dropdown de impressão na Lista de Romaneios de Tora para abrir acima do modal.
- [x] Validar sintaxe JS e scripts inline.
- [x] Validar layout e interação no navegador local.
- [x] Rodar gates do projeto: lint, typecheck e test.

## Arquivos Alterados

- `romaneio-table-enhancements.js`
- `romaneiopct.html`
- `romaneiopct-tabela.js`
- `romaneiotl.html`
- `modules/items/renderizar-tabela.js`
- `romaneiopes.html`
- `romaneiotora.html`
- `romaneiotora.js`
- `romaneio-manager.js`
- `preromaneio.html`
- `preromaneio.js`
