# Runbook: Google Cloud Billing, BigQuery e Custos do Sisweb

## Escopo

Este runbook guia a etapa operacional para medir e reduzir custo do projeto Firebase/Google Cloud `sisweb-7ce82`.

Use quando precisar:

- ativar ou validar exportacao de Billing para BigQuery;
- ver custo por servico, SKU e mes;
- conferir se o Budget com Pub/Sub esta ligado ao sininho do SuperAdmin;
- revisar logs repetidos de `Permission denied` ou bloqueio por billing;
- levantar artefatos antigos antes de aplicar limpeza segura.

## Estado conhecido em 2026-06-09

- Projeto: `sisweb-7ce82`.
- Billing account vinculada: `010952-939008-9EF759`.
- Hosting ativo: `https://sisweb-7ce82.web.app`.
- Budget operacional com Pub/Sub: `Firebase Project sisweb-7ce82`.
- Topico Pub/Sub operacional: `projects/sisweb-7ce82/topics/sisweb-cloud-billing-budget-alerts`.
- Function ativa para sininho/dashboard: `ingestCloudBillingBudgetNotification`.
- RTDB ja recebe notificacoes em `/system/googleCloudBilling`.
- O inventario anterior nao mostrou dataset BigQuery de Billing configurado.
- Em 2026-06-09, o Console ativou:
  - custo de uso padrao em `billing_export`;
  - custo de uso detalhado em `billing_export`;
  - sistema de precos em `billing_export`;
  - visualizacao/metadados de CUD em `billing_export1`.
- Primeira verificacao do Cloud Shell mostrou `billing_export1.cud_subscriptions_export` criado antes das tabelas padrao. Isso e esperado: aguardar `gcp_billing_export_v1_010952_939008_9EF759` antes de consultar custos reais.
- Print do Console Billing em 2026-06-09 mostrou `Firebase Project sisweb-7ce82` com custo aproximado de R$ 17,32/R$ 300,00, enquanto `Orçamento Sisweb` ainda aparecia R$ 0,00/R$ 100,00. O budget operacional do sininho precisa usar o mesmo escopo/filtro do budget que enxerga o projeto.
- O budget `Firebase Project sisweb-7ce82` foi conferido com escopo de 1 projeto (`sisweb-7ce82`), todos os servicos, valor R$ 300, limites 50/90/100 reais e Pub/Sub `projects/sisweb-7ce82/topics/sisweb-cloud-billing-budget-alerts`. Este deve ser tratado como budget operacional principal.
- O budget antigo `Orçamento Sisweb` foi excluido no Console em 2026-06-09 para evitar divergencia de leitura no sininho.
- Print de relatorios do Billing em 2026-06-09 mostrou custo atual em torno de R$ 17,42, forecast mensal em torno de R$ 70,03 e `Cloud SQL` como principal servico visivel, com aproximadamente R$ 15,11. Use o atalho de detalhamento para conferir servico/SKU antes do BigQuery export popular as tabelas.
- Em 2026-06-09, a instancia Cloud SQL encontrada foi `nelsonnedesbrito-fdc`, PostgreSQL 15, tier `db-f1-micro`, zona `us-east4-a`, status `RUNNABLE`, IP publico ativo e label `firebase-data-connect: ft`.
- O `firebase dataconnect:services:list --project sisweb-7ce82` confirmou o servico Data Connect `nelsonnedesbrito` em `us-east4`, apontando para `CloudSQL Instance: nelsonnedesbrito-fdc` e banco `fdcdb`, sem Connector ID preenchido no retorno colado.

## 1. Abrir Cloud Shell

1. Acesse o Console Google Cloud.
2. Selecione o projeto `sisweb-7ce82`.
3. Clique no icone do Cloud Shell no topo da tela.
4. Cole o bloco abaixo inteiro:

```bash
PROJECT_ID="sisweb-7ce82"
BILLING_ACCOUNT_ID="010952-939008-9EF759"
DATASET_ID="billing_export"
CUD_DATASET_ID="billing_export1"
LOCATION="US"
TOPIC_ID="sisweb-cloud-billing-budget-alerts"
BILLING_TABLE="gcp_billing_export_v1_${BILLING_ACCOUNT_ID//-/_}"
DETAILED_BILLING_TABLE="gcp_billing_export_resource_v1_${BILLING_ACCOUNT_ID//-/_}"
PRICING_TABLE="cloud_pricing_export"

gcloud config set project "$PROJECT_ID"
gcloud auth list
gcloud billing projects describe "$PROJECT_ID"
```

