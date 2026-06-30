# Story: Lâmina de Cobrança PIX com Visual de Boleto

## Contexto e Objetivo
Implementar a emissão de Lâmina de Cobrança PIX no formato visual de boleto bancário (sem código de barras) para contas do tipo "boleto" nas seções de contas a receber e contas a pagar.

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

## Evidencias
- `node --test tests/boleto-pix-lamina.test.mjs`: OK.
- `npm test`: OK.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`: OK.
- Verificacao HTTP confirmou `sw.js` publicado com `APP_VERSION = '2026-06-26-boleto-pix-lamina-v3'`.
- Verificacao HTTP confirmou `financas.html` publicando `js/commerce-boleto-pix.js` e `js/pix-brcode.js`.
- Verificacao HTTP confirmou `js/commerce-boleto-pix.js` contendo `loadJsPdf`, `generateQrCodeDataUrl` e o titulo da lâmina.

## File List
- `js/pix-brcode.js`
- `js/commerce-boleto-pix.js`
- `company.html`
- `financas.js`
- `financas.html`
- `functions/index.js`
- `sw.js`
- `tests/boleto-pix-lamina.test.mjs`
- `docs/stories/2026-06-26-boleto-pix-lamina-cobranca.md`
