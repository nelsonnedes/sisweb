# Cabecalho Multitenant dos Relatorios Financeiros Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restaurar e padronizar logo e dados da empresa em todas as saidas documentais do Financeiro, com isolamento estrito por tenant.

**Architecture:** O Financeiro consumira `getCompanyProfileForReport({ companyId })` e o componente existente `SiswebCommercePdf`. Um cache exclusivamente em memoria sera indexado por `financeSessionTenant`; a mesma empresa preparada alimentara previa, impressao, PDF e Lamina Pix.

**Tech Stack:** JavaScript browser, HTML/CSS, Firebase Auth/Realtime Database/Storage, jsPDF, Node test runner, Firebase Emulator e Firebase Hosting.

## Global Constraints

- Nao alterar dados financeiros reais durante testes ou smoke.
- Nao criar outro resolvedor de tenant ou outro motor de PDF.
- Nao persistir logo em Data URL no Realtime Database ou localStorage.
- Nao registrar credenciais, PII, payload financeiro ou URL tokenizada em logs.
- Reutilizar `financeSessionTenant`, `getCompanyProfileForReport()` e `commerce-pdf-share.js`.
- O aviso generico isolado do bootstrap permanece fora do escopo funcional desta entrega.

---

### Task 1: Contrato de regressao do cabecalho e tenant

**Files:**
- Modify: `tests/financas-relatorios-exportacoes.test.mjs`
- Modify: `tests/boleto-pix-lamina.test.mjs`

**Interfaces:**
- Consumes: fonte textual de `financas.js`, `financas.html` e `js/commerce-boleto-pix.js`.
- Produces: testes que exigem `getFinanceReportCompanyProfile`, `prepareFinanceReportCompany`, helper compartilhado e ausencia de `localStorage.companies` no fluxo de relatorio.

- [ ] **Step 1: Escrever testes inicialmente falhos**

```js
test('financeiro usa perfil central e cabecalho compartilhado em todas as saidas', () => {
  assert.match(html, /commerce-pdf-share\.js[^<]*<\/script>[\s\S]*financas\.js/);
  assert.match(source, /async function getFinanceReportCompanyProfile/);
  assert.match(source, /getCompanyProfileForReport\(\{ companyId: tenantId \}\)/);
  assert.match(source, /SiswebCommercePdf\.buildPrintHeader/);
  assert.match(source, /SiswebCommercePdf\.printHtmlDocument/);
  assert.match(source, /SiswebCommercePdf\.exportTableReportPdf/);
  assert.doesNotMatch(source, /localStorage\.getItem\('companies'\)/);
});
```

```js
it('Lamina Pix reutiliza empresa preparada pelo Financeiro', () => {
  const finance = read('financas.js');
  assert.match(finance, /const empresa = await prepareFinanceReportCompany\(\)/);
  assert.doesNotMatch(finance, /loadFromFirebase\(`companies\/\$\{currentCompanyId\}\/profile`\)/);
});
```

- [ ] **Step 2: Executar os testes e confirmar falha esperada**

Run: `node --test tests/financas-relatorios-exportacoes.test.mjs tests/boleto-pix-lamina.test.mjs`

Expected: FAIL porque o Financeiro ainda nao carrega `commerce-pdf-share.js` nem possui o resolvedor unico.

- [ ] **Step 3: Nao alterar runtime nesta tarefa**

Resultado revisavel: os testes descrevem o contrato antes da implementacao.

---

### Task 2: Perfil empresarial tenant-safe e asset compartilhado

**Files:**
- Modify: `financas.html`
- Modify: `financas.js`

**Interfaces:**
- Consumes: `financeSessionTenant`, `window.__siswebFirebaseServiceReady`, `firebaseService.getCompanyProfileForReport()` e `SiswebCommercePdf.resolveCompanyLogoDataUrl()`.
- Produces: `getFinanceReportCompanyProfile({ force?: boolean })`, `prepareFinanceReportCompany({ force?: boolean })` e `clearFinanceReportCompanyCache()`.

- [ ] **Step 1: Carregar o componente antes do runtime financeiro**

```html
<script src="commerce-pdf-share.js?v=2026-07-18-finance-report-header-v1"></script>
<script src="financas.js?v=2026-07-18-finance-report-header-v1"></script>
```

- [ ] **Step 2: Implementar o cache em memoria por tenant**

