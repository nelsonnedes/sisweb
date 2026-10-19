# Numeração Sequencial de Romaneios — Plano de Migração Segura

> **Status:** proposta de arquitetura e execução. Nenhuma alteração de código de produção foi feita.
> **Objetivo:** exibir e usar uma numeração de negócio `000142`, `000143` nos romaneios TL, PCT, PES, Tora e Pré-Romaneio (TL/PCT/PES/Tora), em listas, selects, impressões, financeiro, estoque e rastreabilidade, sem perder vínculos técnicos nem permitir duplicidade.

## 1. Decisão de arquitetura recomendada

**Não substituir `id`, `firebaseKey` ou `numero` técnico por `000142` na primeira fase.**

Manter chaves técnicas atuais (`TL_...`, `PCT_...`, `PES_...`, `TORA_...`) e criar uma identidade de negócio separada:

| Campo | Tipo | Papel |
|---|---|---|
| `id` / chave RTDB | string imutável | FK técnica, edição, exclusão, baixa, impressão e auditoria |
| `legacyId` | string | chave antiga preservada após qualquer migração |
| `numeroSequencial` | inteiro | número oficial de negócio |
| `numeroFormatado` | string 6 dígitos | `000142`; cache de exibição |
| `numeroExibicao` | inteiro (legado) | compatibilidade; exibido com padding |
| `numero` | string (legado) | permanece técnico nos tipos atuais; **nunca** vira FK |

**Escopo do contador (decisão inicial):** por tenant e por família/tipo:
`tl`, `pct`, `pes`, `tora`, `pre_tl`, `pre_pct`, `pre_pes`, `pre_tora`.
Isso preserva os números históricos já calculados por tipo e evita renumerar em massa. Se o negócio exigir número global único, será uma decisão explícita posterior (ver seção 8).

**Regra de ouro:** telas e documentos mostram `numeroFormatado`; vínculos, baixa e rastreio continuam resolvendo pelo `id` técnico. Campos de snapshot (`romaneioNumero`, `numeroRomaneio`, `origemNumero`) recebem o número formatado; `romaneioId`/`origemId` continuam técnicos.

## 2. Por que não trocar a chave persistida agora

A auditoria encontrou dependências críticas do ID técnico:

- baixa de estoque por `produto.romaneioId` (`vendas.js:3385-3405`, `js/estoque-madeira-serrada.js:585-607`);
- trava de reuso de romaneio em Vendas/Compras (`vendas.js:151-253`, `compras.js:652-759`);
- financeiro `origemId` e checagem estrita (`financas.js:4846-4863`, `:7496-7499`, modais de lista);
- rastreabilidade de toras/remessas e parser de IDs em labels (`estoque.js:5582-5591`, `:8935-8975`);
- impressão por ID, `data-print-id` e marcação `tl_print_done_<id>` (`modules/reports/imprimir-romaneio.js`);
- caches/tombstones locais e seleção por índice em Vendas/NF.

Substituir a chave sem reescrever todos esses pontos produz falha silenciosa de baixa e duplicidade. A fase 1 é **campo de negócio + exibição/backfill**; rekey é uma migração separada, opcional e com dual-read.

## 3. Pré-requisitos de isolamento (P0 — antes de qualquer migração)

Hoje uma cópia do repositório ainda aponta para produção:

- `firebase-init.js` tem `projectId`/`databaseURL`/`apiKey` de `sisweb-7ce82`.
- `.firebaserc` default `sisweb-7ce82`; `firebase.json` site `sisweb-7ce82`.
- `deploy.bat`, `deploy-forcado.ps1`, `package.json` (`deploy:hosting`) e `functions/package.json` não exigem `--project`.
- Scripts `scripts/migrar-numero-exibicao-romaneios.cjs` e migrações antigas usam `service-account.json` e URL de produção, alguns com caminho absoluto `c:/Sisweb/...`.
- `admin-wipe-db.js` remove `/` inteiro; `apply-firebase-rules.js` usa arquivos de rules não canônicos.

**Nenhum trabalho de dados começa antes de corrigir isso.**

### 3.1 Sandbox de código

```powershell
git fetch origin --prune
git worktree add .codex-worktrees/romaneios-renumber -b sandbox/romaneios-renumber origin/main
```

