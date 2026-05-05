---
description: Guia essencial e padrões de desenvolvimento do Sisweb para o AIOX Orchestrator e Codex CLI.
---
# Sisweb Development Patterns & Best Practices

Esta skill consolida os padrões, cuidados e detalhes críticos da arquitetura do projeto **Sisweb**. SEMPRE recupere e siga estas regras ao criar novas funcionalidades, alterar interfaces ou fazer queries no banco de dados.

## 🎯 1. Visão Geral da Arquitetura
- **Stack**: HTML5, Vanilla JavaScript (ES6+), Vanilla CSS e Firebase.
- **Não há frameworks SPA** como React, Angular ou Vue. A manipulação do DOM é feita nativamente via JavaScript, por isso exige extremo cuidado para evitar memory leaks ou reflows desnecessários.
- **Módulos Independentes**: O projeto é dividido por telas (ex: `vendas.html` + `vendas.js`, `financas.html` + `financas.js`, `romaneiopct.html`, `folha_pagamento/`, etc).

## 🎨 2. Padrões de Interface (UI/UX) e Responsividade
- **Sistema de Grid e Containers**:
  - O layout base é definido no arquivo `layout-comum.css`.
  - Tudo deve estar contido num `.container` centralizado (max-width de 1300px usando a variável `--max-width-container`).
  - A responsividade para mobile (abaixo de 768px ou 480px) ajusta paddings para evitar que o conteúdo passe da tela. Utilize Flexbox e CSS Grid nas tabelas e listas de itens.
- **Sistema de Botões Padrão**:
  - Não recrie botões do zero! Use as classes do `layout-comum.css`: `.btn`, `.btn-primary`, `.btn-success`, `.btn-danger`, `.btn-secondary`, `.btn-action`.
  - Botões menores para tabelas usam `.btn-small` ou `.btn-icon-only`.
  - Sempre inclua ícones FontAwesome (`<i class="fas fa-..."></i>`) para melhorar a UX corporativa.
- **Feedback Visual (Loading e Toasts)**:
  - **Loadings**: Existe um overlay global `div.loading-overlay` com spinner. Sempre exiba-o `document.querySelector('.loading-overlay').classList.add('active')` durante requisições Firebase para previnir duplo clique.
  - **Toasts**: A aplicação possui um sistema nativo de Toasts (canto superior direito). Use-o em vez de `alert()` do navegador.
- **Modais**: Modais devem seguir os estilos globais estabelecidos, com `max-width: 95%` para adaptação em telas pequenas.

## 🗄️ 3. Banco de Dados e Multi-Tenancy (CRÍTICO)
- **Firebase Realtime Database (RTDB)**: É a fonte principal.
- **Multi-Tenancy por Empresa**:
  - O sistema atende vários clientes. **TODA E QUALQUER GRAVAÇÃO OU LEITURA** não estruturada global DEVE respeitar o escopo da empresa.
  - A estrutura do Banco se baseia fortemente no nó `companies/$companyId/...` (veja `database.rules.json`).
  - Ao fazer queries no frontend, acesse o Tenant. Ex: `window.appTenantId`.
- **Regras de Segurança**:
  - Regras estritas em `database.rules.json`.
  - As gravações só são permitidas se `auth.token.companyId == $companyId` e se o usuário tiver `subscriptionStatus` habilitado (`active`, `trial_active`).

## ⚠️ 4. Cuidados com Ambiente de Produção
- **Dados Reais**: O sistema já está em uso em produção. Qualquer bug lançado altera as vendas ou estoque do cliente.
- **Processamento em Lote**: Ao criar scripts de correção/migração de dados, faça-os com cuidado (batches) para não travar conexões ou sobrecarregar a memória do browser.
- **Soft Delete vs Hard Delete**: Prefira implementar deleção lógica (status = 'cancelado' ou exclusão para 'lixeira') em informações transacionais de finanças e romaneios, evitando corrupção de relatórios.

## 🤝 5. Boas Práticas
1. Respeite as validações financeiras que refletem no `financas.js`.
2. Mantenha os Recibos em PDF de tamanhos fiéis ao formato A4 e com quebras de página contínuas adequadas (veja `print-styles.css`).
3. Use os utilitários de sistema (ex: `menu-component.js`) se precisar integrar ou ajustar o menu principal.

> Mantendo isto em mente para todas as solicitações, a integridade da plataforma nunca correrá risco.
