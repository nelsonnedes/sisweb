# Story: Estoque de Toras - Geometria, Relatorios e Colunas

Data: 2026-06-01

## Objetivo

Sincronizar `estoque.html` com o padrao geometrico de toras ja aplicado em romaneios e pre-romaneios, preservando dados reais em producao e mantendo os caminhos multi-tenant existentes.

## Escopo

- Entrada de Toras
- Saida de Toras, baixa individual, baixa por lote e modal de selecao
- Consulta de Toras
- Historico de Movimentacoes
- Relatorios de Posicao, Movimentacao, Especies e Localizacao
- Entrada Almoxarifado e Almoxarifado, sem integracao com `compras.html` ou `pedidosCompra`

## Decisoes

- Manter os campos canonicos `custodia`, `compGeo`, `x1`, `x2`, `x3`, `x4` e `volumeGeo`.
- Reusar `tora-geometry-utils.js` para normalizacao e calculo de `V. Geo.` pelo metodo de Smalian.
- Gravar os campos novos nos mesmos registros atuais de `estoqueTorasAtual` e `movimentacoesToras`, sem criar novo caminho Firebase.
- Preservar compatibilidade com toras antigas sem campos geometricos, exibindo valores vazios ou zero sem quebrar edicao, baixa ou relatorios.
- Incluir `Configurar Colunas` apenas nos relatorios de toras: Posicao, Movimentacao, Especies e Localizacao.
- Guardar preferencias de colunas e itens por pagina com chave contendo empresa/tenant e usuario.
- Reaproveitar a aba obsoleta de Compras do estoque como `Entrada Almoxarifado`, mantendo `compras.html` intacto.
- Manter entrada manual e baixa manual do almoxarifado apenas em `estoqueProdutos` e `movimentacoesProdutos`.
- Nao apagar dados existentes do banco por codigo; apenas remover referencias ativas ao fluxo legado `estoqueComprasMov` no estoque.

## Checklist

- [x] Incluir campos geometricos no formulario de Entrada de Toras.
- [x] Incluir campos geometricos na tora manual da Saida.
- [x] Preservar campos geometricos ao carregar itens de romaneio para entrada no estoque.
- [x] Gravar campos geometricos em entradas, edicoes, saidas e exclusoes.
- [x] Atualizar tabelas de Entrada, Saida, Consulta, Movimentacoes e modal de toras.
- [x] Adicionar itens por pagina nas tabelas de toras, produtos e compras.
- [x] Incluir botao `Configurar Colunas` nos relatorios de toras.
- [x] Refletir configuracao de colunas na visualizacao e impressao dos relatorios.
- [x] Completar as colunas configuraveis dos relatorios de toras e manter selecao por checkbox para impressao.
- [x] Incluir selecao de todas as colunas nos modais de configuracao.
- [x] Reorganizar as acoes da Entrada de Toras, reduzir o botao de historico e adicionar configuracao de colunas na tabela de entrada.
- [x] Corrigir sobreposicao do modal Lista de Especies sobre o modal Selecionar Toras para Baixa.
- [x] Adicionar configuracao de colunas na Consulta de Toras com reflexo na impressao.
- [x] Corrigir renderizacao do Almoxarifado ao alterar Itens por pagina.
- [x] Adicionar configuracao de colunas no Almoxarifado com reflexo na impressao.
- [x] Adicionar configuracao de colunas nas Movimentacoes com reflexo na impressao.
- [x] Exigir confirmacao visual antes de estornar remessas ou movimentacoes selecionadas.
- [x] Substituir a aba Compras do estoque por Entrada Almoxarifado sem tocar em `compras.html`.
- [x] Separar Entrada Almoxarifado da aba Almoxarifado.
- [x] Implementar baixa inline no Almoxarifado com data, produto, responsavel, quantidade e motivo/destino.
- [x] Adicionar filtros de data, responsavel, produto e saldo na aba Almoxarifado.
- [x] Remover referencias ativas ao caminho legado `estoqueComprasMov` do estoque.
- [x] Reorganizar os campos da Entrada de Toras em 3 linhas proporcionais: identificacao/especie, medidas/volumes e geometria.
- [x] Corrigir calculo visual em tempo real de `M³ Bruto` e `M³ Líquido` na Entrada de Toras.
- [x] Implementar navegacao por Enter na Entrada Almoxarifado, com salto de campos desabilitados.
- [x] Ajustar layout do Almoxarifado para filtros, botoes e baixa inline com larguras proporcionais e quebras responsivas.
- [x] Adicionar selecao de responsavel na baixa do Almoxarifado e coluna Responsavel configuravel com reflexo na impressao.
- [x] Adicionar coluna Motivo / Destino no Almoxarifado com configuracao de colunas e impressao.
- [x] Remover rolagem vertical interna das tabelas paginadas do estoque para que Itens por pagina expanda a pagina.
- [x] Trocar selecao de responsavel da baixa do Almoxarifado por autocomplete sem duplicados e com aviso de responsavel ja cadastrado.
- [x] Fixar e centralizar a coluna Acoes nas tabelas largas do estoque com botoes de acao.
- [x] Corrigir Baixa Individual para acumular toras sem reiniciar a tabela ao reabrir a aba de saida.
- [x] Adicionar checkbox, selecionar todos e adicionar selecionadas na busca por plaqueta da Saida de Toras.
- [x] Adicionar configuracao de colunas e rolagem horizontal interna na tabela de Toras Selecionadas para Baixa.
- [x] Carregar a edicao de item do Almoxarifado no formulario Entrada Almoxarifado, preenchendo dados disponiveis e atualizando cadastro/saldo sem abrir modal ou criar entrada historica.
- [x] Implementar tipos de movimentacao do Almoxarifado: Entrada, Saida, Ajuste e Devolucao, refletindo em saldo, tabela, configuracao de colunas, impressao, relatorios, edicao com ajuste e estorno.
- [x] Corrigir coluna Fornecedor no Relatorio de Posicao para exibir nome/id quando o campo `fornecedor` vier como objeto.
- [x] Remover nos auxiliares de romaneio da Entrada de Toras os nos tecnicos do Firebase, como `_metadata`, evitando opcao falsa no campo Romaneio.
- [x] Validar sintaxe JS e scripts inline.
- [x] Validar layout e fluxo no navegador.
- [x] Rodar gates do projeto: lint, typecheck e test.

## Arquivos Alterados

- `estoque.html`
- `estoque.js`
- `estoque_produtos.js`
- `species-manager.js`
- `docs/stories/2026-06-01-estoque-toras-geometria-relatorios-colunas.md`
