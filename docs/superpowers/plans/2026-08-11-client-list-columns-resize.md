# Client List Columns Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir redimensionar por arraste as colunas das Listas de Clientes (PCT, TL, PES, Pré-romaneio) e da Lista de Fornecedores (romaneiotora), com persistência por usuário + tenant no Firebase e espelho localStorage.

**Architecture:** Um módulo único `modules/core/client-list-columns.js` (IIFE, sem tocar nos renderizadores existentes) aplica larguras salvas e instala handles de drag nos `<th>` via pointer events. Persistência em `users/{uid}/preferences/clientListColumns/{tenant}/{pagina}` e `users/{uid}/preferences/fornecedorListColumns/{tenant}`, seguindo a convenção de `estoque.js`/`folha-relatorios.js` (RBAC já permite, `database.rules.json:255-257`). O módulo usa `window.firebaseService.saveData`/`loadFromFirebase` (cascata com `saveToFirebase`), NÃO `window.saveData` (sobrescrito por `client-service.js` em algumas páginas).

**Tech Stack:** HTML, CSS, JavaScript global existente, testes Node estruturais (`node --test`).

## Global Constraints

- Não alterar paths Firebase, regras, payloads nem permissões de clientes.
- Não interpolar dados do cliente em `innerHTML`; usar `textContent` para valores dinâmicos.
- Dados ausentes devem usar `Não informado`, nunca `N/A`.
- Não modificar os renderizadores existentes (preromaneio-modals.js, modal-clientes.js, modal-clientes-pct.js, bloco inline do PES, fornecedor-modals.js).
- Truncamento com ellipsis (`print-styles.css:541-547`) permanece por design — o usuário alarga a coluna para ver o dado completo.
- Chaves de persistência: uma por página (clientes) + uma para fornecedores (spec 2026-08-11).
- Resolução de uid/tenant: padrão `estoque.js:2279-2294`; fallback `'anon'`/`'default'` sem escrita remota.
- Validar desktop e mobile antes de publicar Hosting.

---

### Task 1: Módulo `modules/core/client-list-columns.js`

**Files:**
- Create: `modules/core/client-list-columns.js`
- Create: `tests/client-list-columns-resize.test.mjs`
- Test: `tests/client-list-columns-resize.test.mjs`

**Interfaces:**
- Consumes: `window.firebaseService.saveData(path, data)`, `window.firebaseService.saveToFirebase(path, data)`, `window.firebaseService.loadFromFirebase(path)` (fallbacks encadeados); `localStorage`.
- Produces: `window.ClientListColumns` com `buildPath()`, `sanitize(raw)`, `getWidths()`, `save(clean)`, `apply(table, clean)`, `attach(table)`, `init()`.

- [ ] **Step 1: Escrever o teste estrutural (FAIL antes do código)**

Crie `tests/client-list-columns-resize.test.mjs`:

```js
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const src = read('modules/core/client-list-columns.js');
const pages = {
  preromaneio: read('preromaneio.html'),
  tl: read('romaneiotl.html'),
  pct: read('romaneiopct.html'),
  pes: read('romaneiopes.html'),
  tora: read('romaneiotora.html')
};

test('modulo: contrato de colunas por pagina', () => {
  assert.match(src, /var CONTRACT_BY_PAGE = \{/);
  for (const page of ['pct', 'tl', 'pes', 'preromaneio']) {
    assert.match(src, new RegExp(`${page}: \\['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'A\\u00e7\\u00f5es'\\]`));
  }
  assert.match(src, /fornecedores: \\['Nome', 'CNPJ', 'Cidade', 'Estado', 'Telefone', 'A\\u00e7\\u00f5es'\\]/);
});

test('modulo: sanitizacao com clamp e minimo proprio de Acoes', () => {
  assert.match(src, /MIN_WIDTH = 60/);
  assert.match(src, /MAX_WIDTH = 400/);
  assert.match(src, /MIN_ACTIONS_WIDTH = PAGE === 'fornecedores' \? 150 : 120/);
  assert.match(src, /function sanitize\(raw\)/);
  assert.match(src, /Math\.max\(min, Math\.min\(max, n\)\)/);
});

