# Story: Storage-first para logos e anexos

## Status
Ready for Review

## Contexto
O Sisweb usa cabecalhos de relatorios, PDFs e documentos fiscais com dados da empresa do usuario logado. A logo da empresa e anexos binarios nao devem ser persistidos como base64 no Realtime Database ou em `localStorage`; o local correto para binarios e o Firebase Storage, deixando no perfil apenas caminho, URL e metadados.

## Problema
O fluxo de cadastro de empresa ainda tinha fallback para salvar logo como base64 local quando o upload no Storage falhava. Alem disso, servicos paralelos nao expunham uma interface uniforme para upload/URL de Storage, e as Cloud Functions ainda aceitavam campos de base64 como entrada de perfil.

## Objetivo
Tornar o fluxo de logo da empresa Storage-first, bloquear novas gravacoes base64, preservar compatibilidade de leitura para logos legadas e preparar a migracao segura dos dados existentes.

## Acceptance Criteria
- [x] Nova logo de empresa e enviada para `companies/{companyId}/profile/logo/{fileName}` no Firebase Storage.
- [x] Perfil da empresa persiste `logoStoragePath`, `logoUrl` e metadados, sem gravar novo `logoBase64`.
- [x] Fluxo de cadastro/edicao de empresa nao possui fallback de persistencia base64.
- [x] Helpers Firebase expõem upload/download/delete de Storage de forma centralizada.
- [x] Regras de Storage permitem upload/delete de logo por tenant ativo/trial e suportam claims `companyId`, `companyID` e `tenantId`.
- [x] Relatorios seguem capazes de ler logo por URL/path de Storage e mantem fallback de leitura para base64 legado ate a migracao.
- [x] `npm test` existe e valida a politica Storage-first.
- [x] `npm run lint`, `npm run typecheck` e `npm test` passam.

## File List
- `docs/stories/2026-05-17-storage-first-logos-anexos.md`
- `package.json`
- `scripts/audit-company-logos-storage.cjs`
- `scripts/migrate-company-logos-to-storage.cjs`
- `tests/company-logo-storage-policy.test.mjs`
- `company.html`
- `scripts/admin/admin-main.js`
- `firebaseService.js`
- `src/services/firebaseService.js`
- `firebaseService.unified.js`
- `modules/core/firebase-service.js`
- `functions/index.js`
- `storage.rules`
- `storageService.js`
- `nf-storage.js`
- `nf-cert.js`
- `notas-fiscais.html`
- `financas.js`
- `vendas.js`
- `compras.js`
- `estoque.js`
- `folha_pagamento/banco-horas-relatorios.js`
- `folha_pagamento/folha-relatorios.js`

## Implementacao
- `company.html` agora usa upload Storage-first para logo, com limite de 2MB alinhado ao `storage.rules`.
- Removidos os helpers locais de persistencia DataURL/base64 da tela de empresa; o preview local usa `URL.createObjectURL`.
- O editor administrativo de empresas agora envia a logo para Storage com `uploadCompanyLogo()` antes de salvar o perfil, sem montar `logoBase64` novo.
- O perfil salvo passa a carregar `logo`, `logoUrl`, `logoStoragePath`, `logoPath`, `logoFileName`, `logoContentType`, `logoSize` e `logoUpdatedAt`.
- `src/services/firebaseService.js` recebeu `uploadCompanyLogo()`, `getDownloadURL`/`getStorageDownloadURL` e API `storage`.
- `firebaseService.js` recebeu `uploadFile()`, `uploadCompanyLogo()`, `getStorageDownloadURL()`, `deleteStorageFile()` e API `storage`.
- Normalizadores de empresa priorizam `logoUrl`/`logoStoragePath` antes de qualquer base64 legado.
- `functions/index.js` sanitiza metadados de logo e nao aceita mais `payload.logoBase64`/`input.logoBase64` como fonte de nova gravacao.
- `storage.rules` foi ajustado para claims alternativas e delete seguro de logo.
- `storageService.js` centraliza o contrato de anexos com `uploadAttachment()` e `normalizeAttachmentMeta()`.
- `financas.js` passou a usar o contrato centralizado para anexos de contas, substituicoes e comprovantes de historico/pagamento.
- `vendas.js`, `compras.js`, `estoque.js`, `financas.js`, `banco-horas-relatorios.js` e `folha-relatorios.js` foram ajustados para priorizar URL/path de Storage antes do base64 legado.
- Criado `npm test` com teste de regressao Storage-first.
- Criado `npm run audit:company-logos` para auditoria dry-run de logos legadas em base64, sem escrita no banco ou Storage.
- O auditor agora usa `FIREBASE_DATABASE_URL` quando informado, possui fallback para a URL do RTDB do projeto e falha rapidamente quando `GOOGLE_APPLICATION_CREDENTIALS` aponta para arquivo inexistente.
- Criado `npm run migrate:company-logos` para migracao assistida de logos legadas para Storage, com `--apply` obrigatorio para gravar e `--cleanup-base64` separado para remover base64 legado.
- O migrador gera URL tokenizada do Firebase Storage, grava `logoUrl`/`logoStoragePath` no root e em `/profile`, e por padrao roda somente em dry-run.
- O migrador trata cleanup pos-migracao: quando a empresa ja tem `logoUrl`/`logoStoragePath`, `--apply --cleanup-base64` remove somente `logoBase64`/`logoData`, sem reenviar a logo.
- Cleanup base64 final executado via Cloud Shell para `companyId=1774030248295`; auditoria final retornou `companiesWithBase64Logo=0`, `estimatedBase64Bytes=0` e `candidates=[]`.
- `storageService.js` agora expoe `upload()` e `download()` para caminhos tenant-scoped (`companies/{tenantId}/...` ou `tenants/{tenantId}/...`), usados por modulos fiscais.
- `notas-fiscais.html` carrega `storageService.js` e expoe `uploadFile`, `getStorageDownloadURL`, `deleteStorageFile` e API `storage` no `window.firebaseService`.
- `nf-storage.js` deixou de salvar XML fiscal no Realtime Database quando Storage estiver indisponivel.
- `nf-cert.js` deixou de gravar novo certificado A1 como base64 no Database quando Storage estiver indisponivel; leitura legada de `pfxEnc` permanece para compatibilidade.
- `storage.rules` recebeu regras tenant-scoped para `companies/{companyId}/fiscal/**` e `tenants/{tenantId}/certificados/**`.

