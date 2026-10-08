# Backlog: refinamentos tema light/dark (base C:\Sisweb, pós-Fase 20)

## Status
Em dia — 07/10 revisão @page sistema-wide (gates verdes: lint+typecheck OK, 765 testes 765/0/1).
Em dia — 07/10 onda 2 impressão (wrap estoque + anywhere PES + guard BH + ?v= resync; gates verdes: lint+typecheck OK, 765 testes 765/0/1).
Em dia — 07/10 onda 3 folha FolhaDB + company fallback (gates verdes: lint+typecheck OK, 766 testes 766/0/1).
Em dia — 07/10 onda 4 equipe paralela: bump SW + barra BH (gates verdes: lint+typecheck OK, 766 testes 766/0/1).
Em dia — 07/10 onda 5 strangler PCT + publish (gates verdes: lint+typecheck OK, 767 testes 767/0/1; commit c81a423 + deploy hosting verificado via fetch).
Em dia — 07/10 onda 6 trap-silence + pendências 14/10 (gates verdes: lint+typecheck OK, 769 testes 769/0/1).
Em dia — 07/10 onda 7 orientação folha: barra única + Layout nativo no portrait (gates verdes: lint+typecheck OK, 770 testes 770/0/1; publish verificado via fetch).
Em dia — 07/10 onda 8 seletores de orientação removidos (auto por tipo; gates verdes: lint+typecheck OK, 770 testes 770/0/1).
Em dia — 07/10 onda 9 varredura mobile ponta a ponta (gates verdes: lint+typecheck OK, 770 testes 770/0/1; publish verificado via fetch).
Em dia — 07/10 onda 10 preview 393px real: recibo empilhado (gates verdes: lint+typecheck OK, 770 testes 770/0/1).
Em dia — 07/10 onda 11 previews 393px produção: header empilhado + scroll contido (gates verdes: lint+typecheck OK, 770 testes 770/0/1; publish verificado via fetch).
Em dia — 28/09 Fase 25.5 (gates verdes: lint+typecheck OK, 676 testes 676/0/1).
Em dia — 04/10 thead marca no estoque (gates verdes: lint+typecheck OK, 727 testes 727/0/1).
Em dia — 06/10 continuação Antigravity ceecf69f (gates verdes: lint+typecheck OK, 756 testes 756/0/1).

## 06/10 — continuação da conversa Antigravity ceecf69f (prints reais + mockups ajuda)
- Contexto: conversa parou em 04/10 13:52 com `429 RESOURCE_EXHAUSTED` após gerar
  os mockups; faltavam integração final, revisão e gates. Inventário em
  `C:\Users\Nelson\.gemini\antigravity\conversations\ceecf69f-*.db` (406 steps).
- [x] `ajuda.js` reescrito p/ prints reais + mockups desktop/mobile
  (`HELP_VERSION 2026-10-06-manual-prints-reais-mockups`); menção
  `Lista de Pedidos` restaurada (contrato `ajuda-manual-ilustrado.test.mjs`).
- [x] `subscription.html`: 8 figuras migradas p/ `mockups/desktop|mobile` com
  `data-guide-fallback` p/ prints `-1.png`.
- [x] `landing-vendas.css`: vitrine real com hover elevado + grid mobile 2-col.
- [x] `firebase.json`: ignore `**/*.py`, `**/*.pyc`, `**/__pycache__/**`
  (scripts de captura fora do deploy).
- [x] Credenciais de teste removidas de `gerar_mockups.py` e
  `scripts/capturar_prints_reais_ajuda.py` → `SISWEB_TEST_EMAIL/PASSWORD`
  via env (com guarda sem-login); `logs.md` revertido (ruído local).
- [x] Gates: `npm run lint` OK, `npm run typecheck` OK,
  `npm test` 756 pass / 0 fail / 1 skip.
- [ ] Pendente do usuário: `publish` (build+deploy) + `push`; validar telas após Ctrl+F5.
- [x] 06/10 (cont.) — hero `landing-vendas`: device frames premium no carrossel
  (bezel black-piano com rim da marca, vidro, tilt 3D com settle no hover,
  suporte em alumínio + sombra de chão, glow ambiente, float suave com
  `prefers-reduced-motion` e fallback estático no mobile; `neck/base` agora
  existem no HTML). Screenshot local validado, suíte 756/0/1.
- [x] 06/10 (cont.2) — `landing-vendas` hero/topbar (pedido usuário via
  localhost:5500): removido selo `CAPTURA REAL` dos carrosséis; hero desktop
  ampliado/centralizado (stage 800px, monitor 720px); topbar mobile virou
  sidebar (hamburger + drawer + backdrop, fecha em link/Escape/fora; mesma
  lógica em `landing-vendas.js:initTopbarMenu`); hero mobile empilhado e
  centralizado; controles do carrossel sobrepostos à tela (sem "queixo");
  breakpoint do nav 1430→1560 (overflow comprovado a 1440px); `?v=` dos assets
  ressincronizado. Corrigido `</div>` extra da inserção do suporte (phone
  havia saído do stage). Screenshots 1440px/390px validados, gates verdes
  (lint+typecheck OK, 756/0/1).
