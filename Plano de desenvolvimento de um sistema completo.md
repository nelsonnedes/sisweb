# Plano de Desenvolvimento de um Sistema Completo

## 1. Introdução e Visão Geral

Este documento detalha o plano de desenvolvimento para a reestruturação e expansão do sistema atual, visando uma arquitetura modular, multi-empresa e baseada em Firebase. O objetivo é modernizar a aplicação, melhorar a escalabilidade, a segurança e a manutenibilidade, além de introduzir novas funcionalidades essenciais.

## 2. Análise do Sistema Atual (C:\Sisweb)

A análise inicial do diretório `C:\Sisweb` revelou uma estrutura existente com módulos e componentes, indicando um esforço prévio de modularização.

### Estrutura de Diretórios Identificada:

- `folha_pagamento/`
- `modules/`
    - `core/`
    - `crud/`
    - `dashboard/`
    - `items/`
    - `modals/`
    - `reports/`
    - `romaneio/`
    - `romaneiopct/`
- `src/`
    - `components/`
    - `services/`
    - `utils/`
- Arquivos Firebase: `firebase.json`, `firebase-rules.json`
- Arquivos HTML do Romaneio: `romaneiotl.html`, `romaneiopct.html`, `romaneiotora.html`, `romaneiopes.html`

### Análise dos Arquivos HTML do Romaneio:

Os arquivos `romaneiotl.html`, `romaneiopct.html`, `romaneiotora.html` e `romaneiopes.html` foram analisados, revelando os seguintes pontos chave:

- **`romaneiotl.html`**:
    - **Mapa de Arquitetura Modular**: Contém comentários que descrevem uma arquitetura modular, com separação de responsabilidades (e.g., `firebase-service.js`, `adicionar-item.js`, `imprimir-romaneio.js`).
    - **Supressão de Erros**: Implementa um script para suprimir erros de extensões de navegador, garantindo uma experiência de usuário mais estável.
    ```javascript
    (function() {
      const EXTENSION_ERROR_PATTERNS = ['message channel closed', 'Extension context invalidated'];
      function isExtensionError(message) { /* ... */ }
      window.addEventListener('error', function(event) { /* suppress extension errors */ });
    })();
    ```
    - **Links CSS**: Utiliza `menu.css` e `romaneio-comum.css` para estilização.
    - **Funções Globais**: Expõe funções como `adicionarItem`, `salvarRomaneio`, `imprimirRomaneio` no escopo global.

- **`romaneiopct.html`**:
    - **Padronização**: Segue um padrão similar ao `romaneiotl.html`, indicando uma abordagem consistente no desenvolvimento.
    - **Integração JSPDF**: Inclui a biblioteca JSPDF para geração de relatórios em PDF.
    ```html
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    ```
    - **Variáveis CSS**: Utiliza variáveis CSS para padronização de cores e estilos.
    ```html
    <style>:root { --primary-color: #2c3e50; --secondary-color: #3498db; }</style>
    ```

- **`romaneiotora.html`**:
    - **Firebase CDN**: Utiliza scripts do Firebase via CDN, confirmando a integração existente com o Firebase.
    - **Estilização**: Inclui `layout-comum.css` para o layout geral.
    - **Design Responsivo**: Contém CSS para tabelas responsivas, ocultando colunas em telas menores.
    ```css
    @media (max-width: 900px) {
      #romaneioTable th:nth-child(1), #romaneioTable td:nth-child(1) { display: none; }
    }
    ```

## 3. Arquitetura Modular Proposta

A nova arquitetura será organizada de forma modular para facilitar o desenvolvimento, a manutenção e a escalabilidade.

### Estrutura de Diretórios:

```
src/
├── assets/
│   ├── css/
│   ├── img/
│   └── js/
├── config/
│   ├── firebase.js
│   └── index.js
├── core/
│   ├── auth/
│   │   ├── auth-service.js
│   │   └── auth-ui.js
│   ├── firebase/
│   │   ├── firebase-service.js
│   │   └── firestore-utils.js
│   └── utils/
│       ├── helpers.js
│       └── validation.js
├── modules/
│   ├── clients/
│   │   ├── client-form.
│   │   └── client-list.js
│   ├── companies/
│   │   ├── company-management.js
│   │   └── company-selector.js
│   ├── romaneios/
│   │   ├── components/
│   │   │   ├── romaneio-form.js
│   │   │   ├── romaneio-item-table.js
│   │   │   └── romaneio-print-preview.js
│   │   ├── romaneio-service.js
│   │   └── romaneio-view.js
│   └── species/
│       ├── species-form.js
│       └── species-list.js
├── public/
│   ├── index.html
│   └── ...
└── styles/
    ├── global.css
    └── theme.css
```

### Componentes Chave da Arquitetura:

- **`src/config/firebase.js`**: Configuração central do Firebase.
- **`src/core/auth/`**: Módulo de autenticação e gerenciamento de usuários.
- **`src/core/firebase/`**: Serviços de interação com Firebase (Firestore, Storage, etc.).
- **`src/modules/romaneios/`**: Módulo principal para gerenciamento de romaneios, incluindo sub-componentes para formulários, tabelas e relatórios de impressão.
- **`src/modules/companies/`**: Módulo para gerenciamento de empresas e seleção da empresa ativa.

## 4. Lógica Multi-Empresa com Firebase

A funcionalidade multi-empresa será implementada com segregação de dados no Firestore e regras de segurança robustas.

### Estrutura de Dados no Firestore:

- **`users`**: Coleção para armazenar informações de usuários.
- **`companies`**: Coleção para armazenar informações de cada empresa.
- **`romaneios`**: Coleção principal, onde cada romaneio terá um `companyId` associado.
- **`clients`**, **`species`**, **`items`**: Coleções aninhadas ou com `companyId` para garantir a segregação.

