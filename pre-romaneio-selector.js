const PreRomaneioSelector = (function() {
    function normalizeTenant(value) {
        const v = value == null ? '' : String(value).trim();
        return v || null;
    }

    function resolveTenantId() {
        try {
            const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.getCurrentTenantId === 'function') {
                const t = svc.getCurrentTenantId();
                if (t) return normalizeTenant(t);
            }
            if (svc && typeof svc.getTenantId === 'function') {
                const t = svc.getTenantId();
                if (t) return normalizeTenant(t);
            }
        } catch (_) {}
        try {
            if (window.appTenantId) return normalizeTenant(window.appTenantId);
            const raw = localStorage.getItem('company_info');
            if (raw) {
                const obj = JSON.parse(raw);
                const id = obj && (obj.companyId || obj.id || obj.tenantId || obj.companyID);
                if (id) return normalizeTenant(id);
            }
        } catch (_) {}
        return null;
    }

    function getNamespacedKeys(base) {
        const keys = [];
        try {
            const b = String(base || '');
            if (!b) return keys;
            const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.getNamespacedPath === 'function') {
                const ns = svc.getNamespacedPath(b);
                if (ns) {
                    keys.push(ns);
                    return [...new Set(keys)];
                }
            }
            const tenant = resolveTenantId();
            if (tenant && !/^companies\//.test(b) && !/^users\//.test(b)) {
                keys.push(`companies/${tenant}/${b}`);
                return [...new Set(keys)];
            }
        } catch (_) {}
        return [...new Set(keys)];
    }

    function readLocalObject(base) {
        for (const key of getNamespacedKeys(base)) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (parsed) return parsed;
            } catch (_) {}
        }
        return null;
    }

    async function hydrateTenantContext() {
        let tenant = resolveTenantId();
        const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
        if (tenant) {
            try { if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(tenant); } catch (_) {}
            return tenant;
        }
        let user = null;
        try {
            if (svc && svc.authService && typeof svc.authService.getCurrentUser === 'function') {
                user = await svc.authService.getCurrentUser();
            }
            const auth = svc && svc.authService && typeof svc.authService.getAuth === 'function' ? svc.authService.getAuth() : null;
            if (!user) user = auth && auth.currentUser ? auth.currentUser : null;
            if (!user && auth && typeof auth.onAuthStateChanged === 'function') {
                user = await new Promise((resolve) => {
                    let done = false;
                    const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 1800);
                    try {
                        auth.onAuthStateChanged((u) => {
                            if (!done) {
                                done = true;
                                clearTimeout(timer);
                                resolve(u || null);
                            }
                        });
                    } catch (_) {
                        clearTimeout(timer);
                        resolve(null);
                    }
                });
            }
        } catch (_) {}
        if (!user || !user.uid) return null;
        let companyId = null;
        try {
            if (svc && typeof svc.loadData === 'function') {
                const profileRes = await svc.loadData(`users/${user.uid}`);
                const profile = profileRes && profileRes.success ? profileRes.data : profileRes;
                companyId = profile && (profile.companyId || profile.companyID || profile.tenantId) || null;
            } else if (svc && typeof svc.loadFromFirebase === 'function') {
                const profileRes = await svc.loadFromFirebase(`users/${user.uid}`);
                const profile = profileRes && profileRes.success ? profileRes.data : profileRes;
                companyId = profile && (profile.companyId || profile.companyID || profile.tenantId) || null;
            }
        } catch (_) {}
        if (!companyId) {
            try {
                if (typeof user.getIdTokenResult === 'function') {
                    const token = await user.getIdTokenResult(true);
                    companyId = token && token.claims && (token.claims.companyId || token.claims.companyID || token.claims.tenantId) || null;
                }
            } catch (_) {}
        }
        if (!companyId) {
            try {
                if (window.firebase && typeof window.firebase.database === 'function') {
                    const snap = await window.firebase.database().ref(`users/${user.uid}`).once('value');
                    const profile = snap && typeof snap.val === 'function' ? snap.val() : null;
                    companyId = profile && (profile.companyId || profile.companyID || profile.tenantId) || null;
                }
            } catch (_) {}
        }
        if (!companyId) return null;
        tenant = normalizeTenant(companyId);
        try { if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(tenant); } catch (_) {}
        try {
            window.appTenantId = tenant;
            const raw = localStorage.getItem('company_info');
            const prev = raw ? JSON.parse(raw) : {};
            const next = { ...prev, companyId: tenant, id: prev.id || tenant };
            localStorage.setItem('company_info', JSON.stringify(next));
            window.companyInfo = next;
        } catch (_) {}
        return tenant;
    }

    async function waitForTenantContext(totalMs = 8000) {
        const start = Date.now();
        let tenant = resolveTenantId();
        if (tenant) return tenant;
        while (!tenant && (Date.now() - start) < totalMs) {
            tenant = await hydrateTenantContext();
            if (tenant) break;
            await new Promise((r) => setTimeout(r, 250));
            tenant = resolveTenantId();
        }
        return tenant || null;
    }

    function toDataPayload(result) {
        if (result && typeof result === 'object' && 'success' in result && 'data' in result) {
            return result.data;
        }
        return result;
    }

    function hasRecords(data) {
        if (!data) return false;
        if (Array.isArray(data)) return data.length > 0;
        if (typeof data === 'object') return Object.keys(data).length > 0;
        return false;
    }

    function withTenantCompanyId(payload, tenant) {
        const t = normalizeTenant(tenant);
        if (!t || !payload) return payload;
        if (Array.isArray(payload)) {
            return payload.map(item => {
                if (!item || typeof item !== 'object') return item;
                if (item.companyId || item.companyID || item.tenantId) return item;
                return { ...item, companyId: t };
            });
        }
        if (typeof payload === 'object') {
            const out = {};
            Object.keys(payload).forEach((k) => {
                const item = payload[k];
                if (!item || typeof item !== 'object') {
                    out[k] = item;
                    return;
                }
                if (item.companyId || item.companyID || item.tenantId) {
                    out[k] = item;
                } else {
                    out[k] = { ...item, companyId: t };
                }
            });
            return out;
        }
        return payload;
    }

    function parseLocalJson(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }

    async function loadLegacyGlobalPreromaneios(tenant) {
        const targetTenant = normalizeTenant(tenant);
        const out = [];
        const pushAll = (data) => {
            if (!data) return;
            if (Array.isArray(data)) out.push(...data);
            else if (typeof data === 'object') out.push(...Object.values(data));
        };
        pushAll(parseLocalJson('preromaneios'));
        try {
            if (window.firebase && typeof window.firebase.database === 'function') {
                const snap = await window.firebase.database().ref('preromaneios').once('value');
                const payload = snap && typeof snap.val === 'function' ? snap.val() : null;
                pushAll(payload);
            }
        } catch (_) {}
        if (!targetTenant) return out;
        return out.filter((pr) => {
            const cid = pr && (pr.companyId || pr.companyID || pr.tenantId || (pr.empresa && (pr.empresa.id || pr.empresa.companyId)));
            if (!cid) return false;
            return normalizeTenant(cid) === targetTenant;
        });
    }

    async function carregarPreromaneios() {
        const tenant = await waitForTenantContext();
        if (!tenant) return null;
        try {
            if (window.firebase && typeof window.firebase.database === 'function') {
                const snap = await window.firebase.database().ref(`companies/${tenant}/preromaneios`).once('value');
                const directPayload = snap && typeof snap.val === 'function' ? snap.val() : null;
                if (hasRecords(directPayload)) return withTenantCompanyId(directPayload, tenant);
            }
        } catch (_) {}
        const loaders = [
            async () => window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function' ? await window.firebaseService.loadFromFirebase('preromaneios') : null,
            async () => window.FirebaseService && typeof window.FirebaseService.loadFromFirebase === 'function' ? await window.FirebaseService.loadFromFirebase('preromaneios') : null,
            async () => window.firebaseServiceTL && typeof window.firebaseServiceTL.loadData === 'function' ? await window.firebaseServiceTL.loadData('preromaneios') : null
        ];
        for (const fn of loaders) {
            try {
                const payload = toDataPayload(await fn());
                if (hasRecords(payload)) return withTenantCompanyId(payload, tenant);
            } catch (_) {}
        }
        const local = readLocalObject('preromaneios');
        if (hasRecords(local)) return withTenantCompanyId(local, tenant);
        const legacy = await loadLegacyGlobalPreromaneios(tenant);
        if (hasRecords(legacy)) return withTenantCompanyId(legacy, tenant);
        return null;
    }

    function normalizarLista(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data.filter(Boolean);
        if (typeof data === 'object') {
            return Object.keys(data).map(k => ({ id: k, ...data[k] })).filter(Boolean);
        }
        return [];
    }

    function extrairItens(pr) {
        if (!pr || typeof pr !== 'object') return [];
        const raw = pr.itens ?? pr.items ?? pr.romaneioItens ?? pr.romaneioItems ?? pr.toraItens ?? pr.toraItems;
        if (Array.isArray(raw)) return raw;
        if (raw && typeof raw === 'object') {
            const entries = Object.entries(raw);
            const numericLike = entries.every(([k]) => /^\d+$/.test(String(k)));
            if (numericLike) {
                return entries.sort((a, b) => Number(a[0]) - Number(b[0])).map(([, v]) => v);
            }
            return Object.values(raw);
        }
        return [];
    }

    function formatarData(d) {
        if (!d) return '';
        try {
            const dt = new Date(d);
            if (isNaN(dt.getTime())) return String(d);
            return dt.toLocaleDateString('pt-BR');
        } catch (_) {
            return String(d);
        }
    }

    function nomeCliente(pr) {
        return pr?.clienteNome || pr?.cliente?.nome || pr?.fornecedorNome || '';
    }

    function formatarMoeda(valor) {
        const n = Number(valor || 0);
        return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function volumePreRomaneio(pr) {
        const itens = extrairItens(pr);
        const total = Number(
            (pr?.totais && (pr.totais.volumeSerraria || pr.totais.volumeTotal || pr.totais.volume)) ||
            pr?.totalVolume ||
            pr?.volumeSerraria ||
            pr?.volumeTotal ||
            pr?.volume ||
            itens.reduce((acc, i) => acc + (parseFloat(i?.volumeSerraria || i?.volumeLiquido || i?.volumeTotal || i?.volume || 0) || 0), 0)
        ) || 0;
        return total;
    }

    function valorPreRomaneio(pr) {
        const itens = extrairItens(pr);
        const total = Number(
            (pr?.totais && (pr.totais.valorTotal || pr.totais.valor)) ||
            pr?.totalValor ||
            pr?.valorTotal ||
            pr?.valor ||
            itens.reduce((acc, i) => acc + (parseFloat(i?.valorTotal || i?.valor || i?.total || i?.precoTotal || 0) || 0), 0)
        ) || 0;
        return total;
    }

    function montarOpcao(pr) {
        const data = formatarData(pr?.data || pr?.updatedAt || pr?.updated || pr?.created || pr?.timestamp);
        const nome = nomeCliente(pr);
        const volume = volumePreRomaneio(pr);
        const valor = valorPreRomaneio(pr);
        const info = [data, nome, `${volume.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³`, formatarMoeda(valor)].filter(Boolean).join(' - ');
        return info || pr.id || 'Pré-Romaneio';
    }

    function normalizeTipo(tipo) {
        const raw = tipo == null ? '' : String(tipo).trim().toUpperCase();
        if (!raw) return '';
        if (raw === 'TORA' || raw === 'TORAS') return 'TORA';
        if (raw === 'TL' || raw === 'TODA LARGURA' || raw === 'TODA_LARGURA') return 'TL';
        if (raw === 'PCT' || raw === 'PACOTE' || raw === 'PACOTES') return 'PCT';
        if (raw === 'PES' || raw === 'PÉS' || raw === 'PE' || raw === 'PÉS') return 'PES';
        return raw;
    }

    function inferTipoFromItems(pr) {
        const itens = extrairItens(pr);
        if (!Array.isArray(itens) || itens.length === 0) return '';
        const byItemTipo = itens.map((it) => normalizeTipo(it && it.tipo)).find(Boolean);
        if (byItemTipo) return byItemTipo;
        const hasTora = itens.some((it) => it && (it.rodo != null || it.oco1 != null || it.oco2 != null || it.plaqueta != null || it.placa != null));
        if (hasTora) return 'TORA';
        const hasPct = itens.some((it) => it && (it.pecasPorPacote != null || it.pecas != null));
        if (hasPct) return 'PCT';
        const hasSerrado = itens.some((it) => it && (it.largura != null || it.espessura != null || it.comprimento != null));
        if (hasSerrado) return 'TL';
        return '';
    }

    async function init({ tipo, selectId, onLoadItems, onLoadMeta, buttonId, loadOnChange = true }) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const activeTenant = await waitForTenantContext();
        if (!activeTenant) {
            select.disabled = true;
            select.innerHTML = '<option value="">Aguardando empresa...</option>';
            if (!select.dataset.preRomaneioRetryBound) {
                select.dataset.preRomaneioRetryBound = '1';
                window.addEventListener('tenantContextReady', () => {
                    window.initPreRomaneioSelector({ tipo, selectId, onLoadItems, onLoadMeta, buttonId, loadOnChange });
                });
                window.addEventListener('firebaseReady', () => {
                    window.initPreRomaneioSelector({ tipo, selectId, onLoadItems, onLoadMeta, buttonId, loadOnChange });
                });
            }
            return;
        }
        select.disabled = true;
        select.innerHTML = '<option value="">Carregando...</option>';

        const raw = await carregarPreromaneios();
        const targetTipo = normalizeTipo(tipo);
        const lista = normalizarLista(raw).filter((pr) => {
            const companyId = pr && (pr.companyId || pr.companyID || pr.tenantId || (pr.empresa && (pr.empresa.id || pr.empresa.companyId)));
            if (companyId && normalizeTenant(companyId) !== normalizeTenant(activeTenant)) return false;
            const prTipo = normalizeTipo(pr && pr.tipo);
            if (prTipo) return prTipo === targetTipo;
            const inferred = inferTipoFromItems(pr);
            return inferred === targetTipo;
        });
        lista.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

        const map = {};
        lista.forEach(pr => {
            const id = pr.id || pr.key || pr.uid;
            if (!id) return;
            map[id] = { ...pr, id };
        });

        select.innerHTML = '<option value="">Selecione</option>' + Object.values(map).map(pr => `<option value="${pr.id}">${montarOpcao(pr)}</option>`).join('');
        select.disabled = false;

        const loadSelected = async function() {
            const id = select.value;
            if (!id || !map[id]) return false;
            const pr = map[id];
            const itens = extrairItens(pr);
            if (typeof onLoadItems === 'function') onLoadItems(itens, pr);
            if (typeof onLoadMeta === 'function') onLoadMeta(pr);
            return true;
        };
        
        if (loadOnChange) {
            select.onchange = loadSelected;
        } else {
            select.onchange = function() {
                const id = select.value;
                if (!id || !map[id]) return;
                const pr = map[id];
                if (typeof onLoadMeta === 'function') onLoadMeta(pr);
            };
        }

        if (buttonId) {
            const btn = document.getElementById(buttonId);
            if (btn) {
                btn.onclick = async function() {
                    const ok = await loadSelected();
                    if (!ok) {
                        if (window.Utils && typeof window.Utils.showToast === 'function') {
                            window.Utils.showToast('Selecione um Pré-Romaneio.', 'warning');
                        } else {
                            alert('Selecione um Pré-Romaneio.');
                        }
                    }
                };
            }
        }

        return { loadSelected };
    }

    return { init };
})();

window.initPreRomaneioSelector = function(config) {
    return PreRomaneioSelector.init(config);
};
