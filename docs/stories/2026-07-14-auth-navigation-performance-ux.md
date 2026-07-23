# Story: Estabilizacao de autenticacao, navegacao e experiencia de acesso

## Status

Ready for Review - Fases 0, 1 e 2 e rollout controlado implementados, validados e publicados; harness E2E isolado e Fase 3 permanecem fora desta entrega.

## Ajuste Operacional - 2026-07-15

- [x] Logout pelo menu validado no Hosting; rota protegida voltou ao Login apos estabilizacao do guard.
- [x] Login com credenciais salvas validado ate o Dashboard.
- [x] Card legado `Diagnostico` removido da Folha de Pagamento.
- [x] Carregamento incondicional de `debug-folha-utils.js` removido da pagina operacional.
- [x] Diagnostico seguro de Auth/Performance preservado exclusivamente por opt-in `?diag=auth-perf`.
- [x] Folha publicada revalidada sem o card, com filtros, acoes e tabela operacionais.

Evidencia do deploy: preview `folha-diagnostico-clean-20260715` aprovado; Hosting live na versao `10d610f1dffdf92e`, release `1784122503899000`. Rollback preservado na versao `a6dee04d9afafb59`, release `1784121244052000`.

## Ajuste De Assinatura Expirada - 2026-07-18

- [x] Marcadores legados `active`/`ativo` deixaram de prevalecer sobre uma `endDate` ja vencida.
- [x] `auth.js` e o guard de escrita em `firebaseService.js` passaram a resolver o estado de assinatura pelo marcador e pela validade temporal.
- [x] `grantReadOnlyGrace` passou a liberar o modo consulta quando a assinatura esta vencida, mesmo que o registro legado ainda contenha `subscription.active = true`.
- [x] A tela de status passou a explicar corretamente a leitura temporaria para assinatura expirada.
- [x] Functions e Hosting foram publicados; preflight CORS e testes dedicados foram aprovados.

O smoke autenticado do tenant operacional permaneceu estavel. A validacao real do tenant secundario continua pendente por ausencia de uma sessao valida; nenhuma credencial foi registrada nesta story.

## Correcao De Logout Da Home - 2026-07-19

- [x] Falha `logout-not-confirmed` reproduzida no Hosting ao sair pela Home.
- [x] Causa raiz confirmada: a Home carregava Firebase App/Database, mas nao carregava Auth compat antes do servico canonico usado pelo menu.
- [x] Firebase Auth compat passou a ser carregado antes de `modules/core/firebase-service.js`.
- [x] Teste regressivo garante a ordem de bootstrap necessaria para o `signOut` confirmado.
- [x] Hosting publicado e validado: sair pelo menu redireciona ao Login e reabrir `index.html` permanece bloqueado.
- [ ] Smoke de isolamento com o segundo tenant: a tentativa real foi recusada pelo Firebase como credencial invalida; nenhuma nova tentativa ou escrita foi executada.

Gate desta publicacao: `lint`, `typecheck`, `git diff --check`, `npm audit`, 281 testes automatizados, 13 testes RBAC no Emulator e build allowlisted com 448 arquivos e 19.446.823 bytes. O deploy foi restrito ao Hosting; nenhuma Rule, Function ou dado real foi alterado nesta etapa.

## Contexto

Em 2026-07-14 foi executada uma auditoria autenticada no Hosting de producao, com navegacao entre Login, Home, Vendas, Compras, Financeiro, Clientes, Fornecedores, Estoque, NF-e, Empresa, Romaneio e Folha.

O sintoma relatado pelo usuario foi confirmado: ao trocar de pagina, o console alterna entre estados de Firebase offline/conectado, repete validacoes de Auth e tenant e recarrega dados que ja haviam sido obtidos em outro modulo. Houve navegacoes entre 9 e 31 segundos, um timeout de navegacao em Vendas, outro em Folha e um aviso real de quota do cache local de pedidos.

A evidencia aponta predominantemente para concorrencia e reinicializacao no frontend, e nao para uma indisponibilidade geral do Firebase. O Sisweb multipagina carrega versoes e servicos Firebase diferentes, cria listeners e timers por pagina, renova tokens sem necessidade e usa `.info/connected` do Realtime Database como se fosse o estado do Firebase Auth.

As correcoes anteriores continuam validas e nao devem ser desfeitas:

- `2026-05-21-login-conexao-pos-deploy.md` eliminou o aviso visual preso apos reconexao, mas nao consolidou o bootstrap.
- `2026-05-20-dashboard-carregamento-inicial.md` introduziu carga rapida e cache, mas a Home ainda executa muitas consultas e possui varios gatilhos de recarga.
- `2026-06-17-dashboard-logout-nf-callable-session-guard.md` endureceu logout e callables; seus guards devem ser preservados durante a consolidacao.
- `2026-07-01-nf-cliente-menu-global.md` alterou menu e modais; a reducao das leituras do menu deve respeitar essas entregas.

## Objetivo

Estabelecer uma sessao autenticada e tenant-scoped previsivel por pagina, reduzir leituras e esperas repetidas durante a navegacao e modernizar Login, Registro, Recuperacao de Senha e Suporte sem migracao destrutiva, sem big-bang e sem alterar dados reais.

