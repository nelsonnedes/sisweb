# Recuperacao do trabalho Freebuff e estabilizacao da producao

> **Estado:** plano de retomada. Nenhuma etapa deste documento autoriza deploy automatico ou alteracao de dados reais.

**Objetivo:** recuperar com rastreabilidade o codigo que ja esta em producao, eliminar as regressões encontradas e retomar a evolucao do Sisweb sem sobrescrever o Hosting, as Rules ou as Functions com uma branch mais antiga.

**Principio de execucao:** primeiro preservar e reproduzir; depois corrigir por dominio; publicar Functions antes dos consumidores de frontend; validar com dados descartaveis e dois tenants; somente entao integrar no Git.

**Fontes de verdade auditadas em 22/07/2026:** branch `codex/finance-boleto-pix-company-storage`, worktree `C:\Sisweb\.freebuff\worktrees\thmruq8rsbcanv`, Hosting `sisweb-7ce82.web.app`, Realtime Database Rules publicadas, lista de Functions Gen 2 e stories ativas.

**Smoke de producao:** os resultados do tenant de testes estao em `docs/superpowers/plans/2026-07-22-smoke-producao-tenant-teste.md`.

---

## Diagnostico consolidado

### Implementado e publicado, mas ainda nao consolidado no Git remoto

- O Hosting publicado coincide, em 33 de 33 arquivos alterados auditados, com `hosting-dist` do worktree Freebuff nao commitado.
- As Rules publicadas coincidem com `database.rules.json` nao commitado do Freebuff.
- As sete Functions financeiras foram atualizadas depois da ultima edicao local de `functions/finance-functions.js`; a origem exata nao pode ser comparada por hash por falta de leitura do ZIP de build.
- Foram publicados `firebase-init.js`, `firebase-compat-bridge.js`, a migracao de paginas para o bootstrap compartilhado e novos cachebusters.
- Foram publicados ajustes de `dataEmissao`, juros contratuais, estados de carregamento e recuperacao da localizacao de contas financeiras.

### Preservar, mas revalidar antes de integrar

- `functions/finance-functions.js`: busca ampliada de conta/pagamento, idempotencia e tratamento de transacoes.
- `financas.js` e `financas.html`: data de emissao, juros, impressao selecionada, CSV e estados de carregamento.
- `firebase-init.js` e `firebase-compat-bridge.js`: bootstrap singleton e compatibilidade com telas legadas.
- `database.rules.json`: bloqueio de gravacoes financeiras diretas e aliases de claims/perfis.
- `tools/inject-cachebusters.mjs` e `hosting-files.json`: suporte aos imports estaticos e inclusao dos novos artefatos.
- Migracao das paginas para o bootstrap compartilhado, que deve ser aceita em ondas e nao como alteracao unica de 62 arquivos.

### Regressoes confirmadas

- `compras.js` tenta atualizar pedido e `financas/pagar` por `updatePaths` na raiz. As Rules atuais negam a operacao; o rollback preserva o pedido anterior e evita persistencia parcial.
- O smoke de Venda aprovada criou uma unica conta a receber e manteve idempotencia no segundo salvamento. Preservar esse comportamento; corrigir apenas `dataEmissao`, vencimento e o fallback que ainda pode confirmar sem financeiro em cenarios de falha.
- Financeiro le zero registros no navegador porque as Rules exigem papel no membro da empresa, enquanto as Functions reconhecem tambem `/roles/{uid}`.
- `financeNextSequence` nao inicializa o contador quando a transacao recebe `null` e retorna erro de confirmacao autoritativa.
- `company.html` acessa `firebaseService.authService` antes do bootstrap e nao identifica empresa/tenant.
- Folha escuta o alias `folhas`, mas o modelo e as Rules usam `folha`; a UI ainda informa `Online` quando as leituras falham.
- Especies e Romaneios legados perdem a sessao ou tentam login anonimo, incompativel com o isolamento multi-tenant.
- Novo fornecedor foi salvo na chave literal `fornecedores/undefined`, sem ID funcional; Clientes e Fornecedores tambem nao atualizam a tabela apos salvar/editar.
- Cinco testes de transacao financeira falham em localizacao recuperada, recalculo de juros, idempotencia e validacao de anexo.
- A exportacao CSV nao preserva corretamente `totalAtualizado` e `statusNorm` em todos os caminhos.
- A impressao de itens selecionados perdeu parte do contrato visual verificado pelos testes.
- O healthcheck do bootstrap Firebase informa sucesso sem detectar corretamente paginas que importam apenas o bridge.
- Lint e typecheck atuais cobrem quase somente Folha de Pagamento e nao validam os arquivos alterados.
- O teste geral tem 35 falhas: parte e expectativa antiga de cachebuster; parte representa regressao funcional real.

