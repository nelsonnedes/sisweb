# Story: Vendas e Compras - tenant estrito quando online

## Status

Ready for Review

## Contexto

Durante o smoke de `compras.html` em producao, o console registrou `Permission denied` para leituras como `companies/{companyId}/especies`, `fornecedores`, `produtos` e `clients`.

A analise indicou risco de regressao no fluxo de inicializacao: Vendas e Compras ja aguardavam `resolveAuthenticatedTenant`, mas ainda aceitavam um fallback final baseado em `window.appTenantId`/servico mesmo quando o Firebase estava online. Esse fallback pode reaproveitar tenant de cache antigo e tentar ler dados de uma empresa que o usuario autenticado atual nao pode acessar.

## Objetivo

Garantir que Vendas e Compras carreguem dados operacionais somente com tenant autenticado quando o Firebase estiver online, permitindo tenant em cache apenas no modo offline/PWA.

## Acceptance Criteria

- [x] Compras usa `resolveAuthenticatedTenant` com `allowCached` ligado somente quando o app esta offline.
- [x] Vendas usa a mesma protecao de tenant estrito online.
- [x] Fallback por `obterTenantServico*()` so e aceito em modo offline.
- [x] Cachebusters de `vendas.js` e `compras.js` foram atualizados.
- [x] Testes automatizados cobrem a regra para impedir retorno por cache online.

## Evidencias

- `node --check compras.js`: passou.
- `node --check vendas.js`: passou.
- `node --check tests/commerce-responsive-pwa.test.mjs`: passou.
- `node --check tests/vendas-tenant-auth-guard.test.mjs`: passou.
- `node --test tests/vendas-tenant-auth-guard.test.mjs tests/commerce-responsive-pwa.test.mjs tests/vendas-financeiro-status.test.mjs tests/compras-financeiro-status.test.mjs tests/qa-visual-pwa-routes.test.mjs`: 29 testes passaram.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: 158 testes passaram.
- `firebase deploy --only hosting --project sisweb-7ce82 --dry-run`: passou.
- `firebase deploy --only hosting --project sisweb-7ce82`: passou.
- `npm run security:postdeploy`: 37/37 checks passaram.
- Verificacao HTTP em producao: `vendas.html` aponta para `vendas.js?v=2026-06-12-vendas-finance-status-v4-tenant-strict-v1`.
- Verificacao HTTP em producao: `compras.html` aponta para `compras.js?v=2026-06-12-compras-finance-status-v2-tenant-strict-v1`.
- Verificacao HTTP em producao: os dois scripts publicados contem `allowCached: isOffline` e nao contem fallback online incondicional por tenant cacheado.
- Smoke no navegador integrado: `compras.html` e `vendas.html` carregaram os scripts novos sem novos `warn/error` no console.

## File List

- `docs/stories/2026-06-12-vendas-compras-tenant-estrito-online.md`
- `compras.js`
- `compras.html`
- `vendas.js`
- `vendas.html`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/vendas-tenant-auth-guard.test.mjs`
- `tests/vendas-financeiro-status.test.mjs`
- `tests/compras-financeiro-status.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