## Escopo

- Bootstrap canonico de Firebase App, Auth, RTDB, Storage e Functions.
- Estado explicito `BOOTING -> AUTHENTICATED -> TENANT_READY -> READY`.
- Separacao entre internet disponivel, Auth pronto e RTDB conectado.
- Single-flight para restauracao de Auth, tenant, perfil, refresh de token e leituras iguais.
- Cache tenant-scoped com TTL, versao e invalidacao no logout/troca de tenant.
- Reducao das leituras globais do menu, dashboard e sincronizadores legados.
- Estrategia PWA que use a rede para HTML e aproveite os assets versionados.
- Observabilidade segura de autenticacao, conexao e carregamento.
- Consolidacao funcional e redesign responsivo/acessivel do portal de acesso.
- Testes E2E autenticados de navegacao, offline/online, logout e responsividade.

## Fora de Escopo

- Alterar emissao fiscal, regras de negocio de NF-e ou dados fiscais.
- Alterar RBAC, Database Rules, Storage Rules ou Functions sem necessidade comprovada.
- Migrar o modelo de dados ou remover aliases legados nesta primeira story.
- Reescrever todos os modulos simultaneamente ou converter o Sisweb em SPA.
- Usar cache local como autorizacao ou fonte de permissao.
- Executar migracao destrutiva, limpeza de dados ou mudanca de tenant em producao.

## Metodo Da Auditoria

- Ambiente: Firebase Hosting de producao.
- Sessao: conta operacional real, identificadores removidos deste documento.
- Coleta: console do navegador, estado visivel do DOM, tempo de parede por rota e auditoria estatica do workspace.
- Janela por rota: navegacao mais aproximadamente 7 segundos para estabilizacao.
- Limitacao: as contagens abaixo representam mensagens e chamadas logicas observadas, nao um HAR completo. A instrumentacao da Fase 1 devera produzir a baseline definitiva.
- Seguranca: nenhuma senha, token, email, UID ou tenant real foi gravado nesta story.

## Evidencias De Producao

### Login E Sessao

| ID | Evidencia anonimizada | Impacto |
|---|---|---|
| E-01 | O primeiro carregamento registrou RTDB offline e somente marcou conectado cerca de 36,5 s depois. | O usuario percebe o Firebase como indisponivel mesmo com a pagina pronta. |
| E-02 | O login foi autenticado em aproximadamente 1,1 s, mas a navegacao para a Home so apareceu varios segundos depois. | O pos-login executa resolucao adicional de usuario, tenant, assinatura e rota. |
| E-03 | A primeira entrada na Home chegou a redirecionar para `tenant_required`; uma nova navegacao encontrou a sessao. | Existe corrida entre restauracao de Auth, tenant cacheado e guard da Home. |
| E-04 | O console publicou email, UID, tenant e prefixo de API key durante o login. | Logs de producao possuem PII/identificadores desnecessarios. |
| E-05 | Foram localizados 14 pontos de refresh forcado de token e 16 usos de `onAuthStateChanged` na amostra central. | A navegacao pode renovar token e criar listeners temporarios repetidamente. |

### Navegacao Por Modulo

| Rota | Tempo observado | Sinais relevantes |
|---|---:|---|
| `index.html` | 9,9 s | 27 cargas logicas; 16 leituras mensais do Financeiro, agregados e dados de dashboard. |
| `vendas.html` | 10,7 s e 30,9 s | Uma tentativa excedeu o timeout de navegacao; houve `QuotaExceeded` no cache de pedidos. |
| `compras.html` | 10,5 s a 17,9 s | Repetiu Auth e dados mestres de especies, fornecedores e produtos. |
| `financas.html` | 8,9 s a 25,0 s | A pagina combina bootstrap Firebase local 10.7.1 com servico 9.22. |
| `client.html` | 10,2 s | Reinicializou Firebase e recarregou a colecao de clientes. |
| `fornecedor.html` | 9,6 s | Reinicializou Firebase e recarregou a colecao de fornecedores. |
| `notas-fiscais.html` | 12,4 s | 14 cargas logicas, quatro checagens de Auth e tentativas de caminhos sem dados. |
| `company.html` | 9,4 s | Quatro checagens de Auth; `database-utils` pode iniciar sincronizacao global apos 3 s. |
| `estoque.html` | 10,5 s | 12 cargas logicas, quatro checagens de Auth e dois estados offline. |
| `romaneiotl.html` | 9,5 s | Aproximadamente 301 mensagens de console em uma unica entrada. |
| `folha_pagamento/folha.html` | 19,9 s | Timeout de navegacao e quatro sinais de inicializacao Firebase. |

### Portal De Acesso

