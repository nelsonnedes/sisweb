# Story: Cadastros de Clientes e Fornecedores com Campos Fiscais NF-e

Status: Ready for Review

## Story
Como operador do Sisweb,
quero que todos os cadastros e modais de clientes/fornecedores tenham os campos fiscais exigidos para emissão de NF-e,
para poder completar os dados antes da emissão sem bloquear o cadastro inicial.

## Acceptance Criteria
- Cadastros principais de clientes e fornecedores incluem CPF/CNPJ, tipo de pessoa, indicador IE, IE, IM, SUFRAMA, endereço completo, código IBGE do município e país.
- Abas nativas de Vendas/Clientes e Compras/Fornecedores incluem os mesmos campos fiscais.
- Modais operacionais de clientes e fornecedores incluem os mesmos campos quando usados para cadastro/edição.
- Apenas Nome/Razão Social permanece obrigatório no cadastro inicial; UF/Cidade e campos fiscais não bloqueiam o salvamento imediato.
- Normalizadores e serviços preservam aliases fiscais usados por NF-e: `documento`, `indIEDest`, `inscricaoEstadual`, `inscricaoMunicipal`, `cMun`, `cPais`, `xPais`.
- PWA/Hosting usam cachebuster novo para evitar servir UI antiga.

## Tasks / Subtasks
- [x] Mapear telas e modais operacionais de clientes/fornecedores.
- [x] Adicionar campos fiscais opcionais nos cadastros principais.
- [x] Adicionar campos fiscais opcionais nas abas nativas Vendas/Clientes e Compras/Fornecedores.
- [x] Adicionar campos fiscais opcionais nos modais operacionais de cliente/fornecedor.
- [x] Preservar aliases fiscais nos normalizadores e handlers de salvamento.
- [x] Atualizar cachebuster do PWA/Hosting.
- [x] Rodar validações e testes.
- [x] Fazer deploy de Hosting e smoke pós-deploy.

## Dev Agent Record

### Agent Model Used
GPT-5 Codex

### Debug Log References
- `node --check` nos JS alterados
- `node --test tests/client-supplier-fiscal-fields.test.mjs`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`
- `npm run security:postdeploy`

### Completion Notes List
- Campos fiscais opcionais adicionados aos cadastros principais, abas nativas e modais operacionais de cliente/fornecedor.
- UF/Cidade deixaram de bloquear cadastro inicial nos fluxos operacionais cobertos pela story.
- Normalizadores e handlers preservam aliases fiscais esperados pela NF-e.
- Cachebuster atualizado para `2026-06-23-cadastro-fiscal-nfe-v1`.
- Validações locais concluídas com sucesso.
- Hosting publicado em `https://sisweb-7ce82.web.app`; smoke HTTP e `security:postdeploy` concluídos.
- Varredura posterior alinhou também `romaneiopct.html` e o modal dinâmico de `romaneiotora_modais.js`.
- Revalidação final após a extensão: `npm test` com 178/178, smoke HTTP dos arquivos publicados e `security:postdeploy` com 37/37.

### File List
- `client.html`
- `fornecedor.html`
- `vendas.html`
- `compras.html`
- `preromaneio.html`
- `romaneiopes.html`
- `romaneiopct.html`
- `romaneiotora.html`
- `romaneiotora_modais.js`
- `js/client.js`
- `js/fornecedor.js`
- `vendas.js`
- `compras.js`
- `client-service.js`
- `romaneios-client-save-fix.js`
- `client-modal-handler.js`
- `fornecedor-modals.js`
- `romaneiotora.js`
- `modules/modals/modal-clientes.js`
- `modules/romaneiopct/modal-clientes-pct.js`
- `modules/crud/gerenciar-clientes.js`
- `standardized-client-modal.js`
- `sw.js`
- `tests/client-supplier-fiscal-fields.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/compras-financeiro-status.test.mjs`
- `tests/operational-route-state.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/vendas-financeiro-status.test.mjs`
- `tests/vendas-tenant-auth-guard.test.mjs`

### Change Log
- 2026-06-23: Campos fiscais NF-e opcionais adicionados e normalizadores reforçados.
- 2026-06-23: Lint, typecheck e suíte completa passaram; story pronta para revisão após deploy.
- 2026-06-23: Deploy de Hosting concluído e smoke pós-deploy aprovado.
- 2026-06-23: Correção estendida para o modal ativo de cliente PCT e modal dinâmico de fornecedor Tora.
- 2026-06-23: Revalidação final pós-deploy aprovada em produção.