- [x] 06/10 (cont.3) — execução do prompt enterprise (auditoria 5 breakpoints):
  zero overflow real e zero erros JS em 390/768/1024/1440/1920 (só skip-link
  e drawer off-canvas, ambos intencionais); seções vitrine/simulador/diagrama/
  cupons/parceiros aprovadas sem alteração; copy congelado. Fixes aplicados:
  topbar ≥1561 sem overlap (container 1440px + compactação), hero ultrawide
  contido (container 1280/stage 880/monitor 800 ≥1600px), legenda com respiro
  dos controles + sombra de texto. `?v=` ressincronizado (script + manual).
  Gates verdes (lint+typecheck OK, 756/0/1).
- [x] 06/10 (cont.4) — sidebar com marca + renders premium dos devices:
  drawer ganhou cabeçalho com logo+nome (só mobile); gerador
  `scripts/gerar_hero_devices.py` compõe 6 PNGs (monitor alumínio + iPhone
  titânio, fundo transparente, screenshots reais) em
  `assets/help-manual/mockups/hero/`; carrossel do hero usa os renders
  (molduras CSS removidas só no hero, mecânica/autoplay/swipe intactos,
  carrossel com efeito preservado); legenda do phone oculta no mobile via
  visually-hidden. Corrigido bug PIL (`paste` c/ mask apagava alfa do vidro).
  3 testes `partner-program` atualizados p/ novo contrato + allowlist.
  Screenshots 1440/390 validados, gates verdes (lint+typecheck OK, 756/0/1).
- [x] 06/10 (cont.5) — hero sem textos + cantos suavizados: legendas dos 2
  carrosséis removidas do visual (`display:none`, sem teste dependente);
  sombras dos PNGs refeitas (halo 0.42→0.22, blur menor, filetes 90→45) +
  `drop-shadow` CSS atenuado; `?v=` ressincronizado. Screenshots 1440/390
  validados, gates verdes (lint+typecheck OK, 756/0/1).
- [x] 06/10 (cont.6) — fundo atrás dos devices eliminado: devices flutuam
  direto sobre o fundo da página (glow do palco + `drop-shadow` CSS + sombras
  assadas nos PNGs removidos; canvas aparado); botões do carrossel mobile
  descolados do mockup (restava `position:absolute` legado — forçado fluxo
  estático no hero, 12px de respiro comprovado por medição). `?v=`
  ressincronizado. Screenshots 1440/390 validados, gates verdes
  (lint+typecheck OK, 756/0/1).
- [x] 06/10 (cont.8) — hero 100% dark com capturas reais do usuário:
  importadas `dektop1` (dashboard 146/R$ 282.600,13/R$ 407.199,30) e `dektop7`
  (estoque) p/ `assets/help-manual/dark/` (fora do deploy, allowlist);
  capturadas as 4 faltantes via Playwright c/ conta de teste + tema escuro
  (vendas desktop, dashboard/estoque/vendas mobile); descartado modal vazio
  ("Nenhum pedido encontrado" não vai para vitrine comercial); gerador
  apontado p/ fontes dark, 6 renders refeitos. Screenshots 1440/390 validados,
  gates verdes (lint+typecheck OK, 756/0/1). Nota: PNGs trocaram sob mesma
  URL — validar com Ctrl+F5.
- [x] 06/10 (cont.9) — cards padronizados + diagrama com 14 módulos: CTAs
  e pills com mesma métrica (`flex:1`, centralizados; CTA full-width e pills
  em pilha uniforme no mobile), hover in/out com easing da marca + press
  `scale(.98)`, hover dark com `var(--sw-brand)`; diagrama 8→14 satélites
  (Dashboard, TL, PCT, Pés, Pré-romaneio, Empresa + existentes) c/ setas
  radiais recalculadas e TOOLTIPS novos no JS (data-driven, teclado intacto).
  Screenshots 1440/390 + hover/focus validados, gates verdes (lint+typecheck
  OK, 756/0/1).
- [x] 06/10 (cont.7) — execução dos prompts refeitos (mockups do zero):
  6 renders refeitos na spec final (fundo transparente, sem sombra assada,
  prints reais, tokens da marca, sem trademarks/URLs fake); float movido dos
  wrappers p/ imagem do slide ativo (alvos de clique estáveis — Playwright
  validou cliques nos 2 carrosséis, slide 1→2 com efeito preservado).
  `?v=` ressincronizado. Screenshots 1440/390 validados, gates verdes
  (lint+typecheck OK, 756/0/1).
- [x] 06/10 (cont.9) — cards/diagrama refeitos + recuperação de encoding:
  reescrita via PS corrompeu `landing-vendas.html` (BOM+CRLF+mojibake);
  restaurado do HEAD e reaplicadas as 7 edições via edit tool (diff final
  29+/16-, verificado byte a byte). NUNCA reescrever arquivos via cmdlets
  de texto do PS 5.1. Servidor :5500 próprio no ar p/ teste. Gates verdes
  (lint+typecheck OK, 759 testes 758/0/1 — +2 por nós novos no diagrama).
  `hosting-files.json`, `gerar_mockups.py`,
  `scripts/capturar_prints_reais_ajuda.py`, `assets/help-manual/*-1.png`,
  `assets/help-manual/mockups/desktop|mobile/*`, `assets/mockup_*_template.png`.

## 04/10 — thead marinho fantasma no estoque (resolvido, validado pelo usuário)
- [x] Forense no browser: `backgroundImage` chegava como
      `linear-gradient(135deg, #2c3e50→#34495e)` hardcoded de stylesheet obsoleto
      em cache; vars saudáveis (`--primary-color #fe6a00`), sem poisoning de tema.