### Nao integrar

- Alteracao do nome do projeto em `package-lock.json` para `thmruq8rsbcanv`.
- Bancos, metadados e arquivos internos de `.freebuff/`.
- Logs de navegador com dados operacionais ou identificadores de tenant.
- Capturas de diagnostico que nao forem sanitizadas e vinculadas a uma evidencia necessaria.
- Scripts de migracao/auditoria sem teste, documentacao e revisao de escopo.

### Pendencias de produto que continuam validas

- Smoke de isolamento com segundo tenant, incluindo tenant expirado em modo leitura.
- Conclusao gradual da Fase 3 de Auth/tenant/performance.
- NF-e em homologacao com A1: emissao, CC-e e inutilizacao.
- A3 fisico: ponte local homologada continua sendo dependencia externa.

---

## Fase 0 - Congelar e preservar o estado publicado

**Prioridade:** P0. Executar antes de qualquer nova correcao.

1. Suspender deploys manuais a partir da branch principal atual.
2. Preservar o worktree Freebuff sem limpeza ou reset.
3. Criar uma branch de recuperacao a partir de `freebuff/new-thread-thmruq8rsbcanv`.
4. Registrar separadamente:
   - commits Freebuff ainda locais;
   - diff nao commitado que corresponde ao Hosting/Rules;
   - artefatos que nao devem entrar no repositorio.
5. Gerar manifesto SHA-256 dos arquivos de Hosting local e publicado.
6. Exportar as Rules publicadas para evidencia e comparar de forma normalizada.
7. Registrar revisoes, datas e runtime das sete Functions financeiras.

**Verificacao:**

```powershell
git status --short --branch
git log --oneline --decorate --all -20
git diff --check
firebase database:get /.settings/rules --project sisweb-7ce82
gcloud functions list --v2 --project=sisweb-7ce82 --regions=us-central1
```

**Gate:** nenhuma fonte publicada pode depender somente de arquivo nao rastreado antes de avancar.

---

## Fase 1 - Corrigir autorizacao e transacoes financeiras

**Prioridade:** P0. Esta e a primeira correcao funcional porque desbloqueia leitura, criacao e baixa.

**Arquivos principais:**

- `functions/finance-functions.js`
- `functions/index.js`
- `database.rules.json`
- `tests/finance-transactions.test.mjs`
- novos testes de RBAC e isolamento em `tests/`

### Comportamento exigido

- O mesmo papel deve produzir a mesma decisao em Rules e Functions.
- Usuario administrativo/financeiro do tenant le somente o Financeiro da propria empresa.
- Erro de permissao deve ser exibido como erro operacional, nunca como lista vazia ou modo offline.
- Sequencias devem inicializar, incrementar e repetir operacao de forma idempotente.
- Um tenant nunca pode localizar ou alterar pedido/conta de outro tenant.

### Implementacao

1. Escrever testes que reproduzam o membro sem `role` local e com `/roles/{uid}=admin`.
2. Definir a fonte canonica de RBAC e uma migracao idempotente de membros/owner.
3. Alinhar Rules e `assertFinanceAccess` sem permitir leitura cross-tenant.
4. Corrigir `financeNextSequence` para inicializar contador inexistente e confirmar a operacao.
5. Diferenciar `permission_denied`, offline real e lista vazia no frontend.
6. Validar criar, editar, pagar, estornar e mover conta entre meses.

**Gate:** testes de integridade passam no Emulator Suite e Financeiro deixa de zerar registros existentes.

---

## Fase 2 - Corrigir Compras x Financeiro e preservar Vendas

**Prioridade:** P0.

**Status (2026-08-05):** concluida e validada.

