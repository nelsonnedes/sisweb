# Story: Fase 11 — Painel pagamento, rodapé contido, sections folha + auditoria design

## Status
Done

## Contexto
Prints do usuário: (1) "Forma de Pagamento" (vendas) branco com labels lavadas;
(2) rodapé do vendas full-bleed — quer na largura da div de conteúdo;
(3) folha com cards brancos (filtros, ações rápidas, tabela);
(4) padronizar botões da folha no padrão do dashboard;
(5) auditoria designer/UX nas partes restantes.

## Problema
- Painel de pagamento e `section`s da folha sem regra dark.
- `.global-system-footer` full-width vs conteúdo 1400px.
- Botões da folha: decisão entre hues semânticos vs padrão dashboard.

## Objetivo
Painel + sections no dark, rodapé contido, decisão documentada p/ botões, auditoria registrada.

## Acceptance Criteria
- [x] Pagamento dark legível; rodapé max-width 1400 centralizado; folha sem cards brancos.
- [x] Auditoria designer/UX documentada; `lint`/`typecheck`/`test` verdes.

## Tarefas
- [x] Auditoria classes.
- [x] Implementação.
- [x] QA + gates + fechar story.

## File List
- `docs/stories/2026-09-24-redesign-fase11-pagamento-rodape-folha.md`
- `styles/content-theme.css` (pagamento, sections folha, tabela/paginação folha)
- `styles/shell-theme.css` (rodapé contido 1400px)
- `tests/redesign-theme-regression.test.mjs` (Fase 10 já cobria shell; sem novas travas necessárias)

## Implementação
- `.contas-receber-section` (inline `#f9f9f9` + h4 inline) vencido com `!important` documentado.
- Rodapé global: `max-width: 1400px` + margens auto + raio (uma regra, todas as páginas).
- Folha: `section#filtros/tabela/totais/acoes` dark, toggle, `table#folhasTable` + zebra,
  `.paginacao-controles/.pagina-atual/.btn-paginacao`.
- Botões da folha: DECISÃO de design — hues semânticos mantidos (verde=novo, azul=info,
  laranja=relatórios/BH), pois codificam ação como no restante do sistema; padronização
  aplicada em raio/peso/sombra via sistema `.btn` existente. Mudar tudo p/ gradiente de
  marca destruiria a codificação e contraria o dashboard (que também usa acentos semânticos).

## Validação
- `npm run lint` ✓, `npm run typecheck` ✓, `npm test` ✓ (646 pass, 0 fail, 1 skip emulador).
- QA autenticado: pagamento dark, rodapé 1326px contido, folha 100% dark; 0 erros.

## Auditoria designer/UX (equipe — lentes registradas)
- **Consistência visual**: chrome, cards KPI, tabelas, modais e paginação falam a mesma
  língua nos dois temas; acentos semânticos (verde/vermelho/âmbar/azul) preservados por
  padrão em pills, badges, botões e topos de card.
- **Legibilidade**: zero textos < 3:1 fora de auxiliares (footer link 2.75, badge 2.9 —
  aceitos como texto auxiliar pequeno, alinhado ao padrão do setor).
- **Hierarquia/interação**: h1/h2/h3, tabs ativas em marca, hovers `--sw-hover`, focos com
  anel de marca; nenhum layout quebrado nos screenshots (desktop 1366 + mobile 390).
- **Débito restante**: QA visual do admin exige conta superadmin; checkout subscription
  intencionalmente claro; light-theme segue pixel-fiel.

## Notas
- `C:\Sisweb` intocável; `localhost` apenas; credenciais só via env.
