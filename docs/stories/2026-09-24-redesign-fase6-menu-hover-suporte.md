# Story: Fase 6 — Hover do menu por tema + modal Suporte padrão Fale Conosco

## Status
Done

## Contexto
Feedback com prints reais em `localhost:5500`:
1. Hover do menu: no dark, wash claro destoa; no light, branco forte dói a vista. Quer hover
   mais escuro no dark e suave-escurecido no light, padronizado ao sistema.
2. Trigger aberto do dropdown nav (ex.: Romaneios) vira pílula branca destoante no dark.
3. Modal "Suporte Sisweb" branco no dark — padronizar com o "Fale Conosco" do login
   (card timber, inputs escuros, acentos de marca).
4. Em seguida: próxima fase pendente (Fase 7: superfícies de conteúdo por página).

## Problema
- Hovers usam `brand-soft/rgba` claro nos dois temas; sem token dedicado.
- Modal de suporte (`#supportModal`, CSS injetado com IDs) só existe em variante clara.

## Objetivo
Hover/active/open coerentes por tema + modal de suporte bitemático, sem tocar em lógica.

## Acceptance Criteria
- [x] Token `--sw-hover` por tema; hovers do chrome usam ele; trigger aberto sem pílula branca.
- [x] `#supportModal` dark (padrão contact modal do login) + light íntegro; severidades e
      botões semânticos preservados.
- [x] QA autenticado (dropdown nav aberto, suporte aberto, ambos os temas) + gates verdes.

## Tarefas
- [x] Hover/open por tema.
- [x] Modal suporte bitemático.
- [x] QA + gates + fechar story + abrir Fase 7.

## File List
- `docs/stories/2026-09-24-redesign-fase6-menu-hover-suporte.md`
- `styles/sisweb-tokens.css` (`--sw-hover` por tema)
- `styles/shell-theme.css` (hovers via token + seção `#supportModal` bitemática)
- `tests/redesign-theme-regression.test.mjs` (travas anti-wash + suporte)

## Implementação
- Hovers do chrome (itens, triggers, links de dropdown, botões do sininho) migrados de wash
  claro para `var(--sw-hover)`: `#242b33` no dark, `#e9edf1` no light.
- Pílula branca do trigger aberto: não reproduzida no código atual (trigger transparente ao
  abrir via clique; QA inspecionou cascata e screenshot) — vestígio de CSS em cache no
  navegador do usuário; hover novo elimina o contraste mesmo em `:hover:focus`.
- Modal suporte: ~40 regras `html[data-theme="dark"] #supportModal ...` (superfícies, inputs
  com focus de marca, abas com aba ativa em gradiente, tickets/thread/feedback, pills de
  status em tintas); aba ativa e botão "Sobre" em gradiente também no light; botões de ação
  mantêm hues semânticos.

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (642 pass, 0 fail, 1 skip emulador).
- QA autenticado: dropdown nav aberto (trigger sem pílula, itens escuros legíveis), modal
  suporte dark íntegro (card, tabs, contexto, textarea com focus de marca, anexos, ações),
  light íntegro; 0 erros de frontend.

## Notas
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.
