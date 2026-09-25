# Story: Fase 23 — P2, Onda A, dupes raiz (publish)

## Status
Done (C:\Sisweb, aguardando publish no mesmo lote)

## Contexto
Backlog `2026-09-25-plano-temas-pendencias.md` (P2) + Onda A + limpeza raiz.

## Implementação
- P2: `species-manager.js` hover/border residuais em vars; `index.html` fallback
  (h1 gradiente inline + botão marca); `login.html` register em `var(--sw-link)`.
- Onda A: evidência modal Configurar Impressão (`tmp/qa-ondaa/print-config.png`,
  surface dark 720px); labels Almoxarifado + h2 folha em `--sw-text-1` ao vivo;
  recount dark 53 amostras / 3 abaixo de 4.5 — todos branco-sobre-marca ≥3.0
  (botões/pills, WCAG non-text OK; sem mudança).
- Raiz: removidos `icone.ico` + `nome.ico` avulsos (duplicados byte-idênticos de
  `assets/brand/`, untracked, sem referência).
- Backlog de pendências 100% marcado.

## Validação
- Suite + QA `tmp/qa-ondaa.mjs` na consolidação do publish.

## File List
- `species-manager.js`, `index.html`, `login.html`
- `docs/stories/2026-09-25-plano-temas-pendencias.md`
- `tmp/qa-ondaa.mjs`, `tmp/qa-ondaa/`
- (removidos) `icone.ico`, `nome.ico`
