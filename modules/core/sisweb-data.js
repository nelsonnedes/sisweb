/* modules/core/sisweb-data.js
 * Namespace canônico de acesso a dados — substituto do `window.getData` /
 * `window.saveData` disputado por ~20 módulos legados (último <script>
 * carregado vencia, com semânticas de retorno incompatíveis).
 *
 * Contrato estável:
 * - get(key, opts) -> Promise<{ success: boolean, data, source: string }>
 * - save(path, key, data) -> Promise<{ success: boolean, source: string }>
 *
 * Delegação por capacidade (nunca por global disputado):
 * 1. firebaseService.loadFromFirebase / saveToFirebase (3 args) / saveData 2 args
 * 2. databaseAdapter (load/save)
 * 3. localStorage namespaced (leitura) — nunca bare keys legadas
 *
 * Uso inicial: migração strangler dos consumidores de window.getData.
 * Fase A4 (warn): modules/core/legacy-deprecation.js observa os globais
 * legados sem alterar comportamento — remoção só após soak + migração total.
 */
(function (global) {
    'use strict';

    function svc() {
        return global.firebaseService || global.firebaseServiceTL || global.FirebaseService || null;
    }

    function adapter() {
        return global.databaseAdapter || null;
    }

    function namespacedPath(key) {
        var service = svc();
        try {
            if (service && typeof service.getNamespacedPath === 'function') {
                var ns = service.getNamespacedPath(key);
                if (ns) return ns;
            }
        } catch (_) {}
        return String(key || '');
    }

    function readLocal(namespaced) {
        try {
            var raw = global.localStorage ? global.localStorage.getItem(namespaced) : null;
            if (raw === null || raw === undefined) return undefined;
            try { return JSON.parse(raw); } catch (_) { return raw; }
        } catch (_) {
            return undefined;
        }
    }

    function wrap(data, source, success) {
        return {
            success: success === undefined ? data !== null && data !== undefined : success,
            data: data === undefined ? null : data,
            source: source
        };
    }

    async function get(key, opts) {
        var options = opts || {};
        var path = String(key || '');
        if (!path) return { success: false, data: null, source: 'invalid-key' };

        var service = svc();
        if (service && typeof service.loadFromFirebase === 'function') {
            try {
                var res = await service.loadFromFirebase(path, { forceRefresh: options.force === true });
                if (res && typeof res === 'object' && 'success' in res) {
                    return {
                        success: Boolean(res.success),
                        data: res.data === undefined ? null : res.data,
                        source: res.source || 'firebase-service'
                    };
                }
                return wrap(res === undefined ? null : res, 'firebase-service');
            } catch (e) {
                if (options.force) throw e;
            }
        }

        var db = adapter();
        if (db && typeof db.load === 'function') {
            try {
                return wrap(await db.load(path), 'database-adapter');
            } catch (_) {}
        }
        if (db && typeof db.getData === 'function') {
            try {
                return wrap(await db.getData(path), 'database-adapter');
            } catch (_) {}
        }

        var local = readLocal(namespacedPath(path));
        if (local !== undefined) return wrap(local, 'localStorage');

        return { success: false, data: null, source: 'unavailable' };
    }

    async function save(path, key, data) {
        var collection = String(path || '');
        var id = key === null || key === undefined ? '' : String(key).trim();
        if (!collection) throw new Error('Coleção inválida para salvamento');
        var service = svc();
        if (service && typeof service.saveToFirebase === 'function') {
            var res = await service.saveToFirebase(collection, id || null, data === undefined ? null : data);
            return { success: Boolean(res && res.success), source: 'firebase-service' };
        }
        if (service && typeof service.saveData === 'function') {
            var full = id ? collection + '/' + id : collection;
            var res2 = await service.saveData(full, data === undefined ? null : data);
            return { success: Boolean(res2 && res2.success), source: 'firebase-service' };
        }
        var db = adapter();
        if (db && typeof db.save === 'function') {
            await db.save(collection, id, data);
            return { success: true, source: 'database-adapter' };
        }
        throw new Error('Serviço de salvamento não disponível');
    }

    global.SiswebData = {
        get: get,
        save: save
    };
})(window);
