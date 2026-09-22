# Story: Romaneio — Botão Limpar + Peças Compras + Preview ao vivo + Rename

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commit feature `619e16f` → push `origin/main` ✓
  - Build `hosting-dist` (478 arquivos) com código novo confirmado no artefato ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `vendas.html`, `vendas.js`, `compras.html`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs` (+3 testes, 1 atualizado)
- **Fora de escopo:** CSS global, financeiro, rules.

## Objetivo

1. Botão **Limpar** ao lado de **Carregar Itens** limpando o Carrinho (vendas + compras).
2. Compras PCT/TL/PES com sufixo ` - N Peças` igual Vendas.
3. Checkboxes atualizam o Preview em tempo real; rename `Agrupar por Espécie e Espessura` → `Espécie Espessura x Largura`.

## Acceptance Criteria

- [x] Botão `Limpar` (`btn-danger romaneio-clear-btn`) ao lado do Carregar nas duas telas; `limparCarrinhoItens()` com confirm, toast, reset de edição e re-render; vazio = toast info.
- [x] Compras serrados: `infoPecasItemCompra`/`quantidadePecasItemCompra` no padrão Vendas; sufixo no item-a-item (`PINUS - 10 Peças`), nos grupos (`... - 25 Peças`), nos originais e no preview (`• 10 Peças`); TORA inalterado.
- [x] Vendas preview ao vivo: banner do modo (N grupos), cabeçalhos por espessura no modo Espécie, badges `→ k grupos E×L×C` no modo Dimensões; toggle de modo re-renderiza.
- [x] Compras preview ao vivo: banner do modo + seções por grupo (totais live dos incluídos) nos modos dims/espécie; exclusão por item intacta.
- [x] Rename display-only nos 2 HTMLs (chave de merge `espécie+espessura` inalterada — sem risco de duplicação no carrinho).
- [x] `npm run lint`, `typecheck`, `npm test` verdes (600 pass, 0 fail, 1 skip emulator).

## Limitações honestas

- No modo Dimensões (vendas), excluir categoria exclui todos os comprimentos dela (exclusão grossa → carga fina), agora visível nos badges.
- Preço médio ponderado em grupos heterogêneos (igual ao modo espécie atual).

## File List

- `vendas.html`, `vendas.js`, `compras.html`, `compras.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [x] Publicar (commit + push + deploy) — aguardando confirmação
