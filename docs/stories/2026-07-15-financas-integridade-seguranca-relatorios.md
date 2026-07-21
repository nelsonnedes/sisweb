# Story: Financas - integridade, seguranca, relatorios e exportacoes

Data: 2026-07-15

## Status

Ready for Review - implementacao, gates locais e rollout controlado concluidos. Functions, Hosting e Rules estao publicados; o tenant operacional real voltou a carregar o Financeiro em modo online e os relatorios usam o cabecalho empresarial compartilhado. O smoke autenticado com um segundo tenant descartavel permanece como ressalva conhecida porque a credencial fornecida nao autenticou.

## Decisao De Backlog E Nao Duplicacao

Foi criada uma nova story, em vez de estender uma story existente.

As stories financeiras anteriores estao concluidas ou em revisao e possuem recortes fechados:

- `2026-05-17-correcao-contexto-empresa-relatorios.md` centralizou o perfil de empresa usado em relatorios.
- `2026-06-11-pwa-estoque-financas-responsivo.md` corrigiu quebras responsivas pontuais, sem alterar persistencia ou calculos.
- `2026-06-12-vendas-estorno-financeiro-status.md` e `2026-06-12-compras-estorno-financeiro-status.md` protegeram o estorno atomico vinculado a pedidos.
- `2026-06-16-estoque-financas-notas-tenant-seguro.md` bloqueou o carregamento operacional online sem tenant autenticado.
- `2026-06-17-dashboard-logout-nf-callable-session-guard.md` corrigiu o bootstrap de sessao do Financeiro.
- `2026-07-14-auth-navigation-performance-ux.md` ainda responde pela pilha Firebase canonica, sessao, cache e performance de navegacao.

Esta story nao reabre esses aceites. Ela cobre a lacuna ainda nao documentada de integridade das mutacoes financeiras, concorrencia de pagamentos e sequencias, completude e seguranca de relatorios/exportacoes e fechamento da UX responsiva do modulo.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools:
  - "testes automatizados de concorrencia e falha"
  - "smoke multitenant autenticado"
  - "QA visual responsivo"
  - "revisao de seguranca"
supporting_agents:
  - "@architect"
  - "@data-engineer"
  - "@ux-design-expert"
  - "@devops"
