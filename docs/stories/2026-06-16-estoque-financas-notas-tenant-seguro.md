# Story: Estoque, Financas e Notas Fiscais - tenant operacional seguro

Data: 2026-06-16

## Contexto

Vendas e Compras ja aplicam o padrao seguro de tenant operacional online: aguardam `resolveAuthenticatedTenant`, aceitam cache local somente em modo offline/PWA e exibem estado claro quando a empresa da sessao nao pode ser confirmada.

Na consolidacao das sessoes `019ea83c-36d3-7331-916a-32415d095e10` e `019ecc6e-0535-72d2-a266-89c1f33a223c`, a proxima pendencia real prioritaria ficou aplicar/auditar o mesmo padrao em Estoque, Financas e Notas Fiscais.

## Objetivo

Impedir que Estoque, Financas e Notas Fiscais carreguem dados operacionais por `company_info`/`window.appTenantId` antigo quando o Firebase estiver online, mantendo fallback de cache apenas para contingencia offline e preservando os fluxos de relatorio/impressao ja existentes.

## Acceptance Criteria

- [x] Estoque resolve tenant operacional por `resolveAuthenticatedTenant({ allowCached: isOffline })` antes de carregar dados Firebase.
- [x] Estoque nao usa `company_info` como fallback online para liberar carregamento operacional.
- [x] Financas resolve tenant operacional por `resolveAuthenticatedTenant({ allowCached: isOffline })` antes de carregar dados Firebase.
- [x] Financas nao usa `company_info` como fallback online para liberar carregamento operacional.
- [x] Notas Fiscais inicializa `NFService`, Naturezas, Preferencias, Produtos e eventos fiscais com tenant autenticado quando online.
- [x] Notas Fiscais nao envia operacoes fiscais com tenant vindo apenas de `company_info` online.
- [x] Os tres modulos mantem fallback local somente quando Firebase/navegador indicam modo offline.
- [x] Testes automatizados cobrem os guardas de Estoque, Financas e Notas Fiscais.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`.

## Arquitetura Decidida

- Reusar o helper central existente `firebaseService.resolveAuthenticatedTenant`.
- Reusar o criterio de offline ja aplicado em Vendas/Compras: `_FIREBASE_CONNECTED === false`, `firebaseConnected === false` ou `navigator.onLine === false`.
- Nao criar nova colecao nem novo modelo de dados.
- Nao alterar regras Firebase nesta etapa.
- Nao bloquear relatorios de impressao que usam dados locais como apresentacao, desde que o carregamento operacional online tenha passado por tenant autenticado.

## Tarefas

- [x] Mapear padrao seguro existente em Vendas/Compras.
- [x] Ajustar Estoque.
- [x] Ajustar Financas.
- [x] Ajustar Notas Fiscais.
- [x] Adicionar testes de regressao.
- [x] Atualizar evidencias e File List.

## Implementacao

- `estoque.js` ganhou guarda operacional central antes do carregamento online, reutilizando `resolveAuthenticatedTenant` e aceitando cache local apenas em modo offline.
- `financas.js` ganhou `ensureFinanceTenantContext()` para impedir leitura online de `financas/*` sem tenant autenticado e limpar contexto inseguro quando necessario.
- `notas-fiscais.html` passou a inicializar `NFService` via `garantirContextoEmpresaNF()`, reaproveitando `resolveAuthenticatedTenant`, e as operacoes fiscais sensiveis passaram a usar `obterTenantIdNF()` em vez de ler `company_info` diretamente.
- `estoque.html` e `financas.html` receberam novo cachebuster para os scripts alterados.
- `tests/tenant-operational-safe-modules.test.mjs` cobre os guardas novos e `tests/estoque-pwa-impressao.test.mjs` foi alinhado ao novo cachebuster.

## Evidencias

- `node --check estoque.js`: OK.
- `node --check financas.js`: OK.
- `node --test tests/tenant-operational-safe-modules.test.mjs tests/operational-route-state.test.mjs tests/commerce-responsive-pwa.test.mjs`: OK, 14/14.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK, 165/165.

## File List

- `docs/stories/2026-06-16-estoque-financas-notas-tenant-seguro.md`
- `estoque.js`
- `estoque.html`
- `financas.js`
- `financas.html`
- `notas-fiscais.html`
- `tests/tenant-operational-safe-modules.test.mjs`
- `tests/estoque-pwa-impressao.test.mjs`
