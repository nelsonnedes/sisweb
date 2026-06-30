# Story: Status de assinatura com dados reais e auditoria SQL

Data: 2026-06-09

## Contexto

O painel `subscription-status.html` pode exibir `N/A` quando a assinatura do usuario existe em campos historicos/top-level, como `subscriptionStart`, `subscriptionEnd`, `trialStart`, `pendingPayment` ou `payments`, mas nao esta preenchida no objeto novo `subscription.startDate/endDate`.

Tambem foi solicitada auditoria dos fluxos de assinatura, notificacao, sininho, recuperacao de senha e PIX para confirmar se ha vinculo com Firebase Data Connect/SQL Connect/Cloud SQL.

## Checklist

- [x] Auditar referencias diretas a Data Connect, SQL Connect, Cloud SQL e PostgreSQL nos fluxos pedidos.
- [x] Confirmar que PIX, notificacoes, recuperacao de senha e sininho usam Firebase Auth, Realtime Database, Storage e Cloud Functions.
- [x] Normalizar fontes reais de assinatura em `subscription-status.html`.
- [x] Corrigir referencia quebrada do container do Mercado Pago Bricks em `subscription.html`.
- [x] Integrar acao Admin "Notificar" com notificacao interna do usuario alem do e-mail.
- [x] Rodar checks automatizados aplicaveis.
- [x] Atualizar evidencias finais.

## Achados

- Nao ha referencia direta a `Data Connect`, `SQL Connect`, `Cloud SQL`, `postgres`, `cloudsql`, `fdcdb` ou `nelsonnedesbrito-fdc` em `subscription-status.html`, `subscription.html`, `admin.html`, `scripts/`, `firebaseService.js`, `functions/` e `tests/`.
- `subscription-status.html` estava privilegiando apenas `user.subscription.startDate/endDate`, deixando dados reais gravados em outros campos aparecerem como `N/A`.
- A API de PIX em `subscription.html` chama Cloud Functions (`createPixPayment`, `revalidatePixPayment`, `processPaymentBrick`) e grava em RTDB (`subscriptionPayments`), sem dependencia SQL local.
- `subscription.html` tinha uma referencia a `paymentBrickContainer`, ID inexistente no HTML; o container real e `paymentBrick_container`.
- Recuperacao de senha usa Firebase Auth (`sendPasswordResetEmail`), sem dependencia SQL.
- Notificacoes comerciais e sininho usam RTDB/Cloud Functions. A acao "Notificar" agora tambem grava mensagem interna quando o usuario possui UID.

## Arquivos

- `subscription-status.html`
- `subscription.html`
- `admin.html`
- `scripts/admin/admin-main.js`
- `functions/index.js`
- `tests/admin-support-ui.test.mjs`
- `tests/subscription-status-help-guide.test.mjs`
- `tests/subscription-checkout-pix.test.mjs`
- `tests/subscription-admin-notify.test.mjs`
- `docs/stories/2026-06-09-assinatura-status-dados-reais.md`

## Evidencias

- `node --check functions/index.js`
- `node --check scripts/admin/admin-main.js`
- Validacao do script inline de `subscription-status.html` via `new Function(...)`
- `node --test tests/subscription-status-help-guide.test.mjs tests/subscription-checkout-pix.test.mjs tests/subscription-admin-notify.test.mjs`
- `node --test tests/admin-support-ui.test.mjs tests/subscription-admin-notify.test.mjs`
- `npm --prefix functions run lint`
- `npm run lint`
- `npm run typecheck`
- `npm test` (`124/124`)
- `firebase deploy --only "hosting,functions:sendSubscriptionEmail" --project sisweb-7ce82`
- `firebase deploy --only hosting --project sisweb-7ce82`
- Verificacao HTTP em producao para `subscription-status.html`, `subscription.html`, `admin.html` e `scripts/admin/admin-main.js?v=2026-06-09-subscription-notify-v1`
