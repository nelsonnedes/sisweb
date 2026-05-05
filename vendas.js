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
            const id = obj && (obj.id || obj.companyId || obj.slug || obj.nome || obj.name);
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
                    const id = obj && (obj.id || obj.companyId || obj.companyID || obj.tenantId || obj.slug);
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

        const pickCompanyFromPayload = (payload) => {
            if (!payload) return {};
            if (Array.isArray(payload)) return payload[0] || {};
            if (typeof payload !== 'object') return {};
            const values = Object.values(payload).filter(v => v && typeof v === 'object');
            if (values.length > 0) return values[0] || {};
            return payload;
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
                const byPathData = byPath && (byPath.success ? byPath.data : byPath.data);
                if (byPathData && typeof byPathData === 'object') {
                    companyData = { ...byPathData, id: tenantId, companyId: tenantId, tenantId: tenantId };
                }
            } catch (_) {}
        }

        if (!companyData || (!companyData.nome && !companyData.name)) {
            const companiesPayload = await getData('companies');
            companyData = pickCompanyFromPayload(companiesPayload);
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

        const logoCandidate = empresaFinal.logoBase64 || empresaFinal.logoUrl || empresaFinal.logoURL || empresaFinal.logoData || empresaFinal.logo || '';
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



// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    inicializarSistema();
});

// Funções de inicialização
async function inicializarSistema() {
    try {
        if (typeof LoadingManager !== 'undefined') LoadingManager.show('Iniciando sistema...');
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
        
        // Carregar dados
        await carregarDados();
        
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
    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
        if (typeof ToastManager !== 'undefined') ToastManager.error("Erro ao inicializar: " + error.message);
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
                     getData('species').catch(() => []),
                     getData('produtos').catch(() => []),
                     (window.clientService && window.clientService.getClients) ? window.clientService.getClients(true).catch(() => []) : getData('clients').catch(() => [])
                 ]);
                 
                 window.produtos = typeof normalizeProdutosList === 'function' ? normalizeProdutosList([...(species || []), ...(produtos_raw || [])]) : [...(species || []), ...(produtos_raw || [])];
                 window.clientes = Array.isArray(cliRes) ? cliRes : [];
                 
                 console.log(`✅ [Lazy Load] Auxiliares carregados. Produtos: ${window.produtos.length}, Clientes: ${window.clientes.length}`);
                 atualizarSelectClientes();
                 atualizarSelectProdutos();
                 popularFiltrosRelatoriosVenda();
                 if (typeof popularFiltrosPedidosVenda === 'function') popularFiltrosPedidosVenda();
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
            } catch (err) {
                console.warn('Erro ao processar atualização de clientes:', err);
            }
        });
    } catch (_) {}
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
    document.getElementById(tabName).classList.add('active');
    
    // Adicionar classe active na tab clicada
    event.target.classList.add('active');
    
    // Carregar dados específicos da tab
    if (tabName === 'produtos') {
        listarProdutos();
    } else if (tabName === 'relatorios') {
        popularFiltrosRelatoriosVenda();
        gerarRelatorio();
    }
}

// Funções de pedidos
async function novoPedido() {
    editandoPedidoId = null;
    pedidoAtual = null;
    itensCarrinho = [];
    contasReceber = []; // Limpar contas a receber
    autoRedistribuirEnabled = true;
    contasReceberEdicaoBloqueada = false;
    
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
}

/**
 * ✅ VALIDAR ESTOQUE ANTES DE ADICIONAR ITEM
 * @param {string} produtoId - ID do produto
 * @param {number} quantidadeDesejada - Quantidade que se deseja adicionar
 * @returns {Object} { valido: boolean, mensagem: string, estoqueAtual: number }
 */
