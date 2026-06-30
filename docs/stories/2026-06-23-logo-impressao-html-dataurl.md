# Story: Logo em DataURL na impressao HTML

## Status
Done

## Contexto
A auditoria de logos mostrou que o fluxo de PDF ja convertia a logo do Storage para DataURL, mas a impressao HTML ainda podia receber URL tokenizada do Firebase Storage ou caminho bruto. Isso deixava relatorios dependentes de rede, cache, CORS e tempo de carregamento da imagem no preview de impressao.

## Criterios de aceite
- [x] `preparePrintOptions` resolve a logo da empresa para DataURL antes de montar cabecalho HTML.
- [x] O relatorio de empresa em `company.html` passa pelo mesmo preparo central antes de imprimir.
- [x] O HTML impresso nao renderiza diretamente URL do Firebase Storage quando ha `logoStoragePath`.
- [x] Testes focados cobrem a conversao sem `fetch` direto em URL do Storage.
- [x] Cache-busters de paginas e Service Worker foram atualizados para publicar a correcao no PWA.

## Tarefas
- [x] Ajustar helper compartilhado de impressao.
- [x] Ajustar relatorio de empresa para usar `preparePrintOptions`.
- [x] Atualizar teste focado de PWA/impressao.
- [x] Rodar validacoes locais.

## Evidencias
- `node --check commerce-pdf-share.js`: OK.
- `node --test tests/commerce-responsive-pwa.test.mjs tests/company-logo-storage-policy.test.mjs tests/estoque-pwa-impressao.test.mjs tests/company-profile-permissions.test.mjs`: OK, 36/36.
- `node --test tests/commerce-responsive-pwa.test.mjs tests/company-logo-storage-policy.test.mjs tests/estoque-pwa-impressao.test.mjs tests/company-profile-permissions.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/pwa-install-icon.test.mjs tests/pwa-mobile-menu-session.test.mjs`: OK, 55/55.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK, 174/174.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive --dry-run`: OK.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`: OK.
- Verificacao HTTP pos-deploy confirmou `commerce-pdf-share.js`, `company.html`, `vendas.html`, `compras.html`, `estoque.html` e `sw.js` com `2026-06-23-logo-print-dataurl-v1`.
- `npm run security:postdeploy`: OK, 37/37.

## File List
- `commerce-pdf-share.js`
- `company.html`
- `vendas.html`
- `compras.html`
- `estoque.html`
- `sw.js`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/company-profile-permissions.test.mjs`
- `tests/estoque-pwa-impressao.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
