# Story: Admin - Conceder Trial 30 Dias em Assinaturas

## Objetivo

Permitir que o SuperAdmin conceda um teste gratuito de 30 dias para clientes cadastrados que ficaram expirados, pendentes ou abandonaram o pagamento, mantendo a decisao auditavel, segura no backend e comunicada automaticamente ao cliente pelo sininho e por e-mail.

## Acceptance Criteria

- [x] Existe Function administrativa para conceder trial de 30 dias sem escrita sensivel direta pelo front.
- [x] A Function valida SuperAdmin, usuario alvo, dias permitidos, evita sobrescrever assinatura paga ativa e atualiza claims/status.
- [x] A concessao grava `subscriptionStatus: trial_active`, datas reais de inicio/vencimento, auditoria, snapshot do pendente anterior, notificacao interna e e-mail convidativo automaticos.
- [x] Solicitações pendentes do usuario sao marcadas como substituidas quando o trial administrativo for concedido.
- [x] A aba Assinaturas exibe botao seguro para conceder Trial 30d nos status apropriados.
- [x] Cadastros sem sinal real de assinatura/trial/pagamento deixam de aparecer como expirados e passam a aparecer como `Sem assinatura`, com opcao de Trial 30d.
- [x] A opcao Notificar permanece separada do fluxo de bonus para nao misturar comunicados padrao com concessao administrativa.
- [x] `firebaseService.js` expoe wrapper reutilizavel para o Admin.
- [x] Testes de regressao cobrem backend, front e wrapper.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`.
- [x] Publicar Functions e Hosting.

## File List

- `docs/stories/2026-06-11-admin-conceder-trial-assinaturas.md`
- `functions/index.js`
- `firebaseService.js`
- `admin.html`
- `scripts/admin/admin-main.js`
- `tests/admin-grant-free-trial.test.mjs`
- `tests/admin-pwa-responsive.test.mjs`
- `tests/admin-support-ui.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `menu-component.js`
- `sw.js`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `functions/.env` (limpeza local de variaveis sensiveis, sem valores)

## Evidencias

- `node --check functions/index.js`: OK.
- `node --check firebaseService.js`: OK.
- `node --check scripts/admin/admin-main.js`: OK.
- `node --test tests/admin-grant-free-trial.test.mjs tests/subscription-admin-notify.test.mjs tests/admin-assinaturas-empresas.test.mjs`: 4/4 OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: 138/138 OK.
- Deploy Functions: `grantAdminFreeTrial` publicado no projeto `sisweb-7ce82`.
- Segurança do deploy: `grantAdminFreeTrial` ficou usando `SMTP_PASS` via Secret Manager, sem variaveis locais sensiveis no ambiente da Function.
- Deploy Hosting: publicado em `https://sisweb-7ce82.web.app`.
- Verificacao remota HTTP: `admin.html`, `admin-main.js` e `firebaseService.js` carregam versao cacheada atual com botao/dialog/wrapper do Trial 30d.
- Verificacao no navegador: aba Assinaturas carregou 7 registros e exibiu `Trial 30d` para 2 clientes elegiveis; nenhuma concessao real foi acionada.
- Correcao posterior: `admin-main.js` e `admin.html` publicados com cachebuster `2026-06-11-admin-trial-v2`.
- Verificacao real no navegador apos login: `MADEIREIRA INTERLAGOS LTDA EPP` passou de exibicao enganosa `Expirada` para `Sem assinatura`, mantendo cadastro em `10/06/2026` e exibindo `Trial 30d`; nenhuma concessao real foi acionada.
- Correcao de cache desktop/PWA: `sw.js` e `menu-component.js` tambem foram versionados como `2026-06-11-admin-trial-v2` para instalar novo service worker e limpar caches antigos.
- Verificacao apos deploy de cache: Hosting remoto retornou `sw.js`, `menu-component.js`, `admin.html` e `admin-main.js` em `2026-06-11-admin-trial-v2`; navegador carregou a aba Assinaturas com 7 registros, Interlagos como `Sem assinatura` e `Trial 30d`, sem erros no console.
- Correcao no Dashboard desktop: `Sem assinatura` entrou no resumo operacional e na lista de ultimas assinaturas, ordenada por data real de evento/cadastro.
- Verificacao final no navegador do Codex: Dashboard mostrou total `7`, Interlagos em primeiro como `Sem assinatura` em `10/06/2026`; aba Assinaturas manteve `7 registros`, Interlagos como `Sem assinatura` e botao `Trial 30d`, sem erros no console.