| ID | Evidencia | Impacto |
|---|---|---|
| E-06 | `Fale Conosco` usa `href="#"`; o clique apenas altera a ancora. | Canal de suporte inoperante. |
| E-07 | O handler global procura `a.about-link`, ausente no Login. | A logica existente nunca encontra um destino. |
| E-08 | Registro e Recuperacao sao definidos duas vezes em `login.html`. | O ultimo script sobrescreve o anterior; rede lenta pode expor corrida. |
| E-09 | Existem 8 aberturas e 10 fechamentos de `<script>`. | HTML fragil e comportamento dependente da recuperacao do parser. |
| E-10 | Dialogos nao possuem semantica, foco contido, fechamento por `Escape` ou rolagem movel segura. | Falha de teclado, leitor de tela e viewport pequeno. |
| E-11 | Ferramentas publicas mostram termos tecnicos do Firebase e permitem testar email. | Ruido de UX, risco de enumeracao e baixa confianca percebida. |
| E-12 | Login usa tipografia/iconografia diferente da Home e possui contraste insuficiente em textos/acoes. | Experiencia visual inconsistente e abaixo de WCAG AA. |

## Causas Raiz Priorizadas

### P0 - Estabilidade E Custo

1. **Tres servicos Firebase concorrentes.** Existem `firebaseService.js`, `modules/core/firebase-service.js` e `src/services/firebaseService.js`, alem de SDKs 9.22, 9.23 compat e 10.7.1.
2. **Financas possui duas pilhas na mesma pagina.** `financas.html` inicializa Firebase 10.7.1 e depois importa/mescla o servico modular 9.22.
3. **RTDB e Auth foram acoplados indevidamente.** `login.html` bloqueia `signInWithEmailAndPassword` quando `_FIREBASE_CONNECTED === false`, embora `.info/connected` descreva apenas a conexao daquele cliente RTDB.
4. **Refresh de token e listeners sem single-flight.** Login, listener central, verificacao de sessao e SuperAdmin podem renovar o mesmo token e reler `users/{uid}`.
5. **Menu faz consultas de negocio em toda pagina.** Perfil e alertas podem gerar ate dez leituras de Financeiro, Funcionarios, Estoque e Vendas a cada documento.
6. **Dashboard carrega amplitude excessiva.** A Home le meses financeiros individualmente, agregados e colecoes auxiliares, com novos gatilhos em `tenantContextReady`, `firebaseReady`, reconexao, foco e timer.

### P1 - Performance E Consistencia

7. **Sessao local pode anteceder Auth real.** Cache pode liberar interface enquanto Firebase Rules ainda ve usuario nulo.
8. **Tenant e resolvido varias vezes.** Timeouts transitivos podem limpar contexto que deveria ser removido somente em logout confirmado ou troca de usuario.
9. **Duplicidade `get` + `onValue`.** Vendas, Financeiro e outros modulos podem baixar a mesma colecao antes e no snapshot inicial do listener.
10. **Service Worker neutraliza cache quente.** HTML, scripts e estilos usam `network-first` com `cache: no-store` em toda navegacao.
11. **Sincronizacao global automatica.** `database-utils` percorre nove conjuntos e pode aceitar chaves legadas sem tenant ao abrir Empresa.
12. **Cache de pedidos excedeu a quota.** A colecao completa de Vendas e persistida no `localStorage`, que foi desativado para a chave naquela sessao.

### P2 - UX, Acessibilidade E Observabilidade

13. **Fluxos duplicados de Registro/Recuperacao e HTML invalido.** Antes de redesenhar, deve existir um unico controlador.
14. **Contato publico desconectado.** A Central de Suporte existente deve ser reutilizada sem carregar o menu inteiro.
15. **Observabilidade atual e ruidosa e sensivel.** `authAuditLog()` esta vazio, enquanto o console exibe PII e nao possui `pageViewId`, duracao, cache hit ou origem.
16. **Testes de Auth sao majoritariamente estaticos.** A suite passa, mas nao mede sockets, restauracao de sessao, leituras ou navegacao real.

## Requisitos Rastreaveis

| ID | Requisito |
|---|---|
| FR-01 | Cada pagina auditada deve possuir apenas um Firebase App e um bootstrap central. |
| FR-02 | RTDB desconectado nao pode bloquear login nem invalidar Auth. |
| FR-03 | Um unico observador central deve resolver Auth; os modulos apenas consomem seu estado. |
| FR-04 | Navegacao comum nao pode executar refresh forcado de token. |
| FR-05 | Timeout ou oscilacao de rede nao pode apagar tenant confirmado. |
| FR-06 | Leituras simultaneas com mesma chave devem compartilhar a mesma Promise. |
| FR-07 | Cache deve ser isolado por usuario, tenant, caminho, consulta e versao. |
| FR-08 | Logout confirmado deve limpar Auth, tenant, listeners e caches privados. |
| FR-09 | Cada operacao de Login, Registro e Recuperacao deve ter apenas um handler ativo. |
| FR-10 | `Fale Conosco` deve abrir suporte publico funcional e acessivel. |
| FR-11 | Menu nao deve recarregar colecoes completas para exibir alertas em toda pagina. |
| FR-12 | Assets versionados devem usar cache quente sem impedir atualizacao controlada. |
| NFR-01 | Telemetria nao pode conter email, senha, token, UID, tenant real ou payload empresarial. |
| NFR-02 | Navegacao quente deve ser pelo menos 30% mais rapida que a fria na mediana. |
| NFR-03 | Fluxos de acesso devem atender WCAG 2.2 AA e funcionar de 320 px a desktop. |
| CON-01 | A implementacao deve ser gradual, compativel com globais legadas e reversivel por release. |
| CON-02 | Nenhuma migracao destrutiva ou mudanca de dados reais sera executada. |

