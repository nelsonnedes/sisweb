# Story: Backend da Central de Suporte multi-tenant

## Contexto

A primeira leva global criou a Central de Suporte no menu/rodape, mas ela ainda nao persiste tickets. O fluxo atual permite WhatsApp, e-mail e copia do contexto da tela sem gravar dados no banco, evitando criar superficie LGPD antes de uma story backend propria.

O Sisweb ja possui padrao de backend com Cloud Functions callable, RTDB, claims `superadmin`, `companyId`/`tenantId`, trilhas de auditoria e espelhamento entre caminhos globais e caminhos por empresa em fluxos como assinaturas.

## Problema

O suporte precisa deixar de ser apenas contato externo e virar uma fila operacional auditavel do Sisweb. Sem backend proprio, o time nao consegue:

- Acompanhar chamados por empresa/tenant.
- Manter historico de respostas e status.
- Auditar acoes do Super Admin/suporte.
- Priorizar incidentes por modulo.
- Preservar contexto tecnico sem depender de prints ou mensagens soltas.
- Aplicar retencao, minimizacao e seguranca de dados de forma consistente.

## Objetivo

Implementar backend multi-tenant para tickets de suporte, usando Cloud Functions como porta de escrita/leitura, RTDB como armazenamento principal e regras que impedem vazamento entre tenants.

## Escopo Funcional

- Usuario autenticado cria ticket a partir da Central de Suporte.
- Ticket recebe contexto: modulo, URL/path, companyId/tenantId resolvido no servidor, uid, email, nome, plataforma/PWA, user agent resumido e timestamp.
- Usuario visualiza seus proprios tickets dentro do tenant.
- Usuario adiciona mensagens em tickets proprios abertos.
- Usuario pode encerrar/reabrir ticket proprio conforme regras definidas.
- Super Admin visualiza fila global, filtra por status, tenant, modulo, prioridade e periodo.
- Super Admin altera status, prioridade, responsavel e adiciona resposta.
- Todas as mudancas geram auditoria imutavel.
- Backend limita tamanho de mensagem, remove HTML/script e normaliza campos.
- Backend aplica rate limit basico por usuario/tenant para evitar spam.

## Fora do Escopo Desta Story

- Chat em tempo real com websocket.
- Envio automatico de WhatsApp.
- Anexos/prints em Storage.
- SLA contratual completo.
- Inteligencia artificial para classificar ticket.
- Tela final refinada no Admin; esta story entrega backend e wrappers, deixando UI administrativa completa para story propria se necessario.

## Modelo de Dados Implementado

### Ticket por Empresa

`supportTicketsByCompany/{companyId}/{ticketId}`

Decisao tecnica: nao usar `companies/{companyId}/supportTickets`, porque o ramo `companies/{companyId}` ja possui permissoes herdadas amplas para tenants. Caminhos filhos nao revogariam essa escrita de forma segura nas regras atuais do RTDB. Por isso, os tickets foram isolados em namespaces raiz escritos apenas por Cloud Functions Admin SDK.

Campos principais:

- `id`
- `companyId`
- `createdByUid`
- `createdByEmail`
- `createdByName`
- `status`: `open`, `waiting_support`, `waiting_customer`, `resolved`, `closed`
- `priority`: `low`, `normal`, `high`, `critical`
- `module`
- `path`
- `urlHost`
- `subject`
- `lastMessagePreview`
- `messageCount`
- `assignedToUid`
- `assignedToName`
- `createdAt`
- `updatedAt`
- `closedAt`

### Mensagens

`supportTicketMessagesByCompany/{companyId}/{ticketId}/{messageId}`

Campos:

- `id`
- `ticketId`
- `companyId`
- `authorUid`
- `authorEmail`
- `authorName`
- `authorRole`: `customer`, `support`, `superadmin`
- `message`
- `createdAt`
- `visibility`: `customer`, `internal`

### Indice por Usuario

`supportTicketsByUser/{uid}/{ticketId}`

Espelho resumido para listar os tickets do usuario autenticado via callable:

- `id`
- `companyId`
- `createdByUid`
- `status`
- `priority`
- `module`
- `subject`
- `lastMessagePreview`
- `createdAt`
- `updatedAt`

### Indice Global Super Admin

`supportTickets/{ticketId}`

Espelho minimo para fila global:

- `id`
- `companyId`
- `companyName`
- `createdByUid`
- `createdByEmail`
- `status`
- `priority`
- `module`
- `subject`
- `lastMessagePreview`
- `assignedToUid`
- `createdAt`
- `updatedAt`

