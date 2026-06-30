# Story: Contencao de seguranca do Hosting e dados sensiveis

## Status

Ready for Review

## Contexto

Auditoria passiva confirmou que o Firebase Hosting estava servindo arquivos sensiveis e dumps de dados reais a partir da raiz publica do repositorio. A contencao deve reduzir o risco sem alterar dados de producao nem quebrar as rotas existentes do PWA.

## Objetivo

Bloquear publicacao de credenciais, chaves privadas, dumps RTDB e arquivos JSON com PII no Hosting; adicionar guardas automatizados para evitar regressao; preparar base para rotacao/limpeza de historico fora do codigo.

## Acceptance Criteria

- [x] `service-account*.json`, dumps RTDB e JSONs de dados reais ficam fora do deploy publico.
- [x] `.gitignore` bloqueia novas credenciais, chaves privadas e exports locais.
- [x] Headers basicos de hardening sao aplicados globalmente no Hosting.
- [x] Testes automatizados falham se patterns sensiveis sairem do `firebase.json`.
- [x] Nenhuma rota publica essencial do sistema e bloqueada por engano.
- [x] Evidencias e proximos passos de incidente ficam documentados.

## Tasks

- [x] Mapear arquivos sensiveis publicados e patterns ausentes.
- [x] Atualizar `firebase.json` com denylist explicita e headers globais.
- [x] Atualizar `.gitignore` para novas chaves/dumps.
- [x] Adicionar testes de regressao para Hosting seguro.
- [x] Remover arquivos sensiveis do indice Git sem apagar as copias locais.
- [x] Remover `.firebase/hosting..cache` do indice Git como artefato gerado contaminado.
- [x] Corrigir normalizacao de redirect pos-login para aceitar somente rotas internas HTML.
- [x] Corrigir toasts/notificacoes criticas para nao inserir mensagens como HTML.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`.
- [x] Atualizar dependencias vulneraveis em uma leva propria e testada, zerando `npm audit --omit=dev`.
- [x] Validar via HEAD apos deploy que arquivos sensiveis retornam 403/404 usando check CLI dedicado.

## Riscos e Mitigacoes

- Risco: bloquear arquivo necessario ao PWA por pattern amplo.
  Mitigacao: manter rotas HTML oficiais fora da denylist e validar testes de menu.

- Risco: apenas remover do deploy atual, mas manter segredo no historico.
  Mitigacao: executar rotacao da chave e limpeza do historico Git como etapa separada e auditada.

- Risco: headers quebrarem embeds legitimos.
  Mitigacao: iniciar com headers basicos e revisar qualquer necessidade real de iframe antes de relaxar `X-Frame-Options`.

## Evidencias

- `node --test tests/global-first-wave.test.mjs`: passou com 13 testes.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: passou com 104 testes.
- `firebase deploy --only hosting --project sisweb-7ce82`: executado com sucesso.
- `npm run security:postdeploy`: passou em producao com 37/37 checks, incluindo `service-account.json`, dumps, regras/configs e artefatos temporarios retornando 404.
- `npm run lint`: passou apos reforco final da denylist.
- `npm run typecheck`: passou apos reforco final da denylist.
- `npm test`: passou com 110 testes apos reforco final da denylist.
- Antes da leva final de dependencias, `npm audit --omit=dev` apontava vulnerabilidades no projeto raiz e em `functions`; essa evidencia foi preservada como baseline do incidente.
- `npm outdated --json`: raiz tem atualizacoes em `firebase`, `firebase-admin`, `express`, `eslint`, `prettier`, `typescript` e `@types/node`; `functions` tem atualizacoes em `axios`, `firebase-admin`, `firebase-functions-test` e `nodemailer`.
- 2026-06-16: owner confirmou que a chave exposta de `service-account.json` foi revogada no Console Firebase/GCP.
- 2026-06-16: `git remote -v` nao retornou remoto configurado; owner confirmou que o repositorio nao foi compartilhado.
- 2026-06-16: historico Git local higienizado; `git log --all` e `git rev-list --all --objects` nao encontram mais `service-account.json`, dumps RTDB ou JSONs reais removidos. Worktree temporario antigo do Codex que mantinha commit contaminado alcançavel tambem foi removido.
- 2026-06-16: `npm update` na raiz e em `functions` removeu severidades critica/alta; `node-forge` subiu para `1.4.0`, `axios` para `1.18.0`, `nodemailer` para `8.0.11`, `firebase-admin` para `13.10.0` e `firebase-functions` para `7.2.5`.
- 2026-06-16: `overrides.uuid` foi fixado em `^11.1.1` na raiz e em `functions`, eliminando o residuo moderado da cadeia `firebase-admin`/`@google-cloud/*` sem downgrade de `firebase-admin`/`firebase-functions`.
- 2026-06-16: `npm audit --omit=dev` passou com zero vulnerabilidades na raiz e em `functions`.
- 2026-06-16: `npm run security:postdeploy` passou em producao com 37/37 checks.
- 2026-06-16: `npm run lint`, `npm run typecheck`, `npm --prefix functions run lint`, `node --check functions/index.js`, `node --check functions/nf-functions.js` e `npm test` passaram; suite completa com 160/160 testes.

## Pendencias de Incidente

- Resolvido em 2026-06-16: chave exposta revogada pelo owner no Console Firebase/GCP.
- Resolvido em 2026-06-16: historico Git local limpo; sem remoto configurado e sem compartilhamento informado. Se um remoto for criado no futuro, publicar apenas a historia higienizada.
- Resolvido: deploy controlado de Hosting executado e validado com `npm run security:postdeploy`.
- Resolvido em 2026-06-16: `npm audit --omit=dev` zerado na raiz e em `functions` com override controlado de `uuid`.

## File List

- `firebase.json`
- `.gitignore`
- `.firebase/hosting..cache` (removido do indice Git; cache gerado no proximo deploy)
- `tests/global-first-wave.test.mjs`
- `docs/stories/2026-06-07-contencao-seguranca-hosting-lgpd.md`
- `auth.js`
- `login.html`
- `compras.js`
- `vendas.js`
- `scripts/admin/admin-ui.js`
- `src/components/ui/notifications.js`
- `.env.backup.1776951502484` (removido do indice Git; arquivo local preservado)
- `service-account.json` (removido do indice Git; arquivo local preservado)
- `Clients.json` (removido do indice Git; arquivo local preservado)
- `fornecedores.json` (removido do indice Git; arquivo local preservado)
- `contasReceber.json` (removido do indice Git; arquivo local preservado)
- `romaneiosTora.json` (removido do indice Git; arquivo local preservado)
- `sisweb-7ce82-default-rtdb-export (5).json` (removido do indice Git; arquivo local preservado)
- `tools/security/post-deploy-security-check.mjs`
- `docs/runbooks/security-incident-deploy-runbook.md`
- `package.json`
- `package-lock.json`
- `functions/package.json`
- `functions/package-lock.json`
