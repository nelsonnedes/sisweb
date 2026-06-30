# Story: Seguranca RBAC multi-tenant em regras e Functions

## Status

Ready for Review

## Contexto

A primeira leva conteve exposicao no Hosting e removeu segredos/dumps do indice Git. A proxima camada deve reduzir risco de vazamento entre empresas em regras RTDB e Cloud Functions, sem executar deploy automatico em producao nem alterar dados reais diretamente.

## Objetivo

Endurecer isolamento multi-tenant para leituras financeiras, onboarding de empresa, perfil da propria empresa e funcoes fiscais NF-e, mantendo compatibilidade com usuarios autenticados e superadmin.

## Acceptance Criteria

- [x] `subscriptionPayments` global nao libera leitura para qualquer usuario autenticado no nivel pai.
- [x] `createCompanyOnboarding` gera `companyId` no servidor e nao aceita `companyId`/`id` controlado pelo cliente.
- [x] `updateMyCompanyProfile` resolve empresa pelo usuario/token servidor-side e rejeita `companyId` divergente enviado pelo cliente.
- [x] Funcoes `nf_*` validam que o usuario autenticado pertence ao `tenantId` antes de ler certificado, assinar, enviar, consultar, cancelar ou remover certificado.
- [x] SuperAdmin em Cloud Functions depende de allowlist de UID/e-mail, nao de claim antiga nem marcador editavel em RTDB.
- [x] Storage nao permite leitura direta de certificado A1 por usuario comum nem comprovante de assinatura de outro usuario da empresa.
- [x] Testes automatizados cobrem os guardas acima.
- [x] Quality gates passam antes de qualquer deploy.
- [x] `companies/{companyId}` nao permite mais escrita herdada no pai do tenant.
- [x] `subscriptionRequests/{uid}` nao permite mais escrita direta do navegador; solicitacoes passam por Cloud Functions.
- [x] Secrets sensiveis SMTP/Mercado Pago nao usam fallback `_LOCAL` em producao.

## Tasks

- [x] Criar story e mapear pontos criticos.
- [x] Ajustar regras RTDB de pagamentos globais e `system`.
- [x] Ajustar Cloud Functions de onboarding/perfil.
- [x] Ajustar Cloud Functions fiscais NF-e para tenant membership.
- [x] Endurecer origem de SuperAdmin nas Functions.
- [x] Endurecer Storage para certificado A1 e comprovantes por usuario.
- [x] Adicionar testes de regressao.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`.
- [x] Registrar pendencias de deploy/rotacao/audit.
- [x] Cortar heranca de escrita em `companies/{companyId}`.
- [x] Cortar escrita direta em `subscriptionRequests/{uid}`.
- [x] Restringir fallback local de SMTP/Mercado Pago ao emulador.

## Riscos e Mitigacoes

- Risco: bloquear listagem legada de pagamentos para usuario comum.
  Mitigacao: manter leitura por item e espelhos por empresa/usuario; fluxos administrativos continuam via superadmin/Functions.

- Risco: usuario legitimo com token antigo perder escrita temporariamente.
  Mitigacao: resolver empresa por `users/{uid}` e token, e manter erro claro quando houver divergencia.

- Risco: funcoes fiscais quebrarem se o tenant fiscal usa apenas `tenants/{tenantId}` sem espelho em `companies`.
  Mitigacao: aceitar membership via token, `users/{uid}` ou `companies/{tenantId}/users/{uid}`.

- Risco: remover agora `.read/.write` do pai `companies/{companyId}` quebrar modulos legados que ainda leem a raiz do tenant.
  Mitigacao: manter como migracao separada com matriz RBAC por modulo e testes por rota antes do corte.

## Evidencias

- `node --test tests/security-rbac-multitenant.test.mjs`: passou com 6 testes.
- `node --test tests/security-rbac-multitenant.test.mjs tests/support-backend.test.mjs tests/company-logo-storage-policy.test.mjs`: passou com 25 testes.
- `node --check functions/index.js`: passou.
- `node --check functions/nf-functions.js`: passou.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: passou com 110 testes.
- `firebase deploy --only "database,storage" --project sisweb-7ce82 --dry-run`: passou.
- `firebase deploy --only "database,storage" --project sisweb-7ce82`: executado com sucesso.
- Validacao pos-deploy RTDB: `subscriptionPayments[".read"]` e `system[".read"]` em producao exigem `auth.token.superadmin == true`.
- `firebase deploy --only functions --project sisweb-7ce82 --dry-run`: passou.
- `firebase deploy --only functions --project sisweb-7ce82`: executado com sucesso.
- `firebase functions:list --project sisweb-7ce82`: confirmou Functions publicadas em Node.js 22.
- Gates finais apos deploy: `npm run lint`, `npm run typecheck` e `npm test` passaram com 110 testes.
- 2026-06-11: `node --test tests/security-rbac-multitenant.test.mjs tests/support-backend.test.mjs tests/subscription-checkout-pix.test.mjs`: passou com 23 testes.
- 2026-06-11: `node --check functions/index.js`: passou.
- 2026-06-11: `npm run lint`: passou.
- 2026-06-11: `npm run typecheck`: passou.
- 2026-06-11: `npm test`: passou com 147 testes.
- 2026-06-11: `firebase deploy --only "database,functions" --project sisweb-7ce82 --dry-run`: passou.
- 2026-06-11: `firebase deploy --only "database,functions" --project sisweb-7ce82`: executado com sucesso.
- 2026-06-11: validacao pos-deploy RTDB confirmou `companies/$companyId[".write"] = false` e `subscriptionRequests/$uid[".write"] = false`.
- 2026-06-11: validacao pos-deploy Functions confirmou que variaveis sensiveis de Mercado Pago e SMTP ficaram em `secretEnvironmentVariables`; env comum manteve apenas `SMTP_HOST`, `SMTP_PORT` e `SMTP_USER`.
- 2026-06-11: `npm run security:postdeploy`: passou com 37/37 checks.
- 2026-06-16: auditoria Auth via `firebase auth:export` encontrou 7 usuarios e apenas 1 com `superadmin=true`, o UID/e-mail allowlisted `HfrQ6ObQq2aSEoeEE4Ng9jpAolB3`/`nedes1@hotmail.com`; nao havia SuperAdmin fora da allowlist para revogar.
- 2026-06-16: `auditAdminClaimsInconsistencies` passou a reportar `superadmin=true fora da allowlist global`; deploy escopado dessa Function executado com sucesso.

## Pendencias de Arquitetura

- Migrar leitura de `companies/{companyId}` de regra herdada ampla para RBAC por modulo/funcionalidade, com testes por rota antes do corte.
- Criar callables tenant-scoped para admin da empresa cadastrar subusuarios e permissões por modulo.
- Centralizar auditoria append-only para alteracoes de perfil, claims, subusuarios e operacoes fiscais.
- Concluido em 2026-06-16: nao existem tokens/claims `superadmin=true` fora da allowlist atual.
- Criar callable de upload seguro para certificado A1 antes de bloquear escrita direta no Storage em `tenants/{tenantId}/certificados`.
- Concluido em 2026-06-16: `npm audit --omit=dev` zerado com atualizacoes e override controlado de `uuid`.

## File List

- `docs/stories/2026-06-07-seguranca-rbac-multitenant-functions.md`
- `database.rules.json`
- `storage.rules`
- `functions/index.js`
- `functions/nf-functions.js`
- `functions/.env.example`
- `tests/security-rbac-multitenant.test.mjs`
- `tests/fiscal-nfe-events.test.mjs`
- `tests/support-backend.test.mjs`
- `tests/subscription-checkout-pix.test.mjs`
