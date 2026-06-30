# Story: Aba nativa de fornecedores em Compras

## Status
Done

## Contexto
A aba Fornecedores em `compras.html` ainda dependia de `fornecedor.html?embedded=true` dentro de iframe, enquanto Vendas já havia recebido a correção para Clientes como aba nativa. A solicitação é aplicar o mesmo padrão em Compras/Fornecedores, preservando os serviços e dados existentes para não criar fonte paralela.

## Criterios de aceite
- [x] A aba Fornecedores em Compras não usa iframe nem carrega `fornecedor.html` embutido.
- [x] A aba apresenta busca, resumo, formulário e tabela de fornecedores no próprio DOM de `compras.html`.
- [x] As operações de carregar, salvar e excluir reutilizam `getData/saveData('fornecedores')`, sem duplicar backend.
- [x] Alterações de fornecedores atualizam o select do pedido e os filtros de pedidos/relatórios.
- [x] A experiência permanece responsiva com o padrão `mobile-cards`.
- [x] Correção publicada em Hosting.

## Tarefas
- [x] Substituir bloco embutido por aba nativa em `compras.html`.
- [x] Implementar carregamento/renderização/salvamento/exclusão em `compras.js`.
- [x] Atualizar testes do contrato das abas nativas.
- [x] Rodar gates locais completos.
- [x] Publicar Hosting e validar produção.

## Evidencias
- `node --check compras.js`: OK.
- `node --test tests/commerce-responsive-pwa.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/operational-route-state.test.mjs tests/compras-financeiro-status.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/pwa-install-icon.test.mjs`: OK, 33/33.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK, 174/174.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive --dry-run`: OK.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`: OK.
- Verificacao HTTP pos-deploy confirmou `compras.html` com `compras.js?v=2026-06-23-compras-fornecedores-native-v1`, painel `comprasFornecedoresPanel`, ausencia de `fornecedoresEmbeddedFrame`, `compras.js` com `carregarFornecedoresAbaCompra`/`comprasFornecedoresSalvar` e `sw.js` com `2026-06-23-compras-fornecedores-native-v1`.
- `npm run security:postdeploy`: OK, 37/37.

## File List
- `compras.html`
- `compras.js`
- `sw.js`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/compras-financeiro-status.test.mjs`
- `tests/operational-route-state.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
