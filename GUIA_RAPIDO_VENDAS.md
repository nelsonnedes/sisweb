# 🚀 GUIA RÁPIDO - MÓDULO DE VENDAS

**Versão:** 2.0  
**Data:** 09/10/2025  
**Status:** ✅ Pronto para uso  

---

## ⚡ INÍCIO RÁPIDO (5 minutos)

### 1. Cadastrar Empresa no Sistema (Se ainda não cadastrou)

✅ **O sistema JÁ USA os dados cadastrados em `company.html`!**

Para cadastrar ou editar dados da empresa:

1. No menu principal, clique no ícone ⚙️ (engrenagem)
2. Selecione "Cadastro de Empresa" ou acesse `company.html`
3. Preencha:
   - Nome da Empresa
   - CNPJ
   - Endereço completo
   - Estado e Cidade
   - Telefone
   - **Logo da empresa** (opcional - aparecerá nos relatórios)
4. Clique em "Salvar Empresa"

✅ **Pronto!** Todos os relatórios e impressões usarão estes dados automaticamente.

### 2. Ajustar Configurações do Módulo (Opcional)

No código `vendas.js` (linhas 21-26), você pode ajustar:

```javascript
const VendasConfig = {
    precoPorM3Padrao: 1500,           // Preço padrão por m³ para romaneios
    diasVencimentoPadrao: 30,         // Dias para vencimento de contas
    validarEstoque: true,              // Validar estoque ao vender
    permitirEstoqueNegativo: false    // Permitir estoque negativo
};
```

### 3. Pronto! Abra vendas.html

✅ **Sistema integrado** - Dados da empresa vêm automaticamente de `company.html`  
✅ **Logo nos relatórios** - Se cadastrou logo, aparece nas impressões  
✅ **Padrão do sistema** - Mesmo layout de cabeçalho dos outros módulos

---

## 📋 FUNCIONALIDADES DISPONÍVEIS

### ✨ O que você pode fazer agora:

#### 1. Criar Pedidos
- 📝 Pedido manual
- 📦 Produtos cadastrados
- 🌳 Produtos de romaneios (TL, PCT, PES, TORA)
- 💰 Múltiplas formas de pagamento
- 📅 Parcelamento automático

#### 2. Gerenciar Pedidos
- 📋 Listar todos os pedidos
- 🔍 Buscar por número, cliente ou status
- ✏️ Editar pedidos existentes
- 🗑️ Excluir pedidos (com reversão de estoque)
- 👁️ **NOVO:** Visualizar detalhes completos
- 🖨️ **NOVO:** Imprimir pedidos

#### 3. Gerenciar Produtos
- ➕ Cadastrar produtos
- ✏️ Editar produtos
- 📊 Controlar estoque
- 🔍 Buscar produtos

#### 4. Integrações
- 🤝 Integração automática com sistema de clientes
- 💳 Geração automática de contas a receber no módulo financeiro
- 🌳 Importação de itens de romaneios com resumo CONAMA

---

## 🎯 FLUXO DE TRABALHO

### Criar um Pedido Completo (passo a passo)

1. **Abrir Sistema**
   - Acesse `vendas.html`

2. **Novo Pedido**
   - Clique em "Novo Pedido"
   - Data e número são preenchidos automaticamente

3. **Selecionar Cliente**
   - Escolha no dropdown ou clique em ➕ para cadastrar novo

4. **Adicionar Itens**
   - Escolha o tipo: Manual, Romaneio ou Cadastrado
   - Preencha quantidade e preço
   - Clique em "Adicionar"
   - Repita para todos os itens

5. **Configurar Pagamento**
   - Preencha valor e vencimento
   - Escolha o tipo de pagamento
   - Defina número de parcelas
   - Clique em "Adicionar"

6. **Revisar e Salvar**
   - Confira os totais
   - Clique em "Salvar Pedido"
   - ✅ Toast de confirmação aparece

7. **Visualizar/Imprimir**
   - Clique em "Listar Pedidos"
   - Use 👁️ para visualizar ou 🖨️ para imprimir direto

---

## 🔔 SISTEMA DE NOTIFICAÇÕES (TOASTS)

