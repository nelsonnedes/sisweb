# Story: Admin - Assinaturas, Empresas Legadas e Plano de Campanhas

## Objetivo

Melhorar a confiabilidade dos dados exibidos em `admin.html`, especialmente na aba Assinaturas e no editor de Empresas, sem quebrar os fluxos existentes de cadastro, trial, PIX, renovacao e campanhas.

## Acceptance Criteria

- [x] Aba Assinaturas exibe data de cadastro, vencimento e status com base em campos reais e legados.
- [x] Detalhes da assinatura usam a mesma resolucao de datas da tabela.
- [x] Editor de Empresas permite complementar dados faltantes de empresas antigas.
- [x] `createCompanyOnboarding`, `upsertCompanyProfile` e `updateMyCompanyProfile` preservam os novos campos opcionais e a inscricao estadual enviada pelo cadastro.
- [x] Existe teste de regressao para os campos principais.
- [x] Rodar `npm run lint`, `npm run typecheck` e `npm test`.
- [x] Validar `admin.html` no navegador.
- [x] Listar auditoria geral do Admin e plano seguro para Campanhas/comissoes vitalicias.

## File List

- `admin.html`
- `scripts/admin/admin-main.js`
- `functions/index.js`
- `firebaseService.js`
- `tests/admin-assinaturas-empresas.test.mjs`
- `tests/admin-pwa-responsive.test.mjs`
- `tests/admin-support-ui.test.mjs`
- `tests/commerce-responsive-pwa.test.mjs`

## Evidencias

- `node --check scripts/admin/admin-main.js`, `node --check functions/index.js`, `node --check firebaseService.js`: OK.
- `node --test tests/admin-assinaturas-empresas.test.mjs tests/admin-pwa-responsive.test.mjs tests/admin-support-ui.test.mjs`: 5/5 OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: 137/137 OK.
- `firebase deploy --only hosting --project sisweb-7ce82 --non-interactive`: OK.
- `firebase deploy --only functions:default:createCompanyOnboarding,functions:default:upsertCompanyProfile,functions:default:updateMyCompanyProfile --project sisweb-7ce82 --non-interactive`: OK.
- Browser autenticado SuperAdmin em producao: aba Assinaturas exibiu 7 registros com colunas `Cadastro`, `Status`, `Vencimento`; aba Empresas exibiu 4 empresas, coluna `Pendencias` e campos extras do editor.
- Browser mobile 390px: tabelas responsivas ativas, sem overflow horizontal.
- HTTP producao: `admin.html`, `scripts/admin/admin-main.js` e `firebaseService.js` responderam 200 com marcadores da versao `2026-06-10-admin-assinaturas-v1`.
- Refinamento 2026-06-11: `scripts/admin/admin-main.js` centralizou campos de empresa em `COMPANY_PROFILE_FORM_FIELDS`; `npm run lint`, `npm run typecheck` e `npm test` passaram novamente com 137/137 testes.
- Deploy Hosting 2026-06-11: OK; `scripts/admin/admin-main.js?v=2026-06-10-admin-assinaturas-v1` em producao respondeu 200 contendo `COMPANY_PROFILE_FORM_FIELDS`, `readCompanyProfileFormPayload` e `getCompanyProfileValueByKey`.

## Auditoria Geral do Admin

- Dashboard: manter como central executiva; proximo passo util e adicionar alertas de qualidade de dados, como empresas incompletas, assinaturas ativas sem vencimento gravado e pendencias PIX antigas.
- Assinaturas: corrigido nesta story; proximas melhorias sao exportacao CSV, filtros por vencimento em 7/15/30 dias, notificacao em lote e trilha de alteracoes por usuario.
- Configuracoes: ja controla valores comerciais; proximo passo e versionar alteracoes com diff amigavel e preview publico antes de publicar.
- Empresas: corrigido nesta story; proximas melhorias sao mascaras de CNPJ/CEP/telefone, filtro "somente incompletas", deduplicacao assistida e exportacao.
- Status: bom para prorrogacoes; proximo passo e SLA de atendimento, motivo padronizado e historico por UID.
- Campanhas: ja possui campanha, indicacao, cupons, auditoria e ledger basico; precisa de modelo formal de parceiros/comissoes antes de novas telas financeiras.
- Financeiro: ja consolida requests/PIX; proximo passo e conciliacao por periodo, aging de pendentes, inadimplencia e exportacao contabil.
- Seguranca: ja lista eventos negados; proximo passo e alertas por padrao repetido, severidade e acao sugerida.
- Suporte: ja possui tickets e anexos; proximo passo e SLA, tags, responsavel interno e respostas modelo.
- PWA/Admin: validado sem overflow nas abas alteradas; manter testes de viewport em toda evolucao de tabela.