```js
let financeReportCompanyCache = null;

function clearFinanceReportCompanyCache() {
  financeReportCompanyCache = null;
}

async function getFinanceReportCompanyProfile(options = {}) {
  const tenantId = String(financeSessionTenant || '').trim();
  if (!tenantId) throw new Error('Tenant autenticado nao confirmado para o relatorio.');
  if (!options.force && financeReportCompanyCache && financeReportCompanyCache.tenantId === tenantId) {
    return financeReportCompanyCache.company;
  }
  if (window.__siswebFirebaseServiceReady) await window.__siswebFirebaseServiceReady;
  const service = window.firebaseService;
  if (!service || typeof service.getCompanyProfileForReport !== 'function') {
    throw new Error('Perfil empresarial indisponivel para o relatorio.');
  }
  const result = await service.getCompanyProfileForReport({ companyId: tenantId });
  const company = result && result.success !== false ? (result.data || result) : null;
  const returnedTenant = String((result && result.companyId) || (company && (company.companyId || company.tenantId || company.id)) || '').trim();
  if (!company || (returnedTenant && returnedTenant !== tenantId)) {
    throw new Error('Perfil empresarial divergente do tenant autenticado.');
  }
  financeReportCompanyCache = { tenantId, company: { ...company, companyId: tenantId, tenantId } };
  return financeReportCompanyCache.company;
}
```

- [ ] **Step 3: Preparar a logo somente em memoria**

```js
async function prepareFinanceReportCompany(options = {}) {
  const company = { ...(await getFinanceReportCompanyProfile(options)) };
  const helper = window.SiswebCommercePdf;
  if (helper && typeof helper.resolveCompanyLogoDataUrl === 'function') {
    const logo = await helper.resolveCompanyLogoDataUrl(company);
    if (logo) Object.assign(company, { logo, logoUrl: logo, logoDataUrl: logo });
  }
  return company;
}
```

- [ ] **Step 4: Limpar o cache junto da sessao privada**

Adicionar `clearFinanceReportCompanyCache();` dentro de `clearFinancePrivateSessionState()` e na deteccao de troca de tenant.

- [ ] **Step 5: Executar testes focados**

Run: `node --test tests/financas-relatorios-exportacoes.test.mjs`

Expected: os testes de asset, perfil e ausencia do fallback global passam; os testes das saidas ainda podem falhar.

---

### Task 3: Previa, impressao e PDF com um unico cabecalho

**Files:**
- Modify: `financas.html`
- Modify: `financas.js`
- Test: `tests/financas-relatorios-exportacoes.test.mjs`

**Interfaces:**
- Consumes: `prepareFinanceReportCompany()`, `renderFinanceReportModel(model)` e `window.SiswebCommercePdf`.
- Produces: `buildFinanceReportHeaderOptions(company, title, options)`, previa completa e impressoes compartilhadas.

- [ ] **Step 1: Criar opcoes canonicas do documento**

```js
function buildFinanceReportHeaderOptions(company, title, options = {}) {
  return {
    company,
    title,
    documentTitle: title,
    badgeText: 'Financeiro',
    subtitle: options.subtitle || '',
    metaRows: Array.isArray(options.metaRows) ? options.metaRows : []
  };
}
```

- [ ] **Step 2: Incluir o cabecalho na previa em tela**

Em `gerarRelatorio()`, preparar a empresa depois de confirmar o dataset, anexar `model.company` e renderizar:

```js
const company = await prepareFinanceReportCompany();
model.company = company;
const header = window.SiswebCommercePdf.buildPrintHeader(
  buildFinanceReportHeaderOptions(company, model.titulo, {
    subtitle: `${formatDate(model.dataInicio)} a ${formatDate(model.dataFim)}`
  })
);
contentElement.innerHTML = `${header}${renderFinanceReportModel(model)}`;
```

Adicionar em `financas.html` estilos responsivos para as classes `.sisweb-print-header`, `.sisweb-print-logo`, `.sisweb-print-company` e `.sisweb-print-meta`, sem alterar o layout dos demais modulos.

- [ ] **Step 3: Migrar `imprimirTabela()`**

Manter calculos e corpo atuais. Substituir o documento manual por:

```js
const company = await prepareFinanceReportCompany();
const helper = window.SiswebCommercePdf;
const printOptions = buildFinanceReportHeaderOptions(company, headerTitle, {
  subtitle: periodo,
  metaRows: [`${entityLabel}: ${entityValue}`]
});
const prepared = await helper.preparePrintOptions({ ...printOptions, bodyHtml, compact: items.length > 18 });
helper.printHtmlDocument(prepared);
```

- [ ] **Step 4: Migrar `imprimirHistoricoConta()`**

Reutilizar o mesmo fluxo do passo anterior, preservando o resumo e a timeline como `bodyHtml`.

- [ ] **Step 5: Gerar PDF real pelo helper compartilhado**

Mapear o modelo existente sem recalcular dados:

```js
await window.SiswebCommercePdf.exportTableReportPdf({
  ...buildFinanceReportHeaderOptions(model.company || await prepareFinanceReportCompany(), model.titulo, {
    subtitle: `${formatDate(model.dataInicio)} a ${formatDate(model.dataFim)}`
  }),
  fileName: `relatorio_${model.tipo}_${getTodayISODateLocal()}.pdf`,
  summaryRows: model.summaries.map((item) => ({
    label: item.label,
    value: formatFinanceReportValue(item.value, item.format)
  })),
  columns: model.columns.map((column) => ({
    label: column.label,
    key: column.key,
    align: column.format === 'currency' ? 'right' : 'left'
  })),
  rows: model.rows.map((row) => model.columns.map((column) => formatFinanceReportValue(row[column.key], column.format))),
  orientation: 'landscape'
});
```

