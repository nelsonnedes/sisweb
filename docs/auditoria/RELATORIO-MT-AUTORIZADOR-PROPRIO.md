# RELATÓRIO ESPECÍFICO — MT (Mato Grosso) — Autorizador Próprio de MDF-e/NF-e

**Data:** 2026-10-16  
**Status:** PENDENTE_VALIDAÇÃO_ENDPOINT  
**UF:** MT  
**Autorizador:** Próprio (SEFAZ-MT) — não SVRS  

---

## 1. Endpoints encontrados

| Serviço | URL | Fonte |
|---------|-----|-------|
| — | — | — |

**Nenhum endpoint encontrado.** O Portal Nacional da NF-e confirma MT como autorizador próprio, mas não forneceu as URLs dos web services no escopo desta consulta.

---

## 2. Endpoints ausentes

Todos os serviços obrigatórios estão ausentes:

| Serviço | URL esperada | Status |
|---------|--------------|--------|
| NFeAutorizacao4 | — | Ausente |
| NFeRetAutorizacao4 | — | Ausente |
| NFeConsultaProtocolo4 | — | Ausente |
| NFeRecepcaoEvento4 | — | Ausente |
| NfeInutilizacao4 | — | Ausente |
| NfeStatusServico4 | — | Ausente |
| CadConsultaCadastro4 | — | Ausente |

---

## 3. Risco de implementação

| Risco | Nível | Descrição |
|-------|-------|-----------|
| MT não autorizada para emissão | Alto | Enquanto não houver endpoint, qualquer tentativa de autorização de NF-e/MDF-e para MT lançará `failed-precondition` (`PENDENTE_VALIDAÇÃO_ENDPOINT`). |
| Regressão para outras UFs | Baixo | As UFs SVRS (PA, RO, AC, AP, MA via SVAN) continuam funcionando normalmente. |
| Código hardcoded | Médio | A matriz `SEFAZ_EP.producao.MT` contém apenas marcador de status, sem URL. |

---

## 4. Impacto em homologação

- **Nenhum impacto em homologação** para MT: o ambiente de homologação (`SEFAZ_EP.homologacao`) continua usando SVRS para todas as UFs. MT não tem bloco próprio em homologação.
- **Produção MT bloqueada:** emissões para MT em ambiente de produção retornarão erro `failed-precondition` até que as URLs oficiais sejam preenchidas.

---

## 5. Plano de ativação

| Etapa | Ação | Responsável | Status |
|-------|------|-------------|--------|
| 1 | Obter URLs oficiais dos web services da SEFAZ-MT (NFeAutorizacao4, NFeRetAutorizacao4, NFeConsultaProtocolo4, NFeRecepcaoEvento4, NfeInutilizacao4, NfeStatusServico4, CadConsultaCadastro4) | Usuário / Suporte SEFAZ-MT | Pendente |
| 2 | Preencher `SEFAZ_EP.producao.MT` com as URLs obtidas | Desenvolvedor | Pendente |
| 3 | Alterar `SVC_POR_UF.MT` de `'mt'` para o identificador correto (se aplicável) | Desenvolvedor | Pendente |
| 4 | Validar em homologação com certificado A1 de MT | Usuário | Pendente |
| 5 | Liberar MT para produção | Usuário / SEFAZ-MT | Pendente |

---

## 6. Regras aplicadas (não negociáveis)

- **Não apontar MT para SVRS:** confirmado que MT tem autorizador próprio.
- **Não apontar MT para AM:** cada estado tem seu próprio autorizador.
- **Não inventar URL:** sem URL oficial, MT permanece com status `PENDENTE_VALIDAÇÃO_ENDPOINT`.
- **Não criar fallback automático:** se MT for chamada sem endpoint válido, o sistema lança `failed-precondition` e não tenta outro autorizador.
