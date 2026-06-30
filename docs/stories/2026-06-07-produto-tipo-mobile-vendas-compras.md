# Story: Tipo de produto responsivo em Vendas e Compras

## Contexto

O usuario marcou no Browser o grupo `Tipo de Produto` em `vendas.html` no PWA. Em telas pequenas, os radios herdavam largura de campo comum e os textos ficavam desalinhados/estourando visualmente.

## Analise

- [x] Localizar markup do grupo em `vendas.html`.
- [x] Verificar se `compras.html` usa o mesmo padrao.
- [x] Identificar heranca de `input { width: 100%; }` afetando `input[type="radio"]`.
- [x] Aplicar correcao compartilhada sem quebrar desktop.

## Criterios de aceite

- [x] Radios do `Tipo de Produto` nao herdam largura total.
- [x] Opcoes ficam alinhadas e legiveis no PWA/mobile.
- [x] Vendas e Compras usam a mesma correcao.
- [x] Validacao visual Browser mobile executada.
- [x] Gates executados.
- [x] Deploy executado.

## Validacoes obrigatorias

- Seguranca e Performance: ajuste apenas visual, sem leitura/escrita de dados e sem impacto multi-tenant.
- Responsividade e Padronizacao: grupo segue padrao de controles com area de toque e texto legivel em mobile.
- Conformidade Legal: sem impacto fiscal, trabalhista, ambiental ou em calculos oficiais.

## File list

- `commerce-responsive.css`
- `vendas.html`
- `compras.html`
- `fornecedor.html`
- `menu-component.js`
- `sw.js`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`

## Evidencias

- Validacao local via Chromium em `374x531` para `vendas.html` e `compras.html`: `bodyScrollWidth` igual ao viewport, radios com 18px, textos dentro dos labels e `anyOverflow: false`.
- Validacao em producao no Browser em `374x531` para `vendas.html` e `compras.html`: radios com 18px, grupo em grid e `anyOverflow: false`.
- Gates: `npm run lint`, `npm run typecheck`, `npm test` com 85 testes passando.
- Deploy hosting executado em `https://sisweb-7ce82.web.app`.
