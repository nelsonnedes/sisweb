# Story: PWA - Logo da Empresa em PDFs e Relatorios

## Contexto

O usuario reportou que em PWA alguns PDFs e relatorios exibem os dados da empresa no cabecalho, mas nao carregam a logo. O padrao de PC deve ser preservado tambem no PWA.

## Analise

- [x] Mapear fluxo de cabecalho HTML de impressao.
- [x] Mapear fluxo de PDF PWA via `jsPDF`.
- [x] Implementar conversao temporaria da logo do Storage/URL para DataURL em memoria.
- [x] Atualizar cache/versionamento PWA.
- [x] Validar com testes focados e gates.
- [x] Fazer deploy.

## Criterios de aceite

- [x] PDF PWA tenta carregar logo da empresa a partir de `logo`, `logoUrl` ou `logoStoragePath`.
- [x] Conversao para DataURL ocorre somente em memoria, sem persistir base64 no banco.
- [x] Cabecalho segue o mesmo padrao Sisweb ja usado no PC.
- [x] Multi-tenant preservado pela leitura central existente do perfil da empresa.
- [x] Fallback de iniciais permanece quando a logo estiver indisponivel.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: aprovada. A logo e convertida para DataURL apenas em memoria durante a geracao do PDF; nao ha nova persistencia de base64 nem leitura fora do tenant.
- Responsividade e Padronizacao: aprovada. O fluxo PWA usa o mesmo helper de cabecalho dos relatorios/impressoes de comercio e preserva fallback visual quando a logo nao carrega.
- Conformidade Legal: aprovada. Alteracao visual de cabecalho/PDF; nao altera calculos fiscais, financeiros, trabalhistas ou ambientais.

## File list

- `commerce-pdf-share.js`
- `vendas.html`
- `compras.html`
- `fornecedor.html`
- `sw.js`
- `menu-component.js`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`

## Evidencias

- Teste focado: `node --test tests/commerce-responsive-pwa.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/pwa-install-icon.test.mjs` com 24/24 aprovado.
- Gates: `git diff --check`, `npm run lint`, `npm run typecheck` e `npm test` aprovados; suite completa com 93 testes.
- Producao: `sw.js`, `vendas.html`, `compras.html`, `client.html` e `fornecedor.html` respondem 200 com `2026-06-07-embedded-tabs-v10`.
- Smoke producao: `window.SiswebCommercePdf.resolveCompanyLogoDataUrl` ativo em Vendas e Compras.
- Deploy: `firebase deploy --only hosting` concluido em `https://sisweb-7ce82.web.app`.
