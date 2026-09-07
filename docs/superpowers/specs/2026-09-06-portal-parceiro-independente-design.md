# Portal Independente do Parceiro Sisweb

## 1. Objetivo

Criar um portal exclusivo para parceiros comerciais que não precisam possuir
empresa, assinatura ou operação dentro do Sisweb. O parceiro poderá ativar uma
conta própria, acompanhar clientes indicados, empresas, pagamentos,
comissões/projeções e conversar separadamente com o SuperAdmin ou com o
responsável da empresa indicada.

O portal não substitui o sistema empresarial. Ele é uma capability adicional
do Firebase Auth, sem `companyId` obrigatório.

## 2. Decisões

- O cadastro público continua separado da autenticação.
- O cadastro gera o parceiro e o código, mas não cria uma sessão autenticada.
- O parceiro ativa o acesso em uma página exclusiva, criando uma conta
  Firebase Auth de parceiro.
- O e-mail precisa estar verificado antes do claim de `ownerUid`.
- Uma mesma conta Firebase Auth poderá futuramente possuir capability de
  parceiro e de empresa; capabilities não serão confundidas com `companyId`.
- Parceiro bloqueado ou pendente não acessa o dashboard nem envia mensagens.
- Toda autorização de parceiro será derivada do token autenticado no backend;
  `partnerId`, `companyId` e participantes enviados pelo navegador não serão
  fontes de autorização.

## 3. Rotas e UX

### 3.1 Páginas

- `portal-parceiro.html`: entrada, ativação e dashboard exclusivo.
- `cadastro-parceiro.html`: inscrição pública e confirmação de código; o botão
  de acesso aponta para `portal-parceiro.html`.
- `landing-vendas.html`: “Meu painel do Parceiro” e “Acessar meu Painel”
  apontam para `portal-parceiro.html`.
- `login.html`: aceita contexto `?redirect=portal-parceiro.html`; após login
  retorna ao portal, sem redirecionar para `company.html`.

### 3.2 Estados do portal

- Visitante: explica o programa e oferece “Criar acesso” / “Entrar”.
- Authenticated sem claim: solicita confirmação de e-mail e código PAR-XXXX
  opcional; nunca mostra dados de parceiro antes do claim.
- Authenticated com parceiro ativo: mostra dashboard próprio.
- Parceiro pendente/bloqueado: mostra motivo e canal de contato com
  SuperAdmin; não mostra empresas, comissões ou conversas privadas.
- Conta sem parceiro correspondente: mostra mensagem orientativa, sem
  fallback para dados de outro parceiro.

## 4. Fluxo de ativação

1. `registerPartner` cria `campaignPartners/{partnerId}` com `ownerUid: null`
   e retorna somente código/status necessários.
2. O CTA “Criar acesso ao painel” abre `login.html?mode=register&redirect=`
   para criação de Auth, sem empresa.
3. Após confirmação/login, o portal chama `claimPartnerAccount` sem confiar em
   UID ou e-mail informados no formulário.
4. A callable usa `context.auth.uid`, `context.auth.token.email` e exige
   `email_verified === true`.
5. Se houver código, ele é resolvido no índice `campaignPartnerCodes` e deve
   apontar para o parceiro cujo e-mail coincide com o token, salvo uma
   confirmação administrativa explícita.
6. Sem código, a callable pode resolver por e-mail normalizado, desde que o
   parceiro esteja sem `ownerUid`.
7. A associação é transacional/compare-and-set: `ownerUid` vazio vira UID;
   se já houver outro UID, retorna conflito e não sobrescreve.
8. O backend retorna somente `partnerId`, `status` e capabilities.

Parceiros existentes como `teste@teste.com` poderão ativar o portal pelo
mesmo fluxo, sem perder código, referrals ou ledger.

## 5. Contratos backend

### 5.1 `claimPartnerAccount`

Autenticada e exige e-mail verificado.

Entrada opcional:

```text
{ code?: "PAR-XXXX" }
```

Saída mínima:

```text
{ success, partnerId, status, capabilities: { dashboard, messaging } }
```

Não aceita `ownerUid`, e-mail arbitrário, `companyId` ou `partnerId` como
autoridade.

### 5.2 `getMyPartnerDashboard`

- Exige parceiro resolvido pelo UID autenticado.
- Exige `status === active`.
- Paginação server-side para empresas/comissões/conversas.
- Não retorna `referredUid`, `requestId`, `companyId` ou e-mail completo.
- Cliente é exposto como `clientRef` opaco, nome comercial e status mínimo.
- Valores de pagamentos individuais só aparecem quando necessários à
  conciliação do parceiro; por padrão, retorna agregados.