Resultado esperado:

- `billingEnabled: true`.
- `billingAccountName` apontando para `billingAccounts/010952-939008-9EF759`.

Se `billingEnabled` vier `false`, volte ao Firebase/Google Cloud Billing e vincule o projeto a conta de faturamento antes de continuar.

Atalhos uteis do Console:

- Relatorios: `https://console.cloud.google.com/billing/010952-939008-9EF759/reports?organizationId=0`.
- Detalhamento de custos: `https://console.cloud.google.com/billing/010952-939008-9EF759/reports/cost-breakdown?organizationId=0`.
- Analise de CUD: `https://console.cloud.google.com/billing/010952-939008-9EF759/commitments/analysis;timeRange=LAST_30_DAYS;commitment=subscriptionDefinitions%2Fae656bee-1eaf-4b54-a206-1b5be60f942c;timeGrouping=DAILY_GRANULARITY`.
- Faturas, extratos e documentos de faturamento: `https://console.cloud.google.com/billing/invoices`.
- Transacoes e comprovantes de pagamento: `https://console.cloud.google.com/billing/history`.

Pela documentacao oficial do Cloud Billing, faturas/extratos ficam na area de faturas/documentos e comprovantes de pagamento ficam em **Transacoes**. Ao abrir, selecione a conta **Pagamento do Firebase** se o Console pedir a conta de faturamento. O acesso exige permissao de Administrador da conta de faturamento ou Visualizador da conta de faturamento.

## 2. Habilitar APIs necessarias

Cole no Cloud Shell:

```bash
gcloud services enable \
  bigquery.googleapis.com \
  bigquerydatatransfer.googleapis.com \
  cloudbilling.googleapis.com \
  billingbudgets.googleapis.com \
  pubsub.googleapis.com \
  artifactregistry.googleapis.com \
  logging.googleapis.com \
  --project="$PROJECT_ID"
```

## 3. Criar dataset do BigQuery

Cole no Cloud Shell:

```bash
if ! bq show "$PROJECT_ID:$DATASET_ID" >/dev/null 2>&1; then
  bq --location="$LOCATION" mk \
    --dataset \
    --description "Cloud Billing export do Sisweb" \
    "$PROJECT_ID:$DATASET_ID"
fi

bq show "$PROJECT_ID:$DATASET_ID"
```

Use `LOCATION="US"` para tentar obter retroativo do inicio do mes anterior na exportacao padrao. Depois que o dataset e criado, a localizacao nao pode ser alterada.

## 4. Ativar exportacao no Console

Esta parte e feita pelo Console, nao pelo terminal.

1. Abra: `https://console.cloud.google.com/billing/export?project=sisweb-7ce82`.
2. Escolha a conta de faturamento `010952-939008-9EF759`.
3. Abra a aba **BigQuery export**.
4. Em **Standard usage cost data**, clique em **Enable export**.
5. Projeto: `sisweb-7ce82`.
6. Dataset: `billing_export`.
7. Salve.
8. Habilite **Detailed usage cost data** no mesmo dataset `billing_export` se precisar enxergar recurso especifico, nao apenas servico/SKU.
9. Habilite **Pricing data** no mesmo dataset `billing_export`.
10. Se habilitar **Committed use discounts (CUD) metadata/view**, use `billing_export1` se o Console nao aceitar reutilizar `billing_export`.

Nao habilite expiracao automatica de tabelas no dataset de billing. Se uma tabela exportada for apagada, os registros apagados nao sao reprocessados automaticamente.

## 5. Confirmar que a tabela apareceu

A exportacao pode demorar algumas horas. Em dataset multi-regiao `US`, o backfill inicial pode levar dias ate completar.

Cole no Cloud Shell:

```bash
echo "Tabela esperada: $PROJECT_ID.$DATASET_ID.$BILLING_TABLE"
bq ls "$PROJECT_ID:$DATASET_ID"
bq show "$PROJECT_ID:$DATASET_ID.$BILLING_TABLE"
bq show "$PROJECT_ID:$DATASET_ID.$DETAILED_BILLING_TABLE"
bq show "$PROJECT_ID:$DATASET_ID.$PRICING_TABLE"
bq ls "$PROJECT_ID:$CUD_DATASET_ID"
```

Se algum `bq show` ainda retornar erro de tabela inexistente, aguarde e rode de novo mais tarde. A tabela detalhada e a tabela de precos tambem podem aparecer depois da exportacao padrao.

O dataset `billing_export1` e usado apenas para a visao/metadados de descontos por compromisso de uso. Para o Sisweb, as primeiras analises de custo continuam usando `billing_export`.

Se o Admin mostrar erro de permissao como `Permission bigquery.tables.get denied`, libere leitura do BigQuery para as service accounts usadas pelas Functions:

```bash
PROJECT_ID="sisweb-7ce82"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

for SA in \
  "$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  "$PROJECT_ID@appspot.gserviceaccount.com"
do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA" \
    --role="roles/bigquery.jobUser"

  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA" \
    --role="roles/bigquery.dataViewer"
done
```

Depois volte ao Admin e clique em **Sincronizar** no card Google Cloud Billing.

## 6. Ver custo dos ultimos 30 dias por servico e SKU

Depois que a tabela existir, rode:

```bash
bq query --use_legacy_sql=false --project_id="$PROJECT_ID" "
SELECT
  service.description AS service,
  sku.description AS sku,
  location.region AS region,
  ROUND(SUM(cost), 2) AS gross_cost,
  ROUND(SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0)), 2) AS credits,
  ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0)), 2) AS net_cost,
  ANY_VALUE(currency) AS currency
FROM \`${PROJECT_ID}.${DATASET_ID}.${BILLING_TABLE}\`
WHERE project.id = '${PROJECT_ID}'
  AND usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY service, sku, region
ORDER BY net_cost DESC
LIMIT 50
"
```

O campo `net_cost` soma o custo bruto e os creditos. Normalmente creditos entram negativos.

## 7. Ver custo mensal por servico

```bash
bq query --use_legacy_sql=false --project_id="$PROJECT_ID" "
SELECT
  invoice.month AS invoice_month,
  service.description AS service,
  ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0)), 2) AS net_cost,
  ANY_VALUE(currency) AS currency
FROM \`${PROJECT_ID}.${DATASET_ID}.${BILLING_TABLE}\`
WHERE project.id = '${PROJECT_ID}'
GROUP BY invoice_month, service
ORDER BY invoice_month DESC, net_cost DESC
LIMIT 100
"
```

## 8. Focar em servicos provaveis de custo

```bash
bq query --use_legacy_sql=false --project_id="$PROJECT_ID" "
SELECT
  service.description AS service,
  sku.description AS sku,
  ROUND(SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) AS c), 0)), 2) AS net_cost,
  ANY_VALUE(currency) AS currency
FROM \`${PROJECT_ID}.${DATASET_ID}.${BILLING_TABLE}\`
WHERE project.id = '${PROJECT_ID}'
  AND (
    LOWER(service.description) LIKE '%function%'
    OR LOWER(service.description) LIKE '%run%'
    OR LOWER(service.description) LIKE '%artifact%'
    OR LOWER(service.description) LIKE '%logging%'
    OR LOWER(service.description) LIKE '%storage%'
    OR LOWER(service.description) LIKE '%firebase%'
    OR LOWER(service.description) LIKE '%bigquery%'
  )
GROUP BY service, sku
ORDER BY net_cost DESC
LIMIT 100
"
```

Use esse resultado antes de remover Function, bucket, artefato ou log. Primeiro mede, depois corta.

## 9. Conferir Budget operacional e Pub/Sub