### Regras de Segurança do Firestore (Exemplo para `romaneios`):

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Regras para a coleção de romaneios
    match /romaneios/{romaneioId} {
      allow read, write: if request.auth != null && resource.data.companyId == request.auth.token.companyId;
    }

    // Regras para a coleção de empresas
    match /companies/{companyId} {
      allow read: if request.auth != null && companyId == request.auth.token.companyId;
      allow write: if request.auth != null && companyId == request.auth.token.companyId && request.auth.token.role == 'admin';
    }

    // Regras para a coleção de usuários
    match /users/{userId} {
      allow read: if request.auth != null && userId == request.auth.uid;
      allow write: if request.auth != null && userId == request.auth.uid;
    }
  }
}
```

### Fluxo de Seleção de Empresa:

1. Após o login, o usuário seleciona a empresa ativa.
2. O `companyId` da empresa selecionada é armazenado no token de autenticação (via Custom Claims do Firebase Authentication) ou em uma variável de sessão/estado no frontend.
3. Todas as operações de leitura e escrita no Firestore incluirão o `companyId` para filtrar os dados.

## 5. Detalhamento das Funcionalidades do Sistema

### 5.1. Autenticação e Gerenciamento de Usuários

- **Login/Registro**: Autenticação via Firebase Authentication (e-mail/senha, Google, etc.).
- **Gerenciamento de Perfil**: Edição de informações do usuário.
- **Controle de Acesso Baseado em Papéis (RBAC)**: Utilização de Custom Claims do Firebase para definir papéis (e.g., `admin`, `user`) e controlar permissões.

### 5.2. Gerenciamento de Empresas

- **Cadastro de Empresas**: Funcionalidade para administradores cadastrarem novas empresas.
- **Seleção de Empresa**: Interface para usuários com acesso a múltiplas empresas selecionarem a empresa ativa.
- **Configurações da Empresa**: Gerenciamento de dados específicos da empresa.

### 5.3. Gerenciamento de Clientes

- **CRUD de Clientes**: Criação, leitura, atualização e exclusão de registros de clientes.
- **Associação a Empresas**: Clientes associados à empresa ativa.

### 5.4. Gerenciamento de Espécies

- **CRUD de Espécies**: Criação, leitura, atualização e exclusão de registros de espécies.
- **Associação a Empresas**: Espécies associadas à empresa ativa.

### 5.5. Gerenciamento de Romaneios

-   **Criação de Romaneio**:
    -   Seleção de cliente e espécie.
    -   Adição dinâmica de itens ao romaneio (peso, quantidade, valor).
    -   Cálculos automáticos (total, subtotal).
    -   Validação de dados.
-   **Edição de Romaneio**: Modificação de romaneios existentes.
-   **Visualização de Romaneios**: Listagem e busca de romaneios.
-   **Relatórios de Impressão**:
    -   Geração de PDF utilizando JSPDF (mantendo a funcionalidade existente).
    -   Impressão de romaneios com classificação CONAMA.
    -   Opções de personalização do relatório.

### 5.6. Estrutura de Menus e Módulos Detalhada

Para uma navegação clara e organização das funcionalidades, o sistema será estruturado com os seguintes módulos principais e seus respectivos sub-menus:

-   **Home**
    -   Dashboard (Visão geral e indicadores chave)
    -   Notificações
    -   Configurações de Perfil

-   **Vendas**
    -   Pedidos de Venda (Criação, edição, visualização)
    -   Cotações
    -   Histórico de Vendas
    -   Relatórios de Vendas

-   **Estoque**
    -   Produtos (Cadastro, consulta, edição)
    -   Entrada de Estoque
    -   Saída de Estoque
    -   Inventário
    -   Ajustes de Estoque
    -   Relatórios de Estoque (Posição, movimentação)

-   **Financeiro**
    -   Contas a Pagar
    -   Contas a Receber
    -   Fluxo de Caixa
    -   Conciliação Bancária
    -   Relatórios Financeiros (DRE, Balanço)
    -   **Folha de Pagamento**
        -   **Funcionalidades:**
            -   Gerenciamento de folhas de pagamento por Mês/Ano e Tipo (Quinzena, Mês Fechado).
            -   Filtro de funcionários com autocompletar e listagem.
            -   Indicadores de contas pagas (Quinzenas e Meses Fechados) com link para o sistema financeiro.
            -   Ações principais: Novo Funcionário, Novo Cargo, Nova Folha, Relatórios, Folhas Fechadas, Resumo da Folha.
            -   Funcionalidades de Banco de Horas (Lançar Crédito/Débito, Compensar, Extrato, Espelho, Vencimentos, Acordo, Gerenciar).
            -   Tabela de folhas de pagamento com detalhes de Funcionário, Mês/Ano, Tipo, Salário Base, 1ª Quinzena, Acréscimos, etc.
            -   Integração Firebase para persistência de dados e autenticação.
            -   Guarda de autenticação para redirecionamento de usuários não logados.
            -   Tratamento global de erros e diagnósticos em tempo real.
        -   **Campos do Formulário (principais):**
            -   Mês/Ano: `input type="month" id="mesAno"`
            -   Tipo: `select id="tipoFolha"` (opções: Todos, Quinzena, Mês Fechado)
            -   Funcionário: `input type="text" id="funcionarioFiltro"` (com autocomplete)

-   **Cadastros**
    -   Clientes (CRUD completo, com campos: Nome, CNPJ, Inscrição Estadual, Endereço, Número, Bairro, Estado, Cidade, Telefone, Observações. Funcionalidades: Cadastro, listagem com filtro e paginação, edição, exclusão. Integração Firebase com multi-tenancy.)
    -   Fornecedores (CRUD completo, com campos: Nome, Documento (CNPJ/CPF), Telefone, Email, Endereço, Bairro, Cidade, Estado, Observações. Funcionalidades: Cadastro, listagem com filtro, edição, exclusão. Integração Firebase com multi-tenancy.)
    -   Transportadoras (Cadastro, consulta)
    -   Usuários (Gerenciamento de acesso e permissões)
    -   Empresas (Gerenciamento de dados da empresa ativa)
    -   Espécies (CRUD completo, com campos: Nome da Espécie, Descrição. Funcionalidades: Cadastro, listagem com filtro e paginação, edição, exclusão. Integração Firebase com multi-tenancy e fallback para localStorage.)
    -   Itens/Produtos (Cadastro detalhado de itens)
    -   Ajudas de Espessura
        -   **Funcionalidades:**
            -   Calculadora para classificação de madeira conforme CONAMA.
            -   Exibição de tabelas de classificação CONAMA (antiga e corrigida).
            -   Comparação entre classificações antigas e corrigidas.
            -   Interface interativa para entrada de espessura e largura.
            -   Cálculo e exibição da classificação da madeira em tempo real.
            -   Design responsivo para uso em diferentes dispositivos.
        -   **Campos do Formulário (principais):**
            -   Espessura (cm): `input type="number" id="espessura"`
            -   Largura (cm): `input type="number" id="largura"`
            -   Botão "Classificar Madeira": `button id="calcular"`
            -   Resultado da Classificação: `p id="classificacaoResultado"`

-   **Romaneios**
    -   Novo Romaneio (Criação detalhada, conforme seção 5.5)
    -   Consultar Romaneios (Busca e visualização)
    -   Editar Romaneio
    -   Imprimir Romaneio (Geração de relatórios PDF)
    -   Relatórios de Romaneios (Análises específicas)
    -   Romaneio PCT
        -   **Funcionalidades:**
            - Criação, edição e visualização de romaneios.
            - Integração completa com Firebase para armazenamento de dados.
            - Geração de PDF do romaneio utilizando JSPDF.
            - Gestão de Espécies integrada (listagem, criação, edição via modais padronizados).
            - Botões de ação padronizados (salvar, listar, editar, excluir, imprimir, financeiro).
            - Padronização de UI/UX com `romaneiotl.html` para modais, botões e tabelas.
            - Supressão de erros de extensões de navegador para maior estabilidade.
        -   **Campos do Formulário (principais):**
            - Número do Romaneio
            - Data
            - Cliente (seleção)
            - Motorista
            - Veículo
            - Placa
            - Origem
            - Destino
            - Itens do Romaneio (tabela com: Espécie, Quantidade, Largura, Espessura, Comprimento)
            - Observações
            - Campos de Espécies (Nome da Espécie, Descrição - dentro dos modais de gestão de espécies)
    -   Romaneio TL
        -   **Funcionalidades:**
            - Arquitetura modular com separação de responsabilidades (HTML/CSS/Firebase Init neste arquivo, lógica de negócio em módulos JS externos).
            - Integração completa com Firebase para armazenamento de dados (via `firebase-service.js`).
            - Geração de PDF do romaneio (via `imprimir-romaneio.js`).
            - Gestão de Clientes e Espécies integrada (CRUD via `gerenciar-clientes.js`, `gerenciar-especies.js` e modais dedicados).
            - Gerenciamento de itens do romaneio (adição, edição, exclusão, cálculo de volume/valor via `adicionar-item.js`, `renderizar-tabela.js`, `excluir-item.js`).
            - Salvamento e edição de romaneios (via `salvar-romaneio.js`).
            - Listagem e busca de romaneios com paginação (via `modal-lista-romaneios.js`).
            - Navegação otimizada entre campos com a tecla Enter (via `navegacao-enter.js`).
            - Supressão de erros de extensões de navegador para maior estabilidade.
            - Formatação de campos (moeda, números) e validações gerais (via `utils.js`, `formatacao-campos.js`).
        -   **Campos do Formulário (principais, gerenciados por módulos externos):**
            - **Cabeçalho do Romaneio:** Cliente (seleção), Data, Número do Romaneio, Motorista, Veículo, Placa, Origem, Destino, Observações.
            - **Itens do Romaneio (tabela):** Espécie (seleção), Quantidade, Largura, Espessura, Comprimento, Valor Unitário, Valor Total.
            - **Modais de Cliente:** Nome, CNPJ/CPF, Endereço, Telefone, Email.
            - **Modais de Espécies:** Nome da Espécie, Descrição.
    -   Romaneio de Toras
                -   **Funcionalidades:**
                    - Gerenciamento de romaneios específicos para toras.
                    - Integração Firebase (versão 9.6.1 `compat`) para persistência de dados.
                    - Geração de PDF do romaneio utilizando JSPDF.
                    - Design responsivo com ocultação de colunas em telas menores para otimização.
                    - Gerenciamento detalhado de itens (toras) com campos específicos para dimensões.
                    - Autocomplete para campos de entrada, com sugestões e ícones de ação.
                    - Modais genéricos e modal de listagem de espécies padronizado com `romaneiotl.html`.
                    - Paginação para listas de dados.
                    - Modal "Sobre" com informações do desenvolvedor.
                    - Melhorias de UX para navegação por teclado e feedback visual.
                    - Limpeza automática de dados de teste e deduplicação de fornecedores.
                    - Validação automática de fluxo de trabalho via parâmetro de URL para testes.
                -   **Campos do Formulário (principais):**
                    - **Cabeçalho do Romaneio:** Fornecedor (seleção), Data, Número do Romaneio, Observações.
                    - **Itens do Romaneio (Toras):** Plaqueta, Espécie (com autocomplete), Rodo, Comprimento, Oco 1, Oco 2, Desconto, M³ Líquido (calculado), Preço, Valor (calculado).
                    - **Modais de Espécies (inferido):** Nome da Espécie, Descrição.
            -   Romaneio Pés
                -   **Funcionalidades:**
            - Gerenciamento de romaneios baseados em espessura, quantidade, volume e valor.
                    - Integração completa com Firebase para armazenamento de dados.
                    - Geração de PDF do romaneio com opções de impressão.
                    - Gerenciamento integrado de clientes e espécies com funcionalidades CRUD.
                    - Autocomplete para seleção de clientes e espécies.
                    - Cálculos automáticos de volume e valor dos itens.
                    - Utilização de `localStorage` para dados temporários.
                    - Formatação automática de texto (maiúsculas para título).
                    - Arquitetura modular com uso de arquivos JS externos para funcionalidades específicas.
                -   **Campos do Formulário (principais):**
                    - **Cabeçalho do Romaneio:** Cliente (autocomplete), Espécie (autocomplete).
                    - **Itens do Romaneio:** Espessura, Preço, Quantidade.
                    - **Modais de Cliente:** Nome, Estado, Cidade, Telefone, Email, Observações.
                    - **Modais de Espécies:** Nome da Espécie, Descrição.

## 6. Diagrama de Desenvolvimento (Mermaid)

```mermaid
graph TD
    A[Usuário] --> B(Frontend Web Application)
    B --> C{Firebase Authentication}
    C --> D[Firebase Firestore]
    D --> E[Firebase Storage]
    B --> F(Módulos do Frontend)
    F --> F1(Autenticação)
    F --> F2(Gerenciamento de Empresas)
    F --> F3(Gerenciamento de Clientes)
    F --> F4(Gerenciamento de Espécies)
    F --> F5(Gerenciamento de Romaneios)
    F5 --> F5.1(Formulário de Romaneio)
    F5 --> F5.2(Tabela de Itens)
    F5 --> F5.3(Pré-visualização de Impressão)
    F5.3 --> G(JSPDF para Relatórios)
    D -- Dados Segregados por Empresa --> F
    C -- Autenticação e Autorização --> F
    E -- Upload/Download de Arquivos --> F
