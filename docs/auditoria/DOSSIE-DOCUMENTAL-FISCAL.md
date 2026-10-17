# DOSSIÊ DOCUMENTAL FISCAL — SISWEB (NF-e / MDF-e)

**Data:** 2026-10-16  
**Status:** Em elaboração — pendente de pesquisa oficial externa para itens marcados com [PESQUISA]  
**Escopo:** NF-e (modelo 55) e MDF-e (modelo 58)  
**Decisões já aprovadas pelo usuário:** incorporadas (ver seção Decisões Aprovadas)

---

## 1. Decisões aprovadas pelo usuário (base do dossiê)

| Item | Decisão | Fonte | Impacto no código |
|------|---------|-------|-------------------|
| Autorizador PA | SVRS (NF-e + MDF-e) | Usuário confirmado | Endpoints já mapeados em `functions/mdfe-functions.js` / `functions/nf-functions.js` |
| Autorizador RO | SVRS | Confirmado | Idem |
| Autorizador AC | SVRS | Confirmado | Idem |
| Autorizador RR | SVRS | Confirmado | Idem |
| Autorizador MT | Autorizador próprio | Confirmado | Verificar endpoints próprios |
| Autorizador AM | Autorizador próprio | Confirmado | Verificar endpoints próprios |
| cClassTrib | Do cadastro da Natureza da Operação (usuário) | Usuário | Não inferir automaticamente do NCM |
| cCredPres | Do cadastro da Natureza da Operação (usuário) | Usuário | Não aplicar percentual médio automático |
| Lei 12.741/2012 | Percentual médio somente (não regra de cálculo automática) | Usuário | Referência apenas |
| Reforma Tributária IBS/CBS | Depende (norma em tramitação) | Usuário = P7 | Não implementar alíquotas definitivas ainda |
| Versões vigentes | Atualizar para 2025 com precisão | Usuário = P8 | Atualizar XSD/NT com cuidado |
| Itens fora de escopo | Não aplicável | Usuário = P9 | — |

---

## 2. Dossiê documental — itens A a H

### A) Matriz completa de autorizadores NF-e por UF

**Status:** Parcialmente preenchido (P2 — documentação parcial).  
**O que falta:** pesquisa oficial nos portais de cada UF para confirmar URLs de homologação/produção e versões.

| UF | Autorizador | Versão leiaute | Homologação (URL WSDL) | Produção (URL WSDL) | Status | Fonte oficial | Data acesso | Classificação |
|----|-------------|----------------|------------------------|---------------------|--------|---------------|-------------|---------------|
| PA | SVRS | NF-e 4.00 / MDF-e 3.00 | SVRS homologação | SVRS produção | Ativo | Decisão usuário | — | P1 (confirmado) |
| RO | SVRS | NF-e 4.00 / MDF-e 3.00 | SVRS homologação | SVRS produção | Ativo | Decisão usuário | — | P1 |
| AC | SVRS | NF-e 4.00 / MDF-e 3.00 | SVRS homologação | SVRS produção | Ativo | Decisão usuário | — | P1 |
| RR | SVRS | NF-e 4.00 / MDF-e 3.00 | SVRS homologação | SVRS produção | Ativo | Decisão usuário | — | P1 |
| MT | Próprio | — | — | — | — | — | — | P3 (pendente pesquisa) |
| AM | Próprio | — | — | — | — | — | — | P3 (pendente pesquisa) |
| Outras UFs (AP, MA, CE, etc.) | — | — | — | — | — | — | — | P3 (pendente pesquisa) |

**Impacto:** Se MT/AM usam URLs diferentes de SVRS, `functions/mdfe-functions.js` e `functions/nf-functions.js` precisam de novos blocos `SVC_POR_UF` ou equivalente. Não implementar sem WSDL oficial.

---

### B) Matriz de contingência SVC por UF

**Status:** Parcial (P2/P3).  
**Conhecido:** SEFAZ exige `<IBSCBS>` sempre (cStat 1115 se omitido). Alíquotas de teste oficiais IT 2025.002 v1.70: `pIBSUF=0.1%`, `pCBS=0.9%`. Total deve somar centavos arredondados (1080 se diverge 1 centavo).

**O que falta:** catálogo oficial por UF (qual UF usa SVC-AN, SVC-RS, etc.) e URLs dos serviços de contingência.

