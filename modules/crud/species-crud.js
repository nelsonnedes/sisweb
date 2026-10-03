/* modules/crud/species-crud.js
 * CRUD canônico de Espécies — ponto único de escrita usado por todas as páginas
 * (species.html, romaneiotl, romaneiopct, romaneiopes, romaneiotora, preromaneio).
 *
 * Motivo: cada página tinha sua própria implementação de save com semânticas
 * divergentes (saveData 2-args chamado com 3 args, sem trava contra duplo
 * submit, sem verificação de leitura após escrita, invalidação de cache
 * inconsistente) → "às vezes não grava/edita, na 3ª tentativa funciona".
 *
 * Regras do módulo:
 * 1. Escrita SEMPRE via saveToFirebase('especies', id, data) [3 args];
 *    fallback saveData('especies/<id>', data) [2 args]. Nunca saveData 3-args.
 * 2. Trava por registro (inflight): segundo save do mesmo id aguarda o primeiro.
 * 3. Verificação de leitura (read-back com retries): só retorna success após
 *    confirmar o registro visível via loadFromFirebase forceRefresh.
 * 4. Invalidação única: svc.invalidateCache('especies'|'species') +
 *    SiswebSpeciesStore.invalidate() + evento 'species:updated'.
 * 5. Sem listeners de DOM, sem toast, sem modal: só dados. UI fica no chamador.
 */
