(function () {
    function nowIso() {
        return new Date().toISOString();
    }

    function toStr(v) {
        return String(v || '').trim();
    }

    function normalizeCliente(item, fallbackId) {
        const nome = toStr(item?.name || item?.nome);
        const estado = toStr(item?.state || item?.estado);
        const cidade = toStr(item?.city || item?.cidade);
        const telefone = toStr(item?.phone || item?.telefone);
        const endereco = toStr(item?.address || item?.endereco);
        const numero = toStr(item?.number || item?.numero);
        const bairro = toStr(item?.neighborhood || item?.bairro);
        const obs = toStr(item?.obs || item?.observacoes || item?.observations);
        const createdAt = item?.createdAt || item?.created || nowIso();
        const updatedAt = item?.updatedAt || item?.updated || nowIso();
        const id = toStr(item?.id || fallbackId || `CLI_${Date.now()}`);
        return {
            ...item,
            id,
            nome,
            name: nome,
            nomeCompleto: toStr(item?.nomeCompleto || nome),
            cnpj: toStr(item?.cnpj),
            estado,
            state: estado,
            cidade,
            city: cidade,
            telefone,
            phone: telefone,
            email: toStr(item?.email),
            endereco,
            address: endereco,
            numero,
            number: numero,
            bairro,
            neighborhood: bairro,
            obs,
            observacoes: obs,
            observations: obs,
            tipo: 'cliente',
            category: 'cliente',
            status: toStr(item?.status || 'ativo'),
            createdAt,
            updatedAt,
            created: createdAt,
            updated: updatedAt
        };
    }

    function normalizeFornecedor(item, fallbackId) {
        const nome = toStr(item?.name || item?.nome);
        const estado = toStr(item?.state || item?.estado);
        const cidade = toStr(item?.city || item?.cidade);
        const telefone = toStr(item?.phone || item?.telefone);
        const endereco = toStr(item?.address || item?.endereco);
        const obs = toStr(item?.obs || item?.observacoes || item?.observations);
        const createdAt = item?.createdAt || item?.created || nowIso();
        const updatedAt = item?.updatedAt || item?.updated || nowIso();
        const id = toStr(item?.id || fallbackId || `FOR_${Date.now()}`);
        const inscricao = toStr(item?.inscricaoEstadual || item?.stateRegistration);
        return {
            ...item,
            id,
            nome,
            name: nome,
            cnpj: toStr(item?.cnpj),
            inscricaoEstadual: inscricao,
            stateRegistration: inscricao,
            endereco,
            address: endereco,
            numero: toStr(item?.numero || item?.number),
            number: toStr(item?.number || item?.numero),
            bairro: toStr(item?.bairro || item?.neighborhood),
            neighborhood: toStr(item?.neighborhood || item?.bairro),
            estado,
            state: estado,
            cidade,
            city: cidade,
            telefone,
            phone: telefone,
            email: toStr(item?.email),
            observacoes: obs,
            observations: obs,
            obs,
            tipo: 'fornecedor',
            category: 'fornecedor',
            status: toStr(item?.status || 'ativo'),
            createdAt,
            updatedAt,
            created: createdAt,
            updated: updatedAt
        };
    }

    function qualityScore(entity) {
        const fields = [
            'name', 'cnpj', 'stateRegistration', 'phone', 'email', 'address',
            'number', 'neighborhood', 'city', 'state', 'obs'
        ];
        let score = 0;
        for (const f of fields) {
            if (toStr(entity?.[f])) score += 1;
        }
        const ts = Date.parse(entity?.updatedAt || entity?.updated || entity?.createdAt || entity?.created || '');
        if (!Number.isNaN(ts)) score += ts / 1e15;
        return score;
    }

    function toMap(data) {
        if (!data) return {};
        if (Array.isArray(data)) {
            const out = {};
            data.forEach((item, idx) => {
                const id = toStr(item?.id || idx);
                out[id] = item;
            });
            return out;
        }
        if (typeof data === 'object') return data;
        return {};
    }

    async function loadNode(firebaseService, nodePath) {
        const res = await firebaseService.loadFromFirebase(nodePath);
        if (res && typeof res === 'object' && 'success' in res) return res.success ? (res.data || {}) : {};
        return res || {};
    }

    async function saveEntity(firebaseService, nodePath, id, data) {
        if (typeof firebaseService.saveToFirebase === 'function') {
            return firebaseService.saveToFirebase(nodePath, String(id), data);
        }
        if (typeof firebaseService.saveData === 'function') {
            return firebaseService.saveData(`${nodePath}/${id}`, data);
        }
        throw new Error('Método de salvamento não disponível');
    }

    async function removeEntity(firebaseService, nodePath, key) {
        const full = `${nodePath}/${key}`;
        if (typeof firebaseService.removeFromFirebase === 'function') {
            return firebaseService.removeFromFirebase(full);
        }
        if (typeof firebaseService.deleteData === 'function') {
            return firebaseService.deleteData(full);
        }
        if (typeof firebaseService.deleteFromFirebase === 'function') {
            return firebaseService.deleteFromFirebase(full);
        }
        return { success: false, error: 'Método de remoção não disponível' };
    }

    async function migrateNode(nodePath, normalizeFn, options) {
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (!svc || typeof svc.loadFromFirebase !== 'function') {
            throw new Error('firebaseService indisponível');
        }
        const data = await loadNode(svc, nodePath);
        const map = toMap(data);
        const buckets = new Map();
        const originalKeys = Object.keys(map);
        for (const key of originalKeys) {
            const value = map[key];
            if (!value || typeof value !== 'object') continue;
            const normalized = normalizeFn(value, key);
            const canonicalId = toStr(normalized.id || key);
            if (!canonicalId) continue;
            if (!buckets.has(canonicalId)) buckets.set(canonicalId, []);
            buckets.get(canonicalId).push({ key, value: normalized });
        }

        const upserts = [];
        const deletes = [];
        const skipped = [];
        for (const [canonicalId, entries] of buckets.entries()) {
            const valid = entries.filter(e => toStr(e.value.name || e.value.nome));
            if (valid.length === 0) {
                skipped.push({ id: canonicalId, reason: 'sem_nome', keys: entries.map(e => e.key) });
                continue;
            }
            valid.sort((a, b) => qualityScore(b.value) - qualityScore(a.value));
            const chosen = valid[0];
            const chosenValue = normalizeFn(chosen.value, canonicalId);
            upserts.push({ id: canonicalId, data: chosenValue, sourceKey: chosen.key, duplicates: valid.slice(1).map(v => v.key) });

            for (const entry of entries) {
                const isChosenKey = String(entry.key) === String(canonicalId);
                if (!isChosenKey) deletes.push(entry.key);
            }
        }

        const report = {
            nodePath,
            totalOriginais: originalKeys.length,
            totalCanonicos: upserts.length,
            totalRemocoes: [...new Set(deletes)].length,
            totalIgnorados: skipped.length,
            amostraIgnorados: skipped.slice(0, 20)
        };

        if (!options.commit) return { ...report, commit: false };

        let saved = 0;
        let removed = 0;
        for (const entry of upserts) {
            const res = await saveEntity(svc, nodePath, entry.id, entry.data);
            if (res && (res.success === undefined || res.success === true)) saved += 1;
        }
        for (const key of [...new Set(deletes)]) {
            const res = await removeEntity(svc, nodePath, key);
            if (res && (res.success === undefined || res.success === true)) removed += 1;
        }
        return { ...report, commit: true, saved, removed };
    }

    async function migrateContactsSchema(options = {}) {
        const opts = {
            commit: false,
            migrateClients: true,
            migrateFornecedores: true,
            ...options
        };
        const output = {
            startedAt: nowIso(),
            options: opts,
            results: {}
        };

        if (opts.migrateClients) {
            output.results.clients = await migrateNode('clients', normalizeCliente, opts);
        }
        if (opts.migrateFornecedores) {
            output.results.fornecedores = await migrateNode('fornecedores', normalizeFornecedor, opts);
        }

        output.finishedAt = nowIso();
        return output;
    }

    window.migrateContactsSchema = migrateContactsSchema;
})();