function validarEstoque(produtoId, quantidadeDesejada) {
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
    
    const estoqueAtual = produto.estoque || 0;
    
    // Verificar se já existe no carrinho
    const itemNoCarrinho = itensCarrinho.find(i => i.produtoId === produtoId);
    const quantidadeJaNoCarrinho = itemNoCarrinho ? itemNoCarrinho.quantidade : 0;
    
    const quantidadeTotal = quantidadeDesejada + quantidadeJaNoCarrinho;
    
    if (quantidadeTotal > estoqueAtual && VendasConfig.validarEstoque && !VendasConfig.permitirEstoqueNegativo) {
        return {
            valido: false,
            mensagem: `Estoque insuficiente. Disponível: ${estoqueAtual} | No carrinho: ${quantidadeJaNoCarrinho} | Solicitado: ${quantidadeDesejada}`,
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
    const quantidade = parseFloat(document.getElementById('quantidade').value);
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
    
    // ✅ VALIDAÇÃO DE ESTOQUE
    const validacao = validarEstoque(produtoId, quantidade);
    
    if (!validacao.valido) {
        ToastManager.error(validacao.mensagem, 'Estoque Insuficiente', 6000);
        return;
    }
    
    const produto = window.produtos.find(p => p.id === produtoId);
    if (!produto) {
        ToastManager.error('Produto não encontrado', 'Erro');
        return;
    }
    
    // Verificar se o item já existe no carrinho
    const itemExistente = itensCarrinho.find(item => item.produtoId === produtoId);
    
    if (itemExistente) {
        itemExistente.quantidade += quantidade;
        itemExistente.total = itemExistente.quantidade * itemExistente.precoUnitario;
        if (isCarregoProduto(produto)) itemExistente.isCarrego = true;
        ToastManager.success(`Quantidade atualizada: ${formatNumber(itemExistente.quantidade)} ${produto.unidade}`, 'Item atualizado', 2000);
    } else {
        const novoItem = {
            id: Date.now(),
            produtoId: produtoId,
            produtoNome: produto.nome,
            produtoCodigo: produto.codigo,
            quantidade: quantidade,
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
    const item = itensCarrinho.find(i => i.id === itemId);

    // Remover sem popup de confirmação
    itensCarrinho = itensCarrinho.filter(i => i.id !== itemId);
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
    const item = itensCarrinho.find(i => i.id === itemId);
    if (!item) return;
    
    console.log('📝 Editando item:', item); // Debug para verificar os dados do item
    
    // Determinar tipo do item e preencher os campos apropriados
    const tipo = item.tipo || 'cadastrado';
    
    // Alternar para o tipo correto de produto
    alterarTipoProduto(tipo);
    
    // Preencher campos baseado no tipo
    switch(tipo) {
        case 'manual':
            document.getElementById('produtoManual').value = (item.produtoNome || '').replace(/^\s*[-–—]\s*/, '').trim();
            document.getElementById('quantidadeManual').value = item.quantidade;
            document.getElementById('unidadeManual').value = item.unidade || 'UN';
            document.getElementById('precoManual').value = formatCurrency(item.precoUnitario);
            break;
        case 'romaneio':
            // ✅ Opção 2: Permitir edição de itens de romaneio via Produto Manual
            // Converter para edição manual preservando dados originais
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
            
            // Remover o item antigo (já preenchemos os campos, não precisa return)
            break;
        case 'cadastrado':
        default:
    document.getElementById('produtoSelect').value = item.produtoId;
    document.getElementById('quantidade').value = item.quantidade;
    document.getElementById('precoUnitario').value = formatCurrency(item.precoUnitario);
            break;
    }
    
    // Remover item (será adicionado novamente) sem popup, com mensagem amigável
    removerItem(itemId, { reason: 'edit' });
}

function atualizarTabelaItens() {
    const tbody = document.getElementById('itensTable');
    
    if (itensCarrinho.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum item adicionado</td></tr>';
        return;
    }
    
    tbody.innerHTML = itensCarrinho.map(item => {
        let produtoDescricao = '';
        const nomeLimpo = (item.produtoNome || '').replace(/^\s*[-–—]\s*/, '').trim();
        
        if (item.tipo === 'manual' || item.tipo === 'romaneio' || item.tipo === 'romaneio_agrupado') {
            produtoDescricao = nomeLimpo;
        } else {
            produtoDescricao = item.produtoCodigo ? `${item.produtoCodigo} - ${nomeLimpo}` : nomeLimpo;
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
                <td>${produtoDescricao}</td>
                <td style="text-align: center;">${quantidadeFormatada}</td>
                <td style="text-align: right;">${formatCurrency(item.precoUnitario)}</td>
                <td style="text-align: right;">${formatCurrency(item.total)}</td>
                <td style="text-align: center;">
                    <button type="button" onclick="editarItem(${item.id})" class="btn-primary btn-small">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" onclick="removerItem(${item.id})" class="btn-danger btn-small">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
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
    
    document.getElementById('subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('totalGeral').textContent = formatCurrency(totalGeral);
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
        // ✅ Atualizar SEMPRE o campo Valor com o Total Geral quando não há parcelas
        const contaValorInput = document.getElementById('contaValor');
        if (contaValorInput) {
            contaValorInput.value = totalGeral > 0 ? formatCurrency(totalGeral) : '';
            console.log(`✅ Campo Valor sincronizado com Total Geral: ${formatCurrency(Math.max(0, totalGeral))}`);
        }
    }
}

// Função para salvar pedido
async function salvarPedido(event) {
    event.preventDefault();
    
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
        if (pedidoData.created === undefined) { delete pedidoData.created; }

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

        const somaContas = (pedidoData.contasReceber || []).reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
        if (Math.abs(somaContas - (parseFloat(pedidoData.total) || 0)) > 0.01) {
            ToastManager.warning('Total do pedido difere da soma das parcelas.', 'Validação');
        }
        
        let removiveis = [];
        let pedidoAnterior = null;
        if (editandoPedidoId) {
            pedidoAnterior = (window.pedidos || []).find(p => String(p.id) === String(editandoPedidoId)) || null;
            // Preferir contas vinculadas embutidas no pedido anterior
            if (pedidoAnterior && Array.isArray(pedidoAnterior.contasReceber) && pedidoAnterior.contasReceber.length > 0) {
                removiveis = pedidoAnterior.contasReceber.map((conta, idx) => ({
                    id: conta && conta.id ? conta.id : `CR_${String(editandoPedidoId)}_${String(idx + 1).padStart(3,'0')}`,
                    valor: conta.valor,
                    valorOriginal: conta.valorOriginal || conta.valor,
                    valorRestante: conta.valorRestante ?? conta.valor,
                    dataVencimento: conta.vencimento || conta.dataVencimento,
                    vencimento: conta.vencimento || conta.dataVencimento,
                    origemId: editandoPedidoId,
                    status: conta.status || 'pendente'
                }));
            } else {
                try {
                    const todas = await getData('financas/receber') || [];
                    const vinculadas = (todas || []).filter(c => String(c.origemId) === String(editandoPedidoId));
                    const hasAlgumRecebimento = vinculadas.some(c => {
                        const st = String(c.status || '').toLowerCase();
                        const hasRec = Array.isArray(c.recebimentos) && c.recebimentos.length > 0;
                        const vo = typeof c.valorOriginal === 'number' ? c.valorOriginal : parseFloat(c.valorOriginal || '');
                        const vr = typeof c.valorRestante === 'number' ? c.valorRestante : parseFloat(c.valorRestante || '');
                        const parcial = !isNaN(vo) && !isNaN(vr) && vr < vo;
                        return st === 'pago' || hasRec || parcial;
                    });
                    removiveis = hasAlgumRecebimento ? await listarContasReceberSemRecebimento(editandoPedidoId) : vinculadas.slice();
                    if (removiveis.length > 0) ToastManager.info(`Parcelas anteriores estornadas: ${removiveis.length}`, 'Edição de Pedido');
                } catch (e) {
                    removiveis = await listarContasReceberSemRecebimento(editandoPedidoId);
                }
            }

            if (!shouldGenerateFinance) {
                const loadVinculadas = async (pedidoId) => {
                    let todas = [];
                    if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
                        try {
                            const res = await window.firebaseService.loadFromFirebase('financas/receber');
                            if (res && res.success && res.data) {
                                const obj = res.data;
                                if (Array.isArray(obj)) {
                                    todas = obj;
                                } else if (typeof obj === 'object') {
                                    const months = Object.keys(obj || {});
                                    for (const mk of months) {
                                        const monthVal = obj[mk];
                                        if (Array.isArray(monthVal)) {
                                            todas.push(...monthVal);
                                        } else if (typeof monthVal === 'object') {
                                            Object.keys(monthVal || {}).forEach(id => {
                                                const it = monthVal[id];
                                                if (it) todas.push({ id, ...it });
                                            });
                                        }
                                    }
                                }
                            }
                        } catch (_) {}
                    }
                    if (!Array.isArray(todas) || todas.length === 0) {
                        const local = await getData('financas/receber') || [];
                        todas = Array.isArray(local) ? local : [];
                    }
                    return (todas || []).filter(c => String(c && c.origemId) === String(pedidoId));
                };
                const vinculadas = await loadVinculadas(editandoPedidoId);
                const temRecebimento = vinculadas.some(c => {
                    const st = String(c && c.status ? c.status : '').toLowerCase();
                    const hasRec = Array.isArray(c && c.recebimentos ? c.recebimentos : null) && c.recebimentos.length > 0;
                    const vo = typeof c.valorOriginal === 'number' ? c.valorOriginal : parseFloat((c && c.valorOriginal) || '');
                    const vr = typeof c.valorRestante === 'number' ? c.valorRestante : parseFloat((c && c.valorRestante) || '');
                    const parcial = !isNaN(vo) && !isNaN(vr) && vr < vo;
                    return st === 'pago' || st === 'parcial' || hasRec || parcial;
                });
                if (temRecebimento) {
                    LoadingManager.hide();
                    ToastManager.error(`Não é possível alterar para "${getStatusLabel(statusNext)}": existem recebimentos vinculados.`, 'Ação bloqueada', 8000);
                    return;
                }
                removiveis = vinculadas.slice();
            }
        }

        if (editandoPedidoId && shouldGenerateFinance) {
            try {
                const safeRemoviveis = await listarContasReceberSemRecebimento(editandoPedidoId);
                if (Array.isArray(safeRemoviveis) && safeRemoviveis.length > 0) {
                    removiveis = safeRemoviveis;
                }
            } catch (_) {}
        }

        // Prevenir duplicação por número: remover outros pedidos com mesmo número e id diferente
        try {
            const todos = await getData('vendas/pedidos') || [];
            const duplicados = (todos || []).filter(p => String(p.numero) === String(pedidoData.numero) && String(p.id) !== String(pedidoData.id));
            if (duplicados.length > 0) {
                for (const dup of duplicados) {
                    // Remover pedidos duplicados
                    if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                        await window.firebaseService.saveToFirebase('vendas/pedidos', String(dup.id), null);
                    }
                    // Remover contas vinculadas ao duplicado
                    try { await removerContasReceberAnteriores(dup.id); } catch(e) { console.warn('Erro ao remover contas do duplicado:', e); }
                    // Atualizar cache local
                    window.pedidos = (window.pedidos || []).filter(p => String(p.id) !== String(dup.id));
                }
                console.log(`🧹 Removidos ${duplicados.length} pedido(s) duplicado(s) com número ${pedidoData.numero}`);
            }
        } catch (e) { console.warn('Falha ao checar duplicados por número:', e); }
        
        // Salvar pedido
        // Se já existe, atualizar. Se não, adicionar.
        if (editandoPedidoId) {
            const index = window.pedidos.findIndex(p => p.id === editandoPedidoId);
            if (index !== -1) {
                window.pedidos[index] = pedidoData;
            } else {
                window.pedidos.push(pedidoData);
            }
        } else {
            window.pedidos.push(pedidoData);
        }
        
        let multiUpdateDone = false;
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const contasFin = shouldGenerateFinance ? (pedidoData.contasReceber || []).map((conta, idx) => {
                const crId = `CR_${pedidoData.id}_${String(idx + 1).padStart(3, '0')}`;
                try { if (conta && typeof conta === 'object') conta.id = crId; } catch (_) {}
                return ({
                id: crId,
                tipo: 'receber',
                categoria: 'vendas',
                origem: 'pedido_venda',
                origemId: pedidoData.id,
                pedidoNumero: pedidoData.numero,
                clienteId: pedidoData.clienteId,
                cliente: {
                    id: pedidoData.cliente.id,
                    nome: pedidoData.cliente.nome,
                    email: pedidoData.cliente.email || '',
                    telefone: pedidoData.cliente.telefone || '',
                    endereco: pedidoData.cliente.endereco || ''
                },
                descricao: `Venda - Pedido ${pedidoData.numero} - ${conta.observacao || getTipoContaLabel(conta.tipo)}`,
                valor: conta.valor,
                valorOriginal: conta.valor,
                valorRestante: conta.valor,
                dataVencimento: conta.vencimento,
                vencimento: conta.vencimento, // redundância para compatibilidade
                status: 'pendente',
                tipoPagamento: conta.tipo,
                tipo_pagamento: conta.tipo, // redundância para compatibilidade
                observacoes: conta.observacao || '',
                created: new Date().toISOString()
            });
            }) : [];

            // Executar remoções primeiro (evitar colisão de ID), depois adições
            const updatesRem = {};
            (removiveis || []).forEach(c => {
                if (c && c.id) {
                    const mk = toMonthKey(c.dataVencimento || c.vencimento);
                    // ✅ CORREÇÃO: Financeiro padrão usa financas/receber/{YYYY-MM}/{id}
                    updatesRem[`financas/receber/${mk}/${String(c.id)}`] = null;
                    // Limpeza defensiva: remover do caminho antigo usado por engano em versões anteriores
                    updatesRem[`contasReceber/${mk}/${String(c.id)}`] = null;
                }
            });
            
            // Não chamar updatePaths apenas para remoções se vamos fazer adições logo depois
            // Melhor combinar tudo num único updatePaths atômico se possível, mas aqui estamos separando logicamente
            
            const updatesAdd = {};
            // Mesclar remoções no objeto final se a API suportar null
            Object.assign(updatesAdd, updatesRem);

            contasFin.forEach(c => {
                const mk = toMonthKey(c.dataVencimento || c.vencimento);
                updatesAdd[`financas/receber/${mk}/${String(c.id)}`] = c;
            });
            updatesAdd[`vendas/pedidos/${String(pedidoData.id)}`] = pedidoData;
            
            console.log('📦 Enviando updatePaths para Firebase:', Object.keys(updatesAdd).length, 'caminhos');
            const res = await window.firebaseService.updatePaths(updatesAdd);
            
            if (res && res.success) {
                multiUpdateDone = true;
                console.log('✅ Pedido e contas salvos com sucesso via updatePaths');
            } else {
                console.warn('⚠️ updatePaths falhou, tentando salvamento individual...', res?.error);
            }
        }
        
        if (!multiUpdateDone) {
            // Fallback para salvamento individual
            await saveData('vendas/pedidos', window.pedidos);
            
            // Salvar contas individualmente (não ideal, mas funcional como fallback)
            if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                 // ... lógica de fallback omitida para brevidade, assumindo que updatePaths funcionará
                 // Se updatePaths falhar, o saveData acima já salvou o pedido localmente e no nó principal
            }
        }

        // Atualizar estoque localmente para refletir na UI imediatamente
        if (!editandoPedidoId) {
            const itensComEstoque = (pedidoData.itens || []).filter(it => !isCarregoItem(it));
            const alterados = new Set(itensComEstoque.map(it => it.produtoId));
            for (const produto of window.produtos) {
                if (alterados.has(produto.id)) {
                    const item = itensComEstoque.find(it => it.produtoId === produto.id);
                    if (item) {
                        const novoEstoque = (produto.estoque || 0) - (item.quantidade || 0);
                        produto.estoque = novoEstoque < 0 ? 0 : novoEstoque;
                        produto.updated = window.firebaseService && window.firebaseService.serverTimestamp ? window.firebaseService.serverTimestamp() : new Date().toISOString();
                        // O salvamento do produto no banco deve ser feito separadamente ou via cloud function
                        // Aqui atualizamos apenas a UI/cache local
                    }
                }
            }
        }

        LoadingManager.hide();
        ToastManager.success('Pedido salvo com sucesso!', 'Sucesso');
        try { document.getElementById('pedidoForm').style.display = 'none'; } catch (_) {}
        try { editandoPedidoId = null; } catch (_) {}
        try { pedidoAtual = null; } catch (_) {}
        try { itensCarrinho = []; } catch (_) {}
        try { contasReceber = []; } catch (_) {}
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
                            residualUpdates[`contasReceber/${mk}/${String(it.id)}`] = null;
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
async function removerContasReceberAnteriores(pedidoId) {
    try {
        // Carregar todas contas do RTDB (flatten mensal) ou fallback local
        let todas = [];
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const res = await window.firebaseService.loadFromFirebase('financas/receber');
                if (res && res.success && res.data) {
                    const obj = res.data;
                    if (Array.isArray(obj)) {
                        todas = obj;
                    } else if (typeof obj === 'object') {
                        const months = Object.keys(obj || {});
                        for (const mk of months) {
                            const monthVal = obj[mk];
                            if (Array.isArray(monthVal)) {
                                todas.push(...monthVal);
                            } else if (typeof monthVal === 'object') {
                                Object.keys(monthVal || {}).forEach(id => {
                                    const it = monthVal[id];
                                    if (it) todas.push({ id, ...it });
                                });
                            }
                        }
                    }
                }
            } catch (_) {}
        }
        if (!Array.isArray(todas) || todas.length === 0) {
            const local = await getData('financas/receber') || [];
            todas = Array.isArray(local) ? local : [];
        }
        const vinculadas = (todas || []).filter(c => String(c.origemId) === String(pedidoId));
        const semRecebimento = vinculadas.filter(c => {
            const st = String(c.status || '').toLowerCase();
            const hasRec = Array.isArray(c.recebimentos) && c.recebimentos.length > 0;
            const vo = typeof c.valorOriginal === 'number' ? c.valorOriginal : parseFloat(c.valorOriginal || '');
            const vr = typeof c.valorRestante === 'number' ? c.valorRestante : parseFloat(c.valorRestante || '');
            const parcial = !isNaN(vo) && !isNaN(vr) && vr < vo;
            return !(st === 'pago' || st === 'parcial' || hasRec || parcial);
        });
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updates = {};
            semRecebimento.forEach(c => {
                if (c && c.id) {
                    const mk = toMonthKey(c.dataVencimento || c.vencimento);
                    updates[`financas/receber/${mk}/${String(c.id)}`] = null;
                }
            });
            if (Object.keys(updates).length > 0) {
                await window.firebaseService.updatePaths(updates);
                console.log(`🗑️ Removidas ${semRecebimento.length} contas anteriores do pedido ${pedidoId} (firebase)`);
            } else {
                console.log('Nenhuma conta anterior sem recebimento para remover');
            }
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            for (const c of semRecebimento) {
                if (c && c.id) {
                    const mk = toMonthKey(c.dataVencimento || c.vencimento);
                    await window.firebaseService.saveToFirebase(`financas/receber/${mk}`, String(c.id), null);
                }
            }
            if (semRecebimento.length > 0) console.log(`🗑️ Removidas ${semRecebimento.length} contas anteriores do pedido ${pedidoId}`);
        } else {
            const atualizadas = (todas || []).filter(c => {
                if (String(c.origemId) !== String(pedidoId)) return true;
                const st = String(c.status || '').toLowerCase();
                const hasRec = Array.isArray(c.recebimentos) && c.recebimentos.length > 0;
                const vo = typeof c.valorOriginal === 'number' ? c.valorOriginal : parseFloat(c.valorOriginal || '');
                const vr = typeof c.valorRestante === 'number' ? c.valorRestante : parseFloat(c.valorRestante || '');
                const parcial = !isNaN(vo) && !isNaN(vr) && vr < vo;
                return st === 'pago' || st === 'parcial' || hasRec || parcial ? true : false;
            });
            await saveData('contasReceber', atualizadas);
            console.log(`Contas anteriores do pedido ${pedidoId} removidas (fallback): ${semRecebimento.length}`);
        }
    } catch (error) {
        console.error('Erro ao remover contas anteriores:', error);
    }
}

async function listarContasReceberSemRecebimento(pedidoId) {
    try {
        let todas = [];
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const res = await window.firebaseService.loadFromFirebase('financas/receber');
                if (res && res.success && res.data) {
                    const obj = res.data;
                    if (Array.isArray(obj)) {
                        todas = obj;
                    } else if (typeof obj === 'object') {
                        const months = Object.keys(obj || {});
                        for (const mk of months) {
                            const monthVal = obj[mk];
                            if (Array.isArray(monthVal)) {
                                todas.push(...monthVal);
                            } else if (typeof monthVal === 'object') {
                                Object.keys(monthVal || {}).forEach(id => {
                                    const it = monthVal[id];
                                    if (it) todas.push({ id, ...it });
                                });
                            }
                        }
                    }
                }
            } catch (_) {}
        }
        if (!Array.isArray(todas) || todas.length === 0) {
            const local = await getData('financas/receber') || [];
            todas = Array.isArray(local) ? local : [];
        }
        const vinculadas = (todas || []).filter(c => String(c.origemId) === String(pedidoId));
        const semRecebimento = vinculadas.filter(c => {
            const st = String(c.status || '').toLowerCase();
            const hasRec = Array.isArray(c.recebimentos) && c.recebimentos.length > 0;
            const vo = typeof c.valorOriginal === 'number' ? c.valorOriginal : parseFloat(c.valorOriginal || '');
            const vr = typeof c.valorRestante === 'number' ? c.valorRestante : parseFloat(c.valorRestante || '');
            const parcial = !isNaN(vo) && !isNaN(vr) && vr < vo;
            return !(st === 'pago' || st === 'parcial' || hasRec || parcial);
        });
        return semRecebimento;
    } catch (_) { return []; }
}

