# Story: Menu mobile, sessao PWA, Vendas e Compras responsivos

## Contexto

O usuario reportou que no Super Admin o suporte aparece no dropdown de engrenagem, que em mobile o sininho e a engrenagem aparecem dentro da sidebar, e que `vendas.html`/`compras.html` possuem inconsistencias visuais em Novo Pedido, Listar Pedidos, Relatorios e modais. Tambem ha relatos de navegacao mobile/PWA pedindo login novamente em alguns fluxos.

## Analise

- [x] Verificar se suporte no dropdown do Super Admin e duplicado ou deve ficar restrito a fila/admin.
- [x] Separar controles globais de alertas/configuracoes da sidebar mobile, mantendo ordem: sininho, engrenagem.
- [x] Garantir cachebuster consistente para `menu-component.js` nas telas de Vendas e Compras.
- [x] Revisar guard de autenticacao/navegacao para evitar logout visual durante troca de modulos no PWA.
- [x] Adaptar tabelas e modais de Vendas para cards/controles responsivos no mobile sem degradar desktop.
- [x] Adaptar tabelas e modais de Compras para cards/controles responsivos no mobile sem degradar desktop.

## Criterios de aceite

- [x] Topbar mobile mostra alertas e configuracoes no topo, a direita, na ordem sininho e engrenagem.
- [x] Sidebar mobile fica focada em navegacao e logout, sem duplicar alertas/configuracoes como itens internos.
- [x] Super Admin nao ve suporte generico duplicado na engrenagem quando ja existe Fila de Suporte.
- [x] Vendas tem Novo Pedido, Listar Pedidos, Relatorios e modais com leitura/acoes consistentes em PWA.
- [x] Compras tem Novo Pedido, Listar Pedidos, Relatorios e modais com leitura/acoes consistentes em PWA.
- [x] Navegacao mobile usa scripts atualizados e nao induz relogin por cache antigo.
- [x] Gates executados.
- [x] Deploy executado.

## Evidencias

- `node --check` executado para `compras.js`, `vendas.js`, `menu-component.js`, `auth.js`, `firebaseService.js` e `commerce-responsive.js`.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `npm test` passou com 78 testes.
- Verificacao Playwright mobile em harness temporario confirmou topbar, ordem sininho/engrenagem, logout na sidebar e cards mobile.
- Deploy Hosting executado em `https://sisweb-7ce82.web.app`.
- Validacao pos-deploy confirmou `commerce-responsive` em Vendas/Compras, `menu-component.js` com quick actions e `sw.js` na versao `2026-06-07-commerce-pwa-menu-v1`.

## Validacoes obrigatorias

- Seguranca e Performance: manter multi-tenant, nao abrir caminhos diretos fora das regras e evitar caches antigos que causem estado de sessao inconsistente.
- Responsividade e Padronizacao: aplicar padroes ja usados em Folha/Estoque, com cards mobile e desktop preservado.
- Conformidade Legal: sem impacto em calculos fiscais, folha, trabalhistas ou regras ambientais.

## File list

- `menu-component.js`
- `menu.css`
- `sw.js`
- `auth.js`
- `firebaseService.js`
- `commerce-responsive.css`
- `commerce-responsive.js`
- `vendas.html`
- `compras.html`
- `compras.js`
- `login.html`
- `admin.html`
- `scripts/admin/admin-main.js`
- `index.html`
- `preromaneio.html`
- Paginas HTML com cachebuster atualizado para `menu-component.js?v=2026-06-07-commerce-pwa-menu-v1`.
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/admin-support-ui.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
