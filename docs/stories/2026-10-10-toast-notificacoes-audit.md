# Auditoria Toast/Notificações — FASE 1 Mapeamento (2026-10-10)

Relatório de padronização de feedback visual do SisWeb. Escopo: eliminar
`alert()`/`confirm()` nativos em favor de Toast + modal de confirmação únicos.

## 1. Totais

| Métrica | Total repo | Produção* |
|---|---|---|
| `alert(` | 613 | **579** |
| `confirm(` | 144 | **100** |
| `window.alert` refs | 7 (4 mecanismo toast.js + 3 wrapper sanitize romaneiotora_modais.js:102) | — |
| `window.confirm` | 20 | 20 |
| Famílias toast existentes | **6** (ver §3) | — |
| Arquivos com `alert(` em prod | ~70 | — |

\* Produção = excluídos `backup/**`, `assets/vendor/**` (jspdf 9), `marqueting/**`, `scripts/**`.

## 2. Top ofensores `alert(` (prod)

| Arquivo | N | Tela/Módulo |
|---|---|---|
| `estoque.js` | 59 | Estoque (toras, romaneio, plaqueta, estorno) |
| `notas-fiscais.html` | 39 | Fiscal NF-e (token, sessão, certificado) |
| `mdf-e.js` | 33 | Fiscal MDF-e (validação, rascunho, autorização) |
| `romaneiopes.html` | 29 | Romaneio Pés |
| `compras_legacy.js` | 27 | Compras legado (pedido, itens, contas, CSV) |
| `estoque_produtos.js` | 24 | Estoque produtos |
| `romaneiopct.html` | 23 | Romaneio PCT |
| `subscription.html` | 22 | Assinatura |
| `admin-settings.html` / `admin-subscriptions.html` | 21/21 | Admin |
| `romaneiotora_modais.js` | 19 | Romaneio Tora (modais) |
| `romaneiopct-tabela.js` | 19 | Romaneio PCT (tabela) |
| `admin-access-governance.html` | 12 | Governança (reconciliação/auditoria) |
| `notas-fiscais.js` | 11 | Fiscal NF-e |
| `preromaneio.js` / `garantia-fluxo-fornecedor.js` / `scripts/admin/admin-main.js` | 10 | Pré-romaneio / Garantia / Admin |
| `folha_pagamento/folha-lancamentos.js` | 9 | Folha |
| `romaneio-manager.js` / `client-html-fixes.js` / `company.html` / `romaneiotora-import*.js` | 8 | Romaneios / Cliente / Empresa / Import |

## 3. As 6 famílias toast (inconsistência central)

| # | Implementação | Onde | Container/posição | Cores | Ícone/título/fechar | Problema |
|---|---|---|---|---|---|---|
| T1 | `modules/core/toast.js` (`toast` + `window.__toast` + **override `window.alert`**) | importado só por `admin/company/index/login/romaneiotora.html` | `__toast_container__`, top-right | hex hardcoded | × sim, sem ícone/título | **só 5 páginas recebem o override**; `error` com `duration: 0` gruda para sempre |
| T2 | `ToastManager` (**duplicado** em `compras.js:46` e `vendas.js:10710`) | vendas/compras/cadastros (`toast.success` em `client/fornecedor/species/compras/vendas.html`) | `toastContainer` | `var(--sw-*)` 4 cores | fa-ícone + título + ×, `escapeHtml` | cópia duplicada (drift); chamadas com guard `typeof` falham silenciosas |
| T3 | `AdminUI.toast` + `AdminUI.confirm` (`scripts/admin/admin-ui.js:91,175`) | admin | `admin-toast-container` | próprio | modal confirm Promise | **padrão-referência**, mas restrito ao admin + fallback `confirm()` nativo |
| T4 | `UtilsTL.showToast` → `window.showToast` (`modules/core/utils.js:381,454`) | modais romaneio (`showSuccess/showError` com fallback `alert('Sucesso: '+msg)`) | `toast-container`, top-right | `warning`/`info` caem p/ `--sw-brand` | sem ícone | **sem amarelo/azul**; fallback nativo se `window.Utils` ausente |
| T5 | `showToast` copiado em `js/client.js:678`, `js/fornecedor.js:812`, `js/species.js:585` | cadastros | exige `#toast-container` no HTML | classe CSS da página | sem fechar dedicado | **fallback `alert(message)` se div ausente** |
| T6 | `FolhaUtils.showToast` (`folha_pagamento/folha-utils.js:288`) | folha | `toast-container-folha`, **bottom-right** (único) | próprio | — | posição divergente; `menu-component.js:300` depende dele p/ logout |

