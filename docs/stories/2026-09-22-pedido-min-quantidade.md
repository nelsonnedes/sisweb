# Story: Save bloqueado por validação nativa (min=1 vs volumes m³)

- **Data:** 2026-09-22
- **Status:** Done (publicado junto com 9fbb43c — ver evidências em 2026-09-22-itens-unidade-enter)
- **Escopo:** `vendas.html`, `compras.html` (4 inputs), `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Sintoma (produção, via logs.md):** `An invalid form control with name='' is not focusable (quantidadeManual)` ao salvar pedido editado.

## Causa raiz

`quantidadeManual` (e `quantidade`) com `min="1"`: ao editar item de romaneio, o campo recebe o volume em m³ (ex.: 0,350 < 1 → inválido). O botão Salvar é `type=button` (sem validação), mas um Enter em qualquer campo do form dispara submit nativo → o navegador valida todos os controles, encontra o `quantidadeManual` oculto+inválido e bloqueia tudo sem chamar `salvarPedido`.

## Correção

`min="0"` nos 4 inputs (vendas/compras, manual/cadastrado). Guarda real continua no JS (`!quantidade || <= 0` com toast amigável). `step` e resto intactos.

## Acceptance Criteria

- [x] Volumes fracionados válidos em qualquer seção (visível ou oculta).
- [x] Zero/nulo continua bloqueado via JS com toast.
- [x] Gates verdes (619 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.html`, `compras.html`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] lint, typecheck, suite cheia (sem JS alterado; só HTML)
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
