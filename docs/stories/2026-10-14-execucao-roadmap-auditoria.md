# Story 2026-10-14 — Execução do roadmap da auditoria completa (modo Ponytail ultra)

## Objetivo
Executar o roadmap da auditoria (sessão cont. 9), na ordem: 1º integridade → 2º fiscal seguro → 3º contábil → 4º lean → 5º comprovação. Sem reescrita estética, sem regra fiscal sem fonte oficial.

## Checklist
- [x] 1a. Baixa de estoque atômica server-side + idempotencyKey (vendas.js + functions)
- [x] 1b. RTDB `.read` com `active!=false` + subscription (+backfill espelho — exige aprovação p/ prod)
- [x] 1c. Logout com `unsubscribeAll()+off()+clearTenantContext()`
- [x] 2a. Fix regex tpEvento `mdfe_consultar` (desbloqueia push do 410e17e)
- [x] 2b. Fix `findSignatureInsertIndex` ingênuo (desbloqueia push do 410e17e)
- [x] 2c. Opt-in IBS/CBS neutro + log `defaultNeutro:true`
- [x] 2d. Validação de prazo cancel/inutil (client+backend)
- [x] 2e. Chave de numeração por série
- [x] 3a. `moneyToCents` global + `estornar()` + `dataCompetencia` + teste razão==relatório
- [x] 4a. Remover arquivos mortos (compras_legacy, migrateToFirebase, verificacao-final, server, index/openai)
- [x] 4b. Unificar helpers (formatters, tora-geometry, CPF/CNPJ, CFOP) + testes-ouro
- [x] Gates finais: `npm run lint` + `npm run typecheck` + `npm test`

## File list
- `functions/finance-functions.js`: `estoqueAplicarMovimento` + `normalizeEstoqueMovementRequest` + `applyEstoqueBaixa/Estorno` + `transactEstoqueProduto` + compensação + `__test` exports
- `functions/index.js`: export `estoqueAplicarMovimento`; `setUserAccessStatus` marca `active/adminActive` no membro
- `vendas.js`: dry-run `aplicarMovimentoEstoquePedido` + `converterQtdManual` + baixa/estorno via callable + fail-closed pré-save + compensação pós-save + delete fail-closed
- `firebaseService.js`: `registerSessionTeardown/runSessionTeardowns` + logout com unsubscribe + `setTenantId` limpa em troca real + `estoqueAplicarMovimento` no guard de auth
- `database.rules.json`: 42 `.read` com gate `active != false`
- `modules/romaneiopct/modal-lista-romaneios-pct.js`: `stopRealtimeRomaneiosPct` + teardown + close desinscreve
- `folha_pagamento/folha-firebase-manager.js`: cleanup no teardown de sessão
- `functions/nf-functions.js`: `extrairConteudoTag/BlocoTag` + signer parser próprio + numeração por série + prazo cancel + `__mdfeInternals` estendido + dedupe SOAP_ACTION_METHOD
- `functions/mdfe-functions.js`: consulta com extração tolerante a namespace
- `nf-config.js`: `defaultNeutro` + `prazosFiscais` + `avaliarPrazoEvento/formatarDecorridoHoras` + CNPJ/CPF delegam ao NFValidator
- `nf-service.js`: gate `IBS_NEUTRO_CONFIRMACAO` antes da reserva + fallback neutro marcado + serie na reserva
- `nf-storage.js`: `normalizarSerieContador` + leitura/escrita por série com fallback legado
- `nf-itens.js`: `cfopCanonicoValido` nos 3 usos
- `nf-naturezas.js`: CFOP canônico na regra
- `notas-fiscais.html`: opt-in neutro (confirmDialog + registro + retry único) + pré-check de prazo no cancel
- `financas.js`: `somarValoresCents/centsParaValor` + `estornarConta` + botões + `dataCompetencia`
- `hosting-files.json`: removidos `compras_legacy.js`, `verificacao-final-sistema.js` (build 543 arqs OK)
- `package.json`: removidos `express`, `openai` (prettier mantido — usado por `.aiox-core`)
- Deletados: `compras_legacy.js`, `verificacao-final-sistema.js`, `migrateToFirebase.js`, `server.js`, `index.js`
- Testes novos: `estoque-baixa-atomica` (9), `logout-limpeza-sessao` (4), `nfe-ibs-neutro-optin` (3), `nfe-prazo-cancel` (4), `nfe-numeracao-serie` (4), `finance-contabil-estorno` (4), `nf-validacao-canonica` (4), `madeira-geometria-ouro` (4)
- Testes atualizados: `produto-romaneio`, `consulta-sefaz-verdade`, `nfe-signer-event-order`, `security-rbac-multitenant`, `notification-service-standard`

