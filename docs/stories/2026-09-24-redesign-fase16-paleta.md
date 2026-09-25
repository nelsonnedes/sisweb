# Story: Fase 16 — Paleta Configurações (Claro/Escuro customizáveis)

## Status
Done

## Contexto
"Sistema" refletia o SO (igual ao Escuro no aparelho do usuário). Trocado por
"Configurações": paleta por tema com diversidade das cores do sistema, suavizar/escurecer
e detalhamento do que cada cor afeta.

## Implementação
- Menu Tema: Claro / Escuro / **Configurações** (abre a paleta; `system` mantido só por
  compatibilidade de valores já salvos).
- `js/sisweb-theme.js`: engine de customização (`sisweb:theme:custom` por tema, aplicado
  inline no `<html>`), 9 variáveis curadas com "onde afeta", `shiftLightness` p/ barra
  suavizar/escurecer, reset por cor e geral, API `getCustom/setCustom/resetCustom/openSettings`.
- `styles/shell-theme.css`: modal `#siswebThemeModal` bitemático (dialog segue o tema ativo).
- QA (`tmp/qa-fase16.mjs`): modal abre com 9 linhas + 2 abas, gear recolhe, cor aplica ao
  vivo, persiste após reload, reset restaura; 0 erros.

## Validação
- Regressão do tema atualizada (Configurações no lugar de Sistema); suite nas verificações finais.
- Screenshots `tmp/qa-fase16/` (paleta + custom verde aplicado ao vivo).

## File List
- `menu-component.js`, `js/sisweb-theme.js`, `styles/shell-theme.css`
- `tests/redesign-theme-regression.test.mjs`, `tmp/qa-fase16.mjs`
