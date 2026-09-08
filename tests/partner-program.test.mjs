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
    'claimPartnerAccount',
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

test('claimPartnerAccount usa identidade autenticada e claim atômico', () => {
  const source = readFileSync('functions/partner-functions.js', 'utf8');
  const claim = source.slice(source.indexOf('exports.claimPartnerAccount'), source.indexOf('// ─── 3)'));
  assert.match(claim, /context\.auth\.uid/);
  assert.match(claim, /token\.email/);
  assert.match(claim, /token\.email_verified !== true/);
  assert.match(claim, /status !== 'active'/);
  assert.match(claim, /partnerRef\.transaction\(/);
  assert.match(claim, /currentOwnerUid && currentOwnerUid !== uid/);
  assert.match(claim, /ownerUid: uid/);
  assert.match(claim, /capabilities: \{ dashboard: true, messaging: true \}/);
  assert.doesNotMatch(claim, /payload\.(ownerUid|email|partnerId|companyId)/);
  assert.equal(typeof partner.claimPartnerAccount, 'function');
  assert.equal(typeof partner.findPartnerForCaller, 'function');
});

test('lookup do caller é somente leitura e exige parceiro ativo', () => {
  const source = readFileSync('functions/partner-functions.js', 'utf8');
  const lookup = source.slice(source.indexOf('async function findPartnerForCaller'), source.indexOf('exports.getMyPartnerDashboard'));
  assert.match(lookup, /email_verified !== true/);
  assert.match(lookup, /status !== 'active'/);
  assert.doesNotMatch(lookup, /\.update\(/);
  assert.doesNotMatch(lookup, /ownerUid:\s*uid/);
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

test('portal independente possui estados, ativação e dashboard autenticado', () => {
  const portal = readFileSync('portal-parceiro.html', 'utf8');
  for (const id of ['partnerVisitor', 'partnerActivation', 'partnerDashboard', 'partnerRestricted', 'partnerNoPartner']) {
    assert.match(portal, new RegExp(`id="${id}"`), `estado ausente: ${id}`);
  }
  assert.match(portal, /claimPartnerAccount/);
  assert.match(portal, /getMyPartnerDashboard/);
  assert.match(portal, /if\(!currentUser\|\|!activePartner\)return/);
  assert.match(portal, /emailVerified/);
  assert.match(portal, /bloquead/);
  assert.match(portal, /pendent/);
  assert.match(portal, /not-a-partner/);
  assert.doesNotMatch(portal, /company\.html/);
  assert.match(portal, /@media\(max-width:720px\)/);
  assert.match(portal, /prefers-reduced-motion/);
  assert.match(portal, /Dados carregados somente para a conta autenticada/);
});

test('cadastro permanece público e encaminha para o portal sem carregar dashboard', () => {
  const cadastro = readFileSync('cadastro-parceiro.html', 'utf8');
  assert.match(cadastro, /registerPartner/);
  assert.match(cadastro, /href="portal-parceiro\.html"/);
  assert.doesNotMatch(cadastro, /getMyPartnerDashboard/);
  assert.doesNotMatch(cadastro, /sendBillingReminder/);
  assert.match(cadastro, /representantes, vendedores, clientes, parceiros/);
});

test('login preserva rota do portal e não aplica redirecionamento empresarial', () => {
  const login = readFileSync('login.html', 'utf8');
  const auth = readFileSync('auth.js', 'utf8');
  const hosting = JSON.parse(readFileSync('hosting-files.json', 'utf8'));
  assert.match(login, /requestedPathname === 'portal-parceiro\.html'/);
  assert.doesNotMatch(login, /requestedIsPartnerPortal = String\(requested[^)]*\)\.toLowerCase\(\)\.includes\('portal-parceiro\.html'\)/);
  assert.match(auth, /function isPartnerPortalTarget\(value\)/);
  assert.match(auth, /raw === 'portal-parceiro\.html'/);
  assert.doesNotMatch(auth, /lowerRequested\.includes\('portal-parceiro\.html'\)/);
  assert.ok(hosting.includes('portal-parceiro.html'));
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

test('landing direciona o painel do parceiro para login autenticado', () => {
  const landing = readFileSync('landing-vendas.html', 'utf8');
  assert.match(landing, /href="https:\/\/sisweb-7ce82\.web\.app\/portal-parceiro\.html"[^>]*>.*Meu painel do Parceiro/);
  assert.match(landing, /href="https:\/\/sisweb-7ce82\.web\.app\/portal-parceiro\.html"[^>]*>.*Acessar meu Painel/);
  assert.match(landing, /id="lv-hero-phone-carousel"/);
  assert.match(landing, /id="lv-hero-phone-carousel"[\s\S]*assets\/help-manual\/index-mobile\.png/);
  assert.match(readFileSync('landing-vendas.js', 'utf8'), /initCarousel\('lv-hero-phone-carousel'\)/);
});

test('caixa de parceiro da assinatura tem estilo proprio e responsivo', () => {
  const sub = readFileSync('subscription.html', 'utf8');
  assert.match(sub, /class="partner-row"/);
  assert.match(sub, /#partnerCodeBox \{[\s\S]*?border-left: 4px solid/);
  assert.match(sub, /@media \(max-width: 480px\)/);
});

test('frontend expoe contrato de parceiros sem write direto', () => {
  const svc = readFileSync('firebaseService.js', 'utf8');
  for (const name of ['registerPartner', 'validatePartnerCode', 'claimPartnerAccount', 'linkPartnerReferral', 'getMyPartnerDashboard', 'sendBillingReminder', 'getPartnersAdmin', 'getPartnerDetailAdmin', 'setPartnerConfig', 'markCommissionPaid', 'adminLinkReferral']) {
    assert.match(svc, new RegExp(`async function ${name}\\(`), `wrapper ausente: ${name}`);
  }
  const authCallableGuard = svc.slice(svc.indexOf('function requiresAuthenticatedCallable'), svc.indexOf('async function getCallableIdToken'));
  assert.match(authCallableGuard, /validatePartnerCode/);
  assert.match(authCallableGuard, /claimPartnerAccount/);
  assert.match(authCallableGuard, /getMyPartnerDashboard/);
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

test('portal não usa prompt nem autoriza dashboard antes do claim', () => {
  const portal = readFileSync('portal-parceiro.html', 'utf8');
  assert.doesNotMatch(portal, /window\.prompt/);
  assert.match(portal, /async function claim\(\)/);
  assert.match(portal, /activePartner=true/);
  assert.match(portal, /await loadDashboard\(\)/);
});

test('portal mapeia erros do backend para PT-BR claro', () => {
  const portal = readFileSync('portal-parceiro.html', 'utf8');
  assert.match(portal, /function friendlyError\(/);
  assert.match(portal, /Acesso bloqueado/);
  assert.match(portal, /Cadastro pendente/);
  assert.match(portal, /Acesso já reivindicado/);
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
  const portal = readFileSync('portal-parceiro.html', 'utf8');
  assert.match(portal, /id="partnerDashboard"/);
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

test('cadastro duplicado nao expoe codigo nem partnerId', () => {
  const src = readFileSync('functions/partner-functions.js', 'utf8');
  const block = src.slice(src.indexOf('Dedupe por e-mail'), src.indexOf('// Gera código único'));
  assert.match(block, /return \{ success: true, already: true \}/);
  assert.doesNotMatch(block, /code/);
  assert.doesNotMatch(block, /partnerId/);
});

test('portal exibe projecoes, cobranca por clientRef e reload com token', () => {
  const portal = readFileSync('portal-parceiro.html', 'utf8');
  assert.match(portal, /id="partnerProjections"/);
  assert.match(portal, /data-remind/);
  assert.match(portal, /clientRef/);
  assert.match(portal, /id="partnerReminderModal"/);
  assert.match(portal, /sendBillingReminder\(\{clientRef:/);
  assert.match(portal, /currentUser\.reload/);
  assert.match(portal, /getIdToken\(true\)/);
  assert.match(portal, /async function refreshSession/);
  assert.match(portal, /Ainda não confirmado/);
  assert.match(portal, /Reenviar confirmação/);
  assert.match(portal, /sendVerificationEmail/);
  assert.doesNotMatch(portal, /currentUser\.sendEmailVerification/);
  assert.doesNotMatch(portal, /sendBillingReminder\(\{companyId:/);
});

test('codigo proprio nao gera vinculo nem comissao', () => {
  assert.match(indexSrc, /Anti-autoindica[^:]*: código próprio/);
  assert.match(indexSrc, /const ownCode = partner && \(String\(partner\.ownerUid/);
  const funcSrc = readFileSync('functions/partner-functions.js', 'utf8');
  assert.match(funcSrc, /reason: 'self-referral'/);
  assert.match(funcSrc, /riskFlags\.push\('phone-match'\)/);
  assert.match(funcSrc, /own: !!own/);
});

test('registro orienta tipo de conta e codigo proprio', () => {
  const login = readFileSync('login.html', 'utf8');
  assert.match(login, /id="regAccountType"/);
  assert.match(login, /Apenas Parceiro/);
  assert.match(login, /Ambos \(usar o sistema e indicar\)/);
  assert.match(login, /function updateRegAccountTypeUI\(\)/);
  assert.match(login, /será recusado na assinatura/);
  assert.match(login, /landing-vendas\.html#cupons/);
  assert.match(login, /regAccountType !== 'partner'/);
});

test('assinatura bloqueia codigo proprio com aviso de cupom', () => {
  const sub = readFileSync('subscription.html', 'utf8');
  assert.match(sub, /Este código é seu e não pode gerar indicação/);
  assert.match(sub, /own === true/);
  assert.match(sub, /cupom promocional ativo/);
});

test('landing exibe cupons ativos com fallback silencioso', () => {
  const landing = readFileSync('landing-vendas.html', 'utf8');
  assert.match(landing, /id="cupons"/);
  assert.match(landing, /id="lv-coupon-list"/);
  assert.match(landing, /href="#cupons">Cupons/);
  const css = readFileSync('landing-vendas.css', 'utf8');
  assert.match(css, /lv-coupon-card/);
  const js = readFileSync('landing-vendas.js', 'utf8');
  assert.match(js, /listActivePromoCodes/);
  assert.match(js, /subscription\.html\?cupom=/);
});

test('endpoint publico de cupons expoe so vitrine', () => {
  const start = indexSrc.indexOf('exports.listActivePromoCodes');
  assert.notEqual(start, -1);
  const block = indexSrc.slice(start, indexSrc.indexOf('NF-e CLOUD FUNCTIONS', start));
  assert.match(block, /discountText/);
  assert.match(block, /allowedPlans/);
  assert.doesNotMatch(block, /createdBy/);
  assert.doesNotMatch(block, /assertSuperAdmin/);
  assert.match(block, /out\.push\(\{\s*code,\s*type,\s*value,\s*expiresAt:[^}]*allowedPlans,[^}]*discountText/s);
  const svc = readFileSync('firebaseService.js', 'utf8');
  assert.match(svc, /async function listActivePromoCodes\(\)/);
});

test('admin sinaliza risco de mesmo telefone no ledger', () => {
  const main = readFileSync('scripts/admin/admin-main.js', 'utf8');
  assert.match(main, /mesmo telefone/);
  assert.match(main, /riskFlags/);
});

test('roteamento identifica conta so-parceiro sem tocar fluxo cliente', () => {
  assert.match(indexSrc, /exports\.getMyPartnerStatus = partnerFunctions\.getMyPartnerStatus/);
  const funcSrc = readFileSync('functions/partner-functions.js', 'utf8');
  const funcStart = funcSrc.indexOf('exports.getMyPartnerStatus');
  const funcBlock = funcSrc.slice(funcStart, funcSrc.indexOf('// ─── 3) Vincular indicação', funcStart));
  assert.match(funcBlock, /needsClaim/);
  assert.match(funcBlock, /needsVerification/);
  assert.doesNotMatch(funcBlock, /\.set\(/);
  assert.doesNotMatch(funcBlock, /\.update\(/);
  assert.doesNotMatch(funcBlock, /\.push\(/);
  const svc = readFileSync('firebaseService.js', 'utf8');
  assert.match(svc, /async function getMyPartnerStatus\(\)/);
  assert.match(svc, /getMyPartnerStatus\|getMyPartnerDashboard/);
  const auth = readFileSync('auth.js', 'utf8');
  assert.match(auth, /async function isPartnerOnlyAccount\(\)/);
  assert.match(auth, /5 \* 60 \* 1000/);
  assert.match(auth, /opts\.checkPartner === true/);
  assert.match(auth, /return 'portal-parceiro\.html';/);
  const guardCall = auth.slice(auth.indexOf('async function enforceSubscriptionGuard'));
  assert.doesNotMatch(guardCall.slice(0, 2000), /checkPartner/);
  const login = readFileSync('login.html', 'utf8');
  assert.match(login, /checkPartner: true/);
});

test('topbar nao estoura em mobile: parceiro sai do topo em 480px', () => {
  const css = readFileSync('landing-vendas.css', 'utf8');
  assert.match(css, /\.lv-topbar-ctas a\[href\*="portal-parceiro\.html"\]\{display:none\}/);
});

test('confirmacao de e-mail usa API modular em todas as pontas', () => {
  const init = readFileSync('firebase-init.js', 'utf8');
  assert.match(init, /sendEmailVerification,/);
  const svc = readFileSync('firebaseService.js', 'utf8');
  assert.match(svc, /sendVerificationEmail: async \(\) => \{/);
  assert.match(svc, /await sendEmailVerification\(user\)/);
  const portal = readFileSync('portal-parceiro.html', 'utf8');
  assert.match(portal, /svc\.sendVerificationEmail\(\)/);
  assert.match(portal, /Enviamos uma nova confirmação para seu e-mail/);
  assert.match(portal, /Conta conectada: /);
  const funcSrc = readFileSync('functions/partner-functions.js', 'utf8');
  assert.match(funcSrc, /partner_claim_reclaim/);
  assert.match(funcSrc, /auth\/user-not-found/);
  const login = readFileSync('login.html', 'utf8');
  assert.match(login, /authService\.sendVerificationEmail\(\)/);
  assert.match(login, /Enviamos uma confirmação para seu e-mail/);
  assert.match(portal, /lastResendAt/);
  assert.match(portal, /Aguarde /);
  assert.match(portal, /alreadyVerified/);
  assert.match(portal, /Muitas tentativas em sequência/);
  assert.match(svc, /user\.reload/);
});