- Trabalhar somente nesse worktree/branch.
- `main` continua produção; hotfix nasce de `origin/main`, nunca da sandbox.
- Sincronizar com `git merge origin/main` (evitar rebase em branch compartilhada).
- Não copiar `service-account.json`, `.env`, `functions/.env`, `hosting-dist/` nem `node_modules/` de produção.

### 3.2 Sandbox de dados

**Fase A — emulador (loop diário):**
- adicionar bloco `emulators` em `firebase.sandbox.json` (database/auth/storage/functions/hosting, UI);
- usar `--project demo-sisweb-sandbox`;
- seed sanitizado por tenant, com IDs preservados e PII removida;
- app sandbox com `connectAuthEmulator`, `connectDatabaseEmulator`, `connectStorageEmulator`, `connectFunctionsEmulator` e CSP própria.

**Fase B — integração real:**
- projeto Firebase separado `sisweb-sandbox-<sufixo>` com Hosting, RTDB, Auth, Storage, Functions, secrets e bucket próprios;
- identidade Google sem IAM em `sisweb-7ce82`;
- deploy sempre com `--project sisweb-sandbox-... --config firebase.sandbox.json`.

**Fase C — produção:** apenas smoke read-only com backup e janela; tenant de teste em produção **não é sandbox**.

### 3.3 Guard fail-closed

Criar `scripts/assert-firebase-env.mjs` e chamar no `predeploy` e nos migradores:

- abortar se `SISWEB_ENV !== production` e project/site/URL contiver `sisweb-7ce82`;
- abortar se `SISWEB_ENV === sandbox` e project não começar com `sisweb-sandbox-`/`demo-`;
- exigir `--project`, `--tenant`, `--dry-run` (default) e `--apply` explícito;
- nunca aceitar credencial cujo `project_id` seja produção em sandbox.

### 3.4 Configuração por ambiente

Refatorar `firebase-init.js` (e cópias/unified service) para ler `window.__SISWEB_FIREBASE_CONFIG__` ou arquivo de build; fallback de produção apenas no build de produção. Adicionar teste de build que falha se o build sandbox contiver `sisweb-7ce82` ou se o build produção contiver `demo-`/localhost.

## 4. Sequência oficial no backend

### 4.1 Componente

Criar `functions/romaneio-functions.js` com função pura + callable:

```text
romaneio_reservarNumero({ operationId, tipo, recordId })
→ { numeroSequencial, numeroFormatado, operationId }
```

- Caminho: `companies/{tenant}/sequences/romaneios/{tipo}`.
- `tipo`: `tl|pct|pes|tora|pre_tl|pre_pct|pre_pes|pre_tora`.
- Transação Admin SDK: `current + 1`, `padStart(6,'0')`.
- Idempotência por `operationId` (formato `[A-Za-z0-9_-]{8,128}`), guardando `recordId`, `tipo`, `numero`, `current`, `completedAt`.
- Edição devolve o número existente; nunca consome novo.
- Clone recebe novo `operationId`/novo número.
- Exclusão não devolve número.
- Limite `999999`; acima disso abortar com erro claro (não truncar).
- Reutilizar o desenho/testes de `buildSequenceMutation` em `functions/finance-functions.js:1565-1615`, sem acoplar o financeiro.
- Autorizar tenant + membership + `adminActive`/assinatura, alinhado às rules de romaneios; falhar fechado se tenant ausente (nunca `__no_tenant__`).
- Exportar em `functions/index.js` ao lado das functions financeiras.

### 4.2 Seed e operação

- Migração calcula `max(numeroSequencial, numeroExibicao válido)` por tenant/tipo e grava `current` semeado.
- Reservar e salvar o registro; falha após reserva gera lacuna (aceitável) e nunca duplicidade.
- Monitorar lacunas/duplicatas e erros da callable.

## 5. Backfill de dados (sem rekey)

### 5.1 Mapeamento

Para cada tenant e tipo, ler os caminhos canônicos e aliases legados:
`companies/{tenant}/romaneios/{tipo}`, `romaneiosTl`, `romaneiosPct`, `romaneiosPes`, `romaneiosTora`, `companies/{tenant}/preromaneios`.

