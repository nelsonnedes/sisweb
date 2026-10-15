# Story 2026-10-15 — NF-e: Produto Cadastrado (NF-e) + Produto Romaneio (CONAMA)

## 1. Objetivo
1. Renomear "📦 Produto Cadastrado (Estoque)" → "📦 Produto Cadastrado (NF-e)" na aba Itens.
2. Todo item de NF-e **autorizada** emitido no modo Manual (e Romaneio — decisão D2) é gravado em nó fiscal próprio, sem duplicação; **só** esse nó popula o dropdown "Produto Cadastrado (NF-e)".
3. Novo modo "🌲 Produto Romaneio (CONAMA)": 2 selects lado a lado ("Tipo de Romaneio:", "Romaneio:", iguais aos de vendas) → resumo CONAMA → Descrição + Volume m³; se o item já existir no catálogo NF-e, captura NCM + Preço Unitário.

## 2. Fora de escopo (NÃO mexer)
- Fluxo "🗂️ Produto Cadastrado (Fiscais)" → `estoqueProdutos` (checkbox, `registrarProdutosDaNota`): intocado.
- `vendas.js` / `vendas.html` / `compras.*`: intocados (lógica de romaneio copiada, não movida).
- NCM/CFOP inventados: proibido (Auditor.md). NCM vazio/inválido bloqueia no validador existente (fail-closed já vigente).
- `fiscal/produtos-fiscais` (Fase B): intocado.

## 3. Arquitetura e contratos (fonte única — todos os especialistas seguem isto)

### 3.1 Nó novo (multi-tenant, sem estoque)
- Path: `companies/{tenant}/fiscal/produtos-nfe` (espelha padrão `fiscal/produtos-fiscais`).
- Entrada: `{ id, nome, ncm, precoVenda, unidade (a do item emitido, default 'M³'), cfopPadrao, origemCadastro:'nfe-manual'|'nfe-romaneio', fiscal:{...}, ultimaNota:{numero,serie,chave,dataEmissao,tpNF}, criadoEm, ultimaAtualizacao }`.
- Dedupe: `normalizarNomeProduto()` (a mesma de `nf-produtos-nf.js` — reutilizar, não duplicar). Merge atualiza fiscal/ncm/precoVenda(>0)/ultimaNota; nunca cria duplicata de nome normalizado igual.
- Escrita: pós-autorização, fire-and-forget com try/catch (mesmo padrão do hook existente, `confirmarEmissao` ~L4718), nunca bloqueia emissão.

### 3.2 Módulo `nf-produtos-nf.js` (estender, não reescrever)
- `NODE_PRODUTOS_NFE = 'fiscal/produtos-nfe'`; cache `_produtosNFe`.
- `carregarProdutosNFe(tenantId)` → carrega o nó; `popularSelectCadastrados()` passa a ler `_produtosNFe` (swap de fonte; manter assinatura).
- `registrarProdutosNFeDaNota(nfeData, tenantId)` → itens com `cProd` prefixo `MANUAL_` ou `ROMANEIO_` (D2: ambos; D1 define).
- `carregarRomaneiosPorTipoNF(tipo)` → mesmos paths `romaneios/tora|pct|tl|pes` + `RomaneioDataUtils.normalizeRomaneioCollection` quando existir + mesmo fallback de filtro (espelhar `getRomaneiosMerged`, sem importar vendas.js).
- `resumoConamaNFe(romaneio)` → `{especie: {categoriaBase: {volume, valorTotal, precoUnitario}}}` (simplificado; thresholds idênticos a `classificarProdutoConama` — copiar função pura + teste ouro comparando).
- `descricaoConamaNFe(especie, categoriaBase)` → `${especie} Madeira em ${categoriaBase}` (tora: categoriaBase `'Tora'`).
- `buscarNoCatalogoNFe(descricao)` → match por nome normalizado → `{ncm, precoVenda}` ou null.
- `autoPreencherRomaneio(...)` → preenche NCM + preço; CFOP só se campo vazio/padrão e sem natureza (precedência existente: natureza > produto).

### 3.3 IDs novos em `notas-fiscais.html` (prefixo `nf`, sem colidir)
- Radio `value="romaneio"` label "🌲 Produto Romaneio (CONAMA)" + `nfSecaoProdutoRomaneio` (hidden default).
- `nfTipoRomaneio` (options `romaneiosTL/Pct/Pes/Tora`, mesmos values de vendas), `nfRomaneioSelect`, lado a lado.
- Preview `nfPreviewRomaneioNFe` + lista `nfListaConamaNFe`.
- Campos: `itemDescricaoRom` (readonly), `itemQuantidadeRom` (volume m³, editável), `itemValorUnitarioRom`, `itemNCMRom`, `itemCFOPRom`, unidade fixa `M³`.
- Botão → `adicionarItemNFRomaneio()` (espelha `adicionarItemNFManual`, `cProd: 'ROMANEIO_'+...`, `uCom:'M³'`, validação `NFItens.validarEntradaItem` — fail-closed).
- `alterarTipoProduto('romaneio')` mostra/esconde as 3 seções; `_limparCamposItem()` estendido aos novos IDs.

## 4. Mapa de regressão (deve continuar verde)
- `tests/nf-produtos-fiscais.test.mjs` (checkbox Fiscais, estoqueProdutos, Vl.Unit. pauta).
- `tests/produto-romaneio.test.mjs` (radios vendas, `value="manuel"`).
- `tests/qa-visual-pwa-routes.test.mjs` (substrings "Produto Manual"/"Produto Cadastrado" — rename preserva substring).
- Fluxo `estoqueProdutos` inalterado; `vendas.js`/`compras.js` intocados.
- Novos testes em `tests/nf-produtos-nfe-romaneio.test.mjs` (padrão node:test + regex/vm do repo).

## 5. Checklist por especialista
- [ ] FE-NFE (frontend NF-e): radio, seção, selects, preview, botões, `alterarTipoProduto`, limpar campos.
- [ ] DATA (módulo+storage): nó, carregar/swap, registrar+dedupe, hook pós-autorização, loader romaneios, resumo, busca, autofill.
- [ ] FISCAL: precedência natureza>produto, NCM/preço capturados sem inventar, validador fail-closed, CFOP default.
- [ ] QA: novo teste + suite verde + checklist/file list.

## 6. Gates
- `npm run lint`, `npm run typecheck`, `npm test` (skips preexistentes ok).
- Sem commit/push/deploy sem ordem expressa.

## 7. Decisões (confirmadas pelo usuário)
- D1: dropdown lê SÓ o nó novo.
- D2: registrar itens Manual + Romaneio.
