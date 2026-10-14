# AUDITORIA COMPLETA SISWEB — Dossiê Documental P1–P9 (multi-estado: PA/MT/RO/AC/AM/AP/MA)

- **Natureza:** fase exclusivamente documental. Nenhuma linha de código, refatoração ou alteração foi executada.
- **Escopo de lançamento (D1):** PA, MT, RO, AC, AM, AP, MA.
- **Decisões de escopo:** D2 DIFAL implementar · D3 Contingência SVC implementar · D4 cBenef NÃO nesta etapa (só arquitetura futura; sem tabelas, sem cBenef inventado; contador do cliente configura) · D5 Timezone implementar.
- **Premissas:** usuário informa o NCM correto (sem inferência/classificação automática, sem catálogo interno, sem sugestão); Lei 12.741/2012 só percentual médio (sem motor IBPT, sem licenciamento, sem integração externa).
- **Convenção:** sem fonte oficial citada = NÃO VERIFICADO. Classificação por fonte: Comprovação Completa / Parcial / Evidência Insuficiente.

## 0. Análise do prompt (fundo)

1. **Forças:** proíbe presumir defeito sem provar funcionamento atual + motivo + dependências + regressão; exige fonte oficial com URL/órgão/data/versão/trecho; separa D4 (cBenef) como arquitetura-futura, o que é correto para multi-tenant (benefício é dado do cliente, não do software); veda NCM automático, eliminando a classe inteira de risco fiscal-inventado; fixa Lei da Transparência no mínimo legal (percentual médio).
2. **Tensão resolvida:** D2/D3/D5 dizem "implementar agora" mas a ENTREGA proíbe código — interpreta-se "implementar agora" como **prioridade do plano** (etapas prontas para execução após aprovação desta fase), nunca como autorização para codar. Nenhum plano abaixo altera comportamento sem evidência.
3. **Riscos do próprio prompt:** (a) matriz de autorizadores/SVC para PA/RO/AC/AP não foi localizada em fonte oficial direta — o dossiê marca NÃO VERIFICADO em vez de preencher por inferência; (b) prazo de CC-e (720h) e Informe RFB da unificação SVAN/SVC-AN não recuperados oficialmente — marcados, não usados; (c) "percentual médio" não consta literalmente na lei — documentado o que a lei/decreto realmente dizem (valor aproximado; médias estimadas por instituição idônea, facultativo).
4. **Ponto corrigido em relação à auditoria anterior:** P9 (DOF/GF) deixou de ser "ilha desconhecida" e passou a levantamento documental com conclusão ERP (1 DOF : 1 NF, pareamento operacional; sem tag fiscal no MOC).

## 1. Inventário técnico — como funciona hoje (código verificado)