### Tipos de Toast Disponíveis

#### ✅ Sucesso (Verde)
```javascript
ToastManager.success('Pedido salvo com sucesso!');
```

#### ❌ Erro (Vermelho)
```javascript
ToastManager.error('Erro ao salvar pedido', 'Erro');
```

#### ⚠️ Atenção (Amarelo)
```javascript
ToastManager.warning('Selecione um cliente', 'Atenção');
```

#### ℹ️ Informação (Azul)
```javascript
ToastManager.info('Dados carregados', 'Informação');
```

### Duração Personalizada
```javascript
// Toast que não fecha automaticamente
ToastManager.error('Erro grave', 'Atenção', 0);

// Toast que fecha em 10 segundos
ToastManager.warning('Aviso importante', 'Cuidado', 10000);
```

---

## 📦 VALIDAÇÃO DE ESTOQUE

### Como Funciona

O sistema **valida automaticamente** o estoque ao adicionar produtos:

```
Estoque disponível: 10 unidades
No carrinho: 3 unidades
Tentando adicionar: 8 unidades
────────────────────────────────
Total necessário: 11 unidades
Resultado: ❌ BLOQUEADO
```

### Configurar Validação

No arquivo `vendas-config-empresa.js`:

```javascript
// Desativar validação de estoque
validarEstoque: false,

// Permitir estoque negativo
permitirEstoqueNegativo: true,
```

### Produtos sem Controle de Estoque

- ✅ Produtos **manuais** (não têm estoque)
- ✅ Produtos de **romaneio** (não têm estoque)
- ⚠️ Produtos **cadastrados** (validação ativa)

---

## 🖨️ IMPRESSÃO DE PEDIDOS

### Formato de Impressão

- ✅ Tamanho A4 (21cm)
- ✅ Cabeçalho com dados da empresa
- ✅ Dados completos do pedido e cliente
- ✅ Tabela de itens formatada
- ✅ Totais destacados
- ✅ Forma de pagamento detalhada
- ✅ Linha para assinatura
- ✅ Rodapé com data/hora de emissão

### Como Imprimir

**Opção 1: Via Modal de Visualização**
1. Listar pedidos
2. Clicar em 👁️ (visualizar)
3. Clicar em "Imprimir"

**Opção 2: Chamada Direta**
```javascript
imprimirPedido('PED000001');
```

### Personalizar Impressão

✅ **Automático!** O sistema usa os dados cadastrados em `company.html`:
- Nome da empresa
- Endereço completo
- Telefone
- Email
- CNPJ
- **Logo da empresa** (se cadastrada)

**Como editar:**
1. Menu → ⚙️ → Cadastro de Empresa
2. Editar dados
3. **Pronto!** Todas as impressões usarão os novos dados

---

## 💡 DICAS E TRUQUES

### 1. Atalhos de Teclado
```
Tab → Navegar entre campos
Enter → Adicionar item/conta (quando em foco)
Esc → Fechar modais (não implementado ainda)
```

### 2. Carrinho Inteligente
- Adicionar produto já no carrinho → **Soma quantidades**
- Editar item → **Remove e permite re-adicionar**
- Remover item → **Pede confirmação**

### 3. Parcelas Automáticas
- Selecione "3 parcelas"
- Sistema divide valor automaticamente
- Datas de vencimento espaçadas em 30 dias

### 4. Importar de Romaneios
- Selecione tipo de romaneio (TL, PCT, PES, TORA)
- Escolha romaneio específico
- Veja preview do resumo CONAMA
- Clique em "Carregar Items"
- **Itens adicionados automaticamente** com preço padrão

### 5. Redistribuição Automática
- Adicione parcelas de pagamento
- Altere desconto ou itens
- **Valores se ajustam automaticamente**

---

## 🐛 SOLUÇÃO DE PROBLEMAS

### Toast não aparece
- ✅ Verificar se `toastContainer` está no HTML
- ✅ Verificar console do navegador por erros
- ✅ Garantir que CSS foi carregado

### Validação de estoque muito restritiva
```javascript
// Em vendas-config-empresa.js
validarEstoque: false  // ← Desativa validação
```

