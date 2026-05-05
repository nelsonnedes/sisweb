# 🏢 INTEGRAÇÃO COM COMPANY.HTML - MÓDULO DE VENDAS

**Data:** 09/10/2025  
**Status:** ✅ Integrado com Padrão do Sistema  

---

## 🎯 RESUMO

O módulo de vendas foi **corrigido** para seguir o padrão estabelecido no SISWEB:

✅ Usa dados reais cadastrados em `company.html`  
✅ Segue padrão de cabeçalho dos outros relatórios  
✅ Logo da empresa aparece automaticamente  
✅ Sem necessidade de editar código  

---

## 🔄 CORREÇÃO APLICADA

### ❌ Problema Identificado
- Havia arquivo `vendas-config-empresa.js` com dados hard-coded
- Não seguia padrão do sistema
- Duplicava informações já cadastradas

### ✅ Solução Implementada
- Removido `vendas-config-empresa.js`
- Criada função `obterDadosEmpresa()` (padrão do sistema)
- Integrado com Firebase/localStorage chave 'companies'
- Cabeçalho de impressão padronizado

---

## 🏗️ ARQUITETURA DA INTEGRAÇÃO

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────┐
│                   CADASTRO DE EMPRESA                   │
│                                                         │
│  company.html                                           │
│       ↓                                                 │
│  Salva em Firebase/localStorage                         │
│       ↓                                                 │
│  Chave: 'companies'                                     │
│       ↓                                                 │
│  Array de empresas                                      │
│       ↓                                                 │
│  [{ id, name, cnpj, address, phone, logo, ... }]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│              MÓDULOS QUE USAM OS DADOS                  │
│                                                         │
│  ✅ folha-relatorios.js → obterDadosEmpresa()          │
│  ✅ imprimir-romaneio.js → obterDadosEmpresa()         │
│  ✅ imprimir-romaneio-pct.js → getCompanyData()        │
│  ✅ banco-horas-relatorios.js → getCompanyData()       │
│  ✅ vendas.js → obterDadosEmpresa() ← NOVO!            │
│                                                         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│               IMPRESSÕES E RELATÓRIOS                   │
│                                                         │
│  • Logo da empresa (se cadastrada)                      │
│  • Nome completo                                        │
│  • CNPJ formatado                                       │
│  • Endereço completo (rua, cidade, estado)             │
│  • Telefone                                             │
│  • Email (se cadastrado)                                │
│                                                         │
│  ✅ PADRÃO CONSISTENTE EM TODOS OS MÓDULOS             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 💻 IMPLEMENTAÇÃO TÉCNICA

### Função obterDadosEmpresa()

**Arquivo:** `vendas.js` (linhas 30-95)

```javascript
async function obterDadosEmpresa() {
    try {
        // 1. Carregar empresas do Firebase/localStorage
        const companies = await getData('companies') || [];
        
        // 2. Usar primeira empresa
        const companyData = companies[0] || {};
        
        // 3. Dados padrão (fallback)
        const dadosPadrao = {
            nome: "JN MADEIRAS",
            cnpj: "18.615.107/0001-00",
            endereco: "TRAVESSA DOMINGOS MIRANDA CARNEIRO",
            cidade: "São Miguel do Guamá",
            estado: "PA",
            telefone: "(91) 99131-1049",
            email: "contato@jnmadeiras.com.br",
            logo: "../Logo JN.png"
        };
        
        // 4. Mesclar dados
        return { ...dadosPadrao, ...companyData };
        
    } catch (error) {
        // Retornar dados padrão em caso de erro
        return dadosPadrao;
    }
}
```

### Padrão de Cabeçalho (Todos os Relatórios)

```html
<div class="header">
    <div class="logo">
        <!-- Logo da empresa OU SVG padrão "JN" -->
        <img src="${empresa.logo}" alt="Logo" />
    </div>
    <div class="company-info">
        <div class="company-name">${empresa.nome}</div>
        <div class="company-details">CNPJ: ${empresa.cnpj}</div>
        <div class="company-details">${empresa.endereco}</div>
        <div class="company-details">${empresa.cidade} - ${empresa.estado}</div>
        <div class="company-details">Fone: ${empresa.telefone}</div>
        <div class="company-details">Email: ${empresa.email}</div>
    </div>
</div>
```

### CSS do Cabeçalho (Padronizado)

```css
.header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 3px solid #2c3e50;
}

.logo {
    flex: 0 0 100px;
    text-align: center;
}

.company-info {
    flex: 1;
    text-align: right;
    padding-left: 20px;
}

.company-name {
    font-size: 18px;
    font-weight: bold;
    color: #2c3e50;
}

.company-details {
    font-size: 11px;
    color: #666;
    margin: 2px 0;
}
```

---

## 📊 COMPATIBILIDADE DE CAMPOS

### Suporta Ambas Nomenclaturas

O código aceita tanto nomenclatura **antiga** quanto **nova**:

| Campo Antigo | Campo Novo | Usado em |
|--------------|------------|----------|
| `name` | `nome` | Nome da empresa |
| `address` | `endereco` | Endereço |
| `city` | `cidade` | Cidade |
| `state` | `estado` | Estado (UF) |
| `phone` | `telefone` | Telefone |

