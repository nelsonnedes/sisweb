# Financas Historico Mobile Implementation Plan

> **For agentic workers:** Execute inline in the current session using the approved design.

**Goal:** Transform the Financeiro payment-history table into readable mobile cards without changing desktop behavior or financial actions.

**Architecture:** Keep `verHistoricoPagamentos()` as the single renderer and add semantic `data-label` attributes to its existing cells. Scope the mobile CSS to the history table inside `#pagamentoModal`; desktop remains the current table layout.

**Tech Stack:** Vanilla JavaScript, inline page CSS, Node.js `node:test` regression checks.

## Global Constraints

- Preserve payment, receipt, attachment, deletion, and print handlers.
- Do not alter financial calculations, persistence, tenant rules, or the desktop layout.
- Keep the existing modal and focus behavior.
- Avoid horizontal document overflow at 320px and 390px widths.

### Task 1: History Card Layout

**Files:**
- Modify: `financas.js:5823-5885`
- Modify: `financas.html` inline styles near the Financeiro modal styles
- Test: `tests/financas-mobile-cards.test.mjs`

- [x] Add stable classes and `data-label` values to history cells.
- [x] Add mobile-only card rules for rows, labels, values, attachments, actions, and summary rows.
- [x] Add static regression assertions for the history table and mobile overrides.
- [x] Run the focused test, syntax checks, and full quality gates.
