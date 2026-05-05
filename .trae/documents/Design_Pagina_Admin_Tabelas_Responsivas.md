# Design de Página — Admin Unificado (Tabelas Responsivas)

## 1) Layout
- **Estratégia desktop-first**: manter a tabela completa e legível em >= 1024px; reduzir densidade e aplicar fallback em telas menores.
- **Sistema de layout**: container central (`.shell`) com largura máxima; seções em grid para cards e blocos de tabela empilhados.
- **Regra-chave**: *nunca* permitir que a tabela “empurre” a largura da página. O scroll horizontal (se necessário) deve acontecer **dentro** do container de tabela.

## 2) Meta information (SEO/Share)
- Title: "Admin Unificado - SISWEB"
- Description: "Painel administrativo com assinaturas, financeiro e auditorias."
- Open Graph: `og:title`, `og:description`, `og:type=website`.

## 3) Global styles (tokens e padrões)
- Background app: `#f5f7fb`
- Surface (panel): `#ffffff`, borda `#e2e8f0`
- Texto primário: `#0f172a`; texto secundário: `#64748b`
- Fonte: Arial/sans (já existente)
- Botões:
  - Default: borda `#cbd5e1`, hover com leve escurecimento do background
  - Primary: fundo `#0f172a`, texto branco
  - Focus: outline visível (ex.: 2px solid #2563eb)
- Links: `#2563eb`, underline no hover

## 4) Estrutura da página
- Header (título + meta)
- Tabs
- Panel (conteúdo da aba)
- Dentro de cada aba: filtros (quando existirem) + bloco(s) de tabela(s)

## 5) Componente “Tabela Responsiva” (padrão único para todas)

### 5.1 Container (table wrapper)
**Objetivo:** conter overflow e oferecer leitura/scroll previsível.
- Container deve:
  - Ter `overflow-x: auto` e `overflow-y: hidden`.
  - Ter `max-width: 100%`.
  - Preservar borda/raio e evitar corte de conteúdo.
  - Opcional: `-webkit-overflow-scrolling: touch` (suavidade em mobile).
- Indicador de scroll:
  - Quando a tabela exceder largura, exibir sombra/gradiente sutil nas bordas do container para sugerir rolagem.

### 5.2 Tabela (grid e sizing)
**Objetivo:** autoajustar colunas sem estourar a página.
- Regras gerais:
  - `width: 100%` e `table-layout: auto` (padrão) em desktop.
  - Usar `colgroup` ou classes por coluna para impor **min/max widths** por tipo.
- Tipos de coluna:
  - **curtas** (status, data, método, atraso): min baixa, max controlada, `white-space: nowrap`.
  - **longas** (email, detalhes, empresa/CNPJ): permitir wrap seletivo ou truncamento.
  - **ações**: largura mínima fixa, conteúdo alinhado à direita.

### 5.3 Conteúdo longo (wrap / ellipsis)
- Para colunas com identificadores longos (email, CNPJ, UID):
  - Preferir **truncamento** (ellipsis) em desktop quando a tabela estiver “apertada”.
  - Fornecer acesso ao conteúdo completo via `title` (tooltip nativo) ou expansão de linha.
- Para colunas descritivas (ex.: “Detalhes” em auditoria):
  - Permitir **quebra de linha** (wrap) e limitar a altura (ex.: 2–3 linhas) com “ver mais” (quando aplicável).

### 5.4 Responsividade por breakpoint
- **>= 1024px (desktop):**
  - Mostrar todas as colunas.
  - Truncar apenas quando necessário; manter densidade padrão.
- **768–1023px (tablet):**
  - Reduzir padding/fonte.
  - Permitir scroll horizontal no container quando houver muitas colunas.
- **< 768px (mobile):** escolher 1 dos padrões abaixo (padrão recomendado: A).
  - **A) Tabela com colunas priorizadas**
    - Colunas essenciais sempre visíveis (ex.: Usuário/Cliente, Status, Data/Evento, Ações).
    - Colunas de baixa prioridade são ocultadas.
    - Linha pode ter botão “Detalhes” para revelar o restante (área expansível abaixo da linha).
  - **B) Tabela “stacked” (linha vira cartão)**
    - Cada linha vira um bloco com pares “label: valor”.
    - Útil para tabelas muito largas (financeiro com 11 colunas).

### 5.5 Cabeçalho, alinhamento e leitura
- Cabeçalho:
  - Fundo neutro; texto com bom contraste.
  - Opcional: cabeçalho “sticky” dentro do container (melhora leitura em listas longas).
- Alinhamentos:
  - Números e valores: direita.
  - Datas: centro ou esquerda (consistente em todas as tabelas).
  - Ações: direita.

### 5.6 Estados (loading/empty/error)
- “Carregando…” e “Sem eventos…” devem:
  - Ficar dentro do container responsivo.
  - Ter `colspan` correto e não quebrar o layout.

## 6) Impressão (@media print)
**Objetivo:** impressão sem controles e com tabelas completas.
- Ao imprimir:
  - Ocultar: tabs, botões, filtros, ícones de ação não essenciais.
  - Forçar fundo branco e texto escuro.
  - Garantir que `thead` seja repetido: `thead { display: table-header-group; }`.
  - Evitar corte de linha: `tr { break-inside: avoid; page-break-inside: avoid; }`.
  - Evitar scroll/overflow no print: container deve permitir expandir em largura de página (ex.: remover sombras e permitir quebra controlada).
