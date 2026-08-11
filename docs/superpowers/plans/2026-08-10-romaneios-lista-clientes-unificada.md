# Lista de Clientes dos Romaneios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Padronizar a Lista de Clientes de Romaneio PES e Pré-romaneio pelo contrato visual e funcional já usado em Romaneio PCT.

**Architecture:** O PCT permanece como referência de experiência: seis colunas, ações selecionar/editar/excluir, filtro e paginação. PES e Pré-romaneio apenas adaptam sua renderização e markup a esse contrato; leituras e escritas continuam usando os serviços de clientes e os caminhos tenant-scoped existentes.

**Tech Stack:** HTML, CSS, JavaScript global existente, Font Awesome local e testes Node.

## Global Constraints

- Não alterar paths Firebase, regras, payloads nem permissões de clientes.
- Não interpolar dados do cliente em `innerHTML`; usar `textContent` para os valores dinâmicos.
- Dados ausentes devem usar `Não informado`, nunca `N/A`.
- Ações devem manter seleção, edição e exclusão pelos handlers já existentes.
- Validar em desktop e mobile antes de publicar Hosting.

---

### Task 1: Contrato visual e dados do modal PES

**Files:**
- Modify: `romaneiopes.html`
- Test: `tests/romaneios-client-list-standard.test.mjs`

**Interfaces:**
- Consumes: `clients`, `selectClientFromList(clientId)`, `editClientFromList(clientId)`, `deleteClientFromList(clientId)`.
- Produces: `renderClientListModal()` com seis células por linha e ações seguras.

- [ ] **Step 1: Escrever o teste estrutural que exige seis colunas, fallback legível e três ações.**

```js
assert.match(pes, /const clientValue = .*Não informado/);
assert.match(pes, /selectButton/);
assert.match(pes, /editButton/);
assert.match(pes, /deleteButton/);
```

- [ ] **Step 2: Executar o teste e confirmar falha antes da alteração.**

Run: `node --test tests/romaneios-client-list-standard.test.mjs`

Expected: FAIL porque PES ainda renderiza valores por `innerHTML` com `N/A`.

- [ ] **Step 3: Renderizar células com `document.createElement` e `textContent`.**

```js
const clientValue = (...values) => values.find(value => String(value || '').trim()) || 'Não informado';
const appendCell = (value) => {
  const cell = document.createElement('td');
  cell.textContent = value;
  row.appendChild(cell);
};
```

- [ ] **Step 4: Criar os botões Selecionar, Editar e Excluir com listeners, título e `aria-label`.**

```js
selectButton.onclick = () => selectClientFromList(client.id);
editButton.onclick = () => editClientFromList(client.id);
deleteButton.onclick = () => deleteClientFromList(client.id);
```

- [ ] **Step 5: Executar o teste focado.**

Run: `node --test tests/romaneios-client-list-standard.test.mjs`

Expected: PASS.

### Task 2: Markup e renderização do Pré-romaneio

**Files:**
- Modify: `preromaneio.html`
- Modify: arquivo JavaScript proprietário do modal de clientes do Pré-romaneio, identificado pelo carregamento da página
- Test: `tests/romaneios-client-list-standard.test.mjs`

**Interfaces:**
- Consumes: `openClientListModal`, `filterClientList`, `closeClientListModal` e o provedor atual de clientes.
- Produces: tabela com Nome, Cidade, Estado, Telefone, E-mail e Ações.

- [ ] **Step 1: Escrever asserções para o cabeçalho de seis colunas e `colspan=6`.**

```js
for (const label of ['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'Ações']) {
  assert.match(pre, new RegExp(`<th[^>]*>${label}</th>`));
}
assert.match(pre, /colspan="6"/);
```

- [ ] **Step 2: Atualizar o markup do modal para seis colunas e a largura de Ações do padrão PCT.**

```html
<th style="width: 120px; text-align: center;">Ações</th>
```

- [ ] **Step 3: Alinhar o renderizador do Pré-romaneio ao mesmo contrato seguro de PES.**

```js
valueCell.textContent = resolveClientDisplayValue(client, ['cidade', 'city']);
```

- [ ] **Step 4: Executar os testes focados.**

Run: `node --test tests/romaneios-client-list-standard.test.mjs`

Expected: PASS.

### Task 3: Verificação e publicação

**Files:**
- Modify: `docs/stories/2026-08-02-romaneiotora-consolidacao-stack-ui.md`

**Interfaces:**
- Consumes: Hosting build e as três páginas de romaneio.
- Produces: evidência de smoke e checklist atualizado.

- [ ] **Step 1: Rodar verificações estáticas e os testes de regressão dos romaneios.**

Run: `node --check romaneiopes.html; node --check preromaneio.html; node --test tests/romaneios-client-list-standard.test.mjs tests/romaneiotora-active-stack.test.mjs`

Expected: comandos válidos e todos os testes aprovados.

- [ ] **Step 2: Fazer smoke autenticado local em PCT, PES e Pré-romaneio.**

Confirmar: filtro, seis colunas, ausência de `N/A`, selecionar, editar, excluir e layout em viewport mobile.

- [ ] **Step 3: Atualizar a story com evidências reais.**

```markdown
- [x] Smoke da Lista de Clientes concluído em PCT, PES e Pré-romaneio.
```

- [ ] **Step 4: Rodar gates e build de Hosting.**

Run: `npm run lint; npm run typecheck; npm test; npm run build:hosting`

Expected: todos aprovados e distribuição pronta.

- [ ] **Step 5: Commit e deploy de Hosting; repetir smoke publicado.**

Run: `firebase deploy --only hosting --project sisweb-7ce82`

Expected: Hosting concluído e as três listas exibindo o contrato unificado.
