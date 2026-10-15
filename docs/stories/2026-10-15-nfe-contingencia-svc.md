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
- [ ] Homologação SVC por UF (requer ativação/contingência real — fora do código)
- [ ] Deploy functions + hosting (só @devops; Constitution II)

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
