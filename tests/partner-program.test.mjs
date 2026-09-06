import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(new URL('../functions/partner-functions.js', import.meta.url));
const partner = require('../functions/partner-functions.js');
const indexSrc = readFileSync('functions/index.js', 'utf8');
const rules = JSON.parse(readFileSync('database.rules.json', 'utf8'));

test('helpers puros do programa de parceiros', () => {
  assert.equal(partner.normalizePartnerCode(' par-ab12 '), 'PAR-AB12');
  assert.equal(partner.isValidPartnerCode('PAR-AB12'), true);
  assert.equal(partner.isValidPartnerCode('XXX-123'), false);
  assert.match(partner.generatePartnerCode(), /^PAR-[A-Z0-9]{4}$/);
  assert.equal(partner.clampCommissionPercent(10), 10);
  assert.equal(partner.clampCommissionPercent(41), null);
  assert.equal(partner.clampCommissionPercent('x'), null);
  assert.equal(partner.computeCommission(100, 10), 10);
  assert.equal(partner.computeCommission(0, 10), 0);
});

test('functions/index.js registra parceiros e ganchos aditivos', () => {
  for (const name of [
    'registerPartner',
    'validatePartnerCode',
    'linkPartnerReferral',
    'getMyPartnerDashboard',
    'sendBillingReminder',
    'getPartnersAdmin',
    'getPartnerDetailAdmin',
    'setPartnerConfig',
    'markCommissionPaid',
    'adminLinkReferral'
  ]) {
    assert.match(indexSrc, new RegExp(`exports\\.${name} = partnerFunctions\\.${name}`), `export ausente: ${name}`);
  }
  assert.match(indexSrc, /partnerFunctions\.configure\(\{ isCallerSuperAdmin \}\)/);
  assert.match(indexSrc, /partnerCodeRaw/);
  assert.match(indexSrc, /resolvePartnerLink/);
  assert.match(indexSrc, /recordPartnerCommissionEarned/);
  assert.match(indexSrc, /pendingPayment\.partnerId = partner\.id/);
});