## Documentacao Tecnica - Aba Empresas

### Frontend

- O contrato de campos do editor de empresas fica centralizado em `COMPANY_PROFILE_FORM_FIELDS`, dentro de `scripts/admin/admin-main.js`.
- A mesma configuracao alimenta:
  - preenchimento do formulario ao clicar em `Editar`;
  - limpeza do formulario;
  - leitura do payload enviado para `upsertCompanyProfile`;
  - tabela de empresas;
  - coluna `Pendencias`.
- Para adicionar um novo campo de empresa no Admin, o caminho correto e:
  1. adicionar o input em `admin.html`;
  2. adicionar uma entrada em `COMPANY_PROFILE_FORM_FIELDS`;
  3. definir `aliases` quando existirem nomes legados;
  4. definir `requiredLabel` somente se o campo for essencial;
  5. adicionar suporte no backend se o campo precisar persistir.
- Evitar criar leituras manuais como `company.campo || company.outroCampo` fora desse helper. Isso espalha aliases e aumenta risco de regressao.

### Backend

- O helper `sanitizeCompanyProfileExtraPayload` em `functions/index.js` centraliza os campos opcionais de perfil:
  - `email` / `emailContato`;
  - `responsibleName` / `responsavel`;
  - `zip` / `cep`;
  - `neighborhood` / `bairro`;
  - `number` / `numero`;
  - `complement` / `complemento`.
- `createCompanyOnboarding`, `upsertCompanyProfile` e `updateMyCompanyProfile` reutilizam esse helper.
- `stateRegistration` tambem e gravado no onboarding, pois o formulario ja enviava esse valor.
- CNPJ continua com regra administrativa: usuario comum nao altera CNPJ pelo fluxo `updateMyCompanyProfile`; SuperAdmin altera via `upsertCompanyProfile`, com bloqueio de duplicidade.

### Relatorios e compatibilidade

- `firebaseService.js` normaliza os novos campos em `normalizeCompanyProfileForReport`, preservando aliases em portugues e ingles.
- Isso evita que cabecalhos, relatorios e impressoes precisem conhecer todos os nomes antigos de campo.
- O padrao de manutencao e: gravar aliases essenciais no backend e consumir dados normalizados nos relatorios.

### Decisoes de manutencao

- Foi evitado criar uma nova API ou novo caminho de banco para empresas.
- Foi mantido o caminho existente `companies/{companyId}/profile`.
- As mudancas sao aditivas e compativeis com empresas antigas.
- A UI apenas exibe e completa dados; regras sensiveis ficam nas Functions.

## Plano Campanhas e Comissoes Vitalicias

1. Base de dados aditiva: criar `campaignPartners/{partnerId}`, `campaignReferrals/{referredUid}` e `campaignCommissions/{partnerId}/{entryId}` sem remover `campaignLedger` e `referralHistory` existentes.
2. Regras comerciais: configurar percentual vitalicio, planos elegiveis, carencia, teto opcional, estorno em chargeback/reembolso e bloqueio de autoindicacao por e-mail, UID e CNPJ.
3. Links publicos: gerar link por parceiro/cupom, por exemplo `subscription.html?ref=CODIGO&cupom=CUPOM`, com compartilhamento WhatsApp e redes sociais.
4. Atribuicao segura: gravar a indicacao no primeiro cadastro/pagamento valido via Function, com auditoria imutavel e calculo sempre no backend.
5. Comissionamento: calcular comissao quando pagamento for aprovado, registrar reversao se pagamento for cancelado e separar estados `pending`, `approved`, `paid`, `reversed`.
6. Admin Campanhas: adicionar KPIs de parceiros ativos, clientes indicados, clientes ativos, MRR indicado, comissao pendente e comissao paga.
7. Tabela de parceiros: exibir nome, contato, codigo/link, clientes totais, clientes ativos, receita gerada, saldo a pagar e historico.
8. Tela de detalhe: listar clientes indicados por parceiro, status da assinatura, proximo vencimento, pagamentos e comissoes.
9. Pagamento de comissao: fluxo SuperAdmin para aprovar/baixar comissao, anexar comprovante e exportar CSV.
10. Rollout seguro: primeira entrega apenas leitura com base nos dados atuais; segunda entrega grava ledger novo; terceira entrega ativa baixa de comissao.
