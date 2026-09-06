# Programa de Parceiros Sisweb — Spec técnica (2026-09-06)

> Princípio inegociável: **comissão só existe após pagamento real aprovado**.
> O motor existente (`submitSubscriptionRequest` → `prepare/confirmSubscriptionApproval`,
> `functions/index.js:4312/5493`) já cria comissão por e-mail de indicação no momento da
> aprovação (`index.js:5592`). Este spec **estende** esse motor para códigos de parceiro
> sem alterar nenhum comportamento existente (aditivo, nunca substitutivo).

## 1. Modelo de dados (RTDB, todos sob Admin SDK; client nunca escreve direto)

- `campaignPartners/{partnerId}`: `{id, code: PAR-XXXX (único), name, email, phone,
  city, atuacao, status: active|blocked|pending, commissionPercent: number|null
  (override; null = usa campanha), ownerUid: string|null (conta vinculada),
  createdAt, createdBy: self|superadmin, totalEarned, totalPaid}`
- `campaignPartnerCodes/{code}` → `{partnerId}` (índice de unicidade + lookup O(1))
- `campaignReferrals/{referredUid}`: `{partnerId, code, at, source:
  register|subscription|manual, companyId: string|null}` (primeiro vínculo vence;
  nunca sobrescrito automaticamente)
- `campaignCommissions/{partnerId}/{entryId}`: `{referredUid, companyId,
  requestId, paidAmount, percent, commission, status: earned|paid|reversed,
  at, paidAt: string|null, paidBy: string|null, note: string}`
- `companies/{companyId}/partnerReminders/{reminderId}`: `{partnerId,
  partnerName, kind: billing_reminder, title, message, createdAt, read: false}`
  (lido pelo sininho via `menu-component.js computeAlertsForUser`; só dados da
  própria empresa — sem vazamento)

## 2. Callables (novo `functions/partner-functions.js`, padrão `configure()`)

| Callable | Auth | Função |
|---|---|---|
| `registerPartner` | pública (rate-limit e-mail+IP) | valida, dedupe por e-mail (devolve código existente), gera `PAR-XXXX` único, cria partner `active` + índice |
| `validatePartnerCode` | autenticada | `{code}` → `{valid, partnerName}` (sem PII) |
| `linkPartnerReferral` | autenticada | valida código ativo, anti-autoindicação (uid/e-mail/empresa), idempotente, grava `campaignReferrals/{uid}` |
| `getMyPartnerDashboard` | autenticada | resolve partner por `ownerUid` ou e-mail do token; retorna **só dados próprios**: KPIs, empresas vinculadas com status/plano/vencimento/último pagamento, comissões, lembretes enviados |
| `sendBillingReminder` | autenticada (parceiro) | verifica vínculo + inadimplência real, rate-limit 1/24h por empresa, grava `partnerReminders` + `pushUserNotification` para cada usuário da empresa |
| `getPartnersAdmin` | superadmin | lista parceiros com agregados (vinculadas, ativas, receita, comissões ganha/paga/pendente) |
| `getPartnerDetailAdmin` | superadmin | referrals com status da empresa + ledger de comissões |
| `setPartnerConfig` | superadmin | `{partnerId, commissionPercent 0..40|null, status}` + auditoria |
| `markCommissionPaid` | superadmin | `earned→paid` com nota + auditoria (trilha do dinheiro) |

## 3. Gancho no motor de aprovação (aditivo)

- `submitSubscriptionRequest`: aceita `partnerCode` opcional → resolve parceiro ativo →
  grava `partnerId/partnerCode` no request **e** `referralEmail` = e-mail do parceiro
  (reaproveita o motor existente sem tocá-lo).
- `confirmSubscriptionApproval` (ramo approve): após o bloco `referralEmail`
  existente, resolve `partnerId` (request ou `campaignReferrals[uid]`); se houver e
  não existir entry para `(partnerId, requestId)`: `percent = override ??
  campaign.referral.commissionPercentForReferrer`; cria entry `earned`; soma
  `totalEarned`; notifica `ownerUid` do parceiro. Bloco antigo intacto.

## 4. Rules (`database.rules.json`, aditivo)

- Topo: `campaignPartners`, `campaignPartnerCodes`, `campaignReferrals`,
  `campaignCommissions` → `.read/.write: superadmin` (tudo via callables).
- `companies/$companyId/partnerReminders` → `.read` de membro (mesma condição
  de `fiscal.read`), `.write` superadmin (backend escreve via Admin SDK).

## 5. Frontends

- **Admin (superadmin):** aba `Parceiros` (ao lado de Suporte): filtros
  (busca, status), tabela (Parceiro, Código, Contato, Vinculadas, Ativas,
  Receita, Ganha/Paga/Pendente, Status, Ações: Detalhes, % comissão,
  Bloquear/Ativar). Modal detalhe: empresas (status/plano/vencimento/último
  pagamento) + ledger com botão `Marcar pago`.
- **Portal do parceiro (`cadastro-parceiro.html`):** após gerar código, bloco
  `Acessar meu painel` (login) → dashboard próprio: copiar código, KPIs,
  tabela de empresas (status, plano, vencimento, último pagamento, Cobrar),
  comissões, sem nunca expor dados de outros.
- **Sininho:** `menu-component.js computeAlertsForUser` lê `partnerReminders`
  do tenant e injeta alerta `Assinatura • Cobrança do parceiro` com link para
  `subscription-status.html`.
- **Registro:** `sisweb_pending_partner` consumido em `subscription.html`
  (envia `partnerCode` junto) + prefill `?partner=`/`?ref=` mantido.

## 6. Segurança / anti-regressão

- Nenhum write direto do client em nós novos; senha/PII nunca em extras.
- Anti-autoindicação: uid, e-mail e companyId do parceiro bloqueiam vínculo.
- Rate-limit: registro público (e-mail+IP) e lembretes (1/24h/empresa).
- Comissão nasce `earned` **só** no ramo approve com `paidAmount` real;
  `markCommissionPaid` separado com auditoria em `subscriptionAdminPurgeAudit`.
- Testes: `tests/partner-program.test.mjs` (contrato estático + lógica pura
  via `createRequire` de `functions/partner-functions.js`).
