# Runbook: Deploy de Cloud Functions no Sisweb (quota de CPU Cloud Run)

## Escopo

Este runbook registra a estratégia de deploy das Cloud Functions do projeto `sisweb-7ce82` diante da quota de CPU do Cloud Run na região `us-central1`. Use quando um deploy de functions falhar (ou estiver lento) com mensagens de quota.

## Sintomas observados (2026-08-14)

Deploy em lote das functions (v2 / 2nd gen) falhava com:

```
Error: User code failed to load. Cannot determine backend specification. Timeout after 10000.
```

e/ou

```
Could not create or update Cloud Run service <function>, Container Healthcheck failed.
Quota exceeded for total allowable CPU per project per region.
```

O erro "Quota exceeded..." afetava apenas functions v2 (Cloud Run); as functions v1 (1st gen, ex. `financeRegisterPayment`, `financeCreateAccounts`, etc.) deployavam normalmente.

### Causa raiz
- O projeto tem **25 serviços Cloud Run** na região `us-central1`, todos com `cpu=1`.
- A quota `run.googleapis.com/cpu_allocation` (`CpuAllocPerProjectRegion`) tem limite padrão de **20000 milli-vCPU = 20 vCPU** por projeto/região.
- O `firebase deploy --only functions` despacha todas as functions v2 **em paralelo**; cada deploy sobe uma instância para healthcheck. Muitos healthchecks simultâneos excedem o pico de CPU permitido.
- Symptom secundário: o CLI pode reportar `Cannot determine backend specification. Timeout after 10000` ao analisar o código em lotes grandes — também evitável deployando grupos menores/serialmente.

## Pré-requisitos / contexto
- Projeto GCP: `sisweb-7ce82`.
- Região dominante: `us-central1`.
- A maior parte do backend financeiro é v1 (1st gen); Sentry (sentry-*) e billing (estimate*/ingest*/sync*) são v2 (Cloud Run).

## Procedimento recomendado

### 1. Deploy serial (uma function por vez)
Em vez de `firebase deploy --only functions` (paralelo), deploie isoladamente:

```powershell
firebase deploy --only functions:sentryGetIssueDetail
firebase deploy --only functions:sentryResolveIssue
firebase deploy --only functions:sentrySyncIssues
firebase deploy --only functions:sentryWebhook
firebase deploy --only functions:estimateGoogleCloudBillingCompanyUsageCosts
```

### 2. Verificação pós-deploy
Liste os serviços Cloud Run e confira o estado `Ready`:

```powershell
gcloud run services list --region=us-central1 --format=json
```

(No Windows PowerShell, `gcloud config set project sisweb-7ce82` não é passado ao `node` — verificar que o projeto correto está selecionado antes: `gcloud config list`.)

### 3. Verificação por HTTP (healthcheck leve)
Chamadas callable sem auth retornam 400 (esperado — prova que a função está no ar):

```powershell
Invoke-WebRequest -Uri "https://us-central1-sisweb-7ce82.cloudfunctions.net/<nome-da-funcao>" -Method Post -Body '{}' -ContentType "application/json" -TimeoutSec 15
# HTTP 400 = função viva (exige auth). HTTP 404 = função inexistente/região errada.
```

## Limites de quota Cloud Run relevantes
- `run.googleapis.com/cpu_allocation` → `CpuAllocPerProjectRegion` = 20000 milli-vCPU (20 vCPU) em us-central1.
- `run.googleapis.com/mem_allocation` → 42949672960 bytes (~40 GB) em us-central1.
- Verificação via API:
  `https://serviceusage.googleapis.com/v1/projects/sisweb-7ce82/services/run.googleapis.com?fields=config.quota`

## Prevenção futura
- **Agrupar** deploys v2 em lotes pequenos (2-3 por vez) ou **serializar**.
- Não usar `--only functions` (tudo em paralelo) quando houver muitas v2 na região com `cpu=1`.
- Antes de lotes grandes, conferir quantos serviços Cloud Run estão prontos e quantos instâncias/CPUs estão em uso.