# Story: Dashboard logout estrito e guard de sessao para callables fiscais

## Status

Ready for Review

## Contexto

Ao revisar os erros recentes de `notas-fiscais.html` e o comportamento de logout, apareceram dois problemas reais e independentes:

1. O `index.html` ainda aceitava abrir o dashboard sem usuario autenticado, reaproveitando `company_info`/`window.appTenantId` em cenarios online apos logout parcial.
2. O frontend fiscal ja havia sido ajustado para usar `callFunction`, mas a chamada generica ainda podia subir Cloud Functions antes da sessao/tokens do Firebase Auth estarem prontos, agravando respostas `401` em callables autenticadas.

Em paralelo, o ambiente publicado continua sem as callables `nf_obterConfiguracaoFiscal` e `nf_obterResumoCertificadoFiscal`, o que explicava os erros de CORS/preflight vistos no console ao carregar a tela fiscal. Nesta rodada, a leitura fiscal foi ajustada para usar primeiro o `loadFromFirebase` tenant-scoped ja existente, removendo essa dependencia como bloqueio operacional.

## Objetivo

Endurecer a abertura do dashboard e o consumo de callables autenticadas sem duplicar fluxos locais, preservando os componentes ja existentes de sessao/tenant e deixando clara a pendencia real que ainda depende de publish das Functions.

## Acceptance Criteria

- [x] `index.html` nao reabre o dashboard online usando tenant cacheado quando nao ha usuario autenticado.
- [x] O dashboard redireciona para `login.html?reason=tenant_required` quando a sessao nao existe mais.
- [x] `firebaseService.js` aguarda a sessao do Auth antes de chamar callables e tenta um refresh unico em erro `401/unauthenticated`.
- [x] `authService.logout()` limpa sessao local e contexto de tenant de forma centralizada.
- [x] Testes focados e gates completos passam.
- [x] Hosting publicado com a correcao de frontend.
- [x] Leitura fiscal volta a funcionar sem depender obrigatoriamente das callables `nf_obterConfiguracaoFiscal` e `nf_obterResumoCertificadoFiscal`.

## Tasks

