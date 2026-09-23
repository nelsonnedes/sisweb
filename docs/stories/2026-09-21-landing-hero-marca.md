# Story: Landing hero — marca oficial (icone+nomo) + headline Archivo

## Contexto

Marketing pediu (print anotado): trocar o topo do hero pelo `icone.ico` + `nome.ico` e fonte mais profissional na headline "Sua madeireira do pátio à nota em um só sistema."

## Achado da equipe (bloqueador esclarecido com o usuário)

O bloco circulado **não existia** no `landing-vendas.html` atual (0 ocorrências de "Logotipo Sisweb"/"SISWEB"/"Gestão para Madeireiras" no hero; topbar tem o único logo). Decisão do usuário: **inserir bloco novo** no topo do hero + **Archivo Expandido** na headline.

## Critérios de aceite

- [x] Bloco `.lv-hero-brand` (icone 64px + nome fluido 230px, `eager`/`high`/`async`, dims explícitas anti-CLS, alt correto, h1 único preservado) antes do badge.
- [x] Headline em Archivo 800 expandido (`font-stretch:125%`, fallback Fraunces); restante da página inalterado.
- [x] Assets em `assets/brand/` (transparência verificada pixel a pixel) + allowlist `hosting-files.json`.
- [x] Hooks/CTAs/carrosséis/vitrine/cupons/simulador intactos (zero renames; teste existente 100% verde).
- [x] Gates: focado 3/3, `validate:pr` 6/6 (637/0/1).

## File list

- `landing-vendas.html`
- `landing-vendas.css`
- `assets/brand/icone.ico` (novo, de `marqueting/icone.ico`)
- `assets/brand/nome.ico` (novo, de `marqueting/nome.ico`)
- `hosting-files.json`
- `tests/landing-hero-brand.test.mjs` (novo)
- `docs/stories/2026-09-21-landing-hero-marca.md` (este arquivo)

## Checklist

- [x] `node --test tests/landing-hero-brand.test.mjs` 3/3
- [x] `npm run validate:pr` 6/6 (637/0/1)
- [x] `git diff --stat` revisado (sem segredos/BOM/`logs.md`; `sisweb.ico`/`svg` de outra sessão fora do escopo)
- [x] Commit + push + deploy (ver abaixo)

## Correção de alvo (topbar, não hero)

O bloco circulado era a topbar (.lv-logo). Revertida a inserção no hero; marca aplicada na topbar (icone 30px + nome 88x26) e favicons para assets/brand/icone.ico (apple-touch PNG e manifest preservados). Headline Archivo mantida. Teste reescrito (4/4).

## Evidências

- Servido local: `landing-vendas.html` 200 com `lv-hero-brand` + Archivo; `assets/brand/*.ico` 200.
- Commit `1318c47` + push + `firebase deploy --only hosting` ("Deploy complete!", 5 arquivos); produção 200 com marca + Archivo.
- `sisweb.ico`/`svg` e `modules/romaneiopct/imprimir-romaneio-pct.js` (+5 CSS) são de outra sessão concorrente — fora deste escopo.

## Correção de alvo v2 (badge) + Publicação final (topbar)

- Commit 0ef812d + push + deploy (2 arquivos); produção 200 com topbar-marca, hero limpo e favicon brand.
- Badge hero: icone oficial 18px no lugar do icon-192 (teste 5/5).

## Badge hero (mesma sessão)

- Ícone do badge Romaneio/Cubagem/Estoque/NF-e -> assets/brand/icone.ico 18px (igual topbar). Teste 6/6.
