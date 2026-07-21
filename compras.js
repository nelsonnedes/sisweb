/**
 * Sistema de Compras - JavaScript Principal
 * Gerencia pedidos de compra, fornecedores e integração com estoque/financeiro.
 */

// ============================================================================
// 1. GERENCIADORES DE UI (Loading, Toast)
// ============================================================================

const LoadingManager = {
    show: (message = 'Carregando...') => {
        console.log(`[LOADING] ${message}`);
        // Removido loadingOverlay do DOM para melhor fluidez PWA
    },
    hide: () => {
        // Removido loadingOverlay do DOM para melhor fluidez PWA
    }
};

const ToastManager = {
    show: (message, type = 'info', duration = 3000) => {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
        const toast = document.createElement('div');
        toast.className = `toast ${safeType}`;
        
        let icon = 'info-circle';
        if (safeType === 'success') icon = 'check-circle';
        if (safeType === 'error') icon = 'exclamation-circle';
        if (safeType === 'warning') icon = 'exclamation-triangle';
        const safeTitle = escapeHtml(safeType.charAt(0).toUpperCase() + safeType.slice(1));
        const safeMessage = escapeHtml(message);

        toast.innerHTML = `
            <div class="toast-icon"><i class="fas fa-${icon}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${safeTitle}</div>
                <div class="toast-message">${safeMessage}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Remover ao clicar
        toast.querySelector('.toast-close').onclick = () => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        };

        // Auto remover
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.classList.add('removing');
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        }
    },
    success: (msg, title, duration) => ToastManager.show(msg, 'success', duration || 3000),
    error: (msg, title, duration) => ToastManager.show(msg, 'error', duration || 5000),
    warning: (msg, title, duration) => ToastManager.show(msg, 'warning', duration || 4000),
    info: (msg, title, duration) => ToastManager.show(msg, 'info', duration || 3000)
};

// ============================================================================
// 2. SERVIÇOS DE DADOS E HELPERS
// ============================================================================

// Identificação da Empresa (Tenant)
function getCompanyKey(key) {
    if (window.appTenantId) return `company_${window.appTenantId}__${key}`;
    return key;
}

function getCanonicalBusinessKey(key) {
    const aliases = {
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
    return aliases[key] || key;
}

function isRomaneioBusinessKey(key) {
    return /^romaneios\/(tora|pct|tl|pes)(\/|$)/.test(getCanonicalBusinessKey(key));
}

function persistLocalValue(storageKey, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write(storageKey, data) !== false;
        }
    } catch (_) {}
    localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
}

function aguardarFirebaseServiceCompras(timeoutMs = 8000) {
    return new Promise(async (resolve) => {
        const startedAt = Date.now();
        try {
            if (window.__siswebFirebaseServiceReady && typeof window.__siswebFirebaseServiceReady.then === 'function') {
                await window.__siswebFirebaseServiceReady;
            }
        } catch (error) {
            console.warn('⚠️ Compras: falha aguardando firebaseServiceReady:', error && error.message ? error.message : error);
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

function obterTenantServicoCompras() {
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

function limparContextoEmpresaComprasInseguro() {
    try { window.appTenantId = null; } catch (_) {}
    try { window.companyInfo = null; } catch (_) {}
    try { localStorage.removeItem('company_info'); } catch (_) {}
    try {
        const svc = window.firebaseService || window.FirebaseService;
        if (svc && typeof svc.setTenantId === 'function') svc.setTenantId(null);
    } catch (_) {}
}

function isFirebaseOfflineModeCompras() {
    try {
        if (window._FIREBASE_CONNECTED === false || window.firebaseConnected === false) return true;
    } catch (_) {}
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    } catch (_) {}
    return false;
}

function buildOperationalLoginUrlCompras() {
    try {
        const target = `${window.location.pathname.split('/').pop() || 'compras.html'}${window.location.search || ''}${window.location.hash || ''}`;
        return `login.html?reason=tenant_required&redirect=${encodeURIComponent(target)}`;
    } catch (_) {
        return 'login.html?reason=tenant_required&redirect=compras.html';
    }
}

function ensureOperationalAccessStylesCompras() {
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

function setOperationalActionsDisabledCompras(disabled) {
    document.querySelectorAll('#pedidos > .action-buttons button').forEach((button) => {
        button.disabled = !!disabled;
        if (disabled) {
            button.dataset.siswebOperationalLocked = 'true';
            button.title = 'Entre novamente com uma empresa ativa para usar Compras.';
        } else if (button.dataset.siswebOperationalLocked === 'true') {
            button.removeAttribute('disabled');
            button.removeAttribute('title');
            delete button.dataset.siswebOperationalLocked;
        }
    });
}

function renderOperationalAccessStateCompras(contexto = {}) {
    ensureOperationalAccessStylesCompras();
    window.__siswebComprasOperationalReady = false;
    window.__siswebComprasLastContext = contexto || {};
    setOperationalActionsDisabledCompras(true);
    const form = document.getElementById('pedidoForm');
    if (form) form.style.display = 'none';

    const container = document.getElementById('pedidos');
    if (!container) return;
    let panel = document.getElementById('comprasOperationalAccessState');
    if (!panel) {
        panel = document.createElement('section');
        panel.id = 'comprasOperationalAccessState';
        panel.className = 'sisweb-operational-state';
        panel.setAttribute('role', 'status');
        panel.setAttribute('aria-live', 'polite');
        const afterActions = container.querySelector('.action-buttons');
        if (afterActions && afterActions.nextSibling) container.insertBefore(panel, afterActions.nextSibling);
        else container.prepend(panel);
    }

    const isSuperAdmin = contexto && contexto.superAdmin === true;
    const title = isSuperAdmin ? 'Conta SuperAdmin sem empresa operacional' : 'Compras indisponivel nesta sessao';
    const message = isSuperAdmin
        ? 'Use um usuario vinculado a uma empresa para trabalhar com pedidos de compra. O painel administrativo continua disponivel.'
        : 'Nao foi possivel confirmar uma empresa ativa para carregar pedidos, fornecedores e financeiro com seguranca.';
    const detail = contexto && contexto.error
        ? `<p>${escapeHtml(contexto.error)}</p>`
        : '<p>Entre novamente para renovar a sessao e evitar leitura de dados de outra empresa.</p>';
    const secondaryHref = isSuperAdmin ? 'admin.html?tab=dashboard' : 'index.html';
    const secondaryText = isSuperAdmin ? 'Abrir Admin' : 'Ir para inicio';

    panel.innerHTML = `
        <div class="sisweb-operational-state-icon" aria-hidden="true"><i class="fas fa-lock"></i></div>
        <div>
            <h2>${escapeHtml(title)}</h2>
            <p>${escapeHtml(message)}</p>
            ${detail}
            <div class="sisweb-operational-state-actions">
                <a class="btn-primary" href="${escapeHtml(buildOperationalLoginUrlCompras())}">
                    <i class="fas fa-right-to-bracket"></i> Entrar novamente
                </a>
                <a class="btn-secondary" href="${escapeHtml(secondaryHref)}">
                    <i class="fas fa-arrow-left"></i> ${escapeHtml(secondaryText)}
                </a>
            </div>
        </div>
    `;
}

function clearOperationalAccessStateCompras() {
    window.__siswebComprasOperationalReady = true;
    window.__siswebComprasLastContext = null;
    setOperationalActionsDisabledCompras(false);
    const panel = document.getElementById('comprasOperationalAccessState');
    if (panel) panel.remove();
}

function guardOperationalAccessCompras() {
    if (window.__siswebComprasOperationalReady === true) return true;
    renderOperationalAccessStateCompras(window.__siswebComprasLastContext || { error: 'Empresa da sessao nao identificada.' });
    ToastManager.warning('Entre novamente com uma empresa ativa para usar Compras.');
    return false;
}

async function garantirContextoEmpresaCompras() {
    const svc = await aguardarFirebaseServiceCompras();
    try {
        if (svc && svc.authPersistenceReady) await svc.authPersistenceReady;
    } catch (_) {}

    if (svc && typeof svc.resolveAuthenticatedTenant === 'function') {
        const isOffline = isFirebaseOfflineModeCompras();
        const resolved = await svc.resolveAuthenticatedTenant({ timeoutMs: 4500, allowCached: isOffline });
        if (resolved && resolved.success && resolved.companyId) return resolved;
        if (resolved && resolved.success && resolved.superAdmin) {
            limparContextoEmpresaComprasInseguro();
            return resolved;
        }
    }

    if (typeof window.checkAuth === 'function') {
        try {
            const ok = await window.checkAuth();
            if (!ok) {
                limparContextoEmpresaComprasInseguro();
                return { success: false, code: 'auth-redirected', error: 'Autenticação não confirmada.' };
            }
        } catch (_) {}
    }

    if (svc && typeof svc.resolveAuthenticatedTenant === 'function') {
        const isOffline = isFirebaseOfflineModeCompras();
        const retried = await svc.resolveAuthenticatedTenant({ timeoutMs: 2500, allowCached: isOffline });
        if (retried && retried.success) return retried;
    }

    limparContextoEmpresaComprasInseguro();
    return { success: false, code: 'missing-company-context', error: 'Empresa da sessão não identificada.' };
}

// Carregar dados (Firebase > LocalStorage)
async function getData(key) {
    const requestedKey = key;
    key = getCanonicalBusinessKey(key);
    try {
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            const result = await window.firebaseService.loadFromFirebase(key);
            if (result && result.success) {
                // ✅ CORREÇÃO: Tratamento robusto para dados do Firebase (Arrays vs Objetos)
                let data = result.data;

                // ✅ Financeiro: finanças/pagar pode vir particionado por mês (YYYY-MM/{id})
                if (key === 'financas/pagar' && data && typeof data === 'object' && !Array.isArray(data)) {
                    const monthRe = /^\d{4}-\d{2}$/;
                    const all = [];
                    const byId = new Map();
                    Object.keys(data).forEach(rootKey => {
                        const val = data[rootKey];
                        if (monthRe.test(rootKey) && val && typeof val === 'object') {
                            const items = Array.isArray(val) ? val : Object.keys(val).map(id => ({ id, ...val[id] }));
                            items.forEach(it => {
                                const id = it && (it.id || it.firebaseKey);
                                if (!id) return;
                                byId.set(String(id), { ...it, id: String(id) });
                            });
                        } else if (val && typeof val === 'object') {
                            const id = (val.id || rootKey);
                            if (!id) return;
                            if (!byId.has(String(id))) {
                                byId.set(String(id), { ...val, id: String(id), firebaseKey: rootKey });
                            }
                        }
                    });
                    byId.forEach(v => all.push(v));
                    return all;
                }
                
                if (Array.isArray(data)) {
                    // Filtrar itens corrompidos (spread strings)
                    return data.filter(item => {
                        if (item && typeof item === 'object' && (item['0'] === 'r' && item['1'] === 'o')) return false;
                        return item && (item.id || item.firebaseKey);
                    });
                } 
                else if (data && typeof data === 'object') {
                    // Converter objeto {key: val} para array [val]
                    return Object.keys(data).map(k => {
                        const item = data[k];
                        // Verificar se é item corrompido (spread string "romaneiosTora" -> {0:'r', 1:'o'...})
                        if (item && typeof item === 'object' && (item['0'] === 'r' && item['1'] === 'o')) return null;
                        
                        // Verificar se o item é válido
                        if (item && typeof item === 'object') {
                            return { ...item, id: item.id || k, firebaseKey: k };
                        }
                        return null;
                    }).filter(item => item !== null);
                }
                
                return [];
            }
        }
    } catch (e) {
        console.warn(`[getData] Erro ao carregar ${key} do Firebase:`, e);
    }

    if (isRomaneioBusinessKey(requestedKey)) {
        console.warn(`[getData] Romaneios devem ser carregados apenas de companies/{companyId}/${key}.`);
        return [];
    }
    
    // Fallback LocalStorage
    try {
        const storageKey = getCompanyKey(key);
        const raw = localStorage.getItem(storageKey);
        if (!raw) return [];
        
        let data = JSON.parse(raw);

        if (key === 'financas/pagar' && data && typeof data === 'object' && !Array.isArray(data)) {
            const monthRe = /^\d{4}-\d{2}$/;
            const all = [];
            const byId = new Map();
            Object.keys(data).forEach(rootKey => {
                const val = data[rootKey];
                if (monthRe.test(rootKey) && val && typeof val === 'object') {
                    const items = Array.isArray(val) ? val : Object.keys(val).map(id => ({ id, ...val[id] }));
                    items.forEach(it => {
                        const id = it && (it.id || it.firebaseKey);
                        if (!id) return;
                        byId.set(String(id), { ...it, id: String(id) });
                    });
                }
            });
            byId.forEach(v => all.push(v));
            return all;
        }
        
        // ✅ CORREÇÃO: Mesmo tratamento para LocalStorage
        if (Array.isArray(data)) {
            return data.filter(item => {
                if (item && typeof item === 'object' && (item['0'] === 'r' && item['1'] === 'o')) return false;
                return item && (item.id || item.firebaseKey);
            });
        }
        if (data && typeof data === 'object') {
            return Object.keys(data).map(k => {
                const item = data[k];
                if (item && typeof item === 'object' && (item['0'] === 'r' && item['1'] === 'o')) return null;
                if (item && typeof item === 'object') return { ...item, id: item.id || k, firebaseKey: item.firebaseKey || k };
                return null;
            }).filter(Boolean);
        }
        return [];
    } catch (e) {
        return [];
    }
}

// Salvar dados
async function saveData(key, data) {
    try {
        const storageKey = getCompanyKey(key);
        persistLocalValue(storageKey, data);
        
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            await window.firebaseService.saveToFirebase(key, null, data);
        }
        return true;
    } catch (e) {
        console.error(`[saveData] Erro ao salvar ${key}:`, e);
        return false;
    }
}

// Formatadores
const formatCurrency = (val) => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatNumber = (val, decimals = 3) => {
    return Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const parseCurrency = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    return parseFloat(String(val).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

// Helpers de Data e Formatação Input
function addDaysISO(dateISO, days) {
    if (!dateISO) return '';
    const date = new Date(dateISO + 'T12:00:00'); // Meio-dia para evitar problemas de fuso
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

function formatCurrencyInput(input) {
    if (!input || !input.value) return;
    const raw = input.value.replace(/\u00A0/g, ' ').trim().replace(/^R\$\s*/, '');
    if (/,/.test(raw)) {
        const num = parseCurrency(raw);
        input.value = formatCurrency(num);
        return;
    }
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 0) {
        input.value = '';
        return;
    }
    const num = parseInt(digits, 10) / 100;
    input.value = formatCurrency(num);
}

// Modal Helper
window.fecharModal = function(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = 'none';
};

// ============================================================================
// 3. ESTADO GLOBAL
// ============================================================================

window.compras = [];
window.fornecedores = [];
window.produtos = [];
let pedidoEmEdicao = null;
let itensPedido = [];
let contasPagar = [];
let autoRedistribuirEnabled = true; // ✅ Igual Vendas: controla redistribuição automática ao alterar totais
let comprasFornecedoresEditingId = null;
let comprasFornecedoresFiltered = [];
let pedidosListPage = 1;
const pedidosListItemsPerPage = 10;
let pedidosListFiltered = [];
let pedidosSelecionados = new Set();
let produtoEmEdicaoId = null;
let comprasRelatorioAtual = [];
let comprasRelatorioModoAtual = 'pedidos';
const comprasRelatorioColunasPadrao = [
    { key: 'numero', label: 'Número' },
    { key: 'data', label: 'Data' },
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'total', label: 'Total' },
    { key: 'status', label: 'Status' },
    { key: 'acoes', label: 'Ações' }
];
let comprasRelatorioColunasVisiveis = new Set(comprasRelatorioColunasPadrao.map(c => c.key));

// Estado para controle de edição inline (igual Vendas)
let parcelaEditandoId = null;
let parcelaEditandoDisplay = '';
let parcelaEditandoDateId = null;
let parcelaEditandoDateValue = '';
const DEBOUNCE_DIAS_MS = Number((window.SiswebUiConfig && window.SiswebUiConfig.DEBOUNCE_DIAS_MS) || 180);
const debounceDiasContaPagarTimers = new Map();

// ============================================================================
// 4. LÓGICA DE PEDIDOS
// ============================================================================

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    
    const content = document.getElementById(tabId);
    const tabBtn = document.querySelector(`.tab[onclick="showTab('${tabId}')"]`);
    
    if (content) content.classList.add('active');
    if (tabBtn) tabBtn.classList.add('active');
    
    // Callbacks específicos
    if (tabId === 'pedidos') listarPedidos();
    if (tabId === 'clientes') carregarFornecedoresAbaCompra(false);
    if (tabId === 'relatorios') prepararRelatoriosCompras();
}

function novoPedido(gerarNumero = true) {
    if (!guardOperationalAccessCompras()) return;
    pedidoEmEdicao = null;
    itensPedido = [];
    contasPagar = [];
    autoRedistribuirEnabled = true; // ✅ Novo pedido: redistribuição automática ativada

    // Resetar formulário
    document.getElementById('pedidoForm').reset();
    document.getElementById('pedidoForm').style.display = 'block';
    document.getElementById('pedidoData').valueAsDate = new Date();
    
    if (gerarNumero) {
        document.getElementById('pedidoNumero').value = 'Carregando...';
        generateOrderNumber();
    }
    
    // Data de vencimento padrão = Hoje
    const hoje = new Date().toISOString().split('T')[0];
    const vencInput = document.getElementById('contaVencimento');
    if (vencInput) vencInput.value = hoje;

    document.getElementById('listaPedidosModal').style.display = 'none';
    
    // Garantir produtos atualizados no select
    atualizarSelectProdutos();

    // Limpar tabelas
    renderizarItensPedido();
    renderizarContasPagar();
    atualizarTotais();
    
    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function atualizarSelectProdutos() {
    const prodSelect = document.getElementById('produtoSelect');
    if (!prodSelect) return;
    
    prodSelect.innerHTML = '<option value="">Selecione um produto</option>';
    
    if (!window.produtos || window.produtos.length === 0) {
        console.warn('Nenhum produto carregado em window.produtos');
        return;
    }

    // Garantir que ordenação e exibição tratem nomes alternativos (name/nome)
    window.produtos.sort((a,b) => (a.especie || a.nome || a.name || '').localeCompare(b.especie || b.nome || b.name || '')).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        
        // Compatibilidade: species usa 'price', produtos usa 'preco'
        const nomeCientifico = p.nomeCientifico || '';
        const nomeComum = p.especie || p.nomeComum || p.nome || p.name || 'Produto sem nome';
        const texto = nomeCientifico ? `${nomeCientifico} - ${nomeComum}` : nomeComum;
        
        const preco = p.preco || p.price || 0;
        
        opt.textContent = texto;
        opt.dataset.preco = preco; // Guardar preço para preenchimento automático
        prodSelect.appendChild(opt);
    });
}

function getProdutoNomeCadastro(produto) {
    return String(produto?.especie || produto?.nomeComum || produto?.nome || produto?.name || produto?.nomeCientifico || '').trim();
}

function getProdutoPrecoCadastro(produto) {
    const value = produto?.preco ?? produto?.price ?? 0;
    return Number(value) || 0;
}

function getProdutoEstoqueCadastro(produto) {
    const value = produto?.estoque ?? produto?.quantidade ?? 0;
    return Number(value) || 0;
}

function ensureCodigoProdutoUnico(baseCodigo, currentId = null) {
    const used = new Set((window.produtos || [])
        .filter(p => String(p?.id || '') !== String(currentId || ''))
        .map(p => String(p?.codigo || '').trim().toUpperCase())
        .filter(Boolean));
    let code = String(baseCodigo || '').trim().toUpperCase();
    if (!code) code = `PRD-${Date.now().toString().slice(-6)}`;
    while (used.has(code)) {
        code = `${code}-${Math.floor(Math.random() * 90 + 10)}`;
    }
    return code;
}

async function persistProdutosCatalog(lista) {
    window.produtos = Array.isArray(lista) ? lista : [];
    await saveData('produtos', window.produtos);
    atualizarSelectProdutos();
}

function preencherFormularioProduto(produto = null) {
    const form = document.getElementById('produtoForm');
    if (!form) return;
    if (!produto) {
        produtoEmEdicaoId = null;
        form.reset();
        document.getElementById('produtoId').value = '';
        document.getElementById('produtoCodigo').value = ensureCodigoProdutoUnico('');
        document.getElementById('produtoEstoque').value = '';
        document.getElementById('produtoPreco').value = '';
        document.getElementById('produtoModalTitle').textContent = 'Novo Produto';
        return;
    }
    produtoEmEdicaoId = String(produto.id || '');
    document.getElementById('produtoId').value = produtoEmEdicaoId;
    document.getElementById('produtoCodigo').value = String(produto.codigo || '');
    document.getElementById('produtoNome').value = getProdutoNomeCadastro(produto);
    document.getElementById('produtoPreco').value = formatCurrency(getProdutoPrecoCadastro(produto));
    document.getElementById('produtoEstoque').value = String(getProdutoEstoqueCadastro(produto));
    document.getElementById('produtoUnidade').value = String(produto.unidade || 'UN');
    document.getElementById('produtoDescricao').value = String(produto.descricao || '');
    document.getElementById('produtoModalTitle').textContent = 'Editar Produto';
}

function renderProdutosCadastroTable() {
    const table = document.getElementById('produtosTable');
    if (!table) return;
    const termo = String((document.getElementById('searchProdutos')?.value || '')).toLowerCase().trim();
    const lista = (window.produtos || []).filter(p => {
        const nome = getProdutoNomeCadastro(p).toLowerCase();
        const codigo = String(p?.codigo || '').toLowerCase();
        if (!termo) return true;
        return nome.includes(termo) || codigo.includes(termo);
    });
    if (lista.length === 0) {
        table.innerHTML = '<tr><td colspan="5" data-label="Mensagem" class="text-center commerce-full-row">Nenhum produto cadastrado.</td></tr>';
        refreshCommerceResponsiveTables();
        return;
    }
    const ordered = lista.slice().sort((a, b) => getProdutoNomeCadastro(a).localeCompare(getProdutoNomeCadastro(b)));
    table.innerHTML = ordered.map(produto => `
        <tr>
            <td data-label="Código"><span class="commerce-card-value commerce-card-number">${escapeHtml(String(produto.codigo || '-'))}</span></td>
            <td data-label="Nome"><span class="commerce-card-value commerce-card-title">${escapeHtml(getProdutoNomeCadastro(produto) || '-')}</span></td>
            <td data-label="Preço"><span class="commerce-card-value commerce-card-money">${escapeHtml(formatCurrency(getProdutoPrecoCadastro(produto)))}</span></td>
            <td data-label="Estoque"><span class="commerce-card-value commerce-card-number">${escapeHtml(formatNumber(getProdutoEstoqueCadastro(produto), 3))}</span></td>
            <td data-label="Ações" class="commerce-actions-cell">
                <div class="acoes-buttons commerce-actions-wrap">
                <button type="button" onclick="editarProdutoCadastro('${String(produto.id || '').replace(/'/g, "\\'")}')" class="btn-primary btn-small" title="Editar" aria-label="Editar produto"><i class="fas fa-edit"></i></button>
                <button type="button" onclick="excluirProdutoCadastro('${String(produto.id || '').replace(/'/g, "\\'")}')" class="btn-danger btn-small" title="Excluir" aria-label="Excluir produto"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
    refreshCommerceResponsiveTables();
}

