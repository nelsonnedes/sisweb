# Story: Vendas/Compras - guarda de tenant autenticado antes das leituras

## Status

Ready for Review

## Contexto

No smoke de producao apos a correcao de estorno financeiro, `vendas.html` carregou a interface, mas o console registrou `Permission denied` em leituras de `companies/1749492103278/...`. A tela ainda possuia um preload no HTML que promovia `localStorage.company_info` para `window.appTenantId` antes da confirmacao do Firebase Auth, o que podia reativar uma empresa antiga em desktop/PWA.

Na mesma fila, `compras.html` recebeu o bootstrap novo de `firebaseService`; por isso `compras.js` tambem passou a aguardar tenant autenticado antes de carregar fornecedores e produtos.

## Objetivo

Impedir que Vendas e Compras carreguem dados operacionais usando `company_info` obsoleto antes de confirmar o usuario autenticado e o `companyId` real da sessao.

## Acceptance Criteria

- [x] `vendas.html` nao promove `company_info` para `window.appTenantId` antes do Auth.
- [x] `compras.html` nao promove `company_info` para `window.appTenantId` antes do Auth.
- [x] `firebaseService.js` expoe um resolvedor central de tenant autenticado.
- [x] O resolvedor limpa contexto local quando o usuario autenticado e superadmin ou nao possui `companyId` valido.
- [x] `vendas.js` aguarda a guarda de tenant antes de chamar `carregarDados()`.
- [x] `compras.js` aguarda a guarda de tenant antes de carregar fornecedores e produtos.
- [x] Cachebuster de `firebaseService.js`, `vendas.js` e `compras.js` foi atualizado.
- [x] Testes automatizados completos passaram.
- [x] Deploy/validacao em producao executados.

## Evidencias

- `node --check vendas.js`: passou.
- `node --check compras.js`: passou.
- `node --check firebaseService.js`: passou.
- `node --check tests/vendas-tenant-auth-guard.test.mjs`: passou.
- `node --test tests/vendas-financeiro-status.test.mjs tests/vendas-tenant-auth-guard.test.mjs tests/commerce-responsive-pwa.test.mjs tests/qa-visual-pwa-routes.test.mjs`: passou com 27 testes.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: passou com 156 testes.
- `firebase deploy --only hosting --project sisweb-7ce82 --dry-run`: passou.
- `firebase deploy --only hosting --project sisweb-7ce82`: executado com sucesso.
- `npm run security:postdeploy`: passou com 37/37 checks.
- Verificacao HTTP de producao: `vendas.html` contem `__siswebFirebaseServiceReady`, `firebaseService.js?v=2026-06-12-tenant-auth-guard-v1`, `vendas.js?v=2026-06-12-vendas-finance-status-v3` e nao contem o preload antigo por `company_info`.
- Verificacao HTTP de producao: `compras.html` contem `firebaseService.js?v=2026-06-12-tenant-auth-guard-v1`; a etapa posterior de financeiro atualizou `compras.js` para `v=2026-06-12-compras-finance-status-v1` mantendo `garantirContextoEmpresaCompras`.
- Smoke no navegador em `vendas.html?verify=status-save-v3-browser`: pagina carregou com `vendas.js?v=2026-06-12-vendas-finance-status-v3`; sem `warn/error` no console durante o carregamento.
- Smoke no navegador em `compras.html?verify=compras-tenant-auth-v1-browser`: pagina carregou sem `warn/error` no console durante o carregamento.

## Observacoes

- A correcao foi aplicada em Vendas e Compras, mantendo a mesma regra: dados operacionais so carregam apos tenant autenticado.

## File List

- `docs/stories/2026-06-12-vendas-tenant-auth-guard.md`
- `firebaseService.js`
- `vendas.html`
- `vendas.js`
- `compras.html`
- `compras.js`
- `tests/vendas-tenant-auth-guard.test.mjs`
- `tests/vendas-financeiro-status.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
