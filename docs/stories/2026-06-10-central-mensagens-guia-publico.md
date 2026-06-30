# Story: Central de mensagens e guia publico de assinatura

Data: 2026-06-10

## Contexto

Foi solicitado aprimorar a comunicacao entre cliente e Admin a partir de `subscription-status.html`, reaproveitando a logica de tickets ja existente no sistema. Tambem foi solicitado que o manual completo nao exibisse menu para visitantes sem sessao e que `subscription.html` exibisse um Guia Rapido de Uso do Sistema abaixo dos planos.
Na iteracao seguinte, `subscription.html` tambem passou a abrir a Central de Mensagens pelo rodape "Fale Conosco" e por um CTA proprio entre os planos e o guia.
Depois foi identificado que o link publico sem login ainda dependia de uma callable autenticada para carregar planos e que a Central de Mensagens exibia acoes de ticket para visitantes. A correcao separou leitura publica de planos, sem dados sensiveis de pagamento, e ativou um modo publico da central sem tickets.
Em seguida foi solicitado envio direto de e-mail no modo publico usando o SMTP ja configurado. A solucao criada mantem credenciais SMTP apenas no backend, com Secret `SMTP_PASS`, rate limit publico e destinatarios resolvidos no servidor.
Na etapa seguinte, foi solicitado que tickets autenticados aceitassem anexos fora do modo publico, permitindo que usuarios logados enviem prints/PDFs de erro e que o Admin responda com prints explicativos. A implementacao reaproveita o tratamento de anexos do Storage Service: imagens sao comprimidas antes do upload, PDFs sao limitados, e o Realtime Database grava apenas metadados sanitizados.

## Checklist

- [x] Reaproveitar callables e modal de tickets existentes para mensagens cliente/Admin.
- [x] Criar entrada clara de Central de Mensagens em `subscription-status.html`.
- [x] Ajustar texto do Admin para refletir mensagens vindas de `subscription-status.html`.
- [x] Exibir modo publico em `ajuda.html` sem menu para visitante sem sessao real.
- [x] Direcionar visitantes do manual para registro/planos com cupom promocional.
- [x] Adicionar Guia Rapido em `subscription.html` abaixo dos cards de planos.
- [x] Permitir ampliar prints do guia e fechar para voltar ao guia.
- [x] Adicionar CTA visual de Central de Mensagens em `subscription.html` entre os planos e o guia.
- [x] Fazer o "Fale Conosco" do rodape em `subscription.html` abrir a Central de Mensagens.
- [x] Permitir leitura publica sanitizada das configuracoes comerciais para o link publico.
- [x] Adicionar fallback de planos padrao em `subscription.html` quando backend/cache estiver indisponivel.
- [x] Ocultar abas e botoes de ticket para visitantes publicos sem registro/login.
- [x] Exibir CTA de registro no modal publico para liberar tickets com historico.
- [x] Enviar e-mail publico pelo backend via SMTP sem expor credenciais no navegador.
- [x] Aplicar rate limit, honeypot, sanitizacao e log administrativo para contato publico.
- [x] Adicionar anexos autenticados em tickets de suporte, ocultos no modo publico.
- [x] Tratar imagens antes do upload para economizar Firebase Storage.
- [x] Permitir que Admin visualize anexos e responda com prints/PDFs.
- [x] Validar anexos no backend por tipo, tamanho, tenant e URL segura.
- [x] Atualizar cachebusters/PWA para a versao `2026-06-10-support-attachments-v1`.
- [x] Rodar quality gates completos.
- [x] Publicar Hosting.
- [x] Validar em producao.

## Arquivos

- `admin.html`
- `ajuda.html`
- `subscription-status.html`
- `subscription.html`
- `sw.js`
- `menu-component.js`
- `storageService.js`
- `storage.rules`
- `company.html`
- `login.html`
- `scripts/admin/admin-main.js`
- `styles/admin-premium.css`
- `functions/index.js`
- `tests/support-backend.test.mjs`
- `tests/admin-support-ui.test.mjs`
- `tests/subscription-status-help-guide.test.mjs`
- `tests/ajuda-manual-ilustrado.test.mjs`
- `docs/stories/2026-06-10-central-mensagens-guia-publico.md`