- **P1 Autorizadores:** `SEFAZ_EP` em `functions/nf-functions.js:46-67` = SVRS (homolog + produção) com override só de SP/MG (só `NfeAutorizacao4`, só produção). `getEndpoint(servico, ambiente, uf)` (`:79-84`) recebe a UF mas só desvia se houver override — PA/MT/RO/AC/AM/AP/MA caem no SVRS. Exceção: autorização NF-e passa a UF (`:1175` com `ufEmit`); consulta/eventos/inutilização chamam **sem** UF (`:1339`, `:1533`, `:1642`, `:1758`, `:2191`). MDF-e usa SVRS fixo (`functions/mdfe-functions.js:23-34`) — correto por desenho nacional. Tabela `UF_CODIGO_IBGE` completa com as 27 UFs (`functions/nf-functions.js:70-75`). Motivo provável do desenho atual: operação real só em PA/homologação, onde SVRS atende.
- **P2 DIFAL/FCP:** inexistente. `nf-config.js:84-87` (comentário A14, sem `ICMSUFDest`); `vFCPST`/`vFCPSTRet` fixos `0.00` (`nf-xml-builder.js:634-635`). Dependências: builder, `calcularICMS`, natureza/CFOP (idDest), IE do destinatário (já capturado — `ebb6cf8`).
- **P3 cBenef:** inexistente — zero ocorrências em builder, config e functions (verificado). Nada depende disso hoje; nada quebra por ausência em operação interna PA sem benefício.
- **P4 Timezone:** offset `-03:00` fixo em `nf-xml-builder.js:80-85` (`toBrasiliaDateTime`), `nf-service.js:162` (`dataEmissao`), `mdfe-xml-builder.js:58`, `nf-dashboard.js:23`. Correto para PA/AP/MA; errado para MT/RO/AM (−04) e AC (−05, mais oeste-AM). Afeta `dhEmi`, AAMM da chave (`nf-xml-builder.js:91`) e `dataEmissao` exibida.
- **P5 Contingência:** inexistente — `tpEmis: '1'` fixo (`nf-config.js:40`), `temis = '1'` na chave (`nf-xml-builder.js:96`); nenhum código FS-DA/SVC/EPEC (busca por `tpEmis|contingenc|SVC|FS-DA` só retorna `svc` = variável de serviço). MDF-e idem (sem `tpEmis` de contingência no código).
- **P6 cCredPres:** só formato `\d{2}` (`nf-tax-tables.js:210-215`) + `TABLE_META` sem valores (`:27-51`, orientação anti-obsolescência expressa). Passthrough em `nf-config.js` (`credPresOper`).
- **P7 Prazo:** mecanismo pronto, valor legal null. `prazosFiscais: { cancNFeHoras: null, ccNFeHoras: null }` (`nf-config.js`), gêmeas `avaliarPrazoEvento` / `avaliarPrazoEventoFiscal`, gate `failed-precondition PRAZO_EXCEDIDO` antes do PFX no `nf_cancelarNFe`, pré-check no cliente antes da senha (`notas-fiscais.html`). `dhAutorizacao` persistido no envio (`functions/nf-functions.js:1213`).
- **P8 NCM:** só estrutural, sem inferência — `nf-itens.js:22-27` (8 dígitos, rejeita `00000000`) + `NFValidator.validarNCM` (`nf-validator.js:49-53`); checagem de existência em tabela em `:189` e `:475`; uso em `notas-fiscais.html:3595`. Premissa "usuário informa" já é o comportamento.
- **P9 Florestal:** zero referências no código (`DOF` só aparece dentro de `pedidoForm`; sem SINAFLOR/SISFLORA/GF). MDF-e carrega `infDoc` + `prodPred`/`infAdic`, sem campo florestal.
- **Transparência:** `vTotTrib = vICMS+vIPI+vPIS+vCOFINS+vIBS+vCBS+vIS` (`nf-xml-builder.js:884`); texto legal só em `infCpl` via `buildInfAdic` (`:798-801`); separação declarada em `nf-service.js:298-301`.

## 2. Relatórios por pendência — P1, P2, P3

### P1 — Autorizadores por UF
- **Funcionamento atual:** §1. Toda NF-e das 7 UFs sai pelo SVRS, exceto SP/MG em produção.
- **Evidência:** `functions/nf-functions.js:46-84` (`SEFAZ_EP`, `getEndpoint`); chamadas sem UF em `:1339/:1533/:1642/:1758/:2191`; MDF-e SVRS fixo (`functions/mdfe-functions.js:23-34`).
- **Pesquisa documental:** painel oficial SVRS `https://dfe-portal.svrs.rs.gov.br/NFE/Servicos` (SEFAZ-RS/PROCERGS, acesso 14/10/2026, v4.00) — comprova endpoints de AM (`https://nfe.sefaz.am.gov.br/services2/services/NFeAutorizacao4`, corroborado por `http://sistemas.sefaz.am.gov.br/nfeweb-hom/portal/pdf/Enderecos_Web_Services_SEFAZ_AM.pdf`), MT (`https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4`), SVRS e SVAN (`https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx`) — Comprovação Completa para esses; painel SVC-RS `https://www.sefaz.rs.gov.br/NFE/NFE-SVC.aspx` comprova MA=SVAN e atendimento SVC-RS a AM/MA/MT — Completa nesse recorte. **NÃO VERIFICADO:** vínculo PA/RO/AC/AP↔SVRS e URLs por UF nessas SEFAZ; endpoints SVC-RS v4.00 dedicados; Informe RFB 25/04/2024 e unificação SVAN/SVC-AN; `nfe.fazenda.gov.br/portal/webservices.aspx` (retornou `Object moved`).
- **Classificação:** Comprovação Parcial (matriz abaixo mistura confirmado + NÃO VERIFICADO, sinalizado célula a célula).
- **Risco de alteração:** Alto (endpoint errado = outage estadual total). **Regressão:** NF-e (autorização/consulta/eventos/inutilização por UF); MDF-e fora de escopo (nacional SVRS); sem impacto em estoque/compras/vendas/financeiro/multi-tenant.
- **Plano (sem codar):** 1) confirmar células NÃO VERIFICADO no catálogo oficial/SEFAZ de cada UF; 2) estender `SEFAZ_EP` por UF×serviço×ambiente + passar `uf` em todas as chamadas; 3) homologação por UF (autoriza/consulta/evento/inutilização); 4) trava em teste com a matriz.

