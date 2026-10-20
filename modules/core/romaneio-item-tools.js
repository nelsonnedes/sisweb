/* Filtros e seleção de itens de romaneio/pré-romaneio. */
(function (root) {
    'use strict';
    var seq = 0;

    function normalizeText(value) {
        return String(value == null ? '' : value)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function parseNumber(value) {
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        var s = String(value == null ? '' : value).trim().replace(/[^\d,.-]/g, '');
        if (!s) return null;
        if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
        var n = Number(s);
        return Number.isFinite(n) ? n : null;
    }

    function parseDimensoes(text) {
        var raw = String(text == null ? '' : text).trim();
        if (!raw) return { ok: true, values: [], raw: raw };
        if (/[x×]\s*$/i.test(raw)) return { ok: false, values: [], raw: raw };
        var parts = raw.split(/\s*[x×]\s*/i).filter(function (p) { return p !== ''; });
        if (parts.length < 1 || parts.length > 3) return { ok: false, values: [], raw: raw };
        var values = [];
        for (var i = 0; i < parts.length; i++) {
            var n = parseNumber(parts[i]);
            if (n === null || n <= 0) return { ok: false, values: [], raw: raw };
            values.push(n);
        }
        return { ok: true, values: values, raw: raw };
    }

    function fieldValue(item, field) {
        try {
            if (typeof field === 'function') return parseNumber(field(item));
            return parseNumber(item && item[field]);
        } catch (_) { return null; }
    }

    function matchDimensoes(item, values, fields, tolerance) {
        if (!values || !values.length) return true;
        if (!Array.isArray(fields) || values.length > fields.length) return false;
        var tol = tolerance == null ? 0.005 : Number(tolerance);
        for (var i = 0; i < values.length; i++) {
            var actual = fieldValue(item, fields[i]);
            if (actual === null || Math.abs(actual - values[i]) > tol) return false;
        }
        return true;
    }

    function matchEspecie(item, query, fields) {
        var q = normalizeText(query);
        if (!q) return true;
        var keys = Array.isArray(fields) && fields.length ? fields : ['especie', 'nome', 'descricao'];
        for (var i = 0; i < keys.length; i++) {
            var value = item && item[keys[i]];
            if (value && typeof value === 'object') value = value.nome || value.name || '';
            if (normalizeText(value).indexOf(q) >= 0) return true;
        }
        return false;
    }

    function ensureItemKey(item) {
        if (!item || typeof item !== 'object') return '';
        var direct = item.id || item.firebaseKey || item.key || item.timestamp;
        if (direct != null && String(direct).trim()) return String(direct);
        if (!item.__romaneioItemKey) {
            try {
                Object.defineProperty(item, '__romaneioItemKey', {
                    value: 'it_' + (++seq),
                    enumerable: false,
                    configurable: true
                });
            } catch (_) { item.__romaneioItemKey = 'it_' + (++seq); }
        }
        return String(item.__romaneioItemKey);
    }

    root.SiswebRomaneioItens = {
        normalizeText: normalizeText,
        parseNumber: parseNumber,
        parseDimensoes: parseDimensoes,
        matchDimensoes: matchDimensoes,
        matchEspecie: matchEspecie,
        ensureItemKey: ensureItemKey
    };
})(typeof window !== 'undefined' ? window : globalThis);