### 5.3 `sendPartnerBillingReminder`

- Recebe `clientRef` opaco, mensagem e `idempotencyKey`.
- Resolve empresa/usuário no backend.
- Autoriza somente vínculo ativo parceiro↔cliente.
- Envia para o responsável primário da empresa, não para todos os membros.
- Mantém rate limit parceiro+cliente+24h e idempotência transacional.

### 5.4 Mensagens

Criar canais separados dos tickets empresariais atuais:

```text
partnerConversations/{conversationId}
partnerMessages/{conversationId}/{messageId}
```

Campos mínimos da conversa:

```text
channel: partner_superadmin | partner_client
partnerId
partnerUid
clientRef
companyId: backend-only projection
participantUids
status: open | waiting_partner | waiting_client | closed
createdAt
updatedAt
```

Campos da mensagem:

```text
authorUid
authorRole: partner | client | superadmin
body
attachments: none initially
createdAt
readAt
```

Autorização:

- parceiro: somente `partnerUid === context.auth.uid` e vínculo ativo;
- cliente: somente UID do responsável autorizado para aquele `clientRef`;
- SuperAdmin: allowlist atual + capability administrativa;
- nenhum cliente acessa conversa de outro cliente;
- nenhum parceiro acessa conversa de outro parceiro.

O fluxo antigo `partnerReminders` continua como alerta simples e compatível;
não será reutilizado como thread privada.

## 6. Segurança e privacidade

- `findPartnerForCaller` não fará claim durante uma leitura.
- Claim exige e-mail verificado, transação e `ownerUid` não preenchido.
- Status `blocked`/`pending` bloqueia todas as operações de parceiro.
- Registro público não enumera parceiro existente nem devolve código para
  qualquer chamada com e-mail duplicado sem proteção adicional.
- Rate limits passam a usar transação e falham fechados quando o RTDB está
  indisponível.
- Respostas do portal minimizam PII e usam referências opacas.
- Não haverá write direto do cliente nos nós de campanha/conversas.
- Mutação de comissão e configuração exige SuperAdmin; pagamento deve ser
  idempotente/transacional e auditado.
- Mensagens privadas não usarão o caminho aberto de `partnerReminders`.
- Anexos ficam fora da primeira entrega; quando necessários, terão path e
  regra por conversa/participante.

## 7. Compatibilidade e migração

- `campaignPartners`, referrals e commissions atuais permanecem.
- `getMyPartnerDashboard` mantém o nome público, mas passa a aplicar o novo
  contrato mínimo de segurança.
- `cadastro-parceiro.html` continua aceitando novos cadastros e mostra link
  para o portal novo.
- Clientes indicados continuam usando `partnerCode` em assinatura/trial.
- Parceiros já criados fazem claim pelo e-mail verificado; não é necessário
  preencher `ownerUid` manualmente.
- O `adminLinkReferral` permanece apenas para corrigir vínculo de indicação
  cliente↔parceiro, não para conceder acesso de parceiro.

## 8. Fases de entrega

1. Portal, login/redirect e `claimPartnerAccount`; hardening de status,
   ownership e payload.
2. Dashboard próprio com clientes, comissões, projeções e filtros/paginação.
3. Canal parceiro↔SuperAdmin reutilizando componentes visuais de suporte, mas
   com autorização por participante.
4. Canal parceiro↔cliente com responsável primário, consentimento/status e
   notificações.
5. Migração visual de links, testes E2E autenticados e remoção do dashboard
   misturado de `cadastro-parceiro.html` após período de compatibilidade.

## 9. Testes obrigatórios

- parceiro sem `companyId` consegue entrar apenas no portal;
- usuário comum sem empresa continua indo para `company.html`;
- parceiro bloqueado/pending é negado;
- claim por e-mail não verificado é negado;
- dois UIDs não reivindicam o mesmo parceiro;
- parceiro A não vê dados do parceiro B;
- payload não contém UID/e-mail completo/companyId/requestId;
- `clientRef` de outro parceiro é negado;
- mensagens respeitam participantes;
- rate limit concorrente não duplica lembretes;
- falha do RTDB não libera operação;
- Admin não autorizado/MFA ausente é negado nas mutações sensíveis;
- `markCommissionPaid` não duplica totais;
- regras RTDB/Storage continuam bloqueando acesso direto.
