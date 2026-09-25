# Story: Reformulação frontend — login/index + Tema Claro/Escuro global

## Status
Done (Fases 1A + 1B)

## Contexto
Reformulação estritamente de FRONTEND do Sisweb com design autoral (padrão validado no lab de marketing),
sem aspecto genérico de IA. Escopo piloto: `login.html` e `index.html`. Produção (`C:\Sisweb`) é intocável;
todo o trabalho ocorre em `D:\Sisweb_redesigner` com validação em `localhost`.

## Contexto
Reformulação estritamente de FRONTEND do Sisweb com design autoral (padrão validado no lab de marketing),
sem aspecto genérico de IA. Escopo piloto: `login.html` e `index.html`. Produção (`C:\Sisweb`) é intocável;
todo o trabalho ocorre em `D:\Sisweb_redesigner` com validação em `localhost`.

Referências visuais (fonte da verdade):
- `marqueting/lab-login-b.html` + `marqueting/lab-pattern.css` (login timber escuro, marca `#FE6A00`)
- `marqueting/lab-index-a.html` + `marqueting/lab-tema-madeireira.css` (dashboard timber escuro)
- `marqueting/cores.md §2–§3` (tipografia Aileron/Source Code Pro, paleta oficial)

## Problema
1. `login.html` usa gradiente azul genérico (`#3498db → #2c3e50`), fonte `Segoe UI` e ~580 linhas de `<style>`
   inline com seletores globais (`*`, `button`, `input`) que vazam escopo.
2. `index.html` tem o mesmo problema (fundo `#f5f5f5`, fonte `Inter`, CSS inline duplicado com os módulos).
3. Não existe suporte a Tema Claro/Escuro; o controle deve viver no dropdown de engrenagem
   (`.settings-dropdown` em `menu-component.js`).

## Objetivo
Identidade Sisweb Madeireiras (laranja `#FE6A00`, timber `#121417/#1E2228`, Aileron) aplicada a
`login.html` e `index.html`, com Tema Claro/Escuro global via variáveis, sem quebrar nenhuma
funcionalidade de backend, rota ou lógica de negócio.

## Acceptance Criteria
- [x] `styles/sisweb-tokens.css` é a única fonte de cor/marca (HEX de marca proibido fora dele).
- [x] `js/sisweb-theme.js` expõe `window.SiswebTheme` (`get/set/toggle/onChange`), persiste
      `sisweb:theme` (`light|dark|system`, default `dark`) e emite `sisweb:theme-change`.
- [x] Dropdown de engrenagem ganha seção "Tema" (Claro/Escuro/Sistema, `role=menuitemradio`).
- [x] `login.html` aplica identidade do lab (fundo timber, card `#1E2228`, botão gradiente laranja,
      lockup `icone.ico + nome.ico` com fallback) nos dois temas, sem alterar handlers/IDs.
- [x] `index.html` aplica camada de tema (shell, KPI, tabelas, refresh) nos dois temas, sem alterar
      boot do dashboard, tenant guard ou fallback.
- [x] Bootstrap anti-FOUC no `<head>` aplica `data-theme` antes da pintura.
- [x] Teste `tests/redesign-theme-regression.test.mjs` passa; `npm run lint`, `npm run typecheck`,
      `npm test` passam; smoke `localhost` retorna 200 para `login.html` e `index.html`.
- [x] Fase 1B: `<style>` inline removido do `login.html` (583 linhas; `auth.css` standalone com
      paridade pixel comprovada por screenshot antes/depois); ilha do menu topo no padrão lab
      (`lab-pattern.css §3`) nos dois temas.
- [ ] Fase 2 (auditoria por módulo): remover `<style>` inline do `index.html` (dependências nos
      módulos `modules/dashboard/*` exigem migração gradual); migrar `--primary-gradient` roxo e
      acentos dos KPI cards para a marca; aplicar tokens às demais páginas.

## Tarefas
- [x] Criar story, tokens, theme manager e camadas CSS (`auth.css`, `dashboard-theme.css`).
- [x] Integrar links + bootstrap + lockup no `login.html` (aditivo, sem tocar em lógica).
- [x] Adicionar seção Tema ao `menu-component.js` + camada de tema no `index.html`.
- [x] Criar teste de regressão estático e rodar gates + smoke localhost.
- [x] Homologação visual automatizada (Puppeteer): login dark/light/mobile + index dark/light +
      engrenagem aberta + troca de tema por clique — 0 erros de console.
