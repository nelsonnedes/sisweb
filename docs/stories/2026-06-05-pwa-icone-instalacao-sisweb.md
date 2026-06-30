# Story: Icone profissional de instalacao PWA Sisweb

## Contexto

O Sisweb usa `manifest.json` e service worker para instalacao PWA em PC e mobile. Os assets atuais em `assets/icons` podem ser exibidos como icone do app instalado.

## Problema

Os PNGs atuais de instalacao foram gerados com uma logo de empresa/tenant, o que mistura identidade do cliente com identidade do produto Sisweb.

## Objetivo

Substituir os icones de instalacao por uma identidade propria, profissional e neutra do Sisweb, refletindo ERP operacional para estoque, romaneios/logistica, documentos fiscais e folha, sem usar logo de nenhuma empresa cadastrada.

## Acceptance Criteria

- [x] Icones PWA deixam de usar logo de empresa/tenant.
- [x] Manifesto aponta para icones profissionais do Sisweb em tamanhos instalaveis.
- [x] Mobile/PWA tem suporte a icone Apple Touch para instalacao em iOS.
- [x] Service worker troca versao/cache para entregar os novos assets apos deploy.
- [x] Testes cobrem manifest, service worker e dimensoes dos PNGs.
- [x] Quality gates executados.

## Tasks

- [x] Auditar manifest/service worker/HTMLs que apontam icones.
- [x] Escolher uma direcao visual moderna e permissiva.
- [x] Criar SVG mestre do icone do Sisweb.
- [x] Gerar PNGs instalaveis.
- [x] Atualizar manifest e bootstrap PWA.
- [x] Adicionar testes de regressao.
- [x] Rodar quality gates.

## Dev Notes

- Usar icone de produto, nao logo de empresa.
- Preservar multitenancy: logos de empresa continuam apenas em relatorios/cadastros, nunca em manifest/PWA.

## File List

- `docs/stories/2026-06-05-pwa-icone-instalacao-sisweb.md`
- `manifest.json`
- `sw.js`
- `menu-component.js`
- `index.html`
- `login.html`
- `preromaneio.html`
- `src/services/pushService.js`
- `assets/icons/icon.svg`
- `assets/icons/icon-144x144.png`
- `assets/icons/icon-192x192.png`
- `assets/icons/icon-512x512.png`
- `assets/icons/apple-touch-icon.png`
- `favicon.ico`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`

## QA Notes

- Pesquisa: Lucide escolhido como referencia visual por ser biblioteca moderna de SVGs leves, consistentes, customizaveis e com licenca ISC; o icone Warehouse da Lucide e semanticamente ligado a storage, storehouse, logistics e building.
- Criado SVG mestre proprio do Sisweb com warehouse/logistica em estilo de traco moderno, logs para refletir o segmento madeireiro/romaneios e painel operacional para ERP.
- PNGs gerados via Playwright/Chromium a partir do SVG: `144x144`, `180x180` Apple Touch, `192x192` e `512x512`.
- `favicon.ico` regenerado a partir do novo icone.
- Browser QA local em 390x844 confirmou `index.html`, `login.html` e `preromaneio.html` com manifest, theme `#0f172a`, PNG `192x192`, Apple Touch, e imagens carregadas nas dimensoes esperadas.
- `node --check menu-component.js sw.js src/services/pushService.js`
- `node --test tests/pwa-install-icon.test.mjs tests/pwa-mobile-menu-session.test.mjs`
- `manifest.json` e `firebase.json` parseados como JSON valido.
- `npm run lint`
- `npm run typecheck`
- `npm test` (53 testes)
- `git diff --check` nos arquivos da story passou; apenas avisos de CRLF do Windows.
