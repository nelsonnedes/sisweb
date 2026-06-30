# Story: Perfil com Permissoes Server-side

## Objetivo

Corrigir o erro `PERMISSION_DENIED` ao salvar Perfil, movendo a atualizacao cadastral do usuario para Cloud Function e evitando writes diretos do navegador em `users/{uid}` durante o fluxo de empresa.

## Acceptance Criteria

- [x] Perfil do usuario salva nome, usuario, telefone, WhatsApp e foto por Cloud Function autenticada.
- [x] Function de perfil aceita somente campos cadastrais seguros e preserva `companyId`, `superadmin`, assinatura, permissoes e status.
- [x] Perfil da empresa usa validacao server-side quando a Function esta disponivel e nao bloqueia edicao cadastral por token de assinatura desatualizado.
- [x] `company.html` nao grava `users/{uid}` diretamente apenas para atualizar `companyId`.
- [x] `company.html` exibe empresas normalizadas, sem `N/A` desorganizado, com cards responsivos para desktop/PWA.
- [x] Acoes perigosas de selecao/exclusao nao aparecem no card principal do usuario comum; SuperAdmin e orientado a usar `admin.html`.
- [x] Testes cobrem a nova Function, o fluxo sem write direto e a validacao de empresa.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`.
- [x] Publicar Functions/Hosting e validar no navegador.

## File List

- `docs/stories/2026-06-11-perfil-permissoes-functions.md`
- `functions/index.js`
- `firebaseService.js`
- `src/services/firebaseService.js`
- `company.html`
- `database-utils.js`
- `storage.rules`
- `tests/user-profile-superadmin.test.mjs`
- `tests/security-rbac-multitenant.test.mjs`
- `tests/company-profile-permissions.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/subscription-checkout-pix.test.mjs`

## Evidencias

- `node --check functions/index.js`: OK.
- `node --check src/services/firebaseService.js`: OK.
- `node --check firebaseService.js`: OK.
- Testes focados (`user-profile-superadmin`, `security-rbac-multitenant`, `company-profile-permissions`): 11/11 OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: 144/144 OK.
- Deploy Functions: OK (`updateMyCompanyProfile`, `updateMyUserProfile`).
- Deploy Storage: OK (`storage.rules`).
- Deploy Hosting: OK (`company.html`, `src/services/firebaseService.js`, `database-utils.js`).
- Verificacao no navegador em producao: OK em `company.html?verify=company-profile-permissions-v3`, assets `2026-06-11-company-profile-permissions-v1`, sem `error/warn` ou `permission_denied` fresco.

## Atualizacao Visual 2026-06-11

- `company.html` passou a usar `normalizeCompanyRecord` para mesclar dados de `profile`, campos legados e tenant antes de renderizar.
- Cards de empresas foram convertidos para classes responsivas, com estados de cadastro incompleto e sem interpolacao HTML crua.
- A listagem principal removeu `Selecionar`/`Excluir` do usuario comum e mostra orientacao de Admin para SuperAdmin.
- Ajuste `v3`: o cabecalho de `company.html` deixou de usar coluna `auto` que esmagava o titulo; dados do card agora aparecem com rotulos e CNPJ/telefone formatados.
- Evidencias desta rodada:
  - Sintaxe do script inline de `company.html`: OK.
  - Testes focados (`company-profile-permissions`, `subscription-checkout-pix`, `commerce-responsive-pwa`): 19/19 OK.
  - `npm run lint`: OK.
  - `npm run typecheck`: OK.
  - `npm test`: 145/145 OK.
  - Deploy Hosting: OK.
  - Verificacao desktop/PWA em producao: `company.html`, `user-profile.html` e `index.html` sem `overflow-x`, sem `error/warn` fresco e com assets `company-profile-permissions-v3`.
