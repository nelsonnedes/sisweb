# Relatório Técnico de Tenancy

## Objetivo

Padronizar leitura e escrita no Realtime Database em `companies/{companyId}/...`, reduzir `Permission denied` e criar checklist de regressão por módulo.

## Matriz arquivo → path → status

| Arquivo | Paths principais | Status | Observação |
|---|---|---|---|
| `vendas.js` | `pedidosVenda`, `carregoPagamentos`, `contasReceber/{mes}`, `produtos`, `auditoriaTransacoes` | OK | Usa `firebaseService.loadFromFirebase/saveToFirebase` |
| `compras.js` | `key` genérico via serviço (`compras`, `contasPagar`, etc.) | OK | `getData/saveData` delegam ao serviço central |
| `estoque.js` | `estoqueTorasAtual`, `movimentacoesToras`, `species/especies`, `romaneiosTora`, `romaneiosPct/TL/Pes` | OK | Opera via serviço central |
| `financas.js` | `contasReceber/{mes}`, `contasPagar/{mes}`, `finance_snapshots/{mes}`, `fornecedores`, `funcionarios`, `clients` | OK | Namespacing aplicado no serviço e helper local |
| `js/client.js` | `clients` | OK | Leitura/escrita via serviço central |
| `js/species.js` | `species` | OK | Leitura/escrita via serviço central |
| `js/fornecedor.js` | `fornecedores`, `clients` | OK | Leitura/escrita via serviço central |
| `fornecedor-modals.js` | `fornecedores` | AJUSTADO | Removido caminho preferencial com `window.firebase.database().ref(...)` |
| `client-service.js` | `clients` | AJUSTADO | Fallback prioriza `unifiedFirebaseService.saveToFirebase` |
| `romaneios-client-save-fix.js` | `clients` | AJUSTADO | Fallback prioriza `unifiedFirebaseService.saveToFirebase` |
| `firebaseService.js` | resolução global de paths | AJUSTADO | `getTenantId` robusto e ordem de candidatos melhorada para paths globais |

## Regras RTDB ajustadas

Arquivos atualizados:

- `firebase-rules-production.json`
- `database.rules.json`

Ajustes aplicados:

- leitura de nó pai liberada para perfis administrativos em:
  - `companies/.read`
  - `users/.read`
  - `subscriptionRequests/.read`
  - `subscriptionAudit/.read`
  - `subscriptionExtensionRequests/.read`

Motivo:

- o painel admin carrega listagens no nível do nó pai (`companies`, `users`, `subscriptionRequests`) e as regras antigas liberavam apenas filhos (`$uid`, `$companyId`), gerando `Permission denied` na leitura de coleção.

## Checklist de regressão (próximas releases)

1. Login com superadmin e abrir `admin.html`:
   - não deve haver `Permission denied` para leitura de `companies`, `users`, `subscriptionRequests`.
2. Acessar abas admin:
   - Assinaturas, Configuração, Status e Campanhas carregam sem 401/permission denied de RTDB.
3. Fluxos de gravação:
   - `vendas`, `compras`, `estoque`, `finanças`, `cadastros` persistem em `companies/{companyId}/...`.
4. Verificar tenant ativo:
   - `window.appTenantId` e `localStorage.company_info.companyId` preenchidos.
5. Logs:
   - sem fallback recorrente para `db.ref` legado.

## Comando de deploy das regras

```bash
firebase deploy --only database --project sisweb-7ce82
```

## Observação operacional

Se persistir `401` nas Cloud Functions admin (`syncMyAdminClaims`, `getSubscriptionSettings`, `getCampaignExecutiveSummary`), o problema é de autenticação/token da sessão no cliente, não de regra RTDB. Nesse caso:

1. logout completo;
2. login novamente;
3. atualizar token (`getIdToken(true)` no fluxo de auth já existente);
4. reabrir `admin.html`.