- [x] Regra thead ancorada em ID `(1,1,2)` + `!important` + posição após os `<link>`
      (`estoque.html`): cobre `#tabelaEntrada/SaidaToras/Estoque/Movimentacoes/
      Produtos/TorasDisponiveis`, `#rastreabilidadeModal table` (ID está no modal,
      não na tabela), `table.saida-plaqueta-results-table` (sem classe `.table`),
      fallback `table[id^="tabela"]` + `.table thead th`; variante `sticky-actions`.
- [x] Lock das abas `.tabs .tab/.active/:hover` nos tokens com `!important`
      (mesma vulnerabilidade ao stale, sem mudar layout).
- [x] `?v=` por hash de conteúdo nos 4 CSS com versão estática em `estoque.html`
      (commerce `41ca2775b90e`, tokens `48ded6f95e02`, shell `c1329199a1c6`,
      content `db8b0cf45fdc`) — invalida cache HTTP + SW de uma vez.
- [x] Telemetria `theme-check` do thead no boot (prova do CSS aplicado).
- [x] Commits `467a494`, `75f3788`, `c49edd9`, `ab8cd81`, `0a3f842` + publish
      produção (verificado via fetch: regra ID e `?v=` novos no ar).

## 04/10 (cont.) — blindagem geral anti-stale
- [x] Mesmo padrão ID-ancorado em `vendas.html` (IDs + `table.table.commerce-*`)
      e `compras.html` (upgrade da regra sem `!important`).
- [x] `scripts/sync-css-cachebusters.mjs`: 95 `?v=` estáticos → hash de conteúdo
      em 27 páginas (fora: `backup/`, `subscription.html` — trabalho paralelo).
      Commit `54d7d72` + publish (verificado via fetch em vendas/compras).
- [x] SW mantido em `staleWhileRevalidate` para CSS: agora seguro (URL muda com
      o conteúdo); JS crítico de auth já era `networkFirst`. Migração de `?v=`
      de JS fica como trabalho futuro.
- [x] Telemetria `theme-check` mantida (1 log/boot; valor diagnóstico provado).
- [ ] Aguardando usuário: limpeza de espécies-lixo em Gerenciar Espécies.
- [ ] Aguardando antigravity: `tmp/redesign-*.json` (~40MB) — avaliar ao término
      e atualizar artefatos.
- [ ] Soak A4: remoção física dos globais após 09/10 (`docs/legacy-removal-gate.md`).

## 04–05/10 — sessão vendas/estoque/romaneios (resumo operacional)
- [x] thead marca anti-stale (ID + `?v=` hash) + `sync-css-cachebusters.mjs` (CSS+JS, `--check/--resync`).
- [x] Produto romaneio em vendas: volume sem ×duplo, preview (refetch, sincronia, trava, delta), trava/lock igual pedidos, pecas 0 persiste, zerados ocultos, select-all mobile, renames, Voltar/Imprimir no relatório.
- [x] Baixa por unidade (UN/m³/ml/m²/DZ) + carrinho sempre em m³ com detalhe ("2 Peças", pack PC, inferência).
- [x] Estoque ponto-único na aprovação (deduz ao entrar, reverte ao sair; manual incluso).
- [x] Nº display sequencial TL/PCT/PES/Tora (id intacto) + backfill 183 regs (`migrar-numero-exibicao-romaneios.cjs`).
- [x] Pré-romaneio excluir persiste (multi-chave, fail-closed, limpa espelho).
- [x] Varreduras: deletes fail-closed (PCT/TL/fornecedor/vendas/nf/cliente/compras), loading+travas (saves Tora/PCT/TL/pedidos, delete, impressão), dual-fetch paralelo, debounce, lote saveData, rollback delete corrigido.
- [ ] Aguardando usuário: espécies-lixo; validar telas após Ctrl+F5.
- [ ] Aguardando antigravity: `tmp/redesign-*.json`.
- [ ] Soak A4 pós-09/10.
- [ ] Futuro (baixo retorno/risco): skeleton em selects, alert→toast PCT, whole-list→granular, onValue sem off, `ADMIN_ASSET_VERSION` dinâmica.
- [x] Impressão financeira: colunas texto quebram + larguras por coluna; `@page` sem `size` (Layout Retrato/Paisagem de volta); helper compartilhado sem `size` + 257mm em landscape; parse de data com cache + `tsHoje` memo + build em chunks (anti-20s).

## PENDENTE P/ NOVA SESSÃO (invocar literalmente)
> Orquestrar uma equipe de especialistas para revisar todos as impressões do sistema em todas as paginas e módulos e modais de todo o sistema para aplicar estas correções desta mesma forma pontual, e sem falhas, e sem equívocos, sem quebrar o que já esta funcionado corretamente.
Escopo da revisão: `@page size` remanescente (print-styles.css, src/services/printService.js, romaneiotora.html size:landscape forçado), teto de largura por orientação, colunas nowrap vs wrap + colgroup, build síncrono gigante (chunks), placeholder Voltar/Imprimir padrão, ?v= dos assets de impressão.

