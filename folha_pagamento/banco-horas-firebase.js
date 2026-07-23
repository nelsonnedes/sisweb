/**
 * // [BH] Camada Firebase (CRUD) do Banco de Horas via FirebaseConnectionManager
 */

window.BHFirebase = window.BHFirebase || {};

function mgr() {
	return (window.getFirebaseManager && window.getFirebaseManager()) || window.firebaseManager || null;
}

function parseLocalDateFlexible(value) {
	if (!value) return null;
	if (value instanceof Date) {
		return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
	}
	const s = String(value).trim();
	const num = Number(s);
	if (Number.isFinite(num) && /^\d+$/.test(s)) {
		const ms = s.length <= 10 ? num * 1000 : num;
		const d = new Date(ms);
		if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
	}
	const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 0, 0, 0, 0);
	const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
	if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]), 0, 0, 0, 0);
	return null;
}

const BH_LANCAMENTOS_BATCH_CACHE_TTL_MS = 30 * 1000;
let bhLancamentosBatchCache = {
	timestamp: 0,
	data: null
};

function bhNormalizeIds(funcIds = []) {
	const source = Array.isArray(funcIds) ? funcIds : [funcIds];
	return Array.from(new Set(source
		.map(id => String(id || '').trim())
		.filter(Boolean)));
}

function bhMapToArray(data) {
	if (Array.isArray(data)) {
		return data
			.map((value, index) => ({ id: (value && value.id) || String(index), ...(value || {}) }))
			.filter(Boolean);
	}
	return Object.entries(data || {}).map(([id, value]) => ({ id, ...(value || {}) }));
}

function bhFilterAndSortLancamentos(list = [], { inicioISO, fimISO } = {}) {
	const arr = Array.isArray(list) ? list : [];
	const start = inicioISO ? parseLocalDateFlexible(inicioISO) : null;
	const endBase = fimISO ? parseLocalDateFlexible(fimISO) : null;
	const end = endBase ? new Date(endBase.getTime() + 24 * 60 * 60 * 1000 - 1) : null;
	return arr.filter(lancamento => {
		const d = parseLocalDateFlexible(lancamento.data || lancamento.createdAt);
		if (!d) return false;
		const okIni = start ? start <= d : true;
		const okFim = end ? d <= end : true;
		return okIni && okFim;
	}).sort((a, b) => (parseLocalDateFlexible(a.data) || 0) - (parseLocalDateFlexible(b.data) || 0));
}

function bhInvalidateLancamentosBatchCache() {
	bhLancamentosBatchCache = { timestamp: 0, data: null };
}

async function bhLoadAllLancamentos(m, { fresh } = {}) {
	const now = Date.now();
	if (!fresh && bhLancamentosBatchCache.data && (now - bhLancamentosBatchCache.timestamp) < BH_LANCAMENTOS_BATCH_CACHE_TTL_MS) {
		return bhLancamentosBatchCache.data;
	}
	const data = await m.loadData('folha/bancoHoras/lancamentos', {
		useCache: fresh ? false : true,
		debounceMs: 0,
		skipLocalStorage: true
	});
	const normalized = (data && typeof data === 'object') ? data : {};
	bhLancamentosBatchCache = { timestamp: now, data: normalized };
	return normalized;
}

async function bhRunLimited(items, limit, worker) {
	const queue = Array.isArray(items) ? items.slice() : [];
	const size = Math.max(1, Number(limit || 1));
	const workers = Array.from({ length: Math.min(size, queue.length) }, async () => {
		while (queue.length > 0) {
			const item = queue.shift();
			await worker(item);
		}
	});
	await Promise.allSettled(workers);
}

// Utilitário: recalcular e persistir saldo global a partir de todos os lançamentos
async function bhRecalcAndPersistSaldo(funcId) {
    try {
        const m = mgr();
        if (!m || !funcId) return false;
        const data = await m.loadData(`folha/bancoHoras/lancamentos/${funcId}`, { useCache: false });
        const arr = Object.values(data || {});
        const saldoMinutos = (arr || []).reduce((acc, l) => {
            const min = Number(((l && l.minutos) || 0));
            const comp = Math.max(0, Number(((l && l.compensado) || 0)));
            const efetivo = min >= 0 ? Math.max(0, min - comp) : min;
            return acc + efetivo;
        }, 0);
        const payload = { saldoMinutos, atualizadoEm: new Date().toISOString() };
        await m.saveData(`folha/bancoHoras/saldos/${funcId}`, payload, { requireAuth: false });
        return true;
    } catch {
        return false;
    }
}

// CONFIG
window.BHFirebase.bhGetConfig = async function bhGetConfig() {
	const m = mgr();
	if (!m) return window.BHConfig || {};
	return (await m.loadData('folha/bancoHoras/config', { useCache: true })) || (window.BHConfig || {});
};

window.BHFirebase.bhSaveConfig = async function bhSaveConfig(cfg) {
	const m = mgr();
	if (!m) return false;
    await m.saveData('folha/bancoHoras/config', { ...(window.BHConfig||{}), ...(cfg||{}) }, { requireAuth: false });
	return true;
};

// SALDO
window.BHFirebase.bhGetSaldo = async function bhGetSaldo(funcId, { fresh } = {}) {
    if (!funcId) return { saldoMinutos: 0 };
    const m = mgr();
    if (!m) return { saldoMinutos: 0 };
    const data = await m.loadData(`folha/bancoHoras/saldos/${funcId}`, { useCache: fresh ? false : true });
    return data || { saldoMinutos: 0 };
};