### P2 — DIFAL + FCP
- **Funcionamento atual:** §1. Interestadual sai sem `ICMSUFDest`; FCP-ST zerado.
- **Evidência:** `nf-config.js:84-87`; `nf-xml-builder.js:634-635`; dependem `calcularICMS`, natureza/CFOP/idDest, IE destino.
- **Pesquisa documental:** EC 87/2015 (`planalto.gov.br/ccivil_03/constituicao/emendas/emc87.htm`, 16/04/2015) — recolhe destino; não contribuinte recolhe remetente; transição 100% destino desde 2019 — Completa. LC 190/2022 (`planalto.gov.br/ccivil_03/leis/lcp/lcp190.htm`, 04/01/2022) — Completa. Conv. ICMS 93/15 + 236/21 (CONFAZ; mérito via reprodução SEFAZ-MT) — Parcial. NT 2015.003 v1.40 (Portal NF-e, Dez/2015) — grupo `ICMSUFDest` p/ consumidor final não contribuinte + FCP + rej. 807 p/ NFC-e — Completa no escopo. MOC 7.0 Anexo I (lista integral de tags) não recuperado na íntegra — NÃO VERIFICADO. FCP por UF (alíquotas) e vedação explícita de `ICMSUFDest` entre contribuintes — NÃO VERIFICADOS.
- **Classificação:** Comprovação Parcial (regra geral completa; tags integrais e FCP por UF pendentes).
- **Risco de alteração:** Crítico (cálculo de imposto interestadual; GNRE/FCP errado por UF). **Regressão:** NF-e (builder, totais, cStat 685/807), vendas (natureza/CFOP/idDest), financeiro (contas de GNRE, se houver); sem impacto em MDF-e/estoque/multi-tenant.
- **Plano:** 1) confirmar MOC vigente (tags `vBCUFDest/pFCPUFDest/pICMSUFDest/pICMSInter/vICMSUFDest/vICMSUFRemet/vFCPUFDest`); 2) tabela de alíquotas internas + FCP por UF destino (fonte: lei de cada UF, assinada pelo contador); 3) regra por caso (não contribuinte com grupo; contribuinte sem destaque — confirmar vedação); 4) testes por UF×caso + GNRE fora de escopo desta etapa.

### P3 — cBenef (somente arquitetura futura — D4)
- **Funcionamento atual:** inexistente (§1). Por ser multi-tenant, benefício é dado do cliente, não do software.
- **Evidência:** zero ocorrências de `cBenef` em builder/config/functions.
- **Pesquisa documental:** nenhuma tabela criada nem catalogada nesta etapa, por ordem expressa (D4). Arquitetura avaliada: campo configurável por tenant na config fiscal (preenchido pelo contador do cliente) + passthrough no builder + validação estrutural (formato), sem catálogo estadual próprio e sem valores inventados.
- **Classificação:** Evidência Insuficiente para valores (intencional); Comprovação Completa de que nada existe hoje.
- **Risco de alteração:** Médio (adição isolada futura). **Regressão:** nenhuma hoje; futura: NF-e builder/validador por tenant.
- **Plano:** quando o primeiro cliente com benefício surgir: 1) adicionar `cBenef` à config fiscal do tenant; 2) passthrough + validação estrutural; 3) teste por tenant; jamais tabela própria.

## 2. Relatórios por pendência — P4, P5, P6

