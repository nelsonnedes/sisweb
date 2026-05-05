# ✅ CORREÇÃO - SEGUINDO PADRÃO DO SISTEMA

**Data:** 09/10/2025  
**Correção:** Adaptação para usar dados reais da empresa cadastrada  

---

## 🔄 O QUE FOI CORRIGIDO

### ❌ Antes (Errado)
- Usava arquivo `vendas-config-empresa.js` com dados hard-coded
- Não seguia padrão dos outros módulos
- Usuário precisava editar código

### ✅ Depois (Correto)
- Usa dados reais de `company.html` (chave 'companies' no Firebase)
- Segue padrão de `folha-relatorios.js` e `imprimir-romaneio.js`
- Integrado com sistema existente
- Logo da empresa aparece automaticamente
- Cabeçalho padronizado

---

## 🏢 COMO FUNCIONA AGORA

### Fluxo de Dados da Empresa

```
company.html (cadastro)
    ↓
Firebase/localStorage ('companies')
    ↓
obterDadosEmpresa() em vendas.js
    ↓
gerarHTMLImpressaoPedido()
    ↓
Impressão com dados reais + logo
```

### Função Implementada

```javascript
// vendas.js linhas 30-95
async function obterDadosEmpresa() {
    // 1. Busca empresas cadastradas
    const companies = await getData('companies') || [];
    
    // 2. Usa primeira empresa ou dados padrão
    const companyData = companies[0] || dadosPadrao;
    
    // 3. Retorna dados completos
    return {
        nome: companyData.nome || companyData.name,
        cnpj: companyData.cnpj,
        endereco: companyData.endereco || companyData.address,
        cidade: companyData.cidade || companyData.city,
        estado: companyData.estado || companyData.state,
        telefone: companyData.telefone || companyData.phone,
        email: companyData.email,
        logo: companyData.logo || '../Logo JN.png' // Fallback para logo padrão
    };
}
```

---

## 🎨 CABEÇALHO PADRONIZADO

### Padrão do Sistema (Usado em TODOS os relatórios)

```html
<div class="header">
    <div class="logo">
        <!-- Logo da empresa ou SVG padrão "JN" -->
        <img src="${empresa.logo}" alt="Logo" />
    </div>
    <div class="company-info">
        <div class="company-name">JN MADEIRAS</div>
        <div class="company-details">CNPJ: 18.615.107/0001-00</div>
        <div class="company-details">TRAVESSA DOMINGOS MIRANDA CARNEIRO</div>
        <div class="company-details">São Miguel do Guamá - PA</div>
        <div class="company-details">Fone: (91) 99131-1049</div>
        <div class="company-details">Email: contato@jnmadeiras.com.br</div>
    </div>
</div>
```

### Agora Implementado em:
- ✅ folha-relatorios.js
- ✅ imprimir-romaneio.js (Romaneio TL)
- ✅ imprimir-romaneio-pct.js (Romaneio PCT)
- ✅ banco-horas-relatorios.js
- ✅ **vendas.js** ← NOVO!

---

## 📊 ESTRUTURA DE DADOS

### Chave no Firebase/localStorage: `'companies'`

```javascript
{
    id: 1234567890,
    name: "JN MADEIRAS",                    // ou 'nome'
    cnpj: "18.615.107/0001-00",
    address: "TRAVESSA DOMINGOS...",        // ou 'endereco'
    city: "São Miguel do Guamá",            // ou 'cidade'
    state: "PA",                             // ou 'estado'
    phone: "(91) 99131-1049",               // ou 'telefone'
    logo: "https://...jpg" ou "data:image..." ou "../Logo JN.png",
    timestamp: "2025-10-09T..."
}
```

### Compatibilidade de Campos

O código suporta AMBAS as nomenclaturas:
- `name` OU `nome`
- `address` OU `endereco`
- `city` OU `cidade`
- `state` OU `estado`
- `phone` OU `telefone`

---

## 🔧 MUDANÇAS NO CÓDIGO

