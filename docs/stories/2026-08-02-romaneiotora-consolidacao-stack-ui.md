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

## Validacao

- [x] `node --check romaneiotora.js`
- [x] `node --check romaneiotora_tabela.js`
- [x] `node --check romaneio-manager.js`
- [x] testes focados de romaneio, fornecedor, especies e relatorios: 34/34
- [x] `npm test`: 343 aprovados e 1 skip esperado do Emulator
- [x] `npm run lint` e `npm run typecheck`
- [x] `npm run build:hosting`: 450 arquivos e 19.615.794 bytes, sem publicacao
- [x] `git diff --check`
- [x] smoke local desktop: incluir, editar e remover uma tora
- [ ] smoke local desktop: listar, editar, excluir e imprimir romaneio
- [ ] smoke local: listar/cadastrar/editar fornecedor e especie
- [ ] smoke mobile: modal, tabela, paginacao e menus de impressao
- [x] lista de clientes PES e Pre-romaneio seguindo o contrato PCT: seis colunas, `textContent`, fallback `Não informado` e tres acoes
- [x] `editPreRomaneioClient` e `deletePreRomaneioClient` implementados no Pre-romaneio (antes apenas referenciados pelos botoes)
- [x] `node --test tests/romaneios-client-list-standard.test.mjs tests/romaneiotora-active-stack.test.mjs`: 14/14
- [x] `node --check preromaneio-modals.js` e blocos inline de `preromaneio.html`/`romaneiopes.html`
- [x] `npm test` (11/08/2026): 390 aprovados e 1 skip esperado do Emulator
- [x] `npm run lint` e `npm run typecheck` (11/08/2026)
- [x] smoke autenticado desktop/mobile da Lista de Clientes em PCT, PES e Pre-romaneio
- [x] Hosting publicado em 02/08/2026 depois dos gates completos
- [x] resize de colunas com persistencia (spec 2026-08-11): modulo client-list-columns nas 5 paginas, testes 9/9
- [x] romaneiopes sem largura fixa de 40px na coluna Acoes (contrato PCT 120px)
- [x] smoke autenticado desktop/mobile: arrastar colunas, recarregar pagina e conferir persistencia (local + Firebase) — 11/08/2026: PCT desktop (Nome 210px) e mobile 390px (Nome 200px), PES Acoes 120px, fornecedores tora (Nome 229px); persistencia confirmada em localStorage e Firebase (`users/{uid}/preferences/clientListColumns/{tenant}/{page}` e `fornecedorListColumns/{tenant}`); smoke encontrou e corrigiu 2 bugs: (1) `var` compartilhado no loop de attachResize fazia qualquer arraste redimensionar Acoes, (2) assinatura errada de saveToFirebase impedia a gravacao remota — commits 592d135 e 679987c

## Divida controlada

`romaneiotora.html` e `romaneio-comum.css` ainda possuem varios overrides historicos. A proxima limpeza deve ser visual e incremental, removendo um grupo de seletores por vez com comparacao desktop/mobile. Este lote nao remove regras em massa.

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
