# Design: Origem e Impressao nos Relatorios Financeiros

## Contexto

A aba `Relatorios` de `financas.html` oferece cinco tipos de relatorio, periodo, geracao em tela, CSV e PDF. Parte dos modelos combina contas a receber e contas a pagar, enquanto outros escolhem a origem implicitamente pelo tipo. Isso dificulta a leitura operacional e impede o usuario de declarar se deseja analisar recebiveis ou pagamentos.

## Objetivo

Adicionar uma selecao explicita entre `Contas a Receber` e `Contas a Pagar`, adaptar os tipos e rotulos ao contexto escolhido e substituir a acao CSV por uma impressao com o cabecalho empresarial padrao do Sisweb.

## Abordagens Avaliadas

1. **Origem explicita com tipos adaptativos - escolhida.** Mantem o pipeline atual, inclui a origem na assinatura do modelo e adapta os rotulos de movimentacao e ranking. E a opcao com menor duplicacao e melhor semantica.
2. **Somente filtrar os modelos atuais.** Exigiria manter opcoes incoerentes, como faturamento para contas a pagar ou ranking de fornecedores em contas a receber.
3. **Criar duas telas independentes de relatorios.** Facilitaria rotulos fixos, mas duplicaria controles, renderizacao, testes e logica de carregamento.

## Experiencia da Interface

Os criterios ficam na seguinte ordem:

1. `Origem das Contas`, com `Contas a Receber` como padrao e `Contas a Pagar` como alternativa.
2. `Tipo de Relatorio`.
3. `Data Inicio`.
4. `Data Fim`.

Os tipos apresentados se adaptam a origem:

| Contas a Receber | Contas a Pagar |
|---|---|
| Inadimplencia | Inadimplencia |
| Faturamento por Periodo | Pagamentos por Periodo |
| Analise por Categorias | Analise por Categorias |
| Ranking de Clientes | Ranking de Fornecedores |

As acoes passam a ser `Gerar Relatorio`, `Imprimir` e `PDF`. O botao CSV deixa de existir somente nessa barra; as exportacoes CSV das tabelas operacionais de contas permanecem fora deste escopo.

Em desktop, os quatro criterios usam a grade existente. Em telas intermediarias, a grade passa para duas colunas; em mobile, uma coluna. Os botoes quebram linha sem criar overflow horizontal.

## Modelo e Fluxo de Dados

- A origem usa valores internos `receber` e `pagar` e entra na assinatura do relatorio.
- Alterar origem, tipo ou periodo invalida o modelo exibido.
- O carregamento estrito consulta apenas `companies/{companyId}/financas/{origem}/{mes}` exigido pelo relatorio.
- Inadimplencia usa somente titulos vencidos da origem escolhida.
- Movimentacao por periodo usa historicos de recebimento em `receber` e historicos de pagamento em `pagar`, com colunas e resumos coerentes.
- Categorias agrega somente a origem escolhida.
- Ranking agrupa clientes em `receber` e fornecedores em `pagar`.
- Tela, impressao e PDF consomem a mesma instancia de modelo confirmado; nenhuma saida recalcula totais separadamente.

## Impressao

O clique em `Imprimir` abre imediatamente uma janela temporaria para preservar a ativacao do usuario e evitar bloqueio de popup. Depois de obter ou regenerar o modelo atual, o fluxo substitui integralmente o documento temporario por:

- logo e dados da empresa vindos de `prepareFinanceReportCompany`;
- titulo adaptado a origem;
- periodo e identificacao da origem;
- resumos e a mesma tabela visivel;
- rodape padrao do Sisweb.

A implementacao reutiliza `SiswebCommercePdf` e o contrato de impressao corrigido em `commerce-pdf-share.js`. O layout usa A4 adaptavel e preserva campos numericos e datas sem quebra indevida.

## Erros e Estados

- Origem invalida, periodo invalido ou falha de particao impedem tela, impressao e PDF.
- A janela de impressao exibe erro seguro e pode ser fechada quando a geracao falha.
- Durante geracao/exportacao, os tres botoes ficam desabilitados e o grupo mantem `aria-busy`.
- Resultado antigo nunca e reutilizado depois de alterar qualquer criterio.
- Nenhuma operacao desta entrega grava ou altera contas financeiras.

## Testes e Aceite

1. O novo seletor possui somente `receber` e `pagar` e participa da invalidacao e assinatura.
2. Cada origem mostra quatro tipos compativeis e os rotulos corretos.
3. Os quatro modelos usam exclusivamente o array da origem escolhida.
4. Recebimentos e pagamentos por periodo calculam historicos e fallback de conta paga corretamente.
5. Imprimir reutiliza o modelo atual, abre a janela antes de operacoes assincronas e remove o documento de carregamento.
6. Logo, cabecalho, periodo, origem, resumos e tabela aparecem na impressao.
7. O botao CSV da aba Relatorios nao existe; CSV das tabelas continua funcionando.
8. PDF continua usando o mesmo modelo e cabecalho.
9. Layout passa em 1366x768, 768x1024, 390x844 e 320x480 sem sobreposicao.
10. Lint, typecheck, testes focados, suite completa, build de Hosting e smoke autenticado passam antes do deploy live.

## Fora de Escopo

- Remover as exportacoes CSV das tabelas de contas a pagar e receber.
- Criar novos calculos contabeis, DRE ou fluxo de caixa.
- Alterar Rules, Cloud Functions, dados persistidos ou caminhos Firebase.
- Mudar o gerador PDF compartilhado alem do necessario para consumir o modelo existente.

## Arquivos Previstos

- `financas.html`
- `financas.js`
- `sw.js`
- `tests/financas-relatorios-exportacoes.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/tenant-operational-safe-modules.test.mjs`
- `docs/stories/2026-07-15-financas-integridade-seguranca-relatorios.md`
