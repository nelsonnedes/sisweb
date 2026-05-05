# Design de Páginas — Manual/Ajuda com Busca + Alertas

## Diretrizes Globais (desktop-first)

### Layout

* Base: layout de aplicação com **Header fixo** (topo) + **conteúdo em coluna**.

* Estrutura: CSS Grid no container principal (header / main) e Flexbox dentro dos componentes.

* Largura: container central com max-width (ex.: 1200px) e padding lateral.

* Responsivo: desktop-first, com quebra para 2 colunas → 1 coluna no conteúdo do manual.

### Meta Information (padrão)

* Title template: "{Página} | Sisweb" (ajustar ao nome real do produto).

* Description: frase curta com propósito da página.

* Open Graph: title/description iguais ao meta; imagem padrão do sistema.

### Global Styles (tokens)

* Background: #F7F8FA

* Surface (cards/modais): #FFFFFF

* Texto primário: #111827

* Texto secundário: #6B7280

* Borda: #E5E7EB

* Primária: #2563EB (botões/links)

* Hover primária: #1D4ED8

* Alerta: info #2563EB, warning #F59E0B, error #EF4444, success #10B981

* Tipografia: base 14–16px; headings em escala (24/20/16).

* Botões: altura 36–40px; raio 8px; foco visível com outline.

* Links: sublinhado no hover; estado visitado opcional.

***

## Página: Manual/Ajuda (/ajuda)

### Meta

* Title: "Manual e Ajuda | Sisweb"

* Description: "Encontre instruções e passo a passo com imagens."

### Page Structure

* Layout em **duas colunas** no desktop:

  * Coluna esquerda: índice/categorias (fixa durante scroll do conteúdo, quando possível).

  * Coluna direita: busca + conteúdo.

### Seções & Componentes

1. Header da página

   * Título: "Manual e Ajuda"

   * Subtítulo curto opcional: "Pesquise por assunto ou navegue por tópicos"

2. Busca

   * Campo de busca com ícone (placeholder: "Buscar no manual…")

   * Ação: digitar filtra resultados; botão “Limpar” quando houver termo.

   * Resultado: lista abaixo do campo (dropdown) OU seção de resultados substituindo conteúdo.

3. Índice de tópicos (sidebar)

   * Lista por categoria (accordion) ou lista simples.

   * Item ativo destacado (cor primária + indicador lateral).

   * Contagem opcional por categoria (se disponível).

4. Conteúdo do tópico (main)

   * Título do tópico

   * Corpo com texto (markdown renderizado), listas e passos numerados.

   * Galeria de prints:

     * Imagens em coluna com largura controlada (ex.: 760px max).

     * Legenda/alt text obrigatório.

     * Clique para ampliar (lightbox simples) opcional, se já existir padrão no produto.

5. Estado vazio/erro

   * Sem resultados: mensagem "Nenhum resultado para ‘X’" + sugestões (ex.: tópicos populares).

### Interações

* Ao selecionar tópico: rolar para o topo do conteúdo; atualizar destaque no índice.

* Ao pesquisar: resultados clicáveis abrem tópico e destacam termo (se já suportado).

***

## Componente Global: Sininho / Alertas (todas as páginas)

### Localização e layout

* Ícone de sino no Header (lado direito), sempre visível.

* Badge/contador (círculo pequeno) quando existirem alertas não lidos.

### Comportamento

* Clique abre popover/dropdown ancorado ao ícone.

* Popover contém:

  * Cabeçalho: "Alertas" + ação "Ver todos" (se já existir página) ou apenas título.

  * Lista de itens: título + trecho + data/hora.

  * Estado vazio: "Você não tem alertas.".

* Fechamento: clicar fora, ESC, ou botão X.

### Estados

* Item não lido: fundo levemente destacado.

* Item lido: estilo neutro.

* Loading: skeleton (3 linhas) durante carregamento.

***

## Modal: Ajuda (atalho em todas as páginas)

### Estrutura

* Modal central com overlay.

* Tamanho desktop: 640–720px largura; altura máxima 80vh com scroll interno.

### Conteúdo

* Título: "Ajuda"

* Seção "Atalhos" (cards ou lista): tópicos principais.

* CTA principal: "Abrir Manual Completo" → /ajuda.

### Acessibilidade e interações

* Foco inicial no botão fechar ou no primeiro item interativo.

* ESC fecha; clique no overlay fecha.

* Scroll lock do body enquanto modal estiver aberto.

***

## Modal: Sobre (atalho em todas as páginas)

### Estrutura

* Modal central com overlay, mais compacto.

* Tamanho desktop: 520–640px.

### Conteúdo

* Nome do sistema

* Versão (se disponível)

* Texto curto de direitos autorais

* Contato/suporte (email/link)

### Acessibilidade e interações

* Mesmo padrão do Modal Ajuda (foco, ESC, overlay, scroll lock).

