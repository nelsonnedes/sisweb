# 📋 DOCUMENTAÇÃO: Unificação de Tabelas de Contas

**Data:** 2025-01-30  
**Status:** ✅ IMPLEMENTADO  
**Versão:** 1.0.0

---

## 🎯 OBJETIVO

Unificar as tabelas duplicadas de contas a receber e contas a pagar no Firebase, garantindo que todos os módulos do sistema usem as mesmas tabelas.

---

## 📊 SITUAÇÃO ANTES DA UNIFICAÇÃO

### Tabelas Duplicadas:
- ❌ `contas_receber` (com underscore) - Usado em dashboard e sample-data-generator
- ❌ `contasreceber` (sem separação) - Não encontrado em uso ativo
- ✅ `contasReceber` (camelCase) - **USADO PELA MAIORIA DOS MÓDULOS**

- ❌ `contas_pagar` (com underscore) - Usado em dashboard e sample-data-generator
- ❌ `contaspagar` (sem separação) - Não encontrado em uso ativo
- ✅ `contasPagar` (camelCase) - **USADO PELA MAIORIA DOS MÓDULOS**

---

## ✅ PADRÃO ADOTADO

**Tabelas Unificadas:**
- ✅ `contasReceber` - Todas as contas a receber
- ✅ `contasPagar` - Todas as contas a pagar

**Razão:**
- 95% dos módulos já usavam este padrão
- Consistência com nomenclatura JavaScript (camelCase)
- Sistema financeiro principal já usava este padrão

---

## 🔧 ALTERAÇÕES IMPLEMENTADAS

### 1. KEY_MAPPING Atualizado
**Arquivo:** `src/services/firebaseService.unified.js`

```javascript
// ✅ CONTAS A RECEBER/PAGAR - UNIFICAÇÃO
'contasReceber': 'contasReceber',        // Padrão principal
'contas_receber': 'contasReceber',       // Redirecionamento (compatibilidade)
'contasreceber': 'contasReceber',        // Redirecionamento (compatibilidade)
'contasPagar': 'contasPagar',            // Padrão principal
'contas_pagar': 'contasPagar',          // Redirecionamento (compatibilidade)
'contaspagar': 'contasPagar',            // Redirecionamento (compatibilidade)
```

**Benefício:** Código legado continua funcionando automaticamente via redirecionamento.

### 2. Arquivos Atualizados

#### ✅ `modules/dashboard/sample-data-generator.js`
- Antes: `localStorage.setItem('contas_receber', ...)`
- Depois: `localStorage.setItem('contasReceber', ...)`
- Antes: `saveData('contas_receber', ...)`
- Depois: `saveData('contasReceber', ...)`

#### ✅ `modules/dashboard/dashboard-core.js`
- Antes: `loadFromHybrid('contas_receber')`
- Depois: `loadFromHybrid('contasReceber')`
- Antes: `loadFromHybrid('contas_pagar')`
- Depois: `loadFromHybrid('contasPagar')`

### 3. Arquivos que JÁ ESTAVAM CORRETOS
- ✅ `financas.js` - Sistema financeiro principal
- ✅ `vendas.js` - Pedidos de venda
- ✅ `modules/romaneiopct/modal-lista-romaneios-pct.js` - Romaneios PCT
- ✅ `modules/modals/modal-lista-romaneios.js` - Romaneios TL

---

## 📝 FLUXO DE ORIGEM DAS CONTAS

### 1. **Vendas (vendas.html)**
```
Usuário cria pedido → Define formas de pagamento → Salva pedido
↓
gerarContasReceberFinanceiro() cria contas com:
- origem: 'pedido_venda'
- origemId: pedido.id
- clienteId: pedido.clienteId
- descricao: "Venda - Pedido {numero}"
↓
Salvo em: contasReceber
```

### 2. **Romaneio TL (romaneiotl.html)**
```
Usuário clica "Lançar contas a receber" → lancarContasReceber()
↓
criarContaReceberRomaneio() cria conta com:
- origem: 'romaneio_tl'
- origemId: romaneio.id
- clienteId: clienteId sincronizado
- descricao: espécies do romaneio
↓
Salvo em: contasReceber
```

### 3. **Romaneio PCT (romaneiopct.html)**
```
Usuário clica "Lançar contas a receber" → lancarContasReceber()
↓
criarContaReceberRomaneio() cria conta com:
- origem: 'romaneio_pct'
- origemId: romaneio.id
- clienteId: clienteId sincronizado
- descricao: espécies do romaneio
↓
Salvo em: contasReceber
```

### 4. **Manual (financas.html)**
```
Usuário preenche formulário → salvarContaReceber()
↓
Cria conta com:
- origem: 'manual'
- cliente/clienteId: do formulário
↓
Salvo em: contasReceber
```

---

## 🔄 MIGRAÇÃO DE DADOS

### Script de Migração
**Arquivo:** `scripts/migrar-tabelas-contas.js`