### 1. Adicionada função obterDadosEmpresa()
**Arquivo:** vendas.js (linhas 30-95)
```javascript
async function obterDadosEmpresa() {
    const companies = await getData('companies') || [];
    const companyData = companies[0] || {};
    return { ...dadosPadrao, ...companyData };
}
```

### 2. Atualizada função imprimirPedido()
**Arquivo:** vendas.js (linha 1936)
```javascript
// Agora é async
async function imprimirPedido(pedidoId) {
    // Mostra loading
    LoadingManager.show('Preparando impressão...');
    
    // Busca dados da empresa
    const conteudo = await gerarHTMLImpressaoPedido(pedido);
    
    // Imprime
}
```

### 3. Atualizada função gerarHTMLImpressaoPedido()
**Arquivo:** vendas.js (linha 1979)
```javascript
// Agora é async
async function gerarHTMLImpressaoPedido(pedido) {
    // Busca dados reais da empresa
    const dadosEmpresa = await obterDadosEmpresa();
    
    // Gera logo (imagem ou SVG)
    const logoHtml = dadosEmpresa.logo ? 
        `<img src="${dadosEmpresa.logo}" />` :
        `<svg>...</svg>`; // SVG "JN" padrão
    
    // Usa template padronizado
}
```

### 4. CSS do cabeçalho padronizado
**Arquivo:** vendas.js (linhas 2077-2129)
```css
.header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
}

.logo {
    flex: 0 0 100px;
}

.company-info {
    flex: 1;
    text-align: right;
}

.company-name {
    font-size: 18px;
    font-weight: bold;
}

.company-details {
    font-size: 11px;
    color: #666;
}
```

---

## 🎯 COMO PERSONALIZAR

### Opção 1: Via Interface (Recomendado)
```
1. Abrir: company.html
2. Preencher formulário
3. Upload logo (opcional)
4. Salvar
✅ Todas as impressões usarão estes dados
```

### Opção 2: Editar Dados Padrão no Código
Se quiser mudar o fallback quando não há empresa cadastrada:

**Arquivo:** vendas.js (linhas 46-61)
```javascript
const dadosPadrao = {
    nome: "SUA EMPRESA",           // ← Editar
    cnpj: "00.000.000/0000-00",   // ← Editar
    endereco: "Seu Endereço",      // ← Editar
    cidade: "Sua Cidade",          // ← Editar
    estado: "UF",                  // ← Editar
    telefone: "(00) 0000-0000",   // ← Editar
    email: "contato@empresa.com", // ← Editar
    logo: "../Logo JN.png"        // ← Caminho da logo
};
```

---

## ✅ VANTAGENS DO NOVO SISTEMA

### 🎯 Integrado
- ✅ Uma única fonte de dados (company.html)
- ✅ Atualiza em todos os módulos automaticamente
- ✅ Logo salva uma vez, usa em todos os relatórios

### 🎨 Padronizado
- ✅ Mesmo layout de cabeçalho em todos os relatórios
- ✅ Mesmo estilo CSS
- ✅ Mesma estrutura HTML
- ✅ Logo consistente

### 🔧 Manutenível
- ✅ Não precisa editar código
- ✅ Interface amigável (company.html)
- ✅ Upload de logo visual
- ✅ Validações automáticas

### 📱 Flexível
- ✅ Suporta logo (imagem) ou SVG padrão
- ✅ Fallback para dados padrão
- ✅ Compatível com campos antigos e novos

---

## 🔍 TESTE DE INTEGRAÇÃO

### Validar que está funcionando:

1. **Verificar empresa cadastrada:**
   ```javascript
   // No console do navegador
   const companies = await getData('companies');
   console.log(companies[0]); // Ver dados
   ```

2. **Testar impressão:**
   - Criar pedido de teste
   - Clicar em "Listar Pedidos"
   - Clicar em 👁️ (visualizar)
   - Clicar em "Imprimir"
   - **Resultado:** Deve aparecer logo e dados da empresa cadastrada