## Acceptance Criteria

- [ ] Uma unica instancia Firebase e um unico bootstrap Auth por pagina auditada.
- [ ] Zero transicao para `UNAUTHENTICATED` depois de `AUTHENTICATED`, exceto logout real.
- [x] `.info/connected=false` nao impede `signInWithEmailAndPassword`.
- [x] Zero refresh forcado de token durante navegacao comum.
- [ ] No maximo uma leitura de perfil do usuario e uma do perfil empresarial por pagina.
- [ ] Zero leitura duplicada do mesmo caminho/consulta em janela de dois segundos.
- [ ] Tenant anonimizado permanece estavel em todas as rotas autenticadas.
- [x] Timeout de rede nao remove tenant nem redireciona indevidamente.
- [x] Login -> Home -> Vendas -> Compras -> Estoque -> Financeiro -> NF-e -> Empresa passa tres vezes consecutivas.
- [x] Logout impede reabertura autenticada de qualquer rota protegida.
- [ ] Menu usa resumo/TTL e nao repete dez leituras completas em cada documento.
- [ ] A Home nao executa consultas mensais e agregadas duplicadas para o mesmo periodo.
- [ ] `Fale Conosco` abre suporte real sem alterar a ancora ou deslocar a pagina.
- [ ] Registro e Recuperacao possuem apenas um submit ativo cada.
- [ ] Dialogos funcionam por teclado, contêm foco, fecham com `Escape` e restauram foco.
- [ ] Nenhuma acao fica fora do viewport em 320x480, 390x844, 768x1024 e 1366x768.
- [ ] Contraste atende WCAG 2.2 AA e `prefers-reduced-motion` e respeitado.
- [ ] Navegacao quente melhora pelo menos 30% na mediana da mesma maquina/rede.
- [x] Nenhum artefato de diagnostico contem PII, credenciais ou identificadores reais.
- [ ] Lint, typecheck, build, testes unitarios, E2E e CodeRabbit passam.

## Plano De Implementacao Incremental

### Fase 0 - Congelamento E Baseline

- [x] Auditar producao e workspace sem alterar comportamento.
- [x] Anonimizar evidencias e registrar a baseline inicial nesta story.
- [x] Inventariar e reconciliar o drift entre workspace, GitHub e Hosting antes do primeiro patch.
- [ ] Criar E2E autenticado com credenciais somente em secret/variavel de ambiente.

O repositorio ainda nao possui Playwright, Cypress ou executor E2E equivalente. Nesta onda, o smoke autenticado foi executado pelo navegador controlado sem persistir credenciais. A escolha e instalacao de um runner devem ocorrer em patch isolado, sem acoplar nova dependencia ao runtime do Hosting.

### Fase 1 - Observabilidade Segura

- [x] Criar diagnostico em memoria sob `?diag=auth-perf`, desabilitado por padrao.
- [x] Registrar `pageViewId`, rota, estado Auth, estado RTDB, tenant anonimizado, duracao, cache hit, leituras, listeners e motivo de refresh.
- [x] Remover email, UID, tenant, API key e objetos de negocio dos logs comuns.
- [ ] Repetir a matriz de rotas tres vezes fria e tres vezes quente.

Execucao inicial concluida: um ciclo frio e dois ciclos quentes nas sete rotas criticas, todos aprovados. A matriz definitiva de tres ciclos frios e tres quentes depende do harness E2E isolado da Fase 0 para limpar cache sem interferir na sessao operacional.

### Fase 2 - Sessao Canonica

- [x] Criar `authReadyPromise` e `sessionContextPromise` single-flight no servico central.
- [x] Separar `internetAvailable`, `authReady` e `rtdbConnected`.
- [x] Usar token em cache; permitir refresh forcado somente apos mudanca real de claims ou erro autenticado especifico.
- [x] Cancelar timeout e listener temporario quando Auth resolver.
- [x] Nao limpar tenant por timeout; limpar somente em logout/troca confirmada.
- [x] Migrar primeiro Login e Home, preservando adaptadores globais.

### Fase 3 - Pilhas Firebase Por Ondas

- [ ] Remover a dupla inicializacao de `financas.html` em uma release isolada.
- [ ] Migrar Vendas e Compras para o bootstrap canonico.
- [ ] Migrar Clientes, Fornecedores, Estoque e NF-e.
- [ ] Migrar Empresa, Romaneios e Folha por ultimo, por concentrarem mais legado.
- [ ] Manter um Firebase App, um listener Auth e um listener `.info/connected` por pagina.

### Fase 4 - Leituras E Cache Tenant-Scoped