**Como usar:**
1. Abrir `financas.html` (ou qualquer página com firebaseService carregado)
2. Abrir console do navegador (F12)
3. Executar: `migrarTabelasContas()`

**O que faz:**
- Verifica se existem dados em `contas_receber`, `contasreceber`, `contas_pagar`, `contaspagar`
- Se existirem, migra para `contasReceber` e `contasPagar`
- Evita duplicatas verificando IDs existentes
- Retorna relatório de migração

**Limpar tabelas antigas (APÓS CONFIRMAR MIGRAÇÃO):**
```javascript
limparTabelasAntigas()  // ⚠️ Remove tabelas antigas - Use com cuidado!
```

---

## ✅ ESTRUTURA DE DADOS UNIFICADA

### Conta a Receber
```javascript
{
    id: string,                    // ID único
    cliente: string,               // Nome do cliente
    clienteId: string,             // ID do cliente
    descricao: string,             // Descrição
    valor: number,                 // Valor
    dataVencimento: string,        // YYYY-MM-DD
    status: 'pendente' | 'pago' | 'parcial' | 'cancelado',
    categoria: string,             // Ex: 'Vendas'
    origem: 'manual' | 'pedido_venda' | 'romaneio_tl' | 'romaneio_pct',
    origemId: string,              // ID do documento de origem
    tipoPagamento?: string,        // Opcional
    observacoes?: string,          // Opcional
    parcela?: number,              // Opcional (para parcelas)
    totalParcelas?: number,        // Opcional (para parcelas)
    valorTotal?: number,           // Opcional (valor total)
    pedidoNumero?: string,         // Se de vendas
    romaneioData?: string,         // Se de romaneio
    romaneioCliente?: string,     // Se de romaneio
    romaneioEspecies?: string,     // Se de romaneio
    created: string,               // ISO timestamp
    updated?: string               // ISO timestamp
}
```

### Conta a Pagar
```javascript
{
    id: string,                    // ID único
    fornecedor: string,            // Nome do fornecedor
    descricao: string,             // Descrição
    valor: number,                 // Valor
    dataVencimento: string,        // YYYY-MM-DD
    status: 'pendente' | 'pago' | 'parcial' | 'cancelado',
    categoria: string,             // Categoria da despesa
    tipo: string,                  // Tipo de pagamento
    observacoes?: string,         // Opcional
    parcela?: number,              // Opcional (para parcelas)
    totalParcelas?: number,       // Opcional (para parcelas)
    valorTotal?: number,           // Opcional (valor total)
    created: string,               // ISO timestamp
    updated?: string               // ISO timestamp
}
```

---

## 🧪 TESTES

### Teste 1: Verificar KEY_MAPPING
```javascript
// Abrir console e executar:
const result = await window.firebaseService.loadFromFirebase('contas_receber');
// Deve redirecionar automaticamente para 'contasReceber'
```

### Teste 2: Criar conta de cada origem
1. Criar pedido em vendas → Verificar se aparece em financas.html
2. Lançar conta de romaneio TL → Verificar se aparece em financas.html
3. Lançar conta de romaneio PCT → Verificar se aparece em financas.html
4. Criar conta manual → Verificar se aparece corretamente

### Teste 3: Verificar dashboard
```javascript
// Dashboard deve carregar contas usando contasReceber e contasPagar
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

- [x] Analisar estrutura atual
- [x] Adicionar KEY_MAPPING para compatibilidade
- [x] Atualizar sample-data-generator.js
- [x] Atualizar dashboard-core.js
- [x] Criar script de migração
- [x] Documentar estrutura unificada
- [ ] Executar migração em produção (pendente)
- [ ] Limpar tabelas antigas após confirmação (pendente)

---

## ⚠️ IMPORTANTE

1. **Execute o script de migração ANTES de fazer deploy**
2. **Verifique os dados após a migração**
3. **Apenas depois de confirmar, execute limparTabelasAntigas()**
4. **KEY_MAPPING garante compatibilidade retroativa** - código antigo continua funcionando

---

## 🆘 TROUBLESHOOTING

### Problema: Contas não aparecem no dashboard
**Solução:** Verificar se dashboard está usando `contasReceber` e `contasPagar` (já corrigido)

### Problema: Erro ao migrar dados
**Solução:** Verificar logs do console, pode haver dados corruptos. Filtrar antes de migrar.

### Problema: Duplicação de contas após migração
**Solução:** O script já verifica IDs. Se ainda houver duplicatas, verificar se IDs são únicos.

---

**Arquivos modificados:**
- ✅ `src/services/firebaseService.unified.js`
- ✅ `modules/dashboard/sample-data-generator.js`
- ✅ `modules/dashboard/dashboard-core.js`

**Scripts criados:**
- ✅ `scripts/migrar-tabelas-contas.js`

**Documentação:**
- ✅ `ANALISE_TABELAS_DUPLICADAS.md`
- ✅ `DOCUMENTACAO_UNIFICACAO_CONTAS.md`

---

**Status:** ✅ IMPLEMENTAÇÃO COMPLETA - PRONTO PARA MIGRAÇÃO

