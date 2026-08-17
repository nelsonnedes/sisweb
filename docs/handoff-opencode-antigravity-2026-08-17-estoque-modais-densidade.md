# Handoff Antigravity → opencode (2026-08-17)

> **Contexto**: Continuidade e alinhamento mútuo entre Antigravity e opencode para evitar qualquer regressão em módulos compartilhados (`estoque.js`, `estoque.html`, `romaneio-manager.js`, `modules/core/romaneio-list-columns.js`, `romaneiopes.html`).

---

## 1. O que foi diagnosticado e resolvido nesta sessão

### A. Correção da Edição de Toras e Plaqueta Duplicada no Estoque (`estoque.js`)
1. **Falso Positivo em Toras com Status Baixado/Inativo**:
   - **Sintoma**: Ao editar uma tora no saldo de estoque (`estoque.html`) e manter ou definir uma plaqueta (exemplo: `"1DS10203"`), o sistema exibia um alerta afirmando que a plaqueta já existia, mesmo ela **não constando no saldo de estoque listado**.
   - **Causa Raiz**: A consulta de estoque (`#estoqueTable`) filtra estritamente `estoqueAtual.filter(t => t.status === 'disponivel')`. Porém, a função `encontrarToraPorPlaqueta(plaqueta, ignorarId)` fazia a busca em **todo** o histórico de toras da empresa (incluindo toras com `status: 'baixado'`, `'saida'`, `'consumido'`, `'serrado'` ou `'estornado'`). Quando uma plaqueta já havia passado por baixa no passado, ela não aparecia na tabela mas colidia na validação.
   - **Fix Aplicado**:
     - Criada a função `toraEstaAtivaNoEstoque(tora)` que valida se o status é `'disponivel'`, `'ativo'`, `'em_estoque'` ou `'pendente'`.
     - `encontrarToraPorPlaqueta()` agora ignora sumariamente qualquer registro com status inativo/baixado (`if (!toraEstaAtivaNoEstoque(tora)) return false;`) e ignora a própria tora em edição por `id`, `key`, `firebaseKey` e referência direta.
   - **Isolamento de Tenant**: Confirmado que o `FirebaseService` isola rigorosamente as toras sob `companies/${tenantId}/estoqueTorasAtual`. Não há mistura entre empresas.

2. **Integração do Submit com `atualizarToraEditada()`**:
   - `registrarEntrada(event)` agora delega imediatamente para `atualizarToraEditada()` quando `toraEmEdicao` está ativo, persistindo direto no nó `estoqueTorasAtual/${finalId}`.

---

### B. Otimização de Larguras de Colunas e Layout nas Tabelas de Estoque (`estoque.html`)
1. **Nova Classe `col.medida` (85px)**:
   - **Causa Raiz**: As colunas de dimensões de toras (`diametro`, `comprimento`, `oco1`, `oco2`, `desconto`, `compGeo`, `x1`, `x2`, `x3`, `x4`) usavam `.quantidade` (120px cada), inflando as tabelas para mais de 2300px e gerando rolagem horizontal excessiva.
   - **Fix**: Criada a classe `.table col.medida { width: 85px; }` e atualizados os `<colgroup>` das 4 tabelas de toras (`tabelaEntrada`, `tabelaSaidaToras`, `tabelaEstoque`, `tabelaTorasDisponiveis`), reduzindo a largura total em ~35%.
2. **Harmonização de Alinhamentos**:
   - Padronizado em `getEntradaColumnsDefs()` e demais tabelas: textos à esquerda, números/medidas ao centro, volumes e valores à direita.

---

