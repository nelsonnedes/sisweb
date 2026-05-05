# 🚨 REGRAS CORRIGIDAS: Aplicar IMEDIATAMENTE no Firebase

**Problema:** Modal "Lista de Romaneios TL" mostra `permission_denied`  
**Causa:** Regras exigiam autenticação mas TL não faz login  
**Solução:** Mudar `.read` de `auth != null` para `true` (como `species`)

---

## ⚠️ ATENÇÃO: ISSO É URGENTE!

O sistema está **funcionando normalmente** em outras partes porque **não usa autenticação obrigatória**.

**Pattern usado:** `.read: true` + `.write: "auth != null"` (como `species`)

---

## 📋 REGRAS ATUALIZADAS

### 1. Abrir `firebase-rules-valid.json`
### 2. Copiar TODO o conteúdo
### 3. Abrir Firebase Console: https://console.firebase.google.com/project/sisweb-7ce82/overview
### 4. Ir em: Realtime Database > Rules
### 5. Cole e PUBLIQUE

---

## 🔄 MUDANÇAS FEITAS

### ANTES ❌
```json
"romaneios": {
  ".read": "auth != null",  // ❌ BLOQUEAVA
  ".write": "auth != null"
},
"romaneios_tl": {
  ".read": "auth != null",  // ❌ BLOQUEAVA
  ".write": "auth != null"
}
```

### AGORA ✅
```json
"romaneios": {
  ".read": true,            // ✅ LIBERA LEITURA
  ".write": "auth != null"
},
"romaneios_tl": {
  ".read": true,            // ✅ LIBERA LEITURA
  ".write": "auth != null"
}
```

---

## 🎯 APLICAR AGORA

**IMPORTANTE:** Aplicar **IMEDIATAMENTE** no Firebase Console, caso contrário o sistema não funcionará!

Arquivo atualizado: `firebase-rules-valid.json`

