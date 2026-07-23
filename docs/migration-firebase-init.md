# Migração para firebase-init.js

## Objetivo

Eliminar a duplicação do Firebase SDK substituindo imports diretos do CDN (`https://www.gstatic.com/firebasejs/...`) pelo módulo compartilhado `firebase-init.js`, que garante inicialização única (singleton) de `app`, `auth`, `db`, `storage` e `functions`.

## Arquitetura Alvo

```
firebase-init.js
├── import SDK v10.7.1 (CDN) — ÚNICO ponto
├── initializeApp() — UMA vez
├── export { app, auth, db, storage, functions, ref, set, ... }
│
├── firebaseService.js ← import de firebase-init.js
└── cada página HTML    ← import de firebase-init.js (se precisar de acesso direto)
```

## Diagnóstico: qual padrão sua página usa?

Execute o healthcheck para ver o estado atual:

```bash
node tools/healthcheck-firebase-sdk.mjs
```

Procure sua página na seção `PÁGINAS COM ERRO`. O tipo de erro indica o padrão atual:

| Erro | Padrão | O que fazer |
|------|--------|-------------|
| `SCRIPT_DIRETO_CDN` | Compat (`<script src="...-compat.js">`) | Seguir **Rota A** |
| `IMPORT_DIRETO_CDN` | Modular (`import { } from "...");`) | Seguir **Rota B** |

---

## Rota A: Página com Compat (script tag)

**13 páginas neste padrão:** `client.html`, `company.html`, `fornecedor.html`, `importar_especies.html`, `index.html`, `migrate-to-firebase.html`, `preromaneio.html`, `reset-system.html`, `romaneiotl.html`, `romaneiotora.html`, `romaneiotora_otimizado.html`, `romaneiotora_versao_dev.html`, `species.html`

### Antes

```html
<!-- Import direto do CDN (compat) -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>

<!-- Código que usa firebase.xxx() -->
<script>
  firebase.initializeApp({ ... });
  firebase.database().ref('caminho').once('value', ...);
</script>
```

### Passo a passo

1. **Remova** as tags `<script>` que importam do CDN compat
2. **Adicione** um `<script type="module">` que importa de `firebase-init.js`:
3. **Adapte** o código de `firebase.xxx()` para usar as instâncias importadas

### Depois

```html
<script type="module">
  import { app, auth, db, storage, ref, get, set, onValue } from './firebase-init.js';

  // Em vez de firebase.database().ref(...), use:
  const snapshot = await get(ref(db, 'caminho'));
  console.log(snapshot.val());

  // Em vez de firebase.auth().currentUser, use:
  console.log(auth.currentUser?.uid);

  // Em vez de firebase.storage().ref(...), use:
  // import { storageRef, uploadBytes } from './firebase-init.js';
  // const ref = storageRef(storage, 'arquivo.pdf');
  // await uploadBytes(ref, blob);
</script>
```

### Mapeamento compat → modular

| Compat (antigo) | Modular (novo) |
|-----------------|----------------|
| `firebase.initializeApp()` | Já feito em `firebase-init.js` |
| `firebase.database()` | `db` (instância exportada) |
| `firebase.database().ref()` | `ref(db, ...)` |
| `firebase.database().ref().once('value')` | `get(ref(db, ...))` |
| `firebase.database().ref().set()` | `set(ref(db, ...), valor)` |
| `firebase.database().ref().update()` | `update(ref(db, ...), dados)` |
| `firebase.database().ref().push()` | `push(ref(db, ...), valor)` |
| `firebase.database().ref().on('value')` | `onValue(ref(db, ...), callback)` |
| `firebase.database().ref().off()` | `off(ref(db, ...))` |
| `firebase.auth()` | `auth` (instância exportada) |
| `firebase.auth().currentUser` | `auth.currentUser` |
| `firebase.auth().signInWithEmailAndPassword()` | `signInWithEmailAndPassword(auth, email, pwd)` |
| `firebase.auth().signOut()` | `signOut(auth)` |
| `firebase.auth().onAuthStateChanged()` | `onAuthStateChanged(auth, callback)` |
| `firebase.storage()` | `storage` (instância exportada) |
| `firebase.storage().ref()` | `storageRef(storage, path)` |
| `firebase.storage().ref().put()` | `uploadBytes(storageRef(...), blob)` |
| `firebase.storage().ref().getDownloadURL()` | `getDownloadURL(storageRef(...))` |
| `firebase.functions()` | `functions` (instância exportada) |
| `firebase.functions().httpsCallable()` | `httpsCallable(functions, nome)` |

> **Dica:** A maioria das páginas compat usa `firebase.database()` intensamente. O padrão `ref(db, path)` é o equivalente modular.

---

## Rota B: Página com Modular (ESM import)

**3 páginas neste padrão:** `login.html`, `firebase-rules-update.html`, `fix-firebase-rules.html`

( Mais 1 página com padrão misto: `migrar-contas.html` usa `import()` dinâmico )

### Antes

```html
<script type="module">
  import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
  import { getDatabase, ref, get, set } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
  import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
  import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

  const app = getApps().length ? getApps()[0] : initializeApp({...});
  const db = getDatabase(app);
  const auth = getAuth(app);
  const storage = getStorage(app);
  // ... código existente
</script>
```

### Depois

```html
<script type="module">
  import { app, auth, db, storage, ref, get, set, onAuthStateChanged, signOut, storageRef, uploadBytes, getDownloadURL } from './firebase-init.js';

  // app, auth, db, storage já estão inicializados!
  // Use-os diretamente sem initializeApp() ou get*App()
  // ... código existente (adaptar chamadas se necessário)
</script>
```

### Mapeamento modular → firebase-init

