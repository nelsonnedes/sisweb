import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('backend ingere notificacoes programaticas de budget do Google Cloud Billing', () => {
  const functionsIndex = read('functions/index.js');

  assert.match(functionsIndex, /CLOUD_BILLING_BUDGET_TOPIC = 'sisweb-cloud-billing-budget-alerts'/);
  assert.match(functionsIndex, /onMessagePublished/);
  assert.match(functionsIndex, /exports\.ingestCloudBillingBudgetNotification = onMessagePublished/);
  assert.match(functionsIndex, /topic: CLOUD_BILLING_BUDGET_TOPIC/);
  assert.match(functionsIndex, /normalizeCloudBillingBudgetMessage/);
  assert.match(functionsIndex, /system\/googleCloudBilling\/budgetNotifications/);
  assert.match(functionsIndex, /system\/googleCloudBilling\/summary/);
  assert.match(functionsIndex, /system\/operationalAlerts\/firebaseBilling\/cloudBudget/);
  assert.match(functionsIndex, /CLOUD_BILLING_PROJECT_ID = 'sisweb-7ce82'/);
  assert.match(functionsIndex, /CLOUD_BILLING_OPERATIONAL_BUDGET_NAMES/);
  assert.match(functionsIndex, /firebase project sisweb-7ce82/);
  assert.match(functionsIndex, /shouldPreferIncomingBillingBudget/);
  assert.match(functionsIndex, /ignoredBudgetDisplayName/);
  assert.match(functionsIndex, /CLOUD_BILLING_BUDGETS_URL/);
  assert.match(functionsIndex, /CLOUD_BILLING_COST_BREAKDOWN_URL/);
  assert.match(functionsIndex, /CLOUD_BILLING_CUD_ANALYSIS_URL/);
  assert.match(functionsIndex, /CLOUD_BILLING_DOCUMENTS_URL/);
  assert.match(functionsIndex, /CLOUD_BILLING_TRANSACTIONS_URL/);
});

test('backend sincroniza Billing Export do BigQuery quando tabela padrao estiver pronta', () => {
  const functionsIndex = read('functions/index.js');
  const functionsPackage = read('functions/package.json');

  assert.match(functionsPackage, /"@google-cloud\/bigquery"/);
  assert.match(functionsIndex, /exports\.syncGoogleCloudBillingCostExport = onCallV2/);
  assert.match(functionsIndex, /Apenas SuperAdmin pode sincronizar custos do Google Cloud Billing/);
  assert.match(functionsIndex, /gcp_billing_export_v1_/);
  assert.match(functionsIndex, /gcp_billing_export_resource_v1_/);
  assert.match(functionsIndex, /cud_subscriptions_export/);
  assert.match(functionsIndex, /waiting_for_standard_usage_table/);
  assert.match(functionsIndex, /CLOUD_BILLING_BIGQUERY_LOCATION/);
  assert.match(functionsIndex, /bigQueryLocation/);
  assert.match(functionsIndex, /toSignedMoney/);
  assert.match(functionsIndex, /system\/googleCloudBilling\/serviceCosts/);
  assert.match(functionsIndex, /system\/googleCloudBilling\/costSeries/);
  assert.match(functionsIndex, /system\/googleCloudBilling\/exportStatus/);
  assert.match(functionsIndex, /ready_no_cost_data/);
  assert.match(functionsIndex, /billing_export_has_no_cost_rows/);
  assert.match(functionsIndex, /hasMeaningfulCostData/);
  assert.match(functionsIndex, /budgetReportedCostAmount/);
  assert.match(functionsIndex, /delete fallbackSummary\.lastBigQuerySyncAt/);
});

test('backend estima rateio de custo por companyId usando volume operacional', () => {
  const functionsIndex = read('functions/index.js');

  assert.match(functionsIndex, /exports\.estimateGoogleCloudBillingCompanyUsageCosts = onCallV2/);
  assert.match(functionsIndex, /Apenas SuperAdmin pode calcular custos por empresa/);
  assert.match(functionsIndex, /buildCompanyUsageCostRows/);
  assert.match(functionsIndex, /supportTicketsByCompany/);
  assert.match(functionsIndex, /companyUsageCostAllocation/);
  assert.match(functionsIndex, /weightedUsageUnits/);
  assert.match(functionsIndex, /estimatedCostAmount/);
});

