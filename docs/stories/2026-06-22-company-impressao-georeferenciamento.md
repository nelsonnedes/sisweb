# Story: Impressao e georeferenciamento do perfil da empresa

## Status
Done

## Contexto
O perfil da empresa precisa permitir impressao em formato de relatorio padrao do Sisweb, usando cabecalho com logo e dados cadastrais, alem de registrar coordenadas geograficas para gerar QR Code de navegacao no relatorio.

## Criterios de aceite
- [x] `company.html` possui botao `Imprimir` no formulario de perfil da empresa.
- [x] O relatorio impresso exibe cabecalho padrao, logo quando disponivel, dados cadastrais e bloco de georeferenciamento.
- [x] O formulario possui campos de latitude e longitude com acao para localizar coordenadas via navegador.
- [x] As coordenadas sao salvas pelo fluxo seguro `updateMyCompanyProfile`, sem write direto em `companies/{tenant}` no frontend.
- [x] A Function sanitiza e persiste latitude, longitude e URL de navegacao.
- [x] O relatorio gera QR Code apontando para navegacao no mapa quando houver coordenadas validas.
- [x] A dependencia QR Code pinada no CDN possui SRI e `crossorigin="anonymous"`.
- [x] Redirect de onboarding aceita somente caminho interno normalizado.
- [x] IDs usados nas acoes de empresa sao codificados para os contextos HTML e JavaScript.
- [x] Envelopes de servico com `success: false` nao sao convertidos em empresas ficticias.

## Tarefas
- [x] Mapear o fluxo atual de perfil, logo e persistencia segura.
- [x] Implementar campos e acoes de georeferenciamento em `company.html`.
- [x] Implementar impressao do relatorio da empresa com QR Code de mapa.
- [x] Ajustar sanitizacao backend para preservar as coordenadas.
- [x] Cobrir com testes focados e rodar os gates possiveis.

## Evidencias
- `node --check functions/index.js`: OK.
- `node --check src/services/firebaseService.js`: OK.
- Checagem sintatica do script principal de `company.html`: OK.
- `node --test tests/company-profile-permissions.test.mjs`: OK.
- `node --test tests/global-first-wave.test.mjs`: OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK, 172 testes.
- `firebase deploy --only functions:default:createCompanyOnboarding,functions:default:upsertCompanyProfile,functions:default:updateMyCompanyProfile,hosting --project sisweb-7ce82 --non-interactive`: OK.
- Verificacao do Hosting em `https://sisweb-7ce82.web.app/company.html?codex_verify=company_geo_print_20260622`: status 200, `btnPrintCompany`, `geoLatitude`, `geoLongitude`, QRCode e `updateMyCompanyProfile(profilePayload)` presentes.
- Header publicado: `Permissions-Policy: camera=(), microphone=(), geolocation=(self)`.
- `firebase functions:list --project sisweb-7ce82 --json`: `createCompanyOnboarding`, `updateMyCompanyProfile` e `upsertCompanyProfile` ativos em `us-central1`, runtime `nodejs22`, hash `9424d129734194ea0471d566330fc9fd4c531f73`.
- Revisao CodeRabbit de 2026-07-15: SRI, redirect same-origin, envelope de erro e escaping de IDs corrigidos.
- `node --test tests/company-logo-storage-policy.test.mjs`: OK, incluindo execucao real do normalizador de redirect contra URLs externas, `javascript:` e barras invertidas.
- Suite completa posterior: 223/223 testes, lint, typecheck e build do Hosting aprovados.
- Patch de revisao publicado primeiro no Preview `coderabbit-review-20260715` (versao `9b1b85476974bc90`) e depois no Hosting live (versao `a6dee04d9afafb59`, release `1784121244052000`). Rollback anterior preservado em `2f3444d18ecf005a`.
- Smoke live de `company.html`: HTTP 200, formulario carregado e nenhum erro de SRI/QRCode. Deploy restrito ao Hosting.

## File List
- `company.html`
- `functions/index.js`
- `firebase.json`
- `src/services/firebaseService.js`
- `tests/company-profile-permissions.test.mjs`
- `tests/company-logo-storage-policy.test.mjs`
- `docs/stories/2026-06-22-company-impressao-georeferenciamento.md`