| UF | Tipo contingência | Versão | URL serviço | tpEmis | Validade | Fonte oficial | Classificação |
|----|-------------------|--------|-------------|--------|----------|---------------|---------------|
| PA | — | — | — | — | — | — | P3 |
| RO | — | — | — | — | — | — | P3 |
| AC | — | — | — | — | — | — | P3 |
| RR | — | — | — | — | — | — | P3 |
| MT | — | — | — | — | — | — | P3 |
| AM | — | — | — | — | — | — | P3 |

**Impacto:** `SVC_POR_UF` e `getEndpoint(...,tpEmis)` em `functions/nf-functions.js` já existem para PA/MT/RO/AC/AM/AP/MA (escopo D1). Outras UFs precisam de pesquisa.

---

### C) Tabela oficial cClassTrib

**Status:** Pendente (P3).  
**Decisão aprovada:** vir do cadastro da Natureza da Operação; não inferir do NCM.

| Código cClassTrib | Descrição | NCM vinculado | Aplica NF-e | Aplica MDF-e | Fonte oficial | Classificação |
|-------------------|-----------|---------------|-------------|--------------|---------------|---------------|
| — | — | — | — | — | — | P3 (pesquisa Receita Federal) |

**Impacto:** `nf-xml-builder.js` e validadores devem ler `cClassTrib` da natureza da operação, não calcular.

---

### D) Tabela oficial cCredPres

**Status:** Pendente (P3).

| Código cCredPres | Descrição | Percentual | Base de cálculo | Aplica NF-e | Fonte oficial | Classificação |
|------------------|-----------|------------|-----------------|-------------|---------------|---------------|
| — | — | — | — | — | — | P3 |

**Impacto:** idêntico ao cClassTrib.

---

### E) Tabela oficial CST IBS/CBS

**Status:** Parcial (P2/P7).  
**Conhecido:** CST 000 exige alíquota válida (cStat 1026 se 0.0000%). Alíquotas de teste transição: pIBSUF=0.1%, pCBS=0.9%.

| CST | Descrição | pIBSUF | pCBS | Validade transição | Fonte oficial | Classificação |
|-----|-----------|--------|------|--------------------|---------------|---------------|
| 000 | Tributada integralmente | 0.1% | 0.9% | Teste (IT 2025.002 v1.70) | SEFAZ homologação | P2 (teste) |
| Outros | — | — | — | — | — | P3 (definitivo depende regulamento) |

**Impacto:** `calcularIBSCBS` em `nf-config.js` já aplica 0.1%/0.9% para CST 000. Definitivo depende de P7.

---

### F) Relação das NTs vigentes aplicáveis ao projeto

**Status:** Pendente (P3/P8).

| NT número | Versão | Data publicação | Tema | Aplica NF-e | Aplica MDF-e | Impacto XML/XSD | Status | Fonte oficial | Classificação |
|-----------|--------|-----------------|------|-------------|--------------|-----------------|--------|---------------|---------------|
| — | — | — | — | — | — | — | — | — | P3/P8 |

**Impacto:** Atualizar XSD para 2025 (vigente). Não implementar sem versão confirmada.

---

### G) Capítulo 44 completo da TIPI para produtos florestais

**Status:** Pendente (P3).

| Código TIPI | Descrição produto florestal | Alíquota | Unidade | Observações | Fonte oficial | Classificação |
|-------------|----------------------------|----------|---------|-------------|---------------|---------------|
| — | — | — | — | — | — | P3 |

**Impacto:** Produtos florestais (madeira, serrados, toras) no romaneio PCT/NFe. Precisa da tabela oficial.

---

### H) RICMS/PA e fontes estaduais relevantes

**Status:** Pendente (P3).

| Dispositivo | Descrição | Alíquota interna PA | Alíquota interestadual origem PA | Alíquota interestadual destino PA | DIFAL | FCP | ICMS-ST | Fonte | Classificação |
|-------------|-----------|---------------------|----------------------------------|-----------------------------------|-------|-----|---------|-------|---------------|
| — | — | — | — | — | — | — | — | — | P3 |

**Impacto:** DIFAL/FCP estão em escopo D2 (pendente). Não implementar sem tabela oficial PA.

---

## 3. Classificação resumida P1–P9

