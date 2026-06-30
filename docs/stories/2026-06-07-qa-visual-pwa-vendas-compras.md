# Story: QA visual PWA e desktop em modulos operacionais

## Contexto

O usuario reportou que, ao navegar visualmente pelo sistema em modo PC e PWA/mobile, ainda existem campos estourando a tela, layouts quebrados e redirecionamentos inesperados para o dashboard ao acessar abas/acoes como Novo Pedido.

## Analise

- [x] Navegar visualmente em desktop e mobile/PWA pelos modulos principais do menu.
- [x] Reproduzir redirecionamento para dashboard em acoes como Novo Pedido.
- [x] Mapear campos, tabelas e modais que geram overflow horizontal ou layout quebrado.
- [x] Separar falhas de layout de falhas de autenticacao/sessao.
- [x] Garantir que as correcoes preservem multi-tenant e desktop.

## Criterios de aceite

- [x] Vendas e Compras nao redirecionam indevidamente para dashboard ao abrir Novo Pedido/Listar/Relatorios.
- [x] Campos de Novo Pedido em Vendas/Compras nao estouram no PWA.
- [x] Modais e tabelas criticas ficam legiveis em cards/stack no mobile e preservam desktop.
- [x] Navegacao mobile nao perde sessao por cache antigo ou guard prematuro.
- [x] Evidencias de teste visual desktop/mobile registradas.
- [x] Gates executados.
- [x] Deploy executado se houver alteracao de producao.

## Evidencias

- Browser logado local em PWA 390x640: `vendas.html` e `compras.html` permaneceram na propria rota apos `Novo Pedido` e `Listar Pedidos`, sem redirect para dashboard e sem overflow de corpo.
- Browser logado local em PWA 390x640: `financas.html`, `fornecedor.html`, `notas-fiscais.html`, `user-profile.html` e `subscription-status.html` ficaram sem overflow horizontal de corpo.
- Browser logado local em PWA 390x640: Romaneios TL/PCT/PES/Tora mantiveram a pagina sem overflow de corpo; tabelas largas permanecem contidas em area propria de rolagem.
- Browser logado local em desktop 1280x800: `vendas.html`, `compras.html`, `financas.html`, `fornecedor.html`, Romaneios, NF-e, Perfil e Status nao geraram overflow de corpo.
- Gates: `npm run lint`, `npm run typecheck`, `npm test` com 84 testes passando.
- Deploy: `firebase deploy --only hosting` concluido; producao confirmou `sw.js`, `menu-component.js` e `commerce-responsive.css` com a versao `2026-06-07-visual-pwa-routes-v2`.

## Validacoes obrigatorias

- Seguranca e Performance: manter isolamento multi-tenant e evitar fallbacks que leiam/escrevam fora do tenant atual.
- Responsividade e Padronizacao: seguir o padrao Sisweb de cards mobile, controles com alvo de toque adequado e desktop preservado.
- Conformidade Legal: sem impacto em regras fiscais, trabalhistas, ambientais ou calculos oficiais.

## File list

- `auth.js`
- `commerce-responsive.css`
- `vendas.html`
- `vendas.js`
- `compras.html`
- `financas.html`
- `fornecedor.html`
- `notas-fiscais.html`
- `romaneio-comum.css`
- `preromaneio.html`
- `romaneiotl.html`
- `romaneiopct.html`
- `romaneiopes.html`
- `romaneiotora.html`
- `romaneiotora_otimizado.html`
- `romaneiotora_versao_dev.html`
- `user-profile.html`
- `subscription-status.html`
- `menu-component.js`
- `sw.js`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