- Itens 1-5: callable tenant-scoped `financeSyncCompra` implementada em `functions/finance-functions.js` (reutiliza `runAuthorized`, `assertFinanceAccess`, `normalizeDate`, `dateToMonthKey`, `moneyToCents`, `normalizeMonth`, `normalizePathSegment`, `normalizeNullableText`, `normalizeStatus`, `MAX_CREATE_ACCOUNTS`); `compras.js` migrou para a callable (monta `contasRemover` + `contasCriar` canonicos, chamada via `callFunction`, rollback preservado quando o financeiro falha); escrita direta de `financas/pagar` removida do fluxo de salvar.
- Item 6: em `vendas.js` — `dataEmissao` agora e string ISO (`pedidoDataISO`, linha ~5665; nunca elemento DOM); vencimento informado nao e substituido silenciosamente (`vencimento || pedidoDataISO`); fallback de salvamento lança erro quando o financeiro obrigatorio nao sincronizou (pedido nao e confirmado).
- Item 7: cenarios restaurados e cobertos por testes (baixa fora do mes rejeitada, recalculo de juros no servidor, edicao idempotente, juros invalidos rejeitados, anexo invalido rejeitado) — 33/33 em `tests/finance-transactions.test.mjs`; suíte completa 359 pass / 0 fail / 1 skip.
- Item 9: validado no browser (emulador local) — edicao de item agrupado com desagrupar, update in-place em Compras, criacao de conta a receber respeitando vencimento informado, sem erros JS.

**Nota de deploy:** `financeSyncCompra` (Functions) precisa ser publicada junto com as Functions em producao. Enquanto a callable nao estiver publicada, o cliente detecta o erro de endpoint indisponivel (`code: internal/not-found/unavailable`), cai no **modo legado de escrita direta** (`updatePaths` com `pedidosCompra` + `financas/pagar/{mes}/{id}`) e segue funcional — validado no browser. Para qualquer outro erro (regra/validacao, ex.: `permission-denied`), o rollback e mantido e nada e gravado.

1. Escrever teste de pedido de compra aprovado que reproduza a negacao atual.
2. Definir callable tenant-scoped para orquestrar pedido e conta a pagar no servidor.
3. Reutilizar validadores, permissoes e localizadores existentes nas Functions financeiras.
4. Remover escrita direta de `financas/pagar` pelo navegador.
5. Preservar o rollback comprovado quando o financeiro falha.
6. Em Vendas, preservar a idempotencia validada e corrigir:
   - `dataEmissao` deve ser string ISO, nao elemento DOM;
   - vencimento informado nao pode ser substituido silenciosamente;
   - fallback nao pode confirmar pedido quando o financeiro obrigatorio falha.
7. Restaurar os cenarios de transacao quebrados:
   - pagamento recuperado em outro mes;
   - recalculo de juros;
   - edicao idempotente no mesmo mes;
   - rejeicao de juros invalidos;
   - rejeicao de anexo invalido.
8. Formalizar a regra de negocio:
   - tabela: juros contratuais entre emissao e vencimento;
   - baixa: juros/multa por atraso, sem dupla cobranca.
9. Validar criacao, edicao, exclusao, parcelamento e repeticao de pedidos.

**Comandos:**

```powershell
node --test tests/finance-transactions.test.mjs
npm run test:finance-whitelist
```

**Gate:** compra aprovada cria conta uma unica vez; falha nao salva parcial; Vendas continua idempotente.

---

## Fase 3 - Restaurar exportacoes e impressoes financeiras

**Prioridade:** P1.

**Status (2026-08-08):** concluida e validada.

- CSV usa `statusNorm`/`totalAtualizado` normalizados exibidos na tela (financas.js); 22/22 em `tests/financas-relatorios-exportacoes.test.mjs`.
- Impressao selecionada restaurada com A4, tabela de dez colunas e cabecalho empresarial; 57/57 focados aprovados conforme registro da story `2026-07-15-financas-integridade-seguranca-relatorios.md`.
- Juros e callers: 17/17 em `tests/financas-juros-callers.test.mjs`.