| Import original (CDN) | Substituir por |
|-----------------------|----------------|
| `import { initializeApp, getApps } from 'firebase-app.js'` | Remover (já em `firebase-init.js`) |
| `import { getDatabase, ref, ... } from 'firebase-database.js'` | `import { db, ref, ... } from './firebase-init.js'` |
| `import { getAuth, onAuthStateChanged, ... } from 'firebase-auth.js'` | `import { auth, onAuthStateChanged, ... } from './firebase-init.js'` |
| `import { getStorage, ref as storageRef, ... } from 'firebase-storage.js'` | `import { storage, storageRef, ... } from './firebase-init.js'` |
| `import { getFunctions, httpsCallable } from 'firebase-functions.js'` | `import { functions, httpsCallable } from './firebase-init.js'` |
| `const app = initializeApp(config)` | Remover (app já vem do init) |
| `const db = getDatabase(app)` | Usar `db` diretamente |
| `const auth = getAuth(app)` | Usar `auth` diretamente |
| `const storage = getStorage(app)` | Usar `storage` diretamente |
| `window.database = getDatabase(app)` | `window.database = db` |

---

## Exemplo Completo: `financas.html` (já refatorado)

Consulte o arquivo `financas.html` como referência de migração bem-sucedida. As mudanças foram:

### O que mudou

**Antes (~50 linhas):**
```javascript
import { initializeApp, getApps } from 'https://...firebase-app.js';
import { getDatabase, ref, ... } from 'https://...firebase-database.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://...firebase-auth.js';
import { getStorage, ... } from 'https://...firebase-storage.js';

const firebaseConfig = { ... };
let app;
if (window._FIREBASE_APP) { app = window._FIREBASE_APP; }
else { app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig); }
window.database = getDatabase(app);
const auth = getAuth(app);
window.firebaseRef = ref;
window.firebaseSet = set;
onAuthStateChanged(auth, (user) => { ... });
// ... + funções auxiliares (getTenantId, etc.)
```

**Depois (~15 linhas):**
```javascript
import { app, auth, db, storage, ref, set, onAuthStateChanged, ... } from './firebase-init.js';

window.database = db;
window.firebaseRef = ref;
window.firebaseSet = set;
onAuthStateChanged(auth, (user) => { ... });
// ... funções auxiliares preservadas
```

---

## Verificação pós-migração

### 1. Healthcheck de compliance

```bash
node tools/healthcheck-firebase-sdk.mjs --ci
```

A página migrada deve:
- Desaparecer da seção `PÁGINAS COM ERRO`
- Aparecer em `PÁGINAS OK` com o marcador `📦 init`
- A contagem `Pages importando init` deve aumentar

### 2. Teste visual

Abra a página no navegador com `Ctrl+F5` (hard refresh) e verifique:

```
console: ✅ firebase-init: Firebase v10.7.1 inicializado (singleton)
console: ✅ FirebaseService: serviços Firebase prontos (via firebase-init.js)
console: ✅ Firebase conectado com sucesso!
```

Ausência de erros como:
- `FirebaseError: Firebase App named '[DEFAULT]' already exists`
- `signInAnonymously is not defined`
- `getApps is not defined`

### 3. Deploy

```bash
# Copiar firebase-init.js para o diretório de deploy
cp firebase-init.js hosting-dist/firebase-init.js

# Atualizar cachebusters + deploy
node tools/inject-cachebusters.mjs
firebase deploy --only hosting
```

---

## Ordem recomendada de migração

| Prioridade | Página | Padrão | Risco |
|------------|--------|--------|-------|
| 1 | `login.html` | Modular | Crítico (autenticação) |
| 2 | `index.html` | Compat | Crítico (página inicial) |
| 3 | `company.html` | Compat | Alto (admin multi-tenant) |
| 4 | `client.html`, `fornecedor.html`, `species.html` | Compat | Alto (CRUD principal) |
| 5 | `preromaneio.html`, `romaneiotl.html`, `romaneiotora*.html` | Compat | Médio (romaneios) |
| 6 | `firebase-rules-update.html`, `fix-firebase-rules.html` | Modular | Baixo (ferramentas admin) |
| 7 | `migrar-contas.html`, `migrate-to-firebase.html` | Misto | Baixo (migração única) |
| 8 | Demais páginas | Compat | Baixo |

---

## Troubleshooting

### Erro: `X is not defined`
**Causa:** O símbolo `X` não foi incluído no import de `firebase-init.js`.
**Solução:** Adicione `X` ao import:
```javascript
import { ..., X } from './firebase-init.js';
```
Se `X` não existir em `firebase-init.js`, adicione-o ao export.

### Erro: `Firebase App named '[DEFAULT]' already exists`
**Causa:** A página ainda chama `initializeApp()` mesmo importando de `firebase-init.js`.
**Solução:** Remova a chamada a `initializeApp()` — ela já é feita pelo módulo compartilhado.

### Erro: 404 ao carregar `firebase-init.js`
**Causa:** O arquivo não foi copiado para `hosting-dist/` antes do deploy.
**Solução:** Execute `cp firebase-init.js hosting-dist/firebase-init.js` antes do deploy.

### Erro: Auth não persiste entre reloads
**Causa:** `setPersistence` está configurado para `SESSION`. Se precisar de persistência duradoura (PWA), use `browserLocalPersistence`.
**Solução:** Em `firebaseService.js`, altere a chamada de `setPersistence`:
```javascript
const persistence = browserLocalPersistence; // em vez de browserSessionPersistence
```

---

## Referência

- `firebase-init.js` — módulo compartilhado (singleton)
- `firebaseService.js` — service principal (já refatorado)
- `financas.html` — exemplo de página refatorada
- `tools/healthcheck-firebase-sdk.mjs` — healthcheck + compliance
- `tools/inject-cachebusters.mjs` — cachebusters dinâmicos
