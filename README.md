# SisWeb - Sistema de Gestão para Madeireiras

SisWeb é um sistema web desenvolvido para gerenciamento de madeireiras, oferecendo funcionalidades completas para controle de vendas, estoque, clientes e mais.

## Funcionalidades

- **Autenticação e Controle de Acesso**
  - Login e registro de usuários
  - Níveis de acesso (Admin, Gerente, Usuário)
  - Gerenciamento de permissões

- **Gestão de Romaneios**
  - Romaneio TL (Tábuas Longas)
  - Romaneio PC (Pacotes)
  - Romaneio PES (Pés)
  - Romaneio Tora

- **Gestão de Clientes**
  - Cadastro de clientes
  - Histórico de compras
  - Controle de pagamentos

- **Gestão de Espécies**
  - Cadastro de espécies de madeira
  - Características e especificações
  - Preços e valores

- **Financeiro**
  - Contas a Receber
  - Contas a Pagar
  - Fluxo de Caixa
  - Relatórios financeiros

- **Relatórios**
  - Vendas
  - Estoque
  - Financeiro
  - Clientes

## Tecnologias Utilizadas

- HTML5
- CSS3
- JavaScript (ES6+)
- Web Components
- LocalStorage para persistência de dados

## Requisitos

- Navegador web moderno com suporte a JavaScript ES6+
- Conexão com internet para carregar fontes e ícones

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/sisweb.git
```

2. Abra o arquivo `index.html` em seu navegador

## Estrutura do Projeto

```
sisweb/
├── assets/
│   └── logo.svg
├── components/
│   └── menu.js
├── js/
│   ├── auth.js
│   ├── calculo.js
│   ├── main.js
│   ├── storage.js
│   └── utils.js
├── login/
│   ├── index.html
│   └── register.html
├── pages/
│   ├── clientes.html
│   ├── especies.html
│   ├── romaneios.html
│   └── ...
└── index.html
```

## Uso

1. Acesse o sistema através do navegador
2. Faça login com suas credenciais
3. Navegue pelo menu para acessar as diferentes funcionalidades

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## Contato

Seu Nome - [@seu_twitter](https://twitter.com/seu_twitter) - email@exemplo.com

Link do Projeto: [https://github.com/seu-usuario/sisweb](https://github.com/seu-usuario/sisweb) 