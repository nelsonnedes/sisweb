# Story: Instalacao PWA e atualizacao pelo Firebase Hosting

## Status
Ready for Review

## Contexto
O Sisweb ja possui manifesto e service worker para PWA, mas a opcao de instalacao aparece somente no Pre-Romaneio e o service worker atual usa cache-first em arquivos da aplicacao.

## Problema
Ao acessar o sistema em um PC ainda nao instalado, a opcao de instalar pode nao aparecer fora de `preromaneio.html`. Quando o sistema esta instalado, o cache do service worker pode entregar arquivos antigos mesmo apos novo deploy no Firebase Hosting.

## Objetivo
Disponibilizar a opcao de instalacao em telas que usam o menu comum e garantir que o app instalado priorize sempre a versao online mais recente quando houver conexao.

## Acceptance Criteria
- [x] Manifesto PWA aponta para o Sisweb como aplicacao principal e usa icones PNG instalaveis.
- [x] Telas com `main-menu` registram manifesto/service worker e exibem opcao de instalacao quando o navegador liberar `beforeinstallprompt`.
- [x] Service worker prioriza rede para navegacao, scripts e estilos, usando cache apenas como fallback offline.
- [x] Firebase Hosting nao mantem HTML, JS, CSS, JSON, manifesto ou service worker em cache persistente.
- [x] Implementacao antiga duplicada do Pre-Romaneio nao conflita com a opcao global.
- [x] Validacoes possiveis foram executadas e registradas.

## File List
- `docs/stories/2026-05-20-pwa-instalacao-atualizacao-hosting.md`
- `manifest.json`
- `sw.js`
- `firebase.json`
- `menu-component.js`
- `preromaneio.html`
- `assets/icons/icon-144x144.png`
- `assets/icons/icon-192x192.png`
- `assets/icons/icon-512x512.png`

## Implementacao
- Manifesto alterado de "Pre-Romaneio Mobile" para "Sisweb", com `start_url` e `scope` na raiz do sistema.
- Icones PWA `144`, `192` e `512` recriados como PNG real a partir do logo existente.
- `menu-component.js` passou a inicializar PWA de forma global: injeta manifesto/theme-color, registra `/sw.js`, verifica atualizacoes ao carregar/focar e exibe opcao "Instalar aplicativo" quando `beforeinstallprompt` estiver disponivel.
- Adicionado botao flutuante "Instalar Sisweb" para tornar a opcao visivel no PC quando o navegador considerar o app instalavel.
- `sw.js` foi trocado de cache-first para network-first em navegacao, scripts, estilos, workers e manifesto, mantendo cache apenas como fallback offline.
- `firebase.json` passou a enviar `no-cache, no-store, must-revalidate` para HTML, JS, CSS, JSON e `sw.js`.
- Removida a implementacao PWA duplicada dentro de `preromaneio.html`.

## Validacao
- `node --check menu-component.js` passou.
- `node --check sw.js` passou.
- `manifest.json` e `firebase.json` parseados como JSON valido.
- Icones conferidos como PNG real: `144x144`, `192x192` e `512x512`.
- Smoke local no Browser em `http://127.0.0.1:5511/index.html?noRedirect=true`: manifesto injetado, item "Instalar aplicativo" presente no menu e sem erros PWA no console.
- `git diff --check -- manifest.json sw.js firebase.json menu-component.js preromaneio.html assets/icons/icon-144x144.png assets/icons/icon-192x192.png assets/icons/icon-512x512.png` passou.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `npm test` passou com 7 testes.