```

## Story

**Como** usuario financeiro autenticado de uma empresa,
**quero** registrar contas, pagamentos, relatorios e exportacoes com persistencia confirmada e isolamento estrito por tenant,
**para que** saldos, sequencias e documentos sejam confiaveis mesmo sob falha de rede, concorrencia e uso em telas pequenas.

## Contexto

O Financeiro usa os caminhos canonicos `companies/{companyId}/financas/receber/{mes}` e `companies/{companyId}/financas/pagar/{mes}`, alem de `finance_snapshots`, `sequences` e anexos no Storage. O modulo ja possui guarda inicial de tenant e calculo financeiro central, mas os artefatos atuais mostram riscos que atravessam toda a operacao:

- `saveToFirebase()` e `updatePaths()` retornam `{ success: false }` em falhas, enquanto varios fluxos apenas aguardam a Promise e continuam como se a escrita tivesse sido confirmada.
- O registro de pagamento altera o objeto em memoria antes da confirmacao remota, captura falha de persistencia e ainda fecha o modal e exibe sucesso.
- As sequencias `contasReceberManual` e `contasPagarManual` usam leitura seguida de escrita, permitindo colisao entre duas sessoes concorrentes; o fallback por timestamp pode parecer um numero canonico.
- Os relatorios existentes de inadimplencia, faturamento, categorias, clientes e fornecedores calculam sobre arrays carregados na pagina e podem representar apenas parte dos meses necessarios.
- A exportacao anunciada como Excel gera CSV, cobre somente parte dos tipos de relatorio e interpola conteudo sem um contrato unico de neutralizacao para HTML e planilhas.
- A story responsiva anterior deixou pendente a validacao visual real do Financeiro em mobile.

## Objetivo

Garantir que nenhuma mutacao financeira seja apresentada como concluida antes do aceite do backend, serializar pagamentos e sequencias concorrentes, produzir relatorios e exportacoes completos para o escopo solicitado e manter todas as operacoes isoladas por tenant, seguras e utilizaveis de 320 px a desktop.

## Principios E Dependencias

- Seguir `CLI First -> Observability Second -> UI Third`: primeiro testes/harness e contratos de persistencia, depois diagnostico seguro e, por ultimo, ajustes visuais.
- Reusar `resolveAuthenticatedTenant`, `getCompanyProfileForReport`, caminhos canonicos e a fonte de calculo `getContaFinanceInfo`; nao criar um resolvedor paralelo de tenant ou uma segunda regra de calculo.
- Reusar o padrao de lote atomico validado nas stories de estorno de Vendas e Compras quando houver atualizacao de varios caminhos.
- Consumir o bootstrap canonico do Financeiro da Fase 3 de `2026-07-14-auth-navigation-performance-ux.md`; a consolidacao geral das pilhas Firebase permanece fora desta story.
- Preservar os tipos atuais de relatorio: inadimplencia, faturamento, categorias, clientes e fornecedores.
- Nao usar cache local, snapshot derivado ou arrays em memoria como autorizacao, confirmacao de escrita ou fonte silenciosa de um relatorio declarado completo.

## Fora De Escopo

- Criar novos tipos de relatorio, indicadores contabeis ou regras de juros.
- Alterar regras de negocio de Vendas, Compras, Folha ou NF-e ja cobertas por outras stories.
- Migrar, apagar, corrigir ou renumerar dados financeiros reais nesta story.
- Exigir sequencia sem lacunas; o requisito e unicidade e ordem atomica sob concorrencia.
- Reescrever o Sisweb como SPA ou duplicar a consolidacao de Auth/Firebase da story de 2026-07-14.
- Publicar Rules, Functions ou Hosting sem preview, smoke e autorizacao do agente responsavel.

## Acceptance Criteria

### A. Isolamento Multitenant

- [ ] **AC-01** Toda leitura, escrita, transacao, snapshot, sequencia, relatorio e exportacao do Financeiro exige tenant autenticado confirmado; online, `company_info`, `window.appTenantId` ou cache antigo nao liberam operacao por conta propria.
- [ ] **AC-02** Todos os caminhos financeiros resolvidos pelo cliente permanecem sob `companies/{companyId}` do usuario atual; caminho absoluto ou ja prefixado para tenant diferente e rejeitado antes de acessar o backend.
- [x] **AC-03** Cabecalho, logo e dados empresariais dos relatorios usam `getCompanyProfileForReport()` para o tenant confirmado e nunca selecionam a primeira empresa global.
- [ ] **AC-04** Logout, troca confirmada de usuario ou tenant e retorno pelo historico removem listeners, selecoes, arrays, resultados de relatorio e URLs de exportacao privados da sessao anterior.
- [ ] **AC-05** Teste automatizado e smoke autenticado com dois tenants comprovam que contas, sequencias, snapshots, cabecalhos, relatorios e exportacoes de A nunca aparecem para B.

### B. Falha Explicita De Persistencia

- [ ] **AC-06** Criar, editar ou excluir conta e registrar ou excluir pagamento tratam retorno ausente ou `{ success: false }` de `saveToFirebase`, `updatePaths` ou transacao como falha; nenhuma dessas respostas pode gerar toast de sucesso.
- [ ] **AC-07** A UI somente confirma a mutacao, fecha modal, limpa formulario e atualiza estado derivado depois do aceite remoto; em falha, preserva os dados digitados, reabilita a acao e oferece nova tentativa segura.
- [ ] **AC-08** Depois de falha ou conflito, o estado em memoria e reconciliado com o backend antes de aceitar outra mutacao na mesma conta, evitando que uma alteracao local nao persistida contamine saldo, tabela, relatorio ou snapshot.
- [ ] **AC-09** Falha de `finance_snapshots` e tratada como degradacao explicita de dado derivado, sem desfazer uma mutacao canonica ja confirmada e sem apresentar o snapshot antigo como atualizado.
- [ ] **AC-10** Upload concluido seguido de falha na gravacao da conta nao deixa comprovante ou anexo sem referencia de forma silenciosa; a compensacao ou pendencia de limpeza fica observavel e testada.
- [ ] **AC-11** Logs e mensagens distinguem indisponibilidade, permissao, conflito e validacao sem registrar tenant real, UID, dados bancarios, payload financeiro ou conteudo de comprovante.

### C. Transacoes De Pagamentos E Sequencias

- [ ] **AC-12** Inclusao e exclusao de pagamento/recebimento usam transacao sobre a versao remota mais recente da conta, atualizando historico, `valorPago`, `valorRestante`, juros base, data e status como uma unica unidade consistente.
- [ ] **AC-13** A transacao impede saldo negativo, pagamento acima do valor exigivel, perda de atualizacao e duplicacao causada pelo mesmo submit; conflito concorrente termina em sucesso confirmado uma vez ou erro explicito, nunca em sobrescrita silenciosa.
- [ ] **AC-14** Os valores transacionados respeitam precisao de centavos e os mesmos invariantes de `getContaFinanceInfo`, inclusive pagamentos parciais, juros e exclusao de um item do historico.
- [ ] **AC-15** `sequences/contasReceberManual` e `sequences/contasPagarManual` sao incrementadas por operacao atomica tenant-scoped, gerando numeros unicos e crescentes quando duas sessoes salvam ao mesmo tempo.
- [ ] **AC-16** Indisponibilidade ou rejeicao da transacao de sequencia bloqueia a confirmacao da conta com numero canonico; fallback temporal nao e persistido nem exibido como sequencia oficial.
- [ ] **AC-17** Conta parcelada consome uma unica sequencia base e deriva seus sufixos sem nova disputa; o lote de parcelas nao pode ficar parcialmente confirmado sem erro e reconciliacao explicitos.

### D. Relatorios Completos E Seguros

- [ ] **AC-18** Antes de gerar cada relatorio, o modulo carrega e confirma todas as particoes mensais exigidas pelo periodo ou escopo solicitado; falha ou mes nao confirmado bloqueia o resultado completo e identifica a pendencia sem reutilizar resultado antigo.
- [ ] **AC-19** Inadimplencia, faturamento, categorias, clientes e fornecedores usam a mesma normalizacao de datas, status, pagamentos parciais, saldo e juros usada nas tabelas; totais de tela, relatorio, PDF e planilha coincidem para o mesmo filtro.
- [ ] **AC-20** Alteracao de tipo, periodo ou tenant invalida o resultado anterior; loading, vazio, erro e sucesso sao estados distintos e acessiveis.
- [ ] **AC-21** Todo valor dinamico inserido no HTML de relatorio ou impressao e codificado antes da renderizacao, impedindo execucao de markup/script vindo de descricao, cliente, fornecedor, categoria ou observacao.
- [ ] **AC-22** Relatorios nao consultam a raiz global de empresas nem misturam cache, listener ou snapshot de outro tenant; o tenant do conjunto de dados e validado novamente imediatamente antes de renderizar ou exportar.

### E. Exportacoes

- [ ] **AC-23** PDF e exportacao de planilha funcionam para todos os cinco tipos de relatorio atualmente oferecidos, com o mesmo periodo, filtros, linhas e totais do resultado visivel.
- [ ] **AC-24** Exportacoes das tabelas de Pagar e Receber respeitam o conjunto filtrado/selecionado apresentado ao usuario, em vez de exportar silenciosamente todos os arrays carregados.
- [ ] **AC-25** Formato, extensao, MIME e rotulo da acao sao coerentes: se o arquivo gerado for CSV, a interface e o nome informam CSV; se for XLSX, o conteudo e um XLSX valido.
- [ ] **AC-26** Campos de planilha potencialmente interpretados como formula (`=`, `+`, `-` ou `@`) sao neutralizados, e nomes de arquivo nao contem PII, tenant real ou valores fornecidos sem sanitizacao.
- [ ] **AC-27** Uma exportacao incompleta, vazia por falha de carga, bloqueada por popup ou interrompida nao exibe sucesso; URLs temporarias sao revogadas depois do uso ou erro.

### F. UX Responsiva E Acessivel

- [ ] **AC-28** Contas a Receber, Contas a Pagar, modal de pagamento, historico, filtros, relatorios e barras de exportacao funcionam em 320x480, 390x844, 768x1024 e 1366x768 sem sobreposicao, corte de acoes ou scroll horizontal do documento.
- [ ] **AC-29** Tabelas largas usam o contrato responsivo existente do projeto, preservando rotulos, valores, status e acoes; controles de filtro e exportacao quebram linha sem alterar a largura do layout.
- [ ] **AC-30** Durante persistencia ou transacao, a acao possui estado ocupado, impede submit repetido e mantem foco/feedback acessivel; em erro, o foco retorna ao contexto que permite corrigir ou repetir.
- [ ] **AC-31** Operacoes essenciais funcionam por teclado, modais fecham de forma previsivel, textos e botoes permanecem legiveis e o contraste atende WCAG 2.2 AA.

### G. Qualidade E Producao

- [ ] **AC-32** Testes automatizados cobrem sucesso, `{ success: false }`, excecao, perda de rede, permissao, concorrencia de duas sessoes, dois tenants, pagamento parcial, exclusao, sequencia, relatorio parcial e neutralizacao de exportacao.
- [ ] **AC-33** `npm run lint`, `npm run typecheck`, `npm test` e `npm run build --if-present` passam; CodeRabbit nao possui issue CRITICAL.
- [ ] **AC-34** Preview e smoke autenticado validam a matriz financeira em dois tenants sem alterar dados reais; a release anterior e registrada e o rollback de Hosting e Rules, quando houver alteracao de Rules, e documentado.

## Tarefas Em Ondas

### Onda 0 - Baseline, Contratos E Harness CLI

- [ ] Mapear todos os pontos de mutacao de contas, pagamentos, anexos, snapshots, preferencias e sequencias para uma matriz `acao -> caminho -> retorno -> efeito de UI` (AC-01, AC-06).
- [ ] Criar testes focados que reproduzam falso sucesso, colisao de sequencia, pagamento concorrente, relatorio com meses parciais e exportacao insegura antes de alterar comportamento (AC-06, AC-13, AC-18, AC-26, AC-32).
- [ ] Registrar baseline anonimizada de cargas, listeners, falhas e tempos usando o diagnostico opt-in da story de Auth/Performance, sem persistir payload financeiro (AC-11).
- [ ] Confirmar o gate da Fase 3 da story de 2026-07-14: um unico bootstrap Firebase e tenant autenticado estavel no Financeiro.

### Onda 1 - Tenant E Contrato De Persistencia

- [ ] Centralizar no dominio financeiro a validacao de tenant e de resultado de escrita, reutilizando os servicos existentes (AC-01 a AC-08).
- [ ] Fazer todos os fluxos de conta/pagamento verificarem o aceite remoto antes de mutar a UI para sucesso (AC-06, AC-07).
- [ ] Reconciliar memoria/listeners depois de erro e separar falha canonica de falha de snapshot derivado (AC-08, AC-09).
- [ ] Definir e testar compensacao de anexo/comprovante quando Storage e RTDB divergirem (AC-10).
- [ ] Auditar `database.rules.json` e `storage.rules` para Financeiro sem ampliar acesso global; qualquer ajuste deve preservar membership/claims do tenant e assinatura valida (AC-01 a AC-05).

### Onda 2 - Transacoes Financeiras E Sequencias

- [ ] Expor/reusar uma primitiva transacional tenant-scoped no servico Firebase canonico, com retorno estruturado de commit, conflito, permissao e indisponibilidade (AC-12, AC-15).
- [ ] Migrar inclusao e exclusao de pagamentos/recebimentos para transacao baseada no registro remoto, com calculo em centavos e invariantes do dominio (AC-12 a AC-14).
- [ ] Tornar o submit idempotente no escopo de uma acao de usuario e validar duas sessoes concorrentes sobre a mesma conta (AC-13, AC-30, AC-32).
- [ ] Migrar sequencias RX/PX para incremento atomico e remover o fallback temporal do caminho de confirmacao canonica (AC-15, AC-16).
- [ ] Validar criacao concorrente de contas simples e parceladas, incluindo falha no meio do lote e reconciliacao (AC-17).

### Onda 3 - Relatorios Completos E Seguros

- [ ] Criar um pipeline unico `escopo -> carga confirmada -> normalizacao -> agregacao -> renderizacao`, sem calcular sobre meses parcialmente carregados (AC-18 a AC-22).
- [ ] Aplicar `getContaFinanceInfo` e normalizadores de data/status em todos os cinco relatorios (AC-19).
- [ ] Invalidar resultado em mudanca de filtro/tenant e implementar estados de loading, vazio e erro sem conservar HTML antigo (AC-20).
- [ ] Codificar dados dinamicos e reutilizar o perfil seguro de empresa no HTML/PDF (AC-03, AC-21, AC-22).
- [ ] Testar contas pendentes, vencidas, parciais e pagas, com e sem juros, atravessando mais de um mes (AC-18, AC-19, AC-32).

### Onda 4 - Exportacoes E UX Responsiva

- [ ] Fazer PDF e planilha reutilizarem exatamente o dataset normalizado do relatorio visivel para os cinco tipos atuais (AC-23).
- [ ] Fazer exportacao de tabela respeitar filtros e selecao, com contrato explicito para ausencia de dados (AC-24, AC-27).
- [ ] Alinhar rotulo/formato e neutralizar formulas, HTML e nomes de arquivo; revogar URLs temporarias (AC-25 a AC-27).
- [ ] Ajustar filtros, toolbars, tabelas, relatorios e modais para a matriz responsiva sem regressao desktop (AC-28, AC-29).
- [ ] Validar teclado, foco, estado ocupado, mensagens e contraste com QA visual (AC-30, AC-31).

### Onda 5 - Gates, Preview, Rollout E Encerramento

- [ ] Rodar testes focados, suite completa, lint, typecheck e build (AC-32, AC-33).
- [ ] Executar revisoes independentes de Arquitetura, Dados/Rules, UX e QA antes do deploy.
- [ ] Publicar preview escopado e executar smoke com dois tenants de homologacao, duas sessoes concorrentes e dados descartaveis (AC-05, AC-32, AC-34).
- [ ] Comparar baseline, revisar logs sem PII e interromper rollout em falso sucesso, duplicacao, saldo divergente, relatorio parcial ou vazamento de tenant.
- [ ] Registrar release anterior e plano de rollback por camada; publicar somente pelo agente autorizado (AC-34).
- [ ] Atualizar Acceptance Criteria, checklist, evidencias e File List real antes de mover para Review.

## Riscos De Producao

| Risco | Impacto | Deteccao/Gate | Mitigacao E Rollback |
|---|---|---|---|
| Duas sessoes pagam a mesma conta | Saldo negativo, historico perdido ou pagamento duplicado | Teste concorrente e smoke com duas sessoes | Transacao sobre estado remoto; abortar conflito e restaurar release anterior |
| Sequencia RX/PX colide | Documentos com numero duplicado | Teste paralelo por tenant | Incremento atomico; bloquear confirmacao sem numero canonico |
| Servico retorna `success: false` sem rejeitar Promise | Falso sucesso e divergencia entre tela e banco | Testes de contrato para retorno e excecao | Validador unico de persistencia; UI confirma somente apos commit |
| Listener antigo sobrescreve estado apos commit | Saldo visual regride ou troca de tenant reaparece | Telemetria de geracao da sessao e E2E logout/troca | Invalidar listeners por geracao e recarregar registro canonico |
| Relatorio usa apenas meses ja carregados | Totais financeiros incompletos com aparencia valida | Teste multi-mes e indicador de carga confirmada | Bloquear render/export ate completar o escopo |
| HTML ou planilha interpreta dado empresarial | XSS em impressao ou formula injection no arquivo | Casos com payloads `script`, `=`, `+`, `-`, `@` | Encoding por destino e neutralizacao de celulas |
| Upload persiste e conta falha | Arquivo orfao e custo/privacidade no Storage | Teste de falha entre Storage e RTDB | Compensacao/limpeza observavel antes de encerrar a acao |
| Snapshot falha depois da conta | Dashboard derivado desatualizado | Estado `snapshot stale` e teste de recomputacao | Manter fonte canonica; recomputar snapshot sem reexecutar pagamento |
| Rules endurecidas bloqueiam usuarios validos | Financeiro indisponivel em producao | Emulator/teste de claims, membership e assinatura | Deploy separado de Rules, preview e rollback da versao anterior |
| Cache/SW serve JS anterior | Contrato antigo continua gerando falso sucesso | Verificacao HTTP/cachebuster no preview | Release versionada e rollback de Hosting |
| Relatorio amplo consome memoria/tempo excessivo | Travamento em mobile e exportacao incompleta | Baseline e teste de periodo amplo | Carga por ondas/limite observavel sem declarar resultado parcial como completo |
| Logs capturam dados financeiros | Exposicao de PII e informacao empresarial | Auditoria automatica de logs | Eventos anonimizados e diagnostico somente opt-in |

## Observabilidade Segura

Permitido registrar: `pageViewId` efemero, rota, operacao normalizada, fase (`start`, `committed`, `aborted`, `reconciled`), categoria de erro, duracao, quantidade de meses/linhas e hash efemero do tenant.

Proibido registrar: tenant/UID reais, nomes, CPF/CNPJ, descricao, observacao, valor, saldo, metodo de pagamento, URL de comprovante, payload de conta, token ou conteudo exportado.

## Estrategia De Testes

- Unitarios: calculo em centavos, invariantes de saldo/status, encoding HTML, neutralizacao de planilha, nomes de arquivo e validacao de retorno de persistencia.
- Integracao com Firebase Emulator ou equivalente isolado: transacao de conta, sequencias concorrentes, Rules, dois tenants e falhas de rede/permissao.
- E2E autenticado: criar/editar conta descartavel, pagamento parcial/total, exclusao, relatorio multi-mes, PDF/planilha, erro e retry.
- Visual/acessibilidade: 320x480, 390x844, 768x1024 e 1366x768, teclado, foco, loading, vazio e erro.
- Regressao: estornos de Vendas/Compras, tenant operacional seguro, bootstrap Auth e relatorios com perfil da empresa.

## Evidencias Da Preparacao

- `npm run lint`: passou; o script atual cobre `folha_pagamento/**/*.js`, portanto nao valida ainda o modulo Financeiro.
- `npm run typecheck`: passou; o script atual cobre os arquivos JavaScript tipados da Folha, portanto nao valida ainda `financas.js`.
- `npm test`: passou com 224/224 testes.
- `npm run build --if-present`: encerrou sem executar build porque nao existe script `build`.
- `npm run build:hosting`: passou com 448 arquivos e 19.427.541 bytes em `hosting-dist`.
- `git diff --check -- docs/stories/2026-07-15-financas-integridade-seguranca-relatorios.md`: passou.

Essas evidencias representam apenas a baseline da criacao documental. Os gates da implementacao permanecem abertos ate existirem os testes e a cobertura financeira definidos nesta story.

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> `coderabbit_integration.enabled` nao esta habilitado em `.aiox-core/core-config.yaml`. A validacao usara revisao manual; antes da conclusao, CodeRabbit nao pode reportar issue CRITICAL caso seja executado no fluxo de PR.

## Checklist Inicial

### Preparacao Da Story

- [x] Constitution lida e limites de autoridade respeitados.
- [x] Story de 2026-07-14 e stories financeiras existentes revisadas.
- [x] Duplicacao analisada; nova story justificada e dependencias registradas.
- [x] Objetivo, fora de escopo, Acceptance Criteria e ondas definidos.
- [x] Riscos de producao, observabilidade, testes e File List inicial registrados.
- [x] Nenhum codigo, Rule, dado real ou arquivo fora de `docs/stories` alterado por esta preparacao.

### Gate Para Desenvolvimento

- [x] PO valida prioridade, escopo e dependencia da Fase 3 de Auth/Performance.
- [x] Arquitetura valida a primitiva transacional e os limites entre servico central e dominio financeiro.
- [x] Data Engineer/QA valida estrategia de Rules, Emulator e concorrencia.
- [x] UX valida matriz responsiva e estados de erro/loading.
- [ ] Ambiente de teste possui dois tenants e dados descartaveis sem credenciais no repositorio.

### Gate Para Review/Producao

- [ ] Todos os Acceptance Criteria possuem evidencia rastreavel.
- [x] `npm run lint` passou.
- [x] `npm run typecheck` passou.
- [x] `npm test` passou.
- [x] `npm run build --if-present` passou.
- [ ] Smoke multitenant, concorrencia e responsividade passou em preview.
- [x] Logs e artefatos nao contem PII, segredo ou payload financeiro.
- [x] Checklist e File List real foram atualizados.
- [x] Release anterior e rollback por camada foram registrados.

## Story Draft Checklist Result

| Categoria | Status | Observacao |
|---|---|---|
| Goal & Context Clarity | PASS | Objetivo, valor, lacuna e nao duplicacao estao explicitos. |
| Technical Implementation Guidance | PASS | Pontos de integracao, invariantes, ondas e arquivos previstos foram identificados sem prescrever nova tecnologia. |
| Reference Effectiveness | PASS | As stories anteriores foram resumidas e vinculadas ao recorte que permanece valido. |
| Self-Containment | PASS | Requisitos, erros, concorrencia, seguranca, UX e fora de escopo estao no documento. |
| Testing Guidance | PASS | Unitario, integracao, E2E, visual, multitenant e concorrencia foram cobertos. |
| CodeRabbit Integration | N/A | Integracao nao habilitada no core-config; revisao manual registrada. |

**Avaliacao:** READY para validacao do PO. A implementacao da Onda 1 permanece condicionada ao gate de bootstrap canonico do Financeiro.

## File List Inicial

### Documentacao Alterada Nesta Preparacao

- `docs/stories/2026-07-15-financas-integridade-seguranca-relatorios.md`

### Arquivos Previstos Para Implementacao

- `financas.js`
- `financas.html`
- `firebaseService.js`
- `database.rules.json` (somente se a auditoria comprovar ajuste necessario)
- `storage.rules` (somente se a auditoria comprovar ajuste necessario)
- `sw.js` ou manifesto de cache vigente (somente para versionar os assets alterados)
- `tests/financas-contas-pagar-edit.test.mjs`
- `tests/financas-integridade-persistencia.test.mjs` (novo, nome inicial)
- `tests/financas-relatorios-exportacoes.test.mjs` (novo, nome inicial)
- `tests/financas-responsive.test.mjs` (novo, nome inicial)
- `tests/tenant-operational-safe-modules.test.mjs`
- `tests/security-rbac-multitenant.test.mjs`

Esta lista e inicial e deve ser substituida pela File List real do Dev Agent, sem manter arquivos que nao forem modificados.

## Change Log

| Data | Versao | Descricao | Autor |
|---|---|---|---|
| 2026-07-21 | 0.8 | Lamina PIX deixou de montar caminhos Firebase com objetos de cliente legados; dependencias transitivas vulneraveis foram atualizadas sem mudanca de API. | Codex / equipe AIOX |
| 2026-07-18 | 0.7 | Relatorios passaram a selecionar contas a receber ou pagar, adaptar tipos e substituir CSV por impressao com cabecalho empresarial compartilhado. | Codex / equipe AIOX |
| 2026-07-18 | 0.6 | Impressao de contas selecionadas corrigida para substituir integralmente o documento de carregamento, usar A4 adaptavel e preservar colunas; perfil de relatorio passou a manter os dados PIX cadastrados. | Codex / equipe AIOX |
| 2026-07-18 | 0.5 | Cabecalho empresarial unificado em preview, impressoes, PDF e lamina PIX; protecao anti-GET nos formularios de autenticacao e smoke de producao atualizado. | Codex / equipe AIOX |
| 2026-07-18 | 0.4 | Backend financeiro autoritativo, Rules, frontend, relatorios, exportacoes e testes concluidos; preview responsivo validado e rollout controlado iniciado. | Codex / equipe AIOX |
| 2026-07-15 | 0.3 | Escopo aprovado; pareceres independentes de Arquitetura, Seguranca, QA e UX incorporados; desenvolvimento iniciado pela Onda 0. | Codex / equipe AIOX |
| 2026-07-15 | 0.2 | Baseline de lint, typecheck, testes e build de Hosting registrada. | River (@sm/@po) |
| 2026-07-15 | 0.1 | Draft inicial criado apos analise de duplicacao e das stories financeiras existentes. | River (@sm/@po) |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5), com revisao direta de desenvolvimento, arquitetura, dados/Rules, seguranca, QA e UX. Os agentes independentes adicionais atingiram limite de uso nesta execucao e nao foram registrados como aprovadores.

### Debug Log References

- `npm run lint`: passou em 2026-07-18.
- `npm run typecheck`: passou em 2026-07-18.
- `npm --prefix functions run lint`: passou em 2026-07-18.
- `npm test`: 271 testes, 270 aprovados, 0 falhas e 1 skip esperado do Emulator na suite geral.
- `npm run test:security:emulator`: 13/13 testes aprovados.
- `npm run build:hosting`: 448 arquivos e 19.437.703 bytes.
- `npm run build --if-present`: passou; nao ha build adicional configurado.
- Hotfix de sincronizacao: 56/56 testes focados aprovados e suite geral mantida em 263 aprovados, 0 falhas e 1 skip esperado.
- Rules no Emulator: 13/13 testes aprovados, incluindo proprietario legado sem role duplicada, membership ausente, usuario sem permissao e conta com baixa imutavel.
- Preview: `https://sisweb-7ce82--finance-integrity-20260718-rd3akbvg.web.app` (expira em 2026-07-25).
- Verificacao HTTP do preview: cachebuster `finance-integrity-v3`, callables e helpers de renderizacao segura confirmados.
- QA visual de Relatorios: 1366x768, 390x844 e 320x480 sem overflow horizontal, sobreposicao ou corte das acoes; a captura mobile falhou por timeout do CDP, mas metricas DOM e snapshot estrutural passaram.
- Backup das Rules anteriores: `C:\Users\Nelson\AppData\Local\Temp\sisweb-database-rules-pre-finance-20260718.json`, SHA-256 `11F6C9A9AEA05387771E790B93FD37AC68298CEC942AE1023ADE8182F9B9BE88`.
- Rollback do Hosting: canal `pre-finance-20260718`, clonado de `live` antes do rollout.
- Conta de faturamento confirmada como aberta e projeto com billing habilitado antes da retomada do rollout.
- `updateMyCompanyProfile` republicada e preflight CORS validado com HTTP 204; salvamento real dos dados Pix existentes foi confirmado no tenant operacional sem erro CORS.
- Functions financeiras publicadas: `financeNextSequence`, `financeCreateAccounts`, `financeUpdateAccount`, `financeDeleteAccount`, `financeUpdatePaymentReceipt`, `financeRegisterPayment` e `financeDeletePayment`.
- Hosting e Realtime Database Rules publicados; Rules remotas comparadas semanticamente com o arquivo local.
- Verificacao final: `database-utils.js` remoto e local com SHA-256 `EC7CEE6DFF9298AD1F3B5A309E7AB63DC5C188716CCB8FABBD66A3993BEF3FAF`; Rules remotas com igualdade semantica e compatibilidade de proprietario ativa.
- Preflight CORS HTTP 204 confirmado para `updateMyCompanyProfile`, as sete Functions financeiras e `nf_uploadCertificadoA1`, todos aceitando a origem do Hosting.
- Smoke autenticado de producao: Financeiro em `Modo Online`, 16 contas a receber e 11 contas a pagar carregadas; nenhuma mutacao financeira executada.
- Smoke de relatorio no tenant operacional: preview de inadimplencia exibiu identidade, CNPJ, endereco, contato, titulo e periodo corretos a partir do perfil tenant-scoped.
- No diagnostico inicial, o perfil canonico do tenant operacional estava sem `logoStoragePath`/`logoUrl`, havia duas imagens legadas no prefixo e o relatorio aplicava o fallback de iniciais; esse estado foi preservado ate a execucao controlada descrita a seguir.
- A causa de infraestrutura foi confirmada e corrigida: a service account de runtime das Functions nao possuia acesso aos objetos do bucket, embora a conta de compute possuisse. O papel foi concedido somente no bucket do projeto.
- O perfil canonico do tenant operacional passou a referenciar `companies/{companyId}/profile/logo/current`; a atualizacao real do perfil acionou a reconciliacao server-side e removeu as duas copias antigas do prefixo.
- O relatorio de inadimplencia em producao exibiu a imagem real da empresa, recebida como DataURL, com dimensoes naturais 1200 x 1200, alem de razao social, CNPJ, endereco, contato, titulo e periodo.
- A impressao de contas selecionadas passou a substituir integralmente a janela temporaria de carregamento e usar A4 adaptavel, tabela de dez colunas com largura integral e campos criticos sem quebra indevida.
- O login do segundo tenant foi rejeitado como credencial invalida. O smoke de isolamento real permaneceu bloqueado, sem leitura de dados desse tenant.
- Durante essa tentativa foi reproduzida submissao HTML por GET antes do handler JavaScript. `loginForm`, `registerForm` e `forgotPasswordForm` passaram a declarar `method="post"`; o Hosting corrigido foi publicado e verificado por HTTP.
- `nf_uploadCertificadoA1` republicada depois da retomada dos servicos e preflight validado com HTTP 204.
- Correcao final de impressao: 57/57 testes focados aprovados; suite geral com 278 testes, 277 aprovados, 0 falhas e 1 skip esperado do Emulator.
- Build final de Hosting: 448 arquivos e 19.438.942 bytes; dry-run e deploy de Hosting concluidos em `https://sisweb-7ce82.web.app`.
- Verificacao HTTP confirmou `financas.html`, `financas.js`, `firebaseService.js`, `commerce-pdf-share.js` e `sw.js` na versao `2026-07-19-finance-print-pix-v1`.
- Smoke autenticado pos-deploy: selecao de cinco contas gerou um unico documento final, sem o texto de carregamento, com logo real, cabecalho empresarial, dez colunas, subtotais e total geral.
- Metricas DOM da impressao live: um unico filho direto no `body`, `bodyScrollWidth` igual a `bodyClientWidth`, tabela com a mesma largura e limite direito da pagina e classes `nowrap` efetivas em documento, valores, data e status.
- Smoke da lamina PIX pos-deploy: conta a receber do tipo boleto processada sem o bloqueio de dados PIX incompletos; o console nao registrou erro novo, apenas o aviso generico de permissao ja rastreado na story de Auth/tenant.
- Relatorios por origem: seletor `receber`/`pagar`, assinatura incluindo origem, quatro tipos compativeis por contexto e carregamento estrito somente das particoes solicitadas.
- A barra de Relatorios passou a oferecer Gerar Relatorio, Imprimir e PDF; o CSV seguro foi preservado somente para as tabelas operacionais.
- Teste funcional confirmou que categorias de receber nao incluem pagar, categorias de pagar nao incluem receber e Pagamentos por Periodo usa historico e rotulos de contas a pagar.
- Gates da entrega 0.7: 52/52 testes direcionados; suite geral com 281 testes, 280 aprovados, 0 falhas e 1 skip esperado do Emulator; lint, typecheck e build aprovados.
- Build de Hosting da entrega 0.7: 448 arquivos e 19.446.664 bytes com cache inicial `2026-07-19-finance-report-origin-print-v1`.
- Deploy da entrega 0.7 publicou somente Hosting; verificacao HTTP confirmou seletor, botao Imprimir, remocao do CSV da barra, tipos adaptativos e cache novo.
- Smoke autenticado live: Inadimplencia de Receber com 33 linhas, Inadimplencia de Pagar com 10 linhas, Pagamentos com 17 linhas e Faturamento com 37 linhas; colunas e resumos acompanharam a origem.
- A troca entre receber e pagar ocultou o resultado anterior e substituiu as opcoes por Faturamento/Clientes ou Pagamentos/Fornecedores conforme o contexto.
- Impressao live de Pagamentos exibiu logo real, empresa, origem, periodo, tres resumos e 17 linhas em um unico documento, sem texto de carregamento nem overflow horizontal.
- PDF permaneceu habilitado e concluiu sem erro bloqueante. Houve um timeout inicial isolado de 6 segundos na logo da previa; a impressao repetiu a resolucao e carregou a imagem corretamente.
- Ajuste final elevou a espera da logo da previa para 10 segundos e o cache para `2026-07-19-finance-report-origin-print-v2`, sem alterar o helper global ou o backend.
- Gates finais da v2: 53/53 testes direcionados; suite geral com 281 testes, 280 aprovados, 0 falhas e 1 skip esperado do Emulator; lint, typecheck, build e `git diff --check` aprovados.
- Build final da v2: 448 arquivos e 19.446.723 bytes. Dry-run e deploy publicaram somente Hosting em `https://sisweb-7ce82.web.app`.
- Verificacao HTTP confirmou `financas.html`, `financas.js` e `sw.js` na v2, alem do seletor de origem, botao Imprimir e espera de logo em 10 segundos.
- Smoke autenticado final confirmou a previa com logo incorporada em Data URL, imagem completa de 1200 x 1200, cabecalho empresarial, origem Contas a Receber e 33 linhas. A troca para Contas a Pagar invalidou o resultado anterior e exibiu somente Pagamentos, Categorias e Ranking de Fornecedores.

