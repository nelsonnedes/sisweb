# Story: Suporte Sisweb com tickets bidirecionais multi-tenant

## Contexto

O Sisweb ja possui base de suporte via Cloud Functions e fila no Admin, mas o usuario solicitou foco no "Suporte Sisweb" para permitir conversa real entre usuario/empresa tenant e Admin, com mensagem/notificacao para o administrador e responsividade profissional.

## Objetivo

Transformar o modal global de Suporte Sisweb em uma central de tickets bidirecional, onde o cliente cria chamados, acompanha historico, responde mensagens do Admin e o Super Admin responde pela fila global, mantendo isolamento multi-tenant e notificacoes seguras.

## Escopo

- Reaproveitar callables existentes de suporte sem permitir escrita direta no Realtime Database.
- Notificar o Admin por e-mail quando ticket/mensagem de cliente chegar, sem expor credenciais ao frontend.
- Permitir que usuario comum liste seus tickets, abra a conversa e responda pelo modal Suporte Sisweb.
- Manter notas internas visiveis apenas para Super Admin.
- Melhorar responsividade do modal Suporte Sisweb em desktop e PWA/mobile.
- Reforcar testes de backend, frontend e Admin.

## Fora do Escopo

- Chat em tempo real com WebSocket/listener continuo.
- Anexos de arquivos em tickets.
- Manual publico do Super Admin.

## Acceptance Criteria

- [x] Usuario autenticado cria ticket e recebe protocolo.
- [x] Usuario autenticado lista apenas os proprios tickets.
- [x] Usuario abre um ticket, visualiza mensagens publicas e responde.
- [x] Super Admin visualiza fila global, conversa e notas internas.
- [x] Mensagens de cliente notificam o Admin por backend seguro.
- [x] Cliente comum nao acessa tickets de outro tenant/usuario.
- [x] Frontend nao escreve diretamente em `supportTickets*`.
- [x] Modal Suporte Sisweb funciona em mobile/PWA sem tabela ou conteudo cortado.
- [x] Testes e gates executados.
- [x] Deploy executado quando necessario.

## Validacoes Obrigatorias

### Seguranca e Performance

- Todas as mutacoes passam por Cloud Functions autenticadas.
- Tenant/companyId e resolvido no backend para usuario comum.
- Rate limit preservado para criacao e mensagens.
- E-mail de notificacao nao deve expor segredo SMTP ao frontend e nao deve bloquear o ticket se falhar.

### Responsividade e Padronizacao

- Modal global deve ter lista de tickets em cards, conversa em bolhas e botoes grandes no mobile.
- Admin continua com tabela no desktop e cards responsivos no mobile.

### Conformidade Legal

- Mensagens de suporte podem conter dados operacionais; o sistema deve tratar como conteudo restrito por tenant/admin.
- O fluxo nao substitui orientacao legal, fiscal ou trabalhista.

## File List

- `docs/stories/2026-06-06-suporte-sisweb-tickets-bidirecionais.md`
- `functions/index.js`
- `database.rules.json`
- `menu-component.js`
- `tests/support-backend.test.mjs`
- `tests/global-first-wave.test.mjs`

## QA Notes

- Validacao local no Browser com harness temporario em `tmp/`:
  - Desktop: modal abriu pelo rodape "Fale Conosco", exibiu "Novo ticket" e "Meus tickets".
  - Conversa: card de ticket, historico com 2 mensagens ficticias e campo "Responder neste ticket".
  - Mobile 390x844: sem overflow horizontal, cards e bolhas legiveis, botoes de acao com altura de toque.
- Harness temporario removido e servidor local parado.
- Comandos executados:
  - `node --check menu-component.js`
  - `node --check functions/index.js`
  - `node --test tests/support-backend.test.mjs tests/admin-support-ui.test.mjs tests/global-first-wave.test.mjs`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
- Resultado: 72 testes passando.
- Deploy executado:
  - `firebase deploy --only "hosting,database,functions:createSupportTicket,functions:addSupportTicketMessage,functions:sendSubscriptionEmail" --project sisweb-7ce82`
- Verificacao em producao por HTTP:
  - `menu-component.js` retornou 200 com "Meus tickets", `sendSiswebSupportTicketReply` e guarda `window.customElements`.
  - `functions/index.js`, `functions/.env` e `tmp/support-harness.html` retornaram 404 no Hosting.
  - `menu-component.js` publicado nao contem senha SMTP hardcoded.
