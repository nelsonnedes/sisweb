# Plano de melhorias e correções — landing-vendas.html

## Status
Plano (aguardando aprovação de escopo). Base: auditoria 07/10/2026 em
http://localhost:5500/landing-vendas.html nos breakpoints 390/768/1024/1440/1920
(zero overflow, zero erros JS) + leitura integral dos 3 arquivos + suíte de testes.

## O que está saudável (não mexer)
- H1 único, hierarquia H2/H3 íntegra, âncoras `#` todas com alvo, 19/19 imgs com `alt`.
- Scripts 100% locais com `?v=` sha256-12; `landing-vendas.html` é SKIP do sync (atualizar manual).
- Fonts com preconnect + `display=swap`; `prefers-reduced-motion` respeitado no JS e no CSS.
- Contratos de teste: `tests/landing-hero-brand.test.mjs` (h1, badge, ids dos carrosséis,
  métricas CTA/pill, allowlist da marca) e `tests/partner-program.test.mjs` (imagens hero,
  carrosséis, links de parceiro). Deploy por allowlist (`hosting-files.json`).
- Marca/token `--lv-*`, copy e CTAs aprovados — congelados salvo indicação contrária.

## P0 — corrigir (risco real ou peso morto)
- [ ] **JS morto:** `initCarousel('lv-phone-carousel')` e `initCarousel('lv-desk-carousel')`
  (`landing-vendas.js`) miram ids que não existem no HTML. Confirmar guard e remover
  as chamadas (menos ruído, menos superfície de erro).
- [ ] **LCP do hero:** 6 PNGs somam ~1,7 MB; primeiro slide `eager` sem `fetchpriority="high"`
  nem `width`/`height` (risco de CLS). Definir `fetchpriority="high"` + dimensões no
  slide 1 e `decoding="async"` nos demais; avaliar quantização dos PNGs hero
  (meta <250 KB cada, sem perda legível).
- [ ] **Sentry na landing:** `sentry.browser.min.js` + `sentry-init.js` em página pública
  de marketing. Avaliar remover (economia de ~100 KB + init) ou justificar permanência.

## P1 — converte e consiste
- [ ] **Vitrine fora de sintonia com o hero:** vitrine usa mockups light antigos
  (`mockups/desktop|mobile/*.png`) enquanto o hero virou dark. Trocar pelos renders
  `mockups/hero/*` (ou variantes) e atualizar `hosting-files.json` se necessário.
- [ ] **Cupons sem estado de espera:** `#lv-coupon-list` nasce vazia até as Functions
  responderem; sem offline, fica um bloco vazio com `aria-live`. Adicionar skeleton
  + fallback com os cupons estáticos principais.
- [ ] **Elementos mortos:** `.lv-hero-phone-cap` (`display:none` no HTML) e CSS sem
  referência (ex.: `.lv-mockup-desktop`, `.lv-mini*` se não usados). Remover após
  conferência para reduzir ~linhas e confusão.

## P2 — CRO e acabamento
- [ ] **FAQ:** seção ausente (padrão SaaS B2B: objeções de preço, fidelidade, migração,
  suporte). 5–6 perguntas com `<details>` estilizado, sem JS novo.
- [ ] **Prova social fina:** só faixa "+47 madeireiras". Adicionar 2–3 depoimentos com
  nome/função/resultado (pedir material real ao Nelson — não inventar).
- [ ] **Sticky CTA mobile:** botão "Começar agora" fixo no rodapé ≤900px (o float do
  WhatsApp já existe; medir canibalização).
- [ ] **Revisão de contraste fino:** `lv-trust-meta`, `lv-section-sub` e dots do carrossel
  no tema claro (rodar checklist de contraste antes do publish).

## Restrições duras (valem para todas as ondas)
- Preservar ids `lv-hero-carousel`, `lv-hero-phone-carousel`, `lv-hamburger`,
  `lv-topbar-menu`, `lv-share-*`, `data-theme-option`, classes `lv-*`, h1/badge/CTAs.