test('partner-functions usa namespace v1 (data, context)', () => {
  const raw = readFileSync('functions/partner-functions.js', 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  assert.match(src, /require\('firebase-functions\/v1'\)/);
  assert.doesNotMatch(src, /require\('firebase-functions'\)/);
});

test('database.rules.json bloqueia nos de parceiros no client', () => {
  for (const node of ['campaignPartners', 'campaignPartnerCodes', 'campaignReferrals', 'campaignCommissions', 'campaignReminderLog']) {
    assert.equal(rules.rules[node]['.read'], 'auth != null && auth.token.superadmin == true', node);
    assert.equal(rules.rules[node]['.write'], 'auth != null && auth.token.superadmin == true', node);
  }
  assert.equal(rules.rules.partnerSignupAttempts['.read'], false);
  assert.equal(rules.rules.partnerSignupAttempts['.write'], false);
  assert.match(rules.rules.companies.$companyId.partnerReminders['.write'], /superadmin/);
  assert.match(rules.rules.companies.$companyId.partnerReminders['.read'], /companies\/.*users/);
});

test('admin expoe aba Parceiros com detalhe e ledger', () => {
  const admin = readFileSync('admin.html', 'utf8');
  assert.match(admin, /id="tab-partners"/);
  assert.match(admin, /id="partnersBody"/);
  assert.match(admin, /id="partnerCommissionsBody"/);
  const main = readFileSync('scripts/admin/admin-main.js', 'utf8');
  assert.match(main, /Marcar pago/);
  assert.match(main, /key:"partners",label:"Parceiros"/);
  assert.match(main, /allowedTabs\.push\("partners"\)/);
  assert.match(main, /async function loadPartnersPanel\(\)/);
  assert.match(main, /async function openPartnerDetail\(/);
  assert.match(main, /async function markPartnerCommissionPaid\(/);
});

test('portal do parceiro usa backend e expoe painel proprio', () => {
  const portal = readFileSync('cadastro-parceiro.html', 'utf8');
  assert.match(portal, /registerPartner/);
  assert.match(portal, /getMyPartnerDashboard/);
  assert.match(portal, /sendBillingReminder/);
  assert.match(portal, /parDashCompanies/);
  assert.match(portal, /parDashCommissions/);
  assert.doesNotMatch(portal, /Math\.random\(\)\.toString\(36\)/);
  assert.match(portal, /@media \(max-width:\s?640px\)/);
  assert.match(portal, /prefers-reduced-motion/);
  assert.match(portal, /representantes, vendedores, clientes, parceiros/);
  assert.match(portal, /par-whatsapp-float/);
  assert.match(portal, /wa\.me\/5591991311049/);
  assert.match(portal, /aria-label="Conversar sobre o Programa de Parceiros no WhatsApp"/);
  assert.match(portal, /async function isPartnerSessionActive\(\)/);
  assert.match(portal, /function parceiroValidationField\(/);
  assert.match(portal, /par-field-error/);
  assert.match(portal, /await isPartnerSessionActive\(\)/);
});

test('vitrine do iphone usa capturas mobile reais', () => {
  const landing = readFileSync('landing-vendas.html', 'utf8');
  assert.match(landing, /romaneiotora-overview-mobile\.png/);
  assert.match(landing, /notas-fiscais-overview-mobile\.png/);
  const css = readFileSync('landing-vendas.css', 'utf8');
  assert.match(css, /aspect-ratio:\s?9\/19\.5/);
  const hosting = JSON.parse(readFileSync('hosting-files.json', 'utf8'));
  const files = Array.isArray(hosting) ? hosting : hosting.files || [];
  for (const img of ['assets/help-manual/romaneiotora-overview-mobile.png', 'assets/help-manual/financas-overview-mobile.png', 'assets/help-manual/notas-fiscais-overview-mobile.png']) {
    assert.ok(files.includes(img), `manifesto sem: ${img}`);
  }
});

test('landing vitrine exibe carrosseis iphone e desktop com telas reais', () => {
  const landing = readFileSync('landing-vendas.html', 'utf8');
  assert.match(landing, /id="vitrine"/);
  assert.match(landing, /id="lv-phone-carousel"/);
  assert.match(landing, /id="lv-desk-carousel"/);
  assert.match(landing, /assets\/help-manual\//);
  const css = readFileSync('landing-vendas.css', 'utf8');
  assert.match(css, /lv-carousel/);
  const js = readFileSync('landing-vendas.js', 'utf8');
  assert.match(js, /initCarousel\('lv-phone-carousel'\)/);
  assert.match(js, /initCarousel\('lv-desk-carousel'\)/);
  assert.match(landing, /id="lv-hero-carousel"/);
  assert.match(landing, /index-overview\.png/);
  assert.match(js, /initCarousel\('lv-hero-carousel'\)/);
});

test('caixa de parceiro da assinatura tem estilo proprio e responsivo', () => {
  const sub = readFileSync('subscription.html', 'utf8');
  assert.match(sub, /class="partner-row"/);
  assert.match(sub, /#partnerCodeBox \{[\s\S]*?border-left: 4px solid/);
  assert.match(sub, /@media \(max-width: 480px\)/);
});

test('frontend expoe contrato de parceiros sem write direto', () => {
  const svc = readFileSync('firebaseService.js', 'utf8');
  for (const name of ['registerPartner', 'validatePartnerCode', 'linkPartnerReferral', 'getMyPartnerDashboard', 'sendBillingReminder', 'getPartnersAdmin', 'getPartnerDetailAdmin', 'setPartnerConfig', 'markCommissionPaid', 'adminLinkReferral']) {
    assert.match(svc, new RegExp(`async function ${name}\\(`), `wrapper ausente: ${name}`);
  }
  const sub = readFileSync('subscription.html', 'utf8');
  assert.match(sub, /id="partnerCode"/);
  assert.match(sub, /partnerCode: partnerCodeInput/);
  assert.match(sub, /sisweb_pending_partner/);
  const menu = readFileSync('menu-component.js', 'utf8');
  assert.match(menu, /partnerReminders/);
  assert.match(menu, /Cobrança do parceiro/);
  assert.match(menu, /subscription-status\.html/);
});

test('admin sem window.prompt: modal inline de nota de pagamento', () => {
  const main = readFileSync('scripts/admin/admin-main.js', 'utf8');
  const admin = readFileSync('admin.html', 'utf8');
  assert.doesNotMatch(main, /window\.prompt/);
  assert.match(main, /async function markPartnerCommissionPaid\(/);
  assert.match(main, /openCommissionPaidModal/);
  assert.match(main, /closeCommissionPaidModal/);
  assert.match(main, /submitCommissionPaidModal/);
  assert.match(main, /commissionPaidNote/);
  assert.match(main, /commissionPaidCount/);
  assert.match(main, /Escape/);
  assert.match(main, /\.focus\(\)/);
  assert.match(admin, /id="commissionPaidModal"/);
  assert.match(admin, /id="commissionPaidNote"/);
  assert.match(admin, /id="commissionPaidCount"/);
  assert.match(admin, /id="commissionPaidConfirmBtn"/);
  assert.match(admin, /id="commissionPaidCancelBtn"/);
  assert.match(admin, /modal-overlay/);
  assert.match(admin, /maxlength="280"/);
});

test('portal sem window.prompt: modal inline de recado de cobranca', () => {
  const portal = readFileSync('cadastro-parceiro.html', 'utf8');
  assert.doesNotMatch(portal, /window\.prompt/);
  assert.match(portal, /async function sendPartnerReminder\(/);
  assert.match(portal, /id="parReminderModal"/);
  assert.match(portal, /id="parReminderText"/);
  assert.match(portal, /id="parReminderCount"/);
  assert.match(portal, /id="parReminderConfirm"/);
  assert.match(portal, /id="parReminderCancel"/);
  assert.match(portal, /openPartnerReminderModal/);
  assert.match(portal, /closePartnerReminderModal/);
  assert.match(portal, /submitPartnerReminderModal/);
  assert.match(portal, /maxlength="280"/);
  assert.match(portal, /Escape/);
  assert.match(portal, /lv-btn/);
});

test('portal mapeia erros do backend para PT-BR claro', () => {
  const portal = readFileSync('cadastro-parceiro.html', 'utf8');
  assert.match(portal, /function parceiroFriendlyError\(/);
  assert.match(portal, /Serviço indisponível no momento\. Tente novamente em instantes\./);
  assert.match(portal, /Limite de uso atingido/);
  assert.match(portal, /Código inválido/);
  assert.match(portal, /parceiroFriendlyError\(err/);
  assert.doesNotMatch(portal, /msg\.textContent = \(err && err\.message\) \|\| 'Erro ao enviar alerta\.'/);
});

test('admin pagina tabela de parceiros em 20 itens com filtros resetando', () => {
  const main = readFileSync('scripts/admin/admin-main.js', 'utf8');
  const admin = readFileSync('admin.html', 'utf8');
  assert.match(main, /partners: \{ page: 0, size: 20 \}/);
  assert.match(main, /paginateAdminList\(list, adminPaginationState\.partners\)/);
  assert.match(main, /renderAdminPaginationControls\("partnersPagination"/);
  assert.match(main, /Página /);
  assert.match(admin, /id="partnersPagination"/);
});

test('trial gratuito vincula indicacao por codigo de parceiro', () => {
  assert.match(indexSrc, /trialPartnerCode/);
  assert.match(indexSrc, /source: 'free_trial'/);
  assert.match(indexSrc, /ensureReferral\(\{[\s\S]*?uid,[\s\S]*?partnerId: trialPartner\.id/);
  const svc = readFileSync('firebaseService.js', 'utf8');
  assert.match(svc, /async function activateFreeTrial\(payload\)/);
  const sub = readFileSync('subscription.html', 'utf8');
  assert.match(sub, /freePartnerCode/);
  assert.match(sub, /activateFreeTrial\(\{[\s\S]*?partnerCode:/);
});

test('projecoes das 3 proximas comissoes sao calculadas sem criar ledger', () => {
  assert.equal(partner.planPeriodMonths('quarterly'), 3);
  assert.equal(partner.planPeriodMonths('premium'), 12);
  assert.equal(partner.planPeriodMonths('free_trial'), 1);
  assert.equal(partner.resolveEffectivePercent({ commissionPercent: null }, { campaign: { referral: { commissionPercentForReferrer: 10 } } }), 10);
  assert.equal(partner.resolveEffectivePercent({ commissionPercent: 7 }, { campaign: { referral: { commissionPercentForReferrer: 10 } } }), 7);
  const projs = partner.buildProjections({
    planKey: 'free_trial',
    endDateIso: '2026-10-06T00:00:00.000Z',
    settings: { plans: { monthly: { amount: 19.9 } } },
    percent: 10
  });
  assert.equal(projs.length, 3);
  assert.ok(projs.every((p) => p.projected === true && p.assumedPlan === true));
  assert.equal(projs[0].commission, 1.99);
  assert.equal(projs[1].dueDate.slice(0, 7), '2026-11');
  assert.deepEqual(partner.buildProjections({ planKey: 'monthly', endDateIso: '', settings: { plans: { monthly: { amount: 19.9 } } }, percent: 0 }), []);
  const portal = readFileSync('cadastro-parceiro.html', 'utf8');
  assert.match(portal, /id="parDashProjections"/);
  const admin = readFileSync('admin.html', 'utf8');
  assert.match(admin, /id="partnerProjectionsBody"/);
  const main = readFileSync('scripts/admin/admin-main.js', 'utf8');
  assert.match(main, /function renderPartnerProjections\(companies\)/);
});

test('admin vincula indicacao manualmente por email ou uid', () => {
  assert.match(indexSrc, /exports\.adminLinkReferral = partnerFunctions\.adminLinkReferral/);
  const svc = readFileSync('firebaseService.js', 'utf8');
  assert.match(svc, /async function adminLinkReferral\(payload\)/);
  const admin = readFileSync('admin.html', 'utf8');
  assert.match(admin, /id="partnerLinkIdentity"/);
  assert.match(admin, /id="partnerLinkBtn"/);
  const main = readFileSync('scripts/admin/admin-main.js', 'utf8');
  assert.match(main, /async function adminLinkReferralFlow\(\)/);
});
