# Design: RBAC por módulo — Dicionário central + permissões padrão (não-regressivo)

Data: 2026-08-24
Branch: `rbac-module-dictionary`
Status: PROPOSTA (fase 1 — infraestrutura, sem forçar regras)

## Objetivo

Expandir o RBAC além do módulo Finance (que hoje é o único com gate real por
papel/permissão). Objetivo desta fase: criar a **infraestrutura central** de
permissões por módulo sem **quebrar nenhuma funcionalidade existente** nem
**bloquear acesso** de membros já ativos.

## ⚠️ Riscos / por que fase 1 não força regras

Diagnóstico (2026-08-24, branch `rbac-close-member-breach`):

- Hoje **nenhum backend atribui `permissions.{modulo}` automaticamente**. Membros
  recebem apenas `role` (onboarding seta `role: 'admin'`). Não há defaults por
  role que criem permissões de módulo.
- As regras RTDB de todos os módulos operacionais (pedidosVenda, estoque, folha,
  fiscal, etc.) exigem apenas "membro + subscription ativa" — SEM gate por módulo.
- CONSEQUÊNCIA: se adicionarmos `requires(permissions.sales)` nas regras **hoje**,
  todos os membros existentes perderiam acesso → **quebra o sistema**.

Por isso, a Fase 1 **provisória apenas**:
- Define o dicionário canônico de módulos.
- Cria a lógica de **permissões padrão por papel** (aditiva e idempotente).
- Fornece função de **atribuição/backfill** (superadmin) de permissões.
- **NÃO altera as regras RTDB** para exigir permissões (fase 2, separada, após
  garantir que todos têm permissões atribuídas).

## Dicionário de módulos

Chaves de permissão de **negócio** (por tenant). Formato: booleano simples
(`true`) OU objeto `{ read?, write?, manage?, enabled? }` — mesmo padrão do Finance.

| Chave | Módulo lógico | Nós RTDB principais |
|---|---|---|
| `finance` | Financeiro | `financas`, `printPreferences`, `finance_snapshots`, `sequences` |
| `sales` | Vendas | `vendas`, `pedidosVenda` |
| `purchases` | Compras | `pedidosCompra` |
| `inventory` | Estoque (produtos) | `estoqueProdutos`, `movimentacoesProdutos` |
| `stock` | Estoque de toras | `estoqueTorasAtual`, `movimentacoesToras`, `rastreabilidade` |
| `payroll` | Folha de pagamento | `folha`, `folhas`, `cargos`, `funcionarios`, `bancoHoras` |
| `fiscal` | Fiscal / NF-e | `fiscal` (RTDB) — já em `nf-functions.js` |
| `romaneios` | Romaneios | `romaneios`, `romaneiosTora`, `romaneiosPct`, `preromaneios`, `species` |
| `clients` | Cadastros / Clientes | `clients` |
| `suppliers` | Cadastros / Fornecedores | `fornecedores` |
| `products` | Cadastros / Produtos | `produtos` |
| `species` | Cadastros / Espécies | `especies`, `especies_cache` |
| `config` | Configurações / preferências | `configuracoes`, `preferences` |

Aliases aceitos (para compat): `financas`, `financial` → `finance`;
`companyProfile`, `empresa` → `profile` (write do perfil de empresa).

## Perfil/campos no membro

`companies/{companyId}/users/{uid}/permissions` (objeto) + `roles/{uid}/permissions`
(espelho, como o Finance já usa `roles/${uid}`). Estrutura:

```json
{
  "permissions": {
    "finance": { "enabled": true, "read": true, "write": true, "manage": true },
    "sales": true,
    "inventory": true
  }
}
```

## Permissões padrão por papel (defaults — aditiva)

Papéis de conta primária/admin têm tudo habilitado (retrocompatível):
- `owner`, `admin`, `company_admin`: **todas** as chaves `{enabled,read,write,manage:true}`.
- `finance`/`financial`/`financeiro`: `finance` habilitado (+ todos os demais a
  `false`/ausentes), para não alterar o comportamento atual do Finance.
- `sales`: `sales` habilitado (+ dependências `inventory`).
- `viewer`: todas as leituras `read:true`, sem `write`.

Regra: **nunca revogar acesso que o usuário já tem hoje por `role`**. Ou seja, o
default por papel é um "piso" (enabled), não um teto. Membros antigos com
`role:'admin'` recebem todas permissões (mantêm acesso atual).

## Atribuição / backfill (Callable)

Novas callables (admin/tenant):
- `setMemberModulePermissions({ userId, permissions })` — superadmin-only grava o
  objeto `permissions` no membro, validando contra o dicionário + normalizando.
- `applyDefaultModulePermissions({ tenantId })` — superadmin-only; idempotente;
  aplica defaults por papel a todos os membros do tenant (para preparar a Fase 2).
- `resolveMemberModulePermissions(record)` — helper não-callable (interno) que
  combina `role` padrão + `permissions` explícitas → objeto efetivo.

## Regras RTDB — NÃO alterar nesta fase

Nenhuma regra de `database.rules.json` muda nesta fase. A Fase 2 (separada, sob
revisão) exigirá `permissions.{modulo}` por nó, mas **somente depois** de rodar o
backfill para garantir que todos membros têm permissões. Isso evita a quebra.

## Testes

- `tests/rbac-module-permissions.test.mjs` (unit/funcional, sem emulador):
  - dicionário: todas as chaves válidas; aliases mapeiam corretamente.
  - `resolveMemberModulePermissions`: por papel (admin→tudo; finance→só finance;
    sales→sales; viewer→read-only).
  - normalização: `true` e `{read,write,manage,enabled}`.
  - callables: `setMemberModulePermissions` rejeita chave inválida (fora do
    dicionário); `applyDefaultModulePermissions` idempotente (não duplica / não
    revoga).

## Critérios de aceite (fase 1)

- Nenhuma mudança em `database.rules.json` (sem mudança de acesso).
- Funcionalidades existentes intactas (suíte 490+ pass; pre-merge 6/6).
- Callables novas são aditivas; não alteram o fluxo atual de onboarding/login.
- Testes novos cobrem o dicionário, default por papel e normalização.