### Completion Notes List

- As mutacoes manuais de contas, edicao, exclusao, comprovantes e pagamentos foram centralizadas em sete callables tenant-scoped com validacao server-side e operacoes idempotentes/transacionais.
- Sequencias RX/PX passaram a ser atomicas e a criacao parcelada usa lote canonico com fingerprint estavel, independente de campos gerados pelo servidor.
- Vendas e Compras preservam apenas a origem canonica e deixaram de criar lancamentos financeiros planos redundantes.
- O frontend somente confirma sucesso apos resposta autoritativa, compensa uploads sem referencia e limpa arquivos removidos depois da persistencia confirmada.
- Relatorios e exportacoes compartilham dataset confirmado, neutralizam HTML/formulas CSV e usam selects dinamicos construidos por DOM seguro.
- `database.rules.json` bloqueia mutacoes financeiras diretas do cliente e preserva somente os fluxos canonicos de origem explicitamente validados.
- As Rules reconhecem o proprietario operacional legado pelo `companyId`, membership ativa e e-mail coincidente com o perfil da empresa, sem abrir acesso a usuario sem membership ou permissao financeira.
- `database-utils.js` deixou de sincronizar os pais financeiros protegidos e nao interpreta falha de leitura como base vazia para reenvio de cache local.
- Nao houve migracao, exclusao ou alteracao de dados financeiros reais durante implementacao, testes e preview.
- Residual conhecido: o ledger de idempotencia da exclusao de conta e best effort depois da remocao; uma perda simultanea da resposta e do ledger pode exigir reconciliacao, mas nao produz falso sucesso nem recria a conta.
- Residual observado no smoke: um aviso generico e isolado de permissao ainda aparece durante o bootstrap, mas a conexao muda para `Modo Online` e os dados reais carregam. A instrumentacao de origem desse aviso permanece na story `2026-07-14-auth-navigation-performance-ux.md`, sem bloquear este rollout financeiro.
- Pendente: smoke autenticado com um segundo tenant e dados descartaveis para fechar AC-05/AC-34; e necessario obter uma sessao valida do tenant B antes da nova tentativa.
- Concluido: logo canonica recuperada, referencia persistida, duplicatas removidas pelo backend e cabecalho com imagem real validado no Financeiro em producao.
- Concluido: o normalizador do perfil empresarial preserva chave, tipo, favorecido e banco PIX; a lamina volta a usar os dados ja persistidos sem exigir novo cadastro.
- Concluido: relatorios de receber e pagar possuem origem explicita, tipos semanticamente compativeis e impressao baseada no mesmo modelo confirmado da tela e do PDF.
- Concluido: a resolucao do sacado da lamina PIX aceita identificadores legados, mas rejeita objetos sem ID e chaves invalidas antes de montar `clientes/{id}`.
- Gate 2026-07-21: 282 testes aprovados, 1 skip esperado no comando geral, 13/13 cenarios RBAC no Emulator, lint, typecheck, build allowlisted e audit sem vulnerabilidades.

