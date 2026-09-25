# Story: Fase 24 — ícone icone.ico na aba e no install (publish)

## Status
Done (C:\Sisweb, publicado no mesmo lote)

## Contexto
Aba e diálogo de instalação mostravam o ícone antigo: links `.ico` apontavam p/
`favicon.ico` legado, SVG antigo ganhava do ICO na aba, e o manifest servia PNGs
do design anterior.

## Implementação
- 31 refs `favicon.ico` → `/assets/brand/icone.ico` (30 HTMLs + folha); 31 links
  SVG concorrentes removidos (Chrome prefere SVG — era ele que vencia na aba).
- PNGs PWA regenerados do `icone.ico` (625×547) via System.Drawing: 144/192/512
  (fundo transparente) + apple-touch 180 (fundo branco, exigência Apple) +
  `icon-maskable-512.png` (fundo timber `#121417`, marca a 70% — safe-zone).
- `manifest.json`: 512 vira `any` + entrada `maskable` dedicada;
  `hosting-files.json` +1 (maskable).
- `favicon.ico` raiz reconstruído como ICO válido a partir da marca (fallback p/
  requisições automáticas; teste de validade verde).
- `tests/pwa-install-icon.test.mjs`: contrato atualizado (4 ícones, maskable
  dedicado, dimensões incl. maskable).

## Validação
- Suite 664/0/1, regressão 22/22; PNGs conferidos visualmente; install dialog
  usa o 192 da marca (verificação visual do usuário após propagar cache).

## File List
- 31 HTMLs (favicon + svg), `folha_pagamento/folha.html`
- `assets/icons/` (5 PNGs), `favicon.ico`, `manifest.json`, `hosting-files.json`
- `tests/pwa-install-icon.test.mjs`, `tests/redesign-theme-regression.test.mjs`