### P4 — Timezone por UF
- **Funcionamento atual:** §1. `-03:00` fixo nos 4 pontos; correto em PA/AP/MA, errado em MT/RO/AM e AC.
- **Evidência:** `nf-xml-builder.js:80-85` (conversão + AAMM em `:91`), `nf-service.js:162`, `mdfe-xml-builder.js:58`, `nf-dashboard.js:23`.
- **Pesquisa documental:** MOC 7.0 Anexo I (`confaz.fazenda.gov.br/.../moc7-anexo-i-leiaute-e-rv.pdf`, ENCAT, v7.00 Nov/2020) — `B09 dhEmi` formato UTC `AAAA-MM-DDThh:mm:ssTZD` — Completa (formato). Regra 703 (data posterior ao recebimento, tolerância 5 min) confere em espelho SEFAZ-PR + SEFAZ-MG (06/11/2024) — Parcial (MOC oficial não extraído em texto; frase "hora local do emitente" só existe para NF3e, NÃO para NF-e 55/65 — NÃO VERIFICADO para 55). Fusos: Lei 12.876/2013 (`planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12876.htm`, 30/10/2013) — PA/AP/MA = −03; MT/RO/leste-AM = −04; AC/oeste-AM = −05 — Completa.
- **Classificação:** Comprovação Parcial (tende a Completa após ler MOC Anexo I em texto).
- **Risco de alteração:** Médio (matemática de offset pela UF do emitente; borda de dia muda AAMM/chave). **Regressão:** NF-e (`dhEmi`, chave, `dataEmissao`), MDF-e (`dhEmi`), dashboard (exibição); sem impacto em estoque/vendas/financeiro/multi-tenant.
- **Plano:** 1) confirmar 703 no MOC em texto; 2) mapa UF→offset a partir da config (`empresa.endereco.uf`), com oeste-AM como exceção documentada; 3) testes de borda (23h59 local × UTC) por UF; 4) manter `-03:00` como default PA.

### P5 — Contingência SVC
- **Funcionamento atual:** §1. Só emissão normal; sem FS-DA/SVC/EPEC em código.
- **Evidência:** `nf-config.js:40`, `nf-xml-builder.js:96`; busca confirma ausência.
- **Pesquisa documental:** MOC 7.0 Anexo III (`confaz.../moc7-anexo-iii-manual-contingencia-nf-e.pdf`, ENCAT, v7.00 Nov/2020) — FS-DA `tpEmis=5` (retransmite à origem); SVC-AN `tpEmis=6` e SVC-RS `tpEmis=7` (autorizam, DANFE comum, sem retransmissão; exigem ativação pela SEFAZ origem); quadro `1→só Normal, 5→só Normal, 6→só SVC-AN, 7→só SVC-RS` — Completa. MOC Anexo I B22 (`tpEmis 5/6/7`) — Completa. SVC-RS atende AM/MA/MT (painel SEFAZ-RS) — Completa nesse recorte; SVC de PA/RO/AC/AP — NÃO VERIFICADO em fonte oficial direta. NT/EPEC (2014.001) não aberta — NÃO VERIFICADO.
- **Classificação:** Comprovação Parcial (regras completas; mapeamento UF→SVC parcial).
- **Risco de alteração:** Alto (novo caminho de emissão, chave com `tpEmis` ≠ 1, DANFE distinto, sem retransmissão). **Regressão:** NF-e (emissão, chave, DANFE, consulta), MDF-e fora de escopo; sem impacto em estoque/vendas/financeiro/multi-tenant.
- **Plano:** 1) fechar mapeamento UF→SVC (PA/RO/AC/AP); 2) chave/DANFE/consulta por `tpEmis`; 3) gatilho operacional (só com SEFAZ origem ativada); 4) homologação SVC por UF; 5) EPEC avaliado à parte (NT não lida).

### P6 — cCredPres
- **Funcionamento atual:** §1. Formato + passthrough; tabela sem valores por orientação anti-obsolescência.
- **Evidência:** `nf-tax-tables.js:27-51` (`TABLE_META`), `:210-215` (`validarCCredPres`), passthrough em `nf-config.js`.
- **Pesquisa documental:** Portal NF-e → Documentos/Diversos (`nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=/NJarYc9nus=`, RFB/ENCAT) — Tabelas cCredPres e Classificação Tributária publicadas em 01/10/2026, ref. IT 2025.002 v1.70 — Completa (existência/local/versão). IT 2025.002 v1.70 (RFB/CGIBS, LC 214/2025; prefixo cClassTrib = CST; alíquotas 2026: IBS-UF 0,1%, IBS-Mun 0%, CBS 0,9%) — Parcial (fetch direto falhou; trechos via indexação + PDFs v1.11/v1.21). Tabela consultável SVRS (`dfe-portal.svrs.rs.gov.br/CFF/TabelaCreditoPresumido`, 13 códigos) — Completa (conteúdo; CSV/"2 dígitos" NÃO verificado).
- **Classificação:** Comprovação Parcial.
- **Risco de alteração:** Baixo (tabela versionada + validador, sob demanda). **Regressão:** NF-e validador/builder; demais módulos intactos.
- **Plano:** só no primeiro cliente com crédito presumido: 1) baixar CSV oficial e versionar; 2) validação semântica por código; 3) teste por código usado.

