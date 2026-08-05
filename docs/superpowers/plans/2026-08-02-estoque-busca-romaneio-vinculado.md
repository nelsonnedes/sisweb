# Estoque: Busca de Toras e Romaneio Vinculado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pesquisar toras por Plaqueta, Descrição/Espécie e Custódia em todas as listas do Estoque e exibir número, cliente/fornecedor e volume em Romaneio Vinculado.

**Architecture:** Manter toda a filtragem client-side sobre as coleções tenant-scoped já carregadas. Centralizar normalização e composição do texto pesquisável em helpers puros de `estoque.js`, reutilizando os normalizadores de romaneio existentes e preservando `observacoes` como fallback legado.

**Tech Stack:** HTML, JavaScript ES2020, Firebase Realtime Database já existente, Node Test Runner.

## Global Constraints

- Escopo limitado a `estoque.html` e `estoque.js`.
- Não criar endpoint, índice, Cloud Function, regra Firebase ou leitura por linha.
- Escapar todo conteúdo dinâmico renderizado.
- Preservar filtros, paginação, impressão e compatibilidade com registros legados.
- Publicar somente depois de todos os gates locais passarem.

---

### Task 1: Contrato de busca compartilhada

**Files:**
- Create: `tests/estoque-busca-romaneio-vinculado.test.mjs`
- Modify: `estoque.js`

**Interfaces:**
- Produces: `normalizarTextoBuscaEstoque(value): string`
- Produces: `obterTextoBuscaTora(item): string`
- Produces: `toraCorrespondeBusca(item, termo): boolean`

- [ ] **Step 1: Escrever teste estrutural inicialmente falho**

```js
assert.match(js, /function normalizarTextoBuscaEstoque/);
assert.match(js, /function obterTextoBuscaTora/);
assert.match(js, /normalizarCamposGeoEstoque\(item\)/);
assert.match(js, /item\.descricaoTora/);
```

- [ ] **Step 2: Confirmar falha**

Run: `node --test tests/estoque-busca-romaneio-vinculado.test.mjs`

Expected: FAIL porque os helpers ainda não existem.

- [ ] **Step 3: Implementar helpers mínimos**

```js
function normalizarTextoBuscaEstoque(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function obterTextoBuscaTora(item = {}) {
    const geo = normalizarCamposGeoEstoque(item);
    return normalizarTextoBuscaEstoque([
        item.plaqueta,
        item.descricao,
        item.descricaoTora,
        item.description,
        item.especie,
        geo.custodia,
        item.localizacao
    ].filter(Boolean).join(' '));
}

function toraCorrespondeBusca(item, termo) {
    const filtro = normalizarTextoBuscaEstoque(termo);
    return !filtro || obterTextoBuscaTora(item).includes(filtro);
}
```

- [ ] **Step 4: Confirmar teste verde**

Run: `node --test tests/estoque-busca-romaneio-vinculado.test.mjs`

Expected: PASS.

### Task 2: Aplicar busca nas listas de toras

**Files:**
- Modify: `estoque.html`
- Modify: `estoque.js`
- Test: `tests/estoque-busca-romaneio-vinculado.test.mjs`

**Interfaces:**
- Consumes: `toraCorrespondeBusca(item, termo)`
- Preserves: priorização exata por plaqueta em `obterCandidatosPlaquetaSaida`

- [ ] **Step 1: Adicionar testes de reutilização**

```js
assert.match(js, /function carregarTorasDisponiveis[\s\S]*toraCorrespondeBusca/);
assert.match(js, /function obterCandidatosPlaquetaSaida[\s\S]*toraCorrespondeBusca/);
assert.match(js, /function carregarTabelaEstoque[\s\S]*toraCorrespondeBusca/);
assert.match(html, /Plaqueta, descrição\/espécie ou custódia/);
```

- [ ] **Step 2: Aplicar helper aos três fluxos**

Substituir as comparações locais por `toraCorrespondeBusca`, mantendo rodo, comprimento, espécie dedicada, localização e ordenação existentes.

- [ ] **Step 3: Atualizar rótulos e mensagens**

```html
<label for="saidaPlaquetaBusca">Buscar tora:</label>
<input id="saidaPlaquetaBusca" placeholder="Plaqueta, descrição/espécie ou custódia">
```

Aplicar texto equivalente em Consulta e Baixa por Lote.

- [ ] **Step 4: Rodar teste focado e sintaxe**

Run: `node --check estoque.js && node --test tests/estoque-busca-romaneio-vinculado.test.mjs tests/estoque-exclusao-selecionados.test.mjs`

Expected: PASS.

