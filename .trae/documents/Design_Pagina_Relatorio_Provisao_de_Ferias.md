# Design de Página — Relatório “Provisão de Férias” (folha.html)

## Diretrizes gerais (desktop-first)

### Layout
- Base: CSS Grid para estrutura de página + Flexbox para alinhamentos locais.
- Largura: container central com largura máxima (ex.: 1200–1400px) e padding lateral consistente.
- Responsivo: reduzir espaçamentos e permitir rolagem horizontal da tabela em breakpoints menores (sem quebrar células).

### Meta Information
- Title: “Provisão de Férias — Relatório”
- Description: “Relatório de provisão de férias com tabela e totalizações, otimizado para impressão em retrato e paisagem.”
- Open Graph: título e descrição equivalentes; tipo “website”.

### Global Styles (tokens)
- Background: #F6F7F9 (tela) / branco (impressão).
- Texto: #111827 (primário), #4B5563 (secundário).
- Tipografia: base 14–16px; títulos 20–24px; subtítulos 16–18px.
- Fonte recomendada: system-ui (fallback seguro para impressão).
- Bordas: #E5E7EB; cantos 6px (tela).
- Botões (apenas tela):
  - Primário: fundo #111827, texto branco; hover #0B1220.
  - Secundário: fundo branco, borda #D1D5DB; hover #F3F4F6.
- Links (se existirem): #2563EB; hover sublinhado.

## Estrutura da página
Padrão em seções empilhadas:
1. Barra superior (ações)
2. Cabeçalho do relatório
3. Conteúdo principal (tabela)
4. Rodapé do relatório (totalizações/observações)

## Seções & Componentes

### 1) Barra superior (somente tela)
- Posição: topo do container.
- Componentes:
  - Grupo “Impressão”: seletor de orientação (Retrato/Paisagem) + botão “Imprimir”.
  - Indicador de modo: label discreto “Visualização” / “Impressão” (quando aplicável).
- Comportamento:
  - O seletor de orientação aplica uma classe no root (ex.: `.print-portrait` / `.print-landscape`) para refletir regras de `@page`.

### 2) Cabeçalho do relatório
- Estrutura (Grid 2 colunas no desktop):
  - Esquerda: Título “Provisão de Férias” + subtítulo (empresa/unidade, se exibido).
  - Direita: metadados (período de referência, data/hora de emissão), alinhados à direita.
- Estilo:
  - Título com peso 600–700.
  - Metadados em texto secundário.
- Impressão:
  - Cabeçalho sempre visível no topo da primeira página; evitar quebras internas do bloco.

### 3) Tabela do relatório
- Objetivo: máxima legibilidade e consistência em tela e impressão.

#### 3.1 Container da tabela
- Tela:
  - Wrapper com `overflow-x: auto;` e sombra/borda sutil.
  - Evitar “quebra” de layout: `table-layout: fixed;` quando apropriado + colgroup para larguras previsíveis.
- Impressão:
  - Remover overflow e sombras; expandir para 100%.

#### 3.2 Cabeçalho da tabela
- Requisitos:
  - Repetir cabeçalho em todas as páginas: usar `thead` corretamente e estilo de impressão compatível.
  - Fundo cinza claro na tela; na impressão, manter contraste (cinza bem claro ou apenas borda).

#### 3.3 Linhas e células
- Alinhamento:
  - Texto à esquerda, números/moedas à direita.
- Não quebrar linhas críticas:
  - Priorizar `white-space: nowrap;` em colunas de códigos/valores.
  - Permitir quebra controlada apenas em colunas descritivas longas (quando existir), sem quebrar números.
- Evitar quebra de linha entre páginas:
  - Aplicar regra de impressão para impedir divisão de uma linha em páginas (ex.: evitar `page-break-inside` no row).

### 4) Rodapé / Totalizações
- Estrutura:
  - Bloco de resumo (ex.: “Totais”) em cards ou tabela pequena, alinhada à direita.
  - Área opcional para observações/legendas.
- Impressão:
  - Garantir que o bloco de totais não seja cortado (evitar quebra interna).

## Regras de impressão (retratro e paisagem)
- `@media print`:
  - Ocultar barra superior e qualquer elemento de navegação/ação.
  - Padronizar margens e densidade (font-size pode reduzir levemente para caber mais colunas sem cortar).
  - Garantir contraste (evitar cores muito claras que somem na impressora).
- `@page`:
  - Definir `size` de acordo com orientação selecionada (Retrato/Paisagem).
- Quebras:
  - Manter a integridade de blocos do cabeçalho e do resumo.
  - Repetir `thead` e evitar que `tr` seja dividido.

## Estados e interações
- Tela:
  - Hover sutil em linhas (ajuda leitura), sem afetar impressão.
  - Botões com estados hover/focus visíveis (acessibilidade).
- Impressão:
  - Remover hovers/sombras; priorizar bordas e espaçamento consistente.
