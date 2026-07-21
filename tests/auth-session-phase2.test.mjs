import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function extractBetween(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `inicio ausente: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `fim ausente: ${end}`);
  return source.slice(startIndex, endIndex);
}

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const removed = [];
  return {
    removed,
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { removed.push(key); data.delete(key); },
    clear() { data.clear(); },
    snapshot() { return Object.fromEntries(data); }
  };
}

async function createCoreHarness(options = {}) {
  const source = read('modules/core/firebase-service.js');
  const localStorage = createStorage(options.storage);
  const sessionStorage = createStorage();
  const authCallbacks = [];
  const counters = { authObservers: 0, tokenReads: 0, profileReads: 0 };
  let currentUser = null;

  const auth = {
    get currentUser() { return currentUser; },
    set currentUser(value) { currentUser = value; },
    onAuthStateChanged(success, error) {
      counters.authObservers += 1;
      authCallbacks.push({ success, error });
      return () => {};
    },
    async signInWithEmailAndPassword() { return { user: currentUser }; },
    async signOut() { currentUser = null; },
    async createUserWithEmailAndPassword() { return { user: currentUser }; }
  };

  const database = {
    ref(candidate) {
      return {
        on() {},
        async once() {
          if (String(candidate).startsWith('users/')) counters.profileReads += 1;
          const uid = String(candidate).startsWith('users/') ? String(candidate).slice('users/'.length) : '';
          const value = uid && typeof options.profileReader === 'function'
            ? await options.profileReader(uid)
            : (uid ? (options.profile || null) : null);
          return { val: () => value };
        },
        async update() {},
        async remove() {},
        push() { return { key: 'generated' }; }
      };
    }
  };

  const firebase = {
    apps: [{}],
    initializeApp() {},
    database: () => database,
    auth: () => auth
  };
  firebase.database.ServerValue = { TIMESTAMP: 1 };

  const listeners = new Map();
  const window = {
    ENABLE_ANON_AUTH: false,
    location: { pathname: '/index.html', search: '' },
    addEventListener(type, callback) { listeners.set(type, callback); },
    dispatchEvent() { return true; }
  };
  window.window = window;

  const context = vm.createContext({
    window,
    firebase,
    navigator: { onLine: true },
    localStorage,
    sessionStorage,
    CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    URLSearchParams,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    Date,
    Map,
    Set,
    Promise,
    Object,
    Array,
    String,
    Number,
    Boolean,
    JSON,
    Math,
    console: { log() {}, warn() {}, error() {}, debug() {} }
  });
  vm.runInContext(source, context, { filename: 'modules/core/firebase-service.js' });
  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    service: window.firebaseServiceTL,
    auth,
    counters,
    localStorage,
    emitAuth(user) {
      currentUser = user;
      for (const callback of authCallbacks) callback.success(user);
    },
    emitAuthError(error = new Error('observer failed')) {
      for (const callback of authCallbacks) callback.error(error);
    },
    createUser(uid = 'user-a') {
      return {
        uid,
        async getIdTokenResult(forceRefresh) {
          counters.tokenReads += 1;
          if (typeof options.tokenReader === 'function') return options.tokenReader(uid, forceRefresh);
          assert.equal(forceRefresh, false);
          const claims = options.claimsByUid && options.claimsByUid[uid]
            ? options.claimsByUid[uid]
            : (options.claims || {});
          return { claims };
        }
      };
    }
  };
}

test('servicos raiz e Home mantem somente um observer SDK por documento', () => {
  const rootService = read('firebaseService.js');
  const coreService = read('modules/core/firebase-service.js');
  assert.equal((rootService.match(/onAuthStateChanged\s*\(/g) || []).length, 1);
  assert.equal((coreService.match(/\.onAuthStateChanged\s*\(/g) || []).length, 1);
  assert.match(rootService, /const authReadyPromise = new Promise/);
  assert.match(rootService, /let sessionContextPromise = null/);
  assert.match(coreService, /this\.authReadyPromise = new Promise/);
  assert.match(coreService, /this\.sessionContextPromise = null/);
});

test('observer, contexto, token e perfil da Home sao single-flight', async () => {
  const harness = await createCoreHarness({ profile: { companyId: 'tenant-a' } });
  const { service, counters } = harness;
  assert.equal(counters.authObservers, 1);

  const waitA = service.waitForAuthReady(200);
  const waitB = service.waitForAuthReady(200);
  const waitC = service.authService.getCurrentUser();
  service.authService.onAuthStateChanged(() => {});
  assert.equal(counters.authObservers, 1);

  const user = harness.createUser();
  harness.emitAuth(user);
  const [, , currentUser] = await Promise.all([waitA, waitB, waitC]);
  assert.equal(currentUser, user);

  const contexts = await Promise.all([
    service.resolveAuthenticatedTenant(),
    service.resolveAuthenticatedTenant(),
    service.getSessionContext()
  ]);
  assert.ok(contexts.every((context) => context.success && context.companyId === 'tenant-a'));
  assert.equal(counters.authObservers, 1);
  assert.equal(counters.tokenReads, 1);
  assert.equal(counters.profileReads, 1);
});

test('timeout de Auth preserva tenant do mesmo UID e logout confirmado limpa', async () => {
  const storage = {
    company_info: JSON.stringify({ id: 'tenant-a', companyId: 'tenant-a', _authUid: 'user-a' }),
    currentUser: JSON.stringify({ uid: 'user-a', companyId: 'tenant-a' })
  };
  const harness = await createCoreHarness({ storage });
  harness.service.setTenantId('tenant-a');

  const context = await harness.service.resolveAuthenticatedTenant({ timeoutMs: 20 });
  assert.equal(context.code, 'auth-timeout');
  assert.equal(harness.service.getTenantId(), 'tenant-a');
  assert.ok(harness.localStorage.getItem('company_info'));

  harness.emitAuth(null);
  assert.equal(harness.service.getTenantId(), null);
  assert.equal(harness.localStorage.getItem('company_info'), null);
});

test('navegacao comum nao forca refresh e refreshes ficam centralizados', () => {
  const rootService = read('firebaseService.js');
  const coreService = read('modules/core/firebase-service.js');
  const auth = read('auth.js');
  const home = read('index.html');
  const login = read('login.html');

  assert.equal((rootService.match(/getIdTokenResult\(true\)/g) || []).length, 1);
  assert.equal((coreService.match(/getIdTokenResult\(true\)/g) || []).length, 1);
  assert.doesNotMatch(auth, /getIdTokenResult\(true\)/);
  assert.doesNotMatch(home, /getIdTokenResult\(true\)/);
  assert.doesNotMatch(login, /getIdTokenResult\(true\)/);
});

test('Login nao espera RTDB e Home delega tenant ao contexto canonico', () => {
  const login = read('login.html');
  const home = read('index.html');
  const loginHandler = extractBetween(login, 'window.handleLogin = async function(event)', 'window.handleRegister = async function(event)');
  const homeGuard = extractBetween(home, 'async function enforceTenantContext()', 'const tenantContext = await enforceTenantContext()');

  assert.match(loginHandler, /const result = await executeLogin\(email, password\)/);
  assert.doesNotMatch(loginHandler, /await waitForFirebaseConnection/);
  assert.match(homeGuard, /await svc\.resolveAuthenticatedTenant\(\{ timeoutMs: 5000 \}\)/);
  assert.doesNotMatch(homeGuard, /loadData\(`users\/|getIdTokenResult|localStorage\.setItem\('company_info'/);
});

