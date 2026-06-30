# Story: Correcao do contexto de empresa em relatorios multi-tenant

## Status
Ready for Review

## Contexto
O Sisweb e um sistema multi-tenant em producao. Cada usuario autenticado pertence a uma empresa identificada por `companyId`, e relatorios, PDFs, DANFE/MDF-e e modais devem usar exclusivamente os dados da empresa vinculada ao usuario logado para cabecalho, logo, informacoes cadastrais e caminhos de dados.

## Problema
O projeto tinha resolvedores de empresa duplicados em servicos, paginas, relatorios, modais e rotinas legadas. Alguns fallbacks aceitavam `slug`, `nome` ou `name` como tenant, e outros liam a colecao global `companies` e escolhiam a primeira empresa encontrada. Em producao isso pode carregar cabecalho de outra empresa, gravar dados em caminho errado ou falhar por permissao quando o usuario comum nao pode ler a raiz de `companies`.

## Objetivo
Centralizar e endurecer a resolucao segura de empresa por `companyId`, migrar os relatorios e modais referenciados pelo menu/submenu para esse fluxo, revisar NF-e/MDF-e e registrar os proximos passos sem executar migracoes em dados reais.

## Acceptance Criteria
- [x] Existe helper central para resolver dados de empresa de relatorio por `companyId` autenticado.
- [x] O helper nunca usa `nome`, `name`, `slug` ou dados textuais como `companyId`.
- [x] O helper prioriza `companies/{companyId}/profile` e usa `companies/{companyId}` apenas como complemento seguro.
- [x] Relatorios de vendas, compras, financas, estoque, folha, banco de horas, romaneios TL/PCT/PES/Tora e fiscal usam o helper central quando disponivel.
- [x] Fallbacks globais migrados para nao selecionar a primeira empresa para usuario comum.
- [x] Resolvedores de tenant em modais e utilitarios compartilhados usam somente `companyId`, `companyID`, `tenantId` ou `id`.
- [x] NF-e/DANFE usa o tenant resolvido para inicializar configuracoes fiscais e carregar dados do emitente.
- [x] MDF-e inclui dados da empresa do tenant no relatorio.
- [x] Arquivos CT-e/DACTE ativos foram procurados e nenhum modulo ativo foi encontrado.
- [x] `npm run lint` passa.
- [x] `npm run typecheck` passa.
- [x] `npm test` e documentado caso continue sem script configurado.

## Tarefas
- [x] Criar story para rastrear a correcao.
- [x] Implementar helper central seguro em `firebaseService.js`.
- [x] Espelhar helper/tenant seguro em `firebaseService.unified.js`, `src/services/firebaseService.js` e `modules/core/firebase-service.js`.
- [x] Migrar relatorios criticos para o helper central.
- [x] Corrigir duplicidade de `anexarArquivoConta` em `financas.js`.
- [x] Revisar arquivos referenciados por menu/submenu e modais.
- [x] Remover fallbacks de tenant baseados em `slug`, `nome` e `name`.
- [x] Revisar NF-e, DANFE e MDF-e.
- [x] Procurar CT-e/DACTE ativo.
- [x] Validar gates disponiveis.
- [x] Atualizar File List.

## File List
- `docs/stories/2026-05-17-correcao-contexto-empresa-relatorios.md`
- `firebaseService.js`
- `firebaseService.unified.js`
- `src/services/firebaseService.js`
- `modules/core/firebase-service.js`
- `src/services/databaseAdapter.js`
- `database-adapter.js`
- `database-utils.js`
- `auth.js`
- `company.html`
- `index.html`
- `vendas.html`
- `vendas.js`
- `compras.html`
- `compras.js`
- `compras_legacy.js`
- `estoque.js`
- `financas.html`
- `financas.js`
- `notas-fiscais.html`
- `mdf-e.js`
- `client-service.js`
- `client-utils.js`
- `standardized-client-modal.js`
- `romaneios-client-save-fix.js`
- `species-manager.js`
- `fornecedor-modals.js`
- `garantia-fluxo-fornecedor.js`
- `romaneio-manager.js`
- `romaneiopes.html`
- `romaneiotl.html`
- `romaneiopct.html`
- `romaneiopct-main.js`
- `romaneiopct_funcoes.js`
- `romaneiotora_modais.js`
- `romaneiotora_modal_fix_final.js`
- `romaneiotora_modal_fix_final_cleaned.js`
- `correcao-lista-romaneios.js`
- `modules/core/hybrid-sync-service.js`
- `modules/dashboard/dashboard-core.js`
- `modules/dashboard/sample-data-generator.js`
- `modules/crud/gerenciar-clientes.js`
- `modules/crud/gerenciar-especies.js`
- `modules/modals/modal-clientes.js`
- `modules/modals/modal-especies.js`
- `modules/modals/modal-lista-romaneios.js`
- `modules/reports/imprimir-romaneio.js`
- `modules/romaneio/salvar-romaneio.js`
- `modules/romaneiopct/carregar-romaneio-pct.js`
- `modules/romaneiopct/imprimir-romaneio-pct.js`
- `modules/romaneiopct/modal-clientes-pct.js`
- `modules/romaneiopct/modal-especies-pct.js`
- `modules/romaneiopct/modal-lista-romaneios-pct.js`
- `folha_pagamento/folha.html`
- `folha_pagamento/folha-relatorios.js`
- `folha_pagamento/banco-horas-relatorios.js`
- `folha_pagamento/folha-cargos.js`
- `folha_pagamento/folha-filtros.js`
- `folha_pagamento/folha-firebase-manager.js`
- `folha_pagamento/folha-firebase-optimized.js`
- `folha_pagamento/folha-funcionarios.js`
- `folha_pagamento/folha-lancamentos.js`
- `folha_pagamento/folha-main.js`
- `folha_pagamento/folha-utils.js`
- `admin-access-governance.html`
- `aplicar_correcao_vendas.html`
- `auto_sync_firebase.html`
- `corrigir_fornecedores.html`
- `corrigir_romaneios.html`
- `extrator_dados_dashboard.html`
- `limpar_clientes.html`
- `limpar_especies.html`
- `sincronizar.html`

