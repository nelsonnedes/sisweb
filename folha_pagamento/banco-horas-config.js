/**
 * // [BH] Configuração do Banco de Horas
 * - Mantém parâmetros padronizados e base legal parametrizável (CLT 59/59-A/59-B)
 * - Persistência em RTDB via Firebase Manager (folha/bancoHoras/config)
 */

// Export global no window
window.BHConfig = {
	jornadaSemanalHoras: 44,
	diasUteisSemana: 5,
	horasMensaisContrato: 220,
	maxHEPorDia: 2, // limite CLT
	toleranciaMinutos: 10,
	janelaCompensacaoMeses: 6, // acordo individual; 12 para coletivo
	adicionalDiaUtil: 0.5, // 50%
	adicionalDomFeriado: 1.0, // 100%
	feriados: [],
	considerarQuinzena: true,
	compensarAntesDePagar: true,
	artigosCLT: {
		art59: "Art. 59 da CLT",
		art59A: "Art. 59-A da CLT",
		art59B: "Art. 59-B da CLT"
	},
	referenciasSindicais: {
		sindicato: "SITMING - São Miguel do Guamá/PA",
		cctVigencia: ""
	}
};

// [BH] helpers internos
function bhGetManager() {
	return (window.getFirebaseManager && window.getFirebaseManager()) || window.firebaseManager || null;
}

// [BH] carregar config do RTDB
window.bhLoadConfig = async function bhLoadConfig() {
	try {
		const manager = bhGetManager();
		if (!manager) return window.BHConfig;
		const cfg = await manager.loadData('folha/bancoHoras/config', { useCache: true });
		if (cfg && typeof cfg === 'object') {
			window.BHConfig = { ...window.BHConfig, ...cfg };
			// Autopreencher vigência da CCT a partir dos lançamentos existentes (menor data e maior venceEm)
			if (!window.BHConfig.referenciasSindicais.cctVigencia) {
				try {
					const funcionarios = (((window.folhaSystem && window.folhaSystem.funcionarios) || []).filter(f=>f.ativo!==false));
					let menorData = null; let maiorVence = null;
					const getFuncionarioKeys = (f) => {
						if (!f) return [];
						const cpf = (f.cpf ? String(f.cpf).replace(/\D/g, '') : '');
						const keys = [];
						[f.id, f.funcionarioId, f.key, f.$key, cpf, f.matricula, f.codigo].forEach(v => {
							const s = String(v || '').trim();
							if (s) keys.push(s);
						});
						return Array.from(new Set(keys));
					};
					const ids = Array.from(new Set(funcionarios.flatMap(f => getFuncionarioKeys(f))));
					let batch = null;
					if (window.BHFirebase && typeof window.BHFirebase.bhListLancamentosBatch === 'function') {
						batch = await window.BHFirebase.bhListLancamentosBatch(ids, { fresh: false });
					}
					if (!batch && window.BHFirebase && typeof window.BHFirebase.bhListLancamentos === 'function') {
						batch = {};
						const tasks = ids.map(async (id) => {
							try {
								const lista = await window.BHFirebase.bhListLancamentos(id);
								batch[String(id)] = lista || [];
							} catch {
								batch[String(id)] = [];
							}
						});
						await Promise.allSettled(tasks);
					}
					if (!batch) batch = {};
					for (const f of funcionarios) {
						const keys = getFuncionarioKeys(f);
						let lista = [];
						for (const k of keys) {
							const l = (batch && batch[String(k)]) || [];
							if (Array.isArray(l) && l.length > 0) { lista = l; break; }
						}
						if (Array.isArray(lista) && lista.length > 0) {
							for (const l of lista) {
								const d = l.data ? String(l.data).slice(0,10) : null;
								const v = l.venceEm ? String(l.venceEm).slice(0,10) : null;
								if (d && (!menorData || d < menorData)) menorData = d;
								if (v && (!maiorVence || v > maiorVence)) maiorVence = v;
							}
						}
					}
					if (menorData && maiorVence) {
						window.BHConfig.referenciasSindicais.cctVigencia = `${menorData} a ${maiorVence}`;
					}
				} catch {}
			}
			console.log('// [BH] Config carregada do RTDB');
		}
		return window.BHConfig;
	} catch (e) {
		console.warn('// [BH] Falha ao carregar config, usando defaults:', e.message);
		return window.BHConfig;
	}
};

// [BH] salvar config no RTDB
window.bhSaveConfig = async function bhSaveConfig(newCfg) {
	try {
		const manager = bhGetManager();
		if (!manager) throw new Error('Firebase Manager indisponível');
		const merged = { ...window.BHConfig, ...(newCfg || {}) };
		await manager.saveData('folha/bancoHoras/config', merged);
		window.BHConfig = merged;
		console.log('// [BH] Config salva no RTDB');
		return true;
	} catch (e) {
		console.error('// [BH] Erro ao salvar config:', e);
		return false;
	}
};

// Inicialização leve: tenta carregar remoto sem bloquear
document.addEventListener('DOMContentLoaded', () => {
	setTimeout(() => { window.bhLoadConfig && window.bhLoadConfig(); }, 800);
});

console.log('// [BH] banco-horas-config.js carregado');
