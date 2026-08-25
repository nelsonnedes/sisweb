/**
 * Pré-Romaneio - Sistema Unificado
 * Gerencia abas: Pacote, Toda Largura, Pés, Toras
 */

// Estado Global
let currentTab = 'PCT'; // PCT, TL, PES, TORA
let romaneioItens = [];
let romaneioId = null;
let preRomaneioEmEdicao = null;
let clienteSelecionado = null;
let fornecedorSelecionado = null; // Para Tora
let itemEmEdicaoIndex = -1; // -1 = nenhum item em edição

// Paginação da Tabela Principal
const ITENS_POR_PAGINA_INICIAL = 5;
const OPCOES_ITENS_POR_PAGINA = [10, 20, 25, 50, 100];
const CHAVE_STORAGE_ITENS_POR_PAGINA = 'preromaneio_items_per_page';
let itensPorPagina = ITENS_POR_PAGINA_INICIAL;
let paginaAtual = 1;
try {
    const savedItemsPerPage = parseInt(localStorage.getItem(CHAVE_STORAGE_ITENS_POR_PAGINA) || '', 10);
    if (OPCOES_ITENS_POR_PAGINA.includes(savedItemsPerPage)) itensPorPagina = savedItemsPerPage;
} catch (_) {}

const PREROMANEIO_SORT_COLUMNS_SERRADOS = [
    { key: 'especie' },
    { key: 'comprimento', type: 'number' },
    { key: 'espessura', type: 'number' },
    { key: 'largura', type: 'number' },
    { key: 'quantidade', type: 'number' },
    { key: 'pecas', type: 'number' },
    { key: 'volume', type: 'number' },
    { key: 'preco', type: 'number' },
    { key: 'total', type: 'number' },
    { key: 'acoes', sortable: false }
];

const PREROMANEIO_SORT_COLUMNS_TORAS = [
    { key: 'plaqueta', accessor: (item) => item.placa || item.plaqueta || '' },
    { key: 'custodia', accessor: (item) => normalizarCamposGeoTora(item).custodia || '' },
    { key: 'especie' },
    { key: 'rodo', type: 'number' },
    { key: 'comprimento', type: 'number' },
    { key: 'ocos', accessor: (item) => `${item.oco1 || 0}/${item.oco2 || 0}` },
    { key: 'desconto', type: 'number' },
    { key: 'volume', type: 'number' },
    { key: 'compGeo', type: 'number', accessor: (item) => normalizarCamposGeoTora(item).compGeo || 0 },
    { key: 'x1', type: 'number', accessor: (item) => normalizarCamposGeoTora(item).x1 || 0 },
    { key: 'x2', type: 'number', accessor: (item) => normalizarCamposGeoTora(item).x2 || 0 },
    { key: 'x3', type: 'number', accessor: (item) => normalizarCamposGeoTora(item).x3 || 0 },
    { key: 'x4', type: 'number', accessor: (item) => normalizarCamposGeoTora(item).x4 || 0 },
    { key: 'volumeGeo', type: 'number', accessor: (item) => normalizarCamposGeoTora(item).volumeGeo || 0 },
    { key: 'preco', type: 'number' },
    { key: 'total', type: 'number' },
    { key: 'acoes', sortable: false }
];

function resolveTenantId() {
    try {
        const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
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
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Pré-Romaneio Inicializado');
    mudarAba('PCT'); // Default
    
    // Configurar listeners de data atual
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('dataRomaneio');
    const dateInputTora = document.getElementById('dataRomaneioTora');
    if (dateInput) dateInput.value = today;
    if (dateInputTora) dateInputTora.value = today;

    // Configurar Autocomplete se os inputs existirem
    const clienteInput = document.getElementById('clienteInput');
    if (clienteInput) {
        clienteInput.addEventListener('input', function() { showClientSuggestions(this); });
        // Fechar sugestões ao clicar fora
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.autocomplete-container')) {
                closeAllSuggestions();
            }
        });
    }

    setupFieldFormatting();
    const oco1Tora = document.getElementById('oco1Tora');
    const oco2Tora = document.getElementById('oco2Tora');
    const compTora = document.getElementById('compTora');
    if (oco1Tora) oco1Tora.addEventListener('input', atualizarDescontoOcoTora);
    if (oco2Tora) oco2Tora.addEventListener('input', atualizarDescontoOcoTora);
    if (compTora) compTora.addEventListener('input', atualizarDescontoOcoTora);
    atualizarDescontoOcoTora();
    configurarCamposGeoTora();
    setupEnterNavigation();
});

function parseCurrencyBR(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const s = String(value).replace('R$', '').trim();
    if (!s) return 0;
    const clean = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
    const n = parseFloat(clean);
    return Number.isFinite(n) ? n : 0;
}

function formatNumberFixed(input, decimals) {
    if (!input) return;
    input.addEventListener('blur', () => {
        const v = input.value;
        if (v === '' || v === null || v === undefined) return;
        const n = parseFloat(String(v).replace(',', '.'));
        if (!Number.isFinite(n)) return;
        input.value = n.toFixed(decimals);
    });
}

function setupFieldFormatting() {
    try {
        formatNumberFixed(document.getElementById('espessura'), 2);
        formatNumberFixed(document.getElementById('largura'), 1);
        formatNumberFixed(document.getElementById('comprimento'), 2);
        formatNumberFixed(document.getElementById('rodoTora'), 2);
        formatNumberFixed(document.getElementById('compTora'), 2);
        formatNumberFixed(document.getElementById('oco1Tora'), 2);
        formatNumberFixed(document.getElementById('oco2Tora'), 2);
        formatNumberFixed(document.getElementById('compGeoTora'), 2);
        formatNumberFixed(document.getElementById('x1Tora'), 2);
        formatNumberFixed(document.getElementById('x2Tora'), 2);
        formatNumberFixed(document.getElementById('x3Tora'), 2);
        formatNumberFixed(document.getElementById('x4Tora'), 2);
    } catch (_) {}
}

function calculateVolumeSerrado(tab, comprimentoM, larguraCm, espessuraCm, quantidade, pecasPorPacote) {
    const compIn = parseFloat(comprimentoM) || 0;
    const larg = parseFloat(larguraCm) || 0;
    const esp = parseFloat(espessuraCm) || 0;
    const qtd = parseInt(quantidade) || 0;
    const ppp = parseInt(pecasPorPacote) || 1;
    if (compIn <= 0 || larg <= 0 || esp <= 0 || qtd <= 0) return 0;

    if (tab === 'PES') {
        return (esp * larg * compIn * qtd * ppp) / 1000000000;
    }

    const compCm = (tab === 'PCT' || tab === 'TL') ? compIn : (compIn * 100);
    const volumeUnitario = (compCm * larg * esp) / 1000000;

    if (tab === 'PCT') {
        return volumeUnitario * qtd * ppp;
    }

    return volumeUnitario * qtd;
}

