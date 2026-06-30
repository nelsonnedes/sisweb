# Story: Admin - Console Chrome e publicacao dos scripts do SuperAdmin

Data: 2026-06-09

## Contexto

Ao testar `admin.html` em Chrome fresco, o login SuperAdmin informado retornou credencial invalida e a pagina Admin apresentou erros de carregamento:

- `scripts/admin/admin-ui.js` retornando 404.
- `scripts/admin/admin-main.js` retornando 404.
- Chrome recusando executar os scripts por MIME `text/html`.

A causa era o bloqueio generico `scripts/**` no `firebase.json`, que protegia scripts internos mas tambem impedia a publicacao dos dois assets necessarios ao Admin.

## Implementado

- [x] Removido o bloqueio generico `scripts/**` do Hosting.
- [x] Adicionados bloqueios explicitos para os scripts internos em `scripts/`.
- [x] Mantida publicacao apenas de `scripts/admin/admin-main.js` e `scripts/admin/admin-ui.js`.
- [x] Teste de regressao garante que novos arquivos em `scripts/` fiquem bloqueados, exceto a allowlist publica do Admin.
- [x] Warning transitorio de `auth.js` durante carregamento do `firebaseService` rebaixado para `console.debug` na janela normal de inicializacao.
- [x] Hosting publicado em producao.

## Evidencia

- Chrome pre-correcao: 404/MIME nos scripts do Admin.
- Simulacao local do Firebase Hosting: apenas os dois scripts de `scripts/admin/` entram no pacote publico.
- Producao pos-deploy:
  - `https://sisweb-7ce82.web.app/scripts/admin/admin-ui.js` retorna 200 `text/javascript`.
  - `https://sisweb-7ce82.web.app/scripts/admin/admin-main.js` retorna 200 `text/javascript`.
- Chrome pos-deploy: sem 404/MIME dos scripts do Admin.
- Login empresa `jnmadeirasm...`: `index.html`, `estoque.html`, `vendas.html` e `compras.html` carregaram sem erros/warnings relevantes de console.
- Login SuperAdmin corrigido em 2026-06-09: Admin carregou com `Admin Unificado`, guard oculto, perfil Super Admin e painel de Billing com status normal.

## Validacoes

- `node --check auth.js`
- `node --test tests/global-first-wave.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/company-logo-storage-policy.test.mjs`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `firebase deploy --only hosting --project sisweb-7ce82`

## Arquivos

- `firebase.json`
- `auth.js`
- `tests/global-first-wave.test.mjs`
- `docs/stories/2026-06-09-admin-chrome-console-hosting-scripts.md`