- [ ] Implementar deduplicacao de Promises por usuario + tenant + caminho + consulta.
- [ ] Definir TTL inicial: perfil 5-10 min, cadastros 3-5 min, resumos financeiros 30-60 s.
- [ ] Transformar alertas do menu em resumo agregado/sob demanda com TTL minimo de 60 s.
- [ ] Escolher `get` ou `onValue` para a carga inicial, sem baixar a colecao duas vezes.
- [ ] Registrar e executar todos os `unsubscribe` na saida da pagina/logout.
- [ ] Tornar `database-utils` migracao explicita e idempotente, sem sync global automatico.
- [ ] Substituir cache integral de pedidos por indice/resumo ou IndexedDB tenant-scoped.

### Fase 5 - PWA E Assets

- [ ] Manter `network-first` para documentos HTML.
- [ ] Usar `stale-while-revalidate` ou `cache-first` com revisao para JS/CSS versionados.
- [ ] Unificar as verificacoes de atualizacao do Service Worker.
- [ ] Validar upgrade, rollback e limpeza de cache por versao.

### Fase 6 - Portal De Acesso Premium

- [ ] Consolidar um unico controlador para Login, Registro e Recuperacao.
- [ ] Corrigir a estrutura de scripts e remover implementacoes orfas/duplicadas.
- [ ] Reutilizar a Central de Suporte publica sob demanda em `Fale Conosco`.
- [ ] Implementar estados acessiveis no mesmo painel ou dialogos semanticos completos.
- [ ] Desabilitar submit duplo com `aria-busy` e feedback por `aria-live`.
- [ ] Usar mensagem neutra na Recuperacao para evitar enumeracao de contas.
- [ ] Padronizar Inter, tokens visuais, iconografia, contraste, foco e movimento reduzido com a Home.
- [ ] Manter painel compacto, rodape externo e acoes visiveis em mobile/desktop.

### Fase 7 - QA, Rollout E Encerramento

- [ ] Rodar E2E frio/quente, online/offline, refresh, troca de rota, logout e retorno pelo historico.
- [ ] Validar pelo menos dois usuarios de tenants diferentes sem cache cruzado.
- [ ] Comparar baseline antes/depois e anexar resultados anonimizados.
- [ ] Publicar por onda somente apos preview e gates verdes.
- [ ] Atualizar checklist, evidencias e File List real da story.

## Observabilidade Segura

Registrar somente:

- `pageViewId` aleatorio e efemero.
- rota normalizada, versao do frontend e fase do bootstrap.
- estado Auth (`booting`, `authenticated`, `unauthenticated`, `error`).
- estado RTDB e internet separados.
- tenant com hash nao reversivel e salt de sessao.
- duracoes, contagem de leituras/listeners, cache hit/miss e motivo de refresh.

Proibido registrar email, senha, token, UID, tenant real, CPF/CNPJ, payload fiscal, dados financeiros, caminhos com IDs reais ou objetos completos.

O Firebase recomenda observar o estado de Auth para evitar o estado intermediario de `currentUser`; tambem documenta que `.info/connected` representa a conexao daquele cliente RTDB, nao um estado global. Custom traces devem evitar informacao pessoal:

- <https://firebase.google.com/docs/auth/web/manage-users?hl=pt-br>
- <https://firebase.google.com/docs/database/web/offline-capabilities?hl=pt-br>
- <https://firebase.google.com/docs/auth/web/auth-state-persistence?hl=pt-br>
- <https://firebase.google.com/docs/perf-mon/custom-code-traces?hl=pt-br>

## Evidencias Das Fases 0 E 1

### Contrato De Diagnostico

- Ativacao exata somente por `?diag=auth-perf`; a navegacao normal nao baixa o script e nao cria listeners, globais ou persistencia.
- API global tipada e congelada: `phase`, `auth`, `rtdb`, `internet`, `tenant`, `read`, `cache`, `listener`, `tokenRefresh`, `snapshot` e `clear`.
- Buffer circular somente em memoria, limitado a 1.000 eventos e sem `fetch`, beacon, Storage, IndexedDB ou escrita no console.
- Tenant e recursos recebem HMAC-SHA-256 com chave efemera da execucao; nenhum identificador bruto e armazenado.
- Teste automatizado dedicado aprovado em 10/10 cenarios, incluindo opt-in, ausencia de PII, limite do buffer, ordem de carregamento e cobertura dos pontos de refresh.

### Reconciliacao E Publicacao

- Build allowlisted reconciliado contra o Hosting live anterior: 447 arquivos analisados, 425 identicos e 22 diferencas pertencentes exclusivamente a Fase 1.
- Preview publicado em <https://sisweb-7ce82--auth-perf-fase1-20260714-vn3iiicw.web.app>, com expiracao em 2026-07-21T18:40:39Z.
- O Preview confirmou zero carga do diagnostico sem a query e uma carga com marcador `ready` quando habilitado.
- O login no dominio temporario permaneceu bloqueado pela restricao de referer da API key ja existente. A protecao nao foi enfraquecida; o smoke autenticado foi executado no dominio live autorizado.
- Release live anterior preservada para rollback: versao `2f04bcbb871c9881`, release `1784047322945000`.
- Release live publicada: versao `0ef88e1899d52826`, release `1784054809222000`, 449 objetos e 9.895.725 bytes informados pelo Hosting.
- Deploy restrito a Firebase Hosting; nenhuma Function, Rule, configuracao de banco ou dado real foi alterado.

