# Auditoria UX — Feedback visual em ações (botões/links/menus/forms/modais/telas)

Data: 2026-10-09. Método: varredura estática de ~130 JS raiz + 42 `modules/` + `folha_pagamento/`
+ handlers inline nos HTMLs; cada função de ação classificada em
GUARD (trava/loading/disable), TOAST-ONLY, ALERT-ONLY (`alert`/`confirm` bloqueante, sem trava)
ou NONE. Corpos críticos lidos na íntegra para eliminar falso-positivo
(ex.: `console.log('Salvando...')` NÃO conta como trava).

## Legenda de criticidade

- **Crítica:** duplo clique gera duplicidade/inconsistência de dados reais, sem trava.
- **Alta:** operação fiscal/destrutiva/financeira sem trava ou sem feedback durante `await`.
- **Média:** percepção de travamento / relatório pesado sem progresso / grade sem skeleton.
- **Baixa:** operação local/síncrona ou higiene (código morto).

---

# Resumo Executivo

| Criticidade | Qtd | Onde concentra |
|---|---|---|
| Crítica | 9 | Tora (fornecedor/espécie), Estoque toras (baixa), Almoxarifado (7 saves/baixas) |
| Alta | 12 | Pré-romaneio, eventos SEFAZ (CC-e/inutilização), admin parceiros, Folha (baixa/exclusão/estorno), cadastros fiscais |
| Média | 11 | Exports/impressões pesadas, grids sem skeleton, fechar-mês sem feedback, reply de suporte sem trava |
| Baixa | 4 | Código morto legado NF-e, ações locais, foto de perfil (delegada) |
| **Total** | **36** | |

Boa notícia: os fluxos de maior valor (caixa, pedidos, emissão NF-e/MDF-e, romaneios
TL/PCT, cadastros base, login, funcionário da folha) **já seguem padrão exemplar**
(ver "Referências positivas"). O buraco está nas bordas: Tora-modais legados,
almoxarifado, pré-romaneio, eventos fiscais secundários, folha-lançamentos e admin.

---

# Mapa de Correções

## Financeiro — 0 problemas (referência)

`salvarContaReceber`/`salvarContaPagar` (`financas.js:3725,4047`,
`__financeSaving` + `setSubmitButtonLoading`), `confirmarPagamento` (`:6778`),
`excluirConta`/`excluirPagamento` (`__financeDeleteInFlight` /
`__financeAccountDeleteInFlight`), tabelas com overlay
(`finalizarOverlayFinanceTabela`). Nada a fazer; usar como modelo.

## Comercial (Vendas/Compras) — 0 problemas (referência)

`salvarPedido`, `excluirPedido`, `clonarPedido`, `listarPedidos`
(`vendas.js:2384,4075,4007,3238`, idem compras) com `LoadingManager` + overlay que
bloqueia cliques. Exports (`exportarRelatorioComprasCSV/PDF`, `imprimirPedido`)
emitem toast de início — aceitável hoje, mas sem trava durante geração (Média, F-31–33).

## Estoque (toras) — 3 problemas (1 Crítico, 2 Baixa/Média)

- **E-01 Crítica** — `registrarSaida` (`estoque.js:4317`, 139 linhas): só
  `alert`/`confirm`, **nenhum overlay/disable**. Risco: duplo clique/Enter gera
  baixa duplicada (movimentações + saldo inconsistentes). Impacto: divergência
  físico × sistema, estorno manual trabalhoso.
- **E-02 Baixa (ok, documentar)** — `excluirTorasDoEstoqueEmLote` (`estoque.js:5387`):
  tem trava `exclusaoTorasEmLoteEmAndamento` + `atualizarAcoesExclusaoToras()`
  (desabilita botões). Falta só overlay/toast durante o lote (Média-Baixa p/ lotes grandes).
- **E-03 Média** — grids `carregarTabelaEstoque`, `carregarTabelaMovimentacoes`,
  `carregarTorasDisponiveis`, `carregarRomaneiosSaidaSelect`: sem skeleton dedicado
  (tela vazia até carregar). Impacto: percepção de travamento em conexões lentas.
- `registrarEntrada` (`:3545`) é referência parcial: `showLoading` + progresso
  `Salvando i/N`, mas sem `disabled` no submit — reforçar com trava (Média-Baixa).

## Almoxarifado/Produtos (`estoque_produtos.js`) — 7 problemas (Críticos)