## 2. Relatórios por pendência — P7, P8, P9

### P7 — Prazo de cancelamento
- **Funcionamento atual:** §1. Mecanismo pronto, valor null (sem bloqueio). `dhAutorizacao` persistido.
- **Evidência:** `nf-config.js` (`prazosFiscais`), gêmeas de avaliação, gate `PRAZO_EXCEDIDO` no `nf_cancelarNFe`, pré-check em `notas-fiscais.html`.
- **Pesquisa documental:** Ajuste SINIEF 07/05 (CONFAZ, 30/09/2005) — "prazo não superior a 24 horas" — Completa. NT 2011/007 v1.00 (Portal NF-e, Dez/2011) — 24h contadas da autorização + exceção estadual + rej. 220 — Completa. NT 2018.004 (ENCAT, 20/12/2018) — autorizada há +24h → rej. 501; substituição +7 dias (168h) → 501; SEFAZ pode aceitar fora de prazo com status 155 — Completa (efeitos pós-prazo variam por UF — Parcial nesse ponto). CC-e: limites e `xCondUso` literal (NT 2011/003 v1.01 + SEFAZ-MG/MOC 6.00; o literal já está em `functions/nf-functions.js:77`) — Completa; prazo 720h/30d e Ajuste SINIEF 15/2025 — NÃO VERIFICADOS.
- **Classificação:** Comprovação Completa (cancelamento 24h + 155 + substituição 168h).
- **Risco de alteração:** Baixo (só preencher `cancNFeHoras: 24`; `ccNFeHoras` segue null até confirmar). **Regressão:** NF-e eventos; mecanismo já testado (`tests/nfe-prazo-cancel.test.mjs`).
- **Plano:** 1) preencher `24` após aprovação deste dossiê; 2) monitorar rejeições 155/220/501 por UF; 3) CC-e: só confirmar 720h em fonte oficial.

### P8 — NCM estrutural (sem classificação — premissa do projeto)
- **Funcionamento atual:** §1. 8 dígitos + rejeita `00000000` em item; existência em tabela (`nf-validator.js:189/:475`); usuário informa.
- **Evidência:** `nf-itens.js:22-27`, `nf-validator.js:49-53`, `notas-fiscais.html:3595`.
- **Pesquisa documental:** NT 2014.004 v1.10 (Portal NF-e, 2014) — `00000000` permitido quando o item não puder ser classificado; NCM completo obrigatório — Completa. Compilado RV (NT 2015) — `I05-20`: NCM de 8 pos. inexistente na tabela MDIC → rej. 778 — Completa. Vedação absoluta de `00000000` em mercadoria — NÃO VERIFICADA (há exceção oficial).
- **Classificação:** Comprovação Completa (validação estrutural). NADA a inferir/classificar por ordem expressa.
- **Risco de alteração:** Baixo. **Regressão:** NF-e itens; nenhum outro módulo.
- **Plano:** manter; opcional futuro: checar existência contra TIPI versionada (sem sugerir código ao usuário).