window.novoProduto = function() {
    preencherFormularioProduto(null);
    const modal = document.getElementById('produtoModal');
    if (modal) modal.style.display = 'block';
};

window.listarProdutos = function() {
    const list = document.getElementById('produtosList');
    if (list) list.style.display = 'block';
    renderProdutosCadastroTable();
};

window.filtrarProdutos = function() {
    renderProdutosCadastroTable();
};

window.editarProdutoCadastro = function(produtoId) {
    const produto = (window.produtos || []).find(p => String(p?.id || '') === String(produtoId || ''));
    if (!produto) return;
    preencherFormularioProduto(produto);
    const modal = document.getElementById('produtoModal');
    if (modal) modal.style.display = 'block';
};

window.excluirProdutoCadastro = async function(produtoId) {
    const produto = (window.produtos || []).find(p => String(p?.id || '') === String(produtoId || ''));
    if (!produto) return;
    if (!confirm(`Excluir produto "${getProdutoNomeCadastro(produto)}"?`)) return;
    const novaLista = (window.produtos || []).filter(p => String(p?.id || '') !== String(produtoId || ''));
    await persistProdutosCatalog(novaLista);
    renderProdutosCadastroTable();
    ToastManager.success('Produto excluído com sucesso!');
};

async function salvarProdutoCadastro(event) {
    event.preventDefault();
    const form = document.getElementById('produtoForm');
    if (!form) return;
    const id = String(document.getElementById('produtoId').value || produtoEmEdicaoId || '').trim();
    const codigoInput = String(document.getElementById('produtoCodigo').value || '').trim();
    const nome = String(document.getElementById('produtoNome').value || '').trim();
    const preco = parseCurrency(document.getElementById('produtoPreco').value || 0);
    const estoque = Number(document.getElementById('produtoEstoque').value || 0);
    const unidade = String(document.getElementById('produtoUnidade').value || 'UN').trim() || 'UN';
    const descricao = String(document.getElementById('produtoDescricao').value || '').trim();
    if (!nome) {
        ToastManager.warning('Informe o nome do produto.');
        return;
    }
    const nowIso = new Date().toISOString();
    const finalId = id || `PRD-${Date.now()}`;
    const finalCodigo = ensureCodigoProdutoUnico(codigoInput, finalId);
    const current = window.produtos || [];
    const index = current.findIndex(p => String(p?.id || '') === String(finalId));
    const base = index >= 0 ? current[index] : {};
    const produto = {
        ...base,
        id: finalId,
        codigo: finalCodigo,
        nome: nome,
        nomeComum: nome,
        price: Number(preco) || 0,
        preco: Number(preco) || 0,
        estoque: Number(estoque) || 0,
        quantidade: Number(estoque) || 0,
        unidade,
        descricao,
        updatedAt: nowIso,
        createdAt: base.createdAt || nowIso
    };
    const next = current.slice();
    if (index >= 0) next[index] = produto; else next.push(produto);
    await persistProdutosCatalog(next);
    window.fecharModal('produtoModal');
    renderProdutosCadastroTable();
    ToastManager.success(index >= 0 ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!');
}

function cancelarPedido() {
    if (confirm('Tem certeza que deseja cancelar? Dados não salvos serão perdidos.')) {
        document.getElementById('pedidoForm').style.display = 'none';
        itensPedido = [];
        contasPagar = [];
    }
}

async function generateOrderNumber() {
    try {
        const pedidosSalvos = await getData('pedidosCompra');
        const lista = Array.isArray(pedidosSalvos) ? pedidosSalvos : (Array.isArray(window.compras) ? window.compras : []);

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
        if (numeroEl) {
            numeroEl.value = numeroProximo;
            numeroEl.readOnly = true;
        }
        return numeroProximo;
    } catch (e) {
        console.warn('Falha ao calcular próximo número de pedido, usando fallback:', e);
        const fallback = '000001';
        const numeroEl = document.getElementById('pedidoNumero');
        if (numeroEl) {
            numeroEl.value = fallback;
        }
        return fallback;
    }
}

// --- Itens do Pedido ---

function alterarTipoProduto(tipo) {
    document.querySelectorAll('.tipo-produto-section').forEach(s => s.style.display = 'none');
    const section = document.getElementById(
        tipo === 'manual' ? 'secaoProdutoManual' :
        tipo === 'romaneio' ? 'secaoProdutoRomaneio' : 'secaoProdutoCadastrado'
    );
    if (section) section.style.display = 'block';
}

function adicionarItemManual() {
    const nome = document.getElementById('produtoManual').value;
    const qtd = parseFloat(document.getElementById('quantidadeManual').value);
    const unidade = document.getElementById('unidadeManual').value;
    const preco = parseCurrency(document.getElementById('precoManual').value);
    
    if (!nome || !qtd || !preco) {
        ToastManager.warning('Preencha nome, quantidade e preço.');
        return;
    }
    
    itensPedido.push({
        id: Date.now(),
        tipo: 'manual',
        produtoNome: nome,
        quantidade: qtd,
        unidade: unidade,
        precoUnitario: preco,
        total: qtd * preco
    });
    
    // Limpar campos
    document.getElementById('produtoManual').value = '';
    document.getElementById('quantidadeManual').value = '';
    document.getElementById('precoManual').value = '';
    
    renderizarItensPedido();
    atualizarTotais();
    ToastManager.success('Item adicionado');
}

function adicionarItem() { // Produto Cadastrado
    const select = document.getElementById('produtoSelect');
    const produtoId = select.value;
    const nome = select.options[select.selectedIndex]?.text;
    const qtd = parseFloat(document.getElementById('quantidade').value);
    const preco = parseCurrency(document.getElementById('precoUnitario').value);
    
    if (!produtoId || !qtd || !preco) {
        ToastManager.warning('Selecione produto, quantidade e preço.');
        return;
    }
    
    itensPedido.push({
        id: Date.now(),
        tipo: 'cadastrado',
        produtoId: produtoId,
        produtoNome: nome,
        quantidade: qtd,
        precoUnitario: preco,
        total: qtd * preco
    });
    
    renderizarItensPedido();
    atualizarTotais();
}

function renderizarItensPedido() {
    const tbody = document.getElementById('itensTable');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (itensPedido.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" data-label="Mensagem" class="commerce-full-row" style="text-align: center;">Nenhum item adicionado</td></tr>';
        refreshCommerceResponsiveTables();
        return;
    }
    
    itensPedido.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Produto"><span class="commerce-card-value commerce-card-title">${escapeHtml(item.produtoNome || '-')}</span></td>
            <td data-label="Quantidade"><span class="commerce-card-value commerce-card-number">${escapeHtml(formatNumber(item.quantidade))} ${escapeHtml(item.unidade || '')}</span></td>
            <td data-label="Preço Unit."><span class="commerce-card-value commerce-card-money">${escapeHtml(formatCurrency(item.precoUnitario))}</span></td>
            <td data-label="Total"><span class="commerce-card-value commerce-card-money commerce-card-strong">${escapeHtml(formatCurrency(item.total))}</span></td>
            <td data-label="Ações" class="commerce-actions-cell">
                <button type="button" onclick="removerItem(${index})" class="btn-danger btn-small" title="Remover" aria-label="Remover item"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    refreshCommerceResponsiveTables();
}

function removerItem(index) {
    itensPedido.splice(index, 1);
    renderizarItensPedido();
    atualizarTotais();
}

function agruparItensRomaneioNoCarrinho() {
    const itensRomaneio = itensPedido.filter(item => String(item && item.tipo || '').toLowerCase() === 'romaneio');
    if (itensRomaneio.length === 0) return { agrupados: 0, removidos: 0 };
    const outrosItens = itensPedido.filter(item => String(item && item.tipo || '').toLowerCase() !== 'romaneio');
    const agrupadosMap = {};
    itensRomaneio.forEach(item => {
        const nome = String(item && item.produtoNome || 'Item Romaneio').trim();
        const origemId = String(item && item.origemId || '');
        const key = `${origemId}__${nome.toUpperCase()}`;
        const qtd = Number(item && item.quantidade || 0) || 0;
        const totalItem = Number(item && item.total || 0) || (qtd * (Number(item && item.precoUnitario || 0) || 0));
        const unidade = String(item && item.unidade || 'm³');
        if (!agrupadosMap[key]) {
            agrupadosMap[key] = { origemId, nome, quantidade: 0, total: 0, unidade };
        }
        agrupadosMap[key].quantidade += qtd;
        agrupadosMap[key].total += totalItem;
    });
    const itensAgrupados = Object.values(agrupadosMap).map(grp => {
        const precoMedio = grp.quantidade > 0 ? (grp.total / grp.quantidade) : 0;
        return {
            id: Date.now() + Math.random(),
            tipo: 'romaneio_agrupado',
            origemId: grp.origemId,
            produtoNome: grp.nome,
            quantidade: parseFloat(grp.quantidade.toFixed(3)),
            unidade: grp.unidade,
            precoUnitario: parseFloat(precoMedio.toFixed(2)),
            total: parseFloat(grp.total.toFixed(2))
        };
    });
    itensPedido = [...outrosItens, ...itensAgrupados];
    renderizarItensPedido();
    atualizarTotais();
    return { agrupados: itensAgrupados.length, removidos: itensRomaneio.length };
}

function atualizarTotais() {
    const subtotal = itensPedido.reduce((acc, item) => acc + item.total, 0);
    const desconto = parseCurrency(document.getElementById('desconto').value);
    const total = Math.max(0, subtotal - desconto);
    
    document.getElementById('subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('totalGeral').textContent = formatCurrency(total);
    document.getElementById('totalGeralQtd').textContent = formatNumber(itensPedido.reduce((acc, i) => acc + i.quantidade, 0));

    // ✅ Padrão Vendas: redistribuir apenas se habilitado e houver parcelas
    const podeRedistribuir = contasPagar.length > 0 && (
        autoRedistribuirEnabled ||
        (pedidoEmEdicao && contasPagar.every(c => !c.locked))
    );

    if (podeRedistribuir) {
        redistribuirValoresContasPagar();
        renderizarContasPagar();
    } else if (contasPagar.length > 0) {
        // Tem parcelas com locked — usar redistribuição com locked
        redistribuirValoresComLocked(total);
        renderizarContasPagar();
    } else {
        // Nenhuma parcela: sincronizar campo Valor com Total Geral
        const contaValor = document.getElementById('contaValor');
        if (contaValor) {
            contaValor.value = total > 0 ? formatCurrency(total) : '';
        }
    }
}

/**
 * ✅ REDISTRIBUIÇÃO SIMPLES (espelho do Vendas)
 * Quando não há locked, distribui igualmente o total do pedido entre todas as parcelas.
 */
function redistribuirValoresContasPagar() {
    const totalPedido = parseCurrency(document.getElementById('totalGeral').textContent);
    if (totalPedido <= 0 || contasPagar.length === 0) return;

    if (contasPagar.length === 1) {
        contasPagar[0].valor = totalPedido;
        return;
    }

    const valorPorConta = totalPedido / contasPagar.length;
    contasPagar.forEach(conta => {
        conta.valor = Math.round(valorPorConta * 100) / 100;
    });

    // Corrigir resíduo de arredondamento na última parcela
    const soma = contasPagar.reduce((acc, c) => acc + c.valor, 0);
    const residuo = Math.round((totalPedido - soma) * 100) / 100;
    if (Math.abs(residuo) >= 0.01) {
        contasPagar[contasPagar.length - 1].valor = Math.max(0,
            Math.round((contasPagar[contasPagar.length - 1].valor + residuo) * 100) / 100
        );
    }
}

// --- Contas a Pagar ---

function adicionarContaPagar() {
    const valorRaw = document.getElementById('contaValor').value;
    const valor = parseCurrency(valorRaw);
    const vencimento = document.getElementById('contaVencimento').value;
    const tipo = document.getElementById('contaTipo').value;
    const obs = document.getElementById('contaObservacao').value.trim();
    const parcelasInputRaw = (document.getElementById('numeroParcelas').value || '').trim();
    
    if (!valor || valor <= 0) {
        ToastManager.warning('Informe um valor válido para a conta.', 'Atenção');
        return;
    }
    if (!vencimento) {
        ToastManager.warning('Informe a data de vencimento.', 'Atenção');
        return;
    }

    // ✅ Lógica de Parcelas idêntica ao Vendas (2x, 30 60 90, etc)
    let diasOffsets = [];
    let modoMensal = false;
    
    if (parcelasInputRaw && parcelasInputRaw.toLowerCase().includes('x')) {
        // Ex.: "2x", "3x" => gerar parcelas com intervalos fixos de 30 dias
        const countStr = parcelasInputRaw.replace(/[^0-9]/g, '');
        let num = parseInt(countStr, 10);
        if (!num || num < 1) num = 1;
        modoMensal = true;
        for (let i = 1; i <= num; i++) {
            diasOffsets.push(i * 30); // 1ª = 30 dias, 2ª = 60, etc.
        }
    } else if (parcelasInputRaw) {
        // Ex.: "30 60 90" => dias explícitos a partir do vencimento base
        diasOffsets = parcelasInputRaw
            .split(/[ ,;]+/)
            .map(s => parseInt(s, 10))
            .filter(n => !isNaN(n) && n >= 0);
        if (diasOffsets.length === 0) diasOffsets = [0];
    } else {
        diasOffsets = [0]; // 1 parcela única, vencimento = data informada
    }

    const numParcelas = diasOffsets.length;
    autoRedistribuirEnabled = true; // ✅ Igual Vendas: habilitar redistribuição automática
    const valorPorParcela = valor / numParcelas;
    const pedidoDataISO = document.getElementById('pedidoData').value;

    diasOffsets.forEach((diasOffset, i) => {
        let baseVencimentoISO;
        let dataVencimentoISO;

        // ✅ Tipos de pagamento à vista: vencimento = data do pedido (sem offset)
        if (['a_vista', 'entrada', 'pix', 'cartao', 'pagar', 'permuta'].includes(tipo)) {
            baseVencimentoISO = pedidoDataISO || vencimento;
            dataVencimentoISO = baseVencimentoISO;
            diasOffset = 0;
        } else {
            baseVencimentoISO = vencimento;
            dataVencimentoISO = addDaysISO(baseVencimentoISO, diasOffset);
        }

        let observacaoParcela = obs;
        if (numParcelas > 1) {
            const sufixoParcela = `${i + 1}ª parcela`;
            observacaoParcela = obs ? `${obs} - ${sufixoParcela}` : sufixoParcela;
        }

        contasPagar.push({
            id: Date.now() + i,
            valor: valorPorParcela,
            vencimento: dataVencimentoISO,
            baseVencimento: baseVencimentoISO, // ✅ Salvar base para cálculo de dias (Igual Vendas)
            dias: diasOffset,                   // ✅ Salvar offset para edição inline
            tipo,
            observacao: observacaoParcela,
            status: 'pendente',
            locked: false                        // ✅ Iniciar desbloqueada para redistribuição
        });
    });
    
    // Limpar campos
    document.getElementById('contaValor').value = '';
    document.getElementById('contaObservacao').value = '';
    document.getElementById('numeroParcelas').value = '';
    document.getElementById('contaTipo').value = 'pagar';
    
    // ✅ Avançar data de vencimento (igual Vendas)
    if (modoMensal) {
        document.getElementById('contaVencimento').value = addDaysISO(vencimento, numParcelas * 30);
    } else {
        document.getElementById('contaVencimento').value = vencimento;
    }

    renderizarContasPagar();
    atualizarTotalContasPagar();
    ToastManager.success(`${numParcelas} conta(s) a pagar adicionada(s).`, 'Forma de pagamento', 2000);
}

/**
 * ✅ Atualiza o total exibido na seção de contas a pagar
 */
function atualizarTotalContasPagar() {
    const total = contasPagar.reduce((acc, c) => acc + (typeof c.valor === 'number' ? c.valor : parseCurrency(c.valor)), 0);
    const el = document.getElementById('totalContasPagar');
    if (el) el.textContent = formatCurrency(total);
}

function renderizarContasPagar() {
    const tbody = document.getElementById('contasPagarTable');
    if (!tbody) return;
    
    // Manter foco se estiver editando
    const activeId = document.activeElement && document.activeElement.id ? document.activeElement.id : null;

    // ✅ Normalizar contas antigas: garantir baseVencimento e dias (igual Vendas)
    contasPagar.forEach(c => {
        if (!c.baseVencimento) c.baseVencimento = c.vencimento;
        if (typeof c.dias !== 'number') c.dias = diffDaysISOConta(c.baseVencimento, c.vencimento);
    });

    if (contasPagar.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" data-label="Mensagem" class="commerce-full-row" style="text-align: center; color: #666;">Nenhuma conta adicionada</td></tr>';
        atualizarTotalContasPagar();
        refreshCommerceResponsiveTables();
        return;
    }

    let html = '';
    contasPagar.forEach((conta) => {
        const safeId = String(conta.id).replace(/'/g, "\\'");
        
        // ✅ Determinar valor a exibir (edição em curso ou formatado)
        const displayValor = (parcelaEditandoId && String(parcelaEditandoId) === String(conta.id)) 
            ? (parcelaEditandoDisplay || '') 
            : formatCurrency(conta.valor);

        // ✅ Determinar data a exibir
        const displayData = (parcelaEditandoDateId && String(parcelaEditandoDateId) === String(conta.id))
            ? (parcelaEditandoDateValue || conta.vencimento)
            : conta.vencimento;

        html += `
            <tr>
                <td data-label="Valor">
                    <input type="text" 
                           id="conta-valor-${safeId}"
                           value="${displayValor}" 
                           oninput="onParcelaValorInput('${safeId}', this)"
                           onkeydown="onParcelaValorKeydown(event, '${safeId}')"
                           onblur="onParcelaValorBlur('${safeId}', this.value)"
                           style="width: 120px;">
                </td>
                <td data-label="Dias">
                    <input type="number"
                           id="conta-dias-${safeId}"
                           value="${conta.dias}"
                           min="0"
                           oninput="onParcelaDiasPagarInput('${safeId}', this.value)"
                           onchange="atualizarDiasContaPagar('${safeId}', this.value)"
                           style="width: 90px;">
                </td>
                <td data-label="Vencimento">
                    <input type="date" 
                           id="conta-venc-${safeId}"
                           value="${displayData}" 
                           oninput="onParcelaDateInput('${safeId}', this)"
                           onblur="onParcelaDateBlur('${safeId}', this)"
                           style="width: 140px;">
                </td>
                <td data-label="Tipo">
                    <select onchange="atualizarTipoConta('${safeId}', this.value)" id="conta-tipo-${safeId}" style="width: 120px;">
                        <option value="pagar" ${conta.tipo === 'pagar' ? 'selected' : ''}>Pagar</option>
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
                           id="conta-obs-${safeId}"
                           value="${conta.observacao || ''}" 
                           onblur="atualizarObservacaoConta('${safeId}', this.value)"
                           placeholder="Observação"
                           style="width: 100%;">
                </td>
                <td data-label="Ações" class="commerce-actions-cell">
                    <button type="button" onclick="removerConta('${safeId}')" class="btn-danger btn-small" title="Remover" aria-label="Remover parcela">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    atualizarTotalContasPagar();
    refreshCommerceResponsiveTables();

    // ✅ Restaurar foco após re-render (igual Vendas)
    if (activeId) {
        const el = document.getElementById(activeId);
        if (el) {
            if (parcelaEditandoId && activeId === `conta-valor-${parcelaEditandoId}` && parcelaEditandoDisplay) {
                el.value = parcelaEditandoDisplay;
            }
            el.focus();
            try { const len = el.value.length; el.setSelectionRange(len, len); } catch (_) {}
        }
    }
}

/**
 * ✅ Atualiza o tipo de uma conta a pagar via ID (igual Vendas por ID)
 */
function atualizarTipoConta(contaId, novoTipo) {
    const conta = contasPagar.find(c => String(c.id) === String(contaId));
    if (!conta) return;
    conta.tipo = novoTipo;
}

/**
 * ✅ Atualiza a observação de uma conta a pagar via ID (igual Vendas)
 */
function atualizarObservacaoConta(contaId, novaObs) {
    const conta = contasPagar.find(c => String(c.id) === String(contaId));
    if (!conta) return;
    conta.observacao = novaObs;
}

// --- Handlers de Edição (Estilo Vendas) ---

function onParcelaValorInput(contaId, input) {
    try {
        const key = String(contaId || '');
        parcelaEditandoId = key;
        parcelaEditandoDisplay = input.value || '';
        const v = input.value || '';
        const sanitized = v.replace(/[^\d,]/g, '').replace(/,(?=.*,)/g, '');
        if (sanitized !== v) {
            input.value = sanitized;
            try { const len = input.value.length; input.setSelectionRange(len, len); } catch (_) {}
        }
        // Em compras, redistribuicao ocorre no blur/Enter com valor final digitado.
        // Evita re-render durante a digitacao (ex.: "500,00" virar "5,00").
    } catch (_) {}
}

function onParcelaValorKeydown(event, contaId) {
    if (event.key === 'Enter') {
        event.preventDefault();
        event.target.blur();
    }
}

function onParcelaValorBlur(contaId, valorStr) {
    const key = String(contaId || '');
    const novoValor = parseCurrency(valorStr);
    const index = contasPagar.findIndex(c => String(c.id) === key);
    
    if (index >= 0) {
        const valorAntigo = contasPagar[index].valor;
        if (Math.abs(novoValor - valorAntigo) > 0.001) {
             const totalPedido = parseCurrency(document.getElementById('totalGeral').textContent);
             const res = redistribuirProgressivoParcelasPagar(contasPagar, key, novoValor, totalPedido);
             if (res && res.success && Array.isArray(res.parcelas)) {
                 contasPagar = res.parcelas.map(p => ({ ...p }));
             } else {
                 contasPagar[index].valor = novoValor;
             }
        }
    }
    
    parcelaEditandoId = null;
    parcelaEditandoDisplay = '';
    renderizarContasPagar();
}

function redistribuirProgressivoParcelasPagar(parcelas, contaIdAlterada, novoValor, totalPedido) {
    try {
        const toMoney = (v) => {
            if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
            return parseCurrency(v);
        };
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
        const sorted = parcelas.map((p, i) => ({ p: { ...p }, i }))
            .sort((a, b) => {
                const da = typeof a.p.dias === 'number' ? a.p.dias : diffDaysISOConta(a.p.baseVencimento || a.p.vencimento, a.p.vencimento);
                const db = typeof b.p.dias === 'number' ? b.p.dias : diffDaysISOConta(b.p.baseVencimento || b.p.vencimento, b.p.vencimento);
                return da - db;
            });
        const idxSortedAlterada = sorted.findIndex(s => String(s.p.id) === String(contaIdAlterada));
        if (idxSortedAlterada < 0) {
            return { success: false, parcelas: [], message: 'Parcela alterada não encontrada' };
        }
        const working = sorted.map(s => ({ ...s.p, valor: toMoney(s.p.valor) }));
        if (novo > totalNum) return { success: false, parcelas: [], message: 'Valor maior que o total do pedido' };
        working[idxSortedAlterada].valor = Math.round(novo * 100) / 100;
        const sumPrev = working.slice(0, idxSortedAlterada).reduce((acc, p) => acc + toMoney(p.valor), 0);
        let restante = Math.round((totalNum - sumPrev - working[idxSortedAlterada].valor) * 100) / 100;
        if (restante < -0.009) {
            return { success: false, parcelas: [], message: 'Valores anteriores excedem o total' };
        }
        const subseqAjust = working.slice(idxSortedAlterada + 1);
        const n = subseqAjust.length;
        if (n === 0) {
            const ajuste = Math.round((totalNum - (sumPrev + working[idxSortedAlterada].valor)) * 100) / 100;
            working[idxSortedAlterada].valor = Math.max(0, Math.round((working[idxSortedAlterada].valor + ajuste) * 100) / 100);
            const merged = sorted.map((s, idx) => ({ ...working[idx] }));
            return { success: true, parcelas: reordenarParaOriginalPagar(parcelas, sorted, merged) };
        }
        const base = Math.floor((restante / n) * 100) / 100;
        let acumulado = 0;
        for (let i = 0; i < n; i++) {
            const idxG = idxSortedAlterada + 1 + i;
            let val = Math.round(base * 100) / 100;
            working[idxG].valor = val;
            acumulado += val;
        }
        const target = Math.round((totalNum - sumPrev - working[idxSortedAlterada].valor) * 100) / 100;
        const residuo = Math.round((target - acumulado) * 100) / 100;
        if (Math.abs(residuo) >= 0.01) {
            const idxLast = idxSortedAlterada + n;
            working[idxLast].valor = Math.max(0, Math.round((working[idxLast].valor + residuo) * 100) / 100);
        }
        const merged = sorted.map((s, idx) => ({ ...working[idx] }));
        return { success: true, parcelas: reordenarParaOriginalPagar(parcelas, sorted, merged) };
    } catch (_) {
        return { success: false, parcelas: [], message: 'Falha ao redistribuir' };
    }
}

function reordenarParaOriginalPagar(originalParcelas, sorted, merged) {
    const mapById = new Map();
    for (let i = 0; i < sorted.length; i++) {
        mapById.set(String(sorted[i].p.id), merged[i]);
    }
    return originalParcelas.map(p => ({ ...p, valor: (mapById.get(String(p.id))?.valor ?? p.valor) }));
}

function onParcelaDateInput(contaId, input) {
    const key = String(contaId || '');
    const timer = debounceDiasContaPagarTimers.get(key);
    if (timer) {
        clearTimeout(timer);
        debounceDiasContaPagarTimers.delete(key);
    }
    parcelaEditandoDateId = contaId;
    parcelaEditandoDateValue = input.value;
}

function atualizarVencimentoContaPagar(contaId, novaData) {
    const conta = contasPagar.find(c => String(c.id) === String(contaId));
    if (!conta || !novaData || !/^\d{4}-\d{2}-\d{2}$/.test(novaData)) return;
    conta.vencimento = novaData;
    const base = conta.baseVencimento || novaData;
    let dias = diffDaysISOConta(base, novaData);
    if (!Number.isFinite(dias) || dias < 0) dias = 0;
    conta.dias = dias;
}

function atualizarDiasContaPagar(contaId, novoDias) {
    const key = String(contaId || '');
    const oldTimer = debounceDiasContaPagarTimers.get(key);
    if (oldTimer) {
        clearTimeout(oldTimer);
        debounceDiasContaPagarTimers.delete(key);
    }
    const conta = contasPagar.find(c => String(c.id) === String(contaId));
    if (!conta) return;
    const diasInt = parseInt(novoDias, 10);
    const safeDias = isNaN(diasInt) ? 0 : diasInt;
    conta.dias = safeDias;
    const base = conta.baseVencimento || conta.vencimento;
    conta.vencimento = addDaysISO(base, safeDias);
    renderizarContasPagar();
}

function atualizarDiasContaPagarSemRender(contaId, novoDias) {
    const conta = contasPagar.find(c => String(c.id) === String(contaId));
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

function onParcelaDiasPagarInput(contaId, novoDias) {
    const key = String(contaId || '');
    if (!key) return;
    const oldTimer = debounceDiasContaPagarTimers.get(key);
    if (oldTimer) clearTimeout(oldTimer);
    const timer = setTimeout(() => {
        debounceDiasContaPagarTimers.delete(key);
        atualizarDiasContaPagarSemRender(key, novoDias);
    }, DEBOUNCE_DIAS_MS);
    debounceDiasContaPagarTimers.set(key, timer);
}

function onParcelaDateBlur(contaId, input) {
    const novaData = input.value;
    if (novaData && /^\d{4}-\d{2}-\d{2}$/.test(novaData)) {
        atualizarVencimentoContaPagar(contaId, novaData);
    }
    
    parcelaEditandoDateId = null;
    parcelaEditandoDateValue = '';
    renderizarContasPagar();
}

// ✅ Função legado mantida por compatibilidade (chamadas antigas em código inline)
window.atualizarContaPagar = function(index, campo, valor) {
    if (!contasPagar[index]) return;
    contasPagar[index][campo] = valor;
    // Não re-renderizar para 'observacao' (evita perda de foco durante digitação)
    if (campo !== 'observacao') {
        renderizarContasPagar();
    }
};

function redistribuirValoresComLocked(totalPedido) {
    if (contasPagar.length === 0) return;
    if (totalPedido <= 0) return;

    const locked = contasPagar.filter(c => c.locked);
    const unlocked = contasPagar.filter(c => !c.locked);
    if (unlocked.length === 0) return;

    const somaLocked = locked.reduce((acc, c) => acc + (typeof c.valor === 'number' ? c.valor : parseCurrency(c.valor)), 0);
    let restante = totalPedido - somaLocked;

    if (restante <= 0) {
        unlocked.forEach(c => { c.valor = 0; });
        return;
    }

    const valorParaCada = Math.max(0, restante / unlocked.length);
    let acumulado = 0;
    unlocked.forEach(c => {
        const valor = Math.round(valorParaCada * 100) / 100;
        c.valor = valor;
        acumulado += valor;
    });

    const residuo = Math.round((restante - acumulado) * 100) / 100;
    if (Math.abs(residuo) >= 0.01) {
        const ultima = unlocked[unlocked.length - 1];
        ultima.valor = Math.max(0, Math.round((ultima.valor + residuo) * 100) / 100);
    }
}

/**
 * ✅ Remoção padronizada com Vendas: busca por ID, redistribui igualmente após remover
 */
function removerConta(contaId) {
    const index = contasPagar.findIndex(c => String(c.id) === String(contaId));
    if (index === -1) return;

    contasPagar.splice(index, 1);

    // Redistribuir após remoção (igual Vendas)
    if (contasPagar.length > 0 && autoRedistribuirEnabled) {
        redistribuirValoresContasPagar();
    }
    renderizarContasPagar();
    atualizarTotalContasPagar();

    // Se todas as parcelas foram removidas, sincronizar campo Valor com Total Geral
    if (contasPagar.length === 0) {
        atualizarTotais();
    }
}

function parseDateLocalSafe(str) {
    if (window.parseDateLocal) return window.parseDateLocal(str);
    if (!str) return null;
    if (str instanceof Date) return str;
    let s = String(str).trim();
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m1) return new Date(parseInt(m1[1],10), parseInt(m1[2],10)-1, parseInt(m1[3],10));
    return new Date(s);
}

function toUTCDateConta(dateStr) {
    const [y, m, d] = String(dateStr || '').split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function diffDaysISOConta(baseStr, targetStr) {
    if (!baseStr || !targetStr) return 0;
    const base = toUTCDateConta(baseStr);
    const target = toUTCDateConta(targetStr);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((target - base) / msPerDay);
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function toValidDate(value) {
    try {
        if (value === undefined || value === null || value === '') return null;
        if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
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
            if (value['.sv'] === 'timestamp') return null;
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

function getPedidoRecencyTimestampCompra(pedido) {
    if (!pedido || typeof pedido !== 'object') return 0;
    return (
        toTimestamp(pedido.created)
        || toTimestamp(pedido.createdAt)
        || toTimestamp(pedido.updatedAt)
        || toTimestamp(pedido.updated)
        || toTimestamp(pedido.data)
        || 0
    );
}

function comparePedidosCompraByRecencyDesc(a, b) {
    const tb = getPedidoRecencyTimestampCompra(b);
    const ta = getPedidoRecencyTimestampCompra(a);
    if (tb !== ta) return tb - ta;
    const nb = parseInt(String(b && b.numero ? b.numero : ''), 10);
    const na = parseInt(String(a && a.numero ? a.numero : ''), 10);
    if (!Number.isNaN(nb) && !Number.isNaN(na) && nb !== na) return nb - na;
    const ib = String(b && b.id ? b.id : '');
    const ia = String(a && a.id ? a.id : '');
    return ib.localeCompare(ia);
}

function getRomaneioRecencyTimestampCompra(romaneio) {
    if (!romaneio || typeof romaneio !== 'object') return 0;
    const candidates = [
        romaneio?._metadata?.lastUpdated,
        romaneio.updatedAt,
        romaneio.updated,
        romaneio.lastModified,
        romaneio.dataEmissao,
        romaneio.data,
        romaneio.dataHora,
        romaneio.dataCriacao,
        romaneio.createdAt,
        romaneio.created,
        romaneio.timestamp
    ];
    for (const candidate of candidates) {
        const ts = toTimestamp(candidate);
        if (ts) return ts;
    }
    const id = String(romaneio.id || romaneio.romaneioId || romaneio.firebaseKey || romaneio.key || romaneio.numero || romaneio.numeroRomaneio || '');
    const match = id.match(/(\d{10,})/);
    return match ? Number(match[1]) || 0 : 0;
}

function compareRomaneiosCompraByRecencyDesc(a, b) {
    const tb = getRomaneioRecencyTimestampCompra(b);
    const ta = getRomaneioRecencyTimestampCompra(a);
    if (tb !== ta) return tb - ta;
    const ib = String(b && (b.numero || b.numeroRomaneio || b.id || b.firebaseKey) || '');
    const ia = String(a && (a.numero || a.numeroRomaneio || a.id || a.firebaseKey) || '');
    return ib.localeCompare(ia, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

// --- Persistência ---


// Helper para chaves de mês (YYYY-MM)
function toMonthKey(dateStr) {
    if (!dateStr) return 'no_date';
    return dateStr.substring(0, 7);
}

function getStatusLabel(status) {
    const labels = {
        'pendente': 'Pendente',
        'aprovado': 'Aprovado',
        'entregue': 'Entregue',
        'cancelado': 'Cancelado'
    };
    return labels[status] || status;
}

function getTipoContaLabel(tipo) {
    const labels = {
        'pagar': 'Pagar',
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

function getPedidoCompraRef(pedidoOuId) {
    if (pedidoOuId && typeof pedidoOuId === 'object') {
        return {
            id: String(pedidoOuId.id || pedidoOuId.firebaseKey || ''),
            numero: String(pedidoOuId.numero || pedidoOuId.pedidoNumero || '')
        };
    }
    return { id: String(pedidoOuId || ''), numero: '' };
}

function normalizePedidoCompraNumero(value) {
    return String(value || '').trim().replace(/^0+(\d)/, '$1');
}

function isContaPagarComPagamento(conta) {
    const st = String(conta && conta.status ? conta.status : '').toLowerCase();
    const pagamentos = conta && (conta.pagamentos || conta.baixas || conta.recebimentos || conta.lancamentos);
    const hasPagamento = Array.isArray(pagamentos) && pagamentos.length > 0;
    const valorOriginal = typeof (conta && conta.valorOriginal) === 'number'
        ? conta.valorOriginal
        : parseFloat((conta && conta.valorOriginal) || '');
    const valorRestante = typeof (conta && conta.valorRestante) === 'number'
        ? conta.valorRestante
        : parseFloat((conta && conta.valorRestante) || '');
    const parcial = !isNaN(valorOriginal) && !isNaN(valorRestante) && valorRestante < valorOriginal;
    return st === 'pago' || st === 'parcial' || hasPagamento || parcial;
}

function isContaPagarLike(value) {
    if (!value || typeof value !== 'object') return false;
    return value.origemId || value.pedidoNumero || value.dataVencimento || value.vencimento || value.valor !== undefined || value.valorOriginal !== undefined || value.descricao;
}

function flattenContasPagarData(data) {
    const out = [];
    const seen = new Set();
    const walk = (node, path = []) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach((item, idx) => walk(item, path.concat(String(idx))));
            return;
        }
        if (isContaPagarLike(node)) {
            const fallbackId = path.length ? path[path.length - 1] : '';
            const item = { ...node, id: node.id || node.firebaseKey || fallbackId, firebaseKey: node.firebaseKey || fallbackId };
            const key = String(item.id || `${item.origemId || ''}|${item.pedidoNumero || ''}|${item.descricao || ''}|${item.vencimento || item.dataVencimento || ''}`);
            if (!seen.has(key)) {
                seen.add(key);
                out.push(item);
            }
            return;
        }
        Object.entries(node).forEach(([key, value]) => walk(value, path.concat(String(key))));
    };
    walk(data);
    return out;
}

function contaPagarPertenceAoPedidoCompra(conta, pedidoOuId) {
    const ref = getPedidoCompraRef(pedidoOuId);
    if (!conta || typeof conta !== 'object') return false;
    const pedidoId = ref.id;
    const pedidoNumero = ref.numero;
    if (pedidoId && String(conta.origemId || '') === pedidoId) return true;
    if (pedidoId && String(conta.id || '').startsWith(`CP-${pedidoId}-`)) return true;
    if (pedidoNumero && String(conta.pedidoNumero || '') === pedidoNumero) return true;
    if (pedidoNumero) {
        const desc = String(conta.descricao || conta.observacoes || '');
        const numeroNorm = normalizePedidoCompraNumero(pedidoNumero);
        if (desc.includes(`Compra ${pedidoNumero}`) || desc.includes(`Pedido ${pedidoNumero}`)) return true;
        if (numeroNorm && (desc.includes(`Compra ${numeroNorm}`) || desc.includes(`Pedido ${numeroNorm}`))) return true;
    }
    return false;
}

async function carregarContasPagarVinculadasPedidoCompra(pedidoOuId) {
    const vinculadas = [];
    if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
        try {
            const res = await window.firebaseService.loadFromFirebase('financas/pagar');
            if (res && res.success && res.data) {
                vinculadas.push(...flattenContasPagarData(res.data).filter(c => contaPagarPertenceAoPedidoCompra(c, pedidoOuId)));
            }
        } catch (_) {}
    }
    if (vinculadas.length === 0) {
        try {
            const local = await getData('financas/pagar') || [];
            vinculadas.push(...flattenContasPagarData(local).filter(c => contaPagarPertenceAoPedidoCompra(c, pedidoOuId)));
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

function montarUpdatesRemocaoContasPagarCompra(lista) {
    const updates = {};
    (lista || []).forEach(c => {
        if (!c || !c.id) return;
        const id = String(c.id);
        const mk = toMonthKey(c.dataVencimento || c.vencimento);
        updates[`financas/pagar/${mk}/${id}`] = null;
    });
    return updates;
}

function persistirComprasCacheLocal(lista) {
    try { persistLocalValue(getCompanyKey('pedidosCompra'), lista); } catch (_) {}
    try { persistLocalValue(getCompanyKey('compras'), lista); } catch (_) {}
}

async function salvarPedido(event) {
    if (event) event.preventDefault();
    console.log('🚀 Iniciando salvamento do pedido...');
    LoadingManager.show('Salvando pedido...');
    
    try {
        const fornecedorId = document.getElementById('fornecedorSelect').value;
        const fornecedorNome = document.getElementById('fornecedorSelect').options[document.getElementById('fornecedorSelect').selectedIndex]?.text;
        
        if (!fornecedorId) {
            throw new Error('Selecione um fornecedor.');
        }
        
        if (itensPedido.length === 0) {
            throw new Error('Adicione itens ao pedido.');
        }
        
        const pedido = {
            id: pedidoEmEdicao ? pedidoEmEdicao.id : `PC-${Date.now()}`,
            numero: document.getElementById('pedidoNumero').value,
            data: document.getElementById('pedidoData').value,
            status: document.getElementById('pedidoStatus').value,
            fornecedor: { id: fornecedorId, nome: fornecedorNome },
            itens: itensPedido,
            contasPagar: contasPagar,
            subtotal: parseCurrency(document.getElementById('subtotal').textContent),
            desconto: parseCurrency(document.getElementById('desconto').value),
            total: parseCurrency(document.getElementById('totalGeral').textContent),
            updatedAt: new Date().toISOString()
        };

        const statusNext = String(pedido.status || '').toLowerCase();
        const shouldGenerateFinance = statusNext !== 'pendente' && statusNext !== 'cancelado';
        const isResumoAgrupado = Array.isArray(pedido.itens) && pedido.itens.some(i => String(i && i.tipo || '').toLowerCase() === 'romaneio_agrupado');
        pedido.bloquearGeracaoEstoque = isResumoAgrupado;
        pedido.modoResumoAgrupado = isResumoAgrupado;
        
        // Preparar objeto de atualizações atômicas (Batch Update)
        const updates = {};
        
        // 1. Adicionar atualização do pedido
        updates[`pedidosCompra/${pedido.id}`] = pedido;
        
        // 2. Gerenciar Contas a Pagar (Financeiro)
        const vinculadas = pedidoEmEdicao
            ? await carregarContasPagarVinculadasPedidoCompra({
                id: pedido.id,
                numero: pedido.numero || (pedidoEmEdicao && pedidoEmEdicao.numero) || ''
            })
            : [];
        const temPagamento = vinculadas.some(c => isContaPagarComPagamento(c));
        if (temPagamento && pedidoEmEdicao) {
            throw new Error('Este pedido possui pagamentos realizados. Cancele os pagamentos antes de salvar.');
        }

        Object.assign(updates, montarUpdatesRemocaoContasPagarCompra(vinculadas));
        
        // Adicionar novas contas
        // Usar o array global `contasPagar` que reflete o estado atual da UI (editado)
        // NÃO usar `pedido.contasPagar` se ele vier de `pedidoEmEdicao` sem atualização.
        // O objeto `pedido` criado acima (linha 846) usa `contasPagar` global: `contasPagar: contasPagar`.
        // Então `pedido.contasPagar` tem as NOVAS datas e valores.
        
        const contasParaGerar = Array.isArray(pedido.contasPagar) ? pedido.contasPagar.slice() : [];
        if (shouldGenerateFinance && contasParaGerar.length === 0 && isResumoAgrupado && Number(pedido.total || 0) > 0) {
            contasParaGerar.push({
                id: `CP-${pedido.id}-AUTO-1`,
                valor: Number(pedido.total || 0),
                vencimento: pedido.data || new Date().toISOString().split('T')[0],
                tipo: 'pagar',
                observacao: 'Parcela única (resumo agrupado por espécie)',
                status: 'pendente'
            });
        }
        pedido.contasPagar = contasParaGerar;

        if (shouldGenerateFinance && contasParaGerar.length > 0) {
            contasParaGerar.forEach((c, idx) => {
                const mk = toMonthKey(c.vencimento); // Nova chave de mês baseada na NOVA data
                // Garantir ID único e persistente
                // Se já tinha ID, mantém. Se não, gera.
                const contaId = c.id || `CP-${pedido.id}-${idx}`;
                c.id = contaId; 
                
                const conta = {
                    id: contaId,
                    tipo: 'pagar',
                    categoria: 'compras',
                    origem: 'compras',
                    origemId: pedido.id,
                    pedidoNumero: pedido.numero,
                    fornecedorId: pedido.fornecedor.id,
                    fornecedor: pedido.fornecedor.nome, 
                    fornecedorObj: pedido.fornecedor,   
                    descricao: `Compra ${pedido.numero} - ${c.observacao || getTipoContaLabel(c.tipo)}`,
                    valor: typeof c.valor === 'number' ? c.valor : parseCurrency(c.valor),
                    valorOriginal: typeof c.valor === 'number' ? c.valor : parseCurrency(c.valor),
                    valorRestante: typeof c.valor === 'number' ? c.valor : parseCurrency(c.valor), // Resetar restante ou manter se parcial?
                    // Se for edição, deveríamos manter o histórico de pagamentos?
                    // O sistema bloqueia edição se tiver pagamento (linha 1259).
                    // Então podemos resetar valorRestante = valor total, pois assume-se não pago.
                    vencimento: c.vencimento,
                    dataVencimento: c.vencimento,
                    status: c.status || 'pendente',
                    tipoPagamento: c.tipo,
                    observacoes: c.observacao || '',
                    created: new Date().toISOString(),
                    updatedAt: new Date().toISOString() // Marcar atualização
                };
                
                // Salvar no caminho particionado por mês (padrão do sistema financeiro)
                updates[`financas/pagar/${mk}/${contaId}`] = conta;
                
            });
        }
        
        // 3. Executar atualização no Firebase
        let savedToFirebase = false;
        const hasFinanceMutation = Object.keys(updates).some(k => String(k).startsWith('financas/pagar/'));
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            console.log('📦 Enviando updatePaths para Firebase:', Object.keys(updates).length, 'caminhos');
            const res = await window.firebaseService.updatePaths(updates);
            if (res && res.success) {
                savedToFirebase = true;
                console.log('✅ Pedido e financeiro salvos com sucesso via updatePaths');
            } else {
                console.warn('⚠️ updatePaths falhou no salvamento de compras:', res.error);
            }
        } else {
            console.warn('Firebase Service não disponível.');
        }

        if (!savedToFirebase && hasFinanceMutation) {
            throw new Error('Não foi possível sincronizar o financeiro do pedido de compra. Nenhuma alteração foi concluída.');
        }
        
        // 4. Atualizar cache local e fallback sem financeiro
        const nextCompras = Array.isArray(window.compras) ? window.compras.slice() : [];
        const index = nextCompras.findIndex(p => getPedidoCompraId(p) === String(pedido.id));
        if (index >= 0) {
            nextCompras[index] = pedido;
        } else {
            nextCompras.push(pedido);
        }

        if (!savedToFirebase) {
            const savedFallback = await saveData('pedidosCompra', nextCompras);
            if (!savedFallback) {
                throw new Error('Não foi possível salvar o pedido de compra no servidor.');
            }
        }

        window.compras = nextCompras;
        persistirComprasCacheLocal(window.compras);
        
        ToastManager.success('Pedido salvo com sucesso!');
        document.getElementById('pedidoForm').style.display = 'none';
        listarPedidos();
        
    } catch (e) {
        console.error(e);
        ToastManager.error(e.message);
    } finally {
        LoadingManager.hide();
    }
}




async function listarPedidos() {
    if (!guardOperationalAccessCompras()) return;
    LoadingManager.show('Carregando pedidos...');
    const tbody = document.getElementById('pedidosTable');
    pedidosSelecionados.clear();
    
    // Tentar carregar da tabela oficial 'pedidosCompra' primeiro
    let pedidosRemotos = [];
    try {
        // Usar getData para aproveitar a lógica de fallback e formatação do firebaseService
        const dados = await getData('pedidosCompra');
        if (dados && Array.isArray(dados)) {
            pedidosRemotos = dados;
        }
    } catch (e) {
        console.warn('Erro ao carregar de pedidosCompra:', e);
    }

    // Se falhar ou estiver vazio, tentar fallback local 'compras' (legado)
    if (pedidosRemotos.length > 0) {
        window.compras = pedidosRemotos;
    } else {
        // Tentar carregar legacy se pedidosCompra estiver vazio
        const legacy = await getData('compras');
        if (legacy && legacy.length > 0) {
             window.compras = legacy;
        } else {
             window.compras = window.compras || [];
        }
    }
    
    pedidosListPage = 1;
    prepararFiltrosPedidosCompras();
    renderListaPedidosCompras();
    
    document.getElementById('listaPedidosModal').style.display = 'block';
    LoadingManager.hide();
}

function prepararFiltrosPedidosCompras() {
    const fornecedorSelect = document.getElementById('filtroFornecedor');
    if (fornecedorSelect && !fornecedorSelect.dataset.bound) {
        fornecedorSelect.addEventListener('change', filtrarPedidos);
        fornecedorSelect.dataset.bound = '1';
    }
    const statusSelect = document.getElementById('filtroStatus');
    if (statusSelect && !statusSelect.dataset.bound) {
        statusSelect.addEventListener('change', filtrarPedidos);
        statusSelect.dataset.bound = '1';
    }
    const especieSelect = document.getElementById('filtroEspecie');
    if (especieSelect && !especieSelect.dataset.bound) {
        especieSelect.addEventListener('change', filtrarPedidos);
        especieSelect.dataset.bound = '1';
    }

    if (fornecedorSelect) {
        const selected = fornecedorSelect.value;
        fornecedorSelect.innerHTML = '<option value="">Todos</option>';
        const fornecedores = Array.isArray(window.fornecedores) ? window.fornecedores : [];
        fornecedores
            .slice()
            .sort((a, b) => comprasFornecedoresNome(a).localeCompare(comprasFornecedoresNome(b), 'pt-BR'))
            .forEach(f => {
                const opt = document.createElement('option');
                opt.value = String(f.id || f.nome || f.name || '');
                opt.textContent = comprasFornecedoresNome(f) || 'Fornecedor';
                fornecedorSelect.appendChild(opt);
            });
        if (selected) fornecedorSelect.value = selected;
    }

    if (especieSelect && especieSelect.options.length <= 1) {
        const set = new Set();
        (Array.isArray(window.compras) ? window.compras : []).forEach(p => {
            (Array.isArray(p.itens) ? p.itens : []).forEach(it => {
                const nome = String(it.especie || it.especieNome || it.produtoNome || it.produto || '').trim();
                if (nome) set.add(nome);
            });
        });
        Array.from(set).sort((a,b)=>a.localeCompare(b)).forEach(n => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.textContent = n;
            especieSelect.appendChild(opt);
        });
    }
}

function aplicarFiltrosPedidosCompras() {
    const termo = (document.getElementById('searchPedidos')?.value || '').toLowerCase();
    const filtroFornecedor = (document.getElementById('filtroFornecedor')?.value || '').trim();
    const filtroStatus = (document.getElementById('filtroStatus')?.value || '').trim();
    const filtroEspecie = (document.getElementById('filtroEspecie')?.value || '').trim().toLowerCase();
    const inicioVal = (document.getElementById('filtroInicio')?.value || '').trim();
    const fimVal = (document.getElementById('filtroFim')?.value || '').trim();
    const inicioDate = inicioVal ? new Date(inicioVal + 'T00:00:00') : null;
    const fimDate = fimVal ? new Date(fimVal + 'T23:59:59') : null;

    const base = Array.isArray(window.compras) ? window.compras : [];
    const byNumero = new Map();
    for (const p of base) {
        const key = String((p && p.numero) || '');
        if (!byNumero.has(key)) {
            byNumero.set(key, p);
        } else {
            const current = byNumero.get(key);
            const currentTs = getPedidoRecencyTimestampCompra(current);
            const incomingTs = getPedidoRecencyTimestampCompra(p);
            if (incomingTs >= currentTs) byNumero.set(key, p);
        }
    }
    let lista = Array.from(byNumero.values());
    lista = lista.filter(p => {
        if (termo) {
            const fornecedorNome = (p.fornecedor?.nome || p.fornecedor?.name || '').toLowerCase();
            const st = String(p.status || '').toLowerCase();
            const num = String(p.numero || '').toLowerCase();
            const matchTermo = num.includes(termo) || fornecedorNome.includes(termo) || st.includes(termo);
            if (!matchTermo) return false;
        }
        if (filtroFornecedor) {
            const fid = String(p.fornecedor?.id || p.fornecedorId || '');
            const fname = String(p.fornecedor?.nome || p.fornecedor?.name || '');
            if (fid !== filtroFornecedor && fname !== filtroFornecedor) return false;
        }
        if (filtroStatus) {
            if (String(p.status || '') !== filtroStatus) return false;
        }
        if (inicioDate || fimDate) {
            const d = toValidDate(p.data);
            if (!d) return false;
            if (inicioDate && d < inicioDate) return false;
            if (fimDate && d > fimDate) return false;
        }
        if (filtroEspecie) {
            const itens = Array.isArray(p.itens) ? p.itens : [];
            const found = itens.some(it => {
                const nome = String(it.especie || it.especieNome || it.produtoNome || it.produto || '').toLowerCase();
                return nome && nome.includes(filtroEspecie);
            });
            if (!found) return false;
        }
        return true;
    });

    lista.sort(comparePedidosCompraByRecencyDesc);
    return lista;
}

function renderListaPedidosCompras() {
    const tbody = document.getElementById('pedidosTable');
    if (!tbody) return;
    pedidosListFiltered = aplicarFiltrosPedidosCompras();
    pedidosSelecionados = new Set(Array.from(pedidosSelecionados).filter(id =>
        pedidosListFiltered.some(p => getPedidoCompraId(p) === String(id))
    ));

    if (pedidosListFiltered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" data-label="Mensagem" class="commerce-full-row" style="text-align: center;">Nenhum pedido encontrado</td></tr>';
        atualizarCabecalhoSelecaoPedidos();
        renderPedidosPagination(0);
        refreshCommerceResponsiveTables();
        return;
    }

    const totalPages = Math.max(1, Math.ceil(pedidosListFiltered.length / pedidosListItemsPerPage));
    if (pedidosListPage > totalPages) pedidosListPage = totalPages;
    if (pedidosListPage < 1) pedidosListPage = 1;
    const start = (pedidosListPage - 1) * pedidosListItemsPerPage;
    const end = start + pedidosListItemsPerPage;
    const paginated = pedidosListFiltered.slice(start, end);

    tbody.innerHTML = '';
    paginated.forEach(p => {
        const tr = document.createElement('tr');
        const atualizadoEm = (toValidDate(p.updatedAt) || toValidDate(p.updated)) ? (toValidDate(p.updatedAt) || toValidDate(p.updated)).toLocaleDateString('pt-BR') : '-';
        const status = String(p.status || 'pendente');
        const safeId = escapeJsString(p.id || p.firebaseKey || '');
        tr.innerHTML = `
            <td data-label="Número">
                <label class="pedido-numero-cell">
                    <input type="checkbox" class="pedido-select-item" ${pedidosSelecionados.has(getPedidoCompraId(p)) ? 'checked' : ''} onchange="toggleSelecionarPedido('${safeId}', this.checked)">
                    <span class="commerce-card-value commerce-card-number">${escapeHtml(p.numero || '-')}</span>
                </label>
            </td>
            <td data-label="Data"><span class="commerce-card-value commerce-card-number">${escapeHtml(formatDate(p.data))}</span></td>
            <td data-label="Fornecedor"><span class="commerce-card-value commerce-card-title">${escapeHtml(p.fornecedor?.nome || p.fornecedor?.name || '-')}</span></td>
            <td data-label="Total"><span class="commerce-card-value commerce-card-money">${escapeHtml(formatCurrency(getPedidoCompraTotal(p)))}</span></td>
            <td data-label="Status"><span class="commerce-card-value"><span class="status-badge status-${escapeHtml(status)}">${escapeHtml(getStatusLabel(status))}</span></span></td>
            <td data-label="Atualizado" class="atualizado-cell"><span class="commerce-card-value commerce-card-number">${escapeHtml(atualizadoEm)}</span></td>
            <td data-label="Ações" class="acoes-cell">
                <div class="acoes-buttons commerce-actions-wrap">
                    <button type="button" onclick="editarPedido('${safeId}')" class="btn-primary btn-small" title="Editar" aria-label="Editar pedido"><i class="fas fa-edit"></i></button>
                    <button type="button" onclick="visualizarPedido('${safeId}')" class="btn-primary btn-small" title="Visualizar" aria-label="Visualizar pedido"><i class="fas fa-eye"></i></button>
                    <button type="button" onclick="excluirPedido('${safeId}')" class="btn-danger btn-small" title="Excluir" aria-label="Excluir pedido"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

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
    const selecionados = pedidosListFiltered.filter(p => pedidosSelecionados.has(getPedidoCompraId(p))).length;
    chk.checked = selecionados === total;
    chk.indeterminate = selecionados > 0 && selecionados < total;
    atualizarContadorImpressaoPedidos();
}

function atualizarContadorImpressaoPedidos() {
    const countEl = document.getElementById('pedidosPrintSelectedCount');
    if (!countEl) return;
    const printBtn = countEl.closest('button');
    const selecionados = pedidosListFiltered.filter(p => pedidosSelecionados.has(getPedidoCompraId(p))).length;
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
        pedidosListFiltered.forEach(p => pedidosSelecionados.add(getPedidoCompraId(p)));
    } else {
        pedidosListFiltered.forEach(p => pedidosSelecionados.delete(getPedidoCompraId(p)));
    }
    renderListaPedidosCompras();
}

function getPedidoCompraId(pedido) {
    return String(pedido && (pedido.id || pedido.firebaseKey || '') || '');
}

function getPedidosCompraSelecionadosParaImpressao() {
    return pedidosListFiltered.filter(p => pedidosSelecionados.has(getPedidoCompraId(p)));
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
        return !!(standalone || smallTouchScreen);
    } catch (_) {
        return window.navigator.standalone === true;
    }
}

function notificarEntregaPdfPedido(result) {
    if (!result || result.mode === 'cancelled') return;
    const msg = result.mode === 'share'
        ? 'PDF pronto para compartilhar ou imprimir pelo aparelho.'
        : `PDF gerado: ${result.fileName}`;
    ToastManager.success(msg);
}

async function exportarPedidosCompraPdf(pedidosParaImprimir) {
    if (!window.SiswebCommercePdf || typeof window.SiswebCommercePdf.exportOrdersPdf !== 'function') {
        throw new Error('Gerador de PDF indisponivel.');
    }
    const pedidos = Array.isArray(pedidosParaImprimir) ? pedidosParaImprimir.filter(Boolean) : [];
    if (!pedidos.length) throw new Error('Nenhum pedido selecionado para PDF.');

    const dadosEmpresa = await obterDadosEmpresa();
    const pedidoUnico = pedidos.length === 1 ? pedidos[0] : null;
    const fileBase = pedidoUnico
        ? `pedido-compra-${pedidoUnico.numero || getPedidoCompraId(pedidoUnico) || 'selecionado'}`
        : `pedidos-compra-${pedidos.length}`;

    return window.SiswebCommercePdf.exportOrdersPdf({
        company: dadosEmpresa,
        orders: pedidos,
        documentTitle: pedidoUnico ? 'Pedido de Compra' : 'Pedidos de Compra',
        orderTitle: 'Pedido de Compra',
        partyLabel: 'Fornecedor',
        paymentTitle: 'Forma de pagamento',
        fileName: `${fileBase}.pdf`,
        shareText: 'PDF de pedido de compra gerado pelo Sisweb.',
        formatDate,
        formatCurrency,
        formatNumber,
        getStatusLabel,
        getPaymentTypeLabel: getTipoContaLabel,
        getPartyName: (pedido) => pedido.fornecedor
            ? (pedido.fornecedor.nome || pedido.fornecedor.name || 'Fornecedor nao informado')
            : 'Fornecedor nao informado',
        getPayments: (pedido) => pedido.contasPagar || [],
        getSubtotal: (pedido) => pedido.subtotal,
        getDiscount: (pedido) => pedido.desconto,
        getTotal: (pedido) => typeof getPedidoCompraTotal === 'function'
            ? getPedidoCompraTotal(pedido)
            : pedido.total
    });
}

async function imprimirPedidosSelecionados() {
    const pedidosParaImprimir = getPedidosCompraSelecionadosParaImpressao();
    if (pedidosParaImprimir.length === 0) {
        ToastManager.warning('Selecione ao menos um pedido para imprimir.');
        return;
    }
    try {
        if (isCommercePwaPrintContext()) {
            LoadingManager.show('Gerando PDF dos pedidos...');
            const result = await exportarPedidosCompraPdf(pedidosParaImprimir);
            notificarEntregaPdfPedido(result);
            return;
        }

        await imprimirPedidosCompraSelecionadosDesktop(pedidosParaImprimir);
    } catch (error) {
        console.error('Erro ao imprimir pedidos selecionados:', error);
        ToastManager.error('Erro ao imprimir: ' + error.message);
    } finally {
        LoadingManager.hide();
    }
}

async function imprimirPedidosCompraSelecionadosDesktop(pedidosParaImprimir) {
    const pedidos = Array.isArray(pedidosParaImprimir) ? pedidosParaImprimir.filter(Boolean) : [];
    if (!pedidos.length) return;

    if (pedidos.length === 1) {
        await imprimirPedido(getPedidoCompraId(pedidos[0]));
        return;
    }

    LoadingManager.show('Preparando impressão...');
    const documentos = [];
    for (const pedido of pedidos) {
        documentos.push(await gerarHTMLImpressaoPedidoCompra(pedido));
    }
    const html = montarHTMLImpressaoLotePedidos(documentos, 'Pedidos de Compra');
    if (window.SiswebCommercePdf && typeof window.SiswebCommercePdf.printHtmlDocument === 'function') {
        window.SiswebCommercePdf.printHtmlDocument({
            html,
            windowFeatures: 'width=900,height=700'
        });
    } else {
        const janela = window.open('', '_blank', 'width=900,height=700');
        if (janela) {
            janela.document.write(html);
            janela.document.close();
            janela.onload = function() {
                setTimeout(() => janela.print(), 250);
            };
        } else {
            window.print();
        }
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
    <style>${styles}
        .sisweb-print-batch-page { break-after: page; page-break-after: always; margin-bottom: 18px; }
    </style>
</head>
<body class="sisweb-commerce-print">
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

function goToPedidosPage(page) {
    const totalPages = Math.max(1, Math.ceil(pedidosListFiltered.length / pedidosListItemsPerPage));
    const next = Math.min(totalPages, Math.max(1, Number(page) || 1));
    if (next === pedidosListPage) return;
    pedidosListPage = next;
    renderListaPedidosCompras();
}

// --- Funções de Visualização e Impressão (Novas) ---

async function visualizarPedido(id) {
    const pedido = window.compras.find(p => getPedidoCompraId(p) === String(id));
    if (!pedido) return;
    
    window.pedidoVisualizando = id;
    
    // Preencher dados do cabeçalho
    document.getElementById('viewPedidoNumero').textContent = pedido.numero || '-';
    document.getElementById('viewPedidoData').textContent = formatDate(pedido.data);

    const status = String(pedido.status || 'pendente');
    const statusLabel = getStatusLabel(status);
    document.getElementById('viewPedidoStatus').innerHTML =
        `<span class="status-badge status-${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>`;

    const fornecedor = pedido.fornecedor || {};
    document.getElementById('viewPedidoFornecedor').textContent = fornecedor.nome || fornecedor.name || 'Fornecedor não informado';
    const fornecedorDetalhes = [
        fornecedor.documento || fornecedor.document || fornecedor.cnpj || fornecedor.cpf,
        fornecedor.telefone || fornecedor.phone,
        fornecedor.email,
        [fornecedor.cidade || fornecedor.city, fornecedor.estado || fornecedor.uf].filter(Boolean).join(' / ')
    ].filter(Boolean).join(' • ');
    const fornecedorDetalhesEl = document.getElementById('viewPedidoFornecedorDetalhes');
    if (fornecedorDetalhesEl) fornecedorDetalhesEl.textContent = fornecedorDetalhes;
    
    // Tabela de Itens
    const tbodyItens = document.getElementById('viewPedidoItensTable');
    const itensVisualizacao = Array.isArray(pedido.itens) ? pedido.itens : [];
    if (itensVisualizacao.length > 0) {
        tbodyItens.innerHTML = itensVisualizacao.map(item => `
            <tr>
                <td data-label="Produto"><span class="commerce-card-value commerce-card-title">${escapeHtml(item.produtoNome || item.produto || item.nome || '-')}</span></td>
                <td data-label="Quantidade"><span class="commerce-card-value commerce-card-number">${escapeHtml(formatNumber(item.quantidade))} ${escapeHtml(item.unidade || '')}</span></td>
                <td data-label="Preço Unit."><span class="commerce-card-value commerce-card-money">${escapeHtml(formatCurrency(item.precoUnitario))}</span></td>
                <td data-label="Total"><span class="commerce-card-value commerce-card-money commerce-card-strong">${escapeHtml(formatCurrency(item.total))}</span></td>
            </tr>
        `).join('');
    } else {
        tbodyItens.innerHTML = '<tr><td colspan="4" data-label="Mensagem" class="commerce-full-row" style="text-align: center;">Sem itens no pedido</td></tr>';
    }
    
    // Totais
    document.getElementById('viewPedidoSubtotal').textContent = formatCurrency(pedido.subtotal);
    document.getElementById('viewPedidoDesconto').textContent = formatCurrency(pedido.desconto);
    document.getElementById('viewPedidoTotal').textContent = formatCurrency(pedido.total);
    const viewTotalQtdEl = document.getElementById('viewPedidoTotalQtd');
    if (viewTotalQtdEl) viewTotalQtdEl.textContent = formatNumber(getPedidoCompraTotalQuantidade(pedido), 3);
    
    // Contas a Pagar
    const tbodyPagamento = document.getElementById('viewPedidoPagamentoTable');
    let contas = pedido.contasPagar || [];
    
    // Tentar carregar financeiro se não estiver no objeto
    if (contas.length === 0) {
        try {
            const cpFinanceiroAll = await getData('financas/pagar') || [];
            contas = cpFinanceiroAll.filter(c => String(c.origemId) === String(id));
        } catch (_) {}
    }
    
    if (contas.length > 0) {
        tbodyPagamento.innerHTML = contas.map(conta => `
            <tr>
                <td data-label="Valor"><span class="commerce-card-value commerce-card-money">${escapeHtml(formatCurrency(typeof conta.valor === 'number' ? conta.valor : parseCurrency(conta.valor)))}</span></td>
                <td data-label="Vencimento"><span class="commerce-card-value commerce-card-number">${escapeHtml(formatDate(conta.vencimento))}</span></td>
                <td data-label="Tipo"><span class="commerce-card-value">${escapeHtml(getTipoContaLabel(conta.tipo || conta.tipoPagamento))}</span></td>
                <td data-label="Observação"><span class="commerce-card-value">${escapeHtml(conta.observacao || conta.descricao || '-')}</span></td>
                <td data-label="Status"><span class="commerce-card-value"><span class="status-badge status-${escapeHtml(conta.status || 'pendente')}">${escapeHtml(getStatusLabel(conta.status || 'pendente'))}</span></span></td>
            </tr>
        `).join('');
    } else {
        tbodyPagamento.innerHTML = '<tr><td colspan="5" data-label="Mensagem" class="commerce-full-row" style="text-align: center;">Sem informações de pagamento</td></tr>';
    }

    const createdEl = document.getElementById('viewPedidoCreated');
    const updatedEl = document.getElementById('viewPedidoUpdated');
    const updatedContainer = document.getElementById('viewPedidoUpdatedContainer');
    const createdDate = toValidDate(pedido.createdAt || pedido.created || pedido.data);
    const updatedDate = toValidDate(pedido.updatedAt || pedido.updated);
    if (createdEl) createdEl.textContent = createdDate ? createdDate.toLocaleString('pt-BR') : '-';
    if (updatedEl) updatedEl.textContent = updatedDate ? updatedDate.toLocaleString('pt-BR') : '-';
    if (updatedContainer) updatedContainer.style.display = updatedDate ? 'block' : 'none';
    
    document.getElementById('visualizarPedidoModal').style.display = 'block';
    refreshCommerceResponsiveTables();
}

function prepararRelatoriosCompras() {
    carregarEstadoColunasRelatorioCompras();
    const fornecedorEl = document.getElementById('relFornecedor');
    if (fornecedorEl) {
        const selected = fornecedorEl.value;
        fornecedorEl.innerHTML = '<option value="">Todos</option>';
        const fornecedores = Array.isArray(window.fornecedores) ? window.fornecedores : [];
        fornecedores
            .slice()
            .sort((a, b) => String(a.nome || a.name || '').localeCompare(String(b.nome || b.name || ''), 'pt-BR'))
            .forEach((fornecedor) => {
                const opt = document.createElement('option');
                opt.value = String(fornecedor.id || fornecedor.nome || fornecedor.name || '');
                opt.textContent = fornecedor.nome || fornecedor.name || 'Fornecedor';
                fornecedorEl.appendChild(opt);
            });
        if (selected) fornecedorEl.value = selected;
    }
    aplicarColunasRelatorioCompras();
}

function carregarEstadoColunasRelatorioCompras() {
    try {
        const raw = localStorage.getItem(getCompanyKey('relatorioComprasColunasVisiveis'));
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) return;
        const allowed = new Set(comprasRelatorioColunasPadrao.map(c => c.key));
        comprasRelatorioColunasVisiveis = new Set(parsed.filter(key => allowed.has(key)));
        if (comprasRelatorioColunasVisiveis.size === 0) {
            comprasRelatorioColunasVisiveis = new Set(comprasRelatorioColunasPadrao.map(c => c.key));
        }
    } catch (_) {}
}

function salvarEstadoColunasRelatorioCompras() {
    try {
        localStorage.setItem(
            getCompanyKey('relatorioComprasColunasVisiveis'),
            JSON.stringify(Array.from(comprasRelatorioColunasVisiveis))
        );
    } catch (_) {}
}

async function carregarPedidosComprasParaRelatorio() {
    let pedidos = Array.isArray(window.compras) ? window.compras.slice() : [];
    if (pedidos.length === 0) {
        pedidos = await getData('pedidosCompra') || [];
        if (!Array.isArray(pedidos) || pedidos.length === 0) {
            pedidos = await getData('compras') || [];
        }
        window.compras = Array.isArray(pedidos) ? pedidos : [];
    }

    const byId = new Map();
    (Array.isArray(window.compras) ? window.compras : []).forEach((pedido) => {
        if (!pedido || typeof pedido !== 'object') return;
        const key = String(pedido.id || pedido.firebaseKey || pedido.numero || '');
        if (!key) return;
        const current = byId.get(key);
        if (!current || getPedidoRecencyTimestampCompra(pedido) >= getPedidoRecencyTimestampCompra(current)) {
            byId.set(key, pedido);
        }
    });
    return Array.from(byId.values()).sort(comparePedidosCompraByRecencyDesc);
}

function filtrarPedidosRelatorioCompras(pedidos) {
    const inicioVal = String(document.getElementById('periodoInicio')?.value || '').trim();
    const fimVal = String(document.getElementById('periodoFim')?.value || '').trim();
    const fornecedorFiltro = String(document.getElementById('relFornecedor')?.value || '').trim();
    const statusFiltro = String(document.getElementById('relStatus')?.value || '').trim();
    const inicioDate = inicioVal ? new Date(`${inicioVal}T00:00:00`) : null;
    const fimDate = fimVal ? new Date(`${fimVal}T23:59:59`) : null;

    return (Array.isArray(pedidos) ? pedidos : []).filter((pedido) => {
        if (!pedido || typeof pedido !== 'object') return false;
        if (inicioDate || fimDate) {
            const dataPedido = toValidDate(pedido.data || pedido.createdAt || pedido.created);
            if (!dataPedido) return false;
            if (inicioDate && dataPedido < inicioDate) return false;
            if (fimDate && dataPedido > fimDate) return false;
        }
        if (fornecedorFiltro) {
            const fornecedorId = String(pedido.fornecedor?.id || pedido.fornecedorId || '');
            const fornecedorNome = String(pedido.fornecedor?.nome || pedido.fornecedor?.name || '');
            if (fornecedorId !== fornecedorFiltro && fornecedorNome !== fornecedorFiltro) return false;
        }
        if (statusFiltro && String(pedido.status || '') !== statusFiltro) return false;
        return true;
    });
}

function getItemEspecieCompra(item) {
    const raw = item && (item.especie || item.especieNome || item.produtoNome || item.produto || item.nome);
    const value = String(raw || '').trim();
    return value || 'Sem espécie/produto';
}

function getItemVolumeCompra(item) {
    if (!item || typeof item !== 'object') return 0;
    const candidates = [item.volume, item.volumeTotal, item.totalVolume, item.m3, item.totalM3];
    for (const candidate of candidates) {
        const n = Number(typeof candidate === 'string' ? candidate.replace(',', '.') : candidate);
        if (Number.isFinite(n) && n > 0) return n;
    }
    const unidade = String(item.unidade || '').toLowerCase();
    if (unidade.includes('m3') || unidade.includes('m³') || unidade.includes('metro')) {
        return Number(item.quantidade || 0) || 0;
    }
    return 0;
}

function getPedidoCompraVolumeTotal(pedido) {
    return (Array.isArray(pedido?.itens) ? pedido.itens : []).reduce((total, item) => total + getItemVolumeCompra(item), 0);
}

function getPedidoCompraTotal(pedido) {
    return typeof pedido?.total === 'number' ? pedido.total : parseCurrency(pedido?.total);
}

function getPedidoCompraTotalQuantidade(pedido) {
    return (Array.isArray(pedido?.itens) ? pedido.itens : []).reduce((total, item) => total + (Number(item.quantidade || 0) || 0), 0);
}

function atualizarResumoRelatorioCompras(pedidos) {
    const totalPedidos = pedidos.length;
    const valorTotal = pedidos.reduce((total, pedido) => total + getPedidoCompraTotal(pedido), 0);
    const totalVolume = pedidos.reduce((total, pedido) => total + getPedidoCompraVolumeTotal(pedido), 0);
    const precoMedioM3 = totalVolume > 0 ? valorTotal / totalVolume : 0;

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };
    setText('relTotalPedidos', String(totalPedidos));
    setText('relValorTotal', formatCurrency(valorTotal));
    setText('relPrecoMedioM3', formatCurrency(precoMedioM3));
    setText('relComprasFooterTotalPedidos', String(totalPedidos));
    setText('relComprasFooterTotalCarrego', formatNumber(totalVolume, 3));
    setText('relComprasFooterValorTotal', formatCurrency(valorTotal));
}

function renderRelatorioComprasPedidos(pedidos) {
    comprasRelatorioModoAtual = 'pedidos';
    comprasRelatorioAtual = pedidos.slice();

    const tabelaAgrupada = document.getElementById('relComprasTabela');
    const tabelaPedidos = document.getElementById('relComprasPedidos');
    const tbody = document.getElementById('relComprasPedidosTableBody');
    if (tabelaAgrupada) {
        tabelaAgrupada.innerHTML = '';
        tabelaAgrupada.style.display = 'none';
    }
    if (tabelaPedidos) tabelaPedidos.style.display = 'block';
    if (!tbody) return;

    if (pedidos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" data-label="Mensagem" class="commerce-full-row" style="text-align:center;">Nenhum pedido encontrado para os filtros informados.</td></tr>';
        aplicarColunasRelatorioCompras();
        refreshCommerceResponsiveTables();
        return;
    }

    tbody.innerHTML = pedidos.map((pedido) => {
        const id = escapeJsString(pedido.id || pedido.firebaseKey || '');
        const fornecedor = pedido.fornecedor?.nome || pedido.fornecedor?.name || 'Fornecedor não informado';
        const status = String(pedido.status || 'pendente');
        return `
            <tr>
                <td data-col="numero" data-label="Número"><span class="commerce-card-value commerce-card-number">${escapeHtml(pedido.numero || '-')}</span></td>
                <td data-col="data" data-label="Data"><span class="commerce-card-value commerce-card-number">${escapeHtml(formatDate(pedido.data))}</span></td>
                <td data-col="fornecedor" data-label="Fornecedor"><span class="commerce-card-value commerce-card-title">${escapeHtml(fornecedor)}</span></td>
                <td data-col="total" data-label="Total" style="text-align:right;"><span class="commerce-card-value commerce-card-money">${escapeHtml(formatCurrency(getPedidoCompraTotal(pedido)))}</span></td>
                <td data-col="status" data-label="Status"><span class="status-badge status-${escapeHtml(status)}">${escapeHtml(getStatusLabel(status))}</span></td>
                <td data-col="acoes" data-label="Ações" class="acoes-cell">
                    <div class="acoes-buttons commerce-actions-wrap">
                        <button type="button" onclick="visualizarPedido('${id}')" class="btn-primary btn-small" title="Visualizar" aria-label="Visualizar"><i class="fas fa-eye"></i></button>
                        <button type="button" onclick="imprimirPedido('${id}')" class="btn-primary btn-small" title="Imprimir" aria-label="Imprimir"><i class="fas fa-print"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    aplicarColunasRelatorioCompras();
    refreshCommerceResponsiveTables();
}

function agruparPedidosRelatorioCompras(pedidos, agrupamento) {
    const grupos = new Map();
    const addGrupo = (key, label, pedido, item = null) => {
        if (!grupos.has(key)) {
            grupos.set(key, { grupo: label, pedidos: new Set(), quantidade: 0, volume: 0, valorTotal: 0 });
        }
        const row = grupos.get(key);
        row.pedidos.add(String(pedido.id || pedido.numero || ''));
        row.quantidade += item ? (Number(item.quantidade || 0) || 0) : getPedidoCompraTotalQuantidade(pedido);
        row.volume += item ? getItemVolumeCompra(item) : getPedidoCompraVolumeTotal(pedido);
        row.valorTotal += item ? (Number(item.total || 0) || 0) : getPedidoCompraTotal(pedido);
    };

    pedidos.forEach((pedido) => {
        const fornecedorNome = pedido.fornecedor?.nome || pedido.fornecedor?.name || 'Fornecedor não informado';
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        if (agrupamento === 'fornecedor') {
            addGrupo(`fornecedor:${fornecedorNome}`, fornecedorNome, pedido);
            return;
        }
        if (agrupamento === 'especie') {
            if (itens.length === 0) addGrupo('especie:sem-itens', 'Sem itens', pedido);
            itens.forEach((item) => addGrupo(`especie:${getItemEspecieCompra(item)}`, getItemEspecieCompra(item), pedido, item));
            return;
        }
        if (agrupamento === 'fornecedor_especie') {
            if (itens.length === 0) addGrupo(`fornecedor_especie:${fornecedorNome}:sem-itens`, `${fornecedorNome} / Sem itens`, pedido);
            itens.forEach((item) => {
                const especie = getItemEspecieCompra(item);
                addGrupo(`fornecedor_especie:${fornecedorNome}:${especie}`, `${fornecedorNome} / ${especie}`, pedido, item);
            });
        }
    });

    return Array.from(grupos.values())
        .map(row => ({ ...row, totalPedidos: row.pedidos.size }))
        .sort((a, b) => b.valorTotal - a.valorTotal || a.grupo.localeCompare(b.grupo, 'pt-BR'));
}

function renderRelatorioComprasAgrupado(pedidos, agrupamento) {
    comprasRelatorioModoAtual = 'agrupado';
    const rows = agruparPedidosRelatorioCompras(pedidos, agrupamento);
    comprasRelatorioAtual = rows;

    const tabelaPedidos = document.getElementById('relComprasPedidos');
    const tabelaAgrupada = document.getElementById('relComprasTabela');
    if (tabelaPedidos) tabelaPedidos.style.display = 'none';
    if (!tabelaAgrupada) return;
    tabelaAgrupada.style.display = 'block';

    if (rows.length === 0) {
        tabelaAgrupada.innerHTML = `
            <table class="table commerce-report-table" id="relComprasAgrupadoTable">
                <tbody>
                    <tr><td colspan="6" data-label="Mensagem" class="commerce-full-row" style="text-align:center;">Nenhum dado encontrado para os filtros informados.</td></tr>
                </tbody>
            </table>
        `;
        refreshCommerceResponsiveTables();
        return;
    }

    tabelaAgrupada.innerHTML = `
        <table class="table commerce-report-table" id="relComprasAgrupadoTable">
            <thead>
                <tr>
                    <th>Grupo</th>
                    <th>Pedidos</th>
                    <th>Quantidade</th>
                    <th>Volume (m³)</th>
                    <th>Valor Total</th>
                    <th>Preço Médio/m³</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map((row) => {
                    const precoMedio = row.volume > 0 ? row.valorTotal / row.volume : 0;
                    return `
                        <tr>
                            <td data-label="Grupo">${escapeHtml(row.grupo)}</td>
                            <td data-label="Pedidos" style="text-align:center;"><span class="commerce-card-value commerce-card-number">${escapeHtml(row.totalPedidos)}</span></td>
                            <td data-label="Quantidade" style="text-align:right;"><span class="commerce-card-value commerce-card-number">${escapeHtml(formatNumber(row.quantidade, 3))}</span></td>
                            <td data-label="Volume (m³)" style="text-align:right;"><span class="commerce-card-value commerce-card-number">${escapeHtml(formatNumber(row.volume, 3))}</span></td>
                            <td data-label="Valor Total" style="text-align:right;"><span class="commerce-card-value commerce-card-money">${escapeHtml(formatCurrency(row.valorTotal))}</span></td>
                            <td data-label="Preço Médio/m³" style="text-align:right;"><span class="commerce-card-value commerce-card-money">${escapeHtml(formatCurrency(precoMedio))}</span></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
    refreshCommerceResponsiveTables();
}

async function gerarRelatorioCompras() {
    LoadingManager.show('Gerando relatório de compras...');
    try {
        prepararRelatoriosCompras();
        const pedidos = await carregarPedidosComprasParaRelatorio();
        const filtrados = filtrarPedidosRelatorioCompras(pedidos);
        const result = document.getElementById('relatorioResult');
        if (result) result.style.display = 'block';
        atualizarResumoRelatorioCompras(filtrados);

        const agrupamento = String(document.getElementById('relAgrupamento')?.value || 'nenhum');
        if (agrupamento === 'nenhum') {
            renderRelatorioComprasPedidos(filtrados);
        } else {
            renderRelatorioComprasAgrupado(filtrados, agrupamento);
        }
    } catch (error) {
        console.error('Erro ao gerar relatório de compras:', error);
        ToastManager.error('Erro ao gerar relatório de compras.');
    } finally {
        LoadingManager.hide();
    }
}

function csvCell(value) {
    const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
    return `"${text.replace(/"/g, '""')}"`;
}

function baixarArquivoTexto(nomeArquivo, conteudo, tipo = 'text/csv;charset=utf-8;') {
    const blob = new Blob([conteudo], { type: tipo });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function exportarRelatorioComprasCSV() {
    try {
        if (!comprasRelatorioAtual.length) {
            ToastManager.warning('Gere o relatório antes de exportar.');
            return;
        }
        let headers;
        let rows;
        if (comprasRelatorioModoAtual === 'agrupado') {
            headers = ['Grupo', 'Pedidos', 'Quantidade', 'Volume (m3)', 'Valor Total', 'Preco Medio m3'];
            rows = comprasRelatorioAtual.map((row) => [
                row.grupo,
                row.totalPedidos,
                formatNumber(row.quantidade, 3),
                formatNumber(row.volume, 3),
                formatCurrency(row.valorTotal),
                formatCurrency(row.volume > 0 ? row.valorTotal / row.volume : 0)
            ]);
        } else {
            headers = ['Numero', 'Data', 'Fornecedor', 'Total', 'Status'];
            rows = comprasRelatorioAtual.map((pedido) => [
                pedido.numero || '',
                formatDate(pedido.data),
                pedido.fornecedor?.nome || pedido.fornecedor?.name || '',
                formatCurrency(getPedidoCompraTotal(pedido)),
                getStatusLabel(pedido.status || '')
            ]);
        }
        const csv = [headers.map(csvCell).join(';'), ...rows.map(row => row.map(csvCell).join(';'))].join('\n');
        baixarArquivoTexto(`relatorio_compras_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    } catch (error) {
        console.error('Erro ao exportar relatório de compras:', error);
        ToastManager.error('Erro ao exportar CSV.');
    }
}

function exportarRelatorioComprasPDF() {
    return (async () => {
    try {
        const result = document.getElementById('relatorioResult');
        if (!result || result.style.display === 'none') {
            ToastManager.warning('Gere o relatório antes de exportar.');
            return;
        }
        LoadingManager.show('Preparando relatório...');
        const dadosEmpresa = await obterDadosEmpresa();
        const helper = window.SiswebCommercePdf;
        const inicioVal = String(document.getElementById('periodoInicio')?.value || '').trim();
        const fimVal = String(document.getElementById('periodoFim')?.value || '').trim();
        const periodoLabel = inicioVal || fimVal
            ? `Periodo: ${inicioVal ? formatDate(inicioVal) : 'inicio'} a ${fimVal ? formatDate(fimVal) : 'fim'}`
            : 'Periodo: todos';
        const fornecedorSelect = document.getElementById('relFornecedor');
        const statusSelect = document.getElementById('relStatus');
        const agrupamentoSelect = document.getElementById('relAgrupamento');
        const metaRows = [
            periodoLabel,
            fornecedorSelect?.value ? `Fornecedor: ${fornecedorSelect.options[fornecedorSelect.selectedIndex]?.text || fornecedorSelect.value}` : '',
            statusSelect?.value ? `Status: ${statusSelect.options[statusSelect.selectedIndex]?.text || statusSelect.value}` : '',
            agrupamentoSelect?.value && agrupamentoSelect.value !== 'nenhum' ? `Agrupamento: ${agrupamentoSelect.options[agrupamentoSelect.selectedIndex]?.text || agrupamentoSelect.value}` : ''
        ].filter(Boolean);
        const clone = result.cloneNode(true);
        clone.querySelectorAll('h3, button, input, .action-buttons, .acoes-buttons, .no-print, [data-col="acoes"]').forEach((node) => node.remove());
        clone.querySelectorAll('.table-responsive').forEach((node) => {
            node.style.overflow = 'visible';
            node.style.maxHeight = 'none';
        });
        clone.querySelectorAll('table').forEach((table) => {
            table.classList.add('sisweb-print-table', 'commerce-print-report-table');
        });
        const bodyHtml = `
            <section class="sisweb-print-section">
                <h2 class="sisweb-print-section-title">Resumo e dados</h2>
                ${clone.innerHTML}
            </section>
        `;

        if (helper && typeof helper.printHtmlDocument === 'function') {
            const printOptions = {
                title: 'Relatório de Compras',
                company: dadosEmpresa,
                badgeText: 'Compras',
                subtitle: periodoLabel,
                metaRows,
                bodyHtml,
                compact: comprasRelatorioAtual.length > 18,
                extraCss: `
                    .commerce-print-report-table th,
                    .commerce-print-report-table td { font-size: 9.8px; }
                    .summary-box { max-width: 330px; margin-left: auto; }
                    .summary-box .summary-row span:last-child { font-weight: 800; color: #1f2937; }
                `
            };
            const preparedOptions = typeof helper.preparePrintOptions === 'function'
                ? await helper.preparePrintOptions(printOptions)
                : printOptions;
            helper.printHtmlDocument(preparedOptions);
            return;
        }

        const printWindow = window.open('', '_blank', 'width=1100,height=800');
        if (!printWindow) {
            window.print();
            return;
        }
        printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Compras</title><style>body{font-family:Arial,sans-serif;color:#1f2937;padding:24px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #d1d5db;padding:8px;font-size:12px}th{background:#2c3e50;color:#fff}.summary-box{margin:12px 0;border:1px solid #d1d5db;padding:10px}.summary-row{display:flex;justify-content:space-between;margin:4px 0}</style></head><body><h1>Relatório de Compras</h1>${bodyHtml}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    } catch (error) {
        console.error('Erro ao exportar PDF de compras:', error);
        ToastManager.error('Erro ao exportar PDF.');
    } finally {
        LoadingManager.hide();
    }
    })();
}

function aplicarColunasRelatorioCompras() {
    const table = document.getElementById('relComprasPedidosTable');
    if (!table) return;
    table.querySelectorAll('[data-col]').forEach((cell) => {
        const key = cell.getAttribute('data-col');
        const visible = comprasRelatorioColunasVisiveis.has(key);
        cell.style.display = visible ? '' : 'none';
    });
}

function abrirCustomizarColunasCompras() {
    carregarEstadoColunasRelatorioCompras();
    const list = document.getElementById('comprasPrintColumnsList');
    if (list) {
        list.innerHTML = comprasRelatorioColunasPadrao.map((coluna) => `
            <label class="columns-item">
                <span>${escapeHtml(coluna.label)}</span>
                <span>
                    <input type="checkbox" data-col="${escapeHtml(coluna.key)}" ${comprasRelatorioColunasVisiveis.has(coluna.key) ? 'checked' : ''}>
                </span>
            </label>
        `).join('');
    }
    const modal = document.getElementById('customizarColunasComprasModal');
    if (modal) modal.style.display = 'block';
}

function aplicarCustomizacaoColunasCompras() {
    const checks = document.querySelectorAll('#comprasPrintColumnsList input[type="checkbox"][data-col]');
    const selected = Array.from(checks).filter(input => input.checked).map(input => input.dataset.col);
    comprasRelatorioColunasVisiveis = new Set(selected.length ? selected : comprasRelatorioColunasPadrao.map(c => c.key));
    salvarEstadoColunasRelatorioCompras();
    aplicarColunasRelatorioCompras();
    fecharModal('customizarColunasComprasModal');
    ToastManager.success('Colunas do relatório atualizadas.');
}

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
                if (raw) companyData = { ...companyData, ...(JSON.parse(raw) || {}) };
            } catch (_) {}
        }

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
    } catch (e) {
        console.warn('Erro ao obter dados empresa:', e);
        return {};
    }
}

async function gerarHTMLImpressaoPedidoCompra(pedido) {
    const dadosEmpresa = await obterDadosEmpresa();
    const helper = window.SiswebCommercePdf || {};
    const htmlEscape = typeof helper.escapeHtml === 'function'
        ? helper.escapeHtml
        : escapeHtml;
    const fornecedor = pedido.fornecedor || {};
    const fornecedorNome = fornecedor.nome || fornecedor.name || 'Fornecedor não informado';
    const fornecedorDetalhes = [
        fornecedor.email ? `<p><strong>Email:</strong> ${htmlEscape(fornecedor.email)}</p>` : '',
        fornecedor.telefone ? `<p><strong>Telefone:</strong> ${htmlEscape(fornecedor.telefone)}</p>` : '',
        fornecedor.endereco ? `<p><strong>Endereço:</strong> ${htmlEscape(fornecedor.endereco)}</p>` : ''
    ].filter(Boolean).join('') || '<p><strong>Contato:</strong> -</p>';
    const itensHtml = (pedido.itens || []).map((item, idx) => {
        const produto = item.produtoCodigo
            ? `${item.produtoCodigo} - ${item.produtoNome || item.produto || item.nome || item.descricao || ''}`
            : (item.produtoNome || item.produto || item.nome || item.descricao || 'Produto não informado');
        const quantidade = `${formatNumber(item.quantidade || 0)}${item.unidade ? ` ${item.unidade}` : ''}`;
        return `
            <tr>
                <td class="text-center" style="width: 38px;">${idx + 1}</td>
                <td>${htmlEscape(produto)}</td>
                <td class="text-center" style="width: 100px;">${htmlEscape(quantidade)}</td>
                <td class="text-right" style="width: 110px;">${htmlEscape(formatCurrency(item.precoUnitario || item.preco || 0))}</td>
                <td class="text-right" style="width: 110px;"><strong>${htmlEscape(formatCurrency(item.total || 0))}</strong></td>
            </tr>
        `;
    }).join('');
    const contasHtml = (pedido.contasPagar || []).length > 0
        ? (pedido.contasPagar || []).map(c => `
            <tr>
                <td>${htmlEscape(formatDate(c.vencimento || c.dataVencimento))}</td>
                <td>${htmlEscape(getTipoContaLabel(c.tipo || c.tipoPagamento))}</td>
                <td>${htmlEscape(c.observacao || c.observacoes || '-')}</td>
                <td class="text-right">${htmlEscape(formatCurrency(typeof c.valor === 'number' ? c.valor : parseCurrency(c.valor)))}</td>
            </tr>
        `).join('')
        : '<tr><td colspan="4" class="text-center">Sem informações de pagamento</td></tr>';
    const totalPedido = typeof getPedidoCompraTotal === 'function' ? getPedidoCompraTotal(pedido) : pedido.total;
    const bodyHtml = `
        <section class="sisweb-print-info-grid">
            <div class="sisweb-print-info-box">
                <h3>Dados do pedido</h3>
                <p><strong>Número:</strong> ${htmlEscape(pedido.numero || '-')}</p>
                <p><strong>Data:</strong> ${htmlEscape(formatDate(pedido.data))}</p>
                <p><strong>Status:</strong> ${htmlEscape(getStatusLabel(pedido.status))}</p>
                <p><strong>Emissão:</strong> ${htmlEscape(new Date().toLocaleDateString('pt-BR'))} ${htmlEscape(new Date().toLocaleTimeString('pt-BR'))}</p>
            </div>
            <div class="sisweb-print-info-box">
                <h3>Dados do fornecedor</h3>
                <p><strong>Nome:</strong> ${htmlEscape(fornecedorNome)}</p>
                ${fornecedorDetalhes}
            </div>
        </section>

        <section class="sisweb-print-section">
            <h2 class="sisweb-print-section-title">Itens do pedido</h2>
            <table class="sisweb-print-table">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 38px;">#</th>
                        <th>Produto</th>
                        <th class="text-center" style="width: 100px;">Qtd</th>
                        <th class="text-right" style="width: 110px;">Preço Unit.</th>
                        <th class="text-right" style="width: 110px;">Total</th>
                    </tr>
                </thead>
                <tbody>${itensHtml || '<tr><td colspan="5" class="text-center">Nenhum item informado.</td></tr>'}</tbody>
            </table>
        </section>

        <section class="sisweb-print-section">
            <div class="sisweb-print-totals">
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
                    <span>${htmlEscape(formatCurrency(totalPedido || 0))}</span>
                </div>
            </div>
        </section>

        <section class="sisweb-print-section">
            <h2 class="sisweb-print-section-title">Forma de pagamento</h2>
            <table class="sisweb-print-table">
                <thead>
                    <tr>
                        <th>Vencimento</th>
                        <th>Tipo</th>
                        <th>Observação</th>
                        <th class="text-right">Valor</th>
                    </tr>
                </thead>
                <tbody>${contasHtml}</tbody>
            </table>
        </section>
    `;

    if (typeof helper.buildPrintDocument === 'function') {
        const printOptions = {
            title: `Pedido de Compra Nº ${pedido.numero || '-'}`,
            company: dadosEmpresa,
            badgeText: 'Compras',
            subtitle: `Emitido em ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}`,
            documentNumber: pedido.numero || '',
            bodyHtml,
            compact: ((pedido.itens || []).length + Math.max(0, (pedido.contasPagar || []).length - 3)) > 20
        };
        const preparedOptions = typeof helper.preparePrintOptions === 'function'
            ? await helper.preparePrintOptions(printOptions)
            : printOptions;
        return helper.buildPrintDocument(preparedOptions);
    }

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido de Compra ${htmlEscape(pedido.numero || '')}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111827}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d6dde8;padding:8px}th{background:#2c3e50;color:#fff}.text-right{text-align:right}.text-center{text-align:center}</style></head><body>${bodyHtml}</body></html>`;
}

async function imprimirPedido(pedidoId) {
    const pedido = window.compras.find(p => String(p.id || p.firebaseKey) === String(pedidoId));
    if (!pedido) return;
    
    LoadingManager.show('Preparando impressão...');
    
    try {
        if (isCommercePwaPrintContext() && window.SiswebCommercePdf) {
            const result = await exportarPedidosCompraPdf([pedido]);
            notificarEntregaPdfPedido(result);
            return;
        }

        const dadosEmpresa = await obterDadosEmpresa();
        const helper = window.SiswebCommercePdf || {};
        const htmlEscape = typeof helper.escapeHtml === 'function'
            ? helper.escapeHtml
            : escapeHtml;
        const fornecedor = pedido.fornecedor || {};
        const fornecedorNome = fornecedor.nome || fornecedor.name || 'Fornecedor não informado';
        const fornecedorDetalhes = [
            fornecedor.email ? `<p><strong>Email:</strong> ${htmlEscape(fornecedor.email)}</p>` : '',
            fornecedor.telefone ? `<p><strong>Telefone:</strong> ${htmlEscape(fornecedor.telefone)}</p>` : '',
            fornecedor.endereco ? `<p><strong>Endereço:</strong> ${htmlEscape(fornecedor.endereco)}</p>` : ''
        ].filter(Boolean).join('') || '<p><strong>Contato:</strong> -</p>';
        const itensHtml = (pedido.itens || []).map((item, idx) => {
            const produto = item.produtoCodigo
                ? `${item.produtoCodigo} - ${item.produtoNome || item.produto || item.nome || item.descricao || ''}`
                : (item.produtoNome || item.produto || item.nome || item.descricao || 'Produto não informado');
            const quantidade = `${formatNumber(item.quantidade || 0)}${item.unidade ? ` ${item.unidade}` : ''}`;
            return `
                <tr>
                    <td class="text-center" style="width: 38px;">${idx + 1}</td>
                    <td>${htmlEscape(produto)}</td>
                    <td class="text-center" style="width: 100px;">${htmlEscape(quantidade)}</td>
                    <td class="text-right" style="width: 110px;">${htmlEscape(formatCurrency(item.precoUnitario || item.preco || 0))}</td>
                    <td class="text-right" style="width: 110px;"><strong>${htmlEscape(formatCurrency(item.total || 0))}</strong></td>
                </tr>
            `;
        }).join('');
        const contasHtml = (pedido.contasPagar || []).length > 0
            ? (pedido.contasPagar || []).map(c => `
                <tr>
                    <td>${htmlEscape(formatDate(c.vencimento || c.dataVencimento))}</td>
                    <td>${htmlEscape(getTipoContaLabel(c.tipo || c.tipoPagamento))}</td>
                    <td>${htmlEscape(c.observacao || c.observacoes || '-')}</td>
                    <td class="text-right">${htmlEscape(formatCurrency(typeof c.valor === 'number' ? c.valor : parseCurrency(c.valor)))}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="4" class="text-center">Sem informações de pagamento</td></tr>';
        const totalPedido = typeof getPedidoCompraTotal === 'function' ? getPedidoCompraTotal(pedido) : pedido.total;
        const bodyHtml = `
            <section class="sisweb-print-info-grid">
                <div class="sisweb-print-info-box">
                    <h3>Dados do pedido</h3>
                    <p><strong>Número:</strong> ${htmlEscape(pedido.numero || '-')}</p>
                    <p><strong>Data:</strong> ${htmlEscape(formatDate(pedido.data))}</p>
                    <p><strong>Status:</strong> ${htmlEscape(getStatusLabel(pedido.status))}</p>
                    <p><strong>Emissão:</strong> ${htmlEscape(new Date().toLocaleDateString('pt-BR'))} ${htmlEscape(new Date().toLocaleTimeString('pt-BR'))}</p>
                </div>
                <div class="sisweb-print-info-box">
                    <h3>Dados do fornecedor</h3>
                    <p><strong>Nome:</strong> ${htmlEscape(fornecedorNome)}</p>
                    ${fornecedorDetalhes}
                </div>
            </section>

            <section class="sisweb-print-section">
                <h2 class="sisweb-print-section-title">Itens do pedido</h2>
                <table class="sisweb-print-table">
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 38px;">#</th>
                            <th>Produto</th>
                            <th class="text-center" style="width: 100px;">Qtd</th>
                            <th class="text-right" style="width: 110px;">Preço Unit.</th>
                            <th class="text-right" style="width: 110px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>${itensHtml || '<tr><td colspan="5" class="text-center">Nenhum item informado.</td></tr>'}</tbody>
                </table>
            </section>

            <section class="sisweb-print-section">
                <div class="sisweb-print-totals">
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
                        <span>${htmlEscape(formatCurrency(totalPedido || 0))}</span>
                    </div>
                </div>
            </section>

            <section class="sisweb-print-section">
                <h2 class="sisweb-print-section-title">Forma de pagamento</h2>
                <table class="sisweb-print-table">
                    <thead>
                        <tr>
                            <th>Vencimento</th>
                            <th>Tipo</th>
                            <th>Observação</th>
                            <th class="text-right">Valor</th>
                        </tr>
                    </thead>
                    <tbody>${contasHtml}</tbody>
                </table>
            </section>
        `;

        if (typeof helper.printHtmlDocument === 'function') {
            const printOptions = {
                title: `Pedido de Compra Nº ${pedido.numero || '-'}`,
                company: dadosEmpresa,
                badgeText: 'Compras',
                subtitle: `Emitido em ${new Date().toLocaleDateString('pt-BR')} as ${new Date().toLocaleTimeString('pt-BR')}`,
                documentNumber: pedido.numero || '',
                bodyHtml,
                compact: ((pedido.itens || []).length + Math.max(0, (pedido.contasPagar || []).length - 3)) > 20,
                windowFeatures: 'width=900,height=700'
            };
            const preparedOptions = typeof helper.preparePrintOptions === 'function'
                ? await helper.preparePrintOptions(printOptions)
                : printOptions;
            helper.printHtmlDocument(preparedOptions);
        } else {
            const janelaImpressao = window.open('', '_blank', 'width=800,height=600');
            const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido de Compra ${htmlEscape(pedido.numero || '')}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111827}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d6dde8;padding:8px}th{background:#2c3e50;color:#fff}.text-right{text-align:right}.text-center{text-align:center}</style></head><body>${bodyHtml}</body></html>`;
            if (janelaImpressao) {
                janelaImpressao.document.write(html);
                janelaImpressao.document.close();
                janelaImpressao.onload = function() {
                    janelaImpressao.print();
                };
            } else {
                window.print();
            }
        }
    } catch (e) {
        console.error(e);
        ToastManager.error('Erro ao imprimir pedido.');
    } finally {
        LoadingManager.hide();
    }
}

async function editarPedido(id) {
    const pedido = window.compras.find(p => getPedidoCompraId(p) === String(id));
    if (!pedido) return;
    
    // Verificar se existem pagamentos realizados
    LoadingManager.show('Verificando pagamentos...');
    try {
        const vinculadas = await carregarContasPagarVinculadasPedidoCompra(pedido);
        const temPagamento = vinculadas.some(c => isContaPagarComPagamento(c));
        
        if (temPagamento) {
            ToastManager.warning('Este pedido possui pagamentos realizados. Cancele os pagamentos antes de editar.');
            LoadingManager.hide();
            return;
        }
    } catch (e) {
        console.warn('Erro ao verificar pagamentos:', e);
    } finally {
         LoadingManager.hide();
     }
     
     novoPedido(false); // Reseta UI e limpa formulário primeiro (sem gerar número)
     
     itensPedido = [...(pedido.itens || [])];
     autoRedistribuirEnabled = false; // ✅ Ao editar, não redistribuir automaticamente (igual Vendas)
     
     // ✅ Carregar contas a pagar (do objeto ou buscar no financeiro se vazio)
     if (pedido.contasPagar && pedido.contasPagar.length > 0) {
         contasPagar = pedido.contasPagar.map(c => ({
             ...c,
             baseVencimento: c.baseVencimento || c.vencimento, // Garantir baseVencimento
             dias: typeof c.dias === 'number' ? c.dias : diffDaysISOConta(c.baseVencimento || c.vencimento, c.vencimento),
             locked: false
         }));
     } else {
         try {
             const contasAll = await getData('financas/pagar') || [];
             contasPagar = contasAll
                 .filter(c => String(c.origemId) === String(id))
                 .map(c => ({
                     id: c.id,
                     valor: typeof c.valor === 'number' ? c.valor : parseCurrency(c.valor),
                     vencimento: c.vencimento || c.dataVencimento,
                     baseVencimento: c.vencimento || c.dataVencimento,
                     dias: 0,
                     tipo: c.tipoPagamento || c.tipo,
                     observacao: c.observacoes || c.observacao || '',
                     status: c.status || 'pendente',
                     locked: false
                 }));
         } catch (_) {
             contasPagar = [];
         }
     }
     
     // ✅ Deep clone do pedido original para referência de remoção de contas antigas
     try {
        pedidoEmEdicao = JSON.parse(JSON.stringify(pedido));
        if (pedidoEmEdicao && (!pedidoEmEdicao.contasPagar || pedidoEmEdicao.contasPagar.length === 0) && contasPagar.length > 0) {
            pedidoEmEdicao.contasPagar = JSON.parse(JSON.stringify(contasPagar));
        }
     } catch(e) {
        pedidoEmEdicao = { ...pedido };
     }
     
     // Preencher campos do formulário
     document.getElementById('pedidoNumero').value = pedido.numero;
     document.getElementById('pedidoData').value = pedido.data;
     document.getElementById('pedidoStatus').value = pedido.status;
     
     // ✅ Resetar campos de forma de pagamento (igual Vendas)
     document.getElementById('contaValor').value = '';
     const hoje = new Date().toISOString().split('T')[0];
     document.getElementById('contaVencimento').value = hoje;
     document.getElementById('contaTipo').value = 'pagar';
     document.getElementById('contaObservacao').value = '';
     document.getElementById('numeroParcelas').value = '';
     
     // Garantir fornecedor no select
     const fornId = pedido.fornecedor?.id;
     if (fornId) {
         const select = document.getElementById('fornecedorSelect');
         if (![...select.options].some(o => o.value === fornId)) {
             const opt = document.createElement('option');
             opt.value = fornId;
             opt.textContent = pedido.fornecedor.nome;
             select.appendChild(opt);
         }
         select.value = fornId;
     }
     
     document.getElementById('desconto').value = formatCurrency(pedido.desconto);
     
     renderizarItensPedido();
     renderizarContasPagar();
     atualizarTotais();
     
     document.getElementById('listaPedidosModal').style.display = 'none';
}

async function excluirPedido(id) {
    if (!confirm('Excluir este pedido? Ação irreversível.')) return;
    
    LoadingManager.show('Excluindo pedido...');
    
    try {
        // Verificar pagamentos antes de excluir
        const pedido = window.compras.find(p => getPedidoCompraId(p) === String(id));
        const vinculadas = await carregarContasPagarVinculadasPedidoCompra(pedido || id);
        const temPagamento = vinculadas.some(c => isContaPagarComPagamento(c));
        
        if (temPagamento) {
            throw new Error('Não é possível excluir: existem pagamentos realizados vinculados a este pedido.');
        }
        
        // Preparar atualizações atômicas
        const updates = {};
        
        // 1. Remover Pedido
        updates[`pedidosCompra/${id}`] = null;
        
        // 2. Remover Contas a Pagar
        Object.assign(updates, montarUpdatesRemocaoContasPagarCompra(vinculadas));
        
        // 3. Executar no Firebase
        let savedToFirebase = false;
        const hasFinanceMutation = Object.keys(updates).some(k => String(k).startsWith('financas/pagar/'));
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const res = await window.firebaseService.updatePaths(updates);
            savedToFirebase = !!(res && res.success);
        }

        if (!savedToFirebase && hasFinanceMutation) {
            throw new Error('Não foi possível remover o financeiro vinculado ao pedido de compra. Nenhuma alteração foi concluída.');
        }
        
        // 5. Atualizar Local
        const nextCompras = (window.compras || []).filter(p => getPedidoCompraId(p) !== String(id));
        if (!savedToFirebase) {
            const savedFallback = await saveData('pedidosCompra', nextCompras);
            if (!savedFallback) {
                throw new Error('Não foi possível excluir o pedido de compra no servidor.');
            }
        }
        window.compras = nextCompras;
        persistirComprasCacheLocal(window.compras);
        
        ToastManager.success('Pedido excluído.');
        listarPedidos();
        
    } catch (e) {
        console.error(e);
        ToastManager.error(e.message);
    } finally {
        LoadingManager.hide();
    }
}

// ============================================================================
// 5. GERENCIAMENTO DE FORNECEDORES
// ============================================================================

function comprasFornecedoresNome(fornecedor) {
    return String((fornecedor && (fornecedor.nome || fornecedor.name || fornecedor.razaoSocial || fornecedor.nomeFantasia)) || '').trim();
}

function comprasFornecedoresDocumento(fornecedor) {
    return String((fornecedor && (fornecedor.documento || fornecedor.document || fornecedor.cnpj || fornecedor.cpf)) || '').trim();
}

function comprasFornecedoresTelefone(fornecedor) {
    return String((fornecedor && (fornecedor.telefone || fornecedor.phone || fornecedor.celular || fornecedor.whatsapp)) || '').trim();
}

function comprasFornecedoresTexto(...values) {
    for (const value of values) {
        const clean = String(value || '').trim();
        if (clean) return clean;
    }
    return '';
}

function comprasFornecedoresCampo(id) {
    return String(document.getElementById(id)?.value || '').trim();
}

function comprasFornecedoresGerarId(fornecedor, index = 0) {
    const seed = comprasFornecedoresDocumento(fornecedor) || comprasFornecedoresNome(fornecedor) || `fornecedor-${index}`;
    const slug = String(seed)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 44);
    return `FOR-${slug || Date.now()}`;
}

function comprasFornecedoresNormalizar(fornecedor, index = 0) {
    const data = fornecedor && typeof fornecedor === 'object' ? fornecedor : {};
    const nome = comprasFornecedoresNome(data);
    const documento = comprasFornecedoresDocumento(data);
    const telefone = comprasFornecedoresTelefone(data);
    const email = String(data.email || '').trim();
    const endereco = String(data.endereco || data.address || '').trim();
    const numero = String(data.numero || data.number || '').trim();
    const bairro = String(data.bairro || data.neighborhood || '').trim();
    const complemento = comprasFornecedoresTexto(data.complemento, data.complement);
    const estado = String(data.estado || data.state || '').trim().slice(0, 2).toUpperCase();
    const cidade = String(data.cidade || data.city || '').trim();
    const obs = String(data.obs || data.observacoes || data.observations || '').trim();
    const tipoPessoa = comprasFornecedoresTexto(data.tipoPessoa, data.personType, data.fiscalPersonType);
    const indIEDest = comprasFornecedoresTexto(data.indIEDest, data.indicadorInscricaoEstadual, data.ieIndicator);
    const inscricaoEstadual = comprasFornecedoresTexto(data.inscricaoEstadual, data.stateRegistration, data.ie);
    const inscricaoMunicipal = comprasFornecedoresTexto(data.inscricaoMunicipal, data.municipalRegistration, data.im);
    const suframa = comprasFornecedoresTexto(data.suframa, data.SUFRAMA);
    const cep = comprasFornecedoresTexto(data.cep, data.postalCode, data.zipCode);
    const codigoMunicipio = comprasFornecedoresTexto(data.codigoMunicipio, data.municipioCodigo, data.municipalityCode, data.cMun, data.ibgeCode);
    const paisCodigo = comprasFornecedoresTexto(data.paisCodigo, data.countryCode, data.cPais) || '1058';
    const pais = comprasFornecedoresTexto(data.pais, data.country, data.countryName, data.xPais) || 'Brasil';
    const id = String(data.id || data.firebaseKey || data.codigo || '').trim();

    return {
        ...data,
        id: id || comprasFornecedoresGerarId(data, index),
        nome,
        name: data.name || nome,
        documento,
        document: data.document || documento,
        cnpj: data.cnpj || documento,
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
        telefone,
        phone: data.phone || telefone,
        email,
        endereco,
        address: data.address || endereco,
        numero,
        number: data.number || numero,
        bairro,
        neighborhood: data.neighborhood || bairro,
        complemento,
        complement: complemento,
        estado,
        state: data.state || estado,
        cidade,
        city: data.city || cidade,
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
        obs,
        observacoes: data.observacoes || obs,
        observations: data.observations || obs
    };
}

function comprasFornecedoresNormalizarLista(lista) {
    const byKey = new Map();
    (Array.isArray(lista) ? lista : []).forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        const fornecedor = comprasFornecedoresNormalizar(item, index);
        const nome = comprasFornecedoresNome(fornecedor);
        if (!nome) return;
        const id = String(fornecedor.id || '').trim();
        const documento = comprasFornecedoresDocumento(fornecedor).replace(/\D/g, '');
        const key = id ? `id:${id}` : documento ? `doc:${documento}` : `name:${nome.toLowerCase()}`;
        if (!byKey.has(key)) byKey.set(key, fornecedor);
    });
    return Array.from(byKey.values())
        .sort((a, b) => comprasFornecedoresNome(a).localeCompare(comprasFornecedoresNome(b), 'pt-BR'));
}

async function comprasFornecedoresCarregarDados() {
    const lista = await getData('fornecedores') || [];
    return comprasFornecedoresNormalizarLista(lista);
}

function comprasFornecedoresGetService() {
    return {
        getFornecedores: comprasFornecedoresCarregarDados,
        saveFornecedor: async (fornecedor) => {
            const normalized = comprasFornecedoresNormalizar(fornecedor);
            const id = String(normalized.id || '').trim() || `FOR-${Date.now()}`;
            normalized.id = id;
            const current = comprasFornecedoresNormalizarLista(window.fornecedores);
            const index = current.findIndex((item) => String(item.id || '') === id);
            const next = current.slice();
            if (index >= 0) next[index] = normalized;
            else next.push(normalized);
            const ordered = comprasFornecedoresNormalizarLista(next);
            const saved = await saveData('fornecedores', ordered);
            if (!saved) throw new Error('Não foi possível salvar o fornecedor no servidor.');
            window.fornecedores = ordered;
            return normalized;
        },
        deleteFornecedor: async (id) => {
            const fornecedorId = String(id || '').trim();
            const next = comprasFornecedoresNormalizarLista(window.fornecedores)
                .filter((item) => String(item.id || '') !== fornecedorId);
            const saved = await saveData('fornecedores', next);
            if (!saved) throw new Error('Não foi possível excluir o fornecedor no servidor.');
            window.fornecedores = next;
            return true;
        }
    };
}

function comprasFornecedoresMostrarEstado(message, icon = 'fa-circle-info') {
    const tbody = document.getElementById('comprasFornecedoresTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td class="purchase-suppliers-empty" colspan="5"><i class="fas ${icon}"></i> ${escapeHtml(message)}</td>
            </tr>
        `;
    }
}

function comprasFornecedoresAtualizarResumo(lista) {
    const fornecedores = Array.isArray(lista) ? lista : [];
    const documentados = fornecedores.filter((fornecedor) => comprasFornecedoresDocumento(fornecedor)).length;
    const contatos = fornecedores.filter((fornecedor) => comprasFornecedoresTelefone(fornecedor) || fornecedor.email).length;
    const cidades = new Set(fornecedores.map((fornecedor) => String(fornecedor.city || fornecedor.cidade || '').trim()).filter(Boolean));
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };
    setText('comprasFornecedoresTotal', fornecedores.length);
    setText('comprasFornecedoresDocumentados', documentados);
    setText('comprasFornecedoresContatos', contatos);
    setText('comprasFornecedoresCidades', cidades.size);
}

async function carregarFornecedores() {
    const service = comprasFornecedoresGetService();
    window.fornecedores = await service.getFornecedores(false);
    atualizarSelectFornecedores();
    prepararFiltrosPedidosCompras();
    prepararRelatoriosCompras();
    renderizarFornecedoresCompra();
    return window.fornecedores;
}

function atualizarSelectFornecedores(selectedId = null) {
    const select = document.getElementById('fornecedorSelect');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '<option value="">Selecione um fornecedor</option>';
    
    comprasFornecedoresNormalizarLista(window.fornecedores).forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = comprasFornecedoresNome(f) || 'Sem Nome';
        opt.dataset.documento = comprasFornecedoresDocumento(f);
        opt.dataset.email = String(f.email || '');
        opt.dataset.cidade = String(f.cidade || f.city || '');
        select.appendChild(opt);
    });
    
    if (selectedId) select.value = selectedId;
    else if (currentVal) select.value = currentVal;
}

function filtrarFornecedoresSelect() {
    try {
        const select = document.getElementById('fornecedorSelect');
        const buscaInput = document.getElementById('fornecedorBusca');
        if (!select || !buscaInput) return;

        const busca = String(buscaInput.value || '').trim().toLowerCase();
        Array.from(select.options).forEach((opt) => {
            if (!opt.value) {
                opt.hidden = false;
                opt.style.display = '';
                return;
            }
            const haystack = [
                opt.textContent,
                opt.dataset.documento,
                opt.dataset.email,
                opt.dataset.cidade
            ].join(' ').toLowerCase();
            const match = !busca || haystack.includes(busca);
            opt.hidden = !match;
            opt.style.display = match ? '' : 'none';
        });
    } catch (error) {
        console.warn('Falha ao filtrar fornecedores:', error);
    }
}

async function carregarFornecedoresAbaCompra(forceRefresh = false) {
    const activePanel = document.getElementById('clientes');
    if (window.__siswebComprasOperationalReady !== true) {
        comprasFornecedoresAtualizarResumo([]);
        comprasFornecedoresMostrarEstado('Empresa da sessão não identificada. Faça login novamente para carregar fornecedores.', 'fa-lock');
        return [];
    }
    comprasFornecedoresMostrarEstado('Carregando fornecedores...', 'fa-spinner');
    try {
        const service = comprasFornecedoresGetService();
        window.fornecedores = await service.getFornecedores(forceRefresh);
        atualizarSelectFornecedores();
        prepararFiltrosPedidosCompras();
        prepararRelatoriosCompras();
        renderizarFornecedoresCompra();
        if (activePanel && activePanel.classList.contains('active') && forceRefresh) {
            ToastManager.success('Fornecedores atualizados.', 'Fornecedores', 1800);
        }
        return window.fornecedores;
    } catch (error) {
        console.error('Erro ao carregar fornecedores na aba de compras:', error);
        comprasFornecedoresMostrarEstado('Erro ao carregar fornecedores. Verifique a sessão e tente novamente.', 'fa-triangle-exclamation');
        ToastManager.error('Erro ao carregar fornecedores: ' + (error && error.message ? error.message : error), 'Fornecedores');
        return [];
    }
}

function renderizarFornecedoresCompra() {
    const tbody = document.getElementById('comprasFornecedoresTableBody');
    if (!tbody) return;
    const source = comprasFornecedoresNormalizarLista(window.fornecedores);
    window.fornecedores = source;
    comprasFornecedoresAtualizarResumo(source);
    const busca = String(document.getElementById('comprasFornecedoresBusca')?.value || '').trim().toLowerCase();
    comprasFornecedoresFiltered = source.filter((fornecedor) => {
        if (!busca) return true;
        const haystack = [
            comprasFornecedoresNome(fornecedor),
            comprasFornecedoresDocumento(fornecedor),
            comprasFornecedoresTelefone(fornecedor),
            fornecedor.email,
            fornecedor.cidade,
            fornecedor.city,
            fornecedor.estado,
            fornecedor.state,
            fornecedor.bairro,
            fornecedor.neighborhood
        ].map((value) => String(value || '').toLowerCase()).join(' ');
        return haystack.includes(busca);
    });

    if (comprasFornecedoresFiltered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td class="purchase-suppliers-empty" colspan="5">Nenhum fornecedor encontrado.</td>
            </tr>
        `;
        refreshCommerceResponsiveTables();
        return;
    }

    tbody.innerHTML = comprasFornecedoresFiltered.map((fornecedor) => {
        const id = String(fornecedor.id || '').trim();
        const encodedId = escapeHtml(encodeURIComponent(id).replace(/'/g, '%27'));
        const nome = escapeHtml(comprasFornecedoresNome(fornecedor) || 'Sem nome');
        const email = escapeHtml(fornecedor.email || '');
        const documento = escapeHtml(comprasFornecedoresDocumento(fornecedor) || '-');
        const telefone = escapeHtml(comprasFornecedoresTelefone(fornecedor) || '-');
        const cidadeUf = [fornecedor.city || fornecedor.cidade, fornecedor.state || fornecedor.estado].filter(Boolean).join(' / ') || '-';
        const endereco = [fornecedor.address || fornecedor.endereco, fornecedor.number || fornecedor.numero, fornecedor.neighborhood || fornecedor.bairro].filter(Boolean).join(', ');
        return `
            <tr>
                <td data-label="Fornecedor" class="purchase-suppliers-name-cell">
                    <strong>${nome}</strong>
                    ${email ? `<small>${email}</small>` : ''}
                </td>
                <td data-label="Documento">${documento}</td>
                <td data-label="Contato">${telefone}</td>
                <td data-label="Localização">
                    <span>${escapeHtml(cidadeUf)}</span>
                    ${endereco ? `<small style="display:block;color:#64748b;margin-top:3px;">${escapeHtml(endereco)}</small>` : ''}
                </td>
                <td data-label="Ações" class="purchase-suppliers-actions-cell commerce-actions-cell">
                    <div class="commerce-actions-wrap">
                        <button type="button" class="btn-primary btn-small" onclick="comprasFornecedoresEditar(decodeURIComponent('${encodedId}'))" title="Editar fornecedor" aria-label="Editar fornecedor">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn-danger btn-small" onclick="comprasFornecedoresExcluir(decodeURIComponent('${encodedId}'))" title="Excluir fornecedor" aria-label="Excluir fornecedor">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    refreshCommerceResponsiveTables();
}

async function comprasFornecedoresCarregarCidades(uf, selectedCity = '') {
    const citySelect = document.getElementById('comprasFornecedorCity');
    if (!citySelect) return;
    const cleanUf = String(uf || '').trim().slice(0, 2).toUpperCase();
    if (!cleanUf) {
        citySelect.innerHTML = '<option value="">Selecione primeiro o estado</option>';
        return;
    }
    try {
        if (typeof window.loadCities === 'function') {
            await Promise.resolve(window.loadCities(cleanUf, 'comprasFornecedorCity'));
        } else if (typeof window.populateCitySelect === 'function') {
            await Promise.resolve(window.populateCitySelect(cleanUf, 'comprasFornecedorCity'));
        }
    } catch (error) {
        console.warn('Falha ao carregar cidades para fornecedor de compras:', error);
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

function comprasFornecedoresPreencherForm(fornecedor = null) {
    const data = fornecedor || {};
    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };
    const title = document.getElementById('comprasFornecedorFormTitle');
    if (title) title.textContent = fornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor';
    setValue('comprasFornecedorId', data.id || '');
    setValue('comprasFornecedorName', comprasFornecedoresNome(data));
    setValue('comprasFornecedorDocumento', comprasFornecedoresDocumento(data));
    setValue('comprasFornecedorTipoPessoa', data.tipoPessoa || data.personType || data.fiscalPersonType || '');
    setValue('comprasFornecedorIndIEDest', data.indIEDest || data.indicadorInscricaoEstadual || data.ieIndicator || '');
    setValue('comprasFornecedorInscricaoEstadual', data.inscricaoEstadual || data.stateRegistration || data.ie || '');
    setValue('comprasFornecedorInscricaoMunicipal', data.inscricaoMunicipal || data.municipalRegistration || data.im || '');
    setValue('comprasFornecedorSuframa', data.suframa || '');
    setValue('comprasFornecedorPhone', comprasFornecedoresTelefone(data));
    setValue('comprasFornecedorEmail', data.email || '');
    setValue('comprasFornecedorCep', data.cep || data.postalCode || data.zipCode || '');
    setValue('comprasFornecedorAddress', data.endereco || data.address || '');
    setValue('comprasFornecedorNumber', data.numero || data.number || '');
    setValue('comprasFornecedorNeighborhood', data.bairro || data.neighborhood || '');
    setValue('comprasFornecedorComplement', data.complemento || data.complement || '');
    setValue('comprasFornecedorState', data.estado || data.state || '');
    setValue('comprasFornecedorMunicipalityCode', data.codigoMunicipio || data.municipioCodigo || data.municipalityCode || data.cMun || data.ibgeCode || '');
    setValue('comprasFornecedorCountryCode', data.paisCodigo || data.countryCode || data.cPais || '1058');
    setValue('comprasFornecedorCountryName', data.pais || data.country || data.countryName || data.xPais || 'Brasil');
    setValue('comprasFornecedorObs', data.obs || data.observacoes || data.observations || '');
}

function comprasFornecedoresNovo() {
    if (window.__siswebComprasOperationalReady !== true) {
        comprasFornecedoresMostrarEstado('Empresa da sessão não identificada. Faça login novamente para cadastrar fornecedores.', 'fa-lock');
        return;
    }
    comprasFornecedoresEditingId = null;
    const form = document.getElementById('comprasFornecedorForm');
    if (form) {
        form.reset();
        form.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    comprasFornecedoresPreencherForm(null);
    comprasFornecedoresCarregarCidades('');
    setTimeout(() => document.getElementById('comprasFornecedorName')?.focus(), 50);
}

async function comprasFornecedoresEditar(id) {
    const fornecedorId = String(id || '').trim();
    const fornecedor = (Array.isArray(window.fornecedores) ? window.fornecedores : [])
        .find((item) => String(item.id || '') === fornecedorId);
    if (!fornecedor) {
        ToastManager.warning('Fornecedor não encontrado.', 'Fornecedores');
        return;
    }
    comprasFornecedoresEditingId = fornecedorId;
    const form = document.getElementById('comprasFornecedorForm');
    if (form) {
        form.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    comprasFornecedoresPreencherForm(fornecedor);
    await comprasFornecedoresCarregarCidades(fornecedor.estado || fornecedor.state || '', fornecedor.cidade || fornecedor.city || '');
    setTimeout(() => document.getElementById('comprasFornecedorName')?.focus(), 50);
}

function comprasFornecedoresCancelar() {
    comprasFornecedoresEditingId = null;
    const form = document.getElementById('comprasFornecedorForm');
    if (form) {
        form.reset();
        form.hidden = true;
    }
}

async function comprasFornecedoresSalvar(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (window.__siswebComprasOperationalReady !== true) {
        comprasFornecedoresMostrarEstado('Empresa da sessão não identificada. Faça login novamente para salvar fornecedores.', 'fa-lock');
        return;
    }
    const name = String(document.getElementById('comprasFornecedorName')?.value || '').trim();
    if (!name) {
        ToastManager.warning('Informe o nome do fornecedor.', 'Fornecedores');
        document.getElementById('comprasFornecedorName')?.focus();
        return;
    }
    const saveBtn = document.getElementById('comprasFornecedorSaveBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando';
    }
    try {
        const existing = comprasFornecedoresEditingId
            ? (Array.isArray(window.fornecedores) ? window.fornecedores : []).find((item) => String(item.id || '') === String(comprasFornecedoresEditingId))
            : null;
        const nowIso = new Date().toISOString();
        const telefone = String(document.getElementById('comprasFornecedorPhone')?.value || '').trim();
        const documento = String(document.getElementById('comprasFornecedorDocumento')?.value || '').trim();
        const tipoPessoa = comprasFornecedoresCampo('comprasFornecedorTipoPessoa');
        const indIEDest = comprasFornecedoresCampo('comprasFornecedorIndIEDest');
        const inscricaoEstadual = comprasFornecedoresCampo('comprasFornecedorInscricaoEstadual');
        const inscricaoMunicipal = comprasFornecedoresCampo('comprasFornecedorInscricaoMunicipal');
        const suframa = comprasFornecedoresCampo('comprasFornecedorSuframa');
        const cep = comprasFornecedoresCampo('comprasFornecedorCep');
        const endereco = String(document.getElementById('comprasFornecedorAddress')?.value || '').trim();
        const numero = String(document.getElementById('comprasFornecedorNumber')?.value || '').trim();
        const bairro = String(document.getElementById('comprasFornecedorNeighborhood')?.value || '').trim();
        const complemento = comprasFornecedoresCampo('comprasFornecedorComplement');
        const estado = String(document.getElementById('comprasFornecedorState')?.value || '').trim();
        const cidade = String(document.getElementById('comprasFornecedorCity')?.value || '').trim();
        const codigoMunicipio = comprasFornecedoresCampo('comprasFornecedorMunicipalityCode');
        const paisCodigo = comprasFornecedoresCampo('comprasFornecedorCountryCode') || '1058';
        const pais = comprasFornecedoresCampo('comprasFornecedorCountryName') || 'Brasil';
        const obs = String(document.getElementById('comprasFornecedorObs')?.value || '').trim();
        const fornecedorId = comprasFornecedoresEditingId || `FOR-${Date.now()}`;
        const payload = {
            ...(existing || {}),
            id: fornecedorId,
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
            telefone,
            phone: telefone,
            email: String(document.getElementById('comprasFornecedorEmail')?.value || '').trim(),
            endereco,
            address: endereco,
            numero,
            number: numero,
            bairro,
            neighborhood: bairro,
            complemento,
            complement: complemento,
            estado,
            state: estado,
            cidade,
            city: cidade,
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
            obs,
            observacoes: obs,
            observations: obs,
            createdAt: existing?.createdAt || existing?.created || nowIso,
            updatedAt: nowIso,
            updated: nowIso
        };
        const service = comprasFornecedoresGetService();
        const saved = await service.saveFornecedor(payload);
        const savedId = String(saved.id || payload.id || comprasFornecedoresEditingId || '').trim();
        atualizarSelectFornecedores(savedId || null);
        prepararFiltrosPedidosCompras();
        prepararRelatoriosCompras();
        renderizarFornecedoresCompra();
        comprasFornecedoresCancelar();
        ToastManager.success('Fornecedor salvo com sucesso.', 'Fornecedores');
    } catch (error) {
        console.error('Erro ao salvar fornecedor na aba de compras:', error);
        ToastManager.error('Erro ao salvar fornecedor: ' + (error && error.message ? error.message : error), 'Fornecedores');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Fornecedor';
        }
    }
}

async function comprasFornecedoresExcluir(id) {
    const fornecedorId = String(id || '').trim();
    if (!fornecedorId) return;
    const fornecedor = (Array.isArray(window.fornecedores) ? window.fornecedores : [])
        .find((item) => String(item.id || '') === fornecedorId);
    const nome = comprasFornecedoresNome(fornecedor) || 'este fornecedor';
    if (!window.confirm(`Excluir ${nome}?`)) return;
    try {
        const service = comprasFornecedoresGetService();
        await service.deleteFornecedor(fornecedorId);
        atualizarSelectFornecedores();
        prepararFiltrosPedidosCompras();
        prepararRelatoriosCompras();
        renderizarFornecedoresCompra();
        if (comprasFornecedoresEditingId === fornecedorId) comprasFornecedoresCancelar();
        ToastManager.success('Fornecedor excluído.', 'Fornecedores');
    } catch (error) {
        console.error('Erro ao excluir fornecedor na aba de compras:', error);
        ToastManager.error('Erro ao excluir fornecedor: ' + (error && error.message ? error.message : error), 'Fornecedores');
    }
}

function comprasFornecedoresRecarregar() {
    carregarFornecedoresAbaCompra(true);
}

function configurarAbaFornecedoresCompras() {
    const form = document.getElementById('comprasFornecedorForm');
    if (form && !form.dataset.bound) {
        form.addEventListener('submit', comprasFornecedoresSalvar);
        form.dataset.bound = '1';
    }
    const busca = document.getElementById('comprasFornecedoresBusca');
    if (busca && !busca.dataset.bound) {
        busca.addEventListener('input', renderizarFornecedoresCompra);
        busca.dataset.bound = '1';
    }
    const state = document.getElementById('comprasFornecedorState');
    if (state && !state.dataset.bound) {
        state.addEventListener('change', () => comprasFornecedoresCarregarCidades(state.value));
        state.dataset.bound = '1';
    }
}

// Modal Rápido de Fornecedor
function abrirModalFornecedor() {
    document.getElementById('modalFornecedor').style.display = 'block';
}

function fecharModalFornecedor() {
    document.getElementById('modalFornecedor').style.display = 'none';
}

async function salvarFornecedorInline(event) {
    event.preventDefault();
    LoadingManager.show('Salvando fornecedor...');
    try {
        const nowIso = new Date().toISOString();
        const obs = comprasFornecedoresCampo('fornObs');
        const novoFornecedor = {
            id: `FOR-${Date.now()}`,
            nome: comprasFornecedoresCampo('fornNome'),
            name: comprasFornecedoresCampo('fornNome'),
            documento: comprasFornecedoresCampo('fornDocumento'),
            document: comprasFornecedoresCampo('fornDocumento'),
            cnpj: comprasFornecedoresCampo('fornDocumento'),
            tipoPessoa: comprasFornecedoresCampo('fornTipoPessoa'),
            personType: comprasFornecedoresCampo('fornTipoPessoa'),
            fiscalPersonType: comprasFornecedoresCampo('fornTipoPessoa'),
            indIEDest: comprasFornecedoresCampo('fornIndIEDest'),
            indicadorInscricaoEstadual: comprasFornecedoresCampo('fornIndIEDest'),
            ieIndicator: comprasFornecedoresCampo('fornIndIEDest'),
            inscricaoEstadual: comprasFornecedoresCampo('fornInscricaoEstadual'),
            stateRegistration: comprasFornecedoresCampo('fornInscricaoEstadual'),
            ie: comprasFornecedoresCampo('fornInscricaoEstadual'),
            inscricaoMunicipal: comprasFornecedoresCampo('fornInscricaoMunicipal'),
            municipalRegistration: comprasFornecedoresCampo('fornInscricaoMunicipal'),
            suframa: comprasFornecedoresCampo('fornSuframa'),
            cep: comprasFornecedoresCampo('fornCep'),
            postalCode: comprasFornecedoresCampo('fornCep'),
            telefone: comprasFornecedoresCampo('fornTelefone'),
            phone: comprasFornecedoresCampo('fornTelefone'),
            email: comprasFornecedoresCampo('fornEmail'),
            endereco: comprasFornecedoresCampo('fornEndereco'),
            address: comprasFornecedoresCampo('fornEndereco'),
            numero: comprasFornecedoresCampo('fornNumero'),
            number: comprasFornecedoresCampo('fornNumero'),
            bairro: comprasFornecedoresCampo('fornBairro'),
            neighborhood: comprasFornecedoresCampo('fornBairro'),
            complemento: comprasFornecedoresCampo('fornComplemento'),
            complement: comprasFornecedoresCampo('fornComplemento'),
            cidade: comprasFornecedoresCampo('fornCidade'),
            city: comprasFornecedoresCampo('fornCidade'),
            estado: comprasFornecedoresCampo('fornEstado'),
            state: comprasFornecedoresCampo('fornEstado'),
            codigoMunicipio: comprasFornecedoresCampo('fornCodigoMunicipio'),
            municipioCodigo: comprasFornecedoresCampo('fornCodigoMunicipio'),
            municipalityCode: comprasFornecedoresCampo('fornCodigoMunicipio'),
            cMun: comprasFornecedoresCampo('fornCodigoMunicipio'),
            ibgeCode: comprasFornecedoresCampo('fornCodigoMunicipio'),
            paisCodigo: comprasFornecedoresCampo('fornPaisCodigo') || '1058',
            countryCode: comprasFornecedoresCampo('fornPaisCodigo') || '1058',
            cPais: comprasFornecedoresCampo('fornPaisCodigo') || '1058',
            pais: comprasFornecedoresCampo('fornPais') || 'Brasil',
            country: comprasFornecedoresCampo('fornPais') || 'Brasil',
            countryName: comprasFornecedoresCampo('fornPais') || 'Brasil',
            xPais: comprasFornecedoresCampo('fornPais') || 'Brasil',
            obs,
            observacoes: obs,
            observations: obs,
            createdAt: nowIso,
            updatedAt: nowIso,
            updated: nowIso
        };

        const service = comprasFornecedoresGetService();
        const saved = await service.saveFornecedor(novoFornecedor);
        const savedId = String(saved.id || novoFornecedor.id || '').trim();

        atualizarSelectFornecedores(savedId || null);
        prepararFiltrosPedidosCompras();
        prepararRelatoriosCompras();
        renderizarFornecedoresCompra();
        fecharModalFornecedor();
        ToastManager.success('Fornecedor cadastrado!');
        document.querySelector('#modalFornecedor form')?.reset();
    } catch (error) {
        console.error('Erro ao salvar fornecedor pelo modal rápido:', error);
        ToastManager.error('Erro ao salvar fornecedor: ' + (error && error.message ? error.message : error));
    } finally {
        LoadingManager.hide();
    }
}

// ============================================================================
// 6. INICIALIZAÇÃO DO SISTEMA
// ============================================================================

async function inicializarSistemaCompras() {
    LoadingManager.show('Inicializando sistema de compras...');
    configurarAbaFornecedoresCompras();
    
    try {
        const contextoEmpresa = await garantirContextoEmpresaCompras();
        if (!contextoEmpresa || !contextoEmpresa.success || (!contextoEmpresa.companyId && !contextoEmpresa.superAdmin)) {
            window.fornecedores = [];
            window.produtos = [];
            atualizarSelectFornecedores();
            atualizarSelectProdutos();
            renderOperationalAccessStateCompras(contextoEmpresa || { error: 'Empresa da sessão não identificada.' });
            const msg = contextoEmpresa && contextoEmpresa.superAdmin
                ? 'Acesse Compras com um usuário vinculado a uma empresa.'
                : 'Sessão sem empresa ativa. Entre novamente para carregar Compras com segurança.';
            console.warn(`⚠️ Compras sem tenant operacional: ${msg}`, contextoEmpresa || {});
            ToastManager.warning(msg);
        } else {
            clearOperationalAccessStateCompras();

            await Promise.all([
                carregarFornecedores(),
                (async () => {
                    window.produtos = await getData('produtos') || [];
                })()
            ]);
            
            // Popular select de produtos cadastrados usando função dedicada
            atualizarSelectProdutos();
            prepararRelatoriosCompras();
        }
        
    } catch (e) {
        console.error('Erro na inicialização:', e);
        renderOperationalAccessStateCompras({ error: e && e.message ? e.message : 'Erro ao carregar dados iniciais.' });
        ToastManager.error('Erro ao carregar dados iniciais.');
    } finally {
        LoadingManager.hide();
    }
    
    // Fechar modais ao clicar fora
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // --- EVENTOS FALTANTES (Desconto e Parcelas) ---
    const descontoInput = document.getElementById('desconto');
    if (descontoInput) {
        descontoInput.addEventListener('input', atualizarTotais);
        descontoInput.addEventListener('blur', function() {
            this.value = formatCurrency(parseCurrency(this.value));
            atualizarTotais();
        });
    }

    const numParcelasInput = document.getElementById('numeroParcelas');
    if (numParcelasInput) {
        numParcelasInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                adicionarContaPagar();
            }
        });
    }
    
    const contaValorInput = document.getElementById('contaValor');
    if (contaValorInput) {
        contaValorInput.addEventListener('input', function() {
            formatCurrencyInput(this);
        });
    }

    // --- Eventos de Produto (Faltantes) ---
    const produtoSelect = document.getElementById('produtoSelect');
    if (produtoSelect) {
        produtoSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption && selectedOption.dataset.preco) {
                const preco = parseFloat(selectedOption.dataset.preco);
                const precoInput = document.getElementById('precoUnitario');
                if (precoInput) {
                    precoInput.value = formatCurrency(preco);
                }
            }
        });
    }

    const precoUnitarioInput = document.getElementById('precoUnitario');
    if (precoUnitarioInput) {
        precoUnitarioInput.addEventListener('focus', function() {
            const val = parseCurrency(this.value);
            this.value = val === 0 ? '' : val;
        });

        precoUnitarioInput.addEventListener('blur', function() {
            // Formatar apenas ao sair do campo
            const raw = this.value.replace(/\u00A0/g, ' ').trim().replace(/^R\$\s*/, '');
            if (!raw) return;
            const num = parseCurrency(this.value);
            this.value = formatCurrency(num);
            atualizarTotais();
        });
        
        // Remover listener de input que força formatação ATM style se estiver causando problemas
        // Ou manter apenas sanitização básica
        precoUnitarioInput.addEventListener('keydown', function(e) {
             // Permitir navegação e edição
        });
    }

    const produtoForm = document.getElementById('produtoForm');
    if (produtoForm && !produtoForm.dataset.bound) {
        produtoForm.addEventListener('submit', salvarProdutoCadastro);
        produtoForm.dataset.bound = '1';
    }

    const agruparRomaneioCheckbox = document.getElementById('agruparItensRomaneio');
    if (agruparRomaneioCheckbox && !agruparRomaneioCheckbox.dataset.bound) {
        agruparRomaneioCheckbox.addEventListener('change', function() {
            if (!this.checked) return;
            const resultado = agruparItensRomaneioNoCarrinho();
            if (resultado.removidos > 0) {
                ToastManager.success(`Itens do carrinho agrupados por espécie (${resultado.removidos} → ${resultado.agrupados}).`);
            }
        });
        agruparRomaneioCheckbox.dataset.bound = '1';
    }
}

function iniciarSistemaComprasUmaVez() {
    if (window.__siswebComprasInitStarted) return;
    window.__siswebComprasInitStarted = true;
    inicializarSistemaCompras();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciarSistemaComprasUmaVez);
} else {
    iniciarSistemaComprasUmaVez();
}

function filtrarPedidos() {
    pedidosListPage = 1;
    renderListaPedidosCompras();
}

// Expor funções globais para o HTML
window.novoPedido = novoPedido;
window.listarPedidos = listarPedidos;
window.salvarPedido = salvarPedido;
window.cancelarPedido = cancelarPedido;
window.adicionarItemManual = adicionarItemManual;
window.adicionarItem = adicionarItem;
window.removerItem = removerItem;
window.adicionarContaPagar = adicionarContaPagar;
window.removerConta = removerConta;
window.alterarTipoProduto = alterarTipoProduto;
window.editarPedido = editarPedido;
window.excluirPedido = excluirPedido;
window.imprimirPedido = imprimirPedido;
window.abrirModalFornecedor = abrirModalFornecedor;
window.fecharModalFornecedor = fecharModalFornecedor;
window.salvarFornecedorInline = salvarFornecedorInline;
window.filtrarPedidos = filtrarPedidos;
window.toggleSelecionarPedido = toggleSelecionarPedido;
window.toggleSelecionarTodosPedidos = toggleSelecionarTodosPedidos;
window.imprimirPedidosSelecionados = imprimirPedidosSelecionados;
window.filtrarFornecedoresSelect = filtrarFornecedoresSelect;
window.gerarRelatorioCompras = gerarRelatorioCompras;
window.exportarRelatorioComprasCSV = exportarRelatorioComprasCSV;
window.exportarRelatorioComprasPDF = exportarRelatorioComprasPDF;
window.abrirCustomizarColunasCompras = abrirCustomizarColunasCompras;
window.aplicarCustomizacaoColunasCompras = aplicarCustomizacaoColunasCompras;
window.carregarFornecedores = carregarFornecedores;
window.atualizarSelectFornecedores = atualizarSelectFornecedores;
window.carregarFornecedoresAbaCompra = carregarFornecedoresAbaCompra;
window.comprasFornecedoresNovo = comprasFornecedoresNovo;
window.comprasFornecedoresEditar = comprasFornecedoresEditar;
window.comprasFornecedoresCancelar = comprasFornecedoresCancelar;
window.comprasFornecedoresSalvar = comprasFornecedoresSalvar;
window.comprasFornecedoresExcluir = comprasFornecedoresExcluir;
window.comprasFornecedoresRecarregar = comprasFornecedoresRecarregar;

// Integração com sistema de cidades (cities.js)
window.loadCities = function(uf, targetId) {
    if (typeof window.populateCitySelect === 'function') {
        window.populateCitySelect(uf, targetId);
    } else {
        console.warn('Função populateCitySelect (cities.js) não disponível.');
    }
};

// Integração com selects de cidade usados pelos formulários de fornecedor.
window.carregarCidadesPorEstado = function(uf) {
    // O modal legado usa 'clientCity' como ID fixo
    window.loadCities(uf, 'clientCity');
};

// Integração com atualizações externas de fornecedores.
window.addEventListener('suppliers:updated', (e) => {
    if (e.detail) {
        carregarFornecedores().then(() => {
            atualizarSelectFornecedores(e.detail.id);
        });
    }
});

window.addEventListener('fornecedores:updated', (e) => {
    if (e.detail) {
        carregarFornecedores().then(() => {
            atualizarSelectFornecedores(e.detail.id);
        });
    }
});

window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (!data || data.source !== 'sisweb-commerce-embedded') return;
    if (data.type !== 'sisweb:suppliers:updated' && data.type !== 'sisweb:fornecedores:updated') return;
    window.dispatchEvent(new CustomEvent('suppliers:updated', { detail: data.detail || {} }));
});

// ============================================================================
// 7. INTEGRAÇÃO COM ROMANEIOS (FALTANTE)
// ============================================================================

window.carregarRomaneiosPorTipo = async function() {
    const tipo = document.getElementById('tipoRomaneio').value;
    const select = document.getElementById('romaneioSelect');
    
    select.innerHTML = '<option value="">Carregando...</option>';
    
    if (!tipo) {
        select.innerHTML = '<option value="">Selecione o tipo primeiro</option>';
        return;
    }
    
    try {
        let dados = await getData(tipo); // 'romaneiosTora', 'romaneiosPct', etc.
        
        select.innerHTML = '<option value="">Selecione um romaneio</option>';
        
        // ✅ CORREÇÃO: Filtrar dados inválidos ou corrompidos
        if (Array.isArray(dados)) {
            dados = dados.filter(item => item && typeof item === 'object' && (item.id || item.firebaseKey));
        }
        
        if (!dados || dados.length === 0) {
            select.innerHTML = '<option value="">Nenhum romaneio encontrado</option>';
            return;
        }
        
        dados.sort(compareRomaneiosCompraByRecencyDesc);
        
        dados.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id || r.firebaseKey;
            
            const dataBase = r.dataEmissao || r.data || r.dataHora || r.createdAt || r.created || r.timestamp;
            const dataObj = dataBase ? new Date(dataBase) : null;
            const data = dataObj && !isNaN(dataObj.getTime()) ? dataObj.toLocaleDateString('pt-BR') : 'S/D';
            // Suporte a diferentes estruturas de cliente/fornecedor
            const nome = r.fornecedor?.nome || r.cliente?.nome || r.fornecedor || r.cliente || 'Sem Nome';
            
            // ✅ CORREÇÃO: Calcular itens e volume de forma robusta
            const itemsRaw = r.itens || r.items || r.romaneioItems || [];
            let itensCount = 0;
            let volumeTotal = 0;
            
            let itemsArray = [];
            if (Array.isArray(itemsRaw)) {
                itemsArray = itemsRaw;
            } else if (itemsRaw && typeof itemsRaw === 'object') {
                itemsArray = Object.values(itemsRaw);
            }

            // Filtrar fantasmas
            itemsArray = itemsArray.filter(i => i && typeof i === 'object' && !(i['0'] === 'r' && i['1'] === 'o'));
            
            itensCount = itemsArray.length;
            itemsArray.forEach(i => {
                volumeTotal += parseFloat(i.volumeLiquido || i.volume || i.volumeSerraria || 0) || 0;
            });
            
            // Exibir tipo se disponível
            const tipoLabel = r.tipo ? `[${r.tipo}] ` : '';
            const volumeLabel = volumeTotal > 0 ? ` | ${volumeTotal.toFixed(3)}m³` : '';
            
            opt.textContent = `${tipoLabel}${data} - ${nome} (${itensCount} itens${volumeLabel})`;
            select.appendChild(opt);
        });
        
    } catch (e) {
        console.error("Erro ao carregar romaneios:", e);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
};

window.carregarDadosRomaneio = async function() {
    const tipo = document.getElementById('tipoRomaneio').value;
    const id = document.getElementById('romaneioSelect').value;
    
    if (!tipo || !id) return;
    
    try {
        const dados = await getData(tipo);
        const romaneio = dados.find(r => (r.id === id || r.firebaseKey === id));
        
        if (!romaneio) return;
        
        // Mostrar preview se necessário (implementar lógica visual se pedido)
        // Por enquanto, apenas logs
        console.log("Romaneio selecionado:", romaneio);
        
    } catch (e) {
        console.error("Erro ao carregar detalhes do romaneio:", e);
    }
};

window.adicionarItensRomaneio = async function() {
    const tipo = document.getElementById('tipoRomaneio').value;
    const id = document.getElementById('romaneioSelect').value;
    const agrupar = document.getElementById('agruparItensRomaneio') ? document.getElementById('agruparItensRomaneio').checked : false;
    
    if (!tipo || !id) {
        ToastManager.warning('Selecione um romaneio.');
        return;
    }
    
    try {
        const dados = await getData(tipo);
        const romaneio = dados.find(r => (r.id === id || r.firebaseKey === id));
        if (!romaneio) {
            ToastManager.warning('Romaneio selecionado não foi encontrado.');
            return;
        }
        const origemRomaneioId = String(romaneio.id || romaneio.firebaseKey || id);
        const jaAdicionado = itensPedido.some(item => String(item && item.origemId || '') === origemRomaneioId);
        if (jaAdicionado) {
            ToastManager.warning('Este romaneio já foi adicionado ao carrinho. Remova os itens dele antes de carregar novamente.');
            return;
        }
        
        // ✅ CORREÇÃO: Normalizar itens (array vs objeto)
        const itemsRaw = romaneio.itens || romaneio.items || romaneio.romaneioItems;
        let itemsArray = [];
        
        if (itemsRaw) {
            if (Array.isArray(itemsRaw)) {
                itemsArray = itemsRaw;
            } else if (typeof itemsRaw === 'object') {
                itemsArray = Object.values(itemsRaw);
            }
        }
        
        // Filtrar itens inválidos/fantasmas
        itemsArray = itemsArray.filter(item => {
            if (!item) return false;
            if (typeof item !== 'object') return false;
            // Filtro para "ghost" data (spread strings)
            if (item['0'] === 'r' && item['1'] === 'o') return false;
            return true;
        });
        
        if (itemsArray.length === 0) {
            ToastManager.warning('Romaneio sem itens válidos ou não encontrado.');
            return;
        }
        
        let novosItens = [];

        if (agrupar) {
            // Lógica de Agrupamento por Espécie
            const agrupados = {};
            
            itemsArray.forEach(item => {
                const especie = (item.especie || item.produto || item.descricao || 'Item Romaneio').trim();
                const key = especie.toUpperCase(); // Agrupar case-insensitive
                
                // Campos geométricos da tora são informativos para romaneio; pedido de compra usa o volume comercial já existente.
                const qtd = parseFloat(item.volumeLiquido || item.volume || item.quantidade || 0);
                const preco = parseFloat(item.preco || item.precoUnitario || 0);
                const totalItem = qtd * preco;

                if (!agrupados[key]) {
                    agrupados[key] = {
                        nome: especie,
                        quantidade: 0,
                        total: 0,
                        unidade: item.unidade || 'm³'
                    };
                }
                
                agrupados[key].quantidade += qtd;
                agrupados[key].total += totalItem;
            });
            
            // Converter agrupados para lista de itens do pedido
            Object.values(agrupados).forEach(grp => {
                // Preço médio ponderado
                const precoMedio = grp.quantidade > 0 ? (grp.total / grp.quantidade) : 0;
                
                novosItens.push({
                    id: Date.now() + Math.random(),
                    tipo: 'romaneio_agrupado',
                    origemId: origemRomaneioId,
                    produtoNome: grp.nome, // Sem prefixo [tipo]
                    quantidade: parseFloat(grp.quantidade.toFixed(3)),
                    unidade: grp.unidade,
                    precoUnitario: parseFloat(precoMedio.toFixed(2)),
                    total: parseFloat(grp.total.toFixed(2))
                });
            });
            
        } else {
            // Lógica Item a Item
            itemsArray.forEach((item, idx) => {
                // Tentar mapear campos variados (Tora, Pct, etc)
                const nomeProduto = item.especie || item.produto || item.descricao || 'Item Romaneio';
                
                // Priorizar volumeLiquido para Toras, ou volume/quantidade genérico.
                // Campos geométricos novos permanecem fora do pedido de compra.
                const qtd = parseFloat(item.volumeLiquido || item.volume || item.quantidade || 0);
                
                // Evitar itens zerados se não for intencional (mas o usuário disse "valores zerados" como bug)
                // Se qtd for 0, talvez devêssemos ignorar? Ou importar como 0?
                // Vou manter, mas garantir que a leitura está correta.
                
                const preco = parseFloat(item.preco || item.precoUnitario || 0);
                const unidade = item.unidade || 'm³'; // Padrão m³ para madeira
                
                novosItens.push({
                    id: Date.now() + idx,
                    tipo: 'romaneio',
                    origemId: origemRomaneioId,
                    produtoNome: nomeProduto, // Sem prefixo [tipo]
                    quantidade: qtd,
                    unidade: unidade,
                    precoUnitario: preco,
                    total: qtd * preco
                });
            });
        }
        
        // Adicionar ao pedido
        itensPedido.push(...novosItens);
        if (agrupar) {
            const resultadoAgrupamento = agruparItensRomaneioNoCarrinho();
            if (!resultadoAgrupamento || resultadoAgrupamento.removidos === 0) {
                renderizarItensPedido();
                atualizarTotais();
            }
        } else {
            renderizarItensPedido();
            atualizarTotais();
        }
        ToastManager.success(`${novosItens.length} itens adicionados.`);
        
    } catch (e) {
        console.error("Erro ao adicionar itens do romaneio:", e);
        ToastManager.error("Erro ao processar itens: " + e.message);
    }
};
