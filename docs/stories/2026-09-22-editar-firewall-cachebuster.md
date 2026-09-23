# Story: Editar blindado + cachebusters (fim do JS velho em produção)

- **Data:** 2026-09-22
- **Status:** Done (publicado)
- **Deploy:**
  - Commit `198a74b` → push `origin/main` ✓
  - Build `hosting-dist` (478 arquivos); artefato com `vendas.js?v=91632ff65bfe` + firewall ✓
  - `firebase deploy --only hosting --project sisweb-7ce82` — release complete em `https://sisweb-7ce82.web.app` ✓
- **Escopo:** `vendas.js` (`editarItem` firewall), `vendas.html`, `compras.html`, `romaneiotora.html` (só `?v=`), `tests/romaneio-preview-uso-trava.test.mjs` (+ asserts)
- **Sintoma (produção, via logs.md):** editar item E×L×C não abria o formulário; log mostrava `alterarTipoProduto('romaneio_dimensoes')` repetido sem o `manual` seguinte.

## Causa raiz (dupla)

1. **JS velho no cliente:** `?v=` estático nunca teve bump nos nossos deploys (`inject-cachebusters` é manual e foi pulado). Com SWR do PWA, o browser executava `vendas.js` de antes do `case 'romaneio_dimensoes'` — por isso o log não mostra o `manual` seguinte. Prova: `vendas.html` referenciava `v=225dec2c604b`, idêntico ao dos logs.
2. **Classe do bug:** tipo desconhecido em `editarItem` caía no default com seções ocultas (form em branco). Blindado com firewall `tipoSeguro` (desconhecido → manual).

## Correção

- `editarItem`: `tiposConhecidos` + `tipoSeguro` (qualquer tipo futuro abre o manual em vez de branco).
- `node tools/inject-cachebusters.mjs`: bump real em `vendas.js`, `compras.js` e `romaneio-manager.js` (este último mudou no fail-closed e também estava sem bump). Só esses 3 HTMLs alterados.

## Acceptance Criteria

- [x] Qualquer tipo de item abre formulário preenchido ao editar.
- [x] Hashes `?v=` refletem o conteúdo atual (clientes recebem o JS novo).
- [x] Gates verdes (618 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.js`, `vendas.html`, `compras.html`, `romaneiotora.html`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