Remover a abertura antecipada de `printWindow` e o template independente de `exportarPDF()`.

- [ ] **Step 6: Executar testes focados**

Run: `node --test tests/financas-relatorios-exportacoes.test.mjs tests/commerce-responsive-pwa.test.mjs`

Expected: PASS, incluindo cabecalho, HTML escapado, PDF compartilhado e responsividade.

---

### Task 4: Lamina Pix com o mesmo perfil e logo

**Files:**
- Modify: `financas.js`
- Modify: `js/commerce-boleto-pix.js`
- Test: `tests/boleto-pix-lamina.test.mjs`

**Interfaces:**
- Consumes: `prepareFinanceReportCompany()` e `empresa.logoDataUrl`.
- Produces: Lamina Pix sem leitura paralela de empresa e com imagem suportada pelo jsPDF.

- [ ] **Step 1: Remover o resolvedor paralelo em `abrirBoletoPixLamina()`**

```js
const empresa = await prepareFinanceReportCompany();
const validPix = window.PixBrCode.validateCompanyPix(empresa);
```

Remover os fallbacks de `window.companyInfo`, `localStorage.company_info` e leitura direta de `companies/{id}/profile` desse fluxo.

- [ ] **Step 2: Priorizar Data URL preparada no gerador**

```js
async function resolveCompanyLogo(company) {
  const logo = company.logoDataUrl || company.logoDataURL || company.logoUrl || company.logoURL || company.logo || '';
  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(String(logo))) return logo;
  return '';
}
```

- [ ] **Step 3: Executar teste da Lamina Pix**

Run: `node --test tests/boleto-pix-lamina.test.mjs`

Expected: PASS e nenhuma leitura paralela de perfil permanece.

---

### Task 5: Gates, PWA, deploy e smoke de isolamento

**Files:**
- Modify: `sw.js`
- Modify: `docs/stories/2026-07-15-financas-integridade-seguranca-relatorios.md`
- Verify: `hosting-files.json`

**Interfaces:**
- Consumes: implementacao e testes das tarefas anteriores.
- Produces: Hosting publicado e evidencias de isolamento sem mutacao.

- [ ] **Step 1: Atualizar versao do Service Worker**

```js
const APP_VERSION = '2026-07-18-finance-report-header-v1';
```

- [ ] **Step 2: Rodar gates locais**

Run:

```powershell
node --check financas.js
node --check js/commerce-boleto-pix.js
node --test tests/financas-relatorios-exportacoes.test.mjs tests/boleto-pix-lamina.test.mjs tests/commerce-responsive-pwa.test.mjs tests/security-rbac-multitenant.test.mjs
npm run lint
npm run typecheck
npm test
npm run build:hosting
```

Expected: todos os comandos passam, com eventual skip documentado apenas para dependencia externa indisponivel.

- [ ] **Step 3: Rodar isolamento no Emulator**

Run: `npm run test:security:emulator`

Expected: tenants A e B nao leem dados, perfil ou relatorio um do outro.

- [ ] **Step 4: Publicar somente Hosting**

Run: `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`

Expected: deploy concluido para `https://sisweb-7ce82.web.app`.

- [ ] **Step 5: Verificar artefatos publicados**

Run:

```powershell
Invoke-WebRequest 'https://sisweb-7ce82.web.app/financas.html' -UseBasicParsing
Invoke-WebRequest 'https://sisweb-7ce82.web.app/financas.js?v=2026-07-18-finance-report-header-v1' -UseBasicParsing
Invoke-WebRequest 'https://sisweb-7ce82.web.app/sw.js' -UseBasicParsing
```

Expected: HTTP 200 e versoes novas presentes no conteudo.

- [ ] **Step 6: Executar smoke autenticado somente leitura**

No Chrome, para cada tenant:

1. Fazer logout pelo botao do Sisweb.
2. Entrar com o usuario do tenant.
3. Abrir `financas.html` e confirmar `Modo Online`.
4. Gerar uma previa de cada tipo de relatorio sem salvar dados.
5. Abrir impressao de contas e historico existente, cancelando o dialogo.
6. Gerar o PDF local e verificar logo, empresa, titulo, periodo e paginacao.
7. Confirmar que nome, logo, contas e identificadores do outro tenant nao aparecem.

Expected: isolamento visual e de dados aprovado nos dois tenants, sem mutacao.

- [ ] **Step 7: Atualizar a story**

Registrar comandos, resultados, release do Hosting, smoke dos dois tenants, aviso residual de bootstrap e File List real. Marcar AC-03 e o trecho de cabecalho do AC-05 como concluidos somente depois do smoke.
