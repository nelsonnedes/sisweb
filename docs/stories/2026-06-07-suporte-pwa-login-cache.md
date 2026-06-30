# Story: Suporte Sisweb, cache PWA e login Super Admin

## Contexto

Apos deploy da central de tickets, o usuario reportou que o envio nao funcionava no cliente nem no Super Admin. Os logs das Cloud Functions nao mostraram execucao runtime de `createSupportTicket`/`addSupportTicketMessage` depois do teste, indicando falha antes da chamada ao backend. No PWA instalado, o login Super Admin retornou `auth/invalid-login-credentials`, enquanto no navegador normal o mesmo email e senha funcionaram.

## Analise

- As Functions de suporte existem em producao e estao em `us-central1`.
- O PWA podia manter `sw.js`, `menu-component.js`, `login.html`, `auth.js` ou `firebaseService.js` antigos.
- Algumas telas podem substituir `window.firebaseService` por objeto parcial, removendo wrappers como `createSupportTicket` e `listSupportTicketsAdmin`.
- Inputs mobile/autofill podiam entregar email com espaco/capitalizacao; o Firebase interpreta isso como credencial invalida.
- A persistencia de Auth podia concorrer com o login no PWA se `setPersistence` ainda nao tivesse resolvido.
- Ao abrir um ticket criado, `getSupportTicket` consultava `supportTicketMessagesByCompany/{companyId}/{ticketId}` com `orderByChild('createdAt')`, mas faltava `.indexOn` nesse nivel. O RTDB retornava `internal` mesmo com o ticket ja gravado.
- Apos resposta do Super Admin, o cliente no dashboard recebia bloqueio CSP em `listMySupportTickets`, porque `index.html` nao permitia `https://us-central1-sisweb-7ce82.cloudfunctions.net` em `connect-src`.
- A listagem "Meus tickets" nao deve depender de `companyId` informado/claim de tenant, pois o espelho `supportTicketsByUser/{uid}` ja e isolado pelo UID autenticado.
- Ao abrir a resposta do ticket, `getSupportTicket` ainda podia retornar `internal` por erro de indice RTDB em `supportTicketMessagesByCompany/{companyId}/{ticketId}`. A leitura do detalhe agora busca o no direto e aplica ordenacao/limite no backend, mantendo o isolamento por tenant.

## Criterios de aceite

- [x] PWA e Service Worker publicados com nova versao de cache.
- [x] Tela de login normaliza email sem alterar senha.
- [x] Inputs de email/senha evitam autocapitalizacao/autocorrecao no mobile.
- [x] `firebaseService` aguarda persistencia de Auth antes de login/registro.
- [x] Modal de suporte tenta carregar `firebaseService.js` atualizado quando o global esta parcial.
- [x] Admin de tickets tenta carregar `firebaseService.js` atualizado quando o global esta parcial.
- [x] Login/Admin usam cachebuster nos scripts criticos.
- [x] Mensagens de tickets possuem indice RTDB `createdAt` no nivel correto para abrir conversa.
- [x] Dashboard permite conexao CSP apenas com o host Cloud Functions do projeto.
- [x] `listMySupportTickets` lista pelo `auth.uid` autenticado sem exigir `companyId` do cliente.
- [x] `getSupportTicket` abre mensagens e auditoria sem depender de `orderByChild('createdAt')` em tempo de abertura.
- [x] Gates executados.
- [x] Deploy de hosting executado.
- [x] Deploy de database rules executado.
- [x] Deploy da callable `listMySupportTickets` executado.
- [x] Deploy da callable `getSupportTicket` executado.

## Validacoes obrigatorias

- Seguranca e Performance: manter chamadas de ticket via Cloud Functions autenticadas; nao escrever direto em `supportTickets*`; evitar secrets no frontend.
- Responsividade e Padronizacao: nao alterar layout; preservar experiencia mobile/PWA e mensagens claras.
- Conformidade Legal: sem impacto em calculos fiscais, folha, trabalhistas ou regras ambientais.

## File list

- `sw.js`
- `menu-component.js`
- `firebaseService.js`
- `auth.js`
- `login.html`
- `index.html`
- `admin.html`
- `functions/index.js`
- `database.rules.json`
- `scripts/admin/admin-main.js`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/support-backend.test.mjs`
- `tests/global-first-wave.test.mjs`
- `docs/stories/2026-06-07-suporte-pwa-login-cache.md`
