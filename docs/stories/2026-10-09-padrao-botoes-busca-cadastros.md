# Padronização de campos Cliente/Fornecedor/Espécie + Buscar (09/10/2026)

## Pedido
1. Botões Lista/Novo de Espécie fora do campo e coloridos (padrão `estoque.html`
   "Entrada de Toras") em todas as páginas com Cliente/Fornecedor/Espécie
   (romaneios + cadastros).
2. Campo "Buscar Cliente/Fornecedor" nos selects (padrão `notas-fiscais.html`
   "Dados do Destinatário"), mesma linha sem desordenar o formulário.
3. Padrão Voltar/Imprimir memorizado: Voltar à esquerda, Imprimir à direita
   (nunca lado a lado) — ver Cérebro seção 18.

## Inventário (vasculhado)
- Romaneios PCT/TL/PES/Tora/Pré: 12 blocos com ícones sobrepostos
  (`autocomplete-icons-container` absoluto, sem cor): PCT cliente+espécie,
  TL cliente+espécie, PES cliente+espécie, Tora fornecedor+espécie,
  Pré cliente+espécie+fornecedor+espécieTora.
- Cadastros (client/fornecedor/species.html): sem campo entidade com ícones —
  já têm botões Novo coloridos; nada a mudar.
- Modais (clientes/fornecedores/espécies): sem selects de entidade (só
  fiscais/UF/cidade internos); nada a mudar.
- Selects com Buscar OK: vendas `clienteSelect`, compras `fornecedorSelect`,
  NF `nfCliente`. Gap: estoque `fornecedorSelect` (sem busca).
- Finanças (`receberCliente`, `pagarFornecedor` + filtros): padrão próprio
  `field-with-action` + Novo; Buscar não aplicado (fora do escopo pedido;
  follow-up se quiser).

## Implementado
- `romaneio-comum.css`: bloco `.species-combobox-inline` global (flex, botões
  36px, cores por tokens `--sw-text-3`/`--sw-success`, `prefers` mobile,
  padding de ícone neutralizado). Só `var(--sw-*)`, zero hardcode.
- 12 blocos convertidos span→`button.btn-secondary/btn-success` fora do campo;
  handlers (`onclick`) e delegação PES (`data-action` + a11y) preservados;
  `.autocomplete-container` mantido como âncora das sugestões; títulos
  adicionados onde faltavam (Pré).
- `estoque.html`: Buscar (flex:1) + select (flex:2) na mesma linha (padrão NF);
  `estoque.js`: `filtrarFornecedorSelectEstoque()` espelhando vendas.

## Checklist
- [x] CSS global tematizado (claro/escuro automático)
- [x] 12/12 blocos convertidos, zero `span.autocomplete-icon` restante
- [x] Handlers/delegação preservados (PES `data-action`, demais `onclick`)
- [x] Sugestões ancoradas (container mantido)
- [x] Buscar no estoque com filtro funcional
- [x] Trava `tests/padrao-campos-cadastros.test.mjs`
- [x] Gates: lint + typecheck + suite
- [x] `?v=` ressincronizado + SW bump + deploy + verificação prod
- [x] Smoke autenticado (5 romaneios + estoque)

## File list
- `romaneio-comum.css`, `romaneiopct.html`, `romaneiotl.html`, `romaneiopes.html`,
  `romaneiotora.html`, `preromaneio.html`, `estoque.html`, `estoque.js`
- `tests/padrao-campos-cadastros.test.mjs`, `docs/stories/2026-10-09-padrao-botoes-busca-cadastros.md`
