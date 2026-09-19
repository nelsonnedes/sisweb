# Padrão Mobile — Cards, Paginação e Ações (2026-09-19)

> Checklist vivo das melhorias aplicadas nos romaneios para replicar em todas
> as áreas com lista de cards no mobile (vendas, compras, estoque, finanças,
> folha, espécies, clientes, fornecedores). **Desktop nunca muda**: tudo aqui
> vive em `@media (max-width: 768px)` com seletores `html body #id`.

## 1. Cards horizontais 1 linha "LABEL valor"

- `td` vira `display:flex; flex-direction:row; align-items:baseline; justify-content:space-between; gap:8px; white-space:nowrap; overflow:hidden`.
- `::before` (label) vira item fixo: `flex:0 0 auto; max-width:45%; ellipsis; 11px uppercase cinza`.
- Valor (nó de texto anônimo) encosta à direita com ellipsis; `min-width:0` obrigatório.
- `td[colspan]` (empty-states) fica FORA do flex (mantém wrap centralizado).
- `tr` do card recebe `overflow:hidden; max-width:100%` (o clip vive no card, nunca no wrapper de rolagem).
- Tiers: ≤360px (gap 6, label 10.5px/40%), ≤320px (label 38%).
- Aplicado em: `#romaneioTable` (PCT/TL/PES/Tora), `#tabela-serrados`, `#tabela-toras` (pré), `#listaModal`, `#romaneioListModal`.
- Exceção TORA: colunas Geo ocultas reafirmadas com `tr:has(> td:nth-child(19))` (o id `#romaneioTable` é compartilhado com PCT/TL/PES — `nth-child` puro esconderia colunas legítimas).

## 2. Linha AÇÕES padronizada (padrão Folha)

- Referência: `folha_pagamento/folha.css` (`td.actions-cell` fileira + `.action-button` 30px desktop / 36px mobile).
- `td[data-label="Ações"]`: `flex; align-items:center; justify-content:flex-start; gap:6px; overflow:visible; min-height:48px; border-top separador`.
- Botões: `36×36` mobile (`flex:0 0 auto; padding:0; margin:0; inline-flex centralizado)`.
- `overflow:visible` aqui é seguro (largura fixa conhecida, sem texto longo).
- Nunca `space-between` com 2 botões (espalha pelas bordas).

## 3. Paginação da Lista de Romaneios (modal)

- `modal-content`: `height:auto; max-height:100dvh-20px` (fallback `100vh`) — modal EXPANDE.
- Único scroller: `modal-body` (`overflow-y:auto`). `table-container` fica `overflow:visible` (sem sub-scroll).
- Barra `.rlc-pagination-bar` + `[id$="Pagination"]`: `position:static` NO FLUXO após a lista (nada sticky/fixed).
- `Exibir:` + `Densidade:` lado a lado: `flex row nowrap; label flex:1 1 0 min-width:0`; tiers de `max-width` (132/124 → 118/108 → 102/96px) e `font-size` (12.5 → 12 → 11.5px).
- Exceção ao anti-zoom iOS (16px) SÓ nesses 2 selects; inputs de texto mantêm 16px.
- Botões de página: linha própria, `nowrap` + `scroll-x` invisível.
- Escopo: `#listaModal` + `#romaneioListModal` (clientes/fornecedores/espécies mantêm modelo fixo).

## 4. Paginação da tabela de ITENS

- Barra 3 colunas inline (`flex:1 1 320px`) empilha em coluna no mobile; filhos `width:100%; min-width:0`; `[style*="nowrap"]` neutralizado.
- `td` com reset de wrap ( conflita com item 1 — item 1 vence por especificidade/ordem onde ambos se aplicam).
- `.totais-container` com `clear + margin-top` (sem sobreposição).

## 4b. Wrapper dos itens SEM teto de altura (lição 2026-09-19)

- Causa medida no navegador: `.table-responsive` travado em `max-height:min(55vh,420px)` COM `overflow:visible` (regra do gesto) = linhas transbordando SOBRE paginação+totais.
- Regra: no mobile, wrappers de itens têm `max-height:none; height:auto; min-height:0` (o conteúdo flui, a página rola).
- Seletores: `#romaneio-items-section .table-responsive/.table-container`, `.itens-container > ...`, `.table-responsive:has(> #tabela)` (ancora no id da tabela, sem tocar HTML).
- Nunca combine teto de altura com `overflow:visible` no mesmo bloco.

## 5. Regras de ouro (anti-regressão)

1. `!important` em tudo (codebase usa `!important` ubíquo + estilos inline via JS).
2. Seletores `html body #id` (1,1,2) + append no FIM de `romaneio-comum.css` (vence por ordem em empate).
3. CSS `?v=` é MANUAL (`inject-cachebusters` só cobre `<script>`): recalcular sha256-12 e trocar nas páginas.
4. Nunca `Set-Content` do PowerShell nos HTMLs (mojibake) — reescrever via Node (`writeFileSync utf8`).
5. `node --check` nos JS + `npm run lint` + `npm run typecheck` + `npm test` antes de publicar.
6. Console: prefs de UI vazias (`*/preferences/*`) e coleções opcionais NÃO geram warn (só debug throttled); `toSnake` nunca se aplica a paths `users/*` (UID case-sensitive).

## 6. Onde falta aplicar (mobile)

- [ ] Vendas/compras (lista de pedidos + cards)
- [ ] Estoque (tabelas → cards)
- [ ] Finanças (lançamentos)
- [ ] Espécies/clientes/fornecedores (modais de lista — ainda no modelo fixo)
- [ ] Folha (cards já horizontais nativos; validar Ações 36px)
