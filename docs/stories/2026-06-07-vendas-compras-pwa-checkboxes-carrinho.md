# Story: Padronizacao PWA de Vendas e Compras

## Contexto

O usuario marcou novos pontos no Browser em `vendas.html` e `compras.html`: checkboxes grandes/desalinhados, bloco de romaneio apertado, carrinho de itens com textos sobrepostos e necessidade de analisar abas/modais dos dois modulos para manter padrao PWA.

## Analise

- [x] Inventariar abas, tabelas e modais de `vendas.html`.
- [x] Inventariar abas, tabelas e modais de `compras.html`.
- [x] Usar agente especialista para revisar lacunas de UX/PWA.
- [x] Confirmar causa raiz: `input, select, textarea { width: 100%; }` afetando checkboxes.
- [x] Identificar conflito do carrinho de Compras com `table-layout: fixed` e seletor local de `#itensTable`.

## Criterios de aceite

- [x] Checkboxes ficam compactos e alinhados em Vendas e Compras.
- [x] Bloco de romaneio usa o mesmo padrao responsivo nos dois modulos.
- [x] Carrinho de itens vira card legivel no PWA sem quebrar tabela no desktop.
- [x] Renders dinamicos acionam a camada responsiva compartilhada.
- [x] Validacao visual Browser mobile executada.
- [x] Gates executados.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: alteracao visual/DOM, sem leitura ou escrita extra em dados de tenant.
- Responsividade e Padronizacao: Vendas e Compras compartilham `commerce-responsive.css/js`, mantendo textos especificos de cada modulo.
- Conformidade Legal: sem impacto em regras fiscais, trabalhistas, ambientais ou calculos oficiais.

## File list

- `commerce-responsive.css`
- `vendas.html`
- `compras.html`
- `fornecedor.html`
- `vendas.js`
- `compras.js`
- `menu-component.js`
- `sw.js`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`

## Evidencias

- Agente especialista UX/PWA confirmou lacunas em checkboxes, romaneio, carrinho de Compras e card mobile com `padding-left`.
- Browser local em `374x531`: Vendas e Compras com romaneio visivel, checkbox de agrupamento com `18px`, bloco em grid e sem overflow horizontal.
- Browser local em `374x531`: Relatorios de Vendas com `Mostrar so disponivel` em controle de 44px, checkbox com `18px` e sem overflow.
- Auditoria local em `374x531` percorreu Vendas/Compras: inicial, Novo Pedido, Romaneio, Lista de Pedidos, Produtos, Modal Produto e Relatorios, sem overflow horizontal, sem checkbox fora do padrao e sem cards estourando.
- Validacao controlada do carrinho com dados ficticios em Vendas e Compras: celulas `Produto`, `Quantidade`, `Preco Unit.`, `Total` e `Acoes` sem overflow; acoes ocupando largura total do card.
- Gates: `node --test tests/qa-visual-pwa-routes.test.mjs tests/commerce-responsive-pwa.test.mjs tests/pwa-install-icon.test.mjs tests/pwa-mobile-menu-session.test.mjs`, `npm run lint`, `npm run typecheck`, `npm test` com 86 testes passando.
- Deploy hosting executado em `https://sisweb-7ce82.web.app`.
- Pos-deploy: `sw.js` publica `2026-06-07-romaneio-cart-mobile-v1`; `commerce-responsive.css` em producao contem regras de checkbox compacto, `.romaneio-actions`, `.commerce-cart-table-wrap`, grid de cards e acoes em largura total.
- Browser em producao: `vendas.html` e `compras.html` carregam `commerce-responsive.css?v=2026-06-07-romaneio-cart-mobile-v1`, contem `.romaneio-actions` e nao apresentam overflow horizontal em viewport pequeno.
