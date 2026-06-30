# Story: Manual ilustrado e intuitivo do Sisweb

## Contexto

`ajuda.html` ja existe como pagina de manual, mas o conteudo ainda e limitado, depende de imagens externas como fallback e nao cobre todos os modulos, modais e fluxos relevantes do sistema. O usuario solicitou um manual no estilo "livro ilustrativo", com prints sem dados reais, explicando paginas, modais e funcionalidades.

## Objetivo

Transformar `ajuda.html` em um manual operacional amplo, responsivo e seguro, com indice, busca, capitulos por modulo, fluxos guiados, checklist de boas praticas, modais documentados e imagens de treinamento com dados ficticios.

## Escopo

- Remover dependencia de geracao externa de imagens.
- Substituir prints com possiveis dados reais por imagens sanitizadas em `assets/help-manual/`.
- Cobrir modulos publicados para usuarios comuns no menu principal: Dashboard, Vendas, Compras, Estoque, Financeiro, Folha, Cadastros, Romaneios, Fiscal, Empresa, Perfil, Assinatura e Suporte.
- Nao documentar Admin/Super Admin no manual publico.
- Documentar modais principais por modulo.
- Manter busca, indice e navegação por hash.
- Garantir responsividade mobile/PWA.
- Adicionar testes estaticos de cobertura, privacidade e ausencia de dependencia externa.

## Fora do Escopo

- Capturar prints reais autenticados.
- Publicar dados reais ou imagens com nomes/valores reais.
- Criar videos ou tour interativo persistente.
- Criar metricas avancadas/SLA de suporte; a fila administrativa basica para Super Admin foi incluida nesta entrega por dependencia direta do fluxo de ajuda/suporte.

## Acceptance Criteria

- [x] Manual nao usa URL externa para imagens geradas.
- [x] Manual nao depende de prints reais para explicar os fluxos.
- [x] Modulos principais do menu possuem capitulo proprio.
- [x] Modais principais sao citados por modulo.
- [x] Suporte aparece na documentacao publica.
- [x] Admin/Super Admin nao aparece na documentacao publica.
- [x] Busca local continua funcionando.
- [x] Layout e responsivo em desktop e mobile.
- [x] Testes cobrem privacidade, cobertura e ausencia de dependencia externa.
- [x] Fila administrativa de suporte aparece apenas para Super Admin.
- [x] Quality gates executados.
- [x] Deploy executado.

## Tasks

- [x] Mapear modulos e modais principais.
- [x] Reestruturar `ajuda.html` para layout de manual ilustrado.
- [x] Reescrever `ajuda.js` com conteudo interno e prints sanitizados.
- [x] Implementar aba de suporte no Admin/Super Admin.
- [x] Adicionar testes.
- [x] Validar no Browser desktop/mobile.
- [x] Rodar gates.
- [x] Deploy.

## Validacoes Obrigatorias

### Seguranca e Performance

- Manual deve usar dados ficticios e nao consultar dados de tenant.
- Evitar imagens externas e chamadas de rede desnecessarias.
- Busca deve ser local e leve.

### Responsividade e Padronizacao

- Layout deve funcionar como indice + conteudo em desktop e cards/stack em mobile.
- Prints sanitizados devem usar linguagem visual coerente com Sisweb sem poluir a tela.
- Textos devem caber em telas pequenas.

### Conformidade Legal

- Nao expor dados pessoais, financeiros, trabalhistas ou fiscais reais.
- Conteudo deve orientar operacao sem substituir consultoria fiscal/trabalhista.

## File List

- `docs/stories/2026-06-06-ajuda-manual-ilustrado-sisweb.md`
- `ajuda.html`
- `ajuda.js`
- `admin.html`
- `scripts/admin/admin-main.js`
- `styles/admin-premium.css`
- `menu-component.js`
- `firebase.json`
- `help-assets/README.md`
- `assets/help-manual/*.png`
- `tests/ajuda-manual-ilustrado.test.mjs`
- `tests/admin-support-ui.test.mjs`

## QA Notes

- Manual revisado pela story complementar `2026-06-06-ajuda-prints-sanitizados-guia-rapido.md`: a versao final usa prints sanitizados em `assets/help-manual/`, sem prints reais autenticados e sem dependencia de URL externa.
- Admin/Super Admin foi removido do manual publico por orientacao do proprietario; a fila administrativa permanece implementada no sistema, mas nao documentada para usuarios comuns.
- `help-assets/**` foi incluido no ignore do Firebase Hosting para evitar publicacao de imagens legadas potencialmente sensiveis.
- Admin recebeu aba `Suporte` restrita a Super Admin, usando apenas callables do backend ja criado, sem escrita direta no Realtime Database.
- Validacao local no Browser: `ajuda.html?v=manual_ilustrado_20260606#suporte`, busca por `folha pix`, lightbox de mockup e responsividade mobile.
- Acesso visual local do Admin redireciona para login sem sessao local; validacao da UI administrativa foi coberta por testes estaticos e integracao de assets.
- Comandos executados:
  - `node --check ajuda.js`
  - `node --check scripts/admin/admin-main.js`
  - `node --check menu-component.js`
  - `node --test tests/ajuda-manual-ilustrado.test.mjs tests/admin-support-ui.test.mjs tests/support-backend.test.mjs tests/global-first-wave.test.mjs`
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
- Deploy executado:
  - `firebase deploy --only "hosting" --project sisweb-7ce82`
- Verificacao em producao por HTTP:
  - `https://sisweb-7ce82.web.app/ajuda.html` retornou 200 com titulo novo e selo `Sem dados reais`.
  - `https://sisweb-7ce82.web.app/ajuda.js` retornou 200 sem referencias a `coreva-normal.trae.ai` e sem `help-assets/`.
  - `https://sisweb-7ce82.web.app/scripts/admin/admin-main.js` retornou 200 com integracao `listSupportTicketsAdmin`.
  - `https://sisweb-7ce82.web.app/help-assets/inicio/dashboard.png` retornou 404, confirmando que os prints legados nao foram publicados.
