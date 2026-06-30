import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin assinaturas exibe cadastro, vencimento e datas reais/legadas', () => {
  const adminHtml = read('admin.html');
  const adminMain = read('scripts/admin/admin-main.js');

  assert.match(adminHtml, /<th>Cadastro<\/th>/);
  assert.match(adminHtml, /<th>Vencimento<\/th>/);
  assert.match(adminHtml, /<th>Request \/ Evento<\/th>/);
  assert.match(adminHtml, /subscriptionsTableBody[\s\S]*colspan="10"/);

  assert.match(adminMain, /function parseAdminDateValue/);
  assert.match(adminMain, /function resolveAdminSubscriptionDates/);
  assert.match(adminMain, /u\.subscriptionEndDate/);
  assert.match(adminMain, /latestPayment\.subscriptionEndDate/);
  assert.match(adminMain, /latestRequest\.subscriptionEndDate/);
  assert.match(adminMain, /tdRegistered\.textContent = formatAdminDateValue/);
  assert.match(adminMain, /tdDue\.textContent = formatAdminDueDateLabel/);
});

test('admin empresas permite complementar cadastros antigos com campos opcionais', () => {
  const adminHtml = read('admin.html');
  const adminMain = read('scripts/admin/admin-main.js');
  const functionsIndex = read('functions/index.js');
  const firebaseService = read('firebaseService.js');

  [
    'companyEditEmail',
    'companyEditResponsible',
    'companyEditZip',
    'companyEditNumber',
    'companyEditNeighborhood',
    'companyEditComplement'
  ].forEach((id) => {
    assert.match(adminHtml, new RegExp(`id="${id}"`));
    assert.match(adminMain, new RegExp(id));
  });

  assert.match(adminMain, /var COMPANY_PROFILE_FORM_FIELDS = \[/);
  assert.match(adminMain, /function getCompanyProfileFieldValue/);
  assert.match(adminMain, /function readCompanyProfileFormPayload/);
  assert.match(adminMain, /function getCompanyProfileMissingFields/);
  assert.match(adminMain, /key: "responsibleName"/);
  assert.match(adminMain, /key: "neighborhood"/);
  assert.match(adminMain, /key: "complement"/);
  assert.match(adminMain, /requiredLabel: "responsável"/);

  assert.match(functionsIndex, /function sanitizeCompanyProfileExtraPayload/);
  assert.match(functionsIndex, /stateRegistration: sanitizeText\(input\.stateRegistration/);
  assert.match(functionsIndex, /emailContato: email/);
  assert.match(functionsIndex, /responsavel: responsibleName/);
  assert.match(functionsIndex, /bairro: neighborhood/);
  assert.match(functionsIndex, /numero: number/);
  assert.match(functionsIndex, /complemento: complement/);

  assert.match(firebaseService, /const responsibleName = firstReportValue/);
  assert.match(firebaseService, /normalized\.bairro = neighborhood/);
});
