# Story: Company — Toasts blindados com rastro (fim do X solitário)

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `company.html` (helper + 4 pontos do fluxo logo/save), `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)

## Investigação (exaustiva, sem achado de mensagem vazia)

Auditados e descartados como causa: mensagens vazias nos ~20 calls (todas não-vazias), renderer alternativo (só `__toast` unificado carregado; ele recusa vazio), container estático, ids ausentes, `window.Utils` fantasma, CSS ocultando texto, outros scripts com DOM de toast. Conclusão honesta: com o código atual, toast vazio é impossível — sintoma compatível com JS velho em sessão ou elemento confundido.

## Blindagem entregue

`companyToast(msg, type, opts)` no fluxo logo/save: coage mensagem (fallback honesto se vazia), registra `[company-toast]` no console (rastreabilidade total no próximo relato), tenta `__toast` → `Utils` → `alert` (nunca silencioso). Renderer global intocado.

## Acceptance Criteria

- [x] Fluxo logo/save sempre mostra mensagem ou cai em alert.
- [x] Próximo relato virá com linha `[company-toast]` no console.
- [x] Gates verdes (623 pass, 0 fail, 1 skip emulator).

## File List

- `company.html`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] lint, typecheck, suite cheia (JS fora do HTML intocado)
- [ ] Publicar (commit + push + inject + build + deploy) — aguardando confirmação
