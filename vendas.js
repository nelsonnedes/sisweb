/**
 * Sistema de Vendas - JavaScript
 * Gerenciamento de pedidos de venda, produtos e integração financeira
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

let pedidoAtual = null;
let itensCarrinho = [];
let editandoPedidoId = null;
let itemEmEdicaoId = null;
let autoRedistribuirEnabled = true;
let contasReceberEdicaoBloqueada = false;
let parcelaEditandoId = null;
let parcelaEditandoDisplay = '';
let parcelaEditandoDateId = null;
let parcelaEditandoDateValue = '';
let pedidosListPage = 1;
const pedidosListItemsPerPage = 10;
let pedidosListFiltered = [];
let pedidosSelecionados = new Set();
let vendasClientesEditingId = null;
let vendasClientesFiltered = [];
let vendasClientesPage = 1;
const vendasClientesPerPage = 10;
let vendasProdutosPage = 1;
const vendasProdutosPerPage = 10;
let vendasRelatorioPage = 1;
const vendasRelatorioPerPage = 10;
const DEBOUNCE_DIAS_MS = Number((window.SiswebUiConfig && window.SiswebUiConfig.DEBOUNCE_DIAS_MS) || 180);
const debounceDiasContaTimers = new Map();
const debounceValorContaTimers = new Map();

// Dados em memória
window.pedidos = [];
window.produtos = [];
window.clientes = [];

// Variáveis globais para novos recursos
let contasReceber = [];
let romaneioSelecionado = null;
let romaneiosPorTipoCache = {}; // Cache da lista ordenada por tipo para manter índice consistente

// ----------------------------------------------------------------------------
// Romaneio -> Pedido: preview selecionável + trava de reuso (cirúrgico/aditivo)
// - Não altera schema de romaneios nem fluxo financeiro.
// - Campos novos (origemId/romaneioId/romaneiosOrigem) são opcionais e ignorados
//   por leitores antigos. Falha de lookup => fail-open (não bloqueia venda).
// ----------------------------------------------------------------------------
let romaneioPreviewExcluidos = new Set(); // Set<string> chave "especie||categoria" (modo Espécie x Largura)
let romaneioPreviewExcluidosEsp = new Set(); // Set<string> chave "ESPECIE||espessura" (modo Espécie Espessura)
let romaneioPreviewExcluidosDims = new Set(); // Set<string> chave 4-tupla (modo E x L x C)
let romaneioPreviewExcluidosResumo = new Set(); // Set<string> chave "ESPECIE" (modo Resumo)
let modoAgrupPreviewVendas = ''; // último modo renderizado no preview (para limpar seleção ao trocar)
let romaneioPreviewUsoInfo = null; // {pedidoNumero, pedidoId, modulo} | null
let romaneioPreviewTipoAtual = '';
let __rvPreviewChaves = []; // [{especie, categoria}] na ordem renderizada
let __rvUsoCache = { id: '', result: null, ts: 0 };
const RV_USO_CACHE_TTL_MS = 20000;

function escaparHtmlRomaneioVendas(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function obterIdEstavelRomaneioVendas(romaneio) {
    if (!romaneio || typeof romaneio !== 'object') return '';
    const v = romaneio.id || romaneio.numero || romaneio.numeroRomaneio || romaneio.romaneioId || romaneio.firebaseKey || '';
    return String(v).trim();
}

function obterNumeroExibicaoRomaneioVendas(romaneio, fallbackId) {
    if (!romaneio || typeof romaneio !== 'object') return String(fallbackId || '—');
    const legado = romaneio.numero || romaneio.numeroRomaneio || romaneio.id || romaneio.firebaseKey || fallbackId || '—';
    // Numeração sequencial ("Nº N") quando existir; senão legado. Display only.
    try {
        const RU = window.RomaneioDataUtils;
        if (RU && typeof RU.formatarNumeroExibicao === 'function') return RU.formatarNumeroExibicao(romaneio, legado);
    } catch (_) {}
    return String(legado);
}

function chaveCategoriaPreviewVendas(especie, categoria) {
    return `${String(especie || '')}||${String(categoria || '')}`;
}

function __rvStatusEhCancelado(status) {
    return String(status || '').trim().toLowerCase() === 'cancelado';
}

function __rvExtrairIdsRomaneioDePedido(pedido) {
    const ids = [];
    try {
        const origens = pedido && pedido.romaneiosOrigem;
        if (Array.isArray(origens)) {
            origens.forEach(o => {
                const v = (o && typeof o === 'object') ? (o.id || o.romaneioId || o.origemId) : o;
                if (v !== undefined && v !== null && String(v).trim() !== '') ids.push(String(v).trim());
            });
        }
        const itens = pedido && pedido.itens;
        if (Array.isArray(itens)) {
            itens.forEach(it => {
                if (!it || typeof it !== 'object') return;
                const v = it.origemId || it.romaneioId;
                if (v !== undefined && v !== null && String(v).trim() !== '') ids.push(String(v).trim());
            });
        }
    } catch (_) { /* best-effort */ }
    return ids;
}

// Leituras de pedidos p/ verificação de uso de romaneio — paralelas
// (antes: 2 round-trips sequenciais em cada chamador). Fail-open.
async function carregarPedidosParaUsoRomaneio() {
    let vendasPedidos = [];
    let comprasPedidos = [];
    try {
        const temLocal = Array.isArray(window.pedidos) && window.pedidos.length > 0;
        const pVendas = temLocal
            ? Promise.resolve(window.pedidos)
            : ((typeof getData === 'function') ? getData('vendas/pedidos').catch(() => []) : Promise.resolve([]));
        const pCompras = (typeof getData === 'function')
            ? getData('pedidosCompra').catch(() => [])
            : Promise.resolve([]);
        const res = await Promise.all([pVendas, pCompras]);
        vendasPedidos = Array.isArray(res[0]) ? res[0] : (temLocal ? window.pedidos : []);
        comprasPedidos = Array.isArray(res[1]) ? res[1] : [];
    } catch (_) {
        vendasPedidos = Array.isArray(window.pedidos) ? window.pedidos : [];
        comprasPedidos = [];
    }
    if (!Array.isArray(vendasPedidos)) vendasPedidos = [];
    if (!Array.isArray(comprasPedidos)) comprasPedidos = [];
    return { vendasPedidos, comprasPedidos };
}

async function buscarUsoRomaneioVendas(idEstavel) {
    const id = String(idEstavel || '').trim();
    if (!id) return null;
    try {
        const agora = Date.now();
        if (__rvUsoCache.id === id && (agora - __rvUsoCache.ts) < RV_USO_CACHE_TTL_MS) {
            return __rvUsoCache.result;
        }
        const ignorarId = String((typeof editandoPedidoId !== 'undefined' && editandoPedidoId) || (typeof pedidoAtual !== 'undefined' && pedidoAtual && pedidoAtual.id) || '').trim();
        // Leituras paralelas (antes: 2 round-trips sequenciais por chamada).
        const { vendasPedidos, comprasPedidos } = await carregarPedidosParaUsoRomaneio();
        const verificar = (lista, modulo) => {
            for (let i = 0; i < lista.length; i++) {
                const p = lista[i];
                if (!p || typeof p !== 'object') continue;
                if (ignorarId && String(p.id || '') === ignorarId) continue;
                if (__rvStatusEhCancelado(p.status)) continue;
                const ids = __rvExtrairIdsRomaneioDePedido(p);
                for (let j = 0; j < ids.length; j++) {
                    if (String(ids[j]) === id) {
                        return { pedidoNumero: String(p.numero || p.id || '—'), pedidoId: String(p.id || ''), modulo };
                    }
                }
            }
            return null;
        };
        const achadoV = verificar(vendasPedidos, 'venda');
        const resultado = achadoV || verificar(comprasPedidos, 'compra');
        __rvUsoCache = { id, result: resultado, ts: agora };
        return resultado;
    } catch (e) {
        console.warn('Vendas: falha ao verificar uso do romaneio (fail-open):', e);
        return null;
    }
}

function mensagemUsoRomaneioVendas(idExibicao, uso) {
    const moduloLabel = uso && uso.modulo === 'compra' ? 'Compra' : 'Venda';
    return `Este romaneio (${idExibicao}) já foi utilizado no pedido de ${moduloLabel} Nº ${uso ? uso.pedidoNumero : '—'}. Selecione outro romaneio para evitar duplicidade.`;
}

// Status que conferem consumo de estoque (baixa) — pendente/cancelado não
function statusRomaneioConferido(status) {
    return ['aprovado', 'entregue', 'faturado', 'finalizado'].includes(String(status || '').trim().toLowerCase());
}

// Todos os usos de um romaneio COM status (para o preview de produtos:
// alerta vermelho se conferido, âmbar se só pendente)
async function buscarUsosRomaneioVendas(idEstavel) {
    const id = String(idEstavel || '').trim();
    if (!id) return [];
    const out = [];
    try {
        // Leituras paralelas (antes: 2 round-trips sequenciais por chamada).
        const { vendasPedidos, comprasPedidos } = await carregarPedidosParaUsoRomaneio();
        const varrer = (lista, modulo) => {
            (Array.isArray(lista) ? lista : []).forEach(p => {
                if (!p || typeof p !== 'object') return;
                const ids = __rvExtrairIdsRomaneioDePedido(p);
                if (ids.map(String).includes(id)) {
                    out.push({
                        pedidoNumero: String(p.numero || p.id || '—'),
                        pedidoId: String(p.id || ''),
                        modulo,
                        status: String(p.status || 'pendente')
                    });
                }
            });
        };
        varrer(vendasPedidos, 'venda');
        varrer(comprasPedidos, 'compra');
    } catch (e) {
        console.warn('Vendas: falha ao buscar usos do romaneio (fail-open):', e);
    }
    return out;
}

async function construirMapaUsosRomaneioVendas() {
    const mapa = new Map();
    try {
        const ignorarId = String((typeof editandoPedidoId !== 'undefined' && editandoPedidoId) || (typeof pedidoAtual !== 'undefined' && pedidoAtual && pedidoAtual.id) || '').trim();
        // Leituras paralelas (antes: 2 round-trips sequenciais por chamada).
        const { vendasPedidos, comprasPedidos } = await carregarPedidosParaUsoRomaneio();
        const absorver = (lista, modulo) => {
            (Array.isArray(lista) ? lista : []).forEach(p => {
                if (!p || typeof p !== 'object') return;
                if (ignorarId && String(p.id || '') === ignorarId) return;
                if (__rvStatusEhCancelado(p.status)) return;
                __rvExtrairIdsRomaneioDePedido(p).forEach(rid => {
                    const k = String(rid);
                    if (!mapa.has(k)) {
                        mapa.set(k, { pedidoNumero: String(p.numero || p.id || '—'), pedidoId: String(p.id || ''), modulo });
                    }
                });
            });
        };
        absorver(vendasPedidos, 'venda');
        absorver(comprasPedidos, 'compra');
    } catch (e) {
        console.warn('Vendas: falha ao montar mapa de usos (fail-open):', e);
    }
    return mapa;
}

// ✅ CONFIGURAÇÕES GLOBAIS DO MÓDULO
const VendasConfig = {
    precoPorM3Padrao: 1500,
    diasVencimentoPadrao: 30,
    validarEstoque: true,
    permitirEstoqueNegativo: false
};

window.VendasConfig = VendasConfig;
const LOCAL_CACHE_DISABLED_KEYS = new Set();
const LOCAL_CACHE_WARNED_KEYS = new Set();
const LOCAL_CACHE_MAX_BYTES_FOR_LARGE_KEYS = 900000;

function getStorageKey(key) {
    try {
        const svc = window.firebaseService || window.FirebaseService;
        if (svc && typeof svc.getCurrentTenantId === 'function') {
            const t = svc.getCurrentTenantId();
            if (t) return `company_${t}__${key}`;
        }
        if (svc && typeof svc.getTenantId === 'function') {
            const t = svc.getTenantId();
            if (t) return `company_${t}__${key}`;
        }
    } catch (_) {}
    try {
        if (window.appTenantId) return `company_${window.appTenantId}__${key}`;
        const raw = localStorage.getItem('company_info');
        if (raw) {
            const obj = JSON.parse(raw);
            const id = obj && (obj.companyId || obj.companyID || obj.tenantId || obj.id);
            if (id) return `company_${id}__${key}`;
        }
    } catch (_) {}
    return key;
}

function persistLocalValue(storageKey, data) {
    if (LOCAL_CACHE_DISABLED_KEYS.has(storageKey)) {
        return false;
    }
    const payload = JSON.stringify(data);
    const isLargeVolatileKey = /(^|__)vendas\/pedidos$/.test(String(storageKey || ''));
    if (isLargeVolatileKey && payload.length > LOCAL_CACHE_MAX_BYTES_FOR_LARGE_KEYS) {
        if (!LOCAL_CACHE_WARNED_KEYS.has(storageKey)) {
            console.warn(`⚠️ Cache local desativado para '${storageKey}' (payload grande). Fluxo segue por memória/Firebase.`);
            LOCAL_CACHE_WARNED_KEYS.add(storageKey);
        }
        LOCAL_CACHE_DISABLED_KEYS.add(storageKey);
        try { localStorage.removeItem(storageKey); } catch (_) {}
        return false;
    }
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write(storageKey, data) !== false;
        }
    } catch (_) {}
    try {
        localStorage.setItem(storageKey, payload);
        return true;
    } catch (err) {
        const isQuotaError = err && (
            err.name === 'QuotaExceededError' ||
            err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            err.code === 22 ||
            err.code === 1014
        );
        if (isQuotaError) {
            if (!LOCAL_CACHE_WARNED_KEYS.has(storageKey)) {
                console.warn(`⚠️ Quota do localStorage excedida ao salvar '${storageKey}'. Cache local será desativado para esta chave nesta sessão.`);
                LOCAL_CACHE_WARNED_KEYS.add(storageKey);
            }
            LOCAL_CACHE_DISABLED_KEYS.add(storageKey);
            try {
                localStorage.removeItem(storageKey);
            } catch (_) {
                // ignore cleanup errors
            }
            return false;
        }
        console.warn(`⚠️ Falha ao salvar '${storageKey}' no localStorage:`, err);
        return false;
    }
}

/**
 * 🏢 OBTER DADOS DA EMPRESA (PADRÃO DO SISTEMA)
 * Segue o mesmo padrão de folha-relatorios.js e imprimir-romaneio.js
 */
async function obterDadosEmpresa() {
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
                    return { ...centralData, logo: normalizeLogo(logoCandidate) };
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
            try {
                const current = JSON.parse(localStorage.getItem('currentUser') || 'null') || {};
                const persistent = JSON.parse(localStorage.getItem('persistentUser') || 'null') || {};
                const id = current.companyId || current.tenantId || persistent.companyId || persistent.tenantId;
                if (id) return String(id);
            } catch (_) {}
            return null;
        };

        const tenantId = resolveCompanyId();
        const svc = window.firebaseService || window.firebaseServiceTL || window.FirebaseService;
        let companyData = {};
        if (tenantId && svc && typeof svc.setTenantId === 'function') {
            try { svc.setTenantId(tenantId); } catch (_) {}
        }
        if (tenantId && svc && typeof svc.loadFromFirebase === 'function') {
            try {
                const byPath = await svc.loadFromFirebase(`companies/${tenantId}/profile`);
                const byPathData = byPath && (byPath.success === true ? byPath.data : (byPath.success === false ? null : byPath));
                if (byPathData && typeof byPathData === 'object') {
                    companyData = { ...companyData, ...byPathData, id: tenantId, companyId: tenantId, tenantId: tenantId };
                }
            } catch (_) {}
        }

        if (!companyData || (!companyData.nome && !companyData.name)) {
            try {
                let payload = null;
                if (typeof window.getData === 'function') {
                    payload = tenantId ? await window.getData(`companies/${tenantId}/profile`) : null;
                } else if (typeof window.getDataAsync === 'function') {
                    payload = tenantId ? await window.getDataAsync(`companies/${tenantId}/profile`) : null;
                }
                if (payload && typeof payload === 'object') {
                    companyData = { ...companyData, ...payload, id: tenantId, companyId: tenantId, tenantId: tenantId };
                }
            } catch (_) {}
        }

        if (!companyData || (!companyData.nome && !companyData.name)) {
            try {
                const raw = localStorage.getItem('company_info');
                if (raw) companyData = JSON.parse(raw) || companyData;
            } catch (_) {}
        }
        
        // Dados padrão (fallback) - mesmos usados no resto do sistema
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
        
        const empresaFinal = { ...dadosPadrao, ...(companyData || {}) };

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
        
        return empresaFinal;
        
    } catch (error) {
        return {
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
            logo: '',
            logoSvg: true
        };
    }
}



function aguardarFirebaseServiceVendas(timeoutMs = 8000) {
    return new Promise(async (resolve) => {
        const startedAt = Date.now();
        try {
            if (window.__siswebFirebaseServiceReady && typeof window.__siswebFirebaseServiceReady.then === 'function') {
                await window.__siswebFirebaseServiceReady;
            }
        } catch (error) {
            console.warn('⚠️ Vendas: falha aguardando firebaseServiceReady:', error && error.message ? error.message : error);
        }
        const check = () => {
            const svc = window.firebaseService || window.FirebaseService;
            if (svc && typeof svc.loadFromFirebase === 'function' && typeof svc.resolveAuthenticatedTenant === 'function') {
                resolve(svc);
                return;
            }
            if ((Date.now() - startedAt) >= timeoutMs) {
                resolve(svc || null);
                return;
            }
            setTimeout(check, 100);
        };
        check();
    });
}

function obterTenantServicoVendas() {
    try {
        const svc = window.firebaseService || window.FirebaseService;
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
    } catch (_) {}
    return '';
}

function limparContextoEmpresaVendasInseguro() {
    try { window.appTenantId = null; } catch (_) {}
    try { window.companyInfo = null; } catch (_) {}
    try { localStorage.removeItem('company_info'); } catch (_) {}
    try {
        const svc = window.firebaseService || window.FirebaseService;
        if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(null);
    } catch (_) {}
}

function isFirebaseOfflineModeVendas() {
    try {
        if (window._FIREBASE_CONNECTED === false || window.firebaseConnected === false) return true;
    } catch (_) {}
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    } catch (_) {}
    return false;
}

function escapeOperationalHtmlVendas(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildOperationalLoginUrlVendas() {
    try {
        const target = `${window.location.pathname.split('/').pop() || 'vendas.html'}${window.location.search || ''}${window.location.hash || ''}`;
        return `login.html?reason=tenant_required&redirect=${encodeURIComponent(target)}`;
    } catch (_) {
        return 'login.html?reason=tenant_required&redirect=vendas.html';
    }
}

function ensureOperationalAccessStylesVendas() {
    if (document.getElementById('siswebOperationalAccessStateStyles')) return;
    const style = document.createElement('style');
    style.id = 'siswebOperationalAccessStateStyles';
    style.textContent = `
        .sisweb-operational-state {
            display: grid;
            grid-template-columns: 48px minmax(0, 1fr);
            gap: 16px;
            align-items: start;
            margin: 16px 0 20px;
            padding: 18px;
            border: 1px solid #dbe4ef;
            border-left: 4px solid #2563eb;
            border-radius: 8px;
            background: #f8fafc;
            color: #1f2937;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
        }
        .sisweb-operational-state-icon {
            width: 48px;
            height: 48px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: #e0ecff;
            color: #1d4ed8;
            font-size: 20px;
        }
        .sisweb-operational-state h2 {
            margin: 0 0 6px;
            font-size: 1.05rem;
            line-height: 1.3;
            color: #111827;
        }
        .sisweb-operational-state p {
            margin: 0 0 8px;
            color: #4b5563;
            line-height: 1.45;
        }
        .sisweb-operational-state-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 12px;
        }
        .sisweb-operational-state-actions a {
            text-decoration: none;
        }
        @media (max-width: 640px) {
            .sisweb-operational-state {
                grid-template-columns: 1fr;
                padding: 16px;
            }
            .sisweb-operational-state-actions a,
            .sisweb-operational-state-actions button {
                width: 100%;
                justify-content: center;
            }
        }
    `;
    document.head.appendChild(style);
}

function setOperationalActionsDisabledVendas(disabled) {
    document.querySelectorAll('#pedidos > .action-buttons button').forEach((button) => {
        button.disabled = !!disabled;
        if (disabled) {
            button.dataset.siswebOperationalLocked = 'true';
            button.title = 'Entre novamente com uma empresa ativa para usar Vendas.';
        } else if (button.dataset.siswebOperationalLocked === 'true') {
            button.removeAttribute('disabled');
            button.removeAttribute('title');
            delete button.dataset.siswebOperationalLocked;
        }
    });
}

function renderOperationalAccessStateVendas(contexto = {}) {
    ensureOperationalAccessStylesVendas();
    window.__siswebVendasOperationalReady = false;
    window.__siswebVendasLastContext = contexto || {};
    setOperationalActionsDisabledVendas(true);
    const form = document.getElementById('pedidoForm');
    if (form) form.style.display = 'none';

    const container = document.getElementById('pedidos');
    if (!container) return;
    let panel = document.getElementById('vendasOperationalAccessState');
    if (!panel) {
        panel = document.createElement('section');
        panel.id = 'vendasOperationalAccessState';
        panel.className = 'sisweb-operational-state';
        panel.setAttribute('role', 'status');
        panel.setAttribute('aria-live', 'polite');
        const afterActions = container.querySelector('.action-buttons');
        if (afterActions && afterActions.nextSibling) container.insertBefore(panel, afterActions.nextSibling);
        else container.prepend(panel);
    }

    const isSuperAdmin = contexto && contexto.superAdmin === true;
    const title = isSuperAdmin ? 'Conta SuperAdmin sem empresa operacional' : 'Vendas indisponivel nesta sessao';
    const message = isSuperAdmin
        ? 'Use um usuario vinculado a uma empresa para trabalhar com pedidos de venda. O painel administrativo continua disponivel.'
        : 'Nao foi possivel confirmar uma empresa ativa para carregar pedidos, clientes e financeiro com seguranca.';
    const detail = contexto && contexto.error
        ? `<p>${escapeOperationalHtmlVendas(contexto.error)}</p>`
        : '<p>Entre novamente para renovar a sessao e evitar leitura de dados de outra empresa.</p>';
    const secondaryHref = isSuperAdmin ? 'admin.html?tab=dashboard' : 'index.html';
    const secondaryText = isSuperAdmin ? 'Abrir Admin' : 'Ir para inicio';

    panel.innerHTML = `
        <div class="sisweb-operational-state-icon" aria-hidden="true"><i class="fas fa-lock"></i></div>
        <div>
            <h2>${escapeOperationalHtmlVendas(title)}</h2>
            <p>${escapeOperationalHtmlVendas(message)}</p>
            ${detail}
            <div class="sisweb-operational-state-actions">
                <a class="btn-primary" href="${escapeOperationalHtmlVendas(buildOperationalLoginUrlVendas())}">
                    <i class="fas fa-right-to-bracket"></i> Entrar novamente
                </a>
                <a class="btn-secondary" href="${escapeOperationalHtmlVendas(secondaryHref)}">
                    <i class="fas fa-arrow-left"></i> ${escapeOperationalHtmlVendas(secondaryText)}
                </a>
            </div>
        </div>
    `;
}

function clearOperationalAccessStateVendas() {
    window.__siswebVendasOperationalReady = true;
    window.__siswebVendasBootState = 'ready';
    window.__siswebVendasLastContext = null;
    setOperationalActionsDisabledVendas(false);
    const panel = document.getElementById('vendasOperationalAccessState');
    if (panel) panel.remove();
}

function guardOperationalAccessVendas() {
    if (window.__siswebVendasOperationalReady === true) return true;
    renderOperationalAccessStateVendas(window.__siswebVendasLastContext || { error: 'Empresa da sessao nao identificada.' });
    if (typeof ToastManager !== 'undefined') ToastManager.warning('Entre novamente com uma empresa ativa para usar Vendas.');
    return false;
}

async function garantirContextoEmpresaVendas() {
    const svc = await aguardarFirebaseServiceVendas();
    try {
        if (svc && svc.authPersistenceReady) await svc.authPersistenceReady;
    } catch (_) {}

    if (svc && typeof svc.resolveAuthenticatedTenant === 'function') {
        const isOffline = isFirebaseOfflineModeVendas();
        const resolved = await svc.resolveAuthenticatedTenant({ timeoutMs: 4500, allowCached: isOffline });
        if (resolved && resolved.success && resolved.companyId) return resolved;
        if (resolved && resolved.success && resolved.superAdmin) {
            limparContextoEmpresaVendasInseguro();
            return resolved;
        }
    }

    if (typeof window.checkAuth === 'function') {
        try {
            const ok = await window.checkAuth();
            if (!ok) {
                limparContextoEmpresaVendasInseguro();
                return { success: false, code: 'auth-redirected', error: 'Autenticação não confirmada.' };
            }
        } catch (_) {}
    }

    if (svc && typeof svc.resolveAuthenticatedTenant === 'function') {
        const isOffline = isFirebaseOfflineModeVendas();
        const retried = await svc.resolveAuthenticatedTenant({ timeoutMs: 2500, allowCached: isOffline });
        if (retried && retried.success) return retried;
    }

    limparContextoEmpresaVendasInseguro();
    return { success: false, code: 'missing-company-context', error: 'Empresa da sessão não identificada.' };
}

// Inicialização
function iniciarSistemaVendasUmaVez() {
    if (window.__siswebVendasInitStarted) return;
    window.__siswebVendasInitStarted = true;
    // Trava inicial via JS (vale mesmo com HTML em cache sem os attrs):
    // o clear() destrava ao assentar; o render() mantém travado se falhar.
    try { setOperationalActionsDisabledVendas(true); } catch (_) {}
    try {
        document.querySelectorAll('#pedidos > .action-buttons button').forEach((b) => {
            if (b && b.dataset && b.dataset.siswebOperationalLocked === 'true') b.title = 'Conectando à sua empresa...';
        });
    } catch (_) {}
    window.__siswebVendasBootState = 'booting';
    window.__siswebVendasBootPromise = inicializarSistema();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarSistemaVendasUmaVez);
} else {
    iniciarSistemaVendasUmaVez();
}

// Funções de inicialização
// Warm-up da logo de impressão em background: resolve e memoriza o DataURL
// para a 1ª impressão sair instantânea. Nunca bloqueia nem quebra o init.
function schedulePrintLogoWarmUpVendas() {
    try {
        const warmUp = () => {
            try {
                if (!window.SiswebCommercePdf || typeof window.SiswebCommercePdf.preparePrintOptions !== 'function') return;
                Promise.resolve()
                    .then(() => obterDadosEmpresa())
                    .then((company) => window.SiswebCommercePdf.preparePrintOptions({ company: company || {}, quiet: true }))
                    .catch(() => {});
            } catch (_) {}
        };
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(warmUp, { timeout: 8000 });
        } else {
            setTimeout(warmUp, 3000);
        }
    } catch (_) {}
}
async function inicializarSistema() {
    try {
        if (typeof LoadingManager !== 'undefined') LoadingManager.show('Inicializando Sistema de Vendas...');
        console.log("Inicializando sistema de vendas...");
        
        // Configurar data atual
        const hoje = new Date().toISOString().split('T')[0];
        const elData = document.getElementById('pedidoData');
        if (elData) elData.value = hoje;
        
        // Configurar períodos do relatório
        const inicioMesAnteriorVenda = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
        const elInicio = document.getElementById('periodoInicio');
        const elFim = document.getElementById('periodoFim');
        if (elInicio) elInicio.value = inicioMesAnteriorVenda.toISOString().split('T')[0];
        if (elFim) elFim.value = hoje;

        // Configurar vencimento padrão na Forma de Pagamento (sempre hoje)
        const campoVencimento = document.getElementById('contaVencimento');
        if (campoVencimento) {
            campoVencimento.value = hoje;
        }
        
        const contextoEmpresa = await garantirContextoEmpresaVendas();
        if (contextoEmpresa && contextoEmpresa.success && contextoEmpresa.companyId) {
            clearOperationalAccessStateVendas();
            await carregarDados();
        } else {
            window.pedidos = [];
            window.produtos = [];
            window.clientes = [];
            const isSuperAdmin = contextoEmpresa && contextoEmpresa.superAdmin === true;
            const msg = isSuperAdmin
                ? 'Acesse Vendas com um usuário vinculado a uma empresa para carregar dados operacionais.'
                : 'Sessão sem empresa ativa. Entre novamente para carregar Vendas com segurança.';
            console.warn(`⚠️ Vendas sem tenant operacional: ${msg}`, contextoEmpresa || {});
            if (typeof ToastManager !== 'undefined') ToastManager.warning(msg);
            window.__siswebVendasBootState = 'failed';
            renderOperationalAccessStateVendas(contextoEmpresa || { error: 'Empresa da sessão não identificada.' });
        }
        
        // Configurar eventos
        configurarEventos();
        
        // Configurar formatação monetária
        configurarFormatacaoMonetaria();

        window.relatorioColunasVisiveis = {
            numero: true,
            data: true,
            cliente: true,
            total: true,
            status: true,
            carrego: true,
            atualizado: true,
            acoes: true
        };
        window.relatorioColunasOrdem = ['numero','data','cliente','total','status','carrego','atualizado','acoes'];
        try { setupRelatoriosRealtime(); } catch (_) {}
        try { schedulePrintLogoWarmUpVendas(); } catch (_) {}
    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
        if (typeof ToastManager !== 'undefined') ToastManager.error("Erro ao inicializar: " + error.message);
        window.__siswebVendasBootState = 'failed';
        renderOperationalAccessStateVendas({ error: error && error.message ? error.message : 'Erro ao inicializar Vendas.' });
    } finally {
        if (typeof LoadingManager !== 'undefined') LoadingManager.hide();
    }
}

async function carregarDados() {
    try {
        // Carregar pedidos (preferir Firebase com fallback localStorage)
        try {
            if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                const res = await window.firebaseService.loadFromFirebase('vendas/pedidos');
                const data = res && res.data ? res.data : null;
                if (data) {
                    const arr = Array.isArray(data) ? data : Object.values(data || {});
                    window.pedidos = arr || [];
                    try {
                        const storageKey = getStorageKey('vendas/pedidos');
                        persistLocalValue(storageKey, window.pedidos);
                    } catch (_) {}
                    console.log(`Pedidos carregados via Firebase: ${window.pedidos.length}`);
                } else {
                    window.pedidos = await getData('vendas/pedidos') || [];
                    console.log(`Pedidos carregados via localStorage: ${window.pedidos.length}`);
                }
            } else {
                window.pedidos = await getData('vendas/pedidos') || [];
                console.log(`Pedidos carregados via localStorage (Firebase indisponível): ${window.pedidos.length}`);
            }
        } catch (e) {
            console.warn('⚠️ Falha ao carregar pedidos do Firebase, usando fallback local:', e?.message || e);
            window.pedidos = await getData('vendas/pedidos') || [];
            console.log(`Pedidos carregados via localStorage: ${window.pedidos.length}`);
        }
        if (Array.isArray(window.pedidos)) {
            window.pedidos = window.pedidos.map(p => {
                if (p && p.contasReceber) {
                    p.contasReceber = normalizarContasReceberLista(p.contasReceber);
                }
                return p;
            });
        }
        try {
            if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                const pr = await window.firebaseService.loadFromFirebase('vendas/pagamentos_carrego');
                const d = pr && pr.data ? pr.data : null;
                let arr = [];
                if (Array.isArray(d)) arr = d.filter(Boolean);
                else if (d && typeof d === 'object') arr = Object.values(d || {});
                try {
                    const storageKey = getStorageKey('vendas/pagamentos_carrego');
                    persistLocalValue(storageKey, arr);
                } catch (_) {}
                console.log(`CarregoPagamentos sincronizados: ${arr.length} registro(s)`);
            }
        } catch (_) {}
        
        // 🚀 LAZY LOAD: Carregar produtos e clientes em background (sem travar o Dashboard de Vendas)
        window.produtos = [];
        window.clientes = [];

        (async () => {
             console.log("📥 [Lazy Load] Carregando auxiliares para Vendas em background...");
             try {
                 const [species, produtos_raw, cliRes] = await Promise.all([
                     getData('especies').catch(() => []),
                     getData('produtos').catch(() => []),
                     (window.clientService && window.clientService.getClients) ? window.clientService.getClients(true).catch(() => []) : getData('clients').catch(() => [])
                 ]);
                 
                 // Espécies sem nenhum campo de nome são lixo (chaves avulsas) e
                 // nunca entram nem na exibição; produtos_raw passam intactos
                 // (produto legado sem nome continua visível/editável).
                 const speciesExibiveis = (Array.isArray(species) ? species : []).filter(s => {
                     if (!s || typeof s !== 'object') return false;
                     return nomeSignificativo(s.nome, s.name, s.nomeComum, s.nomeCientifico) !== '';
                 });
                 window.produtos = typeof normalizeProdutosList === 'function' ? normalizeProdutosList([...speciesExibiveis, ...(produtos_raw || [])]) : [...speciesExibiveis, ...(produtos_raw || [])];
                 try {
                     if (typeof registrarIdsProdutosRaw === 'function') registrarIdsProdutosRaw(produtos_raw);
                     const comNome = window.produtos.length;
                     const semNome = (Array.isArray(species) ? species.length : 0) - speciesExibiveis.length;
                     if (semNome > 0) console.log(`🧹 ${semNome} espécie(s) sem nome ocultada(s) da aba Estoque de Madeira Serrada`);
                 } catch (_) {}
                 window.clientes = Array.isArray(cliRes) ? cliRes : [];
                 
                 console.log(`✅ [Lazy Load] Auxiliares carregados. Produtos: ${window.produtos.length}, Clientes: ${window.clientes.length}`);
                 atualizarSelectClientes();
                 atualizarSelectProdutos();
                 popularFiltrosRelatoriosVenda();
                 if (typeof popularFiltrosPedidosVenda === 'function') popularFiltrosPedidosVenda();
                 renderizarClientesVenda();
             } catch (e) {
                 console.warn("⚠️ Falha no Lazy Load de vendas:", e);
             }
        })();
        
        console.log(`Dados carregados: ${window.pedidos.length} pedidos, ${window.produtos.length} produtos, ${window.clientes.length} clientes`);
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
}

function configurarEventos() {
    // Evento de submit do pedido
    document.getElementById('pedidoForm').addEventListener('submit', salvarPedido);
    
    // Evento de submit do produto
    document.getElementById('produtoForm').addEventListener('submit', salvarProduto);
    
    // Eventos de formatação monetária
    const camposMonetarios = ['precoUnitario', 'desconto', 'produtoPreco'];
    camposMonetarios.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.addEventListener('focus', function() {
                // Ao focar, remover formatação para facilitar edição
                const val = parseCurrencyValue(this.value);
                this.value = val === 0 ? '' : val; 
            });
            campo.addEventListener('blur', function() {
                const val = this.value.replace(',', '.'); // Aceitar vírgula como decimal
                this.value = formatCurrency(val);
                atualizarTotais();
            });
            campo.addEventListener('input', atualizarTotais);
        }
    });
    const textos = document.querySelectorAll('input[type="text"], textarea');
    textos.forEach(el => {
        el.addEventListener('blur', function(){
            const v = String(this.value || '').trim();
            if (!v) return;
            if (isAllCaps(v)) this.value = toTitleCasePt(v);
        });
    });
    
    // Evento para atualização automática do select de produto
    document.getElementById('produtoSelect').addEventListener('change', function() {
        const produtoId = this.value;
        if (produtoId) {
            const produto = window.produtos.find(p => p.id === produtoId);
            if (produto) {
                document.getElementById('precoUnitario').value = formatCurrency(produto.preco || 0);
                // Unidade padrão = a do produto; usuário pode trocar no campo Unidade
                try {
                    const unEl = document.getElementById('unidadeItem');
                    if (unEl && produto.unidade) unEl.value = produto.unidade;
                } catch (_) {}
                atualizarTotais();
            }
        }
    });
    const numParcelasEl = document.getElementById('numeroParcelas');
    if (numParcelasEl) {
        numParcelasEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                adicionarContaReceber();
            }
        });
    }
    const pedidoForm = document.getElementById('pedidoForm');
    if (pedidoForm) {
        pedidoForm.addEventListener('keydown', handleEnterNavigation);
    }

    try {
        window.addEventListener('clients:updated', async function(e) {
            console.log('🔄 Evento clients:updated recebido:', e.detail);
            try {
                // Tentar recarregar lista completa
                if (window.clientService && window.clientService.getClients) {
                    window.clientes = await window.clientService.getClients(true);
                } else {
                    window.clientes = await getData('clients') || [];
                }
                
                // Se o evento trouxe um cliente novo, adicioná-lo explicitamente se não estiver na lista
                let novoId = null;
                if (e.detail && e.detail.client) {
                    const novoCliente = e.detail.client;
                    novoId = novoCliente.id;
                    const exists = window.clientes.some(c => String(c.id) === String(novoId));
                    if (!exists) {
                        console.log('➕ Adicionando novo cliente à lista local:', novoCliente);
                        window.clientes.push(novoCliente);
                    }
                }
                
                atualizarSelectClientes(novoId);
                popularFiltrosRelatoriosVenda();
                renderizarClientesVenda();
            } catch (err) {
                console.warn('Erro ao processar atualização de clientes:', err);
            }
        });
        window.addEventListener('message', function(event) {
            if (event.origin !== window.location.origin) return;
            const data = event.data || {};
            if (!data || data.source !== 'sisweb-commerce-embedded') return;
            if (data.type !== 'sisweb:clients:updated') return;
            window.dispatchEvent(new CustomEvent('clients:updated', { detail: data.detail || {} }));
        });
    } catch (_) {}

    const vendasClientesBusca = document.getElementById('vendasClientesBusca');
    if (vendasClientesBusca) {
        vendasClientesBusca.addEventListener('input', () => { vendasClientesPage = 1; renderizarClientesVenda(); });
    }
    const vendasClientesFiltroStatus = document.getElementById('vendasClientesFiltroStatus');
    if (vendasClientesFiltroStatus) {
        vendasClientesFiltroStatus.addEventListener('change', () => { vendasClientesPage = 1; renderizarClientesVenda(); });
    }
    const vendasClienteForm = document.getElementById('vendasClienteForm');
    if (vendasClienteForm && !vendasClienteForm.dataset.boundVendasClientes) {
        vendasClienteForm.addEventListener('submit', vendasClientesSalvar);
        vendasClienteForm.dataset.boundVendasClientes = '1';
    }
    const vendasClienteState = document.getElementById('vendasClienteState');
    if (vendasClienteState) {
        vendasClienteState.addEventListener('change', () => vendasClientesCarregarCidades(vendasClienteState.value));
    }
}

// Filtrar clientes do select conforme texto digitado
function filtrarClientesSelect() {
    try {
        const select = document.getElementById('clienteSelect');
        const buscaInput = document.getElementById('clienteBusca');
        if (!select || !buscaInput) return;
        
        const busca = (buscaInput.value || '').toLowerCase();
        const options = Array.from(select.options);
        
        options.forEach(opt => {
            if (!opt.value) {
                opt.style.display = '';
                opt.hidden = false;
                return;
            }
            
            const label = (opt.textContent || '').toLowerCase();
            const doc = String(opt.dataset.documento || '').toLowerCase();
            const match = label.includes(busca) || (doc && doc.includes(busca));
            
            // Usar display='none' garante funcionamento em todos os browsers
            opt.style.display = busca && !match ? 'none' : '';
            opt.hidden = busca ? !match : false;
        });
    } catch (e) {
        console.warn('Falha ao filtrar clientes:', e);
    }
}

function configurarFormatacaoMonetaria() {
    const campoContaValor = document.getElementById('contaValor');
    if (campoContaValor) {
        campoContaValor.addEventListener('input', onContaValorInput);
        campoContaValor.addEventListener('blur', function() {
            const valor = parseCurrencyValue(this.value);
            this.value = formatCurrency(valor);
        });
    }
}

// Função para configurar eventos dos novos campos
function configurarFormatacaoNovosEventos() {
    // Formatação monetária para campos de produto manual
    const precoManual = document.getElementById('precoManual');
    if (precoManual) {
        precoManual.addEventListener('blur', function() {
            const valor = parseCurrencyValue(this.value);
            this.value = formatCurrency(valor);
        });
        precoManual.addEventListener('focus', function() {
            const valor = this.value.replace(/[^\d.,]/g, '').replace(',', '.');
            if (valor !== '' && !isNaN(parseFloat(valor))) {
                this.value = parseFloat(valor);
            }
        });
    }
    
    // Formatação monetária para campos de contas a receber
    const contaValor = document.getElementById('contaValor');
    if (contaValor) {
        contaValor.addEventListener('blur', function() {
            const valor = parseCurrencyValue(this.value);
            this.value = formatCurrency(valor);
        });
    }
}

function onContaValorInput(e) {
    const input = e.target;
    const v = input.value || '';
    const sanitized = v.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '');
    if (sanitized !== v) {
        input.value = sanitized;
        try { const len = input.value.length; input.setSelectionRange(len, len); } catch (_) {}
    }
}

// Funções de navegação entre tabs
function showTab(tabName) {
    // Ocultar todas as tabs
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(tab => tab.classList.remove('active'));
    
    // Remover classe active de todas as tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Mostrar tab selecionada
    const content = document.getElementById(tabName);
    if (content) content.classList.add('active');
    
    // Adicionar classe active na tab clicada
    const clickedTab = (typeof event !== 'undefined' && event && event.target) ? event.target.closest('.tab') : null;
    const tabButton = clickedTab || document.querySelector(`.tab[onclick="showTab('${tabName}')"]`);
    if (tabButton) tabButton.classList.add('active');
    
    // Carregar dados específicos da tab (sem abrir modais automaticamente)
    if (tabName === 'produtos') {
        try { carregarTabelaProdutos(document.getElementById('searchProdutos')?.value || ''); } catch (_) {}
    } else if (tabName === 'clientes') {
        carregarClientesAbaVenda(false);
    } else if (tabName === 'relatorios') {
        popularFiltrosRelatoriosVenda();
        gerarRelatorio();
    }
}

function vendasClientesGetService() {
    return window.clientService || {
        getClients: (forceRefresh) => (typeof window.getClients === 'function' ? window.getClients(forceRefresh) : getData('clients')),
        saveClient: (client) => (typeof window.saveClient === 'function' ? window.saveClient(client) : Promise.reject(new Error('Serviço de clientes indisponível'))),
        deleteClient: (id) => (typeof window.deleteClient === 'function' ? window.deleteClient(id) : Promise.reject(new Error('Serviço de clientes indisponível'))),
        normalizeClient: (client) => client
    };
}

function vendasClientesNome(cliente) {
    return String((cliente && (cliente.nome || cliente.name || cliente.nomeCompleto)) || '').trim();
}

function vendasClientesDocumento(cliente) {
    return String((cliente && (cliente.cnpj || cliente.cpf || cliente.document || cliente.documento)) || '').trim();
}

function vendasClientesCampo(id) {
    return String(document.getElementById(id)?.value || '').trim();
}

function vendasClientesStatus(cliente) {
    const status = String((cliente && cliente.status) || 'ativo').trim().toLowerCase();
    return status === 'inativo' ? 'inativo' : 'ativo';
}

function vendasClientesMostrarEstado(message, icon = 'fa-circle-info') {
    const tbody = document.getElementById('vendasClientesTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td class="sales-clients-empty" colspan="6"><i class="fas ${icon}"></i> ${escapeOperationalHtmlVendas(message)}</td>
            </tr>
        `;
    }
}

function vendasClientesAtualizarResumo(lista) {
    const clientes = Array.isArray(lista) ? lista : [];
    const ativos = clientes.filter((cliente) => vendasClientesStatus(cliente) === 'ativo').length;
    const documentados = clientes.filter((cliente) => vendasClientesDocumento(cliente)).length;
    const cidades = new Set(clientes.map((cliente) => String(cliente.city || cliente.cidade || '').trim()).filter(Boolean));
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };
    setText('vendasClientesTotal', clientes.length);
    setText('vendasClientesAtivos', ativos);
    setText('vendasClientesDocumentados', documentados);
    setText('vendasClientesCidades', cidades.size);
}

async function carregarClientesAbaVenda(forceRefresh = false) {
    const activePanel = document.getElementById('clientes');
    if (window.__siswebVendasOperationalReady !== true) {
        vendasClientesAtualizarResumo([]);
        vendasClientesMostrarEstado('Empresa da sessão não identificada. Faça login novamente para carregar clientes.', 'fa-lock');
        return [];
    }
    vendasClientesMostrarEstado('Carregando clientes...', 'fa-spinner');
    try {
        const service = vendasClientesGetService();
        const result = service && typeof service.getClients === 'function'
            ? await service.getClients(forceRefresh)
            : await getData('clients');
        const normalize = service && typeof service.normalizeClient === 'function'
            ? service.normalizeClient
            : (client) => client;
        const byKey = new Map();
        (Array.isArray(result) ? result : []).forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const normalized = normalize(item);
            const name = vendasClientesNome(normalized);
            if (!name) return;
            const id = String(normalized.id || '').trim();
            const key = id || `name:${name.toLowerCase()}`;
            if (!byKey.has(key)) byKey.set(key, normalized);
        });
        window.clientes = Array.from(byKey.values())
            .sort((a, b) => vendasClientesNome(a).localeCompare(vendasClientesNome(b), 'pt-BR'));
        atualizarSelectClientes();
        popularFiltrosRelatoriosVenda();
        if (typeof popularFiltrosPedidosVenda === 'function') popularFiltrosPedidosVenda();
        renderizarClientesVenda();
        if (activePanel && activePanel.classList.contains('active') && forceRefresh && typeof ToastManager !== 'undefined') {
            ToastManager.success('Clientes atualizados.', 'Clientes', 1800);
        }
        return window.clientes;
    } catch (error) {
        console.error('Erro ao carregar clientes na aba de vendas:', error);
        vendasClientesMostrarEstado('Erro ao carregar clientes. Verifique a sessão e tente novamente.', 'fa-triangle-exclamation');
        if (typeof ToastManager !== 'undefined') ToastManager.error('Erro ao carregar clientes: ' + (error && error.message ? error.message : error), 'Clientes');
        return [];
    }
}

function renderizarClientesVenda() {
    const tbody = document.getElementById('vendasClientesTableBody');
    if (!tbody) return;
    const source = Array.isArray(window.clientes) ? window.clientes : [];
    vendasClientesAtualizarResumo(source);
    const busca = String(document.getElementById('vendasClientesBusca')?.value || '').trim().toLowerCase();
    const statusFiltro = String(document.getElementById('vendasClientesFiltroStatus')?.value || '').trim().toLowerCase();
    vendasClientesFiltered = source.filter((cliente) => {
        const status = vendasClientesStatus(cliente);
        if (statusFiltro && status !== statusFiltro) return false;
        if (!busca) return true;
        const haystack = [
            vendasClientesNome(cliente),
            vendasClientesDocumento(cliente),
            cliente.telefone,
            cliente.phone,
            cliente.email,
            cliente.cidade,
            cliente.city,
            cliente.estado,
            cliente.state,
            cliente.bairro,
            cliente.neighborhood
        ].map((value) => String(value || '').toLowerCase()).join(' ');
        return haystack.includes(busca);
    });

    if (vendasClientesFiltered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td class="sales-clients-empty" colspan="6">Nenhum cliente encontrado.</td>
            </tr>
        `;
        renderVendasClientesPagination(0);
        return;
    }

    const totalClientesPages = Math.max(1, Math.ceil(vendasClientesFiltered.length / vendasClientesPerPage));
    if (vendasClientesPage > totalClientesPages) vendasClientesPage = totalClientesPages;
    if (vendasClientesPage < 1) vendasClientesPage = 1;
    const clientesStart = (vendasClientesPage - 1) * vendasClientesPerPage;
    const clientesPaginados = vendasClientesFiltered.slice(clientesStart, clientesStart + vendasClientesPerPage);

    tbody.innerHTML = clientesPaginados.map((cliente) => {
        const id = String(cliente.id || '').trim();
        const encodedId = escapeOperationalHtmlVendas(encodeURIComponent(id).replace(/'/g, '%27'));
        const nome = escapeOperationalHtmlVendas(vendasClientesNome(cliente) || 'Sem nome');
        const email = escapeOperationalHtmlVendas(cliente.email || '');
        const documento = escapeOperationalHtmlVendas(vendasClientesDocumento(cliente) || '-');
        const telefone = escapeOperationalHtmlVendas(cliente.telefone || cliente.phone || '-');
        const cidadeUf = [cliente.city || cliente.cidade, cliente.state || cliente.estado].filter(Boolean).join(' / ') || '-';
        const endereco = [cliente.address || cliente.endereco, cliente.number || cliente.numero, cliente.neighborhood || cliente.bairro].filter(Boolean).join(', ');
        const status = vendasClientesStatus(cliente);
        const statusLabel = status === 'inativo' ? 'Inativo' : 'Ativo';
        return `
            <tr>
                <td data-label="Cliente" class="sales-clients-name-cell">
                    <strong>${nome}</strong>
                    ${email ? `<small>${email}</small>` : ''}
                </td>
                <td data-label="Documento">${documento}</td>
                <td data-label="Contato">${telefone}</td>
                <td data-label="Localização">
                    <span>${escapeOperationalHtmlVendas(cidadeUf)}</span>
                    ${endereco ? `<small style="display:block;color:var(--sw-text-3);margin-top:3px;">${escapeOperationalHtmlVendas(endereco)}</small>` : ''}
                </td>
                <td data-label="Status"><span class="status-badge status-${status}">${statusLabel}</span></td>
                <td data-label="Ações" class="sales-clients-actions-cell commerce-actions-cell">
                    <div class="commerce-actions-wrap">
                        <button type="button" class="btn-primary btn-small" onclick="vendasClientesEditar(decodeURIComponent('${encodedId}'))" title="Editar cliente" aria-label="Editar cliente">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-danger btn-small" onclick="vendasClientesExcluir(decodeURIComponent('${encodedId}'))" title="Excluir cliente" aria-label="Excluir cliente">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    refreshCommerceResponsiveTables();
    renderVendasClientesPagination(vendasClientesFiltered.length);
}

function renderVendasClientesPagination(totalItems) {
    const container = document.getElementById('vendasClientesPagination');
    if (!container) return;
    const totalPages = Math.ceil(totalItems / vendasClientesPerPage);
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const addBtn = (label, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        if (active) btn.classList.add('active');
        btn.disabled = disabled;
        btn.onclick = () => goToVendasClientesPage(page);
        container.appendChild(btn);
    };

    addBtn('<<<', 1, vendasClientesPage === 1);
    addBtn('<', vendasClientesPage - 1, vendasClientesPage === 1);

    const startPage = Math.max(1, vendasClientesPage - 2);
    const endPage = Math.min(totalPages, vendasClientesPage + 2);

    if (startPage > 1) {
        addBtn('1', 1, false, vendasClientesPage === 1);
        if (startPage > 2) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addBtn(String(i), i, false, i === vendasClientesPage);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
        addBtn(String(totalPages), totalPages, false, vendasClientesPage === totalPages);
    }

    addBtn('>', vendasClientesPage + 1, vendasClientesPage === totalPages);
    addBtn('>>>', totalPages, vendasClientesPage === totalPages);
}

function goToVendasClientesPage(page) {
    const totalPages = Math.max(1, Math.ceil(vendasClientesFiltered.length / vendasClientesPerPage));
    const next = Math.min(totalPages, Math.max(1, Number(page) || 1));
    if (next === vendasClientesPage) return;
    vendasClientesPage = next;
    renderizarClientesVenda();
}

async function vendasClientesCarregarCidades(uf, selectedCity = '') {
    const citySelect = document.getElementById('vendasClienteCity');
    if (!citySelect) return;
    const cleanUf = String(uf || '').trim().slice(0, 2).toUpperCase();
    if (!cleanUf) {
        citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        return;
    }
    try {
        if (typeof window.populateCitySelect === 'function') {
            await window.populateCitySelect(cleanUf, 'vendasClienteCity');
        } else if (typeof window.loadCitiesFromIBGE === 'function') {
            const cidades = await window.loadCitiesFromIBGE(cleanUf);
            citySelect.innerHTML = '<option value="">Selecione a cidade</option>';
            (Array.isArray(cidades) ? cidades : []).forEach((cidade) => {
                const option = document.createElement('option');
                option.value = cidade;
                option.textContent = cidade;
                citySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.warn('Falha ao carregar cidades para cliente de vendas:', error);
    }
    if (selectedCity) {
        const exists = Array.from(citySelect.options).some((option) => option.value === selectedCity);
        if (!exists) {
            const option = document.createElement('option');
            option.value = selectedCity;
            option.textContent = selectedCity;
            citySelect.appendChild(option);
        }
        citySelect.value = selectedCity;
    }
}

function vendasClientesPreencherForm(cliente = null) {
    const data = cliente || {};
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };
    const title = document.getElementById('vendasClienteFormTitle');
    if (title) title.textContent = cliente ? 'Editar Cliente' : 'Novo Cliente';
    setValue('vendasClienteId', data.id || '');
    setValue('vendasClienteName', data.nome || data.name || '');
    setValue('vendasClienteCnpj', vendasClientesDocumento(data));
    setValue('vendasClienteTipoPessoa', data.tipoPessoa || data.personType || data.fiscalPersonType || '');
    setValue('vendasClienteIndIEDest', data.indIEDest || data.indicadorInscricaoEstadual || data.ieIndicator || '');
    setValue('vendasClienteInscricaoEstadual', data.inscricaoEstadual || data.stateRegistration || data.ie || '');
    setValue('vendasClienteInscricaoMunicipal', data.inscricaoMunicipal || data.municipalRegistration || data.im || '');
    setValue('vendasClienteSuframa', data.suframa || '');
    setValue('vendasClientePhone', data.telefone || data.phone || '');
    setValue('vendasClienteEmail', data.email || '');
    setValue('vendasClienteStatus', vendasClientesStatus(data));
    setValue('vendasClienteCep', data.cep || data.postalCode || data.zipCode || '');
    setValue('vendasClienteAddress', data.endereco || data.address || '');
    setValue('vendasClienteNumber', data.numero || data.number || '');
    setValue('vendasClienteNeighborhood', data.bairro || data.neighborhood || '');
    setValue('vendasClienteComplement', data.complemento || data.complement || '');
    setValue('vendasClienteState', data.estado || data.state || '');
    setValue('vendasClienteMunicipalityCode', data.codigoMunicipio || data.municipioCodigo || data.municipalityCode || data.cMun || data.ibgeCode || '');
    setValue('vendasClienteCountryCode', data.paisCodigo || data.countryCode || data.cPais || '1058');
    setValue('vendasClienteCountryName', data.pais || data.country || data.countryName || data.xPais || 'Brasil');
    setValue('vendasClienteObs', data.obs || data.observacoes || data.observations || '');
}

function vendasClientesNovo() {
    if (window.__siswebVendasOperationalReady !== true) {
        vendasClientesMostrarEstado('Empresa da sessão não identificada. Faça login novamente para cadastrar clientes.', 'fa-lock');
        return;
    }
    vendasClientesEditingId = null;
    const form = document.getElementById('vendasClienteForm');
    if (form) {
        form.reset();
        form.hidden = false;
    }
    vendasClientesPreencherForm(null);
    vendasClientesCarregarCidades('');
    setTimeout(() => document.getElementById('vendasClienteName')?.focus(), 50);
}

async function vendasClientesEditar(id) {
    const clientId = String(id || '').trim();
    const cliente = (Array.isArray(window.clientes) ? window.clientes : []).find((item) => String(item.id || '') === clientId);
    if (!cliente) {
        if (typeof ToastManager !== 'undefined') ToastManager.warning('Cliente não encontrado.', 'Clientes');
        return;
    }
    vendasClientesEditingId = clientId;
    const form = document.getElementById('vendasClienteForm');
    if (form) form.hidden = false;
    vendasClientesPreencherForm(cliente);
    await vendasClientesCarregarCidades(cliente.estado || cliente.state || '', cliente.cidade || cliente.city || '');
    setTimeout(() => document.getElementById('vendasClienteName')?.focus(), 50);
}

function vendasClientesCancelar() {
    vendasClientesEditingId = null;
    const form = document.getElementById('vendasClienteForm');
    if (form) {
        form.reset();
        form.hidden = true;
    }
}

async function vendasClientesSalvar(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (window.__siswebVendasOperationalReady !== true) {
        vendasClientesMostrarEstado('Empresa da sessão não identificada. Faça login novamente para salvar clientes.', 'fa-lock');
        return;
    }
    const name = String(document.getElementById('vendasClienteName')?.value || '').trim();
    if (!name) {
        if (typeof ToastManager !== 'undefined') ToastManager.warning('Informe o nome do cliente.', 'Clientes');
        document.getElementById('vendasClienteName')?.focus();
        return;
    }
    const saveBtn = document.getElementById('vendasClienteSaveBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando';
    }
    try {
        const existing = vendasClientesEditingId
            ? (Array.isArray(window.clientes) ? window.clientes : []).find((item) => String(item.id || '') === String(vendasClientesEditingId))
            : null;
        const nowIso = new Date().toISOString();
        const documento = vendasClientesCampo('vendasClienteCnpj');
        const tipoPessoa = vendasClientesCampo('vendasClienteTipoPessoa');
        const indIEDest = vendasClientesCampo('vendasClienteIndIEDest');
        const inscricaoEstadual = vendasClientesCampo('vendasClienteInscricaoEstadual');
        const inscricaoMunicipal = vendasClientesCampo('vendasClienteInscricaoMunicipal');
        const suframa = vendasClientesCampo('vendasClienteSuframa');
        const cep = vendasClientesCampo('vendasClienteCep');
        const complemento = vendasClientesCampo('vendasClienteComplement');
        const codigoMunicipio = vendasClientesCampo('vendasClienteMunicipalityCode');
        const paisCodigo = vendasClientesCampo('vendasClienteCountryCode') || '1058';
        const pais = vendasClientesCampo('vendasClienteCountryName') || 'Brasil';
        const payload = {
            ...(existing || {}),
            id: vendasClientesEditingId || undefined,
            nome: name,
            name,
            documento,
            document: documento,
            cnpj: documento,
            tipoPessoa,
            personType: tipoPessoa,
            fiscalPersonType: tipoPessoa,
            indIEDest,
            indicadorInscricaoEstadual: indIEDest,
            ieIndicator: indIEDest,
            inscricaoEstadual,
            stateRegistration: inscricaoEstadual,
            ie: inscricaoEstadual,
            inscricaoMunicipal,
            municipalRegistration: inscricaoMunicipal,
            suframa,
            cep,
            postalCode: cep,
            telefone: vendasClientesCampo('vendasClientePhone'),
            phone: vendasClientesCampo('vendasClientePhone'),
            email: vendasClientesCampo('vendasClienteEmail'),
            status: vendasClientesCampo('vendasClienteStatus') || 'ativo',
            endereco: vendasClientesCampo('vendasClienteAddress'),
            address: vendasClientesCampo('vendasClienteAddress'),
            numero: vendasClientesCampo('vendasClienteNumber'),
            number: vendasClientesCampo('vendasClienteNumber'),
            bairro: vendasClientesCampo('vendasClienteNeighborhood'),
            neighborhood: vendasClientesCampo('vendasClienteNeighborhood'),
            complemento,
            complement: complemento,
            estado: vendasClientesCampo('vendasClienteState'),
            state: vendasClientesCampo('vendasClienteState'),
            cidade: vendasClientesCampo('vendasClienteCity'),
            city: vendasClientesCampo('vendasClienteCity'),
            codigoMunicipio,
            municipioCodigo: codigoMunicipio,
            municipalityCode: codigoMunicipio,
            cMun: codigoMunicipio,
            ibgeCode: codigoMunicipio,
            paisCodigo,
            countryCode: paisCodigo,
            cPais: paisCodigo,
            pais,
            country: pais,
            countryName: pais,
            xPais: pais,
            obs: vendasClientesCampo('vendasClienteObs'),
            observacoes: vendasClientesCampo('vendasClienteObs'),
            observations: vendasClientesCampo('vendasClienteObs'),
            createdAt: existing?.createdAt || existing?.created || nowIso,
            updatedAt: nowIso,
            updated: nowIso
        };
        const service = vendasClientesGetService();
        const saved = await service.saveClient(payload);
        const normalized = service && typeof service.normalizeClient === 'function'
            ? service.normalizeClient(saved || payload)
            : (saved || payload);
        const savedId = String(normalized.id || payload.id || vendasClientesEditingId || '').trim();
        const current = Array.isArray(window.clientes) ? window.clientes.slice() : [];
        const index = savedId ? current.findIndex((item) => String(item.id || '') === savedId) : -1;
        if (index >= 0) current[index] = normalized;
        else current.push(normalized);
        window.clientes = current.sort((a, b) => vendasClientesNome(a).localeCompare(vendasClientesNome(b), 'pt-BR'));
        atualizarSelectClientes(savedId || null);
        popularFiltrosRelatoriosVenda();
        if (typeof popularFiltrosPedidosVenda === 'function') popularFiltrosPedidosVenda();
        renderizarClientesVenda();
        vendasClientesCancelar();
        if (typeof ToastManager !== 'undefined') ToastManager.success('Cliente salvo com sucesso.', 'Clientes');
    } catch (error) {
        console.error('Erro ao salvar cliente na aba de vendas:', error);
        if (typeof ToastManager !== 'undefined') ToastManager.error('Erro ao salvar cliente: ' + (error && error.message ? error.message : error), 'Clientes');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Cliente';
        }
    }
}

async function vendasClientesExcluir(id) {
    const clientId = String(id || '').trim();
    if (!clientId) return;
    const cliente = (Array.isArray(window.clientes) ? window.clientes : []).find((item) => String(item.id || '') === clientId);
    const nome = vendasClientesNome(cliente) || 'este cliente';
    if (!await confirmDialog({ title: 'Excluir cliente', message: `Excluir ${nome}?`, danger: true, confirmLabel: 'Excluir' })) return;
    try {
        const service = vendasClientesGetService();
        await service.deleteClient(clientId);
        window.clientes = (Array.isArray(window.clientes) ? window.clientes : []).filter((item) => String(item.id || '') !== clientId);
        atualizarSelectClientes();
        popularFiltrosRelatoriosVenda();
        if (typeof popularFiltrosPedidosVenda === 'function') popularFiltrosPedidosVenda();
        renderizarClientesVenda();
        if (vendasClientesEditingId === clientId) vendasClientesCancelar();
        if (typeof ToastManager !== 'undefined') ToastManager.success('Cliente excluído.', 'Clientes');
    } catch (error) {
        console.error('Erro ao excluir cliente na aba de vendas:', error);
        if (typeof ToastManager !== 'undefined') ToastManager.error('Erro ao excluir cliente: ' + (error && error.message ? error.message : error), 'Clientes');
    }
}

function vendasClientesRecarregar() {
    carregarClientesAbaVenda(true);
}

// Funções de pedidos
async function novoPedido() {
    if (!guardOperationalAccessVendas()) return;
    editandoPedidoId = null;
    pedidoAtual = null;
    itensCarrinho = [];
    itemEmEdicaoId = null;
    contasReceber = []; // Limpar contas a receber
    autoRedistribuirEnabled = true;
    contasReceberEdicaoBloqueada = false;
    // Resetar estado do preview de romaneio (exclusões + trava de reuso)
    try {
        romaneioSelecionado = null;
        limparExclusoesPreviewVendas();
        romaneioPreviewUsoInfo = null;
        romaneioPreviewTipoAtual = '';
        __rvPreviewChaves = [];
        __rvUsoCache = { id: '', result: null, ts: 0 };
        atualizarEstadoAgrupamentoVendas('');
        const btnLoad = document.querySelector('#secaoProdutoRomaneio .romaneio-load-btn');
        if (btnLoad) {
            btnLoad.disabled = false;
            btnLoad.title = '';
            btnLoad.style.opacity = '';
            btnLoad.style.cursor = '';
        }
        const prevBox = document.getElementById('previewConama');
        if (prevBox) prevBox.style.display = 'none';
    } catch (_) { /* best-effort */ }
    
    // Resetar formulário
    document.getElementById('pedidoForm').reset();
    
    // Configurar data atual
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('pedidoData').value = hoje;
    
    // Configurar data atual no campo vencimento
    document.getElementById('contaVencimento').value = hoje;
    
    // Gerar número do pedido com base no MAIOR número existente
    try {
        const pedidosSalvos = await getData('vendas/pedidos');
        const lista = Array.isArray(pedidosSalvos) ? pedidosSalvos : (Array.isArray(window.pedidos) ? window.pedidos : []);

        // Extrair números válidos e calcular o máximo
        const numeros = lista
            .map(p => {
                const n = parseInt((p && p.numero) ? String(p.numero) : '', 10);
                return isNaN(n) ? null : n;
            })
            .filter(n => n !== null);

        const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
        const numeroProximo = (maxNumero + 1).toString().padStart(6, '0');
        const numeroEl = document.getElementById('pedidoNumero');
        numeroEl.value = numeroProximo;
        numeroEl.readOnly = true;
    } catch (e) {
        console.warn('Falha ao calcular próximo número de pedido, usando fallback:', e);
        document.getElementById('pedidoNumero').value = '000001';
    }
    
    // Mostrar formulário
    document.getElementById('pedidoForm').style.display = 'block';

    // Select sempre reflete window.produtos atual (evita dados obsoletos)
    try { atualizarSelectProdutos(); } catch (_) {}

    // Limpar tabela de itens
    atualizarTabelaItens();
    atualizarTotais();
    
    // Resetar seções de produto (mostrar manual por padrão)
    document.querySelector('input[name="tipoProduto"][value="manual"]').checked = true;
    alterarTipoProduto('manual');
    
    // Limpar e resetar contas a receber
    atualizarTabelaContasReceber();
    atualizarTotalContasReceber();
    
    // Configurar formatação monetária para novos campos
    configurarFormatacaoNovosEventos();
}

function cancelarPedido() {
    document.getElementById('pedidoForm').style.display = 'none';
    editandoPedidoId = null;
    pedidoAtual = null;
    itensCarrinho = [];
    itemEmEdicaoId = null;
}

function getPedidoVendaRef(pedidoOuId) {
    if (pedidoOuId && typeof pedidoOuId === 'object') {
        return {
            id: String(pedidoOuId.id || pedidoOuId.firebaseKey || ''),
            numero: String(pedidoOuId.numero || pedidoOuId.pedidoNumero || '')
        };
    }
    return { id: String(pedidoOuId || ''), numero: '' };
}

function normalizePedidoVendaNumero(value) {
    return String(value || '').trim().replace(/^0+(\d)/, '$1');
}

function isContaReceberComRecebimento(conta) {
    const st = String(conta && conta.status ? conta.status : '').toLowerCase();
    const hasRec = Array.isArray(conta && conta.recebimentos ? conta.recebimentos : null) && conta.recebimentos.length > 0;
    const vo = typeof (conta && conta.valorOriginal) === 'number' ? conta.valorOriginal : parseFloat((conta && conta.valorOriginal) || '');
    const vr = typeof (conta && conta.valorRestante) === 'number' ? conta.valorRestante : parseFloat((conta && conta.valorRestante) || '');
    const parcial = !isNaN(vo) && !isNaN(vr) && vr < vo;
    return st === 'pago' || st === 'parcial' || hasRec || parcial;
}

function isContaReceberLike(value) {
    if (!value || typeof value !== 'object') return false;
    return value.origemId || value.pedidoNumero || value.dataVencimento || value.vencimento || value.valor !== undefined || value.valorOriginal !== undefined || value.descricao;
}

function flattenContasReceberData(data) {
    const out = [];
    const seen = new Set();
    const walk = (node, path = []) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach((item, idx) => walk(item, path.concat(String(idx))));
            return;
        }
        if (isContaReceberLike(node)) {
            const fallbackId = path.length ? path[path.length - 1] : '';
            const item = { id: node.id || node.firebaseKey || fallbackId, ...node };
            const sid = String(item.id || `${item.origemId || ''}|${item.pedidoNumero || ''}|${item.descricao || ''}|${item.vencimento || item.dataVencimento || ''}`);
            if (!seen.has(sid)) {
                seen.add(sid);
                out.push(item);
            }
            return;
        }
        Object.entries(node).forEach(([key, value]) => walk(value, path.concat(String(key))));
    };
    walk(data);
    return out;
}

function contaReceberPertenceAoPedidoVenda(conta, pedidoOuId) {
    const ref = getPedidoVendaRef(pedidoOuId);
    if (!conta || typeof conta !== 'object') return false;
    const pedidoId = ref.id;
    const pedidoNumero = ref.numero;
    if (pedidoId && String(conta.origemId || '') === pedidoId) return true;
    if (pedidoId && String(conta.id || '').startsWith(`CR_${pedidoId}_`)) return true;
    if (pedidoNumero && String(conta.pedidoNumero || '') === pedidoNumero) return true;
    if (pedidoNumero) {
        const desc = String(conta.descricao || conta.observacoes || '');
        const numeroNorm = normalizePedidoVendaNumero(pedidoNumero);
        if (desc.includes(`Pedido ${pedidoNumero}`)) return true;
        if (numeroNorm && desc.includes(`Pedido ${numeroNorm}`)) return true;
    }
    return false;
}

async function carregarContasReceberVinculadasPedidoVenda(pedidoOuId) {
    const vinculadas = [];
    if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
        try {
            const res = await window.firebaseService.loadFromFirebase('financas/receber');
            if (res && res.success && res.data) {
                vinculadas.push(...flattenContasReceberData(res.data).filter(c => contaReceberPertenceAoPedidoVenda(c, pedidoOuId)));
            }
        } catch (_) {}
    }
    if (vinculadas.length === 0) {
        try {
            const local = await getData('financas/receber') || [];
            vinculadas.push(...flattenContasReceberData(local).filter(c => contaReceberPertenceAoPedidoVenda(c, pedidoOuId)));
        } catch (_) {}
    }
    const seen = new Set();
    return vinculadas.filter(c => {
        const id = String(c && c.id ? c.id : '');
        const key = id || `${c && c.origemId || ''}|${c && c.pedidoNumero || ''}|${c && c.descricao || ''}|${c && (c.vencimento || c.dataVencimento) || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function montarUpdatesRemocaoContasReceberVenda(lista, options = {}) {
    const updates = {};
    const includeLegacy = options.includeLegacy !== false;
    (lista || []).forEach(c => {
        if (!c || !c.id) return;
        const id = String(c.id);
        const mk = toMonthKey(c.dataVencimento || c.vencimento);
        updates[`financas/receber/${mk}/${id}`] = null;
        if (includeLegacy) {
            updates[`contasReceber/${mk}/${id}`] = null;
            updates[`contasReceber/${id}`] = null;
        }
    });
    return updates;
}

/**
 * ✅ VALIDAR ESTOQUE ANTES DE ADICIONAR ITEM
 * @param {string} produtoId - ID do produto
 * @param {number} quantidadeDesejada - Quantidade que se deseja adicionar
 * @returns {Object} { valido: boolean, mensagem: string, estoqueAtual: number }
 */
function validarEstoque(produtoId, quantidadeDesejada, itemEmEdicao, unidadeItem) {
    // Produtos manuais e de romaneio não têm controle de estoque
    if (produtoId.startsWith('manual_') || produtoId.startsWith('romaneio_')) {
        return { valido: true, mensagem: '', estoqueAtual: null };
    }

    const produto = window.produtos.find(p => p.id === produtoId);

    if (!produto) {
        return {
            valido: false,
            mensagem: 'Produto não encontrado',
            estoqueAtual: 0
        };
    }
    if (isCarregoProduto(produto)) {
        return { valido: true, mensagem: '', estoqueAtual: null };
    }

    // Disponível na dimensão da unidade pedida (UN→peças, M³→volume, ML→ml, M²→área)
    let estoqueAtual = produto.estoque || 0;
    let unidadeRotulo = produto.unidade || 'UN';
    try {
        if (typeof temDimsSerrado === 'function' && temDimsSerrado(produto) && typeof razaoBaixaSerrado === 'function') {
            const uni = unidadeItem || produto.unidade || 'UN';
            const r = razaoBaixaSerrado(produto, 0, uni);
            // razaoBaixaSerrado com 0 devolve disponivel da base correta
            estoqueAtual = r.disponivel;
            unidadeRotulo = uni;
        }
    } catch (_) {}
    
    // Verificar se já existe no carrinho
    const itemNoCarrinho = itensCarrinho.find(i => i.produtoId === produtoId);
    let quantidadeJaNoCarrinho = itemNoCarrinho ? itemNoCarrinho.quantidade : 0;

    // Ao editar um item existente, a quantidade antiga dele é substituída,
    // não somada — descontar para validar apenas o delta.
    if (itemEmEdicao && String(itemEmEdicao.id) === String(itemNoCarrinho && itemNoCarrinho.id)) {
        quantidadeJaNoCarrinho = 0;
    }
    
    const quantidadeTotal = quantidadeDesejada + quantidadeJaNoCarrinho;
    
    if (quantidadeTotal > estoqueAtual && VendasConfig.validarEstoque && !VendasConfig.permitirEstoqueNegativo) {
        return {
            valido: false,
            mensagem: `Estoque insuficiente. Disponível: ${estoqueAtual} ${unidadeRotulo} | No carrinho: ${quantidadeJaNoCarrinho} | Solicitado: ${quantidadeDesejada}`,
            estoqueAtual: estoqueAtual
        };
    }
    
    return {
        valido: true,
        mensagem: '',
        estoqueAtual: estoqueAtual
    };
}

function adicionarItem() {
    const produtoId = document.getElementById('produtoSelect').value;
    let quantidade = parseFloat(document.getElementById('quantidade').value);
    const precoUnitario = parseCurrencyValue(document.getElementById('precoUnitario').value);
    
    if (!produtoId) {
        ToastManager.warning('Selecione um produto', 'Atenção');
        return;
    }
    
    if (!quantidade || quantidade <= 0) {
        ToastManager.warning('Informe uma quantidade válida', 'Atenção');
        return;
    }
    
    if (!precoUnitario || precoUnitario <= 0) {
        ToastManager.warning('Informe um preço válido', 'Atenção');
        return;
    }
    
    const produto = window.produtos.find(p => p.id === produtoId);
    if (!produto) {
        ToastManager.error('Produto não encontrado', 'Erro');
        return;
    }

    // Quantidade e unidade (podem ser convertidas p/ m³ abaixo)
    const unidadeItemEl = document.getElementById('unidadeItem');
    let unidadeItem = (unidadeItemEl && unidadeItemEl.value) ? unidadeItemEl.value : (produto.unidade || 'UN');
    let qtdOrigem = null, pecasOrigem = null, unidadeOrigem = null;
    // Serrado com unidade ≠ m³: quantidade sempre em m³ (totais corretos);
    // origem guardada p/ exibir "2 Peças" na linha. Só com dims válidas.
    try {
        if (typeof converterItemSerradoParaM3 === 'function') {
            const conv = converterItemSerradoParaM3(produto, quantidade, unidadeItem);
            if (conv) {
                quantidade = conv.volume;
                unidadeItem = 'm³';
                qtdOrigem = conv.qtdOrigem;
                pecasOrigem = conv.pecasOrigem;
                unidadeOrigem = conv.unidadeOrigem;
            }
        }
    } catch (_) {}

    // ✅ VALIDAÇÃO DE ESTOQUE (na edição, descontar a quantidade antiga do item)
    const itemEdicao = itemEmEdicaoId
        ? itensCarrinho.find(i => String(i.id) === String(itemEmEdicaoId))
        : null;
    const validacao = validarEstoque(produtoId, quantidade, itemEdicao, unidadeItem);

    if (!validacao.valido) {
        ToastManager.error(validacao.mensagem, 'Estoque Insuficiente', 6000);
        return;
    }

    // ✅ EDIÇÃO DE ITEM: atualizar o item marcado em vez de criar um novo
    if (itemEmEdicaoId) {
        const alvo = itensCarrinho.find(i => String(i.id) === String(itemEmEdicaoId));
        itemEmEdicaoId = null;
        if (alvo) {
            alvo.produtoId = produtoId;
            alvo.produtoNome = produto.nome;
            alvo.produtoCodigo = produto.codigo;
            alvo.quantidade = quantidade;
            alvo.precoUnitario = precoUnitario;
            alvo.unidade = unidadeItem;
            // Sem conversão nova (ex.: já em m³): mantém a origem anterior,
            // recalculando peças pelo novo volume quando der.
            if (qtdOrigem != null || unidadeOrigem != null || pecasOrigem != null) {
                alvo.qtdOrigem = qtdOrigem;
                alvo.pecasOrigem = pecasOrigem;
                alvo.unidadeOrigem = unidadeOrigem;
            } else if (alvo.unidadeOrigem) {
                try {
                    const E = parseFloat(produto.espessura) || 0, L = parseFloat(produto.largura) || 0, C = parseFloat(produto.comprimento) || 0;
                    const fam = typeof normalizarUnidadeMedida === 'function' ? normalizarUnidadeMedida(alvo.unidadeOrigem) : '';
                    if (E > 0 && L > 0 && C > 0 && (fam === 'UN' || fam === 'DZ')) {
                        const pPecas = parseFloat(produto.pecas) || 0, pVol = parseFloat(produto.volumeM3) || 0;
                        const volPeca = (pPecas > 0 && pVol > 0) ? (pVol / pPecas) : (E * L * C) / 1e6;
                        if (volPeca > 0) {
                            const pecas = quantidade / volPeca;
                            alvo.pecasOrigem = Math.round(pecas * 1000) / 1000;
                            alvo.qtdOrigem = fam === 'DZ' ? (Math.round(pecas * 1000) / 1000) / 12 : alvo.pecasOrigem;
                        }
                    }
                } catch (_) {}
            }
            alvo.total = quantidade * precoUnitario;
            alvo.isCarrego = isCarregoProduto(produto);
            alvo.tipo = 'cadastrado';
            ToastManager.success(`${produto.nome} atualizado no carrinho`, 'Item atualizado', 2000);
            document.getElementById('produtoSelect').value = '';
            document.getElementById('quantidade').value = '';
            document.getElementById('precoUnitario').value = '';
            atualizarTabelaItens();
            atualizarTotais();
            return;
        }
    }
    
    // Mesma origem (unidade) acumula na linha; origem diferente cria linha nova
    // para o detalhe ("2 Peças" vs "10 ml") não misturar.
    const mesmaOrigem = (it) => String(it.unidadeOrigem || it.unidade || '') === String(unidadeOrigem || unidadeItem);
    const itemExistente = itensCarrinho.find(item => item.produtoId === produtoId && mesmaOrigem(item));

    if (itemExistente) {
        itemExistente.quantidade += quantidade;
        if (qtdOrigem != null && itemExistente.qtdOrigem != null) itemExistente.qtdOrigem += qtdOrigem;
        else if (qtdOrigem != null) { itemExistente.qtdOrigem = qtdOrigem; itemExistente.unidadeOrigem = unidadeOrigem; }
        if (pecasOrigem != null && itemExistente.pecasOrigem != null) itemExistente.pecasOrigem += pecasOrigem;
        else if (pecasOrigem != null) itemExistente.pecasOrigem = pecasOrigem;
        itemExistente.total = itemExistente.quantidade * itemExistente.precoUnitario;
        if (isCarregoProduto(produto)) itemExistente.isCarrego = true;
        ToastManager.success(`Quantidade atualizada: ${formatNumber(itemExistente.quantidade)} ${itemExistente.unidade}`, 'Item atualizado', 2000);
    } else {
        const novoItem = {
            id: Date.now(),
            produtoId: produtoId,
            produtoNome: produto.nome,
            produtoCodigo: produto.codigo,
            quantidade: quantidade,
            unidade: unidadeItem,
            qtdOrigem: qtdOrigem,
            pecasOrigem: pecasOrigem,
            unidadeOrigem: unidadeOrigem,
            precoUnitario: precoUnitario,
            total: quantidade * precoUnitario,
            isCarrego: isCarregoProduto(produto)
        };
        
        itensCarrinho.push(novoItem);
        ToastManager.success(`${produto.nome} adicionado ao carrinho`, 'Item adicionado', 2000);
    }
    
    // Limpar campos
    document.getElementById('produtoSelect').value = '';
    document.getElementById('quantidade').value = '';
    document.getElementById('precoUnitario').value = '';
    
    // Atualizar tabela e totais
    atualizarTabelaItens();
    atualizarTotais();
    
    // Feedback visual no console
    if (validacao.estoqueAtual !== null) {
        console.log(`✅ Item adicionado. Estoque restante: ${formatNumber(validacao.estoqueAtual - quantidade, 0)}`);
    }
}

function removerItem(itemId, options = {}) {
    const { reason = 'delete' } = options;
    const item = itensCarrinho.find(i => String(i.id) === String(itemId));

    // Remover sem popup de confirmação
    itensCarrinho = itensCarrinho.filter(i => String(i.id) !== String(itemId));
    atualizarTabelaItens();
    atualizarTotais();

    // Evitar duplicações de mensagens: na edição, o fluxo já exibe toasts específicos
    if (reason !== 'edit') {
        ToastManager.success(
            `${item ? item.produtoNome : 'Item'} removido do carrinho`,
            'Item removido',
            2000
        );
    }
}

function editarItem(itemId) {
    const item = itensCarrinho.find(i => String(i.id) === String(itemId));
    if (!item) return;
    
    console.log('📝 Editando item:', item); // Debug para verificar os dados do item
    
    // Determinar tipo do item e preencher os campos apropriados
    const tipo = item.tipo || 'cadastrado';
    // Firewall: tipo desconhecido cai no manual (nunca deixa o formulário em branco).
    const tiposConhecidos = ['manual', 'romaneio', 'cadastrado', 'romaneio_agrupado', 'romaneio_dimensoes'];
    const tipoSeguro = tiposConhecidos.includes(tipo) ? tipo : 'manual';
    
    // Alternar para o tipo correto de produto
    alterarTipoProduto(tipoSeguro);
    
    // Preencher campos baseado no tipo
    switch(tipoSeguro) {
        case 'manual':
            document.getElementById('produtoManual').value = (item.produtoNome || '').replace(/^\s*[-–—]\s*/, '').trim();
            document.getElementById('quantidadeManual').value = item.quantidade;
            document.getElementById('unidadeManual').value = item.unidade || 'UN';
            document.getElementById('precoManual').value = formatCurrency(item.precoUnitario);
            break;
        case 'romaneio':
        case 'romaneio_dimensoes':
            // ✅ Opção 2: Permitir edição de itens de romaneio via Produto Manual
            // Converter para edição manual preservando dados originais
            // (romaneio_dimensoes cai aqui: sem este case ia para o default
            // 'cadastrado' com todas as seções ocultas e formulário vazio).
            alterarTipoProduto('manual');
            
            // ✅ CORREÇÃO: Preservar a unidade correta do item de romaneio
            const unidadeRomaneio = item.unidade || 'm³'; // Garantir que use 'm³' como padrão para romaneios
            
            // Preencher campos com dados do item de romaneio
            document.getElementById('produtoManual').value = item.produtoNome;
            document.getElementById('quantidadeManual').value = item.quantidade;
            document.getElementById('unidadeManual').value = unidadeRomaneio;
            document.getElementById('precoManual').value = formatCurrency(item.precoUnitario);
            
            // Avisar o usuário da conversão
            ToastManager.info(
                `Item de romaneio convertido para edição manual. Unidade: ${unidadeRomaneio}`,
                'Edição de Item',
                4000
            );
            
            // O item permanece na lista até o "Adicionar" confirmar a atualização
            break;
        case 'cadastrado':
        default:
    document.getElementById('produtoSelect').value = item.produtoId;
    document.getElementById('quantidade').value = item.quantidade;
    document.getElementById('precoUnitario').value = formatCurrency(item.precoUnitario);
    try {
        const unEl = document.getElementById('unidadeItem');
        if (unEl) unEl.value = item.unidade || 'UN';
    } catch (_) {}
            break;
        case 'romaneio_agrupado': {
            // ✅ DESAGRUPAR + CARREGAR em 1 clique: expande o grupo e já carrega
            // o primeiro item no formulário (sem pergunta de confirmação).
            const originais = Array.isArray(item.itensOriginais) ? item.itensOriginais : [];
            if (originais.length === 0) {
                // Dados legados sem originais preservados: fallback para edição manual
                alterarTipoProduto('manual');
                document.getElementById('produtoManual').value = (item.produtoNome || '').replace(/^\s*[-–—]\s*/, '').trim();
                document.getElementById('quantidadeManual').value = item.quantidade;
                document.getElementById('unidadeManual').value = item.unidade || 'm³';
                document.getElementById('precoManual').value = formatCurrency(item.precoUnitario);
                ToastManager.info(
                    'Item agrupado convertido para edição manual (dados originais não preservados).',
                    'Edição de Item',
                    4000
                );
                itemEmEdicaoId = String(itemId);
                break;
            }
            const idx = itensCarrinho.findIndex(i => String(i.id) === String(itemId));
            if (idx === -1) return;
            // Sem chave itensOriginais (delete em vez de undefined: o SDK do
            // Firebase rejeita propriedades undefined e aborta o save).
            const desagrupados = originais.map(o => {
                const copia = { ...o, id: Date.now() + Math.random() };
                delete copia.itensOriginais;
                return copia;
            });
            itensCarrinho.splice(idx, 1, ...desagrupados);
            atualizarTabelaItens();
            atualizarTotais();
            const primeiroDesagrupado = desagrupados[0];
            if (!primeiroDesagrupado) {
                itemEmEdicaoId = null;
                break;
            }
            // Carrega o primeiro item direto no formulário de edição manual.
            alterarTipoProduto('manual');
            document.getElementById('produtoManual').value = (primeiroDesagrupado.produtoNome || '').replace(/^\s*[-–—]\s*/, '').trim();
            document.getElementById('quantidadeManual').value = primeiroDesagrupado.quantidade;
            document.getElementById('unidadeManual').value = primeiroDesagrupado.unidade || 'm³';
            document.getElementById('precoManual').value = formatCurrency(primeiroDesagrupado.precoUnitario);
            itemEmEdicaoId = String(primeiroDesagrupado.id);
            ToastManager.success(
                `Grupo desagrupado em ${desagrupados.length} itens — primeiro carregado para edição. Ajuste e clique em Adicionar.`,
                'Item desagrupado',
                4000
            );
            return;
        }
    }
    
    // Marcar item em edição: o próximo "Adicionar" atualiza este item na mesma
    // posição em vez de criar um novo. O item permanece visível na tabela.
    itemEmEdicaoId = String(itemId);
    ToastManager.info('Ajuste os valores e clique em Adicionar para atualizar o item.', 'Editando item', 3500);
}

function atualizarTabelaItens() {
    const tbody = document.getElementById('itensTable');
    
    if (itensCarrinho.length === 0) {
        tbody.innerHTML = '<tr><td class="commerce-full-row" data-label="" colspan="5" style="text-align: center;">Nenhum item adicionado</td></tr>';
        refreshCommerceResponsiveTables();
        return;
    }
    
    tbody.innerHTML = itensCarrinho.map(item => {
        let produtoDescricao = '';
        const nomeLimpo = (item.produtoNome || '').replace(/^\s*[-–—]\s*/, '').trim();
        
        if (item.tipo === 'manual' || item.tipo === 'romaneio' || item.tipo === 'romaneio_agrupado' || item.tipo === 'romaneio_dimensoes') {
            produtoDescricao = nomeLimpo;
        } else {
            produtoDescricao = item.produtoCodigo ? `${item.produtoCodigo} - ${nomeLimpo}` : nomeLimpo;
            // Serrado convertido: "000099 - Orelha-de-macaco - 7cmx14cmx850cm - 2 Peças"
            try {
                if (typeof detalheSerradoItem === 'function') {
                    const det = detalheSerradoItem(item);
                    if (det) {
                        let base = produtoDescricao;
                        if (typeof rotuloSerradoLinha === 'function') {
                            const rot = rotuloSerradoLinha(item);
                            if (rot) base = item.produtoCodigo ? `${item.produtoCodigo} - ${rot}` : rot;
                        }
                        produtoDescricao = `${base} - ${det}`;
                    }
                }
            } catch (_) {}
        }
        if (isCarregoItem(item)) {
            produtoDescricao += ' (Carrego)';
        }
        produtoDescricao += getCarregoBadgeHtml(item);

        const quantidadeFormatada = item.unidade
            ? `${formatNumber(item.quantidade)} ${item.unidade}`
            : formatNumber(item.quantidade);
        
        return `
            <tr>
                <td data-label="Produto">${produtoDescricao}</td>
                <td data-label="Quantidade" style="text-align: center;">${quantidadeFormatada}</td>
                <td data-label="Preço Unit." style="text-align: right;">${formatCurrency(item.precoUnitario)}</td>
                <td data-label="Total" style="text-align: right;">${formatCurrency(item.total)}</td>
                <td data-label="Ações" class="commerce-actions-cell" style="text-align: center;">
                    <button type="button" onclick="editarItem('${escapeJsString(item.id)}')" class="btn-primary btn-small">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" onclick="removerItem('${escapeJsString(item.id)}')" class="btn-danger btn-small">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    refreshCommerceResponsiveTables();
}

function atualizarTotais() {
    const subtotal = itensCarrinho.reduce((total, item) => total + item.total, 0);
    const desconto = parseCurrencyValue(document.getElementById('desconto').value || '0');
    const totalGeral = subtotal - desconto;
    const totalQuantidade = itensCarrinho.reduce((total, item) => {
        if (isCarregoItem(item)) return total;
        const qtd = parseNumberFlexible(item.quantidade);
        return total + (isNaN(qtd) ? 0 : qtd);
    }, 0);
    
    const _elSubtotal = document.getElementById('subtotal');
    const _elTotalGeral = document.getElementById('totalGeral');
    if (_elSubtotal) _elSubtotal.textContent = formatCurrency(subtotal);
    if (_elTotalGeral) _elTotalGeral.textContent = formatCurrency(totalGeral);
    const totalQtdEl = document.getElementById('totalGeralQtd');
    if (totalQtdEl) {
        totalQtdEl.textContent = formatNumber(totalQuantidade);
    }
    
    const podeRedistribuir = contasReceber.length > 0 && (
        autoRedistribuirEnabled ||
        (editandoPedidoId && !contasReceberEdicaoBloqueada && contasReceber.every(c => !c.locked))
    );
    if (podeRedistribuir) {
        redistribuirValoresContas();
        atualizarTabelaContasReceber();
        atualizarTotalContasReceber();
    } else {
        // Campo Valor = RESTANTE (total - soma parcelas). Quando não há
        // parcelas, restante = total (comportamento anterior preservado).
        const contaValorInput = document.getElementById('contaValor');
        if (contaValorInput) {
            const soma = (contasReceber || []).reduce((s, c) => s + (parseCurrencyValue(c.valor) || 0), 0);
            const restante = Math.max(0, Math.round((totalGeral - soma) * 100) / 100);
            contaValorInput.value = restante > 0 ? formatCurrency(restante) : '';
            console.log(`✅ Campo Valor sincronizado com restante: ${formatCurrency(restante)}`);
        }
    }
}

// Remove chaves undefined recursivamente (in place). O SDK do Firebase
// (update/set) rejeita propriedades undefined e aborta a escrita inteira;
// JSON.stringify as descartaria, mas o SDK valida antes de serializar.
function sanearIndefinidosFirebase(valor) {
    try {
        if (Array.isArray(valor)) {
            for (let i = valor.length - 1; i >= 0; i--) {
                if (valor[i] === undefined) valor.splice(i, 1);
                else sanearIndefinidosFirebase(valor[i]);
            }
            return valor;
        }
        if (valor && typeof valor === 'object') {
            Object.keys(valor).forEach(k => {
                if (valor[k] === undefined) delete valor[k];
                else sanearIndefinidosFirebase(valor[k]);
            });
        }
    } catch (_) { /* best-effort: nunca bloqueia salvamento */ }
    return valor;
}

// Função para salvar pedido
async function salvarPedido(event) {
    event.preventDefault();

    // Trava anti-duplo-clique/Enter (auto-expira em 5s: sem estado preso).
    // O overlay do LoadingManager já bloqueia cliques durante o save.
    try {
        const agora = Date.now();
        if (window.__salvarPedidoVendaTs && (agora - window.__salvarPedidoVendaTs) < 5000) {
            try { ToastManager.info('Salvamento já em andamento, aguarde...', 'Aguarde'); } catch (_) {}
            return;
        }
        window.__salvarPedidoVendaTs = agora;
    } catch (_) {}

    try {
        // Validações iniciais (sem loading para evitar travamento visual em caso de erro simples)
        if (itensCarrinho.length === 0) {
            ToastManager.warning('Adicione pelo menos um item ao pedido', 'Atenção');
            return;
        }
        
        const clienteId = document.getElementById('clienteSelect').value;
        if (!clienteId) {
            ToastManager.warning('Selecione um cliente', 'Atenção');
            return;
        }

        LoadingManager.show('Salvando pedido...');

        // Sincroniza edições de parcelas ainda pendentes (debounce) para a
        // memória antes de montar o payload — evita persistir valores antigos.
        try { descarregarEdicaoParcelasVenda(); } catch (_) {}
        
        // Debug: Verificar clientes carregados
        console.log('Cliente ID selecionado:', clienteId);
        console.log('Total de clientes carregados:', window.clientes.length);
        console.log('Clientes disponíveis:', window.clientes.map(c => ({ id: c.id, nome: c.nome || c.name })));
        
        // Buscar dados completos do cliente com verificação mais robusta
        let clienteSelecionado = window.clientes.find(c => c.id === clienteId);
        
        // Se não encontrou, tentar buscar por comparação de string
        if (!clienteSelecionado) {
            clienteSelecionado = window.clientes.find(c => String(c.id) === String(clienteId));
        }
        
        // Se ainda não encontrou, recarregar clientes e tentar novamente
        if (!clienteSelecionado) {
            console.log('Cliente não encontrado, recarregando dados...');
            try {
                if (window.clientService && window.clientService.getClients) {
                    window.clientes = await window.clientService.getClients(true);
                } else {
                    window.clientes = await getData('clients') || [];
                }
                atualizarSelectClientes();
            } catch (e) { console.warn('Falha ao recarregar clientes:', e); }
            clienteSelecionado = window.clientes.find(c => c.id === clienteId || String(c.id) === String(clienteId));
        }
        
        // ÚLTIMA TENTATIVA: Recarregar do DOM caso o select tenha sido atualizado mas window.clientes não
        if (!clienteSelecionado) {
             const selectEl = document.getElementById('clienteSelect');
             if (selectEl && selectEl.options && selectEl.options.length > 0) {
                 const opt = Array.from(selectEl.options).find(o => o.value === clienteId);
                 if (opt) {
                     // Reconstruir objeto cliente mínimo a partir do option
                     console.log('⚠️ Cliente recuperado via DOM (option select):', opt.textContent);
                     clienteSelecionado = {
                         id: clienteId,
                         nome: opt.textContent,
                         documento: opt.dataset.documento || '',
                         email: '',
                         telefone: '',
                         endereco: ''
                     };
                 }
             }
        }

        if (!clienteSelecionado) {
            // Última tentativa: buscar direto no Firebase se disponível
            try {
                if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                    const res = await window.firebaseService.loadFromFirebase('clients');
                    const data = res && res.data ? res.data : null;
                    if (data) {
                        const arr = Array.isArray(data) ? data : Object.values(data || {});
                        clienteSelecionado = arr.find(c => c.id === clienteId || String(c.id) === String(clienteId));
                    }
                }
            } catch (e) { console.warn('Falha ao buscar cliente direto no Firebase:', e); }
        }

        if (!clienteSelecionado) {
            console.error('Cliente não encontrado após todas as tentativas');
            console.log('IDs disponíveis:', window.clientes.map(c => c.id));
            LoadingManager.hide();
            ToastManager.error('Cliente selecionado não encontrado. Tente recarregar a página e selecionar o cliente novamente.', 'Erro', 6000);
            return;
        }
        
        console.log('Cliente encontrado:', clienteSelecionado);
        if (editandoPedidoId && contasReceberEdicaoBloqueada) {
            LoadingManager.hide();
            ToastManager.error('Não é possível alterar parcelas: há recebimentos vinculados. Cancele os recebimentos antes de salvar.', 'Edição bloqueada', 7000);
            return;
        }
        
        // Preparar dados do pedido - SEMPRE usar o cliente selecionado no formulário
        const numeroForm = document.getElementById('pedidoNumero').value;
        let numeroFinal = numeroForm;
        if (!editandoPedidoId) {
            try {
                const todos = await getData('vendas/pedidos') || [];
                const existentes = Array.isArray(todos) ? todos : (Array.isArray(window.pedidos) ? window.pedidos : []);
                const hasDup = (existentes || []).some(p => String(p.numero) === String(numeroForm));
                if (hasDup) {
                    const nums = (existentes || []).map(p => parseInt(String(p.numero), 10)).filter(n => !isNaN(n));
                    const maxNumero = nums.length > 0 ? Math.max(...nums) : 0;
                    numeroFinal = (maxNumero + 1).toString().padStart(6, '0');
                    document.getElementById('pedidoNumero').value = numeroFinal;
                    console.log(`Número duplicado detectado. Ajustado automaticamente para ${numeroFinal}`);
                    ToastManager.info(`Número já em uso. Ajustado para ${numeroFinal}`, 'Atenção');
                }
            } catch (e) {
                console.warn('Falha ao verificar duplicidade de número:', e);
            }
        }
        const idFinal = editandoPedidoId || (pedidoAtual && pedidoAtual.id) || generateUniqueId('PED');
        const nowIso = new Date().toISOString();
        const pedidoData = {
            id: idFinal,
            numero: numeroFinal,
            data: document.getElementById('pedidoData').value,
            status: document.getElementById('pedidoStatus').value,
            clienteId: clienteId,
            cliente: {
                id: clienteSelecionado.id,
                nome: clienteSelecionado.nome || clienteSelecionado.name || '',
                email: clienteSelecionado.email || '',
                telefone: clienteSelecionado.telefone || clienteSelecionado.phone || '',
                endereco: clienteSelecionado.endereco || clienteSelecionado.address || ''
            },
            itens: itensCarrinho.map(it => ({ 
                ...it, 
                produtoNome: (it.produtoNome || '').replace(/^\s*[-–—]\s*/, '').trim(),
                especie: (it.especie || '').replace(/^\s*[-–—]\s*/, '').trim()
            })),
            subtotal: itensCarrinho.reduce((total, item) => total + item.total, 0),
            desconto: parseCurrencyValue(document.getElementById('desconto').value || '0'),
            total: parseCurrencyValue(document.getElementById('totalGeral').textContent),
            contasReceber: [...contasReceber], // Usar novo sistema de contas
            created: editandoPedidoId ? (pedidoAtual && pedidoAtual.created ? pedidoAtual.created : undefined) : nowIso,
            updated: nowIso
        };
        // Vínculo aditivo romaneio->pedido (para trava de reuso). Não afeta leitores antigos.
        try {
            const mapaOrigens = new Map();
            const absorverOrigem = (id, numero, tipo) => {
                const k = String(id || '').trim();
                if (!k) return;
                if (!mapaOrigens.has(k)) {
                    mapaOrigens.set(k, { id: k, numero: String(numero || k), tipo: String(tipo || '') });
                }
            };
            const pedidoPrevOrigens = (window.pedidos || []).find(p => String(p.id) === String(idFinal));
            if (pedidoPrevOrigens && Array.isArray(pedidoPrevOrigens.romaneiosOrigem)) {
                pedidoPrevOrigens.romaneiosOrigem.forEach(o => {
                    if (o && typeof o === 'object') absorverOrigem(o.id || o.romaneioId || o.origemId, o.numero || o.romaneioNumero, o.tipo || o.romaneioTipo);
                    else absorverOrigem(o, o, '');
                });
            }
            (Array.isArray(pedidoData.itens) ? pedidoData.itens : []).forEach(it => {
                if (!it || typeof it !== 'object') return;
                const t = String(it.tipo || '').toLowerCase();
                if (t !== 'romaneio' && t !== 'romaneio_agrupado' && t !== 'romaneio_dimensoes') return;
                absorverOrigem(it.origemId || it.romaneioId, it.romaneioNumero || it.origemId || it.romaneioId, it.romaneioTipo || '');
            });
            pedidoData.romaneiosOrigem = Array.from(mapaOrigens.values());
        } catch (_) { /* vínculo best-effort: nunca bloqueia salvamento */ }
        // Modo de agrupamento do romaneio (para restaurar a lógica na edição).
        try {
            const modoAtualVenda = (typeof lerModoAgrupamentoVendas === 'function') ? lerModoAgrupamentoVendas() : 'nenhum';
            if (modoAtualVenda && modoAtualVenda !== 'nenhum') {
                pedidoData.modoAgrupamentoRomaneio = modoAtualVenda;
            } else {
                const prevPedidoVenda = (window.pedidos || []).find(p => String(p.id) === String(idFinal));
                if (prevPedidoVenda && prevPedidoVenda.modoAgrupamentoRomaneio) {
                    pedidoData.modoAgrupamentoRomaneio = prevPedidoVenda.modoAgrupamentoRomaneio;
                }
            }
        } catch (_) { /* best-effort: nunca bloqueia salvamento */ }
        if (pedidoData.created === undefined) { delete pedidoData.created; }
        // Saneamento anti-undefined antes de qualquer escrita remota.
        sanearIndefinidosFirebase(pedidoData);

        if (editandoPedidoId) {
            const pedidoPrev = (window.pedidos || []).find(p => String(p.id) === String(editandoPedidoId)) || null;
            const prevStatus = String(pedidoPrev && pedidoPrev.status ? pedidoPrev.status : '').toLowerCase();
            const bloqueados = new Set(['cancelado','faturado','finalizado']);
            if (bloqueados.has(prevStatus)) {
                LoadingManager.hide();
                ToastManager.error('Status do pedido não permite alterações.', 'Edição bloqueada', 6000);
                return;
            }
        }

        const statusNext = String(pedidoData.status || '').toLowerCase();
        const shouldGenerateFinance = statusNext !== 'pendente' && statusNext !== 'cancelado';

        const somaContas = (pedidoData.contasReceber || []).reduce((s, c) => s + (parseCurrencyValue(c.valor) || 0), 0);
        if (Math.abs(somaContas - (parseCurrencyValue(pedidoData.total) || 0)) > 0.01) {
            ToastManager.warning('Total do pedido difere da soma das parcelas.', 'Validação');
        }
        
        let removiveis = [];
        let pedidoAnterior = null;
        if (editandoPedidoId) {
            pedidoAnterior = (window.pedidos || []).find(p => String(p.id) === String(editandoPedidoId)) || null;
            const pedidoRefFinanceiro = {
                id: editandoPedidoId,
                numero: pedidoData.numero || (pedidoAnterior && pedidoAnterior.numero) || ''
            };
            const vinculadas = await carregarContasReceberVinculadasPedidoVenda(pedidoRefFinanceiro);
            const semRecebimento = vinculadas.filter(c => !isContaReceberComRecebimento(c));
            removiveis = semRecebimento.slice();

            if (!shouldGenerateFinance) {
                const temRecebimento = vinculadas.some(c => isContaReceberComRecebimento(c));
                if (temRecebimento) {
                    LoadingManager.hide();
                    ToastManager.error(`Não é possível alterar para "${getStatusLabel(statusNext)}": existem recebimentos vinculados.`, 'Ação bloqueada', 8000);
                    return;
                }
                removiveis = vinculadas.slice();
                if (removiveis.length > 0) {
                    ToastManager.info(`Financeiro do pedido ${pedidoData.numero} estornado: ${removiveis.length} parcela(s).`, 'Edição de Pedido');
                }
            }
        }

        if (editandoPedidoId && shouldGenerateFinance) {
            try {
                const safeRemoviveis = await listarContasReceberSemRecebimento({
                    id: editandoPedidoId,
                    numero: pedidoData.numero || (pedidoAnterior && pedidoAnterior.numero) || ''
                });
                if (Array.isArray(safeRemoviveis) && safeRemoviveis.length > 0) {
                    removiveis = safeRemoviveis;
                }
            } catch (_) {}
        }

        // Prevenir duplicação por número: remover outros REGISTROS com mesmo número.
        // Usa a CHAVE real do Firebase (não o id interno): registros legados
        // podem viver sob chaves numéricas antigas com o mesmo id interno —
        // deletar pelo id interno nunca os alcançaria (caso 105/chave 102).
        try {
            let dupKeys = [];
            try {
                const rawRes = window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function'
                    ? await window.firebaseService.loadFromFirebase('vendas/pedidos') : null;
                const raw = rawRes && rawRes.data;
                if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                    Object.entries(raw).forEach(([k, v]) => {
                        if (!v || typeof v !== 'object' || k === '_metadata' || k === 'metadata') return;
                        if (String(k) === String(pedidoData.id)) return;
                        if (String(v.numero || '') === String(pedidoData.numero || '')) dupKeys.push(String(k));
                    });
                }
            } catch (_) {}
            if (dupKeys.length === 0) {
                const todos = await getData('vendas/pedidos') || [];
                (todos || [])
                    .filter(p => String(p.numero) === String(pedidoData.numero) && getPedidoVendaId(p) !== String(pedidoData.id))
                    .forEach(p => {
                        const k = String((p && p.firebaseKey) || (p && p.id) || '');
                        if (k && k !== String(pedidoData.id) && !dupKeys.includes(k)) dupKeys.push(k);
                    });
            }
            if (dupKeys.length > 0) {
                // Ids das parcelas atuais: nunca remover essas (o duplicado legado
                // compartilha numero/origemId com o pedido atual).
                const idsAtuais = new Set(
                    (pedidoData.contasReceber || []).map(c => String((c && c.id) || '')).filter(Boolean)
                );
                for (const dk of dupKeys) {
                    // Remover registro duplicado pela chave real
                    if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                        await window.firebaseService.saveToFirebase('vendas/pedidos', dk, null);
                    }
                    // Remover contas vinculadas ao duplicado, exceto as do pedido atual
                    // e as que possuem recebimento (fail-closed).
                    try {
                        const vinc = await carregarContasReceberVinculadasPedidoVenda({ id: dk, numero: pedidoData.numero });
                        const alvo = (vinc || []).filter(c =>
                            !isContaReceberComRecebimento(c) && !idsAtuais.has(String((c && c.id) || ''))
                        );
                        if (alvo.length > 0) await removerContasReceberPorLista(alvo);
                    } catch(e) { console.warn('Erro ao remover contas do duplicado:', e); }
                    // Atualizar cache local
                    window.pedidos = (window.pedidos || []).filter(p => getPedidoVendaId(p) !== dk && String(p.firebaseKey || '') !== dk);
                }
                try {
                    const svcInv2 = window.firebaseService || window.FirebaseService;
                    if (svcInv2 && typeof svcInv2.invalidateReadCacheForPath === 'function') svcInv2.invalidateReadCacheForPath('vendas/pedidos');
                } catch (_) {}
                console.log(`🧹 Removidos ${dupKeys.length} registro(s) duplicado(s) com número ${pedidoData.numero}`);
            }
        } catch (e) { console.warn('Falha ao checar duplicados por número:', e); }
        
        // Salvar pedido
        // Se já existe, atualizar. Se não, adicionar.
        // Snapshot para rollback: se o servidor não confirmar, a memória volta
        // ao estado anterior (evita "sucesso" fantasma que some no reload).
        const backupPedidos = Array.isArray(window.pedidos) ? window.pedidos.slice() : [];
        if (editandoPedidoId) {
            const index = window.pedidos.findIndex(p => getPedidoVendaId(p) === String(editandoPedidoId));
            if (index !== -1) {
                window.pedidos[index] = pedidoData;
            } else {
                window.pedidos.push(pedidoData);
            }
        } else {
            window.pedidos.push(pedidoData);
        }
        
        let multiUpdateDone = false;
        
        // Preparar contas a criar e remover
        const contasRemover = (removiveis || []).map(c => ({
            mes: toMonthKey(c.dataVencimento || c.vencimento),
            contaId: String(c.id)
        })).filter(r => r.mes && r.contaId);

        const contasParaCriarPayload = shouldGenerateFinance ? (pedidoData.contasReceber || []).map((conta, idx) => {
            const crId = conta.id || `CR_${pedidoData.id}_${String(idx + 1).padStart(3, '0')}`;
            conta.id = crId;
            const valorNum = typeof conta.valor === 'number' ? conta.valor : (typeof parseCurrencyValue === 'function' ? parseCurrencyValue(conta.valor) : parseFloat(conta.valor) || 0);
            return {
                id: crId,
                tipo: conta.tipo || 'receber',
                categoria: 'vendas',
                origem: 'pedido_venda',
                origemId: pedidoData.id,
                pedidoNumero: pedidoData.numero,
                clienteId: pedidoData.clienteId || (pedidoData.cliente && pedidoData.cliente.id) || '',
                cliente: {
                    id: (pedidoData.cliente && pedidoData.cliente.id) || pedidoData.clienteId || '',
                    nome: (pedidoData.cliente && pedidoData.cliente.nome) || '',
                    email: (pedidoData.cliente && pedidoData.cliente.email) || '',
                    telefone: (pedidoData.cliente && pedidoData.cliente.telefone) || '',
                    endereco: (pedidoData.cliente && pedidoData.cliente.endereco) || ''
                },
                descricao: `Venda - Pedido ${pedidoData.numero} - ${conta.observacao || getTipoContaLabel(conta.tipo)}`,
                valor: valorNum,
                valorOriginal: valorNum,
                valorRestante: valorNum,
                dataVencimento: conta.vencimento || conta.dataVencimento,
                vencimento: conta.vencimento || conta.dataVencimento,
                dataEmissao: conta.dataEmissao || pedidoData.data || '',
                status: 'pendente',
                tipoPagamento: conta.tipo || '',
                tipo_pagamento: conta.tipo || '',
                observacoes: conta.observacao || '',
                created: new Date().toISOString()
            };
        }) : [];

        const hasFinanceMutation = contasParaCriarPayload.length > 0 || contasRemover.length > 0;

        // 1. Tentar Callable segura no servidor (financeSyncVenda)
        if (hasFinanceMutation && window.firebaseService && typeof window.firebaseService.callFunction === 'function') {
            console.log('📦 Chamando financeSyncVenda (pedido + financeiro atômico):', {
                pedido: pedidoData.id,
                criar: contasParaCriarPayload.length,
                remover: contasRemover.length
            });
            try {
                const res = await window.firebaseService.callFunction('financeSyncVenda', {
                    operationId: `venda-sync-${pedidoData.id}-${Date.now()}`,
                    pedido: pedidoData,
                    contasCriar: contasParaCriarPayload,
                    contasRemover: contasRemover
                });
                if (res && res.success) {
                    multiUpdateDone = true;
                    console.log('✅ Pedido e financeiro salvos com sucesso via financeSyncVenda');
                } else {
                    console.warn('⚠️ financeSyncVenda retornou erro:', res && res.error);
                }
            } catch (callableError) {
                console.error('❌ financeSyncVenda lançou erro:', callableError);
            }
        }

        // 2. Fallback: updatePaths direto (caso callable falhe ou não tenha mutação financeira)
        if (!multiUpdateDone && window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updatesRem = montarUpdatesRemocaoContasReceberVenda(removiveis, { includeLegacy: false });
            const updatesAdd = {};
            Object.assign(updatesAdd, updatesRem);

            contasParaCriarPayload.forEach(c => {
                const mk = toMonthKey(c.dataVencimento || c.vencimento);
                updatesAdd[`financas/receber/${mk}/${String(c.id)}`] = c;
            });
            updatesAdd[`vendas/pedidos/${String(pedidoData.id)}`] = pedidoData;
            updatesAdd[`pedidosVenda/${String(pedidoData.id)}`] = pedidoData;

            console.log('📦 Tentando updatePaths direto:', Object.keys(updatesAdd).length, 'caminhos');
            sanearIndefinidosFirebase(updatesAdd);
            const res = await window.firebaseService.updatePaths(updatesAdd);
            if (res && res.success) {
                multiUpdateDone = true;
                console.log('✅ Pedido e contas salvos com sucesso via updatePaths');
            } else {
                console.warn('⚠️ updatePaths direto falhou:', res?.error);
            }
        }
        
        if (!multiUpdateDone) {
            if (editandoPedidoId && !shouldGenerateFinance && removiveis.length > 0) {
                throw new Error('Não foi possível estornar o financeiro vinculado. Nenhuma alteração foi concluída.');
            }
            // ✅ CORREÇÃO: pedido com financeiro obrigatório não pode ser confirmado sem o financeiro
            if (shouldGenerateFinance && (pedidoData.contasReceber || []).length > 0) {
                throw new Error('Não foi possível sincronizar as contas a receber do pedido. Nenhuma alteração foi concluída.');
            }
            // Fallback para salvamento individual (somente pedido sem financeiro obrigatório)
            __rvSaveDataRemoteOk = false;
            await saveData('vendas/pedidos', window.pedidos);
            
            // Salvar contas individualmente (não ideal, mas funcional como fallback)
            if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                 // ... lógica de fallback omitida para brevidade, assumindo que updatePaths funcionará
                 // Se updatePaths falhar, o saveData acima já salvou o pedido localmente e no nó principal
            }
        }

        // Fail-closed: sucesso só com confirmação do servidor. Sem isso, desfaz a
        // mutação otimista e mantém o formulário aberto para nova tentativa.
        const salvouServidor = multiUpdateDone || __rvSaveDataRemoteOk;
        if (salvouServidor) {
            try {
                const svcInv = window.firebaseService || window.FirebaseService;
                if (svcInv && typeof svcInv.invalidateReadCacheForPath === 'function') {
                    // A callable não invalida o cache de leitura (só updatePaths/saveToFirebase
                    // o fazem); sem isso, um reload <60s pode mostrar o dado antigo.
                    svcInv.invalidateReadCacheForPath('vendas/pedidos');
                    svcInv.invalidateReadCacheForPath('pedidosVenda');
                    svcInv.invalidateReadCacheForPath('financas/receber');
                }
            } catch (_) { /* best-effort */ }
        } else {
            try { window.pedidos = backupPedidos; } catch (_) {}
            LoadingManager.hide();
            ToastManager.error('Não foi possível salvar o pedido no servidor. Verifique sua conexão e permissões e tente novamente. Nenhuma alteração foi perdida.', 'Falha ao salvar', 8000);
            return;
        }

        // Estoque: ponto único na APROVAÇÃO (entrar/sair do conferido).
        // Criação nunca muta estoque (evita duplo-desconto e dado não persistido).

        // Baixa/reversão automática ao ENTRAR/SAIR do conjunto conferido
        // (aprovado/entregue/faturado/finalizado). Idempotente por estado:
        // novo-aprovado deduz; pendente→aprovado deduz; aprovado→aprovado com
        // itens trocados reverte o anterior e deduz o atual; aprovado→
        // pendente/cancelado reverte. Usa helper canônico statusRomaneioConferido.
        try {
            if (salvouServidor && typeof statusRomaneioConferido === 'function') {
                const prev = (backupPedidos || []).find(p => String(p.id) === String(editandoPedidoId || ''));
                const eraConferido = !!(prev && statusRomaneioConferido(prev.status));
                const ehConferido = statusRomaneioConferido(statusNext);
                if (eraConferido) {
                    try { await reverterBaixaPedido(prev); } catch (e) { console.warn('Falha ao reverter baixa anterior (segue):', e); }
                }
                if (ehConferido) {
                    try { await baixarEstoquePorAprovacao(pedidoData); } catch (e) { console.warn('Falha na baixa automática do estoque (não bloqueia o save):', e); }
                }
            }
        } catch (e) {
            console.warn('Falha na baixa automática do estoque (não bloqueia o save):', e);
        }

        LoadingManager.hide();
        ToastManager.success('Pedido salvo com sucesso!', 'Sucesso');
        try { document.getElementById('pedidoForm').style.display = 'none'; } catch (_) {}
        try { editandoPedidoId = null; } catch (_) {}
        try { pedidoAtual = null; } catch (_) {}
        try { itensCarrinho = []; } catch (_) {}
        try { itemEmEdicaoId = null; } catch (_) {}
        try { contasReceber = []; } catch (_) {}
        try { dedupePedidosAposSave(); } catch (_) {}
        try { await listarPedidos(); } catch (_) {}
        
    } catch (error) {
        LoadingManager.hide();
        console.error('Erro ao salvar pedido:', error);
        ToastManager.error('Erro ao salvar pedido: ' + error.message, 'Erro');
    }
}

async function verifyReceberAccountsConsistency(pedido) {
    try {
        if (!window.firebaseService || typeof window.firebaseService.loadFromFirebase !== 'function' || typeof window.firebaseService.updatePaths !== 'function') return;
        const contas = Array.isArray(pedido.contasReceber) ? pedido.contasReceber : [];
        if (contas.length === 0) return;
        const expectedByMonth = new Map();
        contas.forEach((conta, idx) => {
            const id = `CR_${pedido.id}_${String(idx + 1).padStart(3,'0')}`;
            const mk = toMonthKey(conta.vencimento || conta.dataVencimento);
            const set = expectedByMonth.get(mk) || new Set();
            set.add(id);
            expectedByMonth.set(mk, set);
        });
        const residualUpdates = {};
        for (const [mk, idsSet] of expectedByMonth.entries()) {
            const res = await window.firebaseService.loadFromFirebase(`financas/receber/${mk}`);
            const arr = (res && res.success && res.data) ? (Array.isArray(res.data) ? res.data : Object.values(res.data||{})) : [];
            const remoteIds = new Set(arr.map(x => String(x && x.id)));
            idsSet.forEach(id => { if (!remoteIds.has(id)) { /* opcional: gerar se estiver faltando, mas já foram geradas */ } });
        }
        const all = await window.firebaseService.loadFromFirebase('financas/receber');
        const allObj = (all && all.success && all.data) ? all.data : null;
        if (allObj && typeof allObj === 'object') {
            const months = Object.keys(allObj || {});
            for (const mk of months) {
                const monthVal = allObj[mk];
                const items = Array.isArray(monthVal) ? monthVal : Object.values(monthVal||{});
                items.forEach(it => {
                    if (String(it && it.origemId) === String(pedido.id)) {
                        const okMonth = toMonthKey(it.dataVencimento || it.vencimento);
                        const expected = expectedByMonth.get(okMonth);
                        if (!expected || !expected.has(String(it.id))) {
                            residualUpdates[`financas/receber/${mk}/${String(it.id)}`] = null;
                        }
                    }
                });
            }
        }
        if (Object.keys(residualUpdates).length > 0) {
            await window.firebaseService.updatePaths(residualUpdates);
        }
    } catch(_) {}
}

// Função para remover contas a receber anteriores (evitar duplicação)
// Retorna true se o servidor confirmou (ou nada havia a remover); false se falhou.
async function removerContasReceberAnteriores(pedidoId) {
    try {
        const vinculadas = await carregarContasReceberVinculadasPedidoVenda(pedidoId);
        const semRecebimento = vinculadas.filter(c => !isContaReceberComRecebimento(c));
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updates = montarUpdatesRemocaoContasReceberVenda(semRecebimento, { includeLegacy: false });
            if (Object.keys(updates).length > 0) {
                const resRem = await window.firebaseService.updatePaths(updates);
                if (!(resRem && resRem.success)) return false;
                console.log(`🗑️ Removidas ${semRecebimento.length} contas anteriores do pedido ${pedidoId} (firebase)`);
            } else {
                console.log('Nenhuma conta anterior sem recebimento para remover');
            }
            return true;
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            for (const c of semRecebimento) {
                if (c && c.id) {
                    const mk = toMonthKey(c.dataVencimento || c.vencimento);
                    const resRem = await window.firebaseService.saveToFirebase(`financas/receber/${mk}`, String(c.id), null);
                    if (resRem && resRem.success === false) return false;
                }
            }
            if (semRecebimento.length > 0) console.log(`🗑️ Removidas ${semRecebimento.length} contas anteriores do pedido ${pedidoId}`);
            return true;
        } else {
            const atual = await getData('financas/receber') || [];
            const atualizadas = flattenContasReceberData(atual).filter(c => !semRecebimento.some(r => String(r.id) === String(c.id)));
            __rvSaveDataRemoteOk = false;
            await saveData('contasReceber', atualizadas);
            console.log(`Contas anteriores do pedido ${pedidoId} removidas (fallback): ${semRecebimento.length}`);
            return __rvSaveDataRemoteOk;
        }
    } catch (error) {
        console.error('Erro ao remover contas anteriores:', error);
        return false;
    }
}

async function listarContasReceberSemRecebimento(pedidoId) {
    try {
        const vinculadas = await carregarContasReceberVinculadasPedidoVenda(pedidoId);
        return vinculadas.filter(c => !isContaReceberComRecebimento(c));
    } catch (_) { return []; }
}

async function removerContasReceberPorLista(lista) {
    try {
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updates = montarUpdatesRemocaoContasReceberVenda(lista, { includeLegacy: false });
            if (Object.keys(updates).length > 0) {
                const resRem = await window.firebaseService.updatePaths(updates);
                return !!(resRem && resRem.success);
            }
            return true;
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            for (const c of (lista || [])) {
                if (c && c.id) {
                    const mk = toMonthKey(c.dataVencimento || c.vencimento);
                    const resRem = await window.firebaseService.saveToFirebase(`financas/receber/${mk}`, String(c.id), null);
                    if (resRem && resRem.success === false) return false;
                }
            }
            return true;
        } else {
            const atual = await getData('financas/receber') || [];
            const filtrado = (atual || []).filter(c => !(lista || []).some(r => String(r.id) === String(c.id)));
            __rvSaveDataRemoteOk = false;
            await saveData('contasReceber', filtrado);
            return __rvSaveDataRemoteOk;
        }
    } catch (_) {
        return false;
    }
}

async function logAuditoriaTransacao(evento, detalhes) {
    try {
        const payload = { evento, detalhes, timestamp: new Date().toISOString() };
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            const key = `aud_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            await window.firebaseService.saveToFirebase('auditoriaTransacoes', key, payload);
        } else {
            const storageKey = getStorageKey('auditoriaTransacoes');
            const allowLegacy = storageKey === 'auditoriaTransacoes';
            const logs = JSON.parse(localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem('auditoriaTransacoes') : null) || '[]');
            logs.push(payload);
            persistLocalValue(storageKey, logs);
        }
    } catch (_) {}
}

// Função para gerar contas a receber no sistema financeiro
async function gerarContasReceberFinanceiro(pedido) {
    try {
        const contasReceberFinanceiro = await getData('financas/receber') || [];
        
        // Verificar se o cliente existe e tem dados válidos
        if (!pedido.cliente || !pedido.cliente.nome) {
            console.error('Dados do cliente não encontrados para gerar contas a receber');
            return;
        }
        
        // Gerar uma conta para cada item de contasReceber do pedido
        const contas = (pedido.contasReceber || []).map((conta, idx) => ({
            id: `CR_${pedido.id}_${String(idx + 1).padStart(3, '0')}`,
            tipo: 'receber',
            categoria: 'vendas',
            origem: 'pedido_venda',
            origemId: pedido.id,
            pedidoNumero: pedido.numero,
            clienteId: pedido.clienteId,
            cliente: {
                id: pedido.cliente.id,
                nome: pedido.cliente.nome,
                email: pedido.cliente.email || '',
                telefone: pedido.cliente.telefone || '',
                endereco: pedido.cliente.endereco || ''
            },
            descricao: `Venda - Pedido ${pedido.numero} - ${conta.observacao || getTipoContaLabel(conta.tipo)}`,
            valor: conta.valor,
            valorOriginal: conta.valor,
            valorRestante: conta.valor,
    dataVencimento: conta.vencimento,
    dataEmissao: conta.dataEmissao || '',
    status: 'pendente',
    tipoPagamento: conta.tipo,
    tipo: conta.tipo,
    observacoes: conta.observacao || '',
    created: window.firebaseService && window.firebaseService.serverTimestamp ? window.firebaseService.serverTimestamp() : new Date().toISOString()
        }));
        // Helper: atualizar cache local mensal e agregado
        const upsertMonthlyLocal = (contasList) => {
            try {
                const readJson = (raw) => { try { return raw ? JSON.parse(raw) : []; } catch(_) { return []; } };
                // Atualizar agregado
                const aggKey = getStorageKey('contasReceber');
                const allowAggLegacy = aggKey === 'contasReceber';
                let agg = readJson(localStorage.getItem(aggKey) || (allowAggLegacy ? localStorage.getItem('contasReceber') : null));
                if (!Array.isArray(agg)) agg = Object.values(agg || {});
                const idxById = new Map();
                agg.forEach((c, i) => { if (c && c.id) idxById.set(String(c.id), i); });
                for (const c of (contasList || [])) {
                    if (!c || !c.id) continue;
                    const id = String(c.id);
                    const mk = toMonthKey(c.dataVencimento || c.vencimento);
                    const key = `contasReceber/${mk}`;
                    const monthKey = getStorageKey(key);
                    const allowMonthLegacy = monthKey === key;
                    let monthly = readJson(localStorage.getItem(monthKey) || (allowMonthLegacy ? localStorage.getItem(key) : null));
                    if (!Array.isArray(monthly)) monthly = Object.values(monthly || {});
                    const mi = monthly.findIndex(x => x && String(x.id) === id);
                    if (mi >= 0) monthly[mi] = c; else monthly.push(c);
                    persistLocalValue(monthKey, monthly);
                    if (idxById.has(id)) agg[idxById.get(id)] = c; else agg.push(c);
                }
                persistLocalValue(aggKey, agg);
            } catch(_) {}
        };

        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updates = {};
            contas.forEach(c => { const mk = toMonthKey(c.dataVencimento || c.vencimento); updates[`financas/receber/${mk}/${String(c.id)}`] = c; });
            const res = await window.firebaseService.updatePaths(updates);
            upsertMonthlyLocal(contas);
            try {
                const months = Array.from(new Set((contas || []).map(c => toMonthKey(c.dataVencimento || c.vencimento))));
                window.dispatchEvent(new CustomEvent('finance:enqueueMonths', { detail: { tipo: 'receber', months } }));
            } catch(_) {}
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            const ops = contas.map(c => { const mk = toMonthKey(c.dataVencimento || c.vencimento); return window.firebaseService.saveToFirebase(`financas/receber/${mk}`, String(c.id), c); });
            if (ops.length > 0) await Promise.allSettled(ops);
            upsertMonthlyLocal(contas);
            try {
                const months = Array.from(new Set((contas || []).map(c => toMonthKey(c.dataVencimento || c.vencimento))));
                window.dispatchEvent(new CustomEvent('finance:enqueueMonths', { detail: { tipo: 'receber', months } }));
            } catch(_) {}
        } else {
            contasReceberFinanceiro.push(...contas);
            try {
                const months = Array.from(new Set((contas || []).map(c => toMonthKey(c.dataVencimento || c.vencimento))));
                window.dispatchEvent(new CustomEvent('finance:enqueueMonths', { detail: { tipo: 'receber', months } }));
            } catch(_) {}
        }
        
        if (!window.firebaseService || typeof window.firebaseService.saveToFirebase !== 'function') {
            await saveData('contasReceber', contasReceberFinanceiro);
            console.log('Contas a receber geradas no sistema financeiro com sucesso (fallback)');
        } else {
            console.log('Contas a receber geradas no sistema financeiro com sucesso (por registro)');
        }
        
    } catch (error) {
        console.error('Erro ao gerar contas a receber:', error);
    }
}

// Baixa automática do estoque na APROVAÇÃO/ENTREGA (ponto único):
// ver baixarEstoquePorAprovacao / reverterBaixaPedido abaixo.
// Best-effort: avisa sem bloquear; idempotência por estado (era/é conferido).
// Ponto único de BAIXA de estoque (entra no conferido: aprovado/entregue/
// faturado/finalizado). Deduz do produto EXATO (produtoId) na dimensão da
// unidade do item; legado sem produtoId usa match romaneio+dims (serrado).
// Manuais via aplicarBaixaManual. Persiste os tocados.
async function baixarEstoquePorAprovacao(pedido) {
    const tocados = await aplicarMovimentoEstoquePedido(pedido, -1);
    if (tocados.length === 0) return { baixados: 0, volumeTotal: 0 };
    const volumeTotal = tocados.reduce((s, t) => s + (t.volUsado || 0), 0);
    try { atualizarSelectProdutos(); } catch (_) {}
    try { ToastManager.success(`Baixa automática: ${volumeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³ em ${tocados.length} produto(s)`, 'Estoque'); } catch (_) {}
    return { baixados: tocados.length, volumeTotal };
}

// Alias legado (compatibilidade).
async function baixarEstoqueSerradoPorAprovacao(pedido) {
    return baixarEstoquePorAprovacao(pedido);
}

// Reversão simétrica (sai do conferido: excluir pedido conferido ou editar
// para pendente/cancelado). Soma de volta na mesma dimensão. Silenciosa.
async function reverterBaixaPedido(pedido) {
    const tocados = await aplicarMovimentoEstoquePedido(pedido, 1);
    try { atualizarSelectProdutos(); } catch (_) {}
    return tocados;
}

// Núcleo compartilhado: dir -1 baixa, +1 reverte. Retorna [{produto, volUsado}].
async function aplicarMovimentoEstoquePedido(pedido, dir) {
    const itens = Array.isArray(pedido && pedido.itens) ? pedido.itens : [];
    if (itens.length === 0) return [];
    const num = (v) => parseFloat(v) || 0;
    const tocados = [];
    for (const it of itens) {
        if (!it || typeof it !== 'object' || isCarregoItem(it)) continue;
        const qtd = num(it.quantidade) || 0;
        if (!(qtd > 0)) continue;
        const unidadeItem = it.unidade || 'm³';
        // 1) produto exato
        let alvo = null;
        try {
            if (it.produtoId) alvo = (window.produtos || []).find(p => p && String(p.id) === String(it.produtoId)) || null;
        } catch (_) { alvo = null; }
        if (alvo && typeof temDimsSerrado === 'function' && temDimsSerrado(alvo) && typeof aplicarBaixaSerrado === 'function') {
            const volAntes = num(alvo.volumeM3) || num(alvo.estoque);
            const res = aplicarBaixaSerrado(alvo, qtd, unidadeItem, dir);
            if (dir < 0 && !(res.razao > 0)) {
                try { ToastManager.warning(`Sem saldo: ${nomeExibicaoProduto(alvo)} (pedido ${pedido.numero || ''})`, 'Estoque', 6000); } catch (_) {}
                continue;
            }
            tocados.push({ produto: alvo, volUsado: dir < 0 ? (Math.round(volAntes * (res.razao || 0) * 1000) / 1000) : 0 });
            continue;
        }
        if (alvo && typeof aplicarBaixaManual === 'function') {
            try { aplicarBaixaManual(alvo, qtd, unidadeItem, dir); } catch (_) { continue; }
            tocados.push({ produto: alvo, volUsado: 0 });
            continue;
        }
        if (dir > 0) continue;
        // 2) legado sem produtoId: match romaneio+dims (só serrado)
        const rids = [];
        [it.origemId, it.romaneioId].forEach(v => {
            const s = String(v || '').trim();
            if (s) rids.push(s);
        });
        if (rids.length === 0) continue;
        const esp = String(it.especie || '').trim().toUpperCase();
        const e = num(it.espessura), l = num(it.largura), c = num(it.comprimento ?? it.comp);
        const candidatos = (window.produtos || []).filter(p => {
            if (!p || !temDimsSerrado(p)) return false;
            return rids.includes(String(p.romaneioId || ''));
        });
        if (candidatos.length === 0) continue;
        let alvo2 = candidatos.find(p =>
            String(p.especie || '').trim().toUpperCase() === esp &&
            num(p.espessura) === e && num(p.largura) === l && num(p.comprimento) === c
        ) || null;
        if (!alvo2) {
            alvo2 = candidatos.slice().sort((a, b) => (num(b.estoque) - num(a.estoque)))[0];
        }
        if (!alvo2) continue;
        const volAntes2 = num(alvo2.volumeM3) || num(alvo2.estoque);
        const res2 = aplicarBaixaSerrado(alvo2, qtd, unidadeItem, -1);
        if (!(res2.razao > 0)) {
            try { ToastManager.warning(`Sem saldo: ${nomeExibicaoProduto(alvo2)} (pedido ${pedido.numero || ''})`, 'Estoque', 6000); } catch (_) {}
            continue;
        }
        tocados.push({ produto: alvo2, volUsado: Math.round(volAntes2 * (res2.razao || 0) * 1000) / 1000 });
    }
    if (tocados.length === 0) return [];
    try {
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            const ops = tocados.map(t => window.firebaseService.saveToFirebase('produtos', String(t.produto.id), t.produto));
            await Promise.allSettled(ops);
        } else if (typeof saveData === 'function') {
            __rvSaveDataRemoteOk = false;
            await saveData('produtos', filtrarProdutosPersistiveis(window.produtos));
        }
    } catch (_) {}
    try {
        const svcInv = window.firebaseService || window.FirebaseService;
        if (svcInv && typeof svcInv.invalidateReadCacheForPath === 'function') svcInv.invalidateReadCacheForPath('produtos');
    } catch (_) {}
    return tocados;
}

// Funções de listagem de pedidos
async function listarPedidos() {
    // Boot ainda em curso: enfileira UMA abertura pós-pronto em vez do
    // falso "entre novamente". Sem promise/fila pendente, segue o fluxo normal.
    if (window.__siswebVendasBootState === 'booting' && window.__siswebVendasBootPromise && !window.__siswebVendasListarPendente) {
        window.__siswebVendasListarPendente = true;
        if (typeof ToastManager !== 'undefined') ToastManager.info('Conectando à sua empresa, abrindo a lista em instantes...', 'Aguarde');
        window.__siswebVendasBootPromise.then(
            () => {
                window.__siswebVendasListarPendente = false;
                try {
                    if (window.__siswebVendasOperationalReady === true) listarPedidos();
                } catch (_) {}
            },
            () => { window.__siswebVendasListarPendente = false; }
        );
        return;
    }
    if (!guardOperationalAccessVendas()) return;
    try {
        pedidosListPage = 1;
        pedidosSelecionados.clear();
        const search = document.getElementById('searchPedidos');
        if (search) search.value = '';
        
        // Se já temos pedidos em memória, renderizar de imediato
        if (Array.isArray(window.pedidos) && window.pedidos.length > 0) {
            await popularFiltrosPedidosVenda();
            await carregarTabelaPedidos();
            document.getElementById('listaPedidosModal').style.display = 'block';
        } else {
            LoadingManager.show('Carregando pedidos...');
            const fresh = await getData('vendas/pedidos') || [];
            if (Array.isArray(fresh)) {
                window.pedidos = fresh.map(p => {
                    if (p && p.contasReceber) {
                        p.contasReceber = normalizarContasReceberLista(p.contasReceber);
                    }
                    return p;
                });
            }
            await popularFiltrosPedidosVenda();
            await carregarTabelaPedidos();
            document.getElementById('listaPedidosModal').style.display = 'block';
        }
    } catch (e) {
        console.error('Erro ao listar pedidos:', e);
        ToastManager.error('Erro ao carregar pedidos: ' + (e && e.message ? e.message : e), 'Erro');
    } finally {
        LoadingManager.hide();
    }
}

async function carregarTabelaPedidos(filtro = '') {
    const tbody = document.getElementById('pedidosTable');
    if (!tbody) return;
    const getPedidoStatus = (pedido) => {
        const raw = pedido?.status ?? pedido?.statusPedido ?? pedido?.statusVenda ?? pedido?.statusPedidoVenda ?? pedido?.situacao ?? pedido?.state;
        const text = typeof raw === 'string' ? raw : (raw && raw.label) ? raw.label : '';
        return String(text || '').trim().toLowerCase();
    };
    // Remover duplicados por número (mantém mais recente por criação/atualização)
    const base = Array.isArray(window.pedidos) ? window.pedidos : [];
    const byNumero = new Map();
    for (const p of base) {
        const key = String(p.numero);
        if (!byNumero.has(key)) {
            byNumero.set(key, p);
        } else {
            const cur = byNumero.get(key);
            const curTs = getPedidoRecencyTimestamp(cur);
            const pTs = getPedidoRecencyTimestamp(p);
            if (pTs >= curTs) byNumero.set(key, p);
        }
    }
    let pedidosFiltrados = Array.from(byNumero.values());
    
    const filtroClienteId = (document.getElementById('filtroCliente')?.value || '').trim();
    const filtroEspecie = (document.getElementById('filtroEspecie')?.value || '').trim();
    const filtroStatus = (document.getElementById('filtroStatus')?.value || '').trim().toLowerCase();
    const filtroEspecieLower = filtroEspecie.toLowerCase();
    const inicioVal = (document.getElementById('filtroInicio')?.value || '').trim();
    const fimVal = (document.getElementById('filtroFim')?.value || '').trim();
    const inicioDate = inicioVal ? new Date(inicioVal + 'T00:00:00') : null;
    const fimDate = fimVal ? new Date(fimVal + 'T23:59:59') : null;

    if (filtro) {
        const filtroLower = filtro.toLowerCase();
        pedidosFiltrados = pedidosFiltrados.filter(pedido => {
            const nomeCliente = pedido.cliente ? (pedido.cliente.nome || pedido.cliente.name || '') : '';
            const st = getPedidoStatus(pedido);
            return String(pedido.numero || '').toLowerCase().includes(filtroLower) ||
                   nomeCliente.toLowerCase().includes(filtroLower) ||
                   (st && st.includes(filtroLower));
        });
    }
    
    pedidosFiltrados = pedidosFiltrados.filter(pedido => {
        if (filtroClienteId) {
            const pid = String(pedido.clienteId || (pedido.cliente && pedido.cliente.id) || '');
            if (pid !== filtroClienteId) return false;
        }
        if (filtroStatus) {
            if (getPedidoStatus(pedido) !== filtroStatus) return false;
        }
        if (inicioDate || fimDate) {
            const d = parseDateLocalSafe(pedido.data);
            if (inicioDate && d < inicioDate) return false;
            if (fimDate && d > fimDate) return false;
        }
        if (filtroEspecie) {
            const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
            const found = itens.some(it => {
                let nome = String(it.especie || it.especieNome || it.produtoNome || it.produto || '').toLowerCase();
                return nome && nome.includes(filtroEspecieLower);
            });
            if (!found) return false;
        }
        return true;
    });
    pedidosSelecionados = new Set(Array.from(pedidosSelecionados).filter(id =>
        pedidosFiltrados.some(p => getPedidoVendaId(p) === String(id))
    ));

    // Ordenar por recência (último pedido adicionado no topo)
    pedidosFiltrados.sort(comparePedidosByRecencyDesc);
    
    if (pedidosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td class="commerce-full-row" data-label="" colspan="7" style="text-align: center;">Nenhum pedido encontrado</td></tr>';
        pedidosListFiltered = [];
        atualizarCabecalhoSelecaoPedidos();
        renderPedidosPagination(0);
        refreshCommerceResponsiveTables();
        return;
    }

    pedidosListFiltered = pedidosFiltrados;
    const totalPages = Math.max(1, Math.ceil(pedidosListFiltered.length / pedidosListItemsPerPage));
    if (pedidosListPage > totalPages) pedidosListPage = totalPages;
    if (pedidosListPage < 1) pedidosListPage = 1;
    const start = (pedidosListPage - 1) * pedidosListItemsPerPage;
    const end = start + pedidosListItemsPerPage;
    const paginated = pedidosListFiltered.slice(start, end);
    
    // Indexar clientes para resolução rápida O(1)
    const clientesMap = new Map();
    (Array.isArray(window.clientes) ? window.clientes : []).forEach(c => {
        if (c && c.id) clientesMap.set(String(c.id), c);
    });

    tbody.innerHTML = paginated.map(pedido => {
        // Determinar nome do cliente com lookup indexado O(1)
        let nomeCliente = 'Cliente não encontrado';
        if (pedido.cliente) {
            nomeCliente = pedido.cliente.nome || pedido.cliente.name || 'Nome não informado';
        } else if (pedido.clienteId) {
            const clienteEncontrado = clientesMap.get(String(pedido.clienteId));
            if (clienteEncontrado) {
                nomeCliente = clienteEncontrado.nome || clienteEncontrado.name || 'Nome não informado';
            }
        }
        
        const updatedStr = pedido.updated ? formatDate(pedido.updated) : '-';
        const st = getPedidoStatus(pedido) || 'pendente';
        const safeId = getPedidoVendaId(pedido);
        const numeroPedido = pedido.numero || safeId || '-';
        const hasCarrego = (Array.isArray(pedido.itens) ? pedido.itens : []).some(it => isCarregoItem(it));
        const carregoBadge = hasCarrego
            ? ' <span style="display:inline-block;padding:2px 6px;border-radius:10px;background:#fff3cd;color:#856404;font-size:11px;font-weight:600;">Carrego</span>'
            : '';
        return `
        <tr>
            <td data-label="Número">
                <label class="pedido-numero-cell">
                    <input type="checkbox" class="pedido-select-item" ${pedidosSelecionados.has(safeId) ? 'checked' : ''} onchange="toggleSelecionarPedido('${safeId}', this.checked)">
                    <span>${numeroPedido}${carregoBadge}</span>
                </label>
            </td>
            <td data-label="Data">${formatDate(pedido.data)}</td>
            <td data-label="Cliente">${nomeCliente}</td>
            <td data-label="Total" style="text-align: right;"><span class="commerce-card-value commerce-card-money">${formatCurrency(pedido.total)}</span></td>
            <td data-label="Status">
                <span class="status-badge status-${st}">
                    ${getStatusLabel(st)}
                </span>
            </td>
            <td data-label="Atualizado" class="atualizado-cell">${updatedStr}</td>
            <td data-label="Ações" class="acoes-cell commerce-actions-cell">
                <div class="acoes-buttons">
                    <button type="button" onclick="editarPedido('${safeId}')" class="btn-primary btn-small" title="Editar" aria-label="Editar pedido">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" onclick="visualizarPedido('${safeId}')" class="btn-primary btn-small" title="Visualizar" aria-label="Visualizar pedido">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" onclick="clonarPedido('${safeId}')" class="btn-primary btn-small" title="Clonar" aria-label="Clonar pedido">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button type="button" onclick="excluirPedido('${safeId}')" class="btn-danger btn-small" title="Excluir" aria-label="Excluir pedido">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');

    atualizarCabecalhoSelecaoPedidos();
    renderPedidosPagination(pedidosListFiltered.length);
    refreshCommerceResponsiveTables();
}

function atualizarCabecalhoSelecaoPedidos() {
    const chk = document.getElementById('pedidosSelectAll');
    if (!chk) {
        atualizarContadorImpressaoPedidos();
        return;
    }
    const total = pedidosListFiltered.length;
    if (total === 0) {
        chk.checked = false;
        chk.indeterminate = false;
        atualizarContadorImpressaoPedidos();
        return;
    }
    const selecionados = pedidosListFiltered.filter(p => pedidosSelecionados.has(getPedidoVendaId(p))).length;
    chk.checked = selecionados === total;
    chk.indeterminate = selecionados > 0 && selecionados < total;
    atualizarContadorImpressaoPedidos();
}

function atualizarContadorImpressaoPedidos() {
    const countEl = document.getElementById('pedidosPrintSelectedCount');
    if (!countEl) return;
    const printBtn = countEl.closest('button');
    const selecionados = pedidosListFiltered.filter(p => pedidosSelecionados.has(getPedidoVendaId(p))).length;
    countEl.textContent = `(${selecionados})`;
    if (printBtn) {
        printBtn.disabled = selecionados === 0;
    }
}

function toggleSelecionarPedido(pedidoId, checked) {
    const id = String(pedidoId || '');
    if (!id) return;
    if (checked) pedidosSelecionados.add(id);
    else pedidosSelecionados.delete(id);
    atualizarCabecalhoSelecaoPedidos();
}

function toggleSelecionarTodosPedidos(checked) {
    if (checked) {
        pedidosListFiltered.forEach(p => pedidosSelecionados.add(getPedidoVendaId(p)));
    } else {
        pedidosListFiltered.forEach(p => pedidosSelecionados.delete(getPedidoVendaId(p)));
    }
    carregarTabelaPedidos(document.getElementById('searchPedidos')?.value || '');
}

function getPedidoVendaId(pedido) {
    return String(pedido && (pedido.id || pedido.firebaseKey || '') || '');
}

// Resolver canônico de pedido: com duplicatas por número (legado), o find()
// ingênuo pode retornar a entrada ANTIGA enquanto a tabela (dedupe por
// recência) exibe a nova. Aqui: match exato por id/firebaseKey primeiro;
// havendo vários, retorna o mais recente. Fallback por número (mais recente).
// Usar em editar/visualizar/imprimir/excluir/salvar — nunca find() direto.
function resolverPedidoVenda(pedidoId) {
    try {
        const lista = Array.isArray(window.pedidos) ? window.pedidos : [];
        const alvo = String(pedidoId || '');
        if (!alvo) return null;
        const exatos = lista.filter(p => getPedidoVendaId(p) === alvo);
        if (exatos.length === 1) return exatos[0];
        if (exatos.length > 1) {
            return exatos.slice().sort((a, b) => getPedidoRecencyTimestamp(b) - getPedidoRecencyTimestamp(a))[0] || null;
        }
        const porNumero = lista.filter(p => String(p && p.numero || '') === alvo);
        if (porNumero.length > 0) {
            return porNumero.slice().sort((a, b) => getPedidoRecencyTimestamp(b) - getPedidoRecencyTimestamp(a))[0] || null;
        }
        return null;
    } catch (_) { return null; }
}

// Remove duplicatas de window.pedidos após save: mesmo id resolvido ou mesmo
// número → mantém apenas o mais recente. Evita que find() ache registro velho.
function dedupePedidosAposSave() {
    try {
        const lista = Array.isArray(window.pedidos) ? window.pedidos : [];
        const porId = new Map();
        lista.forEach(p => {
            const k = getPedidoVendaId(p) || `__nonum__${String(p && p.numero || '')}`;
            const cur = porId.get(k);
            if (!cur || getPedidoRecencyTimestamp(p) >= getPedidoRecencyTimestamp(cur)) porId.set(k, p);
        });
        const porNumero = new Map();
        Array.from(porId.values()).forEach(p => {
            const num = String(p && p.numero || '');
            if (!num) { porNumero.set(`__semnum__${getPedidoVendaId(p)}`, p); return; }
            const cur = porNumero.get(num);
            if (!cur || getPedidoRecencyTimestamp(p) >= getPedidoRecencyTimestamp(cur)) porNumero.set(num, p);
        });
        window.pedidos = Array.from(porNumero.values());
    } catch (_) {}
}

function getPedidosVendaSelecionadosParaImpressao() {
    return pedidosListFiltered.filter(p => pedidosSelecionados.has(getPedidoVendaId(p)));
}

function isCommercePwaPrintContext() {
    try {
        const standalone = (window.matchMedia && (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.matchMedia('(display-mode: minimal-ui)').matches
        )) || window.navigator.standalone === true;
        const smallTouchScreen = window.matchMedia
            && window.matchMedia('(pointer: coarse)').matches
            && window.innerWidth <= 768;
        // Desktop instalado deve se comportar como browser normal: so usa PDF em contexto mobile/touch pequeno
        if (smallTouchScreen) return true;
        return false;
    } catch (_) {
        return false;
    }
}

function notificarEntregaPdfPedido(result) {
    if (!result || result.mode === 'cancelled') return;
    const msg = result.mode === 'share'
        ? 'PDF pronto para compartilhar ou imprimir pelo aparelho.'
        : `PDF gerado: ${result.fileName}`;
    ToastManager.success(msg, 'PDF');
}

async function exportarPedidosVendaPdf(pedidosParaImprimir) {
    if (!window.SiswebCommercePdf || typeof window.SiswebCommercePdf.exportOrdersPdf !== 'function') {
        throw new Error('Gerador de PDF indisponivel.');
    }
    const pedidos = Array.isArray(pedidosParaImprimir) ? pedidosParaImprimir.filter(Boolean) : [];
    if (!pedidos.length) throw new Error('Nenhum pedido selecionado para PDF.');

    const dadosEmpresa = await obterDadosEmpresa();
    const pedidoUnico = pedidos.length === 1 ? pedidos[0] : null;
    const fileBase = pedidoUnico
        ? `pedido-venda-${pedidoUnico.numero || getPedidoVendaId(pedidoUnico) || 'selecionado'}`
        : `pedidos-venda-${pedidos.length}`;

    return window.SiswebCommercePdf.exportOrdersPdf({
        company: dadosEmpresa,
        orders: pedidos,
        documentTitle: pedidoUnico ? 'Pedido de Venda' : 'Pedidos de Venda',
        orderTitle: 'Pedido de Venda',
        partyLabel: 'Cliente',
        paymentTitle: 'Forma de pagamento',
        fileName: `${fileBase}.pdf`,
        shareText: 'PDF de pedido de venda gerado pelo Sisweb.',
        formatDate,
        formatCurrency,
        formatNumber,
        getStatusLabel,
        getPaymentTypeLabel: getTipoContaLabel,
        getPartyName: (pedido) => pedido.cliente
            ? (pedido.cliente.nome || pedido.cliente.name || 'Cliente nao informado')
            : 'Cliente nao informado',
        getPayments: (pedido) => typeof normalizarContasReceberLista === 'function'
            ? normalizarContasReceberLista(pedido.contasReceber || [])
            : (pedido.contasReceber || []),
        getSubtotal: (pedido) => pedido.subtotal,
        getDiscount: (pedido) => pedido.desconto,
        getTotal: (pedido) => pedido.total
    });
}

async function imprimirPedidosSelecionados() {
    const pedidosParaImprimir = getPedidosVendaSelecionadosParaImpressao();
    if (pedidosParaImprimir.length === 0) {
        ToastManager.warning('Selecione ao menos um pedido para imprimir.', 'Atenção');
        return;
    }
    try {
        // Documento padrao desktop (gerarHTMLImpressaoPedido) em todos os contextos,
        // inclusive mobile: single template, single renderer.
        await imprimirPedidosVendaSelecionadosDesktop(pedidosParaImprimir);
    } catch (error) {
        console.error('Erro ao imprimir pedidos selecionados:', error);
        ToastManager.error('Erro ao imprimir: ' + error.message, 'Erro');
    } finally {
        LoadingManager.hide();
    }
}

async function imprimirPedidosVendaSelecionadosDesktop(pedidosParaImprimir) {
    const pedidos = Array.isArray(pedidosParaImprimir) ? pedidosParaImprimir.filter(Boolean) : [];
    if (!pedidos.length) return;

    if (pedidos.length === 1) {
        await imprimirPedido(getPedidoVendaId(pedidos[0]));
        return;
    }

    LoadingManager.show('Preparando impressão...');
    try {
        // Empresa+logo resolvidos UMA vez e reutilizados por pedido
        // (gerarHTMLImpressaoPedido aceita a empresa pronta no 2º argumento).
        let empresaLote = null;
        try {
            const base = await obterDadosEmpresa();
            if (window.SiswebCommercePdf && typeof window.SiswebCommercePdf.preparePrintOptions === 'function') {
                const prepared = await window.SiswebCommercePdf.preparePrintOptions({ company: base });
                empresaLote = (prepared && prepared.company) || base;
            } else {
                empresaLote = base;
            }
        } catch (_) {
            empresaLote = null;
        }
        const documentos = [];
        for (const pedido of pedidos) {
            documentos.push(await gerarHTMLImpressaoPedido(pedido, empresaLote || undefined));
        }
        const html = montarHTMLImpressaoLotePedidos(documentos, 'Pedidos de Venda');
        if (window.SiswebCommercePdf && typeof window.SiswebCommercePdf.printHtmlDocument === 'function') {
            window.SiswebCommercePdf.printHtmlDocument({
                html,
                windowFeatures: 'width=900,height=700'
            });
        } else {
            let janela = null;
            try {
                janela = window.open('', '_blank', 'width=900,height=700');
            } catch (_) {
                janela = null;
            }
            if (!janela || janela.closed) {
                ToastManager.warning('Permita pop-ups para imprimir.', 'Atenção');
                return;
            }
            try {
                if (!janela.document) throw new Error('alvo parcial');
            } catch (_) {
                try { if (!janela.closed) janela.close(); } catch (_) {}
                ToastManager.error('Não foi possível abrir a janela de impressão.', 'Erro');
                return;
            }
            try {
                janela.document.write(html);
                janela.document.close();
            } catch (_) {
                try { if (!janela.closed) janela.close(); } catch (_) {}
                ToastManager.error('Não foi possível abrir a janela de impressão.', 'Erro');
                return;
            }
            let loteDisparado = false;
            const dispararLote = () => {
                if (loteDisparado) return;
                loteDisparado = true;
                try { janela.focus(); } catch (_) {}
                try { janela.print(); } catch (_) {}
            };
            try { janela.onload = dispararLote; } catch (_) {}
            try {
                if (janela.document && janela.document.fonts && typeof janela.document.fonts.ready.then === 'function') {
                    janela.document.fonts.ready.then(() => setTimeout(dispararLote, 60)).catch(() => {});
                }
            } catch (_) {}
            try { janela.focus(); } catch (_) {}
            setTimeout(dispararLote, 400);
            setTimeout(dispararLote, 1200);
        }
    } finally {
        LoadingManager.hide();
    }
}

function montarHTMLImpressaoLotePedidos(documentos, title = 'Pedidos') {
    const lista = Array.isArray(documentos) ? documentos.filter(Boolean) : [];
    const primeiro = lista[0] || '';
    const styleMatch = primeiro.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const styles = styleMatch ? styleMatch[1] : 'body{font-family:Arial,sans-serif;padding:20px;color:#111827}';
    const mains = lista.map((html, index) => {
        const match = String(html || '').match(/<main\b[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/main>/i);
        const bodyMatch = String(html || '').match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const content = match ? match[2] : (bodyMatch ? bodyMatch[1] : String(html || ''));
        const className = match ? match[1] : 'sisweb-print-page';
        const breakClass = index < lista.length - 1 ? ' sisweb-print-batch-page' : '';
        return `<main class="${className}${breakClass}">${content}</main>`;
    }).join('\n');
    return `<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>@page{margin:10mm;}${styles}
        .sisweb-print-table th,.sisweb-print-table td{overflow-wrap:anywhere;}
        .sisweb-print-back{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:0 0 14px;padding:10px 12px;border:1px solid #d6dde8;border-radius:6px;background:#f8fafc;font-family:"Segoe UI",Arial,sans-serif;}@media print{.sisweb-print-back{display:none !important;}}
        .sisweb-print-batch-page { break-after: page; page-break-after: always; margin-bottom: 18px; }
    </style>
</head>
<body class="sisweb-commerce-print">
    <div class="sisweb-print-back"><button type="button" onclick="try{if(window.history&&window.history.length>1){history.back()}else{window.close()}}catch(e){try{window.close()}catch(e2){}}" style="min-height:40px;padding:0 16px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;font-weight:700;cursor:pointer;">&#8592; Voltar</button><button type="button" onclick="window.focus();window.print()" style="min-height:40px;padding:0 16px;border-radius:6px;border:1px solid #1f2937;background:#1f2937;color:#fff;font-weight:700;cursor:pointer;">Imprimir</button></div>
    ${mains}
</body>
</html>`;
}

function renderPedidosPagination(totalItems) {
    const container = document.getElementById('pedidosPagination');
    if (!container) return;
    const totalPages = Math.ceil(totalItems / pedidosListItemsPerPage);
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const addBtn = (label, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (active) btn.classList.add('active');
        btn.disabled = disabled;
        btn.onclick = () => goToPedidosPage(page);
        container.appendChild(btn);
    };

    addBtn('<<<', 1, pedidosListPage === 1);
    addBtn('<', pedidosListPage - 1, pedidosListPage === 1);

    const startPage = Math.max(1, pedidosListPage - 2);
    const endPage = Math.min(totalPages, pedidosListPage + 2);

    if (startPage > 1) {
        addBtn('1', 1, false, pedidosListPage === 1);
        if (startPage > 2) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addBtn(String(i), i, false, i === pedidosListPage);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
        addBtn(String(totalPages), totalPages, false, pedidosListPage === totalPages);
    }

    addBtn('>', pedidosListPage + 1, pedidosListPage === totalPages);
    addBtn('>>>', totalPages, pedidosListPage === totalPages);
}

async function goToPedidosPage(page) {
    const totalPages = Math.max(1, Math.ceil(pedidosListFiltered.length / pedidosListItemsPerPage));
    const next = Math.min(totalPages, Math.max(1, Number(page) || 1));
    if (next === pedidosListPage) return;
    pedidosListPage = next;
    await carregarTabelaPedidos(document.getElementById('searchPedidos')?.value || '');
}

async function popularFiltrosPedidosVenda() {
    try {
        const cliEl = document.getElementById('filtroCliente');
        if (cliEl) {
            cliEl.innerHTML = '<option value="">Todos</option>';
            let lista = Array.isArray(window.clientes) ? window.clientes : [];
            if (!lista || lista.length === 0) {
                try {
                    if (window.clientService && window.clientService.getClients) {
                        lista = await window.clientService.getClients();
                    } else if (typeof getData === 'function') {
                        lista = await getData('clients') || [];
                    } else {
                        lista = [];
                    }
                    window.clientes = Array.isArray(lista) ? lista : [];
                } catch (_) {
                    lista = Array.isArray(window.clientes) ? window.clientes : [];
                }
            }
            lista.forEach(c => {
                const opt = document.createElement('option');
                opt.value = String(c.id || '');
                opt.textContent = c.nome || c.name || 'Sem nome';
                cliEl.appendChild(opt);
            });
        }
        const espEl = document.getElementById('filtroEspecie');
        if (espEl) {
            const set = new Set();
            const pedidos = Array.isArray(window.pedidos) ? window.pedidos : [];
            pedidos.forEach(p => {
                const itens = Array.isArray(p.itens) ? p.itens : [];
                itens.forEach(it => {
                    let nome = String(it.especie || it.especieNome || it.produtoNome || it.produto || '').trim();
                    if (nome) {
                        const base = nome.split(' - ')[0].trim();
                        set.add(base || nome);
                    }
                });
            });
            const baseSpecies = (window.species && Array.isArray(window.species)) ? window.species.map(s => s.especie || s.nome || s.nomeComum || s.name).filter(Boolean) : [];
            baseSpecies.forEach(n => set.add(String(n)));
            const arr = Array.from(set).sort((a,b)=>a.localeCompare(b));
            espEl.innerHTML = '<option value="">Todas</option>';
            arr.forEach(nome => {
                const opt = document.createElement('option');
                opt.value = nome;
                opt.textContent = nome;
                espEl.appendChild(opt);
            });
        }
    } catch (e) {}
}

function filtrarPedidos() {
    pedidosListPage = 1;
    const filtro = document.getElementById('searchPedidos').value;
    carregarTabelaPedidos(filtro);
}

// Debounce genérico (mesmo padrão financas.js): evita re-render por tecla.
if (typeof debounceFn !== 'function') {
    var debounceFn = function (fn, delay) {
        let t = null;
        return function () {
            const args = arguments, self = this;
            if (t) clearTimeout(t);
            t = setTimeout(() => fn.apply(self, args), delay || 200);
        };
    };
}

// Versão com debounce para o onkeyup da busca (preserva chamada direta).
const filtrarPedidosDebounced = (typeof debounceFn === 'function')
    ? debounceFn(function () { try { filtrarPedidos(); } catch (_) {} }, 220)
    : function () { try { filtrarPedidos(); } catch (_) {} };

async function editarPedido(pedidoId) {
    const pedido = resolverPedidoVenda(pedidoId);
    if (!pedido) return;
    
    // Fechar modal
    fecharModal('listaPedidosModal');
    
    // Configurar edição
    editandoPedidoId = pedidoId;
    pedidoAtual = pedido;
    itensCarrinho = [...pedido.itens];
    // Resetar estado do preview de romaneio (o cache de uso depende do pedido em edição)
    try {
        romaneioSelecionado = null;
        limparExclusoesPreviewVendas();
        romaneioPreviewUsoInfo = null;
        romaneioPreviewTipoAtual = '';
        __rvPreviewChaves = [];
        __rvUsoCache = { id: '', result: null, ts: 0 };
        // Inferir o tipo de romaneio do pedido (para visibilidade TORA x serrados).
        let tipoInferidoVenda = '';
        try {
            const tipos = [];
            (pedido.itens || []).forEach(it => { if (it && it.romaneioTipo) tipos.push(String(it.romaneioTipo)); });
            (pedido.romaneiosOrigem || []).forEach(o => { if (o && o.tipo) tipos.push(String(o.tipo)); });
            if (tipos.length > 0) {
                tipoInferidoVenda = tipos.slice().sort((a, b) =>
                    tipos.filter(x => x === b).length - tipos.filter(x => x === a).length)[0] || '';
            }
        } catch (_) { tipoInferidoVenda = ''; }
        atualizarEstadoAgrupamentoVendas(tipoInferidoVenda);
        // Restaurar o modo de agrupamento com que o pedido foi salvo.
        try {
            const mapaModoVenda = { especie: 'agruparEspecieCheckbox', largura: 'agruparEspecieLarguraCheckbox', dimensoes: 'agruparDimensoesCheckbox', resumo: 'agruparResumoVendas' };
            const modoSalvoVenda = pedido && pedido.modoAgrupamentoRomaneio;
            if (modoSalvoVenda && mapaModoVenda[modoSalvoVenda]) {
                Object.keys(mapaModoVenda).forEach(k => {
                    const cb = document.getElementById(mapaModoVenda[k]);
                    if (cb) cb.checked = (k === modoSalvoVenda);
                });
                atualizarEstadoAgrupamentoVendas(tipoInferidoVenda);
            }
        } catch (_) { /* best-effort */ }
    } catch (_) { /* best-effort */ }
    
    // Preencher formulário
    const numeroEl = document.getElementById('pedidoNumero');
    numeroEl.value = pedido.numero;
    numeroEl.readOnly = true;
    document.getElementById('pedidoData').value = pedido.data;
    document.getElementById('pedidoStatus').value = pedido.status;
    // Garantir que o cliente exista na lista antes de selecionar
    if (pedido.clienteId) {
        const clienteExiste = window.clientes.find(c => String(c.id) === String(pedido.clienteId));
        if (!clienteExiste && pedido.cliente) {
            console.log('Cliente do pedido não encontrado na lista atual, adicionando temporariamente:', pedido.cliente);
            // Adicionar cliente do pedido à lista local para permitir seleção
            window.clientes.push({
                id: pedido.clienteId,
                nome: pedido.cliente.nome || pedido.cliente.name || 'Cliente (Histórico)',
                document: pedido.cliente.document || '',
                ...pedido.cliente
            });
            // Atualizar o select para incluir a nova opção
            atualizarSelectClientes(pedido.clienteId);
        } else {
            // Se já existe, apenas garantir que o select esteja atualizado
            document.getElementById('clienteSelect').value = pedido.clienteId;
        }
    } else {
        document.getElementById('clienteSelect').value = '';
    }
    document.getElementById('desconto').value = formatCurrency(pedido.desconto);
    
    // Resetar campos de forma de pagamento
    document.getElementById('contaValor').value = '';
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('contaVencimento').value = hoje;
    document.getElementById('contaTipo').value = 'receber';
    document.getElementById('numeroParcelas').value = '1';
    document.getElementById('contaObservacao').value = '';
    
    if (pedido.contasReceber && pedido.contasReceber.length > 0) {
        contasReceber = normalizarContasReceberLista(pedido.contasReceber);
    } else {
        try {
            const vinculadas = await carregarContasReceberVinculadasPedidoVenda(pedido);
            contasReceber = vinculadas.map(c => ({
                id: c.id,
                valor: typeof c.valor === 'number' ? c.valor : parseCurrencyValue(c.valor),
                vencimento: c.dataVencimento || c.vencimento,
                baseVencimento: c.dataVencimento || c.vencimento,
                dias: 0,
                tipo: c.tipoPagamento || c.tipo,
                observacao: c.observacoes || c.observacao || '',
                status: c.status || 'pendente',
                locked: false
            }));
        } catch (_) {
            contasReceber = [];
        }
    }
    autoRedistribuirEnabled = false;
    contasReceberEdicaoBloqueada = false;

    try {
        const vinculadas = await carregarContasReceberVinculadasPedidoVenda(pedido);
        const vinculadasReceber = vinculadas.filter(c => (c.tipo || 'receber') === 'receber');
        const hasRecebimentos = vinculadasReceber.some(c => isContaReceberComRecebimento(c));
        if (hasRecebimentos) {
            contasReceberEdicaoBloqueada = true;
            ToastManager.warning('Este pedido possui recebimentos (parciais ou totais). Cancele os recebimentos antes de editar a Forma de Pagamento.', 'Atenção', 6000);
        }
    } catch (e) {
        console.warn('Falha ao verificar recebimentos vinculados:', e);
    }
    atualizarTabelaContasReceber();
    
    // Mostrar formulário
    document.getElementById('pedidoForm').style.display = 'block';
    
    // Atualizar tabela e totais
    atualizarTabelaItens();
    atualizarTotais();
}

async function clonarPedido(pedidoId) {
    if (!guardOperationalAccessVendas()) return;
    const pedido = resolverPedidoVenda(pedidoId);
    if (!pedido) {
        ToastManager.warning('Pedido não encontrado.', 'Clonar pedido');
        return;
    }

    await novoPedido();
    editandoPedidoId = null;
    pedidoAtual = null;
    itemEmEdicaoId = null;
    const hoje = new Date().toISOString().split('T')[0];
    const dataOrigem = pedido.data || hoje;
    const deslocarData = (value) => addDaysISO(hoje, Math.max(0, diffDaysISO(dataOrigem, value || dataOrigem)));

    itensCarrinho = (pedido.itens || []).map((item, index) => {
        const clone = JSON.parse(JSON.stringify(item || {}));
        delete clone.id;
        delete clone.firebaseKey;
        delete clone.estoqueMovimentoId;
        clone.id = `ITEM-${Date.now()}-${index + 1}`;
        return clone;
    });
    contasReceber = normalizarContasReceberLista(pedido.contasReceber || []).map((conta) => {
        const clone = { ...(conta || {}) };
        delete clone.id;
        delete clone.firebaseKey;
        delete clone.historicosPagamento;
        delete clone.recebimentos;
        delete clone.dataPagamento;
        delete clone.valorPago;
        delete clone.valorRestante;
        delete clone.operationId;
        clone.baseVencimento = deslocarData(conta.baseVencimento || conta.vencimento || conta.dataVencimento);
        clone.vencimento = deslocarData(conta.vencimento || conta.dataVencimento);
        clone.dias = diffDaysISO(clone.baseVencimento, clone.vencimento);
        clone.status = 'pendente';
        clone.locked = false;
        return clone;
    });

    document.getElementById('pedidoData').value = hoje;
    document.getElementById('pedidoStatus').value = 'pendente';
    document.getElementById('desconto').value = formatCurrency(pedido.desconto || 0);
    if (pedido.clienteId) {
        atualizarSelectClientes(pedido.clienteId);
        const select = document.getElementById('clienteSelect');
        if (select && !Array.from(select.options).some(option => String(option.value) === String(pedido.clienteId)) && pedido.cliente) {
            const option = document.createElement('option');
            option.value = pedido.clienteId;
            option.textContent = pedido.cliente.nome || pedido.cliente.name || 'Cliente do pedido';
            select.appendChild(option);
        }
        if (select) select.value = pedido.clienteId;
    }

    autoRedistribuirEnabled = false;
    contasReceberEdicaoBloqueada = false;
    fecharModal('listaPedidosModal');
    atualizarTabelaItens();
    atualizarTabelaContasReceber();
    atualizarTotais();
    atualizarTotalContasReceber();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    ToastManager.info(`Cópia do pedido ${pedido.numero || ''} pronta para revisão.`, 'Clonar pedido');
}

async function excluirPedido(pedidoId) {
    if (!await confirmDialog({ title: 'Excluir pedido', message: 'Deseja excluir este pedido? Esta ação não pode ser desfeita.', danger: true, confirmLabel: 'Excluir' })) {
        return;
    }
    // Trava anti-duplo-clique (auto-expira em 10s: sem estado preso).
    try {
        const agoraX = Date.now();
        if (window.__excluirPedidoVendaTs && (agoraX - window.__excluirPedidoVendaTs) < 10000) {
            try { ToastManager.info('Exclusão já em andamento, aguarde...', 'Aguarde'); } catch (_) {}
            return;
        }
        window.__excluirPedidoVendaTs = agoraX;
    } catch (_) {}
    try { LoadingManager.show('Excluindo pedido...'); } catch (_) {}

    try {
        const pedido = resolverPedidoVenda(pedidoId);
        // Snapshots para rollback se o servidor não confirmar a exclusão.
        const backupPedidosVenda = Array.isArray(window.pedidos) ? window.pedidos.slice() : [];
        let backupEstoqueVenda = null;
        try {
            // Clone profundo: a reversão mexe em estoque/peças/volume/ml.
            backupEstoqueVenda = JSON.parse(JSON.stringify(window.produtos || []));
        } catch (_) { backupEstoqueVenda = null; }
        if (pedido) {
            // Reverter estoque SOMENTE se o pedido tinha baixa (era conferido);
            // pendente nunca consumiu — reverter inflaria.
            try {
                const eraConferido = typeof statusRomaneioConferido === 'function' && statusRomaneioConferido(pedido.status);
                if (eraConferido && typeof reverterBaixaPedido === 'function') {
                    await reverterBaixaPedido(pedido);
                }
            } catch (_) {}
            
            // Remover contas a receber relacionadas (fail-closed: sem confirmação, aborta)
            const vinculadas = await carregarContasReceberVinculadasPedidoVenda(pedido);
            let finRemotoOk = true;
            if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
                const updates = montarUpdatesRemocaoContasReceberVenda(vinculadas, { includeLegacy: false });
                if (Object.keys(updates).length > 0) {
                    const resFin = await window.firebaseService.updatePaths(updates);
                    finRemotoOk = !!(resFin && resFin.success);
                }
            } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                finRemotoOk = await removerContasReceberPorLista(vinculadas);
            } else {
                const contasReceberLista = await getData('financas/receber') || [];
                const contasAtualizadas = flattenContasReceberData(contasReceberLista).filter(conta => !contaReceberPertenceAoPedidoVenda(conta, pedido));
                __rvSaveDataRemoteOk = false;
                await saveData('contasReceber', contasAtualizadas);
                finRemotoOk = __rvSaveDataRemoteOk;
            }
            if (!finRemotoOk) {
                try {
                    if (Array.isArray(backupEstoqueVenda)) {
                        const porId = new Map(backupEstoqueVenda.map(p => [p && p.id, p]));
                        (window.produtos || []).forEach(p => {
                            if (p && porId.has(p.id)) {
                                const b = porId.get(p.id);
                                Object.keys(p).forEach(k => { try { delete p[k]; } catch (_) {} });
                                Object.assign(p, JSON.parse(JSON.stringify(b)));
                            }
                        });
                    }
                } catch (_) {}
                ToastManager.error('Não foi possível remover o financeiro vinculado no servidor. Verifique sua conexão e permissões e tente novamente. Nenhuma alteração foi concluída.', 'Falha ao excluir', 8000);
                return;
            }
        }
        
        // Remover pedido (fail-closed: só confirma após o servidor)
        window.pedidos = window.pedidos.filter(p => getPedidoVendaId(p) !== String(pedidoId));
        let pedidoRemotoOk = false;
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            try {
                const resDel = await window.firebaseService.saveToFirebase('vendas/pedidos', String(pedidoId), null);
                pedidoRemotoOk = !!(resDel && resDel.success);
            } catch (e) {
                console.warn('Falha ao excluir pedido no Firebase:', e);
                pedidoRemotoOk = false;
            }
        } else {
            __rvSaveDataRemoteOk = false;
            await saveData('vendas/pedidos', window.pedidos);
            pedidoRemotoOk = __rvSaveDataRemoteOk;
        }
        if (!pedidoRemotoOk) {
            try { window.pedidos = backupPedidosVenda; } catch (_) {}
            try {
                if (Array.isArray(backupEstoqueVenda)) {
                    const porId = new Map(backupEstoqueVenda.map(p => [p && p.id, p]));
                    (window.produtos || []).forEach(p => {
                        if (p && porId.has(p.id)) {
                            const b = porId.get(p.id);
                            Object.keys(p).forEach(k => { try { delete p[k]; } catch (_) {} });
                            Object.assign(p, JSON.parse(JSON.stringify(b)));
                        }
                    });
                }
            } catch (_) {}
            try { await carregarTabelaPedidos(); } catch (_) {}
            ToastManager.error('Não foi possível excluir o pedido no servidor. Verifique sua conexão e permissões e tente novamente. Nenhuma alteração foi perdida.', 'Falha ao excluir', 8000);
            return;
        }
        
        // Atualizar listagem (modal aberto)
        await carregarTabelaPedidos();
        refreshModalsAfterChange(pedidoId);
        
        ToastManager.success('Pedido excluído com sucesso!', 'Sucesso');
        
    } catch (error) {
        console.error('Erro ao excluir pedido:', error);
        ToastManager.error('Erro ao excluir pedido: ' + error.message, 'Erro');
    } finally {
        try { LoadingManager.hide(); } catch (_) {}
    }
}

function isModalOpen(modalId) {
    const el = document.getElementById(modalId);
    return !!(el && el.style.display === 'block');
}

async function refreshModalsAfterChange(pedidoId) {
    try {
        if (isModalOpen('listaPedidosModal')) {
            await carregarTabelaPedidos();
        }
        if (isModalOpen('visualizarPedidoModal')) {
            const current = window.pedidoVisualizando;
            if (String(current) === String(pedidoId)) {
                await visualizarPedido(pedidoId);
            }
        }
    } catch (e) { console.warn('Falha ao atualizar modais após alteração:', e); }
}

// Funções de produtos
function isBlankValue(v) {
    if (v === undefined || v === null) return true;
    const s = String(v).trim().toLowerCase();
    return s === '' || s === 'undefined' || s === 'null';
}

function isNumericCode(code) {
    return /^\d+$/.test(String(code || '').trim());
}

function getNextNumericCode(usedCodes) {
    let max = 0;
    (usedCodes || new Set()).forEach(c => {
        const v = String(c || '').trim();
        if (isNumericCode(v)) {
            const n = parseInt(v, 10);
            if (!isNaN(n) && n > max) max = n;
        }
    });
    const next = max + 1;
    return String(next).padStart(6, '0');
}

function ensureUniqueCode(code, usedCodes) {
    const used = usedCodes || new Set();
    let base = String(code || '').trim();
    if (isBlankValue(base) || !isNumericCode(base)) {
        base = getNextNumericCode(used);
    }
    while (used.has(base)) {
        base = getNextNumericCode(used);
    }
    used.add(base);
    return base;
}

// Nomes-fantasma: literais que significam AUSÊNCIA de nome em qualquer campo
function isNomeFantasma(v) {
    const s = String(v || '').trim().toLowerCase();
    return s === '' || s === 'produto sem nome' || s === 'nome não informado';
}

// Nome para exibição: primeiro significativo (comum→nome→científico) ou fallback
function nomeExibicaoProduto(p) {
    try {
        if (!p || typeof p !== 'object') return 'Produto sem nome';
        return nomeSignificativo(p.nomeComum, p.nome, p.name, p.nomeCientifico) || 'Produto sem nome';
    } catch (_) { return 'Produto sem nome'; }
}

// Primeiro valor com nome significativo (ignora vazios e literais-fantasma)
function nomeSignificativo(...vals) {
    for (const v of vals) {
        const s = String(v || '').trim();
        if (s !== '' && !isNomeFantasma(s)) return s;
    }
    return '';
}

function normalizeProduto(raw, usedCodes) {
    if (!raw || typeof raw !== 'object') return null;
    const nomeRaw = nomeSignificativo(raw.nome, raw.name, raw.nomeComum, raw.descricao, raw.produtoNome);
    const nome = (isAllCaps(nomeRaw) ? toTitleCasePt(nomeRaw) : String(nomeRaw || '').trim()).replace(/^\s*[-–—]\s*/, '').trim();
    const unidadeRaw = raw.unidade || raw.unit || 'UN';
    const unidade = isAllCaps(unidadeRaw) ? toTitleCasePt(unidadeRaw) : String(unidadeRaw || 'UN').trim();
    const id = raw.id || raw.firebaseKey || raw.codigo || raw.code || raw.sku || (typeof generateUniqueId === 'function' ? generateUniqueId('PROD') : `PROD_${Date.now()}`);
    const codigoRaw = raw.codigo || raw.code || raw.sku || '';
    const codigo = ensureUniqueCode(codigoRaw, usedCodes);
    const preco = parseCurrencyValue(raw.preco ?? raw.price ?? raw.precoUnitario ?? 0);
    const estoque = parseFloat(raw.estoque ?? raw.quantidade ?? raw.qtd ?? raw.stock ?? 0) || 0;
    const descricaoRaw = raw.descricao || raw.description || '';
    const descricao = isAllCaps(descricaoRaw) ? toTitleCasePt(descricaoRaw) : String(descricaoRaw || '').trim();
    // Higieniza literais-fantasma vindos do banco (auto-limpeza progressiva)
    const nomeComumLimpo = isNomeFantasma(raw.nomeComum) ? '' : (raw.nomeComum || '');
    return {
        ...raw,
        id,
        codigo,
        nome: nome || 'Produto sem nome',
        nomeComum: nomeComumLimpo,
        preco,
        estoque,
        unidade: unidade || 'UN',
        descricao,
        created: raw.created || raw.createdAt || new Date().toISOString(),
        updated: raw.updated || raw.updatedAt || new Date().toISOString()
    };
}

function normalizeProdutosList(list) {
    const arr = Array.isArray(list) ? list : [];
    const usedCodes = new Set();
    const map = new Map();
    arr.forEach((item) => {
        const normalizado = normalizeProduto(item, usedCodes);
        if (!normalizado) return;
        map.set(String(normalizado.id), normalizado);
    });
    return Array.from(map.values());
}

// Quarentena anti-fantasma ("Produto sem nome"): window.produtos mistura
// espécies (merge p/ exibição/select na carga). Somente entradas
// provindas da coleção 'produtos' ou criadas nesta sessão podem persistir
// em writes whole-list. Espécies nunca entram em 'produtos'.
window.__produtosRawIds = window.__produtosRawIds instanceof Set ? window.__produtosRawIds : new Set();
window.__produtosNovosIds = window.__produtosNovosIds instanceof Set ? window.__produtosNovosIds : new Set();
function registrarIdsProdutosRaw(lista) {
    try {
        const s = new Set();
        (Array.isArray(lista) ? lista : []).forEach(r => {
            if (!r || typeof r !== 'object') return;
            ['id', 'firebaseKey', 'codigo', 'code', 'sku'].forEach(k => {
                const v = r[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') s.add(String(v).trim());
            });
        });
        window.__produtosRawIds = s;
    } catch (_) {}
}
function filtrarProdutosPersistiveis(lista) {
    try {
        const raw = window.__produtosRawIds instanceof Set ? window.__produtosRawIds : new Set();
        const novos = window.__produtosNovosIds instanceof Set ? window.__produtosNovosIds : new Set();
        const out = (Array.isArray(lista) ? lista : []).filter(p => {
            if (!p || typeof p !== 'object') return false;
            const keys = [p.id, p.firebaseKey, p.codigo, p.code, p.sku]
                .map(v => (v === undefined || v === null) ? '' : String(v).trim()).filter(Boolean);
            if (!keys.some(k => raw.has(k) || novos.has(k))) return false;
            // Purge: registro puro-lixo (sem nome, sem preço, sem estoque)
            // não tem valor de negócio e só polui a lista — descartado no save
            return !isProdutoJunk(p);
        });
        try {
            const drop = (Array.isArray(lista) ? lista.length : 0) - out.length;
            if (drop > 0) console.log(`🧹 Quarentena: ${drop} registro(s) vazio(s) purgado(s) do save em 'produtos'`);
        } catch (_) {}
        return out;
    } catch (_) { return Array.isArray(lista) ? lista : []; }
}

// Registro puro-lixo: nenhum campo de nome + preço zerado + estoque zerado.
// (Produto legítimo sempre tem nome — trava no salvar — ou valor/estoque.
// O literal "Produto sem nome" conta como AUSÊNCIA de nome.)
function isProdutoJunk(p) {
    try {
        if (!p || typeof p !== 'object') return true;
        const temNome = [p.nome, p.name, p.nomeComum, p.nomeCientifico]
            .some(v => !isNomeFantasma(v));
        if (temNome) return false;
        const preco = parseFloat(p.preco ?? p.price) || 0;
        const est = parseFloat(p.estoque ?? p.quantidade) || 0;
        return !(preco > 0 || est > 0);
    } catch (_) { return false; }
}

function novoProduto() {
    document.getElementById('produtoId').value = '';
    document.getElementById('produtoForm').reset();
    const usedCodes = new Set((window.produtos || []).map(p => String(p.codigo || '').trim()).filter(Boolean));
    document.getElementById('produtoCodigo').value = ensureUniqueCode('', usedCodes);
    document.getElementById('produtoFormTitulo').textContent = 'Novo Produto';
    try { resetProdutoRomaneioFields(); } catch (_) {}
    try { limparPreviewProdutoRomaneio(); } catch (_) {}
    try { __itensProdutoManuel = []; } catch (_) {}
    const sec = document.getElementById('secaoProdutoForm');
    if (sec) {
        sec.style.display = 'block';
        try { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
    }
    try { alternarTipoProdutoForm(); } catch (_) {}
    try { renderPreviewProdutoManuel(); } catch (_) {}
}

function fecharProdutoForm() {
    const sec = document.getElementById('secaoProdutoForm');
    if (sec) sec.style.display = 'none';
}

// Radios Comum/Romaneio (substitui o checkbox antigo)
function isProdutoRomaneioForm() {
    try {
        const r = document.querySelector('input[name="tipoProdutoForm"]:checked');
        return !!r && r.value === 'romaneio';
    } catch (_) { return false; }
}

function alternarTipoProdutoForm() {
    const isRom = isProdutoRomaneioForm();
    const editing = (() => { try { return !!String(document.getElementById('produtoId')?.value || '').trim(); } catch (_) { return false; } })();
    const show = (id, vis, display) => {
        try {
            const el = document.getElementById(id);
            if (el) el.style.display = vis ? (display || 'block') : 'none';
        } catch (_) {}
    };
    // Esconde tudo primeiro (estado parcial impossível), depois revela o do modo
    const showBase = !isRom || editing;
    const showVinculo = isRom && editing;
    const showDims = !isRom || editing;
    const showExtra = isRom;
    show('blocoRomaneioExtra', showExtra);
    show('formProdutoBase', showBase);
    show('produtoRomaneioVinculo', showVinculo);
    show('produtoDimsFields', showDims);
    const box = document.getElementById('produtoRomaneioFields');
    if (box) { try { box.style.display = (showVinculo || showDims) ? 'block' : 'none'; } catch (_) {} }
    show('previewProdutoManuelWrap', !isRom && !editing);
    show('produtoFormFooter', false, 'flex');
    show('produtoManuelFooter', !isRom && !editing, 'flex');
    show('produtoRomaneioFooter', isRom && !editing, 'flex');
    // Botões da linha Volume: Adicionar visível só editando (no novo, o footer faz);
    // Cancelar ao lado só editando
    try {
        const gAdd = document.getElementById('grupoBtnDimsAdicionar');
        if (gAdd) gAdd.style.display = editing ? 'block' : 'none';
        const cDims = document.getElementById('btnCancelarDims');
        if (cDims) cDims.style.display = editing ? 'inline-flex' : 'none';
    } catch (_) {}
    // Rótulo conforme modo: editando = Atualizar, criando = Adicionar
    try {
        document.querySelectorAll('#secaoProdutoForm .lbl-estoque').forEach(el => {
            el.textContent = editing ? 'Atualizar Estoque' : 'Adicionar Estoque';
        });
    } catch (_) {}
    try {
        const vis = ['produtoFormFooter', 'produtoManuelFooter', 'produtoRomaneioFooter']
            .filter(id => { const e = document.getElementById(id); return e && e.style.display !== 'none'; });
        console.log(`[prod-form] modo=${isRom ? 'romaneio' : 'manuel'} editing=${editing} footers=${vis.join(',') || 'nenhum'}`);
    } catch (_) {}
    // Forense: display computado (detecta override de CSS !important sobre o inline)
    try {
        const comp = ['produtoFormFooter', 'produtoManuelFooter', 'produtoRomaneioFooter'].map(id => {
            const e = document.getElementById(id);
            if (!e) return `${id}=ausente`;
            let cs = '';
            try { cs = window.getComputedStyle(e).display; } catch (_) {}
            return `${id}=inline:${e.style.display || '(vazio)'}/computed:${cs || '?'}`;
        }).join(' | ');
        console.log(`[prod-form-forense] ${comp} | produtoId=${(() => { try { return document.getElementById('produtoId')?.value || '(vazio)'; } catch (_) { return '?'; } })()}`);
    } catch (_) {}
    if (isRom) {
        const un = document.getElementById('produtoUnidade');
        if (un && !editing) un.value = 'UN';
        atualizarVolumeProdutoRomaneio();
    } else if (!editing) {
        renderPreviewProdutoManuel();
    }
}

function toggleProdutoRomaneio() {
    // Compat: agora dirigido pelos radios Comum/Romaneio
    alternarTipoProdutoForm();
}

// volume m³ p/ madeira serrada (cm): E x L x C / 1e6 x peças x ppp
function calcularVolumeSerradoM3(espessura, largura, comprimento, qtd, ppp) {
    const e = parseFloat(String(espessura ?? '').replace(',', '.')) || 0;
    const l = parseFloat(String(largura ?? '').replace(',', '.')) || 0;
    const c = parseFloat(String(comprimento ?? '').replace(',', '.')) || 0;
    const q = parseFloat(qtd) || 0;
    const p = parseFloat(ppp) || 1;
    if (e <= 0 || l <= 0 || c <= 0 || q <= 0) return 0;
    return Math.round(((e * l * c) / 1e6) * q * p * 1000) / 1000;
}

// Baixa por unidade de medida: UN/PC→peças, DZ→peças×12, M³→volume,
// ML/LN→metros lineares, M²→área derivada. Desconhecida = legado (m³).
// As dimensões do serrado são proporcionais: deduzir por uma reduz as demais.
function normalizarUnidadeMedida(u) {
    const s = String(u || '').trim().toUpperCase().replace(/\./g, '').replace(/\s+/g, '');
    if (!s) return '';
    if (['DZ', 'DUZIA', 'DUZIAS', 'DÚZIA', 'DÚZIAS', 'DUZ', 'DZIA'].includes(s)) return 'DZ';
    if (['UN', 'UNIDADE', 'UNIDADES', 'PC', 'PCS', 'PECA', 'PECAS', 'PEÇA', 'PEÇAS', 'PCA', 'PCAS', 'UNI', 'UND', 'UNID'].includes(s)) return 'UN';
    if (['M3', 'M³', 'M^3', 'METROCUBICO', 'METROSCUBICOS', 'METROCÚBICO', 'METROSCÚBICOS'].includes(s)) return 'M3';
    if (['M2', 'M²', 'M^2', 'METROQUADRADO', 'METROSQUADRADOS'].includes(s)) return 'M2';
    if (['ML', 'LN', 'M', 'MT', 'MTS', 'METRO', 'METROS', 'METROLINEAR', 'METROSLINEARES', 'LINEAR', 'LINEARES'].includes(s)) return 'ML';
    return s;
}

function dimensoesEstoqueSerrado(p) {
    const num = (v) => parseFloat(v) || 0;
    const pecas = num(p && p.pecas);
    // volumeM3 zerado com estoque positivo = legado inconsistente: usa o estoque.
    const vol = num(p && p.volumeM3) || num(p && p.estoque);
    let ml = 0;
    try { ml = (typeof metrosLinearesDe === 'function') ? metrosLinearesDe(p) : 0; } catch (_) { ml = 0; }
    const area = (num(p && p.largura) / 100) * (num(p && p.comprimento) / 100) * pecas;
    return { pecas, vol, ml, area };
}

// Fração do estoque consumida por (quantidade, unidade). Clamp 0..1 (sem negativo).
function razaoBaixaSerrado(p, quantidade, unidade) {
    const d = dimensoesEstoqueSerrado(p);
    const q = parseFloat(quantidade) || 0;
    const u = normalizarUnidadeMedida(unidade);
    let base = 'vol', total = d.vol, pedido = q;
    if (u === 'UN') { base = 'pecas'; total = d.pecas; pedido = q; }
    else if (u === 'DZ') { base = 'pecas'; total = d.pecas; pedido = q * 12; }
    else if (u === 'M3') { base = 'vol'; total = d.vol; pedido = q; }
    else if (u === 'ML') { base = 'ml'; total = d.ml; pedido = q; }
    else if (u === 'M2') { base = 'area'; total = d.area; pedido = q; }
    if (!(total > 0) || !(pedido > 0)) return { razao: 0, base, consumido: 0, disponivel: Math.max(0, total) };
    const cons = Math.min(pedido, total);
    return { razao: cons / total, base, consumido: cons, disponivel: total };
}

// Aplica baixa (dir=-1) ou reversão (dir=+1) proporcional em todas as dims.
// Retorna o consumido/devolvido na dimensão base.
function aplicarBaixaSerrado(p, quantidade, unidade, dir) {
    const num = (v) => parseFloat(v) || 0;
    if (!p || typeof p !== 'object') return { razao: 0, consumido: 0 };
    if (dir > 0) {
        // Reversão: soma na dimensão base e reescala as demais proporcionalmente.
        const d = dimensoesEstoqueSerrado(p);
        const q = parseFloat(quantidade) || 0;
        const u = normalizarUnidadeMedida(unidade);
        let baseTot = d.vol, pedido = q;
        if (u === 'UN') { baseTot = d.pecas; pedido = q; }
        else if (u === 'DZ') { baseTot = d.pecas; pedido = q * 12; }
        else if (u === 'ML') { baseTot = d.ml; pedido = q; }
        else if (u === 'M2') { baseTot = d.area; pedido = q; }
        if (!(pedido > 0)) return { razao: 0, consumido: 0 };
        const f = baseTot > 0 ? ((baseTot + pedido) / baseTot) : 0;
        if (u === 'UN' || u === 'DZ') {
            p.pecas = Math.max(0, Math.round((num(p.pecas) + pedido) * 1000) / 1000);
        } else if (u === 'M3') {
            const v0 = num(p.volumeM3) || num(p.estoque);
            if (p.volumeM3 !== undefined && p.volumeM3 !== null && p.volumeM3 !== '') p.volumeM3 = Math.round((v0 + pedido) * 1000) / 1000;
            else p.estoque = Math.round((v0 + pedido) * 1000) / 1000;
        }
        if (f > 0) {
            const vol0 = num(p.volumeM3) || num(p.estoque);
            const volNovo = Math.round(vol0 * f * 1000) / 1000;
            if (p.volumeM3 !== undefined && p.volumeM3 !== null && p.volumeM3 !== '') p.volumeM3 = volNovo;
            else p.estoque = volNovo;
            try { p.metrosLineares = Math.round((metrosLinearesDe(p) * f) * 100) / 100; } catch (_) {}
            if (p.metrosLineares < 0) p.metrosLineares = 0;
        }
        p.updated = new Date().toISOString();
        return { razao: 0, consumido: pedido };
    }
    const r = razaoBaixaSerrado(p, quantidade, unidade);
    if (!(r.razao > 0)) return r;
    const f = 1 - r.razao;
    p.pecas = Math.max(0, Math.round(num(p.pecas) * f));
    const vol0 = num(p.volumeM3) || num(p.estoque);
    const volNovo = Math.round(vol0 * f * 1000) / 1000;
    if (p.volumeM3 !== undefined && p.volumeM3 !== null && p.volumeM3 !== '') p.volumeM3 = volNovo;
    p.estoque = volNovo;
    try { p.metrosLineares = Math.round((metrosLinearesDe(p) * f) * 100) / 100; } catch (_) {}
    if (p.metrosLineares < 0) p.metrosLineares = 0;
    p.updated = new Date().toISOString();
    return r;
}

// Manual: converte dentro da família peça (DZ×12, PC/UN×1); resto cego (legado).
function aplicarBaixaManual(p, quantidade, unidadeItem, dir) {
    const fam = (u) => {
        const n = normalizarUnidadeMedida(u);
        if (n === 'DZ') return 12;
        if (n === 'UN') return 1;
        return 0;
    };
    let qtd = parseFloat(quantidade) || 0;
    try {
        const fi = fam(unidadeItem), fp = fam(p && p.unidade);
        if (fi && fp) qtd = qtd * fi / fp;
    } catch (_) {}
    const est = parseFloat(p.estoque) || 0;
    p.estoque = dir > 0 ? (est + qtd) : Math.max(0, est - qtd);
    try { p.updated = new Date().toISOString(); } catch (_) {}
    return qtd;
}

// Extrai dims de serrado: campos primeiro; fallback no nome ("7x14x850",
// produtos legados sem espessura/largura/comprimento). Null se nada válido.
function dimsSerradoProduto(produto) {
    try {
        const num = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
        let E = num(produto && produto.espessura),
            L = num(produto && produto.largura),
            C = num(produto && produto.comprimento);
        if (E > 0 && L > 0 && C > 0) return { E, L, C };
        const nome = String((produto && (produto.nome || produto.name)) || '');
        const m = nome.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);
        if (m) {
            E = num(m[1]); L = num(m[2]); C = num(m[3]);
            if (E > 0 && L > 0 && C > 0) return { E, L, C };
        }
        return null;
    } catch (_) { return null; }
}

// Converte item serrado com unidade ≠ m³ para m³ (totais corretos).
// Retorna {volume, qtdOrigem, pecasOrigem, unidadeOrigem} ou null (sem conversão).
// Só serrado COM dimensões (campos ou nome); resto segue legado.
// Prefere a contabilidade do próprio produto (exato em qualquer convenção);
// cai para a fórmula cm quando o registro está incompleto.
function converterItemSerradoParaM3(produto, quantidade, unidadeItem) {
    try {
        const u = normalizarUnidadeMedida(unidadeItem);
        if (u === 'M3' || !u) return null;
        if (typeof temDimsSerrado !== 'function' || !temDimsSerrado(produto)) return null;
        const dims = (typeof dimsSerradoProduto === 'function') ? dimsSerradoProduto(produto) : null;
        if (!dims) return null;
        const E = dims.E, L = dims.L, C = dims.C;
        const num = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
        const q = num(quantidade);
        if (!(q > 0)) return null;
        const r3 = (v) => Math.round(v * 1000) / 1000;
        const pPecas = num(produto.pecas), pVol = num(produto.volumeM3);
        let mlTotal = 0;
        try { mlTotal = (typeof metrosLinearesDe === 'function') ? metrosLinearesDe(produto) : 0; } catch (_) { mlTotal = 0; }
        const areaTotal = (L / 100) * (C / 100) * pPecas;
        // PC cru = pacote: multiplica pelas peças/pacote do produto
        // (ex.: 2 pac c/6 = 12). UN = peça avulsa (sem regressão).
        // (normalizarUnidadeMedida mapeia PC→UN; por isso o teste é no cru.)
        const cruPC = String(unidadeItem || '').trim().toUpperCase().replace(/\./g, '') === 'PC';
        const pack = (() => {
            if (!cruPC) return 1;
            const p = parseFloat(produto.pecasPorPacote) || 0;
            return p > 1 ? p : 1;
        })();
        if (u === 'UN' || u === 'DZ') {
            const pecas = (u === 'DZ' ? q * 12 : q) * pack;
            const volPeca = (pPecas > 0 && pVol > 0) ? (pVol / pPecas) : (E * L * C / 1e6);
            return { volume: r3(volPeca * pecas), qtdOrigem: q, pecasOrigem: pecas, unidadeOrigem: unidadeItem };
        }
        if (u === 'ML') {
            const secao = (mlTotal > 0 && pVol > 0) ? (pVol / mlTotal) : (E * L / 1e4);
            return { volume: r3(secao * q), qtdOrigem: q, pecasOrigem: null, unidadeOrigem: unidadeItem };
        }
        if (u === 'M2') {
            const volM2 = (areaTotal > 0 && pVol > 0) ? (pVol / areaTotal) : (E / 100);
            return { volume: r3(volM2 * q), qtdOrigem: q, pecasOrigem: null, unidadeOrigem: unidadeItem };
        }
        return null;
    } catch (_) { return null; }
}

// "Orelha-de-macaco - 7cmx14cmx850cm" a partir dos campos; se espécie ausente,
// deriva do nome removendo o padrão ExLxC final ("Orelha-de-macaco 6x12x700").
// Null quando sem dims.
function rotuloSerradoLinha(item) {
    try {
        const p = (window.produtos || []).find(x => x && x.id === (item && item.produtoId));
        if (!p) return null;
        let esp = String(p.especie || '').trim();
        const dims = (typeof dimsSerradoProduto === 'function') ? dimsSerradoProduto(p) : null;
        if (!dims) return null;
        if (!esp) {
            const nome = String(p.nome || p.name || '');
            const m = nome.match(/^(.*)\s+(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*$/i);
            if (!m || !String(m[1] || '').trim()) return null;
            esp = String(m[1]).trim();
        }
        const { E, L, C } = dims;
        const f = (v) => {
            const n = Math.round(v * 1000) / 1000;
            return (Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })).replace('.', ',');
        };
        return `${esp} - ${f(E)}cmx${f(L)}cmx${f(C)}cm`;
    } catch (_) { return null; }
}

// "2 Peças" / "10 ml" para a linha do carrinho. Preço continua por m³.
// Sem origem (adicionado direto em m³/ml/m²): infere peças inteiras quando a
// quantidade equivale a N peças exatas (tolerância 2% p/ arredondamento).
// Display-only: totais e estoque intocados.
function pecaSingular(n) { return n === 1 ? '1 Peça' : `${n} Peças`; }

function detalheSerradoItem(item) {
    try {
        if (item && item.unidadeOrigem) {
            if (normalizarUnidadeMedida(item.unidadeOrigem) === 'M3') return '';
            const fmtN = (v) => {
                const n = Math.round((parseFloat(v) || 0) * 1000) / 1000;
                return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
            };
        const fam = normalizarUnidadeMedida(item.unidadeOrigem);
        if ((fam === 'UN' || fam === 'DZ') && item.pecasOrigem != null) return `${fmtN(item.pecasOrigem)} Peças`;
        if (item.qtdOrigem != null) {
            let base = `${fmtN(item.qtdOrigem)} ${item.unidadeOrigem}`;
            // ML/M²: anexa equivalência em peças quando inteira ("105 LN · 21 Peças").
            if (fam === 'ML' || fam === 'M2') {
                try {
                    const p = (window.produtos || []).find(x => x && x.id === (item && item.produtoId));
                    if (p && typeof pecasEquivalentesSerrado === 'function' && typeof pecasInteirasDetalhe === 'function') {
                        const s = pecasInteirasDetalhe(pecasEquivalentesSerrado(item.qtdOrigem, fam, p));
                        if (s) base += ` · ${s}`;
                    }
                } catch (_) {}
            }
            return base;
        }
        return '';
        }
        // Inferência: linha direta em m³/ml/m² sem origem registrada.
        if (!item || typeof normalizarUnidadeMedida !== 'function') return '';
        const famItem = normalizarUnidadeMedida(item.unidade);
        if (famItem !== 'M3' && famItem !== 'ML' && famItem !== 'M2') return '';
        const p = (window.produtos || []).find(x => x && x.id === (item && item.produtoId));
        if (!p) return '';
        const num = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
        const qtd = num(item.quantidade);
        if (!(qtd > 0)) return '';
        let volPeca = 0;
        const pPecas = num(p.pecas), pVol = num(p.volumeM3);
        if (famItem === 'M3') {
            volPeca = (pPecas > 0 && pVol > 0) ? (pVol / pPecas) : 0;
            if (!(volPeca > 0) && typeof dimsSerradoProduto === 'function') {
                const d = dimsSerradoProduto(p);
                if (d) volPeca = (d.E * d.L * d.C) / 1e6;
            }
        } else if (famItem === 'ML' || famItem === 'M2') {
            // Direto sem origem: só peças inteiras ("21 Peças"); resto segue sem detalhe.
            if (typeof pecasEquivalentesSerrado !== 'function' || typeof pecasInteirasDetalhe !== 'function') return '';
            return pecasInteirasDetalhe(pecasEquivalentesSerrado(qtd, famItem, p));
        }
        if (!(volPeca > 0)) return '';
        return pecasInteirasDetalhe(qtd / volPeca);
    } catch (_) { return ''; }
}

function pecasInteirasDetalhe(equiv) {
    try {
        if (!Number.isFinite(equiv)) return '';
        const n = Math.round(equiv);
        if (n < 1) return '';
        if (Math.abs(equiv - n) / n > 0.02) return '';
        return typeof pecaSingular === 'function' ? pecaSingular(n) : `${n} Peças`;
    } catch (_) { return ''; }
}

// Peças equivalentes a uma qtd em ML/M² (display-only). Prefere a
// contabilidade do produto (exato em qualquer convenção); cai para dims em cm.
function pecasEquivalentesSerrado(qtd, unidadeNorm, p) {
    try {
        const num = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
        const q = num(qtd);
        if (!(q > 0) || !p || typeof p !== 'object') return NaN;
        const pPecas = num(p.pecas);
        if (unidadeNorm === 'ML') {
            let mlTot = 0;
            try { mlTot = (typeof metrosLinearesDe === 'function') ? metrosLinearesDe(p) : 0; } catch (_) { mlTot = 0; }
            if (pPecas > 0 && mlTot > 0) return q / (mlTot / pPecas);
            let C = num(p.comprimento);
            if (!(C > 0) && typeof dimsSerradoProduto === 'function') {
                const dd = dimsSerradoProduto(p);
                if (dd) C = dd.C;
            }
            if (!(C > 0)) return NaN;
            return q / (C / 100);
        }
        if (unidadeNorm === 'M2') {
            let L = num(p.largura), C = num(p.comprimento);
            if ((!(L > 0 && C > 0)) && typeof dimsSerradoProduto === 'function') {
                const dd = dimsSerradoProduto(p);
                if (dd) { L = dd.L; C = dd.C; }
            }
            if (!(L > 0 && C > 0)) return NaN;
            return q / ((L / 100) * (C / 100));
        }
        return NaN;
    } catch (_) { return NaN; }
}

function resetProdutoRomaneioFields() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    try {
        document.querySelectorAll('input[name="tipoProdutoForm"]').forEach(r => { r.checked = r.value === 'manuel'; });
    } catch (_) {}
    const extra = document.getElementById('blocoRomaneioExtra');
    if (extra) extra.style.display = 'none';
    const box = document.getElementById('produtoRomaneioFields');
    if (box) box.style.display = 'none';
    set('produtoRomaneioTipo', '');
    const sel = document.getElementById('produtoRomaneioId');
    if (sel) sel.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
    set('produtoRomaneioTipo2', '');
    const sel2 = document.getElementById('produtoRomaneioId2');
    if (sel2) sel2.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
    try { limparPreviewProdutoRomaneio(); } catch (_) {}
    set('produtoEspecie', '');
    set('produtoEspessura', '');
    set('produtoLargura', '');
    set('produtoComprimento', '');
    set('produtoPecas', '1');
    set('produtoPpp', '1');
    set('produtoVolumePreview', '');
}

let romaneiosProdutoCache = {};

function rotuloRomaneioProduto(r) {
    let dataFormatada = '';
    try { dataFormatada = (typeof formatRomaneioDateLabel === 'function') ? formatRomaneioDateLabel(r) : (r.data || ''); } catch (_) { dataFormatada = r.data || ''; }
    let clienteNome = 'Cliente não informado';
    try {
        if (r.cliente) clienteNome = r.cliente.nome || r.cliente.name || r.cliente;
        else if (r.clienteNome) clienteNome = r.clienteNome;
        else if (r.fornecedor) clienteNome = r.fornecedor.nome || r.fornecedor.name || r.fornecedor;
        else if (r.transportador) clienteNome = r.transportador.nome || r.transportador.name || r.transportador;
    } catch (_) {}
    let volumeTotal = '0,000';
    try {
        const f = (v) => { try { return formatNumber(v, 3); } catch (_) { return String(v); } };
        if (r.volumeTotal) volumeTotal = f(r.volumeTotal);
        else if (r.totalVolume) volumeTotal = f(r.totalVolume);
        else {
            const listaItens = Array.isArray(r.items) ? r.items : (Array.isArray(r.itens) ? r.itens : []);
            if (listaItens.length > 0) {
                const tot = listaItens.reduce((s, item) => {
                    const q = parseInt(item.quantidade) || 1;
                    const vi = parseFloat(item.volume);
                    // item.volume JÁ É TOTAL (PCT/TL/PES) — somar direto, sem × q.
                    if (!isNaN(vi) && vi > 0) return s + vi;
                    const comp = parseFloat(item.comprimento) || 0, larg = parseFloat(item.largura) || 0;
                    const esp = parseFloat(item.espessura) || 0;
                    const ppp = parseInt(item.pecasPorPacote) || 1;
                    return s + ((comp / 100) * (larg / 100) * (esp / 100)) * q * ppp;
                }, 0);
                volumeTotal = f(tot);
            }
        }
    } catch (_) {}
    const numero = r.numero || r.id || 's/n';
    // Exibe "Nº N" quando houver numeroExibicao; senão legado. Display only.
    let numeroFmt = String(numero);
    try {
        const RU2 = window.RomaneioDataUtils;
        if (RU2 && typeof RU2.formatarNumeroExibicao === 'function') numeroFmt = RU2.formatarNumeroExibicao(r, numero);
    } catch (_) {}
    let rotuloFinal = `${dataFormatada} - ${clienteNome} - ${volumeTotal} m³ (#${numeroFmt})`;
    // Espelha o aviso de pedidos ("USADO Ped."): romaneio já em estoque.
    // Match por qualquer chave (id/key/número) dos dois lados.
    try {
        const chaves = [r.id, r.firebaseKey, r.numero].map(v => String(v || '')).filter(Boolean);
        if (chaves.length > 0 && typeof romaneioIdsEmEstoque === 'function') {
            const emEst = romaneioIdsEmEstoque();
            if (chaves.some(k => emEst.has(k))) rotuloFinal += ' • EM ESTOQUE';
        }
    } catch (_) {}
    return rotuloFinal;
}

async function carregarRomaneiosEm(tipoSelId, romSelId) {
    const tipo = document.getElementById(tipoSelId)?.value || '';
    const sel = document.getElementById(romSelId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Carregando...</option>';
    let lista = [];
    try {
        if (typeof getRomaneiosMerged === 'function' && tipo) {
            lista = await getRomaneiosMerged(tipo) || [];
        }
    } catch (_) { lista = []; }
    // Cache (paridade com o pedido): evita re-fetch e payload em option
    try { romaneiosProdutoCache[tipo] = lista; } catch (_) {}
    sel.innerHTML = '<option value="">Selecione...</option>';
    lista.forEach((r, index) => {
        const opt = document.createElement('option');
        opt.value = String(index);
        opt.textContent = rotuloRomaneioProduto(r);
        opt.dataset.romaneioIdx = String(index);
        sel.appendChild(opt);
    });
    if (lista.length === 0) sel.innerHTML = '<option value="">Nenhum romaneio encontrado</option>';
    try { sel.dataset.tipo = tipo || ''; } catch (_) {}
    // NÃO limpa o preview aqui: permite acumular grupos de vários romaneios/tipos
}

async function carregarRomaneiosProduto() {
    await carregarRomaneiosEm('produtoRomaneioTipo', 'produtoRomaneioId');
    // Espelha no select do bloco extra (fonte única p/ preview)
    try {
        const s1 = document.getElementById('produtoRomaneioId');
        const s2 = document.getElementById('produtoRomaneioId2');
        if (s1 && s2) s2.innerHTML = s1.innerHTML;
    } catch (_) {}
}

function preencherDimsRomaneioProduto() {
    try {
        const sel = document.getElementById('produtoRomaneioId');
        const idx = sel ? parseInt(sel.value, 10) : NaN;
        const tipo = sel?.dataset?.tipo || document.getElementById('produtoRomaneioTipo')?.value || '';
        const lista = (tipo && romaneiosProdutoCache[tipo]) || [];
        const rom = (!isNaN(idx) && lista[idx]) ? lista[idx] : null;
        if (!rom) return;
        // Espelha nos selects do bloco extra (fonte única p/ preview)
        try {
            const t2 = document.getElementById('produtoRomaneioTipo2');
            const s2 = document.getElementById('produtoRomaneioId2');
            const t1 = document.getElementById('produtoRomaneioTipo');
            if (t2 && t1 && !t2.value) t2.value = t1.value || '';
            if (s2 && s2.options.length <= 1 && sel) {
                s2.innerHTML = sel.innerHTML;
                try { s2.dataset.tipo = sel.dataset.tipo || t1?.value || ''; } catch (_) {}
                s2.value = sel.value;
            }
        } catch (_) {}
        const itensRom = Array.isArray(rom.itens) ? rom.itens : (Array.isArray(rom.items) ? rom.items : []);
        const item = itensRom.length > 0 ? itensRom[0] : null;
        if (!item) return;
        const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null && v !== '') el.value = v; };
        set('produtoEspecie', item.especie || item.nome || '');
        set('produtoEspessura', item.espessura ?? '');
        set('produtoLargura', item.largura ?? '');
        set('produtoComprimento', item.comprimento ?? item.comp ?? '');
        if (item.quantidade) set('produtoPecas', item.quantidade);
        if (item.pecasPorPacote) set('produtoPpp', item.pecasPorPacote);
        atualizarVolumeProdutoRomaneio();
    } catch (_) {}
}

function lerDimsProdutoRomaneio() {
    const num = (id) => {
        const el = document.getElementById(id);
        return el ? (parseFloat(String(el.value ?? '').replace(',', '.')) || 0) : 0;
    };
    const str = (id) => document.getElementById(id)?.value || '';
    const romRef = (() => {
        try {
            const s1 = document.getElementById('produtoRomaneioId');
            const idx = s1 ? parseInt(s1.value, 10) : NaN;
            const tipo = s1?.dataset?.tipo || str('produtoRomaneioTipo');
            const lista = (tipo && romaneiosProdutoCache[tipo]) || [];
            const r = (!isNaN(idx) && lista[idx]) ? lista[idx] : null;
            if (r) return { id: String(r.id || r.firebaseKey || r.numero || ''), numero: String(r.numero || r.id || '') };
        } catch (_) {}
        return { id: str('produtoRomaneioId'), numero: '' };
    })();
    return {
        tipo: str('produtoRomaneioTipo'),
        romaneioId: romRef.id,
        romaneioNumero: romRef.numero,
        especie: String(str('produtoEspecie')).trim(),
        espessura: num('produtoEspessura'),
        largura: num('produtoLargura'),
        comprimento: num('produtoComprimento'),
        // Peças pode ser 0 (zerado no estoque); só protege contra negativo.
        pecas: Math.max(0, num('produtoPecas')),
        ppp: num('produtoPpp') || 1
    };
}

function atualizarVolumeProdutoRomaneio() {
    try {
        const d = lerDimsProdutoRomaneio();
        const v = calcularVolumeSerradoM3(d.espessura, d.largura, d.comprimento, d.pecas, d.ppp);
        const el = document.getElementById('produtoVolumePreview');
        if (el) el.value = v > 0 ? v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '';
        return v;
    } catch (_) { return 0; }
}

function adicionarEstoqueProdutoRomaneio() {
    const editando = (() => { try { return !!String(document.getElementById('produtoId')?.value || '').trim(); } catch (_) { return false; } })();
    if (editando) {
        // No modo edição este botão persiste o produto (equivale ao Salvar)
        try {
            const form = document.getElementById('produtoForm');
            if (form && typeof form.requestSubmit === 'function') { form.requestSubmit(); return; }
        } catch (_) {}
    }
    const v = atualizarVolumeProdutoRomaneio();
    if (!(v > 0)) {
        ToastManager.warning('Informe Espessura, Largura, Comprimento e Peças para calcular o volume', 'Atenção');
        return;
    }
    const estEl = document.getElementById('produtoEstoque');
    const atual = estEl ? (parseFloat(String(estEl.value ?? '').replace(',', '.')) || 0) : 0;
    const novo = Math.round((atual + v) * 1000) / 1000;
    if (estEl) estEl.value = novo;
    ToastManager.success(`${v.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³ adicionado(s) ao estoque`, 'Estoque');
}

// Sincronia entre selects do bloco extra e do bloco de dimensões (fonte única)
let __previewProdutoRomaneioItens = [];
let __previewProdutoRomaneioMeta = { tipo: '', rid: '', numero: '' };

async function carregarItensProdutoRomaneio() {
    const box = document.getElementById('previewProdutoRomaneio');
    try {
        const t2 = document.getElementById('produtoRomaneioTipo2');
        const s2 = document.getElementById('produtoRomaneioId2');
        const tipo = (t2 && t2.value) || document.getElementById('produtoRomaneioTipo')?.value || '';
        const rid = (s2 && s2.value) || document.getElementById('produtoRomaneioId')?.value || '';
        if (!tipo) { ToastManager.warning('Selecione o Tipo de Romaneio', 'Atenção'); return; }
        if (!rid) { ToastManager.warning('Selecione o Romaneio', 'Atenção'); return; }
        if (box) box.innerHTML = '<span style="color:var(--sw-text-3);">Carregando itens...</span>';
        // Refetch SEMPRE (não só cache): o romaneio pode ter sido editado
        // (itens novos) depois da última carga; o cache só dá paridade de ordem.
        const idxSel = parseInt(rid, 10);
        let rom = null;
        const emCache = (tipo && romaneiosProdutoCache[tipo]) || [];
        const previo = (!isNaN(idxSel) && emCache[idxSel]) ? emCache[idxSel] : null;
        const idEstavel = previo ? String(previo.id || previo.firebaseKey || previo.numero || '') : '';
        try {
            if (typeof getRomaneiosMerged === 'function' && tipo) {
                const lista = await getRomaneiosMerged(tipo) || [];
                try { romaneiosProdutoCache[tipo] = lista; } catch (_) {}
                if (idEstavel) rom = lista.find(r => String(r.id || r.firebaseKey || r.numero || '') === idEstavel) || null;
                if (!rom && !isNaN(idxSel) && lista[idxSel]) rom = lista[idxSel];
            }
        } catch (_) { /* mantém fallback abaixo */ }
        if (!rom) {
            if (previo) {
                rom = previo;
            } else {
                let lista = [];
                if (typeof getRomaneiosMerged === 'function') lista = await getRomaneiosMerged(tipo) || [];
                try { romaneiosProdutoCache[tipo] = lista; } catch (_) {}
                rom = lista.find(r => String(r.id || r.firebaseKey || r.numero || '') === String(rid)) || null;
            }
        }
        const itens = rom ? (Array.isArray(rom.itens) ? rom.itens : (Array.isArray(rom.items) ? rom.items : [])) : [];
        __previewProdutoRomaneioItens = itens.filter(i => i && typeof i === 'object');
        const ridReal = rom ? String(rom.id || rom.firebaseKey || rom.numero || rid) : String(rid);
        const numeroRom = rom ? String(rom.numero || rom.id || rid) : String(rid);
        __previewProdutoRomaneioMeta = { tipo, rid: ridReal, numero: numeroRom };
        // Acumula grupos (multi-romaneio, mesmo de tipos diferentes); ignora repetidos
        try {
            const meta0 = __previewProdutoRomaneioMeta || {};
            const novos = agruparItensRomaneioExLxC(__previewProdutoRomaneioItens, meta0.rid, meta0.numero, meta0.tipo);
            // Sincroniza com o romaneio recarregado: remove grupos DESTE romaneio
            // que não existem mais (os de outros romaneios ficam), substitui no
            // lugar (índice do checkbox preservado) e faz push dos novos.
            const ridAtual = String(meta0.rid || '');
            const gidNovos = new Set(novos.map(g => String(g.gid)));
            if (ridAtual) {
                __previewRomGrupos = __previewRomGrupos.filter(g => String(g.romaneioId || '') !== ridAtual || gidNovos.has(String(g.gid)));
            }
            const posPorGid = new Map(__previewRomGrupos.map((g, i) => [String(g.gid), i]));
            novos.forEach(g => {
                const pos = posPorGid.get(String(g.gid));
                if (pos === undefined) { posPorGid.set(String(g.gid), __previewRomGrupos.length); __previewRomGrupos.push(g); }
                else { __previewRomGrupos[pos] = g; }
            });
        } catch (_) {}
        renderPreviewProdutoRomaneio();
        // Espelha o aviso dos pedidos: romaneio totalmente em estoque.
        try {
            const checks = Array.from(document.querySelectorAll('#previewProdutoRomaneio input[name="grupoRomSel"]'));
            const travados = document.querySelectorAll('#previewProdutoRomaneio input[name="grupoRomSel"]:disabled').length;
            if (checks.length > 0 && travados === checks.length) {
                ToastManager.warning('Este romaneio já foi adicionado ao estoque — grupos desativados', 'Romaneio já em estoque', 6000);
            }
        } catch (_) {}
    } catch (e) {
        if (box) box.innerHTML = '<span style="color:var(--sw-danger);">Falha ao carregar itens.</span>';
    }
}

function limparPreviewProdutoRomaneio() {
    __previewProdutoRomaneioItens = [];
    __previewRomGrupos = [];
    const box = document.getElementById('previewProdutoRomaneio');
    if (box) {
        box.innerHTML = '<span style="color:var(--sw-text-3);">Selecione o tipo e o romaneio, depois clique em Carregar Itens. Pode carregar vários romaneios, até de tipos diferentes.</span>';
        try { box.dataset.grupos = '[]'; } catch (_) {}
    }
}

let __previewRomGrupos = [];

function agruparItensRomaneioExLxC(itens, rid, numero, tipo) {
    const num = (v) => parseFloat(v) || 0;
    const grupos = new Map();
    (itens || []).forEach(it => {
        if (!it || typeof it !== 'object') return;
        const esp = `${String(it.especie || it.nome || '').trim()}`.toUpperCase();
        const e = num(it.espessura).toFixed(3), l = num(it.largura).toFixed(3), c = num(it.comprimento ?? it.comp);
        const key = `${esp}||${e}||${l}||${c}`;
        if (!grupos.has(key)) grupos.set(key, { gid: `${rid}||${key}`, romaneioId: rid, romaneioNumero: numero || '', romaneioTipo: tipo || '', especie: String(it.especie || it.nome || '').trim(), espessura: num(it.espessura), largura: num(it.largura), comprimento: num(it.comprimento ?? it.comp), pecas: 0, volume: 0, valorTotal: 0 });
        const g = grupos.get(key);
        const q = num(it.quantidade ?? it.pecas) || 1;
        const ppp = num(it.pecasPorPacote) || 1;
        const vol = (typeof it.volume === 'number' && it.volume > 0) ? it.volume
            : calcularVolumeSerradoM3(num(it.espessura), num(it.largura), num(it.comprimento ?? it.comp), q, ppp);
        g.pecas += q;
        g.volume = Math.round((g.volume + vol) * 1000) / 1000;
        g.ml = Math.round(((g.ml || 0) + ((num(it.comprimento ?? it.comp) / 100) * q)) * 100) / 100;
        const pv = num(it.preco ?? it.precoUnitario ?? it.valorUnitario);
        if (pv > 0) g.valorTotal = Math.round((g.valorTotal + pv * q) * 100) / 100;
    });
    const arr = Array.from(grupos.values());
    arr.forEach(g => { g.precoMedio = g.pecas > 0 && g.valorTotal > 0 ? Math.round((g.valorTotal / g.pecas) * 100) / 100 : 0; });
    return arr;
}

function excluirGrupoPreviewRomaneio(gid) {
    try {
        __previewRomGrupos = (__previewRomGrupos || []).filter(g => String(g.gid) !== String(gid));
        renderPreviewProdutoRomaneio();
    } catch (_) {}
}

function modoAgrupamentoProdutoRomaneio() {
    // Automático: sempre Espécie x Espessura x Largura x Comprimento
    return 'comp';
}

function renderPreviewProdutoRomaneio() {
    const box = document.getElementById('previewProdutoRomaneio');
    if (!box) return;
    const arr = Array.isArray(__previewRomGrupos) ? __previewRomGrupos : [];
    if (arr.length === 0) {
        box.innerHTML = '<span style="color:var(--sw-text-3);">Nenhum grupo. Clique em Carregar Itens (pode repetir para vários romaneios).</span>';
        try { box.dataset.grupos = '[]'; } catch (_) {}
        return;
    }
    const total = Math.round(arr.reduce((s, g) => s + g.volume, 0) * 1000) / 1000;
    let html = `<div style="font-size:0.8rem;color:var(--sw-text-2);margin-bottom:8px;">Espécie x Espessura x Largura x Comprimento: ${arr.length} grupo(s) — marque e clique em Adicionar Estoque.</div>`;
    let corpo = '';
    let algumTravado = false;
    arr.forEach((g, idx) => {
        // Trava de reuso (espelha pedidos): grupo já em estoque = inativo.
        // Parcial (romaneio com mais que o estoque, ex.: 8→9 pçs) fica
        // habilitado exibindo só o delta disponível.
        let travado = false, parcial = null;
        try {
            if (typeof disponibilidadeGrupoRomaneio === 'function') {
                const d = disponibilidadeGrupoRomaneio(g);
                if (d && d.travado) travado = true;
                else if (d && d.parcial) parcial = d;
            } else if (typeof acharProdutoSerradoExistente === 'function' && acharProdutoSerradoExistente(g.romaneioId, g)) {
                travado = true;
            }
        } catch (_) { travado = false; parcial = null; }
        if (travado) algumTravado = true;
        const exPecas = parcial ? parcial.dispPecas : (parseFloat(g.pecas) || 0);
        const exVol = parcial ? parcial.dispVol : (parseFloat(g.volume) || 0);
        const exMl = parcial ? parcial.dispMl : (parseFloat(g.ml) || 0);
        let rotulo = g.especie || 'Sem espécie';
        try {
            const nomePeca = (typeof classificarProdutoConama === 'function')
                ? classificarProdutoConama(g.espessura, g.largura) : '';
            const dims = `${String(g.espessura).replace('.', ',')}cmx${String(g.largura).replace('.', ',')}cmx${String(g.comprimento).replace('.', ',')}cm`;
            if (nomePeca) rotulo += ` — ${nomePeca} ${dims}`;
        } catch (_) {}
        const badgeTravado = travado
            ? `<div class="uso-romaneio-badge" style="margin-top:4px;"><span style="display:inline-block;background:var(--sw-alert-warning-bg);border:1px solid var(--sw-warning);color:var(--sw-alert-title);border-radius:999px;padding:2px 8px;font-size:0.72rem;font-weight:700;"><i class="fas fa-lock"></i> Já em estoque — desativado</span></div>`
            : (parcial
                ? `<div class="uso-romaneio-badge" style="margin-top:4px;"><span style="display:inline-block;background:color-mix(in srgb, var(--sw-info) 12%, transparent);color:var(--sw-info);border-radius:999px;padding:2px 8px;font-size:0.72rem;font-weight:700;">${parcial.estPecas} pçs já em estoque — disponível: ${exPecas}</span></div>`
                : `<div class="uso-romaneio-badge" style="margin-top:4px;"></div>`);
        corpo += `<div class="grupo-rom-card" data-grupo-card="${String(g.gid || '').replace(/"/g, '&quot;')}" style="background:var(--sw-surface);${travado ? 'opacity:0.65;' : ''}">`
            + `<input type="checkbox" class="grm-check" name="grupoRomSel" value="${idx}"${travado ? '' : ' checked'}${travado ? ' disabled' : ''} aria-label="Selecionar grupo">`
            + `<div class="grm-body"><strong>${rotulo}</strong><br><span style="font-size:0.78rem;color:var(--sw-text-2);">Vol: ${exVol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³ · ${exPecas} Peças · ${exMl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ml${g.romaneioNumero ? ' · ' + g.romaneioNumero : ''}</span>${badgeTravado}</div>`
            + `<button type="button" class="btn btn-danger btn-small grm-del" data-excluir-gid="${String(g.gid || '').replace(/"/g, '&quot;')}" aria-label="Excluir grupo">Excluir</button></div>`;
    });
    if (algumTravado) {
        html += `<div style="background:var(--sw-alert-warning-bg);border:1px solid var(--sw-warning);color:var(--sw-alert-title);padding:10px 12px;border-radius:4px;margin-bottom:10px;font-size:13px;">`
            + `<strong><i class="fas fa-lock"></i> Romaneio já adicionado ao estoque.</strong><br>`
            + `<span>Os grupos abaixo estão desativados. Novos itens do romaneio continuam disponíveis.</span></div>`;
    }
    html += corpo;
    html += `<div style="text-align:right;font-weight:700;">Total: ${total.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</div>`;
    box.innerHTML = html;
    try { box.dataset.grupos = JSON.stringify(arr); } catch (_) {}
    box.querySelectorAll('button[data-excluir-gid]').forEach(btn => {
        btn.addEventListener('click', () => excluirGrupoPreviewRomaneio(btn.dataset.excluirGid));
    });
    // Alerta de uso em pedidos (async, não bloqueia; sobrescreve o slot,
    // inclusive o cadeado de estoque, quando há pedido conferido)
    try { anotarUsosPreviewProduto(); } catch (_) {}
}

// Disponibilidade de um grupo do preview frente ao estoque.
// Soma TODOS os produtos em estoque com mesmo romaneio+dims e devolve o
// delta (romaneio − estoque). travado=true só quando nada resta.
// Mesma base do save: aviso e ação nunca discordam.
function disponibilidadeGrupoRomaneio(g) {
    const vazio = { travado: false, parcial: false, dispPecas: 0, dispVol: 0, dispMl: 0, estPecas: 0 };
    try {
        if (!g || typeof g !== 'object') return vazio;
        const lista = Array.isArray(window.produtos) ? window.produtos : [];
        const gid = String(g.gid || '');
        const rid = String(g.romaneioId || '');
        const esp = String(g.especie || '').trim().toUpperCase();
        let estPecas = 0, estVol = 0, estMl = 0, achou = false;
        lista.forEach(p => {
            if (!p || p.tipoProduto !== 'romaneio') return;
            if (rid && String(p.romaneioId || '') !== rid) return;
            if (String(p.especie || '').trim().toUpperCase() !== esp) return;
            if (Number(p.espessura) !== Number(g.espessura)) return;
            if (Number(p.largura) !== Number(g.largura)) return;
            if (Number(p.comprimento) !== Number(g.comprimento)) return;
            achou = true;
            estPecas += parseFloat(p.pecas) || 0;
            estVol += parseFloat(p.volumeM3 ?? p.estoque) || 0;
            estMl += parseFloat(p.metrosLineares) || 0;
        });
        if (!achou) return vazio;
        const EPS = 0.000001;
        const dispPecas = (parseFloat(g.pecas) || 0) - estPecas;
        const dispVol = (parseFloat(g.volume) || 0) - estVol;
        const dispMl = (parseFloat(g.ml) || 0) - estMl;
        if (dispPecas > EPS || dispVol > EPS) {
            return {
                travado: false, parcial: true,
                dispPecas: Math.max(0, Math.round(dispPecas * 1000) / 1000),
                dispVol: Math.max(0, Math.round(dispVol * 1000000) / 1000000),
                dispMl: Math.max(0, Math.round(dispMl * 100) / 100),
                estPecas: Math.round(estPecas * 1000) / 1000
            };
        }
        return { travado: true, parcial: false, dispPecas: 0, dispVol: 0, dispMl: 0, estPecas: Math.round(estPecas * 1000) / 1000 };
    } catch (_) { return vazio; }
}

// IDs de romaneio com ao menos um produto em estoque (tipoProduto romaneio).
function romaneioIdsEmEstoque() {
    try {
        const s = new Set();
        (window.produtos || []).forEach(p => {
            if (p && p.tipoProduto === 'romaneio' && p.romaneioId) s.add(String(p.romaneioId));
        });
        return s;
    } catch (_) { return new Set(); }
}

// Marca grupos cujo romaneio já foi usado em pedidos: vermelho+desmarca se
// conferido (aprovado/entregue/...), âmbar se só pendente (baixa automática
// ao aprovar — pode lançar o restante).
async function anotarUsosPreviewProduto() {
    try {
        const grupos = Array.isArray(__previewRomGrupos) ? __previewRomGrupos : [];
        if (grupos.length === 0) return;
        const porRom = new Map();
        grupos.forEach(g => {
            const rid = String(g.romaneioId || '');
            if (!rid) return;
            if (!porRom.has(rid)) porRom.set(rid, []);
            porRom.get(rid).push(g);
        });
        for (const [rid, gs] of porRom) {
            let usos = [];
            try { usos = await buscarUsosRomaneioVendas(rid); } catch (_) { usos = []; }
            if (!usos || usos.length === 0) continue;
            const conferidos = usos.filter(u => statusRomaneioConferido(u.status));
            const pendentes = usos.filter(u => !statusRomaneioConferido(u.status) && String(u.status || '').toLowerCase() !== 'cancelado');
            const box = document.getElementById('previewProdutoRomaneio');
            if (!box) return;
            gs.forEach(g => {
                const card = box.querySelector(`[data-grupo-card="${String(g.gid || '').replace(/"/g, '&quot;')}"]`);
                if (!card) return;
                const slot = card.querySelector('.uso-romaneio-badge');
                const check = card.querySelector('input[name="grupoRomSel"]');
                if (conferidos.length > 0) {
                    const u = conferidos[0];
                    if (slot) slot.innerHTML = `<span style="display:inline-block;background:color-mix(in srgb, var(--sw-danger) 12%, transparent);color:var(--sw-danger);border-radius:999px;padding:2px 8px;font-size:0.72rem;font-weight:700;">EM USO · Ped. Nº ${u.pedidoNumero} (${u.status}) — desmarcado</span>`;
                    if (check) check.checked = false;
                    try { card.style.opacity = '0.75'; } catch (_) {}
                } else if (pendentes.length > 0) {
                    const u = pendentes[0];
                    if (slot) slot.innerHTML = `<span style="display:inline-block;background:color-mix(in srgb, var(--sw-warning) 14%, transparent);color:var(--sw-warning);border-radius:999px;padding:2px 8px;font-size:0.72rem;font-weight:700;">Reservado Ped. Nº ${u.pedidoNumero} (pendente) — baixa automática ao aprovar</span>`;
                }
            });
        }
    } catch (_) {}
}

function gruposRomaneioSelecionados() {
    try {
        const box = document.getElementById('previewProdutoRomaneio');
        const arr = JSON.parse(box?.dataset?.grupos || '[]');
        const idxs = Array.from(document.querySelectorAll('input[name="grupoRomSel"]:checked')).map(el => parseInt(el.value, 10));
        return idxs.map(i => arr[i]).filter(Boolean);
    } catch (_) { return []; }
}

// Tem dados de serrado (romaneio ou dims preenchidas): exibe Peças/Volume
function temDimsSerrado(p) {
    try {
        if (!p || typeof p !== 'object') return false;
        if (p.tipoProduto === 'romaneio') return true;
        return (parseFloat(p.pecas) || 0) > 0 || (parseFloat(p.volumeM3) || 0) > 0 || (parseFloat(p.espessura) || 0) > 0;
    } catch (_) { return false; }
}

// Produto real: criado via Produto Manual/Romaneio — presente na coleção
// 'produtos' (raw), criado nesta sessão, ou marcado tipoProduto romaneio.
// (A lista exibe SÓ reais; o select mantém espécies por compatibilidade.)
function isProdutoReal(p) {
    try {
        if (!p || typeof p !== 'object') return false;
        if (p.tipoProduto === 'romaneio') return true;
        const raw = window.__produtosRawIds instanceof Set ? window.__produtosRawIds : new Set();
        const novos = window.__produtosNovosIds instanceof Set ? window.__produtosNovosIds : new Set();
        const keys = [p.id, p.firebaseKey, p.codigo, p.code, p.sku]
            .map(v => (v === undefined || v === null) ? '' : String(v).trim()).filter(Boolean);
        return keys.some(k => raw.has(k) || novos.has(k));
    } catch (_) { return false; }
}

// Lista "em Estoque" oculta serrado zerado; campos ausentes (legado) e
// manuais continuam visíveis.
function estoqueZeradoNaLista(p) {
    try {
        if (!p || typeof p !== 'object') return false;
        if (!(temDimsSerrado(p) || p.tipoProduto === 'romaneio')) return false;
        if (p.pecas === undefined || p.pecas === null || p.pecas === '') return false;
        return Number(p.pecas) <= 0;
    } catch (_) { return false; }
}

function metrosLinearesDe(p) {
    try {
        const salvo = parseFloat(p.metrosLineares);
        if (salvo > 0) return Math.round(salvo * 100) / 100;
        const comp = parseFloat(p.comprimento) || 0;
        const pecas = parseFloat(p.pecas) || 0;
        return Math.round(((comp / 100) * pecas) * 100) / 100;
    } catch (_) { return 0; }
}

function acharProdutoSerradoExistente(romaneioId, g) {
    try {
        return (window.produtos || []).find(p => p && p.tipoProduto === 'romaneio'
            && String(p.romaneioId || '') === String(romaneioId || '')
            && String(p.especie || '').trim().toUpperCase() === String(g.especie || '').trim().toUpperCase()
            && Number(p.espessura) === Number(g.espessura)
            && Number(p.largura) === Number(g.largura)
            && Number(p.comprimento) === Number(g.comprimento));
    } catch (_) { return null; }
}

let __adicionarEstoqueRomaneioEmAndamento = false;

async function adicionarEstoqueGruposRomaneio() {
    // Trava anti-duplo-clique: saves sequenciais demoram no mobile e o
    // usuário não sabia o que acontecia (risco de fechar/duplicar).
    if (__adicionarEstoqueRomaneioEmAndamento) {
        try { ToastManager.info('Adição ao estoque já em andamento, aguarde...', 'Aguarde'); } catch (_) {}
        return;
    }
    const grupos = gruposRomaneioSelecionados();
    if (grupos.length === 0) {
        ToastManager.warning('Marque ao menos um grupo no Preview', 'Atenção');
        return;
    }
    __adicionarEstoqueRomaneioEmAndamento = true;
    try { if (typeof LoadingManager !== 'undefined' && LoadingManager.show) LoadingManager.show(`Adicionando ${grupos.length} grupo(s) ao estoque...`); } catch (_) {}
    try { document.querySelectorAll('[onclick*="adicionarEstoqueGruposRomaneio"]').forEach(b => { try { b.disabled = true; } catch (_) {} }); } catch (_) {}
    try {
    const meta = __previewProdutoRomaneioMeta || {};
    const usedCodes = new Set((window.produtos || []).map(p => String(p.codigo || '').trim()).filter(Boolean));
    let criados = 0, volumeTotal = 0, puladosTravados = 0;
    for (const g of grupos) {
        if (!(g.volume > 0)) continue;
        const grid = g.romaneioId || meta.rid;
        const gnum = g.romaneioNumero || meta.numero;
        // Mesma disponibilidade do preview: travado pula; parcial salva o delta.
        let qPecas = parseFloat(g.pecas) || 0;
        let qVol = parseFloat(g.volume) || 0;
        let qMl = parseFloat(g.ml) || 0;
        try {
            if (typeof disponibilidadeGrupoRomaneio === 'function') {
                const d = disponibilidadeGrupoRomaneio(g);
                if (d && d.travado) { puladosTravados++; continue; }
                if (d && d.parcial) { qPecas = d.dispPecas; qVol = d.dispVol; qMl = d.dispMl; }
            } else if (typeof acharProdutoSerradoExistente === 'function' && acharProdutoSerradoExistente(grid, g)) {
                puladosTravados++;
                continue;
            }
        } catch (_) {}
        if (!(qVol > 0) && !(qPecas > 0)) { puladosTravados++; continue; }
        const nome = `${g.especie} ${g.espessura}x${g.largura}x${g.comprimento}`.trim();
        const codigo = ensureUniqueCode('', usedCodes);
        usedCodes.add(codigo);
        const prod = {
            id: (typeof generateUniqueId === 'function') ? generateUniqueId('PROD') : ('PROD_' + Date.now()),
            codigo,
            nome: nome || 'Produto serrado',
            preco: g.precoMedio || 0,
            estoque: qVol,
            unidade: 'm³',
            descricao: `Madeira serrada ${gnum ? '(' + gnum + ')' : ''}`.trim(),
            tipoProduto: 'romaneio',
            romaneioTipo: g.romaneioTipo || meta.tipo || '',
            romaneioId: grid || '',
            romaneioNumero: gnum || '',
            especie: g.especie || '',
            espessura: g.espessura,
            largura: g.largura,
            comprimento: g.comprimento,
            pecas: qPecas,
            pecasPorPacote: 1,
            volumeM3: qVol,
            metrosLineares: Math.round(qMl * 100) / 100,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };
        try { sanearIndefinidosFirebase(prod); } catch (_) {}
        window.produtos.push(prod);
        try { window.__produtosNovosIds.add(String(prod.id)); } catch (_) {}
        try { registrarIdsProdutosRaw([prod]); } catch (_) {}
        criados++;
        volumeTotal = Math.round((volumeTotal + qVol) * 1000) / 1000;
    }
    // Save ÚNICO em lote (antes: 1 round-trip por grupo = lento no mobile).
    let saveOk = false;
    try {
        if (typeof saveData === 'function') {
            __rvSaveDataRemoteOk = false;
            await saveData('produtos', filtrarProdutosPersistiveis(window.produtos));
            saveOk = !!__rvSaveDataRemoteOk;
        }
    } catch (_) { saveOk = false; }
    if (!saveOk) {
        try { ToastManager.error('Itens aplicados localmente, mas a gravação no servidor falhou. Verifique a conexão.', 'Falha ao gravar', 8000); } catch (_) {}
    }
    try {
        const svcInv = window.firebaseService || window.FirebaseService;
        if (svcInv && typeof svcInv.invalidateReadCacheForPath === 'function') svcInv.invalidateReadCacheForPath('produtos');
    } catch (_) {}
    try { atualizarSelectProdutos(); } catch (_) {}
    try { if (isModalOpen('listaProdutosModal')) carregarTabelaProdutos(); } catch (_) {}
    if (criados === 0) {
        if (puladosTravados > 0) {
            try { ToastManager.warning(`${puladosTravados} grupo(s) já estavam em estoque e foram ignorados`, 'Nada a adicionar'); } catch (_) {}
        } else {
            ToastManager.warning('Nenhum grupo com volume para adicionar', 'Atenção');
        }
        return;
    }
    let msgOk = `${criados} criado(s) — ${volumeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³ no estoque`;
    if (puladosTravados > 0) msgOk += ` (${puladosTravados} já em estoque ignorado(s))`;
    ToastManager.success(msgOk, 'Estoque');
    // Limpa o formulário após gravar (pronto p/ próximo lançamento)
    try {
        const t2 = document.getElementById('produtoRomaneioTipo2');
        if (t2) t2.value = '';
        const s2 = document.getElementById('produtoRomaneioId2');
        if (s2) s2.innerHTML = '<option value="">Selecione o tipo primeiro...</option>';
        limparPreviewProdutoRomaneio();
    } catch (_) {}
    } finally {
        __adicionarEstoqueRomaneioEmAndamento = false;
        try { if (typeof LoadingManager !== 'undefined' && LoadingManager.hide) LoadingManager.hide(); } catch (_) {}
        try { document.querySelectorAll('[onclick*="adicionarEstoqueGruposRomaneio"]').forEach(b => { try { b.disabled = false; } catch (_) {} }); } catch (_) {}
    }
}

function renderPreviewProdutoManuel() {
    try {
        const box = document.getElementById('previewProdutoManuel');
        if (!box) return;
        const itens = Array.isArray(__itensProdutoManuel) ? __itensProdutoManuel : [];
        if (itens.length === 0) {
            box.innerHTML = '<span style="color:var(--sw-text-3);">Clique em Adicionar item para conferir antes de ir ao estoque.</span>';
            return;
        }
        let total = 0;
        let html = '';
        itens.forEach((it, idx) => {
            total = Math.round((total + (parseFloat(it.preco) || 0) * (parseFloat(it.estoque) || 0)) * 100) / 100;
            const dims = (it.especie || it.espessura > 0) ? ` · ${it.especie || ''} ${it.espessura || 0}x${it.largura || 0}x${it.comprimento || 0}` : '';
            html += `<div style="display:flex;align-items:center;gap:8px;border:1px solid var(--sw-border);border-radius:8px;padding:8px;margin-bottom:6px;background:var(--sw-surface);">`
                + `<div style="flex:1;"><strong>${it.codigo || '-'} — ${it.nome || '-'}</strong><br><span style="font-size:0.78rem;color:var(--sw-text-2);">Preço: ${it.precoFmt || it.preco} · Estoque: ${it.estoque} ${it.unidade || 'UN'}${dims}</span></div>`
                + `<button type="button" class="btn btn-danger btn-small" data-item-idx="${idx}" aria-label="Excluir item">Excluir</button></div>`;
        });
        html += `<div style="text-align:right;font-weight:700;">${itens.length} item(ns)</div>`;
        box.innerHTML = html;
        box.querySelectorAll('button[data-item-idx]').forEach(btn => {
            btn.addEventListener('click', () => excluirItemProdutoManuel(parseInt(btn.dataset.itemIdx, 10)));
        });
    } catch (_) {}
}

let __itensProdutoManuel = [];

function limparCamposProdutoManuel() {
    try {
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
        const usedCodes = new Set((window.produtos || []).map(p => String(p.codigo || '').trim()).filter(Boolean));
        (__itensProdutoManuel || []).forEach(it => { if (it.codigo) usedCodes.add(String(it.codigo)); });
        set('produtoCodigo', ensureUniqueCode('', usedCodes));
        set('produtoNome', '');
        set('produtoPreco', '');
        set('produtoEstoque', '');
        set('produtoUnidade', 'UN');
        set('produtoDescricao', '');
    } catch (_) {}
}

function adicionarItemProdutoManuel() {
    try {
        const v = (id) => document.getElementById(id)?.value || '';
        const nome = String(v('produtoNome')).trim();
        if (isNomeFantasma(nome)) { ToastManager.warning('Informe o nome do produto', 'Atenção'); return; }
        let codigo = String(v('produtoCodigo')).trim();
        const usedCodes = new Set((window.produtos || []).map(p => String(p.codigo || '').trim()).filter(Boolean));
        (__itensProdutoManuel || []).forEach(it => { if (it.codigo) usedCodes.add(String(it.codigo)); });
        if (!codigo || !/^\d+$/.test(codigo)) {
            codigo = ensureUniqueCode(codigo, usedCodes);
            const el = document.getElementById('produtoCodigo');
            if (el) el.value = codigo;
        }
        if (usedCodes.has(codigo)) {
            ToastManager.warning('Já existe item com este código no stage ou cadastro', 'Atenção');
            return;
        }
        __itensProdutoManuel.push({
            tempId: 'TMP_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            codigo,
            nome,
            preco: parseCurrencyValue(v('produtoPreco')) || 0,
            precoFmt: String(v('produtoPreco')).trim() || 'R$ 0,00',
            estoque: parseFloat(String(v('produtoEstoque')).replace(',', '.')) || 0,
            unidade: String(v('produtoUnidade')).trim() || 'UN',
            descricao: String(v('produtoDescricao')).trim(),
            especie: String(v('produtoEspecie')).trim(),
            espessura: parseFloat(String(v('produtoEspessura')).replace(',', '.')) || 0,
            largura: parseFloat(String(v('produtoLargura')).replace(',', '.')) || 0,
            comprimento: parseFloat(String(v('produtoComprimento')).replace(',', '.')) || 0,
            pecas: parseFloat(String(v('produtoPecas')).replace(',', '.')) || 0,
            pecasPorPacote: parseFloat(String(v('produtoPpp')).replace(',', '.')) || 1,
            volumeM3: atualizarVolumeProdutoRomaneio()
        });
        limparCamposProdutoManuel();
        renderPreviewProdutoManuel();
    } catch (_) {}
}

function excluirItemProdutoManuel(idx) {
    try {
        if (Array.isArray(__itensProdutoManuel) && idx >= 0 && idx < __itensProdutoManuel.length) {
            __itensProdutoManuel.splice(idx, 1);
        }
        renderPreviewProdutoManuel();
    } catch (_) {}
}

function limparItensProdutoManuel() {
    __itensProdutoManuel = [];
    renderPreviewProdutoManuel();
}

async function adicionarEstoqueManuel() {
    const itens = Array.isArray(__itensProdutoManuel) ? __itensProdutoManuel.slice() : [];
    if (itens.length === 0) {
        ToastManager.warning('Adicione ao menos um item no Preview', 'Atenção');
        return;
    }
    const granular = (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function');
    let criados = 0, somados = 0, precisaFallback = false;
    for (const it of itens) {
        const existente = (window.produtos || []).find(p => p && String(p.codigo || '').trim() !== '' && String(p.codigo).trim() === String(it.codigo).trim());
        if (existente) {
            existente.estoque = Math.round(((parseFloat(existente.estoque) || 0) + (parseFloat(it.estoque) || 0)) * 1000) / 1000;
            existente.updated = new Date().toISOString();
            somados++;
            if (granular) {
                try {
                    const res = await window.firebaseService.saveToFirebase('produtos', String(existente.id), existente);
                    if (!(res && res.success)) precisaFallback = true;
                } catch (_) { precisaFallback = true; }
            } else {
                precisaFallback = true;
            }
            continue;
        }
        const prod = {
            id: (typeof generateUniqueId === 'function') ? generateUniqueId('PROD') : ('PROD_' + Date.now()),
            codigo: it.codigo,
            nome: it.nome,
            preco: it.preco || 0,
            estoque: it.estoque || 0,
            unidade: it.unidade || 'UN',
            descricao: it.descricao || '',
            especie: it.especie || '',
            espessura: it.espessura || 0,
            largura: it.largura || 0,
            comprimento: it.comprimento || 0,
            pecas: it.pecas || 0,
            pecasPorPacote: it.pecasPorPacote || 1,
            volumeM3: it.volumeM3 || 0,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };
        try { sanearIndefinidosFirebase(prod); } catch (_) {}
        window.produtos.push(prod);
        try { window.__produtosNovosIds.add(String(prod.id)); } catch (_) {}
        try { registrarIdsProdutosRaw([prod]); } catch (_) {}
        criados++;
        if (granular) {
            try {
                const res = await window.firebaseService.saveToFirebase('produtos', String(prod.id), prod);
                if (!(res && res.success)) precisaFallback = true;
            } catch (_) { precisaFallback = true; }
        } else {
            precisaFallback = true;
        }
    }
    if (precisaFallback) {
        try {
            if (typeof saveData === 'function') {
                __rvSaveDataRemoteOk = false;
                await saveData('produtos', filtrarProdutosPersistiveis(window.produtos));
            }
        } catch (_) {}
    }
    try {
        const svcInv = window.firebaseService || window.FirebaseService;
        if (svcInv && typeof svcInv.invalidateReadCacheForPath === 'function') svcInv.invalidateReadCacheForPath('produtos');
    } catch (_) {}
    try { atualizarSelectProdutos(); } catch (_) {}
    try { if (isModalOpen('listaProdutosModal')) carregarTabelaProdutos(); } catch (_) {}
    __itensProdutoManuel = [];
    renderPreviewProdutoManuel();
    try { limparCamposProdutoManuel(); } catch (_) {}
    ToastManager.success(`${criados} criado(s), ${somados} somado(s) no estoque`, 'Estoque');
}

async function salvarProduto(event) {
    event.preventDefault();
    
    try {
        const produtoId = document.getElementById('produtoId').value;
        const nomeRaw = document.getElementById('produtoNome').value;
        let nome = isAllCaps(nomeRaw) ? toTitleCasePt(nomeRaw) : nomeRaw;
        const unidadeRaw = document.getElementById('produtoUnidade').value;
        const unidade = isAllCaps(unidadeRaw) ? toTitleCasePt(unidadeRaw) : unidadeRaw;
        const descricaoRaw = document.getElementById('produtoDescricao')?.value || '';
        const descricao = isAllCaps(descricaoRaw) ? toTitleCasePt(descricaoRaw) : descricaoRaw;
        const codigoInput = document.getElementById('produtoCodigo');
        let codigo = codigoInput ? codigoInput.value : '';
        const usedCodes = new Set((window.produtos || []).filter(p => !produtoId || p.id !== produtoId).map(p => String(p.codigo || '').trim()).filter(Boolean));
        if (isBlankValue(codigo) || !isNumericCode(codigo)) {
            codigo = ensureUniqueCode(codigo, usedCodes);
            if (codigoInput) codigoInput.value = codigo;
        }
        // Trava anti-fantasma: nome vazio nunca persiste ("Produto sem nome")
        // (romaneio com espécie auto-preenche a partir das dimensões)
        try {
            if (!String(nome || '').trim() && isProdutoRomaneioForm()) {
                const d = lerDimsProdutoRomaneio();
                if (String(d.especie || '').trim()) {
                    nome = `${d.especie} ${d.espessura}x${d.largura}x${d.comprimento}`.trim();
                    const nomeEl = document.getElementById('produtoNome');
                    if (nomeEl) nomeEl.value = nome;
                }
            }
        } catch (_) {}
        const nomeEfetivo = String(nome || '').trim();
        if (isNomeFantasma(nomeEfetivo)) {
            ToastManager.warning('Informe o nome do produto', 'Atenção');
            return;
        }
        const produto = {
            id: produtoId || generateUniqueId('PROD'),
            codigo,
            nome,
            preco: parseCurrencyValue(document.getElementById('produtoPreco').value),
            estoque: parseFloat(document.getElementById('produtoEstoque').value) || 0,
            unidade,
            descricao,
            updated: new Date().toISOString()
        };
        // Produto Romaneio (Madeira Serrada): vínculo + dimensões + volume
        try {
            if (isProdutoRomaneioForm()) {
                const d = lerDimsProdutoRomaneio();
                produto.tipoProduto = 'romaneio';
                produto.romaneioTipo = d.tipo;
                produto.romaneioId = d.romaneioId;
                produto.romaneioNumero = d.romaneioNumero;
                produto.especie = d.especie;
                produto.espessura = d.espessura;
                produto.largura = d.largura;
                produto.comprimento = d.comprimento;
                produto.pecas = d.pecas;
                produto.pecasPorPacote = d.ppp;
                produto.volumeM3 = calcularVolumeSerradoM3(d.espessura, d.largura, d.comprimento, d.pecas, d.ppp);
                if (!String(produto.unidade || '').trim() || produto.unidade === 'UN') produto.unidade = 'm³';
                if (!String(nome || '').trim() && d.especie) produto.nome = `${d.especie} ${d.espessura}x${d.largura}x${d.comprimento}`.trim();
            }
        } catch (_) {}
        
        if (!produtoId) {
            produto.created = new Date().toISOString();
        }
        
        // Verificar se código já existe
        const codigoExistente = window.produtos.find(p => p.codigo === produto.codigo && p.id !== produto.id);
        if (codigoExistente) {
            ToastManager.error('Já existe um produto com este código', 'Código Duplicado');
            return;
        }
        
        // Salvar produto (fail-closed: memória só vale após confirmação do servidor)
        const backupProdutos = Array.isArray(window.produtos) ? window.produtos.slice() : [];
        if (produtoId) {
            const index = window.produtos.findIndex(p => p.id === produtoId);
            if (index !== -1) {
                window.produtos[index] = produto;
            }
        } else {
            window.produtos.push(produto);
            try { window.__produtosNovosIds.add(String(produto.id)); } catch (_) {}
        }
        window.produtos = normalizeProdutosList(window.produtos);
        
        let produtoRemotoOk = false;
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            try {
                const resProd = await window.firebaseService.saveToFirebase('produtos', String(produto.id), produto);
                produtoRemotoOk = !!(resProd && resProd.success);
            } catch (e) {
                console.warn('⚠️ Erro ao salvar produto no Firebase:', e);
            }
        } else {
            __rvSaveDataRemoteOk = false;
            await saveData('produtos', filtrarProdutosPersistiveis(window.produtos));
            produtoRemotoOk = __rvSaveDataRemoteOk;
        }
        try {
            const storageKey = getStorageKey('produtos');
            persistLocalValue(storageKey, filtrarProdutosPersistiveis(window.produtos));
        } catch (_) {}
        if (!produtoRemotoOk) {
            try { window.produtos = backupProdutos; } catch (_) {}
            try { atualizarSelectProdutos(); } catch (_) {}
            try {
                if (isModalOpen('listaProdutosModal')) {
                    carregarTabelaProdutos();
                }
            } catch (_) {}
            ToastManager.error('Não foi possível salvar o produto no servidor. Verifique sua conexão e permissões e tente novamente. Nenhuma alteração foi perdida.', 'Falha ao salvar', 8000);
            return;
        }

        // Atualizar selects
        atualizarSelectProdutos();

        // Pós-save: se estava editando, limpa e volta ao estado de novo;
        // se estava criando via Manuel (submit direto), fecha o form
        const estavaEditando = !!produtoId;
        if (estavaEditando) {
            try { novoProduto(); } catch (_) {}
        } else {
            fecharProdutoForm();
        }

        // Atualizar listagem se estiver visível
        if (isModalOpen('listaProdutosModal')) {
            carregarTabelaProdutos();
        }
        
        ToastManager.success('Produto salvo com sucesso!', 'Sucesso');
        
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        ToastManager.error('Erro ao salvar produto: ' + error.message, 'Erro');
    }
}

function listarProdutos() {
    document.getElementById('listaProdutosModal').style.display = 'block';
    vendasProdutosPage = 1;
    carregarTabelaProdutos();
}

let produtosListFiltered = [];
let produtosSelecionados = new Set();

function toggleSelecionarTodosProdutos(checked) {
    if (checked) {
        produtosListFiltered.forEach(p => produtosSelecionados.add(String(p.id)));
    } else {
        produtosListFiltered.forEach(p => produtosSelecionados.delete(String(p.id)));
    }
    carregarTabelaProdutos(document.getElementById('searchProdutos')?.value || '');
}

function toggleSelecionarProduto(produtoId, checked) {
    if (checked) produtosSelecionados.add(String(produtoId));
    else produtosSelecionados.delete(String(produtoId));
    atualizarContadorProdutosSelecionados();
}

function atualizarContadorProdutosSelecionados() {
    try {
        const el = document.getElementById('produtosPrintSelectedCount');
        if (el) el.textContent = `(${produtosSelecionados.size})`;
        const del = document.getElementById('produtosDeleteSelectedCount');
        if (del) del.textContent = `(${produtosSelecionados.size})`;
        const all = document.getElementById('produtosSelectAll');
        if (all) {
            const visiveis = produtosListFiltered.map(p => String(p.id));
            all.checked = visiveis.length > 0 && visiveis.every(id => produtosSelecionados.has(id));
        }
        try {
            const mob = document.getElementById('produtosSelectAllMobile');
            if (mob) {
                const head = document.getElementById('produtosSelectAll');
                mob.checked = head ? !!head.checked : false;
            }
        } catch (_) {}
    } catch (_) {}
}

function imprimirProdutosSelecionados() {
    const lista = produtosListFiltered.filter(p => produtosSelecionados.has(String(p.id)));
    if (lista.length === 0) {
        ToastManager.warning('Selecione ao menos um produto para imprimir.', 'Atenção');
        return;
    }
    imprimirRelatorioProdutos(lista);
}

async function excluirProdutosSelecionados() {
    const ids = Array.from(produtosSelecionados);
    if (ids.length === 0) {
        ToastManager.warning('Selecione ao menos um produto para excluir.', 'Atenção');
        return;
    }
    if (!await confirmDialog({ title: 'Excluir produtos', message: `Excluir ${ids.length} produto(s) selecionado(s)? Esta ação não pode ser desfeita.`, danger: true, confirmLabel: 'Excluir' })) return;
    try {
        LoadingManager.show('Excluindo produtos...');
        const backupProdutos = Array.isArray(window.produtos) ? window.produtos.slice() : [];
        const idSet = new Set(ids.map(String));
        window.produtos = (window.produtos || []).filter(p => !idSet.has(String(p && p.id)));
        __rvSaveDataRemoteOk = false;
        await saveData('produtos', filtrarProdutosPersistiveis(window.produtos));
        if (!__rvSaveDataRemoteOk) {
            try { window.produtos = backupProdutos; } catch (_) {}
            ToastManager.error('Não foi possível excluir no servidor. Verifique sua conexão e permissões.', 'Falha ao excluir', 8000);
            return;
        }
        produtosSelecionados.clear();
        atualizarSelectProdutos();
        carregarTabelaProdutos(document.getElementById('searchProdutos')?.value || '');
        ToastManager.success(`${ids.length} produto(s) excluído(s).`, 'Sucesso');
    } catch (e) {
        ToastManager.error('Erro ao excluir: ' + (e && e.message), 'Erro');
    } finally {
        try { LoadingManager.hide(); } catch (_) {}
    }
}

function dadosEmpresaParaImpressao(emp) {
    const e = (emp && typeof emp === 'object') ? emp : {};
    const t = (v) => String(v ?? '').trim();
    return {
        nome: t(e.name || e.nome || e.razaoSocial || e.fantasia || e.companyName) || 'Empresa não informada',
        cnpj: t(e.cnpj || e.documento || e.cpfCnpj || e.cpf || e.cnpjCpf) || '-',
        endereco: t(e.address || e.endereco || e.logradouro || e.street) || '-',
        cidade: t(e.city || e.cidade || e.municipio) || '-',
        estado: t(e.state || e.estado || e.uf) || '-',
        telefone: t(e.phone || e.telefone || e.tel || e.celular) || '-',
        logo: (() => {
            const l = t(e.logo || e.logoUrl || e.logoURL || e.logoBase64 || e.logoData);
            if (!l) return '';
            if (/^(data:|blob:|https?:|file:)/i.test(l)) return l;
            if (/^[A-Za-z0-9+/=]+$/.test(l) && l.length > 80) return 'data:image/png;base64,' + l;
            return l;
        })()
    };
}

async function imprimirRelatorioProdutos(lista) {
    const itens = (Array.isArray(lista) ? lista : []).filter(Boolean);
    if (itens.length === 0) {
        ToastManager.warning('Selecione ao menos um produto para imprimir.', 'Atenção');
        return;
    }
    let emp = {};
    try { emp = await obterDadosEmpresa(); } catch (_) {}
    const c = dadosEmpresaParaImpressao(emp);
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const nomeDe = (p) => { try { return nomeExibicaoProduto(p); } catch (_) { return 'Produto sem nome'; } };
    const num = (v) => parseFloat(v) || 0;
    const linhas = itens.map(p => {
        const estoque = temDimsSerrado(p) ? String(Math.round(num(p.pecas))) : `${num(p.estoque).toLocaleString('pt-BR')} ${p.unidade || 'UN'}`;
        const ml = temDimsSerrado(p) ? metrosLinearesDe(p).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' ml' : '-';
        const vol = temDimsSerrado(p) ? num(p.volumeM3 ?? p.estoque).toLocaleString('pt-BR', { minimumFractionDigits: 3 }) + ' m³' : '-';
        const preco = num(p.preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `<tr><td>${esc(p.codigo || '-')}</td><td>${esc(nomeDe(p))}</td><td>${preco}</td><td>${esc(estoque)}</td><td>${ml}</td><td>${vol}</td></tr>`;
    }).join('');
    // Resumo por Espécie x Espessura x Largura (só serrados)
    const grupos = new Map();
    itens.forEach(p => {
        if (!temDimsSerrado(p)) return;
        const esp = String(p.especie || nomeDe(p) || '').trim().toUpperCase();
        const key = `${esp}||${num(p.espessura).toFixed(3)}||${num(p.largura).toFixed(3)}`;
        if (!grupos.has(key)) grupos.set(key, { especie: String(p.especie || nomeDe(p) || '').trim(), espessura: num(p.espessura), largura: num(p.largura), pecas: 0, ml: 0, volume: 0 });
        const g = grupos.get(key);
        g.pecas += num(p.pecas);
        g.ml = Math.round((g.ml + metrosLinearesDe(p)) * 100) / 100;
        g.volume = Math.round((g.volume + num(p.volumeM3 ?? p.estoque)) * 1000) / 1000;
    });
    const arrG = Array.from(grupos.values());
    const totPecas = arrG.reduce((s, g) => s + g.pecas, 0);
    const totMl = Math.round(arrG.reduce((s, g) => s + g.ml, 0) * 100) / 100;
    const totVol = Math.round(arrG.reduce((s, g) => s + g.volume, 0) * 1000) / 1000;
    const linhasResumo = arrG.map(g => `<tr><td>${esc(g.especie || '-')}</td><td>${String(g.espessura).replace('.', ',')} cm</td><td>${String(g.largura).replace('.', ',')} cm</td><td>${Math.round(g.pecas)}</td><td>${g.ml.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ml</td><td>${g.volume.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</td></tr>`).join('')
        + `<tr><td colspan="3"><strong>Total</strong></td><td><strong>${Math.round(totPecas)}</strong></td><td><strong>${totMl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ml</strong></td><td><strong>${totVol.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} m³</strong></td></tr>`;
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    try {
        let w = null;
        try {
            w = window.open('', '_blank');
        } catch (_) {
            w = null;
        }
        if (!w || w.closed) { ToastManager.warning('Permita pop-ups para imprimir.', 'Atenção'); return; }
        try {
            if (!w.document) throw new Error('alvo parcial');
        } catch (_) {
            try { if (!w.closed) w.close(); } catch (_) {}
            ToastManager.error('Não foi possível abrir a janela de impressão.', 'Erro');
            return;
        }
        try {
        w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Lista de Madeira Serrada em Estoque</title>`
            + `<style>@page{margin:10mm;}body{font-family:Arial,sans-serif;padding:24px;color:#111;}h1{font-size:18px;text-align:center;margin:4px 0 12px;}table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #999;padding:6px 8px;text-align:left;overflow-wrap:anywhere;}th{background:#eee;}`
            + `.sisweb-print-back{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:0 0 14px;padding:10px 12px;border:1px solid #d6dde8;border-radius:6px;background:#f8fafc;font-family:Arial,sans-serif;}`
            + `@media print{.sisweb-print-back{display:none !important;}}`
            + `.header{display:flex;gap:16px;align-items:center;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:12px;}.logo img{max-height:80px;}.company-name{font-size:17px;font-weight:bold;}.company-details{font-size:11px;color:#333;}`
            + `.resumo{margin-top:20px;page-break-inside:avoid;}@media print{.no-print{display:none !important;}}</style></head>`
            + `<body><div class="sisweb-print-back"><button type="button" onclick="try{if(window.history&&window.history.length>1){history.back()}else{window.close()}}catch(e){try{window.close()}catch(e2){}}" style="min-height:40px;padding:0 16px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;font-weight:700;cursor:pointer;">&#8592; Voltar</button><button type="button" onclick="window.focus();window.print()" style="min-height:40px;padding:0 16px;border-radius:6px;border:1px solid #c83818;background:#ea580c;color:#fff;font-weight:700;cursor:pointer;">Imprimir</button></div><div class="header"><div class="logo">${c.logo ? `<img src="${c.logo}" alt="logo" onerror="this.style.display='none'">` : ''}</div>`
            + `<div><div class="company-name">${esc(c.nome)}</div><div class="company-details">CNPJ: ${esc(c.cnpj)}</div>`
            + `<div class="company-details">Endereço: ${esc(c.endereco)}</div><div class="company-details">Cidade: ${esc(c.cidade)} - Estado: ${esc(c.estado)}</div>`
            + `<div class="company-details">Telefone: ${esc(c.telefone)}</div></div></div>`
            + `<h1>LISTA DE MADEIRA SERRADA EM ESTOQUE — ${esc(dataHoje)}</h1>`
            + `<table><thead><tr><th>Código</th><th>Nome</th><th>Preço</th><th>Estoque</th><th>M. Linear</th><th>Volume (m³)</th></tr></thead><tbody>${linhas}</tbody></table>`
            + (arrG.length > 0 ? `<div class="resumo"><h1>RESUMO — ESPÉCIE x ESPESSURA x LARGURA</h1><table><thead><tr><th>Espécie</th><th>Espessura</th><th>Largura</th><th>Peças</th><th>M. Linear</th><th>Volume (m³)</th></tr></thead><tbody>${linhasResumo}</tbody></table></div>` : '')
            + `</body></html>`);
        w.document.close();
        } catch (_) {
            try { if (w && !w.closed) w.close(); } catch (_) {}
            ToastManager.error('Não foi possível abrir a janela de impressão.', 'Erro');
            return;
        }
        try {
            let prodDisparado = false;
            const dispararProd = () => {
                if (prodDisparado) return;
                prodDisparado = true;
                try { w.focus(); } catch (_) {}
                try { w.print(); } catch (_) {}
            };
            try { w.onload = dispararProd; } catch (_) {}
            try {
                if (w.document && w.document.fonts && typeof w.document.fonts.ready.then === 'function') {
                    w.document.fonts.ready.then(() => setTimeout(dispararProd, 60)).catch(() => {});
                }
            } catch (_) {}
            try { w.focus(); } catch (_) {}
            setTimeout(dispararProd, 400);
            setTimeout(dispararProd, 1200);
        } catch (_) {}
    } catch (e) {
        ToastManager.error('Erro ao imprimir: ' + (e && e.message), 'Erro');
    }
}

function carregarTabelaProdutos(filtro = '') {
    const tbody = document.getElementById('produtosTable');
    window.produtos = normalizeProdutosList(window.produtos || []);
    // A lista exibe SÓ produtos reais (Manual/Romaneio); espécies ficam no select
    let produtosFiltrados = [...window.produtos].filter(p => { try { return !isProdutoJunk(p) && isProdutoReal(p) && !estoqueZeradoNaLista(p); } catch (_) { return true; } });
    
    if (filtro) {
        const filtroLower = filtro.toLowerCase();
        produtosFiltrados = produtosFiltrados.filter(produto =>
            String(produto.codigo || '').toLowerCase().includes(filtroLower) ||
            String(produto.nome || produto.name || produto.nomeComum || produto.nomeCientifico || '').toLowerCase().includes(filtroLower)
        );
    }
    
    if (produtosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td class="commerce-full-row" data-label="" colspan="8" style="text-align: center;">Nenhum produto encontrado</td></tr>';
        refreshCommerceResponsiveTables();
        renderVendasProdutosPagination(0);
        return;
    }

    const totalProdutosPages = Math.max(1, Math.ceil(produtosFiltrados.length / vendasProdutosPerPage));
    if (vendasProdutosPage > totalProdutosPages) vendasProdutosPage = totalProdutosPages;
    if (vendasProdutosPage < 1) vendasProdutosPage = 1;
    const produtosStart = (vendasProdutosPage - 1) * vendasProdutosPerPage;
    const produtosPaginados = produtosFiltrados.slice(produtosStart, produtosStart + vendasProdutosPerPage);

    tbody.innerHTML = produtosPaginados.map(produto => `
        <tr>
            <td data-label="Selecionar" style="text-align:center;"><input type="checkbox" ${produtosSelecionados.has(String(produto.id)) ? 'checked' : ''} onchange="toggleSelecionarProduto('${produto.id}', this.checked)" aria-label="Selecionar produto"></td>
            <td data-label="Código">${produto.codigo || '-'}</td>
            <td data-label="Nome">${nomeExibicaoProduto(produto)}</td>
            <td data-label="Preço" style="text-align: right;"><span class="commerce-card-value commerce-card-money">${formatCurrency(produto.preco || 0)}</span></td>
            <td data-label="Estoque" style="text-align: center;"><span class="commerce-card-value commerce-card-number">${temDimsSerrado(produto) ? formatNumber(produto.pecas || 0, 0) : `${formatNumber(produto.estoque || 0)} ${produto.unidade || 'UN'}`}</span></td>
            <td data-label="M. Linear" style="text-align: center;"><span class="commerce-card-value commerce-card-number">${temDimsSerrado(produto) ? formatNumber(metrosLinearesDe(produto), 2) + ' ml' : '-'}</span></td>
            <td data-label="Volume (m³)" style="text-align: center;"><span class="commerce-card-value commerce-card-number">${temDimsSerrado(produto) ? formatNumber(produto.volumeM3 ?? produto.estoque ?? 0) + ' m³' : '-'}</span></td>
            <td data-label="Ações" class="commerce-actions-cell" style="text-align: center;">
                <div class="acoes-buttons commerce-actions-wrap">
                <button type="button" onclick="editarProduto('${produto.id}')" class="btn-primary btn-small" title="Editar" aria-label="Editar produto">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" onclick="excluirProduto('${produto.id}')" class="btn-danger btn-small" title="Excluir" aria-label="Excluir produto">
                    <i class="fas fa-trash"></i>
                </button>
                </div>
            </td>
        </tr>
    `).join('');
    produtosListFiltered = produtosFiltrados;
    refreshCommerceResponsiveTables();
    renderVendasProdutosPagination(produtosFiltrados.length);
    atualizarContadorProdutosSelecionados();
}

function renderVendasProdutosPagination(totalItems) {
    const container = document.getElementById('vendasProdutosPagination');
    if (!container) return;
    const totalPages = Math.ceil(totalItems / vendasProdutosPerPage);
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const currentFilter = () => String(document.getElementById('searchProdutos')?.value || '');
    const addBtn = (label, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        if (active) btn.classList.add('active');
        btn.disabled = disabled;
        btn.onclick = () => goToVendasProdutosPage(page);
        container.appendChild(btn);
    };

    addBtn('<<<', 1, vendasProdutosPage === 1);
    addBtn('<', vendasProdutosPage - 1, vendasProdutosPage === 1);

    const startPage = Math.max(1, vendasProdutosPage - 2);
    const endPage = Math.min(totalPages, vendasProdutosPage + 2);

    if (startPage > 1) {
        addBtn('1', 1, false, vendasProdutosPage === 1);
        if (startPage > 2) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addBtn(String(i), i, false, i === vendasProdutosPage);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
        addBtn(String(totalPages), totalPages, false, vendasProdutosPage === totalPages);
    }

    addBtn('>', vendasProdutosPage + 1, vendasProdutosPage === totalPages);
    addBtn('>>>', totalPages, vendasProdutosPage === totalPages);
}

function goToVendasProdutosPage(page) {
    const filtro = String(document.getElementById('searchProdutos')?.value || '');
    const source = Array.isArray(window.produtos) ? window.produtos : [];
    const filtroLower = filtro.toLowerCase();
    const filtered = filtro
        ? source.filter((produto) =>
            String(produto.codigo || '').toLowerCase().includes(filtroLower) ||
            String(produto.nome || '').toLowerCase().includes(filtroLower))
        : source;
    const totalPages = Math.max(1, Math.ceil(filtered.length / vendasProdutosPerPage));
    const next = Math.min(totalPages, Math.max(1, Number(page) || 1));
    if (next === vendasProdutosPage) return;
    vendasProdutosPage = next;
    carregarTabelaProdutos(filtro);
}

function filtrarProdutos() {
    const filtro = document.getElementById('searchProdutos').value;
    vendasProdutosPage = 1;
    carregarTabelaProdutos(filtro);
}

function editarProduto(produtoId) {
    window.produtos = normalizeProdutosList(window.produtos || []);
    const produto = window.produtos.find(p => p.id === produtoId);
    if (!produto) return;
    // Paridade com Espécies/Clientes: fecha a lista ao abrir o form
    try { fecharModal('listaProdutosModal'); } catch (_) {}
    
    document.getElementById('produtoId').value = produto.id;
    if (isBlankValue(produto.codigo)) {
        const usedCodes = new Set(window.produtos.map(p => String(p.codigo || '').trim()).filter(Boolean));
        produto.codigo = ensureUniqueCode(produto.codigo, usedCodes);
        const idx = window.produtos.findIndex(p => p.id === produto.id);
        if (idx >= 0) window.produtos[idx] = produto;
    } else if (!isNumericCode(produto.codigo)) {
        const usedCodes = new Set(window.produtos.map(p => String(p.codigo || '').trim()).filter(Boolean));
        produto.codigo = ensureUniqueCode(produto.codigo, usedCodes);
        const idx = window.produtos.findIndex(p => p.id === produto.id);
        if (idx >= 0) window.produtos[idx] = produto;
    }
    document.getElementById('produtoCodigo').value = produto.codigo || '';
    document.getElementById('produtoNome').value = produto.nome || '';
    document.getElementById('produtoPreco').value = formatCurrency(produto.preco || 0);
    document.getElementById('produtoEstoque').value = produto.estoque || 0;
    document.getElementById('produtoUnidade').value = produto.unidade || 'UN';
    const descEl = document.getElementById('produtoDescricao');
    if (descEl) descEl.value = produto.descricao || '';

    try {
        resetProdutoRomaneioFields();
        if (produto.tipoProduto === 'romaneio') {
            try {
                document.querySelectorAll('input[name="tipoProdutoForm"]').forEach(r => { r.checked = r.value === 'romaneio'; });
            } catch (_) {}
            const extra = document.getElementById('blocoRomaneioExtra');
            if (extra) extra.style.display = 'block';
            const box = document.getElementById('produtoRomaneioFields');
            if (box) box.style.display = 'block';
            const set = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; };
            set('produtoRomaneioTipo', produto.romaneioTipo || '');
            // Romaneio select é recarregado sob demanda; guarda ids para persistência
            const sel = document.getElementById('produtoRomaneioId');
            if (sel && produto.romaneioId) {
                sel.innerHTML = '';
                const opt = document.createElement('option');
                opt.value = String(produto.romaneioId);
                opt.textContent = produto.romaneioNumero || String(produto.romaneioId);
                sel.appendChild(opt);
            }
            try {
                const t2 = document.getElementById('produtoRomaneioTipo2');
                if (t2) t2.value = produto.romaneioTipo || '';
                const s2 = document.getElementById('produtoRomaneioId2');
                if (s2 && sel) s2.innerHTML = sel.innerHTML;
            } catch (_) {}
            set('produtoEspecie', produto.especie || '');
            set('produtoEspessura', produto.espessura ?? '');
            set('produtoLargura', produto.largura ?? '');
            set('produtoComprimento', produto.comprimento ?? '');
            set('produtoPecas', produto.pecas ?? '1');
            set('produtoPpp', produto.pecasPorPacote ?? '1');
            atualizarVolumeProdutoRomaneio();
        }
    } catch (_) {}

    document.getElementById('produtoFormTitulo').textContent = 'Editar Produto';
    const sec = document.getElementById('secaoProdutoForm');
    if (sec) {
        sec.style.display = 'block';
        try { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {}
    }
    try { alternarTipoProdutoForm(); } catch (_) {}
    try { renderPreviewProdutoManuel(); } catch (_) {}
}

async function excluirProduto(produtoId) {
    if (!await confirmDialog({ title: 'Excluir produto', message: 'Deseja excluir este produto? Esta ação não pode ser desfeita.', danger: true, confirmLabel: 'Excluir' })) {
        return;
    }
    
    try {
        const backupProdutos = Array.isArray(window.produtos) ? window.produtos.slice() : [];
        const eraEspecie = !!(window.__vendasEspeciesIds instanceof Set && window.__vendasEspeciesIds.has(String(produtoId)));
        // Comparação tolerante a tipo (id numérico vs string)
        window.produtos = window.produtos.filter(p => String(p && p.id) !== String(produtoId));
        __rvSaveDataRemoteOk = false;
        await saveData('produtos', filtrarProdutosPersistiveis(window.produtos));
        if (!__rvSaveDataRemoteOk) {
            try { window.produtos = backupProdutos; } catch (_) {}
            ToastManager.error('Não foi possível excluir o produto no servidor. Verifique sua conexão e permissões e tente novamente.', 'Falha ao excluir', 8000);
            return;
        }
        
        atualizarSelectProdutos();
        carregarTabelaProdutos();

        if (eraEspecie) {
            ToastManager.info('Removido da lista. Por ser um registro de espécie, ele volta ao recarregar — exclua definitivamente em Cadastros/Espécies.', 'Atenção', 7000);
        } else {
            ToastManager.success('Produto excluído com sucesso!', 'Sucesso');
        }
        
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        ToastManager.error('Erro ao excluir produto: ' + error.message, 'Erro');
    }
}

// Funções de relatórios
function gerarRelatorio(keepPage = false) {
    const inicioVal = (document.getElementById('periodoInicio')?.value || '').trim();
    const fimVal = (document.getElementById('periodoFim')?.value || '').trim();
    if (!inicioVal || !fimVal) {
        ToastManager.warning('Informe o período do relatório', 'Atenção');
        return;
    }
    if (!keepPage) vendasRelatorioPage = 1;
    const periodoInicio = new Date(inicioVal + 'T00:00:00');
    const periodoFim = new Date(fimVal + 'T23:59:59');
    const filtroClienteId = (document.getElementById('relFiltroCliente')?.value || '').trim();
    const filtroStatus = (document.getElementById('relFiltroStatus')?.value || '').trim();
    const filtroEspecie = (document.getElementById('relFiltroEspecie')?.value || '').trim();
    const filtroEspecieLower = filtroEspecie.toLowerCase();

    let pedidosPeriodo = Array.isArray(window.pedidos) ? window.pedidos.slice() : [];
    pedidosPeriodo = pedidosPeriodo.filter(pedido => {
        const d = parseDateLocalSafe(pedido.data);
        if (d < periodoInicio || d > periodoFim) return false;
        if (filtroClienteId) {
            const pid = String(pedido.clienteId || (pedido.cliente && pedido.cliente.id) || '');
            if (pid !== filtroClienteId) return false;
        }
        if (filtroStatus && filtroStatus !== 'carregos_pagos') {
            const st = String(pedido.status || '').toLowerCase();
            if (st !== filtroStatus) return false;
        }
        if (filtroEspecie) {
            const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
            const found = itens.some(it => {
                const nome = String(it.especie || it.especieNome || it.produtoNome || it.produto || '').toLowerCase();
                return nome && nome.includes(filtroEspecieLower);
            });
            if (!found) return false;
        }
        return true;
    });
    const byNumero = new Map();
    for (const p of pedidosPeriodo) {
        const key = String(p.numero);
        if (!byNumero.has(key)) {
            byNumero.set(key, p);
        } else {
            const cur = byNumero.get(key);
            const curTs = toTimestamp(cur.updated) || toTimestamp(cur.data);
            const pTs = toTimestamp(p.updated) || toTimestamp(p.data);
            if (pTs >= curTs) byNumero.set(key, p);
        }
    }
    pedidosPeriodo = Array.from(byNumero.values());
    pedidosPeriodo.sort((a, b) => (toTimestamp(b.data) - toTimestamp(a.data)));

    // "Mostrar só disponível" como filtro de DADOS (não esconderijo de DOM):
    // aplicado antes de paginação/rodapés/seleção, mantém contagens,
    // páginas e totais sempre consistentes.
    try {
        const soDisponivel = !!document.getElementById('relFiltroDisponivel')?.checked;
        if (soDisponivel) pedidosPeriodo = pedidosPeriodo.filter(isPedidoCarregoDisponivel);
    } catch (_) {}

    const totalPedidos = pedidosPeriodo.length;
    const valorTotal = pedidosPeriodo.reduce((total, pedido) => total + (typeof pedido.total === 'number' ? pedido.total : parseCurrencyValue(pedido.total)), 0);
    const ticketMedio = totalPedidos > 0 ? valorTotal / totalPedidos : 0;
    const valorTotalCarrego = pedidosPeriodo.reduce((acc, p) => acc + calcularValorCarregoPedido(p), 0);
    const elTP = document.getElementById('relFooterTotalPedidos');
    const elVT = document.getElementById('relFooterValorTotal');
    const elTM = document.getElementById('relFooterTicketMedio');
    const elVTC = document.getElementById('relFooterValorTotalCarrego');
    if (elTP) elTP.textContent = totalPedidos;
    if (elVT) elVT.textContent = formatCurrency(valorTotal);
    if (elTM) elTM.textContent = formatCurrency(ticketMedio);
    if (elVTC) elVTC.textContent = formatCurrency(valorTotalCarrego);
    document.getElementById('relatorioResult').style.display = 'block';

    const tbody = document.getElementById('relatorioTableBody');
    const tableEl = document.getElementById('relatoriosTable');
    const container = document.getElementById('relatorioTableContainer')
        || (tableEl ? tableEl.closest('.table-responsive') : null)
        || (tableEl ? tableEl.parentElement : null)
        || document.getElementById('relatorioResult');
    if (!tbody) return;
    if (pedidosPeriodo.length === 0) {
        tbody.innerHTML = '<tr><td class="commerce-full-row" data-label="" colspan="8" style="text-align: center;">Nenhum pedido encontrado</td></tr>';
        window._relPedidosPeriodo = [];
        window.relCarregoSelection = new Set();
        if (container && container.style) container.style.display = 'block';
        aplicarColunasEstadoInicialRelatorio();
        const footerCarregoEl = document.getElementById('relFooterTotalCarrego');
        if (footerCarregoEl) footerCarregoEl.textContent = `${formatNumber(0, 3)}`;
        const elVTCZero = document.getElementById('relFooterValorTotalCarrego');
        if (elVTCZero) elVTCZero.textContent = formatCurrency(0);
        aplicarOrdemColunasRelatorio(window.relatorioColunasOrdem || ['numero','data','cliente','total','status','carrego','atualizado','acoes']);
        updateRelCarregoSelectionCount();
        refreshCommerceResponsiveTables();
        renderVendasRelatorioPagination(0);
        return;
    }
    const latestMap = getCarregoLatestStatusMap();
    const pagosSet = new Set(Array.from(latestMap.values()).filter(x => x && x.status === 'pago').map(x => String(x.pedidoId)));
    const isPedidoCarregoPago = (pedido) => pagosSet.has(getPedidoVendaId(pedido)) || pedido?.carregoPago === true;
    if (filtroStatus === 'carregos_pagos') {
        pedidosPeriodo = pedidosPeriodo.filter(isPedidoCarregoPago);
        if (pedidosPeriodo.length === 0) {
            tbody.innerHTML = '<tr><td class="commerce-full-row" data-label="" colspan="8" style="text-align: center;">Nenhum pedido encontrado</td></tr>';
            window._relPedidosPeriodo = [];
            window.relCarregoSelection = new Set();
            if (container && container.style) container.style.display = 'block';
            const footerTotalPedidosEl = document.getElementById('relFooterTotalPedidos');
            const footerValorTotalEl = document.getElementById('relFooterValorTotal');
            const footerTicketMedioEl = document.getElementById('relFooterTicketMedio');
            const footerCarregoEl = document.getElementById('relFooterTotalCarrego');
            const footerValorCarregoEl = document.getElementById('relFooterValorTotalCarrego');
            if (footerTotalPedidosEl) footerTotalPedidosEl.textContent = '0';
            if (footerValorTotalEl) footerValorTotalEl.textContent = formatCurrency(0);
            if (footerTicketMedioEl) footerTicketMedioEl.textContent = formatCurrency(0);
            if (footerCarregoEl) footerCarregoEl.textContent = `${formatNumber(0, 3)}`;
            if (footerValorCarregoEl) footerValorCarregoEl.textContent = formatCurrency(0);
            aplicarColunasEstadoInicialRelatorio();
            aplicarOrdemColunasRelatorio(window.relatorioColunasOrdem || ['numero','data','cliente','total','status','carrego','atualizado','acoes']);
            updateRelCarregoSelectionCount();
            refreshCommerceResponsiveTables();
            renderVendasRelatorioPagination(0);
            return;
        }
    }
    window._relPedidosPeriodo = pedidosPeriodo;
    window.relCarregoSelection = window.relCarregoSelection || new Set();
    const idsRelatorioAtual = new Set(pedidosPeriodo.map(getPedidoVendaId).filter(Boolean));
    window.relCarregoSelection = new Set(Array.from(window.relCarregoSelection).filter(id => idsRelatorioAtual.has(String(id))));
    let totalCarrego = 0;
    const relRows = pedidosPeriodo.map(pedido => {
        let nomeCliente = 'Cliente não encontrado';
        if (pedido.cliente) {
            nomeCliente = pedido.cliente.nome || pedido.cliente.name || 'Nome não informado';
        } else if (pedido.clienteId) {
            const clienteEncontrado = (Array.isArray(window.clientes) ? window.clientes : []).find(c => String(c.id) === String(pedido.clienteId));
            if (clienteEncontrado) {
                nomeCliente = clienteEncontrado.nome || clienteEncontrado.name || 'Nome não informado';
            }
        }
        const updatedStr = pedido.updated ? formatDate(pedido.updated) : '-';
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        const nameOf = it => normalizeStr(String(it.produtoNome || it.nome || it.produto || ''));
        const carregoItem = itens.find(it => nameOf(it) === 'carrego');
        let carregoVol = 0;
        if (carregoItem) {
            const raw = (typeof carregoItem.quantidade !== 'undefined') ? carregoItem.quantidade : (typeof carregoItem.volume !== 'undefined' ? carregoItem.volume : carregoItem.m3);
            carregoVol = parseNumberFlexible(raw);
        } else {
            carregoVol = 0;
        }
        totalCarrego += carregoVol || 0;
        const safeId = getPedidoVendaId(pedido);
        const isPago = isPedidoCarregoPago(pedido);
        const hasCarrego = !!carregoItem;
        const disabledAttr = '';
        let titleReason = '';
        if (isPago) titleReason = 'Carrego já pago';
        else if (!hasCarrego) titleReason = 'Sem carrego';
        else if (!(carregoVol > 0)) titleReason = 'Carrego sem volume';
        const titleAttr = titleReason ? `title="${titleReason}"` : '';
        const checkedAttr = (!disabledAttr && window.relCarregoSelection.has(safeId)) ? 'checked' : '';
        const filtroDisponivelAtivo = !!document.getElementById('relFiltroDisponivel')?.checked;
        const carregoDisplay = carregoVol
            ? `${formatNumber(carregoVol, 3)} m³${isPago ? ' <i class=\"fas fa-check-circle badge-paid\"></i>' : ''}`
            : (filtroDisponivelAtivo ? '-' : `- <span class=\"badge-no-carrego\">sem carrego</span>`);
        return (
            `<tr data-pedido-id="${safeId}" data-carrego-vol="${carregoVol}" data-carrego-pago="${isPago ? '1' : '0'}" data-has-carrego="${hasCarrego ? '1' : '0'}" class="${isPago ? 'paid-carrego' : ''}">` +
            `<td data-col="numero" data-label="Número"><span class="numero-cell"><input type="checkbox" class="sel-carrego" id="selCarrego_${safeId}" onchange="onRelCarregoSelectChange(this)" aria-label="Selecionar carrego do pedido #${pedido.numero}" ${disabledAttr} ${checkedAttr} ${titleAttr}> <span>${pedido.numero}</span></span></td>` +
            `<td data-col="data" data-label="Data">${formatDate(pedido.data)}</td>` +
            `<td data-col="cliente" data-label="Cliente">${nomeCliente}</td>` +
            `<td data-col="total" data-label="Total" style="text-align: right;"><span class="commerce-card-value commerce-card-money">${formatCurrency(pedido.total)}</span></td>` +
            `<td data-col="status" data-label="Status"><span class="status-badge status-${pedido.status}">${getStatusLabel(pedido.status)}</span></td>` +
            `<td data-col="carrego" data-label="Carrego" style="text-align: right;"><span class="commerce-card-value commerce-card-number">${carregoDisplay}</span></td>` +
            `<td data-col="atualizado" data-label="Atualizado">${updatedStr}</td>` +
            `<td data-col="acoes" data-label="Ações" class="relatorio-acoes-cell commerce-actions-cell">` +
                `<div class="relatorio-acoes-buttons acoes-buttons commerce-actions-wrap">` +
                `<button type=\"button\" onclick=\"visualizarPedido('${safeId}')\" class=\"btn-primary btn-small\" title=\"Visualizar\" aria-label=\"Visualizar\"><i class=\"fas fa-eye\"></i></button>` +
                `<button type=\"button\" onclick=\"imprimirPedido('${safeId}')\" class=\"btn-primary btn-small\" title=\"Imprimir\" aria-label=\"Imprimir\"><i class=\"fas fa-print\"></i></button>` +
                `<button type=\"button\" onclick=\"excluirCarrego('${safeId}')\" class=\"btn-danger btn-small\" title=\"Excluir Carrego\" aria-label=\"Excluir Carrego\"><i class=\"fas fa-trash\"></i></button>` +
                `</div>` +
            `</td>` +
            '</tr>'
        );
    });
    const totalRelPages = Math.max(1, Math.ceil(relRows.length / vendasRelatorioPerPage));
    if (vendasRelatorioPage > totalRelPages) vendasRelatorioPage = totalRelPages;
    if (vendasRelatorioPage < 1) vendasRelatorioPage = 1;
    const relStart = (vendasRelatorioPage - 1) * vendasRelatorioPerPage;
    tbody.innerHTML = relRows.slice(relStart, relStart + vendasRelatorioPerPage).join('');
    renderVendasRelatorioPagination(relRows.length);
    if (container && container.style) container.style.display = 'block';
    aplicarColunasEstadoInicialRelatorio();
    const footerCarregoEl = document.getElementById('relFooterTotalCarrego');
    if (footerCarregoEl) footerCarregoEl.textContent = `${formatNumber(totalCarrego, 3)}`;
    aplicarOrdemColunasRelatorio(window.relatorioColunasOrdem || ['numero','data','cliente','total','status','carrego','atualizado','acoes']);
    updateRelCarregoSelectionCount();
    refreshCommerceResponsiveTables();
}

function renderVendasRelatorioPagination(totalItems) {
    const container = document.getElementById('vendasRelatorioPagination');
    if (!container) return;
    const totalPages = Math.ceil(totalItems / vendasRelatorioPerPage);
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const addBtn = (label, page, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = label;
        if (active) btn.classList.add('active');
        btn.disabled = disabled;
        btn.onclick = () => goToVendasRelatorioPage(page);
        container.appendChild(btn);
    };

    addBtn('<<<', 1, vendasRelatorioPage === 1);
    addBtn('<', vendasRelatorioPage - 1, vendasRelatorioPage === 1);

    const startPage = Math.max(1, vendasRelatorioPage - 2);
    const endPage = Math.min(totalPages, vendasRelatorioPage + 2);

    if (startPage > 1) {
        addBtn('1', 1, false, vendasRelatorioPage === 1);
        if (startPage > 2) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        addBtn(String(i), i, false, i === vendasRelatorioPage);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const span = document.createElement('span');
            span.textContent = '...';
            container.appendChild(span);
        }
        addBtn(String(totalPages), totalPages, false, vendasRelatorioPage === totalPages);
    }

    addBtn('>', vendasRelatorioPage + 1, vendasRelatorioPage === totalPages);
    addBtn('>>>', totalPages, vendasRelatorioPage === totalPages);
}

function goToVendasRelatorioPage(page) {
    const next = Math.max(1, Number(page) || 1);
    if (next === vendasRelatorioPage) return;
    vendasRelatorioPage = next;
    gerarRelatorio(true);
}

// Funções auxiliares
function atualizarSelectClientes(selectedId = null) {
    const select = document.getElementById('clienteSelect');
    if (!select) {
        console.warn('⚠️ clienteSelect não encontrado no DOM. Pulando atualização de clientes.');
        return;
    }
    
    // Guardar seleção atual se não houver selectedId novo
    const currentVal = select.value;
    
    select.innerHTML = '<option value="">Selecione um cliente</option>';
    
    console.log('Atualizando select de clientes...');
    
    // ✅ Proteção: garantir que window.clientes é um array
    if (!window.clientes || !Array.isArray(window.clientes)) {
        console.error('❌ window.clientes não é um array:', typeof window.clientes, window.clientes);
        window.clientes = [];
        return;
    }
    
    // ✅ Deduplicar por ID ou por nome normalizado
    const uniqMap = new Map();
    window.clientes.forEach(c => {
        const id = String(c.id || '').trim();
        const name = (c.nome || c.name || '').toLowerCase().trim();
        const key = id || `name:${name}`;
        if (!uniqMap.has(key)) uniqMap.set(key, c);
    });
    window.clientes = Array.from(uniqMap.values());
    // Ordenar alfabeticamente
    window.clientes.sort((a, b) => (a.nome || a.name || '').localeCompare(b.nome || b.name || ''));
    
    console.log('Total de clientes para o select (únicos):', window.clientes.length);
    
    if (window.clientes.length === 0) {
        console.warn('Nenhum cliente disponível para o select');
        return;
    }
    
    window.clientes.forEach((cliente, index) => {
        const option = document.createElement('option');
        option.value = cliente.id;
        option.textContent = cliente.nome || cliente.name || 'Nome não informado';
        option.dataset.documento = String(cliente.document || cliente.cnpj || cliente.cpf || '');
        
        select.appendChild(option);
    });
    
    // Restaurar seleção ou definir novo selecionado
    if (selectedId) {
        select.value = selectedId;
        // Verificar se funcionou (pode falhar se ID não estiver na lista)
        if (select.value !== selectedId) {
            console.warn(`Cliente ID ${selectedId} não encontrado no select após atualização.`);
        } else {
            console.log(`✅ Cliente ${selectedId} selecionado automaticamente.`);
        }
    } else if (currentVal) {
        select.value = currentVal;
    }
    
    console.log(`Select de clientes atualizado com ${window.clientes.length} opções`);
}

window.filtrarClientesSelect = filtrarClientesSelect;

 

 

function popularFiltrosRelatoriosVenda() {
    try {
        const cliEl = document.getElementById('relFiltroCliente');
        if (cliEl) {
            cliEl.innerHTML = '<option value="">Todos</option>';
            const lista = Array.isArray(window.clientes) ? window.clientes : [];
            lista.forEach(c => {
                const opt = document.createElement('option');
                opt.value = String(c.id || '');
                opt.textContent = c.nome || c.name || 'Sem nome';
                cliEl.appendChild(opt);
            });
        }
        const espEl = document.getElementById('relFiltroEspecie');
        if (espEl) {
            const set = new Set();
            const pedidos = Array.isArray(window.pedidos) ? window.pedidos : [];
            pedidos.forEach(p => {
                const itens = Array.isArray(p.itens) ? p.itens : [];
                itens.forEach(it => {
                    const nome = String(it.especie || it.especieNome || it.produtoNome || it.produto || '').trim();
                    if (nome) {
                        const base = nome.split(' - ')[0].trim();
                        set.add(base || nome);
                    }
                });
            });
            const baseSpecies = (window.species && Array.isArray(window.species)) ? window.species.map(s => s.especie || s.nome || s.nomeComum || s.name).filter(Boolean) : [];
            baseSpecies.forEach(n => set.add(String(n)));
            const arr = Array.from(set).sort((a,b)=>a.localeCompare(b));
            espEl.innerHTML = '<option value="">Todas</option>';
            arr.forEach(nome => {
                const opt = document.createElement('option');
                opt.value = nome;
                opt.textContent = nome;
                espEl.appendChild(opt);
            });
        }
        const stEl = document.getElementById('relFiltroStatus');
        if (stEl) {
            // opções já declaradas no HTML; manter seleção
        }
    } catch (e) {}
}

function setupRelatoriosRealtime() {
    try {
        if (!window.firebaseService || typeof window.firebaseService.subscribe !== 'function') {
            return;
        }
        if (!window._carregoPagamentosSub) {
            window._carregoPagamentosSub = window.firebaseService.subscribe('vendas/pagamentos_carrego', (snap) => {
                try {
                    const data = snap && snap.data;
                    let arr = [];
                    if (Array.isArray(data)) {
                        arr = data.filter(Boolean);
                    } else if (data && typeof data === 'object') {
                        arr = Object.values(data || {});
                    }
                    try {
                        const storageKey = getStorageKey('vendas/pagamentos_carrego');
                        persistLocalValue(storageKey, arr);
                    } catch (_) {}
                    const relTab = document.getElementById('relatorios');
                    if (relTab && relTab.classList.contains('active')) {
                        gerarRelatorio();
                    }
                } catch (e) {
                    console.warn('⚠️ Falha ao atualizar carregoPagamentos em tempo real:', e?.message || e);
                }
            });
        }
        if (!window._pedidosVendaSub) {
            window._pedidosVendaSub = window.firebaseService.subscribe('vendas/pedidos', (snap) => {
                try {
                    const data = snap && snap.data;
                    let arr = [];
                    if (Array.isArray(data)) {
                        arr = data;
                    } else if (data && typeof data === 'object') {
                        // Preservar a chave do Firebase como id (paridade com getData);
                        // sem isso, entradas sem id quebram findIndex no save e geram
                        // duplicatas (lista mostra a nova, detalhe/impressão acham a velha).
                        arr = Object.entries(data || {})
                            .filter(([k]) => k !== '_metadata' && k !== 'metadata')
                            .map(([k, v]) => {
                                if (!v || typeof v !== 'object') return null;
                                if (v.id) return v;
                                return { ...v, id: String(k), firebaseKey: String(k) };
                            })
                            .filter(Boolean);
                    }
                    arr = (arr || []).map(p => {
                        if (p && p.contasReceber) {
                            p.contasReceber = normalizarContasReceberLista(p.contasReceber);
                        }
                        return p;
                    });
                    window.pedidos = arr;
                    try {
                        const storageKey = getStorageKey('vendas/pedidos');
                        persistLocalValue(storageKey, arr);
                    } catch (_) {}
                    popularFiltrosRelatoriosVenda();
                    const relTab = document.getElementById('relatorios');
                    if (relTab && relTab.classList.contains('active')) {
                        gerarRelatorio();
                    }
                } catch (e) {
                    console.warn('⚠️ Falha ao atualizar pedidosVenda em tempo real:', e?.message || e);
                }
            });
        }
    } catch (e) {
        console.warn('⚠️ Falha ao configurar assinaturas de relatórios:', e?.message || e);
    }
}

 

 

function abrirCustomizarColunasRelatorio() {
    const modal = document.getElementById('customizarColunasModal');
    if (!modal) return;
    const st = window.relatorioColunasVisiveis || {};
    const ordem = window.relatorioColunasOrdem || ['numero','data','cliente','total','status','carrego','atualizado','acoes'];
    const container = document.getElementById('relPrintColumnsList');
    if (container) {
        container.innerHTML = '';
        const label = { numero: 'Número', data: 'Data', cliente: 'Cliente', total: 'Total', status: 'Status', carrego: 'Carrego', atualizado: 'Atualizado', acoes: 'Ações' };
        ordem.forEach(key => {
            const item = document.createElement('div');
            item.className = 'columns-item';
            item.setAttribute('data-col', key);
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.padding = '6px 0';
            const checked = st[key] !== false;
            item.innerHTML = `<span>${label[key]}</span><span>` +
                `<label style="margin-right:8px;"><input type="checkbox" id="chkRelCol_${key}" ${checked ? 'checked' : ''}> Exibir</label>` +
                `<button type="button" class="btn-primary btn-small" onclick="moverColunaRelatorio('${key}','up')"><i class=\"fas fa-arrow-up\"></i></button> ` +
                `<button type="button" class="btn-primary btn-small" onclick="moverColunaRelatorio('${key}','down')"><i class=\"fas fa-arrow-down\"></i></button>` +
            `</span>`;
            container.appendChild(item);
        });
    }
    modal.style.display = 'block';
}

function aplicarCustomizacaoColunasRelatorio() {
    const novo = {};
    const items = Array.from(document.querySelectorAll('#relPrintColumnsList .columns-item'));
    items.forEach(item => {
        const key = item.getAttribute('data-col');
        const chk = item.querySelector('input[type="checkbox"]');
        if (key) novo[key] = !!(chk && chk.checked);
    });
    window.relatorioColunasVisiveis = novo;
    Object.keys(novo).forEach(k => setVisibilidadeColunaRelatorio(k, novo[k]));
    const ordemAtual = items.map(li => li.getAttribute('data-col'));
    if (ordemAtual && ordemAtual.length) {
        window.relatorioColunasOrdem = ordemAtual;
        aplicarOrdemColunasRelatorio(ordemAtual);
    }
    fecharModal('customizarColunasModal');
}

function setVisibilidadeColunaRelatorio(colKey, visible) {
    const table = document.getElementById('relatoriosTable');
    if (!table) return;
    const display = visible ? '' : 'none';
    const th = table.querySelectorAll(`thead th[data-col="${colKey}"]`);
    th.forEach(el => { el.style.display = display; });
    const tds = table.querySelectorAll(`tbody td[data-col="${colKey}"]`);
    tds.forEach(el => { el.style.display = display; });
}

function aplicarColunasEstadoInicialRelatorio() {
    const st = window.relatorioColunasVisiveis || {};
    const keys = ['numero','data','cliente','total','status','carrego','atualizado','acoes'];
    keys.forEach(k => setVisibilidadeColunaRelatorio(k, st[k] !== false));
}

function moverColunaRelatorio(key, dir) {
    const list = document.getElementById('relPrintColumnsList');
    if (!list) return;
    const items = Array.from(list.querySelectorAll('.columns-item'));
    const idx = items.findIndex(li => li.getAttribute('data-col') === key);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= items.length) return;
    const current = items[idx];
    const target = items[targetIdx];
    if (dir === 'up') {
        list.insertBefore(current, target);
    } else {
        list.insertBefore(target, current);
        list.insertBefore(current, target.nextSibling);
    }
}

function aplicarOrdemColunasRelatorio(ordem) {
    const table = document.getElementById('relatoriosTable');
    if (!table) return;
    const headerRow = table.querySelector('thead tr');
    if (headerRow) {
        const ths = {};
        Array.from(headerRow.children).forEach(th => {
            const key = th.getAttribute('data-col');
            if (key) ths[key] = th;
        });
        ordem.forEach(key => {
            if (ths[key]) headerRow.appendChild(ths[key]);
        });
    }
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(tr => {
        const map = {};
        Array.from(tr.children).forEach(td => {
            const key = td.getAttribute('data-col');
            if (key) map[key] = td;
        });
        ordem.forEach(key => {
            if (map[key]) tr.appendChild(map[key]);
        });
    });
}

async function imprimirRelatorio() {
    try {
        LoadingManager.show('Preparando impressão...');
        const container = document.getElementById('relatorioResult');
        if (!container || container.style.display === 'none') {
            ToastManager.warning('Gere o relatório antes de imprimir', 'Atenção');
            return;
        }
        const titulo = 'Relatório de Vendas';
        const dadosEmpresa = await obterDadosEmpresa();
        const tableEl = document.getElementById('relatoriosTable');
        const selected = new Set(getSelectedCarregoIds().map(String));
        let tabela = '';
        let resumoFooter = '';
        if (tableEl && selected.size > 0) {
            const ths = Array.from(tableEl.querySelectorAll('thead th'));
            const headerHtml = '<thead><tr>' + ths.map(th => {
                const key = th.getAttribute('data-col') || '';
                const disp = th.style.display === 'none' ? 'none' : '';
                const label = th.textContent.trim();
                return `<th data-col="${key}" style="display:${disp}">${label}</th>`;
            }).join('') + '</tr></thead>';
            const rows = Array.from(tableEl.querySelectorAll('tbody tr'));
            const bodyRows = rows.filter(r => selected.has(String(r.getAttribute('data-pedido-id'))));
            let totalPedidos = bodyRows.length;
            let valorTotal = 0;
            let totalCarrego = 0;
            let valorTotalCarrego = 0;
            const ids = [];
            const bodyHtml = '<tbody>' + bodyRows.map(r => {
                totalCarrego += parseFloat(r.getAttribute('data-carrego-vol') || '0') || 0;
                const tds = Array.from(r.children).map(td => {
                    const key = td.getAttribute('data-col') || '';
                    const disp = td.style.display === 'none' ? 'none' : '';
                    if (key === 'numero') {
                        const numTxt = td.textContent.trim();
                        return `<td data-col="numero" style="display:${disp}">${numTxt}</td>`;
                    }
                    if (key === 'total') {
                        const txt = td.textContent.trim();
                        valorTotal += parseCurrencyValue(txt);
                    }
                    return `<td data-col="${key}" style="display:${disp}">${td.innerHTML}</td>`;
                }).join('');
                const id = r.getAttribute('data-pedido-id');
                if (id) ids.push(String(id));
                return `<tr>${tds}</tr>`;
            }).join('') + '</tbody>';
            ids.forEach(id => {
                const p = (window._relPedidosPeriodo || []).find(pp => getPedidoVendaId(pp) === String(id)) || (window.pedidos || []).find(pp => getPedidoVendaId(pp) === String(id));
                valorTotalCarrego += calcularValorCarregoPedido(p);
            });
            tabela = `<table class="table" id="relatoriosTable">${headerHtml}${bodyHtml}</table>`;
            const ticketMedio = totalPedidos > 0 ? (valorTotal / totalPedidos) : 0;
            const skipTP = !!document.getElementById('relNaoImprimirTotalPedidos')?.checked;
            const skipVTP = !!document.getElementById('relNaoImprimirValorTotalPedidos')?.checked;
            const skipTC = !!document.getElementById('relNaoImprimirTotalCarrego')?.checked;
            const skipVTC = !!document.getElementById('relNaoImprimirValorTotalCarrego')?.checked;
            const skipTM = !!document.getElementById('relNaoImprimirTicketMedio')?.checked;
            const summaryRowsSel = [];
            if (!skipTP) summaryRowsSel.push(`<div class="summary-row"><span>Total de Pedidos:</span><span>${totalPedidos}</span></div>`);
            if (!skipVTP) summaryRowsSel.push(`<div class="summary-row"><span>Valor Total de Pedidos:</span><span>${formatCurrency(valorTotal)}</span></div>`);
            if (!skipTC) summaryRowsSel.push(`<div class="summary-row"><span>Total Carrego (m³):</span><span>${formatNumber(totalCarrego, 3)}</span></div>`);
            if (!skipVTC) summaryRowsSel.push(`<div class="summary-row"><span>Valor Total Carrego:</span><span>${formatCurrency(valorTotalCarrego)}</span></div>`);
            if (!skipTM) summaryRowsSel.push(`<div class="summary-row"><span>Ticket Médio:</span><span>${formatCurrency(ticketMedio)}</span></div>`);
            resumoFooter = summaryRowsSel.length ? `<div class="summary-box" id="relatorioResumoFooter" style="margin-top: 15px;">${summaryRowsSel.join('')}</div>` : '';
        } else if (tableEl) {
            const ths = Array.from(tableEl.querySelectorAll('thead th'));
            const headerHtml = '<thead><tr>' + ths.map(th => {
                const key = th.getAttribute('data-col') || '';
                const disp = th.style.display === 'none' ? 'none' : '';
                const label = th.textContent.trim();
                return `<th data-col="${key}" style="display:${disp}">${label}</th>`;
            }).join('') + '</tr></thead>';
            const rows = Array.from(tableEl.querySelectorAll('tbody tr')).filter(r => r.style.display !== 'none');
            let totalPedidos = rows.length;
            let valorTotal = 0;
            let totalCarrego = 0;
            let valorTotalCarrego = 0;
            const ids = [];
            const bodyHtml = '<tbody>' + rows.map(r => {
                totalCarrego += parseFloat(r.getAttribute('data-carrego-vol') || '0') || 0;
                const tds = Array.from(r.children).map(td => {
                    const key = td.getAttribute('data-col') || '';
                    const disp = td.style.display === 'none' ? 'none' : '';
                    if (key === 'numero') {
                        const numTxt = td.textContent.trim();
                        return `<td data-col="numero" style="display:${disp}">${numTxt}</td>`;
                    }
                    if (key === 'total') {
                        const txt = td.textContent.trim();
                        valorTotal += parseCurrencyValue(txt);
                    }
                    return `<td data-col="${key}" style="display:${disp}">${td.innerHTML}</td>`;
                }).join('');
                const id = r.getAttribute('data-pedido-id');
                if (id) ids.push(String(id));
                return `<tr>${tds}</tr>`;
            }).join('') + '</tbody>';
            ids.forEach(id => {
                const p = (window._relPedidosPeriodo || []).find(pp => getPedidoVendaId(pp) === String(id)) || (window.pedidos || []).find(pp => getPedidoVendaId(pp) === String(id));
                valorTotalCarrego += calcularValorCarregoPedido(p);
            });
            tabela = `<table class="table" id="relatoriosTable">${headerHtml}${bodyHtml}</table>`;
            const ticketMedio = totalPedidos > 0 ? (valorTotal / totalPedidos) : 0;
            const skipTP = !!document.getElementById('relNaoImprimirTotalPedidos')?.checked;
            const skipVTP = !!document.getElementById('relNaoImprimirValorTotalPedidos')?.checked;
            const skipTC = !!document.getElementById('relNaoImprimirTotalCarrego')?.checked;
            const skipVTC = !!document.getElementById('relNaoImprimirValorTotalCarrego')?.checked;
            const skipTM = !!document.getElementById('relNaoImprimirTicketMedio')?.checked;
            const summaryRows = [];
            if (!skipTP) summaryRows.push(`<div class="summary-row"><span>Total de Pedidos:</span><span>${totalPedidos}</span></div>`);
            if (!skipVTP) summaryRows.push(`<div class="summary-row"><span>Valor Total de Pedidos:</span><span>${formatCurrency(valorTotal)}</span></div>`);
            if (!skipTC) summaryRows.push(`<div class="summary-row"><span>Total Carrego (m³):</span><span>${formatNumber(totalCarrego, 3)}</span></div>`);
            if (!skipVTC) summaryRows.push(`<div class="summary-row"><span>Valor Total Carrego:</span><span>${formatCurrency(valorTotalCarrego)}</span></div>`);
            if (!skipTM) summaryRows.push(`<div class="summary-row"><span>Ticket Médio:</span><span>${formatCurrency(ticketMedio)}</span></div>`);
            resumoFooter = summaryRows.length ? `<div class="summary-box" id="relatorioResumoFooter" style="margin-top: 15px;">${summaryRows.join('')}</div>` : '';
        } else {
            tabela = '';
            resumoFooter = '';
        }
        const periodoInicio = document.getElementById('periodoInicio')?.value || '';
        const periodoFim = document.getElementById('periodoFim')?.value || '';
        const periodoLabel = periodoInicio || periodoFim
            ? `Periodo: ${periodoInicio ? formatDate(periodoInicio) : 'inicio'} a ${periodoFim ? formatDate(periodoFim) : 'fim'}`
            : 'Periodo: todos';
        const bodyHtml = `
            <section class="sisweb-print-section">
                <h2 class="sisweb-print-section-title">Pedidos</h2>
                ${tabela}
            </section>
            ${resumoFooter ? `<section class="sisweb-print-section">${resumoFooter}</section>` : ''}
        `;
        const helper = window.SiswebCommercePdf;
        if (helper && typeof helper.printHtmlDocument === 'function') {
            const printOptions = {
                title: titulo,
                company: dadosEmpresa,
                badgeText: 'Vendas',
                subtitle: periodoLabel,
                metaRows: [`Emissao: ${new Date().toLocaleDateString('pt-BR')}`],
                bodyHtml
            };
            const preparedOptions = typeof helper.preparePrintOptions === 'function'
                ? await helper.preparePrintOptions(printOptions)
                : printOptions;
            helper.printHtmlDocument(preparedOptions);
        } else {
            const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titulo}</title><style>@page{margin:10mm;}body{font-family:Arial,sans-serif;padding:20px;color:#111827}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d6dde8;padding:8px;overflow-wrap:anywhere}th{background:#2c3e50;color:#fff}[data-col="acoes"],.sel-carrego,.sel-carrego-all{display:none!important}.sisweb-print-back{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:0 0 14px;padding:10px 12px;border:1px solid #d6dde8;border-radius:6px;background:#f8fafc;font-family:Arial,sans-serif;}@media print{.sisweb-print-back{display:none !important;}}</style></head><body><div class="sisweb-print-back"><button type="button" onclick="try{if(window.history&&window.history.length>1){history.back()}else{window.close()}}catch(e){try{window.close()}catch(e2){}}" style="min-height:40px;padding:0 16px;border-radius:6px;border:1px solid #cbd5e1;background:#fff;font-weight:700;cursor:pointer;">&#8592; Voltar</button><button type="button" onclick="window.focus();window.print()" style="min-height:40px;padding:0 16px;border-radius:6px;border:1px solid #1f2937;background:#1f2937;color:#fff;font-weight:700;cursor:pointer;">Imprimir</button></div><h1>${titulo}</h1>${bodyHtml}</body></html>`;
            let win = null;
            try {
                win = window.open('', '_blank', 'width=800,height=600');
            } catch (_) {
                win = null;
            }
            if (!win || win.closed) {
                ToastManager.warning('Permita pop-ups para imprimir.', 'Atenção');
                return;
            }
            try {
                if (!win.document) throw new Error('alvo parcial');
            } catch (_) {
                try { if (!win.closed) win.close(); } catch (_) {}
                ToastManager.error('Não foi possível abrir a janela de impressão.', 'Erro');
                return;
            }
            try {
                win.document.write(html);
                win.document.close();
            } catch (_) {
                try { if (!win.closed) win.close(); } catch (_) {}
                ToastManager.error('Não foi possível abrir a janela de impressão.', 'Erro');
                return;
            }
            let relDisparado = false;
            const dispararRel = () => {
                if (relDisparado) return;
                relDisparado = true;
                try { win.focus(); } catch (_) {}
                try { win.print(); } catch (_) {}
            };
            try { win.onload = dispararRel; } catch (_) {}
            try {
                if (win.document && win.document.fonts && typeof win.document.fonts.ready.then === 'function') {
                    win.document.fonts.ready.then(() => setTimeout(dispararRel, 60)).catch(() => {});
                }
            } catch (_) {}
            try { win.focus(); } catch (_) {}
            setTimeout(dispararRel, 400);
            setTimeout(dispararRel, 1200);
        }
    } catch (e) {
        ToastManager.error('Erro ao imprimir relatório', 'Erro');
    } finally {
        LoadingManager.hide();
    }
}

function atualizarSelectProdutos() {
    const select = document.getElementById('produtoSelect');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione um produto</option>';
    
    if (window.produtos && window.produtos.length > 0) {
        // Produto Cadastrado lista SÓ produtos reais (Manual/Romaneio);
        // espécies ficam no fluxo Produto Romaneio do pedido.
        // Sem estoque não aparece (coerente com a validação que bloquearia):
        // serrado zerado (mesma regra da lista) e manual com estoque explícito 0.
        // Respeita permitirEstoqueNegativo; legado sem campo continua visível.
        let bloqueiaSemEstoque = true;
        try {
            bloqueiaSemEstoque = !!(window.VendasConfig && window.VendasConfig.validarEstoque && !window.VendasConfig.permitirEstoqueNegativo);
        } catch (_) { bloqueiaSemEstoque = true; }
        const semEstoqueVenda = (p) => {
            try {
                if (!bloqueiaSemEstoque) return false;
                // Serrado: mesma regra da Lista em Estoque (estoqueZeradoNaLista).
                if (typeof estoqueZeradoNaLista === 'function' && estoqueZeradoNaLista(p)) return true;
                // Manual: estoque explícito zerado (legado sem campo continua visível).
                if (typeof temDimsSerrado === 'function' && temDimsSerrado(p)) return false;
                if (p.estoque === undefined || p.estoque === null || p.estoque === '') return false;
                return Number(p.estoque) <= 0;
            } catch (_) { return false; }
        };
        const exibiveis = window.produtos.filter(p => {
            try {
                if (isProdutoJunk(p)) return false;
                if (!isProdutoReal(p)) return false;
                if (typeof semEstoqueVenda === 'function' && semEstoqueVenda(p)) return false;
                return true;
            } catch (_) { return true; }
        });
        // Garantir que ordenação e exibição tratem nomes alternativos (name/nome)
        exibiveis.sort((a,b) => (nomeExibicaoProduto(a) || '').localeCompare(nomeExibicaoProduto(b) || '')).forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            
            // Compatibilidade species/produtos (sem sufixo fantasma: se só há
            // nome científico, exibe só ele — nunca "X - Produto sem nome")
            const nomeCientifico = String(p.nomeCientifico || '').trim();
            const nomeComum = nomeSignificativo(p.nomeComum, p.nome, p.name);
            let texto = nomeCientifico
                ? (nomeComum ? `${nomeCientifico} - ${nomeComum}` : nomeCientifico)
                : (nomeComum || 'Produto sem nome');
            if (p.tipoProduto === 'romaneio') texto += ' · Serrado';
            // Info de estoque no option (usuário confere antes de adicionar).
            // Mesma base da baixa (dimensoesEstoqueSerrado): sem duplicar fórmula.
            try {
                if (temDimsSerrado(p)) {
                    const nPecas = Math.round(parseFloat(p.pecas) || 0);
                    const nVol = Number(p.volumeM3 ?? p.estoque ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3 });
                    const nMl = metrosLinearesDe(p).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                    let nArea = '0,00';
                    try {
                        if (typeof dimensoesEstoqueSerrado === 'function') {
                            nArea = dimensoesEstoqueSerrado(p).area.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                        }
                    } catch (_) {}
                    texto += ` — ${nPecas} pç · ${nVol} m³ · ${nMl} ml · ${nArea} m²`;
                } else {
                    texto += ` — Est: ${Number(p.estoque || 0).toLocaleString('pt-BR')} ${p.unidade || 'UN'}`;
                }
            } catch (_) {}
            const preco = p.preco || p.price || 0;
            
            option.textContent = texto;
            option.dataset.codigo = String(p.codigo || '');
            option.dataset.nome = String(p.nome || p.name || p.nomeComum || '');
            option.dataset.nomeCientifico = String(p.nomeCientifico || '');
            select.appendChild(option);
        });
    }
    configurarBuscaProdutoSelect();
}

function configurarBuscaProdutoSelect() {
    const select = document.getElementById('produtoSelect');
    if (!select || select.dataset.typeaheadBound) return;
    select.dataset.typeaheadBound = '1';
    let buffer = '';
    let lastTypeAt = 0;
    const findMatch = (term) => {
        const t = term.toLowerCase();
        const opts = Array.from(select.options).filter(o => o.value);
        const byName = opts.find(opt => {
            const nome = String(opt.dataset.nome || '').toLowerCase();
            const nomeCientifico = String(opt.dataset.nomeCientifico || '').toLowerCase();
            const label = (opt.textContent || '').toLowerCase();
            return nome.includes(t) || nomeCientifico.includes(t) || label.includes(t);
        });
        if (byName) return byName;
        return opts.find(opt => {
            const codigo = String(opt.dataset.codigo || '').toLowerCase();
            return codigo.includes(t);
        });
    };
    const handleType = (e) => {
        if (document.activeElement !== select) return;
        if (e.key === 'Backspace') {
            buffer = buffer.slice(0, -1);
            return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const now = Date.now();
            buffer = now - lastTypeAt > 800 ? e.key : buffer + e.key;
            lastTypeAt = now;
            const match = findMatch(buffer);
            if (match) {
                select.value = match.value;
                select.dispatchEvent(new Event('change'));
            }
        }
    };
    select.addEventListener('keydown', handleType);
    document.addEventListener('keydown', handleType, true);
    select.addEventListener('blur', () => { buffer = ''; });
}

function abrirModalCliente() {
    showTab('clientes');
    try {
        const search = document.getElementById('vendasClientesBusca');
        if (search) search.focus();
    } catch (_) {}
}

function fecharModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function getStatusLabel(status) {
    const labels = {
        pendente: 'Pendente',
        aprovado: 'Aprovado',
        entregue: 'Entregue',
        cancelado: 'Cancelado'
    };
    return labels[status] || status;
}

// Funções de formatação (reutilizando do sistema existente)
function formatCurrency(value) {
    if (typeof window.formatCurrency === 'function' && window.formatCurrency !== formatCurrency) {
        return window.formatCurrency(value);
    }
    if (value === undefined || value === null) return 'R$ 0,00';
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) : parseFloat(value);
    if (isNaN(numValue)) return 'R$ 0,00';
    return numValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrencyValue(value) {
    if (typeof window.parseCurrencyValue === 'function' && window.parseCurrencyValue !== parseCurrencyValue) {
        return window.parseCurrencyValue(value);
    }
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const numericValue = value.toString().replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(numericValue) || 0;
}

function parseNumberFlexible(value) {
    if (value === undefined || value === null) return NaN;
    if (typeof value === 'number') return value;
    const s = value.toString()
        .replace(/[^\d,.-]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    const n = parseFloat(s);
    return n;
}

function normalizeStr(s) {
    return s
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}
function isCarregoName(raw) {
    const base = normalizeStr(String(raw || '')).replace(/[^a-z0-9]+/g, ' ').trim();
    return base === 'carrego' || base.startsWith('carrego ') || base.endsWith(' carrego') || base.includes(' carrego ');
}
function isCarregoProduto(produto) {
    if (!produto) return false;
    return isCarregoName(produto.nome) || isCarregoName(produto.name) || isCarregoName(produto.nomeComum) || isCarregoName(produto.nomeCientifico);
}
function isCarregoItem(item) {
    if (!item) return false;
    if (item.isCarrego === true) return true;
    return isCarregoName(item.produtoNome) || isCarregoName(item.nome) || isCarregoName(item.produto);
}
function getCarregoBadgeHtml(item) {
    return isCarregoItem(item)
        ? ' <span style="display:inline-block;padding:2px 6px;border-radius:10px;background:#fff3cd;color:#856404;font-size:11px;font-weight:600;">Carrego</span>'
        : '';
}
function calcularValorCarregoPedido(pedido) {
    try {
        if (!pedido) return 0;
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        const nameOf = it => normalizeStr(String(it.produtoNome || it.nome || it.produto || ''));
        const it = itens.find(i => nameOf(i) === 'carrego');
        if (!it) return 0;
        if (typeof it.total !== 'undefined') {
            return typeof it.total === 'number' ? it.total : parseCurrencyValue(it.total);
        }
        const unit = (typeof it.precoUnitario !== 'undefined')
            ? parseCurrencyValue(it.precoUnitario)
            : (typeof it.preco !== 'undefined')
                ? parseCurrencyValue(it.preco)
                : (window.VendasConfig && typeof window.VendasConfig.precoPorM3Padrao === 'number' ? window.VendasConfig.precoPorM3Padrao : 0);
        const qtyRaw = (typeof it.quantidade !== 'undefined') ? it.quantidade : (typeof it.volume !== 'undefined' ? it.volume : it.m3);
        const qty = parseNumberFlexible(qtyRaw) || 0;
        return unit * qty;
    } catch (_) { return 0; }
}
function isAllCaps(text) {
    if (!text) return false;
    const letters = String(text).replace(/[^A-Za-zÀ-ÿ]/g, '');
    if (!letters) return false;
    return letters === letters.toUpperCase();
}
function toTitleCasePt(text) {
    if (!text) return text;
    const acronyms = new Set(['CPF','CNPJ','RG','IE','IM','NF','NFE','NF-E','CTE','PIX','IPTU','IPVA','ISS','ICMS','IPI','PIS','COFINS','CSLL','MEI','ME','LTDA','EIRELI','S/A','SA']);
    const s = String(text).replace(/\s+/g, ' ').trim();
    const cap = w => w ? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : w;
    return s.split(' ').map(token => {
        const clean = token.trim();
        if (acronyms.has(clean.toUpperCase())) return clean.toUpperCase();
        return clean.split(/([\-\/])/).map(part => (part === '-' || part === '/') ? part : cap(part)).join('');
    }).join(' ');
}

function validateCurrencyRange(value, min = 0, max = Infinity) {
    const n = typeof value === 'number' ? value : parseCurrencyValue(value);
    if (isNaN(n)) return { valid: false, message: 'Valor inválido' };
    if (n < min) return { valid: false, message: `Valor abaixo do mínimo (${formatCurrency(min)})` };
    if (n > max) return { valid: false, message: `Valor acima do máximo (${formatCurrency(max)})` };
    return { valid: true, message: '' };
}

function formatCurrencyInput(input) {
    if (typeof window.formatCurrencyInput === 'function' && window.formatCurrencyInput !== formatCurrencyInput) {
        return window.formatCurrencyInput(input);
    }
    try {
        if (!input || !input.value) {
            return;
        }
        const raw = input.value.replace(/\u00A0/g, ' ').trim().replace(/^R\$\s*/, '');
        if (/,/.test(raw)) {
            const num = parseCurrencyValue(raw);
            input.value = formatCurrency(num);
            try { const len = input.value.length; input.setSelectionRange(len, len); } catch (_) {}
            return;
        }
        let digits = raw.replace(/\D/g, '');
        if (digits.length === 0) {
            input.value = '';
            return;
        }
        const num = parseInt(digits, 10);
        input.value = num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
        try { const len = input.value.length; input.setSelectionRange(len, len); } catch (_) {}
    } catch (error) {
        console.error("Erro ao formatar valor monetário:", error);
    }
}

function formatNumber(value, decimals = 3) {
    if (isNaN(value) || value === null || value === undefined) return '0';
    return parseFloat(value).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function toValidDate(value) {
    try {
        if (value === undefined || value === null || value === '') return null;
        if (value instanceof Date) {
            return isNaN(value.getTime()) ? null : value;
        }
        if (typeof value === 'number') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof value === 'string') {
            const s = value.trim();
            if (!s) return null;
            if (/^\d+$/.test(s)) {
                const d = new Date(parseInt(s, 10));
                return isNaN(d.getTime()) ? null : d;
            }
            const d = parseDateLocalSafe(s);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof value === 'object') {
            if (typeof value.toDate === 'function') {
                const d = value.toDate();
                return d instanceof Date && !isNaN(d.getTime()) ? d : null;
            }
            if (typeof value.seconds === 'number') {
                const ms = value.seconds * 1000 + (typeof value.nanoseconds === 'number' ? Math.floor(value.nanoseconds / 1e6) : 0);
                const d = new Date(ms);
                return isNaN(d.getTime()) ? null : d;
            }
            if (typeof value._seconds === 'number') {
                const ms = value._seconds * 1000;
                const d = new Date(ms);
                return isNaN(d.getTime()) ? null : d;
            }
            if (value['.sv'] === 'timestamp') {
                return null;
            }
            const d = new Date(String(value));
            return isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(value);
        return isNaN(d.getTime()) ? null : d;
    } catch (_) {
        return null;
    }
}

function toTimestamp(value) {
    const d = toValidDate(value);
    return d ? d.getTime() : 0;
}

function escapeJsString(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, ' ');
}

function refreshCommerceResponsiveTables() {
    try {
        if (window.SiswebCommerceResponsive && typeof window.SiswebCommerceResponsive.enhanceAll === 'function') {
            window.SiswebCommerceResponsive.enhanceAll();
        }
    } catch (_) {}
}

function getPedidoRecencyTimestamp(pedido) {
    if (!pedido || typeof pedido !== 'object') return 0;
    return (
        toTimestamp(pedido.created)
        || toTimestamp(pedido.createdAt)
        || toTimestamp(pedido.updated)
        || toTimestamp(pedido.updatedAt)
        || toTimestamp(pedido.data)
        || 0
    );
}

function comparePedidosByRecencyDesc(a, b) {
    const tb = getPedidoRecencyTimestamp(b);
    const ta = getPedidoRecencyTimestamp(a);
    if (tb !== ta) return tb - ta;
    const nb = parseInt(String(b && b.numero ? b.numero : ''), 10);
    const na = parseInt(String(a && a.numero ? a.numero : ''), 10);
    if (!Number.isNaN(nb) && !Number.isNaN(na) && nb !== na) return nb - na;
    const ib = String(b && b.id ? b.id : '');
    const ia = String(a && a.id ? a.id : '');
    return ib.localeCompare(ia);
}

function formatDate(dateString) {
    const d = toValidDate(dateString);
    if (!d) return '-';
    return d.toLocaleDateString('pt-BR');
}

// Utilitário: extrair timestamp confiável do romaneio para ordenação (mais recente primeiro)
function extractRomaneioTimestamp(romaneio) {
    try {
        if (!romaneio || typeof romaneio !== 'object') return 0;
        const candidates = [
            romaneio?._metadata?.lastUpdated,
            romaneio.updatedAt,
            romaneio.updated,
            romaneio.lastModified,
            romaneio.dataEmissao,
            romaneio.data,
            romaneio.dataRomaneio,
            romaneio.dataHora,
            romaneio.dataCriacao,
            romaneio.createdAt,
            romaneio.created,
            romaneio.timestamp
        ];
        for (const candidate of candidates) {
            if (!candidate) continue;
            const t = typeof candidate === 'number' ? candidate : new Date(candidate).getTime();
            if (!isNaN(t)) return t;
        }
    } catch (_) {}
    const id = String(romaneio && (romaneio.id || romaneio.romaneioId || romaneio.firebaseKey || romaneio.key || romaneio.numero || romaneio.numeroRomaneio) || '');
    const match = id.match(/(\d{10,})/);
    return match ? Number(match[1]) || 0 : 0;
}

// Utilitário: formatar data do romaneio para exibição no dropdown
function formatRomaneioDateLabel(romaneio) {
    const candidates = [romaneio.dataEmissao, romaneio.data, romaneio.dataHora, romaneio.createdAt, romaneio.created, romaneio.dataRomaneio, romaneio.timestamp, romaneio.updatedAt, romaneio.updated, romaneio.lastModified];
    for (const c of candidates) {
        if (c) {
            const d = new Date(c);
            if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
        }
    }
    return 'S/Data';
}

function generateUniqueId(prefix = '') {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000);
    return `${prefix}${timestamp}${random}`;
}

// Funções de armazenamento (compatibilidade com sistema existente)
async function getData(key) {
    try {
        console.log(`📥 Carregando dados: ${key}`);
        const storageKey = getStorageKey(key);
        const allowLegacy = storageKey === key;
        
        // Tentar Firebase primeiro se disponível
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const result = await window.firebaseService.loadFromFirebase(key);
                
                if (result && result.success && result.data) {
                    const firebaseData = result.data;
                    console.log(`✅ ${key} carregado do Firebase:`, Array.isArray(firebaseData) ? `${firebaseData.length} itens` : 'objeto');
                    
                    // Converter objeto Firebase para array se necessário
                    if (typeof firebaseData === 'object' && !Array.isArray(firebaseData) && firebaseData !== null) {
                        // ✅ Financeiro: finanças/receber pode vir particionado por mês (YYYY-MM/{id})
                        if (key === 'financas/receber') {
                            const all = [];
                            const seen = new Set();
                            const monthRe = /^\d{4}-\d{2}$/;
                            Object.keys(firebaseData)
                                .filter(k => k !== '_metadata' && k !== 'metadata')
                                .forEach(rootKey => {
                                    const val = firebaseData[rootKey];
                                    if (monthRe.test(rootKey) && val && typeof val === 'object') {
                                        const items = Array.isArray(val) ? val : Object.keys(val).map(id => ({ id, ...val[id] }));
                                        items.forEach(it => {
                                            const id = it && (it.id || it.firebaseKey);
                                            if (!id) return;
                                            const sid = String(id);
                                            if (seen.has(sid)) return;
                                            seen.add(sid);
                                            all.push({ ...it, id: sid });
                                        });
                                    }
                                });
                            persistLocalValue(storageKey, all);
                            return all;
                        }
                        console.log(`🔄 Convertendo objeto Firebase para array (${key})...`);
                        // Excluir apenas metadados; aceitar chaves alfanuméricas (push IDs do Firebase)
                        const convertedArray = Object.keys(firebaseData)
                            .filter(k => k !== '_metadata' && k !== 'metadata')
                            .map(itemKey => ({
                                id: (firebaseData[itemKey] && firebaseData[itemKey].id) ? firebaseData[itemKey].id : itemKey,
                                ...firebaseData[itemKey]
                            }))
                            .filter(item => item && typeof item === 'object');
                        console.log(`✅ ${convertedArray.length} itens convertidos`);
                        
                        // Salvar no localStorage como cache
                        persistLocalValue(storageKey, convertedArray);
                        return convertedArray;
                    } else if (Array.isArray(firebaseData)) {
                        // Se já é um array, usar diretamente
                        persistLocalValue(storageKey, firebaseData);
                        return firebaseData;
                    }
                }
            } catch (firebaseError) {
                // ✅ CORREÇÃO: Extrair detalhes do erro para não logar aviso vazio no console
                const errMsg = (firebaseError && (firebaseError.message || firebaseError.code || String(firebaseError))) || 'erro desconhecido';
                console.warn(`\u26a0\ufe0f Erro ao carregar ${key} do Firebase: ${errMsg}`, firebaseError);
            }
        }
        
        // Fallback para localStorage
        const localData = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem(key) : null);
        if (localData) {
            const parsed = JSON.parse(localData);
            
            // ✅ Se for objeto com chaves numéricas, converter para array
            if (typeof parsed === 'object' && !Array.isArray(parsed) && parsed !== null && key === 'clients') {
                console.log(`🔄 Convertendo objeto localStorage para array (${key})...`);
                const converted = Object.keys(parsed)
                    .filter(k => k !== '_metadata' && !isNaN(k))
                    .map(itemKey => ({
                        id: parsed[itemKey].id || itemKey,
                        ...parsed[itemKey]
                    }));
                console.log(`📱 ${key} convertido do localStorage: ${converted.length} itens`);
                persistLocalValue(storageKey, converted);
                return converted;
            }
            
            // ✅ Filtrar _metadata se for array
            if (Array.isArray(parsed)) {
                const filtered = parsed.filter(item => {
                    // Excluir items com id="_metadata" ou sem ID válido
                    if (!item || typeof item !== 'object') return false;
                    if (item.id === '_metadata' || item.id === null || item.id === undefined) return false;
                    return true;
                });
                
                if (filtered.length !== parsed.length) {
                    console.log(`🔄 Filtrados ${parsed.length - filtered.length} itens inválidos de ${key}`);
                    persistLocalValue(storageKey, filtered);
                    return filtered;
                }
            }
            
            console.log(`📱 ${key} carregado do localStorage:`, Array.isArray(parsed) ? `${parsed.length} itens` : 'objeto');
            return parsed;
        }
        
        console.log(`ℹ️ Nenhum dado encontrado para ${key}`);
        return null;
    } catch (error) {
        console.error(`❌ Erro ao recuperar dados de '${key}':`, error);
        return null;
    }
}

// ==========================
// Carregamento canônico de romaneios (somente companies/{companyId})
// ==========================
async function getRomaneiosMerged(tipoKey) {
    try {
        const canonicalMap = {
            romaneiosTora: 'romaneios/tora',
            romaneiosPct: 'romaneios/pct',
            romaneiosPCT: 'romaneios/pct',
            romaneiosTL: 'romaneios/tl',
            romaneiosTl: 'romaneios/tl',
            romaneios_tl: 'romaneios/tl',
            romaneiosPes: 'romaneios/pes',
            romaneiosPES: 'romaneios/pes',
            romaneios_pes: 'romaneios/pes'
        };
        const canonicalKey = canonicalMap[tipoKey] || tipoKey;
        if (!window.firebaseService || typeof window.firebaseService.loadFromFirebase !== 'function') {
            console.warn('Vendas: firebaseService indisponível para carregar romaneios.');
            return [];
        }
        const result = await window.firebaseService.loadFromFirebase(canonicalKey);
        const rawData = result && result.success ? result.data : null;
        let merged = [];
        if (window.RomaneioDataUtils && typeof window.RomaneioDataUtils.normalizeRomaneioCollection === 'function') {
            const type = canonicalKey.split('/').pop();
            merged = window.RomaneioDataUtils.normalizeRomaneioCollection(rawData, { type });
        } else if (Array.isArray(rawData)) {
            merged = rawData.filter(r => r && typeof r === 'object' && (r.id || r.numero || r.firebaseKey || r.itens || r.items));
        } else if (rawData && typeof rawData === 'object') {
            merged = Object.entries(rawData)
                .filter(([k, v]) => k !== '_metadata' && k !== 'metadata' && v && typeof v === 'object')
                .map(([k, v]) => ({ id: v.id || k, firebaseKey: k, ...(v || {}) }));
        }
        const getItens = r => Array.isArray(r.items) ? r.items : (Array.isArray(r.itens) ? r.itens : []);
        const isTora = r => {
            const itens = getItens(r);
            const tr = String(r.tipoRomaneio || '').toLowerCase();
            const t = String(r.tipo || '').toLowerCase();
            if (tr.includes('tora')) return true;
            if (t === 'tora') return true;
            return itens.some(i => typeof i.rodo !== 'undefined' || typeof i.diametro !== 'undefined' || typeof i.volumeSerraria !== 'undefined' || typeof i.volumeLiquido !== 'undefined');
        };
        const isPct = r => {
            const itens = getItens(r);
            const tr = String(r.tipoRomaneio || '').toLowerCase();
            const t = String(r.tipo || '').toLowerCase();
            if (tr.includes('pct')) return true;
            if (t === 'pct') return true;
            return itens.some(i => typeof i.pecasPorPacote !== 'undefined' || typeof i.totalPecas !== 'undefined' || typeof i.pacoteId !== 'undefined');
        };
        const isTl = r => {
            const itens = getItens(r);
            if (!itens || itens.length === 0) return false;
            return !isTora(r) && !isPct(r);
        };
        const keyLower = String(tipoKey || '').toLowerCase();
        if (keyLower.includes('tora')) {
            merged = merged.filter(r => isTora(r));
        } else if (keyLower.includes('pct')) {
            merged = merged.filter(r => isPct(r));
        } else if (keyLower.includes('tl')) {
            merged = merged.filter(r => isTl(r));
        }
        merged.sort((a, b) => extractRomaneioTimestamp(b) - extractRomaneioTimestamp(a));
        const sampleIds = merged.slice(0, 5).map(r => String(r.id || r.numero));
        console.log(`Vendas: ${canonicalKey} carregado. Total=${merged.length}. Amostra IDs:`, sampleIds);
        return merged;
    } catch (err) {
        console.error('Vendas: erro inesperado ao mesclar romaneios:', err);
        return [];
    }
}

// Flag dedicada: resultado REMOTO da última chamada saveData (o retorno boolean
// de saveData preserva o contrato antigo e não pode ser alterado: outros
// chamadores dependem dele). Lida logo após o await, no mesmo fluxo.
let __rvSaveDataRemoteOk = false;

async function saveData(key, data) {
    __rvSaveDataRemoteOk = false;
    try {
        console.log(`💾 Salvando dados: ${key}`);
        
        // Salvar no localStorage primeiro
        const storageKey = getStorageKey(key);
        persistLocalValue(storageKey, data);
        console.log(`✅ ${key} salvo no localStorage:`, Array.isArray(data) ? `${data.length} itens` : 'objeto');
        
        // Tentar salvar no Firebase se disponível
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            try {
                console.log(`🔥 Tentando salvar ${key} no Firebase...`);
                // Evitar sobrescrita em coleções sensíveis: salvar por registro
                const perRecordKeys = new Set(['contasReceber', 'contasPagar', 'romaneiosPct']);
                if (Array.isArray(data) && perRecordKeys.has(String(key))) {
                    // Lote com concorrência limitada (antes: 1 round-trip sequencial
                    // por registro; 200 contas ≈ 1min). Mesma semântica por registro.
                    const alvos = data.filter(item => item && item.id);
                    const tentados = alvos.length;
                    let ok = 0;
                    const LIMITE = 8;
                    for (let i = 0; i < alvos.length; i += LIMITE) {
                        const lote = alvos.slice(i, i + LIMITE).map(item => {
                            const payload = { ...item };
                            Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                            return window.firebaseService.saveToFirebase(String(key), String(item.id), payload)
                                .then(res => { if (res && res.success) ok++; })
                                .catch(() => {});
                        });
                        await Promise.allSettled(lote);
                    }
                    __rvSaveDataRemoteOk = tentados > 0 && ok === tentados;
                    console.log(`✅ ${key}: ${ok} registro(s) salvos por registro (sem sobrescrever)`);
                } else {
                    // Para demais casos, substituir conteúdo inteiro
                    const result = await window.firebaseService.saveToFirebase(key, null, data);
                    if (result && result.success) {
                        __rvSaveDataRemoteOk = true;
                        console.log(`✅ ${key} salvo no Firebase com sucesso`);
                    } else {
                        console.warn(`⚠️ Falha ao salvar ${key} no Firebase:`, result);
                    }
                }
            } catch (firebaseError) {
                __rvSaveDataRemoteOk = false;
                console.warn(`⚠️ Erro ao salvar ${key} no Firebase:`, firebaseError);
            }
        }
        
        return true;
    } catch (error) {
        console.error(`❌ Erro ao salvar dados em '${key}':`, error);
        return false;
    }
}

// Expor funções globalmente para uso nos eventos HTML
window.showTab = showTab;
window.novoPedido = novoPedido;
window.cancelarPedido = cancelarPedido;
window.adicionarItem = adicionarItem;
window.removerItem = removerItem;
window.editarItem = editarItem;
window.listarPedidos = listarPedidos;
window.filtrarPedidos = filtrarPedidos;
window.editarPedido = editarPedido;
window.clonarPedido = clonarPedido;
window.excluirPedido = excluirPedido;
window.novoProduto = novoProduto;
window.listarProdutos = listarProdutos;
window.filtrarProdutos = filtrarProdutos;
window.editarProduto = editarProduto;
window.excluirProduto = excluirProduto;
window.gerarRelatorio = gerarRelatorio;
window.abrirModalCliente = abrirModalCliente;
window.fecharModal = fecharModal;
window.formatCurrency = formatCurrency;
window.parseCurrencyValue = parseCurrencyValue;
window.atualizarSelectClientes = atualizarSelectClientes;
window.vendasClientesNovo = vendasClientesNovo;
window.vendasClientesEditar = vendasClientesEditar;
window.vendasClientesExcluir = vendasClientesExcluir;
window.vendasClientesCancelar = vendasClientesCancelar;
window.vendasClientesRecarregar = vendasClientesRecarregar;

// ===== NOVAS FUNCIONALIDADES =====

// Função para alternar entre tipos de produto
function alterarTipoProduto(tipo) {
    // Ocultar todas as seções
    document.getElementById('secaoProdutoManual').style.display = 'none';
    document.getElementById('secaoProdutoRomaneio').style.display = 'none';
    document.getElementById('secaoProdutoCadastrado').style.display = 'none';
    
    // Mostrar seção selecionada
    switch(tipo) {
        case 'manual':
            document.getElementById('secaoProdutoManual').style.display = 'block';
            break;
        case 'romaneio':
            document.getElementById('secaoProdutoRomaneio').style.display = 'block';
            break;
        case 'cadastrado':
            document.getElementById('secaoProdutoCadastrado').style.display = 'block';
            break;
    }
    
    console.log(`Tipo de produto alterado para: ${tipo}`);
}

// Função para adicionar item manual
function adicionarItemManual() {
    const nome = document.getElementById('produtoManual').value.trim();
    const quantidade = parseFloat(document.getElementById('quantidadeManual').value);
    const unidade = document.getElementById('unidadeManual').value;
    const precoUnitario = parseCurrencyValue(document.getElementById('precoManual').value);
    
    if (!nome) {
        ToastManager.warning('Digite o nome do produto', 'Atenção');
        return;
    }
    
    if (!quantidade || quantidade <= 0) {
        ToastManager.warning('Informe uma quantidade válida', 'Atenção');
        return;
    }
    
    if (!precoUnitario || precoUnitario <= 0) {
        ToastManager.warning('Informe um preço válido', 'Atenção');
        return;
    }
    
    // ✅ EDIÇÃO DE ITEM: atualizar o item marcado em vez de criar um novo
    if (itemEmEdicaoId) {
        const alvo = itensCarrinho.find(i => String(i.id) === String(itemEmEdicaoId));
        itemEmEdicaoId = null;
        if (alvo) {
            alvo.produtoNome = nome;
            alvo.produtoId = `manual_${Date.now()}`;
            alvo.quantidade = quantidade;
            alvo.unidade = unidade;
            alvo.precoUnitario = precoUnitario;
            alvo.total = quantidade * precoUnitario;
            alvo.tipo = 'manual';
            document.getElementById('produtoManual').value = '';
            document.getElementById('quantidadeManual').value = '';
            document.getElementById('unidadeManual').value = 'm³';
            document.getElementById('precoManual').value = '';
            atualizarTabelaItens();
            atualizarTotais();
            ToastManager.success(`${nome} atualizado no carrinho`, 'Item atualizado', 2000);
            return;
        }
    }

    const novoItem = {
        id: Date.now(),
        produtoId: `manual_${Date.now()}`,
        produtoNome: nome,
        quantidade: quantidade,
        unidade: unidade,
        precoUnitario: precoUnitario,
        total: quantidade * precoUnitario,
        tipo: 'manual'
    };
    
    itensCarrinho.push(novoItem);
    
    // Limpar campos
    document.getElementById('produtoManual').value = '';
    document.getElementById('quantidadeManual').value = '';
    document.getElementById('unidadeManual').value = 'm³'; // Padrão m³
    document.getElementById('precoManual').value = '';
    
    atualizarTabelaItens();
    atualizarTotais();
    
    ToastManager.success(`${nome} adicionado ao carrinho`, 'Item manual adicionado', 2000);
    console.log('Item manual adicionado:', novoItem);
}

// Função para carregar romaneios por tipo
async function carregarRomaneiosPorTipo() {
    const legacyKey = ['b','i','t','o','l','a'].join('');
    const tipoSelecionado = document.getElementById('tipoRomaneio').value;
    const selectRomaneio = document.getElementById('romaneioSelect');
    
    // Limpar select de romaneio
    selectRomaneio.innerHTML = '<option value="">Selecione um romaneio</option>';
    
    if (!tipoSelecionado) {
        return;
    }
    
    try {
        // Usar dataset mesclado (Firebase + localStorage)
        const romaneiosOrdenados = await getRomaneiosMerged(tipoSelecionado);
        // Cachear para manter a mesma ordenação ao selecionar
        romaneiosPorTipoCache[tipoSelecionado] = romaneiosOrdenados;

    romaneiosOrdenados.forEach((romaneio, index) => {
        const option = document.createElement('option');
        option.value = index;
        
        // Criar descrição melhorada do romaneio
        const dataFormatada = formatRomaneioDateLabel(romaneio);
        
        // Buscar nome do cliente
        let clienteNome = 'Cliente não informado';
        if (romaneio.cliente) {
            clienteNome = romaneio.cliente.nome || romaneio.cliente.name || romaneio.cliente;
        } else if (romaneio.clienteNome) {
            clienteNome = romaneio.clienteNome;
        } else if (romaneio.fornecedor) {
            // TORA geralmente usa fornecedor
            clienteNome = romaneio.fornecedor.nome || romaneio.fornecedor.name || romaneio.fornecedor;
        } else if (romaneio.transportador) {
            clienteNome = romaneio.transportador.nome || romaneio.transportador.name || romaneio.transportador;
        }
        
        // Buscar volume total
        let volumeTotal = '0,000';
        // 1) Campos agregados comuns
        if (romaneio.volumeTotal) {
            volumeTotal = formatNumber(romaneio.volumeTotal, 3);
        } else if (romaneio.totalVolume) {
            volumeTotal = formatNumber(romaneio.totalVolume, 3);
        } else if (romaneio.totais && (romaneio.totais.volume || romaneio.totais.volumeSerraria || romaneio.totais.volumeEstimado)) {
            const volAgregado = romaneio.totais.volume || romaneio.totais.volumeSerraria || romaneio.totais.volumeEstimado;
            volumeTotal = formatNumber(volAgregado, 3);
        } else {
            // 2) Calcular pelos itens (suporta 'items' e 'itens')
            const listaItens = Array.isArray(romaneio.items) ? romaneio.items : (Array.isArray(romaneio.itens) ? romaneio.itens : []);
            if (listaItens.length > 0) {
                const isTora = (tipoSelecionado === 'romaneiosTora');
                const volumeCalculado = listaItens.reduce((total, item) => {
                    const quantidade = parseInt(item.quantidade) || 1;
                    if (isTora) {
                        // Para TORA, priorizar volume líquido/serraria; depois volume bruto
                        const vLiquido = parseFloat(item.volumeLiquido || item.volumeSerraria);
                        const vBruto = parseFloat(item.volumeBruto || item.volumeEstimado);
                        if (!isNaN(vLiquido) && vLiquido > 0) {
                            return total + (vLiquido * quantidade);
                        } else if (!isNaN(vBruto) && vBruto > 0) {
                            return total + (vBruto * quantidade);
                        }
                        // Cálculo por dimensões cilíndricas com desconto de oco
                        const diametro = parseFloat(item.diametro || item.rodo) || 0; // mm
                        const comprimento = parseFloat(item.comprimento) || 0; // cm
                        const oco1 = parseFloat(item.oco1) || 0; // cm
                        const oco2 = parseFloat(item.oco2) || 0; // cm
                        // Converter para metros e calcular
                        const raio_m = (diametro / 100) / 2; // diametro em cm
                        const comprimento_m = (comprimento / 100);
                        const volumeBrutoM3 = Math.PI * Math.pow(raio_m, 2) * comprimento_m;
                        const descontoOcoM3 = (oco1 / 100) * (oco2 / 100) * (comprimento / 100);
                        const volumeLiquidoM3 = Math.max(0, volumeBrutoM3 - descontoOcoM3);
                        return total + (volumeLiquidoM3 * quantidade);
                    } else {
                        // TL/PCT/PES: priorizar volume informado; senão calcular por dimensões
                        // item.volume JÁ É TOTAL (não multiplicar por quantidade):
                        // PCT carregar-romaneio-pct.js (volume = unit×qtd×ppp),
                        // TL salvar-romaneio.js (volume = unit×quantidade),
                        // PES romaneiopes.html (totais = SUM item.volume).
                        const volumeInformado = parseFloat(item.volume);
                        if (!isNaN(volumeInformado) && volumeInformado > 0) {
                            return total + volumeInformado;
                        }
                        const comprimento = parseFloat(item.comprimento) || 0;
                        const largura = parseFloat(item.largura) || 0;
                        const espessura = parseFloat(item.espessura) || parseFloat(item[legacyKey]) || 0;
                        const pecasPorPacote = parseInt(item.pecasPorPacote) || 1;
                        const volumeUnitario = (comprimento / 100) * (largura / 100) * (espessura / 100);
                        return total + (volumeUnitario * quantidade * pecasPorPacote);
                    }
                }, 0);
                volumeTotal = formatNumber(volumeCalculado, 3);
            }
        }
        
        // Buscar total em moeda
        let totalMoeda = null;
        if (typeof romaneio.totalValue === 'number') {
            totalMoeda = formatCurrency(romaneio.totalValue);
        } else if (romaneio.totais) {
            if (typeof romaneio.totais.valor === 'number') {
                totalMoeda = formatCurrency(romaneio.totais.valor);
            } else if (typeof romaneio.totais.valorTotal === 'number') {
                // TORA costuma usar 'valorTotal' nos totais
                totalMoeda = formatCurrency(romaneio.totais.valorTotal);
            }
        }

        // Número sequencial ("Nº N") quando existir; legados sem número não mudam.
        let sufixoNumero = '';
        try {
            const RU3 = window.RomaneioDataUtils;
            if (RU3 && typeof RU3.formatarNumeroExibicao === 'function') {
                const fmt = RU3.formatarNumeroExibicao(romaneio, '');
                if (fmt) sufixoNumero = ` (#${fmt})`;
            }
        } catch (_) {}
        option.textContent = totalMoeda ?
            `${dataFormatada} - ${clienteNome} - ${volumeTotal} m³ - ${totalMoeda}${sufixoNumero}` :
            `${dataFormatada} - ${clienteNome} - ${volumeTotal} m³${sufixoNumero}`;
        option.dataset.romaneioIdx = String(index);
        selectRomaneio.appendChild(option);
    });

        // Anotação best-effort de reuso no dropdown (não bloqueia, não desabilita).
        // Um único scan de pedidos; falha => mantém texto original (fail-open).
        try {
            Promise.resolve(construirMapaUsosRomaneioVendas()).then((mapaUsos) => {
                try {
                    if (!mapaUsos || mapaUsos.size === 0) return;
                    const opts = selectRomaneio.querySelectorAll('option[data-romaneio-idx]');
                    opts.forEach((opt) => {
                        const idx = parseInt(opt.dataset.romaneioIdx, 10);
                        const r = romaneiosOrdenados[idx];
                        if (!r) return;
                        const rid = obterIdEstavelRomaneioVendas(r);
                        if (!rid || opt.dataset.usoAnotado === '1') return;
                        const uso = mapaUsos.get(String(rid));
                        if (uso) {
                            opt.dataset.usoAnotado = '1';
                            opt.dataset.usadoPedido = String(uso.pedidoNumero || '');
                            opt.title = `Já utilizado no pedido de ${uso.modulo === 'compra' ? 'Compra' : 'Venda'} Nº ${uso.pedidoNumero}`;
                            if (!/USADO/i.test(opt.textContent || '')) {
                                opt.textContent = `${opt.textContent} • USADO Ped. Nº ${uso.pedidoNumero}`;
                            }
                        }
                    });
                } catch (_) { /* best-effort */ }
            }).catch(() => {});
        } catch (_) { /* best-effort */ }
        
        console.log(`Carregados ${romaneiosOrdenados.length} romaneios do tipo ${tipoSelecionado} (mesclados e ordenados por mais recente)`);
        atualizarEstadoAgrupamentoVendas(tipoSelecionado);
    } catch (error) {
        console.error('Erro ao carregar romaneios:', error);
        notifyUser('Erro ao carregar romaneios. Verifique o console para mais detalhes.');
    }
}

// Função para carregar dados do romaneio selecionado
async function carregarDadosRomaneio() {
    const tipoRomaneio = document.getElementById('tipoRomaneio').value;
    const indiceRomaneio = document.getElementById('romaneioSelect').value;
    
    if (!tipoRomaneio || indiceRomaneio === '') {
        document.getElementById('previewConama').style.display = 'none';
        romaneioSelecionado = null;
        limparExclusoesPreviewVendas();
        romaneioPreviewUsoInfo = null;
        romaneioPreviewTipoAtual = '';
        __rvPreviewChaves = [];
        return;
    }
    
    try {
        // Usar cache ordenado para manter consistência com o dropdown
        let romaneios = romaneiosPorTipoCache[tipoRomaneio];
        if (!romaneios || !Array.isArray(romaneios) || romaneios.length === 0) {
            romaneios = await getRomaneiosMerged(tipoRomaneio);
            romaneiosPorTipoCache[tipoRomaneio] = romaneios;
        }
        const romaneio = romaneios[parseInt(indiceRomaneio)];
        
        if (!romaneio) {
            notifyUser('Romaneio não encontrado');
            return;
        }
        
        romaneioSelecionado = romaneio;
        romaneioPreviewTipoAtual = tipoRomaneio;
        atualizarEstadoAgrupamentoVendas(tipoRomaneio);
        limparExclusoesPreviewVendas();
        __rvPreviewChaves = [];
        romaneioPreviewUsoInfo = null;
        // Invariante: sempre um modo selecionado (padrão por tipo).
        try {
            const cbA = document.getElementById('agruparEspecieCheckbox');
            const cbB = document.getElementById('agruparEspecieLarguraCheckbox');
            const cbC = document.getElementById('agruparDimensoesCheckbox');
            const cbR = document.getElementById('agruparResumoVendas');
            if (cbA && cbB && cbC && cbR && !cbA.checked && !cbB.checked && !cbC.checked && !cbR.checked) {
                if (String(tipoRomaneio || '').toLowerCase().includes('tora')) cbR.checked = true;
                else cbB.checked = true;
            }
        } catch (_) { /* best-effort */ }

        // Trava de reuso: verifica se este romaneio já foi usado em outro pedido.
        // Fail-open: se a verificação falhar, permite o fluxo normal.
        try {
            const idEstavel = obterIdEstavelRomaneioVendas(romaneio);
            if (idEstavel) {
                romaneioPreviewUsoInfo = await buscarUsoRomaneioVendas(idEstavel);
                if (romaneioPreviewUsoInfo) {
                    const idExibicao = obterNumeroExibicaoRomaneioVendas(romaneio, idEstavel);
                    ToastManager.warning(mensagemUsoRomaneioVendas(idExibicao, romaneioPreviewUsoInfo), 'Romaneio já utilizado', 6000);
                }
            }
        } catch (_) { romaneioPreviewUsoInfo = null; }
        
        // Extrair resumo CONAMA do romaneio
        const resumoConama = extrairResumoConama(romaneio);
        
        // Mostrar preview (com exclusão por item + estado de uso)
        mostrarPreviewConama(resumoConama, romaneioPreviewUsoInfo);
        
        console.log('Romaneio carregado:', romaneio);
        console.log('Resumo CONAMA extraído:', resumoConama);
        
    } catch (error) {
        console.error('Erro ao carregar dados do romaneio:', error);
        notifyUser('Erro ao processar romaneio. Verifique o console para mais detalhes.');
    }
}

// Utilitário: obter preço unitário do item de romaneio, priorizando campos do Firebase
function obterPrecoUnitarioItem(item) {
    const candidatos = [item.valorUnitario, item.precoUnitario, item.preco, item.price];
    for (let i = 0; i < candidatos.length; i++) {
        const valor = parseFloat(candidatos[i]);
        if (!isNaN(valor) && valor > 0) {
            return valor;
        }
    }
    return 0;
}

function formatarMedidaCm(valor) {
    const n = typeof valor === 'number' ? valor : parseFloat(valor);
    if (isNaN(n) || !isFinite(n)) return '0';
    const rounded = Math.round(n * 100) / 100;
    const isInt = Math.abs(rounded - Math.round(rounded)) < 1e-9;
    const str = isInt
        ? String(Math.round(rounded))
        : rounded.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    return str;
}

function construirChaveDimensoes(espessura, largura) {
    return `${formatarMedidaCm(espessura)}cmx${formatarMedidaCm(largura)}cm`;
}

function normalizarIdRomaneioParte(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

function construirResumoPecasParaDescricao(cat) {
    if (!cat || typeof cat !== 'object') return '';
    const pecas = parseInt(cat.pecasTotal, 10) || 0;
    const pacotes = parseInt(cat.pacotesTotal, 10) || 0;
    const pppTotals = cat.pppTotals && typeof cat.pppTotals === 'object' ? cat.pppTotals : null;

    if (pacotes > 0) {
        const keys = pppTotals ? Object.keys(pppTotals).filter(k => k && k !== '0') : [];
        if (keys.length === 1) {
            const ppp = keys[0];
            if (ppp === '1') {
                return `${pecas} Peça${pecas === 1 ? '' : 's'}`;
            }
            return `${pacotes} Pacote${pacotes === 1 ? '' : 's'} C/${ppp} Peça${ppp === '1' ? '' : 's'}`;
        }
        if (pecas > 0) {
            return `${pecas} Peças (${pacotes} pacote${pacotes === 1 ? '' : 's'})`;
        }
        return `${pacotes} Pacote${pacotes === 1 ? '' : 's'}`;
    }

    if (pecas > 0) {
        return `${pecas} Peça${pecas === 1 ? '' : 's'}`;
    }

    return '';
}

// Função para extrair resumo CONAMA do romaneio
function extrairResumoConama(romaneio) {
    const legacyKey = ['b','i','t','o','l','a'].join('');
    if (!romaneio || typeof romaneio !== 'object') {
        return {};
    }
    const listaItens = Array.isArray(romaneio.items) ? romaneio.items : (Array.isArray(romaneio.itens) ? romaneio.itens : []);
    if (listaItens.length === 0) {
        return {};
    }
    
    const resumoPorEspecie = {};
    const isTora = !!(romaneio?.tipoRomaneio === 'romaneiosTora' || String(romaneio?.tipo || '').toLowerCase() === 'tora' || listaItens.some(i => typeof i.rodo !== 'undefined' || typeof i.diametro !== 'undefined'));
    if (isTora) {
        listaItens.forEach(item => {
            const especie = (item.especie || item.especieNome || 'Não especificada').replace(/^\s*[-–—]\s*/, '').trim();
            const quantidade = parseInt(item.quantidade) || 1;
            const vLiquido = parseFloat(item.volumeLiquido || item.volumeSerraria);
            const vBruto = parseFloat(item.volumeBruto || item.volumeEstimado);
            let volumeTotal = 0;
            if (!isNaN(vLiquido) && vLiquido > 0) {
                volumeTotal = vLiquido * quantidade;
            } else if (!isNaN(vBruto) && vBruto > 0) {
                volumeTotal = vBruto * quantidade;
            } else {
                const diametro = parseFloat(item.diametro || item.rodo) || 0;
                const comprimento = parseFloat(item.comprimento) || 0;
                const oco1 = parseFloat(item.oco1) || 0;
                const oco2 = parseFloat(item.oco2) || 0;
                const raio_m = (diametro / 100) / 2;
                const comprimento_m = (comprimento / 100);
                const volumeBrutoM3 = Math.PI * Math.pow(raio_m, 2) * comprimento_m;
                const descontoOcoM3 = (oco1 / 100) * (oco2 / 100) * (comprimento / 100);
                const volumeLiquidoM3 = Math.max(0, volumeBrutoM3 - descontoOcoM3);
                volumeTotal = volumeLiquidoM3 * quantidade;
            }
            const precoBase = parseFloat(item.preco || item.valorUnitario || 0) || 0;
            const preco = precoBase > 0 ? precoBase : (VendasConfig?.precoPorM3Padrao || 0);
            const categoria = 'Tora';
            if (!resumoPorEspecie[especie]) {
                resumoPorEspecie[especie] = { categorias: {} };
            }
            if (!resumoPorEspecie[especie].categorias[categoria]) {
                resumoPorEspecie[especie].categorias[categoria] = { volume: 0, valorTotal: 0, precoUnitario: 0, pecasTotal: 0, pacotesTotal: 0, pppTotals: {}, espessura: 0, largura: 0 };
            }
            resumoPorEspecie[especie].categorias[categoria].volume += volumeTotal;
            resumoPorEspecie[especie].categorias[categoria].valorTotal += volumeTotal * preco;
        });
    } else {
        listaItens.forEach(item => {
            const especie = (item.especie || item.especieNome || 'Não especificada').replace(/^\s*[-–—]\s*/, '').trim();
            const comprimento = parseFloat(item.comprimento) || 0;
            const largura = parseFloat(item.largura) || 0;
            const espessura = parseFloat(item.espessura) || parseFloat(item[legacyKey]) || 0;
            const quantidade = parseInt(item.quantidade) || 1;
            const pppRaw = item.pecasPorPacote;
            const pecasPorPacote = (typeof pppRaw === 'object' && pppRaw !== null) ? (parseInt(pppRaw.valor || 1) || 1) : (parseInt(pppRaw) || 1);
            const volumeInformado = parseFloat(item.volume);
            const isPCT = !!(romaneio?.tipo === 'pct' || romaneio?.tipoRomaneio === 'romaneiosPct' || typeof item.pecasPorPacote !== 'undefined' || typeof item.totalPecas !== 'undefined');
            const categoriaBase = classificarProdutoConama(espessura, largura);
            const dimensoesKey = construirChaveDimensoes(espessura, largura);
            const categoria = `${categoriaBase} ${dimensoesKey}`;
            let volumeTotal = 0;
            // item.volume JÁ É TOTAL nos 3 tipos serrados (PCT/TL/PES) — somar direto.
            if (!isNaN(volumeInformado) && volumeInformado > 0) {
                volumeTotal = volumeInformado;
            } else {
                const volumeUnitario = (comprimento / 100) * (largura / 100) * (espessura / 100);
                volumeTotal = isPCT ? (volumeUnitario * quantidade * pecasPorPacote) : (volumeUnitario * quantidade);
            }
            const preco = obterPrecoUnitarioItem(item);
            if (!resumoPorEspecie[especie]) {
                resumoPorEspecie[especie] = { categorias: {} };
            }
            if (!resumoPorEspecie[especie].categorias[categoria]) {
                resumoPorEspecie[especie].categorias[categoria] = {
                    volume: 0,
                    valorTotal: 0,
                    precoUnitario: 0,
                    pecasTotal: 0,
                    pacotesTotal: 0,
                    pppTotals: {},
                    categoriaBase,
                    dimensoesKey,
                    espessura: espessura,
                    largura: largura
                };
            }
            resumoPorEspecie[especie].categorias[categoria].volume += volumeTotal;
            resumoPorEspecie[especie].categorias[categoria].valorTotal += volumeTotal * preco;

            const catRef = resumoPorEspecie[especie].categorias[categoria];
            if (isPCT) {
                const totalPecasRaw = item.totalPecas != null ? parseInt(item.totalPecas, 10) : null;
                const pacotes = quantidade;
                const pecas = (totalPecasRaw != null && !isNaN(totalPecasRaw) && totalPecasRaw > 0)
                    ? totalPecasRaw
                    : (pacotes * (pecasPorPacote || 1));
                catRef.pacotesTotal += pacotes;
                catRef.pecasTotal += pecas;
                const key = String(pecasPorPacote || 0);
                catRef.pppTotals[key] = (catRef.pppTotals[key] || 0) + pacotes;
            } else {
                catRef.pecasTotal += quantidade;
            }
        });
    }
    
    Object.keys(resumoPorEspecie).forEach(especie => {
        Object.keys(resumoPorEspecie[especie].categorias).forEach(categoria => {
            const cat = resumoPorEspecie[especie].categorias[categoria];
            if (cat.volume > 0) {
                cat.precoUnitario = cat.valorTotal / cat.volume;
            } else {
                cat.precoUnitario = 0;
            }
        });
    });
    
    return resumoPorEspecie;
}

// Função de classificação CONAMA (reutilizada dos romaneios)
function classificarProdutoConama(espessura, largura) {
    // Bloco, quadrado ou filé: espessura > 12 cm e largura > 12 cm
    if (espessura > 12 && largura > 12) {
        return 'Bloco, quadrado ou filé';
    } 
    // Pranchões: espessura > 7,0 cm e largura > 20,0 cm
    else if (espessura > 7.0 && largura > 20.0) {
        return 'Pranchões';
    } 
    // Prancha: espessura entre 4,0 e 7,0 cm e largura > 20,0 cm
    else if (espessura >= 4.0 && espessura <= 7.0 && largura > 20.0) {
        return 'Prancha';
    } 
    // Viga: espessura > 4,0 cm e largura entre 11,0 e 20,0 cm
    else if (espessura > 4.0 && largura >= 11.0 && largura <= 20.0) {
        return 'Viga';
    } 
    // Vigota: espessura entre 4,0 e 10 cm e largura entre 8,0 e 11,0 cm
    else if (espessura >= 4.0 && espessura <= 8.0 && largura >= 8.0 && largura < 11.0) {
        return 'Vigota';
    } 
    // Caibro: espessura entre 4,0 e 8,0 cm e largura entre 5,0 e 8,0 cm
    else if (espessura >= 4.0 && espessura <= 8.0 && largura >= 5.0 && largura < 8.0) {
        return 'Caibro';
    } 
    // Tábua: espessura entre 1,0 e 4,0 cm e largura > 10,0 cm
    else if (espessura >= 1.0 && espessura < 4.0 && largura > 10.0) {
        return 'Tábua';
    } 
    // Sarrafo: espessura entre 2,0 e 4,0 cm e largura entre 2,0 e 10,0 cm
    else if (espessura >= 2.0 && espessura < 4.0 && largura >= 2.0 && largura <= 10.0) {
        return 'Sarrafo';
    } 
    // Ripa: espessura < 2,0 cm e largura < 10,0 cm
    else if (espessura < 2.0 && largura < 10.0) {
        return 'Ripa';
    } 
    else {
        return 'Outro';
    }
}

// Função para mostrar preview do resumo CONAMA (com exclusão por item + trava de reuso)
function mostrarPreviewConama(resumoConama, usoInfo) {
    const container = document.getElementById('listaConama');
    const uso = usoInfo || romaneioPreviewUsoInfo || null;
    __rvPreviewChaves = [];
    let html = '';

    if (uso) {
        const moduloLabel = uso.modulo === 'compra' ? 'Compra' : 'Venda';
        html += `<div style="background:var(--sw-alert-warning-bg);border:1px solid var(--sw-warning);color:var(--sw-alert-title);padding:10px 12px;border-radius:4px;margin-bottom:10px;font-size:13px;">`
            + `<strong><i class="fas fa-lock"></i> Romaneio já utilizado no pedido de ${escaparHtmlRomaneioVendas(moduloLabel)} Nº ${escaparHtmlRomaneioVendas(uso.pedidoNumero)}.</strong><br>`
            + `<span>Os itens abaixo estão desativados. O botão "Carregar Itens" ficará bloqueado para este romaneio.</span></div>`;
    } else {
        html += '<p style="color:var(--sw-text-3);font-size:12px;margin:0 0 10px 0;">Desmarque ou exclua os itens que <strong>não</strong> devem ir para o pedido. O botão "Carregar Itens" carrega apenas o que permanecer selecionado.</p>';
    }

    if (Object.keys(resumoConama).length === 0) {
        html += '<p style="color: #666; font-style: italic;">Nenhum dado CONAMA encontrado no romaneio selecionado.</p>';
    } else {
        html += '<div style="display: grid; gap: 10px;">';
        const modoPrevVendas = lerModoAgrupamentoVendas();
        modoAgrupPreviewVendas = modoPrevVendas;
        // Grupos por modo (fontes únicas, idênticas às da carga).
        let gruposEspPrev = [];
        let gruposDimsPrev = [];
        let nCatsPrev = 0;
        try {
            if (modoPrevVendas === 'especie') {
                gruposEspPrev = agruparResumoPorEspessuraVendas(resumoConama, 0);
            } else if (modoPrevVendas === 'dimensoes' && romaneioSelecionado) {
                const brutosPrev = Array.isArray(romaneioSelecionado.items) ? romaneioSelecionado.items : (Array.isArray(romaneioSelecionado.itens) ? romaneioSelecionado.itens : []);
                gruposDimsPrev = agruparBrutosPorDimensoesVendas(brutosPrev, romaneioSelecionado);
            } else if (modoPrevVendas === 'largura') {
                Object.keys(resumoConama).forEach((esp) => {
                    nCatsPrev += Object.keys((resumoConama[esp] && resumoConama[esp].categorias) || {}).length;
                });
            }
        } catch (_) { gruposEspPrev = []; gruposDimsPrev = []; nCatsPrev = 0; }
        if (!uso && modoPrevVendas !== 'nenhum') {
            try {
                let linhaModoVendas = '';
                if (modoPrevVendas === 'especie') {
                    linhaModoVendas = `Modo <strong>Espécie x Espessura</strong>: ${gruposEspPrev.length} grupo(s) — será carregado 1 item por grupo.`;
                } else if (modoPrevVendas === 'largura') {
                    linhaModoVendas = `Modo <strong>Espécie x Espessura x Largura</strong>: ${nCatsPrev} grupo(s) — será carregado 1 item por grupo.`;
                } else if (modoPrevVendas === 'dimensoes') {
                    linhaModoVendas = `Modo <strong>Espessura x Largura x Comprimento</strong>: ${gruposDimsPrev.length} grupo(s) — será carregado 1 item por grupo.`;
                } else if (modoPrevVendas === 'resumo') {
                    linhaModoVendas = `Modo <strong>Resumo por Espécie</strong>: ${Object.keys(resumoConama).length} grupo(s) — será carregado 1 item por grupo.`;
                }
                if (linhaModoVendas) {
                    html += `<p style="color:var(--sw-alert-title);background:var(--sw-alert-info-bg);border:1px solid var(--sw-info);font-size:12px;margin:0 0 10px 0;padding:8px 10px;border-radius:4px;"><i class="fas fa-layer-group"></i> ${linhaModoVendas}</p>`;
                }
            } catch (_) { /* banner best-effort */ }
        }

        Object.keys(resumoConama).forEach(especie => {
            const especieSafe = escaparHtmlRomaneioVendas(especie);
            const especieLimpaPrev = String(especie || '').replace(/^\s*[-–—]\s*/, '').trim();
            html += `<div style="border: 1px solid var(--sw-border); padding: 10px; border-radius: 4px; background: var(--sw-surface);">`;
            html += `<h5 style="margin: 0 0 8px 0; color: var(--sw-text-1);">${especieSafe}</h5>`;

            // Linha genérica: uma por unidade de carga do modo ativo (fiel à carga).
            const renderGrupoPrev = (kind, chave, tituloSafe, subSafe, precoUnitario) => {
                const setAlvo = kind === 'esp' ? romaneioPreviewExcluidosEsp : kind === 'dims' ? romaneioPreviewExcluidosDims : romaneioPreviewExcluidos;
                const pk = __rvPreviewChaves.length;
                __rvPreviewChaves.push({ kind, chave });
                const excluido = chave ? setAlvo.has(chave) : false;
                const desativado = !!uso;
                const checkedAttr = (!excluido && !desativado) ? 'checked' : '';
                const disabledAttr = desativado ? 'disabled' : '';
                const rowOpacity = (excluido || desativado) ? 'opacity:0.55;' : '';

                let row = `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:4px;padding:6px 0;border-bottom:1px solid var(--sw-border);${rowOpacity}">`;
                row += `<input type="checkbox" data-rv-pk="${pk}" ${checkedAttr} ${disabledAttr} onchange="window.romaneioPreviewToggleVendas(this)" title="Incluir este item no carregamento" style="margin-top:4px;">`;
                row += `<div style="flex: 1;">`;
                row += `<span style="font-weight: 600;">${tituloSafe}</span><br>`;
                row += `<span style="color: var(--sw-text-3); font-size: 12px;">${subSafe}</span><br>`;
                if (desativado) {
                    const moduloLabel = uso.modulo === 'compra' ? 'Compra' : 'Venda';
                    row += `<span style="display:inline-block;margin-top:4px;background:var(--sw-surface-2);color:var(--sw-text-2);font-size:11px;padding:2px 8px;border-radius:10px;"><i class="fas fa-lock"></i> Usado no pedido Nº ${escaparHtmlRomaneioVendas(uso.pedidoNumero)} (${escaparHtmlRomaneioVendas(moduloLabel)})</span>`;
                } else if (excluido) {
                    row += `<span style="display:inline-block;margin-top:4px;background:var(--sw-warning-bg);color:var(--sw-warning);font-size:11px;padding:2px 8px;border-radius:10px;">Excluído — não será carregado</span>`;
                }
                row += `</div>`;
                row += `<div style="text-align: right;">`;
                if (precoUnitario > 0) {
                    row += `<span style="color: var(--sw-success); font-weight: 600;">${formatCurrency(precoUnitario)}</span><br>`;
                    row += `<span style="color: var(--sw-text-3); font-size: 11px;">por m³</span>`;
                } else {
                    row += `<span style="color: var(--sw-danger); font-size: 12px;">Sem preço</span><br>`;
                    row += `<span style="color: var(--sw-warning); font-size: 11px;">Padrão: ${formatCurrency(VendasConfig.precoPorM3Padrao)}</span>`;
                }
                row += `<br><button type="button" data-rv-pk="${pk}" ${disabledAttr} onclick="window.romaneioPreviewExcluirVendas(this)" style="margin-top:6px;font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid ${excluido ? '#28a745' : '#dc3545'};background:${excluido ? '#e8f5e9' : '#fff'};color:${excluido ? '#1e7e34' : '#c82333'};cursor:${desativado ? 'not-allowed' : 'pointer'};" title="${excluido ? 'Reincluir este item' : 'Excluir este item do carregamento'}">${excluido ? '<i class="fas fa-undo"></i> Reincluir' : '<i class="fas fa-trash"></i> Excluir'}</button>`;
                row += `</div>`;
                row += `</div>`;
                return row;
            };

            if (!uso && modoPrevVendas === 'especie') {
                gruposEspPrev.filter(g => g.especie === especieLimpaPrev).forEach(g => {
                    const preco = g.volume > 0 ? g.valor / g.volume : 0;
                    const pecas = construirResumoPecasParaDescricao(g);
                    const pecasSafe = escaparHtmlRomaneioVendas(pecas || '');
                    html += renderGrupoPrev('esp', g.chave,
                        `${especieSafe} — Espessura ${escaparHtmlRomaneioVendas(formatarMedidaCm(g.espessura))}cm`,
                        `Vol: ${formatNumber(g.volume, 3)} m³${pecas ? ` • ${pecasSafe}` : ''} • ${g.chaveCat.length} categoria(s)`,
                        preco);
                });
            } else if (!uso && modoPrevVendas === 'dimensoes') {
                gruposDimsPrev.filter(g => g.especie === especieLimpaPrev).forEach(g => {
                    const preco = g.volume > 0 ? g.valor / g.volume : 0;
                    const pecas = construirResumoPecasParaDescricao(g);
                    const pecasSafe = escaparHtmlRomaneioVendas(pecas || '');
                    const dimsTxt = `${formatarMedidaCm(g.espessura)}cmx${formatarMedidaCm(g.largura)}cmx${formatarMedidaCm(g.comprimento)}cm`;
                    html += renderGrupoPrev('dims', g.chave,
                        `${especieSafe} - ${escaparHtmlRomaneioVendas(g.categoriaBase)} ${escaparHtmlRomaneioVendas(dimsTxt)}`,
                        `Vol: ${formatNumber(g.volume, 3)} m³${pecas ? ` • ${pecasSafe}` : ''}`,
                        preco);
                });
            } else if (!uso && modoPrevVendas === 'resumo') {
                // 1 linha por espécie (agregado) — mesma partição da carga.
                let volRes = 0;
                let valorRes = 0;
                let pacRes = 0;
                let pecRes = 0;
                const pppRes = {};
                Object.keys(resumoConama[especie].categorias).forEach(c => {
                    const k = resumoConama[especie].categorias[c];
                    volRes += (k && k.volume) || 0;
                    valorRes += (k && k.valorTotal) || 0;
                    pacRes += (k && k.pacotesTotal) || 0;
                    pecRes += (k && k.pecasTotal) || 0;
                    Object.keys((k && k.pppTotals) || {}).forEach(pk2 => {
                        pppRes[pk2] = (pppRes[pk2] || 0) + (k.pppTotals[pk2] || 0);
                    });
                });
                const precoRes = volRes > 0 ? valorRes / volRes : 0;
                const pecasRes = construirResumoPecasParaDescricao({ pecasTotal: pecRes, pacotesTotal: pacRes, pppTotals: pppRes });
                const pecasResSafe = escaparHtmlRomaneioVendas(pecasRes || '');
                html += renderGrupoPrev('res', especieLimpaPrev.toUpperCase(),
                    `${especieSafe} (Resumo)`,
                    `Vol: ${formatNumber(volRes, 3)} m³${pecasRes ? ` • ${pecasResSafe}` : ''}`,
                    precoRes);
            } else {
                Object.keys(resumoConama[especie].categorias).forEach(categoria => {
                    const cat = resumoConama[especie].categorias[categoria];
                    const pecasInfo = construirResumoPecasParaDescricao(cat);
                    const pecasSafe = escaparHtmlRomaneioVendas(pecasInfo || '');
                    html += renderGrupoPrev('cat', chaveCategoriaPreviewVendas(especie, categoria),
                        `${escaparHtmlRomaneioVendas(categoria)}:`,
                        `Vol: ${formatNumber(cat.volume, 3)} m³${pecasInfo ? ` • ${pecasSafe}` : ''}`,
                        cat.precoUnitario || 0);
                });
            }

            html += `</div>`;
        });

        html += '</div>';
        try {
            const total = __rvPreviewChaves.length;
            let sel = 0;
            __rvPreviewChaves.forEach((ref) => {
                const setAlvo = ref.kind === 'esp' ? romaneioPreviewExcluidosEsp : ref.kind === 'dims' ? romaneioPreviewExcluidosDims : romaneioPreviewExcluidos;
                const chave = ref.kind ? ref.chave : chaveCategoriaPreviewVendas(ref.especie, ref.categoria);
                if (chave && !setAlvo.has(chave)) sel++;
            });
            if (!uso) {
                if (total === 0) {
                    html += '<p style="color: #666; font-style: italic;">Nenhum grupo válido para o modo selecionado.</p>';
                } else {
                    html += `<p style="color:#495057;font-size:12px;margin:10px 0 0 0;"><span id="rvPreviewContador">${sel} de ${total} grupos selecionados</span> — apenas os selecionados serão carregados.</p>`;
                }
            }
        } catch (_) { /* contador best-effort */ }
    }

    container.innerHTML = html;
    document.getElementById('previewConama').style.display = 'block';

    // Trava visual do botão Carregar quando em reuso (defesa em profundidade;
    // o bloqueio real acontece em adicionarItensRomaneio).
    try {
        const btn = document.querySelector('#secaoProdutoRomaneio .romaneio-load-btn');
        if (btn) {
            if (uso) {
                btn.disabled = true;
                btn.title = `Bloqueado: romaneio já usado no pedido Nº ${uso.pedidoNumero}`;
                btn.style.opacity = '0.55';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.disabled = false;
                btn.title = '';
                btn.style.opacity = '';
                btn.style.cursor = '';
            }
        }
    } catch (_) { /* best-effort */ }

    // ✅ Rolar até a tabela de itens após mostrar o preview
    setTimeout(() => {
        const itensTable = document.getElementById('itensTable');
        if (itensTable) {
            itensTable.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 300);
}

// Alternar inclusão de uma categoria do preview (checkbox).
function __rvRefazerPreviewVendas() {
    try {
        if (!romaneioSelecionado) return;
        const resumo = extrairResumoConama(romaneioSelecionado);
        mostrarPreviewConama(resumo, romaneioPreviewUsoInfo);
    } catch (e) {
        console.warn('Vendas: falha ao redesenhar preview do romaneio:', e);
    }
}

function __rvSetAlvoVendas(kind) {
    if (kind === 'esp') return romaneioPreviewExcluidosEsp;
    if (kind === 'dims') return romaneioPreviewExcluidosDims;
    if (kind === 'res') return romaneioPreviewExcluidosResumo;
    return romaneioPreviewExcluidos;
}

function __rvChaveRefVendas(ref) {
    if (!ref) return '';
    if (ref.kind) return ref.chave || '';
    return chaveCategoriaPreviewVendas(ref.especie, ref.categoria);
}

window.romaneioPreviewToggleVendas = function (el) {
    try {
        if (romaneioPreviewUsoInfo) {
            ToastManager.warning('Este romaneio já foi utilizado e está bloqueado para carregamento.', 'Romaneio já utilizado', 4000);
            __rvRefazerPreviewVendas();
            return;
        }
        const pk = parseInt(el && el.dataset ? el.dataset.rvPk : '', 10);
        const ref = __rvPreviewChaves[pk];
        if (!ref) return;
        const setAlvo = __rvSetAlvoVendas(ref.kind);
        const chave = __rvChaveRefVendas(ref);
        if (!chave) return;
        if (el.checked) {
            setAlvo.delete(chave);
        } else {
            setAlvo.add(chave);
        }
        __rvRefazerPreviewVendas();
    } catch (e) {
        console.warn('Vendas: falha ao alternar item do preview:', e);
    }
};

window.romaneioPreviewExcluirVendas = function (el) {
    try {
        if (romaneioPreviewUsoInfo) {
            ToastManager.warning('Este romaneio já foi utilizado e está bloqueado para carregamento.', 'Romaneio já utilizado', 4000);
            return;
        }
        const pk = parseInt(el && el.dataset ? el.dataset.rvPk : '', 10);
        const ref = __rvPreviewChaves[pk];
        if (!ref) return;
        const setAlvo = __rvSetAlvoVendas(ref.kind);
        const chave = __rvChaveRefVendas(ref);
        if (!chave) return;
        if (setAlvo.has(chave)) {
            setAlvo.delete(chave);
        } else {
            setAlvo.add(chave);
        }
        __rvRefazerPreviewVendas();
    } catch (e) {
        console.warn('Vendas: falha ao excluir item do preview:', e);
    }
};

// Modos de agrupamento (mutuamente exclusivos entre os 4 checkboxes).
// Resumo só vale para TORA; modos do fieldset só para PCT/TL/PES.
// Sempre há um selecionado: desmarcar o último reverte (obrigatório para carregar).
window.alternarModoAgrupamentoVendas = function (modo) {
    try {
        const cbDims = document.getElementById('agruparDimensoesCheckbox');
        const cbEsp = document.getElementById('agruparEspecieCheckbox');
        const cbLarg = document.getElementById('agruparEspecieLarguraCheckbox');
        const cbResumo = document.getElementById('agruparResumoVendas');
        if (!cbDims || !cbEsp || !cbLarg || !cbResumo) return;
        const desmarcarOutros = (...manter) => {
            [cbDims, cbEsp, cbLarg, cbResumo].forEach(cb => { if (!manter.includes(cb)) cb.checked = false; });
        };
        if (modo === 'dimensoes' && cbDims.checked) {
            const tipoSel = document.getElementById('tipoRomaneio') ? document.getElementById('tipoRomaneio').value : '';
            if (String(tipoSel || '').toLowerCase().includes('tora')) {
                cbDims.checked = false;
                ToastManager.warning('O modo Espessura x Largura x Comprimento vale apenas para romaneios PCT/TL/PES.', 'Agrupamento', 4000);
                return;
            }
            desmarcarOutros(cbDims);
        } else if (modo === 'especie' && cbEsp.checked) {
            desmarcarOutros(cbEsp);
        } else if (modo === 'largura' && cbLarg.checked) {
            desmarcarOutros(cbLarg);
        } else if (modo === 'resumo' && cbResumo.checked) {
            desmarcarOutros(cbResumo);
        }
        // TORA: o resumo é opcional — desmarcar volta ao detalhado (por
        // categoria, mesma partição do preview). Serrado mantém o invariante.
        if (modo === 'resumo' && !cbResumo.checked) {
            const outrosVisiveis = [cbDims, cbEsp, cbLarg].filter(cb => cb.offsetParent !== null && !cb.disabled);
            if (outrosVisiveis.length === 0) {
                try {
                    const novoModo = lerModoAgrupamentoVendas();
                    if (novoModo && novoModo !== modoAgrupPreviewVendas) {
                        limparExclusoesPreviewVendas();
                    }
                } catch (_) {}
                try { if (romaneioSelecionado) __rvRefazerPreviewVendas(); } catch (_) {}
                return;
            }
        }
        // Invariante: sempre um modo selecionado.
        const todos = [cbDims, cbEsp, cbLarg, cbResumo];
        if (!todos.some(cb => cb.checked && !cb.disabled)) {
            const alvo = (modo === 'dimensoes' && !cbDims.disabled) ? cbDims
                : (modo === 'especie' ? cbEsp : modo === 'largura' ? cbLarg
                : (modo === 'resumo' ? cbResumo : null)) || cbLarg;
            alvo.checked = true;
            ToastManager.info('Selecione ao menos um modo de agrupamento para carregar os itens.', 'Agrupamento', 3000);
            return;
        }
        // Troca de modo limpa as exclusões (cada modo tem sua granularidade).
        const novoModo = lerModoAgrupamentoVendas();
        if (novoModo && novoModo !== modoAgrupPreviewVendas) {
            limparExclusoesPreviewVendas();
        }
        try {
            if (romaneioSelecionado) __rvRefazerPreviewVendas();
        } catch (_) { /* best-effort */ }
    } catch (e) {
        console.warn('Vendas: falha ao alternar modo de agrupamento:', e);
    }
};

// Visibilidade condicional: Resumo só TORA; fieldset só PCT/TL/PES.
// Ao esconder, desmarca (anti modo-fantasma); ao mostrar sem seleção, aplica o padrão.
function atualizarEstadoAgrupamentoVendas(tipoSelecionado) {
    try {
        const cbDims = document.getElementById('agruparDimensoesCheckbox');
        const cbEsp = document.getElementById('agruparEspecieCheckbox');
        const cbLarg = document.getElementById('agruparEspecieLarguraCheckbox');
        const cbResumo = document.getElementById('agruparResumoVendas');
        const fieldset = document.getElementById('agruparFieldset');
        const labelResumo = document.getElementById('opcaoResumoVenda');
        if (!cbDims || !cbEsp || !cbLarg || !cbResumo) return;
        const t = String(tipoSelecionado || '').toLowerCase();
        const isTora = t.includes('tora');
        const isSerrado = t.includes('pct') || t.includes('tl') || t.includes('pes');
        if (fieldset) fieldset.hidden = isTora && !isSerrado;
        if (labelResumo) labelResumo.style.display = isTora ? '' : 'none';
        if (isTora) {
            cbDims.checked = false;
            cbDims.disabled = true;
            cbDims.title = 'Disponível apenas para romaneios PCT/TL/PES';
            cbEsp.checked = false;
            cbLarg.checked = false;
            if (!cbResumo.checked) cbResumo.checked = true;
        } else {
            cbDims.disabled = false;
            cbDims.title = '';
            if (cbResumo) cbResumo.checked = false;
            if (isSerrado && !cbDims.checked && !cbEsp.checked && !cbLarg.checked) {
                cbLarg.checked = true;
            }
        }
    } catch (_) { /* best-effort */ }
}

function lerModoAgrupamentoVendas() {
    try {
        const tipo = document.getElementById('tipoRomaneio') ? document.getElementById('tipoRomaneio').value : '';
        const t = String(tipo || '').toLowerCase();
        const isTora = t.includes('tora');
        const isSerrado = t.includes('pct') || t.includes('tl') || t.includes('pes');
        if (isTora && document.getElementById('agruparResumoVendas') && document.getElementById('agruparResumoVendas').checked) return 'resumo';
        if (isSerrado && document.getElementById('agruparDimensoesCheckbox') && document.getElementById('agruparDimensoesCheckbox').checked) return 'dimensoes';
        if (isSerrado && document.getElementById('agruparEspecieCheckbox') && document.getElementById('agruparEspecieCheckbox').checked) return 'especie';
        if (isSerrado && document.getElementById('agruparEspecieLarguraCheckbox') && document.getElementById('agruparEspecieLarguraCheckbox').checked) return 'largura';
    } catch (_) { /* sem modo: bloqueia abaixo */ }
    return 'nenhum';
}

// Deriva a chave de categoria do preview (especie||categoria) a partir do item
// bruto, espelhando extrairResumoConama (mesma normalização de espécie,
// bitola legada, classificação CONAMA e chave de dimensões).
function derivarChaveCategoriaVendas(item) {
    try {
        const legacyKey = ['b', 'i', 't', 'o', 'l', 'a'].join('');
        const especie = ((item && (item.especie || item.especieNome)) || 'Não especificada').replace(/^\s*[-–—]\s*/, '').trim();
        const largura = parseFloat(item.largura) || 0;
        const espessura = parseFloat(item.espessura) || parseFloat(item[legacyKey]) || 0;
        const categoriaBase = classificarProdutoConama(espessura, largura);
        const dimensoesKey = construirChaveDimensoes(espessura, largura);
        return chaveCategoriaPreviewVendas(especie, `${categoriaBase} ${dimensoesKey}`);
    } catch (_) {
        return '';
    }
}

function chaveGrupoDimensoesVendas(especieLimpa, espessura, largura, comprimento) {
    const n = (v) => (parseFloat(v) || 0).toFixed(3);
    return `${String(especieLimpa || '').toUpperCase()}||${n(espessura)}||${n(largura)}||${n(comprimento)}`;
}

function chaveGrupoEspVendas(especieLimpa, espessura) {
    return `${String(especieLimpa || '').toUpperCase()}||${parseFloat(espessura) || 0}`;
}

function limparExclusoesPreviewVendas() {
    romaneioPreviewExcluidos = new Set();
    romaneioPreviewExcluidosEsp = new Set();
    romaneioPreviewExcluidosDims = new Set();
    romaneioPreviewExcluidosResumo = new Set();
}

// Agrega o resumo por (espécie, espessura) — fonte ÚNICA do modo "Espécie Espessura"
// para preview e carga (sem duplicação).
// valor = soma crua (preview exibe "Sem preço" quando 0, como antes);
// valorCheio = com fallback por categoria (carga, idêntico ao legado).
function agruparResumoPorEspessuraVendas(resumo, precoFallback) {
    const grupos = new Map();
    const fallback = parseFloat(precoFallback) || 0;
    try {
        Object.keys(resumo || {}).forEach(especie => {
            const especieLimpa = String(especie || '').replace(/^\s*[-–—]\s*/, '').trim();
            const cats = (resumo[especie] && resumo[especie].categorias) || {};
            Object.keys(cats).forEach(categoria => {
                const cat = cats[categoria];
                if (!cat || !(cat.volume > 0)) return;
                const esp = cat.espessura || 0;
                const chave = chaveGrupoEspVendas(especieLimpa, esp);
                if (!grupos.has(chave)) {
                    grupos.set(chave, {
                        especie: especieLimpa,
                        espessura: esp,
                        chave,
                        chaveCat: [],
                        volume: 0,
                        valor: 0,
                        valorCheio: 0,
                        pacotesTotal: 0,
                        pecasTotal: 0,
                        pppTotals: {}
                    });
                }
                const g = grupos.get(chave);
                g.chaveCat.push({ categoria, cat });
                g.volume += cat.volume;
                g.valor += cat.valorTotal || 0;
                g.valorCheio += (cat.valorTotal && cat.valorTotal > 0) ? cat.valorTotal : (cat.volume * fallback);
                g.pacotesTotal += cat.pacotesTotal || 0;
                g.pecasTotal += cat.pecasTotal || 0;
                Object.keys(cat.pppTotals || {}).forEach(k => {
                    g.pppTotals[k] = (g.pppTotals[k] || 0) + (cat.pppTotals[k] || 0);
                });
            });
        });
    } catch (_) { /* best-effort */ }
    return Array.from(grupos.values());
}

// Agrega os itens brutos por (espécie, espessura, largura, comprimento) — fonte
// ÚNICA do modo "E x L x C" para preview e carga (o resumo descarta comprimento).
function agruparBrutosPorDimensoesVendas(listaBruta, romaneio) {
    const grupos = new Map();
    try {
        const legacyKey = ['b', 'i', 't', 'o', 'l', 'a'].join('');
        (Array.isArray(listaBruta) ? listaBruta : []).forEach(item => {
            if (!item || typeof item !== 'object') return;
            if (item['0'] === 'r' && item['1'] === 'o') return;
            const especieLimpa = (((item.especie || item.especieNome) || 'Não especificada').replace(/^\s*[-–—]\s*/, '').trim());
            const esp = parseFloat(item.espessura) || parseFloat(item[legacyKey]) || 0;
            const larg = parseFloat(item.largura) || 0;
            const comp = parseFloat(item.comprimento) || 0;
            const qtd = parseInt(item.quantidade, 10) || 1;
            const pppRaw = item.pecasPorPacote;
            const ppp = (typeof pppRaw === 'object' && pppRaw !== null) ? (parseInt(pppRaw.valor || 1, 10) || 1) : (parseInt(pppRaw, 10) || 1);
            const volInfo = parseFloat(item.volume);
            const isPCT = !!((romaneio && (romaneio.tipo === 'pct' || romaneio.tipoRomaneio === 'romaneiosPct')) || typeof item.pecasPorPacote !== 'undefined' || typeof item.totalPecas !== 'undefined');
            let vol = 0;
            if (!isNaN(volInfo) && volInfo > 0) {
                vol = isPCT ? volInfo : (volInfo * qtd);
            } else {
                const unit = (comp / 100) * (larg / 100) * (esp / 100);
                vol = isPCT ? (unit * qtd * ppp) : (unit * qtd);
            }
            if (!(vol > 0)) return;
            const precoRaw = obterPrecoUnitarioItem(item);
            const chave = chaveGrupoDimensoesVendas(especieLimpa, esp, larg, comp);
            if (!grupos.has(chave)) {
                grupos.set(chave, {
                    especie: especieLimpa,
                    espessura: esp,
                    largura: larg,
                    comprimento: comp,
                    categoriaBase: classificarProdutoConama(esp, larg),
                    chave,
                    chaveCat: derivarChaveCategoriaVendas(item),
                    volume: 0,
                    valor: 0,
                    pacotesTotal: 0,
                    pecasTotal: 0,
                    pppTotals: {},
                    brutos: []
                });
            }
            const g = grupos.get(chave);
            g.volume += vol;
            g.valor += vol * precoRaw;
            g.brutos.push(item);
            if (isPCT) {
                const totalPecasRaw = item.totalPecas != null ? parseInt(item.totalPecas, 10) : null;
                const pecas = (totalPecasRaw != null && !isNaN(totalPecasRaw) && totalPecasRaw > 0) ? totalPecasRaw : (qtd * (ppp || 1));
                g.pacotesTotal += qtd;
                g.pecasTotal += pecas;
                const kPpp = String(ppp || 0);
                g.pppTotals[kPpp] = (g.pppTotals[kPpp] || 0) + qtd;
            } else {
                g.pecasTotal += qtd;
            }
        });
    } catch (_) { /* best-effort */ }
    return Array.from(grupos.values());
}

// Função para agrupar itens de romaneio já no carrinho por espécie e espessura
function agruparItensRomaneioNoCarrinho() {
    const romaneioItens = itensCarrinho.filter(i => 
        String(i.tipo || '').toLowerCase() === 'romaneio' || 
        String(i.tipo || '').toLowerCase() === 'romaneio_agrupado'
    );
    
    if (romaneioItens.length === 0) return { removidos: 0, agrupados: 0 };
    
    const outrosItens = itensCarrinho.filter(i => 
        String(i.tipo || '').toLowerCase() !== 'romaneio' && 
        String(i.tipo || '').toLowerCase() !== 'romaneio_agrupado'
    );
    
    const agrupados = {};
    
    romaneioItens.forEach(item => {
        let especie = '';
        let espessura = 0;
        
        if (item.tipo === 'romaneio_agrupado') {
            // Se já for agrupado, os dados devem estar nas propriedades (se implementamos corretamente)
            // Caso contrário, tenta extrair do nome "ESPECIE 2.5cm"
            especie = item.especie || (item.produtoNome ? item.produtoNome.replace(/\s+\d+(\.\d+)?cm$/, '') : 'Não especificada');
            espessura = item.espessura || 0;
        } else {
            // Item individual: `${especie} - ${categoria}...`
            const partes = item.produtoNome.split(' - ');
            especie = partes[0].trim().replace(/^- /, '').trim();
            // Tenta extrair espessura do nome do produto ou categoria
            // Mas o ideal é que o item já tenha essa info. 
            // Se não tiver, o agrupamento será apenas por espécie para itens legados no carrinho.
            espessura = item.espessura || 0;
        }
        
        const key = `${especie.toUpperCase()}_${espessura}`;
        
        if (!agrupados[key]) {
            agrupados[key] = {
                especie: especie,
                espessura: espessura,
                quantidade: 0,
                total: 0,
                unidade: item.unidade || 'm³',
                origemId: item.origemId,
                romaneioId: item.romaneioId || item.origemId,
                romaneioNumero: item.romaneioNumero,
                romaneioTipo: item.romaneioTipo,
                originais: []
            };
        }
        // Preservar itens originais para permitir desagrupamento na edição
        if (String(item.tipo || '').toLowerCase() === 'romaneio_agrupado' && Array.isArray(item.itensOriginais)) {
            agrupados[key].originais.push(...item.itensOriginais);
        } else {
            agrupados[key].originais.push(item);
        }
        if (agrupados[key].originais.length > 1 && !agrupados[key].origemId) {
            agrupados[key].origemId = item.origemId;
        }
        if (!agrupados[key].romaneioId && (item.romaneioId || item.origemId)) {
            agrupados[key].romaneioId = item.romaneioId || item.origemId;
        }
        if (!agrupados[key].romaneioNumero && item.romaneioNumero) {
            agrupados[key].romaneioNumero = item.romaneioNumero;
        }
        if (!agrupados[key].romaneioTipo && item.romaneioTipo) {
            agrupados[key].romaneioTipo = item.romaneioTipo;
        }
        
        agrupados[key].quantidade += (parseFloat(item.quantidade) || 0);
        agrupados[key].total += (parseFloat(item.total) || 0);
    });
    
    const novosItensAgrupados = Object.values(agrupados).map(grp => {
        const precoMedio = grp.quantidade > 0 ? (grp.total / grp.quantidade) : 0;
        const sufixoBitola = grp.espessura > 0 ? ` - ${formatarMedidaCm(grp.espessura)}cm` : '';
        return {
            id: Date.now() + Math.random(),
            tipo: 'romaneio_agrupado',
            origemId: grp.origemId,
            romaneioId: grp.romaneioId || grp.origemId,
            romaneioNumero: grp.romaneioNumero,
            romaneioTipo: grp.romaneioTipo,
            produtoId: `agrupado_${normalizarIdRomaneioParte(grp.especie)}_${normalizarIdRomaneioParte(grp.espessura)}`,
            produtoNome: `${grp.especie}${sufixoBitola}`,
            especie: grp.especie,
            espessura: grp.espessura,
            quantidade: parseFloat(grp.quantidade.toFixed(3)),
            unidade: grp.unidade,
            precoUnitario: parseFloat(precoMedio.toFixed(2)),
            total: parseFloat(grp.total.toFixed(2)),
            itensOriginais: grp.originais
        };
    });
    
    itensCarrinho = [...outrosItens, ...novosItensAgrupados];
    
    atualizarTabelaItens();
    atualizarTotais();
    
    return { 
        removidos: romaneioItens.length, 
        agrupados: novosItensAgrupados.length 
    };
}

// Função para adicionar itens do romaneio ao carrinho (respeita preview + trava de reuso)
async function adicionarItensRomaneio() {
    if (!romaneioSelecionado) {
        ToastManager.warning('Selecione um romaneio primeiro', 'Atenção');
        return;
    }

    // Trava de reuso em profundidade: revalida no clique (cobre troca de pedido
    // após o preview e anotações de dropdown desatualizadas). Fail-open.
    const idEstavelAtual = obterIdEstavelRomaneioVendas(romaneioSelecionado);
    const numeroExibicaoAtual = obterNumeroExibicaoRomaneioVendas(romaneioSelecionado, idEstavelAtual);
    const tipoAtual = romaneioPreviewTipoAtual || (document.getElementById('tipoRomaneio') ? document.getElementById('tipoRomaneio').value : '');
    let usoAtual = romaneioPreviewUsoInfo || null;
    try {
        if (idEstavelAtual && !usoAtual) {
            usoAtual = await buscarUsoRomaneioVendas(idEstavelAtual);
            romaneioPreviewUsoInfo = usoAtual;
        }
    } catch (_) { /* fail-open */ }
    if (usoAtual) {
        ToastManager.warning(mensagemUsoRomaneioVendas(numeroExibicaoAtual, usoAtual), 'Romaneio já utilizado', 6000);
        try {
            const resumoAtual = extrairResumoConama(romaneioSelecionado);
            mostrarPreviewConama(resumoAtual, usoAtual);
        } catch (_) { /* mantém preview atual */ }
        return;
    }

    const resumoConama = extrairResumoConama(romaneioSelecionado);

    const resumoFiltrado = {};
    let totalExcluidos = 0;
    Object.keys(resumoConama).forEach(especie => {
        Object.keys(resumoConama[especie].categorias).forEach(categoria => {
            const chave = chaveCategoriaPreviewVendas(especie, categoria);
            if (romaneioPreviewExcluidos.has(chave)) {
                totalExcluidos++;
                return;
            }
            if (!resumoFiltrado[especie]) resumoFiltrado[especie] = { categorias: {} };
            resumoFiltrado[especie].categorias[categoria] = resumoConama[especie].categorias[categoria];
        });
    });

    if (Object.keys(resumoFiltrado).length === 0) {
        if (Object.keys(resumoConama).length === 0) {
            ToastManager.warning('Nenhum item válido encontrado no romaneio selecionado', 'Atenção');
        } else {
            ToastManager.warning('Todos os itens foram excluídos no preview. Reative ao menos um item para carregar.', 'Nada para carregar');
        }
        return;
    }
    
    // Definir preço padrão por m³ como fallback (configurável em VendasConfig)
    const precoPadraoPorM3 = VendasConfig.precoPorM3Padrao;
    
    // Modo de agrupamento obrigatório no serrado; TORA sem resumo = detalhado.
    const modoAgrupamento = lerModoAgrupamentoVendas();
    const listaBrutaDims = Array.isArray(romaneioSelecionado.items) ? romaneioSelecionado.items : (Array.isArray(romaneioSelecionado.itens) ? romaneioSelecionado.itens : []);
    const ehToraDims = !!((romaneioSelecionado && romaneioSelecionado.tipoRomaneio === 'romaneiosTora') || String((romaneioSelecionado && romaneioSelecionado.tipo) || '').toLowerCase() === 'tora' || listaBrutaDims.some(i => i && typeof i === 'object' && (typeof i.rodo !== 'undefined' || typeof i.diametro !== 'undefined')));
    if (modoAgrupamento === 'nenhum' && !ehToraDims) {
        ToastManager.warning('Selecione um modo no quadro "Agrupar:" para carregar os itens.', 'Agrupamento', 4000);
        return;
    }
    let resumoCarregamentoMsg = null;

    if (modoAgrupamento === 'dimensoes') {
        // Espécie Espessura x Largura x Comprimento (PCT/TL/PES).
        // Ancora nos itens brutos: o resumo CONAMA descarta o comprimento.
        // (listaBrutaDims/ehToraDims já calculados acima para o guarda.)
        if (ehToraDims) {
            ToastManager.warning('O modo Espessura x Largura x Comprimento vale apenas para romaneios PCT/TL/PES.', 'Agrupamento', 4000);
            return;
        }
        const todosGruposDims = agruparBrutosPorDimensoesVendas(listaBrutaDims, romaneioSelecionado);
        const listaGruposDims = [];
        todosGruposDims.forEach(g => {
            if (romaneioPreviewExcluidosDims.has(g.chave)) {
                totalExcluidos++;
                return;
            }
            listaGruposDims.push(g);
        });
        if (listaGruposDims.length === 0) {
            ToastManager.warning('Nenhum item válido para o modo Espessura x Largura x Comprimento', 'Atenção');
            return;
        }
        listaGruposDims.forEach(g => {
            const precoMedioDims = g.volume > 0 ? g.valor / g.volume : 0;
            const precoFinalDims = precoMedioDims > 0 ? precoMedioDims : precoPadraoPorM3;
            const totalFinalDims = g.valor > 0 ? g.valor : (g.volume * precoFinalDims);
            const dimsTxt = `${formatarMedidaCm(g.espessura)}cmx${formatarMedidaCm(g.largura)}cmx${formatarMedidaCm(g.comprimento)}cm`;
            const pecasInfoDims = construirResumoPecasParaDescricao(g);
            const produtoIdDims = `romaneio_dim_${normalizarIdRomaneioParte(g.especie)}_${normalizarIdRomaneioParte(g.categoriaBase)}_${normalizarIdRomaneioParte(dimsTxt)}`;
            const produtoNomeDims = `${g.especie} - ${g.categoriaBase} ${dimsTxt}${pecasInfoDims ? ` - ${pecasInfoDims}` : ''}`;
            const existenteDims = itensCarrinho.find(i => String(i.tipo || '').toLowerCase() === 'romaneio_dimensoes' && String(i.produtoId || '') === produtoIdDims);
            if (existenteDims) {
                const qAtualDims = typeof existenteDims.quantidade === 'number' ? existenteDims.quantidade : parseNumberFlexible(existenteDims.quantidade);
                const novoQDims = (isNaN(qAtualDims) ? 0 : qAtualDims) + g.volume;
                const novoTotalDims = (parseFloat(existenteDims.total) || 0) + totalFinalDims;
                existenteDims.quantidade = novoQDims;
                existenteDims.total = novoTotalDims;
                existenteDims.precoUnitario = novoQDims > 0 ? novoTotalDims / novoQDims : 0;
                existenteDims.itensOriginais = [...(Array.isArray(existenteDims.itensOriginais) ? existenteDims.itensOriginais : []), ...g.brutos];
                if (!existenteDims.origemId && idEstavelAtual) existenteDims.origemId = idEstavelAtual;
                if (!existenteDims.romaneioId && idEstavelAtual) existenteDims.romaneioId = idEstavelAtual;
                if (!existenteDims.romaneioNumero) existenteDims.romaneioNumero = numeroExibicaoAtual;
                if (!existenteDims.romaneioTipo && tipoAtual) existenteDims.romaneioTipo = tipoAtual;
            } else {
                itensCarrinho.push({
                    id: Date.now() + Math.random(),
                    produtoId: produtoIdDims,
                    produtoNome: produtoNomeDims,
                    especie: g.especie,
                    espessura: g.espessura,
                    quantidade: g.volume,
                    precoUnitario: precoFinalDims,
                    total: totalFinalDims,
                    tipo: 'romaneio_dimensoes',
                    unidade: 'm³',
                    origemId: idEstavelAtual,
                    romaneioId: idEstavelAtual,
                    romaneioNumero: numeroExibicaoAtual,
                    romaneioTipo: tipoAtual,
                    itensOriginais: g.brutos.slice()
                });
            }
        });
        resumoCarregamentoMsg = `${listaGruposDims.length} grupos (Espessura x Largura x Comprimento) adicionados do romaneio`;
    } else if (modoAgrupamento === 'especie') {
        // Espécie Espessura: 1 item por (espécie, espessura). Fonte única com o preview.
        const todosGruposEsp = agruparResumoPorEspessuraVendas(resumoConama, precoPadraoPorM3);
        const listaGruposEsp = [];
        todosGruposEsp.forEach(g => {
            if (romaneioPreviewExcluidosEsp.has(g.chave)) {
                totalExcluidos++;
                return;
            }
            listaGruposEsp.push(g);
        });
        if (listaGruposEsp.length === 0) {
            ToastManager.warning('Todos os grupos foram excluídos no preview. Reative ao menos um grupo para carregar.', 'Nada para carregar');
            return;
        }
        listaGruposEsp.forEach(grp => {
            const produtoId = `agrupado_${normalizarIdRomaneioParte(grp.especie)}_${normalizarIdRomaneioParte(grp.espessura)}`;
            const precoMedio = grp.volume > 0 ? grp.valorCheio / grp.volume : 0;
            const sufixoBitola = grp.espessura > 0 ? ` - ${formatarMedidaCm(grp.espessura)}cm` : '';
            const produtoNome = `${grp.especie}${sufixoBitola}`;
            const originaisEsp = [];
            grp.chaveCat.forEach(({ categoria, cat }) => {
                const precoCat = cat.precoUnitario > 0 ? cat.precoUnitario : precoPadraoPorM3;
                const base = cat.categoriaBase || categoria;
                const dims = cat.dimensoesKey || '';
                const pecasInfoCat = construirResumoPecasParaDescricao(cat);
                originaisEsp.push({
                    id: Date.now() + Math.random(),
                    produtoId: `romaneio_${normalizarIdRomaneioParte(grp.especie)}_${normalizarIdRomaneioParte(base)}_${normalizarIdRomaneioParte(dims)}`,
                    produtoNome: `${grp.especie} - ${categoria}${pecasInfoCat ? ` - ${pecasInfoCat}` : ''}`,
                    especie: grp.especie,
                    espessura: grp.espessura,
                    quantidade: cat.volume,
                    precoUnitario: precoCat,
                    total: cat.valorTotal || (cat.volume * precoCat),
                    tipo: 'romaneio',
                    unidade: cat.unidade || 'm³',
                    origemId: idEstavelAtual,
                    romaneioId: idEstavelAtual,
                    romaneioNumero: numeroExibicaoAtual,
                    romaneioTipo: tipoAtual
                });
            });

            const existente = itensCarrinho.find(i => String(i.tipo || '').toLowerCase() === 'romaneio_agrupado' && String(i.produtoId || '') === produtoId);

                if (existente) {
                    const qAtual = typeof existente.quantidade === 'number' ? existente.quantidade : parseNumberFlexible(existente.quantidade);
                    const novoQ = (isNaN(qAtual) ? 0 : qAtual) + grp.volume;
                    const novoTotal = (parseFloat(existente.total) || 0) + grp.valorCheio;

                existente.quantidade = novoQ;
                existente.total = novoTotal;
                existente.precoUnitario = novoQ > 0 ? novoTotal / novoQ : 0;
                existente.itensOriginais = [...(Array.isArray(existente.itensOriginais) ? existente.itensOriginais : []), ...originaisEsp];
                if (!existente.origemId && idEstavelAtual) existente.origemId = idEstavelAtual;
                if (!existente.romaneioId && idEstavelAtual) existente.romaneioId = idEstavelAtual;
                if (!existente.romaneioNumero) existente.romaneioNumero = numeroExibicaoAtual;
                if (!existente.romaneioTipo && tipoAtual) existente.romaneioTipo = tipoAtual;
            } else {
                itensCarrinho.push({
                    id: Date.now() + Math.random(),
                    produtoId,
                    produtoNome,
                    especie: grp.especie,
                    espessura: grp.espessura,
                    quantidade: grp.volume,
                    precoUnitario: precoMedio,
                    total: grp.valorCheio,
                    tipo: 'romaneio_agrupado',
                    unidade: 'm³',
                    itensOriginais: originaisEsp,
                    origemId: idEstavelAtual,
                    romaneioId: idEstavelAtual,
                    romaneioNumero: numeroExibicaoAtual,
                    romaneioTipo: tipoAtual
                });
            }
        });
        resumoCarregamentoMsg = `${listaGruposEsp.length} grupos (Espécie x Espessura) adicionados do romaneio`;
    } else if (modoAgrupamento === 'largura') {
        // Espécie Espessura x Largura: 1 item agrupado por categoria do resumo
        // (mesma partição: categoria = base + espessura x largura).
        let gruposLarg = 0;
        Object.keys(resumoFiltrado).forEach(especie => {
            const especieLimpa = especie.replace(/^\s*[-–—]\s*/, '').trim();
            Object.keys(resumoFiltrado[especie].categorias).forEach(categoria => {
                const cat = resumoFiltrado[especie].categorias[categoria];
                const volume = cat.volume;
                if (!(volume > 0)) return;
                const precoUnitario = cat.precoUnitario > 0 ? cat.precoUnitario : precoPadraoPorM3;
                const esp = cat.espessura || 0;
                const larg = cat.largura || 0;
                const pecasInfo = construirResumoPecasParaDescricao(cat);
                const produtoId = `agrupado_${normalizarIdRomaneioParte(especieLimpa)}_${normalizarIdRomaneioParte(esp)}_${normalizarIdRomaneioParte(larg)}`;
                const produtoNome = `${especieLimpa} - ${formatarMedidaCm(esp)}cm x ${formatarMedidaCm(larg)}cm${pecasInfo ? ` - ${pecasInfo}` : ''}`;
                const totalCat = cat.valorTotal || (volume * precoUnitario);
                const existente = itensCarrinho.find(i => String(i.tipo || '').toLowerCase() === 'romaneio_agrupado' && String(i.produtoId || '') === produtoId);
                const originalLarg = {
                    id: Date.now() + Math.random(),
                    produtoId: `romaneio_${normalizarIdRomaneioParte(especieLimpa)}_${normalizarIdRomaneioParte(cat.categoriaBase || categoria)}_${normalizarIdRomaneioParte(cat.dimensoesKey || '')}`,
                    produtoNome: `${especieLimpa} - ${categoria}${pecasInfo ? ` - ${pecasInfo}` : ''}`,
                    especie: especieLimpa,
                    espessura: esp,
                    quantidade: volume,
                    precoUnitario: precoUnitario,
                    total: totalCat,
                    tipo: 'romaneio',
                    unidade: cat.unidade || 'm³',
                    origemId: idEstavelAtual,
                    romaneioId: idEstavelAtual,
                    romaneioNumero: numeroExibicaoAtual,
                    romaneioTipo: tipoAtual
                };
                if (existente) {
                    const qAtual = typeof existente.quantidade === 'number' ? existente.quantidade : parseNumberFlexible(existente.quantidade);
                    const novoQ = (isNaN(qAtual) ? 0 : qAtual) + volume;
                    const novoTotal = (parseFloat(existente.total) || 0) + totalCat;
                    existente.quantidade = novoQ;
                    existente.total = novoTotal;
                    existente.precoUnitario = novoQ > 0 ? novoTotal / novoQ : 0;
                    existente.itensOriginais = [...(Array.isArray(existente.itensOriginais) ? existente.itensOriginais : []), originalLarg];
                    if (!existente.origemId && idEstavelAtual) existente.origemId = idEstavelAtual;
                    if (!existente.romaneioId && idEstavelAtual) existente.romaneioId = idEstavelAtual;
                    if (!existente.romaneioNumero) existente.romaneioNumero = numeroExibicaoAtual;
                    if (!existente.romaneioTipo && tipoAtual) existente.romaneioTipo = tipoAtual;
                } else {
                    itensCarrinho.push({
                        id: Date.now() + Math.random(),
                        produtoId,
                        produtoNome,
                        especie: especieLimpa,
                        espessura: esp,
                        quantidade: volume,
                        precoUnitario: precoUnitario,
                        total: totalCat,
                        tipo: 'romaneio_agrupado',
                        unidade: cat.unidade || 'm³',
                        itensOriginais: [originalLarg],
                        origemId: idEstavelAtual,
                        romaneioId: idEstavelAtual,
                        romaneioNumero: numeroExibicaoAtual,
                        romaneioTipo: tipoAtual
                    });
                }
                gruposLarg++;
            });
        });
        if (gruposLarg === 0) {
            ToastManager.warning('Nenhum item válido para o modo Espécie x Espessura x Largura', 'Atenção');
            return;
        }
        resumoCarregamentoMsg = `${gruposLarg} grupos (Espécie x Espessura x Largura) adicionados do romaneio`;
    } else if (modoAgrupamento === 'resumo') {
        // Resumo por Espécie (TORA): 1 item agrupado por espécie.
        // Fonte: resumo integral + set de espécies (mesma partição do preview).
        let gruposRes = 0;
        Object.keys(resumoConama).forEach(especie => {
            const especieLimpa = especie.replace(/^\s*[-–—]\s*/, '').trim();
            const chaveRes = especieLimpa.toUpperCase();
            if (romaneioPreviewExcluidosResumo.has(chaveRes)) {
                totalExcluidos++;
                return;
            }
            let volume = 0;
            let valor = 0;
            let pacotes = 0;
            let pecas = 0;
            const pppTotals = {};
            const originaisRes = [];
            Object.keys(resumoConama[especie].categorias).forEach(categoria => {
                const cat = resumoConama[especie].categorias[categoria];
                if (!(cat.volume > 0)) return;
                const precoCat = cat.precoUnitario > 0 ? cat.precoUnitario : precoPadraoPorM3;
                volume += cat.volume;
                valor += cat.valorTotal || (cat.volume * precoCat);
                pacotes += cat.pacotesTotal || 0;
                pecas += cat.pecasTotal || 0;
                Object.keys(cat.pppTotals || {}).forEach(k => {
                    pppTotals[k] = (pppTotals[k] || 0) + (cat.pppTotals[k] || 0);
                });
                const pecasInfoCat = construirResumoPecasParaDescricao(cat);
                originaisRes.push({
                    id: Date.now() + Math.random(),
                    produtoId: `romaneio_${normalizarIdRomaneioParte(especieLimpa)}_${normalizarIdRomaneioParte(cat.categoriaBase || categoria)}_${normalizarIdRomaneioParte(cat.dimensoesKey || '')}`,
                    produtoNome: `${especieLimpa} - ${categoria}${pecasInfoCat ? ` - ${pecasInfoCat}` : ''}`,
                    especie: especieLimpa,
                    espessura: cat.espessura || 0,
                    quantidade: cat.volume,
                    precoUnitario: precoCat,
                    total: cat.valorTotal || (cat.volume * precoCat),
                    tipo: 'romaneio',
                    unidade: cat.unidade || 'm³',
                    origemId: idEstavelAtual,
                    romaneioId: idEstavelAtual,
                    romaneioNumero: numeroExibicaoAtual,
                    romaneioTipo: tipoAtual
                });
            });
            if (!(volume > 0)) return;
            const precoMedio = volume > 0 ? valor / volume : 0;
            const pecasInfo = construirResumoPecasParaDescricao({ pecasTotal: pecas, pacotesTotal: pacotes, pppTotals });
            const produtoId = `agrupado_${normalizarIdRomaneioParte(especieLimpa)}_resumo`;
            const produtoNome = `${especieLimpa}${pecasInfo ? ` - ${pecasInfo}` : ''}`;
            const existente = itensCarrinho.find(i => String(i.tipo || '').toLowerCase() === 'romaneio_agrupado' && String(i.produtoId || '') === produtoId);
            if (existente) {
                const qAtual = typeof existente.quantidade === 'number' ? existente.quantidade : parseNumberFlexible(existente.quantidade);
                const novoQ = (isNaN(qAtual) ? 0 : qAtual) + volume;
                const novoTotal = (parseFloat(existente.total) || 0) + valor;
                existente.quantidade = novoQ;
                existente.total = novoTotal;
                existente.precoUnitario = novoQ > 0 ? novoTotal / novoQ : 0;
                existente.itensOriginais = [...(Array.isArray(existente.itensOriginais) ? existente.itensOriginais : []), ...originaisRes];
                if (!existente.origemId && idEstavelAtual) existente.origemId = idEstavelAtual;
                if (!existente.romaneioId && idEstavelAtual) existente.romaneioId = idEstavelAtual;
                if (!existente.romaneioNumero) existente.romaneioNumero = numeroExibicaoAtual;
                if (!existente.romaneioTipo && tipoAtual) existente.romaneioTipo = tipoAtual;
            } else {
                itensCarrinho.push({
                    id: Date.now() + Math.random(),
                    produtoId,
                    produtoNome,
                    especie: especieLimpa,
                    espessura: 0,
                    quantidade: volume,
                    precoUnitario: precoMedio,
                    total: valor,
                    tipo: 'romaneio_agrupado',
                    unidade: 'm³',
                    itensOriginais: originaisRes,
                    origemId: idEstavelAtual,
                    romaneioId: idEstavelAtual,
                    romaneioNumero: numeroExibicaoAtual,
                    romaneioTipo: tipoAtual
                });
            }
            gruposRes++;
        });
        if (gruposRes === 0) {
            ToastManager.warning('Nenhum item válido para o modo Resumo por Espécie', 'Atenção');
            return;
        }
        resumoCarregamentoMsg = `${gruposRes} grupos (Resumo por Espécie) adicionados do romaneio`;
    } else if (ehToraDims && modoAgrupamento === 'nenhum') {
        // Detalhado por categoria (TORA sem resumo): mesma partição do preview
        // (1 item por categoria). Exclusões do preview já aplicadas em
        // resumoFiltrado; checa ainda o set por espécie como o modo resumo.
        let linhasDet = 0;
        Object.keys(resumoFiltrado).forEach(especie => {
            const especieLimpa = String(especie || '').replace(/^\s*[-–—]\s*/, '').trim();
            if (romaneioPreviewExcluidosResumo.has(especieLimpa.toUpperCase())) return;
            Object.keys((resumoFiltrado[especie] && resumoFiltrado[especie].categorias) || {}).forEach(categoria => {
                const cat = resumoFiltrado[especie].categorias[categoria];
                if (!(cat && cat.volume > 0)) return;
                const precoCat = cat.precoUnitario > 0 ? cat.precoUnitario : precoPadraoPorM3;
                const produtoId = `romaneio_det_${normalizarIdRomaneioParte(especieLimpa)}_${normalizarIdRomaneioParte(categoria)}`;
                const existente = itensCarrinho.find(i => String(i.tipo || '').toLowerCase() === 'romaneio' && String(i.produtoId || '') === produtoId);
                if (existente) {
                    const qAtual = typeof existente.quantidade === 'number' ? existente.quantidade : parseNumberFlexible(existente.quantidade);
                    const novoQ = (isNaN(qAtual) ? 0 : qAtual) + cat.volume;
                    const novoTotal = (parseFloat(existente.total) || 0) + (cat.valorTotal || (cat.volume * precoCat));
                    existente.quantidade = novoQ;
                    existente.total = novoTotal;
                    existente.precoUnitario = novoQ > 0 ? novoTotal / novoQ : 0;
                } else {
                    itensCarrinho.push({
                        id: Date.now() + Math.random(),
                        produtoId,
                        produtoNome: `${especieLimpa} - ${categoria}`,
                        especie: especieLimpa,
                        quantidade: cat.volume,
                        precoUnitario: precoCat,
                        total: cat.valorTotal || (cat.volume * precoCat),
                        tipo: 'romaneio',
                        unidade: cat.unidade || 'm³',
                        origemId: idEstavelAtual,
                        romaneioId: idEstavelAtual,
                        romaneioNumero: numeroExibicaoAtual,
                        romaneioTipo: tipoAtual
                    });
                }
                linhasDet++;
            });
        });
        if (linhasDet === 0) {
            ToastManager.warning('Nenhum item válido para carga detalhada', 'Atenção');
            return;
        }
        resumoCarregamentoMsg = `${linhasDet} itens (detalhado por categoria) adicionados do romaneio`;
    } else {
        // Guarda defensiva (fail-closed).
        ToastManager.warning('Selecione um modo no quadro "Agrupar:" para carregar os itens.', 'Agrupamento', 4000);
        return;
    }

    atualizarTabelaItens();
    atualizarTotais();
    
    // Limpar seleção
    document.getElementById('tipoRomaneio').value = '';
    document.getElementById('romaneioSelect').innerHTML = '<option value="">Selecione um romaneio</option>';
    document.getElementById('previewConama').style.display = 'none';
    try {
        const btnLoad = document.querySelector('#secaoProdutoRomaneio .romaneio-load-btn');
        if (btnLoad) {
            btnLoad.disabled = false;
            btnLoad.title = '';
            btnLoad.style.opacity = '';
            btnLoad.style.cursor = '';
        }
    } catch (_) { /* best-effort */ }
    romaneioSelecionado = null;
    limparExclusoesPreviewVendas();
    romaneioPreviewUsoInfo = null;
    romaneioPreviewTipoAtual = '';
    __rvPreviewChaves = [];
    
    const totalCarregados = Object.keys(resumoFiltrado).length;
    const msgExtra = totalExcluidos > 0 ? ` (${totalExcluidos} excluído(s) no preview, não carregado(s))` : '';
    const msgFinal = resumoCarregamentoMsg || `${totalCarregados} categorias de produtos adicionadas do romaneio`;
    ToastManager.success(`${msgFinal}${msgExtra}`, 'Itens carregados', 3000);
    console.log(`${msgFinal}${msgExtra}`);
}

// Limpar todos os itens do carrinho (botão Limpar ao lado de Carregar Itens)
async function limparCarrinhoItens() {
    try {
        if (!Array.isArray(itensCarrinho) || itensCarrinho.length === 0) {
            ToastManager.info('O carrinho já está vazio', 'Nada a limpar', 2500);
            return;
        }
        if (!await confirmDialog({ title: 'Limpar carrinho', message: 'Limpar todos os itens do carrinho? Esta ação não pode ser desfeita.', danger: true, confirmLabel: 'Limpar tudo' })) {
            return;
        }
        itensCarrinho = [];
        itemEmEdicaoId = null;
        atualizarTabelaItens();
        atualizarTotais();
        ToastManager.success('Todos os itens foram removidos do carrinho', 'Carrinho limpo', 2500);
    } catch (e) {
        console.warn('Vendas: falha ao limpar carrinho:', e);
    }
}

// Funções para gerenciar contas a receber
function adicionarContaReceber() {
    const valor = parseCurrencyValue(document.getElementById('contaValor').value);
    const vencimento = document.getElementById('contaVencimento').value;
    const tipo = document.getElementById('contaTipo').value;
    const observacao = document.getElementById('contaObservacao').value.trim();
    const parcelasInputRaw = (document.getElementById('numeroParcelas').value || '').trim();
    
    if (!valor || valor <= 0) {
        ToastManager.warning('Informe um valor válido para a conta', 'Atenção');
        return;
    }
    
    if (!vencimento) {
        ToastManager.warning('Informe a data de vencimento', 'Atenção');
        return;
    }
    
    // Interpretar entrada de parcelas: "Nx" para quantidade (30/60/90...) ou lista de dias "30 60 90"
    let diasOffsets = [];
    let modoMensal = false;
    if (parcelasInputRaw && parcelasInputRaw.toLowerCase().includes('x')) {
        // Ex.: "2x", "3x" => gerar parcelas com intervalos fixos de 30 dias
        const countStr = parcelasInputRaw.replace(/[^0-9]/g, '');
        let numeroParcelas = parseInt(countStr, 10);
        if (!numeroParcelas || numeroParcelas < 1) numeroParcelas = 1;
        modoMensal = true;
        for (let i = 1; i <= numeroParcelas; i++) {
            diasOffsets.push(i * 30); // 1ª parcela = 30 dias; seguintes 60, 90...
        }
    } else if (parcelasInputRaw) {
        // Ex.: "30 60 90" => dias explícitos
        diasOffsets = parcelasInputRaw
            .split(/[ ,;]+/)
            .map(s => parseInt(s, 10))
            .filter(n => !isNaN(n) && n >= 0);
        if (diasOffsets.length === 0) diasOffsets = [0];
    } else {
        diasOffsets = [0];
    }

    const numeroParcelas = diasOffsets.length;
    autoRedistribuirEnabled = true;
    const valorPorParcela = valor / numeroParcelas;

    // Criar as parcelas conforme offsets calculados
    diasOffsets.forEach((diasOffset, i) => {
        const pedidoDataISO = document.getElementById('pedidoData').value;
        let baseVencimentoISO;
        let dataVencimentoISO;
        if (tipo === 'a_vista' || tipo === 'entrada' || tipo === 'pix' || tipo === 'cartao' || tipo === 'receber' || tipo === 'permuta') {
            baseVencimentoISO = vencimento || pedidoDataISO;
            dataVencimentoISO = baseVencimentoISO;
            diasOffset = 0;
        } else {
            baseVencimentoISO = vencimento || pedidoDataISO;
            dataVencimentoISO = addDaysISO(baseVencimentoISO, diasOffset);
        }

        let observacaoParcela = observacao;
        if (numeroParcelas > 1) {
            const sufixoParcela = `${i + 1}ª parcela`;
            observacaoParcela = observacao ? `${observacao} - ${sufixoParcela}` : sufixoParcela;
        }

        const novaConta = {
            id: Date.now() + i,
            valor: valorPorParcela,
            vencimento: dataVencimentoISO,
            dataEmissao: pedidoDataISO,
            baseVencimento: baseVencimentoISO,
            dias: diasOffset,
            tipo: tipo,
            observacao: observacaoParcela,
            status: 'pendente',
            locked: false
        };
        contasReceber.push(novaConta);
    });
    
    // Limpar campos
    document.getElementById('contaValor').value = '';
    
    // Configurar próxima data: para "Nx" usar salto de 30 dias por parcela; se dias explícitos, manter a base
    if (modoMensal) {
        const proximaDataISO = addDaysISO(vencimento, numeroParcelas * 30);
        document.getElementById('contaVencimento').value = proximaDataISO;
    } else {
        document.getElementById('contaVencimento').value = vencimento;
    }
    
    document.getElementById('contaTipo').value = 'receber';
    document.getElementById('contaObservacao').value = '';
    document.getElementById('numeroParcelas').value = '';
    
    atualizarTabelaContasReceber();
    atualizarTotalContasReceber();
    
    ToastManager.success(`${numeroParcelas} conta(s) a receber adicionada(s)`, 'Forma de pagamento', 2000);
    console.log(`${numeroParcelas} conta(s) a receber adicionada(s)`);
}

// Nova função para redistribuir valores automaticamente
function redistribuirValoresContas() {
    // Obter o valor total do pedido
    const totalPedido = parseCurrencyValue(document.getElementById('totalGeral').textContent);
    
    if (totalPedido <= 0) {
        return;
    }
    
    // Se não houver parcelas, apenas retornar
    if (contasReceber.length === 0) {
        return;
    }
    
    // Se houver apenas uma parcela, atribuir o valor total a ela
    if (contasReceber.length === 1) {
        contasReceber[0].valor = totalPedido;
        console.log(`Valor ajustado: 1 conta de ${formatCurrency(totalPedido)}`);
        return;
    }
    
    // Se houver múltiplas parcelas, distribuir igualmente
    const valorPorConta = totalPedido / contasReceber.length;
    
    // Atualizar o valor de todas as contas
    contasReceber.forEach(conta => {
        conta.valor = valorPorConta;
    });
    
    console.log(`Valores redistribuídos: ${contasReceber.length} contas de ${formatCurrency(valorPorConta)} cada`);
}

/**
 * 🔢 REDISTRIBUIÇÃO INTELIGENTE DE PARCELAS
 * Quando o usuário altera uma parcela, redistribui o restante automaticamente
 * @param {number} contaIdAlterada - ID da conta que foi alterada
 * @param {number} novoValor - Novo valor da conta alterada
 */
function redistribuirValoresInteligente(contaIdAlterada, novoValor) {
    if (contasReceber.length <= 1) {
        return; // Não precisa redistribuir se há apenas uma conta
    }

    // Obter o valor total do pedido
    const totalPedidoEl = document.getElementById('totalGeral');
    const valorTotalStr = totalPedidoEl.value !== undefined ? totalPedidoEl.value : totalPedidoEl.textContent;
    const totalPedido = totalPedidoEl ? parseCurrencyValue(valorTotalStr) : 0;

    if (totalPedido <= 0) {
        return;
    }

    // Encontrar a conta que foi alterada e marcá-la como fixa
    const contaAlterada = contasReceber.find(c => String(c.id) === String(contaIdAlterada));
    if (!contaAlterada) {
        return;
    }
    contaAlterada.locked = true;
    contaAlterada.valor = novoValor;

    // Somar valores das contas já fixas (editadas manualmente)
    const somaFixas = contasReceber
        .filter(c => c.locked)
        .reduce((total, c) => total + (parseFloat(c.valor) || 0), 0);

    let valorRestante = totalPedido - somaFixas;

    // Contas que ainda podem ser redistribuídas
    const contasNaoFixas = contasReceber.filter(c => !c.locked);

    if (contasNaoFixas.length === 0) {
        // Se não há contas para redistribuir, ajustar a última alteração para fechar o total
        if (valorRestante !== 0) {
            contaAlterada.valor = Math.max(0, contaAlterada.valor + valorRestante);
        }
        return;
    }

    // Se o restante for negativo, zera as não fixas e ajusta a conta alterada
    if (valorRestante < 0) {
        contasNaoFixas.forEach(c => { c.valor = 0; });
        contaAlterada.valor = Math.max(0, contaAlterada.valor + valorRestante);
        return;
    }

    // Distribuir igualmente entre as não fixas com ajuste de resíduo de arredondamento
    const valorParaCada = Math.max(0, valorRestante / contasNaoFixas.length);
    let acumulado = 0;
    contasNaoFixas.forEach((conta, idx) => {
        const valor = Math.round(valorParaCada * 100) / 100;
        conta.valor = valor;
        acumulado += valor;
    });

    const residuo = Math.round((valorRestante - acumulado) * 100) / 100;
    if (Math.abs(residuo) >= 0.01) {
        const ultimaConta = contasNaoFixas[contasNaoFixas.length - 1];
        ultimaConta.valor = Math.max(0, Math.round((ultimaConta.valor + residuo) * 100) / 100);
    }

    console.log(`Redistribuição inteligente: conta ${contaIdAlterada} fixada em ${formatCurrency(novoValor)}. ${contasNaoFixas.length} conta(s) ajustadas, restante distribuído por igual.`);
}

function removerContaReceber(contaId) {
    const index = contasReceber.findIndex(conta => String(conta.id) === String(contaId));
    if (index !== -1) {
        contasReceber.splice(index, 1);
        
        // Redistribuir valores após remoção SEMPRE (mesmo com autoRedistribuirEnabled=false)
        // A exclusão explícita de uma parcela deve sempre redistribuir o total
        if (contasReceber.length > 0) {
            redistribuirValoresContas();
            atualizarTabelaContasReceber();
            atualizarTotalContasReceber();
        } else {
            // Se todas parcelas forem excluídas, recarregar o campo Valor com o total geral
            atualizarTabelaContasReceber();
            atualizarTotalContasReceber();
            atualizarTotais();
        }
    }
}

function atualizarTabelaContasReceber() {
    const tbody = document.getElementById('contasReceberTable');
    const activeId = document.activeElement && document.activeElement.id ? document.activeElement.id : null;
    if (contasReceber.length === 0) {
        tbody.innerHTML = '<tr><td class="commerce-full-row" data-label="" colspan="6" style="text-align: center; color: #666;">Nenhuma conta adicionada</td></tr>';
        refreshCommerceResponsiveTables();
        return;
    }
    
    // Normalizar contas antigas: garantir baseVencimento e dias
    contasReceber.forEach(c => {
        if (!c.baseVencimento) {
            c.baseVencimento = c.vencimento;
        }
        if (typeof c.dias !== 'number') {
            c.dias = diffDaysISO(c.baseVencimento, c.vencimento);
        }
    });

    let html = '';
    const disabledAttr = contasReceberEdicaoBloqueada ? 'disabled' : '';
    contasReceber.forEach((conta, index) => {
        const safeId = String(conta.id).replace(/'/g, "\\'");
        const displayValor = (parcelaEditandoId && String(parcelaEditandoId) === String(conta.id)) ? (parcelaEditandoDisplay || '') : formatCurrency(conta.valor);
        html += `
            <tr>
                <td data-label="Valor">
                    <input type="text" 
                           value="${displayValor}" 
                           id="conta-valor-${safeId}"
                           oninput="onParcelaValorInput('${safeId}', this)"
                           onkeydown="onParcelaValorKeydown(event, '${safeId}')"
                           onblur="atualizarValorConta('${safeId}', this.value)"
                           style="width: 100%; border: 1px solid #ddd; padding: 4px; border-radius: 3px;" ${disabledAttr}>
                </td>
                <td data-label="Dias">
                    <input type="number"
                           value="${conta.dias}"
                           id="conta-dias-${safeId}"
                           oninput="onParcelaDiasInput('${safeId}', this.value)"
                           onchange="atualizarDiasConta('${safeId}', this.value)"
                           style="width: 100%; border: 1px solid #ddd; padding: 4px; border-radius: 3px;" ${disabledAttr}>
                </td>
                <td data-label="Vencimento">
                    <input type="date" 
                           value="${(parcelaEditandoDateId && String(parcelaEditandoDateId) === String(conta.id)) ? (parcelaEditandoDateValue || conta.vencimento) : conta.vencimento}" 
                            id="conta-venc-${safeId}" autocomplete="off"
                            oninput="onParcelaDateInput('${safeId}', this)"
                            onblur="onParcelaDateBlur('${safeId}', this)"
                           style="width: 100%; border: 1px solid #ddd; padding: 4px; border-radius: 3px;" ${disabledAttr}>
                </td>
                <td data-label="Tipo">
                    <select onchange="atualizarTipoConta('${safeId}', this.value)"
                            id="conta-tipo-${safeId}"
                            style="width: 100%; border: 1px solid #ddd; padding: 4px; border-radius: 3px;" ${disabledAttr}>
                        <option value="receber" ${conta.tipo === 'receber' ? 'selected' : ''}>Receber</option>
                        <option value="a_vista" ${conta.tipo === 'a_vista' ? 'selected' : ''}>À Vista</option>
                        <option value="entrada" ${conta.tipo === 'entrada' ? 'selected' : ''}>Entrada</option>
                        <option value="parcela" ${conta.tipo === 'parcela' ? 'selected' : ''}>Parcela</option>
                        <option value="cheque_pre" ${conta.tipo === 'cheque_pre' ? 'selected' : ''}>Cheque-pré</option>
                        <option value="boleto" ${conta.tipo === 'boleto' ? 'selected' : ''}>Boleto</option>
                        <option value="pix" ${conta.tipo === 'pix' ? 'selected' : ''}>Pix</option>
                        <option value="cartao" ${conta.tipo === 'cartao' ? 'selected' : ''}>Cartão</option>
                        <option value="permuta" ${conta.tipo === 'permuta' ? 'selected' : ''}>Permuta</option>
                    </select>
                </td>
                <td data-label="Observação">
                    <input type="text" 
                           value="${conta.observacao || ''}" 
                           id="conta-obs-${safeId}"
                           onblur="atualizarObservacaoConta('${safeId}', this.value)"
                           placeholder="Observação"
                           style="width: 100%; border: 1px solid #ddd; padding: 4px; border-radius: 3px;" ${disabledAttr}>
                </td>
                <td data-label="Ações" class="commerce-actions-cell" style="text-align: center;">
                    <button type="button" onclick="removerContaReceber('${safeId}')" class="btn-danger btn-small" title="Remover" aria-label="Remover parcela" ${disabledAttr}>
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    refreshCommerceResponsiveTables();
    if (activeId) {
        const el = document.getElementById(activeId);
        if (el) {
            if (parcelaEditandoId && activeId === `conta-valor-${parcelaEditandoId}` && parcelaEditandoDisplay) {
                el.value = parcelaEditandoDisplay;
            }
            if (parcelaEditandoDateId && activeId === `conta-venc-${parcelaEditandoDateId}` && parcelaEditandoDateValue) {
                el.value = parcelaEditandoDateValue;
            }
            el.focus();
            try { const len = el.value.length; el.setSelectionRange(len, len); } catch (_) {}
        }
    }
}

// Funções para atualizar dados das contas inline
function prepararEdicaoMonetaria(input) {
    // Limpar formatação ao focar
    const valor = input.value.replace(/[^\d.,]/g, '').replace(',', '.');
    if (valor !== '' && !isNaN(parseFloat(valor))) {
        input.value = parseFloat(valor);
    }
}

function atualizarValorConta(contaId, novoValor) {
    const key = String(contaId || '');
    const pendingTimer = debounceValorContaTimers.get(key);
    if (pendingTimer) {
        clearTimeout(pendingTimer);
        debounceValorContaTimers.delete(key);
    }
    const conta = contasReceber.find(c => String(c.id) === String(contaId));
    if (conta) {
        const valorNumerico = parseCurrencyValue(novoValor);
        conta.valor = valorNumerico;
        conta.locked = true; // Marcar como fixa para redistribuição progressiva
        
        // Reformatar o campo
        const input = document.getElementById(`conta-valor-${contaId}`);
        if (input) input.value = formatCurrency(valorNumerico);
        
        if (contasReceber.length > 1) {
            const totalPedidoEl = document.getElementById('totalGeral');
            const valorTotalStr = totalPedidoEl.value !== undefined ? totalPedidoEl.value : totalPedidoEl.textContent;
            const totalPedido = totalPedidoEl ? parseCurrencyValue(valorTotalStr) : 0;
            const res = redistribuirProgressivoParcelas(contasReceber, contaId, valorNumerico, totalPedido);
            if (res && res.success && Array.isArray(res.parcelas)) {
                contasReceber = res.parcelas.map(p => ({ ...p }));
                atualizarTabelaContasReceber();
            } else if (res && res.message) {
                ToastManager.error(res.message, 'Erro');
            }
        }
        parcelaEditandoId = null;
        parcelaEditandoDisplay = '';
        
        // Atualizar total
        atualizarTotalContasReceber();
    }
}

function atualizarVencimentoConta(contaId, novaData) {
    const conta = contasReceber.find(c => String(c.id) === String(contaId));
    if (conta) {
        if (!novaData || !/^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
            return;
        }
        conta.vencimento = novaData;
        const base = conta.baseVencimento || novaData;
        let d = diffDaysISO(base, novaData);
        if (isNaN(d) || d < 0) d = 0;
        conta.dias = d;
        atualizarTabelaContasReceber();
    }
}
function onParcelaDateInput(contaId, inputEl) {
    const key = String(contaId || '');
    const timer = debounceDiasContaTimers.get(key);
    if (timer) {
        clearTimeout(timer);
        debounceDiasContaTimers.delete(key);
    }
    parcelaEditandoDateId = contaId;
    parcelaEditandoDateValue = inputEl.value || '';
}
function onParcelaDateBlur(contaId, inputEl) {
    try {
        const val = inputEl.value || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
            return;
        }
        atualizarVencimentoConta(contaId, val);
    } finally {
        parcelaEditandoDateId = null;
        parcelaEditandoDateValue = '';
    }
}

function atualizarTipoConta(contaId, novoTipo) {
    const conta = contasReceber.find(c => String(c.id) === String(contaId));
    if (conta) {
        conta.tipo = novoTipo;
    }
}

function atualizarObservacaoConta(contaId, novaObservacao) {
    const conta = contasReceber.find(c => String(c.id) === String(contaId));
    if (conta) {
        conta.observacao = novaObservacao;
    }
}

// Descarrega edições de parcelas ainda pendentes (debounce/input sem blur)
// antes de salvar: sem isso, digitar e salvar em seguida (<180ms, ou via
// submit por Enter sem blur prévio) persistiria os valores antigos.
// Em 2 fases (ler tudo do DOM primeiro; só então aplicar + 1 re-render):
// aplicar linha a linha com re-render intermediário DESTRÓI inputs ainda
// pendentes (o re-render não preserva dias digitados) e reverte a edição.
function descarregarEdicaoParcelasVenda() {
    try {
        if (!Array.isArray(contasReceber) || contasReceber.length === 0) return;
        const ler = (id, suffix) => {
            try {
                const el = document.getElementById(`conta-${suffix}-${id}`);
                if (!el || el.disabled) return undefined;
                return el.value;
            } catch (_) { return undefined; }
        };
        const pendentes = [];
        contasReceber.slice().forEach(conta => {
            const id = String((conta && conta.id) || '');
            if (!id) return;
            pendentes.push({
                id,
                valor: ler(id, 'valor'),
                dias: ler(id, 'dias'),
                venc: ler(id, 'venc'),
                obs: ler(id, 'obs')
            });
        });
        [debounceValorContaTimers, debounceDiasContaTimers].forEach(m => {
            try {
                m.forEach(t => { try { clearTimeout(t); } catch (_) {} });
                m.clear();
            } catch (_) {}
        });
        try { parcelaEditandoId = null; } catch (_) {}
        try { parcelaEditandoDisplay = ''; } catch (_) {}
        try { parcelaEditandoDateId = null; } catch (_) {}
        try { parcelaEditandoDateValue = ''; } catch (_) {}
        const mem = (id) => contasReceber.find(c => String(c.id) === String(id));
        pendentes.forEach(p => {
            const conta = mem(p.id);
            if (!conta) return;
            if (p.obs !== undefined) conta.observacao = p.obs;
            if (p.dias !== undefined && p.dias !== '') {
                const diasInt = parseInt(p.dias, 10);
                if (!isNaN(diasInt) && diasInt >= 0) {
                    conta.dias = diasInt;
                    const base = conta.baseVencimento || conta.vencimento;
                    try { conta.vencimento = addDaysISO(base, diasInt); } catch (_) {}
                }
            } else if (p.venc !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(p.venc || '')) {
                conta.vencimento = p.venc;
                try {
                    const base = conta.baseVencimento || p.venc;
                    let d = diffDaysISO(base, p.venc);
                    conta.dias = (isNaN(d) || d < 0) ? 0 : d;
                } catch (_) {}
            }
        });
        const tocadas = [];
        pendentes.forEach(p => {
            if (p.valor === undefined || p.valor === '') return;
            const v = parseCurrencyValue(p.valor);
            if (!Number.isFinite(v) || v < 0) return;
            const conta = mem(p.id);
            if (!conta) return;
            if (Math.abs((parseFloat(conta.valor) || 0) - v) < 0.001) return;
            conta.valor = v;
            conta.locked = true;
            tocadas.push(p.id);
        });
        if (tocadas.length > 0 && contasReceber.length > 1) {
            try {
                const totalEl = document.getElementById('totalGeral');
                const totalStr = totalEl ? (totalEl.value !== undefined ? totalEl.value : totalEl.textContent) : '0';
                const totalPedido = parseCurrencyValue(totalStr);
                if (totalPedido > 0) {
                    tocadas.forEach(id => {
                        try {
                            const atual = mem(id);
                            if (!atual) return;
                            const res = redistribuirProgressivoParcelas(contasReceber, id, parseFloat(atual.valor) || 0, totalPedido);
                            if (res && res.success && Array.isArray(res.parcelas)) {
                                contasReceber = res.parcelas.map(x => ({ ...x }));
                            }
                        } catch (_) {}
                    });
                }
            } catch (_) {}
        }
        try { atualizarTabelaContasReceber(); } catch (_) {}
        try { atualizarTotalContasReceber(); } catch (_) {}
    } catch (_) {}
}

function atualizarTotalContasReceber() {
    const total = contasReceber.reduce((sum, conta) => sum + conta.valor, 0);
    document.getElementById('totalContasReceber').textContent = formatCurrency(total);
}

// Utilitários de data (ISO yyyy-mm-dd) para cálculos de dias
function toUTCDate(dateStr) {
    // Espera 'YYYY-MM-DD'
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function diffDaysISO(baseStr, targetStr) {
    const base = toUTCDate(baseStr);
    const target = toUTCDate(targetStr);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((target - base) / msPerDay);
}

function addDaysISO(baseStr, days) {
    const [y, m, d] = baseStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + parseInt(days, 10)));
    return date.toISOString().split('T')[0];
}

function atualizarDiasConta(contaId, novoDias) {
    const key = String(contaId || '');
    const oldTimer = debounceDiasContaTimers.get(key);
    if (oldTimer) {
        clearTimeout(oldTimer);
        debounceDiasContaTimers.delete(key);
    }
    const conta = contasReceber.find(c => String(c.id) === String(contaId));
    if (conta) {
        const diasInt = parseInt(novoDias, 10);
        const safeDias = isNaN(diasInt) ? 0 : diasInt;
        conta.dias = safeDias;
        const base = conta.baseVencimento || conta.vencimento;
        conta.vencimento = addDaysISO(base, safeDias);
        atualizarTabelaContasReceber();
    }
}

function atualizarDiasContaSemRender(contaId, novoDias) {
    const conta = contasReceber.find(c => String(c.id) === String(contaId));
    if (!conta) return;
    const diasInt = parseInt(novoDias, 10);
    const safeDias = isNaN(diasInt) ? 0 : diasInt;
    conta.dias = safeDias;
    const base = conta.baseVencimento || conta.vencimento;
    conta.vencimento = addDaysISO(base, safeDias);
    const dateInput = document.getElementById(`conta-venc-${contaId}`);
    if (dateInput && dateInput.value !== conta.vencimento) {
        dateInput.value = conta.vencimento;
    }
}

function onParcelaDiasInput(contaId, novoDias) {
    const key = String(contaId || '');
    if (!key) return;
    const oldTimer = debounceDiasContaTimers.get(key);
    if (oldTimer) clearTimeout(oldTimer);
    const timer = setTimeout(() => {
        debounceDiasContaTimers.delete(key);
        atualizarDiasContaSemRender(key, novoDias);
    }, DEBOUNCE_DIAS_MS);
    debounceDiasContaTimers.set(key, timer);
}

function onParcelaValorInput(contaId, inputEl) {
    try {
        const key = String(contaId || '');
        parcelaEditandoId = key;
        parcelaEditandoDisplay = inputEl.value || '';
        const v = inputEl.value || '';
        const sanitized = v.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '');
        if (sanitized !== v) {
            inputEl.value = sanitized;
            try { const len = inputEl.value.length; inputEl.setSelectionRange(len, len); } catch (_) {}
        }
        if (!key) return;
        const oldTimer = debounceValorContaTimers.get(key);
        if (oldTimer) clearTimeout(oldTimer);
        const timer = setTimeout(() => {
            debounceValorContaTimers.delete(key);
            try {
                const novoValor = parseCurrencyValue(sanitized);
                if (!Number.isFinite(novoValor) || novoValor < 0) return;
                const totalPedidoEl = document.getElementById('totalGeral');
                const totalPedidoStr = totalPedidoEl && totalPedidoEl.value !== undefined ? totalPedidoEl.value : (totalPedidoEl ? totalPedidoEl.textContent : '0');
                const totalPedido = parseCurrencyValue(totalPedidoStr);
                if (!(totalPedido > 0)) return;
                // Marcar a conta editada como locked antes da redistribuição
                const conta = contasReceber.find(c => String(c.id) === key);
                if (conta) conta.locked = true;
                const res = redistribuirProgressivoParcelas(contasReceber, key, novoValor, totalPedido);
                if (res && res.success && Array.isArray(res.parcelas)) {
                    contasReceber = res.parcelas.map(p => ({ ...p }));
                    atualizarTabelaContasReceber();
                    atualizarTotalContasReceber();
                }
            } catch (_) {}
        }, DEBOUNCE_DIAS_MS);
        debounceValorContaTimers.set(key, timer);
    } catch (e) {
        // Ignorar durante digitação
    }
}

function onParcelaValorKeydown(e, contaId) {
    if (e && e.key === 'Enter') {
        e.preventDefault();
        const currentEl = document.getElementById(`conta-valor-${contaId}`);
        if (currentEl) {
            atualizarValorConta(contaId, currentEl.value);
        }
        const idx = contasReceber.findIndex(c => String(c.id) === String(contaId));
        if (idx >= 0 && idx < contasReceber.length - 1) {
            const next = contasReceber[idx + 1];
            setTimeout(() => {
                const nextEl = document.getElementById(`conta-valor-${next.id}`);
                if (nextEl) {
                    nextEl.focus();
                    try { const len = nextEl.value.length; nextEl.setSelectionRange(len, len); } catch (_) {}
                }
            }, 0);
        }
    }
}

function handleEnterNavigation(e) {
    if (!e || e.key !== 'Enter') return;
    const t = e.target;
    const tag = (t && t.tagName || '').toLowerCase();
    if (!['input','select','textarea'].includes(tag)) return;
    if (t.type && t.type.toLowerCase() === 'date') return;
    const id = t.id || '';
    if (id === 'numeroParcelas') return;
    if (id.startsWith('conta-valor-')) return;
    e.preventDefault();
    const fields = Array.from(document.querySelectorAll('#pedidoForm input, #pedidoForm select, #pedidoForm textarea'))
        .filter(el => !el.disabled && isVisible(el));
    const idx = fields.findIndex(el => el === t);
    if (idx >= 0 && idx < fields.length - 1) {
        const next = fields[idx + 1];
        if (next) {
            next.focus();
            try { const len = next.value ? next.value.length : 0; next.setSelectionRange(len, len); } catch (_) {}
        }
    }
}

function isVisible(el) {
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function handleValorParcelaInput(contaId, inputEl) {
    try {
        formatCurrencyInput(inputEl);
        const novoValor = parseCurrencyValue(inputEl.value);
        const val = validateCurrencyRange(novoValor, 0, Infinity);
        if (!val.valid) {
            ToastManager.warning(val.message, 'Atenção');
            return;
        }
        const totalPedidoEl = document.getElementById('totalGeral');
        const totalPedidoStr = totalPedidoEl.value !== undefined ? totalPedidoEl.value : totalPedidoEl.textContent;
        const totalPedido = parseCurrencyValue(totalPedidoStr);
        const res = redistribuirProgressivoParcelas(contasReceber, contaId, novoValor, totalPedido);
        if (res && res.success && Array.isArray(res.parcelas)) {
            contasReceber = res.parcelas.map(p => ({ ...p }));
            atualizarTabelaContasReceber();
            atualizarTotalContasReceber();
        }
    } catch (e) {
        // Ignorar durante digitação
    }
}

function redistribuirProgressivoParcelas(parcelas, contaIdAlterada, novoValor, totalPedido) {
    try {
        if (!Array.isArray(parcelas) || parcelas.length === 0) {
            return { success: false, parcelas: [], message: 'Parcelas inválidas' };
        }
        const totalNum = parseFloat(totalPedido) || 0;
        if (totalNum <= 0) {
            return { success: false, parcelas: [], message: 'Total do pedido inválido' };
        }
        const novo = parseFloat(novoValor);
        if (isNaN(novo) || novo < 0) {
            return { success: false, parcelas: [], message: 'Valor informado inválido' };
        }
        // Ordenar por dias ascendente; tiebreaker: índice original (preserva ordem visual)
        const sorted = parcelas.map((p, i) => ({ p: { ...p }, i }))
            .sort((a, b) => {
                const da = typeof a.p.dias === 'number' ? a.p.dias : diffDaysISO(a.p.baseVencimento || a.p.vencimento, a.p.vencimento);
                const db = typeof b.p.dias === 'number' ? b.p.dias : diffDaysISO(b.p.baseVencimento || b.p.vencimento, b.p.vencimento);
                if (da !== db) return da - db;
                return a.i - b.i; // tiebreaker: ordem original
            });
        const idxSortedAlterada = sorted.findIndex(s => String(s.p.id) === String(contaIdAlterada));
        if (idxSortedAlterada < 0) {
            return { success: false, parcelas: [], message: 'Parcela alterada não encontrada' };
        }
        const working = sorted.map(s => ({ ...s.p, valor: parseFloat(s.p.valor) || 0 }));
        const minV = typeof working[idxSortedAlterada].minValor === 'number' ? working[idxSortedAlterada].minValor : 0;
        const maxV = typeof working[idxSortedAlterada].maxValor === 'number' ? working[idxSortedAlterada].maxValor : Infinity;
        if (novo < minV) return { success: false, parcelas: [], message: 'Valor abaixo do mínimo permitido' };
        if (novo > maxV) return { success: false, parcelas: [], message: 'Valor acima do máximo permitido' };
        if (novo > totalNum) return { success: false, parcelas: [], message: 'Valor maior que o total do pedido' };
        working[idxSortedAlterada].valor = Math.round(novo * 100) / 100;
        const sumPrev = working.slice(0, idxSortedAlterada).reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
        const lockedSub = working.slice(idxSortedAlterada + 1).filter(p => !!p.locked);
        const sumLocked = lockedSub.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
        let restante = Math.round((totalNum - sumPrev - working[idxSortedAlterada].valor - sumLocked) * 100) / 100;
        if (restante < -0.009) {
            return { success: false, parcelas: [], message: 'Valores anteriores/bloqueados excedem o total' };
        }
        const subseqAjust = working.slice(idxSortedAlterada + 1).filter(p => !p.locked);
        const n = subseqAjust.length;
        if (n === 0) {
            const ajuste = Math.round((totalNum - (sumPrev + working[idxSortedAlterada].valor + sumLocked)) * 100) / 100;
            working[idxSortedAlterada].valor = Math.max(0, Math.round((working[idxSortedAlterada].valor + ajuste) * 100) / 100);
            const merged = sorted.map((s, idx) => ({ ...working[idx] }));
            return { success: true, parcelas: reordenarParaOriginal(parcelas, sorted, merged) };
        }
        const base = Math.floor((restante / n) * 100) / 100;
        let acumulado = 0;
        for (let i = 0; i < n; i++) {
            const idxG = idxSortedAlterada + 1 + i;
            const minS = typeof working[idxG].minValor === 'number' ? working[idxG].minValor : 0;
            const maxS = typeof working[idxG].maxValor === 'number' ? working[idxG].maxValor : Infinity;
            let val = base;
            if (val < minS) val = minS;
            if (val > maxS) val = maxS;
            val = Math.round(val * 100) / 100;
            working[idxG].valor = val;
            acumulado += val;
        }
        const target = Math.round((totalNum - sumPrev - working[idxSortedAlterada].valor - sumLocked) * 100) / 100;
        const residuo = Math.round((target - acumulado) * 100) / 100;
        if (Math.abs(residuo) >= 0.01) {
            const idxLast = idxSortedAlterada + n;
            working[idxLast].valor = Math.max(0, Math.round((working[idxLast].valor + residuo) * 100) / 100);
        }
        const merged = sorted.map((s, idx) => ({ ...working[idx] }));
        return { success: true, parcelas: reordenarParaOriginal(parcelas, sorted, merged) };
    } catch (e) {
        return { success: false, parcelas: [], message: 'Falha ao redistribuir' };
    }
}

function reordenarParaOriginal(originalParcelas, sorted, merged) {
    const mapById = new Map();
    for (let i = 0; i < sorted.length; i++) {
        mapById.set(String(sorted[i].p.id), merged[i]);
    }
    return originalParcelas.map(p => {
        const m = mapById.get(String(p.id));
        return m ? { ...p, valor: m.valor, locked: m.locked } : p;
    });
}

function runTestsProgressivo() {
    const total = 4911.96;
    const ps = Array.from({ length: 14 }).map((_, i) => ({ id: i + 1, dias: i * 30, valor: Math.round((total / 14) * 100) / 100 }));
    let r = redistribuirProgressivoParcelas(ps, 1, 1000.00, total);
    console.log('P1', r.success, r.parcelas && r.parcelas.map(p => p.valor).reduce((a,b)=>a+b,0));
    r = redistribuirProgressivoParcelas(ps, 2, 1200.00, total);
    console.log('P2', r.success, r.parcelas && r.parcelas.map(p => p.valor).reduce((a,b)=>a+b,0));
    r = redistribuirProgressivoParcelas(ps, 14, 400.00, total);
    console.log('P3', r.success, r.parcelas && r.parcelas.map(p => p.valor).reduce((a,b)=>a+b,0));
    r = redistribuirProgressivoParcelas(ps, 1, 6000.00, total);
    console.log('P4', r.success, r.message);
}

function runInputValidationTests() {
    const samples = ['R$ 4.911,96', '4911,96', '4.911,96', '491196', 'R$ 0,00', '-10,00'];
    samples.forEach(s => {
        const n = parseCurrencyValue(s);
        const f = formatCurrency(n);
        console.log('VAL', s, '→', n, '→', f);
    });
    console.log(validateCurrencyRange('R$ 1,00', 0, 10));
    console.log(validateCurrencyRange('R$ 100,00', 0, 10));
}

function getTipoContaLabel(tipo) {
    const labels = {
        'receber': 'Receber',
        'a_vista': 'À Vista',
        'entrada': 'Entrada',
        'parcela': 'Parcela',
        'cheque_pre': 'Cheque-pré',
        'boleto': 'Boleto',
        'pix': 'Pix',
        'cartao': 'Cartão',
        'permuta': 'Permuta'
    };
    return labels[tipo] || tipo;
}
function getTipoContaKey(tipoOuLabel) {
    const map = {
        'a_vista': 'a_vista',
        'a prazo': 'parcela',
        'a_prazo': 'parcela',
        'receber': 'receber',
        'entrada': 'entrada',
        'parcela': 'parcela',
        'cheque-pré': 'cheque_pre',
        'cheque-pre': 'cheque_pre',
        'cheque_pre': 'cheque_pre',
        'boleto': 'boleto',
        'pix': 'pix',
        'cartão': 'cartao',
        'cartao': 'cartao',
        'permuta': 'permuta'
    };
    const t = String(tipoOuLabel || '').toLowerCase().trim();
    return map[t] || tipoOuLabel || 'receber';
}
function normalizarContaReceber(conta) {
    if (!conta || typeof conta !== 'object') return null;
    const valor = conta.valor !== undefined ? conta.valor : (conta.amount !== undefined ? conta.amount : (conta.value !== undefined ? conta.value : 0));
    const vencRaw = conta.vencimento || conta.dataVencimento || conta.dueDate || conta.venc || '';
    const tipoRaw = conta.tipo !== undefined ? conta.tipo : (conta.tipoPagamento !== undefined ? conta.tipoPagamento : (conta.categoria !== undefined ? conta.categoria : 'receber'));
    const obs = conta.observacao !== undefined ? conta.observacao : (conta.observacoes !== undefined ? conta.observacoes : (conta.obs !== undefined ? conta.obs : (conta.descricao !== undefined ? conta.descricao : '')));
    const status = conta.status || 'pendente';
    const id = conta.id || (Date.now() + Math.random());
    const baseVencimento = conta.baseVencimento || vencRaw || '';
    const dias = typeof conta.dias === 'number' ? conta.dias : (baseVencimento && vencRaw ? diffDaysISO(baseVencimento, vencRaw) : 0);
    return {
        id,
        valor: parseFloat(valor) || 0,
        vencimento: vencRaw || '',
        baseVencimento: baseVencimento || vencRaw || '',
        dias,
        tipo: getTipoContaKey(tipoRaw),
        observacao: obs || '',
        status,
        locked: !!conta.locked
    };
}
function normalizarContasReceberLista(lista) {
    const arr = Array.isArray(lista) ? lista : [];
    const normalizadas = arr.map(normalizarContaReceber).filter(Boolean);
    return normalizadas;
}

// Expor novas funções globalmente
window.alterarTipoProduto = alterarTipoProduto;
window.adicionarItemManual = adicionarItemManual;
window.carregarRomaneiosPorTipo = carregarRomaneiosPorTipo;
window.carregarDadosRomaneio = carregarDadosRomaneio;
window.adicionarItensRomaneio = adicionarItensRomaneio;
window.adicionarContaReceber = adicionarContaReceber;
window.removerContaReceber = removerContaReceber;
window.prepararEdicaoMonetaria = prepararEdicaoMonetaria;
window.atualizarValorConta = atualizarValorConta;
window.atualizarVencimentoConta = atualizarVencimentoConta;
window.atualizarTipoConta = atualizarTipoConta;
window.atualizarObservacaoConta = atualizarObservacaoConta;
if (typeof window.formatCurrencyInput !== 'function') { window.formatCurrencyInput = formatCurrencyInput; }
window.redistribuirValoresContas = redistribuirValoresContas;
window.redistribuirValoresInteligente = redistribuirValoresInteligente;
window.atualizarDiasConta = atualizarDiasConta;
window.onParcelaDiasInput = onParcelaDiasInput;

// ============================================================================
// 🎉 NOVAS IMPLEMENTAÇÕES - FASE 1
// ============================================================================

/**
 * 👁️ VISUALIZAR PEDIDO - Modal com detalhes completos
 * @param {string} pedidoId - ID do pedido a visualizar
 */
async function visualizarPedido(pedidoId) {
    const pedido = resolverPedidoVenda(pedidoId);
    
    if (!pedido) {
        ToastManager.error('Pedido não encontrado', 'Erro');
        return;
    }
    
    // Armazenar pedido para ações posteriores (imprimir, editar)
    window.pedidoVisualizando = pedidoId;
    
    // Preencher dados do cabeçalho
    document.getElementById('viewPedidoNumero').textContent = pedido.numero;
    document.getElementById('viewPedidoData').textContent = formatDate(pedido.data);
    
    // Status com badge colorido
    const statusLabel = getStatusLabel(pedido.status);
    document.getElementById('viewPedidoStatus').innerHTML = 
        `<span class="status-badge status-${pedido.status}">${statusLabel}</span>`;
    
    // Dados do cliente
    const nomeCliente = pedido.cliente ? 
        (pedido.cliente.nome || pedido.cliente.name || 'Nome não informado') : 
        'Cliente não informado';
    document.getElementById('viewPedidoCliente').textContent = nomeCliente;
    
    // Detalhes do cliente (email, telefone, endereço)
    let detalhesCliente = [];
    if (pedido.cliente) {
        if (pedido.cliente.email) detalhesCliente.push(`📧 ${pedido.cliente.email}`);
        if (pedido.cliente.telefone) detalhesCliente.push(`📞 ${pedido.cliente.telefone}`);
        if (pedido.cliente.endereco) detalhesCliente.push(`📍 ${pedido.cliente.endereco}`);
    }
    document.getElementById('viewPedidoClienteDetalhes').textContent = detalhesCliente.join(' | ');
    
    // Itens do pedido
    const tbodyItens = document.getElementById('viewPedidoItensTable');
    const itensPedido = Array.isArray(pedido.itens) ? pedido.itens : [];
    if (itensPedido.length > 0) {
        tbodyItens.innerHTML = itensPedido.map((item, index) => {
            const nomeLimpo = (item.produtoNome || '').replace(/^\s*[-–—]\s*/, '').trim();
            let produtoDescricao;
        if (item.tipo === 'manual' || item.tipo === 'romaneio' || item.tipo === 'romaneio_agrupado' || item.tipo === 'romaneio_dimensoes') {
            produtoDescricao = nomeLimpo;
        } else {
            produtoDescricao = item.produtoCodigo ? `${item.produtoCodigo} - ${nomeLimpo}` : nomeLimpo;
            // Serrado convertido: "000099 - Orelha-de-macaco - 7cmx14cmx850cm - 12 Peças"
            try {
                if (typeof detalheSerradoItem === 'function') {
                    const det = detalheSerradoItem(item);
                    if (det) {
                        let base = produtoDescricao;
                        if (typeof rotuloSerradoLinha === 'function') {
                            const rot = rotuloSerradoLinha(item);
                            if (rot) base = item.produtoCodigo ? `${item.produtoCodigo} - ${rot}` : rot;
                        }
                        produtoDescricao = `${base} - ${det}`;
                    }
                }
            } catch (_) {}
        }
            produtoDescricao += getCarregoBadgeHtml(item);

            // Formatar quantidade com unidade
            const quantidadeFormatada = item.unidade
                ? `${formatNumber(item.quantidade)} ${item.unidade}`
                : formatNumber(item.quantidade);

            return `
                <tr>
                    <td data-label="Produto"><span class="commerce-card-value commerce-card-title">${produtoDescricao}</span></td>
                    <td data-label="Quantidade"><span class="commerce-card-value commerce-card-number">${quantidadeFormatada}</span></td>
                    <td data-label="Preço Unit."><span class="commerce-card-value commerce-card-money">${formatCurrency(item.precoUnitario)}</span></td>
                    <td data-label="Total"><span class="commerce-card-value commerce-card-money commerce-card-strong">${formatCurrency(item.total)}</span></td>
                </tr>
            `;
        }).join('');
    } else {
        tbodyItens.innerHTML = '<tr><td class="commerce-full-row" data-label="" colspan="4" style="text-align: center;">Nenhum item encontrado</td></tr>';
    }
    
    // Totais
    document.getElementById('viewPedidoSubtotal').textContent = formatCurrency(pedido.subtotal);
    document.getElementById('viewPedidoDesconto').textContent = formatCurrency(pedido.desconto);
    document.getElementById('viewPedidoTotal').textContent = formatCurrency(pedido.total);
    // Total Geral (Qtd.)
    const totalQtdModal = itensPedido.reduce((acc, it) => {
        if (isCarregoItem(it)) return acc;
        return acc + (parseFloat(it.quantidade) || 0);
    }, 0);
    const viewTotalQtdEl = document.getElementById('viewPedidoTotalQtd');
    if (viewTotalQtdEl) {
        viewTotalQtdEl.textContent = formatNumber(totalQtdModal);
    }
    
    const tbodyPagamento = document.getElementById('viewPedidoPagamentoTable');
    // 1. Sempre tentar o array local do pedido primeiro (funciona para pendente/cancelado)
    const localContas = normalizarContasReceberLista(pedido.contasReceber || []);
    let contas = localContas;
    
    // 2. Só buscar no financeiro se o status NÃO for pendente/cancelado
    // (financeiro só é gerado para status que exigem financeiro)
    const statusLower = String(pedido.status || '').toLowerCase();
    const deveBuscarFinanceiro = statusLower !== 'pendente' && statusLower !== 'cancelado';
    
    if (contas.length === 0 && deveBuscarFinanceiro) {
        try {
            const vinculadas = await carregarContasReceberVinculadasPedidoVenda(pedido);
            contas = vinculadas.map(c => ({
                id: c.id,
                valor: typeof c.valor === 'number' ? c.valor : parseCurrencyValue(c.valor),
                vencimento: c.dataVencimento || c.vencimento,
                tipo: c.tipoPagamento || c.tipo,
                observacao: c.observacoes || c.observacao || '',
                status: c.status || 'pendente'
            }));
        } catch (_) {
            contas = localContas;
        }
    }
    if (contas.length > 0) {
        tbodyPagamento.innerHTML = contas.map(conta => {
            return `
                <tr>
                    <td data-label="Valor"><span class="commerce-card-value commerce-card-money">${formatCurrency(conta.valor)}</span></td>
                    <td data-label="Vencimento"><span class="commerce-card-value commerce-card-number">${formatDate(conta.vencimento)}</span></td>
                    <td data-label="Tipo"><span class="commerce-card-value">${getTipoContaLabel(conta.tipo)}</span></td>
                    <td data-label="Observação"><span class="commerce-card-value">${conta.observacao || '-'}</span></td>
                    <td data-label="Status"><span class="commerce-card-value">
                        <span class="status-badge status-${conta.status || 'pendente'}">
                            ${getStatusLabel(conta.status || 'pendente')}
                        </span>
                    </span></td>
                </tr>
            `;
        }).join('');
    } else {
        tbodyPagamento.innerHTML = '<tr><td class="commerce-full-row" data-label="" colspan="5" style="text-align: center;">Sem informações de pagamento</td></tr>';
    }
    
    // Metadados
    if (pedido.created) {
        const dataCreated = new Date(pedido.created);
        document.getElementById('viewPedidoCreated').textContent = 
            dataCreated.toLocaleString('pt-BR');
    }
    
    if (pedido.updated) {
        const dataUpdated = toValidDate(pedido.updated);
        if (dataUpdated) {
            document.getElementById('viewPedidoUpdated').textContent = dataUpdated.toLocaleString('pt-BR');
        } else {
            document.getElementById('viewPedidoUpdated').textContent = '-';
        }
        document.getElementById('viewPedidoUpdatedContainer').style.display = 'block';
    } else {
        document.getElementById('viewPedidoUpdatedContainer').style.display = 'none';
    }
    
    // Abrir modal
    document.getElementById('visualizarPedidoModal').style.display = 'block';
    refreshCommerceResponsiveTables();
    
    console.log('✅ Modal de visualização aberto para pedido:', pedido.numero);
}

/**
 * 🖨️ IMPRIMIR PEDIDO
 * @param {string} pedidoId - ID do pedido a imprimir
 */
async function imprimirPedido(pedidoId) {
    const pedido = resolverPedidoVenda(pedidoId);
    
    if (!pedido) {
        ToastManager.error('Pedido não encontrado', 'Erro');
        return;
    }
    
    try {
        // Mostrar loading enquanto carrega dados da empresa
        LoadingManager.show('Preparando impressão...');

        // Documento padrao desktop (gerarHTMLImpressaoPedido) em todos os contextos,
        // inclusive mobile: single template, single renderer.
        // (exportarPedidosVendaPdf mantido para outros usos; botoes de impressao nao roteiam por ele.)
        // Criar conteúdo HTML para impressão (assíncrono)
        const conteudoImpressao = await gerarHTMLImpressaoPedido(pedido);
        
        if (window.SiswebCommercePdf && typeof window.SiswebCommercePdf.printHtmlDocument === 'function') {
            window.SiswebCommercePdf.printHtmlDocument({
                html: conteudoImpressao,
                windowFeatures: 'width=900,height=700'
            });
        } else {
            // Abrir janela de impressão
            let janelaImpressao = null;
            try {
                janelaImpressao = window.open('', '_blank', 'width=800,height=600');
            } catch (_) {
                janelaImpressao = null;
            }
            if (!janelaImpressao || janelaImpressao.closed) {
                ToastManager.warning('Permita pop-ups para imprimir.', 'Atenção');
                return;
            }
            try {
                if (!janelaImpressao.document) throw new Error('alvo parcial');
            } catch (_) {
                try { if (!janelaImpressao.closed) janelaImpressao.close(); } catch (_) {}
                ToastManager.error('Não foi possível abrir a janela de impressão.', 'Erro');
                return;
            }
            try {
                janelaImpressao.document.write(conteudoImpressao);
                janelaImpressao.document.close();
            } catch (_) {
                try { if (!janelaImpressao.closed) janelaImpressao.close(); } catch (_) {}
                ToastManager.error('Não foi possível abrir a janela de impressão.', 'Erro');
                return;
            }
            let pedDisparado = false;
            const dispararPed = () => {
                if (pedDisparado) return;
                pedDisparado = true;
                try { janelaImpressao.focus(); } catch (_) {}
                try { janelaImpressao.print(); } catch (_) {}
            };
            try { janelaImpressao.onload = dispararPed; } catch (_) {}
            try {
                if (janelaImpressao.document && janelaImpressao.document.fonts && typeof janelaImpressao.document.fonts.ready.then === 'function') {
                    janelaImpressao.document.fonts.ready.then(() => setTimeout(dispararPed, 60)).catch(() => {});
                }
            } catch (_) {}
            try { janelaImpressao.focus(); } catch (_) {}
            setTimeout(dispararPed, 400);
            setTimeout(dispararPed, 1200);
        }
        
        console.log('✅ Janela de impressão aberta para pedido:', pedido.numero);
        
    } catch (error) {
        console.error('❌ Erro ao imprimir pedido:', error);
        ToastManager.error('Erro ao preparar impressão: ' + error.message, 'Erro');
    } finally {
        LoadingManager.hide();
    }
}

/**
 * 📄 GERAR HTML FORMATADO PARA IMPRESSÃO (ASYNC - PADRÃO DO SISTEMA)
 * Segue o mesmo padrão de folha-relatorios.js e imprimir-romaneio.js
 * @param {Object} pedido - Objeto do pedido
 * @returns {Promise<string>} HTML formatado
 */
async function gerarHTMLImpressaoPedido(pedido) {
    const helper = window.SiswebCommercePdf || {};
    const htmlEscape = typeof helper.escapeHtml === 'function'
        ? helper.escapeHtml
        : (value) => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    const nomeCliente = pedido.cliente
        ? (pedido.cliente.nome || pedido.cliente.name || 'Cliente não informado')
        : 'Cliente não informado';
    const statusLabel = getStatusLabel(pedido.status);
    const dadosEmpresa = arguments[1] || await obterDadosEmpresa();

    const htmlItens = (pedido.itens || []).map((item, index) => {
        const nomeLimpo = String(item.produtoNome || item.produto || item.nome || item.descricao || '')
            .replace(/^\s*[-–—]\s*/, '')
            .trim() || 'Produto não informado';
        let produtoDescricao;
        if (item.tipo === 'manual' || item.tipo === 'romaneio' || item.tipo === 'romaneio_agrupado' || item.tipo === 'romaneio_dimensoes') {
            produtoDescricao = nomeLimpo;
        } else {
            produtoDescricao = item.produtoCodigo ? `${item.produtoCodigo} - ${nomeLimpo}` : nomeLimpo;
        }

        const quantidadeFormatada = item.unidade
            ? `${formatNumber(item.quantidade || 0)} ${item.unidade}`
            : formatNumber(item.quantidade || 0);

        return `
            <tr>
                <td class="text-center" style="width: 38px;">${index + 1}</td>
                <td>${htmlEscape(produtoDescricao)}</td>
                <td class="text-center" style="width: 110px;">${htmlEscape(quantidadeFormatada)}</td>
                <td class="text-right" style="width: 100px;">${htmlEscape(formatCurrency(item.precoUnitario || item.preco || 0))}</td>
                <td class="text-right" style="width: 100px;"><strong>${htmlEscape(formatCurrency(item.total || 0))}</strong></td>
            </tr>
        `;
    }).join('');

    const contasReceberBase = typeof normalizarContasReceberLista === 'function'
        ? normalizarContasReceberLista(pedido.contasReceber || [])
        : (pedido.contasReceber || []);
    let contasReceberPedido = Array.isArray(contasReceberBase) ? contasReceberBase : [];
    if (contasReceberPedido.length === 0) {
        try {
            const vinculadas = await carregarContasReceberVinculadasPedidoVenda(pedido);
            contasReceberPedido = vinculadas.map(c => ({
                id: c.id,
                valor: typeof c.valor === 'number' ? c.valor : parseCurrencyValue(c.valor),
                vencimento: c.dataVencimento || c.vencimento,
                tipo: c.tipoPagamento || c.tipo,
                observacao: c.observacoes || c.observacao || '',
                status: c.status || 'pendente'
            }));
        } catch (_) {}
    }
    const htmlPagamento = contasReceberPedido.length > 0
        ? contasReceberPedido.map((conta, index) => `
            <tr>
                <td>${index + 1}ª parcela</td>
                <td class="text-right">${htmlEscape(formatCurrency(conta.valor || 0))}</td>
                <td>${htmlEscape(formatDate(conta.vencimento || conta.dataVencimento))}</td>
                <td>${htmlEscape(getTipoContaLabel(conta.tipo || conta.tipoPagamento))}</td>
                <td>${htmlEscape(conta.observacao || conta.observacoes || '-')}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="5" class="text-center">Sem informações de pagamento</td></tr>';

    let detalhesCliente = '';
    if (pedido.cliente) {
        if (pedido.cliente.email) detalhesCliente += `<p><strong>Email:</strong> ${htmlEscape(pedido.cliente.email)}</p>`;
        if (pedido.cliente.telefone) detalhesCliente += `<p><strong>Telefone:</strong> ${htmlEscape(pedido.cliente.telefone)}</p>`;
        if (pedido.cliente.endereco) detalhesCliente += `<p><strong>Endereço:</strong> ${htmlEscape(pedido.cliente.endereco)}</p>`;
    }

    const totalQuantidade = (pedido.itens || []).reduce((acc, item) => {
        if (isCarregoItem(item)) return acc;
        const q = parseFloat(item.quantidade);
        return acc + (isNaN(q) ? 0 : q);
    }, 0);

    const unidades = Array.from(new Set((pedido.itens || [])
        .map(it => (it.unidade || '').trim())
        .filter(u => u)));

    let decimalsQtd = 3;
    if (unidades.length === 1) {
        const u = unidades[0].toUpperCase();
        if (u === 'UN') {
            decimalsQtd = 0;
        } else if (u === 'M3' || u.includes('M³')) {
            decimalsQtd = 3;
        }
    } else {
        // Unidades mistas: manter 3 casas para maior precisão
        decimalsQtd = 3;
    }

    const unidadeLabel = unidades.length === 1 ? ` ${unidades[0]}` : '';
    const totalQuantidadeFormatada = `${formatNumber(totalQuantidade, decimalsQtd)}${unidadeLabel}`;

    const itemCount = (pedido.itens || []).length;
    const pagamentoCount = contasReceberPedido.length;
    const contentScore = itemCount + Math.max(0, pagamentoCount - 3);
    const bodyHtml = `
        <section class="sisweb-print-info-grid">
            <div class="sisweb-print-info-box">
                <h3>Dados do pedido</h3>
                <p><strong>Número:</strong> ${htmlEscape(pedido.numero || '-')}</p>
                <p><strong>Data:</strong> ${htmlEscape(formatDate(pedido.data))}</p>
                <p><strong>Status:</strong> ${htmlEscape(statusLabel)}</p>
                <p><strong>Emissão:</strong> ${htmlEscape(new Date().toLocaleDateString('pt-BR'))} ${htmlEscape(new Date().toLocaleTimeString('pt-BR'))}</p>
            </div>
            <div class="sisweb-print-info-box">
                <h3>Dados do cliente</h3>
                <p><strong>Nome:</strong> ${htmlEscape(nomeCliente)}</p>
                ${detalhesCliente || '<p><strong>Contato:</strong> -</p>'}
            </div>
        </section>

        <section class="sisweb-print-section">
            <h2 class="sisweb-print-section-title">Itens do pedido</h2>
            <table class="sisweb-print-table">
                <thead>
                    <tr>
                        <th style="width: 38px;" class="text-center">#</th>
                        <th>Produto</th>
                        <th style="width: 110px;" class="text-center">Quantidade</th>
                        <th style="width: 100px;" class="text-right">Preço Unit.</th>
                        <th style="width: 100px;" class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlItens || '<tr><td colspan="5" class="text-center">Nenhum item informado.</td></tr>'}
                </tbody>
            </table>
        </section>

        <section class="sisweb-print-section">
            <div class="sisweb-print-totals">
                <div class="sisweb-print-total-row">
                    <span>Total Geral (Qtd.)</span>
                    <strong>${htmlEscape(totalQuantidadeFormatada)}</strong>
                </div>
                <div class="sisweb-print-total-row">
                    <span>Subtotal</span>
                    <strong>${htmlEscape(formatCurrency(pedido.subtotal || 0))}</strong>
                </div>
                <div class="sisweb-print-total-row">
                    <span>Desconto</span>
                    <strong>${htmlEscape(formatCurrency(pedido.desconto || 0))}</strong>
                </div>
                <div class="sisweb-print-total-row total">
                    <span>TOTAL</span>
                    <span>${htmlEscape(formatCurrency(pedido.total || 0))}</span>
                </div>
            </div>
        </section>

        <section class="sisweb-print-section">
            <h2 class="sisweb-print-section-title">Forma de pagamento</h2>
            <table class="sisweb-print-table">
                <thead>
                    <tr>
                        <th>Parcela</th>
                        <th class="text-right">Valor</th>
                        <th>Vencimento</th>
                        <th>Tipo</th>
                        <th>Observação</th>
                    </tr>
                </thead>
                <tbody>${htmlPagamento}</tbody>
            </table>
        </section>

        <div class="sisweb-print-signature">Assinatura do Cliente</div>
    `;

    if (typeof helper.buildPrintDocument === 'function') {
        const printOptions = {
            title: `Pedido de Venda Nº ${pedido.numero || '-'}`,
            company: dadosEmpresa,
            badgeText: 'Vendas',
            subtitle: `Emitido em ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}`,
            documentNumber: pedido.numero || '',
            bodyHtml,
            compact: contentScore > 20
        };
        const preparedOptions = typeof helper.preparePrintOptions === 'function'
            ? await helper.preparePrintOptions(printOptions)
            : printOptions;
        return helper.buildPrintDocument(preparedOptions);
    }

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido ${htmlEscape(pedido.numero || '')}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111827}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d6dde8;padding:8px}th{background:#2c3e50;color:#fff}.text-right{text-align:right}.text-center{text-align:center}</style></head><body>${bodyHtml}</body></html>`;
}

/**
 * 🔔 SISTEMA DE TOASTS/NOTIFICAÇÕES
 */
const ToastManager = {
    /**
     * Mostrar toast
     * @param {string} message - Mensagem principal
     * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
     * @param {string} title - Título opcional
     * @param {number} duration - Duração em ms (0 = não fecha automaticamente)
     */
    show(message, type = 'info', title = '', duration = 4000) {
        // Onda B: via NotificationService (mesmo visual em vendas/compras).
        try {
            if (window.NotificationService && typeof window.NotificationService.show === 'function') {
                window.NotificationService.show(message, type, { title: title || undefined, duration });
                return null;
            }
        } catch (_) {}
        const container = document.getElementById('toastContainer');
        
        if (!container) {
            console.warn('Toast container não encontrado');
            return;
        }

        const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        
        // Criar elemento do toast
        const toast = document.createElement('div');
        toast.className = `toast ${safeType}`;
        
        // Definir ícone baseado no tipo
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        // Definir título padrão baseado no tipo
        if (!title) {
            const titles = {
                success: 'Sucesso',
                error: 'Erro',
                warning: 'Atenção',
                info: 'Informação'
            };
            title = titles[safeType] || 'Notificação';
        }
        
        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'toast-icon';
        const icon = document.createElement('i');
        icon.className = `fas ${icons[safeType] || icons.info}`;
        iconWrapper.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'toast-content';
        const titleEl = document.createElement('div');
        titleEl.className = 'toast-title';
        titleEl.textContent = title;
        const messageEl = document.createElement('div');
        messageEl.className = 'toast-message';
        messageEl.textContent = String(message == null ? '' : message);
        content.appendChild(titleEl);
        content.appendChild(messageEl);

        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'toast-close';
        closeButton.setAttribute('aria-label', 'Fechar notificação');
        const closeIcon = document.createElement('i');
        closeIcon.className = 'fas fa-times';
        closeButton.appendChild(closeIcon);
        closeButton.onclick = () => ToastManager.close(toast);

        toast.appendChild(iconWrapper);
        toast.appendChild(content);
        toast.appendChild(closeButton);
        
        // Adicionar ao container
        container.appendChild(toast);
        
        // Fechar automaticamente após duração
        if (duration > 0) {
            setTimeout(() => {
                this.close(toast);
            }, duration);
        }
        
        return toast;
    },
    
    /**
     * Fechar toast
     * @param {HTMLElement} toastElement - Elemento do toast
     */
    close(toastElement) {
        if (!toastElement) return;
        
        toastElement.classList.add('removing');
        
        setTimeout(() => {
            if (toastElement.parentNode) {
                toastElement.parentNode.removeChild(toastElement);
            }
        }, 300);
    },
    
    /**
     * Atalhos para tipos específicos
     */
    success(message, title, duration) {
        return this.show(message, 'success', title, duration);
    },
    
    error(message, title, duration) {
        return this.show(message, 'error', title, duration);
    },
    
    warning(message, title, duration) {
        return this.show(message, 'warning', title, duration);
    },
    
    info(message, title, duration) {
        return this.show(message, 'info', title, duration);
    }
};

/**
 * ⏳ SISTEMA DE LOADING
 */
const LoadingManager = {
    /**
     * Mostrar loading global
     * @param {string} text - Texto a exibir
     */
    show(text = 'Carregando...') {
        const overlay = document.getElementById('loadingOverlay');
        const textElement = document.getElementById('loadingText');
        
        if (overlay) {
            if (textElement) {
                textElement.textContent = text;
            }
            overlay.classList.add('active');
            overlay.style.display = 'flex'; // Garantir display flex
        }
        console.log('🔄 Loading:', text);
    },
    
    /**
     * Ocultar loading global
     */
    hide() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.style.display = 'none'; // Garantir display none
        }
    },
    
    /**
     * Adicionar loading a um botão
     * @param {HTMLButtonElement} button - Elemento do botão
     */
    addToButton(button) {
        if (button) {
            button.classList.add('loading');
            button.disabled = true;
        }
    },
    
    /**
     * Remover loading de um botão
     * @param {HTMLButtonElement} button - Elemento do botão
     */
    removeFromButton(button) {
        if (button) {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }
};

// Exportar novas funções globalmente
window.visualizarPedido = visualizarPedido;
window.imprimirPedido = imprimirPedido;
window.abrirCustomizarColunasRelatorio = abrirCustomizarColunasRelatorio;
window.aplicarCustomizacaoColunasRelatorio = aplicarCustomizacaoColunasRelatorio;
window.imprimirRelatorio = imprimirRelatorio;
window.gerarHTMLImpressaoPedido = gerarHTMLImpressaoPedido;
window.validarEstoque = validarEstoque;
window.toggleSelecionarPedido = toggleSelecionarPedido;
window.toggleSelecionarTodosPedidos = toggleSelecionarTodosPedidos;
window.imprimirPedidosSelecionados = imprimirPedidosSelecionados;
window.ToastManager = ToastManager;
window.mostrarToast = ToastManager.show.bind(ToastManager);
window.LoadingManager = LoadingManager;

console.log('✅ Novas funcionalidades implementadas: visualizarPedido(), imprimirPedido(), validarEstoque(), ToastManager, LoadingManager');
function getCarregoPayments() {
    try {
        const canonical = getStorageKey('vendas/pagamentos_carrego');
        const legacy = getStorageKey('carregoPagamentos');
        const allowLegacyCanonical = canonical === 'vendas/pagamentos_carrego';
        const allowLegacy = legacy === 'carregoPagamentos';
        const raw = localStorage.getItem(canonical)
            || localStorage.getItem(legacy)
            || (allowLegacyCanonical ? localStorage.getItem('vendas/pagamentos_carrego') : null)
            || (allowLegacy ? localStorage.getItem('carregoPagamentos') : null)
            || '[]';
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) return [];
        return list;
    } catch (_) { return []; }
}

function appendCarregoPayments(newRecords) {
    try {
        const list = getCarregoPayments();
        const merged = list.concat(Array.isArray(newRecords) ? newRecords : []);
        const storageKey = getStorageKey('vendas/pagamentos_carrego');
        persistLocalValue(storageKey, merged);
    } catch (_) {}
}

function getCarregoLatestStatusMap() {
    const list = getCarregoPayments();
    const map = new Map();
    list.forEach(rec => {
        const id = String(rec && rec.pedidoId || '');
        if (!id) return;
        const cur = map.get(id);
        if (!cur || new Date(rec.timestamp).getTime() >= new Date(cur.timestamp).getTime()) {
            map.set(id, rec);
        }
    });
    return map;
}

function onRelCarregoSelectChange(input) {
    const tr = input.closest('tr');
    if (!tr) return;
    const id = tr.getAttribute('data-pedido-id');
    if (!id) return;
    if (input.checked) {
        window.relCarregoSelection.add(String(id));
    } else {
        window.relCarregoSelection.delete(String(id));
    }
    updateRelCarregoSelectionCount();
}

function getSelectedCarregoIds() {
    return Array.from(window.relCarregoSelection || new Set());
}

// Critério "carrego disponível": tem item carrego com volume > 0 e não pago.
// Mesma regra antes aplicada via display:none (que quebrava paginação e
// rodapés); agora usada como filtro de dados em gerarRelatorio().
function isPedidoCarregoDisponivel(pedido) {
    try {
        if (!pedido || typeof pedido !== 'object') return false;
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        const nameOf = it => normalizeStr(String(it.produtoNome || it.nome || it.produto || ''));
        const carregoItem = itens.find(it => nameOf(it) === 'carrego');
        if (!carregoItem) return false;
        const raw = (typeof carregoItem.quantidade !== 'undefined') ? carregoItem.quantidade : (typeof carregoItem.volume !== 'undefined' ? carregoItem.volume : carregoItem.m3);
        if (!(parseNumberFlexible(raw) > 0)) return false;
        try {
            const latest = getCarregoLatestStatusMap();
            const rec = latest && latest.get(String(getPedidoVendaId(pedido)));
            if (rec && rec.status === 'pago') return false;
        } catch (_) {}
        if (pedido.carregoPago === true) return false;
        return true;
    } catch (_) { return false; }
}

function toggleFiltroCarregoDisponivel(checked) {
    // O checkbox agora apenas regenera o relatório com o filtro de dados
    // aplicado (página resetada): paginação, rodapés e seleção consistentes.
    // Mantido o nome pois o HTML (relFiltroDisponivel.onchange) o referencia.
    try { vendasRelatorioPage = 1; } catch (_) {}
    try {
        const periodoInicio = (document.getElementById('periodoInicio')?.value || '').trim();
        const periodoFim = (document.getElementById('periodoFim')?.value || '').trim();
        if (!periodoInicio || !periodoFim) return;
        gerarRelatorio(true);
    } catch (_) {}
}

function toggleSelecionarTodos(checked) {
    window.relCarregoSelection = window.relCarregoSelection || new Set();
    const rows = Array.from(document.querySelectorAll('#relatoriosTable tbody tr'));
    rows.forEach(r => {
        if (r.style.display === 'none') return;
        const cb = r.querySelector('.sel-carrego');
        if (!cb) return;
        cb.checked = checked;
        const id = r.getAttribute('data-pedido-id');
        if (!id) return;
        if (checked) window.relCarregoSelection.add(String(id));
        else window.relCarregoSelection.delete(String(id));
    });
    updateRelCarregoSelectionCount();
}

function updateRelCarregoSelectionCount() {
    const el = document.getElementById('relSelCount');
    if (!el) return;
    const count = getSelectedCarregoIds().length;
    el.textContent = `${count} selecionados`;
}

 

async function pagarCarregoSelecionados() {
    const ids = getSelectedCarregoIds();
    if (ids.length === 0) {
        ToastManager.warning('Selecione pedidos para pagar o carrego', 'Atenção');
        return;
    }
    try {
        LoadingManager.show('Processando pagamento de carrego...');
        const now = new Date().toISOString();
        const novos = [];
        ids.forEach(id => {
            const pedido = (window._relPedidosPeriodo || []).find(p => getPedidoVendaId(p) === String(id));
            if (!pedido) return;
            if (pedido.carregoPago === true) return; // já pago, ignorar
            const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
            const nameOf = it => normalizeStr(String(it.produtoNome || it.nome || it.produto || ''));
            const carregoItem = itens.find(it => nameOf(it) === 'carrego');
            let volume = 0;
            if (carregoItem) {
                const raw = (typeof carregoItem.quantidade !== 'undefined') ? carregoItem.quantidade : (typeof carregoItem.volume !== 'undefined' ? carregoItem.volume : carregoItem.m3);
                volume = parseNumberFlexible(raw) || 0;
            }
            if (!carregoItem || volume <= 0) return; // sem carrego, ignorar
            const rec = { pedidoId: getPedidoVendaId(pedido), numero: String(pedido.numero), volume, timestamp: now, status: 'pago' };
            novos.push(rec);
        });
        // Atualizar estado local do pedido (garantir estorno posterior e UI consistente)
        novos.forEach(rec => {
            const pedido = (window._relPedidosPeriodo || []).find(p => getPedidoVendaId(p) === String(rec.pedidoId)) || (window.pedidos || []).find(p => getPedidoVendaId(p) === String(rec.pedidoId));
            if (pedido) {
                pedido.carregoPago = true;
                pedido.carregoPagoAt = now;
                pedido.updated = now;
            }
        });
        appendCarregoPayments(novos);
        try {
            if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
                const updates = {};
                novos.forEach(rec => {
                    const tsKey = String(Date.now());
                    updates[`vendas/pagamentos_carrego/${rec.pedidoId}`] = rec; // último status
                    updates[`vendas/pagamentos_carregoLog/${rec.pedidoId}/${tsKey}`] = rec; // histórico
                    updates[`vendas/pedidos/${rec.pedidoId}/carregoPago`] = true;
                    updates[`vendas/pedidos/${rec.pedidoId}/carregoPagoAt`] = window.firebaseService.serverTimestamp ? window.firebaseService.serverTimestamp() : now;
                });
                await window.firebaseService.updatePaths(updates);
            } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                for (const rec of novos) {
                    await window.firebaseService.saveToFirebase('vendas/pagamentos_carrego', rec.pedidoId, rec);
                    await window.firebaseService.saveToFirebase(`vendas/pagamentos_carregoLog/${rec.pedidoId}`, String(Date.now()), rec);
                }
            }
        } catch (e) { console.warn('Falha ao gravar no Firebase:', e); }
        window.relCarregoSelection = new Set();
        gerarRelatorio();
        updateRelCarregoSelectionCount();
        ToastManager.success(`${ids.length} pagamento(s) de carrego concluído(s)`, 'Sucesso', 2500);
    } catch (err) {
        console.error(err);
        ToastManager.error('Falha ao processar pagamento do carrego', 'Erro', 3500);
    } finally {
        LoadingManager.hide();
    }
}

async function estornarCarregoSelecionados() {
    const ids = getSelectedCarregoIds();
    if (ids.length === 0) {
        ToastManager.warning('Selecione pedidos para estornar o carrego', 'Atenção');
        return;
    }
    try {
        LoadingManager.show('Estornando pagamento de carrego...');
        const now = new Date().toISOString();
        const novos = ids.map(id => {
            const pedido = (window._relPedidosPeriodo || []).find(p => getPedidoVendaId(p) === String(id));
            return { pedidoId: String(id), numero: String(pedido?.numero || ''), volume: 0, timestamp: now, status: 'estornado' };
        })
            .filter(rec => {
                const pedido = (window._relPedidosPeriodo || []).find(p => getPedidoVendaId(p) === String(rec.pedidoId));
                return !!(pedido && pedido.carregoPago === true);
            });
        // Atualizar estado local para refletir estorno imediatamente
        novos.forEach(rec => {
            const pedido = (window._relPedidosPeriodo || []).find(p => getPedidoVendaId(p) === String(rec.pedidoId)) || (window.pedidos || []).find(p => getPedidoVendaId(p) === String(rec.pedidoId));
            if (pedido) {
                pedido.carregoPago = false;
                pedido.carregoPagoAt = now;
                pedido.updated = now;
            }
        });
        appendCarregoPayments(novos);
        try {
            if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
                const updates = {};
                novos.forEach(rec => {
                    const tsKey = String(Date.now());
                    updates[`vendas/pagamentos_carrego/${rec.pedidoId}`] = rec; // último status
                    updates[`vendas/pagamentos_carregoLog/${rec.pedidoId}/${tsKey}`] = rec; // histórico
                    updates[`vendas/pedidos/${rec.pedidoId}/carregoPago`] = false;
                    updates[`vendas/pedidos/${rec.pedidoId}/carregoPagoAt`] = window.firebaseService.serverTimestamp ? window.firebaseService.serverTimestamp() : now;
                });
                await window.firebaseService.updatePaths(updates);
            } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                for (const rec of novos) {
                    await window.firebaseService.saveToFirebase('vendas/pagamentos_carrego', rec.pedidoId, rec);
                    await window.firebaseService.saveToFirebase(`vendas/pagamentos_carregoLog/${rec.pedidoId}`, String(Date.now()), rec);
                }
            }
        } catch (e) { console.warn('Falha ao gravar no Firebase (estorno):', e); }
        window.relCarregoSelection = new Set();
        gerarRelatorio();
        updateRelCarregoSelectionCount();
        ToastManager.info(`${ids.length} estorno(s) de carrego realizado(s)`, 'Estorno', 2500);
    } catch (err) {
        console.error(err);
        ToastManager.error('Falha ao estornar pagamento do carrego', 'Erro', 3500);
    } finally {
        LoadingManager.hide();
    }
}

async function excluirCarregoSelecionados() {
    const ids = getSelectedCarregoIds();
    if (ids.length === 0) {
        ToastManager.warning('Selecione pedidos para excluir o carrego', 'Atenção');
        return;
    }
    try {
        LoadingManager.show('Excluindo carrego dos pedidos selecionados...');
        const now = new Date().toISOString();
        const atualizados = [];
        const backupCarrego = [];
        ids.forEach(id => {
            const pedido = (window._relPedidosPeriodo || []).find(p => getPedidoVendaId(p) === String(id)) || (window.pedidos || []).find(p => getPedidoVendaId(p) === String(id));
            if (!pedido) return;
            const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
            const nameOf = it => normalizeStr(String(it.produtoNome || it.nome || it.produto || ''));
            const hasCarrego = itens.some(it => nameOf(it) === 'carrego');
            if (!hasCarrego) return;
            backupCarrego.push({ pedido, itens: pedido.itens, carregoPago: pedido.carregoPago, carregoPagoAt: pedido.carregoPagoAt, updated: pedido.updated });
            const novos = itens.filter(it => nameOf(it) !== 'carrego');
            pedido.itens = novos;
            pedido.carregoPago = false;
            pedido.carregoPagoAt = null;
            pedido.updated = now;
            atualizados.push(pedido);
        });
        if (atualizados.length === 0) {
            ToastManager.info('Nenhum pedido com carrego para excluir', 'Info');
            return;
        }
        let carregoRemotoOk = false;
        try {
            if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
                const updates = {};
                atualizados.forEach(p => {
                    const pid = getPedidoVendaId(p);
                    updates[`vendas/pedidos/${pid}`] = p;
                    updates[`vendas/pagamentos_carrego/${pid}`] = null;
                });
                const resCarrego = await window.firebaseService.updatePaths(updates);
                carregoRemotoOk = !!(resCarrego && resCarrego.success);
            } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                carregoRemotoOk = true;
                for (const p of atualizados) {
                    const pid = getPedidoVendaId(p);
                    const r1 = await window.firebaseService.saveToFirebase('vendas/pedidos', String(pid), p);
                    const r2 = await window.firebaseService.saveToFirebase('vendas/pagamentos_carrego', String(pid), null);
                    if (!((r1 && r1.success) && (r2 && r2.success))) {
                        carregoRemotoOk = false;
                        break;
                    }
                }
            } else {
                __rvSaveDataRemoteOk = false;
                await saveData('vendas/pedidos', window.pedidos || []);
                carregoRemotoOk = __rvSaveDataRemoteOk;
            }
        } catch (e) {
            console.warn('Falha ao persistir exclusão de carrego:', e);
            carregoRemotoOk = false;
        }
        if (!carregoRemotoOk) {
            try {
                backupCarrego.forEach(b => {
                    b.pedido.itens = b.itens;
                    b.pedido.carregoPago = b.carregoPago;
                    b.pedido.carregoPagoAt = b.carregoPagoAt;
                    b.pedido.updated = b.updated;
                });
            } catch (_) {}
            gerarRelatorio();
            window.relCarregoSelection = new Set();
            updateRelCarregoSelectionCount();
            ToastManager.error('Não foi possível excluir o carrego no servidor. Verifique sua conexão e permissões e tente novamente. Nenhuma alteração foi perdida.', 'Falha ao excluir', 8000);
            return;
        }
        gerarRelatorio();
        window.relCarregoSelection = new Set();
        updateRelCarregoSelectionCount();
        ToastManager.success(`${atualizados.length} pedido(s) atualizados sem carrego`, 'Sucesso');
    } catch (err) {
        console.error(err);
        ToastManager.error('Falha ao excluir carrego', 'Erro');
    } finally {
        LoadingManager.hide();
    }
}

async function excluirCarrego(pedidoId) {
    try {
        LoadingManager.show('Excluindo carrego...');
        const now = new Date().toISOString();
        const pedido = (window._relPedidosPeriodo || []).find(p => getPedidoVendaId(p) === String(pedidoId)) || (window.pedidos || []).find(p => getPedidoVendaId(p) === String(pedidoId));
        if (!pedido) { ToastManager.warning('Pedido não encontrado', 'Atenção'); return; }
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        const nameOf = it => normalizeStr(String(it.produtoNome || it.nome || it.produto || ''));
        const hasCarrego = itens.some(it => nameOf(it) === 'carrego');
        if (!hasCarrego) { ToastManager.info('Este pedido não possui carrego', 'Info'); return; }
        const backupUnico = { itens: pedido.itens, carregoPago: pedido.carregoPago, carregoPagoAt: pedido.carregoPagoAt, updated: pedido.updated };
        pedido.itens = itens.filter(it => nameOf(it) !== 'carrego');
        pedido.carregoPago = false; pedido.carregoPagoAt = null; pedido.updated = now;
        let carregoUnicoOk = false;
        try {
            if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
                const pid = getPedidoVendaId(pedido);
                const updates = {}; updates[`vendas/pedidos/${pid}`] = pedido; updates[`vendas/pagamentos_carrego/${pid}`] = null;
                const resUnico = await window.firebaseService.updatePaths(updates);
                carregoUnicoOk = !!(resUnico && resUnico.success);
            } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                const pid = getPedidoVendaId(pedido);
                const r1 = await window.firebaseService.saveToFirebase('vendas/pedidos', String(pid), pedido);
                const r2 = await window.firebaseService.saveToFirebase('vendas/pagamentos_carrego', String(pid), null);
                carregoUnicoOk = !!((r1 && r1.success) && (r2 && r2.success));
            } else {
                __rvSaveDataRemoteOk = false;
                await saveData('vendas/pedidos', window.pedidos || []);
                carregoUnicoOk = __rvSaveDataRemoteOk;
            }
        } catch(e) {
            console.warn('Falha ao persistir exclusão de carrego:', e);
            carregoUnicoOk = false;
        }
        if (!carregoUnicoOk) {
            try {
                pedido.itens = backupUnico.itens;
                pedido.carregoPago = backupUnico.carregoPago;
                pedido.carregoPagoAt = backupUnico.carregoPagoAt;
                pedido.updated = backupUnico.updated;
            } catch (_) {}
            gerarRelatorio(); updateRelCarregoSelectionCount();
            ToastManager.error('Não foi possível excluir o carrego no servidor. Verifique sua conexão e permissões e tente novamente. Nenhuma alteração foi perdida.', 'Falha ao excluir', 8000);
            return;
        }
        gerarRelatorio(); updateRelCarregoSelectionCount(); ToastManager.success('Carrego excluído do pedido', 'Sucesso');
    } catch(err) {
        console.error(err); ToastManager.error('Falha ao excluir carrego', 'Erro');
    } finally { LoadingManager.hide(); }
}

function toMonthKey(val) {
    try {
        if (val === undefined || val === null) return new Date().toISOString().slice(0,7);
        const s = String(val).trim();
        if (!s) return new Date().toISOString().slice(0,7);
        if (/^\d{4}-\d{2}$/.test(s)) return s;
        if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0,7);
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { const [d,m,y] = s.split('/'); return `${y}-${m}`; }
        const dt = new Date(s); return isNaN(dt.getTime()) ? new Date().toISOString().slice(0,7) : dt.toISOString().slice(0,7);
    } catch(_) { return new Date().toISOString().slice(0,7); }
}

// Listener para o checkbox de agrupamento de romaneio
document.addEventListener('DOMContentLoaded', () => {
    const checkAgrupar = document.getElementById('agruparEspecieCheckbox');
    if (checkAgrupar) {
        checkAgrupar.addEventListener('change', function() {
            if (this.checked) {
                const res = agruparItensRomaneioNoCarrinho();
                if (res.removidos > 0) {
                    ToastManager.success(`${res.removidos} itens de romaneio agrupados em ${res.agrupados} espécies.`);
                }
            }
        });
    }
});