test('Home carrega Auth compat antes do servico canonico para confirmar logout', () => {
  const home = read('index.html');
  const authCompat = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js';
  const coreService = 'modules/core/firebase-service.js';

  assert.match(home, new RegExp(`<script defer src="${authCompat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"></script>`));
  assert.ok(
    home.indexOf(authCompat) < home.indexOf(coreService),
    'Firebase Auth deve estar disponivel antes do servico usado pelo menu para logout'
  );
});

test('formularios de autenticacao nunca enviam credenciais pela query string', () => {
  const login = read('login.html');

  for (const formId of ['loginForm', 'registerForm', 'forgotPasswordForm']) {
    const formTag = login.match(new RegExp(`<form[^>]*id=["']${formId}["'][^>]*>`, 'i'))?.[0] || '';
    assert.ok(formTag, `formulario ${formId} deve existir`);
    assert.match(formTag, /\bmethod=["']post["']/i, `${formId} deve usar POST mesmo antes do JavaScript inicializar`);
  }
});

test('tenant degradado so pode ser preservado para o mesmo UID', () => {
  const rootService = read('firebaseService.js');
  const coreService = read('modules/core/firebase-service.js');
  assert.match(rootService, /function getPreservableTenant\(uid\)/);
  assert.match(rootService, /source && source\._authUid/);
  assert.match(coreService, /getPreservableTenant\(uid\)/);
  assert.match(coreService, /companyInfo\._authUid/);
});

test('resultado tardio do usuario anterior nao contamina token, perfil ou tenant do proximo UID', async () => {
  let releaseUserA;
  const userAToken = new Promise((resolve) => { releaseUserA = resolve; });
  const harness = await createCoreHarness({
    tokenReader(uid) {
      if (uid === 'user-a') return userAToken;
      return Promise.resolve({ claims: { companyId: 'tenant-b' } });
    },
    profileReader(uid) {
      return Promise.resolve({ companyId: uid === 'user-a' ? 'tenant-a' : 'tenant-b' });
    }
  });

  harness.emitAuth(harness.createUser('user-a'));
  harness.emitAuth(harness.createUser('user-b'));
  const userBContext = await harness.service.resolveAuthenticatedTenant({ timeoutMs: 200 });
  assert.equal(userBContext.companyId, 'tenant-b');

  releaseUserA({ claims: { companyId: 'tenant-a' } });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const finalContext = await harness.service.resolveAuthenticatedTenant({ timeoutMs: 200 });
  const companyInfo = JSON.parse(harness.localStorage.getItem('company_info'));
  assert.equal(finalContext.companyId, 'tenant-b');
  assert.equal(harness.service.getTenantId(), 'tenant-b');
  assert.equal(companyInfo.companyId, 'tenant-b');
  assert.equal(companyInfo._authUid, 'user-b');
});

test('resultado tardio nao restaura tenant depois de logout confirmado', async () => {
  let releaseToken;
  const pendingToken = new Promise((resolve) => { releaseToken = resolve; });
  const harness = await createCoreHarness({ tokenReader: () => pendingToken });
  harness.emitAuth(harness.createUser('user-a'));

  const logout = await harness.service.authService.logout();
  assert.equal(logout.success, true);
  assert.equal(harness.service.authUser, null);
  assert.equal(harness.service.getTenantId(), null);

  releaseToken({ claims: { companyId: 'tenant-a' } });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(harness.service.authUser, null);
  assert.equal(harness.service.getTenantId(), null);
  assert.equal(harness.localStorage.getItem('company_info'), null);
});

test('cache legado sem authUid nao e preservado nem carimbado para outro usuario', async () => {
  const harness = await createCoreHarness({
    storage: {
      company_info: JSON.stringify({ companyId: 'tenant-a' }),
      currentUser: JSON.stringify({ uid: 'user-b', companyId: 'tenant-a' })
    },
    tokenReader: async () => { throw new Error('network'); },
    profileReader: async () => { throw new Error('network'); }
  });
  harness.service.setTenantId('tenant-a');
  harness.emitAuth(harness.createUser('user-b'));

  const context = await harness.service.resolveAuthenticatedTenant({ timeoutMs: 200 });
  assert.equal(context.code, 'missing-companyId');
  assert.equal(harness.service.getTenantId(), null);
  assert.equal(harness.localStorage.getItem('company_info'), null);
});

test('resolucao autoritativa de outro tenant descarta dados empresariais do cache anterior', async () => {
  const harness = await createCoreHarness({
    storage: {
      company_info: JSON.stringify({ companyId: 'tenant-a', nome: 'Empresa A', cnpj: 'cache-antigo' })
    },
    claimsByUid: { 'user-b': { companyId: 'tenant-b' } }
  });
  harness.service.setTenantId('tenant-a');
  harness.emitAuth(harness.createUser('user-b'));

  const context = await harness.service.resolveAuthenticatedTenant({ timeoutMs: 200 });
  const companyInfo = JSON.parse(harness.localStorage.getItem('company_info'));
  assert.equal(context.companyId, 'tenant-b');
  assert.equal(companyInfo.companyId, 'tenant-b');
  assert.equal(companyInfo._authUid, 'user-b');
  assert.equal(companyInfo.nome, undefined);
  assert.equal(companyInfo.cnpj, undefined);
});

test('erro do observer e timeout bloqueiam a carga operacional da Home', async () => {
  const harness = await createCoreHarness();
  harness.emitAuthError(new Error('observer failed'));
  const context = await harness.service.resolveAuthenticatedTenant({ timeoutMs: 20 });
  assert.equal(context.code, 'auth-observer-error');

  const home = read('index.html');
  assert.match(home, /tenantContext\.success !== true/);
  assert.doesNotMatch(home, /authenticated: false, offline: true/);
});

test('contexto degradado tenta novamente e se recupera sem recarregar a pagina', async () => {
  let tokenAttempt = 0;
  const harness = await createCoreHarness({
    storage: {
      company_info: JSON.stringify({ companyId: 'tenant-a', _authUid: 'user-a' })
    },
    tokenReader: async () => {
      tokenAttempt += 1;
      if (tokenAttempt === 1) throw new Error('network');
      return { claims: { companyId: 'tenant-a' } };
    },
    profileReader: async () => { throw new Error('network'); }
  });
  harness.service.setTenantId('tenant-a');
  harness.emitAuth(harness.createUser('user-a'));

  const degraded = await harness.service.resolveAuthenticatedTenant({ timeoutMs: 200 });
  assert.equal(degraded.degraded, true);
  await new Promise((resolve) => queueMicrotask(resolve));

  const recovered = await harness.service.resolveAuthenticatedTenant({ timeoutMs: 200 });
  assert.equal(recovered.success, true);
  assert.equal(recovered.degraded, undefined);
  assert.equal(recovered.companyId, 'tenant-a');
  assert.equal(tokenAttempt, 2);
});

test('adaptador da Home preserva assinatura legada de observer com dois argumentos', async () => {
  const harness = await createCoreHarness();
  let observed = 'not-called';
  harness.service.authService.onAuthStateChanged(harness.auth, (user) => { observed = user; });
  const user = harness.createUser('user-a');
  harness.emitAuth(user);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(observed, user);
  assert.equal(harness.counters.authObservers, 1);
});

test('suporte da Home usa adaptador callable sem importar outro servico Auth', () => {
  const menu = read('menu-component.js');
  const adapter = read('support-callable-service.js');
  assert.match(menu, /support-callable-service\.js/);
  assert.doesNotMatch(menu, /__siswebResolveRootScriptPath\('firebaseService\.js'\)/);
  assert.match(adapter, /firebase\.functions\('us-central1'\)\.httpsCallable/);
  assert.doesNotMatch(adapter, /onAuthStateChanged/);
  assert.match(menu, /const target = window\.firebaseService \|\| \{\};\s*Object\.assign\(target, adapter\);/s);
  assert.doesNotMatch(menu, /const merged = \{ \.\.\.\(window\.firebaseService/);
});

test('fallback offline nao transforma cache local em autorizacao operacional', () => {
  const rootService = read('firebaseService.js');
  const resolver = extractBetween(rootService, 'async function resolveAuthenticatedTenant(options = {})', 'function getCurrentUid()');
  assert.doesNotMatch(resolver, /authenticated: false, cached: true/);
  assert.doesNotMatch(resolver, /persistTenantContext\(cachedTenant/);
});

test('Auth revalida o UID apos awaits e Home agenda recuperacao sem segundo guard legado', () => {
  const auth = read('auth.js');
  const home = read('index.html');
  const companyContext = extractBetween(auth, 'async function setCompanyContext(companyId, options = {})', 'async function tryRestoreCompanyClaim');
  const claimRestore = extractBetween(auth, 'async function tryRestoreCompanyClaim(user, companyId)', '// Variável para rastrear inicialização');
  const cachedGuard = extractBetween(auth, 'async function tryAllowCachedAuthSession(source)', 'function parseUsersCacheSafe');
  assert.match(auth, /function isSameActiveAuthUser\(user\)/);
  assert.ok((companyContext.match(/isActiveAuthUid\(ownerUid\)/g) || []).length >= 6);
  assert.doesNotMatch(claimRestore, /loadFromFirebase\('users\/' \+ user\.uid\)/);
  assert.ok((auth.match(/if \(!isSameActiveAuthUser\(user\)\)/g) || []).length >= 6);
  assert.match(cachedGuard, /return \{ allowed: false \}/);
  assert.doesNotMatch(cachedGuard, /allowed: true/);
  assert.match(home, /function scheduleDashboardSessionRecovery\(\)/);
  assert.match(home, /window\.addEventListener\('online', retryDashboardAfterSessionRecovery/);
  assert.doesNotMatch(home, /localStorage\.setItem\('company_info', JSON\.stringify\(restoredCompany\)\)/);
});

test('logout do menu preserva caches quando o backend nao confirma sign-out', () => {
  const menu = read('menu-component.js');
  const logoutBlock = extractBetween(menu, 'async function performSafeLogout(reason)', 'class MenuComponent extends HTMLElement');
  assert.match(logoutBlock, /result\.success !== true/);
  assert.ok(logoutBlock.indexOf('result.success !== true') < logoutBlock.indexOf("localStorage.removeItem('currentUser')"));
  const catchBlock = logoutBlock.slice(logoutBlock.indexOf('} catch (err)'));
  assert.doesNotMatch(catchBlock, /removeItem\('currentUser'\)|clearSiswebCompanyContextCache/);
});

test('logout limpa caches somente depois de sign-out confirmado', () => {
  const auth = read('auth.js');
  const login = read('login.html');
  const authLogout = extractBetween(auth, 'async function logout()', '// Função para obter o nome do usuário logado');
  const loginLogout = extractBetween(login, 'async function forceLogoutSession()', 'async function goToSystemHome()');

  assert.match(authLogout, /if \(!result \|\| result\.success !== true\)/);
  assert.ok(authLogout.indexOf('result.success !== true') < authLogout.indexOf("localStorage.removeItem('currentUser')"));
  const authCatch = authLogout.slice(authLogout.indexOf('} catch (error)'));
  assert.doesNotMatch(authCatch, /removeItem\('currentUser'\)|clearCompanyContextCache\(\)/);

  assert.doesNotMatch(loginLogout, /waitForFirebaseConnection|_FIREBASE_CONNECTED/);
  assert.match(loginLogout, /if \(!result\.success\) \{[\s\S]*throw result\.error \|\| new Error\('Logout remoto não confirmado\.'\)/);
  assert.ok(loginLogout.indexOf('if (!result.success)') < loginLogout.indexOf('clearAllAuthLocalState()'));
  const loginCatch = loginLogout.slice(loginLogout.indexOf('} catch (error)'));
  assert.doesNotMatch(loginCatch, /clearAllAuthLocalState\(\)/);
});