Sem nenhuma trava/loading em (todos ALERT-ONLY, só `alert`/`confirm`):
- **A-01** `salvarProdutoAlmoxarifadoPeloFormulario` (`:605`, 117 ln) — produto duplicado.
- **A-02** `salvarEdicaoModalProdutoAlmoxarifado` (`:1365`, 114 ln) — edição duplicada.
- **A-03** `registrarEntradaProduto` (`:724`) — entrada duplicada (saldo errado).
- **A-04** `confirmarBaixaProduto` (`:1719`) / **A-05** `registrarBaixaProdutoInline` (`:1737`) — baixa duplicada.
- **A-06** `salvarEdicaoMovimentacaoProduto` (`:2512`) — edição duplicada.
- **A-07** `estornarMovimentacaoProduto` (`:2546`) — estorno duplicado (inverte saldo 2x).
- Risco comum: duplo clique/Enter repete escrita; `alert` de sucesso chega tarde.
  Impacto: saldos e movimentações incorretos, conciliação manual.

## Fiscal — 5 problemas (2 Alta, 2 Média, 1 higiene)

- **F-11 Alta** — `enviarCartaCorrecaoNF` (`notas-fiscais.html:4011`, 25 ln):
  `callFunction('nf_cartaCorrecaoNFe')` sem disable/loading. Risco: cliques repetidos
  disparam eventos CC-e repetidos à SEFAZ (rejeição/confusão + senha A1 reenviada).
- **F-12 Alta** — `enviarInutilizacaoNF` (`notas-fiscais.html:4066`, 29 ln): idem
  p/ `nf_inutilizarNumeracao` (ato fiscal irreversível por faixa).
- **F-13 Média** — `nf-naturezas.js` `_salvarDoModal` (`:244`, ALERT), `salvar` (`:85`,
  NONE), `remover` (`:106`, NONE); `nf-config.js` `saveConfig` (`:170`), `saveConfigSection`
  (`:187`, NONE 25 ln). Risco: salvamento silencioso/duplo sem feedback.
- **F-14 Média** — `gerarRelatorioMdfe` (`mdf-e.js:782`, ALERT), `salvarTokenManual`
  (inline, ALERT), `excluirManifesto` (inline, ALERT). Impacto: sem estado de progresso.
- **F-15 Baixa (higiene)** — `emitirNotaFiscal` / `salvarRascunho` (`notas-fiscais.js:274,298`,
  simulação legada com `alert`): **código morto, zero wiring** (`onclick` inexistente).
  Risco: religamento acidental no caminho errado. Ação: remover ou marcar `@deprecated`.
- Referência: `confirmarEmissao` (inline `:3697`) — disable + spinner + `SiswebLoading`
  + `finally` restaurando. `salvarRascunhoMdfe`/`emitirMdfe` (`mdf-e.js:306,336`) com
  `SiswebLoading` ✓. `uploadCertificado` (inline) com GUARD ✓ (service `nf-cert.js`
  é camada pura, correto não ter UI).

## Romaneios — 6 problemas (2 Críticos, 1 Alto, 3 Médios/Baixos)

- **R-21 Crítica** — `saveClient` (`romaneiotora_modais.js:1955`, 187 ln): zero trava,
  zero toast, 3 `alert`, sem `confirm`; id via `Date.now()`. Duplo clique = **fornecedor
  duplicado** com ids distintos (piora: cada cópia parece legítima).
- **R-22 Crítica** — `saveSpecies` (idem `:1558`, 135 ln): **espécie duplicada** idem.
- **R-23 Alta** — `salvarPreRomaneio` (`preromaneio.js:1167`, 128 ln): 7 `alert`,
  zero trava/feedback. Duplo save = pré-romaneio duplicado.
- **R-24 Alta/Média** — `excluirRomaneio` Tora (`romaneiotora_modais.js:3217`, 229 ln):
  tem `confirm` + toast, mas **nada durante o delete permanente** (sem disable/loading).
- **R-25 Média** — `preromaneio-modals.js`: `deletePreRomaneioClient` (`:369`),
  `carregarPreRomaneio` (`:1132`), `excluirPreRomaneio` (`:1163`) — ALERT-only.
- **R-26 Baixa/Média** — `exportarRomaneioExcelFirebase` (`romaneiotora_modais.js:4946`,
  ALERT-ONLY): export sem progresso. `clonarRomaneio` PES (inline `:4355`): só local,
  sem risco (Baixa).