## 07/10 — execução PENDENTE (revisão @page sistema-wide, pontual sem regressão)
- [x] Inventário via subagente explore: núcleo (`print-styles.css`, `printService.js` morto, `commerce-pdf-share.js`), romaneios TL/Tora/PCT/PES, vendas/compras, finanças, estoque (preview modal+iframe), folha (motor próprio), company/NF/MDF.
- [x] Padrão financeiro já canônico em `commerce-pdf-share.js:376` (`@page{margin}` sem size + landscape 257mm) e `financas.js:8083` — replicado pontualmente, sem tocar em motores funcionais.
- [x] Correções aplicadas (só CSS @page, zero lógica): `print-styles.css:1588` `size:A4` removido + cap landscape 257mm; `romaneiotora.html:983` `size:landscape` → `margin:8mm`; `src/services/printService.js:605` `size:${paperSize}` → `margin:1cm`.
- [x] Fora de escopo preservado: `estoque.js` @page dinâmico do preview Retrato/Paisagem, folha 2º motor com orientação própria, BH one-liners, builds gigantes/chunks, nowrap/wrap por coluna — alto risco/baixo retorno, ficam p/ próxima onda.
- [x] `sync-css-cachebusters --check` = 0; gates verdes (lint+typecheck OK, 765/0/1).
- [ ] Restante próxima onda: colgroup/wrap por módulo, chunk em builds gigantes (vendas/compras/romaneios/PES), placeholder Voltar/Imprimir onde falta (BH/NF), ?v= assets impressão.

## 07/10 — onda 2 (wrap/anywhere/guard BH/?v=, pontual sem regressão)
- [x] Auditoria via subagente explore: wrap/colgroup por motor, builds gigantes (síncrono vs chunks), Voltar/Imprimir faltantes, ?v= assets impressão.
- [x] `estoque.js:obterRelatorioStylesImpressao` — aditivo: `td{overflow-wrap:anywhere}` + util `.num/.nowrap` (texto quebra, numéricos intactos) + cap landscape 257mm; `table-layout` preservado (sem shift de layout).
- [x] `romaneiopes.html:5017` — aditivo: `overflow-wrap:anywhere !important` ao lado do `break-word` existente (CONAMA/dims).
- [x] `folha_pagamento/banco-horas-ui.js:1374,1418,1479` — guarda anti-popup fail-closed (toast + return, padrão finanças/vendas); 1547 já tinha guarda.
- [x] Preservado: `romaneiotora_modais.js` btn-print (já `no-print`, janela própria — sem mudança visual); builds gigantes/chunks (PCT/estoque/vendas) e colgroup por coluna — próxima onda dedicada.
- [x] `sync-css-cachebusters --resync`: 8 trocas ?v=-only (estoque.js + print-styles.css da onda 1 que estava stale); diff verificado.
- [x] Gates verdes (lint+typecheck OK, 765/0/1).

## 07/10 — onda 3 (warnings legacy-deprecation da folha + fallback company)
- [x] Causa dos warns: `folha-firebase-manager.js` sobrescrevia `window.getData/saveData` (2 warns) + fallbacks `swGet`/`typeof` liam o global com armadilha (3 warns). Armadilha é Fase A4 warn-by-design; a cura é migrar o consumidor.
- [x] Migração `window.FolhaDB` (mesma semântica do manager, zero disputa de global): namespace `{getData, saveData, setupListener, getManager}` no manager; swGet (main+relatorios) com fallback FolhaDB; 8 guards de capacidade migrados (funcionarios/lancamentos/relatorios/BH-relatorios); 14 chamadas migradas.
- [x] Verificado: só `folha.html` carrega o manager; `menu/commerce/theme/diagnostics` não usam os globais — sem impacto fora da folha.
- [x] Testes: novo `folha usa namespace FolhaDB e nao disputa os globais legados` (trava 15 arquivos); contrato `folha edit keeps identity` atualizado p/ `FolhaDB.saveData`; inventário `sisweb-data` segue verde (13 definidores ≥ 8).
- [x] Impressão restante: fallback `company.html:1804` ganhou `@page{margin}` + tabela com wrap (só fallback; canônico já usa helper). Chunks PCT/estoque e colgroup por coluna: adiados (risco/regressão alto, tabelas pequenas — sem caso de 20s como finanças).
- [x] `?v=` resync em `folha.html` (5 trocas, diff verificado); gates verdes (lint+typecheck OK, 766/0/1).
- [ ] Validar em produção após publish: console da folha sem warns `[Sisweb][deprecated]` (Ctrl+F5).

## 07/10 — onda 4 (equipe paralela A+B+C)
- [x] Equipe A (publish readiness): `sw.js` precisava bump (mudanças visuais pós-30/09); hosting-files OK; `--check` 0; onda 1-3 separada do paralelo (landing/ajuda/assets não vão junto).
- [x] Bump SW `2026-09-30-tl-dropdown-fora` → `2026-10-07-onda3-folhadb-print` (`sw.js`, `menu-component.js`, 9 asserts em 6 testes); `?v=` resync 26 arquivos (menu-component, diff ?v=-only verificado).
- [x] Equipe B (strangler): `financas.js` é alvo falso (só bare functions por vazamento, 0 call sites internos, inventário nem detecta). Próximos alvos reais: `utils.js`/`data-functions.js` (pequenos, ~10-30 linhas).
- [x] Equipe C (onda 4 print): PCT/estoque sem caso-20s (ADIAR chunks); `nf-danfe` blob-PDF nada a fazer; EXECUTADO: helper `bhOpenPrintWindow(html)` em `banco-horas-ui.js` (barra Voltar/Imprimir padrão, nunca sai no papel) + 4 one-liners migrados (extrato/espelho/vencimentos/contrato).
- [x] Gates verdes (lint+typecheck OK, 766/0/1).