### Task 3: Busca de Movimentações e Rastreabilidade

**Files:**
- Modify: `estoque.html`
- Modify: `estoque.js`
- Test: `tests/estoque-busca-romaneio-vinculado.test.mjs`

**Interfaces:**
- Produces: `obterTextoBuscaMovimentacao(mov): string`
- Adds: `filtro.buscaTora`
- Reuses: `registroRastreabilidadeTexto(reg)`

- [ ] **Step 1: Testar campo e integração**

```js
assert.match(html, /id="filtroBuscaToraMov"/);
assert.match(js, /buscaTora: document\.getElementById\('filtroBuscaToraMov'\)/);
assert.match(js, /obterTextoBuscaMovimentacao\(m\)\.includes\(buscaTora\)/);
assert.match(js, /registroRastreabilidadeTexto\(reg\)/);
```

- [ ] **Step 2: Implementar busca de movimentação**

O texto agrega a própria movimentação, `normalizarCamposGeoEstoque(mov)` e os dados de `mov.romaneiosRelacionados`. O filtro é aplicado antes da ordenação e incluído na cache key de resumo.

- [ ] **Step 3: Ampliar rastreabilidade**

O campo `rastFiltroPlaqueta` recebe o rótulo **Buscar tora** e compara o termo com `registroRastreabilidadeTexto(reg)`, que passa a conter Plaqueta, Descrição/Espécie e Custódia.

- [ ] **Step 4: Validar filtros e limpeza**

Run: `node --test tests/estoque-busca-romaneio-vinculado.test.mjs`

Expected: PASS para leitura, aplicação, limpeza e chave de cache do novo filtro.

### Task 4: Romaneio Vinculado detalhado

**Files:**
- Modify: `estoque.html`
- Modify: `estoque.js`
- Test: `tests/estoque-busca-romaneio-vinculado.test.mjs`

**Interfaces:**
- Produces: `formatarRomaneiosVinculadosMovimentacao(mov, options): string`
- Reuses: `normalizarRomaneiosRastreabilidade`
- Fallback: `mov.observacoes`

- [ ] **Step 1: Escrever teste do formato e fallback**

```js
assert.match(js, /function formatarRomaneiosVinculadosMovimentacao/);
assert.match(js, /normalizarRomaneiosRastreabilidade\(mov\.romaneiosRelacionados/);
assert.match(js, /Romaneio \$\{numero\}/);
assert.match(js, /mov\.observacoes/);
assert.match(js, /formatNumber\(volume, 3\)/);
```

- [ ] **Step 2: Implementar saída HTML e texto**

Para cada vínculo, renderizar `Romaneio <número> - <cliente/fornecedor> - <volume> m³` em linha própria. Com `options.plain`, retornar somente texto para busca e impressão; sem vínculos estruturados, retornar observações legadas.

- [ ] **Step 3: Integrar a coluna**

Trocar o valor da chave `observacoes` em `obterValorCelulaMovimentacao` pelo formatador, mantendo `escapeHtml` dentro do helper e `title` textual no `td`.

- [ ] **Step 4: Rodar regressão focada**

Run: `node --check estoque.js && node --test tests/estoque-busca-romaneio-vinculado.test.mjs tests/estoque-exclusao-selecionados.test.mjs`

Expected: PASS.

### Task 5: Smoke, gates e publicação controlada

**Files:**
- Modify: `docs/stories/2026-08-02-estoque-exclusao-permanente-selecionados.md`
- Modify: `docs/superpowers/plans/2026-07-22-recuperacao-freebuff-producao.md`

**Interfaces:**
- Consumes: módulo Estoque concluído e testes verdes.
- Produces: Hosting atualizado e smoke online documentado.

- [ ] **Step 1: Smoke local autenticado**

Validar Busca em Consulta, Baixa Individual, Baixa por Lote, Movimentações e Rastreabilidade com o tenant de teste. Confirmar Romaneio Vinculado e ausência de erros de console.

- [ ] **Step 2: Rodar gates completos**

Run:

```powershell
npm test
npm run lint
npm run typecheck
npm run build:hosting
git diff --check
```

Expected: todos os comandos com exit code 0.

- [ ] **Step 3: Publicar Hosting**

Run: `firebase deploy --only hosting --project sisweb-7ce82`

Expected: deploy concluído para `https://sisweb-7ce82.web.app`.

- [ ] **Step 4: Smoke online**

Repetir as cinco buscas e verificar a coluna Romaneio Vinculado no tenant de teste.

- [ ] **Step 5: Retomar plano inicial**

Atualizar stories/checklists e avançar para a próxima pendência P0 ainda não concluída.

