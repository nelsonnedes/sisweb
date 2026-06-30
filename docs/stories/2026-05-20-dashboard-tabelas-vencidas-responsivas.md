# Story: Refinamento visual das tabelas vencidas do Dashboard

## Status
Ready for Review

## Contexto
Os cards `A Receber Vencidas` e `A Pagar Vencidas` do Dashboard Sistema exibem titulos financeiros vencidos no carregamento inicial da pagina `index.html`.

## Problema
As tabelas atuais funcionam, mas ficam visualmente simples no desktop e apertadas no PWA, com pouco destaque para valor, vencimento, origem e paginacao.

## Objetivo
Tornar as tabelas vencidas mais elegantes, escaneaveis e responsivas, mantendo carregamento leve e sem alterar dados financeiros.

## Acceptance Criteria
- [x] Cards de vencidos exibem resumo visual com quantidade, total e faixa da pagina.
- [x] Linhas ficam mais legiveis no desktop, com descricao, cliente/fornecedor, documento, valor, vencimento e status.
- [x] No PWA/mobile, cada linha vira um card compacto sem overflow horizontal.
- [x] Estado vazio fica mais claro e elegante.
- [x] Paginacao continua funcional e com alvos confortaveis para toque.
- [x] Validacoes possiveis foram executadas e registradas.

## File List
- `docs/stories/2026-05-20-dashboard-tabelas-vencidas-responsivas.md`
- `modules/dashboard/dashboard-widgets.js`
- `modules/dashboard/dashboard-professional-styles.css`

## Analise
- A estrutura anterior usava tabela simples com quatro colunas e pouco contexto visual, o que dificultava leitura rapida no dashboard.
- As folhas responsivas ja tinham suporte a `data-label`, mas o markup das vencidas nao preenchia esses atributos, deixando o PWA dependente de overflow/ajustes genericos.
- A largura dos cards lado a lado no desktop exigiu colunas compactas e sem rolagem horizontal para manter status e vencimento visiveis.

## Implementacao
- O renderizador das tabelas vencidas agora cria um resumo no topo com quantidade, total em aberto e faixa exibida.
- Cada linha mostra titulo, cliente/fornecedor, documento, valor restante, vencimento, dias em atraso e badge de status.
- Foram adicionados `data-label` por celula, escape de HTML para textos vindos dos dados e estado vazio mais claro.
- A folha profissional recebeu estilos especificos para `.overdue-table`, com layout desktop sem overflow e layout mobile em cards empilhados.
- A paginacao foi refinada visualmente e manteve a funcao `changePage` existente.

## Validacao
- `node --check modules/dashboard/dashboard-widgets.js`
- `git diff --check -- modules/dashboard/dashboard-widgets.js modules/dashboard/dashboard-professional-styles.css docs/stories/2026-05-20-dashboard-tabelas-vencidas-responsivas.md`
- Smoke local com Edge headless e dados falsos em `localStorage`: 2 resumos, 4 linhas vencidas, 4 badges, `data-label` mobile e sem `dashboard-error`.
- Capturas desktop e PWA revisadas visualmente para confirmar cards sem overflow horizontal.
- `npm run lint`
- `npm run typecheck`
- `npm test`
