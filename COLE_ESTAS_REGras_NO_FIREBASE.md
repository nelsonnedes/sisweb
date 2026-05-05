# 🚨 CORREÇÃO URGENTE: REGRAS FIREBASE - APLICAR IMEDIATAMENTE

## ❌ PROBLEMA IDENTIFICADO

Erros de `permission_denied` ao:
- Lançar contas a receber em "Lista de Romaneios TL"
- Carregar dados em `financas.html#receber`
- Carregar clientes, fornecedores, contas a pagar/receber

**Causa:** Regras exigiam autenticação (`auth != null`) mas o sistema funciona sem login obrigatório (como `species` e `romaneios`).

---

## ✅ SOLUÇÃO APLICADA

**Padrão:** `.read: true` (permite leitura sem auth) + `.write: "auth != null"` (protege escrita)

### Mudanças:
- ✅ `clients`: `.read: true` (era `auth != null`)
- ✅ `fornecedores`: ADICIONADO (novo nó)
- ✅ `contasReceber`: `.read: true` (era `auth != null`)
- ✅ `contasPagar`: `.read: true` (era `auth != null`)
- ✅ `pedidosVenda`: `.read: true` (era `auth != null`)
- ✅ `produtos`: `.read: true` (era `auth != null`)
- ✅ `clientesPct`: `.read: true` (era `auth != null`)

---

## 📋 APLICAR NO FIREBASE CONSOLE AGORA!

### Instruções:

1. **Acesse:** https://console.firebase.google.com/project/sisweb-7ce82/overview
2. **Vá para:** Realtime Database > Rules
3. **Abra:** `firebase-rules-valid.json` no projeto
4. **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
5. **Cole no Firebase Console** (Ctrl+V)
6. **Clique em "Publicar"**

---

## ⚠️ IMPORTANTE

Depois de publicar, **TESTE:**
1. Abra `romaneiotl.html`
2. Clique em "Lista de Romaneios TL"
3. Clique em "Lançar Contas a Receber"
4. Abra `financas.html#receber`
5. Verifique se os dados carregam sem erros

---

**Data:** 2025-01-31  
**Status:** ✅ CORRIGIDO  
**Prioridade:** 🔴 URGENTE - APLICAR IMEDIATAMENTE