### P9 — Documentação florestal (levantamento apenas — sem implementar)
- **Funcionamento atual:** §1. Sistema não trata DOF/GF; MDF-e sem campo florestal.
- **Evidência:** ausência verificada; MDF-e só `infDoc`/`prodPred`/`infAdic`.
- **Pesquisa documental:** DOF (Portaria MMA 253/2006, DOU 21/08/2006) — Completa. IN IBAMA 21/2014 art.31/35 (licença obrigatória; campo fiscal obrigatório; **1 DOF : 1 NF**; divergência DOF×NF pune — Lei 9.605/98) — Completa. IN IBAMA 16/2022 (DOF+ rastreabilidade; coexistência Legado/DOF+) — Completa. IN IBAMA 3/2025 (migração exclusiva ao DOF+ desde 10/02/2025) — Completa. CONAMA 379/2006 (nº do doc. fiscal dentro do DOF) — Parcial. PA: Dec. 2.596/2022 (GF1 tora/AUTEF, GF3/GF3i serrada, validade nacional) — Completa; IN SEMA-PA 01/2008 (GF1 tora, GF3 serrada) — Parcial; exemplar GF3 exige chave NF-e + baixa em posto de fronteira — Parcial. MT: IN SEMA-MT 01/2006 (GF própria) — Parcial (detalhe tora/serrada NÃO VERIFICADO). Consulta pública IBAMA integra DOF/DOF+/Sisflora-PA-MT — Parcial (consulta, não webservice). MOC MDF-e 3.00b (07/12/2022) e MOC NF-e 7.0 Anexo I (NCM I05) — **sem tag DOF/GF no leiaute** — Parcial. RO/AC/AM/AP/MA (sistema próprio vs direto; guia por produto) e qualquer webservice SEFAZ↔IBAMA/SEMA — NÃO VERIFICADOS.
- **Classificação:** Comprovação Parcial (núcleo federal + PA completos; demais UFs e integração pendentes).
- **Risco de alteração:** N/A (nada a implementar). **Conclusão ERP:** obrigatório/integrar = exigir nº DOF/GF pareado 1:1 com a NF (bloqueio operacional futuro); apenas levantamento = consulta/validação automática e campo fiscal-DOF.
- **Plano:** 1) fechar RO/AC/AM/AP/MA/⋅⋅⋅MT-detalhe com órgãos; 2) se confirmado, especificar pareamento operacional (digitação + conferência 1:1), nunca integração automática sem layout oficial.

## 3. Lei da Transparência — percentual médio
- Lei 12.741/2012 (`planalto.gov.br/.../l12741.htm`, DOU 10/12/2012): art.1º valor aproximado da totalidade dos tributos por mercadoria/serviço; §2º admite painel/percentual aproximado; art.2º admite cálculo por instituição idônea semestral (rol: ICMS, ISS, IPI, IOF, PIS/Pasep, Cofins, Cide) — Completa. Decreto 8.264/2014 (`.../d8264.htm`, DOU 06/06/2014): três resultados por ente, em campo próprio ou Informações Complementares; painel facultativo; médias estimadas por NCM/NBS; caráter informativo — Completa. "Percentual médio" não é literal da lei; tabela IBPT é **opcional** (`poderá`, `a critério`), não obrigatória; Portaria 85/2014 NÃO verificada.
- Estado atual (§1) já cumpre o núcleo: `vTotTrib` soma real dos tributos; texto aproximado só em `infCpl`. Plano: manter; documentar origem do percentual médio usado no texto (IBPT opcional ou média própria por NCM), sem motor, sem licenciamento, sem integração.

## 4. Matrizes

### 4.1 Autorizadores NF-e mod 55 (P1) — ⚠ células marcadas NÃO VERIFICADO exigem confirmação
| UF | Autorizador prod. | URL produção (NFeAutorizacao4) | Homologação | SVC | Obs |
|---|---|---|---|---|---|
| PA | SVRS* | `https://nfe.svrs.rs.gov.br/...` | `https://nfe-homologacao.svrs.rs.gov.br/...` | SVC-AN* | *NÃO VERIFICADO em fonte oficial direta |
| MT | SEFAZ-MT própria | `https://nfe.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4` | `https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeAutorizacao4` | SVC-RS | Confirmado (SVRS + painel SVC-RS) |
| RO | SVRS* | SVRS (idem PA) | SVRS homolog (idem) | SVC-AN* | *NÃO VERIFICADO |
| AC | SVRS* | SVRS (idem PA) | SVRS homolog (idem) | SVC-AN* | *NÃO VERIFICADO |
| AM | SEFAZ-AM própria | `https://nfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4` | `https://homnfe.sefaz.am.gov.br/services2/services/NfeAutorizacao4` | SVC-RS | Confirmado (duas fontes) |
| AP | SVRS* | SVRS (idem PA) | SVRS homolog (idem) | SVC-AN* | *NÃO VERIFICADO |
| MA | SVAN | `https://www.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx` | `https://hom.sefazvirtual.fazenda.gov.br/NFeAutorizacao4/NFeAutorizacao4.asmx` | SVC-RS | Confirmado (painel SVC-RS) |

