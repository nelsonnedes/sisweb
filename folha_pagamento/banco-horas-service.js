/**
 * // [BH] Serviço de regras de negócio do Banco de Horas
 * - Cálculos de saldo, tolerância, compensações FIFO e conversões em pagamento
 */

// Namespace global para evitar conflitos
window.BHService = window.BHService || {};

function toNumber(n, def = 0) {
	const v = Number(n);
	return Number.isFinite(v) ? v : def;
}

window.BHService.bhParseLocalDate = function bhParseLocalDate(iso) {
	if (!iso) return null;
	const s = String(iso).slice(0,10);
	const [y,m,d] = s.split('-').map(Number);
	if (!y || !m || !d) return null;
	return new Date(y, m-1, d, 0, 0, 0, 0);
};

window.BHService.bhFormatLocalISO = function bhFormatLocalISO(dateObj) {
	if (!(dateObj instanceof Date)) return '';
	const y = dateObj.getFullYear();
	const m = String(dateObj.getMonth()+1).padStart(2,'0');
	const d = String(dateObj.getDate()).padStart(2,'0');
	return `${y}-${m}-${d}`;
};

window.BHService.bhNormalizeISODate = function bhNormalizeISODate(raw) {
	if (!raw) return '';
	if (raw instanceof Date) return window.BHService.bhFormatLocalISO(raw);
	const s = String(raw).trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
	const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
	if (m) return `${m[3]}-${m[2]}-${m[1]}`;
	return '';
};

window.BHService.bhGetJornadaSemanalHoras = function bhGetJornadaSemanalHoras(func = {}, cfg = window.BHConfig) {
	const v = (func && (func.jornadaSemanalHoras ?? func.horasSemanais ?? func.cargaHorariaSemanal ?? func.jornadaSemanal ?? func.horasSemanaisContrato)) ?? (cfg && cfg.jornadaSemanalHoras);
	return Math.max(1, toNumber(v, 44));
};

window.BHService.bhGetDiasUteisSemana = function bhGetDiasUteisSemana(func = {}, cfg = window.BHConfig) {
	const v = (func && (func.diasUteisSemana ?? func.diasTrabalhoSemana ?? func.diasUteis)) ?? (cfg && cfg.diasUteisSemana);
	return Math.min(7, Math.max(1, toNumber(v, 5)));
};

window.BHService.bhGetMinutosDiaUtil = function bhGetMinutosDiaUtil(func = {}, cfg = window.BHConfig) {
	const minDia = func && (func.minutosDiaUtil ?? func.minutosDiarios);
	if (Number.isFinite(Number(minDia)) && Number(minDia) > 0) return Math.round(Number(minDia));
	const hDia = func && (func.horasDia ?? func.cargaHorariaDiaria);
	if (Number.isFinite(Number(hDia)) && Number(hDia) > 0) return Math.round(Number(hDia) * 60);
	const jornada = window.BHService.bhGetJornadaSemanalHoras(func, cfg);
	const diasUteis = window.BHService.bhGetDiasUteisSemana(func, cfg);
	return Math.round((jornada * 60) / diasUteis);
};

window.BHService.bhGetFeriadosSet = function bhGetFeriadosSet(func = {}, cfg = window.BHConfig, extras = []) {
	const base = []
		.concat((cfg && (cfg.feriados || cfg.feriadosLista || cfg.feriadosNacionais)) || [])
		.concat((func && (func.feriados || func.feriadosLista)) || [])
		.concat(extras || []);
	const set = new Set();
	base.forEach(v => {
		const iso = window.BHService.bhNormalizeISODate(v);
		if (iso) set.add(iso);
	});
	return set;
};

window.BHService.bhIsDiaUtil = function bhIsDiaUtil(dateObj, diasUteisSemana = 5, feriadosSet = null) {
	if (!(dateObj instanceof Date)) return false;
	const wd = dateObj.getDay();
	if (diasUteisSemana >= 7) {
	} else if (diasUteisSemana === 6) {
		if (wd === 0) return false;
	} else {
		if (wd === 0 || wd === 6) return false;
	}
	const iso = window.BHService.bhFormatLocalISO(dateObj);
	if (feriadosSet && feriadosSet.has(iso)) return false;
	return true;
};

window.BHService.bhContarDiasUteisPeriodo = function bhContarDiasUteisPeriodo(iniISO, fimISO, { func = null, cfg = window.BHConfig, feriados = null } = {}) {
	const di = window.BHService.bhParseLocalDate(iniISO);
	let df = window.BHService.bhParseLocalDate(fimISO);
	if (!di) return 0;
	if (!df || df < di) df = di;
	const diasUteisSemana = window.BHService.bhGetDiasUteisSemana(func, cfg);
	const feriadosSet = feriados || window.BHService.bhGetFeriadosSet(func, cfg);
	let c = 0;
	for (let d = new Date(di.getTime()); d <= df; d.setDate(d.getDate()+1)) {
		if (window.BHService.bhIsDiaUtil(d, diasUteisSemana, feriadosSet)) c++;
	}
	return c;
};

