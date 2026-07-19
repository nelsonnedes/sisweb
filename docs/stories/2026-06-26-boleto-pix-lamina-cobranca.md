# Story: Lâmina de Cobrança PIX com Visual de Boleto

## Contexto e Objetivo
Implementar a emissão de Lâmina de Cobrança PIX no formato visual de boleto bancário (sem código de barras) para contas do tipo "boleto" nas seções de contas a receber.
Nas contas a pagar, o financeiro continua exibindo o tipo operacional e o vínculo da compra, mas não expõe a lâmina de cobrança porque essa leitura é própria de recebíveis.

## Checklist de Implementação
- [x] FASE 1 — Criação do engine de PIX puro compartilhado (`js/pix-brcode.js`).
- [x] FASE 2 — Inclusão dos campos de PIX e dados bancários na tela de Cadastro de Empresa (`company.html`) e preenchimento/limpeza correspondentes.
- [x] FASE 3 — Criação do gerador de PDF (`js/commerce-boleto-pix.js`) que compõe o layout de boleto com o QR Code.
- [x] FASE 4 — Adição do botão de boleto na listagem do financeiro (`financas.js`) e mapeamento do clique para abrir a lâmina.
- [x] FASE 5 — Sanitização dos novos campos PIX no Cloud Function (`functions/index.js`).
- [x] FASE 7 — Testes automatizados, elevação da versão no Service Worker (`sw.js`) e homologação final.

## Alterações de Código Efetuadas
- **[NEW] `js/pix-brcode.js`**: Reutiliza a lógica EMV BR Code oficial do BACEN extraída da folha de pagamento.
- **[NEW] `js/commerce-boleto-pix.js`**: Gerador da lâmina em formato PDF via jsPDF com inserção de QR Code PIX.
- **[MODIFY] `company.html`**: Seção "Dados Bancários / PIX para Cobrança" adicionada com selects e inputs específicos.
- **[MODIFY] `financas.js`**: Inclusão de botão condicional (ícone de código de barras) na coluna de Ações para contas cujo tipo é boleto.
- **[MODIFY] `financas.html`**: Inclusão dos scripts criados e do gerador de QR Code como dependência.
- **[MODIFY] `functions/index.js`**: Adicionada sanitização nas funções `upsertCompanyProfile` e `updateMyCompanyProfile` para não haver perda de dados.
- **[MODIFY] `financas.js`**: A lâmina passou a ser exclusiva de `contas a receber`; em `contas a pagar` o tipo operacional continua visível via `tipoPagamento`, mas sem ação de boleto.
- **[MODIFY] `financas.js`**: Edição manual de contas a pagar agora sincroniza `tipo`, `tipoPagamento` e `tipo_pagamento`, carrega o tipo operacional legado no formulário e preserva categorias normalizadas sem falso `outros`.
- **[MODIFY] `financas.js`**: O filtro Tipo de contas a receber usa o mesmo normalizador operacional de contas a pagar, exibindo `boleto`, `pix` e demais formas reais em vez do rótulo genérico `receber`.
- **[MODIFY] `company.html`**: Recomposta a proteção do perfil da empresa via `updateMyCompanyProfile`, georeferenciamento com QR de navegação, cachebusters atuais e cards operacionais sem ação destrutiva de tenant.
- **[MODIFY] `src/services/firebaseService.js`**: Upload de logo usa caminho canônico `companies/{tenant}/profile/logo/current`, normaliza URL tokenizada e delega a limpeza para depois da persistência do perfil.
- **[MODIFY] `firebaseService.js`**: O perfil normalizado para relatorios preserva `pixChaveCobranca`, `pixTipoChaveCobranca`, `pixFavorecidoCobranca` e `pixBancoCobranca`, evitando falso cadastro incompleto na lamina.

## Evidencias
- `node --test tests/boleto-pix-lamina.test.mjs`: OK.
- `npm test`: OK.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`: OK.
- Verificacao HTTP confirmou `sw.js` publicado com `APP_VERSION = '2026-06-26-boleto-pix-lamina-v3'`.
- Verificacao HTTP confirmou `financas.html` publicando `js/commerce-boleto-pix.js` e `js/pix-brcode.js`.
- Verificacao HTTP confirmou `js/commerce-boleto-pix.js` contendo `loadJsPdf`, `generateQrCodeDataUrl` e o titulo da lâmina.
- Correção posterior: `financas.js` mantém o tipo operacional visível em contas a pagar, mas bloqueia a lâmina de boleto nessas linhas para preservar a lógica de cobrança.
- Validação posterior: `npm run lint`, `npm run typecheck`, pacote direcionado PWA/empresa/storage/financeiro e `npm test` completo passaram.
- Correção posterior: `node --test tests/financas-contas-pagar-edit.test.mjs` cobre a edição de conta a pagar vinda de compras, trocando `tipoPagamento` legado de boleto para pix sem deixar o valor antigo dominar a exibição.
- Revisao CodeRabbit de 2026-07-15: dropdown Tipo de contas a receber normalizado simetricamente; teste focado e suite completa 223/223 aprovados.
- Correcao publicada no Hosting live na versao `a6dee04d9afafb59`. O smoke autenticado final ficou pendente porque a sessao salva expirou; sem sessao, a Home redirecionou corretamente ao Login e nenhum dado real foi alterado.
- Correcao final publicada no Hosting em 2026-07-18 com cache `2026-07-19-finance-print-pix-v1`; verificacao HTTP confirmou os assets atualizados.
- Smoke autenticado pos-deploy: uma conta a receber filtrada como boleto acionou a lamina sem o erro "Complete os dados PIX da Empresa". Os quatro campos ja estavam persistidos e passaram pelo normalizador do perfil.
- `node --test tests/boleto-pix-lamina.test.mjs tests/financas-relatorios-exportacoes.test.mjs`: coberturas focadas aprovadas; `npm test` finalizou com 277 aprovados, 0 falhas e 1 skip esperado do Emulator.

## File List
- `js/pix-brcode.js`
- `js/commerce-boleto-pix.js`
- `company.html`
- `financas.js`
- `financas.html`
- `functions/index.js`
- `firebaseService.js`
- `src/services/firebaseService.js`
- `sw.js`
- `tests/boleto-pix-lamina.test.mjs`
- `tests/financas-contas-pagar-edit.test.mjs`
- `tests/client-supplier-fiscal-fields.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/tenant-operational-safe-modules.test.mjs`
- `docs/stories/2026-06-26-boleto-pix-lamina-cobranca.md`
