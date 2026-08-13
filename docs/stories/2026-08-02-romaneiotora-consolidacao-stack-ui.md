# Story: Consolidacao segura do stack de Romaneio de Tora

**Status:** stack consolidado e publicado; smokes avancados de lista/cadastros/mobile ainda pendentes.

## Contexto

`romaneiotora.html` carregava simultaneamente um monolito legado e modulos mais novos para fornecedores, especies, lista de romaneios e impressao. A ordem dos scripts redefinia funcoes globais e deixava o comportamento dependente do ultimo arquivo carregado.

## Escopo deste lote

- retirar somente o carregamento ativo de `romaneiotora_modais.js`;
- preservar o arquivo legado no repositorio para rollback;
- manter os provedores canonicos de fornecedor, especies, lista e impressao;
- definir `romaneiotora_tabela.js` como proprietario das acoes de item;
- preservar fallbacks do arquivo principal sem sobrescrever o proprietario canonico;
- corrigir reposicao e aliases do item durante edicao;
- garantir cursor explicito nos controles do modal de lista;
- escapar dados operacionais antes de renderizar HTML e argumentos de acao.

## Evidencias

- o monolito legado tinha cerca de 232 KB e repetia quatro dominios ja modularizados;
- `adicionarItem`, `removerItem` e `limparCamposItem` possuiam duas declaracoes globais ativas;
- a rotina de tabela carregada por ultimo nao limpava `itemEditandoIndex`;
- itens criados pela rotina ativa nao preservavam todos os aliases de volume, preco e valor;
- o modal usava IDs e textos do banco diretamente em `innerHTML` e handlers inline.
- smoke autenticado desktop/mobile (14/08/2026): login `madeportes27@gmail.com` em producao, dashboard com dados reais; smoke desktop: menu Romaneios → submenus Tora (romaneiotora.html), PC (romaneiopct.html), PES (romaneiopes.html) carregam sem erro; smoke mobile: hambúrguer "Abrir menu" exibe dropdowns, navegação entre submenus funciona; edição de espécies em `species.html`: alteração de nome científico para `Pouteria oppositifolia (Ducke) Baehni - SMOKE TESTE` sem bloqueio de duplicata (getExactDuplicate → null); revertido após confirmação de gravação; name "Abiu-branco" voltou ao original sem sufixo
- limpeza incremental de overrides em `romaneio-comum.css` (13/08/2026): removido bloco morto `.btn-editar`/`.btn-excluir`/hovers (linhas 62-93, 100% sombreado pelo bloco posterior com `border-radius: 4px` + `vertical-align: middle`; especificidade identica, ultimo vence); deduplicados `#speciesModal .back-button.close-modal-btn` e `#speciesModal .back-button` (corpos identicos) em um so seletor agrupado; consolidados `.imprimir-options.show`/`.dropdown-menu.show`/`.print-menu.show` (corpos identicos) em seletor agrupado — -57 linhas (+7). Verificacao visual por diff de computed styles via playwright (training mode local, sem auth) em romaneiotora/romaneiopes/romaneiopct desktop 1366x768 e mobile 390x844: snapshots 100% idênticos antes e depois; `npm test`: 404 aprovados (+1 skip), lint 0, typecheck 0

## Divida controlada

`romaneiotora.html` e `romaneio-comum.css` ainda possuem overrides historicos. Proxima rodada incremental: grupos de seletores de modais ainda sobrepostos (multiplas definicoes de `.modal-content`/`.modal-footer` com larguras divergentes) e regras de impressao antigas, sempre validados por diff de computed styles desktop/mobile.

## Arquivos

- `romaneiotora.html`
- `romaneiotora.js`
- `romaneiotora_tabela.js`
- `romaneio-manager.js`
- `tests/romaneiotora-active-stack.test.mjs`
- `romaneiopes.html`
- `preromaneio.html`
- `preromaneio-modals.js`
- `tests/romaneios-client-list-standard.test.mjs`
- `modules/core/client-list-columns.js`
- `tests/client-list-columns-resize.test.mjs`
- `species-modal-standard.js`
- `species-utils.js`
- `tests/species-edit-duplicate.test.mjs`