- [x] Revisar logs recentes de NF, logout e rotas operacionais.
- [x] Confirmar alinhamento com stories anteriores de tenant seguro, PWA/login e certificado A1.
- [x] Ajustar o guard do dashboard reaproveitando `waitForAuthReady()` e a limpeza central de tenant.
- [x] Reforcar `callFunction()` para esperar sessao e tratar retry unico de token.
- [x] Adicionar testes automatizados para dashboard/logout/callable guard.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`.
- [x] Publicar `hosting`.
- [x] Remover a dependencia operacional das callables fiscais de leitura usando o servico tenant-scoped ja existente.
- [x] Corrigir bootstrap do Financeiro para aguardar `firebaseService` central e preservar `resolveAuthenticatedTenant`.
- [x] Evitar fallback espurio para `nf_obterResumoCertificadoFiscal` quando a leitura direta ja confirmou certificado ausente.
- [x] Atualizar cache-bust dos scripts fiscais e do Financeiro antes do novo deploy.
- [x] Garantir chamada autenticada explicita para callables fiscais `nf_*` quando o SDK modular nao anexar token.
- [x] Adaptar as callables fiscais ao contrato Gen2 de `firebase-functions@7`, preservando os handlers legados `(data, context)`.
- [x] Reconhecer a conta operacional primaria ativa da empresa como autorizada para gerenciar certificado fiscal, sem liberar subusuarios sem permissao explicita.
- [x] Remover fallback silencioso de municipio `3550308` no XML NF-e e exigir codigo IBGE fiscal do emitente/destinatario.

## Implementacao

- `index.html` ganhou helpers locais para:
  - esperar o `Auth` do dashboard legado via `waitForAuthReady(2500)`;
  - permitir fallback por `company_info` apenas em contingencia offline;
  - limpar contexto inseguro de tenant;
  - redirecionar para `login.html?reason=tenant_required&redirect=index.html` quando nao existir sessao valida.
- `firebaseService.js` ganhou `primeCallableAuthSession()` e retry unico em `callFunction()` para esperar o usuario autenticado e renovar token antes de falhar em callables protegidas.
- `firebaseService.js` tambem passou a reconhecer o usuario ja exposto pela pagina (`window.firebaseAuthUser`/`window.currentUser`) e, para callables fiscais `nf_*`, usar o protocolo HTTP callable com `Authorization: Bearer <idToken>` quando `auth.currentUser` do SDK ainda estiver vazio ou quando o SDK retornar `unauthenticated`.
- `firebaseService.js` passou a registrar o usuario real de Firebase Auth em `window.firebaseAuthUser` e a chamar `nf_*` diretamente pelo protocolo HTTP callable com `Authorization: Bearer <idToken>`, evitando tentativas SDK/compat sem token antes do upload A1.
- Apos novo 401 em producao com `v2`, `firebaseService.js` foi ajustado para usar o SDK oficial `httpsCallable` primeiro apos renovar o ID token, deixando o fetch manual com `Authorization: Bearer <idToken>` apenas como fallback para `unauthenticated`; isso preserva o protocolo callable v2 e evita duplicar backend.
- `firebaseService.js` tambem passou a limpar `currentUser`, `persistentUser`, `siswebAuthSession`, `sessionStorage` e contexto de tenant dentro do `authService.logout()`, reduzindo logout parcial em telas que usam apenas o servico modular.
- `nf-config.js` passou a ler `companies/{tenantId}/fiscal/config` primeiro via `loadFromFirebase`, usando a callable `nf_obterConfiguracaoFiscal` apenas como fallback.
- `nf-cert.js` passou a ler o resumo do certificado primeiro por `companies/{tenantId}/fiscal/certificado` e, se necessario, pelo caminho legado exato `tenants/{tenantId}/config-fiscal/certificado`, deixando `nf_obterResumoCertificadoFiscal` apenas como fallback.
- `nf-cert.js` passou a aguardar `window.firebaseService.callFunction` e removeu o fallback legado `window.firebase.functions().httpsCallable`, que podia disparar `nf_uploadCertificadoA1` sem Auth.
- `functions/nf-functions.js` ganhou o adaptador `onFiscalCall(handler)` para normalizar o request de Callable Gen2 em `{ data, auth }` antes de chamar os handlers fiscais existentes. A causa raiz do `401` persistente era que `firebase-functions@7` entrega um request v2, enquanto o codigo fiscal ainda esperava a assinatura antiga `(data, context)`, deixando `context.auth` vazio.
- Todas as 13 funcoes fiscais `nf_*` passaram a usar `onFiscalCall`, mantendo Gen2/Node 22 e evitando rebaixar as funcoes para Gen1.
- `firebaseService.js` passou a usar `httpsCallable` do SDK oficial para `nf_*`, com refresh de token antes da chamada e uma unica repeticao em `unauthenticated`; o fallback HTTP manual com `Authorization` ficou fora do caminho principal de `callFunction`.
- `functions/nf-functions.js` passou a permitir que a conta operacional primaria ativa do proprio tenant gerencie o certificado fiscal. Subusuarios/delegados identificados por `adminOwnerUid` ou `role=sub_admin` continuam exigindo permissao fiscal/certificado explicita.
- `notas-fiscais.html` passou a expor explicitamente `showTab`, handlers de certificado e botoes de configuracao/certificado com `type="button"`, removendo falhas de `onclick` inline como `showTab is not defined`.
- `nf-validator.js`, `nf-xml-builder.js` e `notas-fiscais.html` passaram a exigir `codigoMunicipio` IBGE de 7 digitos para `ide.cMunFG`, emitente e destinatario, sem preencher automaticamente Sao Paulo (`3550308`) quando o cadastro esta incompleto.
- O tenant operacional `1749492103278` recebeu `companies/1749492103278/fiscal/config/empresa/endereco/codigoMunicipio = 1507607` para alinhar a empresa JN - IND COM EXP DE MADEIRAS LTDA ao municipio Sao Miguel do Guama/PA.
- `notas-fiscais.html` passou a preencher a data de emissao no `DOMContentLoaded`, em vez de depender do `change` do produto, evitando bloqueio inicial espurio na revisao fiscal.
- Foi criado `tests/dashboard-auth-callable-guard.test.mjs` para cobrir:
  - guard do dashboard sem reaproveitar tenant online;
  - retry controlado de callables autenticadas;
  - limpeza central de logout.

## Evidencias

- `node --test tests/dashboard-auth-callable-guard.test.mjs tests/tenant-operational-safe-modules.test.mjs tests/pwa-mobile-menu-session.test.mjs tests/global-first-wave.test.mjs`: OK (23/23).
- `node --test tests/nf-cert-callable-secure.test.mjs`: OK.
- `node --test tests/tenant-operational-safe-modules.test.mjs tests/nf-cert-callable-secure.test.mjs tests/dashboard-auth-callable-guard.test.mjs tests/company-logo-storage-policy.test.mjs`: OK (20/20).
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK (170/170).
- `firebase deploy --only hosting --project sisweb-7ce82`: publicado.
- Verificacao HTTP do hosting publicado:
  - `index.html` servido contem `redirectDashboardToLogin` e o retorno antecipado por `tenantContext.redirected`.
  - `firebaseService.js` servido contem `primeCallableAuthSession` e refresh de token em retry.
  - `financas.html` servido contem `window.__siswebFirebaseServiceReady`, `financeFirebaseLocalService` e nao contem `signInAnonymously`.
  - `notas-fiscais.html` servido contem cache-bust de `firebaseService.js`, `nf-config.js` e `nf-cert.js`.
- `nf-cert.js` servido contem o estado `missing/unavailable` para evitar fallback espurio de callable.
- `firebase deploy --only functions:nf_uploadCertificadoA1 --project sisweb-7ce82 --dry-run` passou com `FUNCTIONS_DISCOVERY_TIMEOUT=60`.
- `firebase deploy --only functions:nf_uploadCertificadoA1 --project sisweb-7ce82`: publicado.
- `firebase deploy --only functions:nf_obterResumoCertificadoFiscal --project sisweb-7ce82`: criado/publicado.
- `firebase deploy --only functions:nf_obterConfiguracaoFiscal --project sisweb-7ce82`: criado/publicado.
- `firebase functions:list --project sisweb-7ce82` confirmou `nf_uploadCertificadoA1`, `nf_obterResumoCertificadoFiscal` e `nf_obterConfiguracaoFiscal` como `v2 callable` em `us-central1`.
- `node --test tests/dashboard-auth-callable-guard.test.mjs tests/nf-cert-callable-secure.test.mjs tests/tenant-operational-safe-modules.test.mjs`: OK (7/7).
- `firebaseService.js` validado com fallback explicito `Authorization: Bearer <idToken>` para `nf_*`.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK (170/170).
- `firebase deploy --only hosting --project sisweb-7ce82`: publicado em 2026-06-18.
- Verificacao HTTP pos-deploy confirmou `notas-fiscais.html` com cache-bust `2026-06-18-nf-auth-explicit-v1` e `firebaseService.js` publicado com `callFunctionWithExplicitAuth`, `requiresAuthenticatedCallable` e header `Authorization: Bearer`.
- 2026-06-18: reproducao no browser confirmou `showTab is not defined` e `401` em `nf_uploadCertificadoA1` antes do fix; o endpoint manual sem token retorna `{"error":{"message":"Autenticação obrigatória","status":"UNAUTHENTICATED"}}`, confirmando que a falha estava no transporte de Auth do frontend.
- 2026-06-18: `node --test tests/dashboard-auth-callable-guard.test.mjs tests/nf-cert-callable-secure.test.mjs tests/tenant-operational-safe-modules.test.mjs`: OK (7/7).
- 2026-06-18: `npm run lint`, `npm run typecheck` e `npm test`: OK (170/170).
- 2026-06-18: `firebase deploy --only hosting --project sisweb-7ce82`: publicado com cache-bust `2026-06-18-nf-auth-explicit-v2`.
- 2026-06-18: verificacao HTTP confirmou `notas-fiscais.html` com `window.showTab` cedo, `window.uploadCertificado`, botoes de certificado `type="button"`, `firebaseService.js` com `if (needsAuth && currentUser)` e `nf-cert.js` sem fallback `window.firebase.functions().httpsCallable`.
- 2026-06-18: browser in-app recarregado em `notas-fiscais.html`, aba Configuracao abriu sem novo `showTab is not defined`; o reload limpou arquivo/senha do certificado, bloqueando apenas o smoke final de upload real nesta execucao.
- 2026-06-18: logs posteriores ainda mostraram `nf_uploadCertificadoA1` com `401` usando `firebaseService.js?v=2026-06-18-nf-auth-explicit-v2`; a chamada fiscal foi recalibrada para SDK oficial primeiro e cache-bust `2026-06-18-nf-auth-explicit-v3`.
- 2026-06-18: `npm run lint`, `npm run typecheck`, `npm test`: OK (170/170); apos cache-bust `v3`, `node --test tests/dashboard-auth-callable-guard.test.mjs tests/nf-cert-callable-secure.test.mjs tests/tenant-operational-safe-modules.test.mjs`: OK (7/7).
- 2026-06-18: `firebase deploy --only "database,storage" --project sisweb-7ce82 --non-interactive`: Realtime Database Rules e Storage Rules publicados.
- 2026-06-18: `firebase deploy --only "functions:nf_uploadCertificadoA1,functions:nf_removerCertificado,functions:nf_salvarReferenciaCertificado,functions:nf_obterResumoCertificadoFiscal,functions:nf_obterConfiguracaoFiscal" --project sisweb-7ce82 --non-interactive`: funcoes fiscais atualizadas em `us-central1`.
- 2026-06-18: `firebase deploy --only "hosting" --project sisweb-7ce82 --non-interactive`: Hosting publicado com cache-bust `2026-06-18-nf-auth-explicit-v3`.
- 2026-06-18: verificacao HTTP do ambiente publicado confirmou `notas-fiscais.html` com cache-bust `v3`, `firebaseService.js` com SDK oficial antes do fallback manual, `nf-cert.js` aguardando `firebaseService.callFunction`, sem `window.firebase.functions().httpsCallable`, e handlers de certificado expostos no DOM correto.
- 2026-06-18: `node --test tests/fiscal-nfe-events.test.mjs tests/security-rbac-multitenant.test.mjs tests/nf-cert-callable-secure.test.mjs`: OK (14/14) apos adaptar as callables fiscais para Gen2.
- 2026-06-18: `node -e "const nf=require('./functions/nf-functions'); console.log(Object.keys(nf).filter(k=>k.startsWith('nf_')).length, typeof nf.nf_uploadCertificadoA1);"` retornou `13 function`.
- 2026-06-18: deploy escopado das 13 funcoes fiscais `nf_*` concluido com sucesso em Gen2/Node 22.
- 2026-06-18: `firebase deploy --only "hosting" --project sisweb-7ce82 --non-interactive`: Hosting publicado com cache-bust `2026-06-18-nf-auth-explicit-v4`.
- 2026-06-18: verificacao HTTP confirmou `notas-fiscais.html` com cache-bust `v4`, `firebaseService.js` com `updateCurrentUser`, `auth` exposto no servico global e chamada SDK-only para `nf_*` no `callFunction`.
- 2026-06-18: ao testar upload A1, o erro mudou de `Autenticação obrigatória` para `Apenas admin fiscal da empresa pode remover certificado`, confirmando que Auth/Gen2 passou e que o bloqueio real restante era RBAC.
- 2026-06-18: RTDB confirmou que `users/J9of0kidtbcEDGG8v1ukTeibhuk2` e `companies/1749492103278/users/J9of0kidtbcEDGG8v1ukTeibhuk2` pertencem ao tenant, estao ativos, mas nao possuem `role`/`adminPermissions`; a autorizacao fiscal foi alinhada ao modelo da conta operacional primaria ativa.
- 2026-06-18: `node --test tests/security-rbac-multitenant.test.mjs tests/nf-cert-callable-secure.test.mjs tests/fiscal-nfe-events.test.mjs tests/dashboard-auth-callable-guard.test.mjs`: OK (17/17).
- 2026-06-18: `npm run lint`, `npm run typecheck` e `npm test`: OK (170/170).
- 2026-06-18: `firebase deploy --only "functions:nf_assinarXML,functions:nf_enviarSEFAZ,functions:nf_consultarNFe,functions:nf_cancelarNFe,functions:nf_cartaCorrecaoNFe,functions:nf_inutilizarNumeracao,functions:nf_uploadCertificadoA1,functions:nf_removerCertificado,functions:nf_salvarReferenciaCertificado,functions:nf_salvarConfiguracaoFiscal,functions:nf_configurarCertNuvem,functions:nf_obterResumoCertificadoFiscal,functions:nf_obterConfiguracaoFiscal" --project sisweb-7ce82 --non-interactive`: 13 funcoes fiscais publicadas apos ajuste de RBAC.
- 2026-06-18: `firebase functions:list --project sisweb-7ce82` confirmou as funcoes `nf_*`, incluindo `nf_uploadCertificadoA1`, como `v2 callable`, `us-central1`, `nodejs22`.
- 2026-06-18: tentativa de clique automatizado no browser do Codex nao criou `companies/1749492103278/fiscal/certificado`; nao foi considerada smoke real porque o controle do navegador nao conseguiu executar o fluxo da pagina de forma confiavel. Pendencia operacional restante: retestar o upload A1 manualmente na sessao normal.
- 2026-06-18: novo teste manual chegou ao backend e falhou em IAM do Storage: `240003261222-compute@developer.gserviceaccount.com` sem `storage.objects.create` no bucket `sisweb-7ce82.firebasestorage.app`.
- 2026-06-18: concedido `roles/storage.objectAdmin` no bucket `gs://sisweb-7ce82.firebasestorage.app` para `serviceAccount:240003261222-compute@developer.gserviceaccount.com`, necessario para a Function criar, listar, remover e ler certificados A1 cifrados.
- 2026-06-18: politica IAM do bucket confirmada via Storage JSON API com `bindingFound: true` para o service account da Function.
- 2026-06-18: certificado A1 enviado com sucesso; RTDB confirmou metadados em `companies/1749492103278/fiscal/certificado`, sem persistir `pfxEnc`, e Storage confirmou o objeto cifrado `tenants/1749492103278/certificados/cert_a1_1781805044661_f178bf6edede.enc`.
- 2026-06-18: revisao da tela de emissao em homologacao confirmou que a sessao esta funcional, mas o rascunho atual ainda tem pendencias fiscais reais: destinatario `Joanes` sem CPF/CNPJ, frete FOB sem transportador/veiculo/volumes e senha A1 de emissao vazia.
- 2026-06-18: `node --test tests/company-logo-storage-policy.test.mjs`: OK (13/13) apos blindagem de municipio IBGE.
- 2026-06-18: `firebase database:set "/companies/1749492103278/fiscal/config/empresa/endereco/codigoMunicipio" -d '"1507607"' -f --project sisweb-7ce82`: dado operacional persistido.
- 2026-06-18: `npm run lint`, `npm run typecheck` e `npm test`: OK (170/170) apos remover fallback `3550308`.
- 2026-06-18: `nf-validator.js` reforcado para validar tambem `empresa.endereco.codigoMunicipio` em `validarConfigParaEmissao`.
- 2026-06-18: `npm run lint`, `npm run typecheck`, `node --test tests/company-logo-storage-policy.test.mjs` e `npm test`: OK (170/170) apos reforco de config.
- 2026-06-18: `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`: Hosting publicado com `nf-municipio-ibge-v1`.
- 2026-06-18: verificacao HTTP confirmou `notas-fiscais.html` com cache-bust `nf-municipio-ibge-v1`, sem `3550308`, `nf-xml-builder.js` com `requireCodigoMunicipio` e `nf-validator.js` com `validarCodigoMunicipio` + validacao de IBGE da empresa.
- 2026-06-18: `notas-fiscais.html` corrigido para executar `preencherDataEmissaoPadraoNF()` na inicializacao; `node --test tests/company-logo-storage-policy.test.mjs`, `npm run lint`, `npm run typecheck` e `npm test`: OK (170/170).
- 2026-06-18: deploy final de Hosting concluido e browser in-app confirmou `nfDataEmissao=2026-06-18`, `nfModFrete=9`, scripts fiscais com `nf-municipio-ibge-v1` e nenhum erro critico de Auth/certificado no console; pendencia operacional do smoke ficou em selecionar cliente valido, itens e informar senha A1.

## File List

- `docs/stories/2026-06-17-dashboard-logout-nf-callable-session-guard.md`
- `index.html`
- `firebaseService.js`
- `nf-config.js`
- `nf-cert.js`
- `nf-validator.js`
- `nf-xml-builder.js`
- `nf-service.js`
- `notas-fiscais.html`
- `financas.html`
- `financas.js`
- `functions/nf-functions.js`
- `tests/dashboard-auth-callable-guard.test.mjs`
- `tests/nf-cert-callable-secure.test.mjs`
- `tests/fiscal-nfe-events.test.mjs`
- `tests/security-rbac-multitenant.test.mjs`
- `tests/tenant-operational-safe-modules.test.mjs`
