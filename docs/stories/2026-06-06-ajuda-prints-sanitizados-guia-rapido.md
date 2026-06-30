# Story: Ajuda com prints sanitizados e guia rapido de assinatura

## Contexto

O manual `ajuda.html` foi refeito com mockups internos, mas o usuario esclareceu que espera uma experiencia mais parecida com prints reais do sistema, cobrindo modulos, abas, modais e funcionalidades com dados ficticios. O usuario tambem determinou que o manual publico nao deve ensinar o modulo Admin/Super Admin, por ser exclusivo do proprietario do sistema, e pediu que as melhorias tambem aparecam no `subscription-status.html`, no "Guia Rapido de Uso do Sistema".

## Objetivo

Transformar o manual publico e o guia rapido em materiais de treinamento mais visuais e leigos, usando imagens sanitizadas publicaveis, busca por modulo/modal/funcionalidade e nenhuma instrucao operacional de Admin/Super Admin.

## Escopo

- Gerar prints sanitizados em `assets/help-manual/` com layout visual do Sisweb e dados ficticios.
- Gerar inventario rastreavel de menu, paginas, abas, modais, links e acoes de relatorio.
- Ampliar a captura para cobrir a galeria completa publica sem incluir Admin/Super Admin.
- Otimizar os PNGs antes do deploy para manter o Hosting leve.
- Atualizar `ajuda.html`/`ajuda.js` para usar esses prints, miniatura e lightbox.
- Remover instrucoes de Admin/Super Admin do manual publico.
- Atualizar `subscription-status.html` com busca no Guia Rapido, cards por modulo e links para capitulos do manual.
- Garantir que `help-assets/**` continue fora do Hosting.
- Garantir que artefatos internos (`tools/**`, `tests/**`, `docs/**`, `functions/**`, `tmp/**`, `package.json`) nao sejam publicados no Hosting.
- Adicionar testes para privacidade, imagens sanitizadas e guia rapido.

## Fora do Escopo

- Capturar prints reais autenticados de tenants em producao.
- Publicar manual interno do proprietario/Super Admin.
- Criar tutorial em video.

## Acceptance Criteria

- [x] Manual publico usa imagens de `assets/help-manual/`.
- [x] Manual publico nao referencia `help-assets/`.
- [x] Manual publico nao ensina Admin/Super Admin.
- [x] Imagens do manual possuem dados ficticios/sanitizados.
- [x] Inventario gerado separa rotas publicas, conta/suporte e internas/admin.
- [x] Galeria completa do manual cobre paginas, abas, modais, relatorios/acoes publicas e mobile/PWA principal.
- [x] Prints otimizados antes do deploy.
- [x] Busca do manual continua por modulo, modal e funcionalidade.
- [x] `subscription-status.html` possui Guia Rapido pesquisavel.
- [x] Guia Rapido usa os prints sanitizados e linka para `ajuda.html#modulo`.
- [x] Testes cobrem a regra de privacidade e guia rapido.
- [x] Firebase Hosting bloqueia ferramentas locais, testes, docs, backend e pacote raiz.
- [x] Quality gates executados.
- [x] Deploy executado.

## Tasks

- [x] Esclarecer regra de nao publicar Super Admin no manual publico.
- [x] Gerar imagens sanitizadas em `assets/help-manual/`.
- [x] Gerar inventario em `docs/help-manual-inventory.generated.json`.
- [x] Gerar rotas completas em `tools/help-screenshots/routes.full-training.generated.json`.
- [x] Gerar galeria publica em `assets/help-manual/help-gallery.generated.js`.
- [x] Capturar 198 prints PNG com dados ficticios e otimizar para aproximadamente 6,5 MB.
- [x] Ajustar `ajuda.js` para renderizar imagens e lightbox.
- [x] Atualizar guia rapido em `subscription-status.html`.
- [x] Adicionar testes.
- [x] Validar no Browser/local.
- [x] Rodar gates.
- [x] Deploy.