### C. Responsividade dos Modais e Fixação Estática (Scroll do Backdrop Eliminado)
1. **Eliminação do Movimento Vertical do Modal ao Rolar o Mouse**:
   - **Sintoma**: Em `romaneiopes.html` e `romaneiotora.html`, ao posicionar o cursor sobre o modal "Lista de Romaneios" e girar o scroll do mouse, o modal inteiro se deslocava verticalmente na tela (para cima e para baixo), enquanto em `romaneiotl.html` e `romaneiopct.html` ele ficava perfeitamente estático.
   - **Causa Raiz**:
     - `romaneiopes.html` continha `#romaneioListModal { padding: 24px 12px; overflow-y: auto; }`.
     - `romaneio-manager.js` criava o modal com `overflow: auto;` inline.
     - A soma das dimensões do `.modal-content` com margens e padding ultrapassava `100vh`, criando uma barra de rolagem vertical oculta no container pai (overlay/backdrop).
   - **Fix Aplicado**:
     - Em `modules/core/romaneio-list-columns.js` (`injectStyles`), todos os overlays de modais (`#listaModal`, `#romaneioListModal`, `#clientListModal`, `#speciesListModal`, `#fornecedorListModal`, `div[id*="romaneioModal"]`) agora possuem:
       ```css
       position: fixed !important;
       top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
       width: 100% !important; height: 100% !important;
       overflow: hidden !important; /* Trava o scroll do backdrop */
       padding: 0 !important;
       margin: 0 !important;
       display: none;
       align-items: center !important;
       justify-content: center !important;
       ```
     - Em `romaneiopes.html`: `#romaneioListModal { padding: 0; overflow: hidden; }`.
     - Em `romaneio-manager.js`: `modal.style.cssText` com `overflow: hidden; align-items: center; justify-content: center;`.
     - O `.modal-content` possui `margin: 0 auto !important; height: calc(100vh - 48px) !important; max-height: 760px !important; min-height: 380px !important;`.
     - O scroll vertical ocorre **exclusivamente** na tabela interna (`.table-container, .table-responsive { overflow-y: auto !important; }`), mantendo o modal 100% fixo no centro da tela.

---

### D. Funcionamento Global do Seletor de "Densidade" (`modules/core/romaneio-list-columns.js`)
1. **Propagação Imediata**:
   - `setRowHeight(container, heightOption, pageKey)` agora aplica as classes (`rlc-density-compact`, `rlc-density-normal`, `rlc-density-comfortable`) diretamente em `document.body` e em todos os modais ativos.
   - Incluídas regras CSS para `body.rlc-density-compact`, `body.rlc-density-normal` e `body.rlc-density-comfortable`, garantindo que a troca no select reconfigure imediatamente o espaçamento das linhas e botões sem necessidade de recarregar a tela.

---

## 2. Arquivos Modificados nesta Sessão

| Arquivo | Principais Modificações |
| :--- | :--- |
| [`estoque.js`](file:///C:/Sisweb/estoque.js) | `toraEstaAtivaNoEstoque`, `encontrarToraPorPlaqueta` restrito a toras ativas, `getEntradaColumnsDefs` com alinhamentos canônicos. |
| [`estoque.html`](file:///C:/Sisweb/estoque.html) | CSS `.table col.medida { width: 85px; }`, calibração de larguras `.table col.*`, `<colgroup>` com `col.medida` em 4 tabelas de toras. |
| [`modules/core/romaneio-list-columns.js`](file:///C:/Sisweb/modules/core/romaneio-list-columns.js) | Overlay com `overflow: hidden !important; padding: 0 !important;`, `.modal-content` com `margin: 0 auto !important`, injeção global de classes de densidade no `document.body`. |
| [`romaneiopes.html`](file:///C:/Sisweb/romaneiopes.html) | Limpeza de `#romaneioListModal` (`padding: 0; overflow: hidden;`). |
| [`romaneio-manager.js`](file:///C:/Sisweb/romaneio-manager.js) | `modal.style.cssText` com `overflow: hidden;` e `modal.style.display = 'flex'`. |
| [`tests/estoque-edicao-tora.test.mjs`](file:///C:/Sisweb/tests/estoque-edicao-tora.test.mjs) | Suíte de testes unitários para o fluxo de plaqueta ativa vs baixada e edição de tora (**4/4 PASS**). |

---

## 3. Quality Gates e Validações Realizadas

- **Testes Unitários**: `tests/estoque-edicao-tora.test.mjs` (4/4 PASS).
- **Testes com Puppeteer**:
  - Teste de scroll em modais nas 5 telas (`romaneiopes.html`, `romaneiotora.html`, `romaneiotl.html`, `romaneiopct.html`, `preromaneio.html`): `modalScrollTop === 0` em todas as páginas.
  - Teste de troca de densidade (Compacta, Normal, Confortável) ativo.
- **Validação Pré-Merge (`npm run validate:pr`)**: **6/6 etapas APROVADAS (PASS)**.
- **Cachebusters Injetados**: `node tools/inject-cachebusters.mjs` atualizado nos 28 HTMLs.
- **Deploy em Produção**: Firebase Hosting (`https://sisweb-7ce82.web.app`).
- **Post-Deploy Security Check (`npm run security:postdeploy`)**: **37/37 checks aprovados**.
