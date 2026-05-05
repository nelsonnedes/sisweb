/**
 * // [BH] Relatórios e Contrato/Acordo do Banco de Horas
 */

window.BHReports = window.BHReports || {};

function fmtNum(v, dec=2){
	return Number(v||0).toFixed(dec).replace('.', ',');
}
function fmtMin(m){
	const s = Number(m||0);
	const sign = s<0?'-':'';
	const abs = Math.abs(s);
	return `${sign}${Math.floor(abs/60)}h${String(abs%60).padStart(2,'0')}m`;
}

// Helpers de formatação (documentos e datas)
function maskCPF(cpf){
    const d = String(cpf||'').replace(/\D/g, '');
    if (d.length !== 11) return cpf || '';
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
function maskCNPJ(cnpj){
    const d = String(cnpj||'').replace(/\D/g, '');
    if (d.length !== 14) return cnpj || '';
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}
function fmtDateBR(iso){
    if (!iso) return '';
    const s = String(iso).slice(0,10);
    const [y,m,d] = s.split('-');
    return (y&&m&&d) ? `${d}/${m}/${y}` : s;
}
function fmtDateExtBR(iso){
    if (!iso) return '';
    const s = String(iso).slice(0,10);
    const [y,m,d] = s.split('-').map(n=>Number(n));
    if (!y||!m||!d) return fmtDateBR(iso);
    const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    return `${d} de ${meses[m-1]} de ${y}`;
}
function addMonthsISO(iso, months){
    if (!iso) return '';
    const s = String(iso).slice(0,10);
    const [y,m,d] = s.split('-').map(n=>Number(n));
    if (!y||!m||!d) return iso;
    const dt = new Date(y, m-1, d, 0,0,0,0);
    const targetMonth = dt.getMonth() + months;
    const day = dt.getDate();
    const tmp = new Date(dt.getFullYear(), targetMonth+1, 0); // último dia do mês destino
    const newDay = Math.min(day, tmp.getDate());
    const dd = new Date(dt.getFullYear(), targetMonth, newDay, 0,0,0,0);
    return dd.toISOString().slice(0,10);
}
function subDaysISO(iso, days){
    if (!iso) return '';
    const s = String(iso).slice(0,10);
    const [y,m,d] = s.split('-').map(n=>Number(n));
    if (!y||!m||!d) return iso;
    const dt = new Date(y, m-1, d, 0,0,0,0);
    dt.setDate(dt.getDate() - Math.max(0, Number(days)||0));
    return dt.toISOString().slice(0,10);
}

// [BH] Cabeçalho e CSS idênticos ao recibo da folha
window.BHReports.bhGetHeaderCSS = function bhGetHeaderCSS() {
	return `
        .header { display:flex; margin-bottom:20px; border-bottom:2px solid #333; padding-bottom:15px; align-items:flex-start; }
		.logo { width:120px; text-align:center; margin-right:20px; flex-shrink:0; }
		.logo img { max-width:100%; height:auto; max-height:100px; }
		.logo svg { width:80px; height:80px; }
		.company-info { flex:1; padding-left:15px; }
		.company-name { font-size:20px; font-weight:bold; margin-bottom:8px; color:#2c3e50; text-transform:uppercase; }
		.company-details { font-size:12px; margin-bottom:4px; color:#555; line-height:1.3; }
        .title { text-align:center; font-size:18px; font-weight:bold; margin:20px 0 10px 0; text-transform:uppercase; color:#fff; background:#1b4670; padding:8px 10px; border-radius:4px; }
        .table thead, thead { background:#0d2339 !important; color:#fff !important; }
        .table th, .table td { font-size:12px; }
        @media print {
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .title { background:#1b4670 !important; color:#fff !important; }
            .table thead, thead { background:#0d2339 !important; color:#fff !important; }
        }
	`;
};

window.BHReports.bhBuildHeaderHTML = function bhBuildHeaderHTML(empresa) {
	const logoHtml = (empresa.logo && String(empresa.logo).trim() !== '')
		? `<img src="${empresa.logo}" alt="Logo da Empresa" />`
		: `<svg viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"45\" fill=\"#2c3e50\" stroke=\"#34495e\" stroke-width=\"2\"/><text x=\"50\" y=\"60\" text-anchor=\"middle\" fill=\"white\" font-size=\"24\" font-weight=\"bold\">JN</text></svg>`;
	return `
		<div class=\"header\">
			<div class=\"logo\">${logoHtml}</div>
			<div class=\"company-info\">
				<div class=\"company-name\">${empresa.nome || empresa.name || ''}</div>
				<div class=\"company-details\">CNPJ: ${maskCNPJ(empresa.cnpj) || ''}</div>
				<div class=\"company-details\">${empresa.endereco || empresa.address || ''}</div>
				<div class=\"company-details\">${(empresa.cidade||empresa.city)||''} - ${(empresa.estado||empresa.state)||''}</div>
				<div class=\"company-details\">Fone: ${(empresa.telefone||empresa.phone)||''}</div>
				${empresa.email ? `<div class=\"company-details\">Email: ${empresa.email}</div>` : ''}
			</div>
		</div>
	`;
};

// Extrato individual simples por período
window.BHReports.bhGerarExtratoIndividual = async function bhGerarExtratoIndividual(funcionario, periodo) {
    const empresa = (window.getCompanyData && await window.getCompanyData()) || {};
    const headerCSS = window.BHReports.bhGetHeaderCSS();
    const headerHTML = window.BHReports.bhBuildHeaderHTML(empresa);
    const fmt = (iso) => { if(!iso) return '-'; const s=String(iso).slice(0,10); const [y,m,d]=s.split('-'); return (y&&m&&d)?`${d}/${m}/${y}`:s; };
    const conteudo = `
        <!DOCTYPE html><html><head>
        <meta charset="UTF-8"/>
        <title>Extrato de Banco de Horas</title>
        <style>${headerCSS}</style>
        </head><body>
        ${headerHTML}
        <div class="title">Extrato de Banco de Horas</div>
        <div style="font-size:13px; color:#333;">Funcionário: <strong>${(funcionario && funcionario.nome) || ''}</strong></div>
        <div style="font-size:12px; color:#555;">Período: ${fmt(periodo && periodo.inicio)} a ${fmt(periodo && periodo.fim)}</div>
        <div id="bh-extrato-tabela"></div>
        </body></html>
    `;
    return { html: conteudo };
};

window.BHReports.bhGerarEspelhoDiario = async function bhGerarEspelhoDiario(funcionario, periodo) {
    const empresa = (window.getCompanyData && await window.getCompanyData()) || {};
    const headerCSS = window.BHReports.bhGetHeaderCSS();
    const headerHTML = window.BHReports.bhBuildHeaderHTML(empresa);
    const fmt = (iso) => { if(!iso) return '-'; const s=String(iso).slice(0,10); const [y,m,d]=s.split('-'); return (y&&m&&d)?`${d}/${m}/${y}`:s; };
    const conteudo = `
        <!DOCTYPE html><html><head>
        <meta charset="UTF-8"/>
        <title>Espelho Diário (Banco de Horas)</title>
        <style>${headerCSS}</style>
        </head><body>
        ${headerHTML}
        <div class="title">Espelho Diário (Banco de Horas)</div>
        <div style="font-size:13px; color:#333;">Funcionário: <strong>${(funcionario && funcionario.nome) || ''}</strong></div>
        <div style="font-size:12px; color:#555;">Período: ${fmt(periodo && periodo.inicio)} a ${fmt(periodo && periodo.fim)}</div>
        <div id="bh-espelho-tabela"></div>
        </body></html>
    `;
    return { html: conteudo };
};

window.BHReports.bhRelatorioVencimentos = async function bhRelatorioVencimentos(funcionarioOuGeral, periodo) {
    const empresa = (window.getCompanyData && await window.getCompanyData()) || {};
    const headerCSS = window.BHReports.bhGetHeaderCSS();
    const headerHTML = window.BHReports.bhBuildHeaderHTML(empresa);
    const fmt = (iso) => { if(!iso) return '-'; const s=String(iso).slice(0,10); const [y,m,d]=s.split('-'); return (y&&m&&d)?`${d}/${m}/${y}`:s; };
    const alvo = (funcionarioOuGeral && funcionarioOuGeral.nome) ? funcionarioOuGeral.nome : 'Geral';
    const conteudo = `
        <!DOCTYPE html><html><head>
        <meta charset="UTF-8"/>
        <title>Vencimentos do Banco de Horas</title>
        <style>${headerCSS}</style>
        </head><body>
        ${headerHTML}
        <div class="title">Vencimentos do Banco de Horas</div>
        <div style="font-size:13px; color:#333;">Alvo: <strong>${alvo}</strong></div>
        <div style="font-size:12px; color:#555;">Período: ${fmt(periodo && periodo.inicio)} a ${fmt(periodo && periodo.fim)}</div>
        <div id="bh-vencimentos-tabela"></div>
        </body></html>
    `;
    return { html: conteudo };
};

// Contrato/Acordo com blocos de assinatura
window.BHReports.bhGerarContratoAdesao = async function bhGerarContratoAdesao(funcionario, opcoes = {}) {
    const cfg = window.BHConfig || {};
    const art59 = (cfg.artigosCLT && cfg.artigosCLT.art59) || 'Art. 59 da CLT';
    const art59A = (cfg.artigosCLT && cfg.artigosCLT.art59A) || 'Art. 59-A da CLT';
    const art59B = (cfg.artigosCLT && cfg.artigosCLT.art59B) || 'Art. 59-B da CLT';
    const empresa = (window.getCompanyData && await window.getCompanyData()) || {};

    const headerCSS = window.BHReports.bhGetHeaderCSS();
    const headerHTML = window.BHReports.bhBuildHeaderHTML(empresa);

    // Determinar vigência por funcionário, com fallbacks
    const fmtISO = (d) => (d ? String(d).slice(0,10) : '');
    const fmtBR = (iso) => { const s=String(iso||'').slice(0,10); const [y,m,d]=s.split('-'); return (y&&m&&d)?`${d}/${m}/${y}`:s; };
    // Tentar diferentes campos no cadastro do funcionário
    let vigIni = (funcionario && funcionario.bhVigenciaInicio) || (funcionario && funcionario.vigenciaInicio) || (funcionario && funcionario.dataInicio) || (funcionario && funcionario.periodoInicio) || (funcionario && funcionario.periodo && funcionario.periodo.inicio) || '';
    let vigFim = (funcionario && funcionario.bhVigenciaFim) || (funcionario && funcionario.vigenciaFim) || (funcionario && funcionario.dataFim) || (funcionario && funcionario.periodoFim) || (funcionario && funcionario.periodo && funcionario.periodo.fim) || '';

    // Preferir sempre o último lançamento do BH do funcionário como referência de vigência
    if (window.BHFirebase && typeof window.BHFirebase.bhListLancamentos === 'function' && (funcionario && funcionario.id)) {
        try {
            const todosLanc = await window.BHFirebase.bhListLancamentos(funcionario.id);
            if (Array.isArray(todosLanc) && todosLanc.length > 0) {
                const ultimo = todosLanc[todosLanc.length - 1]; // lista já vem ordenada por data asc
                const d = (ultimo && ultimo.data) ? String(ultimo.data).slice(0,10) : null;
                const v = (ultimo && ultimo.venceEm) ? String(ultimo.venceEm).slice(0,10) : null;
                if (d) vigIni = d; // início = data do último lançamento
                if (v || d) vigFim = v || d; // fim = venceEm do último (ou própria data se não houver)
            }
        } catch {}
    }

    // Fallback final: período selecionado na UI (mês atual)
    if (!vigIni || !vigFim) {
        try {
            const mesSel = (document.getElementById('mesAno') && document.getElementById('mesAno').value) || new Date().toISOString().slice(0,7);
            const [ano, mes] = mesSel.split('-').map(Number);
            const di = new Date(ano, mes-1, 1).toISOString().slice(0,10);
            const df = new Date(ano, mes, 0).toISOString().slice(0,10);
            if (!vigIni) vigIni = di;
            if (!vigFim) vigFim = df;
        } catch {}
    }
    const inicioISO = fmtISO(vigIni);
    const fimISO = fmtISO(vigFim);
    const mesesVig = Number(cfg.janelaCompensacaoMeses||6);
    const fimCalculadoISO = subDaysISO(addMonthsISO(inicioISO, mesesVig), 1);
    const vigencia = `${fmtBR(inicioISO)} a ${fmtBR(fimCalculadoISO)}`;

    // Dados do funcionário/empresa para exibição profissional
    const funcCpf = maskCPF(funcionario && funcionario.cpf);
    const funcCargo = (funcionario && funcionario.cargo) || '';
    const funcCtps = (funcionario && funcionario.ctps) || (funcionario && funcionario.CTPS) || '';
    const funcPis = (funcionario && funcionario.pis) || '';
    const jornadaSemanal = Number((funcionario && funcionario.jornadaSemanalHoras) || cfg.jornadaSemanalHoras || 44);
    const empresaNome = empresa.nome || empresa.name || '';
    const empresaCnpj = maskCNPJ(empresa.cnpj) || '';
    const localCidade = (empresa.cidade || empresa.city || '') + (empresa.estado || empresa.state ? ' - ' + (empresa.estado || empresa.state) : '');

    // Cálculos do período escolhido (dias úteis, jornada estimada, saldo)
    try {
        // Dias úteis no intervalo inclusivo (parse local YYYY-MM-DD para evitar fuso/UTC)
        const parseLocal = (iso) => {
            if (!iso) return null;
            const s = String(iso).slice(0,10);
            const [y,m,d] = s.split('-').map(n=>Number(n));
            if (!y || !m || !d) return null;
            return new Date(y, m-1, d, 0, 0, 0, 0);
        };
        const contarDiasUteis = (ini, fim) => {
            const dIni = parseLocal(ini);
            const dFim = parseLocal(fim);
            if (!dIni || !dFim) return 0;
            let c = 0;
            for (let d = new Date(dIni.getTime()); d <= dFim; d.setDate(d.getDate()+1)) {
                const wd = d.getDay(); if (wd>=1 && wd<=5) c++;
            }
            return c;
        };
        const diasUteis = (function(){
            if (window.BHService && typeof window.BHService.bhContarDiasUteisPeriodo === 'function') {
                return window.BHService.bhContarDiasUteisPeriodo(inicioISO, fimISO, { func: funcionario, cfg });
            }
            return inicioISO && fimISO ? contarDiasUteis(inicioISO, fimISO) : 0;
        })();
        const diasCalendario = (function(){
            const di = parseLocal(inicioISO);
            const df = parseLocal(fimISO);
            if (!di || !df) return 0;
            const MS_PER_DAY = 24*60*60*1000;
            return Math.floor((df - di)/MS_PER_DAY) + 1; // inclusivo
        })();
        const minutosDiaUtil = (function(){
            if (window.BHService && typeof window.BHService.bhGetMinutosDiaUtil === 'function') {
                return window.BHService.bhGetMinutosDiaUtil(funcionario, cfg);
            }
            return Math.round(((cfg.jornadaSemanalHoras||44) / 5) * 60);
        })();
        const totalMin = diasUteis * minutosDiaUtil;
        const horasUteisTotalFmt = (function(min){ const s=Number(min||0); const h=Math.floor(s/60); const mm=String(s%60).padStart(2,'0'); return `${h}h${mm}min`; })(totalMin);

        // Saldo no período (negativo/positivo)
        let saldoPeriodoMin = 0;
        try {
            const keys = [];
            const cpf = (funcionario && funcionario.cpf) ? String(funcionario.cpf).replace(/\D/g, '') : '';
            [funcionario && funcionario.id, funcionario && funcionario.funcionarioId, funcionario && funcionario.key, funcionario && funcionario.$key, cpf, funcionario && funcionario.matricula, funcionario && funcionario.codigo].forEach(v => {
                const s = String(v || '').trim();
                if (s) keys.push(s);
            });
            const unique = Array.from(new Set(keys));
            let lista = [];
            if (window.BHFirebase && typeof window.BHFirebase.bhListLancamentos === 'function') {
                for (const k of unique) {
                    const tmp = await window.BHFirebase.bhListLancamentos(k, { inicioISO, fimISO });
                    if (tmp && tmp.length) { lista = tmp; break; }
                }
                if (!lista.length && unique.length) {
                    lista = await window.BHFirebase.bhListLancamentos(unique[0], { inicioISO, fimISO });
                }
            }
            const efetivo = (l) => {
                const min = Number((l && l.minutos) || 0);
                const comp = Math.max(0, Number((l && l.compensado) || 0));
                return min >= 0 ? Math.max(0, min - comp) : min;
            };
            saldoPeriodoMin = (lista||[]).reduce((acc,l)=>acc + efetivo(l), 0);
        } catch {}
        const saldoPeriodoFmt = (function(min){ const s=Number(min||0); const sign=s<0?'-':''; const abs=Math.abs(s); return `${sign}${Math.floor(abs/60)}h${String(abs%60).padStart(2,'0')}min`; })(saldoPeriodoMin);
        const saldoPeriodoAbsFmt = (function(min){ const s=Math.abs(Number(min||0)); return `${Math.floor(s/60)}h${String(s%60).padStart(2,'0')}min`; })(saldoPeriodoMin);
        const saldoTitulo = saldoPeriodoMin < 0 ? 'Saldo negativo de horas no período de referência:' : 'Saldo de horas no período de referência:';

        opcoes._saldoPeriodo = saldoPeriodoFmt;
        opcoes._saldoPeriodoAbs = saldoPeriodoAbsFmt;
        opcoes._saldoTitulo = saldoTitulo;
        opcoes._diasUteis = diasUteis;
        opcoes._diasCalendario = diasCalendario;
        opcoes._horasUteisTotal = horasUteisTotalFmt;
    } catch {}

    const body = `
        ${headerHTML}
        <div class="title">Acordo Individual de Banco de Horas – Compensação de Horas Negativas</div>
        <div style="font-size:13px; color:#333; line-height:1.6;">
            <p style="margin:0 0 8px 0; color:#0d2339;"><em>Fundamento legal: ${art59}${art59A ? ", "+art59A : ''}${art59B ? ", "+art59B : ''} (Lei 13.467/2017 e alterações), além da CCT aplicável.</em></p>

            <p>Pelo presente instrumento, ${empresaNome}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${empresaCnpj||'______________'}, com sede em ${empresa.endereco||empresa.address||'__________'}, ${localCidade||'__________'}, doravante denominada Empregadora.</p>
            <p>E, ${(funcionario && funcionario.nome)||'______________________________'}, portador(a) da CTPS nº ${funcCtps||'______________'}${funcCpf? (', CPF '+funcCpf):''}, com contrato individual de trabalho firmado em ${(funcionario && funcionario.dataAdmissional) ? fmtDateBR(funcionario.dataAdmissional) : fmtDateBR(new Date().toISOString())}, doravante denominado(a) Empregado(a).</p>

            <hr style="border:none; border-top:1px solid #ddd; margin:10px 0 14px;"/>

            <h3 style="color:#1b4670;">CLÁUSULA PRIMEIRA</h3>
            <p>A duração diária do trabalho poderá ser acrescida em número não excedente a duas horas, das quais o total que exceder a jornada normal de trabalho, e o total de horas que não forem trabalhadas por qualquer motivo de acordo com a Lei, serão pontuadas no banco de horas.</p>

            <h3 style="color:#1b4670;">CLÁUSULA SEGUNDA</h3>
            <p>O excesso de horas em um dia será compensado pela correspondente diminuição em outro dia ou por folga concedida de acordo com a quantidade de horas positivadas, de maneira que a compensação se dê dentro do período máximo de <strong>06 (seis) meses</strong>, contados a partir da data inicial cadastrada em BH (${fmtDateBR(inicioISO)}), observadas as disposições legais do Art. 59, § 5º, CLT.</p>

            <h3 style="color:#1b4670;">CLÁUSULA TERCEIRA</h3>
            <p>A carga horária respeitará os limites permitidos por Lei, que são <strong>44 (quarenta e quatro) horas de trabalho semanais</strong>, acrescidas de <strong>11 (onze) horas</strong>, destinadas a quitação do banco de horas.</p>
            <p><em>Parágrafo primeiro:</em> A jornada diária normal de trabalho do empregado acordante poderá ser prorrogada, até o limite máximo de <strong>10 (dez) horas diárias</strong> de segunda a sexta e <strong>05 (cinco) horas</strong> aos sábados, com o objetivo de trabalhar as horas não trabalhadas ou compensar as horas que terão folga em outros dias.</p>

            <h3 style="color:#1b4670;">CLÁUSULA QUARTA</h3>
            <p>As horas laboradas que ultrapassem a jornada normal de trabalho ou as horas folgadas, serão levadas ao Banco de Horas, com base em <strong>01 (uma) hora de trabalho por 01 (uma) hora compensada</strong> ou <strong>01 (uma) hora compensada por 01 (uma) hora de trabalho</strong>.</p>

            <h3 style="color:#1b4670;">CLÁUSULA QUINTA</h3>
            <p>Durante o período do Banco de Horas, todas as horas trabalhadas a mais ou a menos, terão que ser lançadas na planilha.</p>

            <h3 style="color:#1b4670;">CLÁUSULA SEXTA</h3>
            <p>O Banco de Horas e as planilhas devem ficar à disposição do empregado quando o mesmo precisar verificar qualquer informação.</p>

            <h3 style="color:#1b4670;">CLÁUSULA SÉTIMA</h3>
            <p>O presente acordo tem validade pelo período de <strong>06 (seis) meses</strong>, iniciando em <strong>${fmtDateExtBR(inicioISO)}</strong> e finalizando em <strong>${fmtDateExtBR(subDaysISO(addMonthsISO(inicioISO, 6),1))}</strong>.</p>

            <h3 style="color:#1b4670;">CLÁUSULA OITAVA</h3>
            <p>Em caso de rescisão do contrato de trabalho, se o empregado tiver saldo positivo no banco de horas, estas devem ser pagas como horas extras, considerando o valor da remuneração na data da rescisão.</p>

            <div style="margin-top:10px; font-size:13px; color:#333;">
                <div><strong>${opcoes._saldoTitulo || 'Saldo de horas no período de referência:'}</strong> ${(opcoes._saldoTitulo||'').includes('negativo') ? (opcoes._saldoPeriodoAbs || '0h00min') : (opcoes._saldoPeriodo || '0h00min')}</div>
                <div><strong>Dias corridos:</strong> ${opcoes._diasCalendario || '-'} | <strong>Dias úteis:</strong> ${opcoes._diasUteis || '-'} | <strong>Jornada útil estimada:</strong> ${opcoes._horasUteisTotal || '-'}</div>
            </div>

            <div style="margin-top:14px; font-size:12px; color:#555;">
                <i>Recomenda-se revisão jurídica periódica deste instrumento conforme alterações legais e convencionais.</i>
            </div>
        </div>

        <div style="margin-top:16px; font-size:12px; color:#444;">
            <div><strong>${localCidade || '_______'}, ${fmtDateExtBR(new Date().toISOString())}</strong></div>
        </div>

        <div style="margin-top:14px; font-size:13px; color:#333;">
            <p>E, por estarem, assim, de comum acordo, as partes assinam o presente instrumento em duas vias de igual teor.</p>
        </div>

        <div style="margin-top:20px;">
            <h3 style="color:#1b4670;">Assinaturas</h3>
            <div style="display:flex; gap:20px;">
                <div style="flex:1; text-align:center;">
                    <div style="height:120px; border:1px dashed #999; margin-bottom:6px;">Assinatura Digital (sistema)</div>
                    <div style="border-top:1px solid #000; margin-top:24px;">Empregado(a): ${(funcionario && funcionario.nome)||''}${funcCpf ? ' – CPF: '+funcCpf : ''}</div>
                </div>
                <div style="flex:1; text-align:center;">
                    <div style="height:120px; border:1px dashed #999; margin-bottom:6px;">Assinatura Digital (sistema)</div>
                    <div style="border-top:1px solid #000; margin-top:24px;">Empregador(a): ${empresaNome}${empresaCnpj ? ' – CNPJ: '+empresaCnpj : ''}</div>
                </div>
            </div>
        </div>
    `;

    const html = `<!DOCTYPE html>
    <html lang="pt-BR">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Acordo de Banco de Horas</title>
        <link rel="stylesheet" href="../print-styles.css" />
        <style>${headerCSS}</style>
    </head>
    <body style="font-family:Arial; color:#0d2339;">
        ${body}
    </body>
    </html>`;

    return { html };
};

console.log('// [BH] banco-horas-relatorios.js carregado');

