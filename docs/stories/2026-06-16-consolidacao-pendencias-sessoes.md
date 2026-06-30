# Story: Consolidacao de pendencias entre sessoes Codex

Data: 2026-06-16

## Contexto

Foi solicitado cruzar a sessao antiga `019ea83c-36d3-7331-916a-32415d095e10` com a sessao atual `019ecc6e-0535-72d2-a266-89c1f33a223c`, migrar o agendamento ativo para a sessao atual e separar o que ja foi concluido do que ainda e pendencia real executavel.

## Objetivo

Manter um quadro unico e rastreavel das pendencias reais apos o cruzamento das sessoes, marcando como OK os itens atendidos e priorizando a proxima fila de execucao sem inventar novos requisitos fora dos artefatos ja existentes.

## Checklist

- [x] Analisar a sessao antiga `019ea83c-36d3-7331-916a-32415d095e10` e extrair pendencias recorrentes.
- [x] Analisar a sessao atual `019ecc6e-0535-72d2-a266-89c1f33a223c` e cruzar com entregas ja realizadas.
- [x] Migrar o agendamento `radar-diario-sisweb-premium` para a sessao atual.
- [x] Confirmar que Data Connect `nelsonnedesbrito` e Cloud SQL `nelsonnedesbrito-fdc` foram excluidos e validados sem instancias/servicos remanescentes.
- [x] Marcar como atendidas as pendencias ja resolvidas por stories, deploys, testes ou confirmacao manual do owner.
- [x] Separar pendencias reais remanescentes em ordem recomendada.
- [x] Executar a proxima pendencia tecnica prioritaria: aplicar/auditar padrao de tenant operacional seguro em Estoque, Financas e Notas Fiscais.
- [x] Executar a pendencia seguinte da fila real: criar callable segura para upload/remocao de certificado A1 e bloquear escrita direta no Storage operacional.

## Marcadas como OK apos cruzamento

- [x] Agendamento diario do radar migrado para a sessao `019ecc6e-0535-72d2-a266-89c1f33a223c`.
- [x] Chave exposta de `service-account.json` revogada pelo owner no Console Firebase/GCP.
- [x] Historico Git local higienizado para artefatos sensiveis; repositorio sem remoto compartilhado segundo confirmacao do owner.
- [x] `functions.config()` legado removido do fluxo SMTP; SMTP usa Secret Manager e Runtime Config ficou vazio.
- [x] Data Connect `nelsonnedesbrito` e Cloud SQL `nelsonnedesbrito-fdc` excluidos em 2026-06-16 apos logs sem trafego desde 2026-06-10.
- [x] Edicao operacional do pedido pelo usuario foi testada e confirmada OK pelo owner.
- [x] Vendas/Compras com tenant estrito online, estado sem tenant e protecoes contra cache antigo publicados e testados.
- [x] Fluxos de estorno/status financeiro de Vendas e Compras corrigidos e documentados.
- [x] Regras RTDB endurecidas para bloquear escrita ampla em `companies/{companyId}` e escrita direta em `subscriptionRequests/{uid}`.
- [x] SuperAdmin auditado: apenas o UID/e-mail allowlisted mantem `superadmin=true`; `auditAdminClaimsInconsistencies` endurecida e publicada.
- [x] Dependencias atualizadas; `npm audit --omit=dev` zerado na raiz e em `functions` com override controlado de `uuid`.
- [x] NF-e CC-e e Inutilizacao implementadas e publicadas como Cloud Functions com XML assinado e envio SOAP real.
- [x] Assinaturas, Empresas, Trial, Central de Mensagens, suporte publico, anexos autenticados, PWA/Admin e UX de assinatura tiveram stories marcadas e evidencias registradas.
- [x] Campanhas/Cupons tiveram confiabilidade de cupom, link publico simples, botoes de compartilhamento e CRUD administrativo via Functions implementados.
- [x] Estoque, Financas e Notas Fiscais passaram a usar guarda de tenant operacional seguro com testes e cache local apenas offline, conforme `docs/stories/2026-06-16-estoque-financas-notas-tenant-seguro.md`.
- [x] Certificado A1 passou a usar callable segura para upload/remocao, metadado canonico e Storage restrito a backend/superadmin, conforme `docs/stories/2026-06-16-certificado-a1-callable-segura.md`.

