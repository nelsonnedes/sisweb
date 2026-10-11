# PROMPT — Cadastro nacional de municípios + IBGE no SisWeb (v2, ancorado)

> Contexto lido do repositório em 2026-10-11. Usar como spec de implementação.

## 1. Ponto de partida real (não reinventar)

O SisWeb **já tem** integração IBGE parcial — estender, não recriar:

| O que existe | Onde | Estado |
|---|---|---|
| Autocomplete cidade+UF com `ibgeCode` (API `servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios`) | `js/client.js:339`, `js/fornecedor.js:365`, `fornecedor-modals.js:574`, `company.html:1836` (4 implementações DUPLICADAS, sem cache) | Funciona online; cada uma refaz fetch; sem path offline |
| `obterCodigoMunicipioIBGE(uf, nome)` (id 7 dígitos, `padStart`) | `cities-loader.js:101` | Usado pelo MDF-e; falha dura offline |
| `cMun` persistido (5 aliases: `codigoMunicipio/municipioCodigo/municipalityCode/cMun/ibgeCode`) | `js/client.js:131`, `js/fornecedor.js:172` | Dívida: normalizar leitura, gravar 1 canônico |
| Bloqueio fiscal sem IBGE válido (emissão NUNCA sai sem `cMun`) | `nf-validator.js:229`, `nf-xml-builder.js:96,124,155,399`, `mdfe-xml-builder.js:74,111` | Preservar como trava (regressão proibida) |
| Listas fallback parciais (5–25 cidades/UF, com mojibake em alguns arquivos) | `cities-loader.js:39`, `cities.js`, `estados-cidades.js` | Cobrem capitais; interior falha offline |

**Lacunas mapeadas (escopo fechado):** transportadora NF-e (`nfTranspMunicipio`, texto puro), percurso MDF-e offline (`mdf-e.js:430`), modais pré-romaneio/standardized, emitente (`company.html`), `nfClienteUf` sem código, `cadastro-parceiro.html` (texto livre, não fiscal — opcional). Sem ViaCEP em nenhum lugar (CEP é só armazenado).

## 2. NON-GOALS explícitos (não implementar)

NFS-e, CT-e, representantes, portais, apps móveis, tabela SQL, importação integral dos 5.570 municípios para o banco, "impedir gravação" global, updater automático, rollback scripts. RTDB é NoSQL: **não criar `municipios_ibge` como tabela** — a fonte canônica continua sendo a API IBGE + snapshot local + cache.

## 3. Arquitetura-alvo (aditiva, sem breaking)

1. **Um serviço único** `js/municipios-ibge.js` (script clássico, sem ESM): `buscar(uf)` com cache `localStorage` (TTL 30 dias) → API → snapshot embarcado (substituir os fallbacks parciais por lista completa gerada do IBGE, 1 arquivo); `resolverCodigo(uf, nome)` com normalização acento-insensível; `limparCache()`. Delegar as 4 implementações existentes para ele (assinar preservada).
2. **Campo canônico** `codigoMunicipio` (7 dígitos string) na gravação; manter os 5 aliases só na LEITURA. Nenhuma migração destrutiva.
3. **Conectar os formulários do §1-lacunas** ao serviço (autocomplete + código oculto). Transportadora e percurso MDF-e passam a resolver offline via snapshot.
4. **Diagnóstico de migração** (somente leitura): script Node que lista registros sem `codigoMunicipio` válido por coleção (`clients/fornecedores/company/fiscal`) e gera `docs/stories/relatorio-ibge-faltantes.md`. NÃO sobrescrever nada.
5. **ViaCEP (opcional, fase separada)**: só se pedido — CEP→UF/cidade como sugestão, nunca bloqueante.

## 4. Regras do repo (violar = refazer)

- Gates verdes: `npm run lint`, `npm run typecheck`, `npm test` (padrão `tests/*.test.mjs` via `node:test`, asserts regex+comportamentais).
- Feedback visual só via `NotificationService`/`confirmDialog` — proibido `alert/confirm/prompt` novo (há trava de suite).
- `?v=` via `node scripts/sync-css-cachebusters.mjs --resync`; bump `APP_VERSION`/`PWA_VERSION` juntos; deploy `npm run deploy:hosting` + verificação em produção + Ctrl+F5.
- NUNCA reescrever HTML via PowerShell; `edit` com contexto mínimo; HTMLs em LF sem BOM.
- Cores só via tokens `var(--sw-*)`; botões seguem `layout-comum.css` (36/30) salvo botão-de-campo (38).
- Commits Conventional Commits por onda; atualizar checklist da story.
- Rollback = `git revert` (mudanças aditivas; sem script dedicado).

## 6. Execução (2026-10-11)

- [x] **Fase A** — `js/municipios-ibge.js` (cache 30d → API → snapshot),
      `data/municipios-ibge.json` (5.571, 202KB, gerado por
      `tools/fetch-municipios-ibge.mjs`), delegação em 6 pontos
      (`js/client.js`, `js/fornecedor.js`, `fornecedor-modals.js`,
      `company.html`, `cities-loader.js`, `preromaneio-modals.js`),
      carga global via menu, campo canônico preservado.
- [x] **Fase B** — transportadora dispensada com justificativa (XML só tem
      texto `xMun`, sem `cMun`); MDF-e offline herdado via `cities-loader`;
      emitente já tinha loader (delegado).
- [x] **Fase C** — `tools/diagnosticar-ibge-faltantes.py` (leitura) +
      `docs/stories/relatorio-ibge-faltantes.md` + trava
      `tests/municipios-ibge.test.mjs` (16/16).
- Diagnóstico real (tenant teste): clients 1/1 sem código ("Palmas"),
  fornecedores 1/27, fiscal 0/6, profile 1/1 — completar pelos formulários.
- Smoke offline (API bloqueada): 645 SP, 3550308, normalização OK.
- Suite 1092/0. ViaCEP ficou como opcional futuro (fora do escopo fiscal).

## 5. Fases e aceite

- **Fase A** — serviço único + snapshot + delegação das 4 implementações (suite verde, zero regressão fiscal).
- **Fase B** — formulários do §1-lacunas conectados (smoke por tela nos 2 temas).
- **Fase C** — relatório de faltantes (leitura) + trava de suite (validador, snapshot, delegação).
- **Aceite:** emissão continua bloqueada sem `cMun` válido; offline funciona para UFs em cache; nenhum `alert/confirm` novo; suite 100% verde; deploy verificado. IBGE muda código de município ~1x/década: aceitar divergência residual com revalidação na emissão (já existe).
