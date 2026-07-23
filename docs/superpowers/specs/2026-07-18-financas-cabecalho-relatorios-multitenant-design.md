# Padrao de Cabecalho dos Relatorios Financeiros

## Contexto

O Financeiro possui quatro saidas documentais ativas: relatorio em tela, impressao de contas, impressao do historico e PDF/exportacao, alem da Lamina de Cobranca Pix. Hoje elas montam cabecalhos diferentes, a previa em tela nao possui cabecalho e o fallback local pode escolher uma empresa armazenada no cache sem comprovar que ela pertence ao tenant autenticado.

O Sisweb ja possui o componente `commerce-pdf-share.js`, utilizado por Vendas, Compras e Estoque, com cabecalho, conversao segura de logo do Firebase Storage para Data URL, impressao HTML e PDF paginado. A solucao deve reutilizar esse componente e `getCompanyProfileForReport()` em vez de criar outro motor.

## Objetivos

- Restaurar logo e dados da empresa em todos os relatorios, PDFs e impressoes do Financeiro.
- Usar o mesmo padrao visual ja adotado por Vendas, Compras e Estoque.
- Garantir que o perfil empresarial pertence ao tenant autenticado do Financeiro.
- Resolver a logo do Storage antes de imprimir ou gerar PDF.
- Preservar os calculos, filtros, mutacoes e datasets financeiros existentes.
- Fechar o smoke de isolamento com Firebase Emulator e dois tenants autenticados, incluindo um tenant real de homologacao somente leitura.

## Fora de Escopo

- Reescrever o bootstrap Firebase/Auth do Financeiro.
- Alterar Rules, Cloud Functions ou dados financeiros reais.
- Corrigir nesta entrega o aviso generico isolado do bootstrap, que continua rastreado em `2026-07-14-auth-navigation-performance-ux.md`.
- Padronizar nesta entrega todos os relatorios dos demais modulos.

## Diagnostico

1. `financas.html` nao carrega `commerce-pdf-share.js`.
2. `renderFinanceReportModel()` renderiza apenas periodo, resumos e tabela.
3. `imprimirTabela()`, `imprimirHistoricoConta()` e `exportarPDF()` mantem templates independentes.
4. `getCompanyPrintInfo()` pode selecionar a empresa mais recente com logo a partir de `localStorage.companies`, sem vinculo autoritativo com `financeSessionTenant`.
5. `abrirBoletoPixLamina()` resolve a empresa por cache e leitura direta, paralelamente ao helper central.
6. A logo remota pode chegar ao jsPDF como URL HTTP; esse formato nao e uma entrada confiavel para `addImage()` e tambem pode nao terminar de carregar antes de `window.print()`.

## Arquitetura

### Perfil empresarial

O Financeiro tera um unico resolvedor `getFinanceReportCompanyProfile(options)`:

1. Exige `financeSessionTenant` confirmado.
2. Aguarda `window.__siswebFirebaseServiceReady` quando disponivel.
3. Chama `getCompanyProfileForReport({ companyId: financeSessionTenant })`.
4. Rejeita retorno sem sucesso, sem identidade ou cujo `companyId` seja diferente do tenant esperado.
5. Normaliza apenas aliases de apresentacao; nao tenta descobrir outro tenant.
6. Mantem cache somente em memoria, indexado pelo tenant, e o invalida em logout, troca de tenant e `clearFinancePrivateSessionState()`.

Nao havera leitura de `localStorage.companies`, selecao da primeira empresa ou escolha da empresa mais recente com logo.

### Logo

`prepareFinanceReportCompany()` usara `SiswebCommercePdf.resolveCompanyLogoDataUrl()` para converter `logoStoragePath` ou URL do Storage em Data URL com limite de 2 MB e timeout. A Data URL existira apenas em memoria e nao sera persistida no Realtime Database ou `localStorage`.

Quando a imagem estiver indisponivel, o componente compartilhado exibira as iniciais da empresa. A ausencia de logo nao deve impedir a emissao do documento.

### Matriz de saidas

| Saida | Comportamento |
|---|---|
| Previa em tela | Cabecalho visual, dados da empresa, titulo, periodo, resumos e tabela. |
| Imprimir contas | `preparePrintOptions()` + `printHtmlDocument()` com o mesmo cabecalho. |
| Historico de conta | Mesmo cabecalho e corpo especifico do historico. |
| PDF de relatorio | `exportTableReportPdf()` com cabecalho em todas as paginas, tabela e rodape paginado. |
| Lamina Pix | Mantem o layout fiscal de cobranca, mas recebe o mesmo perfil e a mesma logo Data URL. |

O CSV continua sendo uma exportacao tabular e nao recebe imagem. O nome da empresa e o tenant nao serao adicionados ao CSV para nao alterar seu contrato atual.

### Seguranca e privacidade

- Todo texto dinamico continua codificado por contexto HTML/PDF/CSV.
- O perfil retornado deve corresponder ao tenant autenticado.
- O cache de relatorio e a logo em memoria sao eliminados em logout ou troca de tenant.
- O smoke real sera somente leitura; nao criara contas, pagamentos ou cadastros.
- Credenciais de homologacao nao serao gravadas em arquivo, story, terminal ou log.
- Logs de diagnostico nao incluirao dados financeiros, e-mail, CNPJ ou URL tokenizada da logo.

## Responsividade e impressao

- A previa usa grid de tres areas em desktop e uma coluna em telas pequenas.
- Nome e dados empresariais podem quebrar linha sem sobrepor titulo ou logo.
- O PDF usa paisagem para tabelas financeiras largas e repete o cabecalho em novas paginas.
- A impressao espera a preparacao da logo antes de abrir o dialogo.
- O placeholder por iniciais preserva dimensoes estaveis quando nao ha imagem.

## Testes

1. Testes estaticos confirmam que o helper compartilhado carrega antes de `financas.js`.
2. Testes do resolvedor cobrem tenant correto, tenant divergente, falha do servico, cache por tenant e limpeza de sessao.
3. Testes da previa confirmam cabecalho, logo, dados escapados e ausencia do fallback global.
4. Testes de impressao e PDF confirmam uso do componente compartilhado.
5. Teste da Lamina Pix confirma que ela consome o perfil central preparado.
6. Firebase Emulator confirma isolamento de dois tenants.
7. Smoke autenticado real abre o Financeiro nos dois tenants, gera previa/PDF localmente e verifica que cabecalho e dados de A nunca aparecem em B, sem mutacao.

## Rollout

1. Rodar testes focados, `npm run lint`, `npm run typecheck`, `npm test` e `npm run build:hosting`.
2. Atualizar a versao do Service Worker e cachebusters dos assets alterados.
3. Publicar somente Hosting, pois a solucao nao exige Rules, Functions ou Database.
4. Verificar os arquivos publicados por HTTP.
5. Executar smoke no tenant operacional e no tenant de homologacao somente leitura.
6. Registrar evidencias e pendencias na story financeira existente.

## Criterios de Aceite

- Todos os relatorios e impressoes financeiros exibem o perfil correto da empresa.
- A logo aparece na previa, impressao, PDF e Lamina Pix quando cadastrada.
- Nenhuma saida escolhe empresa por posicao, nome ou recencia no cache.
- Troca de tenant nao reutiliza perfil, logo ou relatorio anterior.
- O aviso isolado de bootstrap nao bloqueia carregamento nem e confundido com falha do relatorio.
- Testes, build, deploy e smoke de dois tenants passam sem alterar dados reais.
