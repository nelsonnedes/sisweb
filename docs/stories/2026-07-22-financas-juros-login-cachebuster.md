# Correções: Juros Financeiros, Login e Infraestrutura de Deploy

**Data:** 2026-07-22
**Status:** ✅ IMPLEMENTADO, DEPLOYADO E VERIFICADO EM PRODUÇÃO
**Versão:** 1.1.0

---

## 📋 Commits

| Commit | Descrição |
|--------|-----------|
| `5334623` | Juros contratuais + campo data emissão + loading states + inject-cachebusters ES Module + firebase-init.js |
| `f8a2508` | firebase-compat-bridge.js no hosting-files.json |
| `e9142ad` | Regex multiline para imports estáticos |

---

## 📋 Escopo

Correções cirúrgicas no módulo financeiro (cálculo de juros, campo data de emissão), no sistema de login (cachebuster stale, firebase-init.js ausente no deploy), e na infraestrutura de deploy (inject-cachebusters.mjs para imports ES Module estáticos).

---

## 🔧 1. Correção: Juros Contratuais na Tabela Financeira

### Problema
A conta PX000039 (R$ 100.000, emissão 11/03/2026, vencimento 11/04/2026, taxa 3%) mostrava juros de **R$ 10.100** (mora: 102 dias de vencimento→hoje) em vez de **R$ 3.100** (contratual: 31 dias de emissão→vencimento).

### Causa Raiz
O Caminho 3 de `getContaFinanceInfo` em `financas.js` usava:
```javascript
const tsStart = Math.max(tsVenc, tsBaseJuros, tsEmissao);  // ← errado
const tsHoje = getTodayStartTimestampLocal();
const diasAtraso = (tsStart && tsHoje > tsStart) ? Math.floor((tsHoje - tsStart) / 86400000) : 0;
```
Isso calculava **juros de mora acumulada** (vencimento→hoje) em vez de **juros contratuais** (emissão→vencimento).

### Correção
```javascript
const tsInicio = Math.max(tsBaseJuros || 0, tsEmissao || 0);  // ← data base
const tsFim = tsVenc || 0;                                      // ← data fim = vencimento
const dias = (tsInicio && tsFim >= tsInicio) ? Math.floor((tsFim - tsInicio) / 86400000) : 0;
```

### Condição do Caminho 2
`statusRaw !== 'pendente'` → `statusRaw === 'parcial'` — evitava que contas 'vencido' sem histórico caíssem no caminho de juros de mora.

### Arquivos modificados
- `financas.js` — lógica de cálculo de juros
- `tests/financas-juros-callers.test.mjs` — 17 testes

---

## 📅 2. Correção: Campo Data de Emissão no Formulário

### Problema
O campo `dataEmissao` era referenciado em 27 lugares no `financas.js` mas **nunca foi adicionado ao HTML**. `document.getElementById('receberDataEmissao')` retornava `null`.

### Correção
Adicionados campos `<input type="date">` em `financas.html`:
- `receberDataEmissao` — formulário de contas a receber
- `pagarDataEmissao` — formulário de contas a pagar

Ambos antes do campo "Data do Primeiro Vencimento". Opcionais (sem `required`).

### Arquivos modificados
- `financas.html`

---

## ⏳ 3. Correção: Loading States em Botões de Submit

### Problema
Botões "Salvar", "Atualizar" e "Confirmar Pagamento" não tinham proteção contra duplo clique nem feedback visual de processamento.

### Implementação
Função helper `setSubmitButtonLoading(btn, loading, loadingText)` adicionada em `financas.js`:
- `loading=true`: desabilita botão, seta `aria-busy`, salva texto original em `dataset.originalText`, troca texto para `loadingText`
- `loading=false`: reabilita, remove `aria-busy`, restaura texto original

### Correções nos callers
1. **`salvarContaPagar`**: `setSubmitButtonLoading(pagarSubmitBtn, true, 'Salvando...')` no início, re-enable nos 2 caminhos de conclusão
2. **`salvarContaReceber`**: mesmo padrão
3. **`confirmarPagamento`**: `setSubmitButtonLoading(submitBtn, true, 'Registrando...')` no início, re-enable no `finally` block

### Refinamentos (código reviewer)
- **Early returns**: `setSubmitButtonLoading(submitBtn, false)` adicionado antes de cada `return;` nos 6 early returns de `confirmarPagamento` (validações de campos obrigatórios)
- **Duplo clique em editarConta**: Guard `if (window.__financeEditing) return;` + cleanup no `finally`
- **Padronização de catch blocks**: `rs.disabled = false` → `setSubmitButtonLoading(rs, false)` em ambos os catch blocks de `salvarContaReceber` e `salvarContaPagar`
- **Permission denied fix**: Re-enable movido para ANTES do early return no bloco `permission_denied` de `salvarContaReceber`