window.BHFirebase.bhSetSaldo = async function bhSetSaldo(funcId, saldoMinutos) {
	const m = mgr();
	if (!m || !funcId) return false;
	const payload = { saldoMinutos: Number(saldoMinutos)||0, atualizadoEm: new Date().toISOString() };
    await m.saveData(`folha/bancoHoras/saldos/${funcId}`, payload, { requireAuth: false });
	return true;
};

// LANÇAMENTOS
window.BHFirebase.bhListLancamentos = async function bhListLancamentos(funcId, { inicioISO, fimISO, fresh } = {}) {
	const m = mgr();
	if (!m || !funcId) return [];
	const data = await m.loadData(`folha/bancoHoras/lancamentos/${funcId}`, { useCache: fresh ? false : true, debounceMs: 0 });
	return bhFilterAndSortLancamentos(bhMapToArray(data), { inicioISO, fimISO });
};

window.BHFirebase.bhListLancamentosBatch = async function bhListLancamentosBatch(funcIds = [], { inicioISO, fimISO, fresh } = {}) {
	const m = mgr();
	if (!m) return {};
	const ids = bhNormalizeIds(funcIds);
	if (!ids.length) return {};
	let all = null;
	let loadedRoot = false;
	try {
		all = await bhLoadAllLancamentos(m, { fresh });
		loadedRoot = true;
	} catch {}
	const out = {};
	if (loadedRoot && all && typeof all === 'object') {
		for (const id of ids) {
			const data = all[id] || {};
			out[id] = bhFilterAndSortLancamentos(bhMapToArray(data), { inicioISO, fimISO });
		}
		return out;
	}
	await bhRunLimited(ids, 6, async (id) => {
		try {
			const list = await window.BHFirebase.bhListLancamentos(id, { inicioISO, fimISO, fresh });
			out[id] = list || [];
		} catch {
			out[id] = [];
		}
	});
	return out;
};

window.BHFirebase.bhAddLancamento = async function bhAddLancamento(funcId, lanc) {
	const m = mgr();
	if (!m || !funcId) return null;
	const id = 'bh_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
	const payload = {
		id,
		data: lanc.data || new Date().toISOString(),
		minutos: Number(lanc.minutos)||0,
		origem: lanc.origem || 'manual',
		observacao: lanc.observacao || '',
		venceEm: lanc.venceEm || null,
		compensado: Number(lanc.compensado||0)
	};
    await m.saveData(`folha/bancoHoras/lancamentos/${funcId}/${id}`, payload, { requireAuth: false });
    bhInvalidateLancamentosBatchCache();
    // recalc saldo global
    await bhRecalcAndPersistSaldo(funcId);
    return payload;
};

window.BHFirebase.bhUpdateLancamento = async function bhUpdateLancamento(funcId, id, lanc) {
	const m = mgr();
	if (!m || !funcId || !id) return false;
	const curr = await m.loadData(`folha/bancoHoras/lancamentos/${funcId}/${id}`, { useCache: true });
    await m.saveData(`folha/bancoHoras/lancamentos/${funcId}/${id}`, { ...(curr||{}), ...(lanc||{}) }, { requireAuth: false });
    bhInvalidateLancamentosBatchCache();
    await bhRecalcAndPersistSaldo(funcId);
    return true;
};

window.BHFirebase.bhDeleteLancamento = async function bhDeleteLancamento(funcId, id) {
	const m = mgr();
	if (!m || !funcId || !id) return false;
	const rawPath = `folha/bancoHoras/lancamentos/${funcId}/${id}`;
	if (typeof m.deleteData === 'function') {
		await m.deleteData(rawPath);
	} else {
		const resolvedPath = (typeof m.resolvePath === 'function')
			? m.resolvePath(rawPath)
			: (window.FolhaUtils && typeof window.FolhaUtils.resolveFirebasePath === 'function')
				? window.FolhaUtils.resolveFirebasePath(rawPath)
				: rawPath;
		const { ref, remove } = await import('../firebase-init.js');
		await remove(ref(m.database, resolvedPath));
	}
    bhInvalidateLancamentosBatchCache();
    await bhRecalcAndPersistSaldo(funcId);
    return true;
};

// Expor utilitário de recálculo no namespace
window.BHFirebase.bhRecalcSaldo = bhRecalcAndPersistSaldo;
window.BHFirebase.bhClearLancamentosBatchCache = bhInvalidateLancamentosBatchCache;

// ÍNDICE DE EXPIRAÇÕES (auxiliar para relatórios)
window.BHFirebase.bhListExpiracoes = async function bhListExpiracoes(anoMes) {
	const m = mgr();
	if (!m) return [];
    const data = await m.loadData(`folha/bancoHoras/expiracoes/${anoMes}`, { useCache: true });
    return ((data && data.itens) || []);
};

// Assinatura digital (base64) do acordo BH
window.BHFirebase.bhSaveAssinatura = async function bhSaveAssinatura(funcId, payload) {
	const m = mgr();
	if (!m || !funcId) return false;
	const now = new Date().toISOString();
    const data = { ...(payload||{}), timestamp: (((payload && payload.timestamp) || now)) };
    await m.saveData(`folha/bancoHoras/assinaturas/${funcId}`, data, { requireAuth: false });
	return true;
};

console.log('// [BH] banco-horas-firebase.js carregado');
