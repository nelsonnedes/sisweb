# Story: Seguranca operacional para deploy, rotacao e validacao

## Status

Ready for Review

## Contexto

As primeiras levas locais reduziram exposicao no Hosting, XSS em notificacoes, redirect aberto, SuperAdmin fraco, parte do isolamento multi-tenant e acesso direto a artefatos fiscais. A proxima etapa precisa transformar isso em operacao segura de producao, porque algumas acoes exigem dono do projeto Firebase/GCP e podem afetar usuarios reais.

## Objetivo

Documentar e automatizar o caminho seguro para deploy, rotacao de chaves, limpeza de historico e validacao pos-deploy, sem alterar dados reais automaticamente.

## Acceptance Criteria

- [x] Existe runbook com passo a passo para responsaveis de Firebase/GCP executarem rotacao de chave, deploy controlado e rollback.
- [x] Existe check CLI pos-deploy somente leitura para confirmar que artefatos sensiveis nao estao publicos no Hosting.
- [x] O check pos-deploy valida rotas publicas essenciais e headers basicos de hardening.
- [x] `package.json` expoe comando CLI para o check pos-deploy.
- [x] Evidencias dos quality gates ficam registradas antes de concluir a story.
- [x] Resultado real do check pos-deploy em producao fica registrado apos deploy controlado.

## Tasks

- [x] Criar story operacional.
- [x] Criar runbook de incidente, deploy, rotacao e rollback.
- [x] Criar script CLI de validacao pos-deploy.
- [x] Adicionar script npm `security:postdeploy`.
- [x] Rodar validacoes locais.
- [x] Registrar pendencias que exigem acao do owner/devops.

## Riscos e Mitigacoes

- Risco: executar rotacao ou deploy sem acesso/autoridade correta.
  Mitigacao: separar tarefas que exigem owner/devops e manter comandos documentados sem executa-los automaticamente.

- Risco: check pos-deploy tocar dados reais.
  Mitigacao: limitar o script a HEAD/GET publicos em rotas estaticas e arquivos sensiveis esperados como 403/404.

- Risco: deploy de rules/functions bloquear fluxo legitimo.
  Mitigacao: deploy em etapas, backup de regras antes, smoke test funcional e rollback documentado.

## Evidencias

- `node --check tools/security/post-deploy-security-check.mjs`: passou.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: passou com 110 testes.
- `npm run security:postdeploy`: falhou contra a producao atual antes do deploy, com 14/29 checks passando. Falhas confirmadas para arquivos sensiveis/regras ainda publicos e headers ausentes no Hosting atual.
- `firebase deploy --only hosting --project sisweb-7ce82 --dry-run`: passou.
- `firebase deploy --only hosting --project sisweb-7ce82`: executado com sucesso.
- `npm run security:postdeploy`: passou em producao com 37/37 checks apos deploy do Hosting.
- Backup RTDB pre-rules salvo em `tmp/security-backups/database-rules-before-20260607-214937.json`.
- `firebase deploy --only "database,storage" --project sisweb-7ce82 --dry-run`: passou.
- `firebase deploy --only "database,storage" --project sisweb-7ce82`: executado com sucesso.
- Validacao RTDB pos-deploy confirmou leituras globais de `subscriptionPayments` e `system` restritas a SuperAdmin.
- `firebase deploy --only functions --project sisweb-7ce82 --dry-run`: passou.
- `firebase deploy --only functions --project sisweb-7ce82`: executado com sucesso.
- `firebase functions:list --project sisweb-7ce82`: confirmou Functions publicadas.
- Gates finais: `npm run lint`, `npm run typecheck` e `npm test` passaram com 110 testes.
- 2026-06-16: owner confirmou revogacao da chave exposta de `service-account.json` no Console Firebase/GCP.
- 2026-06-16: repositorio sem remoto configurado (`git remote -v` vazio) e owner confirmou que nao foi compartilhado.
- 2026-06-16: historico Git local higienizado; os artefatos sensiveis nao aparecem em `git log --all` nem em `git rev-list --all --objects`.
- 2026-06-16: `functions.config()` ja estava migrado; `firebase functions:config:get` havia retornado Runtime Config vazio na story de secrets SMTP.
- 2026-06-16: nova rodada de gates passou: `npm run lint`, `npm run typecheck`, `npm --prefix functions run lint`, `node --check functions/index.js`, `node --check functions/nf-functions.js`, `npm test` com 160/160 e `npm run security:postdeploy` com 37/37.
- 2026-06-16: `firebase auth:export` auditado em arquivo temporario removido apos leitura: 7 usuarios Auth, apenas `HfrQ6ObQq2aSEoeEE4Ng9jpAolB3`/`nedes1@hotmail.com` com `superadmin=true`, dentro da allowlist; nenhum SuperAdmin fora da allowlist para revogar.
- 2026-06-16: `auditAdminClaimsInconsistencies` foi endurecida para acusar `superadmin=true fora da allowlist global` e redeploy escopado de Functions passou.

## Pendencias Operacionais

- Concluido em 2026-06-16: owner revogou a chave exposta do service account no Console Firebase/GCP.
- Concluido em 2026-06-16: historico Git local foi limpo; nao ha remoto configurado nem compartilhamento informado.
- Owner deve autorizar qualquer proxima janela de deploy e validar usuarios/perfis criticos em producao.
- Concluido em 2026-06-16: auditoria Auth confirmou que nao existem SuperAdmin claims fora da allowlist atual.
- Concluido em story posterior: `functions.config()` legado migrado para `.env`/Secret Manager; Runtime Config ficou vazio.

## File List

- `docs/stories/2026-06-08-seguranca-operacional-deploy-rotacao.md`
- `docs/runbooks/security-incident-deploy-runbook.md`
- `tools/security/post-deploy-security-check.mjs`
- `package.json`
- `firebase.json`
- `.gitignore`
- `tests/global-first-wave.test.mjs`
- `package-lock.json`
- `functions/package.json`
- `functions/package-lock.json`