Deduplicar por `id`/`firebaseKey` antes de numerar. Ordenar deterministicamente por `dataEmissao || data || dataHora || timestamp || criadoEm || createdAt || chave`, com desempate pela chave.

Para cada registro:

```text
legacyId = chave real do nó
numeroSequencial = existente válido ou próximo do contador
numeroFormatado = padStart(6,'0')
numeroExibicao = numeroSequencial (compatibilidade)
id / numero / caminho = inalterados
```

Política:
- preservar números existentes únicos;
- resolver duplicatas de `numeroExibicao` de forma determinística (mais antigo mantém; demais recebem novo) e registrar relatório;
- registros sem número recebem o próximo;
- Pré-Romaneio ganha o campo pela primeira vez;
- não usar `numero` técnico (`TL_...`, `PCT_...`, `TORA-...`) como número de negócio;
- PES digitado é tratado como legado ambíguo: preservar `legacyId` e gerar número oficial.

### 5.2 Referências históricas

Fazer uma segunda passada **display-only** para atualizar snapshots visíveis, sem trocar IDs:

- Vendas: `itens[].romaneioNumero`, `pedido.romaneiosOrigem[].numero`, descrições de preview/trava.
- Compras: `romaneioNumero`, `romaneiosOrigem[].numero`, carregos/roteiros.
- Estoque serrado: `produtos.romaneioNumero`.
- Estoque de toras/rastreabilidade: `numeroRomaneio`, snapshots `romaneios[].numero`, descrições de `documento`.
- Finanças: `origemNumero`/`romaneioNumero` (novo campo de exibição), mantendo `origemId` técnico; atualizar rótulos sem alterar a checagem de duplicidade.
- Não reescrever `romaneioId`/`origemId`; adicionar resolução por número apenas para leitura/搜索, nunca para delete/baixa.

### 5.3 Segurança do migrador

- Dry-run default; `--apply` explícito.
- `--tenant`, `--tipo`, `--project`, `--database-url`, `--backup`.
- Lotes com checkpoint; nunca um único `update` do banco inteiro.
- Relatório: contagem, duplicatas, espelhos, inválidos, menor/maior, seed.
- Idempotência: segunda execução é no-op.
- Backup por subtree e mapa `path -> valor antigo`; restore ensaiado no emulador.
- Corrigir `scripts/migrar-numero-exibicao-romaneios.cjs` para não numerar espelhos duplicados e não usar credencial/URL de produção hardcoded.

## 6. Cliente e superfícies de exibição

### 6.1 Criação/edição

- Antes de salvar um **novo** romaneio, chamar `romaneio_reservarNumero` e gravar `numeroSequencial`/`numeroFormatado`; falha fecha o save.
- Edição não reserva; preserva.
- Clone limpa número e reserva novo.
- PES deixa de usar texto digitado como `id`; número oficial vem do backend.
- Backfill de registros antigos antes de ligar o cliente.

### 6.2 Listas e selects

Adicionar coluna “Nº” (6 dígitos) nos cinco modais e nos selects:

- TL: `modules/modals/modal-lista-romaneios.js`.
- PCT: `modules/romaneiopct/modal-lista-romaneios-pct.js`.
- PES: `romaneiopes.html`.
- Tora: `romaneiotora_modais.js`.
- Pré: `preromaneio-modals.js`.
- Vendas/Compras/Estoque/NF: `vendas.js`, `compras.js`, `estoque.js`, `js/estoque-madeira-serrada.js`, `nf-produtos-nf.js`.

Formatação central em `romaneio-table-enhancements.js`: `numeroFormatado` → `numeroSequencial` → `numeroExibicao` → legado (nunca ID bruto quando houver número). Busca/filtros devem aceitar número formatado e ID técnico.

Corrigir selects por índice em Vendas/NF para usar ID estável no `value` (ou recalcular índice imediatamente antes da seleção) — risco independente, mas agravado pela migração.

### 6.3 Impressões/PDF/Excel/CSV

