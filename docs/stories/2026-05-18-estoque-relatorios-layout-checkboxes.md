# Story: Ajuste de layout e selecao nos relatorios de estoque

## Status
Ready for Review

## Contexto
O modulo `estoque.html` esta em producao e recebeu ajustes recentes de tabelas, ordenacao e selecao por checkbox. A aba Relatorios precisa seguir o mesmo padrao visual e funcional sem alterar regras de estoque, gravacoes ou consultas de dados reais.

## Problema
Na aba Relatorios, os campos Tipo de Relatorio, Data Inicio e Data Fim podem perder largura util quando os botoes ficam na mesma grade. A tabela gerada nos relatorios tambem nao exibe selecao por checkbox como as demais tabelas do modulo, impedindo que a impressao reflita somente os itens selecionados.

## Objetivo
Padronizar o layout responsivo da aba Relatorios, reduzir conflitos de CSS em tabelas e aplicar selecao por checkbox nos relatorios com reflexo correto na impressao.

## Acceptance Criteria
- [x] Campos Tipo de Relatorio, Data Inicio e Data Fim mantem largura util e nao sao sobrepostos pelos botoes em desktop, tablet e mobile.
- [x] Relatorios de toras e almoxarifado exibem checkbox por linha e selecionar todos no cabecalho.
- [x] Impressao dos relatorios usa todos os itens quando nada esta selecionado e apenas os itens selecionados quando houver selecao.
- [x] Colunas de checkbox/acoes nao aparecem na impressao.
- [x] Ajustes de CSS reduzem conflitos de cabecalho de tabela e preservam navegacao entre abas.
- [x] Validacoes possiveis foram executadas e registradas.

## File List
- `docs/stories/2026-05-18-estoque-relatorios-layout-checkboxes.md`
- `estoque.html`
- `estoque.js`
- `estoque_produtos.js`

## Implementacao
- Ajustada a grade da aba Relatorios para reservar coluna propria aos botoes em desktop e quebrar para duas/uma coluna antes de ocorrer sobreposicao.
- Corrigido conflito de cabecalho de tabela claro com texto herdado branco e padronizado o tamanho dos checkboxes das tabelas.
- Neutralizada a regra global de ultima coluna como acoes dentro de `#relatorioResult`, evitando estreitamento indevido de colunas como Data Entrada, Observacoes e Valor.
- Adicionados checkbox mestre e checkbox por linha nos relatorios de posicao, movimentacao, especies, localizacao, saldo de produtos e movimentacao de produtos.
- Impressao de relatorio agora regenera conteudo filtrado quando ha selecao e mantem todos os itens quando nada esta marcado.
- Corrigida a tabela de Movimentacao por Periodo para incluir cabecalho/coluna de Remessa, alinhando as 8 celulas de dados.
- Ordenacao dos relatorios preserva selecao e nao reseta mais `ordemRelatorio`.

## Validacao
- `node --check estoque.js` passou.
- `node --check estoque_produtos.js` passou.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `npm test` passou com 7 testes.
- Smoke local no navegador em `http://127.0.0.1:5501/estoque.html?noRedirect=true` percorreu as abas Entrada, Saida, Consulta, Almoxarifado, Movimentacoes e Relatorios com `activeId` correto.
- Medicao responsiva da aba Relatorios em 1280x720, 1024x768 e 390x844 nao detectou sobreposicao entre Tipo de Relatorio, Data Inicio, Data Fim e botoes, nem scroll horizontal da pagina.
- Producao `https://sisweb-7ce82.web.app/estoque.html` foi acessada sem login funcional para smoke nao destrutivo; o fluxo exibiu login/avisos de permissao, entao a validacao completa de abas foi feita localmente.

## Notas de seguranca
- Nenhum script de migracao ou escrita em dados reais deve ser executado.
- Validacao em producao deve ser apenas visual/leitura e sem operacoes de gravacao.