```

**Explicação do Diagrama:**

- O usuário interage com a aplicação web frontend.
- A autenticação é gerenciada pelo Firebase Authentication.
- Os dados são armazenados no Firebase Firestore, com segregação por empresa.
- O Firebase Storage será utilizado para upload/download de arquivos (se necessário).
- O frontend é composto por módulos que interagem com os serviços Firebase.
- O módulo de Romaneios inclui sub-componentes para formulários, tabelas e pré-visualização de impressão, que utiliza JSPDF para gerar os relatórios.

## 7. Configuração e Implantação do Firebase

### 7.1. Configuração do Firebase no Projeto (`src/config/firebase.js`)

```javascript
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAqizcmzeTu2zYonBNCsWGY96RPV3-cGvE", // Substitua pela sua chave de API
  authDomain: "dbsisweb-2516c.firebaseapp.com",
  projectId: "dbsisweb-2516c",
  storageBucket: "dbsisweb-2516c.appspot.com",
  messagingSenderId: "10287654321",
  appId: "1:10287654321:web:abcdef1234567890abcdef"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Conecta aos emuladores do Firebase em ambiente de desenvolvimento local
if (window.location.hostname === "localhost") {
  connectFirestoreEmulator(db, "localhost", 8080);
  connectAuthEmulator(auth, "http://localhost:9099");
  console.log("Conectado aos emuladores do Firebase.");
}

