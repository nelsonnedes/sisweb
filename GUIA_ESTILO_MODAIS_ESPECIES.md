# Guia de Estilo – Modais de Espécies

Este guia documenta a padronização visual e técnica dos modais de espécies em todas as páginas do sistema (TL, Tora, PCT e species.html).

## Objetivos
- Unificar estrutura de colunas (Nome, Descrição, Ações).
- Padronizar ícones e área clicável em “Ações”.
- Manter esquema de cores consistente com a identidade visual.
- Garantir responsividade e legibilidade em diferentes tamanhos de tela.

## Especificações Técnicas

### Estrutura da Tabela
- `table-layout: fixed; width: 100%` para respeitar proporções definidas.
- Colunas e proporções (desktop):
  - Nome: 40%.
  - Descrição: `calc(60% - 120px)`.
  - Ações: 120px (fixo, centralizado, `min/max-width`).
- Breakpoints:
  - ≤992px (tablet): Nome 45%, Descrição `calc(55% - 100px)`, Ações 100px; ícones 26px.
  - ≤768px (mobile): Nome 50%, Descrição `calc(50% - 90px)`, Ações 90px; ícones 24px.
- Truncamento e legibilidade: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` em `th/td`.
  - Mobile (≤768px): a coluna Descrição permite quebra de linha para evitar truncamento (`white-space: normal; overflow-wrap: anywhere; word-break: break-word;`), mantendo o cabeçalho sem quebra.

### Ícones de Ação
- Container `.action-buttons-container`: `display: flex; align-items: center; justify-content: center; gap: 6px`.
- Botões `.species-action-btn`: `display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; padding: 0`.
- Tamanhos por breakpoint: 28px (desktop), 26px (tablet), 24px (mobile).
- Cores e hover: mantidas de `species-manager.js` (azul padrão), com alinhamento e tamanho padronizados via `romaneio-comum.css`.

### Cabeçalho do Modal
- Gradiente: `linear-gradient(135deg, #2c3e50 0%, #34495e 100%)`.
- Título: branco, bold, com leve `text-shadow`.
- Close (X): branco; hover cinza claro.
- Padding e margens: `padding: 15px 20px; margin: -20px -20px 20px -20px` com `border-radius: 8px 8px 0 0`.

### Corpo e Rolagem
- `modal-body`: `max-height: 350px; overflow-y: auto` para permitir cabeçalho sticky da tabela.
- `table-container`: `overflow: visible` (evita scroll duplo).

### Rodapé e Botões
- Footer: `display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid #eee`.
- Botão "Fechar": fundo `#2c3e50`, hover `#34495e`.
- Botão "Mostrar Todas": fundo `#17a2b8`, hover `#138496`.
- Botão "Nova Espécie": fundo `#27ae60`, hover `#219a52`.

## Compatibilidade e Prioridade de Estilos
- Regras específicas começam com `#speciesListModal ...` para maior especificidade e isolamento.
- `species-manager.js` injeta CSS com `!important`. As regras deste guia usam `!important` somente quando necessário para garantir padronização sem afetar outras tabelas.
- Evite estilos inline nos `th/td` da tabela do modal.

## Manutenção
- Ajustes de proporção: edite o bloco do `romaneio-comum.css` sob `#speciesListModal` e media queries.
- Ícones: mantenha `.species-action-btn` e `.action-buttons-container` como base; modifique tamanhos apenas via media queries do comum.
- Consistência de cores: reusar as cores definidas aqui para novos botões relacionados.

## Testes Recomendados
- Teste em desktop, tablet e mobile.
- Verifique truncamento e legibilidade em nomes/descrições extensas.
- Clique nos ícones de ação e confirme área clicável e alinhamento.
- Role a lista e confirme que o cabeçalho da tabela permanece visível.