- `modules/reports/imprimir-romaneio.js`: título, cabeçalho TL/Tora, `data-print-id`, busca.
- `modules/romaneiopct/imprimir-romaneio-pct.js`: título HTML, busca por `numero`, cabeçalho.
- `romaneiopes.html`: relatório/impressão PES.
- Excel Tora (`romaneiotora_modais.js`) e nomes de arquivo.
- Relatórios de estoque/financeiro.
- Tora: corrigir perda de `dataHora` no caminho de impressão (`imprimir-romaneio.js:386-391`).
- Cabeçalho deve mostrar `Nº 000142`; documentos históricos não são reimpressos automaticamente.

### 6.4 Vínculos e rastreio

- Manter `romaneioId`/`origemId` técnicos.
- Gravar número de negócio em `romaneioNumero`/`numeroRomaneio`/`origemNumero`.
- Financeiro: exibir número, mas localizar/reativar por ID; adicionar `origemNumero` e atualizar descrições sem trocar `origemId`.
- Estoque de toras: exibir número; parser de labels deve aceitar tanto IDs antigos quanto números de 6 dígitos; nunca inferir ID apenas do label quando houver campo.
- NF-e/MDF-e: adicionar referência explícita ao romaneio (`romaneioId` técnico + `romaneioNumero`) em campo próprio/infAdic, se desejado; não usar número como chave fiscal.

## 7. Testes e quality gates

### 7.1 Unitários/puros

- Sequência: primeiro `000001`, isolamento tenant/tipo, concorrência, idempotência, conflito de `operationId`, limite 999999, edição não consome, clone consome.
- Migração: objeto/array, espelhos, número ausente/`"Nº 4"`/duplicado/negativo, Tora só `dataHora`, PES digitado, ordenação, segunda execução no-op, seed, `legacyId`.
- Formatação: padding 6, fallback `numeroFormatado` → `numeroSequencial` → `numeroExibicao` → legado.
- Referências: todo `romaneioId`/`origemId` resolve; `romaneioNumero` exibe 6 dígitos; nenhum ID técnico alterado.

### 7.2 Emulador/rules

- `sequences` só Admin; cliente não escreve.
- membro ativo lê/usa; tenant A não vê contador de B.
- números imutáveis em update/edição; PES não permite sobrescrever número.
- backup/restore do subtree no emulador.

### 7.3 E2E

- Criar/editar/clonar/excluir cada tipo; sequence correta.
- Vendas: selecionar romaneio, trava de reuso, baixa/estorno de estoque; produto serrado; pedido com número.
- Compras: select, trava, carrego.
- Financeiro: lançar/reabrir/reativar; sem conta duplicada.
- Estoque toras/remessas/rastreabilidade.
- NF/MDF-e quando aplicável.
- Impressões TL/PCT/PES/Tora/Pré.
- Mobile 390 e desktop 1280.

### 7.4 Gates

```powershell
npm ci
npm run lint
npm run typecheck
npm test
npm --prefix functions run lint
npm run test:security:emulator
npm run validate:pr:full
npm run build:hosting
node tools/inject-cachebusters.mjs
npm run smoke:preview
```

Observação: lint/typecheck atuais cobrem apenas folha; adicionar `node --check`/ESLint direcionado para os arquivos de romaneio/vendas/estoque/functions alterados.

## 8. Fases, prioridades e entrega

### Fase 0 — Isolamento e baseline (P0)
1. Corrigir configuração Firebase por ambiente e guard de deploy.
2. Criar worktree/branch sandbox.
3. Configurar emuladores e seed sanitizado.
4. Backup/export por tenant e restore ensaiado.
5. Congelar escopo; nenhuma alteração funcional ainda.

### Fase 1 — Sequência e backfill (P0)
1. Implementar `functions/romaneio-functions.js` + testes puros.
2. Exportar/deploy da callable em sandbox.
3. Migrador dry-run/apply, relatório e checkpoint.
4. Backfill `legacyId`, `numeroSequencial`, `numeroFormatado`, `numeroExibicao`; seed contador.
5. Segunda execução no-op; validação de duplicatas.

### Fase 2 — Cliente e exibição (P1)
1. Integrar reserva em criação das 5 famílias.
2. Coluna Nº e selects.
3. Impressões/PDF/Excel/CSV.
4. Snapshots de Vendas/Compras/Estoque/Finanças.
5. Busca/ordenação/filtros; corrigir selects por índice.
6. Remover dependência de `numero` técnico como fallback de negócio.

