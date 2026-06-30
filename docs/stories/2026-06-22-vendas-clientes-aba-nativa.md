# Story: Aba nativa de clientes em Vendas

## Status
Done

## Contexto
A aba Clientes em `vendas.html` carregava `client.html?embedded=true` dentro de um iframe. O fluxo funcionava como atalho, mas gerava uma experiência menos integrada em Vendas e mantinha acoplamento visual entre páginas. A solicitação é transformar Clientes em uma aba real, profissional e responsiva dentro de Vendas.

## Criterios de aceite
- [x] A aba Clientes em Vendas não usa iframe nem abre `client.html` embutido.
- [x] A aba apresenta busca, filtro, resumo, formulário e tabela de clientes no próprio DOM de `vendas.html`.
- [x] As operações de carregar, salvar e excluir reutilizam `client-service.js`, sem duplicar backend ou criar nova fonte de dados.
- [x] Alterações de clientes atualizam o select de pedido e os filtros de relatórios.
- [x] A experiência permanece responsiva com o padrão `mobile-cards`.
- [x] Correção publicada em Hosting.

## Tarefas
- [x] Substituir bloco embutido por aba nativa em `vendas.html`.
- [x] Implementar carregamento/renderização/salvamento/exclusão em `vendas.js`.
- [x] Atualizar testes do contrato da aba de clientes.
- [x] Rodar gates locais.
- [x] Publicar Hosting e validar produção.

## Evidencias
- `node --test tests/commerce-responsive-pwa.test.mjs tests/qa-visual-pwa-routes.test.mjs`: OK durante a validacao focada da aba nativa.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK, 174/174.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive --dry-run`: OK.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`: OK.
- Verificacao HTTP pos-deploy confirmou `vendas.html` publicado com `vendas.js?v=2026-06-22-vendas-clientes-native-v1`.
- `npm run security:postdeploy`: OK, 37/37.

## File List
- `vendas.html`
- `vendas.js`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/operational-route-state.test.mjs`
- `tests/vendas-tenant-auth-guard.test.mjs`
- `tests/vendas-financeiro-status.test.mjs`
