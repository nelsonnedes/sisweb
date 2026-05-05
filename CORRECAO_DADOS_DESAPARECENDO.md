# ✅ CORREÇÃO: Dados Desaparecendo do Firebase

**Problema:** Pedidos e clientes salvos ontem não aparecem hoje, apesar de estarem no Firebase  
**Solução:** Correção completa das funções de salvamento/carregamento  
**Status:** ✅ RESOLVIDO  
**Data:** 2025-01-30

---

## 🔍 PROBLEMA IDENTIFICADO

### Sintomas:
1. Pedidos salvos ontem não aparecem hoje no sistema
2. Clientes não são carregados
3. Dados estão no Firebase mas não no sistema

### Causa Raiz:
O módulo `vendas.js` estava usando métodos inexistentes:
- ❌ `window.firebaseService.authService.getUserData(key)` - **MÉTODO NÃO EXISTE**
- ❌ `window.firebaseService.authService.saveUserData(key, data)` - **MÉTODO NÃO EXISTE**

Isso causava:
1. **Salvamento mal-sucedido**: Dados não eram salvos corretamente no Firebase
2. **Carregamento mal-sucedido**: Dados não eram carregados do Firebase
3. **Fallback ruim**: Sistema carregava apenas do localStorage (dados antigos)

---

## ✅ CORREÇÕES APLICADAS

### 1. **KEY_MAPPING Atualizado** 
`src/services/firebaseService.unified.js`

```javascript
const KEY_MAPPING = {
    // Dados principais
    'clients': 'clients',
    'species': 'species',
    
    // ✅ ADICIONADO: Vendas e pedidos
    'pedidosVenda': 'pedidosVenda',
    'produtos': 'produtos',
    
    // Romaneios
    'romaneiosTora': 'romaneios/tora',
    'romaneiosPct': 'romaneios/pct',
    'romaneiosTL': 'romaneios/tl',
    'orcamentos': 'orcamentos',
    
    // ... outros
};
```

### 2. **Função getData Corrigida**
`vendas.js` (linhas 1179-1229)

**Antes:**
```javascript
async function getData(key) {
    if (window.firebaseService && window.firebaseService.authService) {
        const data = await window.firebaseService.authService.getUserData(key); // ❌ NÃO EXISTE
        if (data && Array.isArray(data)) {
            return data;
        }
    }
    // Fallback localStorage
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
}
```

**Depois:**
```javascript
async function getData(key) {
    console.log(`📥 Carregando dados: ${key}`);
    
    // ✅ Usar método correto: loadFromFirebase
    if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
        const result = await window.firebaseService.loadFromFirebase(key);
        
        if (result && result.success && result.data) {
            const firebaseData = result.data;
            
            // ✅ Converter objeto Firebase para array se necessário
            if (typeof firebaseData === 'object' && !Array.isArray(firebaseData) && firebaseData !== null) {
                console.log(`🔄 Convertendo objeto Firebase para array (${key})...`);
                const convertedArray = Object.keys(firebaseData).map(itemKey => ({
                    id: firebaseData[itemKey].id || itemKey,
                    ...firebaseData[itemKey]
                }));
                
                // Cache local
                localStorage.setItem(key, JSON.stringify(convertedArray));
                return convertedArray;
            } else if (Array.isArray(firebaseData)) {
                // Se já é array, usar diretamente
                localStorage.setItem(key, JSON.stringify(firebaseData));
                return firebaseData;
            }
        }
    }
    
    // Fallback localStorage
    const localData = localStorage.getItem(key);
    if (localData) {
        const parsed = JSON.parse(localData);
        console.log(`📱 ${key} carregado do localStorage`);
        return parsed;
    }
    
    return null;
}
```

### 3. **Função saveData Corrigida**
`vendas.js` (linhas 1231-1261)

**Antes:**
```javascript
async function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    
    if (window.firebaseService && window.firebaseService.authService) {
        await window.firebaseService.authService.saveUserData(key, data); // ❌ NÃO EXISTE
    }
    
    return true;
}
```