### Fase 3 — Integração (P1)
1. Projeto Firebase sandbox; deploy real.
2. E2E completo e concorrência.
3. Ensaio de migração com cópia de produção sanitizada.
4. Smoke, monitoramento e rollback.
5. Aprovação final e PR/release para `main`.

### Fase 4 — Opcional: rekey físico (P2, não recomendado na primeira entrega)
Somente se o negócio exigir que a própria chave seja `000142`:

- criar mapa `romaneiosIndex/{tipo}/{legacyId}`;
- dual-read/dual-write temporário;
- reescrever todas as FKs listadas na auditoria (pedidos, produtos, finanças, estoque, rastreabilidade, tombstones, print flags);
- manter registros antigos até todos os leitores migrarem;
- executar em migração separada, com janela e rollback.

## 9. Riscos e mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| Duplicidade por `max+1` concorrente/cache truncado | Crítica | contador transacional no backend; nunca `max+1` no cliente |
| Rekey quebra baixa/trava/financeiro | Crítica | não rekeyar; alias/display-only; rekey só em fase separada |
| Sandbox escreve em produção | Crítica | config por ambiente + guard + identidade sem IAM de produção |
| `numero` técnico usado como FK | Alta | manter `id`; usar campos de número apenas para exibição |
| Migrador numera espelhos/duplicatas | Alta | dedupe por ID, dry-run, relatório, idempotência, lotes |
| Regras sem `.validate` | Alta | validar número/forma e imutabilidade; cliente não escreve sequence |
| Rastreabilidade regex 10+ dígitos | Alta | aceitar números de 6 dígitos e usar `romaneioId` explícito |
| Financeiro regex `^TL_`/`numero` | Alta | exibir `origemNumero`, manter checagem por `origemId` |
| Tora perde data/número na impressão | Média | corrigir mapeamento `dataHora`/número |
| PES usa número digitado como chave | Alta | separar ID técnico de número oficial |
| Cache `__no_tenant__` | Média | proibir contador/romaneio sem tenant |
| Restore de backup sem contador | Alta | incluir `sequences` no backup/restore e validar monotonicidade |
| Scripts destrutivos | Alta | exigir projeto sandbox + confirmação + `--apply`; quarentenar `admin-wipe-db.js` |
| Testes e2e apontam produção | Média | emulador/interceptação; `SISWEB_BASE_URL` explícito sandbox |

## 10. Critérios de aceite

- Criar cada tipo gera número único de 6 dígitos; edição preserva; clone gera novo; exclusão não reutiliza.
- Duas criações concorrentes no mesmo tipo/tenant recebem números distintos.
- Todos os registros existentes têm `legacyId` e `numeroSequencial` (ou justificativa documentada).
- Nenhum `id`, `numero` técnico, `romaneioId` ou `origemId` histórico foi alterado na fase 1.
- Listas/selects/impressões/PDF/Excel/CSV exibem `Nº 000142`; busca encontra por número e por ID técnico.
- Vendas/Compras/Estoque/Finanças/rastreabilidade continuam resolvendo e baixando corretamente.
- Migração idempotente, com relatório, backup e restore comprovado.
- Gates completos verdes; smoke nos 8 módulos críticos; sem regressão.
- Sandbox não contém credenciais de produção e build sandbox não aponta para `sisweb-7ce82`.

## 11. Melhorias recomendadas durante a auditoria

1. Centralizar configuração Firebase por ambiente (hoje hardcoded).
2. Substituir numeração `max+1` por contador transacional também para outros documentos.
3. Remover scripts destrutivos do fluxo normal (`admin-wipe-db.js`, `apply-firebase-rules.js`, `deploy-forcado.ps1`).
4. Adicionar `.validate`/imutabilidade de números e sequences nas rules.
5. Corrigir selects por índice em Vendas/NF para ID estável.
6. Soft delete e tombstones para romaneios numerados.
7. Incluir `sequences` no backup/restore e no healthcheck.
8. Adicionar vínculo fiscal explícito romaneio→NF-e/MDF-e (hoje só descrição).
9. Cobrir lint/typecheck dos módulos fora da folha; CI com emulador e build.
10. Documentar `numeroExibicao` como legado e `numeroSequencial` como fonte oficial.

## Anexo A — Evidência read-only do banco atual