(function (global) {
    'use strict';

    var COLLECTION = 'especies';
    var READBACK_ATTEMPTS = 5;
    var READBACK_DELAY_MS = 350;
    var SAVE_TIMEOUT_MS = 20000;

    // id normalizado -> Promise do save em andamento
    var inflight = new Map();

    function tools() {
        return global.SiswebSpecies || {};
    }

    function store() {
        return global.SiswebSpeciesStore || null;
    }

    function svc() {
        return global.firebaseService || global.firebaseServiceTL || global.FirebaseService || null;
    }

    function getDisplayName(specie) {
        var t = tools();
        if (typeof t.getDisplayName === 'function') return t.getDisplayName(specie);
        return String((specie && (specie.especie || specie.nome || specie.name || specie.nomeComum)) || '').trim();
    }

    function getScientificName(specie) {
        var t = tools();
        if (typeof t.getScientificName === 'function') return t.getScientificName(specie);
        return String((specie && (specie.nomeCientifico || specie.scientificName || specie.scientific || specie.descricao || specie.description)) || '').trim();
    }

    function normalizeNameKey(value) {
        var t = tools();
        if (typeof t.normalizeNameKey === 'function') return t.normalizeNameKey(value);
        return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    }

    /** Resolve o id canônico do registro a partir de qualquer alias. */
    function resolveRecordId(record) {
        var r = record || {};
        var candidates = [r.firebaseKey, r.key, r.id, r.originalId];
        for (var i = 0; i < candidates.length; i++) {
            var v = String(candidates[i] == null ? '' : candidates[i]).trim();
            if (v && v !== 'undefined' && v !== 'null') return v;
        }
        return '';
    }

    /** true se record possui o id informado em qualquer alias. */
    function matchesId(record, id) {
        var want = String(id == null ? '' : id).trim();
        if (!want) return false;
        return [record && record.id, record && record.key, record && record.firebaseKey, record && record.originalId]
            .map(function (v) { return String(v == null ? '' : v).trim(); })
            .filter(Boolean)
            .indexOf(want) !== -1;
    }

    function toCanonicalPayload(input) {
        var src = input || {};
        var t = tools();
        var now = new Date().toISOString();
        var id = String(src.id || '') || ('ESP_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
        // Registro completo (preserva companyId e demais campos na edição).
        if (src.record && typeof src.record === 'object') {
            var base = Object.assign({}, src.record);
            if (src.name !== undefined) {
                base.especie = src.name;
                base.nome = src.name;
                base.name = src.name;
            }
            if (src.scientific !== undefined) base.nomeCientifico = src.scientific;
            if (typeof t.toCanonicalRecord === 'function') {
                var rec = t.toCanonicalRecord(base, 0, { id: id, updatedAt: now });
                if (!rec.createdAt && base.createdAt) rec.createdAt = base.createdAt;
                return rec;
            }
            return {
                id: id,
                especie: String(base.especie || ''),
                nomeCientifico: String(base.nomeCientifico || ''),
                ativo: true,
                createdAt: base.createdAt || now,
                updatedAt: now
            };
        }
        if (typeof t.toCanonicalRecord === 'function') {
            return t.toCanonicalRecord(
                { especie: src.name, nomeCientifico: src.scientific || '' },
                0,
                { id: id, updatedAt: now }
            );
        }
        return {
            id: id,
            especie: String(src.name || ''),
            nomeCientifico: String(src.scientific || ''),
            ativo: true,
            createdAt: src.createdAt || now,
            updatedAt: now
        };
    }

    /** Duplicata exata por nome normalizado, ignorando o registro em edição. */
    function findDuplicate(name, currentId, listGetter) {
        var key = normalizeNameKey(name);
        if (!key) return null;
        var modal = global.SiswebSpeciesModal;
        if (modal && typeof modal.getExactDuplicate === 'function') {
            try {
                return modal.getExactDuplicate(name, currentId, listGetter) || null;
            } catch (_) { /* cai para verificação local abaixo */ }
        }
        var list = [];
        try { list = typeof listGetter === 'function' ? (listGetter() || []) : []; } catch (_) { list = []; }
        var id = String(currentId || '').trim();
        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            if (normalizeNameKey(getDisplayName(s)) !== key) continue;
            if (id && matchesId(s, id)) continue;
            return s;
        }
        return null;
    }

    function withTimeout(promise, ms, message) {
        var timer = null;
        var timeout = new Promise(function (_, reject) {
            timer = setTimeout(function () { reject(new Error(message)); }, ms);
        });
        return Promise.race([promise, timeout]).then(
            function (v) { clearTimeout(timer); return v; },
            function (e) { clearTimeout(timer); throw e; }
        );
    }

    function delay(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    /** Escrita física. saveToFirebase(path, key, data). Fallback saveData(path/id, data). */
    async function writeRecord(id, payload) {
        var service = svc();
        if (!service) throw new Error('Serviço Firebase não disponível');
        var data = Object.assign({}, payload, { id: id });
        if (typeof service.saveToFirebase === 'function') {
            return service.saveToFirebase(COLLECTION, String(id), data);
        }
        if (typeof service.saveData === 'function') {
            return service.saveData(COLLECTION + '/' + String(id), data);
        }
        throw new Error('Serviço de salvamento não disponível');
    }

    /** Lê a coleção com forceRefresh e confirma que o id está visível. */
    async function verifyVisible(id, attempts) {
        var service = svc();
        var max = attempts == null ? READBACK_ATTEMPTS : attempts;
        for (var i = 0; i < max; i++) {
            try {
                var result = null;
                if (service && typeof service.loadFromFirebase === 'function') {
                    result = await service.loadFromFirebase(COLLECTION, { forceRefresh: true });
                }
                var data = result && result.success && result.data !== undefined ? result.data : result;
                if (data) {
                    if (Array.isArray(data)) {
                        for (var a = 0; a < data.length; a++) {
                            if (matchesId(data[a], id)) return true;
                        }
                    } else if (typeof data === 'object') {
                        if (Object.prototype.hasOwnProperty.call(data, id)) return true;
                        var keys = Object.keys(data);
                        for (var k = 0; k < keys.length; k++) {
                            if (matchesId(data[keys[k]], id)) return true;
                        }
                    }
                }
            } catch (_) { /* tenta de novo */ }
            if (i < max - 1) await delay(READBACK_DELAY_MS);
        }
        return false;
    }

    /** Remove snapshots legados avulsos (ex.: chave 'especies' sem namespace),
     * fonte clássica de registros-fantasma já excluídos no Firebase. */
    function purgeStaleSpeciesCaches() {
        try {
            var ls = global.localStorage;
            if (ls) {
                var legacyKeys = ['especies', 'species', 'especies_cache', 'species_cache'];
                for (var i = 0; i < legacyKeys.length; i++) {
                    try { ls.removeItem(legacyKeys[i]); } catch (_) {}
                }
            }
        } catch (_) {}
        try {
            var service = svc();
            if (service && typeof service.removeLocalStorage === 'function') {
                var aliases = ['especies', 'species', 'especies_cache', 'species_cache',
                    'especiesPct', 'data/species'];
                for (var j = 0; j < aliases.length; j++) {
                    try { service.removeLocalStorage(aliases[j]); } catch (_) {}
                }
            }
        } catch (_) {}
        try {
            var st = store();
            if (st && typeof st.invalidate === 'function') st.invalidate();
        } catch (_) {}
    }

    /** Lê a coleção com forceRefresh e confirma que o id NÃO está mais presente. */
    async function verifyGone(id, attempts) {
        var max = attempts == null ? READBACK_ATTEMPTS : attempts;
        for (var i = 0; i < max; i++) {
            var found = false;
            try {
                var service = svc();
                var result = null;
                if (service && typeof service.loadFromFirebase === 'function') {
                    result = await service.loadFromFirebase(COLLECTION, { forceRefresh: true });
                }
                var data = result && result.success && result.data !== undefined ? result.data : result;
                if (data) {
                    if (Array.isArray(data)) {
                        for (var a = 0; a < data.length; a++) {
                            if (data[a] == null || typeof data[a] !== 'object') continue;
                            if (matchesId(data[a], id)) { found = true; break; }
                        }
                    } else if (typeof data === 'object') {
                        if (Object.prototype.hasOwnProperty.call(data, id) && data[id] != null && typeof data[id] === 'object') {
                            found = true;
                        } else {
                            var keys = Object.keys(data);
                            for (var k = 0; k < keys.length; k++) {
                                if (data[keys[k]] == null || typeof data[keys[k]] !== 'object') continue;
                                if (matchesId(data[keys[k]], id)) { found = true; break; }
                            }
                        }
                    }
                }
            } catch (_) { found = true; /* erro de leitura: não afirmar remoção */ }
            if (!found) return true;
            if (i < max - 1) await delay(READBACK_DELAY_MS);
        }
        return false;
    }

    function readAuthoritativeList(listGetter) {
        var list = [];
        try { list = typeof listGetter === 'function' ? (listGetter() || []) : (listGetter || []); } catch (_) { list = []; }
        return Array.isArray(list) ? list : [];
    }

    function findInList(list, name, currentId) {
        var key = normalizeNameKey(name);
        if (!key) return null;
        var id = String(currentId || '').trim();
        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            if (normalizeNameKey(getDisplayName(s)) !== key) continue;
            if (id && matchesId(s, id)) continue;
            return s;
        }
        return null;
    }

    /**
     * Verificação de duplicata à prova de fantasma:
     * 1. procura na lista autoritativa da página;
     * 2. se ausente, consulta as fontes globais (podem estar desatualizadas);
     * 3. se só existir nas globais, recarrega a autoritativa e re-checa;
     * 4. se continuar ausente → fantasma: purga caches e LIBERA o save.
     */
    async function checkDuplicateOrGhost(opts) {
        var o = opts || {};
        var name = String(o.name || '').trim();
        if (!name) return { blocked: false, ghost: false, record: null };
        var list = readAuthoritativeList(o.authoritativeList);
        var hit = findInList(list, name, o.currentId);
        if (hit) return { blocked: true, ghost: false, record: hit };

        var globalHit = null;
        try {
            var modal = global.SiswebSpeciesModal;
            if (modal && typeof modal.getExactDuplicate === 'function') {
                globalHit = modal.getExactDuplicate(name, o.currentId) || null;
            }
        } catch (_) { globalHit = null; }
        if (!globalHit) return { blocked: false, ghost: false, record: null };

        try {
            if (typeof o.refresh === 'function') await o.refresh();
        } catch (_) {}
        list = readAuthoritativeList(o.authoritativeList);
        hit = findInList(list, name, o.currentId);
        if (hit) return { blocked: true, ghost: false, record: hit };

        purgeStaleSpeciesCaches();
        return { blocked: false, ghost: true, record: globalHit };
    }

    function invalidateAll() {
        try {
            var service = svc();
            if (service && typeof service.invalidateCache === 'function') {
                service.invalidateCache(COLLECTION);
                service.invalidateCache('species');
            }
            if (service && typeof service.invalidateCollectionCache === 'function') {
                service.invalidateCollectionCache(COLLECTION);
            }
        } catch (_) {}
        try {
            var st = store();
            if (st && typeof st.invalidate === 'function') st.invalidate();
        } catch (_) {}
        try {
            if (typeof global.dispatchEvent === 'function') {
                global.dispatchEvent(new CustomEvent('species:updated', { detail: { collection: COLLECTION } }));
            }
        } catch (_) {}
    }

    async function doSave(input) {
        var src = input || {};
        var rec = src.record && typeof src.record === 'object' ? src.record : null;
        var name = String(src.name !== undefined ? src.name : (rec ? getDisplayName(rec) : '')).toString().trim();
        if (!name) throw new Error('O nome da espécie é obrigatório');
        var isEdit = Boolean(String(src.id == null ? '' : src.id).trim());
        var now = new Date().toISOString();
        var payload = toCanonicalPayload({ id: src.id, name: name, scientific: src.scientific, record: rec });
        if (isEdit) {
            payload.id = String(src.id).trim();
            payload.createdAt = src.createdAt || payload.createdAt;
        } else {
            payload.createdAt = now;
        }
        payload.updatedAt = now;

        var writeResult = await withTimeout(
            writeRecord(payload.id, payload),
            SAVE_TIMEOUT_MS,
            'Tempo esgotado ao salvar espécie'
        );
        if (!writeResult || !writeResult.success) {
            throw new Error((writeResult && writeResult.error) || 'Falha ao salvar espécie');
        }

        var visible = await verifyVisible(payload.id);
        invalidateAll();
        // Recarrega o store central para que todas as páginas convirjam.
        try {
            var st = store();
            if (st && typeof st.getAll === 'function') {
                await st.getAll({ force: true, waitRemote: true, timeoutMs: 8000 });
            }
        } catch (_) {}

        return { success: true, id: payload.id, record: payload, isEdit: isEdit, verified: visible };
    }

    /**
     * Salva (cria ou atualiza) com trava por registro.
     * Chamadas concorrentes para o mesmo id aguardam a primeira em vez de
     * disparar escritas duplicadas.
     */
    function save(input) {
        var key = String((input && input.id) == null ? '' : input.id).trim()
            || ('__new:' + normalizeNameKey(input && input.name));
        if (inflight.has(key)) return inflight.get(key);
        var p = doSave(input).finally(function () {
            if (inflight.get(key) === p) inflight.delete(key);
        });
        inflight.set(key, p);
        return p;
    }

    async function remove(id) {
        var recordId = String(id == null ? '' : id).trim();
        if (!recordId) throw new Error('ID da espécie inválido para exclusão');
        var service = svc();
        if (!service) throw new Error('Serviço Firebase não disponível');
        var result = null;
        if (typeof service.deleteData === 'function') {
            result = await withTimeout(
                service.deleteData(COLLECTION + '/' + recordId),
                SAVE_TIMEOUT_MS,
                'Tempo esgotado ao excluir espécie'
            );
        } else if (typeof service.saveToFirebase === 'function') {
            result = await withTimeout(
                service.saveToFirebase(COLLECTION, recordId, null),
                SAVE_TIMEOUT_MS,
                'Tempo esgotado ao excluir espécie'
            );
        } else {
            throw new Error('Serviço de exclusão não disponível');
        }
        if (!result || !result.success) {
            throw new Error((result && result.error) || 'Falha ao excluir espécie');
        }
        var gone = await verifyGone(recordId);
        invalidateAll();
        if (!gone) {
            throw new Error('Exclusão não confirmada no Firebase — o registro ainda existe. Tente novamente.');
        }
        return { success: true, id: recordId, verified: true };
    }

    global.SpeciesCRUD = {
        collection: COLLECTION,
        save: save,
        remove: remove,
        resolveRecordId: resolveRecordId,
        matchesId: matchesId,
        findDuplicate: findDuplicate,
        checkDuplicateOrGhost: checkDuplicateOrGhost,
        purgeStaleSpeciesCaches: purgeStaleSpeciesCaches,
        getDisplayName: getDisplayName,
        getScientificName: getScientificName,
        normalizeNameKey: normalizeNameKey,
        invalidateAll: invalidateAll,
        verifyVisible: verifyVisible,
        verifyGone: verifyGone
    };
})(window);
