# Story: Pré-romaneio TL — campos nas posições do Romaneio TL

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commits `2a616c1` + `00ba9c2` (bumps) → push `origin/main` ✓
  - `inject-cachebusters`: bump `preromaneio.js` + catch-up dos prints ✓
  - Build `hosting-dist` (478 arquivos) ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `preromaneio.html` (ordem dos blocos), `preromaneio.js` (ordem do Enter), `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **De:** Espécie | Espessura | Largura / Preço (sozinho) / Comprimento | Quantidade.
- **Para (espelho TL):** Espécie | Espessura | Preço / Comprimento | Largura | Quantidade (+ Peças/Pacote condicional por último, como antes).

## Cuidados

- Blocos movidos inteiros (ids, labels, handlers, placeholders intactos).
- Save/edição/limpeza leem por ID — mapeamento inalterado.
- Enter segue a ordem visual nova (`tlOrder` e `serradosOrder`); listeners presos aos elementos (não à posição); caso especial PCT de Peças/Pacote preservado.
- Sem acesso posicional aos campos no JS (só paginação de tabelas).
- Grid fluido + mobile 1fr: mesma auto-organização de antes.

## Acceptance Criteria

- [x] Ordem visual = TL de referência nas 3 abas serradas.
- [x] Enter percorre na ordem visual e adiciona no fim.
- [x] Gates verdes (634 pass, 0 fail, 1 skip emulator).

## File List

- `preromaneio.html`, `preromaneio.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] lint, typecheck, suite cheia (JS: 2 linhas de ordem)
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
