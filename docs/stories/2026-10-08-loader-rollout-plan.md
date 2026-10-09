# Plano — Rollout do loader padrão + auditoria "save lento" (08/10/2026)

> Status: EM EXECUÇÃO (E0+E1+E2 entregues em `loader-e2`; restante pendente de OK).
> - [x] E0 (helper + trava, commit `loader-e0e1`).
> - [x] E1 (div vendas, mesmo commit).
> - [x] E2 (compras stub→helper + `listarPedidos` em finally, commit `loader-e2`).
> - [x] E2b (overlay acompanha o tema, commit `loader-e2b`).
> - [x] E3 (textos init padrão + loader nos 2 deletes PCT + tag helper,
>   commit `loader-e3`). W1 verificado: sem espelhos órfãos — sem mudança.
> - [x] E4 (loader deletes TL/PES/TORA + tags, commit `loader-e4`).
> - [x] E5 (estoque stub→real + NF-e/MDF-e ops longas, commit `loader-e5`).

## 1. Auditoria "mesmo problema do Save de cliente lento" — resultado

O fix central (`invalidateReadCacheForPath` cruzando namespace, onda 16)
é agnóstico a caminho: cobre **todas** as coleções com TTL
(profile 5–10min, catalog 3–5min, finance 30–60s, default 60s).

Verificados e SAUDÁVEIS (não mexer):
- Old-core service (`species.html`): R/W no mesmo serviço + `invalidateCollectionCache`
  com purga da coleção-pai + `SpeciesCRUD.save/remove` com `force` e `invalidateAll`.
- Fornecedores (`fornecedor-modals.js`): TTL 60s + `invalidateFornecedoresCache()` nas
  3 escritas (linhas 1209/1274/1578).
- `nf-naturezas.js`: filtro local no delete; catálogo quase-estático.
- `species-store.js`: `getAll({force:true})` no save/remove; TTL 5min só p/ leitura fria.
- `clientsCache` (closure): TTL 2s; `getClients(true)` pula.

WATCH ITEMS (só mexer após confirmação empírica):
- **W1.** `removeClientFromCaches` purga `clients`/`clientes`/`clientesPct` simples,
  mas NÃO os espelhos namespaced `companies/{t}/clientes*`. O merge não-force do
  `getClients` pode ressuscitar fantasma desses espelhos. Proposta: estender a
  purga às famílias namespaced (1 função + trava estática). Verificação antes:
  inspecionar chaves locais em sessão logada.
- **W2.** `saveToFirebase` faz N `get()` sequenciais (probes de writePath) antes do
  `set` — LATÊNCIA sistêmica, não correção. Proposta: cachear writePath resolvido
  por coleção (derrubar em permission-denied). Medir antes/depois com timing real.
- **W3.** Merge não-force sem dedupe por nome (só id) → duplicatas visuais possíveis.
  Só mexer se relatado.

## 2. Padrão loader de finanças — anatomia memorizada

Referência: `financas.js mostrarLoading` (2077) + fluxos `salvarConta` (3797/4100/4206).
4 camadas, sempre juntas:
- **L1 — guarda anti-duplo-submit:** flags `__financeSaving`/`__financeSaveInProgress`
  checadas no início; retorno precoce se ocupado.
- **L2 — botão:** `setSubmitButtonLoading(btn, true/false, 'Salvando...')` (desabilita
  + spinner no próprio botão).
- **L3 — overlay global:** `mostrarLoading(true/false, texto)` — cria
  `#globalLoadingOverlay` sob demanda, fade 300ms; **hide em TODAS as saídas**
  (success, catch, early-return).
- **L4 — toast** de resultado APÓS o hide.

Regras anti-regressão (valem p/ todas as etapas):
1. Um overlay por página (checar `#globalLoadingOverlay` antes de criar outro).
2. `hide` em `finally` (ou em todos os returns) — loader preso é pior que sem loader.
3. Bloquear só ESCRITA (save/delete/print); nunca leitura/listagem.
4. Texto específico por operação ("Salvando pedido...", "Excluindo cliente...").
5. Não remover spinners de botão existentes (NF-e); somar, não substituir.
6. Não tocar no que funciona (finanças, estoque, species, folha) salvo achado.

## 3. Mapa por área (existe × falta × impacto)

| Área | Hoje | Falta | Impacto da etapa |
|---|---|---|---|
| Vendas | 33 calls `LoadingManager` MORTAS (sem div no HTML) | só a div `#loadingOverlay`+`#loadingText` | 33 fluxos passam a bloquear — testar salvar/excluir/imprimir |
| Compras | 26 calls, manager é STUB proposital | trocar stub pelo helper único | mesmo acima |
| Romaneio PCT (lista+clientes+pedidos) | zero loader, só toast (10 shows no modal-clientes) | envolver save/delete/print | modais continuam usáveis; testar delete cliente (caso onda 15) |
| Romaneios TL/PES/TORA | zero loader | mesmo do PCT, 1 etapa por tipo | testar impressão (janela abre no gesto — loader não pode quebrar popup) |
| Estoque | modal próprio funcional | só conferir hide-em-erro (`hideLoading` no catch) | se faltar, 1 linha em finally |
| NF-e/MDF-e | spinner de botão (funciona) | helper global nas ops longas (emitir/salvar) | manter spinner de botão |
| Folha/species/client/fornecedor | overlay existe | auditar pareamento show/hide | só corrige se achado |
| Cadastros (produto/fornecedor em vendas/compras) | — | cobertos por Vendas/Compras | — |

Decisão anti-duplicação: **1 helper único** `js/sisweb-loading.js`
(`SiswebLoading.show(text)/hide()`, cria overlay sob demanda, guarda
reentrância, CSS mínimo inline). Vendas/Compras/Romaneios/NF-e/MDF-e usam ele.
Finanças/estoque/species/folha MANTÊM os seus.

## 4. Etapas (1 commit + deploy + teste seu cada)

- **E0:** helper + trava estática; nenhuma página ligada (risco zero).
- **E1:** `vendas.html` ganha a div → 33 calls vivas. Testar.
- **E2:** compras stub → helper. Testar.
- **E3:** PCT (lista romaneios + clientes + pedidos) + micro-fix **W1**. Testar.
- **E4:** TL, PES, TORA (1 deploy, teste por tipo).
- **E5:** estoque hide-em-erro (se confirmado) + NF-e/MDF-e ops longas. Testar.
- **E6:** auditoria pareamento folha/species/client/fornecedor. Só se achado.
- **W2** (perf writePath) é etapa separada com medição antes/depois.

Gates por etapa: lint + typecheck + suite + `?v=` + SW + deploy + validação logada.
