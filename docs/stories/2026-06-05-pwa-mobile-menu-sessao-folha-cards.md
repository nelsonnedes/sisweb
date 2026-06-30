# Story: PWA mobile, menu, sessao e Folha responsiva

## Contexto

No uso instalado como PWA em mobile, o sidebar nao exibe uma opcao clara de sair, o sino de alertas tem area clicavel limitada ao icone e alguns fluxos podem pedir login novamente ao navegar para modulos como Estoque. Tambem foi identificado que a tabela de lancamentos da Folha fica pouco ergonomica em telas pequenas.

## Objetivo

Corrigir a navegacao mobile do menu, reforcar atualizacao e restauracao de sessao no PWA sem quebrar multitenancy, e adaptar a tabela principal da Folha para uma visualizacao mobile em cards.

## Acceptance Criteria

- [x] Sidebar mobile exibe uma opcao direta e visivel de `Sair`.
- [x] Sino de alertas e configuracoes respondem ao clique/toque em todo o gatilho visual, nao apenas no icone.
- [x] Instalacao PWA verifica e aplica novas versoes sem exigir desinstalar/reinstalar.
- [x] Sessao autenticada pode ser restaurada em PWA/mobile quando o Firebase ainda esta inicializando, respeitando usuario, empresa e guardas de assinatura.
- [x] Logout e bloqueio/assinatura limpam tambem o marcador duravel de sessao.
- [x] Tabela de lancamentos da Folha ganha layout mobile em cards sem afetar desktop ou impressao.
- [x] Multitenancy existente permanece preservado; nenhum caminho global novo de dados de negocio e criado.

## Tasks

- [x] Revisar menu mobile, dropdowns e logout.
- [x] Revisar service worker, versao PWA e checagens de atualizacao.
- [x] Revisar login/checkAuth e cache local de sessao.
- [x] Criar marcador duravel de sessao com validade curta e seguro para fallback mobile.
- [x] Adaptar tabela de Folha para cards em telas pequenas.
- [x] Adicionar testes de regressao.
- [x] Rodar quality gates.

## Dev Notes

- A sessao duravel deve ser apenas um fallback de inicializacao/offline; quando o Firebase retornar usuario, ele continua sendo a fonte principal.
- O fallback precisa usar `currentUser`/`persistentUser` existentes e passar por `enforceSubscriptionGuard`.
- Nao criar armazenamento de dados de Folha fora dos caminhos tenant atuais.
- Logout e sessoes bloqueadas limpam `company_info`, `window.companyInfo` e `window.appTenantId`.

## File List

- `docs/stories/2026-06-05-pwa-mobile-menu-sessao-folha-cards.md`
- `auth.js`
- `login.html`
- `menu-component.js`
- `menu.css`
- `sw.js`
- `folha_pagamento/folha-utils.js`
- `folha_pagamento/folha-main.js`
- `folha_pagamento/folha.css`
- `tests/pwa-mobile-menu-session.test.mjs`

## QA Notes

- `node --check menu-component.js; node --check auth.js; node --check sw.js; node --check folha_pagamento\folha-utils.js; node --check folha_pagamento\folha-main.js` passou.
- `node --test tests\pwa-mobile-menu-session.test.mjs` passou com 4/4.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `npm test` passou com 45/45.
- Browser dedicado nao ficou disponivel como ferramenta nesta rodada; a validacao visual foi coberta por testes estruturais e CSS responsivo isolado em `@media screen`.