1. Corrigir CSV para usar os valores normalizados exibidos na tela.
2. Restaurar o contrato de classes/colunas da impressao selecionada sem acoplar teste a detalhes irrelevantes.
3. Validar A4 retrato e paisagem, quebra de pagina, cabecalho, logo, totais e rodape.
4. Testar com e sem logo, com URL tokenizada e com caminho canonico do Storage.
5. Cobrir Contas a Pagar e Contas a Receber, relatorio completo e selecao parcial.

**Comandos:**

```powershell
node --test tests/financas-relatorios-exportacoes.test.mjs
node --test tests/financas-juros-callers.test.mjs
```

**Gate:** screenshot desktop/mobile e PDF nao apresentam sobreposicao ou conteudo de loading.

---

## Fase 4 - Validar o bootstrap Firebase antes da migracao ampla

**Prioridade:** P1.

**Status (2026-08-08):** concluida e validada.

- Healthcheck corrigido (`tools/healthcheck-firebase-sdk.mjs --ci`): cachebuster, scan recursivo, anon/initApp; hoje 27/27 paginas com Firebase no bootstrap unico, 0 CDN direto, 0 `initializeApp` nas paginas, 0 `signInAnonymously`, status `SAUDÁVEL` (commits `9e2a2fb`, `378f304`).
- `folha.html` (subpasta) migrada ao singleton; as 27 paginas publicadas consomem `firebase-init.js` + `firebase-compat-bridge.js`.
- Migracao por ondas concluida sem big-bang (empresa/romaneios/folha por ultimo conforme registro da story de Auth).

**Arquivos principais:**

- `firebase-init.js`
- `firebase-compat-bridge.js`
- `tools/healthcheck-firebase-sdk.mjs`
- `tests/firebase-init.test.mjs`
- paginas migradas listadas no diff Freebuff

1. Corrigir o healthcheck para reconhecer imports diretos de `firebase-init.js` e imports laterais do bridge.
2. Fazer o comando falhar quando uma pagina Firebase nao tiver bootstrap valido.
3. Testar contrato do bridge: snapshot, `key`, `ref`, listeners, `off`, ServerValue, Auth, callable e Storage.
4. Integrar a migracao em ondas conforme a story de Auth:
   - Financeiro/Login;
   - Vendas/Compras;
   - Clientes/Fornecedores/Estoque/NF-e;
   - Empresa/Romaneios/Folha/Admin.
5. Em cada onda, medir inicializacoes, leituras repetidas, listeners e tempo de navegacao.
6. Remover apenas os scripts legados comprovadamente substituidos.

**Gate:** cada onda passa testes e smoke antes da seguinte; nao aceitar o diff inteiro de 62 arquivos de uma vez.

### Execucao controlada em 02/08/2026 - Romaneio de Tora

- `romaneiotora_modais.js` deixou de ser carregado pela pagina depois de comprovada a substituicao por modulos canonicos de fornecedor, especies, lista e impressao.
- O arquivo legado foi preservado para rollback e continua coberto pelas stories historicas.
- As funcoes de item passaram a ter um unico proprietario ativo em `romaneiotora_tabela.js`.
- O lote permanece local ate concluir smoke visual desktop/mobile descrito em `docs/stories/2026-08-02-romaneiotora-consolidacao-stack-ui.md`.

### Execucao controlada em 02/08/2026 - Estoque

- A exclusao permanente selecionada foi adicionada a Baixa Individual e ao modal de Baixa por Lote.
- Exclusao e auditoria usam a mesma atualizacao multipath tenant-scoped; o estado local so muda depois do sucesso remoto.
- Itens manuais e toras ja carregadas na baixa ficam fora da selecao destrutiva do modal.
- A exclusao individual agora reutiliza o mesmo fluxo em lote.
- Os smokes de exclusao, auditoria, busca e fallback legado foram concluidos no tenant de teste.
- A busca de toras foi unificada em Consulta, Baixa Individual, Baixa por Lote, Movimentacoes e Rastreabilidade.
- O Hosting foi publicado em 02/08/2026 depois de 349 testes aprovados, lint, typecheck, build e `git diff --check`.

---

## Fase 5 - Tornar os gates de qualidade confiaveis

**Prioridade:** P1.

**Status (2026-08-08):** concluida e validada.