## 07/10 — onda 5 (strangler PCT data-functions/utils + commit + publish)
- [x] Achado: em `romaneiopct.html` o `data-functions.js` (sync localStorage) carregava antes e sobrescrevia o getData Firebase-first de `romaneiopct_funcoes.js` — disputa real com semântica incompatível.
- [x] `data-functions.js` em IIFE (`use strict`): só `check/cleanLocalStorageSpace` expostos; `cleanOldData` interno preservado. `utils.js`: fallbacks condicionais (com `typeof` que disparava a armadilha) viraram `window.LocalStore` incondicional.
- [x] Trava nova em `sisweb-data.test.mjs` (`pct nao disputa os globais legados`); inventário segue verde (12 definidores ≥ 8).
- [x] `?v=` resync em `romaneiopct.html` (2 trocas); gates verdes (lint+typecheck OK, 767/0/1).
- [x] Commit `c81a423` (44 arquivos só das ondas, paralelo landing/ajuda/assets fora) + push + `deploy:hosting` OK (538 arquivos).
- [x] Produção verificada via fetch: `sw.js` com `2026-10-07-onda3-folhadb-print`, `romaneiopct.html` com `?v=` novos, `folha.html` com `?v=` novos, manager servido com `window.FolhaDB` e sem `window.getData =`, `print-styles.css` com `@page` sem size.
- [ ] Validar com Ctrl+F5 (requer login): console folha/PCT sem `[Sisweb][deprecated]`; diálogo de impressão com Retrato/Paisagem; barra Voltar nos 4 relatórios BH; toast `SISWEB_PWA_UPDATED`.

## 07/10 — onda 6 (prova runtime trap-silence + pendências 14/10)
- [x] Sem credenciais de teste no env (`SISWEB_TEST_EMAIL/PASSWORD` ausentes) — validação com login bloqueada; executado o máximo sem login.
- [x] Simulação runtime (trap A4 + `data-functions`/`utils`/manager em sandbox VM): `warns=0, reads=0, overwrites=0`, `FolhaDB`/`LocalStore`/`cleanOldData` expostos, roundtrip `species→especies` OK.
- [x] Promovido a `tests/trap-silence.test.mjs` (2 testes; ajuste cross-realm via `JSON.stringify`); gates verdes (lint+typecheck OK, 769/0/1).
- [ ] Sem deploy (só `tests/` + story, fora do hosting).

## PENDÊNCIAS P/ 14/10 (7 dias — invocar literalmente)
> Verificar o gate de remoção dos legados (`docs/legacy-removal-gate.md`): `__siswebLegacy.stats()` zerado por 7 dias nas 8 páginas com trap; então decidir remoção dos globais + limpeza de espécies-lixo em Gerenciar Espécies + destino de `tmp/redesign-*.json` (~40MB, avaliar término do antigravity).
- [ ] Soak A4: dia 0 em 07/10 (publish onda 5 no ar) → gate avaliável a partir de 14/10.
- [ ] Espécies-lixo: aguardando usuário desde 04/10.
- [ ] `tmp/redesign-*.json`: aguardando término do antigravity.

## 07/10 — onda 7 (orientação de impressão da folha: análise equipe A+B+C + correções)
- [x] Veredito sobre a hipótese: seletor `Orientação de Impressão/PDF` + botões Retrato/Paisagem NÃO são redundantes — comandam preview em tela (210/297mm, --fs, pageWidthPx 793/1122), defaults por tipo e orientação inicial. Só deixam de ser autoridade final.
- [x] DUP real na captura: 2 barras empilhadas no caminho genérico (`folha-print-back` clara + `print-control-bar` escura). Fix: clara só no recibo (genérico usa a escura com Fechar+Imprimir+orientação).
- [x] Layout nativo onde é seguro: `omitSize` quando orientation resolved = portrait (recibo já omitia; landscape largo mantém size forçado — fidelidade, sem corte silencioso). Inclui `trocarOrientacao` styleTag (size só no landscape; tela intacta).
- [x] Preservado: `exportarPDF` com size forçado (auto-print sem diálogo), provisão (`5572/5576`) e resumo compacto (`6901`, teste `company-logo-storage-policy:280` intacto), seletor + botões + preview.
- [x] Trava nova (`romaneio-print-mobile-blank`, `Folha impressao: barra unica + Layout nativo no portrait`); `?v=` resync em `folha.html`; gates verdes (lint+typecheck OK, 770/0/1).
- [ ] Validar com Ctrl+F5 (requer login): genérico com 1 barra; portrait com Layout editável no diálogo; landscape largo segue forçado; provisão de férias igual à captura mas sem DUP.

## 07/10 — onda 8 (seletores `Orientação de Impressão` removidos do modal)
- [x] Confirmado seguro: ambos os leitores são null-safe (`|| 'auto'` → default por tipo / heurística de colunas). Sem o campo, orientação é 100% automática.
- [x] Removidos `relatorioOrientacaoImpressao` (Gerar Relatórios) e `resumoOrientacaoImpressao` (Resumo Compacto). Override manual: botões Retrato/Paisagem do preview + Layout nativo do diálogo.
- [x] Travas atualizadas (ausência dos `id=` + `getRelatorioDefaultOrientation` presente); gates verdes (lint+typecheck OK, 770/0/1).