test('sininho superadmin consome budget e resumo do Google Cloud Billing', () => {
  const menu = read('menu-component.js');

  assert.match(menu, /system\/googleCloudBilling\/summary/);
  assert.match(menu, /system\/googleCloudBilling\/budgetNotifications/);
  assert.match(menu, /admin_google_cloud_budget/);
  assert.match(menu, /Google Cloud • Orçamento/);
  assert.match(menu, /alertThresholdExceeded/);
  assert.match(menu, /forecastThresholdExceeded/);
  assert.match(menu, /https:\/\/console\.cloud\.google\.com\/billing\/budgets\?project=sisweb-7ce82/);
});

test('dashboard superadmin exibe billing, faturas e consumo sem inventar valores', () => {
  const adminHtml = read('admin.html');
  const adminMain = read('scripts/admin/admin-main.js');
  const adminCss = read('styles/admin-premium.css');

  assert.match(adminHtml, /Google Cloud Billing/);
  assert.match(adminHtml, /id="gcpBillingStatus"/);
  assert.match(adminHtml, /id="gcpBillingUsageChart"/);
  assert.match(adminHtml, /id="gcpBillingSyncBigQuery"/);
  assert.match(adminHtml, /id="gcpBillingServiceCostsBody"/);
  assert.match(adminHtml, /Rateio por empresa/);
  assert.match(adminHtml, /id="gcpBillingSyncCompanyUsageCosts"/);
  assert.match(adminHtml, /id="gcpBillingCompanyCostsBody"/);
  assert.match(adminHtml, /id="gcpBillingInvoicesBody"/);
  assert.match(adminHtml, /https:\/\/console\.cloud\.google\.com\/billing\/linkedaccount\?project=sisweb-7ce82/);
  assert.match(adminHtml, /https:\/\/console\.cloud\.google\.com\/billing\/export\?project=sisweb-7ce82/);
  assert.match(adminHtml, /https:\/\/console\.cloud\.google\.com\/billing\/010952-939008-9EF759\/reports\/cost-breakdown\?organizationId=0/);
  assert.match(adminHtml, /commitments\/analysis;timeRange=LAST_30_DAYS/);
  assert.match(adminHtml, /https:\/\/console\.cloud\.google\.com\/billing\/invoices/);
  assert.match(adminHtml, /https:\/\/console\.cloud\.google\.com\/billing\/history/);

  assert.match(adminMain, /loadGoogleCloudBillingSummary/);
  assert.match(adminMain, /system\/googleCloudBilling/);
  assert.match(adminMain, /renderGoogleCloudBillingDashboard/);
  assert.match(adminMain, /renderGoogleCloudBillingInvoices/);
  assert.match(adminMain, /renderGoogleCloudBillingUsageChart/);
  assert.match(adminMain, /renderGoogleCloudBillingServiceCosts/);
  assert.match(adminMain, /renderGoogleCloudBillingCompanyCosts/);
  assert.match(adminMain, /syncGoogleCloudBillingCostExportFromAdmin/);
  assert.match(adminMain, /syncGoogleCloudBillingCostExport/);
  assert.match(adminMain, /noCostData/);
  assert.match(adminMain, /Mantive o valor do Budget/);
  assert.match(adminMain, /syncGoogleCloudBillingCompanyUsageCostsFromAdmin/);
  assert.match(adminMain, /estimateGoogleCloudBillingCompanyUsageCosts/);
  assert.match(adminMain, /escapeHtml\(url\)/);

  assert.match(adminCss, /\.cloud-billing-section/);
  assert.match(adminCss, /\.billing-header-actions/);
  assert.match(adminCss, /\.billing-table-actions/);
  assert.match(adminCss, /\.billing-company-share/);
  assert.match(adminCss, /\.billing-progress/);
  assert.match(adminCss, /\.billing-usage-chart/);
});

test('servico firebase trata caminhos operacionais vazios do admin como esperados', () => {
  const firebaseService = read('firebaseService.js');

  assert.match(firebaseService, /system\/operationalAlerts\/firebaseBilling/);
  assert.match(firebaseService, /system\/deployHealth\/firebase/);
});
