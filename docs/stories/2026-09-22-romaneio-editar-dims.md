# Story: Vendas — Editar item E×L×C abre o formulário (case ausente)

- **Data:** 2026-09-22
- **Status:** Done (código + gates; publicar pendente de confirmação)
- **Escopo:** `vendas.js` (`editarItem`), `tests/romaneio-preview-uso-trava.test.mjs` (+1 teste)
- **Sintoma (produção, via logs.md):** editar item `romaneio_dimensoes` → `alterarTipoProduto('romaneio_dimensoes')` sem `case` → caía no default `cadastrado` com as 3 seções ocultas e formulário vazio.

## Causa raiz

`editarItem` tratava `manual`, `romaneio`, `cadastrado` e `romaneio_agrupado`, mas o tipo novo `romaneio_dimensoes` não tinha `case`. Compras já funcionava (else genérico → manual).

## Correção (1 linha)

`case 'romaneio_dimensoes':` em fallthrough com `case 'romaneio':` (conversão para edição manual com valores preenchidos). Demais switches auditados: `alterarTipoProduto` (correto sem seção dims), reagrupador (dims blindado), tabela/detalhes/impressão (já classificam).

## Acceptance Criteria

- [x] Editar item E×L×C preenche o formulário manual (nome/qtd/unidade/preço).
- [x] `Adicionar` atualiza in-place (fluxo existente, sem dangling).
- [x] Gates verdes (618 pass, 0 fail, 1 skip emulator).

## File List

- `vendas.js`, `tests/romaneio-preview-uso-trava.test.mjs`

## Quality Gates

- [x] `node --check`, lint, typecheck, suite cheia
- [ ] Publicar (commit + push + deploy) — aguardando confirmação
