# Story: Benchmark Bling emissor NF-e e melhorias DANFE

## Status
In Progress

## Contexto
Foi analisada a tela autenticada de inclusao de NF-e do Bling em `https://www.bling.com.br/notas.fiscais.php#add`, apenas em modo leitura, sem salvar ou alterar dados. O objetivo foi levantar boas praticas de mercado para melhorar o emissor NF-e do Sisweb, a responsividade da tela e o layout profissional do DANFE.

## Referencias observadas no Bling
- Cabecalho fixo com navegacao principal, busca global e atalhos.
- Tela de NF-e com acoes principais `Cancelar` e `Salvar` bem visiveis.
- Grid amplo em desktop, com campos agrupados por assunto.
- Campos obrigatorios marcados com `*`.
- Ajuda contextual em campos sensiveis, como numero, hora de emissao, RNTC e pesos.
- Secoes do formulario: Nota fiscal, Destinatario, Itens da nota fiscal, Calculo de imposto, Retencoes, Transportador/Volumes, Pagamento, Pessoas autorizadas a acessar XML e Informacoes adicionais.
- Transporte separado em subgrupos: `Transporte`, `Frete por conta`, `Dados da transportadora` e `Dados do volume`.
- Campo `Transporte` separa estrategia operacional: sem transporte, logistica cadastrada ou transportadora manual.
- No mobile, os campos empilham em uma coluna e as acoes principais ficam fixas no rodape.

## Pontos a aproveitar no Sisweb
1. Criar fluxo de emissao por etapas: Operacao, Destinatario, Itens, Impostos, Transporte, Pagamento, Revisao.
2. Manter acoes principais fixas no desktop e no mobile, com `Salvar rascunho`, `Revisar` e `Emitir`.
3. Dividir transporte em subgrupos visuais, em vez de uma unica grade longa.
4. Criar busca unica de produto/servico com edicao inline de item.
5. Exibir calculo automatico e totais como painel sempre visivel.
6. Usar ajuda contextual curta nos campos fiscais mais propensos a erro.
7. Trocar alert/confirm/prompt por modais profissionais para acoes criticas.
8. Criar tela de revisao antes da senha do certificado e antes da emissao.
9. Melhorar mobile com secoes colapsaveis e barra de acao fixa no rodape.
10. Transformar Configuracao Fiscal em checklist de onboarding.

## Pontos que nao devem ser copiados cegamente
- Formulario unico muito longo aumenta rolagem e pode esconder erros.
- Muitos campos de baixa frequencia expostos ao mesmo tempo aumentam carga cognitiva.
- Acoes de salvar sem etapa de revisao podem ser insuficientes para emissao fiscal em producao.
- Mobile empilhado funciona, mas precisa de fluxo por etapas para uso operacional frequente.

## Plano de melhorias Sisweb
### Fase 1 - UX da emissao
- [x] Implementar wizard/abas internas da emissao.
- [x] Adicionar barra fixa de resumo: ambiente, cliente, total, status de validacao.
- [x] Criar revisao fiscal antes de emitir.
- [x] Validar campos inline e focar automaticamente no primeiro erro.

### Fase 2 - Transporte e volumes
- [x] Evoluir UI para subgrupos: modalidade, transportador, veiculo, volumes/pesos.
- [ ] Adicionar modo `logistica cadastrada` no futuro, sem obrigar no primeiro ciclo.
- [x] Permitir multiplos volumes e lacres.
- [x] Exibir alertas de coerencia: qVol suspeito, peso bruto menor que liquido, placa sem UF, RNTC muito longo.

### Fase 3 - Itens e impostos
- Criar busca unificada de produto/servico.
- [x] Permitir edicao do item lancado com quantidade, unidade, valor, NCM, CFOP e CSOSN/CST, recalculando impostos automaticos.
- Destacar origem dos defaults fiscais: cadastro do produto, natureza, configuracao ou preenchimento manual.
- Mostrar totais e impostos em painel lateral.