export { app, auth, db };
```

### 7.2. Ferramentas CLI do Firebase

- **Instalação**: `npm install -g firebase-tools`
- **Login**: `firebase login`
- **Inicialização do Projeto**: `firebase init` (selecionar Firestore, Functions, Hosting, etc.)
- **Emuladores Locais**: `firebase emulators:start` para desenvolvimento e testes locais.
- **Deploy**: `firebase deploy` para implantar a aplicação no Firebase Hosting e as regras de segurança/funções.

## 8. Próximos Passos

1. **Configuração do Ambiente**: Configurar o ambiente de desenvolvimento local com Firebase CLI e emuladores.
2. **Implementação da Estrutura Básica**: Criar a estrutura de diretórios proposta e os arquivos iniciais.
3. **Módulo de Autenticação**: Desenvolver o módulo de autenticação e gerenciamento de usuários.
4. **Módulo de Empresas**: Implementar o gerenciamento de empresas e a lógica de seleção.
5. **Módulos de Clientes e Espécies**: Desenvolver as funcionalidades CRUD para clientes e espécies.
6. **Módulo de Romaneios**: Implementar a criação, edição, visualização e relatórios de impressão de romaneios.
7. **Testes**: Realizar testes unitários, de integração e de ponta a ponta.
8. **Otimização e Refatoração**: Otimizar o desempenho e refatorar o código conforme necessário.
9. **Implantação**: Realizar a implantação em ambiente de produção.

## 9. Padrão Oficial de Paginação (Sistema)

### 9.1. Referência Oficial

- **Referência**: Tabela “Lista de Pedidos” do módulo de Vendas.
- **Objetivo**: Padronizar comportamento, layout, itens por página, botões e tratamento de dados em todas as tabelas do sistema.

### 9.2. Especificação Técnica

- **Itens por página**: 10.
- **Estado de paginação**: variável por tabela (ex.: `paginaAtualEstoque`, `paginaAtualMovimentacoes`).
- **Controle de páginas**:
  - Botões: `<<<`, `<`, números, `>`, `>>>`.
  - Janela de páginas: 5 botões numéricos com elipses quando necessário.
  - Desabilitar botões de navegação nas extremidades.
- **Layout/CSS**:
  - Container: `.pagination-controls`
  - Botão ativo: classe `active`
  - Elipse: `<span>...</span>`
- **Regras de dados**:
  - Total de páginas calculado por `Math.ceil(totalItens / itensPorPagina)`.
  - Resetar página para 1 em qualquer filtro/busca.
  - Sempre paginar sobre a lista filtrada.

### 9.3. Componentes Criados/Modificados

- **JS**:
  - Função padrão: `renderizarPaginacaoPadrao(containerId, totalItems, paginaAtual, itensPorPagina, onPageFn)`.
  - Funções de mudança de página por tabela (ex.: `mudarPaginaEstoque`, `mudarPaginaMovimentacoes`).
- **HTML/CSS**:
  - Container de paginação padrão `.pagination-controls`.
  - Estilos idênticos ao padrão da Vendas (botões, ativo, disabled, elipse).

### 9.4. Arquivos Afetados

- `C:\Sisweb\estoque.html`  
  - Containers `.pagination-controls` em todas as tabelas do módulo de estoque.
  - CSS de paginação padronizado.
- `C:\Sisweb\estoque.js`  
  - Paginação unificada nas tabelas: Entrada, Saída, Consulta de Estoque, Movimentações e Compras.
  - Função padrão de paginação alinhada ao módulo de Vendas.
- `C:\Sisweb\estoque_produtos.js`  
  - Paginação do Almoxarifado alinhada ao padrão oficial.
- `C:\Sisweb\romaneiotora.html`  
  - Container `.pagination-controls` e CSS alinhado ao padrão oficial.
- `C:\Sisweb\romaneiopct.html`  
  - Container `.pagination-controls` e CSS alinhado ao padrão oficial.
- `C:\Sisweb\romaneiotl.html`  
  - Container `.pagination-controls` e CSS alinhado ao padrão oficial.
- `C:\Sisweb\romaneiotora.js`  
  - Paginação da tabela de itens ajustada para o padrão oficial.
- `C:\Sisweb\romaneiopct-tabela.js`  
  - Paginação e itens por página ajustados para o padrão oficial.
- `C:\Sisweb\modules\items\renderizar-tabela.js`  
  - Paginação da tabela de itens ajustada para o padrão oficial.

### 9.5. Testes Realizados

- Teste manual de paginação em:
  - Itens para Entrada
  - Toras Selecionadas para Baixa
  - Consultar Estoque
  - Estoque de Almoxarifado (Produtos)
  - Histórico de Movimentações
  - Compras (Entradas por Compras)
  - Romaneio Tora
  - Romaneio PCT
  - Romaneio TL

### 9.6. Guia de Implementação para Novas Tabelas

1. Adicionar container de paginação:
   - `<div id="paginacaoX" class="pagination-controls"></div>`
2. Criar estado de página:
   - `let paginaAtualX = 1;`
3. Renderizar com padrão oficial:
   - `renderizarPaginacaoPadrao('paginacaoX', lista.length, paginaAtualX, 10, 'mudarPaginaX')`
4. Resetar página ao filtrar:
   - `paginaAtualX = 1;`
5. Exportar função `mudarPaginaX` no `window` quando necessário.

## 10. Refatoração Estrutural de Layout e Navegação (Plano Atualizado)

### 10.1. Objetivo e Escopo

- **Objetivo**: modernizar layout, menu e navegação sem quebrar comportamento funcional existente.
- **Escopo**:
  - Menu e sidebar
  - Layout global
  - Responsividade PWA
  - Navegação por teclado (Enter)
  - Persistência de foco
  - Persistência de dados temporários
- **Restrições**:
  - Não alterar URLs/rotas existentes
  - Não alterar IDs já usados no JavaScript
  - Não quebrar navegação por Enter, impressão e fluxo de adição de itens

### 10.2. Estado Atual (O que já existe)

- **Menu**:
  - Menu compartilhado via `menu.css` e `menu-component.js` em múltiplas páginas.
- **Layout base parcial**:
  - Padronização de container e botões em `layout-comum.css`.
- **Navegação por Enter**:
  - Implementações locais por módulo (ex.: `modules/core/navegacao-enter.js`, `estoque.js`, scripts inline em `romaneiotora.html`).
- **Impressão**:
  - Regras pontuais em páginas específicas com `@media print`.

### 10.3. Lacunas Identificadas (O que falta corrigir/atualizar)

- **Layout global unificado** inexistente (não há `#app-layout`, `#sidebar`, `#topbar`, `#page-content` padronizados).
- **Sidebar responsiva/PWA** não centralizada (sem drawer ou bottom navigation padrão).
- **Mapa central de rotas do menu** ausente (links distribuídos e potencialmente inconsistentes).
- **Navegação Enter** duplicada e acoplada ao DOM (risco alto em refatoração de layout).
- **Persistência de foco** feita com `setTimeout` local sem padrão global.
- **Estado temporário central** inexistente (dados transitórios dependem do DOM).
- **Padrão de formulários futuros** não formalizado (ordem de foco, validação, botões móveis).
- **Impressão** sem regra global para ocultar sidebar/topbar após futura refatoração.

