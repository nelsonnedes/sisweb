# Story: Alerta operacional de faturamento Firebase no SuperAdmin

Data: 2026-06-08

## Contexto

O deploy de Cloud Functions pode ser bloqueado quando a conta de faturamento do projeto Firebase/Google Cloud fica com fatura em aberto, em atraso ou sem write access. O erro observado foi:

- `CloudFunctionsService.GenerateUploadUrl`
- `Write access to project 'sisweb-7ce82' was denied: please check billing account associated and retry`

## Implementado

- [x] Sininho do menu calcula alerta operacional apenas para SuperAdmin.
- [x] Alerta reconhece status persistido em `system/operationalAlerts/firebaseBilling`.
- [x] Alerta reconhece status persistido em `system/deployHealth/firebase`.
- [x] Alerta reconhece erro local em `sisweb_admin_deploy_last_error` e chaves equivalentes.
- [x] Mensagem direciona para o painel de faturamento do projeto `sisweb-7ce82`.
- [x] Hover no sininho abre o painel de alertas em desktop sem alterar comportamento por toque no PWA/mobile.
- [x] Links externos dos alertas abrem em nova aba com `noopener noreferrer`.
- [x] API local `window.SiswebAdminOperationalAlerts.recordFirebaseBillingError(...)` disponível para rotinas administrativas registrarem o erro.
- [x] Versão PWA atualizada para forçar atualização do service worker.
- [x] Function `ingestCloudBillingBudgetNotification` para receber notificações programáticas do Cloud Billing Budget via Pub/Sub.
- [x] Persistência de resumo e histórico em `system/googleCloudBilling`.
- [x] Dashboard SuperAdmin com KPIs de consumo, orçamento, vencimento, última notificação e tabela de faturas.
- [x] Base visual para gráfico de consumo usando série exportada/importada de custos.
- [x] Inventário do projeto analisado em `sisweb-inventario-sisweb-7ce82-20260609-112308.tar.gz`.
- [x] Correção de `databaseURL` no Admin SDK para o RTDB regional `sisweb-7ce82-default-rtdb.asia-southeast1.firebasedatabase.app`, evitando falha da ingestão Pub/Sub ao gravar alertas.
- [x] Runbook operacional criado para ativar Cloud Billing export no BigQuery, consultar custo por servico/SKU, revisar logs de `Permission denied`, validar budget Pub/Sub e aplicar limpeza de Artifact Registry em dry-run.
- [x] Sincronizacao manual SuperAdmin do BigQuery Billing Export preparada para gravar custo por servico/SKU em `system/googleCloudBilling` quando a tabela padrao aparecer.
- [x] Dashboard Admin passou a exibir tabela de custo por servico/SKU e botao manual de sincronizacao BigQuery.
- [x] Budget `Firebase Project sisweb-7ce82` conferido como operacional: escopo do projeto `sisweb-7ce82`, valor R$ 300, limites 50/90/100 e Pub/Sub `projects/sisweb-7ce82/topics/sisweb-cloud-billing-budget-alerts`.
- [x] `Orçamento Sisweb` antigo removido no Console para evitar divergencia com o budget operacional.
- [x] Backend ajustado para tratar apenas `Firebase Project sisweb-7ce82` como budget operacional do sininho.
- [x] Atalho do detalhamento de custos do Console Billing adicionado ao dashboard Admin.
- [x] Atalhos de documentos de faturamento e transações/comprovantes adicionados ao dashboard Admin.
- [x] Rateio estimado por `companyId` preparado no Admin com base em volume operacional por empresa.

## Evidência

- `node --check menu-component.js`
- `node --check sw.js`
- `node --check functions/index.js`
- `node --check scripts/admin/admin-main.js`
- `node --test tests/pwa-mobile-menu-session.test.mjs tests/admin-support-ui.test.mjs tests/company-logo-storage-policy.test.mjs`
- `node --test tests/superadmin-google-cloud-billing.test.mjs`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `firebase deploy --only "functions:getCompanyLogoDataUrl,functions:ingestCloudBillingBudgetNotification" --project sisweb-7ce82`

## Arquivos

- `menu-component.js`
- `sw.js`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/superadmin-google-cloud-billing.test.mjs`
- `functions/index.js`
- `admin.html`
- `scripts/admin/admin-main.js`
- `styles/admin-premium.css`
- `docs/stories/2026-06-08-superadmin-alerta-faturamento-firebase.md`
- `docs/runbooks/google-cloud-billing-cost-ops.md`
- `functions/package.json`
- `functions/package-lock.json`