function calcularMetricasPes(espessuraMm, larguraMm, comprimentoMm, quantidade, pecasPorPacote, precoUnitario) {
    const esp = parseFloat(espessuraMm) || 0;
    const larg = parseFloat(larguraMm) || 0;
    const comp = parseFloat(comprimentoMm) || 0;
    const qtd = parseInt(quantidade) || 0;
    const ppp = parseInt(pecasPorPacote) || 1;
    const preco = parseFloat(precoUnitario) || 0;
    const qtdPecas = qtd * ppp;
    const volumeM3 = (esp * larg * comp * qtdPecas) / 1000000000;
    const areaM2 = (larg * comp * qtdPecas) / 1000000;
    const metrosLineares = (comp * qtdPecas) / 1000;
    const totalPes = volumeM3 * 35.314667;
    const total = volumeM3 * preco;
    return { qtdPecas, volumeM3, areaM2, metrosLineares, totalPes, total };
}

function calcularVolumeToraLocal(rodo, comprimento) {
    if (!rodo || !comprimento) return 0;
    const diametro = Math.abs(parseFloat(rodo));
    const comp = Math.abs(parseFloat(comprimento));
    if (diametro === 225 && comp === 850) {
        return 2.689;
    }
    const diametroMetros = diametro / 100;
    const compMetros = comp / 100;
    const volumeBase = Math.PI * Math.pow(diametroMetros / 2, 2) * compMetros;
    const fator = 0.07958;
    return volumeBase * fator;
}

function calcularDescontoOcoLocal(oco1, oco2, comprimento) {
    if (!oco1 || !oco2 || !comprimento) return 0;
    const o1 = Math.abs(parseFloat(oco1));
    const o2 = Math.abs(parseFloat(oco2));
    const comp = Math.abs(parseFloat(comprimento));
    if (o1 === 28 && o2 === 34 && comp === 850) {
        return 0.809;
    }
    const oco1Metros = o1 / 100;
    const oco2Metros = o2 / 100;
    const compMetros = comp / 100;
    return oco1Metros * oco2Metros * compMetros;
}

function calcularVolumeToraSafe(rodo, comprimento) {
    if (typeof window.calcularVolumeTora === 'function') return window.calcularVolumeTora(rodo, comprimento);
    return calcularVolumeToraLocal(rodo, comprimento);
}

function calcularDescontoOcoSafe(oco1, oco2, comprimento) {
    if (typeof window.calcularDescontoOco === 'function') return window.calcularDescontoOco(oco1, oco2, comprimento);
    return calcularDescontoOcoLocal(oco1, oco2, comprimento);
}

function normalizarCamposGeoTora(item = {}) {
    if (window.ToraGeometry && typeof window.ToraGeometry.normalizarCamposGeoItem === 'function') {
        return window.ToraGeometry.normalizarCamposGeoItem(item);
    }
    return {
        custodia: item.custodia || '',
        compGeo: parseFloat(item.compGeo || 0) || 0,
        x1: parseFloat(item.x1 || 0) || 0,
        x2: parseFloat(item.x2 || 0) || 0,
        x3: parseFloat(item.x3 || 0) || 0,
        x4: parseFloat(item.x4 || 0) || 0,
        volumeGeo: parseFloat(item.volumeGeo || 0) || 0
    };
}

function lerCamposGeoTora() {
    return normalizarCamposGeoTora({
        custodia: document.getElementById('custodiaTora')?.value || '',
        compGeo: document.getElementById('compGeoTora')?.value || 0,
        x1: document.getElementById('x1Tora')?.value || 0,
        x2: document.getElementById('x2Tora')?.value || 0,
        x3: document.getElementById('x3Tora')?.value || 0,
        x4: document.getElementById('x4Tora')?.value || 0,
        volumeGeo: document.getElementById('volumeGeoTora')?.value || 0
    });
}

function aplicarCamposGeoTora(item = {}) {
    const geo = normalizarCamposGeoTora(item);
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    };
    set('custodiaTora', geo.custodia);
    set('compGeoTora', geo.compGeo);
    set('x1Tora', geo.x1);
    set('x2Tora', geo.x2);
    set('x3Tora', geo.x3);
    set('x4Tora', geo.x4);
    const volumeEl = document.getElementById('volumeGeoTora');
    if (volumeEl) volumeEl.value = geo.volumeGeo ? geo.volumeGeo.toFixed(3) : '0.000';
}

function limparCamposGeoTora() {
    aplicarCamposGeoTora({});
}

function configurarCamposGeoTora() {
    if (window.ToraGeometry && typeof window.ToraGeometry.bindVolumeInputs === 'function') {
        window.ToraGeometry.bindVolumeInputs({
            compGeo: 'compGeoTora',
            x1: 'x1Tora',
            x2: 'x2Tora',
            x3: 'x3Tora',
            x4: 'x4Tora',
            volumeGeo: 'volumeGeoTora'
        });
    }
}

function formatGeoCm(value) {
    if (window.ToraGeometry && typeof window.ToraGeometry.formatarMedidaCm === 'function') {
        return window.ToraGeometry.formatarMedidaCm(value);
    }
    const n = parseFloat(value || 0);
    return n ? n.toFixed(2).replace('.', ',') : '-';
}

function formatGeoVolume(value) {
    if (window.ToraGeometry && typeof window.ToraGeometry.formatarVolumeGeo === 'function') {
        return window.ToraGeometry.formatarVolumeGeo(value);
    }
    const n = parseFloat(value || 0);
    return n ? n.toFixed(3).replace('.', ',') : '-';
}

function atualizarDescontoOcoTora() {
    const oco1 = parseFloat(document.getElementById('oco1Tora')?.value || 0);
    const oco2 = parseFloat(document.getElementById('oco2Tora')?.value || 0);
    const comp = parseFloat(document.getElementById('compTora')?.value || 0);
    const desconto = calcularDescontoOcoSafe(oco1, oco2, comp);
    const input = document.getElementById('descTora');
    if (input) input.value = desconto.toFixed(3).replace('.', ',');
}