Leitura via Admin SDK, sem escrita, de 4 tenants representativos:

| Tenant | TL | PCT | PES | Tora | Pré |
|---|---:|---:|---:|---:|---:|
| 1749492103278 | 16 registros; max 16; 1 número duplicado (espelhos `romaneios/tl` + `romaneiosTl`) | 129; max 134; sem duplicados | — | 15; max 15 | 16; nenhum número |
| 1774030248295 | 3; max 2; 1 duplicado (espelhos) | 1; max 1 | 1; max 1 | 3; max 3 | 1; sem número |
| 1784575486239338 | — | 2; max 2 | — | 1; max 1 | — |
| 1788618358968418 | 1; max 1 | 1; max 1 | 1; max 1 | 1; max 1 | — |

Conclusões que alteram o migrador:

- `numeroSequencial` e `legacyId` ainda não existem em nenhum registro (0/0).
- TL tem espelhos canônico + legado com o mesmo registro; **deduplicar por `id`/`firebaseKey` antes de numerar**, senão o mesmo romaneio recebe dois números.
- Já existem lacunas (PCT 129 registros, max 134); a migração preserva os números existentes e não tenta “fechar” lacunas.
- Pré-Romaneio não tem número em nenhum tenant; precisa de numeração própria por tipo.
- Números existentes são por tipo, sem prefixo; a UI deve mostrar o tipo junto do número (`TL · Nº 000142`) para eliminar ambiguidade entre tipos.
- Não foi feita migração nem escrita; os números acima são apenas diagnóstico.

## Anexo B — Especificação do script de migração

Arquivo previsto (na sandbox, não na main):

`scripts/romaneios-numeracao-migrate.cjs`

### Entrada e segurança

```powershell
# diagnóstico, padrão
node scripts/romaneios-numeracao-migrate.cjs --tenant 1749492103278 --report tmp/romaneios-dry-run.json

# aplicação explícita, com backup
node scripts/romaneios-numeracao-migrate.cjs --tenant 1749492103278 --apply --backup tmp/backup-romaneios.json --report tmp/romaneios-apply.json
```

Regras:

- `--tenant` obrigatório; nunca varrer `/companies` inteiro.
- `--dry-run` é o padrão; `--apply` obrigatório para escrever.
- `--backup` obrigatório em `--apply`; grava snapshot do subtree + checksum.
- Credencial via `GOOGLE_APPLICATION_CREDENTIALS`; URL via `FIREBASE_DATABASE_URL`; nunca `service-account.json` hardcoded.
- Guard: aborta se `SISWEB_ENV !== production` e a URL contiver `sisweb-7ce82`, ou se `SISWEB_ENV === sandbox` e URL/projeto não for sandbox/demo.
- Processa por tipo/lote; nunca um `update` no banco inteiro.
- Segunda execução deve ser no-op.

### Algoritmo

1. Ler `companies/{tenant}/romaneios/{tipo}`, aliases `romaneiosTl/Pct/Pes/Tora` e `preromaneios`.
2. Deduplicar espelhos por `id || firebaseKey || key` (preferir caminho canônico; manter `legacyId` do caminho real).
3. Ordenar por `dataEmissao || data || dataHora || timestamp || criadoEm || createdAt`, desempate por chave.
4. Para cada registro:
   - se `numeroSequencial` válido: preservar;
   - senão, se `numeroExibicao` válido e ainda não usado no tipo: adotar;
   - se duplicado: o mais antigo mantém; os demais recebem o próximo;
   - se ausente: receber o próximo;
   - gravar `numeroSequencial`, `numeroFormatado` (6 dígitos), `numeroExibicao` (inteiro, compatibilidade) e `legacyId`;
   - **não alterar** `id`, `numero` técnico, `firebaseKey`, caminhos ou vínculos.
5. Pré-Romaneio: derivar a família do campo `tipo` (TL/PCT/PES/TORA) e usar `pre_tl`, `pre_pct`, `pre_pes`, `pre_tora`; se ausente, registrar no relatório e não inventar.
6. Semear `companies/{tenant}/sequences/romaneios/{tipo}` com `current = max`, `last`, `updatedAt`, usando transação; nunca reduzir contador existente.
7. Relatório JSON/CSV: total, duplicados/mirros, números novos, números preservados, inválidos, seed, checksum, caminhos atualizados.
8. `--apply` em lotes com checkpoint; falha não reverte números já gravados (lacuna é aceitável), mas mostra o ponto exato para retomada.

