# Story: Vendas e Compras - Clientes/Fornecedores em Abas Embutidas

## Contexto

O usuario reportou que em `compras.html`, ao clicar na aba Fornecedores, o sistema sai totalmente do modulo e navega para `fornecedor.html`. Pediu analise tambem para Clientes em `vendas.html`, buscando melhor responsividade e experiencia sem perder o contexto do pedido.

## Analise

- [x] Mapear redirecionamento de Fornecedores em Compras.
- [x] Mapear comportamento de Clientes em Vendas.
- [x] Validar fluxo multi-tenant das paginas de cadastro.
- [x] Implementar painel embutido responsivo nas abas.
- [x] Adicionar comunicacao segura entre iframe e modulo pai.
- [x] Validar com testes focados e gates.
- [x] Fazer deploy.

## Criterios de aceite

- [x] Aba Fornecedores em Compras nao redireciona para fora de `compras.html`.
- [x] Aba Clientes em Vendas abre o cadastro dentro do proprio modulo.
- [x] Paginas `client.html` e `fornecedor.html` continuam funcionando como paginas completas quando abertas diretamente.
- [x] Modo embutido oculta menu/rodape duplicados e usa layout responsivo compartilhado.
- [x] Cadastro embutido notifica a pagina pai por `postMessage` validado por origem.
- [x] Selects de Cliente/Fornecedor podem ser recarregados apos criacao/edicao.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: aprovada. A comunicacao iframe -> modulo pai usa `postMessage` com validacao de `event.origin === window.location.origin`; as leituras/escritas continuam nos servicos Firebase tenantizados existentes.
- Responsividade e Padronizacao: aprovada. Vendas e Compras usam painel embutido comum, `commerce-responsive.css`, modo `sisweb-embedded` e cards mobile nos cadastros.
- Conformidade Legal: aprovada. Mudanca de navegacao e UX; nao altera calculos, documentos fiscais, folha, estoque ou regras governamentais.

## File list

- `commerce-responsive.css`
- `vendas.html`
- `vendas.js`
- `compras.html`
- `compras.js`
- `client.html`
- `fornecedor.html`
- `js/client.js`
- `js/fornecedor.js`
- `sw.js`
- `menu-component.js`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`

## Evidencias

- Teste focado: `node --test tests/commerce-responsive-pwa.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/pwa-install-icon.test.mjs` com 24/24 aprovado.
- Smoke local mobile `390x640`: Vendas permaneceu em `/vendas.html` com `client.html?embedded=true`; Compras permaneceu em `/compras.html` com `fornecedor.html?embedded=true`; ambos com `overflow = 0`.
- Gates: `git diff --check`, `npm run lint`, `npm run typecheck` e `npm test` aprovados; suite completa com 93 testes.
- Producao HTTP: `sw.js`, `vendas.html`, `compras.html`, `client.html` e `fornecedor.html` respondem 200 com `2026-06-07-embedded-tabs-v10`.
- Smoke producao mobile `390x640`: Vendas e Compras mantiveram a rota do modulo, ativaram a aba `#clientes`, carregaram o iframe embutido e ficaram sem overflow horizontal.
- Deploy: `firebase deploy --only hosting` concluido em `https://sisweb-7ce82.web.app`.