### Matriz Autenticada Live

| Ciclo | Rotas aprovadas | Mediana por rota | Observacao |
|---|---:|---:|---|
| Frio inicial | 7/7 | 3,84 s | Home, Vendas, Compras, Estoque, Financeiro, NF-e e Empresa. |
| Quente 1 | 7/7 | 3,57 s | Sessao e marcador de diagnostico permaneceram estaveis. |
| Quente 2 | 7/7 | 3,54 s | Terceiro ciclo consecutivo sem perda de autenticacao. |
| Complementar | 4/4 | 3,38 s | Clientes, Fornecedores, Romaneio TL e Folha. |

A melhora quente inicial foi de aproximadamente 7,5%, abaixo da meta de 30%. Isso confirma que a instrumentacao esta pronta, mas que a reducao estrutural de bootstrap, refresh e leituras continua sendo trabalho da Fase 2 em diante. O console capturado ao final registrou zero `401`, `403`, `UNAUTHENTICATED`, erro de sintaxe, desconexao Firebase ou sinal de PII nas rotas visitadas.

## Evidencias Da Fase 2

### Sessao Canonica E Isolamento

- `firebaseService.js` e `modules/core/firebase-service.js` compartilham uma unica resolucao single-flight para Auth, token, perfil e tenant por documento.
- A geracao de Auth e o UID ativo invalidam resultados tardios: uma Promise iniciada pelo usuario anterior nao pode restaurar token, perfil ou tenant depois de troca de usuario ou logout confirmado.
- Cache legado sem `_authUid` nao autoriza acesso e nao pode ser promovido para a sessao atual. Contexto degradado preserva tenant apenas para o mesmo UID confirmado.
- Login e Home deixaram de depender de `.info/connected` para autenticar. Timeout e erro transitivo bloqueiam carga operacional, preservam contexto valido e tentam recuperar a sessao sem limpar tenant.
- O adaptador `support-callable-service.js` adiciona somente compatibilidade de callable ao singleton existente, sem criar outro Firebase App ou observador Auth.
- Vendas, Compras, Estoque, Financeiro e NF-e nao aceitam mais cache offline como autorizacao operacional.

### Qualidade E Publicacao

- Parecer final independente de Arquitetura: `PASS`.
- Parecer final independente de QA: `PASS`.
- Testes focados de sessao, PWA e guards operacionais: 39/39 aprovados.
- Suite completa: 221/221 testes aprovados; lint, typecheck, build allowlisted e `git diff --check` sem erro.
- Build do Hosting: 448 arquivos allowlisted e 19.426.967 bytes no diretorio local.
- Preview publicado em <https://sisweb-7ce82--auth-session-fase2-20260715-kyvmds2q.web.app>, com expiracao em 2026-07-22T12:41:52Z; versao `603ba123ffd03375`.
- O dominio temporario permaneceu bloqueado pela restricao de referer da API key. A protecao nao foi relaxada; sem Auth valida, a Home manteve `operationalReady=false` e nao carregou dados empresariais.
- Release live anterior preservada para rollback: versao `0ef88e1899d52826`, release `1784054809222000`.
- Release live publicada: versao `2f3444d18ecf005a`, release `1784119473384000`, 450 objetos e 9.900.218 bytes informados pelo Hosting.
- Smoke autenticado live aprovado em Home, Vendas, Compras, Financeiro e NF-e, sem `401`, `403`, perda de sessao, perda de tenant ou mensagem de empresa nao identificada.
- A Home concluiu a recuperacao da sessao com `aria-busy=false`, nove KPIs e duas tabelas. O aviso inicial de espera nao liberou carga operacional antes do contexto canonico.
- Vendas ainda registrou quota excedida para o cache integral de pedidos no `localStorage`. O modulo permaneceu operacional e a substituicao por indice/resumo ou IndexedDB permanece na Fase 4.
- Deploy restrito a Firebase Hosting; nenhuma Function, Rule, configuracao de banco ou dado real foi alterado.

## Rollout E Rollback

1. Congelar o escopo da onda e reconciliar workspace/GitHub/Hosting.
2. Publicar instrumentacao em Firebase Hosting Preview Channel, sem mudar banco, Functions ou Rules.
3. Medir baseline e validar que a telemetria nao contem PII.
4. Publicar uma onda por release: Login/Home, Financeiro, Comercio, Cadastros/NF-e e, por ultimo, Empresa/Romaneios/Folha.
5. Manter adaptador legado somente durante a onda e remover apos todas as rotas dependentes passarem.
6. Registrar o ID da release anterior antes de cada deploy.
7. Interromper a onda se houver aumento de 401/403, perda de tenant, duplicacao de escrita ou regressao maior que 10%.
8. Em regressao, restaurar a release anterior do Hosting; nao alterar dados para realizar rollback de frontend.
9. Atualizar o Service Worker apenas por versao controlada, sem apagar caches privados fora do logout/troca de tenant.