## Implementacao
- Criado `getCompanyProfileForReport()` em `firebaseService.js`, exposto em `window.firebaseService` e no export ESM.
- Criado `resolveReportCompanyId()` para resolver tenant por claims/auth/local user/user record/current tenant/company_info, sem usar nome ou slug como ID.
- Criada normalizacao central de cabecalho de relatorio com aliases `nome/name`, `endereco/address`, `telefone/phone`, `logo/logoUrl`.
- Servicos paralelos receberam a mesma superficie minima de helper e sanitizacao de tenant.
- `createCompanyAndSetClaim()` em `src/services/firebaseService.js` passou a salvar em `companies/{companyId}/profile`, evitando escrita aninhada em tenant ativo.
- Relatorios e PDFs migrados chamam o helper central antes dos fallbacks antigos.
- Fallbacks antigos foram limitados a caminhos diretos do tenant: `companies/{companyId}/profile` e `companies/{companyId}`.
- Modais, CRUDs, adapters e paginas referenciadas pelo menu foram saneados para nao resolver tenant com `slug`, `nome` ou `name`.
- `notas-fiscais.html` passou a inicializar NFService/config fiscal com tenant resolvido pelo helper central e carregar dados do emitente pelo perfil da empresa.
- `mdf-e.js` passou a preencher o relatorio MDF-e com dados da empresa do tenant e escapar HTML do relatorio impresso.
- `financas.js` teve a funcao duplicada `anexarArquivoConta` removida, preservando a versao mais completa com input persistente.
- `correcao-lista-romaneios.js` foi mantido desativado, mas agora parseavel.
- `romaneiotora_modais.js` teve logs corrompidos por mojibake saneados e a rotina de exportacao Excel truncada recebeu fechamento seguro para voltar a ser parseavel.

## Validacao
- `rg` para fallbacks perigosos (`slug/nome/name` como tenant e `getData('companies')`) retornou sem ocorrencias em JS/HTML ativos, excluindo `docs` e `node_modules`.
- Leituras globais remanescentes de `companies` estao restritas a fluxos admin/superadmin: `company.html`, `firebaseService.js` e `index.html`.
- `rg --files | rg -i "cte|ct-e|dacte"` nao encontrou modulo CT-e/DACTE ativo.
- `node --check` passou para os JS alterados e verificados, incluindo servicos, relatorios, modais, folha e rotinas de romaneio.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `npm test` falhou porque `package.json` nao possui script `test`.

## Plano profissional de correcoes seguintes
1. Criar testes automatizados para `resolveReportCompanyId()` e `getCompanyProfileForReport()` cobrindo usuario comum, cache stale, profile ausente, logo base64, permissao negada em `companies` e usuario sem companyId.
2. Criar smoke tests E2E com dois tenants reais de homologacao para abrir relatorios de vendas, compras, estoque, financeiro, folha, romaneios, NF-e/DANFE e MDF-e validando cabecalho/logo.
3. Consolidar de forma incremental os servicos Firebase paralelos em uma unica fonte de verdade, mantendo compatibilidade ate todos os modulos migrarem.
4. Auditar regras Firebase para confirmar que `companies/{companyId}/profile` e subcolecoes so sao lidas/escritas por usuarios do tenant ou superadmin.
5. Criar rotina segura de backfill de `company_info`/usuarios legados para garantir `companyId` explicito antes de remover fallbacks de compatibilidade.
6. Revisar paginas legadas de manutencao/correcao e decidir se serao protegidas por admin, migradas ou removidas do pacote de producao.
7. Planejar validacao manual assistida em producao controlada, sem migracao de dados e sem deploy automatico nesta story.

## Notas de seguranca
- Nao foram executadas migracoes em dados reais nesta story.
- Nao foi executado deploy nesta story.
- Nao foram alteradas regras Firebase nesta story.
- Mudancas foram feitas de forma aditiva e mantendo fallback por tenant quando possivel.