### File List Real

- `functions/finance-functions.js`
- `functions/index.js`
- `auth.js`
- `firebaseService.js`
- `company.html`
- `scripts/admin/admin-main.js`
- `financas.js`
- `financas.html`
- `commerce-pdf-share.js`
- `js/commerce-boleto-pix.js`
- `login.html`
- `compras.js`
- `compras.html`
- `vendas.js`
- `vendas.html`
- `database.rules.json`
- `database-utils.js`
- `package-lock.json`
- `sw.js`
- `tests/finance-transactions.test.mjs`
- `tests/subscription-readonly-expiry.test.mjs`
- `tests/company-logo-storage-policy.test.mjs`
- `tests/financas-relatorios-exportacoes.test.mjs`
- `tests/boleto-pix-lamina.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`
- `tests/auth-session-phase2.test.mjs`
- `tests/security-rbac-emulator.test.mjs`
- `tests/security-rbac-multitenant.test.mjs`
- `tests/company-profile-permissions.test.mjs`
- `tests/client-supplier-fiscal-fields.test.mjs`
- `tests/financas-contas-pagar-edit.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/tenant-operational-safe-modules.test.mjs`
- `docs/superpowers/specs/2026-07-18-financas-cabecalho-relatorios-multitenant-design.md`
- `docs/superpowers/specs/2026-07-18-financas-relatorios-origem-impressao-design.md`
- `docs/superpowers/plans/2026-07-18-financas-cabecalho-relatorios-multitenant.md`
- `docs/superpowers/plans/2026-07-18-financas-relatorios-origem-impressao.md`
- `docs/stories/2026-07-15-financas-integridade-seguranca-relatorios.md`