## Rollout Controlado - 2026-07-23

- Firebase CLI reautenticado antes da publicacao; o primeiro deploy recusado por sessao expirada nao alterou o Hosting.
- Database Rules e Functions de perfil/membership publicadas com reparo restrito ao usuario autenticado e ao tenant resolvido no servidor.
- Preview publicado em <https://sisweb-7ce82--bootstrap-firebase-20260723-7qbossgf.web.app>, com expiracao em 2026-07-30.
- Smoke autenticado no tenant secundario aprovado sem registrar credenciais ou identificadores na story.
- Edicao do perfil empresarial foi aberta e salva no Preview e no Hosting live sem `403`, `PERMISSION_DENIED` ou perda de tenant.
- Pedido de compra de teste passou de pendente para aprovado em atualizacao atomica; a conta vinculada apareceu em Contas a Pagar com origem Compras.
- IDs legados numericos de contas a pagar geradas por Compras agora sao normalizados para texto antes de compor chave e payload no Realtime Database.
- Vendas e Compras passaram a compartilhar a mesma garantia: uma falha na mutacao financeira atomica nao pode salvar somente o pedido nem exibir falso sucesso.
- Smoke live de Vendas preservou a sessao/tenant e carregou clientes, produtos e tipos financeiros sem novo `error` ou `warn` no ciclo do modulo.
- Suite completa: 320 testes aprovados, 1 skip esperado no comando geral; smoke RBAC explicito com 17/17 testes no Emulator.
- Build do Hosting: 449 arquivos allowlisted e 19.664.662 bytes; auditoria encontrou zero SDK Firebase direto, zero cachebuster ausente e zero conflito.
- O utilitario administrativo `apply-firebase-rules.js` permanece disponivel apenas no repositorio e foi removido da allowlist publica do Hosting, com teste de regressao no manifesto.
- Hosting live publicado somente depois dos gates e do smoke no Preview.
- Permanece um aviso generico e nao bloqueante de verificacao Auth durante o bootstrap da pagina de Empresa; a sessao, a leitura e a escrita permaneceram funcionais.

## Riscos

- Dependencias ocultas das globais compat em paginas legadas.
- Duas pilhas Firebase temporariamente ativas durante uma migracao mal isolada.
- Cache cruzado entre tenants se a chave nao incluir usuario e tenant.
- Logout incompleto por listener sobrevivente.
- Dados desatualizados se TTL for aplicado sem invalidacao por escrita.
- Metricas contaminadas por extensoes ou por console acumulado.
- Drift entre a arvore local, o GitHub e o Hosting publicado.
- Big-bang de Auth afetar todos os modulos ao mesmo tempo.

## Quality Gates

- `npm run lint`
- `npm run typecheck`
- `npm run build --if-present`
- `npm test`
- E2E autenticado via secret, sem credencial no repositorio.
- Auditoria automatica de logs sem PII.
- Smoke multitenant e logout em Preview Channel.
- CodeRabbit sem issue CRITICAL.

Observacao: os scripts atuais de lint/typecheck cobrem principalmente `folha_pagamento`; a story deve ampliar os gates para os servicos centrais e o Login.

## Evidencias Ja Concluidas

- [x] Smoke autenticado de producao nas rotas principais.
- [x] Teste funcional de `Fale Conosco` sem abertura de suporte.
- [x] Auditoria estatica de Auth, Firebase, menu, dashboard, cache e Service Worker.
- [x] Auditoria de responsividade e acessibilidade do Portal de Acesso.
- [x] Pareceres especializados de Arquitetura, Performance, UX e QA.
- [x] Contrato de diagnostico opt-in validado por 10/10 testes dedicados.
- [x] Preview Channel e Hosting live publicados com release anterior registrada para rollback.
- [x] Matriz autenticada live aprovada em tres ciclos consecutivos nas sete rotas criticas e um ciclo complementar em quatro rotas.
- [x] Console final sem `401`, `403`, perda de Auth, erro de sintaxe ou PII detectavel.
- [x] `git diff --check` sem erro de whitespace.
- [x] `npm run lint` concluido sem erro.
- [x] `npm run typecheck` concluido sem erro.
- [x] `npm test` concluido com 320 testes aprovados e 1 skip esperado para o Emulator no comando geral.
- [x] Smoke RBAC explicito concluido com 17/17 testes no Emulator ativo.
- [x] `npm audit --audit-level=high` concluido sem vulnerabilidades.
- [x] `npm run build:hosting` concluido com 449 arquivos allowlisted e 19.664.662 bytes no diretorio de build.
- [x] Rules, Functions, Preview e Hosting live publicados na ordem controlada documentada.

## File List Atual