### 4.2 Timezones fiscais (P4) — Lei 12.876/2013, Comprovação Completa
| UF | UTC | Offset fiscal |
|---|---|---|
| PA | −03 | `-03:00` |
| MA | −03 | `-03:00` |
| AP | −03 | `-03:00` |
| MT | −04 | `-04:00` |
| RO | −04 | `-04:00` |
| AM (leste Tabatinga–Porto Acre) | −04 | `-04:00` |
| AM (oeste) / AC | −05 | `-05:00` |
Impacto: `dhEmi`, AAMM da chave, `dataEmissao` (NF-e) e `dhEmi` (MDF-e).

### 4.3 DIFAL (P2) — regra vigente comprovada
EC 87/2015 + LC 190/2022 + Conv. 236/21: destino não contribuinte → remetente recolhe DIFAL+FCP (grupo `ICMSUFDest`); destino contribuinte → ele recolhe (sem destaque); transição 100% destino desde 2019. Tags integrais e FCP por UF: NÃO VERIFICADOS.

### 4.4 Contingência (P5) — MOC 7.0 Anexo III, Comprovação Completa
`tpEmis`: 1 Normal · 5 FS-DA (retransmite) · 6 SVC-AN · 7 SVC-RS (sem retransmissão; exigem ativação pela origem). SVC-RS: AM/MT/MA. SVC demais UFs: NÃO VERIFICADO.

### 4.5 Riscos
| Pendência | Alteração | Regressão NF-e | Regressão MDF-e | Demais módulos |
|---|---|---|---|---|
| P1 | Alto | autorização/consulta/eventos/inutil por UF | nenhuma | nenhuma |
| P2 | Crítico | builder/totais/733-807 | nenhuma | vendas, financeiro |
| P3 | Médio (futura) | builder/validador por tenant | nenhuma | nenhuma |
| P4 | Médio | dhEmi/chave/exibição | dhEmi | nenhuma |
| P5 | Alto | emissão/chave/DANFE/consulta | nenhuma | nenhuma |
| P6 | Baixo | validador/builder | nenhuma | nenhuma |
| P7 | Baixo | eventos | nenhuma | nenhuma |
| P8 | Baixo | itens | nenhuma | nenhuma |
| P9 | N/A | informar DOF/GF em `infCpl` (prática, sem validação SEFAZ) | `infAdic` | romaneios (origem do nº da guia) |

## 5. Plano de implementação seguro (só após aprovação deste dossiê)
1. Fechar células NÃO VERIFICADO (P1/P5/P2-tags/FCP-UF/P9-UFs) nas fontes oficiais.
2. Deploy pendente rules/functions (@devops) — pré-requisito de tudo em produção.
3. P1: matriz por UF×serviço×ambiente + `uf` em todas as chamadas + homologação por UF + travas em teste.
4. P4: mapa UF→offset + testes de borda por UF (default PA).
5. P7: preencher `cancNFeHoras: 24`.
6. P2: tags MOC + tabela de alíquotas/FCP assinada pelo contador + testes UF×caso (bloqueio interestadual opcional até aqui).
7. P5: `tpEmis` 5/6/7 + chave/DANFE/consulta + gatilho com origem ativada + homologação SVC.
8. P6/P8-manutenção: sob demanda do primeiro caso real.
9. P9: especificação operacional de pareamento 1:1 (digitação + conferência), sem automação sem layout oficial.
10. Porta de entrada por UF: roteiro de homologação (autoriza/consulta/CC/cancela/inutiliza) antes de ligar produção.

## 6. Restrições e resultado
- Restrições absolutas respeitadas: nenhum comportamento fiscal validado, emissão, homologação, certificado ou fluxo de produção foi alterado — zero diffs de código nesta fase (verificável via `git status`).
- Entregue (10 itens): 1) inventário técnico §1 · 2) inventário documental §§2–3 · 3) matriz de riscos §4.5 · 4) matriz de autorizadores §4.1 · 5) matriz de timezones §4.2 · 6) matriz DIFAL §4.3 · 7) matriz contingência §4.4 · 8) plano §5 · 9) impactos §4.5 · 10) regressão §4.5 (por módulo, por pendência).
- A implementação somente poderá ser proposta após a conclusão integral desta fase documental — concluída neste arquivo, pendente apenas sua aprovação.
