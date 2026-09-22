# Story: Romaneio — Preview selecionável + trava de reuso (Vendas/Compras)

- **Data:** 2026-09-22
- **Status:** Done
- **Escopo:** `vendas.js`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs`
- **Fora de escopo (intencional):** schema de romaneios, rules Firebase, financeiro, `pre-romaneio-selector.js`, HTML/CSS.

## Objetivo

Ao carregar um romaneio em pedidos de Venda/Compra, ainda no "Preview - Resumo":
1. Permitir excluir itens (checkbox + botão Excluir/Reincluir por item);
2. "Carregar Itens" carrega apenas o que permanecer selecionado;
3. Travar reuso do mesmo romaneio em outro pedido com toast claro (nº do pedido + módulo);
4. Itens já usados aparecem desativados com o número do pedido.

## Acceptance Criteria

- [x] Preview Vendas (CONAMA agregado por espécie/categoria) tem checkbox + Excluir/Reincluir por categoria, contador "X de Y selecionados".
- [x] Preview Compras (itens brutos) tem checkbox + Excluir/Reincluir por item, contador equivalente (antes era só `console.log`).
- [x] `adicionarItensRomaneio()` (ambos) carrega apenas itens selecionados; tudo excluído => toast de aviso e nada é carregado.
- [x] Reuso detectado via scan de `vendas/pedidos` + `pedidosCompra` (item `origemId`/`romaneioId` + novo `romaneiosOrigem`), ignorando pedido em edição e status `cancelado`; fail-open em erro.
- [x] Toast claro: "Este romaneio (X) já foi utilizado no pedido de Venda/Compra Nº Y. Selecione outro romaneio...".
- [x] Preview em reuso: banner + itens desativados com badge "Usado no pedido Nº Y (Venda/Compra)" + botão Carregar desabilitado; bloqueio revalidado no clique.
- [x] Dropdown anota `• USADO Ped. Nº Y` (sem desabilitar options, best-effort, 1 scan).
- [x] Persistência aditiva: itens ganham `origemId`/`romaneioId`/`romaneioNumero`/`romaneioTipo`; pedido ganha `romaneiosOrigem[]`. Leitores antigos ignoram.
- [x] `npm run lint`, `npm run typecheck`, `npm test` verdes (591 pass, 1 skip emulator, 0 fail).

## Decisões cirúrgicas (anti-regressão)

- Zero mudança em HTML/CSS, romaneios, financeiro, rules.
- `origemId` legado de Compras preservado byte-a-byte; `romaneioId` é campo novo paralelo.
- Vendas passa a gravar `origemId` (antes ausente): único jeito de travar reuso futuro; pedidos antigos de venda seguem sem trava (limitação documentada).
- Compras mantém trava de sessão (`já foi adicionado ao carrinho`) + adiciona trava persistente.
- Preview Compras usa `#previewConama/#listaConama`; `#previewTora` segue oculto.
- Exclusões de Compras só aplicadas quando preview corresponde (mesmo id+tipo+tamanho); senão fail-safe carrega tudo.
- Agrupado multi-romaneio mantém limitação pré-existente de `origemId` único; novos campos são carregados do primeiro item (best-effort).
- Excluir pedido libera o romaneio automaticamente (lookup dinâmico, sem tombstone).
- Clone carrega vínculo junto (visível como reuso); sem strip intencional.

## File List

- `vendas.js` (helpers `obterIdEstavelRomaneioVendas`, `buscarUsoRomaneioVendas`, `construirMapaUsosRomaneioVendas`, preview selecionável, `adicionarItensRomaneio` async filtrado, `romaneiosOrigem` no save, resets em novo/editar)
- `compras.js` (espelho: helpers `...Compra`, `renderizarPreviewRomaneioCompra`, filtro, vínculo, resets)
- `tests/romaneio-preview-uso-trava.test.mjs` (10 asserts de contrato)

## Quality Gates

- [x] `node --check vendas.js && node --check compras.js`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` (suite cheia)
- [ ] Validação manual em browser (recomendado): Vendas TORA+PCT e Compras TORA, com 2 pedidos, exclusão parcial, reuso bloqueado, edição do próprio pedido liberada.
