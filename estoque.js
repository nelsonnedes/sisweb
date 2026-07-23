/**
 * Sistema de Estoque de Toras - JavaScript
 * Controle de entrada, saída e consulta de estoque de toras
 */

// Variáveis globais
function parseDateLocalSafe(str) {
    if (window.parseDateLocal) return window.parseDateLocal(str);
    if (!str) return null;
    if (str instanceof Date) return str;
    let s = String(str).trim();
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return new Date(parseInt(m1[1],10), parseInt(m1[2],10)-1, parseInt(m1[3],10));
    return new Date(s);
}

let estoqueAtual = [];
let movimentacoes = [];
let fornecedores = [];
let torasSelecionadasBaixa = [];
let torasSelecionadasModal = [];
let itensEntrada = []; // Itens temporários para entrada
let romaneiosDisponiveis = []; // Cache de romaneios
let romaneioSelecionadoId = null; // ID do romaneio selecionado
let romaneiosSaidaDisponiveis = [];
let romaneiosSaidaSelecionados = [];
let rastreabilidadeRegistros = [];
let paginaAtualEntrada = 1;
const ESTOQUE_PAGE_SIZE_DEFAULT = 10;
const ESTOQUE_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const estoqueItensPorPagina = {
    entrada: ESTOQUE_PAGE_SIZE_DEFAULT,
    saida: ESTOQUE_PAGE_SIZE_DEFAULT,
    consulta: ESTOQUE_PAGE_SIZE_DEFAULT,
    movimentacoes: ESTOQUE_PAGE_SIZE_DEFAULT,
    produtos: ESTOQUE_PAGE_SIZE_DEFAULT
};
let paginaAtualSaida = 1;
let paginaAtualEstoque = 1;
let paginaAtualMovimentacoes = 1;
let estoqueFiltrado = [];
let movimentacoesFiltradas = [];
let filtroEstoqueAtual = {};
let filtroMovimentacoesAtual = {};
let toraEmEdicao = null;
let saidaModo = 'lote';
let toraEncontradaBaixa = null;
let saidaPlaquetaResultados = [];
let saidaPlaquetaSelecionadas = new Set();
let saidaPlaquetaRecolherTimer = null;
let resumoMovimentacoesSeq = 0;
const resumoMovimentacoesCache = new Map();
let filtrosTorasModalState = { especie: '', rodo: '', comprimento: '' };
let estoqueRuntimeState = { mode: 'ok', message: '' };
let ordemMovimentacoes = { coluna: 'data', direcao: 'desc' };
let movimentacoesSelecionadas = new Set();
let ordemEntrada = { coluna: 'plaqueta', direcao: 'asc' };
let entradaSelecionadas = new Set();
let ordemSaida = { coluna: 'plaqueta', direcao: 'asc' };
let saidaSelecionadas = new Set();
let ordemEstoque = { coluna: 'data', direcao: 'desc' };
let estoqueSelecionadas = new Set();
let especiesEntradaCadastradas = [];
let especiesEntradaCarregadas = false;
let especiesEntradaErroCarga = false;

function logEstoqueEvent(scope, message, extra = null, level = 'info') {
    const stamp = new Date().toISOString();
    const payload = { stamp, scope, message, extra };
    try {
        if (level === 'error') console.error('[ESTOQUE]', payload);
        else if (level === 'warn') console.warn('[ESTOQUE]', payload);
        else console.info('[ESTOQUE]', payload);
    } catch (_) {}
    try {
        const key = 'estoque_runtime_logs';
        const prev = JSON.parse(localStorage.getItem(key) || '[]');
        prev.push(payload);
        if (prev.length > 200) prev.splice(0, prev.length - 200);
        localStorage.setItem(key, JSON.stringify(prev));
    } catch (_) {}
}

function setEstoqueRuntimeStatus(mode, message) {
    estoqueRuntimeState = { mode, message: message || '' };
    let host = document.getElementById('estoqueRuntimeStatus');
    if (!host) {
        const h1 = document.querySelector('.container h1');
        if (!h1 || !h1.parentNode) return;
        host = document.createElement('div');
        host.id = 'estoqueRuntimeStatus';
        host.style.margin = '8px 0 12px';
        host.style.padding = '8px 10px';
        host.style.borderRadius = '6px';
        host.style.fontSize = '12px';
        host.style.display = 'none';
        h1.insertAdjacentElement('afterend', host);
    }
    if (mode === 'ok') {
        host.style.display = 'none';
        host.textContent = '';
        return;
    }
    host.style.display = 'block';
    if (mode === 'warn') {
        host.style.background = '#fff7e6';
        host.style.border = '1px solid #ffd591';
        host.style.color = '#8c5a00';
    } else {
        host.style.background = '#fff1f0';
        host.style.border = '1px solid #ffa39e';
        host.style.color = '#a8071a';
    }
    host.textContent = message || 'Atenção no carregamento do estoque';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseNumeroEstoque(value) {
    if (window.ToraGeometry && typeof window.ToraGeometry.toNumber === 'function') {
        return window.ToraGeometry.toNumber(value);
    }
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const raw = String(value).trim();
    if (!raw) return 0;
    const normalized = raw.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizarCamposGeoEstoque(item = {}) {
    if (window.ToraGeometry && typeof window.ToraGeometry.normalizarCamposGeoItem === 'function') {
        return window.ToraGeometry.normalizarCamposGeoItem(item);
    }
    const source = item || {};
    const compGeo = parseNumeroEstoque(source.compGeo || source.comprimentoGeo || source.comprimentoGeometrico);
    const x1 = parseNumeroEstoque(source.x1);
    const x2 = parseNumeroEstoque(source.x2);
    const x3 = parseNumeroEstoque(source.x3);
    const x4 = parseNumeroEstoque(source.x4);
    let volumeGeo = parseNumeroEstoque(source.volumeGeo || source.vGeo || source.volumeGeometrico);
    if (!volumeGeo && window.calcularVolumeGeometricoSmalian) {
        volumeGeo = window.calcularVolumeGeometricoSmalian(compGeo, x1, x2, x3, x4);
    }
    return {
        custodia: String(source.custodia || source.custody || source.Custodia || source['Custódia'] || '').trim(),
        compGeo,
        x1,
        x2,
        x3,
        x4,
        volumeGeo
    };
}

function formatarMedidaGeoEstoque(value) {
    if (window.ToraGeometry && typeof window.ToraGeometry.formatarMedidaCm === 'function') {
        return window.ToraGeometry.formatarMedidaCm(value);
    }
    const n = parseNumeroEstoque(value);
    return n ? formatNumber(n, 1) : '-';
}

function formatarVolumeGeoEstoque(value) {
    if (window.ToraGeometry && typeof window.ToraGeometry.formatarVolumeGeo === 'function') {
        return window.ToraGeometry.formatarVolumeGeo(value);
    }
    const n = parseNumeroEstoque(value);
    return n ? formatNumber(n, 3) : '-';
}

function obterCamposGeoEntrada() {
    const geo = normalizarCamposGeoEstoque({
        custodia: document.getElementById('custodiaEntrada')?.value || '',
        compGeo: document.getElementById('compGeoEntrada')?.value || 0,
        x1: document.getElementById('x1Entrada')?.value || 0,
        x2: document.getElementById('x2Entrada')?.value || 0,
        x3: document.getElementById('x3Entrada')?.value || 0,
        x4: document.getElementById('x4Entrada')?.value || 0,
        volumeGeo: document.getElementById('volumeGeoEntrada')?.value || 0
    });
    const volumeEl = document.getElementById('volumeGeoEntrada');
    if (volumeEl) volumeEl.value = geo.volumeGeo ? geo.volumeGeo.toFixed(3) : '0.000';
    return geo;
}

function aplicarCamposGeoEntrada(item = {}) {
    const geo = normalizarCamposGeoEstoque(item);
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };
    set('custodiaEntrada', geo.custodia);
    set('compGeoEntrada', geo.compGeo || '');
    set('x1Entrada', geo.x1 || '');
    set('x2Entrada', geo.x2 || '');
    set('x3Entrada', geo.x3 || '');
    set('x4Entrada', geo.x4 || '');
    const volumeEl = document.getElementById('volumeGeoEntrada');
    if (volumeEl) volumeEl.value = geo.volumeGeo ? geo.volumeGeo.toFixed(3) : '0.000';
}

function obterCamposGeoManualSaida() {
    const geo = normalizarCamposGeoEstoque({
        custodia: document.getElementById('manualCustodiaSaida')?.value || '',
        compGeo: document.getElementById('manualCompGeoSaida')?.value || 0,
        x1: document.getElementById('manualX1Saida')?.value || 0,
        x2: document.getElementById('manualX2Saida')?.value || 0,
        x3: document.getElementById('manualX3Saida')?.value || 0,
        x4: document.getElementById('manualX4Saida')?.value || 0,
        volumeGeo: document.getElementById('manualVolumeGeoSaida')?.value || 0
    });
    const volumeEl = document.getElementById('manualVolumeGeoSaida');
    if (volumeEl) volumeEl.value = geo.volumeGeo ? geo.volumeGeo.toFixed(3) : '0.000';
    return geo;
}

function limparCamposGeoManualSaida() {
    ['manualCustodiaSaida', 'manualCompGeoSaida', 'manualX1Saida', 'manualX2Saida', 'manualX3Saida', 'manualX4Saida'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const volumeEl = document.getElementById('manualVolumeGeoSaida');
    if (volumeEl) volumeEl.value = '0.000';
}

function configurarCamposGeoEstoque() {
    if (window.ToraGeometry && typeof window.ToraGeometry.bindVolumeInputs === 'function') {
        window.ToraGeometry.bindVolumeInputs({
            compGeo: 'compGeoEntrada',
            x1: 'x1Entrada',
            x2: 'x2Entrada',
            x3: 'x3Entrada',
            x4: 'x4Entrada',
            volumeGeo: 'volumeGeoEntrada'
        });
        window.ToraGeometry.bindVolumeInputs({
            compGeo: 'manualCompGeoSaida',
            x1: 'manualX1Saida',
            x2: 'manualX2Saida',
            x3: 'manualX3Saida',
            x4: 'manualX4Saida',
            volumeGeo: 'manualVolumeGeoSaida'
        });
    }
}

function obterValorOrdenacaoEstoque(item, coluna) {
    const geoKeys = ['custodia', 'compGeo', 'x1', 'x2', 'x3', 'x4', 'volumeGeo'];
    if (geoKeys.includes(coluna)) {
        return normalizarCamposGeoEstoque(item)[coluna];
    }
    if (coluna === 'diametro') return item ? (item.diametro || item.rodo || 0) : 0;
    if (coluna === 'volumeDesconto' || coluna === 'desconto') return item ? (item.volumeDesconto || item.desconto || 0) : 0;
    if (coluna === 'preco') return item ? (item.preco || item.precoCusto || 0) : 0;
    if (coluna === 'valor') return (parseFloat(item.volumeLiquido || item.volumeSerraria || 0) || 0) * (parseFloat(item.precoCusto || item.preco || 0) || 0);
    return item ? item[coluna] : '';
}

function compararValoresEstoque(a, b, coluna, direcao = 'asc') {
    let valA = obterValorOrdenacaoEstoque(a, coluna);
    let valB = obterValorOrdenacaoEstoque(b, coluna);
    const nA = parseNumeroEstoque(valA);
    const nB = parseNumeroEstoque(valB);
    let result = 0;
    if ((nA || nA === 0) && (nB || nB === 0) && (typeof valA === 'number' || typeof valB === 'number' || /^-?[\d.,]+$/.test(String(valA || '')) || /^-?[\d.,]+$/.test(String(valB || '')))) {
        result = nA - nB;
    } else {
        result = String(valA || '').localeCompare(String(valB || ''), 'pt-BR', { numeric: true, sensitivity: 'base' });
    }
    return direcao === 'desc' ? -result : result;
}

function normalizarItemComGeo(item = {}) {
    return { ...(item || {}), ...normalizarCamposGeoEstoque(item) };
}

function isChaveTecnicaFirebaseEstoque(key) {
    return String(key || '').trim().startsWith('_');
}

function isRegistroTecnicoFirebaseEstoque(value, key = '') {
    if (!value || typeof value !== 'object') return false;
    const directKeys = [key, value.firebaseKey, value.key]
        .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
        .map(String);
    if (directKeys.some(isChaveTecnicaFirebaseEstoque)) return true;

    const id = String(value.id || '').trim();
    if (!isChaveTecnicaFirebaseEstoque(id)) return false;

    const hasBusinessFields = !!(
        value.numero ||
        value.numeroRomaneio ||
        value.plaqueta ||
        value.produto ||
        value.movimentacaoId ||
        value.especie ||
        value.fornecedor ||
        value.fornecedorNome ||
        value.cliente ||
        value.clienteNome
    );
    return !hasBusinessFields;
}

function normalizarListaFirebaseEstoque(raw, options = {}) {
    const data = raw && raw.data !== undefined ? raw.data : raw;
    const incluirTecnicos = !!options.incluirTecnicos;
    if (!data) return [];
    if (Array.isArray(data)) {
        return data.filter(item => item && (incluirTecnicos || !isRegistroTecnicoFirebaseEstoque(item)));
    }
    if (typeof data === 'object') {
        return Object.entries(data)
            .filter(([key, value]) => value && typeof value === 'object' && (incluirTecnicos || !isRegistroTecnicoFirebaseEstoque(value, key)))
            .map(([key, value]) => ({ firebaseKey: key, ...value, id: value.id || key }));
    }
    return [];
}

function obterNumeroRomaneioDisplay(romaneio = {}) {
    const source = romaneio || {};
    return String(
        source.numeroRomaneio ||
        source.numero ||
        source.codigo ||
        source.cod ||
        source.id ||
        source.firebaseKey ||
        ''
    ).trim();
}

function obterDataRomaneioDisplay(romaneio = {}) {
    return romaneio._metadata?.lastUpdated ||
        romaneio.updatedAt ||
        romaneio.updated ||
        romaneio.lastModified ||
        romaneio.dataEmissao ||
        romaneio.data ||
        romaneio.dataHora ||
        romaneio.dataCriacao ||
        romaneio.createdAt ||
        romaneio.created ||
        romaneio.timestamp ||
        '';
}

function obterPessoaRomaneioDisplay(romaneio = {}) {
    const pessoa = romaneio.clienteNome ||
        (romaneio.cliente && romaneio.cliente.nome) ||
        romaneio.fornecedorNome ||
        (romaneio.fornecedor && romaneio.fornecedor.nome) ||
        romaneio.cliente ||
        romaneio.fornecedor ||
        '';
    return String(pessoa || '').trim();
}

function obterItensRomaneioArray(romaneio = {}) {
    const itensRaw = romaneio.itens || romaneio.items || romaneio.romaneioItems || [];
    if (Array.isArray(itensRaw)) return itensRaw.filter(Boolean);
    if (itensRaw && typeof itensRaw === 'object') return Object.values(itensRaw).filter(Boolean);
    return [];
}

function obterIdRomaneioEntrada(romaneio = {}) {
    return String(
        romaneio.id ||
        romaneio.romaneioId ||
        romaneio.firebaseKey ||
        romaneio.key ||
        romaneio.numero ||
        romaneio.numeroRomaneio ||
        ''
    ).trim();
}

function normalizarRomaneiosEntradaEstoque(raw, tipo = 'TORA') {
    const utils = window.RomaneioDataUtils;
    const lista = utils && typeof utils.normalizeRomaneioCollection === 'function'
        ? utils.normalizeRomaneioCollection(raw, { type: tipo })
        : normalizarListaFirebaseEstoque(raw);
    return lista
        .filter(r => r && typeof r === 'object' && !isRegistroTecnicoFirebaseEstoque(r))
        .map(r => {
            const id = obterIdRomaneioEntrada(r);
            return {
                ...r,
                id,
                firebaseKey: r.firebaseKey || r.key || id,
                tipo: (r.tipo || tipo || '').toUpperCase()
            };
        })
        .filter(r => r.id && !isChaveTecnicaFirebaseEstoque(r.id));
}

function obterTimestampRomaneioEstoque(romaneio = {}) {
    if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.parseRomaneioTimestamp === 'function') {
        return window.RomaneioDataUtils.parseRomaneioTimestamp(romaneio);
    }
    const raw = obterDataRomaneioDisplay(romaneio);
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    const timestamp = raw ? new Date(raw).getTime() : 0;
    if (Number.isFinite(timestamp) && timestamp > 0) return timestamp;
    const id = String(romaneio.id || romaneio.romaneioId || romaneio.firebaseKey || romaneio.key || romaneio.numero || romaneio.numeroRomaneio || '');
    const match = id.match(/(\d{10,})/);
    return match ? Number(match[1]) || 0 : 0;
}

function obterVolumeRomaneioRastreabilidade(romaneio = {}) {
    const itens = obterItensRomaneioArray(romaneio);
    return Number(
        (romaneio.totais && (romaneio.totais.volumeSerraria || romaneio.totais.volumeTotal || romaneio.totais.volume)) ||
        romaneio.totalVolume ||
        romaneio.volumeSerraria ||
        romaneio.volumeTotal ||
        romaneio.volume ||
        itens.reduce((acc, item) => acc + (parseNumeroEstoque(item.volumeSerraria || item.volumeLiquido || item.volumeTotal || item.volume) || 0), 0)
    ) || 0;
}

function obterValorRomaneioRastreabilidade(romaneio = {}) {
    const itens = obterItensRomaneioArray(romaneio);
    return Number(
        (romaneio.totais && (romaneio.totais.valorTotal || romaneio.totais.valor)) ||
        romaneio.totalValor ||
        romaneio.valorTotal ||
        romaneio.valor ||
        itens.reduce((acc, item) => acc + (parseNumeroEstoque(item.valorTotal || item.valor || item.total || item.precoTotal) || 0), 0)
    ) || 0;
}

function normalizarRomaneioRastreabilidade(romaneio = {}) {
    const numero = obterNumeroRomaneioDisplay(romaneio);
    const tipo = String(romaneio.tipo || romaneio.tipoRomaneio || '').toUpperCase();
    const id = String(romaneio.id || romaneio.romaneioId || romaneio.firebaseKey || numero || '').trim();
    const data = obterDataRomaneioDisplay(romaneio);
    const clienteNome = obterPessoaRomaneioDisplay(romaneio);
    return {
        id,
        romaneioId: id,
        tipo,
        numero,
        numeroRomaneio: numero,
        data,
        clienteNome,
        label: String(romaneio.label || '').trim(),
        volumeSerraria: obterVolumeRomaneioRastreabilidade(romaneio),
        valorTotal: obterValorRomaneioRastreabilidade(romaneio)
    };
}

function normalizarRomaneiosRastreabilidade(lista = []) {
    const arr = Array.isArray(lista) ? lista : normalizarListaFirebaseEstoque(lista);
    const map = new Map();
    arr.forEach(item => {
        const rom = normalizarRomaneioRastreabilidade(item || {});
        const key = rom.id || rom.numero || rom.label;
        if (key && !map.has(key)) map.set(key, rom);
    });
    return Array.from(map.values());
}

function resumirRomaneiosRastreabilidade(romaneios = []) {
    const lista = normalizarRomaneiosRastreabilidade(romaneios);
    const numeros = [...new Set(lista.map(r => r.numero || r.id).filter(Boolean))].join(', ');
    const ids = [...new Set(lista.map(r => r.id).filter(Boolean))].join(', ');
    const tipos = [...new Set(lista.map(r => r.tipo).filter(Boolean))].join(', ');
    const clientes = [...new Set(lista.map(r => r.clienteNome).filter(Boolean))].join(', ');
    const volumeProduzido = lista.reduce((acc, r) => acc + (parseNumeroEstoque(r.volumeSerraria) || 0), 0);
    const valorTotal = lista.reduce((acc, r) => acc + (parseNumeroEstoque(r.valorTotal) || 0), 0);
    return { lista, numeros, ids, tipos, clientes, volumeProduzido, valorTotal };
}

function obterUsuarioAuditoriaEstoque() {
    try {
        const user = window.firebaseAuthUser || (window.firebaseService && window.firebaseService.authService && window.firebaseService.authService.getAuth && window.firebaseService.authService.getAuth().currentUser);
        if (user) {
            return {
                uid: String(user.uid || ''),
                nome: String(user.displayName || user.email || user.uid || ''),
                email: String(user.email || '')
            };
        }
    } catch (_) {}
    try {
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
        const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
        const base = current.uid || current.id || current.userId ? current : persistent;
        return {
            uid: String(base.uid || base.id || base.userId || ''),
            nome: String(base.nome || base.name || base.displayName || base.email || base.uid || base.id || ''),
            email: String(base.email || '')
        };
    } catch (_) {}
    return { uid: '', nome: '', email: '' };
}

function gerarIdRastreabilidade(remessaId, movimentacaoId) {
    const raw = `RAST_${remessaId || 'SEM_REMESSA'}_${movimentacaoId || generateUniqueId('MOV')}`;
    return raw.replace(/[.#$\[\]\/\\]/g, '_');
}

function criarRegistroRastreabilidadeDeMovimento(mov = {}, contexto = {}) {
    const romaneios = normalizarRomaneiosRastreabilidade(contexto.romaneiosRelacionados || mov.romaneiosRelacionados || []);
    const resumo = resumirRomaneiosRastreabilidade(romaneios);
    const geo = normalizarCamposGeoEstoque(mov);
    const volumeTora = parseNumeroEstoque(mov.volume || mov.volumeLiquido || mov.volumeSerraria);
    const volumeTorasRemessa = parseNumeroEstoque(contexto.volumeTorasRemessa) || volumeTora;
    const volumeProduzido = parseNumeroEstoque(contexto.volumeProduzido) || resumo.volumeProduzido;
    const rendimento = volumeTorasRemessa > 0 ? (volumeProduzido / volumeTorasRemessa) * 100 : 0;
    const usuario = contexto.usuario || obterUsuarioAuditoriaEstoque();
    const remessaId = mov.remessaId || contexto.remessaId || '';
    const id = contexto.id || gerarIdRastreabilidade(remessaId, mov.id);
    return {
        id,
        data: mov.data || contexto.data || '',
        remessaId,
        movimentacaoId: mov.id || contexto.movimentacaoId || '',
        toraId: mov.toraId || contexto.toraId || '',
        plaqueta: mov.plaqueta || '',
        custodia: geo.custodia || '',
        especie: mov.especie || '',
        documento: mov.documento || '',
        tipoSaida: mov.tipoSaida || contexto.tipoSaida || '',
        motivo: contexto.motivo || mov.motivoBaixa || '',
        romaneioId: resumo.ids,
        numeroRomaneio: resumo.numeros,
        tipoRomaneio: resumo.tipos,
        clienteNome: resumo.clientes,
        romaneios: resumo.lista,
        volumeTora,
        volumeTorasRemessa,
        volumeProduzido,
        valorProduzido: resumo.valorTotal,
        rendimento,
        compGeo: geo.compGeo,
        x1: geo.x1,
        x2: geo.x2,
        x3: geo.x3,
        x4: geo.x4,
        volumeGeo: geo.volumeGeo,
        usuarioId: usuario.uid || '',
        usuarioNome: usuario.nome || usuario.email || '',
        usuarioEmail: usuario.email || '',
        companyId: resolveCompanyId() || '',
        origem: contexto.origem || 'saida_estoque',
        confiabilidade: contexto.confiabilidade || (resumo.lista.length ? 'formal' : 'sem_romaneio'),
        status: contexto.status || 'ativo',
        observacoesOriginais: mov.observacoes || '',
        dataCriacao: contexto.dataCriacao || new Date().toISOString(),
        created: contexto.created || new Date().toISOString()
    };
}

function criarRegistrosRastreabilidadeSaida(movimentos = [], contexto = {}) {
    const volumeTorasRemessa = movimentos.reduce((acc, mov) => acc + (parseNumeroEstoque(mov.volume || mov.volumeLiquido) || 0), 0);
    const resumo = resumirRomaneiosRastreabilidade(contexto.romaneiosRelacionados || []);
    return movimentos.map(mov => criarRegistroRastreabilidadeDeMovimento(mov, {
        ...contexto,
        volumeTorasRemessa,
        volumeProduzido: resumo.volumeProduzido,
        usuario: contexto.usuario || obterUsuarioAuditoriaEstoque()
    }));
}

function normalizarRegistroRastreabilidade(registro = {}) {
    const romaneios = normalizarRomaneiosRastreabilidade(registro.romaneios || registro.romaneiosRelacionados || []);
    const resumo = resumirRomaneiosRastreabilidade(romaneios);
    const geo = normalizarCamposGeoEstoque(registro);
    return {
        ...(registro || {}),
        id: registro.id || registro.firebaseKey || gerarIdRastreabilidade(registro.remessaId, registro.movimentacaoId),
        romaneios,
        romaneioId: registro.romaneioId || resumo.ids,
        numeroRomaneio: registro.numeroRomaneio || resumo.numeros,
        tipoRomaneio: registro.tipoRomaneio || resumo.tipos,
        clienteNome: registro.clienteNome || resumo.clientes,
        volumeTora: parseNumeroEstoque(registro.volumeTora || registro.volume || registro.volumeLiquido),
        volumeTorasRemessa: parseNumeroEstoque(registro.volumeTorasRemessa),
        volumeProduzido: parseNumeroEstoque(registro.volumeProduzido || resumo.volumeProduzido),
        valorProduzido: parseNumeroEstoque(registro.valorProduzido || resumo.valorTotal),
        rendimento: parseNumeroEstoque(registro.rendimento),
        status: String(registro.status || 'ativo').trim().toLowerCase() || 'ativo',
        ...geo
    };
}

function normalizarChaveEspecie(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizarChavePlaqueta(value) {
    return String(value || '').trim().toLowerCase();
}

function encontrarToraPorPlaqueta(plaqueta, ignorarId = '') {
    const chave = normalizarChavePlaqueta(plaqueta);
    if (!chave) return null;
    return estoqueAtual.find((tora) => {
        if (!tora) return false;
        const mesmoId = ignorarId && String(tora.id) === String(ignorarId);
        return !mesmoId && normalizarChavePlaqueta(tora.plaqueta) === chave;
    }) || null;
}

function itemEntradaTemPlaqueta(plaqueta, ignorarId = '') {
    const chave = normalizarChavePlaqueta(plaqueta);
    if (!chave) return false;
    return itensEntrada.some((item) => {
        if (!item) return false;
        const mesmoId = ignorarId && String(item.id) === String(ignorarId);
        return !mesmoId && normalizarChavePlaqueta(item.plaqueta) === chave;
    });
}

function obterNomeEspecieCadastro(specie) {
    if (!specie) return '';
    if (typeof specie === 'string') return specie.trim();
    return String(specie.nome || specie.name || specie.nomeComum || specie.nomeCientifico || specie.especie || '').trim();
}

function atualizarCacheEspeciesEntrada(especies = []) {
    const map = new Map();
    (Array.isArray(especies) ? especies : []).forEach((specie) => {
        const nome = obterNomeEspecieCadastro(specie);
        const chave = normalizarChaveEspecie(nome);
        if (!nome || !chave || map.has(chave)) return;
        map.set(chave, {
            id: (specie && typeof specie === 'object') ? (specie.id || specie.key || '') : '',
            nome,
            chave
        });
    });
    especiesEntradaCadastradas = Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return especiesEntradaCadastradas;
}

function obterEspecieCadastradaPorNome(nome) {
    const chave = normalizarChaveEspecie(nome);
    if (!chave) return null;
    return especiesEntradaCadastradas.find(e => e.chave === chave) || null;
}

function normalizarNomeEspecieCadastrada(nome) {
    const encontrada = obterEspecieCadastradaPorNome(nome);
    return encontrada ? encontrada.nome : String(nome || '').trim();
}

function validarEspecieEntrada(nome, showAlert = true) {
    const valor = String(nome || '').trim();
    if (!valor) {
        if (showAlert) alert('Informe a espécie.');
        return { ok: false, nome: '' };
    }

    if (especiesEntradaErroCarga || !especiesEntradaCarregadas) {
        if (showAlert) {
            alert('A lista de espécies cadastradas ainda não foi carregada com segurança. Aguarde alguns instantes ou recarregue a página antes de lançar a tora.');
        }
        return { ok: false, nome: valor };
    }

    const encontrada = obterEspecieCadastradaPorNome(valor);
    if (encontrada) return { ok: true, nome: encontrada.nome };

    if (especiesEntradaCadastradas.length === 0) {
        if (showAlert) {
            alert('Nenhuma espécie cadastrada foi carregada. Cadastre ou carregue uma espécie antes de lançar a tora.');
        }
        return { ok: false, nome: valor };
    }

    if (showAlert) {
        alert('Espécie não encontrada no cadastro. Selecione uma espécie cadastrada ou use o botão + para cadastrar antes de lançar a tora.');
    }
    return { ok: false, nome: valor };
}

function obterCampoPorIdOuElemento(inputOrId, fallbackId = 'especieEntrada') {
    if (inputOrId && typeof inputOrId === 'object' && inputOrId.nodeType === 1) {
        return inputOrId;
    }
    const id = (typeof inputOrId === 'string' && inputOrId) ? inputOrId : fallbackId;
    return id ? document.getElementById(id) : null;
}

function aplicarEspecieCanonicaNoCampo(showAlert = false, inputOrId = 'especieEntrada') {
    const input = obterCampoPorIdOuElemento(inputOrId);
    if (!input || !input.value) return true;
    const validacao = validarEspecieEntrada(input.value, showAlert);
    if (validacao.ok) input.value = validacao.nome;
    return validacao.ok;
}

function configurarCampoEspecieAutocomplete(input) {
    if (!input || input._canonicoListenerConfigured) return;

    input.classList.add('autocomplete-input');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', input.getAttribute('aria-expanded') || 'false');
    input.setAttribute('aria-controls', 'especieSuggestions');
    input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('role', 'combobox');

    const exigeCadastro = () => input.dataset && input.dataset.speciesValidate === 'true';
    const ativarCampo = () => {
        if (typeof window.setActiveSpeciesAutocompleteInput === 'function') {
            window.setActiveSpeciesAutocompleteInput(input);
        } else if (input.id) {
            window.__activeSpeciesAutocompleteInputId = input.id;
        }
    };

    input.addEventListener('blur', () => {
        if (exigeCadastro()) aplicarEspecieCanonicaNoCampo(false, input);
        setTimeout(() => {
            const suggestions = document.getElementById('especieSuggestions');
            const active = document.activeElement;
            if (active !== input && !(suggestions && suggestions.contains(active)) && typeof window.hideSpeciesSuggestions === 'function') {
                window.hideSpeciesSuggestions(input);
            }
        }, 80);
    });
    input.addEventListener('change', () => {
        if (exigeCadastro()) aplicarEspecieCanonicaNoCampo(false, input);
    });
    input.addEventListener('focus', () => {
        ativarCampo();
        if (typeof window.showSpeciesSuggestions === 'function') window.showSpeciesSuggestions(input);
    });
    input.addEventListener('input', () => {
        ativarCampo();
        if (typeof window.showSpeciesSuggestions === 'function') window.showSpeciesSuggestions(input);
    });
    input._canonicoListenerConfigured = true;
}

function configurarCamposEspecieAutocomplete() {
    const campos = document.querySelectorAll('[data-species-autocomplete="true"], #especieEntrada');
    campos.forEach(configurarCampoEspecieAutocomplete);
}

function setModoEdicaoEntrada(tora = null) {
    const isEditing = !!tora;
    const btn = document.getElementById('entradaItemActionBtn');
    const icon = document.getElementById('entradaItemActionIcon');
    const label = document.getElementById('entradaItemActionLabel');
    const titulo = document.getElementById('entradaDadosToraTitulo');
    const aviso = document.getElementById('editToraAviso');

    if (btn) {
        btn.classList.toggle('btn-primary', !isEditing);
        btn.classList.toggle('btn-warning', isEditing);
    }
    if (icon) icon.className = isEditing ? 'fas fa-save' : 'fas fa-plus';
    if (label) label.textContent = isEditing ? 'Atualizar Item' : 'Adicionar Item';
    if (titulo) titulo.textContent = isEditing ? 'Dados da Tora (Editar)' : 'Dados da Tora (Adicionar Manualmente)';
    if (aviso) {
        aviso.style.display = isEditing ? 'block' : 'none';
        if (isEditing) {
            const plaqueta = String(tora && tora.plaqueta || '').trim();
            aviso.textContent = '';
            const prefixo = document.createElement('strong');
            prefixo.textContent = `Modo edição${plaqueta ? ` - Plaqueta ${plaqueta}` : ''}:`;
            const acao = document.createElement('strong');
            acao.textContent = 'Atualizar Item';
            aviso.append(prefixo, document.createTextNode(' revise os dados e clique em '), acao, document.createTextNode(' para gravar as alterações nesta tora do estoque. Esta ação não cria nova entrada nem duplica a plaqueta.'));
        }
    }
}

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    inicializarSistema();
});

// Funções utilitárias de UI
function getSkeletonRows(cols, rows = 5) {
    const td = '<td><div class="skeleton-box"></div></td>';
    return Array(rows).fill(`<tr class="skeleton-row">${td.repeat(cols)}</tr>`).join('');
}

function toggleOffcanvas(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.style.display === 'none') {
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

function isEstoquePwaPrintContext() {
    try {
        const standalone = (window.matchMedia && (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: minimal-ui)').matches
        )) || window.navigator.standalone === true;
        const smallTouchScreen = window.matchMedia
            && window.matchMedia('(pointer: coarse)').matches
            && window.innerWidth <= 768;
        return !!(standalone || smallTouchScreen);
    } catch (_) {
        return window.navigator.standalone === true;
    }
}

function normalizarColunaPdfEstoque(coluna) {
    const source = typeof coluna === 'string' ? { label: coluna } : (coluna || {});
    const alignRaw = String(source.align || source.className || '').toLowerCase();
    let align = source.textAlign || 'left';
    if (alignRaw.includes('right')) align = 'right';
    else if (alignRaw.includes('center')) align = 'center';
    return {
        label: source.label || source.title || source.key || '',
        key: source.key || source.label || '',
        align,
        weight: source.weight || source.width || undefined
    };
}

function criarNomeArquivoPdfEstoque(titulo) {
    const base = String(titulo || 'relatorio-estoque')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'relatorio-estoque';
    return `${base}-${new Date().toISOString().slice(0, 10)}.pdf`;
}

function notificarEntregaPdfEstoque(result) {
    if (!result || result.mode === 'cancelled') return;
    const msg = result.mode === 'share'
        ? 'PDF pronto para compartilhar ou imprimir pelo aparelho.'
        : `PDF gerado: ${result.fileName}`;
    if (window.ToastManager && typeof window.ToastManager.success === 'function') {
        window.ToastManager.success(msg, 'PDF');
    } else {
        console.log(`[PDF] ${msg}`);
    }
}

async function exportarTabelaEstoquePdf(options = {}) {
    const helper = window.SiswebCommercePdf;
    if (!helper || typeof helper.exportTableReportPdf !== 'function') {
        throw new Error('Gerador de PDF indisponivel.');
    }

    const titulo = options.title || options.documentTitle || 'Relatório de Estoque';
    const result = await helper.exportTableReportPdf({
        company: options.company || await obterDadosEmpresaRelatorio(),
        documentTitle: titulo,
        title: titulo,
        badgeText: options.badgeText || 'Estoque',
        subtitle: options.subtitle || '',
        metaRows: options.metaRows || [],
        fileName: options.fileName || criarNomeArquivoPdfEstoque(titulo),
        shareText: options.shareText || 'PDF de relatório de estoque gerado pelo Sisweb.',
        summaryRows: options.summaryRows || [],
        columns: (options.columns || []).map(normalizarColunaPdfEstoque),
        rows: options.rows || [],
        tables: options.tables,
        emptyText: options.emptyText || 'Nenhum registro encontrado.',
        orientation: options.orientation || 'landscape'
    });
    notificarEntregaPdfEstoque(result);
    return result;
}

function imprimirHtmlEstoque(htmlCompleto, windowFeatures = 'width=1100,height=800') {
    const helper = window.SiswebCommercePdf;
    if (helper && typeof helper.printHtmlDocument === 'function') {
        helper.printHtmlDocument({ html: htmlCompleto, windowFeatures });
        return;
    }

    const win = window.open('', '_blank', windowFeatures);
    if (!win) {
        window.print();
        return;
    }
    win.document.write(htmlCompleto);
    win.document.close();
    win.focus();
    win.onload = function() { setTimeout(() => win.print(), 250); };
}

async function entregarRelatorioEstoque(options = {}) {
    const titulo = options.title || 'Relatório de Estoque';
    const pdfOptions = {
        ...(options.pdfOptions || {}),
        title: titulo,
        documentTitle: titulo,
        company: options.company || (options.pdfOptions || {}).company,
        subtitle: options.subtitle || options.periodo || (options.pdfOptions || {}).subtitle || '',
        metaRows: options.metaRows || []
    };

    window.__estoquePreviewPrintPayload = {
        html: options.htmlCompleto || '',
        pdfOptions
    };

    if (isEstoquePwaPrintContext()) {
        showLoading('Gerando PDF...');
        try {
            await exportarTabelaEstoquePdf(pdfOptions);
        } finally {
            hideLoading();
        }
        return;
    }

    if (options.preview === false) {
        imprimirHtmlEstoque(options.htmlCompleto || '', options.windowFeatures || 'width=1100,height=800');
        return;
    }

    abrirPreviewRelatorio(options.htmlCompleto || '', pdfOptions);
}

function abrirPreviewRelatorio(htmlCompleto, pdfOptions = null) {
    window.__estoquePreviewPrintPayload = {
        html: htmlCompleto,
        pdfOptions
    };
    const modal = document.getElementById('relatorioPreviewModal');
    const iframe = document.getElementById('relatorioPreviewIframe');
    if (!modal || !iframe) {
        imprimirHtmlEstoque(htmlCompleto);
        return;
    }
    iframe.srcdoc = htmlCompleto;
    modal.style.display = 'block';
}

function fecharRelatorioPreview() {
    const modal = document.getElementById('relatorioPreviewModal');
    const iframe = document.getElementById('relatorioPreviewIframe');
    if (modal) modal.style.display = 'none';
    if (iframe) iframe.srcdoc = '';
}

async function imprimirDoIframe() {
    const payload = window.__estoquePreviewPrintPayload || {};
    if (isEstoquePwaPrintContext() && payload.pdfOptions) {
        await exportarTabelaEstoquePdf(payload.pdfOptions);
        return;
    }

    const iframe = document.getElementById('relatorioPreviewIframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
    }
}

// Funções de inicialização
function inicializarSistema() {
    logEstoqueEvent('init', 'Inicializando sistema de estoque');

    // Configurar data atual
    const hoje = new Date().toISOString().split('T')[0];
    ['entradaData', 'saidaData', 'filtroDataInicio', 'filtroDataFim', 'relDataInicio', 'relDataFim'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = hoje;
    });

    // Carregar dados
    carregarDados();

    // Configurar eventos
    configurarEventos();

    // Atualizar estatísticas
    atualizarEstatisticas();
}

function getEstoqueFirebaseService() {
    try {
        return window.firebaseService || window.firebaseServiceTL || window.FirebaseService || null;
    } catch (_) {
        return null;
    }
}

function isFirebaseOfflineModeEstoque() {
    try {
        if (window._FIREBASE_CONNECTED === false || window.firebaseConnected === false) return true;
    } catch (_) {}
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    } catch (_) {}
    return false;
}

function limparContextoEmpresaEstoqueInseguro() {
    try { window.appTenantId = null; } catch (_) {}
    try { window.companyInfo = null; } catch (_) {}
    try { localStorage.removeItem('company_info'); } catch (_) {}
    try {
        const svc = getEstoqueFirebaseService();
        if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(null);
    } catch (_) {}
}

async function ensureTenantContext(timeoutMs = 10000) {
    const start = Date.now();
    const getCachedTenant = () => {
        try {
            const svc = getEstoqueFirebaseService();
            if (svc && typeof svc.getTenantId === 'function') {
                const t = svc.getTenantId();
                if (t) return String(t);
            }
            if (svc && typeof svc.getCurrentTenantId === 'function') {
                const t = svc.getCurrentTenantId();
                if (t) return String(t);
            }
        } catch (_) {}
        try {
            if (window.appTenantId) return String(window.appTenantId);
            const raw = localStorage.getItem('company_info');
            if (raw) {
                const obj = JSON.parse(raw);
                const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                if (id) return String(id);
            }
        } catch (_) {}
        return null;
    };

    const svc = getEstoqueFirebaseService();
    const isOffline = isFirebaseOfflineModeEstoque();

    if (svc && typeof svc.resolveAuthenticatedTenant === 'function') {
        try {
            const resolved = await svc.resolveAuthenticatedTenant({ timeoutMs: Math.min(timeoutMs, 4500), allowCached: isOffline });
            if (resolved && resolved.success && resolved.companyId) return String(resolved.companyId);
            if (resolved && resolved.success && resolved.superAdmin) {
                limparContextoEmpresaEstoqueInseguro();
                return null;
            }
        } catch (_) {}
    }

    let tenant = null;

    while (!tenant && (Date.now() - start) < timeoutMs) {
        try {
            const svc = getEstoqueFirebaseService();
            let user = null;
            if (svc && svc.authService && typeof svc.authService.getCurrentUser === 'function') {
                user = await svc.authService.getCurrentUser();
            } else if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
                user = firebase.auth().currentUser;
            }
            if (user && user.uid) {
                let companyId = null;
                try {
                    if (svc && typeof svc.loadFromFirebase === 'function') {
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
                if (companyId) {
                    tenant = String(companyId);
                    try {
                        if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(tenant);
                        window.appTenantId = tenant;
                        const raw = localStorage.getItem('company_info');
                        const prev = raw ? JSON.parse(raw) : {};
                        const next = { ...prev, companyId: tenant, id: prev.id || tenant };
                        localStorage.setItem('company_info', JSON.stringify(next));
                        window.companyInfo = next;
                    } catch (_) {}
                }
            }
        } catch (_) {}
        if (tenant) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
        tenant = null;
    }
    if (!tenant && !isOffline) limparContextoEmpresaEstoqueInseguro();
    return tenant;
}

async function carregarDados() {
    try {
        logEstoqueEvent('data-load', 'Início do carregamento');
        setEstoqueRuntimeStatus('ok', '');
        // Indicadores visuais de carregamento
        const selForn = document.getElementById('fornecedorSelect');
        const selRom = document.getElementById('romaneioEntradaSelect');
        if (selForn) {
            selForn.innerHTML = '<option value="">Carregando fornecedores...</option>';
            selForn.disabled = true;
        }
        if (selRom) {
            selRom.innerHTML = '<option value="">Carregando romaneios...</option>';
            selRom.disabled = true;
        }

        // Aguardar carregamento do FirebaseService
        let tentativas = 0;
        while ((!window.firebaseService || typeof window.firebaseService.loadFromFirebase !== 'function') && tentativas < 30) {
            console.log(`⏳ Aguardando FirebaseService... (${tentativas + 1}/30)`);
            await new Promise(resolve => setTimeout(resolve, 200));
            tentativas++;
        }

        const firebaseAvailable = !!(window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function');
        if (!firebaseAvailable) {
            logEstoqueEvent('data-load', 'FirebaseService indisponível, usando contingência local', null, 'warn');
            setEstoqueRuntimeStatus('warn', 'Modo contingência ativo: conexão Firebase indisponível. Exibindo dados locais.');
        }

        const tenant = await ensureTenantContext();
        if (!tenant) {
            logEstoqueEvent('tenant', 'Tenant não identificado', null, 'warn');
            setEstoqueRuntimeStatus('warn', 'Empresa não identificada no estoque. Verifique autenticação e contexto da empresa.');
            if (firebaseAvailable) return;
        }

        // Carregamento Paralelo (Melhor Prática de Performance)
        const [estoqueRes, movRes, fornRes, romRes, rastRes] = await Promise.all([
            firebaseAvailable ? window.firebaseService.loadFromFirebase('estoqueTorasAtual') : getDataAsync('estoqueTorasAtual'),
            getDataAsync('movimentacoesToras'),
            firebaseAvailable ? window.firebaseService.loadFromFirebase('fornecedores') : getDataAsync('fornecedores'),
            firebaseAvailable ? window.firebaseService.loadFromFirebase('romaneios/tora') : getDataAsync('romaneios/tora'),
            firebaseAvailable ? window.firebaseService.loadFromFirebase('rastreabilidade') : getDataAsync('rastreabilidade')
        ]);

        // Processar Estoque
        let rawEstoque = estoqueRes ? (estoqueRes.data !== undefined ? estoqueRes.data : estoqueRes) : [];
        estoqueAtual = rawEstoque ? (Array.isArray(rawEstoque) ? rawEstoque : Object.values(rawEstoque)) : [];
        estoqueAtual = estoqueAtual.filter(item => item && typeof item === 'object').map(normalizarItemComGeo);

        // Processar Movimentações
        movimentacoes = movRes ? (Array.isArray(movRes) ? movRes : Object.values(movRes)) : [];
        movimentacoes = movimentacoes.filter(item => item && typeof item === 'object').map(normalizarItemComGeo);

        // Processar Rastreabilidade
        rastreabilidadeRegistros = normalizarListaFirebaseEstoque(rastRes)
            .filter(item => !String(item.firebaseKey || item.id || '').startsWith('_'))
            .map(normalizarRegistroRastreabilidade);

        // Processar Fornecedores
        let rawForn = fornRes ? (fornRes.data !== undefined ? fornRes.data : fornRes) : [];
        if (rawForn) {
            if (Array.isArray(rawForn)) {
                fornecedores = rawForn;
            } else if (typeof rawForn === 'object') {
                fornecedores = Object.values(rawForn);
            } else {
                fornecedores = [];
            }
        } else {
            fornecedores = [];
        }

        // Processar Romaneios (Cache Global)
        const romData = romRes ? (romRes.data !== undefined ? romRes.data : romRes) : null;
        if (romData) {
            romaneiosDisponiveis = normalizarRomaneiosEntradaEstoque(romData);
            romaneiosDisponiveis.sort((a, b) => obterTimestampRomaneioEstoque(b) - obterTimestampRomaneioEstoque(a));
        } else {
            romaneiosDisponiveis = [];
        }

        // Carregar Espécies (pode ser rápido ou cacheado)
        await carregarEspeciesEntrada();

        // Habilitar e atualizar Selects
        if (selForn) selForn.disabled = false;
        if (selRom) selRom.disabled = false;

        atualizarSelectFornecedores();

        // Inicializar com "Todos" ou vazio, sem filtrar ainda
        carregarRomaneiosParaSelect("");
        await carregarRomaneiosSaidaSelect();

        atualizarFiltros();

        // Carregar tabelas
        carregarTabelaEstoque();
        carregarTabelaMovimentacoes();

        configurarEventosCalculoAutomatico();
        configurarNavegacaoEnter();

        if (firebaseAvailable && tenant) setEstoqueRuntimeStatus('ok', '');
        logEstoqueEvent('data-load', 'Carga concluída', {
            estoque: estoqueAtual.length,
            movimentacoes: movimentacoes.length,
            fornecedores: fornecedores.length,
            romaneios: romaneiosDisponiveis.length,
            rastreabilidade: rastreabilidadeRegistros.length,
            firebaseAvailable,
            tenant: !!tenant
        });
    } catch (error) {
        logEstoqueEvent('data-load', 'Falha ao carregar dados', { error: String(error && error.message || error) }, 'error');
        setEstoqueRuntimeStatus('error', 'Falha ao carregar dados do estoque. Recarregue e, se persistir, acione suporte.');
    }
}

async function carregarEspeciesEntrada() {
    especiesEntradaCarregadas = false;
    especiesEntradaErroCarga = false;
    try {
        let especies = [];
        // Tentar usar o gerenciador de espécies se disponível
        if (window.speciesManagerInstance) {
            especies = await window.speciesManagerInstance.loadSpeciesData();
            if (window.speciesManagerInstance.lastLoadFailed) {
                throw new Error('Falha ao carregar cadastro central de espécies.');
            }
        } else if (window.firebaseService) {
            const result = await window.firebaseService.loadFromFirebase('especies');
            if (result && result.data) {
                especies = Array.isArray(result.data) ? result.data : Object.values(result.data);
            }
        }

        atualizarCacheEspeciesEntrada(especies);
        especiesEntradaCarregadas = true;
    } catch (e) {
        console.error("Erro ao carregar espécies:", e);
        especiesEntradaErroCarga = true;
        especiesEntradaCarregadas = false;
        atualizarCacheEspeciesEntrada([]);
    }
}

function configurarEventosCalculoAutomatico() {
    const inputs = ['diametroEntrada', 'comprimentoEntrada', 'oco1Entrada', 'oco2Entrada'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.volumeAutoBound) {
            el.addEventListener('input', calcularVolumesAutomatico);
            el.addEventListener('change', calcularVolumesAutomatico);
            el.addEventListener('blur', calcularVolumesAutomatico);
            el.dataset.volumeAutoBound = '1';
        }
    });
    configurarCamposGeoEstoque();
    calcularVolumesAutomatico();
}

function formatVolumeInputEstoque(value, decimals = 3) {
    const n = parseNumeroEstoque(value);
    return Number.isFinite(n) ? n.toFixed(decimals) : Number(0).toFixed(decimals);
}

function calcularVolumesAutomatico() {
    const diametro = parseNumeroEstoque(document.getElementById('diametroEntrada')?.value);
    const comprimento = parseNumeroEstoque(document.getElementById('comprimentoEntrada')?.value);
    const oco1 = parseNumeroEstoque(document.getElementById('oco1Entrada')?.value);
    const oco2 = parseNumeroEstoque(document.getElementById('oco2Entrada')?.value);
    const brutoEl = document.getElementById('m3BrutoEntrada');
    const liquidoEl = document.getElementById('m3LiquidoEntrada');

    if (diametro > 0 && comprimento > 0) {
        const volBruto = calcularVolumeTora(diametro, comprimento);
        const desconto = calcularDescontoOco(oco1, oco2, comprimento);
        const volLiq = Math.max(0, volBruto - desconto);

        if (brutoEl) brutoEl.value = formatVolumeInputEstoque(volBruto, 3);
        if (liquidoEl) liquidoEl.value = formatVolumeInputEstoque(volLiq, 3);
        return { volumeBruto: volBruto, volumeLiquido: volLiq, desconto };
    }
    return {
        volumeBruto: parseNumeroEstoque(brutoEl?.value),
        volumeLiquido: parseNumeroEstoque(liquidoEl?.value),
        desconto: 0
    };
}

function configurarNavegacaoEnter() {
    const campos = [
        'entradaData', 'fornecedorSelect', 'romaneioEntradaSelect',
        'plaquetaEntrada', 'custodiaEntrada', 'especieEntrada', 'diametroEntrada', 'comprimentoEntrada',
        'oco1Entrada', 'oco2Entrada', 'precoEntrada', 'm3BrutoEntrada', 'm3LiquidoEntrada',
        'compGeoEntrada', 'x1Entrada', 'x2Entrada', 'x3Entrada', 'x4Entrada'
    ];

    // Adicionar listener para cada campo
    campos.forEach((id, index) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    // Se for o último campo ou botão de adicionar
                    if (index === campos.length - 1) {
                         // Tentar clicar no botão adicionar
                         adicionarItemEntrada();
                    } else {
                        // Mover para o próximo campo
                        const nextId = campos[index + 1];
                        const nextEl = document.getElementById(nextId);
                        if (nextEl) nextEl.focus();
                    }
                }
            });
        }
    });

    // Listener especial para o botão "Adicionar Item" se focado via tab
    // Mas o fluxo acima já cobre inputs. O botão adicionarItemEntrada já foca em Plaqueta no final.
}

function atualizarSelectFornecedores() {
    const select = document.getElementById('fornecedorSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione um fornecedor</option>';

    // Adicionar listener para filtrar romaneios
    select.onchange = function(e) {
        const val = e.target.value;
        console.log("Fornecedor selecionado:", val);
        carregarRomaneiosParaSelect(val);
    };

    fornecedores.forEach(f => {
        const option = document.createElement('option');
        option.value = f.id;
        option.textContent = f.nome || f.name || 'Fornecedor sem nome';
        select.appendChild(option);
    });
}

function configurarEventos() {
    // Evento de submit da entrada
    const entradaForm = document.getElementById('entradaForm');
    if (entradaForm) entradaForm.addEventListener('submit', registrarEntrada);

    // Evento de submit da saída
    const saidaForm = document.getElementById('saidaForm');
    if (saidaForm) saidaForm.addEventListener('submit', registrarSaida);

    // Listener para novas espécies criadas pelo SpeciesManager
    window.addEventListener('species:updated', async (e) => {
        console.log("🌿 Nova espécie detectada:", e.detail);
        await carregarEspeciesEntrada(); // Recarregar lista

        // Se o evento tiver nome, preencher o campo
        if (e.detail && e.detail.nome) {
            const input = (typeof window.getActiveSpeciesAutocompleteInput === 'function' && window.getActiveSpeciesAutocompleteInput()) ||
                document.getElementById('especieEntrada');
            if (input) {
                input.value = normalizarNomeEspecieCadastrada(e.detail.nome);
                // Disparar evento de input para validações visuais se houver
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    });

    // Eventos de formatação monetária
    const camposMonetarios = ['precoEntrada'];
    camposMonetarios.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.addEventListener('blur', function() {
                this.value = formatCurrency(parseCurrencyValue(this.value));
            });
        }
    });

    configurarEventosCalculoAutomatico();
    configurarCamposEspecieAutocomplete();
    configurarBuscaPlaquetaSaida();
}

// Funções de navegação entre tabs
function showTab(tabName) {
    const targetTab = document.getElementById(tabName);
    if (!targetTab) {
        console.warn(`Aba '${tabName}' não encontrada.`);
        return;
    }

    // Ocultar todas as tabs
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));

    // Remover classe active de todas as tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));

    // Mostrar tab selecionada
    targetTab.classList.add('active');

    // Adicionar classe active na tab clicada
    const clicked = document.querySelector(`.tab[onclick="showTab('${tabName}')"]`);
    if (clicked && clicked.classList) clicked.classList.add('active');
    logEstoqueEvent('tab', `Aba ativada: ${tabName}`);

    // Carregar dados específicos da tab
    if (tabName === 'consulta') {
        atualizarEstatisticas();
        carregarTabelaEstoque();
    } else if (tabName === 'movimentacao') {
        carregarTabelaMovimentacoes();
    } else if (tabName === 'produtos' || tabName === 'entradaAlmoxarifado') {
        carregarEstoqueProdutos();
    }
}

// Funções de entrada de estoque

// --- Lógica de Romaneios ---
function getRomaneioIdFromTora(tora) {
    if (!tora) return '';
    const direto = tora.origemRomaneioId || tora.romaneioId || tora.romaneioID || tora.romaneioKey || tora.romaneio;
    if (direto && typeof direto !== 'object') return String(direto);
    const documento = String(tora.documento || '');
    const match = documento.match(/romaneio\s+(.+)$/i);
    return match && match[1] ? match[1].trim() : '';
}

function findRomaneioEntradaById(id) {
    const key = String(id || '').trim();
    if (!key) return null;
    return (romaneiosDisponiveis || []).find(r => {
        const keys = [r.id, r.firebaseKey, r.key, r.romaneioId, r.numero, r.numeroRomaneio].filter(Boolean).map(String);
        return keys.includes(key);
    }) || null;
}

function resolverFornecedorCadastro(id = '', nome = '') {
    const idStr = String(id || '').trim();
    const nomeKey = normalizarChaveEspecie(nome);
    return fornecedores.find((fornecedor) => {
        if (!fornecedor) return false;
        const ids = [fornecedor.id, fornecedor.firebaseKey, fornecedor.key, fornecedor.legacyId, fornecedor.oldId, fornecedor.codigo]
            .filter(Boolean)
            .map(String);
        if (idStr && ids.includes(idStr)) return true;
        const fornecedorNome = normalizarChaveEspecie(fornecedor.nome || fornecedor.name || fornecedor.razaoSocial || fornecedor.nomeFantasia || '');
        return !!nomeKey && !!fornecedorNome && fornecedorNome === nomeKey;
    }) || null;
}

function montarFornecedorInfo(id = '', nome = '') {
    const encontrado = resolverFornecedorCadastro(id, nome);
    if (encontrado) {
        return {
            id: String(encontrado.id || encontrado.firebaseKey || encontrado.key || id || ''),
            nome: String(encontrado.nome || encontrado.name || nome || '')
        };
    }
    return { id: String(id || '').trim(), nome: String(nome || '').trim() };
}

function obterIdEntidadeEstoque(obj = {}, fallback = '') {
    if (!obj || typeof obj !== 'object') return String(fallback || '').trim();
    return String(obj.id || obj.firebaseKey || obj.key || obj.legacyId || obj.oldId || obj.codigo || obj.code || fallback || '').trim();
}

function obterNomeEntidadeEstoque(obj = {}, fallback = '') {
    if (!obj || typeof obj !== 'object') return String(fallback || '').trim();
    return String(
        obj.nome ||
        obj.name ||
        obj.razaoSocial ||
        obj.razao_social ||
        obj.nomeFantasia ||
        obj.fantasia ||
        obj.displayName ||
        obj.label ||
        obj.title ||
        fallback ||
        ''
    ).trim();
}

function fornecedoresSaoCompativeis(a = {}, b = {}) {
    const idA = String(a.id || '').trim();
    const idB = String(b.id || '').trim();
    if (idA && idB && idA === idB) return true;
    const nomeA = normalizarChaveEspecie(a.nome || '');
    const nomeB = normalizarChaveEspecie(b.nome || '');
    return !!nomeA && !!nomeB && nomeA === nomeB;
}

function getFornecedorInfoFromRomaneio(romaneio) {
    if (!romaneio) return { id: '', nome: '' };
    if (romaneio.fornecedor && typeof romaneio.fornecedor === 'object') {
        return montarFornecedorInfo(
            obterIdEntidadeEstoque(romaneio.fornecedor),
            obterNomeEntidadeEstoque(romaneio.fornecedor)
        );
    }
    if (romaneio.cliente && typeof romaneio.cliente === 'object') {
        return montarFornecedorInfo(
            obterIdEntidadeEstoque(romaneio.cliente),
            obterNomeEntidadeEstoque(romaneio.cliente)
        );
    }
    if (romaneio.fornecedorId || romaneio.fornecedorNome) {
        return montarFornecedorInfo(romaneio.fornecedorId || '', romaneio.fornecedorNome || '');
    }
    if (romaneio.fornecedor && (typeof romaneio.fornecedor === 'string' || typeof romaneio.fornecedor === 'number')) {
        const raw = String(romaneio.fornecedor);
        return montarFornecedorInfo(raw, raw);
    }
    if (romaneio.cliente && (typeof romaneio.cliente === 'string' || typeof romaneio.cliente === 'number')) {
        const raw = String(romaneio.cliente);
        return montarFornecedorInfo(raw, raw);
    }
    return { id: '', nome: '' };
}

function getFornecedorInfoFromTora(tora, romaneio = null) {
    if (!tora) return getFornecedorInfoFromRomaneio(romaneio);
    if (tora.fornecedor && typeof tora.fornecedor === 'object') {
        return montarFornecedorInfo(
            obterIdEntidadeEstoque(tora.fornecedor, tora.fornecedorId || ''),
            obterNomeEntidadeEstoque(tora.fornecedor, tora.fornecedorNome || '')
        );
    }
    if (tora.fornecedorId || tora.fornecedorNome) {
        return montarFornecedorInfo(tora.fornecedorId || '', tora.fornecedorNome || '');
    }
    if (tora.fornecedor && (typeof tora.fornecedor === 'string' || typeof tora.fornecedor === 'number')) {
        const raw = String(tora.fornecedor);
        return montarFornecedorInfo(raw, raw);
    }
    if (tora.cliente && typeof tora.cliente === 'object') {
        return montarFornecedorInfo(
            obterIdEntidadeEstoque(tora.cliente, tora.clienteId || ''),
            obterNomeEntidadeEstoque(tora.cliente, tora.clienteNome || '')
        );
    }
    if (tora.cliente && (typeof tora.cliente === 'string' || typeof tora.cliente === 'number')) {
        const raw = String(tora.cliente);
        return montarFornecedorInfo(raw, raw);
    }
    return getFornecedorInfoFromRomaneio(romaneio);
}

function obterFornecedorDisplayTora(tora = {}, romaneio = null) {
    const info = getFornecedorInfoFromTora(tora, romaneio);
    const nome = String(info.nome || '').trim();
    const id = String(info.id || '').trim();
    if (nome) return nome;
    if (id) return id;
    if (tora && typeof tora.fornecedor === 'object') {
        return obterNomeEntidadeEstoque(tora.fornecedor, obterIdEntidadeEstoque(tora.fornecedor));
    }
    if (tora && typeof tora.fornecedor === 'string') return tora.fornecedor;
    if (tora && typeof tora.fornecedor === 'number') return String(tora.fornecedor);
    return String(tora.fornecedorNome || tora.fornecedorId || '-').trim() || '-';
}

function garantirFornecedorOption(info) {
    const select = document.getElementById('fornecedorSelect');
    if (!select || !info || !info.id) return;
    if (![...select.options].some(o => String(o.value) === String(info.id))) {
        const opt = document.createElement('option');
        opt.value = String(info.id);
        opt.text = info.nome || String(info.id);
        select.add(opt);
    }
}

function garantirRomaneioOption(romaneio, idFallback = '') {
    const select = document.getElementById('romaneioEntradaSelect');
    if (!select) return '';
    const id = String((romaneio && (romaneio.id || romaneio.firebaseKey || romaneio.key || romaneio.romaneioId)) || idFallback || '').trim();
    if (!id) return '';
    if (![...select.options].some(o => String(o.value) === id)) {
        const opt = document.createElement('option');
        opt.value = id;
        const numero = romaneio ? (romaneio.numero || romaneio.numeroRomaneio || id) : id;
        const data = romaneio && romaneio.data ? formatDate(String(romaneio.data).split('T')[0]) : '';
        opt.text = `${data ? `${data} - ` : ''}Romaneio: ${numero}`;
        select.add(opt);
    }
    return id;
}

async function carregarRomaneiosParaSelect(fornecedorIdFiltro = null) {
    const select = document.getElementById('romaneioEntradaSelect');
    if (!select) return;

    // Se o filtro for passado como evento (pode acontecer em alguns handlers), ignorar
    if (fornecedorIdFiltro && typeof fornecedorIdFiltro === 'object' && fornecedorIdFiltro.target) {
        fornecedorIdFiltro = fornecedorIdFiltro.target.value;
    }

    // Se não tiver dados cacheados, carregar (fallback)
    if (!romaneiosDisponiveis || romaneiosDisponiveis.length === 0) {
        select.innerHTML = '<option value="">Carregando...</option>';
        try {
            let romaneios = [];
            if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                const result = await window.firebaseService.loadFromFirebase('romaneios/tora');
                const data = result ? (result.data !== undefined ? result.data : result) : null;
                romaneios = normalizarRomaneiosEntradaEstoque(data);
            }
            // Filtrar e ordenar
            romaneiosDisponiveis = romaneios;
            romaneiosDisponiveis.sort((a, b) => obterTimestampRomaneioEstoque(b) - obterTimestampRomaneioEstoque(a));
        } catch (e) {
            console.error("Erro ao carregar romaneios (fallback):", e);
        }
    }

    // Filtrar por fornecedor se fornecido
    let listaExibicao = romaneiosDisponiveis;
    // Forçar conversão para string e remover espaços
    const filtroStr = String(fornecedorIdFiltro || '').trim();

    // Log para depuração
    console.log(`🔍 Filtrando romaneios. Filtro (ID): "${filtroStr}"`);

    if (filtroStr !== "") {
        // Encontrar o fornecedor selecionado para obter dados adicionais (Nome, Legacy IDs)
        const fornecedorSelecionado = fornecedores.find(f => String(f.id) === filtroStr);

        const nomeFornecedorFiltro = fornecedorSelecionado ? (fornecedorSelecionado.nome || fornecedorSelecionado.name || '').trim().toLowerCase() : '';
        // IDs alternativos para compatibilidade com legado
        const idsAlternativos = [];
        if (fornecedorSelecionado) {
             if (fornecedorSelecionado.legacyId) idsAlternativos.push(String(fornecedorSelecionado.legacyId));
             if (fornecedorSelecionado.oldId) idsAlternativos.push(String(fornecedorSelecionado.oldId));
             if (fornecedorSelecionado.codigo) idsAlternativos.push(String(fornecedorSelecionado.codigo));
        }

        console.log(`   Fornecedor Selecionado: ${nomeFornecedorFiltro} (IDs Alt: ${idsAlternativos.join(', ')})`);

        // Debug: Mostrar estrutura do primeiro romaneio para diagnóstico
        if (romaneiosDisponiveis.length > 0) {
            const sample = romaneiosDisponiveis[0];
            console.log("   [DEBUG] Estrutura do 1º Romaneio:", {
                id: sample.id,
                fornecedor: sample.fornecedor,
                fornecedorId: sample.fornecedorId,
                cliente: sample.cliente
            });
        }

        listaExibicao = romaneiosDisponiveis.filter(r => {
            // Tentar obter o ID do fornecedor do romaneio de todas as formas possíveis
            let rFornId = null;
            let rFornNome = null;

            // 1. Objeto fornecedor completo (Padrão romaneiotora.js)
            if (r.fornecedor && typeof r.fornecedor === 'object') {
                rFornId = r.fornecedor.id || r.fornecedor.firebaseKey;
                rFornNome = r.fornecedor.nome || r.fornecedor.name;
            }
            // 2. Propriedade direta fornecedorId (Padrão Estoque antigo)
            else if (r.fornecedorId) {
                rFornId = r.fornecedorId;
            }
            // 3. Propriedade direta fornecedor (se for ID string/number ou NOME)
            else if (r.fornecedor && (typeof r.fornecedor === 'string' || typeof r.fornecedor === 'number')) {
                rFornId = r.fornecedor;
                // Se parece um nome (contém letras e espaços, não é só número ou hash curto), usar como nome também
                if (typeof r.fornecedor === 'string' && r.fornecedor.length > 5 && isNaN(Number(r.fornecedor))) {
                    rFornNome = r.fornecedor;
                }
            }
            // 4. Fallback para 'cliente' (alguns módulos antigos usam cliente para fornecedor)
            else if (r.cliente && typeof r.cliente === 'object') {
                rFornId = r.cliente.id || r.cliente.firebaseKey;
                rFornNome = r.cliente.nome || r.cliente.name;
            }
            else if (r.clienteId) {
                rFornId = r.clienteId;
            }
            // 5. Fallback para 'cliente' string
            else if (r.cliente && typeof r.cliente === 'string') {
                rFornNome = r.cliente;
            }

            // Normalizar ID do romaneio para comparação
            const rFornIdStr = String(rFornId || '').trim();

            // 1ª Tentativa: Match por ID Principal
            if (rFornIdStr === filtroStr) return true;

            // 1.5ª Tentativa: Match por IDs Alternativos (Legado)
            if (idsAlternativos.some(altId => altId === rFornIdStr)) return true;

            // 2ª Tentativa: Match por Nome (se ID falhou e temos um nome para comparar)
            if (nomeFornecedorFiltro && rFornNome) {
                const rNomeLower = String(rFornNome).trim().toLowerCase();
                if (rNomeLower === nomeFornecedorFiltro) return true;
                // Match parcial seguro (nome do romaneio contém nome do filtro ou vice-versa)
                if (rNomeLower.includes(nomeFornecedorFiltro) || nomeFornecedorFiltro.includes(rNomeLower)) return true;
            }

            return false;
        });

        console.log(`   Resultados encontrados: ${listaExibicao.length}`);
    } else {
        console.log("   Sem filtro de fornecedor (exibindo todos)");
    }

    // Popular Select
    select.innerHTML = '<option value="">Selecione um romaneio</option>';

    if (listaExibicao.length === 0) {
        const opt = document.createElement('option');
        // Se estiver filtrando e não achou, avisa. Se não estiver filtrando e lista vazia, avisa.
        if (filtroStr !== "") {
            opt.text = "Nenhum romaneio para este fornecedor";
        } else {
            opt.text = "Nenhum romaneio disponível no sistema";
        }
        select.add(opt);
        return;
    }

    listaExibicao.forEach(r => {
        const opt = document.createElement('option');
        opt.value = obterIdRomaneioEntrada(r);
        const data = formatDate(obterDataRomaneioDisplay(r));

        // Tentar obter nome do fornecedor para exibição
        let nomeFornecedor = 'N/A';
        if (r.fornecedor && typeof r.fornecedor === 'object' && r.fornecedor.nome) {
            nomeFornecedor = r.fornecedor.nome;
        } else if (r.fornecedorNome) {
            nomeFornecedor = r.fornecedorNome;
        } else if (r.fornecedor && (typeof r.fornecedor === 'string' || typeof r.fornecedor === 'number')) {
            // Tentar achar na lista global de fornecedores
            const f = fornecedores.find(f => String(f.id) == String(r.fornecedor));
            nomeFornecedor = f ? (f.nome || f.name) : String(r.fornecedor);
        } else if (r.cliente && typeof r.cliente === 'object' && r.cliente.nome) {
            nomeFornecedor = r.cliente.nome; // Fallback para cliente
        } else if (r.cliente && typeof r.cliente === 'string') {
            nomeFornecedor = r.cliente;
        }

        const fornecedorInfo = getFornecedorInfoFromRomaneio(r);
        if (fornecedorInfo.nome || fornecedorInfo.id) {
            nomeFornecedor = fornecedorInfo.nome || fornecedorInfo.id;
        }

        const itens = obterItensRomaneioArray(r);
        const volumeTotal = itens.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || 0)), 0);
        const numero = obterNumeroRomaneioDisplay(r) || 'S/N';
        const labelParts = [
            data,
            nomeFornecedor || 'N/A',
            `Romaneio: ${numero}`,
            `${itens.length} itens (${formatNumber(volumeTotal, 3)} m³)`
        ].filter(part => String(part || '').trim() !== '');

        opt.text = labelParts.join(' - ');
        select.add(opt);
    });
}

async function carregarRomaneiosSaidaSelect() {
    const select = document.getElementById('romaneiosSaidaSelect');
    if (!select) return;

    const normalizeList = (raw, tipo) => {
        const utils = window.RomaneioDataUtils;
        const lista = utils && typeof utils.normalizeRomaneioCollection === 'function'
            ? utils.normalizeRomaneioCollection(raw, { type: tipo })
            : normalizarListaFirebaseEstoque(raw);
        return lista
            .filter(r => r && typeof r === 'object' && !isRegistroTecnicoFirebaseEstoque(r) && (r.id || r.firebaseKey))
            .map(r => ({ ...r, tipo: (r.tipo || tipo || '').toUpperCase(), id: r.id || r.firebaseKey }));
    };

    const loadFromFirebase = async (key) => {
        if (!window.firebaseService || typeof window.firebaseService.loadFromFirebase !== 'function') return null;
        const result = await window.firebaseService.loadFromFirebase(key);
        return result ? (result.data !== undefined ? result.data : result) : null;
    };

    let lista = [];
    try {
        const [pctRaw, tlRaw, pesRaw] = await Promise.all([
            loadFromFirebase('romaneios/pct'),
            loadFromFirebase('romaneios/tl'),
            loadFromFirebase('romaneios/pes')
        ]);
        lista = [
            ...normalizeList(pctRaw, 'PCT'),
            ...normalizeList(tlRaw, 'TL'),
            ...normalizeList(pesRaw, 'PES')
        ];
    } catch (_) {}

    romaneiosSaidaDisponiveis = lista;
    select.innerHTML = '';
    if (lista.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.text = 'Nenhum romaneio disponível';
        select.add(opt);
        return;
    }

    const formatDataBR = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        return dt.toLocaleDateString('pt-BR');
    };
    const getRomaneioDate = (r) => obterDataRomaneioDisplay(r) || 0;
    const getRomaneioPessoa = (r) => {
        const info = getFornecedorInfoFromRomaneio(r);
        return String(r?.clienteNome || r?.fornecedorNome || info.nome || info.id || 'N/A');
    };
    const getRomaneioItens = (r) => {
        const itensRaw = r ? (r.itens || r.items || r.romaneioItems || []) : [];
        return Array.isArray(itensRaw) ? itensRaw : (itensRaw && typeof itensRaw === 'object' ? Object.values(itensRaw) : []);
    };
    const getRomaneioVolume = (r) => {
        if (!r) return 0;
        const itens = getRomaneioItens(r);
        return Number(
            (r.totais && (r.totais.volumeSerraria || r.totais.volumeTotal || r.totais.volume)) ||
            r.totalVolume ||
            r.volumeSerraria ||
            r.volumeTotal ||
            r.volume ||
            itens.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || i.volumeTotal || i.volume || 0) || 0), 0)
        ) || 0;
    };
    const getRomaneioValor = (r) => {
        if (!r) return 0;
        const itens = getRomaneioItens(r);
        return Number(
            (r.totais && (r.totais.valorTotal || r.totais.valor)) ||
            r.totalValor ||
            r.valorTotal ||
            r.valor ||
            itens.reduce((acc, i) => acc + (parseFloat(i.valorTotal || i.valor || i.total || i.precoTotal || 0) || 0), 0)
        ) || 0;
    };
    const formatRomaneioLabelDetalhado = (r) => {
        const data = formatDataBR(getRomaneioDate(r));
        const pessoa = getRomaneioPessoa(r);
        const vol = getRomaneioVolume(r);
        const valor = getRomaneioValor(r);
        const numero = obterNumeroRomaneioDisplay(r);
        const tipo = String(r.tipo || '').toUpperCase();
        const prefixo = [tipo, numero].filter(Boolean).join(' ');
        return [prefixo, data, pessoa, `${formatNumber(vol, 3)} m³`, formatCurrency(valor)]
            .filter(part => String(part || '').trim() !== '')
            .join(' - ');
    };

    lista.sort((a, b) => obterTimestampRomaneioEstoque(b) - obterTimestampRomaneioEstoque(a));
    lista.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.dataset.tipo = r.tipo || '';
        opt.dataset.numero = obterNumeroRomaneioDisplay(r);
        opt.text = formatRomaneioLabelDetalhado(r);
        select.add(opt);
    });
    renderizarRomaneiosSaidaSelecionados();
}

function carregarItensDoRomaneioSelecionado() {
    const select = document.getElementById('romaneioEntradaSelect');
    const id = select.value;

    if (!id) {
        alert('Selecione um romaneio primeiro.');
        return;
    }

    const romaneio = findRomaneioEntradaById(id);
    if (!romaneio) {
        alert('Romaneio não encontrado. Recarregue a página e tente novamente.');
        return;
    }

    // Tentar preencher fornecedor se não estiver selecionado
    const selectForn = document.getElementById('fornecedorSelect');
    const fornecedorRomaneio = getFornecedorInfoFromRomaneio(romaneio);
    if (selectForn && selectForn.value === "" && fornecedorRomaneio.id) {
        garantirFornecedorOption(fornecedorRomaneio);
        selectForn.value = fornecedorRomaneio.id;
    }

    if (romaneio.data) {
        document.getElementById('entradaData').value = romaneio.data.split('T')[0];
    }

    romaneioSelecionadoId = id;

    // Adicionar itens à tabela de entrada
    if (romaneio.itens) {
        let itensArray = Array.isArray(romaneio.itens) ? romaneio.itens : Object.values(romaneio.itens);

        // Filtrar itens inválidos para evitar linhas vazias na tabela
        itensArray = itensArray.filter(item => item && typeof item === 'object');

        if (itensArray.length > 0) {
            // Converter itens do romaneio para formato de estoque/tabela
            const novosItens = itensArray.map(item => {
                const geo = normalizarCamposGeoEstoque(item);
                const volumeLiquido = parseFloat(item.volumeLiquido || item.volumeSerraria || 0) || 0;
                const preco = parseFloat(item.preco || item.precoCusto || 0) || 0;
                return {
                    ...item,
                    ...geo,
                    id: generateUniqueId('ITEM'), // Novo ID para o estoque
                    origemRomaneioId: id,
                    especie: normalizarNomeEspecieCadastrada(item.especie || item.nomeEspecie || item.species || ''),
                    // Garantir campos
                    volumeLiquido,
                    volumeBruto: parseFloat(item.volumeBruto || 0) || 0,
                    preco,
                    valor: parseFloat(item.valor || (volumeLiquido * preco) || 0) || 0
                };
            });

            itensEntrada = [...itensEntrada, ...novosItens];
            paginaAtualEntrada = 1; // Resetar paginação ao carregar novos itens
            renderizarTabelaEntrada();
            alert(`Carregados ${novosItens.length} itens do romaneio.`);
        } else {
            alert('Este romaneio não possui itens.');
        }
    } else {
        alert('Este romaneio não possui itens.');
    }
}

// --- Lógica Manual ---
async function adicionarItemEntrada() {
    if (toraEmEdicao) {
        await atualizarToraEditada();
        return;
    }

    const plaqueta = String(document.getElementById('plaquetaEntrada').value || '').trim();
    if (!plaqueta) {
        alert('Informe a plaqueta.');
        return;
    }
    const toraExistente = encontrarToraPorPlaqueta(plaqueta);
    if (toraExistente || itemEntradaTemPlaqueta(plaqueta)) {
        alert('Já existe uma tora com esta plaqueta no estoque ou na lista de entrada. Verifique antes de adicionar.');
        return;
    }
    const especieValidacao = validarEspecieEntrada(document.getElementById('especieEntrada').value, true);
    if (!especieValidacao.ok) return;
    const especie = especieValidacao.nome;
    document.getElementById('especieEntrada').value = especie;
    calcularVolumesAutomatico();
    const diametro = parseFloat(document.getElementById('diametroEntrada').value) || 0;
    const comprimento = parseFloat(document.getElementById('comprimentoEntrada').value) || 0;
    const oco1 = parseFloat(document.getElementById('oco1Entrada').value) || 0;
    const oco2 = parseFloat(document.getElementById('oco2Entrada').value) || 0;
    const preco = parseCurrencyValue(document.getElementById('precoEntrada').value);
    const geo = obterCamposGeoEntrada();

    // Novos campos M3
    let volBrutoInput = parseFloat(document.getElementById('m3BrutoEntrada').value) || 0;
    let volLiqInput = parseFloat(document.getElementById('m3LiquidoEntrada').value) || 0;

    // Cálculos
    // Se dimensões forem fornecidas, calcular. Se não, usar inputs manuais de volume se existirem.
    let volBruto = 0;
    let volLiq = 0;
    let desconto = 0;

    if (diametro > 0 && comprimento > 0) {
        volBruto = calcularVolumeTora(diametro, comprimento);
        desconto = calcularDescontoOco(oco1, oco2, comprimento);
        volLiq = Math.max(0, volBruto - desconto);
    } else {
        // Usar valores manuais se dimensões não forem completas
        volBruto = volBrutoInput;
        volLiq = volLiqInput;
        desconto = Math.max(0, volBruto - volLiq);
    }

    // Se o usuário digitou volumes manualmente e são diferentes do calculado, respeitar o manual?
    // Vamos priorizar o input manual se ele foi preenchido explicitamente e é diferente de 0,
    // ou se não houve cálculo por falta de dimensões.
    // Mas se calculou, atualiza os inputs?
    // Melhor: se calculou, usa o calculado. Opcionalmente poderia atualizar os inputs visuais antes de adicionar.

    const valorTotal = volLiq * preco;

    const item = {
        id: generateUniqueId('MANUAL'),
        plaqueta,
        ...geo,
        especie,
        diametro, rodo: diametro,
        comprimento,
        oco1,
        oco2,
        volumeBruto: volBruto,
        volumeDesconto: desconto,
        desconto: desconto,
        volumeLiquido: volLiq,
        volumeSerraria: volLiq,
        precoCusto: preco,
        preco: preco,
        valor: valorTotal,
        localizacao: '', // Campo removido do formulário
        origem: romaneioSelecionadoId ? 'manual_com_romaneio' : 'manual',
        origemRomaneioId: romaneioSelecionadoId || null
    };

    itensEntrada.push(item);
    renderizarTabelaEntrada();
    limparCamposEntrada();
}

async function atualizarToraEditada() {
    if (!toraEmEdicao) return;

    const original = toraEmEdicao;
    const especieValidacao = validarEspecieEntrada(document.getElementById('especieEntrada').value, true);
    if (!especieValidacao.ok) return;

    const plaqueta = String(document.getElementById('plaquetaEntrada').value || '').trim();
    if (!plaqueta) {
        alert('Informe a plaqueta.');
        return;
    }
    const toraDuplicada = encontrarToraPorPlaqueta(plaqueta, original.id);
    if (toraDuplicada) {
        alert(`Já existe outra tora com a plaqueta "${plaqueta}". Ajuste a plaqueta antes de atualizar.`);
        return;
    }

    calcularVolumesAutomatico();
    const diametro = parseFloat(document.getElementById('diametroEntrada').value) || 0;
    const comprimento = parseFloat(document.getElementById('comprimentoEntrada').value) || 0;
    const oco1 = parseFloat(document.getElementById('oco1Entrada').value) || 0;
    const oco2 = parseFloat(document.getElementById('oco2Entrada').value) || 0;
    const preco = parseCurrencyValue(document.getElementById('precoEntrada').value);
    const geo = obterCamposGeoEntrada();
    const dataEntrada = document.getElementById('entradaData').value || original.data || new Date().toISOString().split('T')[0];

    let volBruto = parseFloat(document.getElementById('m3BrutoEntrada').value) || 0;
    let volLiq = parseFloat(document.getElementById('m3LiquidoEntrada').value) || 0;
    let desconto = Math.max(0, volBruto - volLiq);

    if (diametro > 0 && comprimento > 0) {
        volBruto = calcularVolumeTora(diametro, comprimento);
        desconto = calcularDescontoOco(oco1, oco2, comprimento);
        volLiq = Math.max(0, volBruto - desconto);
    }

    const romaneioIdOriginal = getRomaneioIdFromTora(original);
    const romaneioSelect = document.getElementById('romaneioEntradaSelect');
    const romaneioId = String(romaneioSelect ? romaneioSelect.value : (romaneioIdOriginal || '')).trim();
    const romaneio = findRomaneioEntradaById(romaneioId);
    const fornecedorOriginal = getFornecedorInfoFromTora(original, romaneio);
    const fornecedorRomaneio = getFornecedorInfoFromRomaneio(romaneio);
    const fornecedorSelect = document.getElementById('fornecedorSelect');
    const fornecedorSelecionadoId = String(fornecedorSelect ? fornecedorSelect.value : '').trim();
    const fornecedorBase = fornecedorSelecionadoId
        ? montarFornecedorInfo(fornecedorSelecionadoId, '')
        : ((fornecedorRomaneio.id || fornecedorRomaneio.nome) ? fornecedorRomaneio : fornecedorOriginal);
    const fornecedorInfo = montarFornecedorInfo(fornecedorBase.id, fornecedorBase.nome);
    const fornecedorId = String(fornecedorInfo.id || '').trim();
    const fornecedorNome = String(fornecedorInfo.nome || fornecedorId || '').trim();

    if (romaneio && fornecedorId && (fornecedorRomaneio.id || fornecedorRomaneio.nome) && !fornecedoresSaoCompativeis({ id: fornecedorId, nome: fornecedorNome }, fornecedorRomaneio)) {
        alert('O fornecedor selecionado não corresponde ao fornecedor do romaneio. Selecione o fornecedor correto ou deixe o romaneio em branco.');
        return;
    }

    const documentoAtualizado = romaneioId
        ? `Romaneio ${romaneioId}`
        : (String(original.documento || '').toLowerCase().includes('romaneio') ? 'Entrada Manual' : (original.documento || 'Entrada Manual'));
    const updatedAt = new Date().toISOString();

    const atualizado = {
        ...original,
        data: dataEntrada,
        plaqueta,
        ...geo,
        especie: especieValidacao.nome,
        diametro,
        rodo: diametro,
        comprimento,
        oco1,
        oco2,
        precoCusto: preco,
        preco,
        volumeBruto: volBruto,
        volumeDesconto: desconto,
        desconto,
        volumeLiquido: volLiq,
        volumeSerraria: volLiq,
        valor: volLiq * preco,
        documento: documentoAtualizado,
        origemRomaneioId: romaneioId || null,
        updatedAt
    };

    if (fornecedorId) {
        atualizado.fornecedorId = fornecedorId;
        atualizado.fornecedor = { id: fornecedorId, nome: fornecedorNome || fornecedorId };
    }

    const idx = estoqueAtual.findIndex(t => String(t.id) === String(original.id));
    const estoqueAtualizadoLocal = estoqueAtual.slice();
    if (idx >= 0) estoqueAtualizadoLocal[idx] = atualizado;

    const movIdx = movimentacoes.findIndex(m => String(m.toraId) === String(original.id) && String(m.tipo || '').toLowerCase() === 'entrada');
    const movimentacoesAtualizadasLocal = movimentacoes.slice();
    let movimentacaoAtualizada = null;
    if (movIdx >= 0) {
        movimentacaoAtualizada = {
            ...movimentacoes[movIdx],
            data: dataEntrada,
            plaqueta,
            especie: especieValidacao.nome,
            volume: volLiq,
            ...geo,
            documento: documentoAtualizado,
            updatedAt
        };
        movimentacoesAtualizadasLocal[movIdx] = movimentacaoAtualizada;
    }

    try {
        showLoading('Atualizando tora...');
        const updates = { [`estoqueTorasAtual/${atualizado.id}`]: atualizado };
        if (movimentacaoAtualizada && movimentacaoAtualizada.id) {
            updates[`movimentacoesToras/${movimentacaoAtualizada.id}`] = movimentacaoAtualizada;
        }

        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            await window.firebaseService.updatePaths(updates);
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            await window.firebaseService.saveToFirebase('estoqueTorasAtual', String(atualizado.id), atualizado);
            if (movimentacaoAtualizada && movimentacaoAtualizada.id) {
                await window.firebaseService.saveToFirebase('movimentacoesToras', String(movimentacaoAtualizada.id), movimentacaoAtualizada);
            }
        } else {
            await saveDataAsync('estoqueTorasAtual', estoqueAtualizadoLocal);
            if (movimentacaoAtualizada) await saveDataAsync('movimentacoesToras', movimentacoesAtualizadasLocal);
        }

        estoqueAtual = estoqueAtualizadoLocal;
        movimentacoes = movimentacoesAtualizadasLocal;
        hideLoading();
        alert('Tora atualizada com sucesso.');
        toraEmEdicao = null;
        setModoEdicaoEntrada(null);
        limparCamposEntrada(true);
        atualizarEstatisticas();
        carregarTabelaEstoque(filtroEstoqueAtual);
        atualizarFiltros();
        showTab('consulta');
    } catch (error) {
        hideLoading();
        console.error('Erro ao atualizar tora:', error);
        alert('Erro ao atualizar tora: ' + error.message);
    }
}

function limparCamposEntrada(resetPersisted = false) {
    // Helper para limpar com segurança
    const safeClear = (id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    };

    // Manter persistência temporária de Data, Fornecedor e Espécie
    safeClear('plaquetaEntrada');
    safeClear('custodiaEntrada');
    if (resetPersisted) {
        safeClear('especieEntrada');
        safeClear('precoEntrada');
        safeClear('fornecedorSelect');
        safeClear('romaneioEntradaSelect');
        romaneioSelecionadoId = null;
    }
    // document.getElementById('especieEntrada').value = ''; // Mantido quando resetPersisted=false
    // document.getElementById('entradaData').value = ''; // Mantido
    // document.getElementById('fornecedorSelect').value = ''; // Mantido quando resetPersisted=false

    safeClear('diametroEntrada');
    safeClear('comprimentoEntrada');
    safeClear('oco1Entrada');
    safeClear('oco2Entrada');
    safeClear('m3BrutoEntrada');
    safeClear('m3LiquidoEntrada');
    safeClear('compGeoEntrada');
    safeClear('x1Entrada');
    safeClear('x2Entrada');
    safeClear('x3Entrada');
    safeClear('x4Entrada');
    const volumeGeoEl = document.getElementById('volumeGeoEntrada');
    if (volumeGeoEl) volumeGeoEl.value = '0.000';
    // Preço mantido

    const plaqueta = document.getElementById('plaquetaEntrada');
    if (plaqueta) plaqueta.focus();

    const aviso = document.getElementById('editToraAviso');
    if (aviso) aviso.style.display = 'none';
    toraEmEdicao = null;
    setModoEdicaoEntrada(null);
}

function abrirHistoricoEstoque() {
    showTab('movimentacao');
}

function obterUsuarioPreferenciaEstoque() {
    try {
        const user = window.firebaseAuthUser || (window.firebaseService && window.firebaseService.authService && window.firebaseService.authService.getAuth && window.firebaseService.authService.getAuth().currentUser);
        if (user && user.uid) return String(user.uid);
    } catch (_) {}
    try {
        const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
        const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
        return String(current.uid || current.id || current.userId || persistent.uid || persistent.id || persistent.userId || 'anon');
    } catch (_) {}
    return 'anon';
}

function obterChavePreferenciaEstoque(sufixo) {
    return `estoque_${resolveCompanyId() || 'default'}_${obterUsuarioPreferenciaEstoque()}_${sufixo}`;
}

function carregarItensPorPaginaTabela(scope) {
    const key = obterChavePreferenciaEstoque(`items_per_page_${scope}`);
    let value = 0;
    try { value = parseInt(localStorage.getItem(key) || '', 10); } catch (_) {}
    if (!ESTOQUE_PAGE_SIZE_OPTIONS.includes(value)) value = ESTOQUE_PAGE_SIZE_DEFAULT;
    estoqueItensPorPagina[scope] = value;
    return value;
}

function obterItensPorPaginaTabela(scope) {
    if (!scope) return ESTOQUE_PAGE_SIZE_DEFAULT;
    if (!estoqueItensPorPagina[scope]) return carregarItensPorPaginaTabela(scope);
    return estoqueItensPorPagina[scope];
}

function atualizarItensPorPaginaTabela(scope, value) {
    const size = parseInt(value, 10);
    if (!ESTOQUE_PAGE_SIZE_OPTIONS.includes(size)) return;
    estoqueItensPorPagina[scope] = size;
    try { localStorage.setItem(obterChavePreferenciaEstoque(`items_per_page_${scope}`), String(size)); } catch (_) {}
    if (scope === 'entrada') {
        paginaAtualEntrada = 1;
        renderizarTabelaEntrada();
    } else if (scope === 'saida') {
        paginaAtualSaida = 1;
        atualizarTabelaTorasSaida();
    } else if (scope === 'consulta') {
        paginaAtualEstoque = 1;
        carregarTabelaEstoque(filtroEstoqueAtual);
    } else if (scope === 'movimentacoes') {
        paginaAtualMovimentacoes = 1;
        carregarTabelaMovimentacoes(filtroMovimentacoesAtual);
    } else if (scope === 'produtos') {
        if (typeof paginaAtualProdutos !== 'undefined') paginaAtualProdutos = 1;
        if (typeof renderizarTabelaProdutos === 'function') renderizarTabelaProdutos();
    }
}

function renderizarPaginacaoPadrao(containerId, totalItems, paginaAtual, itensPorPagina, onPageFn, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const sizeScope = options.sizeScope || '';
    const pageSize = sizeScope ? obterItensPorPaginaTabela(sizeScope) : itensPorPagina;
    const totalPaginas = Math.ceil(totalItems / pageSize);
    if ((!totalPaginas || totalPaginas <= 1) && !sizeScope) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = '';
    if (sizeScope && totalItems > 0) {
        const label = document.createElement('label');
        label.className = 'pagination-size-control';
        label.innerHTML = `
            <span>Itens por página:</span>
            <select onchange="atualizarItensPorPaginaTabela('${sizeScope}', this.value)">
                ${ESTOQUE_PAGE_SIZE_OPTIONS.map(opt => `<option value="${opt}" ${opt === pageSize ? 'selected' : ''}>${opt}</option>`).join('')}
            </select>
        `;
        container.appendChild(label);
    }
    if (!totalPaginas || totalPaginas <= 1) return;
    const handler = (typeof onPageFn === 'function') ? onPageFn : window[onPageFn];
    const buttonsHost = document.createElement('span');
    buttonsHost.className = 'pagination-page-buttons';
    container.appendChild(buttonsHost);
    const addBtn = (label, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (active) btn.classList.add('active');
        btn.disabled = disabled;
        btn.onclick = () => { if (typeof handler === 'function') handler(page); };
        buttonsHost.appendChild(btn);
    };

    addBtn('<<<', 1, paginaAtual === 1);
    addBtn('<', paginaAtual - 1, paginaAtual === 1);

    const startPage = Math.max(1, paginaAtual - 2);
    const endPage = Math.min(totalPaginas, paginaAtual + 2);

    if (startPage > 1) {
        addBtn('1', 1, false, paginaAtual === 1);
        if (startPage > 2) {
            const span = document.createElement('span');
            span.textContent = '...';
            buttonsHost.appendChild(span);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addBtn(String(i), i, false, i === paginaAtual);
    }

    if (endPage < totalPaginas) {
        if (endPage < totalPaginas - 1) {
            const span = document.createElement('span');
            span.textContent = '...';
            buttonsHost.appendChild(span);
        }
        addBtn(String(totalPaginas), totalPaginas, false, paginaAtual === totalPaginas);
    }

    addBtn('>', paginaAtual + 1, paginaAtual === totalPaginas);
    addBtn('>>>', totalPaginas, paginaAtual === totalPaginas);
}

function getEntradaColumnsDefs() {
    return [
        { key: 'plaqueta', label: 'Plaqueta' },
        { key: 'custodia', label: 'Custódia' },
        { key: 'especie', label: 'Espécie' },
        { key: 'diametro', label: 'Rodo' },
        { key: 'comprimento', label: 'Comprimento' },
        { key: 'oco1', label: 'Oco 1' },
        { key: 'oco2', label: 'Oco 2' },
        { key: 'desconto', label: 'Desconto' },
        { key: 'volumeLiquido', label: 'M³ Líquido' },
        { key: 'compGeo', label: 'Comp. Geo.' },
        { key: 'x1', label: 'X1' },
        { key: 'x2', label: 'X2' },
        { key: 'x3', label: 'X3' },
        { key: 'x4', label: 'X4' },
        { key: 'volumeGeo', label: 'V. Geo.' },
        { key: 'preco', label: 'Preço' },
        { key: 'valor', label: 'Valor' }
    ];
}

function getEntradaColumnsStorageKey() {
    return obterChavePreferenciaEstoque('entrada_columns');
}

function getEntradaColumnsRemotePath() {
    const uid = obterUsuarioPreferenciaEstoque();
    const tenant = resolveCompanyId() || 'default';
    return `users/${uid}/preferences/estoqueEntradaColumns/${tenant}`;
}

function getDefaultEntradaColumnsConfig() {
    const cfg = {};
    getEntradaColumnsDefs().forEach(d => { cfg[d.key] = true; });
    return cfg;
}

function getEntradaColumnsConfigSync() {
    const defaults = getDefaultEntradaColumnsConfig();
    try {
        const raw = localStorage.getItem(getEntradaColumnsStorageKey());
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaults;
        const normalized = { ...defaults };
        getEntradaColumnsDefs().forEach(d => {
            if (Object.prototype.hasOwnProperty.call(parsed, d.key)) {
                normalized[d.key] = parsed[d.key] !== false;
            }
        });
        if (getEntradaColumnsDefs().every(d => normalized[d.key] === false)) {
            normalized[getEntradaColumnsDefs()[0].key] = true;
        }
        return normalized;
    } catch (_) {
        return defaults;
    }
}

async function ensureEntradaColumnsConfigLoaded() {
    try {
        if (localStorage.getItem(getEntradaColumnsStorageKey())) return;
    } catch (_) {}
    try {
        if (obterUsuarioPreferenciaEstoque() !== 'anon' && typeof window.getData === 'function') {
            const remote = await window.getData(getEntradaColumnsRemotePath(), { debounceMs: 0 });
            if (remote && typeof remote === 'object') {
                localStorage.setItem(getEntradaColumnsStorageKey(), JSON.stringify(remote));
            }
        }
    } catch (_) {}
}

function getVisibleEntradaColumnsCount() {
    const cfg = getEntradaColumnsConfigSync();
    return getEntradaColumnsDefs().filter(d => cfg[d.key] !== false).length;
}

function applyEntradaColumnsConfig() {
    const table = document.getElementById('tabelaEntrada');
    if (!table) return;
    const cfg = getEntradaColumnsConfigSync();
    getEntradaColumnsDefs().forEach(d => {
        const visible = cfg[d.key] !== false;
        table.querySelectorAll(`[data-col="${d.key}"]`).forEach(el => {
            el.style.display = visible ? '' : 'none';
        });
    });
}

async function saveEntradaColumnsConfig(config = {}) {
    const defs = getEntradaColumnsDefs();
    const sanitized = {};
    defs.forEach(d => { sanitized[d.key] = config[d.key] !== false; });
    if (defs.length && defs.every(d => sanitized[d.key] === false)) {
        sanitized[defs[0].key] = true;
    }
    try { localStorage.setItem(getEntradaColumnsStorageKey(), JSON.stringify(sanitized)); } catch (_) {}
    try {
        if (obterUsuarioPreferenciaEstoque() !== 'anon' && typeof window.saveData === 'function') {
            await window.saveData(getEntradaColumnsRemotePath(), sanitized, { debounceMs: 0, showToast: false });
        }
    } catch (_) {}
    applyEntradaColumnsConfig();
    return sanitized;
}

function atualizarEstadoTodasColunasEntrada() {
    const master = document.getElementById('entradaColumnsSelectAll');
    const checks = Array.from(document.querySelectorAll('#entradaColumnsConfigModal .report-col-check'));
    if (!master || checks.length === 0) return;
    const checkedCount = checks.filter(cb => cb.checked).length;
    master.checked = checkedCount === checks.length;
    master.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

function toggleTodasColunasEntrada(checked) {
    document.querySelectorAll('#entradaColumnsConfigModal .report-col-check').forEach(cb => {
        cb.checked = !!checked;
    });
    atualizarEstadoTodasColunasEntrada();
}

async function abrirConfiguracaoColunasEntrada() {
    await ensureEntradaColumnsConfigLoaded();
    if (!document.getElementById('entradaColumnsConfigModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="entradaColumnsConfigModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-list"></i> Colunas da Entrada</h3>
                        <span class="close-modal" onclick="fecharConfiguracaoColunasEntrada()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div style="color:#64748b; font-size:13px; margin-bottom:10px;">Escolha as colunas visíveis na tabela de itens para entrada.</div>
                        <label class="report-col-item" style="margin-bottom:10px;">
                            <input type="checkbox" id="entradaColumnsSelectAll" onchange="toggleTodasColunasEntrada(this.checked)">
                            <span class="report-col-label"><strong>Selecionar todas as colunas</strong></span>
                        </label>
                        <div id="entradaColumnsConfigList"></div>
                    </div>
                    <div class="modal-footer" style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-secondary" id="entradaColsResetBtn"><i class="fas fa-undo"></i> Restaurar Padrão</button>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-secondary" onclick="fecharConfiguracaoColunasEntrada()"><i class="fas fa-times"></i> Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="salvarConfiguracaoColunasEntrada()"><i class="fas fa-check"></i> Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        const modalEl = document.getElementById('entradaColumnsConfigModal');
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) fecharConfiguracaoColunasEntrada();
            });
        }
        const resetBtn = document.getElementById('entradaColsResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const defaults = getDefaultEntradaColumnsConfig();
                document.querySelectorAll('#entradaColumnsConfigModal .report-col-check').forEach(cb => {
                    const key = cb.getAttribute('data-col');
                    cb.checked = defaults[key] !== false;
                });
                atualizarEstadoTodasColunasEntrada();
            });
        }
    }

    const defs = getEntradaColumnsDefs();
    const cfg = getEntradaColumnsConfigSync();
    const list = document.getElementById('entradaColumnsConfigList');
    if (list) {
        list.innerHTML = `<div class="report-col-grid">${defs.map(d => `
            <label class="report-col-item">
                <input type="checkbox" class="report-col-check" data-col="${escapeHtml(d.key)}" ${cfg[d.key] !== false ? 'checked' : ''} onchange="atualizarEstadoTodasColunasEntrada()">
                <span class="report-col-label">${escapeHtml(d.label)}</span>
            </label>
        `).join('')}</div>`;
    }
    atualizarEstadoTodasColunasEntrada();
    const modal = document.getElementById('entradaColumnsConfigModal');
    if (modal) modal.style.display = 'block';
}

function fecharConfiguracaoColunasEntrada() {
    const modal = document.getElementById('entradaColumnsConfigModal');
    if (modal) modal.style.display = 'none';
}

async function salvarConfiguracaoColunasEntrada() {
    const cfg = {};
    getEntradaColumnsDefs().forEach(d => { cfg[d.key] = true; });
    document.querySelectorAll('#entradaColumnsConfigModal .report-col-check').forEach(cb => {
        const key = cb.getAttribute('data-col');
        if (key) cfg[key] = !!cb.checked;
    });
    await saveEntradaColumnsConfig(cfg);
    fecharConfiguracaoColunasEntrada();
    renderizarTabelaEntrada();
}

window.abrirConfiguracaoColunasEntrada = abrirConfiguracaoColunasEntrada;
window.fecharConfiguracaoColunasEntrada = fecharConfiguracaoColunasEntrada;
window.salvarConfiguracaoColunasEntrada = salvarConfiguracaoColunasEntrada;
window.toggleTodasColunasEntrada = toggleTodasColunasEntrada;
window.atualizarEstadoTodasColunasEntrada = atualizarEstadoTodasColunasEntrada;

function getSaidaColumnsDefs() {
    return [
        { key: 'plaqueta', label: 'Plaqueta' },
        { key: 'custodia', label: 'Custódia' },
        { key: 'especie', label: 'Espécie' },
        { key: 'diametro', label: 'Rodo', align: 'text-center' },
        { key: 'comprimento', label: 'Comprimento', align: 'text-center' },
        { key: 'oco1', label: 'Oco 1', align: 'text-center' },
        { key: 'oco2', label: 'Oco 2', align: 'text-center' },
        { key: 'volumeDesconto', label: 'Desconto', align: 'text-center' },
        { key: 'volumeLiquido', label: 'M³ Líquido', align: 'text-right' },
        { key: 'compGeo', label: 'Comp. Geo.', align: 'text-center' },
        { key: 'x1', label: 'X1', align: 'text-center' },
        { key: 'x2', label: 'X2', align: 'text-center' },
        { key: 'x3', label: 'X3', align: 'text-center' },
        { key: 'x4', label: 'X4', align: 'text-center' },
        { key: 'volumeGeo', label: 'V. Geo.', align: 'text-right' },
        { key: 'precoCusto', label: 'Preço', align: 'text-right' },
        { key: 'valor', label: 'Valor', align: 'text-right' },
        { key: 'localizacao', label: 'Localização' }
    ];
}

function getSaidaColumnsStorageKey() {
    return obterChavePreferenciaEstoque('saida_columns');
}

function getSaidaColumnsRemotePath() {
    const uid = obterUsuarioPreferenciaEstoque();
    const tenant = resolveCompanyId() || 'default';
    return `users/${uid}/preferences/estoqueSaidaColumns/${tenant}`;
}

function getDefaultSaidaColumnsConfig() {
    const cfg = {};
    getSaidaColumnsDefs().forEach(d => { cfg[d.key] = true; });
    return cfg;
}

function getSaidaColumnsConfigSync() {
    const defaults = getDefaultSaidaColumnsConfig();
    try {
        const raw = localStorage.getItem(getSaidaColumnsStorageKey());
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaults;
        const normalized = { ...defaults };
        const defs = getSaidaColumnsDefs();
        defs.forEach(d => {
            if (Object.prototype.hasOwnProperty.call(parsed, d.key)) {
                normalized[d.key] = parsed[d.key] !== false;
            }
        });
        if (defs.length && defs.every(d => normalized[d.key] === false)) {
            normalized[defs[0].key] = true;
        }
        return normalized;
    } catch (_) {
        return defaults;
    }
}

async function ensureSaidaColumnsConfigLoaded() {
    try {
        if (localStorage.getItem(getSaidaColumnsStorageKey())) return;
    } catch (_) {}
    try {
        if (obterUsuarioPreferenciaEstoque() !== 'anon' && typeof window.getData === 'function') {
            const remote = await window.getData(getSaidaColumnsRemotePath(), { debounceMs: 0 });
            if (remote && typeof remote === 'object') {
                localStorage.setItem(getSaidaColumnsStorageKey(), JSON.stringify(remote));
            }
        }
    } catch (_) {}
}

function getVisibleSaidaColumns() {
    const cfg = getSaidaColumnsConfigSync();
    const defs = getSaidaColumnsDefs();
    const visible = defs.filter(d => cfg[d.key] !== false);
    return visible.length ? visible : defs.slice(0, 1);
}

function getVisibleSaidaColumnsCount() {
    return getVisibleSaidaColumns().length;
}

function applySaidaColumnsConfig() {
    const table = document.getElementById('tabelaSaidaToras');
    if (!table) return;
    const cfg = getSaidaColumnsConfigSync();
    getSaidaColumnsDefs().forEach(d => {
        const visible = cfg[d.key] !== false;
        table.querySelectorAll(`[data-col="${d.key}"]`).forEach(el => {
            el.style.display = visible ? '' : 'none';
        });
    });
}

async function saveSaidaColumnsConfig(config = {}) {
    const defs = getSaidaColumnsDefs();
    const sanitized = {};
    defs.forEach(d => { sanitized[d.key] = config[d.key] !== false; });
    if (defs.length && defs.every(d => sanitized[d.key] === false)) {
        sanitized[defs[0].key] = true;
    }
    try { localStorage.setItem(getSaidaColumnsStorageKey(), JSON.stringify(sanitized)); } catch (_) {}
    try {
        if (obterUsuarioPreferenciaEstoque() !== 'anon' && typeof window.saveData === 'function') {
            await window.saveData(getSaidaColumnsRemotePath(), sanitized, { debounceMs: 0, showToast: false });
        }
    } catch (_) {}
    applySaidaColumnsConfig();
    return sanitized;
}

function atualizarEstadoTodasColunasSaida() {
    const master = document.getElementById('saidaColumnsSelectAll');
    const checks = Array.from(document.querySelectorAll('#saidaColumnsConfigModal .report-col-check'));
    if (!master || checks.length === 0) return;
    const checkedCount = checks.filter(cb => cb.checked).length;
    master.checked = checkedCount === checks.length;
    master.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

function toggleTodasColunasSaida(checked) {
    document.querySelectorAll('#saidaColumnsConfigModal .report-col-check').forEach(cb => {
        cb.checked = !!checked;
    });
    atualizarEstadoTodasColunasSaida();
}

async function abrirConfiguracaoColunasSaida() {
    await ensureSaidaColumnsConfigLoaded();
    if (!document.getElementById('saidaColumnsConfigModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="saidaColumnsConfigModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-list"></i> Colunas da Saída</h3>
                        <span class="close-modal" onclick="fecharConfiguracaoColunasSaida()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div style="color:#64748b; font-size:13px; margin-bottom:10px;">Escolha as colunas visíveis na tabela de toras selecionadas para baixa.</div>
                        <label class="report-col-item" style="margin-bottom:10px;">
                            <input type="checkbox" id="saidaColumnsSelectAll" onchange="toggleTodasColunasSaida(this.checked)">
                            <span class="report-col-label"><strong>Selecionar todas as colunas</strong></span>
                        </label>
                        <div id="saidaColumnsConfigList"></div>
                    </div>
                    <div class="modal-footer" style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-secondary" id="saidaColsResetBtn"><i class="fas fa-undo"></i> Restaurar Padrão</button>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-secondary" onclick="fecharConfiguracaoColunasSaida()"><i class="fas fa-times"></i> Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="salvarConfiguracaoColunasSaida()"><i class="fas fa-check"></i> Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        const modalEl = document.getElementById('saidaColumnsConfigModal');
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) fecharConfiguracaoColunasSaida();
            });
        }
        const resetBtn = document.getElementById('saidaColsResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const defaults = getDefaultSaidaColumnsConfig();
                document.querySelectorAll('#saidaColumnsConfigModal .report-col-check').forEach(cb => {
                    const key = cb.getAttribute('data-col');
                    cb.checked = defaults[key] !== false;
                });
                atualizarEstadoTodasColunasSaida();
            });
        }
    }

    const defs = getSaidaColumnsDefs();
    const cfg = getSaidaColumnsConfigSync();
    const list = document.getElementById('saidaColumnsConfigList');
    if (list) {
        list.innerHTML = `<div class="report-col-grid">${defs.map(d => `
            <label class="report-col-item">
                <input type="checkbox" class="report-col-check" data-col="${escapeHtml(d.key)}" ${cfg[d.key] !== false ? 'checked' : ''} onchange="atualizarEstadoTodasColunasSaida()">
                <span class="report-col-label">${escapeHtml(d.label)}</span>
            </label>
        `).join('')}</div>`;
    }
    atualizarEstadoTodasColunasSaida();
    const modal = document.getElementById('saidaColumnsConfigModal');
    if (modal) modal.style.display = 'block';
}

function fecharConfiguracaoColunasSaida() {
    const modal = document.getElementById('saidaColumnsConfigModal');
    if (modal) modal.style.display = 'none';
}

async function salvarConfiguracaoColunasSaida() {
    const cfg = {};
    getSaidaColumnsDefs().forEach(d => { cfg[d.key] = true; });
    document.querySelectorAll('#saidaColumnsConfigModal .report-col-check').forEach(cb => {
        const key = cb.getAttribute('data-col');
        if (key) cfg[key] = !!cb.checked;
    });
    await saveSaidaColumnsConfig(cfg);
    fecharConfiguracaoColunasSaida();
    atualizarTabelaTorasSaida();
}

function obterValorCelulaSaida(tora = {}, key = '') {
    const geo = normalizarCamposGeoEstoque(tora);
    const manualBadge = tora && tora.manualForaEstoque
        ? ' <span style="display:inline-block;padding:2px 6px;border-radius:10px;background:#fff3cd;color:#856404;font-size:11px;font-weight:600;">Manual</span>'
        : '';
    const valor = (parseFloat(tora.volumeLiquido || 0) || 0) * (parseFloat(tora.precoCusto || 0) || 0);
    const map = {
        plaqueta: `${escapeHtml(tora.plaqueta || '-')}${manualBadge}`,
        custodia: escapeHtml(geo.custodia || '-'),
        especie: escapeHtml(tora.especie || '-'),
        diametro: `${formatNumber(tora.diametro || tora.rodo || 0, 1)} cm`,
        comprimento: `${formatNumber(tora.comprimento || 0, 1)} cm`,
        oco1: tora.oco1 ? `${formatNumber(tora.oco1, 1)} cm` : '-',
        oco2: tora.oco2 ? `${formatNumber(tora.oco2, 1)} cm` : '-',
        volumeDesconto: tora.volumeDesconto ? formatNumber(tora.volumeDesconto, 3) : '-',
        volumeLiquido: `${formatNumber(tora.volumeLiquido || 0, 3)} m³`,
        compGeo: formatarMedidaGeoEstoque(geo.compGeo),
        x1: formatarMedidaGeoEstoque(geo.x1),
        x2: formatarMedidaGeoEstoque(geo.x2),
        x3: formatarMedidaGeoEstoque(geo.x3),
        x4: formatarMedidaGeoEstoque(geo.x4),
        volumeGeo: `${formatarVolumeGeoEstoque(geo.volumeGeo)} m³`,
        precoCusto: formatCurrency(tora.precoCusto),
        valor: formatCurrency(valor),
        localizacao: escapeHtml(tora.localizacao || '')
    };
    return map[key] ?? '';
}

function renderSaidaToraTd(def, tora) {
    const cls = def.align ? ` class="${def.align}"` : '';
    return `<td data-col="${escapeHtml(def.key)}"${cls}>${obterValorCelulaSaida(tora, def.key)}</td>`;
}

window.abrirConfiguracaoColunasSaida = abrirConfiguracaoColunasSaida;
window.fecharConfiguracaoColunasSaida = fecharConfiguracaoColunasSaida;
window.salvarConfiguracaoColunasSaida = salvarConfiguracaoColunasSaida;
window.toggleTodasColunasSaida = toggleTodasColunasSaida;
window.atualizarEstadoTodasColunasSaida = atualizarEstadoTodasColunasSaida;

function getConsultaColumnsDefs() {
    return [
        { key: 'plaqueta', label: 'Plaqueta' },
        { key: 'custodia', label: 'Custódia' },
        { key: 'especie', label: 'Espécie' },
        { key: 'diametro', label: 'Rodo (cm)', align: 'text-center' },
        { key: 'comprimento', label: 'Comprimento (cm)', align: 'text-center' },
        { key: 'volumeBruto', label: 'Volume Bruto (m³)', align: 'text-right' },
        { key: 'volumeLiquido', label: 'Volume Líquido (m³)', align: 'text-right' },
        { key: 'compGeo', label: 'Comp. Geo.', align: 'text-center' },
        { key: 'x1', label: 'X1', align: 'text-center' },
        { key: 'x2', label: 'X2', align: 'text-center' },
        { key: 'x3', label: 'X3', align: 'text-center' },
        { key: 'x4', label: 'X4', align: 'text-center' },
        { key: 'volumeGeo', label: 'V. Geo.', align: 'text-right' },
        { key: 'precoCusto', label: 'Preço Custo', align: 'text-right' },
        { key: 'localizacao', label: 'Localização' },
        { key: 'data', label: 'Data Entrada', align: 'text-center' }
    ];
}

function getConsultaColumnsStorageKey() {
    return obterChavePreferenciaEstoque('consulta_columns');
}

function getConsultaColumnsRemotePath() {
    const uid = obterUsuarioPreferenciaEstoque();
    const tenant = resolveCompanyId() || 'default';
    return `users/${uid}/preferences/estoqueConsultaColumns/${tenant}`;
}

function getDefaultConsultaColumnsConfig() {
    const cfg = {};
    getConsultaColumnsDefs().forEach(d => { cfg[d.key] = true; });
    return cfg;
}

function getConsultaColumnsConfigSync() {
    const defaults = getDefaultConsultaColumnsConfig();
    try {
        const raw = localStorage.getItem(getConsultaColumnsStorageKey());
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaults;
        const normalized = { ...defaults };
        const defs = getConsultaColumnsDefs();
        defs.forEach(d => {
            if (Object.prototype.hasOwnProperty.call(parsed, d.key)) {
                normalized[d.key] = parsed[d.key] !== false;
            }
        });
        if (defs.length && defs.every(d => normalized[d.key] === false)) {
            normalized[defs[0].key] = true;
        }
        return normalized;
    } catch (_) {
        return defaults;
    }
}

async function ensureConsultaColumnsConfigLoaded() {
    try {
        if (localStorage.getItem(getConsultaColumnsStorageKey())) return;
    } catch (_) {}
    try {
        if (obterUsuarioPreferenciaEstoque() !== 'anon' && typeof window.getData === 'function') {
            const remote = await window.getData(getConsultaColumnsRemotePath(), { debounceMs: 0 });
            if (remote && typeof remote === 'object') {
                localStorage.setItem(getConsultaColumnsStorageKey(), JSON.stringify(remote));
            }
        }
    } catch (_) {}
}

function getVisibleConsultaColumns() {
    const cfg = getConsultaColumnsConfigSync();
    const defs = getConsultaColumnsDefs();
    const visible = defs.filter(d => cfg[d.key] !== false);
    return visible.length ? visible : defs.slice(0, 1);
}

function getVisibleConsultaColumnsCount() {
    return getVisibleConsultaColumns().length;
}

function applyConsultaColumnsConfig() {
    const table = document.getElementById('tabelaEstoque');
    if (!table) return;
    const cfg = getConsultaColumnsConfigSync();
    getConsultaColumnsDefs().forEach(d => {
        const visible = cfg[d.key] !== false;
        table.querySelectorAll(`[data-col="${d.key}"]`).forEach(el => {
            el.style.display = visible ? '' : 'none';
        });
    });
}

async function saveConsultaColumnsConfig(config = {}) {
    const defs = getConsultaColumnsDefs();
    const sanitized = {};
    defs.forEach(d => { sanitized[d.key] = config[d.key] !== false; });
    if (defs.length && defs.every(d => sanitized[d.key] === false)) {
        sanitized[defs[0].key] = true;
    }
    try { localStorage.setItem(getConsultaColumnsStorageKey(), JSON.stringify(sanitized)); } catch (_) {}
    try {
        if (obterUsuarioPreferenciaEstoque() !== 'anon' && typeof window.saveData === 'function') {
            await window.saveData(getConsultaColumnsRemotePath(), sanitized, { debounceMs: 0, showToast: false });
        }
    } catch (_) {}
    applyConsultaColumnsConfig();
    return sanitized;
}

function atualizarEstadoTodasColunasConsulta() {
    const master = document.getElementById('consultaColumnsSelectAll');
    const checks = Array.from(document.querySelectorAll('#consultaColumnsConfigModal .report-col-check'));
    if (!master || checks.length === 0) return;
    const checkedCount = checks.filter(cb => cb.checked).length;
    master.checked = checkedCount === checks.length;
    master.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

function toggleTodasColunasConsulta(checked) {
    document.querySelectorAll('#consultaColumnsConfigModal .report-col-check').forEach(cb => {
        cb.checked = !!checked;
    });
    atualizarEstadoTodasColunasConsulta();
}

async function abrirConfiguracaoColunasConsulta() {
    await ensureConsultaColumnsConfigLoaded();
    if (!document.getElementById('consultaColumnsConfigModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="consultaColumnsConfigModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-list"></i> Colunas da Consulta</h3>
                        <span class="close-modal" onclick="fecharConfiguracaoColunasConsulta()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div style="color:#64748b; font-size:13px; margin-bottom:10px;">Escolha as colunas visíveis na Consulta de Toras e na impressão.</div>
                        <label class="report-col-item" style="margin-bottom:10px;">
                            <input type="checkbox" id="consultaColumnsSelectAll" onchange="toggleTodasColunasConsulta(this.checked)">
                            <span class="report-col-label"><strong>Selecionar todas as colunas</strong></span>
                        </label>
                        <div id="consultaColumnsConfigList"></div>
                    </div>
                    <div class="modal-footer" style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-secondary" id="consultaColsResetBtn"><i class="fas fa-undo"></i> Restaurar Padrão</button>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-secondary" onclick="fecharConfiguracaoColunasConsulta()"><i class="fas fa-times"></i> Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="salvarConfiguracaoColunasConsulta()"><i class="fas fa-check"></i> Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        const modalEl = document.getElementById('consultaColumnsConfigModal');
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) fecharConfiguracaoColunasConsulta();
            });
        }
        const resetBtn = document.getElementById('consultaColsResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const defaults = getDefaultConsultaColumnsConfig();
                document.querySelectorAll('#consultaColumnsConfigModal .report-col-check').forEach(cb => {
                    const key = cb.getAttribute('data-col');
                    cb.checked = defaults[key] !== false;
                });
                atualizarEstadoTodasColunasConsulta();
            });
        }
    }

    const defs = getConsultaColumnsDefs();
    const cfg = getConsultaColumnsConfigSync();
    const list = document.getElementById('consultaColumnsConfigList');
    if (list) {
        list.innerHTML = `<div class="report-col-grid">${defs.map(d => `
            <label class="report-col-item">
                <input type="checkbox" class="report-col-check" data-col="${escapeHtml(d.key)}" ${cfg[d.key] !== false ? 'checked' : ''} onchange="atualizarEstadoTodasColunasConsulta()">
                <span class="report-col-label">${escapeHtml(d.label)}</span>
            </label>
        `).join('')}</div>`;
    }
    atualizarEstadoTodasColunasConsulta();
    const modal = document.getElementById('consultaColumnsConfigModal');
    if (modal) modal.style.display = 'block';
}

function fecharConfiguracaoColunasConsulta() {
    const modal = document.getElementById('consultaColumnsConfigModal');
    if (modal) modal.style.display = 'none';
}

async function salvarConfiguracaoColunasConsulta() {
    const cfg = {};
    getConsultaColumnsDefs().forEach(d => { cfg[d.key] = true; });
    document.querySelectorAll('#consultaColumnsConfigModal .report-col-check').forEach(cb => {
        const key = cb.getAttribute('data-col');
        if (key) cfg[key] = !!cb.checked;
    });
    await saveConsultaColumnsConfig(cfg);
    fecharConfiguracaoColunasConsulta();
    carregarTabelaEstoque(filtroEstoqueAtual);
}

function obterValorCelulaConsultaEstoque(tora = {}, key = '') {
    const geo = normalizarCamposGeoEstoque(tora);
    const map = {
        plaqueta: escapeHtml(tora.plaqueta || '-'),
        custodia: escapeHtml(geo.custodia || '-'),
        especie: escapeHtml(tora.especie || '-'),
        diametro: formatNumber(tora.diametro || tora.rodo || 0, 1),
        comprimento: formatNumber(tora.comprimento || 0, 1),
        volumeBruto: formatNumber(tora.volumeBruto || 0, 3),
        volumeLiquido: formatNumber(tora.volumeLiquido || 0, 3),
        compGeo: formatarMedidaGeoEstoque(geo.compGeo),
        x1: formatarMedidaGeoEstoque(geo.x1),
        x2: formatarMedidaGeoEstoque(geo.x2),
        x3: formatarMedidaGeoEstoque(geo.x3),
        x4: formatarMedidaGeoEstoque(geo.x4),
        volumeGeo: formatarVolumeGeoEstoque(geo.volumeGeo),
        precoCusto: formatCurrency(tora.precoCusto || 0),
        localizacao: escapeHtml(tora.localizacao || ''),
        data: formatDate(tora.data)
    };
    return map[key] ?? '';
}

function renderConsultaEstoqueTd(def, tora) {
    const cls = def.align ? ` class="${def.align}"` : '';
    return `<td data-col="${escapeHtml(def.key)}"${cls}>${obterValorCelulaConsultaEstoque(tora, def.key)}</td>`;
}

window.abrirConfiguracaoColunasConsulta = abrirConfiguracaoColunasConsulta;
window.fecharConfiguracaoColunasConsulta = fecharConfiguracaoColunasConsulta;
window.salvarConfiguracaoColunasConsulta = salvarConfiguracaoColunasConsulta;
window.toggleTodasColunasConsulta = toggleTodasColunasConsulta;
window.atualizarEstadoTodasColunasConsulta = atualizarEstadoTodasColunasConsulta;
window.abrirConfiguracaoColunasMovimentacoes = abrirConfiguracaoColunasMovimentacoes;
window.fecharConfiguracaoColunasMovimentacoes = fecharConfiguracaoColunasMovimentacoes;
window.salvarConfiguracaoColunasMovimentacoes = salvarConfiguracaoColunasMovimentacoes;
window.toggleTodasColunasMovimentacoes = toggleTodasColunasMovimentacoes;
window.atualizarEstadoTodasColunasMovimentacoes = atualizarEstadoTodasColunasMovimentacoes;

// --- Tabela e Paginação (Padrão RomaneioPCT) ---
function renderizarTabelaEntrada() {
    const tbody = document.getElementById('tbodyEntrada');
    const paginacaoEl = document.getElementById('paginacaoEntrada');

    const ITENS_POR_PAGINA = obterItensPorPaginaTabela('entrada');

    // Totais Gerais
    const volTotal = itensEntrada.reduce((acc, i) => acc + (i.volumeLiquido || 0), 0);
    const geoTotal = itensEntrada.reduce((acc, i) => acc + (normalizarCamposGeoEstoque(i).volumeGeo || 0), 0);
    const valTotal = itensEntrada.reduce((acc, i) => acc + (i.valor || 0), 0);

    // Container do resumo (criar se não existir)
    let summaryContainer = document.getElementById('resumoEntradaContainer');
    if (!summaryContainer && paginacaoEl) {
        summaryContainer = document.createElement('div');
        summaryContainer.id = 'resumoEntradaContainer';
        summaryContainer.style.marginTop = '20px';
        paginacaoEl.parentNode.insertBefore(summaryContainer, paginacaoEl.nextSibling);
    }

    const entradaColspan = getVisibleEntradaColumnsCount() + 2;

    if (itensEntrada.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${entradaColspan}" class="text-center">Nenhum item adicionado</td></tr>`;
        if (paginacaoEl) paginacaoEl.innerHTML = '';
        if(summaryContainer) summaryContainer.innerHTML = '';
        applyEntradaColumnsConfig();
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(itensEntrada.length / ITENS_POR_PAGINA));
    if (paginaAtualEntrada > totalPaginas) paginaAtualEntrada = totalPaginas;
    if (paginaAtualEntrada < 1) paginaAtualEntrada = 1;
    const inicio = (paginaAtualEntrada - 1) * ITENS_POR_PAGINA;
    const itensPagina = itensEntrada.slice(inicio, inicio + ITENS_POR_PAGINA);

    // Renderizar Itens
    tbody.innerHTML = itensPagina.map((item, idx) => {
        const realIndex = inicio + idx;
        const isChecked = entradaSelecionadas.has(String(item.id)) ? 'checked' : '';
        const geo = normalizarCamposGeoEstoque(item);
        return `
            <tr>
                <td class="text-center" data-label="Selecionar"><input type="checkbox" class="check-item-entrada" value="${item.id}" ${isChecked} onchange="toggleEntrada('${item.id}', this.checked)"></td>
                <td data-col="plaqueta" data-label="Plaqueta">${escapeHtml(item.plaqueta || '-')}</td>
                <td data-col="custodia" data-label="Custódia">${escapeHtml(geo.custodia || '-')}</td>
                <td data-col="especie" data-label="Espécie">${escapeHtml(item.especie || '-')}</td>
                <td data-col="diametro" data-label="Rodo" class="text-center">${formatNumber(item.diametro || item.rodo, 1)}</td>
                <td data-col="comprimento" data-label="Comprimento" class="text-center">${formatNumber(item.comprimento, 1)}</td>
                <td data-col="oco1" data-label="Oco 1" class="text-center">${item.oco1 ? formatNumber(item.oco1, 1) : '-'}</td>
                <td data-col="oco2" data-label="Oco 2" class="text-center">${item.oco2 ? formatNumber(item.oco2, 1) : '-'}</td>
                <td data-col="desconto" data-label="Desconto" class="text-center">${item.desconto ? formatNumber(item.desconto, 3) : '-'}</td>
                <td data-col="volumeLiquido" data-label="Volume Líquido" class="text-right">${formatNumber(item.volumeLiquido, 3)}</td>
                <td data-col="compGeo" data-label="Comp. Geo." class="text-center">${formatarMedidaGeoEstoque(geo.compGeo)}</td>
                <td data-col="x1" data-label="X1" class="text-center">${formatarMedidaGeoEstoque(geo.x1)}</td>
                <td data-col="x2" data-label="X2" class="text-center">${formatarMedidaGeoEstoque(geo.x2)}</td>
                <td data-col="x3" data-label="X3" class="text-center">${formatarMedidaGeoEstoque(geo.x3)}</td>
                <td data-col="x4" data-label="X4" class="text-center">${formatarMedidaGeoEstoque(geo.x4)}</td>
                <td data-col="volumeGeo" data-label="Volume Geo." class="text-right">${formatarVolumeGeoEstoque(geo.volumeGeo)}</td>
                <td data-col="preco" data-label="Preço" class="text-right">${formatCurrency(item.preco || item.precoCusto)}</td>
                <td data-col="valor" data-label="Valor" class="text-right">${formatCurrency(item.valor)}</td>
                <td class="text-center actions-cell sticky-actions" data-label="Ações">
                    <div class="actions-cell-inner">
                        <button onclick="removerItemEntrada(${realIndex})" class="btn-danger btn-small"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    renderizarPaginacaoPadrao('paginacaoEntrada', itensEntrada.length, paginaAtualEntrada, ITENS_POR_PAGINA, 'mudarPaginaEntrada', { sizeScope: 'entrada' });
    applyEntradaColumnsConfig();

    // --- Renderizar Resumo ---
    if (summaryContainer) {
        // Calcular Médias por Espécie
        const speciesStats = {};
        itensEntrada.forEach(item => {
            const esp = item.especie || 'Outros';
            const rodo = parseFloat(item.diametro || item.rodo || 0);
            const volume = parseFloat(item.volumeLiquido || item.volumeSerraria || 0);

            if (!speciesStats[esp]) speciesStats[esp] = { totalRodo: 0, totalVolume: 0, count: 0 };

            if (rodo > 0) {
                speciesStats[esp].totalRodo += rodo;
                speciesStats[esp].count++;
            }
            if (volume > 0) {
                speciesStats[esp].totalVolume += volume;
            }
        });

        let speciesHtml = '';
        Object.keys(speciesStats).sort().forEach(esp => {
            const stats = speciesStats[esp];
            const avgRodo = stats.count > 0 ? (stats.totalRodo / stats.count) : 0;
            const avgVol = stats.count > 0 ? (stats.totalVolume / stats.count) : 0;

            speciesHtml += `
                <div style="background: #fff; padding: 10px; border-radius: 4px; border: 1px solid #ddd; text-align: center; min-width: 140px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="font-weight: bold; color: #2c3e50; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;">${esp}</div>
                    <div style="font-size: 13px; color: #7f8c8d; margin-bottom: 3px;">Média Rodo: <strong>${formatNumber(avgRodo, 1)} cm</strong></div>
                    <div style="font-size: 13px; color: #7f8c8d;">Média Volu: <strong>${formatNumber(avgVol, 3)} m³</strong></div>
                </div>
            `;
        });

        summaryContainer.innerHTML = `
            <div class="summary-box" style="background-color: #f8f9fa; border: 1px solid #e9ecef; padding: 20px;">
                <div style="display: flex; justify-content: space-around; flex-wrap: wrap; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 20px;">
                    <div class="text-center">
                        <div style="font-size: 14px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Quantidade de Toras</div>
                        <div style="font-size: 24px; font-weight: bold; color: #2c3e50;">${itensEntrada.length}</div>
                    </div>
                    <div class="text-center">
                        <div style="font-size: 14px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Volume Total</div>
                        <div style="font-size: 24px; font-weight: bold; color: #2c3e50;">${formatNumber(volTotal, 3)} m³</div>
                    </div>
                    <div class="text-center">
                        <div style="font-size: 14px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">V. Geo. Total</div>
                        <div style="font-size: 24px; font-weight: bold; color: #2c3e50;">${formatNumber(geoTotal, 3)} m³</div>
                    </div>
                    <div class="text-center">
                        <div style="font-size: 14px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px;">Valor Total</div>
                        <div style="font-size: 24px; font-weight: bold; color: #27ae60;">${formatCurrency(valTotal)}</div>
                    </div>
                </div>

                <h4 style="margin-bottom: 15px; font-size: 16px; color: #34495e; border-left: 4px solid #3498db; padding-left: 10px;">Médias de Rodo e Volume por Espécie</h4>
                <div style="display: flex; gap: 15px; overflow-x: auto; padding-bottom: 10px;">
                    ${speciesHtml || '<div style="color: #999; font-style: italic;">Nenhuma espécie com rodo informado</div>'}
                </div>
            </div>
        `;
    }
}

function mudarPaginaEntrada(p) {
    paginaAtualEntrada = p;
    renderizarTabelaEntrada();
}

function removerItemEntrada(index) {
    itensEntrada.splice(index, 1);
    renderizarTabelaEntrada();
}

function limparTabelaEntrada() {
    if (confirm('Deseja limpar todos os itens da lista de entrada?')) {
        itensEntrada = [];
        renderizarTabelaEntrada();
    }
}

function toggleTodosEntrada() {
    const master = document.getElementById('checkTodosEntrada');
    const checks = document.querySelectorAll('.check-item-entrada');
    checks.forEach(c => {
        c.checked = master.checked;
        if (master.checked) {
            entradaSelecionadas.add(c.value);
        } else {
            entradaSelecionadas.delete(c.value);
        }
    });
}

function toggleEntrada(id, isChecked) {
    if (isChecked) {
        entradaSelecionadas.add(String(id));
    } else {
        entradaSelecionadas.delete(String(id));
        const master = document.getElementById('checkTodosEntrada');
        if (master) master.checked = false;
    }
}

function ordenarEntrada(coluna) {
    if (ordemEntrada.coluna === coluna) {
        ordemEntrada.direcao = ordemEntrada.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        ordemEntrada.coluna = coluna;
        ordemEntrada.direcao = 'asc';
    }

    document.querySelectorAll('#tabelaEntrada th .sort-icon, #tabelaEntrada thead .sort-icon, #entradaForm thead .sort-icon').forEach(icon => {
        if (icon.id && icon.id.startsWith('sort-entrada-')) {
            icon.className = 'fas fa-sort sort-icon';
        }
    });

    const iconEl = document.getElementById(`sort-entrada-${coluna}`);
    if (iconEl) {
        iconEl.className = `fas fa-sort-${ordemEntrada.direcao === 'asc' ? 'up' : 'down'} sort-icon`;
    }

    itensEntrada.sort((a, b) => compararValoresEstoque(a, b, ordemEntrada.coluna, ordemEntrada.direcao));

    renderizarTabelaEntrada();
}

// --- Registrar Entrada (Final) ---
async function registrarEntrada(event) {
    event.preventDefault();

    if (itensEntrada.length === 0) {
        alert('Adicione itens à lista antes de salvar.');
        return;
    }

    const dataEntrada = document.getElementById('entradaData').value;
    const fornecedorId = document.getElementById('fornecedorSelect').value;
    const fornecedorNome = fornecedores.find(f => f.id === fornecedorId)?.nome || 'Fornecedor Desconhecido';
    const obsGeral = document.getElementById('observacoesEntrada')?.value || '';
    const documento = romaneioSelecionadoId ? `Romaneio ${romaneioSelecionadoId}` : 'Entrada Manual';

    if (!fornecedorId) {
        alert('Selecione um fornecedor.');
        return;
    }

    const especiesInvalidas = [];
    itensEntrada.forEach((item) => {
        const validacao = validarEspecieEntrada(item.especie, false);
        if (validacao.ok) {
            item.especie = validacao.nome;
        } else {
            especiesInvalidas.push(String(item.especie || 'Sem espécie').trim() || 'Sem espécie');
        }
    });
    if (especiesInvalidas.length > 0) {
        const lista = [...new Set(especiesInvalidas)].slice(0, 5).join(', ');
        alert(`Existem itens com espécie fora do cadastro: ${lista}. Corrija ou cadastre a espécie antes de salvar a entrada.`);
        return;
    }

    const plaquetasEntrada = new Set();
    const plaquetasDuplicadas = [];
    itensEntrada.forEach((item) => {
        const chave = normalizarChavePlaqueta(item.plaqueta);
        if (!chave) return;
        if (plaquetasEntrada.has(chave) || encontrarToraPorPlaqueta(item.plaqueta)) {
            plaquetasDuplicadas.push(String(item.plaqueta || '').trim());
        }
        plaquetasEntrada.add(chave);
    });
    if (plaquetasDuplicadas.length > 0) {
        const lista = [...new Set(plaquetasDuplicadas)].slice(0, 5).join(', ');
        alert(`Existem plaquetas duplicadas no estoque ou nesta entrada: ${lista}. Corrija antes de salvar.`);
        return;
    }

    // Mostrar loading
    showLoading('Preparando dados para gravação...');

    try {
        const updates = {};
        const newItems = [];
        const newMovs = [];
        const totalItens = itensEntrada.length;

        // Processar itens
        itensEntrada.forEach((item, index) => {
            const geo = normalizarCamposGeoEstoque(item);
            // Normalizar e limpar campos
            const itemLimpo = {
                id: generateUniqueId('EST') + index, // Garantir unicidade no batch
                data: dataEntrada,
                fornecedorId: String(fornecedorId),
                fornecedor: { id: String(fornecedorId), nome: fornecedorNome },
                documento: documento,
                plaqueta: String(item.plaqueta || generateUniqueId('PQ') + index),
                ...geo,
                especie: normalizarNomeEspecieCadastrada(item.especie || 'N/A'),
                diametro: parseFloat(item.diametro || item.rodo || 0),
                comprimento: parseFloat(item.comprimento || 0),
                oco1: parseFloat(item.oco1 || 0),
                oco2: parseFloat(item.oco2 || 0),
                precoCusto: parseFloat(item.preco || item.precoCusto || 0),
                localizacao: String(item.localizacao || (document.getElementById('localizacaoEntrada') ? document.getElementById('localizacaoEntrada').value : '')),
                observacoes: String(obsGeral),

                // Volumes
                volumeBruto: parseFloat(item.volumeBruto || 0),
                volumeDesconto: parseFloat(item.desconto || item.volumeDesconto || 0),
                volumeLiquido: parseFloat(item.volumeLiquido || item.volumeSerraria || 0),

                status: 'disponivel',
                origemRomaneioId: item.origemRomaneioId ? String(item.origemRomaneioId) : (romaneioSelecionadoId ? String(romaneioSelecionadoId) : null),
                created: new Date().toISOString()
            };

            // Criar movimentação
            const mov = {
                id: generateUniqueId('MOV') + index, // Garantir unicidade no batch
                data: dataEntrada,
                tipo: 'entrada',
                toraId: itemLimpo.id,
                plaqueta: itemLimpo.plaqueta,
                especie: itemLimpo.especie,
                volume: itemLimpo.volumeLiquido,
                ...geo,
                documento: documento,
                observacoes: `Entrada Estoque - ${obsGeral}`,
                created: new Date().toISOString()
            };

            // Adicionar ao batch de updates
            updates[`estoqueTorasAtual/${itemLimpo.id}`] = itemLimpo;
            updates[`movimentacoesToras/${mov.id}`] = mov;

            newItems.push(itemLimpo);
            newMovs.push(mov);
        });

        // Atualizar arrays locais (Optimistic Update)
        estoqueAtual.push(...newItems);
        movimentacoes.push(...newMovs);

        document.getElementById('loadingMessage').textContent = `Salvando ${totalItens} itens...`;

        // Salvar no Firebase
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            await window.firebaseService.updatePaths(updates);
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            // Fallback para saveToFirebase em loop se updatePaths não existir
            let salvos = 0;
            for (let i = 0; i < newItems.length; i++) {
                document.getElementById('loadingProgress').textContent = `${i+1}/${totalItens}`;
                await window.firebaseService.saveToFirebase('estoqueTorasAtual', String(newItems[i].id), newItems[i]);
                await window.firebaseService.saveToFirebase('movimentacoesToras', String(newMovs[i].id), newMovs[i]);
                salvos++;
            }
        } else {
            // LocalStorage fallback
            await saveDataAsync('estoqueTorasAtual', estoqueAtual);
            await saveDataAsync('movimentacoesToras', movimentacoes);
        }

        hideLoading();
        alert(`Entrada de ${totalItens} toras realizada com sucesso!`);

        // Limpar tudo
        itensEntrada = [];
        renderizarTabelaEntrada();
        limparCamposEntrada();
        const romaneioInput = document.getElementById('romaneioEntrada');
        if (romaneioInput) {
            romaneioInput.value = '';
        }
        const romaneioSelect = document.getElementById('romaneioEntradaSelect');
        if (romaneioSelect) {
            romaneioSelect.value = '';
        }
        romaneioSelecionadoId = null;

        // Atualizar telas
        atualizarEstatisticas();
        carregarTabelaEstoque();

    } catch (error) {
        hideLoading();
        console.error('Erro ao registrar entrada:', error);
        alert('Erro ao processar entrada: ' + error.message);
    }
}

function limparFormularioEntrada() {
    document.getElementById('entradaForm').reset();
    document.getElementById('entradaData').value = new Date().toISOString().split('T')[0];
    itensEntrada = [];
    renderizarTabelaEntrada();
    const aviso = document.getElementById('editToraAviso');
    if (aviso) aviso.style.display = 'none';
    toraEmEdicao = null;
    setModoEdicaoEntrada(null);
}

// Funções de saída de estoque
function abrirBaixaPorLote() {
    const container = document.getElementById('saidaFormContainer');
    const jaAberto = container && container.style.display !== 'none';
    if (jaAberto && (torasSelecionadasBaixa.length > 0 || romaneiosSaidaSelecionados.length > 0)) {
        saidaModo = 'lote';
        abrirSelecaoTorasParaAdicionar();
        return;
    }
    if (container) container.style.display = 'block';
    const dataEl = document.getElementById('saidaData');
    if (dataEl && !dataEl.value) dataEl.value = new Date().toISOString().split('T')[0];
    torasSelecionadasBaixa = [];
    saidaSelecionadas.clear();
    torasSelecionadasModal = [];
    saidaModo = 'lote';
    const aviso = document.getElementById('saidaIndividualAviso');
    if (aviso) aviso.style.display = 'none';
    limparSelecaoRomaneiosSaida();
    limparBuscaPlaquetaSaida();
    atualizarTabelaTorasSaida();
    abrirSelecaoTorasParaAdicionar();
}

function abrirBaixaIndividual() {
    const container = document.getElementById('saidaFormContainer');
    if (container) container.style.display = 'block';
    const dataEl = document.getElementById('saidaData');
    if (dataEl && !dataEl.value) dataEl.value = new Date().toISOString().split('T')[0];
    saidaModo = 'individual';
    const aviso = document.getElementById('saidaIndividualAviso');
    if (aviso) aviso.style.display = 'block';
    limparBuscaPlaquetaSaida();
    atualizarTabelaTorasSaida();

    // Focar no primeiro campo
    const busca = document.getElementById('saidaPlaquetaBusca');
    if (busca) busca.focus();
}

function carregarTorasDisponiveis() {
    const tbody = document.getElementById('torasDisponiveisTable');
    const especieFiltro = String((document.getElementById('filtroTorasEspecieModal') || {}).value || '').toLowerCase().trim();
    const rodoFiltro = String((document.getElementById('filtroTorasRodoModal') || {}).value || '').toLowerCase().trim();
    const comprimentoFiltro = String((document.getElementById('filtroTorasComprimentoModal') || {}).value || '').toLowerCase().trim();
    let torasDisponiveis = estoqueAtual.filter(tora => tora.status === 'disponivel');

    if (especieFiltro) {
        torasDisponiveis = torasDisponiveis.filter(tora =>
            String(tora.especie || '').toLowerCase().includes(especieFiltro) ||
            String(tora.plaqueta || '').toLowerCase().includes(especieFiltro)
        );
    }
    if (rodoFiltro) {
        torasDisponiveis = torasDisponiveis.filter(tora => {
            const rodo = Number(tora.diametro || 0);
            if (!Number.isFinite(rodo) || rodo <= 0) return false;
            const variants = [String(rodo), String(Math.trunc(rodo)), rodo.toFixed(1)];
            return variants.some(v => v.includes(rodoFiltro));
        });
    }
    if (comprimentoFiltro) {
        torasDisponiveis = torasDisponiveis.filter(tora => {
            const comp = Number(tora.comprimento || 0);
            if (!Number.isFinite(comp) || comp <= 0) return false;
            const variants = [String(comp), String(Math.trunc(comp)), comp.toFixed(1)];
            return variants.some(v => v.includes(comprimentoFiltro));
        });
    }

    if (torasDisponiveis.length === 0) {
        tbody.innerHTML = '<tr><td colspan="19" style="text-align: center;">Nenhuma tora disponível</td></tr>';
        const checkboxTodas = document.getElementById('selecionarTodas');
        if (checkboxTodas) checkboxTodas.checked = false;
        return;
    }

    const selecionadasSet = new Set(torasSelecionadasModal.map(t => String(t.id)));
    tbody.innerHTML = torasDisponiveis.map(tora => {
        const checked = selecionadasSet.has(String(tora.id)) ? 'checked' : '';
        const geo = normalizarCamposGeoEstoque(tora);
        return `
        <tr>
            <td>
                <input type="checkbox" value="${tora.id}" ${checked} onchange="toggleToraSelecao('${tora.id}', this.checked)">
            </td>
            <td>${escapeHtml(tora.plaqueta || '-')}</td>
            <td>${escapeHtml(geo.custodia || '-')}</td>
            <td>${escapeHtml(tora.especie || '-')}</td>
            <td style="text-align: center;">${formatNumber(tora.diametro, 1)} cm</td>
            <td style="text-align: center;">${formatNumber(tora.comprimento, 1)} cm</td>
            <td style="text-align: center;">${tora.oco1 ? formatNumber(tora.oco1, 1) + ' cm' : '-'}</td>
            <td style="text-align: center;">${tora.oco2 ? formatNumber(tora.oco2, 1) + ' cm' : '-'}</td>
            <td style="text-align: center;">${tora.volumeDesconto ? formatNumber(tora.volumeDesconto, 3) : '-'}</td>
            <td style="text-align: right;">${formatNumber(tora.volumeLiquido, 3)} m³</td>
            <td style="text-align: center;">${formatarMedidaGeoEstoque(geo.compGeo)}</td>
            <td style="text-align: center;">${formatarMedidaGeoEstoque(geo.x1)}</td>
            <td style="text-align: center;">${formatarMedidaGeoEstoque(geo.x2)}</td>
            <td style="text-align: center;">${formatarMedidaGeoEstoque(geo.x3)}</td>
            <td style="text-align: center;">${formatarMedidaGeoEstoque(geo.x4)}</td>
            <td style="text-align: right;">${formatarVolumeGeoEstoque(geo.volumeGeo)} m³</td>
            <td style="text-align: right;">${formatCurrency(tora.precoCusto)}</td>
            <td style="text-align: right;">${formatCurrency((tora.volumeLiquido || 0) * (tora.precoCusto || 0))}</td>
            <td>${escapeHtml(tora.localizacao || '')}</td>
        </tr>
    `;
    }).join('');

    const checkboxes = document.querySelectorAll('#torasDisponiveisTable input[type="checkbox"]');
    const checkboxTodas = document.getElementById('selecionarTodas');
    if (checkboxTodas) {
        checkboxTodas.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
    }
}

function filtrarTorasDisponiveis() {
    const sanitizeNumericFilterInput = (el) => {
        if (!el) return '';
        let v = String(el.value || '');
        v = v.replace(/[^0-9,.\s]/g, '').replace(/\s+/g, '');
        const firstSepIdx = v.search(/[,.]/);
        if (firstSepIdx >= 0) {
            const intPart = v.slice(0, firstSepIdx).replace(/[^0-9]/g, '');
            const fracPart = v.slice(firstSepIdx + 1).replace(/[,.]/g, '').replace(/[^0-9]/g, '');
            v = fracPart ? `${intPart}.${fracPart}` : intPart;
        }
        el.value = v;
        return v;
    };
    const rodoEl = document.getElementById('filtroTorasRodoModal');
    const compEl = document.getElementById('filtroTorasComprimentoModal');
    const rodoSan = sanitizeNumericFilterInput(rodoEl);
    const compSan = sanitizeNumericFilterInput(compEl);
    filtrosTorasModalState = {
        especie: String((document.getElementById('filtroTorasEspecieModal') || {}).value || ''),
        rodo: rodoSan,
        comprimento: compSan
    };
    carregarTorasDisponiveis();
}

function onBuscaTorasEnter(event) {
    if (!event || event.key !== 'Enter') return;
    event.preventDefault();
    filtrarTorasDisponiveis();
    const checkboxes = Array.from(document.querySelectorAll('#torasDisponiveisTable input[type="checkbox"]'));
    checkboxes.forEach((checkbox) => {
        if (!checkbox.checked) {
            checkbox.checked = true;
            toggleToraSelecao(checkbox.value, true, false);
        }
    });
    const especieEl = document.getElementById('filtroTorasEspecieModal');
    if (especieEl) especieEl.value = '';
    filtrosTorasModalState = {
        especie: '',
        rodo: String((document.getElementById('filtroTorasRodoModal') || {}).value || ''),
        comprimento: String((document.getElementById('filtroTorasComprimentoModal') || {}).value || '')
    };
    carregarTorasDisponiveis();
    const checkboxTodas = document.getElementById('selecionarTodas');
    if (checkboxTodas) checkboxTodas.checked = true;
}

function limparFiltrosTorasDisponiveisModal() {
    const especieEl = document.getElementById('filtroTorasEspecieModal');
    const rodoEl = document.getElementById('filtroTorasRodoModal');
    const compEl = document.getElementById('filtroTorasComprimentoModal');
    if (especieEl) especieEl.value = '';
    if (rodoEl) rodoEl.value = '';
    if (compEl) compEl.value = '';
    filtrosTorasModalState = { especie: '', rodo: '', comprimento: '' };
    carregarTorasDisponiveis();
}

function atualizarFiltrosTorasDisponiveisModal() {
    const especieEl = document.getElementById('filtroTorasEspecieModal');
    const rodoEl = document.getElementById('filtroTorasRodoModal');
    const compEl = document.getElementById('filtroTorasComprimentoModal');
    if (!especieEl || !rodoEl || !compEl) return;
    especieEl.value = String(filtrosTorasModalState.especie || '');
    rodoEl.value = String(filtrosTorasModalState.rodo || '');
    compEl.value = String(filtrosTorasModalState.comprimento || '');
}

function selecionarTodasToras() {
    const checkboxTodas = document.getElementById('selecionarTodas');
    const checkboxes = document.querySelectorAll('#torasDisponiveisTable input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        checkbox.checked = checkboxTodas.checked;
        toggleToraSelecao(checkbox.value, checkboxTodas.checked, false);
    });
}

function toggleToraSelecao(toraId, isChecked, updateCheckbox = true) {
    const tora = estoqueAtual.find(t => t.id === toraId);
    if (!tora) return;

    const index = torasSelecionadasModal.findIndex(t => t.id === toraId);

    if (isChecked) {
        const jaNaTabela = torasSelecionadasBaixa.some(t => String(t.id) === String(toraId));
        if (jaNaTabela && updateCheckbox) {
            if (window.ToastManager && typeof window.ToastManager.warning === 'function') {
                window.ToastManager.warning(`A tora ${tora.plaqueta || toraId} já está carregada na baixa`, 'Duplicidade');
            } else {
                alert(`A tora ${tora.plaqueta || toraId} já está carregada na baixa.`);
            }
        }
        if (index === -1 && !jaNaTabela) {
            torasSelecionadasModal.push(tora);
        }
    } else {
        if (index !== -1) {
            torasSelecionadasModal.splice(index, 1);
        }
    }

    // Atualizar checkbox "Selecionar Todas"
    if (updateCheckbox) {
        const checkboxes = document.querySelectorAll('#torasDisponiveisTable input[type="checkbox"]');
        const checkboxTodas = document.getElementById('selecionarTodas');
        const todasSelecionadas = Array.from(checkboxes).every(cb => cb.checked);
        checkboxTodas.checked = todasSelecionadas;
    }
}

function confirmarSelecaoToras() {
    if (torasSelecionadasModal.length === 0) {
        alert('Selecione pelo menos uma tora para baixa');
        return;
    }

    const map = new Map();
    (torasSelecionadasBaixa || []).forEach(t => { if (t && t.id != null) map.set(String(t.id), t); });
    (torasSelecionadasModal || []).forEach(t => { if (t && t.id != null) map.set(String(t.id), t); });
    torasSelecionadasBaixa = Array.from(map.values());
    torasSelecionadasModal = [];
    fecharModal('selecaoTorasModal');
    atualizarTabelaTorasSaida();
}

function adicionarToraManualSaida() {
    const plaquetaEl = document.getElementById('manualPlaquetaSaida');
    const especieEl = document.getElementById('manualEspecieSaida');
    const rodoEl = document.getElementById('manualRodoSaida');
    const compEl = document.getElementById('manualComprimentoSaida');
    const oco1El = document.getElementById('manualOco1Saida');
    const oco2El = document.getElementById('manualOco2Saida');
    const geo = obterCamposGeoManualSaida();

    const plaqueta = String((plaquetaEl && plaquetaEl.value) || '').trim();
    const especieRaw = String((especieEl && especieEl.value) || '').trim();
    const diametro = parseFloat((rodoEl && rodoEl.value) || 0) || 0;
    const comprimento = parseFloat((compEl && compEl.value) || 0) || 0;
    const oco1 = parseFloat((oco1El && oco1El.value) || 0) || 0;
    const oco2 = parseFloat((oco2El && oco2El.value) || 0) || 0;

    if (!plaqueta || !especieRaw || diametro <= 0 || comprimento <= 0) {
        alert('Preencha Plaqueta, Espécie, Rodo e Comprimento para adicionar manualmente.');
        return;
    }

    const especieValidacao = validarEspecieEntrada(especieRaw, true);
    if (!especieValidacao.ok) return;
    const especie = especieValidacao.nome;
    if (especieEl) especieEl.value = especie;

    const jaExistePlaqueta = (torasSelecionadasBaixa || []).some(t => String((t && t.plaqueta) || '').toLowerCase() === plaqueta.toLowerCase());
    if (jaExistePlaqueta) {
        if (window.ToastManager && typeof window.ToastManager.warning === 'function') {
            window.ToastManager.warning(`A plaqueta ${plaqueta} já está na tabela de baixa`, 'Duplicidade');
        } else {
            alert(`A plaqueta ${plaqueta} já está na tabela de baixa.`);
        }
        return;
    }

    const volumeBruto = calcularVolumeTora(diametro, comprimento);
    const volumeDesconto = calcularDescontoOco(oco1, oco2, comprimento);
    const volumeLiquido = Math.max(0, (parseFloat(volumeBruto) || 0) - (parseFloat(volumeDesconto) || 0));

    const toraManual = {
        id: `MANUAL_SAIDA_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        plaqueta,
        ...geo,
        especie,
        diametro,
        comprimento,
        oco1: oco1 > 0 ? oco1 : null,
        oco2: oco2 > 0 ? oco2 : null,
        volumeDesconto: volumeDesconto > 0 ? volumeDesconto : 0,
        volumeLiquido,
        precoCusto: 0,
        localizacao: 'Manual (fora do estoque)',
        manualForaEstoque: true
    };

    torasSelecionadasBaixa.push(toraManual);
    atualizarTabelaTorasSaida();

    if (plaquetaEl) plaquetaEl.value = '';
    if (especieEl) especieEl.value = '';
    if (rodoEl) rodoEl.value = '';
    if (compEl) compEl.value = '';
    if (oco1El) oco1El.value = '';
    if (oco2El) oco2El.value = '';
    limparCamposGeoManualSaida();
}

function abrirSelecaoTorasParaAdicionar() {
    torasSelecionadasModal = (torasSelecionadasBaixa || []).slice();
    const modal = document.getElementById('selecaoTorasModal');
    if (modal) modal.style.display = 'block';
    atualizarFiltrosTorasDisponiveisModal();
    carregarTorasDisponiveis();
}

function atualizarTabelaTorasSaida() {
    const tbody = document.getElementById('torasSaidaTable');
    const paginacaoEl = document.getElementById('paginacaoSaida');

    if (torasSelecionadasBaixa.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${getVisibleSaidaColumnsCount() + 2}" style="text-align: center;">Nenhuma tora selecionada</td></tr>`;
        atualizarResumoSaida();
        if (paginacaoEl) paginacaoEl.innerHTML = '';
        applySaidaColumnsConfig();
        return;
    }

    const itensPorPaginaSaida = obterItensPorPaginaTabela('saida');
    const totalPaginas = Math.max(1, Math.ceil(torasSelecionadasBaixa.length / itensPorPaginaSaida));
    if (paginaAtualSaida > totalPaginas) paginaAtualSaida = totalPaginas;
    if (paginaAtualSaida < 1) paginaAtualSaida = 1;
    const inicio = (paginaAtualSaida - 1) * itensPorPaginaSaida;
    const itensPagina = torasSelecionadasBaixa.slice(inicio, inicio + itensPorPaginaSaida);

    const saidaDefs = getSaidaColumnsDefs();
    tbody.innerHTML = itensPagina.map(tora => {
        const isChecked = saidaSelecionadas.has(String(tora.id)) ? 'checked' : '';
        return `
        <tr>
            <td class="text-center"><input type="checkbox" class="check-saida" value="${tora.id}" ${isChecked} onchange="toggleSaida('${tora.id}', this.checked)"></td>
            ${saidaDefs.map(def => renderSaidaToraTd(def, tora)).join('')}
            <td class="text-center actions-cell sticky-actions">
                <div class="actions-cell-inner">
                    <button type="button" onclick="removerToraSaida('${String(tora.id).replace(/'/g, "\\'")}')" class="btn-danger btn-small">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join('');
    renderizarPaginacaoPadrao('paginacaoSaida', torasSelecionadasBaixa.length, paginaAtualSaida, itensPorPaginaSaida, 'mudarPaginaSaida', { sizeScope: 'saida' });
    applySaidaColumnsConfig();
    atualizarResumoSaida();
}

function mudarPaginaSaida(p) {
    paginaAtualSaida = p;
    atualizarTabelaTorasSaida();
}

function removerToraSaida(toraId) {
    torasSelecionadasBaixa = torasSelecionadasBaixa.filter(t => t.id !== toraId);
    saidaSelecionadas.delete(String(toraId));
    const master = document.getElementById('checkTodasSaida');
    if (master) master.checked = false;
    atualizarTabelaTorasSaida();
}

function toggleTodasSaida() {
    const master = document.getElementById('checkTodasSaida');
    const checks = document.querySelectorAll('.check-saida');
    checks.forEach(c => {
        c.checked = master.checked;
        if (master.checked) {
            saidaSelecionadas.add(c.value);
        } else {
            saidaSelecionadas.delete(c.value);
        }
    });
}

function toggleSaida(id, isChecked) {
    if (isChecked) {
        saidaSelecionadas.add(id);
    } else {
        saidaSelecionadas.delete(id);
        const master = document.getElementById('checkTodasSaida');
        if (master) master.checked = false;
    }
}

function ordenarSaida(coluna) {
    if (ordemSaida.coluna === coluna) {
        ordemSaida.direcao = ordemSaida.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        ordemSaida.coluna = coluna;
        ordemSaida.direcao = 'asc';
    }
    document.querySelectorAll('#torasSaidaTable th .sort-icon, #saidaForm thead .sort-icon').forEach(icon => {
        if (icon.id && icon.id.startsWith('sort-saida-')) {
            icon.className = 'fas fa-sort sort-icon';
        }
    });
    const iconEl = document.getElementById(`sort-saida-${coluna}`);
    if (iconEl) {
        iconEl.className = `fas fa-sort-${ordemSaida.direcao === 'asc' ? 'up' : 'down'} sort-icon`;
    }
    torasSelecionadasBaixa.sort((a, b) => compararValoresEstoque(a, b, ordemSaida.coluna, ordemSaida.direcao));
    atualizarTabelaTorasSaida();
}

function atualizarResumoSaida() {
    const qtdEl = document.getElementById('saidaResumoQtd');
    const volEl = document.getElementById('saidaResumoVolume');
    const qtd = torasSelecionadasBaixa.length;
    const total = torasSelecionadasBaixa.reduce((acc, t) => acc + (parseFloat(t.volumeLiquido) || 0), 0);
    const totalGeo = torasSelecionadasBaixa.reduce((acc, t) => acc + (normalizarCamposGeoEstoque(t).volumeGeo || 0), 0);
    if (qtdEl) qtdEl.textContent = String(qtd);
    if (volEl) volEl.textContent = `${formatNumber(total, 3)} m³ | Geo: ${formatNumber(totalGeo, 3)} m³`;
}

function limparSelecaoRomaneiosSaida() {
    const select = document.getElementById('romaneiosSaidaSelect');
    if (select) select.value = '';
    romaneiosSaidaSelecionados = [];
    renderizarRomaneiosSaidaSelecionados();
}

function obterRomaneiosSaidaSelecionados() {
    return romaneiosSaidaSelecionados.map(r => ({ ...r }));
}

function adicionarRomaneioSaidaSelecionado() {
    const select = document.getElementById('romaneiosSaidaSelect');
    if (!select) return;
    const id = select.value;
    if (!id) return;
    const jaExiste = romaneiosSaidaSelecionados.some(r => String(r.id) === String(id));
    if (jaExiste) return;
    const r = romaneiosSaidaDisponiveis.find(x => String(x.id) === String(id));
    const itensRaw = r ? (r.itens || r.items || r.romaneioItems || []) : [];
    const itens = Array.isArray(itensRaw) ? itensRaw : (itensRaw && typeof itensRaw === 'object' ? Object.values(itensRaw) : []);
    const dataRom = r?.updatedAt || r?.updated || r?.data || r?.dataHora || r?.created || r?.timestamp || '';
    const pessoaRom = String(r?.clienteNome || r?.cliente?.nome || r?.fornecedorNome || r?.fornecedor?.nome || r?.cliente || r?.fornecedor || 'N/A');
    const numeroRom = obterNumeroRomaneioDisplay(r || { id });
    const tipoRom = String(r?.tipo || select.options[select.selectedIndex]?.dataset?.tipo || '').toUpperCase();
    const volumeRom =
        (r && r.totais && (r.totais.volumeSerraria || r.totais.volumeTotal || r.totais.volume)) ||
        r?.totalVolume ||
        r?.volumeSerraria ||
        r?.volumeTotal ||
        r?.volume ||
        itens.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || i.volumeTotal || i.volume || 0) || 0), 0);
    const valorRom = Number(
        (r && r.totais && (r.totais.valorTotal || r.totais.valor)) ||
        r?.totalValor ||
        r?.valorTotal ||
        r?.valor ||
        itens.reduce((acc, i) => acc + (parseFloat(i.valorTotal || i.valor || i.total || i.precoTotal || 0) || 0), 0)
    ) || 0;
    const label = r
        ? `${[tipoRom, numeroRom].filter(Boolean).join(' ')} - ${formatDate(dataRom)} - ${pessoaRom} - ${formatNumber(Number(volumeRom) || 0, 3)} m³ - ${formatCurrency(valorRom)}`
        : (select.options[select.selectedIndex]?.textContent || id);
    romaneiosSaidaSelecionados.push({
        id,
        tipo: tipoRom || r?.tipo || '',
        numero: numeroRom,
        numeroRomaneio: numeroRom,
        label,
        volumeSerraria: Number(volumeRom) || 0,
        valorTotal: valorRom,
        data: dataRom,
        clienteNome: pessoaRom
    });
    select.value = '';
    renderizarRomaneiosSaidaSelecionados();
}

function removerRomaneioSaidaSelecionado(id) {
    romaneiosSaidaSelecionados = romaneiosSaidaSelecionados.filter(r => String(r.id) !== String(id));
    renderizarRomaneiosSaidaSelecionados();
}

function renderizarRomaneiosSaidaSelecionados() {
    const container = document.getElementById('romaneiosSaidaSelecionados');
    if (!container) return;
    if (romaneiosSaidaSelecionados.length === 0) {
        container.innerHTML = '<div style="color:#999;">Nenhum romaneio selecionado</div>';
        return;
    }
    container.innerHTML = romaneiosSaidaSelecionados.map(r => `
        <div class="romaneio-chip">
            <span class="romaneio-chip-label" title="${r.label}">${r.label}</span>
            <button type="button" onclick="removerRomaneioSaidaSelecionado('${String(r.id).replace(/'/g, "\\'")}')" class="btn-danger btn-small">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function montarResumoRomaneioObservacao(lista) {
    const roms = Array.isArray(lista) ? lista : [];
    if (!roms.length) return '';
    return roms.map(r => {
        const label = String((r && r.label) || '').trim();
        const parts = label ? label.split(' - ').map(p => String(p || '').trim()) : [];
        const tipo = String((r && r.tipo) || parts[0] || 'ROM').toUpperCase();
        const data = String(r?.data || r?.updatedAt || r?.created || parts[1] || '').trim();
        const cliente = String(r?.clienteNome || r?.cliente?.nome || r?.fornecedorNome || r?.fornecedor?.nome || parts[2] || '').trim();
        return `Romaneio ${tipo} - ${cliente || 'N/A'}${data ? ` - ${data}` : ''}`;
    }).filter(Boolean).join(' | ');
}

async function registrarSaida(event) {
    event.preventDefault();

    try {
        if (torasSelecionadasBaixa.length === 0) {
            alert('Selecione pelo menos uma tora para baixa');
            return;
        }

        const saidaData = document.getElementById('saidaData').value;
        const documento = saidaModo === 'individual' ? 'Baixa Individual' : 'Baixa por Lote';
        const tipoSaida = document.getElementById('tipoSaida').value;
        const motivo = document.getElementById('motivoSaida').value;
        const romaneiosRelacionados = obterRomaneiosSaidaSelecionados();
        const resumoRomaneiosObs = montarResumoRomaneioObservacao(romaneiosRelacionados);
        const remessaId = generateUniqueId('REM');

        if (!tipoSaida) {
            alert('Selecione o tipo de saída');
            return;
        }

        const novasMovimentacoes = [];
        // Processar cada tora selecionada
        for (const tora of torasSelecionadasBaixa) {
            const geo = normalizarCamposGeoEstoque(tora);
            const ehManualForaEstoque = !!(tora && tora.manualForaEstoque);
            const toraEstoque = ehManualForaEstoque ? null : estoqueAtual.find(t => t.id === tora.id);
            if (toraEstoque) {
                toraEstoque.status = 'baixada';
                toraEstoque.dataBaixa = saidaData;
                toraEstoque.motivoBaixa = motivo;
                toraEstoque.romaneiosRelacionados = romaneiosRelacionados;
                toraEstoque.remessaId = remessaId;
            }

            // Registrar movimentação
            const observacoesParts = [String(tipoSaida || '').toUpperCase()];
            if (resumoRomaneiosObs) observacoesParts.push(resumoRomaneiosObs);
            if (motivo && String(motivo).trim()) observacoesParts.push(String(motivo).trim());
            const observacoes = observacoesParts.filter(Boolean).join(' - ');
            const movimentacao = {
                id: generateUniqueId('MOV'),
                data: saidaData,
                tipo: 'saida',
                tipoSaida: tipoSaida,
                toraId: tora.id,
                plaqueta: tora.plaqueta,
                ...geo,
                especie: tora.especie,
                volume: tora.volumeLiquido,
                documento: documento,
                observacoes: observacoes,
                romaneiosRelacionados: romaneiosRelacionados,
                remessaId: remessaId,
                toraManualForaEstoque: ehManualForaEstoque,
                created: new Date().toISOString()
            };

            movimentacoes.push(movimentacao);
            novasMovimentacoes.push(movimentacao);
        }

        const novosRegistrosRastreabilidade = criarRegistrosRastreabilidadeSaida(novasMovimentacoes, {
            remessaId,
            data: saidaData,
            tipoSaida,
            motivo,
            romaneiosRelacionados,
            origem: 'saida_estoque',
            confiabilidade: romaneiosRelacionados.length ? 'formal' : 'sem_romaneio'
        });
        if (novosRegistrosRastreabilidade.length) {
            const existentes = new Set(rastreabilidadeRegistros.map(r => String(r.id)));
            novosRegistrosRastreabilidade.forEach(reg => {
                if (!existentes.has(String(reg.id))) {
                    rastreabilidadeRegistros.push(reg);
                    existentes.add(String(reg.id));
                }
            });
        }

        // Salvar dados (por registro quando disponível)
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updates = {};
            const alteradas = new Set(torasSelecionadasBaixa.filter(t => !(t && t.manualForaEstoque)).map(t => t.id));
            for (const tora of estoqueAtual) {
                if (alteradas.has(tora.id)) {
                    updates[`estoqueTorasAtual/${String(tora.id)}`] = tora;
                }
            }
            novasMovimentacoes.forEach(mov => {
                updates[`movimentacoesToras/${String(mov.id)}`] = mov;
            });
            novosRegistrosRastreabilidade.forEach(reg => {
                updates[`rastreabilidade/${String(reg.id)}`] = reg;
            });
            const result = await window.firebaseService.updatePaths(updates);
            if (result && result.success === false) throw new Error(result.error || 'Falha ao salvar baixa no Firebase');
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            const alteradas = new Set(torasSelecionadasBaixa.filter(t => !(t && t.manualForaEstoque)).map(t => t.id));
            const ops = [];
            for (const tora of estoqueAtual) {
                if (alteradas.has(tora.id)) {
                    ops.push(window.firebaseService.saveToFirebase('estoqueTorasAtual', String(tora.id), tora));
                }
            }
            novasMovimentacoes.forEach(mov => {
                ops.push(window.firebaseService.saveToFirebase('movimentacoesToras', String(mov.id), mov));
            });
            novosRegistrosRastreabilidade.forEach(reg => {
                ops.push(window.firebaseService.saveToFirebase('rastreabilidade', String(reg.id), reg));
            });
            await Promise.all(ops);
        } else {
            await saveDataAsync('estoqueTorasAtual', estoqueAtual);
            await saveDataAsync('movimentacoesToras', movimentacoes);
            await saveDataAsync('rastreabilidade', rastreabilidadeRegistros);
        }

        const qtdManuais = torasSelecionadasBaixa.filter(t => t && t.manualForaEstoque).length;
        const qtdEstoque = torasSelecionadasBaixa.length - qtdManuais;
        if (qtdManuais > 0) {
            alert(`Baixa registrada com sucesso! ${qtdEstoque} tora(s) baixada(s) do estoque e ${qtdManuais} tora(s) manual(is) registrada(s) no histórico.`);
        } else {
            alert(`Baixa registrada com sucesso! ${qtdEstoque} tora(s) removida(s) do estoque.`);
        }

        // Limpar seleção e formulário
        cancelarSaida();

        // Atualizar dados
        atualizarEstatisticas();
        carregarTabelaEstoque();

    } catch (error) {
        console.error('Erro ao registrar saída:', error);
        alert('Erro ao registrar saída: ' + error.message);
    }
}

function cancelarSaida() {
    document.getElementById('saidaFormContainer').style.display = 'none';
    document.getElementById('saidaForm').reset();
    torasSelecionadasBaixa = [];
    saidaSelecionadas.clear();
    saidaModo = 'lote';
    limparBuscaPlaquetaSaida();
    limparSelecaoRomaneiosSaida();
    const aviso = document.getElementById('saidaIndividualAviso');
    if (aviso) aviso.style.display = 'none';
    atualizarTabelaTorasSaida();
}

function confirmarEstornoBaixaDetalhado(candidatos = [], remessa = '') {
    return new Promise((resolve) => {
        if (!document || !document.body) {
            resolve(confirm('Confirma o estorno das movimentações selecionadas?'));
            return;
        }
        let modal = document.getElementById('confirmEstornoBaixaModal');
        if (!modal) {
            document.body.insertAdjacentHTML('beforeend', `
                <div id="confirmEstornoBaixaModal" class="modal">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3 class="modal-title"><i class="fas fa-undo"></i> Confirmar Estorno</h3>
                            <span class="close-modal" data-estorno-cancelar>&times;</span>
                        </div>
                        <div class="modal-body">
                            <div id="confirmEstornoBaixaResumo" style="line-height:1.45; color:#334155;"></div>
                        </div>
                        <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-secondary" data-estorno-cancelar><i class="fas fa-times"></i> Cancelar</button>
                            <button type="button" class="btn btn-warning" data-estorno-confirmar><i class="fas fa-undo"></i> Confirmar Estorno</button>
                        </div>
                    </div>
                </div>
            `);
            modal = document.getElementById('confirmEstornoBaixaModal');
        }

        const qtd = Array.isArray(candidatos) ? candidatos.length : 0;
        const totalVolume = (candidatos || []).reduce((acc, mov) => acc + (parseNumeroEstoque(mov && mov.volume) || 0), 0);
        const plaquetas = (candidatos || [])
            .map(mov => mov && mov.plaqueta)
            .filter(Boolean)
            .slice(0, 8)
            .map(escapeHtml)
            .join(', ');
        const resumo = document.getElementById('confirmEstornoBaixaResumo');
        if (resumo) {
            resumo.innerHTML = `
                <p style="margin:0 0 10px;"><strong>${qtd}</strong> movimentação(ões) de saída serão estornadas.</p>
                <p style="margin:0 0 10px;">Origem: <strong>${escapeHtml(remessa || 'Selecionadas')}</strong></p>
                <p style="margin:0 0 10px;">Volume a retornar: <strong>${formatNumber(totalVolume, 3)} m³</strong></p>
                ${plaquetas ? `<p style="margin:0 0 10px;">Plaquetas: ${plaquetas}${qtd > 8 ? '...' : ''}</p>` : ''}
                <div class="alert" style="margin:12px 0 0; background:#fff7e6; border:1px solid #ffd591; color:#8c5a00;">
                    Esta ação devolve as toras ao estoque e remove as movimentações de saída correspondentes. Confirme apenas se revisou a remessa/seleção.
                </div>
            `;
        }

        const cleanup = (value) => {
            if (modal) modal.style.display = 'none';
            modal?.querySelectorAll('[data-estorno-cancelar]').forEach(el => {
                el.onclick = null;
            });
            const confirmBtn = modal?.querySelector('[data-estorno-confirmar]');
            if (confirmBtn) confirmBtn.onclick = null;
            resolve(value);
        };

        modal.querySelectorAll('[data-estorno-cancelar]').forEach(el => {
            el.onclick = () => cleanup(false);
        });
        const confirmBtn = modal.querySelector('[data-estorno-confirmar]');
        if (confirmBtn) confirmBtn.onclick = () => cleanup(true);
        modal.onclick = (event) => {
            if (event.target === modal) cleanup(false);
        };
        modal.style.display = 'block';
    });
}

function normalizarChaveRastreabilidade(value) {
    return String(value || '').trim().toLowerCase();
}

async function recarregarRastreabilidadeRegistros() {
    try {
        let raw = null;
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            const result = await window.firebaseService.loadFromFirebase('rastreabilidade');
            raw = result ? (result.data !== undefined ? result.data : result) : null;
        } else {
            raw = await getDataAsync('rastreabilidade');
        }
        if (!raw) return false;
        rastreabilidadeRegistros = normalizarListaFirebaseEstoque(raw)
            .filter(item => !String(item.firebaseKey || item.id || '').startsWith('_'))
            .map(normalizarRegistroRastreabilidade);
        return true;
    } catch (error) {
        console.warn('Não foi possível recarregar rastreabilidade antes do estorno:', error);
        return false;
    }
}

function aplicarMetadadosEstornoRastreabilidade(reg = {}, usuario = obterUsuarioAuditoriaEstoque(), agora = new Date().toISOString()) {
    return {
        ...reg,
        status: 'estornado',
        estornadoEm: agora,
        estornadoPor: usuario.uid || usuario.email || usuario.nome || '',
        estornadoPorNome: usuario.nome || usuario.email || ''
    };
}

function marcarRastreabilidadeEstornada(candidatos = [], remessa = '') {
    const idsMov = new Set((candidatos || []).map(mov => String(mov && mov.id || '')).filter(Boolean));
    const remessas = new Set((candidatos || []).map(mov => normalizarChaveRastreabilidade(mov && mov.remessaId)).filter(Boolean));
    if (remessa && remessa !== 'Selecionadas') remessas.add(normalizarChaveRastreabilidade(remessa));
    const usuario = obterUsuarioAuditoriaEstoque();
    const agora = new Date().toISOString();
    const afetados = [];
    const afetadosPorMovimento = new Set();
    const afetadosPorRemessaPlaqueta = new Set();
    rastreabilidadeRegistros = (rastreabilidadeRegistros || []).map(reg => {
        if (!reg || typeof reg !== 'object') return reg;
        const normalizado = normalizarRegistroRastreabilidade(reg);
        const porMov = idsMov.has(String(normalizado.movimentacaoId || ''));
        const porRemessa = normalizado.remessaId && remessas.has(normalizarChaveRastreabilidade(normalizado.remessaId));
        if (!porMov && !porRemessa) return reg;
        const atualizado = aplicarMetadadosEstornoRastreabilidade(normalizado, usuario, agora);
        if (atualizado.movimentacaoId) afetadosPorMovimento.add(String(atualizado.movimentacaoId));
        if (atualizado.remessaId || atualizado.plaqueta) {
            afetadosPorRemessaPlaqueta.add(`${normalizarChaveRastreabilidade(atualizado.remessaId)}|${normalizarChaveRastreabilidade(atualizado.plaqueta)}`);
        }
        afetados.push(atualizado);
        return atualizado;
    });

    (candidatos || []).forEach(mov => {
        if (!mov || typeof mov !== 'object') return;
        const movId = String(mov.id || '');
        const chaveRemessaPlaqueta = `${normalizarChaveRastreabilidade(mov.remessaId)}|${normalizarChaveRastreabilidade(mov.plaqueta)}`;
        const jaAfetado = (movId && afetadosPorMovimento.has(movId)) || afetadosPorRemessaPlaqueta.has(chaveRemessaPlaqueta);
        if (jaAfetado) return;
        const criado = aplicarMetadadosEstornoRastreabilidade(criarRegistroRastreabilidadeDeMovimento(mov, {
            remessaId: mov.remessaId || remessa || '',
            romaneiosRelacionados: mov.romaneiosRelacionados || [],
            origem: 'estorno_sem_registro_previo',
            confiabilidade: Array.isArray(mov.romaneiosRelacionados) && mov.romaneiosRelacionados.length ? 'derivada' : 'sem_romaneio',
            status: 'estornado'
        }), usuario, agora);
        rastreabilidadeRegistros.push(criado);
        afetados.push(criado);
    });
    return afetados;
}

async function estornarRemessaBaixa() {
    try {
        let candidatos = [];
        let remessa = '';
        const movSelArray = Array.from(movimentacoesSelecionadas);

        if (movSelArray.length > 0) {
            candidatos = movimentacoes.filter(m => movSelArray.includes(String(m.id)) && m.tipo === 'saida');
            if (candidatos.length === 0) {
                alert('Nenhuma movimentação de SAÍDA selecionada para estorno.');
                return;
            }
            if (candidatos.length !== movSelArray.length) {
                alert('Algumas movimentações selecionadas não são de SAÍDA e serão ignoradas.');
            }
            remessa = "Selecionadas";
        } else {
            const input = document.getElementById('filtroRemessaBaixa');
            remessa = input ? String(input.value || '').trim() : '';
            if (!remessa) {
                alert('Selecione movimentações na tabela usando os checkboxes OU informe a Remessa de Baixa (Ex: REM...) para estornar.');
                if (input) input.focus();
                return;
            }
            const remessaNorm = remessa.toLowerCase();
            candidatos = movimentacoes.filter(m => m && String(m.remessaId || '').toLowerCase() === remessaNorm && m.tipo === 'saida');
            if (!candidatos.length) {
                alert('Nenhuma baixa encontrada para esta remessa.');
                return;
            }
        }

        const confirmado = await confirmarEstornoBaixaDetalhado(candidatos, remessa);
        if (!confirmado) return;
        const idsMov = new Set(candidatos.map(m => String(m.id)));
        const idsToras = new Set(candidatos.map(m => m.toraId).filter(Boolean));
        const alteradas = [];
        estoqueAtual.forEach(tora => {
            if (!tora || !idsToras.has(tora.id)) return;
            tora.status = 'disponivel';
            delete tora.dataBaixa;
            delete tora.motivoBaixa;
            delete tora.romaneiosRelacionados;
            delete tora.remessaId;
            alteradas.push(tora);
        });
        if (!alteradas.length) {
            alert('Nenhuma tora correspondente encontrada no estoque. Estorno cancelado.');
            return;
        }
        const movAntes = movimentacoes.length;
        movimentacoes = movimentacoes.filter(m => !idsMov.has(String(m.id)));
        const removidas = movAntes - movimentacoes.length;
        await recarregarRastreabilidadeRegistros();
        const rastreabilidadeAfetada = marcarRastreabilidadeEstornada(candidatos, remessa);
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updates = {};
            alteradas.forEach(tora => {
                updates[`estoqueTorasAtual/${String(tora.id)}`] = tora;
            });
            candidatos.forEach(mov => {
                updates[`movimentacoesToras/${String(mov.id)}`] = null;
            });
            rastreabilidadeAfetada.forEach(reg => {
                updates[`rastreabilidade/${String(reg.id)}`] = reg;
            });
            const result = await window.firebaseService.updatePaths(updates);
            if (result && result.success === false) throw new Error(result.error || 'Falha ao estornar no Firebase');
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            const ops = [];
            alteradas.forEach(tora => {
                ops.push(window.firebaseService.saveToFirebase('estoqueTorasAtual', String(tora.id), tora));
            });
            candidatos.forEach(mov => {
                ops.push(window.firebaseService.saveToFirebase('movimentacoesToras', String(mov.id), null));
            });
            rastreabilidadeAfetada.forEach(reg => {
                ops.push(window.firebaseService.saveToFirebase('rastreabilidade', String(reg.id), reg));
            });
            await Promise.all(ops);
        } else {
            await saveDataAsync('estoqueTorasAtual', estoqueAtual);
            await saveDataAsync('movimentacoesToras', movimentacoes);
            await saveDataAsync('rastreabilidade', rastreabilidadeRegistros);
        }

        movimentacoesSelecionadas.clear();
        const masterCheck = document.getElementById('checkTodasMovimentacoes');
        if (masterCheck) masterCheck.checked = false;

        carregarTabelaMovimentacoes(filtroMovimentacoesAtual);
        atualizarEstatisticas();
        const rastModal = document.getElementById('rastreabilidadeModal');
        if (rastModal && rastModal.style.display === 'block') {
            renderizarRastreabilidade(window.rastreabilidadeFiltrosAtuais || { status: 'ativo' });
        }

        alert(`Remessa/Seleção ${remessa} estornada com sucesso!\nToras restauradas: ${alteradas.length}\nMovimentações removidas: ${removidas}\nRastreabilidade estornada: ${rastreabilidadeAfetada.length}`);
    } catch (error) {
        console.error('Erro ao estornar remessa:', error);
        alert('Erro ao estornar remessa: ' + error.message);
    }
}

function limparBuscaPlaquetaSaida() {
    const input = document.getElementById('saidaPlaquetaBusca');
    if (input) input.value = '';
    toraEncontradaBaixa = null;
    saidaPlaquetaResultados = [];
    saidaPlaquetaSelecionadas.clear();
    const info = document.getElementById('saidaToraInfo');
    if (info) info.textContent = '';
    renderizarResultadosPlaquetaSaida([], '');
    recolherResultadosPlaquetaSaida();
}

function configurarBuscaPlaquetaSaida() {
    const panel = document.getElementById('saidaPlaquetaResultadosPanel');
    if (!panel || panel._saidaPlaquetaConfigured) return;

    panel.addEventListener('pointerdown', (event) => {
        if (event.target && event.target.closest && event.target.closest('input[type="checkbox"]')) return;
        const action = event.target.closest('[data-tora-baixa-action]');
        const row = event.target.closest('[data-tora-baixa-id]');
        if (!action && !row) return;
        event.preventDefault();
        const id = (action || row).getAttribute('data-tora-baixa-id');
        if (!id) return;
        if (action && action.getAttribute('data-tora-baixa-action') === 'add') {
            adicionarToraBaixaPorPlaquetaId(id);
        } else {
            selecionarToraBaixaPorPlaquetaId(id, true);
        }
    });

    panel._saidaPlaquetaConfigured = true;
}

function setResultadosPlaquetaSaidaVisiveis(visible) {
    const panel = document.getElementById('saidaPlaquetaResultadosPanel');
    const input = document.getElementById('saidaPlaquetaBusca');
    if (!panel) return;
    panel.classList.toggle('is-open', !!visible);
    panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (input) input.setAttribute('aria-expanded', visible ? 'true' : 'false');
}

function abrirResultadosPlaquetaSaida() {
    if (saidaPlaquetaRecolherTimer) {
        clearTimeout(saidaPlaquetaRecolherTimer);
        saidaPlaquetaRecolherTimer = null;
    }
    const input = document.getElementById('saidaPlaquetaBusca');
    const termo = String((input && input.value) || '').trim().toLowerCase();
    const candidatos = obterCandidatosPlaquetaSaida(termo);
    renderizarResultadosPlaquetaSaida(candidatos, termo);
    setResultadosPlaquetaSaidaVisiveis(true);
}

function recolherResultadosPlaquetaSaida() {
    if (saidaPlaquetaRecolherTimer) {
        clearTimeout(saidaPlaquetaRecolherTimer);
        saidaPlaquetaRecolherTimer = null;
    }
    setResultadosPlaquetaSaidaVisiveis(false);
}

function agendarRecolherResultadosPlaquetaSaida() {
    if (saidaPlaquetaRecolherTimer) clearTimeout(saidaPlaquetaRecolherTimer);
    saidaPlaquetaRecolherTimer = setTimeout(() => {
        const panel = document.getElementById('saidaPlaquetaResultadosPanel');
        const input = document.getElementById('saidaPlaquetaBusca');
        const active = document.activeElement;
        if ((input && active === input) || (panel && panel.contains(active))) return;
        recolherResultadosPlaquetaSaida();
    }, 120);
}

function obterCandidatosPlaquetaSaida(termo = '') {
    const filtro = String(termo || '').trim().toLowerCase();
    const selecionadas = new Set((torasSelecionadasBaixa || []).map(t => String(t && t.id)));
    const disponiveis = (estoqueAtual || []).filter(t => t && t.status === 'disponivel' && !selecionadas.has(String(t.id)));
    const candidatos = filtro
        ? disponiveis.filter(t => String(t.plaqueta || '').toLowerCase().includes(filtro))
        : disponiveis;

    return candidatos.sort((a, b) => {
        const pa = String(a.plaqueta || '').toLowerCase();
        const pb = String(b.plaqueta || '').toLowerCase();
        const scoreA = filtro && pa === filtro ? 0 : (filtro && pa.startsWith(filtro) ? 1 : 2);
        const scoreB = filtro && pb === filtro ? 0 : (filtro && pb.startsWith(filtro) ? 1 : 2);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return pa.localeCompare(pb, 'pt-BR', { numeric: true });
    }).slice(0, 50);
}

function atualizarInfoToraBaixa(tora = null, mensagem = '') {
    const info = document.getElementById('saidaToraInfo');
    if (!info) return;
    if (!tora) {
        info.textContent = mensagem || '';
        return;
    }
    const vol = formatNumber(tora.volumeLiquido || 0, 3);
    const preco = formatCurrency(tora.precoCusto || 0);
    info.textContent = `${tora.plaqueta} | ${tora.especie} | ${vol} m³ | ${preco}`;
}

function renderizarResultadosPlaquetaSaida(candidatos = [], termo = '') {
    const body = document.getElementById('saidaPlaquetaResultadosBody');
    const resumo = document.getElementById('saidaPlaquetaResultadosResumo');
    if (!body) return;

    saidaPlaquetaResultados = Array.isArray(candidatos) ? candidatos : [];
    const idsVisiveis = new Set(saidaPlaquetaResultados.map(t => String(t && t.id)));
    saidaPlaquetaSelecionadas = new Set(Array.from(saidaPlaquetaSelecionadas).filter(id => idsVisiveis.has(String(id))));
    const termoLabel = String(termo || '').trim();
    if (resumo) {
        if (!termoLabel && saidaPlaquetaResultados.length > 0) {
            resumo.textContent = `Toras disponíveis para baixa (${saidaPlaquetaResultados.length > 50 ? '50+' : saidaPlaquetaResultados.length})`;
        } else if (saidaPlaquetaResultados.length === 0) {
            resumo.textContent = termoLabel ? 'Nenhuma tora disponível encontrada' : 'Digite uma plaqueta para localizar toras disponíveis';
        } else {
            resumo.textContent = `${saidaPlaquetaResultados.length} resultado(s) para "${termoLabel}"`;
        }
    }

    if (saidaPlaquetaResultados.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="10" class="saida-plaqueta-results-empty">${termoLabel ? 'Nenhuma tora disponível encontrada para esta plaqueta.' : 'Digite uma plaqueta para localizar toras disponíveis.'}</td>
            </tr>
        `;
        atualizarControlesPlaquetaSaida();
        return;
    }

    body.innerHTML = saidaPlaquetaResultados.map((tora) => {
        const id = String(tora.id);
        const idAttr = escapeHtml(id);
        const idJs = id.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const selected = toraEncontradaBaixa && String(toraEncontradaBaixa.id) === id;
        const checked = saidaPlaquetaSelecionadas.has(id) ? 'checked' : '';
        const geo = normalizarCamposGeoEstoque(tora);
        return `
            <tr class="${selected || checked ? 'is-selected' : ''}" data-tora-baixa-id="${idAttr}" tabindex="0">
                <td class="saida-plaqueta-check-col">
                    <input type="checkbox" class="check-plaqueta-saida" value="${idAttr}" ${checked} onchange="toggleToraPlaquetaSaida('${idJs}', this.checked)">
                </td>
                <td><strong>${escapeHtml(tora.plaqueta || '-')}</strong></td>
                <td>${escapeHtml(geo.custodia || '-')}</td>
                <td>${escapeHtml(tora.especie || '-')}</td>
                <td>${formatNumber(tora.diametro || 0, 1)} cm</td>
                <td>${formatNumber(tora.comprimento || 0, 1)} cm</td>
                <td class="text-right">${formatNumber(tora.volumeLiquido || 0, 3)} m³</td>
                <td class="text-right">${formatarVolumeGeoEstoque(geo.volumeGeo)} m³</td>
                <td>${escapeHtml(tora.localizacao || '-')}</td>
                <td class="saida-plaqueta-actions-col">
                    <button type="button" class="btn btn-primary btn-small saida-plaqueta-add-btn" data-tora-baixa-action="add" data-tora-baixa-id="${idAttr}">
                        <i class="fas fa-plus"></i> Adicionar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    atualizarControlesPlaquetaSaida();
}

function atualizarControlesPlaquetaSaida() {
    const master = document.getElementById('checkTodasPlaquetaSaida');
    const btn = document.getElementById('saidaPlaquetaAdicionarSelecionadasBtn');
    const idsVisiveis = (saidaPlaquetaResultados || []).map(t => String(t && t.id)).filter(Boolean);
    const selecionadasVisiveis = idsVisiveis.filter(id => saidaPlaquetaSelecionadas.has(id));
    if (master) {
        master.checked = idsVisiveis.length > 0 && selecionadasVisiveis.length === idsVisiveis.length;
        master.indeterminate = selecionadasVisiveis.length > 0 && selecionadasVisiveis.length < idsVisiveis.length;
        master.disabled = idsVisiveis.length === 0;
    }
    if (btn) {
        btn.disabled = selecionadasVisiveis.length === 0;
        btn.innerHTML = `<i class="fas fa-plus"></i> Adicionar Selecionadas${selecionadasVisiveis.length ? ` (${selecionadasVisiveis.length})` : ''}`;
    }
}

function toggleToraPlaquetaSaida(toraId, isChecked) {
    const id = String(toraId || '');
    if (!id) return;
    if (isChecked) saidaPlaquetaSelecionadas.add(id);
    else saidaPlaquetaSelecionadas.delete(id);
    const row = Array.from(document.querySelectorAll('#saidaPlaquetaResultadosBody [data-tora-baixa-id]'))
        .find(el => el.getAttribute('data-tora-baixa-id') === id);
    if (row) row.classList.toggle('is-selected', !!isChecked || (toraEncontradaBaixa && String(toraEncontradaBaixa.id) === id));
    atualizarControlesPlaquetaSaida();
}

function toggleTodasPlaquetaSaida(checked) {
    (saidaPlaquetaResultados || []).forEach(tora => {
        if (!tora || tora.id == null) return;
        const id = String(tora.id);
        if (checked) saidaPlaquetaSelecionadas.add(id);
        else saidaPlaquetaSelecionadas.delete(id);
    });
    document.querySelectorAll('#saidaPlaquetaResultadosBody .check-plaqueta-saida').forEach(cb => {
        cb.checked = !!checked;
        const row = cb.closest('tr');
        if (row) row.classList.toggle('is-selected', !!checked);
    });
    atualizarControlesPlaquetaSaida();
}

function buscarToraPorPlaqueta() {
    const input = document.getElementById('saidaPlaquetaBusca');
    if (!input) return;
    const termo = String(input.value || '').trim().toLowerCase();
    const candidatos = obterCandidatosPlaquetaSaida(termo);
    renderizarResultadosPlaquetaSaida(candidatos, termo);
    setResultadosPlaquetaSaidaVisiveis(true);

    if (!termo) {
        toraEncontradaBaixa = null;
        atualizarInfoToraBaixa(null, 'Digite uma plaqueta para localizar toras disponíveis.');
        return;
    }
    if (candidatos.length === 0) {
        toraEncontradaBaixa = null;
        atualizarInfoToraBaixa(null, 'Nenhuma tora encontrada');
        return;
    }
    const exata = candidatos.find(t => String(t.plaqueta || '').toLowerCase() === termo);
    const selecionada = exata || (candidatos.length === 1 ? candidatos[0] : null);
    if (!selecionada) {
        toraEncontradaBaixa = null;
        atualizarInfoToraBaixa(null, `Encontradas ${candidatos.length} toras, selecione uma na lista`);
        return;
    }
    toraEncontradaBaixa = selecionada;
    atualizarInfoToraBaixa(selecionada);
    renderizarResultadosPlaquetaSaida(candidatos, termo);
}

function selecionarToraBaixaPorPlaquetaId(toraId, manterPainelAberto = false) {
    const tora = (estoqueAtual || []).find(t => String(t && t.id) === String(toraId));
    if (!tora) return;
    toraEncontradaBaixa = tora;
    const input = document.getElementById('saidaPlaquetaBusca');
    if (input) input.value = tora.plaqueta || '';
    atualizarInfoToraBaixa(tora);
    renderizarResultadosPlaquetaSaida(obterCandidatosPlaquetaSaida(String(tora.plaqueta || '').toLowerCase()), String(tora.plaqueta || '').toLowerCase());
    if (manterPainelAberto) setResultadosPlaquetaSaidaVisiveis(true);
}

function adicionarToraNaBaixa(tora, options = {}) {
    if (!tora || tora.id == null) return false;
    const exists = torasSelecionadasBaixa.some(t => String(t.id) === String(tora.id));
    if (exists) {
        if (options.alertDuplicate !== false) alert('Esta tora já está na lista de baixa.');
        return false;
    }
    torasSelecionadasBaixa.push(tora);
    return true;
}

function finalizarAdicaoPlaquetaSaida(mensagem = '') {
    atualizarTabelaTorasSaida();
    limparBuscaPlaquetaSaida();
    const input = document.getElementById('saidaPlaquetaBusca');
    if (input) input.focus();
    if (mensagem) atualizarInfoToraBaixa(null, mensagem);
}

function adicionarToraBaixaPorPlaqueta() {
    if (!toraEncontradaBaixa) {
        alert('Busque uma plaqueta válida antes de adicionar.');
        return false;
    }
    const adicionada = adicionarToraNaBaixa(toraEncontradaBaixa);
    if (adicionada) finalizarAdicaoPlaquetaSaida('Tora adicionada à baixa. Digite outra plaqueta para continuar.');
    return adicionada;
}

function adicionarToraBaixaPorPlaquetaId(toraId) {
    selecionarToraBaixaPorPlaquetaId(toraId, false);
    adicionarToraBaixaPorPlaqueta();
}

function adicionarTorasPlaquetaSelecionadas() {
    const ids = Array.from(saidaPlaquetaSelecionadas);
    if (ids.length === 0) {
        alert('Selecione pelo menos uma tora na lista.');
        return;
    }
    let adicionadas = 0;
    ids.forEach(id => {
        const tora = (estoqueAtual || []).find(t => String(t && t.id) === String(id));
        if (adicionarToraNaBaixa(tora, { alertDuplicate: false })) adicionadas++;
    });
    if (adicionadas === 0) {
        alert('Nenhuma tora nova foi adicionada. Verifique se elas já estão na tabela de baixa.');
        return;
    }
    finalizarAdicaoPlaquetaSaida(`${adicionadas} tora(s) adicionada(s) à baixa. Digite outra plaqueta para continuar.`);
}

function onSaidaPlaquetaKeydown(event) {
    if (!event) return;
    if (event.key === 'Escape') {
        recolherResultadosPlaquetaSaida();
        return;
    }
    if (event.key !== 'Enter') return;
    event.preventDefault();
    buscarToraPorPlaqueta();
    if (!toraEncontradaBaixa && saidaPlaquetaResultados.length === 1) {
        toraEncontradaBaixa = saidaPlaquetaResultados[0];
    }
    adicionarToraBaixaPorPlaqueta();
}

function onManualSaidaKeydown(event, nextFieldId = '') {
    if (!event || event.key !== 'Enter') return;
    event.preventDefault();
    if (nextFieldId) {
        const nextEl = document.getElementById(nextFieldId);
        if (nextEl) {
            nextEl.focus();
            if (typeof nextEl.select === 'function') nextEl.select();
        }
        return;
    }
    adicionarToraManualSaida();
    const firstEl = document.getElementById('manualPlaquetaSaida');
    if (firstEl) firstEl.focus();
}

// Funções de consulta de estoque
function atualizarEstatisticas() {
    const torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');

    // Total de toras
    document.getElementById('totalToras').textContent = torasDisponiveis.length;

    // Volume total
    const volumeTotal = torasDisponiveis.reduce((total, tora) => total + (tora.volumeLiquido || 0), 0);
    document.getElementById('volumeTotal').textContent = formatNumber(volumeTotal, 3) + ' m³';

    // Valor do estoque
    const valorTotal = torasDisponiveis.reduce((total, tora) => total + ((tora.volumeLiquido || 0) * (tora.precoCusto || 0)), 0);
    document.getElementById('valorEstoque').textContent = formatCurrency(valorTotal);

    // Espécies únicas
    const especies = [...new Set(torasDisponiveis.map(tora => tora.especie))];
    document.getElementById('especiesUnicas').textContent = especies.length;
}

function carregarTabelaEstoque(filtro = {}) {
    const tbody = document.getElementById('estoqueTable');
    filtroEstoqueAtual = filtro || {};
    let torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');

    // Aplicar filtros
    const especieFiltro = String(filtro.especie || '').trim().toLowerCase();
    if (especieFiltro) {
        torasDisponiveis = torasDisponiveis.filter(t => String(t.especie || '').toLowerCase().includes(especieFiltro));
    }

    if (filtro.localizacao) {
        torasDisponiveis = torasDisponiveis.filter(t => t.localizacao === filtro.localizacao);
    }

    if (filtro.busca) {
        const buscaLower = filtro.busca.toLowerCase();
        torasDisponiveis = torasDisponiveis.filter(t =>
            String(t.plaqueta || '').toLowerCase().includes(buscaLower) ||
            String(t.especie || '').toLowerCase().includes(buscaLower) ||
            (t.localizacao && t.localizacao.toLowerCase().includes(buscaLower))
        );
    }

    // Ordenar por coluna configurada
    torasDisponiveis.sort((a, b) => compararValoresEstoque(a, b, ordemEstoque.coluna, ordemEstoque.direcao));

    estoqueFiltrado = torasDisponiveis.slice();
    const resumoEl = document.getElementById('resumoEstoque');
    const totalVol = estoqueFiltrado.reduce((acc, t) => acc + (t.volumeLiquido || 0), 0);
    const totalGeo = estoqueFiltrado.reduce((acc, t) => acc + (normalizarCamposGeoEstoque(t).volumeGeo || 0), 0);
    const totalVal = estoqueFiltrado.reduce((acc, t) => acc + ((t.volumeLiquido || 0) * (t.precoCusto || 0)), 0);
    if (resumoEl) {
        resumoEl.innerHTML = `
            <div class="summary-row">
                <span>Total de Toras:</span>
                <span>${estoqueFiltrado.length}</span>
            </div>
            <div class="summary-row">
                <span>Volume Líquido Total:</span>
                <span>${formatNumber(totalVol, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Volume Geométrico Total:</span>
                <span>${formatNumber(totalGeo, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Valor Total:</span>
                <span>${formatCurrency(totalVal)}</span>
            </div>
        `;
    }

    if (torasDisponiveis.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${getVisibleConsultaColumnsCount() + 2}" style="text-align: center;">Nenhuma tora encontrada no estoque</td></tr>`;
        renderizarPaginacaoPadrao('paginacaoEstoque', 0, 1, obterItensPorPaginaTabela('consulta'), 'mudarPaginaEstoque', { sizeScope: 'consulta' });
        applyConsultaColumnsConfig();
        return;
    }

    const itensPorPaginaEstoque = obterItensPorPaginaTabela('consulta');
    const totalPaginas = Math.max(1, Math.ceil(torasDisponiveis.length / itensPorPaginaEstoque));
    if (paginaAtualEstoque > totalPaginas) paginaAtualEstoque = totalPaginas;
    if (paginaAtualEstoque < 1) paginaAtualEstoque = 1;
    const inicio = (paginaAtualEstoque - 1) * itensPorPaginaEstoque;
    const pagina = torasDisponiveis.slice(inicio, inicio + itensPorPaginaEstoque);

    const consultaDefs = getConsultaColumnsDefs();
    tbody.innerHTML = pagina.map(tora => {
        const isChecked = estoqueSelecionadas.has(String(tora.id)) ? 'checked' : '';
        return `
        <tr>
            <td class="text-center"><input type="checkbox" class="check-estoque" value="${tora.id}" ${isChecked} onchange="toggleEstoque('${tora.id}', this.checked)"></td>
            ${consultaDefs.map(def => renderConsultaEstoqueTd(def, tora)).join('')}
            <td class="text-center actions-cell sticky-actions">
                <div class="actions-cell-inner">
                    <button onclick="editarTora('${tora.id}')" class="btn-primary btn-small">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="excluirTora('${tora.id}')" class="btn-danger btn-small">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
    renderizarPaginacaoPadrao('paginacaoEstoque', torasDisponiveis.length, paginaAtualEstoque, itensPorPaginaEstoque, 'mudarPaginaEstoque', { sizeScope: 'consulta' });
    applyConsultaColumnsConfig();
    atualizarCheckTodoEstoqueVisivel();
}

function toggleTodoEstoque() {
    const master = document.getElementById('checkTodoEstoque');
    const checks = document.querySelectorAll('.check-estoque');
    checks.forEach(c => {
        c.checked = master.checked;
        if (master.checked) {
            estoqueSelecionadas.add(c.value);
        } else {
            estoqueSelecionadas.delete(c.value);
        }
    });
}

function toggleEstoque(id, isChecked) {
    if (isChecked) {
        estoqueSelecionadas.add(id);
    } else {
        estoqueSelecionadas.delete(id);
        const master = document.getElementById('checkTodoEstoque');
        if (master) master.checked = false;
    }
}

function atualizarCheckTodoEstoqueVisivel() {
    const master = document.getElementById('checkTodoEstoque');
    if (!master) return;
    const checks = Array.from(document.querySelectorAll('.check-estoque'));
    master.checked = checks.length > 0 && checks.every(c => c.checked);
}

function obterFiltroConsultaEstoqueAtual(buscaOverride = null) {
    const filtroEspecieEl = document.getElementById('filtroEspecie');
    const filtroLocalizacaoEl = document.getElementById('filtroLocalizacao');
    const searchEstoqueEl = document.getElementById('searchEstoque');
    return {
        especie: String((filtroEspecieEl && filtroEspecieEl.value) || '').trim(),
        localizacao: String((filtroLocalizacaoEl && filtroLocalizacaoEl.value) || '').trim(),
        busca: buscaOverride === null
            ? String((searchEstoqueEl && searchEstoqueEl.value) || '').trim()
            : String(buscaOverride || '').trim()
    };
}

function onBuscaEstoqueEnter(event) {
    if (!event || event.key !== 'Enter') return;
    event.preventDefault();

    const input = document.getElementById('searchEstoque');
    if (!input) return;

    const termo = String(input.value || '').trim();
    if (!termo) {
        filtrarEstoque();
        input.focus();
        return;
    }

    paginaAtualEstoque = 1;
    carregarTabelaEstoque(obterFiltroConsultaEstoqueAtual(termo));

    const chavePlaqueta = normalizarChavePlaqueta(termo);
    const exatas = estoqueFiltrado.filter(t => normalizarChavePlaqueta(t && t.plaqueta) === chavePlaqueta);
    const torasParaSelecionar = exatas.length > 0 ? exatas : estoqueFiltrado;

    torasParaSelecionar.forEach((tora) => {
        if (tora && tora.id) estoqueSelecionadas.add(String(tora.id));
    });

    input.value = '';
    paginaAtualEstoque = 1;
    carregarTabelaEstoque(obterFiltroConsultaEstoqueAtual(''));
    atualizarCheckTodoEstoqueVisivel();

    setTimeout(() => {
        input.focus();
        if (typeof input.select === 'function') input.select();
    }, 0);
}

function ordenarEstoque(coluna) {
    if (ordemEstoque.coluna === coluna) {
        ordemEstoque.direcao = ordemEstoque.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        ordemEstoque.coluna = coluna;
        ordemEstoque.direcao = 'asc';
    }
    document.querySelectorAll('#estoqueTable th .sort-icon, #consulta thead .sort-icon').forEach(icon => {
        if (icon.id && icon.id.startsWith('sort-estoque-')) {
            icon.className = 'fas fa-sort sort-icon';
        }
    });
    const iconEl = document.getElementById(`sort-estoque-${coluna}`);
    if (iconEl) {
        iconEl.className = `fas fa-sort-${ordemEstoque.direcao === 'asc' ? 'up' : 'down'} sort-icon`;
    }
    carregarTabelaEstoque(filtroEstoqueAtual);
}

function mudarPaginaEstoque(p) {
    paginaAtualEstoque = p;
    carregarTabelaEstoque(filtroEstoqueAtual);
}

async function editarTora(toraId) {
    const tora = estoqueAtual.find(t => String(t.id) === String(toraId));
    if (!tora) return;
    if ((!especiesEntradaCarregadas || especiesEntradaCadastradas.length === 0) && !especiesEntradaErroCarga) {
        await carregarEspeciesEntrada();
    }
    toraEmEdicao = tora;
    showTab('entrada');
    setModoEdicaoEntrada(tora);

    const romaneioId = getRomaneioIdFromTora(tora);
    const romaneio = findRomaneioEntradaById(romaneioId);
    const fornecedorInfo = getFornecedorInfoFromTora(tora, romaneio);
    garantirFornecedorOption(fornecedorInfo);
    const fornecedorSelect = document.getElementById('fornecedorSelect');
    if (fornecedorSelect && fornecedorInfo.id) {
        fornecedorSelect.value = fornecedorInfo.id;
        await carregarRomaneiosParaSelect(fornecedorInfo.id);
    } else {
        await carregarRomaneiosParaSelect('');
    }
    const romaneioSelect = document.getElementById('romaneioEntradaSelect');
    const romaneioValue = garantirRomaneioOption(romaneio, romaneioId);
    if (romaneioSelect && romaneioValue) {
        romaneioSelect.value = romaneioValue;
        romaneioSelecionadoId = romaneioValue;
    } else {
        romaneioSelecionadoId = null;
    }

    const entradaData = document.getElementById('entradaData');
    if (entradaData) entradaData.value = tora.data || new Date().toISOString().split('T')[0];
    const plaqueta = document.getElementById('plaquetaEntrada');
    if (plaqueta) plaqueta.value = tora.plaqueta || '';
    aplicarCamposGeoEntrada(tora);
    const especie = document.getElementById('especieEntrada');
    if (especie) especie.value = normalizarNomeEspecieCadastrada(tora.especie || '');
    const diametro = document.getElementById('diametroEntrada');
    if (diametro) diametro.value = tora.diametro || '';
    const comprimento = document.getElementById('comprimentoEntrada');
    if (comprimento) comprimento.value = tora.comprimento || '';
    const oco1 = document.getElementById('oco1Entrada');
    if (oco1) oco1.value = tora.oco1 || '';
    const oco2 = document.getElementById('oco2Entrada');
    if (oco2) oco2.value = tora.oco2 || '';
    const preco = document.getElementById('precoEntrada');
    if (preco) preco.value = formatCurrency(tora.precoCusto || tora.preco || 0);
    const m3Bruto = document.getElementById('m3BrutoEntrada');
    if (m3Bruto) m3Bruto.value = tora.volumeBruto || '';
    const m3Liquido = document.getElementById('m3LiquidoEntrada');
    if (m3Liquido) m3Liquido.value = tora.volumeLiquido || tora.volumeSerraria || '';
    const foco = document.getElementById('plaquetaEntrada');
    if (foco) foco.focus();
}

function filtrarEstoque() {
    paginaAtualEstoque = 1;
    carregarTabelaEstoque(obterFiltroConsultaEstoqueAtual());
}

function atualizarFiltros() {
    if (!Array.isArray(estoqueAtual)) return;

    // Atualizar filtro de espécies
    const especies = [...new Set(estoqueAtual.filter(t => t && t.status === 'disponivel').map(t => t.especie))];
    const selectEspecie = document.getElementById('filtroEspecie');
    if (selectEspecie && selectEspecie.tagName === 'SELECT') {
        selectEspecie.innerHTML = '<option value="">Todas as espécies</option>';
        especies.filter(e => e).sort().forEach(especie => {
            const option = document.createElement('option');
            option.value = especie;
            option.textContent = especie;
            selectEspecie.appendChild(option);
        });
    }

    // Atualizar filtro de localizações
    const localizacoes = [...new Set(estoqueAtual.filter(t => t && t.status === 'disponivel' && t.localizacao).map(t => t.localizacao))];
    const selectLocalizacao = document.getElementById('filtroLocalizacao');
    if (selectLocalizacao) {
        selectLocalizacao.innerHTML = '<option value="">Todas as localizações</option>';
        localizacoes.filter(l => l).sort().forEach(localizacao => {
            const option = document.createElement('option');
            option.value = localizacao;
            option.textContent = localizacao;
            selectLocalizacao.appendChild(option);
        });
    }
}

async function excluirTora(toraId) {
    if (!confirm('Deseja excluir esta tora do estoque? Esta ação não pode ser desfeita.')) {
        return;
    }

    try {
        // Capturar tora antes de remover para registrar movimentação corretamente
        const toraOriginal = estoqueAtual.find(t => t.id === toraId);
        // Remover do estoque
        estoqueAtual = estoqueAtual.filter(t => t.id !== toraId);

        // Registrar movimentação de exclusão
        if (toraOriginal) {
            const geo = normalizarCamposGeoEstoque(toraOriginal);
            const movimentacao = {
                id: generateUniqueId('MOV'),
                data: new Date().toISOString().split('T')[0],
                tipo: 'exclusao',
                toraId: toraId,
                plaqueta: toraOriginal.plaqueta,
                ...geo,
                especie: toraOriginal.especie,
                volume: toraOriginal.volumeLiquido,
                observacoes: 'Exclusão do sistema',
                created: new Date().toISOString()
            };
            movimentacoes.push(movimentacao);
        }

        // Salvar dados (por registro quando disponível)
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            await window.firebaseService.saveToFirebase('estoqueTorasAtual', String(toraId), null);
            const mov = movimentacoes[movimentacoes.length - 1];
            if (mov) {
                await window.firebaseService.saveToFirebase('movimentacoesToras', String(mov.id), mov);
            }
        } else {
            await saveData('estoqueTorasAtual', estoqueAtual);
            await saveData('movimentacoesToras', movimentacoes);
        }

        // Atualizar interface
        atualizarEstatisticas();
        carregarTabelaEstoque();
        atualizarFiltros();

        alert('Tora excluída com sucesso!');

    } catch (error) {
        console.error('Erro ao excluir tora:', error);
        alert('Erro ao excluir tora: ' + error.message);
    }
}

// Funções de movimentações
function isCarregoPedidoLike(r) {
    if (!r) return false;
    const parts = [];
    if (typeof r === 'string') {
        parts.push(r);
    } else if (typeof r === 'object') {
        parts.push(r.tipo, r.origem, r.label, r.documento, r.descricao, r.nome);
    }
    const joined = parts.filter(Boolean).map(s => String(s).toLowerCase()).join(' ');
    if (!joined) return false;
    if (joined.includes('carrego')) return true;
    if (joined.includes('carregamento')) return true;
    return false;
}

async function calcularResumoMovimentacoes(lista) {
    const totalVol = lista.reduce((acc, m) => acc + (m.volume || 0), 0);
    const totalEntradas = lista.filter(m => m.tipo === 'entrada').length;
    const totalSaidas = lista.filter(m => m.tipo === 'saida').length;
    const saidas = lista.filter(m => m.tipo === 'saida');
    const volumeTorasSaidas = saidas.reduce((acc, m) => acc + (m.volume || 0), 0);
    const extractRomaneioIdsFromLabel = (label) => {
        const s = String(label || '');
        const ids = [];
        const re = /([A-Z]{2,5}[_-]\d{10,}[_A-Za-z0-9-]+)/g;
        let match;
        while ((match = re.exec(s)) !== null) {
            if (match[1]) ids.push(match[1]);
        }
        return ids;
    };
    const isCarregoItem = (item) => {
        if (!item) return false;
        const parts = [
            item.tipo,
            item.origem,
            item.descricao,
            item.produtoNome,
            item.nome,
            item.observacoes
        ].filter(Boolean).map(v => String(v).toLowerCase());
        if (!parts.length) return false;
        const joined = parts.join(' ');
        return joined.includes('carrego') || joined.includes('carregamento');
    };
    const getRomaneioItems = (r) => {
        if (!r || typeof r !== 'object') return [];
        const raw = r.itens || r.items || r.romaneioItems || [];
        if (Array.isArray(raw)) return raw;
        if (raw && typeof raw === 'object') return Object.values(raw);
        return [];
    };
    const isRomaneioLike = (r) => {
        if (!r || typeof r !== 'object') return false;
        const tipo = String(r.tipo || r.origem || '').toUpperCase();
        if (['TORA','TL','PCT','PES','ROM','ROMANEIO','ROMANEIO_TL','ROMANEIO_PCT','ROMANEIO_PES','ROMANEIO_TORA'].includes(tipo)) return true;
        const hasId = !!(r.romaneioId || r.numeroRomaneio);
        const itens = getRomaneioItems(r);
        const hasRomItem = itens.some(i => i && (i.volumeSerraria !== undefined || i.volumeLiquido !== undefined || i.espessura !== undefined || i.largura !== undefined || i.comprimento !== undefined));
        return hasId && hasRomItem;
    };
    const labelLooksRomaneio = (label) => {
        const s = String(label || '').trim();
        return /^(ROM|TORA|TL|PCT|PES)\b/i.test(s);
    };
    const tipoFromLabel = (label) => {
        const s = String(label || '').trim().toUpperCase();
        if (!s) return '';
        if (s.startsWith('TL')) return 'TL';
        if (s.startsWith('PCT')) return 'PCT';
        if (s.startsWith('PES')) return 'PES';
        if (s.startsWith('TORA')) return 'TORA';
        return '';
    };
    const isSerradoTipo = (tipo) => {
        const t = String(tipo || '').toUpperCase();
        return t === 'TL' || t === 'PCT' || t === 'PES' || t === 'ROMANEIO_TL' || t === 'ROMANEIO_PCT' || t === 'ROMANEIO_PES';
    };
    const romaneiosAll = []
        .concat(Array.isArray(romaneiosSaidaDisponiveis) ? romaneiosSaidaDisponiveis : [])
        .concat(Array.isArray(romaneiosDisponiveis) ? romaneiosDisponiveis : []);
    const romaneioMap = new Map();
    romaneiosAll.forEach(r => {
        const keys = [r && r.id, r && r.romaneioId, r && r.key, r && r.firebaseKey, r && r.uniqueKey, r && r.numero, r && r.numeroRomaneio].filter(Boolean);
        keys.forEach(k => romaneioMap.set(String(k), r));
    });
    const refs = [];
    const idsFromRefs = new Set();
    saidas.forEach(m => {
        const listaRel = Array.isArray(m.romaneiosRelacionados) ? m.romaneiosRelacionados : [];
        listaRel.forEach(r => {
            if (isCarregoPedidoLike(r)) return;
            const id = (r && typeof r === 'object')
                ? (r.id || r.romaneioId || r.value || r.key || r.firebaseKey || r.uniqueKey)
                : r;
            const label = (r && r.label) ? r.label : '';
            const labelIds = label ? extractRomaneioIdsFromLabel(label) : [];
            if (id !== undefined && id !== null && String(id).trim()) idsFromRefs.add(String(id));
            labelIds.forEach(x => idsFromRefs.add(String(x)));
            refs.push({ r, id: id !== undefined && id !== null ? String(id) : '', label, labelIds });
        });
    });
    const remessasSaida = new Set(saidas.map(m => String(m.remessaId || '').trim()).filter(Boolean));
    if (remessasSaida.size > 0 && Array.isArray(estoqueAtual)) {
        estoqueAtual.forEach(t => {
            const rem = String(t && t.remessaId || '').trim();
            if (!rem || !remessasSaida.has(rem)) return;
            const listaRel = Array.isArray(t.romaneiosRelacionados) ? t.romaneiosRelacionados : [];
            listaRel.forEach(r => {
                if (isCarregoPedidoLike(r)) return;
                const id = (r && typeof r === 'object')
                    ? (r.id || r.romaneioId || r.value || r.key || r.firebaseKey || r.uniqueKey)
                    : r;
                const label = (r && r.label) ? r.label : '';
                const labelIds = label ? extractRomaneioIdsFromLabel(label) : [];
                if (id !== undefined && id !== null && String(id).trim()) idsFromRefs.add(String(id));
                labelIds.forEach(x => idsFromRefs.add(String(x)));
                refs.push({ r, id: id !== undefined && id !== null ? String(id) : '', label, labelIds });
            });
        });
    }
    const missingIds = Array.from(idsFromRefs).filter(id => !romaneioMap.has(String(id)));
    if (missingIds.length) {
        const normalizeList = (raw, tipo) => {
            const utils = window.RomaneioDataUtils;
            const listaN = utils && typeof utils.normalizeRomaneioCollection === 'function'
                ? utils.normalizeRomaneioCollection(raw, { type: tipo })
                : normalizarListaFirebaseEstoque(raw);
            return listaN
                .filter(r => r && typeof r === 'object' && !isRegistroTecnicoFirebaseEstoque(r) && (r.id || r.firebaseKey || r.key || r.romaneioId))
                .map(r => ({ ...r, tipo: (r.tipo || tipo || '').toUpperCase(), id: r.id || r.romaneioId || r.firebaseKey || r.key }));
        };
        try {
            const loadAny = async (key) => {
                if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                    const result = await window.firebaseService.loadFromFirebase(key);
                    return result ? (result.data !== undefined ? result.data : result) : null;
                }
                if (window.databaseAdapter && typeof window.databaseAdapter.loadData === 'function') {
                    const result = await window.databaseAdapter.loadData(key);
                    return result && result.success ? result.data : null;
                }
                return null;
            };
            const [toraRaw, pctRaw, tlRaw, pesRaw] = await Promise.all([
                loadAny('romaneios/tora'),
                loadAny('romaneios/pct'),
                loadAny('romaneios/tl'),
                loadAny('romaneios/pes')
            ]);
            const fetched = []
                .concat(normalizeList(toraRaw, 'TORA'))
                .concat(normalizeList(pctRaw, 'PCT'))
                .concat(normalizeList(tlRaw, 'TL'))
                .concat(normalizeList(pesRaw, 'PES'));
            fetched.forEach(r => {
                const keys = [r && r.id, r && r.romaneioId, r && r.key, r && r.firebaseKey, r && r.uniqueKey, r && r.numero, r && r.numeroRomaneio].filter(Boolean);
                keys.forEach(k => romaneioMap.set(String(k), r));
            });
        } catch (_) {}
    }
    const romaneioIds = new Set();
    const romaneiosContados = new Set();
    let volumeRomaneiosDireto = 0;
    refs.forEach(({ r, id, label, labelIds }) => {
        const fromMap = id ? romaneioMap.get(String(id)) : null;
        if (isCarregoPedidoLike(r) || isCarregoPedidoLike(fromMap) || isCarregoPedidoLike(label)) return;
        const labelTipo = tipoFromLabel(label);
        const localTipo = r && r.tipo ? r.tipo : (fromMap && fromMap.tipo) || labelTipo;
        const localKey = id || (fromMap && (fromMap.id || fromMap.romaneioId || fromMap.key || fromMap.firebaseKey || fromMap.uniqueKey)) || '';
        if (r && typeof r.volumeSerraria === 'number' && r.volumeSerraria > 0 && isSerradoTipo(localTipo)) {
            const key = String(localKey || id || label || '').trim();
            if (!key || romaneiosContados.has(key)) return;
            volumeRomaneiosDireto += Number(r.volumeSerraria) || 0;
            romaneiosContados.add(key);
            return;
        }
        const romaneioRef = fromMap || (isRomaneioLike(r) ? r : null);
        const keyCandidates = [
            id,
            romaneioRef && (romaneioRef.id || romaneioRef.romaneioId || romaneioRef.key || romaneioRef.firebaseKey || romaneioRef.uniqueKey || romaneioRef.numero || romaneioRef.numeroRomaneio),
            Array.isArray(labelIds) && labelIds.length ? labelIds[0] : null,
            label
        ].filter(v => v !== undefined && v !== null && String(v).trim() !== '').map(v => String(v));
        const key = keyCandidates.length ? keyCandidates[0] : null;
        if (key && romaneiosContados.has(key)) return;
        if (!romaneioRef) {
            if (id && String(id).trim()) romaneioIds.add(String(id));
            if (Array.isArray(labelIds) && labelLooksRomaneio(label)) {
                labelIds.forEach(x => romaneioIds.add(String(x)));
            }
            return;
        }
        if (romaneioRef && !isSerradoTipo(romaneioRef.tipo)) {
            return;
        }
        const itens = getRomaneioItems(romaneioRef);
        if (itens.length > 0) {
            const filtrados = itens.filter(i => !isCarregoItem(i));
            if (filtrados.length > 0) {
                const soma = filtrados.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || i.volumeTotal || i.volume || 0) || 0), 0);
                volumeRomaneiosDireto += soma;
                if (key) romaneiosContados.add(key);
                return;
            }
        }
        const total = (romaneioRef.totais && (romaneioRef.totais.volumeSerraria || romaneioRef.totais.volumeTotal || romaneioRef.totais.volume)) || romaneioRef.totalVolume || romaneioRef.volumeSerraria || romaneioRef.volumeTotal || romaneioRef.volume;
        if (total) {
            volumeRomaneiosDireto += Number(total) || 0;
            if (key) romaneiosContados.add(key);
            return;
        }
        if (id && String(id).trim()) romaneioIds.add(String(id));
        if (Array.isArray(labelIds) && labelLooksRomaneio(label)) {
            labelIds.forEach(x => romaneioIds.add(String(x)));
        }
    });
    const getRomaneioVolume = (r) => {
        if (!r) return 0;
        const itens = getRomaneioItems(r);
        if (itens.length > 0) {
            const filtrados = itens.filter(i => !isCarregoItem(i));
            if (filtrados.length > 0) {
                return filtrados.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || i.volumeTotal || i.volume || 0) || 0), 0);
            }
        }
        const total = (r.totais && (r.totais.volumeSerraria || r.totais.volumeTotal || r.totais.volume)) || r.totalVolume || r.volumeSerraria || r.volumeTotal || r.volume;
        if (total) return Number(total) || 0;
        return itens.reduce((acc, i) => acc + (parseFloat(i.volumeSerraria || i.volumeLiquido || i.volumeTotal || i.volume || 0) || 0), 0);
    };
    const volumeRomaneiosLookup = Array.from(romaneioIds).reduce((acc, id) => {
        const key = String(id);
        if (romaneiosContados.has(key)) return acc;
        const r = romaneioMap.get(key);
        if (isCarregoPedidoLike(r)) return acc;
        const vol = r ? getRomaneioVolume(r) : 0;
        if (vol > 0) romaneiosContados.add(key);
        return acc + vol;
    }, 0);
    const volumeRomaneios = volumeRomaneiosDireto + volumeRomaneiosLookup;
    const rendimento = volumeTorasSaidas > 0 ? (volumeRomaneios / volumeTorasSaidas) * 100 : 0;
    return { totalVol, totalEntradas, totalSaidas, volumeRomaneios, rendimento };
}

function getMovimentacoesColumnsDefs() {
    return [
        { key: 'data', label: 'Data' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'plaqueta', label: 'Plaqueta' },
        { key: 'custodia', label: 'Custódia' },
        { key: 'especie', label: 'Espécie' },
        { key: 'volume', label: 'Volume', align: 'text-right' },
        { key: 'volumeGeo', label: 'V. Geo.', align: 'text-right' },
        { key: 'documento', label: 'Documento' },
        { key: 'remessaId', label: 'Remessa' },
        { key: 'observacoes', label: 'Romaneio Vinculado' }
    ];
}

function getMovimentacoesColumnsStorageKey() {
    return obterChavePreferenciaEstoque('movimentacoes_columns');
}

function getMovimentacoesColumnsRemotePath() {
    const uid = obterUsuarioPreferenciaEstoque();
    const tenant = resolveCompanyId() || 'default';
    return `users/${uid}/preferences/estoqueMovimentacoesColumns/${tenant}`;
}

function getDefaultMovimentacoesColumnsConfig() {
    const cfg = {};
    getMovimentacoesColumnsDefs().forEach(d => { cfg[d.key] = true; });
    return cfg;
}

function getMovimentacoesColumnsConfigSync() {
    const defaults = getDefaultMovimentacoesColumnsConfig();
    try {
        const raw = localStorage.getItem(getMovimentacoesColumnsStorageKey());
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaults;
        const normalized = { ...defaults };
        const defs = getMovimentacoesColumnsDefs();
        defs.forEach(d => {
            if (Object.prototype.hasOwnProperty.call(parsed, d.key)) {
                normalized[d.key] = parsed[d.key] !== false;
            }
        });
        if (defs.length && defs.every(d => normalized[d.key] === false)) {
            normalized[defs[0].key] = true;
        }
        return normalized;
    } catch (_) {
        return defaults;
    }
}

async function ensureMovimentacoesColumnsConfigLoaded() {
    try {
        if (localStorage.getItem(getMovimentacoesColumnsStorageKey())) return;
    } catch (_) {}
    try {
        if (obterUsuarioPreferenciaEstoque() !== 'anon' && typeof window.getData === 'function') {
            const remote = await window.getData(getMovimentacoesColumnsRemotePath(), { debounceMs: 0 });
            if (remote && typeof remote === 'object') {
                localStorage.setItem(getMovimentacoesColumnsStorageKey(), JSON.stringify(remote));
            }
        }
    } catch (_) {}
}

function getVisibleMovimentacoesColumns() {
    const cfg = getMovimentacoesColumnsConfigSync();
    const defs = getMovimentacoesColumnsDefs();
    const visible = defs.filter(d => cfg[d.key] !== false);
    return visible.length ? visible : defs.slice(0, 1);
}

function getVisibleMovimentacoesColumnsCount() {
    return getVisibleMovimentacoesColumns().length;
}

function applyMovimentacoesColumnsConfig() {
    const table = document.getElementById('tabelaMovimentacoes');
    if (!table) return;
    const cfg = getMovimentacoesColumnsConfigSync();
    getMovimentacoesColumnsDefs().forEach(d => {
        const visible = cfg[d.key] !== false;
        table.querySelectorAll(`[data-col="${d.key}"]`).forEach(el => {
            el.style.display = visible ? '' : 'none';
        });
    });
}

async function saveMovimentacoesColumnsConfig(config = {}) {
    const defs = getMovimentacoesColumnsDefs();
    const sanitized = {};
    defs.forEach(d => { sanitized[d.key] = config[d.key] !== false; });
    if (defs.length && defs.every(d => sanitized[d.key] === false)) {
        sanitized[defs[0].key] = true;
    }
    try { localStorage.setItem(getMovimentacoesColumnsStorageKey(), JSON.stringify(sanitized)); } catch (_) {}
    try {
        if (obterUsuarioPreferenciaEstoque() !== 'anon' && typeof window.saveData === 'function') {
            await window.saveData(getMovimentacoesColumnsRemotePath(), sanitized, { debounceMs: 0, showToast: false });
        }
    } catch (_) {}
    applyMovimentacoesColumnsConfig();
    return sanitized;
}

function atualizarEstadoTodasColunasMovimentacoes() {
    const master = document.getElementById('movimentacoesColumnsSelectAll');
    const checks = Array.from(document.querySelectorAll('#movimentacoesColumnsConfigModal .report-col-check'));
    if (!master || checks.length === 0) return;
    const checkedCount = checks.filter(cb => cb.checked).length;
    master.checked = checkedCount === checks.length;
    master.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

function toggleTodasColunasMovimentacoes(checked) {
    document.querySelectorAll('#movimentacoesColumnsConfigModal .report-col-check').forEach(cb => {
        cb.checked = !!checked;
    });
    atualizarEstadoTodasColunasMovimentacoes();
}

async function abrirConfiguracaoColunasMovimentacoes() {
    await ensureMovimentacoesColumnsConfigLoaded();
    if (!document.getElementById('movimentacoesColumnsConfigModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="movimentacoesColumnsConfigModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-list"></i> Colunas das Movimentações</h3>
                        <span class="close-modal" onclick="fecharConfiguracaoColunasMovimentacoes()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div style="color:#64748b; font-size:13px; margin-bottom:10px;">Escolha as colunas visíveis no histórico de movimentações e na impressão.</div>
                        <label class="report-col-item" style="margin-bottom:10px;">
                            <input type="checkbox" id="movimentacoesColumnsSelectAll" onchange="toggleTodasColunasMovimentacoes(this.checked)">
                            <span class="report-col-label"><strong>Selecionar todas as colunas</strong></span>
                        </label>
                        <div id="movimentacoesColumnsConfigList"></div>
                    </div>
                    <div class="modal-footer" style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-secondary" id="movimentacoesColsResetBtn"><i class="fas fa-undo"></i> Restaurar Padrão</button>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-secondary" onclick="fecharConfiguracaoColunasMovimentacoes()"><i class="fas fa-times"></i> Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="salvarConfiguracaoColunasMovimentacoes()"><i class="fas fa-check"></i> Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        const modalEl = document.getElementById('movimentacoesColumnsConfigModal');
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) fecharConfiguracaoColunasMovimentacoes();
            });
        }
        const resetBtn = document.getElementById('movimentacoesColsResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const defaults = getDefaultMovimentacoesColumnsConfig();
                document.querySelectorAll('#movimentacoesColumnsConfigModal .report-col-check').forEach(cb => {
                    const key = cb.getAttribute('data-col');
                    cb.checked = defaults[key] !== false;
                });
                atualizarEstadoTodasColunasMovimentacoes();
            });
        }
    }

    const defs = getMovimentacoesColumnsDefs();
    const cfg = getMovimentacoesColumnsConfigSync();
    const list = document.getElementById('movimentacoesColumnsConfigList');
    if (list) {
        list.innerHTML = `<div class="report-col-grid">${defs.map(d => `
            <label class="report-col-item">
                <input type="checkbox" class="report-col-check" data-col="${escapeHtml(d.key)}" ${cfg[d.key] !== false ? 'checked' : ''} onchange="atualizarEstadoTodasColunasMovimentacoes()">
                <span class="report-col-label">${escapeHtml(d.label)}</span>
            </label>
        `).join('')}</div>`;
    }
    atualizarEstadoTodasColunasMovimentacoes();
    const modal = document.getElementById('movimentacoesColumnsConfigModal');
    if (modal) modal.style.display = 'block';
}

function fecharConfiguracaoColunasMovimentacoes() {
    const modal = document.getElementById('movimentacoesColumnsConfigModal');
    if (modal) modal.style.display = 'none';
}

async function salvarConfiguracaoColunasMovimentacoes() {
    const cfg = {};
    getMovimentacoesColumnsDefs().forEach(d => { cfg[d.key] = true; });
    document.querySelectorAll('#movimentacoesColumnsConfigModal .report-col-check').forEach(cb => {
        const key = cb.getAttribute('data-col');
        if (key) cfg[key] = !!cb.checked;
    });
    await saveMovimentacoesColumnsConfig(cfg);
    fecharConfiguracaoColunasMovimentacoes();
    carregarTabelaMovimentacoes(filtroMovimentacoesAtual);
}

function obterValorCelulaMovimentacao(mov = {}, key = '', options = {}) {
    const plain = !!options.plain;
    const geo = normalizarCamposGeoEstoque(mov);
    const manualBadge = !plain && mov && mov.toraManualForaEstoque
        ? ' <span style="display:inline-block;padding:2px 6px;border-radius:10px;background:#fff3cd;color:#856404;font-size:11px;font-weight:600;">Manual</span>'
        : '';
    const observacoes = mov && mov.toraManualForaEstoque
        ? `MANUAL FORA ESTOQUE - ${mov.observacoes || ''}`.trim()
        : (mov.observacoes || '');
    const tipo = mov.tipo ? String(mov.tipo).toUpperCase() : '';
    const tipoHtml = plain
        ? tipo
        : `<span class="status-indicator status-${mov.tipo === 'entrada' ? 'alto' : 'baixo'}">${escapeHtml(tipo)}</span>`;
    const map = {
        data: formatDate(mov.data),
        tipo: tipoHtml,
        plaqueta: `${escapeHtml(mov.plaqueta || '-')}${manualBadge}`,
        custodia: escapeHtml(geo.custodia || '-'),
        especie: escapeHtml(mov.especie || '-'),
        volume: `${formatNumber(mov.volume, 3)} m³`,
        volumeGeo: `${formatarVolumeGeoEstoque(geo.volumeGeo)} m³`,
        documento: escapeHtml(mov.documento || ''),
        remessaId: escapeHtml(mov.remessaId || '-'),
        observacoes: escapeHtml(observacoes)
    };
    return map[key] ?? '';
}

function renderMovimentacaoTd(def, mov) {
    const cls = `${def.align || ''}${def.key === 'observacoes' ? ' obs-col' : ''}`.trim();
    const clsAttr = cls ? ` class="${cls}"` : '';
    const titleAttr = def.key === 'observacoes'
        ? ` title="${obterValorCelulaMovimentacao(mov, def.key, { plain: true })}"`
        : '';
    return `<td data-col="${escapeHtml(def.key)}"${clsAttr}${titleAttr}>${obterValorCelulaMovimentacao(mov, def.key)}</td>`;
}

async function carregarTabelaMovimentacoes(filtro = {}) {
    const tbody = document.getElementById('movimentacaoTable');
    const movimentacoesColspan = getVisibleMovimentacoesColumnsCount() + 1;
    if (tbody) {
        tbody.innerHTML = getSkeletonRows(movimentacoesColspan, 5);
        applyMovimentacoesColumnsConfig();
    }
    const resumoEl = document.getElementById('resumoMovimentacoes');
    if (resumoEl) {
        resumoEl.innerHTML = '<div class="summary-row"><span><div class="skeleton-box" style="width:100px;"></div></span></div>';
    }
    let movFiltradas = [...movimentacoes];
    filtroMovimentacoesAtual = filtro || {};

    if (!filtro.tipo) {
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="${movimentacoesColspan}" style="text-align: center;">Selecione o tipo para carregar as movimentações</td></tr>`;
            applyMovimentacoesColumnsConfig();
        }
        const resumoEl = document.getElementById('resumoMovimentacoes');
        if (resumoEl) resumoEl.innerHTML = '';
        renderizarPaginacaoPadrao('paginacaoMovimentacoes', 0, 1, obterItensPorPaginaTabela('movimentacoes'), 'mudarPaginaMovimentacoes', { sizeScope: 'movimentacoes' });
        movimentacoesFiltradas = [];
        return;
    }
    // Aplicar filtros
    if (filtro.dataInicio) {
        movFiltradas = movFiltradas.filter(m => m.data >= filtro.dataInicio);
    }

    if (filtro.dataFim) {
        movFiltradas = movFiltradas.filter(m => m.data <= filtro.dataFim);
    }

    if (filtro.tipo) {
        movFiltradas = movFiltradas.filter(m => m.tipo === filtro.tipo);
    }
    if (filtro.remessa) {
        const rem = String(filtro.remessa).toLowerCase();
        movFiltradas = movFiltradas.filter(m => {
            const remessa = String(m.remessaId || '').toLowerCase();
            const doc = String(m.documento || '').toLowerCase();
            return remessa.includes(rem) || doc.includes(rem);
        });
    }
    if (filtro.observacoes) {
        const obs = String(filtro.observacoes).toLowerCase();
        movFiltradas = movFiltradas.filter(m => String(m.observacoes || '').toLowerCase().includes(obs));
    }

    // Ordenação dinâmica
    const { coluna, direcao } = ordemMovimentacoes;
    const mult = direcao === 'asc' ? 1 : -1;

    movFiltradas.sort((a, b) => {
        let valA = a[coluna];
        let valB = b[coluna];

        // Normalização baseada na coluna
        if (coluna === 'data') {
            valA = valA ? new Date(valA).getTime() : 0;
            valB = valB ? new Date(valB).getTime() : 0;
            return (valA - valB) * mult;
        } else if (coluna === 'volume' || coluna === 'volumeGeo') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            return (valA - valB) * mult;
        } else {
            valA = String(valA || '').toLowerCase();
            valB = String(valB || '').toLowerCase();
            return valA.localeCompare(valB, 'pt-BR') * mult;
        }
    });

    if (movFiltradas.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${movimentacoesColspan}" style="text-align: center;">Nenhuma movimentação encontrada</td></tr>`;
        renderizarPaginacaoPadrao('paginacaoMovimentacoes', 0, 1, obterItensPorPaginaTabela('movimentacoes'), 'mudarPaginaMovimentacoes', { sizeScope: 'movimentacoes' });
        if (resumoEl) resumoEl.innerHTML = '';
        applyMovimentacoesColumnsConfig();
        return;
    }

    const itensPorPaginaMov = obterItensPorPaginaTabela('movimentacoes');
    const totalPaginas = Math.max(1, Math.ceil(movFiltradas.length / itensPorPaginaMov));
    if (paginaAtualMovimentacoes > totalPaginas) paginaAtualMovimentacoes = totalPaginas;
    if (paginaAtualMovimentacoes < 1) paginaAtualMovimentacoes = 1;
    const inicio = (paginaAtualMovimentacoes - 1) * itensPorPaginaMov;
    const pagina = movFiltradas.slice(inicio, inicio + itensPorPaginaMov);

    tbody.innerHTML = pagina.map(mov => {
        const isChecked = movimentacoesSelecionadas.has(String(mov.id)) ? 'checked' : '';
        const movDefs = getMovimentacoesColumnsDefs();
        return `
        <tr>
            <td style="text-align: center;"><input type="checkbox" class="check-movimentacao" value="${mov.id}" ${isChecked} onchange="toggleMovimentacao('${mov.id}', this.checked)"></td>
            ${movDefs.map(def => renderMovimentacaoTd(def, mov)).join('')}
        </tr>
    `;
    }).join('');
    renderizarPaginacaoPadrao('paginacaoMovimentacoes', movFiltradas.length, paginaAtualMovimentacoes, itensPorPaginaMov, 'mudarPaginaMovimentacoes', { sizeScope: 'movimentacoes' });
    applyMovimentacoesColumnsConfig();
    movimentacoesFiltradas = movFiltradas.slice();

    const baseParaResumo = movimentacoesSelecionadas.size > 0
        ? movimentacoesFiltradas.filter(m => movimentacoesSelecionadas.has(String(m.id)))
        : movimentacoesFiltradas;

    const resumoSeq = ++resumoMovimentacoesSeq;
    const cacheKey = JSON.stringify({
        tipo: filtroMovimentacoesAtual.tipo || '',
        dataInicio: filtroMovimentacoesAtual.dataInicio || '',
        dataFim: filtroMovimentacoesAtual.dataFim || '',
        remessa: filtroMovimentacoesAtual.remessa || '',
        observacoes: filtroMovimentacoesAtual.observacoes || '',
        total: baseParaResumo.length,
        selecionados: Array.from(movimentacoesSelecionadas).sort()
    });

    if (resumoEl && resumoMovimentacoesCache.has(cacheKey)) {
        const resumo = resumoMovimentacoesCache.get(cacheKey);
        const { totalVol, totalEntradas, totalSaidas, volumeRomaneios, rendimento } = resumo;
        resumoEl.innerHTML = `
            <div class="summary-row">
                <span>Total de Movimentações (Base atual):</span>
                <span>${baseParaResumo.length}</span>
            </div>
            <div class="summary-row">
                <span>Entradas:</span>
                <span>${totalEntradas}</span>
            </div>
            <div class="summary-row">
                <span>Saídas:</span>
                <span>${totalSaidas}</span>
            </div>
            <div class="summary-row">
                <span>Volume Total:</span>
                <span>${formatNumber(totalVol, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Volume serrado (romaneios):</span>
                <span>${formatNumber(volumeRomaneios, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Rendimento:</span>
                <span>${formatNumber(rendimento, 2)}%</span>
            </div>
        `;
    } else if (resumoEl) {
        resumoEl.innerHTML = '<div class="summary-row" style="font-size: 12px; color: #7f8c8d;"><span>Atualizando resumo...</span></div>';
    }
    calcularResumoMovimentacoes(baseParaResumo).then(resumo => {
        if (resumoSeq !== resumoMovimentacoesSeq) return;
        resumoMovimentacoesCache.set(cacheKey, resumo);
        if (!resumoEl) return;
        const { totalVol, totalEntradas, totalSaidas, volumeRomaneios, rendimento } = resumo;
        resumoEl.innerHTML = `
            <div class="summary-row">
                <span>Total de Movimentações (Base atual):</span>
                <span>${baseParaResumo.length}</span>
            </div>
            <div class="summary-row">
                <span>Entradas:</span>
                <span>${totalEntradas}</span>
            </div>
            <div class="summary-row">
                <span>Saídas:</span>
                <span>${totalSaidas}</span>
            </div>
            <div class="summary-row">
                <span>Volume Total:</span>
                <span>${formatNumber(totalVol, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Volume serrado (romaneios):</span>
                <span>${formatNumber(volumeRomaneios, 3)} m³</span>
            </div>
            <div class="summary-row">
                <span>Rendimento:</span>
                <span>${formatNumber(rendimento, 2)}%</span>
            </div>
        `;
    }).catch(() => {});
}

function filtrarMovimentacoes() {
    const filtro = {
        dataInicio: document.getElementById('filtroDataInicio').value,
        dataFim: document.getElementById('filtroDataFim').value,
        tipo: document.getElementById('filtroTipoMov').value,
        remessa: document.getElementById('filtroRemessaBaixa')?.value || '',
        observacoes: document.getElementById('filtroObservacoesMov')?.value || ''
    };
    paginaAtualMovimentacoes = 1;
    carregarTabelaMovimentacoes(filtro);
}

function mudarPaginaMovimentacoes(p) {
    paginaAtualMovimentacoes = p;
    carregarTabelaMovimentacoes(filtroMovimentacoesAtual);
}

function toggleTodasMovimentacoes() {
    const master = document.getElementById('checkTodasMovimentacoes');
    const checks = document.querySelectorAll('.check-movimentacao');

    checks.forEach(c => {
        c.checked = master.checked;
        if (master.checked) {
            movimentacoesSelecionadas.add(c.value);
        } else {
            movimentacoesSelecionadas.delete(c.value);
        }
    });
    // Atualizar resumo do rodapé para refletir as seleções
    carregarTabelaMovimentacoes(filtroMovimentacoesAtual);
}

function toggleMovimentacao(id, isChecked) {
    if (isChecked) {
        movimentacoesSelecionadas.add(id);
    } else {
        movimentacoesSelecionadas.delete(id);
        const master = document.getElementById('checkTodasMovimentacoes');
        if (master) master.checked = false;
    }
    // Atualizar resumo do rodapé para refletir as seleções
    carregarTabelaMovimentacoes(filtroMovimentacoesAtual);
}

function limparFiltrosMovimentacoes() {
    document.getElementById('filtroDataInicio').value = '';
    document.getElementById('filtroDataFim').value = '';
    document.getElementById('filtroTipoMov').value = '';
    const inputRem = document.getElementById('filtroRemessaBaixa');
    if (inputRem) inputRem.value = '';
    const inputObs = document.getElementById('filtroObservacoesMov');
    if (inputObs) inputObs.value = '';

    movimentacoesSelecionadas.clear();
    const masterCheck = document.getElementById('checkTodasMovimentacoes');
    if (masterCheck) masterCheck.checked = false;

    filtrarMovimentacoes();
}

function ordenarMovimentacoes(coluna) {
    if (ordemMovimentacoes.coluna === coluna) {
        ordemMovimentacoes.direcao = ordemMovimentacoes.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        ordemMovimentacoes.coluna = coluna;
        ordemMovimentacoes.direcao = 'asc';
    }

    // Atualizar ícones
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.className = 'fas fa-sort sort-icon';
    });

    const iconEl = document.getElementById(`sort-${coluna}`);
    if (iconEl) {
        iconEl.className = `fas fa-sort-${ordemMovimentacoes.direcao === 'asc' ? 'up' : 'down'} sort-icon`;
    }

    carregarTabelaMovimentacoes(filtroMovimentacoesAtual);
}

function obterRegistrosRastreabilidadeComFallback() {
    const registros = new Map();
    (rastreabilidadeRegistros || []).forEach(reg => {
        if (!reg) return;
        const normalizado = normalizarRegistroRastreabilidade(reg);
        registros.set(String(normalizado.id), normalizado);
    });

    const movimentosSaida = (movimentacoes || []).filter(mov => {
        if (!mov || mov.tipo !== 'saida') return false;
        return mov.remessaId || (Array.isArray(mov.romaneiosRelacionados) && mov.romaneiosRelacionados.length);
    });
    const grupos = new Map();
    movimentosSaida.forEach(mov => {
        const key = String(mov.remessaId || mov.id || '');
        if (!grupos.has(key)) grupos.set(key, []);
        grupos.get(key).push(mov);
    });

    movimentosSaida.forEach(mov => {
        const id = gerarIdRastreabilidade(mov.remessaId, mov.id);
        if (registros.has(id)) return;
        const grupo = grupos.get(String(mov.remessaId || mov.id || '')) || [mov];
        const resumo = resumirRomaneiosRastreabilidade(mov.romaneiosRelacionados || []);
        const derivado = criarRegistroRastreabilidadeDeMovimento(mov, {
            id,
            remessaId: mov.remessaId || '',
            romaneiosRelacionados: mov.romaneiosRelacionados || [],
            volumeTorasRemessa: grupo.reduce((acc, item) => acc + (parseNumeroEstoque(item.volume || item.volumeLiquido) || 0), 0),
            volumeProduzido: resumo.volumeProduzido,
            origem: 'movimentacao_legada',
            confiabilidade: resumo.lista.length ? 'derivada' : 'sem_romaneio',
            dataCriacao: mov.created || mov.data || '',
            created: mov.created || ''
        });
        registros.set(String(derivado.id), derivado);
    });

    return Array.from(registros.values());
}

function normalizarTextoFiltroRastreabilidade(value) {
    return String(value || '').trim().toLowerCase();
}

function registroRastreabilidadeTexto(reg = {}) {
    const roms = Array.isArray(reg.romaneios) ? reg.romaneios : [];
    return [
        reg.remessaId,
        reg.movimentacaoId,
        reg.toraId,
        reg.plaqueta,
        reg.especie,
        reg.numeroRomaneio,
        reg.romaneioId,
        reg.tipoRomaneio,
        reg.clienteNome,
        reg.usuarioNome,
        reg.usuarioEmail,
        reg.documento,
        reg.observacoesOriginais,
        roms.map(r => `${r.id || ''} ${r.numero || ''} ${r.tipo || ''} ${r.clienteNome || ''}`).join(' ')
    ].join(' ').toLowerCase();
}

function filtrarRegistrosRastreabilidade(filtros = {}) {
    const idsMovimentacao = Array.isArray(filtros.movimentacaoIds) ? new Set(filtros.movimentacaoIds.map(String)) : null;
    const plaquetasSet = Array.isArray(filtros.plaquetas) ? new Set(filtros.plaquetas.map(v => String(v || '').toLowerCase()).filter(Boolean)) : null;
    const registros = obterRegistrosRastreabilidadeComFallback();
    const dataInicio = filtros.dataInicio ? parseDateLocalSafe(filtros.dataInicio) : null;
    const dataFim = filtros.dataFim ? parseDateLocalSafe(`${filtros.dataFim}T23:59:59`) : null;
    const plaqueta = normalizarTextoFiltroRastreabilidade(filtros.plaqueta);
    const romaneio = normalizarTextoFiltroRastreabilidade(filtros.romaneio);
    const remessa = normalizarTextoFiltroRastreabilidade(filtros.remessa);
    const movimentacao = normalizarTextoFiltroRastreabilidade(filtros.movimentacao);
    const especie = normalizarTextoFiltroRastreabilidade(filtros.especie);
    const cliente = normalizarTextoFiltroRastreabilidade(filtros.cliente);
    const usuario = normalizarTextoFiltroRastreabilidade(filtros.usuario);
    const statusFiltro = normalizarTextoFiltroRastreabilidade(filtros.status || 'ativo') || 'ativo';

    return registros.filter(reg => {
        const statusRegistro = normalizarTextoFiltroRastreabilidade(reg.status || 'ativo') || 'ativo';
        if (statusFiltro !== 'todos' && statusRegistro !== statusFiltro) return false;
        if (idsMovimentacao && !idsMovimentacao.has(String(reg.movimentacaoId || ''))) return false;
        if (plaquetasSet && !plaquetasSet.has(String(reg.plaqueta || '').toLowerCase())) return false;
        const d = reg.data ? parseDateLocalSafe(reg.data) : null;
        if (dataInicio && (!d || d < dataInicio)) return false;
        if (dataFim && (!d || d > dataFim)) return false;
        if (plaqueta && !String(reg.plaqueta || '').toLowerCase().includes(plaqueta)) return false;
        if (remessa && !String(reg.remessaId || '').toLowerCase().includes(remessa)) return false;
        if (movimentacao && !String(reg.movimentacaoId || '').toLowerCase().includes(movimentacao)) return false;
        if (especie && !String(reg.especie || '').toLowerCase().includes(especie)) return false;
        if (cliente && !String(reg.clienteNome || '').toLowerCase().includes(cliente)) return false;
        if (usuario && !`${reg.usuarioNome || ''} ${reg.usuarioEmail || ''} ${reg.usuarioId || ''}`.toLowerCase().includes(usuario)) return false;
        if (romaneio) {
            const haystack = registroRastreabilidadeTexto(reg);
            if (!haystack.includes(romaneio)) return false;
        }
        return true;
    }).sort((a, b) => {
        const da = a.data ? new Date(a.data).getTime() : 0;
        const db = b.data ? new Date(b.data).getTime() : 0;
        return db - da;
    });
}

function preencherFiltrosRastreabilidade(filtros = {}) {
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };
    set('rastFiltroDataInicio', filtros.dataInicio || '');
    set('rastFiltroDataFim', filtros.dataFim || '');
    set('rastFiltroPlaqueta', filtros.plaqueta || '');
    set('rastFiltroRomaneio', filtros.romaneio || '');
    set('rastFiltroRemessa', filtros.remessa || '');
    set('rastFiltroMovimentacao', filtros.movimentacao || '');
    set('rastFiltroEspecie', filtros.especie || '');
    set('rastFiltroCliente', filtros.cliente || '');
    set('rastFiltroUsuario', filtros.usuario || '');
    set('rastFiltroStatus', filtros.status || 'ativo');
}

function lerFiltrosRastreabilidade() {
    return {
        ...(window.rastreabilidadeFiltrosAtuais || {}),
        dataInicio: document.getElementById('rastFiltroDataInicio')?.value || '',
        dataFim: document.getElementById('rastFiltroDataFim')?.value || '',
        plaqueta: document.getElementById('rastFiltroPlaqueta')?.value || '',
        romaneio: document.getElementById('rastFiltroRomaneio')?.value || '',
        remessa: document.getElementById('rastFiltroRemessa')?.value || '',
        movimentacao: document.getElementById('rastFiltroMovimentacao')?.value || '',
        especie: document.getElementById('rastFiltroEspecie')?.value || '',
        cliente: document.getElementById('rastFiltroCliente')?.value || '',
        usuario: document.getElementById('rastFiltroUsuario')?.value || '',
        status: document.getElementById('rastFiltroStatus')?.value || 'ativo'
    };
}

function renderizarResumoRastreabilidade(lista = []) {
    const totalToras = new Set(lista.map(r => r.toraId || r.plaqueta).filter(Boolean)).size;
    const totalRemessas = new Set(lista.map(r => r.remessaId).filter(Boolean)).size;
    const totalRomaneios = new Set(lista.flatMap(r => (r.romaneios || []).map(rom => rom.id || rom.numero).filter(Boolean))).size;
    const volumeToras = lista.reduce((acc, r) => acc + (parseNumeroEstoque(r.volumeTora) || 0), 0);
    const remessasCalculadas = new Map();
    lista.forEach(r => {
        const key = r.remessaId || r.id;
        if (!remessasCalculadas.has(key)) {
            remessasCalculadas.set(key, {
                volumeToras: parseNumeroEstoque(r.volumeTorasRemessa || r.volumeTora) || 0,
                volumeProduzido: parseNumeroEstoque(r.volumeProduzido) || 0
            });
        }
    });
    const volumeProduzido = Array.from(remessasCalculadas.values()).reduce((acc, item) => acc + item.volumeProduzido, 0);
    const volumeBaseRemessas = Array.from(remessasCalculadas.values()).reduce((acc, item) => acc + item.volumeToras, 0);
    const rendimento = volumeBaseRemessas > 0 ? (volumeProduzido / volumeBaseRemessas) * 100 : 0;
    const host = document.getElementById('rastreabilidadeResumo');
    if (!host) return;
    host.innerHTML = `
        <div class="rast-card"><strong>${lista.length}</strong><span>registro(s)</span></div>
        <div class="rast-card"><strong>${totalToras}</strong><span>tora(s)</span></div>
        <div class="rast-card"><strong>${totalRemessas}</strong><span>remessa(s)</span></div>
        <div class="rast-card"><strong>${totalRomaneios}</strong><span>romaneio(s)</span></div>
        <div class="rast-card"><strong>${formatNumber(volumeToras, 3)} m³</strong><span>volume das toras listadas</span></div>
        <div class="rast-card"><strong>${formatNumber(rendimento, 2)}%</strong><span>rendimento por remessa</span></div>
    `;
}

function renderizarTimelineRastreabilidade(lista = []) {
    const host = document.getElementById('rastreabilidadeTimeline');
    if (!host) return;
    const eventos = lista.slice(0, 8);
    if (!eventos.length) {
        host.innerHTML = '<div class="rast-event"><div class="rast-event-title">Nenhum evento encontrado</div><div class="rast-event-meta">Revise os filtros ou gere a migração dos dados antigos.</div></div>';
        return;
    }
    host.innerHTML = eventos.map(reg => {
        const statusClass = String(reg.status || '').toLowerCase() === 'estornado' ? ' estornado' : '';
        const romaneio = reg.numeroRomaneio || reg.romaneioId || 'Sem romaneio vinculado';
        return `
            <div class="rast-event${statusClass}">
                <div class="rast-event-title">
                    <span>${escapeHtml(formatDate(reg.data))} - Plaqueta ${escapeHtml(reg.plaqueta || '-')}</span>
                    <span>${escapeHtml(reg.remessaId || '-')}</span>
                </div>
                <div class="rast-event-meta">
                    ${escapeHtml(reg.especie || '-')} | Romaneio: ${escapeHtml(romaneio)} | Mov.: ${escapeHtml(reg.movimentacaoId || '-')} | ${formatNumber(reg.volumeTora || 0, 3)} m³
                </div>
            </div>
        `;
    }).join('');
}

function renderizarTabelaRastreabilidade(lista = []) {
    const tbody = document.getElementById('rastreabilidadeTableBody');
    if (!tbody) return;
    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">Nenhum registro de rastreabilidade encontrado</td></tr>';
        return;
    }
    tbody.innerHTML = lista.map(reg => `
        <tr>
            <td>${formatDate(reg.data)}</td>
            <td>${escapeHtml(reg.remessaId || '-')}</td>
            <td>${escapeHtml(reg.plaqueta || '-')}</td>
            <td>${escapeHtml(reg.especie || '-')}</td>
            <td>${escapeHtml(reg.numeroRomaneio || reg.romaneioId || '-')}</td>
            <td>${escapeHtml(reg.clienteNome || '-')}</td>
            <td class="text-right">${formatNumber(reg.volumeTora || 0, 3)} m³</td>
            <td class="text-right">${formatNumber(reg.volumeProduzido || 0, 3)} m³</td>
            <td class="text-right">${formatNumber(reg.rendimento || 0, 2)}%</td>
            <td>${escapeHtml(reg.status || 'ativo')}</td>
        </tr>
    `).join('');
}

function renderizarRastreabilidade(filtros = {}) {
    window.rastreabilidadeFiltrosAtuais = { status: 'ativo', ...(filtros || {}) };
    const lista = filtrarRegistrosRastreabilidade(window.rastreabilidadeFiltrosAtuais);
    window.rastreabilidadeFiltradaAtual = lista;
    renderizarResumoRastreabilidade(lista);
    renderizarTimelineRastreabilidade(lista);
    renderizarTabelaRastreabilidade(lista);
}

function abrirRastreabilidadeMovimentacoes() {
    const idsSelecionados = Array.from(movimentacoesSelecionadas || []);
    const filtros = {
        status: 'ativo',
        dataInicio: filtroMovimentacoesAtual.dataInicio || document.getElementById('filtroDataInicio')?.value || '',
        dataFim: filtroMovimentacoesAtual.dataFim || document.getElementById('filtroDataFim')?.value || '',
        remessa: filtroMovimentacoesAtual.remessa || document.getElementById('filtroRemessaBaixa')?.value || '',
        romaneio: filtroMovimentacoesAtual.observacoes || document.getElementById('filtroObservacoesMov')?.value || ''
    };
    if (idsSelecionados.length) filtros.movimentacaoIds = idsSelecionados;
    preencherFiltrosRastreabilidade(filtros);
    renderizarRastreabilidade(filtros);
    const modal = document.getElementById('rastreabilidadeModal');
    if (modal) modal.style.display = 'block';
}

function abrirRastreabilidadeSaida() {
    const plaquetas = (torasSelecionadasBaixa || [])
        .map(tora => tora && tora.plaqueta)
        .filter(Boolean);
    const filtros = { status: 'ativo' };
    if (plaquetas.length === 1) filtros.plaqueta = plaquetas[0];
    if (plaquetas.length > 1) filtros.plaquetas = plaquetas;
    preencherFiltrosRastreabilidade(filtros);
    renderizarRastreabilidade(filtros);
    const modal = document.getElementById('rastreabilidadeModal');
    if (modal) modal.style.display = 'block';
}

function aplicarFiltrosRastreabilidade() {
    const filtros = lerFiltrosRastreabilidade();
    delete filtros.movimentacaoIds;
    delete filtros.plaquetas;
    renderizarRastreabilidade(filtros);
}

function limparFiltrosRastreabilidade() {
    window.rastreabilidadeFiltrosAtuais = { status: 'ativo' };
    preencherFiltrosRastreabilidade({ status: 'ativo' });
    renderizarRastreabilidade({ status: 'ativo' });
}

function fecharRastreabilidadeModal() {
    const modal = document.getElementById('rastreabilidadeModal');
    if (modal) modal.style.display = 'none';
}

async function imprimirRastreabilidadeEstoque() {
    const lista = window.rastreabilidadeFiltradaAtual || filtrarRegistrosRastreabilidade(window.rastreabilidadeFiltrosAtuais || {});
    const defs = getVisibleEstoqueReportColumns('rastreabilidade');
    const colunas = defs.map(def => def.label);
    const linhas = lista.map(reg => defs.map(def => obterValorCelulaRelatorioEstoque('rastreabilidade', def.key, reg)));
    const volumeToras = lista.reduce((acc, reg) => acc + (parseNumeroEstoque(reg.volumeTora) || 0), 0);
    const volumeProduzido = Array.from(new Map(lista.map(reg => [reg.remessaId || reg.id, reg])).values())
        .reduce((acc, reg) => acc + (parseNumeroEstoque(reg.volumeProduzido) || 0), 0);
    const rodape = `
        <div class="relatorio-rodape summary-box">
            <div class="summary-row"><span>Registros:</span><span>${lista.length}</span></div>
            <div class="summary-row"><span>Volume das Toras:</span><span>${formatNumber(volumeToras, 3)} m³</span></div>
            <div class="summary-row"><span>Volume Produzido:</span><span>${formatNumber(volumeProduzido, 3)} m³</span></div>
        </div>
    `;
    const empresa = await obterDadosEmpresaRelatorio();
    const html = montarRelatorioHtml(empresa, 'Rastreabilidade de Toras', '', montarTabelaHtml(colunas, linhas), rodape);
    const htmlCompleto = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Rastreabilidade de Toras</title>
            <style>${obterRelatorioStylesImpressao()}</style>
        </head>
        <body>${html}</body>
        </html>
    `;
    await entregarRelatorioEstoque({
        title: 'Rastreabilidade de Toras',
        company: empresa,
        htmlCompleto,
        preview: false,
        windowFeatures: 'width=1000,height=700',
        pdfOptions: {
            title: 'Rastreabilidade de Toras',
            company: empresa,
            columns: defs,
            rows: linhas,
            summaryRows: [
                ['Registros', lista.length],
                ['Volume das Toras', `${formatNumber(volumeToras, 3)} m³`],
                ['Volume Produzido', `${formatNumber(volumeProduzido, 3)} m³`]
            ]
        }
    });
}

// Funções de relatórios
window.relatorioSelecionados = window.relatorioSelecionados || new Set();

window.toggleRelatorio = function(id, isChecked) {
    if (isChecked) window.relatorioSelecionados.add(id);
    else window.relatorioSelecionados.delete(id);

    const checks = document.querySelectorAll('.check-relatorio');
    const masters = document.querySelectorAll('.check-todo-relatorio');
    if (masters.length > 0 && checks.length > 0) {
        const allChecked = Array.from(checks).every(c => c.checked);
        masters.forEach(master => { master.checked = allChecked; });
    }
};

window.toggleTodoRelatorio = function(checked = null) {
    const masters = document.querySelectorAll('.check-todo-relatorio');
    const checks = document.querySelectorAll('.check-relatorio');
    const shouldCheck = checked === null ? !!(masters[0] && masters[0].checked) : !!checked;
    checks.forEach(c => {
        c.checked = shouldCheck;
        if (shouldCheck) window.relatorioSelecionados.add(c.value);
        else window.relatorioSelecionados.delete(c.value);
    });
    masters.forEach(master => { master.checked = shouldCheck; });
};

function escapeRelatorioAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function criarRelatorioSelectionId(tipo, raw) {
    return `${tipo}:${String(raw ?? '')}`;
}

function getRelatorioMovimentacaoKey(m) {
    return m.id || `${m.data || ''}|${m.tipo || ''}|${m.plaqueta || ''}|${m.especie || ''}|${m.documento || ''}|${m.remessaId || ''}|${m.observacoes || ''}`;
}

function getRelatorioRastreabilidadeKey(r) {
    return r.id || `${r.remessaId || ''}|${r.movimentacaoId || ''}|${r.toraId || ''}|${r.plaqueta || ''}|${r.numeroRomaneio || ''}`;
}

function getRelatorioProdutoMovimentacaoKey(m) {
    return m.id || `${m.data || ''}|${m.tipo || ''}|${m.produtoId || ''}|${m.produtoNome || ''}|${m.quantidade || ''}|${m.motivo || ''}|${m.origem || ''}`;
}

function filtrarItensSelecionadosRelatorio(tipo, items, getKey, onlySelected = false) {
    if (!onlySelected || !window.relatorioSelecionados || window.relatorioSelecionados.size === 0) {
        return items;
    }
    return (items || []).filter(item => window.relatorioSelecionados.has(criarRelatorioSelectionId(tipo, getKey(item))));
}

function renderRelatorioSelecionarTodosTh(onlySelected = false) {
    if (onlySelected) return '';
    return '<th class="text-center no-print relatorio-check-col"><input type="checkbox" class="check-todo-relatorio" onchange="toggleTodoRelatorio(this.checked)" aria-label="Selecionar todos os itens do relatório"></th>';
}

function renderRelatorioSelecionarTd(tipo, raw, onlySelected = false) {
    if (onlySelected) return '';
    const id = criarRelatorioSelectionId(tipo, raw);
    const checked = window.relatorioSelecionados && window.relatorioSelecionados.has(id) ? 'checked' : '';
    return `<td class="text-center no-print relatorio-check-col"><input type="checkbox" class="check-relatorio" value="${escapeRelatorioAttr(id)}" ${checked} onchange="toggleRelatorio(this.value, this.checked)" aria-label="Selecionar item do relatório"></td>`;
}

function isEstoqueReportColumnsSupported(tipoRelatorio) {
    return ['posicao', 'movimentacao', 'rastreabilidade', 'especies', 'localizacao', 'produtos_saldo', 'produtos_movimentacao'].includes(String(tipoRelatorio || ''));
}

function getEstoqueReportColumnsDefs(tipoRelatorio) {
    const tipo = String(tipoRelatorio || '');
    if (tipo === 'produtos_saldo') {
        if (window.getProdutosColumnsDefs && typeof window.getProdutosColumnsDefs === 'function') {
            return window.getProdutosColumnsDefs();
        }
        return [
            { key: 'nome', label: 'Produto' },
            { key: 'responsavel', label: 'Responsável' },
            { key: 'motivoDestino', label: 'Motivo / Destino' },
            { key: 'tipoMovimentacao', label: 'Última Mov.' },
            { key: 'unidade', label: 'Unidade' },
            { key: 'quantidade', label: 'Quantidade', align: 'text-center' },
            { key: 'precoMedio', label: 'Preço Médio', align: 'text-right' },
            { key: 'valorTotal', label: 'Total', align: 'text-right' },
            { key: 'ultimaAtualizacao', label: 'Última Atualização' }
        ];
    }
    if (tipo === 'produtos_movimentacao') {
        if (window.getProdutoMovimentacaoColumnsDefs && typeof window.getProdutoMovimentacaoColumnsDefs === 'function') {
            return window.getProdutoMovimentacaoColumnsDefs();
        }
        return [
            { key: 'data', label: 'Data' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'produtoNome', label: 'Produto' },
            { key: 'responsavel', label: 'Responsável' },
            { key: 'motivo', label: 'Motivo / Destino' },
            { key: 'origem', label: 'Origem' },
            { key: 'direcaoEstoque', label: 'Direção' },
            { key: 'saldoAnterior', label: 'Saldo Ant.', align: 'text-right' },
            { key: 'quantidade', label: 'Quantidade', align: 'text-right' },
            { key: 'saldoAtual', label: 'Saldo Atual', align: 'text-right' },
            { key: 'precoUnitario', label: 'Preço Unit.', align: 'text-right' },
            { key: 'documento', label: 'Documento' }
        ];
    }
    if (tipo === 'posicao') {
        return [
            { key: 'plaqueta', label: 'Plaqueta' },
            { key: 'custodia', label: 'Custódia' },
            { key: 'especie', label: 'Espécie' },
            { key: 'diametro', label: 'Rodo', align: 'text-center' },
            { key: 'comprimento', label: 'Comprimento', align: 'text-center' },
            { key: 'oco1', label: 'Oco 1', align: 'text-center' },
            { key: 'oco2', label: 'Oco 2', align: 'text-center' },
            { key: 'volumeDesconto', label: 'M³ Desconto', align: 'text-right' },
            { key: 'volumeBruto', label: 'M³ Bruto', align: 'text-right' },
            { key: 'volumeLiquido', label: 'Volume Líquido', align: 'text-right' },
            { key: 'compGeo', label: 'Comp. Geo.', align: 'text-center' },
            { key: 'x1', label: 'X1', align: 'text-center' },
            { key: 'x2', label: 'X2', align: 'text-center' },
            { key: 'x3', label: 'X3', align: 'text-center' },
            { key: 'x4', label: 'X4', align: 'text-center' },
            { key: 'volumeGeo', label: 'V. Geo.', align: 'text-right' },
            { key: 'precoCusto', label: 'Preço Custo', align: 'text-right' },
            { key: 'valor', label: 'Valor', align: 'text-right' },
            { key: 'localizacao', label: 'Localização' },
            { key: 'fornecedor', label: 'Fornecedor' },
            { key: 'documento', label: 'Documento' },
            { key: 'origemRomaneioId', label: 'Romaneio' },
            { key: 'data', label: 'Data Entrada' },
            { key: 'status', label: 'Status' }
        ];
    }
    if (tipo === 'movimentacao') {
        return [
            { key: 'data', label: 'Data' },
            { key: 'tipo', label: 'Tipo' },
            { key: 'plaqueta', label: 'Plaqueta' },
            { key: 'custodia', label: 'Custódia' },
            { key: 'especie', label: 'Espécie' },
            { key: 'volume', label: 'Volume', align: 'text-right' },
            { key: 'compGeo', label: 'Comp. Geo.', align: 'text-center' },
            { key: 'x1', label: 'X1', align: 'text-center' },
            { key: 'x2', label: 'X2', align: 'text-center' },
            { key: 'x3', label: 'X3', align: 'text-center' },
            { key: 'x4', label: 'X4', align: 'text-center' },
            { key: 'volumeGeo', label: 'V. Geo.', align: 'text-right' },
            { key: 'tipoSaida', label: 'Tipo Saída' },
            { key: 'documento', label: 'Documento' },
            { key: 'remessaId', label: 'Remessa' },
            { key: 'toraId', label: 'ID Tora' },
            { key: 'observacoes', label: 'Romaneio Vinculado' }
        ];
    }
    if (tipo === 'rastreabilidade') {
        return [
            { key: 'data', label: 'Data' },
            { key: 'remessaId', label: 'Remessa' },
            { key: 'movimentacaoId', label: 'Movimentação' },
            { key: 'toraId', label: 'ID Tora' },
            { key: 'plaqueta', label: 'Plaqueta' },
            { key: 'custodia', label: 'Custódia' },
            { key: 'especie', label: 'Espécie' },
            { key: 'numeroRomaneio', label: 'Romaneio' },
            { key: 'tipoRomaneio', label: 'Tipo Rom.' },
            { key: 'clienteNome', label: 'Cliente/Fornecedor' },
            { key: 'volumeTora', label: 'Vol. Tora', align: 'text-right' },
            { key: 'volumeTorasRemessa', label: 'Vol. Remessa', align: 'text-right' },
            { key: 'volumeProduzido', label: 'Vol. Produzido', align: 'text-right' },
            { key: 'rendimento', label: 'Rendimento', align: 'text-right' },
            { key: 'volumeGeo', label: 'V. Geo.', align: 'text-right' },
            { key: 'usuarioNome', label: 'Usuário' },
            { key: 'status', label: 'Status' },
            { key: 'origem', label: 'Origem' },
            { key: 'confiabilidade', label: 'Confiança' }
        ];
    }
    if (tipo === 'especies') {
        return [
            { key: 'especie', label: 'Espécie' },
            { key: 'quantidade', label: 'Quantidade', align: 'text-right' },
            { key: 'volume', label: 'Volume', align: 'text-right' },
            { key: 'volumeGeo', label: 'V. Geo.', align: 'text-right' },
            { key: 'mediaRodo', label: 'Média Rodo', align: 'text-right' },
            { key: 'mediaComprimento', label: 'Média Comprimento', align: 'text-right' },
            { key: 'mediaVolume', label: 'Média Volume', align: 'text-right' },
            { key: 'mediaVolumeGeo', label: 'Média V. Geo.', align: 'text-right' },
            { key: 'precoMedio', label: 'Preço Médio', align: 'text-right' },
            { key: 'valor', label: 'Valor', align: 'text-right' }
        ];
    }
    if (tipo === 'localizacao') {
        return [
            { key: 'localizacao', label: 'Localização' },
            { key: 'especies', label: 'Espécies' },
            { key: 'quantidade', label: 'Quantidade', align: 'text-right' },
            { key: 'volume', label: 'Volume', align: 'text-right' },
            { key: 'volumeGeo', label: 'V. Geo.', align: 'text-right' },
            { key: 'mediaRodo', label: 'Média Rodo', align: 'text-right' },
            { key: 'mediaComprimento', label: 'Média Comprimento', align: 'text-right' },
            { key: 'mediaVolume', label: 'Média Volume', align: 'text-right' },
            { key: 'mediaVolumeGeo', label: 'Média V. Geo.', align: 'text-right' },
            { key: 'precoMedio', label: 'Preço Médio', align: 'text-right' },
            { key: 'valor', label: 'Valor', align: 'text-right' }
        ];
    }
    return [];
}

function getEstoqueReportColumnsStorageKey(tipoRelatorio) {
    return obterChavePreferenciaEstoque(`report_columns_${String(tipoRelatorio || 'default')}`);
}

function getEstoqueReportColumnsRemotePath(tipoRelatorio) {
    const uid = obterUsuarioPreferenciaEstoque();
    const tenant = resolveCompanyId() || 'default';
    return `users/${uid}/preferences/estoqueReportColumns/${tenant}/${String(tipoRelatorio || 'default')}`;
}

function getDefaultEstoqueReportColumnsConfig(tipoRelatorio) {
    const cfg = {};
    getEstoqueReportColumnsDefs(tipoRelatorio).forEach(d => { cfg[d.key] = true; });
    return cfg;
}

function getEstoqueReportColumnsConfigSync(tipoRelatorio) {
    const defaults = getDefaultEstoqueReportColumnsConfig(tipoRelatorio);
    try {
        const raw = localStorage.getItem(getEstoqueReportColumnsStorageKey(tipoRelatorio));
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaults;
        const normalized = { ...defaults };
        getEstoqueReportColumnsDefs(tipoRelatorio).forEach(d => {
            if (Object.prototype.hasOwnProperty.call(parsed, d.key)) {
                normalized[d.key] = parsed[d.key] !== false;
            }
        });
        const defs = getEstoqueReportColumnsDefs(tipoRelatorio);
        if (defs.length && defs.every(d => normalized[d.key] === false)) {
            normalized[defs[0].key] = true;
        }
        return normalized;
    } catch (_) {
        return defaults;
    }
}

async function ensureEstoqueReportColumnsConfigLoaded(tipoRelatorio) {
    if (!isEstoqueReportColumnsSupported(tipoRelatorio)) return;
    try {
        if (localStorage.getItem(getEstoqueReportColumnsStorageKey(tipoRelatorio))) return;
    } catch (_) {}
    try {
        if (obterUsuarioPreferenciaEstoque() !== 'anon' && typeof window.getData === 'function') {
            const remote = await window.getData(getEstoqueReportColumnsRemotePath(tipoRelatorio), { debounceMs: 0 });
            if (remote && typeof remote === 'object') {
                localStorage.setItem(getEstoqueReportColumnsStorageKey(tipoRelatorio), JSON.stringify(remote));
            }
        }
    } catch (_) {}
}

async function saveEstoqueReportColumnsConfig(tipoRelatorio, config = {}) {
    const defs = getEstoqueReportColumnsDefs(tipoRelatorio);
    const sanitized = {};
    defs.forEach(d => { sanitized[d.key] = config[d.key] !== false; });
    if (defs.length && defs.every(d => sanitized[d.key] === false)) {
        sanitized[defs[0].key] = true;
    }
    try { localStorage.setItem(getEstoqueReportColumnsStorageKey(tipoRelatorio), JSON.stringify(sanitized)); } catch (_) {}
    try {
        if (obterUsuarioPreferenciaEstoque() !== 'anon' && typeof window.saveData === 'function') {
            await window.saveData(getEstoqueReportColumnsRemotePath(tipoRelatorio), sanitized, { debounceMs: 0, showToast: false });
        }
    } catch (_) {}
    atualizarBotaoColunasRelatorio();
    return sanitized;
}

function getVisibleEstoqueReportColumns(tipoRelatorio) {
    const cfg = getEstoqueReportColumnsConfigSync(tipoRelatorio);
    const defs = getEstoqueReportColumnsDefs(tipoRelatorio);
    const visible = defs.filter(d => cfg[d.key] !== false);
    return visible.length ? visible : defs.slice(0, 1);
}

function atualizarBotaoColunasRelatorio() {
    const tipo = document.getElementById('tipoRelatorio')?.value || '';
    const btn = document.getElementById('btnConfigColunasRelatorio');
    const hint = document.getElementById('relatorioColumnsHint');
    const supported = isEstoqueReportColumnsSupported(tipo);
    if (btn) {
        btn.disabled = !supported;
        btn.style.opacity = supported ? '1' : '0.45';
        btn.title = supported ? 'Configurar colunas deste relatório' : 'Este tipo não possui colunas configuráveis';
    }
    if (hint) {
        if (!tipo) {
            hint.textContent = '';
        } else if (!supported) {
            hint.textContent = 'Sem colunas';
        } else {
            const defs = getEstoqueReportColumnsDefs(tipo);
            const cfg = getEstoqueReportColumnsConfigSync(tipo);
            hint.textContent = `${defs.filter(d => cfg[d.key] !== false).length}/${defs.length}`;
        }
    }
}

function atualizarEstadoTodasColunasRelatorio() {
    const master = document.getElementById('reportColumnsSelectAll');
    const checks = Array.from(document.querySelectorAll('#reportColumnsConfigModal .report-col-check'));
    if (!master || checks.length === 0) return;
    const checkedCount = checks.filter(cb => cb.checked).length;
    master.checked = checkedCount === checks.length;
    master.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

function toggleTodasColunasRelatorio(checked) {
    document.querySelectorAll('#reportColumnsConfigModal .report-col-check').forEach(cb => {
        cb.checked = !!checked;
    });
    atualizarEstadoTodasColunasRelatorio();
}

async function abrirConfiguracaoColunasRelatorio() {
    const tipo = document.getElementById('tipoRelatorio')?.value || '';
    if (!isEstoqueReportColumnsSupported(tipo)) {
        alert('Este tipo de relatório não possui colunas configuráveis.');
        return;
    }
    await ensureEstoqueReportColumnsConfigLoaded(tipo);
    if (!document.getElementById('reportColumnsConfigModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="reportColumnsConfigModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 class="modal-title"><i class="fas fa-list"></i> Colunas do Relatório</h3>
                        <span class="close-modal" onclick="fecharConfiguracaoColunasRelatorio()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div id="reportColumnsConfigMeta" style="color:#64748b; font-size:13px; margin-bottom:10px;"></div>
                        <label class="report-col-item" style="margin-bottom:10px;">
                            <input type="checkbox" id="reportColumnsSelectAll" onchange="toggleTodasColunasRelatorio(this.checked)">
                            <span class="report-col-label"><strong>Selecionar todas as colunas</strong></span>
                        </label>
                        <div id="reportColumnsConfigList"></div>
                    </div>
                    <div class="modal-footer" style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                        <button type="button" class="btn btn-secondary" id="estoqueReportColsResetBtn"><i class="fas fa-undo"></i> Restaurar Padrão</button>
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <button type="button" class="btn btn-secondary" onclick="fecharConfiguracaoColunasRelatorio()"><i class="fas fa-times"></i> Cancelar</button>
                            <button type="button" class="btn btn-primary" onclick="salvarConfiguracaoColunasRelatorio()"><i class="fas fa-check"></i> Salvar</button>
                        </div>
                    </div>
                </div>
            </div>
        `);
        const modalEl = document.getElementById('reportColumnsConfigModal');
        if (modalEl) {
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl) fecharConfiguracaoColunasRelatorio();
            });
        }
        const resetBtn = document.getElementById('estoqueReportColsResetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const modal = document.getElementById('reportColumnsConfigModal');
                const modalTipo = modal?.dataset.tipoRelatorio || document.getElementById('tipoRelatorio')?.value || '';
                const defaults = getDefaultEstoqueReportColumnsConfig(modalTipo);
                document.querySelectorAll('#reportColumnsConfigModal .report-col-check').forEach(cb => {
                    const key = cb.getAttribute('data-col');
                    cb.checked = defaults[key] !== false;
                });
                atualizarEstadoTodasColunasRelatorio();
            });
        }
    }

    const defs = getEstoqueReportColumnsDefs(tipo);
    const cfg = getEstoqueReportColumnsConfigSync(tipo);
    const modal = document.getElementById('reportColumnsConfigModal');
    const meta = document.getElementById('reportColumnsConfigMeta');
    const list = document.getElementById('reportColumnsConfigList');
    const label = document.getElementById('tipoRelatorio')?.selectedOptions?.[0]?.textContent || tipo;
    if (meta) meta.textContent = `Tipo: ${label}`;
    if (list) {
        list.innerHTML = `<div class="report-col-grid">${defs.map(d => `
            <label class="report-col-item">
                <input type="checkbox" class="report-col-check" data-col="${escapeHtml(d.key)}" ${cfg[d.key] !== false ? 'checked' : ''} onchange="atualizarEstadoTodasColunasRelatorio()">
                <span class="report-col-label">${escapeHtml(d.label)}</span>
            </label>
        `).join('')}</div>`;
    }
    atualizarEstadoTodasColunasRelatorio();
    if (modal) {
        modal.dataset.tipoRelatorio = tipo;
        modal.style.display = 'block';
    }
}

function fecharConfiguracaoColunasRelatorio() {
    const modal = document.getElementById('reportColumnsConfigModal');
    if (modal) modal.style.display = 'none';
}

async function salvarConfiguracaoColunasRelatorio() {
    const modal = document.getElementById('reportColumnsConfigModal');
    if (!modal) return;
    const tipo = modal.dataset.tipoRelatorio || '';
    const defs = getEstoqueReportColumnsDefs(tipo);
    const cfg = {};
    defs.forEach(d => { cfg[d.key] = true; });
    document.querySelectorAll('#reportColumnsConfigModal .report-col-check').forEach(cb => {
        const key = cb.getAttribute('data-col');
        if (key) cfg[key] = !!cb.checked;
    });
    await saveEstoqueReportColumnsConfig(tipo, cfg);
    fecharConfiguracaoColunasRelatorio();
    const result = document.getElementById('relatorioResult');
    if (result && result.style.display !== 'none') {
        gerarRelatorio(true);
    }
}

function renderRelatorioEstoqueTh(tipo, def) {
    const cls = def.align ? ` class="${def.align}"` : '';
    return `<th data-col="${escapeHtml(def.key)}" onclick="ordenarRelatorio('${escapeHtml(def.key)}', '${escapeHtml(tipo)}')" style="cursor:pointer;"${cls}>${escapeHtml(def.label)} ${getSortIconRelatorio(def.key, tipo)}</th>`;
}

function obterValorCelulaRelatorioEstoque(tipo, key, item) {
    const geo = normalizarCamposGeoEstoque(item);
    if (tipo === 'posicao') {
        const map = {
            plaqueta: escapeHtml(item.plaqueta || '-'),
            custodia: escapeHtml(geo.custodia || '-'),
            especie: escapeHtml(item.especie || '-'),
            diametro: item.diametro || item.rodo ? `${formatNumber(item.diametro || item.rodo, 1)} cm` : '-',
            comprimento: item.comprimento ? `${formatNumber(item.comprimento, 1)} cm` : '-',
            oco1: item.oco1 ? `${formatNumber(item.oco1, 1)} cm` : '-',
            oco2: item.oco2 ? `${formatNumber(item.oco2, 1)} cm` : '-',
            volumeDesconto: `${formatNumber(item.volumeDesconto || item.desconto || 0, 3)} m³`,
            volumeBruto: `${formatNumber(item.volumeBruto || item.m3Bruto || 0, 3)} m³`,
            volumeLiquido: `${formatNumber(item.volumeLiquido || 0, 3)} m³`,
            compGeo: formatarMedidaGeoEstoque(geo.compGeo),
            x1: formatarMedidaGeoEstoque(geo.x1),
            x2: formatarMedidaGeoEstoque(geo.x2),
            x3: formatarMedidaGeoEstoque(geo.x3),
            x4: formatarMedidaGeoEstoque(geo.x4),
            volumeGeo: `${formatarVolumeGeoEstoque(geo.volumeGeo)} m³`,
            precoCusto: formatCurrency(item.precoCusto || 0),
            valor: formatCurrency((item.volumeLiquido || 0) * (item.precoCusto || 0)),
            localizacao: escapeHtml(item.localizacao || '-'),
            fornecedor: escapeHtml(obterFornecedorDisplayTora(item)),
            documento: escapeHtml(item.documento || '-'),
            origemRomaneioId: escapeHtml(item.origemRomaneioId || item.romaneioId || item.romaneio || '-'),
            data: formatDate(item.data),
            status: escapeHtml(item.status || '-')
        };
        return map[key] ?? '';
    }
    if (tipo === 'movimentacao') {
        const map = {
            data: formatDate(item.data),
            tipo: escapeHtml(String(item.tipo || '').toUpperCase()),
            plaqueta: escapeHtml(item.plaqueta || '-'),
            custodia: escapeHtml(geo.custodia || '-'),
            especie: escapeHtml(item.especie || '-'),
            volume: `${formatNumber(item.volume || 0, 3)} m³`,
            compGeo: formatarMedidaGeoEstoque(geo.compGeo),
            x1: formatarMedidaGeoEstoque(geo.x1),
            x2: formatarMedidaGeoEstoque(geo.x2),
            x3: formatarMedidaGeoEstoque(geo.x3),
            x4: formatarMedidaGeoEstoque(geo.x4),
            volumeGeo: `${formatarVolumeGeoEstoque(geo.volumeGeo)} m³`,
            tipoSaida: escapeHtml(item.tipoSaida || item.tipoBaixa || ''),
            documento: escapeHtml(item.documento || ''),
            remessaId: escapeHtml(item.remessaId || ''),
            toraId: escapeHtml(item.toraId || item.idTora || ''),
            observacoes: escapeHtml(item.observacoes || '')
        };
        return map[key] ?? '';
    }
    if (tipo === 'rastreabilidade') {
        const map = {
            data: formatDate(item.data),
            remessaId: escapeHtml(item.remessaId || '-'),
            movimentacaoId: escapeHtml(item.movimentacaoId || '-'),
            toraId: escapeHtml(item.toraId || '-'),
            plaqueta: escapeHtml(item.plaqueta || '-'),
            custodia: escapeHtml(geo.custodia || item.custodia || '-'),
            especie: escapeHtml(item.especie || '-'),
            numeroRomaneio: escapeHtml(item.numeroRomaneio || item.romaneioId || '-'),
            tipoRomaneio: escapeHtml(item.tipoRomaneio || '-'),
            clienteNome: escapeHtml(item.clienteNome || '-'),
            volumeTora: `${formatNumber(item.volumeTora || 0, 3)} m³`,
            volumeTorasRemessa: `${formatNumber(item.volumeTorasRemessa || item.volumeTora || 0, 3)} m³`,
            volumeProduzido: `${formatNumber(item.volumeProduzido || 0, 3)} m³`,
            rendimento: `${formatNumber(item.rendimento || 0, 2)}%`,
            volumeGeo: `${formatarVolumeGeoEstoque(geo.volumeGeo || item.volumeGeo)} m³`,
            usuarioNome: escapeHtml(item.usuarioNome || item.usuarioEmail || item.usuarioId || '-'),
            status: escapeHtml(item.status || 'ativo'),
            origem: escapeHtml(item.origem || '-'),
            confiabilidade: escapeHtml(item.confiabilidade || '-')
        };
        return map[key] ?? '';
    }
    if (tipo === 'especies' || tipo === 'localizacao') {
        const map = {
            especie: escapeHtml(item.especie || 'Sem espécie'),
            localizacao: escapeHtml(item.localizacao || 'Sem localização'),
            especies: escapeHtml(item.especiesTexto || item.especies || '-'),
            quantidade: String(item.quantidade || 0),
            volume: `${formatNumber(item.volume || 0, 3)} m³`,
            volumeGeo: `${formatNumber(item.volumeGeo || 0, 3)} m³`,
            mediaRodo: item.mediaRodo ? `${formatNumber(item.mediaRodo, 1)} cm` : '-',
            mediaComprimento: item.mediaComprimento ? `${formatNumber(item.mediaComprimento, 1)} cm` : '-',
            mediaVolume: `${formatNumber(item.mediaVolume || 0, 3)} m³`,
            mediaVolumeGeo: `${formatNumber(item.mediaVolumeGeo || 0, 3)} m³`,
            precoMedio: formatCurrency(item.precoMedio || 0),
            valor: formatCurrency(item.valor || 0)
        };
        return map[key] ?? '';
    }
    return '';
}

function renderRelatorioEstoqueTd(tipo, def, item) {
    const cls = def.align ? ` class="${def.align}"` : '';
    return `<td data-col="${escapeHtml(def.key)}"${cls}>${obterValorCelulaRelatorioEstoque(tipo, def.key, item)}</td>`;
}

function ordenarListaRelatorioEstoque(tipo, lista) {
    if (ordemRelatorio.tipo !== tipo || !ordemRelatorio.coluna) return lista;
    const coluna = ordemRelatorio.coluna;
    return lista.sort((a, b) => compararValoresEstoque(a, b, coluna, ordemRelatorio.direcao));
}

function montarTabelaRelatorioEstoque(tipo, items, selectionTipo, getKey, onlySelected, emptyText) {
    const defs = getVisibleEstoqueReportColumns(tipo);
    const linhas = items.map(item => `
        <tr>
            ${renderRelatorioSelecionarTd(selectionTipo, getKey(item), onlySelected)}
            ${defs.map(def => renderRelatorioEstoqueTd(tipo, def, item)).join('')}
        </tr>
    `).join('');
    const colspan = defs.length + (onlySelected ? 0 : 1);
    return `
        <div class="table-container">
            <table class="table table-wide-estoque">
                <thead>
                    <tr>
                        ${renderRelatorioSelecionarTodosTh(onlySelected)}
                        ${defs.map(def => renderRelatorioEstoqueTh(tipo, def)).join('')}
                    </tr>
                </thead>
                <tbody>${linhas || `<tr><td colspan="${colspan}">${emptyText}</td></tr>`}</tbody>
            </table>
        </div>
    `;
}

window.criarRelatorioSelectionId = criarRelatorioSelectionId;
window.getRelatorioProdutoMovimentacaoKey = getRelatorioProdutoMovimentacaoKey;
window.getRelatorioRastreabilidadeKey = getRelatorioRastreabilidadeKey;
window.filtrarItensSelecionadosRelatorio = filtrarItensSelecionadosRelatorio;
window.renderRelatorioSelecionarTodosTh = renderRelatorioSelecionarTodosTh;
window.renderRelatorioSelecionarTd = renderRelatorioSelecionarTd;
window.getEstoqueReportColumnsDefs = getEstoqueReportColumnsDefs;
window.getVisibleEstoqueReportColumns = getVisibleEstoqueReportColumns;

async function gerarRelatorio(isSort = false) {
    const tipoRelatorio = document.getElementById('tipoRelatorio').value;
    const dataInicio = document.getElementById('relDataInicio').value;
    const dataFim = document.getElementById('relDataFim').value;
    await ensureEstoqueReportColumnsConfigLoaded(tipoRelatorio);

    const options = {
        tipo: (document.getElementById('relFiltroTipo')?.value || '').trim(),
        agruparPorResponsavel: !!document.getElementById('relAgruparResponsavel')?.checked
    };

    if (!isSort) {
        window.relatorioSelecionados.clear();
        window.ordemRelatorio = { coluna: '', direcao: 'asc', tipo: tipoRelatorio };
    }

    const conteudo = await obterConteudoRelatorio(tipoRelatorio, dataInicio, dataFim, options, false);
    window.__ultimoRelatorioEstoque = { tipoRelatorio, dataInicio, dataFim, conteudo, options };
    document.getElementById('relatorioContent').innerHTML = conteudo;
    document.getElementById('relatorioResult').style.display = 'block';
    atualizarBotaoColunasRelatorio();

    const masters = document.querySelectorAll('.check-todo-relatorio');
    if (masters.length > 0) {
        const checks = document.querySelectorAll('.check-relatorio');
        const allChecked = checks.length > 0 && Array.from(checks).every(c => c.checked);
        masters.forEach(master => { master.checked = allChecked; });
    }
}

async function obterConteudoRelatorio(tipoRelatorio, dataInicio, dataFim, options = {}, onlySelected = false) {
    switch (tipoRelatorio) {
        case 'posicao':
            return gerarRelatorioPosicao(onlySelected);
        case 'movimentacao':
            return gerarRelatorioMovimentacao(dataInicio, dataFim, onlySelected);
        case 'rastreabilidade':
            return gerarRelatorioRastreabilidade(dataInicio, dataFim, onlySelected);
        case 'especies':
            return gerarRelatorioPorEspecies(onlySelected);
        case 'localizacao':
            return gerarRelatorioPorLocalizacao(onlySelected);
        case 'produtos_saldo':
            if (typeof window.gerarRelatorioProdutosSaldo === 'function') {
                return await window.gerarRelatorioProdutosSaldo(onlySelected);
            }
            return '<p class="text-danger">Módulo de produtos não carregado.</p>';
        case 'produtos_movimentacao':
            if (typeof window.gerarRelatorioProdutosMovimentacao === 'function') {
                return await window.gerarRelatorioProdutosMovimentacao(dataInicio, dataFim, options, onlySelected);
            }
            return '<p class="text-danger">Módulo de produtos não carregado.</p>';
        default:
            return '';
    }
}

try {
    document.addEventListener('DOMContentLoaded', () => {
        const el = document.getElementById('tipoRelatorio');
        if (el) {
            el.addEventListener('change', () => {
                updateRelatoriosProdutosFiltersUI();
                atualizarBotaoColunasRelatorio();
            });
            updateRelatoriosProdutosFiltersUI();
            atualizarBotaoColunasRelatorio();
        }

        const tipoFiltro = document.getElementById('relFiltroTipo');
        if (tipoFiltro && !tipoFiltro._listenerConfigured) {
            tipoFiltro.addEventListener('change', () => {
                const tipoRelatorio = document.getElementById('tipoRelatorio')?.value || '';
                const result = document.getElementById('relatorioResult');
                if (tipoRelatorio === 'produtos_movimentacao' && result && result.style.display !== 'none') {
                    gerarRelatorio();
                }
            });
            tipoFiltro._listenerConfigured = true;
        }

        const agruparChk = document.getElementById('relAgruparResponsavel');
        if (agruparChk && !agruparChk._listenerConfigured) {
            agruparChk.addEventListener('change', () => {
                const tipoRelatorio = document.getElementById('tipoRelatorio')?.value || '';
                const result = document.getElementById('relatorioResult');
                if (tipoRelatorio === 'produtos_movimentacao' && result && result.style.display !== 'none') {
                    gerarRelatorio();
                }
            });
            agruparChk._listenerConfigured = true;
        }
    });
} catch (_) {}

function updateRelatoriosProdutosFiltersUI() {
    const tipoRelatorio = document.getElementById('tipoRelatorio')?.value || '';
    const show = tipoRelatorio === 'produtos_movimentacao';
    const tipoGroup = document.getElementById('relFiltroTipoGroup');
    const agruparGroup = document.getElementById('relAgruparResponsavelGroup');
    if (tipoGroup) tipoGroup.style.display = show ? 'block' : 'none';
    if (agruparGroup) agruparGroup.style.display = show ? 'block' : 'none';
    if (!show) {
        const tipoEl = document.getElementById('relFiltroTipo');
        const chk = document.getElementById('relAgruparResponsavel');
        if (tipoEl) tipoEl.value = '';
        if (chk) chk.checked = false;
    }
}

function obterTituloRelatorioEstoque(tipo) {
    const map = {
        posicao: 'Posição do Estoque de Toras',
        movimentacao: 'Movimentação de Toras',
        rastreabilidade: 'Rastreabilidade de Toras',
        especies: 'Estoque por Espécie (Toras)',
        localizacao: 'Estoque por Localização (Toras)',
        produtos_saldo: 'Saldo de Produtos (Almoxarifado)',
        produtos_movimentacao: 'Movimentação de Produtos (Almoxarifado)'
    };
    return map[tipo] || 'Relatório de Estoque';
}

async function obterDadosEmpresaRelatorio() {
    try {
        const normalizeLogo = (value) => {
            if (!value) return '';
            const s = String(value).trim();
            if (!s) return '';
            if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('file:')) return s;
            if (/^https?:\/\//i.test(s)) return s;
            if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 80) return `data:image/png;base64,${s}`;
            if (/^(\.\/|\.\.\/|\/)/.test(s) || /\.(png|jpg|jpeg|webp|svg)$/i.test(s)) return s;
            return s;
        };

        const centralSvc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (centralSvc && typeof centralSvc.getCompanyProfileForReport === 'function') {
            try {
                const centralResult = await centralSvc.getCompanyProfileForReport();
                const centralData = centralResult && centralResult.success !== false
                    ? (centralResult.data || centralResult)
                    : null;
                if (centralData && typeof centralData === 'object') {
                    const logoCandidate = centralData.logoUrl || centralData.logoURL || centralData.logoDownloadURL || centralData.logoStoragePath || centralData.logoPath || centralData.logo || centralData.logoBase64 || centralData.logoData || '';
                    return await prepararLogoEmpresaRelatorio({ ...centralData, logo: normalizeLogo(logoCandidate) });
                }
            } catch (error) {
                console.warn('Aviso ao obter empresa pelo helper central:', error);
            }
        }

        const resolveCompanyId = () => {
            try {
                const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
                if (svc && typeof svc.getCurrentTenantId === 'function') {
                    const t = svc.getCurrentTenantId();
                    if (t) return String(t);
                }
                if (svc && typeof svc.getTenantId === 'function') {
                    const t = svc.getTenantId();
                    if (t) return String(t);
                }
            } catch (_) {}
            try {
                if (window.appTenantId) return String(window.appTenantId);
                const stored = localStorage.getItem('company_info');
                if (stored) {
                    const obj = JSON.parse(stored);
                    const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
                    if (id) return String(id);
                }
            } catch (_) {}
            return null;
        };

        const tenantId = resolveCompanyId();
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        let empresa = {};

        if (tenantId && svc && typeof svc.setTenantId === 'function') {
            try { svc.setTenantId(tenantId); } catch (_) {}
        }

        if (tenantId && svc && typeof svc.loadFromFirebase === 'function') {
            try {
                const byPath = await svc.loadFromFirebase(`companies/${tenantId}/profile`);
                const byPathData = byPath && (byPath.success === true ? byPath.data : (byPath.success === false ? null : byPath));
                if (byPathData && typeof byPathData === 'object') {
                    empresa = { ...empresa, ...byPathData, id: tenantId, companyId: tenantId, tenantId: tenantId };
                }
            } catch (_) {}
        }

        if (!empresa || (!empresa.nome && !empresa.name)) {
            try {
                let payload = null;
                if (typeof window.getData === 'function') {
                    payload = tenantId ? await window.getData(`companies/${tenantId}/profile`) : null;
                } else if (typeof window.getDataAsync === 'function') {
                    payload = tenantId ? await window.getDataAsync(`companies/${tenantId}/profile`) : null;
                }
                if (payload && typeof payload === 'object') {
                    empresa = { ...empresa, ...payload, id: tenantId, companyId: tenantId, tenantId: tenantId };
                }
            } catch (_) {}
        }

        if (!empresa || (!empresa.nome && !empresa.name)) {
            try {
                const raw = localStorage.getItem('company_info');
                if (raw) empresa = { ...empresa, ...(JSON.parse(raw) || {}) };
            } catch (_) {}
        }

        // Normalize data
        const dadosPadrao = {
            nome: "Empresa não informada",
            name: "Empresa não informada",
            cnpj: "-",
            endereco: "-",
            address: "-",
            cidade: "-",
            city: "-",
            estado: "-",
            state: "-",
            telefone: "-",
            phone: "-",
            email: "-",
            logo: "",
            logoSvg: true
        };

        const empresaFinal = { ...dadosPadrao, ...(empresa || {}) };

        const nameResolved = empresaFinal.name || empresaFinal.nome;
        if (nameResolved) {
            empresaFinal.nome = nameResolved;
            empresaFinal.name = nameResolved;
        }
        const addressResolved = empresaFinal.address || empresaFinal.endereco;
        if (addressResolved) {
            empresaFinal.endereco = addressResolved;
            empresaFinal.address = addressResolved;
        }
        const cityResolved = empresaFinal.city || empresaFinal.cidade;
        if (cityResolved) {
            empresaFinal.cidade = cityResolved;
            empresaFinal.city = cityResolved;
        }
        const stateResolved = empresaFinal.state || empresaFinal.estado;
        if (stateResolved) {
            empresaFinal.estado = stateResolved;
            empresaFinal.state = stateResolved;
        }
        const phoneResolved = empresaFinal.phone || empresaFinal.telefone;
        if (phoneResolved) {
            empresaFinal.telefone = phoneResolved;
            empresaFinal.phone = phoneResolved;
        }
        const logoCandidate = empresaFinal.logoUrl || empresaFinal.logoURL || empresaFinal.logoDownloadURL || empresaFinal.logoStoragePath || empresaFinal.logoPath || empresaFinal.logo || empresaFinal.logoBase64 || empresaFinal.logoData || '';
        empresaFinal.logo = normalizeLogo(logoCandidate);

        return await prepararLogoEmpresaRelatorio(empresaFinal);
    } catch (_) {
        return {};
    }
}

function normalizarLogoStoragePathEstoque(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^gs:\/\//i.test(raw)) {
        return raw.replace(/^gs:\/\/[^/]+\//i, '').replace(/^\/+/, '');
    }
    if (/^https?:\/\//i.test(raw)) {
        try {
            const url = new URL(raw, typeof window !== 'undefined' && window.location ? window.location.origin : undefined);
            const host = String(url.hostname || '').toLowerCase();
            const isStorageHost = host.includes('firebasestorage.googleapis.com') || host.endsWith('.firebasestorage.app');
            if (!isStorageHost) return '';
            const marker = '/o/';
            const index = url.pathname.indexOf(marker);
            if (index < 0) return '';
            return decodeURIComponent(url.pathname.slice(index + marker.length)).replace(/^\/+/, '');
        } catch (_) {
            return '';
        }
    }
    const clean = raw.replace(/^\/+/, '');
    if (/^companies\/[^/]+\/profile\/logo\/[^/]+$/i.test(clean)) return clean;
    return '';
}

function obterLogoStoragePathEmpresaRelatorio(empresa = {}) {
    const candidates = [
        empresa.logoStoragePath,
        empresa.logoPath,
        empresa.storagePath,
        empresa.logoRef,
        empresa.logo
    ];
    for (const candidate of candidates) {
        const storagePath = normalizarLogoStoragePathEstoque(candidate);
        if (storagePath) return storagePath;
    }
    return '';
}

async function prepararLogoEmpresaRelatorio(empresa = {}) {
    const prepared = { ...(empresa || {}) };
    if (obterLogoEmpresaSrc(prepared)) return prepared;

    const logoStoragePath = obterLogoStoragePathEmpresaRelatorio(prepared);
    if (!logoStoragePath) return prepared;

    prepared.logoStoragePath = prepared.logoStoragePath || logoStoragePath;
    prepared.logoPath = prepared.logoPath || logoStoragePath;

    const services = [
        window.firebaseService,
        window.firebaseServiceTL,
        window.FirebaseService
    ].filter(Boolean);
    const downloadGetters = [];
    services.forEach((service) => {
        if (typeof service.getStorageDownloadURL === 'function') {
            downloadGetters.push({ owner: service, getter: service.getStorageDownloadURL });
        }
        if (typeof service.getDownloadURL === 'function') {
            downloadGetters.push({ owner: service, getter: service.getDownloadURL });
        }
        if (service.storage && typeof service.storage.getDownloadURL === 'function') {
            downloadGetters.push({ owner: service.storage, getter: service.storage.getDownloadURL });
        }
    });

    for (const { owner, getter } of downloadGetters) {
        try {
            const logoUrl = String(await getter.call(owner, logoStoragePath) || '').trim();
            if (/^(https?:|data:image\/)/i.test(logoUrl)) {
                prepared.logo = logoUrl;
                prepared.logoUrl = logoUrl;
                prepared.logoDownloadURL = logoUrl;
                prepared.logoSvg = false;
                return prepared;
            }
        } catch (error) {
            console.warn('Logo da empresa indisponivel por URL de download:', error);
        }
    }

    const pdfHelper = window.SiswebCommercePdf;
    if (pdfHelper && typeof pdfHelper.resolveCompanyLogoDataUrl === 'function') {
        try {
            const logoDataUrl = String(await pdfHelper.resolveCompanyLogoDataUrl(prepared) || '').trim();
            if (/^data:image\/(png|jpe?g|webp);base64,/i.test(logoDataUrl)) {
                prepared.logo = logoDataUrl;
                prepared.logoDataUrl = logoDataUrl;
                prepared.logoUrl = logoDataUrl;
                prepared.logoSvg = false;
            }
        } catch (error) {
            console.warn('Logo da empresa indisponivel por DataURL:', error);
        }
    }
    return prepared;
}

function obterLogoEmpresaSrc(empresa) {
    const logo = empresa.logoDataUrl || empresa.logoDataURL || empresa.logoUrl || empresa.logoURL || empresa.logoDownloadURL || empresa.logoBase64 || empresa.logoData || empresa.logo || '';
    if (!logo) return '';
    const normalized = String(logo).trim();
    if (!normalized) return '';
    if (normalized.startsWith('data:image')) return normalized;
    if (/^(https?:|blob:|file:)/i.test(normalized)) return normalized;
    if (/^[A-Za-z0-9+/=]+$/.test(normalized) && normalized.length > 100) return `data:image/png;base64,${normalized}`;
    if (/^(\.\/|\.\.\/|\/)/.test(normalized) || (/^[^/\\]+$/i.test(normalized) && /\.(png|jpg|jpeg|webp|svg)$/i.test(normalized))) {
        return normalized;
    }
    return '';
}

function montarRelatorioHtml(empresa, titulo, periodo, corpo, rodape) {
    const nome = empresa.nome || empresa.name || 'Empresa';
    const cnpj = empresa.cnpj || '';
    const endereco = empresa.endereco || empresa.address || '';
    const cidade = empresa.cidade || empresa.city || '';
    const estado = empresa.estado || empresa.state || '';
    const telefone = empresa.telefone || empresa.phone || '';
    const logoSrc = obterLogoEmpresaSrc(empresa);
    const emissao = `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`;
    const periodoHtml = periodo ? `<div>Período: ${periodo}</div>` : '';
    return `
        <div class="relatorio-profissional">
            <div class="relatorio-header">
                <div class="relatorio-logo">${logoSrc ? `<img src="${escapeHtml(logoSrc)}">` : ''}</div>
                <div class="relatorio-empresa">
                    <div class="nome">${nome}</div>
                    <div>${cnpj ? `CNPJ: ${cnpj}` : ''}</div>
                    <div>${endereco}</div>
                    <div>${cidade}${estado ? ` - ${estado}` : ''}</div>
                    <div>${telefone}</div>
                </div>
                <div class="relatorio-meta">
                    <div class="titulo">${titulo}</div>
                    ${periodoHtml}
                    <div>Emissão: ${emissao}</div>
                </div>
            </div>
            ${corpo}
            ${rodape || ''}
        </div>
    `;
}

function obterRelatorioStylesImpressao() {
    return `
        @page { size: landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; color: #111827; padding: 20px; }
        .no-print { display: none !important; }
        .relatorio-profissional { border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px; }
        .relatorio-header { display: grid; grid-template-columns: 120px 1fr 1fr; gap: 12px; align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 12px; }
        .relatorio-logo img { max-width: 120px; max-height: 80px; object-fit: contain; }
        .relatorio-empresa .nome { font-size: 16px; font-weight: bold; }
        .relatorio-meta { text-align: right; font-size: 13px; }
        .relatorio-meta .titulo { font-size: 16px; font-weight: bold; }
        .table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .table-wide-estoque, .table-wide-estoque-lg, .table-wide-estoque-compact { min-width: 0 !important; }
        .table th, .table td { border: 1px solid #e5e7eb; padding: 5px 6px; font-size: 10.5px; }
        .table th { background: #f3f4f6; text-align: left; }
        .table-container { max-height: none; overflow: visible; border: none; padding: 0; }
        .summary-box { background: #f8f9fa; border: 1px solid #e9ecef; padding: 12px; border-radius: 6px; margin-top: 12px; }
        .summary-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .relatorio-rodape { margin-top: 12px; border-top: 2px solid #e5e7eb; padding-top: 10px; }
    `;
}

function obterTextoNoPdfEstoque(node) {
    return String(node?.textContent || '').replace(/\s+/g, ' ').trim();
}

function deveIgnorarCelulaPdfEstoque(cell) {
    if (!cell) return true;
    const classList = cell.classList;
    if (
        classList.contains('no-print') ||
        classList.contains('relatorio-check-col') ||
        classList.contains('actions-col') ||
        classList.contains('actions-cell') ||
        classList.contains('sticky-actions')
    ) {
        return true;
    }
    if (String(cell.getAttribute('data-col') || '').toLowerCase() === 'acoes') return true;
    if (cell.querySelector('input, button')) return true;
    const text = obterTextoNoPdfEstoque(cell).toLowerCase();
    return text === 'ações' || text === 'acoes';
}

function extrairTabelasRelatorioEstoquePdf(html) {
    const host = document.createElement('div');
    host.innerHTML = html || '';

    const summaryRows = Array.from(host.querySelectorAll('.summary-row'))
        .map((row) => {
            const parts = Array.from(row.children).map(obterTextoNoPdfEstoque).filter(Boolean);
            if (parts.length >= 2) return [parts[0].replace(/:$/, ''), parts.slice(1).join(' ')];
            const text = obterTextoNoPdfEstoque(row);
            return text ? [text, ''] : null;
        })
        .filter(Boolean);

    const tables = Array.from(host.querySelectorAll('table'))
        .map((table, index) => {
            const headerCells = Array.from(table.querySelectorAll('thead tr:last-child th'));
            const keep = headerCells
                .map((th, headerIndex) => ({ th, headerIndex }))
                .filter(({ th }) => !deveIgnorarCelulaPdfEstoque(th) && obterTextoNoPdfEstoque(th));
            const columns = keep.map(({ th }) => ({
                label: obterTextoNoPdfEstoque(th).replace(/[↕↑↓]/g, '').trim(),
                align: th.classList.contains('text-right')
                    ? 'right'
                    : (th.classList.contains('text-center') ? 'center' : 'left')
            }));
            const rows = Array.from(table.querySelectorAll('tbody tr'))
                .map((tr) => {
                    const cells = Array.from(tr.children);
                    return keep.map(({ headerIndex }) => obterTextoNoPdfEstoque(cells[headerIndex]));
                })
                .filter((row) => row.some(Boolean));
            return {
                title: index > 0 ? `Tabela ${index + 1}` : '',
                columns,
                rows,
                emptyText: 'Nenhum registro encontrado.'
            };
        })
        .filter((table) => table.columns.length > 0);

    return { summaryRows, tables };
}

async function imprimirRelatorioEstoque() {
    const content = document.getElementById('relatorioContent');
    if (!content) return;
    const data = window.__ultimoRelatorioEstoque || {};
    const tipoRelatorio = data.tipoRelatorio || document.getElementById('tipoRelatorio').value;
    const dataInicio = data.dataInicio || document.getElementById('relDataInicio').value;
    const dataFim = data.dataFim || document.getElementById('relDataFim').value;
    const options = data.options || {
        tipo: (document.getElementById('relFiltroTipo')?.value || '').trim(),
        agruparPorResponsavel: !!document.getElementById('relAgruparResponsavel')?.checked
    };
    await ensureEstoqueReportColumnsConfigLoaded(tipoRelatorio);
    const onlySelected = !!(window.relatorioSelecionados && window.relatorioSelecionados.size > 0);
    const conteudo = await obterConteudoRelatorio(tipoRelatorio, dataInicio, dataFim, options, onlySelected);
    const empresa = await obterDadosEmpresaRelatorio();
    const titulo = obterTituloRelatorioEstoque(tipoRelatorio);
    const periodo = dataInicio && dataFim ? `${formatDate(dataInicio)} a ${formatDate(dataFim)}` : '';
    const rodape = await gerarRodapeRelatorio(tipoRelatorio, dataInicio, dataFim, options, onlySelected);
    const html = montarRelatorioHtml(empresa, titulo, periodo, conteudo, rodape);
    const htmlCompleto = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${titulo}</title>
            <style>${obterRelatorioStylesImpressao()}</style>
        </head>
        <body>${html}</body>
        </html>
    `;
    const pdfData = extrairTabelasRelatorioEstoquePdf(`${conteudo}${rodape || ''}`);
    await entregarRelatorioEstoque({
        title: titulo,
        company: empresa,
        periodo,
        htmlCompleto,
        preview: false,
        windowFeatures: 'width=900,height=700',
        pdfOptions: {
            title: titulo,
            company: empresa,
            subtitle: periodo ? `Período: ${periodo}` : '',
            summaryRows: pdfData.summaryRows,
            tables: pdfData.tables
        }
    });
}

function montarTabelaHtml(colunas, linhas) {
    const head = colunas.map(c => `<th>${c}</th>`).join('');
    const body = linhas.map(l => `<tr>${l.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
    return `<table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

async function imprimirConsultaEstoque() {
    await ensureConsultaColumnsConfigLoaded();
    let lista = [];
    if (typeof estoqueSelecionadas !== 'undefined' && estoqueSelecionadas.size > 0) {
        lista = estoqueAtual.filter(t => estoqueSelecionadas.has(String(t.id)));
    } else {
        lista = estoqueFiltrado.length ? estoqueFiltrado : estoqueAtual.filter(t => t.status === 'disponivel');
    }
    const consultaDefs = getVisibleConsultaColumns();
    const colunas = consultaDefs.map(def => def.label);
    const linhas = lista.map(t => consultaDefs.map(def => obterValorCelulaConsultaEstoque(t, def.key)));
    const totalVol = lista.reduce((acc, t) => acc + (t.volumeLiquido || 0), 0);
    const totalGeo = lista.reduce((acc, t) => acc + (normalizarCamposGeoEstoque(t).volumeGeo || 0), 0);
    const totalVal = lista.reduce((acc, t) => acc + ((t.volumeLiquido || 0) * (t.precoCusto || 0)), 0);
    const rodape = `
        <div class="relatorio-rodape summary-box">
            <div class="summary-row"><span>Total de Toras:</span><span>${lista.length}</span></div>
            <div class="summary-row"><span>Volume Líquido Total:</span><span>${formatNumber(totalVol, 3)} m³</span></div>
            <div class="summary-row"><span>Volume Geométrico Total:</span><span>${formatNumber(totalGeo, 3)} m³</span></div>
            <div class="summary-row"><span>Valor Total:</span><span>${formatCurrency(totalVal)}</span></div>
        </div>
    `;
    const empresa = await obterDadosEmpresaRelatorio();
    const html = montarRelatorioHtml(empresa, 'Consulta de Estoque', '', montarTabelaHtml(colunas, linhas), rodape);
    const htmlCompleto = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Consulta de Estoque</title>
            <style>${obterRelatorioStylesImpressao()}</style>
        </head>
        <body>${html}</body>
        </html>
    `;
    await entregarRelatorioEstoque({
        title: 'Consulta de Estoque',
        company: empresa,
        htmlCompleto,
        preview: true,
        pdfOptions: {
            title: 'Consulta de Estoque',
            company: empresa,
            columns: consultaDefs,
            rows: linhas,
            summaryRows: [
                ['Total de Toras', lista.length],
                ['Volume Líquido Total', `${formatNumber(totalVol, 3)} m³`],
                ['Volume Geométrico Total', `${formatNumber(totalGeo, 3)} m³`],
                ['Valor Total', formatCurrency(totalVal)]
            ]
        }
    });
}

async function imprimirEstoqueProdutos() {
    if (typeof window.ensureProdutosColumnsConfigLoaded === 'function') {
        await window.ensureProdutosColumnsConfigLoaded();
    }
    let lista = [];
    if (typeof produtosSelecionados !== 'undefined' && produtosSelecionados.size > 0) {
        lista = (typeof estoqueProdutos !== 'undefined' ? estoqueProdutos : []).filter(p => produtosSelecionados.has(String(p.id)));
    } else {
        lista = (typeof produtosFiltrados !== 'undefined' && Array.isArray(produtosFiltrados) && produtosFiltrados.length > 0)
            ? produtosFiltrados
            : (typeof estoqueProdutos !== 'undefined' ? estoqueProdutos : []);
    }
    const produtoDefs = typeof window.getVisibleProdutosColumns === 'function'
        ? window.getVisibleProdutosColumns()
        : [
            { key: 'nome', label: 'Produto' },
            { key: 'responsavel', label: 'Responsável' },
            { key: 'motivoDestino', label: 'Motivo / Destino' },
            { key: 'tipoMovimentacao', label: 'Última Mov.' },
            { key: 'unidade', label: 'Unidade' },
            { key: 'quantidade', label: 'Quantidade' },
            { key: 'precoMedio', label: 'Preço Médio' },
            { key: 'valorTotal', label: 'Total' },
            { key: 'ultimaAtualizacao', label: 'Última Atualização' }
        ];
    const colunas = produtoDefs.map(def => def.label);
    const linhas = lista.map(p => produtoDefs.map(def => {
        if (typeof window.obterValorCelulaProduto === 'function') {
            return window.obterValorCelulaProduto(p, def.key);
        }
        const total = (p.quantidade || 0) * (p.precoMedio || 0);
        const dataFmt = p.ultimaAtualizacao ? new Date(p.ultimaAtualizacao).toLocaleDateString('pt-BR') : '-';
        const map = {
            nome: p.nome || '',
            responsavel: p.responsavel || p.ultimoResponsavel || p.responsavelUltimaMovimentacao || '',
            motivoDestino: p.motivoDestino || p.ultimoMotivo || p.motivoUltimaMovimentacao || p.destino || '',
            tipoMovimentacao: p.ultimaMovimentacaoLabel || p.ultimaMovimentacaoTipo || p.tipoUltimaMovimentacao || '',
            unidade: p.unidade || 'un',
            quantidade: formatNumber(p.quantidade, 2),
            precoMedio: formatCurrency(p.precoMedio),
            valorTotal: formatCurrency(total),
            ultimaAtualizacao: dataFmt
        };
        return map[def.key] ?? '';
    }));
    const totalQtd = lista.reduce((acc, p) => acc + (p.quantidade || 0), 0);
    const totalVal = lista.reduce((acc, p) => acc + ((p.quantidade || 0) * (p.precoMedio || 0)), 0);
    const rodape = `
        <div class="relatorio-rodape summary-box">
            <div class="summary-row"><span>Total de Itens:</span><span>${lista.length}</span></div>
            <div class="summary-row"><span>Quantidade Total:</span><span>${formatNumber(totalQtd, 2)}</span></div>
            <div class="summary-row"><span>Valor Total:</span><span>${formatCurrency(totalVal)}</span></div>
        </div>
    `;
    const empresa = await obterDadosEmpresaRelatorio();
    const html = montarRelatorioHtml(empresa, 'Estoque de Almoxarifado', '', montarTabelaHtml(colunas, linhas), rodape);
    const htmlCompleto = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Estoque de Almoxarifado</title>
            <style>${obterRelatorioStylesImpressao()}</style>
        </head>
        <body>${html}</body>
        </html>
    `;
    await entregarRelatorioEstoque({
        title: 'Estoque de Almoxarifado',
        company: empresa,
        htmlCompleto,
        preview: true,
        pdfOptions: {
            title: 'Estoque de Almoxarifado',
            company: empresa,
            columns: produtoDefs,
            rows: linhas,
            summaryRows: [
                ['Total de Itens', lista.length],
                ['Quantidade Total', formatNumber(totalQtd, 2)],
                ['Valor Total', formatCurrency(totalVal)]
            ]
        }
    });
}

async function imprimirMovimentacoesEstoque() {
    await ensureMovimentacoesColumnsConfigLoaded();
    const aplicarFiltroMovimentacoes = (base, filtro) => {
        let out = [...base];
        if (filtro.dataInicio) out = out.filter(m => m.data >= filtro.dataInicio);
        if (filtro.dataFim) out = out.filter(m => m.data <= filtro.dataFim);
        if (filtro.tipo) out = out.filter(m => m.tipo === filtro.tipo);
        if (filtro.remessa) {
            const rem = String(filtro.remessa).toLowerCase();
            out = out.filter(m => {
                const remessa = String(m.remessaId || '').toLowerCase();
                const doc = String(m.documento || '').toLowerCase();
                return remessa.includes(rem) || doc.includes(rem);
            });
        }
        if (filtro.observacoes) {
            const obs = String(filtro.observacoes).toLowerCase();
            out = out.filter(m => String(m.observacoes || '').toLowerCase().includes(obs));
        }
        return out;
    };

    let lista = [];
    if (movimentacoesSelecionadas.size > 0) {
        lista = movimentacoes.filter(m => movimentacoesSelecionadas.has(String(m.id)));
    } else {
        const filtro = filtroMovimentacoesAtual || {};
        const hasFiltro = !!(filtro.tipo || filtro.dataInicio || filtro.dataFim || filtro.remessa || filtro.observacoes);
        if (hasFiltro) {
            if (!filtro.tipo) {
                lista = [];
            } else {
                lista = aplicarFiltroMovimentacoes(movimentacoes, filtro);
            }
        } else if (movimentacoesFiltradas.length) {
            lista = movimentacoesFiltradas.slice();
        } else {
            lista = movimentacoes.slice();
        }

        // Ordenação
        const { coluna, direcao } = ordemMovimentacoes;
        const mult = direcao === 'asc' ? 1 : -1;
        lista.sort((a, b) => {
            let valA = a[coluna];
            let valB = b[coluna];
            if (coluna === 'data') {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
                return (valA - valB) * mult;
            } else if (coluna === 'volume' || coluna === 'volumeGeo') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
                return (valA - valB) * mult;
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
                return valA.localeCompare(valB, 'pt-BR') * mult;
            }
        });
    }
    const movDefs = getVisibleMovimentacoesColumns();
    const colunas = movDefs.map(def => def.label);
    const linhas = lista.map(m => movDefs.map(def => obterValorCelulaMovimentacao(m, def.key, { plain: true })));
    const resumo = await calcularResumoMovimentacoes(lista);
    const { totalVol, totalEntradas, totalSaidas, volumeRomaneios, rendimento } = resumo;
    const totalGeo = lista.reduce((acc, m) => acc + (normalizarCamposGeoEstoque(m).volumeGeo || 0), 0);
    const rodape = `
        <div class="relatorio-rodape summary-box">
            <div class="summary-row"><span>Total de Movimentações:</span><span>${lista.length}</span></div>
            <div class="summary-row"><span>Entradas:</span><span>${totalEntradas}</span></div>
            <div class="summary-row"><span>Saídas:</span><span>${totalSaidas}</span></div>
            <div class="summary-row"><span>Volume Total:</span><span>${formatNumber(totalVol, 3)} m³</span></div>
            <div class="summary-row"><span>Volume Geométrico:</span><span>${formatNumber(totalGeo, 3)} m³</span></div>
            <div class="summary-row"><span>Volume serrado (romaneios):</span><span>${formatNumber(volumeRomaneios, 3)} m³</span></div>
            <div class="summary-row"><span>Rendimento:</span><span>${formatNumber(rendimento, 2)}%</span></div>
        </div>
    `;
    const empresa = await obterDadosEmpresaRelatorio();
    const html = montarRelatorioHtml(empresa, 'Histórico de Movimentações', '', montarTabelaHtml(colunas, linhas), rodape);
    const htmlCompleto = `
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Histórico de Movimentações</title>
            <style>${obterRelatorioStylesImpressao()}</style>
        </head>
        <body>${html}</body>
        </html>
    `;
    await entregarRelatorioEstoque({
        title: 'Histórico de Movimentações',
        company: empresa,
        htmlCompleto,
        preview: true,
        pdfOptions: {
            title: 'Histórico de Movimentações',
            company: empresa,
            columns: movDefs,
            rows: linhas,
            summaryRows: [
                ['Total de Movimentações', lista.length],
                ['Entradas', totalEntradas],
                ['Saídas', totalSaidas],
                ['Volume Total', `${formatNumber(totalVol, 3)} m³`],
                ['Volume Geométrico', `${formatNumber(totalGeo, 3)} m³`],
                ['Volume serrado (romaneios)', `${formatNumber(volumeRomaneios, 3)} m³`],
                ['Rendimento', `${formatNumber(rendimento, 2)}%`]
            ]
        }
    });
}

async function gerarRodapeRelatorio(tipoRelatorio, dataInicio, dataFim, options = {}, onlySelected = false) {
    if (tipoRelatorio === 'posicao') {
        const torasDisponiveis = filtrarItensSelecionadosRelatorio('posicao', estoqueAtual.filter(t => t.status === 'disponivel'), t => t.id || t.plaqueta || '', onlySelected);
        const volumeTotal = torasDisponiveis.reduce((total, tora) => total + (tora.volumeLiquido || 0), 0);
        const volumeGeoTotal = torasDisponiveis.reduce((total, tora) => total + (normalizarCamposGeoEstoque(tora).volumeGeo || 0), 0);
        const valorTotal = torasDisponiveis.reduce((total, tora) => total + ((tora.volumeLiquido || 0) * (tora.precoCusto || 0)), 0);
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Total de Toras:</span><span>${torasDisponiveis.length}</span></div>
                <div class="summary-row"><span>Volume Total:</span><span>${formatNumber(volumeTotal, 3)} m³</span></div>
                <div class="summary-row"><span>Volume Geométrico:</span><span>${formatNumber(volumeGeoTotal, 3)} m³</span></div>
                <div class="summary-row"><span>Valor Total:</span><span>${formatCurrency(valorTotal)}</span></div>
            </div>
        `;
    }
    if (tipoRelatorio === 'movimentacao') {
        const movPeriodo = filtrarItensSelecionadosRelatorio('movimentacao', movimentacoes.filter(m => {
            if (!dataInicio && !dataFim) return true;
            const d = m.data ? parseDateLocalSafe(m.data) : null;
            if (!d) return false;
            if (dataInicio && d < parseDateLocalSafe(dataInicio)) return false;
            if (dataFim && d > parseDateLocalSafe(dataFim + 'T23:59:59')) return false;
            return true;
        }), getRelatorioMovimentacaoKey, onlySelected);
        const entradas = movPeriodo.filter(m => m.tipo === 'entrada');
        const saidas = movPeriodo.filter(m => m.tipo === 'saida');
        const volumeEntradas = entradas.reduce((total, m) => total + (m.volume || 0), 0);
        const volumeSaidas = saidas.reduce((total, m) => total + (m.volume || 0), 0);
        const volumeGeo = movPeriodo.reduce((total, m) => total + (normalizarCamposGeoEstoque(m).volumeGeo || 0), 0);
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Entradas:</span><span>${entradas.length} movimentações - ${formatNumber(volumeEntradas, 3)} m³</span></div>
                <div class="summary-row"><span>Saídas:</span><span>${saidas.length} movimentações - ${formatNumber(volumeSaidas, 3)} m³</span></div>
                <div class="summary-row"><span>Volume Geométrico:</span><span>${formatNumber(volumeGeo, 3)} m³</span></div>
                <div class="summary-row"><span>Saldo:</span><span>${formatNumber(volumeEntradas - volumeSaidas, 3)} m³</span></div>
            </div>
        `;
    }
    if (tipoRelatorio === 'rastreabilidade') {
        const registros = filtrarItensSelecionadosRelatorio(
            'rastreabilidade',
            filtrarRegistrosRastreabilidade({ dataInicio, dataFim }),
            getRelatorioRastreabilidadeKey,
            onlySelected
        );
        const remessas = new Map();
        registros.forEach(reg => {
            const key = reg.remessaId || reg.id;
            if (!remessas.has(key)) {
                remessas.set(key, {
                    volumeToras: parseNumeroEstoque(reg.volumeTorasRemessa || reg.volumeTora) || 0,
                    volumeProduzido: parseNumeroEstoque(reg.volumeProduzido) || 0
                });
            }
        });
        const volumeToras = registros.reduce((acc, reg) => acc + (parseNumeroEstoque(reg.volumeTora) || 0), 0);
        const volumeProduzido = Array.from(remessas.values()).reduce((acc, item) => acc + item.volumeProduzido, 0);
        const volumeBase = Array.from(remessas.values()).reduce((acc, item) => acc + item.volumeToras, 0);
        const rendimento = volumeBase > 0 ? (volumeProduzido / volumeBase) * 100 : 0;
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Registros:</span><span>${registros.length}</span></div>
                <div class="summary-row"><span>Remessas:</span><span>${remessas.size}</span></div>
                <div class="summary-row"><span>Volume das Toras:</span><span>${formatNumber(volumeToras, 3)} m³</span></div>
                <div class="summary-row"><span>Volume Produzido:</span><span>${formatNumber(volumeProduzido, 3)} m³</span></div>
                <div class="summary-row"><span>Rendimento:</span><span>${formatNumber(rendimento, 2)}%</span></div>
            </div>
        `;
    }
    if (tipoRelatorio === 'especies' || tipoRelatorio === 'localizacao') {
        let torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
        if (onlySelected && window.relatorioSelecionados && window.relatorioSelecionados.size > 0) {
            const tipoSelecao = tipoRelatorio === 'especies' ? 'especies' : 'localizacao';
            torasDisponiveis = torasDisponiveis.filter(t => {
                const key = tipoRelatorio === 'especies' ? (t.especie || 'Sem espécie') : (t.localizacao || 'Sem localização');
                return window.relatorioSelecionados.has(criarRelatorioSelectionId(tipoSelecao, key));
            });
        }
        const totalQtd = torasDisponiveis.length;
        const totalVolume = torasDisponiveis.reduce((acc, t) => acc + (t.volumeLiquido || 0), 0);
        const totalVolumeGeo = torasDisponiveis.reduce((acc, t) => acc + (normalizarCamposGeoEstoque(t).volumeGeo || 0), 0);
        const totalValor = torasDisponiveis.reduce((acc, t) => acc + ((t.volumeLiquido || 0) * (t.precoCusto || 0)), 0);
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Total:</span><span>${totalQtd} toras</span></div>
                <div class="summary-row"><span>Volume:</span><span>${formatNumber(totalVolume, 3)} m³</span></div>
                <div class="summary-row"><span>Volume Geométrico:</span><span>${formatNumber(totalVolumeGeo, 3)} m³</span></div>
                <div class="summary-row"><span>Valor:</span><span>${formatCurrency(totalValor)}</span></div>
            </div>
        `;
    }
    if (tipoRelatorio === 'produtos_saldo') {
        const produtosRaw = await getData('estoqueProdutos') || [];
        const produtosArr = Array.isArray(produtosRaw) ? produtosRaw : Object.values(produtosRaw || {});
        const produtos = filtrarItensSelecionadosRelatorio('produtos_saldo', produtosArr, p => p.id || p.nome || '', onlySelected);
        const totalItens = produtos.length;
        const totalQtd = produtos.reduce((acc, p) => acc + (p.quantidade || 0), 0);
        const totalValor = produtos.reduce((acc, p) => acc + ((p.quantidade || 0) * (p.precoMedio || 0)), 0);
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Itens diferentes:</span><span>${totalItens}</span></div>
                <div class="summary-row"><span>Quantidade total:</span><span>${formatNumber(totalQtd, 2)}</span></div>
                <div class="summary-row"><span>Valor total:</span><span>${formatCurrency(totalValor)}</span></div>
            </div>
        `;
    }
    if (tipoRelatorio === 'produtos_movimentacao') {
        const movimentosRaw = await getData('movimentacoesProdutos') || [];
        const movimentos = Array.isArray(movimentosRaw) ? movimentosRaw : Object.values(movimentosRaw || {});
        const filtrados = movimentos.filter(m => {
            if (!dataInicio && !dataFim) return true;
            const d = m.data ? parseDateLocalSafe(m.data) : null;
            if (!d) return false;
            if (dataInicio && d < parseDateLocalSafe(dataInicio)) return false;
            if (dataFim && d > parseDateLocalSafe(dataFim + 'T23:59:59')) return false;
            return true;
        });
        const tipoFiltro = (options && options.tipo) ? String(options.tipo).trim() : '';
        const normalizarTipo = typeof window.normalizarTipoMovimentacaoProduto === 'function'
            ? window.normalizarTipoMovimentacaoProduto
            : (tipo) => String(tipo || 'entrada').toLowerCase().trim();
        const filtradosTipoBase = tipoFiltro ? filtrados.filter(m => normalizarTipo(m.tipo || m.tipoMovimentacao) === normalizarTipo(tipoFiltro)) : filtrados;
        const filtradosTipo = filtrarItensSelecionadosRelatorio('produtos_movimentacao', filtradosTipoBase, getRelatorioProdutoMovimentacaoKey, onlySelected);
        let entradas = 0;
        let saidas = 0;
        let ajustes = 0;
        let devolucoes = 0;
        filtradosTipo.forEach(m => {
            const tipo = normalizarTipo(m.tipo || m.tipoMovimentacao);
            if (tipo === 'entrada') entradas++;
            else if (tipo === 'saida') saidas++;
            else if (tipo === 'ajuste') ajustes++;
            else if (tipo === 'devolucao') devolucoes++;
        });
        return `
            <div class="relatorio-rodape summary-box">
                <div class="summary-row"><span>Total de Movimentações:</span><span>${filtradosTipo.length}</span></div>
                <div class="summary-row"><span>Entradas:</span><span>${entradas}</span></div>
                <div class="summary-row"><span>Saídas:</span><span>${saidas}</span></div>
                <div class="summary-row"><span>Ajustes:</span><span>${ajustes}</span></div>
                <div class="summary-row"><span>Devoluções:</span><span>${devolucoes}</span></div>
            </div>
        `;
    }
    return '';
}

window.ordemRelatorio = window.ordemRelatorio || { coluna: '', direcao: 'asc', tipo: '' };

window.ordenarRelatorio = function(coluna, tipo) {
    if (window.ordemRelatorio.coluna === coluna && window.ordemRelatorio.tipo === tipo) {
        window.ordemRelatorio.direcao = window.ordemRelatorio.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        window.ordemRelatorio.coluna = coluna;
        window.ordemRelatorio.direcao = 'asc';
        window.ordemRelatorio.tipo = tipo;
    }
    gerarRelatorio(true);
};

window.getSortIconRelatorio = (col, tipo) => {
    if (window.ordemRelatorio.tipo !== tipo || window.ordemRelatorio.coluna !== col) return '<i class="fas fa-sort sort-icon" style="margin-left:5px; color:#ccc;"></i>';
    return `<i class="fas fa-sort-${window.ordemRelatorio.direcao === 'asc' ? 'up' : 'down'} sort-icon" style="margin-left:5px; color:#333;"></i>`;
};

function gerarRelatorioPosicao(onlySelected = false) {
    let torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
    torasDisponiveis = filtrarItensSelecionadosRelatorio('posicao', torasDisponiveis, t => t.id || t.plaqueta || '', onlySelected);

    ordenarListaRelatorioEstoque('posicao', torasDisponiveis);

    const volumeTotal = torasDisponiveis.reduce((total, tora) => total + tora.volumeLiquido, 0);
    const volumeGeoTotal = torasDisponiveis.reduce((total, tora) => total + (normalizarCamposGeoEstoque(tora).volumeGeo || 0), 0);
    const valorTotal = torasDisponiveis.reduce((total, tora) => total + (tora.volumeLiquido * (tora.precoCusto || 0)), 0);
    return `
        <div class="summary-box">
            <div class="summary-row"><span>Total de Toras:</span><span>${torasDisponiveis.length}</span></div>
            <div class="summary-row"><span>Volume Total:</span><span>${formatNumber(volumeTotal, 3)} m³</span></div>
            <div class="summary-row"><span>Volume Geométrico:</span><span>${formatNumber(volumeGeoTotal, 3)} m³</span></div>
            <div class="summary-row"><span>Valor Total:</span><span>${formatCurrency(valorTotal)}</span></div>
        </div>
        ${montarTabelaRelatorioEstoque('posicao', torasDisponiveis, 'posicao', t => t.id || t.plaqueta || '', onlySelected, 'Nenhuma tora disponível')}
    `;
}

function gerarRelatorioMovimentacao(dataInicio, dataFim, onlySelected = false) {
    if (!dataInicio || !dataFim) {
        return '<p>Informe o período para o relatório de movimentação.</p>';
    }

    const movPeriodo = filtrarItensSelecionadosRelatorio(
        'movimentacao',
        movimentacoes.filter(m => m.data >= dataInicio && m.data <= dataFim),
        getRelatorioMovimentacaoKey,
        onlySelected
    );
    const entradas = movPeriodo.filter(m => m.tipo === 'entrada');
    const saidas = movPeriodo.filter(m => m.tipo === 'saida');

    const volumeEntradas = entradas.reduce((total, m) => total + m.volume, 0);
    const volumeSaidas = saidas.reduce((total, m) => total + m.volume, 0);
    const volumeGeo = movPeriodo.reduce((total, m) => total + (normalizarCamposGeoEstoque(m).volumeGeo || 0), 0);
    if (ordemRelatorio.tipo === 'movimentacao' && ordemRelatorio.coluna) {
        ordenarListaRelatorioEstoque('movimentacao', movPeriodo);
    } else {
        movPeriodo.sort((a,b)=> new Date(b.data) - new Date(a.data));
    }

    return `
        <div class="summary-box">
            <div class="summary-row"><span>Entradas:</span><span>${entradas.length} movimentações - ${formatNumber(volumeEntradas, 3)} m³</span></div>
            <div class="summary-row"><span>Saídas:</span><span>${saidas.length} movimentações - ${formatNumber(volumeSaidas, 3)} m³</span></div>
            <div class="summary-row"><span>Volume Geométrico:</span><span>${formatNumber(volumeGeo, 3)} m³</span></div>
            <div class="summary-row"><span>Saldo:</span><span>${formatNumber(volumeEntradas - volumeSaidas, 3)} m³</span></div>
        </div>
        ${montarTabelaRelatorioEstoque('movimentacao', movPeriodo, 'movimentacao', getRelatorioMovimentacaoKey, onlySelected, 'Nenhuma movimentação')}
    `;
}

function gerarRelatorioRastreabilidade(dataInicio, dataFim, onlySelected = false) {
    const registros = filtrarItensSelecionadosRelatorio(
        'rastreabilidade',
        filtrarRegistrosRastreabilidade({ dataInicio, dataFim }),
        getRelatorioRastreabilidadeKey,
        onlySelected
    );
    if (ordemRelatorio.tipo === 'rastreabilidade' && ordemRelatorio.coluna) {
        ordenarListaRelatorioEstoque('rastreabilidade', registros);
    }
    const toras = new Set(registros.map(r => r.toraId || r.plaqueta).filter(Boolean)).size;
    const remessas = new Set(registros.map(r => r.remessaId).filter(Boolean)).size;
    const romaneios = new Set(registros.flatMap(r => (r.romaneios || []).map(rom => rom.id || rom.numero).filter(Boolean))).size;
    const volumeToras = registros.reduce((acc, reg) => acc + (parseNumeroEstoque(reg.volumeTora) || 0), 0);
    const remessasResumo = new Map();
    registros.forEach(reg => {
        const key = reg.remessaId || reg.id;
        if (!remessasResumo.has(key)) {
            remessasResumo.set(key, {
                volumeToras: parseNumeroEstoque(reg.volumeTorasRemessa || reg.volumeTora) || 0,
                volumeProduzido: parseNumeroEstoque(reg.volumeProduzido) || 0
            });
        }
    });
    const volumeProduzido = Array.from(remessasResumo.values()).reduce((acc, item) => acc + item.volumeProduzido, 0);
    const volumeBase = Array.from(remessasResumo.values()).reduce((acc, item) => acc + item.volumeToras, 0);
    const rendimento = volumeBase > 0 ? (volumeProduzido / volumeBase) * 100 : 0;

    return `
        <div class="summary-box">
            <div class="summary-row"><span>Registros:</span><span>${registros.length}</span></div>
            <div class="summary-row"><span>Toras:</span><span>${toras}</span></div>
            <div class="summary-row"><span>Remessas:</span><span>${remessas}</span></div>
            <div class="summary-row"><span>Romaneios:</span><span>${romaneios}</span></div>
            <div class="summary-row"><span>Volume das Toras:</span><span>${formatNumber(volumeToras, 3)} m³</span></div>
            <div class="summary-row"><span>Volume Produzido:</span><span>${formatNumber(volumeProduzido, 3)} m³</span></div>
            <div class="summary-row"><span>Rendimento:</span><span>${formatNumber(rendimento, 2)}%</span></div>
        </div>
        ${montarTabelaRelatorioEstoque('rastreabilidade', registros, 'rastreabilidade', getRelatorioRastreabilidadeKey, onlySelected, 'Nenhuma rastreabilidade encontrada')}
    `;
}

function gerarRelatorioPorEspecies(onlySelected = false) {
    const torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
    const especiesMap = {};

    torasDisponiveis.forEach(tora => {
        const especie = tora.especie || 'Sem espécie';
        if (!especiesMap[especie]) {
            especiesMap[especie] = {
                quantidade: 0,
                volume: 0,
                volumeGeo: 0,
                valor: 0,
                totalRodo: 0,
                totalComprimento: 0,
                countRodo: 0,
                countComprimento: 0
            };
        }

        const rodo = parseNumeroEstoque(tora.diametro || tora.rodo);
        const comprimento = parseNumeroEstoque(tora.comprimento);
        const volumeLiquido = parseNumeroEstoque(tora.volumeLiquido);
        const precoCusto = parseNumeroEstoque(tora.precoCusto || tora.preco);

        especiesMap[especie].quantidade++;
        especiesMap[especie].volume += volumeLiquido;
        especiesMap[especie].volumeGeo += normalizarCamposGeoEstoque(tora).volumeGeo || 0;
        especiesMap[especie].valor += volumeLiquido * precoCusto;
        if (rodo) {
            especiesMap[especie].totalRodo += rodo;
            especiesMap[especie].countRodo++;
        }
        if (comprimento) {
            especiesMap[especie].totalComprimento += comprimento;
            especiesMap[especie].countComprimento++;
        }
    });

    let entradasArr = Object.entries(especiesMap).map(([especie, dados]) => ({
        especie,
        quantidade: dados.quantidade,
        volume: dados.volume,
        volumeGeo: dados.volumeGeo,
        mediaRodo: dados.countRodo ? dados.totalRodo / dados.countRodo : 0,
        mediaComprimento: dados.countComprimento ? dados.totalComprimento / dados.countComprimento : 0,
        mediaVolume: dados.quantidade ? dados.volume / dados.quantidade : 0,
        mediaVolumeGeo: dados.quantidade ? dados.volumeGeo / dados.quantidade : 0,
        precoMedio: dados.volume ? dados.valor / dados.volume : 0,
        valor: dados.valor
    }));
    entradasArr = filtrarItensSelecionadosRelatorio('especies', entradasArr, item => item.especie || 'Sem espécie', onlySelected);
    
    if (ordemRelatorio.tipo === 'especies' && ordemRelatorio.coluna) {
        ordenarListaRelatorioEstoque('especies', entradasArr);
    }

    return `
        ${montarTabelaRelatorioEstoque('especies', entradasArr, 'especies', item => item.especie || 'Sem espécie', onlySelected, 'Nenhum registro')}
    `;
}

function gerarRelatorioPorLocalizacao(onlySelected = false) {
    const torasDisponiveis = estoqueAtual.filter(t => t.status === 'disponivel');
    const localizacaoMap = {};

    torasDisponiveis.forEach(tora => {
        const loc = tora.localizacao || 'Sem localização';

        if (!localizacaoMap[loc]) {
            localizacaoMap[loc] = {
                quantidade: 0,
                volume: 0,
                volumeGeo: 0,
                valor: 0,
                especies: new Set(),
                totalRodo: 0,
                totalComprimento: 0,
                countRodo: 0,
                countComprimento: 0
            };
        }

        const rodo = parseNumeroEstoque(tora.diametro || tora.rodo);
        const comprimento = parseNumeroEstoque(tora.comprimento);
        const volumeLiquido = parseNumeroEstoque(tora.volumeLiquido);
        const precoCusto = parseNumeroEstoque(tora.precoCusto || tora.preco);

        localizacaoMap[loc].quantidade++;
        localizacaoMap[loc].volume += volumeLiquido;
        localizacaoMap[loc].volumeGeo += normalizarCamposGeoEstoque(tora).volumeGeo || 0;
        localizacaoMap[loc].valor += volumeLiquido * precoCusto;
        localizacaoMap[loc].especies.add(tora.especie || 'Sem espécie');
        if (rodo) {
            localizacaoMap[loc].totalRodo += rodo;
            localizacaoMap[loc].countRodo++;
        }
        if (comprimento) {
            localizacaoMap[loc].totalComprimento += comprimento;
            localizacaoMap[loc].countComprimento++;
        }
    });

    let locaisArr = Object.entries(localizacaoMap).map(([localizacao, dados]) => ({
        localizacao,
        especiesTexto: Array.from(dados.especies).sort((a, b) => String(a).localeCompare(String(b), 'pt-BR')).join(', '),
        quantidade: dados.quantidade,
        volume: dados.volume,
        volumeGeo: dados.volumeGeo,
        mediaRodo: dados.countRodo ? dados.totalRodo / dados.countRodo : 0,
        mediaComprimento: dados.countComprimento ? dados.totalComprimento / dados.countComprimento : 0,
        mediaVolume: dados.quantidade ? dados.volume / dados.quantidade : 0,
        mediaVolumeGeo: dados.quantidade ? dados.volumeGeo / dados.quantidade : 0,
        precoMedio: dados.volume ? dados.valor / dados.volume : 0,
        valor: dados.valor
    }));
    locaisArr = filtrarItensSelecionadosRelatorio('localizacao', locaisArr, item => item.localizacao || 'Sem localização', onlySelected);
    
    if (ordemRelatorio.tipo === 'localizacao' && ordemRelatorio.coluna) {
        ordenarListaRelatorioEstoque('localizacao', locaisArr);
    }

    return `
        ${montarTabelaRelatorioEstoque('localizacao', locaisArr, 'localizacao', item => item.localizacao || 'Sem localização', onlySelected, 'Nenhum registro')}
    `;
}

// Funções auxiliares
function showLoading(message) {
    console.log(`[LOADING] ${message || 'Processando...'}`);
    // Preload overlays visuais removidos para melhorar performance
}

function hideLoading() {
    // Preload overlays visuais removidos
}

// Função duplicada removida


function fecharModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    if (modalId === 'selecaoTorasModal') {
        torasSelecionadasModal = [];
        const checkboxTodas = document.getElementById('selecionarTodas');
        if (checkboxTodas) checkboxTodas.checked = false;
    }
}

// Funções de cálculo (reutilizando do sistema de romaneio)
function calcularVolumeTora(diametro, comprimento) {
    if (!diametro || !comprimento) return 0;

    const diametroMetros = Math.abs(parseFloat(diametro)) / 100;
    const compMetros = Math.abs(parseFloat(comprimento)) / 100;

    // Usar a mesma fórmula do sistema de romaneio
    const volumeBase = Math.PI * Math.pow(diametroMetros/2, 2) * compMetros;
    const fator = 0.07958; // Fator de ajuste calibrado

    return volumeBase * fator;
}

function calcularDescontoOco(oco1, oco2, comprimento) {
    if (!oco1 || !oco2 || !comprimento) return 0;

    const o1Metros = Math.abs(parseFloat(oco1)) / 100;
    const o2Metros = Math.abs(parseFloat(oco2)) / 100;
    const compMetros = Math.abs(parseFloat(comprimento)) / 100;

    return o1Metros * o2Metros * compMetros;
}

// Funções de formatação
function formatCurrency(value) {
    if (value === undefined || value === null) return 'R$ 0,00';
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(value);
    if (isNaN(numValue)) return 'R$ 0,00';
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrencyValue(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;

    const numericValue = value.toString()
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

    return parseFloat(numericValue) || 0;
}

function formatNumber(value, decimals = 3) {
    if (isNaN(value) || value === null || value === undefined) return '0';
    return parseFloat(value).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function generateUniqueId(prefix = '') {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}${timestamp}${random}`;
}

function definirCampoEspecieAtivo(inputId = '') {
    const input = inputId ? document.getElementById(inputId) : null;
    if (input && typeof window.setActiveSpeciesAutocompleteInput === 'function') {
        window.setActiveSpeciesAutocompleteInput(input);
    } else if (input && input.id) {
        window.__activeSpeciesAutocompleteInputId = input.id;
    }
    return input;
}

function abrirNovaEspecie(inputId = '') {
    definirCampoEspecieAtivo(inputId);
    if (window.speciesManagerInstance) {
        window.speciesManagerInstance.openNewSpeciesModal();
    } else {
        console.warn("SpeciesManager não encontrado, tentando carregar via window...");
        // Fallback simples se o manager não estiver pronto
        const nome = prompt("Nome da nova espécie:");
        if (nome) {
             // Lógica simplificada ou alerta
             alert("Por favor, aguarde o carregamento completo do gerenciador de espécies.");
        }
    }
}

async function abrirListaEspeciesEntrada(inputId = '') {
    definirCampoEspecieAtivo(inputId);
    if (typeof window.openSpeciesListModal === 'function') {
        await window.openSpeciesListModal();
        return;
    }
    if (window.speciesManagerInstance && typeof window.speciesManagerInstance.openModal === 'function') {
        await window.speciesManagerInstance.openModal();
        return;
    }
    alert('Lista de espécies ainda não carregada. Aguarde alguns instantes e tente novamente.');
}

// Funções de armazenamento
function resolveCompanyId() {
    try {
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return String(t);
        }
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return String(t);
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return String(window.appTenantId);
        if (window.companyInfo) {
            const raw = window.companyInfo;
            const id = raw.companyId || raw.companyID || raw.tenantId || raw.id;
            if (id) return String(id);
        }
        const stored = localStorage.getItem('company_info');
        if (stored) {
            const obj = JSON.parse(stored);
            const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
            if (id) return String(id);
        }
    } catch (_) {}
    return null;
}

function getLocalStorageKeys(key) {
    const keys = [];
    try {
        const base = String(key || '');
        if (!base) return keys;
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        if (svc && typeof svc.getNamespacedPath === 'function') {
            const ns = svc.getNamespacedPath(base);
            if (ns && ns !== base) {
                keys.push(ns);
                return [...new Set(keys)];
            }
        } else {
            const companyId = resolveCompanyId();
            if (companyId && !/^companies\//.test(base) && !/^users\//.test(base)) {
                keys.push(`companies/${companyId}/${base}`);
                return [...new Set(keys)];
            }
        }
    } catch (_) {}
    return [...new Set(keys)];
}

function readLocalStorageValue(key) {
    for (const k of getLocalStorageKeys(key)) {
        const val = localStorage.getItem(k);
        if (val) return val;
    }
    return null;
}

function writeLocalStorageValue(key, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            window.SiswebStorage.write(key, data);
            return;
        }
    } catch (_) {}
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const k of getLocalStorageKeys(key)) {
        localStorage.setItem(k, payload);
    }
}

async function getData(key) {
    try {
        if (window.firebaseService && window.firebaseService.authService) {
            try {
                const response = await window.firebaseService.loadFromFirebase(key);
                // Extrair dados do wrapper se existir
                const data = response ? (response.data !== undefined ? response.data : response) : null;

                if (data) {
                    if (Array.isArray(data)) return data;
                    if (typeof data === 'object') return Object.values(data);
                    return data;
                }
            } catch (firebaseError) {
                console.warn(`Erro ao carregar ${key} do Firebase:`, firebaseError);
            }
        }

        const data = readLocalStorageValue(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Erro ao recuperar dados de '${key}':`, error);
        return null;
    }
}

async function saveDataAsync(key, data) {
    try {
        writeLocalStorageValue(key, JSON.stringify(data));

        if (window.firebaseService && window.firebaseService.authService) {
            try {
                await window.firebaseService.saveToFirebase(key, null, data);
                console.log(`${key} salvo no Firebase com sucesso`);
            } catch (firebaseError) {
                console.warn(`Erro ao salvar ${key} no Firebase:`, firebaseError);
            }
        }

        return true;
    } catch (error) {
        console.error(`Erro ao salvar dados em '${key}':`, error);
        return false;
    }
}

async function getDataAsync(key) {
    return getData(key);
}

// Expor funções globalmente
window.showTab = showTab;
window.limparFormularioEntrada = limparFormularioEntrada;
window.abrirBaixaPorLote = abrirBaixaPorLote;
window.abrirBaixaIndividual = abrirBaixaIndividual;
window.filtrarTorasDisponiveis = filtrarTorasDisponiveis;
window.selecionarTodasToras = selecionarTodasToras;
window.toggleToraSelecao = toggleToraSelecao;
window.confirmarSelecaoToras = confirmarSelecaoToras;
window.adicionarToraManualSaida = adicionarToraManualSaida;
window.removerToraSaida = removerToraSaida;
window.cancelarSaida = cancelarSaida;
window.buscarToraPorPlaqueta = buscarToraPorPlaqueta;
window.abrirResultadosPlaquetaSaida = abrirResultadosPlaquetaSaida;
window.recolherResultadosPlaquetaSaida = recolherResultadosPlaquetaSaida;
window.agendarRecolherResultadosPlaquetaSaida = agendarRecolherResultadosPlaquetaSaida;
window.adicionarToraBaixaPorPlaqueta = adicionarToraBaixaPorPlaqueta;
window.toggleToraPlaquetaSaida = toggleToraPlaquetaSaida;
window.toggleTodasPlaquetaSaida = toggleTodasPlaquetaSaida;
window.adicionarTorasPlaquetaSelecionadas = adicionarTorasPlaquetaSelecionadas;
window.onSaidaPlaquetaKeydown = onSaidaPlaquetaKeydown;
window.onManualSaidaKeydown = onManualSaidaKeydown;
window.adicionarRomaneioSaidaSelecionado = adicionarRomaneioSaidaSelecionado;
window.removerRomaneioSaidaSelecionado = removerRomaneioSaidaSelecionado;
window.filtrarEstoque = filtrarEstoque;
window.onBuscaEstoqueEnter = onBuscaEstoqueEnter;
window.editarTora = editarTora;
window.excluirTora = excluirTora;
window.filtrarMovimentacoes = filtrarMovimentacoes;
window.gerarRelatorio = gerarRelatorio;
window.imprimirRelatorioEstoque = imprimirRelatorioEstoque;
window.imprimirConsultaEstoque = imprimirConsultaEstoque;
window.imprimirEstoqueProdutos = imprimirEstoqueProdutos;
window.imprimirMovimentacoesEstoque = imprimirMovimentacoesEstoque;
window.abrirRastreabilidadeSaida = abrirRastreabilidadeSaida;
window.abrirRastreabilidadeMovimentacoes = abrirRastreabilidadeMovimentacoes;
window.aplicarFiltrosRastreabilidade = aplicarFiltrosRastreabilidade;
window.limparFiltrosRastreabilidade = limparFiltrosRastreabilidade;
window.fecharRastreabilidadeModal = fecharRastreabilidadeModal;
window.imprimirRastreabilidadeEstoque = imprimirRastreabilidadeEstoque;
window.fecharModal = fecharModal;
window.estornarRemessaBaixa = estornarRemessaBaixa;
window.confirmarEstornoBaixaDetalhado = confirmarEstornoBaixaDetalhado;
window.obterItensPorPaginaTabela = obterItensPorPaginaTabela;
window.atualizarItensPorPaginaTabela = atualizarItensPorPaginaTabela;
window.abrirConfiguracaoColunasRelatorio = abrirConfiguracaoColunasRelatorio;
window.fecharConfiguracaoColunasRelatorio = fecharConfiguracaoColunasRelatorio;
window.salvarConfiguracaoColunasRelatorio = salvarConfiguracaoColunasRelatorio;
window.toggleTodasColunasRelatorio = toggleTodasColunasRelatorio;
window.atualizarEstadoTodasColunasRelatorio = atualizarEstadoTodasColunasRelatorio;

// Novas funções exportadas
window.carregarRomaneiosParaSelect = carregarRomaneiosParaSelect;
window.carregarItensDoRomaneioSelecionado = carregarItensDoRomaneioSelecionado;
window.abrirHistoricoEstoque = abrirHistoricoEstoque;
window.abrirConfiguracaoColunasEntrada = abrirConfiguracaoColunasEntrada;
window.fecharConfiguracaoColunasEntrada = fecharConfiguracaoColunasEntrada;
window.salvarConfiguracaoColunasEntrada = salvarConfiguracaoColunasEntrada;
window.toggleTodasColunasEntrada = toggleTodasColunasEntrada;
window.atualizarEstadoTodasColunasEntrada = atualizarEstadoTodasColunasEntrada;
window.abrirConfiguracaoColunasSaida = abrirConfiguracaoColunasSaida;
window.fecharConfiguracaoColunasSaida = fecharConfiguracaoColunasSaida;
window.salvarConfiguracaoColunasSaida = salvarConfiguracaoColunasSaida;
window.toggleTodasColunasSaida = toggleTodasColunasSaida;
window.atualizarEstadoTodasColunasSaida = atualizarEstadoTodasColunasSaida;
window.adicionarItemEntrada = adicionarItemEntrada;
window.mudarPaginaEntrada = mudarPaginaEntrada;
window.mudarPaginaSaida = mudarPaginaSaida;
window.mudarPaginaEstoque = mudarPaginaEstoque;
window.mudarPaginaMovimentacoes = mudarPaginaMovimentacoes;
window.abrirNovaEspecie = abrirNovaEspecie;
window.abrirListaEspeciesEntrada = abrirListaEspeciesEntrada;
window.removerItemEntrada = removerItemEntrada;
window.limparTabelaEntrada = limparTabelaEntrada;
window.toggleTodosEntrada = toggleTodosEntrada;
window.limparCamposEntrada = limparCamposEntrada;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