### Fase 6 - Operacoes fiscais apos emissao
- [x] Exibir Carta de Correcao na coluna de acoes apenas para NF-e autorizada.
- [x] Exibir Inutilizacao de numeracao como acao da aba Consulta, pois nao pertence a uma NF-e autorizada especifica.
- [x] Implantar Cloud Functions `nf_cartaCorrecaoNFe` e `nf_inutilizarNumeracao` com assinatura XML e envio SOAP real para SEFAZ.
- [ ] Executar teste operacional com certificado A1 em homologacao e registrar retorno SEFAZ real de CC-e/Inutilizacao antes de liberar uso irrestrito em producao.
  - Estado real auditado em 2026-06-16: tenant ativo `1749492103278`, empresa/dados fiscais carregados, 3 rascunhos sem autorizacao e nenhum certificado A1 configurado.
  - Bloqueios objetivos: senha do A1, upload do `.pfx` local do owner, emissao de 1 NF-e autorizada em homologacao e cuidado com divergencia visual de ambiente entre Configuracao (`Producao`) e Emissao (barra-resumo ainda em `Homologacao`).

### Fase 4 - DANFE profissional
- [x] Redesenhar o DANFE conforme grade do MOC, com foco em impressao preto/branco.
- [x] Incluir codigo de barras da chave de acesso.
- [x] Repetir cabecalho e cabecalho da tabela de itens em paginas seguintes.
- [x] Controlar altura de textos longos com quebra e continuacao.
- [x] Renderizar o DANFE a partir do XML autorizado ou objeto normalizado extraido do XML.

### Fase 5 - Configuracoes
- Criar checklist fiscal: empresa, certificado, serie/numeracao, naturezas, impostos, preferenciais de emissao.
- Manter preferencias por tenant em secoes seguras, sem substituir o no fiscal inteiro.
- Criar perfis de emissao reutilizaveis no futuro.

