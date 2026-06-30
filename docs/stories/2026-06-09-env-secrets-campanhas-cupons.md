# Story: Secrets SMTP e plano profissional de campanhas/cupons

Data: 2026-06-09

## Contexto

O deploy de Functions ainda emitia alerta de migracao para `.env`/Secret Manager. A auditoria local nao encontrou `functions.config()` em uso no codigo, mas encontrou a senha SMTP em `process.env.SMTP_PASS`, usada por e-mails de suporte e notificacoes comerciais.

Tambem foi solicitado estudo da aba Campanhas do `admin.html` para evoluir cupons promocionais, link publico de compartilhamento e uma oferta comercial do Sisweb para o segmento madeireiro.

## Checklist

- [x] Auditar uso atual de `functions.config()`, `.env`, `defineSecret` e SMTP.
- [x] Migrar `SMTP_PASS` para Firebase Secret Manager no codigo.
- [x] Vincular o Secret somente as funcoes que enviam e-mail.
- [x] Manter fallback local para emulador/testes sem expor segredo real.
- [x] Atualizar exemplo de `.env` sem credenciais reais.
- [x] Levantar fluxo atual de Campanhas/Cupons em `admin.html`, `subscription.html`, `firebaseService.js` e `functions/index.js`.
- [x] Cadastrar `SMTP_PASS` no Secret Manager do projeto antes de publicar Functions.
- [x] Rodar deploy das funcoes dependentes de SMTP apos o Secret existir.
- [x] Implementar Prioridade 1 da frente de Campanhas/Cupons.
- [x] Implementar botoes de compartilhamento no Admin para cupons ativos.
- [x] Implementar CRUD administrativo de cupons via Cloud Functions dedicadas.
- [x] Bloquear escrita direta do cliente no caminho raiz `system`.
- [ ] Implementar pagina/link comercial publico completo para campanhas.

## Achados de Secrets

- Nao ha uso ativo de `functions.config()` no codigo-fonte atual.
- Mercado Pago ja usa `defineSecret` para `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_TOKEN` e `MERCADO_PAGO_WEBHOOK_URL`.
- `SMTP_PASS` ainda estava como variavel comum. Foi migrado para `defineSecret('SMTP_PASS')`.
- As funcoes que precisam receber esse Secret sao:
  - `createSupportTicket`
  - `addSupportTicketMessage`
  - `sendSubscriptionEmail`
- O Secret `SMTP_PASS` foi cadastrado no Secret Manager e as funcoes dependentes foram publicadas.
- O primeiro deploy falhou porque `runWith` nao existe no import raiz de `firebase-functions`; o codigo foi corrigido para `firebase-functions/v1`.
- A primeira entrega de cupons corrigiu `plan`/`planId`/`planKey`, normalizou codigo de cupom para caminho seguro e habilitou preenchimento por `?cupom=`, `?promo=` e `?coupon=`.
- A segunda entrega habilitou botoes no Admin para copiar link publico e compartilhar cupom ativo via WhatsApp.
- A terceira entrega tirou listagem, edicao e arquivamento de cupons do acesso direto ao RTDB e passou tudo por Cloud Functions administrativas com validacao server-side.

## Plano Campanhas/Cupons

### Prioridade 1: corrigir confiabilidade dos cupons existentes

- [x] Corrigir incompatibilidade entre `subscription.html` e `validatePromoCode`: o frontend envia `plan`, enquanto a Function valida `planId`.
- [x] Aceitar `plan`, `planId` e `planKey` no backend para compatibilidade.
- [x] Preencher cupom automaticamente quando a URL trouxer `?cupom=CODIGO`, `?promo=CODIGO` ou `?coupon=CODIGO`.
- Mostrar somente cupons realmente ativos como ativos: `active=true`, nao expirado, nao esgotado.
- Registrar auditoria quando cupom for criado, editado, ativado, desativado ou usado.

### Prioridade 2: tirar CRUD sensivel do acesso generico

- [x] Substituir `saveToFirebase("system/promocodes", ...)` e `getAll("system/promocodes")` por Cloud Functions administrativas:
  - `listPromoCodesAdmin`
  - `getPromoCodeAdmin`
  - `upsertPromoCodeAdmin`
  - `archivePromoCodeAdmin`
- [x] Validar no servidor: codigo, tipo, valor maximo, validade, limite de usos, planos permitidos e status.
- [x] Preservar `currentUses` no servidor para o cliente nao zerar contador de uso por acidente.
- [x] Bloquear cupom arquivado no fluxo publico de validacao/aplicacao.
- [ ] Evitar cupom ilimitado sem validade por padrao; sugerir expiracao e limite em tela.

### Prioridade 3: link publico de compartilhamento

- [x] Criar link publico por cupom ativo usando `subscription.html?cupom=CODIGO` enquanto a pagina comercial completa nao existir.
- [x] No Admin, cada cupom ativo tem botoes para copiar link e abrir WhatsApp com texto pronto.
- [ ] Evoluir para pagina publica dedicada, por exemplo:
  - `https://sisweb-7ce82.web.app/campanha-sisweb.html?cupom=SISWEBMADEIRA&utm_source=whatsapp&utm_medium=social&utm_campaign=madeireiro`
- [ ] Adicionar botoes para copiar texto comercial separado e abrir pagina publica para conferencia.
- Se o usuario ainda nao estiver logado, a pagina publica deve preservar o cupom e levar para login/cadastro/assinatura sem perder o parametro.