Agravante: `menu-component.js` (presente em todas as páginas) chama `window.__toast`
(PWA/update/logout), mas `__toast` só existe onde T1 foi importado → avisos
perdidos silenciosamente na maioria das telas.

> **Adendo Onda A:** existe ainda uma 7ª família, `src/components/ui/notifications.js`
> (`NotificationSystem` ESM com `stateManager`/`EVENT_TYPES`, aparentemente legado
> de scaffold antigo) — mapear uso real na Onda B e consolidar ou remover.

## 4. Amostra classificada

SUCESSO→`toast.success`: 'Cliente salvo com sucesso!', 'Pedido de compra salvo.',
'MDF-e autorizado com sucesso!', 'Rascunho salvo com sucesso!',
'Pagamento aprovado com sucesso!', 'Espécie cadastrada com sucesso!',
'Carregados N itens do romaneio.'
AVISO→`toast.warning`: 'Informe a espécie.', 'Selecione um romaneio primeiro.',
'Informe a plaqueta.', 'Já existe uma tora com esta plaqueta…',
'Adicione ao menos um item ao pedido antes de salvar.',
'É necessário adicionar pelo menos um documento fiscal',
'Selecione o arquivo .pfx/.p12'.
ERRO→`toast.error`: 'Erro ao salvar cliente…', 'Falha ao salvar/excluir pedido.',
'Não foi possível salvar o MDF-e: …', 'Erro ao gerar backup.',
'Tenant não identificado', 'Sessão autenticada não encontrada.'
INFO→`toast.info`: 'Fornecedor selecionado para o pedido.',
'Item adicionado ao pedido.', 'Reconciliação concluída (processados=…)'.
Mensagens inline (manter padrão, só uniformizar CSS): `.error-message`
(`login.html` 4, `admin-settings.html` 3+gerador), `.par-field-error` +
`#parFormMsg` (`cadastro-parceiro.html` — referência de inline por campo).

## 5. `confirm(` que devem virar modal (100 prod)

Destrutivos: excluir pedido/produto/cliente/pagamento/conta
(`vendas.js:4076,5835,6177`, `compras.js:1252,1291,4760`, `financas.js:6969,7360`),
estorno (`estoque_produtos.js:2641`, `estoque.js:4542,5470,6290`),
limpar itens/carrinho (`estoque.js:3504`, `vendas.js:9344`, `compras.js:6722`),
apagar TODOS os dados financeiros — duplo confirm (`financas.js:8334,8340`),
excluir usuário permanente/arquivar cupom/Sentry (`admin-main.js:4238,4338,4786,6178`),
remover anexo/comprovante (`financas.js:1876,5945`).
Escolha (vira modal não-destrutivo): manter anexos ao regerar parcelas
(`financas.js:4343`), cancelar com dados perdidos (`compras.js:1353`).
Movimentação baixa estoque (`estoque_produtos.js:1850`) e edição SuperAdmin
(`admin-main.js:4012`) também viram modal (risco operacional).

## 6. Achados UX/redação

1. Erro gruda (T1 `duration 0`) — trocar por 6s + fechar.
2. Mensagens técnicas cruas: 'Tenant não identificado', 'Erro SQL/500',
`error.message` do backend, 'Falha ao…' sem ação recomendada.
3. Duplo `confirm` financeiro + `confirm` sem menção de reversibilidade em
'Limpar carrinho' vs texto exemplar em `estoque.js:6290` ('Não devolve toras — use Estornar').
4. `alert` com `\n` e emoji (`admin-settings.js:2024`, `financas.js:8272+`) quebra layout toast de 1 linha (T1 ellipsis).
5. `standardized-client-modal.js:2027,2111,2429` usa modal informativo como
fallback — avaliar virar toast info.
6. `romaneiotora_modais.js:102` sanitiza `window.alert` (XSS) — manter a
preocupação no serviço único (`escapeHtml`/`textContent`).

## 7. Arquitetura proposta (FASES 2–7)

`js/notification-service.js` (script clássico, sem ESM, carregado em todas as
páginas via `menu-component.js` ou include direto):
`NotificationService.success|warning|error|info(msg, opts)` +
`confirmDialog({title, message, confirmLabel, danger}) → Promise<boolean>`.
Container único `#sw-toast-container` top-right (mobile: full-width bottom),
cores só `var(--sw-*)`, fa-ícones, título opcional, × sempre, dedupe 500ms,
durações success 3s / info 3s / warning 4s / error 6s, `aria-live=polite`,
`textContent` (XSS-safe). T2/T4/T5/T6 delegam; T1 perde o override após migração
(manter como rede até FASE 6). `AdminUI.confirm` delega ao `confirmDialog`.
Trava: `tests/notification-service-standard.test.mjs` falha em `alert(`/`confirm(`
fora de allowlist por onda; regra ESLint `no-alert` ao final.

