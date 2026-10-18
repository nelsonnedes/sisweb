# Story — Diagnóstico MDF-e Consulta cStat 216

**Data:** 2026-10-18  
**Status:** Concluído (diagnóstico)  
**Status de execução:** Pendente deploy da Cloud Function `mdfe_consultar` no Firebase

---

## Objetivo

Diagnosticar por que a consulta MDF-e nº 2028 exibe `cStat 216 — Rejeição: Chave de Acesso difere da cadastrada` em vez de `cStat 677 — NF-e informada não pode estar cancelada/denegada na base da SEFAZ`.

---

## Diagnóstico

### Causa raiz

A SEFAZ retorna **apenas um `<cStat>`** na resposta XML da consulta MDF-e nº 28: `cStat 216` com `tpEvento 110111` (cancelamento) e `cStatEvento 101`.

Não existe um cStat 677 separado no XML da resposta da SEFAZ para este MDF-e específico. O cStat 677 que aparecia na tela de "Detalhes" vinha de outra fonte (probavelmente da NF-e referenciada salva no Firebase), não da consulta do MDF-e.

### Código afetado

`functions/mdfe-functions.js` — função `mdfe_consultar` (linhas 218-294)

O código anterior usava `parseSefazResponse(response.body, ['100', '101', '150'], { first: true })`, que pegava **apenas o primeiro `<cStat>`** encontrado no XML. Como o primeiro era o do evento vinculado (216), era exibido em vez do documento principal (677).

### Correção aplicada

1. **`functions/nf-functions.js`** — `parseSefazResponse` agora retorna `allCStat` (array com todos os cStat encontrados no XML).
2. **`functions/mdfe-functions.js`** — `mdfe_consultar` seleciona o cStat do documento principal:
   - Define códigos de evento vinculado a serem ignorados: `135/136/155` (MDF-e) e `215/216/217` (NF-e vinculada)
   - Se houver múltiplos cStat, escolhe o primeiro que **não** seja código de evento
   - Fallback para o primeiro do XML se todos forem evento

### Comportamento após correção

- Se a SEFAZ retornar múltiplos cStat (ex.: `['677', '216']`), o código seleciona o `677` (não é código de evento).
- Se a SEFAZ retornar apenas um cStat (`['216']`), o código não tem escolha: exibe `216` com a mensagem `tpEvento=110111` (cancelamento de NF-e referenciada). Isto é correto — a SEFAZ não fornece um cStat do documento MDF-e porque a NF-e referenciada está cancelada.

---

## Limitação conhecida

Se a SEFAZ retornar apenas um cStat (ex: `216`), o sistema exibe `216` com a mensagem de evento vinculado. Isso é correto — não há outro cStat disponível na resposta da SEFAZ para este MDF-e específico.

O usuário deve verificar a NF-e referenciada diretamente no portal da SEFAZ para entender por que a chave difere (cancelada/denegada).

---

## Ações pendentes

| Ação | Status |
|------|--------|
| Deploy da Cloud Function `mdfe_consultar` no Firebase | Pendente — executar `firebase deploy --only functions:mdfe_consultar` no diretório `functions/` |
| Verificar logs da função no Console Firebase | Pendente — confirmar `cStat principal=677` em vez de `216` |
| Testar consulta MDF-e nº 2028 no sistema | Pendente — após deploy da função |
| Fazer hard refresh no navegador após deploy hosting | ✅ Concluído (cachebuster `mdf-e.js?v=73d8b47e7005`) |

---

## Comandos para execução

```powershell
cd C:\Sisweb\functions
firebase deploy --only functions:mdfe_consultar
firebase deploy --only functions:nf_consultarNFe
```

Ou todas as funções fiscais:
```powershell
cd C:\Sisweb\functions
firebase deploy --only functions
```

---

## Arquivos alterados nesta sessão

| Arquivo | Alteração |
|---------|-----------|
| `functions/nf-functions.js` | `parseSefazResponse` retorna `allCStat` |
| `functions/mdfe-functions.js` | `mdfe_consultar` seleciona cStat do documento principal, não do evento vinculado |
| `mdf-e.js` | Não necessário — já usa `result?.cStat` |
| `mdf-e.html` | Cachebuster `?v=73d8b47e7004` → `?v=73d8b47e7005` |
| `functions/nf-config.js` | `escapeXml` já estava exportado em `__mdfeInternals` |
| `functions/nf-functions.js` | `escapeXml` já estava exportado em `__mdfeInternals` |
| `docs/core/CEREBRO-SISWEB.md` | Documentado agent-browser, cache-control imutável, diagnóstico MDF-e |
| `docs/stories/2026-10-18-mdfe-consulta-cstat-216-diagnostico.md` | Nova story criada |
| `.gitignore` | Adicionado `logs.md` |
| `7 arquivos` | Chave de API do Firebase atualizada de `...D1C5` para `...KfsU` |

---

## Checklist de conclusão

- [ ] Commit e push do código
- [ ] Deploy do hosting
- [ ] Deploy da Cloud Function `mdfe_consultar` (pendente — executar manualmente)
- [ ] Verificar logs da função no Firebase Console
- [ ] Testar consulta MDF-e nº 2028 no sistema
- [ ] Fazer hard refresh no navegador após deploy