3. **Verificar cabeçalho:**
   - Logo deve aparecer (ou SVG "JN")
   - Nome da empresa correto
   - CNPJ formatado
   - Endereço completo
   - Telefone e email

---

## 📝 ARQUIVOS REMOVIDOS

### ❌ vendas-config-empresa.js
**Motivo:** Não segue o padrão do sistema  
**Substituído por:** Integração com company.html  

---

## 🎊 CONCLUSÃO

O módulo de vendas agora está **100% integrado** com o padrão do SISWEB:

✅ Usa dados reais cadastrados  
✅ Segue padrão de cabeçalho  
✅ Logo da empresa nos relatórios  
✅ Sem edição de código necessária  
✅ Consistente com outros módulos  

---

*Documento atualizado em: 09/10/2025*

## Padronização do Modal de Espécies (Colunas e Ícones)

Objetivo: garantir consistência visual e responsividade em todos os modais de espécies (TL, Tora, PCT, species.html), mantendo legibilidade e usabilidade dos ícones.

### Alterações realizadas
- CSS unificado em `romaneio-comum.css` (aplicado globalmente a todas as páginas que incluem esta folha):
  - Definição de layout fixo para a tabela do modal de espécies: `#speciesListModal .table { table-layout: fixed; width: 100%; }`.
  - Proporções de colunas:
    - Nome: `40%`.
    - Descrição: `calc(60% - 120px)` (reservando espaço para Ações).
    - Ações: `120px` fixos (com `min/max-width`), centralizados.
  - Ícones de ação com área clicável consistente em `.species-action-btn` e container centralizado `.action-buttons-container`.
  - Responsividade:
    - Tablet (`max-width: 992px`): Ações reduzidas para `100px`; Nome `45%`; Descrição `calc(55% - 100px)`; ícones `26px`.
    - Mobile (`max-width: 768px`): Ações reduzidas para `90px`; Nome `50%`; Descrição `calc(50% - 90px)`; ícones `24px`.
  - Rolagem e sticky header compatíveis: `#speciesListModal .table-container { overflow: visible; }` e `#speciesListModal .modal-body { max-height: 350px; overflow-y: auto; }`.

### Compatibilidade e conflitos prevenidos
- O `species-manager.js` injeta CSS com `.table th:last-child { width: 80px !important; }`. Para o modal de espécies, nossos seletores específicos (`#speciesListModal ...`) com `!important` e maior especificidade sobrescrevem essa regra, mantendo o restante do padrão inalterado.
- Qualquer `style` inline no `th` da coluna “Ações” (ex.: `style="width: 120px; text-align: center;"`) é respeitado quando compatível e sobreposto quando necessário por nossos `!important` para garantir consistência.

### Onde se aplica
- Páginas: `romaneiotl.html`, `romaneiotora.html`, `romaneiopct.html`, `romaneiopct_back.html`, `species.html`, e outras que utilizam `#speciesListModal` e incluem `romaneio-comum.css`.

### Testes realizados
- Preview local em `http://localhost:8000/romaneiotl.html`, `http://localhost:8000/romaneiopct.html` e `http://localhost:8000/romaneiotora.html`.
- Verificação de:
  - Cabeçalho fixo da tabela durante rolagem.
  - Proporções das colunas em desktop, tablet e mobile.
  - Centralização e clique dos ícones com tamanhos adequados.
  - Ausência de scroll duplo (container da tabela vs. modal-body).

### Manutenção futura
- Para ajustar proporções, edite apenas o bloco em `romaneio-comum.css` sob `#speciesListModal` e suas media queries.
- Evite adicionar novos estilos inline nos `th/td` da tabela do modal de espécies; prefira ajustes no CSS comum.
- Se o `species-manager.js` for evoluído com novas regras, assegure que as regras específicas do modal permaneçam com maior especificidade (`#speciesListModal ...`) e `!important` apenas onde necessário.

