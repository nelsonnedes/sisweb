const f = require('fs');
const p = 'docs/core/CEREBRO-SISWEB.md';
const raw = f.readFileSync(p, 'utf8');
const EOL = raw.includes('\r\n') ? '\r\n' : '\n';

const headerOld = '> Atualizado em: 2026-09-14 (Romaneios 404+singleton+sentry + login P2)';
const headerNew = '> Atualizado em: 2026-09-21 (Sessao 77: menu/CRUD/mobile folha + padrao cards + scroll-guard + SW purge)';
if (!raw.includes(headerOld)) throw new Error('header anchor missing');
let out = raw.replace(headerOld, headerNew);

const section = [
  '',
  '## 77. Sessao 2026-09-19/21 — War-room regressoes + mobile cards + folha scroll (opencode)',
  '',
  '- **Loop anterior quebrado:** sessao passada repetia `firebase deploy --only database` (CEREBRO S10 stale, ja deployado em 21/08-15/09). NAO rodar database deploy sem checklist; canonico e so `database.rules.json`.',
  '- **"Hermes":** sem rastro no git (nenhum autor/branch/stash/worktree); regressoes estavam nos 17 commits de 18/09 ja na main.',
  '- **Menu topo morto (todas as paginas):** `menu-component.js:635` abria `try{` e `d48e5c6` deletou o `catch` com o fallback toast → `SyntaxError: Missing catch or finally`. Fix `c2d3d7e` (fecha try/catch) + toast no `admin.html` + remove `</script>` orfao em `romaneiotora.html:1658` + `hosting-files.json` ganhou `modules/core/toast.js` (era 404 em producao).',
  '- **Escrita (lote2 gaps):** `preromaneio-modals.js` throw sem tenant → alert+return; `js/client|species|fornecedor.js` saveData 2-arg → 3-arg `(base,id,payload)`; `registerUser` 4-arg encaminha `{plan,cupom,partner}` (`628fa24`).',
  '- **TL prefs warn:** `toSnake` corrompia UID em `users/*` → sem snake nesses paths + fallback silencioso; `*/preferences/*` vazio virou log.',
  '- **TL delete sem realtime:** `romaneios-client-save-fix.js` sequestrava `ModalClientes.deleteClient` → embrulha (preserva original + limpa 2 caches + refresh).',
  '- **Folha:** lista vazia pos-cadastro (array zerado + guard); salario no modal errado (hidrata `lancamentoAtual`); save invalida colecao pai; bind change sincrono; `0,00`→`0.00` em inputs number; toast so apos releitura; scroll restore + `verificarScrollGlobal` (+overflowY) + vigia 8s + `[scroll-guard]` + `diagnosticarRolagem()` + medidor via `window.__siswebDiagWheel` + `ressincronizarRolagem()` pos-modal.',
  '- **Scroll folha (EM ABERTO p/ reteste):** evidencias provam pagina saudavel (body auto, 0 modais, sem overlay/listeners); wheel `cancelable:false` tambem ocorre em automacao e rola — pista falsa. Hipotese: dessincronia do compositor + **SW purge** (`fa68ea5`, versao `2026-09-21-folha-scroll-resync-v1`; SW congelado em 18/09 servia bundles velhos/misturados). Pendente: usuario reabrir PWA, confirmar `folha-funcionarios.js?v=e6d2b96e9544`, retestar.',
  '- **Pre-romaneio:** `parseFloat` em display pt-BR zerava volume no save → `parseNumBR()`; lista recalcula pela soma; `mudarAba` sem confirm no load; alert→toast; `paginaAtual=1` nos loads (TL/PCT/PES/Tora/Pre); PES sem `mm` nos inputs; botao preso em "Atualizar" ao excluir em edicao.',
  '- **Mobile cards (arquiteto+designer+dev):** Lista expande + Exibir/Densidade lado a lado (3 tiers); itens 1 linha LABEL-valor; Acoes 36px; paginacao itens empilhada; wrapper sem teto; `#folhaModal` vence `print-styles.css .modal table tbody tr{height:50px !important}`; vales em cards + `?v=` no `folha.css`. Doc: `docs/padrao-cards-paginacao-mobile.md` (falta: vendas/compras/estoque/financas/especies/clientes/fornecedores).',
  '- **Folha `?v=`:** `tools/tag-folha-cachebusters.cjs` (com retag) nos 12 modulos; CSS manual (`romaneio-comum.css`, `folha.css`); injetor so cobre `<script>`.',
  '- **Thor/Brave login:** CORS bloqueado pelo escudo (so terceiros) — sem fix de codigo; login orienta desativar escudo (`056253d`).',
  '- **Gates:** lint OK, typecheck OK, `npm test` 571/0/1 skip, `validate:pr` 6/6, `security:postdeploy` 37/37, deploy `--only hosting`.',
  '- **NAO commitar `logs.md`** (dumps de console) — so CEREBRO vai ao repo.',
  ''
].join(EOL);

if (!out.endsWith(EOL)) out += EOL;
out += section;
f.writeFileSync(p, out, 'utf8');
console.log('appended OK');
