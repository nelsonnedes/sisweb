# Story: Certificados fiscais A3 Token/Cartao

## Status
Ready for Review

## Contexto
Clientes podem ter certificado A1, A3 em token USB, A3 em cartao/smartcard ou A3 em nuvem. Certificados A3 fisicos mantem a chave privada presa ao dispositivo e nao podem ser exportados para o SaaS.

## Problema
A tela de NF-e sugeria "deteccao automatica" de Token A3 usando WebCrypto/WebAuthn. Isso nao identifica certificado ICP-Brasil para NF-e e poderia levar o usuario a acreditar que o sistema estava pronto para assinar com token/cartao quando ainda nao existe ponte local homologada.

## Objetivo
Deixar o fluxo claro e seguro: A1 continua suportado via PFX criptografado no Storage; A3 fisico fica marcado como dependente de ponte local/app/Native Messaging/PKCS#11/CNG/CAPI; A3 nuvem fica como integracao remota futura.

## Acceptance Criteria
- [x] A tela nao promete deteccao automatica de Token A3 pelo navegador.
- [x] O sistema nao salva PIN do token/cartao.
- [x] A3 Token/Cartao e salvo como referencia "requer ponte local" e bloqueia emissao ate existir assinatura homologada.
- [x] A Cloud Function A1 retorna erro claro se o certificado configurado nao for A1.
- [x] Teste automatizado cobre o fluxo A3 fisico para evitar regressao.

## File List
- `docs/stories/2026-05-17-certificados-fiscais-a3-token-cartao.md`
- `functions/index.js`
- `functions/nf-functions.js`
- `notas-fiscais.html`
- `nf-cert.js`
- `nf-config.js`
- `nf-preferencias.js`
- `tests/company-logo-storage-policy.test.mjs`
- `tests/nf-cert-callable-secure.test.mjs`
- `tests/security-rbac-multitenant.test.mjs`

## Implementacao
- `notas-fiscais.html` mudou o rotulo para `A3 Token / Cartao (requer ponte local)`.
- Removida a falsa deteccao por `crypto.subtle.generateKey()`/WebCrypto.
- O botao agora verifica uma ponte local (`http://127.0.0.1:37773/health` por padrao) ou objeto `window.SiswebA3Bridge`, sem afirmar que o token foi detectado pelo navegador.
- Removidos campos de PIN, slot e biblioteca PKCS#11 da persistencia da tela. O PIN deve ser solicitado pela ponte local no momento da assinatura.
- `nf-cert.js` passou a expor `verificarPonteA3Local()` e `salvarReferenciaA3Token()`.
- `verificarStatusCertificado()` agora retorna `ponte_local_requerida` para A3 fisico e bloqueia emissao com mensagem clara.
- `functions/nf-functions.js` valida metadados do certificado e recusa fluxo A1 quando o tenant esta configurado como A3 token/nuvem.

## Validacao
- `node --check nf-cert.js functions/nf-functions.js` passou.
- `npm run lint` passou.
- `npm run typecheck` passou.
- `npm test` passou com 5 testes.
- `git diff --check` passou no escopo alterado, com apenas aviso LF/CRLF do Git.

## Plano profissional de correcoes seguintes
1. Definir arquitetura oficial para A3 fisico: app local com HTTP loopback, extensao + Native Messaging, ou integracao com fornecedor.
2. Documentar contrato da ponte local: `/health`, listar certificados, assinar XML, testar PIN, retornar certificado publico e erros padronizados.
3. Implementar smoke test de A1 em homologacao apos deploy de Storage/Functions.
4. Para A3 nuvem, escolher provedor real e contrato OAuth/API antes de habilitar botao em producao.

## Notas de seguranca
- Certificado A3 fisico nao deve ter chave privada exportada.
- PIN do token/cartao nao deve ser salvo no Firebase nem no localStorage.
- Sem ponte local homologada, a emissao NF-e com A3 fisico deve ficar bloqueada.