## 8. Ordem de correção

Onda A: serviço + CSS + T5/T4 (cadastros/modais, menor risco, maior volume de fallback).
Onda B: T2 (unificar `ToastManager` duplicado; vendas/compras).
Onda C: top offenders `estoque.js` (59) + fiscal (72) por categoria §4.
Onda D: romaneios HTML/modais + admin + folha (T6 posição).
Onda E: 100 `confirm(` → `confirmDialog` (destrutivos primeiro).
Onda F: remover override T1, lint `no-alert`, validação final + traces.

## 10. Andamento das ondas

- [x] **Onda A** (`06d5ec4` + `d792c00`): `js/notification-service.js` global via
      `menu-component.js`; T5/T4 delegam sem fallback nativo; trava 13/13; deploy OK.
- [x] **Onda B** (`85ba045` + remoção): `ToastManager` de `compras.js`/`vendas.js`
      delega `show` ao serviço (assinaturas, `window.ToastManager`,
      `window.mostrarToast` e `close()` preservados); 7ª família
      `src/components/ui/notifications.js` **removida** (código morto: só
      `src/app.js` importava, nenhum HTML carrega `src/app.js`; teste
      `global-first-wave` agora cobre o serviço); smoke vendas+compras OK.
- [ ] Onda C: redirect global + micro-correções (concluído abaixo).
- [ ] Onda D: romaneios HTML/modais + admin + folha (T6 posição).
- [ ] Onda E: 100 `confirm(` → `confirmDialog` (destrutivos primeiro).
- [ ] Onda F: limpeza source-level dos `alert(` (viram chamadas explícitas),
      lint `no-alert`, validação final + traces.

## 11. Onda C — redirect global (2026-10-10)
Decisão arquitetural: em vez de 131 edições manuais (alto risco de typo em
código fiscal/estoque), o `NotificationService` instala redirect único
`window.alert` → `show()` com classificador (`__classifyAlertMessage`, ordem
erro > sucesso > aviso > info), cobrindo os **579 alerts em runtime** com tipos
validados por 28 casos na trava (incl. armadilhas: 'Não foi possível salvar' →
error; 'cancelada com sucesso' → success; 'ainda não carregada' → warning vs
'não carregada' → error; '⚠️ Tenant…' → error; 'carregado para edição' → info).
Micro-correção explícita: typo `histórico.}` em `estoque.js:4500`. Smoke:
estoque/mdf-e/notas, 3 cores exatas dos tokens, zero dialogs nativos.
Débito Onda F: trocar os `alert(` no fonte por chamadas explícitas tipadas.

Correção de levantamento: os matches `toast.success|error` em `client.html`,
`fornecedor.html`, `species.html`, `compras.html`, `vendas.html` eram **seletores
CSS** (`.toast.success`), não chamadas JS — únicos consumidores da API toast são
`ToastManager`, `showToast`/`Utils`/`FolhaUtils`/`AdminUI` e `__toast`.

## 9. Checklist implementação

- [ ] `js/notification-service.js` + CSS tokens + include global
- [x] T5/T4/T6/T2 delegando (zero fallback `alert`)
- [x] Teste trava + `npm run lint/typecheck/test` verdes
- [x] `?v=` + SW bump + commit por onda + deploy + Ctrl+F5
- [ ] Onda E: `confirmDialog` (destrutivo = botão vermelho + menção reversão)
- [ ] Reescritas amigáveis §6.2 (§6.4 multilinha)
- [ ] Registrar não-conformidades novas como débito arquitetural

## 12. Onda D — folha + admin (2026-10-10)

- `FolhaUtils.showToast` delega (assinatura preservada) — toast da folha sai do
  bottom-right próprio e assume o padrão top-right do sistema.
- `AdminUI.toast` e `AdminUI.confirm` delegam ao serviço (`confirmDialog`,
  mesma API `Promise<boolean>`; modal legado congelado como fallback).
- Constatado: helpers de romaneio (`__preModalNotify`, `__almNotify`,
  `showSuccess/showError`, notify de `preromaneio.js`) já caem no serviço via
  `__toast`/T4 — nenhum edit necessário (fallbacks `alert` terminais só disparam
  sem menu, onde o redirect também estaria ausente).
- Smoke: folha unificada no topo + admin toast/confirm OK, zero erros.
