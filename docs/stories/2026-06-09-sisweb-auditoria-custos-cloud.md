# Story: Auditoria de custos Cloud e uso operacional Sisweb

Data: 2026-06-09

## Contexto

O Console Billing mostrou custo atual do projeto `sisweb-7ce82` em torno de R$ 17,42 no mes e previsao aproximada de R$ 70,03. O maior servico visivel no print foi `Cloud SQL`, com aproximadamente R$ 15,11.

Como o Sisweb em producao usa Firebase Hosting, Realtime Database, Storage e Cloud Functions, a auditoria separa dois tipos de custo:

- custo real de infraestrutura do Google Cloud, vindo de Billing/BigQuery/Console;
- custo operacional estimado por `companyId`, calculado por volume de registros e uso dentro do app.

## Implementado

- [x] Confirmado por `firebase functions:list` que as Functions atuais sao callables/eventos Firebase e nao mostram integracao direta com Cloud SQL no codigo local.
- [x] Dashboard Admin recebeu atalho para o detalhamento de custos do Billing.
- [x] Dashboard Admin recebeu rateio estimado por `companyId`, com pesos por usuarios, cadastros, transacoes, estoque, folha e suporte.
- [x] Backend SuperAdmin calcula e persiste `/system/googleCloudBilling/companyUsageCostAllocation`.
- [x] Rateio usa custo real do BigQuery quando existir; enquanto isso, usa custo informado por Budget como base provisoria.
- [x] Varredura inicial encontrou pontos de economia no app: leituras amplas, logs de debug, fallbacks REST e carregamentos de colecoes inteiras em telas administrativas/operacionais.
- [x] Corrigidos atalhos quebrados de faturas/documentos e transacoes do Console Billing para as rotas oficiais globais.
- [x] Caminhos operacionais vazios do Admin tratados como esperados para reduzir avisos repetidos no console.
- [x] Sincronizacao BigQuery passou a manter o valor do Budget quando a tabela existe mas ainda nao possui linhas de custo.
- [x] Verificacao complementar em 2026-06-16 confirmou via Firebase CLI que o Data Connect `nelsonnedesbrito` existe em `us-east4`, apontando para a instancia Cloud SQL `nelsonnedesbrito-fdc` e banco `fdcdb`.
- [x] Owner autorizou exclusao; apos logs sem trafego desde 2026-06-10, o servico Data Connect `nelsonnedesbrito` e a instancia Cloud SQL `nelsonnedesbrito-fdc` foram excluidos em 2026-06-16.

## Achados

1. `Cloud SQL` parece ser o principal custo atual no Console, mas nao apareceu uso direto de `mysql`, `postgres`, `cloudsql`, `sqladmin` ou conexao SQL no codigo Sisweb analisado.
2. Admin ainda carrega colecoes inteiras para montar o painel: `users`, `companies`, `subscriptionRequests` e `subscriptionPayments`.
3. `firebaseService.js` possui muitos `console.log` de producao e fallbacks REST que podem multiplicar leituras quando regras/claims falham.
4. Vendas, Estoque e Financas ainda possuem pontos com `loadFromFirebase` de colecoes grandes, especialmente `financas/receber`, `romaneios/tora`, `rastreabilidade`, `companies/{tenantId}` e listas auxiliares.
5. Ainda ha compatibilidade com logo/base64 legado em algumas telas. Isso deve permanecer so como leitura/fallback; novos uploads precisam continuar Storage-first.
6. Links de `documents` e `transactions` com o ID da conta (`/billing/010952-939008-9EF759/...`) retornaram `URL nao encontrado` no Console. As rotas funcionais sao `billing/invoices` e `billing/history`, com selecao da conta de faturamento dentro da tela.
7. Alertas operacionais `system/operationalAlerts/firebaseBilling` e `system/deployHealth/firebase` podem estar vazios em estado normal, entao nao devem gerar warning repetido no carregamento do Admin.
8. O IAM do BigQuery ficou correto para `240003261222-compute@developer.gserviceaccount.com` e `sisweb-7ce82@appspot.gserviceaccount.com`, mas a tabela exportada ainda pode vir sem linhas de custo nas primeiras horas.
9. Em 2026-06-09 existia uma instancia Cloud SQL ativa `nelsonnedesbrito-fdc`, PostgreSQL 15, `db-f1-micro`, zona `us-east4-a`, IP publico `34.150.239.62`, status `RUNNABLE`; o codigo Sisweb local nao mostrou dependencia direta dessa instancia.
10. Em 2026-06-16, `firebase dataconnect:services:list --project sisweb-7ce82` confirmou o servico Data Connect `nelsonnedesbrito`, local `us-east4`, Data Source `CloudSQL Instance: nelsonnedesbrito-fdc`, Database `fdcdb`, Schema Last Updated `2026-06-08T19:18:11.965689459Z`, sem Connector ID preenchido.
11. Embora o ambiente local nao possua `gcloud`, a checagem de logs foi feita usando a autenticacao do Firebase CLI contra as APIs Google.
12. Logs de Cloud SQL e Data Connect desde `2026-06-10T00:00:00Z` retornaram zero entradas; em seguida Data Connect e Cloud SQL foram excluidos e as listagens finais retornaram sem servicos/instancias.

## Fila recomendada

1. Criar endpoint SuperAdmin para resumos agregados de Admin em vez de carregar arvores inteiras no navegador.
2. Remover ou condicionar logs verbosos de producao a `window.__DEBUG_MODE__`.
3. Substituir leituras amplas de financeiro por caminhos mensais e indices ja existentes.
4. Manter auditoria Storage-first para logos/anexos e limpar base64 legado depois de migracao conferida.

## Evidencia

- `firebase functions:list --project sisweb-7ce82`
- `firebase dataconnect:services:list --project sisweb-7ce82` em 2026-06-16
- Cloud Logging API: zero entradas para Cloud SQL/Data Connect desde `2026-06-10T00:00:00Z`
- Exclusao 2026-06-16: Data Connect `projects/sisweb-7ce82/locations/us-east4/services/nelsonnedesbrito` e Cloud SQL `nelsonnedesbrito-fdc`
- Validacao final 2026-06-16: `firebase dataconnect:services:list --project sisweb-7ce82` sem servicos e Cloud SQL Admin API com `count: 0`
- `rg` por `cloudsql`, `mysql`, `postgres`, `sqladmin`, `setInterval`, `onValue`, `loadFromFirebase`, `getAll`, `base64`, `data:image`
- Prints do Console Billing enviados em 2026-06-09

## Arquivos

- `functions/index.js`
- `admin.html`
- `scripts/admin/admin-main.js`
- `styles/admin-premium.css`
- `tests/superadmin-google-cloud-billing.test.mjs`
- `firebaseService.js`
- `docs/runbooks/google-cloud-billing-cost-ops.md`
- `docs/stories/2026-06-08-superadmin-alerta-faturamento-firebase.md`
- `docs/stories/2026-06-09-sisweb-auditoria-custos-cloud.md`