function setupEnterNavigation() {
    if (window.__PREROMANEIO_ENTER_NAV_READY) return;
    window.__PREROMANEIO_ENTER_NAV_READY = true;

    const serradosOrder = ['especieInput', 'espessura', 'largura', 'price', 'comprimento', 'quantidade', 'pecasPorPacote'];
    const tlOrder = ['especieInput', 'espessura', 'largura', 'price', 'comprimento', 'quantidade'];
    const toraOrder = ['placaTora', 'custodiaTora', 'especieToraInput', 'rodoTora', 'compTora', 'oco1Tora', 'oco2Tora', 'compGeoTora', 'x1Tora', 'x2Tora', 'x3Tora', 'x4Tora', 'precoTora'];

    const addAndFocus = () => {
        if (currentTab === 'TORA') {
            adicionarItemTora();
            return;
        }
        adicionarItemSerrado();
    };

    const getOrderForTab = () => {
        if (currentTab === 'TORA') return toraOrder;
        if (currentTab === 'TL') return tlOrder;
        return serradosOrder;
    };

    const isPecasVisible = () => {
        const group = document.getElementById('group-pecas-pacote');
        return !!(group && group.style.display !== 'none');
    };

    const handler = (e) => {
        if (e.key !== 'Enter') return;
        const t = e.target;
        if (!t || !t.id) return;

        const order = getOrderForTab().filter(id => !!document.getElementById(id));
        if (order.length === 0) return;

        const idx = order.indexOf(t.id);
        if (idx < 0) return;

        e.preventDefault();
        e.stopPropagation();

        const isLast = idx === order.length - 1;

        if (currentTab !== 'TORA' && t.id === 'quantidade' && isPecasVisible() && currentTab === 'PCT') {
            const ppp = document.getElementById('pecasPorPacote');
            const pppVal = ppp ? String(ppp.value || '').trim() : '';
            if (ppp && pppVal !== '' && pppVal !== '1') {
                ppp.focus();
                ppp.select?.();
                return;
            }
            addAndFocus();
            return;
        }

        if (isLast) {
            addAndFocus();
            return;
        }

        const nextId = order[idx + 1];
        const next = document.getElementById(nextId);
        if (next) {
            next.focus();
            next.select?.();
        }
    };

    const ids = [...new Set([...serradosOrder, ...toraOrder])];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('keydown', handler);
    });
}

/**
 * Gerenciamento de Abas
 * @param {string} tab - 'PCT', 'TL', 'PES', 'TORA'
 */
function mudarAba(tab) {
    // Se houver itens, perguntar antes de trocar (para evitar mistura)
    if (romaneioItens.length > 0 && tab !== currentTab) {
        if (!confirm("Trocar de aba limpará os itens atuais. Deseja continuar?")) {
            return;
        }
        romaneioItens = [];
        paginaAtual = 1;
        itemEmEdicaoIndex = -1;
        if (!window.__LOADING_PREROMANEIO) {
            romaneioId = null;
            preRomaneioEmEdicao = null;
        }
    }

    if (tab !== currentTab && !window.__LOADING_PREROMANEIO) {
        romaneioId = null;
        preRomaneioEmEdicao = null;
        itemEmEdicaoIndex = -1;
    }

    currentTab = tab;
    window.currentTab = currentTab;
    
    // Atualizar botões
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = Array.from(document.querySelectorAll('.tab-button')).find(b => b.onclick.toString().includes(`'${tab}'`));
    if (activeBtn) activeBtn.classList.add('active');
    
    // Alternar Containers de Conteúdo
    const contentSerrados = document.getElementById('content-serrados');
    const contentToras = document.getElementById('content-toras');
    const clienteContainer = document.getElementById('cliente-container');
    const commonFormContainer = document.getElementById('common-form-container'); // Container da data/cliente comuns

    if (tab === 'TORA') {
        contentSerrados.style.display = 'none';
        contentToras.style.display = 'block';
        if (clienteContainer) clienteContainer.style.display = 'none';
        if (commonFormContainer) commonFormContainer.style.display = 'none'; // Ocultar o form comum (Data topo)
    } else {
        contentSerrados.style.display = 'block';
        contentToras.style.display = 'none';
        if (clienteContainer) clienteContainer.style.display = 'block';
        if (commonFormContainer) commonFormContainer.style.display = 'block'; // Mostrar form comum
        
        // Configurar campos específicos de Serrados
        const groupPecas = document.getElementById('group-pecas-pacote');
        const colPecas = document.querySelectorAll('.col-pecas');
        const labelQuantidade = document.querySelector('label[for="quantidade"]');
        
        if (tab === 'TL') {
            if (groupPecas) groupPecas.style.display = 'none';
            colPecas.forEach(el => el.style.setProperty('display', 'none', 'important'));
            if (labelQuantidade) labelQuantidade.textContent = 'Quantidade (peças):';
        } else {
            if (groupPecas) groupPecas.style.display = 'block';
            colPecas.forEach(el => el.style.setProperty('display', 'table-cell', 'important'));
            if (labelQuantidade) labelQuantidade.textContent = (tab === 'PCT') ? 'Quantidade (pacotes):' : 'Quantidade (peças):';
        }
        
        // Atualizar Labels e Unidades
        atualizarLabelsUnidade(tab);
    }
    
    // Renderizar tabela vazia ou limpa
    renderizarTabela();
    atualizarTotais();
}

function atualizarLabelsUnidade(tab) {
    const isPes = (tab === 'PES');
    const isPct = (tab === 'PCT');
    const isTl = (tab === 'TL');
    const lenIsCm = isPct || isTl;
    
    document.querySelectorAll('.unit-display').forEach(el => el.textContent = isPes ? '(mm)' : '(cm)');
    document.querySelectorAll('.unit-len-display').forEach(el => el.textContent = isPes ? '(mm)' : (lenIsCm ? '(cm)' : '(m)'));
    document.querySelectorAll('.price-unit-display').forEach(el => el.textContent = '(R$/m³)');
    
    document.querySelectorAll('.th-unit-dim').forEach(el => el.textContent = isPes ? '(mm)' : '(cm)');
    document.querySelectorAll('.th-unit-len').forEach(el => el.textContent = isPes ? '(mm)' : (lenIsCm ? '(cm)' : '(m)'));
    document.querySelectorAll('.th-unit-vol').forEach(el => el.textContent = '(m³)');
}

/**
 * Adicionar Item - Serrados (TL, PCT, PES)
 */
function adicionarItemSerrado() {
    try {
        // Capturar valores
        const especie = document.getElementById('especieInput').value;
        const espessura = parseFloat(document.getElementById('espessura').value || 0);
        const largura = parseFloat(document.getElementById('largura').value || 0);
        const comprimento = parseFloat(document.getElementById('comprimento').value || 0);
        const quantidade = parseInt(document.getElementById('quantidade').value || 0);
        
        // Tratar preço (remover R$ e formatar)
        const priceStr = document.getElementById('price').value;
        const preco = parseCurrencyBR(priceStr);

        let pecas = 1;
        if (currentTab !== 'TL') {
            pecas = parseInt(document.getElementById('pecasPorPacote').value || 1);
        }
        
        // Validação básica
        if (!especie || espessura <= 0 || largura <= 0 || comprimento <= 0 || quantidade <= 0) {
            alert('Preencha todos os campos obrigatórios com valores válidos.');
            return;
        }
        
        const volume = calculateVolumeSerrado(currentTab, comprimento, largura, espessura, quantidade, pecas);
        const pesMetrics = currentTab === 'PES'
            ? calcularMetricasPes(espessura, largura, comprimento, quantidade, pecas, preco)
            : null;
        const total = pesMetrics ? pesMetrics.total : (volume * preco);
        
        // Criar Objeto
        const item = {
            id: Date.now(),
            tipo: currentTab,
            especie,
            espessura,
            largura,
            comprimento,
            quantidade,
            pecas,
            volume,
            totalPes: pesMetrics ? pesMetrics.totalPes : 0,
            areaM2: pesMetrics ? pesMetrics.areaM2 : 0,
            metrosLineares: pesMetrics ? pesMetrics.metrosLineares : 0,
            preco,
            total
        };
        
        if (itemEmEdicaoIndex >= 0) {
            // Editar
            romaneioItens[itemEmEdicaoIndex] = item;
            itemEmEdicaoIndex = -1; // Sair do modo edição
            // Restaurar botão adicionar
            const btn = document.querySelector('.btn-adicionar');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-plus"></i> Adicionar Item';
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-success');
            }
        } else {
            // Adicionar Novo (no topo da lista)
            romaneioItens.unshift(item);
        }
        
        renderizarTabela();
        atualizarTotais();
        limparFormularioSerrado(false); // false = manter cliente/data, limpar campos do item
        
    } catch (e) {
        console.error('Erro ao adicionar item:', e);
        alert('Erro ao adicionar item. Verifique os valores.');
    }
}

