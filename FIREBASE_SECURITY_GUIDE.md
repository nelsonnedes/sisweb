# 🔐 Guia de Segurança do Firebase - Sistema SisWeb

## 📋 Visão Geral

Este documento fornece diretrizes completas para implementar regras de segurança robustas no Firebase Realtime Database do Sistema SisWeb, garantindo proteção adequada dos dados sem quebrar funcionalidades existentes.

---

## 🎯 Princípios de Segurança

### 1. **Defesa em Profundidade**
- Múltiplas camadas de validação
- Autenticação obrigatória na maioria dos recursos
- Validação de estrutura de dados

### 2. **Princípio do Menor Privilégio**
- Usuários só acessam seus próprios dados
- Leitura e escrita separadas por contexto
- Limites claros de acesso

### 3. **Validação Rigorosa**
- Estrutura de dados validada
- Tipos de dados verificados
- Valores obrigatórios obrigatórios

### 4. **Auditoria e Rastreabilidade**
- Logs de operações
- Timestamps em todas as ações
- Rastreamento de modificações

---

## 🏗️ Estrutura de Dados do Sistema

### Módulos Principais

#### 1. **Espécies (`species`)**
```json
{
  "species": {
    "$speciesId": {
      "name": "string (obrigatório)",
      "timestamp": "string",
      "active": "boolean"
    }
  }
}
```
- **Acesso**: Leitura pública (para cadastros), escrita autenticada
- **Validação**: Nome obrigatório, não vazio

#### 2. **Clientes/Fornecedores (`clients`)**
```json
{
  "clients": {
    "$clientId": {
      "name": "string (obrigatório)",
      "document": "string",
      "address": "object",
      "timestamp": "string"
    }
  }
}
```
- **Acesso**: Autenticado para leitura e escrita
- **Validação**: Nome obrigatório
- **Índices**: name, document, timestamp

#### 3. **Romaneios (`romaneios`)**
```json
{
  "romaneios": {
    "pct": { "$romaneioId": {...} },
    "tora": { "$romaneioId": {...} },
    "tl": { "$romaneioId": {...} }
  }
}
```
- **Acesso**: Autenticado
- **Validação**: Número obrigatório por tipo
- **Índices**: numero, data, cliente, status, timestamp

#### 4. **Folha de Pagamento (`folha`)**
```json
{
  "folha": {
    "funcionarios": {
      "$funcionarioId": {
        "nome": "string (obrigatório)",
        "cpf": "string",
        "salarioBase": "number",
        "cargo": "string",
        "ativo": "boolean"
      }
    },
    "cargos": {
      "$cargoId": {
        "nome": "string (obrigatório)",
        "salarioBase": "number"
      }
    },
    "lancamentos": {
      "$lancamentoId": {
        "funcionario": "object (obrigatório)",
        "mesAno": "string (obrigatório)",
        "tipo": "string (obrigatório)"
      }
    }
  }
}
```
- **Acesso**: Autenticado para tudo
- **Validação**: Campos obrigatórios por tipo de registro

#### 5. **Banco de Horas (`folha/bancoHoras`)**
```json
{
  "bancoHoras": {
    "config": { "jornadaSemanal": "number", ... },
    "lancamentos": {
      "$funcionarioId": {
        "$lancamentoId": {
          "data": "string (obrigatório)",
          "minutos": "number (obrigatório)",
          "venceEm": "string",
          "observacao": "string"
        }
      }
    },
    "saldos": {
      "$funcionarioId": {
        "saldoMinutos": "number (obrigatório)",
        "atualizadoEm": "string"
      }
    },
    "assinaturas": {
      "$funcionarioId": {
        "timestamp": "string (obrigatório)",
        "signature": "string"
      }
    }
  }
}
```
- **Acesso**: Autenticado
- **Validação**: Estrutura específica por tipo

---

## 🚀 Como Aplicar as Regras

### Passo 1: Backup das Regras Atuais
```bash
# Acesse o Firebase Console
# Vá para: Realtime Database > Rules
# Copie as regras atuais para um arquivo .backup
```

### Passo 2: Identificar Ambiente

#### Desenvolvimento
- Use `firebase-rules-development.json`
- Permissões mais abertas para testes
- Validações básicas

#### Produção
- Use `firebase-rules-production.json`
- Autenticação obrigatória
- Validações rigorosas

### Passo 3: Aplicar Regras

#### Via Console Firebase
1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione projeto `sisweb-7ce82`
3. Vá para **Realtime Database** > **Rules**
4. Cole o conteúdo do arquivo de regras
5. Clique em **Publicar**

#### Via CLI Firebase
```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Fazer login
firebase login

# Deploy das regras
firebase deploy --only database:rules

# Ou para um projeto específico
firebase deploy --only database:rules --project sisweb-7ce82
```

### Passo 4: Verificar Regras
```bash
# Usar Firebase Emulator Suite para testar
firebase emulators:start --only database

# Ou usar a ferramenta de teste no console
```

---

## 🔍 Estrutura de Validações Implementadas

### Validações Gerais
- ✅ Dados só podem ser strings, numbers, booleans ou objetos
- ✅ Objetos não podem ser nulos
- ✅ Campos obrigatórios devem existir

### Validações por Módulo