### 10.4. Pontos Críticos (Exigir Atenção Máxima)

- **IDs de campos**: não podem ser alterados.
- **Fluxo Enter**: deve permanecer funcional em todos os formulários.
- **Foco após adicionar itens**: deve retornar ao campo correto sempre.
- **Persistência de dados temporários**: não pode desaparecer após re-renderização.
- **Impressão**: não pode incluir sidebar/topbar nem perder formatação atual.
- **Evitar duplicidade**: revisar se a funcionalidade já existe e apenas atualizar.

### 10.5. Implementações Necessárias (Planejamento)

- **Layout Base Global Único**:
  - `#app-layout` → `#sidebar` + `#main-wrapper` → `#topbar` + `#page-content`.
- **Sidebar Responsiva**:
  - Desktop: fixa e colapsável.
  - PWA: drawer ou bottom navigation.
- **Estrutura de Sidebar Ideal**:
  - Desktop: Logo, Dashboard, Vendas, Produção, Financeiro, RH, Admin.
  - PWA: Bottom navigation com Dashboard, Vendas, Produção, Financeiro, Menu.
- **Menu dinâmico**:
  - Constante central `MENU_ROUTES` com rotas e ícones.
- **Navegação por Enter global**:
  - Padronização via `data-nav-order`.
  - Função global `setupFormNavigation(form)`.
