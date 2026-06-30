# Story: Vendas e Compras - Impressao da Lista Igual aos Detalhes

## Contexto

O usuario reportou que, no PC, imprimir dentro de "Detalhes do Pedido" carrega a logo da empresa corretamente no cabecalho, mas imprimir pedidos selecionados em "Lista de Pedidos" abre o fluxo de compartilhamento/PDF esperado para PWA e nao espelha a impressao de detalhes. No PWA, ambas as opcoes devem continuar com PDF/compartilhamento, mas com a logo tenant-scoped.

## Analise

- [x] Delegar analise para especialistas em impressao PC e PWA/PDF/Storage.
- [x] Mapear `imprimirPedido`, `imprimirPedidosSelecionados` e `exportarPedidos*Pdf` em Vendas e Compras.
- [x] Confirmar que a lista selecionada chamava PDF diretamente, sem verificar PC versus PWA.
- [x] Implementar branch desktop para usar impressao HTML.
- [x] Preservar branch PWA com PDF/compartilhamento.
- [x] Corrigir regressao CORS: HTML desktop nao deve converter logo em DataURL; PDF/PWA deve obter DataURL via backend tenant-scoped.
- [x] Validar com testes focados e gates.
- [x] Fazer deploy.

## Criterios de aceite

- [x] No PC, um pedido selecionado na Lista chama o mesmo `imprimirPedido(id)` usado em Detalhes.
- [x] No PC, varios pedidos selecionados geram documento HTML sequencial com cabecalho/logo por pedido.
- [x] No PWA, Lista e Detalhes continuam usando PDF/compartilhamento.
- [x] Vendas e Compras seguem a mesma regra.
- [x] Multi-tenant preservado via `obterDadosEmpresa()` e `firebaseService`.
- [x] Impressao nao trava quando a logo do Storage falha; backend converte logo tenant-scoped sem XHR direto do navegador para o arquivo.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: fluxo preserva isolamento multi-tenant via `obterDadosEmpresa()`, `getCompanyProfileForReport()` e Storage path `companies/{tenant}/profile/logo/...`; `getCompanyLogoDataUrl` valida autenticacao, tenant, prefixo do Storage, MIME e limite de 2MB antes de devolver DataURL.
- Responsividade e Padronizacao: no desktop a Lista usa o mesmo caminho de impressao HTML dos Detalhes; no PWA/mobile permanece PDF compartilhavel; os cabecalhos usam o helper visual compartilhado do Sisweb.
- Conformidade Legal: alteracao restrita a apresentacao/impressao de pedidos e relatorios de Vendas/Compras; nao altera calculos fiscais, folha, tributacao, precos ou regras trabalhistas.

## File list

- `commerce-pdf-share.js`
- `firebaseService.js`
- `functions/index.js`
- `vendas.js`
- `compras.js`
- `vendas.html`
- `compras.html`
- `client.html`
- `fornecedor.html`
- `sw.js`
- `menu-component.js`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/company-logo-storage-policy.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`

## Evidencias

- Especialistas delegados: fluxo PC confirmou que Lista chamava PDF direto; fluxo PWA/Storage confirmou necessidade de preservar `getStorageDataURL` no servico global.
- `node --check commerce-pdf-share.js`, `node --check firebaseService.js`, `node --check functions\index.js`, `node --check tests\commerce-responsive-pwa.test.mjs`, `node --check tests\company-logo-storage-policy.test.mjs` sem erros.
- Testes focados: `node --test tests\commerce-responsive-pwa.test.mjs tests\company-logo-storage-policy.test.mjs tests\qa-visual-pwa-routes.test.mjs tests\pwa-mobile-menu-session.test.mjs tests\pwa-install-icon.test.mjs tests\support-backend.test.mjs` => 46/46.
- Gates: `npm run lint`, `npm run typecheck`, `npm test` => 97/97.
- Deploy: `firebase deploy --only functions:getCompanyLogoDataUrl` criou a callable `getCompanyLogoDataUrl(us-central1)`; `firebase deploy --only hosting` concluido em `https://sisweb-7ce82.web.app`.
- Producao: `vendas.html` e `compras.html` servem `commerce-pdf-share.js`, `firebaseService.js`, `vendas.js` e `compras.js` com `v=2026-06-07-print-context-v13`; `sw.js` publica `2026-06-07-print-context-v13`.
- Producao verificada por HTTP: `firebaseService.js?v=2026-06-07-print-context-v13` contem `getCompanyLogoDataUrl`/`isTenantLogoPath`; `commerce-pdf-share.js?v=2026-06-07-print-context-v13` contem `preparePrintOptions(options = {}) { return options || {}; }`.
- Navegador interno em producao: `vendas.html?verify=logo-cors-v13` abriu autenticado; Lista de Pedidos selecionou 1 pedido e o clique de imprimir nao gerou `firebasestorage.googleapis.com`, `connection.ts`, `getBytes` ou `getStorageDataURL` no console.
- Navegador interno em producao: `compras.html?verify=logo-cors-v13` abriu autenticado e Lista de Pedidos carregou v13; nesta sessao nao havia item selecionavel para acionar impressao com pedido real.
- Correcao complementar: erro real colado pelo usuario mostrou CORS em `getBytes()` do SDK; o frontend agora nao usa DataURL para HTML desktop e logos de PDF usam a callable `getCompanyLogoDataUrl`.
- Observacao tecnica: console de Vendas ainda exibiu `permission_denied` para alguns caminhos de Realtime Database do tenant logado; isso nao reproduz o CORS da logo, mas deve ser tratado em uma story separada de claims/sessao multi-tenant caso afete usuarios especificos.
