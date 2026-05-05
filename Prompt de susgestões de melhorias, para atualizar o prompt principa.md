Excelente. Agora estamos entrando na parte mais sensível do sistema:
**refatoração estrutural de layout e navegação sem quebrar comportamento funcional existente.**

Vou estruturar isso como um **plano técnico cirúrgico**, porque aqui o risco de regressão é alto.

---

# 🎯 OBJETIVO

Reestruturar:

* Menu
* Sidebar
* Layout geral
* Responsividade PWA
* Navegação por teclado
* Persistência de foco
* Persistência de dados temporários

Sem:

* Perder links
* Quebrar rotas
* Alterar IDs de campos
* Quebrar Enter navigation
* Perder retorno de foco
* Perder estado ao adicionar itens

---

# 🔷 1️⃣ NOVA ARQUITETURA DE LAYOUT (SEM QUEBRAR O SISTEMA)

## 🔹 Estrutura Atual (Provável)

* Menu fixo
* Conteúdo renderizado direto
* Scripts atrelados ao DOM fixo
* IDs referenciados diretamente

Isso cria forte acoplamento.

---

## 🔹 Estrutura Nova Recomendada

Criar um **Layout Base Global Único**:

```html
<body>
  <div id="app-layout">

    <aside id="sidebar"></aside>

    <div id="main-wrapper">
        <header id="topbar"></header>
        <main id="page-content"></main>
    </div>

  </div>
</body>
```

⚠️ IMPORTANTE:
`#page-content` deve continuar contendo os mesmos IDs internos dos formulários atuais.

Nunca alterar IDs já utilizados no JS.

---

# 🔷 2️⃣ SIDEBAR RESPONSIVA (PC + PWA)

## 🖥️ Desktop

* Sidebar fixa à esquerda
* Colapsável
* Ícone + label
* Submenus expansíveis

## 📱 PWA

* Sidebar vira Drawer deslizante
* Ou Bottom Navigation para módulos principais
* Itens do menu preservados

---

# 🔹 Regra de Ouro

Não alterar URLs nem rotas atuais.

Se hoje você usa:

```
romaneio.html
admin.html
orcamento.html
```

Continuam iguais.

Só muda o container visual.

---

# 🔷 3️⃣ MIGRAÇÃO DO MENU SEM PERDER LINKS

Criar mapeamento central:

```js
const MENU_ROUTES = [
  { id: "dashboard", label: "Dashboard", path: "index.html", icon: "home" },
  { id: "romaneios", label: "Romaneios", path: "romaneio.html", icon: "file-text" },
  { id: "preromaneios", label: "Pré-Romaneios", path: "preromaneio.html", icon: "clock" },
  ...
];
```

A sidebar será gerada dinamicamente.

Isso evita:

* Links quebrados
* Duplicações
* Inconsistências

---

# 🔷 4️⃣ PRESERVAÇÃO TOTAL DA NAVEGAÇÃO COM ENTER

Aqui está o ponto crítico.

Hoje você provavelmente tem algo como:

```js
input.addEventListener("keydown", e => {
  if (e.key === "Enter") {
     proximoCampo.focus();
  }
});
```

Se mudar layout, isso pode quebrar.

---

## 🔹 Solução Definitiva: Sistema Global de Navegação por Ordem

Criar atributo padrão:

```html
<input data-nav-order="1">
<input data-nav-order="2">
<input data-nav-order="3">
```

Sistema global:

```js
function setupFormNavigation(form) {
  const inputs = [...form.querySelectorAll("[data-nav-order]")];
  inputs.sort((a,b)=>a.dataset.navOrder - b.dataset.navOrder);

  inputs.forEach((input, index) => {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        inputs[index + 1]?.focus();
      }
    });
  });
}
```

Isso:

✔ Padroniza
✔ Não depende da posição no DOM
✔ Funciona mesmo se layout mudar

---

# 🔷 5️⃣ RETORNO DE FOCO AO ADICIONAR ITEM

Hoje você deve ter algo como:

```js
adicionarItem();
campoEspessura.focus();
```