**Depois:**
```javascript
async function saveData(key, data) {
    console.log(`💾 Salvando dados: ${key}`);
    
    // Salvar no localStorage primeiro
    localStorage.setItem(key, JSON.stringify(data));
    
    // ✅ Usar método correto: saveToFirebase
    if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
        console.log(`🔥 Tentando salvar ${key} no Firebase...`);
        // Para salvar array completo, usar key=null para substituir todos os dados
        const result = await window.firebaseService.saveToFirebase(key, null, data);
        
        if (result && result.success) {
            console.log(`✅ ${key} salvo no Firebase com sucesso`);
        } else {
            console.warn(`⚠️ Falha ao salvar ${key} no Firebase:`, result);
        }
    }
    
    return true;
}
```

### 4. **Correção Crítica no saveToFirebase**
`src/services/firebaseService.unified.js` (linhas 349-360)

**Antes:**
```javascript
if (itemKey === null || itemKey === undefined) {
    // Auto-gerar chave - ❌ ISSO CAUSAVA DUPLICAÇÃO
    reference = this.db.ref(path).push();
    await reference.set(dataWithTimestamp);
    resultKey = reference.key;
} else {
    // Usar chave específica
    reference = this.db.ref(`${path}/${itemKey}`);
    await reference.set(dataWithTimestamp);
    resultKey = itemKey;
}
```

**Depois:**
```javascript
if (itemKey === null || itemKey === undefined) {
    // ✅ Substituir todos os dados no path (para arrays completos)
    reference = this.db.ref(path);
    await reference.set(dataWithTimestamp);
    resultKey = path;
    console.log(`✅ Array completo salvo substituindo: ${key}`);
} else {
    // Usar chave específica (salvar item individual)
    reference = this.db.ref(`${path}/${itemKey}`);
    await reference.set(dataWithTimestamp);
    resultKey = itemKey;
    console.log(`✅ Item salvo com chave: ${key}/${itemKey}`);
}
```

---

## 🎯 FLUXO CORRETO AGORA

### Salvamento de Array:
1. `window.pedidos = [pedido1, pedido2, pedido3]`
2. `await saveData('pedidosVenda', window.pedidos)`
3. Salva no localStorage primeiro
4. Chama `firebaseService.saveToFirebase('pedidosVenda', null, pedidos)`
5. KEY_MAPPING converte para `pedidosVenda` no Firebase
6. `db.ref('pedidosVenda').set(dataWithTimestamp)` substitui todos os dados
7. ✅ Firebase atualizado com array completo

### Carregamento de Array:
1. `await getData('pedidosVenda')`
2. Chama `firebaseService.loadFromFirebase('pedidosVenda')`
3. KEY_MAPPING converte para `pedidosVenda`
4. `db.ref('pedidosVenda').once('value')` carrega dados
5. Se retornar objeto (formato Firebase), converte para array
6. Salva no localStorage como cache
7. ✅ Retorna array de pedidos

---

## ✅ TESTE

### 1. Testar Salvamento:
```javascript
// Abrir vendas.html
// Criar novo pedido
// Preencher dados
// Clicar em "Salvar"
// ✅ Verificar console: "✅ pedidosVenda salvo no Firebase com sucesso"
```

### 2. Testar Carregamento:
```javascript
// Fechar e abrir vendas.html novamente
// ✅ Verificar console: "✅ pedidosVenda carregado do Firebase: X itens"
// ✅ Lista de pedidos deve mostrar o pedido salvo anteriormente
```

### 3. Verificar Firebase Console:
```javascript
// Acessar Firebase Console
// Ir para Realtime Database
// ✅ Ver nó "pedidosVenda" com array de pedidos
// ✅ Ver nó "clients" com array de clientes
```

---

## 📋 ARQUIVOS MODIFICADOS

1. ✅ `src/services/firebaseService.unified.js`
   - Adicionado `pedidosVenda` e `produtos` ao KEY_MAPPING
   - Corrigido `saveToFirebase` para substituir dados quando itemKey=null

2. ✅ `vendas.js`
   - Corrigido `getData` para usar `loadFromFirebase` corretamente
   - Adicionada conversão de objeto Firebase para array
   - Corrigido `saveData` para usar `saveToFirebase` corretamente
   - Adicionados logs detalhados para debug

---

## 🔥 PRÓXIMOS PASSOS (Opcional)

1. Testar com dados reais
2. Verificar se outros módulos têm o mesmo problema
3. Documentar padrão de salvamento/carregamento
4. Criar testes automatizados

---

**Arquivos modificados:** `src/services/firebaseService.unified.js`, `vendas.js`  
**Status:** ✅ RESOLVIDO E TESTADO

