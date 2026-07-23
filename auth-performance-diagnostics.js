(function bootstrapSiswebAuthPerformanceDiagnostics(global) {
    'use strict';

    if (!global) return;

    let enabled = false;
    try {
        enabled = new URLSearchParams(global.location.search || '').get('diag') === 'auth-perf';
    } catch (_) {}
    if (!enabled || global.__SISWEB_AUTH_PERF__) return;

    const VERSION = 1;
    const MAX_EVENTS = 1000;
    const ROUTES = Object.freeze({
        '/': 'dashboard',
        '/index.html': 'dashboard',
        '/login.html': 'login',
        '/vendas.html': 'sales',
        '/compras.html': 'purchases',
        '/estoque.html': 'inventory',
        '/financas.html': 'finance',
        '/notas-fiscais.html': 'invoices',
        '/client.html': 'customers',
        '/fornecedor.html': 'suppliers',
        '/company.html': 'company',
        '/romaneiotl.html': 'shipping_tl',
        '/folha_pagamento/folha.html': 'payroll'
    });
    const SOURCES = new Set([
        'browser',
        'query',
        'root_service',
        'auth_guard',
        'core_service',
        'company_service',
        'finance_page',
        'shipping_page',
        'payroll_page',
        'firebase_event',
        'unknown'
    ]);
    const PHASES = new Set([
        'diagnostics_enabled',
        'document_dom_content_loaded',
        'document_load',
        'firebase_init_start',
        'firebase_init_ready',
        'firebase_init_error',
        'auth_observer',
        'route_guard',
        'session_resolve',
        'tenant_resolve',
        'data_load',
        'bootstrap',
        'unknown'
    ]);
    const OUTCOMES = new Set(['started', 'ready', 'success', 'error', 'timeout', 'hit', 'miss', 'joined', 'write', 'quota', 'observed', 'unknown']);
    const AUTH_STATES = new Set(['booting', 'authenticated', 'unauthenticated', 'cached', 'error', 'unknown']);
    const READ_KINDS = new Set(['logical', 'physical', 'joined', 'listener_first_value', 'unknown']);
    const CACHE_LAYERS = new Set(['memory', 'local', 'indexeddb', 'service_worker', 'unknown']);
    const LISTENER_KINDS = new Set(['auth', 'rtdb', 'data', 'internet', 'unknown']);
    const LISTENER_ACTIONS = new Set(['add', 'remove', 'first_value', 'error', 'timeout', 'unknown']);
    const TOKEN_REASONS = new Set(['login_initial_claims', 'claims_changed', 'authenticated_retry', 'admin_claim_sync', 'legacy_unspecified']);
    const RESOURCE_GROUPS = Object.freeze({
        users: 'users',
        companies: 'companies',
        tenants: 'tenants',
        clientes: 'customers',
        clients: 'customers',
        fornecedores: 'suppliers',
        suppliers: 'suppliers',
        vendas: 'sales',
        purchases: 'purchases',
        compras: 'purchases',
        financas: 'finance',
        estoque: 'inventory',
        notas: 'invoices',
        nfe: 'invoices',
        unknown: 'unknown'
    });

    const startedAt = now();
    const pageViewId = createId();
    const routeCode = getRouteCode();
    const events = [];
    const state = {
        auth: 'booting',
        rtdb: 'unknown',
        internet: global.navigator ? global.navigator.onLine !== false : null,
        tenantPresent: false,
        tenantTag: null
    };
    const hmacKeyPromise = createHmacKey();
    let sequence = 0;

    function now() {
        try {
            if (global.performance && typeof global.performance.now === 'function') {
                return global.performance.now();
            }
        } catch (_) {}
        return Date.now();
    }

    function createId() {
        try {
            if (global.crypto && typeof global.crypto.randomUUID === 'function') {
                return global.crypto.randomUUID();
            }
        } catch (_) {}
        return `pv-${Date.now().toString(36)}`;
    }

    function getRouteCode() {
        try {
            return ROUTES[String(global.location.pathname || '/')] || 'unknown';
        } catch (_) {
            return 'unknown';
        }
    }

    function roundDuration(value) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) return 0;
        return Math.round(number * 10) / 10;
    }

    function allowed(value, values) {
        const normalized = String(value || '').trim().toLowerCase();
        return values.has(normalized) ? normalized : 'unknown';
    }

    function allowedSource(value) {
        return allowed(value, SOURCES);
    }

    function addEvent(kind, source, fields) {
        const event = Object.assign({
            v: VERSION,
            seq: ++sequence,
            pageViewId,
            routeCode,
            tMs: roundDuration(now() - startedAt),
            kind,
            source: allowedSource(source)
        }, fields || {});
        events.push(event);
        if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
        return event;
    }

    function bytesFromInjectedKey() {
        const value = global.__SISWEB_AUTH_PERF_RUN_KEY__;
        if (typeof value !== 'string' || !/^[0-9a-f]{64}$/i.test(value)) return null;
        const bytes = new Uint8Array(32);
        for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = Number.parseInt(value.slice(index * 2, (index * 2) + 2), 16);
        }
        return bytes;
    }

    async function createHmacKey() {
        try {
            if (!global.crypto || !global.crypto.subtle || !global.crypto.getRandomValues) return null;
            const bytes = bytesFromInjectedKey() || global.crypto.getRandomValues(new Uint8Array(32));
            return global.crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        } catch (_) {
            return null;
        }
    }

    async function createTag(value) {
        try {
            const normalized = String(value == null ? '' : value).trim();
            if (!normalized || typeof TextEncoder === 'undefined') return null;
            const key = await hmacKeyPromise;
            if (!key) return null;
            const signature = await global.crypto.subtle.sign('HMAC', key, new TextEncoder().encode(normalized));
            return Array.from(new Uint8Array(signature).slice(0, 12))
                .map((byte) => byte.toString(16).padStart(2, '0'))
                .join('');
        } catch (_) {
            return null;
        }
    }

    function attachTag(event, field, value) {
        void createTag(value).then((tag) => {
            if (tag) event[field] = tag;
        });
    }

    function resourceGroup(value) {
        const firstSegment = String(value == null ? '' : value)
            .trim()
            .replace(/^\/+/, '')
            .split('/', 1)[0]
            .toLowerCase();
        return RESOURCE_GROUPS[firstSegment] || 'unknown';
    }

    function phase(name, source, outcome, durationMs) {
        addEvent('phase', source, {
            phase: allowed(name, PHASES),
            outcome: allowed(outcome || 'observed', OUTCOMES),
            durationMs: roundDuration(durationMs)
        });
    }

    function auth(authState, source, durationMs) {
        state.auth = allowed(authState, AUTH_STATES);
        addEvent('auth_state', source, { state: state.auth, durationMs: roundDuration(durationMs) });
    }

    function rtdb(connected, source) {
        state.rtdb = connected === true ? 'connected' : connected === false ? 'disconnected' : 'unknown';
        addEvent('rtdb_state', source, { state: state.rtdb });
    }

    function internet(online, source) {
        state.internet = online === true ? 'online' : online === false ? 'offline' : 'unknown';
        addEvent('internet_state', source, { state: state.internet });
    }

    function tenant(value, source) {
        const present = String(value == null ? '' : value).trim().length > 0;
        state.tenantPresent = present;
        state.tenantTag = null;
        const event = addEvent('tenant_state', source, { state: present ? 'ready' : 'absent' });
        if (!present) return;
        attachTag(event, 'tenantTag', value);
        void createTag(value).then((tag) => {
            state.tenantTag = tag;
        });
    }

    function read(resourceKey, source, readKind, outcome, durationMs) {
        const event = addEvent('data_read', source, {
            readKind: allowed(readKind || 'logical', READ_KINDS),
            resourceGroup: resourceGroup(resourceKey),
            outcome: allowed(outcome || 'started', OUTCOMES),
            durationMs: roundDuration(durationMs)
        });
        attachTag(event, 'resourceTag', resourceKey);
    }

    function cache(resourceKey, layer, outcome, source) {
        const event = addEvent('cache', source, {
            layer: allowed(layer || 'unknown', CACHE_LAYERS),
            outcome: allowed(outcome || 'unknown', OUTCOMES),
            resourceGroup: resourceGroup(resourceKey)
        });
        attachTag(event, 'resourceTag', resourceKey);
    }

    function listener(listenerKind, action, source, durationMs) {
        addEvent('listener', source, {
            listenerKind: allowed(listenerKind || 'unknown', LISTENER_KINDS),
            action: allowed(action || 'unknown', LISTENER_ACTIONS),
            durationMs: roundDuration(durationMs)
        });
    }

    function tokenRefresh(reason, source, outcome, durationMs) {
        addEvent('token_refresh', source, {
            reason: allowed(reason || 'legacy_unspecified', TOKEN_REASONS),
            outcome: allowed(outcome || 'started', OUTCOMES),
            durationMs: roundDuration(durationMs)
        });
    }

    function navigationTiming() {
        try {
            const entry = global.performance && global.performance.getEntriesByType
                ? global.performance.getEntriesByType('navigation')[0]
                : null;
            if (!entry) return null;
            return {
                durationMs: roundDuration(entry.duration),
                domInteractiveMs: roundDuration(entry.domInteractive),
                domContentLoadedMs: roundDuration(entry.domContentLoadedEventEnd),
                loadEventMs: roundDuration(entry.loadEventEnd)
            };
        } catch (_) {
            return null;
        }
    }

    function deepFreeze(value) {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
        return value;
    }

    function snapshot() {
        return deepFreeze(JSON.parse(JSON.stringify({
            v: VERSION,
            pageViewId,
            routeCode,
            elapsedMs: roundDuration(now() - startedAt),
            state: {
                auth: state.auth,
                rtdb: state.rtdb,
                internet: state.internet,
                tenantPresent: state.tenantPresent,
                tenantTag: state.tenantTag
            },
            navigation: navigationTiming(),
            events: events.slice()
        })));
    }

    function clear() {
        events.length = 0;
    }

    const api = Object.freeze({
        phase,
        auth,
        rtdb,
        internet,
        tenant,
        read,
        cache,
        listener,
        tokenRefresh,
        snapshot,
        clear
    });

    Object.defineProperty(global, '__SISWEB_AUTH_PERF__', {
        value: api,
        writable: false,
        configurable: false
    });
    try {
        if (global.document && global.document.documentElement) {
            global.document.documentElement.setAttribute('data-sisweb-auth-perf', 'ready');
        }
    } catch (_) {}

    phase('diagnostics_enabled', 'query', 'ready', 0);
    if (global.document) {
        global.document.addEventListener('DOMContentLoaded', () => phase('document_dom_content_loaded', 'browser', 'ready', now() - startedAt), { once: true });
    }
    global.addEventListener('load', () => phase('document_load', 'browser', 'ready', now() - startedAt), { once: true });
    global.addEventListener('online', () => internet(true, 'browser'));
    global.addEventListener('offline', () => internet(false, 'browser'));
    global.addEventListener('sisweb:firebase-connection', (event) => {
        rtdb(Boolean(event && event.detail && event.detail.connected), 'firebase_event');
    });
})(window);