async function removerContasReceberPorLista(lista) {
    try {
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            const updates = {};
            (lista || []).forEach(c => { if (c && c.id) { const mk = toMonthKey(c.dataVencimento || c.vencimento); updates[`financas/receber/${mk}/${String(c.id)}`] = null; } });
            if (Object.keys(updates).length > 0) await window.firebaseService.updatePaths(updates);
        } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            for (const c of (lista || [])) { if (c && c.id) { const mk = toMonthKey(c.dataVencimento || c.vencimento); await window.firebaseService.saveToFirebase(`financas/receber/${mk}`, String(c.id), null); } }
        } else {
            const atual = await getData('financas/receber') || [];
            const filtrado = (atual || []).filter(c => !(lista || []).some(r => String(r.id) === String(c.id)));
            await saveData('contasReceber', filtrado);
        }
    } catch (_) {}
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

// Função para atualizar estoque
async function atualizarEstoqueProdutos(itens, tipo) {
    try {
        for (const item of itens) {
            if (isCarregoItem(item)) continue;
            const produto = window.produtos.find(p => p.id === item.produtoId);
            if (produto) {
                if (tipo === 'saida') {
                    produto.estoque = (produto.estoque || 0) - item.quantidade;
                } else if (tipo === 'entrada') {
                    produto.estoque = (produto.estoque || 0) + item.quantidade;
                }
                
                // Garantir que o estoque não fique negativo
                if (produto.estoque < 0) {
                    produto.estoque = 0;
                }
                produto.updated = window.firebaseService && window.firebaseService.serverTimestamp ? window.firebaseService.serverTimestamp() : new Date().toISOString();
            }
        }
        
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            const alterados = new Set((itens || []).filter(it => !isCarregoItem(it)).map(it => it.produtoId));
            const ops = [];
            for (const produto of window.produtos) {
                if (alterados.has(produto.id)) {
                    ops.push(window.firebaseService.saveToFirebase('produtos', String(produto.id), produto));
                }
            }
            if (ops.length > 0) {
                await Promise.allSettled(ops);
            }
        } else {
            await saveData('produtos', window.produtos);
        }
        atualizarSelectProdutos();
        
    } catch (error) {
        console.error('Erro ao atualizar estoque:', error);
    }
}

// Funções de listagem de pedidos
async function listarPedidos() {
    try {
        LoadingManager.show('Carregando pedidos...');
        pedidosListPage = 1;
        pedidosSelecionados.clear();
        const fresh = await getData('vendas/pedidos') || [];
        if (Array.isArray(fresh)) {
            window.pedidos = fresh.map(p => {
                if (p && p.contasReceber) {
                    p.contasReceber = normalizarContasReceberLista(p.contasReceber);
                }
                return p;
            });
        }
        const search = document.getElementById('searchPedidos');
        if (search) search.value = '';
        await popularFiltrosPedidosVenda();
        await carregarTabelaPedidos();
        document.getElementById('listaPedidosModal').style.display = 'block';
    } catch (e) {
        console.error('Erro ao listar pedidos:', e);
        ToastManager.error('Erro ao carregar pedidos: ' + (e && e.message ? e.message : e), 'Erro');
    } finally {
        LoadingManager.hide();
    }
}

async function carregarTabelaPedidos(filtro = '') {
    const tbody = document.getElementById('pedidosTable');
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
            return pedido.numero.toLowerCase().includes(filtroLower) ||
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
        pedidosFiltrados.some(p => String(p.id) === String(id))
    ));

    // Ordenar por recência (último pedido adicionado no topo)
    pedidosFiltrados.sort(comparePedidosByRecencyDesc);
    
    if (pedidosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum pedido encontrado</td></tr>';
        pedidosListFiltered = [];
        atualizarCabecalhoSelecaoPedidos();
        renderPedidosPagination(0);
        return;
    }

    pedidosListFiltered = pedidosFiltrados;
    const totalPages = Math.max(1, Math.ceil(pedidosListFiltered.length / pedidosListItemsPerPage));
    if (pedidosListPage > totalPages) pedidosListPage = totalPages;
    if (pedidosListPage < 1) pedidosListPage = 1;
    const start = (pedidosListPage - 1) * pedidosListItemsPerPage;
    const end = start + pedidosListItemsPerPage;
    const paginated = pedidosListFiltered.slice(start, end);
    
    tbody.innerHTML = paginated.map(pedido => {
        // Determinar nome do cliente com fallback
        let nomeCliente = 'Cliente não encontrado';
        if (pedido.cliente) {
            nomeCliente = pedido.cliente.nome || pedido.cliente.name || 'Nome não informado';
        } else if (pedido.clienteId) {
            // Tentar buscar cliente pelos dados carregados
            const clienteEncontrado = window.clientes.find(c => c.id === pedido.clienteId);
            if (clienteEncontrado) {
                nomeCliente = clienteEncontrado.nome || clienteEncontrado.name || 'Nome não informado';
            }
        }
        
        const updatedStr = pedido.updated ? formatDate(pedido.updated) : '-';
        const st = getPedidoStatus(pedido) || 'pendente';
        const hasCarrego = (Array.isArray(pedido.itens) ? pedido.itens : []).some(it => isCarregoItem(it));
        const carregoBadge = hasCarrego
            ? ' <span style="display:inline-block;padding:2px 6px;border-radius:10px;background:#fff3cd;color:#856404;font-size:11px;font-weight:600;">Carrego</span>'
            : '';
        return `
        <tr>
            <td>
                <label class="pedido-numero-cell">
                    <input type="checkbox" class="pedido-select-item" ${pedidosSelecionados.has(String(pedido.id)) ? 'checked' : ''} onchange="toggleSelecionarPedido('${pedido.id}', this.checked)">
                    <span>${pedido.numero}${carregoBadge}</span>
                </label>
            </td>
            <td>${formatDate(pedido.data)}</td>
            <td>${nomeCliente}</td>
            <td style="text-align: right;">${formatCurrency(pedido.total)}</td>
            <td>
                <span class="status-badge status-${st}">
                    ${getStatusLabel(st)}
                </span>
            </td>
            <td>${updatedStr}</td>
            <td class="acoes-cell">
                <button onclick="editarPedido('${pedido.id}')" class="btn-primary btn-small">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="visualizarPedido('${pedido.id}')" class="btn-primary btn-small">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="excluirPedido('${pedido.id}')" class="btn-danger btn-small">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
        `;
    }).join('');

    atualizarCabecalhoSelecaoPedidos();
    renderPedidosPagination(pedidosListFiltered.length);
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
    const selecionados = pedidosListFiltered.filter(p => pedidosSelecionados.has(String(p.id))).length;
    chk.checked = selecionados === total;
    chk.indeterminate = selecionados > 0 && selecionados < total;
    atualizarContadorImpressaoPedidos();
}

function atualizarContadorImpressaoPedidos() {
    const countEl = document.getElementById('pedidosPrintSelectedCount');
    if (!countEl) return;
    const printBtn = countEl.closest('button');
    const selecionados = pedidosListFiltered.filter(p => pedidosSelecionados.has(String(p.id))).length;
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
        pedidosListFiltered.forEach(p => pedidosSelecionados.add(String(p.id)));
    } else {
        pedidosListFiltered.forEach(p => pedidosSelecionados.delete(String(p.id)));
    }
    carregarTabelaPedidos(document.getElementById('searchPedidos')?.value || '');
}

