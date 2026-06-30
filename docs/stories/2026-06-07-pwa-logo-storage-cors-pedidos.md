# Story: PWA - Logo do Storage nos PDFs de Pedidos sem CORS

## Contexto

Ao imprimir Lista de Pedidos ou Detalhes do Pedido em Vendas/Compras no PWA, a logo cadastrada da empresa nao aparece no cabecalho. O console mostrou bloqueio de CORS ao tentar fazer `fetch()` em uma URL tokenizada do Firebase Storage.

## Analise

- [x] Reproduzir a causa a partir do erro informado pelo usuario.
- [x] Comparar com outros modulos que usam `<img src>` para impressao HTML.
- [x] Confirmar que PDF PWA precisa converter imagem para DataURL antes de `jsPDF.addImage`.
- [x] Corrigir helper de PDF para priorizar `logoStoragePath`.
- [x] Corrigir `firebaseService.getStorageDataURL()` para extrair caminho de URL do Firebase Storage.
- [x] Validar com testes focados e gates.
- [x] Fazer deploy.
- [x] Corrigir inicializacao do Admin SDK com `databaseURL` do RTDB regional para a callable `getCompanyLogoDataUrl`.

## Criterios de aceite

- [x] `commerce-pdf-share.js` nao tenta `fetch()` direto em URL `firebasestorage.googleapis.com`/`firebasestorage.app`.
- [x] Quando houver `logoStoragePath`, o PDF usa o caminho do Storage via SDK.
- [x] Quando vier apenas URL tokenizada do Firebase Storage, o sistema extrai o caminho `/o/...` e usa SDK.
- [x] Base64 continua somente em memoria, sem gravacao no banco.
- [x] Vendas/Compras publicados com cache-buster novo.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: aprovada. A URL tokenizada do Storage e convertida para caminho tenant-scoped antes da leitura via SDK; nao ha nova persistencia de base64 e nao ha `fetch()` direto em URL Firebase Storage.
- Responsividade e Padronizacao: aprovada. A correcao preserva o mesmo cabecalho PDF de pedidos ja usado em Vendas/Compras e apenas troca a origem da imagem no fluxo PWA.
- Conformidade Legal: aprovada. Alteracao restrita a exibicao de logo em cabecalho de PDF; nao altera calculos fiscais, folha, financeiro, estoque ou obrigacoes legais.

## File list

- `commerce-pdf-share.js`
- `firebaseService.js`
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
- `functions/index.js`

## Evidencias

- Teste focado: `node --test tests/commerce-responsive-pwa.test.mjs` com 7/7 aprovado.
- Teste focado ampliado: `node --test tests/commerce-responsive-pwa.test.mjs tests/company-logo-storage-policy.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/pwa-install-icon.test.mjs` com 37/37 aprovado.
- Gates: `git diff --check`, `npm run lint`, `npm run typecheck` e `npm test` aprovados; suite completa com 94/94 testes.
- Producao HTTP: `sw.js`, `vendas.html`, `compras.html`, `commerce-pdf-share.js` e `firebaseService.js` respondem 200 com `2026-06-07-pwa-logo-cors-v11`.
- Producao smoke: em `vendas.html?verify=pwa-logo-cors-v11`, `resolveCompanyLogoDataUrl({ logoUrl: URL tokenizada })` chamou `firebaseService.getStorageDataURL('companies/1749492103278/profile/logo/1779188923523_Logo_JN.png')` e retornou DataURL.
- Deploy: `firebase deploy --only hosting` concluido em `https://sisweb-7ce82.web.app`.
- Pos-inventario 2026-06-09: logs apontavam `Can't determine Firebase Database URL` em `getCompanyLogoDataUrl`; corrigido em `functions/index.js`, validado com `npm test` 118/118 e publicado com `firebase deploy --only "functions:getCompanyLogoDataUrl,functions:ingestCloudBillingBudgetNotification" --project sisweb-7ce82`.