```javascript
// No código, usa-se:
dadosEmpresa.nome || dadosEmpresa.name
dadosEmpresa.endereco || dadosEmpresa.address
dadosEmpresa.cidade || dadosEmpresa.city
// etc...
```

---

## 🎨 TRATAMENTO DE LOGO

### 3 Cenários Suportados

#### 1. Logo Cadastrada (URL Firebase)
```javascript
logo: "https://firebasestorage.googleapis.com/..."
```
**Resultado:** Exibe logo da empresa

#### 2. Logo Local
```javascript
logo: "../Logo JN.png"
```
**Resultado:** Exibe logo do arquivo local

#### 3. Sem Logo
```javascript
logo: "" ou null ou undefined
```
**Resultado:** Exibe SVG padrão com letras "JN"

```html
<svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="45" fill="#2c3e50"/>
    <text x="50" y="60" text-anchor="middle" fill="white">JN</text>
</svg>
```

---

## 🔧 COMO CADASTRAR/EDITAR EMPRESA

### Via Interface (Recomendado)

1. **Acessar cadastro:**
   - No menu principal → ícone ⚙️ (engrenagem)
   - Selecionar "Cadastro de Empresa"
   - OU abrir diretamente `company.html`

2. **Preencher dados:**
   - Nome da Empresa
   - CNPJ (formatação automática)
   - Endereço completo
   - Estado (dropdown)
   - Cidade (carrega do IBGE automaticamente)
   - Telefone (formatação automática)

3. **Adicionar Logo (Opcional):**
   - Clicar em "Selecionar Logo"
   - Escolher imagem (PNG, JPG, etc)
   - Máximo 5MB
   - Preview automático

4. **Salvar:**
   - Clicar em "Salvar Empresa"
   - ✅ Dados salvos no Firebase e localStorage
   - ✅ Logo enviada para Firebase Storage

### Via Código (Avançado)

```javascript
const empresa = {
    id: Date.now(),
    name: "Minha Empresa LTDA",
    cnpj: "00.000.000/0000-00",
    address: "Rua Exemplo, 123",
    city: "Cidade",
    state: "UF",
    phone: "(00) 0000-0000",
    logo: "../Logo JN.png", // ou URL do Firebase
    timestamp: new Date().toISOString()
};

await saveData('companies', [empresa]);
```

---

## ✅ VALIDAÇÃO DA INTEGRAÇÃO

### Teste 1: Verificar Empresa Cadastrada

```javascript
// No console do navegador (F12)
const companies = await getData('companies');
console.log(companies);

// Resultado esperado:
[{
    id: 1234567890,
    name: "JN MADEIRAS",
    cnpj: "18.615.107/0001-00",
    address: "TRAVESSA DOMINGOS MIRANDA CARNEIRO",
    city: "São Miguel do Guamá",
    state: "PA",
    phone: "(91) 99131-1049",
    logo: "../Logo JN.png"
}]
```

### Teste 2: Verificar Função de Obtenção

```javascript
// No console
const empresa = await obterDadosEmpresa();
console.log(empresa);

// Resultado: Dados da empresa cadastrada ou padrão
```

### Teste 3: Testar Impressão

1. Criar pedido de teste
2. Visualizar pedido
3. Clicar em "Imprimir"
4. **Verificar:**
   - ✅ Logo aparece no cabeçalho
   - ✅ Nome da empresa correto
   - ✅ CNPJ correto
   - ✅ Endereço completo
   - ✅ Layout profissional

---

## 📋 CONSISTÊNCIA NO SISTEMA

### Módulos com Mesmo Padrão

| Módulo | Função | Cabeçalho | Status |
|--------|--------|-----------|--------|
| Folha de Pagamento | `obterDadosEmpresa()` | ✅ Padronizado | ✅ |
| Romaneio TL | `obterDadosEmpresa()` | ✅ Padronizado | ✅ |
| Romaneio PCT | `getCompanyData()` | ✅ Padronizado | ✅ |
| Banco de Horas | `getCompanyData()` | ✅ Padronizado | ✅ |
| **Vendas** | `obterDadosEmpresa()` | ✅ Padronizado | ✅ **NOVO** |

---

## 🎨 EXEMPLO VISUAL DO CABEÇALHO

### Como Aparece na Impressão:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  [LOGO]              JN MADEIRAS                        │
│   JN          CNPJ: 18.615.107/0001-00                  │
│            TRAVESSA DOMINGOS MIRANDA CARNEIRO           │
│            São Miguel do Guamá - PA                     │
│            Fone: (91) 99131-1049                        │
│            Email: contato@jnmadeiras.com.br             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         PEDIDO DE VENDA N° 000001                       │
│   Data de Emissão: 09/10/2025 às 14:30:00              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 BENEFÍCIOS DA INTEGRAÇÃO

### 1. Uma Fonte de Dados
- ✅ Cadastra empresa 1 vez em `company.html`
- ✅ Todos os módulos usam os mesmos dados
- ✅ Atualização centralizada