## 07/10 — onda 9 (varredura mobile ponta a ponta, 4 equipes)
- [x] Equipe A (romaneios): PES 7/7 (referência); TL ok; PCT viewport tardio + print sem espera de imagens; Tora `display:none` <900px vazava p/ print estreito.
- [x] Equipe B (vendas/compras/company/MDF/NF): fallbacks imprimiam a TELA (`else window.print()`), sem viewport/guardas/fonts/wrap — padrão sistêmico corrigido nos 7 fallbacks.
- [x] Equipe C (finanças/estoque): finanças ok (núcleo); estoque sem viewport no srcdoc, iframe sem fonts.ready, `.num` definido mas nunca aplicado.
- [x] Equipe D (folha/BH): genérico/recibo ok; `exportarPDF` forçava size (anulava omitSize) + sem guarda; BH sem viewport/@page/fonts-wait.
- [x] Fixes (3 frentes paralelas, sem sobreposição): fallbacks vendas/compras no padrão company/finanças; PDF respeita omitSize + guarda; BH com viewport/@page/fonts-ready; estoque viewport+fonts+`.num`; Tora revert print; PCT viewport no template. Finanças teto 257mm e Voltar `history.length` ficam p/ próxima (decisão UX).
- [x] Commit inclui ainda os 6 testes do bump SW que haviam ficado fora do commit anterior; gates verdes (lint+typecheck OK, 770/0/1).

## 07/10 — onda 10 (preview real 393px com login: recibo Proventos x Descontos)
- [x] Login com credenciais de teste (só sessão, nada gravado) + viewport iPhone 393px; modal Gerar Relatórios sem campo de orientação (remoção confirmada no ar).
- [x] Achado medido: tabelas lado a lado 161px, VALOR 42px, `R$ 2000,00` estourando (scrollWidth 193 > 161), th quebrando no meio da palavra.
- [x] Fix só-tela (`@media screen and (max-width:680px)` nos 2 blocos CSS do recibo): `.duas-colunas{flex-direction:column}` — papel intacto (A4 tem 794px+, query não casa no print).
- [x] Validado ao vivo no preview: 338px, 0 células estourando + screenshot; trava nova no teste fase-3; gates verdes (lint+typecheck OK, 770/0/1).

## 07/10 — onda 11 (previews 393px com dados reais de produção)
- [x] Login produção (somente leitura; nada alterado) + viewport 393px; varredura: Vendas (pedido 000145), TL (Marcelão), PCT, Tora.
- [x] Achados medidos: pedido — header grid 92/1fr/190 esmagava empresa (4px) + 7 células estourando (Produto 0px); TL — 252 células estourando + body 627px; PCT — colunas sobrepostas (124+271); Tora — 11.168 células estourando.
- [x] Fixes só-tela (`@media screen and (max-width:680px)`, papel intacto): helper compartilhado (header empilha 56px+1fr, meta em linha própria, table-layout auto, larguras inline liberadas); TL/Tora (header empilha + `.relatorio-container{overflow-x:auto}` + tabela `max-content`); PCT (header empilha + `.table-container,.resumo-container{overflow-x:auto}` + tabelas `max-content`).
- [x] Validado ao vivo nos 4 previews: 0 células estourando, body ≤427px, screenshots; trava nova `Mobile 393px: previews com header empilhado + scroll contido`; gates verdes (lint+typecheck OK, 770/0/1).

## 07/10 — onda 12 (Voltar com guarda history.length + teto 257mm finanças)
- Contexto: subagentes Task indisponíveis na sessão (acesso restrito) — orquestração
  via Orion com execução direta em fases, sem conflito de arquivos.
- [x] Voltar unificado (6 sites): `history.length>1 ? history.back() : window.close()`
  + retry com guarda (canônico `commerce-pdf-share.js:764` + injetor `ensurePrintAux:812`,
  `vendas.js` 2x, `compras.js`, `romaneio-manager.js`, `banco-horas-ui.js`). Padrão cego
  erradicado (0 ocorrências). Inline mantido de propósito (janelas são documentos
  próprios; `window.opener` seria frágil).
- [x] Teto 257mm: `financas.js:2669,8084` (`max-width:100%` incondicional) viraram cap
  landscape-scoped igual ao canônico (retrato intacto, preview WYSIWYG na paisagem).
- [x] Travas: 2 testes novos em `romaneio-print-mobile-blank` + contrato
  `financas-relatorios-exportacoes` atualizado p/ o cap (mudança intencional).
- [x] `?v=` resync (11 arquivos, só JSs da onda); `logs.md` revertido (ruído de teste).
- [x] SW bump `2026-10-07-onda3-folhadb-print` → `2026-10-08-onda12-voltar-teto`
  (`sw.js`, `menu-component.js`, 9 asserts em 6 testes) — JSs da onda no cache PWA.
- [x] Gates verdes (lint+typecheck OK, 774 testes 773/0/1).
- [x] Commit `6f46bee` (35 arquivos só da onda; landing/ajuda/assets paralelos fora)
  + push `aa2af3d..6f46bee` + `deploy:hosting` OK.