## QA Results

**Resultado:** PASS para rollout e tenant operacional principal, com ressalva apenas do segundo tenant descartavel.

- Suite completa, lint, typecheck, lint de Functions, build de Hosting e Emulator passaram.
- Preview e matriz responsiva passaram sem mutar dados reais.
- Revisao direta nao encontrou bloqueador de severidade critica apos corrigir XSS em filtros, validacao de edicao e estabilidade do fingerprint de retry.
- Functions, Hosting e Rules foram publicados na ordem controlada e verificados por HTTP, Emulator e navegador autenticado.
- A logo canonica e o cabecalho empresarial foram validados no relatorio financeiro live; a listagem ativa do prefixo do tenant ficou com um unico objeto.
- A impressao selecionada foi validada novamente no Hosting live: o carregamento nao permanece no documento, a tabela nao cria overflow horizontal e logo, cabecalho e totais aparecem no mesmo relatorio.
- A lamina PIX foi acionada em producao para uma conta a receber do tipo boleto e nao repetiu a mensagem de cadastro PIX incompleto.
- Os relatorios por origem e a nova acao Imprimir foram validados no Hosting live sem acionar salvamento, pagamento, recebimento ou exclusao.
- O gate final permanece aberto somente para isolamento funcional com um segundo tenant descartavel; nenhum dado financeiro real foi mutado no smoke de producao.
