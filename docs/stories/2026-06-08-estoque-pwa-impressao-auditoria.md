# Story: Estoque - Impressao PWA e desktop separadas

## Contexto

O usuario pediu aplicar em `estoque.html` os mesmos aprendizados das correcoes de Vendas e Compras: botoes de impressao devem separar comportamento PWA/mobile do comportamento desktop, analisando abas, botoes e modais do estoque com foco em confiabilidade.

## Analise

- [x] Mapear padrao aplicado em Vendas/Compras para PWA versus desktop.
- [x] Auditar abas, botoes e modais de `estoque.html`.
- [x] Carregar helper compartilhado de impressao/PDF no estoque.
- [x] Implementar PDF compartilhavel/download para PWA nos botoes de impressao do estoque.
- [x] Preservar preview/impressao HTML no desktop.
- [x] Validar por testes focados e gates do projeto.

## Criterios de aceite

- [x] Almoxarifado, Consulta de Toras, Movimentacoes, Relatorios e Rastreabilidade usam PDF no PWA/mobile.
- [x] Desktop preserva preview/HTML print com cabecalho profissional.
- [x] Botao Imprimir do modal de preview nao tenta `iframe.print()` em contexto PWA.
- [x] Logo da empresa segue o helper compartilhado: HTML desktop recebe URL renderizavel a partir de `logoStoragePath`; PDF resolve DataURL pelo fluxo seguro ja usado em Vendas/Compras.
- [x] Ajuste nao altera calculos, saldos, baixa, entrada, saida ou filtros de estoque.
- [x] Story tem checklist e File list atualizados.

## Validacoes obrigatorias

- Seguranca e Performance: aprovado. PWA usa `SiswebCommercePdf` com jsPDF local, entrega por Web Share/download e resolucao tenant-scoped da logo; desktop nao faz XHR/DataURL da logo e nao altera escrita/leitura de estoque.
- Responsividade e Padronizacao: aprovado. Os botoes de impressao de Almoxarifado, Consulta, Movimentacoes, Relatorios e Rastreabilidade usam decisao comum PWA versus desktop, preservando preview HTML no PC.
- Conformidade Legal: aprovado. Mudanca restrita a apresentacao/impressao/PDF de relatorios; sem alteracao em calculos, saldos, baixas, entradas, saidas, precos ou regras fiscais.

## File list

- `docs/stories/2026-06-08-estoque-pwa-impressao-auditoria.md`
- `commerce-pdf-share.js`
- `estoque.html`
- `estoque.js`
- `menu-component.js`
- `sw.js`
- `tests/estoque-pwa-impressao.test.mjs`
- `tests/pwa-install-icon.test.mjs`
- `tests/pwa-mobile-menu-session.test.mjs`
- `tests/qa-visual-pwa-routes.test.mjs`

## Evidencias

- Auditoria: botoes de impressao encontrados em Almoxarifado, Consulta, Movimentacoes, Relatorios, modal Rastreabilidade e modal Preview; Entrada/Saida tinham acoes operacionais sem impressao propria.
- `estoque.html` passa a carregar `commerce-pdf-share.js?v=2026-06-08-estoque-print-pwa-v1`, `estoque_produtos.js?v=2026-06-08-estoque-print-pwa-v1` e `estoque.js?v=2026-06-08-estoque-print-pwa-v1`.
- `estoque.js` centraliza decisao em `isEstoquePwaPrintContext()`, `entregarRelatorioEstoque()` e `exportarTabelaEstoquePdf()`.
- `commerce-pdf-share.js` expoe `createTableReportPdf()` e `exportTableReportPdf()` reaproveitando jsPDF local, Web Share/download e resolucao segura de logo.
- Correcao complementar: `estoque.js` prepara a logo multitenant antes do cabecalho, convertendo `companies/{tenant}/profile/logo/...` em URL de download e usando DataURL tenant-scoped como fallback quando a URL nao estiver disponivel.
- Correcao complementar backend: `functions/index.js` inicializa o Admin SDK com bucket de Storage explicito para a callable `getCompanyLogoDataUrl`, evitando erro `internal` quando o PDF/PWA precisa converter a logo do tenant para DataURL.
- Chrome externo autenticado em `https://sisweb-7ce82.web.app/estoque.html`: tenant `1749492103278` carregou `companies/1749492103278/profile/logo/1779188923523_Logo_JN.png`; preview desktop exibiu `<img>` no iframe com URL do Firebase Storage e sem `src="companies/..."`. Antes do deploy da Function corrigida, a callable publicada ainda retornava `internal` para DataURL do PDF/PWA.
- Testes focados de impressao/logo: `node --test tests\company-logo-storage-policy.test.mjs tests\estoque-pwa-impressao.test.mjs tests\commerce-responsive-pwa.test.mjs` => 26/26.
- Gates obrigatorios: `npm run lint`, `npm run typecheck`, `npm test` aprovados; suite completa com 114/114 testes.
- Browser local: `http://127.0.0.1:8781/estoque.html?noRedirect=true&verify=estoque-print-pwa-v1` carregou `commerce-pdf-share.js?v=2026-06-08-estoque-print-pwa-v1` e `estoque.js?v=2026-06-08-estoque-print-pwa-v1`; console sem erro de script, apenas avisos esperados de auth/dados no ambiente local sem sessao.