- Referência: `salvarRomaneio` TL (`modules/romaneio/salvar-romaneio.js:131`) e PCT
  (`romaneiopct-tabela.js:1240`, `isSavingRomaneio` + `LoadingManager`) ✓;
  `gerenciar-clientes/especies` (`isProcessing`) ✓; `deleteRomaneio` PES (GUARD) ✓.

## Folha/RH — 7 problemas (3 Alta, 4 Média)

- **H-31 Alta** — `darBaixaQuinzena` (`folha-lancamentos.js`, 25 ln, NONE): baixa de
  pagamento **sem trava e sem feedback**. Duplo clique = pagamento duplicado.
- **H-32 Alta** — `deleteFuncionario` (`folha-funcionarios.js`, 9 ln, NONE) e
  `deleteCargo` (`folha-cargos.js`, 4 ln, NONE): exclusão sem `confirm`, sem loading.
- **H-33 Alta** — `estornarFechamento` (`folha-lancamentos.js`, 22 ln, NONE) e
  `clonarFolha` (41 ln, NONE): sem trava/feedback em operações que reescrevem mês.
- **H-34 Média** — `fecharMes` (idem, 38 ln): **tem idempotência** (`__fechandoMesIds`,
  não reentra) mas **zero feedback visual** durante `updateLancamento` + `__gerarFinanceiro`.
  Usuário clica, nada acontece por segundos → clica em outros controles no meio do await.
- **H-35 Média** — `deleteFolha` (ALERT/confirm, 25 ln), `imprimirRelatorio`
  (`folha-relatorios.js`, NONE 29 ln), `bhGerar*` (banco-horas-relatórios): geração de
  recibos/relatórios sem progresso.
- Referência: `handleSubmitFuncionario` (`folha-funcionarios.js:819`) — flag
  `_savingFuncionario` + safety-timeout 15s + disable + spinner + overlay. É o modelo
  a replicar nos demais handlers da folha.

## Cadastros/Config — 0 problemas nas páginas (referência)

`handleSave` de `js/client.js:384`, `js/fornecedor.js:428`, `js/species.js:275`
(`*InFlight` + `showLoading`), `saveNewClient` (`openNewClientModal.js:336`),
`saveFinance*Modal`, `saveCompany` (`company.html`, 307 ln, GUARD),
`enviarComprovante` (`subscription.html`, GUARD), `confirmMfaSetup` (GUARD).
`triggerPhotoUpload` (`user-profile.html`, 2 ln) só delega — verificar destino no
próximo ciclo (Baixa).

## Relatórios/Exports/Impressão — 5 problemas (Média)

