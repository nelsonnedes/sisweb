# Story: Certificado A1 com callable segura e Storage restrito

## Status

Ready for Review

## Contexto

O backlog consolidado entre as sessoes manteve como pendencia real a troca do upload/remocao de certificado A1 para um fluxo mediado por Cloud Functions antes de bloquear escrita direta no Storage em `tenants/{tenantId}/certificados`.

## Objetivo

Fechar o circuito do certificado A1 no backend: o browser continua criptografando o `.pfx/.p12`, mas passa a entregar apenas o blob cifrado para uma callable tenant-scoped que grava Storage/metadados com Admin SDK, remove arquivos antigos com seguranca e permite remocao server-side.

## Acceptance Criteria

- [x] Upload A1 deixa de gravar `Storage` e `Realtime Database` diretamente no browser.
- [x] Nova callable `nf_uploadCertificadoA1` valida tenant/admin fiscal e persiste blob cifrado + metadados saneados no backend.
- [x] Remocao de certificado passa a apagar arquivos e metadados pelo backend, sem `removeFromFirebase()` no cliente.
- [x] `storage.rules` bloqueia upload/delete direto de usuarios comuns em `tenants/{tenantId}/certificados`.
- [x] Descriptografia server-side passa a usar `uploadedBy` salvo no metadado, evitando amarrar a assinatura ao usuario que estiver logado no momento.
- [x] Testes automatizados cobrem callable nova, endurecimento das rules e o corte das escritas diretas no cliente.
- [x] `npm run lint`, `npm run typecheck` e `npm test` passam apos a alteracao.

## Tasks

- [x] Mapear o fluxo atual de `nf-cert.js`, `notas-fiscais.html`, `functions/nf-functions.js` e `storage.rules`.
- [x] Implementar callable segura de upload A1 em `functions/nf-functions.js` e exportar em `functions/index.js`.
- [x] Ajustar o cliente NF para chamar callables em upload/remocao e parar de gravar certificado no browser.
- [x] Endurecer `storage.rules` para restringir `tenants/{tenantId}/certificados` a superadmin/Admin SDK.
- [x] Adicionar/atualizar testes focados de certificado, rules e regressao fiscal.
- [x] Rodar validacoes focadas e gates completos do projeto.

## Implementacao

- `functions/nf-functions.js` ganhou helpers para metadado canonico/legado do certificado, cleanup de arquivos antigos e a callable `nf_uploadCertificadoA1`, que recebe apenas o blob cifrado em base64, grava `tenants/{tenantId}/certificados/...` com Admin SDK e salva metadados saneados em `companies/{tenantId}/fiscal/certificado` com espelho legado.
- A descriptografia server-side passou a priorizar `meta.storageRef` e a derivar a chave com `meta.uploadedBy || uid`, removendo a dependencia acidental do usuario atual para conseguir reutilizar o certificado dentro do tenant.
- `nf_removerCertificado` agora apaga arquivos e metadados completos no backend; `nf-cert.js` passou a usar `chamarCloudFunction('nf_removerCertificado', ...)` e `chamarCloudFunction('nf_uploadCertificadoA1', ...)`, sem `storageService.upload()` nem `removeFromFirebase()` no fluxo A1.
- `nf-cert.js` passou a ler metadados primeiro de `companies/{tenantId}/fiscal/certificado` e depois do caminho legado, mantendo compatibilidade com o estado antigo.
- `notas-fiscais.html` ganhou guardas simples para impedir upload/remocao sem `tenantId` ou `uid` autenticado.
- `storage.rules` foi endurecido para permitir leitura/escrita em `tenants/{tenantId}/certificados` apenas para superadmin; o uso operacional agora fica exclusivamente via Admin SDK/Cloud Functions.
- Foram adicionados testes novos em `tests/nf-cert-callable-secure.test.mjs` e ajustados `tests/security-rbac-multitenant.test.mjs` e `tests/company-logo-storage-policy.test.mjs`.

## Evidencias

- `node --check nf-cert.js`: OK.
- `node --check functions/nf-functions.js`: OK.
- `node --check functions/index.js`: OK.
- `node --test tests/nf-cert-callable-secure.test.mjs tests/security-rbac-multitenant.test.mjs`: OK.
- `node --test tests/nf-cert-callable-secure.test.mjs tests/company-logo-storage-policy.test.mjs tests/fiscal-nfe-events.test.mjs tests/tenant-operational-safe-modules.test.mjs tests/security-rbac-multitenant.test.mjs tests/support-backend.test.mjs`: OK (37/37).
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK (167/167).

## File List

- `docs/stories/2026-06-16-certificado-a1-callable-segura.md`
- `functions/index.js`
- `functions/nf-functions.js`
- `nf-cert.js`
- `nf-config.js`
- `nf-preferencias.js`
- `notas-fiscais.html`
- `storage.rules`
- `tests/company-logo-storage-policy.test.mjs`
- `tests/nf-cert-callable-secure.test.mjs`
- `tests/security-rbac-multitenant.test.mjs`
