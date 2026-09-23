# Story: Upload da logo — dual compat/modular no serviço legado

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commits `2121b8f` (fix) + `4b2a808` (memo) + `5561a52` (cachebusters) → push `origin/main` ✓
  - `inject-cachebusters`: bump `src/services/firebaseService.js` + `commerce-pdf-share.js` em 10 HTMLs ✓
  - Build `hosting-dist` (478 arquivos) com código novo confirmado no artefato ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `src/services/firebaseService.js` (`uploadFile`), `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Sintoma (produção):** `snapshot.ref.getDownloadURL is not a function` ao enviar PNG na tela de Empresa.

## Causa raiz

`company.html` usa o serviço legado `src/services/...`, cujo `firebase` global vem do `firebase-compat-bridge.js`. O `put()` do bridge resolve `{ ref: <modular>, snapshot }` — `ref` modular puro, sem `.getDownloadURL()`. O código chamava o método estilo compat e quebrava sempre (qualquer formato).

## Correção (dual-world, sem mudar comportamento compat)

Tenta `snapshot.ref.getDownloadURL()` se existir (compat real); senão usa `ref.getDownloadURL()` do wrapper (bridge/modular). Demais chamadas do arquivo (`child().getDownloadURL()`, `.delete()`) já passam pelo wrapper — verificadas, sem alteração.

## Acceptance Criteria

- [x] Upload PNG conclui e retorna `downloadURL` nos dois mundos.
- [x] Erro restante (se houver) passa a ser do upload real, não do método.
- [x] Gates verdes (622 pass, 0 fail, 1 skip emulator).

## File List

- `src/services/firebaseService.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
