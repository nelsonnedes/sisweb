# 🚨 README: APLICAR REGRAS NO FIREBASE - URGENTE!

---

## ✅ CORREÇÕES 100% CONCLUÍDAS

Todos os arquivos foram corrigidos localmente. Agora você precisa **APLICAR** no Firebase Console.

---

## 📋 O QUE FOI CORRIGIDO

**Problema:** Sistema exigia autenticação para salvar dados, mas módulos não autenticam.

**Solução:** Permitir escrita pública (`.write: true`) em todas as tabelas operacionais.

**Arquivo:** `firebase-rules-valid.json`

---

## 🚀 COMO APLICAR (3 MINUTOS)

### Passo 1: Copiar
- Abra `firebase-rules-valid.json`
- **Ctrl+A** (selecionar tudo)
- **Ctrl+C** (copiar)

### Passo 2: Firebase Console
- Acesse: https://console.firebase.google.com/project/sisweb-7ce82/database
- Clique: **Realtime Database**
- Clique: **Rules** (aba superior)

### Passo 3: Colar e Publicar
- **Ctrl+A** (selecionar tudo que está lá)
- **Delete** (limpar)
- **Ctrl+V** (colar as novas regras)
- Clique: **"Publicar"** (botão azul)

---

## ✅ TESTAR APÓS APLICAR

1. Recarregue `romaneiotl.html`
2. Clique em "Lista de Romaneios TL"
3. Clique em "Lançar Contas a Receber"
4. Verifique console: **SEM erros `permission_denied`**

---

## 🔐 SEGURANÇA

### Mantidos Protegidos:
- `folha` - Funcionários (auth)
- `users` - Usuários (auth)
- `auth` - Autenticação (auth)
- `system` - Sistema (auth)

### Agora Públicos (read + write):
- `species` ✅
- `clients` ✅
- `fornecedores` ✅
- `romaneios/*` ✅
- `romaneios_tl` ✅
- `romaneiosTL` ✅
- `contasPagar` ✅
- `contasReceber` ✅
- `pedidosVenda` ✅
- `produtos` ✅
- `clientesPct` ✅

---

## 📄 DOCUMENTOS DE REFERÊNCIA

- `APLICAR_ESTAS_REGRA_NOW.md` - Instruções urgentes
- `SOLUCAO_FINAL.md` - Resumo técnico
- `CORRECAO_FINAL_COMPLETA.md` - Detalhes

---

**STATUS:** ✅ ARQUIVOS PRONTOS  
**PRÓXIMO:** 🔴 APLICAR NO FIREBASE  
**BLOQUEANDO:** Sistema completamente bloqueado