### Auditoria

`supportTicketAudit/{ticketId}/{eventId}`

Eventos imutaveis:

- `created`
- `message_added`
- `status_changed`
- `priority_changed`
- `assigned`
- `closed`
- `reopened`
- `internal_note_added`

Campos:

- `event`
- `ticketId`
- `companyId`
- `actorUid`
- `actorEmail`
- `actorRole`
- `before`
- `after`
- `createdAt`

### Rate Limit

`supportTicketRateLimits/{companyId}/{uid}/{yyyyMMdd}`

Campos:

- `createdCount`
- `messageCount`
- `updatedAt`

## Cloud Functions

### `createSupportTicket`

Callable autenticada.

Entrada:

- `subject`
- `message`
- `module`
- `path`
- `url`
- `clientContext`

Regras:

- Exige `context.auth`.
- Resolve `companyId` pelo token, `users/{uid}` ou `companies/{companyId}/users/{uid}`.
- Ignora `companyId` enviado pelo cliente comum.
- Super Admin pode abrir ticket para tenant especifico apenas se informar `companyId` valido.
- Sanitiza texto e limita tamanhos.
- Cria ticket no tenant, espelho global e evento de auditoria.

### `addSupportTicketMessage`

Callable autenticada.

Regras:

- Usuario comum so escreve em ticket do proprio tenant e se for criador ou membro autorizado.
- Super Admin pode responder qualquer ticket.
- Mensagem interna so pode ser criada por Super Admin/suporte.
- Atualiza `lastMessagePreview`, `messageCount`, `status`, `updatedAt` e auditoria.

### `listMySupportTickets`

Callable autenticada.

Regras:

- Lista apenas tickets do tenant do usuario.
- Paginacao por `updatedAt`.
- Limite maximo por chamada.

### `getSupportTicket`

Callable autenticada.

Regras:

- Usuario comum acessa apenas ticket do proprio tenant.
- Super Admin acessa qualquer ticket.
- Retorna ticket, mensagens e auditoria visivel conforme perfil.

### `updateSupportTicketStatus`

Callable autenticada.

Regras:

- Usuario comum pode encerrar/reabrir ticket proprio com transicoes permitidas.
- Super Admin pode mudar status, prioridade e responsavel.
- Toda alteracao gera auditoria.

### `listSupportTicketsAdmin`

Callable autenticada Super Admin.

Regras:

- Consulta indice global.
- Filtros por status, prioridade, modulo, companyId e periodo.
- Paginacao obrigatoria.

## Regras de RTDB

- Cliente nao escreve diretamente em `supportTickets`, `supportTicketAudit` ou `supportTicketRateLimits`.
- Caminhos de ticket/mensagem devem ser escritos por Functions Admin SDK.
- `supportTickets`, `supportTicketsByCompany`, `supportTicketMessagesByCompany`, `supportTicketAudit` e `supportTicketRateLimits` bloqueiam escrita direta.
- Fila global e caminhos por empresa ficam legiveis diretamente apenas para `superadmin`.
- Usuario comum pode ler apenas o proprio espelho resumido em `supportTicketsByUser/{uid}`; detalhes passam pela callable `getSupportTicket`.
- Se leitura direta por tenant for necessaria em story futura, revisar primeiro as permissoes herdadas de `companies/{companyId}` e manter os tickets fora desse ramo.

## Frontend/Service Wrappers

Adicionar wrappers em `firebaseService.js`:

- `createSupportTicket(payload)`
- `addSupportTicketMessage(ticketId, message)`
- `listMySupportTickets(options)`
- `getSupportTicket(ticketId)`
- `updateSupportTicketStatus(ticketId, payload)`
- `listSupportTicketsAdmin(filters)`

Integrar a Central de Suporte do `menu-component.js`:

- Botao "Enviar ticket" aparece quando usuario esta autenticado.
- Se offline, guardar rascunho local por tenant/path sem enviar dados ate reconectar.
- Manter WhatsApp/E-mail/Copiar como fallback.

## Acceptance Criteria

