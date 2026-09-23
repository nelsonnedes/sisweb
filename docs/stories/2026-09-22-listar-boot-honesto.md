# Story: Listar Pedidos — boot honesto (fim do falso "entre novamente")

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commits `8b381b3` (código) + `6b60beb` (cachebusters) + `8dd58bc` (company toast) → push `origin/main` ✓
  - `inject-cachebusters`: bump `vendas.js?v=162c17a5237f` + `compras.js?v=b66aa9e79e8a` ✓
  - Build `hosting-dist` (478 arquivos) ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `vendas.js`, `compras.js`, `vendas.html`, `compras.html`, `tests/operational-route-state.test.mjs` (atualizado), `tests/romaneio-preview-uso-trava.test.mjs` (+2 testes)
- **Fora de escopo:** paralelizar cadeia auth/tenant, cache-first no listar, `allowCached` morto (mapeados, não mexidos).

## Diagnóstico (equipe)

Guarda síncrono sobre boot assíncrono serial (até ~20s: service 8s → tenant 4.5s → checkAuth ~5s → retry 2.5s). Clique no Listar antes do pronto = toast falso de login + clique descartado (sem retry). Lentidão percebida = espera do boot, não do listar (pós-boot é fast-path em memória).

## Correção

- State machine `booting/ready/failed` + promise do boot (vendas+compras).
- `listarPedidos`: durante boot, fila one-shot pós-pronto + toast "Conectando..." (sem toast de login); após, fluxo idêntico.
- Botões Novo/Listar nascem `disabled` (com dataset-flag para o unlock existente); liberados no `clear`, travados no `render`.
- Proteção mantida: guarda intacto fora do boot; teste legado atualizado sem afrouxar intenção.

## Acceptance Criteria

- [x] Sem falso login em clique precoce; lista abre sozinha ao assentar.
- [x] Clique único enfileirado (sem rajada).
- [x] Falha real mantém painel de login + botões travados.
- [x] Gates verdes (625 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.js`, `compras.js`, `vendas.html`, `compras.html`, `tests/operational-route-state.test.mjs`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
