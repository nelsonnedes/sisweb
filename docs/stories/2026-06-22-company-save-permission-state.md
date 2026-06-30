# Story: Correção de salvamento do perfil da empresa

## Status
Done

## Contexto
Ao salvar o perfil da empresa em `company.html`, a Function `updateMyCompanyProfile` retornou `permission-denied` para usuario sem papel admin reconhecido. Depois da falha, o frontend limpou `editingId` antes do salvamento concluir; a tentativa seguinte passou a usar `Date.now()` como `companyId`, causando upload de logo para `companies/{timestamp}/profile/logo` e erro `storage/unauthorized`.

## Criterios de aceite
- [x] Falha de permissao nao remove o `editingId` da empresa em edicao.
- [x] Upload de logo usa sempre o tenant/empresa efetiva, nunca `Date.now()` em sessao operacional existente.
- [x] Tela informa de forma clara quando a sessao nao tem permissao de admin da empresa.
- [x] Testes cobrem regressao do estado de edicao e do path de upload.
- [x] Correção publicada em Hosting quando aplicavel.

## Tarefas
- [x] Ajustar resolucao de `companyId` no `saveCompany`.
- [x] Preservar modo de edicao ate o save seguro concluir.
- [x] Melhorar tratamento de erro para `Apenas admin da empresa`.
- [x] Permitir conta primaria legada da empresa por `companyId` + email do perfil, sem depender de assinatura ativa.
- [x] Validar deploy em producao.

## Evidencias
- `npm run lint` passou.
- `npm run typecheck` passou.
- `npm test` passou com 174/174 testes.
- `node --test tests/company-profile-permissions.test.mjs` passou com cobertura do estado de edicao e da conta primaria legada.
- Deploy publicado em `functions:default:updateMyCompanyProfile` e `hosting` no projeto `sisweb-7ce82`.
- Verificacao publicada de `company.html` retornou HTTP 200 com `resolvedFormCompanyId`, `restoreCompanySaveButton`, mensagem de admin e sem o fallback antigo `const draftCompanyId = String(editingId || Date.now())`.
- `updateMyCompanyProfile` confirmado como `ACTIVE` em `us-central1` com runtime `nodejs22`.

## File List
- `company.html`
- `functions/index.js`
- `tests/company-profile-permissions.test.mjs`
