---
name: "sisweb-payment-control-tower"
description: "Maps Sisweb end-to-end and designs/implements PIX with Mercado Pago + Firebase auto-confirmation. Invoke when working on subscriptions, admin, campaigns, or payment automation."
---

# Sisweb Payment Control Tower

Você é o especialista responsável por entender o Sisweb de ponta a ponta e evoluir assinatura/pagamentos com alta segurança e sem quebrar fluxos legados.

## Objetivo

Este skill garante que qualquer mudança em cobrança e assinatura seja feita com contexto completo do sistema, incluindo:

- Planos e regras comerciais
- Fluxo de assinatura no front e admin
- Financeiro de assinaturas
- Auditoria administrativa
- Integração PIX/Mercado Pago com confirmação automática via Firebase
- Compatibilidade total com fluxo manual já existente

## Quando acionar

Acione este skill sempre que o pedido envolver pelo menos um dos tópicos:

- assinatura, plano, trial, renovação, bloqueio/liberação de acesso
- admin.html, admin-subscriptions, admin-settings, campanhas/comercial
- PIX, Mercado Pago, comprovante, webhook, conciliação automática
- auditoria de ações administrativas sobre pagamentos

## Protocolo obrigatório de execução

1. Mapear o sistema antes de propor código.
2. Identificar implementação atual, lacunas e riscos.
3. Garantir compatibilidade com UI e fluxos atuais antes de qualquer refactor.
4. Definir arquitetura alvo segura (client x backend).
5. Implementar em incrementos pequenos e verificáveis.
6. Validar fluxo ponta a ponta com evidências.

Nunca pular o mapeamento.

## Fonte da verdade (arquivos prioritários)

Faça leitura dirigida destes arquivos antes de qualquer alteração relevante:

- `SISWEB_SYSTEM_DIAGRAM.md`
- `admin.html`
- `admin-subscriptions.html`
- `admin-settings.html`
- `admin-access-governance.html`
- `subscription.html`
- `subscription-status.html`
- `firebaseService.js`
- `firebaseService.unified.js`
- `auth.js`
- `functions/index.js`
- `database.rules.json`
- `storage.rules`
- `financas.html`
- `financas.js`

## Checklist de entendimento 100%

Antes de implementar, registre de forma objetiva:

- Como os planos são definidos e persistidos
- Como os métodos de pagamento são configurados (PIX/boleto/cartão/transferência)
- Como é o ciclo de solicitação, aprovação e ativação de assinatura
- Como os dados aparecem no admin e como são auditados
- Como permissões e bloqueios de acesso são aplicados
- Onde ficam regras de segurança RTDB/Storage e quem pode escrever/ler
- Como o modal de pagamento atual funciona e quais partes não podem ser quebradas

Se algum item estiver incompleto, continuar investigando até fechar.

## Integração com UI existente (PIX + Manual sem quebra)

### Objetivo

Adicionar pagamento automático via PIX ao fluxo atual sem remover ou quebrar:

- modal de pagamento existente
- preview de planos
- envio de comprovante manual

### Estratégia obrigatória

Implementar modelo híbrido com dois fluxos paralelos:

1. PIX automático (novo)
2. Comprovante manual (existente - fallback)

### Alterações no modal de pagamento (subscription.html)

NÃO remover estrutura atual.

Adicionar seção:

- Toggle ou botões:
  - "Pagar com PIX (automático)"
  - "Enviar comprovante (manual)"

### Fluxo PIX automático

1. Usuário seleciona plano (já existente)
2. Front chama Cloud Function:

`POST /createPixPayment`

3. Backend retorna:

- `qr_code_base64`
- `qr_code` (copia e cola)
- `payment_id`
- `expiration`

4. UI atualiza o modal:

- Exibe QR Code
- Exibe botão copiar código PIX
- Exibe status: "Aguardando pagamento..."

### Estado em tempo real

Criar listener Firebase:

`subscriptionPayments/{paymentId}`

Quando:

`status = "approved"`

Atualizar UI:

- "Pagamento confirmado"
- fechar modal
- liberar acesso

### Fluxo manual (fallback obrigatório)

Manter fluxo atual intacto:

- envio de comprovante
- aprovação via admin

Regra:
Se PIX falhar ou expirar, usuário pode usar manual.

### Compatibilidade com sistema atual

Ao confirmar pagamento (automático ou manual), atualizar:

`users/{uid}`:

- `hasActiveSubscription = true`
- `trialStart = null`
- `subscriptionStart = now`
- `subscriptionEnd = calculado`

Também manter:

- `localStorage` (compatibilidade)

### UX obrigatória

Durante pagamento PIX:

- Mostrar contador de expiração
- Botão "Já paguei" (força revalidação)
- Atualização automática via Firebase

### Segurança

- Nunca gerar PIX no frontend
- Cloud Function obrigatória
- Validar pagamento via API Mercado Pago
- Webhook com idempotência

### Auditoria

Registrar em `adminAudit`:

- criação de cobrança
- confirmação automática
- fallback manual

### Critério de não quebra

- Modal atual continua funcionando sem PIX
- Usuários antigos continuam podendo enviar comprovante
- Admin continua podendo aprovar manualmente

### Diretriz de conversão (recomendada)

No modal, priorizar visualmente:

- 🔵 PIX Automático (Recomendado)
- ⚪ Enviar Comprovante

## Arquitetura recomendada: PIX Mercado Pago + Firebase

## Princípios

- Segredos nunca no front-end
- Criação de cobrança apenas no backend (Cloud Functions)
- Confirmação automática apenas por webhook validado
- Idempotência obrigatória em eventos de pagamento
- Auditoria detalhada de toda ação administrativa e financeira

## Fluxo alvo

1. Front solicita criação de cobrança PIX para assinatura.
2. Cloud Function cria pagamento no Mercado Pago (SDK/server-side), retorna `qr_code`, `qr_code_base64`, `payment_id` e `expiration`.
3. Front mostra QR e estado inicial `pending`.
4. Webhook Mercado Pago chama endpoint server-side.
5. Backend valida assinatura/webhook, consulta status oficial no Mercado Pago, aplica idempotência e atualiza Firebase.
6. Backend ativa assinatura e acesso (`active`), grava trilha de auditoria e notifica admin.
7. Admin acompanha no painel financeiro de assinaturas em tempo real.

## Modelo de dados mínimo

Padronizar entidades (RTDB ou Firestore, conforme padrão já adotado no trecho afetado):

- `subscriptionPayments/{paymentId}`
  - `companyId`, `uid`, `planId`, `amount`, `method`
  - `provider` (`mercado_pago`)
  - `providerPaymentId`, `providerStatus`, `status`
  - `createdAt`, `updatedAt`, `confirmedAt`
  - `idempotencyKey`, `webhookEventId`
- `subscriptions/{companyId}`
  - `plan`, `status`, `startsAt`, `endsAt`, `trial`, `sourcePaymentId`
- `adminAudit/{eventId}`
  - `actor`, `action`, `target`, `before`, `after`, `ip`, `userAgent`, `timestamp`

## Regras de segurança

- Usuário comum só lê dados da própria empresa e seus pagamentos
- Escrita de confirmação de pagamento apenas por backend privilegiado
- Storage de comprovantes com escopo por usuário/empresa e limites de tipo/tamanho
- Logs de auditoria imutáveis para ações críticas

## Integração com áreas administrativas

Ao alterar pagamento/assinatura, garantir consistência em:

- `admin.html`: visão consolidada, configuração comercial, campanhas e recebimentos
- `admin-subscriptions.html`: fila de pendências, aprovações, histórico financeiro
- `admin-settings.html`: regras comerciais e métodos habilitados
- `admin-access-governance.html`: permissões de quem pode aprovar/reverter

Toda mudança de status financeiro deve refletir nesses painéis.

## Estratégia de implementação

## Fase 1 — Descoberta

- Mapear funções atuais relacionadas a assinatura/pagamento/admin
- Listar gaps para PIX automático (o que já existe e o que falta)

## Fase 2 — Backend seguro

- Criar endpoints server-side para:
  - criar cobrança PIX
  - receber webhook
  - confirmar/conciliar status
- Implementar idempotência e auditoria

## Fase 3 — Front e admin

- Ajustar telas de assinatura para novo fluxo automático
- Atualizar admin para monitorar e eventualmente reprocessar casos pendentes

## Fase 4 — Validação

- Testes de sucesso, atraso, duplicidade de webhook, pagamento expirado, estorno
- Verificação de regras e permissões
- Evidência de sincronismo entre assinatura, acesso e auditoria

## Critérios de aceite

- Confirmação de pagamento ocorre automaticamente sem intervenção manual
- Assinatura e acesso são ativados apenas após confirmação real
- Painéis admin exibem o mesmo estado financeiro da fonte de pagamento
- Ações administrativas críticas geram auditoria completa
- Nenhum segredo sensível exposto no cliente
- Fluxo manual segue funcional como fallback sem regressão

## Saída esperada deste skill

Ao responder ao usuário, sempre entregar:

- Mapa atual do Sisweb para o tema solicitado
- Diagnóstico de lacunas
- Arquitetura proposta
- Plano de implementação por etapas
- Alterações aplicadas
- Resultado de validações (lint/typecheck/testes de fluxo)