- [x] Functions validam autenticacao, tenant e permissao no servidor.
- [x] Usuario comum nao consegue criar ticket em outro companyId.
- [x] Usuario comum nao consegue ler ticket de outro tenant.
- [x] Super Admin consegue listar fila global com filtros e limite maximo por chamada.
- [x] Criacao de ticket grava empresa/tenant, indice global, indice por usuario, mensagem inicial e auditoria.
- [x] Mensagem adicionada atualiza preview, contador, status, espelhos e auditoria.
- [x] Rate limit bloqueia abuso por usuario/tenant.
- [x] Dados de entrada sao sanitizados e possuem limites de tamanho.
- [x] Central de Suporte exibe "Enviar ticket" e valida autenticacao no backend.
- [x] Fallback WhatsApp/E-mail/Copiar continua disponivel.
- [x] Testes estaticos cobrem isolamento multi-tenant, Super Admin, sanitizacao, auditoria e regras.
- [x] Quality gates executados.

## Tasks

- [x] Mapear helpers atuais de auth/claims em `functions/index.js`.
- [x] Implementar helpers de tenant e sanitizacao para suporte.
- [x] Implementar `createSupportTicket`.
- [x] Implementar `addSupportTicketMessage`.
- [x] Implementar `listMySupportTickets` e `getSupportTicket`.
- [x] Implementar `updateSupportTicketStatus`.
- [x] Implementar `listSupportTicketsAdmin`.
- [x] Atualizar `database.rules.json` para bloquear escrita/leitura direta indevida.
- [x] Adicionar wrappers em `firebaseService.js`.
- [x] Integrar botao "Enviar ticket" na Central de Suporte.
- [x] Adicionar testes unitarios/estaticos.
- [x] Rodar quality gates.

## Testes Minimos

- Usuario A do tenant X cria ticket e nao consegue forcar tenant Y.
- Usuario A lista apenas tickets do tenant X.
- Usuario B do mesmo tenant nao ve ticket privado se a regra final restringir por criador.
- Super Admin lista tickets de X e Y.
- Mensagem com HTML/script e removida/sanitizada.
- Mensagem acima do limite e recusada.
- Rate limit bloqueia excesso de criacoes.
- Auditoria e criada em todo evento de mudanca.
- Wrapper frontend chama Function correta e trata erro de permissao.

## Validacoes Obrigatorias

### Seguranca e Performance

- Escrita sempre via Function Admin SDK.
- `companyId` sempre resolvido/validado no servidor.
- Indice global contem apenas dados necessarios para fila.
- Listagens com paginacao e limite maximo.
- Rate limit por usuario/tenant.

### Responsividade e Padronizacao

- Central de Suporte permanece funcional em PWA/mobile.
- UI administrativa completa deve seguir cards/tabelas responsivas em story posterior.
- Fallbacks atuais de WhatsApp/E-mail/Copiar permanecem acessiveis.

### Conformidade Legal

- Minimizar dados pessoais no indice global.
- Informar ao usuario que a mensagem sera registrada para atendimento.
- Evitar anexos nesta etapa para reduzir risco LGPD.
- Auditoria deve preservar rastreabilidade sem expor conteudo sensivel em excesso.
- Definir retencao futura para tickets e logs.

## File List

- `docs/stories/2026-06-06-central-suporte-backend-multitenant.md`
- `functions/index.js`
- `database.rules.json`
- `firebaseService.js`
- `menu-component.js`
- `tests/support-backend.test.mjs`

## QA Notes

- Implementado backend de suporte multi-tenant com Cloud Functions callable, RTDB raiz isolado, rate limit, auditoria, wrappers frontend e botao "Enviar ticket" na Central de Suporte.
- O caminho originalmente proposto dentro de `companies/{companyId}` foi substituido por `supportTicketsByCompany/{companyId}` para evitar heranca insegura de permissao de escrita no RTDB.
- Checagens especificas executadas:
  - `node --check functions/index.js`
  - `node --check firebaseService.js`
  - `node --check menu-component.js`
  - `node --test tests/support-backend.test.mjs tests/global-first-wave.test.mjs`
  - `npm --prefix functions run lint`
- Quality gates executados:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
- Deploy executado em `sisweb-7ce82`:
  - `firebase deploy --only "functions,database,hosting" --project sisweb-7ce82`
  - Hosting: https://sisweb-7ce82.web.app
  - Functions novas confirmadas em producao: `createSupportTicket`, `addSupportTicketMessage`, `listMySupportTickets`, `getSupportTicket`, `updateSupportTicketStatus`, `listSupportTicketsAdmin`.
  - Assets publicados conferidos: `menu-component.js` contem `sendSiswebSupportTicket`/rascunho offline e `firebaseService.js` contem os wrappers de suporte.
