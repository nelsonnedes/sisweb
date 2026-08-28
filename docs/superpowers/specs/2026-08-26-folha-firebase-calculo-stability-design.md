# Spec: Estabilidade do Firebase e da Edição da Folha

**Data:** 2026-08-26  
**Status:** Aprovado pelo usuário para implementação

## Objetivo

Eliminar o `RangeError: Maximum call stack size exceeded` no carregamento da Folha e evitar que a edição dispare cálculo com salário base ainda vazio.

## Diagnóstico

- `folha.html` inicializa o RTDB pelo SDK local em `firebase-init.js`, enquanto os módulos ativos da Folha importam `firebase-database.js` diretamente do gstatic. A mesma instância `window.database` não pode ser manipulada por dois bundles Firebase distintos.
- `fillFolhaForm()` dispara `change` em `folhaTipoPagamento` antes de preencher `funcionarioSalario`; os listeners recalculam e `calcularFolhaCompleta()` recebe salário base zero.

## Decisão

- Substituir imports diretos do RTDB nos módulos ativos de `folha_pagamento/` por `../firebase/sdk/firebase-database.js`.
- Manter a sequência de preenchimento existente, mas adicionar uma guarda curta de hidratação em `FolhaLancamentos`; listeners podem atualizar exibição, porém não calculam até o formulário estar pronto.
- Executar o cálculo inicial uma vez ao final de `fillFolhaForm()` e limpar a guarda mesmo em erro.
- Não alterar regras de negócio, valores persistidos, paths, Rules ou estrutura de dados.

## Validação

- Teste estático garante ausência de imports gstatic nos módulos ativos e presença do guard de hidratação.
- Testes existentes de Folha, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build:hosting`.
- Smoke autenticado confirma carregamento sem `ChildrenNode.equals` recursivo e edição sem `Salário base ... maior que zero`.
