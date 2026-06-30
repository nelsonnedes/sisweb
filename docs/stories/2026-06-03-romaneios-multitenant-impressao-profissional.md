# Story: Romaneios Multitenant e Impressao Profissional

Data: 2026-06-03

## Objetivo

Padronizar os carregamentos, listas e impressoes de romaneios PCT, TL, PES e Tora considerando somente dados de negocio em `companies/{companyId}`, preservando o isolamento multitenant, os dados reais de producao e os fluxos existentes.

## Escopo

- Caminhos canonicos de romaneios por empresa: `romaneios/pct`, `romaneios/tl`, `romaneios/pes` e `romaneios/tora`.
- Filtro de registros tecnicos como `_metadata` antes de montar selects, listas e impressoes.
- Ordenacao dos romaneios mais recentes no topo.
- Normalizacao dos modos de impressao: completo, sem preco unitario e sem preco.
- Cabecalho, resumos por dimensoes e resumo CONAMA em PCT, TL e PES.
- Legenda operacional no romaneio TL.
- Compatibilidade com Estoque, Pre-romaneio, Compras e Vendas sem alterar dados gravados.

## Decisoes

- Usar apenas dados de negocio dentro de `companies/{companyId}`.
- Nao buscar dados globais/raiz como fonte principal.
- Nao gravar nem migrar dados durante impressao.
- Tratar caminhos legados apenas como compatibilidade quando o servico ja fizer isso, nunca como destino de novas regras.
- Filtrar objetos de metadados e registros sem romaneio valido antes de ordenar.
- Preservar nomes globais existentes por compatibilidade, evitando novas colisoes.
- Persistir preferencias de colunas de impressao apenas em `companies/{companyId}/configuracoes/romaneioPrintColumns/{tipo}`.
- Usar cache local somente tenantizado e como apoio, nunca como fonte compartilhada entre empresas.
- Aplicar configuracao de colunas no documento de impressao ja gerado, para preservar calculos, resumos e layouts existentes.
- Limitar colunas configuraveis de TL/PCT/PES a: Qtd., Pes, m3, m2, ml, Preco/m3 e Valor.
- Limitar colunas configuraveis de Tora a: Rodo, Comp., Oco 1, Oco 2, m3 Bruto, m3 Desc., m3 Liq., Comp. Geo., X1, X2, X3, X4, V. Geo., Dif. %, Preco e Valor.

## Checklist

- [x] Mapear pontos ativos de carregamento/listagem.
- [x] Criar helpers de romaneio para caminho canonico, validade de registro, recencia e modo de impressao.
- [x] Aplicar filtros e ordenacao em Estoque.
- [x] Aplicar filtros e ordenacao nas listas/modais PCT, TL, PES e Tora.
- [x] Padronizar resumos CONAMA por categoria e especie.
- [x] Padronizar resumo por dimensoes com metros lineares.
- [x] Adicionar legenda TL.
- [x] Validar os tres modos de impressao em sintaxe/fluxo de geracao.
- [x] Remover fontes ativas de aliases legados em Vendas, Compras e Financas.
- [x] Bloquear fallback local/usuario para dados de negocio nos adapters de Tora.
- [x] Bloquear rotinas antigas de utilitarios que sincronizavam aliases de romaneios.
- [x] Normalizar pre-romaneios por ID, por tipo e registros achatados em `companies/{companyId}/preromaneios`.
- [x] Preservar metadados de criacao e gravar `updatedAt`/`atualizadoEm` ao editar pre-romaneios.
- [x] Padronizar botao `Limpar` em PCT, TL, PES e Tora para limpar pre-romaneio, selecoes e itens da tabela.
- [x] Isolar a secao CONAMA em pagina propria nas impressoes TL, PCT e PES em retrato e paisagem.
- [x] Atualizar impressao de Tora com Custodia e campos geometricos ja usados no modulo.
- [x] Trocar dropdown de impressao TL para menu flutuante externo, acima dos modais e botoes de fechar.
- [x] Tornar o clique das opcoes de impressao TL independente de onclick clonado no menu flutuante.
- [x] Padronizar titulos finais das impressoes TL/PCT com PES: Qtd., Pes, m3, m2, ml, Preco/m3 e Valor.
- [x] Suavizar bordas e intensidade visual das tabelas de impressao TL/PCT para combinar com PES.
- [x] Ajustar PCT em modo retrato para reduzir overflow em celulas largas.
- [x] Reestruturar CSS do modal Lista de Romaneios PES para evitar topo desalinhado e scroll duplo.
- [x] Forcar paginas de continuacao TL/PCT a iniciarem em nova pagina em retrato e paisagem.
- [x] Validar sintaxe JS.
- [x] Rodar gates do projeto: lint, typecheck e test.
- [x] Fazer deploy e testar no sistema online logado.
- [x] Criar configurador unico de colunas impressas para TL, PCT, PES e Tora.
- [x] Adicionar botao `Configurar Impressao` nos modais `Lista de Romaneios`.
- [x] Persistir configuracao por empresa ativa no Firebase tenant-aware.
- [x] Aplicar colunas selecionadas aos tres modos de impressao sem desalinhar totais/cabecalhos.
- [x] Ajustar `Resumo das Toras por Especies` para exibir somente Especie, Quantidade, m3 Liq. e V. Geo.
- [x] Incluir coluna `Dif. %` na impressao de Tora, comparando V. Geo. contra m3 Bruto.
- [x] Incluir `Dif. %` tambem no `Resumo das Toras por Especies`.

## Arquivos Previstos

- `romaneio-table-enhancements.js`
- `romaneio-print-config.js`
- `estoque.js`
- `pre-romaneio-selector.js`
- `preromaneio-modals.js`
- `preromaneio.js`
- `modules/modals/modal-lista-romaneios.js`
- `modules/modals/modal-clientes.js`
- `modules/romaneiopct/modal-lista-romaneios-pct.js`
- `modules/romaneiopct/carregar-romaneio-pct.js`
- `modules/reports/imprimir-romaneio.js`
- `modules/romaneiopct/imprimir-romaneio-pct.js`
- `modules/romaneio/salvar-romaneio.js`
- `romaneiopes.html`
- `romaneiotl.html`
- `romaneiotora.js`
- `romaneiotora.html`
- `romaneiotora_modais.js`
- `romaneio-manager.js`
- `firebaseService.unified.js`
- `src/services/databaseAdapter.js`
- `vendas.js`
- `compras.js`
- `financas.js`
- `auto_sync_firebase.html`
- `extrator_dados_dashboard.html`
- `corrigir_romaneios.html`
- `sincronizar.html`

## Validacoes Locais

- `node --check` nos arquivos JS alterados.
- Checagem sintatica dos scripts inline normais em `estoque.html`, `romaneiopct.html`, `romaneiopes.html`, `romaneiotl.html` e `romaneiotora.html`.
- `npm run lint`
- `npm run typecheck`
- `npm test`