| Código | Significado | Quantidade itens neste dossiê | Exemplos |
|--------|-------------|------------------------------|----------|
| P1 | Documentação completa | 4 (PA, RO, AC, RR autorizadores SVRS) | Autorizadores confirmados |
| P2 | Documentação parcial | 2 (IBS/CBS teste, contingência conhecida parcialmente) | Alíquotas 0.1%/0.9% |
| P3 | Documentação insuficiente / pendente pesquisa | MT, AM autorizadores; SVC outras UFs; cClassTrib; cCredPres; NTs; TIPI Cap.44; RICMS/PA | Grande parte do dossiê A–H |
| P4 | Dependente proprietário | — | — |
| P5 | Dependente contador | cClassTrib, cCredPres, CFOP, TIPI, RICMS/PA | — |
| P6 | Conflito entre fontes | — | — |
| P7 | Pendente publicação oficial | IBS/CBS definitivo | Reforma Tributária |
| P8 | Versão defasada | XSD/NT 2025 | Atualizar com precisão |
| P9 | Não aplicável | — | — |

---

## 4. Matriz Proprietário × Contador

| Item | Proprietário do projeto | Contador |
|------|------------------------|----------|
| Escolha autorizador por UF | Decide (infraestrutura, credenciais) | Aconselha |
| Alíquotas ICMS/DIFAL/FCP PA | Fornece dados de operação | Define alíquota (RICMS/CONFAZ) |
| cClassTrib | Fornece NCM | Classifica e atribui |
| cCredPres | Fornece operação | Define percentual/base |
| CST IBS/CBS | Fornece regime empresa | Define CST e alíquotas |
| CFOP | Descreve operação | Atribui CFOP correto |
| TIPI Cap.44 | Informa produto florestal | Classifica código/alíquota |
| Lei 12.741/2012 | Informa operação | Aplica percentual médio |
| Prazos cancelamento/inutilização | Define política interna | Confirma limites legais |
| Credenciais A1 | Executa cadastro | Aconselha uso |

---

## 5. Plano de implementação (arquivos, linhas, testes)

**Ordem sugerida (sujeita à aprovação do dossiê):**

### 5a. MT e AM — autorizadores próprios (P3)
- Arquivo: `functions/mdfe-functions.js`, `functions/nf-functions.js`
- Ação: adicionar endpoints WSDL próprio de MT/AM (se existirem) ao mapeamento `SVC_POR_UF` / `SEFAZ_EP`
- Teste: validar endpoint responde em homologação
- Risco: sem WSDL oficial, não implementar

### 5b. cClassTrib / cCredPres (P5 — contador)
- Arquivo: `nf-xml-builder.js`, `nf-validator.js`, `nf-config.js`
- Ação: ler do cadastro da Natureza da Operação; não inferir do NCM
- Teste: validar que XML emite com valores do cadastro

### 5c. Atualização XSD/NT para 2025 (P8)
- Arquivo: `tests/schemas/nfe/*`, `nf-xml-builder.js`
- Ação: validar contra XSD vigente 2025
- Teste: suíte fiscal com XSD oficial

### 5d. IBS/CBS definitivo (P7)
- Aguardar regulamento publicado. Não implementar alíquotas definitivas agora.

### 5e. DIFAL/FCP PA (D2 — escopo futuro)
- Arquivo: `nf-config.js`, `nf-xml-builder.js`
- Aguardar tabela oficial RICMS/PA (P3)

---

## 6. Próximos passos imediatos (não requerem pesquisa externa)

1. **Validar se MT/AM já têm endpoints no código** (leitura somente do código existente).
2. **Executar gates** (`lint`, `typecheck`, `npm test`) para confirmar estado verde antes de qualquer nova alteração.
3. **Registrar decisões no Cérebro** (cont. 33).

---

## 7. Evidências e fontes (registro)

- Código existente: `functions/mdfe-functions.js`, `functions/nf-functions.js` (endpoints SVRS confirmados)
- Decisões do usuário: registradas nesta seção 1
- Não há URL oficial baixada neste contexto (limitação de ambiente). Pesquisa externa obrigatória para itens P3.

---

**Não implementado:** nenhuma linha de código fiscal nesta etapa.  
**Aguardando:** aprovação do usuário sobre este dossiê antes do plano de execução.