- **Persistência de foco**:
  - Função global `restoreFocus(selector)`.
- **Estado temporário central**:
  - Estrutura `FormState` para itens temporários e formulário corrente.
- **Padrão de formulários futuros**:
  - `data-nav-order`, `restoreFocus`, estado central, validação padronizada.
  - Grid responsivo sem reordenação via `order` ou `column-reverse`.
- **Impressão**:
  - `@media print` global ocultando sidebar/topbar.

### 10.6. Plano de Migração sem Regressão

1. Criar layout-base (HTML + CSS estrutural) sem alterar IDs internos.
2. Migrar página piloto (ex.: clientes).
3. Testar Enter, foco, persistência, impressão.
4. Migrar Romaneios.
5. Migrar Folha de Pagamento.

### 10.7. Checklist Obrigatório (Não Regressão)

- [ ] Enter funciona em todos os formulários
- [ ] Foco retorna ao campo correto
- [ ] Dados não somem ao adicionar itens
- [ ] Sidebar não interfere em clicks/atalhos
- [ ] Responsividade preservada
- [ ] Impressão preservada
- [ ] IDs mantidos
- [ ] JS antigo continua encontrando os elementos

### 10.8. Resultado Esperado

- Sidebar profissional no desktop e navegação PWA consistente.
- Nenhum link perdido e nenhuma rota alterada.
- Enter e foco padronizados em todos os formulários.
- Persistência de dados temporários garantida.
- Impressão preservada com layout isolado.

### 10.9. Observação Final

- Este plano é **somente documentação** e não executa nenhuma mudança em código.
- Toda implementação deve respeitar o princípio: **manter o que já funciona e melhorar apenas o necessário**.

## 11. Inventário de Módulos por Página (Padrões, Divergências, Riscos e Ações)

### 11.1. Critérios de Inventário

- **Padrões já aplicados**: menu (menu-component.js), layout comum (layout-comum.css), padrões de impressão, paginação oficial.
- **Divergências**: ausência de padrões, CSS crítico inline, variações de layout.
- **Riscos**: regressão de Enter/foco, quebra de impressão, inconsistência visual.
- **Ações corretivas sugeridas**: alinhar padrões sem alterar IDs/rotas.

### 11.2. Páginas Principais e Operacionais

| Página | Padrões já aplicados | Divergências | Riscos | Ações corretivas sugeridas |
|---|---|---|---|---|
| index.html | Menu compartilhado | Layout-comum.css ausente | Layout inconsistente | Adotar layout-comum.css sem alterar IDs |
| vendas.html | Menu + layout-comum.css | CSS crítico inline alto | Regra visual duplicada | Consolidar estilos no layout-comum.css |
| compras.html | Menu + layout-comum.css | CSS crítico inline alto | Manutenção difícil | Consolidar estilos base |
| estoque.html | Menu + layout-comum.css | CSS específico por módulo | Baixo | Manter; revisar Enter e impressão |
| financas.html | Menu + layout-comum.css | Verificação de Enter/foco pendente | Médio | Auditar foco e impressão |
| notas-fiscais.html | Menu + layout-comum.css + romaneio-comum.css | CSS crítico inline alto | Impressão e layout inconsistentes | Centralizar estilos e regras print |
| mdf-e.html | Menu + layout-comum.css | Auditoria de Enter/foco pendente | Médio | Padronizar navegação por Enter |
| romaneiotora.html | Menu + layout-comum.css | Navegação Enter local | Alto em refatoração | Migrar para padrão data-nav-order |
| romaneiopct.html | Menu | Layout-comum.css ausente | Inconsistência visual | Adotar layout-comum.css |
| romaneiotl.html | Menu | Layout-comum.css ausente | Inconsistência visual | Adotar layout-comum.css |
| romaneiopes.html | Menu | Layout-comum.css ausente | Inconsistência visual | Adotar layout-comum.css |
| preromaneio.html | Menu | Layout-comum.css ausente | Inconsistência visual | Adotar layout-comum.css |
| romaneiotora_otimizado.html | Menu + layout-comum.css | Verificar Enter/foco | Médio | Alinhar Enter/foco |
| romaneiopct_back.html | Menu | Padrões atuais indefinidos | Médio | Auditoria de padrões |
| romaneiotora_versao_dev.html | Menu + layout-comum.css | Ambiente de teste | Baixo | Manter apenas para QA |
| romaneiotora_backup.html | Menu + layout-comum.css | Página legada | Baixo | Manter somente como referência |
| compras_legacy.html | Menu + layout-comum.css | Legado | Médio | Mapear divergências e decidir migração |
| client.html | Menu + layout-comum.css | CSS local complementar | Baixo | Consolidar estilos comuns |
| fornecedor.html | Menu + layout-comum.css | CSS local complementar | Baixo | Consolidar estilos comuns |
| species.html | Menu + layout-comum.css | CSS local complementar | Baixo | Consolidar estilos comuns |
| importar_especies.html | Menu + layout-comum.css | Fluxo utilitário | Baixo | Padronizar botões e layout |
| company.html | Menu | Layout-comum.css ausente | Inconsistência visual | Adotar layout-comum.css |
| user-profile.html | Menu | Layout-comum.css ausente | Inconsistência visual | Adotar layout-comum.css |
| admin-dashboard.html | Menu | Layout-comum.css ausente | Inconsistência visual | Adotar layout-comum.css |
| admin-settings.html | Menu | Layout-comum.css ausente | Inconsistência visual | Adotar layout-comum.css |
| admin-subscriptions.html | Menu | Layout-comum.css ausente | Inconsistência visual | Adotar layout-comum.css |
| subscription-status.html | Menu | Layout-comum.css ausente | Inconsistência visual | Adotar layout-comum.css |
| template.html | Menu | Base de template | Baixo | Transformar em layout-base padrão |
| index_bak.html | Menu | Backup | Baixo | Manter somente como referência |