- [x] Produção verificada via fetch: SW `2026-10-08-onda12-voltar-teto`,
  `commerce-pdf-share.js` com guarda 3x e padrão cego 0x; login + vendas +
  finanças sem pageerrors (somente leitura, nada alterado).

## Onda 13 — fixes do log do usuário (08/10, `fixes-log1`)
Causa-raiz confirmada por sessão Playwright logada (somente leitura):
1. **PES não excluía (romaneiopes.html `deleteRomaneio`)**: apagava só pela
   chave `id` e recarregava cego — registros com chave real divergente
   (legados) sobreviviam e o fallback de localStorage ressuscitava o resto
   (Firebase `romaneios/pes` já estava vazio e a lista vinha do espelho local).
   Fix no padrão PCT: purga multi-chave (firebaseKey/key/id/numero) via
   `removeFromFirebase` (fallback `saveToFirebase-null`), fail-closed com
   alerta, purga dos espelhos `localStorage` + filtro da lista do modal.
2. **species "Nome não informado" indeletável**: era o nó de metadado da
   coleção `especies/_metadata` (`{lastUpdated, source}`) — o `normalize`
   o carimbava com o placeholder e o auto-clean nunca o alcançava. Fix:
   filtro de chaves `_metadata`/`metadata` em `js/species.js loadSpecies` +
   `species-manager.js normalizeList` (nada deletado do banco; só oculto).
3. **Compras/Produtos em modal + checkbox + Imprimir/Excluir** (paridade
   vendas "Madeira Serrada em Estoque"): `#produtosList` movida para o modal
   `#listaProdutosModal`, coluna checkbox + select-all (header/mobile),
   contadores, `imprimirRelatorioProdutosCompra` (builder `SiswebCommercePdf`
   + fallback) e `excluirProdutosSelecionadosCompra` (fail-closed via
   `persistProdutosCatalog`).
4. **Aba Pedido de Compras não abre mais o modal sozinha**: removido o
   `listarPedidos()` do `showTab('pedidos')` (paridade vendas: "sem abrir
   modais automaticamente"); pós-save/delete e retry de boot mantidos.
- [x] Travas: `tests/compras-listas-especies-pes-fixes.test.mjs` (5 testes).
- [x] Gates verdes (lint+typecheck OK, 779 testes 778/0/1).
- [x] `?v=` resync + SW `2026-10-08-fixes-log1`.

## Onda 13b — retorno do usuário species (08/10, `fixes-log2`)
Apuração com sessão logada (somente leitura + 1 ciclo criar→remover com
`SpeciesCRUD.remove`, restam 0, sem pageerrors):
- O delete de `especies/12` do log do usuário FUNCIONOU no Firebase (chave
  sumiu, 112 chaves restantes, zero linhas-fantasma com o JS novo). O "ainda
  continua" era a cascata lenta pós-delete (vários round-trips + resort de
  112 linhas com a linha ainda visível e só overlay de loading).
- Melhorias aplicadas em `js/species.js`: remoção otimista da linha logo após
  o confirm (+ recarga restauradora no catch, fail-closed mantido);
  auto-clean revivido (placeholder 'Nome não informado' conta como vazio) e
  fallback sem `normalizeList` usando os dados já filtrados.
- [x] Travas estendidas (7 testes) + gates verdes (780 testes 779/0/1).
- [x] `?v=` resync + SW `2026-10-08-fixes-log2`.

## Onda 14 — totais do ROMANEIO DE TORAS (08/10, `tora-print`)
Auditoria com render real dos 3 modos (Playwright, popup de impressão):
- Causa-raiz: `applyToraLayout` (`romaneio-print-config.js`) calculava
  `baseVisible = 3 + [rodo,comprimento,oco1,oco2]` — esquecia a Espécie
  (sempre visível). O label "Total:" caía para colspan 7 (era 8) e TODOS os
  totais deslocavam 1 coluna à esquerda, esvaziando a última (Valor).
  Fix: base 4 + configuráveis. Evidência: 14.664 sob "Oco 2", R$ 650 sob
  "Dif. %", "Valor" vazio.
- Título: 'M³ Líq.' → 'V. Francon' (relatório + resumo + config de colunas).
  Não existe coluna 'V. Franc.' em nenhum gerador (confirmado por busca +
  histórico); usuário optou por renomear M³ Líq.
- Total da coluna Preço: média aritmética → média ponderada por volume
  (Σvalor/Σvl, '-' se vl=0).
- [x] Travas: `tests/romaneio-tora-print-totals.test.mjs` (4 testes).
- [x] Gates verdes (lint+typecheck OK, 784 testes 783/0/1).
- [x] `?v=` resync + SW `2026-10-08-tora-print`.

## 04/10 (cont.2) — `?v=` de JS por hash (sem regressão)
- [x] Inventário: 296 pares `js?v=`; escopo real = 5 refs estáticas
      (`folha.html` document.write auth-diagnostics + commerce-pdf-share,
      `estoque.html`/`user-profile.html` import firebaseService,
      `portal-parceiro.html` src sisweb-theme) + 7 hashes obsoletos
      (firebase-init, romaneio-comum, layout-comum). Fora: `.codex-worktrees/`
      (duplicatas), `backup/`, `subscription.html`, dinâmicos via variável
      (`menu-component` Date.now/PWA, `ADMIN_ASSET_VERSION` hash-format).