## Validacao desta etapa
- Acesso ao Bling realizado em modo leitura.
- Analise visual desktop e mobile.
- Analise dos arquivos atuais do Sisweb por especialistas.
- Fase 1 iniciada com fluxo guiado de emissao e revisao fiscal antes da senha A1.
- Fase 1 concluida com barra de resumo fiscal e validacao inline por campo.
- Fase 2 iniciada com Transporte e Volumes reorganizado em subgrupos, preservando os mesmos campos e o mesmo payload fiscal.
- Fase 2 evoluida com lista de volumes/lacres, normalizacao para XML com multiplos `<vol>`, validacao de lacres e resumo agregado no DANFE.
- Fase 4 iniciada com codigo de barras Code 128C para chave de acesso de NF-e Mod.55 no DANFE, sem nova dependencia externa.
- Fase 4 evoluida com cabecalho de continuacao e repeticao do cabecalho da tabela de produtos em paginas seguintes.
- Fase 4 evoluida com quebra controlada de descricoes longas dos itens em multiplas linhas e linhas de continuacao para evitar sobreposicao no DANFE.
- Fase 4 concluida com leitura do XML fiscal salvo no Storage para DANFE, normalizacao por `DOMParser` quando `xmlAutorizado/xmlProc/xml/xmlNFe` existir e fallback seguro para o objeto fiscal salvo.
- Fase 4 concluida com redesign fiscal preto/branco do DANFE Mod.55 inspirado na grade oficial/Bling: recibo superior, cabecalho emitente/DANFE/controle do fisco, barcode, chave de acesso, natureza/protocolo, destinatario, faturas, calculo de imposto, transportador/volumes, itens com colunas fiscais, ISSQN e dados adicionais/reservado ao fisco.
- Parser de XML do DANFE ampliado para aproveitar CST/CSOSN, base/valor de ICMS, IPI, IE do destinatario, telefone/endereco do emitente, totais de ST/IPI/outros e duplicatas quando existirem no XML autorizado.
- DANFE passou a aceitar logo do emitente em tempo de renderizacao a partir de `logoUrl`/Storage, sem persistir novo payload base64; a tela de Consulta tenta resolver a logo do tenant logado antes de abrir o PDF.
- Comparativo visual com Bling mostrou diferencas remanescentes e gerou nova correcao: logo preservada mesmo quando o XML autorizado normaliza o objeto fiscal, faturas redesenhadas em grade `Numero/Vencimento/Valor`, tabela de produtos com coluna `Aliq. IPI` e area minima em branco ate a faixa inferior, reduzindo o vazio no rodape e deixando o documento mais parecido com DANFE de mercado.
- Coluna `Codigo` do DANFE passou a exibir apenas o numero sequencial do item, evitando que codigos internos como `MANUAL_...` quebrem linha no PDF. Essa alteracao e apenas visual no DANFE: o `cProd` fiscal segue preservado no XML e nos dados da NF-e.
- DANFE passou a ler valores fiscais tambem do objeto `item.imposto` quando o XML autorizado ainda nao esta disponivel, mantendo coerencia com os calculos automaticos de ICMS/PIS/COFINS feitos por `NFConfigService` e totalizados por `NFXmlBuilder.calcularTotais`.
- Fluxo fiscal automatico ampliado para IPI opcional: quando `impostos.ipi.habilitado` estiver falso, o comportamento permanece zerado; quando habilitado, o item recebe `IPI`, o XML inclui o grupo fiscal, `vIPI` entra nos totais, `vNF` soma o IPI e o validador aceita a mesma composicao.
- Dados do destinatario agora oferecem atalho de edicao do cliente selecionado diretamente na emissao de NF-e; ao salvar, o cadastro central e o select do destinatario sao recarregados.
- Itens lancados na NF-e agora possuem acao de edicao, preservando o `cProd` fiscal e recalculando impostos automaticos apos alteracao de quantidade, valor, NCM, CFOP, unidade ou CSOSN/CST.
- Aba Consulta passou a expor CC-e para notas autorizadas e Inutilizacao de numeracao como acao geral da consulta, com mensagens de seguranca caso as Cloud Functions fiscais ainda nao estejam implantadas. Nenhum evento SEFAZ e simulado no browser.
- Logo do DANFE reforcada com leitura de formatos aninhados (`profile`, `data`, `company`, `empresa`) e conversao por `firebaseService.getStorageDataURL` usando Firebase Storage, mantendo Storage-first e sem persistir novo base64 no Database.
- Checagem de sintaxe dos scripts inline classicos de `notas-fiscais.html`: OK.
- `npm run lint`: OK.
- `npm run typecheck`: OK.
- `npm test`: OK, 7 testes passando.
- `git diff --check` dos arquivos desta story: OK.
- Validacao visual automatizada: Browser embutido confirmou a presenca da barra de resumo, dos subgrupos de Transporte e ausencia de overflow horizontal no carregamento local; servidor temporario foi desligado.
- Validacao em producao apos deploy do Hosting: `https://sisweb-7ce82.web.app/notas-fiscais.html` abriu autenticado, a etapa Transporte liberou campos com frete CIF, adicionou volume/lacre em lista, bloqueou lacre acima de 60 caracteres com erro inline em `nfVolLacres`, manteve zero overflow horizontal e a pagina foi recarregada sem salvar rascunho ou emitir NF-e.
- Validacao em producao do DANFE apos deploy do Hosting: `https://sisweb-7ce82.web.app/nf-danfe.js` foi baixado do Hosting e executado em VM com `jsPDF` simulado; o artefato publicado contem `drawCode128C`, gerou 76 barras para a chave de acesso e criou 3 paginas com cabecalho de continuacao e repeticao do cabecalho de produtos.
- Validacao local da conclusao da Fase 4: `node --check` em `nf-danfe.js`, `nf-service.js`, `nf-storage.js` e `nf-validator.js`; `npm test`, `npm run lint`, `npm run typecheck` OK. `git diff --check` global segue bloqueado por trailing whitespace pre-existente em arquivos fora do escopo; a checagem isolada dos arquivos desta entrega ficou OK.
- Validacao visual local do novo DANFE: PDF de amostra gerado em `audits/danfe-preview-local.pdf` e renderizado para `audits/danfe-preview-local-page1.png`, confirmando grade fiscal compacta, sem faixas azuis, com barcode e sem sobreposicoes nos campos de totais/transporte/itens.
- Hosting protegido para nao publicar artefatos locais de auditoria: `firebase.json` passou a ignorar `audits/**`.
- Validacao local no servidor `http://127.0.0.1:3000/notas-fiscais.html`: tela abriu, login local funcionou, aba Consulta listou rascunhos e botoes de DANFE/edicao; artefatos servidos por HTTP confirmaram `nf-danfe.js` com grade fiscal nova, suporte de logo no DANFE, `NFStorage.carregarXML` e `firebase.json` ignorando `audits/**`.
- Validacao final do ajuste de DANFE: logo do emitente preservada mesmo apos normalizacao pelo XML autorizado, coluna `Codigo` exibindo somente item sequencial `1, 2, 3...`, identificadores internos como `MANUAL_...` ausentes da impressao e leitura de ICMS/IPI tambem a partir de `item.imposto` para manter coerencia com os calculos automaticos antes da autorizacao.
- Validacao fiscal adicional: teste cobre IPI desabilitado sem impacto, IPI habilitado com `IPITrib`, soma de `vIPI`, `vNF = vProd + vIPI - vDesc + vFrete` e emissao do grupo `<IPI>` no XML.
- Validacao de UX fiscal adicional: testes cobrem editar cliente no destinatario, editar item da nota, botoes de CC-e/Inutilizacao, uso de `callFunction` para eventos fiscais e logo embutida via Storage DataURL.
- Gates finais desta iteracao: `node --check` em `firebaseService.js`, `nf-config.js`, `nf-service.js`, `nf-xml-builder.js`, `nf-validator.js` e `nf-danfe.js`; checagem de sintaxe dos scripts inline classicos de `notas-fiscais.html`; `npm run lint`; `npm run typecheck`; `npm test` com 7 testes passando; `git diff --check` escopado OK.
- 2026-06-16: `nf_cartaCorrecaoNFe` e `nf_inutilizarNumeracao` foram implementadas no backend com XML assinado (`infEvento`/`infInut`), endpoints SEFAZ de `NFeRecepcaoEvento4` e `NFeInutilizacao4`, persistencia em `companies/{tenantId}/fiscal/notas` e espelho legado em `tenants/{tenantId}/notas-fiscais`.
- 2026-06-16: deploy escopado de Functions executado para `nf_assinarXML`, `nf_enviarSEFAZ`, `nf_consultarNFe`, `nf_cancelarNFe`, `nf_cartaCorrecaoNFe`, `nf_inutilizarNumeracao` e `auditAdminClaimsInconsistencies`; `firebase functions:list` confirmou as novas callables publicadas.
- 2026-06-16: testes focados `node --test tests/fiscal-nfe-events.test.mjs tests/security-rbac-multitenant.test.mjs`, `node --check functions/index.js`, `node --check functions/nf-functions.js` e `npm --prefix functions run lint` passaram. Falta apenas evidenciar retorno SEFAZ real com certificado A1/dados fiscais de homologacao.
- 2026-06-16: validacao operacional em browser autenticado confirmou que a aba Consulta exibe `Inutilizar nº` e que o modal pede serie, faixa, justificativa e senha A1; o codigo de `notas-fiscais.html` segue expondo CC-e apenas para `n.status === 'autorizada'` e chama `nf_cartaCorrecaoNFe` / `nf_inutilizarNumeracao`.
- 2026-06-16: logs do front confirmaram `NFService` inicializado para o tenant `1749492103278` e leitura de `companies/1749492103278/fiscal/config`; a tela de Configuracao mostra `Ambiente = Producao`, enquanto a barra-resumo da Emissao permaneceu em `Homologacao`, devendo ser tratada como discrepancia visual antes do smoke real.

## File List
- `notas-fiscais.html`
- `firebaseService.js`
- `nf-config.js`
- `nf-danfe.js`
- `nf-service.js`
- `nf-storage.js`
- `nf-validator.js`
- `nf-xml-builder.js`
- `tests/company-logo-storage-policy.test.mjs`
- `tests/fiscal-nfe-events.test.mjs`
- `functions/index.js`
- `functions/nf-functions.js`
- `docs/stories/2026-05-17-benchmark-bling-emissor-nfe-danfe.md`
- `firebase.json`
- `audits/danfe-preview-local.pdf`
- `audits/danfe-preview-local-page1.png`
