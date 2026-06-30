# Story: Estoque - Rastreabilidade de Toras e Romaneios

Data: 2026-06-02

## Objetivo

Criar rastreabilidade formal entre toras, remessas de baixa, movimentacoes e romaneios vinculados, preservando dados reais em producao e mantendo isolamento multi-tenant por `companyId`.

## Escopo

- `estoque.html`, principalmente Saida de Toras, Movimentacoes e Relatorios.
- Novo caminho tenant-safe `companies/{companyId}/rastreabilidade`.
- Impressao e configuracao de colunas do relatorio de rastreabilidade.
- Pagina de migracao segura para gerar rastreabilidade a partir de baixas existentes.

## Decisoes

- Usar `remessaId`, `movimentacaoId`, `toraId` e `romaneiosRelacionados` como vinculo confiavel; texto de observacoes permanece apenas como apoio visual.
- Gravar registros de rastreabilidade junto da baixa de toras usando `firebaseService.updatePaths`, quando disponivel.
- Manter dados antigos intactos; migracao deve preencher o novo no sem apagar ou reescrever `estoqueTorasAtual` e `movimentacoesToras`.
- Marcar registros migrados como `origem: "migracao"` e `confiabilidade: "parcial"` quando faltarem dados formais.
- Exibir "Romaneio Vinculado" no lugar de "Observacoes" nos pontos em que o campo representa o vinculo da baixa.
- Manter consultas e preferencias sempre no tenant resolvido pelo `firebaseService`/`resolveCompanyId`.

## Checklist

- [x] Adicionar regras Firebase para `rastreabilidade` nos arquivos de regras locais/producao.
- [x] Carregar dados de rastreabilidade no estoque com fallback seguro para lista vazia.
- [x] Gravar registros formais de rastreabilidade ao registrar saida de toras.
- [x] Marcar registros de rastreabilidade como estornados ao estornar baixa, sem apagar trilha.
- [x] Recarregar o no `rastreabilidade` antes do estorno para evitar cache antigo.
- [x] Ocultar rastreabilidades estornadas por padrao no modal e relatorio, mantendo filtro para visualizar todos/estornados.
- [x] Incluir correcao segura por remessa ja estornada na pagina de migracao.
- [x] Adicionar botao/modal de Rastreabilidade na aba Movimentacoes.
- [x] Adicionar atalho de Rastreabilidade na Saida de Toras.
- [x] Adicionar filtros por plaqueta, romaneio, remessa, movimentacao, especie, cliente, usuario e periodo.
- [x] Incluir relatorio de rastreabilidade em Relatorios de Estoque com Configurar Colunas e impressao.
- [x] Criar pagina de migracao com pre-visualizacao e aplicacao controlada.
- [x] Renomear exibicoes pertinentes de Observacoes para Romaneio Vinculado.
- [x] Validar sintaxe JS, script embutido da migracao e JSON de regras.
- [x] Rodar gates do projeto quando aplicavel: lint, typecheck e test.

## Arquivos Alterados

- `docs/stories/2026-06-02-estoque-rastreabilidade-romaneios.md`
- `estoque.html`
- `estoque.js`
- `migrar_rastreabilidade.html`
- `database.rules.json`
- `firebase-rules-production.json`