- `auth-performance-diagnostics.js`
- `tests/auth-performance-diagnostics.test.mjs`
- `hosting-files.json`
- `auth.js`
- `firebaseService.js`
- `support-callable-service.js`
- `firebaseService.unified.js`
- `modules/core/firebase-service.js`
- `src/services/firebaseService.js`
- `src/services/firebaseService.unified.js`
- `firebase-connection-manager-compat.js`
- `romaneio-firebase-service.js`
- `folha_pagamento/folha-firebase-manager.js`
- `login.html`
- `index.html`
- `vendas.html`
- `vendas.js`
- `compras.html`
- `compras.js`
- `estoque.html`
- `estoque.js`
- `financas.html`
- `financas.js`
- `notas-fiscais.html`
- `client.html`
- `fornecedor.html`
- `company.html`
- `romaneiotl.html`
- `folha_pagamento/folha.html`
- `tests/auth-session-phase2.test.mjs`
- `tests/subscription-readonly-expiry.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/company-logo-storage-policy.test.mjs`
- `tests/dashboard-auth-callable-guard.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/tenant-operational-safe-modules.test.mjs`
- `tests/vendas-tenant-auth-guard.test.mjs`
- `tests/vendas-financeiro-status.test.mjs`
- `tests/compras-financeiro-status.test.mjs`
- `tests/company-profile-permissions.test.mjs`
- `tests/security-rbac-multitenant.test.mjs`
- `tests/security-rbac-emulator.test.mjs`
- `database.rules.json`
- `functions/index.js`
- `hosting-files.json`
- `package.json`
- `docs/stories/2026-07-14-auth-navigation-performance-ux.md`

### Arquivos Alterados No Rollout 2026-07-23

- `admin-access-governance.html`
- `admin-settings.html`
- `admin-subscriptions.html`
- `admin.html`
- `ajuda.html`
- `ajudabitolas.html`
- `client.html`
- `company.html`
- `compras.html`
- `compras.js`
- `database.rules.json`
- `docs/stories/2026-07-14-auth-navigation-performance-ux.md`
- `estoque.html`
- `financas.html`
- `financas.js`
- `firebase-rules-update.html`
- `fix-firebase-rules.html`
- `folha_pagamento/banco-horas-firebase.js`
- `folha_pagamento/folha-cargos.js`
- `folha_pagamento/folha-filtros.js`
- `folha_pagamento/folha-firebase-manager.js`
- `folha_pagamento/folha-firebase-optimized.js`
- `folha_pagamento/folha-funcionarios.js`
- `folha_pagamento/folha-lancamentos.js`
- `folha_pagamento/folha-main.js`
- `folha_pagamento/folha-relatorios.js`
- `folha_pagamento/folha-utils.js`
- `folha_pagamento/folha.html`
- `fornecedor.html`
- `functions/index.js`
- `importar_especies.html`
- `importar_especies_direto.js`
- `index.html`
- `login.html`
- `mdf-e.html`
- `menu-component.js`
- `migrar-contas.html`
- `migrate-to-firebase.html`
- `modules/core/firebase-service.js`
- `modules/romaneiopct/modal-lista-romaneios-pct.js`
- `notas-fiscais.html`
- `package.json`
- `preromaneio.html`
- `reset-system.html`
- `romaneiopct.html`
- `romaneiopes.html`
- `romaneiotl.html`
- `romaneiotora.html`
- `romaneiotora_otimizado.html`
- `romaneiotora_versao_dev.html`
- `species.html`
- `src/services/firebaseService.js`
- `subscription-status.html`
- `subscription.html`
- `support-callable-service.js`
- `sw.js`
- `tests/auth-session-phase2.test.mjs`
- `tests/client-supplier-fiscal-fields.test.mjs`
- `tests/company-profile-permissions.test.mjs`
- `tests/compras-financeiro-status.test.mjs`
- `tests/estoque-pwa-impressao.test.mjs`
- `tests/financas-contas-pagar-edit.test.mjs`
- `tests/firebase-init.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/security-rbac-emulator.test.mjs`
- `tests/security-rbac-multitenant.test.mjs`
- `tests/tenant-operational-safe-modules.test.mjs`
- `tests/vendas-financeiro-status.test.mjs`
- `tools/audit-cachebusters.mjs`
- `tools/healthcheck-firebase-sdk.mjs`
- `tools/inject-cachebusters.mjs`
- `tools/run-multitenant-smoke.mjs`
- `user-profile.html`
- `vendas.html`
- `vendas.js`

## File List Previsto

- `firebaseService.js`
- `auth.js`
- `login.html`
- `menu-component.js`
- `database-utils.js`
- `sw.js`
- `index.html`
- `financas.html`
- `company.html`
- `romaneiotl.html`
- `folha_pagamento/folha.html`
- `vendas.js`
- `compras.js`
- `financas.js`
- `modules/core/firebase-service.js`
- `src/services/firebaseService.js`
- `modules/dashboard/dashboard-core.js`
- testes unitarios e E2E de Auth, navegacao, cache, PWA e UX.

## Definition Of Done

- Story, checklist e File List real atualizados.
- Uma unica pilha Firebase e contexto de sessao por pagina auditada.
- Metricas e criterios de desempenho atendidos.
- Login, Registro, Recuperacao e Suporte funcionais, responsivos e acessiveis.
- Producao validada sem perda de Auth/tenant e sem regressao de escrita.
- Rollback de Hosting comprovado.
- Nenhum segredo, PII ou identificador real em codigo, testes, logs ou documentacao.