### 2. Logo Automática
- ✅ Upload em `company.html`
- ✅ Aparece em TODOS os relatórios
- ✅ Sem duplicação de arquivos

### 3. Manutenção Simples
- ✅ Mudou telefone? Edite em 1 lugar
- ✅ Trocou logo? Upload em 1 lugar
- ✅ Alterou endereço? Atualiza em 1 lugar

### 4. Consistência Visual
- ✅ Mesmo layout em todos os relatórios
- ✅ Mesmo estilo de cabeçalho
- ✅ Profissional e padronizado

---

## 📝 DADOS PADRÃO (FALLBACK)

Se não houver empresa cadastrada, o sistema usa:

```javascript
{
    nome: "JN MADEIRAS",
    cnpj: "18.615.107/0001-00",
    endereco: "TRAVESSA DOMINGOS MIRANDA CARNEIRO",
    cidade: "São Miguel do Guamá",
    estado: "PA",
    telefone: "(91) 99131-1049",
    email: "contato@jnmadeiras.com.br",
    logo: "../Logo JN.png"
}
```

**Motivo:** Garantir que impressões sempre funcionem, mesmo sem cadastro.

---

## 🧪 TESTE DE INTEGRAÇÃO COMPLETO

### Passo 1: Verificar Empresa Atual
```bash
1. Abrir: company.html
2. Verificar: Se há empresa cadastrada
3. Se sim: Anotar dados
4. Se não: Cadastrar nova empresa
```

### Passo 2: Testar em Vendas
```bash
1. Abrir: vendas.html
2. Criar: Pedido de teste
3. Clicar: Listar Pedidos
4. Clicar: 👁️ Visualizar
5. Clicar: 🖨️ Imprimir
```

### Passo 3: Validar Impressão
```bash
Verificar na impressão:
✅ Logo aparece (ou SVG "JN")
✅ Nome correto da empresa
✅ CNPJ correto
✅ Endereço completo
✅ Cidade e Estado corretos
✅ Telefone correto
✅ Email (se cadastrado)
```

### Passo 4: Testar Atualização
```bash
1. Voltar: company.html
2. Editar: Nome da empresa
3. Salvar
4. Voltar: vendas.html
5. Imprimir: Novo pedido
✅ Deve aparecer novo nome
```

---

## 🔍 COMPARAÇÃO COM OUTROS MÓDULOS

### Folha de Pagamento

```javascript
// folha-relatorios.js linha 1920
async obterDadosEmpresa() {
    const companies = await getData('companies') || [];
    const companyData = companies[0] || {};
    return { ...dadosPadrao, ...companyData };
}
```

### Romaneio TL

```javascript
// imprimir-romaneio.js linha 955
async function obterDadosEmpresa() {
    let companies = [];
    if (window.FirebaseService && window.FirebaseService.getData) {
        companies = await window.FirebaseService.getData('companies') || [];
    }
    const companyData = companies[0] || {};
    return { ...dadosPadrao, ...companyData };
}
```

### Vendas (NOVO)

```javascript
// vendas.js linha 34
async function obterDadosEmpresa() {
    const companies = await getData('companies') || [];
    const companyData = companies[0] || {};
    return { ...dadosPadrao, ...companyData };
}
```

**✅ IDÊNTICO!** Segue exatamente o mesmo padrão.

---

## 🎯 ESTRUTURA DOS DADOS

### Formato Completo

```javascript
{
    // Identificação
    id: 1234567890,                          // Timestamp único
    
    // Dados principais (suporta 2 nomenclaturas)
    name: "JN MADEIRAS",                     // ou 'nome'
    cnpj: "18.615.107/0001-00",
    
    // Localização
    address: "TRAVESSA DOMINGOS...",         // ou 'endereco'
    city: "São Miguel do Guamá",             // ou 'cidade'
    state: "PA",                              // ou 'estado'
    
    // Contato
    phone: "(91) 99131-1049",                // ou 'telefone'
    email: "contato@jnmadeiras.com.br",      // opcional
    
    // Identidade visual
    logo: "https://..." ou "../Logo JN.png" ou "data:image...",
    
    // Metadados
    timestamp: "2025-10-09T12:00:00.000Z"
}
```

---

## 🎊 CONCLUSÃO

### O módulo de vendas agora está:

✅ **Integrado** com system de empresa existente  
✅ **Padronizado** com outros relatórios  
✅ **Usando dados reais** do Firebase  
✅ **Com logo** da empresa (se cadastrada)  
✅ **Sem código duplicado**  
✅ **Manutenção centralizada**  

### Para usar:

1. Cadastre empresa em `company.html` (se ainda não fez)
2. Abra `vendas.html`
3. Crie e imprima pedidos
4. **Pronto!** Logo e dados aparecem automaticamente 🎉

---

**INTEGRAÇÃO COMPLETA! ✅**

---

*Documento criado em: 09/10/2025*  
*Padrão: Seguindo folha-relatorios.js e imprimir-romaneio.js*  
*Status: ✅ Conforme solicitado pelo usuário*

