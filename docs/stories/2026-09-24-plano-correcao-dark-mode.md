# Plano de Correção Dark Mode — v1.0

## Status
Em execução (Onda A + Fases 15/16/17 Done; Onda B parcial com credenciais do usuário)

## Onda B — Paridade light (Done 25/09)
- [x] Screenshots Claro de 15 integradas (`tmp/qa-fase19/light-*`): dashboard,
  estoque, finanças, romaneio tora, folha, notas, mdf-e, ajuda, company,
  subscription-status, user-profile, client, species, vendas, compras.

## Fases 18/19 (concluídas 25/09)
- Fase 18 (`docs/stories/2026-09-25-redesign-fase18-rodape-titulos-paleta.md`): rodapé
  ancorado no container, `.sw-page-title` em 22 páginas, paleta blindada.
- Fase 19 (`docs/stories/2026-09-25-redesign-fase19-abas-fluxo-marca-tema-banco.md`):
  paginação das 6 abas, fluxo com dados reais, páginas na marca, tema no banco
  (deploy das rules pendente).

## Origem
Consolidação do backlog das Fases 1A–13 + auditoria do crawler (`tmp/qa-fase9/offenders.json`)
+ prints do usuário. Fonte da verdade visual: `marqueting/lab-index-a.html`,
`marqueting/lab-login-b.html`, `marqueting/cores.md §2–§3`.

## Regras do plano
- Só FRONTEND; nenhuma lógica, rota ou backend é tocada (Regra de Ouro).
- Tudo sob `html[data-theme]` nos arquivos do sistema de tema; sem HEX fora de tokens,
  salvo `!important` cirúrgico documentado contra legado com `!important`.
- Cada onda fecha com evidência (screenshot + métrica) e gates verdes.
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.

## Onda A — Resíduos funcionais (esta execução)
- [ ] Screenshot de confirmação do modal Configurar Impressão (regras aplicadas, falta evidência).
- [ ] Labels Almoxarifado + h2 folha/romaneio: veredito ao vivo (crawler vê abas ocultas).
- [ ] Recontagem do crawler.

## Onda C — Mobile 390px + consolidação
- [ ] 390px nas páginas temizadas; toast system check; story final; gates.

## Declarado fora do plano
- Checkout `subscription.html`, `backup/`, lab `marqueting/`, QA visual admin (exige superadmin).
- ~~Teste 294 falha por `redesign-do-sisweb-login-index-e-tema-light-dark.json` (dump de outra
  sessão, 24/09 19:35) — não é artefato deste trabalho.~~ Resolvido na Fase 15: dump assumido e
  movido para `tmp/redesign-do-sisweb-login-index-e-tema-light-dark.json`; suíte em 650 pass / 0 fail.

## Fases 15/16 (concluídas 24/09)
- Fase 15 (`docs/stories/2026-09-24-redesign-fase15-alheios-paginacao.md`): alheios assumidos,
  hover ajudabitolas em `var(--sw-hover)`, paginação unificada padrão Lista de Pedidos.
- Fase 16 (`docs/stories/2026-09-24-redesign-fase16-paleta.md`): "Sistema" → "Configurações",
  paleta por tema (9 cores + suavizar/escurecer), persistência `sisweb:theme:custom`,
  evidência `tmp/qa-fase16/` (0 erros).

## File List
- `docs/stories/2026-09-24-plano-correcao-dark-mode.md`
- `docs/stories/2026-09-24-redesign-fase15-alheios-paginacao.md`
- `docs/stories/2026-09-24-redesign-fase16-paleta.md`
- `styles/content-theme.css`, `styles/shell-theme.css`, `styles/sisweb-tokens.css`
- `js/sisweb-theme.js`, `menu-component.js`, `ajudabitolas.html`
- `folha_pagamento/folha.css` (forma canônica `var(--sw-surface-2);`)
- `tests/redesign-theme-regression.test.mjs`
- `tmp/qa-fase16.mjs`, `tmp/qa-fase16/palette.png`, `tmp/qa-fase16/palette-custom.png`
- `tmp/redesign-do-sisweb-login-index-e-tema-light-dark.json`

## Implementação
- (ondas A/B/C durante a execução)

## Validação
- Gates 25/09 pós-Fase 19: `npm run lint` OK, `npm run typecheck` OK,
  `npm test` 653 pass / 0 fail / 1 skipped (regressão do tema 19/19).
- Deploy pendente (ação do usuário): `database.rules.json` (nó `ui/theme`).