### Arquivos modificados
- `financas.js`

---

## 🚪 4. Correção: Erro de Login "Falha em Módulo Crítico"

### Problema
`login.html` exibia: *"Falha em módulo crítico: firebaseService não carregou; authService indisponível"*

### Causa Raiz 1: inject-cachebusters.mjs não suportava imports ES Module estáticos
O `login.html` importa `authService` via:
```javascript
import { authService, ... } from './firebaseService.js?v=2026-06-10-subscription-status-ux-v1';
```
A ferramenta `tools/inject-cachebusters.mjs` só atualizava cachebusters em:
- ✅ `<script src="arquivo.js?v=X">`
- ✅ `document.write('<script src="...">')`
- ✅ `import('./arquivo.js')` (dinâmico)
- ❌ **`import { ... } from './arquivo.js'`** (estático — faltava!)

Como o cachebuster nunca era atualizado, navegadores serviam versão velha do `firebaseService.js` que não exportava `authService`, o módulo falhava, e o health check mostrava o erro.

### Correção 1
Adicionada 4ª regex em `tools/inject-cachebusters.mjs`:
```javascript
const staticImportRegex = /(import\s+\{[^}]*\}\s+from\s+['"]\.\/)([^"']+?\.js)(\?v=[^"'\s]*)?(['"])/gi;
```

Cachebuster atualizado:
```
antes:  ./firebaseService.js?v=2026-06-10-subscription-status-ux-v1
depois: ./firebaseService.js?v=676ba9f2a922
```

### Causa Raiz 2: firebase-init.js ausente do hosting-files.json
`login.html` importa `firebase-init.js` via:
```javascript
import { app, auth, db, ... } from './firebase-init.js';
```
Mas o arquivo não estava no `hosting-files.json`, então nunca era copiado para `hosting-dist`. Produção retornava HTTP 404.

### Correção 2
Adicionado `"firebase-init.js"` ao `hosting-files.json` (linha 261). Rebuild passou de 448 para 449 arquivos.

### Resultado Final
```
curl https://sisweb-7ce82.web.app/firebase-init.js → HTTP 200 ✅
curl https://sisweb-7ce82.web.app/firebaseService.js?v=676ba9f2a922 → HTTP 200 ✅
```

### Arquivos modificados
- `tools/inject-cachebusters.mjs`
- `hosting-files.json`

---

## 🧪 5. Testes e Validação

| Teste | Status |
|-------|--------|
| `tests/financas-juros-callers.test.mjs` (17 testes) | ✅ 17/17 pass |
| `tests/finance-transactions.test.mjs` | ✅ Pass |
| `tests/financas-contas-pagar-edit.test.mjs` | ✅ Pass |
| Cachebuster local vs produção (financas.js) | ✅ Match `6c61f599f40e` |
| Produção firebase-init.js HTTP 200 | ✅ |
| Login com Ctrl+F5 no preview | ✅ Coluna Emissão aparece, juros R$ 3.100 |

### Deploys executados
```
firebase deploy --only hosting (3 deploys)
```

---

## 🌐 6. Correção Adicional: firebase-compat-bridge.js 404

### Problema
`index.html` linha 62 importa `import './firebase-compat-bridge.js'` mas o arquivo não estava no `hosting-files.json`, causando HTTP 404.

### Correção
Adicionado `"firebase-compat-bridge.js"` ao `hosting-files.json` (linha 261). Rebuild passou de 449 para 450 arquivos.

### Arquivos modificados
- `hosting-files.json`

---

## 🔧 7. Melhoria: Regex Multiline no inject-cachebusters

### Problema
A regex `staticImportRegex` usava `[^}]*` que não match newlines — se um import ES Module fosse reformatado em múltiplas linhas, o cachebuster não seria atualizado.

### Correção
```javascript
// Antes:  /(import\s+\{[^}]*\}.../gi
// Depois: /(import\s+\{[\s\S]*?\}.../gsi
```

### Arquivos modificados
- `tools/inject-cachebusters.mjs`

---

## 📋 8. Auditoria Completa de Imports ES Module

Varrimento completo de todos os **54 arquivos HTML** em busca de imports relativos de `.js`. Resultado:

| Arquivo JS importado | Presente no hosting-files.json |
|---------------------|:---:|
| `firebase-init.js` | ✅ (foi adicionado) |
| `firebase-compat-bridge.js` | ✅ (foi adicionado) |
| `firebaseService.js` | ✅ (já existia) |
| `modules/core/firebase-service.js` | ✅ (já existia) |

