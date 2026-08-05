# Busca de Toras e Romaneio Vinculado no Estoque

## Objetivo

Padronizar a localização de toras em todas as telas do módulo `estoque.html` e tornar a coluna **Romaneio Vinculado** informativa, sem criar novas consultas por linha, caminhos no Firebase ou regras de backend.

## Escopo

A alteração cobre somente o módulo `estoque.html`:

- Consulta de estoque;
- Baixa Individual;
- modal **Selecionar Toras para Baixa** da Baixa por Lote;
- Histórico de Movimentações;
- Rastreabilidade.

As páginas independentes de romaneio, como `romaneiotora.html`, não fazem parte deste lote.

## Busca Padronizada

Uma única função normalizará termos e valores removendo espaços excedentes, diferenças entre maiúsculas e minúsculas e acentos. A busca textual de tora considerará:

- `plaqueta`;
- `descricao`, `descricaoTora` e campos equivalentes já presentes no registro;
- `especie` como descrição operacional da tora;
- `custodia`, obtida por `normalizarCamposGeoEstoque`;
- localização, quando a tela já pesquisar esse campo.

O mecanismo será aplicado aos filtros já existentes. Não serão criados vários campos separados para Plaqueta, Descrição e Custódia.

### Comportamento por Tela

- **Consulta:** o campo `searchEstoque` pesquisa Plaqueta, Descrição/Espécie, Custódia e Localização.
- **Baixa Individual:** `saidaPlaquetaBusca` passa a ser uma busca geral de toras disponíveis e mantém a priorização de correspondência exata por plaqueta.
- **Baixa por Lote:** o filtro principal do modal pesquisa Espécie/Descrição, Plaqueta e Custódia, preservando os filtros numéricos de rodo e comprimento.
- **Movimentações:** um campo textual de tora pesquisa Plaqueta, Descrição/Espécie e Custódia, sem substituir os filtros de tipo, período, remessa e romaneio.
- **Rastreabilidade:** o filtro atualmente identificado como Plaqueta pesquisa Plaqueta, Descrição/Espécie e Custódia, mantendo compatibilidade com os demais filtros.

## Romaneio Vinculado

Cada romaneio estruturado de `mov.romaneiosRelacionados` será normalizado pelas funções já existentes `normalizarRomaneiosRastreabilidade` e `resumirRomaneiosRastreabilidade`.

A apresentação por vínculo seguirá o formato:

`Romaneio 000123 - Cliente/Fornecedor - 12,345 m³`

Quando houver mais de um vínculo, cada romaneio será exibido em uma linha compacta na mesma célula. O conteúdo textual completo ficará disponível para busca e impressão.

Registros legados sem `romaneiosRelacionados` estruturado continuarão exibindo `observacoes`. Valores ausentes usarão os fallbacks `Sem número`, `Não informado` e `0,000 m³`, sem bloquear a tabela.

## Arquitetura

As mudanças permanecerão em `estoque.js` e `estoque.html`:

- um normalizador textual compartilhado;
- um agregador de texto pesquisável para toras e movimentações;
- um formatador de Romaneio Vinculado apoiado nos normalizadores existentes;
- pequenos ajustes de rótulos, placeholders e no filtro de Movimentações.

Nenhuma biblioteca, endpoint, índice, Cloud Function ou regra Firebase será adicionada. Todos os filtros continuarão locais sobre os dados já carregados para o tenant ativo.

## Segurança e Multitenancy

- Nenhuma leitura será feita fora dos dados já carregados pelo contexto tenant-scoped.
- Conteúdo renderizado continuará passando por `escapeHtml`.
- O enriquecimento do romaneio não fará busca individual por ID durante a renderização.
- Registros sem estrutura válida usarão somente texto legado já disponível.

## Responsividade e Acessibilidade

- Rótulos e placeholders indicarão os campos pesquisáveis sem criar controles redundantes.
- A célula de Romaneio Vinculado poderá quebrar linha e não aumentará a largura mínima da tabela.
- O texto será legível em cards móveis e manterá conteúdo equivalente na impressão.

## Testes e Aceite

- Testes estáticos verificarão a presença do normalizador compartilhado e sua reutilização nas cinco telas.
- Testes cobrirão busca sem distinção de acento/caixa para Plaqueta, Descrição/Espécie e Custódia.
- Testes validarão o formato Número + Cliente/Fornecedor + Volume e o fallback legado.
- Smoke local autenticado validará Consulta, Baixa Individual, Baixa por Lote, Movimentações e Rastreabilidade.
- Os gates `node --check`, testes focados, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build:hosting` e `git diff --check` devem passar antes da publicação.
- A publicação será feita somente após os gates, seguida de smoke no Hosting do tenant de teste.

