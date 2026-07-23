# Story: Auditoria de custos Cloud e uso operacional Sisweb

Data: 2026-06-09

Status: Ready for Review

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

## Hardening e reducao de custos - 2026-07-14

- [x] Hosting deixou de publicar a raiz do repositorio e passou a usar `hosting-dist`, gerado por allowlist de 446 arquivos.
- [x] Versoes antigas do Hosting que expunham arquivos internos foram removidas; retencao do canal `live` reduzida de 50 para 10 releases.
- [x] Varredura completa do historico Git com Gitleaks confirmou apenas chaves Web Firebase publicas e falsos positivos; as tres chaves Web foram restringidas por dominio/API e os alertas GitHub foram encerrados sem expor valores.
- [x] Backup Firestore concluido em `gs://sisweb-7ce82-firestore-backup-sae1/firestore-decommission-20260714`, com lifecycle de 30 dias e soft delete de 7 dias.
- [x] PITR desativado, banco Firestore vazio removido e APIs Firestore, Key Visualizer, Data Connect, Vertex AI e SQL Admin desativadas.
- [x] `datastore.googleapis.com` e `sql-component.googleapis.com` foram mantidas porque a plataforma reportou dependencias ativas; nenhuma desativacao forcada foi executada.
- [x] Configuracao local de Firestore/Data Connect removida e rotas ativas deixaram de inicializar o SDK Firestore sem uso.
- [x] Historico de notificacoes de Billing foi respaldado em `D:\Sisweb-cloud-billing-budgetNotifications-20260714-133547.json` e reduzido de 2.059 para 200 registros.
- [x] Function de Billing passou a deduplicar eventos, manter agregado por budget e podar automaticamente o historico acima de 200 registros.
- [x] Menu e dashboard SuperAdmin deixaram de carregar a arvore completa de notificacoes; o painel consulta no maximo 50 eventos recentes e agrega leituras isoladamente.
- [x] Artifact Registry `gcf-artifacts` foi mantido por sustentar Cloud Functions em producao; a policy gerenciada `firebase-functions-cleanup` ja remove artefatos antigos.
- [x] Rules, Function e Hosting publicados; versao final do Hosting `2f04bcbb871c9881` validada com rotas criticas em HTTP 200 e caminhos internos em HTTP 404.
- [x] Quality gates finais: lint, typecheck, lint das Functions, build do Hosting e 193 testes aprovados.

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
13. O Hosting antigo servia a raiz do repositorio e permitia acesso publico ao historico `.git`; a entrega por allowlist eliminou esse vetor.
14. `budgetNotifications` acumulava mais de duas mil entradas e era lido integralmente pelo menu e pelo Admin, aumentando armazenamento e transferencia sem ganho operacional.
15. As referencias Firestore alcancaveis em `company.html` e `romaneiotora.html` carregavam apenas o SDK; nao havia leitura/escrita, e o export do banco confirmou ausencia de dados.

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
- `gcloud services list --enabled --project=sisweb-7ce82` em 2026-07-14: APIs Firestore, Data Connect, Vertex AI e SQL Admin ausentes; APIs dependentes mantidas sem `--force`.
- `firebase functions:list --project sisweb-7ce82`: `ingestCloudBillingBudgetNotification` ACTIVE, Node.js 22, 2nd Gen.
- `firebase hosting:channel:list --site sisweb-7ce82`: versao `2f04bcbb871c9881`, FINALIZED, retencao 10.
- Backup das notificacoes: 2.059 registros, 1.137.066 bytes, SHA-256 `DBE856DA3BA0783E6FBF9F89E50505994E77DE9F0BEE2A94F424723DE97C7F27`.
- Smoke HTTP: `/`, `/company.html`, `/romaneiotora.html`, `/admin.html`, `/firebaseService.js` e `/scripts/admin/admin-main.js` em 200; `.git`, `.claude`, Data Connect e service account em 404.
- `npm run lint`, `npm run typecheck`, `npm --prefix functions run lint`, `npm test` e `npm run build:hosting` aprovados.
- `rg` por `cloudsql`, `mysql`, `postgres`, `sqladmin`, `setInterval`, `onValue`, `loadFromFirebase`, `getAll`, `base64`, `data:image`
- Prints do Console Billing enviados em 2026-06-09

## Arquivos

- `functions/index.js`
- `.gitignore`
- `firebase.json`
- `hosting-files.json`
- `scripts/build-hosting.mjs`
- `database.rules.json`
- `admin.html`
- `scripts/admin/admin-main.js`
- `menu-component.js`
- `company.html`
- `romaneiotora.html`
- `src/services/firebaseService.js`
- `styles/admin-premium.css`
- `tests/superadmin-google-cloud-billing.test.mjs`
- `tests/global-first-wave.test.mjs`
- `firebaseService.js`
- `dataconnect/dataconnect.yaml` (removido)
- `dataconnect/schema/schema.gql` (removido)
- `docs/runbooks/google-cloud-billing-cost-ops.md`
- `docs/stories/2026-06-08-superadmin-alerta-faturamento-firebase.md`
- `docs/stories/2026-06-09-sisweb-auditoria-custos-cloud.md`