```bash
gcloud pubsub topics describe "projects/$PROJECT_ID/topics/$TOPIC_ID" --project="$PROJECT_ID"

gcloud billing budgets list \
  --billing-account="$BILLING_ACCOUNT_ID" \
  --format="table(name,displayName,amount.specifiedAmount.units,notificationsRule.pubsubTopic)"

BUDGET_NAME="$(gcloud billing budgets list \
  --billing-account="$BILLING_ACCOUNT_ID" \
  --filter='displayName="Orçamento Sisweb"' \
  --format='value(name)' | head -n 1)"

echo "Budget operacional: $BUDGET_NAME"

if [ -z "$BUDGET_NAME" ]; then
  echo "Nao encontrei o budget Orçamento Sisweb. Confira o nome no Console antes de atualizar."
else
  gcloud billing budgets describe "$BUDGET_NAME" --format=json
fi
```

Se o budget operacional existir mas nao tiver Pub/Sub, aplique:

```bash
if [ -z "$BUDGET_NAME" ]; then
  echo "Sem BUDGET_NAME; nao vou atualizar nada."
else
  gcloud billing budgets update "$BUDGET_NAME" \
    --notifications-rule-pubsub-topic="projects/$PROJECT_ID/topics/$TOPIC_ID"
fi
```

Mantenha apenas um budget principal para alerta operacional no app. Outros budgets podem existir para email, mas nao devem confundir o sininho.

Se o Console mostrar custo no budget `Firebase Project sisweb-7ce82` e custo zero em outro budget duplicado, faca uma destas correcoes:

1. Preferencial: mantenha `Firebase Project sisweb-7ce82` com Pub/Sub e trate ele como o budget operacional principal.
2. Remova o Pub/Sub do budget duplicado, ajuste para email-only ou delete o budget antigo se ele nao tiver utilidade.
3. Se quiser manter os dois, deixe claro que apenas um budget deve alimentar alerta operacional no app para evitar leituras divergentes.

O dashboard Admin tambem possui sincronizacao manual via BigQuery Export. Quando a tabela `gcp_billing_export_v1_010952_939008_9EF759` aparecer, clique em **Sincronizar** no card Google Cloud Billing para gravar custos por servico/SKU em `/system/googleCloudBilling`.

## 10. Ver erros repetidos de Permission denied e billing

```bash
SINCE="$(date -u -d '24 hours ago' '+%Y-%m-%dT%H:%M:%SZ')"

gcloud logging read \
  "timestamp>=\"$SINCE\" AND severity>=WARNING AND (textPayload:\"Permission denied\" OR jsonPayload.message:\"Permission denied\" OR protoPayload.status.message:\"Permission denied\" OR protoPayload.status.code=7)" \
  --project="$PROJECT_ID" \
  --limit=100 \
  --format="table(timestamp,severity,resource.type,resource.labels.function_name,protoPayload.methodName,protoPayload.status.message,textPayload,jsonPayload.message)"
```

Para o erro especifico que bloqueou deploy por billing:

```bash
gcloud logging read \
  'protoPayload.status.message:"Write access to project" OR protoPayload.status.message:"check billing account"' \
  --project="$PROJECT_ID" \
  --limit=50 \
  --format="table(timestamp,severity,protoPayload.serviceName,protoPayload.methodName,protoPayload.status.message,protoPayload.authenticationInfo.principalEmail)"
```

Se aparecerem erros repetidos, copie somente os campos de metodo, funcao, caminho e mensagem. Nao cole tokens, cookies, headers ou service account JSON.

## 11. Revisar Cloud SQL antes de cortar custo

O print de relatorios de 2026-06-09 mostrou `Cloud SQL` como maior custo visivel. Antes de desligar ou remover qualquer recurso, confirme se existe dependencia real de producao:

```bash
PROJECT_ID="sisweb-7ce82"
gcloud config set project "$PROJECT_ID"

gcloud services list --enabled \
  --filter="config.name:sqladmin.googleapis.com" \
  --project="$PROJECT_ID"

gcloud sql instances list --project="$PROJECT_ID"
```

Para cada instancia listada:

```bash
INSTANCE_ID="COLE_AQUI_O_NOME_DA_INSTANCIA"

gcloud sql instances describe "$INSTANCE_ID" \
  --project="$PROJECT_ID" \
  --format="yaml(name,state,databaseVersion,region,tier,settings.activationPolicy,settings.availabilityType,settings.backupConfiguration.enabled,settings.ipConfiguration.ipv4Enabled)"

gcloud logging read \
  "resource.type=\"cloudsql_database\" AND resource.labels.database_id:\"$INSTANCE_ID\"" \
  --project="$PROJECT_ID" \
  --freshness=7d \
  --limit=50 \
  --format="table(timestamp,severity,protoPayload.methodName,textPayload,jsonPayload.message)"
```