- [x] `sync-css-cachebusters.mjs` cobre `src=` + `from`/`import()`; flags
      `--check`/`--resync`; pós-aplicação `--check --resync` = 0.
- [x] Deduplicação natural: mesmo arquivo → mesmo `?v=` em todas as páginas
      (firebaseService `7e1ef38a`, commerce-pdf-share `e6699735`, etc.).
- [x] Validação cruzada: hashes conferidos via `Get-FileHash` independente.
- [x] Gates verdes (lint+typecheck, 727 testes 727/0/1), commit `590051d`,
      publish verificado via fetch (estoque + romaneiopct).

## Fase 25.5 — modais de lista na marca + fix parcelas (28/09)
- [x] rlc-styles (footer, thead border, paginação completa) → tokens.
- [x] Ações dos 5 romaneios no padrão vendas (marca; excluir danger).
- [x] Neutros temáticos (secondary/limpar/back/close/disabled/modelo-excel).
- [x] Bug parcelas: flush de debounce no início dos salvarPedido (vendas+compras) + teste novo.
- [x] Bump SW `2026-09-28-tema-marca-fase25-5` + publish produção.

## P0 — quebra visível (dark)
- [x] `login.html:155` h3 MFA `color:#2c3e50` → var (auth.css não cobre `h3` nu).
- [x] `vendas.html:1183` + `compras.html:1118` `legend` `#2c3e50` → var (sem regra dark).
- [x] `h4` sem contraparte dark: `vendas.html:1214,1292`, `compras.html:1143,1151,1233`,
      `company.html:2340` (`#2c3e50`) → `var(--sw-text-1)` (h1/h2/h3 já têm).
- [x] `romaneio-manager.js:488-492` injetado `tbody td{color:#333;border:#eee}` (ID vence
      o tema) + `:475-486` `thead th{#2c3e50}` + `:519-526` `.modal-footer{#f8fafc}` →
      overrides `html[data-theme="dark"]` no template (padrão Fase 17).
- [x] `species-manager.js:2110-2147` filtros `background:#fff!important;color:#111827!important` →
      `var(--sw-input-bg)` / `var(--sw-text-1)` com `!important` no dark.
- [x] `estoque.html:190-196` `tr:active{background:#f8fafc!important}` → guarda dark.
- [x] `financas.html:1046-1049` `td[data-label=Selecionar]{background:#f8fafc!important}` → var.
- [x] `estoque.html:3202` box inline `#f8fafc/#475569` → surface/text vars.
- [x] `subscription-status.html:89-91` painel interno `linear-gradient(#eff6ff,#fff)` → surface.
- [x] `admin-settings.html:333,374,404,460` + `admin-subscriptions.html:383-384,412`
      `#f8fafc/#334155` → vars (admin sem cobertura content-theme).
- [x] `romaneiopct.html:1834,1875,2092` + `romaneio-comum.css:1040,1230` `color:#2c3e50!important`
      → contraparte `html[data-theme="dark"]`.

## P1 — drift de marca / sutilezas
- [x] `.modal-header{linear-gradient(#2c3e50,#34495e)}` (`financas.js:458,525`,
      `compras.html:1939`, `romaneio-manager.js:411-419`) → `var(--sw-gradient)`.
- [x] `user-profile.html:78,172,251,357` roxo `#667eea` no CLARO (dark já coberto) → marca.
- [x] Ilhas claras: `financas.html:1863` `#fff3cd`, `financas.js:5548` `#e3f2fd`,
      `financas.js:5908` `#f9f9f9` → `var(--sw-alert-*)`.
- [x] `login.html:154,275,290` + `ajudabitolas.html:122,306` slates secundários → vars.
- [x] `folha_pagamento/folha.html:1260-1277,305-326` botões/ícones debug → semantic vars.
- [x] Bordas claras: `species-manager.js:760,911`, `menu-component.js:1126`,
      `romaneio-manager.js:557,577` → `var(--sw-border)`.
- [x] `vendas.html:1216`, `compras.html:1144,1152` `border:#dee2e6` → `var(--sw-border)`.
- [x] `estoque.html:866,899,1132,1191` + `financas.html:743` confirmar cobertura por ID.

## P2 — higiene (sem quebra)
- [x] `index.html:398` h1 inline + `login.html:145` register inline (cobertos; remover).
- [x] Origens Fase 17: `species-manager.js:761,912,1852`, `romaneio-comum.css` cobertos.

## Restos do plano
- [x] Onda A: evidência modal Configurar Impressão; veredito labels Almoxarifado/h2;
      recontagem do crawler.
- [x] Onda C: toast system check.

## Disciplina de workflow (standing rules)
- [x] Todo asset referenciado: tracked + em `hosting-files.json` (lição marqueting/*.ico).
- [x] Bump SW (`sw.js` + `PWA_VERSION`) a cada publish com mudança visual.
- [x] Nunca reescrever arquivos via cmdlets de texto PS 5.1 (mojibake) — node/Copy-Item/edit.
- [x] `C:\Sisweb\tmp\redesign-*.json` (40MB, untracked): decidir destino (arquivo externo).
- [x] Após qualquer mudança em CSS/JS: `node scripts/sync-css-cachebusters.mjs --check`
      (com `--resync` se o conteúdo mudou mas o `?v=` já era hash) — nenhum `?v=`
      obsoleto; nunca versionar trabalho paralelo junto.
