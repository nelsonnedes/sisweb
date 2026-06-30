# Story: Primeira leva global Sisweb

## Contexto

A auditoria global identificou riscos e inconsistencias fora de um unico modulo: paginas tecnicas publicadas, suporte espalhado, menu mobile sem atalhos de ajuda/suporte e footer global com texto duplicado.

## Problema

O Sisweb precisa separar melhor operacao de tenant, backoffice Super Admin e ferramentas internas. Tambem precisa oferecer um contato de suporte mais profissional, com contexto multi-tenant, sem depender de links soltos ou dados hardcoded espalhados.

## Objetivo

Aplicar a primeira leva de melhorias globais de baixo risco: blindagem de deploy, centralizacao inicial de suporte, atalhos mobile e regressao automatizada.

## Acceptance Criteria

- [x] Firebase Hosting ignora paginas de correcao, migracao, reset, teste e backups que nao devem ser publicadas.
- [x] Menu global possui entrada de Suporte separada de Sobre/Ajuda.
- [x] Sidebar mobile exibe atalhos diretos para Ajuda, Suporte, Assinatura e Sair quando aplicavel.
- [x] Rodape global abre a central de suporte e nao duplica "Sistema de Sistema...".
- [x] Central de suporte inclui modulo, URL, usuario e companyId/tenantId quando disponiveis.
- [x] Testes de regressao cobrem ignore de deploy, menu mobile, footer e suporte.
- [x] Quality gates executados.

## Tasks

- [x] Atualizar ignore de deploy para ferramentas internas.
- [x] Implementar modal central de suporte no menu global.
- [x] Ajustar links do menu desktop/mobile e rodape.
- [x] Adicionar testes de regressao.
- [x] Rodar quality gates.

## File List

- `docs/stories/2026-06-06-primeira-leva-global-sisweb.md`
- `firebase.json`
- `menu-component.js`
- `tests/global-first-wave.test.mjs`

## QA Notes

- `node --check menu-component.js`
- Validacao JSON de `firebase.json`
- `node --test tests/global-first-wave.test.mjs`
- Browser local em `http://127.0.0.1:8765/ajuda.html`: menu de Configuracoes exibe Ajuda/Suporte/Sobre; Suporte abre modal com modulo, URL, tenant/empresa, usuario e acoes WhatsApp/E-mail/Copiar.
- Browser local em viewport 390x844: menu mobile exibe Ajuda, Suporte, Assinatura e Sair.
- `npm run lint`
- `npm run typecheck`
- `npm test` (59 testes)