## Pendencias reais remanescentes

1. NF-e homologacao continua sendo a fila principal: salvar ambiente em `homologacao`, usar certificado A1, emitir 1 NF-e, testar CC-e e inutilizacao.
2. O rascunho fiscal ainda pede cuidado com destinatario valido, itens, frete/volumes quando aplicavel e senha A1.
3. RBAC por modulo em `companies/{companyId}` segue como divida estrutural.

## Ordem recomendada de execucao

1. Finalizar smoke NF-e em homologacao com certificado A1 real.
2. Corrigir/preencher o rascunho fiscal usado no smoke.
3. Planejar RBAC por modulo em `companies/{companyId}`.

## Evidencias

- Agendamento `radar-diario-sisweb-premium` atualizado para `target_thread_id = "019ecc6e-0535-72d2-a266-89c1f33a223c"` em `C:\Users\Nelson\.codex\automations\radar-diario-sisweb-premium\automation.toml`.
- `docs/stories/2026-06-09-sisweb-auditoria-custos-cloud.md` registra exclusao e validacao final de Data Connect/Cloud SQL.
- `docs/runbooks/security-incident-deploy-runbook.md` registra status pos-incidente de 2026-06-16.
- `docs/stories/2026-06-07-seguranca-rbac-multitenant-functions.md` registra claims SuperAdmin, regras, secrets e dependencias.
- `docs/stories/2026-05-17-benchmark-bling-emissor-nfe-danfe.md` registra CC-e/Inutilizacao implementadas e pendencia de retorno SEFAZ real.
- `docs/stories/2026-06-12-vendas-tenant-auth-guard.md`, `2026-06-12-vendas-compras-tenant-estrito-online.md`, `2026-06-12-rotas-operacionais-estado-sem-tenant.md`, `2026-06-12-vendas-estorno-financeiro-status.md` e `2026-06-12-compras-estorno-financeiro-status.md` registram o bloco de Vendas/Compras concluido.
- `docs/stories/2026-06-09-env-secrets-campanhas-cupons.md` registra secrets SMTP, cupons, links simples e CRUD administrativo via Functions.
- `docs/stories/2026-06-16-estoque-financas-notas-tenant-seguro.md` registra a entrega do tenant operacional seguro em Estoque, Financas e Notas Fiscais com `npm test` em 165/165.
- `docs/stories/2026-06-16-certificado-a1-callable-segura.md` registra a troca para callable segura de certificado A1 e o endurecimento do Storage com `npm test` em 167/167.
- 2026-06-24: deploys necessarios reconfirmados e executados: Hosting, Realtime Database Rules, Storage Rules e Functions. Gates antes do deploy: `npm run lint`, `npm run typecheck`, `npm --prefix functions run lint` e `npm test` com 178/178. Pos-deploy: `security:postdeploy` 37/37, smoke HTTP das rotas principais e `firebase functions:list` confirmando 13 `nf_*` como v2 callable.
- 2026-06-16, browser autenticado em `https://sisweb-7ce82.web.app/notas-fiscais.html` confirmou via logs o tenant `1749492103278`, o carregamento bem-sucedido de `companies/1749492103278/fiscal/config` e a ausencia de certificado em `companies/{tenantId}/fiscal/certificado` / legado.
- 2026-06-16, aba Consulta confirmou 3 rascunhos `000000001` sem chave/protocolo, botao `Inutilizar nº` operacional na UI e ausencia natural de botao CC-e por nao existir NF-e autorizada.
- 2026-06-16, aba Configuracao confirmou empresa/naturezas/impostos preenchidos, `cfgAmbiente` visualmente em `Producao` e `Certificado Digital` em `Nao config.`; a aba Emissao permaneceu mostrando `Homologacao`, indicando discrepancia visual que precisa ser tratada como risco operacional na hora do smoke.

## File List

- `docs/stories/2026-06-16-consolidacao-pendencias-sessoes.md`
