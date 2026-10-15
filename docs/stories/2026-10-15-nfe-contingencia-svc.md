# Story 2026-10-15 — P5 Contingência SVC NF-e (SVC-AN/SVC-RS, mod 55)

## Objetivo
Emitir NF-e em contingência SVC quando a SEFAZ de origem está fora do ar, sem reenvio posterior. Ativação MANUAL por tenant (nunca automática). Escopo D3: SVC-AN (tpEmis 6) e SVC-RS (tpEmis 7), NFe mod 55. Fora de escopo: FS-DA/EPEC/offline (2/4/5/8/9), NFC-e, MDF-e, DANFE-legendas (wording MOC não verificado).

## Fontes (hierarquia MOC > NT > XSD > SEFAZ > NFePHP > código)
- XSD local `tests/schemas/nfe/leiauteNFe_v4.00.xsd`: `dhCont`/`xJust` após `verProc`, só tpEmis ≠ 1; `xJust` 15–256.
- NFePHP `Contingency.md` + catálogo `wsnfe_4.00_mod55.xml` (blocos SVCAN/SVCRS): endpoints, UF→SVC (cobre as 27 UFs e as 7 do dossiê), dhCont+xJust obrigatórios, chave muda (regravar), só mod 55, ativação manual com motivo.
- MOC 7.0 Anexo III (dossiê P5): regras FS-DA/SVC, sem retransmissão, ativação pela origem.

## Checklist
- [x] `nf-config.js`: `DEFAULT_CONFIG.contingencia` + `SVC_POR_UF` + `resolverTipoSVC`/`tpEmisDeTipoSVC` + `validarContingencia` + exports
- [x] `nf-validator.js`: `validarTpEmis` + `validarDhContXJust` + hook em `validarIde` + exports
- [x] `nf-xml-builder.js`: `gerarChave` com tpEmis validado + `buildIde` com tpEmis e dhCont/xJust pós-verProc
- [x] `nf-service.js`: `emitirNFe` injeta tpEmis/dhCont/xJust da config ativa antes de validar
- [x] `functions/nf-functions.js`: blocos `svc-an`/`svc-rs` + `SVC_POR_UF`/`resolverTipoSVC`/`resolverAmbienteSVC` + `lerTpEmisNota` + `getEndpoint(..., tpEmis)` + 6 call sites roteados + persistência `tpEmis`/`ambienteSefaz`
- [x] `notas-fiscais.html`: painel config + persistência + badge + confirm por emissão + tpEmis na consulta/inutilização
- [x] Testes `tests/nfe-contingencia-svc.test.mjs` (12)
- [x] Gates: `npm run lint` + `npm run typecheck` + `npm test`
- [x] 3 guards pré-existentes ajustados com intenção preservada (`fiscal-nfe-events` roteamento, `company-logo-storage-policy` janela pós-revisão)
- [ ] Homologação SVC por UF (requer contingência real + senha do certificado — manual, roteiro abaixo)
- [x] Deploy functions + hosting (devops, pedido expresso 2026-10-15)

## Deploy executado
- Commit `5c81885` + push `3c2675c..5c81885` main.
- Hosting publicado (build:hosting + release completa).
- Functions (6/6 em 2 grupos): nf_enviarSEFAZ, nf_consultarNFe, nf_cancelarNFe, nf_cartaCorrecaoNFe, nf_eventoRTC, nf_inutilizarNumeracao.
- Verificado: `functions:list` ativas; produção serve `validarTpEmis`/`validarDhContXJust` e builder com `temis`.
- Browser automation indisponível neste ambiente (mesma falha `ChildProcess.kill` da cont.13) — teste vivo de emissão fica como roteiro manual.

## Roteiro manual de homologação SVC (pendente, com o usuário)
1. Tenant de homologação com certificado válido; anotar UF do emitente.
2. Config NF-e → Contingência SVC → ativar com motivo 15–255 chars (tipo auto).
3. Emitir NF-e de teste: confirmar diálogo "Emitir em contingência", senha A1.
4. Conferir no XML: `<tpEmis>6|7</tpEmis>`, `<dhCont>`, `<xJust>`, dígito da chave.
5. Consultar SEFAZ, cancelar e inutilizar uma faixa — tudo deve rotear ao SVC.
6. Desativar contingência ao final e emitir uma normal (tpEmis 1) como contraprova.

## Resultado dos gates
- `npm run lint`: OK
- `npm run typecheck`: OK
- `npm test`: 1405 total / 1404 pass / 0 fail / 1 skip (skip = emulator esperado)

## File list
- `nf-config.js`, `nf-validator.js`, `nf-xml-builder.js`, `nf-service.js`
- `functions/nf-functions.js`
- `notas-fiscais.html`
- `tests/nfe-contingencia-svc.test.mjs` (novo, 12 testes)
- `docs/stories/2026-10-15-nfe-contingencia-svc.md` (este arquivo)

## Deferido com motivo
- DANFE legenda de contingência: wording MOC não verificado — chave já codifica tpEmis; sem conteúdo inventado no documento fiscal.
- EPEC (NT 2014.001 não lida), FS-DA, NFC-e offline, MDF-e: fora do D3.
- StatusServico SVC dedicado ("testar contingência"): homologação cobre; sem nova callable.
- DIFAL (P2) e demais pendências: pendentes por ordem expressa (só P5 nesta etapa).