### Impressão não abre
- ✅ Verificar se navegador está bloqueando pop-ups
- ✅ Permitir pop-ups para o site
- ✅ Tentar em modo de navegação anônima

### Cliente não aparece no select
- ✅ Verificar se há clientes cadastrados
- ✅ Ir em "Clientes" → "Gerenciar Clientes"
- ✅ Cadastrar pelo menos um cliente
- ✅ Recarregar página de vendas

### Pedido não salva
- ✅ Verificar console por erros
- ✅ Garantir que há pelo menos 1 item
- ✅ Garantir que cliente está selecionado
- ✅ Verificar conexão com Firebase

---

## 📊 INDICADORES VISUAIS

### Badges de Status
- 🟡 **Pendente** - Amarelo
- 🟢 **Aprovado** - Verde
- 🔵 **Entregue** - Azul
- 🔴 **Cancelado** - Vermelho

### Badges de Tipo de Produto
- ⚫ **MANUAL** - Cinza
- 🔵 **ROMANEIO** - Azul claro
- *(sem badge)* **CADASTRADO** - Padrão

### Cores de Toast
- 🟢 **Success** - Verde (#28a745)
- 🔴 **Error** - Vermelho (#dc3545)
- 🟡 **Warning** - Amarelo (#ffc107)
- 🔵 **Info** - Azul (#17a2b8)

---

## 🔗 INTEGRAÇÕES

### Com Módulo de Clientes
```
vendas.html → client.html
- Botão ➕ ao lado do select de clientes
- Abre em nova aba
- Após cadastrar, recarregar vendas.html
```

### Com Módulo Financeiro
```
Pedido Salvo
    ↓
Gera Conta a Receber
    ↓
Visível em financas.html
    ↓
Origem: 'pedido_venda'
    ↓
Vinculado via origemId
```

### Com Romaneios
```
romaneioTL/PCT/PES/TORA
    ↓
Seleção de romaneio
    ↓
Extração resumo CONAMA
    ↓
Preview visual
    ↓
Conversão para itens de venda
    ↓
Adicionado ao carrinho
```

---

## 🎓 TUTORIAIS RÁPIDOS

### Como vender produto de romaneio?

1. Novo Pedido
2. Selecionar cliente
3. Escolher "Produto Romaneio"
4. Selecionar tipo (ex: Romaneio TL)
5. Escolher romaneio específico
6. Ver preview
7. Clicar "Carregar Items"
8. Editar preços se necessário
9. Adicionar forma de pagamento
10. Salvar

### Como criar venda parcelada?

1. Novo Pedido
2. Adicionar itens normalmente
3. Na seção "Forma de Pagamento":
   - Valor: (valor total ou parcial)
   - Vencimento: (primeira data)
   - Tipo: "Parcela"
   - Nº Parcelas: 3 (por exemplo)
4. Clicar "Adicionar"
5. Sistema cria 3 parcelas automaticamente
6. Salvar pedido

### Como editar parcelas individualmente?

1. Após adicionar parcelas, veja tabela
2. Clique em qualquer campo (valor, data, tipo)
3. Edite diretamente na tabela
4. Valor se atualiza automaticamente

---

## 📞 REFERÊNCIAS RÁPIDAS

### Documentos Criados
1. `ANALISE_PLANO_MODULO_VENDAS.md` - Análise completa
2. `IMPLEMENTACOES_PRATICAS_VENDAS.md` - Código adicional
3. `RESUMO_EXECUTIVO_VENDAS.md` - Visão geral
4. `IMPLEMENTACOES_REALIZADAS_VENDAS.md` - O que foi feito
5. `GUIA_RAPIDO_VENDAS.md` - Este documento
6. `vendas-config-empresa.js` - Configurações personalizáveis

### Arquivos do Módulo
- `vendas.html` - Interface principal (~1.050 linhas)
- `vendas.js` - Lógica do sistema (~2.370 linhas)
- `vendas-config-empresa.js` - Configurações (~180 linhas)

---

## 🎯 CHECKLIST DE VERIFICAÇÃO

### Antes de Usar em Produção
- [ ] Personalizei dados da empresa
- [ ] Ajustei configurações operacionais
- [ ] Cadastrei pelo menos 1 cliente
- [ ] Cadastrei pelo menos 1 produto
- [ ] Testei criar pedido
- [ ] Testei visualizar pedido
- [ ] Testei imprimir pedido
- [ ] Verifiquei integração com finanças
- [ ] Testei em diferentes navegadores
- [ ] Testei em mobile

---

## 📱 COMPATIBILIDADE

### Navegadores Testados
- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari (limitado)

### Dispositivos
- ✅ Desktop (ideal)
- ✅ Tablet (funcional)
- ⚠️ Mobile (responsivo básico)

---

## ⚙️ CONFIGURAÇÕES AVANÇADAS

### Preços Diferenciados por Espécie

```javascript
// Em vendas.js, função adicionarItensRomaneio()
// Você pode criar lógica customizada:

const precos = {
    'Angelim': 1800,
    'Cumaru': 2000,
    'Ipê': 2500,
    'default': 1500
};

const precoPorM3 = precos[especie] || precos.default;
```

### Desconto Automático por Volume

```javascript
// Em vendas.js, função atualizarTotais()
// Adicionar após calcular subtotal:

let descontoAutomatico = 0;

if (subtotal > 10000) {
    descontoAutomatico = subtotal * 0.10; // 10% acima de R$ 10.000
} else if (subtotal > 5000) {
    descontoAutomatico = subtotal * 0.05; // 5% acima de R$ 5.000
}

document.getElementById('desconto').value = formatCurrency(descontoAutomatico);
```

---

## 🆘 SUPORTE

### Problemas Comuns

**P: O botão "Visualizar" não funciona**  
R: Verifique se o arquivo foi atualizado corretamente. A função `visualizarPedido()` deve estar presente no `vendas.js`.

**P: Toasts não aparecem**  
R: Verifique se o CSS foi adicionado e se existe `<div id="toastContainer"></div>` no HTML.

**P: Validação de estoque muito rígida**  
R: Ajuste em `vendas-config-empresa.js`: `validarEstoque: false`

**P: Quero mudar dados da empresa na impressão**  
R: Edite `vendas-config-empresa.js`, objeto `DadosEmpresa`.

**P: Como exportar para Excel?**  
R: Funcionalidade opcional. Código disponível em `IMPLEMENTACOES_PRATICAS_VENDAS.md` seção 6.

---

## 🚀 PRÓXIMAS FUNCIONALIDADES

### Já Documentadas (Código Pronto)
1. **Exportação Excel** - 2h para implementar
2. **Dashboard com Gráficos** - 4h para implementar

Veja códigos prontos em: `IMPLEMENTACOES_PRATICAS_VENDAS.md`

### Planejadas para Futuro
1. Sistema de comissões de vendedores
2. Integração com notas fiscais
3. Histórico de alterações
4. Pedidos recorrentes
5. Sistema de categorias

Veja roadmap completo em: `ANALISE_PLANO_MODULO_VENDAS.md`

---

## 📈 MÉTRICAS DE SUCESSO

### Como saber se está funcionando?

✅ **Nível Básico**
- Consigo criar pedidos
- Consigo listar pedidos
- Consigo visualizar detalhes
- Consigo imprimir

✅ **Nível Intermediário**
- Validação de estoque funciona
- Toasts aparecem corretamente
- Integração com finanças ativa
- Dados salvos no Firebase

✅ **Nível Avançado**
- Múltiplos tipos de produtos funcionam
- Parcelamento automático funciona
- Redistribuição de valores automática
- Importação de romaneios funcional

---

## 🎊 CONCLUSÃO

O módulo de vendas está **completo e funcional** para uso em produção!

### Tempo para estar operacional: ~15 minutos
1. Personalizar dados (5 min)
2. Cadastrar cliente de teste (5 min)
3. Cadastrar produto de teste (3 min)
4. Criar pedido de teste (2 min)

### Suporte Adicional
- 📖 Documentação completa nos arquivos `.md`
- 💻 Código comentado em português
- 🔍 Console do navegador para debug
- 📝 Logs detalhados em cada operação

---

**BOA VENDAS! 🎉**

*Documento criado em: 09/10/2025*  
*Versão: 1.0*