- Suite completa: 377 aprovados / 0 falhas / 1 skip esperado (`npm test`), incl. `tests/sentry-monitor.test.mjs` (4), `tests/sentry-admin-monitor.test.mjs` (6), finance 33/33, relatorios 22/22, juros 17/17.
- Lint (`npm run lint`), typecheck (`npm run typecheck`) e `git diff --check` sem erros; healthcheck sem falso positivo.

1. Atualizar testes que fixam cachebusters antigos para consultar o manifesto ou verificar semantica.
2. Manter testes funcionais independentes da versao textual do asset.
3. Expandir lint e typecheck para os JS principais e Functions.
4. Corrigir o espaco final em `romaneiotora_versao_dev.html`.
5. Executar o conjunto completo e classificar qualquer skip.

**Comandos:**

```powershell
npm run lint
npm run typecheck
npm test
npm run test:finance-whitelist
node tools/healthcheck-firebase-sdk.mjs --ci
git diff --check
```

**Gate:** zero falhas e healthcheck sem falso positivo.

---

## Fase 6 - Auth, tenant e performance

**Prioridade:** P1/P2.

1. Finalizar a Fase 3 da story `2026-07-14-auth-navigation-performance-ux.md`.
2. Deduplicar promises e aplicar TTL somente onde a consistencia permitir.
3. Cancelar listeners ao sair de cada modulo.
4. Eliminar recargas repetidas de dados vistas nos logs.
5. Unificar Login, Cadastro e Recuperacao; corrigir `Fale Conosco`.
6. Executar matriz com tenant ativo, tenant expirado em leitura e segundo tenant descartavel.

**Gate:** logout invalida a sessao, navegacao nao reconecta repetidamente e nenhum dado cruza tenants.

---

## Fase 7 - Fila fiscal remanescente

**Prioridade:** P2, depois da estabilizacao financeira.

1. Emitir uma NF-e em homologacao com certificado A1 e dados descartaveis.
2. Validar CC-e e inutilizacao.
3. Registrar evidencias e remover dados de teste conforme a politica fiscal.
4. Manter A3 fisico como iniciativa separada da ponte local homologada.

---

## Estrategia de deploy

Para cada fase publicavel:

1. Testes locais e emuladores.
2. Revisao do diff e CodeRabbit.
3. Deploy de Functions novas/compatíveis.
4. Smoke das Functions sem alterar registros reais.
5. Deploy de Hosting consumidor.
6. Deploy de Rules somente quando necessario e nunca para relaxar o isolamento.
7. Smoke com tenant ativo e tenant de leitura.
8. Monitorar logs e manter rollback da revisao anterior.

```powershell
firebase deploy --only functions:<nomes> --project sisweb-7ce82
firebase deploy --only hosting --project sisweb-7ce82
firebase deploy --only database --project sisweb-7ce82
```

Os comandos acima sao referencia de ordem; os alvos exatos devem ser definidos por fase. Nao executar `firebase deploy` sem `--only` durante a recuperacao.

---

## Ordem recomendada de retomada

1. Fase 0: preservar a fonte publicada e criar branch de recuperacao.
2. Fase 1: alinhar RBAC/Rules e corrigir sequencias financeiras.
3. Fase 2: corrigir Compras x Financeiro e preservar Vendas.
4. Fase 3: corrigir CSV e impressoes.
5. Fases 4 e 5: integrar bootstrap em ondas e restaurar gates confiaveis.
6. Fase 6: concluir Auth/tenant/performance e segundo tenant.
7. Fase 7: concluir smoke fiscal A1.

**Status (2026-08-08):** Fases 0 a 5 concluidas e validadas no branch `codex/recovery-p0-freebuff-regressions` (377/377 testes, healthcheck saudavel, Sentry instrumentado e publicado). Em andamento: Fase 6 (Auth/tenant/performance).

## Criterio de conclusao

- O Git remoto contem exatamente o codigo publicado e revisado.
- Hosting, Rules e Functions podem ser reconstruidos a partir do repositorio.
- Testes completos passam sem falso positivo.
- Pedidos e financeiro sao atomicos, idempotentes e isolados por tenant.
- Relatorios, PDFs e impressoes mantem logo e cabecalho padronizados.
- Stories ativas possuem status, checklist, evidencias e file list atualizados.
