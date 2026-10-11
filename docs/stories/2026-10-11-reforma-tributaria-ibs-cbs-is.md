# Reforma Tributária — Aderência do módulo NF-e (IBS/CBS/IS)

**Data:** 2026-10-11
**Módulo:** `notas-fiscais.html` + `nf-*.js` + `functions/nf-functions.js`
**Natureza:** análise de lacuna (gap analysis) + plano. **Nenhuma implementação** — depende do leiaute/XSD oficial da NT vigente.

## 1. Fontes oficiais consultadas

- **Receita Federal — Reforma Tributária** (`gov.br/receitafederal/pt-br/assuntos/reforma-tributaria`): área oficial com "Aderir ao Piloto da CBS", "Escolher Regime de Apuração de IBS e CBS", NFS-e. Confirma o piloto CBS e a escolha de regime para 2027.
- **Comitê Gestor do IBS — CGIBS** (`cgibs.gov.br`): publica Leis, Resoluções, Regulamentos, Portarias, Atos Conjuntos, Atos Técnicos Conjuntos, Guia Orientativo e Documentos Técnicos. Destaques vigentes:
  - *Ato Técnico Conjunto nº 6/2026* — versão 1.3.0 da documentação técnica (DeRE), com Manual de Orientação do Usuário (MOD).
  - *Portaria Conjunta RFB/CGIBS* — cálculo das alíquotas de IBS/CBS sobre combustíveis (CBS a partir de 2027; IBS a partir de 2029).
  - *Comunicado* — endpoints de produção do DeRE; transmissão de lotes a partir de 09h00 de 01/10/2026.
- **Portal Nacional da NF-e** (`nfe.fazenda.gov.br`): **inacessível no momento desta auditoria** (erro de transporte). A NT 2024.002 (grupos/campos IBS/CBS e Imposto Seletivo para NF-e/NFC-e) e o XSD correspondente **não puderam ser baixados para validação direta**.

> Observação de método: sem o XSD/NT oficial em mãos, qualquer geração de XML com os grupos IBS/CBS/IS seria feita "às cegas" — vedado pela regra de não inventar. Por isso a implementação fica condicionada ao leiaute oficial.

## 2. Situação atual (evidência de código)

Busca por `IBS`, `CBS`, `Imposto Seletivo`, `reforma tribut` (case-insensitive) em front (`notas-fiscais.html`, `nf-*.js`), backend (`functions/**`) e regras: **zero ocorrências** (só falsos positivos em hashes/URLs).

- `nf-xml-builder.js` gera apenas os grupos atuais (ICMS/PIS/COFINS/IPI) — sem `<IBSCBS>`/`<CBS>`/IS.
- `nf-config.js` não tem estrutura de alíquotas/reduções de IBS/CBS/IS.
- `nf-danfe.js` não exibe destaque de IBS/CBS/IS.

## 3. Lacunas identificadas

| # | Lacuna | Onde |
|---|---|---|
| L1 | Ausência dos grupos/`<IBSCBS>`/campos de IBS e CBS no XML | `nf-xml-builder.js` |
| L2 | Ausência do Imposto Seletivo (IS) no XML | `nf-xml-builder.js` |
| L3 | Config fiscal sem alíquotas/reduções/classificação de IBS/CBS/IS | `nf-config.js`, `notas-fiscais.html` (Configuração) |
| L4 | DANFE sem campos de destaque de IBS/CBS | `nf-danfe.js` |
| L5 | Sem adequação ao layout 4.00 ampliado / regras de transição | todo o módulo |

## 4. Riscos futuros

- NFS-e/NFC-e/NF-e passam a exigir os novos grupos conforme cronograma (CBS 2027, IBS 2029; piloto já em curso). Sem os campos, documentos podem ser rejeitados por schema.
- Regime do Simples Nacional com opção de apuração CBS/IBS (novo) muda o cálculo de `nf-config.js`.
- DeRE (obrigações acessórias) é um sistema separado (endpoints divulgados) — fora do escopo do emissor de NF-e, mas relevante para integração.

## 5. Plano (condicionado à NT/XSD oficial)

1. **Obter** a NT 2024.002 (Portal NF-e) e o XSD 4.00 atualizado (lista de schemas oficiais).
2. **Modelar** config de IBS/CBS/IS (alíquotas, CST de IBS/CBS, classificações, reduções, IS por NCM).
3. **Implementar** os grupos no `nf-xml-builder.js` com testes de schema.
4. **DANFE**: incluir os destaques.
5. **Testes**: gerar XML e validar contra XSD oficial (não apenas string-match).
6. **Habilitar** por ambiente/versão de layout, mantendo compatibilidade retroativa.

## 6. Recomendação

Não implementar IBS/CBS/IS antes de obter o leiaute oficial (NT 2024.002 + XSD). Registrado como **lacuna conhecida** com trava de teste (`tests/nf-emissao-sefaz.test.mjs`) que sinaliza quando os campos passarem a existir.