### 11.3. Páginas de Suporte e Administração Técnica

| Página | Padrões já aplicados | Divergências | Riscos | Ações corretivas sugeridas |
|---|---|---|---|---|
| login.html | Nenhum | Sem menu/layout comum | Baixo | Definir padrão mínimo de layout |
| reset-system.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| reset-client.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| diagnostico.html | Menu ausente | Layout comum ausente | Médio | Padronizar menu/layout |
| migration.html | Menu | Layout comum ausente | Médio | Padronizar layout comum |
| migration-tool.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| migrate-to-firebase.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| firebase-rules-update.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| fix-firebase-rules.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| migrar-contas.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| verificar_romaneios.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| corrigir_romaneios.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| corrigir_fornecedores.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| limpar_clientes.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| limpar_especies.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| sincronizar.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| extrator_dados_dashboard.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| auto_sync_firebase.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| aplicar_correcao_vendas.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| aplicar_estrategia_hibrida.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| aplicar_estrategia_hibrida_v2.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| ajudabitolas.html | Menu | Layout comum ausente | Médio | Padronizar layout comum |
| subscription.html | Nenhum | Página comercial | Médio | Padronizar menu/layout |

### 11.4. Módulo Folha de Pagamento

| Página | Padrões já aplicados | Divergências | Riscos | Ações corretivas sugeridas |
|---|---|---|---|---|
| folha_pagamento/folha.html | Menu + layout-comum.css | Padrões de Enter/foco dispersos | Alto | Unificar Enter/foco e impressão |
| folha_pagamento/normalizar-quinzena.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| folha_pagamento/teste-firebase-simples.html | Nenhum | Página técnica | Baixo | Padronizar visual básico |
| folha_pagamento/teste-modal-integrado.html | Menu + layout-comum.css | Página de teste | Baixo | Manter isolada para QA |

### 11.5. Observações de Risco Transversal

- **Alta prioridade**: romaneios e folha de pagamento por dependerem de Enter/foco e impressão.
- **Média prioridade**: páginas com menu mas sem layout comum.
- **Baixa prioridade**: páginas técnicas/utilitárias com uso esporádico.

## 12. Checklist Técnico por Página e Priorização de Risco

### 12.1. Critérios do Checklist

- **Enter/Foco**: fluxo de Enter e foco pós-ação.
- **Impressão**: regras de print e isolamento de layout.
- **IDs**: dependências de IDs no JS existentes.
- **Layout**: adoção do layout-base e layout-comum.
- **Impacto no Usuário**: nível de impacto percebido em uso diário.
- **Esforço (P/M/G)**:
  - **P**: até 0,5 dia, 1 página, baixo risco técnico.
  - **M**: 1–3 dias, 2–3 páginas, risco médio.
  - **G**: >3 dias, múltiplos módulos ou risco alto.

### 12.1.1. Legenda Visual (Impacto/Esforço)

- **Impacto**:
  - 🔴 Alto
  - 🟡 Médio
  - 🟢 Baixo
- **Esforço**:
  - 🟥 G
  - 🟨 M
  - 🟩 P

### 12.1.2. Matriz de Priorização (Impacto × Esforço)

| Impacto \ Esforço | 🟩 P | 🟨 M | 🟥 G |
|---|---|---|---|
| 🔴 Alto | Prioridade Máxima | Prioridade Alta | Prioridade Planejada |
| 🟡 Médio | Prioridade Alta | Prioridade Média | Prioridade Baixa |
| 🟢 Baixo | Prioridade Média | Prioridade Baixa | Evitar/Postergar |

### 12.2. Alta Prioridade (Risco Alto)

