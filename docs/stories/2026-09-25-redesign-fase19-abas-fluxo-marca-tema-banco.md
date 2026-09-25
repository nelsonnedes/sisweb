# Story: Fase 19 — Paginação das abas, fluxo real, páginas na marca, tema no banco

## Status
Done (código + rules; deploy das rules pendente — ver § Tema no banco)

## Contexto
(1) Abas Clientes/Produtos/Relatórios (vendas) e Fornecedores/Produtos/Relatórios
(compras) listavam tudo sem paginar; (2) Fluxo Detalhado zerava com razão aberta e
30 dias sumia com vencido; (3) subscription-status/ajuda/company fora da marca;
(4) tema só em localStorage — pedido: persistir por tenant no banco.

## Implementação
- Paginação (10/pág, padrão Lista de Pedidos, totais do rodapé intactos):
  `vendas.js` + `vendas.html` (vendasClientes/Produtos/RelatorioPagination),
  `compras.js` + `compras.html` (comprasFornecedores/Produtos/relComprasRelatorioPagination,
  cobre modo pedidos e agrupado). `gerarRelatorio`/`gerarRelatorioCompras` ganharam
  `keepPage` (navegar não reseta; filtrar reseta).
- Finanças (`financas.js`): `isContaAbertaFluxo` (vencido conta como aberto —
  a mutação in-place sumia do dashboard), `valorRestanteFluxo`, `parseDataISOLocal`,
  `eachMovimentoFluxo` (realizado por data de pagamento/histórico + previsto por
  vencimento); `calcularFluxoPeriodo` reescrito (datas locais, sem UTC);
  `gerarFluxoCaixa` async com `ensureReceber/PagarDataForRange` do intervalo;
  tabela com estado vazio explícito; gráfico 30d desenhado na carga.
- Páginas na marca (user-profile = referência): subscription-status hero
  `var(--sw-gradient)` + botões primários + chips + message-center + focus;
  ajuda hero em gradiente + tópicos/kicker/fluxo/ações na marca;
  company botões globais/save em gradiente + ícones `var(--sw-brand)` + cards 16px.
- Tema no banco: `companies/{tenant}/ui/theme {mode, custom, updatedAt, updatedBy}`;
  `database.rules.json` nó `ui` (leitura membro; escrita membro ativo com assinatura;
  validate de mode); `js/sisweb-theme.js` com sync last-write-wins, debounce 1,5s,
  fail-open total (localStorage segue cache síncrono; superadmin sem tenant = só local;
  usa `updatePaths` ou fallback `saveToFirebase`; converge em `tenantContextReady`).

## Validação
- `npm test` 653 pass / 0 fail / 1 skipped (romaneio-browser 6/6 isolado; 1 flake sob
  carga registrado). Teste `commerce-responsive-pwa` alargado p/ assinatura com param.
- QA `tmp/qa-fase19.mjs` (0 erros): containers nas 6 abas (produtos vendas com 8 botões);
  fluxo com 153 linhas e barra real; hero subscription em gradiente; paleta no company
  com × 29px; rodapé dentro do container (1160 vs 1200 = padding); light em 15 páginas.
- Tema no banco: leitura/escrita pelo svc real testadas — escrita retorna
  `PERMISSION_DENIED` até o deploy das rules (comportamento correto do servidor);
  após deploy, o roundtrip converge sozinho. NADA foi implantado no servidor.

## Pendente (ação do usuário)
- `firebase deploy --only database` (ou publicar `database.rules.json` pelo console)
  para ativar `companies/{id}/ui/theme`. Sem isso, o tema segue 100% local (fail-open).

## File List
- `vendas.js`, `vendas.html`, `compras.js`, `compras.html`, `financas.js`
- `subscription-status.html`, `ajuda.html`, `company.html`
- `js/sisweb-theme.js`, `database.rules.json`
- `tests/redesign-theme-regression.test.mjs`, `tests/commerce-responsive-pwa.test.mjs`
- `tmp/qa-fase19.mjs`, `tmp/qa-fase19/`