#### Funcionários
- Nome obrigatório (string não vazia)
- CPF formatado corretamente
- Salário base numérico positivo

#### Romaneios
- Número obrigatório (string)
- Data no formato correto
- Cliente existe no banco

#### Banco de Horas
- Minutos como número
- Data no formato ISO
- Saldo calculado corretamente

---

## 🔐 Níveis de Acesso

### Nível 1: Público (Leitura)
- Espécies (`species`) - para listar cadastros
- Configurações básicas do sistema

### Nível 2: Autenticado (Leitura/Escrita Geral)
- Clientes/Fornecedores
- Romaneios
- Funcionários
- Cargos
- Lançamentos de Folha

### Nível 3: Próprio Usuário (Escrita Restrita)
- Dados de usuário (`users/$uid`)
- Preferências pessoais (`preferences/$uid`)
- Sessões (`auth/sessions/$uid`)

### Nível 4: Sistema (Acesso Interno)
- Configurações do sistema (`system/config`)
- Migrações (`system/migrations`)
- Logs (`logs`)

---

## 🛡️ Proteções Específicas

### 1. Isolamento de Dados por Usuário
```javascript
// Dados pessoais só acessíveis pelo próprio usuário
"users": {
  "$uid": {
    ".read": "auth != null && auth.uid == $uid",
    ".write": "auth != null && auth.uid == $uid"
  }
}
```

### 2. Prevenção de Escrita Maliciosa
```javascript
// Validar estrutura obrigatória
".validate": "newData.hasChild('nome') && 
              newData.child('nome').isString() && 
              newData.child('nome').val().length > 0"
```

### 3. Proteção Contra Injection
```javascript
// Validar tipos de dados
".validate": "newData.hasChild('minutos') && 
              newData.child('minutos').isNumber()"
```

### 4. Limite de Tamanho de Dados
```javascript
// Implementar limite via validação
".validate": "newData.child('observacao').isString() && 
              newData.child('observacao').val().length < 1000"
```

---

## 📊 Índices Recomendados

### Para Performance
```javascript
".indexOn": [
  "name",           // Busca por nome
  "document",       // Busca por documento
  "status",         // Filtro por status
  "timestamp",      // Ordenação por data
  "funcionario.id"  // Relacionamento
]
```

---

## 🧪 Testes de Segurança

### 1. Teste de Autenticação
```javascript
// Deve negar acesso sem auth
const unauthenticatedRef = ref(db, 'clients');
get(unauthenticatedRef).then(() => {
  console.error('❌ Acesso não autorizado permitido!');
}).catch(() => {
  console.log('✅ Acesso negado corretamente');
});
```

### 2. Teste de Validação
```javascript
// Deve rejeitar dados inválidos
const invalidRef = ref(db, 'folha/funcionarios/test');
set(invalidRef, { cpf: 123 }).then(() => {
  console.error('❌ Validação falhou!');
}).catch(() => {
  console.log('✅ Validação funcionou');
});
```

### 3. Teste de Isolamento
```javascript
// Deve negar acesso a dados de outro usuário
const otherUserRef = ref(db, 'users/other-uid');
get(otherUserRef).then(() => {
  console.error('❌ Isolamento falhou!');
}).catch(() => {
  console.log('✅ Isolamento funcionou');
});
```

---

## 🔄 Migração Gradual

### Fase 1: Implementação Parcial
1. Aplicar regras em módulos de baixo risco
2. Testar com dados reais
3. Monitorar logs de erro

### Fase 2: Expansão
1. Adicionar validações mais rigorosas
2. Implementar isolamento por usuário
3. Adicionar índices

### Fase 3: Finalização
1. Desabilitar regras de desenvolvimento
2. Aplicar regras de produção
3. Monitoramento contínuo

---

## 📝 Checklist de Segurança

### Antes de Deploy
- [ ] Backup das regras atuais
- [ ] Teste em ambiente de desenvolvimento
- [ ] Validação de estrutura de dados
- [ ] Verificação de índices
- [ ] Teste de autenticação
- [ ] Teste de isolamento de dados
- [ ] Documentação atualizada

### Após Deploy
- [ ] Monitoramento de logs
- [ ] Verificação de performance
- [ ] Teste de usuários reais
- [ ] Correção de problemas
- [ ] Comunicado de mudanças

---

## 🚨 Resolução de Problemas

### Erro: "Permission Denied"
**Causa**: Regras muito restritivas  
**Solução**: Verificar se usuário está autenticado e tem permissão

### Erro: "Validation Failed"
**Causa**: Dados não atendem validações  
**Solução**: Verificar estrutura de dados enviados

### Erro: "Index Required"
**Causa**: Query necessita índice inexistente  
**Solução**: Adicionar índice nas regras

---

## 📚 Referências

- [Firebase Security Rules](https://firebase.google.com/docs/database/security)
- [Firebase Validation Rules](https://firebase.google.com/docs/database/security/rules-conditions)
- [Firebase Indexing](https://firebase.google.com/docs/database/security/indexing-data)

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Verificar logs no Firebase Console
2. Consultar documentação oficial
3. Testar em ambiente de desenvolvimento
4. Contatar equipe de desenvolvimento

---

**Última Atualização**: Janeiro 2025  
**Versão**: 1.0  
**Status**: ✅ Pronto para Produção