| Página | Enter/Foco | Impressão | IDs | Layout | Impacto no Usuário | Dependências Técnicas | Esforço (P/M/G) | Ações imediatas |
|---|---|---|---|---|---|---|---|---|
| romaneiotora.html | Verificar Enter global vs local | Validar print e ocultar sidebar | Mapear IDs críticos do formulário | Adotar layout-base sem alterar IDs | Alto | menu.css, layout-comum.css, romaneio-comum.css, scripts inline | G | Migrar para data-nav-order e restoreFocus |
| romaneiopct.html | Verificar Enter global vs local | Validar print e ocultar sidebar | Mapear IDs críticos do formulário | Adotar layout-comum + layout-base | Alto | menu.css, romaneio-comum.css, print-styles.css, romaneiopct-tabela.js | G | Padronizar Enter/foco |
| romaneiotl.html | Verificar Enter global vs local | Validar print e ocultar sidebar | Mapear IDs críticos do formulário | Adotar layout-comum + layout-base | Alto | menu.css, romaneio-comum.css | G | Padronizar Enter/foco |
| romaneiopes.html | Verificar Enter local | Validar print | Mapear IDs críticos | Adotar layout-comum + layout-base | Alto | menu.css, romaneio-comum.css | M | Padronizar Enter/foco |
| folha_pagamento/folha.html | Unificar Enter e foco | Validar print | Mapear IDs críticos | Adotar layout-base | Alto | menu.css, layout-comum.css, folha_pagamento/*.js | G | Padronizar Enter/foco e impressão |

### 12.3. Média Prioridade (Risco Médio)

| Página | Enter/Foco | Impressão | IDs | Layout | Impacto no Usuário | Dependências Técnicas | Esforço (P/M/G) | Ações sugeridas |
|---|---|---|---|---|---|---|---|---|
| vendas.html | Revisar fluxo Enter em filtros/forms | Validar print de relatórios | Mapear IDs usados no JS | Layout-base sem alterar IDs | Alto | menu.css, layout-comum.css, vendas.js | M | Consolidar CSS inline |
| compras.html | Revisar Enter em entrada/itens | Validar print | Mapear IDs usados no JS | Layout-base sem alterar IDs | Alto | menu.css, layout-comum.css, compras.js | M | Consolidar CSS inline |
| estoque.html | Validar Enter da entrada/baixa | Validar print | IDs já críticos | Layout-base sem alterar IDs | Alto | menu.css, layout-comum.css, estoque.js, estoque_produtos.js | M | Garantir foco pós-ação |
| financas.html | Verificar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, layout-comum.css, financas.js | M | Padronizar layout |
| notas-fiscais.html | Verificar Enter | Validar print | Mapear IDs críticos | Layout-base | Alto | menu.css, layout-comum.css, romaneio-comum.css, status-styles.css | M | Consolidar CSS inline |
| mdf-e.html | Verificar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, layout-comum.css | M | Padronizar layout |
| client.html | Validar Enter em modais/forms | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, layout-comum.css, client*.js | M | Consolidar CSS comum |
| fornecedor.html | Validar Enter em modais/forms | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, layout-comum.css, fornecedor*.js | M | Consolidar CSS comum |
| species.html | Validar Enter em modais/forms | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, layout-comum.css, species*.js | M | Consolidar CSS comum |
| importar_especies.html | Validar Enter básico | Não aplicável | Mapear IDs críticos | Layout-base | Baixo | menu.css, layout-comum.css | P | Padronizar layout |
| company.html | Validar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, company*.js | M | Adotar layout-comum |
| user-profile.html | Validar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, user-profile*.js | M | Adotar layout-comum |
| admin-dashboard.html | Validar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, admin-dashboard*.js | M | Adotar layout-comum |
| admin-settings.html | Validar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, admin-settings*.js | M | Adotar layout-comum |
| admin-subscriptions.html | Validar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, admin-subscriptions*.js | M | Adotar layout-comum |
| subscription-status.html | Validar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, subscription-status*.js | M | Adotar layout-comum |
| ajudabitolas.html | Validar Enter | Não aplicável | Mapear IDs críticos | Layout-base | Baixo | menu.css | P | Adotar layout-comum |
| subscription.html | Validar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, subscription*.js | M | Adotar layout-comum |
| preromaneio.html | Validar Enter | Validar print | Mapear IDs críticos | Layout-base | Alto | menu.css, preromaneio.js | M | Padronizar Enter/foco |
| romaneiotora_otimizado.html | Validar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, layout-comum.css, romaneiotora.js | M | Alinhar layout comum |
| compras_legacy.html | Verificar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, layout-comum.css, compras.js | M | Definir migração |
| romaneiopct_back.html | Verificar Enter | Validar print | Mapear IDs críticos | Layout-base | Médio | menu.css, romaneio-comum.css | M | Definir migração |

### 12.4. Baixa Prioridade (Risco Baixo)

| Página | Enter/Foco | Impressão | IDs | Layout | Impacto no Usuário | Dependências Técnicas | Esforço (P/M/G) | Ações sugeridas |
|---|---|---|---|---|---|---|---|---|
| index.html | Não crítico | Não aplicável | Baixo acoplamento | Layout-base | Baixo | menu.css | P | Adotar layout-comum |
| index_bak.html | Não aplicável | Não aplicável | Legado | Nenhuma | Baixo | Nenhuma | P | Manter referência |
| template.html | Não aplicável | Não aplicável | Baixo acoplamento | Base oficial | Baixo | menu.css | P | Transformar em layout-base |
| login.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Médio | login.js | P | Padronizar visual mínimo |
| reset-system.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Médio | reset-system.js | P | Padronizar visual mínimo |
| reset-client.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Médio | reset-client.js | P | Padronizar visual mínimo |
| diagnostico.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base | Baixo | menu.css, diagnostico.js | P | Adotar menu/layout |
| migration.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base | Baixo | menu.css, migration.js | P | Adotar layout comum |
| migration-tool.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | migration-tool.js | P | Padronizar visual mínimo |
| migrate-to-firebase.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | migrate-to-firebase.js | P | Padronizar visual mínimo |
| firebase-rules-update.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | firebase-rules-update.js | P | Padronizar visual mínimo |
| fix-firebase-rules.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | fix-firebase-rules.js | P | Padronizar visual mínimo |
| migrar-contas.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | migrar-contas.js | P | Padronizar visual mínimo |
| verificar_romaneios.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | verificar_romaneios.js | P | Padronizar visual mínimo |
| corrigir_romaneios.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | corrigir_romaneios.js | P | Padronizar visual mínimo |
| corrigir_fornecedores.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | corrigir_fornecedores.js | P | Padronizar visual mínimo |
| limpar_clientes.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | limpar_clientes.js | P | Padronizar visual mínimo |
| limpar_especies.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | limpar_especies.js | P | Padronizar visual mínimo |
| sincronizar.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | sincronizar.js | P | Padronizar visual mínimo |
| extrator_dados_dashboard.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | extrator_dados_dashboard.js | P | Padronizar visual mínimo |
| auto_sync_firebase.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | auto_sync_firebase.js | P | Padronizar visual mínimo |
| aplicar_correcao_vendas.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | aplicar_correcao_vendas.js | P | Padronizar visual mínimo |
| aplicar_estrategia_hibrida.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | aplicar_estrategia_hibrida.js | P | Padronizar visual mínimo |
| aplicar_estrategia_hibrida_v2.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | aplicar_estrategia_hibrida_v2.js | P | Padronizar visual mínimo |
| folha_pagamento/normalizar-quinzena.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | normalizar-quinzena.js | P | Padronizar visual mínimo |
| folha_pagamento/teste-firebase-simples.html | Fluxo simples | Não aplicável | Baixo acoplamento | Layout-base leve | Baixo | teste-firebase-simples.js | P | Padronizar visual mínimo |
| folha_pagamento/teste-modal-integrado.html | Fluxo simples | Não aplicável | Página de teste | Isolado | Baixo | teste-modal-integrado.js | P | Manter para QA |