- **P-41** `exportarRelatorioEstoqueExcel` (`estoque.js:8271`, TOAST 78 ln),
  `exportarRelatorioComprasCSV/PDF` (`compras.js:3877,3913`), `exportarTabelaExcel` /
  `exportarPDF` (finanças, TOAST-ONLY), `imprimirRelatorioEstoque` (`estoque.js:8215`,
  ALERT 54 ln), `imprimirProdutosSelecionados` (vendas/compras), `imprimirRelatorio`
  (`vendas.js:6769`), `printCompanyReport` (`company.html:1735`, 92 ln, NONE):
  geração síncrona/assíncrona longa **sem overlay nem progresso** — em base grande o
  navegador parece congelar (finanças já quebrou relatório de 20s em chunks, `financas.js:2624).
- `gerarRelatorio` (vendas/compras/estoque) e `imprimirRelatorioAtual`/`exportarDados`
  (finanças) têm GUARD ✓.

## Suporte/Admin/Outros — 4 problemas (1 Alto, 3 Médios)

- **S-51 Alto** — `submitPartnerDeleteModal` (`scripts/admin/admin-main.js:2240`,
  25 ln, NONE): **exclusão de parceiro sem confirm ODE? sem trava/feedback**.
  `savePartnerConfig` (`:2266`, NONE 16 ln) e `uploadAdminSupportAttachments`
  (`:2450`, NONE 33 ln): salvamento/upload silenciosos.
- **S-52 Média** — `__siswebSendSupportTicketReply` (`menu-component.js`): tem
  `__siswebSetSupportFeedback('Enviando resposta...')` ✓ mas **sem disable do botão**
  (duplo envio possível). `deleteSubscriptionDataFlow` / `deleteFromStatusFlow`
  (admin, ALERT-ONLY): deletes com confirm mas sem loading.
- Login (`login.html` inline + `auth.js:login`): spinner + `disabled` + `aria-busy` ✓.
  `saveSubscriptionSettings` / `saveCampaignEditor` / `saveCompanyProfileFromAdmin`:
  GUARD ✓.

---

# Plano Técnico

Formato por item: localização → código envolvido → solução → complexidade →
risco da mudança → dependências.

| ID | Localização exata | Código envolvido | Solução recomendada | Complex. | Risco | Dependências |
|---|---|---|---|---|---|---|
| E-01 | `estoque.js:4317` `registrarSaida` | `alert`-only, 139 ln, `await` Firebase sem overlay | Overlay Loader + Disable Button + Request Lock (`saidaEmAndamento`); toast fim | P | Baixo | `showLoading/hideLoading` já existem (`:9100`) |
| A-01–A-07 | `estoque_produtos.js:605,1365,724,1719,1737,2512,2546` | 7 fns ALERT-only | Request Lock + Loading Button + toast (padrão `handleSave` cadastros); idempotência p/ baixas/estornos | P–M | Baixo | helper global proposto (G-01) |
| R-21/R-22 | `romaneiotora_modais.js:1955,1558` | `alert`-only, id `Date.now()` | Request Lock + Disable + toast; **trocar id por push-key/UUID checado** (Duplicate Protection) | P | Baixo | `firebase-compat-bridge` `push().key` |
| R-23 | `preromaneio.js:1167` | 128 ln, 7 alerts | Request Lock + Overlay + toast | P | Baixo | G-01 |
| R-24 | `romaneiotora_modais.js:3217` | confirm+toast, sem loading | Loading Button no confirmar + overlay durante delete | P | Baixo | — |
| R-25 | `preromaneio-modals.js:369,1132,1163` | ALERT-only | Lock + toast | P | Baixo | G-01 |
| F-11/F-12 | `notas-fiscais.html:4011,4066` | `callFunction` SEFAZ direto | **Copiar `confirmarEmissao`**: disable+spinner+`SiswebLoading`+`finally` (1:1) | P | Baixo | `js/sisweb-loading.js` |
| F-13 | `nf-naturezas.js:85,106,244`, `nf-config.js:170,187` | NONE/ALERT | Loading Button + toast | P | Baixo | G-01 |
| F-15 | `notas-fiscais.js:274,298` | código morto | Remover ou `@deprecated` + teste anti-regresso | P | Baixo | suíte |
| H-31–H-33 | `folha-lancamentos.js` (baixa/estorno/clone), `folha-funcionarios.js`/`folha-cargos.js` (deletes) | NONE | Replicar `handleSubmitFuncionario:819` (flag+timeout+disable+spinner+overlay); `confirm` nos deletes | P–M | Baixo | `FolhaUtils.showLoading` |
| H-34 | `folha-lancamentos.js` `fecharMes` | id-set sem feedback | Overlay/toast "Fechando mês..." mantendo o `__fechandoMesIds` | P | Baixo | — |
| P-41 | exports/impressões (7 pontos) | TOAST/ALERT-only | Toast início+fim imediato + overlay p/ >2s; chunking (modelo `financas.js:2624`) p/ >10s | M | Médio (trocar geração síncrona) | — |
| S-51 | `admin-main.js:2240,2266,2450` | NONE | `confirm` + lock + loading no destrutivo; toast nos demais | P | Baixo | modal padrão admin |
| S-52 | `menu-component.js` reply | feedback sem trava | Disable durante envio | P | Baixo | — |
| E-03/grids | 7 `carregar*Tabela*` | sem skeleton | Skeleton/shimmer no `tbody` + `aria-busy` (padrão landing cupons) | M | Baixo | CSS shimmer existente |

Complexidade: P = pequena (≤2h, troca localizada), M = média (refator de geração).
Todas as mudanças são **aditivas** (trava/feedback em volta do `await` existente),
sem alterar regra de negócio → risco de regressão baixo; cobertura via testes de
contrato (`tests/*.test.mjs`) + smoke 17 páginas.

Ordem sugerida: R-21/R-22 → A-01–A-07 → E-01 → F-11/F-12 → H-31–H-34 → R-23–R-25 →
S-51/S-52 → P-41 → skeletons → F-15.

---

# Padronização Global (proposta)

G-01. **Helper único** `window.SiswebAction` (novo, em `js/sisweb-loading.js` ou módulo
próprio): `run(btn, label, fn)` — desabilita botão + spinner no label + trava por
chave + `SiswebLoading` opcional + toast erro/sucesso + `finally` restaurando.
Todos os 36 pontos migram para ele; novos botões nascem cobertos.
G-02. **Disable Button automático:** todo `submit`/ação async desabilita o trigger
no primeiro tick (sem exceção p/ destrutivos/fiscais/financeiros).
G-03. **Loading Button automático:** texto do botão vira `<spinner> Verbo...`
(`Salvando...`, `Emitindo...`, `Excluindo...`) durante o `await`.
G-04. **Toast automático:** início (operações >2s), sucesso e erro SEMPRE via
`__toast`/`Utils.showToast` (nunca `alert` em fluxo novo; `alert` legado some
conforme ondas).
G-05. **Overlay Loader p/ >2s:** `SiswebLoading.show(msg)` bloqueando a tela
(SEFAZ, saves com anexo, lotes, baixa/estorno, emissão).
G-06. **Progress Bar p/ >10s:** `i/N` textual no overlay (modelo `registrarEntrada`
+ chunked `financas.js:2624`); imports Excel e relatórios pesados viram
assíncronos com progresso.
G-07. **Proteção duplicada em 3 camadas:** (1) Request Lock (flag/Set por operação);
(2) Duplicate Request Protection (botão desabilitado + overlay consome cliques);
(3) Idempotência (chave estável/`push().key` em vez de `Date.now()`; `__fechandoMesIds`
como modelo p/ ações por-id).

Referências positivas (não mexer, copiar): `confirmarEmissao` (NF-e),
`salvarContaReceber/Pagar`, `confirmarPagamento`, `salvarPedido` (vendas/compras),
`salvarRomaneio` TL/PCT, `handleSave` (cliente/fornecedor/espécie),
`handleSubmitFuncionario`, login, `enviarComprovante`, `saveCompany`.

---

# Checklist de implementação (por tela)

## Execução 09/10 — Onda 1 (concluída, gates 823 testes 822/0/1)
- **R-21/R-22** (`romaneiotora_modais.js`): flags `__toraSave{Species,Client}InFlight` +
  `__toraSetSaveBtn` (disable+spinner, label original restaurado) + `__toraNotify`
  (toast com fallback); trava após validações; restore nas 2 saídas; `id="saveClientBtn"`.
  Success/erro via toast (antes: `alert`).
- **A-01–A-07** (`estoque_produtos.js`): bloco `__alm*` (lock por operação + botão do
  form + `SiswebLoading` + toast com fallback a `alert`); 8 locks
  (`save/entrada/edit/saida/baixa-modal/baixa-inline/edit-mov/estorno-prod`); a baixa
  trava no choke `registrarSaidaProduto` (cobre os 2 chamadores); forms endereçados por
  id (`entradaProdutoForm`, `formEditarProdutoAlmoxarifado`, `formBaixaProduto`,
  `baixaProdutoInlineForm`, `modalEditarMovProduto`).
- **E-01** (`estoque.js:registrarSaida`): flag `registrarSaidaEmAndamento` + `showLoading`
  + submit desabilitado com spinner; restore nos 2 fins (flag em `let` de escopo da
  função para o `catch` enxergar).
- Ajuste de trava existente: `tests/legacy-strangler-estoque.test.mjs` range 15–45 →
  64–96 (bloco `__alm*` deslocou `swGet/swSave`); trava nova `tests/ux-feedback-onda1.test.mjs` (6).
- Desvio justificado do plano: mantidos ids `Date.now()` (lock elimina a duplicidade;
  trocar o formato do id quebraria chaves já persistidas). `alert` de validação
  pré-write mantido (síncrono, sem risco de duplicidade).

## Execução 09/10 — Onda 2 (concluída, gates 832 testes 831/0/1, SEM commit)
- **F-11/F-12** (`notas-fiscais.html`, inline): `__nfEventoInFlight` + `__nfEventoBtn`
  (botão localizado por `onclick`, disable+spinner, label original restaurado) +
  `SiswebLoading` (`Enviando CC-e/inutilização à SEFAZ...`) + `__nfEventoFim` nas 2
  saídas de cada função. Canal de mensagem (`setEventoFiscalMsg`) preservado.
- **H-31–H-34** (`folha_pagamento/folha-lancamentos.js`): `__folhaLancamentoBegin/End`
  (Set por `op:id` + `FolhaUtils.showLoading/hideLoading`) em `darBaixaQuinzena`,
  `estornarFechamento`, `clonarFolha`, `deleteFolha` (confirm movido para dentro da
  trava); `fecharMes` ganhou overlay mantendo o `__fechandoMesIds` existente.
- **H-32** (`folha-funcionarios.js`/`folha-cargos.js`): `__folhaDelEmAndamento`
  (Set global) em `deleteFuncionario` (já tinha confirm+overlay) e `deleteCargo`
  (ganhou overlay); restore no `finally`/`catch`.
- **R-23** (`preromaneio.js` + `preromaneio.html`): `__preRomaneioSaving` +
  `__preSetBtn` (`#btnSalvarPreRomaneio`, id novo) + `__preNotify` (toast com fallback);
  restore nos 3 fins (sucesso, catch, firebase indisponível); success/erro via toast.
- **R-25** (`preromaneio-modals.js`): `__preModalBegin/End` + `__preModalNotify`
  (reusa `__preNotify`) em `excluirPreRomaneio` (3 restores), `deletePreRomaneioClient`
  e `carregarPreRomaneio`; alerts pós-write viraram notify.
- Trava estendida: `tests/ux-feedback-onda1.test.mjs` foi a 15 testes (9 novos da onda 2).
- Desvios justificados: sem `confirm` novo em `darBaixaQuinzena` (decisão de produto,
  só trava+feedback); sem disable individual nos botões de linha da folha (overlay
  bloqueia; sem hook estável de botão); botões SEFAZ localizados por `onclick`
  (modais dinâmicos sem id).

## Execução 09/10 — Onda 3 (concluída, gates 840 testes 839/0/1, SEM commit)
- **S-51** (`scripts/admin/admin-main.js`): `submitPartnerDeleteModal` com
  `window.__partnerDeleteInFlight` + `#partnerDeleteConfirmBtn` (spinner+restore nos
  2 fins); `savePartnerConfig` com `window.__partnerConfigSaving` + `#partnerCommissionSave`;
  `uploadAdminSupportAttachments` com `input.disabled` em `try/finally` (progresso
  `i/N` por arquivo já existia).
- **S-52** (`menu-component.js`): botão de reply ganhou `id="siswebSupportReplySendBtn"`;
  `__siswebSendSupportTicketReply` com `window.__supportReplyInFlight` + disable/restore.
- **P-41**: `exportarRelatorioEstoqueExcel` + `imprimirRelatorioEstoque` (`estoque.js`)
  com `showLoading`/`hideLoading` em `try/finally` (hide ANTES do diálogo de
  impressão/PDF; corpo sem reindentar p/ diff mínimo); `exportarRelatorioComprasCSV`
  com toasts de início+fim. Verificados já-OK: `exportarRelatorioComprasPDF`
  (LoadingManager+finally), finanças (busy guard nos callers), impressões
  vendas/empresa (toast/sync rápido).
- **Skeletons (regra de tema)**: `.skeleton-box`/`.skeleton-row` em `layout-comum.css`
  usando **só tokens `--sw-surface-2/--sw-hover/--sw-border`** (claro/escuro automático,
  zero hardcode, `prefers-reduced-motion` respeitado) — isso acendeu o `getSkeletonRows`
  já existente nas movimentações (estava sem estilo). Linhas estáticas nos tbodys de
  boot (`vendas#produtosTable`, `estoque#estoqueTable/#movimentacaoTable`); renders
  substituem `innerHTML` (inclusive vazios), então limpam sozinhas. `?v=` ressincronizado.
- **F-15/F-16** (`notas-fiscais.js`): removido `salvarRascunho()` morto (zero callers;
  correção à auditoria: `emitirNotaFiscal` NÃO estava morto — `#nfForm` submit chama;
  ganhou `__nfEmitindo` + submit desabilitado).
- Trava: `tests/ux-feedback-onda1.test.mjs` foi a 23 testes (8 novos: admin, reply,
  P-41, skeleton temático, F-15/F-16).

## Execução 09/10 — Onda 4 (concluída, gates 847 testes 846/0/1, SEM commit)
- **H-35** (`folha_pagamento/folha-relatorios.js`): `gerarReciboIndividualDetalhado`
  (já tinha lock) ganhou overlay com hide ANTES de `imprimirRelatorio(html)` + hide
  de segurança no `finally`; `window.imprimirRelatorio(tipo)` ganhou trava por
  `relatorio:<tipo>` + overlay em `try/finally`.
- **H-31b**: `darBaixaQuinzena` agora pede `confirm` explícito (nome + mês + aviso de
  registro no financeiro) — decisão de produto aprovada na onda.
- **F-13** (`nf-naturezas.js` + inline): `_salvarDoModal` com `window.__nfNatSaving` +
  `#natOpSalvar` (spinner+restore nos 2 fins); `nfRemoverNatureza` com trava por id
  (`__nfNatDeleting`). `salvar`/`remover`/`saveConfig*` são camada-serviço (sem DOM):
  correto sem UI — trava aplicada nas entradas UI.
- **F-14**: `salvarTokenManual` com `__nfTokenSaving` e reset nos 4 fins (sem leak);
  `excluirManifesto` verificado sync-local (confirm + filtro em memória, sem await):
  sem mudança, documentado OK. `gerarRelatorioMdfe`: build rápido + abertura de
  janela (feedback próprio): sem mudança, documentado OK.
- **R-24** (`romaneiotora_modais.js:excluirRomaneio`): overlay `Excluindo romaneio...`
  com hide no `finally` (lock + toasts já existiam).
- **R-26** (`exportarRomaneioExcelFirebase`): `__toraExportInFlight` (após o check de
  XLSX, p/ retry limpo) + overlay + toast sucesso/erro (erro era `alert`).
- Correções de ferramenta: `async async function` inserido por match parcial do edit
  em `nf-naturezas.js`/`notas-fiscais.html` (detectado via `node --check`, revertido);
  varredura `async\s{2,}` limpa nos 13 arquivos tocados. `carregarPreRomaneio` ganhou
  `try/finally` anti-leak.
- Correção à auditoria (2ª): `emitirNotaFiscal`/`excluirManifesto`/`gerarRelatorioMdfe`
  reclassificados após leitura integral — só o 1º precisava de trava.
- Trava: `tests/ux-feedback-onda1.test.mjs` foi a 30 testes (7 novos da onda 4).

## Execução 09/10 — Onda 5 (concluída, gates 852 testes 851/0/1, SEM commit)
- **E-01b** (`estoque.js:registrarEntrada`): flag `registrarEntradaEmAndamento` +
  submit `#entradaForm` desabilitado com spinner; restore nos 2 fins (o loading com
  progresso já existia, faltava a trava — duplo submit passava nas validações).
- **E-02** (`excluirTorasDoEstoqueEmLote`): `showLoading('Excluindo toras...')` com
  hide no `finally` existente (lock + desabilitar botões já existiam).
- **Almoxarifado**: linha "Carregando estoque..." (spinner) trocada pelas rows
  `skeleton-row/box` tematizadas (consistência com a Onda 3).
- **Foto de perfil** (`user-profile.html:handlePhotoUpload`): `input.disabled`
  durante o envio + restore nos 2 fins (Storage ok e fallback local); corrigida
  duplicação de linhas introduzida na edição.
- **Verificados OK sem mudança**: ticket CREATE (disable+spinner+feedback+finally),
  `bhOpenPrintWindow` (toast de popup bloqueado), `gerarRelatorioMdfe` (build rápido
  + janela própria), impressões vendas/empresa.
- Trava: `tests/ux-feedback-onda1.test.mjs` foi a 35 testes (5 novos da onda 5).

## Execução 09/10 — Movimentações: Imprimir abre Detalhes (concluída)
- Pedido: na aba Movimentações (`estoque.html`), o botão Imprimir abria o modal
  genérico "Pré-visualização de Relatório"; agora abre "Detalhes das Movimentações"
  no padrão "Detalhes do Pedido" (`vendas.html#visualizarPedidoModal`).
- Refator (local correto, sem resíduo): `imprimirMovimentacoesEstoque` foi dividido em
  `coletarDadosMovimentacoesParaImpressao()` (filtros/seleção/ordenação/colunas/resumo —
  regra 100% preservada) + `montarHtmlMovimentacoesParaImpressao()` (documento) +
  `visualizarMovimentacoesDetalhes()` (trava `__movDetInFlight` + overlay + modal) +
  `imprimirDetalhesMovimentacoes()` (imprime o payload guardado). Função antiga
  REMOVIDA, botão reapontado, export global trocado (pegou `ReferenceError` que
  quebraria o load — corrigido antes do commit).
- Modal `#detalhesMovimentacoesModal` ao lado do preview (modais de impressão juntos):
  cabeçalho (documento/emissão/período/empresa/qtd via `textContent`), itens (mesmas
  células do impresso, com `escapeHtml`), resumo e rodapé Imprimir/Fechar. Só
  `var(--sw-*)` no markup (claro/escuro automático, trava de teste anti-hex).
- Preview (`abrirPreviewRelatorio`) intacto p/ os outros 4 chamadores (rastreio,
  relatório, consulta, almoxarifado). Smoke autenticado em localhost: modal abre com
  24/24 linhas, cabeçalhos, qtd, período e payload — zero pageerrors.
- Publish: SW `2026-10-08-onda24` → `2026-10-09-ux-movdet` (`sw.js` + `PWA_VERSION` +
  9 asserts em 6 arquivos de teste); `?v=` ressincronizado.
- Deploy 09/10: `npm run deploy:hosting` OK (539 arquivos, 42 novos); produção serve
  SW `2026-10-09-ux-movdet`, modal Detalhes, coletor novo e sem a função antiga.

## Execução 09/10 — Remessa: relatório quebrado/desordenado (concluída)
- Sintoma (print do usuário): "Movimentação por Remessa" com 18 colunas, células
  empilhadas (dezenas de plaquetas/custódias/autefs por linha), romaneio com chaves
  soltas, `R$ 0,00` em linhas sem preço, data/status quebrados no meio.
- Causa raiz: `gerarRelatorioMovimentacaoPorRemessa` agregava N toras numa linha com
  `join(', ')` em 7 colunas + min–max em 5 — granularidade errada p/ impressão; mais
  `romaneiosRelacionados` sem filtrar objetos (chaves soltas), `formatCurrency(0)` e
  falta de `nowrap` no CSS de impressão.
- Fix (só `estoque.js`, regra de dados preservada): 18→11 colunas agregadas
  (Data/Remessa/Qtd/Romaneio/Espécie/Vol.Tora/Vol.Produzido/Rendimento/Valor/
  Cliente-Fornecedor/Status); detalhe por tora fica no Histórico/Detalhes; romaneios
  só com strings válidas; valor zerado vira `-`; `nowrap` p/ numéricos/datas/ids/status
  no impresso. Totais/cards, seleção, ordenação e filtros intactos.
- Trava: `tests/estoque-pwa-impressao.test.mjs` (+1 teste: colunas, quantidade,
  string-guard, valor `-`, nowrap). Gates: lint/typecheck OK, 856 testes 855/0/1.
- Publish: SW `2026-10-09-ux-movdet` → `2026-10-09-remessa-fix` + `?v=` ressincronizado.

- [ ] **Login** — OK (spinner+disable+aria-busy). Nada a fazer.
- [ ] **Vendas/Compras** — OK nos fluxos (overlay). Adicionar trava nos 3 exports
  (CSV/PDF/impressão lista) + skeleton em `carregarTabelaProdutos`.
- [ ] **Finanças** — OK. Nada a fazer.
- [ ] **Estoque toras** — E-01 (lock+overlay na baixa), reforço `registrarEntrada`
  (disable), skeletons nas 4 tabelas.
- [ ] **Almoxarifado** — A-01–A-07 (lock+loading+toast nos 7 pontos).
- [ ] **Romaneio Tora** — R-21/R-22 (lock+toast+id estável), R-24 (loading no delete),
  R-26 (progresso no export Excel), imports v1/v3 (progresso).
- [ ] **Romaneios TL/PCT/PES/Pré** — R-23/R-25 (lock+overlay+toast no pré).
- [ ] **Fiscal NF-e** — F-11/F-12 (clonar `confirmarEmissao`), F-13 (loading+toast),
  F-15 (remover morto), skeleton em `carregarTabelaNotas`.
- [ ] **Fiscal MDF-e** — OK emissão/rascunho. F-14 (progresso no relatório).
- [ ] **Folha** — H-31–H-35 (replicar padrão funcionário; confirm nos deletes;
  feedback no fechar-mês; progresso em recibos/relatórios).
- [ ] **Cadastros/Empresa/Assinatura/Perfil** — OK. Verificar destino de
  `triggerPhotoUpload` (Baixa).
- [ ] **Suporte** — S-52 (disable no reply; mapear create).
- [ ] **Admin** — S-51 (confirm+lock+loading no delete de parceiro; toast em
  config/upload).
- [ ] **Global** — implementar `SiswebAction` (G-01), migrar os 36 pontos,
  trocar `alert`→toast em fluxo novo, teste de contrato por ponto migrado
  (`tests/ux-feedback-<modulo>.test.mjs`), smoke 17 páginas, bump SW.
