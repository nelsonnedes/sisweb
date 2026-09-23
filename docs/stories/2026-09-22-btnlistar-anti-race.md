# Story: btnListar anti-race (PCT/TL/Tora)

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commit `b70bf5d` → push `origin/main` ✓
  - Sem bump de `?v=` (só HTML, servido no-cache) ✓
  - Build `hosting-dist` (478 arquivos) com botão defensivo confirmado no artefato ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `romaneiopct.html`, `romaneiotl.html`, `romaneiotora.html`, `tests/romaneios-edit-save-flow.test.mjs` (atualizado), `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Sintoma (produção):** `Uncaught ReferenceError: abrirListaRomaneios is not defined` ao clicar Listar no PCT.

## Causa raiz

Botão renderizado na linha ~2210, scripts que definem a função só executam bem depois (CDN + ~10 scripts + 57KB inline). Clique na janela = ReferenceError. Blocos íntegros (validados por parse), sem sobrescrita externa (manager nem carrega na página).

## Correção (padrão da casa, igual ao Salvar)

`onclick` defensivo nos 3 botões: tenta `window.*`, depois local, senão alerta "Lista ainda carregando". Comportamento carregado idêntico; PES usa outro padrão (intocado).

## Acceptance Criteria

- [x] Clique precoce não quebra (alerta orienta retry).
- [x] Carregado: abre o modal correto de cada tipo.
- [x] Teste legado atualizado sem afrouxar intenção + novo contrato.
- [x] Gates verdes (631 pass, 0 fail, 1 skip emulator).

## File List

- `romaneiopct.html`, `romaneiotl.html`, `romaneiotora.html`, `tests/romaneios-edit-save-flow.test.mjs`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] lint, typecheck, suite cheia (só HTML alterado na feature)
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