### Fora do escopo do script na fase 1

- Não rekeyar `id`/chaves.
- Não reescrever `romaneioId`/`origemId`.
- Não apagar espelhos legados; apenas deduplicar no cálculo.
- Backfill de campos de snapshot (`romaneioNumero`, `numeroRomaneio`, `origemNumero`) será um passo separado, após a numeração estar validada.

## Anexo C — Matriz de exibição e vínculos (fase 2)

| Superfície | Arquivo/função | Mudança obrigatória |
|---|---|---|
| Formatação central | `romaneio-table-enhancements.js` (`formatarNumeroExibicao`) | 6 dígitos; fallback `numeroFormatado` → `numeroSequencial` → `numeroExibicao`; nunca ID bruto se houver número |
| Contratos de colunas | `modules/core/romaneio-list-columns.js` | nova coluna `Nº`; revisar índices/defaults e largura em TL/PCT/PES/Tora/Pré |
| Lista TL | `romaneiotl.html` + `modules/modals/modal-lista-romaneios.js` | coluna `Nº`, busca por número, ações por ID técnico |
| Lista PCT | `romaneiopct.html` + `modules/romaneiopct/modal-lista-romaneios-pct.js` | coluna `Nº`; filtro por `numeroSequencial`/formatado, não `numero` técnico |
| Lista PES | `romaneiopes.html` | coluna `Nº`; parar de usar índice nas ações; ID estável |
| Lista Tora | `romaneiotora_modais.js` | coluna `Nº`; Excel e nome do arquivo |
| Lista Pré | `preromaneio-modals.js` + `preromaneio.html` | coluna `Nº`; criar campo no payload |
| Select Vendas | `vendas.js` + `vendas.html` | label `TL · Nº 000142`; value = ID estável (não índice); dados de origem |
| Select Compras | `compras.js` + `compras.html` | label com tipo/número; value = ID |
| Estoque Serrado | `js/estoque-madeira-serrada.js` | rótulo do romaneio com tipo/número; `romaneioId` técnico |
| NF/Produtos fiscais | `nf-produtos-nf.js` | rótulo com tipo/número; value estável; manter ID fiscal separado |
| Impressão TL/Tora | `modules/reports/imprimir-romaneio.js` | título/cabeçalho com número; busca aceita ID e número; corrigir `dataHora` Tora |
| Impressão PCT | `modules/romaneiopct/imprimir-romaneio-pct.js` | título HTML e busca; exibir número |
| Impressão PES | `romaneiopes.html` | cabeçalho/total com número |
| Pré impressão | `preromaneio.js`/modais | número no cabeçalho e listas |
| Configuração de colunas | `romaneio-print-config.js` | coluna `Nº`; manter ids internos (`ml` etc.) intactos |
| Vendas/pedidos | `vendas.js` | gravar `romaneioNumero` formatado e `romaneioId` técnico; `romaneiosOrigem.numero` formatado |
| Compras/pedidos | `compras.js` | idem; carregos/roteiros exibem número |
| Estoque toras/rastreio | `estoque.js` | exibir número; parser aceita 6 dígitos; manter `romaneioId` |
| Financeiro | `financas.js`, modais TL/PCT | exibir `origemNumero`; continuar localizando/reativando por `origemId` |
| Estoque serrado/produtos | `vendas.js`, `js/estoque-madeira-serrada.js` | `romaneioId` técnico; `romaneioNumero` formatado |
| NF-e/MDF-e | `notas-fiscais.html`, `nf-produtos-nf.js` | se houver vínculo, usar `romaneioId` técnico + número de negócio em campo próprio |
| Busca/ordenação | `romaneio-table-enhancements.js`, `romaneio-manager.js` | ordenar por data; não extrair timestamp de ID sequencial; busca tolerante |

Regra de exibição: como o contador é por tipo, o rótulo deve incluir o tipo quando o contexto não for óbvio (`TL · Nº 000142`). Em listas específicas de um tipo, `Nº 000142` basta.
