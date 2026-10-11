/* SisWeb Municípios IBGE — serviço único (Fase A, 2026-10-11).
 * Script clássico (sem ESM). Cadeia: cache localStorage (TTL 30 dias)
 * → API oficial IBGE → snapshot embarcado (data/municipios-ibge.json).
 * API:
 *   MunicipiosIBGE.listar(uf) -> Promise<[{id, nome}]> (ordenado pt-BR)
 *   MunicipiosIBGE.resolverCodigo(uf, nome) -> Promise<string> (7 dígitos ou '')
 *   MunicipiosIBGE.limparCache() -> void
 * Normalização acento-insensível em todas as comparações.
 */
(function initMunicipiosIBGE() {
    'use strict';
    if (typeof window === 'undefined') return;
    if (window.MunicipiosIBGE && typeof window.MunicipiosIBGE.listar === 'function') return;

    var CACHE_PREFIX = 'sisweb_ibge_mun_';
    var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
    var SNAPSHOT_URLS = ['data/municipios-ibge.json', '../data/municipios-ibge.json'];
    var snapshotPromise = null;

    function norm(s) {
        return String(s == null ? '' : s).trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    function lerCache(uf) {
        try {
            const raw = localStorage.getItem(CACHE_PREFIX + uf);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (!obj || !Array.isArray(obj.cidades) || !obj.ts) return null;
            if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
            return obj.cidades;
        } catch (_) { return null; }
    }

    function gravarCache(uf, cidades) {
        try {
            localStorage.setItem(CACHE_PREFIX + uf, JSON.stringify({ ts: Date.now(), cidades }));
        } catch (_) {}
    }

    async function daApi(uf) {
        const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
        if (!res.ok) throw new Error('IBGE HTTP ' + res.status);
        const arr = await res.json();
        return arr
            .map((c) => ({ id: Number(c.id), nome: String(c.nome) }))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }

    function doSnapshot(uf) {
        if (!snapshotPromise) {
            snapshotPromise = (async () => {
                let ultimoErro = null;
                for (const url of SNAPSHOT_URLS) {
                    try {
                        const res = await fetch(url);
                        if (!res.ok) continue;
                        return await res.json();
                    } catch (e) { ultimoErro = e; }
                }
                throw ultimoErro || new Error('snapshot indisponível');
            })();
        }
        return snapshotPromise.then((all) => {
            const lista = all && all[uf];
            if (!Array.isArray(lista)) throw new Error('UF ausente no snapshot');
            return lista.map((c) => ({ id: Number(c.id), nome: String(c.nome) }));
        });
    }

    async function listar(uf) {
        uf = String(uf || '').trim().toUpperCase();
        if (!uf) return [];
        const emCache = lerCache(uf);
        if (emCache) return emCache;
        try {
            const cidades = await daApi(uf);
            gravarCache(uf, cidades);
            return cidades;
        } catch (_) {}
        try {
            const cidades = await doSnapshot(uf);
            gravarCache(uf, cidades);
            return cidades;
        } catch (_) {}
        return [];
    }

    async function resolverCodigo(uf, nome) {
        uf = String(uf || '').trim().toUpperCase();
        if (!uf || !String(nome || '').trim()) return '';
        const alvo = norm(nome);
        const cidades = await listar(uf);
        const achada = cidades.find((c) => norm(c.nome) === alvo);
        return achada ? String(achada.id).padStart(7, '0') : '';
    }

    function limparCache() {
        try {
            const remover = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.indexOf(CACHE_PREFIX) === 0) remover.push(k);
            }
            remover.forEach((k) => localStorage.removeItem(k));
        } catch (_) {}
        snapshotPromise = null;
    }

    window.MunicipiosIBGE = { listar, resolverCodigo, limparCache };
})();