## Validacoes Obrigatorias

### Seguranca e Performance

- As imagens nao podem conter dados reais de clientes, funcionarios, PIX, financeiro ou fiscal.
- O manual nao deve consultar tenant para montar a documentacao.
- A busca deve ser local e leve.

### Responsividade e Padronizacao

- Prints devem caber em cards e abrir ampliados.
- Guia rapido deve funcionar em desktop e mobile/PWA.
- Textos devem ser objetivos para usuario leigo.

### Conformidade Legal

- Nao publicar informacoes reais trabalhistas, fiscais, financeiras ou pessoais.
- Conteudo fiscal/trabalhista deve ser operacional, sem substituir orientacao tecnica legal.

## File List

- `docs/stories/2026-06-06-ajuda-prints-sanitizados-guia-rapido.md`
- `ajuda.html`
- `ajuda.js`
- `subscription-status.html`
- `assets/help-manual/*.png`
- `assets/help-manual/help-gallery.generated.js`
- `docs/help-manual-inventory.generated.json`
- `tools/help-screenshots/inventory.mjs`
- `tools/help-screenshots/build-full-routes.mjs`
- `tools/help-screenshots/build-help-gallery.mjs`
- `tools/help-screenshots/optimize.mjs`
- `tools/help-screenshots/capture.mjs`
- `tools/help-screenshots/package.json`
- `tools/help-screenshots/package-lock.json`
- `tools/help-screenshots/routes.full-training.generated.json`
- `firebase.json`
- `tests/ajuda-manual-ilustrado.test.mjs`
- `tests/subscription-status-help-guide.test.mjs`
- `tests/global-first-wave.test.mjs`

## QA Notes

- `ajuda.html#folha` validado localmente no Browser: imagem sanitizada carregou, busca `folha pix recibo` retornou Folha, lightbox abriu o print e nao houve `Super Admin`, fila Admin ou `help-assets` no DOM.
- `subscription-status.html` exige sessao local e redireciona sem usuario autenticado; o Guia Rapido foi validado por testes estaticos e seletores/JS.
- Inventario automatico apos filtro publico:
  - 17 paginas operacionais publicas.
  - 8 paginas de conta/suporte.
  - 33 paginas internas/admin/tecnicas fora do manual publico.
  - 66 abas, 86 modais e 47 acoes de relatorio/janela detectadas.
- Captura completa:
  - `node tools/help-screenshots/inventory.mjs --write`
  - `node tools/help-screenshots/build-full-routes.mjs`
  - `node tools/help-screenshots/build-help-gallery.mjs`
  - `node tools/help-screenshots/capture.mjs --full`
  - `node tools/help-screenshots/capture.mjs --training`
  - `node tools/help-screenshots/optimize.mjs --apply`
  - Resultado atual: 198 PNGs em `assets/help-manual/`, aproximadamente 6,5 MB apos compressao.
- Comandos executados:
  - `node --test tests/ajuda-manual-ilustrado.test.mjs tests/subscription-status-help-guide.test.mjs`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
- Deploy executado:
  - `firebase deploy --only "hosting" --project sisweb-7ce82`
- Verificacao em producao por HTTP:
  - `ajuda.js` retornou 200, usa `assets/help-manual`, nao menciona `help-assets/` e nao menciona `Super Admin`.
  - `subscription-status.html` retornou 200, possui `quickGuideSearch`, usa `assets/help-manual/folha-1.png` e nao menciona `help-assets/`.
  - `assets/help-manual/folha-1.png` retornou 200.
  - `help-assets/folha/folha.png` retornou 404, mantendo os prints legados fora do Hosting.
  - `tools/help-screenshots/capture.mjs`, `tests/ajuda-manual-ilustrado.test.mjs`, `docs/help-manual-inventory.generated.json`, `functions/index.js` e `package.json` retornaram 404 apos o deploy final.
