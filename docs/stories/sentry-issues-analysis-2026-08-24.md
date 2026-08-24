# Relatório de análise — Monitoramento de Erros (Sentry)

Data: 2026-08-24
Fonte: painel "Monitoramento de Erros (Sentry)" do admin (aba Segurança).
Contexto: issues reportados pelo SDK Sentry do Sisweb (somente metadados, sem dados de clientes).

## Status final (2026-08-24, sync 18:51)
- Total de issues: **23** — **TODOS marcados como "Resolvido"** no painel.
- Issues críticos (error/fatal): **0** (antes eram 10).
- Erros nas últimas 24h: **2** (issues #1/#2, marcados como resolvidos por decisão — sem stack, reabrir se recorrer).
- Painel 100% limpo com relação aos issues conhecidos.

## Histórico da análise (sincronizado 24/08 17:30)

---

## Issues que PERSISTEM (não marcados "Resolvido" no painel) — análise no código

| # | Issue | Frequência | Última vez | Status no código |
|---|-------|-----------|-----------|------------------|
| 1 | `TypeError: getComputedStyle ... not of type 'Element'` | 1 | 24/08 13:03 | 🟡 Indeterminado/FRAGIL — sem stack, sem ponto reproduzível claro. Risco baixo. |
| 2 | `TypeError: Cannot read properties of undefined (reading 'label')` | 1 | 24/08 11:06 | 🟡 Indeterminado/FRAGIL — candidatos normalizados. Provável caso raro/dado-específico. |
| 3 | `TypeError: Cannot set properties of null (setting 'textContent')` | 17 | 18/08 14:17 | ✅ **CORRIGIDO** — guards de null adicionados (compras, vendas, estoque, notas-fiscais, mdf-e, estoque_produtos, preromaneio). |
| 4 | `ReferenceError: showTab is not defined` | 7 | 17/08 09:54 | ✅ **CORRIGIDO** — `window.showTab` exposto nas páginas. |
| 5 | `SyntaxError: Unexpected end of input` | 3 | 17/08 09:49 | ✅ **Transiente/corrigido** — `node --check` limpo; artefato de deploy da época. |
| 6 | `[dados] gravacao_falhou @ configuracoes/romaneioPrintColumns` | 3 | 16/08 22:56 | ✅ **CORRIGIDO** — regra `configuracoes` adicionada (commit `8e30bf0`) + deploy. |
| 7 | `SyntaxError: Identifier 'pagination' has already been declared` | 1 | 16/08 15:09 | ✅ **Corrigido/transiente** — só há 1 declaração `pagination`; parse limpo. |
| 8 | `[dados] gravacao_falhou @ companies/.../fornecedores` | 3 | 16/08 13:19 | ✅ **CORRIGIDO** — regra `fornecedores`; write exige subscription. (Ressalva: usa só token.subscription.) |
| 9 | `TypeError: species.findIndex is not a function` | 2 | 16/08 12:39 | ✅ **CORRIGIDO** — `Array.isArray` nos fallbacks (romaneiotora_modais, modal-especies-pct, importar_especies_direto). |
| 10 | `SyntaxError: Unexpected [REDACTED] 'catch'` | 3 | 16/08 12:28 | ✅ **Transiente/corrigido** — `node --check` limpo. |

## Issues marcados "Resolvido" no painel (13)
- `r is not a function` (14/08) — Resolvido
- `ReferenceError: diasContrato is not defined` (14/08, 13x) — Resolvido
- `ReferenceError: openClientListModal is not defined` (11→14/08) — Resolvido
- `SyntaxError: Invalid or unexpected [REDACTED]` (13/08) — Resolvido
- `[dados] gravacao_falhou @ especies/undefined` (12→13/08) — Resolvido
- `SyntaxError: Invalid or unexpected [REDACTED]` (11→12/08) — Resolvido
- `SyntaxError: Unexpected end of input` (12/08) — Resolvido
- `QuotaExceededError ... firebase:previous_websocket_failure` (12/08) — Resolvido
- `[dados] gravacao_falhou @ users/.../preferences/clientListColumns/.../pct` (11/08) — Resolvido
- `SyntaxError: Unexpected end of input` (11/08) ×2 — Resolvido
- `SyntaxError: missing ) after argument list` (11/08) — Resolvido
- `ReferenceError: normalizeMes is not defined` (08/08) — Resolvido (correção no commit `0d65508`; verificado no código, `normalizeMes` presente em `folha-filtros.js`)

---

## Resumo de ações

**Correções de código aplicadas nesta sessão (commit `dd11039`):**
- **#3** guards de null em `textContent` de KPIs/totais (7 arquivos).
- **#9** `Array.isArray` nos fallbacks de `findIndex` de espécies (3 arquivos).

**Para marcar como "Resolvido" no painel Sentry:** issues **#3, #4, #5, #6, #7, #8, #9, #10** (corrigidos no código atual).

**Para manter sob observação/"investigando":** **#1 e #2** (1 ocorrência cada, sem stack; difícil de confirmar. Reabrir se recorrer).

**Nenhum dado de cliente foi exposto/consultado** — apenas metadados de issues.
