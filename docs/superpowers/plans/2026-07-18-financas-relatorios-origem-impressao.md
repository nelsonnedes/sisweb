# Finance Reports Origin and Printing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuario gere relatorios separados de contas a receber ou contas a pagar e imprima o modelo confirmado com o cabecalho empresarial padrao.

**Architecture:** O seletor de origem passa a compor o contrato de `getFinanceReportRange` e direciona carregamento, calculo, rotulos e ranking. Tela, impressao e PDF continuam consumindo uma unica instancia de `FinanceReportModel`; a impressao reutiliza `SiswebCommercePdf.preparePrintOptions` e `printHtmlDocument`, sem criar outro calculo financeiro.

**Tech Stack:** HTML/CSS responsivo, JavaScript browser, Firebase Realtime Database tenant-scoped, helper `commerce-pdf-share.js`, Node.js test runner, Firebase Hosting.

## Global Constraints

- Valores internos de origem: `receber` e `pagar`.
- Acoes da aba Relatorios: `Gerar Relatorio`, `Imprimir` e `PDF`.
- CSV continua apenas nas tabelas operacionais; nao aparece na barra de Relatorios.
- Nenhuma escrita financeira, alteracao de Rules ou deploy de Functions faz parte desta entrega.
- Alterar origem, tipo ou periodo invalida o modelo anterior.
- Todo valor dinamico de HTML passa por `escapeFinanceHtml`.
- O worktree contem alteracoes anteriores validas; nao reverter nem incluir arquivos alheios em commit.

---

### Task 1: Fixar o contrato da interface e da origem com testes

**Files:**
- Modify: `tests/financas-relatorios-exportacoes.test.mjs`
- Modify: `financas.html:1459-1492`
- Modify: `financas.js:7050-7470`

**Interfaces:**
- Consumes: HTML da aba `#relatorios` e fonte textual de `financas.js`.
- Produces: testes para `#relContaOrigem`, opcoes adaptativas, assinatura com origem, ausencia do CSV e presenca de `imprimirRelatorioAtual`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar assercoes equivalentes a:

```js
assert.match(html, /id="relContaOrigem"/);
assert.match(html, /value="receber"[\s\S]*Contas a Receber/);
assert.match(html, /value="pagar"[\s\S]*Contas a Pagar/);
assert.doesNotMatch(html, /id="financeReportCsvBtn"/);
assert.match(html, /id="financeReportPrintBtn"[\s\S]*imprimirRelatorioAtual\(\)/);
assert.match(source, /signature: `\$\{origem\}\|\$\{tipo\}\|\$\{dataInicio\}\|\$\{dataFim\}`/);
assert.match(source, /\['relContaOrigem', 'tipoRelatorio', 'relDataInicio', 'relDataFim'\]/);
```

- [ ] **Step 2: Executar o teste e confirmar falha**

Run: `node --test tests/financas-relatorios-exportacoes.test.mjs`

Expected: FAIL porque o seletor e o botao Imprimir ainda nao existem.

- [ ] **Step 3: Preservar os testes de CSV das tabelas**

Manter a cobertura de `sanitizeFinanceCsvCell`, `downloadFinanceCsv` e `exportarTabelaExcel`, alterando somente a assercao que exigia CSV na barra de Relatorios.

- [ ] **Step 4: Conferir o diff do teste**

Run: `git diff --check -- tests/financas-relatorios-exportacoes.test.mjs`

Expected: nenhum erro de whitespace.

### Task 2: Adicionar origem e tipos adaptativos

**Files:**
- Modify: `financas.html:1459-1492`
- Modify: `financas.js:2332-2338`
- Modify: `financas.js:7050-7428`

**Interfaces:**
- Consumes: `loadFinanceReportMonthsStrict(tipo, months)`, `loadAllFinanceReportPartitionsStrict(tipo)` e arrays `contasReceber`/`contasPagar`.
- Produces: `FINANCE_REPORT_TYPE_OPTIONS`, `syncFinanceReportTypeOptions()`, range `{ origem, tipo, dataInicio, dataFim, signature }` e modelos filtrados por origem.

- [ ] **Step 1: Implementar controles HTML**

Inserir antes de Tipo de Relatorio:

```html
<div class="form-group">
    <label for="relContaOrigem">Origem das Contas:</label>
    <select id="relContaOrigem">
        <option value="receber">Contas a Receber</option>
        <option value="pagar">Contas a Pagar</option>
    </select>
</div>
```

