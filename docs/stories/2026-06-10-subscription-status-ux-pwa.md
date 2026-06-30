# Story: Subscription Status UX e engrenagem PWA

Data: 2026-06-10

## Contexto

O usuario confirmou que `subscription-status.html` acessado por usuario logado ainda estava simplista, especialmente o dropdown da engrenagem. A pagina precisa ficar mais profissional, elegante, atraente e intuitiva sem quebrar as logicas ja corrigidas de assinatura, trial, renovacao, modo leitura, Central de Mensagens e PWA.

## Checklist

- [x] Melhorar a composicao visual de `subscription-status.html`.
- [x] Reorganizar status, renovacao, prorrogação/modo leitura e Central de Mensagens em blocos mais claros.
- [x] Melhorar o dropdown da engrenagem no `menu-component.js` com identidade, status da assinatura e secoes de acao.
- [x] Atualizar cachebusters/PWA para garantir carregamento no navegador e app instalado.
- [x] Validar sintaxe e testes focados.
- [x] Publicar Hosting e testar no navegador logado.

## Criterios de aceite

- A pagina de status continua usando os IDs existentes de assinatura e botoes.
- O usuario logado permanece em `subscription-status.html`, sem redirecionamento indevido.
- A engrenagem continua abrindo alertas/configuracoes e preserva os links de perfil, assinatura, empresa, ajuda, suporte, sobre, admin e sair.
- O PWA recebe nova versao de cache.

## Arquivos

- `subscription-status.html`
- `menu-component.js`
- `sw.js`
- `admin.html`
- `ajuda.html`
- `subscription.html`
- `company.html`
- `login.html`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/subscription-status-help-guide.test.mjs`
- `tests/subscription-checkout-pix.test.mjs`
- `tests/admin-support-ui.test.mjs`
- `tests/admin-pwa-responsive.test.mjs`
- `tests/ajuda-manual-ilustrado.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `docs/stories/2026-06-10-subscription-status-ux-pwa.md`

## Evidencias

- `node --check menu-component.js`
- `node --check sw.js`
- `node --test tests/subscription-status-help-guide.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/pwa-install-icon.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/subscription-checkout-pix.test.mjs tests/admin-support-ui.test.mjs tests/admin-pwa-responsive.test.mjs tests/ajuda-manual-ilustrado.test.mjs` (`39/39`)
- `npm run lint`
- `npm run typecheck`
- `npm test` (`135/135`)
- `firebase deploy --only hosting --project sisweb-7ce82`
- Verificacao HTTP de `subscription-status.html`, `menu-component.js` e `sw.js` confirmou `2026-06-10-subscription-status-ux-v1`.
- Browser logado em `subscription-status.html?verify=subscription-status-ux-v1`: menu carregou `menu-component.js?v=2026-06-10-subscription-status-ux-v1`, 4 cards de status, 2 cards de acao, badge atualizado e sem overflow horizontal em mobile.
- Browser logado: engrenagem abriu o painel novo com card de perfil e secoes `Conta`, `Operação` e `Ajuda`; console sem erros.
- Browser desktop 1280x760: pagina e painel da engrenagem sem overflow horizontal.
