# ✅ CORREÇÃO: Dupla Barra de Rolagem no Modal de Espécies TL

**Problema:** Modal "Lista de Espécies" mostra 2 barras de rolagem (modal + tabela)  
**Causa:** `.modal-body` e `.table-container` ambos com `overflow-y: auto`  
**Solução:** Removido `overflow-y` de `.table-container`  
**Status:** ✅ RESOLVIDO

---

## 🔍 PROBLEMA IDENTIFICADO

Modal mostrava **duas barras de rolagem**:
1. No `.modal-body` (correto)
2. No `.table-container` (desnecessário)

**Pattern:** `.modal-body` já controla o scroll, `.table-container` não precisa ter scroll próprio.

---

## ✅ CORREÇÃO APLICADA

### Arquivo: `romaneiotl.html`

**ANTES:**
```css
.table-container {
    max-height: 450px;
    overflow-y: auto;  /* ❌ Scroll desnecessário */
}
```

**DEPOIS:**
```css
.table-container {
    overflow: visible;  /* ✅ Sem scroll próprio */
}
```

---

## 🎯 COMPARAÇÃO COM PCT

**PCT:** Não tem `.table-container` com overflow no CSS geral  
**TL:** Tinha `.table-container` com overflow (removido)  

Ambos agora usam apenas `.modal-body` para scroll.

---

## 📋 TESTE

Após correção:
1. Abra "Lista de Espécies" no TL
2. ✅ Deve ter apenas 1 barra de rolagem
3. ✅ Mesmo comportamento do PCT

---

**Data:** 2025-01-30  
**Arquivo modificado:** `romaneiotl.html` (linha 1026-1029)