- [ ] **Step 2: Criar o mapa de tipos compativeis**

Usar o contrato:

```js
const FINANCE_REPORT_TYPE_OPTIONS = Object.freeze({
    receber: Object.freeze([
        { value: 'inadimplencia', label: 'Inadimplência' },
        { value: 'faturamento', label: 'Faturamento por Período' },
        { value: 'categorias', label: 'Análise por Categorias' },
        { value: 'clientes', label: 'Ranking de Clientes' }
    ]),
    pagar: Object.freeze([
        { value: 'inadimplencia', label: 'Inadimplência' },
        { value: 'pagamentos', label: 'Pagamentos por Período' },
        { value: 'categorias', label: 'Análise por Categorias' },
        { value: 'fornecedores', label: 'Ranking de Fornecedores' }
    ])
});
```

`syncFinanceReportTypeOptions()` deve construir `option` por DOM, preservar o valor atual quando compativel e selecionar a primeira opcao nos demais casos.

- [ ] **Step 3: Incluir origem no range e na invalidacao**

`getFinanceReportRange()` valida a origem e retorna:

```js
return {
    origem,
    tipo,
    dataInicio,
    dataFim,
    signature: `${origem}|${tipo}|${dataInicio}|${dataFim}`
};
```

Vincular `relContaOrigem` ao mesmo fluxo de invalidacao e executar a sincronizacao dos tipos quando a origem mudar.

- [ ] **Step 4: Direcionar o carregamento estrito**

`ensureFinanceReportScope({ origem, tipo, dataInicio, dataFim })` carrega todas as particoes da origem para `faturamento` ou `pagamentos`; para os demais tipos, carrega somente os meses do periodo da origem escolhida.

- [ ] **Step 5: Filtrar todos os modelos pela origem**

`buildFinanceReportModel(range)` deve definir `model.origem`, `model.origemLabel` e usar apenas o array correspondente. Inadimplencia, categorias e ranking nao combinam mais os dois arrays. O ramo de movimentacao aceita `faturamento` e `pagamentos`, adapta Cliente/Fornecedor, Data do recebimento/pagamento, Valor recebido/pago e os resumos.

- [ ] **Step 6: Exibir a origem na previa**

Acrescentar ao inicio de `renderFinanceReportModel(model)`:

```html
<div class="finance-report-period">
    <strong>Origem:</strong> ${escapeFinanceHtml(model.origemLabel)}
    <span aria-hidden="true">|</span>
    <strong>Período:</strong> ...
</div>
```

- [ ] **Step 7: Executar testes focados**

Run: `node --test tests/financas-relatorios-exportacoes.test.mjs`

Expected: testes do seletor, assinatura e modelos por origem aprovados; teste de Imprimir ainda pode falhar ate a Task 3.

### Task 3: Substituir CSV por impressao do modelo atual

**Files:**
- Modify: `financas.html:1482-1491`
- Modify: `financas.js:7429-7528`
- Test: `tests/financas-relatorios-exportacoes.test.mjs`

**Interfaces:**
- Consumes: `getCurrentFinanceReportModel`, `prepareFinanceReportCompany`, `buildFinanceReportHeaderOptions`, `getFinanceReportDocumentHelper` e `SiswebCommercePdf.printHtmlDocument`.
- Produces: `buildFinanceReportPrintBody(model)` e `imprimirRelatorioAtual()`.

- [ ] **Step 1: Trocar o botao CSV**

Usar:

```html
<button id="financeReportPrintBtn" type="button" class="btn btn-secondary" onclick="imprimirRelatorioAtual()" title="Imprimir relatório">
    <i class="fas fa-print"></i> Imprimir
</button>
```

- [ ] **Step 2: Testar o contrato da impressao**

Asserir que a funcao abre `window.open('', '_blank')` antes de `await getCurrentFinanceReportModel`, fecha o documento temporario, chama `preparePrintOptions` e entrega `targetWindow` a `printHtmlDocument`.

- [ ] **Step 3: Construir corpo seguro de impressao**

`buildFinanceReportPrintBody(model)` monta origem, periodo, resumos e tabela a partir de `model.columns`, `model.rows` e `model.summaries`, aplicando `escapeFinanceHtml(formatFinanceReportValue(...))` em todas as celulas.

- [ ] **Step 4: Implementar a acao de imprimir**