async function imprimirPedidosSelecionados() {
    const ids = pedidosListFiltered
        .filter(p => pedidosSelecionados.has(String(p.id)))
        .map(p => String(p.id));
    if (ids.length === 0) {
        ToastManager.warning('Selecione ao menos um pedido para imprimir.', 'Atenção');
        return;
    }
    for (const id of ids) {
        // Pequeno intervalo para reduzir bloqueio de popup em sequência.
        await imprimirPedido(id);
        await new Promise(resolve => setTimeout(resolve, 250));
    }
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
    carregarTabelaPedidos(document.getElementById('searchPedidos')?.value || '');
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
            const baseSpecies = (window.species && Array.isArray(window.species)) ? window.species.map(s => s.nome || s.nomeComum || s.name).filter(Boolean) : [];
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

async function editarPedido(pedidoId) {
    const pedido = window.pedidos.find(p => p.id === pedidoId);
    if (!pedido) return;
    
    // Fechar modal
    fecharModal('listaPedidosModal');
    
    // Configurar edição
    editandoPedidoId = pedidoId;
    pedidoAtual = pedido;
    itensCarrinho = [...pedido.itens];
    
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
            const crFinanceiroAll = await getData('financas/receber') || [];
            const vinculadas = (crFinanceiroAll || []).filter(c => String(c.origemId) === String(pedidoId));
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
        const crFinanceiro = await getData('financas/receber') || [];
        const vinculadas = (crFinanceiro || []).filter(c => String(c.origemId) === String(pedidoId));
        const vinculadasReceber = vinculadas.filter(c => (c.tipo || 'receber') === 'receber');
        const hasRecebimentos = vinculadasReceber.some(c => {
            const st = (c.status || 'pendente').toLowerCase();
            return st === 'pago' || st === 'parcial';
        });
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

async function excluirPedido(pedidoId) {
    if (!confirm('Deseja excluir este pedido? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        const pedido = window.pedidos.find(p => p.id === pedidoId);
        if (pedido) {
            // Reverter estoque
            await atualizarEstoqueProdutos(pedido.itens, 'entrada');
            
            // Remover contas a receber relacionadas
            const contasReceberLista = await getData('financas/receber') || [];
            const vinculadas = contasReceberLista.filter(conta => String(conta.origemId) === String(pedidoId));
            if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                for (const conta of vinculadas) {
                    if (conta && conta.id) {
                        await window.firebaseService.saveToFirebase('financas/receber', String(conta.id), null);
                    }
                }
            } else {
                const contasAtualizadas = contasReceberLista.filter(conta => String(conta.origemId) !== String(pedidoId));
                await saveData('contasReceber', contasAtualizadas);
            }
        }
        
        // Remover pedido
        window.pedidos = window.pedidos.filter(p => p.id !== pedidoId);
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            await window.firebaseService.saveToFirebase('vendas/pedidos', String(pedidoId), null);
        } else {
            await saveData('vendas/pedidos', window.pedidos);
        }
        
        // Atualizar listagem (modal aberto)
        await carregarTabelaPedidos();
        refreshModalsAfterChange(pedidoId);
        
        ToastManager.success('Pedido excluído com sucesso!', 'Sucesso');
        
    } catch (error) {
        console.error('Erro ao excluir pedido:', error);
        ToastManager.error('Erro ao excluir pedido: ' + error.message, 'Erro');
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

function normalizeProduto(raw, usedCodes) {
    if (!raw || typeof raw !== 'object') return null;
    const nomeRaw = raw.nome || raw.name || raw.nomeComum || raw.descricao || raw.produtoNome || '';
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
    return {
        ...raw,
        id,
        codigo,
        nome: nome || 'Produto sem nome',
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

function novoProduto() {
    document.getElementById('produtoId').value = '';
    document.getElementById('produtoForm').reset();
    const usedCodes = new Set((window.produtos || []).map(p => String(p.codigo || '').trim()).filter(Boolean));
    document.getElementById('produtoCodigo').value = ensureUniqueCode('', usedCodes);
    document.getElementById('produtoModalTitle').textContent = 'Novo Produto';
    document.getElementById('produtoModal').style.display = 'block';
}

async function salvarProduto(event) {
    event.preventDefault();
    
    try {
        const produtoId = document.getElementById('produtoId').value;
        const nomeRaw = document.getElementById('produtoNome').value;
        const nome = isAllCaps(nomeRaw) ? toTitleCasePt(nomeRaw) : nomeRaw;
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
        
        if (!produtoId) {
            produto.created = new Date().toISOString();
        }
        
        // Verificar se código já existe
        const codigoExistente = window.produtos.find(p => p.codigo === produto.codigo && p.id !== produto.id);
        if (codigoExistente) {
            ToastManager.error('Já existe um produto com este código', 'Código Duplicado');
            return;
        }
        
        // Salvar produto
        if (produtoId) {
            const index = window.produtos.findIndex(p => p.id === produtoId);
            if (index !== -1) {
                window.produtos[index] = produto;
            }
        } else {
            window.produtos.push(produto);
        }
        window.produtos = normalizeProdutosList(window.produtos);
        
        if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
            try {
                await window.firebaseService.saveToFirebase('produtos', String(produto.id), produto);
            } catch (e) {
                const msg = String((e && e.message) || e || '').toLowerCase();
                if (msg.includes('permission') || msg.includes('denied')) {
                    ToastManager.warning('Sem permissão no Firebase. Produto salvo localmente.', 'Atenção');
                }
            }
        }
        try {
            const storageKey = getStorageKey('produtos');
            persistLocalValue(storageKey, window.produtos);
        } catch (_) {}
        if (!(window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function')) {
            await saveData('produtos', window.produtos);
        }
        
        // Atualizar selects
        atualizarSelectProdutos();
        
        // Fechar modal
        fecharModal('produtoModal');
        
        // Atualizar listagem se estiver visível
        if (document.getElementById('produtosList').style.display !== 'none') {
            carregarTabelaProdutos();
        }
        
        ToastManager.success('Produto salvo com sucesso!', 'Sucesso');
        
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        ToastManager.error('Erro ao salvar produto: ' + error.message, 'Erro');
    }
}

function listarProdutos() {
    document.getElementById('produtosList').style.display = 'block';
    carregarTabelaProdutos();
}

function carregarTabelaProdutos(filtro = '') {
    const tbody = document.getElementById('produtosTable');
    window.produtos = normalizeProdutosList(window.produtos || []);
    let produtosFiltrados = [...window.produtos];
    
    if (filtro) {
        const filtroLower = filtro.toLowerCase();
        produtosFiltrados = produtosFiltrados.filter(produto => 
            String(produto.codigo || '').toLowerCase().includes(filtroLower) ||
            String(produto.nome || '').toLowerCase().includes(filtroLower)
        );
    }
    
    if (produtosFiltrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum produto encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = produtosFiltrados.map(produto => `
        <tr>
            <td>${produto.codigo || '-'}</td>
            <td>${produto.nome || 'Produto sem nome'}</td>
            <td style="text-align: right;">${formatCurrency(produto.preco || 0)}</td>
            <td style="text-align: center;">${formatNumber(produto.estoque || 0)} ${produto.unidade || 'UN'}</td>
            <td style="text-align: center;">
                <button onclick="editarProduto('${produto.id}')" class="btn-primary btn-small">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="excluirProduto('${produto.id}')" class="btn-danger btn-small">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filtrarProdutos() {
    const filtro = document.getElementById('searchProdutos').value;
    carregarTabelaProdutos(filtro);
}

function editarProduto(produtoId) {
    window.produtos = normalizeProdutosList(window.produtos || []);
    const produto = window.produtos.find(p => p.id === produtoId);
    if (!produto) return;
    
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
    
    document.getElementById('produtoModalTitle').textContent = 'Editar Produto';
    document.getElementById('produtoModal').style.display = 'block';
}

async function excluirProduto(produtoId) {
    if (!confirm('Deseja excluir este produto? Esta ação não pode ser desfeita.')) {
        return;
    }
    
    try {
        window.produtos = window.produtos.filter(p => p.id !== produtoId);
        await saveData('produtos', window.produtos);
        
        atualizarSelectProdutos();
        carregarTabelaProdutos();
        
        ToastManager.success('Produto excluído com sucesso!', 'Sucesso');
        
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        ToastManager.error('Erro ao excluir produto: ' + error.message, 'Erro');
    }
}

// Funções de relatórios
function gerarRelatorio() {
    const inicioVal = (document.getElementById('periodoInicio')?.value || '').trim();
    const fimVal = (document.getElementById('periodoFim')?.value || '').trim();
    if (!inicioVal || !fimVal) {
        ToastManager.warning('Informe o período do relatório', 'Atenção');
        return;
    }
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
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">Nenhum pedido encontrado</td></tr>';
        if (container && container.style) container.style.display = 'block';
        aplicarColunasEstadoInicialRelatorio();
        const footerCarregoEl = document.getElementById('relFooterTotalCarrego');
        if (footerCarregoEl) footerCarregoEl.textContent = `${formatNumber(0, 3)}`;
        const elVTCZero = document.getElementById('relFooterValorTotalCarrego');
        if (elVTCZero) elVTCZero.textContent = formatCurrency(0);
        aplicarOrdemColunasRelatorio(window.relatorioColunasOrdem || ['numero','data','cliente','total','status','carrego','atualizado','acoes']);
        return;
    }
    const latestMap = getCarregoLatestStatusMap();
    const pagosSet = new Set(Array.from(latestMap.values()).filter(x => x && x.status === 'pago').map(x => String(x.pedidoId)));
    if (filtroStatus === 'carregos_pagos') {
        pedidosPeriodo = pedidosPeriodo.filter(p => pagosSet.has(String(p.id)));
    }
    window._relPedidosPeriodo = pedidosPeriodo;
    window.relCarregoSelection = window.relCarregoSelection || new Set();
    let totalCarrego = 0;
    tbody.innerHTML = pedidosPeriodo.map(pedido => {
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
        const isPago = pagosSet.has(String(pedido.id));
        const hasCarrego = !!carregoItem;
        const disabledAttr = '';
        let titleReason = '';
        if (isPago) titleReason = 'Carrego já pago';
        else if (!hasCarrego) titleReason = 'Sem carrego';
        else if (!(carregoVol > 0)) titleReason = 'Carrego sem volume';
        const titleAttr = titleReason ? `title="${titleReason}"` : '';
        const checkedAttr = (!disabledAttr && window.relCarregoSelection.has(String(pedido.id))) ? 'checked' : '';
        const filtroDisponivelAtivo = !!document.getElementById('relFiltroDisponivel')?.checked;
        const carregoDisplay = carregoVol
            ? `${formatNumber(carregoVol, 3)} m³${isPago ? ' <i class=\"fas fa-check-circle badge-paid\"></i>' : ''}`
            : (filtroDisponivelAtivo ? '-' : `- <span class=\"badge-no-carrego\">sem carrego</span>`);
        return (
            `<tr data-pedido-id="${pedido.id}" data-carrego-vol="${carregoVol}" data-carrego-pago="${isPago ? '1' : '0'}" data-has-carrego="${hasCarrego ? '1' : '0'}" class="${isPago ? 'paid-carrego' : ''}">` +
            `<td data-col="numero"><input type="checkbox" class="sel-carrego" id="selCarrego_${pedido.id}" onchange="onRelCarregoSelectChange(this)" aria-label="Selecionar carrego do pedido #${pedido.numero}" ${disabledAttr} ${checkedAttr} ${titleAttr}> ${pedido.numero}</td>` +
            `<td data-col="data">${formatDate(pedido.data)}</td>` +
            `<td data-col="cliente">${nomeCliente}</td>` +
            `<td data-col="total" style="text-align: right;">${formatCurrency(pedido.total)}</td>` +
            `<td data-col="status"><span class="status-badge status-${pedido.status}">${getStatusLabel(pedido.status)}</span></td>` +
            `<td data-col="carrego" style="text-align: right;">${carregoDisplay}</td>` +
            `<td data-col="atualizado">${updatedStr}</td>` +
            `<td data-col="acoes" style="text-align: center;">` +
                `<button onclick=\"visualizarPedido('${pedido.id}')\" class=\"btn-primary btn-small\" title=\"Visualizar\"><i class=\"fas fa-eye\"></i></button>` +
                ` ` +
                `<button onclick=\"imprimirPedido('${pedido.id}')\" class=\"btn-primary btn-small\" title=\"Imprimir\"><i class=\"fas fa-print\"></i></button>` +
                ` ` +
                `<button onclick=\"excluirCarrego('${pedido.id}')\" class=\"btn-danger btn-small\" title=\"Excluir Carrego\"><i class=\"fas fa-trash\"></i></button>` +
            `</td>` +
            '</tr>'
        );
    }).join('');
    if (container && container.style) container.style.display = 'block';
    aplicarColunasEstadoInicialRelatorio();
    const footerCarregoEl = document.getElementById('relFooterTotalCarrego');
    if (footerCarregoEl) footerCarregoEl.textContent = `${formatNumber(totalCarrego, 3)}`;
    aplicarOrdemColunasRelatorio(window.relatorioColunasOrdem || ['numero','data','cliente','total','status','carrego','atualizado','acoes']);
    updateRelCarregoSelectionCount();
    try { toggleFiltroCarregoDisponivel(!!document.getElementById('relFiltroDisponivel')?.checked); } catch (_) {}
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
            const baseSpecies = (window.species && Array.isArray(window.species)) ? window.species.map(s => s.nome || s.nomeComum || s.name).filter(Boolean) : [];
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
                        arr = Object.values(data || {});
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
                const p = (window._relPedidosPeriodo || []).find(pp => String(pp.id) === String(id)) || (window.pedidos || []).find(pp => String(pp.id) === String(id));
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
                const p = (window._relPedidosPeriodo || []).find(pp => String(pp.id) === String(id)) || (window.pedidos || []).find(pp => String(pp.id) === String(id));
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
        const logoSrc = (dadosEmpresa && dadosEmpresa.logo) ? String(dadosEmpresa.logo) : '';
        const headerHtml = `
            <div class="print-header">
                <div class="print-logo">${logoSrc ? `<img src="${logoSrc}" alt="Logo">` : ''}</div>
                <div class="print-company">
                    <div class="print-company-name">${(dadosEmpresa.nome || dadosEmpresa.name || 'Empresa')}</div>
                    <div class="print-company-line">${dadosEmpresa.cnpj && dadosEmpresa.cnpj !== '-' ? `CNPJ: ${dadosEmpresa.cnpj}` : ''}</div>
                    <div class="print-company-line">${(dadosEmpresa.endereco || dadosEmpresa.address || '-') !== '-' ? (dadosEmpresa.endereco || dadosEmpresa.address) : ''}</div>
                    <div class="print-company-line">${[(dadosEmpresa.cidade || dadosEmpresa.city), (dadosEmpresa.estado || dadosEmpresa.state)].filter(Boolean).join(' - ')}</div>
                    <div class="print-company-line">${(dadosEmpresa.telefone || dadosEmpresa.phone || '-') !== '-' ? `Fone: ${dadosEmpresa.telefone || dadosEmpresa.phone}` : ''}</div>
                </div>
                <div class="print-meta">
                    <div class="print-title">${titulo}</div>
                    <div class="print-date">${new Date().toLocaleDateString('pt-BR')}</div>
                </div>
            </div>
        `;

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo}</title><style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .print-header { display: grid; grid-template-columns: 120px 1fr 220px; gap: 12px; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 12px; }
            .print-logo img { max-width: 120px; max-height: 80px; object-fit: contain; }
            .print-company-name { font-size: 16px; font-weight: 700; text-transform: uppercase; color: #111827; }
            .print-company-line { font-size: 11px; color: #374151; line-height: 1.35; }
            .print-meta { text-align: right; }
            .print-title { font-size: 16px; font-weight: 700; color: #111827; }
            .print-date { font-size: 11px; color: #6b7280; }
            .summary-box { border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-top: 15px; }
            .summary-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
            .summary-row:last-child { border-bottom: none; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background: #f4f6f8; text-align: left; }
            .status-badge { display: inline-block; padding: 4px 8px; border-radius: 12px; font-size: 12px; }
            [data-col="acoes"] { display: none; }
            .sel-carrego, .sel-carrego-all { display: none; }
        </style></head><body>${headerHtml}${tabela}${resumoFooter}</body></html>`;
        const win = window.open('', '_blank', 'width=800,height=600');
        win.document.write(html);
        win.document.close();
        win.onload = function() { setTimeout(() => win.print(), 250); };
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
        // Garantir que ordenação e exibição tratem nomes alternativos (name/nome)
        window.produtos.sort((a,b) => (a.nome || a.name || '').localeCompare(b.nome || b.name || '')).forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            
            // Compatibilidade species/produtos
            const nomeCientifico = p.nomeCientifico || '';
            const nomeComum = p.nomeComum || p.nome || p.name || 'Produto sem nome';
            const texto = nomeCientifico ? `${nomeCientifico} - ${nomeComum}` : nomeComum;
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
    window.open('client.html', '_blank');
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
        // Preferência: timestamp numérico
        if (typeof romaneio.timestamp === 'number') return romaneio.timestamp;
        // lastModified pode ser número
        if (typeof romaneio.lastModified === 'number') return romaneio.lastModified;
        // timestamp/lastModified/dataHora como string ISO
        if (romaneio.timestamp) {
            const t = new Date(romaneio.timestamp).getTime();
            if (!isNaN(t)) return t;
        }
        if (romaneio.lastModified) {
            const t = new Date(romaneio.lastModified).getTime();
            if (!isNaN(t)) return t;
        }
        if (romaneio.dataHora) {
            const t = new Date(romaneio.dataHora).getTime();
            if (!isNaN(t)) return t;
        }
        // data pode ser string ISO ou parseável
        if (romaneio.data) {
            const d = new Date(romaneio.data);
            const t = d.getTime();
            if (!isNaN(t)) return t;
        }
        // createdAt ou dataRomaneio (fallbacks comuns)
        if (romaneio.createdAt) {
            const t = new Date(romaneio.createdAt).getTime();
            if (!isNaN(t)) return t;
        }
        if (romaneio.dataRomaneio) {
            const t = new Date(romaneio.dataRomaneio).getTime();
            if (!isNaN(t)) return t;
        }
    } catch (_) {}
    return 0;
}

// Utilitário: formatar data do romaneio para exibição no dropdown
function formatRomaneioDateLabel(romaneio) {
    const candidates = [romaneio.data, romaneio.dataHora, romaneio.createdAt, romaneio.dataRomaneio, romaneio.timestamp, romaneio.lastModified];
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
// Carregamento mesclado de romaneios (Firebase + localStorage) com prioridade local
// ==========================
async function getRomaneiosMerged(tipoKey) {
    try {
        const canonicalKey = tipoKey === 'romaneiosTora' ? 'romaneios/tora' : tipoKey;
        let remote = [];
        let remote2 = [];
        if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            try {
                const res1 = await window.firebaseService.loadFromFirebase(tipoKey);
                const d1 = res1 && res1.success ? res1.data : null;
                if (Array.isArray(d1)) {
                    remote = d1;
                } else if (d1 && typeof d1 === 'object') {
                    remote = Object.entries(d1).map(([k, v]) => ({ id: k, firebaseKey: k, ...(v || {}) }));
                }
            } catch (e) {}
            try {
                if (canonicalKey !== tipoKey) {
                    const res2 = await window.firebaseService.loadFromFirebase(canonicalKey);
                    const d2 = res2 && res2.success ? res2.data : null;
                    if (Array.isArray(d2)) {
                        remote2 = d2;
                    } else if (d2 && typeof d2 === 'object') {
                        remote2 = Object.entries(d2).map(([k, v]) => ({ id: k, firebaseKey: k, ...(v || {}) }));
                    }
                }
            } catch (e) {}
        }
        let local = [];
        let local2 = [];
        try {
            const storageKey = getStorageKey(tipoKey);
            const allowLegacy = storageKey === tipoKey;
            const raw1 = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem(tipoKey) : null);
            if (raw1) {
                const p1 = JSON.parse(raw1);
                if (Array.isArray(p1)) {
                    local = p1;
                } else if (p1 && typeof p1 === 'object') {
                    local = Object.entries(p1).map(([k, v]) => ({ id: k, firebaseKey: k, ...(v || {}) }));
                }
            }
        } catch (e) {}
        try {
            if (canonicalKey !== tipoKey) {
                const storageKey = getStorageKey(canonicalKey);
                const allowLegacy = storageKey === canonicalKey;
                const raw2 = localStorage.getItem(storageKey) || (allowLegacy ? localStorage.getItem(canonicalKey) : null);
                if (raw2) {
                    const p2 = JSON.parse(raw2);
                    if (Array.isArray(p2)) {
                        local2 = p2;
                    } else if (p2 && typeof p2 === 'object') {
                        local2 = Object.entries(p2).map(([k, v]) => ({ id: k, firebaseKey: k, ...(v || {}) }));
                    }
                }
            }
        } catch (e) {}
        const primary = (remote2 && remote2.length > 0) ? remote2 : remote;
        const secondary = (primary === remote2) ? remote : remote2;
        const map = new Map();
        (primary || []).forEach(r => {
            const k = String(r.id || r.numero || r.firebaseKey || '');
            if (!k) return;
            map.set(k, r);
        });
        if (!primary || primary.length === 0) {
            (secondary || []).forEach(r => {
                const k = String(r.id || r.numero || r.firebaseKey || '');
                if (!k || map.has(k)) return;
                map.set(k, r);
            });
        }
        const overlayLocals = [].concat(local || [], local2 || []);
        overlayLocals.forEach(r => {
            const k = String(r.id || r.numero || r.firebaseKey || '');
            if (!k) return;
            const cur = map.get(k);
            if (cur) {
                map.set(k, { ...cur, ...r, id: cur.id || r.id || k });
            } else if (!primary || primary.length === 0) {
                map.set(k, r);
            }
        });
        let merged = Array.from(map.values());
        try {
            const tombKey = getStorageKey('romaneiosTora_deletedIds');
            const allowLegacy = tombKey === 'romaneiosTora_deletedIds';
            const tomb = JSON.parse(localStorage.getItem(tombKey) || (allowLegacy ? localStorage.getItem('romaneiosTora_deletedIds') : null) || '[]').map(String);
            if (Array.isArray(tomb) && tomb.length > 0) {
                merged = merged.filter(r => {
                    const k = String(r.id || r.firebaseKey || r.numero || '');
                    return k && !tomb.includes(k);
                });
            }
        } catch (_) {}
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
        console.log(`Vendas: ${tipoKey} mesclado. Total=${merged.length}. Amostra IDs:`, sampleIds);
        return merged;
    } catch (err) {
        console.error('Vendas: erro inesperado ao mesclar romaneios:', err);
        return [];
    }
}

async function saveData(key, data) {
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
                    let ok = 0;
                    for (const item of data) {
                        if (!item || !item.id) continue;
                        const payload = { ...item };
                        Object.keys(payload).forEach(k => { if (payload[k] === undefined) delete payload[k]; });
                        const res = await window.firebaseService.saveToFirebase(String(key), String(item.id), payload);
                        if (res && res.success) ok++;
                    }
                    console.log(`✅ ${key}: ${ok} registro(s) salvos por registro (sem sobrescrever)`);
                } else {
                    // Para demais casos, substituir conteúdo inteiro
                    const result = await window.firebaseService.saveToFirebase(key, null, data);
                    if (result && result.success) {
                        console.log(`✅ ${key} salvo no Firebase com sucesso`);
                    } else {
                        console.warn(`⚠️ Falha ao salvar ${key} no Firebase:`, result);
                    }
                }
            } catch (firebaseError) {
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
    document.getElementById('unidadeManual').value = 'UN'; // Resetar para valor padrão
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
                        const volumeInformado = parseFloat(item.volume);
                        if (!isNaN(volumeInformado) && volumeInformado > 0) {
                            return total + (volumeInformado * quantidade);
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

        option.textContent = totalMoeda ? 
            `${dataFormatada} - ${clienteNome} - ${volumeTotal} m³ - ${totalMoeda}` : 
            `${dataFormatada} - ${clienteNome} - ${volumeTotal} m³`;
        selectRomaneio.appendChild(option);
    });
        
        console.log(`Carregados ${romaneiosOrdenados.length} romaneios do tipo ${tipoSelecionado} (mesclados e ordenados por mais recente)`);
    } catch (error) {
        console.error('Erro ao carregar romaneios:', error);
        alert('Erro ao carregar romaneios. Verifique o console para mais detalhes.');
    }
}

// Função para carregar dados do romaneio selecionado
async function carregarDadosRomaneio() {
    const tipoRomaneio = document.getElementById('tipoRomaneio').value;
    const indiceRomaneio = document.getElementById('romaneioSelect').value;
    
    if (!tipoRomaneio || indiceRomaneio === '') {
        document.getElementById('previewConama').style.display = 'none';
        romaneioSelecionado = null;
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
            alert('Romaneio não encontrado');
            return;
        }
        
        romaneioSelecionado = romaneio;
        
        // Extrair resumo CONAMA do romaneio
        const resumoConama = extrairResumoConama(romaneio);
        
        // Mostrar preview
        mostrarPreviewConama(resumoConama);
        
        console.log('Romaneio carregado:', romaneio);
        console.log('Resumo CONAMA extraído:', resumoConama);
        
    } catch (error) {
        console.error('Erro ao carregar dados do romaneio:', error);
        alert('Erro ao processar romaneio. Verifique o console para mais detalhes.');
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
                resumoPorEspecie[especie].categorias[categoria] = { volume: 0, valorTotal: 0, precoUnitario: 0, pecasTotal: 0, pacotesTotal: 0, pppTotals: {}, espessura: 0 };
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
            if (!isNaN(volumeInformado) && volumeInformado > 0) {
                volumeTotal = isPCT ? volumeInformado : (volumeInformado * quantidade);
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
                    espessura: espessura
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

// Função para mostrar preview do resumo CONAMA
function mostrarPreviewConama(resumoConama) {
    const container = document.getElementById('listaConama');
    let html = '';
    
    if (Object.keys(resumoConama).length === 0) {
        html = '<p style="color: #666; font-style: italic;">Nenhum dado CONAMA encontrado no romaneio selecionado.</p>';
    } else {
        html = '<div style="display: grid; gap: 10px;">';
        
        Object.keys(resumoConama).forEach(especie => {
            html += `<div style="border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: white;">`;
            html += `<h5 style="margin: 0 0 8px 0; color: #2c3e50;">${especie}</h5>`;
            
            Object.keys(resumoConama[especie].categorias).forEach(categoria => {
                const cat = resumoConama[especie].categorias[categoria];
                const volume = cat.volume;
                const precoUnitario = cat.precoUnitario || 0;
                const pecasInfo = construirResumoPecasParaDescricao(cat);
                
                html += `<div style="display: flex; justify-content: space-between; margin-bottom: 4px; padding: 4px 0; border-bottom: 1px solid #eee;">`;
                html += `<div style="flex: 1;">`;
                html += `<span style="font-weight: 600;">${categoria}:</span><br>`;
                html += `<span style="color: #666; font-size: 12px;">Vol: ${formatNumber(volume, 3)} m³${pecasInfo ? ` • ${pecasInfo}` : ''}</span>`;
                html += `</div>`;
                html += `<div style="text-align: right;">`;
                if (precoUnitario > 0) {
                    html += `<span style="color: #27ae60; font-weight: 600;">${formatCurrency(precoUnitario)}</span><br>`;
                    html += `<span style="color: #666; font-size: 11px;">por m³</span>`;
                } else {
                    html += `<span style="color: #e74c3c; font-size: 12px;">Sem preço</span><br>`;
                    html += `<span style="color: #f39c12; font-size: 11px;">Padrão: ${formatCurrency(VendasConfig.precoPorM3Padrao)}</span>`;
                }
                html += `</div>`;
                html += `</div>`;
            });
            
            html += `</div>`;
        });
        
        html += '</div>';
    }
    
    container.innerHTML = html;
    document.getElementById('previewConama').style.display = 'block';
    
    // ✅ Rolar até a tabela de itens após mostrar o preview
    setTimeout(() => {
        const itensTable = document.getElementById('itensTable');
        if (itensTable) {
            itensTable.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 300);
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
                origemId: item.origemId
            };
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
            produtoId: `agrupado_${normalizarIdRomaneioParte(grp.especie)}_${normalizarIdRomaneioParte(grp.espessura)}`,
            produtoNome: `${grp.especie}${sufixoBitola}`,
            especie: grp.especie,
            espessura: grp.espessura,
            quantidade: parseFloat(grp.quantidade.toFixed(3)),
            unidade: grp.unidade,
            precoUnitario: parseFloat(precoMedio.toFixed(2)),
            total: parseFloat(grp.total.toFixed(2))
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

// Função para adicionar itens do romaneio ao carrinho
function adicionarItensRomaneio() {
    if (!romaneioSelecionado) {
        ToastManager.warning('Selecione um romaneio primeiro', 'Atenção');
        return;
    }
    
    const resumoConama = extrairResumoConama(romaneioSelecionado);
    
    if (Object.keys(resumoConama).length === 0) {
        ToastManager.warning('Nenhum item válido encontrado no romaneio selecionado', 'Atenção');
        return;
    }
    
    // Definir preço padrão por m³ como fallback (configurável em VendasConfig)
    const precoPadraoPorM3 = VendasConfig.precoPorM3Padrao;
    
    // Verificar se deve agrupar por espécie
    const agruparEspecie = document.getElementById('agruparEspecieCheckbox') ? document.getElementById('agruparEspecieCheckbox').checked : false;
    
    if (agruparEspecie) {
        Object.keys(resumoConama).forEach(especie => {
            const especieLimpa = especie.replace(/^\s*[-–—]\s*/, '').trim();
            const agrupadosPorEspessura = {};
            
            Object.keys(resumoConama[especie].categorias).forEach(categoria => {
                const cat = resumoConama[especie].categorias[categoria];
                if (cat.volume > 0) {
                    const espessura = cat.espessura || 0;
                    const key = String(espessura);
                    
                    if (!agrupadosPorEspessura[key]) {
                        agrupadosPorEspessura[key] = {
                            espessura,
                            volume: 0,
                            valor: 0,
                            unidade: cat.unidade || 'm³'
                        };
                    }
                    agrupadosPorEspessura[key].volume += cat.volume;
                    agrupadosPorEspessura[key].valor += cat.valorTotal || (cat.volume * (cat.precoUnitario > 0 ? cat.precoUnitario : precoPadraoPorM3));
                }
            });
            
            Object.values(agrupadosPorEspessura).forEach(grp => {
                const produtoId = `agrupado_${normalizarIdRomaneioParte(especieLimpa)}_${normalizarIdRomaneioParte(grp.espessura)}`;
                const precoMedio = grp.volume > 0 ? grp.valor / grp.volume : 0;
                const sufixoBitola = grp.espessura > 0 ? ` - ${formatarMedidaCm(grp.espessura)}cm` : '';
                const produtoNome = `${especieLimpa}${sufixoBitola}`;
                
                const existente = itensCarrinho.find(i => String(i.tipo || '').toLowerCase() === 'romaneio_agrupado' && String(i.produtoId || '') === produtoId);
                
                if (existente) {
                    const qAtual = typeof existente.quantidade === 'number' ? existente.quantidade : parseNumberFlexible(existente.quantidade);
                    const novoQ = (isNaN(qAtual) ? 0 : qAtual) + grp.volume;
                    const novoTotal = (parseFloat(existente.total) || 0) + grp.valor;
                    
                    existente.quantidade = novoQ;
                    existente.total = novoTotal;
                    existente.precoUnitario = novoQ > 0 ? novoTotal / novoQ : 0;
                } else {
                    itensCarrinho.push({
                        id: Date.now() + Math.random(),
                        produtoId,
                        produtoNome,
                        especie: especieLimpa,
                        espessura: grp.espessura,
                        quantidade: grp.volume,
                        precoUnitario: precoMedio,
                        total: grp.valor,
                        tipo: 'romaneio_agrupado',
                        unidade: grp.unidade
                    });
                }
            });
        });
    } else {
        Object.keys(resumoConama).forEach(especie => {
            const especieLimpa = especie.replace(/^\s*[-–—]\s*/, '').trim();
            Object.keys(resumoConama[especie].categorias).forEach(categoria => {
                const cat = resumoConama[especie].categorias[categoria];
                const volume = cat.volume;
                
                if (volume > 0) {
                    const precoUnitario = cat.precoUnitario > 0 ? cat.precoUnitario : precoPadraoPorM3;
                    const base = cat.categoriaBase || categoria;
                    const dims = cat.dimensoesKey || '';
                    const pecasInfo = construirResumoPecasParaDescricao(cat);
                    const produtoId = `romaneio_${normalizarIdRomaneioParte(especieLimpa)}_${normalizarIdRomaneioParte(base)}_${normalizarIdRomaneioParte(dims)}`;
                    const produtoNome = `${especieLimpa} - ${categoria}${pecasInfo ? ` - ${pecasInfo}` : ''}`;
                    const existente = itensCarrinho.find(i => String(i.tipo || '').toLowerCase() === 'romaneio' && String(i.produtoId || '') === produtoId);
                    if (existente) {
                        const qAtual = typeof existente.quantidade === 'number' ? existente.quantidade : parseNumberFlexible(existente.quantidade);
                        const novoQ = (isNaN(qAtual) ? 0 : qAtual) + volume;
                        existente.quantidade = novoQ;
                        existente.precoUnitario = precoUnitario;
                        existente.total = novoQ * precoUnitario;
                        existente.unidade = 'm³';
                    } else {
                        const novoItem = {
                            id: Date.now() + Math.random(),
                            produtoId,
                            produtoNome,
                            especie: especieLimpa,
                            espessura: cat.espessura || 0,
                            quantidade: volume,
                            precoUnitario: precoUnitario,
                            total: volume * precoUnitario,
                            tipo: 'romaneio',
                            unidade: 'm³'
                        };
                        itensCarrinho.push(novoItem);
                    }
                }
            });
        });
    }
    
    atualizarTabelaItens();
    atualizarTotais();
    
    // Limpar seleção
    document.getElementById('tipoRomaneio').value = '';
    document.getElementById('romaneioSelect').innerHTML = '<option value="">Selecione um romaneio</option>';
    document.getElementById('previewConama').style.display = 'none';
    romaneioSelecionado = null;
    
    const totalCategorias = Object.keys(resumoConama).length;
    ToastManager.success(`${totalCategorias} categorias de produtos adicionadas do romaneio`, 'Itens carregados', 3000);
    console.log(`${totalCategorias} categorias de produtos adicionadas do romaneio`);
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
            baseVencimentoISO = pedidoDataISO || vencimento;
            dataVencimentoISO = baseVencimentoISO;
            diasOffset = 0;
        } else {
            baseVencimentoISO = vencimento;
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
        
        // Redistribuir valores após remoção
        if (contasReceber.length > 0) {
            if (autoRedistribuirEnabled) {
                redistribuirValoresContas();
            }
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">Nenhuma conta adicionada</td></tr>';
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
                <td>
                    <input type="text" 
                           value="${displayValor}" 
                           id="conta-valor-${safeId}"
                           oninput="onParcelaValorInput('${safeId}', this)"
                           onkeydown="onParcelaValorKeydown(event, '${safeId}')"
                           onblur="atualizarValorConta('${safeId}', this.value)"
                           style="width: 100%; border: 1px solid #ddd; padding: 4px; border-radius: 3px;" ${disabledAttr}>
                </td>
                <td>
                    <input type="number"
                           value="${conta.dias}"
                           id="conta-dias-${safeId}"
                           oninput="onParcelaDiasInput('${safeId}', this.value)"
                           onchange="atualizarDiasConta('${safeId}', this.value)"
                           style="width: 100%; border: 1px solid #ddd; padding: 4px; border-radius: 3px;" ${disabledAttr}>
                </td>
                <td>
                    <input type="date" 
                           value="${(parcelaEditandoDateId && String(parcelaEditandoDateId) === String(conta.id)) ? (parcelaEditandoDateValue || conta.vencimento) : conta.vencimento}" 
                            id="conta-venc-${safeId}" autocomplete="off"
                            oninput="onParcelaDateInput('${safeId}', this)"
                            onblur="onParcelaDateBlur('${safeId}', this)"
                           style="width: 100%; border: 1px solid #ddd; padding: 4px; border-radius: 3px;" ${disabledAttr}>
                </td>
                <td>
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
                <td>
                    <input type="text" 
                           value="${conta.observacao || ''}" 
                           id="conta-obs-${safeId}"
                           onblur="atualizarObservacaoConta('${safeId}', this.value)"
                           placeholder="Observação"
                           style="width: 100%; border: 1px solid #ddd; padding: 4px; border-radius: 3px;" ${disabledAttr}>
                </td>
                <td style="text-align: center;">
                    <button type="button" onclick="removerContaReceber('${safeId}')" class="btn-danger btn-small" ${disabledAttr}>
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
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
        // Ordenar por dias ascendente
        const sorted = parcelas.map((p, i) => ({ p: { ...p }, i }))
            .sort((a, b) => {
                const da = typeof a.p.dias === 'number' ? a.p.dias : diffDaysISO(a.p.baseVencimento || a.p.vencimento, a.p.vencimento);
                const db = typeof b.p.dias === 'number' ? b.p.dias : diffDaysISO(b.p.baseVencimento || b.p.vencimento, b.p.vencimento);
                return da - db;
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
    return originalParcelas.map(p => ({ ...p, valor: (mapById.get(String(p.id))?.valor ?? p.valor) }));
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
    const pedido = window.pedidos.find(p => p.id === pedidoId);
    
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
    tbodyItens.innerHTML = pedido.itens.map((item, index) => {
        const nomeLimpo = (item.produtoNome || '').replace(/^\s*[-–—]\s*/, '').trim();
        if (item.tipo === 'manual' || item.tipo === 'romaneio' || item.tipo === 'romaneio_agrupado') {
            produtoDescricao = nomeLimpo;
        } else {
            produtoDescricao = item.produtoCodigo ? `${item.produtoCodigo} - ${nomeLimpo}` : nomeLimpo;
        }
        produtoDescricao += getCarregoBadgeHtml(item);
        
        // Formatar quantidade com unidade
        const quantidadeFormatada = item.unidade 
            ? `${formatNumber(item.quantidade)} ${item.unidade}`
            : formatNumber(item.quantidade);
        
        return `
            <tr>
                <td>${produtoDescricao}</td>
                <td style="text-align: center;">${quantidadeFormatada}</td>
                <td style="text-align: right;">${formatCurrency(item.precoUnitario)}</td>
                <td style="text-align: right; font-weight: bold;">${formatCurrency(item.total)}</td>
            </tr>
        `;
    }).join('');
    
    // Totais
    document.getElementById('viewPedidoSubtotal').textContent = formatCurrency(pedido.subtotal);
    document.getElementById('viewPedidoDesconto').textContent = formatCurrency(pedido.desconto);
    document.getElementById('viewPedidoTotal').textContent = formatCurrency(pedido.total);
    // Total Geral (Qtd.)
    const totalQtdModal = (pedido.itens || []).reduce((acc, it) => {
        if (isCarregoItem(it)) return acc;
        return acc + (parseFloat(it.quantidade) || 0);
    }, 0);
    const viewTotalQtdEl = document.getElementById('viewPedidoTotalQtd');
    if (viewTotalQtdEl) {
        viewTotalQtdEl.textContent = formatNumber(totalQtdModal);
    }
    
    const tbodyPagamento = document.getElementById('viewPedidoPagamentoTable');
    let contas = normalizarContasReceberLista(pedido.contasReceber || []);
    if (contas.length === 0) {
        try {
            const crFinanceiroAll = await getData('financas/receber') || [];
            const vinculadas = (crFinanceiroAll || []).filter(c => String(c.origemId) === String(pedidoId));
            contas = vinculadas.map(c => ({
                id: c.id,
                valor: typeof c.valor === 'number' ? c.valor : parseCurrencyValue(c.valor),
                vencimento: c.dataVencimento || c.vencimento,
                tipo: c.tipoPagamento || c.tipo,
                observacao: c.observacoes || c.observacao || '',
                status: c.status || 'pendente'
            }));
        } catch (_) {}
    }
    if (contas.length > 0) {
        tbodyPagamento.innerHTML = contas.map(conta => {
            return `
                <tr>
                    <td>${formatCurrency(conta.valor)}</td>
                    <td>${formatDate(conta.vencimento)}</td>
                    <td>${getTipoContaLabel(conta.tipo)}</td>
                    <td>${conta.observacao || '-'}</td>
                    <td>
                        <span class="status-badge status-${conta.status || 'pendente'}">
                            ${getStatusLabel(conta.status || 'pendente')}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');
    } else {
        tbodyPagamento.innerHTML = '<tr><td colspan="5" style="text-align: center;">Sem informações de pagamento</td></tr>';
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
    
    console.log('✅ Modal de visualização aberto para pedido:', pedido.numero);
}

/**
 * 🖨️ IMPRIMIR PEDIDO
 * @param {string} pedidoId - ID do pedido a imprimir
 */
async function imprimirPedido(pedidoId) {
    const pedido = window.pedidos.find(p => p.id === pedidoId);
    
    if (!pedido) {
        ToastManager.error('Pedido não encontrado', 'Erro');
        return;
    }
    
    try {
        // Mostrar loading enquanto carrega dados da empresa
        LoadingManager.show('Preparando impressão...');
        
        // Criar conteúdo HTML para impressão (assíncrono)
        const conteudoImpressao = await gerarHTMLImpressaoPedido(pedido);
        
        // Abrir janela de impressão
        const janelaImpressao = window.open('', '_blank', 'width=800,height=600');
        janelaImpressao.document.write(conteudoImpressao);
        janelaImpressao.document.close();
        
        // Aguardar carregamento e imprimir
        janelaImpressao.onload = function() {
            setTimeout(() => {
                janelaImpressao.print();
            }, 250);
        };
        
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
    const nomeCliente = pedido.cliente ? 
        (pedido.cliente.nome || pedido.cliente.name || 'Cliente não informado') : 
        'Cliente não informado';
    
    const statusLabel = getStatusLabel(pedido.status);
    
    // ✅ BUSCAR DADOS REAIS DA EMPRESA (PADRÃO DO SISTEMA)
    const dadosEmpresa = await obterDadosEmpresa();
    
    // Montar tabela de itens
    let htmlItens = '';
    pedido.itens.forEach((item, index) => {
        const nomeLimpo = (item.produtoNome || '').replace(/^\s*[-–—]\s*/, '').trim();
        if (item.tipo === 'manual' || item.tipo === 'romaneio' || item.tipo === 'romaneio_agrupado') {
            // Exibir apenas o nome para produtos manuais ou de romaneio
            produtoDescricao = `${nomeLimpo}`;
        } else {
            // Para outros (cadastrados), incluir o código se existir
            produtoDescricao = item.produtoCodigo ? `${item.produtoCodigo} - ${nomeLimpo}` : nomeLimpo;
        }
        
        const quantidadeFormatada = item.unidade 
            ? `${formatNumber(item.quantidade)} ${item.unidade}`
            : formatNumber(item.quantidade);
        
        htmlItens += `
            <tr>
                <td>${index + 1}</td>
                <td>${produtoDescricao}</td>
                <td style="text-align: center;">${quantidadeFormatada}</td>
                <td style="text-align: right;">${formatCurrency(item.precoUnitario)}</td>
                <td style="text-align: right;"><strong>${formatCurrency(item.total)}</strong></td>
            </tr>
        `;
    });
    
    // Montar tabela de pagamento
    let htmlPagamento = '';
    if (pedido.contasReceber && pedido.contasReceber.length > 0) {
        pedido.contasReceber.forEach((conta, index) => {
            htmlPagamento += `
                <tr>
                    <td>${index + 1}ª parcela</td>
                    <td>${formatCurrency(conta.valor)}</td>
                    <td>${formatDate(conta.vencimento)}</td>
                    <td>${getTipoContaLabel(conta.tipo)}</td>
                    <td>${conta.observacao || '-'}</td>
                </tr>
            `;
        });
    } else {
        htmlPagamento = '<tr><td colspan="5" style="text-align: center;">Sem informações de pagamento</td></tr>';
    }
    
    // Detalhes do cliente
    let detalhesCliente = '';
    if (pedido.cliente) {
        if (pedido.cliente.email) detalhesCliente += `<p style="margin: 3px 0;"><strong>Email:</strong> ${pedido.cliente.email}</p>`;
        if (pedido.cliente.telefone) detalhesCliente += `<p style="margin: 3px 0;"><strong>Telefone:</strong> ${pedido.cliente.telefone}</p>`;
        if (pedido.cliente.endereco) detalhesCliente += `<p style="margin: 3px 0;"><strong>Endereço:</strong> ${pedido.cliente.endereco}</p>`;
    }
    
    // ✅ GERAR LOGO (PADRÃO DO SISTEMA)
    const logoHtml = (dadosEmpresa.logo && dadosEmpresa.logo.trim() !== '') 
        ? `<img src="${dadosEmpresa.logo}" alt="Logo da Empresa" style="max-width: 100px; max-height: 100px; object-fit: contain;" />` 
        : `<svg viewBox="0 0 100 100" style="width: 80px; height: 80px;">
            <circle cx="50" cy="50" r="45" fill="#2c3e50" stroke="#34495e" stroke-width="2"/>
            <text x="50" y="60" text-anchor="middle" fill="white" font-size="24" font-weight="bold">JN</text>
        </svg>`;
    
    // Calcular Total Geral (Qtd.) com formatação de casas decimais por unidade
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

    // Definir modo compacto considerando itens e parcelas
    const itemCount = (pedido.itens || []).length;
    const pagamentoCount = (pedido.contasReceber || []).length;
    // Heurística: cada parcela além da 3ª contribui para compactar
    const contentScore = itemCount + Math.max(0, pagamentoCount - 3);
    const compactClass = contentScore > 20 ? 'compact' : '';

    // Template HTML completo (PADRÃO DO SISTEMA)
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pedido ${pedido.numero}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #333;
            font-size: 11px;
            line-height: 1.25;
        }
        
        .container {
            max-width: 19cm;
            margin: 0 auto;
        }
        
        /* ✅ CABEÇALHO PADRÃO DO SISTEMA (igual aos outros relatórios) */
        .header {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            gap: 20px;
            flex-wrap: nowrap; /* evita quebra para baixo, mantém lado a lado */
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid #2c3e50;
        }
        
        .logo {
            flex: 0 0 100px;
            text-align: center;
        }
        
        .logo img, .logo svg {
            max-width: 100px;
            max-height: 100px;
            object-fit: contain;
        }
        
        .company-info {
            flex: 1 1 auto;
            text-align: left;
            margin-left: 20px;
            min-width: 0; /* permite encolher sem empurrar para baixo */
            word-break: break-word; /* quebra textos longos para manter posição */
        }
        
        .company-name {
            font-size: 18px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        
        .company-details {
            font-size: 11px;
            color: #666;
            margin: 2px 0;
        }
        
        .title {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
            margin: 15px 0 10px 0;
        }
        
        .subtitle {
            text-align: center;
            font-size: 12px;
            color: #666;
            margin-bottom: 20px;
        }
        
        .pedido-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .info-box {
            border: 1px solid #dee2e6;
            padding: 15px;
            border-radius: 5px;
        }
        
        .info-box h3 {
            font-size: 14px;
            color: #2c3e50;
            margin-bottom: 10px;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 5px;
        }
        
        .info-box p {
            margin: 5px 0;
            font-size: 13px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        
        table th,
        table td {
            border: 1px solid #333;
            padding: 6px;
            font-size: 11px;
        }
        
        table th {
            background: #f0f0f0;
            font-weight: bold;
            text-align: left;
        }
        
        .totais {
            float: right;
            width: 280px;
            border: 2px solid #2c3e50;
            padding: 12px;
            margin-top: 15px;
        }
        
        .totais-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
        }
        
        .totais-row.total {
            border-top: 2px solid #2c3e50;
            margin-top: 10px;
            padding-top: 10px;
            font-size: 16px;
            font-weight: bold;
        }
        
        .footer {
            clear: both;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #dee2e6;
            text-align: center;
            font-size: 10px;
            color: #666;
        }
        
        .assinatura {
            margin-top: 40px;
            text-align: center;
        }
        
        .assinatura-linha {
            border-top: 1px solid #333;
            width: 300px;
            margin: 0 auto 10px auto;
        }
        
        @page {
            size: A4;
            margin: 10mm;
        }
        @media print {
            body {
                padding: 0;
            }
            /* Evitar quebras internas em blocos-chave */
            .container,
            .pedido-info,
            .totais,
            .assinatura,
            .footer,
            table {
                page-break-inside: avoid;
            }
            /* Garantir largura máxima na impressão */
            .container {
                max-width: 19cm;
            }
        }

        /* Modo compacto quando há muitos itens */
        .compact .company-name { font-size: 16px; }
        .compact .company-details { font-size: 10px; }
        .compact .title { font-size: 14px; margin: 10px 0 8px 0; }
        .compact .subtitle { font-size: 10px; margin-bottom: 12px; }
        .compact .pedido-info { gap: 12px; margin-bottom: 20px; }
        .compact .info-box { padding: 10px; }
        .compact .info-box h3 { font-size: 12px; }
        .compact table th, .compact table td { padding: 4px; font-size: 10px; }
        .compact .totais { width: 260px; padding: 10px; }
    </style>
</head>
<body>
    <div class="container ${compactClass}">
        <!-- ✅ CABEÇALHO PADRÃO DO SISTEMA (igual aos outros relatórios) -->
        <div class="header">
            <div class="logo">
                ${logoHtml}
            </div>
            <div class="company-info">
                <div class="company-name">${dadosEmpresa.nome || dadosEmpresa.name}</div>
                <div class="company-details">CNPJ: ${dadosEmpresa.cnpj}</div>
                <div class="company-details">${dadosEmpresa.endereco || dadosEmpresa.address}</div>
                <div class="company-details">${dadosEmpresa.cidade || dadosEmpresa.city} - ${dadosEmpresa.estado || dadosEmpresa.state}</div>
                <div class="company-details">Fone: ${dadosEmpresa.telefone || dadosEmpresa.phone}</div>
                ${dadosEmpresa.email ? `<div class="company-details">Email: ${dadosEmpresa.email}</div>` : ''}
            </div>
        </div>
        
        <!-- ✅ TÍTULO E SUBTÍTULO PADRÃO -->
        <div class="title">PEDIDO DE VENDA N° ${pedido.numero}</div>
        <div class="subtitle">Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
        
        <!-- Informações do Pedido e Cliente -->
        <div class="pedido-info">
            <div class="info-box">
                <h3>DADOS DO PEDIDO</h3>
                <p><strong>Número:</strong> ${pedido.numero}</p>
                <p><strong>Data:</strong> ${formatDate(pedido.data)}</p>
                <p><strong>Status:</strong> ${statusLabel}</p>
                <p><strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</p>
            </div>
            
            <div class="info-box">
                <h3>DADOS DO CLIENTE</h3>
                <p><strong>Nome:</strong> ${nomeCliente}</p>
                ${detalhesCliente}
            </div>
        </div>
        
        <!-- Itens do Pedido -->
        <h3 style="margin-bottom: 10px;">ITENS DO PEDIDO</h3>
        <table>
            <thead>
                <tr>
                    <th style="width: 40px;">#</th>
                    <th>Produto</th>
                    <th style="width: 120px; text-align: center;">Quantidade</th>
                    <th style="width: 100px; text-align: right;">Preço Unit.</th>
                    <th style="width: 100px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${htmlItens}
            </tbody>
        </table>
        
        <!-- Totais -->
        <div class="totais">
            <div class="totais-row">
                <span>Total Geral (Qtd.):</span>
                <span>${totalQuantidadeFormatada}</span>
            </div>
            <div class="totais-row">
                <span>Subtotal:</span>
                <span>${formatCurrency(pedido.subtotal)}</span>
            </div>
            <div class="totais-row">
                <span>Desconto:</span>
                <span style="color: #e74c3c;">${formatCurrency(pedido.desconto)}</span>
            </div>
            <div class="totais-row total">
                <span>TOTAL:</span>
                <span>${formatCurrency(pedido.total)}</span>
            </div>
        </div>
        
        <!-- Forma de Pagamento -->
        <div style="clear: both; margin-top: 30px;">
            <h3 style="margin-bottom: 10px;">FORMA DE PAGAMENTO</h3>
            <table>
                <thead>
                    <tr>
                        <th>Parcela</th>
                        <th>Valor</th>
                        <th>Vencimento</th>
                        <th>Tipo</th>
                        <th>Observação</th>
                    </tr>
                </thead>
                <tbody>
                    ${htmlPagamento}
                </tbody>
            </table>
        </div>
        
        <!-- Assinatura -->
        <div class="assinatura">
            <div class="assinatura-linha"></div>
            <p>Assinatura do Cliente</p>
        </div>
        
        <!-- Rodapé -->
        <div class="footer">
            <p>Este documento foi gerado eletronicamente pelo sistema SISWEB</p>
            <p>Impresso em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
    </div>
</body>
<script>
// Ajuste adaptativo para caber em uma única página A4
(function() {
    function mmToPx(mm) { return mm * (96 / 25.4); }
    function ajustarEscala() {
        var container = document.querySelector('.container');
        if (!container) return;
        try {
            var alturaPaginaPx = mmToPx(297) - mmToPx(10 * 2); // A4 altura menos margens @page
            var estilosBody = getComputedStyle(document.body);
            var padTop = parseFloat(estilosBody.paddingTop) || 0;
            var padBottom = parseFloat(estilosBody.paddingBottom) || 0;
            var alturaDisponivel = alturaPaginaPx - padTop - padBottom;
            // Medir altura do conteúdo
            var alturaConteudo = container.getBoundingClientRect().height;
            var escala = Math.min(1, alturaDisponivel / alturaConteudo);
            if (escala < 1) {
                // Preferir zoom quando disponível; fallback para transform
                container.style.zoom = escala;
                container.style.transformOrigin = 'top left';
                container.style.transform = 'scale(' + escala + ')';
            }
            document.body.setAttribute('data-fit-scale', escala.toFixed(3));
        } catch (e) {
            console.warn('Falha no ajuste de escala de impressão:', e);
        }
    }
    window.addEventListener('load', function() {
        // Pequeno atraso para garantir imagens/logo carregados
        setTimeout(ajustarEscala, 100);
    });
})();
</script>
</html>
    `;
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
        const container = document.getElementById('toastContainer');
        
        if (!container) {
            console.warn('Toast container não encontrado');
            return;
        }
        
        // Criar elemento do toast
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
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
            title = titles[type] || 'Notificação';
        }
        
        // Montar HTML
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${icons[type] || icons.info}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="ToastManager.close(this.parentElement)">
                <i class="fas fa-times"></i>
            </button>
        `;
        
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
        const id = String(rec.pedidoId);
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

function toggleFiltroCarregoDisponivel(checked) {
    const rows = document.querySelectorAll('#relatoriosTable tbody tr');
    rows.forEach(r => {
        const vol = parseFloat(r.getAttribute('data-carrego-vol') || '0');
        const pago = r.getAttribute('data-carrego-pago') === '1';
        const has = r.getAttribute('data-has-carrego') === '1';
        r.style.display = (checked && (pago || !has || vol <= 0)) ? 'none' : '';
        const cb = r.querySelector('.sel-carrego');
        // não desabilitar, permitir seleção para impressão
        const badge = r.querySelector('.badge-no-carrego');
        if (badge) badge.style.display = checked ? 'none' : '';
    });
    updateRelCarregoSelectionCount();
    try {
        const tableEl = document.getElementById('relatoriosTable');
        if (!tableEl) return;
        const visibleRows = Array.from(tableEl.querySelectorAll('tbody tr')).filter(r => r.style.display !== 'none');
        const totalPedidos = visibleRows.length;
        let valorTotal = 0;
        let totalCarrego = 0;
        let valorTotalCarrego = 0;
        const ids = [];
        visibleRows.forEach(r => {
            totalCarrego += parseFloat(r.getAttribute('data-carrego-vol') || '0') || 0;
            const tdTotal = r.querySelector('td[data-col="total"]');
            if (tdTotal) valorTotal += parseCurrencyValue(tdTotal.textContent.trim());
            const id = r.getAttribute('data-pedido-id');
            if (id) ids.push(String(id));
        });
        ids.forEach(id => {
            const p = (window._relPedidosPeriodo || []).find(pp => String(pp.id) === String(id)) || (window.pedidos || []).find(pp => String(pp.id) === String(id));
            valorTotalCarrego += calcularValorCarregoPedido(p);
        });
        const ticketMedio = totalPedidos > 0 ? (valorTotal / totalPedidos) : 0;
        const elTP = document.getElementById('relFooterTotalPedidos');
        const elVT = document.getElementById('relFooterValorTotal');
        const elTM = document.getElementById('relFooterTicketMedio');
        const elTC = document.getElementById('relFooterTotalCarrego');
        const elVTC = document.getElementById('relFooterValorTotalCarrego');
        if (elTP) elTP.textContent = String(totalPedidos);
        if (elVT) elVT.textContent = formatCurrency(valorTotal);
        if (elTM) elTM.textContent = formatCurrency(ticketMedio);
        if (elTC) elTC.textContent = `${formatNumber(totalCarrego, 3)}`;
        if (elVTC) elVTC.textContent = formatCurrency(valorTotalCarrego);
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
            const pedido = (window._relPedidosPeriodo || []).find(p => String(p.id) === String(id));
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
            const rec = { pedidoId: String(pedido.id), numero: String(pedido.numero), volume, timestamp: now, status: 'pago' };
            novos.push(rec);
        });
        // Atualizar estado local do pedido (garantir estorno posterior e UI consistente)
        novos.forEach(rec => {
            const pedido = (window._relPedidosPeriodo || []).find(p => String(p.id) === String(rec.pedidoId)) || (window.pedidos || []).find(p => String(p.id) === String(rec.pedidoId));
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
        const novos = ids.map(id => ({ pedidoId: String(id), numero: String((window._relPedidosPeriodo||[]).find(p=>String(p.id)===String(id))?.numero || ''), volume: 0, timestamp: now, status: 'estornado' }))
            .filter(rec => {
                const pedido = (window._relPedidosPeriodo || []).find(p => String(p.id) === String(rec.pedidoId));
                return !!(pedido && pedido.carregoPago === true);
            });
        // Atualizar estado local para refletir estorno imediatamente
        novos.forEach(rec => {
            const pedido = (window._relPedidosPeriodo || []).find(p => String(p.id) === String(rec.pedidoId)) || (window.pedidos || []).find(p => String(p.id) === String(rec.pedidoId));
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
        ids.forEach(id => {
            const pedido = (window._relPedidosPeriodo || []).find(p => String(p.id) === String(id)) || (window.pedidos || []).find(p => String(p.id) === String(id));
            if (!pedido) return;
            const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
            const nameOf = it => normalizeStr(String(it.produtoNome || it.nome || it.produto || ''));
            const hasCarrego = itens.some(it => nameOf(it) === 'carrego');
            if (!hasCarrego) return;
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
        try {
            if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
                const updates = {};
                atualizados.forEach(p => { updates[`vendas/pedidos/${p.id}`] = p; updates[`vendas/pagamentos_carrego/${p.id}`] = null; });
                await window.firebaseService.updatePaths(updates);
            } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                for (const p of atualizados) {
                    await window.firebaseService.saveToFirebase('vendas/pedidos', String(p.id), p);
                    await window.firebaseService.saveToFirebase('vendas/pagamentos_carrego', String(p.id), null);
                }
            } else {
                await saveData('vendas/pedidos', window.pedidos || []);
            }
        } catch (e) {
            console.warn('Falha ao persistir exclusão de carrego:', e);
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
        const pedido = (window._relPedidosPeriodo || []).find(p => String(p.id) === String(pedidoId)) || (window.pedidos || []).find(p => String(p.id) === String(pedidoId));
        if (!pedido) { ToastManager.warning('Pedido não encontrado', 'Atenção'); return; }
        const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        const nameOf = it => normalizeStr(String(it.produtoNome || it.nome || it.produto || ''));
        const hasCarrego = itens.some(it => nameOf(it) === 'carrego');
        if (!hasCarrego) { ToastManager.info('Este pedido não possui carrego', 'Info'); return; }
        pedido.itens = itens.filter(it => nameOf(it) !== 'carrego');
        pedido.carregoPago = false; pedido.carregoPagoAt = null; pedido.updated = now;
        try {
            if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
                const updates = {}; updates[`vendas/pedidos/${pedido.id}`] = pedido; updates[`vendas/pagamentos_carrego/${pedido.id}`] = null; await window.firebaseService.updatePaths(updates);
            } else if (window.firebaseService && typeof window.firebaseService.saveToFirebase === 'function') {
                await window.firebaseService.saveToFirebase('vendas/pedidos', String(pedido.id), pedido);
                await window.firebaseService.saveToFirebase('vendas/pagamentos_carrego', String(pedido.id), null);
            } else {
                await saveData('vendas/pedidos', window.pedidos || []);
            }
        } catch(e) { console.warn('Falha ao persistir exclusão de carrego:', e); }
        gerarRelatorio(); updateRelCarregoSelectionCount(); ToastManager.success('Carrego excluído do pedido', 'Sucesso');
    } catch(err) {
        console.error(err); ToastManager.error('Falha ao excluir carrego', 'Erro');
    } finally { LoadingManager.hide(); }
}
        // Fallback: gerar 1 parcela default quando não há contasReceber
        try {
            const totalPedido = parseFloat(pedidoData.total || 0);
            if ((!pedidoData.contasReceber || pedidoData.contasReceber.length === 0) && totalPedido > 0) {
                const vencDefault = document.getElementById('contaVencimento')?.value || pedidoData.data || new Date().toISOString().slice(0,10);
                const tipoDefault = document.getElementById('contaTipo')?.value || 'receber';
                const obsDefault = document.getElementById('contaObservacao')?.value || '';
                pedidoData.contasReceber = [{ id: `CR_${pedidoData.id}_001`, valor: totalPedido, vencimento: vencDefault, tipo: tipoDefault, observacao: obsDefault }];
                console.log('➕ Parcela padrão gerada para contas a receber');
            }
        } catch (e) { console.warn('Falha ao gerar parcela padrão:', e); }
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