### Prioridade 4: pagina comercial publica

- Criar uma pagina publica objetiva para vender o Sisweb ao setor madeireiro.
- Conteudo recomendado:
  - gestao de toras e estoque por especie, bitola, volume e rastreabilidade
  - desdobramento de toras e acompanhamento de rendimento
  - romaneios, compras, vendas e financeiro integrados
  - controle de clientes, fornecedores, produtos, contas a pagar/receber
  - impressoes e relatorios com logo da empresa
  - operacao multitenant, PWA e acesso por celular/desktop
  - suporte, assinatura, PIX e renovacao pelo sistema
- A chamada principal deve ser clara: "Sisweb - Sistema para gestao madeireira, toras, estoque, vendas e desdobramentos".

### Prioridade 5: indicadores de campanha

- Mostrar no Admin:
  - visitas por cupom/link
  - cupons aplicados
  - pagamentos aprovados com cupom
  - conversao por origem: WhatsApp, Instagram, Facebook, indicacao direta
  - receita bruta, desconto concedido e receita liquida estimada
- Guardar eventos leves no RTDB, sem criar custo desnecessario.

## Arquivos

- `functions/index.js`
- `functions/.env.example`
- `subscription.html`
- `admin.html`
- `firebaseService.js`
- `database.rules.json`
- `sw.js`
- `menu-component.js`
- `scripts/admin/admin-main.js`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/admin-support-ui.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/security-rbac-multitenant.test.mjs`
- `tests/support-backend.test.mjs`
- `tests/subscription-checkout-pix.test.mjs`
- `docs/stories/2026-06-09-env-secrets-campanhas-cupons.md`

## Evidencias

- `node --check functions/index.js`
- `node --test tests/support-backend.test.mjs tests/subscription-admin-notify.test.mjs`
- `npm --prefix functions run lint`
- `npm run lint`
- `npm run typecheck`
- `node --test tests/subscription-checkout-pix.test.mjs`
- `node --test tests/admin-support-ui.test.mjs tests/subscription-checkout-pix.test.mjs tests/subscription-admin-notify.test.mjs`
- `node --test tests/subscription-checkout-pix.test.mjs tests/admin-support-ui.test.mjs tests/security-rbac-multitenant.test.mjs`
- `node --check firebaseService.js`
- `node --check scripts/admin/admin-main.js`
- Validacao do script inline final de `subscription.html` via `new Function(...)`
- `npm test` (`126/126`)
- `npm test` (`127/127`)
- `firebase functions:secrets:describe SMTP_PASS --project sisweb-7ce82`
- `firebase deploy --only "functions:createSupportTicket,functions:addSupportTicketMessage,functions:sendSubscriptionEmail" --project sisweb-7ce82`
- `firebase deploy --only "hosting,functions:validatePromoCode" --project sisweb-7ce82`
- `firebase deploy --only "functions:listPromoCodesAdmin,functions:getPromoCodeAdmin,functions:upsertPromoCodeAdmin,functions:archivePromoCodeAdmin,functions:validatePromoCode,functions:submitSubscriptionRequest,functions:createPixPayment,functions:createPaymentPreference,hosting,database" --project sisweb-7ce82`
- `firebase deploy --only hosting --project sisweb-7ce82`
- Verificacao HTTP de `https://sisweb-7ce82.web.app/subscription.html?verify=promo-link-v1`
- Verificacao HTTP de `https://sisweb-7ce82.web.app/admin.html?verify=promo-share-v4` carregando `admin-main.js?v=2026-06-10-promo-share-v1`
- Verificacao no browser interno de `admin.html?tab=campaign&verify=promo-share-v4-browser`: painel de campanhas visivel, acoes de cupom renderizadas e sem erros de console.
- `firebase functions:list --project sisweb-7ce82`
- Verificacao HTTP pos-cache de `admin.html`, `sw.js` e `scripts/admin/admin-main.js?v=2026-06-10-promo-crud-functions-v2`: scripts com cachebuster v2, service worker v2, novas funcoes administrativas presentes e nenhuma chamada direta a `system/promocodes` no Admin.
- Verificacao no browser interno de `admin.html?tab=campaign&verify=promo-crud-functions-v2-clean`: painel de campanhas carregado, quatro acoes de cupom renderizadas, botao de arquivar abrindo confirmacao e cancelamento sem alterar cupom.
- Auditoria em 2026-06-10 confirmou que o codigo atual nao usa `functions.config()` e que `SMTP_PASS` esta em Secret Manager.
- `firebase deploy --only "functions:default:sendSubscriptionEmail,functions:default:sendPublicSupportEmail" --project sisweb-7ce82`
- `firebase deploy --only "functions:default:createSupportTicket,functions:default:addSupportTicketMessage" --project sisweb-7ce82`
- `firebase functions:config:unset smtp --project sisweb-7ce82`
- `firebase functions:config:get --project sisweb-7ce82` retornou Runtime Config vazio.
- `firebase deploy --only "functions:default:sendSubscriptionEmail,functions:default:sendPublicSupportEmail,functions:default:createSupportTicket,functions:default:addSupportTicketMessage" --project sisweb-7ce82` concluiu sem o aviso de deprecacao de `functions.config()`.
- `functions/.env` local manteve apenas `SMTP_PASS_LOCAL` como fallback de desenvolvimento; a chave comum `SMTP_PASS` foi removida sem expor valor.
- Novo deploy escopado das quatro funcoes SMTP concluiu sem o aviso de deprecacao de `functions.config()`.