`imprimirRelatorioAtual()` deve:

1. abrir a janela e renderizar o estado `Preparando seu relatorio`;
2. fechar o documento temporario;
3. ativar `setFinanceReportBusy(true)`;
4. obter o modelo atual confirmado;
5. preparar empresa/cabecalho e corpo;
6. chamar `helper.printHtmlDocument({ ...prepared, targetWindow: win, printDelay: 300 })`;
7. em erro, substituir a janela por uma mensagem segura e notificar a pagina principal;
8. liberar o estado busy no `finally`.

- [ ] **Step 5: Manter PDF no mesmo modelo**

Incluir `model.origem` no nome do arquivo e `model.origemLabel` no subtitulo, sem recalcular linhas ou totais.

- [ ] **Step 6: Executar testes focados**

Run: `node --test tests/financas-relatorios-exportacoes.test.mjs`

Expected: PASS.

### Task 4: Responsividade, cache e regressao

**Files:**
- Modify: `financas.html`
- Modify: `sw.js:1`
- Modify: `tests/pwa-install-icon.test.mjs`
- Modify: `tests/pwa-mobile-menu-session.test.mjs`
- Modify: `tests/qa-visual-pwa-routes.test.mjs`
- Modify: `tests/tenant-operational-safe-modules.test.mjs`

**Interfaces:**
- Consumes: `.report-criteria-grid`, `.report-actions` e cachebusters atuais.
- Produces: grade 4/2/1, versao unica dos assets e testes de cache atualizados.

- [ ] **Step 1: Ajustar a grade responsiva**

Desktop usa quatro criterios; `max-width: 768px` usa duas colunas e `max-width: 480px` usa uma coluna. A barra de acoes preserva tres botoes sem overflow.

- [ ] **Step 2: Elevar a versao dos assets**

Atualizar `APP_VERSION` e os cachebusters de `financas.js`/helpers para um identificador unico desta entrega.

- [ ] **Step 3: Atualizar testes de versao**

Substituir somente as expectativas do cache antigo nos quatro arquivos listados.

- [ ] **Step 4: Executar pacote focado**

Run:

```powershell
node --test tests/financas-relatorios-exportacoes.test.mjs tests/pwa-install-icon.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/tenant-operational-safe-modules.test.mjs
```

Expected: todos aprovados.

### Task 5: Gates, documentacao, deploy e smoke

**Files:**
- Modify: `docs/stories/2026-07-15-financas-integridade-seguranca-relatorios.md`

**Interfaces:**
- Consumes: implementacao aprovada e evidencias dos comandos.
- Produces: story atualizada, Hosting publicado e smoke autenticado sem mutacoes.

- [ ] **Step 1: Executar gates completos**

Run:

```powershell
npm run lint
npm run typecheck
npm test
npm run build:hosting
npm run build --if-present
```

Expected: lint/typecheck/build aprovados, zero testes falhos e apenas skips ja documentados.

- [ ] **Step 2: Atualizar a story**

Registrar seletor de origem, tipos adaptativos, remocao do CSV da barra, impressao compartilhada, testes, File List e ausencia de mutacao financeira.

- [ ] **Step 3: Validar o deploy sem publicar**

Run: `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive --dry-run`

Expected: somente Hosting selecionado e validado.

- [ ] **Step 4: Publicar Hosting**

Run: `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`

Expected: release completa em `https://sisweb-7ce82.web.app`.

- [ ] **Step 5: Executar smoke autenticado**

No Financeiro live, validar:

1. Receber + Inadimplencia;
2. Receber + Faturamento;
3. Pagar + Inadimplencia;
4. Pagar + Pagamentos;
5. troca de origem invalida o resultado;
6. Imprimir abre documento unico com logo, origem, periodo, resumos e tabela;
7. PDF continua disponivel;
8. console sem novo erro bloqueante;
9. nenhuma acao de salvar, pagar, receber ou excluir e acionada.

- [ ] **Step 6: Conferir diff final**

Run: `git diff --check -- financas.html financas.js sw.js tests/financas-relatorios-exportacoes.test.mjs tests/pwa-install-icon.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/qa-visual-pwa-routes.test.mjs tests/tenant-operational-safe-modules.test.mjs docs/stories/2026-07-15-financas-integridade-seguranca-relatorios.md`

Expected: nenhum erro; avisos de conversao LF/CRLF podem permanecer sem alterar conteudo.