- [x] Fase 1B: `auth.css` standalone, remoção do inline do login, ilha do menu, correção do
      `prefers-color-scheme` do módulo vs `data-theme`, correção do glifo FA no h1.
- [ ] Homologação visual humana final em `localhost:5500` (claro + escuro).

## File List
- `docs/stories/2026-09-24-redesign-frontend-login-index-tema.md`
- `styles/sisweb-tokens.css`
- `styles/auth.css`
- `styles/dashboard-theme.css`
- `js/sisweb-theme.js`
- `login.html`
- `index.html`
- `menu-component.js`
- `tests/redesign-theme-regression.test.mjs`

## Implementação
- Fase 1A optou por camada aditiva de alta especificidade (`body.sw-auth …`,
  `html[data-theme=…] …`) SOBRE o CSS legado, em vez de deletar o `<style>` inline de imediato:
  risco zero de regressão visual antes da homologação; a remoção (1B) é trivial depois.
- `data-theme` vive no `<html>`; `data-theme-mode` guarda a preferência (`system` resolve via
  `prefers-color-scheme: light`). Default `dark` = default validado no lab.
- `login.html` não tem engrenagem: apenas consome o tema salvo (controle mora no menu do sistema).
- Nenhum handler foi tocado: `handleLogin`, `handleRegister`, `handlePasswordReset`,
  `gateSuperAdminMfa`, `DashboardCore.init`, `enforceTenantContext`, rotas e Firebase intactos.

## Validação
- `node --check js/sisweb-theme.js` passou.
- `tests/redesign-theme-regression.test.mjs`: 4/4 passaram (inclui trava anti-`<style>` inline no login).
- `npm run lint` passou; `npm run typecheck` passou.
- `npm test` pós-1B (suite completa): 638 passaram, 0 falharam, 1 skip (emulador RTDB, esperado).
- Smoke `localhost:5500` (server.js): `login.html` 200 (tokens + lockup presentes),
  `index.html` 200 (dashboard-theme + `<main-menu>` presentes),
  `styles/sisweb-tokens.css`, `styles/auth.css` e `js/sisweb-theme.js` 200.
- QA visual (`tmp/qa-1b.mjs`, Puppeteer headless, 6 capturas em `tmp/qa-1b/`):
  login dark (card `#1E2228`, botão gradiente, Aileron, lockup `icone.ico`),
  login light (card branco, links terracota), login mobile 390px,
  index dark (body `#121417`, KPI `#1E2228`, ilha clara, h1 gradiente marca),
  engrenagem aberta (Tema com Claro/Escuro/Sistema) + troca por clique persistindo
  `sisweb:theme`; 0 erros de console/página.
- Paridade login antes/depois da remoção do inline: métricas computadas idênticas e
  screenshots equivalentes.
- Bugs reais encontrados e corrigidos pela QA: (1) `@media (prefers-color-scheme: dark)`
  em `dashboard-styles.css:640` escurecia cards no tema claro — neutralizado via
  `html[data-theme="light"]`; (2) `font-family` aplicada direto no `h1 i` quebrava o glifo
  FA — escopo corrigido.

## Notas
- `C:\Sisweb` não foi acessado nem modificado em nenhum momento.
- `marqueting/lab-tema-noturno.css` (mogno) foi aposentado como referência: conflita com o timber
  oficial aprovado em `lab-pattern.css` + `lab-tema-madeireira.css`.
- Arquivos sujos no `git status` que NÃO são deste trabalho (pré-existentes, não tocados):
  `logs.md`, `modules/romaneiopct/imprimir-romaneio-pct.js`, `sisweb.ico`, `sisweb.svg`,
  `tests/romaneio-preview-uso-trava.test.mjs`.
- `git diff --stat`: `login.html` +36/−583 (remoção do inline); restante é adição de arquivos novos.

## Notas
- `C:\Sisweb` não foi acessado nem modificado em nenhum momento.
- `marqueting/lab-tema-noturno.css` (mogno) foi aposentado como referência: conflita com o timber
  oficial aprovado em `lab-pattern.css` + `lab-tema-madeireira.css`.
