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
- `node --test tests/client-supplier-fiscal-fields.test.mjs tests/qa-visual-pwa-routes.test.mjs`
- `git diff --check`
- Smoke HTTP publicado: `sw.js`, `client.html`, `fornecedor.html`, `compras.html`
- `node --test tests/client-supplier-fiscal-fields.test.mjs`
- `node --test tests/commerce-responsive-pwa.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/compras-financeiro-status.test.mjs tests/operational-route-state.test.mjs`
- `npm run lint`
- `npm run typecheck`
- `npm test` (188/188)
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`
- `npm run security:postdeploy`
- Smoke HTTP publicado: `vendas.html`, `compras.html`, `fornecedor.html`, `openNewClientModal.js`, `compras.js`, `js/fornecedor.js`, `sw.js`
- Smoke de conteúdo publicado: cachebusters novos, `modalFornecedor`, ausência de `clientModal`, ausência de scripts de cliente em `compras.html`

### Completion Notes List
- Campos fiscais opcionais adicionados aos cadastros principais, abas nativas e modais operacionais de cliente/fornecedor.
- UF/Cidade deixaram de bloquear cadastro inicial nos fluxos operacionais cobertos pela story.
- Normalizadores e handlers preservam aliases fiscais esperados pela NF-e.
- Cachebuster atualizado para `2026-06-23-cadastro-fiscal-nfe-v1`.
- Validações locais concluídas com sucesso.
- Hosting publicado em `https://sisweb-7ce82.web.app`; smoke HTTP e `security:postdeploy` concluídos.
- Varredura posterior alinhou também `romaneiopct.html` e o modal dinâmico de `romaneiotora_modais.js`.
- Revalidação final após a extensão: `npm test` com 178/178, smoke HTTP dos arquivos publicados e `security:postdeploy` com 37/37.
- Correção visual posterior limitou altura dos modais longos de cliente/fornecedor, colocou campos em área rolável e manteve rodapé/botões visíveis em desktop e PWA.
- Service worker atualizado para `2026-06-30-client-supplier-modal-layout-v1` para invalidar cache visual.
- Hosting publicado após a correção e smoke HTTP confirmou os arquivos alterados no ambiente online.
- Modal rápido de cliente em pedido de venda passou a expor os campos fiscais opcionais completos e salvar priorizando `clientService.saveClient`.
- Modal rápido de fornecedor em pedido de compra foi padronizado com os campos fiscais, ganhou `Observações` e salva somente pelo serviço de fornecedores.
- `compras.html` não mantém mais o `clientModal` legado de fornecedor nem scripts de cliente que poderiam chamar `saveClient()` no fluxo de compras.
- `compras.js` e `js/fornecedor.js` deixaram de carregar `clients` como fallback de fornecedores, evitando mistura de entidades e gravação em caminhos errados.
- Modal principal de `fornecedor.html` alinhado ao visual do modal de clientes: cabeçalho escuro, fechamento por botão e ordem de campos fiscais equivalente.
- Service worker atualizado para `2026-06-30-pedido-contact-modals-v1`; Hosting publicado e smoke pós-deploy aprovado.

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
- `openNewClientModal.js`
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
- 2026-06-30: Ajuste responsivo dos modais longos de cliente/fornecedor e cobertura de teste contra rodapé oculto.
- 2026-06-30: Deploy de Hosting e smoke HTTP concluídos para cliente, fornecedor, compras e service worker.
- 2026-06-30: Modais rápidos de pedido alinhados aos cadastros fiscais e caminhos canônicos `clients`/`fornecedores` reforçados.
- 2026-06-30: Removido `clientModal` legado de compras e fallback indevido de fornecedores para `clients`; Hosting republicado.
