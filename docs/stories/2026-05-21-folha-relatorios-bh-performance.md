# Story: Correção de performance e cache nos relatórios de folha/BH

## Status
Ready for Review

## Contexto
O módulo `folha_pagamento/folha.html` gera relatórios em um sistema Firebase multi-tenant. Cada usuário deve ler apenas dados do seu `companyId`, e relatórios como Extrato de Banco de Horas precisam ser rápidos mesmo com muitos funcionários e lançamentos.

## Problema
Ao gerar alguns relatórios, especialmente Extrato de BH, os logs mostram muitas leituras individuais em `folha/bancoHoras/lancamentos/{funcionario}` e erro `QuotaExceededError` ao tentar salvar no `localStorage` o cache de `companies/{companyId}`. Isso aumenta o tempo de geração, polui o console e pode falhar em ambientes com storage local cheio.

## Objetivo
Reduzir leituras repetidas no Firebase, impedir cache local de payloads grandes ou raiz de empresa e manter os cabeçalhos dos relatórios usando dados seguros do tenant sem carregar toda a empresa.

## Acceptance Criteria
- [x] Extrato de BH usa leitura batch/cacheada de lançamentos quando disponível.
- [x] Fallback individual de BH continua funcionando quando batch não estiver disponível.
- [x] Dados de cabeçalho da empresa em folha/BH priorizam `companies/{companyId}/profile` e não carregam a raiz completa do tenant.
- [x] `FirebaseConnectionManager` não tenta persistir no `localStorage` payloads grandes ou raiz `companies/{companyId}`.
- [x] Logs repetitivos de folhas fechadas são resumidos para reduzir ruído/perda de performance.
- [x] Títulos e células da tabela de Lançamentos de BH não sobrepõem dados no relatório/PDF.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` passa.

## Tarefas
- [x] Ler logs e mapear causa dos erros.
- [x] Ajustar carregamento batch do Extrato de BH.
- [x] Proteger cache local contra payloads grandes/raiz de tenant.
- [x] Remover leitura da raiz da empresa nos cabeçalhos afetados.
- [x] Ajustar layout da tabela de Lançamentos de BH para evitar sobreposição de colunas.
- [x] Adicionar testes de regressão estáticos.
- [x] Rodar gates e atualizar File List.

## File List
- `docs/stories/2026-05-21-folha-relatorios-bh-performance.md`
- `folha_pagamento/banco-horas-firebase.js`
- `folha_pagamento/banco-horas-relatorios.js`
- `folha_pagamento/folha-firebase-manager.js`
- `folha_pagamento/folha-relatorios.js`
- `tests/company-logo-storage-policy.test.mjs`

## Implementação
- `bhListLancamentosBatch()` passou a normalizar chaves, carregar `folha/bancoHoras/lancamentos` uma única vez por janela curta em memória e pular cache local pesado.
- Fallback de BH por funcionário foi preservado, agora com concorrência limitada para evitar rajadas no Firebase quando a leitura batch não estiver disponível.
- Alterações de lançamento de BH invalidam o cache batch em memória.
- `gerarRelatorioExtratoBH()` monta as chaves dos funcionários antes do loop, busca lançamentos em lote e distribui/deduplica os itens por funcionário.
- A tabela do Extrato de BH recebeu classe própria, `colgroup` com larguras proporcionais, títulos com quebra controlada e regras de impressão para impedir sobreposição.
- O log de folhas fechadas removidas foi resumido em uma linha com contagem e amostra, reduzindo ruído no console.
- Cabeçalhos de folha e relatórios BH deixaram de ler `companies/{companyId}` inteiro e passaram a priorizar `companies/{companyId}/profile`.
- `FirebaseConnectionManager` agora aceita `skipLocalStorage`, ignora cache local para raiz `companies/{companyId}`, ignora payloads acima de 1,5 MB e trata `QuotaExceededError` como skip controlado.
- Teste estático cobre batch de BH, proteção de cache local e ausência de leitura da raiz completa da empresa nos cabeçalhos afetados.

## Validação
- `node --check folha_pagamento\banco-horas-firebase.js` passou.
- `node --check folha_pagamento\folha-relatorios.js` passou.
- `node --check folha_pagamento\banco-horas-relatorios.js` passou.
- `node --check folha_pagamento\folha-firebase-manager.js` passou.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `npm test` passou com 8 testes.
- `git diff --check` passou nos arquivos alterados.
- Smoke HTTP local em `http://127.0.0.1:3000/folha_pagamento/folha.html` não foi executado porque não havia servidor escutando na porta 3000.
- Inspeção pelo navegador embutido não foi concluída porque a ponte local do browser não estava confiável/disponível nesta sessão.

## Notas de segurança
- Não executar migração de dados reais nesta story.
- Não alterar regras Firebase nesta story.
- Não alterar caminhos de gravação de dados de folha fora do escopo de BH/cache.
