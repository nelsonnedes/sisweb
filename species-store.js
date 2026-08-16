(function(global) {
    'use strict';

    const tools = global.SiswebSpecies || {};
    const COLLECTION = 'especies';
    const CACHE_TTL_MS = 5 * 60 * 1000;

    const state = {
        tenantId: '',
        items: [],
        loadedAt: 0,
        loadingPromise: null,
        source: 'empty',
        subscription: null,
        subscriptionTenant: '',
        lastError: null
    };

    const subscribers = new Set();

    function normalizeNameKey(value) {
        if (tools.normalizeNameKey) return tools.normalizeNameKey(value);
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getDisplayName(specie) {
        if (tools.getDisplayName) return tools.getDisplayName(specie);
        return String((specie && (specie.especie || specie.nome || specie.name || specie.nomeComum)) || '').trim();
    }

    function getScientificName(specie) {
        if (tools.getScientificName) return tools.getScientificName(specie);
        return String((specie && (specie.nomeCientifico || specie.scientificName || specie.scientific || specie.descricao || specie.description || specie.decription)) || '').trim();
    }

    function normalizeList(rawData) {
        if (tools.normalizeList) return tools.normalizeList(rawData);
        if (!rawData) return [];

        const list = Array.isArray(rawData)
            ? rawData.map((item, index) => {
                const value = item && typeof item === 'object' ? item : {};
                const key = String(index);
                return {
                    ...value,
                    id: key,
                    key,
                    firebaseKey: key,
                    originalId: value.id || value.key || key
                };
            })
            : Object.keys(rawData || {}).map((key) => {
                const value = rawData[key] && typeof rawData[key] === 'object' ? rawData[key] : {};
                return {
                    ...value,
                    id: key,
                    key,
                    firebaseKey: key,
                    originalId: value.id || value.key || key
                };
            });

        const seen = new Set();
        return list
            .filter(item => item && typeof item === 'object')
            .map((item, index) => ({
                ...item,
                id: item.firebaseKey || item.key || item.id || `specie_${index}`,
                especie: getDisplayName(item),
                nome: getDisplayName(item),
                name: getDisplayName(item),
                nomeCientifico: getScientificName(item)
            }))
            .filter((item) => {
                const key = normalizeNameKey(getDisplayName(item));
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    }

    function resolveTenantId() {
        try {
            const services = [global.firebaseService, global.firebaseServiceTL, global.FirebaseService];
            for (const svc of services) {
                if (!svc) continue;
                if (typeof svc.getCurrentTenantId === 'function') {
                    const id = svc.getCurrentTenantId();
                    if (id) return String(id);
                }
                if (typeof svc.getTenantId === 'function') {
                    const id = svc.getTenantId();
                    if (id) return String(id);
                }
            }
        } catch (_) {}
        try {
            if (global.appTenantId) return String(global.appTenantId);
            if (global.companyInfo) {
                const info = global.companyInfo;
                const id = info.companyId || info.companyID || info.tenantId || info.id;
                if (id) return String(id);
            }
        } catch (_) {}
        try {
            const keys = ['company_info', 'companyInfo', 'currentUser', 'persistentUser'];
            for (const key of keys) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const info = JSON.parse(raw);
                const id = info && (info.companyId || info.companyID || info.tenantId || info.id || info.company_id);
                if (id) return String(id);
            }
        } catch (_) {}
        return '';
    }

    function getFirebaseService() {
        return global.firebaseService || global.firebaseServiceTL || global.FirebaseService || null;
    }

    function getNamespacedPath(path, tenantId) {
        const svc = getFirebaseService();
        try {
            if (svc && typeof svc.getNamespacedPath === 'function') {
                const ns = svc.getNamespacedPath(path);
                if (ns) return ns;
            }
        } catch (_) {}
        const tenant = tenantId || resolveTenantId();
        return tenant ? `companies/${tenant}/${path}` : `companies/__no_tenant__/${path}`;
    }

    function getStorageKeys(tenantId) {
        const tenant = tenantId || resolveTenantId();
        if (tenant) {
            return [
                `companies/${tenant}/${COLLECTION}`,
                `company_${tenant}__${COLLECTION}`,
                `companies/${tenant}/${COLLECTION}_cache`,
                `company_${tenant}__${COLLECTION}_cache`
            ];
        }
        return [
            `companies/__no_tenant__/${COLLECTION}`
        ];
    }

    function readCachedList(tenantId) {
        for (const key of getStorageKeys(tenantId)) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                const list = normalizeList(parsed);
                if (list.length) return { list, key };
            } catch (_) {}
        }
        return { list: [], key: '' };
    }

    function writeCache(list, tenantId) {
        const tenant = tenantId || resolveTenantId();
        if (!tenant || !Array.isArray(list)) return;
        const cacheMap = list.reduce((acc, item, index) => {
            const key = String((item && (item.firebaseKey || item.key || item.id || item.originalId)) || index);
            if (key) acc[key] = item;
            return acc;
        }, {});
        const payload = JSON.stringify(cacheMap);
        const keys = [
            `companies/${tenant}/${COLLECTION}`,
            `company_${tenant}__${COLLECTION}`,
            `company_${tenant}__${COLLECTION}_cache`
        ];
        keys.forEach((key) => {
            try { localStorage.setItem(key, payload); } catch (_) {}
        });
    }

    function resetForTenant(tenantId) {
        const tenant = tenantId || '';
        if (state.tenantId === tenant) return;
        stopRealtime();
        state.tenantId = tenant;
        state.items = [];
        state.loadedAt = 0;
        state.loadingPromise = null;
        state.source = 'empty';
        state.lastError = null;
    }

    function setItems(rawData, meta) {
        const options = meta || {};
        const tenant = options.tenantId || resolveTenantId();
        resetForTenant(tenant);
        state.items = normalizeList(rawData);
        state.loadedAt = Date.now();
        state.source = options.source || 'memory';
        state.lastError = null;
        if (state.items.length) writeCache(state.items, tenant);
        notify();
        return state.items;
    }

    function getSnapshot() {
        return {
            tenantId: state.tenantId || resolveTenantId(),
            items: state.items.slice(),
            loadedAt: state.loadedAt,
            source: state.source,
            isLoading: Boolean(state.loadingPromise),
            lastError: state.lastError
        };
    }

    function notify() {
        const snapshot = getSnapshot();
        subscribers.forEach((callback) => {
            try { callback(snapshot); } catch (_) {}
        });
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function waitForContext(timeoutMs) {
        const startedAt = Date.now();
        let tenant = resolveTenantId();
        let svc = getFirebaseService();
        while ((!tenant || !svc || typeof svc.loadFromFirebase !== 'function') && Date.now() - startedAt < timeoutMs) {
            await delay(100);
            tenant = resolveTenantId();
            svc = getFirebaseService();
        }
        return { tenantId: tenant, service: svc };
    }

    function loadFromCache(tenantId) {
        const cached = readCachedList(tenantId);
        if (cached.list.length) {
            setItems(cached.list, { tenantId, source: `cache:${cached.key}` });
        }
        return state.items;
    }

    async function loadRemote(options) {
        const opts = options || {};
        const context = await waitForContext(Number(opts.timeoutMs || 3500));
        const tenant = context.tenantId;
        const svc = context.service;
        resetForTenant(tenant || '');

        if (!tenant) {
            loadFromCache('');
            state.lastError = new Error('tenantId indisponivel para carregar especies');
            notify();
            return state.items;
        }

        if (!svc || typeof svc.loadFromFirebase !== 'function') {
            loadFromCache(tenant);
            state.lastError = new Error('firebaseService indisponivel para carregar especies');
            notify();
            return state.items;
        }

        const result = await svc.loadFromFirebase(COLLECTION, { forceRefresh: opts.force === true });
        const data = result && result.success && result.data ? result.data : result;
        return setItems(data || [], {
            tenantId: tenant,
            source: result && result.path ? `firebase:${result.path}` : `firebase:${getNamespacedPath(COLLECTION, tenant)}`
        });
    }

    async function getAll(options) {
        const opts = options || {};
        const tenant = resolveTenantId();
        resetForTenant(tenant || '');
        if (opts.realtime !== false) startRealtime();

        if (!state.items.length) {
            loadFromCache(tenant);
        }

        const isFresh = state.items.length && (Date.now() - state.loadedAt < CACHE_TTL_MS);
        const shouldLoadRemote = Boolean(opts.force || !state.items.length || opts.waitRemote || !isFresh);

        if (!shouldLoadRemote) return state.items.slice();

        if (!state.loadingPromise) {
            state.loadingPromise = loadRemote(opts)
                .catch((error) => {
                    state.lastError = error;
                    loadFromCache(resolveTenantId());
                    notify();
                    return state.items;
                })
                .finally(() => {
                    state.loadingPromise = null;
                    notify();
                });
            notify();
        }

        if (state.items.length && !opts.waitRemote && !opts.force) {
            return state.items.slice();
        }

        const items = await state.loadingPromise;
        return (items || state.items).slice();
    }

    function getCached() {
        const tenant = resolveTenantId();
        resetForTenant(tenant || '');
        if (!state.items.length) loadFromCache(tenant);
        return state.items.slice();
    }

    function search(term) {
        const key = normalizeNameKey(term);
        const list = getCached();
        if (!key) return list;
        return list.filter((specie) => {
            return normalizeNameKey(getDisplayName(specie)).includes(key)
                || normalizeNameKey(getScientificName(specie)).includes(key);
        });
    }

    function subscribe(callback) {
        if (typeof callback !== 'function') return function noop() {};
        subscribers.add(callback);
        try { callback(getSnapshot()); } catch (_) {}
        return function unsubscribe() {
            subscribers.delete(callback);
        };
    }

    function stopRealtime() {
        if (!state.subscription) return;
        try {
            if (typeof state.subscription === 'function') {
                state.subscription();
            } else if (typeof state.subscription.unsubscribe === 'function') {
                state.subscription.unsubscribe();
            } else if (state.subscription.ref && state.subscription.callback && state.subscription.ref.off) {
                state.subscription.ref.off('value', state.subscription.callback);
            }
        } catch (_) {}
        state.subscription = null;
        state.subscriptionTenant = '';
    }

    function startRealtime(options) {
        const opts = options || {};
        const tenant = resolveTenantId();
        if (!tenant) return null;
        if (state.subscription && state.subscriptionTenant === tenant && !opts.force) return state.subscription;

        stopRealtime();
        const svc = getFirebaseService();

        if (svc && typeof svc.subscribe === 'function') {
            state.subscription = svc.subscribe(COLLECTION, (payload) => {
                setItems(payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload, {
                    tenantId: tenant,
                    source: payload && payload.path ? `realtime:${payload.path}` : `realtime:${getNamespacedPath(COLLECTION, tenant)}`
                });
            });
            state.subscriptionTenant = tenant;
            return state.subscription;
        }

        try {
            const path = getNamespacedPath(COLLECTION, tenant);
            const database = global.firebase && typeof global.firebase.database === 'function'
                ? global.firebase.database()
                : null;
            if (!database) return null;
            const ref = database.ref(path);
            const callback = (snapshot) => {
                setItems(snapshot.val() || [], { tenantId: tenant, source: `realtime:${path}` });
            };
            ref.on('value', callback);
            state.subscription = { ref, callback, unsubscribe: () => ref.off('value', callback) };
            state.subscriptionTenant = tenant;
            return state.subscription;
        } catch (_) {
            return null;
        }
    }

    function invalidate() {
        state.loadedAt = 0;
        state.items = [];
        state.loadingPromise = null;
        notify();
    }

    async function init(options) {
        const opts = options || {};
        if (opts.realtime !== false) startRealtime();
        return getAll({ waitRemote: opts.waitRemote === true, timeoutMs: opts.timeoutMs || 3500 });
    }

    global.SiswebSpeciesStore = {
        collection: COLLECTION,
        init,
        getAll,
        getCached,
        search,
        subscribe,
        startRealtime,
        stopRealtime,
        invalidate,
        resolveTenantId,
        getSnapshot,
        normalizeList,
        getDisplayName,
        getScientificName,
        normalizeNameKey
    };

    global.addEventListener('species:updated', () => {
        invalidate();
        getAll({ force: true, waitRemote: true, timeoutMs: 5000 }).catch(() => {});
    });
})(window);
