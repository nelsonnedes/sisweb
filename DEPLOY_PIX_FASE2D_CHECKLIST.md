# Deploy PIX Fase 2D (Rules + Storage + Functions + Hosting)

## 1) Configuração obrigatória antes do deploy das functions

Crie um arquivo `functions/.env` (não commitar) baseado no `functions/.env.example`:

```env
MERCADO_PAGO_ACCESS_TOKEN_LOCAL=APP_USR-...
MERCADO_PAGO_WEBHOOK_URL_LOCAL=https://us-central1-SEU_PROJETO.cloudfunctions.net/mercadoPagoWebhook
MERCADO_PAGO_WEBHOOK_TOKEN_LOCAL=token-forte-aleatorio
```

Notas:
- `MERCADO_PAGO_ACCESS_TOKEN` é obrigatório para criar/revalidar pagamento no MP.
- `MERCADO_PAGO_WEBHOOK_URL` é usado ao criar a cobrança PIX.
- `MERCADO_PAGO_WEBHOOK_TOKEN` protege o endpoint de webhook (query `?token=`).
- O bloco PIX está em Functions v2 com `defineSecret` e fallback para `.env` local.
- Em produção, o recomendado é configurar via Secret Manager.

### Secrets (produção - obrigatório para v2)

```bash
firebase functions:secrets:set MERCADO_PAGO_ACCESS_TOKEN
firebase functions:secrets:set MERCADO_PAGO_WEBHOOK_URL
firebase functions:secrets:set MERCADO_PAGO_WEBHOOK_TOKEN
```

Depois, publicar as funções PIX:

```bash
firebase deploy --only functions:createPixPayment,functions:revalidatePixPayment,functions:mercadoPagoWebhook
```

## 2) Deploy de regras (Realtime Database + Storage)

```bash
firebase deploy --only database,storage
```

Inclui:
- `database.rules.json` com políticas para:
  - `subscriptionPayments`
  - `subscriptionPaymentProviderIndex`
  - `subscriptionWebhookEvents`
  - `adminAudit`
  - proteção extra em `companies/{companyId}/subscriptionPayments`
- `storage.rules` com reforço para:
  - `subscription-proofs/{uid}/...`
  - `companies/{companyId}/subscription-proofs/{uid}/...`
  - validação de tamanho/tipo (pdf/imagem) e delete seguro

## 3) Deploy de Functions (PIX)

```bash
firebase deploy --only functions:createPixPayment,functions:revalidatePixPayment,functions:mercadoPagoWebhook
```

## 4) Deploy de Hosting (front/admin)

```bash
firebase deploy --only hosting
```

## 5) Pós-deploy (smoke test)

1. Abrir `subscription.html`, gerar PIX automático.
2. Confirmar criação em RTDB:
   - `subscriptionPayments/{paymentId}`
3. Efetuar pagamento de teste no Mercado Pago.
4. Validar webhook:
   - `subscriptionWebhookEvents/{eventKey}`
5. Confirmar status aprovado:
   - `subscriptionPayments/{paymentId}.status = approved`
6. Conferir admin:
   - `admin.html` e `admin-subscriptions.html` exibindo PIX automático

## 6) Rollback rápido (se necessário)

- Reverter código local para commit anterior
- Deploy pontual:
  - `firebase deploy --only functions`
  - `firebase deploy --only database,storage`
  - `firebase deploy --only hosting`

## 7) Retroenriquecimento do histórico legado (nome/telefone/email/plano)

Após o deploy de functions, execute como superadmin no console do navegador (em uma página que já carregue `firebaseService.js`):

```js
await window.firebaseService.retroEnrichSubscriptionHistory({ dryRun: true, maxItems: 2000 })
```

Se o retorno estiver correto, aplicar em definitivo:

```js
await window.firebaseService.retroEnrichSubscriptionHistory({ dryRun: false, maxItems: 2000 })
```

Resultado esperado:
- preenche `userSnapshot` em solicitações antigas quando possível
- tenta completar `requestIp` e `requestUserAgent` quando houver valor legado em aliases
- preserva auditoria existente e registra evento em `adminAudit`