Isso pode quebrar se re-renderizar tabela.

---

## 🔹 Solução robusta

Criar função padrão:

```js
function restoreFocus(selector) {
  requestAnimationFrame(() => {
    document.querySelector(selector)?.focus();
  });
}
```

Sempre usar isso após:

* Adicionar item
* Re-renderizar lista
* Salvar formulário

---

# 🔷 6️⃣ PERSISTÊNCIA DE DADOS TEMPORÁRIOS

Problema comum:

* Layout muda
* DOM é reconstruído
* Dados temporários somem

---

## 🔹 Solução definitiva: Estado central

```js
const FormState = {
  romaneioAtual: {},
  itensTemporarios: []
};
```

Renderiza sempre a partir do estado.

Nunca confiar apenas no DOM.

---

# 🔷 7️⃣ PADRONIZAÇÃO PARA FORMULÁRIOS FUTUROS

Todos os novos forms devem seguir:

✔ data-nav-order
✔ restoreFocus
✔ estado central
✔ validação padronizada
✔ botões fixos no mobile
✔ grid responsivo

---

# 🔷 8️⃣ LAYOUT RESPONSIVO SEM QUEBRAR ORDEM DE CAMPOS

⚠️ Nunca usar:

```css
flex-direction: column-reverse;
order: X;
```

Isso quebra lógica de navegação.

---

## 🔹 Usar apenas grid adaptativo

Desktop:

```css
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}
```

Mobile:

```css
@media(max-width:768px){
  .form-grid {
    grid-template-columns: 1fr;
  }
}
```

Ordem permanece intacta.

---

# 🔷 9️⃣ ESTRUTURA DE SIDEBAR IDEAL

## Desktop

```
| Logo |
| Dashboard |
| Vendas ▾
|   - Novo Pedido
|   - Orçamentos
| Produção ▾
|   - Romaneios
|   - Pré-Romaneios
| Financeiro |
| RH |
| Admin |
```

---

## PWA

Bottom Navigation com:

* Dashboard
* Vendas
* Produção
* Financeiro
* Menu

Submenus via drawer.

---

# 🔷 🔟 EVITAR QUEBRA DE RELATÓRIOS DE IMPRESSÃO

Separar totalmente:

```css
@media print {
  /* layout impressão */
}
```

Sidebar e topbar devem ser ocultadas no print.

---

# 🔷 1️⃣1️⃣ PLANO DE MIGRAÇÃO SEM RISCO

## Fase 1

Criar novo layout-base.html

## Fase 2

Migrar uma página piloto (ex: clientes)

## Fase 3

Testar:

* Enter
* Foco
* Persistência
* Adicionar item
* Impressão

## Fase 4

Migrar romaneio

## Fase 5

Migrar folha pagamento

---

# 🔷 1️⃣2️⃣ CHECKLIST DE NÃO REGRESSÃO

Antes de finalizar cada módulo:

* [ ] Enter funciona?
* [ ] Foco retorna corretamente?
* [ ] Dados não somem ao adicionar?
* [ ] Sidebar não interfere?
* [ ] Mobile não quebra layout?
* [ ] Impressão preservada?
* [ ] IDs mantidos?
* [ ] JS antigo ainda encontra elementos?

---

# 🔷 RESULTADO FINAL

Você terá:

✔ Sidebar profissional PC
✔ Drawer PWA elegante
✔ Nenhum link perdido
✔ Nenhum campo fora da visão
✔ Navegação por Enter padronizada
✔ Foco restaurado corretamente
✔ Persistência de dados temporários
✔ Base pronta para crescimento
✔ Sem regressões

---

# 🔥 Próximo passo estratégico

Agora o ideal é:

1. Projetar o Layout Base definitivo (HTML + CSS estrutural)
2. Projetar o Sistema Global de Navegação e Foco
3. Criar plano de migração módulo por módulo
4. Criar arquitetura final combinando tudo (multi-tenant + backend + PWA + layout)

Qual você quer que eu construa primeiro de forma técnica detalhada?
