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
- [x] smoke de especie em producao (12/08/2026): listagem apos fix, cadastro com push-key e busca; smoke de fornecedor previamente validado (cadastro/edicao). Smoke local pendente apenas por bloqueio de auth do localhost
- [ ] smoke mobile: modal, tabela, paginacao e menus de impressao
- [x] lista de clientes PES e Pre-romaneio seguindo o contrato PCT: seis colunas, `textContent`, fallback `Não informado` e tres acoes
- [x] `editPreRomaneioClient` e `deletePreRomaneioClient` implementados no Pre-romaneio (antes apenas referenciados pelos botoes)
- [x] `node --test tests/romaneios-client-list-standard.test.mjs tests/romaneiotora-active-stack.test.mjs`: 14/14
- [x] `node --check preromaneio-modals.js` e blocos inline de `preromaneio.html`/`romaneiopes.html`
- [x] `npm test` (11/08/2026): 390 aprovados e 1 skip esperado do Emulator
- [x] `npm run lint` e `npm run typecheck` (11/08/2026)
- [x] smoke autenticado desktop/mobile da Lista de Clientes em PCT, PES e Pre-romaneio
- [x] Hosting publicado em 02/08/2026 depois dos gates completos
- [x] resize de colunas com persistencia (spec 2026-08-11): modulo client-list-columns nas 5 paginas, testes 10/10
- [x] romaneiopes sem largura fixa de 40px na coluna Acoes (contrato PCT 120px)
- [x] smoke autenticado desktop/mobile: arrastar colunas, recarregar pagina e conferir persistencia (local + Firebase) — 11/08/2026: PCT desktop (Nome 210px) e mobile 390px (Nome 200px), PES Acoes 120px, fornecedores tora (Nome 229px); persistencia confirmada em localStorage e Firebase (`users/{uid}/preferences/clientListColumns/{tenant}/{page}` e `fornecedorListColumns/{tenant}`); smoke encontrou e corrigiu 2 bugs: (1) `var` compartilhado no loop de attachResize fazia qualquer arraste redimensionar Acoes, (2) assinatura errada de saveToFirebase impedia a gravacao remota — commits 592d135 e 679987c
- [x] review da persistencia remota encontrou residual no TL (adapter monkey-patch `romaneios-client-save-fix.js` criava child push-key com id null): corrigido em 92164e3 (id null delega `saveData(base, data)` flat, convencao nativa; `'auto'` mantem push-key) + cache-bust v2 do modulo nas 5 paginas (8824c81); verificado em producao 11/08/2026: TL drag Nome 142px -> RTDB bruto flat `{Nome:142}` sem child; regressao PCT `{Acoes:120, Nome:203}` flat; testes 10/10 + regressao 24/24, lint 0
- [x] smoke autenticado (12/08/2026) encontrou bug P0 de producao: cadastro de especie gravava em `especies/undefined.id` — `push().key` indefinido. Causa raiz: `firebase-compat-bridge.js` retornava `Promise.resolve(newRef)` em `push()`, perdendo o `.key` sincrono do SDK modular (contrato ThenableReference). Corrigido no bridge (push() expoe `.key` sincronamente + delega `.then/.catch/.finally` sem loop de assimilacao) e coberto por teste `tests/firebase-init.test.mjs`; verificado em producao 12/08/2026: cadastro de especie e cliente com push-key, sem child `undefined.id`
- [x] fix do push-key em producao (12/08/2026): deploy do bridge + cache-bust `?v=d6c28d76d1de` nas 9 paginas; validacao autenticada end-to-end em `species.html`: cadastro `ESP SMOKE PUSHFIX FIM 0812` gravado em `companies/1774030248295/especies/-Ozv3eCvAUWBWnY4GL5Q` com `firebaseKey == storedId` (push-key), 101 keys no namespace, sem child `undefined`; registro de teste removido em seguida; logout da sessao ao final
- [x] modal de especie aberto centralizado (13/08/2026): `romaneiopct.html` passou a usar `SiswebSpeciesModal.showModal` (display:flex + `.is-open`) com helper `showSpeciesModalCentered` (reanexa ao `<body>` para escapar de pais ocultos e tem fallback para `forceShowOverlayModal`); `romaneiopes.html` teve o form reposicionado em `.modal-body` com botao submit fora do form via `form="speciesForm"` (contrato do modal padrao); `species-modal-standard.js`/`species-utils.js` preservam `originalId` ao re-normalizar listas ja normalizadas — edicao que altera apenas o nome cientifico nao e mais bloqueada como duplicata; coberto por `tests/species-edit-duplicate.test.mjs` (3 testes); `npm test`: 404 aprovados, lint 0, typecheck 0
- [x] limpeza incremental de overrides em `romaneio-comum.css` (13/08/2026): removido bloco morto `.btn-editar`/`.btn-excluir`/hovers (linhas 62-93, 100% sombreado pelo bloco posterior com `border-radius: 4px` + `vertical-align: middle`; especificidade identica, ultimo vence); deduplicados `#speciesModal .back-button.close-modal-btn` e `#speciesModal .back-button` (corpos identicos) em um so seletor agrupado; consolidados `.imprimir-options.show`/`.dropdown-menu.show`/`.print-menu.show` (corpos identicos) em seletor agrupado — -57 linhas (+7). Verificacao visual por diff de computed styles via playwright (training mode local, sem auth) em romaneiotora/romaneiopes/romaneiopct desktop 1366x768 e mobile 390x844: snapshots 100% identicos antes e depois; `npm test`: 404 aprovados (+1 skip), lint 0, typecheck 0

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