window.BHService.bhCalcularMinutosUteisPeriodo = function bhCalcularMinutosUteisPeriodo(iniISO, fimISO, { func = null, cfg = window.BHConfig, feriados = null } = {}) {
	const diasUteis = window.BHService.bhContarDiasUteisPeriodo(iniISO, fimISO, { func, cfg, feriados });
	const minutosDia = window.BHService.bhGetMinutosDiaUtil(func, cfg);
	return Math.round(diasUteis * minutosDia);
};

// Minutos contratuais/dia (aproximação simples)
window.BHService.bhMinutosContratuaisDoDia = function bhMinutosContratuaisDoDia({ jornadaSemanalHoras = 44, diasUteis = 5 }) {
	const horasDia = jornadaSemanalHoras / diasUteis;
	return Math.round(horasDia * 60);
};

window.BHService.bhAplicarTolerancia = function bhAplicarTolerancia(minutos, toleranciaMin) {
	const m = toNumber(minutos);
	const tol = Math.abs(toNumber(toleranciaMin));
	if (Math.abs(m) <= tol) return 0;
	return m;
};

// Cálculo de minutos do dia a partir de entradas/saídas
window.BHService.bhCalcularMinutosDia = function bhCalcularMinutosDia({ entradasSaidas = [], config = window.BHConfig }) {
	// entradasSaidas: [{in: '08:00', out: '12:00'}, {in:'13:00', out:'17:48'}]
	const soma = entradasSaidas.reduce((acc, par) => {
		const [hi, mi] = String(par.in || '00:00').split(':').map(Number);
		const [ho, mo] = String(par.out || '00:00').split(':').map(Number);
		const min = ((ho * 60 + mo) - (hi * 60 + mi));
		return acc + (Number.isFinite(min) ? min : 0);
	}, 0);
    const contratuais = window.BHService.bhMinutosContratuaisDoDia({ jornadaSemanalHoras: ((config && config.jornadaSemanalHoras) || 44), diasUteis: 5 });
    return window.BHService.bhAplicarTolerancia(soma - contratuais, ((config && config.toleranciaMinutos) || 0));
};

// Acumular saldo
window.BHService.bhAcumularSaldo = function bhAcumularSaldo(saldoAnteriorMinutos, minutosDia) {
	return toNumber(saldoAnteriorMinutos) + toNumber(minutosDia);
};

// FIFO de compensação: consome primeiros créditos positivos
window.BHService.bhDistribuirCompensacaoFIFO = function bhDistribuirCompensacaoFIFO(lancamentos = [], minutosParaCompensar = 0) {
	let restante = Math.max(0, toNumber(minutosParaCompensar));
	const saida = [];
	for (const lanc of lancamentos.sort((a,b)=> new Date(a.data)-new Date(b.data))) {
		if (restante <= 0) break;
		const credit = Math.max(0, toNumber(lanc.minutos));
		if (credit <= 0) continue;
		const consumir = Math.min(credit - Math.max(0, toNumber(lanc.compensado||0)), restante);
		if (consumir > 0) {
			saida.push({ id: lanc.id, data: lanc.data, consumir });
			restante -= consumir;
		}
	}
	return { distribuicao: saida, restante };
};

window.BHService.bhValorHora = function bhValorHora(salarioBase, horasMensaisContrato = 220) {
	const base = Math.max(0, toNumber(salarioBase));
	const horas = Math.max(1, toNumber(horasMensaisContrato, 220));
	return base / horas;
};

window.BHService.bhConverterMinutosEmPagamento = function bhConverterMinutosEmPagamento({ minutos = 0, valorHora = 0, adicional = 0 }) {
	const horas = Math.max(0, toNumber(minutos)) / 60;
	const vHora = Math.max(0, toNumber(valorHora));
	const add = Math.max(0, toNumber(adicional));
	return horas * vHora * (1 + add);
};

// Detectar expirados até dataCorteISO
window.BHService.bhDetectarExpiracoes = function bhDetectarExpiracoes(lancamentos = [], dataCorteISO) {
	const corte = new Date(dataCorteISO || new Date().toISOString());
	return lancamentos.filter(l => l.venceEm && new Date(l.venceEm) < corte);
};

console.log('// [BH] banco-horas-service.js carregado');


