# 🚨 URGENTE: APLICAR REGRAS NO FIREBASE AGORA!

---

## ❌ PROBLEMA RESOLVIDO

Os erros de `permission_denied` foram **corrigidos** nos arquivos locais.

Agora você precisa **APLICAR** essas correções no Firebase Console.

---

## 📋 O QUE FOI CORRIGIDO

**7 tabelas** agora permitem leitura sem autenticação (como `species` e `romaneios`):
1. ✅ `clients`
2. ✅ `fornecedores` (NOVO)
3. ✅ `contasReceber`
4. ✅ `contasPagar`
5. ✅ `pedidosVenda`
6. ✅ `produtos`
7. ✅ `clientesPct`

**Segurança:** Escrita continua protegida (`auth != null`)

---

## 🚀 COMO APLICAR (5 MINUTOS)

### Passo 1: Abrir Firebase Console
https://console.firebase.google.com/project/sisweb-7ce82/overview

### Passo 2: Ir em Rules
Realtime Database > Rules

### Passo 3: Copiar
Abra `firebase-rules-valid.json` no projeto e copie TODO o conteúdo (Ctrl+A, Ctrl+C)

### Passo 4: Colar
Cole no Firebase Console (Ctrl+V)

### Passo 5: Publicar
Clique em "Publicar"

---

## ✅ TESTAR APÓS

1. Abra `romaneiotl.html`
2. Clique em "Lista de Romaneios TL"
3. Clique em "Lançar Contas a Receber"
4. Abra `financas.html#receber`
5. Verifique se carrega sem erros

---

## 📄 DOCUMENTOS DE REFERÊNCIA

- `CORRECAO_REGRA_FIREBASE_PERMISSION_DENIED.md` - Detalhes técnicos
- `RESUMO_CORRECOES_FIREBASE_RULES.md` - Resumo executivo
- `firebase-rules-valid.json` - Regras prontas para colar

---

**TEMPO ESTIMADO:** 5 minutos  
**URGÊNCIA:** 🔴 CRÍTICA  
**STATUS:** ✅ Arquivos prontos, aguardando aplicação no Firebase

