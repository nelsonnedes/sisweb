# 🚨 INSTRUÇÕES: Aplicar Regras no Firebase Console AGORA

---

## ⚠️ PROBLEMA URGENTE

Modal "Lista de Romaneios TL" mostra erro:  
`permission_denied at /romaneios_tl`

**Causa:** Regras exigiam autenticação mas sistema funciona sem login (como `species`)

---

## ✅ SOLUÇÃO

Regras corrigidas: `.read: true` + `.write: "auth != null"`

Isso permite **leitura sem login** mas **protege escrita**.

---

## 📋 APLICAR NO FIREBASE CONSOLE

### Passo a Passo:

1. **Abra:** `firebase-rules-valid.json` (neste projeto)
2. **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
3. **Acesse:** https://console.firebase.google.com/project/sisweb-7ce82/overview
4. **Vá em:** Realtime Database > Rules
5. **Cole** o conteúdo (Ctrl+V)
6. **Clique em "Publicar"**

---

## ✅ PRONTO!

Após publicar:
- ✅ Modal "Lista de Romaneios TL" vai funcionar
- ✅ Não aparecerá mais `permission_denied`
- ✅ Romaneios serão carregados normalmente

---

**URGENTE:** Aplicar IMEDIATAMENTE para não quebrar o sistema!