**Nenhum arquivo faltando.** Todos os imports estão cobertos.

---

## ✅ Verificação em Produção

Teste realizado em `https://sisweb-7ce82.web.app/` em 22/07/2026:

| Recurso | Resultado |
|---------|:--------:|
| `login.html` | ✅ HTTP 200 (104KB) |
| `financas.js` | ✅ Hash `6c61f599f40e` (match local) |
| `firebase-init.js` | ✅ HTTP 200 (5.7KB) |
| `firebase-compat-bridge.js` | ✅ HTTP 200 (7KB) |
| `firebaseService.js?` | ✅ HTTP 200 (189KB) |
| Login sem erro crítico | ✅ (logs do usuário confirmam) |

**Preview local (empresa principal):**
- Conta PX000039: Juros R$ **3.100,00** ✅ | Emissão 11/03/2026 ✅ | Vencimento 11/04/2026 ✅

---

## 📊 Estrutura de Dados do Firebase (paths corretos)

```
companies/{companyId}/
├── contasReceber/{mes}/  → camelCase (NÃO contas_receber)
├── contasPagar/{mes}/    → camelCase (NÃO contas_pagar)
├── profile/logo/         → logo da empresa (Storage)
├── clients/              → clientes
├── fornecedores/         → fornecedores
├── species/              → espécies
├── rastreabilidade/      → vinculação tora-romaneio
├── folha/                → funcionarios, cargos, lancamentos
└── fiscal/               → certificados, config NF-e
```

**Princípios de tenancy:**
- NUNCA escrever direto em `companies/{companyId}` — sempre via Cloud Function
- SEMPRE usar `firebaseService.resolveAuthenticatedTenant()` antes de operações online
- FALLBACK para `localStorage.company_info` apenas em modo offline/PWA

---

## 📚 Documentação Lida para Contexto

- `SISWEB_SYSTEM_DIAGRAM.md` — arquitetura geral, catálogo de páginas
- `DOCUMENTACAO_UNIFICACAO_CONTAS.md` — padrão camelCase contasReceber/contasPagar
- `FIREBASE_SECURITY_GUIDE.md` — regras de segurança RTDB
- `RELATORIO_MATRIZ_PATHS_TENANCY.md` — matriz de paths por módulo
- 93 stories em `docs/stories/` — todos os módulos do sistema

---

## 🚧 Pendências Identificadas

1. **Permissão negada em salvarContaPagar** — não tem tratamento de `permission_denied` (diferente de `salvarContaReceber` que redireciona para login). Vale adicionar para consistência.
2. **Filtro por data de emissão** — filtros de data em finanças ainda usam vencimento, não emissão. Usuário pode querer filtrar por emissão.
3. **Juros de mora no modal de pagamento** — Atualmente mostra juros de mora (vencimento→hoje). Usuário optou por manter como está, mas está documentado para referência.

---

## ✅ Checklist

- [x] Juros contratuais na tabela (R$ 3.100 em vez de R$ 10.100)
- [x] Campo Data de Emissão no formulário
- [x] Loading states nos botões (Salvar, Atualizar, Confirmar)
- [x] Proteção duplo clique em editarConta
- [x] Early returns com re-enable do botão
- [x] inject-cachebusters para imports ES Module estáticos
- [x] firebase-init.js no hosting-files.json
- [x] Cachebuster do firebaseService.js atualizado
- [x] Deploy produção
- [x] Testes passando

---

## 9. Recuperacao P0 Da Primeira Conta Financeira - 2026-08-02

### Regressao confirmada

`financeCreateAccounts` voltava sem decisao quando a raiz `financas/{tipo}` ainda era `null`. O callable encerrava com `Criacao financeira sem confirmacao autoritativa` justamente para a primeira conta a pagar ou receber de um tenant.

### Correcao local

- [x] A transacao passou a delegar tambem o estado `null` para `buildAccountsCreateTreeMutation`.
- [x] Teste de handler reproduz a primeira criacao e confirma repeticao idempotente pelo mesmo `operationId`.
- [x] Nenhuma regra, caminho, payload ou logica de edicao/exclusao foi alterada.
- [x] Testes focados e suite completa aprovados.
- [x] Publicada somente a Function `financeCreateAccounts` em `us-central1`; Hosting, Rules e demais Functions nao fizeram parte deste deploy.

Arquivos deste lote: `functions/finance-functions.js` e `tests/finance-transactions.test.mjs`.