Achado confirmado no Sisweb:

- Instancia: `nelsonnedesbrito-fdc`.
- `connectionName`: `sisweb-7ce82:us-east4:nelsonnedesbrito-fdc`.
- Banco principal do Data Connect: `fdcdb`.
- Usuarios SQL: `firebasesuperuser`, `postgres`, `service-240003261222@gcp-sa-firebasedataconnect.iam`.
- Servico Data Connect: `nelsonnedesbrito`, local `us-east4`.
- A busca no codigo local do Sisweb nao encontrou uso direto de `postgres`, `cloudsql`, `sqladmin`, `Data Connect` ou credenciais SQL. Isso sugere recurso de teste/experimento, mas ainda exige confirmacao por logs antes de parar.

Verificacao complementar em 2026-06-16:

- O ambiente local da auditoria nao possui `gcloud`; use Console Google Cloud/Cloud Shell para logs e alteracoes da instancia.
- `firebase dataconnect:services:list --project sisweb-7ce82` confirmou o servico Data Connect `nelsonnedesbrito`, local `us-east4`.
- O retorno apontou `Data Source` como `CloudSQL Instance: nelsonnedesbrito-fdc`, banco `fdcdb`, `Schema Last Updated` em `2026-06-08T19:18:11.965689459Z`.
- `Connector ID` e `Connector Last Updated` vieram vazios no retorno, entao nao ha conector ativo confirmado pela CLI nessa leitura.
- Logs consultados por API para Cloud SQL e Data Connect desde `2026-06-10T00:00:00Z` retornaram zero entradas.
- Com autorizacao do owner, o Data Connect `nelsonnedesbrito` e a instancia Cloud SQL `nelsonnedesbrito-fdc` foram excluidos em 2026-06-16.
- Validacao apos exclusao: `firebase dataconnect:services:list --project sisweb-7ce82` retornou tabela vazia e Cloud SQL Admin API retornou `count: 0`.

Interprete assim:

- Se nao houver instancia, o custo pode ser residual ou de outro projeto vinculado a mesma conta de faturamento.
- Se houver instancia parada/desnecessaria, documente antes de excluir.
- Se houver instancia sem trafego recente e usada apenas para teste, prefira desligar, reduzir tier, remover HA/backups excessivos ou migrar dados necessarios antes de apagar.
- Se a instancia for usada por producao fiscal/integracao externa, nao desligue sem plano de migracao.

Para confirmar atividade recente antes de qualquer parada:

```bash
PROJECT_ID="sisweb-7ce82"
INSTANCE_ID="nelsonnedesbrito-fdc"

gcloud logging read \
  "resource.type=\"cloudsql_database\" AND resource.labels.database_id:\"$PROJECT_ID:$INSTANCE_ID\"" \
  --project="$PROJECT_ID" \
  --freshness=7d \
  --limit=50 \
  --format="table(timestamp,severity,protoPayload.methodName,protoPayload.authenticationInfo.principalEmail,textPayload,jsonPayload.message)"

firebase dataconnect:services:list --project "$PROJECT_ID"
```

Se os logs nao mostrarem trafego de aplicacao e o Data Connect nao estiver em uso no produto, a opcao mais segura e primeiro parar a instancia para observacao, nao excluir imediatamente. Excluir so depois de backup/exportacao e alguns dias sem impacto.

## 12. Revisar CUD sem assumir compra

A analise de CUD do Google Cloud ajuda a entender cobertura, utilizacao e economia de compromissos. Ela usa dados de custo e nao deve virar compra automatica de compromisso.

Para o Sisweb, com custo atual baixo, use a tela principalmente para confirmar se ja existe compromisso ativo e se ele esta sendo usado:

```bash
PROJECT_ID="sisweb-7ce82"
BILLING_ACCOUNT_ID="010952-939008-9EF759"

gcloud billing accounts describe "$BILLING_ACCOUNT_ID"
```

