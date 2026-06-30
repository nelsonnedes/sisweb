# Story: Admin PWA e roteamento seguro de assinaturas

Data: 2026-06-10

## Contexto

Ao clicar em Assinatura no menu, clientes autenticados carregavam `subscription-status.html`, mas logo eram redirecionados para `index.html`. O mesmo podia ocorrer com links publicos de `subscription.html`, porque o roteador de pos-login tratava paginas de assinatura como paginas iniciais/login e aplicava o destino padrao de usuarios ativos.

Tambem foi solicitado melhorar as paginas que compoem `admin.html` para uso em PWA, com abas, botoes, tabelas e modais funcionando melhor em telas pequenas.

## Checklist

- [x] Auditar redirecionamentos de `auth.js`, `login.html`, `subscription.html`, `subscription-status.html` e menu.
- [x] Permitir que usuarios autenticados permanecam em `subscription-status.html`.
- [x] Permitir que links publicos de `subscription.html` carreguem sem sessao e pecam login somente nas acoes.
- [x] Em link publico, mostrar `Assinar`/`Comecar dias gratis` para visitantes sem sessao real.
- [x] Redirecionar visitantes sem sessao para cadastro antes de trial gratis ou pagamento.
- [x] Apos cadastro da empresa, retomar trial gratis ou abrir pagamento conforme escolha original.
- [x] Preservar login normal: usuario com assinatura paga ou trial valido entra direto no sistema.
- [x] Manter `subscription-status.html` para assinatura/trial vencidos, com renovacao ou modo somente leitura.
- [x] Preservar `redirect` para `subscription.html` e `subscription-status.html` depois do login.
- [x] Manter guards de acesso para paginas internas e status expirado/bloqueado.
- [x] Ajustar Admin para PWA: abas rolaveis, tabelas em cards, botoes estaveis, modais em bottom sheet e safe areas.
- [x] Atualizar cachebusters e versao do service worker/menu.
- [x] Adicionar teste de regressao para Admin PWA.
- [x] Rodar quality gates completos.
- [x] Validar em navegador apos publicacao.

## Achados

- `resolvePostLoginRoute` redirecionava usuarios `active`/`trial_active` para `index.html` mesmo quando a rota atual ou solicitada era uma pagina de assinatura.
- `auth.js` fazia verificacao automatica em `subscription.html`, o que quebrava link publico de campanha/checkout para usuario sem sessao.
- `subscription.html` tambem redirecionava usuario sem sessao para login durante o carregamento inicial, antes de exibir a oferta publica.
- `login.html` podia descartar `redirect=subscription.html` e `redirect=subscription-status.html` como se fossem contexto de loop.
- O Admin ja tinha parte da camada responsiva, mas faltava ligar o detector PWA no bootstrap e marcar wrappers de tabela para o modo card.

## Arquivos

- `auth.js`
- `login.html`
- `company.html`
- `subscription.html`
- `subscription-status.html`
- `admin.html`
- `sw.js`
- `menu-component.js`
- `scripts/admin/admin-main.js`
- `styles/admin-premium.css`
- `tests/admin-pwa-responsive.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/subscription-checkout-pix.test.mjs`
- `tests/admin-support-ui.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `docs/stories/2026-06-10-admin-pwa-assinaturas-roteamento.md`

## Evidencias

- `node --check auth.js`
- `node --check menu-component.js`
- `node --check scripts/admin/admin-main.js`
- Parse de scripts inline/module em `subscription.html`, `login.html` e `company.html`.
- `node --test tests/subscription-checkout-pix.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/subscription-status-help-guide.test.mjs` (`13/13`)
- `node --test tests/admin-pwa-responsive.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/admin-support-ui.test.mjs tests/pwa-install-icon.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/subscription-status-help-guide.test.mjs` (`25/25`)
- `npm run lint`
- `npm run typecheck`
- `npm test` (`129/129`)
- `firebase deploy --only hosting --project sisweb-7ce82`
- Verificacao HTTP de `admin.html`, `subscription.html`, `subscription-status.html` e `sw.js` servindo `2026-06-10-admin-pwa-auth-v4`.
- Verificacao HTTP pos-deploy de `subscription.html`, `login.html`, `company.html` e `sw.js` com fluxo publico de cadastro/pagamento v3.
- Validacao no navegador interno de `subscription.html?cupom=TESTE&verify=subscription-public-register-v3` sem erros de console.
- Validacao no navegador interno em viewport mobile: `admin.html?tab=campaign` abriu com aba Campanhas selecionada, `subscription-status.html` permaneceu na propria URL e `subscription.html?cupom=TESTE` permaneceu na propria URL, sem erros de console.
