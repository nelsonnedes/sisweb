# HANDOFF - SisWeb (14/08/2026)

**Autor:** sessão opencode/deepseek
**Destino:** próxima sessão (Codex/opencode) - continuar a partir daqui
**Branch:** `codex/recovery-p0-freebuff-regressions` (mesma branch dos handoffs anteriores)
**Data:** 2026-08-14

> O deploy do hosting e das functions financeiras (fix UTC) foi concluído e validado em produção.
> Working tree contém mudanças ainda **não commitadas** (detalhes na seção 5).

---

## 1. Correção da regressão UTC do financeiro - CONCLUÍDA E DEPLOYADA

### Sintoma
Às 21h no horário local (SP, UTC-3), o backend de finanças começava a tratar `hoje` como o dia seguinte (ex.: 15/08 em vez de 14/08) porque `new Date().toISOString()` (UTC) já tinha virado o dia. Resultado: contas com vencimento "hoje" apareciam como 1 dia em atraso; havia inclusive regressão com o erro `Dias de atraso não correspondem ao cálculo da conta` (400).

### Correção aplicada
- **Backend** (`functions/finance-functions.js`):
  - Novo `FINANCE_TIME_ZONE = 'America/Sao_Paulo'`.
  - Novos helpers `getTodayISODateInTimeZone(nowIso, timeZone)` e `todayDayNumber(nowIso)` (padronização de "hoje" pelo dia civil de SP).
  - Substituiu os 5 usos de `dateToDayNumber(nowIso)` por `todayDayNumber(nowIso)`.
  - Ambientados em `__test` para o teste de dia civil.
- **Frontend** (`financas.js`):
  - `getTodayISODateUTC()` agora retorna `new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })` (fallback UTC).
  - `getTodayStartTimestampLocal()` usa essa data civil de SP.
- **Testes** (`tests/finance-timezone-business-day.test.mjs`): 5 testes novos (00:30 SP = dia civil seguinte; 21h local = dia civil anterior; etc.). Suite completa: **416 testes / 415 pass / 0 fail**. Lint e typecheck OK.

### Deploy
- Hosting: `financas.html` → `financas.js?v=2e1cb4a5952e` (confirmado servido em produção).
- Functions financeiras (v1): atualizadas no deploy completo; confirmado `financeNextSequence` respondendo (HTTP 400 = função viva, exige auth).

### Validação
- Unit tests (5/5).
- Produção: `toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'})` presente no `financas.js` servido.
- Cenário real: às 23h10 SP (UTC já 15/08), página abre sem erro e dia civil SP corretamente = 14/08.

---

## 2. Modal "Lista de Clientes" com altura de linha ~26-50px - CORRIGIDO E DEPLOYADO

### Causa
No CSS de produção, o `.btn-group` dos modais (`#clientListModal`, `#fornecedorListModal`, `#speciesListModal`) herdava `margin: 10px 0;` (regra inline da página / folha), elevando a altura das linhas da tabela para ~53,5px.

### Correção
Em `romaneio-comum.css` (~linha 1048-1061): `margin: 0 !important` para `.btn-group`/`.actions-container` nesses modais. Cache-buster manual (o `inject-cachebusters.mjs` só trata `<script>`, não `<link rel="stylesheet">`): `romaneio-comum.css?v=32f16c9d8794` nas 5 páginas (romaneiopct/tl/pes/preromaneio/tora).

### Validação
- Todas as 5 páginas com altura de linha `34px` em produção (antes: 50-66px).
- Confirmado que a "lentidão" de abrir o modal (7s) era **artefato de medição** (o eval injetava `setTimeout(7000)`). Modal real abre em ~2ms após page load (~551ms).

### Observação conhecida (não bloqueante)
`window.openClientListModalGuard` não existe em produção porque as páginas definem `window.openClientListModal` inline (ex.: `romaneiopct.html:3256/4099`) depois que `client-modal-handler.js` carrega, sobrescrevendo o wrapper. Se for necessário validar o guard, é preciso tratar isso nas páginas.

---

## 3. Limpeza de produção quando um HTML foi corrompido por `Set-Content` (lição)

Não usar `Set-Content -Encoding utf8` (PowerShell) nos HTMLs do projeto: escreve BOM e, dependendo do encoding de origem, gera mojibake (conteúdo UTF-8 lido como cp1252). Reprocessar com Node (`fs.writeFileSync(path, content, 'utf8')`) restaura LF/sem BOM. Sempre validar: `git diff --stat` deve mostrar mudanças pequenas (só cache-buster) e ausência de BOM/mojibake.

---

## 4. Sentry - issue "r is not a function" (7672938922) - NÃO é bug do app

- Vinda como `TypeError: r is not a function`, project `javascript-nextjs` (não é o nosso), sem frames/tags/URL, 1 ocorrência/0 usuários.
- Conclusão: ruído (não passou pelo `beforeSend`, project errado). Recomendado: ignorar; se quiser blindar, revisar o DSN em `sentry-init.js`.

---

## 5. Estado do working tree (PENDENTE de commit)

As edições abaixo estão **locais, ainda não commitadas**:

- `functions/finance-functions.js` - correção UTC (dia civil SP).
- `financas.js` - `getTodayISODateUTC()` com fuso SP.
- `financas.html` - cache-buster de `financas.js` (v2e1cb4a5952e).
- `romaneio-comum.css` - `margin: 0 !important` nos modais.
- 5 páginas de romaneio (romaneiopct/tl/pes/preromaneio/tora) + módulos modais - `romaneio-comum.css?v=32f16c9d8794` e outras alterações.
- `tests/finance-timezone-business-day.test.mjs` - testes novos (5).
- `logs.md` - log de console (Antigravity tinha trimado p/ 16 linhas).
- Diversos `.html` e módulos .js (client-modal-handler, fornecedor-modals, preromaneio-modals, modal-clientes, modal-clientes-pct, client-list-columns, admin-* etc.) - por auditar antes de commit.
- Novos: `docs/runbooks/cloud-functions-deploy-quota-runbook.md` (este handoff).

**IMPORTANTE**: fazer `git status` e revisar `git diff` antes de commitar. Não há push automático.

---

## 6. Aprendizado de deploy: quota de CPU do Cloud Run (ver runbook)

Resumo para não repetir o erro:
- 25 serviços Cloud Run em us-central1, cada um `cpu=1`; quota `run.googleapis.com/cpu_allocation` = 20 vCPU.
- `firebase deploy --only functions` deploya em paralelo → pico de healthchecks excede a quota.
- **Solução**: deploy serial (uma função por vez) ou lotes de 2-3. Ver `docs/runbooks/cloud-functions-deploy-quota-runbook.md`.
- Para ver estado: `gcloud run services list --region=us-central1 --format=json` (serviços não-ready = deploy pendente/quota).

---

## 7. Próximos passos sugeridos
1. Revisar/commitar o working tree (seção 5) e, se aplicável, push.
2. Se quiser blindar: investigar o DSN do Sentry (`sentry-init.js`) para filtrar issues de projects que não são do Sisweb.
3. Considerar tratar o `openClientListModalGuard` nas páginas de romaneio (override inline).