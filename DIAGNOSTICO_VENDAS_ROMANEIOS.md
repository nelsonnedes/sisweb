# 🔍 DIAGNÓSTICO: Campos não Carregam em Produto Romaneio (vendas.html)

**Problema:** Ao selecionar "Produto Romaneio" e carregar romaneio, apenas mostra até "Preview - Resumo CONAMA", campos abaixo não aparecem.

**Data:** 2025-01-30

---

## 🔍 ESTRUTURA DO HTML

### Hierarquia completa:
```
#pedidoForm (display: none inicialmente)
  ├─ Dados do Pedido (Data, Número, Status, Cliente)
  ├─ h3: "Itens do Pedido"
  ├─ Seleção Tipo de Produto (Manual / Romaneio / Cadastrado)
  ├─ secaoProdutoManual
  ├─ secaoProdutoRomaneio (display: none)
  │   ├─ Tipo de Romaneio (select)
  │   ├─ Romaneio (select)  
  │   ├─ Botão "Carregar Items"
  │   └─ previewConama (display: none)
  ├─ secaoProdutoCadastrado (display: none)
  ├─ h3: "Carrinho de Itens"  ✅ ADICIONADO
  ├─ table-container (itensTable)  ✅ DEVERIA APARECER
  ├─ summary-box (Subtotal, Desconto, Total)  ✅ DEVERIA APARECER
  └─ contas-receber-section  ✅ DEVERIA APARECER
```

---

## ✅ CORREÇÕES APLICADAS

### 1. Adicionado título "Carrinho de Itens"
**Arquivo:** `vendas.html` (linha 761)  
**Motivo:** Identificar visualmente a tabela de itens

### 2. Adicionado scroll automático
**Arquivo:** `vendas.js` (linhas 1522-1528)  
**Motivo:** Rolar automaticamente até a tabela após mostrar preview

```javascript
// ✅ Rolar até a tabela de itens após mostrar o preview
setTimeout(() => {
    const itensTable = document.getElementById('itensTable');
    if (itensTable) {
        itensTable.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}, 300);
```

---

## 🔍 POSSÍVEIS CAUSAS

### 1. **Problema de CSS/Layout** ❓
- Container pode estar limitado em altura
- Overflow pode estar escondendo elementos
- Problema com `max-height` ou `overflow-y`

### 2. **Problema de Renderização** ❓
- Elementos podem estar sendo renderizados fora da viewport
- Problema com `position: absolute` ou `fixed`

### 3. **Problema de JavaScript** ❓
- Alguma função pode estar ocultando elementos
- Event listener pode estar causando conflito

---

## 📋 PRÓXIMOS PASSOS

### PARA TESTAR:
1. Abrir `vendas.html`
2. Clicar em "Novo Pedido"
3. Selecionar "Produto Romaneio"
4. Escolher "Tipo de Romaneio"
5. Selecionar um romaneio
6. ✅ Verificar se aparecem:
   - Preview CONAMA
   - Título "Carrinho de Itens"
   - Tabela de Produtos
   - Totais
   - Forma de Pagamento

### SE NÃO FUNCIONAR:
1. Abrir console do navegador (F12)
2. Verificar erros JavaScript
3. Inspecionar elementos HTML
4. Verificar se elementos existem no DOM
5. Verificar se há `display: none` ou `visibility: hidden`

---

## 🎯 TESTE MANUAL NECESSÁRIO

**IMPORTANTE:** Este problema requer teste visual no navegador.  
O código parece correto, mas pode haver problema de renderização ou CSS.

