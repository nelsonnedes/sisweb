# Design — Redimensionamento de colunas com persistência (Listas de Clientes e Fornecedores)

**Data:** 2026-08-11
**Status:** aprovado pelo usuário (design); aguardando revisão do spec
**Contexto:** modal "Lista de Clientes" de `preromaneio.html`, `romaneiotl.html`, `romaneiopct.html` e `romaneiopes.html` e modal "Lista de Fornecedores" de `romaneiotora.html`

## Problema

1. As células das tabelas dos modais são truncadas com reticências (`print-styles.css:541-547`: `.modal table td { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; }`). O usuário não tem como revelar o dado completo.
2. No `romaneiopes.html` a coluna Ações ainda diverge do contrato PCT: `romaneiopes.html:923-924` força `width: 40px !important; min-width: 40px !important; max-width: 40px !important;` na última coluna e percentuais fixos `!important` nas demais (`913-922`), sobrepondo o cabeçalho `width: 120px` do contrato.
3. Não existe nenhum mecanismo de redimensionamento de coluna nas 5 páginas.

## Objetivo

Permitir que o usuário ajuste as larguras das colunas das listas de clientes (4 páginas) e de fornecedores (romaneiotora) arrastando a borda dos cabeçalhos, com persistência por usuário + tenant no banco Firebase, seguindo a convenção já existente em `estoque.js`/`folha-relatorios.js`.

## Decisões acordadas

- **Escopo:** as 4 listas de clientes + a Lista de Fornecedores do `romaneiotora.html`.
- **Persistência:** por usuário + tenant → `users/{uid}/preferences/...` (RBAC já permite: `database.rules.json:255-257`, write do próprio usuário em `users/$uid/preferences`).
- **Chaves:** uma chave por página (clientes) + uma chave para fornecedores.

## Arquitetura

### Módulo único `modules/core/client-list-columns.js`

- IIFE com zero globais além de `window.ClientListColumns`.
- Carregado por tag `<script src="modules/core/client-list-columns.js?v=...">` em todas as 5 páginas.
- Nenhum renderizador existente é alterado (preromaneio-modals.js, modal-clientes.js, modal-clientes-pct.js, bloco inline do PES, fornecedor-modals.js).
- O módulo observa o DOM (MutationObserver) e aplica larguras + instala handles de drag nos `<th>` quando o modal/tabela existe, cobrindo tanto os modais estáticos quanto o modal dinâmico do PES.

### Chaves de persistência

| Alvo | Chave Firebase (relativa a `users/{uid}/preferences/`) | Chave localStorage |
|---|---|---|
| Lista de Clientes PCT | `clientListColumns/{tenant}/pct` | `sisweb_clientListColumns_{tenant}_{uid}_pct` |
| Lista de Clientes TL | `clientListColumns/{tenant}/tl` | `sisweb_clientListColumns_{tenant}_{uid}_tl` |
| Lista de Clientes PES | `clientListColumns/{tenant}/pes` | `sisweb_clientListColumns_{tenant}_{uid}_pes` |
| Lista de Clientes Pré-romaneio | `clientListColumns/{tenant}/preromaneio` | `sisweb_clientListColumns_{tenant}_{uid}_preromaneio` |
| Lista de Fornecedores (romaneiotora) | `fornecedorListColumns/{tenant}` | `sisweb_fornecedorListColumns_{tenant}_{uid}` |

- Resolução de `uid` e `tenant` segue `estoque.js:2279-2294` (`window.firebaseAuthUser` → `authService.getAuth().currentUser` → localStorage; tenant via `getTenantId`/`appTenantId`/`company_info`). Fallback `'anon'`/`'default'`.
- Escrita: sempre grava localStorage (espelho); grava Firebase via `window.saveData` quando `uid !== 'anon'` e `saveData` existe, com debounce ~400ms.
- Leitura: localStorage primeiro; se ausente e usuário real, `window.getData(path)` e grava espelho local.

### Formato dos dados

```json
{ "Nome": 180, "Cidade": 120, "Estado": 80, "Telefone": 140, "Email": 200, "Ações": 120 }
```

- Valores em pixels (inteiros), sanitizados com clamp entre 60px e 400px.
- Ações: mínimo 120px (clientes) / 150px (fornecedores, respeitando o inline atual `romaneiotora.html:1474-1480`).
- Chaves desconhecidas são descartadas na sanitização; largura salva só se aplica se existir `<th>` correspondente (por índice na ordem do contrato).

### Mecânica do drag

- Handle de 8px no lado direito de cada `<th>`, criado via CSS (pseudo-elemento/div com `cursor: col-resize`).
- Eventos: `pointerdown` → `setPointerCapture`; `pointermove` atualiza `width` do `<th>` em tempo real (e demais células da coluna via `colgroup`? Não — aplica no `<th>` + `<td>` com `nth-child`, ou via `table-layout: fixed`); `pointerup` finaliza e agenda gravação debounced.
- Durante o drag a tabela recebe `table-layout: fixed` para que as larguras dos `<th>` sejam respeitadas.
- `title` do `<th>` mostra a largura atual em px durante o drag.
- Touch funciona via pointer events; sem drag não há alteração — larguras salvas continuam aplicadas.

### Correção da divergência PES

- Remover `romaneiopes.html:913-924` (regras de largura fixa `!important` do `#clientListModal`).
- As regras de `#speciesListModal` (`romaneiopes.html:926-931`) permanecem intactas.
- O cabeçalho do modal do PES já declara `Ações` com `width: 120px` (`romaneiopes.html:2999`) — passa a ser o padrão mínimo.

### Truncamento

- Mantido por design (nowrap + ellipsis): o usuário revela o dado alargando a coluna. Nenhuma mudança em `print-styles.css`.

## Tratamento de erros

- Sem `uid`/`tenant`: usa `'anon'`/`'default'` e funciona somente com localStorage (igual estoque).
- Falha de `saveData`/`getData`: registra no console e segue com localStorage.
- Tabela não encontrada: o módulo não faz nada (guarda defensiva).

## Testes

- `tests/client-list-columns-resize.test.mjs` (estrutural):
  - módulo exporta `window.ClientListColumns` com `apply`/`attach`/`getWidths`/`save`/`buildPath`;
  - path builders geram as 5 chaves corretas;
  - sanitização: clamp 60–400, descarta chaves desconhecidas, Ações ≥ 120/150;
  - debounce de gravação;
  - as 5 páginas carregam `client-list-columns.js`;
  - `romaneiopes.html` não contém mais a regra `40px !important` do `#clientListModal`;
  - suites existentes de romaneios continuam passando.

## Gates

- `node --check` (módulo + páginas com inline validado);
- `npm run lint`; `npm run typecheck`; `npm test`;
- `npm run build:hosting`;
- `git diff --check`.

## Fora de escopo

- Redimensionamento em outras tabelas (romaneio principal, espécies, impressão).
- Reordenação de colunas ou mostrar/ocultar colunas.
- Alteração de paths/regras/payloads de clientes.
- Tooltip `title` com valor completo das células (pode ser follow-up).