- `tests/landing-hero-brand.test.mjs` e `partner-program.test.mjs` 100% verdes.
- Novos assets em `hosting-files.json`; `?v=` recalculado (script + manual no SKIP).
- Screenshots 1440 + 390 antes/depois; `npm run lint`, `npm run typecheck`, `npm test`.
- Sem commit/publish/push sem pedido explícito.
- NUNCA reescrever arquivos via cmdlets de texto do PS 5.1 (BOM+CRLF+mojibake);
  só `edit`/`read` dedicados (incidente 07/10 recuperado via checkout + reaplicação).

## Execução 07/10 — Onda P0+P1 (concluída, gates 759 testes 758/0/1)
- JS morto removido (`initCarousel` p/ ids inexistentes + comentário atualizado);
  Sentry MANTIDO (teste `sentry-monitor` exige em todas as páginas publicadas).
- LCP: `fetchpriority="high"` + `width`/`height` + `decoding="async"` nos 6 slides.
- Vitrine no padrão dark do hero (3 renders `mockups/hero/*`, labels mantidos).
- Cupons com skeleton shimmer (light/dark, `prefers-reduced-motion`, `aria-hidden`).
- Mortos removidos: `lv-hero-phone-cap`, CSS `.lv-mockup-*`, `.lv-mini*` (+ overrides
  dark) e bloco legado do overlay.
- Validado: 15 nós no diagrama, skeleton no DOM, overflow 0 nos 5 breakpoints,
  vitrine 1440/390, `?v=` ressincronizado.

## Execução 07/10 — Onda P2 (concluída, gates 772 testes 771/0/1)
- FAQ com 6 Qs factuais (`<details>` nativo, eyebrow + título + sub, CSS brand/dark).
- Sticky CTA mobile (barra fixa ≤900px + WA float realocado + respiro no footer).
- Contraste auditado nos 2 temas: 1 falha real corrigida (CTA primário/secundário
  no dark 3.15→branco, blindado contra `a` global; demais pares ≥5.2).
- Validado: FAQ dark, sticky 390, `?v=` ressincronizado.

## File list (quando executado)
- `landing-vendas.html`, `landing-vendas.css`, `landing-vendas.js`
- `tests/partner-program.test.mjs` (só se contrato de imagem mudar, com aprovação)
- `hosting-files.json`, `docs/stories/2026-09-25-plano-temas-pendencias.md`

## Execução 08–09/10 — Mockups reais + ajuda (aguardando gates + commit)
- Hero com renders reais de dispositivos (`scripts/gerar_hero_devices.py` →
  `mockups/hero/*`: dashboard/estoque/vendas em desktop + mobile); vitrine e
  `subscription.html` apontam para o hero com fallback para os prints antigos
  (`data-guide-fallback`).
- `ajuda.js` em `HELP_VERSION 2026-10-06-manual-prints-reais-mockups`: tópicos
  reescritos com mockups desktop/mobile (`scripts/capturar_prints_reais_ajuda.py`
  + `gerar_mockups.py`); prints reais em `assets/help-manual/*-{mobile,overview}.png`
  + `dark/`.
- `hosting-files.json`: allowlist reorganizada; adicionados `mockups/{desktop,mobile,hero}/*`;
  removidos `MOVER_ARQUIVOS_ANTIGOS*.js` (scripts legados de migração, fora do hosting).
- `firebase.json`: ignores `**/*.py`, `**/*.pyc`, `**/__pycache__/**`.
- `logs.md`: reescrito como log operacional limpo.
- `tests/partner-program.test.mjs`: contratos atualizados para os hero mockups.
- Verificado: 43/43 imagens referenciadas existem no disco e no manifesto.
- File list desta leva: `landing-vendas.*`, `ajuda.js`, `subscription.html`,
  `firebase.json`, `hosting-files.json`, `logs.md`, `tests/partner-program.test.mjs`,
  `assets/help-manual/**`, `scripts/{gerar_hero_devices,capturar_prints_reais_ajuda}.py`,
  `gerar_mockups.py`, `docs/stories/2026-10-07-landing-plano-melhorias.md`.
