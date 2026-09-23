# Story: Impressão — memo de falha da logo (fim da lentidão repetida)

- **Data:** 2026-09-22
- **Status:** Done (publicado — ver evidências em 2026-09-22-logo-upload-dual)
- **Escopo:** `commerce-pdf-share.js`, `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Fora de escopo:** validação de formato da logo no backend; re-upload da logo (ação do usuário).

## Diagnóstico

- **Sem regressão nossa:** `commerce-pdf-share.js` intocado desde `12cec5a`; lentidão vem do desenho + dado.
- **Cadeia:** `preparePrintOptions` aguarda `resolveCompanyLogoDataUrl` (até 6s); warm-up falha sempre neste tenant (logo com content-type rejeitado → 400); só sucesso entrava em cache → **cada impressão repagava a cadeia lenta** (callable + fallbacks + timeouts).
- Print segue sem logo (fallback correto, só lento).

## Correção

Memo de falhas (negativo, 5 min, por page-load, por fonte): resolve retorna `''` imediato após falha recente; sucesso continua no cache positivo; `clearPrintLogoCache` limpa ambos (ex.: logo trocada na sessão).

## Acceptance Criteria

- [x] 1ª tentativa paga a cadeia; repetidas na sessão retornam imediato.
- [x] Recarregar a página limpa o memo (nova chance real).
- [x] Logo válida continua cacheada como antes (caminho intocado).
- [x] Gates verdes (621 pass, 0 fail, 1 skip emulator).

## Ação pendente do usuário (causa raiz do 400)

Reenviar a logo da empresa como PNG/JPG na tela de Empresa — aí warm-up/cache voltam a funcionar e a logo sai no impresso.

## File List

- `commerce-pdf-share.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + deploy + cachebuster) — aguardando confirmação
