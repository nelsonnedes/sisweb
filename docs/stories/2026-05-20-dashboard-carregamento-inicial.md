# Story: Otimizacao do carregamento inicial do Dashboard Sistema

## Status
Ready for Review

## Contexto
A pagina inicial `index.html` renderiza o Dashboard Sistema e integra dados do Firebase Realtime Database, cache local e componentes visuais do dashboard.

## Problema
O carregamento inicial apresenta piscadas/preload perceptivel e pode executar leituras ou renderizacoes em cascata, afetando agilidade, responsividade e percepcao de elegancia.

## Objetivo
Reduzir flicker no primeiro carregamento, tornar o dashboard progressivo e priorizar metodos de leitura/cache mais adequados para Firebase Realtime Database sem alterar dados reais.

## Acceptance Criteria
- [x] Dashboard renderiza uma estrutura inicial estavel antes das leituras remotas, evitando piscadas perceptiveis.
- [x] Inicializacao evita timers artificiais e renderizacoes duplicadas quando os modulos ja estiverem disponiveis.
- [x] Leituras iniciais priorizam cache/localStorage e carregam Firebase em background quando aplicavel.
- [x] Listeners/reloads do Firebase no dashboard sao limitados ao necessario para a tela inicial.
- [x] Melhorias preservam responsividade desktop/mobile e nao criam landing page ou fluxo novo.
- [x] Home evita scripts pesados/debug no carregamento normal e usa lazy load apenas por parametros de manutencao.
- [x] Dashboard usa caminhos canonicos tenant-scoped para reduzir tentativas em aliases legados.
- [x] Validacoes possiveis foram executadas e registradas.

## File List
- `docs/stories/2026-05-20-dashboard-carregamento-inicial.md`
- `index.html`
- `modules/dashboard/dashboard-core.js`
- `modules/dashboard/dashboard-widgets.js`
- `modules/dashboard/dashboard-styles.css`
- `modules/dashboard/dashboard-layout-fix.css`
- `modules/dashboard/dashboard-professional-styles.css`
- `modules/core/firebase-service.js`
- `menu-component.js`
- `menu.css`

## Analise
- Especialista de UX/front inicial identificou multipla repintura no primeiro acesso: skeleton, cache, Firebase e atualizacao financeira podiam competir visualmente, gerando sensacao de duas piscadas/preload.
- Especialista Firebase identificou leituras redundantes e caras no arranque, especialmente em dados financeiros, alem de falta de deduplicacao de leituras simultaneas e fallback local mais agressivo.
- Especialista arquitetura/responsividade identificou header duplicado, inicializacao fora da ordem ideal, listeners/timers repetidos e overlay de loading com maior impacto visual que o necessario.

## Implementacao
- `index.html` agora entrega um shell estavel do dashboard desde o HTML inicial, remove o delay artificial de inicializacao e inicializa widgets antes do core para nao perder o primeiro evento de dados.
- O dashboard usa cache local tenant-scoped antes das leituras remotas e faz a primeira consulta financeira em janela mensal curta; a carga financeira completa fica em background e so repinta se houver mudanca.
- `firebase-service.js` passou a reutilizar cache em memoria, deduplicar leituras simultaneas com `pendingReads` e retornar fallback local quando o Firebase estiver indisponivel.
- `dashboard-widgets.js` ficou idempotente, renderiza a primeira hidratacao imediatamente quando ainda ha skeletons, consolida repaints em `requestAnimationFrame` e mostra estados vazios reais em vez de preload indefinido.
- O loading virou estado inline do shell, sem overlay full-screen; estilos preservam dimensoes estaveis para desktop/mobile.
- Reduzi timers de saudacao/menu e o delay de verificacao admin/empresa para diminuir reflows e redirecionamentos tardios perceptiveis.
- Rodada 2026-06-04: `index.html` passou a carregar scripts principais com `defer`, removeu do carregamento normal `Chart.js`, compressor de imagem, Firebase Performance, `species-manager`, `deep-clean`, `performance-tester` e `sample-data-generator`; ferramentas de manutencao/performance agora entram sob demanda por parametros de URL.
- Rodada 2026-06-04: o dashboard passou a ler romaneios, financeiro e pre-romaneios pelos caminhos canonicos em `companies/{companyId}`; `firebase-service.js` recebeu a opcao `canonicalOnly` para preservar compatibilidade dos demais modulos sem varrer aliases na home.
- Rodada 2026-06-04: grids do dashboard e sidebar mobile receberam ajustes responsivos de baixo risco para reduzir travas de largura intermediaria.
- Rodada 2026-06-04: `firebase-service.js` passou a aguardar brevemente o Auth antes de leituras remotas, e os alertas do menu usam leitura canonica sem consultar `folha/funcionarios`.
- Rodada 2026-06-04: removido o badge legado `Amostras desativadas` do dashboard, pois era apenas sinalizador interno do antigo gerador de dados ficticios.

## Validacao
- `node --check modules/dashboard/dashboard-core.js`
- `node --check modules/dashboard/dashboard-widgets.js`
- `node --check modules/core/firebase-service.js`
- Validacao dos scripts inline de `index.html` com `vm.Script`: `inline scripts ok: 3`
- `git diff --check -- index.html modules/dashboard/dashboard-core.js modules/dashboard/dashboard-widgets.js modules/dashboard/dashboard-styles.css modules/dashboard/dashboard-layout-fix.css modules/core/firebase-service.js menu-component.js docs/stories/2026-05-20-dashboard-carregamento-inicial.md`
- Smoke local com Edge headless em perfil limpo: 1 header, 1 grid KPI, 0 skeletons presos, 9 KPIs, 2 tabelas vazias renderizadas, `aria-busy=false`, sem `dashboard-error`.
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `node --check modules/core/firebase-service.js`
- `node --check modules/dashboard/dashboard-core.js`
- `node --check menu-component.js`
- `node --check modules/dashboard/dashboard-widgets.js`
- Validacao dos scripts inline de `index.html` com `vm.Script`: `inline scripts ok: 3`
- `git diff --check -- index.html modules/dashboard/dashboard-core.js modules/core/firebase-service.js modules/dashboard/dashboard-professional-styles.css menu.css docs/stories/2026-05-20-dashboard-carregamento-inicial.md`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- Deploy Firebase Hosting em `https://sisweb-7ce82.web.app`.
- Smoke online da home logada: 10 scripts, 9 KPIs, 2 tabelas, 20 linhas financeiras, `aria-busy=false`, 0 skeletons, sem logs recentes de warn/error.
- Breakpoints online 390x844, 768x1024 e 1280x720: sem overflow horizontal; menu mobile como sidebar e menu desktop com `position: static`/`transform: none`.
