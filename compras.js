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

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';

        toast.innerHTML = `
            <div class="toast-icon"><i class="fas fa-${icon}"></i></div>
            <div class="toast-content">
                <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
                <div class="toast-message">${message}</div>
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

function persistLocalValue(storageKey, data) {
    try {
        if (window.SiswebStorage && typeof window.SiswebStorage.write === 'function') {
            return window.SiswebStorage.write(storageKey, data) !== false;
        }
    } catch (_) {}
    localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
}

// Carregar dados (Firebase > LocalStorage)
async function getData(key) {
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
let pedidosListPage = 1;
const pedidosListItemsPerPage = 10;
let pedidosListFiltered = [];
let pedidosSelecionados = new Set();
let produtoEmEdicaoId = null;

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
    if (tabId === 'clientes') window.location.href = 'fornecedor.html'; // Redireciona para gestão
}

function novoPedido(gerarNumero = true) {
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
    window.produtos.sort((a,b) => (a.nome || a.name || '').localeCompare(b.nome || b.name || '')).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        
        // Compatibilidade: species usa 'price', produtos usa 'preco'
        const nomeCientifico = p.nomeCientifico || '';
        const nomeComum = p.nomeComum || p.nome || p.name || 'Produto sem nome';
        const texto = nomeCientifico ? `${nomeCientifico} - ${nomeComum}` : nomeComum;
        
        const preco = p.preco || p.price || 0;
        
        opt.textContent = texto;
        opt.dataset.preco = preco; // Guardar preço para preenchimento automático
        prodSelect.appendChild(opt);
    });
}

function getProdutoNomeCadastro(produto) {
    return String(produto?.nomeComum || produto?.nome || produto?.name || produto?.nomeCientifico || '').trim();
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
    await saveData('species', window.produtos);
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
        table.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum produto cadastrado.</td></tr>';
        return;
    }
    const ordered = lista.slice().sort((a, b) => getProdutoNomeCadastro(a).localeCompare(getProdutoNomeCadastro(b)));
    table.innerHTML = ordered.map(produto => `
        <tr>
            <td>${String(produto.codigo || '-')}</td>
            <td>${getProdutoNomeCadastro(produto) || '-'}</td>
            <td>${formatCurrency(getProdutoPrecoCadastro(produto))}</td>
            <td>${formatNumber(getProdutoEstoqueCadastro(produto), 3)}</td>
            <td>
                <button onclick="editarProdutoCadastro('${String(produto.id || '').replace(/'/g, "\\'")}')" class="btn-primary btn-small"><i class="fas fa-edit"></i></button>
                <button onclick="excluirProdutoCadastro('${String(produto.id || '').replace(/'/g, "\\'")}')" class="btn-danger btn-small"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Nenhum item adicionado</td></tr>';
        return;
    }
    
    itensPedido.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.produtoNome}</td>
            <td>${formatNumber(item.quantidade)} ${item.unidade || ''}</td>
            <td>${formatCurrency(item.precoUnitario)}</td>
            <td>${formatCurrency(item.total)}</td>
            <td>
                <button onclick="removerItem(${index})" class="btn-danger btn-small"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #666;">Nenhuma conta adicionada</td></tr>';
        atualizarTotalContasPagar();
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
                <td>
                    <input type="text" 
                           id="conta-valor-${safeId}"
                           value="${displayValor}" 
                           oninput="onParcelaValorInput('${safeId}', this)"
                           onkeydown="onParcelaValorKeydown(event, '${safeId}')"
                           onblur="onParcelaValorBlur('${safeId}', this.value)"
                           style="width: 120px;">
                </td>
                <td>
                    <input type="number"
                           id="conta-dias-${safeId}"
                           value="${conta.dias}"
                           min="0"
                           oninput="onParcelaDiasPagarInput('${safeId}', this.value)"
                           onchange="atualizarDiasContaPagar('${safeId}', this.value)"
                           style="width: 90px;">
                </td>
                <td>
                    <input type="date" 
                           id="conta-venc-${safeId}"
                           value="${displayData}" 
                           oninput="onParcelaDateInput('${safeId}', this)"
                           onblur="onParcelaDateBlur('${safeId}', this)"
                           style="width: 140px;">
                </td>
                <td>
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
                <td>
                    <input type="text" 
                           id="conta-obs-${safeId}"
                           value="${conta.observacao || ''}" 
                           onblur="atualizarObservacaoConta('${safeId}', this.value)"
                           placeholder="Observação"
                           style="width: 100%;">
                </td>
                <td>
                    <button type="button" onclick="removerConta('${safeId}')" class="btn-danger btn-small" title="Remover">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    atualizarTotalContasPagar();

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
        // Se estiver editando, tentar remover contas antigas para evitar duplicidade
        let vinculadas = [];
        try {
            const contasAll = await getData('financas/pagar') || [];
            vinculadas = (contasAll || []).filter(c => String(c && c.origemId) === String(pedido.id));
        } catch (_) {}

        if (vinculadas.length > 0) {
            const temPagamento = vinculadas.some(c => {
                const st = String(c && c.status ? c.status : '').toLowerCase();
                return st === 'pago' || st === 'parcial';
            });
            if (temPagamento && pedidoEmEdicao) {
                throw new Error('Este pedido possui pagamentos realizados. Cancele os pagamentos antes de salvar.');
            }
            vinculadas.forEach(c => {
                const oldId = c && c.id ? c.id : null;
                if (!oldId) return;
                const oldMk = toMonthKey(c.vencimento || c.dataVencimento);
                updates[`financas/pagar/${oldMk}/${oldId}`] = null;
                updates[`financas/pagar/${oldId}`] = null;
            });
            
            // ✅ CORREÇÃO CRÍTICA: Se a data de vencimento foi alterada, o 'oldMk' pode estar errado
            // Devemos buscar TODAS as contas vinculadas a este pedido no banco para garantir remoção
            // Mas em um update atômico não podemos ler.
            // Solução: O 'pedidoEmEdicao' contém os dados CARREGADOS (antigos).
            // Então 'c.vencimento' aqui é a data ANTIGA. Isso deve funcionar para remover do mês antigo.
            // PORÉM, se o usuário editou a data na interface, o objeto 'contasPagar' (global) já tem a NOVA data.
            // O 'pedidoEmEdicao' é uma cópia feita no início da edição? Sim, em editarPedido: `pedidoEmEdicao = pedido;`
            // Mas atenção: `pedido` é uma referência ao objeto em `window.compras`.
            // Se `window.compras` for mutado durante a edição (ex: onParcelaDateBlur), `pedidoEmEdicao` também muda?
            // Não, `pedidoEmEdicao` é atribuído por referência.
            // Se `contasPagar` (global da edição) é modificado, ele NÃO altera `pedidoEmEdicao.contasPagar` automaticamente
            // a menos que `pedidoEmEdicao.contasPagar` aponte para o mesmo array.
            // Em editarPedido: `contasPagar = [...pedido.contasPagar];` (Cópia rasa do array)
            // Então `pedidoEmEdicao.contasPagar` PRESERVA os dados originais (vencimentos antigos).
            // LOGO, `oldMk` deve estar correto (baseado na data original).
            
            // MAS, se o pedido foi salvo anteriormente com uma estrutura de ID diferente ou mês diferente?
            // Vamos garantir removendo também pelo ID que estamos usando agora, caso seja o mesmo?
            // Se o ID for preservado, ok.
        }
        
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
                
                // Salvar referência no caminho legado (sem mês) para garantir compatibilidade de leitura
                // (alguns módulos leem direto de contasPagar/{id})
                // Se o sistema financeiro usa apenas mk, isso pode ser redundante, mas seguro.
                // Mas cuidado: se mudar o mês, o ID antigo no caminho legado será sobrescrito corretamente (mesmo ID).
                // Se o sistema usa APENAS particionado, ok. Se usa "flat", precisamos atualizar lá também.
                // O `getData('financas/pagar')` do financeiro geralmente varre tudo ou usa índice.
                // Vamos salvar no flat também se o sistema suportar.
                // O código original fazia: `updates['financas/pagar/' + oldId] = null` (linha 876)
                // Então devemos salvar no flat também.
                updates[`financas/pagar/${contaId}`] = conta;
            });
        }
        
        // 3. Executar atualização no Firebase
        let savedToFirebase = false;
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            console.log('📦 Enviando updatePaths para Firebase:', Object.keys(updates).length, 'caminhos');
            const res = await window.firebaseService.updatePaths(updates);
            if (res.success) {
                savedToFirebase = true;
                console.log('✅ Pedido e financeiro salvos com sucesso via updatePaths');
            } else {
                console.warn('⚠️ updatePaths falhou, tentando fallback...', res.error);
                ToastManager.warning('Erro ao salvar no servidor. Tentando salvar localmente.');
            }
        } else {
            console.warn('Firebase Service não disponível.');
        }
        
        // 4. Atualizar cache local e fallback
        const index = window.compras.findIndex(p => p.id === pedido.id);
        if (index >= 0) {
            window.compras[index] = pedido;
        } else {
            window.compras.push(pedido);
        }
        
        // Salvar em 'compras' (legado/backup)
        await saveData('compras', window.compras);
        
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

    if (fornecedorSelect && fornecedorSelect.options.length <= 1) {
        const fornecedores = Array.isArray(window.fornecedores) ? window.fornecedores : [];
        fornecedores.forEach(f => {
            const opt = document.createElement('option');
            opt.value = String(f.id || f.nome || f.name || '');
            opt.textContent = f.nome || f.name || 'Fornecedor';
            fornecedorSelect.appendChild(opt);
        });
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
        pedidosListFiltered.some(p => String(p.id) === String(id))
    ));

    if (pedidosListFiltered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum pedido encontrado</td></tr>';
        atualizarCabecalhoSelecaoPedidos();
        renderPedidosPagination(0);
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
        tr.innerHTML = `
            <td>
                <label class="pedido-numero-cell">
                    <input type="checkbox" class="pedido-select-item" ${pedidosSelecionados.has(String(p.id)) ? 'checked' : ''} onchange="toggleSelecionarPedido('${p.id}', this.checked)">
                    <span>${p.numero}</span>
                </label>
            </td>
            <td>${formatDate(p.data)}</td>
            <td>${p.fornecedor?.nome || '-'}</td>
            <td>${formatCurrency(p.total)}</td>
            <td><span class="status-badge status-${p.status}">${p.status}</span></td>
            <td>${atualizadoEm}</td>
            <td style="text-align: center;">
                <button onclick="editarPedido('${p.id}')" class="btn-primary btn-small" title="Editar"><i class="fas fa-edit"></i></button>
                <button onclick="visualizarPedido('${p.id}')" class="btn-primary btn-small" title="Visualizar"><i class="fas fa-eye"></i></button>
                <button onclick="excluirPedido('${p.id}')" class="btn-danger btn-small" title="Excluir"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

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
    renderListaPedidosCompras();
}

async function imprimirPedidosSelecionados() {
    const ids = pedidosListFiltered
        .filter(p => pedidosSelecionados.has(String(p.id)))
        .map(p => String(p.id));
    if (ids.length === 0) {
        ToastManager.warning('Selecione ao menos um pedido para imprimir.');
        return;
    }
    for (const id of ids) {
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
    renderListaPedidosCompras();
}

// --- Funções de Visualização e Impressão (Novas) ---

async function visualizarPedido(id) {
    const pedido = window.compras.find(p => p.id === id);
    if (!pedido) return;
    
    window.pedidoVisualizando = id;
    
    // Preencher dados do cabeçalho
    document.getElementById('viewPedidoNumero').textContent = pedido.numero;
    document.getElementById('viewPedidoData').textContent = formatDate(pedido.data);
    
    const statusLabel = pedido.status.charAt(0).toUpperCase() + pedido.status.slice(1);
    document.getElementById('viewPedidoStatus').innerHTML = 
        `<span class="status-badge status-${pedido.status}">${statusLabel}</span>`;
    
    document.getElementById('viewPedidoFornecedor').textContent = pedido.fornecedor?.nome || 'Fornecedor não informado';
    
    // Tabela de Itens
    const tbodyItens = document.getElementById('viewPedidoItensTable');
    tbodyItens.innerHTML = (pedido.itens || []).map(item => `
        <tr>
            <td>${item.produtoNome}</td>
            <td style="text-align: center;">${formatNumber(item.quantidade)} ${item.unidade || ''}</td>
            <td style="text-align: right;">${formatCurrency(item.precoUnitario)}</td>
            <td style="text-align: right; font-weight: bold;">${formatCurrency(item.total)}</td>
        </tr>
    `).join('');
    
    // Totais
    document.getElementById('viewPedidoSubtotal').textContent = formatCurrency(pedido.subtotal);
    document.getElementById('viewPedidoDesconto').textContent = formatCurrency(pedido.desconto);
    document.getElementById('viewPedidoTotal').textContent = formatCurrency(pedido.total);
    
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
                <td>${formatCurrency(typeof conta.valor === 'number' ? conta.valor : parseCurrency(conta.valor))}</td>
                <td>${formatDate(conta.vencimento)}</td>
                <td>${getTipoContaLabel(conta.tipo || conta.tipoPagamento)}</td>
                <td>${conta.observacao || conta.descricao || '-'}</td>
                <td><span class="status-badge status-${conta.status || 'pendente'}">${conta.status || 'pendente'}</span></td>
            </tr>
        `).join('');
    } else {
        tbodyPagamento.innerHTML = '<tr><td colspan="5" style="text-align: center;">Sem informações de pagamento</td></tr>';
    }
    
    document.getElementById('visualizarPedidoModal').style.display = 'block';
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
            if (typeof getData === 'function') {
                const companiesPayload = await getData('companies');
                companyData = pickCompanyFromPayload(companiesPayload);
            }
        }

        if (!companyData || (!companyData.nome && !companyData.name)) {
            try {
                const raw = localStorage.getItem('company_info');
                if (raw) companyData = JSON.parse(raw) || companyData;
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
        const logoCandidate = empresaFinal.logoBase64 || empresaFinal.logoUrl || empresaFinal.logoURL || empresaFinal.logoData || empresaFinal.logo || '';
        empresaFinal.logo = normalizeLogo(logoCandidate);

        return empresaFinal;
    } catch (e) {
        console.warn('Erro ao obter dados empresa:', e);
        return {};
    }
}

