# Story: Admin - Coluna Acoes Fixa nas Tabelas

## Objetivo

Aplicar no Admin o mesmo padrao de coluna de acoes fixa ja usado em tabelas operacionais do Sisweb, mantendo botoes de acao sempre visiveis no desktop sem quebrar o modo responsivo em cards no PWA/mobile.

## Acceptance Criteria

- [x] Tabelas do Admin com cabecalho `Acoes`, `Ações`, `Ação` ou `Action(s)` recebem marcacao automatica de coluna fixa.
- [x] A coluna de acoes fica sticky a direita no desktop, com fundo e sombra para leitura durante rolagem horizontal.
- [x] No desktop, botoes de acoes viram icones compactos com `aria-label`/tooltip e ficam em linha horizontal sem aumentar a altura da linha.
- [x] O modo mobile/PWA em cards desativa o sticky e preserva os botoes dentro do card.
- [x] No mobile/PWA, o rotulo `Acoes` ocupa a linha inteira e os botoes ficam em grade de duas colunas com texto visivel.
- [x] Assets do Admin e service worker foram versionados para evitar cache antigo.
- [x] Erros da callable `grantAdminFreeTrial` recebem mensagens operacionais mais claras no frontend e logs especificos no backend.
- [x] Testes cobrem helper JS, classes sticky e CSS desktop/mobile.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`.

## File List

- `docs/stories/2026-06-11-admin-coluna-acoes-fixa.md`
- `admin.html`
- `firebaseService.js`
- `functions/index.js`
- `scripts/admin/admin-main.js`
- `styles/admin-premium.css`
- `menu-component.js`
- `sw.js`
- `tests/admin-pwa-responsive.test.mjs`
- `tests/admin-grant-free-trial.test.mjs`
- `tests/admin-support-ui.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`

## Evidencias

- `node --check scripts/admin/admin-main.js`: OK.
- `node --check firebaseService.js`: OK.
- `node --check functions/index.js`: OK.
- `node --check menu-component.js`: OK.
- `node --check sw.js`: OK.
- Testes focados Admin/PWA: 32/32 OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: 138/138 OK.
- Deploy Function: OK (`firebase deploy --only "hosting,functions:grantAdminFreeTrial" --project sisweb-7ce82 --non-interactive`).
- Deploy Hosting: OK (`firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`).
- Verificacao remota dos assets publicados: OK (`admin-actions-compact-v2` em `admin.html`, `admin-main.js`, `admin-premium.css` e `sw.js`).
- Verificacao no navegador em producao: OK em `admin.html?tab=subscriptions`, coluna `Acoes` com `position: sticky`, `right: 0`, largura `178px`, altura `49px`; botoes `Detalhes`, `Notificar`, `Trial 30d` e `Excluir` em linha horizontal.
- Verificacao adicional no navegador: OK em `admin.html?tab=finance`, tabelas com cabecalho de acoes receberam marcacao sticky; linhas de estado vazio com `colspan` foram preservadas sem marcacao indevida.
- Verificacao mobile/PWA: OK em viewport `390x844`, coluna de acoes em card com `position: static`, rotulo em linha inteira e botoes em duas colunas com texto visivel.
- Verificacao logs `grantAdminFreeTrial`: ultimas chamadas consultadas sem erro 500; houve chamada callable autenticada com status 200.
