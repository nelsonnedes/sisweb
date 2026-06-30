# Story: Perfil do Usuario e Conta Operacional SuperAdmin

## Objetivo

Corrigir a pagina de perfil para carregar e salvar dados reais do usuario autenticado sem substituir o no `users/{uid}` inteiro, e impedir que a conta operacional SuperAdmin apareca como bloqueada ou receba acoes comerciais de assinatura no painel Admin.

## Acceptance Criteria

- [x] `user-profile.html` busca dados do Firebase Auth, `users/{uid}` e cache local com prioridade para dados reais.
- [x] Edicao de perfil salva por patch seguro via Cloud Function, preservando `companyId`, `superadmin`, status de assinatura, permissoes e dados financeiros.
- [x] Modal de perfil exibe e-mail, UID, empresa e perfil como campos de referencia somente leitura.
- [x] Registro de novos usuarios passa a gravar `displayName`, `name`, telefone vazio e timestamps de perfil para ficar compativel com a pagina de perfil.
- [x] Admin identifica SuperAdmin operacional e mostra status `SuperAdmin`, sem classifica-lo como bloqueado/expirado.
- [x] Linha de SuperAdmin na aba Assinaturas nao exibe Trial 30d, Prorrogar, Aprovar/Rejeitar ou Excluir.
- [x] Assets do Admin, Perfil, menu e service worker versionados para evitar cache antigo.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`.

## File List

- `docs/stories/2026-06-11-perfil-superadmin-dados-reais.md`
- `firebaseService.js`
- `functions/index.js`
- `src/services/firebaseService.js`
- `user-profile.html`
- `company.html`
- `storage.rules`
- `scripts/admin/admin-main.js`
- `admin.html`
- `menu-component.js`
- `sw.js`
- `tests/admin-grant-free-trial.test.mjs`
- `tests/admin-pwa-responsive.test.mjs`
- `tests/admin-support-ui.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/user-profile-superadmin.test.mjs`

## Evidencias

- `node --check firebaseService.js`: OK.
- `node --check scripts/admin/admin-main.js`: OK.
- `node --check sw.js`: OK.
- Testes focados Admin/PWA/Perfil: 23/23 OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: 140/140 OK.
- Deploy Hosting: OK (`firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`).
- Verificacao remota dos assets: OK (`admin.html`, `user-profile.html`, `firebaseService.js` e `sw.js` com `2026-06-11-profile-admin-v1`).
- Verificacao no navegador em producao/Admin: OK em `admin.html?tab=subscriptions`, Nelson `UID: HfrQ6ObQq2aS` exibido como `SuperAdmin`, com acoes `Detalhes`, `Notificar` e selo `Conta operacional`, sem `Trial 30d` ou `Excluir`.
- Verificacao no navegador em producao/Perfil: OK em `user-profile.html`, dados reais exibidos (`UID`, `Perfil SuperAdmin`, e-mail), modal de edicao com campos de referencia somente leitura e sem erros de console da aplicacao.