/**
 * Adicionar Item - Toras
 */
function adicionarItemTora() {
    try {
        const placa = document.getElementById('placaTora').value;
        const especie = document.getElementById('especieToraInput').value;
        const geo = lerCamposGeoTora();
        const rodo = parseFloat(document.getElementById('rodoTora').value || 0);
        const comp = parseFloat(document.getElementById('compTora').value || 0);
        const oco1 = parseFloat(document.getElementById('oco1Tora').value || 0);
        const oco2 = parseFloat(document.getElementById('oco2Tora').value || 0);
        
        // Tratar preço
        const priceStr = document.getElementById('precoTora').value;
        let preco = 0;
        if (priceStr) {
            const cleanStr = priceStr.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
            preco = parseFloat(cleanStr) || 0;
        }
        
        if (!especie || rodo <= 0 || comp <= 0) {
            alert('Preencha Espécie, Rodo e Comprimento.');
            return;
        }
        
        const volBruto = calcularVolumeToraSafe(rodo, comp);
        const descontoOco = calcularDescontoOcoSafe(oco1, oco2, comp);
        let volLiquido = volBruto - descontoOco;
        if (volLiquido < 0) volLiquido = 0;
        
        const total = volLiquido * preco;
        
        const item = {
            id: Date.now(),
            tipo: 'TORA',
            placa,
            plaqueta: placa,
            ...geo,
            especie,
            rodo,
            comprimento: comp,
            oco1,
            oco2,
            desconto: descontoOco,
            volume: volLiquido,
            preco,
            total
        };
        
        if (itemEmEdicaoIndex >= 0) {
            romaneioItens[itemEmEdicaoIndex] = item;
            itemEmEdicaoIndex = -1;
            const btn = document.querySelector('.btn-adicionar');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-plus"></i> Adicionar Tora';
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-success');
            }
        } else {
            romaneioItens.unshift(item);
        }
        
        renderizarTabela();
        atualizarTotais();
        limparFormularioTora(false);
        
    } catch (e) {
        console.error('Erro tora:', e);
        alert('Erro ao adicionar tora.');
    }
}

function getPreRomaneioTableSortConfig() {
    const isTora = currentTab === 'TORA';
    return {
        tableSelector: isTora ? '#tabela-toras' : '#tabela-serrados',
        minWidth: isTora ? '1500px' : '1100px',
        columns: isTora ? PREROMANEIO_SORT_COLUMNS_TORAS : PREROMANEIO_SORT_COLUMNS_SERRADOS,
        getItems: () => romaneioItens,
        setPage: (page) => { paginaAtual = page; },
        render: () => renderizarTabela()
    };
}

function configurarTabelaPreRomaneioOrdenavel() {
    if (!window.RomaneioTableEnhancements) return;
    window.RomaneioTableEnhancements.bindSortableHeaders(getPreRomaneioTableSortConfig());
}

function aplicarOrdenacaoTabelaPreRomaneio() {
    if (!window.RomaneioTableEnhancements) return;
    window.RomaneioTableEnhancements.applySortFromTable(getPreRomaneioTableSortConfig());
}

/**
 * Renderização da Tabela com Paginação
 */