test('modulo: paths e chaves de persistencia', () => {
  assert.match(src, /users\/' \+ uid \+ '\/preferences\//);
  assert.match(src, /fornecedorListColumns\/' \+ tenant/);
  assert.match(src, /clientListColumns\/' \+ tenant \+ '\/' \+ PAGE/);
  assert.match(src, /sisweb_/);
});

test('modulo: persistencia local + remota com debounce e espelho', () => {
  assert.match(src, /SAVE_DEBOUNCE_MS = 400/);
  assert.match(src, /localStorage\.setItem\(localStorageKey\(\)/);
  assert.match(src, /function remoteSave\(clean\)/);
  assert.match(src, /clearTimeout\(saveTimer\)/);
  assert.match(src, /setTimeout\(function \(\) \{/);
});

test('modulo: aplicacao de larguras, drag com pointer events e observer', () => {
  assert.match(src, /function applyWidths\(table, clean\)/);
  assert.match(src, /table\.classList\.add\('clc-fixed'\)/);
  assert.match(src, /function attachResize\(table\)/);
  assert.match(src, /pointerdown/);
  assert.match(src, /setPointerCapture/);
  assert.match(src, /MutationObserver/);
  assert.match(src, /window\.ClientListColumns = \{/);
  assert.match(src, /injectStyles/);
});
```

- [ ] **Step 2: Executar o teste e confirmar falha**

Run: `node --test tests/client-list-columns-resize.test.mjs`
Expected: FAIL (arquivo do módulo não existe ainda — `ENOENT`).

- [ ] **Step 3: Criar o módulo**

Crie `modules/core/client-list-columns.js` com o conteúdo completo:

```js
// modules/core/client-list-columns.js
// Redimensionamento por arraste das colunas das Listas de Clientes (PCT/TL/PES/Pre-romaneio)
// e da Lista de Fornecedores (romaneiotora), com persistencia por usuario + tenant.
// Spec: docs/superpowers/specs/2026-08-11-client-list-columns-resize-design.md
(function () {
    'use strict';

    var SCRIPT = document.currentScript || {};
    var DATA = SCRIPT.dataset || {};
    var PAGE = String(DATA.page || '').trim().toLowerCase();
    var TARGET = String(DATA.target || '').trim();

    var CONTRACT_BY_PAGE = {
        pct: ['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'Ações'],
        tl: ['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'Ações'],
        pes: ['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'Ações'],
        preromaneio: ['Nome', 'Cidade', 'Estado', 'Telefone', 'Email', 'Ações'],
        fornecedores: ['Nome', 'CNPJ', 'Cidade', 'Estado', 'Telefone', 'Ações']
    };
    var MIN_WIDTH = 60;
    var MAX_WIDTH = 400;
    var MIN_ACTIONS_WIDTH = PAGE === 'fornecedores' ? 150 : 120;
    var SAVE_DEBOUNCE_MS = 400;
    var DEFAULTS = {
        'Nome': 200,
        'Cidade': 130,
        'Estado': 80,
        'Telefone': 140,
        'Email': 200,
        'CNPJ': 170,
        'Ações': MIN_ACTIONS_WIDTH
    };

    var widthsCache = null;
    var saveTimer = null;
    var initialized = false;

    function resolveUid() {
        try {
            if (window.firebaseAuthUser && window.firebaseAuthUser.uid) return String(window.firebaseAuthUser.uid);
            if (window.firebaseService && window.firebaseService.authService && typeof window.firebaseService.authService.getAuth === 'function') {
                var user = window.firebaseService.authService.getAuth().currentUser;
                if (user && user.uid) return String(user.uid);
            }
            var raw = localStorage.getItem('currentUser') || localStorage.getItem('persistentUser');
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && (parsed.uid || parsed.id || parsed.userId)) return String(parsed.uid || parsed.id || parsed.userId);
            }
        } catch (_) {}
        return 'anon';
    }

    function resolveTenant() {
        try {
            var svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.getTenantId === 'function') {
                var t = svc.getTenantId();
                if (t) return String(t);
            }
            if (svc && typeof svc.getCurrentTenantId === 'function') {
                var t2 = svc.getCurrentTenantId();
                if (t2) return String(t2);
            }
            if (window.appTenantId) return String(window.appTenantId);
            var infoRaw = localStorage.getItem('company_info');
            if (infoRaw) {
                var info = JSON.parse(infoRaw);
                if (info && (info.companyId || info.companyID || info.tenantId || info.id)) {
                    return String(info.companyId || info.companyID || info.tenantId || info.id);
                }
            }
        } catch (_) {}
        return 'default';
    }

    function buildPath() {
        var uid = resolveUid();
        var tenant = resolveTenant();
        var base = 'users/' + uid + '/preferences/';
        if (PAGE === 'fornecedores') {
            return base + 'fornecedorListColumns/' + tenant;
        }
        return base + 'clientListColumns/' + tenant + '/' + PAGE;
    }

    function localStorageKey() {
        var feature = PAGE === 'fornecedores' ? 'fornecedorListColumns' : 'clientListColumns';
        var suffix = PAGE === 'fornecedores' ? '' : '_' + PAGE;
        return 'sisweb_' + feature + '_' + resolveTenant() + '_' + resolveUid() + suffix;
    }

    function contract() {
        return CONTRACT_BY_PAGE[PAGE] || CONTRACT_BY_PAGE.pct;
    }

    function clamp(value, min, max) {
        var n = Math.round(Number(value));
        if (!isFinite(n)) return null;
        return Math.max(min, Math.min(max, n));
    }

    function sanitize(raw) {
        var clean = {};
        if (!raw || typeof raw !== 'object') return clean;
        contract().forEach(function (label) {
            var min = label === 'Ações' ? MIN_ACTIONS_WIDTH : MIN_WIDTH;
            var px = clamp(raw[label], min, MAX_WIDTH);
            if (px !== null) clean[label] = px;
        });
        return clean;
    }

    function saveLocal(clean) {
        try {
            localStorage.setItem(localStorageKey(), JSON.stringify(clean));
        } catch (_) {}
    }

    function remoteSave(clean) {
        var path = buildPath();
        var svc = window.firebaseService;
        if (svc && typeof svc.saveData === 'function') {
            return svc.saveData(path, clean).catch(function (e) {
                console.error('client-list-columns: falha ao salvar remoto', e);
            });
        }
        if (svc && typeof svc.saveToFirebase === 'function') {
            return svc.saveToFirebase(path, clean).catch(function (e) {
                console.error('client-list-columns: falha ao salvar remoto', e);
            });
        }
        return Promise.resolve();
    }

    function scheduleSave(clean) {
        saveLocal(clean);
        widthsCache = clean;
        if (resolveUid() === 'anon') return;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            remoteSave(clean);
        }, SAVE_DEBOUNCE_MS);
    }

    function loadRemote() {
        var path = buildPath();
        var svc = window.firebaseService;
        var loader = (svc && typeof svc.loadFromFirebase === 'function') ? svc.loadFromFirebase.bind(svc) : null;
        if (!loader) return Promise.resolve(null);
        return loader(path).then(function (result) {
            var data = (result && result.success && result.data) ? result.data : result;
            var clean = sanitize(data);
            if (Object.keys(clean).length > 0) saveLocal(clean);
            return clean;
        }).catch(function () {
            return null;
        });
    }

    function getWidthsSync() {
        if (widthsCache) return widthsCache;
        try {
            var raw = localStorage.getItem(localStorageKey());
            if (raw) {
                var parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    widthsCache = sanitize(parsed);
                    return widthsCache;
                }
            }
        } catch (_) {}
        widthsCache = {};
        return widthsCache;
    }

    function applyWidths(table, clean) {
        if (!table || !clean) return;
        var headers = table.querySelectorAll('thead th');
        contract().forEach(function (label, index) {
            if (index >= headers.length || !clean[label]) return;
            headers[index].style.width = clean[label] + 'px';
        });
        if (Object.keys(clean).length > 0) table.classList.add('clc-fixed');
    }

    function attachResize(table) {
        var headers = table.querySelectorAll('thead th');
        for (let index = 0; index < headers.length; index++) {
            var th = headers[index];
            if (th.__clcAttached) continue;
            th.__clcAttached = true;
            var handle = document.createElement('div');
            handle.className = 'clc-handle';
            handle.title = 'Arraste para ajustar a largura';
            th.appendChild(handle);
            handle.addEventListener('pointerdown', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var label = contract()[index] || '';
                var min = label === 'Ações' ? MIN_ACTIONS_WIDTH : MIN_WIDTH;
                var startX = e.clientX;
                var startWidth = th.getBoundingClientRect().width;
                th.classList.add('clc-resizing');
                try {
                    handle.setPointerCapture(e.pointerId);
                } catch (_) {}
                function onMove(ev) {
                    var width = clamp(startWidth + (ev.clientX - startX), min, MAX_WIDTH);
                    th.style.width = width + 'px';
                    table.classList.add('clc-fixed');
                    th.title = width + 'px';
                }
                function onUp() {
                    th.classList.remove('clc-resizing');
                    handle.removeEventListener('pointermove', onMove);
                    handle.removeEventListener('pointerup', onUp);
                    handle.removeEventListener('pointercancel', onUp);
                    var clean = {};
                    var headersNow = table.querySelectorAll('thead th');
                    contract().forEach(function (labelNow, idx) {
                        if (idx < headersNow.length && headersNow[idx].style.width) {
                            var px = parseInt(headersNow[idx].style.width, 10);
                            clean[labelNow] = clamp(px, labelNow === 'Ações' ? MIN_ACTIONS_WIDTH : MIN_WIDTH, MAX_WIDTH);
                        }
                    });
                    scheduleSave(sanitize(clean));
                }
                handle.addEventListener('pointermove', onMove);
                handle.addEventListener('pointerup', onUp);
                handle.addEventListener('pointercancel', onUp);
            });
        }
    }

    function injectStyles() {
        if (document.getElementById('clc-styles')) return;
        var style = document.createElement('style');
        style.id = 'clc-styles';
        style.textContent = '.client-list-cols th{position:relative;}.clc-handle{position:absolute;top:0;right:-4px;width:8px;height:100%;cursor:col-resize;touch-action:none;user-select:none;-webkit-user-select:none;}.clc-handle:hover{background:rgba(0,0,0,.12);}.client-list-cols.clc-fixed{table-layout:fixed;width:auto;}.clc-resizing th{user-select:none;}.clc-resizing{cursor:col-resize;}';
        document.head.appendChild(style);
    }

    function init() {
        if (initialized || !PAGE || !TARGET) return;
        var table = null;
        function setup() {
            if (table) return true;
            var tbody = document.getElementById(TARGET);
            if (!tbody) return false;
            table = tbody.closest('table');
            if (!table) return false;
            injectStyles();
            table.classList.add('client-list-cols');
            var clean = getWidthsSync();
            if (Object.keys(clean).length > 0) applyWidths(table, clean);
            attachResize(table);
            if (resolveUid() !== 'anon') {
                loadRemote().then(function (remote) {
                    if (remote && Object.keys(remote).length > 0 && table) {
                        widthsCache = remote;
                        applyWidths(table, remote);
                    }
                });
            }
            return true;
        }
        if (!setup()) {
            var observer = new MutationObserver(function () {
                if (setup()) observer.disconnect();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.ClientListColumns = {
        buildPath: buildPath,
        sanitize: sanitize,
        getWidths: getWidthsSync,
        save: scheduleSave,
        apply: applyWidths,
        attach: attachResize,
        init: init
    };
})();
```

- [ ] **Step 4: Executar o teste e confirmar PASS**

Run: `node --test tests/client-list-columns-resize.test.mjs`
Expected: 6/6 PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/core/client-list-columns.js tests/client-list-columns-resize.test.mjs
git commit -m "feat(romaneios): modulo client-list-columns com resize de colunas e persistencia por usuario + tenant"
```

### Task 2: Wiring das 5 páginas e correção da divergência do PES

**Files:**
- Modify: `preromaneio.html` (após linha 1745)
- Modify: `romaneiotl.html` (após linha 1952)
- Modify: `romaneiopct.html` (após linha 2872)
- Modify: `romaneiopes.html` (após linha 1322)
- Modify: `romaneiotora.html` (após linha 1939)
- Modify: `romaneiopes.html:913-924` (remover regras de largura `!important` do `#clientListModal`)
- Test: `tests/client-list-columns-resize.test.mjs`

**Interfaces:**
- Consumes: `window.ClientListColumns` (Task 1).
- Produces: tabelas de clientes/fornecedores redimensionáveis nas 5 páginas.

- [ ] **Step 1: Escrever as asserções de wiring e da correção do PES**

Adicione ao final de `tests/client-list-columns-resize.test.mjs`:

```js
test('paginas: tag do modulo com data-page e data-target corretos', () => {
  assert.match(pages.preromaneio, /modules\/core\/client-list-columns\.js[^>]*data-page="preromaneio"[^>]*data-target="clientListTable"/);
  assert.match(pages.tl, /modules\/core\/client-list-columns\.js[^>]*data-page="tl"[^>]*data-target="clientListTable"/);
  assert.match(pages.pct, /modules\/core\/client-list-columns\.js[^>]*data-page="pct"[^>]*data-target="clientListTable"/);
  assert.match(pages.pes, /modules\/core\/client-list-columns\.js[^>]*data-page="pes"[^>]*data-target="clientListBody"/);
  assert.match(pages.tora, /modules\/core\/client-list-columns\.js[^>]*data-page="fornecedores"[^>]*data-target="fornecedorListTable"/);
});

test('romaneiopes: divergencia de Acoes corrigida (sem 40px !important no modal)', () => {
  const pesCss = pages.pes.match(/#clientListModal[\s\S]{0,1200}/)?.[0] || '';
  assert.doesNotMatch(pesCss, /40px !important/);
});
```

- [ ] **Step 2: Executar o teste e confirmar FAIL**

Run: `node --test tests/client-list-columns-resize.test.mjs`
Expected: 6 PASS + 2 FAIL (tags ausentes e regra 40px ainda presente).

- [ ] **Step 3: Adicionar a tag do módulo nas 5 páginas**

Em cada página, logo após o último script da cadeia de modais listado, insira exatamente (respeitando a indentação do arquivo):

`preromaneio.html` (após a linha do `preromaneio-modals.js`):

```html
    <script src="modules/core/client-list-columns.js?v=20260811clientlistv1" data-page="preromaneio" data-target="clientListTable"></script>
```

`romaneiotl.html` (após a linha do `modal-clientes.js`):

```html
    <script src="modules/core/client-list-columns.js?v=20260811clientlistv1" data-page="tl" data-target="clientListTable"></script>
```

`romaneiopct.html` (após a linha do `modal-clientes-pct.js`):

```html
    <script src="modules/core/client-list-columns.js?v=20260811clientlistv1" data-page="pct" data-target="clientListTable"></script>
```

`romaneiopes.html` (após a linha do `romaneio-print-config.js`):

```html
    <script src="modules/core/client-list-columns.js?v=20260811clientlistv1" data-page="pes" data-target="clientListBody"></script>
```

`romaneiotora.html` (após a linha do `fornecedor-modals.js`):

```html
    <script src="modules/core/client-list-columns.js?v=20260811clientlistv1" data-page="fornecedores" data-target="fornecedorListTable"></script>
```

- [ ] **Step 4: Remover as regras divergentes do PES**

Em `romaneiopes.html`, remova as linhas 913-924 (bloco `#clientListModal .table ...`):

```html
        #clientListModal .table th:nth-child(1),
        #clientListModal .table td:nth-child(1) { width: 30% !important; }
        #clientListModal .table th:nth-child(2),
        #clientListModal .table td:nth-child(2) { width: 18% !important; }
        #clientListModal .table th:nth-child(3),
        #clientListModal .table td:nth-child(3) { width: 8% !important; }
        #clientListModal .table th:nth-child(4),
        #clientListModal .table td:nth-child(4) { width: 16% !important; }
        #clientListModal .table th:nth-child(5),
        #clientListModal .table td:nth-child(5) { width: calc(28% - 40px) !important; }
        #clientListModal .table th:last-child,
        #clientListModal .table td:last-child { width: 40px !important; min-width: 40px !important; max-width: 40px !important; }
```

Mantenha intactas as regras de `#speciesListModal` (linhas 926-931).

- [ ] **Step 5: Executar o teste e confirmar PASS**

Run: `node --test tests/client-list-columns-resize.test.mjs tests/romaneios-client-list-standard.test.mjs tests/romaneiotora-active-stack.test.mjs`
Expected: todos PASS (8/8 + regressão dos romaneios).

- [ ] **Step 6: Validar sintaxe dos inline scripts alterados e do módulo**

Run: `node --check modules/core/client-list-columns.js` e o extrator de blocos inline de `romaneiopes.html` (mesmo procedimento usado nas correções anteriores: regex `<script(?![^>]*src=)[^>]*>([\s\S]*?)</script>` + `node --check` por bloco).
Expected: OK em todos.

- [ ] **Step 7: Commit**

```bash
git add preromaneio.html romaneiotl.html romaneiopct.html romaneiopes.html romaneiotora.html tests/client-list-columns-resize.test.mjs
git commit -m "feat(romaneios): habilitar resize de colunas nas 5 paginas e corrigir divergencia de Acoes no romaneiopes"
```

### Task 3: Verificação, story e publicação

**Files:**
- Modify: `docs/stories/2026-08-02-romaneiotora-consolidacao-stack-ui.md`

**Interfaces:**
- Consumes: módulo e wiring das Tasks 1-2; suite de regressão.
- Produces: evidência de gates e checklist atualizado.

- [ ] **Step 1: Rodar as suites de regressão dos romaneios**

Run: `node --test tests/romaneios-client-list-standard.test.mjs tests/romaneiotora-active-stack.test.mjs tests/client-list-columns-resize.test.mjs`
Expected: todos PASS.

- [ ] **Step 2: Rodar gates completos**

Run: `npm run lint; npm run typecheck; npm test`
Expected: lint e typecheck OK; `npm test` sem falhas (1 skip esperado do Emulator).

- [ ] **Step 3: Atualizar a story com evidências reais**

Adicione em `docs/stories/2026-08-02-romaneiotora-consolidacao-stack-ui.md` (seção Validacao):

```markdown
- [x] resize de colunas com persistencia (spec 2026-08-11): modulo client-list-columns nas 5 paginas, testes 8/8
- [x] romaneiopes sem largura fixa de 40px na coluna Acoes (contrato PCT 120px)
- [ ] smoke autenticado desktop/mobile: arrastar colunas, recarregar pagina e conferir persistencia (local + Firebase)
```

E em Arquivos:

```markdown
- `modules/core/client-list-columns.js`
- `tests/client-list-columns-resize.test.mjs`
```

- [ ] **Step 4: Build de Hosting e diff check**

Run: `npm run build:hosting; git diff --check`
Expected: build OK; sem erros de whitespace.

- [ ] **Step 5: Commit**

```bash
git add docs/stories/2026-08-02-romaneiotora-consolidacao-stack-ui.md
git commit -m "docs(story): resize de colunas das listas de clientes/fornecedores com persistencia"
```

- [ ] **Step 6: Publicar Hosting e verificar em produção**

Run: `firebase deploy --only hosting --project sisweb-7ce82`
Expected: deploy concluído. Verificar via HTTP que `modules/core/client-list-columns.js?v=20260811clientlistv1` está servindo e que `romaneiopes.html` não contém `40px !important` para o modal.

- [ ] **Step 7: Push do branch**

Run: `git push origin codex/recovery-p0-freebuff-regressions`
Expected: push concluído com os commits da feature.
