# Folha - Recibo de Impressao sem Sobreposicao

## Contexto

Em Folha de Pagamento > Lancamentos, o botao Imprimir gera o recibo individual e abre a tela de impressao. O layout anterior forcava A4 em retrato, aplicava altura fixa na pagina do recibo e usava zoom no container durante `beforeprint`, o que podia causar sobreposicao de dados em recibos com conteudo maior.

## Alteracoes

- Ajustar o recibo mensal para respeitar a orientacao escolhida no dialogo de impressao.
- Remover altura fixa e zoom agressivo do container de recibo.
- Permitir quebra natural de pagina em conteudos longos, preservando linhas/totais/assinaturas sem quebra interna.
- Reorganizar os dados do funcionario em grid responsivo para evitar colisao entre labels e valores.
- Aplicar o mesmo padrao no recibo de horas extras.
- Melhorar o fluxo que abre a janela/aba de impressao, aguardando fontes e imagens antes de chamar `print()`.
- Remover `@page size` do caminho de recibo para o Chrome voltar a exibir as opcoes nativas de Retrato/Paisagem como nos romaneios.
- Abrir o recibo em aba comum (`_blank`), sem popup nomeado/especial, alinhando o comportamento ao fluxo de impressao dos romaneios.
- Ajustar a tabela de descontos para quebrar textos longos de vales sem sobrepor a coluna de valores.
- Implementar autoajuste por largura e altura para recibos, garantindo que o recibo mensal e o demonstrativo individual caibam em uma pagina no modo retrato ou paisagem.
- Calcular escalas independentes para retrato e paisagem, evitando que uma escala menor gerada em paisagem fique presa quando o usuario troca para retrato dentro do preview de impressao.
- Revisar as impressoes gerais da Folha para usar autoajuste de tabela com escalas independentes por orientacao.
- Incluir no `Resumo da Folha (Selecao de Colunas)` a opcao para imprimir apenas lancamentos em aberto, desconsiderando lancamentos pagos, baixados ou fechados.
- Fazer o modal do Resumo herdar o mes filtrado na tela principal quando os campos de periodo ainda estiverem vazios.

## Arquivos

- `folha_pagamento/folha-relatorios.js`

## Checklist

- [x] Mapear fluxo do botao Imprimir ate o HTML do recibo.
- [x] Corrigir layout do recibo mensal.
- [x] Corrigir layout do recibo de horas extras.
- [x] Evitar conflito entre autoajuste generico de relatorios e recibos.
- [x] Validar sintaxe, lint, typecheck e testes.
- [x] Fazer deploy e validar online em retrato/paisagem.
- [x] Validar online com Abril/2026 e Fabio Da Silva carregado na pagina de Folha.
- [x] Proteger em teste automatizado o autoajuste de recibos por escala de impressao.
- [x] Proteger em teste automatizado as escalas separadas de retrato/paisagem e a limpeza das variaveis ativas no modo impressao.
- [x] Estender o autoajuste responsivo para relatorios gerais e exportacao por PDF/print.
- [x] Proteger em teste automatizado o filtro "somente lancamentos em aberto" do Resumo da Folha.
- [x] Sincronizar o periodo inicial do Resumo com o filtro `Mes/Ano` da tela principal.

## Validacao

- `node --check folha_pagamento/folha-relatorios.js`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `git diff --check` sem erro; apenas avisos LF/CRLF do Windows.
- `firebase deploy --only hosting --project sisweb-7ce82`
- Validacao visual com recibo sintetico em retrato e paisagem: 0 sobreposicoes em linhas, celulas e blocos principais.
- Verificacao do arquivo publicado em `https://sisweb-7ce82.web.app/folha_pagamento/folha-relatorios.js`.
- Verificacao da versao publicada confirmou `omitPageSize`, ausencia de `popup=yes` e abertura por `_blank`.
- Producao recarregada em `folha.html`, filtro Abril/2026 aplicado e Fabio Da Silva visivel com o botao de impressao do lancamento real.
- Autoajuste reaproveitado nos dois fluxos: botao Imprimir dos lancamentos e Gerar Relatorios > Demonstrativo Individual.
- Ajuste refinado para mudanca de orientacao dentro do dialogo de impressao: o CSS escolhe `--recibo-print-scale-portrait` ou `--recibo-print-scale-landscape` conforme o modo atual.
- Relatorios gerais passam a calcular `--fs-portrait` e `--fs-landscape`, removendo a escala ativa durante o preview para que a orientacao atual escolha a escala correta.
- Resumo da Folha ganhou opcao "Imprimir apenas lancamentos em aberto", usando a mesma regra central de status ja aplicada aos totais operacionais.
- Ao abrir o Resumo, o periodo padrao usa o filtro da tela principal quando disponivel.