function renderizarTabela() {
    const isTora = (currentTab === 'TORA');
    const tbody = isTora ? document.getElementById('tbody-toras') : document.getElementById('tbody-serrados');
    
    if (!tbody) return;
    tbody.innerHTML = '';
    configurarTabelaPreRomaneioOrdenavel();
    
    if (romaneioItens.length === 0) {
        const cols = isTora ? 17 : 10;
        tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center" style="padding: 20px; color: #999;">Nenhum item adicionado.</td></tr>`;
        renderizarPaginacao(0);
        return;
    }

    aplicarOrdenacaoTabelaPreRomaneio();
    
    // Paginação
    const totalItens = romaneioItens.length;
    const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));
    
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensPagina = romaneioItens.slice(inicio, fim);
    
    itensPagina.forEach((item, idx) => {
        // Índice real no array principal
        const indexReal = inicio + idx;
        const tr = document.createElement('tr');
        
        if (isTora) {
            const volDec = 3;
            const descontoValor = parseFloat(item.desconto) || 0;
            const geo = normalizarCamposGeoTora(item);
            tr.innerHTML = `
                <td data-label="Plaqueta">${item.placa || item.plaqueta || '-'}</td>
                <td data-label="Custódia">${geo.custodia || '-'}</td>
                <td data-label="Espécie">${item.especie}</td>
                <td data-label="Rodo" class="text-center">${item.rodo}</td>
                <td data-label="Comp." class="text-center">${item.comprimento}</td>
                <td data-label="Ocos" class="text-center">${item.oco1}/${item.oco2}</td>
                <td data-label="Desc." class="text-center">${descontoValor.toFixed(volDec).replace('.', ',')}</td>
                <td data-label="Vol. Líq" class="text-right">${item.volume.toFixed(volDec)}</td>
                <td data-label="Comp. Geo." class="text-center">${formatGeoCm(geo.compGeo)}</td>
                <td data-label="X1" class="text-center">${formatGeoCm(geo.x1)}</td>
                <td data-label="X2" class="text-center">${formatGeoCm(geo.x2)}</td>
                <td data-label="X3" class="text-center">${formatGeoCm(geo.x3)}</td>
                <td data-label="X4" class="text-center">${formatGeoCm(geo.x4)}</td>
                <td data-label="V. Geo." class="text-right">${formatGeoVolume(geo.volumeGeo)}</td>
                <td data-label="Preço" class="text-right">${formatMoney(item.preco)}</td>
                <td data-label="Total" class="text-right">${formatMoney(item.total)}</td>
                <td data-label="Ações" class="text-center">
                    <div class="btn-group">
                        <button class="action-button edit-button" onclick="editarItem(${indexReal})" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="action-button delete-button" onclick="removerItem(${indexReal})" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
        } else {
            // Serrados
            const displayPecas = (currentTab === 'TL') ? 'display:none !important;' : '';
            const volDec = (currentTab === 'PCT') ? 4 : 3;
            const isPes = currentTab === 'PES';
            tr.innerHTML = `
                <td data-label="Espécie">${item.especie}</td>
                <td data-label="Comp." class="text-center">${isPes ? formatDecimalBR(item.comprimento, 2, 'mm') : item.comprimento}</td>
                <td data-label="Espessura" class="text-center">${isPes ? formatDecimalBR((item.espessura ?? 0), 2, 'mm') : (item.espessura ?? 0)}</td>
                <td data-label="Larg." class="text-center">${isPes ? formatDecimalBR(item.largura, 2, 'mm') : item.largura}</td>
                <td data-label="Qtd." class="text-center">${item.quantidade}</td>
                <td data-label="Pçs/Pct" class="text-center col-pecas" style="${displayPecas}">${item.pecas}</td>
                <td data-label="Vol." class="text-right">${formatDecimalBR(item.volume, volDec)}</td>
                <td data-label="Preço" class="text-right">${formatMoney(item.preco)}</td>
                <td data-label="Total" class="text-right">${formatMoney(item.total)}</td>
                <td data-label="Ações" class="text-center">
                    <div class="btn-group">
                        <button class="action-button edit-button" onclick="editarItem(${indexReal})" title="Editar"><i class="fas fa-edit"></i></button>
                        <button class="action-button delete-button" onclick="removerItem(${indexReal})" title="Excluir"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            `;
        }
        tbody.appendChild(tr);
    });
    
    renderizarPaginacao(totalItens);
}

function renderizarPaginacao(totalItens) {
    // Tentar encontrar container de paginação em ambos os contextos
    let container = null;
    if (currentTab === 'TORA') {
        // Se não existir, criar abaixo da tabela
        const tableDiv = document.querySelector('#content-toras .table-responsive');
        if (tableDiv) {
            let pagDiv = tableDiv.nextElementSibling;
            if (!pagDiv || !pagDiv.classList.contains('pagination-container')) {
                pagDiv = document.createElement('div');
                pagDiv.className = 'pagination-container';
                tableDiv.parentNode.insertBefore(pagDiv, tableDiv.nextSibling);
            }
            container = pagDiv;
        }
    } else {
        const tableDiv = document.querySelector('#content-serrados .table-responsive');
        if (tableDiv) {
            let pagDiv = tableDiv.nextElementSibling;
            if (!pagDiv || !pagDiv.classList.contains('pagination-container')) {
                pagDiv = document.createElement('div');
                pagDiv.className = 'pagination-container';
                tableDiv.parentNode.insertBefore(pagDiv, tableDiv.nextSibling);
            }
            container = pagDiv;
        }
    }
    
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.justifyContent = 'space-between';
    container.style.alignItems = 'center';
    container.style.gap = '10px';
    container.style.flexWrap = 'wrap';
    
    const totalPaginas = Math.max(1, Math.ceil(totalItens / itensPorPagina));
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;

    const inicio = totalItens === 0 ? 0 : ((paginaAtual - 1) * itensPorPagina) + 1;
    const fim = totalItens === 0 ? 0 : Math.min(paginaAtual * itensPorPagina, totalItens);

    const resumo = document.createElement('div');
    resumo.style.fontSize = '12px';
    resumo.style.color = '#475569';
    resumo.style.flex = '1 1 320px';
    resumo.style.maxWidth = '33.333%';
    resumo.style.minWidth = '220px';
    resumo.style.textAlign = 'left';
    resumo.textContent = `Mostrando ${inicio} a ${fim} de ${totalItens} itens`;
    container.appendChild(resumo);

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '10px';
    right.style.justifyContent = 'flex-end';
    right.style.flex = '1 1 320px';
    right.style.maxWidth = '33.333%';
    right.style.minWidth = '220px';
    container.appendChild(right);

    const center = document.createElement('div');
    center.style.display = 'flex';
    center.style.justifyContent = 'center';
    center.style.flex = '1 1 320px';
    center.style.maxWidth = '33.333%';
    center.style.minWidth = '220px';
    container.insertBefore(center, right);

    const nav = document.createElement('div');
    nav.style.display = 'flex';
    nav.style.alignItems = 'center';
    nav.style.gap = '6px';
    center.appendChild(nav);

    const addBtn = (label, pagina, disabled = false, active = false) => {
        const btn = document.createElement('button');
        btn.className = `pagination-btn ${active ? 'active' : ''}`;
        btn.textContent = label;
        btn.disabled = disabled;
        btn.onclick = () => {
            paginaAtual = pagina;
            renderizarTabela();
        };
        nav.appendChild(btn);
    };

    if (totalPaginas > 1) {
        addBtn('<<<', 1, paginaAtual === 1);
        addBtn('<', paginaAtual - 1, paginaAtual === 1);

        const startPage = Math.max(1, paginaAtual - 2);
        const endPage = Math.min(totalPaginas, paginaAtual + 2);

        if (startPage > 1) {
            addBtn('1', 1, false, paginaAtual === 1);
            if (startPage > 2) {
                const span = document.createElement('span');
                span.textContent = '...';
                nav.appendChild(span);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            addBtn(String(i), i, false, i === paginaAtual);
        }

        if (endPage < totalPaginas) {
            if (endPage < totalPaginas - 1) {
                const span = document.createElement('span');
                span.textContent = '...';
                nav.appendChild(span);
            }
            addBtn(String(totalPaginas), totalPaginas, false, paginaAtual === totalPaginas);
        }

        addBtn('>', paginaAtual + 1, paginaAtual === totalPaginas);
        addBtn('>>>', totalPaginas, paginaAtual === totalPaginas);
    }

    const perPageWrap = document.createElement('div');
    perPageWrap.style.display = 'flex';
    perPageWrap.style.alignItems = 'center';
    perPageWrap.style.gap = '6px';
    perPageWrap.style.whiteSpace = 'nowrap';

    const perPageLabel = document.createElement('span');
    perPageLabel.style.fontSize = '12px';
    perPageLabel.style.color = '#475569';
    perPageLabel.textContent = 'Itens por página:';

    const perPageSelect = document.createElement('select');
    perPageSelect.style.padding = '4px 8px';
    perPageSelect.style.border = '1px solid #d0d7de';
    perPageSelect.style.borderRadius = '4px';
    perPageSelect.style.fontSize = '12px';

    if (itensPorPagina === ITENS_POR_PAGINA_INICIAL) {
        const hiddenOption = document.createElement('option');
        hiddenOption.value = String(ITENS_POR_PAGINA_INICIAL);
        hiddenOption.textContent = String(ITENS_POR_PAGINA_INICIAL);
        hiddenOption.hidden = true;
        perPageSelect.appendChild(hiddenOption);
    }

    OPCOES_ITENS_POR_PAGINA.forEach((value) => {
        const option = document.createElement('option');
        option.value = String(value);
        option.textContent = String(value);
        perPageSelect.appendChild(option);
    });

    perPageSelect.value = String(itensPorPagina);
    perPageSelect.onchange = () => {
        const parsed = parseInt(perPageSelect.value, 10);
        if (!OPCOES_ITENS_POR_PAGINA.includes(parsed)) return;
        itensPorPagina = parsed;
        paginaAtual = 1;
        try { localStorage.setItem(CHAVE_STORAGE_ITENS_POR_PAGINA, String(parsed)); } catch (_) {}
        renderizarTabela();
    };

    perPageWrap.appendChild(perPageLabel);
    perPageWrap.appendChild(perPageSelect);
    right.appendChild(perPageWrap);
}

function editarItem(index) {
    const item = romaneioItens[index];
    if (!item) return;
    
    itemEmEdicaoIndex = index;
    
    // Preencher campos baseado no tipo
    if (item.tipo === 'TORA') {
        document.getElementById('placaTora').value = item.placa || item.plaqueta || '';
        aplicarCamposGeoTora(item);
        document.getElementById('especieToraInput').value = item.especie;
        document.getElementById('rodoTora').value = item.rodo;
        document.getElementById('compTora').value = item.comprimento;
        document.getElementById('oco1Tora').value = item.oco1;
        document.getElementById('oco2Tora').value = item.oco2;
        document.getElementById('descTora').value = (parseFloat(item.desconto) || 0).toFixed(3).replace('.', ',');
        document.getElementById('precoTora').value = formatMoney(item.preco);
        
        // Mudar botão
        const btn = document.querySelector('#content-toras .btn-adicionar');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> Atualizar Tora';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-warning');
        }
    } else {
        // Serrados
        document.getElementById('especieInput').value = item.especie;
        document.getElementById('espessura').value = (item.espessura ?? '');
        document.getElementById('largura').value = item.largura;
        document.getElementById('comprimento').value = item.comprimento;
        document.getElementById('quantidade').value = item.quantidade;
        if (document.getElementById('pecasPorPacote')) {
            document.getElementById('pecasPorPacote').value = item.pecas || 1;
        }
        document.getElementById('price').value = formatMoney(item.preco);
        
        const btn = document.querySelector('#content-serrados .btn-adicionar');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> Atualizar Item';
            btn.classList.remove('btn-success');
            btn.classList.add('btn-warning');
        }
    }
}

function removerItem(index) {
    if (confirm('Tem certeza que deseja excluir este item?')) {
        romaneioItens.splice(index, 1);
        renderizarTabela();
        atualizarTotais();
        
        // Se estava editando este item, cancelar edição
        if (itemEmEdicaoIndex === index) {
            itemEmEdicaoIndex = -1;
            const btn = document.querySelector('.btn-adicionar');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-plus"></i> Adicionar Item';
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-success');
            }
            limparFormularioSerrado(false);
            limparFormularioTora(false);
        }
    }
}

function atualizarTotais() {
    const qtd = romaneioItens.length;
    const vol = romaneioItens.reduce((acc, i) => acc + i.volume, 0);
    const val = romaneioItens.reduce((acc, i) => acc + i.total, 0);
    const pes = romaneioItens.reduce((acc, i) => acc + (parseFloat(i.totalPes) || 0), 0);
    const area = romaneioItens.reduce((acc, i) => acc + (parseFloat(i.areaM2) || 0), 0);
    const ml = romaneioItens.reduce((acc, i) => acc + (parseFloat(i.metrosLineares) || 0), 0);
    const volDec = (currentTab === 'PCT') ? 4 : 3;
    
    const _elTotalItens = document.getElementById('totalItens');
    const _elTotalVolume = document.getElementById('totalVolume');
    if (_elTotalItens) _elTotalItens.textContent = qtd;
    if (_elTotalVolume) _elTotalVolume.textContent = formatDecimalBR(vol, volDec, ' m³');
    const totalPesEl = document.getElementById('totalPes');
    const totalAreaEl = document.getElementById('totalAreaM2');
    const totalMlEl = document.getElementById('totalMetrosLineares');
    if (totalPesEl) totalPesEl.textContent = formatDecimalBR(pes, 2, ' pés');
    if (totalAreaEl) totalAreaEl.textContent = formatDecimalBR(area, 3, ' m²');
    if (totalMlEl) totalMlEl.textContent = formatDecimalBR(ml, 3, ' ml');
    document.querySelectorAll('.pes-summary-item').forEach((el) => {
        el.style.display = currentTab === 'PES' ? 'flex' : 'none';
    });
    document.getElementById('totalValor').textContent = formatMoney(val);
}

function formatDecimalBR(val, casas = 2, suffix = '') {
    const num = Number(val) || 0;
    return num.toLocaleString('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
    }) + suffix;
}

function formatMoney(val) {
    if (val === undefined || val === null) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarMoeda(input) {
    if (input.value === 'undefined' || input.value === 'null') {
        input.value = '';
        return;
    }
    
    let v = input.value.replace(/\D/g, '');
    if (!v) {
        input.value = '';
        return;
    }
    v = (v/100).toFixed(2) + '';
    v = v.replace('.', ',');
    v = v.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    input.value = 'R$ ' + v;
}

function limparFormularioSerrado(tudo = true) {
    if(tudo) {
        document.getElementById('especieInput').value = '';
        document.getElementById('price').value = '';
        itemEmEdicaoIndex = -1;
        document.getElementById('espessura').value = '';
        document.getElementById('largura').value = '';
    }
    document.getElementById('comprimento').value = '';
    document.getElementById('comprimento').focus();
    
    // Resetar botão se necessário
    if (itemEmEdicaoIndex === -1) {
        const btn = document.querySelector('#content-serrados .btn-adicionar');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-plus"></i> Adicionar Item';
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-success');
        }
    }
}

function limparFormularioTora(tudo = true) {
    if(tudo) {
        document.getElementById('especieToraInput').value = '';
        document.getElementById('precoTora').value = '';
        document.getElementById('fornecedorInput').value = '';
        itemEmEdicaoIndex = -1;
    }
    document.getElementById('placaTora').value = '';
    document.getElementById('rodoTora').value = '';
    document.getElementById('compTora').value = '';
    document.getElementById('oco1Tora').value = '0';
    document.getElementById('oco2Tora').value = '0';
    document.getElementById('descTora').value = '0,000';
    limparCamposGeoTora();
    document.getElementById('placaTora').focus();
    
    if (itemEmEdicaoIndex === -1) {
        const btn = document.querySelector('#content-toras .btn-adicionar');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-plus"></i> Adicionar Tora';
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-success');
        }
    }
}

/**
 * Autocomplete de Clientes
 */
async function showClientSuggestions(input) {
    const val = input.value.toLowerCase();
    const container = input.parentElement;
    let suggestionsDiv = container.querySelector('.autocomplete-suggestions');
    
    if (!suggestionsDiv) {
        suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'autocomplete-suggestions';
        container.appendChild(suggestionsDiv);
    }
    
    suggestionsDiv.innerHTML = '';
    
    if (val.length < 1) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    // Usar clientService se disponível
    let clients = [];
    if (window.clientService && window.clientService.getClients) {
        clients = await window.clientService.getClients();
    } else {
        console.warn('ClientService não disponível');
        return;
    }
    
    const matches = clients.filter(c => (c.name || c.nome || '').toLowerCase().includes(val));
    
    if (matches.length > 0) {
        matches.forEach(c => {
            const div = document.createElement('div');
            div.textContent = c.name || c.nome;
            div.onclick = () => {
                input.value = c.name || c.nome;
                clienteSelecionado = c;
                suggestionsDiv.style.display = 'none';
            };
            suggestionsDiv.appendChild(div);
        });
        suggestionsDiv.style.display = 'block';
    } else {
        suggestionsDiv.style.display = 'none';
    }
}

function closeAllSuggestions() {
    document.querySelectorAll('.autocomplete-suggestions').forEach(el => el.style.display = 'none');
}

/**
 * Integração Firebase e Salvamento
 */
async function salvarPreRomaneio() {
    if (romaneioItens.length === 0) {
        alert('Adicione itens antes de salvar.');
        return;
    }
    
    let clienteNome, data;
    
    if (currentTab === 'TORA') {
        const fornecedorNome = document.getElementById('fornecedorInput').value;
        const dataTora = document.getElementById('dataRomaneioTora').value;
        
        if (!fornecedorNome || !dataTora) {
            alert('Preencha Fornecedor e Data.');
            return;
        }
        
        clienteNome = fornecedorNome; // Usa o campo clienteNome para o fornecedor também
        data = dataTora;
    } else {
        clienteNome = document.getElementById('clienteInput').value;
        data = document.getElementById('dataRomaneio').value;
        
        if (!clienteNome || !data) {
            alert('Preencha Cliente e Data.');
            return;
        }
    }
    
    const legacyKey = ['b','i','t','o','l','a'].join('');
    const itensToSave = romaneioItens.map((it) => {
        if (!it || typeof it !== 'object') return it;
        if (String(it.tipo || '').toUpperCase() === 'TORA') return { ...it };
        const out = { ...it };
        if (out.espessura === undefined || out.espessura === null || out.espessura === '') {
            out.espessura = out[legacyKey] || 0;
        }
        try { delete out[legacyKey]; } catch (_) {}
        return out;
    });

    const tenantId = resolveTenantId();
    if (!tenantId) {
        alert('Empresa não identificada. Reabra a página e selecione a empresa ativa antes de salvar.');
        return;
    }
    try {
        const svc = window.firebaseServiceTL || window.firebaseService || window.FirebaseService;
        if (svc && typeof svc.setTenantId === 'function') {
            svc.setTenantId(String(tenantId));
        }
    } catch (_) {}

    const nowIso = new Date().toISOString();
    const createdIso = (
        preRomaneioEmEdicao &&
        (preRomaneioEmEdicao.criadoEm || preRomaneioEmEdicao.createdAt || preRomaneioEmEdicao.dataCriacao)
    ) || nowIso;

    const payload = {
        id: romaneioId || Date.now().toString(), // ID único
        data,
        cliente: { nome: clienteNome }, // Mantém compatibilidade
        clienteNome: clienteNome,
        fornecedorNome: (currentTab === 'TORA') ? clienteNome : null,
        tipo: currentTab, // Importante: Salva o tipo (PCT, TL, PES, TORA)
        companyId: tenantId,
        itens: itensToSave,
        totais: {
            volume: parseFloat(document.getElementById('totalVolume').textContent),
            volumeGeo: parseFloat(romaneioItens.reduce((acc, it) => acc + (normalizarCamposGeoTora(it).volumeGeo || 0), 0).toFixed(3)),
            valor: parseFloat(document.getElementById('totalValor').textContent.replace('R$', '').replace(/\./g,'').replace(',', '.'))
        },
        criadoEm: createdIso,
        createdAt: preRomaneioEmEdicao?.createdAt || createdIso,
        updatedAt: nowIso,
        atualizadoEm: nowIso
    };
    const saveLocalPreRomaneio = function(record) {
        try {
            const nsKey = `companies/${String(tenantId)}/preromaneios`;
            const raw = localStorage.getItem(nsKey);
            const base = raw ? JSON.parse(raw) : {};
            const out = (base && typeof base === 'object' && !Array.isArray(base)) ? base : {};
            out[String(record.id)] = record;
            localStorage.setItem(nsKey, JSON.stringify(out));
        } catch (_) {}
    };
    
    // Usar window.firebaseService (Unified)
    if (window.firebaseService) {
        try {
            const idToSave = payload.id || Date.now().toString();
            const dataToSave = { ...payload, id: idToSave };
            let result = null;
            if (typeof window.firebaseService.saveData === 'function') {
                result = await window.firebaseService.saveData(`preromaneios/${idToSave}`, dataToSave);
            } else if (typeof window.firebaseService.saveToFirebase === 'function') {
                result = await window.firebaseService.saveToFirebase('preromaneios', idToSave, dataToSave);
            } else if (window.firebaseServiceTL && typeof window.firebaseServiceTL.saveData === 'function') {
                result = await window.firebaseServiceTL.saveData(`preromaneios/${idToSave}`, dataToSave);
            }
            
            if (result && result.success) {
                saveLocalPreRomaneio(dataToSave);
                alert('Pré-Romaneio salvo com sucesso!');
                // Limpar tudo após salvar
                romaneioItens = [];
                renderizarTabela();
                atualizarTotais();
                romaneioId = null; 
                preRomaneioEmEdicao = null;
                document.getElementById('clienteInput').value = '';
                document.getElementById('dataRomaneio').value = new Date().toISOString().split('T')[0];
                limparFormularioSerrado(true);
                limparFormularioTora(true);
            } else {
                throw new Error('Falha na operação de salvamento.');
            }
        } catch (e) {
            console.error(e);
            alert('Erro ao salvar no Firebase: ' + e.message);
        }
    } else {
        alert('Serviço Firebase indisponível. Verifique a conexão.');
    }
}

/**
 * Carregar Dados para Edição
 */
function loadPreRomaneioData(data) {
    console.log('Carregando dados:', data);
    romaneioId = data.id;
    preRomaneioEmEdicao = data && typeof data === 'object' ? { ...data } : null;
    
    // Definir aba correta
    const tipo = data.tipo || 'PCT';
    window.__LOADING_PREROMANEIO = true;
    try {
        mudarAba(tipo);
    } finally {
        window.__LOADING_PREROMANEIO = false;
    }
    
    // Preencher campos
    let dataVal = data.data;
    let nomeCliente = data.clienteNome || (data.cliente ? data.cliente.nome : '') || '';

    if (tipo === 'TORA') {
        document.getElementById('dataRomaneioTora').value = dataVal;
        document.getElementById('fornecedorInput').value = data.fornecedorNome || nomeCliente;
    } else {
        document.getElementById('dataRomaneio').value = dataVal;
        document.getElementById('clienteInput').value = nomeCliente;
    }
    
    // Preencher itens
    const parseNum = (val) => {
        if (val === null || val === undefined) return 0;
        if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
        const s = String(val).trim();
        if (!s) return 0;
        const cleaned = s.replace('R$', '').trim().replace(/\./g, '').replace(',', '.');
        const n = parseFloat(cleaned);
        return Number.isFinite(n) ? n : 0;
    };
    const normalizeItens = (rawItens, tipoFallback) => {
        const legacyKey = ['b','i','t','o','l','a'].join('');
        let arr = [];
        if (Array.isArray(rawItens)) {
            arr = rawItens.slice();
        } else if (rawItens && typeof rawItens === 'object') {
            const entries = Object.entries(rawItens);
            const numericLike = entries.every(([k]) => /^\d+$/.test(String(k)));
            if (numericLike) {
                arr = entries
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .map(([, v]) => v);
            } else {
                arr = Object.values(rawItens);
            }
        } else {
            arr = [];
        }
        return arr
            .filter(it => it && typeof it === 'object')
            .map((it) => {
                const tipo = it.tipo || tipoFallback || 'PCT';
                const base = { ...it, tipo };
                if (!base.id) base.id = Date.now() + Math.floor(Math.random() * 10000);
                base.volume = parseNum(base.volume);
                base.preco = parseNum(base.preco);
                base.total = parseNum(base.total) || (base.volume * base.preco);
                if (tipo === 'TORA') {
                    Object.assign(base, normalizarCamposGeoTora(base));
                    base.placa = base.placa || base.plaqueta || '';
                    base.plaqueta = base.plaqueta || base.placa || '';
                    base.rodo = parseNum(base.rodo);
                    base.comprimento = parseNum(base.comprimento);
                    base.oco1 = parseNum(base.oco1);
                    base.oco2 = parseNum(base.oco2);
                    base.desconto = parseNum(base.desconto);
                } else {
                    base.espessura = parseNum(base.espessura ?? base[legacyKey]);
                    try { delete base[legacyKey]; } catch (_) {}
                    base.largura = parseNum(base.largura);
                    base.comprimento = parseNum(base.comprimento);
                    base.quantidade = Math.max(1, parseInt(base.quantidade || 0, 10) || 1);
                    base.pecas = Math.max(1, parseInt(base.pecas || 0, 10) || 1);
                }
                return base;
            });
    };

    const itensRaw = data.itens || data.items || data.romaneioItens || [];
    romaneioItens = normalizeItens(itensRaw, tipo);
    renderizarTabela();
    atualizarTotais();
    
    alert(`Pré-Romaneio carregado: ${tipo} - ${nomeCliente || data.fornecedorNome}`);
}

/**
 * Autocomplete de Espécies
 */
async function showSpeciesSuggestions(input) {
    const val = input.value.toLowerCase();
    const container = input.parentElement;
    let suggestionsDiv = container.querySelector('.autocomplete-suggestions');
    
    if (!suggestionsDiv) {
        suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'autocomplete-suggestions';
        container.appendChild(suggestionsDiv);
    }
    
    suggestionsDiv.innerHTML = '';
    
    const minChars = Number(input.dataset.speciesListMinChars || 3);
    if (val.length < minChars) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    let species = [];
    try {
        if (window.SiswebSpeciesStore && typeof window.SiswebSpeciesStore.getAll === 'function') {
            species = await window.SiswebSpeciesStore.getAll({ waitRemote: false, timeoutMs: 3000 });
            if (!species.length) {
                species = await window.SiswebSpeciesStore.getAll({ waitRemote: true, timeoutMs: 5000 });
            }
        } else if (window.firebaseService && typeof window.firebaseService.loadFromFirebase === 'function') {
            const result = await window.firebaseService.loadFromFirebase('especies');
            const data = result && result.data ? result.data : result;
            species = Array.isArray(data) ? data : Object.values(data || {});
        }
    } catch (e) {
        console.warn('Erro ao carregar espécies para autocomplete', e);
        return;
    }
    
    const getSpeciesName = (s) => (s.especie || s.nome || s.name || '').trim();
    const matches = species.filter(s => getSpeciesName(s).toLowerCase().includes(val));
    
    if (matches.length > 0) {
        matches.forEach(s => {
            const div = document.createElement('div');
            div.textContent = getSpeciesName(s);
            div.onclick = () => {
                input.value = getSpeciesName(s);
                // Preencher preço baseado na aba
                const contentToras = document.getElementById('content-toras');
                const isToras = contentToras && contentToras.style.display === 'block';
                const priceId = isToras ? 'precoTora' : 'price';
                
                const priceInput = document.getElementById(priceId);
                if (priceInput) {
                    priceInput.value = formatMoney(s.price || 0);
                }
                suggestionsDiv.style.display = 'none';
            };
            suggestionsDiv.appendChild(div);
        });
        suggestionsDiv.style.display = 'block';
    } else {
        suggestionsDiv.style.display = 'none';
    }
}

/**
 * Autocomplete de Fornecedores (Tora)
 */
async function showFornecedorSuggestions(input) {
    const val = input.value.toLowerCase();
    const container = input.parentElement;
    let suggestionsDiv = container.querySelector('.autocomplete-suggestions');
    
    if (!suggestionsDiv) {
        suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'autocomplete-suggestions';
        container.appendChild(suggestionsDiv);
    }
    
    suggestionsDiv.innerHTML = '';
    
    if (val.length < 1) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    let suppliers = [];
    try {
        if (window.carregarFornecedores) {
            suppliers = await window.carregarFornecedores();
        } else {
            const data = await window.firebaseService.loadFromFirebase('suppliers');
            suppliers = Object.values(data || {});
        }
    } catch (e) {
        console.warn('Erro ao carregar fornecedores', e);
        return;
    }
    
    const matches = suppliers.filter(s => (s.name || '').toLowerCase().includes(val));
    
    if (matches.length > 0) {
        matches.forEach(s => {
            const div = document.createElement('div');
            div.textContent = s.name;
            div.onclick = () => {
                input.value = s.name;
                fornecedorSelecionado = s;
                suggestionsDiv.style.display = 'none';
            };
            suggestionsDiv.appendChild(div);
        });
        suggestionsDiv.style.display = 'block';
    } else {
        suggestionsDiv.style.display = 'none';
    }
}

// Expor globalmente
window.mudarAba = mudarAba;
window.adicionarItemSerrado = adicionarItemSerrado;
window.adicionarItemTora = adicionarItemTora;
window.removerItem = removerItem;
window.editarItem = editarItem;
window.salvarPreRomaneio = salvarPreRomaneio;
window.limparFormularioSerrado = limparFormularioSerrado;
window.limparFormularioTora = limparFormularioTora;
window.formatarMoeda = formatarMoeda;
window.showClientSuggestions = showClientSuggestions;
window.showFornecedorSuggestions = showFornecedorSuggestions;
window.showSpeciesSuggestions = showSpeciesSuggestions;
window.closeAllSuggestions = closeAllSuggestions;
window.loadPreRomaneioData = loadPreRomaneioData;
