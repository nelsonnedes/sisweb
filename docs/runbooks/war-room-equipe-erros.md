# War Room — Equipe de Agentes Especialistas por Tipo de Erro

> Como navegar pelo SisWeb, classificar erros e acionar o agente especialista certo.
> Base: agentes AIOX existentes (`aiox-<id>` em `.claude/skills/AIOX/agents/`), skills
> do projeto (`.claude/skills/`) e o Cérebro (`docs/core/CEREBRO-SISWEB.md`).

## Regra de ouro
1. Primeiro categorize o erro (tabela abaixo).
2. Acione o especialista via skill (`aiox-<id>`) OU via subagente dedicado, passando contexto mínimo: página, console/network, trecho, tenant.
3. Nunca corrija sem reproduzir e sem verificar a causa raiz (ver `architect-first`).
4. Antes de tocar código, consulte `CEREBRO-SISWEB.md` (armadilhas conhecidas → evita regressão).
5. Depois de corrigir: `npm run lint && npm run typecheck && npm test`, atualize story/cérebro e considero deploy serial (runbook de quota).

## Tabela: tipo de erro → especialista

| Categoria | Sintoma típico | Especialista | Skill / agente | Artefatos de referência |
|---|---|---|---|---|
| **Auth/Acesso** | `ERR_CONNECTION_TIMED_OUT` em gstatic, 403/401 callable, permission_denied, login | `@security` / `@devops` | `aiox-devops`, `aiox-architect`, `security-review` | stories 06-12 tenant, 06-07 RBAC, `CEREBRO §8` |
| **Rede/CDN offline** | libs externas (gstatic, cdnjs, jsdelivr) falham | `@devops` | `aiox-devops` | firebase-init, `CEREBRO §8` |
| **Financeiro/Juros/Datas** | `Dias de atraso não correspondem`, 400 register, dia "errado" às 21h | `@financas-engineer` | `aiox-data-engineer` + `aiox-qa` | `finance-functions.js`, `financas.js`, `CEREBRO §5` |
| **Romaneios/Modais/Listas** | modal não abre, resize de colunas, linha alta, guard undefined | `@romaneios-engineer` | `aiox-dev`, `aiox-qa`, `aiox-ux-design-expert` | `client-modal-handler.js`, `modules/modals/*`, `romaneio-comum.css`, `CEREBRO §4` |
| **Firebase/Database** | erro de push/key, saveData, sync, tombstones, conflito | `@data-engineer` | `aiox-data-engineer` | `firebase-init.js`, `firebaseService.js`, `firebase-compat-bridge.js` |
| **Relatórios/Print/PDF** | relatório/PDF/planilha divergente, orientação | `@qa` | `aiox-qa` | stories `relatorios`, `commerce-pdf-share.js` |
| **Folha de pagamento** | `normalizeMes is not defined`, filtros, totais | `@folha-engineer` | `aiox-dev` | `folha_pagamento/folha-*.js`, `CEREBRO §3` |
| **PWA/Service worker/Cache** | versão antiga no ar, cache não invalida, offline | `@devops` | `aiox-devops` | `sw.js`, `inject-cachebusters.mjs`, `CEREBRO §2` |
| **UI/Responsivo/Mobile** | sobreposição, scroll horizontal, corte de ações | `@ux-design-expert` | `aiox-ux-design-expert`, `web-design-guidelines` | `CEREBRO §4` |
| **Segurança/LGPD/XSS** | injeção, vazamento cross-tenant, dados sensíveis | `@security` | `aiox-architect`, `security-review`, `aiox-qa` | story 06-07 contenção LGPD, `CEREBRO §2` |
| **NF-e/MDF-e/Certificados** | falha emissão, assinatura, SEFAZ | `@nfe-engineer` | `aiox-data-engineer` | functions `nf-*`, stories 05-17 |
| **Assinatura/Admin/Billing** | status assinatura, campanhas, promo, custo cloud | `@admin-engineer` | `aiox-pm` + `aiox-devops` | stories 06-10/06-11, runbook billing |

## Como acionar (opencode/Codex)
- Para **análise profunda** de um erro encontrado ao navegar: usar subagente do tipo `general`/`explore` com o especialista como persona, OU carregar a skill `aiox-<id>` (dá a persona ao agente principal).
- Para **revisão de qualidade** antes de concluir: `aiox-qa` (test architecture/cobertura) e, se houver PR, `coderabbit-review`.
- Para **investigação sem código**: `explore` (mapear) / `tech-search` (resposta autônoma web).

## Checklist do incidente (usar todo incidente)
- [ ] Registrar data/hora, página, tenant, mensagem exata e stack (Sentry id se houver).
- [ ] Reproduzir (navegação real ou teste) e confirmar causa raiz.
- [ ] Consultar `CEREBRO-SISWEB.md` (armadilha conhecida? fix já existente?).
- [ ] Após corrigir: lint + typecheck + suíte completa verde.
- [ ] Atualizar story, runbook ou cérebro (o que se aplica).
- [ ] Se deploy: serial em v2 + validação em produção (HTTP/browser).

## Incidentes abertos (triados em 2026-08-16)
- ~~**BUG-A | Folha cargos `Permission denied`**~~ → **RESOLVIDO 2026-08-16** por opencode: regra `companies/$companyId/cargos` adicionada em `database.rules.json` (espelho de `funcionarios`). Deploy `--only database` pendente.
- ~~**BUG-B | NF-e seed `fiscal/naturezas-operacao` `PERMISSION_DENIED`**~~ → **RESOLVIDO 2026-08-16** por opencode: `.write` adicionado ao nó `fiscal` em `database.rules.json`. Deploy `--only database` pendente.
- ~~**BUG-C | Dupla prefixação `companies/{t}/companies/{t}/...`**~~ → **RESOLVIDO 2026-08-16** por opencode: `firebaseService.js` `checkCandidates` agora usa `getNamespacedPath(c)`. Sem deploy de rules; validado pela suíte (449 pass).
- **BUG-D | `PERMISSION_DENIED` ao salvar "Configurar Impressão" em Lista de Romaneio** → **RESOLVIDO 2026-08-16** por opencode: `romaneio-print-config.js` salva em `companies/{t}/configuracoes/romaneioPrintColumns/{tipo}` mas não havia nó `configuracoes` nas rules (`$companyId` tinha `.write:false`). Adicionado `companies/$companyId/configuracoes` (read/write tenant, padrão `preferences`) em `database.rules.json`. Deploy `--only database` pendente.
- **Nota:** `firebase-rules-production.json` (usado por `apply-firebase-rules.js prod`) já herda `.read`/`.write` amplos do nó pai `$companyId` — BUGs A/B não ocorrem nesse fluxo; `database.rules.json` é o canônico do `firebase.json`.

## Nota: erros já conhecidos que NÃO são bugs do app
- **`ERR_CONNECTION_TIMED_OUT` de gstatic** (login): rede/bloqueio do cliente, não deploy. Ver `CEREBRO §8`.
- **Sentery `TypeError: r is not a function` (issue 7672938922)**: project `javascript-nextjs` (não é o nosso), sem stack/tags; ruído. Ignorar ou ajustar DSN em `sentry-init.js`.