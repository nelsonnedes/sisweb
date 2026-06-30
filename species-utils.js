(function(global) {
    'use strict';

    const CANONICAL_COLLECTION = 'especies';
    const COLLECTION_ALIASES = [CANONICAL_COLLECTION];
    const LEGACY_COLLECTION_ALIASES = ['species', 'especiesPct', 'data/species'];
    const WRITE_EXCLUDED_FIELDS = new Set([
        'key',
        'firebaseKey',
        'nome',
        'name',
        'nomeComum',
        'commonName',
        'description',
        'descricao',
        'decription',
        'desc',
        'scientificName',
        'scientific',
        'nomeCientífico'
    ]);

    function normalizeNameKey(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getDisplayName(specie) {
        if (!specie) return '';
        return String(
            specie.especie ||
            specie.nome ||
            specie.name ||
            specie.nomeComum ||
            specie.commonName ||
            specie.nomeCientifico ||
            specie.scientificName ||
            ''
        ).trim();
    }

    function getScientificName(specie) {
        if (!specie) return '';
        return String(
            specie.nomeCientifico ||
            specie['nomeCientífico'] ||
            specie.scientificName ||
            specie.scientific ||
            specie.descricao ||
            specie.description ||
            specie.decription ||
            specie.desc ||
            ''
        ).trim();
    }

    function normalizeRecord(specie, index = 0) {
        const source = specie && typeof specie === 'object' ? specie : {};
        const displayName = getDisplayName(source) || 'Nome não informado';
        const scientificName = getScientificName(source);
        const id = source.firebaseKey || source.key || source.id || `specie_${index}`;

        return {
            ...source,
            id,
            especie: displayName,
            nome: displayName,
            name: displayName,
            nomeComum: source.nomeComum || source.commonName || source.nome || source.name || displayName,
            commonName: source.commonName || source.nomeComum || source.nome || source.name || displayName,
            nomeCientifico: scientificName,
            scientific: scientificName,
            scientificName: scientificName,
            ativo: source.ativo !== false,
            createdAt: source.createdAt || source.created || '',
            updatedAt: source.updatedAt || source.updated || ''
        };
    }

    function toCanonicalRecord(specie, index = 0, options = {}) {
        const source = specie && typeof specie === 'object' ? specie : {};
        const displayName = getDisplayName(source) || '';
        const scientificName = getScientificName(source);
        const id = options.id || source.firebaseKey || source.key || source.id || `specie_${index}`;
        const now = options.now || new Date().toISOString();
        const out = {};

        Object.keys(source).forEach((key) => {
            if (key.startsWith('__') || WRITE_EXCLUDED_FIELDS.has(key)) return;
            const value = source[key];
            if (value !== undefined) out[key] = value;
        });

        out.id = id;
        out.especie = displayName;
        out.nomeCientifico = scientificName;
        out.ativo = source.ativo !== false;
        out.createdAt = source.createdAt || source.created || now;
        out.updatedAt = options.updatedAt || source.updatedAt || source.updated || now;

        return out;
    }

    function toCanonicalMap(rawData) {
        if (!rawData) return {};
        if (Array.isArray(rawData)) {
            return rawData.reduce((acc, item, index) => {
                const value = item && typeof item === 'object' ? item : {};
                const key = String(index);
                const normalized = toCanonicalRecord({
                    ...value,
                    id: key,
                    key,
                    firebaseKey: key,
                    originalId: value.id || value.key || key
                }, index, { id: key });
                acc[normalized.id] = normalized;
                return acc;
            }, {});
        }
        return Object.keys(rawData || {}).reduce((acc, key, index) => {
            const value = rawData[key] && typeof rawData[key] === 'object' ? rawData[key] : {};
            const normalized = toCanonicalRecord({
                ...value,
                id: key,
                key,
                firebaseKey: key,
                originalId: value.id || value.key || key
            }, index, { id: key });
            acc[key] = normalized;
            return acc;
        }, {});
    }

    function normalizeList(rawData) {
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
        const parseRecordTime = (item) => {
            const updated = item && item.updatedAt;
            if (typeof updated === 'number') return updated;
            if (typeof updated === 'string') {
                const parsed = Date.parse(updated);
                if (!Number.isNaN(parsed)) return parsed;
            }
            const created = item && item.createdAt;
            if (typeof created === 'number') return created;
            if (typeof created === 'string') {
                const parsed = Date.parse(created);
                if (!Number.isNaN(parsed)) return parsed;
            }
            const numericId = parseFloat((item && (item.originalId || item.id)) || '');
            const keyedRecordBias = item && String(item.id || '') === String(item.originalId || '') ? 0.5 : 0;
            return Number.isNaN(numericId) ? keyedRecordBias : numericId + keyedRecordBias;
        };
        return list
            .filter(item => item && typeof item === 'object')
            .map((item, index) => normalizeRecord(item, index))
            .sort((a, b) => parseRecordTime(b) - parseRecordTime(a))
            .filter((item) => {
                const key = normalizeNameKey(getDisplayName(item));
                if (!key) return false;
                const id = String(item.firebaseKey || item.key || item.id || item.originalId || '');
                const dedupeKey = key || id;
                if (seen.has(dedupeKey)) return false;
                seen.add(dedupeKey);
                return true;
            });
    }

    function isSpeciesCollectionKey(key) {
        const clean = String(key || '').replace(/^\/+|\/+$/g, '');
        if (!clean) return false;
        const first = clean.split('/')[0];
        if (clean === CANONICAL_COLLECTION || first === CANONICAL_COLLECTION) return true;
        if (clean === 'data/species' || clean.startsWith('data/species/')) return true;
        return LEGACY_COLLECTION_ALIASES.includes(clean) || LEGACY_COLLECTION_ALIASES.includes(first);
    }

    function canonicalizePath(path) {
        const clean = String(path || '').replace(/^\/+/, '');
        if (!clean) return clean;
        const parts = clean.split('/').filter(Boolean);
        if (parts.length === 0) return clean;
        if (parts[0] === 'data' && parts[1] === 'species') {
            return [CANONICAL_COLLECTION, ...parts.slice(2)].join('/');
        }
        if (['species', 'especies', 'especiesPct'].includes(parts[0])) {
            return [CANONICAL_COLLECTION, ...parts.slice(1)].join('/');
        }
        return clean;
    }

    function getPathCandidates(path) {
        const clean = String(path || '').replace(/^\/+/, '');
        const canonical = canonicalizePath(clean);
        return canonical ? [canonical] : [];
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    global.SiswebSpecies = {
        canonicalCollection: CANONICAL_COLLECTION,
        collectionAliases: COLLECTION_ALIASES.slice(),
        legacyCollectionAliases: LEGACY_COLLECTION_ALIASES.slice(),
        normalizeNameKey,
        getDisplayName,
        getScientificName,
        normalizeRecord,
        normalizeList,
        toCanonicalRecord,
        toCanonicalMap,
        isSpeciesCollectionKey,
        canonicalizePath,
        getPathCandidates,
        escapeHtml
    };
})(window);
