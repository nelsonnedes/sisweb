import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('subscription-status possui guia rapido pesquisavel com prints sanitizados', () => {
  const html = read('subscription-status.html');

  assert.match(html, /Área do assinante/);
  assert.match(html, /id="statusStateBadge"/);
  assert.match(html, /class="status-state-badge state-warning"/);
  assert.match(html, /class="info-card status-card"/);
  assert.match(html, /class="status-actions-layout"/);
  assert.match(html, /class="renew-button subscription-primary-renew"/);
  assert.match(html, /function updateSubscriptionHeaderState\(statusKey, daysLeft\)/);
  assert.match(html, /Guia Rápido de Uso do Sistema/);
  assert.match(html, /id="quickGuideSearch"/);
  assert.match(html, /setupQuickGuideSearch/);
  assert.match(html, /Manual completo/);
  assert.match(html, /assets\/help-manual\/folha-1\.png/);
  assert.match(html, /assets\/help-manual\/vendas-1\.png/);
  assert.match(html, /assets\/help-manual\/compras-1\.png/);
  assert.match(html, /assets\/help-manual\/fiscal-1\.png/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /Print sanitizado/);
  assert.doesNotMatch(html, /help-assets\//);
});

test('subscription-status expõe central de mensagens ligada aos tickets do Admin', () => {
  const html = read('subscription-status.html');
  const adminHtml = read('admin.html');

  assert.match(html, /Central de Mensagens/);
  assert.match(html, /Nova mensagem para o Admin/);
  assert.match(html, /Ver minhas conversas/);
  assert.match(html, /id="statusMessagesPreview"/);
  assert.match(html, /function openSubscriptionMessageCenter\(view\)/);
  assert.match(html, /window\.showSupport\(\)/);
  assert.match(html, /window\.switchSiswebSupportView\(targetView\)/);
  assert.match(html, /window\.loadSiswebSupportTickets\(\)/);
  assert.match(html, /function prefillSubscriptionSupportMessage\(\)/);
  assert.match(html, /Plano exibido:/);

  assert.match(adminHtml, /Central de Mensagens e Suporte/);
  assert.match(adminHtml, /subscription-status\.html/);
});

test('guia rapido publico nao documenta modulo interno de super admin', () => {
  const html = read('subscription-status.html');
  const guideStart = html.indexOf('Guia Rápido de Uso do Sistema');
  const guideEnd = html.indexOf('<!-- Modal de Sobre -->');
  assert.ok(guideStart >= 0 && guideEnd > guideStart, 'bloco do guia rapido precisa existir');
  const guideBlock = html.slice(guideStart, guideEnd);

  assert.doesNotMatch(guideBlock, /Super Admin/i);
  assert.doesNotMatch(guideBlock, /Fila de suporte no Admin/i);
  assert.doesNotMatch(guideBlock, /Painel do dono do sistema/i);
});

test('subscription-status usa dados reais de assinatura antes de fallback textual', () => {
  const html = read('subscription-status.html');

  assert.match(html, /function resolveSubscriptionSnapshot/);
  assert.match(html, /u\.subscriptionStart/);
  assert.match(html, /u\.subscriptionEnd/);
  assert.match(html, /u\.subscriptionEndDate/);
  assert.match(html, /pendingPayment/);
  assert.match(html, /latestPayment/);
  assert.match(html, /Sem vencimento registrado/);
  assert.doesNotMatch(html, /textContent\s*=\s*['"]N\/A['"]/);
});

test('subscription publica inclui guia rapido com busca e lightbox de prints', () => {
  const html = read('subscription.html');
  const plansIdx = html.indexOf('id="plansContainer"');
  const messageIdx = html.indexOf('id="subscriptionMessageCenterCta"');
  const guideIdx = html.indexOf('id="subscriptionQuickGuide"');

  assert.ok(plansIdx >= 0, 'container de planos precisa existir');
  assert.ok(messageIdx > plansIdx, 'CTA da Central de Mensagens deve ficar depois dos cards de planos');
  assert.ok(guideIdx > messageIdx, 'Guia Rapido deve ficar depois da Central de Mensagens');
  assert.match(html, /menu-component\.js\?v=2026-07-01-alerts-overflow-fix-v1/);
  assert.match(html, /id="subscriptionMessageCenterButton"/);
  assert.match(html, /Abrir Central de Mensagens/);
  assert.match(html, /function openSubscriptionPublicMessageCenter\(\)/);
  assert.match(html, /window\.showSupport\(\)/);
  assert.match(html, /function bindSubscriptionFooterContact\(\)/);
  assert.match(html, /global-footer-contact/);
  assert.match(html, /getSubscriptionSupportPrefill/);
  assert.match(html, /function applySubscriptionSupportAccessMode\(publicMode\)/);
  assert.match(html, /subscription-public-support/);
  assert.match(html, /support-public-mode/);
  assert.match(html, /Registrar-se para abrir tickets/);
  assert.match(html, /Enviar e-mail/);
  assert.match(html, /window\.__siswebSupportPublicMode = !authenticated/);
  assert.match(html, /Visitante público: tickets com histórico ficam disponíveis após registro\/login/);
  assert.match(html, /id="subscriptionQuickGuide"/);
  assert.match(html, /Guia Rápido de Uso do Sistema/);
  assert.match(html, /id="subscriptionQuickGuideSearch"/);
  assert.match(html, /data-subscription-guide-keywords/);
  assert.match(html, /assets\/help-manual\/empresa-1\.png/);
  assert.match(html, /assets\/help-manual\/romaneios-1\.png/);
  assert.match(html, /assets\/help-manual\/vendas-1\.png/);
  assert.match(html, /assets\/help-manual\/folha-1\.png/);
  assert.match(html, /id="subscriptionGuideLightbox"/);
  assert.match(html, /Fechar e voltar ao Guia/);
  assert.match(html, /function setupSubscriptionQuickGuide\(\)/);
  assert.match(html, /guide\.scrollIntoView/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
});

