# Resumo Completo das Mudanças - Análise de Regressão de Filtros

## Contexto
- **Sistema**: Sisweb Financeiro (produção com dados reais)
- **Problema original**: `FirebaseError: Dias de atraso não correspondem ao cálculo da conta` (HTTP 400 no `financeRegisterPayment`)
- **Problema secundário**: Spam de "Erro de permissão" no console durante startup

---

## Commits Realizados (3)

### 1. `d1d5480` - Fix UTC Alignment (financas.js)
**Arquivo**: `financas.js`
**Mudança**: `normalizeDateToTimestamp()` alterado de **local time** para **UTC**

```javascript
// ANTES (local time - bug)
const t = new Date(y, m - 1, d).getTime();

// DEPOIS (UTC - alinhado com backend)
const t = Date.UTC(y, m - 1, d);
```

**Funções afetadas**:
- `normalizeDateToTimestamp()` - linha 8988
- `getTodayStartTimestampLocal()` - agora usa `getTodayISODateUTC()` (linha 4237)
- Nova função `getTodayISODateUTC()` - linha 4229

**Impacto**: Todas as comparações de data no financeiro agora usam UTC (consistente com backend `dateToDayNumber`)

---

### 2. `322ac72` - Cache Buster Update (financas.html)
**Arquivo**: `financas.html`
**Mudança**: Hash do cache-buster atualizado via `inject-cachebusters.mjs`
- `financas.js?v=2378c2805ec9` → `financas.js?v=2e8630ed7c2f`

---

### 3. `f141907` - Race Condition Fix (financas.js, financas.html)
**Arquivos**: `financas.js`, `financas.html`
**Mudança**: `inicializarSistema()` agora é `async` e faz `await carregarDados()` antes de `cleanupTombstones()`

```javascript
// ANTES
function inicializarSistema() {
    carregarDados(); // não aguardava
    cleanupTombstones(); // rodava antes do tenant estar pronto
}

// DEPOIS
async function inicializarSistema() {
    await carregarDados(); // aguarda tenant autenticado
    cleanupTombstones(); // agora roda com tenant válido
}
```

**Cache-buster atualizado**: `financas.js?v=11518d881a1a`

---

## Testes Automatizados
- **Suite completa**: 410/410 passam
- **Testes financeiros específicos**: 33/33 passam (`finance-transactions.test.mjs`)
- **Testes de juros/callers**: Passam (`financas-juros-callers.test.mjs`)
- **Testes de relatórios/exportação**: Passam (`financas-relatorios-exportacoes.test.mjs`)

---

## Código de Filtros - Análise de Risco

### Filtros de Tabela (receber/pagar) - Linhas 2964-2975, 3044-3055
```javascript
const inicioTs = normalizeDateToTimestamp(filtro.dataInicio);  // UTC
const fimTs = normalizeDateToTimestamp(filtro.dataFim);        // UTC

// Comparação com datas da conta (também UTC agora)
const tsVenc = getContaVencimentoTimestamp(c);  // normalizeDateToTimestamp(c.dataVencimento)
const tsEmi = normalizeDateToTimestamp(c.dataEmissao);
return (tsVenc >= inicioTs) || (tsEmi >= inicioTs);
```

**Risco**: Baixo - ambos lados usam a MESMA função `normalizeDateToTimestamp` (UTC)

### Filtros de Relatórios - Linha 7347 (`isFinanceDateInRange`)
```javascript
function isFinanceDateInRange(value, start, end) {
    const normalized = normalizeDateISOInput(value);  // STRING "YYYY-MM-DD" (local)
    return !!normalized && normalized >= start && normalized <= end;  // String comparison
}
```
**Usa**: `normalizeDateISOInput` (retorna string local via `formatISODateLocal`)
**Diferente** dos filtros de tabela (que usam timestamp numérico UTC)

### `normalizeDateISOInput` - Linha 9212
```javascript
function normalizeDateISOInput(raw) {
    // ...
    const dt = new Date(num);
    return formatISODateLocal(dt);  // LOCAL time components
}
```

---

## Possíveis Causas da Regressão de Filtros

### Hipótese 1: Service Worker servindo versão antiga
- Cache-buster atualizado, mas SW pode estar servindo `financas.js` antigo
- **Verificação**: Network tab → `financas.js?v=11518d881a1a` deve aparecer

### Hipótese 2: Formato de data no input divergente
- `<input type="date">` retorna `"YYYY-MM-DD"` (zero-padded)
- Regex em `normalizeDateToTimestamp` exige `\d{4}-\d{2}-\d{2}` ✓
- Fallback `new Date(v).getTime()` usaria local time se regex falhar

### Hipótese 3: Dados históricos com formato inconsistente
- Contas criadas ANTES do fix: `dataVencimento` salvo como string "YYYY-MM-DD"
- Parsing antigo (local) vs novo (UTC) produz timestamps diferentes
- Mas: ambos filtros E contas usam a MESMA função agora → deveria ser consistente

### Hipótese 4: `dataEmissao` em formato diferente
- Alguns registros podem ter `dataEmissao` como `"DD/MM/YYYY"` ou timestamp
- `normalizeDateToTimestamp` trata ambos formatos

### Hipótese 5: Race condition na leitura dos filtros
- `carregarDados()` agora é `await` - pode ter mudado timing de quando filtros são aplicados
- Verificar se `lastFiltroReceber`/`lastFiltroPagar` estão populados antes do primeiro render

---

## Checklist de Validação para Outra IA

1. **Verificar cache-buster ativo em produção**
   - `financas.js?v=11518d881a1a` no Network tab
   - Hard refresh: `Ctrl+Shift+R` ou DevTools → Application → Service Workers → Unregister

2. **Testar filtros de data isoladamente**
   - Abrir console e executar:
   ```javascript
   normalizeDateToTimestamp('2026-08-14')  // deve retornar UTC timestamp
   getContaVencimentoTimestamp(contaExemplo)  // mesmo formato
   ```

3. **Verificar se `dataInicio`/`dataFim` estão sendo lidos**
   ```javascript
   document.getElementById('filtroReceberDataInicio').value
   document.getElementById('filtroReceberDataFim').value
   ```

4. **Comparar parsing de filtro vs conta**
   - Mesmo date string → mesmo timestamp?

5. **Verificar `normalizeDateISOInput` vs `normalizeDateToTimestamp`**
   - Relatórios usam string comparison (local)
   - Tabelas usam timestamp comparison (UTC)
   - Podem divergir em bordas de timezone

---

## Arquivos Modificados

| Arquivo | Linhas Alteradas | Tipo |
|---------|------------------|------|
| `financas.js` | 4226-4238, 8984-9003, 1021-1049 | Core logic |
| `financas.html` | 2005 (cache-buster) | Asset reference |

---

## Rollback de Emergência

Se confirmada regressão crítica:
```bash
git revert f141907 322ac72 d1d5480
npm run build:hosting && npm run deploy:hosting
```

**Nota**: O fix UTC (`d1d5480`) é necessário para corrigir o erro original de "Dias de atraso". O rollback traria de volta o bug HTTP 400.