## Evidencias

- Parse de scripts inline/module em `subscription.html`, `subscription-status.html`, `ajuda.html`, `admin.html`, `login.html` e `company.html`.
- `node --test tests/subscription-status-help-guide.test.mjs tests/ajuda-manual-ilustrado.test.mjs tests/support-backend.test.mjs tests/admin-support-ui.test.mjs tests/subscription-checkout-pix.test.mjs tests/pwa-mobile-menu-session.test.mjs` (`29/29`)
- `npm run lint`
- `npm run typecheck`
- `npm test` (`133/133`)
- `firebase deploy --only hosting --project sisweb-7ce82`
- Verificacao HTTP de `subscription.html` publicado confirmou `menu-component.js?v=2026-06-10-admin-pwa-auth-v4`, `subscriptionMessageCenterCta`, `openSubscriptionPublicMessageCenter`, ligacao do rodape e ordem CTA antes do guia.
- Browser em producao: CTA e rodape "Fale Conosco" abriram o modal `Novo ticket`, preencheram o rascunho com o cupom `BLACKFRIDAI20` e nao geraram erros de console.
- `firebase deploy --only functions:getSubscriptionSettings --project sisweb-7ce82`
- Chamada publica sem auth para `getSubscriptionSettings` retornou `success: true`, planos reais, `public: true`, `freeTrialDays: 30`, sem `pixKey` e sem `beneficiary`.
- Navegador limpo em producao: `subscription.html?cupom=BLACKFRIDAI20` exibiu 4 cards (`Plano Gratis`, `Plano Mensal`, `Plano Trimestral`, `Plano Premium`) e nao exibiu "Planos indisponiveis" nos cards.
- Modal publico: abas `Novo ticket`/`Meus tickets` ocultas, nenhum botao `Enviar ticket` visivel, CTA `Registrar-se para abrir tickets` presente e rascunho preenchido com o cupom.
- `firebase deploy --only functions:sendPublicSupportEmail --project sisweb-7ce82`
- `firebase deploy --only hosting --project sisweb-7ce82`
- Chamada segura com honeypot para `sendPublicSupportEmail` retornou `success: true, skipped: true` sem acionar SMTP real.
- Navegador limpo em producao: modal publico exibiu botao `Enviar e-mail`, `window.firebaseService.sendPublicSupportEmail` disponivel, abas/tickets ocultos e rascunho com cupom preenchido.
- Implementacao local: `storageService.uploadSupportAttachment` cria anexos em `companies/{companyId}/support/tickets/...`, comprimindo imagens para ate 0,5MB/1280px quando possivel.
- Backend local: `normalizeSupportAttachments` limita a 3 anexos, 6MB, tipos imagem/PDF, bloqueia `data:`/`blob:` e confere tenant do Storage path.
- UI local: modal global exibe anexos para usuario logado e oculta em `support-public-mode`; Admin renderiza anexos no historico e permite anexar resposta.
- `node --check functions/index.js`, `menu-component.js`, `scripts/admin/admin-main.js`, `storageService.js`.
- `node --test tests/support-backend.test.mjs tests/admin-support-ui.test.mjs tests/subscription-status-help-guide.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/admin-pwa-responsive.test.mjs tests/company-logo-storage-policy.test.mjs` (`34/34`)
- `npm run lint`
- `npm run typecheck`
- `npm test` (`135/135`)
- `firebase deploy --only functions:default:createSupportTicket --project sisweb-7ce82`
- `firebase deploy --only functions:default:addSupportTicketMessage --project sisweb-7ce82`
- `firebase deploy --only "storage,hosting" --project sisweb-7ce82`
- Verificacao HTTP: `menu-component.js`, `storageService.js`, `scripts/admin/admin-main.js` e `sw.js` publicados com `2026-06-10-support-attachments-v1` e recursos de anexos.
- Browser em producao: `admin.html?tab=support` carregou assets versionados e sem erros de console.
- Browser em producao: `subscription.html?...verify=support-attachments-v1-browser` abriu Central de Mensagens publica com `support-public-mode`, botao `Enviar e-mail`, nenhum botao de ticket visivel e campos de anexo ocultos.
