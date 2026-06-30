# Story: Rotas operacionais - estado claro sem tenant ativo

## Status

Ready for Review

## Contexto

Apos endurecer o tenant online em Vendas e Compras, uma rota operacional aberta sem sessao valida ou sem empresa ativa poderia ficar visualmente vazia, com apenas toasts passageiros. Isso confundia desktop e PWA, principalmente depois de cache expirado, logout parcial ou troca de usuario.

## Objetivo

Exibir um estado persistente, claro e seguro quando Vendas ou Compras nao tiverem tenant operacional confirmado, com acao para entrar novamente e sem permitir carregamento/acoes de pedidos por tenant cacheado online.

## Acceptance Criteria

- [x] Vendas exibe painel persistente quando nao ha empresa ativa.
- [x] Compras exibe painel persistente quando nao ha empresa ativa.
- [x] SuperAdmin recebe mensagem propria indicando uso de usuario operacional para pedidos.
- [x] Botoes principais de pedido ficam bloqueados enquanto o tenant operacional nao esta pronto.
- [x] `novoPedido` e `listarPedidos` sao protegidos contra chamadas diretas sem tenant.
- [x] Cachebusters de Vendas e Compras foram atualizados.
- [x] Inicializacao nao depende de capturar `DOMContentLoaded` quando o script carrega com DOM pronto.
- [x] Testes automatizados cobrem o estado sem tenant.

## Evidencias

- `node --check vendas.js`: passou.
- `node --check compras.js`: passou.
- `node --check tests/operational-route-state.test.mjs`: passou.
- `node --test tests/operational-route-state.test.mjs tests/vendas-tenant-auth-guard.test.mjs tests/commerce-responsive-pwa.test.mjs tests/vendas-financeiro-status.test.mjs tests/compras-financeiro-status.test.mjs tests/qa-visual-pwa-routes.test.mjs`: 31 testes passaram apos cachebuster v2 e inicializacao idempotente.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: 160 testes passaram.
- `firebase deploy --only hosting --project sisweb-7ce82 --dry-run`: passou.
- `firebase deploy --only hosting --project sisweb-7ce82`: publicado.
- `npm run security:postdeploy`: 37/37 checks passaram.
- HTTP Hosting: `vendas.js?v=2026-06-12-vendas-finance-status-v6-operational-state-v2` e `compras.js?v=2026-06-12-compras-finance-status-v4-operational-state-v2` publicados com painel, login e inicializacao por `document.readyState`.
- Browser smoke: Vendas e Compras exibiram painel sem tenant, link `login.html?reason=tenant_required` e 2/2 botoes principais bloqueados.

## File List

- `docs/stories/2026-06-12-rotas-operacionais-estado-sem-tenant.md`
- `vendas.js`
- `vendas.html`
- `compras.js`
- `compras.html`
- `tests/operational-route-state.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/vendas-tenant-auth-guard.test.mjs`
- `tests/vendas-financeiro-status.test.mjs`
- `tests/compras-financeiro-status.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
