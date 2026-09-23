# Story: Impressão PCT — nitidez padrão TL nos resumos (só fontes)

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commits `10a1e26` + `ca64b6b` (bump) → push `origin/main` ✓
  - `inject-cachebusters`: bump `imprimir-romaneio-pct.js?v=f79d10646412` ✓
  - Build `hosting-dist` (478 arquivos) ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `modules/romaneiopct/imprimir-romaneio-pct.js` (3 regras de cor), `tests/romaneio-preview-uso-trava.test.mjs` (+ asserts)
- **Evidência (anexo):** resumo-dims e CONAMA com texto lavado vs TL nítido. Organização e dados intocados.

## Correção (só cor, zero reflow)

- `.resumo-dimensoes-table th` += `print-color-adjust: exact` (igual tabela principal e CONAMA: fundo marinho imprime em qualquer configuração).
- `.resumo-dimensoes-table td` → `color: #000` explícito.
- `.resumo-conama th/td` → `color: #000` explícito (header mantém branco via regra posterior).
- Tamanhos, pesos, famílias, layout, colunas e dados 100% intactos.

## Acceptance Criteria

- [x] Textos dos resumos em preto sólido como o TL.
- [x] Headers escuros com `exact` nos 3 blocos.
- [x] Gates verdes (634 pass, 0 fail, 1 skip emulator).

## File List

- `modules/romaneiopct/imprimir-romaneio-pct.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