No Console, abra o atalho **Analise CUD**. Se houver compromisso ativo:

- Confira se a cobertura/utilizacao esta alta antes de manter ou ampliar.
- Se a utilizacao estiver baixa, investigue se o compromisso pertence a outro projeto da mesma conta de faturamento.
- Nao compre novo CUD para economizar poucos reais mensais; primeiro reduza recursos ligados, como Cloud SQL, logs e leituras desnecessarias.

## 13. Inventariar Functions antes de decidir corte

```bash
firebase functions:list --project "$PROJECT_ID"

gcloud functions list \
  --regions=us-central1 \
  --project="$PROJECT_ID" \
  --format=json > functions-cloud.json

gcloud run services list \
  --region=us-central1 \
  --project="$PROJECT_ID" \
  --format=json > cloud-run-services.json

ls -lh functions-cloud.json cloud-run-services.json
```

Nao delete Function apenas pelo nome. No Sisweb, PIX, Mercado Pago, NF-e, suporte, assinaturas e claims dependem de Functions callable/HTTP.

## 14. Inventariar Artifact Registry

```bash
gcloud artifacts repositories list \
  --project="$PROJECT_ID" \
  --location=us-central1 \
  --format="table(name,format,mode,sizeBytes)"
```

Se aparecer o repositorio `gcf-artifacts`, liste imagens:

```bash
gcloud artifacts docker images list \
  "us-central1-docker.pkg.dev/$PROJECT_ID/gcf-artifacts" \
  --include-tags \
  --limit=200 \
  --format="table(package,tags,version,updateTime)"
```

## 15. Aplicar limpeza de artefatos em dry-run

Primeiro rode em dry-run. Nao use `--no-dry-run` antes de revisar o resultado nos logs.

```bash
cat > artifact-cleanup-sisweb.json <<'JSON'
[
  {
    "name": "delete-untagged-older-than-30d",
    "action": { "type": "Delete" },
    "condition": {
      "tagState": "untagged",
      "olderThan": "30d"
    }
  },
  {
    "name": "keep-minimum-10-versions",
    "action": { "type": "Keep" },
    "mostRecentVersions": {
      "keepCount": 10
    }
  }
]
JSON

gcloud artifacts repositories set-cleanup-policies gcf-artifacts \
  --project="$PROJECT_ID" \
  --location=us-central1 \
  --policy=artifact-cleanup-sisweb.json \
  --dry-run

gcloud artifacts repositories list-cleanup-policies gcf-artifacts \
  --project="$PROJECT_ID" \
  --location=us-central1
```

Apos pelo menos um dia, confira o dry-run:

```bash
gcloud logging read \
  'protoPayload.serviceName="artifactregistry.googleapis.com" AND protoPayload.request.parent="projects/sisweb-7ce82/locations/us-central1/repositories/gcf-artifacts/packages/-" AND protoPayload.request.validateOnly=true' \
  --resource-names="projects/sisweb-7ce82" \
  --project="$PROJECT_ID" \
  --limit=100
```

Somente depois de revisar, aplicar de verdade:

```bash
gcloud artifacts repositories set-cleanup-policies gcf-artifacts \
  --project="$PROJECT_ID" \
  --location=us-central1 \
  --policy=artifact-cleanup-sisweb.json \
  --no-dry-run
```

## 16. Quando trazer dados para o dashboard Admin

O Admin e o sininho ja leem `/system/googleCloudBilling`.

Depois que as consultas BigQuery mostrarem o custo correto, podemos criar uma Function agendada ou callable SuperAdmin para gravar um resumo nesse formato:

```json
{
  "summary": {
    "source": "bigquery-billing-export",
    "costAmount": 0,
    "budgetAmount": 100,
    "currencyCode": "BRL",
    "usagePercent": 0,
    "lastNotificationAt": "2026-06-09T00:00:00.000Z"
  },
  "costSeries": [
    { "label": "202606", "amount": 0 }
  ],
  "invoices": []
}
```

Faturas/documentos oficiais devem ser conferidos no painel de Billing/Payments. O BigQuery export e excelente para custos e SKUs, mas nao substitui o documento fiscal/recibo oficial.
