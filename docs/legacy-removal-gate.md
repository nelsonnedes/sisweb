# Gate de Remoção dos Globais Legados (`window.getData` / `window.saveData`)

Criado em: 2026-10-02 (fase A4-warn + strangler folha).
Revisão agendada: **a partir de 2026-10-09** — pedir ao agente:
"verifique o gate de remoção dos legados" com os `stats()` abaixo.

## Critério de remoção (todos precisam estar VERDES)

1. **Warns limpos por 7 dias**: em cada página com trap, abrir o console e rodar:
   `__siswebLegacy.stats()` → `reads: 0, overwrites: 0`
   Páginas com trap: vendas, preromaneio, romaneiopes, romaneiotl,
   romaneiopct, romaneiotora, financas, folha (folha_pagamento/folha.html).
2. **Leituras migradas**: PCT/Tora (A3), folha-relatorios via `swGet`
   (`tests/folha-swget.test.mjs`); vendas/compras/estoque usam `getData`
   local próprio (não consomem o global).
3. **Escritas auditadas**: os ~32 sites `saveData` 2-arg ainda usam o global.
   Migração de writes exige auditoria site a site (risco de corrupção) —
   NÃO remover os globais antes disso.

## Quando o gate estiver verde, a remoção é

- Deletar as atribuições `window.getData = ...` / `window.saveData = ...`
  listadas em `tests/sisweb-data.test.mjs` (trava de inventário),
  mantendo `SiswebData` como único caminho.
- Manter `modules/core/legacy-deprecation.js` por +1 versão como rede
  de segurança (warn vira erro informativo se algo ainda chamar).

## Status atual (2026-10-02)

- Leituras: migradas / locais — OK.
- Escritas: pendentes de auditoria — BLOQUEIA remoção.
- Soak: dia 0 de 7 — BLOQUEIA remoção.