## Validacao
- `node --check firebaseService.js`, `src/services/firebaseService.js`, `functions/index.js`, `firebaseService.unified.js`, `modules/core/firebase-service.js` e `scripts/audit-company-logos-storage.cjs` passaram.
- `node --check` passou para `storageService.js`, `financas.js`, `vendas.js`, `compras.js`, `estoque.js`, `folha_pagamento/banco-horas-relatorios.js`, `folha_pagamento/folha-relatorios.js`, `scripts/admin/admin-main.js`, `scripts/audit-company-logos-storage.cjs` e `scripts/migrate-company-logos-to-storage.cjs`.
- `npm test` passou, incluindo regressao para migracao e Storage fiscal sem novo fallback base64.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `git diff --check` passou no escopo alterado; apenas avisos de normalizacao LF/CRLF foram emitidos pelo Git.
- Varredura confirmou ausencia de fallback novo de base64 em `company.html` e ausencia de `payload.logoBase64`/`input.logoBase64` em `functions/index.js`.
- Varredura confirmou ausencia de `readAsDataURL`/`readFileAsDataURL` e `logoBase64:` novo em `company.html` e `scripts/admin/admin-main.js`.
- Execucao local do auditor confirmou falha rapida quando `C:\Secrets\sisweb-service-account.json` nao esta acessivel; nenhuma escrita foi feita.
- Auditoria executada via Cloud Shell em 2026-05-17 retornou 4 empresas, 1 empresa com logo base64 legada (`companyId` 1774030248295), 0 logos em Storage e cerca de 2.700.246 bytes de base64 duplicado em `profile.logo` e `profile.logoBase64`.
- Migracao executada via Cloud Shell em 2026-05-17 com `--apply --company-id=1774030248295`, gravando `companies/1774030248295/profile/logo/migrated-1779051889422.png` no Storage e preenchendo `logoUrl`/`logoStoragePath`. `cleanupBase64=false`; os campos base64 legados ainda permanecem para rollback ate o smoke test.
- Smoke test visual informado pelo usuario confirmou que a logo migrada apareceu nos cabecalhos. Auditoria pos-migracao retornou `companiesWithStorageLogo=1`, `companiesWithLogoUrl=1`, `companiesWithBase64Logo=1`, restando apenas `profileLogoBase64`.
- Cleanup base64 executado via Cloud Shell em 2026-05-17 removeu `companies/1774030248295/logoBase64`, `companies/1774030248295/logoData`, `companies/1774030248295/profile/logoBase64` e `companies/1774030248295/profile/logoData`.
- Auditoria final via Cloud Shell em 2026-05-17 retornou `checkedCompanies=4`, `companiesWithStorageLogo=1`, `companiesWithLogoUrl=1`, `companiesWithBase64Logo=0`, `estimatedBase64Bytes=0` e `candidates=[]`.
- `node --check storageService.js nf-storage.js nf-cert.js` passou apos ajustes fiscais.

## Plano profissional de correcoes seguintes
1. Validar novamente cabecalhos de relatorios do tenant migrado em company, admin, vendas, compras, estoque, financeiro, folha, romaneios, DANFE e MDF-e apos cleanup.
2. Rodar smoke test fiscal em homologacao: upload de certificado A1, emissao/salvamento de XML NF-e e leitura do certificado criptografado.
3. Unificar anexos dos modulos fora de financeiro no contrato `{ storagePath, downloadURL, fileName, contentType, size, uploadedAt, uploadedBy }`.
4. Revisar/remover dados legados `tenants/{tenantId}/config-fiscal/certificado/pfxEnc` apos confirmacao de certificados migrados para Storage.
5. Criar rotina operacional de limpeza de objetos antigos de logo no Storage com janela de retencao.
6. Avaliar CT-e/DACTE quando os arquivos ativos forem integrados ao menu, mantendo o mesmo contrato Storage-first.

## Notas de seguranca
- A migracao com `--apply` e o cleanup base64 foram executados apenas para `companyId=1774030248295`.
- Nenhum deploy foi executado nesta story.
- Leitura legada de certificado `pfxEnc` continua disponivel para nao quebrar clientes existentes antes de migracao fiscal controlada.