async function imprimirPedido(pedidoId) {
    const pedido = window.compras.find(p => p.id === pedidoId);
    if (!pedido) return;
    
    LoadingManager.show('Preparando impressão...');
    
    try {
        const dadosEmpresa = await obterDadosEmpresa();
        
        // Gerar Logo
        const logoHtml = (dadosEmpresa.logo && dadosEmpresa.logo.trim() !== '') 
            ? `<img src="${dadosEmpresa.logo}" alt="Logo da Empresa" style="max-width: 100px; max-height: 100px; object-fit: contain;" />` 
            : `<svg viewBox="0 0 100 100" style="width: 80px; height: 80px;">
                <circle cx="50" cy="50" r="45" fill="#2c3e50" stroke="#34495e" stroke-width="2"/>
                <text x="50" y="60" text-anchor="middle" fill="white" font-size="24" font-weight="bold">SW</text>
            </svg>`;

        const janelaImpressao = window.open('', '_blank', 'width=800,height=600');
        
        const html = `
            <html>
            <head>
                <title>Pedido de Compra ${pedido.numero}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 11px; line-height: 1.25; }
                    .header { display: flex; align-items: center; gap: 20px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #2c3e50; }
                    .logo { flex: 0 0 100px; text-align: center; }
                    .company-info { flex: 1; }
                    .company-name { font-size: 18px; font-weight: bold; color: #2c3e50; margin-bottom: 5px; text-transform: uppercase; }
                    .report-title { font-size: 24px; font-weight: bold; color: #2c3e50; text-align: right; }
                    .info-box { background: #f8f9fa; border: 1px solid #ddd; padding: 10px; border-radius: 4px; margin-bottom: 15px; }
                    .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    .table th, .table td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                    .table th { background-color: #f2f2f2; font-weight: bold; }
                    .totals { text-align: right; margin-top: 10px; border-top: 2px solid #333; padding-top: 10px; }
                    .total-row { font-size: 14px; margin-bottom: 5px; }
                    .total-final { font-size: 16px; font-weight: bold; color: #2c3e50; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">${logoHtml}</div>
                    <div class="company-info">
                        <div class="company-name">${dadosEmpresa.nome || dadosEmpresa.name || 'Empresa não informada'}</div>
                        <div>${dadosEmpresa.cnpj ? `CNPJ: ${dadosEmpresa.cnpj}` : ''}</div>
                        <div>${dadosEmpresa.endereco || dadosEmpresa.address || ''}</div>
                        <div>${dadosEmpresa.cidade || dadosEmpresa.city || ''} - ${dadosEmpresa.estado || dadosEmpresa.state || ''}</div>
                        <div>${dadosEmpresa.telefone || dadosEmpresa.phone || ''}</div>
                    </div>
                    <div class="report-title">
                        PEDIDO DE COMPRA<br>
                        #${pedido.numero}
                    </div>
                </div>

                <div class="info-box">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <strong>Fornecedor:</strong> ${pedido.fornecedor?.nome || '-'}<br>
                            <strong>Data:</strong> ${formatDate(pedido.data)}<br>
                            <strong>Status:</strong> ${getStatusLabel(pedido.status)}
                        </div>
                        <div style="text-align: right;">
                            <strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}
                        </div>
                    </div>
                </div>

                <h3>Itens do Pedido</h3>
                <table class="table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">#</th>
                            <th>Produto</th>
                            <th style="text-align: center; width: 100px;">Qtd</th>
                            <th style="text-align: right; width: 120px;">Preço Unit.</th>
                            <th style="text-align: right; width: 120px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(pedido.itens || []).map((i, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${i.produtoNome}</td>
                                <td style="text-align: center;">${formatNumber(i.quantidade)} ${i.unidade || ''}</td>
                                <td style="text-align: right;">${formatCurrency(i.precoUnitario)}</td>
                                <td style="text-align: right;">${formatCurrency(i.total)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="totals">
                    <div class="total-row">Subtotal: ${formatCurrency(pedido.subtotal)}</div>
                    <div class="total-row">Desconto: ${formatCurrency(pedido.desconto)}</div>
                    <div class="total-final">Total Geral: ${formatCurrency(pedido.total)}</div>
                </div>

                ${pedido.contasPagar && pedido.contasPagar.length > 0 ? `
                    <h3 style="margin-top: 20px;">Forma de Pagamento</h3>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Vencimento</th>
                                <th>Tipo</th>
                                <th>Observação</th>
                                <th style="text-align: right;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pedido.contasPagar.map(c => `
                                <tr>
                                    <td>${formatDate(c.vencimento)}</td>
                                    <td>${getTipoContaLabel(c.tipo || c.tipoPagamento)}</td>
                                    <td>${c.observacao || '-'}</td>
                                    <td style="text-align: right;">${formatCurrency(typeof c.valor === 'number' ? c.valor : parseCurrency(c.valor))}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : ''}
            </body>
            </html>
        `;
        
        janelaImpressao.document.write(html);
        janelaImpressao.document.close();
        janelaImpressao.onload = function() {
            janelaImpressao.print();
        };
    } catch (e) {
        console.error(e);
        ToastManager.error('Erro ao imprimir pedido.');
    } finally {
        LoadingManager.hide();
    }
}

async function editarPedido(id) {
    const pedido = window.compras.find(p => p.id === id);
    if (!pedido) return;
    
    // Verificar se existem pagamentos realizados
    LoadingManager.show('Verificando pagamentos...');
    try {
        const contasAll = await getData('financas/pagar') || [];
        const vinculadas = contasAll.filter(c => String(c.origemId) === String(id));
        const temPagamento = vinculadas.some(c => {
            const st = (c.status || '').toLowerCase();
            return st === 'pago' || st === 'parcial';
        });
        
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
        const contasAll = await getData('financas/pagar') || [];
        const vinculadas = contasAll.filter(c => String(c.origemId) === String(id));
        const temPagamento = vinculadas.some(c => {
            const st = (c.status || '').toLowerCase();
            return st === 'pago' || st === 'parcial';
        });
        
        if (temPagamento) {
            throw new Error('Não é possível excluir: existem pagamentos realizados vinculados a este pedido.');
        }
        
        const pedido = window.compras.find(p => p.id === id);
        
        // Preparar atualizações atômicas
        const updates = {};
        
        // 1. Remover Pedido
        updates[`pedidosCompra/${id}`] = null;
        
        // 2. Remover Contas a Pagar
        vinculadas.forEach(c => {
            const mk = toMonthKey(c.vencimento);
            if (c.id) {
                updates[`financas/pagar/${mk}/${c.id}`] = null;
                updates[`financas/pagar/${c.id}`] = null; // Legacy path
            }
        });
        
        // 3. Executar no Firebase
        if (window.firebaseService && typeof window.firebaseService.updatePaths === 'function') {
            await window.firebaseService.updatePaths(updates);
        }
        
        // 5. Atualizar Local
        window.compras = window.compras.filter(p => p.id !== id);
        await saveData('compras', window.compras);
        
        // Atualizar cache de contas pagar localmente também, se necessário
        const novasContasLocal = contasAll.filter(c => String(c.origemId) !== String(id));
        await saveData('contasPagar', novasContasLocal);
        
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

async function carregarFornecedores() {
    window.fornecedores = await getData('fornecedores') || [];
    // Fallback: tentar carregar 'clients' se 'fornecedores' estiver vazio (legado)
    if (window.fornecedores.length === 0) {
        const clients = await getData('clients');
        if (clients && clients.length > 0) window.fornecedores = clients;
    }
    atualizarSelectFornecedores();
}

function atualizarSelectFornecedores(selectedId = null) {
    const select = document.getElementById('fornecedorSelect');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = '<option value="">Selecione um fornecedor</option>';
    
    window.fornecedores.sort((a,b) => (a.nome||'').localeCompare(b.nome||'')).forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.nome || f.name || 'Sem Nome';
        select.appendChild(opt);
    });
    
    if (selectedId) select.value = selectedId;
    else if (currentVal) select.value = currentVal;
}

// Modal Rápido de Fornecedor
window.abrirModalFornecedor = function() {
    document.getElementById('modalFornecedor').style.display = 'block';
};

window.fecharModalFornecedor = function() {
    document.getElementById('modalFornecedor').style.display = 'none';
};

window.salvarFornecedorInline = async function(event) {
    event.preventDefault();
    LoadingManager.show('Salvando fornecedor...');
    
    const novoFornecedor = {
        id: `FOR-${Date.now()}`,
        nome: document.getElementById('fornNome').value,
        documento: document.getElementById('fornDocumento').value,
        telefone: document.getElementById('fornTelefone').value,
        email: document.getElementById('fornEmail').value,
        endereco: document.getElementById('fornEndereco').value,
        cidade: document.getElementById('fornCidade').value,
        estado: document.getElementById('fornEstado').value
    };
    
    window.fornecedores.push(novoFornecedor);
    await saveData('fornecedores', window.fornecedores);
    
    atualizarSelectFornecedores(novoFornecedor.id);
    fecharModalFornecedor();
    LoadingManager.hide();
    ToastManager.success('Fornecedor cadastrado!');
    document.querySelector('#modalFornecedor form').reset();
};

// ============================================================================
// 6. INICIALIZAÇÃO DO SISTEMA
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    LoadingManager.show('Inicializando sistema de compras...');
    
    try {
        await Promise.all([
            carregarFornecedores(),
            (async () => {
                // Tentar carregar species primeiro (padrão novo)
                let items = await getData('species');
                if (!items || items.length === 0) {
                    // Fallback para produtos (legado)
                    items = await getData('produtos');
                }
                window.produtos = items || [];
            })()
        ]);
        
        // Popular select de produtos cadastrados usando função dedicada
        atualizarSelectProdutos();
        
    } catch (e) {
        console.error('Erro na inicialização:', e);
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
});

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
window.abrirModalFornecedor = abrirModalFornecedor;
window.fecharModalFornecedor = fecharModalFornecedor;
window.salvarFornecedorInline = salvarFornecedorInline;
window.filtrarPedidos = filtrarPedidos;
window.toggleSelecionarPedido = toggleSelecionarPedido;
window.toggleSelecionarTodosPedidos = toggleSelecionarTodosPedidos;
window.imprimirPedidosSelecionados = imprimirPedidosSelecionados;
window.filtrarFornecedoresSelect = () => {}; // Placeholder se necessário

// Integração com sistema de cidades (cities.js)
window.loadCities = function(uf, targetId) {
    if (typeof window.populateCitySelect === 'function') {
        window.populateCitySelect(uf, targetId);
    } else {
        console.warn('Função populateCitySelect (cities.js) não disponível.');
    }
};

// Integração para o modal legado (clientModal)
window.carregarCidadesPorEstado = function(uf) {
    // O modal legado usa 'clientCity' como ID fixo
    window.loadCities(uf, 'clientCity');
};

// Integração com sistema de modal externo (client-modal-handler)
window.addEventListener('suppliers:updated', (e) => {
    if (e.detail) {
        carregarFornecedores().then(() => {
            atualizarSelectFornecedores(e.detail.id);
        });
    }
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
        
        // Ordenar por data (mais recente primeiro)
        dados.sort((a, b) => {
            const da = new Date(a.dataHora || a.data || 0).getTime();
            const db = new Date(b.dataHora || b.data || 0).getTime();
            return (isNaN(db) ? 0 : db) - (isNaN(da) ? 0 : da);
        });
        
        dados.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id || r.firebaseKey;
            
            const data = r.dataHora ? new Date(r.dataHora).toLocaleDateString('pt-BR') : 'S/D';
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
                
                // Priorizar volumeLiquido para Toras, ou volume/quantidade genérico
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
