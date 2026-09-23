# Story: Impressão Tora — colunas sem sobreposição/estouro

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `modules/reports/imprimir-romaneio.js` (CSS tabela Tora), `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Evidência (anexo do usuário):** 20 colunas em partes iguais → Custódia/AUTEF transbordando, Valor quebrando no meio (`R$ 1.170,0` + `4` solto, fora da borda), totais desalinhados. Resumo OK (intocado).

## Causa raiz

`table-layout: fixed` + só `.col-especie-tora{16%}`: 19 colunas dividiam 84% em partes iguais (~4,6% cada) — insuficiente para valores (`R$ 9.359,50`) e textos longos.

## Correção (só CSS da tabela, sem mexer em dados/totais)

- Larguras fixas somando <100% (plaqueta 6,5; custódia/autef 7,5; espécie 12; rodo/comp/compgeo 3,5; ocos 3; volumes 4,5; X 2,8; vgeo 4,5; dif 4; preço 5,5; valor 6,8).
- Numéricos/moeda com `white-space: nowrap` (nunca quebram no meio).
- Custódia/AUTEF/Espécie com quebra contida na coluna (`break-all`/`anywhere`).
- Linha de totais já somava 20 colunas corretas — o desalinhamento era efeito do estouro.

## Acceptance Criteria

- [x] Nenhum valor quebrado ou fora da borda; textos longos contidos.
- [x] Estrutura HTML/totais/cálculos intactos; resumo intacto.
- [x] Gates verdes (633 pass, 0 fail, 1 skip emulator).

## File List

- `modules/reports/imprimir-romaneio.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