## Gates
- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm test`: 1393 total / 1392 pass / 0 fail / 1 skip (skip = emulator esperado)
- `npm run build:hosting`: OK (543 arquivos)

## Deploy (devops, sob ordem expressa)
- [x] Commit dossiê + push (`3c2675c`, `ebb6cf8..3c2675c`)
- [x] `firebase deploy --only hosting` (543 arqs, 11 novos)
- [x] `firebase deploy --only database` (rules com gate `active != false`)
- [x] `firebase deploy --only functions:` estoqueAplicarMovimento (create), setUserAccessStatus, nf_assinarXML, nf_enviarSEFAZ, nf_consultarNFe, nf_reservarNumero, nf_cancelarNFe, nf_cartaCorrecaoNFe, nf_eventoRTC, nf_inutilizarNumeracao, mdfe_consultar, mdfe_emitir, mdfe_encerrar (12 updates; 1ª tentativa falhou em timeout local transitório, 2ª OK)
- [ ] Verificação pós-deploy + teste vivo MDF-e/NF-e em homologação

## Deferido com motivo
- Unificação massiva `formatCurrency/formatDate/máscaras` (×20 cópias) e `calcularVolumeTora/PCT` (×7): troca de call-sites em 9+ arquivos com risco de regressão visual/fiscal; exige 1 story por módulo com validação em tela. Testes-ouro travam o comportamento atual.
- `prettier`: mantido — usado por `.aiox-core/**/code-quality-improver.js` (achado anterior "não provada" corrigido).
- Backfill `active:true` em membros legados sem o campo: `active != false` passa quando ausente — sem backfill obrigatório; bloqueio só marca `active:false` explícito.
- Deploy das rules/functions: NÃO executado (só @devops faz push; Constitution II).

## 5a. Dossiê MOC/NT/SEFA-PA — pendências que exigem fonte oficial antes de codar
Nenhum valor abaixo foi implementado; cada item indica onde o código está e o que confirmar.
- [ ] **DIFAL/partilha**: NÃO implementado — `nf-config.js:84-87` (comentário A14, sem `ICMSUFDest` no builder). Interestadual sai sem partilha. Confirmar: MOC vigente + se o tenant opera interestadual; tabela de alíquotas internas por UF destino (futura Onda 3b).
- [ ] **FCP-ST**: `vFCPST`/`vFCPSTRet` fixos `0.00` (`nf-xml-builder.js:634-635`); FCP por item parametrizável existe (auditoria). Confirmar: alíquota FCP por UF/produto e regras de ST antes de parametrizar.
- [ ] **Benefícios PA / madeira**: zero tratamento `cBenef`/RICMS-PA no fiscal (auditoria: só `UF_LIST` cita PA). Confirmar: RICMS/PA + regime da madeira antes de qualquer `cBenef` hardcoded.
- [ ] **Contingência**: `tpEmis: '1'` fixo (`nf-config.js:40`) + `temis = '1'` na chave (`nf-xml-builder.js:96`). Sem FS-DA/SVC — parada SEFAZ = parada emissão. Confirmar: NT de contingência antes de implementar.
- [ ] **cCredPres semântico**: só formato `\d{2}` (`nf-tax-tables.js:210-215`) + `TABLE_META` sem valores (linhas 27-51, orientação anti-obsolescência). Confirmar: tabela oficial Portal NF-e antes de hardcodar códigos.
- [ ] **TZ -03:00**: hardcoded em `nf-xml-builder.js:80-85`, `nf-service.js:162`, `mdfe-xml-builder.js:58`, `nf-dashboard.js:23`. Tenant fora de BRT (AM −04, Noronha −02) gera dhEmi/chave AAMM errados. Base atual é PA (−03, correto); confirmar regra oficial e mapear UF→offset quando houver tenant fora de BRT.
- [ ] **Prazo cancel/CC**: mecanismo pronto (2d), valor legal NÃO preenchido (`prazosFiscais` null). Confirmar MOC/NT vigente e preencher por tenant.
