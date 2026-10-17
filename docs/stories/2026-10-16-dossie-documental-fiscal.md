# Story — Execução do Dossiê Documental Fiscal (NF-e / MDF-e)

**Data:** 2026-10-16  
**Status:** Planejado (aguardando aprovação do dossiê para execução)  
**Base:** `docs/auditoria/DOSSIE-DOCUMENTAL-FISCAL.md`  
**Decisões aprovadas:** P4 (autorizadores), P5/P6 (cClassTrib/cCredPres do cadastro), P7 (IBS/CBS depende), P8 (XSD 2025), P9 (não aplicável)

---

## Objetivo

Concluir a auditoria documental fiscal (itens A–H), classificar pendências P1–P9, definir matriz proprietário × contador e produzir plano de implementação — **sem alterar código fiscal nesta fase**.

---

## Itens A–H (resumo do dossiê)

| Item | Conteúdo | Classificação | Responsável |
|------|----------|---------------|-------------|
| A | Matriz autorizadores NF-e por UF | P1 (PA/RO/AC/RR), P3 (MT/AM/outros) | Pesquisa oficial |
| B | Matriz contingência SVC por UF | P2/P3 | Pesquisa oficial |
| C | Tabela cClassTrib | P3 | Contador |
| D | Tabela cCredPres | P3 | Contador |
| E | Tabela CST IBS/CBS | P2 (teste), P3 (definitivo) | Contador |
| F | Relação NTs vigentes | P3/P8 | Pesquisa oficial |
| G | TIPI Cap.44 florestal | P3 | Contador |
| H | RICMS/PA | P3 | Contador |

---

## Matriz Proprietário × Contador (resumo)

| Item | Proprietário | Contador |
|------|-------------|----------|
| Autorizador por UF | Decide | Aconselha |
| Alíquotas ICMS/DIFAL/FCP PA | Dados de operação | Define alíquota |
| cClassTrib / cCredPres | Fornece NCM/operação | Classifica/define |
| CST IBS/CBS | Regime empresa | Define CST/alíquotas |
| CFOP | Descreve operação | Atribui CFOP |
| TIPI Cap.44 | Produto florestal | Classifica |

---

## Plano de implementação (ordem sugerida)

| Etapa | Ação | Arquivos | Testes | Risco |
|-------|------|----------|--------|-------|
| 1 | Verificar endpoints MT/AM no código existente | `functions/mdfe-functions.js`, `functions/nf-functions.js` | Validar endpoint homologação | Baixo (leitura) |
| 2 | cClassTrib/cCredPres do cadastro (não inferir NCM) | `nf-xml-builder.js`, `nf-validator.js`, `nf-config.js` | Validar XML com valores cadastro | Médio |
| 3 | Atualizar XSD/NT para 2025 | `tests/schemas/nfe/*`, `nf-xml-builder.js` | Suíte fiscal com XSD oficial | Médio |
| 4 | IBS/CBS definitivo | Aguardar P7 | — | Alto (não iniciar sem regulamento) |
| 5 | DIFAL/FCP PA | Aguardar tabela oficial PA | — | Alto (não iniciar sem tabela) |

---

## Checklist de conclusão (marcar após aprovação e execução)

- [ ] Dossiê documental A–H preenchido
- [ ] Classificações P1–P9 atribuídas
- [ ] Matriz proprietário × contador definida
- [ ] Pesquisa oficial externa concluída (URLs, versões, datas)
- [ ] Plano de implementação aprovado
- [ ] Gates executados: `lint`, `typecheck`, `npm test`
- [ ] Registro no `docs/core/CEREBRO-SISWEB.md`
- [ ] Checklist e file list da story atualizados

---

**Não implementado:** nenhuma linha de código fiscal nesta etapa.  
**Bloqueado por:** pesquisa oficial externa (XSDs, NTs, RICMS/PA, TIPI) que requer acesso aos portais oficiais.