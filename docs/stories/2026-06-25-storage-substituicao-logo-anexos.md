# Story: Storage inteligente para substituicao de logos e anexos

## Status
Done

## Contexto
O Firebase Storage grava objetos por caminho. Se cada upload usa um caminho com timestamp para o mesmo artefato logico, o sistema preserva todas as versoes antigas e aumenta custo/volume sem necessidade. Isso estava acontecendo no fluxo de logo da empresa e podia ocorrer em substituicoes de anexos financeiros.

## Objetivo
Padronizar o uso do Storage em modo multi-tenant: logo de empresa deve ser objeto canonico por tenant; anexos novos continuam em modo append; substituicoes de anexos/comprovantes devem reaproveitar o caminho anterior ou limpar o objeto antigo somente depois de salvar o registro no banco.

## Criterios de aceite
- [x] Nova logo de empresa usa caminho canonico `companies/{companyId}/profile/logo/current`.
- [x] Reenvio de logo remove objeto legado referenciado, se estiver dentro do prefixo da mesma empresa.
- [x] URLs tokenizadas ou `gs://` sao normalizadas para caminho de Storage antes de substituir/remover.
- [x] Upload novo de anexo financeiro continua criando objeto novo.
- [x] Substituicao de anexo/comprovante financeiro usa `replaceStoragePath` quando ha objeto anterior.
- [x] Remocoes de anexos/comprovantes acontecem somente depois de persistir a alteracao no banco.
- [x] `compras.js`/`compras.html` nao receberam fluxo duplicado de anexos; continuam usando os contratos compartilhados existentes.

## Implementacao
- `firebaseService.js` passou a enviar logos para `companies/{companyId}/profile/logo/current` e limpar o caminho antigo referenciado quando for seguro.
- `firebaseService.js` expoe `extractStoragePathFromUrl`/`extractFirebaseStoragePathFromUrl` para telas que precisem normalizar URL de Storage.
- `company.html` envia o caminho anterior normalizado ao trocar a logo, evitando que URLs antigas fiquem sem limpeza.
- `scripts/admin/admin-main.js` usa o payload atual da empresa para informar o caminho anterior ao upload administrativo da logo.
- `storageService.js` agora diferencia modo `append` e `replace`, normalizando caminho bruto, URL tokenizada ou `gs://`.
- `financas.js` usa `replaceStoragePath` em substituicao de anexo e comprovante, mantendo append apenas em anexos novos.
- `financas.js` deixa de apagar comprovantes antigos quando o salvamento online falhar.
- `sw.js` recebeu bump de versao para `2026-06-25-storage-replace-v1` para invalidar cache PWA com os novos contratos.

## Evidencias
- `npm run lint`: OK (0 warnings, 0 errors).
- `npm run typecheck`: OK (sem erros TS).
- `npm test`: OK, 180/180 (incluindo 2/2 de `tests/storage-replacement-policy.test.mjs`).
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive --dry-run`: OK.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`: OK — 17 arquivos novos, release complete.
- Verificacao HTTP pos-deploy (2026-06-26): `sw.js`, `storageService.js`, `financas.js`, `company.html`, `firebaseService.js` → HTTP 200.
- SW em producao confirmado com `APP_VERSION = '2026-06-25-storage-replace-v1'`.
- `storageService.js` em producao confirmado com `storageMode: replacePath ? 'replace' : 'append'`.

## File List
- `firebaseService.js`
- `company.html`
- `scripts/admin/admin-main.js`
- `storageService.js`
- `financas.js`
- `sw.js`
- `tests/storage-replacement-policy.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/client-supplier-fiscal-fields.test.mjs`
- `docs/stories/2026-06-25-storage-substituicao-logo-anexos.md`

